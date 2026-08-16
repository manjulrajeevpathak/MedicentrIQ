"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; tone: ToastTone; message: string };

type ToastContextValue = {
  toast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    counter += 1;
    const id = counter;
    setToasts((current) => [...current, { id, tone, message }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3600);
    return () => clearTimeout(timer);
  }, [onClose]);

  const config: Record<ToastTone, { icon: ReactNode; ring: string }> = {
    success: { icon: <CheckCircle2 className="size-4 text-[var(--color-good)]" />, ring: "ring-emerald-100" },
    error: { icon: <XCircle className="size-4 text-[var(--color-critical)]" />, ring: "ring-rose-100" },
    info: { icon: <Info className="size-4 text-brand-600" />, ring: "ring-brand-100" }
  };

  return (
    <div
      className={cn(
        "animate-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface p-3.5 pr-2.5 shadow-pop ring-1 ring-inset",
        config[toast.tone].ring
      )}
      role="status"
    >
      <span className="mt-0.5">{config[toast.tone].icon}</span>
      <p className="flex-1 text-sm leading-snug text-ink">{toast.message}</p>
      <button onClick={onClose} aria-label="Dismiss notification" className="rounded-md p-1 text-ink-faint transition hover:bg-fill hover:text-ink-soft">
        <X className="size-3.5" />
      </button>
    </div>
  );
}
