/**
 * Trial Cookie Reset
 *
 * Expires the ploom_trial HttpOnly cookie so the dev firstTime reset is truly clean.
 * This is intentionally unauthenticated — it only clears the trial, not any real data.
 */

export const runtime = 'edge';

const COOKIE_NAME = 'ploom_trial';

export async function POST(): Promise<Response> {
  const expireCookie = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Strict',
  ].join('; ');

  return new Response(null, {
    status: 204,
    headers: {
      'Set-Cookie': expireCookie,
    },
  });
}
