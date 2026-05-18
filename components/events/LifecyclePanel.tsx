"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe2, Link2, Copy, Check, Megaphone, Award, MessageSquare, Star, Loader2 } from "lucide-react";
import {
  getEventById,
  updateEvent,
  getParticipantsForEvent,
  broadcastToParticipants,
  issueCertificates,
  loadIssuedCertificates,
  loadFeedback,
} from "@/lib/db";
import type { UnioEvent, UnioFeedback, UnioCertificate } from "@/lib/store";
import { useCan } from "@/lib/permissions";

interface Props {
  eventId: string;
}

export function LifecyclePanel({ eventId }: Props) {
  const canTogglePublic = useCan("events.toggle_public");
  const canBroadcast = useCan("events.broadcast");
  const canIssueCerts = useCan("certificates.issue_bulk");

  const [event, setEvent] = useState<UnioEvent | null>(null);
  const [feedback, setFeedback] = useState<UnioFeedback[]>([]);
  const [certs, setCerts] = useState<UnioCertificate[]>([]);
  const [copied, setCopied] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Broadcast form
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [bcSubject, setBcSubject] = useState("");
  const [bcMessage, setBcMessage] = useState("");
  const [bcResult, setBcResult] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [e, f, c] = await Promise.all([
      getEventById(eventId),
      loadFeedback(eventId),
      loadIssuedCertificates(eventId),
    ]);
    setEvent(e ?? null);
    setFeedback(f);
    setCerts(c);
  }, [eventId]);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("unio-store-change", onChange);
    return () => window.removeEventListener("unio-store-change", onChange);
  }, [refresh]);

  const publicUrl = typeof window !== "undefined"
    ? `${window.location.origin}/r/${eventId}`
    : `/r/${eventId}`;

  const togglePublic = async () => {
    if (!event) return;
    setBusyKey("public");
    await updateEvent(eventId, { isPublic: !event.isPublic });
    await refresh();
    setBusyKey(null);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const onIssueCerts = async () => {
    setBusyKey("certs");
    const res = await issueCertificates(eventId);
    if (res.ok) {
      alert(`Issued ${res.issued ?? 0} new certificate${res.issued === 1 ? "" : "s"}.`);
      await refresh();
    } else {
      alert(`Couldn't issue certificates: ${res.error}`);
    }
    setBusyKey(null);
  };

  const onBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyKey("broadcast");
    setBcResult(null);
    const ps = await getParticipantsForEvent(eventId);
    const recipients = Array.from(new Set(
      ps
        .filter((p) => p.status !== "cancelled" && p.email)
        .map((p) => p.email)
    ));
    if (recipients.length === 0) {
      setBcResult("No participants to email yet.");
      setBusyKey(null);
      return;
    }
    const res = await broadcastToParticipants({
      eventId,
      subject: bcSubject,
      message: bcMessage,
      recipients,
    });
    setBusyKey(null);
    if (!res.ok) {
      setBcResult(`Failed: ${res.error}`);
      return;
    }
    if (res.mode === "noop") {
      setBcResult(`Would have emailed ${res.sent} recipient${res.sent === 1 ? "" : "s"} (RESEND_API_KEY not set).`);
    } else {
      setBcResult(`Sent to ${res.sent} recipient${res.sent === 1 ? "" : "s"}.`);
    }
    setBcSubject("");
    setBcMessage("");
  };

  if (!event) return null;

  const avgRating = feedback.length
    ? feedback.reduce((s, f) => s + f.rating, 0) / feedback.length
    : null;

  return (
    <section className="mt-8 grid gap-4 rounded-3xl border border-white/10 bg-black/40 p-5 lg:grid-cols-2">
      {/* PUBLIC REGISTRATION */}
      <div className="rounded-2xl border border-white/10 bg-navy/60 p-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Globe2 className="h-4 w-4 text-indigo-300" /> Public registration
          </h3>
          {canTogglePublic && (
            <button
              type="button"
              onClick={togglePublic}
              disabled={busyKey === "public"}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                event.isPublic
                  ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40"
                  : "bg-slate-700/60 text-slate-300 ring-1 ring-white/15"
              }`}
            >
              {busyKey === "public" ? "…" : event.isPublic ? "On" : "Off"}
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {event.isPublic
            ? "Anyone with the link can register. Capacity overflow → waitlist."
            : "Page is hidden. Flip on to share with attendees."}
        </p>
        {event.isPublic && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs">
            <Link2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="truncate flex-1 text-slate-200">{publicUrl}</span>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-full p-1.5 text-slate-300 hover:bg-white/10"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* BROADCAST */}
      {canBroadcast && (
        <div className="rounded-2xl border border-white/10 bg-navy/60 p-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Megaphone className="h-4 w-4 text-amber-300" /> Email participants
            </h3>
            <button
              type="button"
              onClick={() => setBroadcastOpen((v) => !v)}
              className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/15"
            >
              {broadcastOpen ? "Close" : "Compose"}
            </button>
          </div>
          {!broadcastOpen ? (
            <p className="mt-2 text-xs text-slate-400">
              Send an update to everyone who registered (excluding cancellations).
            </p>
          ) : (
            <form onSubmit={onBroadcast} className="mt-3 space-y-2">
              <input
                required
                value={bcSubject}
                onChange={(e) => setBcSubject(e.target.value)}
                placeholder="Subject"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-indigo-400/60"
              />
              <textarea
                required
                rows={3}
                value={bcMessage}
                onChange={(e) => setBcMessage(e.target.value)}
                placeholder="Your message"
                className="w-full resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-indigo-400/60"
              />
              <button
                type="submit"
                disabled={busyKey === "broadcast"}
                className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md disabled:opacity-50"
              >
                {busyKey === "broadcast" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Megaphone className="h-3 w-3" />}
                Send
              </button>
              {bcResult && <p className="text-[11px] text-slate-300">{bcResult}</p>}
            </form>
          )}
        </div>
      )}

      {/* CERTIFICATES */}
      {canIssueCerts && (
        <div className="rounded-2xl border border-white/10 bg-navy/60 p-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Award className="h-4 w-4 text-emerald-300" /> Certificates
            </h3>
            <span className="text-[11px] text-slate-400">{certs.length} issued</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            One-click issue for everyone who attended or checked in.
          </p>
          <button
            type="button"
            onClick={onIssueCerts}
            disabled={busyKey === "certs"}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-400/40 hover:bg-emerald-500/30 disabled:opacity-50"
          >
            {busyKey === "certs" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Award className="h-3 w-3" />}
            Issue certificates
          </button>
        </div>
      )}

      {/* FEEDBACK SUMMARY */}
      <div className="rounded-2xl border border-white/10 bg-navy/60 p-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <MessageSquare className="h-4 w-4 text-purple-300" /> Feedback
          </h3>
          {avgRating != null ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300">
              <Star className="h-3 w-3" fill="currentColor" />
              {avgRating.toFixed(1)} · {feedback.length}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400">no responses</span>
          )}
        </div>
        {event.isPublic && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[11px]">
            <Link2 className="h-3 w-3 shrink-0 text-slate-400" />
            <span className="truncate flex-1 text-slate-300">{publicUrl}/feedback</span>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(`${publicUrl}/feedback`)}
              className="rounded-full p-1 text-slate-300 hover:bg-white/10"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        )}
        {feedback.length > 0 && (
          <ul className="mt-3 max-h-32 space-y-2 overflow-y-auto pr-1">
            {feedback.slice(0, 5).map((f) => (
              <li key={f.id} className="rounded-lg bg-black/40 px-3 py-2 text-[11px] text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{f.name}</span>
                  <span className="inline-flex items-center gap-0.5 text-amber-300">
                    {Array.from({ length: f.rating }).map((_, i) => (
                      <Star key={i} className="h-3 w-3" fill="currentColor" />
                    ))}
                  </span>
                </div>
                {f.comment && <p className="mt-1 text-slate-400">{f.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
