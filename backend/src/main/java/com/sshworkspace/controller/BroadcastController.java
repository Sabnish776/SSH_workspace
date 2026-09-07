package com.sshworkspace.controller;

import com.sshworkspace.dto.BroadcastDtos.BroadcastRequest;
import com.sshworkspace.dto.BroadcastDtos.BroadcastResponse;
import com.sshworkspace.security.UserPrincipal;
import com.sshworkspace.service.BroadcastService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cluster")
@RequiredArgsConstructor
@Slf4j
public class BroadcastController {

    private final BroadcastService broadcastService;

    @PostMapping("/broadcast")
    public ResponseEntity<BroadcastResponse> broadcastCommand(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody BroadcastRequest request) {
        log.info("User {} triggered cluster broadcast command '{}' across {} servers",
                principal.getId(), request.getCommand(), request.getServerIds().size());
        BroadcastResponse response = broadcastService.broadcastCommand(request, principal.getId());
        return ResponseEntity.ok(response);
    }
}
