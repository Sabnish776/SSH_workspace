import React, { useState, useEffect } from 'react';
import {
  X,
  Network,
  Plus,
  Play,
  Square,
  Trash2,
  Copy,
  Check,
  Zap,
  ExternalLink,
  ShieldAlert,
  HelpCircle,
  Database
} from 'lucide-react';
import { ServerProfile, ServiceTunnel, TunnelCreateInput } from '../../types';
import { api } from '../../api/client';

interface TunnelManagerModalProps {
  server: ServerProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onTunnelChanged?: () => void;
  initialPreset?: { name?: string; serviceType?: string; port?: number } | null;
}

interface Preset {
  name: string;
  serviceType: 'MYSQL' | 'POSTGRES' | 'REDIS' | 'MONGODB' | 'HTTP' | 'CUSTOM';
  remotePort: number;
  localPort: number;
  label: string;
}

const PRESETS: Preset[] = [
  { label: 'MySQL (3306)', name: 'MySQL Service', serviceType: 'MYSQL', remotePort: 3306, localPort: 3306 },
  { label: 'PostgreSQL (5432)', name: 'Postgres DB', serviceType: 'POSTGRES', remotePort: 5432, localPort: 5432 },
  { label: 'Redis (6379)', name: 'Redis Cache', serviceType: 'REDIS', remotePort: 6379, localPort: 6379 },
  { label: 'MongoDB (27017)', name: 'MongoDB', serviceType: 'MONGODB', remotePort: 27017, localPort: 27017 },
  { label: 'Web App (8080)', name: 'Web Service', serviceType: 'HTTP', remotePort: 8080, localPort: 8080 },
  { label: 'Docker Daemon (2375)', name: 'Docker API', serviceType: 'CUSTOM', remotePort: 2375, localPort: 2375 }
];

