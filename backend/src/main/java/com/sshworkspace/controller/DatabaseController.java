package com.sshworkspace.controller;

import com.sshworkspace.dto.DatabaseQueryDtos.DatabaseQueryRequest;
import com.sshworkspace.dto.DatabaseQueryDtos.DatabaseQueryResponse;
import com.sshworkspace.security.UserPrincipal;
import com.sshworkspace.service.DatabaseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/servers/{serverId}/database")
@RequiredArgsConstructor
public class DatabaseController {

    private final DatabaseService databaseService;

    @PostMapping("/query")
    public ResponseEntity<DatabaseQueryResponse> executeQuery(@AuthenticationPrincipal UserPrincipal principal,
                                                              @PathVariable Long serverId,
                                                              @Valid @RequestBody DatabaseQueryRequest request) {
        return ResponseEntity.ok(databaseService.executeQuery(serverId, principal.getId(), request));
    }
}
