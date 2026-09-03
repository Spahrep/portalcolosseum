/**
 * Portal Colosseum - Alpha Invite Verification (Supabase Edge Function)
 * =====================================================================
 *
 * Rate limiting:
 *   A simple in-memory token-bucket limiter caps each client IP at 10
 *   requests/minute (burst 30). This is best-effort: on multi-instance
 *   deployments the limit is per-instance, and restarts reset state.
 *   For production traffic growth, front this behind a CDN/Edge-level limiter.
 * Validates invite keys for the alpha signup system. Migrated from the
 * Vercel function at api/invite-verify.js.
 *
 * Endpoints (base: ${SUPABASE_URL}/functions/v1/invite-verify):
 *
 *   POST   - Validate an invite key.
 *            Body: { "key": "<invite-code>" } (JSON or form-urlencoded)
 *            200 { "valid": true }
 *            400 { "valid": false, "error": "..." }
 *
 *   DELETE - Mark a key as used after successful account creation.
 *            Body: { "key": "<invite-code>" }
 *            200 { "ok": true }
 *
 *   GET    - Liveness check only. 200 { "status": "ok" }
 *            Unlike the Vercel version, GET does NOT validate a key from a
 *            query string: keys in URLs leak into access logs, proxy logs,
 *            browser history and Referer headers.
 *
 *   OPTIONS - CORS preflight.
 *
 * Security properties:
 *   - Origin is validated server-side on EVERY method (including OPTIONS and
 *     GET). Requests without an exactly matching Origin get a bare 403.
 *
 *     Read this for what it is: `Origin` is a request header, and any
 *     non-browser client sets it to whatever it likes
 *     (`curl -H 'Origin: https://portalcolosseum.com'` passes). The check
 *     stops a *browser* on another site from driving this endpoint with a
 *     victim's browser; it is NOT authentication and does not make the
 *     endpoint non-public. Treat this function as reachable by anyone.
 *     See the NOT PROTECTED note below.
 *   - CORS allows exactly one origin, sends no Access-Control-Allow-Credentials
 *     (this endpoint is cookie-free by design) and sets `Vary: Origin` so
 *     shared caches never serve one origin's preflight to another.
 *   - All database access goes through two SECURITY DEFINER RPCs
 *     (verify_invite_key / mark_invite_key_used) whose EXECUTE grant is
 *     restricted to service_role. The invite_keys table itself is never
 *     queried directly, so the function needs no table-level privileges and
 *     the RLS deny-all policy on invite_keys stays authoritative for everyone
 *     else.
 *   - Error responses are fixed strings. Exception text, Postgres error
 *     details and environment/config state are logged server-side only and
 *     never reach the client. Nothing echoes back the service_role key.
 *   - The invite key is never written to logs.
 *   - The hardcoded test key is compared in constant time.
 *
 * Environment variables:
 *   - SUPABASE_URL                (auto-injected by the Edge Runtime)
 *   - SUPABASE_SERVICE_ROLE_KEY   (auto-injected by the Edge Runtime)
 *   - INVITE_KEY_HARDCODED        (set via `supabase secrets set`, e.g.
 *                                 INVITE_KEY_HARDCODED=EyeOfTheWorld)
 *
 * This function is deployed with verify_jwt = false (see supabase/config.toml)
 * because invite verification necessarily happens before the user has an
 * account, and therefore before they have any JWT. That makes it an
 * unauthenticated, internet-reachable endpoint.
 *
 * NOT PROTECTED — known gaps, deliberately recorded rather than implied away:
 *
 *   1. Rate limiting: now implemented via an in-memory token bucket (10
 *      req/min, burst 30 per IP). Note this is per-instance and state resets
 *      on function restart — for production use, front with a CDN/Edge-level
 *      limiter (Cloudflare, etc.) for consistent enforcement.
 *
 *   2. Validating a key here does NOT gate account creation. The browser
 *      calls supabase.auth.signUp() directly with the anon key, and neither
 *      GoTrue nor the handle_new_user trigger knows anything about invite
 *      keys. Anyone can skip this endpoint entirely and still register.
 *      This endpoint is invite-flow UX, not an access control — closing that
 *      requires moving signup itself behind a server-side check.
 */

import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

/** The only origin permitted to call this function. */
const ALLOWED_ORIGIN = 'https://portalcolosseum.com';

/**
 * Longest key we will even look at. The invite modal uses maxlength="64"
 * and generated keys are 14 chars ('alpha-' + 8 hex), so this is generous.
 * Bounding the input keeps pathological payloads out of the database.
 */
const MAX_KEY_LENGTH = 64;

/** Hard cap on request body size (bytes) before we attempt to parse it. */
const MAX_BODY_BYTES = 1024;

