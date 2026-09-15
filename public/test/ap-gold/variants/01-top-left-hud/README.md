# 01-top-left-hud — Corner HUD

**Design stance:** Classic RPG resource cluster fixed top-left, prominent only in town view.

**Key choices:**
- Layout: Fixed 180px translucent navy panel top-left with player name, AP meter bar + count, gold icon.
- Typography: 11px Pixeloid Mono, #ffcc66 for player/gold, #66ccff for AP.
- Color: rgba(10,26,46,0.78) panel, #4a90d9 border, exact game tokens.
- Interaction: Tooltip on cluster explains economy; battle view compresses to dim 10px line in run-info.

**Trade-offs:**
- Strong at: Immediate visibility of resources on town arrival; feels like classic RPG HUD.
- Weak at: Takes screen real-estate in town; disappears in battle (may feel inconsistent).

**Best-for:** Players who want traditional top-left resource awareness before committing to runs.

**Mock data note:** AP 24/30, Gold 1,240gc, portal cost example '10 AP · 50gc' are placeholders. Real values from backend per docs/ap-economy.md.