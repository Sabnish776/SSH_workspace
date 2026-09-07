package com.sshworkspace.service;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

@Service
public class CommandSafetyService {

    @Getter
    @AllArgsConstructor
    public static class SafetyCheckResult {
        private final boolean destructive;
        private final String riskCategory;
        private final String reason;

        public static SafetyCheckResult safe() {
            return new SafetyCheckResult(false, "SAFE", null);
        }

        public static SafetyCheckResult dangerous(String category, String reason) {
            return new SafetyCheckResult(true, category, reason);
        }
    }

    private static class Rule {
        private final Pattern pattern;
        private final String category;
        private final String reason;

        public Rule(String regex, String category, String reason) {
            this.pattern = Pattern.compile(regex, Pattern.CASE_INSENSITIVE);
            this.category = category;
            this.reason = reason;
        }

        public boolean matches(String command) {
            return pattern.matcher(command).find();
        }
    }

    private final List<Rule> rules = new ArrayList<>();

    public CommandSafetyService() {
        // 1. System Power & Reboots
        rules.add(new Rule(
                "\\b(reboot|shutdown|poweroff|halt|init\\s+[06])\\b",
                "SYSTEM_POWER",
                "System reboot, shutdown, or poweroff will terminate active sessions and take host offline."
        ));

        // 2. File and Directory Deletion
        rules.add(new Rule(
                "\\b(rm\\s+-[a-zA-Z]*[rf][a-zA-Z]*|rm\\s+--recursive|rmdir|shred|truncate)\\b",
                "FILE_DESTRUCTION",
                "Recursive or force deletion of files/directories can cause permanent data loss."
        ));
        rules.add(new Rule(
                "\\brm\\s+(?!-[a-zA-Z]*i)\\S+",
                "FILE_DESTRUCTION",
                "File deletion without interactive confirmation."
        ));

        // 3. Systemd / Service Operations
        rules.add(new Rule(
                "\\b(systemctl|service)\\s+(stop|restart|disable|mask)\\b",
                "SERVICE_DISRUPTION",
                "Stopping, restarting, or disabling services will disrupt running applications."
        ));

        // 4. Docker Container and Volume Removal / Pruning
        rules.add(new Rule(
                "\\bdocker\\s+(rm|rmi|kill|system\\s+prune|volume\\s+prune|compose\\s+down)\\b",
                "CONTAINER_REMOVAL",
                "Removing or pruning Docker containers, volumes, or compose stacks will destroy running workloads."
        ));

        // 5. Process Killing
        rules.add(new Rule(
                "\\b(kill\\s+-9|killall|pkill)\\b",
                "PROCESS_TERMINATION",
                "Unconditional process kill signals may corrupt in-flight state."
        ));

        // 6. Disk, Filesystem, and Raw Block Operations
        rules.add(new Rule(
                "\\b(mkfs|fdisk|parted|dd\\s+if=)\\b",
                "DISK_ALTERATION",
                "Low-level disk format, partition restructuring, or raw block write."
        ));

        // 7. Database or In-Memory Cache Wipes
        rules.add(new Rule(
                "\\b(drop\\s+database|drop\\s+table|flushall)\\b",
                "DATABASE_DROP",
                "Database destruction or global cache wipe."
        ));
    }

    public SafetyCheckResult analyze(String command) {
        if (command == null || command.isBlank()) {
            return SafetyCheckResult.safe();
        }

        String trimmed = command.trim();
        for (Rule rule : rules) {
            if (rule.matches(trimmed)) {
                return SafetyCheckResult.dangerous(rule.category, rule.reason);
            }
        }

        return SafetyCheckResult.safe();
    }
}
