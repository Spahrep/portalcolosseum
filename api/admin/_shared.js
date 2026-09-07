/**
 * Portal Colosseum - Admin API Shared Helper
 * ===========================================
 * NOT a route — imported by all /api/admin/* routes.
 * Vercel ignores files starting with _ in the /api directory.
 */
import { createClient } from '@supabase/supabase-js';

export const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://portalcolosseum.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

export function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, ...extra },
  });
}

export function getAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function verifyAdmin(request) {
  let admin;
  try {
    admin = getAdminClient();
  } catch (e) {
    return { error: 'Server config error', status: 500 };
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return { error: 'No auth token', status: 401 };

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return { error: 'Invalid token', status: 401 };

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !profile.is_admin) {
    return { error: 'Admin access required', status: 403 };
  }

  return { admin, user };
}
