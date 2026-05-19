# UNIO — Session Handoff

> **You are the next Claude. Read this once, then you're caught up. App is now deployed to Vercel and the invite flow works end-to-end. Major sessions to date: auth+perf overhaul (2026-05-19), invite-feature buildout + production deploy (2026-05-20).**

## TL;DR

UNIO is a campus event-management dashboard (Next.js 16 + Supabase). It is **deployed live at https://unio-two.vercel.app**. Auth, dashboards, team invites with real Brevo SMTP email delivery, and invite acceptance all work end-to-end as of the verified test 2026-05-20.

The last session built the real team-invite feature (modal form → DB → Brevo email → public accept landing) and deployed to Vercel. Three live URL-tied integrations (Supabase Auth allowed-URLs, Google OAuth origins, Vercel env vars) are all configured. Schema is on the v8 + invite-enhancements baseline.

---

## Project facts

- **Working dir**: `/Users/bharath/projects/UNIO-main`
- **Branch**: `main` (pushed; auto-deploys to Vercel on push)
- **Production URL**: `https://unio-two.vercel.app`
- **Repo**: `github.com/maddycruzz/UNIO`
- **Git user**: `maddycruzz` / `sarasubharath1897@gmail.com`
- **Date this was last updated**: 2026-05-20
- **User's plan**: Supabase Free tier
- **App description**: campus event-management dashboard. RBAC roles `developer` > `president` > `mate`. Mostly client-side React (`"use client"`), API routes at `/api/events/[eventId]/broadcast` and `/api/team/invite-email`, one proxy/middleware (`proxy.ts`). Security boundary is Supabase RLS at the database.

### Stack
```
Next.js 16.1.6 (App Router, Turbopack)         next dev / next build
React 19.2.3
Supabase (@supabase/ssr 0.10.3, @supabase/supabase-js 2.98.0)
nodemailer 6.x (SMTP transport, added 2026-05-20)
DM Sans, Tailwind 4, framer-motion, @dnd-kit, lucide-react

ENV (.env.local locally, Vercel Production+Preview in prod):
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SMTP_HOST=smtp-relay.brevo.com
  SMTP_PORT=587
  SMTP_USER (Brevo SMTP login, ends in @smtp-brevo.com)
  SMTP_PASS (Brevo SMTP key, starts with xsmtpsib-)
  MAIL_FROM=UNIO <verified-sender@email>
  RESEND_API_KEY, RESEND_FROM_EMAIL (legacy, optional — SMTP takes priority)
```

---

## Status as of handoff

### ✅ Live and verified working in production
- **Vercel deploy live** at https://unio-two.vercel.app, auto-deploys from `main`
- **Auth**: email/password + Google OAuth working on the production URL
- **Invite flow E2E**: president invites by email → Brevo delivers branded HTML email → recipient clicks link → signs up → accepted into the club with the chosen role
- **Schema**: all migrations applied — v6, v7, v8, and `supabase_invite_enhancements.sql`
- **Brevo SMTP**: configured with two verified senders (`sarasubharath1897@gmail.com`, `unio.build@gmail.com`)

