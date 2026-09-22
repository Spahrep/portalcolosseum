/**
 * Portal Colosseum - Battle Debug Overlay
 * Temporary diagnostic tool. Controlled by the `debug` flag in the
 * game_config Supabase table (set via /api/config endpoint).
 * Shows a scrollable feed box in the bottom-right corner.
 * debugLog(tag, msg) inside any battle function marks execution flow.
 * Global flag: window.__PC_DEBUG = true/false
 *
 * Remove by deleting this file and the import + debugLog calls from battle-app.js.
 */

(function () {
  window.__PC_DEBUG = false;
  window.debugLog = function () {}; // no-op until config loads

  // Fetch debug flag from server config
  fetch('/api/config')
    .then(r => r.json())
    .then(cfg => {
      if (cfg.debug === true) {
        window.__PC_DEBUG = true;
        window.debugLog = createDebugLog();
        window.debugLog('debug', 'Debug overlay active — config says ON');
      } else {
        window.__PC_DEBUG = false;
      }
    })
    .catch(err => {
      // Silently degrade — debug box not critical
      console.warn('🐛 Debug config fetch failed:', err.message);
    });

  function createDebugLog() {
    // Create the debug box
    const box = document.createElement('div');
    box.id = 'pc-debug-box';
    box.innerHTML = (
      '<div id="pc-debug-header">' +
        '<strong>🐛 DEBUG</strong> <span id="pc-debug-count">0</span>' +
      '</div>' +
      '<div id="pc-debug-body"></div>'
    );
    Object.assign(box.style, {
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      width: '360px',
      maxHeight: '300px',
      background: 'rgba(0,0,0,0.85)',
      border: '1px solid #ff0',
      color: '#0f0',
      fontFamily: 'monospace',
      fontSize: '11px',
      zIndex: '99999',
      borderRadius: '4px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      resize: 'both',
    });

    const header = box.querySelector('#pc-debug-header');
    Object.assign(header.style, {
      padding: '4px 8px',
      background: 'rgba(255,255,0,0.15)',
      cursor: 'pointer',
      userSelect: 'none',
      display: 'flex',
      justifyContent: 'space-between',
    });

    const body = box.querySelector('#pc-debug-body');
    Object.assign(body.style, {
      padding: '4px 8px',
      overflowY: 'auto',
      maxHeight: '260px',
      flex: '1',
    });

    // Collapse toggle
    let collapsed = false;
    header.onclick = () => {
      collapsed = !collapsed;
      body.style.display = collapsed ? 'none' : 'block';
    };

    document.body.appendChild(box);

    // Entry ring buffer (last 100)
    const MAX_ENTRIES = 100;
    let entries = 0;

    return function debugLog(tag, msg) {
      if (!window.__PC_DEBUG) return;
      const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
      const line = `[${ts}] ${tag} → ${msg}`;
      console.log(`🐛 ${line}`); // also to console

      const entry = document.createElement('div');
      entry.textContent = line;
      Object.assign(entry.style, {
        padding: '1px 0',
        borderBottom: '1px solid rgba(255,255,0,0.1)',
        wordBreak: 'break-word',
        lineHeight: '1.3',
      });

      body.appendChild(entry);
      body.scrollTop = body.scrollHeight;
      entries++;

      // Trim oldest when over limit
      while (body.children.length > MAX_ENTRIES) {
        body.removeChild(body.firstChild);
      }

      const countEl = document.getElementById('pc-debug-count');
      if (countEl) countEl.textContent = entries;
    };
  }
})();