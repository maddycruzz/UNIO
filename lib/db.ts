// ─────────────────────────────────────────────────────────────────
// lib/db.ts — Async Supabase data layer for UNIO
//
// This is the production replacement for lib/store.ts.
// All functions mirror the store.ts API but are async and talk
// to Supabase. When Supabase is not configured, every function
// transparently falls back to the localStorage store.
// ─────────────────────────────────────────────────────────────────

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  // localStorage fallback
  loadEvents as storeLoadEvents,
  saveEvents as storeSaveEvents,
  loadTasks as storeLoadTasks,
  saveTasks as storeSaveTasks,
  loadMeetings as storeLoadMeetings,
  saveMeetings as storeSaveMeetings,
  loadParticipants as storeLoadParticipants,
  saveParticipants as storeSaveParticipants,
  loadActivity as storeLoadActivity,
  addActivity as storeAddActivity,
  getDashboardStats as storeGetDashboardStats,
  getUpcomingEvents as storeGetUpcomingEvents,
  getParticipantsForEvent as storeGetParticipantsForEvent,
  type UnioEvent,
  type UnioTask,
  type UnioMeeting,
  type UnioParticipant,
  type ActivityItem,
} from "@/lib/store";

function notifyChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("unio-store-change"));
  }
}

// Timeout wrapper. Accepts PromiseLike so Supabase's PostgrestBuilder works directly.
export const withTimeout = <T>(p: PromiseLike<T>, ms: number, errorMessage: string): Promise<T> => {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([Promise.resolve(p), timeoutPromise]).finally(() => clearTimeout(timeoutId!));
};

// ── Helpers ───────────────────────────────────────────────────────

export type UserRole = "developer" | "president" | "mate";

export type UserContext = {
  userId: string;
  role: UserRole;
  activeClubId: string;
};

// A real Supabase auth UUID is 36 chars in 8-4-4-4-12 hex shape. Anything else
// (e.g. our demo IDs like "u-ayaan") is NOT a valid organizer_id — the JWT
// won't match it and RLS will reject every insert.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Read the JWT user id straight out of Supabase's localStorage entry.
 *  Supabase stores the session under a key like `sb-<project-ref>-auth-token`.
 *  Used as a fallback when `auth.getSession()` itself hangs on internal
 *  token-refresh logic — the JWT is the source of truth anyway. */
function readJwtUserIdFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const id =
        parsed?.user?.id ||
        parsed?.currentSession?.user?.id ||
        parsed?.session?.user?.id;
      if (id && UUID_RE.test(id)) return id;
    } catch {
      /* skip malformed entry */
    }
  }
  return null;
}

/** Get the currently authenticated user's context (role and active club).
 *  Tries the live Supabase session first (short-timed) and falls back to
 *  reading the JWT directly from localStorage if getSession() hangs. */
export async function getUserContext(): Promise<UserContext | null> {
  if (!isSupabaseConfigured()) return null;

  // Step 1: race getSession() against a 1.5s timeout. On the happy path this
  // returns instantly from in-memory state; on a hung token-refresh it bails out.
  let userId: string | null = null;
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("getSession soft-timeout")), 1500)
    );
    const { data } = (await Promise.race([sessionPromise, timeoutPromise])) as Awaited<ReturnType<typeof supabase.auth.getSession>>;
    userId = data?.session?.user?.id ?? null;
  } catch {
    /* fall through to storage read */
  }

  // Step 2: fallback — read user id directly from the JWT in localStorage.
  if (!userId) {
    userId = readJwtUserIdFromStorage();
  }

  if (!userId) return null;
  if (!UUID_RE.test(userId)) {
    console.error("getUserContext: user id is not a real UUID, refusing to proceed:", userId);
    return null;
  }

  // Read role from localStorage cache first (set during login/hydrate) — avoids
  // a network roundtrip on every write. Falls back to a DB lookup if missing.
  let role: UserRole = "president";
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("unio_session_v1");
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.id === userId && (cached.role === "developer" || cached.role === "president" || cached.role === "mate")) {
          role = cached.role;
        }
      }
    } catch {
      /* fall through to DB lookup */
    }
  }

  if (role === "mate") {
    const { data: membership } = await supabase.from("club_members").select("club_id").eq("user_id", userId).single();
    return { userId, role, activeClubId: membership?.club_id || userId };
  }

  return { userId, role, activeClubId: userId };
}

