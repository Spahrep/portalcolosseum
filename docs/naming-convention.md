# Database Naming Convention

**Source:** Research + Project Decision (2026-08-30)
**Status:** Active Convention

## Table Naming

- **Singular form**: `weapon_template`, `attack`, `weapon_instance`
- **Snake_case**: all lowercase, underscores between words
- **Descriptive**: `weapon_template` not `wtemplate`

## Rationale

1. **Singular preferred** — DBA convention, scales better with relationships (e.g., `weapon_template_attack` junction table reads cleaner than `weapon_templates_have_attacks`)
2. **Snake_case** — universal SQL best practice, avoids case-sensitivity issues across platforms
3. **Descriptive names** — improves readability, reduces need for external documentation

## Future Tables (anticipated)

- `weapon_template`
- `attack`
- `weapon_instance`
- `element` (for elemental damage types)
- `weapon_type` (sword, dagger, axe, etc.)
