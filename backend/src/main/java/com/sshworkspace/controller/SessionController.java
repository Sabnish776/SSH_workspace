package com.sshworkspace.controller;

import com.sshworkspace.dto.SessionDtos.SessionResponse;
import com.sshworkspace.model.ServerProfile;
import com.sshworkspace.model.SessionRecord;
import com.sshworkspace.repository.ServerProfileRepository;
import com.sshworkspace.repository.SessionRecordRepository;
import com.sshworkspace.security.UserPrincipal;
import com.sshworkspace.service.SshSessionManager;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final SessionRecordRepository sessionRecordRepository;
    private final ServerProfileRepository serverRepository;
    private final SshSessionManager sshSessionManager;

    @GetMapping
    public ResponseEntity<List<SessionResponse>> listSessions(@AuthenticationPrincipal UserPrincipal principal) {
        List<SessionRecord> records = sessionRecordRepository.findByUserIdOrderByCreatedAtDesc(principal.getId());

        List<SessionResponse> responses = records.stream().map(rec -> {
            ServerProfile server = serverRepository.findById(rec.getServerId()).orElse(null);
            return SessionResponse.builder()
                    .id(rec.getId())
                    .serverId(rec.getServerId())
                    .serverName(server != null ? server.getName() : "Unknown")
                    .serverHostname(server != null ? server.getHostname() : "Unknown")
                    .status(rec.getStatus())
                    .createdAt(rec.getCreatedAt())
                    .connectedAt(rec.getConnectedAt())
                    .disconnectedAt(rec.getDisconnectedAt())
                    .build();
        }).collect(Collectors.toList());

        return ResponseEntity.ok(responses);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> terminateSession(@AuthenticationPrincipal UserPrincipal principal,
                                              @PathVariable String id) {
        sshSessionManager.terminateSession(id, principal.getId());
        return ResponseEntity.ok(Map.of("message", "Session terminated successfully"));
    }
}
