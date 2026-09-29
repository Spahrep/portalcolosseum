/**
 * Portal Colosseum - Admin GUI Application
 * =========================================
 * Vanilla JS matching login-app.js / game-app.js patterns.
 * All data via /api/admin/* routes with JWT verification.
 * Service-role key NEVER touches the client.
 */

import { supabaseClient } from '../js/utils.js';

// === SUPABASE CONFIGURATION ===
const SUPABASE_URL = window.ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV.SUPABASE_ANON_KEY;

let supabase;
let currentTab = null;
let allAttacks = []; // cached for dropdowns

// ============================================================
// INIT & AUTH
// ============================================================

function initSupabase() {
  supabase = supabaseClient();
}

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function apiCall(endpoint, method = 'GET', body = null) {
  const token = await getToken();
  if (!token) { window.location.reload(); return; }
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const res = await fetch(endpoint, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });
  if (res.status === 401 || res.status === 403) {
    showAccessDenied();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function checkAdminSession() {
  // Handle PKCE OAuth redirect
  if (window.location.search.includes('code=')) {
    await supabase.auth.getSession();
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    showLoginGate();
    return;
  }

  // Persist session via HttpOnly cookie (same pattern as game-app.js)
  if (session.refresh_token) {
    try {
      await fetch('/api/session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
    } catch (_err) { /* non-fatal */ }
  }

  // Verify admin via API
  try {
    const res = await fetch('/api/admin/auth-check', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });
    if (res.ok) {
      showDashboard();
    } else {
      const body = await res.json().catch(() => ({}));
      document.getElementById('login-gate').classList.remove('hidden');
      document.getElementById('admin-dashboard').classList.add('hidden');
      document.getElementById('auth-message').textContent = `Access denied (${res.status}): ${JSON.stringify(body)}`;
      console.log('Auth check failed:', body);
    }
  } catch (err) {
    document.getElementById('auth-message').textContent = `Error: ${err.message}`;
  }
}

function showLoginGate() {
  document.getElementById('login-gate').classList.remove('hidden');
  document.getElementById('admin-dashboard').classList.add('hidden');
}

function showAccessDenied() {
  document.getElementById('login-gate').classList.remove('hidden');
  document.getElementById('admin-dashboard').classList.add('hidden');
  document.getElementById('auth-message').textContent = 'Session expired or access denied. Please log in again.';
}

function showDashboard() {
  document.getElementById('login-gate').classList.add('hidden');
  document.getElementById('admin-dashboard').classList.remove('hidden');
  setupTabs();
}

function setupOAuthButtons() {
  document.getElementById('google-login-btn')?.addEventListener('click', () => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/admin' },
    });
  });
  document.getElementById('github-login-btn')?.addEventListener('click', () => {
    supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin + '/admin' },
    });
  });
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    try { await fetch('/api/session', { method: 'DELETE', credentials: 'include' }); } catch {}
    localStorage.removeItem('supabase.auth.token');
    window.location.reload();
  });
}

// ============================================================
// TAB NAVIGATION
// ============================================================

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadTab(btn.dataset.tab);
    });
  });
  document.querySelector('.tab-btn[data-tab="attacks"]').classList.add('active');
  loadTab('attacks');
}

async function loadTab(tab) {
  currentTab = tab;
  const content = document.getElementById('tab-content');
  content.innerHTML = '<p>Loading...</p>';
  try {
    // Cache attacks for dropdowns
    if (allAttacks.length === 0) {
      const res = await apiCall('/api/admin/attacks');
      allAttacks = res.data || [];
    }
    if (tab === 'attacks') await renderAttacks(content);
    else if (tab === 'weapon-templates') await renderWeaponTemplates(content);
    else if (tab === 'monster-templates') await renderMonsterTemplates(content);
    else if (tab === 'portal-templates') await renderPortalTemplates(content);
    else if (tab === 'consumable-templates') await renderConsumableTemplates(content);
  } catch (e) {
    content.innerHTML = `<p class="error">Error: ${e.message}</p>`;
  }
}

// ============================================================
// ATTACKS TAB
// ============================================================

async function renderAttacks(container) {
  container.innerHTML = `
    <h2>Attacks</h2>
    <button class="btn" id="create-attack-btn">+ Create New Attack</button>
    <div id="attack-form-container"></div>
    <table>
      <thead><tr><th>Name</th><th>Dmg Mult</th><th>Mult Range</th><th>Prep</th><th>Prep Range</th><th>Cooldown</th><th>Cooldown Range</th><th>Multi?</th><th>Weight</th><th>Crit Factor</th><th>Crit Mult</th><th>Actions</th></tr></thead>
      <tbody id="attacks-tbody"></tbody>
    </table>
  `;
  document.getElementById('create-attack-btn').addEventListener('click', () => showAttackForm());

  const attacks = allAttacks;
  const tbody = document.getElementById('attacks-tbody');
  attacks.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(a.name)}</td>
      <td>${a.base_damage_multiplier}</td>
      <td>${a.base_damage_multiplier_range ?? 0}</td>
      <td>${a.prepare_time}</td>
      <td>${a.prepare_time_range ?? 0}</td>
      <td>${a.cooldown_time}</td>
      <td>${a.cooldown_time_range ?? 0}</td>
      <td>${a.is_multi_target ? '✓' : ''}</td>
      <td>${a.weight}</td>
      <td>${a.crit_factor ?? 1.0}</td>
      <td>${a.crit_multiplier ?? 2.0}</td>
      <td>
        <button class=\"btn\" data-edit=\"${a.id}\">Edit</button>
        <button class=\"btn btn-danger\" data-delete=\"${a.id}\">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => showAttackForm(btn.dataset.edit));
  });
  tbody.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteAttack(btn.dataset.delete));
  });
}

