/**
 * /api/admin/[...path].js
 * ========================
 * Single catch-all serverless function for ALL admin API routes.
 * This keeps us under Vercel Hobby plan's 12-function limit.
 *
 * Routes (matched via URL pathname):
 *   POST   /api/admin/auth-check
 *   GET    /api/admin/attacks
 *   POST   /api/admin/attacks
 *   GET    /api/admin/attacks/:id
 *   PUT    /api/admin/attacks/:id
 *   DELETE /api/admin/attacks/:id
 *   GET    /api/admin/weapon-templates
 *   POST   /api/admin/weapon-templates
 *   GET    /api/admin/weapon-templates/:id
 *   PUT    /api/admin/weapon-templates/:id
 *   DELETE /api/admin/weapon-templates/:id
 *   GET    /api/admin/weapon-templates/:id/mappings
 *   POST   /api/admin/weapon-templates/:id/mappings
 *   PATCH  /api/admin/weapon-templates/:id/mappings/:mappingId
 *   DELETE /api/admin/weapon-templates/:id/mappings/:mappingId
 *   GET    /api/admin/consumable-templates
 *   POST   /api/admin/consumable-templates
 *   GET    /api/admin/consumable-templates/:id
 *   PUT    /api/admin/consumable-templates/:id
 *   DELETE /api/admin/consumable-templates/:id
 *   GET    /api/admin/monster-templates
 *   POST   /api/admin/monster-templates
 *   GET    /api/admin/monster-templates/:id
 *   PUT    /api/admin/monster-templates/:id
 *   DELETE /api/admin/monster-templates/:id
 *   GET    /api/admin/monster-templates/:id/mappings
 *   POST   /api/admin/monster-templates/:id/mappings
 *   PATCH  /api/admin/monster-templates/:id/mappings/:mappingId
 *   DELETE /api/admin/monster-templates/:id/mappings/:mappingId
 */
import { createClient } from '@supabase/supabase-js';

// ============================================================
// SHARED HELPERS
// ============================================================

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://portalcolosseum.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
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

async function verifyAdmin(request) {
  let admin;
  try { admin = getAdminClient(); }
  catch (e) { return { error: 'Server config error', status: 500, debug: e.message }; }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return { error: 'No auth token', status: 401 };

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return { error: 'Invalid token', status: 401, debug: { error: error?.message, user: !!user } };

  const { data: profile, error: pe } = await admin
    .from('profiles').select('is_admin').eq('id', user.id).single();

  if (pe || !profile || !profile.is_admin)
    return { error: 'Admin access required', status: 403, debug: { profileError: pe?.message, profile: profile, userId: user.id } };
  return { admin, user };
}

async function getBody(request) {
  try { return await request.json(); } catch { return null; }
}

// Attack mappings, loot rows, and portal monster rows share the same
// list/create/patch/delete chrome. Column names and required-field checks
// differ, so those stay in the per-call config.
async function crudSubresource(admin, request, route, config) {
  const { method, id, subResource, mappingId } = route;
  if (!id || subResource !== config.sub) return null;

  if (method === 'GET') {
    let query = admin.from(config.table).select(config.select).eq(config.parentKey, id);
    for (const spec of config.order) {
      query = spec.ascending === undefined
        ? query.order(spec.column)
        : query.order(spec.column, { ascending: spec.ascending });
    }
    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);
    return json({ data });
  }

  if (method === 'POST') {
    const body = await getBody(request);
    if (!body) return json({ error: 'Invalid JSON' }, 400);
    for (const rule of config.required) {
      const missing = rule.present === 'defined' ? body[rule.field] === undefined : !body[rule.field];
      if (missing) return json({ error: config.requiredError }, 400);
    }
    if (config.slotMax != null) {
      const validSlots = Array.from({ length: config.slotMax }, (_, i) => i + 1);
      if (!validSlots.includes(body.slot)) return json({ error: `slot must be 1-${config.slotMax}` }, 400);
    }
    const row = { [config.parentKey]: id };
    for (const field of config.insertFields) row[field] = body[field];
    row.weight = body.weight || 1.0;
    const { data, error } = await admin.from(config.table).insert(row).select().single();
    if (error) return json({ error: error.message }, 400);
    return json({ data }, 201);
  }

  if (method === 'PATCH' && mappingId) {
    const body = await getBody(request);
    if (!body) return json({ error: 'Invalid JSON' }, 400);
    const update = {};
    for (const field of config.patchFields) {
      if (body[field] !== undefined) update[field] = body[field];
    }
    if (Object.keys(update).length === 0) return json({ error: 'Nothing to update' }, 400);
    const { data, error } = await admin.from(config.table).update(update).eq('id', mappingId).select().single();
    if (error) return json({ error: error.message }, 400);
    return json({ data });
  }

  if (method === 'DELETE' && mappingId) {
    const { error } = await admin.from(config.table).delete().eq('id', mappingId);
    if (error) return json({ error: error.message }, 400);
    return json({ success: true });
  }

  return null;
}

