import React, { useEffect, useState } from 'react';
import { Activity, X, RefreshCw, Cpu, HardDrive, Clock, Server } from 'lucide-react';
import { ServerProfile, ServerMetrics } from '../../types';
import { api } from '../../api/client';

interface MonitoringModalProps {
  server: ServerProfile | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MonitoringModal: React.FC<MonitoringModalProps> = ({
  server,
  isOpen,
  onClose
}) => {
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    if (!server) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.monitoring.get(server.id);
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch server metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && server) {
      fetchMetrics();
    }
  }, [isOpen, server]);

  if (!isOpen || !server) return null;

  const parsePercent = (val?: string) => {
    if (!val) return 0;
    const match = val.match(/(\d+)%/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const memPercent = parsePercent(metrics?.memoryUsage);
  const diskPercent = parsePercent(metrics?.diskUsage);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <Activity size={20} color="var(--accent-indigo)" />
            <span>Health & Diagnostics: {server.name}</span>
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              className="btn btn-outline btn-icon"
              title="Refresh metrics"
              onClick={fetchMetrics}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button className="btn btn-outline btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '0.85rem'
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <Server size={16} />
            <span>Target: <strong>{server.username}@{server.hostname}:{server.port}</strong></span>
          </div>

          <div className="metrics-grid">
            {/* CPU & Load */}
            <div className="metric-card">
              <div className="metric-card-header">
                <span>CPU & LOAD</span>
                <Cpu size={16} color="var(--accent-emerald)" />
              </div>
              <div className="metric-value">{metrics?.cpuUsage || '...'}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                1m, 5m, 15m: <strong>{metrics?.loadAverage || '-'}</strong>
              </div>
            </div>

            {/* Memory Usage */}
            <div className="metric-card">
              <div className="metric-card-header">
                <span>MEMORY USAGE</span>
                <Activity size={16} color="var(--accent-cyan)" />
              </div>
              <div className="metric-value">{metrics?.memoryUsage || '...'}</div>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${memPercent}%` }} />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {metrics?.memoryDetails || '-'}
              </div>
            </div>

            {/* Disk Usage */}
            <div className="metric-card">
              <div className="metric-card-header">
                <span>ROOT DISK</span>
                <HardDrive size={16} color="var(--accent-amber)" />
              </div>
              <div className="metric-value">{metrics?.diskUsage || '...'}</div>
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${diskPercent}%`,
                    background: diskPercent > 80 ? 'var(--accent-rose)' : 'linear-gradient(90deg, #f59e0b, #ef4444)'
                  }}
                />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {metrics?.diskDetails || '-'}
              </div>
            </div>

            {/* Uptime */}
            <div className="metric-card">
              <div className="metric-card-header">
                <span>SYSTEM UPTIME</span>
                <Clock size={16} color="var(--accent-indigo)" />
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.4rem' }}>
                {metrics?.uptime || '...'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                OS: {metrics?.osName || '-'}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
