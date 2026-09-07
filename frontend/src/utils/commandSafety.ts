import { CommandSafetyCheck } from '../types';

interface SafetyRule {
  regex: RegExp;
  category: string;
  reason: string;
}

const SAFETY_RULES: SafetyRule[] = [
  {
    regex: /\b(reboot|shutdown|poweroff|halt|init\s+[06])\b/i,
    category: 'SYSTEM POWER',
    reason: 'System reboot, shutdown, or poweroff will drop all active connections and take the host offline.'
  },
  {
    regex: /\b(rm\s+-[a-zA-Z]*[rf][a-zA-Z]*|rm\s+--recursive|rmdir|shred|truncate)\b/i,
    category: 'FILE DELETION',
    reason: 'Recursive or force deletion can cause irreversible data loss on the target filesystems.'
  },
  {
    regex: /\brm\s+(?!-[a-zA-Z]*i)\S+/i,
    category: 'FILE DELETION',
    reason: 'Unconditional file deletion without interactive confirmation.'
  },
  {
    regex: /\b(systemctl|service)\s+(stop|restart|disable|mask)\b/i,
    category: 'SERVICE DISRUPTION',
    reason: 'Stopping, restarting, or disabling services will disrupt running web servers, databases, or daemons.'
  },
  {
    regex: /\bdocker\s+(rm|rmi|kill|system\s+prune|volume\s+prune|compose\s+down)\b/i,
    category: 'CONTAINER REMOVAL',
    reason: 'Destroying containers, images, volumes, or docker-compose stacks will terminate containerized workloads.'
  },
  {
    regex: /\b(kill\s+-9|killall|pkill)\b/i,
    category: 'PROCESS TERMINATION',
    reason: 'Force killing processes abruptly drops active tasks and may cause data corruption.'
  },
  {
    regex: /\b(mkfs|fdisk|parted|dd\s+if=)\b/i,
    category: 'DISK ALTERATION',
    reason: 'Low-level disk format, partition restructuring, or raw block write can overwrite entire storage drives.'
  },
  {
    regex: /\b(drop\s+database|drop\s+table|flushall)\b/i,
    category: 'DATABASE DESTRUCTION',
    reason: 'Dropping database tables or flushing Redis cache destroys operational data.'
  }
];

export function analyzeCommandSafety(command: string): CommandSafetyCheck {
  if (!command || !command.trim()) {
    return { isDestructive: false, category: 'SAFE' };
  }

  const trimmed = command.trim();
  for (const rule of SAFETY_RULES) {
    if (rule.regex.test(trimmed)) {
      return {
        isDestructive: true,
        category: rule.category,
        reason: rule.reason
      };
    }
  }

  return { isDestructive: false, category: 'SAFE' };
}