function showAttackForm(id = null) {
  const container = document.getElementById('attack-form-container');
  const attack = id ? allAttacks.find(a => String(a.id) === String(id)) : {};
  const isEdit = !!id;

  container.innerHTML = `
    <div class="form-card">
      <h3>${isEdit ? 'Edit Attack' : 'Create Attack'}</h3>
      <div class="form-group"><label>Name</label><input id="f-name" value="${esc(attack.name || '')}"></div>
      <div class="form-group"><label>Description</label><textarea id="f-description" rows="2">${esc(attack.description || '')}</textarea></div>
      <div class="form-group">
      <div class="form-group"><label>Base Damage Multiplier</label><input id="f-base_damage_multiplier" type="number" step="0.1" value="${attack.base_damage_multiplier ?? 1.0}"></div>
      <div class="form-group"><label>Mult Range (±)</label><input id="f-base_damage_multiplier_range" type="number" step="0.1" value="${attack.base_damage_multiplier_range ?? 0}"></div>
      <div class="form-group">
        <label>Band Preview</label>
        <div id="f-band-preview" style="background:#0a1428; border:1px solid #ff6b3b; padding:6px 10px; font-family:monospace; font-size:13px; min-height:20px;"></div>
      </div>
      <div class="form-group"><label>Prepare Time</label><input id="f-prepare_time" type="number" value="${attack.prepare_time ?? 10}"></div>
      <div class="form-group"><label>Prep Time Range (±)</label><input id="f-prepare_time_range" type="number" value="${attack.prepare_time_range ?? 0}"></div>
      <div class="form-group"><label>Cooldown Time</label><input id="f-cooldown_time" type="number" value="${attack.cooldown_time ?? 10}"></div>
      <div class="form-group"><label>Cooldown Time Range (±)</label><input id="f-cooldown_time_range" type="number" value="${attack.cooldown_time_range ?? 0}"></div>
      <div class="form-group"><label><input id="f-is_multi_target" type="checkbox" ${attack.is_multi_target ? 'checked' : ''}> Multi Target</label></div>
      <div class="form-group"><label>Weight</label><input id="f-weight" type="number" step="0.1" value="${attack.weight ?? 1.0}"></div>
      <div class="form-group"><label>Crit Factor (× chance)</label><input id="f-crit_factor" type="number" step="0.1" value="${attack.crit_factor ?? 1.0}"></div>
      <div class="form-group"><label>Crit Multiplier (× dmg)</label><input id="f-crit_multiplier" type="number" step="0.1" value="${attack.crit_multiplier ?? 2.0}"></div>
      <button class="btn" id="save-attack-btn">${isEdit ? 'Update' : 'Create'}</button>
      <button class="btn btn-secondary" id="cancel-attack-btn">Cancel</button>
    </div>
  `;

  document.getElementById('cancel-attack-btn').addEventListener('click', () => { container.innerHTML = ''; });

  // Live band preview for damage multiplier
  function updateBandPreview() {
    const base = parseFloat(val('f-base_damage_multiplier')) || 0;
    const range = parseFloat(val('f-base_damage_multiplier_range')) || 0;
    const lo = Math.max(0, (base - range).toFixed(1));
    const hi = (base + range).toFixed(1);
    const el = document.getElementById('f-band-preview');
    if (el) el.textContent = range > 0 ? `${base} ± ${range} → ${lo}–${hi}` : `${base} (no variance)`;
  }
  ['f-base_damage_multiplier', 'f-base_damage_multiplier_range'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateBandPreview);
  });
  updateBandPreview();

  document.getElementById('save-attack-btn').addEventListener('click', async () => {
    const body = {
      name: val('f-name'),
      description: val('f-description') || null,
      base_damage_multiplier: parseFloat(val('f-base_damage_multiplier')),
      base_damage_multiplier_range: parseFloat(val('f-base_damage_multiplier_range')),
      prepare_time: parseInt(val('f-prepare_time')),
      prepare_time_range: parseInt(val('f-prepare_time_range')),
      cooldown_time: parseInt(val('f-cooldown_time')),
      cooldown_time_range: parseInt(val('f-cooldown_time_range')),
      is_multi_target: document.getElementById('f-is_multi_target').checked,
      weight: parseFloat(val('f-weight')),
      crit_factor: parseFloat(val('f-crit_factor')),
      crit_multiplier: parseFloat(val('f-crit_multiplier')),
    };
    try {
      if (isEdit) {
        await apiCall(`/api/admin/attacks/${id}`, 'PUT', body);
      } else {
        await apiCall('/api/admin/attacks', 'POST', body);
      }
      // Refresh cached attacks
      const res = await apiCall('/api/admin/attacks');
      allAttacks = res.data || [];
      container.innerHTML = '';
      loadTab(currentTab);
    } catch (e) {
      alert('Error: ' + e.message);
    }
  });
}

async function deleteAttack(id) {
  if (!confirm('Delete this attack? This will be blocked if other records reference it.')) return;
  try {
    await apiCall(`/api/admin/attacks/${id}`, 'DELETE');
    allAttacks = allAttacks.filter(a => String(a.id) !== String(id));
    loadTab(currentTab);
  } catch (e) {
    alert('Delete blocked: ' + e.message);
  }
}

// ============================================================
// WEAPON TEMPLATES TAB
// ============================================================

async function renderWeaponTemplates(container) {
  container.innerHTML = `
    <h2>Weapon Templates</h2>
    <button class="btn" id="create-wt-btn">+ Create New Weapon Template</button>
    <div id="wt-form-container"></div>
    <div id="wt-mapping-container"></div>
    <table>
      <thead><tr><th>Name</th><th>Dmg (base ± range)</th><th>Speed (base ± range)</th><th>Accuracy (base ± range)</th><th>Crit (base ± range)</th><th>Slot 0 Attack</th><th>Actions</th></tr></thead>
      <tbody id="wt-tbody"></tbody>
    </table>
  `;
  document.getElementById('create-wt-btn').addEventListener('click', () => showWeaponTemplateForm());

  const res = await apiCall('/api/admin/weapon-templates');
  const templates = res.data || [];
  const tbody = document.getElementById('wt-tbody');
  templates.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(t.name)}</td>
      <td>${t.base_damage} ± ${t.damage_range}</td>
      <td>${t.base_speed} ± ${t.speed_range}</td>
      <td>${t.base_accuracy} ± ${t.accuracy_range}</td>
      <td>${t.crit_base ?? 5} ± ${t.crit_range ?? 0}</td>
      <td>${t.slot_0_attack?.name ? esc(t.slot_0_attack.name) : '<span class="muted">—</span>'}</td>
      <td>
        <button class="btn" data-edit="${t.id}">Edit</button>
        <button class="btn" data-mappings="${t.id}">Attack Mappings</button>
        <button class="btn btn-danger" data-delete="${t.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => showWeaponTemplateForm(btn.dataset.edit));
  });
  tbody.querySelectorAll('[data-mappings]').forEach(btn => {
    btn.addEventListener('click', () => showWeaponMappingEditor(btn.dataset.mappings));
  });
  tbody.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteWeaponTemplate(btn.dataset.delete));
  });
}

