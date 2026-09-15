# 02-bottom-dock — Status bar

**Design stance:** Slim MMO-style dock across the bottom edge, persistent and minimal.

**Key choices:**
- Layout: Full-width 30px dock at bottom with space-between: name left, AP meter+count center, gold right.
- Typography/Color: 11px, navy translucent 0.7, exact token colors.
- Interaction: Same pan/selection; battle re-renders identical dock below action menu.

**Trade-offs:**
- Strong at: Never occludes town view; consistent presence across modes.
- Weak at: Less "glanceable" for AP meter in center; may feel like taskbar chrome.

**Best-for:** Players coming from MMO backgrounds who prefer bottom status bars.

**Mock data note:** AP 24/30, Gold 1,240gc, portal cost example '10 AP · 50gc' are placeholders. Real values from backend per docs/ap-economy.md.