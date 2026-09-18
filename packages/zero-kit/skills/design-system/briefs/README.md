# Style-brief pack

Six complete, compiling starting points for a Zero design system. Each file is
one `TokensInput` — every category filled, both colour schemes, contrast clean —
plus one worked `RecipeInput` for Button, the component a design system is
judged on and the only one where all three variant axes matter at once.

**Pass the closest file as `--brief` to `pnpm create @sigx/zero-ds`, then
diverge.** The scaffold splits it into `src/tokens.ts` and `src/button.ts`
and lays `@sigx/zero-basic`'s 50 recipes under it as the baseline, fitted to
the brief's vocabulary (`fitRecipesToVocabulary`).

| File | The look | Teaches |
|---|---|---|
| [`brutalist.ts`](brutalist.ts) | square, thick-ruled, hard-shadowed, shouted in mono | how far the standard categories stretch before you need a custom token |
| [`glass.ts`](glass.ts) | frosted translucent surfaces over a soft field | declared `custom` tokens, and translucency that survives both schemes |
| [`corporate.ts`](corporate.ts) | blue primary, grey ramp, modest and layered | contrast discipline and declared breakpoints |
| [`terminal.ts`](terminal.ts) | phosphor console, monospace, one signal colour | `0ms` durations instead of `transition: none`, and a glow built from theme colours |
| [`riso.ts`](riso.ts) | duotone risograph print, two spot inks on warm paper | `roles: {}` / `sizes: []` to decline an axis, a fused `variant` vocabulary, modifiers, and a compound that matches one |
| [`seeded.ts`](seeded.ts) | indigo and coral, soft corners, a near-flat type ramp | deriving a whole palette from seed hues with the contrast guarantee, and where hand-tuning still belongs |

They are deliberately not six palettes. Read all six and you have seen most
of what the token contract can express — the type ratios alone (1.414, 1.25,
1.2, 1.125, 1.333, 1.15) are most of the difference between the six looks.

**Five of the six take the default axis surface** — the recommended eight
roles, the `xs…xl` ramp, and `solid | outline | soft | ghost`. That set is a
convention, not the contract, and reading only those is how a generated
design system ends up inheriting it by accident. `riso.ts` is the counterweight:
it declines the colour and size axes outright and fuses colour into `variant`,
the shape `@sigx/zero-heroui` and `@sigx/zero-carbon` declare.

**`seeded.ts` is the only one that writes no colour.** Its `themes` block is
one `deriveThemePair` call over two seed hues — the worked example of the
kit's palette derivation and of the one runtime import a `tokens.ts` may
make from the kit (`@sigx/zero-kit/define`). The other five hand-author
every `oklch()`; read `seeded.ts` first when the brief is a hue and a mood,
and the others when a value is locked and has to be written.

## These files run

`packages/zero-kit/__tests__/briefs.test.ts` validates and compiles every brief
on each test run, asserts each one's signature move survives into the CSS, and
compares the skill's cheat-sheet table against the values in these files cell by
cell. A brief that goes stale is a failing test rather than a trap for whoever
copies it next — which is the failure mode this pack exists to prevent.

## What writing them found

Two defects, both silent, both now guarded:

- **`data-color` was invisible on the glass Button.** The frosted default fill
  never read `--btn-accent`, so the whole colour axis did nothing. Caught by
  rendering it, not by reading the CSS.
- **A design-system-level token that reads a colour was frozen at `:root`.**
  CSS substitutes `var()` where a property is declared, so
  `0 0 16px var(--color-primary)` in `system.shadow` captured the `:root`
  colour and every `[data-theme]` block inherited it — the terminal glow stayed
  green on the amber theme. Fixed in the compiler (#60): a colour-referencing
  token is now restated inside each theme block, so `terminal.ts` states its
  glow once and it resolves per theme.
