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

The modal drawer sheet **slides** in from its edge and back out, the way daisy's
`drawer-side` does (`translate` over 0.3s), instead of fading (#83). The travel
flips with the placement and with `dir="rtl"`, and reduced motion drops it.

The checkbox tick, the radio dot and the rating fill are **drawn**, not typeset:
each is geometry that interpolates between states, so it rides the size ramp and
animates. Under `forced-colors` and `print` the checkbox swaps to a `✔`/`−`
glyph; the rating keeps its geometry, since no glyph can say "half".

The slider is **rebuilt** with `appearance: none` (#26), like every other skin,
instead of a stock native range behind `accent-color`: daisy's `range.css` track
(half the thumb's height, `--radius-selector`) and its real thumb — a `base-100`
knob in a `.25rem` ring of the fill ink, with the `--depth` shading. The whole
widget rides daisy's `range-{xs…xl}` ramp through `--slider-thumb-size`
(×4…×8 of `--size-selector`) and `--slider-track-size` (half of it), `md`
included, and the composed range parts read the same two tokens. The elapsed
fill is the progress bar's 90/10 deepened accent, painted from the
runtime-published `--slider-percent`; `invalid` still turns fill and rings to
`error` under every colour variant. Under `forced-colors` the native widget
comes back.

The switch knob is `currentColor` background plus shadows, which forced colours
revalue to `Canvas` and drop. That left two identical empty pill outlines, on and
off (#189). Under `forced-colors` the knob now opts out of forcing and paints
`CanvasText` at rest and `Highlight` when checked, without the noise or the
shadows. A disabled switch paints `GrayText`, the palette's own
disabled ink. `e2e/switch-forced-colors.spec.ts` measures it in pixels.

The palette is daisyUI **5.7.8**'s, role for role, in all five themes — checked
against its shipped `themes.css` rather than transcribed. `light` and `dark` had
drifted a major version behind (#231): among others, light's `primary` was
`oklch(49.12% 0.3096 275.75)` where 5.7.8 declares `oklch(45% 0.24 277.023)`,
and dark's `primary-content` was a *dark* ink where 5.7.8 pairs a light one.
`dim`, `nord` and `sunset` were already exact.

Three content-role values are the exception, in `light` and `dark` only (#34):
two roles across the two themes. daisy ships `secondary-content` at **3.05:1**
on `secondary` in both themes, and dark `primary-content` at **4.14:1** on
`primary` — below AA for the label text each pair exists to carry, and the
kit's validator warned for them on every build.
Each now takes the lightness the validator suggests, keeping daisy's hue:
`secondary-content` is a dark ink, `oklch(24.2% 0.028 342.258)`, and dark
`primary-content` a near-white `oklch(98.9% 0.005 272.314)` (chroma drops to
what stays in gamut that close to white). `dim`, `nord` and `sunset` clear AA
as shipped.

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
every other value in this package is daisy's, bar the three content-role values
above.

`select`, `combobox` and `number-input` share one field metric — the same
`--size-field` height ramp, inset and `--shadow-xs` lift — so two controls in a
column are the same height. Only the select had it before.

Swap with `@sigx/zero-basic` (or your own generated design system) — same
components, different look, zero component-code changes.

## The daisy-native surface, and migrating from `@sigx/daisyui`

Button carries daisy 5's full style vocabulary — `variant` takes `solid`,
`outline`, `soft`, `ghost`, `dash` (`btn-dash`) and `link` (`btn-link`),
orthogonal to the eight-role `color` axis, exactly as daisy's own CSS composes
`btn-outline` **with** `btn-primary` — plus five documented `btn-*`
modifiers as presence-only `data-mod-*`: `wide`, `block`, `square`, `circle`
and `active`. `loading` is zero's own Button prop (a state, with `aria-busy`
and a blocked press), and the recipe draws its `spinner` part in
`currentColor`: that part is daisy's `loading loading-spinner` span.
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
| `loading` also disabling the button | built in: `loading` blocks the press and sets `aria-busy`, and keeps focus |

The old fused `ButtonVariant` union (colours + `ghost` + `link` in one prop)
was a modeling artifact, not daisy's real shape — daisy's CSS composes a style
class with a colour class, and so does this package.

## Countdown in a sentence, and one-sided timelines

`<Countdown.Root mods={{ inline: true }}>` sets a countdown inside running
text: it takes the sentence's size and weight instead of the display
step, and keeps its tabular digits, its ink and the per-tick entry (#57). A
Timeline whose content never sits on the start side collapses the start track
on its own — a `:has()` rule on the root, no prop — so the events sit against
the axis instead of past an empty half of each item.

On `./components` the modifier is a boolean prop like the `btn-*` set:
`<Countdown inline>`. daisy's own `.countdown` sets no display size at all,
so `inline` is also the daisy-faithful look.

## Per-entry timeline colour

`<Timeline.Marker color="error">` colours one entry's dot while the Root's
`color` paints the rest (#94) — the marker re-carries the colour axis. A
coloured dot is the role's fill inside a ring in the role's `-content` ink:
a light role on a light page, or a dark one on a dark page, has no edge of
its own, while one half of the role's pair clears 3:1 against the page —
which the contrast audit now measures for every colour and theme. An
uncoloured marker is the same solid dot as before, and under forced colours
the ring still draws the whole dot.

On `./components`, `Timeline.Marker` takes the same `color` union as the
Root.

## Per-step colour

`<Steps.Item color="error">` colours one step — its disc, the bridge toward
the next step and its title — while the Root's `color` paints the rest of the
rail (#112), daisy's `step-error` on one `step`. The item re-carries the
colour axis, so the recipe keys its colour on `item`; a root colour reaches
every step exactly as before.

Measuring every role on a step for the first time found the complete disc's
digit unreadable in six cells: nord's muted `accent`, `success` and `warning`
(2.2–2.6:1) and the dark themes' `neutral`, which is darker than the page
(1.7–2.0:1). The digit now keeps the same share of each role's hue as
`roleInk` does, capped at the 70% primary always had, so the default digit is
unchanged. The disc's tint also mixes in OKLAB now: the light theme's
`oklch(100% 0 0)` page has a 0 hue that an OKLCH mix interpolates toward, so
every tint in the light theme leaned red — warning's came out pink.

On `./components`, `Steps.Item` takes the same `color` union as the Root.

## Deriving from this skin: the public hooks

A product skin built on this one with `extendDesignSystem` (from
`@sigx/zero-kit/define`) may rely on the names each recipe declares as
`hooks` (#73) — `dist/manifest.json` lists them per scope under
`components[scope].hooks`. Today that is the component-level colour and
metric properties of button (`--btn-accent`, `--btn-on-accent`, `--btn-soft`,
`--btn-ink`), switch (`--switch-size`, `--switch-accent`, `--switch-ink`),
badge, table, card, timeline, toggle-group, skeleton and collapsible; the
dialog popup's `zero-daisy-pop` keyframe; and the collapsible trigger's
`::after` chevron. Anything else a patch reaches — `--switch-p`, the spinner
keyframes, the menu's checkmark `::after` — is private and may change in any
release; `validateDesignSystem` warns when a patch touches one.

## Avatar shape

`<Avatar.Root axes={{ shape: 'square' }}>` picks `circle`, `square` or
`rounded` (#129) — a custom axis this design system declares in
`tokens.axes` and wires on avatar alone, so the `/register` module types
`axes.shape` there and nowhere else. One declaration on the root, whose
`overflow: hidden` clips the image and the initials alike. `rounded` is daisy's selector radius; unset, the avatar is the circle it always was.

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
