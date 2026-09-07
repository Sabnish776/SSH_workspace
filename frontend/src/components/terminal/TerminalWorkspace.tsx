import React from 'react';
import { X, Terminal as TerminalIcon, Plus } from 'lucide-react';
import { TerminalTabItem } from '../../types';
import { TerminalView } from './TerminalView';

interface TerminalWorkspaceProps {
  tabs: TerminalTabItem[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewConnection: () => void;
  onTabStatusChange: (id: string, status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR') => void;
}

export const TerminalWorkspace: React.FC<TerminalWorkspaceProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewConnection,
  onTabStatusChange
}) => {
  if (tabs.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-secondary)',
          gap: '1rem'
        }}
      >
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            padding: '1.5rem',
            borderRadius: '50%',
            color: 'var(--accent-emerald)'
          }}
        >
          <TerminalIcon size={48} />
        </div>
        <h2 style={{ color: 'var(--text-primary)', fontSize: '1.25rem' }}>No Active Terminal Sessions</h2>
        <p style={{ maxWidth: '400px', textAlign: 'center', fontSize: '0.9rem' }}>
          Select any server from your dashboard and click <strong>Connect</strong> to launch an interactive browser terminal.
        </p>
        <button className="btn btn-primary btn-sm" onClick={onNewConnection}>
          <Plus size={16} />
          <span>View Servers</span>
        </button>
      </div>
    );
  }

  return (
    <div className="terminal-workspace">
      <div className="terminal-tabs-bar">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`terminal-tab ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(tab.id)}
            >
              <span
                className="status-dot"
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background:
                    tab.status === 'CONNECTED'
                      ? '#10b981'
                      : tab.status === 'CONNECTING'
                      ? '#f59e0b'
                      : '#ef4444'
                }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tab.serverName}
              </span>
              <button
                className="tab-close-btn"
                title="Close terminal"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {tabs.map((tab) => (
          <TerminalView
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onClose={() => onCloseTab(tab.id)}
            onStatusChange={(status) => onTabStatusChange(tab.id, status)}
          />
        ))}
      </div>
    </div>
  );
};
