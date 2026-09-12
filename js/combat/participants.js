// js/combat/participants.js
// Pure ESM. Player (HP 1000, two hands) and monsters (rolled stats, secret max_hp).
// Hand state: Ready -> winding -> impact -> cooldown -> Ready. Monster rows per-cycle.

export const PLAYER_MAX_HP = 1000;

export function createPlayer(loadout) {
  return {
    type: 'player',
    hp: PLAYER_MAX_HP,
    hands: {
      LH: { state: 'Ready', weaponId: loadout.hand_l, attackId: null },
      RH: { state: 'Ready', weaponId: loadout.hand_r, attackId: null }
    }
  };
}

export function createMonster(instance, templateName = 'mob') {
  // spread instance FIRST so slot_0_attack..slot_4_attack (and id/template_id) survive for state route
  // attacks: non-empty array wins; else map+filter slots; else [] (never [null]/[undefined])
  const attacks = (Array.isArray(instance?.attacks) && instance.attacks.some(a => a && typeof a === 'object' && a.id))
    ? instance.attacks
    : ['slot_0_attack', 'slot_1_attack', 'slot_2_attack', 'slot_3_attack', 'slot_4_attack']
        .map(k => instance?.[k])
        .filter(a => a && typeof a === 'object' && a.id) || [];
  return {
    ...instance,
    type: 'monster',
    label: instance.label || 'M',
    max_hp: instance.max_hp, // secret
    current_hp: instance.max_hp,
    damage: instance.damage,
    speed: Math.max(1, Number(instance.speed) || 1), // R9: clamp speed >=1 to prevent zero-tic re-fire
    accuracy: instance.accuracy,
    attacks,
    template_name: templateName
  };
}

export function isPlayerDead(player) {
  return player.hp <= 0;
}

export function isMonsterDead(monster) {
  return monster.current_hp <= 0;
}

export function applyDamage(target, amount) {
  if (target.type === 'player') {
    target.hp = Math.max(0, target.hp - amount);
  } else {
    target.current_hp = Math.max(0, target.current_hp - amount);
  }
}
