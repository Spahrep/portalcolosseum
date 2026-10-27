/**
 * Portal Colosseum - Shop Screen (leaf module)
 * Renders vendor1.jpg backdrop + text item cards for weapons/consumables.
 * Two views: buy (the daily stock) and sell (your owned weapons).
 * Uses apiCall to /combat/shop* endpoints. No imports from battle-app, cli-app, admin-app.
 * Exports: initShop, openShop, closeShop, isShopOpen
 *
 * Keyboard model (mouse-free, matching the game's arrow-key feel):
 *   - Top-level: arrows move across item cards + header action buttons.
 *   - Enter on a card SELECTS it (highlights it) and drops focus into that card,
 *     defaulting to its BUY button — hit Enter again to buy. While inside a
 *     card, arrows walk BUY -> attack chips -> BUY..., and Escape steps back
 *     out to card-level. Selecting/hovering an attack chip pops a floating
 *     info node (does NOT expand the card itself).
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
let cardDetailIndex = -1; // >=0 = inside a selected card, index into its BUY/chips

// --- keyboard navigation ---
// Top-level focusables: item/sell cards, then the header action buttons
// (reroll, AP reset) and the sell/back button. Attack chips are NOT top-level;
// they are reached only after Entering a card (see cardDetailFocusables).
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

// The sub-elements reachable inside a SELECTED card: its action button (BUY in
// the buy view, SELL in the sell view) first, then its attack chips.
function cardDetailFocusables(card) {
  if (!card) return [];
  const action = card.querySelector('.shop-buy-btn') || card.querySelector('.shop-sell-item-btn');
  const chips = Array.from(card.querySelectorAll('.shop-attack-chip'));
  const list = [];
  if (action) list.push(action);
  list.push(...chips);
  return list;
}

function applyFocus() {
  if (!modal) return;
  const all = modal.querySelectorAll('.shop-item-card, .shop-buy-btn, .shop-sell-item-btn, .shop-attack-chip, #shop-reroll-btn, #shop-apreset-btn, .shop-sell-btn, .shop-back-btn');
  all.forEach(el => {
    el.classList.remove('shop-focused');
    el.classList.remove('shop-child-active');
  });
  const card = focusables[focusIndex];
  if (focusIndex < 0 || focusIndex >= focusables.length || !card) {
    hideAttackPop();
    return;
  }
  card.classList.add('shop-focused');
  if (typeof card.focus === 'function') card.focus({ preventScroll: true });
  if (cardDetailIndex >= 0) {
    // inside the card — mark it selected and highlight the active child
    card.classList.add('shop-selected');
    const children = cardDetailFocusables(card);
    const child = children[cardDetailIndex];
    if (child) {
      child.classList.add('shop-child-active');
      // selecting an attack chip pops its floating info node
      if (child.classList.contains('shop-attack-chip')) {
        showAttackPop(card, child.dataset.attackIdx);
      } else {
        hideAttackPop();
      }
    }
  }
}

function moveFocus(delta) {
  if (focusIndex < 0) return;
  if (cardDetailIndex >= 0) {
    const card = focusables[focusIndex];
    const children = cardDetailFocusables(card);
    if (!children.length) {
      cardDetailIndex = -1;
      return;
    }
    cardDetailIndex = (cardDetailIndex + delta + children.length) % children.length;
    applyFocus();
    return;
  }
  if (!focusables.length) return;
  focusIndex = (focusIndex + delta + focusables.length) % focusables.length;
  applyFocus();
}

function activateFocused() {
  const el = focusables[focusIndex];
  if (!el) return;
  if (cardDetailIndex >= 0) {
    const children = cardDetailFocusables(el);
    const child = children[cardDetailIndex];
    if (!child) {
      cardDetailIndex = -1;
      applyFocus();
      return;
    }
    if (child.classList.contains('shop-buy-btn') || child.classList.contains('shop-sell-item-btn')) {
      child.click(); // second Enter on the default BUY executes the purchase
    } else if (child.classList.contains('shop-attack-chip')) {
      showAttackPop(el, child.dataset.attackIdx); // re-affirm the floating node
    }
    return;
  }
  if (el.classList.contains('shop-item-card')) {
    // Enter on an item SELECTS it (highlighted) and defaults to its BUY/SELECT
    // button; a second Enter performs the action.
    cardDetailIndex = 0;
    applyFocus();
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
    // NOTE: Escape is owned by game-app.js (the single global Escape handler).
    // It calls handleShopEscape() below; if that reports "consumed" (we stepped
    // back out of a selected card), game-app skips closing the shop.
  }
}

// Called by game-app's global Escape handler. Returns true if the Escape was
// consumed (stepped back out of a selected item card — do NOT close the shop),
// false if the shop should close normally.
export function handleShopEscape() {
  if (!isShopOpen()) return false;
  if (cardDetailIndex >= 0) {
    cardDetailIndex = -1;
    applyFocus();
    return true;
  }
  return false;
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
  // Attack-detail floating node: hovering an attack chip pops an info node that
  // floats over the screen (it may overlap other content, by design) instead of
  // expanding the card itself. Delegation survives stockGrid re-renders (chips
  // are re-created each refresh/reroll, so per-chip listeners would need
  // re-attaching every time).
  modal.addEventListener('mouseover', (e) => {
    const chip = e.target.closest('.shop-attack-chip');
    if (!chip) return;
    showAttackPop(chip.closest('.shop-item-card'), chip.dataset.attackIdx);
  });
  modal.addEventListener('mouseout', (e) => {
    const chip = e.target.closest('.shop-attack-chip');
    if (!chip) return;
    // Moving onto the floating node itself (or onto another chip) must NOT hide
    // it — the pop sits beside the card and is a legitimate hover target.
    const rt = e.relatedTarget;
    if (rt && rt.closest && (rt.closest('.shop-attack-chip') || rt.closest('.shop-attack-pop'))) return;
    const leavingIt = !rt || chip.contains(rt); // null relatedTarget (left window) => hide
    if (leavingIt) hideAttackPop();
  });
  // Hide the floating node when the mouse leaves the grid entirely.
  stockGrid.addEventListener('mouseleave', hideAttackPop);
  // Touch / tap: selecting an attack chip pops the node too (mobile has no hover).
  modal.addEventListener('pointerdown', (e) => {
    const chip = e.target.closest('.shop-attack-chip');
    if (chip) showAttackPop(chip.closest('.shop-item-card'), chip.dataset.attackIdx);
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

// --- floating attack-info node ---
// Selectable/hoverable attack chips pop a detached node that floats over the
// shop (it may overlap other cards — that is intended) instead of expanding
// the selected card's own layout.
function attackDetailHtml(a) {
  if (!a) return '';
  const parts = [];
  if (a.base_damage_multiplier != null) parts.push(`DMG ×${a.base_damage_multiplier}`);
  if (a.prepare_time_multiplier != null) parts.push(`Prep ×${a.prepare_time_multiplier}`);
  if (a.cooldown_time_multiplier != null) parts.push(`CD ×${a.cooldown_time_multiplier}`);
  if (a.crit_multiplier != null) parts.push(`Crit ×${a.crit_multiplier}`);
  if (a.is_multi_target) parts.push('<span class="shop-attack-multi">MULTI-TARGET</span>');
  const desc = a.description ? `<div class="shop-attack-desc">${a.description}</div>` : '';
  return `<div class="shop-attack-pop-stats">${parts.length ? parts.join(' • ') : 'No special stats'}</div>${desc}`;
}

// The floating pop is a persistent node inside the shop frame (declared in
// game.html as #shop-attack-pop — mirrors combat's #action-readout). We only
// fill + position it on hover/select; it never leaves the shop's stacking
// context, so it can't be lost behind other layers or trigger hover-capture.
let popEl = null;
let popFrame = null;
function ensurePopEl() {
  if (popEl) return popEl;
  popEl = document.getElementById('shop-attack-pop');
  popFrame = popEl ? popEl.parentElement : null; // .shop-frame (position:relative)
  return popEl;
}

function hideAttackPop() {
  if (popEl) popEl.hidden = true;
}

// Float the attack-info node beside the owning card, clamped within the frame.
// The pop is position:absolute inside .shop-frame, so convert the card's
// viewport rect into the frame's local coordinates.
function positionPopNear(card, el) {
  const frame = popFrame || ensurePopEl();
  const fr = frame.getBoundingClientRect();
  const r = card.getBoundingClientRect();
  const popW = 340;
  let left = Math.min(r.right - fr.left + 12, frame.clientWidth - popW - 8);
  if (left < 8) left = Math.max(8, r.left - fr.left - popW - 12);
  const top = Math.max(8, Math.min(r.top - fr.top, frame.clientHeight - 90));
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  el.style.width = popW + 'px';
}

function showAttackPop(card, idx) {
  const el = ensurePopEl();
  const slot = card?.dataset.slot;
  const item = findStockItem(slot);
  const a = idx != null ? (item?.attacks?.[Number(idx)]) : null;
  if (!a || !card || !el) {
    hideAttackPop();
    return;
  }
  const name = item?.name ? `<div class="shop-attack-pop-item">${item.name}</div>` : '';
  el.innerHTML = `<div class="shop-attack-pop-title">${a.name}</div>${name}${attackDetailHtml(a)}`;
  el.hidden = false;
  positionPopNear(card, el);
}

// Weapon cards expose their rolled attacks as focusable chips. Selecting an
// attack chip (keyboard) or hovering it (mouse) pops the floating info node;
// the card itself is never expanded.
function attackRowHtml(item) {
  if (item.kind !== 'weapon') return '';
  const attacks = item.attacks || [];
  if (!attacks.length) {
    return '<div class="shop-attack-row"><span class="shop-attack-count">0 attacks</span></div>';
  }
  const chips = attacks.map((a, i) =>
    `<span class="shop-attack-chip" tabindex="0" data-attack-idx="${i}" data-card-slot="${item.slot}">${a.name}</span>`
  ).join('');
  return `<div class="shop-attack-row"><span class="shop-attack-count">${attacks.length} attack${attacks.length > 1 ? 's' : ''}:</span> ${chips}</div>`;
}

function findStockItem(slot) {
  return (currentData?.stock || []).find(s => String(s.slot) === String(slot));
}

function renderItemCard(item) {
  const isWeapon = item.kind === 'weapon';
  const statsHtml = statsLine(item);
  const attacksHtml = isWeapon ? attackRowHtml(item) : '';
  return `
    <div class="shop-item-card" data-slot="${item.slot}" data-kind="${item.kind}" tabindex="0">
      <div class="shop-item-header">
        <span class="shop-item-name">${item.name}</span>
        ${tierBadge(item.tier)}
      </div>
      ${statsHtml}
      ${attacksHtml}
      <div class="shop-item-price">${item.buy_price}g <span class="shop-qmult">×${item.quality_multiplier}</span></div>
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
      <div class="shop-item-price">${item.sell_price}g <span class="shop-qmult">×${item.quality_multiplier}</span></div>
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
    hideAttackPop();
    focusables = collectFocusables();
    focusIndex = focusables.length ? 0 : -1;
    cardDetailIndex = -1;
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
  hideAttackPop();
  // rebuild keyboard focus list and land on the first item
  focusables = collectFocusables();
  focusIndex = focusables.length ? 0 : -1;
  cardDetailIndex = -1;
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
    cardDetailIndex = -1;
    hideAttackPop();
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