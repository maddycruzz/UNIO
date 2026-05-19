-- ═════════════════════════════════════════════════════════════════
-- v6 — Fix role-default escalation
-- ═════════════════════════════════════════════════════════════════
-- The original schema set `profiles.role` DEFAULT 'president', so every
-- new Supabase signup landed in the highest role. This migration:
--
--   1. Flips the column default to 'mate' (least privilege).
--   2. Patches handle_new_user() to set role = 'mate' explicitly, so we
--      don't rely on the column default in the future.
--   3. Provides an OPTIONAL block (commented) to demote presidents who
--      have never actually run a club. Read it before running.
--
-- Idempotent — safe to re-run.

-- ── 1. Column default ────────────────────────────────────────────
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'mate'::user_role;

-- ── 2. Patch the new-user trigger to set role explicitly ─────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, initials, avatar_url, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    UPPER(LEFT(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email), 2)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email,
    'mate'::user_role
  );
  RETURN NEW;
END;
$$;

-- Ensure the trigger is wired up (no-op if it already exists from earlier
-- migrations; the CREATE OR REPLACE on the function above is what actually
-- changes behavior).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 3. (OPTIONAL) Demote accidental-president accounts ───────────
-- The original default meant EVERY existing user is currently a president.
-- Decide which one of the following is right for your data:
--
-- (a) Single-tenant / your own account is the only real president:
--     uncomment and run with your email substituted.
--
-- UPDATE public.profiles
--    SET role = 'mate'
--  WHERE email <> 'YOUR_EMAIL_HERE@example.com'
--    AND role = 'president';
--
-- (b) Multi-tenant — keep anyone who actually owns a club, demote the rest:
--
-- UPDATE public.profiles p
--    SET role = 'mate'
--  WHERE p.role = 'president'
--    AND NOT EXISTS (
--      SELECT 1 FROM public.events e WHERE e.organizer_id = p.id
--    );
--
-- (c) Leave existing rows alone (only future signups will be mates).
--     Default — do nothing.
