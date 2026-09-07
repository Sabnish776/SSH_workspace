package com.sshworkspace.service;

import com.sshworkspace.dto.SftpDtos.DirectoryListingResponse;
import com.sshworkspace.dto.SftpDtos.FileItemDto;
import com.sshworkspace.model.Credential;
import com.sshworkspace.model.ServerProfile;
import com.sshworkspace.repository.CredentialRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.sshd.client.session.ClientSession;
import org.apache.sshd.sftp.client.SftpClient;
import org.apache.sshd.sftp.client.SftpClientFactory;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class SftpService {

    private final SshClientService sshClientService;
    private final CredentialRepository credentialRepository;
    private final EncryptionService encryptionService;
    private final AuditService auditService;

    public DirectoryListingResponse listDirectory(ServerProfile server, String requestedPath, Long userId) throws Exception {
        String safePath = validateAndNormalizePath(requestedPath);
        if (safePath.isEmpty()) safePath = ".";

        DecryptedCredentials creds = getCredentials(server, userId);
        try (ClientSession session = sshClientService.createSession(server, creds.password, creds.privateKey, creds.passphrase);
             SftpClient sftp = SftpClientFactory.instance().createSftpClient(session)) {

            String canonicalPath = sftp.canonicalPath(safePath);
            List<FileItemDto> files = new ArrayList<>();

            Iterable<SftpClient.DirEntry> entries = sftp.readDir(canonicalPath);
            for (SftpClient.DirEntry entry : entries) {
                String name = entry.getFilename();
                if (".".equals(name) || "..".equals(name)) continue;

                SftpClient.Attributes attrs = entry.getAttributes();
                String itemPath = canonicalPath.endsWith("/") ? canonicalPath + name : canonicalPath + "/" + name;

                files.add(FileItemDto.builder()
                        .name(name)
                        .path(itemPath)
                        .directory(attrs.isDirectory())
                        .size(attrs.getSize())
                        .modifiedTime(attrs.getModifyTime() != null ? attrs.getModifyTime().toMillis() : 0)
                        .permissions(formatPermissions(attrs.getPermissions()))
                        .build());
            }

            // Sort: directories first, then alphabetical
            files.sort((a, b) -> {
                if (a.isDirectory() != b.isDirectory()) {
                    return a.isDirectory() ? -1 : 1;
                }
                return a.getName().compareToIgnoreCase(b.getName());
            });

            auditService.recordEvent(userId, server.getName(), "SFTP_LIST", "SUCCESS", "Listed directory: " + canonicalPath);
            return DirectoryListingResponse.builder()
                    .currentPath(canonicalPath)
                    .files(files)
                    .build();
        }
    }

    public void downloadFile(ServerProfile server, String remotePath, OutputStream out, Long userId) throws Exception {
        String safePath = validateAndNormalizePath(remotePath);
        DecryptedCredentials creds = getCredentials(server, userId);

        try (ClientSession session = sshClientService.createSession(server, creds.password, creds.privateKey, creds.passphrase);
             SftpClient sftp = SftpClientFactory.instance().createSftpClient(session);
             InputStream in = sftp.read(safePath)) {

            byte[] buffer = new byte[8192];
            int len;
            while ((len = in.read(buffer)) != -1) {
                out.write(buffer, 0, len);
            }
            out.flush();
            auditService.recordEvent(userId, server.getName(), "SFTP_DOWNLOAD", "SUCCESS", "Downloaded: " + safePath);
        }
    }

    public void uploadFile(ServerProfile server, String remoteDirectory, String filename, InputStream in, Long userId) throws Exception {
        String safeDir = validateAndNormalizePath(remoteDirectory);
        String safeFilename = Paths.get(filename).getFileName().toString();
        String fullPath = safeDir.endsWith("/") ? safeDir + safeFilename : safeDir + "/" + safeFilename;

        DecryptedCredentials creds = getCredentials(server, userId);
        try (ClientSession session = sshClientService.createSession(server, creds.password, creds.privateKey, creds.passphrase);
             SftpClient sftp = SftpClientFactory.instance().createSftpClient(session);
             OutputStream out = sftp.write(fullPath, SftpClient.OpenMode.Write, SftpClient.OpenMode.Create, SftpClient.OpenMode.Truncate)) {

            byte[] buffer = new byte[8192];
            int len;
            while ((len = in.read(buffer)) != -1) {
                out.write(buffer, 0, len);
            }
            out.flush();
            auditService.recordEvent(userId, server.getName(), "SFTP_UPLOAD", "SUCCESS", "Uploaded file: " + fullPath);
        }
    }

    public void deleteFile(ServerProfile server, String remotePath, Long userId) throws Exception {
        String safePath = validateAndNormalizePath(remotePath);
        DecryptedCredentials creds = getCredentials(server, userId);

        try (ClientSession session = sshClientService.createSession(server, creds.password, creds.privateKey, creds.passphrase);
             SftpClient sftp = SftpClientFactory.instance().createSftpClient(session)) {

            try {
                sftp.remove(safePath);
            } catch (Exception e) {
                // If regular remove fails, try rmdir for directory
                sftp.rmdir(safePath);
            }
            auditService.recordEvent(userId, server.getName(), "SFTP_DELETE", "SUCCESS", "Deleted file: " + safePath);
        }
    }

    public void renameFile(ServerProfile server, String oldPath, String newPath, Long userId) throws Exception {
        String safeOldPath = validateAndNormalizePath(oldPath);
        String safeNewPath = validateAndNormalizePath(newPath);
        DecryptedCredentials creds = getCredentials(server, userId);

        try (ClientSession session = sshClientService.createSession(server, creds.password, creds.privateKey, creds.passphrase);
             SftpClient sftp = SftpClientFactory.instance().createSftpClient(session)) {

            sftp.rename(safeOldPath, safeNewPath);
            auditService.recordEvent(userId, server.getName(), "SFTP_RENAME", "SUCCESS", "Renamed: " + safeOldPath + " -> " + safeNewPath);
        }
    }

    public void createDirectory(ServerProfile server, String remotePath, Long userId) throws Exception {
        String safePath = validateAndNormalizePath(remotePath);
        DecryptedCredentials creds = getCredentials(server, userId);

        try (ClientSession session = sshClientService.createSession(server, creds.password, creds.privateKey, creds.passphrase);
             SftpClient sftp = SftpClientFactory.instance().createSftpClient(session)) {

            sftp.mkdir(safePath);
            auditService.recordEvent(userId, server.getName(), "SFTP_MKDIR", "SUCCESS", "Created directory: " + safePath);
        }
    }

    private String validateAndNormalizePath(String path) {
        if (path == null || path.isBlank()) return "";
        if (path.contains("\0")) throw new IllegalArgumentException("Invalid path: contains null character");
        Path p = Paths.get(path).normalize();
        return p.toString().replace('\\', '/');
    }

    private String formatPermissions(int permissions) {
        StringBuilder sb = new StringBuilder();
        sb.append((permissions & 0400) != 0 ? "r" : "-");
        sb.append((permissions & 0200) != 0 ? "w" : "-");
        sb.append((permissions & 0100) != 0 ? "x" : "-");
        sb.append((permissions & 0040) != 0 ? "r" : "-");
        sb.append((permissions & 0020) != 0 ? "w" : "-");
        sb.append((permissions & 0010) != 0 ? "x" : "-");
        sb.append((permissions & 0004) != 0 ? "r" : "-");
        sb.append((permissions & 0002) != 0 ? "w" : "-");
        sb.append((permissions & 0001) != 0 ? "x" : "-");
        return sb.toString();
    }

    private DecryptedCredentials getCredentials(ServerProfile server, Long userId) {
        if (server.getCredentialId() == null) {
            return new DecryptedCredentials(null, null, null);
        }
        Credential credential = credentialRepository.findByIdAndUserId(server.getCredentialId(), userId)
                .orElse(null);
        if (credential == null) {
            return new DecryptedCredentials(null, null, null);
        }

        String decrypted = encryptionService.decrypt(credential.getEncryptedData());
        if ("KEY".equalsIgnoreCase(credential.getType())) {
            return new DecryptedCredentials(null, decrypted, null);
        } else {
            return new DecryptedCredentials(decrypted, null, null);
        }
    }

    private record DecryptedCredentials(String password, String privateKey, String passphrase) {}
}
