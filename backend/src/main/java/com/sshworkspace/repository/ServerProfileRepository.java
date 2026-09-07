package com.sshworkspace.repository;

import com.sshworkspace.model.ServerProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ServerProfileRepository extends JpaRepository<ServerProfile, Long> {
    List<ServerProfile> findByUserId(Long userId);
    Optional<ServerProfile> findByIdAndUserId(Long id, Long userId);
    List<ServerProfile> findByUserIdAndGroupId(Long userId, Long groupId);
}
