/**
 * Shared combat HTTP stack (CORS, json, JWT verify).
 * Copied from api/combat/[...path].js — same headers, same error strings.
 */
import { createClient } from '@supabase/supabase-js';

let adminClientOverride = null;
/** Test-only injection. Production leaves this null. */
export function __setAdminClientForTests(client) {
  adminClientOverride = client;
}

export const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://portalcolosseum.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

export function getAdminClient() {
  if (adminClientOverride) return adminClientOverride;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing server config');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function verifyUser(request) {
  let admin;
  try { admin = getAdminClient(); } catch (e) { return { error: 'Server config error', status: 500 }; }
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return { error: 'No auth token', status: 401 };
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return { error: 'Invalid token', status: 401 };
  return { admin, user };
}

/** Combat dev admin gate. Same strings as the inlined profiles.is_admin checks. */
export async function verifyAdmin(admin, user) {
  let profile;
  try {
    const pRes = await admin.from('profiles').select('is_admin').eq('id', user.id).single();
    profile = pRes.data;
    if (pRes.error) throw pRes.error;
  } catch (e) {
    console.error('admin profile check error', e);
    return { error: 'Internal server error', status: 500 };
  }
  if (!profile || !profile.is_admin) {
    return { error: 'Admin access required', status: 403 };
  }
  return { admin, user, profile };
}

/** DB used-flags mirror engine potion state. Spread into the default battle persist. */
export function potionUsedFlags(state) {
  const pots = state && state.potions;
  return {
    consume_a_used: !!(pots && pots.A && pots.A.used),
    consume_b_used: !!(pots && pots.B && pots.B.used)
  };
}

/**
 * Load a portal_run the caller owns. IDOR guard is the chained
 * .eq('user_id', user.id) — every caller goes through this, so no load path
 * can drop it. Status === 'active' is checked in JS after the ownership read
 * (not as a query filter) so a non-active run stays 400, not a 404.
 * opts.allowInactive keeps GET /runs/:id able to read a finished run.
 * opts.notFound / opts.select preserve each route's existing error string and column list.
 */
export async function loadOwnedActiveRun(admin, user, id, opts = {}) {
  const parsed = parseInt(id, 10);
  if (isNaN(parsed)) return { error: 'Invalid run id', status: 400 };
  const select = opts.select || '*';
  const { data: run } = await admin.from('portal_run').select(select).eq('id', parsed).eq('user_id', user.id).single();
  if (!run) return { error: opts.notFound || 'Run not found', status: 404 };
  if (!opts.allowInactive && run.status !== 'active') {
    return { error: opts.notActive || 'Run not active', status: 400 };
  }
  return { run, id: parsed };
}

/**
 * Persist engine battle_state. IDOR: .eq('user_id', user.id).
 * Default patch matches commit/tick (player_hp + potion used-flags).
 * Pass extra to write exactly those additional fields and nothing else —
 * battle/start, use-potion, swap, and battle/end keep their old payloads.
 */
export async function persistBattle(admin, user, run, engine, extra) {
  const state = engine && typeof engine.getPersistedState === 'function'
    ? engine.getPersistedState()
    : engine;
  const patch = { battle_state: state };
  if (extra === undefined) {
    patch.player_hp = state && state.player ? state.player.hp : run.player_hp;
    Object.assign(patch, potionUsedFlags(state));
  } else {
    Object.assign(patch, extra);
  }
  return admin.from('portal_run').update(patch).eq('id', run.id).eq('user_id', user.id);
}

