/**
 * Action-menu row HTML (PC-84).
 * Moved verbatim from renderActionMenu: attack readout, potion lookup,
 * readout paint, and root-window row construction. No behavior change.
 * The cascade (stack / renderStack / selectTop / back / paintReadout) stays
 * in battle-app.js — these builders take data and return rows / HTML.
 */
import { potionPrePostTicks } from '../combat/potion-contract.js';
import { escapeHtml } from '../pure-utils.js';

/** Pouch slot → potion object. Accepts potion_a/potion_b or a direct slot key. */
export function potionFor(potions, slot) {
  return potions[slot === 'A' ? 'potion_a' : 'potion_b'] || potions[slot] || null;
}

export function showInfo(text) {
  const ar = document.getElementById('action-readout');
  if (ar) ar.innerHTML = text || '';
}

/**
 * Attack readout HTML. `weapon` wins; otherwise `fallbackWeapon` (the open
 * hand's weapon — formerly the closure `w`); otherwise {}.
 */
export function attackInfo(a, weapon, fallbackWeapon) {
  const src = weapon || fallbackWeapon || {};
  const base = src.base_damage != null ? src.base_damage : (src.damage || 0);
  const range = src.damage_range != null ? src.damage_range : 0;
  const multi = a.is_multi_target ? ' <span style="color:#ffaa66">[MULTI]</span>' : '';
  const desc = a.description ? ` — ${escapeHtml(a.description)}` : '';
  const weaponSpeed = src.speed || 0;
  const pBase = Math.round(weaponSpeed * (a.prepare_time_multiplier ?? 1));
  const pVar = Math.round(weaponSpeed * (a.prepare_time_multiplier_range ?? 0));
  const cBase = Math.round(weaponSpeed * (a.cooldown_time_multiplier ?? 1));
  const cVar = Math.round(weaponSpeed * (a.cooldown_time_multiplier_range ?? 0));
  const pText = pVar > 0 ? `${pBase}-${pBase + pVar}` : `${pBase}`;
  const cText = cVar > 0 ? `${cBase}-${cBase + cVar}` : `${cBase}`;
  let h = `<div style="display:flex;flex-direction:column;gap:1px;width:100%;">`;
  h += `<div style="color:#ffcc66;font-weight:bold;white-space:nowrap;">${escapeHtml(a.name)}${multi}</div>`;
  h += `<div style="display:flex;flex-direction:column;gap:0;line-height:1.4;">`;
  h += `<div><span style="color:#7a8ca6;">Damage:</span> ${base}±${range}</div>`;
  h += `<div><span style="color:#7a8ca6;">Windup:</span> ${pText}t</div>`;
  h += `<div><span style="color:#7a8ca6;">Cooldown:</span> ${cText}t</div>`;
  h += `</div>`;
  if (desc) h += `<div style="color:#556677;font-size:11px;margin-top:2px;">${desc}</div>`;
  h += `</div>`;
  return h;
}

/**
 * Root command window: weapon attacks (or Fist fallback), potion slots, belt swap.
 * enter() is wired through callbacks so this does not close over the cascade.
 */
export function buildRootActionRows({
  w,
  weapons,
  potions,
  belt,
  hand,
  onPickTarget,
  onPickPotion,
  onPickEquip,
}) {
  const rootRows = [];
  if (w && w.id) {
    (w.attacks || []).forEach(a => {
      rootRows.push({
        html: escapeHtml(a.name),
        info: attackInfo(a, w),
        attack: a,
        enter() { onPickTarget(a); }
      });
    });
  } else {
    const fistW = weapons.fist;
    if (fistW && fistW.attacks && fistW.attacks.length > 0) {
      const fist = fistW.attacks[0];
      rootRows.push({
        html: escapeHtml(fist.name),
        info: attackInfo(fist, fistW),
        attack: fist,
        enter() { onPickTarget(fist); }
      });
    } else {
      // degrade without any numbers if server did not provide fist profile
      const attack = { id: 1, name: 'Fist (unarmed)', is_multi_target: false, description: '' };
      rootRows.push({
        html: 'Fist (unarmed)',
        info: '<strong>Fist (unarmed)</strong>',
        attack,
        enter() { onPickTarget(attack); }
      });
    }
  }
  rootRows.push({ blank: true });
  ['A', 'B'].forEach(slot => {
    const p = potionFor(potions, slot);
    const used = p && p.used;
    if (!p) {
      rootRows.push({ html: `Pouch ${slot}: <span class="dw-dim">empty</span>`, info: `Pouch ${slot}: no potion in this slot`, disabled: true });
      return;
    }
    if (used) {
      rootRows.push({ html: `${escapeHtml(p.template_name)} <span class="dw-dim">(USED)</span>`, info: `Pouch ${slot}: already used`, disabled: true });
      return;
    }
    rootRows.push({
      html: escapeHtml(p.template_name),
      info: `Pouch ${slot}: ${escapeHtml(p.template_name)} · ${escapeHtml(p.effect_label || '')}<br>`
        + `<span style="color:#7a8ca6;">Windup:</span> ${potionPrePostTicks((w && w.speed) || 0, p.rolled_speed || 0)}t`,
      potionTiming: {
        prepare_time: potionPrePostTicks((w && w.speed) || 0, p.rolled_speed || 0),
        prepare_time_range: 0,
        name: escapeHtml(p.template_name)
      },
      enter() { onPickPotion(slot, p); }
    });
  });
  rootRows.push({ blank: true });
  const swapDelay = belt && belt.id && w && w.id ? Math.max((w.speed || 2), (belt.speed || 2)) : null;
  rootRows.push({
    html: `Belt Loop: <span class="${belt && belt.id ? 'dw-weapon' : 'dw-dim'}">${escapeHtml(belt && belt.id ? belt.name : 'none')}</span>`,
    info: belt && belt.id
      ? `Belt swap (${hand}): swap ${escapeHtml(belt.name)} into hand · ${swapDelay} tics equip delay`
      : 'No belt weapon equipped',
    disabled: !belt || !belt.id,
    beltSwap: true,
    attack: belt && belt.id ? { prepare_time: swapDelay, prepare_time_range: 0, name: 'Belt Swap' } : null,
    enter() { if (belt && belt.id) onPickEquip(); }
  });
  return rootRows;
}