function showWeaponTemplateForm(id = null) {
  const container = document.getElementById('wt-form-container');
  // Fetch the template if editing
  apiCall('/api/admin/weapon-templates').then(res => {
    const templates = res.data || [];
    const t = id ? templates.find(x => String(x.id) === String(id)) : {};

    container.innerHTML = `
      <div class="form-card">
        <h3>${id ? 'Edit Weapon Template' : 'Create Weapon Template'}</h3>
        <div class="form-group"><label>Name</label><input id="wt-name" value="${esc(t.name || '')}"></div>
        <div class="form-group"><label>Base Damage</label><input id="wt-base_damage" type="number" value="${t.base_damage ?? ''}"></div>
        <div class="form-group"><label>Damage Range</label><input id="wt-damage_range" type="number" value="${t.damage_range ?? 0}"></div>
        <div class="form-group"><label>Base Speed (lower=faster)</label><input id="wt-base_speed" type="number" value="${t.base_speed ?? ''}"></div>
        <div class="form-group"><label>Speed Range</label><input id="wt-speed_range" type="number" value="${t.speed_range ?? 0}"></div>
        <div class="form-group"><label>Base Accuracy</label><input id="wt-base_accuracy" type="number" value="${t.base_accuracy ?? ''}"></div>
        <div class="form-group"><label>Accuracy Range</label><input id="wt-accuracy_range" type="number" value="${t.accuracy_range ?? 0}"></div>
        <div class="form-group"><label>Base Crit %</label><input id="wt-crit_base" type="number" value="${t.crit_base ?? 5}"></div>
        <div class="form-group"><label>Crit Range</label><input id="wt-crit_range" type="number" value="${t.crit_range ?? 0}"></div>
        <div class="form-group">
          <label>Slot 0 Attack (default)</label>
          <select id="wt-slot_0_attack_id">
            ${allAttacks.map(a => `<option value="${a.id}" ${t.slot_0_attack_id === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Slot 1 Chance (0.0-1.0)</label><input id="wt-slot_1_chance" type="number" step="0.1" value="${t.slot_1_chance ?? 1.0}"></div>
        <div class="form-group"><label>Slot 2 Chance</label><input id="wt-slot_2_chance" type="number" step="0.1" value="${t.slot_2_chance ?? 0.8}"></div>
        <div class="form-group"><label>Slot 3 Chance</label><input id="wt-slot_3_chance" type="number" step="0.1" value="${t.slot_3_chance ?? 0.4}"></div>
        <div class="form-group"><label>Slot 4 Chance</label><input id="wt-slot_4_chance" type="number" step="0.1" value="${t.slot_4_chance ?? 0.0}"></div>
        <button class="btn" id="save-wt-btn">${id ? 'Update' : 'Create'}</button>
        <button class="btn btn-secondary" id="cancel-wt-btn">Cancel</button>
      </div>
    `;

    document.getElementById('cancel-wt-btn').addEventListener('click', () => { container.innerHTML = ''; });
    document.getElementById('save-wt-btn').addEventListener('click', async () => {
      const body = {
        name: val('wt-name'),
        base_damage: parseInt(val('wt-base_damage')),
        damage_range: parseInt(val('wt-damage_range')),
        base_speed: parseInt(val('wt-base_speed')),
        speed_range: parseInt(val('wt-speed_range')),
        base_accuracy: parseInt(val('wt-base_accuracy')),
        accuracy_range: parseInt(val('wt-accuracy_range')),
        crit_base: parseInt(val('wt-crit_base')),
        crit_range: parseInt(val('wt-crit_range')),
        slot_0_attack_id: parseInt(val('wt-slot_0_attack_id')),
        slot_1_chance: parseFloat(val('wt-slot_1_chance')),
        slot_2_chance: parseFloat(val('wt-slot_2_chance')),
        slot_3_chance: parseFloat(val('wt-slot_3_chance')),
        slot_4_chance: parseFloat(val('wt-slot_4_chance')),
      };
      try {
        if (id) await apiCall(`/api/admin/weapon-templates/${id}`, 'PUT', body);
        else await apiCall('/api/admin/weapon-templates', 'POST', body);
        container.innerHTML = '';
        loadTab(currentTab);
      } catch (e) { alert('Error: ' + e.message); }
    });
  });
}

async function deleteWeaponTemplate(id) {
  if (!confirm('Delete this weapon template?')) return;
  try {
    await apiCall(`/api/admin/weapon-templates/${id}`, 'DELETE');
    loadTab(currentTab);
  } catch (e) { alert('Delete blocked: ' + e.message); }
}

// ============================================================
// SHARED MAPPING EDITOR
// One form builder for the five mapping editors. Callers fetch
// and group data; this owns the shared HTML and event wiring.
// Template whitespace is load-bearing — it must match the
// previous per-editor markup exactly (ids, classes, options).
// layout 'slots' — attack slot tables (weapon, monster).
// layout 'pool'  — single cost/weight table (loot, portal monsters).
// ============================================================

async function renderMappingEditor(container, spec) {
  container.innerHTML = `<p>${spec.loadingText}</p>`;

  try {
    const view = await spec.load();
    container.innerHTML = view.layout === 'slots'
      ? buildSlotMappingEditorHtml(view)
      : buildPoolMappingEditorHtml(view);
    wireMappingEditor(container, view, spec);
  } catch (e) {
    container.innerHTML = `<p class="error">${spec.errorText}: ${e.message}</p>`;
  }
}

function buildSlotMappingEditorHtml(view) {
  let html = `
      <div class="form-card mapping-editor">
        <h3>${view.title}</h3>
        <p class="muted">${view.subtitles[0]}</p>
        <p class="muted">${view.subtitles[1]}</p>\n    `;

  for (const slot of view.slots) {
    html += `
        <div class="mapping-slot">
          <h4>Slot ${slot.number} <span class="muted">(chance: ${slot.chance}%)</span></h4>
          <table>
            <thead><tr><th>Attack Name</th><th>Weight</th><th>Actions</th></tr></thead>
            <tbody>\n      `;
    for (const row of slot.rows) {
      html += `
          <tr>
            <td>${row.name}</td>
            <td><input type="number" step="0.1" value="${row.weight}" data-mapping-id="${row.id}" class="weight-input"></td>
            <td><button class="btn btn-danger" data-remove-mapping="${row.id}">Remove</button></td>
          </tr>\n        `;
    }
    if (slot.rows.length === 0) html += '<tr><td colspan="5" class="muted">No attacks assigned to this slot</td></tr>';
    const options = slot.options.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
    html += `
        <tr class="add-attack-row">
          <td>
            <select id="${view.selectIdPrefix}${slot.number}">
              <option value="">— Add attack to Slot ${slot.number} —</option>
              ${options}
            </select>
          </td>
          <td></td>
          <td><button class="btn" data-add-to-slot="${slot.number}">Add</button></td>
        </tr>
        </tbody></table>
        </div>\n      `;
  }

  html += `<button class="btn btn-secondary" id="${view.closeButtonId}">Close</button></div>`;
  return html;
}

function buildPoolMappingEditorHtml(view) {
  let html = `
      <div class="form-card mapping-editor">
        <h3>${view.title}</h3>
        <p class="muted">${view.subtitle}</p>
        <table>
          <thead><tr>${view.headHtml}</tr></thead>
          <tbody>\n    `;

  for (const row of view.rows) {
    html += `
        <tr>
          <td>${row.name}</td>
          <td><input type="number" value="${row.cost}" data-mapping-id="${row.id}" class="cost-input"></td>
          <td><input type="number" step="0.1" value="${row.weight}" data-mapping-id="${row.id}" class="weight-input"></td>
          <td><button class="btn btn-danger" data-remove-mapping="${row.id}">Remove</button></td>
        </tr>\n      `;
  }
  if (view.rows.length === 0) html += `<tr><td colspan="4" class="muted">${view.emptyText}</td></tr>`;

  const add = view.add;
  const options = add.options.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  html += `
      <tr class="${add.rowClass}">
        <td>
          <select id="${add.selectId}">
            <option value="">${add.placeholder}</option>
            ${options}
          </select>
        </td>
        <td><input type="number" id="${add.costInputId}" placeholder="${add.costPlaceholder}" value="10"></td>
        <td><input type="number" id="${add.weightInputId}" placeholder="Weight" step="0.1" value="1.0"></td>
        <td><button class="btn" id="${add.buttonId}">Add</button></td>
      </tr>\n`;
  if (add.closeLayout === 'split') {
    html += `      </tbody>
    </table>
    <button class="btn btn-secondary" id="${view.closeButtonId}">Close</button>
    </div>\n    `;
  } else {
    html += `      </tbody></table>
      <button class="btn btn-secondary" id="${view.closeButtonId}">Close</button>
    </div>\n    `;
  }
  return html;
}

function wireMappingEditor(container, view, spec) {
  document.getElementById(view.closeButtonId).addEventListener('click', () => { container.innerHTML = ''; });

  if (view.layout === 'slots') {
    container.querySelectorAll('.weight-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        const mappingId = e.target.dataset.mappingId;
        const weight = parseFloat(e.target.value);
        try {
          await spec.onWeightChange(mappingId, weight);
        } catch (err) { alert('Error updating weight: ' + err.message); }
      });
    });

    container.querySelectorAll('[data-remove-mapping]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(spec.removeConfirm)) return;
        try {
          await spec.onRemove(btn.dataset.removeMapping);
          spec.refresh();
        } catch (e) { alert('Error: ' + e.message); }
      });
    });

    container.querySelectorAll('[data-add-to-slot]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const slot = parseInt(btn.dataset.addToSlot);
        const select = document.getElementById(`${view.selectIdPrefix}${slot}`);
        const attackId = parseInt(select.value);
        if (!attackId) return;
        try {
          await spec.onAddSlot(slot, attackId);
          spec.refresh();
        } catch (e) { alert('Error: ' + e.message); }
      });
    });
    return;
  }

  container.querySelectorAll('.cost-input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const mappingId = e.target.dataset.mappingId;
      const cost = parseInt(e.target.value);
      const row = e.target.closest('tr');
      const weightInput = row.querySelector('.weight-input');
      const weight = parseFloat(weightInput.value);
      try {
        await spec.onPoolChange(mappingId, cost, weight);
      } catch (err) { alert('Error updating: ' + err.message); }
    });
  });
  container.querySelectorAll('.weight-input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const mappingId = e.target.dataset.mappingId;
      const weight = parseFloat(e.target.value);
      const row = e.target.closest('tr');
      const costInput = row.querySelector('.cost-input');
      const cost = parseInt(costInput.value);
      try {
        await spec.onPoolChange(mappingId, cost, weight);
      } catch (err) { alert('Error updating: ' + err.message); }
    });
  });

  container.querySelectorAll('[data-remove-mapping]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(spec.removeConfirm)) return;
      try {
        await spec.onRemove(btn.dataset.removeMapping);
        spec.refresh();
      } catch (e) { alert('Error: ' + e.message); }
    });
  });

  document.getElementById(view.add.buttonId).addEventListener('click', async () => {
    const itemId = parseInt(document.getElementById(view.add.selectId).value);
    if (!itemId) return;
    const cost = parseInt(document.getElementById(view.add.costInputId).value);
    const weight = parseFloat(document.getElementById(view.add.weightInputId).value);
    try {
      await spec.onAddPool(itemId, cost, weight);
      spec.refresh();
    } catch (e) { alert('Error: ' + e.message); }
  });
}

// ============================================================
// WEAPON TEMPLATE — ATTACK MAPPING EDITOR (PRIMARY FEATURE)
// ============================================================

async function showWeaponMappingEditor(templateId) {
  const container = document.getElementById('wt-mapping-container');
  return renderMappingEditor(container, {
    loadingText: 'Loading mappings...',
    errorText: 'Error loading mappings',
    removeConfirm: 'Remove this attack from the slot?',
    refresh: () => showWeaponMappingEditor(templateId),
    async load() {
      // Fetch template details and mappings
      const [templateRes, mappingRes] = await Promise.all([
        apiCall(`/api/admin/weapon-templates/${templateId}`),
        apiCall(`/api/admin/weapon-templates/${templateId}/mappings`),
      ]);
      const template = templateRes.data;
      const mappings = mappingRes.data || [];

      // Group mappings by slot
      const bySlot = { 1: [], 2: [], 3: [] };
      mappings.forEach(m => { if (bySlot[m.slot]) bySlot[m.slot].push(m); });

      return {
        layout: 'slots',
        title: `Attack Mappings — ${esc(template.name)}`,
        subtitles: [
          `Base stats: Damage ${template.base_damage}±${template.damage_range} · Speed ${template.base_speed}±${template.speed_range} · Accuracy ${template.base_accuracy}±${template.accuracy_range} · Crit ${template.crit_base ?? 5}±${template.crit_range ?? 0}`,
          `Slot 0 (always): ${template.slot_0_attack?.name ? esc(template.slot_0_attack.name) : '—'} · S1: ${(template.slot_1_chance*100)}% · S2: ${(template.slot_2_chance*100)}% · S3: ${(template.slot_3_chance*100)}% · S4: ${(template.slot_4_chance*100)}%`,
        ],
        selectIdPrefix: 'add-attack-slot-',
        closeButtonId: 'close-mapping-btn',
        slots: [1, 2, 3].map(slot => {
          const usedIds = bySlot[slot].map(m => m.attack_id);
          const available = allAttacks.filter(a => !usedIds.includes(a.id));
          return {
            number: slot,
            chance: (template['slot_' + slot + '_chance'] * 100).toFixed(0),
            rows: bySlot[slot].map(m => ({
              name: esc(m.attack?.name || 'Unknown'),
              weight: m.weight,
              id: m.id,
            })),
            options: available.map(a => ({ value: a.id, label: esc(a.name) })),
          };
        }),
      };
    },
    onWeightChange(mappingId, weight) {
      return apiCall(`/api/admin/weapon-templates/${templateId}/mappings/${mappingId}`, 'PATCH', { weight });
    },
    onRemove(mappingId) {
      return apiCall(`/api/admin/weapon-templates/${templateId}/mappings/${mappingId}`, 'DELETE');
    },
    onAddSlot(slot, attackId) {
      return apiCall(`/api/admin/weapon-templates/${templateId}/mappings`, 'POST', {
        attack_id: attackId, slot, weight: 1.0,
      });
    },
  });
}

// ============================================================
// MONSTER TEMPLATES TAB
// ============================================================

async function renderMonsterTemplates(container) {
  container.innerHTML = `
    <h2>Monster Templates</h2>
    <button class="btn" id="create-mt-btn">+ Create New Monster Template</button>
    <div id="mt-form-container"></div>
    <div id="mt-mapping-container"></div>
    <table>
      <thead><tr><th>Name</th><th>Dmg (base ± range)</th><th>Speed (base ± range)</th><th>Accuracy (base ± range)</th><th>Crit (base ± range)</th><th>Slot 0 Attack</th><th>Actions</th></tr></thead>
      <tbody id="mt-tbody"></tbody>
    </table>
  `;
  document.getElementById('create-mt-btn').addEventListener('click', () => showMonsterTemplateForm());

  const res = await apiCall('/api/admin/monster-templates');
  const templates = res.data || [];
  const tbody = document.getElementById('mt-tbody');
  templates.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(t.name)}</td>
      <td>${t.base_damage} ± ${t.damage_range}</td>
      <td>${t.base_speed} ± ${t.speed_range}</td>
      <td>${t.base_accuracy} ± ${t.accuracy_range}</td>
      <td>${t.crit_base ?? 5} ± ${t.crit_range ?? 0}</td>
      <td>${t.slot_0_attack?.name ? esc(t.slot_0_attack.name) : '<span class="muted">—</span>'}</td>
      <td>
        <button class="btn" data-edit="${t.id}">Edit</button>
        <button class="btn" data-mappings="${t.id}">Attack Mappings</button>
        <button class="btn" data-loot="${t.id}">Loot Mappings</button>
        <button class="btn btn-danger" data-delete="${t.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => showMonsterTemplateForm(btn.dataset.edit));
  });
  tbody.querySelectorAll('[data-mappings]').forEach(btn => {
    btn.addEventListener('click', () => showMonsterMappingEditor(btn.dataset.mappings));
  });
  tbody.querySelectorAll('[data-loot]').forEach(btn => {
    btn.addEventListener('click', () => showMonsterLootMappingEditor(btn.dataset.loot));
  });
  tbody.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteMonsterTemplate(btn.dataset.delete));
  });
}

function showMonsterTemplateForm(id = null) {
  const container = document.getElementById('mt-form-container');
  apiCall('/api/admin/monster-templates').then(res => {
    const templates = res.data || [];
    const t = id ? templates.find(x => String(x.id) === String(id)) : {};

    container.innerHTML = `
      <div class="form-card">
        <h3>${id ? 'Edit Monster Template' : 'Create Monster Template'}</h3>
        <div class="form-group"><label>Name</label><input id="mt-name" value="${esc(t.name || '')}"></div>
        <div class="form-group"><label>Base Damage</label><input id="mt-base_damage" type="number" value="${t.base_damage ?? ''}"></div>
        <div class="form-group"><label>Damage Range</label><input id="mt-damage_range" type="number" value="${t.damage_range ?? 0}"></div>
        <div class="form-group"><label>Base Speed</label><input id="mt-base_speed" type="number" value="${t.base_speed ?? ''}"></div>
        <div class="form-group"><label>Speed Range</label><input id="mt-speed_range" type="number" value="${t.speed_range ?? 0}"></div>
        <div class="form-group"><label>Base Accuracy</label><input id="mt-base_accuracy" type="number" value="${t.base_accuracy ?? ''}"></div>
        <div class="form-group"><label>Accuracy Range</label><input id="mt-accuracy_range" type="number" value="${t.accuracy_range ?? 0}"></div>
        <div class="form-group"><label>Base Crit %</label><input id="mt-crit_base" type="number" value="${t.crit_base ?? 5}"></div>
        <div class="form-group"><label>Crit Range</label><input id="mt-crit_range" type="number" value="${t.crit_range ?? 0}"></div>
        <div class="form-group">
          <label>Slot 0 Attack</label>
          <select id="mt-slot_0_attack_id">
            ${allAttacks.map(a => `<option value="${a.id}" ${t.slot_0_attack_id === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Slot 1 Chance (0.0-1.0)</label><input id="mt-slot_1_chance" type="number" step="0.1" value="${t.slot_1_chance ?? 0}"></div>
        <div class="form-group"><label>Slot 2 Chance</label><input id="mt-slot_2_chance" type="number" step="0.1" value="${t.slot_2_chance ?? 0}"></div>
        <div class="form-group"><label>Slot 3 Chance</label><input id="mt-slot_3_chance" type="number" step="0.1" value="${t.slot_3_chance ?? 0}"></div>
        <div class="form-group"><label>Slot 4 Chance</label><input id="mt-slot_4_chance" type="number" step="0.1" value="${t.slot_4_chance ?? 0}"></div>
        <div class="form-group"><label>Min Gold</label><input id="mt-min_gold" type="number" value="${t.min_gold ?? 0}"></div>
        <div class="form-group"><label>Max Gold</label><input id="mt-max_gold" type="number" value="${t.max_gold ?? 0}"></div>
        <button class="btn" id="save-mt-btn">${id ? 'Update' : 'Create'}</button>
        <button class="btn btn-secondary" id="cancel-mt-btn">Cancel</button>
      </div>
    `;

    document.getElementById('cancel-mt-btn').addEventListener('click', () => { container.innerHTML = ''; });
    document.getElementById('save-mt-btn').addEventListener('click', async () => {
      const body = {
        name: val('mt-name'),
        base_damage: parseInt(val('mt-base_damage')),
        damage_range: parseInt(val('mt-damage_range')),
        base_speed: parseInt(val('mt-base_speed')),
        speed_range: parseInt(val('mt-speed_range')),
        base_accuracy: parseInt(val('mt-base_accuracy')),
        accuracy_range: parseInt(val('mt-accuracy_range')),
        crit_base: parseInt(val('mt-crit_base')),
        crit_range: parseInt(val('mt-crit_range')),
        slot_0_attack_id: parseInt(val('mt-slot_0_attack_id')),
        slot_1_chance: parseFloat(val('mt-slot_1_chance')),
        slot_2_chance: parseFloat(val('mt-slot_2_chance')),
        slot_3_chance: parseFloat(val('mt-slot_3_chance')),
        slot_4_chance: parseFloat(val('mt-slot_4_chance')),
        min_gold: parseInt(val('mt-min_gold')),
        max_gold: parseInt(val('mt-max_gold')),
      };
      try {
        if (id) await apiCall(`/api/admin/monster-templates/${id}`, 'PUT', body);
        else await apiCall('/api/admin/monster-templates', 'POST', body);
        container.innerHTML = '';
        loadTab(currentTab);
      } catch (e) { alert('Error: ' + e.message); }
    });
  });
}

async function deleteMonsterTemplate(id) {
  if (!confirm('Delete this monster template?')) return;
  try {
    await apiCall(`/api/admin/monster-templates/${id}`, 'DELETE');
    loadTab(currentTab);
  } catch (e) { alert('Delete blocked: ' + e.message); }
}

// ============================================================
// MONSTER TEMPLATE — ATTACK MAPPING EDITOR
// ============================================================

async function showMonsterMappingEditor(templateId) {
  const container = document.getElementById('mt-mapping-container');
  return renderMappingEditor(container, {
    loadingText: 'Loading mappings...',
    errorText: 'Error loading mappings',
    removeConfirm: 'Remove this attack from the slot?',
    refresh: () => showMonsterMappingEditor(templateId),
    async load() {
      const [templateRes, mappingRes] = await Promise.all([
        apiCall(`/api/admin/monster-templates/${templateId}`),
        apiCall(`/api/admin/monster-templates/${templateId}/mappings`),
      ]);
      const template = templateRes.data;
      const mappings = mappingRes.data || [];

      const bySlot = { 1: [], 2: [], 3: [], 4: [] };
      mappings.forEach(m => { if (bySlot[m.slot]) bySlot[m.slot].push(m); });

      return {
        layout: 'slots',
        title: `Attack Mappings — ${esc(template.name)}`,
        subtitles: [
          `Base stats: Damage ${template.base_damage}±${template.damage_range} · Speed ${template.base_speed}±${template.speed_range} · Accuracy ${template.base_accuracy}±${template.accuracy_range} · Crit ${template.crit_base ?? 5}±${template.crit_range ?? 0}`,
          `Slot 0 (always): ${template.slot_0_attack?.name ? esc(template.slot_0_attack.name) : '—'}`,
        ],
        selectIdPrefix: 'mt-add-attack-slot-',
        closeButtonId: 'mt-close-mapping-btn',
        slots: [1, 2, 3, 4].map(slot => {
          const usedIds = bySlot[slot].map(m => m.attack_id);
          const available = allAttacks.filter(a => !usedIds.includes(a.id));
          return {
            number: slot,
            chance: (template['slot_' + slot + '_chance'] * 100).toFixed(0),
            rows: bySlot[slot].map(m => ({
              name: esc(m.attack?.name || 'Unknown'),
              weight: m.weight,
              id: m.id,
            })),
            options: available.map(a => ({ value: a.id, label: esc(a.name) })),
          };
        }),
      };
    },
    onWeightChange(mappingId, weight) {
      return apiCall(`/api/admin/monster-templates/${templateId}/mappings/${mappingId}`, 'PATCH', { weight });
    },
    onRemove(mappingId) {
      return apiCall(`/api/admin/monster-templates/${templateId}/mappings/${mappingId}`, 'DELETE');
    },
    onAddSlot(slot, attackId) {
      return apiCall(`/api/admin/monster-templates/${templateId}/mappings`, 'POST', {
        attack_id: attackId, slot, weight: 1.0,
      });
    },
  });
}

// ============================================================
// MONSTER TEMPLATE — LOOT MAPPING EDITOR
// ============================================================

async function showMonsterLootMappingEditor(templateId) {
  const container = document.getElementById('mt-mapping-container');
  return renderMappingEditor(container, {
    loadingText: 'Loading loot mappings...',
    errorText: 'Error loading loot mappings',
    removeConfirm: 'Remove this loot item from the monster?',
    refresh: () => showMonsterLootMappingEditor(templateId),
    async load() {
      const [templateRes, lootRes, weaponRes] = await Promise.all([
        apiCall(`/api/admin/monster-templates/${templateId}`),
        apiCall(`/api/admin/monster-templates/${templateId}/loot`),
        apiCall('/api/admin/weapon-templates'),
      ]);
      const template = templateRes.data;
      const mappings = lootRes.data || [];
      const allWeapons = weaponRes.data || [];
      const usedIds = mappings.map(m => m.weapon_template_id);
      const available = allWeapons.filter(w => !usedIds.includes(w.id));
      return {
        layout: 'pool',
        title: `Loot Mappings — ${esc(template.name)}`,
        subtitle: `Gold: ${template.min_gold}–${template.max_gold} · These weapons can drop from this monster`,
        headHtml: '<th>Weapon Template</th><th>LP Cost</th><th>Weight</th><th>Actions</th>',
        rows: mappings.map(m => ({
          name: esc(m.weapon_template?.name || 'Unknown'),
          cost: m.lp_cost,
          weight: m.weight,
          id: m.id,
        })),
        emptyText: 'No loot items assigned to this monster',
        closeButtonId: 'mt-close-loot-btn',
        add: {
          rowClass: 'add-attack-row',
          selectId: 'mt-add-weapon',
          placeholder: '— Add weapon to monster loot pool —',
          options: available.map(w => ({ value: w.id, label: esc(w.name) })),
          costInputId: 'mt-add-lp-cost',
          costPlaceholder: 'LP Cost',
          weightInputId: 'mt-add-loot-weight',
          buttonId: 'mt-add-loot-btn',
          closeLayout: 'compact',
        },
      };
    },
    onPoolChange(mappingId, lp_cost, weight) {
      return apiCall(`/api/admin/monster-templates/${templateId}/loot/${mappingId}`, 'PATCH', { lp_cost, weight });
    },
    onRemove(mappingId) {
      return apiCall(`/api/admin/monster-templates/${templateId}/loot/${mappingId}`, 'DELETE');
    },
    onAddPool(weaponId, lp_cost, weight) {
      return apiCall(`/api/admin/monster-templates/${templateId}/loot`, 'POST', {
        weapon_template_id: weaponId, lp_cost, weight,
      });
    },
  });
}

// ============================================================
// PORTAL TEMPLATES TAB
// ============================================================

async function renderPortalTemplates(container) {
  container.innerHTML = `
    <h2>Portal Templates</h2>
    <button class="btn" id="create-pt-btn">+ Create New Portal Template</button>
    <div id="pt-form-container"></div>
    <div id="pt-mapping-container"></div>
    <table>
      <thead><tr><th>Name</th><th>Dice Pool</th><th>Actions</th></tr></thead>
      <tbody id="pt-tbody"></tbody>
    </table>
  `;
  document.getElementById('create-pt-btn').addEventListener('click', () => showPortalTemplateForm());

  const res = await apiCall('/api/admin/portal-templates');
  const templates = res.data || [];
  const tbody = document.getElementById('pt-tbody');
  templates.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(t.name)}</td>
      <td>G:${t.green_dice_count} Y:${t.yellow_dice_count} R:${t.red_dice_count}</td>
      <td>
        <button class="btn" data-edit="${t.id}">Edit</button>
        <button class="btn" data-monsters="${t.id}">Monster Mappings</button>
        <button class="btn" data-loot="${t.id}">Loot Mappings</button>
        <button class="btn btn-danger" data-delete="${t.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => showPortalTemplateForm(btn.dataset.edit));
  });
  tbody.querySelectorAll('[data-monsters]').forEach(btn => {
    btn.addEventListener('click', () => showPortalMonsterMappingEditor(btn.dataset.monsters));
  });
  tbody.querySelectorAll('[data-loot]').forEach(btn => {
    btn.addEventListener('click', () => showPortalLootMappingEditor(btn.dataset.loot));
  });
  tbody.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deletePortalTemplate(btn.dataset.delete));
  });
}

