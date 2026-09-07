package com.sshworkspace.dto;

import lombok.*;

public class MonitoringDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ServerMetricsDto {
        private String cpuUsage;       // e.g. "31%"
        private String memoryUsage;    // e.g. "62%"
        private String memoryDetails;  // e.g. "2.4 GB / 4.0 GB"
        private String diskUsage;      // e.g. "74%"
        private String diskDetails;    // e.g. "37 GB / 50 GB"
        private String loadAverage;    // e.g. "1.42, 1.20, 0.95"
        private String uptime;         // e.g. "18d 04h 22m"
        private String osName;         // e.g. "Linux 6.8.0-45-generic"
    }
}