// ============================================================
// FK DELETE BLOCKERS
// ============================================================

async function checkAttackDeleteBlockers(admin, id) {
  const blockers = [];
  const { data: wt0 } = await admin.from('weapon_template').select('name').eq('slot_0_attack_id', id);
  if (wt0?.length) blockers.push(`weapon_template (slot_0): ${wt0.map(r => r.name).join(', ')}`);
  const { data: mt0 } = await admin.from('monster_template').select('name').eq('slot_0_attack_id', id);
  if (mt0?.length) blockers.push(`monster_template (slot_0): ${mt0.map(r => r.name).join(', ')}`);
  const { data: wtm } = await admin.from('weapon_template_attack_mapping').select('id').eq('attack_id', id);
  if (wtm?.length) blockers.push(`weapon_template_attack_mapping: ${wtm.length} row(s)`);
  const { data: mtm } = await admin.from('monster_template_attack_mapping').select('id').eq('attack_id', id);
  if (mtm?.length) blockers.push(`monster_template_attack_mapping: ${mtm.length} row(s)`);
  for (let s = 0; s <= 4; s++) {
    const { data: wi } = await admin.from('weapon_instance').select('id').eq(`slot_${s}_attack_id`, id);
    if (wi?.length) blockers.push(`weapon_instance.slot_${s}: ${wi.length} row(s)`);
  }
  return blockers;
}

async function checkWeaponTemplateDeleteBlockers(admin, id) {
  const blockers = [];
  const { data: wi } = await admin.from('weapon_instance').select('id').eq('template_id', id);
  if (wi?.length) blockers.push(`weapon_instance: ${wi.length} row(s)`);
  const { data: wtm } = await admin.from('weapon_template_attack_mapping').select('id').eq('weapon_template_id', id);
  if (wtm?.length) blockers.push(`weapon_template_attack_mapping: ${wtm.length} row(s)`);
  return blockers;
}

async function checkMonsterTemplateDeleteBlockers(admin, id) {
  const blockers = [];
  const { data: mtm } = await admin.from('monster_template_attack_mapping').select('id').eq('monster_template_id', id);
  if (mtm?.length) blockers.push(`monster_template_attack_mapping: ${mtm.length} row(s)`);
  const { data: mlm } = await admin.from('monster_loot_mapping').select('id').eq('monster_template_id', id);
  if (mlm?.length) blockers.push(`monster_loot_mapping: ${mlm.length} row(s)`);
  return blockers;
}

async function checkPortalTemplateDeleteBlockers(admin, id) {
  const blockers = [];
  const { data: pmm } = await admin.from('portal_monster_mapping').select('id').eq('portal_template_id', id);
  if (pmm?.length) blockers.push(`portal_monster_mapping: ${pmm.length} row(s)`);
  const { data: plm } = await admin.from('portal_loot_mapping').select('id').eq('portal_template_id', id);
  if (plm?.length) blockers.push(`portal_loot_mapping: ${plm.length} row(s)`);
  return blockers;
}

async function checkConsumableTemplateDeleteBlockers(admin, id) {
  const blockers = [];
  const { data: ci } = await admin.from('consumable_instance').select('id').eq('template_id', id);
  if (ci?.length) blockers.push(`consumable_instance: ${ci.length} row(s)`);
  return blockers;
}

function validateConsumableTemplate(b) {
  const EFFECT_TYPES = ['heal', 'speed', 'accuracy', 'damage'];
  if (!b.name || typeof b.name !== 'string' || !b.name.trim()) return 'name is required';
  if (!EFFECT_TYPES.includes(b.effect_type)) return `effect_type must be one of: ${EFFECT_TYPES.join(', ')}`;
  for (const f of ['floor_base', 'floor_delta', 'window_base', 'window_delta', 'speed_base', 'speed_delta']) {
    const v = b[f];
    if (!Number.isInteger(v)) return `${f} must be an integer`;
    if (v < 0) return `${f} must be >= 0 (+only deltas, no negative values)`;
  }
  if (b.floor_base < 1) return 'floor_base must be >= 1';
  if (b.effect_type === 'heal' && b.duration_ticks !== null && b.duration_ticks !== undefined)
    return 'heal templates have no duration (duration_ticks must be null)';
  if (b.effect_type !== 'heal' && b.duration_ticks !== null && b.duration_ticks !== undefined
      && (!Number.isInteger(b.duration_ticks) || b.duration_ticks <= 0))
    return 'duration_ticks must be a positive integer';
  return null;
}

