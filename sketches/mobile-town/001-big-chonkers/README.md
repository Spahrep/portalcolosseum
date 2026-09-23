## Variant: Big Chonkers

### Design stance
A fat-button phone UI that makes "Enter The Portal" the undeniable primary action — you can't miss it, you can't ignore it.

### Key choices
- **Layout:** Vertical stack, flex-based. Portal button gets 2.5× the flex space of any other nav option.
- **Portal treatment:** Gradient background, glow, border accent, radial light — visually distinct from the flat secondary buttons.
- **Secondary buttons:** Horizontal layout with icon + label + chevron. Compact but tappable, min 52px height.
- **Status bar:** Thin persistent strip at the top so AP/Gold is always visible.
- **Logout:** Demoted to a tiny pill at the very bottom — intentional friction.

### Trade-offs
- **Strong at:** One-thumb navigation, clear visual hierarchy, Portal as the hero call-to-action.
- **Weak at:** Doesn't show preview content (portal costs, store inventory) without tapping through. Very listy — if we add more town options, it'll scroll.

### Best for
Mobile-first or tablet users who want to jump straight into combat. Prioritizes speed over information density.