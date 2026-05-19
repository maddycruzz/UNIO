"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarRange, MapPin, Users, MoreHorizontal,
  CheckCircle2, Clock3, BadgeCheck, Plus,
} from "lucide-react";
import {
  type UnioEvent,
  type EventStatus,
  type EventType,
} from "@/lib/store";
import { loadEvents as dbLoadEvents, deleteEvent as dbDeleteEvent } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { PermissionGate } from "@/lib/permissions";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";



const FILTERS = ["All", "Upcoming", "Ongoing", "Completed"] as const;

function statusConfig(status: EventStatus) {
  if (status === "upcoming") return { label: "Upcoming", color: "bg-indigo-500 text-white border-indigo-400/50 shadow-lg shadow-indigo-500/25", icon: Clock3 };
  if (status === "ongoing")  return { label: "Ongoing",  color: "bg-amber-500 text-navy border-amber-400/50 shadow-lg shadow-amber-500/25",   icon: BadgeCheck };
  return { label: "Completed", color: "bg-emerald-500 text-white border-emerald-400/50 shadow-lg shadow-emerald-500/25", icon: CheckCircle2 };
}

function typeGradient(type: EventType) {
  const map: Record<EventType, string> = {
    Cultural:   "from-purple-500 via-fuchsia-500 to-pink-500",
    Tech:       "from-indigo-500 via-sky-500 to-blue-500",
    Sports:     "from-emerald-500 via-teal-400 to-cyan-400",
    Conference: "from-orange-500 via-amber-400 to-yellow-400",
    Workshop:   "from-rose-500 via-red-500 to-pink-500",
    Other:      "from-slate-600 via-slate-500 to-slate-400",
  };
  return map[type];
}

