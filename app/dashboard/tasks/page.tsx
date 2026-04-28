"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  loadTasks as storeLoadTasks,
  saveTasks as storeSaveTasks,
  addTask,
  loadEvents,
  loadProfile,
  getEventColor,
  type UnioTask,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/store";

type Task = UnioTask;

const PRIORITY_META: Record<TaskPriority, { color: string; bg: string }> = {
  High:   { color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  Medium: { color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  Low:    { color: "#10B981", bg: "rgba(16,185,129,0.12)" },
};

const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  todo: "inprogress", inprogress: "done", done: "todo",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To Do", inprogress: "In Progress", done: "Done",
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: "#6366F1", inprogress: "#F59E0B", done: "#10B981",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function dueMeta(iso: string) {
  const d = new Date(iso);
  const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
  const label = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  if (diff < 0)   return { label: `${label} · Overdue`,       color: "#EF4444",                dot: "#EF4444" };
  if (diff === 0) return { label: "Due Today",                 color: "#F59E0B",                dot: "#F59E0B" };
  if (diff <= 3)  return { label: `${label} · ${diff}d left`, color: "#F97316",                dot: "#F97316" };
  return           { label,                                    color: "rgba(255,255,255,0.28)", dot: "rgba(255,255,255,0.15)" };
}

function Avatar({ i, c, size = 24 }: { i: string; c: string; size?: number }) {
  return (
    <div title={i} style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg,${c}cc,${c}44)`, border: `1.5px solid ${c}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, color: "white", flexShrink: 0, marginLeft: -4 }}>
      {i}
    </div>
  );
}

function EventProgressCard({ name, tasks, color, isActive, onClick }: { name: string; tasks: Task[]; color: string; isActive: boolean; onClick: () => void }) {
  const done = tasks.filter(t => t.status === "done").length;
  const pct  = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  return (
    <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={onClick}
      style={{ background: isActive ? `${color}18` : "rgba(255,255,255,0.03)", border: `1px solid ${isActive ? color + "50" : "rgba(255,255,255,0.07)"}`, borderRadius: 16, padding: "14px 16px", cursor: "pointer", textAlign: "left", transition: "all 0.2s", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: isActive ? "white" : "rgba(255,255,255,0.55)", lineHeight: 1.3 }}>{name}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.07)", marginBottom: 8 }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ height: "100%", borderRadius: 2, background: color }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{done}/{tasks.length} done</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{pct}%</span>
      </div>
    </motion.button>
  );
}