export const TunnelManagerModal: React.FC<TunnelManagerModalProps> = ({
  server,
  isOpen,
  onClose,
  onTunnelChanged,
  initialPreset
}) => {
  const [tunnels, setTunnels] = useState<ServiceTunnel[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Add form state
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('MySQL Service');
  const [serviceType, setServiceType] = useState<string>('MYSQL');
  const [localPort, setLocalPort] = useState(3306);
  const [remoteHost, setRemoteHost] = useState('127.0.0.1');
  const [remotePort, setRemotePort] = useState(3306);
  const [autoStart, setAutoStart] = useState(true);

  const loadTunnels = async () => {
    if (!server) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.tunnels.listForServer(server.id);
      setTunnels(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load tunnels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && server) {
      loadTunnels();
      if (initialPreset) {
        if (initialPreset.name) setName(initialPreset.name);
        if (initialPreset.serviceType) setServiceType(initialPreset.serviceType);
        if (initialPreset.port) {
          setRemotePort(initialPreset.port);
          setLocalPort(initialPreset.port);
        }
        setShowForm(true);
      }
    }
  }, [isOpen, server, initialPreset]);

  const applyPreset = (preset: Preset) => {
    setName(`${server?.name || 'Remote'} ${preset.name}`);
    setServiceType(preset.serviceType);
    setRemotePort(preset.remotePort);
    setLocalPort(preset.localPort);
    setRemoteHost('127.0.0.1');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!server) return;
    setLoading(true);
    setError(null);
    try {
      const input: TunnelCreateInput = {
        name,
        serviceType,
        localPort: Number(localPort),
        remoteHost: remoteHost.trim() || '127.0.0.1',
        remotePort: Number(remotePort),
        autoStart
      };
      await api.tunnels.create(server.id, input);
      setShowForm(false);
      await loadTunnels();
      onTunnelChanged?.();
    } catch (err: any) {
      setError(err.message || 'Failed to create tunnel');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (tunnel: ServiceTunnel) => {
    setActionInProgress(tunnel.id);
    setError(null);
    try {
      if (tunnel.active) {
        await api.tunnels.stop(tunnel.id);
      } else {
        await api.tunnels.start(tunnel.id);
      }
      await loadTunnels();
      onTunnelChanged?.();
    } catch (err: any) {
      setError(`Failed to toggle tunnel: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async (tunnel: ServiceTunnel) => {
    if (!confirm(`Delete tunnel "${tunnel.name}" (Port ${tunnel.localPort} -> ${tunnel.remotePort})?`)) return;
    setActionInProgress(tunnel.id);
    try {
      await api.tunnels.delete(tunnel.id);
      await loadTunnels();
      onTunnelChanged?.();
    } catch (err: any) {
      setError(`Failed to delete tunnel: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!isOpen || !server) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <Network size={20} color="var(--accent-cyan)" />
            <span>Service Tunnels & Port Forwarding</span>
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--accent-emerald)',
                background: 'rgba(0, 255, 157, 0.1)',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(0, 255, 157, 0.3)',
                marginLeft: '8px'
              }}
            >
              {server.name} ({server.hostname})
            </span>
          </h2>
          <button className="btn btn-outline btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div
              style={{
                background: 'rgba(255, 51, 102, 0.15)',
                border: '1px solid rgba(255, 51, 102, 0.4)',
                color: '#ff6699',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                fontSize: '0.825rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontFamily: 'var(--font-mono)'
              }}
            >
              <ShieldAlert size={16} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Forward isolated remote services (MySQL, PostgreSQL, Redis, APIs) securely to <code>127.0.0.1</code> on your local machine over SSH.
            </div>

            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowForm(!showForm)}
            >
              <Plus size={14} />
              <span>{showForm ? 'Cancel New Tunnel' : 'Create Tunnel'}</span>
            </button>
          </div>

          {showForm && (
            <form
              onSubmit={handleCreate}
              style={{
                background: 'rgba(4, 7, 14, 0.8)',
                border: '1px solid var(--accent-cyan)',
                padding: '1.25rem',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-cyan)', marginBottom: '0.4rem', fontFamily: 'var(--font-mono)' }}>
                  QUICK PRESETS
                </div>
                <div className="preset-pills-row">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      className="preset-chip"
                      onClick={() => applyPreset(p)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>TUNNEL NAME</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Production MySQL Tunnel"
                  />
                </div>

                <div className="form-group">
                  <label>SERVICE TYPE</label>
                  <select
                    className="form-control"
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                  >
                    <option value="MYSQL">MySQL Database</option>
                    <option value="POSTGRES">PostgreSQL Database</option>
                    <option value="REDIS">Redis Key-Value Cache</option>
                    <option value="MONGODB">MongoDB Database</option>
                    <option value="HTTP">HTTP Web Application / API</option>
                    <option value="CUSTOM">Custom Port Forward</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>LOCAL PORT (ON YOUR MACHINE)</label>
                  <input
                    type="number"
                    className="form-control"
                    required
                    min={1024}
                    max={65535}
                    value={localPort}
                    onChange={(e) => setLocalPort(parseInt(e.target.value) || 0)}
                  />
                </div>

                <div className="form-group">
                  <label>REMOTE DESTINATION PORT</label>
                  <input
                    type="number"
                    className="form-control"
                    required
                    min={1}
                    max={65535}
                    value={remotePort}
                    onChange={(e) => setRemotePort(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>REMOTE BIND HOST (USUALLY 127.0.0.1)</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={remoteHost}
                    onChange={(e) => setRemoteHost(e.target.value)}
                    placeholder="127.0.0.1"
                  />
                </div>

                <div className="form-group" style={{ justifyContent: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '1.25rem' }}>
                    <input
                      type="checkbox"
                      checked={autoStart}
                      onChange={(e) => setAutoStart(e.target.checked)}
                    />
                    <span>Start tunnel immediately upon creation</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={loading}
                >
                  <Zap size={14} />
                  <span>{loading ? 'Establishing...' : 'Deploy Tunnel'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Tunnels List */}
          <div className="tunnel-grid">
            {loading && tunnels.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                Querying active port forwarding trackers...
              </div>
            ) : tunnels.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem 1.5rem',
                  background: 'rgba(4, 7, 14, 0.4)',
                  borderRadius: '8px',
                  border: '1px dashed var(--border-subtle)',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                <Network size={36} color="var(--text-muted)" style={{ marginBottom: '0.75rem' }} />
                <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No Active Service Tunnels</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  Click "Create Tunnel" above or choose a preset to access remote MySQL, Redis, or Web apps securely.
                </p>
              </div>
            ) : (
              tunnels.map((tunnel) => (
                <div
                  key={tunnel.id}
                  className={`tunnel-card ${tunnel.active ? 'active' : ''}`}
                >
                  <div className="tunnel-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: tunnel.active ? 'var(--accent-emerald)' : 'var(--text-muted)',
                          boxShadow: tunnel.active ? '0 0 10px var(--accent-emerald)' : 'none'
                        }}
                      ></div>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                        {tunnel.name}
                      </span>
                      <span
                        style={{
                          fontSize: '0.675rem',
                          padding: '1px 6px',
                          borderRadius: '3px',
                          background: 'rgba(0, 240, 255, 0.1)',
                          color: 'var(--accent-cyan)',
                          border: '1px solid rgba(0, 240, 255, 0.25)',
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        {tunnel.serviceType}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        className={`btn btn-sm ${tunnel.active ? 'btn-outline' : 'btn-primary'}`}
                        disabled={actionInProgress === tunnel.id}
                        onClick={() => handleToggleActive(tunnel)}
                      >
                        {tunnel.active ? (
                          <>
                            <Square size={13} color="#ff3366" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Play size={13} color="var(--accent-emerald)" />
                            <span>Start Tunnel</span>
                          </>
                        )}
                      </button>

                      <button
                        className="btn btn-outline btn-icon"
                        title="Delete Tunnel"
                        disabled={actionInProgress === tunnel.id}
                        onClick={() => handleDelete(tunnel)}
                        style={{ padding: '0.35rem', color: '#ff3366' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Route information */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <span>LOCAL <strong>127.0.0.1:{tunnel.localPort}</strong></span>
                    <span style={{ color: 'var(--accent-emerald)' }}>➔ SSH TUNNEL ➔</span>
                    <span>REMOTE <strong>{tunnel.remoteHost}:{tunnel.remotePort}</strong></span>
                  </div>

                  {/* One click connection strings */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.2rem' }}>
                    <div className="conn-string-box">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>CLI:</span>
                        <code>{tunnel.cliCommand}</code>
                      </div>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ padding: '2px 6px', fontSize: '0.7rem', border: 'none' }}
                        onClick={() => copyToClipboard(tunnel.cliCommand, `cli-${tunnel.id}`)}
                        title="Copy command to clipboard"
                      >
                        {copiedKey === `cli-${tunnel.id}` ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
                      </button>
                    </div>

                    <div className="conn-string-box">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>URL:</span>
                        <code>{tunnel.connectionString}</code>
                      </div>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ padding: '2px 6px', fontSize: '0.7rem', border: 'none' }}
                        onClick={() => copyToClipboard(tunnel.connectionString, `url-${tunnel.id}`)}
                        title="Copy URI to clipboard"
                      >
                        {copiedKey === `url-${tunnel.id}` ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
