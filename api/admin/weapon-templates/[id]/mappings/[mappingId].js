/**
 * /api/admin/weapon-templates/[id]/mappings/[mappingId]
 * PATCH  — update weight
 * DELETE — remove mapping
 */
import { CORS, OPTIONS, json, verifyAdmin } from '../../../../_shared.js';

export { OPTIONS };

export async function PATCH(request, { params }) {
  const auth = await verifyAdmin(request);
  if (auth.error) return json({ error: auth.error }, auth.status);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const update = {};
  if (body.weight !== undefined) update.weight = body.weight;

  if (Object.keys(update).length === 0) return json({ error: 'Nothing to update' }, 400);

  const { data, error } = await auth.admin
    .from('weapon_template_attack_mapping')
    .update(update)
    .eq('id', params.mappingId)
    .select()
    .single();

  if (error) return json({ error: error.message }, 400);
  return json({ data });
}

export async function DELETE(request, { params }) {
  const auth = await verifyAdmin(request);
  if (auth.error) return json({ error: auth.error }, auth.status);

  const { error } = await auth.admin
    .from('weapon_template_attack_mapping')
    .delete()
    .eq('id', params.mappingId);

  if (error) return json({ error: error.message }, 400);
  return json({ success: true });
}
