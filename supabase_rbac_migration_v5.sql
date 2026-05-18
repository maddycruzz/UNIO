-- ═══════════════════════════════════════════════════════════════
-- Phase 5 RBAC Migration:
--   1. Add profiles.email (so the Team page can show real addresses
--      instead of the placeholder strings we used while only the
--      service-role admin API had access).
--   2. Add public.club_invitations table (referenced by inviteTeamMember
--      / acceptTeamInvite in lib/db.ts but never defined before).
--   3. Add public.accept_invitation RPC (called by lib/db.ts).
-- Run this in your Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. profiles.email ───────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill emails for existing users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- Index for invitation-acceptance lookups
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);

-- Update the new-user trigger to capture email going forward
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, initials, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    UPPER(LEFT(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email), 2)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- ── 2. club_invitations table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE,
  role        user_role NOT NULL DEFAULT 'mate',
  invited_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add columns to pre-existing club_invitations tables (CREATE TABLE IF NOT
-- EXISTS above is a no-op if the table already lives in the schema).
ALTER TABLE public.club_invitations ADD COLUMN IF NOT EXISTS invited_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.club_invitations ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE public.club_invitations ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.club_invitations ADD COLUMN IF NOT EXISTS expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days';
ALTER TABLE public.club_invitations ADD COLUMN IF NOT EXISTS role        user_role NOT NULL DEFAULT 'mate';

-- Tell PostgREST to drop its cached schema so the new columns are visible
-- to API requests immediately, without waiting for a project restart.
NOTIFY pgrst, 'reload schema';

CREATE INDEX IF NOT EXISTS club_invitations_token_idx ON public.club_invitations(token);
CREATE INDEX IF NOT EXISTS club_invitations_club_id_idx ON public.club_invitations(club_id);

ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;

-- President sees their own invitations; developer sees all.
DROP POLICY IF EXISTS "invitations_select" ON public.club_invitations;
CREATE POLICY "invitations_select" ON public.club_invitations FOR SELECT
  USING (
    club_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer'::user_role
  );

-- Only president / developer can issue invitations.
DROP POLICY IF EXISTS "invitations_insert" ON public.club_invitations;
CREATE POLICY "invitations_insert" ON public.club_invitations FOR INSERT
  WITH CHECK (
    club_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer'::user_role
  );

-- Acceptance updates accepted_at — only the invitee can do that.
DROP POLICY IF EXISTS "invitations_update" ON public.club_invitations;
CREATE POLICY "invitations_update" ON public.club_invitations FOR UPDATE
  USING (
    -- Accepting their own invite (matched by email)
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND email = club_invitations.email)
    OR club_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer'::user_role
  );

DROP POLICY IF EXISTS "invitations_delete" ON public.club_invitations;
CREATE POLICY "invitations_delete" ON public.club_invitations FOR DELETE
  USING (
    club_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer'::user_role
  );

-- ── 3. accept_invitation RPC ────────────────────────────────────
-- Validates the token, inserts into club_members, marks invitation accepted.
-- SECURITY DEFINER so it can bypass RLS for the cross-table writes,
-- but the caller is still authenticated via auth.uid().
-- Drop first in case an older version exists with a different return type
-- (Postgres won't let CREATE OR REPLACE change the return type).
DROP FUNCTION IF EXISTS public.accept_invitation(TEXT);

CREATE OR REPLACE FUNCTION public.accept_invitation(invite_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invite public.club_invitations;
  v_caller_id UUID := auth.uid();
  v_caller_email TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT email INTO v_caller_email FROM public.profiles WHERE id = v_caller_id;

  SELECT * INTO v_invite FROM public.club_invitations
   WHERE token = invite_token
   LIMIT 1;

  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invite_not_found');
  END IF;

  IF v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invite_already_accepted');
  END IF;

  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invite_expired');
  END IF;

  -- Email check is best-effort: we accept either an exact email match,
  -- or no profile email yet (handles brand-new signups before backfill).
  IF v_caller_email IS NOT NULL
     AND v_caller_email <> ''
     AND lower(v_caller_email) <> lower(v_invite.email) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invite_email_mismatch');
  END IF;

  -- Bind the user to the club.
  INSERT INTO public.club_members (club_id, user_id, role)
    VALUES (v_invite.club_id, v_caller_id, v_invite.role)
    ON CONFLICT (club_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  -- Promote profile to mate (unless already developer/president).
  UPDATE public.profiles
     SET role = v_invite.role
   WHERE id = v_caller_id AND role NOT IN ('developer'::user_role, 'president'::user_role);

  -- Mark the invitation consumed.
  UPDATE public.club_invitations
     SET accepted_at = now(), accepted_by = v_caller_id
   WHERE id = v_invite.id;

  RETURN jsonb_build_object('ok', true, 'club_id', v_invite.club_id, 'role', v_invite.role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;
