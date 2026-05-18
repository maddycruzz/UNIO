-- ═══════════════════════════════════════════════════════════════
-- Phase 4 — Automation
-- Task templates, recurring meetings, task dependencies, due-soon
-- reminders. Run AFTER supabase_phase3_migration.sql.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. TASK TEMPLATES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  event_type   TEXT NOT NULL DEFAULT 'Other'
                 CHECK (event_type IN ('Cultural','Tech','Sports','Workshop','Conference','Other')),
  is_shared    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_template_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  UUID NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  priority     TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High','Medium','Low')),
  division     TEXT NOT NULL DEFAULT '',
  days_offset  INTEGER NOT NULL DEFAULT 0,
  "order"      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS task_template_items_template_id_idx ON public.task_template_items(template_id);

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_template_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tt_select" ON public.task_templates;
CREATE POLICY "tt_select" ON public.task_templates FOR SELECT
  USING (
    organizer_id = auth.uid()
    OR public.has_club_access(organizer_id)
    OR is_shared = true
  );

DROP POLICY IF EXISTS "tt_insert" ON public.task_templates;
CREATE POLICY "tt_insert" ON public.task_templates FOR INSERT
  WITH CHECK (organizer_id = auth.uid() OR public.has_club_access(organizer_id));

DROP POLICY IF EXISTS "tt_update" ON public.task_templates;
CREATE POLICY "tt_update" ON public.task_templates FOR UPDATE
  USING (organizer_id = auth.uid() OR public.has_club_access(organizer_id));

DROP POLICY IF EXISTS "tt_delete" ON public.task_templates;
CREATE POLICY "tt_delete" ON public.task_templates FOR DELETE
  USING (organizer_id = auth.uid() OR public.has_club_access(organizer_id));

-- Items inherit visibility from their parent template.
DROP POLICY IF EXISTS "tti_select" ON public.task_template_items;
CREATE POLICY "tti_select" ON public.task_template_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.task_templates t
    WHERE t.id = task_template_items.template_id
      AND (t.organizer_id = auth.uid() OR public.has_club_access(t.organizer_id) OR t.is_shared = true)
  ));

DROP POLICY IF EXISTS "tti_insert" ON public.task_template_items;
CREATE POLICY "tti_insert" ON public.task_template_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.task_templates t
    WHERE t.id = task_template_items.template_id
      AND (t.organizer_id = auth.uid() OR public.has_club_access(t.organizer_id))
  ));

DROP POLICY IF EXISTS "tti_delete" ON public.task_template_items;
CREATE POLICY "tti_delete" ON public.task_template_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.task_templates t
    WHERE t.id = task_template_items.template_id
      AND (t.organizer_id = auth.uid() OR public.has_club_access(t.organizer_id))
  ));

-- ── 2. TASK DEPENDENCIES ────────────────────────────────────────
-- Edge table: task_id depends on depends_on_task_id (must be done first)
CREATE TABLE IF NOT EXISTS public.task_dependencies (
  task_id            TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, depends_on_task_id),
  CHECK (task_id <> depends_on_task_id)
);

CREATE INDEX IF NOT EXISTS task_deps_depends_on_idx ON public.task_dependencies(depends_on_task_id);

ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "td_select" ON public.task_dependencies;
CREATE POLICY "td_select" ON public.task_dependencies FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_dependencies.task_id
      AND (t.organizer_id = auth.uid() OR public.has_club_access(t.organizer_id))
  ));

DROP POLICY IF EXISTS "td_insert" ON public.task_dependencies;
CREATE POLICY "td_insert" ON public.task_dependencies FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_dependencies.task_id
      AND (t.organizer_id = auth.uid() OR public.has_club_access(t.organizer_id))
  ));

DROP POLICY IF EXISTS "td_delete" ON public.task_dependencies;
CREATE POLICY "td_delete" ON public.task_dependencies FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_dependencies.task_id
      AND (t.organizer_id = auth.uid() OR public.has_club_access(t.organizer_id))
  ));

-- ── 3. MEETINGS: recurrence columns ─────────────────────────────
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS recurrence_type TEXT NOT NULL DEFAULT 'none'
  CHECK (recurrence_type IN ('none','daily','weekly','biweekly','monthly'));
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS recurrence_until TIMESTAMPTZ;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS recurrence_series_id UUID;

