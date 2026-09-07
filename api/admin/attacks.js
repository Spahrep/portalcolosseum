/**
 * /api/admin/attacks
 * GET  — list all attacks
 * POST — create a new attack
 */
import { CORS, OPTIONS, json, verifyAdmin } from '../_shared.js';

export { OPTIONS };

export async function GET(request) {
  const auth = await verifyAdmin(request);
  if (auth.error) return json({ error: auth.error }, auth.status);

  const { data, error } = await auth.admin
    .from('attack')
    .select('*')
    .order('name');

  if (error) return json({ error: error.message }, 500);
  return json({ data });
}

export async function POST(request) {
  const auth = await verifyAdmin(request);
  if (auth.error) return json({ error: auth.error }, auth.status);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const { data, error } = await auth.admin
    .from('attack')
    .insert(body)
    .select()
    .single();

  if (error) return json({ error: error.message }, 400);
  return json({ data }, 201);
}
