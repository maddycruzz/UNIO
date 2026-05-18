-- ═══════════════════════════════════════════════════════════════
-- Phase 5 — Approvals, Soft Delete, Audit, QoL
-- Adds deleted_at columns + approval_requests table. Run AFTER
-- supabase_phase4_migration.sql.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. SOFT DELETE COLUMNS ──────────────────────────────────────
ALTER TABLE public.events       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.tasks        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.meetings     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS events_deleted_at_idx       ON public.events(deleted_at);
CREATE INDEX IF NOT EXISTS tasks_deleted_at_idx        ON public.tasks(deleted_at);
CREATE INDEX IF NOT EXISTS meetings_deleted_at_idx     ON public.meetings(deleted_at);
CREATE INDEX IF NOT EXISTS participants_deleted_at_idx ON public.participants(deleted_at);

-- Note: we deliberately do NOT alter the existing SELECT policies to
-- exclude soft-deleted rows. The client-side data layer filters them
-- out on read, and the Trash UI explicitly fetches with deleted_at
-- IS NOT NULL. This keeps existing RLS contracts stable.

-- ── 2. APPROVAL REQUESTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL
                  CHECK (kind IN ('event_create','event_update','event_delete','task_create','task_delete','budget_change','sponsor_change','generic')),
  payload       JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected')),
  requester_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_note TEXT NOT NULL DEFAULT '',
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS approval_requests_club_pending_idx
  ON public.approval_requests(club_id, status, created_at DESC);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- Anyone in the club can SELECT (so requesters can see their own pending
-- requests and reviewers can see the queue).
DROP POLICY IF EXISTS "appr_select" ON public.approval_requests;
CREATE POLICY "appr_select" ON public.approval_requests FOR SELECT
  USING (public.has_club_access(club_id));

-- Anyone in the club can INSERT their own requests.
DROP POLICY IF EXISTS "appr_insert" ON public.approval_requests;
CREATE POLICY "appr_insert" ON public.approval_requests FOR INSERT
  WITH CHECK (
    public.has_club_access(club_id)
    AND requester_id = auth.uid()
  );

-- Only the president (auth.uid() = club_id) or a developer can UPDATE
-- (approve/reject). Requesters cannot edit their own pending requests.
DROP POLICY IF EXISTS "appr_update" ON public.approval_requests;
CREATE POLICY "appr_update" ON public.approval_requests FOR UPDATE
  USING (
    club_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer'::user_role
  );

-- Same for DELETE (cleanup).
DROP POLICY IF EXISTS "appr_delete" ON public.approval_requests;
CREATE POLICY "appr_delete" ON public.approval_requests FOR DELETE
  USING (
    club_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'developer'::user_role
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.approval_requests;

-- Refresh PostgREST so the new columns and table are visible immediately.
NOTIFY pgrst, 'reload schema';
