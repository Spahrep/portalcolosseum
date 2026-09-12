#!/usr/bin/env node
// scripts/playthrough.mjs — autonomous Portal Colosseum run harness (ESM, no deps)
// Env: PLAYTHROUGH_JWT (required), PLAYTHROUGH_BASE_URL (default https://portalcolosseum.com)
// Optional: PLAYTHROUGH_LH/RH/BELT (weapon ids), PLAYTHROUGH_ATTACK_ID (default first per weapon)

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PLAYTHROUGH_BASE_URL || 'https://portalcolosseum.com';
const JWT = process.env.PLAYTHROUGH_JWT;
const LH = process.env.PLAYTHROUGH_LH ? parseInt(process.env.PLAYTHROUGH_LH, 10) : null;
const RH = process.env.PLAYTHROUGH_RH ? parseInt(process.env.PLAYTHROUGH_RH, 10) : null;
const BELT = process.env.PLAYTHROUGH_BELT ? parseInt(process.env.PLAYTHROUGH_BELT, 10) : null;
const FIXED_ATTACK = process.env.PLAYTHROUGH_ATTACK_ID ? parseInt(process.env.PLAYTHROUGH_ATTACK_ID, 10) : null;

if (!JWT) {
  console.error('ERROR: PLAYTHROUGH_JWT required');
  process.exit(1);
}

