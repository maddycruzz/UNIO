"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

// ─── Google icon SVG ───────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

// ─── Login/Signup form (must be inside AuthProvider) ──────────────
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, login, signup, loginWithGoogle, loginAsDemo, sendPasswordReset } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const supabaseReady = isSupabaseConfigured();

  // Same-origin returnTo (defaults to /dashboard, no open-redirect).
  const rawReturnTo = searchParams.get("returnTo");
  const returnTo = rawReturnTo && rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//") ? rawReturnTo : "/dashboard";

  // If already logged in, honor returnTo (e.g. /auth/accept-invite).
  useEffect(() => {
    if (!loading && user) {
      router.replace(returnTo);
    }
  }, [user, loading, router, returnTo]);

  // Check URL hash for signup tab
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#signup") {
      setTab("signup");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfoMsg("");
    if (!email) { setError("Please enter your email"); return; }
    if (tab === "forgot") {
      setSubmitting(true);
      const res = await sendPasswordReset(email);
      setSubmitting(false);
      if (res.success) {
        setInfoMsg("If an account exists for that email, a reset link is on the way.");
      } else {
        setError(res.error ?? "Couldn't send reset email.");
      }
      return;
    }
    if (!password) { setError("Please enter your password"); return; }
    if (tab === "signup" && !name.trim()) { setError("Please enter your name"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }

    setSubmitting(true);

    if (tab === "signin") {
      const result = await login(email, password);
      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => router.push(returnTo), 600);
      } else {
        setError(result.error || "Login failed");
        setSubmitting(false);
      }
    } else {
      const result = await signup(email, password, name.trim());
      if (result.success) {
        if (result.error === "check-email") {
          // Email confirmation required
          setInfoMsg("Account created! Check your email to confirm before signing in.");
          setSubmitting(false);
          setTab("signin");
        } else {
          setShowSuccess(true);
          setTimeout(() => router.push(returnTo), 600);
        }
      } else {
        setError(result.error || "Sign up failed");
        setSubmitting(false);
      }
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch {
      setError("Google sign-in failed. Please try again.");
      setGoogleLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0F1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid rgba(99,102,241,0.2)", borderTopColor: "#6366F1", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0F1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',system-ui,sans-serif", padding: 24, position: "relative", overflow: "hidden" }}>
      {/* Background effects */}
      <div style={{ position: "absolute", top: "-20%", left: "-10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.12), transparent 60%)", filter: "blur(80px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-20%", right: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.1), transparent 60%)", filter: "blur(80px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(148,163,184,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.04) 1px, transparent 1px)", backgroundSize: "72px 72px", pointerEvents: "none" }} />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "relative", zIndex: 1,
          width: "100%", maxWidth: 420,
          background: "rgba(17,19,28,0.92)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: "36px 32px 32px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: 12,
              background: "#6366F1",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 18px",
              fontSize: 20, fontWeight: 700, color: "white",
              letterSpacing: "-0.02em",
            }}
          >
            U
          </div>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "-0.02em" }}>
            {tab === "signin" ? "Sign in to UNIO" : tab === "signup" ? "Create your account" : "Reset your password"}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {tab === "signin" ? "Manage your campus events" : tab === "signup" ? "Get your club running on UNIO" : "We'll email you a link to set a new password."}
          </p>
        </div>

        {/* Tab switcher (hidden in forgot-password mode) */}
        {tab !== "forgot" && (
          <div style={{ display: "flex", background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 3, marginBottom: 24, border: "1px solid rgba(255,255,255,0.06)" }}>
            {(["signin", "signup"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); setInfoMsg(""); }}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                  background: tab === t ? "rgba(255,255,255,0.07)" : "transparent",
                  color: tab === t ? "white" : "rgba(255,255,255,0.4)",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  transition: "color 0.15s, background 0.15s",
                }}
              >
                {t === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>
        )}

        {/* Info message (e.g. check email) */}
        <AnimatePresence>
          {infoMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 12, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", fontSize: 13, color: "#34d399" }}
            >
              {infoMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 13, color: "#f87171" }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success overlay */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ position: "absolute", inset: 0, borderRadius: 16, background: "rgba(13,15,24,0.95)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 10 }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 12 }}
                style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,#10B981,#34D399)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, boxShadow: "0 0 40px rgba(16,185,129,0.4)" }}
              >
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M6 14L11 19L22 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </motion.div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "white" }}>
                {tab === "signup" ? "Account created!" : "Welcome back!"}
              </p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Redirecting to dashboard…</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Google Sign-In Button — hidden during password-reset flow */}
        {tab !== "forgot" && (
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          onMouseEnter={(e) => { if (!googleLoading) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
          onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          style={{
            width: "100%", padding: "12px",
            borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.05)",
            color: "white", fontSize: 14, fontWeight: 600,
            cursor: googleLoading ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            transition: "background 0.15s",
            marginBottom: 4,
          }}
        >
          {googleLoading ? (
            <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "white", animation: "spin 0.8s linear infinite" }} />
          ) : (
            <GoogleIcon />
          )}
          {googleLoading ? "Connecting…" : `Continue with Google`}
        </button>
        )}

        {/* Divider — hidden during password-reset flow */}
        {tab !== "forgot" && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>OR</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          </div>
        )}

        {/* Email / Password / Name Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Name field — only for signup */}
          <AnimatePresence>
            {tab === "signup" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: "hidden" }}
              >
                <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 8 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ayaan Nizam"
                  autoComplete="name"
                  style={{
                    width: "100%", padding: "11px 14px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10, color: "white", fontSize: 14,
                    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(99,102,241,0.5)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 8 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@college.edu"
              autoComplete="email"
              autoFocus={tab === "signin"}
              style={{
                width: "100%", padding: "11px 14px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, color: "white", fontSize: 14,
                outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => e.target.style.borderColor = "rgba(99,102,241,0.5)"}
              onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
            />
          </div>

          {tab !== "forgot" && (
            <div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Password
                </label>
                {tab === "signin" && (
                  <button
                    type="button"
                    onClick={() => { setTab("forgot"); setError(""); setInfoMsg(""); setPassword(""); }}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, fontWeight: 600, color: "rgba(165,180,252,0.85)", fontFamily: "inherit", letterSpacing: "-0.01em" }}
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === "signup" ? "At least 6 characters" : "Enter password"}
                autoComplete={tab === "signup" ? "new-password" : "current-password"}
                style={{
                  width: "100%", padding: "11px 14px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, color: "white", fontSize: 14,
                  outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => e.target.style.borderColor = "rgba(99,102,241,0.5)"}
                onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
              />
              {!supabaseReady && (
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
                  Demo mode — any password works
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.background = "#5558E0"; }}
            onMouseLeave={(e) => { if (!submitting) e.currentTarget.style.background = "#6366F1"; }}
            style={{
              width: "100%", padding: "12px",
              borderRadius: 10, border: "none",
              background: submitting ? "rgba(99,102,241,0.5)" : "#6366F1",
              color: "white", fontSize: 14, fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              transition: "background 0.15s",
              marginTop: 6,
              letterSpacing: "-0.01em",
            }}
          >
            {submitting
              ? (tab === "signup" ? "Creating account…" : tab === "forgot" ? "Sending…" : "Signing in…")
              : (tab === "signup" ? "Create account" : tab === "forgot" ? "Send reset link" : "Sign in")}
          </button>
          {tab === "forgot" && (
            <button
              type="button"
              onClick={() => { setTab("signin"); setError(""); setInfoMsg(""); }}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "inherit", marginTop: 2 }}
            >
              ← Back to sign in
            </button>
          )}
        </form>

        {/* Divider — hidden during password-reset flow */}
        {tab !== "forgot" && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>OR</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          </div>
        )}

        {/* Demo button — hidden during password-reset flow */}
        {tab !== "forgot" && (
        <button
          type="button"
          onClick={loginAsDemo}
          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
          style={{
            width: "100%", padding: "11px",
            borderRadius: 10,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.65)",
            fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "background 0.15s",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L10.5 5.5L15 6.5L12 10L12.5 15L8 13L3.5 15L4 10L1 6.5L5.5 5.5L8 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Continue as Demo User
        </button>
        )}

        {/* Footer */}
        <div style={{ marginTop: 24, textAlign: "center" }}>
          <Link
            href="/"
            style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textDecoration: "none" }}
          >
            ← Back to UNIO homepage
          </Link>
        </div>
      </motion.div>

      {/* Spin animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Page wrapper ────────────────────────────────────────────────
export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0F1117" }} />}>
      <LoginForm />
    </Suspense>
  );
}