function showPortalTemplateForm(id = null) {
  const container = document.getElementById('pt-form-container');
  apiCall('/api/admin/portal-templates').then(res => {
    const templates = res.data || [];
    const t = id ? templates.find(x => String(x.id) === String(id)) : {};

    container.innerHTML = `
      <div class="form-card">
        <h3>${id ? 'Edit Portal Template' : 'Create Portal Template'}</h3>
        <div class="form-group"><label>Name</label><input id="pt-name" value="${esc(t.name || '')}"></div>
        <div class="form-group"><label>Description</label><textarea id="pt-description" rows="2">${esc(t.description || '')}</textarea></div>
        <div class="form-group"><label>Encounters (fights)</label><input id="pt-fights" type="number" value="${t.fights ?? 5}"></div>
        <div class="form-group"><label>Max Enemies Per Encounter</label><input id="pt-max_enemies" type="number" value="${t.max_enemies ?? 5}"></div>
        <div class="form-group"><label>AP Cost</label><input id="pt-ap_cost" type="number" value="${t.ap_cost ?? 0}"></div>
        <div class="form-group"><label>Unlock Gold Cost</label><input id="pt-unlock_gold_cost" type="number" value="${t.unlock_gold_cost ?? 0}"></div>
        <div class="form-group"><label>Green Dice Count</label><input id="pt-green_dice_count" type="number" value="${t.green_dice_count ?? 4}"></div>
        <div class="form-group"><label>Yellow Dice Count</label><input id="pt-yellow_dice_count" type="number" value="${t.yellow_dice_count ?? 3}"></div>
        <div class="form-group"><label>Red Dice Count</label><input id="pt-red_dice_count" type="number" value="${t.red_dice_count ?? 3}"></div>
        <div class="form-group"><label>Green Faces (comma-separated)</label><input id="pt-green_faces" value="${(t.green_faces || [10,10,10,20,20,30]).join(',')}"></div>
        <div class="form-group"><label>Yellow Faces (comma-separated)</label><input id="pt-yellow_faces" value="${(t.yellow_faces || [10,10,20,20,30,30]).join(',')}"></div>
        <div class="form-group"><label>Red Faces (comma-separated)</label><input id="pt-red_faces" value="${(t.red_faces || [10,20,20,30,30,30]).join(',')}"></div>
        <button class="btn" id="save-pt-btn">${id ? 'Update' : 'Create'}</button>
        <button class="btn btn-secondary" id="cancel-pt-btn">Cancel</button>
      </div>
    `;

    document.getElementById('cancel-pt-btn').addEventListener('click', () => { container.innerHTML = ''; });
    document.getElementById('save-pt-btn').addEventListener('click', async () => {
      const body = {
        name: val('pt-name'),
        description: val('pt-description') || null,
        fights: parseInt(val('pt-fights')),
        max_enemies: parseInt(val('pt-max_enemies')),
        ap_cost: parseInt(val('pt-ap_cost')),
        unlock_gold_cost: parseInt(val('pt-unlock_gold_cost')),
        green_dice_count: parseInt(val('pt-green_dice_count')),
        yellow_dice_count: parseInt(val('pt-yellow_dice_count')),
        red_dice_count: parseInt(val('pt-red_dice_count')),
        green_faces: val('pt-green_faces'),
        yellow_faces: val('pt-yellow_faces'),
        red_faces: val('pt-red_faces'),
      };
      try {
        if (id) await apiCall(`/api/admin/portal-templates/${id}`, 'PUT', body);
        else await apiCall('/api/admin/portal-templates', 'POST', body);
        container.innerHTML = '';
        loadTab(currentTab);
      } catch (e) { alert('Error: ' + e.message); }
    });
  });
}