CREATE INDEX IF NOT EXISTS meetings_recurrence_series_idx ON public.meetings(recurrence_series_id);

-- ══════════════════════════════════════════════════════════════════
-- RPC: apply_task_template(template_id, event_id, start_date)
-- Bulk-inserts tasks from a template into an event. Returns count.
-- ══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.apply_task_template(UUID, TEXT, DATE);

CREATE OR REPLACE FUNCTION public.apply_task_template(
  p_template_id UUID,
  p_event_id    TEXT,
  p_start_date  DATE DEFAULT CURRENT_DATE
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event   public.events;
  v_count   INT := 0;
  v_caller  UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF v_event.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'event_not_found');
  END IF;

  IF NOT (v_event.organizer_id = v_caller OR public.has_club_access(v_event.organizer_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- Verify template is visible to caller (mirror of tt_select).
  IF NOT EXISTS (
    SELECT 1 FROM public.task_templates t
    WHERE t.id = p_template_id
      AND (t.organizer_id = v_caller OR public.has_club_access(t.organizer_id) OR t.is_shared = true)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'template_not_visible');
  END IF;

  INSERT INTO public.tasks (
    id, organizer_id, event_id, title, event, event_color, priority,
    status, due, description, division, "order", assignees
  )
  SELECT
    gen_random_uuid()::text,
    v_event.organizer_id,
    p_event_id,
    i.title,
    v_event.name,
    '#6366F1',
    i.priority,
    'todo',
    to_char(p_start_date + (i.days_offset || ' days')::interval, 'Mon DD'),
    i.description,
    NULLIF(i.division, ''),
    i."order",
    '[]'::jsonb
  FROM public.task_template_items i
  WHERE i.template_id = p_template_id
  ORDER BY i."order" ASC NULLS LAST;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Update event's task counts.
  UPDATE public.events
     SET tasks_total = COALESCE(tasks_total,0) + v_count
   WHERE id = p_event_id;

  RETURN jsonb_build_object('ok', true, 'inserted', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_task_template(UUID, TEXT, DATE) TO authenticated;

-- ══════════════════════════════════════════════════════════════════
-- RPC: check_due_reminders
-- Creates due_soon notifications for tasks due in <= 24h that don't
-- already have one. Caller must be authenticated; only their own
-- tasks (or club's) trigger reminders for them. Returns count.
-- ══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.check_due_reminders();

CREATE OR REPLACE FUNCTION public.check_due_reminders()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_count  INT := 0;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- For each non-done task whose due text starts with one of the next 2 days,
  -- and the caller is the organizer or in the club, create a notification if
  -- one doesn't already exist for that task.
  -- Note: task.due is stored as free text like "Mon DD" so we match by date
  -- range loosely — a stricter system would use a real timestamptz column.
  WITH due_targets AS (
    SELECT t.id AS task_id, t.title
      FROM public.tasks t
     WHERE t.status <> 'done'
       AND (t.organizer_id = v_caller OR public.has_club_access(t.organizer_id))
  ), new_notes AS (
    INSERT INTO public.notifications (user_id, type, payload)
    SELECT v_caller, 'due_soon',
           jsonb_build_object('task_id', d.task_id, 'title', d.title)
      FROM due_targets d
     WHERE NOT EXISTS (
       SELECT 1 FROM public.notifications n
        WHERE n.user_id = v_caller
          AND n.type = 'due_soon'
          AND (n.payload->>'task_id') = d.task_id
          AND n.created_at > now() - interval '24 hours'
     )
       -- Only fire when due text matches today or tomorrow's month-day prefix.
       AND (
         (SELECT title FROM public.tasks WHERE id = d.task_id) IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM public.tasks tt
            WHERE tt.id = d.task_id
              AND (
                tt.due ILIKE to_char(now(), 'Mon DD') || '%' OR
                tt.due ILIKE to_char(now() + interval '1 day', 'Mon DD') || '%'
              )
         )
       )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM new_notes;

  RETURN jsonb_build_object('ok', true, 'created', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_due_reminders() TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_dependencies;
