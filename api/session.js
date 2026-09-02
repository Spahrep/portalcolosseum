/**
 * Portal Colosseum - Session Management Edge Function
 * =====================================================
 * Provides HttpOnly cookie-based session persistence for the Supabase auth flow.
 *
 * The Supabase JS client uses an in-memory storage adapter (tokens never hit
 * localStorage), but that means sessions are lost on every page reload.
 * This Edge Function bridges that gap securely:
 *
 *  - POST /api/session  : Client sends { refresh_token } in the body.
 *                         The function exchanges it for a fresh access token
 *                         (via Supabase Admin API), then stores ONLY the
 *                         refresh_token in an HttpOnly/Secure/SameSite
 *                         cookie.  The access_token is returned in the JSON
 *                         body so the client can call setSession().
 *
 *  - GET  /api/session  : No body.  The function reads the refresh_token from
 *                         the HttpOnly cookie, exchanges it for a fresh access
 *                         token, and returns both tokens + user data as JSON.
 *                         If the cookie is absent or expired, returns 401.
 *
 *  - DELETE /api/session: Clears the session cookie (logout).
 *
 * Environment variables (set in Vercel project settings):
 *   - SUPABASE_URL            : Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY : Supabase service_role key (admin — NEVER
 *     exposed to the browser).  This is the ONLY secret this function needs.
 *
 * Security properties:
 *   - The refresh_token cookie is HttpOnly (JS cannot read it).
 *   - The cookie is Secure (HTTPS only).
 *   - SameSite=Lax prevents CSRF for state-changing requests.
 *   - The access_token is short-lived (returned to client but not persisted).
 */

// Create a Supabase admin client using the service_role key.
// This client bypasses RLS — use ONLY server-side.
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Cookie name for the HttpOnly refresh-token store
const REFRESH_TOKEN_COOKIE = 'supabase_refresh_token';

// Cookie attributes — HttpOnly, Secure, SameSite=Lax, 7-day expiry
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

function buildCookie(value, maxAge = COOKIE_MAX_AGE) {
  return `${REFRESH_TOKEN_COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function clearCookie() {
  return `${REFRESH_TOKEN_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

/**
 * Extract a cookie value by name from the Cookie header
 */
function getCookie(req, name) {
  const cookies = req.headers.get('cookie') || '';
  const match = cookies.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
  return match ? match[1] : null;
}

/**
 * Exchange a refresh token for a new session using the Supabase admin API.
 * The admin client's refreshSession uses the GoTrue admin endpoint which
 * accepts any refresh token — no need for the original client instance.
 */
async function exchangeRefreshToken(refreshToken) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error) {
    throw new Error(`Token exchange failed: ${error.message}`);
  }

  return data; // { session, user }
}

/**
 * CORS headers shared across all responses
 */
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Handle preflight requests
 */
export function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

/**
 * Handle GET: Read refresh token from HttpOnly cookie, return session
 */
export async function GET(request) {
  try {
    const refreshToken = getCookie(request, REFRESH_TOKEN_COOKIE);

    if (!refreshToken) {
      return new Response(
        JSON.stringify({ error: 'No session cookie' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    try {
      const { session, user } = await exchangeRefreshToken(refreshToken);

      // If the session contains a new refresh_token, update the cookie
      if (session.refresh_token && session.refresh_token !== refreshToken) {
        return new Response(
          JSON.stringify({ session, user }),
          {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              'Set-Cookie': buildCookie(session.refresh_token),
            },
          }
        );
      }

      return new Response(
        JSON.stringify({ session, user }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err) {
      // Token refresh failed — clear the cookie and return 401
      return new Response(
        JSON.stringify({ error: 'Session expired or invalid' }),
        {
          status: 401,
          headers: {
            ...CORS_HEADERS,
            'Set-Cookie': clearCookie(),
          },
        }
      );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

/**
 * Handle POST: Client provides refresh_token in body, we store it in cookie
 */
export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const { refresh_token } = body;

    if (!refresh_token) {
      return new Response(
        JSON.stringify({ error: 'refresh_token required in body' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Validate the token by attempting an exchange
    try {
      const { session, user } = await exchangeRefreshToken(refresh_token);

      return new Response(
        JSON.stringify({ session, user }),
        {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Set-Cookie': buildCookie(session.refresh_token || refresh_token),
          },
        }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Invalid refresh token' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

/**
 * Handle DELETE: Clear the session cookie (logout)
 */
export function DELETE() {
  return new Response(
    JSON.stringify({ ok: true }),
    {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Set-Cookie': clearCookie(),
      },
    }
  );
}
