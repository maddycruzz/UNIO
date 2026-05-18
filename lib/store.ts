// ─────────────────────────────────────────────────────────────
// lib/store.ts — Centralised localStorage data layer for UNIO
// Every dashboard page reads from / writes to this single file
// so that data stays consistent across pages and survives
// page refreshes.
// ─────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────

export type EventStatus = "upcoming" | "ongoing" | "completed";
export type EventType = "Cultural" | "Tech" | "Sports" | "Workshop" | "Conference" | "Other";

export interface UnioEvent {
  id: string;
  name: string;
  type: EventType;
  description: string;
  date: string;
  venue: string;
  participants: number;
  /** null/undefined = no participant limit. */
  capacity: number | null;
  completion: number;
  status: EventStatus;
  tasksDone: number;
  tasksTotal: number;
  daysRemaining: number;
  assignees: string[];
  startDate?: string;
  endDate?: string;
  createdAt: string;
  /** Optional cover image as a base64 data URL. Capped client-side; will move to blob storage when a backend exists. */
  coverImage?: string;
  /** Phase 2: when true, /r/<id> public registration page is live. */
  isPublic?: boolean;
  registrationOpen?: boolean;
  registrationClosesAt?: string;
  /** Phase 5: soft-delete timestamp. */
  deletedAt?: string;
}

export type TaskStatus = "todo" | "inprogress" | "done";
export type TaskPriority = "High" | "Medium" | "Low";

export interface UnioTask {
  id: string;
  title: string;
  event: string;
  eventColor: string;
  priority: TaskPriority;
  status: TaskStatus;
  due: string;
  assignees: { i: string; c: string }[];
  description: string;
  /** Optional grouping shown on event detail page. */
  division?: string;
  /** Sort order within a division on event detail page. Lower = earlier. */
  order?: number;
  /** Phase 4 — task IDs that must be done before this one can start. */
  dependsOn?: string[];
  /** Phase 5: soft-delete timestamp. */
  deletedAt?: string;
}

// ── Phase 4: Automation ──────────────────────────────────────

export interface UnioTaskTemplate {
  id: string;
  name: string;
  description: string;
  eventType: EventType;
  isShared: boolean;
  createdAt: string;
  items: UnioTaskTemplateItem[];
}

export interface UnioTaskTemplateItem {
  id: string;
  templateId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  division: string;
  daysOffset: number;
  order: number;
}

// ── Phase 5: Approvals + Soft delete ─────────────────────────

export type ApprovalKind =
  | "event_create" | "event_update" | "event_delete"
  | "task_create"  | "task_delete"
  | "budget_change" | "sponsor_change" | "generic";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface UnioApprovalRequest {
  id: string;
  clubId: string;
  kind: ApprovalKind;
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  requesterId: string;
  requesterName?: string;
  reviewerId?: string;
  reviewerNote: string;
  reviewedAt?: string;
  createdAt: string;
}

export type MeetingStatus = "upcoming" | "ongoing" | "completed";

export type RecurrenceType = "none" | "daily" | "weekly" | "biweekly" | "monthly";

export interface UnioMeeting {
  id: string;
  title: string;
  event: string;
  eventColor: string;
  date: string;
  time: string;
  duration: number;
  location: string;
  status: MeetingStatus;
  attendees: { i: string; c: string }[];
  agenda: string;
  notes: string;
  /** Phase 4 — recurrence. */
  recurrenceType?: RecurrenceType;
  recurrenceUntil?: string;
  recurrenceSeriesId?: string;
  /** Phase 5: soft-delete timestamp. */
  deletedAt?: string;
}

export type ParticipantStatus =
  | "registered"
  | "checked-in"
  | "waitlisted"
  | "attended"
  | "cancelled";

export type ParticipantSource = "manual" | "public" | "import";

export interface UnioParticipant {
  id: string;
  name: string;
  email: string;
  phone: string;
  rollNo: string;
  dept: string;
  status: ParticipantStatus;
  registeredAt: string;
  checkedInAt?: string;
  eventId: string;
  /** Phase 2 — origin of this row. */
  source?: ParticipantSource;
  /** Phase 2 — waitlist queue position (1-based). */
  waitlistPosition?: number;
}

export interface UserProfile {
  name: string;
  initials: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  meta: string;
  /** Render with formatRelativeTime() — do not cache a string. */
  timestamp: number;
}

