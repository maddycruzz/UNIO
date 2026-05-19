"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" tints the confirm button red. */
  variant?: "default" | "danger";
};

type PendingConfirm = ConfirmOptions & {
  resolve: (ok: boolean) => void;
};

type ConfirmContextValue = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((ok: boolean) => {
    setPending((current) => {
      if (current) current.resolve(ok);
      return null;
    });
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  // Focus the confirm button when the dialog opens — keyboard accessibility.
  useEffect(() => {
    if (pending) {
      const handle = requestAnimationFrame(() => confirmButtonRef.current?.focus());
      return () => cancelAnimationFrame(handle);
    }
  }, [pending]);

  // Keyboard: Esc cancels, Enter confirms.
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(false); }
      if (e.key === "Enter")  { e.preventDefault(); close(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, close]);

  const isDanger = pending?.variant === "danger";
  const confirmBg = isDanger ? "#DC2626" : "#6366F1";
  const confirmBgHover = isDanger ? "#B91C1C" : "#5558E0";

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {pending && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => close(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
              zIndex: 1100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            <motion.div
              key="dialog"
              initial={{ opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8, transition: { duration: 0.12 } }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 380,
                background: "#11131C",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                padding: 22,
                boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
                color: "white",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
                <div
                  style={{
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: isDanger ? "rgba(220,38,38,0.15)" : "rgba(99,102,241,0.15)",
                    border: `1px solid ${isDanger ? "rgba(220,38,38,0.35)" : "rgba(99,102,241,0.35)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AlertTriangle size={18} color={isDanger ? "#F87171" : "#A5B4FC"} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 id="confirm-title" style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>
                    {pending.title ?? "Are you sure?"}
                  </h2>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                    {pending.message}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => close(false)}
                  style={{
                    padding: "9px 14px",
                    borderRadius: 9,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.04)",
                    color: "rgba(255,255,255,0.85)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {pending.cancelLabel ?? "Cancel"}
                </button>
                <button
                  ref={confirmButtonRef}
                  type="button"
                  onClick={() => close(true)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = confirmBgHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = confirmBg; }}
                  style={{
                    padding: "9px 14px",
                    borderRadius: 9,
                    border: "none",
                    background: confirmBg,
                    color: "white",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "background 0.15s",
                  }}
                >
                  {pending.confirmLabel ?? "Confirm"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within <ConfirmProvider>");
  }
  return ctx.confirm;
}
