package com.sshworkspace.service;

import com.sshworkspace.dto.MonitoringDtos.ServerMetricsDto;
import com.sshworkspace.model.Credential;
import com.sshworkspace.model.ServerProfile;
import com.sshworkspace.repository.CredentialRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.sshd.client.channel.ChannelExec;
import org.apache.sshd.client.session.ClientSession;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class MonitoringService {

    private final SshClientService sshClientService;
    private final CredentialRepository credentialRepository;
    private final EncryptionService encryptionService;

    @org.springframework.beans.factory.annotation.Value("${app.ssh.channel-open-timeout-ms:30000}")
    private long channelOpenTimeoutMs;

    @org.springframework.beans.factory.annotation.Value("${app.ssh.exec-timeout-ms:30000}")
    private long execTimeoutMs;

    public ServerMetricsDto getMetrics(ServerProfile server, Long userId) {
        String password = null;
        String privateKey = null;
        String passphrase = null;

        if (server.getCredentialId() != null) {
            Credential credential = credentialRepository.findByIdAndUserId(server.getCredentialId(), userId).orElse(null);
            if (credential != null) {
                String decrypted = encryptionService.decrypt(credential.getEncryptedData());
                if ("KEY".equalsIgnoreCase(credential.getType())) {
                    privateKey = decrypted;
                } else {
                    password = decrypted;
                }
            }
        }

        try (ClientSession session = sshClientService.createSession(server, password, privateKey, passphrase)) {
            ServiceManagerService.RemoteOsType osType = detectOs(session);
            
            if (osType == ServiceManagerService.RemoteOsType.WINDOWS) {
                String cmd = "powershell -NoProfile -NonInteractive -Command \"" +
                    "$cpu = Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average | Select-Object -ExpandProperty Average; " +
                    "Write-Output \\\"$cpu%\\\"; Write-Output '==='; " +
                    "$mem = Get-CimInstance Win32_OperatingSystem; " +
                    "Write-Output \\\"$($mem.TotalVisibleMemorySize);;$($mem.FreePhysicalMemory)\\\"; Write-Output '==='; " +
                    "$disk = Get-CimInstance Win32_LogicalDisk -Filter \\\"DeviceID='C:'\\\"; " +
                    "Write-Output \\\"$($disk.Size);;$($disk.FreeSpace)\\\"; Write-Output '==='; " +
                    "$os = Get-CimInstance Win32_OperatingSystem; " +
                    "$uptime = (Get-Date) - $os.LastBootUpTime; " +
                    "Write-Output \\\"$($uptime.Days)d $($uptime.Hours)h $($uptime.Minutes)m\\\"; Write-Output '==='; " +
                    "Write-Output $os.Caption\"";
                String output = executeCommand(session, cmd);
                return parseWindowsMetrics(output);
            } else {
                String command = "cat /proc/loadavg; echo '==='; " +
                        "head -n 4 /proc/meminfo; echo '==='; " +
                        "df -h / | tail -n 1; echo '==='; " +
                        "uptime; echo '==='; " +
                        "uname -srm";
                String output = executeCommand(session, command);
                return parseMetrics(output);
            }
        } catch (Exception e) {
            log.warn("Failed to retrieve metrics for server {}: {}", server.getHostname(), e.getMessage());
            return ServerMetricsDto.builder()
                    .cpuUsage("N/A")
                    .memoryUsage("N/A")
                    .memoryDetails("Unable to connect")
                    .diskUsage("N/A")
                    .diskDetails("Unable to query")
                    .loadAverage("N/A")
                    .uptime("N/A")
                    .osName("Offline / Error")
                    .build();
        }
    }

    private String executeCommand(ClientSession session, String command) throws Exception {
        try (ChannelExec channel = session.createExecChannel(command)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            channel.setOut(out);
            channel.setErr(new ByteArrayOutputStream());
            channel.open().verify(channelOpenTimeoutMs, TimeUnit.MILLISECONDS);
            channel.waitFor(java.util.EnumSet.of(org.apache.sshd.client.channel.ClientChannelEvent.CLOSED), execTimeoutMs);
            return out.toString(StandardCharsets.UTF_8);
        }
    }

    private ServiceManagerService.RemoteOsType detectOs(ClientSession session) {
        String serverVersion = session.getServerVersion();
        if (serverVersion != null && serverVersion.toLowerCase().contains("windows")) {
            return ServiceManagerService.RemoteOsType.WINDOWS;
        }
        try {
            String uname = executeCommand(session, "uname -s 2>/dev/null || echo %OS%").toLowerCase();
            if (uname.contains("darwin")) return ServiceManagerService.RemoteOsType.MACOS;
            if (uname.contains("windows") || uname.contains("mingw") || uname.contains("msys") || uname.contains("cygwin")) {
                return ServiceManagerService.RemoteOsType.WINDOWS;
            }
        } catch (Exception ignored) {}
        return ServiceManagerService.RemoteOsType.LINUX;
    }

    private ServerMetricsDto parseWindowsMetrics(String output) {
        String[] parts = output.split("===");
        
        String cpu = parts.length > 0 && !parts[0].isBlank() ? parts[0].trim() : "0%";
        
        String memUsage = "N/A";
        String memDetails = "N/A";
        if (parts.length > 1 && !parts[1].isBlank() && parts[1].contains(";;")) {
            String[] memParts = parts[1].trim().split(";;");
            try {
                long totalKb = Long.parseLong(memParts[0]);
                long freeKb = Long.parseLong(memParts[1]);
                long usedKb = totalKb - freeKb;
                int pct = (int) Math.round((double) usedKb / totalKb * 100);
                memUsage = pct + "%";
                memDetails = String.format("%.1f GB / %.1f GB", usedKb / 1024.0 / 1024.0, totalKb / 1024.0 / 1024.0);
            } catch (Exception ignored) {}
        }
        
        String diskUsage = "N/A";
        String diskDetails = "N/A";
        if (parts.length > 2 && !parts[2].isBlank() && parts[2].contains(";;")) {
            String[] diskParts = parts[2].trim().split(";;");
            try {
                long totalB = Long.parseLong(diskParts[0]);
                long freeB = Long.parseLong(diskParts[1]);
                long usedB = totalB - freeB;
                int pct = (int) Math.round((double) usedB / totalB * 100);
                diskUsage = pct + "%";
                diskDetails = String.format("%.1f GB / %.1f GB", usedB / 1073741824.0, totalB / 1073741824.0);
            } catch (Exception ignored) {}
        }
        
        String uptime = parts.length > 3 && !parts[3].isBlank() ? parts[3].trim() : "N/A";
        String osName = parts.length > 4 && !parts[4].isBlank() ? parts[4].trim() : "Windows";

        return ServerMetricsDto.builder()
                .cpuUsage(cpu)
                .memoryUsage(memUsage)
                .memoryDetails(memDetails)
                .diskUsage(diskUsage)
                .diskDetails(diskDetails)
                .loadAverage("N/A")
                .uptime(uptime)
                .osName(osName)
                .build();
    }

    private ServerMetricsDto parseMetrics(String output) {
        String[] parts = output.split("===");

        String loadAvg = "0.00";
        if (parts.length > 0 && !parts[0].isBlank()) {
            String[] loadParts = parts[0].trim().split("\\s+");
            if (loadParts.length >= 3) {
                loadAvg = loadParts[0] + ", " + loadParts[1] + ", " + loadParts[2];
            }
        }

        String memUsage = "N/A";
        String memDetails = "N/A";
        if (parts.length > 1 && !parts[1].isBlank()) {
            long memTotalKb = extractKb(parts[1], "MemTotal:");
            long memAvailKb = extractKb(parts[1], "MemAvailable:");
            if (memTotalKb > 0) {
                long usedKb = Math.max(0, memTotalKb - memAvailKb);
                int pct = (int) Math.round((double) usedKb / memTotalKb * 100);
                memUsage = pct + "%";
                memDetails = String.format("%.1f GB / %.1f GB", usedKb / 1024.0 / 1024.0, memTotalKb / 1024.0 / 1024.0);
            }
        }

        String diskUsage = "N/A";
        String diskDetails = "N/A";
        if (parts.length > 2 && !parts[2].isBlank()) {
            String[] diskParts = parts[2].trim().split("\\s+");
            if (diskParts.length >= 5) {
                diskDetails = diskParts[2] + " / " + diskParts[1];
                diskUsage = diskParts[4]; // e.g. "45%"
            }
        }

        String uptime = "N/A";
        if (parts.length > 3 && !parts[3].isBlank()) {
            uptime = parts[3].trim();
        }

        String osName = "Linux";
        if (parts.length > 4 && !parts[4].isBlank()) {
            osName = parts[4].trim();
        }

        return ServerMetricsDto.builder()
                .cpuUsage(loadAvg.split(",")[0].trim() + " (Load)")
                .memoryUsage(memUsage)
                .memoryDetails(memDetails)
                .diskUsage(diskUsage)
                .diskDetails(diskDetails)
                .loadAverage(loadAvg)
                .uptime(uptime)
                .osName(osName)
                .build();
    }

    private long extractKb(String content, String prefix) {
        Pattern pattern = Pattern.compile(Pattern.quote(prefix) + "\\s+(\\d+)\\s+kB");
        Matcher matcher = pattern.matcher(content);
        if (matcher.find()) {
            try {
                return Long.parseLong(matcher.group(1));
            } catch (NumberFormatException ignored) {}
        }
        return 0;
    }
}
