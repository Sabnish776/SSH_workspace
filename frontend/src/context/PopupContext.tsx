import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CyberPopup, PopupVariant } from '../components/common/CyberPopup';

export interface PopupOptions {
  title: string;
  message: React.ReactNode;
  badgeText?: string;
  variant?: PopupVariant;
  confirmText?: string;
  cancelText?: string;
}

interface PopupState extends PopupOptions {
  isOpen: boolean;
  isAlert: boolean;
  resolve: (value: any) => void;
}

interface PopupContextType {
  confirm: (options: PopupOptions) => Promise<boolean>;
  alert: (options: PopupOptions) => Promise<void>;
}

const PopupContext = createContext<PopupContextType | null>(null);

export const PopupProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [popupState, setPopupState] = useState<PopupState | null>(null);

  const confirm = useCallback((options: PopupOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPopupState({
        ...options,
        isOpen: true,
        isAlert: false,
        resolve
      });
    });
  }, []);

  const alert = useCallback((options: PopupOptions): Promise<void> => {
    return new Promise<void>((resolve) => {
      setPopupState({
        ...options,
        isOpen: true,
        isAlert: true,
        resolve
      });
    });
  }, []);

  const handleConfirm = () => {
    if (popupState) {
      popupState.resolve(true);
      setPopupState(null);
    }
  };

  const handleCancel = () => {
    if (popupState) {
      popupState.resolve(false);
      setPopupState(null);
    }
  };

  return (
    <PopupContext.Provider value={{ confirm, alert }}>
      {children}
      {popupState && (
        <CyberPopup
          isOpen={popupState.isOpen}
          title={popupState.title}
          message={popupState.message}
          badgeText={popupState.badgeText}
          variant={popupState.variant}
          confirmText={popupState.confirmText}
          cancelText={popupState.cancelText}
          isAlert={popupState.isAlert}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </PopupContext.Provider>
  );
};

export const usePopup = (): PopupContextType => {
  const context = useContext(PopupContext);
  if (!context) {
    throw new Error('usePopup must be used within a PopupProvider');
  }
  return context;
};
