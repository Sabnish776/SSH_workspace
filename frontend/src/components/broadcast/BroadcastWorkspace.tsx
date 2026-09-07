import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Terminal,
  Zap,
  CheckSquare,
  Square,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Server,
  Play,
  Layers,
  LayoutGrid,
  List,
  FileText
} from 'lucide-react';
import { ServerProfile, BroadcastResponse, ServerExecutionResult, CommandSafetyCheck } from '../../types';
import { api } from '../../api/client';
import { usePopup } from '../../context/PopupContext';
import { analyzeCommandSafety } from '../../utils/commandSafety';
import { SecurityChallengeModal } from '../common/SecurityChallengeModal';

interface BroadcastWorkspaceProps {
  servers: ServerProfile[];
  serverStatuses: Record<number, { status: 'ONLINE' | 'OFFLINE' | 'CHECKING'; latencyMs?: number }>;
  onOpenTerminal: (server: ServerProfile) => void;
}

const PRESET_COMMANDS = [
  { label: 'Uptime & Load', cmd: 'uptime', icon: '⏱' },
  { label: 'Disk Allocation', cmd: 'df -h /', icon: '💾' },
  { label: 'Memory Stats', cmd: 'free -m 2>/dev/null || vm_stat', icon: '⚡' },
  { label: 'Containers', cmd: 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "No docker engine"', icon: '🐳' },
  { label: 'OS & Kernel', cmd: 'uname -srm; cat /etc/os-release 2>/dev/null | grep PRETTY_NAME || true', icon: '🐧' },
  { label: 'Active Users', cmd: 'who', icon: '👤' },
  { label: 'Listening Sockets', cmd: 'ss -tulpn 2>/dev/null || netstat -tulpn 2>/dev/null || true', icon: '🔌' },
];

export const BroadcastWorkspace: React.FC<BroadcastWorkspaceProps> = ({
  servers,
  serverStatuses,
  onOpenTerminal
}) => {
  const popup = usePopup();

  // Selection state (default: all servers selected)
  const [selectedServerIds, setSelectedServerIds] = useState<number[]>([]);
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

  // Command & Execution state
  const [command, setCommand] = useState<string>('uptime');
  const [commandHistory, setCommandHistory] = useState<string[]>(['uptime', 'df -h /', 'docker ps']);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [timeoutSec, setTimeoutSec] = useState<number>(15);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [lastResponse, setLastResponse] = useState<BroadcastResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [resultsViewMode, setResultsViewMode] = useState<'grid' | 'table'>('grid');

  // Security Challenge Modal state
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [pendingSafety, setPendingSafety] = useState<CommandSafetyCheck | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize selection with all servers once loaded
  useEffect(() => {
    if (servers.length > 0 && selectedServerIds.length === 0) {
      setSelectedServerIds(servers.map((s) => s.id));
    }
  }, [servers]);

  // Derived groups and tags
  const allGroups = Array.from(new Set(servers.map((s) => s.groupName).filter(Boolean))) as string[];
  const allTags = Array.from(new Set(servers.flatMap((s) => s.tags || [])));

  // Target toggle handlers
  const handleToggleServer = (id: number) => {
    setSelectedServerIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedServerIds(servers.map((s) => s.id));
    setActiveGroupFilter(null);
    setActiveTagFilter(null);
  };

  const handleDeselectAll = () => {
    setSelectedServerIds([]);
    setActiveGroupFilter(null);
    setActiveTagFilter(null);
  };

  const handleSelectGroup = (group: string) => {
    if (activeGroupFilter === group) {
      handleSelectAll();
    } else {
      const matchIds = servers.filter((s) => s.groupName === group).map((s) => s.id);
      setSelectedServerIds(matchIds);
      setActiveGroupFilter(group);
      setActiveTagFilter(null);
    }
  };

  const handleSelectTag = (tag: string) => {
    if (activeTagFilter === tag) {
      handleSelectAll();
    } else {
      const matchIds = servers.filter((s) => s.tags && s.tags.includes(tag)).map((s) => s.id);
      setSelectedServerIds(matchIds);
      setActiveTagFilter(tag);
      setActiveGroupFilter(null);
    }
  };

  // Execute broadcast command
  const handleExecute = async (cmdToRun?: string, confirmedPassword?: string) => {
    const finalCmd = (cmdToRun || command).trim();
    if (!finalCmd) {
      await popup.alert({
        title: 'Empty Command',
        message: 'Please provide a shell command to broadcast to the cluster.',
        variant: 'warning'
      });
      return;
    }

    if (selectedServerIds.length === 0) {
      await popup.alert({
        title: 'No Targets Selected',
        message: 'Please select at least one server to broadcast this command.',
        variant: 'warning'
      });
      return;
    }

    // Safety Interceptor: Check for destructive commands if not yet confirmed with password
    if (!confirmedPassword) {
      const safety = analyzeCommandSafety(finalCmd);
      if (safety.isDestructive) {
        setPendingCommand(finalCmd);
        setPendingSafety(safety);
        setSecurityModalOpen(true);
        return;
      }
    }

    // Add to history
    setCommandHistory((prev) => [finalCmd, ...prev.filter((c) => c !== finalCmd)].slice(0, 30));
    setHistoryIndex(-1);

    setIsExecuting(true);
    try {
      const resp = await api.cluster.broadcast({
        serverIds: selectedServerIds,
        command: finalCmd,
        timeoutMs: timeoutSec * 1000,
        confirmationPassword: confirmedPassword
      });
      setLastResponse(resp);
    } catch (err: any) {
      if (confirmedPassword) {
        throw err; // Let SecurityChallengeModal display invalid password error
      }
      await popup.alert({
        title: 'Broadcast Execution Error',
        message: err.message || 'Failed to dispatch cluster broadcast.',
        variant: 'danger'
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Keyboard navigation for history
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleExecute();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const nextIdx = Math.min(historyIndex + 1, commandHistory.length - 1);
        setHistoryIndex(nextIdx);
        setCommand(commandHistory[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setCommand(commandHistory[nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  // Copy single output
  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Export all outputs as Markdown
  const handleExportMarkdown = () => {
    if (!lastResponse) return;
    let md = `# Cluster Broadcast Report\n`;
    md += `**Command**: \`${lastResponse.command}\`\n`;
    md += `**Executed At**: ${new Date(lastResponse.executedAt).toLocaleString()}\n`;
    md += `**Results**: ${lastResponse.successCount} succeeded, ${lastResponse.failedCount} failed (${lastResponse.totalTargets} total targets)\n\n`;
    md += `---\n\n`;

    Object.values(lastResponse.results).forEach((res: ServerExecutionResult) => {
      md += `### ${res.serverName} (${res.hostname}:${res.port})\n`;
      md += `- **Status**: ${res.success ? 'SUCCESS (exit 0)' : `FAILED (exit ${res.exitCode})`}\n`;
      md += `- **Duration**: ${res.durationMs}ms\n`;
      if (res.error) {
        md += `- **Error**: ${res.error}\n`;
      }
      md += `\`\`\`bash\n${res.output || '(no output)'}\n\`\`\`\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cluster-broadcast-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="broadcast-workspace-container">
      {/* 1. Header & Cluster Scope Selector */}
      <div className="broadcast-header-card">
        <div className="broadcast-title-row">
          <div className="broadcast-title-group">
            <div className="broadcast-radar-icon">
              <Radio size={20} className={isExecuting ? 'spinning text-cyan' : 'text-cyan'} />
            </div>
            <div>
              <h2>Multi-Exec / Cluster Broadcast Shell</h2>
              <p>Dispatch non-blocking parallel commands simultaneously across tagged server fleets.</p>
            </div>
          </div>

          <div className="broadcast-scope-stats">
            <span className="scope-count-badge">
              🎯 <strong>{selectedServerIds.length}</strong> of {servers.length} Targets Selected
            </span>
            <div className="scope-actions">
              <button type="button" className="btn btn-outline btn-xs" onClick={handleSelectAll}>
                Select All
              </button>
              <button type="button" className="btn btn-outline btn-xs" onClick={handleDeselectAll}>
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Filter Quick Chips */}
        <div className="broadcast-chips-bar">
          <span className="chips-label">Scope Filters:</span>
          <button
            type="button"
            className={`scope-filter-pill ${activeGroupFilter === null && activeTagFilter === null && selectedServerIds.length === servers.length ? 'active' : ''}`}
            onClick={handleSelectAll}
          >
            All Servers ({servers.length})
          </button>

          {allGroups.map((group) => (
            <button
              key={group}
              type="button"
              className={`scope-filter-pill ${activeGroupFilter === group ? 'active' : ''}`}
              onClick={() => handleSelectGroup(group)}
            >
              Group: {group}
            </button>
          ))}

          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`scope-filter-pill ${activeTagFilter === tag ? 'active' : ''}`}
              onClick={() => handleSelectTag(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>

        {/* Server Target Selector Grid */}
        <div className="broadcast-server-selector-grid">
          {servers.map((server) => {
            const isSelected = selectedServerIds.includes(server.id);
            const statusObj = serverStatuses[server.id];
            const isOnline = statusObj?.status === 'ONLINE';
            const isChecking = statusObj?.status === 'CHECKING';

            return (
              <div
                key={server.id}
                className={`broadcast-server-chip ${isSelected ? 'selected' : ''}`}
                onClick={() => handleToggleServer(server.id)}
              >
                <div className="server-chip-checkbox">
                  {isSelected ? (
                    <CheckSquare size={16} className="text-emerald" />
                  ) : (
                    <Square size={16} color="var(--text-muted)" />
                  )}
                </div>
                <div className="server-chip-details">
                  <div className="server-chip-header">
                    <span className="server-chip-name">{server.name}</span>
                    {server.groupName && (
                      <span className="group-badge-pill">{server.groupName}</span>
                    )}
                  </div>
                  <span className="server-chip-endpoint">
                    {server.username}@{server.hostname}:{server.port}
                  </span>
                </div>
                <div className="server-chip-status">
                  <span
                    className={`status-dot ${isChecking ? 'checking' : isOnline ? 'online' : 'offline'}`}
                    title={statusObj?.status || 'Unknown'}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Command Console Bar */}
      <div className="broadcast-command-card">
        <div className="broadcast-input-row">
          <div className="broadcast-prompt-prefix">
            <Terminal size={18} />
          </div>
          <input
            ref={inputRef}
            type="text"
            className="broadcast-cmd-input"
            placeholder="Type shell command to broadcast... (e.g. uptime, docker ps, df -h) [Press Enter or Ctrl+Enter]"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isExecuting}
          />
          <div className="broadcast-timeout-selector" title="Execution Timeout">
            <Clock size={14} />
            <select
              value={timeoutSec}
              onChange={(e) => setTimeoutSec(Number(e.target.value))}
              disabled={isExecuting}
            >
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>
          </div>
          <button
            type="button"
            className="btn btn-primary broadcast-execute-btn"
            disabled={isExecuting || selectedServerIds.length === 0}
            onClick={() => handleExecute()}
          >
            {isExecuting ? (
              <>
                <RefreshCw size={15} className="spinning" />
                <span>Executing...</span>
              </>
            ) : (
              <>
                <Zap size={15} />
                <span>Broadcast</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Command Presets */}
        <div className="broadcast-presets-row">
          <span className="presets-label">DevOps Presets:</span>
          {PRESET_COMMANDS.map((preset) => (
            <button
              key={preset.cmd}
              type="button"
              className="preset-btn"
              disabled={isExecuting}
              onClick={() => {
                setCommand(preset.cmd);
                handleExecute(preset.cmd);
              }}
              title={preset.cmd}
            >
              <span>{preset.icon}</span>
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Execution Results Panel */}
      {lastResponse && (
        <div className="broadcast-results-container">
          <div className="broadcast-results-header">
            <div className="results-summary">
              <span className="results-cmd-badge">
                <code>&gt; {lastResponse.command}</code>
              </span>
              <span className="results-stat-pill success">
                <CheckCircle2 size={13} />
                <span>{lastResponse.successCount} Succeeded</span>
              </span>
              {lastResponse.failedCount > 0 && (
                <span className="results-stat-pill failed">
                  <AlertCircle size={13} />
                  <span>{lastResponse.failedCount} Failed</span>
                </span>
              )}
              <span className="results-timestamp">
                {new Date(lastResponse.executedAt).toLocaleTimeString()}
              </span>
            </div>

            <div className="results-toolbar">
              <div className="view-mode-switcher" style={{ marginRight: '8px' }}>
                <button
                  type="button"
                  className={`view-mode-btn ${resultsViewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setResultsViewMode('grid')}
                  title="Grid Tiles"
                >
                  <LayoutGrid size={14} />
                  <span>Grid</span>
                </button>
                <button
                  type="button"
                  className={`view-mode-btn ${resultsViewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setResultsViewMode('table')}
                  title="Table View"
                >
                  <List size={14} />
                  <span>Table</span>
                </button>
              </div>

              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => handleExecute(lastResponse.command)}
                title="Re-run this command"
              >
                <RefreshCw size={13} />
                <span>Re-run</span>
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={handleExportMarkdown}
                title="Export report as Markdown"
              >
                <FileText size={13} />
                <span>Export Report</span>
              </button>
            </div>
          </div>

          {/* Grid View */}
          {resultsViewMode === 'grid' ? (
            <div className="broadcast-tiles-grid">
              {Object.values(lastResponse.results).map((res: ServerExecutionResult) => {
                const targetServer = servers.find((s) => s.id === res.serverId);

                return (
                  <div
                    key={res.serverId}
                    className={`broadcast-tile-card ${res.success ? 'tile-success' : 'tile-failed'}`}
                  >
                    <div className="broadcast-tile-header">
                      <div className="tile-server-meta">
                        <span className="tile-server-name">{res.serverName}</span>
                        <span className="tile-server-endpoint">
                          {res.hostname}:{res.port}
                        </span>
                      </div>

                      <div className="tile-status-pills">
                        <span className={`tile-exit-pill ${res.success ? 'success' : 'failed'}`}>
                          exit {res.exitCode}
                        </span>
                        <span className="tile-duration-pill">
                          {res.durationMs}ms
                        </span>
                      </div>
                    </div>

                    <div className="broadcast-tile-terminal">
                      {res.error && !res.output && (
                        <div className="tile-error-banner">
                          <AlertCircle size={13} />
                          <span>{res.error}</span>
                        </div>
                      )}
                      <pre className="tile-output-pre">
                        {res.output || res.error || '(no output produced)'}
                      </pre>
                    </div>

                    <div className="broadcast-tile-footer">
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => handleCopy(`server-${res.serverId}`, res.output || res.error || '')}
                      >
                        {copiedKey === `server-${res.serverId}` ? (
                          <>
                            <Check size={12} className="text-emerald" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      {targetServer && (
                        <button
                          type="button"
                          className="btn btn-primary btn-xs"
                          onClick={() => onOpenTerminal(targetServer)}
                          title={`Open interactive shell on ${targetServer.name}`}
                        >
                          <Terminal size={12} />
                          <span>Open Shell</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div className="broadcast-table-card">
              <table className="broadcast-results-table">
                <thead>
                  <tr>
                    <th>Server</th>
                    <th>Status</th>
                    <th>Exit Code</th>
                    <th>Duration</th>
                    <th>Output Preview</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(lastResponse.results).map((res: ServerExecutionResult) => {
                    const targetServer = servers.find((s) => s.id === res.serverId);
                    return (
                      <tr key={res.serverId} className={res.success ? 'row-success' : 'row-failed'}>
                        <td>
                          <strong>{res.serverName}</strong>
                          <div className="text-muted" style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                            {res.hostname}:{res.port}
                          </div>
                        </td>
                        <td>
                          <span className={`tile-exit-pill ${res.success ? 'success' : 'failed'}`}>
                            {res.success ? 'SUCCESS' : 'FAILED'}
                          </span>
                        </td>
                        <td><code>{res.exitCode}</code></td>
                        <td>{res.durationMs}ms</td>
                        <td className="table-output-cell">
                          <code>{res.output?.slice(0, 120) || res.error || '-'}</code>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              className="btn btn-outline btn-xs"
                              onClick={() => handleCopy(`table-${res.serverId}`, res.output || res.error || '')}
                            >
                              <Copy size={11} />
                            </button>
                            {targetServer && (
                              <button
                                type="button"
                                className="btn btn-primary btn-xs"
                                onClick={() => onOpenTerminal(targetServer)}
                                title="Open Shell"
                              >
                                <Terminal size={11} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. Empty State when no broadcast has run yet */}
      {!lastResponse && (
        <div className="broadcast-empty-state">
          <Radio size={48} className="text-cyan pulse" style={{ marginBottom: '1rem' }} />
          <h3>Ready for Cluster Broadcast</h3>
          <p>
            Select target machines above, choose a command preset or type any custom shell script, then hit{' '}
            <strong>[Broadcast]</strong> to execute simultaneously.
          </p>
        </div>
      )}

      {/* 5. Security Challenge Re-Authentication Modal */}
      {securityModalOpen && pendingCommand && pendingSafety && (
        <SecurityChallengeModal
          isOpen={securityModalOpen}
          command={pendingCommand}
          category={pendingSafety.category}
          reason={pendingSafety.reason}
          targetServers={servers.filter((s) => selectedServerIds.includes(s.id))}
          onClose={() => {
            setSecurityModalOpen(false);
            setPendingCommand(null);
            setPendingSafety(null);
          }}
          onConfirm={async (password: string) => {
            await handleExecute(pendingCommand, password);
          }}
        />
      )}
    </div>
  );
};
