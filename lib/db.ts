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
  saveActivity as storeSaveActivity,
  addActivity as storeAddActivity,
  getDashboardStats as storeGetDashboardStats,
  getUpcomingEvents as storeGetUpcomingEvents,
  getParticipantsForEvent as storeGetParticipantsForEvent,
  // Phase 1 — comms
  loadAnnouncements as storeLoadAnnouncements,
  saveAnnouncements as storeSaveAnnouncements,
  addAnnouncementLocal,
  loadAnnouncementReads as storeLoadAnnouncementReads,
  markAnnouncementReadLocal,
  loadComments as storeLoadComments,
  saveAllComments as storeSaveAllComments,
  addCommentLocal,
  loadNotifications as storeLoadNotifications,
  saveNotifications as storeSaveNotifications,
  markNotificationReadLocal,
  markAllNotificationsReadLocal,
  // Phase 2 — participant lifecycle
  loadFeedback as storeLoadFeedback,
  addFeedbackLocal,
  loadCertificates as storeLoadCertificates,
  saveCertificates as storeSaveCertificates,
  addParticipant as storeAddParticipant,
  // Phase 3 — budgets, sponsors, files
  loadBudgetEntries as storeLoadBudgetEntries,
  addBudgetEntryLocal,
  deleteBudgetEntryLocal,
  loadSponsors as storeLoadSponsors,
  addSponsorLocal,
  updateSponsorLocal,
  deleteSponsorLocal,
  loadEventFiles as storeLoadEventFiles,
  addEventFileLocal,
  deleteEventFileLocal,
  // Phase 4 — automation
  loadTaskTemplates as storeLoadTaskTemplates,
  addTaskTemplateLocal,
  deleteTaskTemplateLocal,
  loadTaskDependencies as storeLoadTaskDependencies,
  addTaskDependencyLocal,
  removeTaskDependencyLocal,
  addTask as storeAddTask,
  type UnioEvent,
  type UnioTask,
  type UnioMeeting,
  type UnioParticipant,
  type ActivityItem,
  type UnioAnnouncement,
  type UnioComment,
  type CommentParentType,
  type UnioNotification,
  type UnioFeedback,
  type UnioCertificate,
  type UnioBudgetEntry,
  type UnioSponsor,
  type UnioEventFile,
  type BudgetKind,
  type SponsorTier,
  type SponsorStatus,
  type FileKind,
  type UnioTaskTemplate,
  type UnioTaskTemplateItem,
  type RecurrenceType,
  type TaskPriority,
  type TaskDependencyEdge,
  type UnioApprovalRequest,
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

  // Step 1: race getSession() against a 3s timeout. On the happy path this
  // returns instantly from in-memory state; on a hung token-refresh it bails out.
  // 1.5s was too tight — cold-start tabs legitimately exceed it.
  let userId: string | null = null;
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("getSession soft-timeout")), 3000)
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
    // Demo/local IDs like "u-ayaan" reach here in offline mode — that's expected,
    // not an error; just refuse to use them for organizer_id writes.
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
    isPublic:      (row.is_public as boolean) ?? false,
    registrationOpen: (row.registration_open as boolean) ?? true,
    registrationClosesAt: (row.registration_closes_at as string | undefined) ?? undefined,
    deletedAt:     (row.deleted_at as string | undefined) ?? undefined,
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
  if (event.isPublic !== undefined) row.is_public = event.isPublic;
  if (event.registrationOpen !== undefined) row.registration_open = event.registrationOpen;
  if ("registrationClosesAt" in event) row.registration_closes_at = event.registrationClosesAt ?? null;
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
    deletedAt:   (row.deleted_at as string | undefined) ?? undefined,
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
    recurrenceType:     (row.recurrence_type as UnioMeeting["recurrenceType"]) ?? "none",
    recurrenceUntil:    (row.recurrence_until as string | null) ?? undefined,
    recurrenceSeriesId: (row.recurrence_series_id as string | null) ?? undefined,
    deletedAt:          (row.deleted_at as string | undefined) ?? undefined,
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
  if (m.recurrenceType !== undefined) row.recurrence_type = m.recurrenceType;
  if ("recurrenceUntil" in m) row.recurrence_until = m.recurrenceUntil ?? null;
  if ("recurrenceSeriesId" in m) row.recurrence_series_id = m.recurrenceSeriesId ?? null;
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
    source:       (row.source as UnioParticipant["source"]) ?? undefined,
    waitlistPosition: (row.waitlist_position as number | null) ?? undefined,
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
  if (!isSupabaseConfigured()) return storeLoadEvents().filter((e) => !e.deletedAt);
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error || !data) return storeLoadEvents().filter((e) => !e.deletedAt);
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
  // Soft delete — set deleted_at, keep the row recoverable from Trash.
  if (!isSupabaseConfigured()) {
    const { updateEvent: storeUpdate } = await import("@/lib/store");
    storeUpdate(id, { deletedAt: new Date().toISOString() });
    return;
  }
  await supabase.from("events").update({ deleted_at: new Date().toISOString() }).eq("id", id);
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
  if (!isSupabaseConfigured()) return storeLoadTasks().filter((t) => !t.deletedAt);
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error || !data) return storeLoadTasks().filter((t) => !t.deletedAt);
  const tasks = data.map(rowToTask);
  storeSaveTasks(tasks);
  return tasks;
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
  // Soft delete — set deleted_at, keep the row recoverable from Trash.
  if (!isSupabaseConfigured()) {
    const { updateTask: storeUpdate } = await import("@/lib/store");
    storeUpdate(id, { deletedAt: new Date().toISOString() });
    return;
  }
  const { error } = await withTimeout(
    supabase.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", id),
    5000,
    "Database delete timed out"
  );
  if (error) throw new Error(error.message);
  notifyChange();
}

// ── MEETINGS ──────────────────────────────────────────────────────

