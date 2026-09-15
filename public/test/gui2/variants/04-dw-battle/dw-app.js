/**
 * Portal Colosseum — GUI2 Variant 04 (Dragon Warrior NES Battle)
 * Flat menu, attack target confirm flow, item confirm prompts, timing rail markers, L->R sequencing only.
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
let currentHand = 'left';
let selectedAttackName = null;
let pendingConfirmAction = null; // for item confirms

const messageBox = () => document.getElementById('message-box');
const commandMenu = () => document.getElementById('command-menu');
const arena = () => document.getElementById('arena');
const infoPopup = () => document.getElementById('info-popup');
const handLine = () => document.getElementById('hand-line');
const lootWindow = () => document.getElementById('loot-window');
const lootChip = () => document.getElementById('loot-chip');

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

const QUEUE_TICS = [3,4,5,9,12,18,23,27];
const ATTACK_WINDOWS = {
  'Quick Slash': [3,4],
  'Slash': [5,6],
  'Fireball 1': [8,10],
  'Ice Bolt 2': [10,12]
};

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
  const existingRows = menu.querySelectorAll('.command-row, .section-header');
  existingRows.forEach(el => el.remove());

  const attacks = ATTACKS[hand];
  const weapon = hand === 'left' ? 'Iron Sword' : 'Arcane Wand';
  const handLabel = hand === 'left' ? 'L.HAND' : 'R.HAND';

  handLine().innerHTML = `<span class="hand-label">${handLabel}</span> — <span class="weapon-name">${weapon}</span>`;

  // flat attacks
  attacks.forEach((atk) => {
    const row = document.createElement('div');
    row.className = 'command-row';
    row.dataset.name = atk.name;
    row.dataset.info = atk.info;
    row.textContent = atk.name;
    menu.appendChild(row);
  });

  // flat C1/C2/BL rows
  const itemDefs = [
    { name: 'Herb', label: 'C1: Herb', info: 'Use: Restores a small amount of HP' },
    { name: 'Bomb', label: 'C2: Bomb', info: 'Use: Deals damage to all enemies' },
    { name: 'Bronze Axe', label: 'BL: Bronze Axe', info: '2h, replace both weapons, 30-40 tic equip time' }
  ];
  itemDefs.forEach(item => {
    const row = document.createElement('div');
    row.className = 'command-row';
    row.dataset.name = item.name;
    row.dataset.info = item.info;
    row.textContent = item.label;
    menu.appendChild(row);
  });

  attachRowHandlers();
  clearTimingMarkers();
}

function attachRowHandlers() {
  const rows = commandMenu().querySelectorAll('.command-row');
  rows.forEach((row, idx) => {
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

function showCommandMenu(hand = 'left') {
  const menu = commandMenu();
  const win = lootWindow();
  if (win) win.classList.remove('visible');
  currentHand = hand;

  buildMenuRows(hand);
  menu.classList.add('visible');
  menuVisible = true;
  currentMenuIndex = 0;
  highlightMenuRow(0);
  updateInfoPopup();

  const handName = hand === 'left' ? 'L.HAND' : 'R.HAND';
  showMessage(['Command? ' + handName]);
  pauseNarration();
}

function hideCommandMenu() {
  const menu = commandMenu();
  menu.classList.remove('visible');
  menuVisible = false;
  clearMenuHighlight();
  hideInfoPopup();
  clearTimingMarkers();
}

function highlightMenuRow(index) {
  const rows = commandMenu().querySelectorAll('.command-row');
  rows.forEach((r, i) => {
    r.classList.toggle('active', i === index);
  });
  currentMenuIndex = index;
  updateInfoPopup();
  // timing markers for attacks only
  const row = rows[index];
  if (row && ATTACK_WINDOWS[row.dataset.name]) {
    updateTimingMarkers(row.dataset.name);
  } else {
    clearTimingMarkers();
  }
}

function clearMenuHighlight() {
  const rows = commandMenu().querySelectorAll('.command-row');
  rows.forEach(r => r.classList.remove('active'));
  hideInfoPopup();
  clearTimingMarkers();
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

function updateTimingMarkers(attackName) {
  clearTimingMarkers();
  const win = ATTACK_WINDOWS[attackName];
  if (!win) return;
  const [minT, maxT] = win;
  const queueRows = document.querySelectorAll('.right-rail .queue-row');
  const markers = [];

  let inside = false;
  for (let i = 0; i < QUEUE_TICS.length; i++) {
    const t = QUEUE_TICS[i];
    if (t > minT && t < maxT) {
      inside = true;
      break;
    }
  }

  if (!inside) {
    // single > on first queue row at or after max
    for (let i = 0; i < QUEUE_TICS.length; i++) {
      if (QUEUE_TICS[i] >= maxT) {
        markers.push(i);
        break;
      }
    }
  } else {
    // pair: last before min, first after max
    let before = -1;
    let after = -1;
    for (let i = 0; i < QUEUE_TICS.length; i++) {
      if (QUEUE_TICS[i] < minT) before = i;
      if (QUEUE_TICS[i] > maxT && after === -1) after = i;
    }
    if (before !== -1) markers.push(before);
    if (after !== -1) markers.push(after);
  }

  markers.forEach(idx => {
    const m = queueRows[idx] ? queueRows[idx].querySelector('.marker') : null;
    if (m) m.textContent = '>';
  });
}

function clearTimingMarkers() {
  document.querySelectorAll('.right-rail .queue-row .marker').forEach(m => m.textContent = '');
}

function selectMenuCommand() {
  const rows = commandMenu().querySelectorAll('.command-row');
  const row = rows[currentMenuIndex];
  if (!row) return;
  const name = row.dataset.name;

  hideCommandMenu();

  if (name === 'Quick Slash' || name === 'Slash' || name === 'Fireball 1' || name === 'Ice Bolt 2') {
    enterTargetMode(name);
  } else if (name === 'Herb') {
    showItemConfirm('C1: Herb', 'Drink the Herb for 10 HP +(1-20) HP?', 'You drink the Herb — some HP restored.');
  } else if (name === 'Bomb') {
    showItemConfirm('C2: Bomb', 'Throw the Bomb — damage all monsters?', 'You throw the Bomb — every monster takes damage!');
  } else if (name === 'Bronze Axe') {
    showItemConfirm('BL: Bronze Axe', 'Equip the Bronze Axe? 2h, replaces both weapons, 30-40 tic equip time', 'Equipping the Bronze Axe takes 30-40 tics.');
  }
}

function showItemConfirm(label, promptText, narrationText) {
  const menu = commandMenu();
  menu.innerHTML = '';
  menu.classList.add('visible');
  menuVisible = true;

  const p = document.createElement('div');
  p.style.padding = '4px';
  p.style.fontSize = '10px';
  p.textContent = promptText;
  menu.appendChild(p);

  const btns = document.createElement('div');
  btns.style.marginTop = '4px';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'confirm-btn';
  confirmBtn.textContent = 'CONFIRM';
  confirmBtn.onclick = () => {
    pendingConfirmAction = null;
    appendNarration(narrationText);
    menu.classList.remove('visible');
    menuVisible = false;
    setTimeout(() => {
      showCommandMenu(currentHand);
    }, 1400);
  };

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'confirm-btn';
  cancelBtn.textContent = 'CANCEL';
  cancelBtn.onclick = () => {
    pendingConfirmAction = null;
    menu.classList.remove('visible');
    menuVisible = false;
    showCommandMenu(currentHand);
  };

  btns.appendChild(confirmBtn);
  btns.appendChild(cancelBtn);
  menu.appendChild(btns);

  // keyboard support for confirm/cancel
  pendingConfirmAction = { confirm: confirmBtn.onclick, cancel: cancelBtn.onclick };
}

function enterTargetMode(attackName = null) {
  selectedAttackName = attackName;
  targetMode = true;
  currentTargetIndex = 0;
  highlightTarget(0);
  const q = `Who do you attack with the ${attackName}?`;
  showMessage([q]);
  hideInfoPopup();
  // add confirm button to message area or body for target
  addTargetConfirmUI();
}

function addTargetConfirmUI() {
  // create or show a confirm bar
  let bar = document.getElementById('target-confirm-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'target-confirm-bar';
    bar.style.position = 'absolute';
    bar.style.bottom = '80px';
    bar.style.left = '50%';
    bar.style.transform = 'translateX(-50%)';
    bar.style.zIndex = '100';
    document.body.appendChild(bar);
  }
  bar.innerHTML = '';
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'confirm-btn';
  confirmBtn.textContent = 'CONFIRM';
  confirmBtn.onclick = () => confirmTarget();
  bar.appendChild(confirmBtn);
  bar.style.display = 'block';
}

function removeTargetConfirmUI() {
  const bar = document.getElementById('target-confirm-bar');
  if (bar) bar.style.display = 'none';
}

function exitTargetMode(cancel = false) {
  targetMode = false;
  clearTargetHighlights();
  removeTargetConfirmUI();
  if (cancel) {
    showCommandMenu(currentHand);
  } else {
    setTimeout(() => {
      showCommandMenu(currentHand);
    }, 800);
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
  removeTargetConfirmUI();

  const ACTION_LINES = {
    'Quick Slash': (m, t) => `You slash ${m} ${t} for 16!`,
    'Slash': (m, t) => `You slash ${m} ${t} for 16!`,
    'Fireball 1': (m, t) => `You cast Fireball 1 at ${m} ${t} for 16!`,
    'Ice Bolt 2': (m, t) => `You hurl Ice Bolt 2 at ${m} ${t} for 16!`,
  };
  const actionLine = ACTION_LINES[selectedAttackName] || ((m, t) => `You use ${selectedAttackName} on ${m} ${t} for 16!`);
  appendNarration(actionLine(monsterName, target));
  setTimeout(() => {
    appendNarration(`${monsterName} takes 16 damage.`);
    setTimeout(() => {
      advanceDemoHand();
    }, 1200);
  }, 900);
}

function advanceDemoHand() {
  // L.HAND -> R.HAND -> L.HAND loop (no hand switch)
  if (currentHand === 'left') {
    setTimeout(() => {
      showCommandMenu('right');
    }, 600);
  } else {
    setTimeout(() => {
      showCommandMenu('left');
    }, 600);
  }
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
        let newIdx = currentMenuIndex - 1;
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
      } else if (e.key === 'Enter') {
        // handle pending item confirm or normal select
        if (pendingConfirmAction) {
          pendingConfirmAction.confirm();
          pendingConfirmAction = null;
        } else {
          selectMenuCommand();
        }
        e.preventDefault();
      } else if (e.key === 'Escape') {
        if (pendingConfirmAction) {
          pendingConfirmAction.cancel();
          pendingConfirmAction = null;
        } else {
          hideCommandMenu();
          startNarrationCycle();
        }
        e.preventDefault();
      }
      // NO ArrowLeft/Right hand switch
    } else {
      if (e.key === 'Enter' || e.key === ' ') {
        showCommandMenu('left');
        e.preventDefault();
      } else if (e.key.toLowerCase() === 'l') {
        toggleLootWindow();
        e.preventDefault();
      }
    }
    if (e.key === 'Escape') {
      const win = lootWindow();
      if (win && win.classList.contains('visible')) {
        win.classList.remove('visible');
        e.preventDefault();
      }
    }
  });
}

function setupMouse() {
  document.querySelectorAll('.monster-target').forEach((el, idx) => {
    el.addEventListener('click', () => {
      if (targetMode) {
        currentTargetIndex = idx;
        highlightTarget(idx);
        // click selects but does not auto confirm per spec; use CONFIRM button
      }
    });
  });

  document.querySelectorAll('.monster-wrapper').forEach((el, idx) => {
    el.addEventListener('click', () => {
      if (targetMode) {
        currentTargetIndex = idx;
        highlightTarget(idx);
      }
    });
  });

  arena().addEventListener('click', () => {
    if (!menuVisible && !targetMode) {
      showCommandMenu('left');
    }
  });

  const chip = lootChip();
  if (chip) {
    chip.addEventListener('click', () => {
      toggleLootWindow();
    });
  }
}

function toggleLootWindow() {
  const win = lootWindow();
  if (!win) return;
  const isOpen = win.classList.contains('visible');
  if (isOpen) {
    win.classList.remove('visible');
  } else {
    if (menuVisible || targetMode) return;
    win.classList.add('visible');
  }
}

function init() {
  setTimeout(() => {
    showCommandMenu('left');
  }, 3200);

  setTimeout(() => {
    startNarrationCycle();
  }, 3800);

  setupKeyboard();
  setupMouse();

  setTimeout(() => {
    if (!menuVisible) {
      appendNarration('The battle rages on...');
    }
  }, 5200);
}

init();