// ── Phase 1: Communication & Collaboration ───────────────────

export interface UnioAnnouncement {
  id: string;
  clubId: string;
  authorId: string;
  authorName?: string;
  authorInitials?: string;
  title: string;
  bodyMd: string;
  pinned: boolean;
  expiresAt?: string;
  createdAt: string;
}

export type CommentParentType = "event" | "task" | "meeting";

export interface UnioComment {
  id: string;
  clubId: string;
  parentType: CommentParentType;
  parentId: string;
  authorId: string;
  authorName?: string;
  authorInitials?: string;
  bodyMd: string;
  mentions: string[];
  createdAt: string;
}

export type NotificationType =
  | "mention"
  | "assignment"
  | "due_soon"
  | "announcement"
  | "comment_reply";

export interface UnioNotification {
  id: string;
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
}

// ── Phase 2: Participant lifecycle ───────────────────────────

export interface UnioFeedback {
  id: string;
  eventId: string;
  name: string;
  email?: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface UnioCertificate {
  id: string;
  eventId: string;
  participantId: string;
  participantName: string;
  participantEmail: string;
  issuedAt: string;
}

// ── Phase 3: Budgets, sponsors, files ────────────────────────

export type BudgetKind = "income" | "expense";

export interface UnioBudgetEntry {
  id: string;
  eventId: string;
  kind: BudgetKind;
  category: string;
  label: string;
  amount: number;
  notes: string;
  paidAt?: string;
  createdAt: string;
}

export type SponsorTier = "platinum" | "gold" | "silver" | "bronze" | "partner";
export type SponsorStatus = "prospect" | "contacted" | "confirmed" | "declined";

export interface UnioSponsor {
  id: string;
  eventId: string;
  name: string;
  tier: SponsorTier;
  status: SponsorStatus;
  amount: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  logoUrl?: string;
  notes: string;
  createdAt: string;
}

export type FileKind = "cover" | "attachment" | "poster" | "sponsor_logo";

export interface UnioEventFile {
  id: string;
  eventId: string;
  kind: FileKind;
  name: string;
  mime: string;
  sizeBytes: number;
  storagePath: string;
  publicUrl?: string;
  createdAt: string;
}

// ── Keys ─────────────────────────────────────────────────────

const KEYS = {
  events: "unio_events_v2",
  tasks: "unio_tasks_v2",
  meetings: "unio_meetings_v2",
  participants: "unio_participants_v2",
  profile: "unio_profile_v1",
  activity: "unio_activity_v1",
  seeded: "unio_seeded_v3",
  // Phase 1 — comms
  announcements: "unio_announcements_v1",
  announcementReads: "unio_announcement_reads_v1",
  comments: "unio_comments_v1",
  notifications: "unio_notifications_v1",
  // Phase 2 — participant lifecycle
  feedback: "unio_feedback_v1",
  certificates: "unio_certificates_v1",
  // Phase 3 — budgets, sponsors, files
  budgets: "unio_budgets_v1",
  sponsors: "unio_sponsors_v1",
  eventFiles: "unio_event_files_v1",
  // Phase 4 — automation
  taskTemplates: "unio_task_templates_v1",
  taskDependencies: "unio_task_deps_v1",
  // Phase 5 — approvals + soft delete
  approvals: "unio_approvals_v1",
} as const;

// ── Seed Data ────────────────────────────────────────────────
// Seed dates are computed relative to module-load time so the demo
// always looks fresh — no overdue tasks, no past "upcoming" meetings.

const _NOW = Date.now();
const _DAY_MS = 86_400_000;

function _iso(daysFromNow: number): string {
  return new Date(_NOW + daysFromNow * _DAY_MS).toISOString().slice(0, 10);
}

function _display(daysFromNow: number, time: string): string {
  if (daysFromNow === 0) return `Today · ${time}`;
  if (daysFromNow === 1) return `Tomorrow · ${time}`;
  const d = new Date(_NOW + daysFromNow * _DAY_MS);
  const month = d.toLocaleString("en-US", { month: "short" });
  return `${month} ${d.getDate()} · ${time}`;
}

const SEED_EVENTS: UnioEvent[] = [
  {
    id: "spring-fest-night-market",
    name: "Spring Fest Night Market",
    type: "Cultural",
    description: "Night market featuring food stalls, performances, and club showcases across the quad.",
    date: _display(5, "7:00 PM"),
    venue: "Central Quad",
    participants: 200,
    capacity: 300,
    completion: 78,
    status: "upcoming",
    tasksDone: 12,
    tasksTotal: 16,
    daysRemaining: 5,
    assignees: ["AK", "MS", "JR"],
    createdAt: new Date(_NOW - _DAY_MS * 7).toISOString(),
  },
  {
    id: "ai-campus-panel",
    name: "AI in Campus Life Panel",
    type: "Conference",
    description: "Faculty, founders, and students discuss the role of AI on campus life.",
    date: _display(0, "5:30 PM"),
    venue: "Auditorium A",
    participants: 160,
    capacity: 200,
    completion: 92,
    status: "ongoing",
    tasksDone: 18,
    tasksTotal: 20,
    daysRemaining: 0,
    assignees: ["RS", "LT", "NP"],
    createdAt: new Date(_NOW - _DAY_MS * 14).toISOString(),
  },
  {
    id: "founders-pitch-night",
    name: "Founders Club Pitch Night",
    type: "Tech",
    description: "Student founders pitch to alumni, angels, and faculty mentors.",
    date: _display(1, "7:00 PM"),
    venue: "Innovation Hub",
    participants: 120,
    capacity: 150,
    completion: 54,
    status: "upcoming",
    tasksDone: 7,
    tasksTotal: 13,
    daysRemaining: 1,
    assignees: ["AK", "DL", "HS"],
    createdAt: new Date(_NOW - _DAY_MS * 10).toISOString(),
  },
  {
    id: "intramural-sports-meet",
    name: "Intramural Sports Meet",
    type: "Sports",
    description: "Full-day track and field meet bringing together intramural teams.",
    date: _display(-10, "9:00 AM"),
    venue: "Main Stadium",
    participants: 340,
    capacity: 500,
    completion: 100,
    status: "completed",
    tasksDone: 20,
    tasksTotal: 20,
    daysRemaining: 0,
    assignees: ["CG", "VK", "RM"],
    createdAt: new Date(_NOW - _DAY_MS * 30).toISOString(),
  },
];

const SEED_TASKS: UnioTask[] = [
  { id: "t1", title: "Lock venue and timings", event: "Spring Fest Night Market", eventColor: "#6366F1", priority: "High", status: "done", due: _iso(-7), assignees: [{ i: "AK", c: "#6366F1" }, { i: "RS", c: "#10B981" }], description: "Confirm auditorium booking and finalize event timings with admin." },
  { id: "t3", title: "Design posters and social assets", event: "Spring Fest Night Market", eventColor: "#6366F1", priority: "Medium", status: "todo", due: _iso(3), assignees: [{ i: "JR", c: "#EC4899" }, { i: "AK", c: "#6366F1" }], description: "Create Instagram, WhatsApp, and print poster assets." },
  { id: "t5", title: "Plan food stalls and logistics", event: "Spring Fest Night Market", eventColor: "#6366F1", priority: "Medium", status: "inprogress", due: _iso(2), assignees: [{ i: "AK", c: "#6366F1" }], description: "Contact vendors and allocate stall positions on campus map." },
  { id: "t7", title: "Confirm judges panel", event: "Founders Club Pitch Night", eventColor: "#10B981", priority: "High", status: "done", due: _iso(-3), assignees: [{ i: "AK", c: "#6366F1" }, { i: "HS", c: "#F97316" }], description: "Finalize 4 alumni + 2 faculty judges and share briefing doc." },
  { id: "t11", title: "Coordinate AV and stage setup", event: "Founders Club Pitch Night", eventColor: "#10B981", priority: "High", status: "inprogress", due: _iso(1), assignees: [{ i: "AK", c: "#6366F1" }, { i: "DL", c: "#14B8A6" }], description: "Ensure projector, mics, and livestream are configured." },
  { id: "t12", title: "Finalize event schedule", event: "Founders Club Pitch Night", eventColor: "#10B981", priority: "Medium", status: "todo", due: _iso(4), assignees: [{ i: "AK", c: "#6366F1" }], description: "Create minute-by-minute schedule and share with all stakeholders." },
  { id: "t9", title: "Send speaker invites", event: "AI in Campus Life Panel", eventColor: "#F59E0B", priority: "High", status: "done", due: _iso(-5), assignees: [{ i: "RS", c: "#10B981" }, { i: "AK", c: "#6366F1" }], description: "Email confirmed speakers with schedule, venue, and logistics." },
  { id: "t13", title: "Draft event communications", event: "AI in Campus Life Panel", eventColor: "#F59E0B", priority: "Low", status: "todo", due: _iso(6), assignees: [{ i: "AK", c: "#6366F1" }], description: "Write announcement posts for college newsletter and social media." },
];

const SEED_MEETINGS: UnioMeeting[] = [
  {
    id: "m1", title: "Spring Fest Kickoff Sync", event: "Spring Fest Night Market", eventColor: "#6366F1",
    date: _iso(-9), time: "10:00", duration: 60, location: "Room 204, Admin Block",
    status: "completed",
    attendees: [{ i: "AK", c: "#6366F1" }, { i: "RS", c: "#10B981" }, { i: "SP", c: "#EC4899" }],
    agenda: "1. Confirm venue booking\n2. Assign stall coordinators\n3. Set deadlines for design assets",
    notes: "Venue confirmed. Riya to handle stall assignments. Design assets deadline locked.",
  },
  {
    id: "m2", title: "Judges Briefing — Pitch Night", event: "Founders Club Pitch Night", eventColor: "#10B981",
    date: _iso(-6), time: "15:30", duration: 45, location: "Innovation Hub, Level 2",
    status: "completed",
    attendees: [{ i: "AK", c: "#6366F1" }, { i: "HS", c: "#F97316" }, { i: "DL", c: "#14B8A6" }],
    agenda: "1. Walk judges through scoring rubric\n2. Confirm schedule and timings\n3. Share team bios",
    notes: "All 6 judges confirmed. Scoring rubric approved.",
  },
  {
    id: "m3", title: "AV & Stage Setup Review", event: "Founders Club Pitch Night", eventColor: "#10B981",
    date: _iso(0), time: "11:00", duration: 30, location: "Google Meet",
    status: "ongoing",
    attendees: [{ i: "AK", c: "#6366F1" }, { i: "DL", c: "#14B8A6" }],
    agenda: "1. Projector and mic check\n2. Livestream configuration\n3. Run-of-show walkthrough",
    notes: "",
  },
  {
    id: "m4", title: "Speaker Prep Call — AI Panel", event: "AI in Campus Life Panel", eventColor: "#F59E0B",
    date: _iso(2), time: "17:00", duration: 60, location: "Zoom",
    status: "upcoming",
    attendees: [{ i: "AK", c: "#6366F1" }, { i: "RS", c: "#10B981" }, { i: "LT", c: "#8B5CF6" }],
    agenda: "1. Introduce speakers to each other\n2. Walk through panel format\n3. Q&A prep and topic boundaries",
    notes: "",
  },
  {
    id: "m5", title: "Spring Fest Final Walkthrough", event: "Spring Fest Night Market", eventColor: "#6366F1",
    date: _iso(4), time: "14:00", duration: 90, location: "Central Quad",
    status: "upcoming",
    attendees: [{ i: "AK", c: "#6366F1" }, { i: "RS", c: "#10B981" }, { i: "SP", c: "#EC4899" }, { i: "JR", c: "#EC4899" }],
    agenda: "1. Physical walkthrough of stall layout\n2. Check power and lighting setup\n3. Confirm emergency contacts",
    notes: "",
  },
  {
    id: "m6", title: "Post-Event Debrief", event: "AI in Campus Life Panel", eventColor: "#F59E0B",
    date: _iso(7), time: "16:00", duration: 45, location: "Room 101, Student Center",
    status: "upcoming",
    attendees: [{ i: "AK", c: "#6366F1" }, { i: "RS", c: "#10B981" }],
    agenda: "1. What went well\n2. What to improve\n3. Feedback from attendees",
    notes: "",
  },
];

const SEED_PARTICIPANTS: UnioParticipant[] = [
  { id: "p1", name: "Ayaan Nizam", email: "ayaan@college.edu", phone: "9876543210", rollNo: "21CS001", dept: "CS", status: "checked-in", registeredAt: "2 days ago", checkedInAt: "Today 6:42 PM", eventId: "spring-fest-night-market" },
  { id: "p2", name: "Priya Sharma", email: "priya@college.edu", phone: "9876543211", rollNo: "21CS042", dept: "CS", status: "checked-in", registeredAt: "2 days ago", checkedInAt: "Today 6:45 PM", eventId: "spring-fest-night-market" },
  { id: "p3", name: "Rohan Mehta", email: "rohan@college.edu", phone: "9876543212", rollNo: "21EC015", dept: "ECE", status: "registered", registeredAt: "1 day ago", eventId: "spring-fest-night-market" },
  { id: "p4", name: "Sneha Iyer", email: "sneha@college.edu", phone: "9876543213", rollNo: "21ME033", dept: "MECH", status: "registered", registeredAt: "1 day ago", eventId: "spring-fest-night-market" },
  { id: "p5", name: "Karthik Raja", email: "karthik@college.edu", phone: "9876543214", rollNo: "21CS078", dept: "CS", status: "registered", registeredAt: "3 hrs ago", eventId: "spring-fest-night-market" },
  { id: "p6", name: "Divya Krishnan", email: "divya@college.edu", phone: "9876543215", rollNo: "21IT022", dept: "IT", status: "checked-in", registeredAt: "3 days ago", checkedInAt: "Today 7:01 PM", eventId: "spring-fest-night-market" },
  { id: "p7", name: "Arun Balaji", email: "arun@college.edu", phone: "9876543216", rollNo: "21CS090", dept: "CS", status: "registered", registeredAt: "2 days ago", eventId: "ai-campus-panel" },
  { id: "p8", name: "Meera Nair", email: "meera@college.edu", phone: "9876543217", rollNo: "21EC044", dept: "ECE", status: "registered", registeredAt: "1 hr ago", eventId: "ai-campus-panel" },
];

const SEED_PROFILE: UserProfile = { name: "Ayaan", initials: "AK" };

const SEED_ACTIVITY: ActivityItem[] = [
  { id: "a1", title: "Spring Fest Night Market published", meta: "Events · Capacity 200", timestamp: _NOW - 720_000 },
  { id: "a2", title: "Design club standup moved to Studio B", meta: "Meetings · Room change", timestamp: _NOW - 2_700_000 },
  { id: "a3", title: "QR check-ins exported for Hackathon Demo Day", meta: "Participants · CSV export", timestamp: _NOW - 7_200_000 },
];

// ── Helpers ──────────────────────────────────────────────────

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable
  }
}

