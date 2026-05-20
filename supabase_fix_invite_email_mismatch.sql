-- ════════════════════════════════════════════════════════════════════
-- HOTFIX — accept_invitation: stop rejecting on email mismatch when
-- profiles.email is empty / stale. Compare against auth.users.email
-- (canonical) instead of profiles.email.
--
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.accept_invitation(invite_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite       public.club_invitations;
  v_caller_id    UUID := auth.uid();
  v_caller_email TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Read the canonical email from auth.users (always set by Supabase Auth).
  -- Falls back to profiles.email only if for some reason auth.users.email is null.
  SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;
  IF v_caller_email IS NULL OR v_caller_email = '' THEN
    SELECT email INTO v_caller_email FROM public.profiles WHERE id = v_caller_id;
  END IF;

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

  -- Email check: only enforce when we actually have a caller email AND it
  -- differs from the invite. If profiles.email + auth.users.email are both
  -- blank, skip — the invite token itself is the secret.
  IF v_caller_email IS NOT NULL
     AND v_caller_email <> ''
     AND lower(v_caller_email) <> lower(v_invite.email) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invite_email_mismatch');
  END IF;

  -- Backfill profiles.email so future flows that read it work correctly.
  UPDATE public.profiles
     SET email = COALESCE(NULLIF(email, ''), v_caller_email)
   WHERE id = v_caller_id;

  -- Bind the user to the club.
  INSERT INTO public.club_members (club_id, user_id, role)
    VALUES (v_invite.club_id, v_caller_id, v_invite.role)
    ON CONFLICT (club_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  -- Promote profile role unless they're already a developer/president.
  UPDATE public.profiles
     SET role = v_invite.role
   WHERE id = v_caller_id
     AND role NOT IN ('developer'::user_role, 'president'::user_role);

  -- Mark the invitation consumed.
  UPDATE public.club_invitations
     SET accepted_at = now(),
         accepted_by = v_caller_id
   WHERE id = v_invite.id;

  RETURN jsonb_build_object('ok', true, 'club_id', v_invite.club_id, 'role', v_invite.role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;

-- ── One-time backfill: copy auth.users.email into profiles.email
--    for any existing user whose profile email is missing.
UPDATE public.profiles p
   SET email = u.email
  FROM auth.users u
 WHERE p.id = u.id
   AND (p.email IS NULL OR p.email = '')
   AND u.email IS NOT NULL
   AND u.email <> '';
