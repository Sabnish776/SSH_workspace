package com.sshworkspace;

import com.sshworkspace.controller.BroadcastController;
import com.sshworkspace.dto.BroadcastDtos.BroadcastRequest;
import com.sshworkspace.dto.BroadcastDtos.BroadcastResponse;
import com.sshworkspace.dto.BroadcastDtos.ServerExecutionResult;
import com.sshworkspace.model.User;
import com.sshworkspace.repository.CredentialRepository;
import com.sshworkspace.repository.ServerProfileRepository;
import com.sshworkspace.repository.UserRepository;
import com.sshworkspace.security.UserPrincipal;
import com.sshworkspace.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.OffsetDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BroadcastControllerTest {

    @Mock
    private BroadcastService broadcastService;

    @Mock
    private ServerProfileRepository serverRepository;

    @Mock
    private CredentialRepository credentialRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private EncryptionService encryptionService;

    @Mock
    private SshClientService sshClientService;

    @Mock
    private AuditService auditService;

    private CommandSafetyService commandSafetyService;

    @InjectMocks
    private BroadcastController broadcastController;

    private UserPrincipal principal;

    @BeforeEach
    void setUp() {
        principal = new UserPrincipal(1L, "user@example.com", "User");
        commandSafetyService = new CommandSafetyService();
    }

    @Test
    void testBroadcastControllerSuccess() {
        BroadcastRequest req = BroadcastRequest.builder()
                .serverIds(List.of(10L, 20L))
                .command("uptime")
                .timeoutMs(5000L)
                .build();

        Map<Long, ServerExecutionResult> results = new HashMap<>();
        results.put(10L, ServerExecutionResult.builder()
                .serverId(10L)
                .serverName("Server 10")
                .hostname("host10")
                .port(22)
                .success(true)
                .exitCode(0)
                .output("up 2 days")
                .durationMs(45)
                .build());

        BroadcastResponse mockResponse = BroadcastResponse.builder()
                .command("uptime")
                .executedAt(OffsetDateTime.now())
                .totalTargets(1)
                .successCount(1)
                .failedCount(0)
                .results(results)
                .build();

        when(broadcastService.broadcastCommand(eq(req), eq(1L))).thenReturn(mockResponse);

        ResponseEntity<BroadcastResponse> response = broadcastController.broadcastCommand(principal, req);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertEquals("uptime", response.getBody().getCommand());
        assertEquals(1, response.getBody().getTotalTargets());
        assertTrue(response.getBody().getResults().containsKey(10L));
    }

    @Test
    void testBroadcastServiceBlocksDestructiveCommandWithoutPassword() {
        BroadcastService service = new BroadcastService(
                serverRepository,
                credentialRepository,
                userRepository,
                passwordEncoder,
                encryptionService,
                sshClientService,
                auditService,
                commandSafetyService
        );

        BroadcastRequest req = BroadcastRequest.builder()
                .serverIds(List.of(10L))
                .command("reboot")
                .confirmationPassword(null)
                .build();

        SecurityException ex = assertThrows(SecurityException.class, () -> service.broadcastCommand(req, 1L));
        assertTrue(ex.getMessage().contains("Account password confirmation is required"));
    }

    @Test
    void testBroadcastServiceRejectsDestructiveCommandWithWrongPassword() {
        BroadcastService service = new BroadcastService(
                serverRepository,
                credentialRepository,
                userRepository,
                passwordEncoder,
                encryptionService,
                sshClientService,
                auditService,
                commandSafetyService
        );

        User mockUser = User.builder()
                .id(1L)
                .email("user@example.com")
                .passwordHash("hashed-password")
                .build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(mockUser));
        when(passwordEncoder.matches("wrong-pass", "hashed-password")).thenReturn(false);

        BroadcastRequest req = BroadcastRequest.builder()
                .serverIds(List.of(10L))
                .command("systemctl stop nginx")
                .confirmationPassword("wrong-pass")
                .build();

        SecurityException ex = assertThrows(SecurityException.class, () -> service.broadcastCommand(req, 1L));
        assertTrue(ex.getMessage().contains("Invalid account password"));
    }

    @Test
    void testBroadcastServiceThrowsWhenNoMatchingServers() {
        BroadcastService service = new BroadcastService(
                serverRepository,
                credentialRepository,
                userRepository,
                passwordEncoder,
                encryptionService,
                sshClientService,
                auditService,
                commandSafetyService
        );

        when(serverRepository.findAllById(any())).thenReturn(Collections.emptyList());

        BroadcastRequest req = BroadcastRequest.builder()
                .serverIds(List.of(999L))
                .command("whoami")
                .build();

        assertThrows(IllegalArgumentException.class, () -> service.broadcastCommand(req, 1L));
    }
}
