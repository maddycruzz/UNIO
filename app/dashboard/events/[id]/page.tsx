"use client";

import type { CSSProperties } from "react";
import { useMemo, useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarRange, MapPin, Users, ArrowLeft, Gauge, ClipboardList,
  UserRound, Video, Trash2, Pencil, GripVertical, ChevronDown, X, Plus,
} from "lucide-react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getEventById, type UnioEvent } from "@/lib/store";

// ─── Types ────────────────────────────────────────────────────────

type EventStatus = "upcoming" | "ongoing" | "completed";
type TaskStatus  = "Todo" | "In Progress" | "Done";
type Priority    = "Low" | "Medium" | "High";
type Assignee    = { id: string; name: string; initials: string; color: string };

type Task = {
  id: string; title: string; assignees: Assignee[];
  deadline: string; priority: Priority; status: TaskStatus;
};

type DeadlineState = { isOpen: boolean; date: string };
type Division      = { id: string; name: string; color: string; tasks: Task[] };

// ─── Team ─────────────────────────────────────────────────────────

const TEAM: Assignee[] = [
  { id: "ak", name: "Ayaan",       initials: "AK", color: "#6366F1" },
  { id: "rs", name: "Riya Sharma", initials: "RS", color: "#10B981" },
  { id: "sp", name: "Sneha Patel", initials: "SP", color: "#EC4899" },
  { id: "am", name: "Arjun Mehta", initials: "AM", color: "#F59E0B" },
  { id: "dk", name: "Dev Kapoor",  initials: "DK", color: "#14B8A6" },
  { id: "jr", name: "Jasmine R",   initials: "JR", color: "#8B5CF6" },
];

const TABS = ["Overview", "Tasks", "Participants", "Meetings"] as const;

const DEFAULT_EVENT = {
  id: "unknown",
  name: "Event Not Found",
  type: "Other" as const,
  date: "—",
  venue: "—",
  participants: 0,
  capacity: 0,
  completion: 0,
  status: "upcoming" as EventStatus,
  description: "This event could not be found.",
  tasksDone: 0,
  tasksTotal: 0,
  daysRemaining: 0,
  assignees: [] as string[],
  createdAt: new Date().toISOString(),
};

// ─── Helpers ──────────────────────────────────────────────────────

