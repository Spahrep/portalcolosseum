// scripts/cli/potion-format.mjs
// Pure text builders for the `use`/`drink` potion command (PC-39 CLI parity).
// No I/O, no printing — imported by commands.mjs and the CLI fixture tests.
//
// The engine (js/combat/engine.js) logs potion events as raw feed lines:
//   in-battle commit: tic N — LH drinks Heal (3 tics)
//   effect land:      tic N — LH healed 24   |   tic N — LH damage +3 until tic 15
//   recovery:         tic N — LH Ready  (mapped by the existing ready rule)
//   between-fights:   tic N — Potion A used — healed 24
//   buff expiry:      tic N — Vigor Tonic buff expired
// mapPotionFeedLine turns those into player-facing narration.

import { PLAYER_MAX_HP } from '../../js/combat/participants.js';

const HAND_WORD = { LH: 'left', RH: 'right' };

// Engine feed line -> player-facing narration. Returns {text, matched}.
export function mapPotionFeedLine(raw) {
  if (!raw) return { text: '', matched: false };
  let m = raw.match(/^tic \d+ — (LH|RH) drinks (.+?) \((\d+) tics\)$/);
  if (m) {
    return { text: `Your ${HAND_WORD[m[1]]} hand drinks ${m[2]} (${m[3]} tics)…`, matched: true };
  }
  m = raw.match(/^tic \d+ — (LH|RH) healed (\d+)$/);
  if (m) {
    return { text: `Your ${HAND_WORD[m[1]]} hand's potion restores ${m[2]} HP.`, matched: true };
  }
  m = raw.match(/^tic \d+ — (LH|RH) (damage|speed|accuracy) \+(\d+) until tic (\d+)$/);
  if (m) {
    return { text: `Your ${HAND_WORD[m[1]]} hand's potion grants ${m[2]} +${m[3]} until tic ${m[4]}.`, matched: true };
  }
  m = raw.match(/^tic \d+ — Potion ([AB]) used — (.+)$/);
  if (m) {
    return { text: `You drink potion ${m[1].toLowerCase()} — ${m[2]}.`, matched: true };
  }
  m = raw.match(/^tic \d+ — (.+?) buff expired$/);
  if (m) {
    return { text: `The ${m[1]} buff fades.`, matched: true };
  }
  return { text: '', matched: false };
}

// Buff list (engine state.buffs) -> one-line summary. Empty/no buffs -> 'none'.
export function formatBuffs(buffs) {
  const active = (buffs || []).filter(b => b && typeof b.type === 'string' && Number.isFinite(b.endTic));
  if (!active.length) return 'none';
  return active.map(b => `${b.type} +${b.value} until tic ${b.endTic}`).join(' | ');
}

// Command args -> potion slot. Accepts 'A'|'B' (case-insensitive) and tolerates
// 'potion A' (card example shape). Returns {slot} or {error}.
export function parsePotionSlot(args) {
  const tokens = (args || []).map(t => String(t)).filter(t => t.trim() !== '');
  let slot = (tokens[0] || '').trim();
  if (slot.toLowerCase() === 'potion') slot = (tokens[1] || '').trim();
  slot = slot.toUpperCase();
  if (slot !== 'A' && slot !== 'B') {
    return { error: 'usage: use A|B  (alias: drink A|B)' };
  }
  return { slot };
}

// Engine/API error -> CLI classification (level + user-facing text).
// amber = recoverable by typing "wait"; error = terminal for this command.
export function classifyPotionError(message) {
  const msg = String(message || '');
  if (msg === 'No free hand') {
    return { level: 'amber', text: 'No free hand — both hands are busy. Type "wait" to advance until one is ready.' };
  }
  if (msg === 'Hand not ready') {
    return { level: 'amber', text: 'That hand is busy. Type "wait" to advance until it is ready.' };
  }
  if (msg === 'Potion already used') {
    return { level: 'error', text: 'That potion is already used.' };
  }
  if (msg.startsWith('No potion in slot')) {
    return { level: 'error', text: `${msg}.` };
  }
  return { level: 'error', text: msg || 'Potion use failed.' };
}

// Post-use summary line from the engine state + use-potion response meta.
export function formatPotionSummary(state, meta = {}) {
  const slot = String(meta.slot || '').toUpperCase();
  const phaseWord = meta.phase === 'in-battle' ? 'in battle' : 'between fights';
  const hp = state && state.participants && state.participants.player
    ? state.participants.player.hp
    : null;
  const hpPart = hp == null ? '' : `HP: ${hp}/${PLAYER_MAX_HP}`;
  const buffPart = `buffs: ${formatBuffs(state && state.buffs)}`;
  return [`Potion ${slot} used — ${phaseWord}.`, hpPart, buffPart].filter(Boolean).join('  ');
}

// Consumable row (from GET /consumables) -> inventory display line.
// The API returns template_name + effect_label, not `name`/`quantity`.
export function formatConsumableSummary(c) {
  if (!c) return '';
  const parts = [`#${c.id}`, c.template_name || 'Unknown'];
  if (c.effect_label) parts.push(c.effect_label);
  if (c.grade) parts.push(`grade ${c.grade}`);
  if (c.used) parts.push('(used)');
  return parts.join(' ');
}
