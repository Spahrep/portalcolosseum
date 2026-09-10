/**
 * Portal Colosseum — Battle Test GUI (gui2)
 * External script extracted from index.html to comply with CSP.
 * No inline scripts allowed: script-src 'self' only.
 * Mockup only — the TIME MENU column and DICE tray are static demo data.
 */

let currentCol = 0;
let currentRow = 0;
let inTargetMode = false;
let currentTargetIndex = 0;
let confirmButtonsVisible = false;
let herbThrown = false;
let pendingHerbThrow = false;

const FOOTER_DEFAULT = 'tic 214 — RH Slash hits B for 18';

function getAllCommands() {
  return Array.from(document.querySelectorAll('.command[data-name]'));
}

function selectCommand(el) {
  if (el.classList.contains('herb-disabled') || (el.dataset.name === 'Herb' && herbThrown)) {
    return;
  }

  document.querySelectorAll('.command').forEach(cmd => {
    cmd.classList.remove('selected');
    if (cmd.dataset.name) {
      cmd.innerHTML = cmd.innerHTML.replace('[x]', '[ ]');
    }
  });

  if (el.dataset.name) {
    el.innerHTML = el.innerHTML.replace('[ ]', '[x]');
    el.classList.add('selected');

    currentCol = parseInt(el.dataset.col);
    currentRow = parseInt(el.dataset.row);

    const footer = document.getElementById('footer-info');
    const name = el.dataset.name;

    if (name === 'Herb' && !herbThrown) {
      footer.innerHTML = `
        <strong>Herb</strong> — Choose action:<br>
        <span class="herb-suboption" data-action="consume">Consume</span> &nbsp;|&nbsp;
        <span class="herb-suboption" data-action="throw">Throw</span>
      `;
      footer.querySelectorAll('.herb-suboption').forEach(span => {
        span.addEventListener('click', function() {
          handleHerbAction(this.dataset.action, this);
        });
      });
    } else {
      const info = el.dataset.info;
      footer.innerHTML = `<strong>${name}</strong> — ${info}`;
    }
  }
}

function handleHerbAction(action, el) {
  const footer = document.getElementById('footer-info');
  const herbEl = document.querySelector('.command[data-name="Herb"]');

  if (action === 'consume') {
    footer.innerHTML = 'Action Confirmed! (demo) - You consumed the herb and restored some health.';
    if (herbEl) {
      herbEl.classList.remove('selected');
      herbEl.innerHTML = herbEl.innerHTML.replace('[x]', '[ ]');
    }
    setTimeout(() => {
      footer.innerHTML = FOOTER_DEFAULT;
    }, 2500);
  } else if (action === 'throw') {
    pendingHerbThrow = true;
    if (herbEl) {
      herbEl.classList.remove('selected');
    }
    inTargetMode = true;
    currentTargetIndex = 0;
    selectMonster(0);
    footer.innerHTML = 'Select monster to throw at, then Enter';
  }
}

function selectMonster(elOrIndex) {
  document.querySelectorAll('.monster-target').forEach(m => m.classList.remove('selected'));
  document.querySelectorAll('.monster-wrapper').forEach(w => w.classList.remove('selected'));
  document.querySelectorAll('.monster-marker').forEach(m => m.innerHTML = '[ ]');

  let el;
  if (typeof elOrIndex === 'number') {
    el = document.querySelector(`.monster-target[data-target="${elOrIndex}"]`);
    currentTargetIndex = elOrIndex;
  } else {
    el = elOrIndex;
    currentTargetIndex = parseInt(el.dataset.target);
  }
  if (el) {
    el.classList.add('selected');
  }

  const arenaWrapper = document.querySelector(`.monster-wrapper[data-target="${currentTargetIndex}"]`);
  const arenaMarker = document.querySelector(`.monster-marker[data-target="${currentTargetIndex}"]`);
  if (arenaWrapper) arenaWrapper.classList.add('selected');
  if (arenaMarker) arenaMarker.innerHTML = '[x]';
}

function toggleMonster(index) {
  const marker = document.querySelector(`.monster-marker[data-target="${index}"]`);
  const wrapper = document.querySelector(`.monster-wrapper[data-target="${index}"]`);
  const listItem = document.querySelector(`.monster-target[data-target="${index}"]`);

  if (!marker) return;

  const isSelected = marker.innerHTML === '[x]';

  document.querySelectorAll('.monster-target').forEach(m => m.classList.remove('selected'));
  document.querySelectorAll('.monster-wrapper').forEach(w => w.classList.remove('selected'));
  document.querySelectorAll('.monster-marker').forEach(m => m.innerHTML = '[ ]');

  if (!isSelected) {
    if (listItem) listItem.classList.add('selected');
    if (wrapper) wrapper.classList.add('selected');
    marker.innerHTML = '[x]';
    currentTargetIndex = index;
  } else {
    currentTargetIndex = -1;
  }
}

