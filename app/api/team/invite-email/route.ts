import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

/**
 * POST /api/team/invite-email
 *
 * Sends the actual invitation email via Resend. Authorization is anchored to
 * the database: the client must have already inserted a row into
 * club_invitations (RLS only allows president/developer to do so), and we
 * verify the token belongs to a real, pending, non-expired invitation that
 * matches the requested recipient email before sending anything.
 *
 * Body: {
 *   token: string;          // the invitation token already in club_invitations
 *   email: string;          // recipient
 *   acceptUrl: string;      // full URL the email should link to (built client-side)
 *   inviterName?: string;
 *   name?: string;          // recipient's name, if known
 *   role?: "mate" | "president";
 *   message?: string;       // optional personal note
 * }
 *
 * Behavior:
 *   - RESEND_API_KEY missing → returns { ok: true, mode: "noop" } so the
 *     client can still surface the invite link manually. This keeps local /
 *     demo environments functional without external services.
 *   - Resend send failure → returns { ok: false } with the upstream message,
 *     never reveals API key material.
 */
export async function POST(req: Request) {
  let body: {
    token?: string;
    email?: string;
    acceptUrl?: string;
    inviterName?: string;
    name?: string;
    role?: "mate" | "president";
    message?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const token = (body.token ?? "").trim();
  const recipient = (body.email ?? "").trim().toLowerCase();
  const acceptUrl = (body.acceptUrl ?? "").trim();
  if (!token || !recipient || !acceptUrl) {
    return NextResponse.json(
      { ok: false, error: "missing_required_fields" },
      { status: 400 }
    );
  }
  // Prevent open redirect / phishing: acceptUrl must be a same-origin path.
  try {
    const parsed = new URL(acceptUrl);
    const reqOrigin = new URL(req.url).origin;
    if (parsed.origin !== reqOrigin) {
      return NextResponse.json({ ok: false, error: "acceptUrl_origin_mismatch" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_acceptUrl" }, { status: 400 });
  }

  // ── Verify the invitation is real, pending, and matches the recipient.
  // This is our authz: the row only exists because RLS allowed an authorized
  // user to insert it. We do NOT trust the client to tell us who's invited.
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supaUrl || !supaAnon) {
    return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 500 });
  }
  // Use the anon client to call get_invite_preview — a SECURITY DEFINER RPC
  // that bypasses RLS to return only the safe preview fields, and only for
  // valid pending invites. A direct SELECT on club_invitations would fail
  // because RLS doesn't grant anon read access (by design — the table holds
  // pending invites for the whole org). The RPC already filters out
  // accepted/expired rows, so a null result = invalid token from any cause.
  const sb = createClient(supaUrl, supaAnon, { auth: { persistSession: false } });
  const { data: previewRows, error: lookupErr } = await sb.rpc("get_invite_preview", {
    invite_token: token,
  });

  if (lookupErr) {
    return NextResponse.json(
      { ok: false, error: `invite_lookup_failed: ${lookupErr.message}` },
      { status: 502 }
    );
  }
  // RPC returns SETOF — Supabase delivers it as an array. We expect 0 or 1.
  const invite = Array.isArray(previewRows) ? previewRows[0] : previewRows;
  if (!invite) {
    return NextResponse.json(
      { ok: false, error: "invite_not_found_or_expired" },
      { status: 404 }
    );
  }
  if ((invite.email ?? "").toLowerCase() !== recipient) {
    return NextResponse.json({ ok: false, error: "email_mismatch" }, { status: 400 });
  }

  // Trust the DB row over the client for fields it knows about.
  const role = (invite.role ?? body.role ?? "mate") as "mate" | "president";
  const personalMessage = (invite.personal_message ?? body.message ?? "").trim();
  const inviterName =
    (invite.inviter_name?.trim() || body.inviterName?.trim() || "Your team");
  const inviteeName = (invite.invitee_name ?? body.name ?? "").trim();

  // ── Compose the email.
  const apiKey = process.env.RESEND_API_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const from =
    process.env.MAIL_FROM ??
    process.env.RESEND_FROM_EMAIL ??
    process.env.SMTP_FROM ??
    "UNIO <onboarding@resend.dev>";
  const roleLabel = role === "president" ? "Club President" : "Club Mate";
  const subject = `You're invited to join UNIO as a ${roleLabel}`;
  const text = [
    inviteeName ? `Hi ${inviteeName},` : "Hi,",
    "",
    `${inviterName} has invited you to join their UNIO workspace as a ${roleLabel}.`,
    personalMessage ? "" : null,
    personalMessage ? `"${personalMessage}"` : null,
    "",
    "Accept the invitation:",
    acceptUrl,
    "",
    "This link expires in 7 days. If you weren't expecting this email, you can safely ignore it.",
    "",
    "— UNIO",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const html = renderInviteHtml({
    inviteeName,
    inviterName,
    roleLabel,
    personalMessage,
    acceptUrl,
  });

  // ── Provider selection: SMTP wins if configured, else Resend, else noop.
  // SMTP first because if someone bothers to set host+user+pass they clearly
  // want to use it. Noop mode keeps the UI working in fresh / demo environments.
  const hasSmtp = Boolean(smtpHost && smtpUser && smtpPass);
  const hasResend = Boolean(apiKey);

  if (!hasSmtp && !hasResend) {
    return NextResponse.json({
      ok: true,
      mode: "noop",
      note: "No email provider configured — share the invite link manually.",
    });
  }

  // ── SMTP path (Brevo / Gmail / Mailgun / anything that speaks SMTP).
  if (hasSmtp) {
    try {
      const port = Number(process.env.SMTP_PORT ?? 587);
      const transporter = nodemailer.createTransport({
        host: smtpHost!,
        port,
        // STARTTLS on 587, implicit TLS on 465 — common convention.
        secure: port === 465,
        auth: { user: smtpUser!, pass: smtpPass! },
      });
      await transporter.sendMail({ from, to: recipient, subject, text, html });
      return NextResponse.json({ ok: true, mode: "smtp" });
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : "smtp_send_failed" },
        { status: 502 }
      );
    }
  }

  // ── Resend path (HTTP API).
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to: [recipient], subject, text, html }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json(
        { ok: false, error: `resend_failed: ${txt.slice(0, 200)}` },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, mode: "resend" });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "send_failed" },
      { status: 502 }
    );
  }
}

