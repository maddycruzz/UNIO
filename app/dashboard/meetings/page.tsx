"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getEventColor,
  type UnioMeeting,
  type MeetingStatus,
  type UnioEvent,
} from "@/lib/store";
import {
  loadMeetings as dbLoadMeetings,
  addMeeting as dbAddMeeting,
  saveMeetings as dbSaveMeetings,
  deleteMeeting as dbDeleteMeeting,
  loadEvents as dbLoadEvents,
} from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { PermissionGate, can } from "@/lib/permissions";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────

type Meeting = UnioMeeting;

// Mock data removed — all meetings loaded from store via storeLoadMeetings()

const STATUS_META: Record<MeetingStatus, { label: string; color: string; bg: string; dot: string }> = {
  upcoming:  { label: "Upcoming",  color: "#6366F1", bg: "rgba(99,102,241,0.12)",  dot: "#6366F1" },
  ongoing:   { label: "Ongoing",   color: "#10B981", bg: "rgba(16,185,129,0.12)",  dot: "#10B981" },
  completed: { label: "Completed", color: "rgba(255,255,255,0.3)", bg: "rgba(255,255,255,0.06)", dot: "rgba(255,255,255,0.25)" },
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ─── Helpers ──────────────────────────────────────────────────────

function parseDate(date: string, time: string) {
  return new Date(`${date}T${time}:00`);
}

function formatDate(date: string) {
  const d = new Date(date + "T00:00:00");
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour   = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${suffix}`;
}

function formatDuration(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// Get all dates in a given month
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

// ─── Avatar ───────────────────────────────────────────────────────

function Avatar({ i, c, size = 26 }: { i: string; c: string; size?: number }) {
  return (
    <div title={i} style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg,${c}cc,${c}44)`, border: `1.5px solid ${c}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 700, color: "white", flexShrink: 0, marginLeft: -5 }}>
      {i}
    </div>
  );
}

// ─── Meeting Detail Modal ─────────────────────────────────────────

function MeetingModal({ meeting, onClose, onSaveNotes, onDelete }: { meeting: Meeting; onClose: () => void; onSaveNotes: (id: string, notes: string) => void; onDelete?: (id: string) => void }) {
  const [notes, setNotes]   = useState(meeting.notes);
  const [tab, setTab]       = useState<"agenda" | "notes">("agenda");
  const sm = STATUS_META[meeting.status];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        style={{ background: "#13151F", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, width: "100%", maxWidth: 560, maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 40px 100px rgba(0,0,0,0.7)" }}>

        {/* Header */}
        <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "2px 8px 2px 6px", borderRadius: 6, background: `${meeting.eventColor}15`, border: `1px solid ${meeting.eventColor}30` }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: meeting.eventColor }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: meeting.eventColor }}>{meeting.event}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 6, background: sm.bg }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: sm.dot, boxShadow: meeting.status === "ongoing" ? `0 0 6px ${sm.dot}` : "none" }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: sm.color }}>{sm.label}</span>
                </div>
              </div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "white", letterSpacing: "-0.3px" }}>{meeting.title}</h2>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {onDelete && (
                <button onClick={() => { onDelete(meeting.id); onClose(); }} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#f87171", fontSize: 14, flexShrink: 0 }} title="Delete meeting">🗑</button>
              )}
              <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.5)", fontSize: 16, flexShrink: 0 }}>×</button>
            </div>
          </div>

          {/* Meta row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 14 }}>
            {[
              { icon: "📅", label: formatDate(meeting.date) },
              { icon: "🕐", label: `${formatTime(meeting.time)} · ${formatDuration(meeting.duration)}` },
              { icon: "📍", label: meeting.location },
            ].map(({ icon, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12 }}>{icon}</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Attendees */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
            <div style={{ display: "flex", paddingLeft: 5 }}>
              {meeting.attendees.map((a, i) => <Avatar key={i} i={a.i} c={a.c} size={28} />)}
            </div>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{meeting.attendees.length} attendees</span>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 24px" }}>
          {(["agenda", "notes"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: "12px 0", marginRight: 24, fontSize: 13, fontWeight: 600, color: tab === t ? "white" : "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", borderBottom: `2px solid ${tab === t ? "#6366F1" : "transparent"}`, transition: "all 0.15s", textTransform: "capitalize" }}>
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {tab === "agenda" ? (
            <div>
              {meeting.agenda ? (
                meeting.agenda.split("\n").map((line, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#818CF8", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                    <span style={{ fontSize: 13.5, color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>{line.replace(/^\d+\.\s*/, "")}</span>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", margin: 0 }}>No agenda set.</p>
              )}
            </div>
          ) : (
            <div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add meeting notes here…"
                style={{ width: "100%", minHeight: 160, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, padding: "12px 14px", fontSize: 13.5, color: "rgba(255,255,255,0.8)", resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.65, boxSizing: "border-box" }}
              />
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => onSaveNotes(meeting.id, notes)}
                style={{ marginTop: 10, padding: "9px 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366F1,#818CF8)", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(99,102,241,0.3)" }}>
                Save Notes
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Schedule Modal ───────────────────────────────────────────────

function ScheduleModal({ onClose, onAdd, events }: { onClose: () => void; onAdd: (m: Meeting) => Promise<void>; events: UnioEvent[] }) {
  const [form, setForm] = useState({ title: "", event: "", date: "", time: "", duration: "60", location: "", agenda: "", meetingLink: "" });
  const [step, setStep] = useState<"form" | "success">("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const EVENTS = events.map(e => e.name);

  // Set default event
  useEffect(() => {
    if (!form.event && EVENTS.length > 0) {
      setForm(prev => ({ ...prev, event: EVENTS[0] }));
    }
  }, [EVENTS.length]);

  const handleSubmit = async () => {
    if (!form.title || !form.date || !form.time || !form.location) return;
    const newMeeting: Meeting = {
      id: "m-" + Date.now(), title: form.title, event: form.event,
      eventColor: getEventColor(form.event),
      date: form.date, time: form.time, duration: parseInt(form.duration),
      location: form.meetingLink ? `${form.location} · ${form.meetingLink}` : form.location,
      status: "upcoming",
      attendees: [{ i: "AK", c: "#6366F1" }],
      agenda: form.agenda, notes: "",
    };
    
    setIsSubmitting(true);
    setErrorMsg("");
    
    try {
      await onAdd(newMeeting);
      setStep("success");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to schedule meeting.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 13px", fontSize: 13, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6, display: "block" };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        style={{ background: "#13151F", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, width: "100%", maxWidth: 480, overflow: "hidden", boxShadow: "0 40px 100px rgba(0,0,0,0.7)" }}>

        {step === "form" ? (
          <>
            <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "white" }}>Schedule Meeting</h2>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Add a new meeting to your calendar</p>
              </div>
              <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.5)", fontSize: 16 }}>×</button>
            </div>

            <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Title</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Kickoff sync" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Event</label>
                {EVENTS.length > 0 ? (
                  <select value={form.event} onChange={e => setForm(p => ({ ...p, event: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
                    {EVENTS.map(ev => <option key={ev} value={ev} style={{ background: "#13151F", color: "#ffffff" }}>{ev}</option>)}
                  </select>
                ) : (
                  <div style={{ ...inputStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "rgba(255,255,255,0.35)" }}>No events found</span>
                    <Link href="/dashboard/events" onClick={onClose} style={{ color: "#6366F1", textDecoration: "none", fontSize: 12, fontWeight: 700 }}>
                      Create Event →
                    </Link>
                  </div>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={{ ...inputStyle, colorScheme: "dark" }} />
                </div>
                <div>
                  <label style={labelStyle}>Time</label>
                  <input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} style={{ ...inputStyle, colorScheme: "dark" }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Duration</label>
                  <select value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
                    {[15,30,45,60,90,120].map(d => <option key={d} value={d} style={{ background: "#13151F", color: "#ffffff" }}>{formatDuration(d)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Location</label>
                  <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Room / Zoom / Meet" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Meeting Link (optional)</label>
                <input value={form.meetingLink} onChange={e => setForm(p => ({ ...p, meetingLink: e.target.value }))} placeholder="https://zoom.us/... or Google Meet link" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Agenda (optional)</label>
                <textarea value={form.agenda} onChange={e => setForm(p => ({ ...p, agenda: e.target.value }))} placeholder="1. Topic one&#10;2. Topic two" rows={3}
                  style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
              </div>
              <motion.button whileHover={!isSubmitting && EVENTS.length > 0 ? { scale: 1.02 } : {}} whileTap={!isSubmitting && EVENTS.length > 0 ? { scale: 0.98 } : {}} onClick={handleSubmit} disabled={isSubmitting || EVENTS.length === 0}
                style={{ padding: "11px 0", borderRadius: 12, border: "none", background: EVENTS.length > 0 ? "linear-gradient(135deg,#6366F1,#818CF8)" : "rgba(255,255,255,0.05)", borderStyle: EVENTS.length > 0 ? "none" : "solid", borderColor: "rgba(255,255,255,0.1)", borderWidth: EVENTS.length > 0 ? 0 : 1, color: EVENTS.length > 0 ? "white" : "rgba(255,255,255,0.25)", fontSize: 14, fontWeight: 700, cursor: isSubmitting || EVENTS.length === 0 ? "not-allowed" : "pointer", boxShadow: EVENTS.length > 0 ? "0 4px 16px rgba(99,102,241,0.35)" : "none", marginTop: 4, opacity: isSubmitting ? 0.6 : 1 }}>
                {isSubmitting ? "Scheduling..." : EVENTS.length === 0 ? "Create an Event First" : "Schedule Meeting"}
              </motion.button>
              {errorMsg && <div style={{ fontSize: 13, color: "#EF4444", textAlign: "center" }}>{errorMsg}</div>}
            </div>
          </>
        ) : (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", duration: 0.5 }}
              style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,#10B981,#34D399)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 0 30px rgba(16,185,129,0.4)" }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M6 14L11 19L22 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </motion.div>
            <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: "white" }}>Meeting Scheduled!</h3>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>It's been added to your calendar.</p>
            <button onClick={onClose} style={{ padding: "9px 28px", borderRadius: 10, border: "none", background: "rgba(255,255,255,0.08)", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Close</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Meeting Card (List view) ─────────────────────────────────────

function MeetingCard({ meeting, onClick, idx }: { meeting: Meeting; onClick: () => void; idx: number }) {
  const sm = STATUS_META[meeting.status];
  const isCompleted = meeting.status === "completed";

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05, duration: 0.22 }}
      whileHover={{ y: -2 }} onClick={onClick}
      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${meeting.status === "ongoing" ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.07)"}`, borderRadius: 16, padding: "16px 18px", cursor: "pointer", transition: "border-color 0.2s", position: "relative", overflow: "hidden" }}>

      {/* Ongoing glow strip */}
      {meeting.status === "ongoing" && (
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "linear-gradient(180deg,#10B981,#34D399)", borderRadius: "3px 0 0 3px" }} />
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, paddingLeft: meeting.status === "ongoing" ? 8 : 0 }}>
        {/* Date block */}
        <div style={{ flexShrink: 0, width: 48, textAlign: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "8px 0" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: isCompleted ? "rgba(255,255,255,0.3)" : "white", lineHeight: 1 }}>{new Date(meeting.date + "T00:00:00").getDate()}</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{MONTHS[new Date(meeting.date + "T00:00:00").getMonth()]}</div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: isCompleted ? "rgba(255,255,255,0.45)" : "white" }}>{meeting.title}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px 2px 5px", borderRadius: 5, background: `${meeting.eventColor}15`, border: `1px solid ${meeting.eventColor}30` }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: meeting.eventColor }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: meeting.eventColor }}>{meeting.event}</span>
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
            <span>🕐 {formatTime(meeting.time)} · {formatDuration(meeting.duration)}</span>
            <span>📍 {meeting.location}</span>
          </div>
        </div>

        {/* Right side */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 6, background: sm.bg }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: sm.dot, boxShadow: meeting.status === "ongoing" ? `0 0 6px ${sm.dot}` : "none" }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: sm.color }}>{sm.label}</span>
          </div>
          <div style={{ display: "flex", paddingLeft: 5 }}>
            {meeting.attendees.slice(0, 4).map((a, i) => <Avatar key={i} i={a.i} c={a.c} size={22} />)}
            {meeting.attendees.length > 4 && <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "rgba(255,255,255,0.4)", marginLeft: -5 }}>+{meeting.attendees.length - 4}</div>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────

