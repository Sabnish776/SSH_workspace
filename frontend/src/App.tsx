import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { CyberHUD } from './components/layout/CyberHUD';
import { CommandPalette } from './components/layout/CommandPalette';
import { ServerCard } from './components/dashboard/ServerCard';
import { ServerModal } from './components/dashboard/ServerModal';
import { TerminalWorkspace } from './components/terminal/TerminalWorkspace';
import { FileManagerModal } from './components/sftp/FileManagerModal';
import { MonitoringModal } from './components/monitoring/MonitoringModal';
import { TunnelManagerModal } from './components/tunnels/TunnelManagerModal';
import { DatabaseConsoleModal } from './components/database/DatabaseConsoleModal';
import { ServiceManagerModal } from './components/services/ServiceManagerModal';
import { AuthModal } from './components/auth/AuthModal';
import { api, authStorage } from './api/client';
import { User, ServerProfile, TerminalTabItem, ServerCreateInput } from './types';
import { Search, Server, Plus, Layers, Tag as TagIcon, Trash2 } from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(authStorage.getUser());
  const [servers, setServers] = useState<ServerProfile[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  // Filtering & View state
  const [activeView, setActiveView] = useState<'dashboard' | 'terminal'>('dashboard');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Terminal Tabs
  const [terminalTabs, setTerminalTabs] = useState<TerminalTabItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Modals
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [editServer, setEditServer] = useState<ServerProfile | null>(null);
  const [sftpServer, setSftpServer] = useState<ServerProfile | null>(null);
  const [monitorServer, setMonitorServer] = useState<ServerProfile | null>(null);
  const [tunnelServer, setTunnelServer] = useState<ServerProfile | null>(null);
  const [tunnelPreset, setTunnelPreset] = useState<{ name?: string; serviceType?: string; port?: number } | null>(null);
  const [databaseServer, setDatabaseServer] = useState<ServerProfile | null>(null);
  const [databasePreset, setDatabasePreset] = useState<{ type: 'MYSQL' | 'POSTGRES' | 'REDIS'; port?: number } | null>(null);
  const [serviceServer, setServiceServer] = useState<ServerProfile | null>(null);

  // Cyber Aesthetics & Shortcuts
  const [scanlinesEnabled, setScanlinesEnabled] = useState<boolean>(() => {
    return localStorage.getItem('scanlines') !== 'false';
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [activeTunnelsCount, setActiveTunnelsCount] = useState<number>(0);

  const fetchServers = async () => {
    if (!user) return;
    try {
      const [serverList, groupList, tagList] = await Promise.all([
        api.servers.list(),
        api.servers.getGroups(),
        api.servers.getTags()
      ]);
      setServers(serverList);
      setGroups(groupList);
      setTags(tagList);
    } catch (err) {
      console.error('Failed to load servers', err);
    }
  };

  const fetchTunnelsCount = async () => {
    if (!user) return;
    try {
      const all = await api.tunnels.listAll();
      setActiveTunnelsCount(all.filter((t) => t.active).length);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    if (user) {
      api.auth.me().catch(() => {
        authStorage.clearToken();
        setUser(null);
      });
      fetchServers();
      fetchTunnelsCount();
    }
  }, [user]);

  useEffect(() => {
    if (activeView === 'terminal') {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 50);
    }
  }, [activeView]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleScanlines = () => {
    setScanlinesEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('scanlines', String(next));
      return next;
    });
  };

  const handleLogout = async () => {
    await api.auth.logout();
    setUser(null);
    setServers([]);
    setTerminalTabs([]);
    setActiveTabId(null);
  };

  const handleConnect = async (server: ServerProfile) => {
    try {
      const res = await api.servers.connect(server.id);
      const newTab: TerminalTabItem = {
        id: res.sessionId,
        serverId: server.id,
        serverName: server.name,
        serverHostname: server.hostname,
        status: 'CONNECTING'
      };

      setTerminalTabs((prev) => [...prev, newTab]);
      setActiveTabId(res.sessionId);
      setActiveView('terminal');
    } catch (err: any) {
      alert(`Could not connect to ${server.name}: ${err.message}`);
    }
  };

  const handleConnectWithCommand = async (server: ServerProfile, command: string) => {
    try {
      const res = await api.servers.connect(server.id);
      const newTab: TerminalTabItem = {
        id: res.sessionId,
        serverId: server.id,
        serverName: server.name,
        serverHostname: server.hostname,
        status: 'CONNECTING',
        initialCommand: command
      };

      setTerminalTabs((prev) => [...prev, newTab]);
      setActiveTabId(res.sessionId);
      setActiveView('terminal');
    } catch (err: any) {
      alert(`Could not connect to ${server.name}: ${err.message}`);
    }
  };

  const handleOpenTunnelFromService = (server: ServerProfile, port: number, serviceName: string) => {
    setServiceServer(null);
    setTunnelPreset({ name: serviceName, port });
    setTunnelServer(server);
  };

  const handleOpenDatabaseFromService = (server: ServerProfile, type: 'MYSQL' | 'POSTGRES' | 'REDIS', port?: number) => {
    setServiceServer(null);
    setDatabasePreset({ type, port });
    setDatabaseServer(server);
  };

  const handleCloseTab = (id: string) => {
    api.sessions.terminate(id).catch(() => {});
    setTerminalTabs((prev) => {
      const remaining = prev.filter((t) => t.id !== id);
      if (activeTabId === id) {
        setActiveTabId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
      }
      return remaining;
    });
  };

  const handleTabStatusChange = (id: string, status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR') => {
    setTerminalTabs((prev) =>
      prev.map((tab) => (tab.id === id ? { ...tab, status } : tab))
    );
  };

  const handleSaveServer = async (input: ServerCreateInput) => {
    if (editServer) {
      await api.servers.update(editServer.id, input);
    } else {
      await api.servers.create(input);
    }
    fetchServers();
  };

  const handleDeleteServer = async (server: ServerProfile) => {
    if (!confirm(`Are you sure you want to delete "${server.name}"? Active sessions will be terminated.`)) return;
    try {
      await api.servers.delete(server.id);
      fetchServers();
      // Remove any open terminal tabs for this server
      setTerminalTabs((prev) => prev.filter((t) => t.serverId !== server.id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleDeleteGlobalTag = async (tagName: string) => {
    if (!confirm(`Delete tag "#${tagName}" globally?\n\nThis will remove this tag from all servers currently tagged with it.`)) {
      return;
    }
    try {
      await api.servers.deleteTag(tagName);
      if (selectedTag === tagName) {
        setSelectedTag(null);
      }
      fetchServers();
    } catch (err: any) {
      alert(`Failed to delete tag: ${err.message}`);
    }
  };

  const handleRemoveTagFromServer = async (serverId: number, tagName: string) => {
    try {
      await api.servers.removeTag(serverId, tagName);
      fetchServers();
    } catch (err: any) {
      alert(`Failed to remove tag: ${err.message}`);
    }
  };

  // Filtered servers
  const filteredServers = servers.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.username.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGroup = !selectedGroup || s.groupName === selectedGroup;
    const matchesTag = !selectedTag || (s.tags && s.tags.includes(selectedTag));

    return matchesSearch && matchesGroup && matchesTag;
  });

  return (
    <div className="app-container">
      {scanlinesEnabled && <div className="scanlines-overlay" />}
      {!user && <AuthModal onSuccess={(u) => setUser(u)} />}

      <CyberHUD
        activeTabsCount={terminalTabs.length}
        activeTunnelsCount={activeTunnelsCount}
        scanlinesEnabled={scanlinesEnabled}
        onToggleScanlines={toggleScanlines}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />

      <Navbar
        user={user}
        activeTabs={terminalTabs}
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenAddServer={() => { setEditServer(null); setServerModalOpen(true); }}
        onLogout={handleLogout}
      />

      <div className="main-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div>
            <div className="sidebar-title">Server Groups</div>
            <div
              className={`sidebar-item ${selectedGroup === null ? 'active' : ''}`}
              onClick={() => setSelectedGroup(null)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={14} />
                <span>All Servers</span>
              </div>
              <span className="badge-count">{servers.length}</span>
            </div>

            {groups.map((grp) => {
              const count = servers.filter((s) => s.groupName === grp).length;
              return (
                <div
                  key={grp}
                  className={`sidebar-item ${selectedGroup === grp ? 'active' : ''}`}
                  onClick={() => setSelectedGroup(grp)}
                >
                  <span>{grp}</span>
                  <span className="badge-count">{count}</span>
                </div>
              );
            })}
          </div>

          {tags.length > 0 && (
            <div>
              <div className="sidebar-title">Tags</div>
              <div
                className={`sidebar-item ${selectedTag === null ? 'active' : ''}`}
                onClick={() => setSelectedTag(null)}
              >
                <span>All Tags</span>
              </div>
              {tags.map((t) => (
                <div
                  key={t}
                  className={`sidebar-item sidebar-tag-item ${selectedTag === t ? 'active' : ''}`}
                  onClick={() => setSelectedTag(t === selectedTag ? null : t)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <TagIcon size={12} />
                    <span>#{t}</span>
                  </div>
                  <button
                    type="button"
                    className="sidebar-tag-delete-btn"
                    title={`Delete tag #${t} globally (removes from all servers)`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteGlobalTag(t);
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Content Area */}
        <main className="content-area">
          <div
            className="dashboard-container"
            style={{ display: activeView === 'dashboard' ? 'block' : 'none' }}
          >
            <div className="dashboard-header">
              <div className="dashboard-headline">
                <h1>
                  <Server size={22} color="var(--accent-emerald)" />
                  <span>Server Workspace</span>
                </h1>
                <p>Manage remote SSH machines, interactive shells, services, tunnels & SQL consoles.</p>
              </div>

              <button
                className="btn btn-primary"
                onClick={() => { setEditServer(null); setServerModalOpen(true); }}
              >
                <Plus size={16} />
                <span>Add Server Profile</span>
              </button>
            </div>

            <div className="search-filter-bar">
              <div className="search-input-wrapper">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search by server name, host IP, or user... (Ctrl+K for Command Palette)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {filteredServers.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '4rem 2rem',
                  background: 'var(--bg-card)',
                  borderRadius: '16px',
                  border: '1px dashed var(--border-subtle)'
                }}
              >
                <Server size={44} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Servers Found</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  {searchQuery ? 'No servers match your search criteria.' : 'Get started by adding your first remote SSH server.'}
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => { setEditServer(null); setServerModalOpen(true); }}
                >
                  <Plus size={16} />
                  <span>Add Server Profile</span>
                </button>
              </div>
            ) : (
              <div className="server-grid">
                {filteredServers.map((server) => (
                  <ServerCard
                    key={server.id}
                    server={server}
                    onConnect={handleConnect}
                    onOpenServices={(s) => setServiceServer(s)}
                    onOpenSftp={(s) => setSftpServer(s)}
                    onOpenMonitoring={(s) => setMonitorServer(s)}
                    onOpenTunnels={(s) => setTunnelServer(s)}
                    onOpenDatabase={(s) => setDatabaseServer(s)}
                    onEdit={(s) => { setEditServer(s); setServerModalOpen(true); }}
                    onDelete={handleDeleteServer}
                    onRemoveTag={handleRemoveTagFromServer}
                  />
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              display: activeView === 'terminal' ? 'flex' : 'none',
              flex: 1,
              flexDirection: 'column',
              height: '100%',
              width: '100%',
              overflow: 'hidden'
            }}
          >
            <TerminalWorkspace
              tabs={terminalTabs}
              activeTabId={activeTabId}
              onSelectTab={(id) => setActiveTabId(id)}
              onCloseTab={handleCloseTab}
              onNewConnection={() => setActiveView('dashboard')}
              onTabStatusChange={handleTabStatusChange}
            />
          </div>
        </main>
      </div>

      {/* Modals */}
      <ServerModal
        isOpen={serverModalOpen}
        onClose={() => { setServerModalOpen(false); setEditServer(null); }}
        onSubmit={handleSaveServer}
        editServer={editServer}
      />

      <FileManagerModal
        server={sftpServer}
        isOpen={!!sftpServer}
        onClose={() => setSftpServer(null)}
      />

      <MonitoringModal
        server={monitorServer}
        isOpen={!!monitorServer}
        onClose={() => setMonitorServer(null)}
      />

      <TunnelManagerModal
        server={tunnelServer}
        isOpen={!!tunnelServer}
        onClose={() => { setTunnelServer(null); setTunnelPreset(null); }}
        onTunnelChanged={fetchTunnelsCount}
        initialPreset={tunnelPreset}
      />

      <DatabaseConsoleModal
        server={databaseServer}
        isOpen={!!databaseServer}
        onClose={() => { setDatabaseServer(null); setDatabasePreset(null); }}
        initialServiceType={databasePreset?.type}
        initialPort={databasePreset?.port}
      />

      <ServiceManagerModal
        key={serviceServer ? `svc-modal-${serviceServer.id}` : 'svc-modal-none'}
        server={serviceServer}
        isOpen={!!serviceServer}
        onClose={() => setServiceServer(null)}
        onConnectWithCommand={handleConnectWithCommand}
        onOpenTunnel={handleOpenTunnelFromService}
        onOpenDatabaseConsole={handleOpenDatabaseFromService}
      />

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        servers={servers}
        onSelectServerConnect={handleConnect}
        onSelectServerServices={(s) => setServiceServer(s)}
        onSelectServerTunnels={(s) => setTunnelServer(s)}
        onSelectServerDatabase={(s) => setDatabaseServer(s)}
        onSelectServerSftp={(s) => setSftpServer(s)}
        onSelectServerMonitoring={(s) => setMonitorServer(s)}
        onOpenAddServer={() => { setEditServer(null); setServerModalOpen(true); }}
        onSwitchView={(v) => setActiveView(v)}
        onToggleScanlines={toggleScanlines}
      />
    </div>
  );
};
