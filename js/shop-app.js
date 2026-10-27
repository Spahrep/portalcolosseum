/**
 * Portal Colosseum - Shop Screen (leaf module)
 * Renders vendor1.jpg backdrop + text item cards for weapons/consumables.
 * Two views: buy (the daily stock) and sell (your owned weapons).
 * Uses apiCall to /combat/shop* endpoints. No imports from battle-app, cli-app, admin-app.
 * Exports: initShop, openShop, closeShop, isShopOpen
 */

import { apiCall } from './combat/combat-api.js';

const GRADE_COLORS = {
  D: '#9d9d9d',
  C: '#ffffff',
  B: '#1eff00',
  A: '#0070dd',
  S: '#a335ee',
};

let modal = null;
let stockGrid = null;
let headerEl = null;
let currentData = null;
let focusIndex = -1;
let focusables = [];

// --- keyboard navigation (mouse-free, matches the game's arrow-key feel) ---
// Focusable order after each render: the item/sell cards, then the header
// action buttons (reroll, AP reset) and the sell/back button.
// ArrowLeft/Up = prev, ArrowRight/Down = next, Enter = activate, Escape = close.
function collectFocusables() {
  if (!modal) return [];
  const cards = Array.from(modal.querySelectorAll('.shop-item-card'));
  const reroll = modal.querySelector('#shop-reroll-btn');
  const apreset = modal.querySelector('#shop-apreset-btn');
  const sell = modal.querySelector('.shop-sell-btn');
  const back = modal.querySelector('.shop-back-btn');
  const list = [...cards];
  if (reroll) list.push(reroll);
  if (apreset) list.push(apreset);
  if (sell) list.push(sell);
  if (back) list.push(back);
  return list;
}

function applyFocus() {
  if (!modal) return;
  modal.querySelectorAll('.shop-item-card, .shop-buy-btn, .shop-sell-item-btn, #shop-reroll-btn, #shop-apreset-btn, .shop-sell-btn, .shop-back-btn')
    .forEach(el => el.classList.remove('shop-focused'));
  if (focusIndex < 0 || focusIndex >= focusables.length) return;
  const el = focusables[focusIndex];
  if (!el) return;
  el.classList.add('shop-focused');
  if (typeof el.focus === 'function') el.focus({ preventScroll: true });
}

function moveFocus(delta) {
  if (!focusables.length) return;
  focusIndex = (focusIndex + delta + focusables.length) % focusables.length;
  applyFocus();
}

function activateFocused() {
  const el = focusables[focusIndex];
  if (!el) return;
  if (el.classList.contains('shop-item-card')) {
    const btn = el.querySelector('.shop-buy-btn') || el.querySelector('.shop-sell-item-btn');
    if (btn) btn.click();
  } else if (typeof el.click === 'function') {
    el.click();
  }
}

function handleShopKeydown(e) {
  if (!isShopOpen()) return;
  switch (e.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      e.preventDefault();
      moveFocus(-1);
      break;
    case 'ArrowRight':
    case 'ArrowDown':
      e.preventDefault();
      moveFocus(1);
      break;
    case 'Enter':
      e.preventDefault();
      activateFocused();
      break;
    case 'Escape':
      e.preventDefault();
      closeShop();
      break;
  }
}

function createModalIfNeeded() {
  if (modal) return;
  modal = document.getElementById('shop-modal');
  if (!modal) {
    console.error('shop-modal not found in DOM');
    return;
  }
  stockGrid = modal.querySelector('#shop-stock-grid');
  headerEl = modal.querySelector('#shop-header');
  // Wire close
  const closeBtn = modal.querySelector('#shop-close');
  if (closeBtn) closeBtn.addEventListener('click', closeShop);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeShop();
  });
}

function tierBadge(tier) {
  const color = GRADE_COLORS[tier] || '#fff';
  return `<span class="shop-tier-badge" style="color:${color};border-color:${color}">${tier}</span>`;
}

// --- in-game message (no browser alerts) ---
let messageEl = null;
function showShopMessage(text, isError = false) {
  if (!messageEl) messageEl = document.getElementById('shop-message');
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.className = 'shop-message' + (isError ? ' shop-message-error' : '');
  messageEl.hidden = false;
}
function clearShopMessage() {
  if (!messageEl) messageEl = document.getElementById('shop-message');
  if (messageEl) messageEl.hidden = true;
}