// ── Seed on first visit ──────────────────────────────────────

export function ensureSeeded(): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(KEYS.seeded)) return;

  // Migrate old keys if they exist
  const oldEvents = localStorage.getItem("unio_events");
  if (oldEvents) {
    try {
      const parsed = JSON.parse(oldEvents);
      const migrated: UnioEvent[] = parsed.map((e: any) => ({
        ...e,
        // Old data used 9999 as "unlimited" sentinel — migrate to null.
        capacity: e.capacity === 9999 ? null : (e.capacity ?? 300),
        createdAt: e.createdAt ?? new Date().toISOString(),
      }));
      save(KEYS.events, migrated);
    } catch {
      save(KEYS.events, SEED_EVENTS);
    }
  } else {
    save(KEYS.events, SEED_EVENTS);
  }

  save(KEYS.tasks, SEED_TASKS);
  save(KEYS.meetings, SEED_MEETINGS);
  save(KEYS.participants, SEED_PARTICIPANTS);
  save(KEYS.profile, SEED_PROFILE);
  save(KEYS.activity, SEED_ACTIVITY);
  localStorage.setItem(KEYS.seeded, "1");
}

// ── Events ───────────────────────────────────────────────────

export function loadEvents(): UnioEvent[] {
  ensureSeeded();
  return load<UnioEvent[]>(KEYS.events, SEED_EVENTS);
}

