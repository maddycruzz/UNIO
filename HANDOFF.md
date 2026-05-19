# UNIO — Session Handoff

> For the next Claude session. User is presenting this app **tomorrow**. Treat all work as demo-critical.

## What this is

UNIO is a campus event-management dashboard. Next.js 16 (App Router) + Supabase (auth + Postgres + RLS) + DM Sans typography. RBAC roles: `developer` > `president` > `mate`. Code is largely client-side (`"use client"`) with one server route (`/api/events/[eventId]/broadcast`) and Supabase RLS as the security boundary.

- **Working dir**: `/Users/bharath/projects/UNIO-main`
- **Branch**: `main`
- **User**: `maddycruzz` / `sarasubharath1897@gmail.com`
- **Today's date when this was written**: 2026-05-19

## Stack quick-ref

```
Next.js 16.1.6 (App Router)        next dev / next build
React 19.2.3
Supabase (@supabase/ssr 0.10.3, @supabase/supabase-js 2.98.0)
DM Sans, Tailwind 4, framer-motion, @dnd-kit, lucide-react
ENV: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (in .env.local)
     RESEND_API_KEY, RESEND_FROM_EMAIL (optional, for /api/events/.../broadcast)
```

## What changed in the previous session (very recent)

### Auth — overhauled end-to-end
- **Default role**: was `'president'` everywhere → now `'mate'`. Client AND DB.
  - `lib/auth.tsx` — 5 sites flipped.
  - **DB migration**: `supabase_rbac_migration_v6.sql` — flips `profiles.role` column default + patches `handle_new_user()` trigger. **User has already run this in Supabase.**
- **OAuth/PKCE callback** (`app/auth/callback/page.tsx`): now explicitly calls `exchangeCodeForSession(code)`. Handles `?code=`, hash flow, `?error=`, and same-origin `next=`.
- **Forgot password**: new tab on login + new `/auth/reset-password` page. `sendPasswordReset` and `updatePassword` added to AuthContext.
- **Server-side middleware** (`middleware.ts`): redirects unauthenticated requests on `/dashboard/*` and `/admin/*` to `/login?returnTo=…`. Uses cookie-presence check, **NOT** `getUser()` — see perf section.
- **Invite returnTo**: `app/auth/accept-invite/page.tsx` reads `pending_invite_token` from localStorage and auto-accepts once auth is ready. Login page honors `?returnTo=` (same-origin only).
- **Demo mode isolated**: `loginAsDemo` no longer attempts a real Supabase login with `ayaan@college.edu / password123` — it signs out any real session and uses local-only data.
- **Non-blocking profile fetch**: `onAuthStateChange`, `login`, and `signup` no longer await the `profiles.role` lookup; they set the user immediately with cached role and refresh in the background.

### Performance — pages were taking ~10s
Root causes were stacked. Fixes:
- **Auth hydration**: `useState` is now seeded synchronously from localStorage so the first paint is instant when a session exists (was a 4s `getSession()` race).
- **`getUserContext()`** (`lib/db.ts`): localStorage-first, skips the 3s `getSession()` race entirely. Reads JWT directly from `sb-*-auth-token`.
- **Mate `activeClubId` cache**: cached under `unio_mate_club_v1` to skip a round-trip on every write. Cleared on logout.
- **`getDashboardStats`**: was loading 4 full tables → now uses `count: "exact", head: true` HEAD queries.
- **Middleware**: was doing `supabase.auth.getUser()` (network call) → now does cookie-presence check (zero network). This was the cause of "detail page hangs for 10s then refresh works" — the RSC fetch was waiting on `/auth/v1/user`.
- **Event detail page** (`app/dashboard/events/[id]/page.tsx`): `loadTasks` + `getEventById` were serial → now `Promise.all`.

### Security
- **`POST /api/events/[eventId]/broadcast`**: was an unauthenticated open email relay. Now requires `events.broadcast` permission via `requirePermission` and pulls recipients server-side via RLS. Client no longer sends `recipients[]`.
- **Migration v7** (`supabase_rbac_migration_v7.sql`): pinned `search_path = public, pg_temp` on every `SECURITY DEFINER` function (search-path injection defense). Dropped the `event-files` storage bucket's broad SELECT listing policy. **User has run this.**
- **Migration v7 had a bug** that v8 fixes: revoked `EXECUTE` from `anon` only, but Postgres grants `EXECUTE` to `PUBLIC` by default and `anon` inherits from `PUBLIC`. So functions stayed callable. Don't repeat this pattern.
- **Migration v8** (`supabase_rbac_migration_v8.sql`): correct version — `REVOKE EXECUTE … FROM PUBLIC` then `GRANT … TO authenticated` for the private RPCs; kept anon access on the four intentionally-public ones (`get_public_event`, `register_for_event`, `submit_feedback`, `cancel_registration`). `handle_new_user` is fully locked (trigger-only). **User has run this.**

