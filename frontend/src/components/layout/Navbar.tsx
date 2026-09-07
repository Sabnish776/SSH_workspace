import React from 'react';
import { Terminal, Plus, LogOut, User as UserIcon, Monitor, Server, Radio } from 'lucide-react';
import { User, TerminalTabItem } from '../../types';

interface NavbarProps {
  user: User | null;
  activeTabs: TerminalTabItem[];
  activeView: 'dashboard' | 'terminal' | 'broadcast';
  setActiveView: (view: 'dashboard' | 'terminal' | 'broadcast') => void;
  onOpenAddServer: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTabs,
  activeView,
  setActiveView,
  onOpenAddServer,
  onLogout
}) => {
  return (
    <nav className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div className="brand" style={{ cursor: 'pointer' }} onClick={() => setActiveView('dashboard')}>
          <div className="brand-icon-wrapper">
            <Terminal size={20} />
          </div>
          <span>SSH Workspace</span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(30, 41, 59, 0.6)', padding: '3px', borderRadius: '8px' }}>
          <button
            className={`btn btn-sm ${activeView === 'dashboard' ? 'btn-primary' : 'btn-outline'}`}
            style={{ border: 'none' }}
            onClick={() => setActiveView('dashboard')}
          >
            <Server size={14} />
            <span>Dashboard</span>
          </button>

          <button
            className={`btn btn-sm ${activeView === 'broadcast' ? 'btn-primary' : 'btn-outline'}`}
            style={{ border: 'none' }}
            onClick={() => setActiveView('broadcast')}
          >
            <Radio size={14} />
            <span>Broadcast</span>
          </button>

          <button
            className={`btn btn-sm ${activeView === 'terminal' ? 'btn-primary' : 'btn-outline'}`}
            style={{ border: 'none', position: 'relative' }}
            onClick={() => setActiveView('terminal')}
          >
            <Terminal size={14} />
            <span>Terminals</span>
            {activeTabs.length > 0 && (
              <span
                style={{
                  background: '#10b981',
                  color: '#ffffff',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: '10px',
                  marginLeft: '4px'
                }}
              >
                {activeTabs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="nav-actions">
        <button className="btn btn-primary btn-sm" onClick={onOpenAddServer}>
          <Plus size={16} />
          <span>Add Server</span>
        </button>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '0.5rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)'
              }}
            >
              <UserIcon size={16} color="var(--accent-cyan)" />
              <span>{user.name}</span>
            </div>

            <button
              className="btn btn-outline btn-icon"
              title="Logout"
              onClick={onLogout}
              style={{ padding: '0.4rem' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
