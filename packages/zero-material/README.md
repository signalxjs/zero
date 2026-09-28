# @sigx/zero-material

A Material 3 skin for [SignalX Zero](https://npmjs.com/package/@sigx/zero) —
and the acceptance test for the whole token contract.

**Not published.** It exists to answer one question: does a design language
zero was *not* designed around fit the contract as data, with no
special-casing anywhere in the kit? To make the answer mean something, the
skin implements the Material 3 spec itself rather than an approximation of
it. That work is phased under #413, and every place zero or zero-kit cannot
express M3 is filed as an `m3-finding` issue rather than worked around quietly.

## The M3 token set (#414)

| Material 3 | How it lands |
|---|---|
| Colour from M3's own algorithm: HCT tonal palettes from seed `#6750A4`, light and dark at standard, medium and high contrast (six themes) | `scripts/gen-scheme.mjs` runs `@material/material-color-utilities` (devDependency only) into a checked-in `src/scheme.generated.ts`; `pnpm --filter @sigx/zero-material gen:scheme` regenerates it, and a test fails when it is stale |
| The full role set: key colours and their containers, seven surface tones, `surface-variant`, the inverse pair, `outline` / `outline-variant`, `scrim`, `shadow` | `roles`. `on-X` is zero's `X-content`. Fills and hairlines opt out of the `color` axis (`soft: false` / `content: false`) |
| Tonal (container) fills with their `on-*-container` ink | each action role's `-soft` is set to its container per theme, and recipes pair `-container` with `-container-content`. Pairing the key ink with its container instead fails in the high-contrast schemes, where the container goes dark |
| `info` / `success` / `warning`, which M3 does not define | custom colours harmonised toward the seed, each with the same colour / container quartet |
| The corner scale, extra-small (4dp) → extra-extra-large (48dp) and full | open keys in `radius`: `--radius-extra-small` … `--radius-full`. `selector` / `field` / `box` remain as aliases, because zero's token hints and structural fallbacks name them |
| The fifteen type roles (display … label × large/medium/small) | a size, a unitless line height and a tracking under one key (`--text-title-medium`, `--leading-title-medium`, `--tracking-title-medium`), composed by the recipes' `type()` helper |
| Duration tokens `short1` … `extra-long4`, and the easing set | open keys in `motion`. `emphasized` is M3's two-segment path, sampled into `linear()` |
| M3 Expressive's springs (spatial and effects × fast/default/slow) | simulated and sampled into `linear()` easings, each with a same-named duration |
| Elevation `level0`–`level5` | open keys inside the closed `shadow` category, deepened under dark themes |
| State layers: hover 8%, focus 10%, pressed 10%, dragged 16% | `--state-*` custom tokens, including the focus layer beside the focus ring |
| Window size classes at 600 / 840 / 1200 / 1600 | `breakpoints` `sm` / `md` / `lg` / `xl`, driving a full-screen dialog below `sm` |

## The M3 component API (#415)

`@sigx/zero-material/components` carries M3's own names. It is built from the
`api` in `src/design-system.ts`:

```tsx
import { Button, Toggle, ToggleGroup, Join } from '@sigx/zero-material/components';

<Button variant="tonal" size="s">Save</Button>                 {/* M3's default 40dp button */}
<Button variant="outlined" shape="square" size="m">Share</Button>
<Button fab icon color="tertiary" aria-label="Compose">…</Button> {/* the square FAB */}
<Button fab>Compose</Button>                                     {/* the extended FAB */}
<Toggle variant="elevated" icon aria-label="Favourite">…</Toggle>
```

| M3 | How it lands |
|---|---|
| Common buttons: `filled`, `tonal`, `elevated`, `outlined`, `text` | the `variant` axis, spelled as M3 spells it (grade `exact`). Unset, a tonal button is secondary-container and an outlined one on-surface-variant, as M3 draws them; `color` rebinds either to a role |
| Expressive sizes XS / S / M / L / XL: 32 / 40 / 56 / 96 / 136dp, each with its own padding, icon, label role and outline | zero's `xs … xl` ramp, respelled `xs \| s \| m \| l \| xl` on button and toggle only (`api.components`). `s` is the default; every other scope keeps zero's spellings |
| `round` / `square` shapes, and the press morph | the `shape` axis (shared with the avatar's `circle \| square \| rounded`, each scope narrowed to its own). A press morphs the corner to the size's pressed radius on the fast spatial spring; `round` is half the height rather than `full`, so the morph has two real lengths to interpolate between |
| Icon buttons (standard, filled, tonal, outlined) | the `icon` modifier on Button or Toggle. `text` + `icon` is the standard icon button, in on-surface-variant |
| FAB, medium and large FAB, extended FAB | the `fab` modifier: the role's container at level 3 on the large corner, stepping 40 / 56 / 80 / 96dp with size. With `icon` it is the square FAB, without it the extended one. `filled` takes the role colour itself, `elevated` gives the surface FAB |
| Toggle buttons | `Toggle`, with M3's unselected → selected colours per style and the selected shape swap (round turns square, square turns round) |
| Segmented button | `ToggleGroup`: an outlined pill at 40dp, selected segments on secondary-container with the check sliding in before the label |
| Connected button group and split button | `Join`: segments 2dp apart with small inner corners, and the split button's menu half fully round while its menu is open |
| Disabled buttons | M3's explicit colours: the label at 38% on-surface over a 10% container. Outlined and text buttons get no container, and the outline goes to 10% |

M3 ships icon buttons and FABs as separate components; here they are
configurations of one Button, so their grade is `reshaped`.

## What the recipes prove

| Material | How it lands |
|---|---|
| The modal navigation drawer sliding in on emphasized-decelerate and out on emphasized-accelerate (#83), and the bottom sheet rising the same way (#291) | `translate` over a direction-flipped `--drawer-travel` (on the block axis, unflipped, for `top`/`bottom`), keyed on the regime (`data-l-dock="sheet"`) so the slide-out leaves from the sheet's own box |
| The ink ripple, expanding from the press point | pure recipe CSS over the runtime's press feedback (`data-pressed`, `data-press-animating`, `--press-x/y/r`) — no JavaScript in this package |
| State layers on every pressable surface, the 40dp selection-control halo, the switch layer that rides the thumb, the slider handle halo while dragging | the same press data, read four different ways: bounded ripple, centered unclipped circle, a descendant selector from the flagged control to the thumb's pseudo, and vendor thumb pseudos on `data-pressed` |

It validates and audits with **no errors and no warnings** in all six themes,
and styles every component in zero's manifest.

## Places Material's own spec had to be read, not copied

- **An expanded disclosure header takes the selected container.** Collapsible
  and accordion declare no `indicator` part, and `pressable()` already owns
  both `::before` (the state layer) and `::after` (the ripple), so a chevron
  has nowhere to draw. The trigger says it itself: `open` takes the
  primary container, its on-container ink and an inset hairline at its
  block-end. `--weight-semibold` is deliberately not used; this vocabulary
  maps it to the same 500 as `medium`, so a weight bump would compile to
  nothing.
- **`toast({ color })` lands on a status marker, not on the container.** M3
  snackbars are monochrome by spec, so the container stays
  surface-container-high at level 3 whatever role you pass; tinting the whole
  surface would be a different design system's answer. The role colours a
  leading dot drawn as `root::before` — the snackbar's leading-icon slot,
  free because `root` is not pressable — alongside the action label that
  already wore it.
- **A promise toast's indicator takes the marker's slot.** While
  `Toast.Indicator` is rendered, the `::before` dot steps aside and the
  indicator fills that leading column: M3's circular progress (the accent
  arc on its outline track) while loading, then a tick or a cross. The
  snackbars stay a plain column; this skin does not deal a stack as cards.

```ts
import '@sigx/zero-material/css';
import { installThemes } from '@sigx/zero-material';
installThemes();
```

Two lines — the same two that select any other design system.

## Countdown in a sentence, and one-sided timelines

`<Countdown.Root mods={{ inline: true }}>` sets a countdown inside running
text: it takes the sentence's size and weight instead of the display
step, and keeps its tabular digits, its ink and the per-tick entry (#57). A
Timeline whose content never sits on the start side collapses the start track
on its own — a `:has()` rule on the root, no prop — so the events sit against
the axis instead of past an empty half of each item.

## Avatar shape

`<Avatar.Root axes={{ shape: 'square' }}>` picks `circle`, `square` or
`rounded` (#129) — a custom axis this design system declares in
`tokens.axes` and wires on avatar alone, so the `/register` module types
`axes.shape` there and nowhere else. One declaration on the root, whose
`overflow: hidden` clips the image and the initials alike. `rounded` is Material's small shape; unset, the avatar is the circle it always was.

## Disabled overlay triggers

A disabled Dialog, Popover, Tooltip, Menu or Drawer trigger fades:
`opacity: var(--disabled-opacity)` and `cursor: not-allowed` (#191). Since
#415, Button itself disables with M3's explicit colours instead. The triggers
follow when the overlays are rebuilt to M3's specs (#418). The dismiss actions (Dialog's close and cancel,
and the close on Popover and Drawer) fade the same way. These parts paint the
accent ink, and that overrides the browser's grey text for `:disabled`. Before
this change a disabled trigger lost only its hover layer and kept its full
colour and pointer cursor.

## Writing direction

Every direction-bearing rule is spelled logically, so the whole skin mirrors
under `dir="rtl"` (#277, #290). `inset-inline-*` and `margin-inline-*` where a
logical property exists; a direction-valued custom property the RTL selector
rebinds where one does not, since `transform` has no logical form. The kit warns
on the first kind (`validate-recipes`) and `e2e/rtl.spec.ts` measures the second
in a real engine — a logical anchor with a physical travel reads as correct and
still puts the control's thumb outside its own track.

What moved here: the toast viewport's start/end placements, the switch thumb,
the collapsed tree indicator and the indeterminate progress sweep. There is no
submenu chevron to turn around — `pressable()` owns both pseudo-elements, so a
chevron is content the app supplies.

The half-star gradient's RTL rule also lost the specificity it never meant to
have: written bare, `:dir(rtl)` outranked the `forced-colors` override beneath
it, so a half star kept its gradient where it should have dropped to
`CanvasText`. Written `:where(…)` the two tie and the later rule wins.

## Forced colours

The switch handle is background paint, which forced colours revalue to `Canvas`.
The bordered track survived, but the handle inside it vanished, so on and off read
identically (#189). Under `forced-colors: active` the handle now opts out of
forcing and paints `CanvasText` at rest and `Highlight` when checked. A disabled
switch paints `GrayText`, the palette's own disabled ink.
`e2e/switch-forced-colors.spec.ts` measures it in pixels, in all six skins.

MIT © Andreas Ekdahl
