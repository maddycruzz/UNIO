"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, RotateCcw, AlertTriangle, Loader2, Calendar, ListChecks, Video } from "lucide-react";
import { loadTrash, restoreFromTrash, purgeFromTrash, type TrashEntry } from "@/lib/db";
import { useCan } from "@/lib/permissions";

const ICON_FOR = {
  event:   Calendar,
  task:    ListChecks,
  meeting: Video,
} as const;

export default function TrashPage() {
  const canRestore = useCan("trash.restore");
  const canView = useCan("trash.view");
  const [items, setItems] = useState<TrashEntry[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setItems(await loadTrash());
  }, []);

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("unio-store-change", h);
    return () => window.removeEventListener("unio-store-change", h);
  }, [refresh]);

  if (!canView) {
    return (
      <div className="p-8 text-slate-200">
        <h1 className="text-2xl font-bold text-white">Access denied</h1>
        <p className="mt-2 text-slate-400">Only presidents and developers can review the trash.</p>
      </div>
    );
  }

  const onRestore = async (e: TrashEntry) => {
    setBusyId(e.id);
    await restoreFromTrash(e.kind, e.id);
    setBusyId(null);
    await refresh();
  };

  const onPurge = async (e: TrashEntry) => {
    if (!confirm(`Permanently delete "${e.title}"? This cannot be undone.`)) return;
    setBusyId(e.id);
    await purgeFromTrash(e.kind, e.id);
    setBusyId(null);
    await refresh();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 text-slate-100">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-white">
          <Trash2 className="h-5 w-5 text-rose-300" /> Recently deleted
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Soft-deleted events, tasks, and meetings. Restore them or delete them forever.
        </p>
      </div>

      {items === null ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/30 p-10 text-center text-sm text-slate-500">
          The trash is empty.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((e) => {
            const Icon = ICON_FOR[e.kind];
            return (
              <li
                key={`${e.kind}:${e.id}`}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 text-slate-300">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{e.title}</div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">
                    {e.kind} · deleted {new Date(e.deletedAt).toLocaleString()}
                  </div>
                </div>
                {canRestore && (
                  <button
                    type="button"
                    onClick={() => onRestore(e)}
                    disabled={busyId === e.id}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-400/40 hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    {busyId === e.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Restore
                  </button>
                )}
                {canRestore && (
                  <button
                    type="button"
                    onClick={() => onPurge(e)}
                    disabled={busyId === e.id}
                    className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-3 py-1 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-400/30 hover:bg-rose-500/25 disabled:opacity-50"
                  >
                    <AlertTriangle className="h-3 w-3" /> Forever
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
