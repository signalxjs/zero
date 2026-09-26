# @sigx/zero-carbon

Carbon-flavoured design system for SignalX Zero — and the **runtime
acceptance test for the api `values` remap** (issue #183).

Where `zero-heroui` proved a vocabulary can be a different *shape* (no colour
axis, a fused `variant`), this package proves a vocabulary can carry a
*spelling* zero's attribute grammar cannot: Carbon's `danger--tertiary` and
`danger--ghost`. The design system declares the kebab members
(`danger-tertiary`, `danger-ghost`); the api declaration is the only place
the double-hyphen spelling lives, and the generated `./components` module
restores it at the prop boundary:

```tsx
import { Button } from '@sigx/zero-carbon/components';

<Button kind="danger--tertiary" hasIconOnly>×</Button>
// renders <button data-scope="button" data-variant="danger-tertiary" data-mod-icon-only="">
```

The rendered attribute keeps the zero spelling the recipes matched — the
vendor spelling never reaches the DOM.

## What it declares

- `roles: {}` — Carbon Button has no colour axis; `kind` fuses colour and
  treatment (`danger` is a kind). The palette lives in `custom` tokens.
- The seven-member `kind` vocabulary, surfaced as `kind` via
  `variant: { as: 'kind', values: { … } }` — grade `reshaped`.
- `hasIconOnly` / `isExpressive` — Carbon's boolean props over the
  `icon-only`/`expressive` presence modifiers.
- Carbon's five-step size ramp (`sm`–`2xl`, the 32–80 px field heights),
  honoured by every size-bearing scope rather than by Button alone, and its
  `white`/`g100` themes.

## Coverage

Full — all 55 authored recipes (every component but the six layout
primitives, which the kit's layout tier styles) speak Carbon's language (square corners,
layer-ramp feedback, the inset 2px focus ring, field-01 text surfaces). The
`kind` axis, the values remap and the renamed boolean modifiers stay
Button-only, per the repo-wide `variant` decision (#175) — Button is the component
that motivated the vendor-named-API design (issue #179, Carbon's row in the
conformance matrix). Values are approximated from public documentation; it
proves the contract rather than shipping a licensed token set, which is why
it is private.

### The side panel slides

The modal drawer sheet slides in from its edge on Carbon's productive entrance
curve (`moderate-02`, 240ms) and out on the exit curve, instead of fading
(#83). The travel flips with the placement and with `dir="rtl"`, and reduced
motion drops it.

### The primary button keeps blue 60 on g100

Carbon has two blues where a naive port has one: `$interactive` (links,
focus, selection, the ghost and tertiary kinds' ink) lightens to blue 50 on
`g100` so it reads on the dark base, while `$button-primary` stays blue 60 in
every theme. The skin used to paint the primary button with the interactive
blue, which left its white label at 3.74:1 on `g100` (#190). The fill is its
own custom token now, `carbon-button-primary`, and the tertiary kind's solid
hover takes it too. `carbon-interactive` is unchanged, so every other use of
the lighter blue stays where it was.

### Notification kind, without a colour axis

`roles: {}` means `toast({ color })` has nothing to select here — the recipe
validator rejects a `variants.color` key that names no declared role, and the
playground reads the live vocabulary and passes no `color` to a carbon toast
at all. The accent bar used to be hardcoded to the interactive blue, which
made every notification an informational one for good.

It now reads the one status distinction zero guarantees on every toast with
no vocabulary at all: `Toast.Root` renders `role="alert"` for an assertive
toast and `role="status"` for the rest. An alert takes `$support-error`; a
status keeps the interactive blue. Two of Carbon's four notification kinds,
which is the honest ceiling of what this design system declares — success and
warning are both `role="status"` and stay blue.

## Usage

```bash
pnpm --filter @sigx/zero-carbon build
```

```ts
import '@sigx/zero-carbon/css';
import { installThemes } from '@sigx/zero-carbon';
import { Button } from '@sigx/zero-carbon/components';

installThemes();
```

No `/register` import is needed for the `./components` path — its types are
self-contained: `kind` narrows to the seven Carbon spellings (including the
double-hyphen members), `kind="nope"` is rejected, and `variant`/`mods`/
`color` do not exist on the vendor surface.

## Countdown in a sentence, and one-sided timelines

`<Countdown.Root mods={{ inline: true }}>` sets a countdown inside running
text: it takes the sentence's size and weight instead of the display
step, and keeps its tabular digits, its ink and the per-tick entry (#57). A
Timeline whose content never sits on the start side collapses the start track
on its own — a `:has()` rule on the root, no prop — so the events sit against
the axis instead of past an empty half of each item.

Carbon ships no countdown, so the modifier has no vendor name: on
`./components` it stays `mods={{ inline: true }}`.

## Avatar shape

`<Avatar.Root axes={{ shape: 'square' }}>` picks `circle`, `square` or
`rounded` (#129) — a custom axis this design system declares in
`tokens.axes` and wires on avatar alone, so the `/register` module types
`axes.shape` there and nowhere else. One declaration on the root, whose
`overflow: hidden` clips the image and the initials alike. Carbon's radii are 0 and square is the default, so `rounded` is a fixed corner in proportion to the avatar.

## Rows wider than their column

A tabs list and a join group scroll inside their own box when they are wider
than the column they sit in (#45), as Pagination, Stats and a horizontal
Timeline do. Neither pads the scroll box: carbon draws every focus ring
inset. The tabs list's baseline rule is an inset shadow rather than a border,
so the active tab's 2px underline still covers it inside the scroll box.

The tokens name `"IBM Plex Sans"` and `"IBM Plex Mono"`. The package does not
ship them: load the faces in your app (the playground bundles them from
`@fontsource`). Without them the text falls back to the platform face, which
may be wider. These rows then scroll sooner, but they never push the page
sideways.

## Writing direction

Every direction-bearing rule is spelled logically, so the whole skin mirrors
under `dir="rtl"` (#277, #290). `inset-inline-*` and `margin-inline-*` where a
logical property exists; a direction-valued custom property the RTL selector
rebinds where one does not, since `transform` has no logical form. The kit warns
on the first kind (`validate-recipes`) and `e2e/rtl.spec.ts` measures the second
in a real engine — a logical anchor with a physical travel reads as correct and
still puts the control's thumb outside its own track.

What moved here: the toast viewport's start/end placements, the submenu
chevron (margin and glyph both), the switch thumb, the collapsed tree indicator
and the indeterminate progress sweep. The checkbox tick and the progress check
are deliberately untouched: they are drawn from rotated borders, and a check
mark is not mirrored in RTL — Carbon does not mirror it either.

## Forced colours

The toggle is background paint only, the way Carbon draws it, and forced colours
revalue every author background to `Canvas`. So under `forced-colors: active`
the track and thumb both used to vanish (#189). The switch now keeps a
`CanvasText` hairline on its track in that mode (border-box, so its size holds),
and its thumb opts out of forcing to paint `CanvasText` at rest and `Highlight`
when checked. A disabled switch paints `GrayText`, the palette's own disabled ink. On and off differ by more than position. `e2e/switch-forced-colors.spec.ts`
measures it in pixels, in all six skins.
