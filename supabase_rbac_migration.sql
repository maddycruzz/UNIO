-- ═══════════════════════════════════════════════════════════════
-- Phase 2 RBAC Migration
-- Run this in the Supabase SQL Editor to upgrade the existing schema
-- ═══════════════════════════════════════════════════════════════

-- 1. Create Roles Enum and Update Profiles
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('developer', 'president', 'mate');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'president';

-- 2. Create Club Members Table (Links Mates to Presidents)
CREATE TABLE IF NOT EXISTS public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role user_role not null default 'mate',
  created_at timestamptz not null default now(),
  unique(club_id, user_id)
);

-- Index for fast RLS checks
CREATE INDEX IF NOT EXISTS club_members_user_id_idx ON public.club_members(user_id);

-- 3. Access Helper Function (Simplifies RLS)
-- Returns true if the user is the President (organizer), a Mate in the club, or a Developer
CREATE OR REPLACE FUNCTION public.has_club_access(target_club_id uuid)
RETURNS boolean AS $$
  SELECT 
    auth.uid() = target_club_id 
    OR EXISTS (SELECT 1 FROM public.club_members WHERE user_id = auth.uid() AND club_id = target_club_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'developer'::user_role);
$$ LANGUAGE sql SECURITY DEFINER;

-- 4. Update RLS Policies
-- First, drop the existing strict policies
DROP POLICY IF EXISTS "events_select" ON public.events;
DROP POLICY IF EXISTS "events_insert" ON public.events;
DROP POLICY IF EXISTS "events_update" ON public.events;
DROP POLICY IF EXISTS "events_delete" ON public.events;

DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;

DROP POLICY IF EXISTS "meetings_select" ON public.meetings;
DROP POLICY IF EXISTS "meetings_insert" ON public.meetings;
DROP POLICY IF EXISTS "meetings_update" ON public.meetings;
DROP POLICY IF EXISTS "meetings_delete" ON public.meetings;

DROP POLICY IF EXISTS "participants_select" ON public.participants;
DROP POLICY IF EXISTS "participants_insert" ON public.participants;
DROP POLICY IF EXISTS "participants_update" ON public.participants;
DROP POLICY IF EXISTS "participants_delete" ON public.participants;

DROP POLICY IF EXISTS "activity_select" ON public.activity_log;
DROP POLICY IF EXISTS "activity_insert" ON public.activity_log;

-- Recreate with RBAC support
-- EVENTS
CREATE POLICY "events_select" ON public.events FOR SELECT USING (public.has_club_access(organizer_id));
CREATE POLICY "events_update" ON public.events FOR UPDATE USING (public.has_club_access(organizer_id));
-- Only Presidents and Developers can Create/Delete Events
CREATE POLICY "events_insert" ON public.events FOR INSERT WITH CHECK (auth.uid() = organizer_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer'::user_role);
CREATE POLICY "events_delete" ON public.events FOR DELETE USING (auth.uid() = organizer_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer'::user_role);

-- TASKS
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT USING (public.has_club_access(organizer_id));
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE USING (public.has_club_access(organizer_id));
-- Only Presidents and Developers can Create/Delete Tasks
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = organizer_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer'::user_role);
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE USING (auth.uid() = organizer_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer'::user_role);

-- MEETINGS
CREATE POLICY "meetings_select" ON public.meetings FOR SELECT USING (public.has_club_access(organizer_id));
CREATE POLICY "meetings_update" ON public.meetings FOR UPDATE USING (public.has_club_access(organizer_id));
-- Only Presidents and Developers can Create/Delete Meetings
CREATE POLICY "meetings_insert" ON public.meetings FOR INSERT WITH CHECK (auth.uid() = organizer_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer'::user_role);
CREATE POLICY "meetings_delete" ON public.meetings FOR DELETE USING (auth.uid() = organizer_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer'::user_role);

-- PARTICIPANTS (Mates can add walk-ins and check people in)
CREATE POLICY "participants_select" ON public.participants FOR SELECT USING (public.has_club_access(organizer_id));
CREATE POLICY "participants_update" ON public.participants FOR UPDATE USING (public.has_club_access(organizer_id));
CREATE POLICY "participants_insert" ON public.participants FOR INSERT WITH CHECK (public.has_club_access(organizer_id));
CREATE POLICY "participants_delete" ON public.participants FOR DELETE USING (auth.uid() = organizer_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer'::user_role);

-- ACTIVITY LOG (Mates can log actions)
CREATE POLICY "activity_select" ON public.activity_log FOR SELECT USING (public.has_club_access(organizer_id));
CREATE POLICY "activity_insert" ON public.activity_log FOR INSERT WITH CHECK (public.has_club_access(organizer_id));

-- RLS on new table
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "club_members_select" ON public.club_members;
CREATE POLICY "club_members_select" ON public.club_members FOR SELECT USING (club_id = auth.uid() OR user_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer'::user_role);
DROP POLICY IF EXISTS "club_members_insert" ON public.club_members;
CREATE POLICY "club_members_insert" ON public.club_members FOR INSERT WITH CHECK (club_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer'::user_role);
DROP POLICY IF EXISTS "club_members_delete" ON public.club_members;
CREATE POLICY "club_members_delete" ON public.club_members FOR DELETE USING (club_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer'::user_role);
