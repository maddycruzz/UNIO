"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense, useCallback } from "react";
import { acceptTeamInvite, getInvitePreview, type InvitePreview } from "@/lib/db";
import { useAuth } from "@/lib/auth";

const PENDING_TOKEN_KEY = "pending_invite_token";

function AcceptInviteInner() {
  const searchParams = useSearchParams();
  const urlToken = searchParams.get("token");
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [token, setToken] = useState<string | null>(urlToken);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // If the user landed here without a ?token=, try the one stashed before login.
  useEffect(() => {
    if (urlToken) return;
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(PENDING_TOKEN_KEY);
    if (stored) setToken(stored);
  }, [urlToken]);

  // Pre-auth preview: who invited me, what role, any personal note.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setPreviewLoading(true);
    getInvitePreview(token)
      .then((p) => { if (!cancelled) setPreview(p); })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const handleAccept = useCallback(async () => {
    if (!token) return;
    setStatus("loading");
    try {
      const res = await acceptTeamInvite(token);
      if (res.success) {
        if (typeof window !== "undefined") localStorage.removeItem(PENDING_TOKEN_KEY);
        setStatus("success");
        setTimeout(() => { window.location.href = "/dashboard"; }, 1200);
      } else {
        if (res.error === "not_logged_in") {
          if (typeof window !== "undefined") localStorage.setItem(PENDING_TOKEN_KEY, token);
          router.push("/login?returnTo=/auth/accept-invite");
        } else {
          setStatus("error");
          setErrorMsg(res.error || "Failed to accept invite");
        }
      }
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Failed to accept invite");
    }
  }, [token, router]);

  // Auto-accept once we have both a token and an authenticated user.
  // This is what makes the post-login round-trip seamless.
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    if (!token) return;
    if (status !== "idle") return;
    handleAccept();
  }, [authLoading, user, token, status, handleAccept]);

  if (authLoading) return null;

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F1117] text-white">
        <div className="max-w-sm w-full text-center p-8 rounded-2xl border border-white/10 bg-white/[0.03]">
          <h1 className="text-xl font-semibold text-red-300">Invalid invite link</h1>
          <p className="mt-2 text-sm text-slate-400">No invitation token was provided.</p>
          <button onClick={() => router.replace("/login")} className="mt-5 w-full rounded-lg bg-[#6366F1] py-2 text-sm font-semibold text-white hover:bg-[#5558e0] transition-colors">
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  const roleLabel = preview?.role === "president" ? "Club President" : "Club Mate";
  const greeting = preview?.inviteeName ? `Hi ${preview.inviteeName},` : "You've been invited";
  const subline = preview
    ? <>Join {preview.inviterName ? <><strong className="text-white">{preview.inviterName}</strong>&apos;s</> : "the"} UNIO workspace as a <strong className="text-white">{roleLabel}</strong>.</>
    : previewLoading
      ? "Loading invitation…"
      : "Join the workspace.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F1117] text-white px-4">
      <div className="max-w-sm w-full p-8 rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="w-14 h-14 bg-indigo-500/15 text-indigo-300 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
        </div>
        <h1 className="text-xl font-semibold mb-1 text-center">{greeting}</h1>
        <p className="text-slate-400 text-sm mb-6 text-center">{subline}</p>

        {preview?.personalMessage && (
          <div className="mb-5 p-3 rounded-lg border-l-2 border-indigo-400/50 bg-white/[0.02] text-sm text-slate-300 italic leading-relaxed">
            &ldquo;{preview.personalMessage}&rdquo;
          </div>
        )}

        {status === "error" && (
          <div className="mb-5 p-3 rounded-lg border border-red-500/25 bg-red-500/5 text-sm text-red-300 text-left">
            {errorMsg}
          </div>
        )}

        {status === "success" && (
          <div className="mb-5 p-3 rounded-lg border border-emerald-500/25 bg-emerald-500/5 text-sm text-emerald-300 flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Welcome aboard — redirecting…
          </div>
        )}

        {!user ? (
          <button
            onClick={handleAccept}
            disabled={status === "loading"}
            className="w-full py-3 px-4 rounded-lg bg-[#6366F1] hover:bg-[#5558e0] disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {status === "loading" ? "Continuing…" : "Sign in to accept"}
          </button>
        ) : (
          <button
            onClick={handleAccept}
            disabled={status === "loading" || status === "success"}
            className="w-full py-3 px-4 rounded-lg bg-[#6366F1] hover:bg-[#5558e0] disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {status === "loading" ? "Accepting…" : status === "success" ? "Accepted" : "Accept invitation"}
          </button>
        )}

        {preview?.email && !user && (
          <p className="mt-4 text-xs text-slate-500 text-center">
            Sign in or sign up with <strong className="text-slate-400">{preview.email}</strong> to accept.
          </p>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvite() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0F1117]" />}>
      <AcceptInviteInner />
    </Suspense>
  );
}