function CalendarView({ meetings, onSelectMeeting }: { meetings: Meeting[]; onSelectMeeting: (m: Meeting) => void }) {
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth  = getDaysInMonth(viewYear, viewMonth);
  const firstDayOfMonth = getFirstDayOfMonth(viewYear, viewMonth);

  const meetingsByDay = useMemo(() => {
    const map: Record<number, Meeting[]> = {};
    for (const m of meetings) {
      const d = new Date(m.date + "T00:00:00");
      if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(m);
      }
    }
    return map;
  }, [meetings, viewYear, viewMonth]);

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const isToday = (day: number) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, overflow: "hidden" }}>
      {/* Calendar header */}
      <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={prevMonth} style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "rgba(255,255,255,0.6)", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: "white" }}>{MONTHS[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "rgba(255,255,255,0.6)", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
      </div>

      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", padding: "10px 12px 4px" }}>
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.07em", paddingBottom: 8 }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, padding: "0 12px 16px" }}>
        {/* Empty cells before first day */}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}

        {/* Days */}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const dayMeetings = meetingsByDay[day] ?? [];
          const hasMeeting  = dayMeetings.length > 0;
          const todayFlag   = isToday(day);

          return (
            <div key={day} style={{ minHeight: 64, padding: 4, borderRadius: 10, background: todayFlag ? "rgba(99,102,241,0.12)" : hasMeeting ? "rgba(255,255,255,0.02)" : "transparent", border: todayFlag ? "1px solid rgba(99,102,241,0.35)" : "1px solid transparent", transition: "background 0.15s" }}>
              <div style={{ fontSize: 12, fontWeight: todayFlag ? 800 : 500, color: todayFlag ? "#818CF8" : "rgba(255,255,255,0.5)", marginBottom: 4, textAlign: "center" }}>{day}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {dayMeetings.slice(0, 2).map(m => (
                  <button key={m.id} onClick={() => onSelectMeeting(m)}
                    style={{ width: "100%", padding: "2px 4px", borderRadius: 4, background: `${m.eventColor}22`, border: `1px solid ${m.eventColor}40`, cursor: "pointer", textAlign: "left" }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: m.eventColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatTime(m.time)}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</div>
                  </button>
                ))}
                {dayMeetings.length > 2 && (
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>+{dayMeetings.length - 2} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export default function MeetingsPage() {
  const { user } = useAuth();
  const [meetings, setMeetings]     = useState<Meeting[]>([]);
  const [events, setEvents]         = useState<UnioEvent[]>([]);
  const [view, setView]             = useState<"list" | "calendar">("list");
  const [statusFilter, setSF]       = useState<"all" | MeetingStatus>("all");
  const [selectedMeeting, setSelected] = useState<Meeting | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    const fetchMeetings = async () => setMeetings(await dbLoadMeetings());
    const fetchEvents = async () => setEvents(await dbLoadEvents());
    fetchMeetings();
    fetchEvents();
    const handler = () => {
      fetchMeetings();
      fetchEvents();
    };
    window.addEventListener("unio-store-change", handler);
    return () => window.removeEventListener("unio-store-change", handler);
  }, []);

  const filtered = useMemo(() => meetings.filter(m => statusFilter === "all" || m.status === statusFilter), [meetings, statusFilter]);

  const stats = {
    total:     meetings.length,
    upcoming:  meetings.filter(m => m.status === "upcoming").length,
    ongoing:   meetings.filter(m => m.status === "ongoing").length,
    completed: meetings.filter(m => m.status === "completed").length,
  };

  const saveNotes = async (id: string, notes: string) => {
    await dbSaveMeetings(meetings.map(m => m.id === id ? { ...m, notes } : m));
    setMeetings((prev) => prev.map(m => m.id === id ? { ...m, notes } : m));
    setSelected(p => p ? { ...p, notes } : p);
  };

  const addMeeting = async (m: Meeting) => {
    await dbAddMeeting(m);
    setMeetings((prev) => [m, ...prev]);
  };

  const deleteMeeting = async (id: string) => {
    await dbDeleteMeeting(id);
    setMeetings((prev) => prev.filter(m => m.id !== id));
  };

  // Group list by date section
  const grouped = useMemo(() => {
    const now = new Date();
    const today: Meeting[]     = [];
    const upcoming: Meeting[]  = [];
    const past: Meeting[]      = [];
    for (const m of filtered) {
      const d = parseDate(m.date, m.time);
      const diffD = Math.floor((d.getTime() - now.getTime()) / 86400000);
      if (diffD < -0.5)      past.push(m);
      else if (diffD < 1)    today.push(m);
      else                   upcoming.push(m);
    }
    return { today, upcoming, past };
  }, [filtered]);

  return (
    <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", color: "white" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.3px" }}>Meetings</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Schedule and track all your event coordination meetings.</p>
        </div>
        <PermissionGate action="meetings.create">
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowSchedule(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#6366F1,#818CF8)", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Schedule Meeting
          </motion.button>
        </PermissionGate>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total",     value: stats.total,     color: "#818CF8" },
          { label: "Upcoming",  value: stats.upcoming,  color: "#6366F1" },
          { label: "Ongoing",   value: stats.ongoing,   color: "#10B981" },
          { label: "Completed", value: stats.completed, color: "rgba(255,255,255,0.4)" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {/* Status filters */}
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Filter</span>
        {([["all","All"], ["upcoming","Upcoming"], ["ongoing","Ongoing"], ["completed","Completed"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setSF(key)}
            style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s", borderColor: statusFilter === key ? "#6366F1" : "rgba(255,255,255,0.08)", background: statusFilter === key ? "rgba(99,102,241,0.15)" : "transparent", color: statusFilter === key ? "#818CF8" : "rgba(255,255,255,0.35)" }}>
            {label}
          </button>
        ))}

        {/* View toggle */}
        <div style={{ marginLeft: "auto", display: "flex", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, overflow: "hidden" }}>
          {([["list","List"], ["calendar","Calendar"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: "7px 16px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: view === v ? "rgba(99,102,241,0.25)" : "transparent", color: view === v ? "#818CF8" : "rgba(255,255,255,0.35)", transition: "all 0.15s" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Views */}
      <AnimatePresence mode="wait">
        <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {view === "list" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {grouped.today.length > 0 && (
                <Section label="Today" color="#F59E0B" meetings={grouped.today} onSelect={setSelected} offset={0} />
              )}
              {grouped.upcoming.length > 0 && (
                <Section label="Upcoming" color="#6366F1" meetings={grouped.upcoming} onSelect={setSelected} offset={grouped.today.length} />
              )}
              {grouped.past.length > 0 && (
                <Section label="Past" color="rgba(255,255,255,0.25)" meetings={grouped.past} onSelect={setSelected} offset={grouped.today.length + grouped.upcoming.length} />
              )}
              {filtered.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.18)" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📅</div>
                  <p style={{ margin: 0, fontSize: 13 }}>No meetings found</p>
                </div>
              )}
            </div>
          ) : (
            <CalendarView meetings={filtered} onSelectMeeting={setSelected} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {selectedMeeting && (
          <MeetingModal meeting={selectedMeeting} onClose={() => setSelected(null)} onSaveNotes={saveNotes} onDelete={can(user?.role, "meetings.delete") ? (id) => { deleteMeeting(id); setSelected(null); } : undefined} />
        )}
        {showSchedule && (
          <ScheduleModal onClose={() => setShowSchedule(false)} onAdd={addMeeting} events={events} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Section helper ───────────────────────────────────────────────

function Section({ label, color, meetings, onSelect, offset }: { label: string; color: string; meetings: Meeting[]; onSelect: (m: Meeting) => void; offset: number }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
        <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>{meetings.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {meetings.map((m, i) => <MeetingCard key={m.id} meeting={m} onClick={() => onSelect(m)} idx={offset + i} />)}
      </div>
    </div>
  );
}