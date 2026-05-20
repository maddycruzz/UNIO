-- ════════════════════════════════════════════════════════════════════
-- HOTFIX — president can't see invited mates on the Team page.
-- Root cause: the profiles RLS SELECT policy may not include the
-- share_club() clause on this project, so the president's lookup of
-- mate profiles returns empty even though the club_members row exists.
--
-- Fix: expose a SECURITY DEFINER RPC `get_team_members` that returns
-- the president + every mate of the caller's club, bypassing RLS.
--
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_team_members()
RETURNS TABLE (
  id        UUID,
  name      TEXT,
  email     TEXT,
  role      user_role,
  initials  TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id  UUID := auth.uid();
  v_caller_role user_role;
  v_club_id    UUID;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN;
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;

  -- Determine which club the caller is asking about.
  -- President / developer: their own club (club_id = their user id).
  -- Mate: look up the club they belong to via club_members.
  IF v_caller_role IN ('president'::user_role, 'developer'::user_role) THEN
    v_club_id := v_caller_id;
  ELSE
    SELECT club_id INTO v_club_id
      FROM public.club_members
     WHERE user_id = v_caller_id
     LIMIT 1;
  END IF;

  IF v_club_id IS NULL THEN
    RETURN;
  END IF;

  -- Return the president of that club …
  RETURN QUERY
    SELECT p.id,
           p.name,
           COALESCE(p.email, u.email, '') AS email,
           p.role,
           p.initials
      FROM public.profiles p
      LEFT JOIN auth.users u ON u.id = p.id
     WHERE p.id = v_club_id;

  -- … plus every mate in club_members, joined to their profile.
  RETURN QUERY
    SELECT p.id,
           p.name,
           COALESCE(p.email, u.email, '') AS email,
           cm.role,
           p.initials
      FROM public.club_members cm
      JOIN public.profiles p ON p.id = cm.user_id
      LEFT JOIN auth.users u ON u.id = cm.user_id
     WHERE cm.club_id = v_club_id
       AND cm.user_id <> v_club_id;  -- president is already returned above
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_team_members() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_team_members() TO authenticated;
