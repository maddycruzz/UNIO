-- ════════════════════════════════════════════════════════════════════
-- INVITE ENHANCEMENTS — optional invitee_name + personal_message
-- ════════════════════════════════════════════════════════════════════
-- Run order: after supabase_rbac_migration_v8.sql.
-- Idempotent: safe to run multiple times.
--
-- Adds two optional columns to club_invitations:
--   - invitee_name      : the name the inviter expects the invitee to use
--   - personal_message  : a short note shown in the invite email + landing page
--
-- Neither is required by code, so existing invites without these fields
-- continue to work. The app reads them when present and skips them otherwise.

ALTER TABLE public.club_invitations
  ADD COLUMN IF NOT EXISTS invitee_name      TEXT,
  ADD COLUMN IF NOT EXISTS personal_message  TEXT,
  -- The following two columns may be missing on installs that only ran v2
  -- (both were added in v5). The RPC below and the accept_invitation function
  -- both reference them, so add them defensively here.
  ADD COLUMN IF NOT EXISTS invited_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── Public-readable preview RPC ─────────────────────────────────────
-- The /auth/accept-invite landing page calls this to render the invite
-- (role, inviter name, optional message) BEFORE the invitee is signed in.
-- Returns NULL if the token doesn't exist, is expired, or already accepted —
-- so callers can fall back to a generic "invalid invite" UI without leaking
-- which of those failure modes applied.
--
-- SECURITY DEFINER so we can read past RLS, but search_path is pinned to
-- prevent function-search-path injection (per v7 hardening).
CREATE OR REPLACE FUNCTION public.get_invite_preview(invite_token text)
RETURNS TABLE (
  email             text,
  role              user_role,
  invitee_name      text,
  personal_message  text,
  inviter_name      text,
  expires_at        timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ci.email,
    ci.role,
    ci.invitee_name,
    ci.personal_message,
    COALESCE(inviter.name, '')::text AS inviter_name,
    ci.expires_at
  FROM public.club_invitations ci
  LEFT JOIN public.profiles inviter ON inviter.id = ci.invited_by
  WHERE ci.token = invite_token
    AND ci.accepted_at IS NULL
    AND ci.expires_at > now();
END;
$$;

-- Lock down the default PUBLIC grant. Anyone — including unauthenticated
-- visitors landing on the invite page — needs to call this, so we grant to
-- anon as well as authenticated. The function only returns safe preview
-- fields and only for valid pending invites, so this is the intended surface.
REVOKE EXECUTE ON FUNCTION public.get_invite_preview(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_invite_preview(text) TO anon, authenticated;

-- Tell PostgREST to drop its cached schema so the new columns + RPC are
-- visible to API requests immediately, without waiting for a project restart.
NOTIFY pgrst, 'reload schema';
