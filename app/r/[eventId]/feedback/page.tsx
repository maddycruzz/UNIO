"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Star, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { getPublicEvent, submitFeedback, type PublicEventView } from "@/lib/db";

type Status = "loading" | "ready" | "submitting" | "done" | "error";

export default function PublicFeedbackPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const [status, setStatus] = useState<Status>("loading");
  const [event, setEvent] = useState<PublicEventView | null>(null);
  const [form, setForm] = useState({ name: "", email: "", rating: 0, comment: "" });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const e = await getPublicEvent(eventId);
      if (cancelled) return;
      if (!e) {
        setErrorMsg("We couldn't find this event.");
        setStatus("error");
      } else {
        setEvent(e);
        setStatus("ready");
      }
    })();
    return () => { cancelled = true; };
  }, [eventId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.rating < 1) { setErrorMsg("Please pick a rating from 1 to 5."); return; }
    setErrorMsg(null);
    setStatus("submitting");
    const res = await submitFeedback({
      eventId,
      name: form.name,
      email: form.email,
      rating: form.rating,
      comment: form.comment,
    });
    if (!res.ok) {
      setErrorMsg(res.error ?? "Something went wrong.");
      setStatus("ready");
      return;
    }
    setStatus("done");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-xs text-slate-400 hover:text-slate-200">← UNIO</Link>

        {status === "loading" && (
          <div className="mt-12 flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        )}

        {status === "error" && (
          <div className="mt-10 rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <div className="flex items-center gap-2 text-red-300"><AlertCircle className="h-5 w-5" />Unavailable</div>
            <p className="mt-2 text-sm text-slate-300">{errorMsg}</p>
          </div>
        )}

        {(status === "ready" || status === "submitting") && event && (
          <>
            <div className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-5">
              <span className="inline-block rounded-full bg-purple-500/20 px-2 py-0.5 text-[11px] font-semibold text-purple-200">Post-event feedback</span>
              <h1 className="mt-2 text-xl font-semibold tracking-tight text-white">{event.name}</h1>
              <p className="mt-1 text-xs text-slate-400">{event.date} · {event.venue}</p>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-3xl border border-white/10 bg-black/30 p-5">
              <div>
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Your rating</span>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setForm({ ...form, rating: n })}
                      className={`grid h-10 w-10 place-items-center rounded-full border transition ${
                        form.rating >= n
                          ? "border-amber-400/60 bg-amber-500/20 text-amber-300"
                          : "border-white/15 bg-black/40 text-slate-400 hover:border-white/30"
                      }`}
                    >
                      <Star className="h-4 w-4" fill={form.rating >= n ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
              </div>

              <Field label="Name (optional)" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Email (optional)" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Comments</span>
                <textarea
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/30"
                  placeholder="What worked, what didn't, what could be better next time?"
                />
              </label>

              {errorMsg && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 ring-1 ring-indigo-400/60 disabled:opacity-50"
              >
                {status === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Submit feedback
              </button>
            </form>
          </>
        )}

        {status === "done" && (
          <div className="mt-10 rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
            <h2 className="mt-3 text-lg font-semibold text-white">Thanks for your feedback!</h2>
            <p className="mt-2 text-sm text-slate-200">It helps the organizers improve their next event.</p>
          </div>
        )}

        <p className="mt-8 text-center text-[11px] text-slate-500">Powered by UNIO</p>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, type = "text" }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/30"
      />
    </label>
  );
}
