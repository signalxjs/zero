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
| The full role set: key colours and their containers, seven surface tones, `surface-variant`, the inverse pair, `outline` / `outline-variant`, `scrim`, `shadow` | `roles`. `on-X` is zero's `X-content`. Fills and hairlines are declared `axis: false`, off the `color` axis (#425). None of them has a `-soft` tint (`soft: false`), and the hairlines have no ink (`content: false`) |
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

## M3 text fields (#416)

Input, Textarea, NumberInput, Select and Combobox are M3's text field: filled
by default, outlined with `variant="outlined"`.

```tsx
<Field.Root>
    <Field.Label>Country</Field.Label>
    <Select.Root variant="outlined">…</Select.Root>
</Field.Root>
```

| M3 | How it lands |
|---|---|
| Filled field: surface-container-highest, top corners extra-small, a 1dp active indicator that turns 2dp and primary on focus | the box (`control`, `textarea`, `trigger`) reads `--tf-*` custom properties that the variant sets on the root. The indicator is an inset shadow, so nothing reflows |
| Outlined field: a 1dp outline, 2dp and primary on focus, extra-small corners | the same properties. The focused outline is an inset ring added to the border |
| The floating label: resting over the input while the field is empty and unfocused, floating to the top edge (filled) or onto the outline (outlined) otherwise | `Input.Label` and friends, or a `Field.Label` over any text field. It rests on `data-placeholder`, which the runtime stamps on an empty field's root and control and on the select trigger (#416), and floats on `:focus-within`. It moves by `transform`, on M3's short3 duration |
| The notch in the outline behind the floated label | the label's background is `--tf-surface`, a theme token that defaults to `surface`. A container sets it to its own fill (#468) |
| The placeholder shows only once the label has floated | while a visible label rests, `::placeholder` and an empty select's value are transparent |
| Hover, error, disabled | the 8% on-surface state layer in a filled field's fill, a darker outline, the error role on the indicator, label and trailing icon, and M3's 38% / 4% disabled colours |
| Leading and trailing icons, prefix and suffix, trailing icon buttons | `adornment` in the 24dp slot 12dp from the edge. The resting label moves past a leading icon; affix text sits on the input's text line (#467). The clear and visibility triggers and NumberInput's steppers are 40dp icon buttons in the trailing slot |
| Supporting and error text | `Field.Description` and `Field.Error` in body-small, 16dp in under a text field |
| Density | the size axis sets the height (40 / 48 / 56 / 64 / 72dp, `md` = M3's 56), and the padding and label positions follow it |

## M3 selection controls (#417)

| M3 | How it lands |
|---|---|
| Checkbox: an 18dp box with a 2dp corner and a 2dp on-surface-variant outline (on-surface on hover), the stroked check drawn on, a 40dp state layer | `--checkbox-size` is 18dp at `md` (14 / 16 / 18 / 22 / 26 across the ramp), the corner is the `selector` radius, and the halo is 40/18 of the box |
| Radio: a 20dp ring, a 10dp dot, a 40dp state layer | `--radio-size` is 20dp at `md` (16 / 18 / 20 / 24 / 28), and the halo is twice the ring |
| Switch: a 52 × 32 track in surface-container-highest, the handle 16 → 24dp when selected and 28dp while pressed, on-surface-variant / primary-container on hover | the handle travels and grows on the fast spatial spring; the press and hover colours hang off the control's flags |
| Slider (M3 Expressive): a 16dp track, a 4 × 44dp bar handle in a 6dp gap that narrows to 2dp while pressed, a stop indicator at the track's end, dot stops | `--slider-track-size` / `--slider-handle-size` / `--slider-handle-width` / `--slider-gap`, read by both projections (native and composed) and by the vertical rail. The size axis steps Expressive's tracks (8 / 12 / 16 / 24 / 40dp). The gap is painted with `--tf-surface` (#468). The inactive track stays surface-container-highest, not Expressive's secondary-container, which in the high-contrast schemes sits within 1.6:1 of primary. Stops take one ink and there is no value bubble (#490) |
| Disabled | M3's explicit colours in place of an opacity fade: outlines, fills and handles at 38% on-surface, tracks at 12%, a selected checkbox's mark and a selected switch's handle in `surface` |

## M3 containment and overlays (#418)

| M3 | How it lands |
|---|---|
| Motion: a surface enters on emphasized-decelerate (400ms) and leaves on emphasized-accelerate (200ms) | `popupPresence` puts the entry on `open` and the exit on the base, so menus, popovers, tooltips and dialogs share M3's pair |
| Cards: elevated (surface-container-low, level 1), filled (surface-container-highest), outlined (surface under a 1dp outline-variant), on the medium corner, 16dp in | Card's `variant`. A `color` makes it tonal: the role's container under its on-container ink |
| Dialog: surface-container-high on the extra-large corner at level 3, 280–560dp wide, headline-small over body-medium, text-button actions, the scrim at 32% | full-screen below `sm`. A full-screen dialog chosen per use rather than per viewport needs a popup variant zero can't pass (#514) |
| Menus and listboxes: surface-container at level 2 on the extra-small corner, 48dp label-large items 12dp in, outline-variant dividers | Menu, submenus, and the Select and Combobox listboxes |
| Plain tooltip: inverse-surface, body-small, 24dp tall at least, 200dp wide at most | Tooltip |
| Rich tooltip: surface-container at level 2 on the medium corner, a title-small subhead, body-medium text, text-button actions | Popover and HoverCard. Tooltip can't take a `rich` variant: its popup can't see the trigger's axes (#514) |
| Snackbar: inverse-surface at level 3 on the extra-small corner, body-medium, an inverse-primary action | Toast. A role colours the leading marker as its container, ringed in the snackbar's ink. The promise indicator is monochrome, because no role has an ink for the inverse surface in every scheme |
| Sheets: surface-container-low, the large corner on a side sheet's inner edge, the bottom sheet's extra-large top and its 32 × 4dp drag handle, level 1 once modal | Drawer |
| Overlay triggers and dismiss actions | the outlined button and the text button from #415, with M3's disabled colours |
| Dividers | 1dp outline-variant |

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

A disabled Dialog, Popover, Tooltip, Menu or Drawer trigger takes M3's
disabled button colours, the way a disabled Button does (#415, #418): the
label at 38% on-surface, the outline at 12%, and `cursor: not-allowed`. The dismiss actions (Dialog's close and cancel,
and the close on Popover and Drawer) disable the same way. These parts paint the
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