function showConfirmButtons() {
  const old = document.getElementById('confirm-buttons');
  if (old) old.remove();

  const footer = document.getElementById('footer-info');
  const btnContainer = document.createElement('div');
  btnContainer.id = 'confirm-buttons';
  btnContainer.className = 'confirm-buttons';
  btnContainer.innerHTML = `
    <button class="confirm-btn" data-action="go">Go</button>
    <button class="confirm-btn" data-action="cancel">Cancel</button>
  `;
  btnContainer.querySelectorAll('.confirm-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      confirmAction(this.dataset.action === 'go');
    });
  });
  footer.appendChild(btnContainer);
  confirmButtonsVisible = true;
  const goBtn = btnContainer.querySelector('.confirm-btn');
  if (goBtn) goBtn.classList.add('selected');
}

function confirmAction(go) {
  const btns = document.getElementById('confirm-buttons');
  if (btns) btns.remove();
  confirmButtonsVisible = false;

  const footer = document.getElementById('footer-info');

  if (go) {
    if (pendingHerbThrow) {
      footer.innerHTML = 'Action Confirmed! (demo) - Monster ate the herb and restored some health.';
      const herbEl = document.querySelector('.command[data-name="Herb"]');
      if (herbEl) {
        herbEl.classList.add('herb-disabled');
        herbEl.innerHTML = herbEl.innerHTML.replace('[x]', '[-]').replace('Herb', '<s>Herb</s>');
        herbEl.onclick = null;
      }
      herbThrown = true;
      pendingHerbThrow = false;
      inTargetMode = false;
      document.querySelectorAll('.monster-target').forEach(m => m.classList.remove('selected'));
      document.querySelectorAll('.monster-wrapper').forEach(w => w.classList.remove('selected'));
      document.querySelectorAll('.monster-marker').forEach(m => m.innerHTML = '[ ]');
      setTimeout(() => {
        footer.innerHTML = FOOTER_DEFAULT;
      }, 2500);
      return;
    }
    footer.innerHTML = 'Action confirmed! (demo)';
  } else {
    footer.innerHTML = 'Action cancelled. Select command again.';
    pendingHerbThrow = false;
    inTargetMode = false;
    document.querySelectorAll('.monster-target').forEach(m => m.classList.remove('selected'));
    document.querySelectorAll('.monster-wrapper').forEach(w => w.classList.remove('selected'));
    document.querySelectorAll('.monster-marker').forEach(m => m.innerHTML = '[ ]');
    const first = document.querySelector('.command[data-col="0"][data-row="0"]');
    if (first) selectCommand(first);
  }
}

function navigateWithArrows(direction) {
  if (confirmButtonsVisible) {
    const btns = document.querySelectorAll('#confirm-buttons .confirm-btn');
    if (btns.length < 2) return;
    const goBtn = btns[0];
    const cancelBtn = btns[1];
    const goSelected = goBtn.classList.contains('selected');
    if (direction === 'left' || direction === 'up') {
      goBtn.classList.add('selected');
      cancelBtn.classList.remove('selected');
    } else if (direction === 'right' || direction === 'down') {
      cancelBtn.classList.add('selected');
      goBtn.classList.remove('selected');
    }
    return;
  }

  if (inTargetMode) {
    let newIdx = currentTargetIndex;
    if (direction === 'left' || direction === 'up')  newIdx = (currentTargetIndex - 1 + 3) % 3;
    if (direction === 'right' || direction === 'down') newIdx = (currentTargetIndex + 1) % 3;
    selectMonster(newIdx);
    return;
  }

  const commands = getAllCommands();
  let newCol = currentCol;
  let newRow = currentRow;

  if (direction === 'left')  newCol = Math.max(0, currentCol - 1);
  if (direction === 'right') newCol = Math.min(2, currentCol + 1);
  if (direction === 'up')    newRow = Math.max(0, currentRow - 1);
  if (direction === 'down')  newRow = Math.min(2, currentRow + 1);

  const target = commands.find(cmd =>
    parseInt(cmd.dataset.col) === newCol &&
    parseInt(cmd.dataset.row) === newRow
  );

  if (target) {
    selectCommand(target);
  }
}

