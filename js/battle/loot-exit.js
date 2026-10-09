/**
 * Post-battle loot / exit overlay.
 * Moved verbatim from battle-app.js: overlay shell, loot choices, roulette
 * theater, extraction summary, and the loss screen. No behavior change.
 *
 * extractAndLeave and fightOn stay in battle-app.js — they touch the busy
 * gate, shouldAnimateDice, and loadBattle. Bound here so this module does
 * not import battle-app.js.
 */
import { apiCall } from '../combat/combat-api.js';
import { setRenderedFeedLines } from './feed-render.js';
import { performSweepAnimation } from './dice-render.js';

let extractAndLeave = () => {};
let fightOn = () => {};

export function bindLootExit(deps) {
  extractAndLeave = deps.extractAndLeave;
  fightOn = deps.fightOn;
}

export function ensureAdvanceOverlayStyles() {
  if (document.getElementById('pc89-advance-styles')) return;
  const style = document.createElement('style');
  style.id = 'pc89-advance-styles';
  style.textContent = `
.advance-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  font-family: "Pixeloid Mono", "Courier New", monospace;
}
.advance-panel {
  background: #0a1a2e;
  border: 2px solid #4a90d9;
  border-radius: 4px;
  padding: 20px;
  max-width: 520px;
  width: 90%;
  color: #e0f0ff;
  box-shadow: 0 0 20px rgba(74,144,217,0.3);
}
.advance-header {
  text-align: center;
  margin-bottom: 12px;
  font-size: 14px;
  letter-spacing: 1px;
}
.advance-loading {
  text-align: center;
  color: #88aadd;
}
.advance-error {
  color: #ff6666;
}
.advance-loot {
  border-top: 1px solid #4a90d9;
  border-bottom: 1px solid #4a90d9;
  padding: 10px 0;
  margin: 10px 0;
  font-size: 13px;
}
.advance-loot-title {
  margin-bottom: 6px;
  color: #aaddff;
}
.advance-gold { color: #ffcc66; }
.advance-weapon-count { color: #aaddff; }
.advance-lp { color: #88ffaa; }
.advance-share {
  margin: 10px 0;
  font-size: 13px;
}
.advance-tier-note {
  color: #88aadd;
  font-size: 11px;
}
.advance-or {
  margin: 10px 0;
  color: #ffaa66;
  font-size: 12px;
}
.advance-weapons {
  margin: 8px 0;
}
.advance-weapons-label {
  color: #aaddff;
  margin-bottom: 4px;
}
.advance-weapon {
  display: block;
  margin: 3px 0;
  padding: 4px 8px;
  border: 1px solid #4a90d9;
  cursor: pointer;
  font-size: 12px;
  border-radius: 2px;
  background: transparent;
  box-shadow: none;
}
.advance-weapon.is-selected {
  border: 2px solid #66ff99;
  background: #112a44;
  box-shadow: 0 0 6px rgba(102,255,153,0.3);
}
.advance-weapon.highlight {
  box-shadow: 0 0 0 3px #ffffff, 0 0 8px rgba(255,255,255,0.55);
  transform: scale(1.04);
  z-index: 2;
}
.advance-btn-row {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 16px;
}
.action-btn.advance-extract,
.action-btn.advance-extract:hover {
  background: #1a5a1a;
  color: #66ff99;
  border-color: #66ff99;
}
.action-btn.advance-fight,
.action-btn.advance-fight:hover {
  background: #5a1a1a;
  color: #ff6666;
  border-color: #ff6666;
}
.action-btn.advance-town,
.action-btn.advance-town:hover {
  background: #1a3a5a;
  color: #88ccff;
}
.advance-extracted-title {
  text-align: center;
  color: #66ff99;
  margin: 12px 0;
}
.advance-extracted-box {
  border: 1px solid #4a90d9;
  padding: 8px;
  margin: 8px 0;
  font-size: 13px;
}
.advance-note {
  margin-top: 12px;
  font-size: 10px;
  color: #6688aa;
  text-align: center;
}
.end-run-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
`;
  document.head.appendChild(style);
}

