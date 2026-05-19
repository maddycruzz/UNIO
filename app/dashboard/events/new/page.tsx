"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarRange, Code2, PartyPopper, Dumbbell,
  GraduationCap, Wand2, StickyNote, Infinity,
} from "lucide-react";
import { type UnioEvent, type EventType } from "@/lib/store";
import { addEvent } from "@/lib/db";
import { useToast } from "@/components/ui/Toast";

type EventTypeId = "cultural" | "tech" | "sports" | "workshop" | "conference" | "other";
type EventTypeOption = { id: EventTypeId; label: string; description: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; gradient: string };
type TaskItem = { id: string; label: string; done: boolean };
type EventDetails = { name: string; description: string; startDate: string; endDate: string; venue: string; headcount: string; capacity: string; capacityUnlimited: boolean; coverName?: string; coverDataUrl?: string };

const MAX_COVER_BYTES = 2 * 1024 * 1024; // 2 MB — localStorage friendly

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const EVENT_TYPES: EventTypeOption[] = [
  { id: "cultural",   label: "Cultural Fest",  description: "Fests, nights, performances, and campus celebrations.", icon: PartyPopper,   gradient: "from-indigo-500/80 via-violet-500/80 to-pink-500/80" },
  { id: "tech",       label: "Tech Symposium", description: "Hackathons, demos, talks, and showcases.",             icon: Code2,         gradient: "from-sky-500/80 via-indigo-500/80 to-emerald-500/80" },
  { id: "sports",     label: "Sports Meet",    description: "Tournaments, leagues, and athletic events.",           icon: Dumbbell,      gradient: "from-emerald-500/80 via-teal-400/80 to-cyan-400/80" },
  { id: "workshop",   label: "Workshop",       description: "Hands-on, high-intent learning sessions.",             icon: Wand2,         gradient: "from-purple-500/80 via-fuchsia-500/80 to-rose-400/80" },
  { id: "conference", label: "Conference",     description: "Multi-track conferences and symposiums.",              icon: GraduationCap, gradient: "from-amber-400/90 via-orange-500/80 to-rose-500/80" },
  { id: "other",      label: "Other",          description: "Anything else your campus dreams up.",                 icon: StickyNote,    gradient: "from-slate-500/80 via-slate-400/80 to-slate-300/80" },
];

// Explicit id → stored EventType so renaming a label can never silently
// change how an event is categorised.
const TYPE_ID_TO_EVENT_TYPE: Record<EventTypeId, EventType> = {
  cultural:   "Cultural",
  tech:       "Tech",
  sports:     "Sports",
  workshop:   "Workshop",
  conference: "Conference",
  other:      "Other",
};

const TASK_PRESETS: Record<EventTypeId, string[]> = {
  cultural:   ["Lock venue and timings", "Book performers / clubs", "Design posters and social assets", "Set up RSVP and ticketing", "Plan food stalls and logistics"],
  tech:       ["Finalize agenda and speakers", "Set up registration + track signups", "Coordinate with tech partners", "Confirm AV + live-stream setup", "Prepare judging criteria / rubrics"],
  sports:     ["Reserve fields and courts", "Publish tournament brackets", "Arrange referees and volunteers", "Check equipment and safety gear", "Coordinate medical support"],
  workshop:   ["Confirm facilitator and topic", "Share pre-work or requirements", "Arrange materials or lab access", "Set capacity limit"],
  conference: ["Plan tracks and sessions", "Invite keynote speakers", "Publish website and schedule", "Coordinate sponsors and booths", "Organize check-in and badges"],
  other:      ["Define event goals and format", "Set RSVP / sign-up flow", "Share details with marketing", "Align on operations and safety"],
};

const STEPS = ["Type", "Checklist", "Details", "Review"] as const;

