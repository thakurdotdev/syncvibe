import { showMoment, type MomentLeading } from '@/stores/islandStore';
import React, { createContext, ReactNode, useContext, useMemo } from 'react';

/*
 * Toasts are moments: they show in the header's pill (components/shell/TopIsland), one at a
 * time, like messages and room invites. The same message again restarts the one showing.
 */

export type ToastType = 'default' | 'success' | 'error' | 'info';

interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastOptions {
  type?: ToastType;
  duration?: number;
  /** One button at the end of the toast. Pressing it also dismisses the toast. */
  action?: ToastAction;
}

type ToastFunction = (message: string, options?: ToastOptions) => void;

const DURATION_MS = 3200;
/** A toast with a button has to stay long enough to read it and reach for it. */
const ACTION_DURATION_MS = 6000;

const ICON: Record<ToastType, MomentLeading | undefined> = {
  default: undefined,
  success: { kind: 'icon', icon: 'success' },
  error: { kind: 'icon', icon: 'error' },
  info: { kind: 'icon', icon: 'info' },
};

export const toast: ToastFunction = (message, options) => {
  const type = options?.type ?? 'default';
  const action = options?.action;
  showMoment({
    key: `toast-${type}-${message}`,
    title: message,
    leading: ICON[type],
    action,
    duration: options?.duration ?? (action ? ACTION_DURATION_MS : DURATION_MS),
  });
};

const ToastContext = createContext<{ toast: ToastFunction } | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const value = useMemo(() => ({ toast }), []);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};
