"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  motion,
  useInView,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import {
  CalendarRange,
  CheckSquare,
  Users,
  Video,
  ArrowRight,
  Sparkles,
  Wand2,
  FileBadge2,
  GripVertical,
  X,
  ArrowLeftRight,
} from "lucide-react";
import { formatRelativeTime, type ActivityItem, type UnioEvent } from "@/lib/store";
import {
  getDashboardStats,
  loadActivity,
  getUpcomingEvents,
} from "@/lib/db";
import { useAuth } from "@/lib/auth";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type WidgetId =
  | "stats"
  | "quick-actions"
  | "recent-activity"
  | "upcoming-events";

type WidgetConfig = {
  id: WidgetId;
  width: "full" | "half";
};

const ALL_WIDGETS: { id: WidgetId; label: string }[] = [
  { id: "stats", label: "Stat cards" },
  { id: "quick-actions", label: "Quick actions" },
  { id: "recent-activity", label: "Recent activity" },
  { id: "upcoming-events", label: "Upcoming events" },
];

const DEFAULT_LAYOUT: WidgetConfig[] = [
  { id: "stats", width: "full" },
  { id: "quick-actions", width: "full" },
  { id: "recent-activity", width: "full" },
  { id: "upcoming-events", width: "half" },
];

const LAYOUT_STORAGE_KEY = "unio-dashboard-layout-v1";

const STAT_ICONS = [CalendarRange, CheckSquare, Users, Video];
const STAT_LABELS = ["Total Events", "Active Tasks", "Participants", "Upcoming Meetings"] as const;

const PARTICLES = new Array(16).fill(0).map((_, i) => ({
  id: i,
  size: 3 + (i % 4),
}));

function useTypewriter(text: string, enabled: boolean, delay = 40) {
  const [displayed, setDisplayed] = useState(enabled ? "" : text);

  useEffect(() => {
    if (!enabled) {
      setDisplayed(text);
      return;
    }
    let frame: number;
    let index = 0;

    const step = () => {
      index += 1;
      setDisplayed(text.slice(0, index));
      if (index < text.length) {
        frame = window.setTimeout(step, delay);
      }
    };

    frame = window.setTimeout(step, 220);
    return () => window.clearTimeout(frame);
  }, [text, enabled, delay]);

  return displayed;
}

function StatCard({
  label,
  value,
  suffix,
  Icon,
  index,
}: {
  label: string;
  value: number;
  suffix?: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  index: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start: number | null = null;
    const duration = 800;
    const startValue = 0;
    const endValue = value;

    const tick = (timestamp: number) => {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startValue + (endValue - startValue) * eased));
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value]);

  const sparklinePoints = useMemo(
    () =>
      [
        [0, 16],
        [6, 10],
        [12, 13],
        [18, 7],
        [24, 11],
        [30, 6],
        [36, 9],
        [42, 4],
      ]
        .map(([x, y]) => `${x},${y}`)
        .join(" "),
    []
  );

  const delay = 0.08 + index * 0.06;

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.4, delay }}
      className="group relative overflow-hidden rounded-2xl border border-indigo/40 bg-white/[0.02] p-4 shadow-[0_18px_45px_rgba(15,17,23,0.9)] backdrop-blur-sm"
    >
      <div className="pointer-events-none absolute inset-px rounded-[14px] bg-[radial-gradient(circle_at_0_0,rgba(99,102,241,0.36),transparent_52%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.26),transparent_55%)] opacity-40 transition-opacity duration-500 group-hover:opacity-70" />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-300/80">{label}</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-semibold text-white tabular-nums">
              {display.toLocaleString()}
            </span>
            {suffix ? (
              <span className="text-[11px] text-slate-400">{suffix}</span>
            ) : null}
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-1 rounded-xl bg-indigo/35 blur-lg opacity-40 group-hover:opacity-80" />
          <div className="relative grid h-8 w-8 place-items-center rounded-xl bg-[#050716] text-indigo">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </div>

      <div className="relative mt-4 h-8">
        <svg
          viewBox="0 0 44 20"
          className="h-full w-full text-indigo/70"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient
              id={`spark-${label}`}
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="60%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
          </defs>
          <polyline
            fill="none"
            stroke={`url(#spark-${label})`}
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={sparklinePoints}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.25)_35%,rgba(255,255,255,0)_70%)] opacity-0 transition-all duration-700 group-hover:translate-x-6 group-hover:opacity-60" />
      </div>
    </motion.div>
  );
}

type SortableWidgetProps = {
  config: WidgetConfig;
  editMode: boolean;
  children: React.ReactNode;
  onHide: () => void;
  onToggleWidth: () => void;
};