/**
 * CORS headers for allowed requests.
 *
 * Deliberately absent: Access-Control-Allow-Credentials. This endpoint reads
 * no cookies, and omitting it means a stolen/forged cross-site request can
 * never ride along on the session cookie set by /api/session.
 */
const CORS_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
};

/** Allow local dev origins to call this function (behind an env flag). */
const DEV_ALLOWED_ORIGIN = Deno.env.get('DEV_ALLOWED_ORIGIN') || '';

/** Headers for rejected requests — no CORS grant, but still cache-correct. */
const DENY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Vary': 'Origin',
};

/** Generic, non-revealing client-facing messages. */
const ERR_FORBIDDEN = 'Forbidden';
const ERR_METHOD = 'Method not allowed';
const ERR_INTERNAL = 'Internal server error';
const ERR_KEY_REQUIRED = 'Invite key is required';
const ERR_KEY_INVALID = 'Invalid invite key';
const ERR_KEY_USED = 'This invite key has already been used';
const ERR_RATE_LIMIT = 'Too many requests';


/**
 * Server-side Origin allowlist, applied to every method rather than relying
 * on the browser to honour the CORS headers.
 *
 * This blocks cross-site requests made *by a browser*. It does not block a
 * scripted client, which can send any Origin it wants. Do not add
 * authorization decisions on top of this predicate.
 *
 * Configurable origins: production origin by default. Set DEV_ALLOWED_ORIGIN
 * (e.g. https://portalcolosseum-git-dev-keith-slades-projects.vercel.app)
 * to add a dev/preview origin for local testing.
 */
function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin === ALLOWED_ORIGIN) return true;
  if (DEV_ALLOWED_ORIGIN && origin === DEV_ALLOWED_ORIGIN) return true;
  return false;
}

/** In-memory token bucket for rate limiting. */
const RATE_LIMIT_REFILL_PER_SEC = 1;   // 60 tokens/minute
const RATE_LIMIT_BURST = 30;
const clientBuckets = new Map<string, { tokens: number; last: number }>();

/**
 * Simple token-bucket limiter keyed by the `x-forwarded-for` or `cf-connecting-ip`.
 * Returns false when the request is allowed. Best-effort: single-instance only.
 */
function isRateLimited(request: Request): boolean {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || request.headers.get('cf-connecting-ip')
    || 'unknown';

  const now = Date.now();
  const bucket = clientBuckets.get(clientIp);
  if (!bucket) {
    clientBuckets.set(clientIp, { tokens: RATE_LIMIT_BURST - 1, last: now });
    return false;
  }

  const elapsed = (now - bucket.last) / 1000;
  bucket.tokens = Math.min(RATE_LIMIT_BURST, bucket.tokens + elapsed * RATE_LIMIT_REFILL_PER_SEC);
  bucket.last = now;

  if (bucket.tokens < 1) {
    return true;
  }
  bucket.tokens -= 1;
  return false;
}

function json(body: unknown, status: number, headers = CORS_HEADERS): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Compare two strings without leaking, through timing, how many leading
 * characters matched. Length is not hidden, which is acceptable here.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.length !== bBytes.length) return false;

  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

/**
 * Create a Supabase client with the service_role key. Bypasses RLS, so it is
 * used exclusively to invoke the two locked-down RPCs below.
 */
function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    // Logged server-side; the caller only ever sees ERR_INTERNAL.
    throw new Error('Edge Function misconfigured: Supabase env vars missing');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Outcome of pulling the invite key out of a request body.
 *
 * 'absent' and 'rejected' are kept apart so the caller can say "you didn't
 * give me a key" rather than "your key is invalid" when nothing was sent —
 * neither branch reveals anything about which keys exist.
 */
type KeyRead =
  | { ok: true; key: string }
  | { ok: false; reason: 'absent' | 'rejected' };

/**
 * Extract the invite key from a request body, accepting JSON or
 * form-urlencoded.
 *
 * The size cap is checked against Content-Length first so an oversized body
 * is refused before it is buffered; the post-read check still stands as a
 * backstop for chunked requests that declare no length.
 */
