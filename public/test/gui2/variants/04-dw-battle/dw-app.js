/**
 * Portal Colosseum — GUI2 Variant 04 (Dragon Warrior NES Battle)
 * Per-hand turn-gated command menu with info popup.
 * - LH or RH menu on ready hand
 * - Arrow keys + mouse, section headers skipped
 * - Both-hands demo with L/R switch
 * No inline scripts. No console spam.
 */

let narrationLines = [
  'A Glimmerling draws near.',
  'B Giant Rat joins the fray.',
  'C Glimmerling slinks in.',
  'A Glimmerling spits acid — you take 11 damage.',
  'You slash Glimmerling A for 16!',
  'B Giant Rat bites — miss!',
  'Your Fireball 1 hits B for 29 (B Injured).',
  'C Glimmerling attacks — you dodge!',
  'You slash Glimmerling C for 22!',
  'A Glimmerling is defeated.'
];

let narrationIndex = 0;
let narrationTimer = null;
let menuVisible = false;
let targetMode = false;
let currentMenuIndex = 0;
let currentTargetIndex = 0;
let currentHand = 'left'; // 'left' | 'right'
let bothHandsReady = false;

const messageBox = () => document.getElementById('message-box');
const commandMenu = () => document.getElementById('command-menu');
const arena = () => document.getElementById('arena');
const infoPopup = () => document.getElementById('info-popup');
const handLine = () => document.getElementById('hand-line');

const ATTACKS = {
  left: [
    { name: 'Quick Slash', info: 'Cast: 3-4 | CD: 1 | Phys/Slash | Dmg 12-22' },
    { name: 'Slash', info: 'Cast: 5-6 | CD: 2 | Phys/Slash | Dmg 18-30' }
  ],
  right: [
    { name: 'Fireball 1', info: 'Cast: 8-10 | CD: 4 | Magic/Fire | Dmg 22-38' },
    { name: 'Ice Bolt 2', info: 'Cast: 10-12 | CD: 3-5 | Magic/Ice | Dmg 20-35' }
  ]
};

const BELT = { name: 'Bronze Axe', info: '2h, replace both weapons, 30-40 tic equip time' };
const CONSUMABLES = [
  { name: 'Herb', info: 'Use: Restores a small amount of HP' },
  { name: 'Bomb', info: 'Use: Deals damage to all enemies' }
];

function showMessage(lines) {
  const box = messageBox();
  box.innerHTML = lines.join('<br>');
}

function appendNarration(text) {
  const box = messageBox();
  const current = box.innerHTML.split('<br>');
  current.push(text);
  if (current.length > 4) current.shift();
  box.innerHTML = current.join('<br>');
}

function startNarrationCycle() {
  if (narrationTimer) clearInterval(narrationTimer);
  narrationTimer = setInterval(() => {
    if (menuVisible || targetMode) return;
    if (narrationIndex < narrationLines.length) {
      appendNarration(narrationLines[narrationIndex]);
      narrationIndex++;
    } else {
      narrationIndex = 3;
      appendNarration(narrationLines[narrationIndex]);
      narrationIndex++;
    }
  }, 1600);
}

function pauseNarration() {
  if (narrationTimer) {
    clearInterval(narrationTimer);
    narrationTimer = null;
  }
}

function buildMenuRows(hand) {
  const menu = commandMenu();
  // clear previous rows except title and hand-line
  const existingRows = menu.querySelectorAll('.command-row, .section-header');
  existingRows.forEach(el => el.remove());

  const attacks = ATTACKS[hand];
  const weapon = hand === 'left' ? 'Iron Sword' : 'Arcane Wand';
  const handLabel = hand === 'left' ? 'L.HAND' : 'R.HAND';

  handLine().innerHTML = `<span class="hand-label">${handLabel}</span> — <span class="weapon-name">${weapon}</span>`;

  // attacks (selectable)
  attacks.forEach((atk, i) => {
    const row = document.createElement('div');
    row.className = 'command-row';
    row.dataset.name = atk.name;
    row.dataset.info = atk.info;
    row.textContent = atk.name;
    menu.appendChild(row);
  });

  // BELT LOOP header (non-selectable)
  const beltHeader = document.createElement('div');
  beltHeader.className = 'section-header';
  beltHeader.textContent = 'BELT LOOP';
  menu.appendChild(beltHeader);

  // belt row
  const beltRow = document.createElement('div');
  beltRow.className = 'command-row';
  beltRow.dataset.name = BELT.name;
  beltRow.dataset.info = BELT.info;
  beltRow.textContent = BELT.name;
  menu.appendChild(beltRow);

  // CONSUMABLES header
  const consHeader = document.createElement('div');
  consHeader.className = 'section-header';
  consHeader.textContent = 'CONSUMABLES';
  menu.appendChild(consHeader);

  // consumables
  CONSUMABLES.forEach(item => {
    const row = document.createElement('div');
    row.className = 'command-row';
    row.dataset.name = item.name;
    row.dataset.info = item.info;
    row.textContent = item.name;
    menu.appendChild(row);
  });

  // re-attach mouse handlers to new rows
  attachRowHandlers();
}