// Minimal, dark-themed invite email. Inline CSS only — most clients strip <style>.
function renderInviteHtml(opts: {
  inviteeName: string;
  inviterName: string;
  roleLabel: string;
  personalMessage: string;
  acceptUrl: string;
}): string {
  const safe = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]!));

  const greeting = opts.inviteeName ? `Hi ${safe(opts.inviteeName)},` : "Hi,";
  const noteBlock = opts.personalMessage
    ? `<div style="margin:20px 0;padding:16px 18px;border-left:3px solid #6366F1;background:#1A1D2E;border-radius:6px;color:#cbd5e1;font-style:italic;">${safe(opts.personalMessage)}</div>`
    : "";

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0F1117;font-family:Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F1117;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#13151F;border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;">
        <tr><td style="padding:32px 32px 0;">
          <div style="display:inline-block;width:40px;height:40px;background:#6366F1;border-radius:10px;color:white;text-align:center;line-height:40px;font-weight:700;font-size:18px;">U</div>
          <h1 style="margin:18px 0 6px;font-size:20px;color:white;font-weight:700;">${greeting}</h1>
          <p style="margin:0 0 16px;color:#94a3b8;font-size:14px;line-height:1.55;">
            <strong style="color:#cbd5e1;">${safe(opts.inviterName)}</strong> has invited you to join their UNIO workspace as a <strong style="color:#cbd5e1;">${safe(opts.roleLabel)}</strong>.
          </p>
          ${noteBlock}
          <p style="margin:24px 0 18px;color:#94a3b8;font-size:14px;">Click the button below to accept and finish setting up your account.</p>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <a href="${safe(opts.acceptUrl)}" style="display:inline-block;padding:12px 22px;background:#6366F1;color:white;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;">Accept invitation</a>
          <p style="margin:18px 0 0;color:#64748b;font-size:12px;word-break:break-all;">
            Or paste this link into your browser:<br>
            <span style="color:#94a3b8;">${safe(opts.acceptUrl)}</span>
          </p>
        </td></tr>
        <tr><td style="padding:18px 32px 28px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;color:#64748b;font-size:12px;line-height:1.55;">
            This invitation expires in 7 days. If you weren't expecting this email you can safely ignore it.
          </p>
        </td></tr>
      </table>
      <p style="margin:18px 0 0;color:#475569;font-size:11px;">UNIO — campus event management</p>
    </td></tr>
  </table>
</body></html>`;
}
