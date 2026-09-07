/**
 * /api/admin/weapon-templates/[id]/mappings
 * GET  — list all attack mappings for a weapon template (with attack names)
 * POST — add an attack to a slot
 */
import { CORS, OPTIONS, json, verifyAdmin } from '../../../_shared.js';

export { OPTIONS };

export async function GET(request, { params }) {
  const auth = await verifyAdmin(request);
  if (auth.error) return json({ error: auth.error }, auth.status);

  const { data, error } = await auth.admin
    .from('weapon_template_attack_mapping')
    .select('id, weapon_template_id, attack_id, slot, weight, created_at, attack:attack!attack_id_fk(name, attack_type, is_spell)')
    .eq('weapon_template_id', params.id)
    .order('slot')
    .order('weight', { ascending: false });

  if (error) return json({ error: error.message }, 500);
  return json({ data });
}

export async function POST(request, { params }) {
  const auth = await verifyAdmin(request);
  if (auth.error) return json({ error: auth.error }, auth.status);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const { attack_id, slot, weight } = body;
  if (!attack_id || slot === undefined) return json({ error: 'attack_id and slot are required' }, 400);
  if (![1, 2, 3].includes(slot)) return json({ error: 'slot must be 1, 2, or 3' }, 400);

  const { data, error } = await auth.admin
    .from('weapon_template_attack_mapping')
    .insert({
      weapon_template_id: parseInt(params.id),
      attack_id,
      slot,
      weight: weight || 1.0,
    })
    .select()
    .single();

  if (error) return json({ error: error.message }, 400);
  return json({ data }, 201);
}
