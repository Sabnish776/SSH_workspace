package com.sshworkspace.controller;

import com.sshworkspace.dto.SftpDtos.*;
import com.sshworkspace.model.ServerProfile;
import com.sshworkspace.repository.ServerProfileRepository;
import com.sshworkspace.security.UserPrincipal;
import com.sshworkspace.service.SftpService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.OutputStream;
import java.nio.file.Paths;
import java.util.Map;

@RestController
@RequestMapping("/api/servers/{serverId}/files")
@RequiredArgsConstructor
@Slf4j
public class SftpController {

    private final SftpService sftpService;
    private final ServerProfileRepository serverRepository;

    @GetMapping
    public ResponseEntity<DirectoryListingResponse> listFiles(@AuthenticationPrincipal UserPrincipal principal,
                                                              @PathVariable Long serverId,
                                                              @RequestParam(defaultValue = ".") String path) throws Exception {
        ServerProfile server = getServer(serverId, principal.getId());
        DirectoryListingResponse listing = sftpService.listDirectory(server, path, principal.getId());
        return ResponseEntity.ok(listing);
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadFile(@AuthenticationPrincipal UserPrincipal principal,
                                        @PathVariable Long serverId,
                                        @RequestParam(defaultValue = ".") String path,
                                        @RequestParam("file") MultipartFile file) throws Exception {
        ServerProfile server = getServer(serverId, principal.getId());
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Filename cannot be empty"));
        }

        sftpService.uploadFile(server, path, originalFilename, file.getInputStream(), principal.getId());
        return ResponseEntity.ok(Map.of("message", "File uploaded successfully: " + originalFilename));
    }

    @GetMapping("/download")
    public void downloadFile(@AuthenticationPrincipal UserPrincipal principal,
                             @PathVariable Long serverId,
                             @RequestParam String path,
                             HttpServletResponse response) throws Exception {
        ServerProfile server = getServer(serverId, principal.getId());
        String filename = Paths.get(path).getFileName().toString();

        response.setContentType(MediaType.APPLICATION_OCTET_STREAM_VALUE);
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"");

        try (OutputStream out = response.getOutputStream()) {
            sftpService.downloadFile(server, path, out, principal.getId());
        }
    }

    @DeleteMapping
    public ResponseEntity<?> deleteFile(@AuthenticationPrincipal UserPrincipal principal,
                                        @PathVariable Long serverId,
                                        @RequestParam String path) throws Exception {
        ServerProfile server = getServer(serverId, principal.getId());
        sftpService.deleteFile(server, path, principal.getId());
        return ResponseEntity.ok(Map.of("message", "Deleted successfully: " + path));
    }

    @PostMapping("/mkdir")
    public ResponseEntity<?> mkdir(@AuthenticationPrincipal UserPrincipal principal,
                                   @PathVariable Long serverId,
                                   @RequestBody MkdirRequest request) throws Exception {
        ServerProfile server = getServer(serverId, principal.getId());
        sftpService.createDirectory(server, request.getPath(), principal.getId());
        return ResponseEntity.ok(Map.of("message", "Directory created: " + request.getPath()));
    }

    @PutMapping("/rename")
    public ResponseEntity<?> rename(@AuthenticationPrincipal UserPrincipal principal,
                                    @PathVariable Long serverId,
                                    @RequestBody RenameRequest request) throws Exception {
        ServerProfile server = getServer(serverId, principal.getId());
        sftpService.renameFile(server, request.getOldPath(), request.getNewPath(), principal.getId());
        return ResponseEntity.ok(Map.of("message", "Renamed successfully"));
    }

    private ServerProfile getServer(Long serverId, Long userId) {
        return serverRepository.findByIdAndUserId(serverId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Server not found"));
    }
}
