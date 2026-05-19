"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Check, X, Loader2, Clock } from "lucide-react";
import { loadApprovals, reviewApproval } from "@/lib/db";
import type { UnioApprovalRequest } from "@/lib/store";
import { useCan } from "@/lib/permissions";
import { formatRelativeTime } from "@/lib/store";
import { useToast } from "@/components/ui/Toast";

const KIND_LABEL: Record<UnioApprovalRequest["kind"], string> = {
  event_create:   "Create event",
  event_update:   "Update event",
  event_delete:   "Delete event",
  task_create:    "Create task",
  task_delete:    "Delete task",
  budget_change:  "Budget change",
  sponsor_change: "Sponsor change",
  generic:        "Request",
};

export default function ApprovalsPage() {
  const canReview = useCan("approvals.review");
  const toast = useToast();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [items, setItems] = useState<UnioApprovalRequest[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setItems(await loadApprovals(tab));
  }, [tab]);

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("unio-store-change", h);
    return () => window.removeEventListener("unio-store-change", h);
  }, [refresh]);

  const onDecide = async (id: string, decision: "approved" | "rejected") => {
    setBusyId(id);
    try {
      await reviewApproval({ id, decision });
      await refresh();
      toast.success(decision === "approved" ? "Request approved." : "Request rejected.");
    } catch (e) {
      toast.error(`Failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 text-slate-100">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-white">
          <ShieldCheck className="h-5 w-5 text-emerald-300" /> Approvals
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Sensitive actions wait here for a president or developer to approve.
        </p>
      </div>

      <div className="inline-flex gap-1 rounded-full border border-white/10 bg-black/40 p-1">
        {(["pending", "approved", "rejected"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition ${
              tab === t ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {items === null ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/30 p-10 text-center text-sm text-slate-500">
          {tab === "pending" ? "No pending requests." : `No ${tab} requests yet.`}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li key={a.id} className="rounded-xl border border-white/10 bg-black/40 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-500/20 text-indigo-200">
                  <Clock className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">{KIND_LABEL[a.kind] ?? a.kind}</div>
                  <div className="text-[11px] text-slate-400">
                    {a.requesterName ?? "Someone"} · {formatRelativeTime(new Date(a.createdAt).getTime())}
                  </div>
                  {Object.keys(a.payload).length > 0 && (
                    <pre className="mt-2 max-h-32 overflow-auto rounded bg-black/40 p-2 text-[10px] text-slate-300">
                      {JSON.stringify(a.payload, null, 2)}
                    </pre>
                  )}
                  {a.reviewerNote && <p className="mt-2 text-[11px] text-slate-400 italic">&quot;{a.reviewerNote}&quot;</p>}
                </div>
                {a.status === "pending" && canReview && (
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => onDecide(a.id, "approved")}
                      disabled={busyId === a.id}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-400/40 hover:bg-emerald-500/30 disabled:opacity-50"
                    >
                      {busyId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => onDecide(a.id, "rejected")}
                      disabled={busyId === a.id}
                      className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-400/30 hover:bg-rose-500/25 disabled:opacity-50"
                    >
                      <X className="h-3 w-3" /> Reject
                    </button>
                  </div>
                )}
                {a.status !== "pending" && (
                  <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                    a.status === "approved" ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/15 text-rose-300"
                  }`}>{a.status}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
