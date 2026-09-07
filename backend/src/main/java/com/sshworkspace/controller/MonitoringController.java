package com.sshworkspace.controller;

import com.sshworkspace.dto.MonitoringDtos.ServerMetricsDto;
import com.sshworkspace.model.ServerProfile;
import com.sshworkspace.repository.ServerProfileRepository;
import com.sshworkspace.security.UserPrincipal;
import com.sshworkspace.service.MonitoringService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/servers/{id}/monitoring")
@RequiredArgsConstructor
public class MonitoringController {

    private final MonitoringService monitoringService;
    private final ServerProfileRepository serverRepository;

    @GetMapping
    public ResponseEntity<ServerMetricsDto> getMetrics(@AuthenticationPrincipal UserPrincipal principal,
                                                       @PathVariable Long id) {
        ServerProfile server = serverRepository.findByIdAndUserId(id, principal.getId())
                .orElseThrow(() -> new IllegalArgumentException("Server not found"));

        ServerMetricsDto metrics = monitoringService.getMetrics(server, principal.getId());
        return ResponseEntity.ok(metrics);
    }
}