async function deletePortalTemplate(id) {
  if (!confirm('Delete this portal template?')) return;
  try {
    await apiCall(`/api/admin/portal-templates/${id}`, 'DELETE');
    loadTab(currentTab);
  } catch (e) { alert('Delete blocked: ' + e.message); }
}

// ============================================================
// PORTAL TEMPLATE — MONSTER MAPPING EDITOR
// ============================================================

async function showPortalMonsterMappingEditor(templateId) {
  const container = document.getElementById('pt-mapping-container');
  return renderMappingEditor(container, {
    loadingText: 'Loading mappings...',
    errorText: 'Error loading mappings',
    removeConfirm: 'Remove this monster from the portal?',
    refresh: () => showPortalMonsterMappingEditor(templateId),
    async load() {
      const [templateRes, mappingRes, monsterRes] = await Promise.all([
        apiCall(`/api/admin/portal-templates/${templateId}`),
        apiCall(`/api/admin/portal-templates/${templateId}/monsters`),
        apiCall('/api/admin/monster-templates'),
      ]);
      const template = templateRes.data;
      const mappings = mappingRes.data || [];
      const allMonsters = monsterRes.data || [];
      const usedIds = mappings.map(m => m.monster_template_id);
      const available = allMonsters.filter(m => !usedIds.includes(m.id));
      return {
        layout: 'pool',
        title: `Monster Mappings — ${esc(template.name)}`,
        subtitle: `Dice Pool: G:${template.green_dice_count} Y:${template.yellow_dice_count} R:${template.red_dice_count}`,
        headHtml: '<th>Monster Name</th><th>Point Cost</th><th>Weight</th><th>Actions</th>',
        rows: mappings.map(m => ({
          name: esc(m.monster_template?.name || 'Unknown'),
          cost: m.point_cost,
          weight: m.weight,
          id: m.id,
        })),
        emptyText: 'No monsters assigned to this portal',
        closeButtonId: 'pt-close-monster-btn',
        add: {
          rowClass: 'add-mapping-row',
          selectId: 'pt-add-monster',
          placeholder: '— Add monster to portal —',
          options: available.map(m => ({ value: m.id, label: esc(m.name) })),
          costInputId: 'pt-add-cost',
          costPlaceholder: 'Point Cost',
          weightInputId: 'pt-add-weight',
          buttonId: 'pt-add-monster-btn',
          closeLayout: 'split',
        },
      };
    },
    onPoolChange(mappingId, point_cost, weight) {
      return apiCall(`/api/admin/portal-templates/${templateId}/monsters/${mappingId}`, 'PATCH', { point_cost, weight });
    },
    onRemove(mappingId) {
      return apiCall(`/api/admin/portal-templates/${templateId}/monsters/${mappingId}`, 'DELETE');
    },
    onAddPool(monsterId, point_cost, weight) {
      return apiCall(`/api/admin/portal-templates/${templateId}/monsters`, 'POST', {
        monster_template_id: monsterId, point_cost, weight,
      });
    },
  });
}

