package com.sshworkspace.service;

import com.sshworkspace.dto.ServerDtos.ConnectionTestResponse;
import com.sshworkspace.model.ServerProfile;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.apache.sshd.client.SshClient;
import org.apache.sshd.client.future.ConnectFuture;
import org.apache.sshd.client.session.ClientSession;
import org.apache.sshd.common.config.keys.FilePasswordProvider;
import org.apache.sshd.common.keyprovider.KeyIdentityProvider;
import org.apache.sshd.common.util.security.SecurityUtils;
import org.bouncycastle.openssl.PEMKeyPair;
import org.bouncycastle.openssl.PEMParser;
import org.bouncycastle.openssl.jcajce.JcaPEMKeyConverter;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class SshClientService {

    private SshClient sshClient;

    @org.springframework.beans.factory.annotation.Value("${app.ssh.connect-timeout-ms:30000}")
    private long connectTimeoutMs;

    @org.springframework.beans.factory.annotation.Value("${app.ssh.channel-open-timeout-ms:30000}")
    private long channelOpenTimeoutMs;

    @org.springframework.beans.factory.annotation.Value("${app.ssh.heartbeat-interval-ms:15000}")
    private long heartbeatIntervalMs;

    @PostConstruct
    public void init() {
        log.info("Initializing Apache MINA SSH Client (connectTimeout: {}ms, channelTimeout: {}ms, heartbeat: {}ms)...",
                connectTimeoutMs, channelOpenTimeoutMs, heartbeatIntervalMs);
        sshClient = SshClient.setUpDefaultClient();
        // Optimize TCP latency: disable Nagle's algorithm for interactive keystrokes
        org.apache.sshd.core.CoreModuleProperties.TCP_NODELAY.set(sshClient, true);
        org.apache.sshd.core.CoreModuleProperties.SOCKET_KEEPALIVE.set(sshClient, true);
        // Configure timeouts for mobile/cellular/Tailscale/remote hosts
        org.apache.sshd.core.CoreModuleProperties.IO_CONNECT_TIMEOUT.set(sshClient, Duration.ofMillis(connectTimeoutMs));
        org.apache.sshd.core.CoreModuleProperties.AUTH_TIMEOUT.set(sshClient, Duration.ofMillis(connectTimeoutMs));
        org.apache.sshd.core.CoreModuleProperties.CHANNEL_OPEN_TIMEOUT.set(sshClient, Duration.ofMillis(channelOpenTimeoutMs));
        org.apache.sshd.core.CoreModuleProperties.IDLE_TIMEOUT.set(sshClient, Duration.ofDays(1));
        org.apache.sshd.core.CoreModuleProperties.HEARTBEAT_INTERVAL.set(sshClient, Duration.ofMillis(heartbeatIntervalMs));

        // Allow unverified server keys for interactive remote management (like standard first-time SSH accept)
        sshClient.setServerKeyVerifier((clientSession, remoteAddress, serverKey) -> true);
        sshClient.start();
        log.info("Apache MINA SSH Client started successfully with TCP_NODELAY and keepalive enabled.");
    }

    @PreDestroy
    public void cleanup() {
        if (sshClient != null && sshClient.isStarted()) {
            log.info("Stopping Apache MINA SSH Client...");
            sshClient.stop();
        }
    }

    public ConnectionTestResponse testConnection(ServerProfile server, String password, String privateKey, String passphrase) {
        long startTime = System.currentTimeMillis();
        ClientSession session = null;
        try {
            session = createSession(server, password, privateKey, passphrase, Duration.ofMillis(connectTimeoutMs));
            long latency = System.currentTimeMillis() - startTime;
            return ConnectionTestResponse.builder()
                    .success(true)
                    .latencyMs(latency)
                    .message("Successfully connected and authenticated in " + latency + "ms")
                    .build();
        } catch (Exception e) {
            log.warn("SSH connection test failed for {}: {}", server.getHostname(), e.getMessage());
            String errorMsg = sanitizeErrorMessage(e);
            return ConnectionTestResponse.builder()
                    .success(false)
                    .latencyMs(System.currentTimeMillis() - startTime)
                    .message(errorMsg)
                    .build();
        } finally {
            if (session != null && session.isOpen()) {
                try {
                    session.close(false);
                } catch (Exception ignored) {}
            }
        }
    }

    public ClientSession createSession(ServerProfile server, String password, String privateKey, String passphrase) throws Exception {
        return createSession(server, password, privateKey, passphrase, Duration.ofMillis(connectTimeoutMs));
    }

    public ClientSession createSession(ServerProfile server, String password, String privateKey, String passphrase, Duration timeout) throws Exception {
        log.info("Establishing SSH connection to {}@{}:{}", server.getUsername(), server.getHostname(), server.getPort());
        ConnectFuture connectFuture = sshClient.connect(server.getUsername(), server.getHostname(), server.getPort());
        connectFuture.verify(timeout.toMillis(), TimeUnit.MILLISECONDS);
        ClientSession session = connectFuture.getSession();

        try {
            if ("KEY".equalsIgnoreCase(server.getAuthType()) && privateKey != null && !privateKey.isBlank()) {
                Iterable<KeyPair> keyPairs = loadKeyPairs(privateKey, passphrase);
                session.setKeyIdentityProvider(KeyIdentityProvider.wrapKeyPairs(keyPairs));
            } else if (password != null && !password.isBlank()) {
                session.addPasswordIdentity(password);
            }

            session.auth().verify(timeout.toMillis(), TimeUnit.MILLISECONDS);
            log.info("SSH Authentication successful for {}@{}:{}", server.getUsername(), server.getHostname(), server.getPort());
            return session;
        } catch (Exception e) {
            session.close(true);
            throw e;
        }
    }

    private Iterable<KeyPair> loadKeyPairs(String privateKeyPem, String passphrase) throws Exception {
        try {
            // First attempt with Apache MINA SSHD SecurityUtils
            FilePasswordProvider passwordProvider = (passphrase != null && !passphrase.isEmpty())
                    ? FilePasswordProvider.of(passphrase)
                    : FilePasswordProvider.EMPTY;

            Iterable<KeyPair> keyPairs = SecurityUtils.loadKeyPairIdentities(
                    null,
                    () -> "memory-key",
                    new ByteArrayInputStream(privateKeyPem.getBytes(StandardCharsets.UTF_8)),
                    passwordProvider
            );
            if (keyPairs != null && keyPairs.iterator().hasNext()) {
                return keyPairs;
            }
        } catch (Exception e) {
            log.debug("Standard SSHD key loading failed, trying BouncyCastle fallback: {}", e.getMessage());
        }

        // BouncyCastle PEMParser fallback
        try (PEMParser pemParser = new PEMParser(new StringReader(privateKeyPem))) {
            Object object = pemParser.readObject();
            JcaPEMKeyConverter converter = new JcaPEMKeyConverter();
            if (object instanceof PEMKeyPair) {
                KeyPair kp = converter.getKeyPair((PEMKeyPair) object);
                return List.of(kp);
            } else if (object instanceof KeyPair) {
                return List.of((KeyPair) object);
            }
        }

        throw new IllegalArgumentException("Unable to parse private key format. Please provide a valid PEM / OpenSSH key.");
    }

    private String sanitizeErrorMessage(Exception e) {
        String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
        if (msg.contains("Connection refused") || e.getCause() instanceof java.net.ConnectException) {
            return "Connection refused: SSH port may be closed or host unreachable.";
        }
        if (msg.contains("timeout") || msg.contains("timed out") || e instanceof java.util.concurrent.TimeoutException) {
            return "Connection timed out. Check hostname, port, or firewall.";
        }
        if (msg.contains("Authentication failed") || msg.contains("auth")) {
            return "Authentication failed: Invalid username, password, or SSH key.";
        }
        if (msg.contains("UnknownHostException") || msg.contains("unresolved")) {
            return "Host unreachable: Could not resolve hostname.";
        }
        return "SSH Error: " + msg;
    }
}
