-- ═════════════════════════════════════════════════════════════════
-- v8 — Properly revoke EXECUTE from PUBLIC (fixes v7)
-- ═════════════════════════════════════════════════════════════════
-- Postgres grants EXECUTE on functions to PUBLIC by default. The anon
-- and authenticated roles inherit from PUBLIC, so revoking from anon
-- alone (as v7 did) has no effect. Revoke from PUBLIC, then grant
-- back to the roles that should be allowed.
--
-- Run AFTER v7. Idempotent — safe to re-run.

-- ── 1. Private RPCs: authenticated only, never anon ──────────────
-- Pattern: revoke from PUBLIC, then grant to authenticated.

REVOKE EXECUTE ON FUNCTION public.accept_invitation(text)                                    FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.accept_invitation(text)                                    TO   authenticated;

REVOKE EXECUTE ON FUNCTION public.apply_task_template(uuid, text, date)                      FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.apply_task_template(uuid, text, date)                      TO   authenticated;

REVOKE EXECUTE ON FUNCTION public.check_due_reminders()                                      FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_due_reminders()                                      TO   authenticated;

REVOKE EXECUTE ON FUNCTION public.fanout_announcement(uuid, uuid, text)                      FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fanout_announcement(uuid, uuid, text)                      TO   authenticated;

REVOKE EXECUTE ON FUNCTION public.fanout_mentions(uuid, uuid, uuid[], text, text)            FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fanout_mentions(uuid, uuid, uuid[], text, text)            TO   authenticated;

REVOKE EXECUTE ON FUNCTION public.has_club_access(uuid)                                      FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_club_access(uuid)                                      TO   authenticated;

REVOKE EXECUTE ON FUNCTION public.issue_certificates(text)                                   FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.issue_certificates(text)                                   TO   authenticated;

-- ── 2. Trigger-only function: not callable by anyone via RPC ─────
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
-- intentionally NO grant — only the Supabase auth trigger calls it.

-- ── 3. Intentionally-public RPCs: keep anon access ───────────────
-- These power the unauthenticated event-registration flow. Re-grant
-- explicitly so PostgREST exposes them.

GRANT EXECUTE ON FUNCTION public.get_public_event(text)                                                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_for_event(text, text, text, text, text, text)                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_feedback(text, text, text, integer, text)                          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_registration(text)                                                 TO anon, authenticated;

-- ── 4. Also revoke user_role() — it was flagged for search_path
--    but not in the v7 grants section. It's used internally by
--    RLS policies, never as a public RPC.
REVOKE EXECUTE ON FUNCTION public.user_role() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.user_role() TO authenticated;

-- ── Verify ───────────────────────────────────────────────────────
-- After running, sanity-check with:
--
--   SELECT
--     p.proname,
--     array_agg(DISTINCT a.privilege_type) FILTER (WHERE a.grantee = 'anon')          AS anon_privs,
--     array_agg(DISTINCT a.privilege_type) FILTER (WHERE a.grantee = 'authenticated') AS auth_privs,
--     array_agg(DISTINCT a.privilege_type) FILTER (WHERE a.grantee = 'PUBLIC')        AS public_privs
--   FROM pg_proc p
--   JOIN pg_namespace n         ON n.oid = p.pronamespace
--   LEFT JOIN information_schema.routine_privileges a
--     ON a.routine_schema = n.nspname AND a.routine_name = p.proname
--   WHERE n.nspname = 'public' AND p.prosecdef
--   GROUP BY p.proname
--   ORDER BY p.proname;
--
-- Expected: anon column should be NULL for everything except
--   get_public_event, register_for_event, submit_feedback,
--   cancel_registration. PUBLIC column should be NULL everywhere.
