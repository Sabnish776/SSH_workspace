package com.sshworkspace.controller;

import com.sshworkspace.dto.ServiceDtos.DiscoveredServiceDto;
import com.sshworkspace.dto.ServiceDtos.ServiceActionRequestDto;
import com.sshworkspace.dto.ServiceDtos.ServiceActionResponseDto;
import com.sshworkspace.dto.ServiceDtos.ServiceLogsResponseDto;
import com.sshworkspace.security.UserPrincipal;
import com.sshworkspace.service.ServiceManagerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/servers/{serverId}/services")
@RequiredArgsConstructor
public class ServiceManagerController {

    private final ServiceManagerService serviceManagerService;

    @GetMapping
    public ResponseEntity<List<DiscoveredServiceDto>> getServices(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long serverId) {
        List<DiscoveredServiceDto> services = serviceManagerService.discoverServices(serverId, principal.getId());
        return ResponseEntity.ok(services);
    }

    @PostMapping("/action")
    public ResponseEntity<ServiceActionResponseDto> executeAction(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long serverId,
            @Valid @RequestBody ServiceActionRequestDto request) {
        ServiceActionResponseDto response = serviceManagerService.executeAction(serverId, principal.getId(), request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{serviceName}/logs")
    public ResponseEntity<ServiceLogsResponseDto> getServiceLogs(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long serverId,
            @PathVariable String serviceName,
            @RequestParam(required = false, defaultValue = "SYSTEMD") String source) {
        ServiceLogsResponseDto logs = serviceManagerService.getServiceLogs(serverId, principal.getId(), serviceName, source);
        return ResponseEntity.ok(logs);
    }
}
