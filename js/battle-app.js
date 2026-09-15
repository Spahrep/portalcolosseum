/**
 * Portal Colosseum - Battle Screen Scaffold + Live State Render (PC-46 pass 1)
 * External ES module for /run.html
 * Mirrors run-equip-app.js auth + apiCall conventions exactly.
 * Renders from GET /api/combat/runs/:id using hp_word ONLY.
 * Inert action buttons (message on click). Error states in message box.
 * No combat endpoints wired. Reload-safe, no client memory.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';

const SUPABASE_URL = window.ENV && window.ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV && window.ENV.SUPABASE_ANON_KEY;

let supabase;

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

function renderDice(dice) {
  const tray = document.getElementById('dice-tray');
  const labels = document.getElementById('dice-labels');
  if (!tray || !labels || !dice) return;
  tray.innerHTML = '';
  const rem = dice.remaining || { green: 0, yellow: 0, red: 0 };
  const used = dice.used || { green: 0, yellow: 0, red: 0 };
  const current = dice.current;

  // remaining dice visuals
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

function attachInertButtons() {
  const attackBtn = document.getElementById('btn-attack');
  const itemBtn = document.getElementById('btn-item');
  const handler = () => {
    showMessage('Combat actions land in the next pass.');
  };
  if (attackBtn) attackBtn.addEventListener('click', handler);
  if (itemBtn) itemBtn.addEventListener('click', handler);
}

async function loadBattle(runId) {
  const box = document.getElementById('message-box');
  try {
    const data = await apiCall(`/runs/${runId}`);
    const run = data.run || data;
    if (!run || !run.id) {
      showErrorState('Run not found', 'The requested run does not exist or is inaccessible.');
      return;
    }
    if (run.status === 'completed' || run.status === 'inactive') {
      showErrorState('Run ' + run.status, 'This run is no longer active.', true);
      return;
    }

    // header
    const runTitle = document.getElementById('run-title');
    if (runTitle) runTitle.textContent = `PORTAL · RUN ${run.id}`;
    const battleLabel = document.getElementById('battle-label');
    if (battleLabel) {
      const cb = run.current_battle || 1;
      const tb = run.total_battles || 1;
      battleLabel.textContent = `BATTLE ${cb} OF ${tb}`;
    }

    // player hp (numeric — the API exposes player_hp only; design shows numbers)
    const playerHp = document.getElementById('player-hp');
    if (playerHp) {
      const hpVal = typeof run.player_hp === 'number' ? run.player_hp : null;
      const hpColor = hpVal === null ? '#66ff99' : (hpVal > 300 ? '#66ff99' : (hpVal > 100 ? '#ffcc66' : '#ff6666'));
      playerHp.innerHTML = `HP: <span style="color:${hpColor};">${hpVal === null ? '—' : hpVal}</span>`;
    }

    // dice
    const bs = run.battle_state || {};
    renderDice(bs.dice || {});

    // monsters
    renderMonsters(bs.monsters || []);

    // feed
    renderFeed(bs.feed || []);

    // weapons loadout display (read-only this pass) — names from battle_state.weapons
    const wl = bs.weapons || {};
    const lh = document.getElementById('loadout-lh');
    const rh = document.getElementById('loadout-rh');
    if (lh) lh.textContent = (wl.hand_l && wl.hand_l.name) || '—';
    if (rh) rh.textContent = (wl.hand_r && wl.hand_r.name) || '—';

    attachInertButtons();

  } catch (err) {
    const msg = String(err.message || err);
    if (msg.includes('not found') || msg.includes('404')) {
      showErrorState('Run not found', 'The requested run does not exist or is inaccessible.');
    } else if (msg.includes('inactive') || msg.includes('completed')) {
      showErrorState('Run inactive', 'This run is no longer active.', true);
    } else if (msg.includes('Max 3')) {
      showErrorState('Max 3 active runs', 'You have reached the active run limit.', true);
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