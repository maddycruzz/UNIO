-- ═══════════════════════════════════════════════════════════════
-- Phase 3 RBAC Migration: Fix Profiles RLS and Workspace Isolation
-- Run this in your Supabase SQL Editor to update profiles RLS
-- ═══════════════════════════════════════════════════════════════

-- 1. Helper function to check if two users belong to the same club workspace
CREATE OR REPLACE FUNCTION public.share_club(user_a uuid, user_b uuid)
RETURNS boolean AS $$
BEGIN
  RETURN (
    user_a = user_b
    -- user_a is president of user_b
    OR EXISTS (SELECT 1 FROM public.club_members WHERE club_id = user_a AND user_id = user_b)
    -- user_b is president of user_a
    OR EXISTS (SELECT 1 FROM public.club_members WHERE club_id = user_b AND user_id = user_a)
    -- both are mates of the same president/club
    OR EXISTS (
      SELECT 1 FROM public.club_members m1
      JOIN public.club_members m2 ON m1.club_id = m2.club_id
      WHERE m1.user_id = user_a AND m2.user_id = user_b
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update Profiles RLS Select Policy
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles 
  FOR SELECT USING (
    id = auth.uid() 
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer'::user_role
    OR public.share_club(auth.uid(), id)
  );
