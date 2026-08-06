"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type ToastInput = {
  title: string;
  description?: string;
};

type ToastItem = ToastInput & { id: string };

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (toast: ToastInput) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((current) => [...current, { ...toast, id }]);
      window.setTimeout(() => dismissToast(id), 3000);
    },
    [dismissToast]
  );

  const value = useMemo(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return () => undefined;
  }
  return context.showToast;
}

export function Toaster() {
  const context = useContext(ToastContext);

  if (!context) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(92vw,22rem)] flex-col gap-3">
      {context.toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto rounded-[var(--radius-2xl)] border border-border/70 bg-popover/95 p-4 shadow-[var(--shadow-overlay)] backdrop-blur"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">{toast.title}</p>
              {toast.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{toast.description}</p>
              ) : null}
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => context.dismissToast(toast.id)}>
              <span className="sr-only">Dismiss toast</span>
              ×
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}