import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Play,
  Clock,
  Layers,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  Code
} from 'lucide-react';
import { ServerProfile, DatabaseQueryInput, DatabaseQueryResult } from '../../types';
import { api } from '../../api/client';

interface DatabaseConsoleModalProps {
  server: ServerProfile | null;
  isOpen: boolean;
  onClose: () => void;
  initialServiceType?: 'MYSQL' | 'POSTGRES' | 'REDIS';
  initialPort?: number;
}

export const DatabaseConsoleModal: React.FC<DatabaseConsoleModalProps> = ({
  server,
  isOpen,
  onClose,
  initialServiceType,
  initialPort
}) => {
  const [serviceType, setServiceType] = useState<'MYSQL' | 'POSTGRES' | 'REDIS'>('MYSQL');
  const [databaseName, setDatabaseName] = useState('');
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [port, setPort] = useState(3306);
  const [query, setQuery] = useState('SHOW DATABASES;');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DatabaseQueryResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialServiceType) {
        switchService(initialServiceType);
      }
      if (initialPort) {
        setPort(initialPort);
      }
    }
  }, [isOpen, initialServiceType, initialPort]);

  const switchService = (type: 'MYSQL' | 'POSTGRES' | 'REDIS') => {
    setServiceType(type);
    setResult(null);
    if (type === 'MYSQL') {
      setPort(3306);
      setUsername('root');
      setQuery('SHOW DATABASES;');
    } else if (type === 'POSTGRES') {
      setPort(5432);
      setUsername('postgres');
      setQuery('SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database;');
    } else if (type === 'REDIS') {
      setPort(6379);
      setUsername('');
      setQuery('INFO');
    }
  };

  const setPresetQuery = (q: string) => {
    setQuery(q);
  };

  const handleExecute = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!server || !query.trim()) return;

    setLoading(true);
    setResult(null);
    try {
      const input: DatabaseQueryInput = {
        serviceType,
        query: query.trim(),
        databaseName: databaseName.trim() || undefined,
        username: username.trim() || undefined,
        password: password || undefined,
        port: Number(port)
      };
      const res = await api.database.query(server.id, input);
      setResult(res);
    } catch (err: any) {
      setResult({
        success: false,
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
        error: err.message || 'Database query execution failed'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
  };

  if (!isOpen || !server) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" style={{ maxWidth: '980px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <Database size={20} color="var(--accent-magenta)" />
            <span>Interactive Database & Service Query Console</span>
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--accent-cyan)',
                background: 'rgba(0, 240, 255, 0.1)',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(0, 240, 255, 0.3)',
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

        <div className="modal-body" style={{ gap: '1rem' }}>
          {/* Service Selector pills */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div className="pill-selector" style={{ minWidth: '320px' }}>
              <div
                className={`pill-option ${serviceType === 'MYSQL' ? 'active' : ''}`}
                onClick={() => switchService('MYSQL')}
              >
                MySQL
              </div>
              <div
                className={`pill-option ${serviceType === 'POSTGRES' ? 'active' : ''}`}
                onClick={() => switchService('POSTGRES')}
              >
                PostgreSQL
              </div>
              <div
                className={`pill-option ${serviceType === 'REDIS' ? 'active' : ''}`}
                onClick={() => switchService('REDIS')}
              >
                Redis CLI
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              <span>Press <strong>Ctrl+Enter</strong> to execute</span>
            </div>
          </div>

          {/* Connection Parameters */}
          <div
            style={{
              background: 'rgba(4, 7, 14, 0.7)',
              padding: '0.85rem 1rem',
              borderRadius: '6px',
              border: '1px solid rgba(0, 240, 255, 0.15)',
              display: 'grid',
              gridTemplateColumns: serviceType === 'REDIS' ? '1fr 1fr' : 'repeat(4, 1fr)',
              gap: '0.75rem'
            }}
          >
            <div className="form-group">
              <label>SERVICE PORT</label>
              <input
                type="number"
                className="form-control"
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value) || 0)}
              />
            </div>

            {serviceType !== 'REDIS' && (
              <>
                <div className="form-group">
                  <label>DATABASE</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                    placeholder={serviceType === 'MYSQL' ? 'e.g. mysql / app' : 'e.g. postgres'}
                    value={databaseName}
                    onChange={(e) => setDatabaseName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>USERNAME</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label>{serviceType === 'REDIS' ? 'AUTH PASSWORD (OPTIONAL)' : 'PASSWORD (OPTIONAL)'}</label>
              <input
                type="password"
                className="form-control"
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                placeholder="Leave blank if none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Query Templates / Snippets */}
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: 600, marginBottom: '0.35rem', fontFamily: 'var(--font-mono)' }}>
              QUICK COMMAND TEMPLATES
            </div>
            <div className="preset-pills-row">
              {serviceType === 'MYSQL' && (
                <>
                  <button type="button" className="preset-chip" onClick={() => setPresetQuery('SHOW DATABASES;')}>
                    SHOW DATABASES
                  </button>
                  <button type="button" className="preset-chip" onClick={() => setPresetQuery('SHOW TABLES;')}>
                    SHOW TABLES
                  </button>
                  <button type="button" className="preset-chip" onClick={() => setPresetQuery('SELECT user, host, plugin FROM mysql.user;')}>
                    LIST USERS
                  </button>
                  <button type="button" className="preset-chip" onClick={() => setPresetQuery('SHOW PROCESSLIST;')}>
                    ACTIVE PROCESSES
                  </button>
                  <button type="button" className="preset-chip" onClick={() => setPresetQuery("SHOW STATUS LIKE 'Threads%';")}>
                    THREAD STATUS
                  </button>
                </>
              )}

              {serviceType === 'POSTGRES' && (
                <>
                  <button type="button" className="preset-chip" onClick={() => setPresetQuery('SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database;')}>
                    LIST DATABASES
                  </button>
                  <button type="button" className="preset-chip" onClick={() => setPresetQuery("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")}>
                    LIST TABLES
                  </button>
                  <button type="button" className="preset-chip" onClick={() => setPresetQuery('SELECT version();')}>
                    PG VERSION
                  </button>
                  <button type="button" className="preset-chip" onClick={() => setPresetQuery('SELECT pid, usename, state, query FROM pg_stat_activity;')}>
                    ACTIVITY
                  </button>
                </>
              )}

              {serviceType === 'REDIS' && (
                <>
                  <button type="button" className="preset-chip" onClick={() => setPresetQuery('INFO')}>
                    INFO
                  </button>
                  <button type="button" className="preset-chip" onClick={() => setPresetQuery('PING')}>
                    PING
                  </button>
                  <button type="button" className="preset-chip" onClick={() => setPresetQuery('DBSIZE')}>
                    DBSIZE
                  </button>
                  <button type="button" className="preset-chip" onClick={() => setPresetQuery('KEYS *')}>
                    KEYS *
                  </button>
                  <button type="button" className="preset-chip" onClick={() => setPresetQuery('CLIENT LIST')}>
                    CLIENT LIST
                  </button>
                </>
              )}
            </div>
          </div>

          {/* SQL / Command Editor */}
          <div className="sql-editor-wrapper">
            <textarea
              className="sql-editor"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={serviceType === 'REDIS' ? 'Enter Redis command (e.g. KEYS *, INFO, GET key)' : 'Enter SQL statement (e.g. SELECT * FROM users LIMIT 10;)'}
              rows={3}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleExecute()}
                disabled={loading || !query.trim()}
              >
                <Play size={14} />
                <span>{loading ? 'Executing on Host...' : 'Run Command'}</span>
              </button>
            </div>
          </div>

          {/* Execution Telemetry / Result Header */}
          {result && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.45rem 0.85rem',
                borderRadius: '4px',
                background: result.success ? 'rgba(0, 255, 157, 0.08)' : 'rgba(255, 51, 102, 0.08)',
                border: `1px solid ${result.success ? 'rgba(0, 255, 157, 0.3)' : 'rgba(255, 51, 102, 0.3)'}`,
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {result.success ? (
                  <CheckCircle2 size={14} color="var(--accent-emerald)" />
                ) : (
                  <AlertTriangle size={14} color="#ff3366" />
                )}
                <span style={{ color: result.success ? 'var(--accent-emerald)' : '#ff6699', fontWeight: 600 }}>
                  {result.success ? 'EXECUTION COMPLETED' : 'QUERY EXECUTION FAILED'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
                <span>
                  LATENCY: <strong style={{ color: 'var(--text-primary)' }}>{result.executionTimeMs}ms</strong>
                </span>
                {result.rowCount !== undefined && (
                  <span>
                    ROWS: <strong style={{ color: 'var(--text-primary)' }}>{result.rowCount}</strong>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Result Presentation */}
          {result && (
            <div className="db-query-container">
              {result.error && (
                <div
                  style={{
                    background: '#04070d',
                    border: '1px solid rgba(255, 51, 102, 0.4)',
                    color: '#ff6699',
                    padding: '0.85rem 1rem',
                    borderRadius: '6px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                    whiteSpace: 'pre-wrap',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}
                >
                  {result.error}
                </div>
              )}

              {result.columns && result.columns.length > 0 && result.rows && (
                <div className="db-table-wrapper">
                  <table className="db-table">
                    <thead>
                      <tr>
                        {result.columns.map((col, idx) => (
                          <th key={idx}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.length === 0 ? (
                        <tr>
                          <td colSpan={result.columns.length} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                            (Empty set / 0 rows affected)
                          </td>
                        </tr>
                      ) : (
                        result.rows.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {row.map((val, cIdx) => (
                              <td key={cIdx}>{val !== null && val !== undefined ? String(val) : '<NULL>'}</td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {result.rawOutput && (!result.columns || result.columns.length === 0) && (
                <div
                  style={{
                    background: '#04070d',
                    border: '1px solid rgba(0, 240, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '0.85rem 1rem',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                    color: 'var(--accent-cyan)',
                    whiteSpace: 'pre-wrap',
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}
                >
                  {result.rawOutput}
                </div>
              )}
            </div>
          )}
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
