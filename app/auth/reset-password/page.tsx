"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [checking, setChecking] = useState(true);

  // The reset email lands here as a Supabase "recovery" event. We need a
  // recovery session before updateUser({ password }) is allowed.
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setChecking(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setRecoveryReady(true);
      }
      setChecking(false);
    });

    // If the user lands here without a recovery hash, give the SDK ~600ms to
    // pick up an existing session, then fall through to the "expired" state.
    const t = setTimeout(() => setChecking(false), 600);
    return () => { subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  // Already-signed-in users with a real session can still set a new password
  // from /dashboard/settings. Treat any active session here as "recovery ready".
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setRecoveryReady(true);
    });
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const res = await updatePassword(password);
    if (!res.success) {
      setError(res.error ?? "Couldn't update password.");
      setSubmitting(false);
      return;
    }
    setDone(true);
    setTimeout(() => router.replace("/dashboard"), 1200);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0F1117", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <div style={{
        width: "100%", maxWidth: 420,
        background: "rgba(17,19,28,0.92)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: "36px 32px 32px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "#6366F1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", fontSize: 20, fontWeight: 700, color: "white" }}>U</div>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "-0.02em" }}>
            {done ? "Password updated" : "Set a new password"}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {done ? "Redirecting you to your dashboard…" : "Pick something memorable — 6 characters or more."}
          </p>
        </div>

        {checking ? (
          <div style={{ textAlign: "center", padding: "12px 0", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
            Verifying reset link…
          </div>
        ) : !recoveryReady && !done ? (
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", fontSize: 13, lineHeight: 1.5 }}>
            This reset link has expired or is invalid. Request a new one from the sign-in page.
            <div style={{ marginTop: 12 }}>
              <Link href="/login" style={{ color: "#a5b4fc", fontWeight: 600, textDecoration: "none" }}>
                ← Back to sign in
              </Link>
            </div>
          </div>
        ) : !done ? (
          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 8 }}>New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
                style={{ width: "100%", padding: "11px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "white", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 8 }}>Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                style={{ width: "100%", padding: "11px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "white", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>
            {error && (
              <p style={{ margin: 0, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 13, color: "#f87171" }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: submitting ? "rgba(99,102,241,0.5)" : "#6366F1", color: "white", fontSize: 14, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", marginTop: 6, fontFamily: "inherit", letterSpacing: "-0.01em" }}
            >
              {submitting ? "Updating…" : "Update password"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