// Fixed full-screen flex-centered shell. className carries backdrop and z-index.
// game-app onboarding is a different module (navy backdrop + element id) and
// showLossScreen appends into #message-box — neither uses this helper.
export function mountOverlay(className) {
  ensureAdvanceOverlayStyles();
  const overlay = document.createElement('div');
  overlay.className = className;
  document.body.appendChild(overlay);
  return overlay;
}

export function showAdvanceUI(runId, state) {
  const box = document.getElementById('message-box');
  if (!box) return;
  box.innerHTML = '';
  setRenderedFeedLines(0);
  const actionWrap = document.getElementById('action-choices');
  if (actionWrap) actionWrap.innerHTML = '';

  // PC-XX: loss screen when player is dead
  if (state.player_dead) {
    showLossScreen(runId, state);
    return;
  }

  mountAdvanceOverlay(runId, state);

  // Also keep message-box clean
  box.appendChild(document.createElement('div')); // placeholder
}

function mountAdvanceOverlay(runId, state) {
  const overlay = mountOverlay('advance-overlay');

  const panel = document.createElement('div');
  panel.className = 'advance-panel';

  // Header (populated with real values once the run is fetched)
  const header = document.createElement('div');
  header.className = 'advance-header';
  header.innerHTML = '⚔ BATTLE COMPLETE ⚔';
  panel.appendChild(header);

  const content = document.createElement('div');
  content.innerHTML = '<div class="advance-loading">Loading loot pool...</div>';
  panel.appendChild(content);
  overlay.appendChild(panel);

  // Fetch run for prize_pool + tiers (async populate)
  (async () => {
    try {
      const runJson = await apiCall(`/runs/${runId}`);
      const runData = runJson.run || runJson;
      header.innerHTML = `⚔ BATTLE ${runData.current_battle || '?'} OF ${runData.total_battles || '?'} COMPLETE ⚔<br>HP: ${runData.player_hp ?? state.player?.hp ?? 0}/${runData.max_hp ?? state.player?.max_hp ?? 1000}`;
      // Server pays tmpl.stop_share_tiers or []. Never invent a client table.
      const tiers = runData.stop_share_tiers;
      if (!Array.isArray(tiers) || tiers.length === 0) {
        content.innerHTML = '<div class="advance-error">Failed to load loot data</div>';
        return;
      }
      const battleNum = runData.current_battle || 1;
      const idx = Math.max(0, Math.min(battleNum - 1, tiers.length - 1));
      const currentTier = tiers[idx] || tiers[tiers.length - 1];
      renderLootChoices(runData, currentTier, content, overlay, runId);
    } catch (e) {
      content.innerHTML = '<div class="advance-error">Failed to load loot data</div>';
    }
  })();
}

