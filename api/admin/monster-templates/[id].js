/**
 * /api/admin/monster-templates/[id]
 * GET    — single monster template (with slot_0 attack name)
 * PUT    — update monster template
 * DELETE — delete monster template (blocks if FK dependencies exist)
 */
import { CORS, OPTIONS, json, verifyAdmin } from '../../_shared.js';

export { OPTIONS };

export async function GET(request, { params }) {
  const auth = await verifyAdmin(request);
  if (auth.error) return json({ error: auth.error }, auth.status);

  const { data, error } = await auth.admin
    .from('monster_template')
    .select('*, slot_0_attack:attack!slot_0_attack_id_fk(name)')
    .eq('id', params.id)
    .single();

  if (error) return json({ error: error.message }, 404);
  return json({ data });
}

export async function PUT(request, { params }) {
  const auth = await verifyAdmin(request);
  if (auth.error) return json({ error: auth.error }, auth.status);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  delete body.id;
  delete body.created_at;

  const { data, error } = await auth.admin
    .from('monster_template')
    .update(body)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return json({ error: error.message }, 400);
  return json({ data });
}

export async function DELETE(request, { params }) {
  const auth = await verifyAdmin(request);
  if (auth.error) return json({ error: auth.error }, auth.status);

  const id = params.id;
  const admin = auth.admin;
  const blockers = [];

  const { data: mi } = await admin.from('monster_instance').select('id').eq('template_id', id);
  if (mi && mi.length) blockers.push(`monster_instance: ${mi.length} row(s)`);

  const { data: mtm } = await admin.from('monster_template_attack_mapping').select('id').eq('monster_template_id', id);
  if (mtm && mtm.length) blockers.push(`monster_template_attack_mapping: ${mtm.length} row(s)`);

  if (blockers.length) {
    return json({ error: 'Cannot delete: this monster template is referenced by other records.', blockers }, 409);
  }

  const { error } = await admin.from('monster_template').delete().eq('id', id);
  if (error) return json({ error: error.message }, 400);
  return json({ success: true });
}