// ============================================================
// PORTAL TEMPLATE — LOOT MAPPING EDITOR
// ============================================================

async function showPortalLootMappingEditor(templateId) {
  const container = document.getElementById('pt-mapping-container');
  return renderMappingEditor(container, {
    loadingText: 'Loading loot mappings...',
    errorText: 'Error loading loot mappings',
    removeConfirm: 'Remove this loot item from the portal?',
    refresh: () => showPortalLootMappingEditor(templateId),
    async load() {
      const [templateRes, lootRes, weaponRes] = await Promise.all([
        apiCall(`/api/admin/portal-templates/${templateId}`),
        apiCall(`/api/admin/portal-templates/${templateId}/loot`),
        apiCall('/api/admin/weapon-templates'),
      ]);
      const template = templateRes.data;
      const mappings = lootRes.data || [];
      const allWeapons = weaponRes.data || [];
      const usedIds = mappings.map(m => m.weapon_template_id);
      const available = allWeapons.filter(w => !usedIds.includes(w.id));
      return {
        layout: 'pool',
        title: `Loot Mappings — ${esc(template.name)}`,
        subtitle: `Dice Pool: G:${template.green_dice_count} Y:${template.yellow_dice_count} R:${template.red_dice_count}`,
        headHtml: '<th>Weapon Template</th><th>LP Cost</th><th>Weight</th><th>Actions</th>',
        rows: mappings.map(m => ({
          name: esc(m.weapon_template?.name || 'Unknown'),
          cost: m.lp_cost,
          weight: m.weight,
          id: m.id,
        })),
        emptyText: 'No loot items assigned to this portal',
        closeButtonId: 'pt-close-loot-btn',
        add: {
          rowClass: 'add-attack-row',
          selectId: 'pt-add-weapon',
          placeholder: '— Add weapon to loot pool —',
          options: available.map(w => ({ value: w.id, label: esc(w.name) })),
          costInputId: 'pt-add-lp-cost',
          costPlaceholder: 'LP Cost',
          weightInputId: 'pt-add-loot-weight',
          buttonId: 'pt-add-loot-btn',
          closeLayout: 'compact',
        },
      };
    },
    onPoolChange(mappingId, lp_cost, weight) {
      return apiCall(`/api/admin/portal-templates/${templateId}/loot/${mappingId}`, 'PATCH', { lp_cost, weight });
    },
    onRemove(mappingId) {
      return apiCall(`/api/admin/portal-templates/${templateId}/loot/${mappingId}`, 'DELETE');
    },
    onAddPool(weaponId, lp_cost, weight) {
      return apiCall(`/api/admin/portal-templates/${templateId}/loot`, 'POST', {
        weapon_template_id: weaponId, lp_cost, weight,
      });
    },
  });
}

