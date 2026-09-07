package com.sshworkspace.service;

import com.sshworkspace.dto.BroadcastDtos.BroadcastRequest;
import com.sshworkspace.dto.BroadcastDtos.BroadcastResponse;
import com.sshworkspace.dto.BroadcastDtos.ServerExecutionResult;
import com.sshworkspace.model.Credential;
import com.sshworkspace.model.ServerProfile;
import com.sshworkspace.model.User;
import com.sshworkspace.repository.CredentialRepository;
import com.sshworkspace.repository.ServerProfileRepository;
import com.sshworkspace.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.sshd.client.channel.ChannelExec;
import org.apache.sshd.client.channel.ClientChannelEvent;
import org.apache.sshd.client.session.ClientSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class BroadcastService {

    private final ServerProfileRepository serverRepository;
    private final CredentialRepository credentialRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EncryptionService encryptionService;
    private final SshClientService sshClientService;
    private final AuditService auditService;
    private final CommandSafetyService commandSafetyService;

    @Value("${app.ssh.channel-open-timeout-ms:30000}")
    private long channelOpenTimeoutMs;

    private final ExecutorService executor = Executors.newCachedThreadPool();

    public BroadcastResponse broadcastCommand(BroadcastRequest request, Long userId) {
        // Safety check: detect destructive commands and challenge for account password
        CommandSafetyService.SafetyCheckResult safety = commandSafetyService.analyze(request.getCommand());
        if (safety.isDestructive()) {
            if (request.getConfirmationPassword() == null || request.getConfirmationPassword().isBlank()) {
                auditService.recordEvent(userId, "CLUSTER", "DESTRUCTIVE_EXEC_BLOCKED", "FAILED",
                        "Blocked destructive command without password confirmation [" + safety.getRiskCategory() + "]: " + request.getCommand());
                throw new SecurityException("High-risk destructive command detected [" + safety.getRiskCategory() + "]: " +
                        safety.getReason() + " Account password confirmation is required.");
            }

            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));

            if (!passwordEncoder.matches(request.getConfirmationPassword(), user.getPasswordHash())) {
                auditService.recordEvent(userId, "CLUSTER", "DESTRUCTIVE_EXEC_AUTH_FAILED", "FAILED",
                        "Invalid password supplied for destructive command: " + request.getCommand());
                throw new SecurityException("Invalid account password. Destructive command execution was denied.");
            }

            auditService.recordEvent(userId, "CLUSTER", "DESTRUCTIVE_EXEC_AUTHORIZED", "SUCCESS",
                    "User re-authenticated to authorize destructive command: " + request.getCommand());
        }

        List<ServerProfile> targets = serverRepository.findAllById(request.getServerIds()).stream()
                .filter(server -> server.getUserId().equals(userId))
                .toList();

        if (targets.isEmpty()) {
            throw new IllegalArgumentException("No valid servers found for current user matching requested IDs");
        }

        long timeoutMs = (request.getTimeoutMs() != null && request.getTimeoutMs() > 0) ? request.getTimeoutMs() : 15000L;
        Map<Long, ServerExecutionResult> results = new ConcurrentHashMap<>();

        List<CompletableFuture<Void>> futures = targets.stream()
                .map(server -> CompletableFuture.runAsync(() -> {
                    ServerExecutionResult res = executeOnServer(server, request.getCommand(), userId, timeoutMs);
                    results.put(server.getId(), res);
                }, executor))
                .toList();

        try {
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).get(timeoutMs + 5000L, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            log.warn("Cluster broadcast timed out waiting for all target futures");
        } catch (Exception e) {
            log.warn("Error waiting for cluster broadcast futures: {}", e.getMessage());
        }

        int successCount = 0;
        int failedCount = 0;
        for (ServerExecutionResult res : results.values()) {
            if (res.isSuccess()) {
                successCount++;
            } else {
                failedCount++;
            }
        }

        // For any targets that did not complete in time
        for (ServerProfile server : targets) {
            results.putIfAbsent(server.getId(), ServerExecutionResult.builder()
                    .serverId(server.getId())
                    .serverName(server.getName())
                    .hostname(server.getHostname())
                    .port(server.getPort())
                    .success(false)
                    .exitCode(-1)
                    .output("")
                    .error("Execution timed out after " + timeoutMs + "ms")
                    .durationMs(timeoutMs)
                    .build());
        }

        auditService.recordEvent(
                userId,
                "CLUSTER",
                "BROADCAST_EXEC",
                successCount + "/" + targets.size() + " succeeded",
                "cmd: " + request.getCommand()
        );

        return BroadcastResponse.builder()
                .command(request.getCommand())
                .executedAt(OffsetDateTime.now())
                .totalTargets(targets.size())
                .successCount(successCount)
                .failedCount(failedCount)
                .results(results)
                .build();
    }

    private ServerExecutionResult executeOnServer(ServerProfile server, String command, Long userId, long timeoutMs) {
        long startTime = System.currentTimeMillis();
        String password = null;
        String privateKey = null;
        String passphrase = null;

        try {
            if (server.getCredentialId() != null) {
                Credential credential = credentialRepository.findByIdAndUserId(server.getCredentialId(), userId).orElse(null);
                if (credential != null) {
                    String decrypted = encryptionService.decrypt(credential.getEncryptedData());
                    if ("KEY".equalsIgnoreCase(credential.getType())) {
                        privateKey = decrypted;
                    } else {
                        password = decrypted;
                    }
                }
            }

            Duration connectTimeout = Duration.ofMillis(Math.min(timeoutMs, 8000L));
            try (ClientSession session = sshClientService.createSession(server, password, privateKey, passphrase, connectTimeout)) {
                try (ChannelExec channel = session.createExecChannel(command)) {
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    ByteArrayOutputStream err = new ByteArrayOutputStream();
                    channel.setOut(out);
                    channel.setErr(err);

                    channel.open().verify(Math.min(channelOpenTimeoutMs, timeoutMs), TimeUnit.MILLISECONDS);
                    channel.waitFor(EnumSet.of(ClientChannelEvent.CLOSED), timeoutMs);

                    long duration = System.currentTimeMillis() - startTime;
                    Integer exitStatus = channel.getExitStatus();
                    int exitCode = (exitStatus != null) ? exitStatus : 0;

                    String stdout = out.toString(StandardCharsets.UTF_8);
                    String stderr = err.toString(StandardCharsets.UTF_8);

                    boolean success = (exitCode == 0);
                    String combinedOutput = stdout;
                    String errorText = null;

                    if (!stderr.isBlank()) {
                        if (combinedOutput.isBlank()) {
                            combinedOutput = stderr;
                        } else {
                            combinedOutput += "\n[STDERR]\n" + stderr;
                        }
                        if (exitCode != 0) {
                            errorText = stderr.trim();
                        }
                    }

                    return ServerExecutionResult.builder()
                            .serverId(server.getId())
                            .serverName(server.getName())
                            .hostname(server.getHostname())
                            .port(server.getPort())
                            .success(success)
                            .exitCode(exitCode)
                            .output(combinedOutput)
                            .error(errorText)
                            .durationMs(duration)
                            .build();
                }
            }
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.debug("Broadcast exec failed on server {}: {}", server.getName(), e.getMessage());
            return ServerExecutionResult.builder()
                    .serverId(server.getId())
                    .serverName(server.getName())
                    .hostname(server.getHostname())
                    .port(server.getPort())
                    .success(false)
                    .exitCode(-1)
                    .output("")
                    .error(e.getMessage() != null ? e.getMessage() : "Execution failed")
                    .durationMs(duration)
                    .build();
        }
    }
}
