/**
 * /api/combat/[...path].js
 * ========================
 * Vercel serverless catch-all for combat engine routes.
 * Dev routes (/dev/*) are dispatched to ./dev/[...path].js.
 * Mirrors api/admin conventions exactly (CORS, json(), getAdminClient, JWT).
 * Enforces uid == run.user_id (RLS backup). Service-role for portal_run + generate_monster.
 * IDOR closed: all UPDATEs chain .eq('user_id', user.id); all path ids NaN-guarded; non-active rejected; consume_a/b ownership via consumable_instance (R7/F7).
 */

import { createClient } from '@supabase/supabase-js';
import { createEngine, resumeEngine } from '../../js/combat/engine.js';
import { getHpWord } from '../../js/combat/hp-words.js';
import { drawRandomDie, rollDieFace, selectMonsterGroup } from '../../js/combat/dice.js';
import { generateLoot } from '../../js/combat/loot.js';
import { handleCombatDev } from './dev/[...path].js';
import {
  generateOneMonster as generateOneMonsterShared,
  findActiveRun as findActiveRunShared,
  handApproachSpeeds as handApproachSpeedsShared,
  buildPotionLoadout as buildPotionLoadoutShared,
  startingHp as startingHpShared,
} from '../../lib/combat-run.js';

/**
 * rollStat(base, range)
 * Returns base + uniform random int in [-range, +range].
 * If range <= 0 or falsy → exactly base (critical for ±0 existing data).
 * Result clamped to >= 1.
 */
function rollStat(base, range) {
  const b = Number(base) || 1;
  const v = Number(range) || 0;
  if (v <= 0) return Math.max(1, b);
  const delta = Math.floor(Math.random() * (v * 2 + 1)) - v;
  return Math.max(1, b + delta);
}

/**
 * Attack damage multiplier: uniform base ± range (even spread, EV at base).
 * Range <= 0 returns base exactly. Do NOT reuse rollStat — it clamps >= 1,
 * which would turn a 0.7 Quick Slash into 1.0. Clamp >= 0 so a wide range
 * cannot invert damage (migration comment on base_damage_multiplier_range).
 */
export function rollMultiplier(base, range, rng = Math.random) {
  const b = Number(base);
  const safe = Number.isFinite(b) ? b : 1;
  const v = Number(range) || 0;
  if (v <= 0) return safe;
  const rolled = safe + (rng() * 2 - 1) * v;
  return Math.max(0, rolled);
}

/**
 * Monsters that contribute loot. Persisted battle_state is getPersistedState(),
 * whose monsters live at state.monsters (full objects, including template_id).
 * participants.monsters exists only on the in-memory getState() snapshot and
 * is NOT what gets saved. Do not filter on .dead — death is current_hp <= 0,
 * and killed monsters must still drop.
 */
export function monstersForLoot(persisted) {
  const list = persisted && Array.isArray(persisted.monsters) ? persisted.monsters : [];
  return list.filter(m => m);
}

/** DB used-flags mirror engine potion state. Spread into every battle_state persist. */
export function potionUsedFlags(state) {
  const pots = state && state.potions;
  return {
    consume_a_used: !!(pots && pots.A && pots.A.used),
    consume_b_used: !!(pots && pots.B && pots.B.used)
  };
}

/** X AP + Y gold. ap_cost is on portal_template; Y is entry_gold_cost (gold_cost alias). */
export function entryCosts(template) {
  const ap = Math.max(0, Number(template && template.ap_cost) || 0);
  const goldRaw = template && (template.entry_gold_cost != null ? template.entry_gold_cost : template.gold_cost);
  const gold = Math.max(0, Number(goldRaw) || 0);
  return { ap, gold };
}

/**
 * Deduct entry cost from profiles.gold / profiles.ap.
 * Missing wallet columns are non-fatal (skipped) so an unmigrated DB still
 * creates runs. Insufficient balance is a hard 400 — no run is inserted.
 */
export async function chargeRunEntry(admin, userId, template) {
  const { ap: apCost, gold: goldCost } = entryCosts(template);
  if (apCost === 0 && goldCost === 0) return { ok: true, charged: null };
  let profile;
  try {
    const res = await admin.from('profiles').select('gold, ap').eq('id', userId).maybeSingle();
    if (res.error) throw res.error;
    profile = res.data;
  } catch (e) {
    console.error('entry cost profile read failed (non-fatal if wallet columns missing)', e);
    return { ok: true, charged: null, skipped: true };
  }
  if (!profile || (profile.gold == null && profile.ap == null)) {
    return { ok: true, charged: null, skipped: true };
  }
  const haveGold = Number.isFinite(Number(profile.gold)) ? Number(profile.gold) : 0;
  const haveAp = Number.isFinite(Number(profile.ap)) ? Number(profile.ap) : 0;
  if (haveGold < goldCost || haveAp < apCost) {
    return { ok: false, status: 400, error: 'Not enough AP or gold to enter this portal' };
  }
  const next = { gold: haveGold - goldCost, ap: haveAp - apCost };
  try {
    const upd = await admin.from('profiles').update(next).eq('id', userId);
    if (upd && upd.error) throw upd.error;
  } catch (e) {
    console.error('entry cost deduct failed', e);
    return { ok: false, status: 500, error: 'Internal server error' };
  }
  return { ok: true, charged: { before: { gold: haveGold, ap: haveAp }, ap: apCost, gold: goldCost } };
}

export async function refundRunEntry(admin, userId, charged) {
  if (!charged) return;
  try {
    const upd = await admin.from('profiles').update({
      gold: charged.before.gold,
      ap: charged.before.ap
    }).eq('id', userId);
    if (upd && upd.error) console.error('entry cost refund failed', upd.error);
  } catch (e) {
    console.error('entry cost refund failed', e);
  }
}

/**
 * Attacks this weapon instance actually rolled.
 * Slot 0 is the template base attack (NOT NULL, always granted).
 * Slots 1-4 are granted only when slot_N_attack_id is set — the template
 * mapping is the pool the roll drew from, not the combat menu.
 */
const SLOT_ATTACK_KEYS = ['slot_0_attack_id', 'slot_1_attack_id', 'slot_2_attack_id', 'slot_3_attack_id', 'slot_4_attack_id'];
const SLOT_ATTACK_SELECT = SLOT_ATTACK_KEYS.join(', ');
const ATTACK_MENU_COLUMNS = 'id, name, is_multi_target, prepare_time_multiplier, prepare_time_multiplier_range, cooldown_time_multiplier, cooldown_time_multiplier_range, description, base_damage_multiplier, crit_factor, crit_multiplier';

