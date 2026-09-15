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
let pendingAttack = null; // {hand, attackId} for commit via re-click or Enter
let shouldAnimateDice = false;

// Tuning constants for PC-51 roulette dice sweep (fast→slow easing)
const DICE_ANIM = {
  INITIAL_INTERVAL: 55,
  MIN_INTERVAL: 260,
  DECELERATION: 1.22,
  MAX_SWEEPS: 4,
  LAND_PAUSE: 220
};

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
  // Dynamic hand buttons + ITEM all live inside #action-menu; gate the whole row.
  document.querySelectorAll('#action-menu button').forEach(btn => {
    btn.disabled = state;
    btn.style.opacity = state ? '0.5' : '1';
  });
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
      if (shouldAnimateDice) {
        shouldAnimateDice = false;
        curEl.style.display = 'none';
        const diceEls = Array.from(remRow.children);
        if (diceEls.length === 0) {
          updateCurrentDie(curEl, current);
        } else if (diceEls.length === 1) {
          diceEls[0].classList.add('highlight');
          setTimeout(() => {
            diceEls[0].classList.remove('highlight');
            updateCurrentDie(curEl, current);
          }, DICE_ANIM.LAND_PAUSE);
        } else {
          performSweepAnimation(diceEls, () => updateCurrentDie(curEl, current));
        }
      } else {
        updateCurrentDie(curEl, current);
      }
    } else {
      curEl.style.display = 'none';
    }
  }
}

function updateCurrentDie(curEl, current) {
  curEl.innerHTML = `
    <div class="die ${current.color}" style="width:32px;height:32px;font-size:14px;">${current.face}</div>
    <div style="font-size:9px;color:#88aaff;margin-top:2px;">${current.rolled_value != null ? current.rolled_value : ''}</div>
  `;
  curEl.style.display = 'flex';
}