/** Log activity to Supabase or localStorage */
async function logActivity(organizerId: string | null, title: string, meta: string) {
  if (organizerId && isSupabaseConfigured()) {
    await supabase.from("activity_log").insert({ organizer_id: organizerId, title, meta });
  } else {
    storeAddActivity(title, meta);
  }
}

// ── Column mappers ────────────────────────────────────────────────
// Supabase uses snake_case columns; our types use camelCase.

function rowToEvent(row: Record<string, unknown>): UnioEvent {
  return {
    id:            row.id as string,
    name:          row.name as string,
    type:          row.type as UnioEvent["type"],
    description:   row.description as string,
    date:          row.date as string,
    venue:         row.venue as string,
    participants:  (row.participants as number) ?? 0,
    capacity:      row.capacity as number | null,
    completion:    (row.completion as number) ?? 0,
    status:        row.status as UnioEvent["status"],
    tasksDone:     (row.tasks_done as number) ?? 0,
    tasksTotal:    (row.tasks_total as number) ?? 0,
    daysRemaining: (row.days_remaining as number) ?? 0,
    assignees:     (row.assignees as string[]) ?? [],
    startDate:     row.start_date as string | undefined,
    endDate:       row.end_date as string | undefined,
    coverImage:    row.cover_image as string | undefined,
    createdAt:     row.created_at as string,
  };
}

function eventToRow(event: Partial<UnioEvent>, organizerId?: string): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (organizerId)           row.organizer_id   = organizerId;
  if (event.id !== undefined) row.id             = event.id;
  if (event.name !== undefined) row.name         = event.name;
  if (event.type !== undefined) row.type         = event.type;
  if (event.description !== undefined) row.description = event.description;
  if (event.date !== undefined) row.date         = event.date;
  if (event.venue !== undefined) row.venue       = event.venue;
  if (event.participants !== undefined) row.participants = event.participants;
  if ("capacity" in event) row.capacity          = event.capacity;
  if (event.completion !== undefined) row.completion = event.completion;
  if (event.status !== undefined) row.status     = event.status;
  if (event.tasksDone !== undefined) row.tasks_done = event.tasksDone;
  if (event.tasksTotal !== undefined) row.tasks_total = event.tasksTotal;
  if (event.daysRemaining !== undefined) row.days_remaining = event.daysRemaining;
  if (event.assignees !== undefined) row.assignees = event.assignees;
  if (event.startDate !== undefined) row.start_date = event.startDate;
  if (event.endDate !== undefined) row.end_date   = event.endDate;
  if (event.coverImage !== undefined) row.cover_image = event.coverImage;
  return row;
}

function rowToTask(row: Record<string, unknown>): UnioTask {
  return {
    id:          row.id as string,
    title:       row.title as string,
    event:       row.event as string,
    eventColor:  row.event_color as string,
    priority:    row.priority as UnioTask["priority"],
    status:      row.status as UnioTask["status"],
    due:         row.due as string,
    assignees:   (row.assignees as { i: string; c: string }[]) ?? [],
    description: row.description as string,
    division:    row.division as string | undefined,
    order:       row.order as number | undefined,
  };
}

function taskToRow(task: Partial<UnioTask>, organizerId?: string): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (organizerId) row.organizer_id     = organizerId;
  if (task.id !== undefined) row.id     = task.id;
  if (task.title !== undefined) row.title = task.title;
  if (task.event !== undefined) row.event = task.event;
  if (task.eventColor !== undefined) row.event_color = task.eventColor;
  if (task.priority !== undefined) row.priority = task.priority;
  if (task.status !== undefined) row.status = task.status;
  if (task.due !== undefined) row.due   = task.due;
  if (task.assignees !== undefined) row.assignees = task.assignees;
  if (task.description !== undefined) row.description = task.description;
  if (task.division !== undefined) row.division = task.division;
  if (task.order !== undefined) row.order = task.order;
  return row;
}

