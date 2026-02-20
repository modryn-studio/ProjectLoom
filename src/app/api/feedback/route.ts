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
  const rows: string[] = [];

  if (body.type === 'feedback' && body.rating) {
    const filled = '★'.repeat(body.rating);
    const empty = '☆'.repeat(5 - body.rating);
    rows.push(`<tr><td><b>Rating</b></td><td>${filled}${empty} (${body.rating}/5)</td></tr>`);
  }

  if (body.type === 'bug' && body.severity) {
    const colorMap: Record<Severity, string> = {
      low: '#4caf50',
      medium: '#ff9800',
      high: '#f44336',
      critical: '#9c27b0',
    };
    const color = colorMap[body.severity] ?? '#666';
    rows.push(
      `<tr><td><b>Severity</b></td><td><span style="color:${color};font-weight:bold">${body.severity.toUpperCase()}</span></td></tr>`,
    );
  }

  if (body.email) {
    rows.push(`<tr><td><b>Email</b></td><td>${body.email}</td></tr>`);
  }

  if (body.message) {
    rows.push(
      `<tr><td valign="top"><b>Message</b></td><td><pre style="margin:0;white-space:pre-wrap;font-family:inherit">${body.message.replace(/</g, '&lt;')}</pre></td></tr>`,
    );
  }

  const table =
    rows.length > 0
      ? `<table cellpadding="8" cellspacing="0" border="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">${rows.join('')}</table>`
      : '<p style="color:#999">No additional details provided.</p>';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="background:#f6f6f6;padding:24px;font-family:sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;border:1px solid #e0e0e0">
    <h2 style="margin:0 0 16px;color:#222">${buildSubject(body).replace(/\[/g, '').replace(/\]/g, '')}</h2>
    ${table}
    <p style="margin:24px 0 0;font-size:12px;color:#999">Sent from ProjectLoom in-app form</p>
  </div>
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
