import React, { useEffect, useRef } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from 'lucide-react';

export type PopupVariant = 'danger' | 'warning' | 'info' | 'success';

export interface CyberPopupProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  badgeText?: string;
  variant?: PopupVariant;
  confirmText?: string;
  cancelText?: string;
  isAlert?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const CyberPopup: React.FC<CyberPopupProps> = ({
  isOpen,
  title,
  message,
  badgeText,
  variant = 'info',
  confirmText,
  cancelText = 'Cancel',
  isAlert = false,
  loading = false,
  onConfirm,
  onCancel
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && !loading) {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Autofocus confirm button
    const timer = setTimeout(() => confirmBtnRef.current?.focus(), 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, loading, onConfirm, onCancel]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <AlertTriangle size={22} color="#ff3366" />,
          accentColor: '#ff3366',
          glow: '0 0 30px rgba(255, 51, 102, 0.25)',
          borderColor: 'rgba(255, 51, 102, 0.4)',
          badgeBg: 'rgba(255, 51, 102, 0.15)',
          badgeBorder: 'rgba(255, 51, 102, 0.3)',
          badgeColor: '#ff3366',
          badgeDefault: 'SECURITY PROTOCOL / DANGER',
          confirmBtnClass: 'btn-cyber-danger',
          defaultConfirmText: isAlert ? 'Acknowledge' : 'Confirm Action'
        };
      case 'warning':
        return {
          icon: <AlertCircle size={22} color="#f59e0b" />,
          accentColor: '#f59e0b',
          glow: '0 0 30px rgba(245, 158, 11, 0.25)',
          borderColor: 'rgba(245, 158, 11, 0.4)',
          badgeBg: 'rgba(245, 158, 11, 0.15)',
          badgeBorder: 'rgba(245, 158, 11, 0.3)',
          badgeColor: '#f59e0b',
          badgeDefault: 'WARNING / ACTION REQUIRED',
          confirmBtnClass: 'btn-cyber-warning',
          defaultConfirmText: isAlert ? 'Understood' : 'Proceed'
        };
      case 'success':
        return {
          icon: <CheckCircle2 size={22} color="#00ff9d" />,
          accentColor: '#00ff9d',
          glow: '0 0 30px rgba(0, 255, 157, 0.25)',
          borderColor: 'rgba(0, 255, 157, 0.4)',
          badgeBg: 'rgba(0, 255, 157, 0.15)',
          badgeBorder: 'rgba(0, 255, 157, 0.3)',
          badgeColor: '#00ff9d',
          badgeDefault: 'SYSTEM SUCCESS',
          confirmBtnClass: 'btn-cyber-success',
          defaultConfirmText: isAlert ? 'Dismiss' : 'Continue'
        };
      case 'info':
      default:
        return {
          icon: <Info size={22} color="#00f0ff" />,
          accentColor: '#00f0ff',
          glow: '0 0 30px rgba(0, 240, 255, 0.25)',
          borderColor: 'rgba(0, 240, 255, 0.4)',
          badgeBg: 'rgba(0, 240, 255, 0.15)',
          badgeBorder: 'rgba(0, 240, 255, 0.3)',
          badgeColor: '#00f0ff',
          badgeDefault: 'SYSTEM NOTIFICATION',
          confirmBtnClass: 'btn-cyber-info',
          defaultConfirmText: isAlert ? 'Close' : 'Confirm'
        };
    }
  };

  const vStyles = getVariantStyles();

  return (
    <div className="cyber-popup-overlay" onClick={onCancel}>
      <div
        className="cyber-popup-container"
        style={{
          boxShadow: vStyles.glow,
          borderColor: vStyles.borderColor
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top telemetry bar */}
        <div className="cyber-popup-telemetry">
          <div className="cyber-popup-badge" style={{
            background: vStyles.badgeBg,
            borderColor: vStyles.badgeBorder,
            color: vStyles.badgeColor
          }}>
            <span className="cyber-popup-dot" style={{ background: vStyles.accentColor }} />
            <span>{badgeText || vStyles.badgeDefault}</span>
          </div>

          <button
            type="button"
            className="cyber-popup-close-btn"
            onClick={onCancel}
            title="Close (Esc)"
            disabled={loading}
          >
            <X size={16} />
          </button>
        </div>

        {/* Header with icon and title */}
        <div className="cyber-popup-header">
          <div
            className="cyber-popup-icon-box"
            style={{
              borderColor: vStyles.borderColor,
              background: vStyles.badgeBg
            }}
          >
            {vStyles.icon}
          </div>
          <div className="cyber-popup-title-area">
            <h3 className="cyber-popup-title">{title}</h3>
          </div>
        </div>

        {/* Message body */}
        <div className="cyber-popup-body">
          {typeof message === 'string' ? (
            <p className="cyber-popup-text">{message}</p>
          ) : (
            message
          )}
        </div>

        {/* Footer action buttons */}
        <div className="cyber-popup-footer">
          {!isAlert && (
            <button
              type="button"
              className="btn btn-outline btn-sm cyber-popup-btn"
              onClick={onCancel}
              disabled={loading}
            >
              <span>{cancelText}</span>
              <span className="key-hint">ESC</span>
            </button>
          )}

          <button
            ref={confirmBtnRef}
            type="button"
            className={`btn btn-sm ${vStyles.confirmBtnClass} cyber-popup-btn`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <span>Processing...</span>
            ) : (
              <>
                <span>{confirmText || vStyles.defaultConfirmText}</span>
                <span className="key-hint">↵ ENTER</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