function rowToMeeting(row: Record<string, unknown>): UnioMeeting {
  return {
    id:         row.id as string,
    title:      row.title as string,
    event:      row.event as string,
    eventColor: row.event_color as string,
    date:       row.date as string,
    time:       row.time as string,
    duration:   row.duration as number,
    location:   row.location as string,
    status:     row.status as UnioMeeting["status"],
    attendees:  (row.attendees as { i: string; c: string }[]) ?? [],
    agenda:     row.agenda as string,
    notes:      row.notes as string,
  };
}

function meetingToRow(m: Partial<UnioMeeting>, organizerId?: string): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (organizerId) row.organizer_id = organizerId;
  if (m.id !== undefined) row.id    = m.id;
  if (m.title !== undefined) row.title = m.title;
  if (m.event !== undefined) row.event = m.event;
  if (m.eventColor !== undefined) row.event_color = m.eventColor;
  if (m.date !== undefined) row.date   = m.date;
  if (m.time !== undefined) row.time   = m.time;
  if (m.duration !== undefined) row.duration = m.duration;
  if (m.location !== undefined) row.location = m.location;
  if (m.status !== undefined) row.status = m.status;
  if (m.attendees !== undefined) row.attendees = m.attendees;
  if (m.agenda !== undefined) row.agenda = m.agenda;
  if (m.notes !== undefined) row.notes  = m.notes;
  return row;
}

function rowToParticipant(row: Record<string, unknown>): UnioParticipant {
  return {
    id:           row.id as string,
    name:         row.name as string,
    email:        row.email as string,
    phone:        row.phone as string,
    rollNo:       row.roll_no as string,
    dept:         row.dept as string,
    status:       row.status as UnioParticipant["status"],
    registeredAt: row.registered_at as string,
    checkedInAt:  row.checked_in_at as string | undefined,
    eventId:      row.event_id as string,
  };
}

function participantToRow(p: Partial<UnioParticipant>, organizerId?: string): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (organizerId) row.organizer_id      = organizerId;
  if (p.id !== undefined) row.id         = p.id;
  if (p.name !== undefined) row.name     = p.name;
  if (p.email !== undefined) row.email   = p.email;
  if (p.phone !== undefined) row.phone   = p.phone;
  if (p.rollNo !== undefined) row.roll_no = p.rollNo;
  if (p.dept !== undefined) row.dept     = p.dept;
  if (p.status !== undefined) row.status = p.status;
  if (p.registeredAt !== undefined) row.registered_at = p.registeredAt;
  if ("checkedInAt" in p) row.checked_in_at = p.checkedInAt;
  if (p.eventId !== undefined) row.event_id = p.eventId;
  return row;
}

// ── EVENTS ────────────────────────────────────────────────────────

export async function loadEvents(): Promise<UnioEvent[]> {
  if (!isSupabaseConfigured()) return storeLoadEvents();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return storeLoadEvents();
  const events = data.map(rowToEvent);
  // Keep localStorage in sync for offline fallback
  storeSaveEvents(events);
  return events;
}

export async function addEvent(event: UnioEvent): Promise<void> {
  if (!isSupabaseConfigured()) {
    const { addEvent: storeAdd } = await import("@/lib/store");
    storeAdd(event);
    return;
  }
  
  const ctx = await withTimeout(getUserContext(), 5000, "getUserContext timed out after 5 seconds");
  if (!ctx) {
    throw new Error("Failed to get user context (returned null)");
  }

  const row = eventToRow(event, ctx.activeClubId);
  const { error } = await withTimeout(
    supabase.from("events").insert(row),
    5000,
    "Database insert timed out after 5 seconds"
  );
  
  if (error) {
    throw new Error(error.message || "Unknown database error");
  } else {
    await logActivity(ctx.activeClubId, `${event.name} created`, "Events · New event").catch(console.error);
    notifyChange();
  }
}

export async function updateEvent(id: string, updates: Partial<UnioEvent>): Promise<void> {
  if (!isSupabaseConfigured()) {
    const { updateEvent: storeUpdate } = await import("@/lib/store");
    storeUpdate(id, updates);
    return;
  }
  const row = eventToRow(updates);
  row.updated_at = new Date().toISOString();
  await supabase.from("events").update(row).eq("id", id);
  notifyChange();
}

