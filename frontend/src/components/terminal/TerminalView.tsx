import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { RefreshCw, Trash2, Maximize2, Minimize2, ZoomIn, ZoomOut, Zap, CornerDownLeft } from 'lucide-react';
import { TerminalTabItem } from '../../types';

interface TerminalViewProps {
  tab: TerminalTabItem;
  isActive: boolean;
  onClose: () => void;
  onStatusChange: (status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR') => void;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  tab,
  isActive,
  onClose,
  onStatusChange
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const [fontSize, setFontSize] = useState(14);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [status, setStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'>('CONNECTING');
  const [cols, setCols] = useState(120);
  const [rows, setRows] = useState(30);

  // 0ms Instant Command Line Buffer
  const [showCommandBar, setShowCommandBar] = useState(true);
  const [commandText, setCommandText] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const initialCommandSentRef = useRef(false);

  const connectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    setStatus('CONNECTING');
    onStatusChange('CONNECTING');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Connect directly to backend port 8080 in dev mode to bypass Node proxy latency
    const host = window.location.port === '5173'
      ? `${window.location.hostname}:8080`
      : window.location.host;
    const wsUrl = `${protocol}//${host}/ws/terminal/${tab.id}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setStatus('CONNECTED');
      onStatusChange('CONNECTED');

      // Send initial terminal dimensions
      if (termInstanceRef.current) {
        ws.send(JSON.stringify({
          type: 'RESIZE',
          cols: termInstanceRef.current.cols,
          rows: termInstanceRef.current.rows
        }));
      }

      if (tab.initialCommand && !initialCommandSentRef.current) {
        initialCommandSentRef.current = true;
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'INPUT', data: tab.initialCommand + '\n' }));
          }
        }, 500);
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'OUTPUT' && msg.data) {
          termInstanceRef.current?.write(msg.data);
        } else if (msg.type === 'STATUS') {
          if (msg.status === 'CONNECTED') {
            setStatus('CONNECTED');
            onStatusChange('CONNECTED');
            if (tab.initialCommand && !initialCommandSentRef.current) {
              initialCommandSentRef.current = true;
              setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'INPUT', data: tab.initialCommand + '\n' }));
                }
              }, 500);
            }
          } else if (msg.status === 'DISCONNECTED') {
            setStatus('DISCONNECTED');
            onStatusChange('DISCONNECTED');
            termInstanceRef.current?.write('\r\n\x1b[33m[Session disconnected from remote host]\x1b[0m\r\n');
          } else if (msg.status === 'ERROR') {
            setStatus('ERROR');
            onStatusChange('ERROR');
            termInstanceRef.current?.write(`\r\n\x1b[31m[Error: ${msg.message || 'Connection failed'}]\x1b[0m\r\n`);
          }
        }
      } catch {
        // Fallback raw text
        termInstanceRef.current?.write(event.data);
      }
    };

    ws.onerror = () => {
      setStatus('ERROR');
      onStatusChange('ERROR');
    };

    ws.onclose = () => {
      setStatus('DISCONNECTED');
      onStatusChange('DISCONNECTED');
    };
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
      fontSize: fontSize,
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: 'rgba(56, 139, 253, 0.4)',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc'
      },
      convertEol: true,
      scrollback: 5000
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    termInstanceRef.current = term;
    fitAddonRef.current = fitAddon;

    setCols(term.cols);
    setRows(term.rows);

    // Forward terminal keyboard input to backend WebSocket
    term.onData((data) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'INPUT',
          data
        }));
      }
    });

    // Handle Resize
    const handleResize = () => {
      if (fitAddonRef.current && termInstanceRef.current) {
        fitAddonRef.current.fit();
        const newCols = termInstanceRef.current.cols;
        const newRows = termInstanceRef.current.rows;
        setCols(newCols);
        setRows(newRows);

        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: 'RESIZE',
            cols: newCols,
            rows: newRows
          }));
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Connect to backend WebSocket endpoint
    connectWebSocket();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (socketRef.current) {
        socketRef.current.close();
      }
      term.dispose();
    };
  }, [tab.id]);

  // Refit when tab becomes active or font size changes
  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
      }, 50);
    }
  }, [isActive, fontSize]);

  useEffect(() => {
    if (termInstanceRef.current) {
      termInstanceRef.current.options.fontSize = fontSize;
      fitAddonRef.current?.fit();
    }
  }, [fontSize]);

  const handleClear = () => {
    termInstanceRef.current?.clear();
  };

  const handleReconnect = () => {
    termInstanceRef.current?.write('\r\n\x1b[36m[Reconnecting to session...]\x1b[0m\r\n');
    connectWebSocket();
  };

  const handleSendCommand = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commandText.trim()) return;

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'INPUT',
        data: commandText + '\n'
      }));
    }

    setCommandHistory((prev) => [commandText, ...prev.filter((c) => c !== commandText)]);
    setHistoryIndex(-1);
    setCommandText('');
  };

  const handleCommandKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const nextIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
        setHistoryIndex(nextIndex);
        setCommandText(commandHistory[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setCommandText(commandHistory[nextIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommandText('');
      }
    } else if (e.key === 'Escape') {
      termInstanceRef.current?.focus();
    }
  };

  useEffect(() => {
    setTimeout(() => {
      fitAddonRef.current?.fit();
    }, 50);
  }, [showCommandBar]);

  return (
    <div
      style={{
        display: isActive ? 'flex' : 'none',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 1000 : 'auto',
        background: '#0d1117'
      }}
    >
      <div className="terminal-viewport-container">
        <div ref={terminalRef} className="terminal-inner" />
      </div>

      {/* 0ms Keystroke Latency Instant Command Bar */}
      {showCommandBar && (
        <form
          onSubmit={handleSendCommand}
          style={{
            background: '#050913',
            borderTop: '1px solid rgba(0, 240, 255, 0.25)',
            borderBottom: '1px solid rgba(0, 240, 255, 0.15)',
            padding: '0.45rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.3)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              color: 'var(--accent-emerald)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              fontWeight: 700,
              userSelect: 'none',
              letterSpacing: '0.05em'
            }}
            title="Local line buffer mode sends the full command on Enter for 0ms typing lag"
          >
            <Zap size={13} />
            <span>0ms EXEC //</span>
          </div>

          <input
            ref={commandInputRef}
            type="text"
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            onKeyDown={handleCommandKeyDown}
            placeholder="Type command with zero keystroke lag... Press Enter to run, ↑↓ for history (Esc to focus terminal)"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
              fontSize: '0.85rem'
            }}
          />

          <button
            type="submit"
            className="btn btn-primary btn-sm"
            style={{ padding: '3px 10px', fontSize: '0.725rem', gap: '4px' }}
            disabled={!commandText.trim()}
          >
            <CornerDownLeft size={12} />
            <span>Run</span>
          </button>
        </form>
      )}

      <div className="terminal-status-bar">
        <div className="terminal-status-left">
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              className="status-dot"
              style={{
                background:
                  status === 'CONNECTED'
                    ? '#10b981'
                    : status === 'CONNECTING'
                    ? '#f59e0b'
                    : '#ef4444',
                boxShadow:
                  status === 'CONNECTED'
                    ? '0 0 8px #10b981'
                    : status === 'CONNECTING'
                    ? '0 0 8px #f59e0b'
                    : '0 0 8px #ef4444'
              }}
            />
            <strong style={{ color: 'var(--text-primary)' }}>
              {status === 'CONNECTED' ? 'Connected' : status === 'CONNECTING' ? 'Connecting...' : 'Disconnected'}
            </strong>
          </span>

          <span>{tab.serverName} ({tab.serverHostname})</span>
          <span style={{ color: 'var(--text-muted)' }}>{cols}x{rows}</span>

          <button
            onClick={() => setShowCommandBar(!showCommandBar)}
            className={`hud-badge ${showCommandBar ? '' : 'cyber-magenta'}`}
            style={{ cursor: 'pointer', border: 'none', padding: '1px 6px' }}
            title="Toggle Instant Command Bar (0ms keystroke lag bypass)"
          >
            <Zap size={10} />
            <span>0ms BAR: {showCommandBar ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        <div className="terminal-status-right">
          <button
            className="btn btn-outline btn-icon"
            style={{ padding: '3px', border: 'none' }}
            title="Clear buffer"
            onClick={handleClear}
          >
            <Trash2 size={14} />
          </button>

          <button
            className="btn btn-outline btn-icon"
            style={{ padding: '3px', border: 'none' }}
            title="Reconnect"
            onClick={handleReconnect}
          >
            <RefreshCw size={14} />
          </button>

          <button
            className="btn btn-outline btn-icon"
            style={{ padding: '3px', border: 'none' }}
            title="Increase font size"
            onClick={() => setFontSize((f) => Math.min(24, f + 1))}
          >
            <ZoomIn size={14} />
          </button>

          <button
            className="btn btn-outline btn-icon"
            style={{ padding: '3px', border: 'none' }}
            title="Decrease font size"
            onClick={() => setFontSize((f) => Math.max(10, f - 1))}
          >
            <ZoomOut size={14} />
          </button>

          <button
            className="btn btn-outline btn-icon"
            style={{ padding: '3px', border: 'none' }}
            title={isFullscreen ? 'Exit full screen' : 'Full screen'}
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
};
