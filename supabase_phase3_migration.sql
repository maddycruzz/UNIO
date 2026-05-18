-- ═══════════════════════════════════════════════════════════════
-- Phase 3 — Budgets, Sponsors, Files
-- Adds per-event budget tracking, sponsor management, and a file
-- attachment table backed by a Supabase Storage bucket. Run AFTER
-- supabase_phase2_migration.sql.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. BUDGET ENTRIES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budget_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('income','expense')),
  category    TEXT NOT NULL DEFAULT 'Other',
  label       TEXT NOT NULL,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  notes       TEXT NOT NULL DEFAULT '',
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budget_entries_event_id_idx ON public.budget_entries(event_id);
CREATE INDEX IF NOT EXISTS budget_entries_organizer_id_idx ON public.budget_entries(organizer_id);

ALTER TABLE public.budget_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "budget_select" ON public.budget_entries;
CREATE POLICY "budget_select" ON public.budget_entries FOR SELECT
  USING (organizer_id = auth.uid() OR public.has_club_access(organizer_id));

DROP POLICY IF EXISTS "budget_insert" ON public.budget_entries;
CREATE POLICY "budget_insert" ON public.budget_entries FOR INSERT
  WITH CHECK (organizer_id = auth.uid() OR public.has_club_access(organizer_id));

DROP POLICY IF EXISTS "budget_update" ON public.budget_entries;
CREATE POLICY "budget_update" ON public.budget_entries FOR UPDATE
  USING (organizer_id = auth.uid() OR public.has_club_access(organizer_id));

DROP POLICY IF EXISTS "budget_delete" ON public.budget_entries;
CREATE POLICY "budget_delete" ON public.budget_entries FOR DELETE
  USING (organizer_id = auth.uid() OR public.has_club_access(organizer_id));

-- ── 2. SPONSORS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sponsors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  tier         TEXT NOT NULL DEFAULT 'silver'
                 CHECK (tier IN ('platinum','gold','silver','bronze','partner')),
  status       TEXT NOT NULL DEFAULT 'prospect'
                 CHECK (status IN ('prospect','contacted','confirmed','declined')),
  amount       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  contact_name  TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  logo_url     TEXT,
  notes        TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sponsors_event_id_idx ON public.sponsors(event_id);

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sponsors_select" ON public.sponsors;
CREATE POLICY "sponsors_select" ON public.sponsors FOR SELECT
  USING (organizer_id = auth.uid() OR public.has_club_access(organizer_id));

DROP POLICY IF EXISTS "sponsors_insert" ON public.sponsors;
CREATE POLICY "sponsors_insert" ON public.sponsors FOR INSERT
  WITH CHECK (organizer_id = auth.uid() OR public.has_club_access(organizer_id));

DROP POLICY IF EXISTS "sponsors_update" ON public.sponsors;
CREATE POLICY "sponsors_update" ON public.sponsors FOR UPDATE
  USING (organizer_id = auth.uid() OR public.has_club_access(organizer_id));

DROP POLICY IF EXISTS "sponsors_delete" ON public.sponsors;
CREATE POLICY "sponsors_delete" ON public.sponsors FOR DELETE
  USING (organizer_id = auth.uid() OR public.has_club_access(organizer_id));

-- ── 3. EVENT FILES (metadata; bytes live in storage) ────────────
CREATE TABLE IF NOT EXISTS public.event_files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  organizer_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploaded_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind          TEXT NOT NULL DEFAULT 'attachment'
                  CHECK (kind IN ('cover','attachment','poster','sponsor_logo')),
  name          TEXT NOT NULL,
  mime          TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes    BIGINT NOT NULL DEFAULT 0,
  storage_path  TEXT NOT NULL,
  public_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_files_event_id_idx ON public.event_files(event_id);

ALTER TABLE public.event_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_files_select" ON public.event_files;
CREATE POLICY "event_files_select" ON public.event_files FOR SELECT
  USING (organizer_id = auth.uid() OR public.has_club_access(organizer_id));

DROP POLICY IF EXISTS "event_files_insert" ON public.event_files;
CREATE POLICY "event_files_insert" ON public.event_files FOR INSERT
  WITH CHECK (organizer_id = auth.uid() OR public.has_club_access(organizer_id));

DROP POLICY IF EXISTS "event_files_delete" ON public.event_files;
CREATE POLICY "event_files_delete" ON public.event_files FOR DELETE
  USING (organizer_id = auth.uid() OR public.has_club_access(organizer_id));

-- ── 4. Storage bucket: event-files ──────────────────────────────
-- Public bucket so cover images can be served via public URL. Files are
-- still write-protected by the RLS policies below.
INSERT INTO storage.buckets (id, name, public)
  VALUES ('event-files', 'event-files', true)
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Authenticated users can upload to their own folder (organizer_id/<event_id>/...).
DROP POLICY IF EXISTS "event_files_storage_insert" ON storage.objects;
CREATE POLICY "event_files_storage_insert" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-files'
    AND (auth.uid()::text = split_part(name, '/', 1)
         OR EXISTS (
           SELECT 1 FROM public.club_members cm
           WHERE cm.user_id = auth.uid()
             AND cm.club_id::text = split_part(name, '/', 1)
         ))
  );

DROP POLICY IF EXISTS "event_files_storage_delete" ON storage.objects;
CREATE POLICY "event_files_storage_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-files'
    AND (auth.uid()::text = split_part(name, '/', 1)
         OR EXISTS (
           SELECT 1 FROM public.club_members cm
           WHERE cm.user_id = auth.uid()
             AND cm.club_id::text = split_part(name, '/', 1)
         ))
  );

-- Anyone can read (since bucket is public).
DROP POLICY IF EXISTS "event_files_storage_select" ON storage.objects;
CREATE POLICY "event_files_storage_select" ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'event-files');

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.budget_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sponsors;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_files;