function attachRowHandlers() {
  const rows = commandMenu().querySelectorAll('.command-row');
  rows.forEach((row, idx) => {
    // remove old listeners if any by cloning? but for simplicity rebind
    row.onclick = null;
    row.onmouseenter = null;
    row.onclick = () => {
      if (!menuVisible || targetMode) return;
      currentMenuIndex = idx;
      highlightMenuRow(idx);
      selectMenuCommand();
    };
    row.onmouseenter = () => {
      if (menuVisible && !targetMode) {
        highlightMenuRow(idx);
      }
    };
  });
}

function showCommandMenu(hand = 'left', showBoth = false) {
  const menu = commandMenu();
  currentHand = hand;
  bothHandsReady = showBoth;

  buildMenuRows(hand);
  menu.classList.add('visible');
  menuVisible = true;
  currentMenuIndex = 0;
  highlightMenuRow(0);
  updateInfoPopup();

  const prefix = showBoth ? 'Command? (L/R to switch) ' : 'Command? ';
  const handName = hand === 'left' ? 'L.HAND' : 'R.HAND';
  showMessage([prefix + handName]);
  pauseNarration();
}

function hideCommandMenu() {
  const menu = commandMenu();
  menu.classList.remove('visible');
  menuVisible = false;
  bothHandsReady = false;
  clearMenuHighlight();
  hideInfoPopup();
}

function highlightMenuRow(index) {
  const rows = commandMenu().querySelectorAll('.command-row');
  // only selectable rows (no section headers)
  rows.forEach((r, i) => {
    r.classList.toggle('active', i === index);
  });
  currentMenuIndex = index;
  updateInfoPopup();
}

function clearMenuHighlight() {
  const rows = commandMenu().querySelectorAll('.command-row');
  rows.forEach(r => r.classList.remove('active'));
  hideInfoPopup();
}

function updateInfoPopup() {
  const popup = infoPopup();
  const rows = commandMenu().querySelectorAll('.command-row');
  const active = rows[currentMenuIndex];
  if (!active || !menuVisible) {
    popup.style.display = 'none';
    return;
  }
  const name = active.dataset.name;
  const info = active.dataset.info;
  popup.innerHTML = `${name} — ${info}`;
  popup.style.display = 'block';
}

function hideInfoPopup() {
  const popup = infoPopup();
  if (popup) popup.style.display = 'none';
}

function selectMenuCommand() {
  const rows = commandMenu().querySelectorAll('.command-row');
  const row = rows[currentMenuIndex];
  if (!row) return;
  const name = row.dataset.name;

  hideCommandMenu();

  if (name === 'Quick Slash' || name === 'Slash' || name === 'Fireball 1' || name === 'Ice Bolt 2') {
    enterTargetMode();
  } else if (name === 'Bronze Axe') {
    appendNarration('Equipping the Bronze Axe takes 30-40 tics.');
    setTimeout(() => {
      // return menu (demo keeps same hand)
      showCommandMenu(currentHand, bothHandsReady);
    }, 1400);
  } else if (name === 'Herb') {
    appendNarration('You use the Herb — some HP restored.');
    setTimeout(() => {
      showCommandMenu(currentHand, bothHandsReady);
    }, 1400);
  } else if (name === 'Bomb') {
    appendNarration('You throw the Bomb — every monster takes damage!');
    setTimeout(() => {
      showCommandMenu(currentHand, bothHandsReady);
    }, 1400);
  }
}

function enterTargetMode() {
  targetMode = true;
  currentTargetIndex = 0;
  highlightTarget(0);
  appendNarration('Select target...');
  hideInfoPopup();
}

function exitTargetMode(cancel = false) {
  targetMode = false;
  clearTargetHighlights();
  if (!cancel) {
    setTimeout(() => {
      showCommandMenu(currentHand, bothHandsReady);
    }, 800);
  } else {
    showCommandMenu(currentHand, bothHandsReady);
  }
}

function highlightTarget(idx) {
  clearTargetHighlights();
  currentTargetIndex = idx;

  const wrappers = document.querySelectorAll('.monster-wrapper');
  if (wrappers[idx]) wrappers[idx].classList.add('selected');

  const targets = document.querySelectorAll('.monster-target');
  if (targets[idx]) targets[idx].classList.add('selected');
}

function clearTargetHighlights() {
  document.querySelectorAll('.monster-wrapper').forEach(w => w.classList.remove('selected'));
  document.querySelectorAll('.monster-target').forEach(t => t.classList.remove('selected'));
}

function confirmTarget() {
  const letters = ['A', 'B', 'C'];
  const target = letters[currentTargetIndex];
  const targets = document.querySelectorAll('.monster-target');
  const full = targets[currentTargetIndex].textContent.trim();
  const nameMatch = full.match(/-\s*(.+?)\s+(Healthy|Injured|Battered)/);
  const monsterName = nameMatch ? nameMatch[1] : 'Monster';

  clearTargetHighlights();
  targetMode = false;

  appendNarration(`You slash ${monsterName} ${target} for 16!`);
  setTimeout(() => {
    appendNarration(`${monsterName} takes 16 damage.`);
    setTimeout(() => {
      // after attack, progress demo hands
      advanceDemoHand();
    }, 1200);
  }, 900);
}

