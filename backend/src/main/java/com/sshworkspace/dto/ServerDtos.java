package com.sshworkspace.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;

public class ServerDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ServerCreateRequest {
        @NotBlank(message = "Server name is required")
        private String name;

        @NotBlank(message = "Hostname or IP is required")
        private String hostname;

        @Min(1)
        @Max(65535)
        @Builder.Default
        private Integer port = 22;

        @NotBlank(message = "SSH Username is required")
        private String username;

        @NotBlank(message = "Authentication type (PASSWORD or KEY) is required")
        private String authType; // PASSWORD or KEY

        // Plaintext secret input from client (will be immediately encrypted and NEVER stored or logged)
        private String password;
        private String privateKey;
        private String passphrase;

        private String groupName;
        private Set<String> tags;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ServerUpdateRequest {
        private String name;
        private String hostname;
        private Integer port;
        private String username;
        private String authType;

        // Optional update of password or private key
        private String password;
        private String privateKey;
        private String passphrase;

        private String groupName;
        private Set<String> tags;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ServerResponse {
        private Long id;
        private String name;
        private String hostname;
        private Integer port;
        private String username;
        private String authType;
        private String groupName;
        private Set<String> tags;
        private String status; // ONLINE, OFFLINE, UNKNOWN
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ConnectionTestResponse {
        private boolean success;
        private String message;
        private Long latencyMs;
    }
}