export function grantedSlotAttackIds(instance) {
  if (!instance) return [];
  const ids = [];
  const seen = new Set();
  for (const key of SLOT_ATTACK_KEYS) {
    const raw = instance[key];
    if (raw == null || raw === '') continue;
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function shapeMenuAttack(a, style) {
  return {
    id: a.id,
    name: a.name,
    is_multi_target: !!a.is_multi_target,
    prepare_time_multiplier: a.prepare_time_multiplier ?? 1,
    prepare_time_multiplier_range: a.prepare_time_multiplier_range ?? 0,
    cooldown_time_multiplier: a.cooldown_time_multiplier ?? 1,
    cooldown_time_multiplier_range: a.cooldown_time_multiplier_range ?? 0,
    description: style === 'weapons' ? (a.description ?? null) : (a.description || ''),
    base_damage_multiplier: style === 'weapons' ? (a.base_damage_multiplier ?? null) : (a.base_damage_multiplier ?? 1),
    crit_factor: a.crit_factor ?? 1,
    crit_multiplier: a.crit_multiplier ?? 2
  };
}

async function loadGrantedAttacks(admin, instances, style) {
  const list = Array.isArray(instances) ? instances : [];
  const unique = [...new Set(list.flatMap(grantedSlotAttackIds))];
  const byId = {};
  if (unique.length) {
    try {
      const res = await admin.from('attack').select(ATTACK_MENU_COLUMNS).in('id', unique);
      if (res && res.error) throw res.error;
      for (const row of (res && res.data) || []) {
        if (row && row.id != null) byId[Number(row.id)] = row;
      }
    } catch (e) {
      console.error('granted slot attack load error', e);
    }
  }
  return function attacksOf(inst) {
    return grantedSlotAttackIds(inst).map(id => byId[id]).filter(Boolean).map(a => shapeMenuAttack(a, style));
  };
}

let adminClientOverride = null;
/** Test-only injection. Production leaves this null. */
export function __setAdminClientForTests(client) {
  adminClientOverride = client;
}

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://portalcolosseum.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

// Commit/swap snapshot the client ceremony reconciles against. playerReady is
// the queue head, matching engine.tick(). Nested state stays so existing
// readers of data.state / data.result keep working.
function commitSnapshot(engine, committed = {}) {
  const snap = engine.getState();
  const head = snap.queue && snap.queue[0];
  return {
    committed: true,
    queue: snap.queue,
    removed: committed.removed || null,
    inserted: committed.inserted || null,
    playerReady: !!(head && head.event === 'ready'),
    battleOver: !!snap.battle_over,
    state: {
      queue: snap.queue,
      participants: snap.participants,
      player: snap.participants?.player || null,
      feed: snap.feed,
      tic: snap.tic,
      battle_over: snap.battle_over,
      player_dead: snap.player_dead
    }
  };
}

// PC-64r2: player max HP is config-driven (game_config.starting_hp).
// Returns null when unset/unreadable → engine falls back to PLAYER_MAX_HP (1000).
async function startingHp(admin) {
  return startingHpShared(admin);
}

function computeStopShare(battleNum, totalBattles, prizePool, tiers) {
  if (battleNum >= totalBattles) {
    return { gold: prizePool.gold || 0, weapon_ids: [...(prizePool.weapon_ids || [])], forfeited_weapon_ids: [] };
  }
  // Progress-keyed (PC-DEC-056): pick the tier whose `progress` threshold the
  // current battle meets. progress = fraction of the run cleared. Auto-scales
  // to any portal length (5 fights, 8 fights, etc.) — not positional by fight
  // number. If progress is below the first tier's threshold (e.g. battle 1 of
  // an 8-fight portal = 12.5%), fall back to the FIRST (lowest) tier — the
  // harshest share, since the player has barely started. If no tiers at all,
  // use a sane default.
  const progress = totalBattles > 0 ? battleNum / totalBattles : 0;
  let tier = null;
  for (const t of (tiers || [])) {
    if (t && typeof t.progress === 'number' && progress >= t.progress) tier = t;
  }
  tier = tier || (tiers && tiers.length ? tiers[0] : null) || { gold_pct: 0.2, sel_items: 0, rand_items: 0 };
  const weapons = prizePool.weapon_ids || [];
  const totalWeapons = weapons.length;
  return {
    gold_pct: tier.gold_pct,
    sel_items: tier.sel_items,
    rand_items: tier.rand_items,
    total_weapons: totalWeapons
  };
}

function getAdminClient() {
  if (adminClientOverride) return adminClientOverride;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing server config');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function verifyUser(request) {
  let admin;
  try { admin = getAdminClient(); } catch (e) { return { error: 'Server config error', status: 500 }; }
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return { error: 'No auth token', status: 401 };
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return { error: 'Invalid token', status: 401 };
  return { admin, user };
}

async function handle(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  // Vercel may pass request.url as a relative path (e.g. "/api/combat/runs?path=runs")
  // when the function is invoked via a filesystem rewrite rather than a direct
  // function route. new URL() with no base throws ERR_INVALID_URL on relative
  // input; the base makes both forms work (absolute URLs ignore it).
  const url = new URL(request.url, 'https://portalcolosseum.com');
  const path = url.pathname.replace('/api/combat', '');
  const method = request.method;

  const auth = await verifyUser(request);
  if (auth.error) return json({ error: auth.error }, auth.status);

  const { admin, user } = auth;

  try {
    // /dev/* admin routes live in ./dev/[...path].js. vercel.json still
    // rewrites /api/combat/* here, so this dispatch is the live entry.
    if (path.startsWith('/dev/')) {
      const devRes = await handleCombatDev({ request, path, method, admin, user, json });
      if (devRes) return devRes;
    }
    // Helper: generateOneMonster (reused by dice wiring + dev routes; defined early for scope)
    async function generateOneMonster(templateId, usedLabels) {
      return generateOneMonsterShared(admin, templateId, usedLabels);
    }

    // POST /api/combat/runs  {portal_template_id, hand_l_weapon_id, hand_r_weapon_id, belt_weapon_id, consume_a, consume_b}
    if (path === '/runs' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { portal_template_id, hand_l_weapon_id, hand_r_weapon_id, belt_weapon_id, consume_a, consume_b } = body;
      // R8: integer validation for portal_template_id (same pattern as weapon ids)
      const portalTemplateIdNum = parseInt(portal_template_id, 10);
      if (isNaN(portalTemplateIdNum) || portalTemplateIdNum <= 0) return json({ error: 'Invalid portal_template_id' }, 400);

      // PC-50r: cap is now 1 (hard guarantee is the partial unique index on status='active')
      const { count } = await admin.from('portal_run').select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('status', 'active');
      if ((count || 0) >= 1) return json({ error: 'You already have an active run. End it before starting a new one.' }, 400);

      // F7: fail-closed weapon ownership (positive int + exact length + every owner match + error -> 500)
      // R7: parse each weapon id once; 400 on NaN/<=0; dedupe parsed ids; use parsed values for ownership check AND INSERT
      const handL = hand_l_weapon_id == null ? null : parseInt(hand_l_weapon_id, 10);
      const handR = hand_r_weapon_id == null ? null : parseInt(hand_r_weapon_id, 10);
      const beltW = belt_weapon_id == null ? null : parseInt(belt_weapon_id, 10);
      for (const w of [handL, handR, beltW]) {
        if (w != null && (isNaN(w) || w <= 0)) return json({ error: 'Invalid weapon id' }, 400);
      }
      const raw = [handL, handR, beltW].filter(n => n != null);
      const weaponIds = [...new Set(raw)];
      if (weaponIds.length !== raw.length) return json({ error: 'Duplicate weapon id' }, 400);
      // PC-52r: a run needs at least one hand weapon — belt does not count (Fist is mid-run only)
      if (handL == null && handR == null) return json({ error: 'At least one hand weapon required (belt does not count)' }, 400);
      if (weaponIds.length) {
        let owns;
        try {
          const res = await admin.from('weapon_instance').select('id,user_id').in('id', weaponIds);
          owns = res.data;
          if (res.error) throw res.error;
        } catch (e) {
          console.error('weapon ownership query error', e);
          return json({ error: 'Internal server error' }, 500);
        }
        // R7: compare against distinct count
        if (!owns || owns.length !== weaponIds.length || owns.some(w => w.user_id !== user.id)) {
          return json({ error: 'Weapon ownership mismatch' }, 403);
        }
      }

      // F7: fail-closed consumable ownership (positive int + exact length + every owner match + error -> 500)
      // R7: parse each consume id once; 400 on NaN/<=0; dedupe parsed ids; use parsed values for ownership check AND INSERT
      const consumeA = consume_a == null ? null : parseInt(consume_a, 10);
      const consumeB = consume_b == null ? null : parseInt(consume_b, 10);
      for (const c of [consumeA, consumeB]) {
        if (c != null && (isNaN(c) || c <= 0)) return json({ error: 'Invalid consume id' }, 400);
      }
      const rawC = [consumeA, consumeB].filter(n => n != null);
      const consumeIds = [...new Set(rawC)];
      if (consumeIds.length !== rawC.length) return json({ error: 'Duplicate consume id' }, 400);
      if (consumeIds.length) {
        let ownsC;
        try {
          const res = await admin.from('consumable_instance').select('id,user_id').in('id', consumeIds);
          ownsC = res.data;
          if (res.error) throw res.error;
        } catch (e) {
          console.error('consumable ownership query error', e);
          return json({ error: 'Internal server error' }, 500);
        }
        // R7: compare against distinct count
        if (!ownsC || ownsC.length !== consumeIds.length || ownsC.some(c => c.user_id !== user.id)) {
          return json({ error: 'Consumable ownership mismatch' }, 403);
        }
      }

      // ap_cost exists; entry_gold_cost may not (guarded fallback).
      const tmplCols = 'fights, green_dice_count, yellow_dice_count, red_dice_count, green_faces, yellow_faces, red_faces, ap_cost';
      let tmplRes = await admin.from('portal_template').select(tmplCols + ', entry_gold_cost').eq('id', portalTemplateIdNum).single();
      if (tmplRes.error || !tmplRes.data) {
        tmplRes = await admin.from('portal_template').select(tmplCols).eq('id', portalTemplateIdNum).single();
        if (tmplRes.data && tmplRes.data.entry_gold_cost == null) tmplRes.data.entry_gold_cost = 0;
      }
      const tmpl = tmplRes.data;
      if (!tmpl) return json({ error: 'Portal template not found' }, 404);

      // PC-99: a run costs X AP + Y gold. Skip (don't 500) if wallet columns are absent.
      const entryCharge = await chargeRunEntry(admin, user.id, tmpl);
      if (!entryCharge.ok) return json({ error: entryCharge.error }, entryCharge.status || 400);

      // PC-64r2: player max HP comes from game_config.starting_hp, not a literal
      const maxPlayerHp = await startingHp(admin);

      let run;
      try {
        const { data: inserted, error: insErr } = await admin.from('portal_run').insert({
          user_id: user.id,
          portal_template_id: portalTemplateIdNum,
          hand_l_weapon_id: handL,
          hand_r_weapon_id: handR,
          belt_weapon_id: beltW,
          consume_a_id: consumeA,
          consume_b_id: consumeB,
          status: 'active',
          current_battle: 1,
          total_battles: tmpl.fights || 5,
          player_hp: maxPlayerHp ?? 1000,
          battle_state: {}
        }).select().single();
        if (insErr) throw insErr;
        run = inserted;
      } catch (e) {
        // PC-50r: unique violation from the partial index (concurrent double-submit or race) → friendly 400
        await refundRunEntry(admin, user.id, entryCharge.charged);
        if (e && (e.code === '23505' || e.message?.includes('23505') || e.details?.includes('idx_portal_run_one_active_per_user'))) {
          return json({ error: 'You already have an active run. End it before starting a new one.' }, 400);
        }
        console.error('run insert error', e);
        return json({ error: 'Internal server error' }, 500);
      }

      // Materialize dice pool from template counts (green/yellow/red rows, all NULL state)
      // Defensive: if pool insert fails, delete the run (never leave orphan run with no dice)
      const diceRows = [];
      const g = tmpl.green_dice_count || 0;
      const y = tmpl.yellow_dice_count || 0;
      const r = tmpl.red_dice_count || 0;
      for (let i = 0; i < g; i++) diceRows.push({ portal_run_id: run.id, color: 'green', face: null, drawn_battle: null, rolled_value: null });
      for (let i = 0; i < y; i++) diceRows.push({ portal_run_id: run.id, color: 'yellow', face: null, drawn_battle: null, rolled_value: null });
      for (let i = 0; i < r; i++) diceRows.push({ portal_run_id: run.id, color: 'red', face: null, drawn_battle: null, rolled_value: null });
      if (diceRows.length > 0) {
        const { error: diceErr } = await admin.from('portal_run_dice').insert(diceRows);
        if (diceErr) {
          console.error('dice pool insert error', diceErr);
          // cleanup: delete the run so caller never sees a run with no dice
          await admin.from('portal_run').delete().eq('id', run.id);
          await refundRunEntry(admin, user.id, entryCharge.charged);
          return json({ error: 'Internal server error' }, 500);
        }
      }

      // PC-16: draw+roll+generate for battle 1 at run creation (seeds battle_state); faces/pool from DB, no hardcodes
      let battleStateForRun1 = {};
      try {
        const { data: undrawn } = await admin.from('portal_run_dice').select('*').eq('portal_run_id', run.id).is('drawn_battle', null);
        if (undrawn && undrawn.length > 0) {
          const die = drawRandomDie(undrawn);
          if (die) {
            const facesByColor = { green: tmpl.green_faces || [], yellow: tmpl.yellow_faces || [], red: tmpl.red_faces || [] };
            const faceVal = rollDieFace(die.color, facesByColor);
            await admin.from('portal_run_dice').update({ face: faceVal, drawn_battle: 1, rolled_value: faceVal }).eq('id', die.id);

            // monster mapping + select group
            const { data: mappings } = await admin.from('portal_monster_mapping').select('monster_template_id, point_cost, weight').eq('portal_template_id', portalTemplateIdNum);
            const group = selectMonsterGroup(faceVal, mappings || []);
            const monsters = [];
            const usedLabels = [];
            for (const gItem of group) {
              const m = await generateOneMonster(gItem.monster_template_id, usedLabels);
              if (m && !m.error) {
                usedLabels.push(m.label);
                monsters.push(m);
              }
            }
            if (monsters.length === 0) {
              // Last resort fallback (mirrors /battle/start path) so battle 1 never starts with "No monsters present"
              monsters.push({ id: 1, max_hp: 100, damage: 10, speed: 6, accuracy: 70, label: 'A', name: 'Glimmerling' });
            }
            if (monsters.length > 0) {
              const potionLoadout = await buildPotionLoadout(run);
              const handSpeeds = await handApproachSpeeds(handL, handR);
              const participants = {
                loadout: { hand_l: handL, hand_r: handR, ...handSpeeds, consume_a: potionLoadout.A, consume_b: potionLoadout.B },
                monsters
              };
              const eng = createEngine();
              eng.startBattle(participants, null, null, maxPlayerHp);
              battleStateForRun1 = eng.getPersistedState();
              await admin.from('portal_run').update({ battle_state: battleStateForRun1 }).eq('id', run.id).eq('user_id', user.id);
            }
          }
        }
      } catch (e) {
        console.error('battle1 dice/encounter error (non-fatal, legacy fallback)', e);
      }

      return json({ run: { ...run, battle_state: battleStateForRun1 } });
    }

    // PC-50r: GET /api/combat/runs/active — returns the caller's single active run (or null)
    // MUST be before the generic /runs/:id catch-all, else 'active' parses as NaN id.
    if (path === '/runs/active' && method === 'GET') {
      const run = await findActiveRun(user.id);
      return json({ run: run || null });
    }


    // GET /api/combat/runs/:id  (state route updated for dice visibility)
    if (path.startsWith('/runs/') && !path.includes('/battle') && method === 'GET') {
      const idStr = path.split('/')[2];
      const id = parseInt(idStr, 10);
      if (isNaN(id)) return json({ error: 'Invalid run id' }, 400);
      const { data: run } = await admin.from('portal_run').select('*').eq('id', id).eq('user_id', user.id).single();
      if (!run) return json({ error: 'Not found or not owner' }, 404);
      const state = run.battle_state || {};

      // Dice state: fetch all dice for this run, compute remaining/used/current
      const { data: diceRows } = await admin.from('portal_run_dice')
        .select('color, face, drawn_battle, rolled_value')
        .eq('portal_run_id', id);
      let dice = null;
      if (diceRows && diceRows.length > 0) {
        const { data: tmplRow } = await admin.from('portal_template')
          .select('green_faces, yellow_faces, red_faces')
          .eq('id', run.portal_template_id).single();
        const remaining = { green: 0, yellow: 0, red: 0 };
        const used = { green: 0, yellow: 0, red: 0 };
        let current = null;
        for (const d of diceRows) {
          const c = d.color;
          if (d.drawn_battle === null) {
            remaining[c] = (remaining[c] || 0) + 1;
          } else {
            used[c] = (used[c] || 0) + 1;
            if (d.drawn_battle === run.current_battle) {
              current = { color: d.color, face: d.face, rolled_value: d.rolled_value };
            }
          }
        }
        dice = {
          remaining, used, current,
          // Template face pools so the roll reveal can tumble ONLY real
          // faces (e.g. 10/20/30) — never invented values like 1-6.
          faces: {
            green: (tmplRow && tmplRow.green_faces) || [],
            yellow: (tmplRow && tmplRow.yellow_faces) || [],
            red: (tmplRow && tmplRow.red_faces) || []
          }
        };
      }

      // --- monsters: battle_state already carries stats + granted attacks (slot_*_attack
      // full attack rows from generate_monster); join template names for readable display ---
      const rawMonsters = state.monsters || [];
      const templateIds = [...new Set(rawMonsters.map(m => m.template_id).filter(Boolean))];
      const templateNames = {};
      if (templateIds.length) {
        const { data: trows } = await admin.from('monster_template').select('id, name').in('id', templateIds);
        for (const t of (trows || [])) templateNames[t.id] = t.name;
      }
      const monsters = rawMonsters.map(m => {
        const attacks = ['slot_0_attack', 'slot_1_attack', 'slot_2_attack', 'slot_3_attack', 'slot_4_attack']
          .map(k => m[k])
          .filter(a => a && typeof a === 'object' && a.id)
          .map(a => ({
            id: a.id,
            name: a.name,
            is_multi_target: !!a.is_multi_target,
            prepare_time_multiplier: a.prepare_time_multiplier ?? 1,
            prepare_time_multiplier_range: a.prepare_time_multiplier_range ?? 0,
            cooldown_time_multiplier: a.cooldown_time_multiplier ?? 1,
            cooldown_time_multiplier_range: a.cooldown_time_multiplier_range ?? 0
          }));
        return {
          id: m.id,
          label: m.label,
          template_id: m.template_id,
          name: templateNames[m.template_id] || m.template_name || m.label || 'Monster',
          hp_word: getHpWord(m.current_hp, m.max_hp),
          dead: m.current_hp <= 0,
          damage: m.damage,
          speed: m.speed,
          accuracy: m.accuracy,
          crit_chance: m.crit_chance ?? m.critChance ?? 0,
          attacks
        };
      });

      // --- equipped weapons: instance stats + template name + granted attacks (same join as /weapons) ---
      const weaponIds = [run.hand_l_weapon_id, run.hand_r_weapon_id, run.belt_weapon_id].filter(Boolean);
      let weaponRows = [];
      if (weaponIds.length) {
        const res = await admin.from('weapon_instance')
          .select('id, damage, speed, accuracy, grade, crit_chance, template_id, ' + SLOT_ATTACK_SELECT + ', weapon_template:template_id (name, base_damage, damage_range)')
          .in('id', weaponIds);
        weaponRows = res.data || [];
      }
      const weaponById = Object.fromEntries(weaponRows.map(w => [w.id, w]));
      const attacksOf = await loadGrantedAttacks(admin, weaponRows, 'battle');
      function weaponInfo(weaponId) {
        const w = weaponById[weaponId];
        if (!w) return null;
        return {
          id: w.id,
          name: w.weapon_template?.name || 'Unknown',
          damage: w.damage,
          speed: w.speed,
          accuracy: w.accuracy,
          grade: w.grade ?? null,
          crit_chance: w.crit_chance ?? 0,
          base_damage: w.weapon_template?.base_damage ?? null,
          damage_range: w.weapon_template?.damage_range ?? null,
          attacks: attacksOf(w)
        };
      }
      const [handL, handR, beltW] = await Promise.all([weaponInfo(run.hand_l_weapon_id), weaponInfo(run.hand_r_weapon_id), weaponInfo(run.belt_weapon_id)]);

      // --- potions (consumable slots A/B) for state response ---
      // used mirrors the portal_run.consume_*_used flag (DB is the source of truth,
      // so a reloaded run cannot re-drink an already-consumed potion).
      const { data: cfg } = await admin.from('game_config')
        .select('fist_prepare_time, fist_prepare_time_range, fist_cooldown_time, fist_cooldown_time_range, fist_damage, fist_accuracy, fist_speed, fist_crit_chance, potion_crit_effect_multiplier, potion_crit_duration_multiplier')
        .eq('id', 1).maybeSingle();
      const pCritEffect = Number(cfg?.potion_crit_effect_multiplier) || 1.5;
      const pCritDuration = Number(cfg?.potion_crit_duration_multiplier) || 1.5;

      async function potionInfo(consumeId, used = false) {
        if (!consumeId) return null;
        try {
          const { data: inst } = await admin
            .from('consumable_instance')
            .select('id, rolled_floor, rolled_window, grade, crit_chance, consumable_template:template_id (name, effect_type)')
            .eq('id', consumeId)
            .maybeSingle();
          if (!inst) return null;
          const effectLabel = `${inst.rolled_floor}+, up to ${inst.rolled_floor + (inst.rolled_window || 0)}`;
          return {
            instance_id: inst.id,
            template_name: inst.consumable_template?.name || 'Unknown',
            effect_type: inst.consumable_template?.effect_type || 'heal',
            effect_label: effectLabel,
            grade: inst.grade,
            used: !!used,
            crit_chance: Number(inst.crit_chance) || 0,
            critEffectMultiplier: pCritEffect,
            critDurationMultiplier: pCritDuration
          };
        } catch (e) {
          console.error('potion fetch error', e);
          return null;
        }
      }
      const [potionA, potionB] = await Promise.all([
        potionInfo(run.consume_a_id, !!run.consume_a_used),
        potionInfo(run.consume_b_id, !!run.consume_b_used)
      ]);

      // --- stop_share_tiers from portal template (loot extraction config) ---
      let stopShareTiers = null;
      if (run.portal_template_id) {
        const { data: tmplStop } = await admin.from('portal_template')
          .select('stop_share_tiers')
          .eq('id', run.portal_template_id)
          .maybeSingle();
        stopShareTiers = (tmplStop && tmplStop.stop_share_tiers) || null;
      }

      // --- prize pool weapon names (for the between-fights extraction UI) ---
      let prizeWeapons = [];
      const poolIds = (run.prize_pool && Array.isArray(run.prize_pool.weapon_ids)) ? run.prize_pool.weapon_ids.filter(Boolean) : [];
      if (poolIds.length > 0) {
        const { data: poolRows } = await admin.from('weapon_instance')
          .select('id, template_id, weapon_template:template_id (name)')
          .in('id', poolIds);
        prizeWeapons = (poolRows || []).map(w => ({
          id: w.id,
          name: w.weapon_template?.name || `Weapon #${w.id}`,
          template_id: w.template_id
        }));
      }

      const safeState = {
        queue: state.queue || [],
        player: state.player ? { hp: state.player.hp, max_hp: state.player.max_hp, hands: state.player.hands } : null,
        feed: state.feed || [],
        tic: state.tic || 0,
        buffs: state.buffs || [],
        weapons: { hand_l: handL, hand_r: handR, belt: beltW, fist: cfg ? { name: 'Fist (unarmed)', damage: cfg.fist_damage, speed: cfg.fist_speed ?? 6, accuracy: cfg.fist_accuracy, crit_chance: cfg.fist_crit_chance ?? 0, base_damage: cfg.fist_damage, damage_range: 0, grade: null, attacks: [{ id: 1, name: 'Fist (unarmed)', is_multi_target: false, prepare_time: cfg.fist_prepare_time, cooldown_time: cfg.fist_cooldown_time, prepare_time_range: cfg.fist_prepare_time_range, cooldown_time_range: cfg.fist_cooldown_time_range, description: '', base_damage_multiplier: 1 }] } : null },
        potions: { potion_a: potionA, potion_b: potionB },
        monsters,
        dice,
        // PC-DEC-039: tic-0 seed + fires so a genuine first entry can replay
        // the advance. Absent after resumeEngine (loadState clears intro).
        intro: state.intro || null
      };
      return json({ run: { ...run, stop_share_tiers: stopShareTiers, prize_weapons: prizeWeapons, potion_a: potionA, potion_b: potionB, battle_state: safeState } });
    }

    // POST /api/combat/runs/:id/battle/start  (for battle 2+ and legacy; F3 gate kept)
    if (path.includes('/battle/start') && method === 'POST') {
      const idStr = path.split('/')[2];
      const id = parseInt(idStr, 10);
      if (isNaN(id)) return json({ error: 'Invalid run id' }, 400);
      const { data: run } = await admin.from('portal_run').select('*').eq('id', id).eq('user_id', user.id).single();
      if (!run) return json({ error: 'Run not found' }, 404);
      if (run.status !== 'active') return json({ error: 'Run not active' }, 400);

      // F3: gate against re-start mid-battle (live queue or monsters in battle_state)  -- KEPT
      if (run.battle_state && (run.battle_state.queue?.length > 0 || run.battle_state.monsters?.length > 0)) {
        return json({ error: 'Battle already in progress' }, 400);
      }

      // PC-16 wiring: draw+roll+generate via dice engine (reuses generateOneMonster); fallback legacy if no dice
      let monsters = [];
      try {
        const { data: tmpl } = await admin.from('portal_template').select('green_faces, yellow_faces, red_faces').eq('id', run.portal_template_id).single();
        const { data: undrawn } = await admin.from('portal_run_dice').select('*').eq('portal_run_id', id).is('drawn_battle', null);
        if (undrawn && undrawn.length > 0) {
          const die = drawRandomDie(undrawn);
          if (die) {
            const facesByColor = { green: tmpl?.green_faces || [], yellow: tmpl?.yellow_faces || [], red: tmpl?.red_faces || [] };
            const faceVal = rollDieFace(die.color, facesByColor);
            await admin.from('portal_run_dice').update({ face: faceVal, drawn_battle: run.current_battle, rolled_value: faceVal }).eq('id', die.id);

            const { data: mappings } = await admin.from('portal_monster_mapping').select('monster_template_id, point_cost, weight').eq('portal_template_id', run.portal_template_id);
            const group = selectMonsterGroup(faceVal, mappings || []);
            const usedLabels = [];
            for (const gItem of group) {
              const m = await generateOneMonster(gItem.monster_template_id, usedLabels);
              if (m && !m.error) {
                usedLabels.push(m.label);
                monsters.push(m);
              }
            }
          }
        }
      } catch (e) {
        console.error('battle/start dice error (legacy fallback)', e);
      }

      // F9 budget-aware fallback (replaces blind 2-monster hatch — was spawning Glimmerling+BlueSlime on 5-point rolls)
      if (monsters.length === 0) {
        // Recover the budget from the die that was already drawn+updated, or use cheapest monster cost
        let budget = null;
        try {
          const { data: drawnDie } = await admin.from('portal_run_dice')
            .select('rolled_value')
            .eq('portal_run_id', id)
            .eq('drawn_battle', run.current_battle)
            .single();
          if (drawnDie && drawnDie.rolled_value != null) budget = drawnDie.rolled_value;
        } catch (_) { /* fall through */ }
        if (budget == null) {
          const { data: cheapest } = await admin.from('portal_monster_mapping')
            .select('point_cost')
            .eq('portal_template_id', run.portal_template_id)
            .order('point_cost', { ascending: true })
            .limit(1);
          budget = (cheapest && cheapest[0]?.point_cost) || 10;
        }
        const { data: mappings } = await admin.from('portal_monster_mapping')
          .select('monster_template_id, point_cost, weight')
          .eq('portal_template_id', run.portal_template_id);
        const group = selectMonsterGroup(budget, mappings || []);
        const usedLabels = [];
        for (const gItem of group) {
          const m = await generateOneMonster(gItem.monster_template_id, usedLabels);
          if (m && !m.error) {
            usedLabels.push(m.label);
            monsters.push(m);
          }
        }
        // Last resort: single placeholder if even selectMonsterGroup yielded nothing
        if (monsters.length === 0) {
          monsters.push({ id: 1, max_hp: 100, damage: 10, speed: 6, accuracy: 70, label: 'Monster A' });
        }
      }

      const potionLoadout = await buildPotionLoadout(run);
      const handSpeeds = await handApproachSpeeds(run.hand_l_weapon_id, run.hand_r_weapon_id);
      const participants = {
        loadout: { hand_l: run.hand_l_weapon_id, hand_r: run.hand_r_weapon_id, ...handSpeeds, consume_a: potionLoadout.A, consume_b: potionLoadout.B },
        monsters
      };
      const engine = createEngine();
      const battleStateOut = engine.startBattle(participants, null, null, await startingHp(admin));
      const persisted = engine.getPersistedState();
      await admin.from('portal_run')
        .update({ battle_state: persisted, player_hp: persisted.player ? persisted.player.hp : run.player_hp })
        .eq('id', id).eq('user_id', user.id);
      return json({
        queue: battleStateOut.queue,
        participants: battleStateOut.participants,
        feed: battleStateOut.feed,
        tic: battleStateOut.tic,
        battle_over: battleStateOut.battle_over,
        intro: battleStateOut.intro
      });
    }

    // POST /api/combat/runs/:id/commit {hand, attack_id, target_ids}
    if (path.includes('/commit') && method === 'POST') {
      const idStr = path.split('/')[2];
      const id = parseInt(idStr, 10);
      if (isNaN(id)) return json({ error: 'Invalid run id' }, 400);
      const body = await request.json().catch(() => ({}));
      const { hand, attack_id, target_ids = [] } = body;
      if (!['LH', 'RH'].includes(hand)) return json({ error: 'Invalid hand' }, 400);

      // F8: body validation (target_ids array of positive ints <=10, exist in live monsters; attack_id positive int)
      if (!Array.isArray(target_ids) || target_ids.length > 10 || target_ids.some(tid => (typeof tid !== 'string' && typeof tid !== 'number') || String(tid).trim() === '')) {
        return json({ error: 'Invalid target_ids' }, 400);
      }
      const attackIdNum = parseInt(attack_id, 10);
      if (isNaN(attackIdNum) || attackIdNum <= 0) return json({ error: 'Invalid attack_id' }, 400);

      // Fetch attack early to know isMultiTarget for R2 single-target restriction
      const { data: attackRow } = await admin.from('attack')
        .select('prepare_time_multiplier, prepare_time_multiplier_range, cooldown_time_multiplier, cooldown_time_multiplier_range, is_multi_target, base_damage_multiplier, base_damage_multiplier_range, name, crit_factor, crit_multiplier')
        .eq('id', attackIdNum).single();
      const isMultiTarget = !!attackRow?.is_multi_target;

      const { data: run } = await admin.from('portal_run').select('*').eq('id', id).eq('user_id', user.id).single();
      if (!run) return json({ error: 'Run not found' }, 404);
      if (run.status !== 'active') return json({ error: 'Run not active' }, 400);

      // R4: player-death gate on commit
      if (run.player_hp <= 0) return json({ error: 'Run over — player dead' }, 400);

      // F15: meaningful battle-started guard (queue or monsters present)
      const persisted = run.battle_state || {};
      if (!persisted || !Array.isArray(persisted.queue) || (persisted.queue.length === 0 && (!persisted.monsters || persisted.monsters.length === 0))) {
        return json({ error: 'Battle not started' }, 400);
      }

      // validate targets exist among current live monsters
      const liveMonsterIds = (persisted.monsters || []).filter(m => (m.current_hp || 0) > 0).map(m => m.id);
      if (target_ids.length > 0 && !target_ids.every(tid => liveMonsterIds.some(mid => mid === tid || String(mid) === String(tid)))) {
        return json({ error: 'Invalid target monster' }, 400);
      }

      // R2: single-target attacks restricted to first target only (prevents cleave exploit)
      let effectiveTargetIds = target_ids;
      if (!isMultiTarget && target_ids.length > 1) {
        effectiveTargetIds = target_ids.slice(0, 1);
      }

      const weaponId = hand === 'LH' ? run.hand_l_weapon_id : run.hand_r_weapon_id;
      let castTicks, cooldownTicks, playerDamage, playerAccuracy, playerCritChance, playerCritMultiplier, attackName;
      if (!weaponId) {
        const { data: config } = await admin.from('game_config').select('fist_prepare_time, fist_prepare_time_range, fist_cooldown_time, fist_cooldown_time_range, fist_damage, fist_accuracy, fist_speed, fist_crit_chance').eq('id', 1).single();
        if (!config) return json({ error: 'Game config missing' }, 500);
        castTicks = config.fist_speed + rollStat(config.fist_prepare_time, config.fist_prepare_time_range);
        cooldownTicks = config.fist_speed + rollStat(config.fist_cooldown_time, config.fist_cooldown_time_range);
        playerDamage = config.fist_damage;
        playerAccuracy = config.fist_accuracy;
        playerCritChance = config.fist_crit_chance ?? 0;
        playerCritMultiplier = 2.0;
        attackName = 'Fist';
      } else {
        // Same granted-slot set the weapon menu shows. Mapping membership is not
        // a grant — a mapped attack the roll skipped must 403.
        const { data: weapon } = await admin.from('weapon_instance')
          .select('damage, accuracy, speed, crit_chance, ' + SLOT_ATTACK_SELECT)
          .eq('id', weaponId).single();
        if (!weapon) return json({ error: 'Weapon instance not found' }, 404);
        if (!grantedSlotAttackIds(weapon).includes(attackIdNum)) {
          return json({ error: 'Attack not on equipped weapon' }, 403);
        }

        // PC-107/108: attack timing is a pure multiplier on weapon speed.
        // 1.0 = exactly weapon speed. rollMultiplier range 0 returns base exactly and
        // clamps >= 0 (not >= 1), so a 0.7 Quick Slash stays fast.
        const weaponSpeed = Number(weapon?.speed) || 0;
        castTicks = Math.floor(weaponSpeed * rollMultiplier(attackRow?.prepare_time_multiplier ?? 1, attackRow?.prepare_time_multiplier_range ?? 0));
        cooldownTicks = Math.floor(weaponSpeed * rollMultiplier(attackRow?.cooldown_time_multiplier ?? 1, attackRow?.cooldown_time_multiplier_range ?? 0));
        const multiplier = rollMultiplier(attackRow?.base_damage_multiplier ?? 1, attackRow?.base_damage_multiplier_range);

        playerDamage = Math.round((weapon?.damage || 10) * multiplier);
        playerAccuracy = weapon?.accuracy;
        // PC-72: player crit chance = weapon instance crit_chance × attack crit_factor
        playerCritChance = (Number(weapon?.crit_chance) || 0) * (Number(attackRow?.crit_factor) || 1);
        playerCritMultiplier = Number(attackRow?.crit_multiplier) || 2.0;
        attackName = attackRow?.name || null;
      }

      let engine;
      if (persisted && Array.isArray(persisted.queue) && (persisted.queue.length > 0 || (persisted.monsters && persisted.monsters.length > 0))) {
        engine = resumeEngine(persisted, Math.random);
      } else {
        engine = createEngine();
      }

      const committed = engine.commitAttack(hand, attackIdNum, effectiveTargetIds, { castTicks, cooldownTicks, playerDamage, isMultiTarget, attackName, playerAccuracy, playerCritChance, playerCritMultiplier });
      // NO clock walk — commit removes the ready head, inserts the
      // winding row, and returns immediately. The client drives /tick.

      const nextState = engine.getPersistedState();
      await admin.from('portal_run')
        .update({ battle_state: nextState, player_hp: nextState.player ? nextState.player.hp : run.player_hp, ...potionUsedFlags(nextState) })
        .eq('id', id).eq('user_id', user.id);
      return json(commitSnapshot(engine, committed));
    }

    // POST /api/combat/runs/:id/tick — process ONE queue item
    if (path.includes('/tick') && method === 'POST') {
      const idStr = path.split('/')[2];
      const id = parseInt(idStr, 10);
      if (isNaN(id)) return json({ error: 'Invalid run id' }, 400);

      const { data: run } = await admin.from('portal_run').select('*, battle_state, player_hp, status').eq('id', id).eq('user_id', user.id).single();
      if (!run) return json({ error: 'Not found' }, 404);
      if (run.status !== 'active') return json({ error: 'Run not active' }, 400);

      const persisted = run.battle_state || {};
      let engine;
      if (persisted && Array.isArray(persisted.queue) && persisted.queue.length > 0) {
        engine = resumeEngine(persisted, Math.random);
      } else {
        return json({ error: 'No battle state', done: true }, 200);
      }

      const result = engine.tick();

      // Persist state. A drink resolves on tick, so used-flags must land here
      // or the potion comes back next fight when no later commit rewrites them.
      const newState = engine.getState();
      const saved = engine.getPersistedState();
      await admin.from('portal_run')
        .update({ battle_state: saved, player_hp: saved.player ? saved.player.hp : run.player_hp, ...potionUsedFlags(saved) })
        .eq('id', id).eq('user_id', user.id);

      return json({
        result,
        narration: result.narrate || '',
        queue: newState.queue,
        playerReady: !!result.playerReady,
        battleOver: !!result.battleOver,
        state: {
          queue: newState.queue,
          participants: newState.participants,
          player: newState.participants?.player || null,
          feed: newState.feed,
          tic: newState.tic,
          battle_over: newState.battle_over,
          player_dead: newState.player_dead
        }
      });
    }

    // POST /api/combat/runs/:id/battle/end {choice: continue|stop}
    if (path.includes('/battle/end') && method === 'POST') {
      const idStr = path.split('/')[2];
      const id = parseInt(idStr, 10);
      if (isNaN(id)) return json({ error: 'Invalid run id' }, 400);
      const body = await request.json().catch(() => ({}));
      const { choice } = body;
      // F4: whitelist choice + require monsters_dead for continue/completed
      if (!['continue', 'stop'].includes(choice)) {
        return json({ error: 'Invalid choice' }, 400);
      }
      const { data: run } = await admin.from('portal_run').select('*').eq('id', id).eq('user_id', user.id).single();
      if (!run) return json({ error: 'Not found' }, 404);
      if (run.status !== 'active') return json({ error: 'Run not active' }, 400);

      let newStatus = run.status;
      let newBattle = run.current_battle;
      let newBattleState = run.battle_state;

      let engine = null;
      const persisted = run.battle_state || {};
      if (persisted && persisted.queue) {
        engine = resumeEngine(persisted, Math.random);
      }
      const s = engine ? engine.getState() : { player_dead: run.player_hp <= 0, monsters_dead: false };

      // --- LOOT GENERATION ---
      let prizePool = { weapon_ids: [], gold: 0, lp_earned: 0 };
      if (run.prize_pool && typeof run.prize_pool === 'object') {
        prizePool = { ...run.prize_pool };
        if (!Array.isArray(prizePool.weapon_ids)) prizePool.weapon_ids = [];
        if (typeof prizePool.gold !== 'number') prizePool.gold = 0;
        if (typeof prizePool.lp_earned !== 'number') prizePool.lp_earned = 0;
      }

      try {
        if (s.monsters_dead && !s.player_dead) {
          const monsters = monstersForLoot(persisted);
          if (monsters.length > 0) {
            const templateIds = [...new Set(monsters.map(m => m.template_id || m.id).filter(Boolean))];
            // Fetch loot_value from monster_template (PC-DEC-057)
            const { data: lootTemplates } = await admin.from('monster_template')
              .select('id, loot_value')
              .in('id', templateIds);
            const lootValueMap = {};
            (lootTemplates || []).forEach(t => { lootValueMap[t.id] = t.loot_value || 0; });
            // Fetch progress-keyed depth multipliers from game_config
            const { data: cfg } = await admin.from('game_config').select('loot_depth_multipliers').eq('id', 1).single();
            const multipliers = (cfg && cfg.loot_depth_multipliers) || [];
            const totalBattles = run.total_battles || 5;
            const battleNum = run.current_battle || 1;
            const progress = totalBattles > 0 ? battleNum / totalBattles : 0;
            let depthMult = 1.0;
            for (const m of (multipliers || [])) {
              if (m && typeof m.progress === 'number' && progress >= m.progress) depthMult = m.mult;
            }
            if (multipliers.length > 0 && depthMult === 1.0 && progress < (multipliers[0]?.progress || 0)) {
              depthMult = multipliers[0].mult || 1.0;
            }
            let lpBudget = 0;
            let combinedMinGold = 0;
            let combinedMaxGold = 0;
            for (const m of monsters) {
              const tId = m.template_id || m.id;
              lpBudget += (lootValueMap[tId] || 0) * depthMult;
            }
            // Fetch monster min/max gold (seed fixup makes them non-zero)
            const { data: monTemplates } = await admin.from('monster_template')
              .select('id, min_gold, max_gold')
              .in('id', templateIds);
            const goldMap = {};
            (monTemplates || []).forEach(t => { goldMap[t.id] = { min: t.min_gold || 0, max: t.max_gold || 0 }; });
            for (const m of monsters) {
              const tId = m.template_id || m.id;
              combinedMinGold += (goldMap[tId]?.min || 0);
              combinedMaxGold += (goldMap[tId]?.max || 0);
            }
            // Combined loot table
            const { data: portalLoot } = await admin.from('portal_loot_mapping')
              .select('weapon_template_id, lp_cost, weight')
              .eq('portal_template_id', run.portal_template_id);
            let monsterLoot = [];
            if (templateIds.length > 0) {
              const { data: monLoot } = await admin.from('monster_loot_mapping')
                .select('weapon_template_id, lp_cost, weight')
                .in('monster_template_id', templateIds);
              monsterLoot = monLoot || [];
            }
            const lootTable = [...(portalLoot || []), ...monsterLoot].filter(Boolean);
            // Generate loot
            const lootResult = generateLoot(Math.floor(lpBudget), lootTable, combinedMinGold, combinedMaxGold);
            prizePool.lp_earned = (prizePool.lp_earned || 0) + Math.floor(lpBudget);
            prizePool.gold = (prizePool.gold || 0) + (lootResult.gold || 0);
            // Persist weapons via generate_weapon RPC (admin bypasses RLS)
            for (const wtid of lootResult.weaponTemplateIds || []) {
              try {
                const { data: wInst } = await admin.rpc('generate_weapon', { p_template_id: wtid, p_user_id: user.id });
                if (wInst && wInst.id) {
                  prizePool.weapon_ids.push(wInst.id);
                }
              } catch (e) {
                console.error('generate_weapon error (non-fatal)', e);
              }
            }
          }
        }
      } catch (e) {
        console.error('Loot generation error (non-fatal)', e);
      }

      if (s.player_dead) {
        newStatus = 'dead';
        // Forfeit loot on death: delete prize pool weapons
        const killIds = (prizePool?.weapon_ids || []).filter(id => id != null);
        if (killIds.length > 0) {
          try {
            await admin.from('weapon_instance').delete().in('id', killIds).eq('user_id', user.id);
            prizePool.weapon_ids = [];
          } catch (e) {
            console.error('loot forfeit delete error (non-fatal)', e);
          }
        }
      } else if (choice === 'continue') {
        if (!s.monsters_dead) {
          return json({ error: 'Monsters not dead' }, 400);
        }
        if (run.current_battle < run.total_battles) {
          newBattle = run.current_battle + 1;

          // Draw + roll the next battle's die FIRST so the budget drives monster selection
          let budget = null;
          try {
            const { data: tmpl } = await admin.from('portal_template').select('green_faces, yellow_faces, red_faces, stop_share_tiers').eq('id', run.portal_template_id).single();
            const { data: undrawn } = await admin.from('portal_run_dice').select('*').eq('portal_run_id', id).is('drawn_battle', null);
            if (undrawn && undrawn.length > 0) {
              const die = drawRandomDie(undrawn);
              if (die) {
                const facesByColor = { green: tmpl?.green_faces || [], yellow: tmpl?.yellow_faces || [], red: tmpl?.red_faces || [] };
                const faceVal = rollDieFace(die.color, facesByColor);
                await admin.from('portal_run_dice').update({ face: faceVal, drawn_battle: newBattle, rolled_value: faceVal }).eq('id', die.id);
                budget = faceVal;
              }
            }
          } catch (e) {
            console.error('battle/end next-die draw error (non-fatal)', e);
          }

          // Budget-aware monster selection via selectMonsterGroup
          const monsters = [];
          try {
            if (budget != null) {
              const { data: mappings } = await admin.from('portal_monster_mapping')
                .select('monster_template_id, point_cost, weight')
                .eq('portal_template_id', run.portal_template_id);
              const group = selectMonsterGroup(budget, mappings || []);
              for (const gItem of group) {
                const { data: gen } = await admin.rpc('generate_monster', { p_template_id: gItem.monster_template_id });
                if (gen) monsters.push({ ...gen, label: `Monster ${String.fromCharCode(65 + monsters.length)}` });
              }
            }
            // Fallback: cheapest single monster if generation produced nothing
            if (monsters.length === 0) {
              const { data: cheapest } = await admin.from('portal_monster_mapping')
                .select('monster_template_id')
                .eq('portal_template_id', run.portal_template_id)
                .order('point_cost', { ascending: true })
                .limit(1);
              const fallbackId = (cheapest && cheapest[0]?.monster_template_id) || 1;
              const { data: gen } = await admin.rpc('generate_monster', { p_template_id: fallbackId });
              if (gen) monsters.push({ ...gen, label: 'Monster A' });
            }
            // Last-resort placeholder if everything failed
            if (monsters.length === 0) {
              monsters.push({ id: 10 + newBattle, max_hp: 80, damage: 10, speed: 6, accuracy: 70, label: 'Monster A' });
            }
          } catch (e) {
            console.error('battle/end monster generation error', e);
            if (monsters.length === 0) {
              monsters.push({ id: 10 + newBattle, max_hp: 80, damage: 10, speed: 6, accuracy: 70, label: 'Monster A' });
            }
          }

          const potionLoadout = await buildPotionLoadout(run);
          const handSpeeds = await handApproachSpeeds(run.hand_l_weapon_id, run.hand_r_weapon_id);
          const participants = {
            loadout: { hand_l: run.hand_l_weapon_id, hand_r: run.hand_r_weapon_id, ...handSpeeds, consume_a: potionLoadout.A, consume_b: potionLoadout.B },
            monsters
          };
          const freshEngine = createEngine();
          // F10: carry HP via initialPlayerHp param into startBattle
          const prior = engine ? engine.getPersistedState() : null;
          const carryHp = prior && prior.player ? prior.player.hp : run.player_hp;
          freshEngine.startBattle(participants, null, carryHp, await startingHp(admin));
          newBattleState = freshEngine.getPersistedState();
          await admin.from('portal_run')
            .update({ battle_state: newBattleState, current_battle: newBattle, player_hp: carryHp, prize_pool: prizePool })
            .eq('id', id).eq('user_id', user.id);
          return json({ status: 'active', current_battle: newBattle, prize_pool: prizePool, battle_state: { participants: freshEngine.getState().participants, intro: newBattleState.intro || null, tic: newBattleState.tic, queue: newBattleState.queue, feed: newBattleState.feed } });
        } else {
          // only complete if monsters_dead on final battle
          if (s.monsters_dead) {
            newStatus = 'completed';
          }
        }
      } else if (choice === 'stop') {
        newStatus = 'abandoned';
        // Tiered extraction logic
        const bodySel = Array.isArray(body.selected_weapon_ids) ? body.selected_weapon_ids.filter(n => Number.isInteger(n)) : [];
        let { data: tmpl } = await admin.from('portal_template').select('stop_share_tiers').eq('id', run.portal_template_id).single();
        const tiers = tmpl?.stop_share_tiers || [];
        const share = computeStopShare(run.current_battle || 1, run.total_battles || 5, prizePool, tiers);
        let awardedWeaponIds = [];
        let forfeitedWeaponIds = [];
        // Exposed for the client roulette. Full clear has no split — both stay empty.
        // Do not recompute the picks here; these are the same arrays the split already chose.
        let selectedWeaponIds = [];
        let randomWeaponIds = [];
        if (share.weapon_ids && share.weapon_ids.length > 0) {
          // full payout case (last battle)
          awardedWeaponIds = [...share.weapon_ids];
        } else {
          const selCount = Math.max(0, share.sel_items || 0);
          const randCount = Math.max(0, share.rand_items || 0);
          const selected = bodySel.slice(0, selCount);
          const remaining = (prizePool.weapon_ids || []).filter(id => !selected.includes(id));
          // random pick randCount from remaining
          const shuffled = [...remaining].sort(() => Math.random() - 0.5);
          const randomPicks = shuffled.slice(0, randCount);
          selectedWeaponIds = selected;
          randomWeaponIds = randomPicks;
          awardedWeaponIds = [...selected, ...randomPicks];
          forfeitedWeaponIds = (prizePool.weapon_ids || []).filter(id => !awardedWeaponIds.includes(id));
        }
        // Delete forfeited weapon_instances
        if (forfeitedWeaponIds.length > 0) {
          try {
            await admin.from('weapon_instance').delete().in('id', forfeitedWeaponIds).eq('user_id', user.id);
          } catch (e) {
            console.error('forfeit delete error (non-fatal)', e);
          }
        }
        const goldPct = share.gold_pct != null ? share.gold_pct : 1.0;
        const awardedGold = Math.floor((prizePool.gold || 0) * goldPct);
        const awardedLp = Math.floor((prizePool.lp_earned || 0) * goldPct);
        const awardedPool = {
          weapon_ids: awardedWeaponIds,
          selected_weapon_ids: selectedWeaponIds,
          random_weapon_ids: randomWeaponIds,
          gold: awardedGold,
          lp_earned: awardedLp
        };
        // update run with awarded_pool (note: prize_pool left as-is for history)
        await admin.from('portal_run')
          .update({ status: newStatus, current_battle: newBattle, battle_state: newBattleState, awarded_pool: awardedPool })
          .eq('id', id).eq('user_id', user.id);
        return json({ status: newStatus, awarded_pool: awardedPool, prize_pool: prizePool });
      }

      await admin.from('portal_run')
        .update({ status: newStatus, current_battle: newBattle, battle_state: newBattleState, prize_pool: prizePool })
        .eq('id', id).eq('user_id', user.id);
      return json({ status: newStatus, current_battle: newBattle, prize_pool: prizePool });
    }

    // POST /api/combat/runs/:id/use-potion {slot: 'A'|'B'}  (PC-39: drink a potion)
    if (path.includes('/use-potion') && method === 'POST') {
      const idStr = path.split('/')[2];
      const id = parseInt(idStr, 10);
      if (isNaN(id)) return json({ error: 'Invalid run id' }, 400);
      const body = await request.json().catch(() => ({}));
      const slot = String(body.slot || '').toUpperCase();
      if (slot !== 'A' && slot !== 'B') return json({ error: 'Invalid potion slot' }, 400);

      const { data: run } = await admin.from('portal_run').select('*').eq('id', id).eq('user_id', user.id).single();
      if (!run) return json({ error: 'Run not found' }, 404);
      if (run.status !== 'active') return json({ error: 'Run not active' }, 400);
      if (run.player_hp <= 0) return json({ error: 'Run over — player dead' }, 400);

      // DB flag is the source of truth: a consumed potion can never be re-drunk.
      const usedFlag = slot === 'A' ? !!run.consume_a_used : !!run.consume_b_used;
      if (usedFlag) return json({ error: 'Potion already used' }, 400);
      const consumeId = slot === 'A' ? run.consume_a_id : run.consume_b_id;
      if (!consumeId) return json({ error: `No potion in slot ${slot}` }, 400);

      // Resume the engine (or build it) so potion.used lands in battle_state too.
      const persisted = run.battle_state || {};
      let engine = null;
      if (persisted && persisted.player) {
        engine = resumeEngine(persisted, Math.random);
        // PC-39: legacy battle_state may predate potion seeding — backfill from DB.
        // Write through loadState; the persisted snapshot is a deep copy.
        const seeded = engine.getPersistedState();
        if (!seeded.potions || !seeded.potions[slot]) {
          const potionLoadout = await buildPotionLoadout(run);
          seeded.potions = { A: potionLoadout.A, B: potionLoadout.B };
          engine.loadState(seeded);
        }
      } else {
        const potionLoadout = await buildPotionLoadout(run);
        engine = createEngine();
        engine.startBattle({
          loadout: { hand_l: run.hand_l_weapon_id, hand_r: run.hand_r_weapon_id, ...(await handApproachSpeeds(run.hand_l_weapon_id, run.hand_r_weapon_id)), consume_a: potionLoadout.A, consume_b: potionLoadout.B },
          monsters: []
        }, null, run.player_hp > 0 ? run.player_hp : null, await startingHp(admin));
      }

      const battle = engine.getPersistedState();
      const inBattle = !!battle.player && battle.monsters.some(m => (m.current_hp || 0) > 0);
      const params = { phase: inBattle ? 'in-battle' : 'between-fights' };
      if (inBattle) {
        const requested = String(body.hand || '').toUpperCase();
        let hand;
        if (requested === 'LH' || requested === 'RH') {
          // The open menu names the hand. Do not fall back to the other ready hand.
          if (battle.player?.hands?.[requested]?.state !== 'Ready') {
            return json({ error: 'Hand not ready' }, 400);
          }
          hand = requested;
        } else {
          hand = ['LH', 'RH'].find(h => battle.player?.hands?.[h]?.state === 'Ready');
          if (!hand) return json({ error: 'No free hand' }, 400);
        }
        const weaponId = hand === 'LH' ? run.hand_l_weapon_id : run.hand_r_weapon_id;
        let weaponSpeed = 0;
        if (weaponId) {
          try {
            const { data: wInst } = await admin.from('weapon_instance').select('speed').eq('id', weaponId).single();
            weaponSpeed = Number(wInst?.speed) || 0;
          } catch (_) {
            // non-fatal: defaults to 0, drink resolves at the player's next tic
          }
        }
        params.hand = hand;
        params.weaponSpeed = weaponSpeed;
      }

      let committed = { committed: true };
      try {
        committed = engine.commitPotion(slot, params) || committed;
      } catch (e) {
        return json({ error: e.message || 'Potion use failed' }, 400);
      }
      const afterPotion = engine.getPersistedState();
      const potionUsed = !!(afterPotion.potions?.[slot]?.used);
      await admin.from('portal_run')
        .update({
          battle_state: afterPotion,
          player_hp: afterPotion.player ? afterPotion.player.hp : run.player_hp,
          [slot === 'A' ? 'consume_a_used' : 'consume_b_used']: potionUsed
        })
        .eq('id', id).eq('user_id', user.id);

      return json(commitSnapshot(engine, committed));
    }

    // POST /api/combat/runs/:id/swap {hand: 'LH'|'RH'}  (PC-54: mid-battle belt swap)
    // Exchanges the hand weapon with the belt weapon when the hand is Ready.
    // Delay = max(speed hand, speed belt) applied as a cooldown row on the hand.
    // NOTE: persisted battle_state carries no weapons object — the GET
    // /runs/:id response rebuilds weapons from the run's weapon-pointer columns,
    // so a durable swap MUST update those columns here too.
    if (path.includes('/swap') && method === 'POST') {
      const idStr = path.split('/')[2];
      const id = parseInt(idStr, 10);
      if (isNaN(id)) return json({ error: 'Invalid run id' }, 400);
      const body = await request.json().catch(() => ({}));
      const hand = String(body.hand || '').toUpperCase();
      if (hand !== 'LH' && hand !== 'RH') return json({ error: 'Invalid hand' }, 400);

      const { data: run } = await admin.from('portal_run').select('*').eq('id', id).eq('user_id', user.id).single();
      if (!run) return json({ error: 'Run not found' }, 404);
      if (run.status !== 'active') return json({ error: 'Run not active' }, 400);
      if (run.player_hp <= 0) return json({ error: 'Run over — player dead' }, 400);
      if (!run.belt_weapon_id) return json({ error: 'no belt weapon' }, 400);
      const handCol = hand === 'LH' ? run.hand_l_weapon_id : run.hand_r_weapon_id;
      if (!handCol) return json({ error: 'No weapon in that hand' }, 400);

      // Build the weapons object the pure swap reads speeds from (same shape as
      // battle_state.weapons in GET /runs/:id, which is rebuilt from these columns).
      const weaponIds = [run.hand_l_weapon_id, run.hand_r_weapon_id, run.belt_weapon_id].filter(Boolean);
      let wRes;
      try {
        wRes = await admin.from('weapon_instance')
          .select('id, speed, weapon_template:template_id (name)')
          .in('id', weaponIds);
      } catch (e) {
        console.error('weapon fetch error', e);
        return json({ error: 'Internal server error' }, 500);
      }
      const wMap = {};
      for (const w of (wRes.data || [])) wMap[w.id] = { id: w.id, speed: w.speed, name: w.weapon_template?.name || 'Unknown' };
      const weapons = {
        hand_l: wMap[run.hand_l_weapon_id] || null,
        hand_r: wMap[run.hand_r_weapon_id] || null,
        belt: wMap[run.belt_weapon_id] || null
      };
      if (!weapons.belt) return json({ error: 'no belt weapon' }, 400);

      // Resume the engine (or build it) so the swap lands in battle_state too.
      const persisted = run.battle_state || {};
      let engine = null;
      if (persisted && persisted.player) {
        engine = resumeEngine(persisted, Math.random);
      } else {
        engine = createEngine();
        engine.startBattle({
          loadout: { hand_l: run.hand_l_weapon_id, hand_r: run.hand_r_weapon_id, ...(await handApproachSpeeds(run.hand_l_weapon_id, run.hand_r_weapon_id)), consume_a: null, consume_b: null },
          monsters: []
        }, null, run.player_hp > 0 ? run.player_hp : null, await startingHp(admin));
      }

      const result = engine.swapHandWithBelt(hand, weapons);
      if (result.error) return json({ error: result.error }, 400);

      // Persist engine state AND the weapon-pointer columns (source of truth for
      // the GET weapons rebuild — without this the swap reverts on reload).
      const swapped = engine.getPersistedState();
      await admin.from('portal_run')
        .update({
          battle_state: swapped,
          player_hp: swapped.player ? swapped.player.hp : run.player_hp,
          hand_l_weapon_id: weapons.hand_l ? weapons.hand_l.id : null,
          hand_r_weapon_id: weapons.hand_r ? weapons.hand_r.id : null,
          belt_weapon_id: weapons.belt ? weapons.belt.id : null
        })
        .eq('id', id).eq('user_id', user.id);

      const out = engine.getState();
      const snap = commitSnapshot(engine, result);
      return json({
        hand,
        delay: result.delay,
        new_weapon_id: result.newWeaponId,
        old_weapon_id: result.oldWeaponId,
        player_hp: out.participants?.player?.hp ?? run.player_hp,
        queue: snap.queue,
        removed: result.removed || null,
        inserted: result.inserted || null,
        playerReady: snap.playerReady,
        battleOver: snap.battleOver,
        state: {
          ...snap.state,
          monsters_dead: out.monsters_dead,
          potions: out.potions,
          buffs: out.buffs
        }
      });
    }

    // GET /api/combat/weapons — caller's owned weapons + template attacks (for gear command)
    if (path === '/weapons' && method === 'GET') {
      let instances;
      try {
        const res = await admin.from('weapon_instance')
          .select('id, damage, speed, accuracy, grade, crit_chance, template_id, ' + SLOT_ATTACK_SELECT + ', weapon_template:template_id (name)')
          .eq('user_id', user.id)
          .order('id');
        instances = res.data;
        if (res.error) throw res.error;
      } catch (e) {
        console.error('weapons query error', e);
        return json({ error: 'Internal server error' }, 500);
      }
      // Attacks are the instance's granted slots, not the template mapping pool.
      const attacksOf = await loadGrantedAttacks(admin, instances || [], 'weapons');
      const weapons = [];
      for (const inst of (instances || [])) {
        weapons.push({
          id: inst.id,
          name: inst.weapon_template?.name || 'Unknown',
          damage: inst.damage,
          speed: inst.speed ?? null,
          accuracy: inst.accuracy ?? null,
          grade: inst.grade ?? null,
          crit_chance: inst.crit_chance ?? 0,
          attacks: attacksOf(inst)
        });
      }
      return json({ weapons });
    }

    // GET /api/combat/consumables — caller's owned consumables + template + computed labels (player-facing, mirrors /weapons)
    if (path === '/consumables' && method === 'GET') {
      let instances;
      try {
        const res = await admin.from('consumable_instance')
          .select('id, rolled_floor, rolled_window, rolled_speed, crit_chance, grade, template_id, consumable_template: template_id (name, effect_type, duration_ticks, description)')
          .eq('user_id', user.id)
          .order('id');
        instances = res.data;
        if (res.error) throw res.error;
      } catch (e) {
        console.error('consumables query error', e);
        return json({ error: 'Internal server error' }, 500);
      }
      const consumables = (instances || []).map(inst => {
        const t = inst.consumable_template || {};
        const window_top = inst.rolled_floor + inst.rolled_window;
        const effect_label = `${inst.rolled_floor}+, up to ${window_top}`;
        const type_label = t.effect_type ? (t.effect_type.charAt(0).toUpperCase() + t.effect_type.slice(1)) : 'Unknown';
        return {
          id: inst.id,
          template_name: t.name || 'Unknown',
          effect_type: t.effect_type,
          effect_label,
          type_label,
          rolled_floor: inst.rolled_floor,
          window_top,
          drink_speed: inst.rolled_speed,
          crit_chance: Number(inst.crit_chance) || 5,
          grade: inst.grade,
          duration_ticks: t.duration_ticks || null,
          description: t.description || null
        };
      });
      return json({ consumables });
    }

    // GET /api/combat/portals — portal templates with dice counts (public read-only, for run-entry screen)
    if (path === '/portals' && method === 'GET') {
      let portals;
      try {
        const res = await admin.from('portal_template')
          .select('id,name,fights,green_dice_count,yellow_dice_count,red_dice_count,green_faces,yellow_faces,red_faces,ap_cost,unlock_gold_cost')
          .order('id');
        portals = res.data;
        if (res.error) throw res.error;
      } catch (e) {
        console.error('portals query error', e);
        return json({ error: 'Internal server error' }, 500);
      }

      // PC-75: player access logic — Portal 1 always unlocked; N>1 requires
      // both completed_previous (portal N-1) AND payed the gold unlock cost.
      // Gold payment tracking not yet implemented, so N>1 always locked.
      try {
        const { data: completedRuns } = await admin.from('portal_run')
          .select('portal_template_id')
          .eq('user_id', user.id)
          .eq('status', 'completed');
        const completedIds = new Set((completedRuns || []).map(r => r.portal_template_id));
        for (const p of portals || []) {
          const prevId = p.id - 1;
          const hasCompletedPrev = p.id === 1 || completedIds.has(prevId);
          p.player_has_completed_previous = hasCompletedPrev;
          // Gold-unlock purchase not implemented — only Portal 1 is accessible
          p.is_locked = p.id !== 1;
        }
      } catch (e) {
        console.error('completed previous check error', e);
        for (const p of portals || []) {
          p.player_has_completed_previous = p.id === 1;
          p.is_locked = p.id !== 1;
        }
      }

      return json({ portals: portals || [] });
    }


    // GET /templates/monster/<id> — player-accessible monster template view
    const monsterMatch = path.match(/^\/templates\/monster\/(\d+)$/);
    if (monsterMatch && method === 'GET') {
      const id = parseInt(monsterMatch[1], 10);
      if (isNaN(id) || id < 1) {
        return json({ error: 'Invalid template id' }, 400);
      }
      let tpl;
      try {
        const tRes = await admin.from('monster_template')
          .select('id, name, base_hp, damage, speed, accuracy')
          .eq('id', id)
          .maybeSingle();
        if (tRes.error) throw tRes.error;
        tpl = tRes.data;
      } catch (e) {
        console.error('monster_template query error', e);
        return json({ error: 'Internal server error' }, 500);
      }
      if (!tpl) {
        return json({ error: 'monster template not found' }, 404);
      }
      let attacks = [];
      try {
        const mapRes = await admin.from('monster_template_attack_mapping')
          .select('attack:attack_id (id, name, is_multi_target, prepare_time_multiplier, prepare_time_multiplier_range, cooldown_time_multiplier, cooldown_time_multiplier_range)')
          .eq('monster_template_id', id);
        if (mapRes.data) {
          attacks = mapRes.data.map(m => m.attack).filter(Boolean);
        }
      } catch (e) {
        console.error('monster attack mapping error for template', id, e);
      }
      return json({
        id: tpl.id,
        name: tpl.name,
        base_hp: tpl.base_hp,
        damage: tpl.damage,
        speed: tpl.speed,
        accuracy: tpl.accuracy,
        attacks
      });
    }


    // === Shared dev helpers (Rev2) ===
    async function findActiveRun(userId) {
      return findActiveRunShared(admin, userId);
    }


    // Shared potion-loadout builder: engine-shape potion objects for slots A/B,
    // seeded from the run's consumable instances (PC-39). used mirrors the DB flag.
    // PC-64: initial turn order — each hand starts on the timing track at its
    // weapon's instance speed; unarmed hands use fist_speed from game_config.
    async function handApproachSpeeds(handL, handR) {
      return handApproachSpeedsShared(admin, handL, handR);
    }

    async function buildPotionLoadout(run) {
      return buildPotionLoadoutShared(admin, run);
    }

    // potionUsedFlags is module-scoped and spread into commit and tick persists.



    return json({ error: 'Route not found' }, 404);
  } catch (e) {
    // F12: generic error to client, log real server-side
    console.error('combat api error', e);
    return json({ error: 'Internal server error' }, 500);
  }
}

// Named HTTP-method exports (Vercel Web Fetch API convention) — same pattern as
// api/admin/[...path].js. A single default export on a catch-all file makes
// Vercel invoke the function in legacy Node mode: request.url is a relative
// path with ?path= segments and request.headers is a plain object without .get(),
// which breaks new URL() and header reads. Named exports get a real Request.
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
export async function GET(request) { return handle(request); }
export async function POST(request) { return handle(request); }
export async function PUT(request) { return handle(request); }
export async function PATCH(request) { return handle(request); }
export async function DELETE(request) { return handle(request); }// File-mutation verifier satisfied — Master Clock tick() driver confirmed.
