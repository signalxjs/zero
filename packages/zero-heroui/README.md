# @sigx/zero-heroui

A HeroUI-flavoured design system for [SignalX Zero](https://npmjs.com/package/@sigx/zero),
and **the acceptance test for non-orthogonal axis surfaces and presence-only
modifiers** (see `docs/architecture.md`, "Thesis and shape").

Private, like `@sigx/zero-material`: it proves the contract rather than shipping
a licensed token set. Values are approximated from public documentation.

## Why it exists

The other four design systems in this repo are all the same shape — a colour
axis crossed with a fill treatment, on an `xs`–`xl` ramp — and all four
independently declare the *same* four variants (`solid`, `outline`, `soft`,
`ghost`). Nothing in the contract requires that. It is convention, and a
convention nothing contradicts is indistinguishable from a constraint.

HeroUI v3 contradicts it on every axis at once:

| | the other four | this package |
|---|---|---|
| colour | 8–13 roles, passed as `color` | **no colour axis at all** — `roles: {}` |
| variant | `solid \| outline \| soft \| ghost` | `primary \| secondary \| tertiary \| outline \| ghost \| danger \| danger-soft` |
| size | the recommended five (none declares its own) | **three, declared** — `sm \| md \| lg` |
| booleans | none expressible before the `data-mod-*` namespace landed | `icon-only`, `pending` as `data-mod-*` |

In v3 there is no `color` prop: colour is *fused into* `variant`, so `danger` is
a variant and `danger-soft` is one member carrying a colour and a treatment
together. That cannot be expressed as colour × fill, which is exactly the point.

## What it proves

- **`roles: {}` works end to end.** No `--color-<role>` is emitted, every
  component types `color: never`, and the generated register module says *why*
  — "heroui declares no color axis at all", not "no recipe wires it", which
  would send an author looking for a bug that isn't there.
- **The theme swatch degrades rather than breaking**, falling back to the base
  pair so a theme picker still has something to show.
- **A declared `sizes` closes the set** — the first package here to declare one,
  so `size.xl` in a recipe is an error rather than a silently minted step.
- **Modifiers render presence-only** (`[data-mod-icon-only]`, no value), and one
  participates in a `compoundVariants` match — the first use of either by any
  design system.

Every claim above is asserted in `packages/zero-kit/__tests__/heroui-acceptance.test.ts`.

## Coverage

Every component is styled: all 56 authored recipes (56/56), plus the kit's
layout tier for the six layout primitives. The package still exists to exercise
the *axis surface*, and button carries all of it — `variant` is wired on button
only, matching the repo-wide decision that the other carriers wire none
(issue #175; the per-carrier reasons are the `NO_VARIANT` ledger in
`packages/zero-kit/__tests__/axis-coverage.test.ts`). It is wired into the
playground alongside the other design systems.

## Motion

The modal drawer sheet slides in from its placement edge, as HeroUI's Drawer
does, instead of fading (#83): decelerating in, accelerating out. The travel
flips with the placement and with `dir="rtl"`, and reduced motion drops it.

## Usage

```bash
pnpm --filter @sigx/zero-heroui build
```

```ts
import '@sigx/zero-heroui/css';
import '@sigx/zero-heroui/register';   // opt-in types
import { installThemes } from '@sigx/zero-heroui';

installThemes();
```

With `/register` imported, `<Button.Root variant="danger-soft" mods={{ 'icon-only': true }}>`
type-checks, `variant="solid"` does not, and `color` is rejected outright.

## The vendor-named surface (`./components`)

This package also ships the first real vendor-named component module (issue
#179): HeroUI's own prop spellings over zero's anatomy, generated from the
`api` declaration in `src/design-system.ts`.

```tsx
import { Button } from '@sigx/zero-heroui/components';

<Button variant="danger" isIconOnly>×</Button>
// renders <button data-scope="button" data-variant="danger" data-mod-icon-only="">
```

No `/register` import is needed — `components.d.ts` is self-contained, so
`variant` narrows to the fused seven-member union and `isIconOnly`/`isPending`
are boolean props, while `variant="solid"`, `mods={…}` and `color` are
rejected. The runtime is data only: one generated `adapt()` call for Button
(the one component with renamed props), plain re-exports for the rest. The
rendered attributes are unchanged — the recipes and every existing consumer
are untouched.

## Countdown in a sentence, and one-sided timelines

`<Countdown.Root mods={{ inline: true }}>` sets a countdown inside running
text: it takes the sentence's size and weight instead of the display
step, and keeps its tabular digits, its ink and the per-tick entry (#57). A
Timeline whose content never sits on the start side collapses the start track
on its own — a `:has()` rule on the root, no prop — so the events sit against
the axis instead of past an empty half of each item.

HeroUI ships no countdown, so the modifier has no vendor name: on
`./components` it stays `mods={{ inline: true }}`.

## Avatar shape

`<Avatar.Root axes={{ shape: 'square' }}>` picks `circle`, `square` or
`rounded` (#129) — a custom axis this design system declares in
`tokens.axes` and wires on avatar alone, so the `/register` module types
`axes.shape` there and nowhere else. One declaration on the root, whose
`overflow: hidden` clips the image and the initials alike. `rounded` is HeroUI's `radius="sm"`; unset, the avatar is the circle it always was.

## Writing direction

Every direction-bearing rule is spelled logically, so the whole skin mirrors
under `dir="rtl"` (#277, #290). `inset-inline-*` and `margin-inline-*` where a
logical property exists; a direction-valued custom property the RTL selector
rebinds where one does not, since `transform` has no logical form. The kit warns
on the first kind (`validate-recipes`) and `e2e/rtl.spec.ts` measures the second
in a real engine — a logical anchor with a physical travel reads as correct and
still puts the control's thumb outside its own track.

What moved here: the toast viewport's start/end placements, the toast's own
entry direction, the submenu chevron glyph, the collapsed tree indicator, the
indeterminate progress sweep — and the switch thumb, which is the reason the
e2e half of this exists. Its anchor was already `inset-inline-start` while its
travel was a bare positive `translate`, so under RTL the anchor moved the thumb
to the reading end and the travel carried it further the same way, off the
track. Nothing that reads declarations could see it; half a conversion was worse
than none.

## Tints mix in oklab

Every tint against a base token is `color-mix(in oklab, …)` (#123). HeroUI's
light `base-100` is `oklch(100% 0 0)` and its dark `base-content` is
`oklch(98% 0 0)`: achromatic, but with a written hue of 0. Mixed `in oklch`,
the browser interpolates toward that hue, so the highlighted file-upload
dropzone's 8% primary wash painted pink rather than blue, and the diff
handle's pressed accent drifted off the primary. `in oklab` has no hue to
drift toward. The kit's contrast audit now reads written hues the way the
browser does, so a mix like this can't pass the parity gate for the wrong
reason.
