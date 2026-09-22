// js/combat/participants.js
// Pure ESM. Player (max HP from config, two hands) and monsters (rolled stats, secret max_hp).
// Hand state: Ready -> winding -> impact -> cooldown -> Ready. Monster rows per-cycle.

export const PLAYER_MAX_HP = 1000; // engine default; live value comes from game_config.starting_hp

export function createPlayer(loadout, maxHp = PLAYER_MAX_HP) {
  return {
    type: 'player',
    hp: maxHp,
    max_hp: maxHp,
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
  return player.hp < 0;
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

// PC-56 / PC-54: mid-battle belt swap
// Swaps hand weapon with belt weapon when hand Ready.
// Uses weapon `speed` field (NOT base_speed) for delay = max(speed old, speed belt).
// Drops unused queue param. Returns {success:true, delay, newWeaponId, oldWeaponId} or {success:false, error}
export function swapHandWithBelt(hand, player, weapons) {
  if (!player || !player.hands || !player.hands[hand]) {
    return { success: false, error: 'invalid hand' };
  }
  if (player.hands[hand].state !== 'Ready') {
    return { success: false, error: 'hand not Ready' };
  }
  if (!weapons || !weapons.belt) {
    return { success: false, error: 'no belt weapon' };
  }
  const beltWeapon = weapons.belt;
  const handId = player.hands[hand].weaponId;
  let handWeapon = null;
  if (hand === 'LH' && weapons.hand_l) handWeapon = weapons.hand_l;
  else if (hand === 'RH' && weapons.hand_r) handWeapon = weapons.hand_r;
  else handWeapon = { id: handId, speed: 2, name: 'unknown' };

  // perform swap
  player.hands[hand].weaponId = beltWeapon.id;
  if (hand === 'LH') {
    weapons.hand_l = beltWeapon;
  } else if (hand === 'RH') {
    weapons.hand_r = beltWeapon;
  }
  weapons.belt = handWeapon;

  const delay = Math.max(
    (handWeapon && handWeapon.speed) || 2,
    (beltWeapon && beltWeapon.speed) || 2
  );

  return { success: true, delay, newWeaponId: beltWeapon.id, oldWeaponId: handId };
}
