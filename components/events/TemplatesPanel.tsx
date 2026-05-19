"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutTemplate, Plus, Trash2, Wand2, Loader2, X } from "lucide-react";
import {
  loadTaskTemplates,
  addTaskTemplate,
  deleteTaskTemplate,
  applyTaskTemplate,
  getEventById,
} from "@/lib/db";
import type { UnioTaskTemplate, EventType, TaskPriority } from "@/lib/store";
import { useCan } from "@/lib/permissions";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

interface Props { eventId: string }

const EVENT_TYPES: EventType[] = ["Cultural", "Tech", "Sports", "Workshop", "Conference", "Other"];
const PRIORITIES: TaskPriority[] = ["High", "Medium", "Low"];

type DraftItem = { title: string; priority: TaskPriority; daysOffset: number; division: string };

export function TemplatesPanel({ eventId }: Props) {
  const canCreate = useCan("templates.create");
  const canApply = useCan("templates.apply");
  const canDelete = useCan("templates.delete");
  const toast = useToast();
  const confirm = useConfirm();

  const [templates, setTemplates] = useState<UnioTaskTemplate[]>([]);
  const [eventType, setEventType] = useState<EventType>("Other");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [name, setName] = useState("");
  const [tplType, setTplType] = useState<EventType>("Other");
  const [items, setItems] = useState<DraftItem[]>([{ title: "", priority: "Medium", daysOffset: 0, division: "" }]);

  const refresh = useCallback(async () => {
    const [tpls, ev] = await Promise.all([loadTaskTemplates(), getEventById(eventId)]);
    setTemplates(tpls);
    if (ev) setEventType(ev.type);
  }, [eventId]);

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("unio-store-change", h);
    return () => window.removeEventListener("unio-store-change", h);
  }, [refresh]);

  const matchingTemplates = templates.filter((t) => t.eventType === eventType || t.eventType === "Other");
  const otherTemplates = templates.filter((t) => !matchingTemplates.includes(t));

  const onApply = async (tplId: string) => {
    setBusyId(tplId);
    const res = await applyTaskTemplate({ templateId: tplId, eventId });
    setBusyId(null);
    if (res.ok) {
      toast.success(`Added ${res.inserted ?? 0} task${res.inserted === 1 ? "" : "s"} from template.`);
      await refresh();
    } else {
      toast.error(`Couldn't apply template: ${res.error}`);
    }
  };

  const onDelete = async (tplId: string) => {
    const ok = await confirm({
      title: "Delete template?",
      message: "Tasks already created from this template will stay. The template itself will be removed.",
      confirmLabel: "Delete template",
      variant: "danger",
    });
    if (!ok) return;
    setBusyId(tplId);
    try {
      await deleteTaskTemplate(tplId);
      await refresh();
      toast.success("Template deleted.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete template.");
    } finally {
      setBusyId(null);
    }
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanItems = items.filter((i) => i.title.trim());
    if (!name.trim() || cleanItems.length === 0) return;
    setBusyId("__create");
    const res = await addTaskTemplate({
      name,
      eventType: tplType,
      items: cleanItems.map((i, idx) => ({
        title: i.title.trim(),
        description: "",
        priority: i.priority,
        division: i.division,
        daysOffset: Number(i.daysOffset) || 0,
        order: idx,
      })),
    });
    setBusyId(null);
    if ("ok" in res && res.ok === false) {
      toast.error(`Couldn't create template: ${res.error}`);
      return;
    }
    toast.success("Template saved.");
    setName("");
    setTplType("Other");
    setItems([{ title: "", priority: "Medium", daysOffset: 0, division: "" }]);
    setComposing(false);
    await refresh();
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-navy/60 p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <LayoutTemplate className="h-4 w-4 text-indigo-300" /> Task templates
        </h3>
        {canCreate && (
          <button
            type="button"
            onClick={() => setComposing((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/15"
          >
            {composing ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />} {composing ? "Close" : "New"}
          </button>
        )}
      </div>

      {composing && canCreate && (
        <form onSubmit={onCreate} className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name"
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-400/60"
            />
            <select
              value={tplType}
              onChange={(e) => setTplType(e.target.value as EventType)}
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none"
            >
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_60px_50px_18px] gap-1">
                <input
                  value={it.title}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx] = { ...it, title: e.target.value };
                    setItems(next);
                  }}
                  placeholder={`Task ${idx + 1}`}
                  className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white outline-none"
                />
                <select
                  value={it.priority}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx] = { ...it, priority: e.target.value as TaskPriority };
                    setItems(next);
                  }}
                  className="rounded-md border border-white/10 bg-black/40 px-1 py-1 text-[11px] text-white outline-none"
                >
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <input
                  type="number"
                  value={it.daysOffset}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx] = { ...it, daysOffset: Number(e.target.value) };
                    setItems(next);
                  }}
                  title="Days from start"
                  className="rounded-md border border-white/10 bg-black/40 px-1 py-1 text-[11px] text-white outline-none"
                />
                {items.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    className="text-slate-500 hover:text-rose-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : <span />}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setItems([...items, { title: "", priority: "Medium", daysOffset: 0, division: "" }])}
              className="text-[10px] text-indigo-300 hover:underline"
            >+ Add task</button>
          </div>

          <button
            type="submit"
            disabled={busyId === "__create"}
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {busyId === "__create" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Save template
          </button>
        </form>
      )}

      {templates.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-4 text-center text-[11px] text-slate-500">
          No templates yet. Build a reusable bundle of tasks so you don't redo the planning every time.
        </p>
      ) : (
        <>
          {matchingTemplates.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Suggested for {eventType}</p>
              {matchingTemplates.map((t) => (
                <TemplateRow key={t.id} tpl={t} busy={busyId === t.id} canApply={canApply} canDelete={canDelete}
                  onApply={() => onApply(t.id)} onDelete={() => onDelete(t.id)} />
              ))}
            </div>
          )}
          {otherTemplates.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Other templates</p>
              {otherTemplates.map((t) => (
                <TemplateRow key={t.id} tpl={t} busy={busyId === t.id} canApply={canApply} canDelete={canDelete}
                  onApply={() => onApply(t.id)} onDelete={() => onDelete(t.id)} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function TemplateRow({ tpl, busy, canApply, canDelete, onApply, onDelete }: {
  tpl: UnioTaskTemplate;
  busy: boolean;
  canApply: boolean;
  canDelete: boolean;
  onApply: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-black/40 px-3 py-2 text-[11px]">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-indigo-500/15 text-indigo-300 text-[9px] font-bold">{tpl.items.length}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-slate-100 font-semibold">{tpl.name}</div>
        <div className="text-[10px] text-slate-500">{tpl.eventType} · {tpl.items.length} task{tpl.items.length === 1 ? "" : "s"}</div>
      </div>
      {canApply && (
        <button
          type="button"
          onClick={onApply}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 px-2.5 py-1 text-[10px] font-semibold text-indigo-200 hover:bg-indigo-500/30 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />} Apply
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="rounded-full p-1 text-slate-500 hover:bg-white/10 hover:text-rose-300"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
