// 01-top-left-hud app.js — Corner HUD variant
(function() {
  'use strict';

  const markersData = [
    { id: 'store', label: 'Store', x: 20, y: 80, visited: false },
    { id: 'portal', label: 'Enter The Portal', x: 50, y: 80, visited: false },
    { id: 'wizard', label: 'Wizard Hut', x: 68, y: 80, visited: false },
    { id: 'leaderboard', label: 'Leaderboards', x: 88, y: 80, visited: false }
  ];

  let currentView = 'town';
  let selectedIndex = 0;
  let panoTransform = 0;

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function createMarkers() {
    const pano = document.getElementById('pano');
    if (!pano) return;

    pano.innerHTML = '';

    markersData.forEach((m, idx) => {
      const el = document.createElement('div');
      el.className = 'location-marker';
      el.style.left = m.x + '%';
      el.style.top = m.y + '%';
      el.dataset.x = m.x;
      el.dataset.y = m.y;
      el.dataset.id = m.id;
      el.textContent = m.label;
      el.addEventListener('click', () => selectMarker(idx));
      pano.appendChild(el);
    });

    updateSelection();
  }

  function updateSelection() {
    const els = document.querySelectorAll('.location-marker');
    els.forEach((el, idx) => {
      el.classList.toggle('selected', idx === selectedIndex);
      el.classList.toggle('visited', markersData[idx].visited);
    });
  }

  function selectMarker(idx) {
    selectedIndex = idx;
    updateSelection();
    panToLocation(markersData[idx].x);
  }

  function panToLocation(x) {
    const pano = document.getElementById('pano');
    if (!pano) return;

    const ratio = window.innerHeight / window.innerWidth;
    const panoWidthVw = Math.max(300 * ratio, 100);
    const buildingPosInVw = (x / 100) * panoWidthVw;
    const maxPanLeft = panoWidthVw - 100;
    const tx = clamp(50 - buildingPosInVw, -maxPanLeft, 0);
    pano.style.transform = `translate(${tx}vw, 0)`;
    panoTransform = tx;
  }

  function handleKeydown(e) {
    if (currentView !== 'town') return;

    const els = document.querySelectorAll('.location-marker');
    if (!els.length) return;

    if (e.key === 'ArrowRight') {
      selectedIndex = (selectedIndex + 1) % markersData.length;
      updateSelection();
      panToLocation(markersData[selectedIndex].x);
    } else if (e.key === 'ArrowLeft') {
      selectedIndex = (selectedIndex - 1 + markersData.length) % markersData.length;
      updateSelection();
      panToLocation(markersData[selectedIndex].x);
    } else if (e.key === 'Enter') {
      const current = markersData[selectedIndex];
      if (current.id === 'portal') {
        switchToBattle();
      } else {
        current.visited = true;
        updateSelection();
      }
    }
  }

  function switchToBattle() {
    document.getElementById('town-view').classList.add('hidden');
    document.getElementById('battle-view').classList.remove('hidden');
    currentView = 'battle';
  }

  function switchToTown() {
    document.getElementById('battle-view').classList.add('hidden');
    document.getElementById('town-view').classList.remove('hidden');
    currentView = 'town';
    const pano = document.getElementById('pano');
    if (pano) pano.style.transform = `translate(${panoTransform}vw, 0)`;
  }

  function setupToggle() {
    const btn = document.getElementById('toggle-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      if (currentView === 'town') {
        switchToBattle();
      } else {
        switchToTown();
      }
    });
  }

  function setupLogout() {
    const logout = document.getElementById('logout');
    if (logout) {
      logout.addEventListener('click', () => {
        // inert mockup
      });
    }
  }

  function init() {
    createMarkers();
    setupToggle();
    setupLogout();
    document.addEventListener('keydown', handleKeydown);

    // initial pan to first marker
    setTimeout(() => {
      panToLocation(markersData[0].x);
    }, 100);

    // initial selection
    selectedIndex = 0;
    updateSelection();
  }

  window.addEventListener('load', init);
})();