// ============================================================
// MAIN HANDLER
// ============================================================

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function GET(request) { return handle(request, 'GET'); }
export async function POST(request) { return handle(request, 'POST'); }
export async function PUT(request) { return handle(request, 'PUT'); }
export async function PATCH(request) { return handle(request, 'PATCH'); }
export async function DELETE(request) { return handle(request, 'DELETE'); }

async function handle(request, method) {
  // Parse path segments from the URL directly (Vercel doesn't pass params reliably)
  const url = new URL(request.url);
  const fullPath = url.pathname.replace(/^\/api\/admin\//, '');
  const path = fullPath ? fullPath.split('/').filter(Boolean) : [];

  const auth = await verifyAdmin(request);
  if (auth.error) return json({ error: auth.error, debug: auth.debug }, auth.status);

  const admin = auth.admin;
  const resource = path[0]; // 'attacks', 'weapon-templates', 'monster-templates', 'auth-check'
  const id = path[1] ? parseInt(path[1]) : null;
  const subResource = path[2]; // 'mappings'
  const mappingId = path[3] ? parseInt(path[3]) : null;

  // ---- AUTH CHECK ----
  if (resource === 'auth-check' && method === 'POST') {
    return json({ is_admin: true, user_id: auth.user.id });
  }

  // ---- ATTACKS ----
  if (resource === 'attacks') {
    if (method === 'GET' && !id) {
      const { data, error } = await admin.from('attack').select('*').order('name');
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }
    if (method === 'POST' && !id) {
      const body = await getBody(request);
      if (!body) return json({ error: 'Invalid JSON' }, 400);
      const { data, error } = await admin.from('attack').insert(body).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data }, 201);
    }
    if (method === 'GET' && id) {
      const { data, error } = await admin.from('attack').select('*').eq('id', id).single();
      if (error) return json({ error: error.message }, 404);
      return json({ data });
    }
    if (method === 'PUT' && id) {
      const body = await getBody(request);
      if (!body) return json({ error: 'Invalid JSON' }, 400);
      delete body.id; delete body.created_at; body.updated_at = new Date().toISOString();
      const { data, error } = await admin.from('attack').update(body).eq('id', id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }
    if (method === 'DELETE' && id) {
      const blockers = await checkAttackDeleteBlockers(admin, id);
      if (blockers.length) return json({ error: 'Cannot delete: referenced by other records.', blockers }, 409);
      const { error } = await admin.from('attack').delete().eq('id', id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }
  }

  // ---- WEAPON TEMPLATES ----
  if (resource === 'weapon-templates') {
    const table = 'weapon_template';
    const mappingTable = 'weapon_template_attack_mapping';
    const templateIdCol = 'weapon_template_id';
    const maxSlot = 3;

    if (method === 'GET' && !id) {
      const { data, error } = await admin.from(table).select('*, slot_0_attack:attack!weapon_template_slot_0_attack_id_fkey(name)').order('name');
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }
    if (method === 'POST' && !id) {
      const body = await getBody(request);
      if (!body) return json({ error: 'Invalid JSON' }, 400);
      delete body.id; delete body.created_at; delete body.updated_at;
      const { data, error } = await admin.from(table).insert(body).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data }, 201);
    }
    if (method === 'GET' && id && !subResource) {
      const { data, error } = await admin.from(table).select('*, slot_0_attack:attack!weapon_template_slot_0_attack_id_fkey(name)').eq('id', id).single();
      if (error) return json({ error: error.message }, 404);
      return json({ data });
    }
    if (method === 'PUT' && id && !subResource) {
      const body = await getBody(request);
      if (!body) return json({ error: 'Invalid JSON' }, 400);
      delete body.id; delete body.created_at; delete body.updated_at; body.updated_at = new Date().toISOString();
      const { data, error } = await admin.from(table).update(body).eq('id', id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }
    if (method === 'DELETE' && id && !subResource) {
      const blockers = await checkWeaponTemplateDeleteBlockers(admin, id);
      if (blockers.length) return json({ error: 'Cannot delete: referenced by other records.', blockers }, 409);
      const { error } = await admin.from(table).delete().eq('id', id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }
    const mappingRes = await crudSubresource(admin, request, { method, id, subResource, mappingId }, {
      table: mappingTable,
      parentKey: templateIdCol,
      sub: 'mappings',
      select: `id, ${templateIdCol}, attack_id, slot, weight, created_at, attack:attack!weapon_template_attack_attack_id_fkey(name)`,
      order: [{ column: 'slot' }, { column: 'weight', ascending: false }],
      required: [
        { field: 'attack_id', present: 'truthy' },
        { field: 'slot', present: 'defined' },
      ],
      requiredError: 'attack_id and slot required',
      slotMax: maxSlot,
      insertFields: ['attack_id', 'slot'],
      patchFields: ['weight'],
    });
    if (mappingRes) return mappingRes;
  }

  // ---- MONSTER TEMPLATES ----
  if (resource === 'monster-templates') {
    const table = 'monster_template';
    const mappingTable = 'monster_template_attack_mapping';
    const templateIdCol = 'monster_template_id';
    const maxSlot = 4;

    if (method === 'GET' && !id) {
      const { data, error } = await admin.from(table).select('*, slot_0_attack:attack!monster_template_slot_0_attack_id_fkey(name)').order('name');
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }
    if (method === 'POST' && !id) {
      const body = await getBody(request);
      if (!body) return json({ error: 'Invalid JSON' }, 400);
      delete body.id; delete body.created_at;
      const { data, error } = await admin.from(table).insert(body).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data }, 201);
    }
    if (method === 'GET' && id && !subResource) {
      const { data, error } = await admin.from(table).select('*, slot_0_attack:attack!monster_template_slot_0_attack_id_fkey(name)').eq('id', id).single();
      if (error) return json({ error: error.message }, 404);
      return json({ data });
    }
    if (method === 'PUT' && id && !subResource) {
      const body = await getBody(request);
      if (!body) return json({ error: 'Invalid JSON' }, 400);
      delete body.id; delete body.created_at;
      const { data, error } = await admin.from(table).update(body).eq('id', id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }
    if (method === 'DELETE' && id && !subResource) {
      const blockers = await checkMonsterTemplateDeleteBlockers(admin, id);
      if (blockers.length) return json({ error: 'Cannot delete: referenced by other records.', blockers }, 409);
      const { error } = await admin.from(table).delete().eq('id', id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }
    const mappingRes = await crudSubresource(admin, request, { method, id, subResource, mappingId }, {
      table: mappingTable,
      parentKey: templateIdCol,
      sub: 'mappings',
      select: `id, ${templateIdCol}, attack_id, slot, weight, created_at, attack:attack!monster_template_attack_mapping_attack_id_fkey(name)`,
      order: [{ column: 'slot' }, { column: 'weight', ascending: false }],
      required: [
        { field: 'attack_id', present: 'truthy' },
        { field: 'slot', present: 'defined' },
      ],
      requiredError: 'attack_id and slot required',
      slotMax: maxSlot,
      insertFields: ['attack_id', 'slot'],
      patchFields: ['weight'],
    });
    if (mappingRes) return mappingRes;

    // ---- Monster Loot Mappings (FK to weapon_template) ----
    const lootRes = await crudSubresource(admin, request, { method, id, subResource, mappingId }, {
      table: 'monster_loot_mapping',
      parentKey: 'monster_template_id',
      sub: 'loot',
      select: 'id, monster_template_id, weapon_template_id, lp_cost, weight, created_at, weapon_template:weapon_template!monster_loot_mapping_weapon_template_id_fkey(name)',
      order: [{ column: 'weight', ascending: false }],
      required: [
        { field: 'weapon_template_id', present: 'truthy' },
        { field: 'lp_cost', present: 'defined' },
      ],
      requiredError: 'weapon_template_id and lp_cost required',
      insertFields: ['weapon_template_id', 'lp_cost'],
      patchFields: ['lp_cost', 'weight'],
    });
    if (lootRes) return lootRes;
  }

  // ---- PORTAL TEMPLATES ----
  if (resource === 'portal-templates') {
    const table = 'portal_template';

    if (method === 'GET' && !id) {
      const { data, error } = await admin.from(table).select('*').order('name');
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }
    if (method === 'POST' && !id) {
      const body = await getBody(request);
      if (!body) return json({ error: 'Invalid JSON' }, 400);
      // Convert face arrays from comma strings to int arrays
      ['green_faces', 'yellow_faces', 'red_faces'].forEach(f => {
        if (body[f] && typeof body[f] === 'string') {
          body[f] = body[f].split(',').map(s => parseInt(s.trim()));
        }
      });
      delete body.id; delete body.created_at;
      const { data, error } = await admin.from(table).insert(body).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data }, 201);
    }
    if (method === 'GET' && id && !subResource) {
      const { data, error } = await admin.from(table).select('*').eq('id', id).single();
      if (error) return json({ error: error.message }, 404);
      return json({ data });
    }
    if (method === 'PUT' && id && !subResource) {
      const body = await getBody(request);
      if (!body) return json({ error: 'Invalid JSON' }, 400);
      ['green_faces', 'yellow_faces', 'red_faces'].forEach(f => {
        if (body[f] && typeof body[f] === 'string') {
          body[f] = body[f].split(',').map(s => parseInt(s.trim()));
        }
      });
      delete body.id; delete body.created_at;
      const { data, error } = await admin.from(table).update(body).eq('id', id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }
    if (method === 'DELETE' && id && !subResource) {
      const blockers = await checkPortalTemplateDeleteBlockers(admin, id);
      if (blockers.length) return json({ error: 'Cannot delete: referenced by other records.', blockers }, 409);
      const { error } = await admin.from(table).delete().eq('id', id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    // ---- Portal Monster Mappings ----
    const monsterRes = await crudSubresource(admin, request, { method, id, subResource, mappingId }, {
      table: 'portal_monster_mapping',
      parentKey: 'portal_template_id',
      sub: 'monsters',
      select: 'id, portal_template_id, monster_template_id, point_cost, weight, created_at, monster_template:monster_template!portal_monster_mapping_monster_template_id_fkey(name)',
      order: [{ column: 'weight', ascending: false }],
      required: [
        { field: 'monster_template_id', present: 'truthy' },
        { field: 'point_cost', present: 'defined' },
      ],
      requiredError: 'monster_template_id and point_cost required',
      insertFields: ['monster_template_id', 'point_cost'],
      patchFields: ['point_cost', 'weight'],
    });
    if (monsterRes) return monsterRes;

    // ---- Portal Loot Mappings (FK to weapon_template) ----
    const lootRes = await crudSubresource(admin, request, { method, id, subResource, mappingId }, {
      table: 'portal_loot_mapping',
      parentKey: 'portal_template_id',
      sub: 'loot',
      select: 'id, portal_template_id, weapon_template_id, lp_cost, weight, created_at, weapon_template:weapon_template!portal_loot_mapping_weapon_template_id_fkey(name)',
      order: [{ column: 'weight', ascending: false }],
      required: [
        { field: 'weapon_template_id', present: 'truthy' },
        { field: 'lp_cost', present: 'defined' },
      ],
      requiredError: 'weapon_template_id and lp_cost required',
      insertFields: ['weapon_template_id', 'lp_cost'],
      patchFields: ['lp_cost', 'weight'],
    });
    if (lootRes) return lootRes;
  }

  // ---- CONSUMABLE TEMPLATES ----
  if (resource === 'consumable-templates') {
    const table = 'consumable_template';

    if (method === 'GET' && !id) {
      const { data, error } = await admin.from(table).select('*').order('name');
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }
    if (method === 'POST' && !id) {
      const body = await getBody(request);
      if (!body) return json({ error: 'Invalid JSON' }, 400);
      const v = validateConsumableTemplate(body);
      if (v) return json({ error: v }, 400);
      delete body.id; delete body.created_at; delete body.updated_at;
      const { data, error } = await admin.from(table).insert(body).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data }, 201);
    }
    if (method === 'GET' && id) {
      const { data, error } = await admin.from(table).select('*').eq('id', id).single();
      if (error) return json({ error: error.message }, 404);
      return json({ data });
    }
    if (method === 'PUT' && id) {
      const body = await getBody(request);
      if (!body) return json({ error: 'Invalid JSON' }, 400);
      const v = validateConsumableTemplate(body);
      if (v) return json({ error: v }, 400);
      delete body.id; delete body.created_at; delete body.updated_at;
      const { data, error } = await admin.from(table).update(body).eq('id', id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }
    if (method === 'DELETE' && id) {
      const blockers = await checkConsumableTemplateDeleteBlockers(admin, id);
      if (blockers.length) return json({ error: 'Cannot delete: referenced by other records.', blockers }, 409);
      const { error } = await admin.from(table).delete().eq('id', id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }
  }

  return json({ error: 'Not found' }, 404);
}
