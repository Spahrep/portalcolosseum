/**
 * Portal Colosseum - Battle Screen Live Combat Wiring (PC-47 pass 2)
 * Wires ATTACK (via /commit), ITEM (/use-potion), battle advance (/battle/end).
 * Matches CLI payloads exactly: {hand, attack_id, target_ids:[]}, {slot}.
 * hp_word ONLY for all HP display; busy-state gating on all actions.
 * Re-renders from action responses + GET restore.
 * No console errors; errors in message box.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';

const SUPABASE_URL = window.ENV && window.ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV && window.ENV.SUPABASE_ANON_KEY;

let supabase;
let currentRunId = null;
let lastBs = null; // last loaded battle_state (safeState) — source for attack/potion lookups
let busy = false;

function getAuthToken() {
  return supabase?.auth?.getSession?.().then(({ data }) => data?.session?.access_token);
}

async function apiCall(path, method = 'GET', body = null) {
  const token = await getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers, credentials: 'include' };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`/api/combat${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

async function checkAuth() {
  if (!supabase) {
    window.location.href = '/login.html';
    return false;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

function showMessage(text, isError = false) {
  const box = document.getElementById('message-box');
  if (!box) return;
  const line = document.createElement('div');
  line.className = isError ? 'msg-error' : 'msg-line';
  line.textContent = text;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function showErrorState(title, detail, showReturn = true) {
  const box = document.getElementById('message-box');
  if (!box) return;
  box.innerHTML = '';
  const err = document.createElement('div');
  err.className = 'msg-error';
  err.innerHTML = `<strong>${title}</strong><br>${detail || ''}`;
  if (showReturn) {
    const link = document.createElement('a');
    link.href = '/game.html';
    link.textContent = 'Return to Town';
    link.style.cssText = 'display:block;margin-top:8px;color:#66ccff;';
    err.appendChild(link);
  }
  box.appendChild(err);
}

function setBusy(state) {
  busy = state;
  const attackBtn = document.getElementById('btn-attack');
  const itemBtn = document.getElementById('btn-item');
  if (attackBtn) attackBtn.disabled = state;
  if (itemBtn) itemBtn.disabled = state;
  if (state) {
    if (attackBtn) attackBtn.style.opacity = '0.5';
    if (itemBtn) itemBtn.style.opacity = '0.5';
  } else {
    if (attackBtn) attackBtn.style.opacity = '1';
    if (itemBtn) itemBtn.style.opacity = '1';
  }
}

function renderDice(dice) {
  const tray = document.getElementById('dice-tray');
  const labels = document.getElementById('dice-labels');
  if (!tray || !labels || !dice) return;
  tray.innerHTML = '';
  const rem = dice.remaining || { green: 0, yellow: 0, red: 0 };
  const used = dice.used || { green: 0, yellow: 0, red: 0 };
  const current = dice.current;

  const remRow = document.createElement('div');
  remRow.style.cssText = 'display:flex;gap:3px;margin-bottom:4px;';
  for (let i = 0; i < (rem.green || 0); i++) {
    const d = document.createElement('div');
    d.className = 'die green';
    d.textContent = 'G';
    remRow.appendChild(d);
  }
  for (let i = 0; i < (rem.yellow || 0); i++) {
    const d = document.createElement('div');
    d.className = 'die yellow';
    d.textContent = 'Y';
    remRow.appendChild(d);
  }
  for (let i = 0; i < (rem.red || 0); i++) {
    const d = document.createElement('div');
    d.className = 'die red';
    d.textContent = 'R';
    remRow.appendChild(d);
  }
  tray.appendChild(remRow);

  labels.innerHTML = `
    <div>REMAINING (${(rem.green||0)+(rem.yellow||0)+(rem.red||0)})</div>
    <div>USED (${(used.green||0)+(used.yellow||0)+(used.red||0)})</div>
  `;

  const curEl = document.getElementById('current-die');
  if (curEl) {
    if (current && current.color && current.face != null) {
      curEl.innerHTML = `
        <div class="die ${current.color}" style="width:32px;height:32px;font-size:14px;">${current.face}</div>
        <div style="font-size:9px;color:#88aaff;margin-top:2px;">${current.rolled_value != null ? current.rolled_value : ''}</div>
      `;
      curEl.style.display = 'flex';
    } else {
      curEl.style.display = 'none';
    }
  }
}

function renderMonsters(monsters) {
  const container = document.getElementById('monsters');
  if (!container) return;
  container.innerHTML = '';
  if (!monsters || monsters.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:#556677;font-size:11px;padding:12px;';
    empty.textContent = 'No monsters present.';
    container.appendChild(empty);
    return;
  }
  monsters.forEach(m => {
    const card = document.createElement('div');
    card.style.cssText = 'background:rgba(0,0,0,0.4);border:2px solid #4a90d9;padding:8px 10px;margin-bottom:6px;';
    const sprite = document.createElement('div');
    sprite.style.cssText = 'width:64px;height:48px;background:#112233;border:1px solid #335577;margin:0 auto 6px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#66ccff;';
    sprite.textContent = m.name ? m.name.substring(0,3).toUpperCase() : 'MON';
    const name = document.createElement('div');
    name.style.cssText = 'color:#ffcc66;font-size:11px;text-align:center;';
    name.textContent = m.name || 'Monster';
    const hp = document.createElement('div');
    hp.style.cssText = 'margin-top:4px;text-align:center;';
    const hpWord = m.hp_word || m.hpWord || 'Healthy';
    hp.innerHTML = `<span style="color:#66ff99;font-size:10px;">HP: ${hpWord}</span>`;
    card.appendChild(sprite);
    card.appendChild(name);
    card.appendChild(hp);
    container.appendChild(card);
  });
}

function renderFeed(feed) {
  const box = document.getElementById('message-box');
  if (!box) return;
  box.innerHTML = '';
  if (!feed || feed.length === 0) {
    const line = document.createElement('div');
    line.className = 'msg-line';
    line.textContent = 'Battle begins...';
    box.appendChild(line);
    return;
  }
  feed.forEach(lineText => {
    const line = document.createElement('div');
    line.className = 'msg-line';
    line.textContent = lineText;
    box.appendChild(line);
  });
  box.scrollTop = box.scrollHeight;
}

function renderPlayerHP(runOrState) {
  const el = document.getElementById('player-hp');
  if (!el) return;
  // API exposes player_hp (numeric) only — no player hp_word. Design shows numbers.
  const hpVal = (runOrState && typeof runOrState.player_hp === 'number') ? runOrState.player_hp : null;
  const hpColor = hpVal === null ? '#66ff99' : (hpVal > 300 ? '#66ff99' : (hpVal > 100 ? '#ffcc66' : '#ff6666'));
  el.innerHTML = `HP: <span style="color:${hpColor};">${hpVal === null ? '—' : hpVal}</span>`;
}

function renderLoadout(bs) {
  const wl = bs.weapons || {};
  const lh = document.getElementById('loadout-lh');
  const rh = document.getElementById('loadout-rh');
  if (lh) lh.textContent = (wl.hand_l && wl.hand_l.name) || '—';
  if (rh) rh.textContent = (wl.hand_r && wl.hand_r.name) || '—';
}

function showAdvanceUI(runId, state) {
  const box = document.getElementById('message-box');
  if (!box) return;
  box.innerHTML = '';
  const adv = document.createElement('div');
  adv.className = 'msg-line';
  const monstersDead = state.monsters_dead ?? (Array.isArray(state.monsters) && state.monsters.length > 0 && state.monsters.every(m => m.dead));
  adv.innerHTML = `<strong>Battle complete.</strong> ${monstersDead ? 'Monsters defeated.' : ''}`;
  const contBtn = document.createElement('button');
  contBtn.textContent = 'Continue to next battle';
  contBtn.className = 'action-btn';
  contBtn.style.marginTop = '8px';
  contBtn.onclick = async () => {
    setBusy(true);
    try {
      const res = await apiCall(`/runs/${runId}/battle/end`, 'POST', { choice: 'continue' });
      showMessage('Advancing to next battle...');
      await loadBattle(runId);
    } catch (e) {
      showMessage(e.message, true);
    }
    setBusy(false);
  };
  const stopBtn = document.createElement('button');
  stopBtn.textContent = 'Stop run';
  stopBtn.className = 'action-btn';
  stopBtn.style.marginTop = '8px';
  stopBtn.onclick = async () => {
    setBusy(true);
    try {
      await apiCall(`/runs/${runId}/battle/end`, 'POST', { choice: 'stop' });
      showErrorState('Run stopped', 'You abandoned the run.', true);
    } catch (e) {
      showMessage(e.message, true);
    }
    setBusy(false);
  };
  adv.appendChild(contBtn);
  adv.appendChild(stopBtn);
  box.appendChild(adv);
}

async function doAttack(runId) {
  if (busy) return;
  setBusy(true);
  try {
    // Real mapped attack from the equipped LH weapon (server validates the mapping).
    // CLI parity: ALWAYS target_ids: [] — engine auto-targets.
    const lhAttacks = (lastBs && lastBs.weapons && lastBs.weapons.hand_l && lastBs.weapons.hand_l.attacks) || [];
    if (lhAttacks.length === 0) {
      showMessage('No attack available for the LH weapon.', true);
      setBusy(false);
      return;
    }
    const attack = lhAttacks[0];
    const payload = { hand: 'LH', attack_id: attack.id, target_ids: [] };
    const data = await apiCall(`/runs/${runId}/commit`, 'POST', payload);
    showMessage(`Attack committed (${attack.name})`);
    // Commit response is a minimal engine snapshot — re-render from the well-shaped GET.
    if (data.state && data.state.battle_over) {
      showAdvanceUI(runId, data.state);
    } else {
      await loadBattle(runId);
    }
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.includes('Hand not ready')) {
      showMessage('Hand not ready — waiting engine advance');
    } else {
      showMessage(msg, true);
    }
  }
  setBusy(false);
}

function openItemMenu(runId) {
  const menu = document.getElementById('item-menu');
  const list = document.getElementById('item-menu-list');
  if (!menu || !list) return;
  list.innerHTML = '';
  const potions = (lastBs && lastBs.potions) || {};
  const slots = ['A', 'B'];
  for (const s of slots) {
    const p = potions[s];
    const row = document.createElement('button');
    row.className = 'item-menu-item';
    if (!p) {
      row.innerHTML = `<span class="potion-name">SLOT ${s}</span> — empty`;
      row.disabled = true;
    } else if (p.used) {
      row.innerHTML = `<span class="potion-name">${p.template_name}</span> · ${p.effect_label} <span class="potion-used">(USED)</span>`;
      row.disabled = true;
    } else {
      row.innerHTML = `<span class="potion-name">${p.template_name}</span> · ${p.effect_label}`;
      row.onclick = async () => {
        closeItemMenu();
        await usePotion(runId, s);
      };
    }
    list.appendChild(row);
  }
  menu.hidden = false;
}

function closeItemMenu() {
  const menu = document.getElementById('item-menu');
  if (menu) menu.hidden = true;
}

async function usePotion(runId, slot) {
  if (busy) return;
  setBusy(true);
  try {
    const payload = { slot };
    await apiCall(`/runs/${runId}/use-potion`, 'POST', payload);
    showMessage(`Potion ${slot} used`);
    await loadBattle(runId);
  } catch (e) {
    showMessage(e.message, true);
  }
  setBusy(false);
}

function doItem(runId) {
  if (busy) return;
  const potions = (lastBs && lastBs.potions) || {};
  const available = ['A', 'B'].filter(s => potions[s] && !potions[s].used);
  if (available.length === 0) {
    showMessage('No unused potions equipped.', true);
    return;
  }
  openItemMenu(runId);
}

function attachLiveButtons(runId) {
  const attackBtn = document.getElementById('btn-attack');
  const itemBtn = document.getElementById('btn-item');
  if (attackBtn) {
    attackBtn.onclick = () => doAttack(runId);
    attackBtn.disabled = false;
  }
  if (itemBtn) {
    itemBtn.onclick = () => doItem(runId);
    itemBtn.disabled = false;
  }
  const itemCancel = document.getElementById('btn-item-cancel');
  if (itemCancel) {
    itemCancel.onclick = closeItemMenu;
  }
}

async function loadBattle(runId) {
  currentRunId = runId;
  const box = document.getElementById('message-box');
  try {
    const data = await apiCall(`/runs/${runId}`);
    const run = data.run || data;
    if (!run || !run.id) {
      showErrorState('Run not found', 'The requested run does not exist or is inaccessible.');
      return;
    }
    if (run.status === 'completed' || run.status === 'inactive' || run.status === 'dead' || run.status === 'abandoned') {
      showErrorState('Run ' + run.status, 'This run is no longer active.', true);
      return;
    }

    const runTitle = document.getElementById('run-title');
    if (runTitle) runTitle.textContent = `PORTAL · RUN ${run.id}`;
    const battleLabel = document.getElementById('battle-label');
    if (battleLabel) {
      const cb = run.current_battle || 1;
      const tb = run.total_battles || 1;
      battleLabel.textContent = `BATTLE ${cb} OF ${tb}`;
    }

    renderPlayerHP(run);
    const bs = run.battle_state || {};
    lastBs = bs;
    renderDice(bs.dice || {});
    renderMonsters(bs.monsters || []);
    renderFeed(bs.feed || []);
    renderLoadout(bs);

    attachLiveButtons(runId);

    // battle-over detection on reload: safeState has no battle_over flag —
    // all monsters dead means the battle is winnable/over.
    const monsterList = bs.monsters || [];
    const allMonstersDead = monsterList.length > 0 && monsterList.every(m => m.dead);
    if (allMonstersDead) {
      showAdvanceUI(runId, bs);
    }

  } catch (err) {
    const msg = String(err.message || err);
    if (msg.includes('not found') || msg.includes('404')) {
      showErrorState('Run not found', 'The requested run does not exist or is inaccessible.');
    } else if (msg.includes('inactive') || msg.includes('completed')) {
      showErrorState('Run inactive', 'This run is no longer active.', true);
    } else {
      showErrorState('Load failed', msg, true);
    }
  }
}

async function init() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    showErrorState('Configuration error', 'Missing Supabase ENV.');
    return;
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      storage: {
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, value) => localStorage.setItem(key, value),
        removeItem: (key) => localStorage.removeItem(key)
      }
    }
  });
  if (!(await checkAuth())) return;

  const params = new URLSearchParams(window.location.search);
  const runId = params.get('id');
  if (!runId) {
    showErrorState('Missing run ID', 'Add ?id=NNN to the URL.', true);
    return;
  }

  await loadBattle(runId);
}

init();