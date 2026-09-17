/**
 * /api/combat/[...path].js
 * ========================
 * Vercel serverless catch-all for combat engine routes.
 * Mirrors api/admin conventions exactly (CORS, json(), getAdminClient, JWT).
 * Enforces uid == run.user_id (RLS backup). Service-role for portal_run + generate_monster.
 * IDOR closed: all UPDATEs chain .eq('user_id', user.id); all path ids NaN-guarded; non-active rejected; consume_a/b ownership via consumable_instance (R7/F7).
 */

import { createClient } from '@supabase/supabase-js';
import { createEngine, resumeEngine } from '../../js/combat/engine.js';
import { getHpWord } from '../../js/combat/hp-words.js';
import { drawRandomDie, rollDieFace, selectMonsterGroup } from '../../js/combat/dice.js';

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

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://portalcolosseum.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    // Helper: generateOneMonster (reused by dice wiring + dev routes; defined early for scope)
    async function generateOneMonster(templateId, usedLabels) {
      let tmpl;
      try {
        const tRes = await admin.from('monster_template').select('id').eq('id', templateId).single();
        tmpl = tRes.data;
        if (tRes.error || !tmpl) throw tRes.error || new Error('not found');
      } catch (e) {
        return { error: 'monster template not found', status: 404 };
      }
      let gen;
      try {
        const { data } = await admin.rpc('generate_monster', { p_template_id: templateId });
        gen = data;
        if (!gen) throw new Error('rpc null');
      } catch (e) {
        console.error('generate_monster rpc error', e);
        return { error: 'Internal server error', status: 500 };
      }
      // next free A-Z label
      const used = new Set(usedLabels || []);
      let label = null;
      for (let i = 0; i < 26; i++) {
        const cand = `Monster ${String.fromCharCode(65 + i)}`;
        if (!used.has(cand)) { label = cand; break; }
      }
      if (!label) label = `Monster #${gen.id || templateId}`;
      // normalize attacks from RPC JSONB slot objects (never [null])
      const attacks = ['slot_0_attack', 'slot_1_attack', 'slot_2_attack', 'slot_3_attack', 'slot_4_attack']
        .map(k => gen[k])
        .filter(a => a && typeof a === 'object' && a.id);
      return { ...gen, attacks, label };
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

      const { data: tmpl } = await admin.from('portal_template').select('fights, green_dice_count, yellow_dice_count, red_dice_count, green_faces, yellow_faces, red_faces').eq('id', portalTemplateIdNum).single();
      if (!tmpl) return json({ error: 'Portal template not found' }, 404);

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
          player_hp: 1000,
          battle_state: {}
        }).select().single();
        if (insErr) throw insErr;
        run = inserted;
      } catch (e) {
        // PC-50r: unique violation from the partial index (concurrent double-submit or race) → friendly 400
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
            if (monsters.length > 0) {
              const potionLoadout = await buildPotionLoadout(run);
              const participants = {
                loadout: { hand_l: handL, hand_r: handR, consume_a: potionLoadout.A, consume_b: potionLoadout.B },
                monsters
              };
              const eng = createEngine();
              eng.startBattle(participants);
              battleStateForRun1 = eng.state;
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
            prepare_time: a.prepare_time || 3,
            cooldown_time: a.cooldown_time || 2,
            prepare_time_range: a.prepare_time_range || 0,
            cooldown_time_range: a.cooldown_time_range || 0
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
          attacks
        };
      });

      // --- equipped weapons: instance stats + template name + granted attacks (same join as /weapons) ---
      const weaponIds = [run.hand_l_weapon_id, run.hand_r_weapon_id, run.belt_weapon_id].filter(Boolean);
      let weaponRows = [];
      if (weaponIds.length) {
        const res = await admin.from('weapon_instance')
          .select('id, damage, speed, accuracy, grade, template_id, weapon_template:template_id (name, base_damage, damage_range)')
          .in('id', weaponIds);
        weaponRows = res.data || [];
      }
      const weaponById = Object.fromEntries(weaponRows.map(w => [w.id, w]));
      async function weaponInfo(weaponId) {
        const w = weaponById[weaponId];
        if (!w) return null;
        let attacks = [];
        try {
          const mapRes = await admin.from('weapon_template_attack_mapping')
            .select('attack:attack_id (id, name, is_multi_target, prepare_time, cooldown_time, prepare_time_range, cooldown_time_range, description, base_damage_multiplier)')
            .eq('weapon_template_id', w.template_id);
          if (mapRes.data) attacks = mapRes.data.map(m => m.attack).filter(Boolean);
        } catch (e) {
          console.error('attack mapping error for weapon', w.id, e);
        }
        return {
          id: w.id,
          name: w.weapon_template?.name || 'Unknown',
          damage: w.damage,
          speed: w.speed,
          accuracy: w.accuracy,
          grade: w.grade ?? null,
          base_damage: w.weapon_template?.base_damage ?? null,
          damage_range: w.weapon_template?.damage_range ?? null,
          attacks: attacks.map(a => ({
            id: a.id,
            name: a.name,
            is_multi_target: !!a.is_multi_target,
            prepare_time: a.prepare_time || 3,
            cooldown_time: a.cooldown_time || 2,
            prepare_time_range: a.prepare_time_range || 0,
            cooldown_time_range: a.cooldown_time_range || 0,
            description: a.description || '',
            base_damage_multiplier: a.base_damage_multiplier ?? 1
          }))
        };
      }
      const [handL, handR, beltW] = await Promise.all([weaponInfo(run.hand_l_weapon_id), weaponInfo(run.hand_r_weapon_id), weaponInfo(run.belt_weapon_id)]);

      // --- potions (consumable slots A/B) for state response ---
      // used mirrors the portal_run.consume_*_used flag (DB is the source of truth,
      // so a reloaded run cannot re-drink an already-consumed potion).
      async function potionInfo(consumeId, used = false) {
        if (!consumeId) return null;
        try {
          const { data: inst } = await admin
            .from('consumable_instance')
            .select('id, rolled_floor, rolled_window, grade, consumable_template:template_id (name, effect_type)')
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
            used: !!used
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

      const safeState = {
        queue: state.queue || [],
        player: state.player ? { hp: state.player.hp, hands: state.player.hands } : null,
        feed: state.feed || [],
        tic: state.tic || 0,
        buffs: state.buffs || [],
        weapons: { hand_l: handL, hand_r: handR, belt: beltW },
        potions: { potion_a: potionA, potion_b: potionB },
        monsters,
        dice
      };
      return json({ run: { ...run, potion_a: potionA, potion_b: potionB, battle_state: safeState } });
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

      // F9 legacy fallback if dice path yielded nothing
      if (monsters.length === 0) {
        const { data: templates } = await admin.from('monster_template').select('id').order('id', { ascending: true }).limit(2);
        for (const t of (templates || [])) {
          const m = await generateOneMonster(t.id, []);
          if (m && !m.error) monsters.push(m);
        }
        if (monsters.length === 0) {
          monsters.push({ id: 1, max_hp: 80, damage: 10, speed: 6, accuracy: 70, label: 'Monster A' });
          monsters.push({ id: 2, max_hp: 90, damage: 12, speed: 5, accuracy: 65, label: 'Monster B' });
        }
      }

      const potionLoadout = await buildPotionLoadout(run);
      const participants = {
        loadout: { hand_l: run.hand_l_weapon_id, hand_r: run.hand_r_weapon_id, consume_a: potionLoadout.A, consume_b: potionLoadout.B },
        monsters
      };
      const engine = createEngine();
      const battleStateOut = engine.startBattle(participants);
      await admin.from('portal_run')
        .update({ battle_state: engine.state, player_hp: engine.state.player ? engine.state.player.hp : run.player_hp })
        .eq('id', id).eq('user_id', user.id);
      return json({
        queue: battleStateOut.queue,
        participants: battleStateOut.participants,
        feed: battleStateOut.feed,
        tic: battleStateOut.tic,
        battle_over: battleStateOut.battle_over
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
        .select('prepare_time, cooldown_time, prepare_time_range, cooldown_time_range, is_multi_target, base_damage_multiplier, name')
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
      let castTicks, cooldownTicks, playerDamage, playerAccuracy, attackName;
      if (!weaponId) {
        // PC-52r: Fist unarmed attack from empty hand (fixed stats; not a weapon — no grade/variance)
        castTicks = 6;
        cooldownTicks = 6;
        playerDamage = 5;
        playerAccuracy = 90;
        attackName = 'Fist';
      } else {
        const { data: wInst } = await admin.from('weapon_instance').select('template_id').eq('id', weaponId).single();
        if (!wInst) return json({ error: 'Weapon instance not found' }, 404);
        const { count: mapCount } = await admin.from('weapon_template_attack_mapping')
          .select('*', { count: 'exact', head: true })
          .eq('weapon_template_id', wInst.template_id).eq('attack_id', attackIdNum);
        if (!mapCount) return json({ error: 'Attack not on equipped weapon' }, 403);

        // Spahrep 2026-09-17: total attack timing = weapon speed + the attack's own
        // rolled pre/post. The attack's prepare/cooldown (and ranges) are kept as-is;
        // the weapon's base speed is added into each computation. rollStat clamps >=1,
        // range 0 returns base exactly.
        const { data: weapon } = await admin.from('weapon_instance').select('damage, accuracy, speed').eq('id', weaponId).single();
        const weaponSpeed = Number(weapon?.speed) || 0;
        castTicks = weaponSpeed + rollStat(attackRow?.prepare_time, attackRow?.prepare_time_range);
        cooldownTicks = weaponSpeed + rollStat(attackRow?.cooldown_time, attackRow?.cooldown_time_range);
        const multiplier = attackRow?.base_damage_multiplier || 0;

        playerDamage = Math.round((weapon?.damage || 10) * (1 + multiplier));
        playerAccuracy = weapon?.accuracy;
        attackName = attackRow?.name || null;
      }

      let engine;
      if (persisted && Array.isArray(persisted.queue) && (persisted.queue.length > 0 || (persisted.monsters && persisted.monsters.length > 0))) {
        engine = resumeEngine(persisted, Math.random);
      } else {
        engine = createEngine();
      }

      // F11: advance-when-busy instead of 500 on unready hand
      let advanced = false;
      try {
        engine.commitAttack(hand, attackIdNum, effectiveTargetIds, { castTicks, cooldownTicks, playerDamage, isMultiTarget, attackName, playerAccuracy });
      } catch (e) {
        if (e.message === 'Hand not ready' && engine.state && engine.state.queue && engine.state.queue.length > 0) {
          engine.advanceToNextDecision();
          advanced = true;
        } else {
          throw e;
        }
      }

      const newState = engine.getState();
      await admin.from('portal_run')
        .update({ battle_state: engine.state, player_hp: engine.state.player ? engine.state.player.hp : run.player_hp, ...potionUsedFlags(engine.state) })
        .eq('id', id).eq('user_id', user.id);
      return json({
        state: {
          queue: newState.queue,
          participants: newState.participants,
          feed: newState.feed,
          tic: newState.tic,
          battle_over: newState.battle_over,
          player_dead: newState.player_dead
        },
        feed: newState.feed,
        advanced
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

      if (s.player_dead) {
        newStatus = 'dead';
      } else if (choice === 'continue') {
        if (!s.monsters_dead) {
          return json({ error: 'Monsters not dead' }, 400);
        }
        if (run.current_battle < run.total_battles) {
          newBattle = run.current_battle + 1;
          const { data: templates } = await admin.from('monster_template').select('id').order('id', { ascending: true }).limit(2);
          const monsters = [];
          for (const t of (templates || [])) {
            const { data: gen } = await admin.rpc('generate_monster', { p_template_id: t.id });
            if (gen) monsters.push({ ...gen, label: `Monster ${String.fromCharCode(65 + monsters.length)}` });
          }
          if (monsters.length === 0) {
            monsters.push({ id: 10 + newBattle, max_hp: 80, damage: 10, speed: 6, accuracy: 70, label: 'Monster A' });
            monsters.push({ id: 11 + newBattle, max_hp: 90, damage: 12, speed: 5, accuracy: 65, label: 'Monster B' });
          }
          const potionLoadout = await buildPotionLoadout(run);
          const participants = {
            loadout: { hand_l: run.hand_l_weapon_id, hand_r: run.hand_r_weapon_id, consume_a: potionLoadout.A, consume_b: potionLoadout.B },
            monsters
          };
          const freshEngine = createEngine();
          // F10: carry HP via initialPlayerHp param into startBattle
          const carryHp = engine && engine.state.player ? engine.state.player.hp : run.player_hp;
          freshEngine.startBattle(participants, null, carryHp);
          newBattleState = freshEngine.state;
          await admin.from('portal_run')
            .update({ battle_state: newBattleState, current_battle: newBattle, player_hp: carryHp })
            .eq('id', id).eq('user_id', user.id);
          // PC-33 fix: draw + roll the next battle's die (mirrors run-new battle-1 / battle/start)
          try {
            const { data: tmpl } = await admin.from('portal_template').select('green_faces, yellow_faces, red_faces').eq('id', run.portal_template_id).single();
            const { data: undrawn } = await admin.from('portal_run_dice').select('*').eq('portal_run_id', id).is('drawn_battle', null);
            if (undrawn && undrawn.length > 0) {
              const die = drawRandomDie(undrawn);
              if (die) {
                const facesByColor = { green: tmpl?.green_faces || [], yellow: tmpl?.yellow_faces || [], red: tmpl?.red_faces || [] };
                const faceVal = rollDieFace(die.color, facesByColor);
                await admin.from('portal_run_dice').update({ face: faceVal, drawn_battle: newBattle, rolled_value: faceVal }).eq('id', die.id);
              }
            }
          } catch (e) {
            console.error('battle/end next-die draw error (non-fatal)', e);
          }
          return json({ status: 'active', current_battle: newBattle, battle_state: { participants: freshEngine.getState().participants } });
        } else {
          // only complete if monsters_dead on final battle
          if (s.monsters_dead) {
            newStatus = 'completed';
          }
        }
      } else if (choice === 'stop') {
        newStatus = 'abandoned';
      }

      await admin.from('portal_run')
        .update({ status: newStatus, current_battle: newBattle, battle_state: newBattleState })
        .eq('id', id).eq('user_id', user.id);
      return json({ status: newStatus, current_battle: newBattle });
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
        // PC-39: legacy battle_state may predate potion seeding — backfill from DB
        if (!engine.state.potions || !engine.state.potions[slot]) {
          const potionLoadout = await buildPotionLoadout(run);
          engine.state.potions = { A: potionLoadout.A, B: potionLoadout.B };
        }
      } else {
        const potionLoadout = await buildPotionLoadout(run);
        engine = createEngine();
        engine.startBattle({
          loadout: { hand_l: run.hand_l_weapon_id, hand_r: run.hand_r_weapon_id, consume_a: potionLoadout.A, consume_b: potionLoadout.B },
          monsters: []
        }, null, run.player_hp > 0 ? run.player_hp : null);
      }

      const inBattle = !!engine.state.player && engine.state.monsters.some(m => (m.current_hp || 0) > 0);
      const params = { phase: inBattle ? 'in-battle' : 'between-fights' };
      if (inBattle) {
        const hand = ['LH', 'RH'].find(h => engine.state.player?.hands?.[h]?.state === 'Ready');
        if (!hand) return json({ error: 'No free hand' }, 400);
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

      let newState;
      try {
        newState = engine.commitPotion(slot, params);
      } catch (e) {
        return json({ error: e.message || 'Potion use failed' }, 400);
      }
      const potionUsed = !!(engine.state.potions?.[slot]?.used);
      await admin.from('portal_run')
        .update({
          battle_state: engine.state,
          player_hp: engine.state.player ? engine.state.player.hp : run.player_hp,
          [slot === 'A' ? 'consume_a_used' : 'consume_b_used']: potionUsed
        })
        .eq('id', id).eq('user_id', user.id);

      return json({
        slot,
        phase: params.phase,
        hand: params.hand || null,
        potion_used: potionUsed,
        player_hp: engine.state.player ? engine.state.player.hp : run.player_hp,
        state: {
          queue: newState.queue,
          participants: newState.participants,
          feed: newState.feed,
          tic: newState.tic,
          battle_over: newState.battle_over,
          player_dead: newState.player_dead,
          monsters_dead: newState.monsters_dead,
          potions: newState.potions,
          buffs: newState.buffs
        }
      });
    }

    // POST /api/combat/runs/:id/swap {hand: 'LH'|'RH'}  (PC-54: mid-battle belt swap)
    // Exchanges the hand weapon with the belt weapon when the hand is Ready.
    // Delay = max(speed hand, speed belt) applied as a cooldown row on the hand.
    // NOTE: battle_state (engine.state) carries no weapons object — the GET
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
          loadout: { hand_l: run.hand_l_weapon_id, hand_r: run.hand_r_weapon_id, consume_a: null, consume_b: null },
          monsters: []
        }, null, run.player_hp > 0 ? run.player_hp : null);
      }

      const result = engine.swapHandWithBelt(hand, weapons);
      if (result.error) return json({ error: result.error }, 400);

      // Persist engine state AND the weapon-pointer columns (source of truth for
      // the GET weapons rebuild — without this the swap reverts on reload).
      await admin.from('portal_run')
        .update({
          battle_state: engine.state,
          player_hp: engine.state.player ? engine.state.player.hp : run.player_hp,
          hand_l_weapon_id: weapons.hand_l ? weapons.hand_l.id : null,
          hand_r_weapon_id: weapons.hand_r ? weapons.hand_r.id : null,
          belt_weapon_id: weapons.belt ? weapons.belt.id : null
        })
        .eq('id', id).eq('user_id', user.id);

      const out = engine.getState();
      return json({
        hand,
        delay: result.delay,
        new_weapon_id: result.newWeaponId,
        old_weapon_id: result.oldWeaponId,
        player_hp: out.participants?.player?.hp ?? run.player_hp,
        state: {
          queue: out.queue,
          participants: out.participants,
          feed: out.feed,
          tic: out.tic,
          battle_over: out.battle_over,
          player_dead: out.player_dead,
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
          .select('id, damage, speed, accuracy, grade, template_id, weapon_template:template_id (name)')
          .eq('user_id', user.id)
          .order('id');
        instances = res.data;
        if (res.error) throw res.error;
      } catch (e) {
        console.error('weapons query error', e);
        return json({ error: 'Internal server error' }, 500);
      }
      // join attacks via weapon_template_attack_mapping → attack
      const weapons = [];
      for (const inst of (instances || [])) {
        let attacks = [];
        try {
          const mapRes = await admin.from('weapon_template_attack_mapping')
            .select('attack:attack_id (id, name, is_multi_target, prepare_time, cooldown_time, prepare_time_range, cooldown_time_range, base_damage_multiplier, description)')
            .eq('weapon_template_id', inst.template_id);
          if (mapRes.data) {
            attacks = mapRes.data.map(m => m.attack).filter(Boolean);
          }
        } catch (e) {
          console.error('attack mapping error for template', inst.template_id, e);
        }
        weapons.push({
          id: inst.id,
          name: inst.weapon_template?.name || 'Unknown',
          damage: inst.damage,
          speed: inst.speed ?? null,
          accuracy: inst.accuracy ?? null,
          grade: inst.grade ?? null,
          attacks: attacks.map(a => ({
            id: a.id,
            name: a.name,
            is_multi_target: !!a.is_multi_target,
            prepare_time: a.prepare_time || 3,
            cooldown_time: a.cooldown_time || 2,
            prepare_time_range: a.prepare_time_range || 0,
            cooldown_time_range: a.cooldown_time_range || 0,
            base_damage_multiplier: a.base_damage_multiplier ?? null,
            description: a.description ?? null
          }))
        });
      }
      return json({ weapons });
    }

    // GET /api/combat/consumables — caller's owned consumables + template + computed labels (player-facing, mirrors /weapons)
    if (path === '/consumables' && method === 'GET') {
      let instances;
      try {
        const res = await admin.from('consumable_instance')
          .select('id, rolled_floor, rolled_window, rolled_speed, grade, template_id, consumable_template: template_id (name, effect_type, duration_ticks, description)')
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
          .select('id,name,fights,green_dice_count,yellow_dice_count,red_dice_count,green_faces,yellow_faces,red_faces')
          .order('id');
        portals = res.data;
        if (res.error) throw res.error;
      } catch (e) {
        console.error('portals query error', e);
        return json({ error: 'Internal server error' }, 500);
      }
      return json({ portals: portals || [] });
    }

    // GET /dev/templates — admin-gated template catalog
    if (path === '/dev/templates' && method === 'GET') {
      let profile;
      try {
        const pRes = await admin.from('profiles').select('is_admin').eq('id', user.id).single();
        profile = pRes.data;
        if (pRes.error) throw pRes.error;
      } catch (e) {
        console.error('admin profile check error', e);
        return json({ error: 'Internal server error' }, 500);
      }
      if (!profile || !profile.is_admin) {
        return json({ error: 'Admin access required' }, 403);
      }
      let weapons = [];
      let monsters = [];
      try {
        const wRes = await admin.from('weapon_template').select('id, name').order('id');
        if (wRes.error) throw wRes.error;
        weapons = wRes.data || [];
      } catch (e) {
        console.error('weapon_template query error', e);
        return json({ error: 'Internal server error' }, 500);
      }
      try {
        const mRes = await admin.from('monster_template').select('id, name').order('id');
        if (mRes.error) throw mRes.error;
        monsters = mRes.data || [];
      } catch (e) {
        console.error('monster_template query error', e);
        return json({ error: 'Internal server error' }, 500);
      }
      return json({ weapons, monsters });
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
          .select('attack:attack_id (id, name, is_multi_target, prepare_time, cooldown_time, prepare_time_range, cooldown_time_range)')
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

    // POST /api/combat/dev/grant — admin-gated dev helper: create starter weapon_instance for caller
    if (path === '/dev/grant' && method === 'POST') {
      // Gate exactly like api/admin routes (profiles.is_admin check)
      let profile;
      try {
        const pRes = await admin.from('profiles').select('is_admin').eq('id', user.id).single();
        profile = pRes.data;
        if (pRes.error) throw pRes.error;
      } catch (e) {
        console.error('admin profile check error', e);
        return json({ error: 'Internal server error' }, 500);
      }
      if (!profile || !profile.is_admin) {
        return json({ error: 'Admin access required' }, 403);
      }

      // Rev2: dev-mode unlock only — no weapon creation
      return json({ dev_mode: true });
    }

    // === Shared dev helpers (Rev2) ===
    async function findActiveRun(userId) {
      try {
        const { data: run } = await admin.from('portal_run').select('*').eq('user_id', userId).eq('status', 'active').order('created_at', { ascending: false }).limit(1).single();
        return run || null;
      } catch (_) {
        return null;
      }
    }

    async function createAndEquipWeapon(adminClient, userId, run, templateId, slot = 'LH') {
      // template lookup
      let tmpl;
      try {
        const tRes = await adminClient.from('weapon_template').select('id, name, slot_0_attack_id, base_damage, damage_range, base_speed, speed_range, base_accuracy, accuracy_range').eq('id', templateId).single();
        tmpl = tRes.data;
        if (tRes.error || !tmpl) throw tRes.error || new Error('not found');
      } catch (e) {
        return { error: 'weapon template not found', status: 404 };
      }
      // insert weapon_instance — byte-for-byte grant pattern (slot_0_attack_id NOT NULL)
      let inst;
      try {
        const d = rollStat(tmpl.base_damage, tmpl.damage_range);
        const s = rollStat(tmpl.base_speed, tmpl.speed_range);
        const a = rollStat(tmpl.base_accuracy, tmpl.accuracy_range);
        const zd = tmpl.damage_range ? (d - tmpl.base_damage) / tmpl.damage_range : 0;
        const zs = tmpl.speed_range ? (tmpl.base_speed - s) / tmpl.speed_range : 0;
        const za = tmpl.accuracy_range ? (a - tmpl.base_accuracy) / tmpl.accuracy_range : 0;
        const z = (zd + zs + za) / 3;
        const g = z >= 3 ? 'S' : z >= 2 ? 'A' : z >= 1 ? 'B' : z >= 0 ? 'C' : z >= -1 ? 'D' : z >= -2 ? 'E' : 'F';
        const iRes = await adminClient.from('weapon_instance').insert({
          user_id: userId,
          template_id: tmpl.id,
          slot_0_attack_id: tmpl.slot_0_attack_id,
          damage: d,
          speed: s,
          accuracy: a,
          grade: g
        }).select('id, damage, speed, accuracy, grade').single();
        inst = iRes.data;
        if (iRes.error) throw iRes.error;
      } catch (e) {
        console.error('weapon_instance insert error', e);
        return { error: 'Internal server error', status: 500 };
      }
      // map slot to column
      const col = slot === 'RH' ? 'hand_r_weapon_id' : slot === 'belt' ? 'belt_weapon_id' : 'hand_l_weapon_id';
      // displaced
      const oldId = run[col];
      let displaced = null;
      if (oldId) {
        try {
          const { data: oldInst } = await adminClient.from('weapon_instance').select('id, template_id, weapon_template:template_id (name)').eq('id', oldId).single();
          if (oldInst) displaced = { instance_id: oldInst.id, template_name: oldInst.weapon_template?.name || 'Unknown' };
        } catch (_) {}
      }
      // update run pointer
      try {
        await adminClient.from('portal_run').update({ [col]: inst.id }).eq('id', run.id).eq('user_id', userId);
      } catch (e) {
        console.error('run weapon pointer update error', e);
        return { error: 'Internal server error', status: 500 };
      }
      return {
        slot,
        weapon: { instance_id: inst.id, template_name: tmpl.name, damage: inst.damage, speed: inst.speed, accuracy: inst.accuracy, grade: inst.grade },
        displaced
      };
    }

    // Shared potion-loadout builder: engine-shape potion objects for slots A/B,
    // seeded from the run's consumable instances (PC-39). used mirrors the DB flag.
    async function buildPotionLoadout(run) {
      const ids = [run.consume_a_id, run.consume_b_id].filter(Boolean);
      const map = {};
      if (ids.length) {
        try {
          const { data: rows } = await admin
            .from('consumable_instance')
            .select('id, rolled_floor, rolled_window, rolled_speed, consumable_template:template_id (name, effect_type, duration_ticks)')
            .in('id', ids);
          for (const inst of (rows || [])) {
            map[inst.id] = {
              effect_type: inst.consumable_template?.effect_type || 'heal',
              template_name: inst.consumable_template?.name || 'Potion',
              rolled_floor: inst.rolled_floor,
              rolled_window: inst.rolled_window,
              rolled_speed: inst.rolled_speed,
              duration_ticks: inst.consumable_template?.duration_ticks,
              used: run.consume_a_id === inst.id ? !!run.consume_a_used : !!run.consume_b_used
            };
          }
        } catch (e) {
          console.error('potion loadout fetch error', e);
        }
      }
      return {
        A: run.consume_a_id ? (map[run.consume_a_id] || null) : null,
        B: run.consume_b_id ? (map[run.consume_b_id] || null) : null
      };
    }

    // PC-39 review fix: DB used-flags must mirror engine potion state whenever a
    // battle_state that may have fired an effect is persisted. Without this, an
    // in-battle drink flips used=true inside engine.state but the DB flag stays
    // false, so the state route would show the potion as still drinkable.
    function potionUsedFlags(state) {
      const pots = state && state.potions;
      return {
        consume_a_used: !!(pots && pots.A && pots.A.used),
        consume_b_used: !!(pots && pots.B && pots.B.used)
      };
    }

    async function rebuildBattleState(run, monsters, playerHp) {
      const potionLoadout = await buildPotionLoadout(run);
      const participants = {
        loadout: { hand_l: run.hand_l_weapon_id, hand_r: run.hand_r_weapon_id, consume_a: potionLoadout.A, consume_b: potionLoadout.B },
        monsters
      };
      const freshEngine = createEngine();
      freshEngine.startBattle(participants, null, playerHp);
      const newState = freshEngine.state;
      // persist
      try {
        await admin.from('portal_run').update({ battle_state: newState, player_hp: playerHp }).eq('id', run.id).eq('user_id', run.user_id);
      } catch (e) {
        console.error('rebuildBattleState persist error', e);
        throw e;
      }
      return newState;
    }

    // === New dev routes (all POST, admin-gated) ===
    const isDevPath = (p) => p.startsWith('/dev/');

    if (isDevPath(path) && method === 'POST') {
      // admin gate (reuse grant pattern)
      let profile;
      try {
        const pRes = await admin.from('profiles').select('is_admin').eq('id', user.id).single();
        profile = pRes.data;
        if (pRes.error) throw pRes.error;
      } catch (e) {
        console.error('admin profile check error', e);
        return json({ error: 'Internal server error' }, 500);
      }
      if (!profile || !profile.is_admin) {
        return json({ error: 'Admin access required' }, 403);
      }

      // 1. POST /dev/equip
      if (path === '/dev/equip') {
        const body = await request.json().catch(() => ({}));
        let slot = body.slot;
        const run = await findActiveRun(user.id);
        if (!run) return json({ error: 'start a run first' }, 400);
        // default slot: first empty LH->RH->belt else LH
        if (!slot) {
          if (!run.hand_l_weapon_id) slot = 'LH';
          else if (!run.hand_r_weapon_id) slot = 'RH';
          else if (!run.belt_weapon_id) slot = 'belt';
          else slot = 'LH';
        }
        if (!['LH','RH','belt'].includes(slot)) slot = 'LH';
        // random template
        let templates;
        try {
          const tRes = await admin.from('weapon_template').select('id, name, slot_0_attack_id');
          templates = tRes.data || [];
        } catch (_) { templates = []; }
        if (!templates.length) return json({ error: 'no weapon templates' }, 404);
        const pick = templates[Math.floor(Math.random() * templates.length)];
        const res = await createAndEquipWeapon(admin, user.id, run, pick.id, slot);
        if (res.error) return json({ error: res.error }, res.status || 400);
        return json(res);
      }

      // 2. POST /dev/roll-weapon
      if (path === '/dev/roll-weapon') {
        const body = await request.json().catch(() => ({}));
        const templateId = parseInt(body.template_id, 10);
        let slot = body.slot || 'LH';
        if (isNaN(templateId) || templateId <= 0) return json({ error: 'Invalid template_id' }, 400);
        if (!['LH','RH','belt'].includes(slot)) slot = 'LH';
        const run = await findActiveRun(user.id);
        if (!run) return json({ error: 'start a run first' }, 400);
        const res = await createAndEquipWeapon(admin, user.id, run, templateId, slot);
        if (res.error) return json({ error: res.error }, res.status || 400);
        return json(res);
      }

      // 2b. POST /dev/roll-consumable (mirror roll-weapon pattern exactly; slot A/B, single-arg RPC, effect_label "X+, up to Y")
      if (path === '/dev/roll-consumable') {
        const body = await request.json().catch(() => ({}));
        const templateId = parseInt(body.template_id, 10);
        let slot = body.slot || 'A';
        if (isNaN(templateId) || templateId <= 0) return json({ error: 'Invalid template_id' }, 400);
        if (!['A','B'].includes(slot)) slot = 'A';
        const run = await findActiveRun(user.id);
        if (!run) return json({ error: 'start a run first' }, 400);
        let instanceId;
        try {
          const rpcRes = await admin.rpc('generate_consumable_instance', { p_template_id: templateId });
          if (rpcRes.error) throw rpcRes.error;
          instanceId = rpcRes.data;
        } catch (e) {
          console.error('generate_consumable_instance error', e);
          return json({ error: 'Failed to generate consumable' }, 500);
        }
        if (!instanceId) return json({ error: 'generation returned no id' }, 500);
        const col = slot === 'B' ? 'consume_b_id' : 'consume_a_id';
        const { error: updErr } = await admin.from('portal_run').update({ [col]: instanceId }).eq('id', run.id);
        if (updErr) return json({ error: 'Failed to assign consumable to run' }, 500);
        // fetch joined row for response shape
        const { data: inst } = await admin
          .from('consumable_instance')
          .select('id, rolled_floor, rolled_window, grade, consumable_template:template_id (name, effect_type)')
          .eq('id', instanceId)
          .maybeSingle();
        const effectLabel = inst ? `${inst.rolled_floor}+, up to ${inst.rolled_floor + (inst.rolled_window || 0)}` : '';
        const consumable = inst ? {
          instance_id: inst.id,
          template_name: inst.consumable_template?.name || 'Unknown',
          effect_type: inst.consumable_template?.effect_type || 'heal',
          effect_label: effectLabel,
          grade: inst.grade
        } : null;
        return json({ slot, consumable });
      }

      // 3. POST /dev/equip-instance
      if (path === '/dev/equip-instance') {
        const body = await request.json().catch(() => ({}));
        const instance_id = parseInt(body.instance_id, 10);
        let slot = body.slot;
        if (isNaN(instance_id) || instance_id <= 0) return json({ error: 'Invalid instance_id' }, 400);
        const run = await findActiveRun(user.id);
        if (!run) return json({ error: 'start a run first' }, 400);
        if (!slot) {
          if (!run.hand_l_weapon_id) slot = 'LH';
          else if (!run.hand_r_weapon_id) slot = 'RH';
          else if (!run.belt_weapon_id) slot = 'belt';
          else slot = 'LH';
        }
        if (!['LH','RH','belt'].includes(slot)) slot = 'LH';
        // ownership check (fail-closed, mirror PC-21 R7/F7)
        let inst;
        try {
          const iRes = await admin.from('weapon_instance').select('id, damage, template_id, weapon_template:template_id (name)').eq('id', instance_id).eq('user_id', user.id).maybeSingle();
          inst = iRes.data;
          if (iRes.error) throw iRes.error;
        } catch (e) {
          console.error('weapon_instance ownership query error', e);
          return json({ error: 'Internal server error' }, 500);
        }
        if (!inst) return json({ error: 'weapon not found in your inventory' }, 404);
        // already equipped check
        const equippedSlot = run.hand_l_weapon_id === instance_id ? 'LH' : run.hand_r_weapon_id === instance_id ? 'RH' : run.belt_weapon_id === instance_id ? 'belt' : null;
        if (equippedSlot) return json({ error: `weapon #${instance_id} already equipped in ${equippedSlot}` }, 400);
        const col = slot === 'RH' ? 'hand_r_weapon_id' : slot === 'belt' ? 'belt_weapon_id' : 'hand_l_weapon_id';
        const oldId = run[col];
        let displaced = null;
        if (oldId && oldId !== instance_id) {
          try {
            const { data: oldInst } = await admin.from('weapon_instance').select('id, template_id, weapon_template:template_id (name)').eq('id', oldId).maybeSingle();
            if (oldInst) displaced = { instance_id: oldInst.id, template_name: oldInst.weapon_template?.name || 'Unknown' };
          } catch (_) {}
        }
        try {
          await admin.from('portal_run').update({ [col]: instance_id }).eq('id', run.id).eq('user_id', user.id);
        } catch (e) {
          console.error('run weapon pointer update error', e);
          return json({ error: 'Internal server error' }, 500);
        }
        return json({
          slot,
          weapon: { instance_id: inst.id, template_name: inst.weapon_template?.name || 'Unknown', damage: inst.damage },
          displaced
        });
      }
      // 4. POST /dev/roll-monster
      if (path === '/dev/roll-monster') {
        const body = await request.json().catch(() => ({}));
        const templateId = parseInt(body.template_id, 10);
        if (isNaN(templateId) || templateId <= 0) return json({ error: 'Invalid template_id' }, 400);
        const run = await findActiveRun(user.id);
        if (!run) return json({ error: 'start a run first' }, 400);
        if (!run.battle_state || Object.keys(run.battle_state).length === 0) return json({ error: 'start a battle first' }, 400);
        const live = (run.battle_state.monsters || []).filter(m => (m.current_hp || 0) > 0);
        const usedLabels = live.map(m => m.label);
        const m = await generateOneMonster(templateId, usedLabels);
        if (m.error) return json({ error: m.error }, m.status || 400);
        const eng = resumeEngine(run.battle_state, Math.random);
        const playerHp = eng && eng.state.player ? eng.state.player.hp : run.player_hp;
        try {
          const s = await rebuildBattleState(run, [...live, m], playerHp);
          return json({ monster: m, battle_state: s });
        } catch (_) {
          return json({ error: 'Internal server error' }, 500);
        }
      }

      // 5. POST /dev/del-monster
      if (path === '/dev/del-monster') {
        const body = await request.json().catch(() => ({}));
        const target = (body.target || '').trim();
        const run = await findActiveRun(user.id);
        if (!run) return json({ error: 'start a run first' }, 400);
        if (!run.battle_state) return json({ error: 'no battle state' }, 400);
        const live = run.battle_state.monsters || [];
        let foundIdx = -1;
        let removed = null;
        for (let i = 0; i < live.length; i++) {
          const m = live[i];
          if (m.label === target || m.label === `Monster ${target}` || String(m.id) === target) {
            foundIdx = i; removed = { label: m.label, id: m.id }; break;
          }
        }
        if (foundIdx === -1) return json({ error: 'no such monster' }, 404);
        const remaining = live.filter((_, i) => i !== foundIdx);
        const eng = resumeEngine(run.battle_state, Math.random);
        const playerHp = eng && eng.state.player ? eng.state.player.hp : run.player_hp;
        try {
          const s = await rebuildBattleState(run, remaining, playerHp);
          return json({ removed, battle_state: s });
        } catch (_) {
          return json({ error: 'Internal server error' }, 500);
        }
      }

      // 6. POST /dev/set-hp
      if (path === '/dev/set-hp') {
        const body = await request.json().catch(() => ({}));
        const target = body.target;
        const hp = parseInt(body.hp, 10);
        if (isNaN(hp) || hp < 0) return json({ error: 'Invalid hp' }, 400);
        const run = await findActiveRun(user.id);
        if (!run) return json({ error: 'start a run first' }, 400);
        const bs = run.battle_state || {};
        if (target === 'player') {
          bs.player = bs.player || {};
          bs.player.hp = hp;
          await admin.from('portal_run').update({ battle_state: bs, player_hp: hp }).eq('id', run.id).eq('user_id', user.id);
          return json({ target: 'player', hp });
        } else {
          const mons = bs.monsters || [];
          let found = false;
          for (const m of mons) {
            if (m.label === target || m.label === `Monster ${target}` || String(m.id) === target) {
              m.current_hp = Math.min(hp, m.max_hp || hp);
              found = true; break;
            }
          }
          if (!found) return json({ error: 'no such monster' }, 404);
          await admin.from('portal_run').update({ battle_state: bs }).eq('id', run.id).eq('user_id', user.id);
          return json({ target, hp });
        }
      }

      // 7. POST /dev/win-battle
      if (path === '/dev/win-battle') {
        const run = await findActiveRun(user.id);
        if (!run) return json({ error: 'start a run first' }, 400);
        const bs = run.battle_state || {};
        if (bs.monsters) {
          bs.monsters.forEach(m => { m.current_hp = 0; });
        }
        // also clear any queue rows for monsters to satisfy isBattleOver / monsters_dead
        if (bs.queue) {
          bs.queue = bs.queue.filter(r => !r.label || r.label.startsWith('LH') || r.label.startsWith('RH'));
        }
        await admin.from('portal_run').update({ battle_state: bs }).eq('id', run.id).eq('user_id', user.id);
        return json({ monsters_dead: true });
      }

      // 8. POST /dev/kill-player
      if (path === '/dev/kill-player') {
        const run = await findActiveRun(user.id);
        if (!run) return json({ error: 'start a run first' }, 400);
        const bs = run.battle_state || {};
        bs.player = bs.player || {};
        bs.player.hp = 0;
        await admin.from('portal_run').update({ battle_state: bs, player_hp: 0 }).eq('id', run.id).eq('user_id', user.id);
        // check via resumeEngine pattern
        let player_dead = true;
        let status = 'dead';
        try {
          const api = resumeEngine(bs, Math.random);
          const st = api.getState();
          if (!st.player_dead) player_dead = false;
        } catch (_) {}
        if (player_dead) {
          await admin.from('portal_run').update({ status: 'dead' }).eq('id', run.id).eq('user_id', user.id);
        }
        return json({ player_dead, status: player_dead ? 'dead' : 'active' });
      }

      // 9. POST /dev/nuke-monsters
      if (path === '/dev/nuke-monsters') {
        const run = await findActiveRun(user.id);
        if (!run) return json({ error: 'start a run first' }, 400);
        const bs = run.battle_state || {};
        const removed = (bs.monsters || []).length;
        bs.monsters = [];
        if (bs.queue) {
          bs.queue = bs.queue.filter(r => !r.label || r.label.startsWith('LH') || r.label.startsWith('RH'));
        }
        await admin.from('portal_run').update({ battle_state: bs }).eq('id', run.id).eq('user_id', user.id);
        return json({ removed });
      }

      // 10. POST /dev/abandon-run
      if (path === '/dev/abandon-run') {
        const run = await findActiveRun(user.id);
        if (!run) return json({ error: 'start a run first' }, 400);
        await admin.from('portal_run').update({ status: 'abandoned' }).eq('id', run.id).eq('user_id', user.id);
        return json({ run_id: run.id });
      }

      return json({ error: 'unknown dev command' }, 404);
    }

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
export async function DELETE(request) { return handle(request); }