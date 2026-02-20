/**
 * Feedback API Route
 *
 * Handles feedback, bug reports, and newsletter sign-ups.
 * Delivers via nodemailer → Gmail SMTP. Node runtime only.
 *
 * Env vars required in .env.local:
 *   GMAIL_USER=you@gmail.com
 *   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   (16-char app password)
 *   FEEDBACK_TO=recipient@example.com         (defaults to GMAIL_USER)
 */

import nodemailer from 'nodemailer';
import { createRouteLogger } from '@/lib/route-logger';

// =============================================================================
// TYPES
// =============================================================================

type FeedbackType = 'feedback' | 'bug' | 'newsletter';
type Severity = 'low' | 'medium' | 'high' | 'critical';

interface FeedbackRequestBody {
  type: FeedbackType;
  /** Star rating 1–5 (feedback only) */
  rating?: number;
  /** Severity level (bug only) */
  severity?: Severity;
  /** Free-text message (feedback + bug) */
  message?: string;
  /** Optional contact / subscribed email */
  email?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function buildSubject(body: FeedbackRequestBody): string {
  switch (body.type) {
    case 'feedback': {
      const stars = body.rating ? `${'★'.repeat(body.rating)}${'☆'.repeat(5 - body.rating)} (${body.rating}/5) ` : '';
      return `[FEEDBACK] ${stars}ProjectLoom`;
    }
    case 'bug': {
      const sev = body.severity ? body.severity.toUpperCase() : 'UNKNOWN';
      return `[BUG][${sev}] ProjectLoom`;
    }
    case 'newsletter':
      return `[SUBSCRIBER] ProjectLoom`;
  }
}

function buildHtml(body: FeedbackRequestBody): string {
  // ── Header badge ────────────────────────────────────────────────────────────
  const typeLabel = body.type === 'feedback' ? 'Feedback' : body.type === 'bug' ? 'Bug Report' : 'Newsletter';
  const badgeColor = body.type === 'feedback' ? '#6366f1' : body.type === 'bug' ? '#ef4444' : '#10b981';

  // ── Rows ────────────────────────────────────────────────────────────────────
  const rows: string[] = [];

  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:12px 16px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#888;white-space:nowrap;width:100px;border-bottom:1px solid #f0f0f0">${label}</td>
      <td style="padding:12px 16px;font-size:14px;color:#1a1a1a;border-bottom:1px solid #f0f0f0">${value}</td>
    </tr>`;

  if (body.type === 'feedback' && body.rating) {
    const stars = Array.from({ length: 5 }, (_, i) =>
      `<span style="font-size:18px;color:${i < body.rating! ? '#f59e0b' : '#d1d5db'}">${i < body.rating! ? '★' : '☆'}</span>`
    ).join('');
    rows.push(row('Rating', `${stars} <span style="font-size:13px;color:#888;margin-left:6px">${body.rating}/5</span>`));
  }

  if (body.type === 'bug' && body.severity) {
    const severityStyles: Record<Severity, string> = {
      low:      'background:#dcfce7;color:#166534',
      medium:   'background:#fef9c3;color:#854d0e',
      high:     'background:#fee2e2;color:#991b1b',
      critical: 'background:#f3e8ff;color:#6b21a8',
    };
    const s = severityStyles[body.severity] ?? 'background:#f3f4f6;color:#374151';
    rows.push(row('Severity', `<span style="display:inline-block;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700;letter-spacing:0.05em;${s}">${body.severity.toUpperCase()}</span>`));
  }

  if (body.email) {
    rows.push(row('Email', `<a href="mailto:${body.email}" style="color:#6366f1;text-decoration:none">${body.email}</a>`));
  }

  if (body.message) {
    const escaped = body.message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    rows.push(row('Message', `<span style="white-space:pre-wrap;line-height:1.6">${escaped}</span>`));
  }

  const table =
    rows.length > 0
      ? `<table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;border:1px solid #f0f0f0;border-radius:6px;overflow:hidden">${rows.join('')}</table>`
      : `<p style="color:#999;font-size:14px;margin:0">No additional details provided.</p>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%">

        <!-- Header -->
        <tr>
          <td style="background:#18181b;border-radius:10px 10px 0 0;padding:24px 28px;display:block">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.02em">ProjectLoom</span>
                </td>
                <td align="right">
                  <span style="display:inline-block;background:${badgeColor};color:#fff;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:4px 10px;border-radius:99px">${typeLabel}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;border-radius:0 0 10px 10px;padding:24px 28px;border:1px solid #e4e4e7;border-top:none">
            ${table}
            <p style="margin:24px 0 0;font-size:11px;color:#a1a1aa;text-align:center">Sent via ProjectLoom &mdash; <a href="https://projectloom.app" style="color:#a1a1aa">projectloom.app</a></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const log = createRouteLogger('feedback');
  const ctx = log.begin();

  try {
    const body = (await req.json()) as FeedbackRequestBody;
    log.info(ctx.reqId, `type=${body.type}`, { email: body.email ? '***' : undefined });

    // ── Validate ──────────────────────────────────────────────────────────────
    if (!['feedback', 'bug', 'newsletter'].includes(body.type)) {
      return Response.json({ error: 'Invalid type' }, { status: 400 });
    }
    if (body.type === 'newsletter' && !body.email) {
      return Response.json({ error: 'email required for newsletter' }, { status: 400 });
    }
    if (body.type !== 'newsletter' && !body.rating && !body.message?.trim() && !body.email?.trim()) {
      return Response.json({ error: 'message, rating, or email required' }, { status: 400 });
    }

    // ── Configuration check ───────────────────────────────────────────────────
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    if (!gmailUser || !gmailPass) {
      console.error('[feedback] Missing GMAIL_USER or GMAIL_APP_PASSWORD env vars');
      return Response.json({ error: 'Server email not configured' }, { status: 503 });
    }
    const toAddress = process.env.FEEDBACK_TO ?? gmailUser;

    // ── Send email ────────────────────────────────────────────────────────────
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
      // Fail fast instead of hanging for 30+ seconds on a bad connection
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

    const info = await transporter.sendMail({
      from: `"ProjectLoom Feedback" <${gmailUser}>`,
      to: toAddress,
      subject: buildSubject(body),
      html: buildHtml(body),
      ...(body.email ? { replyTo: body.email } : {}),
    });

    return log.end(ctx, Response.json({ ok: true }), { type: body.type, messageId: info.messageId });
  } catch (error) {
    log.err(ctx, error);
    const msg = error instanceof Error ? error.message : String(error);
    return Response.json({ error: 'Failed to send', detail: msg }, { status: 500 });
  }
}
