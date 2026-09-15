/**
 * Portal Colosseum — GUI2 Variant 04 (Dragon Warrior NES Battle)
 * Self-contained demo script.
 * - Narration cycle in DW message box
 * - Menu appears only on player's turn
 * - Keyboard + mouse targeting
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

const messageBox = () => document.getElementById('message-box');
const commandMenu = () => document.getElementById('command-menu');
const arena = () => document.getElementById('arena');

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
      // loop demo
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

function showCommandMenu() {
  const menu = commandMenu();
  menu.classList.add('visible');
  menuVisible = true;
  currentMenuIndex = 0;
  highlightMenuRow(0);
  showMessage(['Command?']);
  pauseNarration();
}

function hideCommandMenu() {
  const menu = commandMenu();
  menu.classList.remove('visible');
  menuVisible = false;
  clearMenuHighlight();
}

function highlightMenuRow(index) {
  const rows = commandMenu().querySelectorAll('.command-row');
  rows.forEach((r, i) => {
    r.classList.toggle('active', i === index);
  });
  currentMenuIndex = index;
}

function clearMenuHighlight() {
  const rows = commandMenu().querySelectorAll('.command-row');
  rows.forEach(r => r.classList.remove('active'));
}

function selectMenuCommand() {
  const rows = commandMenu().querySelectorAll('.command-row');
  const row = rows[currentMenuIndex];
  const cmd = row.dataset.cmd;

  hideCommandMenu();

  if (cmd.startsWith('fight-')) {
    enterTargetMode();
  } else if (cmd === 'item-herb' || cmd === 'item-bomb') {
    appendNarration(cmd === 'item-herb' ? 'You use Herb.' : 'You throw Bomb!');
    setTimeout(() => {
      showCommandMenu();
    }, 1400);
  }
}

function enterTargetMode() {
  targetMode = true;
  currentTargetIndex = 0;
  highlightTarget(0);
  appendNarration('Select target...');
}

function exitTargetMode(cancel = false) {
  targetMode = false;
  clearTargetHighlights();
  if (!cancel) {
    setTimeout(() => {
      showCommandMenu();
    }, 800);
  } else {
    showCommandMenu();
  }
}

function highlightTarget(idx) {
  clearTargetHighlights();
  currentTargetIndex = idx;

  // Highlight sprite wrapper
  const wrappers = document.querySelectorAll('.monster-wrapper');
  if (wrappers[idx]) wrappers[idx].classList.add('selected');

  // Highlight monster list row
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
  const wrappers = document.querySelectorAll('.monster-wrapper');
  const name = wrappers[currentTargetIndex].querySelector('.monster-marker').textContent.replace(/[\[\]]/g, '');

  clearTargetHighlights();
  targetMode = false;

  appendNarration(`You slash Glimmerling ${target} for 16!`);
  setTimeout(() => {
    appendNarration(`${name} takes 16 damage.`);
    setTimeout(() => {
      showCommandMenu();
    }, 1200);
  }, 900);
}

// Keyboard handling
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
        currentMenuIndex = (currentMenuIndex - 1 + rows.length) % rows.length;
        highlightMenuRow(currentMenuIndex);
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        currentMenuIndex = (currentMenuIndex + 1) % rows.length;
        highlightMenuRow(currentMenuIndex);
        e.preventDefault();
      } else if (e.key === 'Enter') {
        selectMenuCommand();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        hideCommandMenu();
        startNarrationCycle();
        e.preventDefault();
      }
    } else {
      // any key resumes / shows menu demo
      if (e.key === 'Enter' || e.key === ' ') {
        showCommandMenu();
        e.preventDefault();
      }
    }
  });
}

// Mouse / click handling
function setupMouse() {
  // Menu rows
  const rows = commandMenu().querySelectorAll('.command-row');
  rows.forEach((row, idx) => {
    row.addEventListener('click', () => {
      currentMenuIndex = idx;
      highlightMenuRow(idx);
      selectMenuCommand();
    });
    row.addEventListener('mouseenter', () => {
      if (menuVisible) highlightMenuRow(idx);
    });
  });

  // Monster targets (list)
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
      } else if (menuVisible) {
        // quick target from menu not supported in this demo
      }
    });
  });

  // Click arena to show menu (demo convenience)
  arena().addEventListener('click', () => {
    if (!menuVisible && !targetMode) {
      showCommandMenu();
    }
  });
}

function init() {
  // Initial encounter lines already in HTML
  // After 2 lines, trigger player's turn (DW style)
  setTimeout(() => {
    showCommandMenu();
  }, 3200);

  // Start narration after first two lines
  setTimeout(() => {
    startNarrationCycle();
  }, 3800);

  setupKeyboard();
  setupMouse();

  // Seed a couple extra narration lines for demo loop
  setTimeout(() => {
    if (!menuVisible) {
      appendNarration('The battle rages on...');
    }
  }, 5200);
}

init();