/**
 * Trial Cookie Utility
 *
 * Edge-compatible HMAC-SHA256 signed cookie for server-side trial usage tracking.
 * Uses the Web Crypto API — no external dependencies.
 *
 * Cookie payload: { messagesUsed, sessionId, createdAt }
 * The cookie is httpOnly, Secure, SameSite=Strict, 30-day expiry.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface TrialCookiePayload {
  /** Number of trial messages used so far */
  messagesUsed: number;
  /** Random session identifier */
  sessionId: string;
  /** Unix timestamp (ms) when the trial session was created */
  createdAt: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const COOKIE_NAME = 'ploom_trial';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

// =============================================================================
// HMAC SIGNING (Web Crypto API — Edge-compatible)
// =============================================================================

async function getSigningKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await getSigningKey(secret);
  const data = new TextEncoder().encode(payload);
  const signature = await crypto.subtle.sign('HMAC', key, data);
  // Convert ArrayBuffer to base64url
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function verify(payload: string, signatureB64: string, secret: string): Promise<boolean> {
  const key = await getSigningKey(secret);
  const data = new TextEncoder().encode(payload);
  // Decode base64url signature
  const b64 = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const binary = atob(b64 + pad);
  const sigBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) sigBytes[i] = binary.charCodeAt(i);
  return crypto.subtle.verify('HMAC', key, sigBytes, data);
}

// =============================================================================
// COOKIE READ / WRITE
// =============================================================================

/**
 * Parse and verify the trial cookie from a Request's Cookie header.
 * Returns null if cookie is missing, malformed, or signature is invalid.
 */
export async function readTrialCookie(req: Request): Promise<TrialCookiePayload | null> {
  const secret = process.env.TRIAL_COOKIE_SECRET;
  if (!secret) return null;

  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;

  // Parse cookie string for our cookie name
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;

  const value = match.slice(COOKIE_NAME.length + 1);

  try {
    // Format: base64url(json).signature
    const dotIndex = value.lastIndexOf('.');
    if (dotIndex === -1) return null;

    const payloadB64 = value.slice(0, dotIndex);
    const signatureB64 = value.slice(dotIndex + 1);

    const isValid = await verify(payloadB64, signatureB64, secret);
    if (!isValid) return null;

    // Decode payload
    const b64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);
    const payload = JSON.parse(json) as TrialCookiePayload;

    // Basic validation
    if (
      typeof payload.messagesUsed !== 'number' ||
      typeof payload.sessionId !== 'string' ||
      typeof payload.createdAt !== 'number'
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Create a signed trial cookie value and return the Set-Cookie header string.
 */
export async function createTrialCookieHeader(payload: TrialCookiePayload): Promise<string> {
  const secret = process.env.TRIAL_COOKIE_SECRET;
  if (!secret) throw new Error('TRIAL_COOKIE_SECRET is not set');

  const json = JSON.stringify(payload);
  // Encode payload as base64url
  const payloadB64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const signature = await sign(payloadB64, secret);
  const cookieValue = `${payloadB64}.${signature}`;

  // Determine Secure flag based on environment
  const isProduction = process.env.NODE_ENV === 'production';
  const secureFlag = isProduction ? '; Secure' : '';

  return `${COOKIE_NAME}=${cookieValue}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${COOKIE_MAX_AGE}${secureFlag}`;
}

/**
 * Create a fresh trial cookie payload for a new session.
 */
export function createFreshTrialPayload(): TrialCookiePayload {
  return {
    messagesUsed: 0,
    sessionId: crypto.randomUUID().slice(0, 8),
    createdAt: Date.now(),
  };
}

/**
 * Get the trial request cap from environment.
 */
export function getTrialCap(): number {
  const cap = parseInt(process.env.TRIAL_REQUEST_CAP || '20', 10);
  return isNaN(cap) ? 20 : cap;
}

/**
 * Check if trial mode is enabled server-side.
 */
export function isTrialEnabled(): boolean {
  return process.env.TRIAL_ENABLED === 'true' && !!process.env.TRIAL_OPENAI_KEY;
}
