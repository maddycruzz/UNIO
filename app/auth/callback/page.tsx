"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { motion } from "framer-motion";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function handle() {
      if (!isSupabaseConfigured()) {
        router.replace("/login");
        return;
      }

      // Supabase delivers OAuth/email-confirmation results in three possible shapes:
      //  1. ?code=…           — PKCE flow (default for new projects)
      //  2. #access_token=…   — implicit flow (handled by detectSessionInUrl on the client)
      //  3. ?error=…          — provider rejected the request
      const code = searchParams.get("code");
      const errParam = searchParams.get("error_description") ?? searchParams.get("error");

      if (errParam) {
        setError(decodeURIComponent(errParam));
        return;
      }

      // Compute a safe internal redirect target (defaults to /dashboard).
      // We allow only same-origin paths to avoid an open-redirect.
      const rawNext = searchParams.get("next") ?? "/dashboard";
      const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          setError(error.message);
          return;
        }
      }

      // For implicit-flow + email-confirmation hash links, the client SDK has
      // already detected the URL and stored the session by the time this runs.
      // Either way, kick the user into the app.
      router.replace(next);
    }

    handle();
    return () => { cancelled = true; };
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1117] px-4">
        <div className="max-w-sm w-full rounded-2xl border border-red-500/25 bg-red-500/5 p-6 text-center">
          <h1 className="text-lg font-semibold text-red-300">Sign-in failed</h1>
          <p className="mt-2 text-sm text-slate-400">{error}</p>
          <button
            onClick={() => router.replace("/login")}
            className="mt-5 w-full rounded-lg bg-[#6366F1] py-2 text-sm font-semibold text-white hover:bg-[#5558e0] transition-colors"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#0F1117]">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="w-8 h-8 border-2 border-[#6366F1] border-t-transparent rounded-full"
      />
      <p className="text-xs text-slate-500">Signing you in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0F1117]" />}>
      <CallbackHandler />
    </Suspense>
  );
}
