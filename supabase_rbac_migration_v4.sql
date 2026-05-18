-- ═══════════════════════════════════════════════════════════════
-- Phase 4 RBAC Migration: Enable Collaborative Task & Meeting Operations
-- Run this in your Supabase SQL Editor to update policies
-- ═══════════════════════════════════════════════════════════════

-- 1. Update TASKS Policies
-- Drop strict president-only policies
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;

-- Recreate with full collaborative access (allows mates with club membership to insert and delete tasks)
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT WITH CHECK (public.has_club_access(organizer_id));
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE USING (public.has_club_access(organizer_id));


-- 2. Update MEETINGS Policies
-- Drop strict president-only policies
DROP POLICY IF EXISTS "meetings_insert" ON public.meetings;
DROP POLICY IF EXISTS "meetings_delete" ON public.meetings;

-- Recreate with full collaborative access (allows mates with club membership to organize and delete meetings)
CREATE POLICY "meetings_insert" ON public.meetings FOR INSERT WITH CHECK (public.has_club_access(organizer_id));
CREATE POLICY "meetings_delete" ON public.meetings FOR DELETE USING (public.has_club_access(organizer_id));
