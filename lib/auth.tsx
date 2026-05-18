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
}

// ─── Storage key ────────────────────────────────────────────────
const SESSION_KEY = "unio_session_v1";

// Unified timeout for any Supabase auth call. Cellular / cold-start
// edge functions routinely take 2–5s; anything tighter silently
// sabotages real users on flaky networks.
const AUTH_TIMEOUT_MS = 10_000;

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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
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
              authUser.role = "president";
            } else {
              authUser.role = cached?.role || "president";
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

  // Listen for Supabase auth state changes (e.g. after Google redirect)
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const authUser = supabaseUserToAuthUser(session.user);
          const { data: profile } = await supabase.from("profiles").select("role").eq("id", authUser.id).single();
          authUser.role = profile?.role || "president";
          saveSession(authUser);
          setUser(authUser);
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
          setTimeout(() => reject(new Error("Supabase is offline")), AUTH_TIMEOUT_MS)
        );

        try {
          const { data, error } = await Promise.race([
            supabase.auth.signInWithPassword({ email, password }),
            timeoutPromise
          ]) as any;

          if (error) return { success: false, error: error.message };
          if (data.user) {
            const authUser = supabaseUserToAuthUser(data.user);
            const { data: profile } = await supabase.from("profiles").select("role").eq("id", authUser.id).single();
            authUser.role = profile?.role || "president";
            saveSession(authUser);
            setUser(authUser);
            // Reset offline flag — we just succeeded against the network.
            setIsOffline(false);
            return { success: true };
          }
          return { success: false, error: "Sign-in failed. Please try again." };
        } catch (e) {
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
          const { data: profile } = await supabase.from("profiles").select("role").eq("id", authUser.id).single();
          authUser.role = profile?.role || "president";
          saveSession(authUser);
          setUser(authUser);
          setIsOffline(false);
          return { success: true };
        }
        return { success: false, error: "Sign-up failed. Please try again." };
      } catch (e) {
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
    if (isSupabaseConfigured()) {
      const result = await login("ayaan@college.edu", "password123");
      if (result.success) {
        router.push("/dashboard");
        return;
      }
      // If Supabase login failed (no seeded demo account, network down, etc.)
      // fall through to the localStorage demo path instead of dead-ending.
    }
    // No Supabase backend (or login failed): drop the seeded president into
    // localStorage so the demo still works end-to-end against `lib/store.ts`.
    saveSession(DEFAULT_DEMO_USER);
    setUser(DEFAULT_DEMO_USER);
    router.push("/dashboard");
  }, [router, login]);

  const logout = useCallback(async () => {
    if (isSupabaseConfigured() && !isOffline) {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000));
      try {
        await Promise.race([supabase.auth.signOut(), timeoutPromise]);
      } catch (e) {
        console.warn("Signout network check failed, proceeding with local signout", e);
      }
    }
    clearSession();
    setUser(null);
    router.push("/login");
  }, [router, isOffline]);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, loginWithGoogle, loginAsDemo, logout }}>
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
