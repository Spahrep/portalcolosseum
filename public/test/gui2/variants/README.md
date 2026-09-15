# GUI2 Layout Variants

Disposable sketch variants exploring moving run info/dice to the top and monsters into the right rail (replacing the dice tray).

- **01-tight-dock**: Literal swap. Single top-status bar with player left + run-info + full dice tray right. Monsters panel moved to right rail below TIME MENU.
- **02-run-strip**: Persistent full-width run-strip HUD at very top (portal/run + battle counter + compact dice). Player bar below it contains only player info. Monsters in right rail.
- **03-intel-rail**: Minimal top footprint. Compact run-info (battle line + dice row + condensed legend). Monsters use inline 10-cell HP bars (green/yellow/red fill) for at-a-glance status.

Live URLs:
- https://portalcolosseum.com/test/gui2/variants/01-tight-dock/index.html
- https://portalcolosseum.com/test/gui2/variants/02-run-strip/index.html
- https://portalcolosseum.com/test/gui2/variants/03-intel-rail/index.html

All variants share `/test/gui2/gui2-app.js` (no inline scripts). Throwaway comparisons only — winner to be folded into real GUI.

- **04-dw-battle**: Dragon Warrior NES battle screen: dark panels over a vivid sprite arena, message-box narration, action menu appears only on your turn. Has its own `dw-app.js` (narration cycle + turn-gated menu demo).
  Live URL: https://portalcolosseum.com/test/gui2/variants/04-dw-battle/index.html