async function readKeyFromBody(request: Request): Promise<KeyRead> {
  const declaredLength = Number(request.headers.get('content-length') ?? NaN);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return { ok: false, reason: 'rejected' };
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return { ok: false, reason: 'rejected' };

  const contentType = request.headers.get('content-type') || '';
  let candidate: unknown = null;

  if (contentType.includes('application/json')) {
    try {
      const parsed = JSON.parse(raw);
      candidate = parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>).key
        : null;
    } catch {
      return { ok: false, reason: 'absent' };
    }
  } else {
    candidate = new URLSearchParams(raw).get('key');
  }

  // Nothing supplied at all, versus something supplied that we won't accept.
  if (candidate === null || candidate === undefined) {
    return { ok: false, reason: 'absent' };
  }
  if (typeof candidate !== 'string') return { ok: false, reason: 'rejected' };

  const key = candidate.trim();
  if (key.length === 0) return { ok: false, reason: 'absent' };
  if (key.length > MAX_KEY_LENGTH) return { ok: false, reason: 'rejected' };

  return { ok: true, key };
}

/** Result of an invite key check. `error` is already client-safe. */
type ValidationResult = { valid: boolean; error?: string };

/**
 * Validate an invite key: hardcoded test key first (bypasses the DB and is
 * never consumed), then the database via the verify_invite_key RPC.
 */
async function validateInviteKey(key: string): Promise<ValidationResult> {
  const hardcodedKey = Deno.env.get('INVITE_KEY_HARDCODED') ?? '';
  if (hardcodedKey.length > 0 && timingSafeEqual(key, hardcodedKey)) {
    return { valid: true };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('verify_invite_key', { p_key: key });

  if (error) {
    // Never surface Postgres messages/details — they describe our schema.
    console.error('verify_invite_key RPC failed', { code: error.code });
    throw new Error('verify_invite_key RPC failed');
  }

  // The RPC returns { valid: boolean, reason: 'ok'|'invalid'|'used'|'missing' }.
  // `reason` is a stable machine code; the user-facing text lives here.
  const valid = data?.valid === true;
  if (valid) return { valid: true };

  switch (data?.reason) {
    case 'used':
      return { valid: false, error: ERR_KEY_USED };
    case 'missing':
      return { valid: false, error: ERR_KEY_REQUIRED };
    default:
      return { valid: false, error: ERR_KEY_INVALID };
  }
}

/**
 * Mark an invite key as used. The hardcoded test key is never consumed so it
 * keeps working across test runs.
 */
async function markKeyAsUsed(key: string): Promise<void> {
  const hardcodedKey = Deno.env.get('INVITE_KEY_HARDCODED') ?? '';
  if (hardcodedKey.length > 0 && timingSafeEqual(key, hardcodedKey)) {
    return;
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc('mark_invite_key_used', { p_key: key });

  if (error) {
    // Non-fatal: the key was already validated and the account exists. Log
    // for follow-up rather than failing the user's signup.
    console.error('mark_invite_key_used RPC failed', { code: error.code });
  }
}

async function handlePost(request: Request): Promise<Response> {
  const read = await readKeyFromBody(request);

  if (!read.ok) {
    // A key that is too long or the wrong type is a bad key, not a missing
    // one — saying "required" there just confuses the caller.
    const error = read.reason === 'absent' ? ERR_KEY_REQUIRED : ERR_KEY_INVALID;
    return json({ valid: false, error }, 400);
  }

  const result = await validateInviteKey(read.key);

  return result.valid
    ? json({ valid: true }, 200)
    : json({ valid: false, error: result.error ?? ERR_KEY_INVALID }, 400);
}

async function handleDelete(request: Request): Promise<Response> {
  const read = await readKeyFromBody(request);

  if (!read.ok) {
    const error = read.reason === 'absent' ? ERR_KEY_REQUIRED : ERR_KEY_INVALID;
    return json({ error }, 400);
  }

  await markKeyAsUsed(read.key);

  // Always the same response shape. Reporting whether a key existed or was
  // already consumed would turn this into an enumeration oracle.
  return json({ ok: true }, 200);
}

Deno.serve(async (request: Request): Promise<Response> => {
  // Origin check runs before anything else, for every method, and returns a
  // response carrying no CORS grant at all.
  if (!isAllowedOrigin(request)) {
    return json({ error: ERR_FORBIDDEN }, 403, DENY_HEADERS);
  }

  // Rate limit after origin check so we don't waste buckets on bad origins.
  if (isRateLimited(request)) {
    return json({ error: ERR_RATE_LIMIT }, 429, DENY_HEADERS);
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    switch (request.method) {
      case 'POST':
        return await handlePost(request);
      case 'DELETE':
        return await handleDelete(request);
      case 'GET':
        // Liveness only. No key validation via query string.
        return json({ status: 'ok' }, 200);
      default:
        return json({ error: ERR_METHOD }, 405);
    }
  } catch (err) {
    // The only place unexpected errors are described, and only to our logs.
    console.error('invite-verify unhandled error', {
      method: request.method,
      message: err instanceof Error ? err.message : 'unknown',
    });
    return json({ error: ERR_INTERNAL }, 500);
  }
});