function SortableWidget({
  config,
  editMode,
  children,
  onHide,
  onToggleWidth,
}: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: config.id,
    disabled: !editMode,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 40 : undefined,
  };

  const widthClass =
    config.width === "full" ? "lg:col-span-2" : "lg:col-span-1";

  return (
    <motion.section
      layout
      ref={setNodeRef}
      style={style}
      className={`${widthClass} relative`}
    >
      <div className="h-full">
        {editMode && (
          <div className="mb-2 flex items-center justify-between text-[11px] text-slate-200/80">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-[10px] ring-1 ring-white/20"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-3 w-3 text-slate-400" />
              Drag
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleWidth}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-slate-200 ring-1 ring-white/20 hover:bg-black/60"
                aria-label="Toggle width"
              >
                <ArrowLeftRight className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={onHide}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-slate-200 ring-1 ring-white/20 hover:bg-black/60"
                aria-label="Hide widget"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
        {children}
      </div>
    </motion.section>
  );
}

export default function DashboardHome() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  // Live data from store
  const { user } = useAuth();

  // Role-based routing
  useEffect(() => {
    if (user?.role === "developer") {
      router.push("/admin");
    } else if (user?.role === "mate") {
      router.push("/dashboard/my-work");
    }
  }, [user, router]);
  const [stats, setStats] = useState({ totalEvents: 0, activeTasks: 0, totalParticipants: 0, upcomingMeetings: 0 });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [upcoming, setUpcoming] = useState<UnioEvent[]>([]);

  useEffect(() => {
    const refresh = async () => {
      const [s, a, u] = await Promise.all([
        getDashboardStats(),
        loadActivity(),
        getUpcomingEvents(),
      ]);
      setStats(s);
      setActivity(a.slice(0, 3));
      setUpcoming(u);
    };
    refresh();
    // Re-fetch when any page mutates data
    const handler = () => refresh();
    window.addEventListener("unio-store-change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("unio-store-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const STATS = [
    { label: "Total Events" as const, value: stats.totalEvents, suffix: "", icon: CalendarRange },
    { label: "Active Tasks" as const, value: stats.activeTasks, suffix: "", icon: CheckSquare },
    { label: "Participants" as const, value: stats.totalParticipants, suffix: "", icon: Users },
    { label: "Upcoming Meetings" as const, value: stats.upcomingMeetings, suffix: "", icon: Video },
  ];

  const titleText = `Welcome back, ${user?.name?.split(" ")[0] ?? "there"}`;
  const typedTitle = useTypewriter(titleText, !prefersReducedMotion);
  const [layout, setLayout] = useState<WidgetConfig[]>(DEFAULT_LAYOUT);
  const [hidden, setHidden] = useState<WidgetId[]>([]);
  const [editMode, setEditMode] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as {
        layout?: WidgetConfig[];
        hidden?: WidgetId[];
      };
      if (parsed.layout && Array.isArray(parsed.layout)) {
        const validIds = new Set<WidgetId>(ALL_WIDGETS.map((w) => w.id));
        const filteredLayout = parsed.layout.filter((w) =>
          validIds.has(w.id)
        );
        if (filteredLayout.length) {
          setLayout(filteredLayout);
        }
      }
      if (parsed.hidden && Array.isArray(parsed.hidden)) {
        setHidden(parsed.hidden);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = JSON.stringify({ layout, hidden });
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, payload);
  }, [layout, hidden]);

  const heroVariants: Variants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 22 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.21, 0.8, 0.32, 1] },
    },
  };

  const visibleLayout = layout.filter(
    (item) => !hidden.includes(item.id as WidgetId)
  );

  const hiddenWidgets = ALL_WIDGETS.filter((w) => hidden.includes(w.id));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLayout((items) => {
      const oldIndex = items.findIndex((w) => w.id === active.id);
      const newIndex = items.findIndex((w) => w.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleHideWidget = (id: WidgetId) => {
    setHidden((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleToggleWidth = (id: WidgetId) => {
    setLayout((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              width: item.width === "full" ? "half" : "full",
            }
          : item
      )
    );
  };

  const handleResetLayout = () => {
    setLayout(DEFAULT_LAYOUT);
    setHidden([]);
  };

  const renderWidget = (id: WidgetId) => {
    if (id === "stats") {
      return (
        <motion.section
          layout
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{
            duration: 0.45,
            ease: [0.25, 0.8, 0.3, 1],
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          {STATS.map((stat, index) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              suffix={stat.suffix}
              Icon={stat.icon}
              index={index}
            />
          ))}
        </motion.section>
      );
    }

    if (id === "quick-actions") {
      return (
        <motion.section
          layout
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{
            duration: 0.45,
            ease: [0.25, 0.8, 0.3, 1],
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          {[
            {
              label: "Create Event",
              description:
                "Launch a new campus event with RSVPs and check-ins.",
              gradient:
                "from-indigo-500/80 via-violet-500/80 to-sky-400/80",
              icon: CalendarRange,
              href: "/dashboard/events/new",
            },
            {
              label: "Add Task",
              description: "Track preparation tasks, owners, and due dates.",
              gradient:
                "from-emerald-500/80 via-teal-400/80 to-cyan-400/80",
              icon: CheckSquare,
              href: "/dashboard/tasks",
            },
            {
              label: "Schedule Meeting",
              description: "Align organizers, faculty, and partners quickly.",
              gradient:
                "from-purple-500/80 via-fuchsia-500/80 to-rose-400/80",
              icon: Video,
              href: "/dashboard/meetings",
            },
            {
              label: "Generate Certificate",
              description: "Issue verified certificates in a few clicks.",
              gradient:
                "from-amber-400/90 via-orange-500/80 to-rose-500/80",
              icon: FileBadge2,
              href: "/dashboard/certificates",
            },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.label}
                layout
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className="group relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.02] p-4 text-left shadow-[0_20px_55px_rgba(15,17,23,0.95)] backdrop-blur-sm"
                type="button"
                onClick={() => router.push(action.href)}
              >
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-60 transition-opacity duration-500 group-hover:opacity-90`}
                />
                <div className="relative flex h-full flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-100/80">
                      <span className="h-1 w-1 rounded-full bg-white/90" />
                      Action
                    </div>
                    <motion.div
                      whileHover={{
                        y: -3,
                      }}
                      className="grid h-9 w-9 place-items-center rounded-xl bg-black/25 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.4)]"
                    >
                      <Icon className="h-4 w-4" />
                    </motion.div>
                  </div>
                  <div className="mt-4 space-y-1.5">
                    <div className="text-sm font-semibold text-white">
                      {action.label}
                    </div>
                    <p className="text-xs text-slate-50/90">
                      {action.description}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[11px] font-medium text-slate-100">
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald shadow-[0_0_0_4px_rgba(16,185,129,0.55)]" />
                      Ready
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px]">
                      <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/30">
                        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1.5" />
                      </span>
                    </span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </motion.section>
      );
    }

    if (id === "recent-activity") {
      return (
        <motion.section
          layout
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{
            duration: 0.45,
            ease: [0.25, 0.8, 0.3, 1],
          }}
          className="rounded-3xl border border-white/10 bg-black/35 p-4 sm:p-5 shadow-[0_20px_60px_rgba(15,17,23,0.9)]"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Recent activity
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Slide-in updates across your events, tasks, and meetings.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-[11px] font-medium text-slate-200 ring-1 ring-white/10 hover:bg-white/10"
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <motion.ul
            layout
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.08, delayChildren: 0.12 },
              },
            }}
            className="mt-4 space-y-3"
          >
            {activity.map((item) => (
              <motion.li
                key={item.id}
                layout
                variants={{
                  hidden: { opacity: 0, x: 40 },
                  visible: {
                    opacity: 1,
                    x: 0,
                    transition: {
                      duration: 0.45,
                      ease: [0.25, 0.8, 0.3, 1],
                    },
                  },
                }}
                className="group relative flex items-start gap-3 rounded-2xl bg-gradient-to-r from-emerald/25 via-navy/90 to-transparent px-3 py-3 ring-1 ring-white/5 transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(15,23,42,0.9)]"
              >
                <div className="absolute inset-y-1 left-1 w-[2px] rounded-full bg-gradient-to-b from-emerald to-indigo animate-pulse" />
                <div className="ml-4">
                  <p className="text-sm text-slate-100">{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {item.meta}
                  </p>
                </div>
                <div className="ml-auto text-right text-[11px] text-slate-500">
                  {formatRelativeTime(item.timestamp)}
                </div>
              </motion.li>
            ))}
          </motion.ul>
        </motion.section>
      );
    }

    if (id === "upcoming-events") {
      return (
        <motion.section
          layout
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{
            duration: 0.45,
            ease: [0.25, 0.8, 0.3, 1],
          }}
          className="rounded-3xl border border-white/10 bg-black/35 p-4 sm:p-5 shadow-[0_20px_60px_rgba(15,17,23,0.9)]"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Upcoming events
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                What&apos;s next on the calendar.
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo/20 text-indigo shadow-[0_0_0_1px_rgba(129,140,248,0.7)]">
              <CalendarRange className="h-4 w-4" />
            </div>
          </div>

          <motion.ul
            layout
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.08, delayChildren: 0.14 },
              },
            }}
            className="mt-4 space-y-3 text-sm"
          >
            {upcoming.map((event) => (
              <motion.li
                key={event.id}
                layout
                variants={{
                  hidden: { opacity: 0, scale: 0.96, y: 18 },
                  visible: {
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    transition: {
                      duration: 0.4,
                      ease: [0.25, 0.8, 0.3, 1],
                    },
                  },
                }}
                className="group relative overflow-hidden rounded-2xl bg-navy/80 px-3 py-3 ring-1 ring-white/8 transition-transform duration-300 hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-[0_18px_55px_rgba(15,23,42,0.95)] cursor-pointer"
                onClick={() => router.push(`/dashboard/events/${event.id}`)}
              >
                <div className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-indigo via-purple-400 to-emerald" />
                <div className="ml-3 flex items-start gap-3">
                  <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo/20 text-indigo">
                    <Video className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-100">{event.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {event.venue}
                    </p>
                    <div className="mt-2 inline-flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-indigo/20 px-2.5 py-1 text-[11px] font-medium text-indigo shadow-[0_0_0_1px_rgba(129,140,248,0.6)]">
                        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-indigo shadow-[0_0_0_4px_rgba(129,140,248,0.55)]" />
                        {event.date}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-emerald/15 px-2.5 py-1 text-[11px] font-medium text-emerald ring-1 ring-emerald/25">
                        {event.type}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.li>
            ))}          </motion.ul>
        </motion.section>
      );
    }

    return null;
  };

  return (
    <div className="relative min-h-full scroll-smooth text-slate-100">
      {/* animated gradient mesh background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <motion.div
          className="absolute -top-40 left-[-10%] h-80 w-80 rounded-[999px] bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.9),transparent_65%)] blur-3xl"
          animate={{
            x: ["0%", "12%", "-6%", "0%"],
            y: ["0%", "18%", "6%", "0%"],
          }}
          transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute -bottom-40 right-[-10%] h-96 w-96 rounded-[999px] bg-[radial-gradient(circle_at_60%_20%,rgba(16,185,129,0.95),transparent_60%)] blur-3xl"
          animate={{
            x: ["0%", "-10%", "8%", "0%"],
            y: ["0%", "-14%", "8%", "0%"],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute top-1/3 left-1/2 h-72 w-72 -translate-x-1/2 rounded-[999px] bg-[radial-gradient(circle_at_30%_20%,rgba(129,140,248,0.8),transparent_65%)] blur-2xl"
          animate={{
            x: ["-10%", "4%", "-6%", "-10%"],
            y: ["0%", "-12%", "6%", "0%"],
          }}
          transition={{ duration: 34, repeat: Infinity, ease: "linear" }}
        />

        {/* subtle grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30" />

        {/* floating particles */}
        {PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-white/35"
            style={{
              width: p.size,
              height: p.size,
              top: `${(p.id * 17) % 100}%`,
              left: `${(p.id * 37) % 100}%`,
            }}
            animate={{
              x: ["-6%", "4%", "-3%"],
              y: ["-4%", "8%", "-2%"],
              opacity: [0.1, 0.6, 0.2],
            }}
            transition={{
              duration: 22 + (p.id % 7),
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <div className="space-y-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            Dashboard overview
          </div>
          {!editMode && (
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-4 py-1.5 text-[11px] font-medium text-slate-100 backdrop-blur hover:bg-black/60"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo" />
              Customize dashboard
            </button>
          )}
        </div>

        {editMode && (
          <motion.div
            layout
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 flex flex-col gap-3 rounded-2xl border border-purple-400/40 bg-gradient-to-r from-purple-500/30 via-indigo-500/30 to-emerald-500/20 px-4 py-3 text-xs text-slate-100 shadow-[0_18px_50px_rgba(15,17,23,0.9)] sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/30 text-[11px]">
                ✦
              </span>
              <div>
                <div className="font-semibold">
                  Edit Mode – Drag to rearrange, resize, or hide widgets
                </div>
                <p className="mt-1 text-[11px] text-slate-100/80">
                  Changes are saved to this browser. You can always reset back
                  to the default layout.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hiddenWidgets.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-100/80">
                    Add widget:
                  </span>
                  <select
                    className="rounded-full border border-white/25 bg-black/25 px-3 py-1 text-[11px] text-slate-100"
                    defaultValue=""
                    onChange={(e) => {
                      const value = e.target.value as WidgetId | "";
                      if (!value) return;
                      setHidden((prev) => prev.filter((id) => id !== value));
                      e.target.value = "";
                    }}
                  >
                    <option value="">Select…</option>
                    {hiddenWidgets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                type="button"
                onClick={handleResetLayout}
                className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/30 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-black/50"
              >
                Reset layout
              </button>
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-semibold text-navy shadow-[0_14px_40px_rgba(15,23,42,0.9)]"
              >
                Done
              </button>
            </div>
          </motion.div>
        )}

        {/* HERO */}
        <motion.section
          layout
          variants={heroVariants}
          initial="hidden"
          animate="visible"
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_0%_0%,rgba(129,140,248,0.35),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.3),transparent_60%)] p-5 shadow-[0_22px_60px_rgba(15,17,23,0.9)] sm:p-7"
        >
          <motion.div
            aria-hidden
            className="absolute inset-0"
            animate={{
              background: [
                "radial-gradient(circle at 0% 0%, rgba(99,102,241,0.8), transparent 60%), radial-gradient(circle at 100% 100%, rgba(147,51,234,0.75), transparent 60%)",
                "radial-gradient(circle at 0% 0%, rgba(76,81,191,0.8), transparent 60%), radial-gradient(circle at 100% 100%, rgba(16,185,129,0.8), transparent 60%)",
                "radial-gradient(circle at 0% 0%, rgba(129,140,248,0.85), transparent 60%), radial-gradient(circle at 100% 100%, rgba(16,185,129,0.9), transparent 60%)",
              ],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              repeatType: "reverse",
            }}
          />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-black/25 px-3 py-1 text-[11px] font-medium text-slate-100 ring-1 ring-white/20 backdrop-blur">
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald shadow-[0_0_0_3px_rgba(16,185,129,0.4)]" />
                Live overview · Campus events
              </div>

              <div className="mt-4 text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                <span className="relative inline-flex">
                  <span>{typedTitle}</span>
                  {!prefersReducedMotion && (
                    <span className="ml-[2px] inline-block h-6 w-[2px] translate-y-[2px] animate-pulse bg-white/90 align-middle sm:h-7" />
                  )}
                </span>
              </div>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.45 }}
                className="mt-3 max-w-xl text-sm leading-7 text-slate-100/80 sm:text-[15px]"
              >
                Your events, tasks, meetings, and participants are orchestrated
                in one place. Ship better experiences with live insights and
                effortless coordination.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.45 }}
                className="mt-5 flex flex-wrap items-center gap-3"
              >
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  className="inline-flex items-center justify-center rounded-full bg-indigo px-6 py-2.5 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(79,70,229,0.8)] ring-1 ring-indigo/60"
                >
                  <Sparkles className="mr-2 h-4 w-4 text-white" />
                  Go to today&apos;s events
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  className="group inline-flex items-center justify-center rounded-full border border-white/40 bg-black/20 px-5 py-2.5 text-sm font-medium text-slate-100/90 backdrop-blur"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Wand2 className="h-4 w-4 text-emerald" />
                    Quick actions
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </motion.button>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ delay: 0.6, duration: 0.55, type: "spring" }}
              className="relative mx-auto mt-2 h-40 w-40 sm:mt-0 sm:h-48 sm:w-48"
            >
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.95),transparent_58%)] opacity-90" />
              <div className="absolute inset-[18%] rounded-full bg-[conic-gradient(from_220deg,rgba(99,102,241,0.4),rgba(16,185,129,0.7),rgba(129,140,248,0.6),rgba(99,102,241,0.4))] blur-[2px]" />
              <motion.div
                className="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-navy text-xs font-semibold text-slate-100 shadow-[0_0_0_6px_rgba(99,102,241,0.45)]"
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
              >
                Live
              </motion.div>
              <div className="absolute inset-0 rounded-full border border-white/60 opacity-40" />
              <div className="absolute inset-4 rounded-full border border-white/40 opacity-40" />
            </motion.div>
          </div>
        </motion.section>

        {/* WIDGET BOARD */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={visibleLayout.map((item) => item.id)}
            strategy={rectSortingStrategy}
          >
            <motion.div
              layout
              className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-2"
            >
              {visibleLayout.map((item) => (
                <SortableWidget
                  key={item.id}
                  config={item}
                  editMode={editMode}
                  onHide={() => handleHideWidget(item.id)}
                  onToggleWidth={() => handleToggleWidth(item.id)}
                >
                  {renderWidget(item.id)}
                </SortableWidget>
              ))}
            </motion.div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