function getTypeGradient(type: string) {
  const l = type.toLowerCase();
  if (l.includes("cultural"))   return "from-purple-500 via-fuchsia-500 to-pink-500";
  if (l.includes("tech"))       return "from-indigo-500 via-sky-500 to-blue-500";
  if (l.includes("sport"))      return "from-emerald-500 via-teal-400 to-cyan-400";
  if (l.includes("conference")) return "from-orange-500 via-amber-400 to-yellow-400";
  if (l.includes("workshop"))   return "from-rose-500 via-red-500 to-pink-500";
  return "from-slate-600 via-slate-500 to-slate-400";
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getDeadlineDisplay(deadline: string) {
  if (!deadline) return { text: "Set deadline", color: "text-slate-400", hasWarning: false };
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(deadline); d.setHours(0,0,0,0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
  const label = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  if (diff < 0)   return { text: `Overdue (${Math.abs(diff)}d)`, color: "text-red-400 font-semibold",  hasWarning: true };
  if (diff === 0) return { text: "Due Today",                    color: "text-amber-400 font-semibold", hasWarning: true };
  if (diff <= 3)  return { text: `Due in ${diff} days`,         color: "text-amber-300",               hasWarning: true };
  return           { text: label,                               color: "text-slate-300",               hasWarning: false };
}

function divisionPreset(type: string): Division[] {
  const l = type.toLowerCase();
  if (l.includes("tech")) {
    return [
      { id: "marketing", name: "Marketing", color: "text-indigo-400", tasks: [
        { id: "m1", title: "Publish event page on UNIO",           assignees: [], deadline: "", priority: "High",   status: "In Progress" },
        { id: "m2", title: "Share social assets with design club", assignees: [], deadline: "", priority: "Medium", status: "Todo" },
      ]},
      { id: "logistics", name: "Logistics", color: "text-emerald-400", tasks: [
        { id: "l1", title: "Confirm AV setup with auditorium",     assignees: [], deadline: "", priority: "High",   status: "In Progress" },
        { id: "l2", title: "Reserve breakout rooms for 1:1s",      assignees: [], deadline: "", priority: "Medium", status: "Todo" },
      ]},
      { id: "technical", name: "Technical", color: "text-sky-400", tasks: [
        { id: "t1", title: "Set up recording + stream",            assignees: [], deadline: "", priority: "High",   status: "Todo" },
      ]},
    ];
  }
  return [
    { id: "marketing", name: "Marketing", color: "text-indigo-400", tasks: [
      { id: "gm1", title: "Announce event to student mailing list", assignees: [], deadline: "", priority: "Medium", status: "Todo" },
    ]},
  ];
}

// ─── AssigneePicker ───────────────────────────────────────────────
// Uses fixed positioning (getBoundingClientRect) so dropdown never
// clips or overlaps. Remove button is always visible on each chip.

function AssigneePicker({ assignees, onChange }: {
  assignees: Assignee[];
  onChange: (next: Assignee[]) => void;
}) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");
  const btnRef                = useRef<HTMLButtonElement>(null);
  const dropRef               = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !dropRef.current?.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openDropdown = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 6, left: r.left });
    }
    setOpen(v => !v);
  };

  const assignedIds = new Set(assignees.map(a => a.id));
  const suggestions = TEAM.filter(s =>
    !assignedIds.has(s.id) &&
    (query === "" || s.name.toLowerCase().includes(query.toLowerCase()))
  );
  const canCustom = query.trim().length > 1 &&
    !TEAM.find(s => s.name.toLowerCase() === query.trim().toLowerCase());

  const add = (a: Assignee) => { onChange([...assignees, a]); setQuery(""); };
  const remove = (id: string) => onChange(assignees.filter(a => a.id !== id));

  const addCustom = () => {
    const name = query.trim();
    const COLORS = ["#6366F1","#10B981","#F59E0B","#EC4899","#14B8A6","#8B5CF6","#F97316"];
    add({ id: `c-${Date.now()}`, name, initials: name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2), color: COLORS[name.length % COLORS.length] });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">

      {/* Assignee chips — avatar + name + always-visible × */}
      {assignees.map(a => (
        <div key={a.id} className="flex items-center gap-1.5 rounded-full py-0.5 pl-1 pr-1.5"
          style={{ background: `${a.color}20`, border: `1px solid ${a.color}45` }}>
          <div className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full text-[9px] font-bold text-white"
            style={{ background: `linear-gradient(135deg,${a.color}dd,${a.color}66)` }}>
            {a.initials}
          </div>
          <span className="text-[11px] font-medium" style={{ color: a.color }}>{a.name}</span>
          <button type="button" onClick={() => remove(a.id)}
            className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70"
            style={{ background: `${a.color}35`, color: a.color }}
            aria-label={`Remove ${a.name}`}>
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      ))}

      {/* Trigger button */}
      <button ref={btnRef} type="button" onClick={openDropdown}
        className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 ring-1 ring-white/15 hover:bg-white/10 transition-colors">
        <Plus className="h-2.5 w-2.5" />
        {assignees.length === 0 ? "Assign" : "Add"}
      </button>

      {/* Dropdown — fixed positioning, never overlaps */}
      <AnimatePresence>
        {open && (
          <motion.div ref={dropRef}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            style={{ position: "fixed", top: dropPos.top, left: dropPos.left, zIndex: 9999 }}
            className="w-56 overflow-hidden rounded-xl border border-white/20 bg-[#1e2130] shadow-[0_24px_60px_rgba(0,0,0,0.9)]"
            onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
            <div className="border-b border-white/10 p-2">
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search team…"
                className="w-full rounded-lg bg-white/10 px-2.5 py-1.5 text-xs text-white outline-none ring-1 ring-white/15 placeholder:text-slate-500" />
            </div>
            <div className="max-h-48 overflow-y-auto p-1.5 space-y-0.5">
              {suggestions.map(s => (
                <button key={s.id} type="button" onClick={() => add(s)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-slate-100 transition-colors hover:bg-white/10">
                  <div className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-[9px] font-bold text-white"
                    style={{ background: `linear-gradient(135deg,${s.color}dd,${s.color}66)` }}>
                    {s.initials}
                  </div>
                  <span className="font-medium">{s.name}</span>
                </button>
              ))}
              {canCustom && (
                <button type="button" onClick={addCustom}
                  className="flex w-full items-center gap-2.5 rounded-lg border-t border-white/10 px-2.5 py-2 text-xs text-slate-400 transition-colors hover:bg-white/10 mt-1 pt-2">
                  <div className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-white/10 text-[11px]">+</div>
                  <span>Add &ldquo;{query.trim()}&rdquo;</span>
                </button>
              )}
              {suggestions.length === 0 && !canCustom && (
                <p className="px-3 py-3 text-center text-[11px] text-slate-500">No results</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sortable Task ────────────────────────────────────────────────

type SortableTaskProps = {
  divisionId: string; task: Task; onChange: (t: Task) => void;
  onRequestDelete: () => void; confirmDeleteOpen: boolean;
  onConfirmDelete: () => void; onCancelDelete: () => void;
  priorityMenuOpen: boolean; onTogglePriorityMenu: () => void;
  deadlineStates: Record<string, DeadlineState>;
  onToggleDeadlinePicker: (k: string) => void;
  onUpdateDeadline: (k: string, date: string) => void;
};

function SortableTask({
  divisionId, task, onChange, onRequestDelete, confirmDeleteOpen,
  onConfirmDelete, onCancelDelete, priorityMenuOpen, onTogglePriorityMenu,
  deadlineStates, onToggleDeadlinePicker, onUpdateDeadline,
}: SortableTaskProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `${divisionId}:${task.id}` });

  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 30 : undefined };

  const pc =
    task.priority === "High"
      ? { dot: "bg-red-400",    badge: "bg-red-500 text-white border-red-400/50",    edge: "border-l-red-400/70 shadow-[inset_3px_0_18px_rgba(248,113,113,0.22)]" }
    : task.priority === "Medium"
      ? { dot: "bg-amber-300",  badge: "bg-amber-500 text-black border-amber-400/50", edge: "border-l-amber-300/70 shadow-[inset_3px_0_18px_rgba(251,191,36,0.18)]" }
      : { dot: "bg-emerald-300",badge: "bg-emerald-500 text-white border-emerald-400/50", edge: "border-l-emerald-300/70 shadow-[inset_3px_0_18px_rgba(52,211,153,0.16)]" };

  const isDone  = task.status === "Done";
  const taskKey = `${divisionId}:${task.id}`;
  const dl      = getDeadlineDisplay(task.deadline);

  return (
    <motion.li ref={setNodeRef} style={style} layout exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.18 }}
      className={`group relative flex items-start gap-3 rounded-xl border-l-4 bg-navy/80 px-4 py-3 ring-1 ring-white/10 transition-colors ${pc.edge} ${isDone ? "opacity-70" : ""}`}>

      {/* Checkbox */}
      <button type="button" onClick={() => onChange({ ...task, status: isDone ? "Todo" : "Done" })}
        className={`mt-1 grid h-5 w-5 flex-shrink-0 place-items-center rounded border text-xs transition ${isDone ? "border-emerald-500 bg-emerald-500 text-black" : "border-slate-500/80 bg-black/30 text-transparent hover:border-emerald-500/80"}`}>
        ✓
      </button>

      {/* Drag handle */}
      <button type="button" {...attributes} {...listeners}
        className="mt-0.5 inline-flex items-center justify-center rounded-md p-1 text-slate-400 opacity-0 transition group-hover:opacity-100">
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2.5 text-sm">

        {/* Title + priority */}
        <div className="flex items-center justify-between gap-2">
          <input value={task.title} onChange={e => onChange({ ...task, title: e.target.value })}
            className={`w-full border-none bg-transparent text-base font-medium text-slate-100 outline-none ${isDone ? "line-through text-slate-400" : ""}`} />

          {/* Priority badge */}
          <div className="relative flex-shrink-0">
            <button type="button" onClick={e => { e.stopPropagation(); onTogglePriorityMenu(); }}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg transition-all hover:scale-105 ${pc.badge}`}>
              <span className={`h-2 w-2 rounded-full ${pc.dot}`} />
              {task.priority}
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </button>

            {/* Priority dropdown — solid bg, high z-index */}
            <AnimatePresence>
              {priorityMenuOpen && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                  className="absolute right-0 top-9 z-50 w-36 overflow-hidden rounded-xl border border-white/20 bg-[#1e2130] p-1.5 text-xs shadow-[0_16px_40px_rgba(0,0,0,0.9)]"
                  onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
                  {(["High", "Medium", "Low"] as const).map(p => {
                    const sel = task.priority === p;
                    const activeCls =
                      p === "High"   ? "bg-red-500 text-white" :
                      p === "Medium" ? "bg-amber-500 text-black" :
                                       "bg-emerald-500 text-white";
                    const dotCls =
                      p === "High"   ? "bg-red-400" :
                      p === "Medium" ? "bg-amber-300" : "bg-emerald-300";
                    return (
                      <button key={p} type="button"
                        onClick={() => { onChange({ ...task, priority: p }); onTogglePriorityMenu(); }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 font-medium transition-colors ${sel ? activeCls : "text-slate-100 hover:bg-white/10"}`}>
                        <span className="inline-flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${dotCls}`} />{p}
                        </span>
                        {sel && <span>✓</span>}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Assignees + deadline */}
        <div className="flex flex-wrap items-center gap-3">
          <AssigneePicker assignees={task.assignees} onChange={next => onChange({ ...task, assignees: next })} />

          <div className="relative">
            <button type="button" onClick={() => onToggleDeadlinePicker(taskKey)}
              className={`rounded-full bg-black/40 px-3 py-1.5 text-sm ring-1 ring-white/15 transition-colors hover:bg-black/60 ${dl.color}`}>
              {dl.hasWarning && <span className="mr-1 inline-flex h-2 w-2 animate-pulse rounded-full bg-current" />}
              {dl.text}
            </button>
            <AnimatePresence>
              {deadlineStates[taskKey]?.isOpen && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                  className="absolute left-0 top-10 z-20 rounded-xl border border-white/15 bg-[#1e2130] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.9)]"
                  onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
                  <div className="mb-2 text-xs font-medium text-slate-200">Set deadline</div>
                  <input type="date" defaultValue={task.deadline}
                    onChange={e => onUpdateDeadline(taskKey, e.target.value)}
                    className="w-full rounded-lg bg-black/40 px-2 py-1.5 text-xs text-slate-100 outline-none ring-1 ring-white/15 [color-scheme:dark]" />
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" onClick={() => onToggleDeadlinePicker(taskKey)}
                      className="rounded-full bg-white/5 px-2 py-1 text-xs text-slate-200 hover:bg-white/10">Cancel</button>
                    <button type="button" onClick={() => onToggleDeadlinePicker(taskKey)}
                      className="rounded-full bg-indigo-500 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-600">Save</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Hover controls */}
      <div className="mt-1 flex flex-shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-slate-200 ring-1 ring-white/20 hover:bg-black/60">
          <Pencil className="h-4 w-4" />
        </button>
        <button type="button" onClick={e => { e.stopPropagation(); onRequestDelete(); }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-slate-200 ring-1 ring-white/20 hover:bg-black/60">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Delete confirm */}
      <AnimatePresence>
        {confirmDeleteOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onCancelDelete} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-[#050711] p-6 text-sm text-slate-100 shadow-[0_28px_80px_rgba(15,17,23,0.98)]"
              onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20"><Trash2 className="h-5 w-5 text-red-400" /></div>
                <div>
                  <div className="text-base font-semibold text-white">Delete this task?</div>
                  <div className="mt-1 text-slate-300">This action cannot be undone.</div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={onCancelDelete} className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-white/10">Cancel</button>
                <button type="button" onClick={onConfirmDelete} className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600">Delete</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export default function EventDetailPage() {
  const params = useParams();
  const eventId = typeof params?.id === "string" ? params.id : "";
  const storedEvent = useMemo(() => getEventById(eventId), [eventId]);
  const event = useMemo(() => {
    if (!storedEvent) return DEFAULT_EVENT;
    return {
      ...storedEvent,
      type: storedEvent.type || "Other",
    };
  }, [storedEvent]);

  const [activeTab, setActiveTab]   = useState<(typeof TABS)[number]>("Overview");
  const [divisions, setDivisions]   = useState<Division[]>(() => divisionPreset(event.type));
  const [collapsed, setCollapsed]   = useState<string[]>([]);
  const [aiOpen, setAiOpen]         = useState(false);
  const [priorityFilter, setPF]     = useState<"All" | Priority>("All");
  const [sortByPriority, setSBP]    = useState(false);
  const [confirmTaskKey, setCTK]    = useState<string | null>(null);
  const [confirmDivisionId, setCDI] = useState<string | null>(null);
  const [priorityMenuKey, setPMK]   = useState<string | null>(null);
  const [deadlineStates, setDLS]    = useState<Record<string, DeadlineState>>({});

  const sensors   = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const totalTasks  = divisions.reduce((a, d) => a + d.tasks.length, 0);
  const doneTasks   = divisions.reduce((a, d) => a + d.tasks.filter(t => t.status === "Done").length, 0);
  const overallProg = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : event.completion;
  const completionColor = overallProg >= 90 ? "from-emerald-500 to-emerald-400" : overallProg >= 60 ? "from-indigo-500 to-emerald-500" : "from-slate-400 to-indigo-500";
  const priorityRank: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };

  const toggleDL = (k: string) => setDLS(p => ({ ...p, [k]: { isOpen: !p[k]?.isOpen, date: p[k]?.date || "" } }));
  const updateDL = (k: string, date: string) => {
    const [dId, tId] = k.split(":");
    setDivisions(p => p.map(d => d.id !== dId ? d : { ...d, tasks: d.tasks.map(t => t.id !== tId ? t : { ...t, deadline: date }) }));
    setDLS(p => ({ ...p, [k]: { date, isOpen: false } }));
  };

  const handleDragEnd = (divisionId: string, e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setDivisions(prev => prev.map(div => {
      if (div.id !== divisionId) return div;
      const ids = div.tasks.map(t => `${divisionId}:${t.id}`);
      const oi  = ids.indexOf(active.id as string);
      const ni  = ids.indexOf(over.id as string);
      return oi === -1 || ni === -1 ? div : { ...div, tasks: arrayMove(div.tasks, oi, ni) };
    }));
  };

  const recommendations: Task[] = [
    { id: "ai-1", title: "Draft post-event feedback form",      assignees: [], deadline: "", priority: "Medium", status: "Todo" },
    { id: "ai-2", title: "Confirm on-ground emergency contact", assignees: [], deadline: "", priority: "High",   status: "Todo" },
  ];

  return (
    <div className="space-y-5 text-slate-100">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/dashboard/events" className="inline-flex h-7 items-center rounded-full bg-white/5 px-2 pr-3 text-[11px] text-slate-200 ring-1 ring-white/15 hover:bg-white/10">
          <ArrowLeft className="mr-1 h-3 w-3" />Back to events
        </Link>
        <span className="hidden sm:inline">/</span>
        <span className="hidden truncate text-[11px] sm:inline">{event.name}</span>
      </div>

      {/* Hero */}
      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.25, 0.8, 0.3, 1] }}
        className="relative overflow-hidden rounded-3xl border border-white/12 bg-black/50 shadow-[0_24px_70px_rgba(15,17,23,0.95)]">
        <div className={`relative h-40 w-full overflow-hidden bg-gradient-to-br ${getTypeGradient(event.type)}`}>
          <motion.div className="absolute inset-0" initial={{ scale: 1 }} animate={{ scale: 1.05 }}
            transition={{ duration: 20, repeat: Infinity, repeatType: "reverse" }}
            style={{ backgroundImage: "radial-gradient(circle at 0% 0%, rgba(15,23,42,0.4), transparent 55%), radial-gradient(circle at 100% 100%, rgba(15,23,42,0.7), transparent 55%)" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/60 to-black/70" />
          <div className="relative flex h-full flex-col justify-end px-5 pb-4 pt-6 sm:px-6 sm:pb-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] text-slate-100 ring-1 ring-white/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{event.type}
            </div>
            <h1 className="mt-2 text-lg font-semibold tracking-tight text-white sm:text-xl">{event.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-100">
              <span className="inline-flex items-center gap-1.5"><CalendarRange className="h-3.5 w-3.5 text-indigo-200" />{event.date}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{event.venue}</span>
              <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-emerald-200" />{event.participants.toLocaleString()} expected</span>
            </div>
          </div>
        </div>
        <div className="relative border-t border-white/10 bg-black/70 px-5 pb-3 pt-3 sm:px-6">
          <div className="flex items-center gap-3 text-[11px] text-slate-300">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 uppercase tracking-[0.18em] text-slate-100">
              <Gauge className="h-3 w-3" />Overall progress
            </span>
            <div className="hidden h-1.5 w-40 rounded-full bg-white/10 sm:block">
              <div className={`h-full rounded-full bg-gradient-to-r ${completionColor}`} style={{ width: `${overallProg}%` }} />
            </div>
            <span>{overallProg}% ready</span>
          </div>
        </div>
      </motion.section>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2 text-xs">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map(tab => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
              className={`inline-flex items-center rounded-full px-4 py-2 font-medium transition-all hover:scale-105 ${activeTab === tab ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-400/50" : "text-slate-400 hover:text-white hover:bg-white/10"}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab panels */}
      <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-4">

        {/* Overview */}
        {activeTab === "Overview" && (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)]">
            <section className="rounded-2xl border border-white/12 bg-black/45 p-4 text-xs text-slate-200 shadow-[0_18px_50px_rgba(15,17,23,0.95)] sm:p-5">
              <h2 className="text-sm font-semibold text-white">Event overview</h2>
              <p className="mt-2 leading-relaxed text-slate-200/90">{event.description}</p>
            </section>
            <section className="space-y-3 rounded-2xl border border-white/12 bg-black/45 p-4 text-xs text-slate-200 shadow-[0_18px_50px_rgba(15,17,23,0.95)] sm:p-5">
              <h3 className="text-sm font-semibold text-white">At a glance</h3>
              <div className="mt-2 space-y-2">
                {[
                  { icon: <ClipboardList className="h-4 w-4 text-indigo-400" />, label: "Tasks ready",        value: `${doneTasks}/${totalTasks}` },
                  { icon: <Users        className="h-4 w-4 text-emerald-400" />, label: "RSVPs confirmed",    value: "144 / 200" },
                  { icon: <Video        className="h-4 w-4 text-indigo-400" />,  label: "Meetings scheduled", value: "3" },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="flex items-center justify-between rounded-xl bg-navy/80 px-3 py-2 ring-1 ring-white/10">
                    <span className="flex items-center gap-2 text-slate-200">{icon}{label}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Tasks */}
        {activeTab === "Tasks" && (
          <section className="space-y-3 rounded-2xl border border-white/12 bg-black/45 p-4 text-xs text-slate-200 shadow-[0_18px_50px_rgba(15,17,23,0.95)] sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Tasks</h3>
                <p className="mt-1 text-slate-400">Organize preparation across divisions and keep everyone on track.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">

                {/* Priority filter — each active state has its own explicit colour */}
                <div className="flex items-center gap-1 rounded-full bg-white/5 p-1 ring-1 ring-white/10">
                  {(["All", "High", "Medium", "Low"] as const).map(p => {
                    const active = priorityFilter === p;
                    const activeCls =
                      p === "All"    ? "bg-white text-[#0F1117] font-bold" :
                      p === "High"   ? "bg-red-500 text-white font-bold shadow-red-500/40" :
                      p === "Medium" ? "bg-amber-500 text-black font-bold shadow-amber-500/40" :
                                       "bg-emerald-500 text-white font-bold shadow-emerald-500/40";
                    return (
                      <button key={p} type="button" onClick={() => setPF(p)}
                        className={`rounded-full px-3 py-1 text-[11px] transition-all ${active ? `shadow-lg ${activeCls}` : "text-slate-300 hover:bg-white/10"}`}>
                        {p}
                      </button>
                    );
                  })}
                </div>

                <button type="button" onClick={() => setSBP(v => !v)}
                  className="rounded-full bg-white/5 px-3 py-1.5 text-[11px] text-slate-100 ring-1 ring-white/15 hover:bg-white/10">
                  Sort: {sortByPriority ? "Priority" : "Default"}
                </button>
                <button type="button" onClick={() => setAiOpen(true)}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_12px_32px_rgba(79,70,229,0.8)] ring-1 ring-indigo-400/60 hover:bg-indigo-600">
                  ✨ AI recommendations
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="rounded-2xl bg-navy/80 p-3 ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-300">Overall checklist progress</span>
                <span className="text-[11px] text-slate-100">{doneTasks}/{totalTasks} tasks · {overallProg}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-black/30">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-400 to-emerald-500" style={{ width: `${overallProg}%` }} />
              </div>
            </div>

            {/* Divisions */}
            <div className="space-y-3">
              {divisions.map(division => {
                const filtered = division.tasks
                  .filter(t => priorityFilter === "All" || t.priority === priorityFilter)
                  .toSorted((a, b) => sortByPriority ? priorityRank[a.priority] - priorityRank[b.priority] : 0);
                const total    = division.tasks.length;
                const done     = division.tasks.filter(t => t.status === "Done").length;
                const progress = total ? Math.round((done / total) * 100) : 0;
                const isCol    = collapsed.includes(division.id);

                return (
                  <DndContext key={division.id} sensors={sensors} onDragEnd={e => handleDragEnd(division.id, e)}>
                    <div className="rounded-2xl bg-black/40 p-3 ring-1 ring-white/10">
                      <div className="group flex w-full items-center justify-between gap-2">
                        <button type="button"
                          onClick={() => setCollapsed(p => p.includes(division.id) ? p.filter(id => id !== division.id) : [...p, division.id])}
                          className="flex flex-1 items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <input
                              value={division.name}
                              onChange={e => setDivisions(p => p.map(d => d.id !== division.id ? d : { ...d, name: e.target.value }))}
                              onClick={e => e.stopPropagation()}
                              className={`bg-transparent text-[11px] font-semibold uppercase tracking-[0.18em] outline-none border-none w-32 ${division.color}`}/>
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">{done}/{total} done</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="hidden h-1.5 w-24 rounded-full bg-white/10 sm:block">
                              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-[11px] text-slate-300">{progress}%</span>
                          </div>
                        </button>
                        <button type="button" onClick={() => setCDI(division.id)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-slate-200 ring-1 ring-white/20 opacity-0 group-hover:opacity-100 hover:bg-black/60 transition">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <AnimatePresence>
                        {confirmDivisionId === division.id && (
                          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                            className="mt-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-[11px] text-slate-100">
                            <div className="font-semibold text-white">Delete division?</div>
                            <div className="mt-1 text-slate-200/90">This will delete the division and all tasks inside it.</div>
                            <div className="mt-3 flex justify-end gap-2">
                              <button type="button" onClick={() => setCDI(null)} className="rounded-full bg-white/5 px-3 py-1.5 text-slate-100 hover:bg-white/10">Cancel</button>
                              <button type="button" onClick={() => { setDivisions(p => p.filter(d => d.id !== division.id)); setCDI(null); }}
                                className="rounded-full bg-red-500/90 px-3 py-1.5 font-semibold text-white ring-1 ring-red-300/40 hover:brightness-110">Delete</button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <AnimatePresence initial={false}>
                        {!isCol && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                            className="mt-3 space-y-2 overflow-visible">
                            <SortableContext items={filtered.map(t => `${division.id}:${t.id}`)} strategy={verticalListSortingStrategy}>
                              <ul className="space-y-2">
                                <AnimatePresence initial={false}>
                                  {filtered.map(task => {
                                    const tk = `${division.id}:${task.id}`;
                                    return (
                                      <SortableTask key={task.id} divisionId={division.id} task={task}
                                        onChange={u => setDivisions(p => p.map(d => d.id !== division.id ? d : { ...d, tasks: d.tasks.map(t => t.id !== task.id ? t : u) }))}
                                        onRequestDelete={() => setCTK(tk)}
                                        confirmDeleteOpen={confirmTaskKey === tk}
                                        onCancelDelete={() => setCTK(null)}
                                        onConfirmDelete={() => { setDivisions(p => p.map(d => d.id !== division.id ? d : { ...d, tasks: d.tasks.filter(t => t.id !== task.id) })); setCTK(null); }}
                                        priorityMenuOpen={priorityMenuKey === tk}
                                        onTogglePriorityMenu={() => setPMK(p => p === tk ? null : tk)}
                                        deadlineStates={deadlineStates}
                                        onToggleDeadlinePicker={toggleDL}
                                        onUpdateDeadline={updateDL}
                                      />
                                    );
                                  })}
                                </AnimatePresence>
                              </ul>
                            </SortableContext>
                            <button type="button"
                              onClick={() => setDivisions(p => p.map(d => d.id !== division.id ? d : { ...d, tasks: [...d.tasks, { id: `new-${Date.now()}`, title: "New task", assignees: [], deadline: "", priority: "Medium", status: "Todo" }] }))}
                              className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-[11px] text-slate-100 ring-1 ring-white/15 hover:bg-white/10">
                              + Add task
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </DndContext>
                );
              })}
            </div>

            <button type="button"
              onClick={() => setDivisions(p => [...p, { id: `div-${Date.now()}`, name: "New division", color: "text-slate-200", tasks: [] }])}
              className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-[11px] text-slate-100 ring-1 ring-white/15 hover:bg-white/10">
              + Add division
            </button>

            {/* AI modal */}
            <AnimatePresence>
              {aiOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 grid place-items-center bg-black/60 backdrop-blur-sm">
                  <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.96 }}
                    className="w-full max-w-md rounded-2xl border border-white/15 bg-[#050711] p-4 text-xs text-slate-100 shadow-[0_28px_80px_rgba(15,17,23,0.98)] sm:p-5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-200">AI recommendations</div>
                        <p className="mt-1 text-[11px] text-slate-300">Suggested tasks for {event.name}.</p>
                      </div>
                      <button type="button" onClick={() => setAiOpen(false)} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-slate-200 hover:bg-white/10">×</button>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {recommendations.map(t => (
                        <li key={t.id} className="flex items-center gap-2 rounded-xl bg-navy/80 px-3 py-2 ring-1 ring-white/10">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /><span>{t.title}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex justify-end gap-2 text-[11px]">
                      <button type="button" onClick={() => setAiOpen(false)} className="rounded-full bg-white/5 px-3 py-1.5 text-slate-100 hover:bg-white/10">Cancel</button>
                      <button type="button"
                        onClick={() => {
                          setDivisions(p => {
                            if (!p.length) return [{ id: "ai-div", name: "AI suggestions", color: "text-indigo-400", tasks: recommendations }];
                            const [first, ...rest] = p;
                            return [{ ...first, tasks: [...first.tasks, ...recommendations] }, ...rest];
                          });
                          setAiOpen(false);
                        }}
                        className="rounded-full bg-indigo-500 px-4 py-1.5 font-semibold text-white shadow-[0_16px_40px_rgba(79,70,229,0.85)] ring-1 ring-indigo-400/70 hover:bg-indigo-600">
                        Add tasks
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}

        {/* Participants */}
        {activeTab === "Participants" && (
          <section className="rounded-2xl border border-white/12 bg-black/45 p-4 text-xs text-slate-200 shadow-[0_18px_50px_rgba(15,17,23,0.95)] sm:p-5">
            <h3 className="text-sm font-semibold text-white">Participants</h3>
            <p className="mt-1 text-slate-400">Wire to your participants data to see real attendees and check-in stats.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {["Design Club", "Tech Society", "Entrepreneurship Cell"].map(g => (
                <div key={g} className="flex items-center gap-2 rounded-xl bg-navy/80 px-3 py-2 ring-1 ring-white/10">
                  <UserRound className="h-4 w-4 text-indigo-400" />
                  <div className="flex-1"><div>{g}</div><div className="text-[11px] text-slate-400">40–60 attendees expected</div></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Meetings */}
        {activeTab === "Meetings" && (
          <section className="rounded-2xl border border-white/12 bg-black/45 p-4 text-xs text-slate-200 shadow-[0_18px_50px_rgba(15,17,23,0.95)] sm:p-5">
            <h3 className="text-sm font-semibold text-white">Meetings</h3>
            <p className="mt-1 text-slate-400">Keep organizers, faculty, and partners aligned with structured touchpoints.</p>
            <ul className="mt-3 space-y-2">
              {["Core planning sync · Today · 5:00 PM", "Volunteer briefing · Tomorrow · 4:00 PM", "Post-event retro · Next Mon · 6:00 PM"].map(m => (
                <li key={m} className="flex items-center gap-2 rounded-xl bg-navy/80 px-3 py-2 ring-1 ring-white/10">
                  <Video className="h-4 w-4 text-indigo-400" /><span>{m}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

      </motion.div>
    </div>
  );
}