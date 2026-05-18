"use client";

import { useState } from "react";
import { Sparkles, Copy, Check, Loader2 } from "lucide-react";
import { generateEventBrief } from "@/lib/db";

interface Props { eventId: string }

export function BriefPanel({ eventId }: Props) {
  const [brief, setBrief] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const onGenerate = async () => {
    setBusy(true);
    const md = await generateEventBrief(eventId);
    setBrief(md);
    setBusy(false);
  };

  const onCopy = async () => {
    if (!brief) return;
    await navigator.clipboard.writeText(brief);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-navy/60 p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Sparkles className="h-4 w-4 text-fuchsia-300" /> Event brief
        </h3>
        <div className="flex gap-1.5">
          {brief && (
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/15"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : "Copy"}
            </button>
          )}
          <button
            type="button"
            onClick={onGenerate}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/20 px-3 py-1 text-[11px] font-semibold text-fuchsia-200 ring-1 ring-fuchsia-400/40 hover:bg-fuchsia-500/30 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} {brief ? "Regenerate" : "Generate"}
          </button>
        </div>
      </div>

      {!brief ? (
        <p className="mt-2 rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-4 text-center text-[11px] text-slate-500">
          Auto-synthesizes a one-pager from this event's tasks, meetings, participants, budget, and feedback.
        </p>
      ) : (
        <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-black/40 p-3 text-[11px] leading-relaxed text-slate-200 whitespace-pre-wrap font-sans">{brief}</pre>
      )}
    </section>
  );
}
