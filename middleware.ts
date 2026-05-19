import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight auth gate for protected paths.
 *
 * We deliberately avoid `supabase.auth.getUser()` here — it's a network call
 * to Supabase's /auth/v1/user endpoint, and on first navigation to a dynamic
 * route it blocks the entire RSC fetch (visible to the user as a multi-second
 * hang when clicking into an event/task detail page).
 *
 * Instead, we check for the presence of Supabase's auth cookie. That cookie
 * is httpOnly and Set-Cookie'd by Supabase itself after sign-in, so it can't
 * be trivially forged. If somehow a fake cookie gets past us, every query
 * the page issues is still RLS-protected at the database — middleware is a
 * routing concern, not the security boundary.
 */
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtected = path.startsWith("/dashboard") || path.startsWith("/admin");
  if (!isProtected) return NextResponse.next();

  // Supabase stores the session under `sb-<project-ref>-auth-token`.
  // Some recent SDK versions chunk it across `…-auth-token.0`, `…-auth-token.1`
  // — match either shape.
  const hasSession = req.cookies
    .getAll()
    .some((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name));

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("returnTo", path + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
