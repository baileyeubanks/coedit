import { useEffect, useState, useCallback } from 'react';
import { C } from '../../theme/colors';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// Global toast state — simple pub/sub
type ToastListener = (toasts: Toast[]) => void;
const listeners: ToastListener[] = [];
let toasts: Toast[] = [];

function notify() {
  listeners.forEach((l) => l([...toasts]));
}

export function showToast(message: string, type: ToastType = 'info', duration = 4000) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const toast: Toast = { id, type, message, duration };
  toasts = [...toasts, toast];
  notify();
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration);
  }
  return id;
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
  success: { bg: `${C.success}12`, border: `${C.success}40`, icon: '✓', text: C.success },
  error:   { bg: `${C.error}12`,   border: `${C.error}40`,   icon: '✕', text: C.error },
  warning: { bg: `${C.warning}12`, border: `${C.warning}40`, icon: '⚠', text: C.warning },
  info:    { bg: `${C.accent}10`,  border: `${C.accent}30`,  icon: 'ℹ', text: C.accent },
};

export function ToastContainer() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const listener: ToastListener = (updated) => setItems(updated);
    listeners.push(listener);
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'center',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {items.map((toast) => {
        const colors = TOAST_COLORS[toast.type];
        return (
          <div
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              borderRadius: 10,
              background: C.surface,
              border: `1px solid ${colors.border}`,
              boxShadow: `0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px ${colors.border}`,
              fontSize: 12,
              fontWeight: 500,
              color: C.text,
              maxWidth: 400,
              pointerEvents: 'auto',
              animation: 'toast-in 0.2s ease',
              whiteSpace: 'pre-line',
              lineHeight: 1.5,
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                color: colors.text,
                flexShrink: 0,
              }}
            >
              {colors.icon}
            </span>
            <span>{toast.message}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                color: C.textMuted,
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
                marginLeft: 4,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// Hook for convenience
export function useToast() {
  const show = useCallback(
    (message: string, type: ToastType = 'info', duration?: number) =>
      showToast(message, type, duration),
    [],
  );
  return { showToast: show };
}