export function saveEvents(events: UnioEvent[]): void {
  save(KEYS.events, events);
  notify("events");
}

export function getEventById(id: string): UnioEvent | undefined {
  return loadEvents().find((e) => e.id === id);
}

export function addEvent(event: UnioEvent): void {
  const events = loadEvents();
  saveEvents([event, ...events]);
  addActivity(`${event.name} created`, "Events · New event");
}

export function updateEvent(id: string, updates: Partial<UnioEvent>): void {
  const events = loadEvents();
  saveEvents(events.map((e) => (e.id === id ? { ...e, ...updates } : e)));
}

export function deleteEvent(id: string): void {
  const events = loadEvents();
  const ev = events.find((e) => e.id === id);
  saveEvents(events.filter((e) => e.id !== id));
  if (ev) addActivity(`${ev.name} deleted`, "Events · Removed");
}

// ── Tasks ────────────────────────────────────────────────────

export function loadTasks(): UnioTask[] {
  ensureSeeded();
  return load<UnioTask[]>(KEYS.tasks, SEED_TASKS);
}

export function saveTasks(tasks: UnioTask[]): void {
  save(KEYS.tasks, tasks);
  notify("tasks");
}

export function addTask(task: UnioTask): void {
  const tasks = loadTasks();
  saveTasks([task, ...tasks]);
  addActivity(`Task "${task.title}" added`, `Tasks · ${task.event}`);
}

