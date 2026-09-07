package com.sshworkspace.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.time.OffsetDateTime;

public class TunnelDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TunnelCreateRequest {
        @NotBlank(message = "Tunnel name is required")
        private String name;

        @NotBlank(message = "Service type is required")
        private String serviceType; // MYSQL, POSTGRES, REDIS, MONGODB, HTTP, CUSTOM

        @Min(1024)
        @Max(65535)
        private Integer localPort;

        @NotBlank
        @Builder.Default
        private String remoteHost = "127.0.0.1";

        @Min(1)
        @Max(65535)
        private Integer remotePort;

        @Builder.Default
        private Boolean autoStart = false;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TunnelResponse {
        private Long id;
        private Long serverId;
        private String serverName;
        private String name;
        private String serviceType;
        private Integer localPort;
        private String remoteHost;
        private Integer remotePort;
        private boolean active;
        private String connectionString;
        private String cliCommand;
        private OffsetDateTime createdAt;
    }
}
