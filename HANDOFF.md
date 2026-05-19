# UNIO — Session Handoff

> **You are the next Claude. Read this once, then you're caught up. User is presenting tomorrow — treat everything as demo-critical.**

## TL;DR

UNIO is a campus event-management dashboard (Next.js 16 + Supabase). A previous session did a deep auth + perf + security overhaul. **Everything is committed as `3d417f7`. All three Supabase migrations (v6, v7, v8) have been applied to the live project.** Demo prep (Vercel deploy, seed data, rehearsal) is still pending.

---

## Project facts

- **Working dir**: `/Users/bharath/projects/UNIO-main`
- **Branch**: `main` (committed locally, **not pushed** to GitHub yet)
- **Latest commit**: `3d417f7 feat: auth hardening, perf fixes, and demo-ready security cleanup`
- **Git user**: `maddycruzz` / `sarasubharath1897@gmail.com`
- **Date this was last updated**: 2026-05-19 (evening before demo)
- **User's plan**: Supabase Free tier
- **App description**: campus event-management dashboard. RBAC roles `developer` > `president` > `mate`. Mostly client-side React (`"use client"`), one server route (`/api/events/[eventId]/broadcast`), one middleware (`middleware.ts`). Security boundary is Supabase RLS at the database.

### Stack
```
Next.js 16.1.6 (App Router)        next dev / next build
React 19.2.3
Supabase (@supabase/ssr 0.10.3, @supabase/supabase-js 2.98.0)
DM Sans, Tailwind 4, framer-motion, @dnd-kit, lucide-react
ENV: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (.env.local)
     RESEND_API_KEY, RESEND_FROM_EMAIL (optional, for /api/events/.../broadcast)
```

---

## Status as of handoff