export function updateTask(id: string, updates: Partial<UnioTask>): void {
  const tasks = loadTasks();
  saveTasks(tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)));
}

export function deleteTask(id: string): void {
  saveTasks(loadTasks().filter((t) => t.id !== id));
}

// ── Meetings ─────────────────────────────────────────────────

export function loadMeetings(): UnioMeeting[] {
  ensureSeeded();
  return load<UnioMeeting[]>(KEYS.meetings, SEED_MEETINGS);
}

export function saveMeetings(meetings: UnioMeeting[]): void {
  save(KEYS.meetings, meetings);
  notify("meetings");
}

export function addMeeting(meeting: UnioMeeting): void {
  const meetings = loadMeetings();
  saveMeetings([meeting, ...meetings]);
  addActivity(`Meeting "${meeting.title}" scheduled`, `Meetings · ${meeting.event}`);
}

export function updateMeeting(id: string, updates: Partial<UnioMeeting>): void {
  const meetings = loadMeetings();
  saveMeetings(meetings.map((m) => (m.id === id ? { ...m, ...updates } : m)));
}

export function deleteMeeting(id: string): void {
  saveMeetings(loadMeetings().filter((m) => m.id !== id));
}

// ── Participants ─────────────────────────────────────────────

export function loadParticipants(): UnioParticipant[] {
  ensureSeeded();
  return load<UnioParticipant[]>(KEYS.participants, SEED_PARTICIPANTS);
}

