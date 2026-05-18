"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  const { user, loading, login, signup, loginWithGoogle, loginAsDemo } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const supabaseReady = isSupabaseConfigured();

  // If already logged in, redirect
  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

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
    if (!password) { setError("Please enter your password"); return; }
    if (tab === "signup" && !name.trim()) { setError("Please enter your name"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }

    setSubmitting(true);

    if (tab === "signin") {
      const result = await login(email, password);
      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => router.push("/dashboard"), 600);
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
          setTimeout(() => router.push("/dashboard"), 600);
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
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "relative", zIndex: 1,
          width: "100%", maxWidth: 420,
          background: "linear-gradient(180deg, rgba(19,21,31,0.98), rgba(15,17,23,0.98))",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 28,
          padding: "40px 36px 36px",
          boxShadow: "0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.08)",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            style={{
              width: 52, height: 52, borderRadius: 14,
              background: "linear-gradient(135deg, #6366F1, #818CF8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
              boxShadow: "0 0 40px rgba(99,102,241,0.4)",
              fontSize: 22, fontWeight: 800, color: "white",
            }}
          >
            U
          </motion.div>
          <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800, color: "white", letterSpacing: "-0.5px" }}>
            Welcome to UNIO
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
            {tab === "signin" ? "Sign in to manage your campus events" : "Create your organizer account"}
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4, marginBottom: 24, border: "1px solid rgba(255,255,255,0.07)" }}>
          {(["signin", "signup"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); setInfoMsg(""); }}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 9, border: "none",
                background: tab === t ? "rgba(99,102,241,0.25)" : "transparent",
                color: tab === t ? "white" : "rgba(255,255,255,0.35)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
              }}
            >
              {t === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

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
              style={{ position: "absolute", inset: 0, borderRadius: 28, background: "rgba(13,15,24,0.95)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 10 }}
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

        {/* Google Sign-In Button */}
        <motion.button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            width: "100%", padding: "13px",
            borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            color: "white", fontSize: 14, fontWeight: 600,
            cursor: googleLoading ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            transition: "all 0.2s",
            marginBottom: 4,
          }}
        >
          {googleLoading ? (
            <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "white", animation: "spin 0.8s linear infinite" }} />
          ) : (
            <GoogleIcon />
          )}
          {googleLoading ? "Connecting…" : `Continue with Google`}
        </motion.button>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
        </div>

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
                    width: "100%", padding: "12px 16px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12, color: "white", fontSize: 14,
                    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                    transition: "border-color 0.2s",
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
                width: "100%", padding: "12px 16px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12, color: "white", fontSize: 14,
                outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => e.target.style.borderColor = "rgba(99,102,241,0.5)"}
              onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 8 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tab === "signup" ? "At least 6 characters" : "Enter password"}
              autoComplete={tab === "signup" ? "new-password" : "current-password"}
              style={{
                width: "100%", padding: "12px 16px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12, color: "white", fontSize: 14,
                outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                transition: "border-color 0.2s",
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

          <motion.button
            type="submit"
            disabled={submitting}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              width: "100%", padding: "13px",
              borderRadius: 14, border: "none",
              background: submitting
                ? "rgba(99,102,241,0.5)"
                : "linear-gradient(135deg, #6366F1, #818CF8)",
              color: "white", fontSize: 14, fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              boxShadow: "0 4px 20px rgba(99,102,241,0.35)",
              fontFamily: "inherit",
              transition: "background 0.2s",
              marginTop: 4,
            }}
          >
            {submitting
              ? (tab === "signup" ? "Creating account…" : "Signing in…")
              : (tab === "signup" ? "Create Account" : "Sign In")}
          </motion.button>
        </form>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
        </div>

        {/* Demo button */}
        <motion.button
          type="button"
          onClick={loginAsDemo}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            width: "100%", padding: "12px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.7)",
            fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L10.5 5.5L15 6.5L12 10L12.5 15L8 13L3.5 15L4 10L1 6.5L5.5 5.5L8 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Continue as Demo User
        </motion.button>

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
  return <LoginForm />;
}