export async function deleteEvent(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const { deleteEvent: storeDel } = await import("@/lib/store");
    storeDel(id);
    return;
  }
  await supabase.from("events").delete().eq("id", id);
  notifyChange();
}

export async function getEventById(id: string): Promise<UnioEvent | undefined> {
  if (!isSupabaseConfigured()) {
    const { getEventById: storeGet } = await import("@/lib/store");
    return storeGet(id);
  }
  const { data } = await supabase.from("events").select("*").eq("id", id).single();
  return data ? rowToEvent(data) : undefined;
}

// ── TASKS ─────────────────────────────────────────────────────────

export async function loadTasks(): Promise<UnioTask[]> {
  if (!isSupabaseConfigured()) return storeLoadTasks();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return storeLoadTasks();
  return data.map(rowToTask);
}

export async function addTask(task: UnioTask): Promise<void> {
  if (!isSupabaseConfigured()) {
    const { addTask: storeAdd } = await import("@/lib/store");
    storeAdd(task);
    return;
  }
  const ctx = await withTimeout(getUserContext(), 5000, "getUserContext timed out");
  if (!ctx) throw new Error("Failed to get user context");
  const { error } = await withTimeout(supabase.from("tasks").insert(taskToRow(task, ctx.activeClubId)), 5000, "Database insert timed out");
  if (error) throw new Error(error.message);
  notifyChange();
}

export async function updateTask(id: string, updates: Partial<UnioTask>): Promise<void> {
  if (!isSupabaseConfigured()) {
    const { updateTask: storeUpdate } = await import("@/lib/store");
    storeUpdate(id, updates);
    return;
  }
  const row = taskToRow(updates);
  row.updated_at = new Date().toISOString();
  const { error } = await withTimeout(supabase.from("tasks").update(row).eq("id", id), 5000, "Database update timed out");
  if (error) throw new Error(error.message);
  notifyChange();
}

export async function saveTasks(tasks: UnioTask[]): Promise<void> {
  // Used by the tasks page for bulk status-cycle
  if (!isSupabaseConfigured()) {
    storeSaveTasks(tasks);
    return;
  }
  // Upsert all tasks in a single call
  const ctx = await withTimeout(getUserContext(), 5000, "getUserContext timed out");
  if (!ctx) throw new Error("Failed to get user context");
  const { error } = await withTimeout(supabase.from("tasks").upsert(tasks.map((t) => taskToRow(t, ctx.activeClubId))), 5000, "Database upsert timed out");
  if (error) throw new Error(error.message);
  notifyChange();
}

export async function deleteTask(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const { deleteTask: storeDel } = await import("@/lib/store");
    storeDel(id);
    return;
  }
  const { error } = await withTimeout(supabase.from("tasks").delete().eq("id", id), 5000, "Database delete timed out");
  if (error) throw new Error(error.message);
  notifyChange();
}

// ── MEETINGS ──────────────────────────────────────────────────────

export async function loadMeetings(): Promise<UnioMeeting[]> {
  if (!isSupabaseConfigured()) return storeLoadMeetings();
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .order("date", { ascending: true });
  if (error || !data) return storeLoadMeetings();
  return data.map(rowToMeeting);
}

export async function addMeeting(meeting: UnioMeeting): Promise<void> {
  if (!isSupabaseConfigured()) {
    storeAddActivity(`Meeting "${meeting.title}" scheduled`, `Meetings · ${meeting.event}`);
    const meetings = storeLoadMeetings();
    storeSaveMeetings([meeting, ...meetings]);
    return;
  }
  const ctx = await withTimeout(getUserContext(), 5000, "getUserContext timed out");
  if (!ctx) throw new Error("Failed to get user context");
  const { error } = await withTimeout(supabase.from("meetings").insert(meetingToRow(meeting, ctx.activeClubId)), 5000, "Database insert timed out");
  if (error) throw new Error(error.message);
  await logActivity(ctx.activeClubId, `Meeting "${meeting.title}" scheduled`, `Meetings · ${meeting.event}`);
  notifyChange();
}

