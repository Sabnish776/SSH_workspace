package com.sshworkspace.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "servers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServerProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 255)
    private String hostname;

    @Column(nullable = false)
    @Builder.Default
    private Integer port = 22;

    @Column(nullable = false, length = 100)
    private String username;

    @Column(name = "auth_type", nullable = false, length = 50)
    private String authType; // PASSWORD or KEY

    @Column(name = "credential_id")
    private Long credentialId;

    @Column(name = "group_id")
    private Long groupId;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "server_tags",
        joinColumns = @JoinColumn(name = "server_id"),
        inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    @Builder.Default
    private Set<Tag> tags = new HashSet<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
