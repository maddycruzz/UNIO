"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GitBranch, Lock, CheckCircle2, X, ChevronDown, Plus } from "lucide-react";
import { loadTasks, loadTaskDependencies, addTaskDependency, removeTaskDependency, isTaskUnblocked, getEventById } from "@/lib/db";
import type { UnioTask, TaskDependencyEdge } from "@/lib/store";
import { useCan } from "@/lib/permissions";
import { useToast } from "@/components/ui/Toast";

interface Props { eventId: string }

export function DependenciesPanel({ eventId }: Props) {
  const canEdit = useCan("tasks.set_deps");
  const toast = useToast();
  const [tasks, setTasks] = useState<UnioTask[]>([]);
  const [eventName, setEventName] = useState<string>("");
  const [deps, setDeps] = useState<TaskDependencyEdge[]>([]);
  const [adding, setAdding] = useState<string | null>(null); // task id we're adding a dep to
  const [pickerValue, setPickerValue] = useState("");

  const refresh = useCallback(async () => {
    const [allTasks, ev, allDeps] = await Promise.all([
      loadTasks(),
      getEventById(eventId),
      loadTaskDependencies(),
    ]);
    const evName = ev?.name ?? "";
    setEventName(evName);
    setTasks(allTasks.filter((t) => t.event === evName));
    const taskIds = new Set(allTasks.filter((t) => t.event === evName).map((t) => t.id));
    setDeps(allDeps.filter((d) => taskIds.has(d.taskId) && taskIds.has(d.dependsOnTaskId)));
  }, [eventId]);

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("unio-store-change", h);
    return () => window.removeEventListener("unio-store-change", h);
  }, [refresh]);

  const depMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const e of deps) {
      if (!map.has(e.taskId)) map.set(e.taskId, []);
      map.get(e.taskId)!.push(e.dependsOnTaskId);
    }
    return map;
  }, [deps]);

  const onAdd = async (taskId: string) => {
    if (!pickerValue || pickerValue === taskId) return;
    // Avoid cycle: don't allow A → B if B already depends on A.
    if ((depMap.get(pickerValue) ?? []).includes(taskId)) {
      toast.error("That would create a circular dependency.");
      return;
    }
    await addTaskDependency({ taskId, dependsOnTaskId: pickerValue });
    setAdding(null);
    setPickerValue("");
    await refresh();
  };

  const onRemove = async (edge: TaskDependencyEdge) => {
    await removeTaskDependency(edge);
    await refresh();
  };

  if (tasks.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-navy/60 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <GitBranch className="h-4 w-4 text-amber-300" /> Task dependencies
        </h3>
        <p className="mt-2 rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-4 text-center text-[11px] text-slate-500">
          Add tasks to {eventName || "this event"} first, then chain them.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-navy/60 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
        <GitBranch className="h-4 w-4 text-amber-300" /> Task dependencies
      </h3>
      <p className="mt-1 text-[11px] text-slate-400">A task stays locked until everything it depends on is done.</p>

      <ul className="mt-3 space-y-1">
        {tasks.map((t) => {
          const parents = depMap.get(t.id) ?? [];
          const unblocked = isTaskUnblocked(t.id, tasks, deps);
          const isDone = t.status === "done";
          const candidates = tasks.filter(
            (c) => c.id !== t.id && !parents.includes(c.id)
          );
          return (
            <li key={t.id} className="rounded-lg bg-black/40 px-3 py-2 text-[11px]">
              <div className="flex items-center gap-2">
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                ) : !unblocked ? (
                  <Lock className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-slate-500" />
                )}
                <span className={`flex-1 truncate ${unblocked || isDone ? "text-slate-100" : "text-slate-400"}`}>{t.title}</span>
                {parents.length > 0 && (
                  <span className="text-[10px] text-slate-500">{parents.length} blocker{parents.length === 1 ? "" : "s"}</span>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => { setAdding(adding === t.id ? null : t.id); setPickerValue(""); }}
                    className="rounded-full p-1 text-slate-400 hover:bg-white/10"
                  >
                    {adding === t.id ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  </button>
                )}
              </div>

              {parents.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 pl-5">
                  {parents.map((pid) => {
                    const parent = tasks.find((tt) => tt.id === pid);
                    if (!parent) return null;
                    return (
                      <li key={pid} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <span>↳ depends on</span>
                        <span className={parent.status === "done" ? "text-emerald-300" : "text-slate-300"}>{parent.title}</span>
                        {parent.status === "done" && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-300" />}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => onRemove({ taskId: t.id, dependsOnTaskId: pid })}
                            className="rounded p-0.5 text-slate-500 hover:bg-white/10 hover:text-rose-300"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {adding === t.id && canEdit && candidates.length > 0 && (
                <div className="mt-2 flex items-center gap-2 pl-5">
                  <div className="relative flex-1">
                    <select
                      value={pickerValue}
                      onChange={(e) => setPickerValue(e.target.value)}
                      className="w-full appearance-none rounded-md border border-white/10 bg-black/40 px-2 py-1 pr-6 text-[11px] text-white outline-none"
                    >
                      <option value="">Block this task by…</option>
                      {candidates.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
                  </div>
                  <button
                    type="button"
                    onClick={() => onAdd(t.id)}
                    disabled={!pickerValue}
                    className="rounded-full bg-indigo-500 px-2.5 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
                  >
                    Link
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
