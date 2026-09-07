package com.sshworkspace.repository;

import com.sshworkspace.model.ServiceTunnel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ServiceTunnelRepository extends JpaRepository<ServiceTunnel, Long> {
    List<ServiceTunnel> findByUserIdAndServerId(Long userId, Long serverId);
    List<ServiceTunnel> findByUserId(Long userId);
    Optional<ServiceTunnel> findByIdAndUserId(Long id, Long userId);
}