// Map a backend error object to player-facing prose (in the vendor's voice).
// The backend keeps stable codes (API/tests); this layer makes them human.
function shopErrorMessage(err) {
  if (!err || typeof err === 'string') return err || 'Something went wrong.';
  const code = err.error || err.code;
  const need = err.need, have = err.have;
  switch (code) {
    case 'insufficient_gold':
      return `That costs ${need} gold — you only have ${have}. Run a portal or sell something to raise the funds.`;
    case 'insufficient_ap':
      return `You need ${need} AP — you only have ${have}. It refreshes at midnight.`;
    case 'no_sell_last_weapon':
      return "Ye can't sell yer last weapon — ye'd be fighting bare-handed!";
    case 'weapon_in_active_run':
      return "That weapon's in a run right now — finish or abandon it first.";
    case 'not_owned':
      return "That weapon isn't yours to sell.";
    case 'slot_not_in_stock':
      return "That's already gone.";
    case 'invalid_slot':
    case 'invalid_instance_id':
      return 'That selection is no longer valid.';
    default:
      return err.message || 'Something went wrong.';
  }
}

// apiCall throws on non-2xx with the raw JSON body as e.message. Parse it back
// into an object so shopErrorMessage can map it; fall back to the raw message.
function shopErrorFromException(e) {
  if (!e) return 'Something went wrong.';
  if (e && e.error) return shopErrorMessage(e);
  const msg = e.message || String(e);
  try {
    const parsed = JSON.parse(msg);
    if (parsed && parsed.error) return shopErrorMessage(parsed);
  } catch (_) { /* not JSON — plain message */ }
  return msg;
}

function estimatedDps(item) {
  if (item.kind !== 'weapon' && (item.damage == null || item.speed == null)) return null;
  const c = item.crit_chance ?? 5;
  return Math.round(item.damage * (100 / item.speed) * ((item.accuracy ?? 100) / 100) * (1 + c / 100));
}
function statsLine(item) {
  if (item.kind === 'weapon' || (item.damage != null && item.speed != null)) {
    const dps = estimatedDps(item);
    return `<div class="shop-stats">DMG ${item.damage} • SPD ${item.speed} • ACC ${item.accuracy} • CRIT ${item.crit_chance}%${dps != null ? ` • <span class="shop-dps">DPS ${dps}</span>` : ''}</div>`;
  }
  return `<div class="shop-stats">Floor ${item.rolled_floor} • Window ${item.rolled_window}</div>`;
}

function renderItemCard(item) {
  const isWeapon = item.kind === 'weapon';
  const statsHtml = statsLine(item);
  return `
    <div class="shop-item-card" data-slot="${item.slot}" data-kind="${item.kind}" tabindex="0">
      <div class="shop-item-header">
        <span class="shop-item-name">${item.name}</span>
        ${tierBadge(item.tier)}
      </div>
      ${statsHtml}
      <div class="shop-item-price">${item.buy_price}g <span class="shop-qmult">QM ×${item.quality_multiplier}</span> <span class="shop-cmult">Cost ×${item.price_factor}</span></div>
      <button class="shop-buy-btn" data-slot="${item.slot}">BUY</button>
    </div>
  `;
}

function renderSellCard(item) {
  const dps = estimatedDps(item);
  return `
    <div class="shop-item-card" data-instance="${item.instance_id}" data-kind="weapon" tabindex="0">
      <div class="shop-item-header">
        <span class="shop-item-name">${item.name}</span>
        ${tierBadge(item.tier)}
      </div>
      <div class="shop-stats">DMG ${item.damage} • SPD ${item.speed} • ACC ${item.accuracy} • CRIT ${item.crit_chance}%${dps != null ? ` • <span class="shop-dps">DPS ${dps}</span>` : ''}</div>
      <div class="shop-item-price">${item.sell_price}g <span class="shop-qmult">QM ×${item.quality_multiplier}</span> <span class="shop-cmult">Cost ×${item.price_factor} (sell ×${item.sell_multiplier})</span></div>
      <button class="shop-sell-item-btn" data-instance="${item.instance_id}">SELL</button>
    </div>
  `;
}

