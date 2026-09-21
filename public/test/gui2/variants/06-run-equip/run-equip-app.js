    // Game data
    const weaponData = {
      'Wristblade': { type: 'WEAPON', stats: 'Damage: 25±5 · Speed: 18±2 · Accuracy: 88±4', attacks: ['Quick Slash', 'Precision Strike'] },
      'Short Sword': { type: 'WEAPON', stats: 'Damage: 35±6 · Speed: 27±3 · Accuracy: 85±5', attacks: ['Heavy Chop', 'Cleave'] },
      'Greatsword': { type: 'WEAPON', stats: 'Damage: 55±8 · Speed: 35±4 · Accuracy: 82±6', attacks: ['Heavy Chop', 'Whirlwind'] },
      'Hand Axe': { type: 'WEAPON', stats: 'Damage: 32±5 · Speed: 29±3 · Accuracy: 84±5', attacks: ['Heavy Chop', 'Cleave'] },
      'Battle Axe': { type: 'WEAPON', stats: 'Damage: 50±7 · Speed: 38±4 · Accuracy: 80±6', attacks: ['Whirlwind', 'Power Attack'] },
      'Quarterstaff': { type: 'WEAPON', stats: 'Damage: 28±4 · Speed: 24±2 · Accuracy: 87±4', attacks: ['Attack'] },
      'Warhammer': { type: 'WEAPON', stats: 'Damage: 42±6 · Speed: 33±3 · Accuracy: 83±5', attacks: ['Heavy Chop'] }
    };
    const consumableData = {
      'Health Potion': { type: 'CONSUMABLE', effect: 'Restores HP' },
      'Damage Tonic': { type: 'CONSUMABLE', effect: 'Boosts damage' },
      'Swift Tonic': { type: 'CONSUMABLE', effect: 'Boosts speed' },
      'Accuracy Tonic': { type: 'CONSUMABLE', effect: 'Boosts accuracy' }
    };

    const allItems = [
      'Wristblade','Short Sword','Short Sword','Greatsword','Hand Axe','Quarterstaff','Warhammer',
      'Health Potion','Health Potion','Damage Tonic','Swift Tonic','Accuracy Tonic'
    ];

    // State
    let backpack = [...allItems];
    let loadout = ['Short Sword', 'Hand Axe', 'Battle Axe', 'Health Potion', 'Damage Tonic'];
    let selectedIndex = null;
    let popupEl = document.getElementById('info-popup');

    function isWeapon(name) { return !!weaponData[name]; }
    function isConsumable(name) { return !!consumableData[name]; }

    function renderBackpack() {
      const grid = document.getElementById('backpack-grid');
      grid.innerHTML = '';
      for (let i = 0; i < 20; i++) {
        const slot = document.createElement('div');
        slot.className = 'inv-slot';
        if (i < backpack.length) {
          slot.textContent = backpack[i];
          slot.dataset.index = i;
          slot.onclick = () => selectBackpackItem(i, slot);
        } else {
          slot.classList.add('empty');
          slot.textContent = (i + 1).toString().padStart(2, '0');
        }
        grid.appendChild(slot);
      }
    }

    function selectBackpackItem(index, el) {
      // Deselect previous
      document.querySelectorAll('.inv-slot').forEach(s => s.classList.remove('selected'));
      el.classList.add('selected');
      selectedIndex = index;

      // Show inspect popup near the item
      const itemName = backpack[index];
      showInspectPopup(itemName, el);

      // Highlight valid targets
      highlightTargets(itemName);
    }

    function highlightTargets(itemName) {
      const isW = isWeapon(itemName);
      const isC = isConsumable(itemName);
      document.querySelectorAll('.slot-row').forEach(row => {
        const slotNum = parseInt(row.dataset.slot);
        const content = row.querySelector('.slot-content');
        const isWeaponSlot = slotNum <= 2;
        const isConsumableSlot = slotNum >= 3;
        if ((isW && isWeaponSlot) || (isC && isConsumableSlot)) {
          content.style.borderColor = '#66ff99';
          content.style.boxShadow = '0 0 0 1px #66ff99';
        } else {
          content.style.opacity = '0.5';
        }
      });
    }

    function clearHighlights() {
      document.querySelectorAll('.slot-content').forEach(el => {
        el.style.borderColor = '';
        el.style.boxShadow = '';
        el.style.opacity = '';
      });
      document.querySelectorAll('.inv-slot').forEach(s => s.classList.remove('selected', 'valid-target', 'invalid-target'));
    }

    function showInspectPopup(itemName, targetEl) {
      popupEl.innerHTML = '';
      popupEl.style.display = 'block';

      const rect = targetEl.getBoundingClientRect();
      const contRect = document.querySelector('.container').getBoundingClientRect();
      popupEl.style.left = (rect.left - contRect.left + 30) + 'px';
      popupEl.style.top = (rect.top - contRect.top - 10) + 'px';

      let html = `<div class="name">${itemName}</div>`;
      if (weaponData[itemName]) {
        const w = weaponData[itemName];
        html += `<div class="type">${w.type}</div>`;
        html += `<div class="stat-line">${w.stats}</div>`;
        html += `<div class="attacks">Attacks: ${w.attacks.join(', ')}</div>`;
      } else if (consumableData[itemName]) {
        const c = consumableData[itemName];
        html += `<div class="type">${c.type}</div>`;
        html += `<div class="stat-line">${c.effect}</div>`;
      }
      popupEl.innerHTML = html;

      // Close on outside click
      setTimeout(() => {
        document.addEventListener('click', function handler(ev) {
          if (!popupEl.contains(ev.target) && !targetEl.contains(ev.target)) {
            popupEl.style.display = 'none';
            clearHighlights();
            document.removeEventListener('click', handler);
          }
        }, { once: true });
      }, 10);
    }

    function assignToSlot(slotIndex) {
      if (selectedIndex === null) return;
      const itemName = backpack[selectedIndex];
      const isW = isWeapon(itemName);
      const isC = isConsumable(itemName);
      const isWeaponSlot = slotIndex <= 2;
      const isConsumableSlot = slotIndex >= 3;

      if ((isW && !isWeaponSlot) || (isC && !isConsumableSlot)) {
        // Invalid - flash error
        const row = document.querySelector(`[data-slot="${slotIndex}"]`);
        const orig = row.querySelector('.slot-content').innerHTML;
        row.querySelector('.slot-content').innerHTML = `<span class="error-flash">${isW ? 'Weapons go in hand/belt slots' : 'Consumables go in C1/C2'}</span>`;
        setTimeout(() => {
          if (row.querySelector('.slot-content')) row.querySelector('.slot-content').innerHTML = orig;
          clearHighlights();
          selectedIndex = null;
          popupEl.style.display = 'none';
        }, 1200);
        return;
      }

      // Valid assignment or swap
      const displaced = loadout[slotIndex];
      loadout[slotIndex] = itemName;

      // Remove from backpack
      backpack.splice(selectedIndex, 1);

      // If swap, put displaced back to backpack at original position if possible, else first empty
      if (displaced) {
        backpack.push(displaced); // append to end for simplicity (first empty visual is fine)
      }

      renderAll();
      clearHighlights();
      selectedIndex = null;
      popupEl.style.display = 'none';
    }

    function unequipSlot(slotIndex) {
      const itemName = loadout[slotIndex];
      if (!itemName) return;
      loadout[slotIndex] = null;
      // Return to first empty backpack slot (append)
      backpack.push(itemName);
      renderAll();
    }

    function renderLoadout() {
      const labels = ['LH','RH','BL','C1','C2'];
      for (let i = 0; i < 5; i++) {
        const content = document.getElementById('slot-' + i);
        const row = content.parentElement;
        row.onclick = null;
        if (loadout[i]) {
          const name = loadout[i];
          let stats = '';
          if (weaponData[name]) stats = weaponData[name].stats;
          else if (consumableData[name]) stats = consumableData[name].effect;
          content.innerHTML = `<span>${name}</span><span class="stats">${stats}</span>`;
          content.classList.remove('empty');
          row.onclick = () => unequipSlot(i);
        } else {
          content.innerHTML = '— EMPTY —';
          content.classList.add('empty');
        }
        // Click to assign if item selected
        const origClick = row.onclick;
        row.onclick = (e) => {
          if (selectedIndex !== null) {
            assignToSlot(i);
          } else if (origClick) {
            origClick();
          }
        };
      }
    }

    function renderAll() {
      renderBackpack();
      renderLoadout();
    }

    function setupKeyboard() {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          selectedIndex = null;
          popupEl.style.display = 'none';
          clearHighlights();
          document.querySelectorAll('.inv-slot').forEach(s => s.classList.remove('selected'));
        }
        if (e.key >= '1' && e.key <= '5') {
          const slot = parseInt(e.key) - 1;
          if (selectedIndex !== null) {
            assignToSlot(slot);
          } else {
            // quick unequip if occupied
            if (loadout[slot]) unequipSlot(slot);
          }
        }
      });
    }

    function setupEnterButton() {
      const btn = document.getElementById('enter-btn');
      const bottom = document.getElementById('bottom-bar');
      btn.onclick = () => {
        bottom.innerHTML = `<div class="message-locked">Loadout locked. Entering PORTAL 2 — BATTLE 1 OF 5.</div>`;
      };
    }

    function init() {
      renderAll();
      setupKeyboard();
      setupEnterButton();

      // Initial dice labels already in HTML
      // Make sure popup starts hidden
      popupEl.style.display = 'none';
    }

    init();
