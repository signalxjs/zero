# @sigx/zero-brutalist

A brutalist skin for [SignalX Zero](https://npmjs.com/package/@sigx/zero) —
**generated from a one-line style brief through the `design-system` agent
skill**, not written by hand against the API.

**Not published.** It exists to prove the thesis end to end, and to act as the
regression test for the skill itself.

## What it proves

The skill's cheat sheet describes brutalist as: radius 0, 2–3px solid borders,
a high-contrast palette with few hues, hard offset shadows, uppercase labels,
and a mono stack with 800+ weights and wide tracking. Every one of those is a
declaration:

| Brief | Declaration |
|---|---|
| nothing rounded | `radius: { selector: '0', field: '0', box: '0' }` |
| thick borders | `border: '3px'`, thinner under dark via `systemDark` |
| hard offset shadows | `shadow` drawn in `--color-base-content`, zero blur |
| mono, heavy, tracked out | `typography.fonts.mono` for both stacks, weights to 900, `tracking.wide` |
| violent type jump | `scale: { base: '1rem', ratio: 1.414 }`, `3xl` hand-tuned to a `clamp()` |
| doesn't ease | `easings: { standard: 'steps(2, end)' }` |
| nothing glides | the drawer sheet fades rather than sliding (#83) — the four skins that slide do it in their own recipes |

It validated and compiled **clean on the first run** — no errors, no warnings,
all fifteen components.

The drawn state marks (#226) are the one place this skin is not its own
invention: the checkbox tick is **daisyUI's construction, retuned** — the same
six-point `clip-path` carve out of a `currentColor` slab, the same 45° rotation,
the same `translate: 0 -35%` that slides the indeterminate bar up. What is
brutalist about it is the mass (30%-wide arms against daisy's 20%) and the
timing (`steps(3, end)`, so the tick draws in three hard frames instead of
sliding). The lineage is cited in `recipes.ts` where the polygons are declared;
giving the mark a construction of its own — two axis-aligned slabs at a hard
90°, no rotation — is open as a follow-up.

The slider is an `appearance: none` rebuild (#221). A native range widget is
the one control the brief cannot reach — pill track, round handle, no border,
no shadow — and it sat directly above a progress bar that is square, inked and
offset-shadowed. Rebuilt from the vendor pseudo-elements it is the same two
slabs as everything else, and it steps with progress: `--slider-track-size` is
the channel, the same value `--progress-track-size` takes at every size, and
`--slider-thumb-size` derives the handle from it. The elapsed span is a
gradient over the runtime-published `--slider-percent`, and its direction is a
custom property the RTL selector rebinds, so the fill grows from the inline
start in both writing directions — and a vertical slider (#170) rebinds it
to `to top`, so the fill grows from the foot.

## What the run found

The skill listed `text` as a `system` category. It moved to
`system.typography.sizes`, and the compiler ignored the old spelling
*silently* — a generator following the skill would have produced a design
system with no type ramp and no clue why. The skill is corrected, and an
unknown key under `system` is now a validation error that names the right
path.

```ts
import '@sigx/zero-brutalist/css';
import { installThemes } from '@sigx/zero-brutalist';
installThemes();
```

## Countdown in a sentence, and one-sided timelines

`<Countdown.Root mods={{ inline: true }}>` sets a countdown inside running
text: it takes the sentence's size and weight and face instead of the display
step, and keeps its tabular digits, its ink and the per-tick entry (#57). A
Timeline whose content never sits on the start side collapses the start track
on its own — a `:has()` rule on the root, no prop — so the events sit against
the axis instead of past an empty half of each item.

## Avatar shape

`<Avatar.Root axes={{ shape: 'square' }}>` picks `circle`, `square` or
`rounded` (#129) — a custom axis this design system declares in
`tokens.axes` and wires on avatar alone, so the `/register` module types
`axes.shape` there and nowhere else. One declaration on the root, whose
`overflow: hidden` clips the image and the initials alike. Every radius token here is 0, so `rounded` is a fixed corner in proportion to the avatar — otherwise it would read as `square`, which is the un-attributed default.

## Rows wider than their column

A tabs list scrolls inside its own box when it is wider than its column
(#45), as Pagination, Stats and a horizontal Timeline do. It is padded by
`--tabs-ring-room` (the border-weight outline plus its 3px offset, which
also covers the hard shadow and the hover shove), with matching scroll
padding, so a focused tab's ring is never clipped at the row's edge.

## Per-stat colour

`<Stats.Item color="warning">` colours one figure's value while the Root's
`color` paints the rest of the row (#161); the recipe keys `--stats-accent`
on the item, which re-carries the colour axis. Measuring every role on the
value for the first time found the yellow `accent` and `warning` at 1.71:1
on light paper. The value now mixes each role 70/30 toward the page ink, as
the rating's fill does: `--color-base-content` flips with the scheme, so
one declaration deepens a role on paper and lightens it on ink. The yellow
roles now measure 4.25:1, above the 3:1 floor for the value's large text.

## Writing direction

Every direction-bearing rule is spelled logically, so the whole skin mirrors
under `dir="rtl"` (#277, #290). `inset-inline-*` and `margin-inline-*` where a
logical property exists; a direction-valued custom property the RTL selector
rebinds where one does not, since `transform` has no logical form. The kit warns
on the first kind (`validate-recipes`) and `e2e/rtl.spec.ts` measures the second
in a real engine — a logical anchor with a physical travel reads as correct and
still puts the control's thumb outside its own track.

The slider fill, the switch thumb and the toast accent bar were already here
(#229, #278) — that sweep's premise was that this was the one package that did
not flip, and it turned out four more did not either. What moved with them: the
toast viewport's start/end placements, the submenu chevron glyph, the collapsed
tree indicator and the indeterminate progress sweep.

## Forced colours

The switch slab is background paint, which forced colours revalue to `Canvas`.
The bordered track survived, but the slab inside it vanished, so on and off read
identically (#189). Under `forced-colors: active` the slab now opts out of
forcing and paints `CanvasText` at rest and `Highlight` when checked. A disabled
switch paints `GrayText`, the palette's own disabled ink.
`e2e/switch-forced-colors.spec.ts` measures it in pixels, in all six skins.

MIT © Andreas Ekdahl
