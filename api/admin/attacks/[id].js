/**
 * /api/admin/attacks/[id]
 * GET    — single attack
 * PUT    — update attack
 * DELETE — delete attack (blocks if FK dependencies exist)
 */
import { CORS, OPTIONS, json, verifyAdmin } from '../../_shared.js';

export { OPTIONS };

export async function GET(request, { params }) {
  const auth = await verifyAdmin(request);
  if (auth.error) return json({ error: auth.error }, auth.status);

  const { data, error } = await auth.admin
    .from('attack')
    .select('*')
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
  body.updated_at = new Date().toISOString();

  const { data, error } = await auth.admin
    .from('attack')
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

  // Check weapon_template.slot_0_attack_id
  const { data: wt0 } = await admin.from('weapon_template').select('name').eq('slot_0_attack_id', id);
  if (wt0 && wt0.length) blockers.push(`weapon_template (slot_0): ${wt0.map(r => r.name).join(', ')}`);

  // Check monster_template.slot_0_attack_id
  const { data: mt0 } = await admin.from('monster_template').select('name').eq('slot_0_attack_id', id);
  if (mt0 && mt0.length) blockers.push(`monster_template (slot_0): ${mt0.map(r => r.name).join(', ')}`);

  // Check weapon_template_attack_mapping
  const { data: wtm } = await admin.from('weapon_template_attack_mapping').select('id, weapon_template_id').eq('attack_id', id);
  if (wtm && wtm.length) blockers.push(`weapon_template_attack_mapping: ${wtm.length} row(s)`);

  // Check monster_template_attack_mapping
  const { data: mtm } = await admin.from('monster_template_attack_mapping').select('id, monster_template_id').eq('attack_id', id);
  if (mtm && mtm.length) blockers.push(`monster_template_attack_mapping: ${mtm.length} row(s)`);

  // Check weapon_instance slots
  for (let s = 0; s <= 4; s++) {
    const { data: wi } = await admin.from('weapon_instance').select('id').eq(`slot_${s}_attack_id`, id);
    if (wi && wi.length) blockers.push(`weapon_instance.slot_${s}: ${wi.length} row(s)`);
  }

  // Check monster_instance slots
  for (let s = 0; s <= 4; s++) {
    const { data: mi } = await admin.from('monster_instance').select('id').eq(`slot_${s}_attack_id`, id);
    if (mi && mi.length) blockers.push(`monster_instance.slot_${s}: ${mi.length} row(s)`);
  }

  if (blockers.length) {
    return json({ error: 'Cannot delete: this attack is referenced by other records.', blockers }, 409);
  }

  const { error } = await admin.from('attack').delete().eq('id', id);
  if (error) return json({ error: error.message }, 400);
  return json({ success: true });
}
