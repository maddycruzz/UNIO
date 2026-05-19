import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/server/require-permission";

/**
 * POST /api/events/:eventId/broadcast
 * Body: { subject: string; message: string }
 *
 * Requires the caller to be authenticated and hold the `events.broadcast`
 * permission. Recipients are fetched server-side via the caller's
 * RLS-bounded Supabase session — clients cannot inject arbitrary addresses.
 *
 * If RESEND_API_KEY is set, fans the message out via Resend.
 * Otherwise returns a noop response with the count it *would* have sent —
 * useful for local demos.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  // ── AuthN + AuthZ. Throws on unauthorized; we catch and translate.
  let supabase;
  try {
    ({ supabase } = await requirePermission("events.broadcast"));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "forbidden";
    const status = msg.startsWith("Unauthorized") ? 401 : 403;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }

  let body: { subject?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const subject = (body.subject ?? "").trim();
  const message = (body.message ?? "").trim();
  if (!subject || !message) {
    return NextResponse.json({ ok: false, error: "missing_subject_or_message" }, { status: 400 });
  }

  // ── Pull recipients server-side. RLS scopes this to events the caller owns.
  // If the caller doesn't own this event, they'll get an empty list, never
  // someone else's participant emails.
  const { data: ppl, error: pplErr } = await supabase
    .from("participants")
    .select("email,status")
    .eq("event_id", eventId)
    .neq("status", "cancelled");

  if (pplErr) {
    return NextResponse.json({ ok: false, error: `participants_query_failed: ${pplErr.message}` }, { status: 500 });
  }

  const recipients = Array.from(
    new Set(
      (ppl ?? [])
        .map((p) => (typeof p.email === "string" ? p.email.trim() : ""))
        .filter((e) => e.includes("@"))
    )
  );

  if (recipients.length === 0) {
    return NextResponse.json({ ok: false, error: "no_recipients" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "UNIO <onboarding@resend.dev>";

  // ── Noop mode: no key configured. Return success with a flag.
  if (!apiKey) {
    return NextResponse.json({
      ok: true,
      mode: "noop",
      sent: recipients.length,
      eventId,
      note: "RESEND_API_KEY not configured — message was not sent.",
    });
  }

  // ── Real send via Resend.
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject,
        text: message,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ ok: false, error: `resend_failed: ${txt.slice(0, 200)}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true, mode: "resend", sent: recipients.length, eventId });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "send_failed" },
      { status: 502 }
    );
  }
}
