package com.sshworkspace.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.util.List;

public class ServiceDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DiscoveredServiceDto {
        private String id;
        private String name;
        private String displayName;
        private String category;       // DATABASE, WEB, RUNTIME, CONTAINER, SYSTEM, CUSTOM
        private String status;         // RUNNING, STOPPED, FAILED, UNKNOWN
        private String source;         // SYSTEMD, OPENRC, DOCKER, SOCKET, PROCESS
        private Integer pid;
        private List<Integer> ports;
        private List<String> bindAddresses;
        private String cpuPercent;
        private String memoryUsage;
        private String uptime;
        private String cliCommand;
        private Integer defaultTunnelPort;
        private boolean canManage;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ServiceActionRequestDto {
        @NotBlank(message = "Service ID is required")
        private String serviceId;

        @NotBlank(message = "Service name is required")
        private String serviceName;

        @NotBlank(message = "Action is required")
        private String action; // START, STOP, RESTART, RELOAD

        private String source; // SYSTEMD, OPENRC, DOCKER
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ServiceActionResponseDto {
        private boolean success;
        private String message;
        private String output;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ServiceLogsResponseDto {
        private String serviceName;
        private List<String> lines;
        private String source;
        private String error;
    }
}
