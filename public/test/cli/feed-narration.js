/**
 * Feed narrator. Owns the rolling seenFeed set.
 * Contract: createFeedNarrator({ appendLine, printDim }) -> narrateFeed.
 */
export function createFeedNarrator({ appendLine, printDim }) {
  const seenFeed = new Set();
  function narrateFeed(feedLines, participants = null) {
    if (!feedLines || !Array.isArray(feedLines) || feedLines.length === 0) return;

    // extract monster labels for possessive matching (exact labels like "Glimmerling A")
    const monsterLabels = [];
    const p = participants || {};
    if (p.monsters && Array.isArray(p.monsters)) {
      p.monsters.forEach(m => { if (m && m.label) monsterLabels.push(m.label); });
    }
    const getMonsterLabel = (text) => {
      for (const lbl of monsterLabels) {
        if (text.includes(lbl)) return lbl;
      }
      // first-two-words fallback for monster names
      const m = text.match(/tic \d+ — ([A-Za-z]+(?:\s+[A-Z])?)/);
      return m ? m[1] : null;
    };

    // filter only NEW lines (rolling feed dedupe)
    const newLines = feedLines.filter(l => !seenFeed.has(l));
    newLines.forEach(l => seenFeed.add(l));

    const outputEntries = []; // {text, matched}

    for (const raw of newLines) {
      let mapped = null;

      // Rule: tic N — Monster quick attack hits you for NUM damage → "Monster's quick attack hits you for NUM damage."
      // DEFECT 1 FIX: use getMonsterLabel + exact strip + greedy fallback
      let label = getMonsterLabel(raw);
      let m;
      if (label) {
        const remainder = raw.replace(label, '').replace(/^tic \d+ — \s*/, '');
        m = remainder.match(/^(.+?)?\s*hits you for (\d+) damage$/);
        if (m) {
          mapped = m[1] && m[1].trim() ? `${label}'s ${m[1].trim()} hits you for ${m[2]} damage.` : `${label} hits you for ${m[2]} damage.`;
          outputEntries.push({ text: mapped, matched: true });
          continue;
        }
      }
      // greedy fallback when no known labels
      m = raw.match(/^tic \d+ — ([A-Za-z]+(?: [A-Z])?)(?: (.+?))? hits you for (\d+) damage$/);
      if (m) {
        const mon = m[1];
        mapped = m[2] && m[2].trim() ? `${mon}'s ${m[2].trim()} hits you for ${m[3]} damage.` : `${mon} hits you for ${m[3]} damage.`;
        outputEntries.push({ text: mapped, matched: true });
        continue;
      }

      // Rule: misses — same fix
      label = getMonsterLabel(raw);
      if (label) {
        const remainder = raw.replace(label, '').replace(/^tic \d+ — \s*/, '');
        m = remainder.match(/^(.+?)?\s*misses$/);
        if (m) {
          mapped = m[1] && m[1].trim() ? `${label}'s ${m[1].trim()} misses you.` : `${label} misses you.`;
          outputEntries.push({ text: mapped, matched: true });
          continue;
        }
      }
      m = raw.match(/^tic \d+ — ([A-Za-z]+(?: [A-Z])?)(?: (.+?))? misses$/);
      if (m) {
        const mon = m[1];
        mapped = m[2] && m[2].trim() ? `${mon}'s ${m[2].trim()} misses you.` : `${mon} misses you.`;
        outputEntries.push({ text: mapped, matched: true });
        continue;
      }

      // Rule: tic N — Monster is defeated → "Monster is defeated!"
      m = raw.match(/^tic \d+ — (.+?) is defeated$/);
      if (m) {
        mapped = `${m[1]} is defeated!`;
        outputEntries.push({ text: mapped, matched: true });
        continue;
      }

      // Rule: tic N — LH commits AttackName (cast N) → "Your left hand begins casting AttackName…"
      m = raw.match(/^tic \d+ — LH commits (.+?) \(cast \d+\)$/);
      if (m) {
        mapped = `Your left hand begins casting ${m[1]}…`;
        outputEntries.push({ text: mapped, matched: true });
        continue;
      }

      // Rule: tic N — RH commits ...
      m = raw.match(/^tic \d+ — RH commits (.+?) \(cast \d+\)$/);
      if (m) {
        mapped = `Your right hand begins casting ${m[1]}…`;
        outputEntries.push({ text: mapped, matched: true });
        continue;
      }

      // Rule: tic N — LH AttackName hits Monster for NUM → "Your left hand's AttackName hits Monster for NUM."
      m = raw.match(/^tic \d+ — LH (.+?) hits (.+?) for (\d+)$/);
      if (m) {
        mapped = `Your left hand's ${m[1]} hits ${m[2]} for ${m[3]}.`;
        outputEntries.push({ text: mapped, matched: true });
        continue;
      }

      // Rule: tic N — RH AttackName hits ...
      m = raw.match(/^tic \d+ — RH (.+?) hits (.+?) for (\d+)$/);
      if (m) {
        mapped = `Your right hand's ${m[1]} hits ${m[2]} for ${m[3]}.`;
        outputEntries.push({ text: mapped, matched: true });
        continue;
      }

      // PC-39 potion rules (mirror js/combat/potion-format.mjs mapPotionFeedLine)
      m = raw.match(/^tic \d+ — (LH|RH) drinks (.+?) \((\d+) tics\)$/);
      if (m) {
        mapped = `Your ${m[1] === 'LH' ? 'left' : 'right'} hand drinks ${m[2]} (${m[3]} tics)…`;
        outputEntries.push({ text: mapped, matched: true });
        continue;
      }
      m = raw.match(/^tic \d+ — (LH|RH) healed (\d+)$/);
      if (m) {
        mapped = `Your ${m[1] === 'LH' ? 'left' : 'right'} hand's potion restores ${m[2]} HP.`;
        outputEntries.push({ text: mapped, matched: true });
        continue;
      }
      m = raw.match(/^tic \d+ — (LH|RH) (damage|speed|accuracy) \+(\d+) until tic (\d+)$/);
      if (m) {
        mapped = `Your ${m[1] === 'LH' ? 'left' : 'right'} hand's potion grants ${m[2]} +${m[3]} until tic ${m[4]}.`;
        outputEntries.push({ text: mapped, matched: true });
        continue;
      }
      m = raw.match(/^tic \d+ — Potion ([AB]) used — (.+)$/);
      if (m) {
        mapped = `You drink potion ${m[1].toLowerCase()} — ${m[2]}.`;
        outputEntries.push({ text: mapped, matched: true });
        continue;
      }
      m = raw.match(/^tic \d+ — (.+?) buff expired$/);
      if (m) {
        mapped = `The ${m[1]} buff fades.`;
        outputEntries.push({ text: mapped, matched: true });
        continue;
      }

      // unmatched
      outputEntries.push({ text: raw, matched: false });
    }

    // emit with colors: matched = green, unmatched = dim
    outputEntries.forEach(entry => {
      if (!entry.matched) {
        printDim(entry.text);
      } else {
        appendLine(entry.text, 'green');
      }
    });
  }
  return narrateFeed;
}
