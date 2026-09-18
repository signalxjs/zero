# @sigx/zero-material

A Material-flavoured skin for [SignalX Zero](https://npmjs.com/package/@sigx/zero) —
and the acceptance test for the whole token contract.

**Not published.** It exists to answer one question: does a design language
zero was *not* designed around fit the contract as data, with no
special-casing anywhere in the kit? Its palette is a Material approximation,
not a licensed token set.

## What it proves

Material differs from zero's recommended vocabulary in four ways at once, and
all four are expressed as declarations rather than escape hatches:

| Material | How it lands |
|---|---|
| 13 colour roles, including `tertiary` and a tonal `surface` family | `roles` — the vocabulary is the design system's, not zero's |
| `on-primary`, `on-surface` foregrounds | the `-content` suffix convention, unchanged |
| Surface containers are explicit tones, not derived tints | `soft: false` suppresses the `color-mix()` |
| `outline` is a hairline with no foreground | `content: false` — no unused token, no bogus contrast pair |
| Elevation named `level1`–`level5` | open keys inside the closed `shadow` category |
| `emphasized-decelerate` / `emphasized-accelerate` easings | open keys inside `motion` |
| Window-size classes at 600 / 840 / 1240px | `breakpoints`, driving a full-screen dialog below `sm` |
| The ink ripple, expanding from the press point | pure recipe CSS over the runtime's press feedback (`data-pressed`, `data-press-animating`, `--press-x/y/r`) — no JavaScript in this package |
| State layers on every pressable surface, the 40dp selection-control halo, the switch layer that rides the thumb, the slider handle halo while dragging | the same press data, read four different ways: bounded ripple, centered unclipped circle, a descendant selector from the flagged control to the thumb's pseudo, and vendor thumb pseudos on `data-pressed` |

It validates with **no errors and no warnings**, styles all fifteen
components, and required no change to `@sigx/zero-kit`.

## Two places Material's own spec had to be read, not copied

- **An expanded disclosure header takes the selected container.** Collapsible
  and accordion declare no `indicator` part, and `pressable()` already owns
  both `::before` (the state layer) and `::after` (the ripple), so a chevron
  has nowhere to draw. The trigger says it itself: `open` takes the
  `primary-soft` fill, the primary ink and an inset hairline at its
  block-end — the same "open" this design system paints on a menu
  sub-trigger. `--weight-semibold` is deliberately not used; this vocabulary
  maps it to the same 500 as `medium`, so a weight bump would compile to
  nothing.
- **`toast({ color })` lands on a status marker, not on the container.** M3
  snackbars are monochrome by spec, so the container stays
  surface-container-high at level 3 whatever role you pass; tinting the whole
  surface would be a different design system's answer. The role colours a
  leading dot drawn as `root::before` — the snackbar's leading-icon slot,
  free because `root` is not pressable — alongside the action label that
  already wore it.

```ts
import '@sigx/zero-material/css';
import { installThemes } from '@sigx/zero-material';
installThemes();
```

Two lines — the same two that select any other design system.

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

MIT © Andreas Ekdahl