function renderSellSection(canSell) {
  if (!canSell) return '<div class="shop-sell-section">No weapons to sell</div>';
  return `
    <div class="shop-sell-section">
      <button class="shop-sell-btn">SELL A WEAPON</button>
      <span class="shop-sell-note">(sell one of your owned weapons)</span>
    </div>
  `;
}

// --- SELL VIEW ---
async function openSellView() {
  if (!stockGrid) return;
  try {
    const inv = await apiCall('/shop/inventory');
    const items = (inv.items || []).filter(i => i.instance_id);
    headerEl.innerHTML = `
      <span>SELLING — GOLD: ${inv.gold ?? currentData?.gold ?? '?'}</span>
      <button class="shop-back-btn">← BACK</button>
    `;
    let body;
    if (!items.length) {
      body = '<div class="shop-sell-section">No weapons to sell</div>';
    } else {
      body = items.map(renderSellCard).join('');
    }
    stockGrid.innerHTML = body;
    attachSellListeners();
    focusables = collectFocusables();
    focusIndex = focusables.length ? 0 : -1;
    applyFocus();
  } catch (e) {
    if (stockGrid) stockGrid.innerHTML = `<div class="shop-error">Failed to load inventory: ${e.message}</div>`;
  }
}

function attachSellListeners() {
  if (!modal) return;
  // Each sell card's button sells that weapon, then re-shows the sell view.
  modal.querySelectorAll('.shop-sell-item-btn').forEach(btn => {
    btn.onclick = async () => {
      const instanceId = btn.dataset.instance;
      const card = btn.closest('.shop-item-card');
      btn.disabled = true;
      const orig = btn.textContent;
      // INSTANT visual cue — always show BEFORE the network call returns
      btn.textContent = 'SELLING…';
      if (card) card.classList.add('shop-selling');
      try {
        const res = await apiCall('/shop/sell', 'POST', { instance_id: instanceId });
        if (res.ok) {
          // hold a clear success confirmation so even an instant response is seen
          btn.textContent = 'SOLD ✓';
          if (card) { card.classList.remove('shop-selling'); card.classList.add('shop-sold'); }
          await new Promise(r => setTimeout(r, 380));
          await openSellView(); // re-render list (sold one gone, gold updated)
        } else {
          btn.textContent = orig;
          btn.disabled = false;
          if (card) card.classList.remove('shop-selling');
          showShopMessage(shopErrorMessage(res) || 'Sell failed', true);
        }
      } catch (e) {
        btn.textContent = orig;
        btn.disabled = false;
        if (card) card.classList.remove('shop-selling');
        showShopMessage(shopErrorFromException(e), true);
      }
    };
  });
  // Back to the buy view.
  const backBtn = modal.querySelector('.shop-back-btn');
  if (backBtn) {
    backBtn.onclick = async () => {
      await refreshShop();
    };
  }
}

