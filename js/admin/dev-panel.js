/**
 * /js/admin/dev-panel.js
 * Shared admin test panel (quick-and-dirty, admin-only).
 * Leaf module per pc-coding-standards: no import from app roots.
 * Exports mountAdminButton(dockEl, { token, onRefreshWallet }).
 * Owns its state (devMode, overlay). Exposes accessors.
 * Mounts ADMIN glyph on the persistent #status-dock.
 * The AP/gold setter section lives here; existing generate sections stay in run-equip-app.js.
 */

let adminOverlay = null;
let adminStatusEl = null;
let apInput = null;
let goldInput = null;
let currentToken = null;
let onRefresh = null;

function setStatus(msg, isError = false) {
  if (adminStatusEl) {
    adminStatusEl.textContent = msg || '';
    adminStatusEl.style.color = isError ? '#ff6b6b' : '';
  }
}

function buildAdminOverlay() {
  if (adminOverlay) return adminOverlay;
  const overlay = document.createElement('div');
  overlay.id = 'admin-overlay';
  overlay.className = 'admin-overlay';
  overlay.hidden = true;
  const panel = document.createElement('div');
  panel.className = 'admin-panel';
  panel.addEventListener('click', (ev) => ev.stopPropagation());

  const head = document.createElement('div');
  head.className = 'admin-head';
  const title = document.createElement('div');
  title.className = 'panel-title';
  title.textContent = 'ADMIN';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'cancel-btn';
  close.style.marginLeft = '0';
  close.textContent = 'CLOSE';
  close.onclick = () => { overlay.hidden = true; };
  head.appendChild(title);
  head.appendChild(close);

  const status = document.createElement('div');
  status.id = 'admin-status';
  status.className = 'admin-status';
  adminStatusEl = status;

  // AP / Gold setter section (per PRD — shared panel)
  const apTitle = document.createElement('div');
  apTitle.className = 'admin-section-title';
  apTitle.textContent = 'AP / GC';
  const apRow = document.createElement('div');
  apRow.className = 'admin-row';
  const apLabel = document.createElement('label');
  apLabel.textContent = 'AP';
  apInput = document.createElement('input');
  apInput.type = 'number';
  apInput.id = 'admin-ap-input';
  apInput.min = '0';
  const apSet = document.createElement('button');
  apSet.type = 'button';
  apSet.textContent = 'Set';
  apSet.onclick = () => doSetApGold();

  const goldRow = document.createElement('div');
  goldRow.className = 'admin-row';
  const goldLabel = document.createElement('label');
  goldLabel.textContent = 'Gold';
  goldInput = document.createElement('input');
  goldInput.type = 'number';
  goldInput.id = 'admin-gold-input';
  goldInput.min = '0';
  const goldSet = document.createElement('button');
  goldSet.type = 'button';
  goldSet.textContent = 'Set';
  goldSet.onclick = () => doSetApGold();

  apRow.appendChild(apLabel);
  apRow.appendChild(apInput);
  apRow.appendChild(apSet);
  goldRow.appendChild(goldLabel);
  goldRow.appendChild(goldInput);
  goldRow.appendChild(goldSet);

  panel.appendChild(head);
  panel.appendChild(status);
  panel.appendChild(apTitle);
  panel.appendChild(apRow);
  panel.appendChild(goldRow);
  overlay.appendChild(panel);
  overlay.addEventListener('click', () => { overlay.hidden = true; });
  document.body.appendChild(overlay);
  adminOverlay = overlay;
  return overlay;
}

async function doSetApGold() {
  if (!currentToken) {
    setStatus('No token', true);
    return;
  }
  const apVal = apInput ? parseInt(apInput.value, 10) : NaN;
  const goldVal = goldInput ? parseInt(goldInput.value, 10) : NaN;
  const body = {};
  if (!isNaN(apVal)) body.ap = apVal;
  if (!isNaN(goldVal)) body.gold = goldVal;
  if (Object.keys(body).length === 0) {
    setStatus('Enter at least one value', true);
    return;
  }
  setStatus('Setting...');
  try {
    const res = await fetch('/api/combat/dev/set-ap-gold', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setStatus(err.error || `HTTP ${res.status}`, true);
      return;
    }
    const data = await res.json();
    setStatus('Updated');
    if (apInput) apInput.value = data.ap;
    if (goldInput) goldInput.value = data.gold;
    // Refresh HUD via hook
    if (onRefresh) {
      onRefresh(data);
    }
  } catch (e) {
    setStatus('Network error', true);
  }
}

export async function mountAdminButton(dockEl, { token, onRefreshWallet } = {}) {
  if (!dockEl || !token) return false;
  currentToken = token;
  onRefresh = onRefreshWallet || null;

  // Check dev mode via existing grant endpoint (reuses verifyAdmin)
  let dev;
  try {
    const res = await fetch('/api/combat/dev/grant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({})
    });
    if (!res.ok) return false;
    dev = await res.json();
  } catch (_) {
    return false;
  }
  if (!dev || dev.dev_mode !== true) return false;

  // Avoid duplicate button
  if (document.getElementById('admin-btn-dock')) return true;

  const btn = document.createElement('button');
  btn.id = 'admin-btn-dock';
  btn.className = 'admin-btn';
  btn.type = 'button';
  btn.textContent = 'ADMIN';
  btn.style.marginLeft = '8px';
  // Insert beside the gold or ap elements in the dock
  const goldEl = document.getElementById('hud-gold');
  if (goldEl && goldEl.parentNode) {
    goldEl.parentNode.insertBefore(btn, goldEl.nextSibling);
  } else {
    dockEl.appendChild(btn);
  }

  const overlay = buildAdminOverlay();
  btn.onclick = () => {
    overlay.hidden = false;
    setStatus('');
    // Prefill current values from HUD so the admin sees the live amounts
    const apText = document.getElementById('hud-ap');
    if (apText && apInput) {
      const m = apText.textContent.match(/(\d+)/);
      if (m) apInput.value = m[1];
    }
    const gText = document.getElementById('hud-gold');
    if (gText && goldInput) {
      // gold renders as "◉ 1,240gc" — strip commas so 1,240 → 1240
      const m = gText.textContent.replace(/,/g, '').match(/(\d+)/);
      if (m) goldInput.value = m[1];
    }
  };
  return true;
}

// Accessors per standards (own state)
export function getAdminState() {
  return { hasOverlay: !!adminOverlay, hasToken: !!currentToken };
}
export function clearAdminState() {
  adminOverlay = null;
  adminStatusEl = null;
  apInput = null;
  goldInput = null;
  currentToken = null;
  onRefresh = null;
}
