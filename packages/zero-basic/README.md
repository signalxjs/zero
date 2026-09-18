# @sigx/zero-basic

Neutral starter design system for [SignalX Zero](https://npmjs.com/package/@sigx/zero) —
readable defaults so a zero app looks sane on day one, and the reference
implementation for generating your own design system with `@sigx/zero-kit` —
its recipes are the baseline `pnpm create @sigx/zero-ds` lays under every
brief, fitted to that brief's vocabulary.

Its visual identity is **Monograph**: documentation-grade calm, engineered for
UIs people read all day.

- **Paper surfaces** — cool slate-tinted bases (hue 260), no pure white and no
  pure black anywhere; input wells are always windows of `base-100` cut into
  whatever surface they sit on.
- **Hairline structure** — depth is drawn with 1px `base-300` rules, not
  shadows. A card is a bordered region; the single honest `lg` shadow is
  reserved for transient overlays (in dark they sit on `base-200` and catch a
  moonlit inset edge instead).
- **Printed-ink petrol** — one protagonist hue, a petrol blue-black at hue 205
  (iron-gall document ink), carries every interactive signal; focus-visible is
  always the same 2px petrol ring, every role, every variant. Selected items
  wear a 2px margin marker over a soft wash rather than a solid fill.
- **Borders, not shadows; ink, not motion** — nothing moves on hover, pressed
  feedback is instantaneous ink density, overlays enter with a 4px rise and
  fade out with no travel. Meta-text is mono; numbers are tabular everywhere.
- **Marks are drawn ink, not typeset glyphs** — the checkbox tick and the
  rating star are geometry that interpolates, so a mark's weight is Monograph's
  and not the reader's font's, and it draws itself out of the corner rather than
  scaling up (nothing scales here). Under `forced-colors` and on paper the
  checkbox falls back to a `✔`/`−` glyph; the rating keeps its geometry, because
  no glyph can say "half". A `RatingGroup.Item` rendering its **own** symbol
  through the slot opts out of the drawn geometry and gets the colour treatment
  only — the slot hands you the state, so drawing your own half is yours to do.
- **A hairline that IS the mark is drawn in ink, not in `base-300`** — the
  structural grey is for rules between things that are each visible on their
  own. Where the hairline is the only thing separating a mark from its backdrop
  (the switch's paper knob on its track, the rating's unfilled remainder on the
  page) it takes the same 55% ink the placeholders do, and it is a `border`
  rather than an inset shadow, so `forced-colors` cannot strip it.

```ts
import '@sigx/zero/css';
import '@sigx/zero-basic/css';
import { installThemes } from '@sigx/zero-basic';
installThemes();   // registers the `basic` / `basic-dark` themes
```

Granular imports: `@sigx/zero-basic/css/tokens`, `@sigx/zero-basic/css/tabs`, ….

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
and the indeterminate progress sweep.

## Ecosystem adoption

zero-basic is also the reference **adopter** of an ecosystem component
(#304): it covers `@sigx/zero-ext-example`'s `ext-stepper` scope by spreading
its recipe pack and merging its manifest fragment (`mergeManifests`) — both in
`build.mjs`, and deliberately ONLY there. The ext-example package is private,
so it must stay out of the published module graph: `src/` never imports it,
the `designSystem` export stays zero-only (it is also the reference input for
the kit's golden and coverage suites), and adoption is pure build-time
composition. The shipped CSS, manifest, report and `register.d.ts` all carry
the ecosystem scope, the register in its `Exclude<…>` form.

MIT © Andreas Ekdahl
