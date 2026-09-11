/**
 * /api/combat/[...path].js
 * ========================
 * Vercel serverless catch-all for combat engine routes.
 * Mirrors api/admin conventions exactly (CORS, json(), getAdminClient, JWT).
 * Enforces uid == run.user_id (RLS backup). Service-role for portal_run + generate_monster.
 * IDOR closed: all UPDATEs chain .eq('user_id', user.id); all path ids NaN-guarded; non-active rejected.
 */

import { createClient } from '@supabase/supabase-js';
import { createEngine, resumeEngine } from '../../js/combat/engine.js';
import { getHpWord } from '../../js/combat/hp-words.js';

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
    // POST /api/combat/runs  {portal_template_id, hand_l_weapon_id, hand_r_weapon_id, belt_weapon_id}
    if (path === '/runs' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { portal_template_id, hand_l_weapon_id, hand_r_weapon_id, belt_weapon_id } = body;
      // R8: integer validation for portal_template_id (same pattern as weapon ids)
      const portalTemplateIdNum = parseInt(portal_template_id, 10);
      if (isNaN(portalTemplateIdNum) || portalTemplateIdNum <= 0) return json({ error: 'Invalid portal_template_id' }, 400);

      // F13: TOCTOU race on 3-active cap accepted for MVP; future fix: partial unique index or RPC atomic check
      const { count } = await admin.from('portal_run').select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('status', 'active');
      if ((count || 0) >= 3) return json({ error: 'Max 3 active runs' }, 400);

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

      const { data: tmpl } = await admin.from('portal_template').select('fights').eq('id', portalTemplateIdNum).single();
      if (!tmpl) return json({ error: 'Portal template not found' }, 404);

      const { data: run, error } = await admin.from('portal_run').insert({
        user_id: user.id,
        portal_template_id: portalTemplateIdNum,
        hand_l_weapon_id: handL,
        hand_r_weapon_id: handR,
        belt_weapon_id: beltW,
        status: 'active',
        current_battle: 1,
        total_battles: tmpl.fights || 5,
        player_hp: 1000,
        battle_state: {}
      }).select().single();
      // R6: generic error, log real
      if (error) {
        console.error('run insert error', error);
        return json({ error: 'Internal server error' }, 500);
      }
      return json({ run });
    }

    // GET /api/combat/runs/:id
    if (path.startsWith('/runs/') && !path.includes('/battle') && method === 'GET') {
      const idStr = path.split('/')[2];
      const id = parseInt(idStr, 10);
      if (isNaN(id)) return json({ error: 'Invalid run id' }, 400);
      const { data: run } = await admin.from('portal_run').select('*').eq('id', id).eq('user_id', user.id).single();
      if (!run) return json({ error: 'Not found or not owner' }, 404);
      const state = run.battle_state || {};

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
            cooldown_time: a.cooldown_time || 2
          }));
        return {
          id: m.id,
          label: m.label,
          template_id: m.template_id,
          name: templateNames[m.template_id] || m.template_name || m.label || 'Monster',
          hp_word: getHpWord(m.current_hp, m.max_hp),
          damage: m.damage,
          speed: m.speed,
          accuracy: m.accuracy,
          attacks
        };
      });

      // --- equipped weapons: instance stats + template name + granted attacks (same join as /weapons) ---
      const weaponIds = [run.hand_l_weapon_id, run.hand_r_weapon_id].filter(Boolean);
      let weaponRows = [];
      if (weaponIds.length) {
        const res = await admin.from('weapon_instance')
          .select('id, damage, speed, accuracy, template_id, weapon_template:template_id (name)')
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
            .select('attack:attack_id (id, name, is_multi_target, prepare_time, cooldown_time)')
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
          attacks: attacks.map(a => ({
            id: a.id,
            name: a.name,
            is_multi_target: !!a.is_multi_target,
            prepare_time: a.prepare_time || 3,
            cooldown_time: a.cooldown_time || 2
          }))
        };
      }
      const [handL, handR] = await Promise.all([weaponInfo(run.hand_l_weapon_id), weaponInfo(run.hand_r_weapon_id)]);

      const safeState = {
        queue: state.queue || [],
        player: state.player ? { hp: state.player.hp, hands: state.player.hands } : null,
        feed: state.feed || [],
        tic: state.tic || 0,
        buffs: state.buffs || [],
        weapons: { hand_l: handL, hand_r: handR },
        monsters
      };
      return json({ run: { ...run, battle_state: safeState } });
    }

    // POST /api/combat/runs/:id/battle/start
    if (path.includes('/battle/start') && method === 'POST') {
      const idStr = path.split('/')[2];
      const id = parseInt(idStr, 10);
      if (isNaN(id)) return json({ error: 'Invalid run id' }, 400);
      const { data: run } = await admin.from('portal_run').select('*').eq('id', id).eq('user_id', user.id).single();
      if (!run) return json({ error: 'Run not found' }, 404);
      if (run.status !== 'active') return json({ error: 'Run not active' }, 400);

      // F3: gate against re-start mid-battle (live queue or monsters in battle_state)
      if (run.battle_state && (run.battle_state.queue?.length > 0 || run.battle_state.monsters?.length > 0)) {
        return json({ error: 'Battle already in progress' }, 400);
      }

      // F9: monster inserts bounded by F3 gate (no mid-battle restart) + F4 monsters_dead gate
      const { data: templates } = await admin.from('monster_template').select('id').order('id', { ascending: true }).limit(2);
      const monsters = [];
      for (const t of (templates || [])) {
        const { data: gen } = await admin.rpc('generate_monster', { p_template_id: t.id });
        if (gen) {
          monsters.push({ ...gen, label: `Monster ${String.fromCharCode(65 + monsters.length)}` });
        }
      }
      if (monsters.length === 0) {
        monsters.push({ id: 1, max_hp: 80, damage: 10, speed: 6, accuracy: 70, label: 'Monster A' });
        monsters.push({ id: 2, max_hp: 90, damage: 12, speed: 5, accuracy: 65, label: 'Monster B' });
      }

      const participants = {
        loadout: { hand_l: run.hand_l_weapon_id, hand_r: run.hand_r_weapon_id },
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
      if (!Array.isArray(target_ids) || target_ids.length > 10 || target_ids.some(tid => !Number.isInteger(Number(tid)) || Number(tid) <= 0)) {
        return json({ error: 'Invalid target_ids' }, 400);
      }
      const attackIdNum = parseInt(attack_id, 10);
      if (isNaN(attackIdNum) || attackIdNum <= 0) return json({ error: 'Invalid attack_id' }, 400);

      // Fetch attack early to know isMultiTarget for R2 single-target restriction
      const { data: attackRow } = await admin.from('attack')
        .select('prepare_time, cooldown_time, is_multi_target, base_damage_multiplier')
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
      if (target_ids.length > 0 && !target_ids.every(tid => liveMonsterIds.includes(Number(tid)))) {
        return json({ error: 'Invalid target monster' }, 400);
      }

      // R2: single-target attacks restricted to first target only (prevents cleave exploit)
      let effectiveTargetIds = target_ids;
      if (!isMultiTarget && target_ids.length > 1) {
        effectiveTargetIds = target_ids.slice(0, 1);
      }

      const weaponId = hand === 'LH' ? run.hand_l_weapon_id : run.hand_r_weapon_id;
      if (!weaponId) return json({ error: 'No weapon equipped for hand' }, 400);

      const { data: wInst } = await admin.from('weapon_instance').select('template_id').eq('id', weaponId).single();
      if (!wInst) return json({ error: 'Weapon instance not found' }, 404);
      const { count: mapCount } = await admin.from('weapon_template_attack_mapping')
        .select('*', { count: 'exact', head: true })
        .eq('weapon_template_id', wInst.template_id).eq('attack_id', attackIdNum);
      if (!mapCount) return json({ error: 'Attack not on equipped weapon' }, 403);

      // F14: clamp prepare/cooldown to >=1
      const castTicks = Math.max(1, Number(attackRow?.prepare_time) || 3);
      const cooldownTicks = Math.max(1, Number(attackRow?.cooldown_time) || 2);
      const multiplier = attackRow?.base_damage_multiplier || 0;

      const { data: weapon } = await admin.from('weapon_instance').select('damage').eq('id', weaponId).single();
      const playerDamage = Math.round((weapon?.damage || 10) * (1 + multiplier));

      let engine;
      if (persisted && Array.isArray(persisted.queue) && (persisted.queue.length > 0 || (persisted.monsters && persisted.monsters.length > 0))) {
        engine = resumeEngine(persisted, Math.random);
      } else {
        engine = createEngine();
      }

      // F11: advance-when-busy instead of 500 on unready hand
      let advanced = false;
      try {
        engine.commitAttack(hand, attackIdNum, effectiveTargetIds.map(Number), { castTicks, cooldownTicks, playerDamage, isMultiTarget });
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
        .update({ battle_state: engine.state, player_hp: engine.state.player ? engine.state.player.hp : run.player_hp })
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
          const participants = {
            loadout: { hand_l: run.hand_l_weapon_id, hand_r: run.hand_r_weapon_id },
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

    // GET /api/combat/weapons — caller's owned weapons + template attacks (for gear command)
    if (path === '/weapons' && method === 'GET') {
      let instances;
      try {
        const res = await admin.from('weapon_instance')
          .select('id, damage, template_id, weapon_template:template_id (name)')
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
            .select('attack:attack_id (id, name, is_multi_target, prepare_time, cooldown_time)')
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
          attacks: attacks.map(a => ({
            id: a.id,
            name: a.name,
            is_multi_target: !!a.is_multi_target,
            prepare_time: a.prepare_time || 3,
            cooldown_time: a.cooldown_time || 2
          }))
        });
      }
      return json({ weapons });
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

      // pick first existing weapon_template
      let tmpl;
      try {
        const tRes = await admin.from('weapon_template').select('id, name, slot_0_attack_id').order('id', { ascending: true }).limit(1).single();
        tmpl = tRes.data;
        if (tRes.error || !tmpl) throw tRes.error || new Error('no templates');
      } catch (e) {
        console.error('weapon_template query error', e);
        return json({ error: 'No weapon templates found' }, 404);
      }

      // create weapon_instance with sane deterministic damage (constant 15 as example 12-18 range)
      // slot_0_attack_id is NOT NULL (no default) since migration 20260905040000 —
      // materialize the template's slot-0 attack on the instance, like weapon generation does.
      const damage = 15;
      let inst;
      try {
        const iRes = await admin.from('weapon_instance').insert({
          user_id: user.id,
          template_id: tmpl.id,
          slot_0_attack_id: tmpl.slot_0_attack_id,
          damage,
          speed: 6,
          accuracy: 70
        }).select('id').single();
        inst = iRes.data;
        if (iRes.error) throw iRes.error;
      } catch (e) {
        console.error('weapon_instance grant insert error', e);
        return json({ error: 'Internal server error' }, 500);
      }
      return json({ weapon_instance_id: inst.id, template_name: tmpl.name, damage });
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
