package com.sshworkspace.controller;

import com.sshworkspace.dto.TunnelDtos.TunnelCreateRequest;
import com.sshworkspace.dto.TunnelDtos.TunnelResponse;
import com.sshworkspace.model.ServiceTunnel;
import com.sshworkspace.repository.ServiceTunnelRepository;
import com.sshworkspace.security.UserPrincipal;
import com.sshworkspace.service.TunnelService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TunnelController {

    private final TunnelService tunnelService;
    private final ServiceTunnelRepository tunnelRepository;

    @GetMapping("/servers/{serverId}/tunnels")
    public ResponseEntity<List<TunnelResponse>> listServerTunnels(@AuthenticationPrincipal UserPrincipal principal,
                                                                 @PathVariable Long serverId) {
        return ResponseEntity.ok(tunnelService.listTunnelsForServer(serverId, principal.getId()));
    }

    @GetMapping("/tunnels")
    public ResponseEntity<List<TunnelResponse>> listAllTunnels(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(tunnelService.listAllTunnels(principal.getId()));
    }

    @PostMapping("/servers/{serverId}/tunnels")
    public ResponseEntity<TunnelResponse> createTunnel(@AuthenticationPrincipal UserPrincipal principal,
                                                       @PathVariable Long serverId,
                                                       @Valid @RequestBody TunnelCreateRequest request) {
        ServiceTunnel tunnel = ServiceTunnel.builder()
                .userId(principal.getId())
                .serverId(serverId)
                .name(request.getName().trim())
                .serviceType(request.getServiceType().toUpperCase())
                .localPort(request.getLocalPort())
                .remoteHost(request.getRemoteHost() != null ? request.getRemoteHost().trim() : "127.0.0.1")
                .remotePort(request.getRemotePort())
                .autoStart(request.getAutoStart() != null ? request.getAutoStart() : false)
                .build();

        final ServiceTunnel savedTunnel = tunnelRepository.save(tunnel);

        if (Boolean.TRUE.equals(savedTunnel.getAutoStart())) {
            return ResponseEntity.ok(tunnelService.startTunnel(savedTunnel.getId(), principal.getId()));
        }

        List<TunnelResponse> list = tunnelService.listTunnelsForServer(serverId, principal.getId());
        TunnelResponse res = list.stream().filter(t -> t.getId().equals(savedTunnel.getId())).findFirst().orElse(null);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/tunnels/{tunnelId}/start")
    public ResponseEntity<TunnelResponse> startTunnel(@AuthenticationPrincipal UserPrincipal principal,
                                                      @PathVariable Long tunnelId) {
        return ResponseEntity.ok(tunnelService.startTunnel(tunnelId, principal.getId()));
    }

    @PostMapping("/tunnels/{tunnelId}/stop")
    public ResponseEntity<TunnelResponse> stopTunnel(@AuthenticationPrincipal UserPrincipal principal,
                                                     @PathVariable Long tunnelId) {
        return ResponseEntity.ok(tunnelService.stopTunnel(tunnelId, principal.getId()));
    }

    @DeleteMapping("/tunnels/{tunnelId}")
    public ResponseEntity<?> deleteTunnel(@AuthenticationPrincipal UserPrincipal principal,
                                          @PathVariable Long tunnelId) {
        tunnelService.deleteTunnel(tunnelId, principal.getId());
        return ResponseEntity.ok(Map.of("message", "Tunnel deleted successfully"));
    }
}
