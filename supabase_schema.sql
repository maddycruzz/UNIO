-- ═══════════════════════════════════════════════════════════════
-- UNIO — Supabase Production Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── 1. PROFILES ─────────────────────────────────────────────────
-- Mirrors auth.users, stores display info
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default '',
  initials    text not null default '',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create profile on new user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, initials, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    upper(left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email), 2)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 2. EVENTS ────────────────────────────────────────────────────
create table if not exists public.events (
  id             text primary key default gen_random_uuid()::text,
  organizer_id   uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  type           text not null default 'Other'
                   check (type in ('Cultural','Tech','Sports','Workshop','Conference','Other')),
  description    text not null default '',
  date           text not null default '',
  venue          text not null default '',
  participants   integer not null default 0,
  capacity       integer,
  completion     integer not null default 0,
  status         text not null default 'upcoming'
                   check (status in ('upcoming','ongoing','completed')),
  tasks_done     integer not null default 0,
  tasks_total    integer not null default 0,
  days_remaining integer not null default 0,
  assignees      text[] not null default '{}',
  start_date     text,
  end_date       text,
  cover_image    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists events_organizer_id_idx on public.events(organizer_id);

-- ── 3. TASKS ────────────────────────────────────────────────────
create table if not exists public.tasks (
  id           text primary key default gen_random_uuid()::text,
  organizer_id uuid not null references auth.users(id) on delete cascade,
  event_id     text references public.events(id) on delete set null,
  title        text not null,
  event        text not null default '',
  event_color  text not null default '#6366F1',
  priority     text not null default 'Medium'
                 check (priority in ('High','Medium','Low')),
  status       text not null default 'todo'
                 check (status in ('todo','inprogress','done')),
  due          text not null default '',
  assignees    jsonb not null default '[]',
  description  text not null default '',
  division     text,
  "order"      integer,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists tasks_organizer_id_idx on public.tasks(organizer_id);
create index if not exists tasks_event_id_idx on public.tasks(event_id);

-- ── 4. MEETINGS ──────────────────────────────────────────────────
create table if not exists public.meetings (
  id           text primary key default gen_random_uuid()::text,
  organizer_id uuid not null references auth.users(id) on delete cascade,
  event_id     text references public.events(id) on delete set null,
  title        text not null,
  event        text not null default '',
  event_color  text not null default '#6366F1',
  date         text not null,
  time         text not null,
  duration     integer not null default 60,
  location     text not null default '',
  status       text not null default 'upcoming'
                 check (status in ('upcoming','ongoing','completed')),
  attendees    jsonb not null default '[]',
  agenda       text not null default '',
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists meetings_organizer_id_idx on public.meetings(organizer_id);

-- ── 5. PARTICIPANTS ──────────────────────────────────────────────
create table if not exists public.participants (
  id             text primary key default gen_random_uuid()::text,
  organizer_id   uuid not null references auth.users(id) on delete cascade,
  event_id       text not null references public.events(id) on delete cascade,
  name           text not null,
  email          text not null,
  phone          text not null default '',
  roll_no        text not null default '',
  dept           text not null default '',
  status         text not null default 'registered'
                   check (status in ('registered','checked-in')),
  registered_at  text not null default 'Just now',
  checked_in_at  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists participants_event_id_idx on public.participants(event_id);
create index if not exists participants_organizer_id_idx on public.participants(organizer_id);

-- ── 6. ACTIVITY LOG ──────────────────────────────────────────────
create table if not exists public.activity_log (
  id           text primary key default gen_random_uuid()::text,
  organizer_id uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  meta         text not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists activity_log_organizer_id_idx on public.activity_log(organizer_id);

-- ══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════

alter table public.profiles     enable row level security;
alter table public.events        enable row level security;
alter table public.tasks         enable row level security;
alter table public.meetings      enable row level security;
alter table public.participants  enable row level security;
alter table public.activity_log  enable row level security;

-- Profiles: users can read/update their own profile
create policy "profiles_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Events: organizer owns all their events
create policy "events_select"  on public.events for select  using (auth.uid() = organizer_id);
create policy "events_insert"  on public.events for insert  with check (auth.uid() = organizer_id);
create policy "events_update"  on public.events for update  using (auth.uid() = organizer_id);
create policy "events_delete"  on public.events for delete  using (auth.uid() = organizer_id);

-- Tasks: organizer owns all their tasks
create policy "tasks_select"  on public.tasks for select  using (auth.uid() = organizer_id);
create policy "tasks_insert"  on public.tasks for insert  with check (auth.uid() = organizer_id);
create policy "tasks_update"  on public.tasks for update  using (auth.uid() = organizer_id);
create policy "tasks_delete"  on public.tasks for delete  using (auth.uid() = organizer_id);

-- Meetings: organizer owns all their meetings
create policy "meetings_select"  on public.meetings for select  using (auth.uid() = organizer_id);
create policy "meetings_insert"  on public.meetings for insert  with check (auth.uid() = organizer_id);
create policy "meetings_update"  on public.meetings for update  using (auth.uid() = organizer_id);
create policy "meetings_delete"  on public.meetings for delete  using (auth.uid() = organizer_id);

-- Participants: organizer owns all their participants
create policy "participants_select"  on public.participants for select  using (auth.uid() = organizer_id);
create policy "participants_insert"  on public.participants for insert  with check (auth.uid() = organizer_id);
create policy "participants_update"  on public.participants for update  using (auth.uid() = organizer_id);
create policy "participants_delete"  on public.participants for delete  using (auth.uid() = organizer_id);

-- Activity log: organizer sees only their own activity
create policy "activity_select"  on public.activity_log for select  using (auth.uid() = organizer_id);
create policy "activity_insert"  on public.activity_log for insert  with check (auth.uid() = organizer_id);

-- ══════════════════════════════════════════════════════════════════
-- REALTIME
-- Enable realtime for check-in sync across devices
-- ══════════════════════════════════════════════════════════════════
alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.activity_log;
