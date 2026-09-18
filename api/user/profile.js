/**
 * /api/user/profile.js
 * ====================
 * Vercel serverless function for user profile settings.
 * 
 * GET  /api/user/profile — returns the authenticated user's profile (settings)
 * PATCH /api/user/profile — updates settings (partial merge into JSONB)
 *
 * Auth: Bearer token in Authorization header (Supabase access_token)
 * CORS: Restricted to portalcolosseum.com
 */

import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://portalcolosseum.com',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing server config');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function verifyUser(request) {
  let admin;
  try { admin = getAdminClient(); } catch (e) { return { error: 'Server config error', status: 500 }; }
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return { error: 'No auth token', status: 401 };
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return { error: 'Invalid token', status: 401 };
  return { admin, user };
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * GET — return the authenticated user's profile (settings JSONB included)
 */
export async function GET(request) {
  const auth = await verifyUser(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  const { admin, user } = auth;

  try {
    const { data, error } = await admin
      .from('profiles')
      .select('settings')
      .eq('id', user.id)
      .maybeSingle();

    if (error) return json({ error: 'Database error' }, 500);
    if (!data) return json({ error: 'Profile not found' }, 404);

    return json({ settings: data.settings || {} });
  } catch (err) {
    return json({ error: err.message || 'Internal server error' }, 500);
  }
}

/**
 * PATCH — merge provided settings into the user's profile settings JSONB
 * Body: { settings: { ... } } — partial merge, existing keys not in body persist
 */
export async function PATCH(request) {
  const auth = await verifyUser(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  const { admin, user } = auth;

  let body;
  try { body = await request.json(); } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const newSettings = body.settings;
  if (!newSettings || typeof newSettings !== 'object') {
    return json({ error: 'settings object required in body' }, 400);
  }

  try {
    // Use jsonb_merge (||) to do a partial update — keeps existing keys not in body
    const { data, error } = await admin
      .from('profiles')
      .update({ settings: admin.rpc('jsonb_merge', { base: admin.rpc('jsonb_merge', {}), override: newSettings }) })
      .eq('id', user.id)
      .select('settings')
      .single();

    // Simpler approach: fetch current, merge, write back
    const { data: current } = await admin
      .from('profiles')
      .select('settings')
      .eq('id', user.id)
      .maybeSingle();

    const merged = { ...(current?.settings || {}), ...newSettings };

    const { data: updated, error: updateError } = await admin
      .from('profiles')
      .update({ settings: merged })
      .eq('id', user.id)
      .select('settings')
      .single();

    if (updateError) return json({ error: 'Update failed' }, 500);

    return json({ settings: updated.settings });
  } catch (err) {
    return json({ error: err.message || 'Internal server error' }, 500);
  }
}