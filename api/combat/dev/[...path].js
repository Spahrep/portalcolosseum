/**
 * /api/combat/dev/[...path].js
 * Admin-only /dev/* routes moved out of the player combat catch-all.
 *
 * vercel.json rewrites every /api/combat/* request to api/combat/[...path].js,
 * so production (and the node:test suite) enters through that handle(), which
 * dispatches path.startsWith('/dev/') to handleCombatDev. Named HTTP exports
 * are the same handler if this file is invoked directly.
 * Auth: verifyUser on every request, then the same profiles.is_admin gate
 * each route already had. No route is open.
 */
import { createEngine, resumeEngine } from '../../../js/combat/engine.js';
import {
  generateOneMonster as generateOneMonsterShared,
  findActiveRun as findActiveRunShared,
  handApproachSpeeds as handApproachSpeedsShared,
  buildPotionLoadout as buildPotionLoadoutShared,
  startingHp,
} from '../../../lib/combat-run.js';
import { json as httpJson, CORS, verifyUser, verifyAdmin } from '../../../lib/combat-http.js';

export async function handleCombatDev({ request, path, method, admin, user, json }) {
  async function generateOneMonster(templateId, usedLabels) {
    return generateOneMonsterShared(admin, templateId, usedLabels);
  }
  async function findActiveRun(userId) {
    return findActiveRunShared(admin, userId);
  }
  async function handApproachSpeeds(handL, handR) {
    return handApproachSpeedsShared(admin, handL, handR);
  }
  async function buildPotionLoadout(run) {
    return buildPotionLoadoutShared(admin, run);
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
      // Persist via generate_weapon so special attack slots are rolled, not just slot_0.
      let inst;
      try {
        const rpcRes = await adminClient.rpc('generate_weapon', { p_template_id: tmpl.id, p_user_id: userId });
        if (rpcRes.error) throw rpcRes.error;
        inst = rpcRes.data;
        if (!inst || !inst.id) throw new Error('generate_weapon returned no id');
      } catch (e) {
        console.error('generate_weapon error', e);
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

    async function rebuildBattleState(run, monsters, playerHp) {
      const potionLoadout = await buildPotionLoadout(run);
      const handSpeeds = await handApproachSpeeds(run.hand_l_weapon_id, run.hand_r_weapon_id);
      const participants = {
        loadout: { hand_l: run.hand_l_weapon_id, hand_r: run.hand_r_weapon_id, ...handSpeeds, consume_a: potionLoadout.A, consume_b: potionLoadout.B },
        monsters
      };
      const freshEngine = createEngine();
      freshEngine.startBattle(participants, null, playerHp, await startingHp(admin));
      const newState = freshEngine.getPersistedState();
      // persist
      try {
        await admin.from('portal_run').update({ battle_state: newState, player_hp: playerHp }).eq('id', run.id).eq('user_id', run.user_id);
      } catch (e) {
        console.error('rebuildBattleState persist error', e);
        throw e;
      }
      return newState;
    }

    // GET /dev/users — admin-gated list of accounts for targeting (PC-68)
    if (path === '/dev/users' && method === 'GET') {
      const adminGate = await verifyAdmin(admin, user);
      if (adminGate.error) return json({ error: adminGate.error }, adminGate.status);
      let users;
      try {
        const uRes = await admin.from('profiles').select('id, username, is_admin').order('username');
        users = uRes.data || [];
      } catch (e) {
        console.error('profiles query error', e);
        return json({ error: 'Internal server error' }, 500);
      }
      return json({ users });
    }

    // GET /dev/templates — admin-gated template catalog
    if (path === '/dev/templates' && method === 'GET') {
      const adminGate = await verifyAdmin(admin, user);
      if (adminGate.error) return json({ error: adminGate.error }, adminGate.status);
      let weapons = [];
      let monsters = [];
      let consumables = [];
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
      try {
        const cRes = await admin.from('consumable_template').select('id, name, effect_type').order('id');
        if (cRes.error) throw cRes.error;
        consumables = cRes.data || [];
      } catch (e) {
        console.error('consumable_template query error', e);
        return json({ error: 'Internal server error' }, 500);
      }
      return json({ weapons, monsters, consumables });
    }

    // POST /api/combat/dev/grant — admin-gated dev helper: create starter weapon_instance for caller
    if (path === '/dev/grant' && method === 'POST') {
      // Gate exactly like api/admin routes (profiles.is_admin check)
      const adminGate = await verifyAdmin(admin, user);
      if (adminGate.error) return json({ error: adminGate.error }, adminGate.status);

      // Rev2: dev-mode unlock only — no weapon creation
      return json({ dev_mode: true });
    }

    // === New dev routes (all POST, admin-gated) ===
    const isDevPath = (p) => p.startsWith('/dev/');

    if (isDevPath(path) && method === 'POST') {
      // admin gate (reuse grant pattern)
      const adminGate = await verifyAdmin(admin, user);
      if (adminGate.error) return json({ error: adminGate.error }, adminGate.status);

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
        const snap = eng.getPersistedState();
        const playerHp = snap && snap.player ? snap.player.hp : run.player_hp;
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
        const snap = eng.getPersistedState();
        const playerHp = snap && snap.player ? snap.player.hp : run.player_hp;
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

      // 11. POST /dev/give-weapon (PC-68) — grant rolled weapon_instance(s) to target user (inventory only, no run/equip)
      if (path === '/dev/give-weapon') {
        const body = await request.json().catch(() => ({}));
        const username = (body.username || '').trim();
        const templateId = parseInt(body.template_id, 10);
        let count = parseInt(body.count, 10);
        if (!username) return json({ error: 'Invalid username' }, 400);
        if (isNaN(templateId) || templateId <= 0) return json({ error: 'Invalid template_id' }, 400);
        if (isNaN(count) || count < 1) count = 1;
        count = Math.min(count, 25);
        // resolve target user
        let target;
        try {
          const uRes = await admin.from('profiles').select('id').eq('username', username).single();
          target = uRes.data;
          if (uRes.error || !target) throw uRes.error || new Error('not found');
        } catch (e) {
          return json({ error: 'user not found' }, 404);
        }
        // template lookup (404 + name); stats and special slots come from generate_weapon
        let tmpl;
        try {
          const tRes = await admin.from('weapon_template').select('id, name, slot_0_attack_id, base_damage, damage_range, base_speed, speed_range, base_accuracy, accuracy_range').eq('id', templateId).single();
          tmpl = tRes.data;
          if (tRes.error || !tmpl) throw tRes.error || new Error('not found');
        } catch (e) {
          return json({ error: 'weapon template not found' }, 404);
        }
        const granted = [];
        for (let i = 0; i < count; i++) {
          try {
            const rpcRes = await admin.rpc('generate_weapon', { p_template_id: tmpl.id, p_user_id: target.id });
            if (rpcRes.error) throw rpcRes.error;
            const inst = rpcRes.data;
            if (!inst || !inst.id) throw new Error('generate_weapon returned no id');
            granted.push({ instance_id: inst.id, damage: inst.damage, speed: inst.speed, accuracy: inst.accuracy, grade: inst.grade });
          } catch (e) {
            console.error('generate_weapon error', e);
            return json({ error: 'Internal server error' }, 500);
          }
        }
        return json({ username, template_id: templateId, template_name: tmpl.name, granted });
      }

      // 12. POST /dev/give-starter (PC-68) — idempotent grant of SSS starter to target
      if (path === '/dev/give-starter') {
        const body = await request.json().catch(() => ({}));
        const username = (body.username || '').trim();
        if (!username) return json({ error: 'Invalid username' }, 400);
        // resolve target
        let target;
        try {
          const uRes = await admin.from('profiles').select('id').eq('username', username).single();
          target = uRes.data;
          if (uRes.error || !target) throw uRes.error || new Error('not found');
        } catch (e) {
          return json({ error: 'user not found' }, 404);
        }
        // find SSS template
        let tmpl;
        try {
          const tRes = await admin.from('weapon_template').select('id, name, slot_0_attack_id, base_damage, damage_range, base_speed, speed_range, base_accuracy, accuracy_range').eq('name', 'SSS').limit(1).single();
          tmpl = tRes.data;
          if (tRes.error || !tmpl) throw tRes.error || new Error('not found');
        } catch (e) {
          return json({ error: 'starter template not found' }, 404);
        }
        // idempotent guard
        try {
          const existRes = await admin.from('weapon_instance').select('id').eq('user_id', target.id).eq('template_id', tmpl.id).limit(1).maybeSingle();
          if (existRes.data) {
            return json({ granted: false, reason: 'already has starter', instance_id: existRes.data.id });
          }
        } catch (e) {
          console.error('starter check error', e);
          return json({ error: 'Internal server error' }, 500);
        }
        // persist via generate_weapon so special attack slots are rolled
        try {
          const rpcRes = await admin.rpc('generate_weapon', { p_template_id: tmpl.id, p_user_id: target.id });
          if (rpcRes.error) throw rpcRes.error;
          const inst = rpcRes.data;
          if (!inst || !inst.id) throw new Error('generate_weapon returned no id');
          return json({ granted: true, instance: { instance_id: inst.id, damage: inst.damage, speed: inst.speed, accuracy: inst.accuracy, grade: inst.grade } });
        } catch (e) {
          console.error('generate_weapon error', e);
          return json({ error: 'Internal server error' }, 500);
        }
      }

      // 13. POST /dev/set-weapon-stats (PC-69, ported from wt/pc-69 0ddc83e + PC-72 crit) — overwrite stats on any existing weapon_instance, recompute grade
      if (path === '/dev/set-weapon-stats') {
        const body = await request.json().catch(() => ({}));
        const instance_id = parseInt(body.instance_id, 10);
        const damage = body.damage !== undefined ? parseInt(body.damage, 10) : undefined;
        const speed = body.speed !== undefined ? parseInt(body.speed, 10) : undefined;
        const accuracy = body.accuracy !== undefined ? parseInt(body.accuracy, 10) : undefined;
        const crit = body.crit !== undefined ? parseInt(body.crit, 10) : undefined;
        if (isNaN(instance_id) || instance_id <= 0) return json({ error: 'Invalid instance_id' }, 400);
        const provided = [damage, speed, accuracy, crit].filter(v => v !== undefined);
        if (provided.length === 0 || provided.some(v => isNaN(v)) || [damage, speed, accuracy].some(v => v !== undefined && v < 1) || (crit !== undefined && crit < 0)) {
          return json({ error: 'Provide at least one stat (damage/speed/accuracy/crit); damage/speed/accuracy >= 1, crit >= 0' }, 400);
        }
        // fetch instance + template (spec: select('*'))
        let inst, tmpl;
        try {
          const iRes = await admin.from('weapon_instance').select('*').eq('id', instance_id).single();
          inst = iRes.data;
          if (iRes.error || !inst) throw iRes.error || new Error('not found');
          const tRes = await admin.from('weapon_template').select('id, name, base_damage, damage_range, base_speed, speed_range, base_accuracy, accuracy_range').eq('id', inst.template_id).single();
          tmpl = tRes.data;
          if (tRes.error || !tmpl) throw tRes.error || new Error('template not found');
        } catch (e) {
          return json({ error: 'weapon instance not found' }, 404);
        }
        // merge provided stats over current
        const update = {};
        let d = inst.damage, s = inst.speed, a = inst.accuracy, c = inst.crit_chance;
        if (damage !== undefined) { update.damage = damage; d = damage; }
        if (speed !== undefined) { update.speed = speed; s = speed; }
        if (accuracy !== undefined) { update.accuracy = accuracy; a = accuracy; }
        // PC-72: optional crit param writes crit_chance; crit is NOT part of the
        // grade formula this pass — setting crit must NOT change grade.
        if (crit !== undefined) { update.crit_chance = crit; c = crit; }
        // recompute grade exactly as in give-weapon (zs inverted for speed)
        const zd = tmpl.damage_range ? (d - tmpl.base_damage) / tmpl.damage_range : 0;
        const zs = tmpl.speed_range ? (tmpl.base_speed - s) / tmpl.speed_range : 0;
        const za = tmpl.accuracy_range ? (a - tmpl.base_accuracy) / tmpl.accuracy_range : 0;
        const z = (zd + zs + za) / 3;
        const grade = z >= 3 ? 'S' : z >= 2 ? 'A' : z >= 1 ? 'B' : z >= 0 ? 'C' : z >= -1 ? 'D' : z >= -2 ? 'E' : 'F';
        update.grade = grade;
        try {
          await admin.from('weapon_instance').update(update).eq('id', instance_id);
        } catch (e) {
          console.error('set-weapon-stats update error', e);
          return json({ error: 'Internal server error' }, 500);
        }
        return json({ instance_id, template_name: tmpl.name, damage: d, speed: s, accuracy: a, crit_chance: c, grade });
      }

      // 14. POST /dev/set-consumable-stats (PC-69, ported from wt/pc-69 0ddc83e + PC-72 crit) — overwrite stats on any existing consumable_instance, recompute grade
      if (path === '/dev/set-consumable-stats') {
        const body = await request.json().catch(() => ({}));
        const instance_id = parseInt(body.instance_id, 10);
        const floor = body.floor !== undefined ? parseInt(body.floor, 10) : undefined;
        const window = body.window !== undefined ? parseInt(body.window, 10) : undefined;
        const speed = body.speed !== undefined ? parseInt(body.speed, 10) : undefined;
        const crit = body.crit !== undefined ? parseInt(body.crit, 10) : undefined;
        if (isNaN(instance_id) || instance_id <= 0) return json({ error: 'Invalid instance_id' }, 400);
        const provided = [floor, window, speed, crit].filter(v => v !== undefined);
        if (provided.length === 0 || provided.some(v => isNaN(v)) || [floor, window, speed].some(v => v !== undefined && v < 1) || (crit !== undefined && crit < 0)) {
          return json({ error: 'Provide at least one stat (floor/window/speed/crit); floor/window/speed >= 1, crit >= 0' }, 400);
        }
        let inst, tmpl;
        try {
          const iRes = await admin.from('consumable_instance').select('id, template_id, user_id, rolled_floor, rolled_window, rolled_speed, crit_chance').eq('id', instance_id).single();
          inst = iRes.data;
          if (iRes.error || !inst) throw iRes.error || new Error('not found');
          const tRes = await admin.from('consumable_template').select('id, name, floor_base, floor_delta, window_base, window_delta, speed_base, speed_delta').eq('id', inst.template_id).single();
          tmpl = tRes.data;
          if (tRes.error || !tmpl) throw tRes.error || new Error('template not found');
        } catch (e) {
          return json({ error: 'consumable instance not found' }, 404);
        }
        const update = {};
        let f = inst.rolled_floor, w = inst.rolled_window, sp = inst.rolled_speed, c = inst.crit_chance;
        if (floor !== undefined) { update.rolled_floor = floor; f = floor; }
        if (window !== undefined) { update.rolled_window = window; w = window; }
        if (speed !== undefined) { update.rolled_speed = speed; sp = speed; }
        // PC-72: optional crit param writes crit_chance; crit is NOT part of the
        // grade formula this pass — setting crit must NOT change grade.
        if (crit !== undefined) { update.crit_chance = crit; c = crit; }
        // recompute grade exactly per generate_consumable_instance (EV/sigma from template)
        const expEV = tmpl.floor_base + (tmpl.floor_delta / 2) + ((tmpl.window_base + tmpl.window_delta) / 2) / 2;
        const sigma = Math.max((tmpl.window_base + tmpl.window_delta) / 2, 1);
        const rolledEV = f + (w / 2);
        const z = (rolledEV - expEV) / sigma;
        const grade = z >= 3 ? 'S' : z >= 2 ? 'A' : z >= 1 ? 'B' : z >= 0 ? 'C' : z >= -1 ? 'D' : z >= -2 ? 'E' : 'F';
        update.grade = grade;
        try {
          await admin.from('consumable_instance').update(update).eq('id', instance_id);
        } catch (e) {
          console.error('set-consumable-stats update error', e);
          return json({ error: 'Internal server error' }, 500);
        }
        return json({ instance_id, template_name: tmpl.name, floor: f, window: w, speed: sp, crit_chance: c, grade });
      }

      // 15. POST /dev/give-consumable (PC-110) — grant rolled consumable(s) to the caller (inventory only, no run/equip)
      if (path === '/dev/give-consumable') {
        const body = await request.json().catch(() => ({}));
        const templateId = parseInt(body.template_id, 10);
        let count = parseInt(body.count, 10);
        if (isNaN(templateId) || templateId <= 0) return json({ error: 'Invalid template_id' }, 400);
        if (isNaN(count) || count < 1) count = 1;
        count = Math.min(count, 25);
        let tmpl;
        try {
          const tRes = await admin.from('consumable_template').select('id, name, floor_base, floor_delta, window_base, window_delta, speed_base, speed_delta, crit_base, crit_range').eq('id', templateId).single();
          tmpl = tRes.data;
          if (tRes.error || !tmpl) throw tRes.error || new Error('not found');
        } catch (e) {
          return json({ error: 'consumable template not found' }, 404);
        }
        // Same uniform roll + z-grade as generate_consumable_instance. Used only when
        // the RPC cannot insert (service_role auth.uid() is NULL and raises). No migration.
        function rollConsumableForCaller() {
          const floorBase = Number(tmpl.floor_base) || 0;
          const floorDelta = Number(tmpl.floor_delta) || 0;
          const windowBase = Number(tmpl.window_base) || 0;
          const windowDelta = Number(tmpl.window_delta) || 0;
          const speedBase = Number(tmpl.speed_base) || 0;
          const speedDelta = Number(tmpl.speed_delta) || 0;
          const critBase = Number(tmpl.crit_base) || 0;
          const critRange = Number(tmpl.crit_range) || 0;
          const rolled_floor = floorBase + Math.floor(Math.random() * (floorDelta + 1));
          const rolled_window = windowBase + Math.floor(Math.random() * (windowDelta + 1));
          const rolled_speed = speedBase + Math.floor(Math.random() * (speedDelta + 1));
          const crit_chance = critRange <= 0
            ? Math.max(0, critBase)
            : Math.max(0, critBase + Math.floor(Math.random() * (critRange * 2 + 1)) - critRange);
          const expEV = floorBase + (floorDelta / 2) + ((windowBase + windowDelta) / 2) / 2;
          const sigma = Math.max((windowBase + windowDelta) / 2, 1);
          const z = ((rolled_floor + rolled_window / 2) - expEV) / sigma;
          const grade = z >= 3 ? 'S' : z >= 2 ? 'A' : z >= 1 ? 'B' : z >= 0 ? 'C' : z >= -1 ? 'D' : z >= -2 ? 'E' : 'F';
          return { rolled_floor, rolled_window, rolled_speed, crit_chance, grade };
        }
        const granted = [];
        for (let i = 0; i < count; i++) {
          let instanceId = null;
          let fromRpc = false;
          try {
            const rpcRes = await admin.rpc('generate_consumable_instance', { p_template_id: templateId });
            if (rpcRes.error) throw rpcRes.error;
            instanceId = rpcRes.data;
            fromRpc = true;
          } catch (e) {
            console.error('generate_consumable_instance error', e);
          }
          if (fromRpc && !instanceId) return json({ error: 'generation returned no id' }, 500);
          if (!fromRpc) {
            const rolled = rollConsumableForCaller();
            try {
              const iRes = await admin.from('consumable_instance').insert({
                user_id: user.id,
                template_id: tmpl.id,
                rolled_floor: rolled.rolled_floor,
                rolled_window: rolled.rolled_window,
                rolled_speed: rolled.rolled_speed,
                crit_chance: rolled.crit_chance,
                grade: rolled.grade
              }).select('id, rolled_floor, rolled_window, rolled_speed, grade').single();
              if (iRes.error || !iRes.data) throw iRes.error || new Error('insert failed');
              granted.push({
                instance_id: iRes.data.id,
                rolled_floor: iRes.data.rolled_floor,
                rolled_window: iRes.data.rolled_window,
                rolled_speed: iRes.data.rolled_speed,
                grade: iRes.data.grade
              });
            } catch (e) {
              console.error('consumable_instance insert error', e);
              return json({ error: 'Failed to generate consumable' }, 500);
            }
            continue;
          }
          let inst;
          try {
            const iRes = await admin.from('consumable_instance')
              .select('id, rolled_floor, rolled_window, rolled_speed, grade, user_id')
              .eq('id', instanceId)
              .maybeSingle();
            inst = iRes.data;
            if (iRes.error) throw iRes.error;
          } catch (e) {
            console.error('consumable_instance fetch error', e);
            return json({ error: 'Internal server error' }, 500);
          }
          if (!inst) return json({ error: 'generation returned no id' }, 500);
          // RPC stamps auth.uid(). Reassign when that is not the caller so the
          // grant lands in the caller's inventory.
          if (inst.user_id !== user.id) {
            try {
              const uRes = await admin.from('consumable_instance').update({ user_id: user.id }).eq('id', instanceId);
              if (uRes && uRes.error) throw uRes.error;
            } catch (e) {
              console.error('consumable_instance reassign error', e);
              return json({ error: 'Internal server error' }, 500);
            }
          }
          granted.push({
            instance_id: inst.id,
            rolled_floor: inst.rolled_floor,
            rolled_window: inst.rolled_window,
            rolled_speed: inst.rolled_speed,
            grade: inst.grade
          });
        }
        return json({ template_name: tmpl.name, granted });
      }

      // 16. POST /dev/give-weapon-self (PC-110) — generate_weapon RPC for the caller
      if (path === '/dev/give-weapon-self') {
        const body = await request.json().catch(() => ({}));
        const templateId = parseInt(body.template_id, 10);
        let count = parseInt(body.count, 10);
        if (isNaN(templateId) || templateId <= 0) return json({ error: 'Invalid template_id' }, 400);
        if (isNaN(count) || count < 1) count = 1;
        count = Math.min(count, 25);
        let tmpl;
        try {
          const tRes = await admin.from('weapon_template').select('id, name, slot_0_attack_id, base_damage, damage_range, base_speed, speed_range, base_accuracy, accuracy_range').eq('id', templateId).single();
          tmpl = tRes.data;
          if (tRes.error || !tmpl) throw tRes.error || new Error('not found');
        } catch (e) {
          return json({ error: 'weapon template not found' }, 404);
        }
        const granted = [];
        for (let i = 0; i < count; i++) {
          try {
            const rpcRes = await admin.rpc('generate_weapon', { p_template_id: tmpl.id, p_user_id: user.id });
            if (rpcRes.error) throw rpcRes.error;
            const inst = rpcRes.data;
            if (!inst || !inst.id) throw new Error('generate_weapon returned no id');
            granted.push({ instance_id: inst.id, damage: inst.damage, speed: inst.speed, accuracy: inst.accuracy, grade: inst.grade });
          } catch (e) {
            console.error('generate_weapon error', e);
            return json({ error: 'Internal server error' }, 500);
          }
        }
        return json({ template_id: templateId, template_name: tmpl.name, granted });
      }

      // 17. POST /dev/del-item (PC-110) — delete an owned instance and clear run loadout pointers
      if (path === '/dev/del-item') {
        const body = await request.json().catch(() => ({}));
        const kind = body.kind;
        const instanceId = parseInt(body.instance_id, 10);
        if (kind !== 'weapon' && kind !== 'consumable') return json({ error: 'Invalid kind' }, 400);
        if (isNaN(instanceId) || instanceId <= 0) return json({ error: 'Invalid instance_id' }, 400);
        const table = kind === 'weapon' ? 'weapon_instance' : 'consumable_instance';
        let inst;
        try {
          const iRes = await admin.from(table).select('id').eq('id', instanceId).eq('user_id', user.id).maybeSingle();
          inst = iRes.data;
          if (iRes.error) throw iRes.error;
        } catch (e) {
          console.error('del-item ownership query error', e);
          return json({ error: 'Internal server error' }, 500);
        }
        if (!inst) return json({ error: kind + ' not found in your inventory' }, 404);
        const cols = kind === 'weapon'
          ? ['hand_l_weapon_id', 'hand_r_weapon_id', 'belt_weapon_id']
          : ['consume_a_id', 'consume_b_id'];
        for (const col of cols) {
          try {
            const uRes = await admin.from('portal_run').update({ [col]: null }).eq(col, instanceId).eq('user_id', user.id);
            if (uRes && uRes.error) throw uRes.error;
          } catch (e) {
            console.error('del-item pointer clear error', e);
            return json({ error: 'Internal server error' }, 500);
          }
        }
        try {
          const dRes = await admin.from(table).delete().eq('id', instanceId).eq('user_id', user.id);
          if (dRes && dRes.error) throw dRes.error;
        } catch (e) {
          console.error('del-item delete error', e);
          return json({ error: 'Internal server error' }, 500);
        }
        return json({ deleted: true, kind, instance_id: instanceId });
      }

      return json({ error: 'unknown dev command' }, 404);
    }

  return null;
}

async function devHttp(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url, 'https://portalcolosseum.com');
  const path = url.pathname.replace('/api/combat', '');
  const method = request.method;
  const auth = await verifyUser(request);
  if (auth.error) return httpJson({ error: auth.error }, auth.status);
  const { admin, user } = auth;
  const res = await handleCombatDev({ request, path, method, admin, user, json: httpJson });
  if (res) return res;
  return httpJson({ error: 'Route not found' }, 404);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
export async function GET(request) { return devHttp(request); }
export async function POST(request) { return devHttp(request); }
export async function PUT(request) { return devHttp(request); }
export async function PATCH(request) { return devHttp(request); }
export async function DELETE(request) { return devHttp(request); }
