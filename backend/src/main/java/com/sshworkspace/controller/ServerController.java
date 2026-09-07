package com.sshworkspace.controller;

import com.sshworkspace.dto.ServerDtos.*;
import com.sshworkspace.dto.SessionDtos.ConnectResponse;
import com.sshworkspace.model.*;
import com.sshworkspace.repository.*;
import com.sshworkspace.security.UserPrincipal;
import com.sshworkspace.service.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.sshd.client.session.ClientSession;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/servers")
@RequiredArgsConstructor
@Slf4j
public class ServerController {

    private final ServerProfileRepository serverRepository;
    private final CredentialRepository credentialRepository;
    private final ServerGroupRepository groupRepository;
    private final TagRepository tagRepository;
    private final SessionRecordRepository sessionRecordRepository;
    private final EncryptionService encryptionService;
    private final SshClientService sshClientService;
    private final SshSessionManager sshSessionManager;
    private final AuditService auditService;

    @GetMapping
    public ResponseEntity<List<ServerResponse>> listServers(@AuthenticationPrincipal UserPrincipal principal) {
        List<ServerProfile> servers = serverRepository.findByUserId(principal.getId());
        List<ServerResponse> responses = servers.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(responses);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<ServerResponse> createServer(@AuthenticationPrincipal UserPrincipal principal,
                                                       @Valid @RequestBody ServerCreateRequest request) {
        // 1. Process Group
        Long groupId = null;
        if (request.getGroupName() != null && !request.getGroupName().isBlank()) {
            ServerGroup group = groupRepository.findByUserIdAndName(principal.getId(), request.getGroupName().trim())
                    .orElseGet(() -> groupRepository.save(ServerGroup.builder()
                            .userId(principal.getId())
                            .name(request.getGroupName().trim())
                            .build()));
            groupId = group.getId();
        }

        // 2. Process Credentials (Encrypt immediately - SEC-001)
        Long credentialId = null;
        String rawSecret = "KEY".equalsIgnoreCase(request.getAuthType()) ? request.getPrivateKey() : request.getPassword();
        if (rawSecret != null && !rawSecret.isBlank()) {
            String encrypted = encryptionService.encrypt(rawSecret.trim());
            Credential cred = Credential.builder()
                    .userId(principal.getId())
                    .type(request.getAuthType().toUpperCase())
                    .encryptedData(encrypted)
                    .build();
            cred = credentialRepository.save(cred);
            credentialId = cred.getId();
        }

        // 3. Process Tags
        Set<Tag> tags = new HashSet<>();
        if (request.getTags() != null) {
            for (String tagName : request.getTags()) {
                if (!tagName.isBlank()) {
                    Tag tag = tagRepository.findByUserIdAndName(principal.getId(), tagName.trim())
                            .orElseGet(() -> tagRepository.save(Tag.builder()
                                    .userId(principal.getId())
                                    .name(tagName.trim())
                                    .build()));
                    tags.add(tag);
                }
            }
        }

        ServerProfile server = ServerProfile.builder()
                .userId(principal.getId())
                .name(request.getName().trim())
                .hostname(request.getHostname().trim())
                .port(request.getPort() != null ? request.getPort() : 22)
                .username(request.getUsername().trim())
                .authType(request.getAuthType().toUpperCase())
                .credentialId(credentialId)
                .groupId(groupId)
                .tags(tags)
                .build();

        server = serverRepository.save(server);
        auditService.recordEvent(principal.getId(), server.getName(), "SERVER_CREATE", "SUCCESS", "Created server " + server.getHostname());

        return ResponseEntity.ok(mapToResponse(server));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ServerResponse> getServer(@AuthenticationPrincipal UserPrincipal principal,
                                                    @PathVariable Long id) {
        ServerProfile server = serverRepository.findByIdAndUserId(id, principal.getId())
                .orElseThrow(() -> new IllegalArgumentException("Server not found"));
        return ResponseEntity.ok(mapToResponse(server));
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<ServerResponse> updateServer(@AuthenticationPrincipal UserPrincipal principal,
                                                       @PathVariable Long id,
                                                       @RequestBody ServerUpdateRequest request) {
        ServerProfile server = serverRepository.findByIdAndUserId(id, principal.getId())
                .orElseThrow(() -> new IllegalArgumentException("Server not found"));

        if (request.getName() != null && !request.getName().isBlank()) server.setName(request.getName().trim());
        if (request.getHostname() != null && !request.getHostname().isBlank()) server.setHostname(request.getHostname().trim());
        if (request.getPort() != null) server.setPort(request.getPort());
        if (request.getUsername() != null && !request.getUsername().isBlank()) server.setUsername(request.getUsername().trim());
        if (request.getAuthType() != null) server.setAuthType(request.getAuthType().toUpperCase());

        if (request.getGroupName() != null) {
            if (request.getGroupName().isBlank()) {
                server.setGroupId(null);
            } else {
                ServerGroup group = groupRepository.findByUserIdAndName(principal.getId(), request.getGroupName().trim())
                        .orElseGet(() -> groupRepository.save(ServerGroup.builder()
                                .userId(principal.getId())
                                .name(request.getGroupName().trim())
                                .build()));
                server.setGroupId(group.getId());
            }
        }

        String currentAuthType = server.getAuthType();
        String rawSecret = "KEY".equalsIgnoreCase(currentAuthType) ? request.getPrivateKey() : request.getPassword();
        if (rawSecret != null && !rawSecret.isBlank()) {
            String encrypted = encryptionService.encrypt(rawSecret.trim());
            if (server.getCredentialId() != null) {
                credentialRepository.findByIdAndUserId(server.getCredentialId(), principal.getId())
                        .ifPresent(c -> {
                            c.setType(currentAuthType);
                            c.setEncryptedData(encrypted);
                            credentialRepository.save(c);
                        });
            } else {
                Credential cred = Credential.builder()
                        .userId(principal.getId())
                        .type(server.getAuthType())
                        .encryptedData(encrypted)
                        .build();
                cred = credentialRepository.save(cred);
                server.setCredentialId(cred.getId());
            }
        }

        if (request.getTags() != null) {
            Set<Tag> tags = new HashSet<>();
            for (String tagName : request.getTags()) {
                if (!tagName.isBlank()) {
                    Tag tag = tagRepository.findByUserIdAndName(principal.getId(), tagName.trim())
                            .orElseGet(() -> tagRepository.save(Tag.builder()
                                    .userId(principal.getId())
                                    .name(tagName.trim())
                                    .build()));
                    tags.add(tag);
                }
            }
            server.setTags(tags);
        }

        server = serverRepository.save(server);
        auditService.recordEvent(principal.getId(), server.getName(), "SERVER_UPDATE", "SUCCESS", "Updated server configuration");
        return ResponseEntity.ok(mapToResponse(server));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteServer(@AuthenticationPrincipal UserPrincipal principal,
                                          @PathVariable Long id) {
        ServerProfile server = serverRepository.findByIdAndUserId(id, principal.getId())
                .orElseThrow(() -> new IllegalArgumentException("Server not found"));

        // Terminate any active sessions for this server first (FR-006)
        List<SessionRecord> activeSessions = sessionRecordRepository.findByServerIdAndStatus(id, "ACTIVE");
        for (SessionRecord session : activeSessions) {
            sshSessionManager.cleanupSession(session.getId(), "CLOSED");
        }

        if (server.getCredentialId() != null) {
            credentialRepository.deleteByIdAndUserId(server.getCredentialId(), principal.getId());
        }

        serverRepository.delete(server);
        auditService.recordEvent(principal.getId(), server.getName(), "SERVER_DELETE", "SUCCESS", "Deleted server profile");
        return ResponseEntity.ok(Map.of("message", "Server deleted successfully"));
    }

    @PostMapping("/{id}/test")
    public ResponseEntity<ConnectionTestResponse> testConnection(@AuthenticationPrincipal UserPrincipal principal,
                                                                 @PathVariable Long id) {
        ServerProfile server = serverRepository.findByIdAndUserId(id, principal.getId())
                .orElseThrow(() -> new IllegalArgumentException("Server not found"));

        String password = null;
        String privateKey = null;
        String passphrase = null;

        if (server.getCredentialId() != null) {
            Credential credential = credentialRepository.findByIdAndUserId(server.getCredentialId(), principal.getId()).orElse(null);
            if (credential != null) {
                String decrypted = encryptionService.decrypt(credential.getEncryptedData());
                if ("KEY".equalsIgnoreCase(credential.getType())) {
                    privateKey = decrypted;
                } else {
                    password = decrypted;
                }
            }
        }

        ConnectionTestResponse response = sshClientService.testConnection(server, password, privateKey, passphrase);
        auditService.recordEvent(principal.getId(), server.getName(), "SSH_TEST", response.isSuccess() ? "SUCCESS" : "FAILED", response.getMessage());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/connect")
    public ResponseEntity<ConnectResponse> connectServer(@AuthenticationPrincipal UserPrincipal principal,
                                                         @PathVariable Long id) {
        ServerProfile server = serverRepository.findByIdAndUserId(id, principal.getId())
                .orElseThrow(() -> new IllegalArgumentException("Server not found"));

        String password = null;
        String privateKey = null;
        String passphrase = null;

        if (server.getCredentialId() != null) {
            Credential credential = credentialRepository.findByIdAndUserId(server.getCredentialId(), principal.getId()).orElse(null);
            if (credential != null) {
                String decrypted = encryptionService.decrypt(credential.getEncryptedData());
                if ("KEY".equalsIgnoreCase(credential.getType())) {
                    privateKey = decrypted;
                } else {
                    password = decrypted;
                }
            }
        }

        try {
            // Establish authenticated SSH session through Apache MINA SSHD
            ClientSession clientSession = sshClientService.createSession(server, password, privateKey, passphrase);

            String sessionId = UUID.randomUUID().toString();

            // Persist session record
            SessionRecord sessionRecord = SessionRecord.builder()
                    .id(sessionId)
                    .userId(principal.getId())
                    .serverId(server.getId())
                    .status("CONNECTING")
                    .build();
            sessionRecordRepository.save(sessionRecord);

            // Register in SshSessionManager
            sshSessionManager.registerSession(sessionId, principal.getId(), server.getId(), server.getName(), clientSession);

            return ResponseEntity.ok(ConnectResponse.builder()
                    .sessionId(sessionId)
                    .serverId(server.getId())
                    .serverName(server.getName())
                    .wsUrl("/ws/terminal/" + sessionId)
                    .status("CONNECTING")
                    .build());
        } catch (Exception e) {
            log.error("Failed to establish SSH connection for server {}: {}", server.getHostname(), e.getMessage());
            auditService.recordEvent(principal.getId(), server.getName(), "SSH_CONNECT", "FAILED", e.getMessage());
            throw new RuntimeException("SSH Connection failed: " + e.getMessage(), e);
        }
    }

    @GetMapping("/groups")
    public ResponseEntity<List<String>> getGroups(@AuthenticationPrincipal UserPrincipal principal) {
        List<String> groups = groupRepository.findByUserId(principal.getId()).stream()
                .map(ServerGroup::getName)
                .collect(Collectors.toList());
        return ResponseEntity.ok(groups);
    }

    @GetMapping("/tags")
    public ResponseEntity<List<String>> getTags(@AuthenticationPrincipal UserPrincipal principal) {
        List<String> tags = tagRepository.findByUserId(principal.getId()).stream()
                .map(Tag::getName)
                .collect(Collectors.toList());
        return ResponseEntity.ok(tags);
    }

    private ServerResponse mapToResponse(ServerProfile server) {
        String groupName = null;
        if (server.getGroupId() != null) {
            groupName = groupRepository.findById(server.getGroupId())
                    .map(ServerGroup::getName)
                    .orElse(null);
        }

        Set<String> tagNames = server.getTags() != null
                ? server.getTags().stream().map(Tag::getName).collect(Collectors.toSet())
                : Collections.emptySet();

        return ServerResponse.builder()
                .id(server.getId())
                .name(server.getName())
                .hostname(server.getHostname())
                .port(server.getPort())
                .username(server.getUsername())
                .authType(server.getAuthType())
                .groupName(groupName)
                .tags(tagNames)
                .status("ONLINE") // Baseline status
                .createdAt(server.getCreatedAt())
                .updatedAt(server.getUpdatedAt())
                .build();
    }
}
