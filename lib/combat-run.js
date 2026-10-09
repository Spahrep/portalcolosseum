/**
 * Shared combat run helpers used by the player catch-all and /dev/* routes.
 * Bodies moved verbatim; `admin` is a parameter instead of a handle() closure.
 * IDOR: findActiveRun always chains .eq('user_id', userId).
 */
export async function startingHp(admin) {
  try {
    const { data } = await admin.from('game_config').select('starting_hp').eq('id', 1).maybeSingle();
    const v = Number(data?.starting_hp);
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export async function generateOneMonster(admin, templateId, usedLabels) {
  let tmpl;
  try {
    const tRes = await admin.from('monster_template').select('id, name').eq('id', templateId).single();
    tmpl = tRes.data;
    if (tRes.error || !tmpl) throw tRes.error || new Error('not found');
  } catch (e) {
    return { error: 'monster template not found', status: 404 };
  }
  let gen;
  try {
    const { data } = await admin.rpc('generate_monster', { p_template_id: templateId });
    gen = data;
    if (!gen) throw new Error('rpc null');
  } catch (e) {
    console.error('generate_monster rpc error', e);
    return { error: 'Internal server error', status: 500 };
  }
  // next free A-Z label
  const used = new Set(usedLabels || []);
  let label = null;
  for (let i = 0; i < 26; i++) {
    const cand = `Monster ${String.fromCharCode(65 + i)}`;
    if (!used.has(cand)) { label = cand; break; }
  }
  if (!label) label = `Monster #${gen.id || templateId}`;
  // normalize attacks from RPC JSONB slot objects (never [null])
  const attacks = ['slot_0_attack', 'slot_1_attack', 'slot_2_attack', 'slot_3_attack', 'slot_4_attack']
    .map(k => gen[k])
    .filter(a => a && typeof a === 'object' && a.id);
  return { ...gen, attacks, label, name: tmpl.name };
}

export async function findActiveRun(admin, userId) {
  try {
    const { data: run } = await admin.from('portal_run').select('*').eq('user_id', userId).eq('status', 'active').order('created_at', { ascending: false }).limit(1).single();
    return run || null;
  } catch (_) {
    return null;
  }
}

export async function handApproachSpeeds(admin, handL, handR) {
  const ids = [handL, handR].filter(id => id != null);
  const speeds = {};
  if (ids.length > 0) {
    try {
      const { data: wInsts } = await admin.from('weapon_instance').select('id, speed').in('id', ids);
      for (const w of (wInsts || [])) speeds[w.id] = w.speed;
    } catch (e) {
      console.error('hand speed fetch error', e);
    }
  }
  let fistSpeed = 6;
  try {
    const { data: cfg } = await admin.from('game_config').select('fist_speed').eq('id', 1).maybeSingle();
    if (cfg && cfg.fist_speed != null) fistSpeed = cfg.fist_speed;
  } catch (e) {
    console.error('fist_speed fetch error', e);
  }
  return {
    hand_l_speed: handL != null ? (speeds[handL] ?? fistSpeed) : fistSpeed,
    hand_r_speed: handR != null ? (speeds[handR] ?? fistSpeed) : fistSpeed
  };
}

export async function buildPotionLoadout(admin, run) {
  const ids = [run.consume_a_id, run.consume_b_id].filter(Boolean);
  const map = {};
  // PC-72: potion crit multipliers come from game_config; crit_chance from the instance.
  let critEffectMultiplier = 1.5;
  let critDurationMultiplier = 1.5;
  try {
    const { data: gc } = await admin.from('game_config')
      .select('potion_crit_effect_multiplier, potion_crit_duration_multiplier')
      .eq('id', 1).maybeSingle();
    if (gc) {
      critEffectMultiplier = gc.potion_crit_effect_multiplier ?? 1.5;
      critDurationMultiplier = gc.potion_crit_duration_multiplier ?? 1.5;
    }
  } catch (e) {
    console.error('potion crit config fetch error', e);
  }
  if (ids.length) {
    try {
      const { data: rows } = await admin
        .from('consumable_instance')
        .select('id, rolled_floor, rolled_window, rolled_speed, crit_chance, consumable_template:template_id (name, effect_type, duration_ticks)')
        .in('id', ids);
      for (const inst of (rows || [])) {
        map[inst.id] = {
          effect_type: inst.consumable_template?.effect_type || 'heal',
          template_name: inst.consumable_template?.name || 'Potion',
          rolled_floor: inst.rolled_floor,
          rolled_window: inst.rolled_window,
          rolled_speed: inst.rolled_speed,
          duration_ticks: inst.consumable_template?.duration_ticks,
          crit_chance: inst.crit_chance ?? 0,
          critEffectMultiplier,
          critDurationMultiplier,
          used: run.consume_a_id === inst.id ? !!run.consume_a_used : !!run.consume_b_used
        };
      }
    } catch (e) {
      console.error('potion loadout fetch error', e);
    }
  }
  return {
    A: run.consume_a_id ? (map[run.consume_a_id] || null) : null,
    B: run.consume_b_id ? (map[run.consume_b_id] || null) : null
  };
}
