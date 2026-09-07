package com.sshworkspace.service;

import com.sshworkspace.model.AuditLog;
import com.sshworkspace.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.regex.Pattern;

/**
 * Implements SEC-007: Secret Redaction & Operational Auditing.
 * Logs security-relevant actions while masking passwords, keys, and tokens.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    private static final Pattern PASSWORD_PATTERN = Pattern.compile("(?i)(password|passphrase|token|secret|key)=([^&\\s]+)");

    public void recordEvent(Long userId, String serverName, String action, String result, String details) {
        String sanitizedDetails = sanitize(details);
        log.info("AUDIT: user={} | server={} | action={} | result={}", userId, serverName, action, result);

        try {
            AuditLog auditLog = AuditLog.builder()
                    .userId(userId)
                    .serverName(serverName)
                    .action(action)
                    .result(result)
                    .details(sanitizedDetails)
                    .build();
            auditLogRepository.save(auditLog);
        } catch (Exception e) {
            log.error("Failed to save audit log record", e);
        }
    }

    private String sanitize(String input) {
        if (input == null) return null;
        return PASSWORD_PATTERN.matcher(input).replaceAll("$1=[REDACTED]");
    }
}
