"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// ─── Types ──────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatar?: string;
  role?: "developer" | "president" | "mate";
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<void>;
  loginAsDemo: () => void;
  logout: () => void;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

// ─── Storage key ────────────────────────────────────────────────
const SESSION_KEY = "unio_session_v1";

// Unified timeout for any Supabase auth call. Cellular / cold-start
// edge functions routinely take 2–5s; anything tighter silently
// sabotages real users on flaky networks. 30s is a comfortable safety
// net — Supabase's own HTTP timeout is ~30s, so this catches genuine
// client-side deadlocks without false-positiving on slow networks.
const AUTH_TIMEOUT_MS = 30_000;

// ─── Demo users ─────────────────────────────────────────────────
const DEMO_USERS: Record<string, AuthUser> = {
  "ayaan@college.edu": {
    id: "u-ayaan",
    name: "Ayaan Nizam",
    email: "ayaan@college.edu",
    initials: "AN",
    role: "president",
  },
  "priya@college.edu": {
    id: "u-priya",
    name: "Priya Sharma",
    email: "priya@college.edu",
    initials: "PS",
    role: "mate",
  },
  "admin@unio.campus": {
    id: "u-admin",
    name: "Campus Admin",
    email: "admin@unio.campus",
    initials: "CA",
    role: "developer",
  },
};

const DEFAULT_DEMO_USER = DEMO_USERS["ayaan@college.edu"];

