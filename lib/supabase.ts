import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// ─── No-op lock ──────────────────────────────────────────────────
// supabase-js v2 uses `navigator.locks` to coordinate auth-token refresh
// across tabs. Next.js HMR can destroy a client mid-lock, leaving the
// browser-level lock permanently held — every subsequent `getSession()`
// (and therefore every PostgREST query that attaches the JWT) hangs forever.
// Until we genuinely need cross-tab sync, route around it.
const noopLock = async <R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> => fn();

function makeClient(): SupabaseClient {
  return createClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey || "placeholder-anon-key",
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        lock: noopLock,
      },
    },
  );
}

// ─── HMR-safe singleton ──────────────────────────────────────────
// Cache the client on globalThis so that when Next.js re-evaluates this
// module during HMR, we keep the same instance instead of constructing a
// competing one. Two clients on the same storageKey is the other half of
// the deadlock story.
declare global {
  // eslint-disable-next-line no-var
  var __unio_supabase_client__: SupabaseClient | undefined;
}

export const supabase: SupabaseClient =
  globalThis.__unio_supabase_client__ ??
  (globalThis.__unio_supabase_client__ = makeClient());

/** Returns true if Supabase env vars are configured */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}
