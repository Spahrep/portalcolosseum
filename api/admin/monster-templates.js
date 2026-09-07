/**
 * /api/admin/monster-templates
 * GET  — list all monster templates (with slot_0 attack name)
 * POST — create a new monster template
 */
import { CORS, OPTIONS, json, verifyAdmin } from '../_shared.js';

export { OPTIONS };

export async function GET(request) {
  const auth = await verifyAdmin(request);
  if (auth.error) return json({ error: auth.error }, auth.status);

  const { data, error } = await auth.admin
    .from('monster_template')
    .select('*, slot_0_attack:attack!slot_0_attack_id_fk(name)')
    .order('name');

  if (error) return json({ error: error.message }, 500);
  return json({ data });
}

export async function POST(request) {
  const auth = await verifyAdmin(request);
  if (auth.error) return json({ error: auth.error }, auth.status);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  delete body.id;
  delete body.created_at;

  const { data, error } = await auth.admin
    .from('monster_template')
    .insert(body)
    .select()
    .single();

  if (error) return json({ error: error.message }, 400);
  return json({ data }, 201);
}