// ─── Helpers ────────────────────────────────────────────────────
function loadSession(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function saveSession(user: AuthUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
  // Bust any per-user caches keyed off the previous identity so the next
  // login doesn't read the wrong club_id, etc.
  localStorage.removeItem("unio_mate_club_v1");
}

/** Convert a Supabase user into our app's AuthUser shape */
function supabaseUserToAuthUser(supaUser: { id: string; email?: string; user_metadata?: Record<string, unknown> }): AuthUser {
  const name =
    (supaUser.user_metadata?.full_name as string) ||
    (supaUser.user_metadata?.name as string) ||
    supaUser.email?.split("@")[0] ||
    "User";
  const email = supaUser.email || "";
  const initials = name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const avatar = (supaUser.user_metadata?.avatar_url as string) || undefined;

  return { id: supaUser.id, name, email, initials, avatar };
}

// ─── Context ────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // Seed from localStorage synchronously so the first paint isn't a blank
  // spinner waiting for getSession(). The hydrate effect below still runs
  // to validate the session against Supabase and refresh the role.
  const [user, setUser] = useState<AuthUser | null>(() => loadSession());
  const [loading, setLoading] = useState(() => {
    // If we already have a cached user, render immediately and validate in
    // the background. Otherwise show the spinner until hydrate resolves.
    if (typeof window === "undefined") return true;
    return !loadSession();
  });
  const [isOffline, setIsOffline] = useState(false);

  // Hydrate session on mount — check Supabase first, fall back to localStorage
  useEffect(() => {
    let cancelled = false;

    // Helper: race a promise against a timeout. Supabase query builder is PromiseLike, not Promise.
    const withTimeout = <T,>(p: PromiseLike<T>, ms: number, label: string): Promise<T> => {
      let timeoutId: NodeJS.Timeout;
      const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
      });
      return Promise.race([Promise.resolve(p), timeoutPromise]).finally(() => clearTimeout(timeoutId!));
    };

    async function hydrate() {
      try {
        if (isSupabaseConfigured()) {
          // getSession() reads from localStorage — should be near-instant. 4s is a safety net
          // for token-refresh edge cases; anything slower means the network is genuinely down.
          const { data, error } = await withTimeout(
            supabase.auth.getSession(),
            4000,
            "getSession"
          ) as any;

          if (error) throw error;
          if (cancelled) return;

          if (data?.session?.user) {
            const authUser = supabaseUserToAuthUser(data.session.user);
            // Render user IMMEDIATELY with cached role from localStorage (if any).
            // Don't block the UI on the network profile fetch.
            const cached = loadSession();
            if (cached && cached.id !== authUser.id) {
              // The local session belongs to an old demo user. Wipe it immediately!
              clearSession();
              authUser.role = "mate";
            } else {
              authUser.role = cached?.role || "mate";
            }
            saveSession(authUser);
            setUser(authUser);
            // Successful network hydration — clear any prior offline state.
            setIsOffline(false);

            // Refresh the role in the background — no UI blocking, no timeout race.
            supabase
              .from("profiles")
              .select("role")
              .eq("id", authUser.id)
              .single()
              .then(({ data: profile }) => {
                if (cancelled || !profile?.role || profile.role === authUser.role) return;
                const updated = { ...authUser, role: profile.role };
                saveSession(updated);
                setUser(updated);
              })
              .then(undefined, (err) => console.warn("Background profile refresh failed:", err));
          } else {
            // Clear any stale demo/localStorage session
            clearSession();
            setUser(null);
          }
          return;
        }
        // Demo mode — trust localStorage
        if (!cancelled) {
          setUser(loadSession());
        }
      } catch (err) {
        console.warn("Auth hydration failed, falling back to offline demo mode:", err);
        if (!cancelled) {
          setIsOffline(true);
          setUser(loadSession()); // fallback to demo local storage
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    hydrate();
    return () => { cancelled = true; };
  }, []);

  // Listen for Supabase auth state changes (e.g. after Google redirect).
  // Important: this handler must NOT block on the profile fetch — if Supabase
  // is slow or the profile row isn't created yet, the user would otherwise
  // sit on a spinner for the full network timeout. Render immediately with
  // the cached role, refresh the role in the background.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          const authUser = supabaseUserToAuthUser(session.user);
          const cached = loadSession();
          authUser.role = cached?.id === authUser.id ? (cached.role ?? "mate") : "mate";
          saveSession(authUser);
          setUser(authUser);

          // Background role refresh — fire and forget.
          supabase.from("profiles").select("role").eq("id", authUser.id).single()
            .then(({ data: profile }) => {
              if (!profile?.role || profile.role === authUser.role) return;
              const updated = { ...authUser, role: profile.role };
              saveSession(updated);
              setUser(updated);
            })
            .then(undefined, () => { /* network blip — keep cached role */ });
        } else {
          clearSession();
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Auth guard: redirect unauthenticated users away from /dashboard and /admin.
  // (/admin has its own role check in app/admin/page.tsx for developer-only,
  // but the *login* gate belongs here so we don't render a page flash first.)
  useEffect(() => {
    if (loading) return;
    const isProtected =
      pathname?.startsWith("/dashboard") || pathname?.startsWith("/admin");
    if (isProtected && !user) {
      router.replace("/login");
    }
  }, [user, loading, pathname, router]);

  const login = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      // ── Real Supabase auth ──
      if (isSupabaseConfigured() && !isOffline) {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("auth_timeout")), AUTH_TIMEOUT_MS)
        );

        try {
          const { data, error } = await Promise.race([
            supabase.auth.signInWithPassword({ email, password }),
            timeoutPromise
          ]) as any;

          if (error) return { success: false, error: error.message };
          if (data.user) {
            const authUser = supabaseUserToAuthUser(data.user);
            // Render immediately with cached role (if any). Refresh in background.
            const cached = loadSession();
            authUser.role = cached?.id === authUser.id ? (cached.role ?? "mate") : "mate";
            saveSession(authUser);
            setUser(authUser);
            setIsOffline(false);

            supabase.from("profiles").select("role").eq("id", authUser.id).single()
              .then(({ data: profile }) => {
                if (!profile?.role || profile.role === authUser.role) return;
                const updated = { ...authUser, role: profile.role };
                saveSession(updated);
                setUser(updated);
              })
              .then(undefined, () => { /* fine — keep cached role */ });

            return { success: true };
          }
          return { success: false, error: "Sign-in failed. Please try again." };
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          if (msg === "auth_timeout") {
            return { success: false, error: "Sign-in is taking longer than usual. Check your connection and retry." };
          }
          console.error("Login network error:", e);
          return { success: false, error: "Network error during sign-in." };
        }
      }
      return { success: false, error: "Supabase is not configured." };
    },
    [isOffline]
  );

  const signup = useCallback(
    async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> => {
      if (!isSupabaseConfigured()) {
        return { success: false, error: "Supabase is not configured." };
      }

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Supabase is offline")), AUTH_TIMEOUT_MS)
      );

      try {
        const { data, error } = await Promise.race([
          supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name } },
          }),
          timeoutPromise
        ]) as any;

        if (error) return { success: false, error: error.message };
        if (data.user) {
          // If email confirmation is required, Supabase returns a user but no session
          if (!data.session) {
            return { success: true, error: "check-email" }; // special flag for UI
          }
          const authUser = supabaseUserToAuthUser(data.user);
          // New signup → no cached role; default to mate. The handle_new_user
          // trigger will create the profile row; we don't block on reading it.
          authUser.role = "mate";
          saveSession(authUser);
          setUser(authUser);
          setIsOffline(false);
          return { success: true };
        }
        return { success: false, error: "Sign-up failed. Please try again." };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "auth_timeout") {
          return { success: false, error: "Sign-up is taking longer than usual. Check your connection and retry." };
        }
        console.error("Signup network error:", e);
        return { success: false, error: "Network error during sign-up." };
      }
    },
    []
  );

  const loginWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      // Fallback: if Supabase isn't configured, sign in as demo user
      saveSession(DEFAULT_DEMO_USER);
      setUser(DEFAULT_DEMO_USER);
      router.push("/dashboard");
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error("Google sign-in error:", error.message);
    }
    // Supabase will redirect to Google → back to /auth/callback → /dashboard
  }, [router]);

  const loginAsDemo = useCallback(async () => {
    // Demo is always local-only. Never try a real Supabase login with seeded
    // credentials — if they happen to exist in a prod project, anyone who
    // clicks "Demo" would be signed into a real account.
    if (isSupabaseConfigured()) {
      // If a real Supabase session exists, sign it out first so demo and
      // real-auth state can't get tangled.
      try { await supabase.auth.signOut(); } catch { /* network or no session — both fine */ }
    }
    saveSession(DEFAULT_DEMO_USER);
    setUser(DEFAULT_DEMO_USER);
    router.push("/dashboard");
  }, [router]);

  const sendPasswordReset = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: "Supabase is not configured." };
    }
    if (!email) return { success: false, error: "Please enter your email." };
    try {
      const redirectTo = `${window.location.origin}/auth/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Reset failed." };
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: "Supabase is not configured." };
    }
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: "Password must be at least 6 characters." };
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Update failed." };
    }
  }, []);

  const logout = useCallback(() => {
    // Optimistic: clear local state and redirect immediately so the user sees
    // an instant response. The Supabase server-side token revoke runs in the
    // background — if it fails (network down, cold-start), the local session
    // is already gone and the refresh token will expire on its own.
    clearSession();
    try { localStorage.removeItem("unio_mate_club_v1"); } catch {}
    setUser(null);
    router.replace("/login");

    if (isSupabaseConfigured() && !isOffline) {
      // Fire-and-forget. No await, no race, no UI block.
      void supabase.auth.signOut().catch((e) => {
        console.warn("Background signOut failed (local session already cleared):", e);
      });
    }
  }, [router, isOffline]);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, loginWithGoogle, loginAsDemo, logout, sendPasswordReset, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
