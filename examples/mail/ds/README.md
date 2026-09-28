# @sigx/zero-mail-ds

Zero Mail's design system: indigo over cool neutrals, Inter, a dense 14px
type scale, and two themes (`mail` and `mail-dark`). It was scaffolded by
`create-zero-ds --brief corporate` and has diverged since. Grade A, with 0
audit findings.

- `src/tokens.ts`: the palette and the system tokens. It also holds the
  vocabulary the mail kit's typography keys on:
  - `tone` and `weight` axes;
  - `truncate`, `clamp`, `unread` and `compact` modifiers.
- `src/baseline.ts`: zero-basic's recipes, copied by the scaffold and fitted
  to this vocabulary.
- `src/overrides.ts`: the patches this design system applies on top of that
  baseline, each via `extendRecipe`:
  - ghost overlay triggers;
  - the drawer as a flat sidebar rail;
  - the composer docked to a corner;
  - AA-clearing secondary ink.
- `src/mail.ts`: the recipes for the kit's `mail-*` scopes.
- `src/design-system.ts`: amendments to the generated layout tier and a
  document baseline. Both stand in for gaps tracked in signalxjs/zero#440.

`build.mjs` merges the kit's manifest fragment explicitly, so the kit's
scopes are validated, audited and compiled like zero's own.
