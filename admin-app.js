/**
 * Portal Colosseum - Admin GUI Application
 * =========================================
 * Vanilla JS matching login-app.js / game-app.js patterns.
 * All data via /api/admin/* routes with JWT verification.
 * Service-role key NEVER touches the client.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';

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
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      storage: {
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, value) => localStorage.setItem(key, value),
        removeItem: (key) => localStorage.removeItem(key),
      },
    },
  });
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
    } catch (err) { /* non-fatal */ }
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
      <thead><tr><th>Name</th><th>Dmg Mult</th><th>Prep</th><th>CD</th><th>Multi?</th><th>Weight</th><th>Actions</th></tr></thead>
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
      <td>${a.prepare_time}</td>
      <td>${a.cooldown_time}</td>
      <td>${a.is_multi_target ? '✓' : ''}</td>
      <td>${a.weight}</td>
      <td>
        <button class="btn" data-edit="${a.id}">Edit</button>
        <button class="btn btn-danger" data-delete="${a.id}">Delete</button>
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
      <div class="form-group"><label>Prepare Time</label><input id="f-prepare_time" type="number" value="${attack.prepare_time ?? 10}"></div>
      <div class="form-group"><label>Cooldown Time</label><input id="f-cooldown_time" type="number" value="${attack.cooldown_time ?? 10}"></div>
      <div class="form-group"><label><input id="f-is_multi_target" type="checkbox" ${attack.is_multi_target ? 'checked' : ''}> Multi Target</label></div>
      <div class="form-group"><label>Weight</label><input id="f-weight" type="number" step="0.1" value="${attack.weight ?? 1.0}"></div>
      <button class="btn" id="save-attack-btn">${isEdit ? 'Update' : 'Create'}</button>
      <button class="btn btn-secondary" id="cancel-attack-btn">Cancel</button>
    </div>
  `;

  document.getElementById('cancel-attack-btn').addEventListener('click', () => { container.innerHTML = ''; });
  document.getElementById('save-attack-btn').addEventListener('click', async () => {
    const body = {
      name: val('f-name'),
      description: val('f-description') || null,
      base_damage_multiplier: parseFloat(val('f-base_damage_multiplier')),
      prepare_time: parseInt(val('f-prepare_time')),
      cooldown_time: parseInt(val('f-cooldown_time')),
      is_multi_target: document.getElementById('f-is_multi_target').checked,
      weight: parseFloat(val('f-weight')),
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
      <thead><tr><th>Name</th><th>Dmg (base ± range)</th><th>Speed (base ± range)</th><th>Accuracy (base ± range)</th><th>Slot 0 Attack</th><th>Actions</th></tr></thead>
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
      <td>${t.base_speed} ± ${t.speed_variance}</td>
      <td>${t.base_accuracy} ± ${t.accuracy_range}</td>
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
        <div class="form-group"><label>Speed Variance</label><input id="wt-speed_variance" type="number" value="${t.speed_variance ?? 0}"></div>
        <div class="form-group"><label>Base Accuracy</label><input id="wt-base_accuracy" type="number" value="${t.base_accuracy ?? ''}"></div>
        <div class="form-group"><label>Accuracy Range</label><input id="wt-accuracy_range" type="number" value="${t.accuracy_range ?? 0}"></div>
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
        speed_variance: parseInt(val('wt-speed_variance')),
        base_accuracy: parseInt(val('wt-base_accuracy')),
        accuracy_range: parseInt(val('wt-accuracy_range')),
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
// WEAPON TEMPLATE — ATTACK MAPPING EDITOR (PRIMARY FEATURE)
// ============================================================

async function showWeaponMappingEditor(templateId) {
  const container = document.getElementById('wt-mapping-container');
  container.innerHTML = '<p>Loading mappings...</p>';

  try {
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

    let html = `
      <div class="form-card mapping-editor">
        <h3>Attack Mappings — ${esc(template.name)}</h3>
        <p class="muted">Base stats: DMG ${template.base_damage}±${template.damage_range} · SPD ${template.base_speed}±${template.speed_variance} · ACC ${template.base_accuracy}±${template.accuracy_range}</p>
        <p class="muted">Slot 0 (always): ${template.slot_0_attack?.name ? esc(template.slot_0_attack.name) : '—'} · S1: ${(template.slot_1_chance*100)}% · S2: ${(template.slot_2_chance*100)}% · S3: ${(template.slot_3_chance*100)}% · S4: ${(template.slot_4_chance*100)}%</p>
    `;

    for (const slot of [1, 2, 3]) {
      html += `
        <div class="mapping-slot">
          <h4>Slot ${slot} <span class="muted">(chance: ${(template['slot_' + slot + '_chance'] * 100).toFixed(0)}%)</span></h4>
          <table>
            <thead><tr><th>Attack Name</th><th>Weight</th><th>Actions</th></tr></thead>
            <tbody>
      `;
      bySlot[slot].forEach(m => {
        html += `
          <tr>
            <td>${esc(m.attack?.name || 'Unknown')}</td>
            <td><input type="number" step="0.1" value="${m.weight}" data-mapping-id="${m.id}" class="weight-input"></td>
            <td><button class="btn btn-danger" data-remove-mapping="${m.id}">Remove</button></td>
          </tr>
        `;
      });
      if (bySlot[slot].length === 0) html += '<tr><td colspan="5" class="muted">No attacks assigned to this slot</td></tr>';
      html += `</tbody></table>`;

      // Add attack picker — show attacks NOT already in this slot
      const usedIds = bySlot[slot].map(m => m.attack_id);
      const available = allAttacks.filter(a => !usedIds.includes(a.id));
      html += `
        <div class="add-attack-row">
          <select id="add-attack-slot-${slot}">
            <option value="">— Add attack to Slot ${slot} —</option>
            ${available.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}
          </select>
          <button class="btn" data-add-to-slot="${slot}">Add</button>
        </div>
        </div>
      `;
    }

    html += `<button class="btn btn-secondary" id="close-mapping-btn">Close</button></div>`;
    container.innerHTML = html;

    document.getElementById('close-mapping-btn').addEventListener('click', () => { container.innerHTML = ''; });

    // Weight edit handlers
    container.querySelectorAll('.weight-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        const mappingId = e.target.dataset.mappingId;
        const weight = parseFloat(e.target.value);
        try {
          await apiCall(`/api/admin/weapon-templates/${templateId}/mappings/${mappingId}`, 'PATCH', { weight });
        } catch (err) { alert('Error updating weight: ' + err.message); }
      });
    });

    // Remove handlers
    container.querySelectorAll('[data-remove-mapping]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove this attack from the slot?')) return;
        try {
          await apiCall(`/api/admin/weapon-templates/${templateId}/mappings/${btn.dataset.removeMapping}`, 'DELETE');
          showWeaponMappingEditor(templateId); // refresh
        } catch (e) { alert('Error: ' + e.message); }
      });
    });

    // Add handlers
    container.querySelectorAll('[data-add-to-slot]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const slot = parseInt(btn.dataset.addToSlot);
        const select = document.getElementById(`add-attack-slot-${slot}`);
        const attackId = parseInt(select.value);
        if (!attackId) return;
        try {
          await apiCall(`/api/admin/weapon-templates/${templateId}/mappings`, 'POST', {
            attack_id: attackId, slot, weight: 1.0,
          });
          showWeaponMappingEditor(templateId); // refresh
        } catch (e) { alert('Error: ' + e.message); }
      });
    });

  } catch (e) {
    container.innerHTML = `<p class="error">Error loading mappings: ${e.message}</p>`;
  }
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
      <thead><tr><th>Name</th><th>Dmg (base ± range)</th><th>Speed (base ± range)</th><th>Accuracy (base ± range)</th><th>Slot 0 Attack</th><th>Actions</th></tr></thead>
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
      <td>${t.base_speed} ± ${t.speed_variance}</td>
      <td>${t.base_accuracy} ± ${t.accuracy_range}</td>
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
    btn.addEventListener('click', () => showMonsterTemplateForm(btn.dataset.edit));
  });
  tbody.querySelectorAll('[data-mappings]').forEach(btn => {
    btn.addEventListener('click', () => showMonsterMappingEditor(btn.dataset.mappings));
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
        <div class="form-group"><label>Speed Variance</label><input id="mt-speed_variance" type="number" value="${t.speed_variance ?? 0}"></div>
        <div class="form-group"><label>Base Accuracy</label><input id="mt-base_accuracy" type="number" value="${t.base_accuracy ?? ''}"></div>
        <div class="form-group"><label>Accuracy Range</label><input id="mt-accuracy_range" type="number" value="${t.accuracy_range ?? 0}"></div>
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
        speed_variance: parseInt(val('mt-speed_variance')),
        base_accuracy: parseInt(val('mt-base_accuracy')),
        accuracy_range: parseInt(val('mt-accuracy_range')),
        slot_0_attack_id: parseInt(val('mt-slot_0_attack_id')),
        slot_1_chance: parseFloat(val('mt-slot_1_chance')),
        slot_2_chance: parseFloat(val('mt-slot_2_chance')),
        slot_3_chance: parseFloat(val('mt-slot_3_chance')),
        slot_4_chance: parseFloat(val('mt-slot_4_chance')),
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
  container.innerHTML = '<p>Loading mappings...</p>';

  try {
    const [templateRes, mappingRes] = await Promise.all([
      apiCall(`/api/admin/monster-templates/${templateId}`),
      apiCall(`/api/admin/monster-templates/${templateId}/mappings`),
    ]);
    const template = templateRes.data;
    const mappings = mappingRes.data || [];

    const bySlot = { 1: [], 2: [], 3: [], 4: [] };
    mappings.forEach(m => { if (bySlot[m.slot]) bySlot[m.slot].push(m); });

    let html = `
      <div class="form-card mapping-editor">
        <h3>Attack Mappings — ${esc(template.name)}</h3>
        <p class="muted">Base stats: DMG ${template.base_damage}±${template.damage_range} · SPD ${template.base_speed}±${template.speed_variance} · ACC ${template.base_accuracy}±${template.accuracy_range}</p>
        <p class="muted">Slot 0 (always): ${template.slot_0_attack?.name ? esc(template.slot_0_attack.name) : '—'}</p>
    `;

    for (const slot of [1, 2, 3, 4]) {
      html += `
        <div class="mapping-slot">
          <h4>Slot ${slot} <span class="muted">(chance: ${(template['slot_' + slot + '_chance'] * 100).toFixed(0)}%)</span></h4>
          <table>
            <thead><tr><th>Attack Name</th><th>Weight</th><th>Actions</th></tr></thead>
            <tbody>
      `;
      bySlot[slot].forEach(m => {
        html += `
          <tr>
            <td>${esc(m.attack?.name || 'Unknown')}</td>
            <td><input type="number" step="0.1" value="${m.weight}" data-mapping-id="${m.id}" class="weight-input"></td>
            <td><button class="btn btn-danger" data-remove-mapping="${m.id}">Remove</button></td>
          </tr>
        `;
      });
      if (bySlot[slot].length === 0) html += '<tr><td colspan="5" class="muted">No attacks assigned to this slot</td></tr>';
      html += `</tbody></table>`;

      const usedIds = bySlot[slot].map(m => m.attack_id);
      const available = allAttacks.filter(a => !usedIds.includes(a.id));
      html += `
        <div class="add-attack-row">
          <select id="mt-add-attack-slot-${slot}">
            <option value="">— Add attack to Slot ${slot} —</option>
            ${available.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}
          </select>
          <button class="btn" data-add-to-slot="${slot}">Add</button>
        </div>
        </div>
      `;
    }

    html += `<button class="btn btn-secondary" id="mt-close-mapping-btn">Close</button></div>`;
    container.innerHTML = html;

    document.getElementById('mt-close-mapping-btn').addEventListener('click', () => { container.innerHTML = ''; });

    container.querySelectorAll('.weight-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        const mappingId = e.target.dataset.mappingId;
        const weight = parseFloat(e.target.value);
        try {
          await apiCall(`/api/admin/monster-templates/${templateId}/mappings/${mappingId}`, 'PATCH', { weight });
        } catch (err) { alert('Error updating weight: ' + err.message); }
      });
    });

    container.querySelectorAll('[data-remove-mapping]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove this attack from the slot?')) return;
        try {
          await apiCall(`/api/admin/monster-templates/${templateId}/mappings/${btn.dataset.removeMapping}`, 'DELETE');
          showMonsterMappingEditor(templateId);
        } catch (e) { alert('Error: ' + e.message); }
      });
    });

    container.querySelectorAll('[data-add-to-slot]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const slot = parseInt(btn.dataset.addToSlot);
        const select = document.getElementById(`mt-add-attack-slot-${slot}`);
        const attackId = parseInt(select.value);
        if (!attackId) return;
        try {
          await apiCall(`/api/admin/monster-templates/${templateId}/mappings`, 'POST', {
            attack_id: attackId, slot, weight: 1.0,
          });
          showMonsterMappingEditor(templateId);
        } catch (e) { alert('Error: ' + e.message); }
      });
    });

  } catch (e) {
    container.innerHTML = `<p class="error">Error loading mappings: ${e.message}</p>`;
  }
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
      <thead><tr><th>Name</th><th>Tier</th><th>Dice Pool</th><th>Actions</th></tr></thead>
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
      <td>${t.tier}</td>
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
        <div class="form-group"><label>Tier</label><input id="pt-tier" type="number" value="${t.tier ?? 1}"></div>
        <div class="form-group"><label>Description</label><textarea id="pt-description" rows="2">${esc(t.description || '')}</textarea></div>
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
        tier: parseInt(val('pt-tier')),
        description: val('pt-description') || null,
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
  container.innerHTML = '<p>Loading mappings...</p>';

  try {
    const [templateRes, mappingRes, monsterRes] = await Promise.all([
      apiCall(`/api/admin/portal-templates/${templateId}`),
      apiCall(`/api/admin/portal-templates/${templateId}/monsters`),
      apiCall('/api/admin/monster-templates'),
    ]);
    const template = templateRes.data;
    const mappings = mappingRes.data || [];
    const allMonsters = monsterRes.data || [];

    let html = `
      <div class="form-card mapping-editor">
        <h3>Monster Mappings — ${esc(template.name)}</h3>
        <p class="muted">Tier ${template.tier} · Dice Pool: G:${template.green_dice_count} Y:${template.yellow_dice_count} R:${template.red_dice_count}</p>
        <table>
          <thead><tr><th>Monster Name</th><th>Point Cost</th><th>Weight</th><th>Actions</th></tr></thead>
          <tbody>
    `;

    mappings.forEach(m => {
      html += `
        <tr>
          <td>${esc(m.monster_template?.name || 'Unknown')}</td>
          <td><input type="number" value="${m.point_cost}" data-mapping-id="${m.id}" class="cost-input"></td>
          <td><input type="number" step="0.1" value="${m.weight}" data-mapping-id="${m.id}" class="weight-input"></td>
          <td><button class="btn btn-danger" data-remove-mapping="${m.id}">Remove</button></td>
        </tr>
      `;
    });
    if (mappings.length === 0) html += '<tr><td colspan="4" class="muted">No monsters assigned to this portal</td></tr>';
    html += `</tbody></table>`;

    // Add monster picker — show monsters NOT already in this portal
    const usedIds = mappings.map(m => m.monster_template_id);
    const available = allMonsters.filter(m => !usedIds.includes(m.id));
    html += `
      <div class="add-attack-row">
        <select id="pt-add-monster">
          <option value="">— Add monster to portal —</option>
          ${available.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}
        </select>
        <input type="number" id="pt-add-cost" placeholder="Point Cost" value="10">
        <input type="number" id="pt-add-weight" placeholder="Weight" step="0.1" value="1.0">
        <button class="btn" id="pt-add-monster-btn">Add</button>
      </div>
      <button class="btn btn-secondary" id="pt-close-monster-btn">Close</button>
    </div>
    `;
    container.innerHTML = html;

    document.getElementById('pt-close-monster-btn').addEventListener('click', () => { container.innerHTML = ''; });

    // Cost and weight edit handlers
    container.querySelectorAll('.cost-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        const mappingId = e.target.dataset.mappingId;
        const point_cost = parseInt(e.target.value);
        // Find the sibling weight input
        const row = e.target.closest('tr');
        const weightInput = row.querySelector('.weight-input');
        const weight = parseFloat(weightInput.value);
        try {
          await apiCall(`/api/admin/portal-templates/${templateId}/monsters/${mappingId}`, 'PATCH', { point_cost, weight });
        } catch (err) { alert('Error updating: ' + err.message); }
      });
    });
    container.querySelectorAll('.weight-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        const mappingId = e.target.dataset.mappingId;
        const weight = parseFloat(e.target.value);
        const row = e.target.closest('tr');
        const costInput = row.querySelector('.cost-input');
        const point_cost = parseInt(costInput.value);
        try {
          await apiCall(`/api/admin/portal-templates/${templateId}/monsters/${mappingId}`, 'PATCH', { point_cost, weight });
        } catch (err) { alert('Error updating: ' + err.message); }
      });
    });

    // Remove handlers
    container.querySelectorAll('[data-remove-mapping]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove this monster from the portal?')) return;
        try {
          await apiCall(`/api/admin/portal-templates/${templateId}/monsters/${btn.dataset.removeMapping}`, 'DELETE');
          showPortalMonsterMappingEditor(templateId);
        } catch (e) { alert('Error: ' + e.message); }
      });
    });

    // Add handler
    document.getElementById('pt-add-monster-btn').addEventListener('click', async () => {
      const monsterId = parseInt(document.getElementById('pt-add-monster').value);
      if (!monsterId) return;
      const point_cost = parseInt(document.getElementById('pt-add-cost').value);
      const weight = parseFloat(document.getElementById('pt-add-weight').value);
      try {
        await apiCall(`/api/admin/portal-templates/${templateId}/monsters`, 'POST', {
          monster_template_id: monsterId, point_cost, weight,
        });
        showPortalMonsterMappingEditor(templateId);
      } catch (e) { alert('Error: ' + e.message); }
    });

  } catch (e) {
    container.innerHTML = `<p class="error">Error loading mappings: ${e.message}</p>`;
  }
}

// ============================================================
// PORTAL TEMPLATE — LOOT MAPPING EDITOR
// ============================================================

async function showPortalLootMappingEditor(templateId) {
  const container = document.getElementById('pt-mapping-container');
  container.innerHTML = '<p>Loading loot mappings...</p>';

  try {
    const [templateRes, lootRes] = await Promise.all([
      apiCall(`/api/admin/portal-templates/${templateId}`),
      apiCall(`/api/admin/portal-templates/${templateId}/loot`),
    ]);
    const template = templateRes.data;
    const mappings = lootRes.data || [];

    let html = `
      <div class="form-card mapping-editor">
        <h3>Loot Mappings — ${esc(template.name)}</h3>
        <p class="muted">Tier ${template.tier} · Dice Pool: G:${template.green_dice_count} Y:${template.yellow_dice_count} R:${template.red_dice_count}</p>
        <table>
          <thead><tr><th>Item Name</th><th>LP Cost</th><th>Weight</th><th>Actions</th></tr></thead>
          <tbody>
    `;

    mappings.forEach(m => {
      html += `
        <tr>
          <td>${esc(m.item_name)}</td>
          <td><input type="number" value="${m.lp_cost}" data-mapping-id="${m.id}" class="cost-input"></td>
          <td><input type="number" step="0.1" value="${m.weight}" data-mapping-id="${m.id}" class="weight-input"></td>
          <td><button class="btn btn-danger" data-remove-mapping="${m.id}">Remove</button></td>
        </tr>
      `;
    });
    if (mappings.length === 0) html += '<tr><td colspan="4" class="muted">No loot items assigned to this portal</td></tr>';
    html += `</tbody></table>`;

    // Add loot form — text input since there's no item table
    html += `
      <div class="add-attack-row">
        <input type="text" id="pt-add-item-name" placeholder="Item Name">
        <input type="number" id="pt-add-lp-cost" placeholder="LP Cost" value="10">
        <input type="number" id="pt-add-loot-weight" placeholder="Weight" step="0.1" value="1.0">
        <button class="btn" id="pt-add-loot-btn">Add</button>
      </div>
      <button class="btn btn-secondary" id="pt-close-loot-btn">Close</button>
    </div>
    `;
    container.innerHTML = html;

    document.getElementById('pt-close-loot-btn').addEventListener('click', () => { container.innerHTML = ''; });

    // Cost and weight edit handlers
    container.querySelectorAll('.cost-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        const mappingId = e.target.dataset.mappingId;
        const lp_cost = parseInt(e.target.value);
        const row = e.target.closest('tr');
        const weightInput = row.querySelector('.weight-input');
        const weight = parseFloat(weightInput.value);
        try {
          await apiCall(`/api/admin/portal-templates/${templateId}/loot/${mappingId}`, 'PATCH', { lp_cost, weight });
        } catch (err) { alert('Error updating: ' + err.message); }
      });
    });
    container.querySelectorAll('.weight-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        const mappingId = e.target.dataset.mappingId;
        const weight = parseFloat(e.target.value);
        const row = e.target.closest('tr');
        const costInput = row.querySelector('.cost-input');
        const lp_cost = parseInt(costInput.value);
        try {
          await apiCall(`/api/admin/portal-templates/${templateId}/loot/${mappingId}`, 'PATCH', { lp_cost, weight });
        } catch (err) { alert('Error updating: ' + err.message); }
      });
    });

    // Remove handlers
    container.querySelectorAll('[data-remove-mapping]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove this loot item from the portal?')) return;
        try {
          await apiCall(`/api/admin/portal-templates/${templateId}/loot/${btn.dataset.removeMapping}`, 'DELETE');
          showPortalLootMappingEditor(templateId);
        } catch (e) { alert('Error: ' + e.message); }
      });
    });

    // Add handler
    document.getElementById('pt-add-loot-btn').addEventListener('click', async () => {
      const item_name = document.getElementById('pt-add-item-name').value.trim();
      if (!item_name) return;
      const lp_cost = parseInt(document.getElementById('pt-add-lp-cost').value);
      const weight = parseFloat(document.getElementById('pt-add-loot-weight').value);
      try {
        await apiCall(`/api/admin/portal-templates/${templateId}/loot`, 'POST', {
          item_name, lp_cost, weight,
        });
        showPortalLootMappingEditor(templateId);
      } catch (e) { alert('Error: ' + e.message); }
    });

  } catch (e) {
    container.innerHTML = `<p class="error">Error loading loot mappings: ${e.message}</p>`;
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
