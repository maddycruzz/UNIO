"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Calendar, ListChecks, Video, Users, Megaphone,
  Plus, Settings, Trash2, Award, LayoutDashboard, ArrowRight,
} from "lucide-react";
import { loadEvents, loadTasks, loadMeetings, loadTeamMembers } from "@/lib/db";
import type { UnioEvent, UnioTask, UnioMeeting } from "@/lib/store";

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon: React.ElementType;
  href?: string;
  section: "Pages" | "Events" | "Tasks" | "Meetings" | "People" | "Actions";
}

const PAGE_ITEMS: PaletteItem[] = [
  { id: "p-dash",    label: "Dashboard",      icon: LayoutDashboard, href: "/dashboard",                 section: "Pages" },
  { id: "p-events",  label: "Events",         icon: Calendar,         href: "/dashboard/events",          section: "Pages" },
  { id: "p-tasks",   label: "Tasks",          icon: ListChecks,       href: "/dashboard/tasks",           section: "Pages" },
  { id: "p-meet",    label: "Meetings",       icon: Video,            href: "/dashboard/meetings",        section: "Pages" },
  { id: "p-team",    label: "Team",           icon: Users,            href: "/dashboard/team",            section: "Pages" },
  { id: "p-part",    label: "Participants",   icon: Users,            href: "/dashboard/participants",    section: "Pages" },
  { id: "p-anno",    label: "Announcements",  icon: Megaphone,        href: "/dashboard/announcements",   section: "Pages" },
  { id: "p-cert",    label: "Certificates",   icon: Award,            href: "/dashboard/certificates",    section: "Pages" },
  { id: "p-trash",   label: "Recently deleted", icon: Trash2,         href: "/dashboard/trash",           section: "Pages" },
  { id: "p-set",     label: "Settings",       icon: Settings,         href: "/dashboard/settings",        section: "Pages" },
  { id: "a-new-evt", label: "Create new event", icon: Plus,           href: "/dashboard/events/new",      section: "Actions" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<UnioEvent[]>([]);
  const [tasks, setTasks] = useState<UnioTask[]>([]);
  const [meetings, setMeetings] = useState<UnioMeeting[]>([]);
  const [people, setPeople] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ⌘K / Ctrl+K toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Refresh data when opened.
  const refresh = useCallback(async () => {
    const [e, t, m, p] = await Promise.all([loadEvents(), loadTasks(), loadMeetings(), loadTeamMembers()]);
    setEvents(e);
    setTasks(t);
    setMeetings(m);
    setPeople(p.map((tm) => ({ id: tm.id, name: tm.name, email: tm.email })));
  }, []);

  useEffect(() => {
    if (open) {
      refresh();
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    } else {
      setQuery("");
    }
  }, [open, refresh]);

  // Build the flat candidate list.
  const items: PaletteItem[] = useMemo(() => {
    const all: PaletteItem[] = [...PAGE_ITEMS];
    events.forEach((e) => all.push({
      id: `e-${e.id}`, label: e.name, hint: `${e.type} · ${e.date}`,
      icon: Calendar, href: `/dashboard/events/${e.id}`, section: "Events",
    }));
    tasks.forEach((t) => all.push({
      id: `t-${t.id}`, label: t.title, hint: `${t.event} · ${t.status}`,
      icon: ListChecks, href: `/dashboard/tasks`, section: "Tasks",
    }));
    meetings.forEach((m) => all.push({
      id: `m-${m.id}`, label: m.title, hint: `${m.event} · ${m.date}`,
      icon: Video, href: `/dashboard/meetings`, section: "Meetings",
    }));
    people.forEach((p) => all.push({
      id: `u-${p.id}`, label: p.name, hint: p.email,
      icon: Users, href: `/dashboard/team`, section: "People",
    }));
    return all;
  }, [events, tasks, meetings, people]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.filter((i) => i.section === "Pages" || i.section === "Actions");
    return items.filter((i) =>
      i.label.toLowerCase().includes(q) ||
      (i.hint ?? "").toLowerCase().includes(q)
    ).slice(0, 30);
  }, [items, query]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filtered[activeIdx];
      if (target?.href) {
        router.push(target.href);
        setOpen(false);
      }
    }
  };

  if (!open) return null;

  // Group filtered items by section for display.
  const sections: Record<string, PaletteItem[]> = {};
  filtered.forEach((it) => {
    if (!sections[it.section]) sections[it.section] = [];
    sections[it.section].push(it);
  });
  let runningIdx = -1;

  return (
    <div
      onClick={() => setOpen(false)}
      onKeyDown={onKeyDown}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)",
        zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "10vh 16px 16px",
      }}
    >
      <div
        role="dialog"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560, background: "#11131C", border: "1px solid rgba(99,102,241,0.25)",
          borderRadius: 16, boxShadow: "0 30px 80px rgba(0,0,0,0.7)", overflow: "hidden",
          fontFamily: "'DM Sans', system-ui, sans-serif", color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <Search size={16} color="rgba(255,255,255,0.5)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events, tasks, people, or jump to a page…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "white", fontSize: 14,
            }}
          />
          <kbd style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 4 }}>esc</kbd>
        </div>

        <div style={{ maxHeight: "min(60vh, 480px)", overflowY: "auto", padding: 6 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 28, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              No matches for &quot;{query}&quot;
            </div>
          ) : (
            Object.entries(sections).map(([section, list]) => (
              <div key={section} style={{ padding: "6px 4px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", padding: "4px 10px" }}>{section}</div>
                {list.map((it) => {
                  runningIdx++;
                  const Icon = it.icon;
                  const active = runningIdx === activeIdx;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onMouseEnter={() => setActiveIdx(filtered.indexOf(it))}
                      onClick={() => {
                        if (it.href) router.push(it.href);
                        setOpen(false);
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%",
                        padding: "9px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                        background: active ? "rgba(99,102,241,0.18)" : "transparent",
                        color: "white", textAlign: "left",
                      }}
                    >
                      <span style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.06)", color: active ? "#A5B4FC" : "rgba(255,255,255,0.6)" }}>
                        <Icon size={14} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{it.label}</span>
                        {it.hint && <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{it.hint}</span>}
                      </span>
                      {active && <ArrowRight size={12} color="rgba(255,255,255,0.5)" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px", borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
          <span>↑↓ navigate · ↵ open</span>
          <span>⌘K to toggle</span>
        </div>
      </div>
    </div>
  );
}
