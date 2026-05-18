"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet, Plus, Trash2, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { loadBudgetEntries, addBudgetEntry, deleteBudgetEntry } from "@/lib/db";
import type { UnioBudgetEntry, BudgetKind } from "@/lib/store";
import { useCan } from "@/lib/permissions";

interface Props { eventId: string }

const CATEGORIES = ["Venue", "Food", "Marketing", "Equipment", "Logistics", "Speakers", "Travel", "Other"];

function fmt(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}

export function BudgetPanel({ eventId }: Props) {
  const canEdit = useCan("budgets.edit");
  const [entries, setEntries] = useState<UnioBudgetEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ kind: BudgetKind; category: string; label: string; amount: string; notes: string }>({
    kind: "expense", category: "Other", label: "", amount: "", notes: "",
  });

  const refresh = useCallback(async () => setEntries(await loadBudgetEntries(eventId)), [eventId]);

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("unio-store-change", h);
    return () => window.removeEventListener("unio-store-change", h);
  }, [refresh]);

  const income = entries.filter((e) => e.kind === "income").reduce((s, e) => s + e.amount, 0);
  const expense = entries.filter((e) => e.kind === "expense").reduce((s, e) => s + e.amount, 0);
  const net = income - expense;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim() || !form.amount) return;
    setBusy(true);
    await addBudgetEntry({
      eventId,
      kind: form.kind,
      category: form.category,
      label: form.label,
      amount: Number(form.amount),
      notes: form.notes,
    });
    setForm({ kind: form.kind, category: "Other", label: "", amount: "", notes: "" });
    setOpen(false);
    setBusy(false);
    await refresh();
  };

  const onDelete = async (id: string) => {
    await deleteBudgetEntry(id);
    await refresh();
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-navy/60 p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Wallet className="h-4 w-4 text-emerald-300" /> Budget
        </h3>
        {canEdit && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/15"
          >
            <Plus className="h-3 w-3" /> {open ? "Close" : "Add"}
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <Stat label="Income"  value={fmt(income)}  color="#10B981" icon={TrendingUp} />
        <Stat label="Expense" value={fmt(expense)} color="#F87171" icon={TrendingDown} />
        <Stat label="Net"     value={fmt(net)}     color={net >= 0 ? "#10B981" : "#F87171"} icon={Wallet} />
      </div>

      {open && canEdit && (
        <form onSubmit={submit} className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as BudgetKind })}
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <input
            required
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="Label (e.g., Stage rental)"
            className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-400/60"
          />
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="Amount"
            className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-400/60"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Save
          </button>
        </form>
      )}

      {entries.length > 0 && (
        <ul className="mt-3 max-h-44 space-y-1 overflow-y-auto pr-1">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-2 rounded-lg bg-black/40 px-3 py-1.5 text-[11px]">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: e.kind === "income" ? "#10B981" : "#F87171" }}
              />
              <span className="flex-1 text-slate-200 truncate">{e.label}</span>
              <span className="text-[10px] text-slate-400">{e.category}</span>
              <span className={e.kind === "income" ? "font-semibold text-emerald-300" : "font-semibold text-rose-300"}>
                {e.kind === "income" ? "+" : "−"}{fmt(e.amount)}
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onDelete(e.id)}
                  className="rounded-full p-1 text-slate-500 hover:bg-white/10 hover:text-rose-300"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: React.ElementType }) {
  return (
    <div className="rounded-lg bg-black/40 px-2 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-slate-400">{label}</span>
        <Icon className="h-3 w-3" style={{ color }} />
      </div>
      <div className="mt-1 text-sm font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
