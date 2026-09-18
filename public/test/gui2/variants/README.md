# GUI2 Layout Variants

Disposable sketch variants exploring moving run info/dice to the top and monsters into the right rail (replacing the dice tray).

- **01-tight-dock**: Literal swap. Single top-status bar with player left + run-info + full dice tray right. Monsters panel moved to right rail below Action Queue.
- **02-run-strip**: Persistent full-width run-strip HUD at very top (portal/run + battle counter + compact dice). Player bar below it contains only player info. Monsters in right rail.
- **03-intel-rail**: Minimal top footprint. Compact run-info (battle line + dice row + condensed legend). Monsters use inline 10-cell HP bars (green/yellow/red fill) for at-a-glance status.

Live URLs:
- https://portalcolosseum.com/test/gui2/variants/01-tight-dock/index.html
- https://portalcolosseum.com/test/gui2/variants/02-run-strip/index.html
- https://portalcolosseum.com/test/gui2/variants/03-intel-rail/index.html

All variants share `/test/gui2/gui2-app.js` (no inline scripts). Throwaway comparisons only — winner to be folded into real GUI.

- **04-dw-battle**: Dragon Warrior NES battle screen: dark panels over a vivid sprite arena, message-box narration, action menu appears only on your turn. Has its own `dw-app.js` (narration cycle + turn-gated menu demo).
  Live URL: https://portalcolosseum.com/test/gui2/variants/04-dw-battle/index.html
  **✅ LOCKED IN (Spahrep 2026-09-15) — canonical battle screen design.**
- **05-monster-sprites**: (undocumented)

- **06-run-equip**: The screen immediately after picking a portal — run-entry/equipment selection. 20-slot backpack grid (4×5, real DB items), inspect-on-click popups with real stats, equip LH/RH/BL/C1/C2 (weapons → hand/belt slots, consumables → C1/C2; swap + unequip + wrong-type rejection), PORTAL DICE row (REMAINING/USED), ENTER PORTAL → "Loadout locked" confirmation. Town pano backdrop (`/public/pictures/town/town_pano.jpg`) with the portal arch glowing through the center gap. Own `run-equip-app.js` — external file, because the `/test/gui2/(.*)` route CSP (`script-src 'self'`) blocks inline scripts; `/public/` prefix required on image paths.
  Live URL: https://portalcolosseum.com/test/gui2/variants/06-run-equip/index.html
  **✅ LOCKED IN (Spahrep 2026-09-15) — canonical design for the post-portal-pick inventory/equip screen.**