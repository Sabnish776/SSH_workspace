import React, { useState, useEffect } from 'react';
import { ShieldCheck, Terminal, Network, Command, Monitor, Zap } from 'lucide-react';

interface CyberHUDProps {
  activeTabsCount: number;
  activeTunnelsCount: number;
  scanlinesEnabled: boolean;
  onToggleScanlines: () => void;
  onOpenCommandPalette: () => void;
}

export const CyberHUD: React.FC<CyberHUDProps> = ({
  activeTabsCount,
  activeTunnelsCount,
  scanlinesEnabled,
  onToggleScanlines,
  onOpenCommandPalette
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toTimeString().split(' ')[0] + ' UTC' + (now.getTimezoneOffset() > 0 ? '-' : '+') + Math.abs(now.getTimezoneOffset() / 60));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="cyber-hud-bar">
      <div className="hud-group">
        <div className="hud-badge">
          <span className="hud-dot animate-pulse"></span>
          <span>SYS_STATUS: ARMED</span>
        </div>

        <div className="hud-badge cyber-cyan" title="AES-256-GCM authenticated SSH encryption with strict key validation">
          <ShieldCheck size={12} />
          <span>AES-256-GCM [HARDENED]</span>
        </div>

        <div className="hud-item" style={{ color: 'var(--accent-emerald)' }}>
          <Zap size={12} />
          <span>TCP_NODELAY: ACTIVE</span>
        </div>

        <div className="hud-item">
          <Terminal size={12} color="var(--accent-cyan)" />
          <span>SHELLS: <strong style={{ color: 'var(--text-primary)' }}>{activeTabsCount}</strong></span>
        </div>

        <div className="hud-item">
          <Network size={12} color="var(--accent-magenta)" />
          <span>TUNNELS: <strong style={{ color: 'var(--text-primary)' }}>{activeTunnelsCount}</strong></span>
        </div>
      </div>

      <div className="hud-group">
        <button
          onClick={onOpenCommandPalette}
          className="hud-badge cyber-cyan"
          style={{ cursor: 'pointer', background: 'rgba(0, 240, 255, 0.08)', border: '1px solid rgba(0, 240, 255, 0.3)' }}
          title="Open Command Palette (Ctrl+K or Cmd+K)"
        >
          <Command size={11} />
          <span>Ctrl+K</span>
        </button>

        <button
          onClick={onToggleScanlines}
          className={`hud-badge ${scanlinesEnabled ? '' : 'cyber-magenta'}`}
          style={{ cursor: 'pointer' }}
          title="Toggle CRT Scanline Aesthetics"
        >
          <Monitor size={11} />
          <span>CRT SCANLINES: {scanlinesEnabled ? 'ON' : 'OFF'}</span>
        </button>

        <div className="hud-item" style={{ fontSize: '0.675rem', opacity: 0.8 }}>
          <span>{currentTime}</span>
        </div>
      </div>
    </div>
  );
};