### Auth resilience
- **`AUTH_TIMEOUT_MS`** in `lib/auth.tsx`: bumped from 10s → 30s. The old 10s false-positived as `"Supabase is offline"` on slow networks even when Supabase was fine. Internal sentinel changed to `"auth_timeout"` with user-facing message *"Sign-in is taking longer than usual. Check your connection and retry."*

### UI polish
- Landing page word-cycle animation: `WORDS_PER_VIEWPORT = 1.7` (was 1.0), section height ~570vh (was 900vh).
- General SaaS-ification of login + dashboard sidebar + landing page: dropped marketing-y glows, gradient buttons, bouncy `scale: 1.02` hovers. Solid colors, consistent `rounded-10`, font-weight 600 default.

## Status (updated mid-session, ~hours before demo)

### Done
1. ✅ v6 migration applied — `profiles.role` default flipped to `mate`
2. ✅ Alt Google account manually demoted to `mate` via SQL `UPDATE`
3. ✅ v7 migration applied — `search_path` pinned on all SECURITY DEFINER functions, event-files bucket listing locked down
4. ✅ v8 migration applied — proper PUBLIC revoke + selective anon/authenticated grants
5. ✅ Auth timeout error fixed (30s + better message)
6. ✅ HANDOFF.md created
7. ✅ Work committed (this commit)

### Final linter state (acceptable for demo)
- ✅ `function_search_path_mutable` → 0 (was 2)
- ✅ `public_bucket_allows_listing` → 0 (was 1)
- ✅ `anon_security_definer_function_executable` → 4 (was 12) — the 4 remaining are intentional: `get_public_event`, `register_for_event`, `submit_feedback`, `cancel_registration` (public event registration flow)
- ⚠️ `authenticated_security_definer_function_executable` → 11 (informational — linter flags every SECURITY DEFINER function as a heads-up. All 11 are by-design callable by signed-in users. Cannot suppress without rewriting to `SECURITY INVOKER` which would break them.)
- ⚠️ `auth_leaked_password_protection` → still on (Pro-plan feature, user is on Free, **skipped intentionally**)
- ⚠️ ~70 PERFORMANCE warnings (`auth_rls_initplan`, `multiple_permissive_policies`, `unindexed_foreign_keys`, `unused_index`) — **deliberately deferred**. Don't bite at the user's current data size (1–2ms queries confirmed in slow-query log). Post-demo cleanup.

### Still to do before demo
1. ❌ **Deploy to Vercel** — projector/wifi reliability concern. User wants this.
2. ❌ **Seed demo data** — `supabase_seed_demo.sql` exists but hasn't been reviewed against v6/v7/v8 schema. Don't run blindly.
3. ❌ **End-to-end rehearsal** — user should walk through the demo flow they'll actually present.
4. ⏰ **Warm up Supabase ~30s before presenting** (free tier hibernates).
5. **End-to-end rehearsal** of the actual demo flow.
6. **Warm up Supabase ~30s before demo** — free tier hibernates.

## What was in the big commit

Single commit covering this session's work (see `git log -1`):

```
app/api/events/[eventId]/broadcast/route.ts   security fix (auth + RLS recipients)
app/auth/accept-invite/page.tsx               returnTo + auto-accept
app/auth/callback/page.tsx                    PKCE handler
app/auth/reset-password/page.tsx              NEW — forgot-password landing
app/dashboard/events/[id]/page.tsx            parallel fetch
app/dashboard/layout.tsx                      sidebar polish
app/dashboard/page.tsx                        marketing-y → SaaS
app/login/page.tsx                            forgot-password + returnTo + polish
app/page.tsx                                  word-cycle pace + polish
components/events/LifecyclePanel.tsx          broadcast client contract
lib/auth.tsx                                  mate default, non-blocking, demo isolation, password reset, 30s timeout
lib/db.ts                                     fast getUserContext, count queries, broadcast client
middleware.ts                                 NEW — cookie-presence auth gate (fast, no network)
supabase_rbac_migration_v6.sql                NEW — role default → mate (applied)
supabase_rbac_migration_v7.sql                NEW — search_path + bucket lockdown (applied)
supabase_rbac_migration_v8.sql                NEW — proper PUBLIC revoke (applied)
HANDOFF.md                                    this file
```

