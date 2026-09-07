package com.sshworkspace.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "service_tunnels")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServiceTunnel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "server_id", nullable = false)
    private Long serverId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "service_type", nullable = false, length = 50)
    private String serviceType; // MYSQL, POSTGRES, REDIS, MONGODB, HTTP, CUSTOM

    @Column(name = "local_port", nullable = false)
    private Integer localPort;

    @Column(name = "remote_host", nullable = false, length = 255)
    @Builder.Default
    private String remoteHost = "127.0.0.1";

    @Column(name = "remote_port", nullable = false)
    private Integer remotePort;

    @Column(name = "auto_start")
    @Builder.Default
    private Boolean autoStart = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