function renderLootChoices(runData, currentTier, content, overlay, runId) {
  if (!runData) return;
  const pp = runData.prize_pool || { gold: 0, weapon_ids: [], lp_earned: 0 };
  const goldPct = currentTier ? currentTier.gold_pct : 0.2;
  const sel = currentTier ? currentTier.sel_items : 0;
  const rand = currentTier ? currentTier.rand_items : 0;
  const isLast = (runData.current_battle || 1) >= (runData.total_battles || 5);

  content.innerHTML = `
      <div class="advance-loot">
        <div class="advance-loot-title">─── LOOT POOL ───</div>
        <div>Gold: <span class="advance-gold">${pp.gold || 0}</span></div>
        <div>Weapons: <span class="advance-weapon-count">${(pp.weapon_ids || []).length}</span></div>
        <div>LP Earned: <span class="advance-lp">${pp.lp_earned || 0}</span></div>
      </div>
      <div class="advance-share">
        If you extract now:<br>
        Take: <span class="advance-gold">${Math.floor((pp.gold||0)*goldPct)} gold</span> (${Math.round(goldPct*100)}%)<br>
        Weapons: ${sel + rand}<br>
        <span class="advance-tier-note">(Battle ${runData.current_battle || 1} — ${isLast ? 'full extraction' : 'tiered extraction'})</span>
      </div>
      <div class="advance-or">──── OR ────<br>Risk it all for the full pool</div>
    `;

  // Weapon selection if sel_items > 0
  let selectedIds = [];
  const weaponsDiv = document.createElement('div');
  weaponsDiv.className = 'advance-weapons';
  if (sel > 0 && Array.isArray(pp.weapon_ids) && pp.weapon_ids.length > 0) {
    // Build id -> weapon-name map from prize_weapons (fall back to #id)
    const nameById = {};
    (runData.prize_weapons || []).forEach(w => { nameById[w.id] = w.name; });
    weaponsDiv.innerHTML = `<div class="advance-weapons-label">Select up to ${sel} weapons:</div>`;
    pp.weapon_ids.forEach(wid => {
      const wEl = document.createElement('div');
      wEl.textContent = nameById[wid] || `Weapon #${wid}`;
      wEl.className = 'advance-weapon';
      wEl.dataset.weaponId = String(wid);
      wEl.onclick = () => {
        const isSel = selectedIds.includes(wid);
        if (isSel) {
          selectedIds = selectedIds.filter(id => id !== wid);
          wEl.classList.remove('is-selected');
        } else if (selectedIds.length < sel) {
          selectedIds.push(wid);
          wEl.classList.add('is-selected');
        }
      };
      weaponsDiv.appendChild(wEl);
    });
    content.appendChild(weaponsDiv);
  }

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.className = 'advance-btn-row';

  const extractBtn = document.createElement('button');
  extractBtn.textContent = 'EXTRACT & LEAVE';
  extractBtn.className = 'action-btn advance-extract';
  extractBtn.onclick = () => extractAndLeave(runId, selectedIds, content, extractBtn, runData);

  const fightBtn = document.createElement('button');
  fightBtn.textContent = 'FIGHT ON';
  fightBtn.className = 'action-btn advance-fight';
  fightBtn.onclick = () => fightOn(runId, overlay, fightBtn);

  btnRow.appendChild(extractBtn);
  btnRow.appendChild(fightBtn);
  content.appendChild(btnRow);

  // footer note
  const note = document.createElement('div');
  note.className = 'advance-note';
  note.textContent = '(Extract = stop & keep share) (Die = lose everything)';
  content.appendChild(note);
}
// PC-104: theater over the server's already-chosen random picks. Selected
// rows are confirmed before the first hop. Landing index comes from the
// id, never a client re-roll. performSweepAnimation is the dice roulette.
export function revealRandomLoot(content, runData, awarded, prizePool) {
  const selectedIds = Array.isArray(awarded.selected_weapon_ids) ? awarded.selected_weapon_ids : [];
  const randomIds = (awarded.random_weapon_ids || []).filter(id => id != null);
  const nameById = {};
  (runData?.prize_weapons || []).forEach(w => {
    if (w && w.id != null) nameById[w.id] = w.name;
  });
  let els = Array.from(content.querySelectorAll('.advance-weapon[data-weapon-id]'));
  const domIds = new Set(els.map(el => Number(el.dataset.weaponId)));
  const missing = randomIds.some(id => !domIds.has(Number(id)));
  if (els.length === 0 || missing) {
    content.querySelectorAll('.advance-weapons').forEach(n => n.remove());
    const built = mountLootRoulette(orderedLootIds(prizePool, runData, selectedIds, randomIds), nameById, selectedIds);
    content.appendChild(built.wrap);
    els = built.els;
  } else {
    confirmSelectedLoot(els, selectedIds);
    const label = content.querySelector('.advance-weapons-label');
    if (label) label.textContent = 'Revealing random share...';
  }
  content.querySelectorAll('.advance-btn-row, .advance-note, .advance-or').forEach(n => n.remove());
  return sweepLootPicks(els, randomIds);
}

