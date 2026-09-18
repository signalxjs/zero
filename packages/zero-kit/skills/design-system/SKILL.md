---
name: design-system
description: Generate a complete SignalX Zero design system (tokens + recipes compiled to CSS) from a style brief — e.g. "brutalist", "glassmorphism", "corporate blue". Use when the user wants a new look-and-feel for a sigx app built on @sigx/zero.
---

# Generating a Zero design system

A Zero design system is **data**: a `TokensInput` (theme palettes on the
shared token contract) plus `RecipeInput`s (per-part styles against each
component's anatomy). No component code is ever written or changed.

## Workflow

1. **Read the anatomy manifest** — `node_modules/@sigx/zero/dist/manifest.json`
   (or https://signalxjs.github.io/zero/manifest.json). It lists every
   component's parts, their `data-state` values (as ready-made selectors),
   boolean flags, and token hints. Style ONLY what the manifest declares —
   where "the manifest" means zero's PLUS any ecosystem fragments the project
   merges (see "Ecosystem components" below): check the project for packages
   shipping a manifest fragment (`{ "package": …, "components": […] }`, or a
   `fragment` export) before deciding the component list is zero's built-ins.
   A part may also carry `hiddenIn`: the states in which zero's runtime sets
   the `hidden` attribute on it (`avatar.image` while `error`, `tabs.panel`
   while `inactive`). Those states never paint — don't style them, and don't
   worry about telling them apart from the visible ones. Zero enforces this
   from `@layer zero.structure`, which sits after `zero.recipes`, so a
   `display` you set on such a part is dead in those states rather than
   dangerous — it used to defeat the hiding entirely (#209).

2. **Scaffold the package.** Run the scaffold rather than copying a layout
   by hand — it lays down the whole package from nothing, with every
   component already styled:

   ```sh
   pnpm create @sigx/zero-ds <name> --brief <brutalist|glass|corporate|terminal|riso|seeded|basic>
   # npm create @sigx/zero-ds … / npx @sigx/create-zero-ds … work the same
   cd <name> && pnpm install && pnpm build
   ```

   Pick the brief nearest the style (see "The brief pack" below; `basic` is
   `@sigx/zero-basic`'s own tokens). What you get:

   ```
   <name>/
     package.json        # peerDependency + devDependency on @sigx/zero,
                         # devDependencies on @sigx/zero-kit, @sigx/cli, typescript
     tsconfig.json
     build.mjs           # runStandardBuild — validate → compile → report → writeArtifacts
     src/tokens.ts       # the brief's TokensInput (roles, system, themes)
     src/button.ts       # the brief's worked Button recipe
     src/baseline.ts     # @sigx/zero-basic's 50 recipes, copied whole — yours now
     src/recipes.ts      # [...fitRecipesToVocabulary(baseline, tokens) minus button, button]
     src/design-system.ts, src/index.ts
   ```

   `baseline.ts` is why the first build styles every component instead of one:
   it is zero-basic's recipes verbatim, and `recipes.ts` runs them through
   `fitRecipesToVocabulary` (from `@sigx/zero-kit/define`) so they compile
   under the brief's vocabulary — the identity for the recommended shape, and
   for a brief that declines the colour or size axis or fuses `variant`
   (riso) it drops the blocks those axes would have wired and redraws every
   undeclared role in `base-content` on `base-100`. That monochrome baseline
   is the honest starting point for a two-ink or no-colour-axis system; the
   brief's Button shows where the inks get spent. **Diverge from the baseline
   freely, and delete the fit call once every recipe speaks the design
   system's own vocabulary** — it is scaffolding, not architecture.
   `--baseline none` scaffolds the Button alone; `--targets web,lynx` adds the
   lynx target; `--dry-run` prints the plan.

   `src/index.ts` is the runtime half: it registers each theme so
   `themeController()` can switch between them. Hand your whole `tokens`
   object to `registerThemes` and it derives the rest — including the theme
   picker's swatch, which it reads from your own `tokens.swatch` (see step 3)
   so it matches your compiled `manifest.json`. Never hardcode role names
   here: a design system whose distinguishing colours aren't
   `primary`/`neutral` would render every theme identically in a picker.

   ```ts
   import { registerThemes } from '@sigx/zero';
   import { tokens } from './tokens.js';

   export { roles, tokens } from './tokens.js';
   export { recipes } from './recipes.js';
   export { designSystem } from './design-system.js';

   export function installThemes(): void {
       registerThemes(tokens);
   }
   ```

   Import from the kit **type-only** in `tokens.ts` and `recipes.ts`, except
   the `/define` subpath: those modules ship in the browser bundle, and the
   kit's barrel is Node-only. (`@sigx/zero` is the one other runtime import a
   design system makes.)

3. **Author tokens** (`src/tokens.ts`): one light + one dark theme minimum,
   paired via `pair`. **Declare the color vocabulary first**: `roles` names
   every color role the design language needs — use the recommended eight
   (`primary|secondary|accent|neutral|info|success|warning|error`, the
   default when `roles` is omitted) unless the brief demands otherwise, and
   add/rename/drop roles freely when it does (e.g. Material-style
   `surface: { content: false, soft: false }` tonal steps).

   **Then derive the themes, don't author them.** Name the hues that carry
   the brief and let the kit solve every other colour:
   ```ts
   import { deriveThemePair } from '@sigx/zero-kit/define';   // the ONE runtime kit import

   themes: {
       ...deriveThemePair<typeof roles, typeof system>({
           roles, seeds: { primary: 260, accent: 30 }, light: 'x', dark: 'x-dark',
       }),
   },
   ```
   `{ primary: 260 }` alone is enough: the semantic four take fixed hues,
   `secondary`/`accent` follow a `harmony` rotation, `neutral` is the
   primary hue desaturated, and the result carries **exactly**
   `requiredColorTokens(roles)` — base surfaces, every declared role, every
   `-content` — for a light and a dark theme already paired. What is
   guaranteed, measured on the emitted strings: every `<role>`/`-content`
   pair ≥ 4.5:1, `base-100`/`base-content` ≥ 7:1, everything inside sRGB,
   seeded hues preserved. A role the kit has no opinion about (`tertiary`)
   falls back to the primary hue — seed it. The `seeded` brief is the
   worked example; `derivePalette` does one scheme when the two differ.

   Hand-author a colour only when it is locked (the logo's exact blue): a
   full `RoleSeed` (`primary: { hue, chroma, lightness }`) keeps the value
   and still derives its `-content`; a literal written into the theme is
   measured by the validator, which reports the ratio when it misses.
   Every theme must define every declared role (+ its `-content` when
   declared) plus the fixed base surfaces `base-100/200/300/base-content`.
   Rules of thumb for the hand-authored parts:
   - `x-content` must contrast with `x` at ≥ 4.5:1 (the validator errors
     < 3:1 and warns below 4.5:1, and either way names the nearest passing
     value — `suggest x-content: oklch(…)`, same hue, lightness moved — so
     paste that rather than guessing).
   - oklch() everywhere; keep hue families consistent between light and dark.
   - `softMix` (0.08–0.2) controls the derived `-soft` tinted surfaces.
   - **Structural feel goes in `system`, declared once for the whole design
     system — not repeated per theme.** Categories today: `radius`
     (selector/field/box), `size` (selector/field), `spacing`, `shadow`,
     `motion`, `typography`, `border`, `disabledOpacity`. Brutalist ⇒ radius 0
     + thick border; soft/friendly ⇒ large radius.
     The `--text-*` ramp lives at `system.typography.sizes`, NOT `system.text`
     — an unknown key under `system` is ignored silently, so the ramp would
     simply never appear.
     ```ts
     export const system = {
         radius: { selector: '0', field: '0', box: '0' },
         border: '3px',
     } as const satisfies SystemTokens;

     export const tokens: TokensInput<typeof roles, typeof system> = {
         roles, system, defaultLight: 'brut', themes: { /* … */ },
     };
     ```
     Annotate with `TokensInput<typeof roles, typeof system>` — that is what
     narrows per-theme overrides to the keys you declared.
   - The keys inside a category are **yours**: `recommended` is what
     `@sigx/zero/css` ships fallbacks for, not a limit. Declare
     `radius: { pill: '9999px' }` and it flows into your manifest.
   - **Typography is the axis a style brief leans on hardest.**
     `typography` declares `fonts` (FAMILIES — `--font-sans` is a stack, never
     a size), `weights`, `leading`, `tracking`, and the `--text-*` size ramp.
     Give the ramp either as explicit `sizes` or as a modular `scale`:
     ```ts
     typography: {
         fonts: { sans: 'Inter, system-ui', mono: 'JetBrains Mono, monospace' },
         weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
         leading: { tight: 1.2, normal: 1.5 },
         tracking: { tight: '-0.01em', normal: '0em', wide: '0.05em' },
         scale: { base: '1rem', ratio: 1.25 },        // generates --text-*
         sizes: { '3xl': 'clamp(2rem, 5vw, 4rem)' },  // …one step hand-tuned
     }
     ```
     `sizes` wins per key, so a generated ramp with a hand-tuned display size
     is a normal thing to write. `ratio` is the whole personality: 1.125 is
     restrained, 1.5+ is dramatic. Weights and leading are **unitless** — the
     validator rejects `700px` and `1.5rem`, because CSS drops both silently.
     Fluid type belongs in `sizes` as a `clamp()`, not in the generator: the
     bounds are a design decision, not a ratio.
   - **Density and elevation are personality axes too.** `spacing` emits
     `--space-*` (padding, gap, margin) and `shadow` emits `--shadow-*`.
     Recipes reference them instead of literal rems and box-shadows, so the
     whole system can be tightened or flattened in one place. Airy ⇒ a wider
     ramp; brutalist ⇒ hard offset shadows (`4px 4px 0 0`) and often no blur.
     **Shadows usually need a dark counterpart** — one tuned for a white page
     is nearly invisible on a dark surface, so put the heavier ramp in
     `systemDark.shadow`. `light-dark()` cannot help here; it only takes
     colors.
   - **Motion is a personality axis — declare it, don't inline it.**
     `motion: { durations, easings }` emits `--duration-*` / `--ease-*`;
     recipes then write
     `transition: background var(--duration-fast) var(--ease-standard)`
     instead of magic numbers, and the whole system retunes in one place.
     Snappy ⇒ 100–150ms with a sharp curve; stately ⇒ 300ms+ and gentler.
     Durations must carry a unit — CSS silently ignores a bare `150`, and the
     validator errors on it.
     **Referencing `var(--duration-*)` is what makes a recipe respect
     `prefers-reduced-motion`**: the kit collapses every declared duration to
     ~0 in that mode. A hardcoded `0.2s` opts out of that, so don't.
     One exception: a *looping* animation (a spinner) should not take its
     duration from these tokens — collapsing it would spin absurdly fast
     rather than stop. Leave it literal until recipe conditions land.
   - Omitting a category entirely is fine — the fallbacks apply. Absence is
     never a validation error.
   - Values that must differ by color scheme go in `systemDark` (applies to
     every `colorScheme: 'dark'` theme); a single theme overrides via its own
     `system` block. Resolution order: `system` → `systemDark` →
     `theme.system`.
   - DS-specific tokens (a blur radius, a glow color…) go in `custom`
     declarations (name → `{ description, syntax? }`), valued per-theme in
     `custom` — never in `extra`, which the validator flags as undeclared.
     A custom token inside a category namespace (`--radius-…`) is an error;
     declare it in `system` instead.

4. **Author recipes** (`src/recipes.ts`): for each component in the manifest,
   a `RecipeInput` with `parts.<name>.base` styles and `parts.<name>.states`.
   State names resolve automatically: machine states (`open`, `checked`,
   `active`, …) → `[data-state]` selectors; flags (`disabled`, `focus-visible`)
   → `[data-*]`; `hover`/`focus-visible`/`active` (when not a machine state)
   → real pseudo-classes. Reference tokens with `var(--color-*)`,
   `var(--radius-*)` — never hardcode palette colors in recipes.
   Cover every declared state (empty `{}` marks intentional no-styling).
   Always style `focus-visible` visibly.
   A part may also declare **layout attributes** (`layout` in the manifest),
   rendered under the `data-l-` prefix from a vocabulary zero owns and closes
   — `gap`, `pad`, `align`, `justify`, `cols`, `span`, … Style them through
   `selectors` (`'&[data-l-gap="md"]': { gap: 'var(--space-md)' }`). Unlike a
   variant axis, this vocabulary is identical in every design system: you
   choose what `--space-md` *is*, not what `md` *means*, so a page laid out
   against one skin still holds under yours. The per-breakpoint spelling puts
   the breakpoint first (`&[data-l-md-gap="lg"]`) and belongs inside the
   matching `at` block.
   **Conditional styles go in `at`** — the same shape, recursively:
   ```ts
   popup: {
       base: { width: '100%', height: '100dvh', borderRadius: '0' },  // mobile first
       at: {
           sm: { base: { maxWidth: '32rem', borderRadius: 'var(--radius-box)' } },
           'reduced-motion': { base: { transition: 'none' } },
           '@starting-style': { states: { open: { opacity: '0' } } },
       },
   }
   ```
   A key is a breakpoint declared in `tokens.breakpoints` (emitted as
   `@media (min-width: …)`), a built-in (`reduced-motion`, `hover-none`,
   `prefers-dark`, `forced-colors`, `print`), or anything starting with `@`,
   used as a raw prelude. Anything else is a hard error listing what was available.
   - Author **mobile-first**: breakpoints are `min-width`, so `base` is the
     small-screen case. Declare them ascending — declaration order is emission
     order, and the validator enforces it.
   - `at` works inside `variants` too, so responsive variants need nothing new.
   - `prefers-dark` is the *system* preference, not your dark theme; it does
     not fire for `[data-theme="…-dark"]`.
   - A **looping** animation should be stopped under `reduced-motion`
     (`animation: 'none'`), never shortened — collapsing its duration makes it
     spin faster instead of settling.
   - **Animate presence in the recipe — presence needs no runtime helper.**
     Zero never unmounts a popup: it keeps the node mounted,
     toggles `data-state` and calls the native `showPopover()`/`showModal()`.
     So both directions are CSS:
     ```ts
     popup: {
         base: {
             opacity: '0',
             transform: 'translateY(-4px)',
             transition: 'opacity var(--duration-fast) var(--ease-standard), '
                 + 'transform var(--duration-fast) var(--ease-standard), '
                 + 'display var(--duration-fast) allow-discrete, '
                 + 'overlay var(--duration-fast) allow-discrete',
         },
         states: { open: { opacity: '1', transform: 'none' } },
         at: {
             'starting-style': { states: { open: { opacity: '0', transform: 'translateY(-4px)' } } },
             'reduced-motion': { base: { transition: 'none' } },
         },
     }
     ```
     `starting-style` is the state the entry animates FROM. The two
     `allow-discrete` entries are the **exit**: they keep the element rendered
     — and, via `overlay`, in the top layer — for the length of the
     transition. Leave them out and the entry animates while the close is
     instant, which the validator warns about because nothing else would tell
     you. (`overlay` is Chromium-only as of writing; elsewhere the exit
     degrades to instant.)
   - **Toast presence is runtime-managed — the one exception to the rule
     above. Do NOT use `@starting-style`/`allow-discrete` on toast parts.**
     Toasts must eventually unmount (popups never do), so zero drives their
     presence: a toast root mounts as `closed`, flips to `open` a frame
     later, and after `dismiss()` stays mounted as `closed` until its longest
     computed transition/animation finishes (instantly when there is none —
     reduced motion included, in every engine). Style the plain two-state
     transition and both directions work everywhere:
     ```ts
     root: {
         base: {
             opacity: '0',
             transform: 'translateY(8px)',
             transition: 'opacity var(--duration-normal) var(--ease-standard), '
                 + 'transform var(--duration-normal) var(--ease-standard)',
         },
         states: { open: { opacity: '1', transform: 'none' } },
         at: { 'reduced-motion': { base: { transition: 'none' }, states: { open: { transform: 'none' } } } },
     }
     ```
     The `viewport` is a `popover="manual"` top layer that zero shows while
     any toast is mounted. Override the UA popover defaults (`position:
     fixed`, `inset: auto`, `margin: 0`, `border`, `background`) and position
     it from `data-placement` (`top-start|top|top-end|bottom-start|bottom|
     bottom-end`, also mirrored on each root, so the enter direction can
     follow the edge). Gate any `display` you set behind `&:popover-open` —
     an unconditional one would defeat the UA's hiding of the closed
     popover. Stacked/offset effects key on the published `--toast-index` /
     `--toast-count` custom properties, the same contract idea as
     `--press-*`. The toast root also carries `data-color` per toast, so a
     `variants.color` block routing roles through a component token is the
     natural shape.
   - **A disclosure panel animates through `::details-content`.** Collapsible
     and Accordion are native `<details>`, so the height animation belongs on
     the browser's own wrapper, with `interpolate-size` making `auto` a legal
     endpoint. Set it on the element, not globally:
     ```ts
     root: {
         base: { interpolateSize: 'allow-keywords' },
         selectors: {
             '&::details-content': {
                 blockSize: '0',
                 overflow: 'hidden',
                 transition: 'block-size var(--duration-normal) var(--ease-standard), '
                     + 'content-visibility var(--duration-normal) allow-discrete',
             },
             '&[open]::details-content': { blockSize: 'auto' },
         },
     }
     ```
     Accordion's `<details>` is its `item` part, not `root`.
   - **…and the header still has to say it is open.** The panel expanding is
     the *browser* doing its job, not your design system saying anything, so
     `trigger: { states: { open: {}, closed: {} } }` on a collapsible or an
     accordion ships a header that is byte-identical either way — and a list of
     items that are all collapsed has no open one to compare against. The
     audit fails it (`state-legibility/disclosure`, `sigx zero:audit`): a
     `*trigger` part in a component with **no `popup` part** — collapsible, accordion, tree-view, i.e. the ones
     that disclose *in flow* — must differentiate its states on itself or on a
     sibling `*indicator`. Tree-view's rotating `branch-indicator` is the
     idiomatic answer; collapsible and accordion declare no indicator part, so
     the signal has nowhere to go but the header itself — a tint, an accent ink,
     an inset rule under it. If you have a reason for an in-flow trigger to say
     nothing, `skipStates: { trigger: ['open'] }` waives the rule — state the
     reason. Triggers of components that open an *overlay* (dialog, popover,
     tooltip, menu, select, combobox) are **outside the rule entirely**, not
     waived by it: the revealed thing floats above the page and takes focus, so
     whether the trigger also changes is your call and the guard never asks.
   - **Spell direction logically. It is a correctness rule, not a style.**
     `inset-inline-start` / `margin-inline-*` / `padding-inline-*` /
     `border-inline-*`, never `left` / `right` / `margin-left` / `border-left`.
     A physical property compiles and renders; it is simply the *same* side in
     both writing directions, so under `dir="rtl"` one rule stays put while
     everything around it mirrors. `validate-recipes` warns on every physical
     property that has a logical twin, so you will be told.
     - **Symmetric pairs are exempt and stay physical.** `left: 50%` with a
       `translateX(-50%)` is centring, not a side; a logical inset there would
       decentre it. So is a value the runtime measures physically —
       `left: var(--press-x)` is a pixel offset from the element's own left
       edge.
     - **A rotated part is drawing, not positioning.** Once a box is rotated,
       its `border-left` is a *stroke of a glyph* rather than an edge of a box,
       and mirroring it would mirror the drawing. A check mark is not mirrored
       in RTL. The lint exempts any part that declares a rotation.
     - **The lynx target is the inverse: physical only.** Lynx has no RTL
       flow, and its Android engine does not resolve the logical
       inset/margin/padding spellings or the standalone
       `translate`/`rotate`/`scale` properties at all (iOS does — measured,
       signalxjs/lynx#1084), so the lynx emitter refuses them with a report
       entry. A recipe whose geometry rides a logical spelling restates it
       physically (`top`/`left`/`margin-left`/`transform: translate…()`) in
       its `targets.lynx` section.
     - **`transform` has no logical form**, so it needs a shape rather than a
       rename: put the sign in a custom property and rebind it. This is the one
       case the lint cannot see, so it is on you.
       ```ts
       thumb: {
           base: { insetInlineStart: 'var(--switch-pad)', '--switch-thumb-dir': '1' },
           states: { checked: { transform: 'translateX(calc(var(--switch-thumb-dir) * 2rem))' } },
           selectors: { [`&${rtl}`]: { '--switch-thumb-dir': '-1' } },
       }
       ```
       Half of this is worse than neither half: a logical anchor with a physical
       travel starts the thumb at the reading end and then moves it further that
       way, off the track. The same applies inside `@keyframes` — a custom
       property in a keyframe resolves against the animated element, so the
       multiplier works there too.
     - **Write the RTL selector the forgiving way**, as a const beside your
       other helpers:
       ```ts
       const rtl = ':where(:dir(rtl), [dir="rtl"], [dir="rtl"] *)';
       ```
       `:where()` is forgiving, so an engine without `:dir()` drops that one
       argument and still matches the attribute forms. It also contributes no
       specificity, so the rule ties with the one it corrects and wins on source
       order — **declare it after, not before**.
     - **A glyph that points is direction-bearing too.** `›` points right in
       every writing direction. Swap it under RTL when it comes from `content:`
       (`'"\2039"'`); mirror the part with `scale: '-1 1'` when the glyph is
       element text the runtime renders and CSS cannot replace it. `scale`
       composes outside `transform`, so a chevron that rotates to open keeps
       rotating correctly.
   - **A state indicator is DRAWN GEOMETRY, and it must look different in
     every state it declares.** An `indicator` part — checkbox's tick, radio's
     dot, a rating symbol, select's checkmark — exists for exactly one reason:
     to say which state the thing is in. Three rules, and the first two are
     enforced by the audit (`state-legibility/component` and
     `state-legibility/indicator`, `sigx zero:audit`):
     1. **Every pair of a part's declared states must render differently.**
        Declaring `states` and styling them alike is the one bug the anatomy
        cannot catch for you: `full` and `half` both setting `color:
        var(--rating-fill)` draws a half rating as a full one. The guard reads
        the *compiled* CSS, so the difference may live anywhere — `states`,
        `selectors`, a variant, a pseudo-element — but it must exist **in the
        default render**: a difference that only appears inside `@media`
        (the `forced-colors`/`print` glyph fallback of rule 3, a breakpoint,
        `hover: none`) does not count, and neither does one made only of
        `transition`/`will-change`, which changes how a state arrives and not
        how it looks. The only opt-out you author is `skipStates`; it is read
        **per part** (skipping `checked` on `item-label` will not excuse
        `item-indicator`) and it is a design claim, so comment it. The manifest
        supplies a second one for free: a state in a part's `hiddenIn` paints
        nothing at all, so the guard never asks you to differentiate it — that
        is why avatar's three states may be styled identically everywhere.
     2. **Draw the mark, don't typeset it.** `content: "✓"` hands the mark's
        weight to whatever font the reader has, cannot express a fraction, and
        cannot animate. `clip-path` on a `currentColor` slab, two borders of a
        rotated box, or a masked gradient all scale with the size token and
        *interpolate* — so the mark draws itself. If you paint by masking or
        clipping the runtime's own default symbol instead of drawing your own
        shape, you inherit its font coverage: rating's defaults are `★`/`☆`
        (U+2605/U+2606) and its `half` is a **full** star you are expected to
        halve, because the half-star codepoint (U+2BEA) is poorly covered in
        the common system sans stacks and renders as tofu.
        ```ts
        indicator: {
            base: {
                background: 'currentColor',
                clipPath: 'polygon(20% 100%, 20% 80%, 50% 80%, 50% 80%, 70% 80%, 70% 100%)',
                transition: 'clip-path var(--duration-normal) var(--ease-standard)',
            },
            states: {
                // Same point COUNT and order in every state, or the browser
                // has nothing to interpolate and the mark pops.
                checked: { clipPath: 'polygon(20% 100%, 20% 80%, 50% 80%, 50% 0%, 70% 0%, 70% 100%)' },
                unchecked: { opacity: '0' },
            },
        }
        ```
        Grow it from a degenerate form of *itself* (an arm of zero length, full
        thickness), not from `scale(0)` — the latter animates the stroke weight
        too. Every length a percentage of the control, so one declaration rides
        the whole size ramp.
     3. **Geometry painted with `background` disappears in two media** —
        `forced-colors` (author paint is revalued) and `print` (backgrounds are
        dropped). Give the mark a glyph fallback in both, keyed by the named
        conditions: `at: { 'forced-colors': fallback, print: fallback }`, where
        the fallback sets `clip-path: none` and hangs `content: "\2714"` off
        `::after` in `CanvasText`. The exception is a mark whose state is a
        *fraction* — a half rating — which no glyph can say: keep the geometry
        and re-source the paint instead (`background: CanvasText` under forced
        colors, `print-color-adjust: exact` on paper).
   - **Press feedback: the runtime publishes the press, the recipe styles
     it.** CSS can see `:active` but not *where* a press landed, so on parts
     whose anatomy declares the `pressed` flag zero writes the data below.
     Publishing parts: button root; tabs tab; dialog/popover trigger+close;
     menu trigger+item+sub-trigger; combobox trigger+item; select
     trigger+item (select and combobox items are pointer-only —
     keyboard selection stays on the trigger via aria-activedescendant, so
     item ripples fire for pointer presses only); toast action+close;
     collapsible/accordion trigger;
     switch/checkbox `control` and radio-group `item-control` (the press
     lands anywhere in the label row, the feedback on the control); slider's
     `control` (`data-pressed` only — a drag has no one-shot). Lifecycle: a
     press ends when the gesture ends — uncaptured pointerleave cancels it,
     a captured pointer (touch) holds it until release, and drag surfaces
     listen for the release at the window instead of ending on leave.
     - `data-pressed` — present while the pointer/key is physically down.
       Key non-animated press effects on this (a tint, a scale, an offset).
     - `data-press-animating` — present from press-start until the part's CSS
       animation finishes, **not** until release, so a quick tap plays a
       one-shot effect (a ripple) to completion. The runtime clears it when
       that animation ends, however it ends — finished, cancelled, or
       destroyed with the stylesheet that declared it — so a design-system
       swap mid-ripple leaves nothing stranded. Put the whole effect in ONE
       keyframe animation whose
       duration is `var(--duration-*)`; a rule on this flag that starts no
       animation is dead (the validator warns).
     - `--press-x` / `--press-y` — the press point in px relative to the
       part; keyboard presses (Enter/Space) get the box center.
     - `--press-r` — distance to the farthest corner, so a covering circle
       is `calc(var(--press-r) * 2)` wide without trigonometry.
     Material's ink ripple as a recipe (needs `position: relative` +
     `overflow: hidden` on the part):
     ```ts
     selectors: {
         '&::before': {   // held state layer — also the reduced-motion fallback
             content: '""', position: 'absolute', inset: '0', opacity: '0',
             background: 'var(--btn-ripple)', pointerEvents: 'none',
             transition: 'opacity var(--duration-fast) var(--ease-standard)',
         },
         '&[data-pressed]::before': { opacity: '0.12' },
         '&::after': {    // the ripple, anchored to the press point
             content: '""', position: 'absolute',
             left: 'var(--press-x, 50%)', top: 'var(--press-y, 50%)',
             width: 'calc(var(--press-r, 0px) * 2)', height: 'calc(var(--press-r, 0px) * 2)',
             borderRadius: '50%', background: 'var(--btn-ripple)',
             transform: 'translate(-50%, -50%) scale(0)', opacity: '0', pointerEvents: 'none',
         },
         '&[data-press-animating]::after': {
             animation: 'btn-ripple var(--duration-slow) var(--ease-standard)',
         },
     },
     keyframes: { 'btn-ripple': 'from { … scale(0); opacity: 0.12; } to { … scale(1); opacity: 0; }' },
     ```
     Reduced motion needs nothing extra — token durations collapse, the
     animation ends immediately, and the `data-pressed` tint remains as the
     non-motion feedback. Hide decorative press layers under
     `forced-colors`. The same hooks express non-Material ideas: a brutalist
     stamp (`[data-pressed] { translate: 2px 2px }`), a scale-press, a
     spotlight at `--press-x/y`.
     **The unbounded variant** (MD3 selection controls): a fixed circle
     centered on the part — same two pseudos, but `left/top: 50%`, a fixed
     `width/height` (e.g. `calc(var(--size-selector) * 15)` for a 2.5×
     halo), coordinates ignored, and NO `overflow: hidden` so the halo
     extends past the box.
     **Two lifecycle constraints worth knowing:**
     - A one-shot animation must target the FLAGGED element (or its own
       pseudo-elements). The runtime clears `data-press-animating` unless a
       CSS animation targets that element, and its `animationend` listener
       ignores events from descendants — so a ripple on a *child's* pseudo
       silently never plays. Material's switch routes around this: the held
       layer lives on the thumb's `::before`, lit from the control's flag via
       a descendant selector (`'&[data-pressed] [data-part="thumb"]::before'`),
       with no one-shot at all.
     - A native slider needs a custom skin before press feedback can
       render in Blink: it ignores thumb-pseudo styling on a native
       (`appearance: auto`) range input, so a halo written against
       `::-webkit-slider-thumb` silently never paints there (Gecko honours
       `::-moz-range-thumb` either way — skin it anyway, for one look). Skin
       the `control` part (`appearance: 'none'`, own track and thumb
       pseudos), then set ONE
       custom property from the states and read it in each vendor thumb
       pseudo — the pseudos cannot share a selector list (one unknown
       selector invalidates the whole rule), and the variable defines the
       halo once per engine instead of once per state per engine:
       ```ts
       base: { appearance: 'none', outline: 'none', '--slider-halo': 'transparent' },
       states: {
           'focus-visible': { '--slider-halo': 'color-mix(in oklab, var(--color-primary) 10%, transparent)' },
           pressed: { '--slider-halo': 'color-mix(in oklab, var(--color-primary) 12%, transparent)' },
       },
       selectors: {
           '&::-webkit-slider-thumb': { appearance: 'none', /* size, radius, background, */ boxShadow: '0 0 0 calc(var(--size-selector) * 2.5) var(--slider-halo)' },
           '&::-moz-range-thumb': { /* same, separate key */ },
       },
       ```
       Chrome treats range inputs as ALWAYS `:focus-visible` — even on
       mouse focus — so an input-box outline reads as a stuck rectangle on
       press; the halo must BE the focus indicator. Fill the track with the
       runtime-published `--slider-percent` as a gradient stop, and revert
       to `appearance: 'auto'` under `forced-colors` (native rendering
       knows forced colors better than a custom skin).
   - `RecipeInput.css` takes raw CSS for anything the typed surface can't say.
   - **Style Button first, and make its axes compose.** It is the component a
     design system is judged on, and the only one where all three axes matter
     at once. Do NOT write a rule per `color` × `variant` — eight roles by
     four fills is thirty-two rule sets before sizes. Route the colour through
     component tokens the fill rules read:
     ```ts
     tokens: { '--btn-accent': 'var(--color-primary)', '--btn-on-accent': '…' },
     variants: {
         color:   { success: { root: { base: { '--btn-accent': 'var(--color-success)', … } } } },
         variant: { solid: { root: { base: { background: 'var(--btn-accent)' } } } },
         size:    { lg: { root: { base: { padding: 'var(--space-md) var(--space-xl)' } } } },
     },
     defaultVariants: { color: 'primary', variant: 'solid', size: 'md' },
     ```
     Adding a ninth role then costs one rule instead of four.
   - **Derive the colour axis from `roles`; never retype the list.** A role
     declared in `tokens.ts` but missing from a recipe's `color` axis renders
     as the default colour — the variant reads as broken rather than as one
     role being unwired, and nothing in the type system notices. Import
     `roles` as a value and filter it:
     ```ts
     import { roles } from './tokens.js';

     // Roles opting out of `-content` or `-soft` are fills and hairlines
     // (Material's `surface*`, `outline`) — not something a button can be.
     const ROLES = Object.entries(roles as Record<string, RoleDecl>)
         .filter(([, decl]) => decl.content !== false && decl.soft !== false)
         .map(([name]) => name);
     ```
     Wire the SAME set on every component that has a colour axis. The
     validator errors on a colour value that names no declared role, and warns
     when one component wires fewer roles than its siblings — holding a role
     back everywhere on purpose is fine and says nothing.
   - **The `size` axis is your vocabulary too.** `xs|sm|md|lg|xl` is the
     recommended ramp, not a fixed one. Whatever the ramp is, wire ALL of it
     on Button — the scaffold's baseline paints every step on every sibling,
     so a Button that wires `sm|md|lg` over it leaves `xs` and `xl` as steps
     the design system has and Button neither paints nor claims, and
     `sigx zero:audit` refuses that hole (`axis-value-coverage/gap`, #422). If the brief calls for density steps
     or a numbered ramp, declare it and use it — `<Button.Root size="…">`
     accepts any name, and the validator checks recipes against what you
     declared rather than against xs–xl:
     ```ts
     // src/tokens.ts
     export const tokens: TokensInput<typeof roles, typeof system> = {
         roles, system,
         sizes: ['compact', 'comfortable', 'spacious'],   // or [...SIZE_SCALE_LIST, '2xl']
         defaultLight: '…', themes: { /* … */ },
     };
     ```
     Declare it even when you keep the recommended ramp verbatim only if you
     want it stated in the manifest; omitting `sizes` already means xs–xl.
     Note `sizes` is the `data-size` axis — unrelated to `system.size`
     (`--size-*`, the control-sizing unit) and to `system.typography.sizes`
     (the `--text-*` ramp).
   - **An axis you don't have, declare out of existence.** `sizes: []` means
     "this design system has no size axis"; `roles: {}` means the same about
     colour. **Empty is not the same statement as absent** — omitting the key
     means "I didn't say", and takes the recommended vocabulary. Declaring it
     empty means "there isn't one", and that reaches the manifest, the
     coverage report and the generated types, where `size` / `color` becomes
     `never` rather than a prop that is offered and then matches nothing.
     `variants: []` makes the same claim about the variant axis — a design
     system with one treatment per component has no `variant` to offer, and
     saying so beats declaring `solid|outline|soft|ghost` and wiring one.
     Note the spellings differ because the declarations do: `roles` is a
     map, `sizes` and `variants` are lists.
     ```ts
     roles: {},        // no `color` axis — the palette lives in `custom`
     sizes: [],        // no `size` axis — one set of metrics, deliberately
     variants: [],     // no `variant` axis — one treatment, deliberately
     ```
     Reach for this whenever the brief's colour story isn't "eight
     interchangeable semantic roles". A design system with one accent, or with
     colour folded into `variant`, genuinely has no colour axis, and saying so
     is better than declaring eight roles and wiring two. `@sigx/zero-heroui`
     and `@sigx/zero-carbon` both declare `roles: {}` with their palette as
     declared `custom` tokens — themed and validated like any other token, just
     not passable as `color="…"`. The `riso` brief shows both opt-outs at once.
   - **Every declared value is a promise — honour it in every scope that
     takes the axis, and write the un-attributed step down.** A step you
     declare and do not wire renders as the *base*, so a ramp with a hole in
     it goes BACKWARDS: zero-carbon declared five sizes and shipped `xl`/`2xl`
     on `button` only, and every other control got smaller at `xl` than at
     `lg` (avatar 48 → 40px, checkbox 22 → 18). Nothing failed, because the
     step was declared, not misspelled. The audit now asks
     (`axis-value-coverage/gap` and `/ambiguous-base`, `sigx zero:audit`),
     and it reads the *compiled* CSS, so the rule may come from `variants`,
     a `compoundVariants` match or the raw `css` escape hatch:
     1. **A scope that wires an axis at all must account for every value the
        design system implements anywhere.** Wiring `sm` and `lg` and stopping
        is the failure — `button` shipping `xl` is what makes `xl` a step this
        design system *has*, and every sibling that takes `size` owes it one.
        A scope that wires **no** value of an axis is outside the rule (a
        dialog takes no size); whether it ought to wire one is
        `axis-coverage.test.ts`'s question.
     2. **Write the middle step as an empty entry.** `md: {}` is not noise —
        it is how you say "the base already IS `md`", which is why a step that
        emits no rule is not a hole. Restating the base's values there instead
        would be a second copy free to drift. Put it wherever your base
        actually sits: zero-carbon's button writes `lg: {}`, because Carbon's
        default button is the 48px one.
        ```ts
        size: {
            sm: { root: { base: { minHeight: 'var(--size-8)' } } },
            md: {},                                              // the base IS md
            lg: { root: { base: { minHeight: 'var(--size-12)' } } },
        },
        ```
        `defaultVariants: { size: 'md' }` does **not** count as saying it —
        that field applies CSS defaults, and accepting it would let a step you
        simply forgot be excused by a line written for another purpose.
     3. **Exactly one value per scope may claim the base.** Two empty entries
        render identically, so "fixing" a missing `xl` by writing `xl: {}`
        fails too — and rightly: `xl` would still paint as `md`. An entry
        whose only rule sits inside `at: { … }` does not claim the base
        either; at the default viewport it silently renders as one.
     4. **A value NOTHING in the design system wires is reported once, for the
        whole system.** Usually it means you declared a vocabulary wider than
        the one you built — narrow the declaration, wire the step, or say the
        vocabulary belongs to one scope in `tokens.scopes`. The one
        exemption is colour: a role declared `content: false` or `soft: false`
        is a fill or a hairline (Material's `surface*`, `outline`), which is a
        token and not something a control can be, so it is never expected on
        the `color` axis.
   - **Declare the `variant` axis and any custom axes** (`tokens.variants` /
     `tokens.axes`) with the values your recipes key on — declaring closes
     the set, so a recipe typo is a build error instead of a silently minted
     value, and the vocabulary reaches the manifest and the generated types:
     ```ts
     variants: ['solid', 'outline', 'soft', 'ghost'],
     axes: { density: ['compact', 'comfortable'] },
     ```
   - **`solid | outline | soft | ghost` is a convention, not the contract.**
     Four of the six in-repo design systems declare exactly that set, which
     makes it look load-bearing. Nothing requires it, and copying it into a
     brief that doesn't mean it is the most common way to get a design system
     that reads as generic. **The `variant` vocabulary is yours.**
     It does not even have to be orthogonal to colour. HeroUI v3 has no `color`
     prop at all and fuses colour into a seven-member `variant`, where
     `danger-soft` is a **single value** rather than a `danger` × `soft`
     crossing:
     ```ts
     // packages/zero-heroui/src/tokens.ts — a fused vocabulary
     roles: {},   // no colour axis to be orthogonal TO
     variants: ['primary', 'secondary', 'tertiary', 'outline', 'ghost', 'danger', 'danger-soft'],
     ```
     Carbon does the same under the name `kind`. Both are real packages here, so
     read them when the brief's axis surface isn't the default one. If the
     brief's colours and treatments genuinely are independent, keep them on two
     axes — the point is to decide, not to inherit. And the set you declare is
     usually a *button's*: see the next bullet before pooling every component's
     variants into one flat list.
   - **A vocabulary may belong to one scope** (`tokens.scopes`). Real design
     systems do not give every component the same variants: Radix Themes varies
     a select as `classic | surface | soft` and a button as something else
     entirely. Declare the **union** at `tokens.variants` and say which part of
     it each scope offers:
     ```ts
     variants: ['solid', 'outline', 'classic', 'surface', 'soft'],   // the UNION
     scopes: {
         button: { variants: ['solid', 'outline'] },
         select: { variants: ['classic', 'surface', 'soft'] },
     },
     ```
     Every axis works this way — `colors`, `sizes`, `variants`, `axes`,
     `modifiers` — and a scope never widens, only narrows. An **absent** key
     means the scope offers the whole union — but once ANY scope narrows an
     axis, every sibling that actually *paints* that axis should declare too,
     and the validator warns until they do. Restating the union is not
     redundancy: it is the explicit claim "yes, this one carries all of it",
     which is the answer the first narrowing puts in question. Scopes that
     wire nothing for the axis are not asked; an **empty list** is the claim
     "this scope has no such axis at all" (`variants: []`), the same grammar
     `sizes: []` uses design-system-wide.
     Two things to know before using it. Restricting one scope while a styled
     sibling stays open is warned about, because the sibling really is still
     offering values declared for someone else — restrict both, and restating
     the whole union for a scope is a legitimate, un-warned way to say "yes,
     this one carries all of it". And a value in the union that no scope
     claims is a warning of its own: give it to a scope, or drop it.
   - **Presence-only styling is a `modifier`, not a one-member axis.** Some
     things a control *is* have no vocabulary: it is icon-only or it isn't,
     pending or not. Declaring `axes: { block: ['block'] }` to express that is
     the encoding modifiers replaced — it mints a value whose only job is to
     be present.
     ```ts
     // tokens.ts — declared design-system-wide, like any vocabulary
     modifiers: ['icon-only', 'pending'],
     ```
     ```ts
     // recipes.ts — keyed by name, no value layer
     modifiers: {
         'icon-only': { root: { base: { padding: 'var(--space-sm)', aspectRatio: '1' } } },
         pending:     { root: { base: { cursor: 'progress', opacity: '0.8' } } },
     },
     ```
     They emit as `[data-mod-<name>]` and consumers pass them as
     `mods={{ 'icon-only': true }}`. The `data-mod-*` prefix keeps them
     disjoint from zero's closed flag vocabulary by construction, so a
     modifier called `disabled` or `selected` can never collide with the
     runtime's own attribute — which is why modifiers are prefixed and axes
     are not.
   - **`compoundVariants` is for the rule that no single declaration can
     state** — where a *combination* needs something neither member implies. A
     `match` is a plain object; a value of `true` names a **modifier** rather
     than an axis value:
     ```ts
     compoundVariants: [{
         // A ghost control has no fill, so `overprint` alone would do nothing.
         match: { variant: 'ghost', overprint: true },
         parts: { root: { base: { background: 'var(--riso-tint)' } } },
     }],
     ```
     `match` is checked against `defaultVariants` too, so an entry matching
     `{ variant: 'solid' }` fires on an element carrying no `data-variant` at
     all when `solid` is the default. Don't reach for it to avoid the
     component-token pattern above — routing colour through `--btn-accent`
     handles the colour × variant cross product in a handful of rules, where
     compounds would need one entry per pair.
   - **You are not limited to three axes.** `color`, `size` and `variant` have
     named props because almost every design language has them. If the brief
     needs another — density, emphasis, tone, elevation — declare it in
     `tokens.axes`, key `variants` on it, and consumers reach it through
     zero's `axes` prop:
     ```ts
     variants: { density: { compact: { root: { base: { paddingBlock: 'var(--space-2xs)' } } } } },
     ```
     **This is also the answer when one component wants two vocabularies.**
     Radix's Select varies its Trigger as `classic | surface | soft | ghost`
     and its Content as `solid | soft`. That is not one axis restricted twice —
     zero puts one attribute per axis on the scope's carrier part and cascades
     it to every part below, so a second vocabulary is a second **axis**:
     ```ts
     axes: { 'content-variant': ['solid', 'soft'] },      // tokens.ts
     variants: { 'content-variant': { soft: { popup: { base: { … } }, item: { … } } } },
     ```
     which compiles to
     `[data-part="root"][data-content-variant="soft"] [data-part="popup"]` and
     reaches the popup, because zero has no portals. Don't look for a per-part
     restriction in `tokens.scopes`; there isn't one, and `parts` is rejected
     by name to keep it that way (docs/architecture.md, "Declared vocabulary").
   - **`dist/register.d.ts` is generated, never authored.** `writeArtifacts`
     emits it (with `dist/register.js`) from the compiled system: it augments
     `@sigx/zero`'s `ZeroVocabulary`, so an app that adds
     `import '@sigx/<your-ds>/register'` gets your themes, tokens and
     per-component axis values as types. The scaffold already wrote the
     `"./register"` entry into your `package.json` `exports`; never edit the
     emitted file.
     ```tsx
     <Button.Root color="primary" axes={{ density: 'compact' }}>Save</Button.Root>
     ```
     An axis name must be kebab-case and may NOT be one the anatomy contract
     owns (`scope`, `part`, `state`, `orientation`, or any flag such as
     `disabled` / `selected`; the layout family is namespaced `data-l-`, so
     `gap`, `align`, `track` and the rest stay AVAILABLE as axis names) — the validator errors and zero refuses to render
     it, because shadowing `data-state` would silently repoint every
     `[data-state="open"]` rule you wrote. An axis **value** takes a wider
     grammar than a name: lowercase letters, digits and hyphens, repeated
     hyphens included — so a vendor spelling like Carbon's `danger--tertiary`
     is a legal declared value, not something to remap. What stays out is what
     a lynx class name (`zx-a-kind-danger--tertiary`) cannot carry verbatim:
     `%`, `.`, quotes, whitespace, uppercase. A value the grammar refuses
     (Radix's `105%`) is what the `api.values` remap exists for.

5. **Assemble** (`src/design-system.ts`): `{ name, tokens, recipes }` exported
   as `designSystem`.

6. **Validate and iterate**: `sigx zero:validate` (after building the TS), or
   programmatically `validateDesignSystem(ds, manifest)`. Fix every error and
   drive warnings to zero unless deliberate. This loop is the point: generate
   → validate → audit → fix → repeat.

   **Then run `sigx zero:validate --report`.** Validation answers "is anything
   wrong?"; the report answers "did I build what I said I would?" — the
   question a generated design system most often gets wrong, because nothing
   about it is an error. (`--report-json <path>` for the machine-readable
   form, `-` for stdout; `zero:build` also writes `dist/report.json` every
   time.) Read four things:
   - **`declared out of existence`** — the axes you opted out of with
     `roles: {}` / `sizes: []` / `variants: []`. If an axis you meant to ship is on this list,
     you declared it empty by accident; if one you don't have is missing from
     it, you left the recommended vocabulary in place by omission.
   - **`wired by nothing`** — a value the whole design system declares and no
     scope implements. Almost always a vocabulary wider than the thing you
     built: narrow the declaration, wire the step, or give the value to the
     scope it belongs to (`tokens.scopes`). Colour roles that opt out of
     `-content`/`-soft` are exempt, being fills rather than variants.
   - **`in no scope's vocabulary`** — you declared per-scope vocabularies and
     the union carries a value none of them claims. Different from the above:
     nothing is missing a rule, the declaration is simply carrying a word
     nobody asked for.
   - **per-scope axis status** — which components wire which axes, and where a
     scope declared its own vocabulary, what it `offered` beside what it
     wired. A scope that takes an axis and wires none of it is the gap
     `axis-coverage` asks about; one that wires *some* values is the
     ramp-with-a-hole above. A scope listed under `diverges across components`
     with `(declared)` beside it is not diverging — it narrowed on purpose.
   - **After each fix, run `sigx zero:validate --report --diff dist/report.json`**
     and read what moved: the score line, then anything newly unstyled,
     unwired, uncovered or below a contrast threshold. `zero:build` rewrites
     `dist/report.json`, so the comparison is always against your last build.
     A state you put in `skipStates` shows as *newly skipped*, not resolved.
   - **Keep an iteration log.** Before the first `zero:validate`, run
     `export ZERO_ITERATION_LOG=.zero-iterations.jsonl` (the scaffold already
     gitignores that name; add it yourself otherwise). Every run then prints
     one trend line — `iteration 7 — errors 0 (was 3), warnings 3 (was 14),
     score 92 → A (was 71 C); top: contrast-floor ×2` — and appends it to the
     file. Read it each run: the counts must fall, and `top` names the rule
     to fix next. Stop when errors are 0, every remaining warning is
     deliberate, and the grade is B or better. Nothing leaves the machine.

   **Then run `sigx zero:audit`.** Validation asks "is it correct?", the
   report asks "did I build what I said?", and the audit asks the third
   question — "does what I built *say* what it claims?" — by reading the
   compiled CSS: a state you declared that no part renders differently, an
   indicator that draws nothing, a real `<button>` the user agent still
   paints, a declared step a sibling scope honours and this one does not, a
   loop that never stops under reduced motion. These are the checks this
   repo's own CI ran on its six skins; `zero:audit` is how a design system
   built anywhere else runs them (the full list is under "What `audit` will
   catch" below). Read it errors first — every finding names its fix — and
   what it lists under `waived` is what a `skipStates`, `hiddenIn` or
   `tokens.scopes` declaration excused, so an excuse you did not mean is
   visible too. Error findings fail the command (`--strict` fails on
   warnings as well; `info` never fails); `--rule <id>` runs one rule;
   `--json <path>` (or `-`) writes the same artifact `zero:build` emits as
   `dist/audit.json`. The audit's counts also sit in the report under
   `audit` and feed the score's sixth criterion, so the grade already
   reflects it — the build never *fails* on a finding, which is the point:
   a design system mid-iteration must be able to read its own audit and
   still get artifacts to look at.

7. **Build**: `sigx zero:build` (or the package's `build.mjs`) emits
   `dist/css/index.css` + per-component files, plus `dist/report.json` and
   `dist/audit.json`. The app consumes it with two lines:
   `import '<pkg>/css'` and `installThemes()`.

## Ecosystem components (merged manifest fragments)

A project may use components zero doesn't ship — peer packages built on
zero's public authoring surface, each publishing a **manifest fragment**
(`{ "package": "<specifier>", "components": [anatomy.toJSON()] }`, JSON
Schema `fragment.schema.json`). A design system that should cover them
**merges** the fragment rather than replacing the manifest:

- CLI: `sigx zero:validate --extra-manifest <path|specifier>` (repeatable),
  same flag on `zero:build`.
- Programmatic (`build.mjs`): `mergeManifests(zeroManifest, fragment)` from
  `@sigx/zero-kit`. If the ecosystem package is private, do the adoption in
  `build.mjs` only — never import it from the package's `src/`, or the
  published module graph breaks.

Once merged, the scope is ordinary: write a `RecipeInput` for it like any
component, or adopt the package's **recipe pack** (a `recipes` export written
against the recommended token grammar) by spreading it into `recipes` — but
only when this design system keeps the recommended role names; a fused or
renamed vocabulary needs a hand-written recipe. The merge hard-errors on
scope collisions, provenance is stamped per component, and the generated
`register.d.ts` excludes merged scopes by name from its ZeroScope gate — all
automatic. A design system that deliberately does NOT cover an ecosystem
component simply never merges its fragment: the component renders unstyled
but accessible, which is the contract's baseline, not a failure.

The reference pair: `@sigx/zero-ext-example` (the fragment + pack) and
`@sigx/zero-basic`'s `build.mjs` (the adoption).

## What `validate` will catch

Content is checked, not just structure. These are errors:

- a `var(--…)` this design system never declares — it resolves to nothing.
  The message suggests the nearest declared name.
- a role/`-content` pair (or a base surface against `base-content`) below
  3:1. The message ends with the nearest passing value at 4.5:1 (`suggest
  primary-content: oklch(…)`), and the same fix rides the issue as
  `suggest: { token, value }` for tooling; 3–4.5:1 is the warning form of
  the same rule.
- a declaration key that is not a CSS property but is within two edits of
  one — `paddding`, `borderRadus` — with the property you meant. The browser
  drops such a declaration silently, so nothing else would ever tell you.
  Keyframes bodies are read too. Custom properties (`--x`) and
  vendor-prefixed spellings (`WebkitAppearance`, `MsOverflowStyle` — capital
  first, so the emitted name opens with the hyphen; `msOverflowStyle` emits
  `ms-overflow-style`, which nothing reads, and is an error) are never
  questioned, keys
  under four characters only ever warn (the SVG geometry properties `r`,
  `x`, `cx`… are two edits from anything), and the raw `css` hatch is not
  read at all — it exists to hold what the typed surface cannot, and an
  `@font-face`'s `src` or an `@property`'s `syntax` is a descriptor, not a
  property. What you write in the hatch, you check.
- a component that styles `focus-visible` nowhere, so keyboard focus is
  invisible.
- a `skipStates` entry naming neither a state nor a flag of that part.
- variants on a component with no `root` part (Dialog, Popover, Tooltip,
  Menu) — the generated selectors can't match, so the rules would be dead CSS.

And these are warnings worth driving to zero:

- a declaration key no CSS specification defines and nothing is close to
  (`glorbification`). New CSS lands here rather than as an error, so a
  property newer than the kit's list passes — but a typo of something exotic
  does not render, so look before you dismiss it.
- a hardcoded palette colour. Achromatic-with-alpha (`oklch(0% 0 0 / 0.3)`)
  is exempt — that's a shadow or scrim, not palette.
- a literal duration in a `transition`: reduced motion only collapses
  `var(--duration-*)`, so a literal opts out of the preference.
- a component in the manifest with no recipe at all.
- a part that declares `starting-style` but never transitions (the entry
  styles are never used), or transitions no discrete property with
  `allow-discrete` (the entry animates and the exit cannot — `allow-discrete`
  over `opacity` alone changes nothing).
- a part that declares `focus-visible` and doesn't style it. If the ring
  genuinely belongs on an inner part, say so with
  `skipStates: { root: ['focus-visible'] }` rather than leaving it implicit.
  Note that `skipStates` has a second reader: the state-legibility guard takes
  an entry as "this state is deliberately indistinguishable from its
  siblings". Silencing a coverage warning with it therefore also waives the
  guard for that state, on **that part only** — write the reason next to it.
- `var(--x, fallback)` referencing something undeclared — the fallback makes
  it safe, so it's the sanctioned way to read an app-supplied property.

## What `audit` will catch

`sigx zero:audit` (after building the TS; `zero:build` runs it too and
writes `dist/audit.json`) reads the **compiled CSS** — the only place every
door a declaration can arrive through (`states`, `selectors`, `variants`,
`compoundVariants`, `modifiers`, nested `at`, raw `css`) is visible. Only
the default render counts: a difference that lives under a `@media` is not
the reader differentiating. Errors fail the command; warnings fail it under
`--strict`; `info` never does.

| Rule | Severity | It reports… | Waived by |
|---|---|---|---|
| `state-legibility/component` | error | two declared states no part of the component renders differently | `skipStates` on every part that has them; the anatomy's `hiddenIn` |
| `state-legibility/indicator` | error | an `*indicator` part that renders identically across its own states — a spacer, not an indicator | `skipStates` on the indicator; `hiddenIn` |
| `state-legibility/disclosure` | error | the control of an in-flow disclosure (collapsible, accordion, tree-view) that says nothing about `open`/`closed` | `skipStates` on the control; a sibling `*indicator` that differentiates |
| `button-affordance` | error | a part zero renders as a real `<button>` with no unconditional `appearance` reset, so the user agent paints its chip | — (set `appearance: none`) |
| `axis-value-coverage/gap` | error | a declared step a sibling scope implements that this scope neither paints nor claims as its base | `tokens.scopes` |
| `axis-value-coverage/ambiguous-base` | error | two values written as empty entries, both claiming the base | — |
| `axis-value-coverage/unused` | warning | a declared value no recipe paints or claims; or one in no scope's vocabulary | a role declared `content: false` / `soft: false` (a fill, not an axis value) |
| `axis-coverage` | warning | a styled scope that accepts a declared `color`/`size` axis and wires nothing | `roles: {}` / `sizes: []`; `tokens.scopes.<scope>.colors: []` / `.sizes: []` |
| `reduced-motion/loop` | error | an infinite animation with no `animation: none` on the same selector under `prefers-reduced-motion: reduce` — the kit collapses durations there, so a loop strobes rather than stops | — |

A waiver is listed, never swallowed: the `waived:` line in the output and
the `waived` array in `audit.json` say what each declared mechanism excused,
so an excuse you did not intend is as visible as a finding.

The three `contrast/*` rules are the browser contrast audit computed from
the compiled CSS instead of a page — the same two matrices, cell product,
colour math and floors, with one honesty contract on top: a cell the
static reader cannot judge is `unmeasured`, never a pass.

- `contrast/text` — every text-bearing part, in every state × flag
  combination, in every theme, plus your own axis surface (each wired
  `variant`/`color` value, each modifier): the computed ink against the
  effective background. Below 3:1 is an error per cell; 3–4.5:1 is one
  warning per part and theme (the worst cell named — the table keeps them
  all); a
  `disabled` cell answers to a 2:1 floor measured on the pair *before* the
  state's fade — dimming is the state, choosing ink nobody could have read
  is not.
- `contrast/indicator` — the parts whose whole job is paint (the checkbox
  tick, the radio dot, the switch thumb, the progress range, the chevrons,
  the star), measured inside their real ancestor chain against the fill
  they sit on. Same 3:1 floor; the 3–4.5:1 band is a note, because WCAG
  1.4.11 holds a non-text mark to 3:1. A mark that is intentionally not painted in a
  state (unchecked → `scale(0)`) is `unpainted`, not a failure.
- `contrast/unmeasured` — the cells a static reader cannot judge, once per
  (scope, part, reason): a gradient, a `filter`, a selector it does not
  evaluate, a `var()` nothing defines, a declaration under `@supports` or
  `@container` (a `@media` query is decided against the desktop page the
  browser audit runs in). Reported as `info` so they never fail
  a build and never pass silently — check them in the playground, where the
  browser contrast audit is the ground truth.

Read `result.contrast` for the whole cell table; `buildReport(…, { contrast })`
summarises it per theme in `report.contrast`.

## Reference

### The brief pack — start here

`skills/design-system/briefs/` holds six complete, compiling starting points.
Each file is one `TokensInput` (every category filled, both schemes, contrast
clean) plus one worked `RecipeInput` for Button. **Pass the closest one as
`--brief` to the scaffold (step 2), then diverge** — it becomes
`src/tokens.ts` and `src/button.ts`, over zero-basic's recipes as the
baseline for everything else. They are compiled and validated by the repo's
test suite, so a brief that has gone stale is a failing test rather than a
trap.

The six are deliberately not six palettes — each one teaches a different
mechanic, and reading all six is the fastest way to learn what the token
contract can express. Note that five of them take the default axis
surface (the recommended eight roles, xs–xl, and the four-name variant set);
`riso` is the one that doesn't, and it is the one to read when the brief's
shape isn't the conventional one. `seeded` is the one whose colours are
derived rather than written, and the one to start from when the brief is a
hue and a mood:

| Brief | radius | border | Signature move | Teaches |
|---|---|---|---|---|
| brutalist | 0 | 3px | shadows drawn in `var(--color-base-content)` with zero blur, and `steps()` easings | how far the standard categories stretch before you need a custom token |
| glass | 1.25rem | 1px | `backdrop-filter: blur(var(--glass-blur))` on every floating surface | declared custom tokens, and translucency that survives both schemes |
| corporate | 0.5rem | 1px | a two-part shadow ramp (contact + ambient) and a 1.2 type ratio | contrast discipline and declared breakpoints — the two things this brief is judged on |
| terminal | 0 | 1px | every duration is 0ms, and `--shadow-*` is a glow in `var(--color-primary)` | 0ms durations instead of `transition:none`, and a glow built from theme colours |
| riso | 0.125rem | 2px | overlapping ink multiplies instead of covering, via a modifier and a compound that matches it | `roles:{}` and `sizes:[]` to decline an axis, a fused variant vocabulary, modifiers and a compound that matches one |
| seeded | 0.75rem | 1.5px | no colour literal anywhere in themes — `deriveThemePair` from two seed hues | deriving a whole palette from seed hues with the contrast guarantee, and where hand-tuning still belongs |

Typography carries a brief further than anything else: brutalist wants a
mono or condensed stack with 800+ weights and wide tracking; editorial
wants a serif with generous `leading`; corporate wants a humanist sans and
a restrained `ratio`. The six ratios above — 1.414, 1.25, 1.2, 1.125, 1.333,
1.15 — are most of the difference between those six looks.

### Worked design systems

Five live in this repo, in increasing distance from the defaults:

- `@sigx/zero-basic` — the canonical starting point. Read its `src/tokens.ts`
  and `src/recipes.ts` before writing your own.
- `@sigx/zero-brutalist` — a brief taken to its extreme: radius 0, `steps()`
  easings, hard offset shadows drawn in the foreground colour, a 1.414 type
  ratio. Generated from this skill.
- `@sigx/zero-material` — a foreign vocabulary: thirteen colour roles, a
  `level1`–`level5` elevation ramp, `soft: false` tonal surfaces, and a role
  (`outline`) with `content: false`. Read this one when the brief needs names
  the recommended eight don't cover.
- `@sigx/zero-heroui` — a differently *shaped* vocabulary rather than a wider
  one: `roles: {}` (no colour axis at all), colour fused into a seven-member
  `variant`, a three-step size ramp, and HeroUI's `isIconOnly` / `isPending`
  as `data-mod-*` modifiers. The reference for everything in this skill about
  declining an axis or fusing one.
- `@sigx/zero-carbon` — the same shape under a vendor's own names: no colour
  axis, and the fused vocabulary declared as `kind` with Carbon's
  double-hyphen spellings (`danger--tertiary`) restored at the prop boundary
  by its generated `./components` module. Read it when the brief has to match
  an existing product's API rather than zero's.

### Conformance fixtures — non-default axis surfaces, in miniature

`skills/design-system/conformance/` holds one small file per surveyed vendor
(HeroUI, Material 3, Radix Themes, Ant Design, Carbon). Each declares that
system's real vocabulary and — for three of them — a compiling `TokensInput`
plus a Button `RecipeInput` exercising it, in the same shape as a brief but a
fraction of the size. They are the worked examples for the shapes the brief
pack doesn't cover: a numeric size ramp (`sizes: ['1','2','3','4']`), a custom
`tokens.axes` entry, a vendor-renamed axis, and camelCase modifier names
restored at the API boundary. `docs/design-system-conformance.md` is the
generated matrix they prove; docs/architecture.md §7 (the conformance
program) is the reasoning.

### Briefs the pack does not cover

Reach for the nearest file and change these axes:

| Brief | Nearest | Change |
|---|---|---|
| editorial / magazine | corporate | a serif `fonts.sans`, `leading.relaxed` up to 1.8, ratio to 1.333 |
| playful / toy | glass | radius to `9999px` on `field`, a bouncy `emphasized` easing, ratio 1.2 |
| dense / data-tool | corporate | halve the `spacing` ramp, ratio to 1.125, `text.base` to 0.875rem |
| neon / cyberpunk | terminal | keep the glow, raise chroma, restore real durations |