// ============================================================
// CONSUMABLE TEMPLATES TAB (PC-38)
// ============================================================

async function renderConsumableTemplates(container) {
  container.innerHTML = `
    <h2>Consumable Templates</h2>
    <button class="btn" id="create-ct-btn">+ Create New Consumable Template</button>
    <div id="ct-form-container"></div>
    <table>
      <thead><tr><th>Name</th><th>Type</th><th>Effect</th><th>EV</th><th>Drink Speed</th><th>Duration</th><th># Instances</th><th>Actions</th></tr></thead>
      <tbody id="ct-tbody"></tbody>
    </table>
  `;
  document.getElementById('create-ct-btn').addEventListener('click', () => showConsumableTemplateForm());

  const res = await apiCall('/api/admin/consumable-templates');
  const templates = res.data || [];
  const tbody = document.getElementById('ct-tbody');
  templates.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(t.name)}</td>
      <td>${esc(t.effect_type)}</td>
      <td>${t.floor_base}+, up to ${t.floor_base + t.floor_delta + t.window_base + t.window_delta}</td>
      <td>${Math.round((t.floor_base + t.floor_delta / 2 + (t.window_base + t.window_delta / 2) / 2) * 10) / 10}</td>
      <td>${t.speed_base}+, up to ${t.speed_base + t.speed_delta}</td>
      <td>${t.duration_ticks ?? 'instant'}</td>
      <td>${t.instance_count ?? 0}</td>
      <td>
        <button class="btn" data-edit="${t.id}">Edit</button>
        <button class="btn btn-danger" data-delete="${t.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => showConsumableTemplateForm(btn.dataset.edit));
  });
  tbody.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteConsumableTemplate(btn.dataset.delete));
  });
}

