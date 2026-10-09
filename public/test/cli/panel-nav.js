/**
 * Side-panel focus and info pop (PC-20). Owns focusedPanelIdx and infoPopEl.
 * Contract: setupPanelNavigation(inputEl). Does not import cli-app.js.
 */
// Panel navigation (PC-20)
const PANEL_IDS = [
  'player-stats-panel',
  'monster-roster-panel',
  'run-loot-panel',
  'action-queue-panel',
  'dice-left-panel',
  'dice-rolled-panel'
];
let focusedPanelIdx = -1;
let infoPopEl = null;

// PC-20 panel navigation helpers
function getPanelElements() {
  return PANEL_IDS.map(id => document.getElementById(id)).filter(Boolean);
}

function clearPanelFocus() {
  getPanelElements().forEach(p => p.classList.remove('focused'));
  dismissInfoPop();
  focusedPanelIdx = -1;
}

function dismissInfoPop() {
  if (infoPopEl && infoPopEl.parentNode) {
    infoPopEl.parentNode.removeChild(infoPopEl);
  }
  infoPopEl = null;
}

function showInfoPop(panel) {
  dismissInfoPop();
  const titleEl = panel.querySelector('.panel-title, h3, .title') || panel.firstElementChild;
  const contentContainer = panel.querySelector('[id$="-content"]') || panel;
  const titleText = titleEl ? titleEl.textContent.trim() : panel.id.replace(/-/g, ' ').toUpperCase();
  const contentHTML = contentContainer ? contentContainer.innerHTML : '';

  infoPopEl = document.createElement('div');
  infoPopEl.id = 'info-pop';
  infoPopEl.innerHTML = `
    <div class="pop-title">${titleText}</div>
    <div class="pop-content">${contentHTML}</div>
  `;
  document.body.appendChild(infoPopEl);

  const rect = panel.getBoundingClientRect();
  let left = rect.right + 10;
  let top = rect.top - 4;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const popW = 320;
  if (left + popW > vw) left = Math.max(8, rect.left - popW - 10);
  if (top + 220 > vh) top = Math.max(8, vh - 230);
  if (top < 8) top = 8;
  if (left < 8) left = 8;

  infoPopEl.style.left = `${left}px`;
  infoPopEl.style.top = `${top}px`;
}

function setFocusedPanel(idx) {
  const panels = getPanelElements();
  if (idx < 0 || idx >= panels.length) return;
  clearPanelFocus();
  const panel = panels[idx];
  panel.classList.add('focused');
  focusedPanelIdx = idx;
  showInfoPop(panel);
}

export function setupPanelNavigation(inputEl) {
  const input = inputEl;

  document.addEventListener('keydown', (e) => {
    if (document.activeElement === input) return; // history recall handled in input listener

    const panels = getPanelElements();
    if (panels.length === 0) return;

    if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
    }

    let idx = focusedPanelIdx;

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (idx === -1) idx = 0;
      const col = Math.floor(idx / 3);
      const row = idx % 3;
      const newCol = (e.key === 'ArrowRight') ? 1 : 0;
      idx = newCol * 3 + row;
      if (idx >= panels.length) idx = panels.length - 1;
      setFocusedPanel(idx);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (idx === -1) idx = 0;
      const col = Math.floor(idx / 3);
      const row = idx % 3;
      let newRow = row + (e.key === 'ArrowDown' ? 1 : -1);
      if (newRow < 0) newRow = 2;
      if (newRow > 2) newRow = 0;
      idx = col * 3 + newRow;
      setFocusedPanel(idx);
    } else if (e.key === 'Enter' && focusedPanelIdx !== -1) {
      e.preventDefault();
      input.focus();
      clearPanelFocus();
    } else if (e.key === 'Escape' && focusedPanelIdx !== -1) {
      e.preventDefault();
      input.focus();
      clearPanelFocus();
    }
  });

  input.addEventListener('focus', () => {
    if (focusedPanelIdx !== -1) clearPanelFocus();
  });
}