document.addEventListener('keydown', function(e) {
  if (confirmButtonsVisible) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const selected = document.querySelector('#confirm-buttons .confirm-btn.selected') || document.querySelector('#confirm-buttons .confirm-btn');
      if (selected) {
        if (selected.textContent.trim() === 'Go') confirmAction(true);
        else confirmAction(false);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      confirmAction(false);
      return;
    }
  }

  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    navigateWithArrows('left');
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    navigateWithArrows('right');
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    navigateWithArrows('up');
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    navigateWithArrows('down');
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    if (inTargetMode) {
      const monsters = document.querySelectorAll('.monster-target');
      const currentM = monsters[currentTargetIndex];
      if (currentM) {
        selectMonster(currentM);
        showConfirmButtons();
      }
    } else {
      const selectedCmd = document.querySelector('.command.selected');
      if (selectedCmd) {
        document.querySelectorAll('.command').forEach(cmd => cmd.classList.remove('selected'));
        inTargetMode = true;
        currentTargetIndex = 0;
        selectMonster(0);
        const footer = document.getElementById('footer-info');
        footer.innerHTML = 'Select target (A/B/C) then Enter';
      }
    }
    return;
  }

  if (e.key === 'Escape') {
    e.preventDefault();
    if (inTargetMode) {
      inTargetMode = false;
      document.querySelectorAll('.monster-target').forEach(m => m.classList.remove('selected'));
      document.querySelectorAll('.monster-wrapper').forEach(w => w.classList.remove('selected'));
      document.querySelectorAll('.monster-marker').forEach(m => m.innerHTML = '[ ]');
      const commands = getAllCommands();
      const prevCmd = commands.find(cmd =>
        parseInt(cmd.dataset.col) === currentCol && parseInt(cmd.dataset.row) === currentRow
      );
      if (prevCmd) {
        selectCommand(prevCmd);
      } else {
        const first = document.querySelector('.command[data-col="0"][data-row="0"]');
        if (first) selectCommand(first);
      }
    }
  }

  if (e.key.toLowerCase() === 'e') {
    e.preventDefault();
    const equip = document.getElementById('equip-panel');
    if (equip) {
      equip.scrollIntoView({ behavior: 'smooth', block: 'center' });
      equip.style.transition = 'background 0.2s';
      equip.style.background = '#1a3a6e';
      setTimeout(() => {
        equip.style.background = '';
      }, 600);
    }
  }
});

document.querySelectorAll('.equip-row').forEach(row => {
  row.addEventListener('click', function() {
    const slot = this.dataset.slot;
    const itemName = this.querySelector('span:not(.equip-label)').innerText;

    if (slot === 'belt' && itemName === 'Bronze Axe') {
      document.getElementById('left-hand').innerText = 'Bronze Axe';
      document.getElementById('left-weapon-name').innerText = 'Bronze Axe';
      document.getElementById('belt').innerText = '—';

      row.classList.add('equip-highlight');
      setTimeout(() => row.classList.remove('equip-highlight'), 600);
    }
  });
});

function initKeyboardNav() {
  const firstCmd = document.querySelector('.command[data-col="0"][data-row="0"]');
  if (firstCmd) {
    selectCommand(firstCmd);
  }

  // Click handlers for commands (replaces removed inline onclick="selectCommand(this)")
  document.querySelectorAll('.command[data-name]').forEach(cmd => {
    cmd.addEventListener('click', function() {
      selectCommand(this);
    });
  });

  // Click handlers for monster list targets
  document.querySelectorAll('.monster-target').forEach(mt => {
    mt.addEventListener('click', function() {
      selectMonster(this);
    });
  });

  // Click handlers for monster markers (toggle)
  document.querySelectorAll('.monster-marker').forEach(marker => {
    marker.addEventListener('click', function(e) {
      e.stopPropagation();
      const idx = parseInt(this.dataset.target);
      toggleMonster(idx);
    });
  });
}

document.querySelector('.arena')?.addEventListener('click', function(e) {
  if (e.target.tagName === 'IMG') return;
  const sprites = document.querySelectorAll('.enemy-sprites img');
  sprites.forEach((s, i) => {
    setTimeout(() => {
      s.style.transition = 'transform 0.15s';
      s.style.transform = i === 0 ? 'translateX(14px)' : 'translateX(-14px)';
      setTimeout(() => s.style.transform = '', 200);
    }, i * 70);
  });
});

window.onload = function() {
  initKeyboardNav();
};
