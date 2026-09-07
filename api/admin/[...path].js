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
    const { data: mi } = await admin.from('monster_instance').select('id').eq(`slot_${s}_attack_id`, id);
    if (mi?.length) blockers.push(`monster_instance.slot_${s}: ${mi.length} row(s)`);
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
  const { data: mi } = await admin.from('monster_instance').select('id').eq('template_id', id);
  if (mi?.length) blockers.push(`monster_instance: ${mi.length} row(s)`);
  const { data: mtm } = await admin.from('monster_template_attack_mapping').select('id').eq('monster_template_id', id);
  if (mtm?.length) blockers.push(`monster_template_attack_mapping: ${mtm.length} row(s)`);
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
    if (method === 'GET' && id && subResource === 'mappings') {
      const { data, error } = await admin.from(mappingTable)
        .select(`id, ${templateIdCol}, attack_id, slot, weight, created_at, attack:attack!weapon_template_attack_attack_id_fkey(name)`)
        .eq(templateIdCol, id).order('slot').order('weight', { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }
    if (method === 'POST' && id && subResource === 'mappings') {
      const body = await getBody(request);
      if (!body) return json({ error: 'Invalid JSON' }, 400);
      const { attack_id, slot, weight } = body;
      if (!attack_id || slot === undefined) return json({ error: 'attack_id and slot required' }, 400);
      const validSlots = Array.from({ length: maxSlot }, (_, i) => i + 1);
      if (!validSlots.includes(slot)) return json({ error: `slot must be 1-${maxSlot}` }, 400);
      const { data, error } = await admin.from(mappingTable).insert({
        [templateIdCol]: id, attack_id, slot, weight: weight || 1.0,
      }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data }, 201);
    }
    if (method === 'PATCH' && id && subResource === 'mappings' && mappingId) {
      const body = await getBody(request);
      if (!body) return json({ error: 'Invalid JSON' }, 400);
      const update = {};
      if (body.weight !== undefined) update.weight = body.weight;
      if (Object.keys(update).length === 0) return json({ error: 'Nothing to update' }, 400);
      const { data, error } = await admin.from(mappingTable).update(update).eq('id', mappingId).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }
    if (method === 'DELETE' && id && subResource === 'mappings' && mappingId) {
      const { error } = await admin.from(mappingTable).delete().eq('id', mappingId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }
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
    if (method === 'GET' && id && subResource === 'mappings') {
      const { data, error } = await admin.from(mappingTable)
        .select(`id, ${templateIdCol}, attack_id, slot, weight, created_at, attack:attack!monster_template_attack_mapping_attack_id_fkey(name)`)
        .eq(templateIdCol, id).order('slot').order('weight', { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }
    if (method === 'POST' && id && subResource === 'mappings') {
      const body = await getBody(request);
      if (!body) return json({ error: 'Invalid JSON' }, 400);
      const { attack_id, slot, weight } = body;
      if (!attack_id || slot === undefined) return json({ error: 'attack_id and slot required' }, 400);
      const validSlots = Array.from({ length: maxSlot }, (_, i) => i + 1);
      if (!validSlots.includes(slot)) return json({ error: `slot must be 1-${maxSlot}` }, 400);
      const { data, error } = await admin.from(mappingTable).insert({
        [templateIdCol]: id, attack_id, slot, weight: weight || 1.0,
      }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data }, 201);
    }
    if (method === 'PATCH' && id && subResource === 'mappings' && mappingId) {
      const body = await getBody(request);
      if (!body) return json({ error: 'Invalid JSON' }, 400);
      const update = {};
      if (body.weight !== undefined) update.weight = body.weight;
      if (Object.keys(update).length === 0) return json({ error: 'Nothing to update' }, 400);
      const { data, error } = await admin.from(mappingTable).update(update).eq('id', mappingId).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }
    if (method === 'DELETE' && id && subResource === 'mappings' && mappingId) {
      const { error } = await admin.from(mappingTable).delete().eq('id', mappingId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }
  }

  // ---- PORTAL TEMPLATES ----
  if (resource === 'portal-templates') {
    const table = 'portal_template';

    if (method === 'GET' && !id) {
      const { data, error } = await admin.from(table).select('*').order('tier').order('name');
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
    if (method === 'GET' && id && subResource === 'monsters') {
      const { data, error } = await admin.from('portal_monster_mapping')
        .select('id, portal_template_id, monster_template_id, point_cost, weight, created_at, monster_template:monster_template!portal_monster_mapping_monster_template_id_fkey(name)')
        .eq('portal_template_id', id).order('weight', { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }
    if (method === 'POST' && id && subResource === 'monsters') {
      const body = await getBody(request);
      if (!body) return json({ error: 'Invalid JSON' }, 400);
      const { monster_template_id, point_cost, weight } = body;
      if (!monster_template_id || point_cost === undefined) return json({ error: 'monster_template_id and point_cost required' }, 400);
      const { data, error } = await admin.from('portal_monster_mapping').insert({
        portal_template_id: id, monster_template_id, point_cost, weight: weight || 1.0,
      }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data }, 201);
    }
    if (method === 'PATCH' && id && subResource === 'monsters' && mappingId) {
      const body = await getBody(request);
      if (!body) return json({ error: 'Invalid JSON' }, 400);
      const update = {};
      if (body.point_cost !== undefined) update.point_cost = body.point_cost;
      if (body.weight !== undefined) update.weight = body.weight;
      if (Object.keys(update).length === 0) return json({ error: 'Nothing to update' }, 400);
      const { data, error } = await admin.from('portal_monster_mapping').update(update).eq('id', mappingId).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }
    if (method === 'DELETE' && id && subResource === 'monsters' && mappingId) {
      const { error } = await admin.from('portal_monster_mapping').delete().eq('id', mappingId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    // ---- Portal Loot Mappings ----
    if (method === 'GET' && id && subResource === 'loot') {
      const { data, error } = await admin.from('portal_loot_mapping')
        .select('id, portal_template_id, item_name, lp_cost, weight, created_at')
        .eq('portal_template_id', id).order('weight', { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }
    if (method === 'POST' && id && subResource === 'loot') {
      const body = await getBody(request);
      if (!body) return json({ error: 'Invalid JSON' }, 400);
      const { item_name, lp_cost, weight } = body;
      if (!item_name || lp_cost === undefined) return json({ error: 'item_name and lp_cost required' }, 400);
      const { data, error } = await admin.from('portal_loot_mapping').insert({
        portal_template_id: id, item_name, lp_cost, weight: weight || 1.0,
      }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data }, 201);
    }
    if (method === 'PATCH' && id && subResource === 'loot' && mappingId) {
      const body = await getBody(request);
      if (!body) return json({ error: 'Invalid JSON' }, 400);
      const update = {};
      if (body.lp_cost !== undefined) update.lp_cost = body.lp_cost;
      if (body.weight !== undefined) update.weight = body.weight;
      if (Object.keys(update).length === 0) return json({ error: 'Nothing to update' }, 400);
      const { data, error } = await admin.from('portal_loot_mapping').update(update).eq('id', mappingId).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }
    if (method === 'DELETE' && id && subResource === 'loot' && mappingId) {
      const { error } = await admin.from('portal_loot_mapping').delete().eq('id', mappingId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }
  }

  return json({ error: 'Not found' }, 404);
}
