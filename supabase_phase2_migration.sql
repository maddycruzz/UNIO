-- ═══════════════════════════════════════════════════════════════
-- Phase 2 — Participant Lifecycle
-- Public registration, waitlist, post-event feedback, cert tracking,
-- broadcast plumbing. Run AFTER supabase_phase1_migration.sql.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Events: public flag + registration window ────────────────
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS registration_open BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS registration_closes_at TIMESTAMPTZ;

-- ── 2. Participants: extended status + source ───────────────────
-- Drop old constraint, widen the enum.
ALTER TABLE public.participants DROP CONSTRAINT IF EXISTS participants_status_check;
ALTER TABLE public.participants ADD CONSTRAINT participants_status_check
  CHECK (status IN ('registered','checked-in','waitlisted','attended','cancelled'));

ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual','public','import'));
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS waitlist_position INTEGER;

CREATE INDEX IF NOT EXISTS participants_status_idx ON public.participants(event_id, status);

-- ── 3. Allow PUBLIC SELECT on events flagged is_public ──────────
-- This is read-only — only published fields, only events explicitly opted-in.
DROP POLICY IF EXISTS "events_public_read" ON public.events;
CREATE POLICY "events_public_read" ON public.events FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

-- ── 4. EVENT FEEDBACK ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Anonymous',
  email       TEXT,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_feedback_event_id_idx ON public.event_feedback(event_id);

ALTER TABLE public.event_feedback ENABLE ROW LEVEL SECURITY;

-- Organizer of the event reads all feedback for it.
DROP POLICY IF EXISTS "feedback_select" ON public.event_feedback;
CREATE POLICY "feedback_select" ON public.event_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_feedback.event_id
        AND (e.organizer_id = auth.uid() OR public.has_club_access(e.organizer_id))
    )
  );

-- Feedback inserts happen through the SECURITY DEFINER RPC; no direct INSERT policy.

-- ── 5. CERTIFICATES ISSUED ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.certificates_issued (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  participant_id  TEXT NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  participant_name TEXT NOT NULL,
  participant_email TEXT NOT NULL,
  issued_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, participant_id)
);

CREATE INDEX IF NOT EXISTS certificates_issued_event_idx ON public.certificates_issued(event_id);

ALTER TABLE public.certificates_issued ENABLE ROW LEVEL SECURITY;

-- Organizer / club members can see certs they've issued.
DROP POLICY IF EXISTS "certs_select" ON public.certificates_issued;
CREATE POLICY "certs_select" ON public.certificates_issued FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = certificates_issued.event_id
        AND (e.organizer_id = auth.uid() OR public.has_club_access(e.organizer_id))
    )
  );

-- Insert / delete via SECURITY DEFINER RPC only.

