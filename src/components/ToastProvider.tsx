'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  ttlMs?: number;
}

interface ToastContextValue {
  push: (t: Omit<Toast, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((ts) => [...ts, { id, ...t }]);
    const ttl = t.ttlMs ?? 4500;
    setTimeout(() => dismiss(id), ttl);
  }, [dismiss]);

  const value: ToastContextValue = {
    push,
    success: (title, message) => push({ kind: 'success', title, message }),
    error: (title, message) => push({ kind: 'error', title, message, ttlMs: 8000 }),
    info: (title, message) => push({ kind: 'info', title, message }),
    warning: (title, message) => push({ kind: 'warning', title, message }),
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={
              'pointer-events-auto card-padded py-3 px-4 shadow-lg border-l-4 max-w-sm ' +
              (t.kind === 'success' ? 'border-emerald-500' : t.kind === 'error' ? 'border-red-500' : t.kind === 'warning' ? 'border-amber-500' : 'border-brand-500')
            }
            onClick={() => dismiss(t.id)}
          >
            <div className="font-bold text-sm">{t.title}</div>
            {t.message && <div className="text-xs text-slate-600 mt-1">{t.message}</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
