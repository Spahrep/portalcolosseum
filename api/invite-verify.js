/**
 * Portal Colosseum - Alpha Invite Verification Edge Function
 * ===========================================================
 * Validates invite keys for the alpha signup system.
 *
 * Request: POST /api/invite-verify
 *   Body: { "key": "<invite-code>" }
 *
 * Response:
 *   200 { "valid": true }   — key is valid (hardcoded test key or valid DB key)
 *   400 { "valid": false, "error": "..." } — key is invalid or already used
 *
 * Security:
 *   - The hardcoded test key "EyeOfTheWorld" is read from the INVITE_KEY_HARDCODED
 *     environment variable (set in Vercel project settings). This bypasses the DB
 *     and is never expired (for testing purposes).
 *   - Real invite keys are stored in the invite_keys table (one-time use).
 *   - This function uses the Supabase service_role key (SUPABASE_SERVICE_ROLE_KEY)
 *     which is only available server-side. The anon key cannot mark keys as used.
 *
 * Environment variables (set in Vercel project settings):
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY  (admin — bypasses RLS, never exposed to client)
 *   - INVITE_KEY_HARDCODED       (test key, e.g. "EyeOfTheWorld")
 */

import { createClient } from '@supabase/supabase-js';

// Create a Supabase admin client using the service_role key.
// This client bypasses RLS — use ONLY server-side.
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

/**
 * Parse JSON body from request
 */
async function parseBody(req) {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await req.json();
  }
  const text = await req.text();
  const params = new URLSearchParams(text);
  return Object.fromEntries(params);
}

/**
 * Validate an invite key.
 * Checks the hardcoded test key first (env var), then the database.
 * Returns { valid: true } if the key is valid, { valid: false, error: "..." } otherwise.
 */
async function validateInviteKey(key) {
  if (!key || key.trim().length === 0) {
    return { valid: false, error: 'Invite key is required' };
  }

  // Check hardcoded test key first (bypasses DB for testing)
  const hardcodedKey = process.env.INVITE_KEY_HARDCODED || '***';
  if (hardcodedKey !== '***' && key === hardcodedKey) {
    return { valid: true };
  }

  // Check the database for a valid, unused key
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('invite_keys')
    .select('id, used')
    .eq('key', key)
    .single();

  if (error) {
    // PGRST116 = no rows found → invalid key
    if (error.code === 'PGRST116') {
      return { valid: false, error: 'Invalid invite key' };
    }
    console.error('Database error during invite validation:', error);
    return { valid: false, error: 'Server error during validation' };
  }

  if (data.used) {
    return { valid: false, error: 'This invite key has already been used' };
  }

  return { valid: true };
}

/**
 * Mark an invite key as used in the database.
 * Called after successful account creation.
 */
async function markKeyAsUsed(key) {
  const supabase = getSupabaseAdmin();
  const hardcodedKey = process.env.INVITE_KEY_HARDCODED || '***';

  // Skip DB marking for the hardcoded test key
  if (hardcodedKey !== '***' && key === hardcodedKey) {
    return;
  }

  const { error } = await supabase
    .from('invite_keys')
    .update({ used: true })
    .eq('key', key);

  if (error) {
    console.error('Failed to mark invite key as used:', error);
  }
}

/**
 * Handle incoming requests
 */
export default async function handler(req) {
  const method = req.method;

  try {
    if (method === 'POST') {
      // Validate an invite key
      const body = await parseBody(req);
      const { key } = body;

      const result = await validateInviteKey(key);

      if (result.valid) {
        return new Response(JSON.stringify({ valid: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ valid: false, error: result.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (method === 'DELETE') {
      // Mark key as used (called after successful account creation)
      const url = new URL(req.url);
      const key = url.searchParams.get('key');

      if (!key) {
        return new Response(JSON.stringify({ error: 'key parameter is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      await markKeyAsUsed(key);

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Allow': 'POST, DELETE' },
    });
  } catch (err) {
    console.error('Invite verify error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
