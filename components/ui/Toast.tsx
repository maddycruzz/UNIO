"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

type Toast = {
  id: string;
  variant: ToastVariant;
  message: string;
  duration: number;
};

type ToastInput = {
  variant?: ToastVariant;
  duration?: number;
};

type ToastContextValue = {
  show: (message: string, opts?: ToastInput) => string;
  success: (message: string, opts?: Omit<ToastInput, "variant">) => string;
  error: (message: string, opts?: Omit<ToastInput, "variant">) => string;
  info: (message: string, opts?: Omit<ToastInput, "variant">) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; iconColor: string; Icon: typeof CheckCircle2 }> = {
  success: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.35)", iconColor: "#34D399", Icon: CheckCircle2 },
  error:   { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.35)",  iconColor: "#F87171", Icon: AlertCircle },
  info:    { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.35)", iconColor: "#A5B4FC", Icon: Info },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const handle = timeoutsRef.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const show = useCallback((message: string, opts: ToastInput = {}) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const toast: Toast = {
      id,
      message,
      variant: opts.variant ?? "info",
      duration: opts.duration ?? 4000,
    };
    setToasts((prev) => [...prev, toast]);
    if (toast.duration > 0) {
      const handle = setTimeout(() => dismiss(id), toast.duration);
      timeoutsRef.current.set(id, handle);
    }
    return id;
  }, [dismiss]);

  const success = useCallback((m: string, o?: Omit<ToastInput, "variant">) => show(m, { ...o, variant: "success" }), [show]);
  const error   = useCallback((m: string, o?: Omit<ToastInput, "variant">) => show(m, { ...o, variant: "error"   }), [show]);
  const info    = useCallback((m: string, o?: Omit<ToastInput, "variant">) => show(m, { ...o, variant: "info"    }), [show]);

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((handle) => clearTimeout(handle));
      timeouts.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show, success, error, info, dismiss }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          pointerEvents: "none",
          maxWidth: "calc(100vw - 40px)",
        }}
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const { bg, border, iconColor, Icon } = VARIANT_STYLES[t.variant];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 40, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.95, transition: { duration: 0.18 } }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                role={t.variant === "error" ? "alert" : "status"}
                style={{
                  pointerEvents: "auto",
                  minWidth: 260,
                  maxWidth: 380,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "12px 14px",
                  background: "rgba(17,19,28,0.96)",
                  backgroundImage: `linear-gradient(${bg}, ${bg})`,
                  border: `1px solid ${border}`,
                  borderRadius: 12,
                  color: "rgba(255,255,255,0.92)",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontSize: 13,
                  lineHeight: 1.45,
                  boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <Icon size={18} color={iconColor} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ flex: 1, wordBreak: "break-word" }}>{t.message}</span>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss notification"
                  style={{
                    flexShrink: 0,
                    width: 22,
                    height: 22,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "transparent",
                    border: "none",
                    borderRadius: 6,
                    color: "rgba(255,255,255,0.45)",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within <ToastProvider>");
  }
  return ctx;
}