export async function updateMeeting(id: string, updates: Partial<UnioMeeting>): Promise<void> {
  if (!isSupabaseConfigured()) {
    const meetings = storeLoadMeetings();
    storeSaveMeetings(meetings.map(m => m.id === id ? { ...m, ...updates } : m));
    return;
  }
  const row = meetingToRow(updates);
  row.updated_at = new Date().toISOString();
  const { error } = await withTimeout(supabase.from("meetings").update(row).eq("id", id), 5000, "Database update timed out");
  if (error) throw new Error(error.message);
  notifyChange();
}

export async function deleteMeeting(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    storeSaveMeetings(storeLoadMeetings().filter(m => m.id !== id));
    return;
  }
  const { error } = await withTimeout(supabase.from("meetings").delete().eq("id", id), 5000, "Database delete timed out");
  if (error) throw new Error(error.message);
  notifyChange();
}

export async function saveMeetings(meetings: UnioMeeting[]): Promise<void> {
  if (!isSupabaseConfigured()) {
    storeSaveMeetings(meetings);
    return;
  }
  const ctx = await withTimeout(getUserContext(), 5000, "getUserContext timed out");
  if (!ctx) throw new Error("Failed to get user context");
  const { error } = await withTimeout(supabase.from("meetings").upsert(meetings.map((m) => meetingToRow(m, ctx.activeClubId))), 5000, "Database upsert timed out");
  if (error) throw new Error(error.message);
  notifyChange();
}

// ── PARTICIPANTS ──────────────────────────────────────────────────

export async function loadParticipants(): Promise<UnioParticipant[]> {
  if (!isSupabaseConfigured()) return storeLoadParticipants();
  const { data, error } = await supabase
    .from("participants")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return storeLoadParticipants();
  return data.map(rowToParticipant);
}

export async function getParticipantsForEvent(eventId: string): Promise<UnioParticipant[]> {
  if (!isSupabaseConfigured()) return storeGetParticipantsForEvent(eventId);
  const { data, error } = await supabase
    .from("participants")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error || !data) return storeGetParticipantsForEvent(eventId);
  return data.map(rowToParticipant);
}

export async function addParticipant(p: UnioParticipant): Promise<void> {
  if (!isSupabaseConfigured()) {
    const all = storeLoadParticipants();
    storeSaveParticipants([p, ...all]);
    storeAddActivity(`${p.name} registered`, `Participants · ${p.dept}`);
    return;
  }
  const ctx = await withTimeout(getUserContext(), 5000, "getUserContext timed out");
  if (!ctx) throw new Error("Failed to get user context");
  const { error } = await withTimeout(supabase.from("participants").insert(participantToRow(p, ctx.activeClubId)), 5000, "Database insert timed out");
  if (error) throw new Error(error.message);
  await logActivity(ctx.activeClubId, `${p.name} registered`, `Participants · ${p.dept}`);
  notifyChange();
}

export async function updateParticipant(id: string, updates: Partial<UnioParticipant>): Promise<void> {
  if (!isSupabaseConfigured()) {
    const all = storeLoadParticipants();
    storeSaveParticipants(all.map(p => p.id === id ? { ...p, ...updates } : p));
    window.dispatchEvent(new CustomEvent("unio-store-change", { detail: { domain: "participants" } }));
    return;
  }
  const row = participantToRow(updates);
  row.updated_at = new Date().toISOString();
  const { error } = await withTimeout(supabase.from("participants").update(row).eq("id", id), 5000, "Database update timed out");
  if (error) throw new Error(error.message);
  // Dispatch local event so the UI updates without a full refetch
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("unio-store-change", { detail: { domain: "participants" } }));
  }
}

export async function checkInParticipant(id: string): Promise<void> {
  const checkedInAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  await updateParticipant(id, { status: "checked-in", checkedInAt });
}

export async function deleteParticipant(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    storeSaveParticipants(storeLoadParticipants().filter(p => p.id !== id));
    return;
  }
  const { error } = await withTimeout(supabase.from("participants").delete().eq("id", id), 5000, "Database delete timed out");
  if (error) throw new Error(error.message);
  notifyChange();
}

export async function saveParticipants(participants: UnioParticipant[]): Promise<void> {
  if (!isSupabaseConfigured()) {
    storeSaveParticipants(participants);
    return;
  }
  const ctx = await withTimeout(getUserContext(), 5000, "getUserContext timed out");
  if (!ctx) throw new Error("Failed to get user context");
  const { error } = await withTimeout(supabase.from("participants").upsert(participants.map((p) => participantToRow(p, ctx.activeClubId))), 5000, "Database upsert timed out");
  if (error) throw new Error(error.message);
  notifyChange();
}