export function saveParticipants(participants: UnioParticipant[]): void {
  save(KEYS.participants, participants);
  notify("participants");
}

export function addParticipant(p: UnioParticipant): void {
  const all = loadParticipants();
  saveParticipants([p, ...all]);
  addActivity(`${p.name} registered`, `Participants · ${p.dept}`);
}

export function updateParticipant(id: string, updates: Partial<UnioParticipant>): void {
  const all = loadParticipants();
  saveParticipants(all.map((p) => (p.id === id ? { ...p, ...updates } : p)));
}

export function deleteParticipant(id: string): void {
  saveParticipants(loadParticipants().filter((p) => p.id !== id));
}

export function getParticipantsForEvent(eventId: string): UnioParticipant[] {
  return loadParticipants().filter((p) => p.eventId === eventId);
}

// ── Profile ──────────────────────────────────────────────────

export function loadProfile(): UserProfile {
  ensureSeeded();
  return load<UserProfile>(KEYS.profile, SEED_PROFILE);
}

export function saveProfile(profile: UserProfile): void {
  save(KEYS.profile, profile);
  notify("profile");
}

// ── Activity ─────────────────────────────────────────────────

export function loadActivity(): ActivityItem[] {
  ensureSeeded();
  return load<ActivityItem[]>(KEYS.activity, SEED_ACTIVITY);
}

export function saveActivity(items: ActivityItem[]): void {
  save(KEYS.activity, items.slice(0, 20));
}

export function addActivity(title: string, meta: string): void {
  const items = loadActivity();
  const now = Date.now();
  const item: ActivityItem = {
    id: `a-${now}`,
    title,
    meta,
    timestamp: now,
  };
  // Keep latest 20
  const updated = [item, ...items].slice(0, 20);
  save(KEYS.activity, updated);
  notify("activity");
}

// ── Dashboard Stats ──────────────────────────────────────────

