import React, { useState, useEffect } from 'react';
import { X, Server, Key, Lock, Zap } from 'lucide-react';
import { ServerProfile, ServerCreateInput } from '../../types';

interface ServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ServerCreateInput) => Promise<void>;
  editServer?: ServerProfile | null;
}

export const ServerModal: React.FC<ServerModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editServer
}) => {
  const [name, setName] = useState('');
  const [hostname, setHostname] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('');
  const [authType, setAuthType] = useState<'PASSWORD' | 'KEY'>('PASSWORD');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [groupName, setGroupName] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editServer) {
      setName(editServer.name);
      setHostname(editServer.hostname);
      setPort(editServer.port);
      setUsername(editServer.username);
      setAuthType(editServer.authType);
      setGroupName(editServer.groupName || '');
      setTagsInput(editServer.tags ? editServer.tags.join(', ') : '');
      setPassword('');
      setPrivateKey('');
      setPassphrase('');
    } else {
      setName('');
      setHostname('');
      setPort(22);
      setUsername('');
      setAuthType('PASSWORD');
      setPassword('');
      setPrivateKey('');
      setPassphrase('');
      setGroupName('');
      setTagsInput('');
    }
    setError(null);
  }, [editServer, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError('Please enter a server name');
    if (!hostname.trim()) return setError('Please enter hostname or IP address');
    if (!username.trim()) return setError('Please enter SSH username');

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        hostname: hostname.trim(),
        port: Number(port) || 22,
        username: username.trim(),
        authType,
        password: password ? password : undefined,
        privateKey: privateKey ? privateKey : undefined,
        passphrase: passphrase ? passphrase : undefined,
        groupName: groupName.trim() || undefined,
        tags
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save server profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <Server size={20} color="var(--accent-emerald)" />
            <span>{editServer ? 'Edit Server Profile' : 'Add New SSH Server'}</span>
          </h2>
          <button className="btn btn-outline btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
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

            <div className="form-row">
              <div className="form-group">
                <label>Display Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Production Web"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Group / Category</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Production, Dev"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row" style={{ gridTemplateColumns: '3fr 1fr' }}>
              <div className="form-group">
                <label>Hostname or IP Address *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 192.168.1.50 or server.company.com"
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>SSH Port</label>
                <input
                  type="number"
                  className="form-control"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  min={1}
                  max={65535}
                />
              </div>
            </div>

            <div className="form-group">
              <label>SSH Username *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. root, ubuntu, demo"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Authentication Method</label>
              <div className="pill-selector">
                <div
                  className={`pill-option ${authType === 'PASSWORD' ? 'active' : ''}`}
                  onClick={() => setAuthType('PASSWORD')}
                >
                  <Lock size={13} style={{ display: 'inline', marginRight: '4px' }} />
                  Password
                </div>
                <div
                  className={`pill-option ${authType === 'KEY' ? 'active' : ''}`}
                  onClick={() => setAuthType('KEY')}
                >
                  <Key size={13} style={{ display: 'inline', marginRight: '4px' }} />
                  SSH Private Key
                </div>
              </div>
            </div>

            {authType === 'PASSWORD' ? (
              <div className="form-group">
                <label>SSH Password {editServer && '(leave blank to keep unchanged)'}</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Enter password (stored encrypted at rest)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label>Private Key (PEM or OpenSSH format)</label>
                  <textarea
                    className="form-control"
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Key Passphrase (if encrypted)</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Passphrase"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label>Tags (comma separated)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. web, docker, redis"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : editServer ? 'Update Server' : 'Save Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