const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${JWT}` };

async function apiCall(method, path, body = null, timeoutMs = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/api/combat${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
      signal: controller.signal,
    });
    clearTimeout(t);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error || res.statusText;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (e) {
    clearTimeout(t);
    if (e.name === 'AbortError') throw new Error(`timeout on ${method} ${path}`);
    throw e;
  }
}

async function abandonAll() {
  for (let i = 0; i < 10; i++) {
    try {
      await apiCall('POST', '/dev/abandon-run');
    } catch (e) {
      if ((e.message || '').includes('start a run first') || (e.message || '').includes('no active')) {
        return;
      }
      throw e;
    }
  }
  throw new Error('abandon loop exceeded');
}

async function getWeapons() {
  const { weapons = [] } = await apiCall('GET', '/weapons');
  return weapons.sort((a, b) => b.damage - a.damage);
}

function pickWeapons(weapons) {
  if (LH && RH) {
    const lhW = weapons.find(w => w.id === LH);
    const rhW = weapons.find(w => w.id === RH);
    const beltW = BELT ? weapons.find(w => w.id === BELT) : null;
    if (!lhW || !rhW) throw new Error('env weapon ids not owned');
    return { lh: lhW, rh: rhW, belt: beltW, lhAttack: FIXED_ATTACK || (lhW.attacks[0]?.id), rhAttack: FIXED_ATTACK || (rhW.attacks[0]?.id) };
  }
  if (weapons.length < 2) throw new Error('need at least 2 weapons');
  const lh = weapons[0];
  const rh = weapons[1];
  const belt = weapons[2] || null;
  return {
    lh, rh, belt,
    lhAttack: FIXED_ATTACK || (lh.attacks[0]?.id),
    rhAttack: FIXED_ATTACK || (rh.attacks[0]?.id),
  };
}

async function createRun(picks) {
  const body = {
    portal_template_id: 1,
    hand_l_weapon_id: picks.lh.id,
    hand_r_weapon_id: picks.rh.id,
    belt_weapon_id: picks.belt ? picks.belt.id : null,
  };
  const { run } = await apiCall('POST', '/runs', body);
  return run;
}

async function startBattle(runId) {
  try {
    await apiCall('POST', `/runs/${runId}/battle/start`, {});
  } catch (e) {
    if ((e.message || '').includes('Battle already in progress')) return;
    throw e;
  }
}

async function getState(runId) {
  const { run } = await apiCall('GET', `/runs/${runId}`);
  return run;
}

function allMonstersDead(monsters) {
  return monsters.length > 0 && monsters.every(m => (m.current_hp || 0) <= 0);
}

async function doAttack(runId, hand, attackId) {
  try {
    return await apiCall('POST', `/runs/${runId}/commit`, { hand, attack_id: attackId, target_ids: [] });
  } catch (e) {
    if ((e.message || '').includes('Hand not ready')) {
      return { advanced: true, state: null };
    }
    throw e;
  }
}

async function endBattle(runId, choice) {
  return apiCall('POST', `/runs/${runId}/battle/end`, { choice });
}

function snapshotFeed(feed) {
  return [...(feed || [])];
}

function analyzeFeed(feed, prevHp, currHp) {
  let dealt = 0;
  let taken = 0;
  for (const line of feed) {
    const m = line.match(/tic \d+ — (LH|RH|Monster .+?) attack hits .+? for (\d+)/);
    if (!m) continue;
    const dmg = parseInt(m[2], 10);
    if (m[1] === 'LH' || m[1] === 'RH') dealt += dmg;
    else taken += dmg;
  }
  if (typeof prevHp === 'number' && typeof currHp === 'number') {
    taken = Math.max(taken, prevHp - currHp);
  }
  return { dealt, taken };
}

async function playthrough() {
  console.log('Abandoning active runs...');
  await abandonAll();

  console.log('Fetching weapons...');
  const weapons = await getWeapons();
  const picks = pickWeapons(weapons);
  console.log(`Picked: LH#${picks.lh.id}(${picks.lh.name}), RH#${picks.rh.id}(${picks.rh.name}), belt=${picks.belt ? picks.belt.id : 'none'}`);

  console.log('Creating run...');
  const run = await createRun(picks);
  const runId = run.id;
  const totalBattles = run.total_battles || 5;
  console.log(`Run ${runId} created, total_battles=${totalBattles}`);

  const summary = {
    run_id: runId,
    equipment: {
      lh: { id: picks.lh.id, name: picks.lh.name, attack_id: picks.lhAttack },
      rh: { id: picks.rh.id, name: picks.rh.name, attack_id: picks.rhAttack },
      belt: picks.belt ? { id: picks.belt.id, name: picks.belt.name } : null,
    },
    battles: [],
    totals: { damage_dealt: 0, damage_taken: 0, turns: 0 },
    outcome: 'unknown',
    final_player_hp: null,
  };

  let overallHp = run.player_hp;

  for (let b = 1; b <= totalBattles; b++) {
    console.log(`\n=== Battle ${b}/${totalBattles} ===`);
    await startBattle(runId);

    const battleStart = await getState(runId);
    const startHp = battleStart.player_hp;
    const battleState = battleStart.battle_state || {};
    let feedLines = [];
    const seen = new Set();
    const addFeed = (feedArr) => {
      for (const line of (feedArr || [])) {
        if (!seen.has(line)) { seen.add(line); feedLines.push(line); }
      }
    };
    addFeed(battleState.feed);
    let turns = 0, playerDied = false, battleEnded = false;
    const attacks = { LH: 0, RH: 0 };

    const maxTurns = 300;
    while (turns < maxTurns && !battleEnded) {
      const st = await getState(runId);
      const bs = st.battle_state || {};
      if (st.player_hp <= 0) {
        console.log('Player dead'); playerDied = true;
        break;
      }
      // commit BOTH hands every iteration, unconditionally — the server decides:
      // ready hand fires the attack (advanced:false), busy hand fast-forwards the clock (advanced:true)
      // this is required: the engine only advances tics on commits, so a Ready-only gate deadlocks
      for (const hand of ['LH', 'RH']) {
        const attackId = hand === 'LH' ? picks.lhAttack : picks.rhAttack;
        if (!attackId) continue;
        const res = await doAttack(runId, hand, attackId);
        addFeed(res.feed || res.state?.feed);
        if (res.state && (res.state.battle_over === true || res.state.player_dead === true)) {
          console.log(res.state.player_dead ? 'Player dead' : 'Battle over');
          if (res.state.player_dead) playerDied = true;
          battleEnded = true;
          break;
        }
        if (!res.advanced) attacks[hand]++;
        turns++;
      }
    }

    const endSt = await getState(runId);
    const endHp = endSt.player_hp;
    const endBs = endSt.battle_state || {};
    const { dealt, taken } = analyzeFeed(feedLines, startHp, endHp);

    summary.battles.push({
      battle: b,
      monsters: (endBs.monsters || []).map(m => ({ name: m.name || m.label, hp_word: m.hp_word })),
      player_hp_start: startHp,
      player_hp_end: endHp,
      damage_dealt: dealt,
      damage_taken: taken,
      attacks,
    });
    summary.totals.damage_dealt += dealt;
    summary.totals.damage_taken += taken;
    summary.totals.turns += turns;

    const choice = (endBs.player_dead || endSt.player_hp <= 0) ? 'stop' : 'continue';
    await endBattle(runId, choice);
    console.log(`Battle ${b} ended, choice=${choice}, hp=${endHp}`);

    if (choice === 'stop') {
      summary.outcome = playerDied ? 'dead' : 'completed';
      break;
    }
    overallHp = endHp;
  }

  summary.final_player_hp = overallHp;
  if (summary.outcome === 'unknown') summary.outcome = 'completed';

  const outPath = join(__dirname, 'run-summary.json');
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`\nSummary written to ${outPath}`);

  // human readable
  console.log('\n=== RUN SUMMARY ===');
  console.log(`run_id: ${summary.run_id}  outcome: ${summary.outcome}  battles: ${summary.battles.length}/${totalBattles}  final_hp: ${summary.final_player_hp}`);
  console.log(`equipment: LH=${summary.equipment.lh.name}#${summary.equipment.lh.id} (atk ${summary.equipment.lh.attack_id}), RH=${summary.equipment.rh.name}#${summary.equipment.rh.id} (atk ${summary.equipment.rh.attack_id}), belt=${summary.equipment.belt ? summary.equipment.belt.id : 'none'}`);
  summary.battles.forEach(b => {
    console.log(`  Battle ${b.battle}: mons=${b.monsters.map(m => m.name).join(',')}, hp ${b.player_hp_start}->${b.player_hp_end}, dealt ${b.damage_dealt}, taken ${b.damage_taken}, attacks LH=${b.attacks.LH} RH=${b.attacks.RH}`);
  });
  console.log(`totals: dealt=${summary.totals.damage_dealt} taken=${summary.totals.damage_taken} turns=${summary.totals.turns}`);

  return summary;
}

playthrough().catch(e => {
  console.error('FATAL:', e.message || e);
  process.exit(1);
});
