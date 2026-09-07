package com.sshworkspace.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.util.List;
import java.util.Map;

public class DatabaseQueryDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DatabaseQueryRequest {
        @NotBlank(message = "Service type is required")
        private String serviceType; // MYSQL, POSTGRES, REDIS

        @NotBlank(message = "Query or command is required")
        private String query;

        private String databaseName;
        private String username;
        private String password;
        private Integer port;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DatabaseQueryResponse {
        private boolean success;
        private List<String> columns;
        private List<List<String>> rows;
        private int rowCount;
        private long executionTimeMs;
        private String rawOutput;
        private String error;
    }
}
