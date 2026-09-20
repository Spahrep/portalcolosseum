import { selectMonsterGroup } from '../js/combat/dice.js';

const mappings = [
  { monster_template_id: 1, point_cost: 6, weight: 1 },
  { monster_template_id: 2, point_cost: 7, weight: 1 },
  { monster_template_id: 3, point_cost: 8, weight: 1 },
  { monster_template_id: 4, point_cost: 9, weight: 1 },
  { monster_template_id: 5, point_cost: 10, weight: 1 }
];

const budgets = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

for (const budget of budgets) {
  const counts = {};
  let total = 0;
  for (let i = 0; i < 10000; i++) {
    const g = selectMonsterGroup(budget, mappings);
    const c = g.length;
    counts[c] = (counts[c] || 0) + 1;
    total++;
  }
  console.log(`\nBudget=${budget}:`);
  for (let c = 1; c <= 5; c++) {
    if (counts[c]) console.log(`  ${c} monsters: ${counts[c]} (${(counts[c]/total*100).toFixed(1)}%)`);
  }
  // Also show what the group actually contains in a sample
  const sample = selectMonsterGroup(budget, mappings);
  const costs = sample.map(m => m.point_cost).join('+');
  console.log(`  Sample: [${costs}] = ${sample.reduce((s, m) => s + m.point_cost, 0)} pts`);
}