### ✅ Done in the 2026-05-20 session
- **Real invite feature** built end-to-end (see "Invite feature architecture" below)
- **Brevo SMTP integration** with provider auto-selection (SMTP > Resend > noop fallback)
- **Schema self-heal**: `supabase_invite_enhancements.sql` now defensively adds `invited_by`, `accepted_by`, `invitee_name`, `personal_message` so installs on the v2 baseline still work
- **`get_invite_preview(token)`** RPC for pre-auth landing-page rendering
- **Hydration fixes**: login page + dashboard layout mounted-gate pattern
- **Performance fixes**: optimistic signout (was 5s blocking), tasks-page loading skeleton (was blank-on-first-load), announcement delete timeout
- **UX primitives**: `components/ui/Toast.tsx` and `components/ui/ConfirmDialog.tsx`; all `alert()` and `confirm()` callsites replaced (15 + 5 sites across dashboard pages and event/cert sub-components)
- **`middleware.ts` → `proxy.ts`** rename for Next 16 convention; now a no-op pass-through (the localStorage Supabase client isn't visible server-side, so server-side auth gating is pointless — RLS is the real boundary)
- **Console noise reduced**: `loadAnnouncements` / `loadCommentsFor` transient network errors demoted from `error` to `warn`
- **Vercel deploy** completed; env vars set on Production + Preview scopes
- **Supabase Auth URL Configuration** updated for production URL (Site URL + Redirect URLs)
- **Google Cloud OAuth** Authorized JavaScript origins updated with production URL

### ❌ Open follow-ups (none blocking)
1. **Domain verification for Brevo** — currently sending from `sarasubharath1897@gmail.com` / `unio.build@gmail.com`. Both work but Brevo flags both as "Freemail domain is not recommended". For polish, verify a real domain in Brevo dashboard.
2. **No re-invite UI** — sending a second invite to the same email creates a second `club_invitations` row (token unique, email is not). Low-priority cleanup.
3. **`pending_invite_token` localStorage** isn't cleared on abandoned invite acceptance — same as previous session note, still unaddressed.
4. **`supabase_seed_demo.sql`** still predates v5; not audited against current schema.
5. **The ~70 perf-at-scale linter warnings** — same as previous session, still deferred.

---

## Invite feature architecture (the centerpiece of this session)

### User journey
1. President signs into UNIO at https://unio-two.vercel.app/dashboard/team
2. Clicks "Invite Member" → modal with: email (required), name (optional), role (Mate / Co-president), personal note (≤500 chars)
3. Submits → row inserted into `club_invitations` → `/api/team/invite-email` called → Brevo sends a branded dark-themed HTML email
4. Recipient gets email → clicks "Accept invitation" → lands on `https://unio-two.vercel.app/auth/accept-invite?token=…`
5. Pre-auth landing page calls `get_invite_preview(token)` (SECURITY DEFINER RPC granted to anon) → shows inviter name, role, personal note
6. Recipient signs up with the invited email → token stashed in `localStorage` → after auth, page auto-calls `accept_invitation(token)` RPC → user is added to `club_members` with the right role → redirect to `/dashboard`

### Key files
| File | Role |
|---|---|
| `app/dashboard/team/page.tsx` | Invite modal form with name/role/message fields, success state with copy-link button, surfaces `inviteEmailError` in a red diagnostic box |
| `app/api/team/invite-email/route.ts` | Server route — verifies invite via `get_invite_preview` RPC, then sends via SMTP (nodemailer) or Resend (HTTP) or noop. Authz anchored to DB row existence (RLS gated the insert). |
| `app/auth/accept-invite/page.tsx` | Pre-auth landing page; fetches preview, shows greeting + role + personal note + which email to sign up with |
| `lib/db.ts` (`inviteTeamMember`, `getInvitePreview`, `acceptTeamInvite`) | Data layer; insert tolerant of missing optional columns, calls the API route |
| `supabase_invite_enhancements.sql` | Idempotent migration: adds 4 optional columns + `get_invite_preview` RPC. Self-heals v2-baseline DBs. |

### Why provider auto-selection (SMTP > Resend > noop)
- SMTP wins because if someone configures `SMTP_HOST/USER/PASS`, they clearly intend to use it
- Resend is the fallback for setups that only have `RESEND_API_KEY` (legacy paths)
- Noop returns `{ ok: true, mode: "noop" }` so the UI shows "share link manually" rather than throwing — keeps fresh / demo environments functional with zero email config

### The `get_invite_preview` RPC pattern (worth understanding)
- The accept-invite page must render inviter/role/note **before** the visitor is authenticated (otherwise they can't decide whether to sign up)
- RLS on `club_invitations` doesn't grant anon SELECT (by design — pending invites for the whole org shouldn't be enumerable)
- Solution: `SECURITY DEFINER` RPC that returns only the safe preview columns, only for valid pending unexpired tokens, granted to `anon, authenticated`
- The `/api/team/invite-email` route uses the same RPC to verify the invite server-side (so the route doesn't need a service-role key)

### Things that broke during the buildout (so you don't trip on them again)
1. **`column ci.invited_by does not exist`** — the user's DB was on the v2 baseline, never fully migrated through v5. The RPC referenced `invited_by`. Fixed by making `supabase_invite_enhancements.sql` add the column defensively (`ADD COLUMN IF NOT EXISTS`).
2. **`column accepted_by does not exist`** — same root cause, surfaced when the friend hit Accept. Same fix.
3. **`invite_not_found`** — initial route did a direct `SELECT FROM club_invitations` using anon client; RLS returned zero rows. Switched to the RPC.
4. **`mode === "resend"` only counted as delivered** — `lib/db.ts:928` didn't recognize `mode: "smtp"` as success, so successful SMTP sends were marked as not-delivered. Fixed to accept both.
5. **"Supabase not configured" on Vercel** — env vars added AFTER the build are not in the bundle because `NEXT_PUBLIC_*` is compiled at build time. Requires explicit redeploy. **Always remind the user to redeploy after env var changes.**
6. **`window.location.origin` is `http://localhost:3000` during local dev** — invite links generated locally are unreachable for actual recipients. The deploy to Vercel is what made the feature usable for real people, not just a code change.

---

## What was changed in earlier sessions (historical — kept for context)

### Auth — overhauled end-to-end (2026-05-19)
- **Default role** is now `'mate'` everywhere. Client (`lib/auth.tsx` × 5 sites) AND DB (`supabase_rbac_migration_v6.sql` flips column default + patches `handle_new_user()` trigger).
- **OAuth/PKCE callback** (`app/auth/callback/page.tsx`) now explicitly calls `exchangeCodeForSession(code)`.
- **Forgot password**: `"forgot"` tab on `/login` + `/auth/reset-password` page.
- **Proxy/middleware**: started as a `getUser()` server gate, became cookie-presence check, **now a no-op** because the Supabase client is localStorage-based and not visible server-side. Real security is RLS.
- **Demo mode isolated**: `loginAsDemo` is local-only seeded data.
- **Non-blocking profile fetch**: `onAuthStateChange`, `login`, `signup` no longer await profile lookup.
- **Auth timeout**: bumped 10s → 30s.

### Performance (2026-05-19 + 2026-05-20)
- **Auth hydration**: synchronous `localStorage` seed → instant first paint
- **`getUserContext()`** reads JWT directly from `sb-*-auth-token` localStorage
- **Mate `activeClubId`** cached in localStorage (`unio_mate_club_v1`); cleared on logout
- **`getDashboardStats`**: HEAD-only count queries (`count: "exact", head: true`)
- **Event detail page**: `Promise.all` for parallel fetches
- **Optimistic signout** (2026-05-20): clear state + redirect immediately, `auth.signOut()` runs in background

### Security (2026-05-19)
- `POST /api/events/[eventId]/broadcast` — requires `events.broadcast` permission, recipients pulled server-side via caller's RLS-scoped session
- **Migration v6** — `profiles.role` default flipped `'president'` → `'mate'`
- **Migration v7** — `search_path = public, pg_temp` pinned on every `SECURITY DEFINER` function; `event-files` bucket no longer leaks listings
- **Migration v7→v8 lesson**: `CREATE FUNCTION` implicitly grants `EXECUTE` to `PUBLIC`. `REVOKE … FROM anon` does nothing because anon inherits PUBLIC. **Always `REVOKE EXECUTE … FROM PUBLIC` then re-grant to specific roles.** v8 does this correctly.
- **Migration v8** — proper PUBLIC revoke + selective grant to `authenticated`

---

## How to verify nothing is broken (60s sanity check)

```bash
npx tsc --noEmit   # should be silent
npm run build      # should complete clean
git status         # should be clean (or only show .claude/)
```

Open https://unio-two.vercel.app/login — login form renders ⇒ public env vars are baked in ⇒ deploy is healthy.

### Demo happy-path
1. Sign up with a fresh email at https://unio-two.vercel.app → land on dashboard → role should be `mate`.
2. As a `president` account, create an event → detail page loads → tasks/panels render.
3. From `/dashboard/team`, invite a real email → recipient gets a Brevo email → click link → sign up → accepted as the chosen role.
4. "Forgot?" on login → reset email arrives.
5. Log out → `/dashboard` is accessible (proxy is a no-op), but RLS-scoped queries return nothing → effectively a redirect-to-empty state.

### Where to look when the user complains
| Symptom | First place to look |
|---|---|
| "Supabase not configured" on prod after env changes | **Redeploy.** `NEXT_PUBLIC_*` only bakes in at build time. |
| Invite email "delivery failed" with red error box | The `inviteEmailError` text. Common: `invite_not_found_or_expired` → RPC not granted to anon, or migration not applied. `Invalid login` → bad SMTP creds. `554 sender not authorized` → `MAIL_FROM` not verified in Brevo. |
| Invite link goes to `localhost` | They generated the invite while running `next dev`. Use the production URL when inviting real people. |
| "column X does not exist" in invite flow | Re-run `supabase_invite_enhancements.sql` — it's idempotent and self-heals v2 baselines. |
| "Something is slow" | `lib/db.ts:getUserContext` (did the `getSession()` race come back?) — proxy.ts shouldn't be doing network calls. |
| "Detail pages hang" | Same as above — proxy.ts being made into a real auth gate again. |
| "New signups become admin" | `SELECT column_default FROM information_schema.columns WHERE table_name='profiles' AND column_name='role'` must be `'mate'::user_role`. |
| Anything auth-related | Re-read `lib/auth.tsx` end-to-end — sync hydrate, background profile refresh, demo isolation, cached role. |

---

## Known gotchas (landmines for the unwary)

1. **`NEXT_PUBLIC_*` is build-time only.** Any change to public env vars on Vercel requires a redeploy. The "env var set, error persists" bug will keep biting until this is internalized.

2. **Invite links contain `window.location.origin`** at generation time. Generating an invite at `localhost:3000` produces an unreachable link. Always test the invite flow on the production URL.

3. **Brevo "Freemail" warning** is informational, not blocking. Sending from `@gmail.com` works but Brevo will throttle/score against you at scale. Verify a real domain for production-grade sending.

4. **`proxy.ts` is intentionally a no-op.** It was previously a `getUser()` server gate, then a cookie-presence check, then made a no-op because the Supabase client is localStorage-based. **Do not "fix" this by adding auth checks** — RLS is the real boundary. Adding a server-side gate will break in non-obvious ways because the localStorage session isn't visible server-side.

5. **The Postgres `PUBLIC` grant trap** — `REVOKE FROM PUBLIC`, never just from `anon`. See v7→v8 story.

6. **`lib/store.ts` is a localStorage shadow** of the Supabase schema. Several `lib/db.ts` functions branch on `isSupabaseConfigured()` and dual-write. Don't change data shapes without updating both sides.

7. **`createClient` HMR singleton** in `lib/supabase.ts` (note `noopLock` workaround). Don't refactor it away — you will reintroduce a `navigator.locks` deadlock.

8. **`accept_invitation` RPC requires both `accepted_by` and `accepted_at` columns** to exist on `club_invitations`. Older v2-baseline DBs are missing them. The enhancement migration adds them defensively now.

9. **`MAIL_FROM` must be a verified sender in Brevo.** Listed under "Senders & IP" in the Brevo dashboard. If the dropdown shows red instead of green-Verified, the send will fail with `554 sender not authorized`.

10. **8 SQL migration files at repo root** (`supabase_phase{1-5}_migration.sql`, `supabase_rbac_migration_v{2-8}.sql`, `supabase_invite_enhancements.sql`) are NOT auto-applied. They must be run manually against Supabase in order. As of 2026-05-20, all are applied to the live project.

11. **Existing wrongly-promoted accounts**: v6 only flipped the column default. Any `role='president'` row from before v6 is untouched. Manually `UPDATE profiles SET role='mate' WHERE email='…'` if needed.

12. **Linter warnings that look scary but aren't actionable for this user**:
    - `authenticated_security_definer_function_executable` × 11 — by design, will never go away
    - `auth_leaked_password_protection` — Pro-plan feature, can't enable on Free
    - ~50 `auth_rls_initplan` — perf-at-scale, doesn't bite at user's data size

---

## Files most worth re-reading before touching invites or auth

- `app/api/team/invite-email/route.ts` — invite send pipeline, provider selection
- `app/auth/accept-invite/page.tsx` — pre-auth landing, auto-accept after sign-in
- `app/dashboard/team/page.tsx` — invite modal, error surfacing
- `lib/db.ts` (`inviteTeamMember`, `acceptTeamInvite`, `getInvitePreview`) — data layer
- `lib/auth.tsx` — AuthProvider, all client auth flows
- `lib/supabase.ts` — singleton client setup, noopLock workaround
- `lib/server/require-permission.ts` — server-side authz for `/api/events/.../broadcast`
- `lib/permissions.tsx` — `PERMISSIONS` map, source of truth for UI-level RBAC
- `proxy.ts` — currently a no-op; don't add auth checks here
- `supabase_rbac_migration_v8.sql` — most recent RBAC baseline
- `supabase_invite_enhancements.sql` — idempotent self-healing migration

---

## Recent commit history

```
[uncommitted as of handoff]  invite-email route SMTP/RPC fixes, schema self-heal, UI error surfacing
5a0e214                       pre-deploy bundle: dashboard polish, invite-email route, ConfirmDialog, Toast, proxy.ts rename
0388e76                       docs: rewrite HANDOFF.md with session status + landmines
3d417f7                       feat: auth hardening, perf fixes, and demo-ready security cleanup
b473d15                       feat(qol): trash, approvals, command palette, PWA manifest
5dd71e6                       feat(db): phase 5 migration and data layer
fd34a54                       fix(comms): drop PostgREST embed on author_id (FK targets auth.users)
```

There are likely uncommitted changes from the 2026-05-20 session (invite debugging cycle). Run `git status` and `git diff` before doing anything.

---

## Final notes for the next Claude

- The user is non-technical-ish. They understand vocabulary like "linter," "RLS," and "migration" if you explain once, but **don't dump SQL or stack traces on them without context**. Show, then explain.
- The user has given **standing autonomous-execution authorization** (*"i dont ask any persmission just imagine its accepted and run through dont wait for my input"*) — honor it. Make decisions, don't over-clarify. But for **destructive ops** (force push, bulk SQL updates against prod, deleting deploys, removing env vars), still confirm.
- They care about UI polish and the *perception* of speed more than micro-optimizations.
- **When errors surface, immediately add diagnostics to the UI** (red error box pattern used in the team page) rather than asking them to check server logs. The user can't see server logs.
- **Always check whether changes need a Vercel redeploy.** Code changes to server routes do (auto via push to main). Env var changes do (manual redeploy). Schema changes do not (DB is separate).
- The invite feature is the most recent major buildout — if you're picking up new work, the user may want polish on it (re-invite UI, invitation revoke, pending-invites list) or move on to something else entirely.
