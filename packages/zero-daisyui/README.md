# @sigx/zero-daisyui

[daisyUI](https://daisyui.com)-flavored design system for
[SignalX Zero](https://npmjs.com/package/@sigx/zero): daisy's token values and
component look expressed as pure tokens + recipes over the zero anatomy. No
Tailwind, no daisyUI plugin — the whole skin is compiled CSS.

```ts
import '@sigx/zero/css';
import '@sigx/zero-daisyui/css';
import { installThemes } from '@sigx/zero-daisyui';
installThemes();   // registers the `light`/`dark` pair plus `dim`, `nord` and `sunset`
```

Beside the contract tokens it declares daisy's own two non-contract knobs as
custom properties, because daisy's controls read them directly: `--depth`
(`1` = the inset-shadow relief of `light`/`dark`, `0` = the flat look of `dim`,
`nord` and `sunset`) with the two paints it scales, `--depth-shade` and
`--depth-sheen`; and `--noise` with daisy's fractal tile in `--fx-noise`.
Override `--depth: 0` on a subtree to flatten it.

The checkbox tick, the radio dot and the rating fill are **drawn**, not typeset:
each is geometry that interpolates between states, so it rides the size ramp and
animates. Under `forced-colors` and `print` the checkbox swaps to a `✔`/`−`
glyph; the rating keeps its geometry, since no glyph can say "half".

The palette is daisyUI **5.7.8**'s, role for role, in all five themes — checked
against its shipped `themes.css` rather than transcribed. `light` and `dark` had
drifted a major version behind (#231): among others, light's `primary` was
`oklch(49.12% 0.3096 275.75)` where 5.7.8 declares `oklch(45% 0.24 277.023)`,
and dark's `primary-content` was a *dark* ink where 5.7.8 pairs a light one.
`dim`, `nord` and `sunset` were already exact.

The checkbox's print fallback names `--print-ink` where real daisy names no ink
at all — its glyph inherits `--color-primary-content` and prints at 1.37:1, a
pale lavender on white paper (#233). Fidelity to a mark nobody can see is not
fidelity; the same trade as the ratios below.

Five of daisy's own ratios are deliberately moved, and only these five: the
unchecked toggle knob and the unfilled rating symbol are base-content at **60%**
rather than daisy's 50% and 20%, the rating's default `warning` fill is deepened
**60/40** toward its content pair, the progress bar's fill **90/10** (its
`complete` green **55/45**), and the role **ink** — the colour a transparent or
tinted surface draws a label, a border, a focus ring or an error message with —
is the role mixed toward `--color-base-content`, per role, rather than the raw
role token daisy draws with. Each was measured under 3:1 against the surface it
has to be seen on in at least one shipped theme — an unfilled rating symbol at
daisy's 20% reads 1.44:1 on `nord`, a raw-role `neutral` ghost button 1.22:1 in
every dark theme, and 5.7.8's own lighter `error` 2.87:1 as message text on
white — and 3:1 is the floor a mark owes the reader. The ratios and their
per-theme measurements are recorded at each declaration in `src/recipes.ts`;
every other value in this package is daisy's.

`select`, `combobox` and `number-input` share one field metric — the same
`--size-field` height ramp, inset and `--shadow-xs` lift — so two controls in a
column are the same height. Only the select had it before.

Swap with `@sigx/zero-basic` (or your own generated design system) — same
components, different look, zero component-code changes.

## The daisy-native surface, and migrating from `@sigx/daisyui`

Button carries daisy 5's full style vocabulary — `variant` takes `solid`,
`outline`, `soft`, `ghost`, `dash` (`btn-dash`) and `link` (`btn-link`),
orthogonal to the eight-role `color` axis, exactly as daisy's own CSS composes
`btn-outline` **with** `btn-primary` — plus the six documented `btn-*`
modifiers as presence-only `data-mod-*`: `wide`, `block`, `square`, `circle`,
`active`, and `loading`, whose spinner the recipe draws in `currentColor`
(daisy renders it as a `loading loading-spinner` span; zero changes no DOM).
daisy 4's `glass` is not carried: daisyUI 5 no longer documents it on any
component, and the old library never exposed it either.

Tabs carry daisy 5's three flavors as their own `variant` vocabulary —
`border` (`tabs-border`, the underline that is daisy's default look and the
un-attributed render here too), `lift` (`tabs-lift`) and `box` (`tabs-box`,
the raised-pill look this package used to ship as its only one). `color` is
orthogonal: it inks the active tab — `border`'s underline follows via
`currentColor` — while `box` fills the active pill with the role and flips
its label to the `-content` pair, as daisy's own box examples do.

The package declares an **api** (the `defineApi` layer, see
`docs/architecture.md` §3.6), so beside `/register` it ships a generated
`./components` module — the daisy-native, single-import, fully-typed surface:

```tsx
import { Button } from '@sigx/zero-daisyui/components';

<Button wide loading variant="dash" color="primary">Save</Button>
```

Migrating from the old `@sigx/daisyui` package, prop by prop:

| old `@sigx/daisyui` Button | `@sigx/zero-daisyui/components` Button |
|---|---|
| `variant="primary"` … `variant="error"` (the eight colours in the fused union) | `color="primary"` … `color="error"` |
| `variant="ghost"` / `variant="link"` | `variant="ghost"` / `variant="link"` |
| `variant="neutral"` | `color="neutral"` |
| `outline` / `soft` / `dash` (booleans) | `variant="outline"` / `"soft"` / `"dash"` |
| `wide`, `block`, `square`, `circle`, `active`, `loading` | same names, same booleans |
| `size="xs"` … `size="xl"` | unchanged |
| `loading` also disabling the button | pass `disabled` yourself — loading is paint, not behaviour |

The old fused `ButtonVariant` union (colours + `ghost` + `link` in one prop)
was a modeling artifact, not daisy's real shape — daisy's CSS composes a style
class with a colour class, and so does this package.

## Writing direction

Every direction-bearing rule is spelled logically, so the whole skin mirrors
under `dir="rtl"` (#277, #290). `inset-inline-*` and `margin-inline-*` where a
logical property exists; a direction-valued custom property the RTL selector
rebinds where one does not, since `transform` has no logical form. The kit warns
on the first kind (`validate-recipes`) and `e2e/rtl.spec.ts` measures the second
in a real engine — a logical anchor with a physical travel reads as correct and
still puts the control's thumb outside its own track.

What moved here: the toast viewport's start/end placements, the submenu
chevron (margin and glyph both), the collapsed tree indicator and the
indeterminate progress sweep. The switch needed nothing — its knob grows a grid
column, which is RTL-correct for free, and that is why it was the only one of
the six already right.

MIT © Andreas Ekdahl
