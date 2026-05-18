"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { acceptTeamInvite } from "@/lib/db";
import { useAuth } from "@/lib/auth";

function AcceptInviteInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [status, setStatus] = useState<"loading" | "error" | "success" | "idle">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleAccept = async () => {
    if (!token) return;
    setStatus("loading");
    try {
      const res = await acceptTeamInvite(token);
      if (res.success) {
        setStatus("success");
        setTimeout(() => {
          // Force a full reload to get the new role and JWT
          window.location.href = "/dashboard";
        }, 1500);
      } else {
        if (res.error === "not_logged_in") {
          // Store token in localStorage and redirect to login
          localStorage.setItem("pending_invite_token", token);
          router.push("/login?returnTo=/auth/accept-invite");
        } else {
          setStatus("error");
          setErrorMsg(res.error || "Failed to accept invite");
        }
      }
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(e.message);
    }
  };

  if (authLoading) return null;

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F1117] text-white">
        <div className="text-center p-8 bg-white/5 rounded-2xl border border-white/10">
          <h1 className="text-xl font-bold text-red-400">Invalid Link</h1>
          <p className="mt-2 text-slate-400">No invitation token was provided.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F1117] text-white">
      <div className="text-center p-8 bg-white/5 rounded-2xl border border-white/10 max-w-sm w-full shadow-2xl">
        <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">You&apos;ve been invited!</h1>
        <p className="text-slate-400 text-sm mb-8">Join the workspace to manage events and check-ins as a Club Mate.</p>
        
        {status === "error" && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">
            {errorMsg}
          </div>
        )}
        
        {status === "success" && (
          <div className="mb-6 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-lg flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Welcome aboard! Redirecting...
          </div>
        )}
        
        <button 
          onClick={handleAccept}
          disabled={status === "loading" || status === "success"}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
        >
          {status === "loading" ? "Accepting..." : "Accept Invitation"}
        </button>
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
