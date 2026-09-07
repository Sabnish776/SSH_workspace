import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Database,
  Globe,
  Box,
  Radio,
  Terminal,
  Network,
  RefreshCw,
  Play,
  Square,
  RotateCw,
  FileText,
  Search,
  ExternalLink,
  Shield,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  HardDrive,
  Clock,
  ChevronRight,
  Copy,
  Check,
  Edit2
} from 'lucide-react';
import { ServerProfile, DiscoveredService } from '../../types';
import { api } from '../../api/client';

interface ServiceManagerModalProps {
  server: ServerProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onConnectWithCommand: (server: ServerProfile, command: string) => Promise<void> | void;
  onOpenTunnel: (server: ServerProfile, port: number, serviceName: string) => void;
  onOpenDatabaseConsole: (server: ServerProfile, type: 'MYSQL' | 'POSTGRES' | 'REDIS', port?: number) => void;
}

export const ServiceManagerModal: React.FC<ServiceManagerModalProps> = ({
  server,
  isOpen,
  onClose,
  onConnectWithCommand,
  onOpenTunnel,
  onOpenDatabaseConsole
}) => {
  const [services, setServices] = useState<DiscoveredService[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'DATABASE' | 'WEB' | 'CONTAINER' | 'SYSTEM' | 'PORT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Action status state
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Custom CLI command overrides per service ID
  const [customCliCommands, setCustomCliCommands] = useState<Record<string, string>>({});

  // CLI Command Editor modal state
  const [editingCliService, setEditingCliService] = useState<{
    service: DiscoveredService;
    command: string;
  } | null>(null);

  // Track which service CLI is currently connecting/launching
  const [launchingCliId, setLaunchingCliId] = useState<string | null>(null);

  // Logs modal state
  const [activeLogs, setActiveLogs] = useState<{
    service: DiscoveredService;
    lines: string[];
    loading: boolean;
    error?: string;
  } | null>(null);
  const [logFilter, setLogFilter] = useState('');
  const [copiedLogs, setCopiedLogs] = useState(false);

  const fetchServices = async (targetServerId?: number) => {
    const id = targetServerId ?? server?.id;
    if (!id) return;
    setServices([]);
    setLoading(true);
    setError(null);
    try {
      const data = await api.services.list(id);
      setServices(data);
    } catch (err: any) {
      setError(err.message || 'Failed to discover services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && server) {
      setServices([]);
      setLoading(true);
      setError(null);
      setSearchQuery('');
      setActiveCategory('ALL');
      setActionFeedback(null);
      setActiveLogs(null);
      fetchServices(server.id);
    } else if (!isOpen) {
      setServices([]);
      setLoading(false);
      setError(null);
      setActionFeedback(null);
      setActiveLogs(null);
    }
  }, [isOpen, server?.id]);

  const handleAction = async (service: DiscoveredService, action: 'START' | 'STOP' | 'RESTART' | 'RELOAD') => {
    if (!server) return;
    setActionInProgress(service.id + '-' + action);
    setActionFeedback(null);
    try {
      const res = await api.services.action(server.id, {
        serviceId: service.id,
        serviceName: service.name,
        action,
        source: service.source
      });

      setActionFeedback({
        id: service.id,
        success: res.success,
        message: res.message + (res.output ? `: ${res.output.slice(0, 100)}` : '')
      });

      // Quick refresh after short delay for daemon to settle
      setTimeout(() => {
        fetchServices();
      }, 1200);
    } catch (err: any) {
      setActionFeedback({
        id: service.id,
        success: false,
        message: err.message || `Failed to ${action.toLowerCase()} service`
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleFetchLogs = async (service: DiscoveredService) => {
    if (!server) return;
    setActiveLogs({
      service,
      lines: [],
      loading: true
    });
    setLogFilter('');
    setCopiedLogs(false);

    try {
      const res = await api.services.getLogs(server.id, service.name, service.source);
      setActiveLogs({
        service,
        lines: res.lines || [],
        loading: false,
        error: res.error
      });
    } catch (err: any) {
      setActiveLogs({
        service,
        lines: [],
        loading: false,
        error: err.message || 'Failed to fetch logs'
      });
    }
  };

  const handleCopyLogs = () => {
    if (!activeLogs || !activeLogs.lines.length) return;
    navigator.clipboard.writeText(activeLogs.lines.join('\n'));
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const handleLaunchCli = async (service: DiscoveredService, commandToRun?: string) => {
    if (!server) return;
    const cmd = commandToRun || customCliCommands[service.id] || service.cliCommand;
    if (!cmd) return;

    setLaunchingCliId(service.id);
    try {
      await onConnectWithCommand(server, cmd);
      onClose();
    } catch (err: any) {
      alert(`Could not launch CLI: ${err.message}`);
    } finally {
      setLaunchingCliId(null);
    }
  };

  const handleSaveAndLaunchCli = () => {
    if (!editingCliService || !editingCliService.command.trim()) return;
    const cmd = editingCliService.command.trim();
    setCustomCliCommands((prev) => ({
      ...prev,
      [editingCliService.service.id]: cmd
    }));
    const svc = editingCliService.service;
    setEditingCliService(null);
    handleLaunchCli(svc, cmd);
  };

  const getCliPresets = (service: DiscoveredService): string[] => {
    const lower = (service.name + ' ' + service.displayName).toLowerCase();
    const port = service.ports?.[0];

    if (lower.includes('mysql') || lower.includes('mariadb')) {
      return [
        'mysql -u root -p',
        'mariadb -u root -p',
        'mysql -u root -h 127.0.0.1 -P 3306 -p',
        'mysql -u root -e "SHOW DATABASES;"'
      ];
    }
    if (lower.includes('postgres')) {
      return [
        'psql -U postgres',
        'psql -U postgres -d postgres',
        'psql -h 127.0.0.1 -U postgres',
        'psql -U postgres -c "\\l"'
      ];
    }
    if (lower.includes('redis')) {
      return [
        'redis-cli',
        'redis-cli -h 127.0.0.1 -p 6379',
        'redis-cli ping',
        'redis-cli monitor'
      ];
    }
    if (lower.includes('mongo')) {
      return [
        'mongosh',
        'mongosh "mongodb://localhost:27017"',
        'mongo'
      ];
    }
    if (service.source === 'DOCKER' || lower.includes('docker')) {
      return [
        `docker exec -it ${service.name} sh`,
        `docker exec -it ${service.name} bash`,
        `docker logs -f ${service.name}`
      ];
    }
    if (lower.includes('nginx') || lower.includes('apache') || lower.includes('caddy') || service.category === 'WEB') {
      const p = port || 80;
      return [
        `curl -i http://localhost:${p}/`,
        `curl -s http://localhost:${p}/ | head -n 20`,
        `tail -f /var/log/nginx/access.log 2>/dev/null`
      ];
    }
    if (lower.includes('ssh')) {
      return [
        'ssh -V',
        'tail -f /var/log/auth.log 2>/dev/null || tail -f /var/log/secure 2>/dev/null'
      ];
    }
    if (port) {
      return [
        `curl -i http://localhost:${port}/`,
        `nc -zv 127.0.0.1 ${port}`
      ];
    }
    return [
      `ps aux | grep ${service.name}`
    ];
  };

  if (!isOpen || !server) return null;

  // Filter logic
  const filteredServices = services.filter((svc) => {
    // Category filter
    if (activeCategory === 'DATABASE' && svc.category !== 'DATABASE') return false;
    if (activeCategory === 'WEB' && svc.category !== 'WEB') return false;
    if (activeCategory === 'CONTAINER' && svc.source !== 'DOCKER' && svc.category !== 'CONTAINER') return false;
    if (activeCategory === 'SYSTEM' && svc.category !== 'SYSTEM') return false;
    if (activeCategory === 'PORT' && (!svc.ports || svc.ports.length === 0)) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesName = svc.name.toLowerCase().includes(q);
      const matchesDisplay = svc.displayName.toLowerCase().includes(q);
      const matchesPort = svc.ports.some((p) => p.toString().includes(q));
      const matchesPid = svc.pid ? svc.pid.toString().includes(q) : false;
      return matchesName || matchesDisplay || matchesPort || matchesPid;
    }

    return true;
  });

  // Counters
  const countDatabase = services.filter((s) => s.category === 'DATABASE').length;
  const countWeb = services.filter((s) => s.category === 'WEB').length;
  const countContainer = services.filter((s) => s.source === 'DOCKER' || s.category === 'CONTAINER').length;
  const countPorts = services.filter((s) => s.ports && s.ports.length > 0).length;

  const detectedSources = Array.from(new Set(services.map((s) => s.source)));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content large"
        style={{ maxWidth: '1080px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(0, 240, 255, 0.2)' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={22} color="var(--accent-cyan)" />
              <span>Target Service Discovery & Control</span>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--accent-emerald)',
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {server.name} ({server.hostname})
              </span>
            </h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
              LIVE PROBE: Inspect system daemons, listening sockets, databases, web servers, and containerized services.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => fetchServices()}
              disabled={loading}
              title="Rescan Target Machine"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={loading ? 'spinning' : ''} />
              <span>{loading ? 'Probing...' : 'Rescan'}</span>
            </button>

            <button className="btn btn-outline btn-icon" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Telemetry HUD Summary Bar */}
        <div
          style={{
            background: 'rgba(4, 7, 14, 0.85)',
            borderBottom: '1px solid rgba(0, 240, 255, 0.12)',
            padding: '0.75rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', flexWrap: 'wrap' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>INIT/SOURCE: </span>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                {loading ? 'DETECTING...' : detectedSources.length > 0 ? detectedSources.join(' + ') : 'NONE DETECTED'}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>SERVICES DETECTED: </span>
              <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>
                {loading ? 'SCANNING...' : services.length}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>LISTENING SOCKETS: </span>
              <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>
                {loading ? 'SCANNING...' : countPorts}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="status-indicator">
              <span className="status-dot"></span>
              <span style={{ fontSize: '0.75rem' }}>ENGINE ONLINE</span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div
          style={{
            padding: '0.85rem 1.5rem 0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          {/* Category Tabs */}
          <div className="pill-selector" style={{ flexWrap: 'wrap' }}>
            <button
              className={`pill-option ${activeCategory === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveCategory('ALL')}
            >
              All ({loading ? '...' : services.length})
            </button>
            <button
              className={`pill-option ${activeCategory === 'DATABASE' ? 'active' : ''}`}
              onClick={() => setActiveCategory('DATABASE')}
            >
              <Database size={13} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
              Databases ({loading ? '...' : countDatabase})
            </button>
            <button
              className={`pill-option ${activeCategory === 'WEB' ? 'active' : ''}`}
              onClick={() => setActiveCategory('WEB')}
            >
              <Globe size={13} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
              Web & APIs ({loading ? '...' : countWeb})
            </button>
            <button
              className={`pill-option ${activeCategory === 'CONTAINER' ? 'active' : ''}`}
              onClick={() => setActiveCategory('CONTAINER')}
            >
              <Box size={13} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
              Containers ({loading ? '...' : countContainer})
            </button>
            <button
              className={`pill-option ${activeCategory === 'PORT' ? 'active' : ''}`}
              onClick={() => setActiveCategory('PORT')}
            >
              <Radio size={13} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
              Open Ports ({loading ? '...' : countPorts})
            </button>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search
              size={14}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Search service, port, PID..."
              style={{
                paddingLeft: '32px',
                paddingTop: '0.35rem',
                paddingBottom: '0.35rem',
                fontSize: '0.8rem',
                borderRadius: '6px'
              }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Modal Main Body: Service Grid */}
        <div
          className="modal-body"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem 1.5rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}
        >
          {loading ? (
            <div
              style={{
                textAlign: 'center',
                padding: '4rem 1rem',
                color: 'var(--accent-cyan)',
                fontFamily: 'var(--font-mono)'
              }}
            >
              <RefreshCw size={28} className="spinning" style={{ marginBottom: '1rem' }} />
              <div>// EXECUTING SYSTEM & SOCKET DISCOVERY PROBE OVER SSH...</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Connecting to {server.name} ({server.hostname}) & scanning live services...
              </div>
            </div>
          ) : error ? (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '1.25rem',
                color: '#fca5a5',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <AlertTriangle size={24} color="#ef4444" />
              <div>
                <div style={{ fontWeight: 600 }}>Service Probe Error</div>
                <div style={{ fontSize: '0.85rem', marginTop: '2px' }}>{error}</div>
              </div>
            </div>
          ) : filteredServices.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                color: 'var(--text-muted)',
                background: 'rgba(4, 7, 14, 0.5)',
                borderRadius: '8px',
                border: '1px dashed rgba(255, 255, 255, 0.1)'
              }}
            >
              <Layers size={32} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
              <div>No services matching the current filter criteria.</div>
              <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                Try selecting "All ({services.length})" or clearing the search query.
              </div>
            </div>
          ) : (
            filteredServices.map((svc) => {
              const isDatabase = svc.category === 'DATABASE';
              const isWeb = svc.category === 'WEB';
              const isContainer = svc.source === 'DOCKER' || svc.category === 'CONTAINER';

              let iconColor = 'var(--accent-indigo)';
              let CategoryIcon = Layers;

              if (isDatabase) {
                iconColor = 'var(--accent-emerald)';
                CategoryIcon = Database;
              } else if (isWeb) {
                iconColor = 'var(--accent-cyan)';
                CategoryIcon = Globe;
              } else if (isContainer) {
                iconColor = 'var(--accent-magenta)';
                CategoryIcon = Box;
              }

              const isRunning = svc.status === 'RUNNING';
              const isFailed = svc.status === 'FAILED';

              const feedback = actionFeedback?.id === svc.id ? actionFeedback : null;

              return (
                <div
                  key={svc.id}
                  style={{
                    background: 'rgba(9, 14, 26, 0.75)',
                    border: '1px solid rgba(0, 240, 255, 0.16)',
                    borderRadius: '8px',
                    padding: '1rem',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
                  }}
                >
                  {/* Top Bar: Title, Category Icon, Status Pill & Source */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      marginBottom: '0.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          background: `rgba(0, 0, 0, 0.4)`,
                          border: `1px solid ${iconColor}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <CategoryIcon size={18} color={iconColor} />
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                            {svc.displayName}
                          </span>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-muted)',
                              background: 'rgba(255, 255, 255, 0.05)',
                              padding: '1px 6px',
                              borderRadius: '4px'
                            }}
                          >
                            {svc.name}
                          </span>
                        </div>

                        {/* Badges row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 600,
                              color: 'var(--accent-cyan)',
                              background: 'rgba(0, 240, 255, 0.1)',
                              border: '1px solid rgba(0, 240, 255, 0.25)',
                              padding: '1px 6px',
                              borderRadius: '3px'
                            }}
                          >
                            {svc.source}
                          </span>

                          {svc.pid && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--accent-amber)',
                                background: 'rgba(245, 158, 11, 0.1)',
                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                padding: '1px 6px',
                                borderRadius: '3px'
                              }}
                            >
                              PID {svc.pid}
                            </span>
                          )}

                          {svc.ports && svc.ports.length > 0 && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--accent-emerald)',
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                padding: '1px 6px',
                                borderRadius: '3px'
                              }}
                            >
                              PORTS: {svc.ports.join(', ')}
                            </span>
                          )}

                          {svc.memoryUsage && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <Cpu size={11} /> MEM {svc.memoryUsage}
                            </span>
                          )}

                          {svc.uptime && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <Clock size={11} /> {svc.uptime}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          padding: '3px 9px',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          background: isRunning
                            ? 'rgba(16, 185, 129, 0.15)'
                            : isFailed
                            ? 'rgba(239, 68, 68, 0.15)'
                            : 'rgba(148, 163, 184, 0.15)',
                          border: `1px solid ${
                            isRunning
                              ? 'rgba(16, 185, 129, 0.4)'
                              : isFailed
                              ? 'rgba(239, 68, 68, 0.4)'
                              : 'rgba(148, 163, 184, 0.4)'
                          }`,
                          color: isRunning ? '#10b981' : isFailed ? '#ef4444' : '#94a3b8'
                        }}
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: isRunning ? '#10b981' : isFailed ? '#ef4444' : '#94a3b8',
                            boxShadow: isRunning ? '0 0 8px #10b981' : undefined
                          }}
                        />
                        {svc.status}
                      </span>
                    </div>
                  </div>

                  {/* Feedback Message if any */}
                  {feedback && (
                    <div
                      style={{
                        margin: '0.5rem 0',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mono)',
                        background: feedback.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        border: `1px solid ${feedback.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        color: feedback.success ? '#10b981' : '#fca5a5'
                      }}
                    >
                      {feedback.message}
                    </div>
                  )}

                  {/* Action Toolbar */}
                  <div
                    style={{
                      marginTop: '0.75rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem'
                    }}
                  >
                    {/* Workflow Bridges: CLI Shell, Tunnel, Database Console, Logs */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {(() => {
                        const effectiveCli = customCliCommands[svc.id] || svc.cliCommand;
                        return effectiveCli ? (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              background: 'rgba(0, 240, 255, 0.08)',
                              border: '1px solid rgba(0, 240, 255, 0.35)',
                              borderRadius: '6px',
                              overflow: 'hidden'
                            }}
                          >
                            <button
                              className="btn btn-outline btn-sm"
                              style={{
                                border: 'none',
                                color: 'var(--accent-cyan)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 9px',
                                fontSize: '0.75rem',
                                fontFamily: 'var(--font-mono)'
                              }}
                              title={`Click to launch terminal running: ${effectiveCli}`}
                              disabled={launchingCliId === svc.id}
                              onClick={() => handleLaunchCli(svc, effectiveCli)}
                            >
                              {launchingCliId === svc.id ? (
                                <>
                                  <RefreshCw size={13} className="spinning" />
                                  <span>Launching...</span>
                                </>
                              ) : (
                                <>
                                  <Terminal size={13} />
                                  <span>&gt;_ {effectiveCli}</span>
                                </>
                              )}
                            </button>
                            <button
                              className="btn btn-outline btn-sm"
                              style={{
                                border: 'none',
                                borderLeft: '1px solid rgba(0, 240, 255, 0.25)',
                                padding: '4px 7px',
                                color: 'var(--accent-cyan)',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title={`Inspect or customize CLI command (currently: ${effectiveCli})`}
                              onClick={() => setEditingCliService({ service: svc, command: effectiveCli })}
                            >
                              <Edit2 size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn btn-outline btn-sm"
                            style={{
                              borderColor: 'rgba(255, 255, 255, 0.15)',
                              color: 'var(--text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title="Configure custom CLI command for this service"
                            onClick={() => {
                              const presets = getCliPresets(svc);
                              setEditingCliService({
                                service: svc,
                                command: presets[0] || ''
                              });
                            }}
                          >
                            <Terminal size={12} />
                            <span>+ Custom CLI</span>
                          </button>
                        );
                      })()}

                      {svc.ports && svc.ports.length > 0 && (
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ borderColor: 'rgba(16, 185, 129, 0.3)', color: 'var(--accent-emerald)' }}
                          title={`Forward port ${svc.ports[0]} to local machine`}
                          onClick={() => {
                            onOpenTunnel(server, svc.ports[0], svc.displayName);
                            onClose();
                          }}
                        >
                          <Network size={13} />
                          <span>⚡ Forward</span>
                        </button>
                      )}

                      {isDatabase && (
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ borderColor: 'rgba(255, 0, 85, 0.3)', color: 'var(--accent-magenta)' }}
                          title="Open Interactive Database Query Console"
                          onClick={() => {
                            const dbType = svc.name.toLowerCase().includes('postgres')
                              ? 'POSTGRES'
                              : svc.name.toLowerCase().includes('redis')
                              ? 'REDIS'
                              : 'MYSQL';
                            onOpenDatabaseConsole(server, dbType, svc.ports?.[0]);
                            onClose();
                          }}
                        >
                          <Database size={13} />
                          <span>Query</span>
                        </button>
                      )}

                      <button
                        className="btn btn-outline btn-sm"
                        title="View daemon / container logs"
                        onClick={() => handleFetchLogs(svc)}
                      >
                        <FileText size={13} />
                        <span>Logs</span>
                      </button>
                    </div>

                    {/* Lifecycle Management Controls */}
                    {svc.canManage && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {isRunning ? (
                          <>
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                              title="Restart Service"
                              disabled={actionInProgress === svc.id + '-RESTART'}
                              onClick={() => handleAction(svc, 'RESTART')}
                            >
                              <RotateCw
                                size={12}
                                className={actionInProgress === svc.id + '-RESTART' ? 'spinning' : ''}
                              />
                              <span>Restart</span>
                            </button>
                            <button
                              className="btn btn-outline btn-sm"
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.72rem',
                                borderColor: 'rgba(239, 68, 68, 0.3)',
                                color: '#ef4444'
                              }}
                              title="Stop Service"
                              disabled={actionInProgress === svc.id + '-STOP'}
                              onClick={() => handleAction(svc, 'STOP')}
                            >
                              <Square size={12} />
                              <span>Stop</span>
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn btn-outline btn-sm"
                            style={{
                              padding: '3px 8px',
                              fontSize: '0.72rem',
                              borderColor: 'rgba(16, 185, 129, 0.4)',
                              color: '#10b981'
                            }}
                            title="Start Service"
                            disabled={actionInProgress === svc.id + '-START'}
                            onClick={() => handleAction(svc, 'START')}
                          >
                            <Play size={12} />
                            <span>Start</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Live Logs Drawer / Sub-Modal */}
        {activeLogs && (
          <div
            style={{
              borderTop: '1px solid rgba(0, 240, 255, 0.25)',
              background: 'rgba(4, 7, 14, 0.98)',
              padding: '1rem 1.5rem',
              maxHeight: '38vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.6)'
            }}
          >
            {/* Logs Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.5rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={16} color="var(--accent-cyan)" />
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.85rem' }}>
                  // LOGS: {activeLogs.service.displayName} ({activeLogs.service.name})
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    background: 'rgba(255, 255, 255, 0.06)',
                    padding: '1px 6px',
                    borderRadius: '3px'
                  }}
                >
                  SOURCE: {activeLogs.service.source}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="Filter log lines..."
                  className="form-control"
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    width: '160px',
                    borderRadius: '4px'
                  }}
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                />

                <button
                  className="btn btn-outline btn-sm"
                  style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                  onClick={() => handleFetchLogs(activeLogs.service)}
                  disabled={activeLogs.loading}
                  title="Refresh Log Stream"
                >
                  <RefreshCw size={12} className={activeLogs.loading ? 'spinning' : ''} />
                </button>

                <button
                  className="btn btn-outline btn-sm"
                  style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                  onClick={handleCopyLogs}
                  title="Copy Logs"
                >
                  {copiedLogs ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                </button>

                <button
                  className="btn btn-outline btn-icon"
                  style={{ padding: '3px' }}
                  onClick={() => setActiveLogs(null)}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Logs Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                background: '#010409',
                border: '1px solid rgba(0, 240, 255, 0.12)',
                borderRadius: '6px',
                padding: '0.65rem 0.85rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                lineHeight: 1.4,
                color: '#38bdf8'
              }}
            >
              {activeLogs.loading ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                  <RefreshCw size={16} className="spinning" style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                  Retrieving recent log buffer...
                </div>
              ) : activeLogs.error ? (
                <div style={{ color: '#ef4444' }}>{activeLogs.error}</div>
              ) : (
                activeLogs.lines
                  .filter((line) => !logFilter.trim() || line.toLowerCase().includes(logFilter.toLowerCase()))
                  .map((line, idx) => (
                    <div key={idx} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {line}
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* CLI Command Inspector & Editor Sub-Modal */}
        {editingCliService && (
          <div
            className="modal-overlay"
            style={{
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              zIndex: 120
            }}
            onClick={() => setEditingCliService(null)}
          >
            <div
              className="modal-content"
              style={{
                maxWidth: '640px',
                background: 'rgba(8, 12, 22, 0.98)',
                border: '1px solid var(--accent-cyan)',
                boxShadow: '0 0 35px rgba(0, 240, 255, 0.3)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header" style={{ borderBottom: '1px solid rgba(0, 240, 255, 0.2)' }}>
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1rem' }}>
                    <Terminal size={18} color="var(--accent-cyan)" />
                    <span>Configure CLI Launch Command</span>
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                    TARGET: {editingCliService.service.displayName} ({editingCliService.service.name})
                  </div>
                </div>
                <button
                  className="btn btn-outline btn-icon"
                  style={{ padding: '4px' }}
                  onClick={() => setEditingCliService(null)}
                >
                  <X size={15} />
                </button>
              </div>

              <div className="modal-body" style={{ gap: '1rem', padding: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  This command will be executed automatically in an interactive SSH terminal tab on{' '}
                  <strong style={{ color: 'var(--accent-cyan)' }}>{server.name}</strong>. Inspect or adapt flags, paths, or authentication parameters:
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                    CLI COMMAND TO EXECUTE
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="form-control"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.88rem',
                        padding: '0.6rem 0.8rem',
                        borderColor: 'rgba(0, 240, 255, 0.4)',
                        color: 'var(--accent-cyan)',
                        background: 'rgba(2, 6, 15, 0.9)'
                      }}
                      autoFocus
                      value={editingCliService.command}
                      onChange={(e) =>
                        setEditingCliService({
                          ...editingCliService,
                          command: e.target.value
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveAndLaunchCli();
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Common Presets */}
                <div>
                  <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    RECOMMENDED PRESETS & TEMPLATES (CLICK TO INSERT):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {getCliPresets(editingCliService.service).map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{
                          fontSize: '0.72rem',
                          fontFamily: 'var(--font-mono)',
                          padding: '3px 8px',
                          borderColor: 'rgba(255, 255, 255, 0.15)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer'
                        }}
                        onClick={() =>
                          setEditingCliService({
                            ...editingCliService,
                            command: preset
                          })
                        }
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dialog Footer Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '8px',
                    marginTop: '0.5rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)'
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setEditingCliService(null)}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10b981' }}
                    onClick={() => {
                      if (editingCliService.command.trim()) {
                        setCustomCliCommands((prev) => ({
                          ...prev,
                          [editingCliService.service.id]: editingCliService.command.trim()
                        }));
                      }
                      setEditingCliService(null);
                    }}
                  >
                    Save for Session
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={handleSaveAndLaunchCli}
                  >
                    <Terminal size={14} />
                    <span>Launch in Terminal</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
