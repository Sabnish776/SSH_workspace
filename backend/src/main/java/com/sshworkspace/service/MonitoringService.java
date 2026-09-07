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
            // Controlled read-only command script
            String command = "cat /proc/loadavg; echo '==='; " +
                    "head -n 4 /proc/meminfo; echo '==='; " +
                    "df -h / | tail -n 1; echo '==='; " +
                    "uptime; echo '==='; " +
                    "uname -srm";

            try (ChannelExec channel = session.createExecChannel(command)) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                ByteArrayOutputStream err = new ByteArrayOutputStream();
                channel.setOut(out);
                channel.setErr(err);

                channel.open().verify(channelOpenTimeoutMs, TimeUnit.MILLISECONDS);
                channel.waitFor(java.util.EnumSet.of(org.apache.sshd.client.channel.ClientChannelEvent.CLOSED), execTimeoutMs);

                String output = out.toString(StandardCharsets.UTF_8);
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
