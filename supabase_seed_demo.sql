-- ═══════════════════════════════════════════════════════════════
-- Phase 6: Supabase Demo Seed Data
-- Run this script in the Supabase SQL Editor to populate demo users.
-- Password for all users will be: password123
-- ═══════════════════════════════════════════════════════════════

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ 
DECLARE
  v_ayaan_id uuid := '11111111-1111-1111-1111-111111111111';
  v_priya_id uuid := '22222222-2222-2222-2222-222222222222';
  v_admin_id uuid := '33333333-3333-3333-3333-333333333333';
  v_password text := crypt('password123', gen_salt('bf'));
BEGIN

  -- 1. Create Ayaan (President)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, 
    recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    v_ayaan_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
    'ayaan@college.edu', v_password, now(), NULL, now(), 
    '{"provider":"email","providers":["email"]}', '{"full_name":"Ayaan Nizam"}', 
    now(), now(), '', '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, name, avatar_url, role) 
  VALUES (v_ayaan_id, 'Ayaan Nizam', NULL, 'president')
  ON CONFLICT (id) DO UPDATE SET role = 'president';

  -- 2. Create Priya (Mate)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, 
    recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    v_priya_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
    'priya@college.edu', v_password, now(), NULL, now(), 
    '{"provider":"email","providers":["email"]}', '{"full_name":"Priya Sharma"}', 
    now(), now(), '', '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, name, avatar_url, role) 
  VALUES (v_priya_id, 'Priya Sharma', NULL, 'mate')
  ON CONFLICT (id) DO UPDATE SET role = 'mate';

  -- 3. Create Admin (Developer)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, 
    recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    v_admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
    'admin@unio.campus', v_password, now(), NULL, now(), 
    '{"provider":"email","providers":["email"]}', '{"full_name":"Campus Admin"}', 
    now(), now(), '', '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, name, avatar_url, role) 
  VALUES (v_admin_id, 'Campus Admin', NULL, 'developer')
  ON CONFLICT (id) DO UPDATE SET role = 'developer';

  -- 4. Link Priya to Ayaan's Club
  INSERT INTO public.club_members (club_id, user_id, role)
  VALUES (v_ayaan_id, v_priya_id, 'mate')
  ON CONFLICT (club_id, user_id) DO NOTHING;

END $$;