function orderedLootIds(prizePool, runData, selectedIds, randomIds) {
  const ids = [];
  const seen = new Set();
  const push = (id) => {
    if (id == null || seen.has(Number(id))) return;
    seen.add(Number(id));
    ids.push(id);
  };
  const fromPrize = (prizePool && prizePool.weapon_ids) || (runData && runData.prize_pool && runData.prize_pool.weapon_ids) || [];
  fromPrize.forEach(push);
  randomIds.forEach(push);
  selectedIds.forEach(push);
  return ids;
}

function confirmSelectedLoot(els, selectedIds) {
  els.forEach(el => {
    el.onclick = null;
    el.style.cursor = 'default';
    const id = Number(el.dataset.weaponId);
    el.classList.toggle('is-selected', selectedIds.some(s => Number(s) === id));
  });
}

function mountLootRoulette(poolIds, nameById, selectedIds) {
  const wrap = document.createElement('div');
  wrap.className = 'advance-weapons';
  const label = document.createElement('div');
  label.className = 'advance-weapons-label';
  label.textContent = 'Revealing random share...';
  wrap.appendChild(label);
  const els = poolIds.map(wid => {
    const wEl = document.createElement('div');
    wEl.className = 'advance-weapon';
    wEl.dataset.weaponId = String(wid);
    wEl.textContent = nameById[wid] || `Weapon #${wid}`;
    wEl.style.cursor = 'default';
    if (selectedIds.some(id => Number(id) === Number(wid))) wEl.classList.add('is-selected');
    wrap.appendChild(wEl);
    return wEl;
  });
  return { wrap, els };
}

function sweepLootPicks(els, randomIds) {
  let chain = Promise.resolve();
  randomIds.forEach(id => {
    const targetIndex = els.findIndex(el => Number(el.dataset.weaponId) === Number(id));
    if (targetIndex < 0) return;
    chain = chain.then(() => new Promise(resolve => {
      performSweepAnimation(els, targetIndex, (landed) => {
        if (landed) landed.classList.add('is-selected');
        resolve();
      });
    }));
  });
  return chain;
}

export function showExtractionSummary(content, pool) {
  content.innerHTML = `
          <div class="advance-extracted-title">You extracted with:</div>
          <div class="advance-extracted-box">
            Gold: ${pool?.gold || 0}<br>
            Weapons: ${(pool?.weapon_ids || []).length}<br>
            LP: ${pool?.lp_earned || 0}
          </div>
        `;
  const townBtn = document.createElement('button');
  townBtn.textContent = 'Return to town';
  townBtn.className = 'action-btn advance-town';
  townBtn.onclick = () => { window.location.href = '/game.html'; };
  content.appendChild(townBtn);
}

/**
 * PC-XX: Loss/defeat screen shown when the player dies in battle.
 * Calls battle/end (stop) server-side to finalize the run with 'dead' status,
 * then shows defeat message + Return to Town link.
 */
function showLossScreen(runId, state) {
  const box = document.getElementById('message-box');
  if (!box) return;
  box.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'msg-line loss-panel';
  panel.innerHTML = `<strong style="color:#ff4444;">You have been defeated.</strong><br>
    <span style="color:#999;">The run is over. No loot is earned.</span>`;

  const returnBtn = document.createElement('button');
  returnBtn.textContent = 'Return to Town';
  returnBtn.className = 'action-btn';
  returnBtn.style.marginTop = '12px';
  returnBtn.onclick = () => {
    window.location.href = '/game.html';
  };

  panel.appendChild(returnBtn);
  box.appendChild(panel);

  // Fire-and-forget: end the run server-side in the background.
  // The button navigates away regardless, so silence any errors.
  apiCall(`/runs/${runId}/battle/end`, 'POST', { choice: 'stop' }).catch(() => {});
}