function advanceDemoHand() {
  // Demo sequence: LH -> RH -> both (switchable) -> loop
  if (currentHand === 'left' && !bothHandsReady) {
    // first attack done -> show RH
    setTimeout(() => {
      showCommandMenu('right');
    }, 600);
  } else if (currentHand === 'right' && !bothHandsReady) {
    // second attack -> demonstrate BOTH hands ready
    setTimeout(() => {
      bothHandsReady = true;
      showCommandMenu('left', true);
    }, 600);
  } else {
    // after both demo, loop back to LH
    setTimeout(() => {
      bothHandsReady = false;
      showCommandMenu('left');
    }, 600);
  }
}

function switchHand(newHand) {
  if (!bothHandsReady || !menuVisible || targetMode) return;
  currentHand = newHand;
  const menu = commandMenu();
  // rebuild only the attack rows + update hand line (belt/cons stay)
  const existingAttackRows = menu.querySelectorAll('.command-row');
  // remove first 2 (attacks)
  for (let i = 0; i < 2; i++) {
    if (existingAttackRows[i]) existingAttackRows[i].remove();
  }

  const attacks = ATTACKS[newHand];
  const weapon = newHand === 'left' ? 'Iron Sword' : 'Arcane Wand';
  const handLabel = newHand === 'left' ? 'L.HAND' : 'R.HAND';
  handLine().innerHTML = `<span class="hand-label">${handLabel}</span> — <span class="weapon-name">${weapon}</span>`;

  const title = menu.querySelector('.title');
  attacks.forEach((atk, i) => {
    const row = document.createElement('div');
    row.className = 'command-row';
    row.dataset.name = atk.name;
    row.dataset.info = atk.info;
    row.textContent = atk.name;
    title.after(row); // insert after title, before hand? wait order
  });

  // re-attach
  attachRowHandlers();
  currentMenuIndex = 0;
  highlightMenuRow(0);
  const handName = newHand === 'left' ? 'L.HAND' : 'R.HAND';
  showMessage(['Command? (L/R to switch) ' + handName]);
}

function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (targetMode) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        currentTargetIndex = (currentTargetIndex + dir + 3) % 3;
        highlightTarget(currentTargetIndex);
        e.preventDefault();
      } else if (e.key === 'Enter') {
        confirmTarget();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        exitTargetMode(true);
        e.preventDefault();
      }
    } else if (menuVisible) {
      const rows = commandMenu().querySelectorAll('.command-row');
      if (e.key === 'ArrowUp') {
        // skip section headers: find previous selectable
        let newIdx = currentMenuIndex - 1;
        while (newIdx >= 0 && !rows[newIdx]) newIdx--; // safety
        if (newIdx < 0) newIdx = rows.length - 1;
        currentMenuIndex = newIdx;
        highlightMenuRow(currentMenuIndex);
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        let newIdx = currentMenuIndex + 1;
        if (newIdx >= rows.length) newIdx = 0;
        currentMenuIndex = newIdx;
        highlightMenuRow(currentMenuIndex);
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (bothHandsReady) {
          const newHand = currentHand === 'left' ? 'right' : 'left';
          switchHand(newHand);
          e.preventDefault();
        }
      } else if (e.key === 'Enter') {
        selectMenuCommand();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        hideCommandMenu();
        startNarrationCycle();
        e.preventDefault();
      }
    } else {
      if (e.key === 'Enter' || e.key === ' ') {
        showCommandMenu('left');
        e.preventDefault();
      }
    }
  });
}

function setupMouse() {
  // Monster targets
  document.querySelectorAll('.monster-target').forEach((el, idx) => {
    el.addEventListener('click', () => {
      if (targetMode) {
        currentTargetIndex = idx;
        highlightTarget(idx);
        confirmTarget();
      }
    });
  });

  // Sprite wrappers
  document.querySelectorAll('.monster-wrapper').forEach((el, idx) => {
    el.addEventListener('click', () => {
      if (targetMode) {
        currentTargetIndex = idx;
        highlightTarget(idx);
        confirmTarget();
      }
    });
  });

  // Click arena to show menu (demo)
  arena().addEventListener('click', () => {
    if (!menuVisible && !targetMode) {
      showCommandMenu('left');
    }
  });
}

function init() {
  // Initial encounter lines already in HTML
  // Demo: after delay show LH menu first
  setTimeout(() => {
    showCommandMenu('left');
  }, 3200);

  // Start narration cycle
  setTimeout(() => {
    startNarrationCycle();
  }, 3800);

  setupKeyboard();
  setupMouse();

  // extra narration seed
  setTimeout(() => {
    if (!menuVisible) {
      appendNarration('The battle rages on...');
    }
  }, 5200);
}

init();