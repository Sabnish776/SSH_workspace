import React, { useState } from 'react';
import {
  Terminal,
  FolderTree,
  Activity,
  Zap,
  MoreVertical,
  Key,
  Lock,
  Edit2,
  Trash2,
  Network,
  Database,
  Layers,
  RefreshCw,
  X
} from 'lucide-react';
import { ServerProfile, ConnectionTestResult } from '../../types';
import { api } from '../../api/client';

interface ServerCardProps {
  server: ServerProfile;
  onConnect: (server: ServerProfile) => Promise<void> | void;
  onOpenServices: (server: ServerProfile) => void;
  onOpenSftp: (server: ServerProfile) => void;
  onOpenMonitoring: (server: ServerProfile) => void;
  onOpenTunnels: (server: ServerProfile) => void;
  onOpenDatabase: (server: ServerProfile) => void;
  onEdit: (server: ServerProfile) => void;
  onDelete: (server: ServerProfile) => void;
  onRemoveTag?: (serverId: number, tag: string) => void;
}

export const ServerCard: React.FC<ServerCardProps> = ({
  server,
  onConnect,
  onOpenServices,
  onOpenSftp,
  onOpenMonitoring,
  onOpenTunnels,
  onOpenDatabase,
  onEdit,
  onDelete,
  onRemoveTag
}) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const handleConnectClick = async () => {
    setConnecting(true);
    try {
      await onConnect(server);
    } finally {
      setConnecting(false);
    }
  };

  const handleTest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.servers.test(server.id);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed'
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="server-card">
      <div className="server-card-header">
        <div className="server-info">
          <h3>
            <span>{server.name}</span>
            {server.groupName && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'var(--accent-indigo)',
                  background: 'rgba(99, 102, 241, 0.15)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid rgba(99, 102, 241, 0.3)'
                }}
              >
                {server.groupName}
              </span>
            )}
          </h3>
          <div className="server-meta-address">
            <span>{server.username}@{server.hostname}:{server.port}</span>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-outline btn-icon"
            style={{ padding: '4px', border: 'none' }}
            onClick={() => setShowMenu(!showMenu)}
          >
            <MoreVertical size={16} />
          </button>

          {showMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                background: '#1e293b',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '4px',
                zIndex: 30,
                minWidth: '120px',
                boxShadow: 'var(--shadow-lg)'
              }}
              onMouseLeave={() => setShowMenu(false)}
            >
              <button
                className="sidebar-item"
                style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left', padding: '6px 10px' }}
                onClick={() => { setShowMenu(false); onEdit(server); }}
              >
                <Edit2 size={13} style={{ marginRight: '6px' }} />
                <span>Edit</span>
              </button>
              <button
                className="sidebar-item"
                style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left', padding: '6px 10px', color: '#ef4444' }}
                onClick={() => { setShowMenu(false); onDelete(server); }}
              >
                <Trash2 size={13} style={{ marginRight: '6px' }} />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {server.authType === 'KEY' ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--accent-cyan)' }}>
              <Key size={13} /> SSH Key
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--accent-amber)' }}>
              <Lock size={13} /> Password
            </span>
          )}
        </div>

        <div className="status-indicator">
          <span className="status-dot"></span>
          <span>ONLINE</span>
        </div>
      </div>

      {server.tags && server.tags.length > 0 && (
        <div className="server-tags-row">
          {server.tags.map((tag) => (
            <span key={tag} className="tag-badge">
              <span>#{tag}</span>
              {onRemoveTag && (
                <button
                  type="button"
                  className="tag-remove-btn"
                  title={`Remove tag #${tag} from ${server.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveTag(server.id, tag);
                  }}
                >
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {testResult && (
        <div
          style={{
            fontSize: '0.75rem',
            padding: '6px 10px',
            borderRadius: '6px',
            background: testResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${testResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: testResult.success ? '#10b981' : '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span>{testResult.message}</span>
          {testResult.latencyMs && <strong>{testResult.latencyMs}ms</strong>}
        </div>
      )}

      <div className="server-card-actions">
        <div className="action-buttons-group">
          <button
            className="btn btn-outline btn-sm"
            title="Test SSH Connectivity"
            disabled={testing}
            onClick={handleTest}
          >
            <Zap size={14} color={testing ? '#94a3b8' : 'var(--accent-amber)'} />
            <span>{testing ? 'Testing...' : 'Test'}</span>
          </button>

          <button
            className="btn btn-outline btn-sm"
            title="SFTP File Browser"
            onClick={() => onOpenSftp(server)}
          >
            <FolderTree size={14} color="var(--accent-cyan)" />
            <span>Files</span>
          </button>

          <button
            className="btn btn-outline btn-sm"
            title="Target Service Discovery & Controls"
            onClick={() => onOpenServices(server)}
          >
            <Layers size={14} color="var(--accent-emerald)" />
            <span>Services</span>
          </button>

          <button
            className="btn btn-outline btn-sm"
            title="Service Tunnels & Port Forwarding"
            onClick={() => onOpenTunnels(server)}
          >
            <Network size={14} color="var(--accent-cyan)" />
            <span>Tunnels</span>
          </button>

          <button
            className="btn btn-outline btn-sm"
            title="Interactive Database & Service Console"
            onClick={() => onOpenDatabase(server)}
          >
            <Database size={14} color="var(--accent-magenta)" />
            <span>Database</span>
          </button>

          <button
            className="btn btn-outline btn-sm"
            title="Server Health & Metrics"
            onClick={() => onOpenMonitoring(server)}
          >
            <Activity size={14} color="var(--accent-indigo)" />
            <span>Stats</span>
          </button>
        </div>

        <button
          className="btn btn-primary btn-sm"
          disabled={connecting}
          onClick={handleConnectClick}
          style={{ minWidth: '105px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          {connecting ? (
            <>
              <RefreshCw size={14} className="spinning" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <Terminal size={14} />
              <span>Connect</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