function showConsumableTemplateForm(id = null) {
  const container = document.getElementById('ct-form-container');
  apiCall('/api/admin/consumable-templates').then(res => {
    const templates = res.data || [];
    const t = id ? templates.find(x => String(x.id) === String(id)) : {};

    container.innerHTML = `
      <div class="form-card">
        <h3>${id ? 'Edit Consumable Template' : 'Create Consumable Template'}</h3>
        <div class="form-group"><label>Name</label><input id="ct-name" value="${esc(t.name || '')}"></div>
        <div class="form-group"><label>Description</label><textarea id="ct-description" rows="2">${esc(t.description || '')}</textarea></div>
        <div class="form-group">
          <label>Effect Type</label>
          <select id="ct-effect_type">
            <option value="heal" ${t.effect_type === 'heal' ? 'selected' : ''}>heal</option>
            <option value="damage" ${t.effect_type === 'damage' ? 'selected' : ''}>damage</option>
            <option value="speed" ${t.effect_type === 'speed' ? 'selected' : ''}>speed</option>
            <option value="accuracy" ${t.effect_type === 'accuracy' ? 'selected' : ''}>accuracy</option>
          </select>
        </div>
        <div class="form-group"><label>Floor Base</label><input id="ct-floor_base" type="number" value="${t.floor_base ?? 50}"></div>
        <div class="form-group"><label>Floor Delta</label><input id="ct-floor_delta" type="number" value="${t.floor_delta ?? 10}"></div>
        <div class="form-group"><label>Window Base</label><input id="ct-window_base" type="number" value="${t.window_base ?? 20}"></div>
        <div class="form-group"><label>Window Delta</label><input id="ct-window_delta" type="number" value="${t.window_delta ?? 10}"></div>
        <div class="form-group"><label>Speed Base</label><input id="ct-speed_base" type="number" value="${t.speed_base ?? 2}"></div>
        <div class="form-group"><label>Speed Delta</label><input id="ct-speed_delta" type="number" value="${t.speed_delta ?? 1}"></div>
        <div class="form-group"><label>Duration Ticks (null for instant)</label><input id="ct-duration_ticks" type="number" value="${t.duration_ticks ?? ''}"></div>
        
        <div class="form-group">
          <label>Live Label Preview</label>
          <div id="ct-preview" style="background:#0a1428; border:1px solid #ff6b3b; padding:10px; font-family:monospace; white-space:pre;"></div>
        </div>

        <button class="btn" id="save-ct-btn">${id ? 'Update' : 'Create'}</button>
        <button class="btn btn-secondary" id="cancel-ct-btn">Cancel</button>
      </div>
    `;

    // Live preview setup
    const preview = document.getElementById('ct-preview');
    function updatePreview() {
      const name = val('ct-name') || 'Unnamed';
      const effect = val('ct-effect_type') || 'heal';
      const fb = parseInt(val('ct-floor_base') || 0);
      const fd = parseInt(val('ct-floor_delta') || 0);
      const wb = parseInt(val('ct-window_base') || 0);
      const wd = parseInt(val('ct-window_delta') || 0);
      const minFloor = fb;
      const maxFloor = fb + fd;
      const minWindow = wb;
      const maxTotal = fb + fd + wb + wd;
      preview.innerHTML = `${esc(name)} (${effect})<br>${minFloor}+, up to ${maxTotal} <span class="muted">(floor ${minFloor}–${maxFloor}, window ${minWindow}–${minWindow+wd})</span>`;
    }
    ['ct-name','ct-effect_type','ct-floor_base','ct-floor_delta','ct-window_base','ct-window_delta'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updatePreview);
    });
    updatePreview(); // initial

    document.getElementById('cancel-ct-btn').addEventListener('click', () => { container.innerHTML = ''; });
    document.getElementById('save-ct-btn').addEventListener('click', async () => {
      const body = {
        name: val('ct-name'),
        description: val('ct-description') || null,
        effect_type: val('ct-effect_type'),
        floor_base: parseInt(val('ct-floor_base')),
        floor_delta: parseInt(val('ct-floor_delta')),
        window_base: parseInt(val('ct-window_base')),
        window_delta: parseInt(val('ct-window_delta')),
        speed_base: parseInt(val('ct-speed_base')),
        speed_delta: parseInt(val('ct-speed_delta')),
        duration_ticks: val('ct-duration_ticks') ? parseInt(val('ct-duration_ticks')) : null,
      };
      // Client-side validation: +only deltas (all >= 0), floor_base >= 1, heal has no duration
      const numFields = [['floor_base', body.floor_base], ['floor_delta', body.floor_delta], ['window_base', body.window_base], ['window_delta', body.window_delta], ['speed_base', body.speed_base], ['speed_delta', body.speed_delta]];
      const bad = numFields.filter(([, v]) => !Number.isFinite(v) || v < 0);
      if (body.floor_base < 1) bad.push(['floor_base', body.floor_base]);
      if (!['heal', 'speed', 'accuracy', 'damage'].includes(body.effect_type)) bad.push(['effect_type', body.effect_type]);
      if (body.effect_type === 'heal' && body.duration_ticks !== null) bad.push(['duration_ticks', body.duration_ticks]);
      if (bad.length) { alert('Invalid values: ' + bad.map(([k, v]) => `${k}=${v}`).join(', ')); return; }
      try {
        if (id) await apiCall(`/api/admin/consumable-templates/${id}`, 'PUT', body);
        else await apiCall('/api/admin/consumable-templates', 'POST', body);
        container.innerHTML = '';
        loadTab(currentTab);
      } catch (e) { alert('Error: ' + e.message); }
    });
  });
}

async function deleteConsumableTemplate(id) {
  if (!confirm('Delete this consumable template? This will be blocked if other records reference it.')) return;
  try {
    await apiCall(`/api/admin/consumable-templates/${id}`, 'DELETE');
    loadTab(currentTab);
  } catch (e) {
    alert('Delete blocked: ' + e.message);
  }
}

// ============================================================
// HELPERS
// ============================================================

function esc(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

function val(id) {
  return document.getElementById(id)?.value;
}

// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  initSupabase();
  setupOAuthButtons();
  await checkAdminSession();
});
