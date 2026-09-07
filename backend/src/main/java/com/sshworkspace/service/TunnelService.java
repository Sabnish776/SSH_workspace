package com.sshworkspace.service;

import com.sshworkspace.dto.TunnelDtos.TunnelResponse;
import com.sshworkspace.model.Credential;
import com.sshworkspace.model.ServerProfile;
import com.sshworkspace.model.ServiceTunnel;
import com.sshworkspace.repository.CredentialRepository;
import com.sshworkspace.repository.ServerProfileRepository;
import com.sshworkspace.repository.ServiceTunnelRepository;
import jakarta.annotation.PreDestroy;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.apache.sshd.client.session.ClientSession;
import org.apache.sshd.client.session.forward.ExplicitPortForwardingTracker;
import org.apache.sshd.common.util.net.SshdSocketAddress;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TunnelService {

    private final ServiceTunnelRepository tunnelRepository;
    private final ServerProfileRepository serverRepository;
    private final CredentialRepository credentialRepository;
    private final EncryptionService encryptionService;
    private final SshClientService sshClientService;
    private final AuditService auditService;

    private final Map<Long, ActiveTunnelHolder> activeTunnels = new ConcurrentHashMap<>();

    @Getter
    @Setter
    public static class ActiveTunnelHolder {
        private Long tunnelId;
        private Long userId;
        private Long serverId;
        private ClientSession clientSession;
        private ExplicitPortForwardingTracker tracker;
        private int localPort;
    }

    public List<TunnelResponse> listTunnelsForServer(Long serverId, Long userId) {
        ServerProfile server = serverRepository.findByIdAndUserId(serverId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Server not found"));

        List<ServiceTunnel> tunnels = tunnelRepository.findByUserIdAndServerId(userId, serverId);
        return tunnels.stream()
                .map(t -> mapToResponse(t, server.getName()))
                .collect(Collectors.toList());
    }

    public List<TunnelResponse> listAllTunnels(Long userId) {
        List<ServiceTunnel> tunnels = tunnelRepository.findByUserId(userId);
        return tunnels.stream().map(t -> {
            String serverName = serverRepository.findById(t.getServerId())
                    .map(ServerProfile::getName)
                    .orElse("Unknown");
            return mapToResponse(t, serverName);
        }).collect(Collectors.toList());
    }

    public synchronized TunnelResponse startTunnel(Long tunnelId, Long userId) {
        ServiceTunnel tunnel = tunnelRepository.findByIdAndUserId(tunnelId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Tunnel configuration not found"));

        if (activeTunnels.containsKey(tunnelId)) {
            log.info("Tunnel {} is already active on port {}", tunnelId, tunnel.getLocalPort());
            return mapToResponse(tunnel, getServerName(tunnel.getServerId()));
        }

        ServerProfile server = serverRepository.findByIdAndUserId(tunnel.getServerId(), userId)
                .orElseThrow(() -> new IllegalArgumentException("Server not found"));

        String password = null;
        String privateKey = null;
        String passphrase = null;

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

        try {
            ClientSession session = sshClientService.createSession(server, password, privateKey, passphrase);

            SshdSocketAddress local = new SshdSocketAddress("127.0.0.1", tunnel.getLocalPort());
            SshdSocketAddress remote = new SshdSocketAddress(tunnel.getRemoteHost(), tunnel.getRemotePort());

            ExplicitPortForwardingTracker tracker = session.createLocalPortForwardingTracker(local, remote);

            ActiveTunnelHolder holder = new ActiveTunnelHolder();
            holder.setTunnelId(tunnelId);
            holder.setUserId(userId);
            holder.setServerId(server.getId());
            holder.setClientSession(session);
            holder.setTracker(tracker);
            holder.setLocalPort(tunnel.getLocalPort());

            activeTunnels.put(tunnelId, holder);

            auditService.recordEvent(userId, server.getName(), "TUNNEL_START", "SUCCESS",
                    String.format("Tunnel '%s' active: 127.0.0.1:%d -> %s:%d", tunnel.getName(), tunnel.getLocalPort(), tunnel.getRemoteHost(), tunnel.getRemotePort()));
            log.info("Port forwarding active: 127.0.0.1:{} -> {}:{}", tunnel.getLocalPort(), tunnel.getRemoteHost(), tunnel.getRemotePort());

            return mapToResponse(tunnel, server.getName());
        } catch (Exception e) {
            log.error("Failed to start tunnel {}: {}", tunnelId, e.getMessage());
            auditService.recordEvent(userId, server.getName(), "TUNNEL_START", "FAILED", e.getMessage());
            throw new RuntimeException("Failed to activate port tunnel: " + e.getMessage(), e);
        }
    }

    public synchronized TunnelResponse stopTunnel(Long tunnelId, Long userId) {
        ServiceTunnel tunnel = tunnelRepository.findByIdAndUserId(tunnelId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Tunnel configuration not found"));

        ActiveTunnelHolder holder = activeTunnels.remove(tunnelId);
        if (holder != null) {
            try {
                if (holder.getTracker() != null) {
                    holder.getTracker().close();
                }
            } catch (IOException ignored) {}

            try {
                if (holder.getClientSession() != null && holder.getClientSession().isOpen()) {
                    holder.getClientSession().close(false);
                }
            } catch (Exception ignored) {}

            auditService.recordEvent(userId, getServerName(tunnel.getServerId()), "TUNNEL_STOP", "SUCCESS",
                    String.format("Stopped tunnel '%s' (port %d)", tunnel.getName(), tunnel.getLocalPort()));
            log.info("Stopped tunnel {} on port {}", tunnelId, tunnel.getLocalPort());
        }

        return mapToResponse(tunnel, getServerName(tunnel.getServerId()));
    }

    public void deleteTunnel(Long tunnelId, Long userId) {
        stopTunnel(tunnelId, userId);
        tunnelRepository.deleteById(tunnelId);
    }

    public boolean isTunnelActive(Long tunnelId) {
        return activeTunnels.containsKey(tunnelId);
    }

    @PreDestroy
    public void cleanupAll() {
        log.info("Cleaning up all active SSH tunnels...");
        for (Long tunnelId : activeTunnels.keySet()) {
            try {
                ActiveTunnelHolder holder = activeTunnels.remove(tunnelId);
                if (holder != null) {
                    if (holder.getTracker() != null) holder.getTracker().close();
                    if (holder.getClientSession() != null) holder.getClientSession().close(true);
                }
            } catch (Exception ignored) {}
        }
    }

    private String getServerName(Long serverId) {
        return serverRepository.findById(serverId).map(ServerProfile::getName).orElse("Unknown");
    }

    private TunnelResponse mapToResponse(ServiceTunnel tunnel, String serverName) {
        boolean active = isTunnelActive(tunnel.getId());
        String type = tunnel.getServiceType() != null ? tunnel.getServiceType().toUpperCase() : "CUSTOM";
        int port = tunnel.getLocalPort();

        String connStr;
        String cli;

        switch (type) {
            case "MYSQL":
                connStr = String.format("mysql://root@127.0.0.1:%d/database", port);
                cli = String.format("mysql -h 127.0.0.1 -P %d -u root -p", port);
                break;
            case "POSTGRES":
                connStr = String.format("postgresql://postgres@127.0.0.1:%d/postgres", port);
                cli = String.format("psql -h 127.0.0.1 -p %d -U postgres", port);
                break;
            case "REDIS":
                connStr = String.format("redis://127.0.0.1:%d", port);
                cli = String.format("redis-cli -h 127.0.0.1 -p %d", port);
                break;
            case "MONGODB":
                connStr = String.format("mongodb://127.0.0.1:%d", port);
                cli = String.format("mongosh mongodb://127.0.0.1:%d", port);
                break;
            case "HTTP":
                connStr = String.format("http://127.0.0.1:%d", port);
                cli = String.format("curl http://127.0.0.1:%d", port);
                break;
            default:
                connStr = String.format("127.0.0.1:%d -> %s:%d", port, tunnel.getRemoteHost(), tunnel.getRemotePort());
                cli = String.format("nc -zv 127.0.0.1 %d", port);
                break;
        }

        return TunnelResponse.builder()
                .id(tunnel.getId())
                .serverId(tunnel.getServerId())
                .serverName(serverName)
                .name(tunnel.getName())
                .serviceType(type)
                .localPort(tunnel.getLocalPort())
                .remoteHost(tunnel.getRemoteHost())
                .remotePort(tunnel.getRemotePort())
                .active(active)
                .connectionString(connStr)
                .cliCommand(cli)
                .createdAt(tunnel.getCreatedAt())
                .build();
    }
}
