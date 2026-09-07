package com.sshworkspace.dto;

import lombok.*;

import java.time.OffsetDateTime;

public class SessionDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ConnectResponse {
        private String sessionId;
        private Long serverId;
        private String serverName;
        private String wsUrl;
        private String status;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SessionResponse {
        private String id;
        private Long serverId;
        private String serverName;
        private String serverHostname;
        private String status;
        private OffsetDateTime createdAt;
        private OffsetDateTime connectedAt;
        private OffsetDateTime disconnectedAt;
    }
}
