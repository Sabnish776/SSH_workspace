import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Network,
  Database,
  FolderTree,
  Activity,
  Plus,
  Monitor,
  Search,
  Server,
  ArrowRight,
  Layers,
  Radio
} from 'lucide-react';
import { ServerProfile } from '../../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  servers: ServerProfile[];
  onSelectServerConnect: (server: ServerProfile) => void;
  onSelectServerServices: (server: ServerProfile) => void;
  onSelectServerTunnels: (server: ServerProfile) => void;
  onSelectServerDatabase: (server: ServerProfile) => void;
  onSelectServerSftp: (server: ServerProfile) => void;
  onSelectServerMonitoring: (server: ServerProfile) => void;
  onOpenAddServer: () => void;
  onSwitchView: (view: 'dashboard' | 'terminal' | 'broadcast') => void;
  onToggleScanlines: () => void;
}

interface CommandItem {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  servers,
  onSelectServerConnect,
  onSelectServerServices,
  onSelectServerTunnels,
  onSelectServerDatabase,
  onSelectServerSftp,
  onSelectServerMonitoring,
  onOpenAddServer,
  onSwitchView,
  onToggleScanlines
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const items: CommandItem[] = [
    {
      id: 'nav-dashboard',
      category: 'NAVIGATION',
      title: 'Switch to Dashboard View',
      subtitle: 'View server profiles grid',
      icon: <Server size={15} color="var(--accent-emerald)" />,
      action: () => { onSwitchView('dashboard'); onClose(); }
    },
    {
      id: 'nav-broadcast',
      category: 'NAVIGATION',
      title: 'Open Cluster Broadcast Shell',
      subtitle: 'Multi-exec commands across server fleets',
      icon: <Radio size={15} color="var(--accent-cyan)" />,
      action: () => { onSwitchView('broadcast'); onClose(); }
    },
    {
      id: 'nav-terminal',
      category: 'NAVIGATION',
      title: 'Switch to Terminal Workspaces',
      subtitle: 'Jump to active interactive shells',
      icon: <Terminal size={15} color="var(--accent-cyan)" />,
      action: () => { onSwitchView('terminal'); onClose(); }
    },
    {
      id: 'action-add-server',
      category: 'ACTIONS',
      title: 'Add New Server Profile',
      subtitle: 'Configure SSH credentials & ports',
      icon: <Plus size={15} color="var(--accent-amber)" />,
      action: () => { onOpenAddServer(); onClose(); }
    },
    {
      id: 'action-toggle-crt',
      category: 'AESTHETICS',
      title: 'Toggle CRT Scanline Overlay',
      subtitle: 'Cyberpunk display aesthetics',
      icon: <Monitor size={15} color="var(--accent-magenta)" />,
      action: () => { onToggleScanlines(); onClose(); }
    },
    ...servers.flatMap((server) => [
      {
        id: `connect-${server.id}`,
        category: 'TERMINAL',
        title: `Connect Shell: ${server.name}`,
        subtitle: `${server.username}@${server.hostname}:${server.port}`,
        icon: <Terminal size={15} color="var(--accent-emerald)" />,
        action: () => { onSelectServerConnect(server); onClose(); }
      },
      {
        id: `services-${server.id}`,
        category: 'SERVICE DISCOVERY',
        title: `Manage Services: ${server.name}`,
        subtitle: `Discover and manage MySQL, Postgres, Web & Docker services`,
        icon: <Layers size={15} color="var(--accent-emerald)" />,
        action: () => { onSelectServerServices(server); onClose(); }
      },
      {
        id: `tunnel-${server.id}`,
        category: 'SERVICES & TUNNELS',
        title: `Port Forwarding / Tunnels: ${server.name}`,
        subtitle: `Forward remote MySQL, Postgres, Redis to localhost`,
        icon: <Network size={15} color="var(--accent-cyan)" />,
        action: () => { onSelectServerTunnels(server); onClose(); }
      },
      {
        id: `database-${server.id}`,
        category: 'DATABASE CONSOLE',
        title: `Query Console: ${server.name}`,
        subtitle: `Execute SQL / Redis queries directly on ${server.hostname}`,
        icon: <Database size={15} color="var(--accent-magenta)" />,
        action: () => { onSelectServerDatabase(server); onClose(); }
      },
      {
        id: `sftp-${server.id}`,
        category: 'SFTP FILES',
        title: `Browse Files: ${server.name}`,
        subtitle: `Manage files & directories via SFTP`,
        icon: <FolderTree size={15} color="var(--accent-cyan)" />,
        action: () => { onSelectServerSftp(server); onClose(); }
      },
      {
        id: `mon-${server.id}`,
        category: 'METRICS',
        title: `Telemetry & Diagnostics: ${server.name}`,
        subtitle: `CPU, RAM, Disk, Uptime metrics`,
        icon: <Activity size={15} color="var(--accent-indigo)" />,
        action: () => { onSelectServerMonitoring(server); onClose(); }
      }
    ])
  ];

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(query.toLowerCase())) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filteredItems.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="cmd-palette-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '1rem', background: '#050811' }}>
          <Search size={18} color="var(--accent-cyan)" />
          <input
            ref={inputRef}
            type="text"
            className="cmd-palette-input"
            placeholder="Type a command, server name, or service action..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="cmd-palette-list">
          {filteredItems.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
              No matching commands found.
            </div>
          ) : (
            filteredItems.map((item, idx) => (
              <div
                key={item.id}
                className={`cmd-item ${idx === selectedIndex ? 'selected' : ''}`}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {item.icon}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {item.title}
                    </div>
                    {item.subtitle && (
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      background: 'rgba(255, 255, 255, 0.06)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)'
                    }}
                  >
                    {item.category}
                  </span>
                  <ArrowRight size={14} style={{ opacity: idx === selectedIndex ? 1 : 0 }} />
                </div>
              </div>
            ))
          )}
        </div>

        <div
          style={{
            padding: '0.5rem 1rem',
            borderTop: '1px solid rgba(0, 240, 255, 0.1)',
            background: '#04070d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)'
          }}
        >
          <span>Use <strong>↑</strong> <strong>↓</strong> to navigate, <strong>Enter</strong> to select</span>
          <span><strong>Esc</strong> to close</span>
        </div>
      </div>
    </div>
  );
};
