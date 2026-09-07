package com.sshworkspace.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

public class BroadcastDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class BroadcastRequest {
        @NotEmpty(message = "At least one server must be targeted")
        private List<Long> serverIds;

        @NotBlank(message = "Command to broadcast is required")
        private String command;

        @Builder.Default
        private Long timeoutMs = 15000L;

        private String confirmationPassword;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ServerExecutionResult {
        private Long serverId;
        private String serverName;
        private String hostname;
        private Integer port;
        private boolean success;
        private Integer exitCode;
        private String output;
        private String error;
        private long durationMs;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class BroadcastResponse {
        private String command;
        private OffsetDateTime executedAt;
        private int totalTargets;
        private int successCount;
        private int failedCount;
        private Map<Long, ServerExecutionResult> results;
    }
}
