package com.sshworkspace.dto;

import lombok.*;

import java.util.List;

public class SftpDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class FileItemDto {
        private String name;
        private String path;
        private boolean directory;
        private long size;
        private long modifiedTime;
        private String permissions;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DirectoryListingResponse {
        private String currentPath;
        private List<FileItemDto> files;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RenameRequest {
        private String oldPath;
        private String newPath;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MkdirRequest {
        private String path;
    }
}