function attachActionListeners() {
  if (!modal) return;
  // Buy buttons
  modal.querySelectorAll('.shop-buy-btn').forEach(btn => {
    btn.onclick = async () => {
      const slot = btn.dataset.slot;
      const card = btn.closest('.shop-item-card');
      btn.disabled = true;
      const orig = btn.textContent;
      // INSTANT visual cue before the network call returns
      btn.textContent = 'BUYING…';
      if (card) card.classList.add('shop-selling');
      try {
        const res = await apiCall('/shop/buy', 'POST', { slot });
        if (res.ok) {
          // hold a clear success confirmation so even an instant response is seen
          btn.textContent = 'BOUGHT ✓';
          if (card) { card.classList.remove('shop-selling'); card.classList.add('shop-sold'); }
          await new Promise(r => setTimeout(r, 380));
          await refreshShop();
        } else {
          btn.textContent = orig;
          btn.disabled = false;
          if (card) card.classList.remove('shop-selling');
          showShopMessage(shopErrorMessage(res) || 'Buy failed', true);
        }
      } catch (e) {
        btn.textContent = orig;
        btn.disabled = false;
        if (card) card.classList.remove('shop-selling');
        showShopMessage(shopErrorFromException(e), true);
      }
    };
  });
  // Sell (entry to the sell view)
  const sellBtn = modal.querySelector('.shop-sell-btn');
  if (sellBtn) {
    sellBtn.onclick = openSellView;
  }
  // Reroll
  const rerollBtn = modal.querySelector('#shop-reroll-btn');
  if (rerollBtn) {
    rerollBtn.onclick = async () => {
      rerollBtn.disabled = true;
      const orig = rerollBtn.textContent;
      // INSTANT cue before the network returns — no wondering whether to re-click
      rerollBtn.textContent = 'REROLLING…';
      try {
        const res = await apiCall('/shop/reroll', 'POST');
        if (res.ok) {
          // hold a clear confirmation so even an instant response is seen
          rerollBtn.textContent = 'REROLLED ✓';
          await new Promise(r => setTimeout(r, 380));
          await refreshShop(); // full fetch: header gold/AP/reroll-cost + new stock
        } else {
          rerollBtn.textContent = orig;
          rerollBtn.disabled = false;
          showShopMessage(shopErrorMessage(res) || 'Reroll failed', true);
        }
      } catch (e) {
        rerollBtn.textContent = orig;
        rerollBtn.disabled = false;
        showShopMessage(shopErrorFromException(e), true);
      }
    };
  }
  // AP reset
  const apBtn = modal.querySelector('#shop-apreset-btn');
  if (apBtn) {
    apBtn.onclick = async () => {
      apBtn.disabled = true;
      const orig = apBtn.textContent;
      // INSTANT cue before the network returns — no wondering whether to re-click
      apBtn.textContent = 'RESETTING…';
      try {
        const res = await apiCall('/shop/ap-reset', 'POST');
        if (res.ok) {
          // hold a clear confirmation so even an instant response is seen
          apBtn.textContent = 'RESET ✓';
          await new Promise(r => setTimeout(r, 380));
          await refreshShop(); // full fetch: header gold/AP/reroll-cost all current
        } else {
          apBtn.textContent = orig;
          apBtn.disabled = false;
          showShopMessage(shopErrorMessage(res) || 'AP reset failed', true);
        }
      } catch (e) {
        apBtn.textContent = orig;
        apBtn.disabled = false;
        showShopMessage(shopErrorFromException(e), true);
      }
    };
  }
}

function renderShop(data) {
  if (!stockGrid || !headerEl) return;
  currentData = data;
  clearShopMessage();
  headerEl.innerHTML = `
    <span>GOLD: ${data.gold}</span>
    <span>AP: ${data.ap}</span>
    <span>REROLL: ${data.reroll_cost}g</span>
    <button id="shop-reroll-btn">REROLL</button>
    <button id="shop-apreset-btn">AP RESET (${data.ap_reset_cost} AP)</button>
  `;
  const cards = (data.stock || []).map(renderItemCard).join('');
  const sellHtml = renderSellSection(data.can_sell_last_weapon);
  stockGrid.innerHTML = cards + sellHtml;
  attachActionListeners();
  // rebuild keyboard focus list and land on the first item
  focusables = collectFocusables();
  focusIndex = focusables.length ? 0 : -1;
  applyFocus();
}

async function refreshShop() {
  try {
    const data = await apiCall('/shop');
    renderShop(data);
  } catch (e) {
    if (stockGrid) stockGrid.innerHTML = `<div class="shop-error">Failed to load shop: ${e.message}</div>`;
  }
}

export function isShopOpen() {
  return modal ? !modal.hidden : false;
}

export function openShop() {
  createModalIfNeeded();
  if (!modal) return;
  modal.hidden = false;
  refreshShop();
  // keyboard escape handled by game-app guard + listener
}

export function closeShop() {
  if (modal) {
    modal.hidden = true;
    focusIndex = -1;
    focusables = [];
    // clear selection like other modals
    document.querySelectorAll('.location-marker').forEach(m => m.classList.remove('selected', 'visited'));
  }
}

export function initShop() {
  createModalIfNeeded();
  // global esc support if needed (game-app already wires Escape to call close if open)
  document.addEventListener('keydown', handleShopKeydown);
}

// Auto-init on module load for convenience (DOM ready later)
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShop);
  } else {
    initShop();
  }
}