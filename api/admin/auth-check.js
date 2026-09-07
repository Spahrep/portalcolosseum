import { createClient } from '@supabase/supabase-js';

async function verifyAdmin(request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
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

export async function POST(request) {
  const result = await verifyAdmin(request);
  if (result.error) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://portalcolosseum.com' }
    });
  }
  return new Response(JSON.stringify({ is_admin: true, user_id: result.user.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://portalcolosseum.com' }
  });
}
