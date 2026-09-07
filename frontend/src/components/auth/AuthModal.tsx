import React, { useState } from 'react';
import { Terminal, Lock, Mail, User as UserIcon, Zap } from 'lucide-react';
import { api } from '../../api/client';
import { User } from '../../types';

interface AuthModalProps {
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let res;
      if (isRegister) {
        if (!name.trim()) throw new Error('Name is required');
        res = await api.auth.register(name.trim(), email.trim(), password);
      } else {
        res = await api.auth.login(email.trim(), password);
      }
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setIsRegister(false);
    setEmail('admin@example.com');
    setPassword('password123');
    setError(null);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '440px', width: '100%' }}>
        <div style={{ padding: '2.25rem 2rem 1.25rem 2rem', textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '0.75rem',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(0, 255, 157, 0.15), rgba(0, 240, 255, 0.15))',
              border: '1px solid rgba(0, 255, 157, 0.3)',
              color: 'var(--accent-emerald)',
              marginBottom: '1rem',
              boxShadow: '0 0 20px rgba(0, 255, 157, 0.2)'
            }}
          >
            <Terminal size={32} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            SSH Workspace Manager
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            {isRegister ? 'Create an account to manage your SSH servers' : 'Authenticate to access your SSH workspace'}
          </p>
        </div>

        <div style={{ padding: '0 2rem' }}>
          <div className="pill-selector" style={{ width: '100%' }}>
            <div
              className={`pill-option ${!isRegister ? 'active' : ''}`}
              onClick={() => { setIsRegister(false); setError(null); }}
            >
              Sign In
            </div>
            <div
              className={`pill-option ${isRegister ? 'active' : ''}`}
              onClick={() => { setIsRegister(true); setError(null); }}
            >
              Register
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem 2rem 2.25rem 2rem', width: '100%' }}>
          {error && (
            <div
              style={{
                background: 'rgba(255, 51, 102, 0.15)',
                border: '1px solid rgba(255, 51, 102, 0.35)',
                color: '#ff6699',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '0.825rem',
                marginBottom: '1.25rem',
                fontFamily: 'var(--font-mono)'
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', width: '100%' }}>
            {isRegister && (
              <div className="form-group" style={{ width: '100%' }}>
                <label>FULL NAME</label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <UserIcon
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                      pointerEvents: 'none'
                    }}
                  />
                  <input
                    type="text"
                    className="form-control"
                    style={{ width: '100%', paddingLeft: '38px' }}
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-group" style={{ width: '100%' }}>
              <label>EMAIL ADDRESS</label>
              <div style={{ position: 'relative', width: '100%' }}>
                <Mail
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none'
                  }}
                />
                <input
                  type="email"
                  className="form-control"
                  style={{ width: '100%', paddingLeft: '38px' }}
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ width: '100%' }}>
              <label>PASSWORD</label>
              <div style={{ position: 'relative', width: '100%' }}>
                <Lock
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none'
                  }}
                />
                <input
                  type="password"
                  className="form-control"
                  style={{ width: '100%', paddingLeft: '38px' }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem', justifyContent: 'center' }}
              disabled={loading}
            >
              {loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}
            </button>

            {!isRegister && (
              <div
                onClick={fillDemoCredentials}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  color: 'var(--accent-cyan)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '4px',
                  background: 'rgba(0, 240, 255, 0.05)',
                  border: '1px dashed rgba(0, 240, 255, 0.25)',
                  marginTop: '0.25rem',
                  transition: 'all 0.15s',
                  fontFamily: 'var(--font-mono)'
                }}
                title="Click to auto-fill default demo credentials"
              >
                <Zap size={12} />
                <span>Auto-fill Demo Credentials</span>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
