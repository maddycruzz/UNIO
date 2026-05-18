-- ═══════════════════════════════════════════════════════════════
-- Phase 1 — Communication & Collaboration
-- New tables: announcements, announcement_reads, comments, notifications
-- All policies use the existing has_club_access() helper.
-- Run this AFTER supabase_rbac_migration_v5.sql.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. ANNOUNCEMENTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body_md    TEXT NOT NULL DEFAULT '',
  pinned     BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcements_club_id_idx ON public.announcements(club_id);
CREATE INDEX IF NOT EXISTS announcements_created_at_idx ON public.announcements(created_at DESC);

-- Tracks which announcements each user has dismissed/read.
CREATE TABLE IF NOT EXISTS public.announcement_reads (
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, announcement_id)
);

-- ── 2. COMMENTS (polymorphic on event/task/meeting) ─────────────
CREATE TABLE IF NOT EXISTS public.comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_type TEXT NOT NULL CHECK (parent_type IN ('event','task','meeting')),
  parent_id   TEXT NOT NULL,
  author_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body_md     TEXT NOT NULL,
  mentions    UUID[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comments_parent_idx ON public.comments(parent_type, parent_id);
CREATE INDEX IF NOT EXISTS comments_club_id_idx ON public.comments(club_id);

-- ── 3. NOTIFICATIONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('mention','assignment','due_soon','announcement','comment_reply')),
  payload    JSONB NOT NULL DEFAULT '{}',
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications(user_id, read_at NULLS FIRST, created_at DESC);

-- ══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE public.announcements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;

-- Announcements — read by anyone in the club; write by president/developer only.
DROP POLICY IF EXISTS "ann_select" ON public.announcements;
CREATE POLICY "ann_select" ON public.announcements FOR SELECT
  USING (public.has_club_access(club_id));

DROP POLICY IF EXISTS "ann_insert" ON public.announcements;
CREATE POLICY "ann_insert" ON public.announcements FOR INSERT WITH CHECK (
  author_id = auth.uid()
  AND (
    auth.uid() = club_id
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer'::user_role
  )
);

DROP POLICY IF EXISTS "ann_update" ON public.announcements;
CREATE POLICY "ann_update" ON public.announcements FOR UPDATE
  USING (author_id = auth.uid() OR auth.uid() = club_id);

DROP POLICY IF EXISTS "ann_delete" ON public.announcements;
CREATE POLICY "ann_delete" ON public.announcements FOR DELETE
  USING (author_id = auth.uid() OR auth.uid() = club_id);

-- Announcement reads — only the user manages their own rows.
DROP POLICY IF EXISTS "ann_reads_select" ON public.announcement_reads;
CREATE POLICY "ann_reads_select" ON public.announcement_reads FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ann_reads_insert" ON public.announcement_reads;
CREATE POLICY "ann_reads_insert" ON public.announcement_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Comments — read by anyone in the club; write by any member; delete own only
-- (or president cleanup).
DROP POLICY IF EXISTS "comments_select" ON public.comments;
CREATE POLICY "comments_select" ON public.comments FOR SELECT
  USING (public.has_club_access(club_id));

DROP POLICY IF EXISTS "comments_insert" ON public.comments;
CREATE POLICY "comments_insert" ON public.comments FOR INSERT WITH CHECK (
  public.has_club_access(club_id) AND author_id = auth.uid()
);

DROP POLICY IF EXISTS "comments_delete" ON public.comments;
CREATE POLICY "comments_delete" ON public.comments FOR DELETE
  USING (author_id = auth.uid() OR auth.uid() = club_id);

-- Notifications — only the recipient sees / updates their own.
-- Inserts are restricted to SECURITY DEFINER fan-out functions below.
DROP POLICY IF EXISTS "notif_select" ON public.notifications;
CREATE POLICY "notif_select" ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notif_update" ON public.notifications;
CREATE POLICY "notif_update" ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notif_delete" ON public.notifications;
CREATE POLICY "notif_delete" ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════
-- RPC: fanout_mentions
-- Called from the client after inserting a comment with mentions.
-- SECURITY DEFINER so the inserts succeed even though notifications
-- has no public INSERT policy (we don't want clients writing arbitrary
-- notification rows to other users).
-- Guards: caller must have club access, and the mentions array must
-- be a subset of the calling club's members.
-- ══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.fanout_mentions(UUID, UUID, UUID[], TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.fanout_mentions(
  p_club_id     UUID,
  p_comment_id  UUID,
  p_mentions    UUID[],
  p_parent_type TEXT,
  p_parent_id   TEXT
) RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT := 0;
BEGIN
  IF NOT public.has_club_access(p_club_id) THEN
    RAISE EXCEPTION 'forbidden: caller is not a member of the target club';
  END IF;

  IF p_mentions IS NULL OR array_length(p_mentions, 1) IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.notifications (user_id, type, payload)
  SELECT u,
         'mention',
         jsonb_build_object(
           'comment_id',  p_comment_id,
           'club_id',     p_club_id,
           'parent_type', p_parent_type,
           'parent_id',   p_parent_id
         )
  FROM unnest(p_mentions) AS u
  -- Only mention people who are actually in the club.
  WHERE u = p_club_id
     OR EXISTS (SELECT 1 FROM public.club_members WHERE user_id = u AND club_id = p_club_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fanout_mentions(UUID, UUID, UUID[], TEXT, TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════════
-- RPC: fanout_announcement
-- Writes one notification per club member (and the president)
-- when a new announcement is posted. Called from the client after
-- the announcement insert succeeds.
-- ══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.fanout_announcement(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.fanout_announcement(
  p_club_id        UUID,
  p_announcement_id UUID,
  p_title          TEXT
) RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT := 0;
BEGIN
  IF NOT public.has_club_access(p_club_id) THEN
    RAISE EXCEPTION 'forbidden: caller is not a member of the target club';
  END IF;

  INSERT INTO public.notifications (user_id, type, payload)
  SELECT cm.user_id,
         'announcement',
         jsonb_build_object('announcement_id', p_announcement_id, 'title', p_title, 'club_id', p_club_id)
  FROM public.club_members cm
  WHERE cm.club_id = p_club_id AND cm.user_id <> auth.uid()
  UNION
  -- The president themselves (auth.uid() = club_id) is the author,
  -- so we exclude them. But if a mate posts (developer override),
  -- the president should be pinged.
  SELECT p_club_id, 'announcement',
         jsonb_build_object('announcement_id', p_announcement_id, 'title', p_title, 'club_id', p_club_id)
  WHERE p_club_id <> auth.uid();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fanout_announcement(UUID, UUID, TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════════
-- Realtime publication
-- ══════════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
