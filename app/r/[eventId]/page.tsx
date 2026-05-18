"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarRange, MapPin, Users, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { getPublicEvent, registerForEvent, type PublicEventView } from "@/lib/db";
import { use } from "react";

type Status = "loading" | "ready" | "submitting" | "success" | "waitlisted" | "error";

const ERROR_LABELS: Record<string, string> = {
  event_not_found: "We couldn't find this event.",
  event_not_public: "This event isn't open for public registration.",
  registration_closed: "Registration has been closed by the organizer.",
  registration_window_passed: "The registration window has closed.",
  already_registered: "You're already on the list for this event.",
  missing_fields: "Please fill in your name and email.",
};

export default function PublicRegisterPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const [status, setStatus] = useState<Status>("loading");
  const [event, setEvent] = useState<PublicEventView | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", rollNo: "", dept: "" });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const e = await getPublicEvent(eventId);
      if (cancelled) return;
      if (!e) {
        setErrorMsg(ERROR_LABELS.event_not_found);
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
    if (status === "submitting") return;
    setErrorMsg(null);
    setStatus("submitting");
    const res = await registerForEvent({
      eventId,
      name: form.name,
      email: form.email,
      phone: form.phone,
      dept: form.dept,
      rollNo: form.rollNo,
    });
    if (!res.ok) {
      setErrorMsg(ERROR_LABELS[res.error ?? ""] ?? res.error ?? "Something went wrong.");
      setStatus("ready");
      return;
    }
    if (res.status === "waitlisted") {
      setWaitlistPosition(res.waitlistPosition ?? null);
      setStatus("waitlisted");
    } else {
      setStatus("success");
    }
  };

  const capacityFull = event?.capacity != null && event.registered >= event.capacity;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950/40 to-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-xs text-slate-400 hover:text-slate-200">← UNIO</Link>

        {status === "loading" && (
          <div className="mt-12 flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Loading event…</span>
          </div>
        )}

        {status === "error" && (
          <div className="mt-10 rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <div className="flex items-center gap-2 text-red-300"><AlertCircle className="h-5 w-5" />Event unavailable</div>
            <p className="mt-2 text-sm text-slate-300">{errorMsg}</p>
          </div>
        )}

        {(status === "ready" || status === "submitting") && event && (
          <>
            <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-black/40">
              {event.cover_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={event.cover_image} alt={event.name} className="h-40 w-full object-cover" />
              )}
              <div className="p-5">
                <span className="inline-block rounded-full bg-indigo-500/20 px-2 py-0.5 text-[11px] font-semibold text-indigo-200">{event.type}</span>
                <h1 className="mt-2 text-xl font-semibold tracking-tight text-white">{event.name}</h1>
                <p className="mt-2 text-sm text-slate-300">{event.description}</p>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1.5"><CalendarRange className="h-3.5 w-3.5" />{event.date}</span>
                  <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{event.venue}</span>
                  <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />
                    {event.capacity != null ? `${event.registered}/${event.capacity}` : `${event.registered}`} registered
                  </span>
                </div>
                {capacityFull && (
                  <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    This event is at capacity. You can still register — you'll be added to the waitlist.
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-3 rounded-3xl border border-white/10 bg-black/30 p-5">
              <h2 className="text-sm font-semibold text-white">Register</h2>

              <Field label="Full name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
              <Field label="Email *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                <Field label="Roll number" value={form.rollNo} onChange={(v) => setForm({ ...form, rollNo: v })} />
              </div>
              <Field label="Department" value={form.dept} onChange={(v) => setForm({ ...form, dept: v })} />

              {errorMsg && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 ring-1 ring-indigo-400/60 disabled:opacity-50"
              >
                {status === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {capacityFull ? "Join waitlist" : "Register"}
              </button>
            </form>
          </>
        )}

        {(status === "success" || status === "waitlisted") && event && (
          <div className="mt-10 rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
            <h2 className="mt-3 text-lg font-semibold text-white">
              {status === "success" ? "You're in!" : "You're on the waitlist"}
            </h2>
            <p className="mt-2 text-sm text-slate-200">
              {status === "success"
                ? `We'll see you at ${event.name}.`
                : `We saved your spot at #${waitlistPosition ?? "?"} on the waitlist. We'll email you if a spot opens up.`}
            </p>
            <p className="mt-3 text-xs text-slate-400">A confirmation has been sent to <strong>{form.email}</strong>.</p>
          </div>
        )}

        <p className="mt-8 text-center text-[11px] text-slate-500">Powered by UNIO</p>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, type = "text", required = false }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/30"
      />
    </label>
  );
}
