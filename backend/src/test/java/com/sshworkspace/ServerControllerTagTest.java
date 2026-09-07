package com.sshworkspace;

import com.sshworkspace.controller.ServerController;
import com.sshworkspace.model.ServerProfile;
import com.sshworkspace.model.Tag;
import com.sshworkspace.model.User;
import com.sshworkspace.repository.*;
import com.sshworkspace.security.UserPrincipal;
import com.sshworkspace.service.AuditService;
import com.sshworkspace.service.EncryptionService;
import com.sshworkspace.service.SshClientService;
import com.sshworkspace.service.SshSessionManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ServerControllerTagTest {

    @Mock
    private ServerProfileRepository serverRepository;
    @Mock
    private CredentialRepository credentialRepository;
    @Mock
    private ServerGroupRepository groupRepository;
    @Mock
    private TagRepository tagRepository;
    @Mock
    private SessionRecordRepository sessionRecordRepository;
    @Mock
    private EncryptionService encryptionService;
    @Mock
    private SshClientService sshClientService;
    @Mock
    private SshSessionManager sshSessionManager;
    @Mock
    private AuditService auditService;

    @InjectMocks
    private ServerController serverController;

    private UserPrincipal principal;
    private Tag tagProd;
    private Tag tagWeb;
    private ServerProfile server1;
    private ServerProfile server2;

    @BeforeEach
    void setUp() {
        principal = new UserPrincipal(1L, "user@example.com", "User");

        tagProd = Tag.builder().id(10L).userId(1L).name("production").build();
        tagWeb = Tag.builder().id(20L).userId(1L).name("web").build();

        Set<Tag> tags1 = new HashSet<>();
        tags1.add(tagProd);
        tags1.add(tagWeb);

        server1 = ServerProfile.builder()
                .id(100L)
                .userId(1L)
                .name("Web Server 1")
                .hostname("192.168.1.10")
                .port(22)
                .username("root")
                .authType("PASSWORD")
                .tags(tags1)
                .build();

        Set<Tag> tags2 = new HashSet<>();
        tags2.add(tagProd);

        server2 = ServerProfile.builder()
                .id(200L)
                .userId(1L)
                .name("DB Server 2")
                .hostname("192.168.1.20")
                .port(22)
                .username("root")
                .authType("PASSWORD")
                .tags(tags2)
                .build();
    }

    @Test
    void testDeleteTagGlobally_RemovesFromAllServersAndDeletesTag() {
        when(tagRepository.findByUserIdAndName(1L, "production")).thenReturn(Optional.of(tagProd));
        when(serverRepository.findByUserId(1L)).thenReturn(List.of(server1, server2));

        ResponseEntity<?> response = serverController.deleteTagGlobally(principal, "#production");

        assertEquals(200, response.getStatusCode().value());
        // Verify tagProd was removed from both servers
        assertFalse(server1.getTags().contains(tagProd));
        assertTrue(server1.getTags().contains(tagWeb));
        assertFalse(server2.getTags().contains(tagProd));
        assertEquals(0, server2.getTags().size());

        verify(serverRepository).save(server1);
        verify(serverRepository).save(server2);
        verify(tagRepository).delete(tagProd);
        verify(auditService).recordEvent(eq(1L), eq("production"), eq("TAG_DELETE"), eq("SUCCESS"), anyString());
    }

    @Test
    void testRemoveTagFromServer_RemovesOnlyFromSpecificServer() {
        when(serverRepository.findByIdAndUserId(100L, 1L)).thenReturn(Optional.of(server1));
        when(serverRepository.save(any(ServerProfile.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = serverController.removeTagFromServer(principal, 100L, "#production");

        assertEquals(200, response.getStatusCode().value());
        assertNotNull(response.getBody());
        // Verify production tag was removed from server1, but web tag remains
        assertFalse(response.getBody().getTags().contains("production"));
        assertTrue(response.getBody().getTags().contains("web"));

        verify(serverRepository).save(server1);
        verify(tagRepository, never()).delete(any());
        verify(auditService).recordEvent(eq(1L), eq("Web Server 1"), eq("TAG_REMOVE"), eq("SUCCESS"), anyString());
    }
}