export function getDashboardStats() {
  const events = loadEvents();
  const tasks = loadTasks();
  const participants = loadParticipants();
  const meetings = loadMeetings();

  return {
    totalEvents: events.length,
    activeTasks: tasks.filter((t) => t.status !== "done").length,
    totalParticipants: participants.length,
    upcomingMeetings: meetings.filter((m) => m.status === "upcoming").length,
  };
}

export function getUpcomingEvents(): UnioEvent[] {
  return loadEvents()
    .filter((e) => e.status !== "completed")
    .slice(0, 3);
}

// ── Event colors ─────────────────────────────────────────────

const EVENT_COLOR_MAP: Record<string, string> = {
  "Spring Fest Night Market": "#6366F1",
  "Founders Club Pitch Night": "#10B981",
  "AI in Campus Life Panel": "#F59E0B",
  "Intramural Sports Meet": "#14B8A6",
};

export function getEventColor(eventName: string): string {
  return EVENT_COLOR_MAP[eventName] ?? "#6366F1";
}

// ── Cross-component notification ─────────────────────────────

function notify(domain: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("unio-store-change", { detail: { domain } }));
}

// ── Phase 1: Announcements / Comments / Notifications (local) ─

export function loadAnnouncements(): UnioAnnouncement[] {
  return load<UnioAnnouncement[]>(KEYS.announcements, []);
}
export function saveAnnouncements(items: UnioAnnouncement[]): void {
  save(KEYS.announcements, items);
  notify("announcements");
}
export function addAnnouncementLocal(a: UnioAnnouncement): void {
  saveAnnouncements([a, ...loadAnnouncements()]);
}

export function loadAnnouncementReads(): string[] {
  return load<string[]>(KEYS.announcementReads, []);
}
export function markAnnouncementReadLocal(id: string): void {
  const reads = loadAnnouncementReads();
  if (!reads.includes(id)) {
    save(KEYS.announcementReads, [...reads, id]);
    notify("announcement_reads");
  }
}

export function loadComments(parentType: CommentParentType, parentId: string): UnioComment[] {
  return load<UnioComment[]>(KEYS.comments, []).filter(
    (c) => c.parentType === parentType && c.parentId === parentId
  );
}
export function saveAllComments(items: UnioComment[]): void {
  save(KEYS.comments, items);
  notify("comments");
}
export function addCommentLocal(c: UnioComment): void {
  saveAllComments([c, ...load<UnioComment[]>(KEYS.comments, [])]);
}

