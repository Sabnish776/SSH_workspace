package com.sshworkspace.repository;

import com.sshworkspace.model.SessionRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SessionRecordRepository extends JpaRepository<SessionRecord, String> {
    List<SessionRecord> findByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<SessionRecord> findByIdAndUserId(String id, Long userId);
    List<SessionRecord> findByServerIdAndStatus(Long serverId, String status);
}
