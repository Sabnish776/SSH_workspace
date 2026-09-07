import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Lock, Eye, EyeOff, X, AlertTriangle, Terminal, Server } from 'lucide-react';
import { ServerProfile } from '../../types';

interface SecurityChallengeModalProps {
  isOpen: boolean;
  command: string;
  category: string;
  reason?: string;
  targetServers: ServerProfile[];
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
}

export const SecurityChallengeModal: React.FC<SecurityChallengeModalProps> = ({
  isOpen,
  command,
  category,
  reason,
  targetServers,
  onClose,
  onConfirm
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(null);
      setSubmitting(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password) {
      setError('Please enter your workspace account password.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(password);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authorization failed. Invalid account password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={submitting ? undefined : onClose}>
      <div
        className="modal-content security-challenge-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="security-modal-header">
          <div className="security-header-left">
            <div className="security-hazard-icon-wrapper">
              <ShieldAlert size={24} color="#ff3366" />
            </div>
            <div>
              <h3>SECURITY CHALLENGE: HIGH-RISK OPERATION</h3>
              <p>Re-authentication required to authorize destructive fleet command</p>
            </div>
          </div>
          {!submitting && (
            <button
              type="button"
              className="btn btn-outline btn-icon"
              style={{ padding: '4px', border: 'none' }}
              onClick={onClose}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="security-modal-body">
          {/* Risk Banner */}
          <div className="security-hazard-banner">
            <div className="hazard-category-tag">
              <AlertTriangle size={13} />
              <span>HAZARD CATEGORY: {category}</span>
            </div>
            {reason && <p className="hazard-reason">{reason}</p>}
          </div>

          {/* Command Terminal Display */}
          <div className="security-cmd-preview">
            <div className="cmd-preview-label">
              <Terminal size={13} />
              <span>COMMAND TO DISPATCH:</span>
            </div>
            <pre className="cmd-preview-text">&gt; {command}</pre>
          </div>

          {/* Affected Target Servers */}
          <div className="security-targets-box">
            <div className="targets-box-header">
              <Server size={13} />
              <span>AFFECTED FLEET ({targetServers.length} MACHINES):</span>
            </div>
            <div className="targets-pills-row">
              {targetServers.map((s) => (
                <span key={s.id} className="target-fleet-pill">
                  <strong>{s.name}</strong> ({s.hostname}:{s.port})
                </span>
              ))}
            </div>
          </div>

          {/* Password Challenge Input */}
          <div className="security-password-section">
            <label className="security-password-label">
              ENTER YOUR WORKSPACE ACCOUNT PASSWORD:
            </label>
            <div className="security-input-wrapper">
              <Lock size={16} className="security-lock-icon" />
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                className="security-password-input"
                placeholder="Workspace Account Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
              <button
                type="button"
                className="security-pwd-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {error && (
              <div className="security-error-msg">
                <AlertTriangle size={14} />
                <span>{error}</span>
              </div>
            )}
            <p className="security-note">
              Defies physical access or unauthorized session takeover. Your password will be validated against server records before any SSH exec channel opens.
            </p>
          </div>

          {/* Actions */}
          <div className="security-modal-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel (ESC)
            </button>
            <button
              type="submit"
              className="btn btn-hazard"
              disabled={submitting || !password}
            >
              {submitting ? 'Authenticating & Dispatching...' : 'Authorize & Execute (↵ Enter)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