export function loadNotifications(): UnioNotification[] {
  return load<UnioNotification[]>(KEYS.notifications, []);
}
export function saveNotifications(items: UnioNotification[]): void {
  save(KEYS.notifications, items);
  notify("notifications");
}
export function markNotificationReadLocal(id: string): void {
  const items = loadNotifications();
  saveNotifications(items.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
}
export function markAllNotificationsReadLocal(): void {
  const now = new Date().toISOString();
  saveNotifications(loadNotifications().map((n) => (n.readAt ? n : { ...n, readAt: now })));
}

// ── Phase 2: feedback + certs (local mirror) ─────────────────
export function loadFeedback(eventId?: string): UnioFeedback[] {
  const all = load<UnioFeedback[]>(KEYS.feedback, []);
  return eventId ? all.filter((f) => f.eventId === eventId) : all;
}
export function saveFeedback(items: UnioFeedback[]): void {
  save(KEYS.feedback, items);
  notify("feedback");
}
export function addFeedbackLocal(f: UnioFeedback): void {
  saveFeedback([f, ...load<UnioFeedback[]>(KEYS.feedback, [])]);
}

export function loadCertificates(eventId?: string): UnioCertificate[] {
  const all = load<UnioCertificate[]>(KEYS.certificates, []);
  return eventId ? all.filter((c) => c.eventId === eventId) : all;
}
export function saveCertificates(items: UnioCertificate[]): void {
  save(KEYS.certificates, items);
  notify("certificates");
}

// ── Phase 3: budgets + sponsors + files (local mirror) ───────
export function loadBudgetEntries(eventId?: string): UnioBudgetEntry[] {
  const all = load<UnioBudgetEntry[]>(KEYS.budgets, []);
  return eventId ? all.filter((b) => b.eventId === eventId) : all;
}
export function saveBudgetEntries(items: UnioBudgetEntry[]): void {
  save(KEYS.budgets, items);
  notify("budgets");
}
export function addBudgetEntryLocal(b: UnioBudgetEntry): void {
  saveBudgetEntries([b, ...load<UnioBudgetEntry[]>(KEYS.budgets, [])]);
}
export function deleteBudgetEntryLocal(id: string): void {
  saveBudgetEntries(load<UnioBudgetEntry[]>(KEYS.budgets, []).filter((b) => b.id !== id));
}

export function loadSponsors(eventId?: string): UnioSponsor[] {
  const all = load<UnioSponsor[]>(KEYS.sponsors, []);
  return eventId ? all.filter((s) => s.eventId === eventId) : all;
}
export function saveSponsors(items: UnioSponsor[]): void {
  save(KEYS.sponsors, items);
  notify("sponsors");
}
export function addSponsorLocal(s: UnioSponsor): void {
  saveSponsors([s, ...load<UnioSponsor[]>(KEYS.sponsors, [])]);
}
export function updateSponsorLocal(id: string, updates: Partial<UnioSponsor>): void {
  saveSponsors(load<UnioSponsor[]>(KEYS.sponsors, []).map((s) => (s.id === id ? { ...s, ...updates } : s)));
}
export function deleteSponsorLocal(id: string): void {
  saveSponsors(load<UnioSponsor[]>(KEYS.sponsors, []).filter((s) => s.id !== id));
}

export function loadEventFiles(eventId?: string): UnioEventFile[] {
  const all = load<UnioEventFile[]>(KEYS.eventFiles, []);
  return eventId ? all.filter((f) => f.eventId === eventId) : all;
}
export function saveEventFiles(items: UnioEventFile[]): void {
  save(KEYS.eventFiles, items);
  notify("event_files");
}
export function addEventFileLocal(f: UnioEventFile): void {
  saveEventFiles([f, ...load<UnioEventFile[]>(KEYS.eventFiles, [])]);
}
export function deleteEventFileLocal(id: string): void {
  saveEventFiles(load<UnioEventFile[]>(KEYS.eventFiles, []).filter((f) => f.id !== id));
}

// ── Phase 4: templates + deps (local mirror) ─────────────────
export function loadTaskTemplates(): UnioTaskTemplate[] {
  return load<UnioTaskTemplate[]>(KEYS.taskTemplates, []);
}
export function saveTaskTemplates(items: UnioTaskTemplate[]): void {
  save(KEYS.taskTemplates, items);
  notify("task_templates");
}
export function addTaskTemplateLocal(t: UnioTaskTemplate): void {
  saveTaskTemplates([t, ...loadTaskTemplates()]);
}
export function deleteTaskTemplateLocal(id: string): void {
  saveTaskTemplates(loadTaskTemplates().filter((t) => t.id !== id));
}

export interface TaskDependencyEdge { taskId: string; dependsOnTaskId: string }

export function loadTaskDependencies(): TaskDependencyEdge[] {
  return load<TaskDependencyEdge[]>(KEYS.taskDependencies, []);
}
export function saveTaskDependencies(items: TaskDependencyEdge[]): void {
  save(KEYS.taskDependencies, items);
  notify("task_deps");
}
export function addTaskDependencyLocal(edge: TaskDependencyEdge): void {
  const all = loadTaskDependencies();
  if (!all.some((e) => e.taskId === edge.taskId && e.dependsOnTaskId === edge.dependsOnTaskId)) {
    saveTaskDependencies([edge, ...all]);
  }
}
export function removeTaskDependencyLocal(edge: TaskDependencyEdge): void {
  saveTaskDependencies(
    loadTaskDependencies().filter((e) => !(e.taskId === edge.taskId && e.dependsOnTaskId === edge.dependsOnTaskId))
  );
}

// ── Phase 5: approvals (local mirror) ────────────────────────
export function loadApprovals(): UnioApprovalRequest[] {
  return load<UnioApprovalRequest[]>(KEYS.approvals, []);
}
export function saveApprovals(items: UnioApprovalRequest[]): void {
  save(KEYS.approvals, items);
  notify("approvals");
}
export function addApprovalLocal(a: UnioApprovalRequest): void {
  saveApprovals([a, ...loadApprovals()]);
}
export function updateApprovalLocal(id: string, updates: Partial<UnioApprovalRequest>): void {
  saveApprovals(loadApprovals().map((a) => (a.id === id ? { ...a, ...updates } : a)));
}

// Format relative time for activity items
export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}