function TaskRow({ task, onCycle, idx }: { task: Task; onCycle: (id: string, forceTo?: TaskStatus) => void; idx: number }) {
  const [open, setOpen] = useState(false);
  const pm   = PRIORITY_META[task.priority];
  const due  = dueMeta(task.due);
  const ec   = task.eventColor;
  const isDone = task.status === "done";

  return (
    <motion.div layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04, duration: 0.22 }}>
      <div onClick={() => setOpen(v => !v)}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderRadius: open ? "14px 14px 0 0" : 14, background: "rgba(255,255,255,0.035)", border: `1px solid ${open ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)"}`, cursor: "pointer", transition: "all 0.15s" }}>

        <button onClick={e => { e.stopPropagation(); onCycle(task.id); }}
          style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${isDone ? "#10B981" : "rgba(255,255,255,0.2)"}`, background: isDone ? "#10B981" : "transparent", flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
          {isDone && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: isDone ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.9)", textDecoration: isDone ? "line-through" : "none" }}>
              {task.title}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px 2px 5px", borderRadius: 6, background: `${ec}15`, border: `1px solid ${ec}30` }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: ec }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: ec, whiteSpace: "nowrap" }}>{task.event}</span>
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", paddingLeft: 4, flexShrink: 0 }}>
          {task.assignees.map((a, i) => <Avatar key={i} i={a.i} c={a.c} size={24} />)}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: due.dot }} />
          <span style={{ fontSize: 11, color: due.color, fontWeight: due.color !== "rgba(255,255,255,0.28)" ? 600 : 400, whiteSpace: "nowrap" }}>{due.label}</span>
        </div>

        <div style={{ padding: "2px 8px", borderRadius: 6, background: pm.bg, fontSize: 10, fontWeight: 700, color: pm.color, flexShrink: 0 }}>
          {task.priority}
        </div>

        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, color: "rgba(255,255,255,0.2)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 16px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderTop: "none", borderRadius: "0 0 14px 14px" }}>
              <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "rgba(255,255,255,0.45)", lineHeight: 1.65 }}>{task.description}</p>
              <div style={{ display: "flex", gap: 6 }}>
                {(Object.keys(STATUS_LABEL) as TaskStatus[]).map(s => (
                  <button key={s} onClick={e => { e.stopPropagation(); onCycle(task.id, s); }}
                    style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: `1px solid ${task.status === s ? STATUS_COLOR[s] : "rgba(255,255,255,0.08)"}`, background: task.status === s ? `${STATUS_COLOR[s]}20` : "transparent", fontSize: 11, fontWeight: 600, color: task.status === s ? STATUS_COLOR[s] : "rgba(255,255,255,0.28)", cursor: "pointer", transition: "all 0.15s" }}>
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function MyTasksPage() {
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [eventFilter, setEF]  = useState("All");
  const [statusFilter, setSF] = useState("All");
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskEvent, setNewTaskEvent] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>("Medium");
  const profile = useMemo(() => loadProfile(), []);
  const events = useMemo(() => loadEvents(), []);

  useEffect(() => {
    setTasks(storeLoadTasks());
    const handler = () => setTasks(storeLoadTasks());
    window.addEventListener("unio-store-change", handler);
    return () => window.removeEventListener("unio-store-change", handler);
  }, []);

  const cycleStatus = (id: string, forceTo?: TaskStatus) => {
    const updated = tasks.map(t => t.id !== id ? t : { ...t, status: forceTo ?? STATUS_CYCLE[t.status] });
    setTasks(updated);
    storeSaveTasks(updated);
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    const eventName = newTaskEvent || events[0]?.name || "General";
    const task: Task = {
      id: `t-${Date.now()}`,
      title: newTaskTitle.trim(),
      event: eventName,
      eventColor: getEventColor(eventName),
      priority: newTaskPriority,
      status: "todo",
      due: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
      assignees: [{ i: profile.initials, c: "#6366F1" }],
      description: "",
    };
    addTask(task);
    setTasks(storeLoadTasks());
    setNewTaskTitle("");
    setNewTaskEvent("");
    setNewTaskPriority("Medium");
    setShowAddTask(false);
  };

  const byEvent = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (!map[t.event]) map[t.event] = [];
      map[t.event].push(t);
    }
    return map;
  }, [tasks]);

  const filtered = useMemo(() => tasks.filter(t => {
    if (eventFilter !== "All" && t.event !== eventFilter) return false;
    if (statusFilter !== "All") {
      const s: Record<string, TaskStatus> = { "To Do": "todo", "In Progress": "inprogress", "Done": "done" };
      if (t.status !== s[statusFilter]) return false;
    }
    return true;
  }), [tasks, eventFilter, statusFilter]);

  const total  = tasks.length;
  const done   = tasks.filter(t => t.status === "done").length;
  const inprog = tasks.filter(t => t.status === "inprogress").length;
  const pct    = Math.round((done / total) * 100);

  const sections = [
    { key: "inprogress" as TaskStatus, label: "In Progress", color: "#F59E0B", tasks: filtered.filter(t => t.status === "inprogress") },
    { key: "todo"       as TaskStatus, label: "To Do",        color: "#6366F1", tasks: filtered.filter(t => t.status === "todo") },
    { key: "done"       as TaskStatus, label: "Done",          color: "#10B981", tasks: filtered.filter(t => t.status === "done") },
  ].filter(s => s.tasks.length > 0);

  return (
    <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", color: "white" }}>

      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#6366F1,#10B981)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>{profile.initials.charAt(0)}</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.3px" }}>My Tasks</h1>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Your responsibilities across all events</p>
          </div>
        </div>
        <button onClick={() => setShowAddTask(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 12, background: "#6366F1", border: "none", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(99,102,241,0.4)" }}>
          + Add Task
        </button>
      </div>

      {/* Add Task Modal */}
      <AnimatePresence>
        {showAddTask && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ marginBottom: 20, padding: 20, borderRadius: 16, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.06)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>New Task</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Task title..."
                style={{ flex: 2, minWidth: 180, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(0,0,0,0.3)", color: "white", fontSize: 12, outline: "none" }} />
              <select value={newTaskEvent} onChange={e => setNewTaskEvent(e.target.value)}
                style={{ flex: 1, minWidth: 140, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(0,0,0,0.3)", color: "white", fontSize: 12 }}>
                <option value="">Select event...</option>
                {events.map(ev => <option key={ev.id} value={ev.name}>{ev.name}</option>)}
              </select>
              <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as TaskPriority)}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(0,0,0,0.3)", color: "white", fontSize: 12 }}>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              <button onClick={handleAddTask}
                style={{ padding: "8px 16px", borderRadius: 8, background: "#6366F1", border: "none", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Add</button>
              <button onClick={() => setShowAddTask(false)}
                style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.12),rgba(16,185,129,0.08))", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 20, padding: "20px 24px", marginBottom: 24, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,0.15),transparent 70%)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Overall completion</div>
            <div style={{ fontSize: 42, fontWeight: 900, color: "white", letterSpacing: "-1px" }}>
              {pct}<span style={{ fontSize: 22, color: "rgba(255,255,255,0.4)" }}>%</span>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
              <span style={{ color: "#10B981", fontWeight: 600 }}>{done} done</span>
              <span style={{ margin: "0 6px", opacity: 0.3 }}>·</span>
              <span style={{ color: "#F59E0B", fontWeight: 600 }}>{inprog} in progress</span>
              <span style={{ margin: "0 6px", opacity: 0.3 }}>·</span>
              <span style={{ color: "#6366F1", fontWeight: 600 }}>{total - done - inprog} to do</span>
            </div>
          </div>
          <div style={{ position: "relative", width: 80, height: 80, flexShrink: 0 }}>
            <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6"/>
              <motion.circle cx="40" cy="40" r="32" fill="none" stroke="url(#prog)" strokeWidth="6" strokeLinecap="round"
                initial={{ strokeDashoffset: 201 }}
                animate={{ strokeDashoffset: 201 - (201 * pct / 100) }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                strokeDasharray="201"
              />
              <defs>
                <linearGradient id="prog" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366F1"/>
                  <stop offset="100%" stopColor="#10B981"/>
                </linearGradient>
              </defs>
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>{pct}%</div>
          </div>
        </div>
        <div style={{ marginTop: 16, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.07)" }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: "easeOut" }}
            style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg,#6366F1,#10B981)" }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 24 }}>
        {Object.entries(byEvent).map(([name, evTasks]) => (
          <EventProgressCard key={name} name={name} tasks={evTasks} color={getEventColor(name)}
            isActive={eventFilter === name}
            onClick={() => setEF(p => p === name ? "All" : name)} />
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Filter</span>
        {["All", "To Do", "In Progress", "Done"].map(s => (
          <button key={s} onClick={() => setSF(s)}
            style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s", borderColor: statusFilter === s ? "#6366F1" : "rgba(255,255,255,0.08)", background: statusFilter === s ? "rgba(99,102,241,0.15)" : "transparent", color: statusFilter === s ? "#818CF8" : "rgba(255,255,255,0.35)" }}>
            {s}
          </button>
        ))}
        {eventFilter !== "All" && (
          <button onClick={() => setEF("All")}
            style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: `1px solid ${getEventColor(eventFilter)}40`, background: `${getEventColor(eventFilter)}12`, fontSize: 11, fontWeight: 600, color: getEventColor(eventFilter), cursor: "pointer" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: getEventColor(eventFilter) }} />
            {eventFilter} · Clear
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {sections.map(section => (
          <div key={section.key}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: section.color, boxShadow: `0 0 6px ${section.color}` }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: section.color, letterSpacing: "0.08em", textTransform: "uppercase" }}>{section.label}</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>{section.tasks.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {section.tasks.map((t, i) => (
                <TaskRow key={t.id} task={t} onCycle={cycleStatus} idx={i} />
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "50px 0", color: "rgba(255,255,255,0.18)" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
            <p style={{ margin: 0, fontSize: 13 }}>No tasks match your filter</p>
          </div>
        )}
      </div>
    </div>
  );
}