function formatDateTime(dt: string) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function NewEventPage() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<EventTypeOption | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [details, setDetails] = useState<EventDetails>({ name: "", description: "", startDate: "", endDate: "", venue: "", headcount: "", capacity: "", capacityUnlimited: true });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (step === 2 && selectedType && tasks.length === 0) {
      setTasks(TASK_PRESETS[selectedType.id].map((label, i) => ({ id: `${selectedType.id}-${i}`, label, done: false })));
    }
  }, [step, selectedType, tasks.length]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!details.name.trim()) e.name = "Event name is required";
    if (!details.startDate) e.startDate = "Start date is required";
    if (!details.endDate) e.endDate = "End date is required";
    if (!details.venue.trim()) e.venue = "Venue is required";
    if (details.startDate && details.endDate && details.startDate >= details.endDate) e.endDate = "End must be after start";
    if (!details.capacityUnlimited && !details.capacity.trim()) e.capacity = "Enter a capacity or select No limit";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // FIX 2: clicking a type card immediately goes to step 2
  const handleSelectType = (option: EventTypeOption) => {
    setSelectedType(option);
    setTasks([]); // reset tasks when type changes
    setTimeout(() => setStep(2), 220);
  };

  const handleNext = async () => {
    if (step === 4) {
      if (!validate()) return;
      // Save to shared store
      const eventType: EventType = selectedType
        ? TYPE_ID_TO_EVENT_TYPE[selectedType.id]
        : "Other";
      const newEvent: UnioEvent = {
        id: details.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now(),
        name: details.name,
        type: eventType,
        description: details.description || "",
        date: details.startDate ? new Date(details.startDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) + " · " + new Date(details.startDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "TBD",
        venue: details.venue,
        participants: 0,
        capacity: details.capacityUnlimited ? null : parseInt(details.capacity) || 300,
        completion: Math.round((tasks.filter(t => t.done).length / Math.max(tasks.length, 1)) * 100),
        status: "upcoming",
        tasksDone: tasks.filter(t => t.done).length,
        tasksTotal: tasks.length,
        daysRemaining: details.startDate ? Math.max(0, Math.ceil((new Date(details.startDate).getTime() - Date.now()) / 86400000)) : 0,
        assignees: [],
        startDate: details.startDate,
        endDate: details.endDate,
        createdAt: new Date().toISOString(),
        coverImage: details.coverDataUrl,
      };
      try {
        setIsSubmitting(true);
        // Make sure we wait for the insert to finish!
        await addEvent(newEvent);
        setShowToast(true);
        setTimeout(() => { router.push("/dashboard/events"); }, 1500);
      } catch (err: any) {
        setIsSubmitting(false);
        toast.error(`Couldn't create event: ${err?.message ?? "unknown error"}`);
      }
      return;
    }
    if (step === 3 && !validate()) return;
    setStep((s) => Math.min(4, s + 1));
  };

  const canGoNext =
    (step === 2 && tasks.length > 0) ||
    (step === 3 && !!details.name && !!details.startDate && !!details.endDate && !!details.venue) ||
    step === 4;

  return (
    <div className="space-y-5 text-slate-100">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">Create new event</h1>
        <p className="mt-1 text-xs text-slate-400 sm:text-sm">A guided flow to help you stand up high quality campus events quickly.</p>
      </div>

      {/* Progress */}
      <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded-full bg-indigo/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-200">Step {step} of 4</span>
          <span className="text-slate-400/90">{STEPS[step - 1]}</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {STEPS.map((label, i) => {
            const si = i + 1; const active = si === step; const complete = si < step;
            return (
              <div key={label} className="flex flex-1 items-center gap-2">
                <div className={`grid h-6 w-6 flex-none place-items-center rounded-full text-[11px] ${complete ? "bg-emerald text-navy" : active ? "bg-indigo text-white" : "bg-white/5 text-slate-400"}`}>{si}</div>
                {i < 3 && <div className="h-0.5 flex-1 rounded-full bg-white/10"><div className={`h-full rounded-full ${complete ? "bg-gradient-to-r from-emerald to-indigo" : "bg-transparent"}`} /></div>}
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* STEP 1 */}
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
            <p className="mb-3 text-xs text-slate-400">Click a type to select and continue automatically.</p>
            <div className="grid gap-4 md:grid-cols-2">
              {EVENT_TYPES.map((opt) => {
                const Icon = opt.icon; const sel = selectedType?.id === opt.id;
                return (
                  <button key={opt.id} type="button" onClick={() => handleSelectType(opt)}
                    className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 ${sel ? "border-indigo bg-black/50 scale-[1.01]" : "border-white/15 bg-black/40 hover:-translate-y-0.5 hover:border-indigo/60"}`}>
                    <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${opt.gradient} opacity-45 group-hover:opacity-80 transition-opacity duration-500`} />
                    <div className="relative flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-black/40 text-white ring-1 ring-white/40"><Icon className="h-4 w-4" /></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">{opt.label}</p>
                          {sel && <span className="rounded-full bg-emerald px-2 py-0.5 text-[10px] font-semibold text-navy">Selected ✓</span>}
                        </div>
                        <p className="mt-1 text-xs text-slate-100/85">{opt.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}
            className="rounded-2xl border border-white/15 bg-black/40 p-4 sm:p-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Recommended checklist</h2>
                <p className="mt-1 text-xs text-slate-400">Click anywhere on a row to toggle it. Edit the text to customise.</p>
              </div>
              {selectedType && <div className="mt-2 rounded-full bg-white/5 px-3 py-1 text-[11px] text-slate-200 ring-1 ring-white/20 sm:mt-0">Based on <span className="font-semibold">{selectedType.label}</span></div>}
            </div>
            <div className="space-y-2">
              {tasks.map((task) => (
                // FIX 3: entire row is clickable
                <div key={task.id}
                  onClick={() => setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, done: !t.done } : t))}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ring-1 transition-all select-none ${task.done ? "bg-emerald/10 ring-emerald/30" : "bg-navy/80 ring-white/10 hover:bg-white/5"}`}>
                  <div className={`flex h-5 w-5 flex-none items-center justify-center rounded border text-[11px] transition-all ${task.done ? "border-emerald bg-emerald text-navy font-bold" : "border-slate-500 bg-black/30 text-transparent"}`}>✓</div>
                  <input value={task.label} onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, label: e.target.value } : t))}
                    className={`flex-1 border-none bg-transparent text-xs outline-none cursor-pointer ${task.done ? "text-emerald/80 line-through" : "text-slate-100"}`} />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}
            className="rounded-2xl border border-white/15 bg-black/40 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-white">Event details</h2>
            <p className="mt-1 mb-4 text-xs text-slate-400">Fill out the essentials. You can always refine these later.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-300">Event name</label>
                  <input value={details.name} onChange={(e) => { setDetails((p) => ({ ...p, name: e.target.value })); setErrors((p) => ({ ...p, name: "" })); }}
                    className={`mt-1 w-full rounded-xl border bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 ${errors.name ? "border-red-500" : "border-white/20"}`} placeholder="Eg. Spring Fest Night Market" />
                  {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
                </div>
                <div>
                  <label className="text-xs text-slate-300">Description</label>
                  <textarea value={details.description} onChange={(e) => setDetails((p) => ({ ...p, description: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2" rows={4} placeholder="What makes this event special?" />
                </div>
                <div>
                  <label className="text-xs text-slate-300">Participant capacity</label>
                  <div className="mt-1 flex gap-2">
                    <button type="button" onClick={() => { setDetails((p) => ({ ...p, capacityUnlimited: !p.capacityUnlimited, capacity: "" })); setErrors((p) => ({ ...p, capacity: "" })); }}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${details.capacityUnlimited ? "border-indigo bg-indigo/20 text-indigo-200" : "border-white/20 bg-black/40 text-slate-400 hover:border-white/40"}`}>
                      <Infinity className="h-3 w-3" /> No limit
                    </button>
                    <input type="number" min="1" disabled={details.capacityUnlimited} value={details.capacity}
                      onChange={(e) => { setDetails((p) => ({ ...p, capacity: e.target.value })); setErrors((p) => ({ ...p, capacity: "" })); }}
                      placeholder={details.capacityUnlimited ? "Unlimited" : "e.g. 200"}
                      className={`flex-1 rounded-xl border bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 transition-opacity ${details.capacityUnlimited ? "opacity-30 cursor-not-allowed border-white/10" : errors.capacity ? "border-red-500" : "border-white/20"}`} />
                  </div>
                  {errors.capacity && <p className="mt-1 text-xs text-red-400">{errors.capacity}</p>}
                  <p className="mt-1 text-[10px] text-slate-500">{details.capacityUnlimited ? "No participant limit." : "Registrations close when limit is reached."}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-300">Start date & time</label>
                    <input type="datetime-local" value={details.startDate} onChange={(e) => { setDetails((p) => ({ ...p, startDate: e.target.value })); setErrors((p) => ({ ...p, startDate: "" })); }}
                      className={`mt-1 w-full rounded-xl border bg-black/40 px-3 py-2 text-xs text-slate-100 outline-none focus:ring-2 ${errors.startDate ? "border-red-500" : "border-white/20"}`} />
                    {errors.startDate && <p className="mt-1 text-xs text-red-400">{errors.startDate}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-slate-300">End date & time</label>
                    <input type="datetime-local" value={details.endDate} onChange={(e) => { setDetails((p) => ({ ...p, endDate: e.target.value })); setErrors((p) => ({ ...p, endDate: "" })); }}
                      className={`mt-1 w-full rounded-xl border bg-black/40 px-3 py-2 text-xs text-slate-100 outline-none focus:ring-2 ${errors.endDate ? "border-red-500" : "border-white/20"}`} />
                    {errors.endDate && <p className="mt-1 text-xs text-red-400">{errors.endDate}</p>}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-300">Venue</label>
                  <input value={details.venue} onChange={(e) => { setDetails((p) => ({ ...p, venue: e.target.value })); setErrors((p) => ({ ...p, venue: "" })); }}
                    className={`mt-1 w-full rounded-xl border bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 ${errors.venue ? "border-red-500" : "border-white/20"}`} placeholder="Eg. Central Quad" />
                  {errors.venue && <p className="mt-1 text-xs text-red-400">{errors.venue}</p>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-300">Expected headcount</label>
                    <input value={details.headcount} onChange={(e) => setDetails((p) => ({ ...p, headcount: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2" placeholder="Eg. 200" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300">Cover image</label>
                    <label className="mt-1 flex h-[38px] cursor-pointer items-center justify-between gap-2 rounded-xl border border-dashed border-slate-500/70 bg-black/40 px-3 text-xs text-slate-200 hover:border-emerald/70">
                      <div className="flex min-w-0 items-center gap-2">
                        {details.coverDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={details.coverDataUrl} alt="" className="h-6 w-6 flex-none rounded object-cover ring-1 ring-white/10" />
                        ) : null}
                        <span className="truncate">{details.coverName || "Upload (optional)"}</span>
                      </div>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">{details.coverName ? "Change" : "Browse"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) {
                            setDetails((p) => ({ ...p, coverName: undefined, coverDataUrl: undefined }));
                            return;
                          }
                          if (f.size > MAX_COVER_BYTES) {
                            setErrors((p) => ({ ...p, cover: `Image is too large (max ${MAX_COVER_BYTES / (1024 * 1024)} MB).` }));
                            return;
                          }
                          try {
                            const dataUrl = await readFileAsDataUrl(f);
                            setDetails((p) => ({ ...p, coverName: f.name, coverDataUrl: dataUrl }));
                            setErrors((p) => ({ ...p, cover: "" }));
                          } catch {
                            setErrors((p) => ({ ...p, cover: "Could not read the file." }));
                          }
                        }}
                      />
                    </label>
                    {errors.cover && <p className="mt-1 text-xs text-red-400">{errors.cover}</p>}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 4 - improved review */}
        {step === 4 && (
          <motion.div key="s4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="space-y-4">
            <div className="rounded-2xl border border-white/15 bg-black/40 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Review event</h2>
                  <p className="mt-0.5 text-xs text-slate-400">Confirm the key details before creating.</p>
                </div>
                {selectedType && <span className="rounded-full bg-indigo/20 px-3 py-1 text-[11px] font-semibold text-indigo-200 ring-1 ring-indigo/30">{selectedType.label}</span>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { label: "Event name", value: details.name || "—" },
                  { label: "Venue",      value: details.venue || "—" },
                  { label: "Capacity",   value: details.capacityUnlimited ? "No limit ∞" : `${details.capacity} participants max` },
                  { label: "Starts",     value: formatDateTime(details.startDate) },
                  { label: "Ends",       value: formatDateTime(details.endDate) },
                  { label: "Headcount",  value: details.headcount || "—" },
                  { label: "Cover",      value: details.coverName || "Not uploaded" },
                  { label: "Description", value: details.description || "—", wide: true },
                ].map((item) => (
                  <div key={item.label} className={`rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/[0.08] ${ (item as any).wide ? "sm:col-span-2 lg:col-span-3" : ""}`}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{item.label}</p>
                    <p className="mt-1 text-sm text-slate-100">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-black/40 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Checklist</h3>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tasks.filter(t => t.done).length === tasks.length ? "bg-emerald/20 text-emerald" : "bg-white/8 text-slate-400"}`}>
                  {tasks.filter(t => t.done).length} / {tasks.length} ready
                </span>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {tasks.map((task) => (
                  <div key={task.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ring-1 ${task.done ? "bg-emerald/8 ring-emerald/20 text-emerald" : "bg-navy/60 ring-white/8 text-slate-400"}`}>
                    <span className={`h-1.5 w-1.5 flex-none rounded-full ${task.done ? "bg-emerald" : "bg-slate-600"}`} />
                    <span>{task.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Footer */}
      <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-3 sm:flex-row">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <CalendarRange className="h-3.5 w-3.5 text-indigo/80" />
          Your progress is stored locally until you create the event.
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-black/30 px-3 py-1.5 text-[11px] font-medium text-slate-100 disabled:opacity-40">
            Back
          </button>
          {step > 1 && (
            <button type="button" onClick={handleNext} disabled={!canGoNext || isSubmitting}
              className="inline-flex items-center justify-center rounded-full bg-indigo px-4 py-1.5 text-[11px] font-semibold text-white shadow-[0_8px_24px_rgba(79,70,229,0.5)] ring-1 ring-indigo/60 disabled:opacity-40">
              {step === 4 ? (isSubmitting ? "Creating..." : "Create event") : "Next"}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showToast && (
          <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-emerald-500 px-6 py-4 text-sm font-semibold text-navy shadow-[0_20px_60px_rgba(16,185,129,0.4)]">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600">
              <svg className="h-4 w-4 text-emerald-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <div className="font-semibold">Event created successfully!</div>
              <div className="text-xs text-emerald-700">Redirecting to events...</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}