// ── ACTIVITY ──────────────────────────────────────────────────────

export async function loadActivity(): Promise<ActivityItem[]> {
  if (!isSupabaseConfigured()) return storeLoadActivity();
  const { data, error } = await supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !data) return storeLoadActivity();
  return data.map(row => ({
    id:        row.id as string,
    title:     row.title as string,
    meta:      row.meta as string,
    timestamp: new Date(row.created_at as string).getTime(),
  }));
}

// ── DASHBOARD ─────────────────────────────────────────────────────

export async function getDashboardStats() {
  if (!isSupabaseConfigured()) return storeGetDashboardStats();
  const [events, tasks, participants, meetings] = await Promise.all([
    loadEvents(),
    loadTasks(),
    loadParticipants(),
    loadMeetings(),
  ]);
  return {
    totalEvents:      events.length,
    activeTasks:      tasks.filter(t => t.status !== "done").length,
    totalParticipants: participants.length,
    upcomingMeetings: meetings.filter(m => m.status === "upcoming").length,
  };
}

export async function getUpcomingEvents(): Promise<UnioEvent[]> {
  if (!isSupabaseConfigured()) return storeGetUpcomingEvents();
  const { data } = await supabase
    .from("events")
    .select("*")
    .neq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(3);
  return (data ?? []).map(rowToEvent);
}

// ── TEAM MANAGEMENT ───────────────────────────────────────────────

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  initials: string;
};

export async function loadTeamMembers(): Promise<TeamMember[]> {
  if (!isSupabaseConfigured()) return [];
  const ctx = await getUserContext();
  if (!ctx) return [];

  // Get the president
  const { data: presidentData } = await supabase
    .from("profiles")
    .select("id, name, initials, role")
    .eq("id", ctx.activeClubId)
    .single();

  // Get all mates
  const { data: matesData } = await supabase
    .from("club_members")
    .select("user_id, role")
    .eq("club_id", ctx.activeClubId);

  const team: TeamMember[] = [];
  if (presidentData) {
    const { data: authUser } = await supabase.auth.admin?.getUserById(presidentData.id) || { data: null };
    team.push({
      id: presidentData.id,
      name: presidentData.name,
      email: authUser?.user?.email || "president@club.com",
      role: presidentData.role as UserRole,
      initials: presidentData.initials,
    });
  }

  // To fetch emails of mates properly requires admin API or a secure edge function,
  // but for Phase 2 prototype, we'll fetch their profiles and use placeholder emails
  // if admin API isn't exposed to the client.
  if (matesData && matesData.length > 0) {
    const mateIds = matesData.map((m) => m.user_id);
    const { data: mateProfiles } = await supabase
      .from("profiles")
      .select("id, name, initials")
      .in("id", mateIds);
    
    if (mateProfiles) {
      mateProfiles.forEach((p) => {
        team.push({
          id: p.id,
          name: p.name,
          email: "mate@club.com", // Placeholder
          role: "mate",
          initials: p.initials,
        });
      });
    }
  }

  return team;
}

export async function removeTeamMember(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const ctx = await getUserContext();
  if (!ctx || ctx.role !== "president") return;
  
  await supabase.from("club_members").delete().eq("club_id", ctx.activeClubId).eq("user_id", userId);
}

export async function inviteTeamMember(email: string): Promise<{ success: boolean; token?: string }> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }
  const ctx = await getUserContext();
  if (!ctx || (ctx.role !== "president" && ctx.role !== "developer")) {
    throw new Error("Forbidden: You do not have permission to invite team members.");
  }

  const token = crypto.randomUUID();
  const { error } = await supabase.from("club_invitations").insert({
    club_id: ctx.activeClubId,
    email,
    token,
    role: "mate",
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (error) throw new Error(error.message);
  return { success: true, token };
}

export async function acceptTeamInvite(token: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase not configured" };
  }
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "not_logged_in" };
  }
  
  const { error } = await supabase.rpc("accept_invitation", { invite_token: token });
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true };
}
