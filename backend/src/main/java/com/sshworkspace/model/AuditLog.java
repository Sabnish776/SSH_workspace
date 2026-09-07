package com.sshworkspace.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "server_name", length = 150)
    private String serverName;

    @Column(nullable = false, length = 100)
    private String action; // SSH_CONNECT, SSH_DISCONNECT, SFTP_UPLOAD, etc.

    @Column(nullable = false, length = 50)
    private String result; // SUCCESS, FAILED

    @Column(columnDefinition = "TEXT")
    private String details;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private OffsetDateTime timestamp;
}
