import { NextResponse } from "next/server";

/**
 * POST /api/events/:eventId/broadcast
 * Body: { subject: string; message: string; recipients?: string[] }
 *
 * If RESEND_API_KEY is set, fans the message out via Resend.
 * Otherwise returns a noop response with the count it *would* have sent —
 * useful for local demos.
 *
 * NOTE: recipient list is provided by the caller (the dashboard page),
 * which already has RLS-bounded read access to participants. We don't
 * fetch them server-side here to avoid needing a service-role key.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  let body: { subject?: string; message?: string; recipients?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const subject = (body.subject ?? "").trim();
  const message = (body.message ?? "").trim();
  const recipients = (body.recipients ?? []).filter((r) => typeof r === "string" && r.includes("@"));

  if (!subject || !message) {
    return NextResponse.json({ ok: false, error: "missing_subject_or_message" }, { status: 400 });
  }
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
