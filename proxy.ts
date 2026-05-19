import { NextResponse, type NextRequest } from "next/server";

/**
 * Pass-through proxy (Next 16+ convention, formerly middleware.ts).
 *
 * The Supabase client in this app uses localStorage for session storage
 * (lib/supabase.ts), so server-side code can't see auth state without
 * migrating to @supabase/ssr. Until that migration happens, the auth gate
 * lives entirely on the client (lib/auth.tsx) and the security boundary is
 * Postgres RLS. Kept as a hook point for the future SSR switch.
 */
export function proxy(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