function performSweepAnimation(diceEls, onLand) {
  let idx = 0;
  let interval = DICE_ANIM.INITIAL_INTERVAL;
  let sweeps = 0;
  const total = diceEls.length;

  function step() {
    diceEls.forEach(el => el.classList.remove('highlight'));
    diceEls[idx % total].classList.add('highlight');
    idx++;

    interval = Math.min(DICE_ANIM.MIN_INTERVAL, Math.floor(interval * DICE_ANIM.DECELERATION));
    if (idx % total === 0) sweeps++;

    if (sweeps < DICE_ANIM.MAX_SWEEPS || interval < DICE_ANIM.MIN_INTERVAL) {
      setTimeout(step, interval);
    } else {
      setTimeout(() => {
        diceEls.forEach(el => el.classList.remove('highlight'));
        onLand();
      }, DICE_ANIM.LAND_PAUSE);
    }
  }

  step();
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

/**
 * TIME MENU (next-up events column), per the design mockups: one row per
 * queued event, `Label EventName | tics-until-change`, next event on top.
 * Rows are countdowns to a state change: an attack landing, a hand freeing
 * ("Ready"), a monster striking, a potion taking effect.
 */
function renderQueue(bs) {
  const el = document.getElementById('queue');
  if (!el) return;
  el.innerHTML = '';
  const queue = bs.queue || [];
  if (queue.length === 0) return;
  const monsters = bs.monsters || [];
  const sorted = [...queue].sort((a, b) => (a.tics ?? 0) - (b.tics ?? 0));
  for (const row of sorted) {
    const div = document.createElement('div');
    div.className = 'queue-row';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'name';
    nameSpan.textContent = `${queueLabel(row)} ${queueEventName(row, monsters, bs)}`;
    const ticSpan = document.createElement('span');
    ticSpan.className = 'tic';
    ticSpan.textContent = String(row.tics != null ? row.tics : 0);
    div.appendChild(nameSpan);
    div.appendChild(ticSpan);
    el.appendChild(div);
  }
}

function queueLabel(row) {
  if (row.label === 'LH' || row.label === 'RH') return row.label;
  // Monsters show as single-letter arena markers (A/B/C), like the mockups.
  return String(row.label || '?').replace(/^Monster\s*/i, '');
}

function queueEventName(row, monsters, bs) {
  // A hand freeing is a state change — the queue counts down to "Ready".
  if (row.event === 'cooldown' || row.event === 'recovery') return 'Ready';
  if (row.event === 'drinking') {
    const p = (bs.potions || {})[row.potionSlot];
    return (p && p.template_name) ? p.template_name : 'Potion';
  }
  if (row.attackName) return row.attackName;
  // Monster attack rows carry no name — use the monster's primary attack.
  const mon = monsters.find(m => m.label === row.label);
  if (mon && Array.isArray(mon.attacks) && mon.attacks.length && mon.attacks[0].name) {
    return mon.attacks[0].name;
  }
  return 'Attack';
}

function showAdvanceUI(runId, state) {
  const box = document.getElementById('message-box');
  if (!box) return;
  box.innerHTML = '';
  // No more actions to pick — clear the action row.
  const actionWrap = document.getElementById('action-choices');
  if (actionWrap) actionWrap.innerHTML = '';
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
      shouldAnimateDice = true; // post-continue battle-start transition
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

async function doAttack(runId, hand, attackId) {
  if (busy) return;
  setBusy(true);
  try {
    // Real mapped attack for the clicked hand (server validates the mapping).
    // CLI parity: ALWAYS target_ids: [] — engine auto-targets.
    const payload = { hand, attack_id: attackId, target_ids: [] };
    const data = await apiCall(`/runs/${runId}/commit`, 'POST', payload);
    const w = (lastBs && lastBs.weapons && lastBs.weapons[hand === 'LH' ? 'hand_l' : 'hand_r']) || {};
    const attack = (w.attacks || []).find(a => a.id === attackId) || {};
    showMessage(`Attack committed (${hand} ${attack.name || '#' + attackId})`);
    pendingAttack = null;
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

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Action choices = what the player can actually do right now, per design
 * (attack name + damage only — pure choices). One button per READY hand per
 * attack; a winding hand shows its remaining cast tics (live queue countdown).
 */
function renderActionMenu(bs) {
  const wrap = document.getElementById('action-choices');
  if (!wrap) return;
  wrap.innerHTML = '';
  pendingAttack = null;
  wrap.style.display = 'flex';
  wrap.style.gap = '0';
  const hands = (bs.player && bs.player.hands) || {};
  const weapons = bs.weapons || {};
  const queue = bs.queue || [];
  let selectedCmd = null; // per-render selection state

  function showInfo(text) {
    const fi = document.getElementById('footer-info');
    if (fi) fi.innerHTML = text || 'Select an attack to see details';
  }

  function clearSelection() {
    wrap.querySelectorAll('.command').forEach(c => {
      c.classList.remove('selected');
      if (c.innerHTML.startsWith('[x] ')) {
        c.innerHTML = c.innerHTML.replace('[x] ', '[ ] ');
      }
    });
    showInfo('');
    selectedCmd = null;
    pendingAttack = null;
  }

  function selectCommand(cmdEl, hand, attack, weapon) {
    clearSelection();
    cmdEl.classList.add('selected');
    pendingAttack = { hand, attackId: attack.id };
    selectedCmd = { hand, attack, weapon };
    // toggle marker to [x]
    const nameEsc = escHtml(attack.name);
    cmdEl.innerHTML = `[x] ${nameEsc}`;
    const base = weapon.base_damage != null ? weapon.base_damage : (weapon.damage || 0);
    const range = weapon.damage_range != null ? weapon.damage_range : 0;
    const dmgText = `DMG ${base}±${range}`;
    const multi = attack.is_multi_target ? ' <span style="color:#ffaa66">[MULTI]</span>' : '';
    const desc = attack.description ? ` — ${attack.description}` : '';
    const descEsc = attack.description ? ` — ${escHtml(attack.description)}` : '';
    const nameForInfo = escHtml(attack.name);
    showInfo(`<strong>${nameForInfo}</strong> ${dmgText} | Windup: ${attack.prepare_time}t | CD: ${attack.cooldown_time}t${multi}${descEsc}`);
  }

  ['LH', 'RH'].forEach(hand => {
    const w = weapons[hand === 'LH' ? 'hand_l' : 'hand_r'];
    const hState = hands[hand];
    if (!w || !w.id) return;
    if (hState && hState.state === 'Ready') {
      const attacks = w.attacks || [];
      const box = document.createElement('div');
      box.className = 'command-box';
      const header = document.createElement('div');
      header.className = 'hand-header';
      header.textContent = hand === 'LH' ? 'L.HAND' : 'R.HAND';
      box.appendChild(header);
      const wname = document.createElement('div');
      wname.className = 'weapon-name';
      wname.textContent = w.name || 'Unknown';
      box.appendChild(wname);
      if (attacks.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'command';
        empty.textContent = '[ ] no attacks';
        box.appendChild(empty);
      } else {
        const list = document.createElement('div');
        list.className = 'command-list';
        attacks.forEach(a => {
          const cmd = document.createElement('div');
          cmd.className = 'command';
          cmd.dataset.hand = hand;
          cmd.dataset.attackId = a.id;
          cmd.innerHTML = `[ ] ${escHtml(a.name)}`;
          // hover shows without selecting
          cmd.onmouseenter = () => {
            if (!cmd.classList.contains('selected')) {
              const base = w.base_damage != null ? w.base_damage : (w.damage || 0);
              const range = w.damage_range != null ? w.damage_range : 0;
              const dmgText = `DMG ${base}±${range}`;
              const multi = a.is_multi_target ? ' <span style="color:#ffaa66">[MULTI]</span>' : '';
              const desc = a.description ? ` — ${a.description}` : '';
              const descEscH = a.description ? ` — ${escHtml(a.description)}` : '';
              const nameForInfoH = escHtml(a.name);
              showInfo(`<strong>${nameForInfoH}</strong> ${dmgText} | Windup: ${a.prepare_time}t | CD: ${a.cooldown_time}t${multi}${descEscH}`);
            }
          };
          cmd.onmouseleave = () => {
            if (!cmd.classList.contains('selected')) showInfo('');
          };
          cmd.onclick = () => {
            if (cmd.classList.contains('selected')) {
              if (pendingAttack && currentRunId) {
                doAttack(currentRunId, pendingAttack.hand, pendingAttack.attackId);
              }
            } else {
              selectCommand(cmd, hand, a, w);
            }
          };
          list.appendChild(cmd);
        });
        box.appendChild(list);
      }
      wrap.appendChild(box);
    } else if (hState) {
      const windingRow = queue.find(q => q.event === 'winding' && q.label === hand);
      const status = document.createElement('div');
      status.className = 'action-status';
      status.textContent = `${hand} — winding${windingRow && windingRow.tics != null ? ` ${windingRow.tics} tics` : ''}`;
      wrap.appendChild(status);
    }
  });

  // attach slot buttons (BL / C1 / C2)
  attachSlotButtons(bs, showInfo);
}

function attachSlotButtons(bs, showInfo) {
  const weapons = bs.weapons || {};
  const potions = bs.potions || {};

  const blBtn = document.getElementById('btn-slot-bl');
  if (blBtn) {
    const belt = weapons.belt;
    if (belt && belt.id) {
      blBtn.textContent = `BL: ${belt.name || 'Belt'}`;
      blBtn.disabled = false;
      blBtn.onclick = () => {
        const base = belt.base_damage != null ? belt.base_damage : (belt.damage || 0);
        const range = belt.damage_range != null ? belt.damage_range : 0;
        showInfo(`<strong>${belt.name}</strong> DMG ${base}±${range} (belt weapon — no mid-battle swap)`);
      };
    } else {
      blBtn.textContent = 'BL';
      blBtn.disabled = true;
    }
  }

  const c1Btn = document.getElementById('btn-slot-c1');
  const c2Btn = document.getElementById('btn-slot-c2');
  const setupSlot = (btn, key, label) => {
    if (!btn) return;
    const p = potions[key];
    if (p && !p.used) {
      btn.textContent = `${label}: ${p.template_name}`;
      btn.disabled = false;
      btn.onclick = () => openItemMenu(currentRunId);
    } else {
      btn.textContent = label;
      btn.disabled = true;
    }
  };
  setupSlot(c1Btn, 'potion_a', 'C1');
  setupSlot(c2Btn, 'potion_b', 'C2');

  // keyboard navigation (gui1 pattern) — guarded
  document.onkeydown = (e) => {
    if (busy) return;
    const menu = document.getElementById('item-menu');
    if (menu && !menu.hidden) return;
    if (document.activeElement && ['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
    const cmds = Array.from(document.querySelectorAll('#action-choices .command'));
    if (!cmds.length) return;
    let idx = cmds.findIndex(c => c.classList.contains('selected'));
    if (e.key === 'Escape') {
      clearSelection();
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter') {
      if (pendingAttack && currentRunId) {
        (async () => {
          await doAttack(currentRunId, pendingAttack.hand, pendingAttack.attackId);
          pendingAttack = null;
          clearSelection();
          showMessage('Attack committed...');
        })();
      }
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      idx = (idx + 1) % cmds.length;
      selectCommandFromEl(cmds[idx]);
      cmds[idx].scrollIntoView({block:'nearest'});
      e.preventDefault();
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      idx = (idx - 1 + cmds.length) % cmds.length;
      selectCommandFromEl(cmds[idx]);
      cmds[idx].scrollIntoView({block:'nearest'});
      e.preventDefault();
    }
  };

  function selectCommandFromEl(cmdEl) {
    if (!cmdEl) return;
    const allCmds = Array.from(document.querySelectorAll('#action-choices .command'));
    // find matching attack data from lastBs using dataset
    const hand = cmdEl.dataset.hand;
    const attackId = parseInt(cmdEl.dataset.attackId, 10);
    if (!hand || !attackId || !lastBs) return;
    const wKey = hand === 'LH' ? 'hand_l' : 'hand_r';
    const w = (lastBs.weapons || {})[wKey];
    if (!w) return;
    const attack = (w.attacks || []).find(a => a.id === attackId);
    if (!attack) return;
    // clear other selections and markers
    allCmds.forEach(c => {
      c.classList.remove('selected');
      if (c.innerHTML.startsWith('[x] ')) c.innerHTML = c.innerHTML.replace('[x] ', '[ ] ');
    });
    cmdEl.classList.add('selected');
    pendingAttack = { hand, attackId };
    const nameEsc = escHtml(attack.name);
    cmdEl.innerHTML = `[x] ${nameEsc}`;
    const base = w.base_damage != null ? w.base_damage : (w.damage || 0);
    const range = w.damage_range != null ? w.damage_range : 0;
    const dmgText = `DMG ${base}±${range}`;
    const multi = attack.is_multi_target ? ' <span style=\"color:#ffaa66\">[MULTI]</span>' : '';
    const descEsc = attack.description ? ` — ${escHtml(attack.description)}` : '';
    const nameForInfo = escHtml(attack.name);
    showInfo(`<strong>${nameForInfo}</strong> ${dmgText} | Windup: ${attack.prepare_time}t | CD: ${attack.cooldown_time}t${multi}${descEsc}`);
  }
}

function openItemMenu(runId) {
  const menu = document.getElementById('item-menu');
  const list = document.getElementById('item-menu-list');
  if (!menu || !list) return;
  list.innerHTML = '';
  const potions = (lastBs && lastBs.potions) || {};
  const slots = ['A', 'B'];
  const labels = { A: 'C1', B: 'C2' };
  for (const s of slots) {
    const p = potions[s];
    const row = document.createElement('button');
    row.className = 'item-menu-item';
    if (!p) {
      row.innerHTML = `<span class="potion-name">${labels[s]}</span> — empty`;
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
  // slot buttons now wired inside renderActionMenu via attachSlotButtons
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
      const bsTic = (run.battle_state && run.battle_state.tic != null) ? run.battle_state.tic : 0;
      battleLabel.textContent = `BATTLE ${cb} OF ${tb} — TIC ${bsTic}`;
    }

    renderPlayerHP(run);
    const bs = run.battle_state || {};
    lastBs = bs;
    renderDice(bs.dice || {});
    renderMonsters(bs.monsters || []);
    renderFeed(bs.feed || []);
    renderLoadout(bs);
    renderActionMenu(bs);
    renderQueue(bs);

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

function setupEndRunButton(runId) {
  const btn = document.getElementById('end-run-btn');
  if (!btn) return;
  btn.onclick = () => {
    // exact dialog per spec
    const dialog = document.createElement('div');
    dialog.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;';
    dialog.innerHTML = `
      <div style="background:#112233;border:3px solid #4a90d9;padding:20px;max-width:420px;color:#e0e0ff;font-family:'Pixeloid Mono',monospace;font-size:12px;">
        <div style="margin-bottom:12px;">you will lose all loot from this run and nothing will be refunded. Type 'End Run' to confirm.</div>
        <input id="end-run-input" type="text" style="width:100%;background:#000;border:2px solid #335577;color:#e0e0ff;padding:6px;margin-bottom:12px;" placeholder="type here">
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="end-run-cancel" class="action-btn">Cancel</button>
          <button id="end-run-confirm" class="action-btn" disabled>Confirm End Run</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    const input = dialog.querySelector('#end-run-input');
    const confirmBtn = dialog.querySelector('#end-run-confirm');
    const cancelBtn = dialog.querySelector('#end-run-cancel');
    const checkInput = () => {
      const val = (input.value || '').trim().toLowerCase();
      confirmBtn.disabled = val !== 'end run';
    };
    input.oninput = checkInput;
    cancelBtn.onclick = () => dialog.remove();
    confirmBtn.onclick = async () => {
      dialog.remove();
      try {
        await apiCall(`/runs/${runId}/battle/end`, 'POST', { choice: 'stop' });
        localStorage.removeItem('currentRunId');
        window.location.href = '/game.html';
      } catch (e) {
        // surface error without crash
        alert('End Run failed: ' + (e.message || e));
      }
    };
    input.focus();
  };
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

  shouldAnimateDice = true; // run start transition
  await loadBattle(runId);
  setupEndRunButton(runId);
}

init();