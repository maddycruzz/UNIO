"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Plus, Trash2, Mail, Phone, Loader2, ChevronDown } from "lucide-react";
import { loadSponsors, addSponsor, updateSponsor, deleteSponsor } from "@/lib/db";
import type { UnioSponsor, SponsorTier, SponsorStatus } from "@/lib/store";
import { useCan } from "@/lib/permissions";

interface Props { eventId: string }

const TIERS: SponsorTier[] = ["platinum", "gold", "silver", "bronze", "partner"];
const STATUSES: SponsorStatus[] = ["prospect", "contacted", "confirmed", "declined"];

const TIER_COLOR: Record<SponsorTier, string> = {
  platinum: "#E5E7EB",
  gold:     "#FBBF24",
  silver:   "#94A3B8",
  bronze:   "#B45309",
  partner:  "#A78BFA",
};

const STATUS_COLOR: Record<SponsorStatus, string> = {
  prospect:  "#94A3B8",
  contacted: "#6366F1",
  confirmed: "#10B981",
  declined:  "#EF4444",
};

function fmt(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

export function SponsorsPanel({ eventId }: Props) {
  const canEdit = useCan("sponsors.edit");
  const [sponsors, setSponsors] = useState<UnioSponsor[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "", tier: "silver" as SponsorTier, status: "prospect" as SponsorStatus,
    amount: "", contactName: "", contactEmail: "", notes: "",
  });

  const refresh = useCallback(async () => setSponsors(await loadSponsors(eventId)), [eventId]);

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("unio-store-change", h);
    return () => window.removeEventListener("unio-store-change", h);
  }, [refresh]);

  const confirmedAmount = sponsors.filter((s) => s.status === "confirmed").reduce((sum, s) => sum + s.amount, 0);
  const pipelineAmount = sponsors.filter((s) => s.status !== "declined").reduce((sum, s) => sum + s.amount, 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    await addSponsor({
      eventId,
      name: form.name,
      tier: form.tier,
      status: form.status,
      amount: Number(form.amount) || 0,
      contactName: form.contactName,
      contactEmail: form.contactEmail,
      notes: form.notes,
    });
    setForm({ name: "", tier: "silver", status: "prospect", amount: "", contactName: "", contactEmail: "", notes: "" });
    setOpen(false);
    setBusy(false);
    await refresh();
  };

  const onStatusChange = async (id: string, status: SponsorStatus) => {
    await updateSponsor(id, { status });
    await refresh();
  };

  const onDelete = async (id: string) => {
    await deleteSponsor(id);
    await refresh();
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-navy/60 p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Building2 className="h-4 w-4 text-amber-300" /> Sponsors
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

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg bg-black/40 px-2 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Confirmed</div>
          <div className="mt-1 text-sm font-bold text-emerald-300">{fmt(confirmedAmount)}</div>
        </div>
        <div className="rounded-lg bg-black/40 px-2 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Pipeline</div>
          <div className="mt-1 text-sm font-bold text-indigo-300">{fmt(pipelineAmount)}</div>
        </div>
      </div>

      {open && canEdit && (
        <form onSubmit={submit} className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Sponsor name"
            className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-400/60"
          />
          <div className="grid grid-cols-3 gap-2">
            <select
              value={form.tier}
              onChange={(e) => setForm({ ...form, tier: e.target.value as SponsorTier })}
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none"
            >
              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as SponsorStatus })}
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              type="number"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="Amount"
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              placeholder="Contact name"
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none"
            />
            <input
              type="email"
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              placeholder="Email"
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Save
          </button>
        </form>
      )}

      {sponsors.length > 0 && (
        <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-1">
          {sponsors.map((s) => (
            <li key={s.id} className="rounded-lg bg-black/40 px-3 py-2 text-[11px]">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: TIER_COLOR[s.tier] }}
                  title={`Tier: ${s.tier}`}
                />
                <span className="flex-1 truncate font-semibold text-white">{s.name}</span>
                <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                  style={{
                    background: STATUS_COLOR[s.status] + "22",
                    color: STATUS_COLOR[s.status],
                  }}>{s.status}</span>
                {s.amount > 0 && <span className="font-semibold text-slate-200">{fmt(s.amount)}</span>}
                {canEdit && (
                  <>
                    <div className="relative">
                      <select
                        value={s.status}
                        onChange={(e) => onStatusChange(s.id, e.target.value as SponsorStatus)}
                        className="appearance-none rounded p-1 pr-4 text-[10px] text-slate-300 bg-transparent hover:bg-white/10 cursor-pointer"
                      >
                        {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-0.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-slate-500" />
                    </div>
                    <button
                      type="button"
                      onClick={() => onDelete(s.id)}
                      className="rounded-full p-1 text-slate-500 hover:bg-white/10 hover:text-rose-300"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
              {(s.contactName || s.contactEmail || s.contactPhone) && (
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 pl-4 text-[10px] text-slate-400">
                  {s.contactName && <span>{s.contactName}</span>}
                  {s.contactEmail && <a href={`mailto:${s.contactEmail}`} className="inline-flex items-center gap-1 hover:text-indigo-300"><Mail className="h-2.5 w-2.5" />{s.contactEmail}</a>}
                  {s.contactPhone && <a href={`tel:${s.contactPhone}`} className="inline-flex items-center gap-1 hover:text-indigo-300"><Phone className="h-2.5 w-2.5" />{s.contactPhone}</a>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
