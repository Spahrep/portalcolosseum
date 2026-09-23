import createEngine from './js/combat/engine.js';

function seededRNG(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xFFFFFFFF; return (s >>> 0) / 0xFFFFFFFF; };
}

const eng = createEngine(seededRNG(7));
eng.startBattle({
  loadout: { hand_l: 1, hand_r: 2 },
  monsters: [{ id: 1, max_hp: 500, damage: 1, speed: 40, accuracy: 1, label: 'A' }]
});

let s = eng.getState();
console.log('after start:', JSON.stringify({
  tic: s.tic,
  q: s.queue.map(r=>({l:r.label, e:r.event, t:r.tics})),
  hands: {LH: s.participants.player.hands.LH?.state, RH: s.participants.player.hands.RH?.state}
}));

const afterLH = eng.commitAttack('LH', 1, [1], { castTicks: 38, cooldownTicks: 38, playerDamage: 5, attackName: 'Attack' });
s = eng.getState();
console.log('after commit LH:', JSON.stringify({
  tic: s.tic,
  q: s.queue.map(r=>({l:r.label, e:r.event, t:r.tics})),
  hands: {LH: s.participants.player.hands.LH?.state, RH: s.participants.player.hands.RH?.state}
}));

const afterRH = eng.commitAttack('RH', 1, [1], { castTicks: 38, cooldownTicks: 38, playerDamage: 5, attackName: 'Attack' });
s = eng.getState();
console.log('after commit RH:', JSON.stringify({
  tic: s.tic,
  q: s.queue.map(r=>({l:r.label, e:r.event, t:r.tics})),
  hands: {LH: s.participants.player.hands.LH?.state, RH: s.participants.player.hands.RH?.state}
}));

const ok = s.tic > 40;
console.log('tic > 40:', ok, '(tic=' + s.tic + ')');