`.claude/` is gitignored (already in `.gitignore`).

## How to verify nothing is broken

```bash
npx tsc --noEmit   # should be silent
npm run build      # should complete; expect themeColor metadata warnings (cosmetic)
```

Build output should include `ƒ Proxy (Middleware)` — confirms `middleware.ts` is wired.

## Demo happy-path to verify before presenting

1. Sign up with a fresh email → land on dashboard → role should be `mate` (least privilege).
2. As a `president` account (e.g. user's main account), create an event → click into it → tasks render, panels load.
3. Click "Forgot?" on login → check email (Supabase sends real email if SMTP is configured).
4. Log out → reload `/dashboard` → middleware redirects to `/login?returnTo=/dashboard`.
5. Demo button still works → drops into local-only seeded data.

## Known gotchas

- **Cold-start Supabase**: free-tier projects sleep after ~5 min idle. First query post-wake takes 2–4s. User has been warned to hit the app ~30s before the demo.
- **Demo button + real auth**: if a real Supabase session is active when "Continue as Demo" is clicked, we sign out first. This means clicking Demo from logged-in state will visibly bounce through the auth state.
- **Existing wrongly-promoted accounts**: the v6 migration flips the column default but leaves existing `role='president'` rows alone (unless the user uncommented option (a) or (b) in the file). If users complain about wrong role, check `profiles.role` for their email and `UPDATE` manually.
- **The `pending_invite_token` localStorage key** is only cleared on successful accept. If a user starts but abandons an invite, the token stays in their localStorage indefinitely. Low-priority.
- **`lib/store.ts` is a localStorage shadow** of the Supabase schema — used for demo mode and as a fallback. Several db functions branch on `isSupabaseConfigured()` and write to both. Be careful when changing data shapes.
- **`createClient` HMR singleton** in `lib/supabase.ts` exists because Next.js HMR was creating competing clients that deadlocked on `navigator.locks`. Don't refactor it away without understanding why.

## Files most worth re-reading before changing auth

- `lib/auth.tsx` — AuthProvider, all client flows.
- `lib/supabase.ts` — singleton client setup, noopLock workaround.
- `lib/server/require-permission.ts` — server-side authz used by API routes.
- `lib/permissions.tsx` — `PERMISSIONS` map is the source of truth for UI-level RBAC.
- `middleware.ts` — protected-route gate.
- `supabase_rbac_migration*.sql` — read these top-to-bottom; v6 is the latest.

## What I did NOT do (open follow-ups)

- **Vercel deploy** — user wants it; not started.
- **Git commit** — not done.
- **Demo data seeding** — `supabase_seed_demo.sql` was not reviewed against the v5-era schema. Don't blindly run it.
- **Email confirmation page** — the `/auth/callback` page handles the redirect, but there's no explicit "your email is confirmed" UI. Currently fine because the callback just routes to `/dashboard`.
- **Tests** — the only test is `tests/rbac.test.ts`. No coverage of recent changes. `npm test` runs it.
- **Account deletion / sign-out-everywhere** — not implemented.
- **Resend confirmation email** — not implemented.

## Demo-day quick wins if the user has time

In priority order:
1. **Commit + deploy to Vercel** — biggest reliability win for the demo.
2. **Seed 3–4 events, ~10 tasks, 2–3 participants per event, 1 announcement, 1 meeting** — empty dashboards look unfinished.
3. **Hide the "Continue as Demo User" button** if the demo audience shouldn't see it — one-line change in `app/login/page.tsx`.
4. **Re-test forgot-password flow against real Supabase email** — make sure the redirect URL is in the Supabase project's allow-list.

## If you're the next Claude and the user asks "what's broken"

Run `git status` and `git diff --stat`. Then:
- If they're saying something is slow → check whether `middleware.ts` reverted to using `getUser()`, and check whether `lib/db.ts:getUserContext` still has the `getSession()` race.
- If they're saying new signups are admin → check `SELECT default_value FROM information_schema.columns WHERE table_name='profiles' AND column_name='role'` should be `'mate'::user_role`. If not, re-run v6 migration.
- If detail pages hang → check middleware first.
- If anything auth-related → re-read `lib/auth.tsx` end-to-end, the flows are subtle.