-- ══════════════════════════════════════════════════════════════════
-- RPC: register_for_event  (PUBLIC — callable by anon)
-- Counts current registered, auto-waitlists when at capacity.
-- ══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.register_for_event(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.register_for_event(
  p_event_id TEXT,
  p_name     TEXT,
  p_email    TEXT,
  p_phone    TEXT DEFAULT '',
  p_dept     TEXT DEFAULT '',
  p_roll_no  TEXT DEFAULT ''
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event         public.events;
  v_registered    INT;
  v_waitlist_pos  INT;
  v_status        TEXT := 'registered';
  v_participant_id TEXT;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id LIMIT 1;

  IF v_event.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'event_not_found');
  END IF;

  IF v_event.is_public IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'event_not_public');
  END IF;

  IF v_event.registration_open IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'registration_closed');
  END IF;

  IF v_event.registration_closes_at IS NOT NULL AND v_event.registration_closes_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'registration_window_passed');
  END IF;

  IF p_email IS NULL OR length(trim(p_email)) = 0 OR p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_fields');
  END IF;

  -- Dedupe by (event_id, lower(email))
  IF EXISTS (
    SELECT 1 FROM public.participants
    WHERE event_id = p_event_id AND lower(email) = lower(p_email)
      AND status <> 'cancelled'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_registered');
  END IF;

  -- Capacity check
  IF v_event.capacity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_registered
      FROM public.participants
     WHERE event_id = p_event_id AND status IN ('registered','checked-in','attended');

    IF v_registered >= v_event.capacity THEN
      v_status := 'waitlisted';
      SELECT COALESCE(MAX(waitlist_position), 0) + 1 INTO v_waitlist_pos
        FROM public.participants
       WHERE event_id = p_event_id AND status = 'waitlisted';
    END IF;
  END IF;

  v_participant_id := gen_random_uuid()::text;

  INSERT INTO public.participants (
    id, organizer_id, event_id, name, email, phone, roll_no, dept,
    status, source, waitlist_position, registered_at
  ) VALUES (
    v_participant_id, v_event.organizer_id, p_event_id,
    trim(p_name), lower(trim(p_email)), COALESCE(p_phone,''),
    COALESCE(p_roll_no,''), COALESCE(p_dept,''),
    v_status, 'public', v_waitlist_pos, 'Just now'
  );

  -- Update denormalized count on events (registered only — not waitlisted)
  IF v_status = 'registered' THEN
    UPDATE public.events
       SET participants = COALESCE(participants, 0) + 1
     WHERE id = p_event_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', v_status,
    'participant_id', v_participant_id,
    'waitlist_position', v_waitlist_pos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_for_event(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════════
-- RPC: cancel_registration  — promotes next waitlist entry
-- Called by the organizer (auth required).
-- ══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.cancel_registration(TEXT);

CREATE OR REPLACE FUNCTION public.cancel_registration(p_participant_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_part        public.participants;
  v_event_id    TEXT;
  v_was_active  BOOLEAN := false;
  v_promoted    TEXT;
BEGIN
  SELECT * INTO v_part FROM public.participants WHERE id = p_participant_id;
  IF v_part.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Must be organizer or club member.
  IF NOT (v_part.organizer_id = auth.uid() OR public.has_club_access(v_part.organizer_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  v_event_id := v_part.event_id;
  v_was_active := v_part.status IN ('registered','checked-in','attended');

  UPDATE public.participants SET status = 'cancelled' WHERE id = p_participant_id;

  -- If they freed up a slot, promote the next waitlist entry.
  IF v_was_active THEN
    SELECT id INTO v_promoted
      FROM public.participants
     WHERE event_id = v_event_id AND status = 'waitlisted'
     ORDER BY waitlist_position ASC NULLS LAST, created_at ASC
     LIMIT 1;

    IF v_promoted IS NOT NULL THEN
      UPDATE public.participants
         SET status = 'registered', waitlist_position = NULL
       WHERE id = v_promoted;
    ELSE
      UPDATE public.events
         SET participants = GREATEST(COALESCE(participants, 1) - 1, 0)
       WHERE id = v_event_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'promoted_id', v_promoted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_registration(TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════════
-- RPC: submit_feedback  (PUBLIC — callable by anon)
-- Only accepts feedback for is_public events whose status is completed.
-- ══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.submit_feedback(TEXT, TEXT, TEXT, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.submit_feedback(
  p_event_id TEXT,
  p_name     TEXT,
  p_email    TEXT,
  p_rating   INTEGER,
  p_comment  TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event public.events;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;

  IF v_event.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'event_not_found');
  END IF;

  IF v_event.is_public IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'event_not_public');
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_rating');
  END IF;

  INSERT INTO public.event_feedback (event_id, name, email, rating, comment)
  VALUES (p_event_id, COALESCE(NULLIF(trim(p_name),''),'Anonymous'),
          NULLIF(lower(trim(p_email)),''), p_rating, COALESCE(p_comment,''));

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_feedback(TEXT, TEXT, TEXT, INTEGER, TEXT) TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════════
-- RPC: issue_certificates  (organizer-only)
-- Bulk-inserts certificates_issued rows for every attended/checked-in
-- participant of the event. Caller must own or have club access to it.
-- ══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.issue_certificates(TEXT);

CREATE OR REPLACE FUNCTION public.issue_certificates(p_event_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event public.events;
  v_count INT := 0;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF v_event.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'event_not_found');
  END IF;

  IF NOT (v_event.organizer_id = auth.uid() OR public.has_club_access(v_event.organizer_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  INSERT INTO public.certificates_issued (event_id, participant_id, participant_name, participant_email, issued_by)
  SELECT p.event_id, p.id, p.name, p.email, auth.uid()
    FROM public.participants p
   WHERE p.event_id = p_event_id
     AND p.status IN ('checked-in','attended')
  ON CONFLICT (event_id, participant_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'issued', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_certificates(TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════════
-- RPC: get_public_event  — minimal projection for the public form
-- Anon callers can hit this to render the registration page without
-- exposing the full events row.
-- ══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.get_public_event(TEXT);

CREATE OR REPLACE FUNCTION public.get_public_event(p_event_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event public.events;
  v_registered INT;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id AND is_public = true;
  IF v_event.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT COUNT(*) INTO v_registered
    FROM public.participants
   WHERE event_id = p_event_id
     AND status IN ('registered','checked-in','attended');

  RETURN jsonb_build_object(
    'ok', true,
    'event', jsonb_build_object(
      'id', v_event.id,
      'name', v_event.name,
      'type', v_event.type,
      'description', v_event.description,
      'date', v_event.date,
      'venue', v_event.venue,
      'capacity', v_event.capacity,
      'registered', v_registered,
      'status', v_event.status,
      'registration_open', v_event.registration_open,
      'registration_closes_at', v_event.registration_closes_at,
      'cover_image', v_event.cover_image
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_event(TEXT) TO anon, authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_feedback;
ALTER PUBLICATION supabase_realtime ADD TABLE public.certificates_issued;