### ✅ Done
- v6 migration applied — `profiles.role` default flipped to `'mate'` (was `'president'`, every signup was admin)
- v7 migration applied — `search_path` pinned on all `SECURITY DEFINER` functions; `event-files` storage bucket no longer leaks file listings
- v8 migration applied — `REVOKE EXECUTE FROM PUBLIC` + selective `GRANT TO authenticated` on private RPCs (v7 only revoked from `anon`, which inherits `PUBLIC`, so it didn't work — v8 is the correct version)
- Alt account that became president before v6 was manually demoted via `UPDATE`
- Auth timeout error `"Supabase is offline"` fixed (was firing falsely at 10s)
- All work committed (`3d417f7`)
- This file (HANDOFF.md) created/updated

### ❌ Pending — what the user needs before tomorrow
1. **Push to GitHub** (`git push origin main`) — local commit only right now. Push enables Vercel git-deploy and serves as backup if the laptop dies tonight.
2. **Deploy to Vercel** — projector + laptop wifi is the #1 demo killer. User wants this.
3. **Seed demo data** — empty dashboards look unfinished. `supabase_seed_demo.sql` exists but **has not been audited against the v6/v7/v8 schema**. Read it first; don't run blind.
4. **End-to-end rehearsal** — user should walk through the actual demo flow once.
5. **Warm Supabase ~30s before presenting** — free tier hibernates after ~5 min idle. First query post-wake is 2–4s. Warm by visiting the app.

### Final Supabase linter state (acceptable — don't waste time on these)
- ✅ `function_search_path_mutable` → 0 (was 2)
- ✅ `public_bucket_allows_listing` → 0 (was 1)
- ✅ `anon_security_definer_function_executable` → **4 remaining, all intentional**: `get_public_event`, `register_for_event`, `submit_feedback`, `cancel_registration` (these power the unauthenticated public-registration flow at `/r/[eventId]`)
- ⚠️ `authenticated_security_definer_function_executable` → **11 remaining, all by design**. The linter flags every `SECURITY DEFINER` as a heads-up. These functions need elevated privs to bypass RLS; rewriting them to `SECURITY INVOKER` would break the app. **Will never go to zero unless the app is rearchitected. Don't try.**
- ⚠️ `auth_leaked_password_protection` → still on. **This is a Pro-plan feature; user is on Free.** Cannot enable. Skip.
- ⚠️ ~70 `auth_rls_initplan` / `multiple_permissive_policies` / `unindexed_foreign_keys` / `unused_index` warnings — **deliberately deferred**. They're scale-at-1000+-rows perf hygiene; user's slow-query log confirmed all queries run at 1–2ms. **Don't bulk-rewrite ~50 policies the night before a demo.**

---

## What was changed in the recent sessions

### Auth — overhauled end-to-end
- **Default role** is now `'mate'` everywhere. Client (`lib/auth.tsx` × 5 sites) AND DB (`supabase_rbac_migration_v6.sql` flips column default + patches `handle_new_user()` trigger).
- **OAuth/PKCE callback** (`app/auth/callback/page.tsx`) now explicitly calls `exchangeCodeForSession(code)`. Was just waiting for `user` to populate, which never happened on PKCE (Supabase default).
- **Forgot password**: new `"forgot"` tab on `/login` + new `/auth/reset-password` page. `sendPasswordReset` and `updatePassword` added to AuthContext.
- **Server middleware** (`middleware.ts`): redirects unauthenticated requests on `/dashboard/*` and `/admin/*` to `/login?returnTo=…`. **Uses cookie-presence check, NOT `getUser()`.** Switching to `getUser()` will hang RSC fetches on dynamic routes — don't do it.
- **Invite returnTo**: `app/auth/accept-invite/page.tsx` reads `pending_invite_token` from localStorage and auto-accepts once auth is ready. Login page honors `?returnTo=` (same-origin only).
- **Demo mode isolated**: `loginAsDemo` no longer attempts a real Supabase login with seeded creds. Signs out any real session first, uses local-only data.
- **Non-blocking profile fetch**: `onAuthStateChange`, `login`, and `signup` no longer await the `profiles.role` lookup. They set the user immediately with cached role and refresh in background.
- **Auth timeout**: bumped 10s → 30s. Old 10s false-positived as `"Supabase is offline"` on slow networks even when Supabase was fine. Internal sentinel is `"auth_timeout"` with user-facing message *"Sign-in is taking longer than usual. Check your connection and retry."*

### Performance — pages were taking ~10s, now snappy
- **Auth hydration**: `useState` is now seeded synchronously from `localStorage` so first paint is instant when a session exists. Was a 4s `getSession()` race.
- **`getUserContext()`** (`lib/db.ts`): localStorage-first, skips `getSession()` entirely on the happy path. Reads JWT directly from `sb-*-auth-token`. Used to be a 3s race.
- **Mate `activeClubId` cache**: stored in `localStorage` under `unio_mate_club_v1` to skip a round-trip on every write. Cleared on logout.
- **`getDashboardStats`**: was loading 4 full tables (`events`, `tasks`, `participants`, `meetings`) → now uses `count: "exact", head: true` HEAD queries. Zero rows transferred.
- **Middleware**: was doing `supabase.auth.getUser()` (network call to `/auth/v1/user`) → now does cookie-presence check (zero network). **This was the cause of "detail page hangs for 10s, refresh works" — the RSC fetch was waiting on Supabase auth.**
- **Event detail page** (`app/dashboard/events/[id]/page.tsx`): `loadTasks` + `getEventById` were serial → now `Promise.all`.

### Security
- **`POST /api/events/[eventId]/broadcast`** was an unauthenticated open email relay. Now requires `events.broadcast` permission via `requirePermission` and pulls recipients server-side via the caller's RLS-scoped Supabase session. Client no longer sends `recipients[]`.
- **Migration v6** — see above.
- **Migration v7** — pinned `search_path = public, pg_temp` on every `SECURITY DEFINER` function (search-path injection defense). Dropped the broad `SELECT` policy on the `event-files` storage bucket (it let `anon` list bucket contents; URL access still works).
- **Migration v7 had a bug** that v8 fixes. **Critical Postgres lesson — read this:** When you `CREATE FUNCTION`, Postgres implicitly grants `EXECUTE` to `PUBLIC`. `REVOKE EXECUTE … FROM anon` does nothing because `anon` inherits from `PUBLIC`. **Always `REVOKE EXECUTE … FROM PUBLIC` instead, then re-grant to specific roles.** v8 does this correctly.
- **Migration v8** — `REVOKE EXECUTE … FROM PUBLIC` then `GRANT … TO authenticated` for private RPCs. Kept anon on the four intentionally-public ones. `handle_new_user` is fully locked (trigger-only, no RPC).

### UI polish
- Landing page word-cycle animation: `WORDS_PER_VIEWPORT = 1.7` (was 1.0), section height now ~570vh (was 900vh). One scroll viewport now skips ~1.7 words.
- SaaS-ification of login, dashboard sidebar, dashboard hero, landing nav and CTA: dropped marketing-y glows, gradient buttons, `whileHover: scale 1.02` bounces. Solid colors, consistent `rounded-10`, font-weight 600 default.

---

## How to verify nothing is broken (60s sanity check)

```bash
npx tsc --noEmit   # should be silent
npm run build      # should complete; expect themeColor metadata warnings (cosmetic)
```

Build output should include `ƒ Proxy (Middleware)` — confirms `middleware.ts` is wired.

### Demo happy-path
1. Sign up with a fresh email → land on dashboard → role should be `mate` (least privilege).
2. As a `president` account (user's main account), create an event → click into detail page → tasks render, panels load.
3. Click "Forgot?" on login → email arrives (assuming Supabase SMTP is set).
4. Log out → hit `/dashboard` directly → middleware redirects to `/login?returnTo=/dashboard`.
5. Click "Continue as Demo User" → local-only seeded data loads.

### Where to look when the user complains
| Symptom | First place to look |
|---|---|
| "Something is slow" | `middleware.ts` (did anyone re-add `getUser()`?), `lib/db.ts:getUserContext` (did the `getSession()` race come back?) |
| "Detail pages hang" | Middleware — same as above |
| "New signups become admin" | `SELECT column_default FROM information_schema.columns WHERE table_name='profiles' AND column_name='role'` should be `'mate'::user_role`. If not, re-run v6. Also check `handle_new_user()` body. |
| "Supabase is offline" error | The 10s timeout came back. Check `AUTH_TIMEOUT_MS` in `lib/auth.tsx` (should be `30_000`). |
| "Forgot password link expired" | Supabase project's Site URL + redirect-URLs allowlist. The reset link redirects to `/auth/reset-password` — ensure that's allowed. |
| Anything auth-related | Re-read `lib/auth.tsx` end-to-end — the flows are subtle (sync hydrate, background profile refresh, demo isolation, cached role). |

---

## Known gotchas (landmines for the unwary)

1. **Cold-start Supabase**: free-tier projects sleep after ~5 min idle. First query post-wake takes 2–4s. User has been warned to hit the app ~30s before presenting.

2. **The Postgres `PUBLIC` grant trap** — see the v7→v8 story above. Always `REVOKE FROM PUBLIC`, never just from `anon`.

3. **`lib/store.ts` is a localStorage shadow** of the Supabase schema. Used for demo mode and as a network-down fallback. Several `lib/db.ts` functions branch on `isSupabaseConfigured()` and dual-write. **Don't change data shapes without updating both sides.**

4. **`createClient` HMR singleton** in `lib/supabase.ts` (note `noopLock` workaround). Exists because Next.js HMR was creating competing clients that deadlocked on `navigator.locks`. **Don't refactor it away without understanding why** — you will reintroduce the lock deadlock.

5. **Demo button + real auth**: if a real Supabase session is active when "Continue as Demo" is clicked, we sign out first. Clicking Demo from a logged-in state visibly bounces through auth state. Acceptable.

6. **Existing wrongly-promoted accounts**: v6 only flipped the column default. Existing `role='president'` rows are untouched. If a user complains about wrong role, manually `UPDATE profiles SET role='mate' WHERE email='…'`. v6 file has commented-out cleanup options (a) and (b) — read them before bulk-running.

7. **The `pending_invite_token` localStorage key** is only cleared on successful invite-accept. Abandoned invites leave the token in browser storage indefinitely. Low priority.

8. **Linter warnings that look scary but aren't actionable for this user**:
   - `authenticated_security_definer_function_executable` × 11 — functions need `SECURITY DEFINER` to bypass RLS for legitimate cross-table writes. Cannot be `SECURITY INVOKER`. **Will never go away.**
   - `auth_leaked_password_protection` — Pro-plan feature. Cannot enable on Free.
   - ~50 `auth_rls_initplan` — perf-at-scale. Doesn't bite at user's data size.

---

## Files most worth re-reading before touching auth

- `lib/auth.tsx` — AuthProvider, all client auth flows.
- `lib/supabase.ts` — singleton client setup, noopLock workaround.
- `lib/server/require-permission.ts` — server-side authz used by API routes.
- `lib/permissions.tsx` — `PERMISSIONS` map is the source of truth for UI-level RBAC.
- `middleware.ts` — protected-route gate. **Don't switch to `getUser()`.**
- `supabase_rbac_migration*.sql` — read v6, v7, v8 in order. v8 is the latest.

---

## What was in commit `3d417f7`

17 files, +1154/-320. Single commit covering this session's work:

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

`.claude/` is intentionally untracked (local IDE config).

---

## What was NOT done (open follow-ups, none demo-critical)

- **Vercel deploy** — user wants it, pending.
- **Push to GitHub** — committed locally, not pushed.
- **Demo data seeding** — `supabase_seed_demo.sql` predates v5; needs review.
- **Email confirmation success page** — `/auth/callback` handles the redirect silently. No "your email is confirmed!" UI. Routes straight to `/dashboard`. Fine for now.
- **Tests** — only `tests/rbac.test.ts` exists. `npm test` runs it. No coverage of session changes.
- **Account deletion / sign-out-everywhere** — not implemented.
- **Resend confirmation email** — not implemented.
- **The ~70 perf-at-scale linter warnings** — see status section above. Real but not pressing.

---

## Demo-day quick wins if the user has time

In priority order:
1. **Push + Vercel deploy** — biggest reliability win for tomorrow.
2. **Seed 3–4 events, ~10 tasks, 2–3 participants per event, 1 announcement, 1 meeting** — empty dashboards look unfinished.
3. **Hide "Continue as Demo User"** if the demo audience shouldn't see it — one-line conditional in `app/login/page.tsx`.
4. **Test forgot-password against real Supabase email** — confirm `/auth/reset-password` is in the project's redirect-URL allowlist.

---

## Final notes for the next Claude

- The user is non-technical-ish. They understand vocabulary like "linter," "RLS," and "migration" if you explain once, but **don't dump SQL or stack traces on them without context**. Show, then explain.
- They've been autonomous-grant happy (*"dont ask me any permission ur free to do anythign"*). Honor that — make decisions, don't over-clarify. But for **destructive ops** (force push, bulk SQL updates that affect prod data, deploys to live), still confirm.
- They care about UI polish and the *perception* of speed more than micro-optimizations.
- The demo is **tomorrow**. Anything you start should be finishable in the session, not left half-done.
