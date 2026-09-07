package com.sshworkspace.service;

import com.sshworkspace.dto.ServiceDtos.DiscoveredServiceDto;
import com.sshworkspace.dto.ServiceDtos.ServiceActionRequestDto;
import com.sshworkspace.dto.ServiceDtos.ServiceActionResponseDto;
import com.sshworkspace.dto.ServiceDtos.ServiceLogsResponseDto;
import com.sshworkspace.model.Credential;
import com.sshworkspace.model.ServerProfile;
import com.sshworkspace.repository.CredentialRepository;
import com.sshworkspace.repository.ServerProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.sshd.client.channel.ChannelExec;
import org.apache.sshd.client.session.ClientSession;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class ServiceManagerService {

    private final SshClientService sshClientService;
    private final ServerProfileRepository serverRepository;
    private final CredentialRepository credentialRepository;
    private final EncryptionService encryptionService;

    private static final String NETSTAT_SECTION = "___NETSTAT_SECTION___";
    private static final String SYSTEMD_SECTION = "___SYSTEMD_SECTION___";
    private static final String OPENRC_SECTION = "___OPENRC_SECTION___";
    private static final String DOCKER_SECTION = "___DOCKER_SECTION___";
    private static final String PROCESS_SECTION = "___PROCESS_SECTION___";

    public List<DiscoveredServiceDto> discoverServices(Long serverId, Long userId) {
        ServerProfile server = serverRepository.findByIdAndUserId(serverId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Server not found"));

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
            // Composite non-destructive probe command
            String probeCmd = String.format(
                    "echo '%s'; " +
                    "(ss -tulpn 2>/dev/null || netstat -tulpn 2>/dev/null); " +
                    "echo '%s'; " +
                    "(command -v systemctl >/dev/null 2>&1 && systemctl list-units --type=service --state=running,failed,inactive --all --no-pager --no-legend 2>/dev/null); " +
                    "echo '%s'; " +
                    "(command -v rc-status >/dev/null 2>&1 && rc-status -a 2>/dev/null); " +
                    "echo '%s'; " +
                    "(command -v docker >/dev/null 2>&1 && docker ps -a --format '{{.ID}};;{{.Names}};;{{.Image}};;{{.Status}};;{{.Ports}}' 2>/dev/null); " +
                    "echo '%s'; " +
                    "(ps -eo pid,comm,%%cpu,%%mem,etime 2>/dev/null || ps -o pid,comm 2>/dev/null);",
                    NETSTAT_SECTION, SYSTEMD_SECTION, OPENRC_SECTION, DOCKER_SECTION, PROCESS_SECTION
            );

            String output = executeRemoteCommand(session, probeCmd, 12);
            return parseProbeOutput(output);
        } catch (Exception e) {
            log.error("Failed to discover services on server {}: {}", server.getName(), e.getMessage());
            throw new RuntimeException("Service discovery failed: " + e.getMessage(), e);
        }
    }

    public ServiceActionResponseDto executeAction(Long serverId, Long userId, ServiceActionRequestDto request) {
        ServerProfile server = serverRepository.findByIdAndUserId(serverId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Server not found"));

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

        String actionLower = request.getAction().toLowerCase().trim();
        if (!Set.of("start", "stop", "restart", "reload").contains(actionLower)) {
            throw new IllegalArgumentException("Invalid action: " + request.getAction());
        }

        // Sanitize service name against shell injection
        String safeServiceName = request.getServiceName().replaceAll("[^a-zA-Z0-9_.-]", "");
        if (safeServiceName.isBlank()) {
            throw new IllegalArgumentException("Invalid service name");
        }

        String remoteCmd;
        String source = request.getSource() != null ? request.getSource().toUpperCase() : "SYSTEMD";

        if ("DOCKER".equals(source)) {
            remoteCmd = String.format("docker %s %s 2>&1", actionLower, safeServiceName);
        } else if ("OPENRC".equals(source)) {
            remoteCmd = String.format("(sudo rc-service %s %s || rc-service %s %s) 2>&1",
                    safeServiceName, actionLower, safeServiceName, actionLower);
        } else {
            // Default to systemctl with service fallback
            remoteCmd = String.format("(sudo systemctl %s %s || systemctl %s %s || sudo service %s %s) 2>&1",
                    actionLower, safeServiceName, actionLower, safeServiceName, safeServiceName, actionLower);
        }

        try (ClientSession session = sshClientService.createSession(server, password, privateKey, passphrase)) {
            String output = executeRemoteCommand(session, remoteCmd, 15);
            return ServiceActionResponseDto.builder()
                    .success(true)
                    .message(String.format("Action '%s' executed on %s", request.getAction(), safeServiceName))
                    .output(output)
                    .build();
        } catch (Exception e) {
            log.error("Failed to execute action {} on service {} for server {}: {}",
                    request.getAction(), safeServiceName, server.getName(), e.getMessage());
            return ServiceActionResponseDto.builder()
                    .success(false)
                    .message("Failed to execute action: " + e.getMessage())
                    .output("")
                    .build();
        }
    }

    public ServiceLogsResponseDto getServiceLogs(Long serverId, Long userId, String serviceName, String source) {
        ServerProfile server = serverRepository.findByIdAndUserId(serverId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Server not found"));

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

        String safeServiceName = serviceName.replaceAll("[^a-zA-Z0-9_.-]", "");
        String safeSource = source != null ? source.toUpperCase() : "SYSTEMD";

        String logCmd;
        if ("DOCKER".equals(safeSource)) {
            logCmd = String.format("docker logs --tail 100 %s 2>&1", safeServiceName);
        } else if ("SYSTEMD".equals(safeSource)) {
            logCmd = String.format("journalctl -u %s -n 100 --no-pager 2>&1 || journalctl -u %s.service -n 100 --no-pager 2>&1",
                    safeServiceName, safeServiceName);
        } else {
            // OpenRC / generic file log or syslog
            logCmd = String.format("(cat /var/log/%s.log 2>/dev/null || cat /var/log/%s/current 2>/dev/null || grep -i '%s' /var/log/messages 2>/dev/null || dmesg 2>/dev/null) | tail -n 100",
                    safeServiceName, safeServiceName, safeServiceName);
        }

        try (ClientSession session = sshClientService.createSession(server, password, privateKey, passphrase)) {
            String output = executeRemoteCommand(session, logCmd, 10);
            List<String> lines = output.isBlank() ? List.of("No log output found.") : Arrays.asList(output.split("\\r?\\n"));
            return ServiceLogsResponseDto.builder()
                    .serviceName(safeServiceName)
                    .source(safeSource)
                    .lines(lines)
                    .build();
        } catch (Exception e) {
            log.error("Failed to fetch logs for service {} on server {}: {}", safeServiceName, server.getName(), e.getMessage());
            return ServiceLogsResponseDto.builder()
                    .serviceName(safeServiceName)
                    .source(safeSource)
                    .lines(List.of())
                    .error("Error retrieving logs: " + e.getMessage())
                    .build();
        }
    }

    private String executeRemoteCommand(ClientSession session, String command, int timeoutSeconds) throws Exception {
        try (ChannelExec channel = session.createExecChannel(command)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ByteArrayOutputStream err = new ByteArrayOutputStream();
            channel.setOut(out);
            channel.setErr(err);

            channel.open().verify(5, TimeUnit.SECONDS);
            channel.waitFor(EnumSet.of(org.apache.sshd.client.channel.ClientChannelEvent.CLOSED), timeoutSeconds * 1000L);

            String stdout = out.toString(StandardCharsets.UTF_8).trim();
            String stderr = err.toString(StandardCharsets.UTF_8).trim();
            if (stdout.isEmpty() && !stderr.isEmpty()) {
                return stderr;
            }
            return stdout;
        }
    }

    private List<DiscoveredServiceDto> parseProbeOutput(String probeOutput) {
        Map<String, DiscoveredServiceDto> serviceMap = new LinkedHashMap<>();

        String netstatOutput = extractSection(probeOutput, NETSTAT_SECTION, SYSTEMD_SECTION);
        String systemdOutput = extractSection(probeOutput, SYSTEMD_SECTION, OPENRC_SECTION);
        String openrcOutput = extractSection(probeOutput, OPENRC_SECTION, DOCKER_SECTION);
        String dockerOutput = extractSection(probeOutput, DOCKER_SECTION, PROCESS_SECTION);
        String processOutput = extractSection(probeOutput, PROCESS_SECTION, null);

        // 1. Parse process table to get memory/cpu and PIDs
        Map<Integer, ProcessInfo> processMap = parseProcesses(processOutput);

        // 2. Parse Docker containers
        parseDocker(dockerOutput, serviceMap);

        // 3. Parse Listening Ports (ss / netstat)
        parseListeningPorts(netstatOutput, serviceMap, processMap);

        // 4. Parse systemd services
        parseSystemd(systemdOutput, serviceMap);

        // 5. Parse OpenRC services (for Alpine)
        parseOpenRc(openrcOutput, serviceMap);

        return new ArrayList<>(serviceMap.values());
    }

    private String extractSection(String content, String startMarker, String endMarker) {
        int startIndex = content.indexOf(startMarker);
        if (startIndex == -1) return "";
        startIndex += startMarker.length();

        int endIndex = endMarker != null ? content.indexOf(endMarker, startIndex) : content.length();
        if (endIndex == -1) endIndex = content.length();

        return content.substring(startIndex, endIndex).trim();
    }

    private void parseDocker(String dockerOutput, Map<String, DiscoveredServiceDto> serviceMap) {
        if (dockerOutput.isBlank()) return;

        for (String line : dockerOutput.split("\\r?\\n")) {
            if (line.isBlank() || !line.contains(";;")) continue;
            String[] parts = line.split(";;");
            if (parts.length < 4) continue;

            String containerId = parts[0].trim();
            String name = parts[1].trim();
            String image = parts[2].trim();
            String statusStr = parts[3].trim();
            String portsStr = parts.length > 4 ? parts[4].trim() : "";

            String status = statusStr.toLowerCase().startsWith("up") ? "RUNNING" : "STOPPED";

            List<Integer> ports = extractPortsFromDocker(portsStr);
            String serviceType = detectServiceCategory(name + " " + image);

            String serviceId = "docker-" + (name.isBlank() ? containerId : name);
            DiscoveredServiceDto dto = DiscoveredServiceDto.builder()
                    .id(serviceId)
                    .name(name.isBlank() ? containerId : name)
                    .displayName(name + " (" + image + ")")
                    .category(serviceType.equals("CUSTOM") ? "CONTAINER" : serviceType)
                    .status(status)
                    .source("DOCKER")
                    .ports(ports)
                    .bindAddresses(ports.isEmpty() ? List.of() : List.of("0.0.0.0"))
                    .uptime(statusStr)
                    .cliCommand("docker exec -it " + name + " sh")
                    .defaultTunnelPort(ports.isEmpty() ? null : ports.get(0))
                    .canManage(true)
                    .build();

            enrichServiceMetadata(dto);
            serviceMap.put(serviceId, dto);
        }
    }

    private void parseListeningPorts(String netstatOutput, Map<String, DiscoveredServiceDto> serviceMap, Map<Integer, ProcessInfo> processMap) {
        if (netstatOutput.isBlank()) return;

        // Matches both:
        // ss: tcp LISTEN 0 128 0.0.0.0:22 0.0.0.0:* users:(("sshd",pid=762,fd=3))
        // netstat: tcp 0 0 0.0.0.0:22 0.0.0.0:* LISTEN 1/sshd
        // netstat: tcp 0 0 :::22 :::* LISTEN 1/sshd
        Pattern ssPattern = Pattern.compile("(?i)(tcp|udp)\\s+\\S+\\s+\\S+\\s+\\S+\\s+(\\S+):(\\d+)\\s+\\S+\\s+users:\\(\\(\"([^\"]+)\",pid=(\\d+)");
        Pattern netstatPattern = Pattern.compile("(?i)(tcp|udp)\\d*\\s+\\S+\\s+\\S+\\s+(\\S+):(\\d+)\\s+\\S+\\s+(?:LISTEN)?\\s+(\\d+)/(\\S+)");

        for (String line : netstatOutput.split("\\r?\\n")) {
            line = line.trim();
            if (line.isBlank() || line.startsWith("Proto") || line.startsWith("Netid") || line.startsWith("Active")) {
                continue;
            }

            String bindAddr = "";
            int port = 0;
            String procName = "";
            Integer pid = null;

            Matcher m1 = ssPattern.matcher(line);
            if (m1.find()) {
                bindAddr = m1.group(2);
                port = Integer.parseInt(m1.group(3));
                procName = m1.group(4);
                pid = Integer.parseInt(m1.group(5));
            } else {
                Matcher m2 = netstatPattern.matcher(line);
                if (m2.find()) {
                    bindAddr = m2.group(2);
                    port = Integer.parseInt(m2.group(3));
                    pid = Integer.parseInt(m2.group(4));
                    procName = m2.group(5);
                } else {
                    // Simpler netstat line without pid
                    Pattern simpleNetstat = Pattern.compile("(?i)(tcp|udp)\\d*\\s+\\S+\\s+\\S+\\s+(\\S+):(\\d+)\\s+\\S+");
                    Matcher m3 = simpleNetstat.matcher(line);
                    if (m3.find()) {
                        bindAddr = m3.group(2);
                        try {
                            port = Integer.parseInt(m3.group(3));
                        } catch (NumberFormatException ignored) {}
                        procName = guessNameByPort(port);
                    }
                }
            }

            if (port <= 0) continue;

            String serviceKey = "port-" + port;
            if (!procName.isBlank()) {
                serviceKey = "svc-" + procName.toLowerCase();
            }

            DiscoveredServiceDto existing = serviceMap.get(serviceKey);
            if (existing != null) {
                if (!existing.getPorts().contains(port)) {
                    existing.getPorts().add(port);
                }
                if (!existing.getBindAddresses().contains(bindAddr)) {
                    existing.getBindAddresses().add(bindAddr);
                }
                if (existing.getPid() == null && pid != null) {
                    existing.setPid(pid);
                }
                continue;
            }

            String category = detectServiceCategory(procName + " " + port);
            String displayName = formatDisplayName(procName, port);

            ProcessInfo procInfo = pid != null ? processMap.get(pid) : null;

            DiscoveredServiceDto dto = DiscoveredServiceDto.builder()
                    .id(serviceKey)
                    .name(procName.isBlank() ? "port-" + port : procName)
                    .displayName(displayName)
                    .category(category)
                    .status("RUNNING")
                    .source(pid != null ? "PROCESS" : "SOCKET")
                    .pid(pid)
                    .ports(new ArrayList<>(List.of(port)))
                    .bindAddresses(new ArrayList<>(List.of(bindAddr.isBlank() ? "0.0.0.0" : bindAddr)))
                    .cpuPercent(procInfo != null ? procInfo.cpu : null)
                    .memoryUsage(procInfo != null ? procInfo.mem : null)
                    .uptime(procInfo != null ? procInfo.uptime : null)
                    .defaultTunnelPort(port)
                    .canManage(pid != null)
                    .build();

            enrichServiceMetadata(dto);
            serviceMap.put(serviceKey, dto);
        }
    }

    private void parseSystemd(String systemdOutput, Map<String, DiscoveredServiceDto> serviceMap) {
        if (systemdOutput.isBlank()) return;

        // Format: mariadb.service loaded active running MariaDB 10.11 database server
        Pattern p = Pattern.compile("^(\\S+\\.service)\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+(.*)$");

        for (String line : systemdOutput.split("\\r?\\n")) {
            line = line.trim();
            Matcher m = p.matcher(line);
            if (!m.matches()) continue;

            String unit = m.group(1);
            String activeState = m.group(3);
            String subState = m.group(4);
            String description = m.group(5);

            String serviceName = unit.replace(".service", "");
            String status = "running".equalsIgnoreCase(subState) ? "RUNNING"
                    : "failed".equalsIgnoreCase(activeState) ? "FAILED" : "STOPPED";

            String key = "svc-" + serviceName.toLowerCase();
            DiscoveredServiceDto existing = serviceMap.get(key);

            if (existing != null) {
                existing.setSource("SYSTEMD");
                existing.setCanManage(true);
                if (description != null && !description.isBlank() && existing.getDisplayName().equals(existing.getName())) {
                    existing.setDisplayName(description);
                }
            } else if ("RUNNING".equals(status) || "FAILED".equals(status)) {
                String category = detectServiceCategory(serviceName + " " + description);
                DiscoveredServiceDto dto = DiscoveredServiceDto.builder()
                        .id(key)
                        .name(serviceName)
                        .displayName(description.isBlank() ? formatDisplayName(serviceName, 0) : description)
                        .category(category)
                        .status(status)
                        .source("SYSTEMD")
                        .ports(new ArrayList<>())
                        .bindAddresses(new ArrayList<>())
                        .canManage(true)
                        .build();

                enrichServiceMetadata(dto);
                serviceMap.put(key, dto);
            }
        }
    }

    private void parseOpenRc(String openrcOutput, Map<String, DiscoveredServiceDto> serviceMap) {
        if (openrcOutput.isBlank()) return;

        // Format: sshd [  started  ]
        Pattern p = Pattern.compile("^\\s*([a-zA-Z0-9_.-]+)\\s*\\[\\s*(\\S+)\\s*\\]");

        for (String line : openrcOutput.split("\\r?\\n")) {
            line = line.trim();
            Matcher m = p.matcher(line);
            if (!m.matches()) continue;

            String serviceName = m.group(1);
            String state = m.group(2).toLowerCase();

            String status = state.contains("start") ? "RUNNING" : "STOPPED";
            String key = "svc-" + serviceName.toLowerCase();

            DiscoveredServiceDto existing = serviceMap.get(key);
            if (existing != null) {
                existing.setSource("OPENRC");
                existing.setCanManage(true);
            } else if ("RUNNING".equals(status)) {
                String category = detectServiceCategory(serviceName);
                DiscoveredServiceDto dto = DiscoveredServiceDto.builder()
                        .id(key)
                        .name(serviceName)
                        .displayName(formatDisplayName(serviceName, 0))
                        .category(category)
                        .status(status)
                        .source("OPENRC")
                        .ports(new ArrayList<>())
                        .bindAddresses(new ArrayList<>())
                        .canManage(true)
                        .build();

                enrichServiceMetadata(dto);
                serviceMap.put(key, dto);
            }
        }
    }

    private Map<Integer, ProcessInfo> parseProcesses(String processOutput) {
        Map<Integer, ProcessInfo> map = new HashMap<>();
        if (processOutput.isBlank()) return map;

        for (String line : processOutput.split("\\r?\\n")) {
            String trimmed = line.trim();
            if (trimmed.isBlank() || trimmed.startsWith("PID")) continue;

            String[] parts = trimmed.split("\\s+");
            if (parts.length >= 2) {
                try {
                    int pid = Integer.parseInt(parts[0]);
                    String comm = parts[1];
                    String cpu = parts.length > 2 ? parts[2] + "%" : null;
                    String mem = parts.length > 3 ? parts[3] + "%" : null;
                    String uptime = parts.length > 4 ? parts[4] : null;

                    map.put(pid, new ProcessInfo(pid, comm, cpu, mem, uptime));
                } catch (NumberFormatException ignored) {}
            }
        }
        return map;
    }

    private void enrichServiceMetadata(DiscoveredServiceDto dto) {
        String lower = (dto.getName() + " " + dto.getDisplayName()).toLowerCase();

        if (lower.contains("mysql") || lower.contains("mariadb")) {
            dto.setDisplayName("MySQL / MariaDB Server");
            dto.setCategory("DATABASE");
            dto.setCliCommand("mysql -u root -p");
            if (dto.getDefaultTunnelPort() == null) dto.setDefaultTunnelPort(3306);
        } else if (lower.contains("postgres")) {
            dto.setDisplayName("PostgreSQL Database Server");
            dto.setCategory("DATABASE");
            dto.setCliCommand("psql -U postgres");
            if (dto.getDefaultTunnelPort() == null) dto.setDefaultTunnelPort(5432);
        } else if (lower.contains("redis")) {
            dto.setDisplayName("Redis In-Memory Key-Value Store");
            dto.setCategory("DATABASE");
            dto.setCliCommand("redis-cli");
            if (dto.getDefaultTunnelPort() == null) dto.setDefaultTunnelPort(6379);
        } else if (lower.contains("mongo")) {
            dto.setDisplayName("MongoDB Document Database");
            dto.setCategory("DATABASE");
            dto.setCliCommand("mongosh");
            if (dto.getDefaultTunnelPort() == null) dto.setDefaultTunnelPort(27017);
        } else if (lower.contains("nginx")) {
            dto.setDisplayName("Nginx HTTP / Reverse Proxy Server");
            dto.setCategory("WEB");
            dto.setCliCommand("nginx -t");
            if (dto.getDefaultTunnelPort() == null) dto.setDefaultTunnelPort(80);
        } else if (lower.contains("apache") || lower.contains("httpd")) {
            dto.setDisplayName("Apache Web Server");
            dto.setCategory("WEB");
            dto.setCliCommand("apachectl status");
            if (dto.getDefaultTunnelPort() == null) dto.setDefaultTunnelPort(80);
        } else if (lower.contains("caddy")) {
            dto.setDisplayName("Caddy Web Server");
            dto.setCategory("WEB");
            dto.setCliCommand("caddy version");
            if (dto.getDefaultTunnelPort() == null) dto.setDefaultTunnelPort(80);
        } else if (lower.contains("sshd") || lower.contains("openssh")) {
            dto.setDisplayName("OpenSSH Remote Daemon");
            dto.setCategory("SYSTEM");
            dto.setCliCommand("ssh -V");
            if (dto.getDefaultTunnelPort() == null) dto.setDefaultTunnelPort(22);
        } else if (lower.contains("docker") || lower.contains("dockerd") || lower.contains("containerd")) {
            dto.setDisplayName("Docker Engine Daemon");
            dto.setCategory("CONTAINER");
            dto.setCliCommand("docker info");
            if (dto.getDefaultTunnelPort() == null) dto.setDefaultTunnelPort(2375);
        } else if (dto.getPorts() != null && !dto.getPorts().isEmpty()) {
            int firstPort = dto.getPorts().get(0);
            if (firstPort == 3306) {
                dto.setCategory("DATABASE");
                dto.setDisplayName("MySQL Service (Port 3306)");
                dto.setCliCommand("mysql -u root -p");
            } else if (firstPort == 5432) {
                dto.setCategory("DATABASE");
                dto.setDisplayName("PostgreSQL Service (Port 5432)");
                dto.setCliCommand("psql -U postgres");
            } else if (firstPort == 6379) {
                dto.setCategory("DATABASE");
                dto.setDisplayName("Redis Service (Port 6379)");
                dto.setCliCommand("redis-cli");
            } else if (firstPort == 27017) {
                dto.setCategory("DATABASE");
                dto.setDisplayName("MongoDB Service (Port 27017)");
                dto.setCliCommand("mongosh");
            } else if (firstPort == 80 || firstPort == 443 || firstPort == 8080 || firstPort == 3000 || firstPort == 5000) {
                dto.setCategory("WEB");
            }
        }
    }

    private String detectServiceCategory(String text) {
        String lower = text.toLowerCase();
        if (lower.contains("mysql") || lower.contains("mariadb") || lower.contains("postgres") ||
            lower.contains("redis") || lower.contains("mongo") || lower.contains("sqlite") ||
            lower.contains("3306") || lower.contains("5432") || lower.contains("6379") || lower.contains("27017")) {
            return "DATABASE";
        }
        if (lower.contains("nginx") || lower.contains("apache") || lower.contains("httpd") ||
            lower.contains("caddy") || lower.contains("express") || lower.contains("fastapi") ||
            lower.contains("80") || lower.contains("443") || lower.contains("8080") || lower.contains("3000") || lower.contains("5000")) {
            return "WEB";
        }
        if (lower.contains("node") || lower.contains("python") || lower.contains("java") ||
            lower.contains("ruby") || lower.contains("php") || lower.contains("golang")) {
            return "RUNTIME";
        }
        if (lower.contains("docker") || lower.contains("container") || lower.contains("podman") || lower.contains("k8s")) {
            return "CONTAINER";
        }
        if (lower.contains("ssh") || lower.contains("cron") || lower.contains("systemd") ||
            lower.contains("syslog") || lower.contains("network") || lower.contains("udev")) {
            return "SYSTEM";
        }
        return "CUSTOM";
    }

    private String formatDisplayName(String name, int port) {
        if (name == null || name.isBlank()) {
            return port > 0 ? "Port " + port + " Service" : "Unknown Service";
        }
        String formatted = name.substring(0, 1).toUpperCase() + name.substring(1);
        if (port > 0) {
            return formatted + " (:" + port + ")";
        }
        return formatted;
    }

    private String guessNameByPort(int port) {
        return switch (port) {
            case 22 -> "sshd";
            case 80 -> "http";
            case 443 -> "https";
            case 3306 -> "mysqld";
            case 5432 -> "postgres";
            case 6379 -> "redis-server";
            case 27017 -> "mongod";
            case 8080 -> "web-service";
            case 2375 -> "docker";
            default -> "service-" + port;
        };
    }

    private List<Integer> extractPortsFromDocker(String portsStr) {
        List<Integer> ports = new ArrayList<>();
        if (portsStr == null || portsStr.isBlank()) return ports;

        Pattern p = Pattern.compile("->(\\d+)/");
        Matcher m = p.matcher(portsStr);
        while (m.find()) {
            try {
                ports.add(Integer.parseInt(m.group(1)));
            } catch (NumberFormatException ignored) {}
        }
        return ports;
    }

    private static class ProcessInfo {
        int pid;
        String comm;
        String cpu;
        String mem;
        String uptime;

        public ProcessInfo(int pid, String comm, String cpu, String mem, String uptime) {
            this.pid = pid;
            this.comm = comm;
            this.cpu = cpu;
            this.mem = mem;
            this.uptime = uptime;
        }
    }
}
