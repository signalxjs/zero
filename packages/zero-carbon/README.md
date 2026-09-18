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

Full — all 40 components carry recipes in Carbon's language (square corners,
layer-ramp feedback, the inset 2px focus ring, field-01 text surfaces). The
`kind` axis, the values remap and the renamed boolean modifiers stay
Button-only, per the repo-wide `variant` decision (#175) — Button is the component
that motivated the vendor-named-API design (issue #179, Carbon's row in the
conformance matrix). Values are approximated from public documentation; it
proves the contract rather than shipping a licensed token set, which is why
it is private.

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
