package com.sshworkspace;

import com.sshworkspace.dto.ServiceDtos.DiscoveredServiceDto;
import com.sshworkspace.service.ServiceManagerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ServiceManagerCrossPlatformTest {

    private ServiceManagerService serviceManagerService;

    @BeforeEach
    void setUp() {
        serviceManagerService = new ServiceManagerService(null, null, null, null);
    }

    @Test
    void testCommandBuilders() {
        String linuxCmd = serviceManagerService.buildLinuxProbeCommand();
        assertNotNull(linuxCmd);
        assertTrue(linuxCmd.contains("___NETSTAT_SECTION___"));
        assertTrue(linuxCmd.contains("___SYSTEMD_SECTION___"));

        String macCmd = serviceManagerService.buildMacProbeCommand();
        assertNotNull(macCmd);
        assertTrue(macCmd.contains("___MAC_LSOF_SECTION___"));
        assertTrue(macCmd.contains("brew services list"));
        assertTrue(macCmd.contains("launchctl list"));

        String winCmd = serviceManagerService.buildWindowsProbeCommand();
        assertNotNull(winCmd);
        assertTrue(winCmd.contains("___WIN_NETSTAT_SECTION___"));
        assertTrue(winCmd.contains("Win32_Service"));
        assertTrue(winCmd.contains("netstat -ano"));
    }

    @Test
    void testParseMacProbeOutput() {
        String mockMacOutput =
                "___MAC_LSOF_SECTION___\n" +
                "COMMAND     PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME\n" +
                "mysqld     1234 sabu   24u  IPv4 0x76543210      0t0  TCP 127.0.0.1:3306 (LISTEN)\n" +
                "redis-se   5678 sabu    6u  IPv4 0x76543211      0t0  TCP *:6379 (LISTEN)\n" +
                "node       9012 sabu   19u  IPv4 0x76543212      0t0  TCP *:3000 (LISTEN)\n" +
                "___MAC_BREW_SECTION___\n" +
                "Name       Status     User File\n" +
                "redis      started    sabu ~/Library/LaunchAgents/homebrew.mxcl.redis.plist\n" +
                "postgresql started    sabu ~/Library/LaunchAgents/homebrew.mxcl.postgresql.plist\n" +
                "nginx      stopped    sabu\n" +
                "___MAC_LAUNCHCTL_SECTION___\n" +
                "PID\tStatus\tLabel\n" +
                "5678\t0\thomebrew.mxcl.redis\n" +
                "1234\t0\thomebrew.mxcl.mysql\n" +
                "-\t0\tcom.apple.SafariHistoryService\n" +
                "___MAC_DOCKER_SECTION___\n" +
                "d1a2b3c4;;dev-db;;postgres:15;;Up 3 hours;;0.0.0.0:5432->5432/tcp\n" +
                "___MAC_PROCESS_SECTION___\n" +
                "PID COMMAND %CPU %MEM ETIME\n" +
                "1234 mysqld 2.5 12.0 01:23:45\n" +
                "5678 redis-server 0.5 2.1 02:34:56\n" +
                "9012 node 1.2 5.4 00:45:10\n";

        List<DiscoveredServiceDto> services = serviceManagerService.parseMacProbeOutput(mockMacOutput);
        assertNotNull(services);
        assertFalse(services.isEmpty());

        // Verify Redis is detected and attributed to Homebrew
        DiscoveredServiceDto redisSvc = services.stream()
                .filter(s -> s.getName().toLowerCase().contains("redis"))
                .findFirst()
                .orElse(null);
        assertNotNull(redisSvc, "Redis service should be discovered");
        assertEquals("BREW", redisSvc.getSource(), "Redis should have BREW source");
        assertEquals("RUNNING", redisSvc.getStatus());
        assertTrue(redisSvc.getPorts().contains(6379));
        assertTrue(redisSvc.isCanManage());

        // Verify MySQL
        DiscoveredServiceDto mysqlSvc = services.stream()
                .filter(s -> s.getName().toLowerCase().contains("mysql"))
                .findFirst()
                .orElse(null);
        assertNotNull(mysqlSvc, "MySQL service should be discovered");
        assertEquals("DATABASE", mysqlSvc.getCategory());
        assertTrue(mysqlSvc.getPorts().contains(3306));
        assertEquals(1234, mysqlSvc.getPid());

        // Verify Docker container
        DiscoveredServiceDto dockerSvc = services.stream()
                .filter(s -> "DOCKER".equals(s.getSource()))
                .findFirst()
                .orElse(null);
        assertNotNull(dockerSvc, "Docker container should be discovered on macOS");
        assertEquals("dev-db", dockerSvc.getName());
        assertTrue(dockerSvc.getPorts().contains(5432));
    }

    @Test
    void testParseWindowsProbeOutput() {
        String mockWinOutput =
                "___WIN_NETSTAT_SECTION___\n" +
                "  TCP    0.0.0.0:3306           0.0.0.0:0              LISTENING       2460\n" +
                "  TCP    0.0.0.0:6379           0.0.0.0:0              LISTENING       3120\n" +
                "  TCP    [::]:1433              [::]:0                 LISTENING       4420\n" +
                "  TCP    0.0.0.0:80             0.0.0.0:0              LISTENING       2100\n" +
                "___WIN_SERVICES_SECTION___\n" +
                "mysql;;MySQL Server 8.0;;Running;;2460;;Auto\n" +
                "Redis;;Redis Background Service;;Running;;3120;;Auto\n" +
                "MSSQLSERVER;;SQL Server (MSSQLSERVER);;Running;;4420;;Auto\n" +
                "w3svc;;World Wide Web Publishing Service;;Running;;2100;;Auto\n" +
                "wuauserv;;Windows Update;;Stopped;;0;;Manual\n" +
                "___WIN_DOCKER_SECTION___\n" +
                "c9d8e7;;win-mongo;;mongo:latest;;Up 5 hours;;0.0.0.0:27017->27017/tcp\n" +
                "___WIN_PROCESS_SECTION___\n" +
                "2460;;mysqld;;4.2;;128.5MB\n" +
                "3120;;redis-server;;0.8;;42.1MB\n" +
                "4420;;sqlservr;;5.1;;256.0MB\n" +
                "2100;;w3wp;;1.0;;64.2MB\n";

        List<DiscoveredServiceDto> services = serviceManagerService.parseWindowsProbeOutput(mockWinOutput);
        assertNotNull(services);
        assertFalse(services.isEmpty());

        // Verify MySQL Windows Service
        DiscoveredServiceDto mysql = services.stream()
                .filter(s -> s.getName().equalsIgnoreCase("mysql"))
                .findFirst()
                .orElse(null);
        assertNotNull(mysql, "MySQL Windows Service must be discovered");
        assertEquals("WINDOWS_SERVICE", mysql.getSource());
        assertEquals("MySQL Server 8.0", mysql.getDisplayName());
        assertEquals("RUNNING", mysql.getStatus());
        assertEquals(2460, mysql.getPid());
        assertTrue(mysql.getPorts().contains(3306));
        assertTrue(mysql.isCanManage());

        // Verify Redis Windows Service
        DiscoveredServiceDto redis = services.stream()
                .filter(s -> s.getName().equalsIgnoreCase("Redis"))
                .findFirst()
                .orElse(null);
        assertNotNull(redis, "Redis Windows Service must be discovered");
        assertEquals("WINDOWS_SERVICE", redis.getSource());
        assertEquals(3120, redis.getPid());
        assertTrue(redis.getPorts().contains(6379));

        // Verify MS SQL Server
        DiscoveredServiceDto mssql = services.stream()
                .filter(s -> s.getName().equalsIgnoreCase("MSSQLSERVER"))
                .findFirst()
                .orElse(null);
        assertNotNull(mssql, "MSSQL Windows Service must be discovered");
        assertEquals("WINDOWS_SERVICE", mssql.getSource());
        assertEquals("DATABASE", mssql.getCategory());
        assertTrue(mssql.getPorts().contains(1433));

        // Verify IIS Web Service
        DiscoveredServiceDto iis = services.stream()
                .filter(s -> s.getName().equalsIgnoreCase("w3svc"))
                .findFirst()
                .orElse(null);
        assertNotNull(iis, "IIS Web Service must be discovered");
        assertEquals("WEB", iis.getCategory());
        assertTrue(iis.getPorts().contains(80));

        // Verify Docker container on Windows
        DiscoveredServiceDto docker = services.stream()
                .filter(s -> "DOCKER".equals(s.getSource()))
                .findFirst()
                .orElse(null);
        assertNotNull(docker, "Windows Docker container must be discovered");
        assertEquals("win-mongo", docker.getName());
        assertTrue(docker.getPorts().contains(27017));

        // Verify stopped OS-internal service (wuauserv) is filtered out
        boolean hasWindowsUpdate = services.stream().anyMatch(s -> s.getName().equalsIgnoreCase("wuauserv"));
        assertFalse(hasWindowsUpdate, "Non-developer stopped OS service should be filtered");
    }

    @Test
    void testParseLinuxProbeOutputPreservesExistingBehavior() {
        String mockLinuxOutput =
                "___NETSTAT_SECTION___\n" +
                "tcp LISTEN 0 128 0.0.0.0:22 0.0.0.0:* users:((\"sshd\",pid=762,fd=3))\n" +
                "tcp LISTEN 0 511 127.0.0.1:6379 0.0.0.0:* users:((\"redis-server\",pid=890,fd=6))\n" +
                "___SYSTEMD_SECTION___\n" +
                "sshd.service loaded active running OpenBSD Secure Shell server\n" +
                "redis-server.service loaded active running Advanced key-value store\n" +
                "___OPENRC_SECTION___\n" +
                "___DOCKER_SECTION___\n" +
                "a1b2c3d4;;api-gateway;;nginx:alpine;;Up 10 hours;;0.0.0.0:80->80/tcp\n" +
                "___PROCESS_SECTION___\n" +
                "762 sshd 0.0 0.2 12:30:00\n" +
                "890 redis-server 0.3 1.1 14:20:10\n";

        List<DiscoveredServiceDto> services = serviceManagerService.parseProbeOutput(mockLinuxOutput);
        assertNotNull(services);
        assertEquals(3, services.size());

        DiscoveredServiceDto redis = services.stream()
                .filter(s -> s.getName().contains("redis"))
                .findFirst()
                .orElse(null);
        assertNotNull(redis);
        assertEquals("SYSTEMD", redis.getSource());
        assertTrue(redis.getPorts().contains(6379));

        DiscoveredServiceDto docker = services.stream()
                .filter(s -> "DOCKER".equals(s.getSource()))
                .findFirst()
                .orElse(null);
        assertNotNull(docker);
        assertEquals("api-gateway", docker.getName());
        assertTrue(docker.getPorts().contains(80));
    }
}