export async function loadMeetings(): Promise<UnioMeeting[]> {
  if (!isSupabaseConfigured()) return storeLoadMeetings().filter((m) => !m.deletedAt);
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .is("deleted_at", null)
    .order("date", { ascending: true });
  if (error || !data) return storeLoadMeetings().filter((m) => !m.deletedAt);
  const meetings = data.map(rowToMeeting);
  storeSaveMeetings(meetings);
  return meetings;
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
  // Soft delete — set deleted_at.
  if (!isSupabaseConfigured()) {
    const now = new Date().toISOString();
    storeSaveMeetings(storeLoadMeetings().map(m => m.id === id ? { ...m, deletedAt: now } : m));
    return;
  }
  const { error } = await withTimeout(
    supabase.from("meetings").update({ deleted_at: new Date().toISOString() }).eq("id", id),
    5000,
    "Database delete timed out"
  );
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
  const participants = data.map(rowToParticipant);
  storeSaveParticipants(participants);
  return participants;
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
  const items: ActivityItem[] = data.map(row => ({
    id:        row.id as string,
    title:     row.title as string,
    meta:      row.meta as string,
    timestamp: new Date(row.created_at as string).getTime(),
  }));
  storeSaveActivity(items);
  return items;
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

  // President profile (single row keyed by auth.uid()).
  const { data: presidentData } = await supabase
    .from("profiles")
    .select("id, name, initials, role, email")
    .eq("id", ctx.activeClubId)
    .single();

  // Mate club_members rows.
  const { data: matesData } = await supabase
    .from("club_members")
    .select("user_id, role")
    .eq("club_id", ctx.activeClubId);

  const team: TeamMember[] = [];
  const seen = new Set<string>();

  if (presidentData) {
    team.push({
      id: presidentData.id,
      name: presidentData.name,
      email: presidentData.email || "",
      role: presidentData.role as UserRole,
      initials: presidentData.initials,
    });
    seen.add(presidentData.id);
  }

  if (matesData && matesData.length > 0) {
    // Exclude the president — they live in profiles, not as a "mate" of themselves.
    const mateIds = matesData
      .map((m) => m.user_id)
      .filter((id) => !seen.has(id));

    if (mateIds.length > 0) {
      const { data: mateProfiles } = await supabase
        .from("profiles")
        .select("id, name, initials, email")
        .in("id", mateIds);

      if (mateProfiles) {
        mateProfiles.forEach((p) => {
          if (seen.has(p.id)) return; // belt-and-suspenders dedupe
          seen.add(p.id);
          team.push({
            id: p.id,
            name: p.name,
            email: p.email || "",
            role: "mate",
            initials: p.initials,
          });
        });
      }
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
  const ctx = await withTimeout(
    getUserContext(),
    5000,
    "Sign-in expired — please refresh the page."
  );
  if (!ctx || (ctx.role !== "president" && ctx.role !== "developer")) {
    throw new Error("You do not have permission to invite team members.");
  }

  const token = crypto.randomUUID();
  // We don't send invited_by because some older copies of club_invitations
  // pre-date that column — the v5 migration added it via CREATE TABLE IF
  // NOT EXISTS, which is a no-op when the table already existed.
  // The supabase_rbac_migration_v5_fix.sql migration backfills it; until
  // it's run, the field stays optional client-side.
  const insertPromise = supabase.from("club_invitations").insert({
    club_id: ctx.activeClubId,
    email,
    token,
    role: "mate",
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  const { error } = await withTimeout(insertPromise, 10000, "Invite timed out — check your connection.");

  if (error) {
    console.error("inviteTeamMember insert error:", error);
    throw new Error(error.message);
  }
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

// ══════════════════════════════════════════════════════════════════
// PHASE 1 — COMMS DATA LAYER
// announcements / comments / notifications, dual-layer with realtime.
// ══════════════════════════════════════════════════════════════════

type RealtimeUnsubscribe = () => void;

// ── ANNOUNCEMENTS ───────────────────────────────────────────────

function rowToAnnouncement(row: Record<string, unknown>): UnioAnnouncement {
  return {
    id:             row.id as string,
    clubId:         row.club_id as string,
    authorId:       row.author_id as string,
    authorName:     (row.author_name as string | undefined) ?? undefined,
    authorInitials: (row.author_initials as string | undefined) ?? undefined,
    title:          row.title as string,
    bodyMd:         (row.body_md as string) ?? "",
    pinned:         (row.pinned as boolean) ?? false,
    expiresAt:      (row.expires_at as string | undefined) ?? undefined,
    createdAt:      row.created_at as string,
  };
}

export async function loadAnnouncements(): Promise<UnioAnnouncement[]> {
  if (!isSupabaseConfigured()) return storeLoadAnnouncements();
  const ctx = await getUserContext();
  if (!ctx) return storeLoadAnnouncements();

  // Fetch announcements (no PostgREST embed — the FK is to auth.users,
  // not to public.profiles, so the embed route doesn't exist). We hydrate
  // author names with a separate batched profiles lookup.
  //
  // We also do NOT filter expires_at server-side because PostgREST's .or()
  // with a fully-precision ISO timestamp can silently fail — expired rows
  // are cheap, just hide them client-side.
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("club_id", ctx.activeClubId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("loadAnnouncements failed:", error.message);
    return storeLoadAnnouncements();
  }
  if (!data) return storeLoadAnnouncements();

  // Batched profile lookup for author names.
  const authorIds = Array.from(new Set(data.map((r) => (r as { author_id: string }).author_id))).filter(Boolean);
  const profileByAuthor = new Map<string, { name?: string; initials?: string }>();
  if (authorIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, name, initials")
      .in("id", authorIds);
    for (const p of profs ?? []) {
      profileByAuthor.set(p.id as string, { name: p.name as string, initials: p.initials as string });
    }
  }

  const now = Date.now();
  const items: UnioAnnouncement[] = data
    .filter((row) => {
      const ex = (row as { expires_at?: string }).expires_at;
      if (!ex) return true;
      const t = new Date(ex).getTime();
      return isNaN(t) || t > now;
    })
    .map((row) => {
      const r = row as Record<string, unknown>;
      const profile = profileByAuthor.get(r.author_id as string);
      return {
        ...rowToAnnouncement(r),
        authorName: profile?.name,
        authorInitials: profile?.initials,
      };
    });
  storeSaveAnnouncements(items);
  return items;
}

export async function addAnnouncement(
  input: { title: string; bodyMd: string; pinned?: boolean; expiresAt?: string | null }
): Promise<UnioAnnouncement> {
  const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `local-${Date.now()}`;
  const createdAt = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    const local: UnioAnnouncement = {
      id, clubId: "local", authorId: "local",
      title: input.title, bodyMd: input.bodyMd,
      pinned: !!input.pinned, expiresAt: input.expiresAt ?? undefined, createdAt,
    };
    addAnnouncementLocal(local);
    return local;
  }

  const ctx = await withTimeout(getUserContext(), 5000, "Sign-in expired — please refresh the page.");
  if (!ctx) throw new Error("You appear to be signed out. Refresh and try again.");

  // Hard-cap the insert so a stalled connection never spins forever.
  const insertPromise = supabase
    .from("announcements")
    .insert({
      club_id:    ctx.activeClubId,
      author_id:  ctx.userId,
      title:      input.title,
      body_md:    input.bodyMd,
      pinned:     !!input.pinned,
      expires_at: input.expiresAt ?? null,
    })
    .select()
    .single();
  const { data, error } = await withTimeout(insertPromise, 10000, "Announcement timed out — check your connection.");
  if (error || !data) {
    console.error("addAnnouncement insert error:", error);
    throw new Error(error?.message || "Failed to create announcement");
  }

  const created = rowToAnnouncement(data);
  // Mirror to localStorage so the announcement is visible immediately even
  // if the subsequent re-fetch from Supabase fails or is delayed.
  addAnnouncementLocal(created);

  // Fan out is best-effort and time-capped — never blocks the user's success path.
  withTimeout(
    supabase.rpc("fanout_announcement", {
      p_club_id: ctx.activeClubId,
      p_announcement_id: data.id,
      p_title: input.title,
    }),
    5000,
    "fanout timed out"
  ).then(undefined, (e) => console.warn("fanout_announcement failed:", e));

  notifyChange();
  return created;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    storeSaveAnnouncements(storeLoadAnnouncements().filter((a) => a.id !== id));
    return;
  }
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw new Error(error.message);
  notifyChange();
}

export async function loadAnnouncementReadIds(): Promise<string[]> {
  if (!isSupabaseConfigured()) return storeLoadAnnouncementReads();
  const ctx = await getUserContext();
  if (!ctx) return storeLoadAnnouncementReads();
  const { data, error } = await supabase
    .from("announcement_reads")
    .select("announcement_id")
    .eq("user_id", ctx.userId);
  if (error || !data) return storeLoadAnnouncementReads();
  return data.map((r) => r.announcement_id as string);
}

export async function markAnnouncementRead(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    markAnnouncementReadLocal(id);
    return;
  }
  const ctx = await getUserContext();
  if (!ctx) {
    markAnnouncementReadLocal(id);
    return;
  }
  await supabase
    .from("announcement_reads")
    .upsert({ user_id: ctx.userId, announcement_id: id }, { onConflict: "user_id,announcement_id" });
  markAnnouncementReadLocal(id);
}

export function subscribeAnnouncements(onChange: () => void): RealtimeUnsubscribe {
  if (!isSupabaseConfigured()) return () => {};
  const channel = supabase
    .channel("unio:announcements")
    .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ── COMMENTS ─────────────────────────────────────────────────────

function rowToComment(row: Record<string, unknown>): UnioComment {
  const profile = (row as { profiles?: { name?: string; initials?: string } }).profiles;
  return {
    id:             row.id as string,
    clubId:         row.club_id as string,
    parentType:     row.parent_type as CommentParentType,
    parentId:       row.parent_id as string,
    authorId:       row.author_id as string,
    authorName:     profile?.name,
    authorInitials: profile?.initials,
    bodyMd:         row.body_md as string,
    mentions:       (row.mentions as string[]) ?? [],
    createdAt:      row.created_at as string,
  };
}

export async function loadCommentsFor(parentType: CommentParentType, parentId: string): Promise<UnioComment[]> {
  if (!isSupabaseConfigured()) return storeLoadComments(parentType, parentId);
  // No PostgREST embed — FK points to auth.users, not public.profiles.
  // Hydrate author names with a batched lookup.
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("parent_type", parentType)
    .eq("parent_id", parentId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("loadCommentsFor failed:", error.message);
    return storeLoadComments(parentType, parentId);
  }
  if (!data) return storeLoadComments(parentType, parentId);

  const authorIds = Array.from(new Set(data.map((r) => (r as { author_id: string }).author_id))).filter(Boolean);
  const profileByAuthor = new Map<string, { name?: string; initials?: string }>();
  if (authorIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, name, initials")
      .in("id", authorIds);
    for (const p of profs ?? []) {
      profileByAuthor.set(p.id as string, { name: p.name as string, initials: p.initials as string });
    }
  }

  return data.map((row) => {
    const r = row as Record<string, unknown>;
    const profile = profileByAuthor.get(r.author_id as string);
    const c = rowToComment(r);
    return { ...c, authorName: profile?.name, authorInitials: profile?.initials };
  });
}

export async function addComment(input: {
  parentType: CommentParentType;
  parentId: string;
  bodyMd: string;
  mentions?: string[];
}): Promise<UnioComment> {
  const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `local-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const mentions = input.mentions ?? [];

  if (!isSupabaseConfigured()) {
    const local: UnioComment = {
      id, clubId: "local", parentType: input.parentType, parentId: input.parentId,
      authorId: "local", bodyMd: input.bodyMd, mentions, createdAt,
    };
    addCommentLocal(local);
    return local;
  }

  const ctx = await withTimeout(getUserContext(), 5000, "getUserContext timed out");
  if (!ctx) throw new Error("Failed to get user context");

  // No embed on the select — FK is to auth.users, not profiles.
  const { data, error } = await supabase
    .from("comments")
    .insert({
      club_id:     ctx.activeClubId,
      parent_type: input.parentType,
      parent_id:   input.parentId,
      author_id:   ctx.userId,
      body_md:     input.bodyMd,
      mentions,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to create comment");

  const created = rowToComment(data as Record<string, unknown>);
  // Mirror to localStorage so the comment shows up immediately even if a
  // subsequent re-fetch hits a transient error.
  addCommentLocal(created);

  if (mentions.length > 0) {
    supabase.rpc("fanout_mentions", {
      p_club_id:     ctx.activeClubId,
      p_comment_id:  data.id,
      p_mentions:    mentions,
      p_parent_type: input.parentType,
      p_parent_id:   input.parentId,
    }).then(undefined, (e) => console.warn("fanout_mentions failed:", e));
  }

  notifyChange();
  return created;
}

export async function deleteComment(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const all = (await import("@/lib/store")).loadComments;
    // No direct global comment delete in store; emulate via loadAll + filter
    const allKey = "unio_comments_v1";
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(allKey);
        const list = raw ? (JSON.parse(raw) as UnioComment[]) : [];
        const next = list.filter((c) => c.id !== id);
        localStorage.setItem(allKey, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent("unio-store-change", { detail: { domain: "comments" } }));
      } catch { /* noop */ }
    }
    void all;
    return;
  }
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function subscribeComments(
  parentType: CommentParentType,
  parentId: string,
  onChange: () => void,
): RealtimeUnsubscribe {
  if (!isSupabaseConfigured()) return () => {};
  const channel = supabase
    .channel(`unio:comments:${parentType}:${parentId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "comments", filter: `parent_id=eq.${parentId}` },
      () => onChange()
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ── NOTIFICATIONS ───────────────────────────────────────────────

function rowToNotification(row: Record<string, unknown>): UnioNotification {
  return {
    id:        row.id as string,
    userId:    row.user_id as string,
    type:      row.type as UnioNotification["type"],
    payload:   (row.payload as Record<string, unknown>) ?? {},
    readAt:    (row.read_at as string | undefined) ?? undefined,
    createdAt: row.created_at as string,
  };
}

export async function loadNotifications(): Promise<UnioNotification[]> {
  if (!isSupabaseConfigured()) return storeLoadNotifications();
  const ctx = await getUserContext();
  if (!ctx) return storeLoadNotifications();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data) return storeLoadNotifications();
  const items = data.map((r) => rowToNotification(r as Record<string, unknown>));
  storeSaveNotifications(items);
  return items;
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    markNotificationReadLocal(id);
    return;
  }
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  markNotificationReadLocal(id);
}

export async function markAllNotificationsRead(): Promise<void> {
  if (!isSupabaseConfigured()) {
    markAllNotificationsReadLocal();
    return;
  }
  const ctx = await getUserContext();
  if (!ctx) {
    markAllNotificationsReadLocal();
    return;
  }
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", ctx.userId)
    .is("read_at", null);
  if (error) throw new Error(error.message);
  markAllNotificationsReadLocal();
}

export function subscribeNotifications(userId: string, onChange: () => void): RealtimeUnsubscribe {
  if (!isSupabaseConfigured()) return () => {};
  const channel = supabase
    .channel(`unio:notifications:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      () => onChange()
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 2 — Participant Lifecycle
// Public registration, waitlist, feedback, cert issuance, broadcast.
// ═══════════════════════════════════════════════════════════════════

export type PublicEventView = {
  id: string;
  name: string;
  type: string;
  description: string;
  date: string;
  venue: string;
  capacity: number | null;
  registered: number;
  status: string;
  registration_open: boolean;
  registration_closes_at: string | null;
  cover_image: string | null;
};

/** Read-only public event projection — safe to call from anon (no session). */
export async function getPublicEvent(eventId: string): Promise<PublicEventView | null> {
  if (!isSupabaseConfigured()) {
    const e = storeLoadEvents().find((x) => x.id === eventId);
    if (!e) return null;
    const registered = storeLoadParticipants().filter(
      (p) => p.eventId === eventId && (p.status === "registered" || p.status === "checked-in" || p.status === "attended")
    ).length;
    return {
      id: e.id, name: e.name, type: e.type, description: e.description,
      date: e.date, venue: e.venue, capacity: e.capacity ?? null,
      registered, status: e.status,
      registration_open: e.registrationOpen ?? true,
      registration_closes_at: e.registrationClosesAt ?? null,
      cover_image: e.coverImage ?? null,
    };
  }
  const { data, error } = await supabase.rpc("get_public_event", { p_event_id: eventId });
  if (error) {
    console.warn("getPublicEvent:", error.message);
    return null;
  }
  const payload = data as { ok?: boolean; event?: PublicEventView };
  if (!payload?.ok) return null;
  return payload.event ?? null;
}

export type RegisterResult = {
  ok: boolean;
  status?: "registered" | "waitlisted";
  participantId?: string;
  waitlistPosition?: number | null;
  error?: string;
};

export async function registerForEvent(input: {
  eventId: string;
  name: string;
  email: string;
  phone?: string;
  dept?: string;
  rollNo?: string;
}): Promise<RegisterResult> {
  if (!isSupabaseConfigured()) {
    // Local-only fallback: mimic the RPC's behavior so the demo flow works.
    const events = storeLoadEvents();
    const event = events.find((e) => e.id === input.eventId);
    if (!event) return { ok: false, error: "event_not_found" };
    if (event.isPublic !== true) return { ok: false, error: "event_not_public" };
    if (event.registrationOpen === false) return { ok: false, error: "registration_closed" };

    const all = storeLoadParticipants();
    const dupe = all.some(
      (p) => p.eventId === input.eventId &&
             p.email.toLowerCase() === input.email.toLowerCase() &&
             p.status !== "cancelled"
    );
    if (dupe) return { ok: false, error: "already_registered" };

    const activeCount = all.filter(
      (p) => p.eventId === input.eventId &&
             (p.status === "registered" || p.status === "checked-in" || p.status === "attended")
    ).length;

    let status: UnioParticipant["status"] = "registered";
    let waitlistPosition: number | undefined;
    if (event.capacity !== null && event.capacity !== undefined && activeCount >= event.capacity) {
      status = "waitlisted";
      const wlMax = all
        .filter((p) => p.eventId === input.eventId && p.status === "waitlisted")
        .reduce((m, p) => Math.max(m, p.waitlistPosition ?? 0), 0);
      waitlistPosition = wlMax + 1;
    }

    const participantId = crypto.randomUUID();
    storeAddParticipant({
      id: participantId,
      eventId: input.eventId,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone ?? "",
      rollNo: input.rollNo ?? "",
      dept: input.dept ?? "",
      status,
      source: "public",
      waitlistPosition,
      registeredAt: "Just now",
    });

    return { ok: true, status, participantId, waitlistPosition };
  }

  const { data, error } = await supabase.rpc("register_for_event", {
    p_event_id: input.eventId,
    p_name: input.name,
    p_email: input.email,
    p_phone: input.phone ?? "",
    p_dept: input.dept ?? "",
    p_roll_no: input.rollNo ?? "",
  });
  if (error) return { ok: false, error: error.message };
  const r = data as { ok: boolean; status?: string; participant_id?: string; waitlist_position?: number | null; error?: string };
  return {
    ok: r.ok,
    status: r.status as RegisterResult["status"],
    participantId: r.participant_id,
    waitlistPosition: r.waitlist_position ?? null,
    error: r.error,
  };
}

export async function cancelRegistration(participantId: string): Promise<{ ok: boolean; promotedId?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    // Local fallback: flip status and promote next waitlist.
    const all = storeLoadParticipants();
    const idx = all.findIndex((p) => p.id === participantId);
    if (idx === -1) return { ok: false, error: "not_found" };
    const wasActive = ["registered", "checked-in", "attended"].includes(all[idx].status);
    all[idx] = { ...all[idx], status: "cancelled" };
    let promotedId: string | undefined;
    if (wasActive) {
      const eventId = all[idx].eventId;
      const waitlist = all
        .filter((p) => p.eventId === eventId && p.status === "waitlisted")
        .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0));
      const next = waitlist[0];
      if (next) {
        const ni = all.findIndex((p) => p.id === next.id);
        all[ni] = { ...all[ni], status: "registered", waitlistPosition: undefined };
        promotedId = next.id;
      }
    }
    storeSaveParticipants(all);
    return { ok: true, promotedId };
  }
  const { data, error } = await supabase.rpc("cancel_registration", { p_participant_id: participantId });
  if (error) return { ok: false, error: error.message };
  const r = data as { ok: boolean; promoted_id?: string; error?: string };
  return { ok: r.ok, promotedId: r.promoted_id, error: r.error };
}

// ── FEEDBACK ────────────────────────────────────────────────────────
function rowToFeedback(row: Record<string, unknown>): UnioFeedback {
  return {
    id:        row.id as string,
    eventId:   row.event_id as string,
    name:      (row.name as string) ?? "Anonymous",
    email:     (row.email as string | null) ?? undefined,
    rating:    row.rating as number,
    comment:   (row.comment as string) ?? "",
    createdAt: row.created_at as string,
  };
}

export async function submitFeedback(input: {
  eventId: string;
  name: string;
  email: string;
  rating: number;
  comment: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    addFeedbackLocal({
      id: crypto.randomUUID(),
      eventId: input.eventId,
      name: input.name || "Anonymous",
      email: input.email || undefined,
      rating: input.rating,
      comment: input.comment,
      createdAt: new Date().toISOString(),
    });
    return { ok: true };
  }
  const { data, error } = await supabase.rpc("submit_feedback", {
    p_event_id: input.eventId,
    p_name: input.name,
    p_email: input.email,
    p_rating: input.rating,
    p_comment: input.comment,
  });
  if (error) return { ok: false, error: error.message };
  const r = data as { ok: boolean; error?: string };
  return r;
}

export async function loadFeedback(eventId: string): Promise<UnioFeedback[]> {
  if (!isSupabaseConfigured()) return storeLoadFeedback(eventId);
  const { data, error } = await supabase
    .from("event_feedback")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("loadFeedback:", error.message);
    return storeLoadFeedback(eventId);
  }
  return (data ?? []).map(rowToFeedback);
}

// ── CERTIFICATES ISSUED ─────────────────────────────────────────────
function rowToCertificate(row: Record<string, unknown>): UnioCertificate {
  return {
    id:                row.id as string,
    eventId:           row.event_id as string,
    participantId:     row.participant_id as string,
    participantName:   row.participant_name as string,
    participantEmail:  row.participant_email as string,
    issuedAt:          row.issued_at as string,
  };
}

export async function issueCertificates(eventId: string): Promise<{ ok: boolean; issued?: number; error?: string }> {
  if (!isSupabaseConfigured()) {
    const all = storeLoadParticipants().filter(
      (p) => p.eventId === eventId && (p.status === "checked-in" || p.status === "attended")
    );
    const existing = storeLoadCertificates(eventId);
    const existingSet = new Set(existing.map((c) => c.participantId));
    const fresh: UnioCertificate[] = all
      .filter((p) => !existingSet.has(p.id))
      .map((p) => ({
        id: crypto.randomUUID(),
        eventId,
        participantId: p.id,
        participantName: p.name,
        participantEmail: p.email,
        issuedAt: new Date().toISOString(),
      }));
    storeSaveCertificates([...storeLoadCertificates(), ...fresh]);
    return { ok: true, issued: fresh.length };
  }
  const { data, error } = await supabase.rpc("issue_certificates", { p_event_id: eventId });
  if (error) return { ok: false, error: error.message };
  const r = data as { ok: boolean; issued?: number; error?: string };
  return r;
}

export async function loadIssuedCertificates(eventId: string): Promise<UnioCertificate[]> {
  if (!isSupabaseConfigured()) return storeLoadCertificates(eventId);
  const { data, error } = await supabase
    .from("certificates_issued")
    .select("*")
    .eq("event_id", eventId)
    .order("issued_at", { ascending: false });
  if (error) {
    console.warn("loadIssuedCertificates:", error.message);
    return storeLoadCertificates(eventId);
  }
  return (data ?? []).map(rowToCertificate);
}

// ── BROADCAST ───────────────────────────────────────────────────────
/**
 * Posts to the local broadcast API route. Caller supplies the recipient
 * list (RLS-bounded fetch is done on the client; server doesn't need a
 * service-role key).
 */
export async function broadcastToParticipants(input: {
  eventId: string;
  subject: string;
  message: string;
  recipients: string[];
}): Promise<{ ok: boolean; sent?: number; mode?: "resend" | "noop"; error?: string }> {
  try {
    const res = await fetch(`/api/events/${encodeURIComponent(input.eventId)}/broadcast`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subject: input.subject,
        message: input.message,
        recipients: input.recipients,
      }),
    });
    const j = await res.json();
    if (!res.ok) return { ok: false, error: j?.error ?? "broadcast_failed" };
    return j;
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "broadcast_error" };
  }
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 3 — Budgets, Sponsors, Files
// ═══════════════════════════════════════════════════════════════════

// ── BUDGET ENTRIES ──────────────────────────────────────────────────
function rowToBudget(row: Record<string, unknown>): UnioBudgetEntry {
  return {
    id:        row.id as string,
    eventId:   row.event_id as string,
    kind:      row.kind as BudgetKind,
    category:  (row.category as string) ?? "Other",
    label:     row.label as string,
    amount:    Number(row.amount ?? 0),
    notes:     (row.notes as string) ?? "",
    paidAt:    (row.paid_at as string | null) ?? undefined,
    createdAt: row.created_at as string,
  };
}

export async function loadBudgetEntries(eventId: string): Promise<UnioBudgetEntry[]> {
  if (!isSupabaseConfigured()) return storeLoadBudgetEntries(eventId);
  const { data, error } = await supabase
    .from("budget_entries")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("loadBudgetEntries:", error.message);
    return storeLoadBudgetEntries(eventId);
  }
  return (data ?? []).map(rowToBudget);
}

export async function addBudgetEntry(input: {
  eventId: string;
  kind: BudgetKind;
  category: string;
  label: string;
  amount: number;
  notes?: string;
  paidAt?: string;
}): Promise<UnioBudgetEntry | null> {
  const draft: UnioBudgetEntry = {
    id: crypto.randomUUID(),
    eventId: input.eventId,
    kind: input.kind,
    category: input.category || "Other",
    label: input.label,
    amount: Number(input.amount) || 0,
    notes: input.notes ?? "",
    paidAt: input.paidAt,
    createdAt: new Date().toISOString(),
  };
  if (!isSupabaseConfigured()) {
    addBudgetEntryLocal(draft);
    return draft;
  }
  const ctx = await getUserContext();
  if (!ctx) {
    addBudgetEntryLocal(draft);
    return draft;
  }
  const { data, error } = await supabase
    .from("budget_entries")
    .insert({
      event_id: input.eventId,
      organizer_id: ctx.userId,
      kind: input.kind,
      category: input.category || "Other",
      label: input.label,
      amount: input.amount,
      notes: input.notes ?? "",
      paid_at: input.paidAt ?? null,
    })
    .select()
    .single();
  if (error) {
    console.warn("addBudgetEntry:", error.message);
    addBudgetEntryLocal(draft);
    return draft;
  }
  const row = rowToBudget(data);
  addBudgetEntryLocal(row);
  await logActivity(ctx.userId, "Budget entry added", `${input.kind === "income" ? "+" : "-"}${input.amount} · ${input.label}`);
  return row;
}

export async function deleteBudgetEntry(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    deleteBudgetEntryLocal(id);
    return;
  }
  const { error } = await supabase.from("budget_entries").delete().eq("id", id);
  if (error) console.warn("deleteBudgetEntry:", error.message);
  deleteBudgetEntryLocal(id);
}

// ── SPONSORS ────────────────────────────────────────────────────────
function rowToSponsor(row: Record<string, unknown>): UnioSponsor {
  return {
    id:           row.id as string,
    eventId:      row.event_id as string,
    name:         row.name as string,
    tier:         row.tier as SponsorTier,
    status:       row.status as SponsorStatus,
    amount:       Number(row.amount ?? 0),
    contactName:  (row.contact_name as string) ?? "",
    contactEmail: (row.contact_email as string) ?? "",
    contactPhone: (row.contact_phone as string) ?? "",
    logoUrl:      (row.logo_url as string | null) ?? undefined,
    notes:        (row.notes as string) ?? "",
    createdAt:    row.created_at as string,
  };
}

export async function loadSponsors(eventId: string): Promise<UnioSponsor[]> {
  if (!isSupabaseConfigured()) return storeLoadSponsors(eventId);
  const { data, error } = await supabase
    .from("sponsors")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("loadSponsors:", error.message);
    return storeLoadSponsors(eventId);
  }
  return (data ?? []).map(rowToSponsor);
}

export async function addSponsor(input: {
  eventId: string;
  name: string;
  tier?: SponsorTier;
  status?: SponsorStatus;
  amount?: number;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  logoUrl?: string;
  notes?: string;
}): Promise<UnioSponsor | null> {
  const draft: UnioSponsor = {
    id: crypto.randomUUID(),
    eventId: input.eventId,
    name: input.name,
    tier: input.tier ?? "silver",
    status: input.status ?? "prospect",
    amount: input.amount ?? 0,
    contactName: input.contactName ?? "",
    contactEmail: input.contactEmail ?? "",
    contactPhone: input.contactPhone ?? "",
    logoUrl: input.logoUrl,
    notes: input.notes ?? "",
    createdAt: new Date().toISOString(),
  };
  if (!isSupabaseConfigured()) {
    addSponsorLocal(draft);
    return draft;
  }
  const ctx = await getUserContext();
  if (!ctx) {
    addSponsorLocal(draft);
    return draft;
  }
  const { data, error } = await supabase
    .from("sponsors")
    .insert({
      event_id: input.eventId,
      organizer_id: ctx.userId,
      name: input.name,
      tier: input.tier ?? "silver",
      status: input.status ?? "prospect",
      amount: input.amount ?? 0,
      contact_name: input.contactName ?? "",
      contact_email: input.contactEmail ?? "",
      contact_phone: input.contactPhone ?? "",
      logo_url: input.logoUrl ?? null,
      notes: input.notes ?? "",
    })
    .select()
    .single();
  if (error) {
    console.warn("addSponsor:", error.message);
    addSponsorLocal(draft);
    return draft;
  }
  const row = rowToSponsor(data);
  addSponsorLocal(row);
  return row;
}

export async function updateSponsor(id: string, updates: Partial<UnioSponsor>): Promise<void> {
  updateSponsorLocal(id, updates);
  if (!isSupabaseConfigured()) return;
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.tier !== undefined) row.tier = updates.tier;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.amount !== undefined) row.amount = updates.amount;
  if (updates.contactName !== undefined) row.contact_name = updates.contactName;
  if (updates.contactEmail !== undefined) row.contact_email = updates.contactEmail;
  if (updates.contactPhone !== undefined) row.contact_phone = updates.contactPhone;
  if ("logoUrl" in updates) row.logo_url = updates.logoUrl ?? null;
  if (updates.notes !== undefined) row.notes = updates.notes;
  const { error } = await supabase.from("sponsors").update(row).eq("id", id);
  if (error) console.warn("updateSponsor:", error.message);
}

export async function deleteSponsor(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    deleteSponsorLocal(id);
    return;
  }
  const { error } = await supabase.from("sponsors").delete().eq("id", id);
  if (error) console.warn("deleteSponsor:", error.message);
  deleteSponsorLocal(id);
}

// ── EVENT FILES (Supabase Storage) ──────────────────────────────────
const FILE_BUCKET = "event-files";

function rowToEventFile(row: Record<string, unknown>): UnioEventFile {
  return {
    id:           row.id as string,
    eventId:      row.event_id as string,
    kind:         row.kind as FileKind,
    name:         row.name as string,
    mime:         row.mime as string,
    sizeBytes:    Number(row.size_bytes ?? 0),
    storagePath:  row.storage_path as string,
    publicUrl:    (row.public_url as string | null) ?? undefined,
    createdAt:    row.created_at as string,
  };
}

export async function loadEventFiles(eventId: string): Promise<UnioEventFile[]> {
  if (!isSupabaseConfigured()) return storeLoadEventFiles(eventId);
  const { data, error } = await supabase
    .from("event_files")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("loadEventFiles:", error.message);
    return storeLoadEventFiles(eventId);
  }
  return (data ?? []).map(rowToEventFile);
}

/**
 * Uploads `file` to the event-files bucket and creates an event_files row.
 * If Supabase isn't configured, falls back to a base64 data URL stored only
 * in local state (no persistence beyond localStorage).
 */
export async function uploadEventFile(input: {
  eventId: string;
  file: File;
  kind?: FileKind;
}): Promise<UnioEventFile | { ok: false; error: string }> {
  const kind = input.kind ?? "attachment";

  if (!isSupabaseConfigured()) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read_failed"));
      reader.readAsDataURL(input.file);
    });
    const rec: UnioEventFile = {
      id: crypto.randomUUID(),
      eventId: input.eventId,
      kind,
      name: input.file.name,
      mime: input.file.type || "application/octet-stream",
      sizeBytes: input.file.size,
      storagePath: `local/${input.eventId}/${input.file.name}`,
      publicUrl: dataUrl,
      createdAt: new Date().toISOString(),
    };
    addEventFileLocal(rec);
    return rec;
  }

  const ctx = await getUserContext();
  if (!ctx) return { ok: false, error: "not_authenticated" };

  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `${ctx.userId}/${input.eventId}/${Date.now()}_${safeName}`;

  const { error: upErr } = await supabase.storage.from(FILE_BUCKET).upload(path, input.file, {
    contentType: input.file.type || undefined,
    upsert: false,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const { data: pub } = supabase.storage.from(FILE_BUCKET).getPublicUrl(path);
  const publicUrl = pub?.publicUrl;

  const { data, error } = await supabase
    .from("event_files")
    .insert({
      event_id: input.eventId,
      organizer_id: ctx.userId,
      uploaded_by: ctx.userId,
      kind,
      name: input.file.name,
      mime: input.file.type || "application/octet-stream",
      size_bytes: input.file.size,
      storage_path: path,
      public_url: publicUrl,
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };

  const rec = rowToEventFile(data);
  addEventFileLocal(rec);
  return rec;
}

export async function deleteEventFile(file: UnioEventFile): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error: storageErr } = await supabase.storage.from(FILE_BUCKET).remove([file.storagePath]);
    if (storageErr) console.warn("deleteEventFile (storage):", storageErr.message);
    const { error } = await supabase.from("event_files").delete().eq("id", file.id);
    if (error) console.warn("deleteEventFile (row):", error.message);
  }
  deleteEventFileLocal(file.id);
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 4 — Automation
// Task templates, task dependencies, recurring meetings, due reminders.
// ═══════════════════════════════════════════════════════════════════

// ── TASK TEMPLATES ──────────────────────────────────────────────────
function rowToTaskTemplate(row: Record<string, unknown>, items: UnioTaskTemplateItem[] = []): UnioTaskTemplate {
  return {
    id:          row.id as string,
    name:        row.name as string,
    description: (row.description as string) ?? "",
    eventType:   row.event_type as UnioTaskTemplate["eventType"],
    isShared:    Boolean(row.is_shared),
    createdAt:   row.created_at as string,
    items,
  };
}

function rowToTemplateItem(row: Record<string, unknown>): UnioTaskTemplateItem {
  return {
    id:          row.id as string,
    templateId:  row.template_id as string,
    title:       row.title as string,
    description: (row.description as string) ?? "",
    priority:    row.priority as TaskPriority,
    division:    (row.division as string) ?? "",
    daysOffset:  Number(row.days_offset ?? 0),
    order:       Number(row.order ?? 0),
  };
}

export async function loadTaskTemplates(): Promise<UnioTaskTemplate[]> {
  if (!isSupabaseConfigured()) return storeLoadTaskTemplates();
  const { data: tpls, error: e1 } = await supabase
    .from("task_templates")
    .select("*")
    .order("created_at", { ascending: false });
  if (e1 || !tpls) {
    console.warn("loadTaskTemplates:", e1?.message);
    return storeLoadTaskTemplates();
  }
  if (tpls.length === 0) return [];
  const ids = tpls.map((t) => t.id);
  const { data: items } = await supabase
    .from("task_template_items")
    .select("*")
    .in("template_id", ids)
    .order("order", { ascending: true });
  const byTpl = new Map<string, UnioTaskTemplateItem[]>();
  for (const r of items ?? []) {
    const item = rowToTemplateItem(r);
    if (!byTpl.has(item.templateId)) byTpl.set(item.templateId, []);
    byTpl.get(item.templateId)!.push(item);
  }
  return tpls.map((t) => rowToTaskTemplate(t, byTpl.get(t.id as string) ?? []));
}

export async function addTaskTemplate(input: {
  name: string;
  description?: string;
  eventType: UnioTaskTemplate["eventType"];
  isShared?: boolean;
  items: Array<Omit<UnioTaskTemplateItem, "id" | "templateId">>;
}): Promise<UnioTaskTemplate | { ok: false; error: string }> {
  const draft: UnioTaskTemplate = {
    id: crypto.randomUUID(),
    name: input.name,
    description: input.description ?? "",
    eventType: input.eventType,
    isShared: input.isShared ?? false,
    createdAt: new Date().toISOString(),
    items: input.items.map((it, idx) => ({
      ...it,
      id: crypto.randomUUID(),
      templateId: "local",
      order: it.order ?? idx,
    })),
  };

  if (!isSupabaseConfigured()) {
    addTaskTemplateLocal(draft);
    return draft;
  }

  const ctx = await getUserContext();
  if (!ctx) return { ok: false, error: "not_authenticated" };

  const { data: tpl, error } = await supabase
    .from("task_templates")
    .insert({
      organizer_id: ctx.userId,
      name: input.name,
      description: input.description ?? "",
      event_type: input.eventType,
      is_shared: input.isShared ?? false,
    })
    .select()
    .single();
  if (error || !tpl) return { ok: false, error: error?.message ?? "insert_failed" };

  const templateId = tpl.id as string;
  if (input.items.length > 0) {
    const itemRows = input.items.map((it, idx) => ({
      template_id: templateId,
      title: it.title,
      description: it.description ?? "",
      priority: it.priority ?? "Medium",
      division: it.division ?? "",
      days_offset: it.daysOffset ?? 0,
      order: it.order ?? idx,
    }));
    const { error: itErr } = await supabase.from("task_template_items").insert(itemRows);
    if (itErr) console.warn("addTaskTemplate items:", itErr.message);
  }

  const created = rowToTaskTemplate(tpl, draft.items.map((it) => ({ ...it, templateId })));
  addTaskTemplateLocal(created);
  return created;
}

export async function deleteTaskTemplate(id: string): Promise<void> {
  deleteTaskTemplateLocal(id);
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.from("task_templates").delete().eq("id", id);
  if (error) console.warn("deleteTaskTemplate:", error.message);
}

export async function applyTaskTemplate(input: {
  templateId: string;
  eventId: string;
  startDate?: string;
}): Promise<{ ok: boolean; inserted?: number; error?: string }> {
  if (!isSupabaseConfigured()) {
    // Local fallback: read the template, expand into tasks via storeAddTask.
    const tpl = storeLoadTaskTemplates().find((t) => t.id === input.templateId);
    if (!tpl) return { ok: false, error: "template_not_found" };
    const start = input.startDate ? new Date(input.startDate) : new Date();
    const events = storeLoadEvents();
    const event = events.find((e) => e.id === input.eventId);
    if (!event) return { ok: false, error: "event_not_found" };
    let inserted = 0;
    for (const it of tpl.items) {
      const due = new Date(start.getTime() + (it.daysOffset || 0) * 86_400_000);
      const dueLabel = due.toLocaleString("en-US", { month: "short", day: "2-digit" });
      storeAddTask({
        id: `t${Date.now()}_${inserted}`,
        title: it.title,
        event: event.name,
        eventColor: "#6366F1",
        priority: it.priority,
        status: "todo",
        due: dueLabel,
        assignees: [],
        description: it.description,
        division: it.division || undefined,
        order: it.order,
      });
      inserted++;
    }
    return { ok: true, inserted };
  }

  const { data, error } = await supabase.rpc("apply_task_template", {
    p_template_id: input.templateId,
    p_event_id: input.eventId,
    p_start_date: input.startDate ?? new Date().toISOString().slice(0, 10),
  });
  if (error) return { ok: false, error: error.message };
  const r = data as { ok: boolean; inserted?: number; error?: string };
  return r;
}

// ── TASK DEPENDENCIES ───────────────────────────────────────────────
export async function loadTaskDependencies(): Promise<TaskDependencyEdge[]> {
  if (!isSupabaseConfigured()) return storeLoadTaskDependencies();
  const { data, error } = await supabase
    .from("task_dependencies")
    .select("task_id, depends_on_task_id");
  if (error) {
    console.warn("loadTaskDependencies:", error.message);
    return storeLoadTaskDependencies();
  }
  return (data ?? []).map((r) => ({
    taskId: r.task_id as string,
    dependsOnTaskId: r.depends_on_task_id as string,
  }));
}

export async function addTaskDependency(edge: TaskDependencyEdge): Promise<{ ok: boolean; error?: string }> {
  addTaskDependencyLocal(edge);
  if (!isSupabaseConfigured()) return { ok: true };
  const { error } = await supabase.from("task_dependencies").insert({
    task_id: edge.taskId,
    depends_on_task_id: edge.dependsOnTaskId,
  });
  if (error && !error.message.includes("duplicate")) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function removeTaskDependency(edge: TaskDependencyEdge): Promise<void> {
  removeTaskDependencyLocal(edge);
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase
    .from("task_dependencies")
    .delete()
    .eq("task_id", edge.taskId)
    .eq("depends_on_task_id", edge.dependsOnTaskId);
  if (error) console.warn("removeTaskDependency:", error.message);
}

/** True when every dependency of `taskId` is marked done. */
export function isTaskUnblocked(taskId: string, allTasks: UnioTask[], deps: TaskDependencyEdge[]): boolean {
  const parents = deps.filter((d) => d.taskId === taskId).map((d) => d.dependsOnTaskId);
  if (parents.length === 0) return true;
  return parents.every((pid) => allTasks.find((t) => t.id === pid)?.status === "done");
}

// ── RECURRING MEETINGS ──────────────────────────────────────────────
/**
 * Expand a meeting series into instances and persist them. Returns the
 * full list of meetings created (including the seed).
 *
 * The caller passes the "seed" meeting (the first occurrence) plus the
 * recurrence pattern. We compute subsequent dates and insert one row
 * per occurrence, all sharing the same recurrence_series_id.
 */
export async function addRecurringMeetings(input: {
  seed: UnioMeeting;
  recurrenceType: Exclude<RecurrenceType, "none">;
  until: string;
}): Promise<UnioMeeting[]> {
  const series_id = crypto.randomUUID();
  const seedDate = parseLooseDate(input.seed.date);
  const untilDate = new Date(input.until);
  if (!seedDate || isNaN(untilDate.getTime()) || untilDate < seedDate) {
    // Fall back to inserting just the seed.
    await addMeeting({ ...input.seed, recurrenceType: "none" });
    return [input.seed];
  }
  const stepDays =
    input.recurrenceType === "daily"    ? 1 :
    input.recurrenceType === "weekly"   ? 7 :
    input.recurrenceType === "biweekly" ? 14 :
    /* monthly */                          30;

  const occurrences: UnioMeeting[] = [];
  let cursor = new Date(seedDate);
  let i = 0;
  // Cap to 52 to prevent runaway loops.
  while (cursor <= untilDate && i < 52) {
    const m: UnioMeeting = {
      ...input.seed,
      id: i === 0 ? input.seed.id : `m${Date.now()}_${i}`,
      date: formatDateLabel(cursor),
      recurrenceType: input.recurrenceType,
      recurrenceUntil: input.until,
      recurrenceSeriesId: series_id,
    };
    occurrences.push(m);
    if (input.recurrenceType === "monthly") {
      cursor = new Date(cursor);
      cursor.setMonth(cursor.getMonth() + 1);
    } else {
      cursor = new Date(cursor.getTime() + stepDays * 86_400_000);
    }
    i++;
  }

  for (const m of occurrences) {
    await addMeeting(m);
  }
  return occurrences;
}

function parseLooseDate(s: string): Date | null {
  // Try ISO first.
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso;
  return null;
}

function formatDateLabel(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── DUE REMINDERS ───────────────────────────────────────────────────
export async function checkDueReminders(): Promise<{ ok: boolean; created?: number; error?: string }> {
  if (!isSupabaseConfigured()) {
    // Local-only: scan tasks, create local "due_soon" notifications inline.
    const tasks = storeLoadTasks();
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const todayLabel = today.toLocaleString("en-US", { month: "short", day: "2-digit" });
    const tomorrowLabel = tomorrow.toLocaleString("en-US", { month: "short", day: "2-digit" });
    const matches = tasks.filter(
      (t) => t.status !== "done" && (t.due.startsWith(todayLabel) || t.due.startsWith(tomorrowLabel))
    );
    const existing = storeLoadNotifications();
    const known = new Set(
      existing
        .filter((n) => n.type === "due_soon")
        .map((n) => (n.payload as { task_id?: string }).task_id)
    );
    const fresh = matches.filter((t) => !known.has(t.id));
    if (fresh.length === 0) return { ok: true, created: 0 };
    const now = new Date().toISOString();
    storeSaveNotifications([
      ...fresh.map((t) => ({
        id: crypto.randomUUID(),
        userId: "local",
        type: "due_soon" as const,
        payload: { task_id: t.id, title: t.title },
        createdAt: now,
      })),
      ...existing,
    ]);
    return { ok: true, created: fresh.length };
  }
  const { data, error } = await supabase.rpc("check_due_reminders");
  if (error) return { ok: false, error: error.message };
  return data as { ok: boolean; created?: number };
}

// ── AI BRIEF (template-based, deterministic) ────────────────────────
/**
 * Synthesizes an event brief from the event's tasks, meetings, participants,
 * budget, and sponsors. Returns markdown the caller can render or copy.
 */
export async function generateEventBrief(eventId: string): Promise<string> {
  const [event, tasks, meetings, participants, budget, sponsors, feedback] = await Promise.all([
    getEventById(eventId),
    loadTasks(),
    loadMeetings(),
    getParticipantsForEvent(eventId),
    loadBudgetEntries(eventId),
    loadSponsors(eventId),
    loadFeedback(eventId),
  ]);

  if (!event) return "Event not found.";

  const eventTasks = tasks.filter((t) => t.event === event.name);
  const eventMeetings = meetings.filter((m) => m.event === event.name);
  const tasksDone = eventTasks.filter((t) => t.status === "done").length;
  const tasksOpen = eventTasks.filter((t) => t.status !== "done").length;
  const highPriOpen = eventTasks.filter((t) => t.status !== "done" && t.priority === "High").length;
  const upcomingMeetings = eventMeetings.filter((m) => m.status === "upcoming");
  const totalRegistered = participants.filter((p) => p.status !== "cancelled" && p.status !== "waitlisted").length;
  const totalWaitlisted = participants.filter((p) => p.status === "waitlisted").length;
  const totalCheckedIn = participants.filter((p) => p.status === "checked-in" || p.status === "attended").length;
  const income = budget.filter((b) => b.kind === "income").reduce((s, b) => s + b.amount, 0);
  const expense = budget.filter((b) => b.kind === "expense").reduce((s, b) => s + b.amount, 0);
  const sponsorsConfirmed = sponsors.filter((s) => s.status === "confirmed");
  const avgRating = feedback.length
    ? (feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(1)
    : null;

  const lines: string[] = [];
  lines.push(`# ${event.name}`);
  lines.push(`_${event.type} · ${event.date} · ${event.venue}_`);
  lines.push("");
  if (event.description) {
    lines.push(event.description);
    lines.push("");
  }

  lines.push("## Snapshot");
  lines.push(`- **Status:** ${event.status}${event.daysRemaining > 0 ? ` · ${event.daysRemaining} days remaining` : ""}`);
  lines.push(`- **Participants:** ${totalRegistered} registered${event.capacity ? ` / ${event.capacity} capacity` : ""}${totalWaitlisted ? ` · ${totalWaitlisted} on waitlist` : ""}${totalCheckedIn ? ` · ${totalCheckedIn} checked in` : ""}`);
  lines.push(`- **Tasks:** ${tasksDone} done · ${tasksOpen} open${highPriOpen ? ` · ${highPriOpen} high-priority open` : ""}`);
  if (upcomingMeetings.length) lines.push(`- **Upcoming meetings:** ${upcomingMeetings.length}`);
  if (avgRating != null) lines.push(`- **Feedback:** ${avgRating}/5 across ${feedback.length} response${feedback.length === 1 ? "" : "s"}`);
  lines.push("");

  if (budget.length) {
    lines.push("## Budget");
    lines.push(`- Income: **${income.toFixed(2)}**`);
    lines.push(`- Expense: **${expense.toFixed(2)}**`);
    lines.push(`- Net: **${(income - expense).toFixed(2)}**`);
    lines.push("");
  }

  if (sponsorsConfirmed.length) {
    lines.push("## Confirmed sponsors");
    for (const s of sponsorsConfirmed) {
      lines.push(`- **${s.name}** (${s.tier})${s.amount > 0 ? ` — ${s.amount.toFixed(0)}` : ""}`);
    }
    lines.push("");
  }

  if (upcomingMeetings.length) {
    lines.push("## Upcoming meetings");
    for (const m of upcomingMeetings.slice(0, 5)) {
      lines.push(`- ${m.title} — ${m.date} ${m.time}`);
    }
    lines.push("");
  }

  if (highPriOpen) {
    lines.push("## High-priority open tasks");
    for (const t of eventTasks.filter((t) => t.status !== "done" && t.priority === "High").slice(0, 8)) {
      lines.push(`- [ ] ${t.title}${t.due ? ` — *${t.due}*` : ""}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(`_Generated ${new Date().toLocaleString()}_`);
  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 5 — Approvals, Soft delete (Trash), Audit, QoL
// ═══════════════════════════════════════════════════════════════════

// ── TRASH (soft-deleted rows) ───────────────────────────────────────
export type TrashEntry =
  | { kind: "event";   id: string; title: string; deletedAt: string }
  | { kind: "task";    id: string; title: string; deletedAt: string }
  | { kind: "meeting"; id: string; title: string; deletedAt: string };

export async function loadTrash(): Promise<TrashEntry[]> {
  const all: TrashEntry[] = [];
  if (!isSupabaseConfigured()) {
    const { loadEvents: lE, loadTasks: lT, loadMeetings: lM } = await import("@/lib/store");
    lE().filter((e) => e.deletedAt).forEach((e) => all.push({ kind: "event", id: e.id, title: e.name, deletedAt: e.deletedAt! }));
    lT().filter((t) => t.deletedAt).forEach((t) => all.push({ kind: "task", id: t.id, title: t.title, deletedAt: t.deletedAt! }));
    lM().filter((m) => m.deletedAt).forEach((m) => all.push({ kind: "meeting", id: m.id, title: m.title, deletedAt: m.deletedAt! }));
    return all.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  }

  const [e, t, m] = await Promise.all([
    supabase.from("events").select("id, name, deleted_at").not("deleted_at", "is", null),
    supabase.from("tasks").select("id, title, deleted_at").not("deleted_at", "is", null),
    supabase.from("meetings").select("id, title, deleted_at").not("deleted_at", "is", null),
  ]);
  (e.data ?? []).forEach((r) => all.push({ kind: "event", id: r.id as string, title: r.name as string, deletedAt: r.deleted_at as string }));
  (t.data ?? []).forEach((r) => all.push({ kind: "task", id: r.id as string, title: r.title as string, deletedAt: r.deleted_at as string }));
  (m.data ?? []).forEach((r) => all.push({ kind: "meeting", id: r.id as string, title: r.title as string, deletedAt: r.deleted_at as string }));
  return all.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

export async function restoreFromTrash(kind: TrashEntry["kind"], id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    if (kind === "event") {
      const { loadEvents: lE, saveEvents: sE } = await import("@/lib/store");
      sE(lE().map((x) => (x.id === id ? { ...x, deletedAt: undefined } : x)));
    } else if (kind === "task") {
      const { loadTasks: lT, saveTasks: sT } = await import("@/lib/store");
      sT(lT().map((x) => (x.id === id ? { ...x, deletedAt: undefined } : x)));
    } else {
      const { loadMeetings: lM, saveMeetings: sM } = await import("@/lib/store");
      sM(lM().map((x) => (x.id === id ? { ...x, deletedAt: undefined } : x)));
    }
    notifyChange();
    return;
  }
  const table = kind === "event" ? "events" : kind === "task" ? "tasks" : "meetings";
  const { error } = await supabase.from(table).update({ deleted_at: null }).eq("id", id);
  if (error) throw new Error(error.message);
  notifyChange();
}

export async function purgeFromTrash(kind: TrashEntry["kind"], id: string): Promise<void> {
  // Hard delete — irreversible.
  if (!isSupabaseConfigured()) {
    if (kind === "event") {
      const { loadEvents: lE, saveEvents: sE } = await import("@/lib/store");
      sE(lE().filter((x) => x.id !== id));
    } else if (kind === "task") {
      const { loadTasks: lT, saveTasks: sT } = await import("@/lib/store");
      sT(lT().filter((x) => x.id !== id));
    } else {
      const { loadMeetings: lM, saveMeetings: sM } = await import("@/lib/store");
      sM(lM().filter((x) => x.id !== id));
    }
    notifyChange();
    return;
  }
  const table = kind === "event" ? "events" : kind === "task" ? "tasks" : "meetings";
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
  notifyChange();
}

// ── APPROVAL REQUESTS ───────────────────────────────────────────────
function rowToApproval(row: Record<string, unknown>): UnioApprovalRequest {
  return {
    id:           row.id as string,
    clubId:       row.club_id as string,
    kind:         row.kind as UnioApprovalRequest["kind"],
    payload:      (row.payload as Record<string, unknown>) ?? {},
    status:       row.status as UnioApprovalRequest["status"],
    requesterId:  row.requester_id as string,
    reviewerId:   (row.reviewer_id as string | undefined) ?? undefined,
    reviewerNote: (row.reviewer_note as string) ?? "",
    reviewedAt:   (row.reviewed_at as string | undefined) ?? undefined,
    createdAt:    row.created_at as string,
  };
}

export async function loadApprovals(status?: UnioApprovalRequest["status"]): Promise<UnioApprovalRequest[]> {
  if (!isSupabaseConfigured()) {
    const { loadApprovals: ls } = await import("@/lib/store");
    const all = ls();
    return status ? all.filter((a) => a.status === status) : all;
  }
  const ctx = await getUserContext();
  if (!ctx) return [];

  let q = supabase.from("approval_requests").select("*").eq("club_id", ctx.activeClubId)
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error || !data) return [];

  // Hydrate requester names via batched profile lookup.
  const items = data.map(rowToApproval);
  const ids = Array.from(new Set(items.map((a) => a.requesterId)));
  if (ids.length > 0) {
    const { data: profs } = await supabase.from("profiles").select("id, name").in("id", ids);
    const byId = new Map((profs ?? []).map((p) => [p.id as string, p.name as string]));
    items.forEach((a) => { a.requesterName = byId.get(a.requesterId); });
  }
  return items;
}

export async function requestApproval(input: {
  kind: UnioApprovalRequest["kind"];
  payload: Record<string, unknown>;
}): Promise<UnioApprovalRequest | { ok: false; error: string }> {
  const createdAt = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    const { addApprovalLocal } = await import("@/lib/store");
    const local: UnioApprovalRequest = {
      id: crypto.randomUUID(),
      clubId: "local",
      kind: input.kind,
      payload: input.payload,
      status: "pending",
      requesterId: "local",
      reviewerNote: "",
      createdAt,
    };
    addApprovalLocal(local);
    return local;
  }
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase.from("approval_requests").insert({
    club_id:      ctx.activeClubId,
    kind:         input.kind,
    payload:      input.payload,
    requester_id: ctx.userId,
    status:       "pending",
  }).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? "insert_failed" };
  notifyChange();
  return rowToApproval(data);
}

export async function reviewApproval(input: {
  id: string;
  decision: "approved" | "rejected";
  note?: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    const { updateApprovalLocal } = await import("@/lib/store");
    updateApprovalLocal(input.id, {
      status: input.decision,
      reviewerNote: input.note ?? "",
      reviewedAt: new Date().toISOString(),
    });
    return;
  }
  const ctx = await getUserContext();
  if (!ctx) throw new Error("not_authenticated");
  const { error } = await supabase.from("approval_requests").update({
    status:        input.decision,
    reviewer_id:   ctx.userId,
    reviewer_note: input.note ?? "",
    reviewed_at:   new Date().toISOString(),
  }).eq("id", input.id);
  if (error) throw new Error(error.message);
  notifyChange();
}
