/**
 * Shared combat HTTP stack (CORS, json, JWT verify).
 * Copied from api/combat/[...path].js — same headers, same error strings.
 */
import { createClient } from '@supabase/supabase-js';

let adminClientOverride = null;
/** Test-only injection. Production leaves this null. */
export function __setAdminClientForTests(client) {
  adminClientOverride = client;
}

export const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://portalcolosseum.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

export function getAdminClient() {
  if (adminClientOverride) return adminClientOverride;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing server config');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function verifyUser(request) {
  let admin;
  try { admin = getAdminClient(); } catch (e) { return { error: 'Server config error', status: 500 }; }
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return { error: 'No auth token', status: 401 };
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return { error: 'Invalid token', status: 401 };
  return { admin, user };
}

/** Combat dev admin gate. Same strings as the inlined profiles.is_admin checks. */
export async function verifyAdmin(admin, user) {
  let profile;
  try {
    const pRes = await admin.from('profiles').select('is_admin').eq('id', user.id).single();
    profile = pRes.data;
    if (pRes.error) throw pRes.error;
  } catch (e) {
    console.error('admin profile check error', e);
    return { error: 'Internal server error', status: 500 };
  }
  if (!profile || !profile.is_admin) {
    return { error: 'Admin access required', status: 403 };
  }
  return { admin, user, profile };
}
