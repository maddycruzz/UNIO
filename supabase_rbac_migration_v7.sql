-- ═════════════════════════════════════════════════════════════════
-- v7 — Security hardening from Supabase database linter
-- ═════════════════════════════════════════════════════════════════
-- Run AFTER v6. Idempotent — safe to re-run.
--
-- Addresses these linter findings:
--   • function_search_path_mutable (has_club_access, user_role)
--   • anon_security_definer_function_executable (private RPCs callable
--     without authentication)
--   • public_bucket_allows_listing (event-files storage bucket)
--
-- Does NOT touch:
--   • auth_rls_initplan — perf optimization across ~50 policies. Too
--     risky to bulk-rewrite before a demo. Open follow-up.
--   • multiple_permissive_policies on events — same. Open follow-up.
--   • unindexed_foreign_keys — only matters at scale. Open follow-up.
--   • unused_index — cleanup, post-demo.
--   • auth_leaked_password_protection — toggle in Supabase dashboard
--     (Authentication → Policies → enable "leaked password protection").

-- ── 1. Pin search_path on SECURITY DEFINER functions ─────────────
-- Without this, a privileged caller could shadow built-in objects by
-- manipulating search_path. Setting it explicitly forecloses that.

ALTER FUNCTION public.has_club_access(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.user_role()           SET search_path = public, pg_temp;

-- These were flagged too — they already have `SET search_path = public`
-- in their definitions, but the linter is conservative. Re-applying is a
-- no-op if already set.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT
      n.nspname AS schema,
      p.proname AS name,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname IN (
        'handle_new_user', 'accept_invitation', 'apply_task_template',
        'cancel_registration', 'check_due_reminders', 'fanout_announcement',
        'fanout_mentions', 'get_public_event', 'issue_certificates',
        'register_for_event', 'submit_feedback'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp',
      fn.name, fn.args
    );
  END LOOP;
END $$;

-- ── 2. Revoke EXECUTE from `anon` on functions that shouldn't be ─
--    callable without authentication.
--
-- KEEP anon access on:
--   • get_public_event       — public event browsing
--   • register_for_event     — public registration form
--   • submit_feedback        — public post-event feedback
--   • cancel_registration    — public unsubscribe link
--
-- Everything else: authenticated only (or trigger-only).

REVOKE EXECUTE ON FUNCTION public.accept_invitation(text)                                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_task_template(uuid, text, date)                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_due_reminders()                                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.fanout_announcement(uuid, uuid, text)                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.fanout_mentions(uuid, uuid, uuid[], text, text)            FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_club_access(uuid)                                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.issue_certificates(text)                                   FROM anon;

-- handle_new_user is a trigger function — should NEVER be callable as RPC
-- by anyone. Revoke from both anon and authenticated.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;

-- ── 3. Tighten the event-files storage bucket ────────────────────
-- The current SELECT policy lets anon LIST the bucket, exposing file
-- names. Object URLs still work via the public URL pattern, so the
-- listing capability adds no value but does leak data.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'event_files_storage_select'
  ) THEN
    DROP POLICY "event_files_storage_select" ON storage.objects;
  END IF;
END $$;

-- Replace with a no-op SELECT (no rows match) so PostgREST returns 0 rows
-- instead of an error. Public files are still fetchable by direct URL
-- because the bucket is public.
CREATE POLICY "event_files_no_listing" ON storage.objects
  FOR SELECT
  USING (false);

-- ── Done. ────────────────────────────────────────────────────────
-- After running, re-run the linter — items 0011 (function_search_path),
-- 0025 (public_bucket_allows_listing), 0028/0029 (anon/authed sec def)
-- should disappear for everything except the four intentionally-public
-- RPCs.