export default function EventsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [events, setEvents] = useState<UnioEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>("All");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchEvents = async () => {
      const data = await dbLoadEvents();
      if (cancelled) return;
      setEvents(data);
      setLoading(false);
    };
    fetchEvents();
    const handler = () => fetchEvents();
    window.addEventListener("unio-store-change", handler);
    return () => { cancelled = true; window.removeEventListener("unio-store-change", handler); };
  }, []);

  const handleDelete = async (id: string) => {
    const target = events.find((e) => e.id === id);
    setOpenMenu(null);
    const ok = await confirm({
      title: "Delete event?",
      message: target?.name
        ? `"${target.name}" will be moved to Trash. You can restore it from there.`
        : "This event will be moved to Trash. You can restore it from there.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    const prev = events;
    setEvents((p) => p.filter((e) => e.id !== id));
    try {
      await dbDeleteEvent(id);
      toast.success("Event moved to trash.");
    } catch (e) {
      setEvents(prev);
      toast.error(e instanceof Error ? e.message : "Couldn't delete event.");
    }
  };

  // No stagger animation on filter change — just instant opacity swap
  const filteredEvents = useMemo(() => {
    if (activeFilter === "All") return events;
    return events.filter((e) => e.status === activeFilter.toLowerCase() as EventStatus);
  }, [activeFilter, events]);

  return (
    // FIX 1: removed p-6, using full width with proper layout
    <div className="space-y-4 text-slate-100">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">Events</h1>
          <p className="mt-1 text-xs text-slate-400 sm:text-sm">Plan, track, and analyze every event happening on campus.</p>
        </div>
        <PermissionGate action="events.create">
          <Link href="/dashboard/events/new"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/40 ring-1 ring-indigo-400/60 hover:brightness-110 sm:text-sm">
            <CalendarRange className="h-4 w-4" /> Create new event
          </Link>
        </PermissionGate>
      </div>

      {/* FIX 1: Filter bar uses space better — filters left, count right, no wasted height */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => {
            const active = activeFilter === filter;
            const styles =
              filter === "All"      ? { a: "bg-slate-600 text-white",                         i: "bg-slate-500/20 text-slate-200 hover:bg-slate-500/30" } :
              filter === "Upcoming" ? { a: "bg-indigo-500 text-white shadow-indigo-500/30",    i: "bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25" } :
              filter === "Ongoing"  ? { a: "bg-amber-500 text-navy shadow-amber-500/30",       i: "bg-amber-500/15 text-amber-200 hover:bg-amber-500/25" } :
                                      { a: "bg-emerald-500 text-white shadow-emerald-500/30",  i: "bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25" };
            return (
              <button key={filter} type="button" onClick={() => setActiveFilter(filter)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${active ? styles.a + " shadow-md" : styles.i}`}>
                {filter}
              </button>
            );
          })}
        </div>
        <span className="shrink-0 text-[11px] text-slate-400">
          {filteredEvents.length} {filteredEvents.length === 1 ? "event" : "events"}
        </span>
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-900/60 p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="h-3.5 w-32 rounded bg-white/10" />
                  <div className="h-4 w-20 rounded-full bg-white/10" />
                </div>
                <div className="h-6 w-20 rounded-full bg-white/10" />
              </div>
              <div className="mt-6 space-y-2">
                <div className="h-2.5 w-28 rounded bg-white/10" />
                <div className="h-2.5 w-40 rounded bg-white/10" />
                <div className="h-2.5 w-24 rounded bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="mt-6 flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-600/50 bg-black/40 px-6 py-16 text-center">
          <div className="relative mb-4 h-20 w-20">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.8),transparent_60%)] blur-lg" />
            <div className="relative grid h-full w-full place-items-center rounded-full border border-white/20 bg-black/40">
              <CalendarRange className="h-8 w-8 text-indigo-400" />
            </div>
          </div>
          <h2 className="text-base font-semibold text-white">No {activeFilter !== "All" ? activeFilter.toLowerCase() : ""} events</h2>
          <p className="mt-2 max-w-md text-xs text-slate-400">
            {activeFilter === "All" ? "Start by creating your first campus event." : `No ${activeFilter.toLowerCase()} events right now.`}
          </p>
          {activeFilter === "All" && (
            <PermissionGate action="events.create">
              <Link href="/dashboard/events/new"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/40 ring-1 ring-indigo-400/60 hover:brightness-110">
                <Plus className="h-3.5 w-3.5" /> Create an event
              </Link>
            </PermissionGate>
          )}
        </motion.div>
      ) : (
        // FIX 6: no stagger, instant render — AnimatePresence only on individual card exits
        <div className="grid gap-4 md:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {filteredEvents.map((event) => {
              const status = statusConfig(event.status);
              const StatusIcon = status.icon;
              const dimmed = hoveredId !== null && hoveredId !== event.id;

              return (
                <motion.div key={event.id}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: dimmed ? 0.55 : 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  onMouseEnter={() => setHoveredId(event.id)}
                  onMouseLeave={() => { setHoveredId(null); setOpenMenu(null); }}
                  onClick={() => { if (openMenu !== event.id) router.push(`/dashboard/events/${event.id}`); }}
                  whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
                  className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/10 shadow-[0_20px_55px_rgba(15,17,23,0.95)]"
                >
                  {/* BG gradient */}
                  <motion.div className={`absolute inset-0 bg-gradient-to-br ${typeGradient(event.type)}`}
                    initial={{ scale: 1 }} whileHover={{ scale: 1.08 }} transition={{ duration: 0.4 }} />
                  <motion.div className="absolute inset-0 bg-black" initial={{ opacity: 0.6 }} whileHover={{ opacity: 0.42 }} transition={{ duration: 0.25 }} />

                  <div className="relative flex flex-col gap-3 p-4">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold text-white">{event.name}</h2>
                        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{event.type}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={(e) => { e.stopPropagation(); setOpenMenu((p) => p === event.id ? null : event.id); }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-slate-100 ring-1 ring-white/40 hover:bg-black/60">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                        <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${status.color}`}>
                          <StatusIcon className="h-3 w-3" />{status.label}
                        </div>
                      </div>

                      {/* Dropdown */}
                      <AnimatePresence>
                        {openMenu === event.id && (
                          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-2 top-10 z-20 w-32 rounded-xl border border-white/15 bg-[#050711]/95 p-1 text-[11px] text-slate-100 shadow-[0_16px_40px_rgba(15,23,42,0.95)]">
                            <button type="button" className="flex w-full items-center rounded-lg px-2 py-1.5 hover:bg-white/10">Edit</button>
                            <button type="button" onClick={() => router.push(`/dashboard/events/${event.id}`)} className="flex w-full items-center rounded-lg px-2 py-1.5 hover:bg-white/10">View</button>
                            <PermissionGate action="events.delete">
                              <button type="button" onClick={() => handleDelete(event.id)} className="flex w-full items-center rounded-lg px-2 py-1.5 text-red-300 hover:bg-red-500/10">Delete</button>
                            </PermissionGate>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-100">
                      <span className="inline-flex items-center gap-1.5"><CalendarRange className="h-3 w-3 text-indigo-200" />{event.date}</span>
                      <span className="inline-flex items-center gap-1.5"><MapPin className="h-3 w-3" />{event.venue}</span>
                      <span className="inline-flex items-center gap-1.5"><Users className="h-3 w-3 text-emerald-200" />{event.participants.toLocaleString()} participants</span>
                    </div>

                    {/* Hover expand */}
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: hoveredId === event.id ? 1 : 0, height: hoveredId === event.id ? "auto" : 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden text-[11px] text-slate-100">
                      <div className="mt-2 rounded-2xl bg-black/40 p-3 ring-1 ring-white/15">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-slate-300">Task progress</span>
                          <span>{event.completion}% · {event.tasksDone}/{event.tasksTotal} tasks</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-white/10">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${event.completion}%` }} transition={{ duration: 0.5, ease: "easeOut" }}
                            className="h-full rounded-full bg-gradient-to-r from-indigo-300 via-purple-300 to-emerald-300" />
                        </div>
                        <p className="mt-2 line-clamp-2 text-slate-100/90">{event.description}</p>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{event.participants.toLocaleString()} registered</div>
                            <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                              {event.daysRemaining > 0 ? `${event.daysRemaining} days remaining` : event.status === "completed" ? "Completed" : "Happening today"}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {event.assignees.map((initials) => (
                              <div key={initials} className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[10px] font-semibold text-slate-900 shadow">{initials}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}