# SignalX Zero — architecture

This is the design doc of the system **as it exists in the tree**. It is
descriptive, not aspirational: every claim below is checkable against source,
and where a historical proposal and the tree disagree, the tree won. The
three RFCs that used to live in `docs/rfcs/` are deleted — this document
describes what they became; what each proposed and where it landed is
recorded in [§11 History](#11-history--the-rfcs-and-where-they-went), and
their full texts remain reachable in the git history of `docs/rfcs/`.

Two companion documents stay separate because they serve different readers:
[`docs/building-your-own-component.md`](./building-your-own-component.md) is
the guide for shipping a component zero doesn't (see [§8](#8-ecosystem-components)),
and [`docs/design-system-conformance.md`](./design-system-conformance.md) is
the **generated** conformance matrix (see [§7](#7-the-authoring-surface) for
the program that generates it).

## 1. Thesis and shape

Zero is a design-system-neutral component foundation for the web. The thesis
splits one product into two artifacts with a machine-checkable seam between
them:

- **`@sigx/zero`** ships unstyled, accessible compound components. Every
  rendered part carries `data-scope="<component>"`, `data-part="<part>"` and
  optionally one `data-state` value — a stable, machine-readable anatomy.
  Zero attaches **no styling** to any of it beyond a minimal structural
  `css/base.css`.
- **A design system is data**: typed tokens and recipes, compiled by
  **`@sigx/zero-kit`** (a Node-only authoring kit) into plain CSS that
  selects on the anatomy attributes. No Tailwind, no CSS-in-JS, no runtime
  styling engine.

The styling seam is **attributes, never classes or inline styles**. That one
rule is what makes everything else work: a design system can be swapped at
runtime by swapping a `<link>` (the playground does exactly this across six
design systems over the same JSX), a design system can be *generated* by a
model that has only read the manifest, and a component the design system has
never heard of renders unstyled but accessible — correctly attributed
anatomy, working behavior, `hidden` still honored. That fallback is the
baseline of the thesis, not an error state.

The package map, and what each package is *for*:

| Package | Role |
|---|---|
| `@sigx/zero` | The runtime foundation: anatomy contract, headless behaviors, 32 compound components, theme engine. Peer-depends on `sigx` only. |
| `@sigx/zero-kit` | The Node-only authoring kit: `defineTokens` / `defineRecipe` / `defineDesignSystem` / `defineApi`, the tokens+recipes → CSS compiler, validation, artifact emission, the `sigx` CLI plugin, the generation skill, and the JSON schemas. Never a runtime dependency. |
| `@sigx/zero-basic`, `@sigx/zero-daisyui` | Shipping design systems — the neutral starter and the daisyUI-flavoured proof that a design system is data. |
| `@sigx/zero-material` | Private acceptance test: **extensible vocabularies** (13 colour roles, a `level1`–`level5` elevation ramp, its own easings and breakpoints). |
| `@sigx/zero-brutalist` | Private acceptance test: a skin generated end-to-end from a style brief through the design-system skill. |
| `@sigx/zero-heroui` | Private acceptance test: **non-orthogonal axis surfaces** — no colour axis at all (`roles: {}`), colour fused into a seven-member `variant`, presence-only modifiers, a declared three-step size ramp. |
| `@sigx/zero-carbon` | Private acceptance test: the **vendor-named api surface** — a fused `kind` vocabulary with Carbon's double-hyphen spellings restored at the prop boundary by the generated `./components` module. |
| `@sigx/zero-ext-example` | Private acceptance test: the **ecosystem-component loop** — a component built entirely from zero's public surface and adopted by zero-basic via a manifest fragment ([§8](#8-ecosystem-components)). |
| `examples/playground` | The demo app and the e2e host: runtime design-system switching, one DS live at a time. |
| `examples/typed-app` | The consumer-side type capstone: three isolated programs compiled against **emitted** artifacts through real package exports ([§9](#9-the-verification-architecture)). |

Everything publishable is lockstep-versioned; nothing has been released yet,
which is why the contract could be broken freely as it hardened (every
breaking change in [§11](#11-history--the-rfcs-and-where-they-went) was free
exactly once).

## 2. The anatomy contract

The contract lives in `packages/zero/src/contract/` and every component's
`anatomy.ts`; the aggregate registry is `packages/zero/src/anatomy.ts`.

**Scope, part, state.** Every rendered part carries `data-scope` and
`data-part` (kebab-case). `data-state` holds exactly one value at a time from
a closed, per-part set. Boolean flags are presence-only (`data-disabled=""`,
never `="false"`).

**The part tree.** `PartSpec.parent` names the same-scope part a part renders
*inside* — the anatomy is a tree, with top-level parts (a lone `root`, or a
trigger/popup pair whose Root renders a fragment) as its roots. `parent` is a
statement about the rendered DOM, not the compound-component API, and it
names the **containing part, not the immediate parent element**: a menu
`item` declares `parent: 'popup'` even when it renders inside a `group`,
because other parts and consumer markup may sit between. Three consumers read
the tree: `expectAnatomy` asserts the declared parent appears among the
element's same-scope ancestors, the contrast audit derives its ancestor
chains from it instead of hand-maintaining them, and the recipe compiler uses
containment to bound descendant-anchored axis rules
([§3.3](#33-compilation)) and to detect dead rules on rootless scopes.

**States are governed.** `STATE_VOCABULARY`
(`packages/zero/src/contract/data-attrs.ts`) closes the `data-state` value
space the same way flags were closed from the start: every value in every
anatomy's `states` must be a member, and a new state value is a contract
change there first. The vocabulary is grouped into families — presence
(`open|closed`), selection (`checked|unchecked|indeterminate`), activation
(`active|inactive`), toggle (`on|off`), loading
(`loading|loaded|complete|error`), fill (`full|half|empty`) — but the
families are documentation, not a per-part constraint: membership is checked
against the union, so progress may legitimately mix `loading|complete` with
`indeterminate`. A companion `STATE_SYNONYMS` table maps the spellings the
vocabulary deliberately does *not* contain (`expanded → open`,
`mixed → indeterminate`, `busy → loading`, …) to the member that means the
same thing — purely diagnostic, so a governance failure is actionable rather
than a scavenger hunt. The table is mirrored in zero-kit (parity-tested) so
`mergeManifests` says the same thing to ecosystem fragments.

**Flags are a closed shared vocabulary.** `FLAG_VOCABULARY`: `disabled`,
`highlighted`, `selected`, `invalid`, `required`, `readonly`, `placeholder`,
`focus-visible`, `pressed`, `press-animating`. Components never invent
synonyms; a new flag is a contract change. The press pair is produced by
`createPressFeedback`: `pressed` while the pointer/key is physically down,
`press-animating` from press-start until the design system's press animation
*finishes* — not until release, so a one-shot ripple always plays out — with
the press point published as `--press-x`/`--press-y`/`--press-r`.

**Placements are declared, not exempted.** `PLACEMENT_VOCABULARY` closes
`data-placement` (twelve side/alignment values), and a part that can carry
the attribute declares which subset in its anatomy (`PartSpec.placements`) —
the anchored-position behavior stamps open floats with where they *actually*
are after flipping, and Toast stamps its viewport and roots. This replaced an
earlier blanket exemption: `expectAnatomy` now fails an undeclared
`data-placement` exactly as it fails an undeclared state.

**Layout attributes are a namespaced family.** `LAYOUT_VOCABULARY` closes a
fifteen-attribute set (`gap`, `pad`, `align`, `justify`, `cols`, `span`, …)
rendered under a `data-l-` prefix, and a part that can carry one declares
which subset in its anatomy (`PartSpec.layout`) — governed and checked
exactly like `placements`.

It is deliberately *not* a design-system axis. An axis answers "which one"
out of a vocabulary the skin invents and zero passes through uninterpreted; a
layout attribute answers "how much" out of a ramp the token contract already
fixes, so `gap="md"` has to mean the `md` rung of `--space-*` in every design
system or a page laid out against one skin falls apart under the next. The
skin chooses what `--space-md` *is*; it does not choose what `md` *means*.
Because the value set is closed to the ramp, an app cannot spell a gap its
design system has no token for — which is what makes a density mode possible
at all, since redefining `--space-*` under a selector re-spaces every layout
at once.

Two details of the spelling carry weight. Per-breakpoint values put the
breakpoint in PREFIX position (`data-l-gap="sm"` alongside
`data-l-md-gap="lg"`), because breakpoint names are open kebab-case and a
suffix spelling would make `data-l-gap-x` ambiguous between "the x-axis gap"
and "gap at a breakpoint named `x`". And the prefix itself is what keeps
fifteen very ordinary words (`gap`, `align`, `track`…) *out* of
`RESERVED_AXES`: unprefixed, each would have to be seized permanently from
every design system in the ecosystem, and a skin that legitimately wanted an
axis called `align` would start failing validation.

**The layout tier is where the attribute family earns its keep.** `Stack`
(with its `Row`/`Col` presets), `Spacer`, `Grid` and `Center` carry layout
attributes and nothing else — no colour, no size, no variant, because every
one of them is geometry and `data-color` on geometry would paint nothing.
`Box` is the exception that proves the split: it is the tier's one scope that
PAINTS, so it wires `color` like any content component, and declares `size`
out of existence because a Box's size IS its padding and `pad` already says
that.

`Container` is why the token contract gained a category. Bounding a page needs
a page-scale length, and nothing in `TOKEN_CATEGORIES` reached one:
`--space-*` is a density ramp that tops out around 1.5rem and `--size-*` is
the base unit control sizing multiplies. `--measure-*` is that family, and it
is a category rather than a pack default precisely because how wide a page
runs is IDENTITY — a single baked-in number would have made every skin's pages
the same width, which is the leak this tier exists to close. The width is a
layout attribute rather than the `size` axis for the same reason the two are
different questions: `size="lg"` means a chunkier button and would mean a
wider page, and `prose` — a reading measure in `ch` — is not a size at all.
They are one scope per behaviour rather than one per spelling: `Row` and
`Col` are the same `stack` with a different default `data-orientation`, so
there is one recipe and one manifest entry for a skin to paint.

What makes the tier worth having in the contract rather than in an app is
that its CSS is generated per design system by `@sigx/zero-kit`'s layout pack
and emitted in two layers. A scope-agnostic **step table**
(`[data-l-gap="md"] { --l-gap: var(--space-md) }`) is emitted once per design
system through `DesignSystemInput.css`; each layout part declares its
defaults as component tokens and consumes them (`column-gap: var(--l-gap-x)`).

Both halves of that shape are load-bearing. Putting the table in the recipes
instead would emit one design-system-wide fact once per layout scope and
again per breakpoint tier — measured at ~900 rules per skin against 266 for
the four scopes shipped so far.

The saving is real but worth stating precisely: the table grows with the
VOCABULARY a scope uses, not with the number of scopes. `Center` cost three
rules, because `axis` has three values and does not vary by breakpoint;
`Grid` cost 109, because `cols` and `span` are thirteen-value responsive
attributes and so are 52 rows each. A scope that reuses the spacing
attributes already tabled costs nothing at all.
And declaring the defaults ON the carrier rather than as `var()` fallbacks is
what stops a `Grid` nested in a gapped `Row` inheriting that Row's spacing,
since a custom property that is set — just not by this element — never
reaches its fallback. That in turn forces the table to out-specify the
carrier's own `[data-scope][data-part]` block, which is why its selectors
carry an otherwise-redundant `[data-scope][data-part]` prefix.

**`hiddenIn` is a styling fact.** A part the runtime hides with the `hidden`
attribute in some state declares those states (`hiddenIn: ['error']` on
avatar's `image`). It belongs in the anatomy because it changes what a recipe
can honestly be asked to do: a rule targeting a hidden state can never paint,
so identical CSS across a hidden and a visible state is *correct*. The
state-legibility guard reads it from the manifest instead of carrying a
hardcoded exemption list. Every entry must be one of the part's own `states`,
and a part the runtime never hides omits the key — the schema rejects an
empty array, since a key claiming nothing reads as a fact where there is
none.

**Pseudo parts.** A part that renders no element of its own (dialog's
`backdrop`) declares `pseudo: { of, selector }`; selectors compose with the
pseudo-element last, so states narrow the host — the only thing an attribute
can narrow. The part stays real in the anatomy because a non-web platform
would render it as an element.

**The registry is typed closed.** `anatomies` in
`packages/zero/src/anatomy.ts` is declared `as const satisfies
Record<string, Anatomy>` — 56 components — so `ZeroScope` is a closed literal
union. That closure is load-bearing: the generated register artifact asserts
its scope keys against it at compile time ([§3.5](#35-the-register-artifact)),
which is what makes a typo'd or version-skewed scope a compile error instead
of a silent fall-through to the open unions.

**Enforcement.** `expectAnatomy` (`@sigx/zero/testing`) is the assertion
zero's own suite runs and ecosystem packages are told to run: declared parts
only, states from the closed set, flags declared and presence-only,
`data-placement` from the declared subset, `hidden` exactly where `hiddenIn`
says, and the declared `parent` present among same-scope ancestors. Custom
axes must be passed in explicitly (`{ axes: ['emphasis'] }`) and are checked
for grammar and non-collision with the contract. Runner-agnostic — it throws
a plain `Error`.

**Flow into tooling.** Each component's `anatomy.ts` is the source of truth:
the component imports its part names from it, tests assert against it, and
`scripts/gen-manifest.mjs` emits the whole registry (plus the attribute spec
and token grammar) as `dist/manifest.json` at build time
([§4](#4-the-manifest-contract)). Changing an anatomy is a breaking change.

## 3. The variant-axis pipeline

The centerpiece. A design system's styling *surface* — which colours, sizes,
variants, custom axes and modifiers each component answers to — travels a
single pipeline from declaration to a consumer's JSX, and every stage is
validated against the one before it:

```
declare (tokens.ts)  →  validate  →  compile (CSS)  →  harvest  →  emit types  →  runtime attrs
```

### 3.1 Declared vocabulary

`TokensInput` (`packages/zero-kit/src/tokens.ts`) declares, design-system
wide: `roles` (the colour vocabulary), `sizes`, `variants`, `axes` (custom
axis name → value list), `modifiers` (presence-only names), and `scopes`
(per-scope narrowing).

The grammar's load-bearing distinction: **absence means "I didn't say";
empty means "there isn't one".**

- `sizes: []` is legal and means *this design system has no size axis* —
  `resolveSizes([])` returns `[]`, every recipe keying `variants.size`
  errors, and the register artifact emits `size: never` everywhere. An
  *omitted* `sizes` takes the recommended ramp. `roles: {}` makes the same
  claim for colour (zero-heroui is the shipped proof: genuinely colourless).
- `variants: []` makes the same claim for the variant axis (#200/#295):
  every recipe keying `variants.variant` errors, the manifest records
  `tokens.variantsDeclared: true`, the report lists `variant` under
  `declaredOut`, and the register artifact emits `variant: never` with the
  declared-out reason ("declares no variant axis at all") rather than the
  unwired one ("no recipe wires it"). An *omitted* `variants` still means
  "declared nothing, check nothing" — `variant` has no recommended default
  to fall back to, so both spellings compile to an empty list and
  `variantsDeclared` is what tells them apart. A custom axis in
  `tokens.axes` cannot be declared away: `[]` there stays an error, since
  there is no named prop to switch off.

**Per-scope vocabularies** (`tokens.scopes`). A design system may declare,
per component scope, which part of each axis vocabulary that scope offers —
which reframes the design-system-wide lists as the **union of every scope's
vocabulary** rather than one vocabulary all scopes share. Inside a scope
entry the same absence/empty grammar applies: an absent key means the scope
offers the whole union, an empty list is the positive claim "this scope has
no such axis". The restriction unit is deliberately the **scope, not the
part**: zero carries one attribute per axis on the scope's carrier part, so
two vocabularies on two parts of one scope are two *axes*, not one axis
restricted twice — `parts` is reserved inside a scope entry and rejected by
name so per-part narrowing could be added later without a breaking change.
The shipped proof is `select` under zero-basic: its `variant` vocabulary
(`outline | soft | ghost`) is its own, not the button's.

Two mechanisms serve shapes the enumerated axes cannot:

- **Modifiers** are presence-only styling switches in a prefixed namespace:
  `tokens.modifiers: ['icon-only', 'pending']` →
  `mods={{ 'icon-only': true }}` → `data-mod-icon-only=""`. The prefix is
  the safety argument: modifiers are presence-only, exactly the shape of
  zero's own flags, so an unprefixed name would silently collide with a flag
  zero adds later. Axes are *valued*, so they need no prefix — a name
  collision can never match a flag rule, and the runtime throws on reserved
  axis names anyway. Absence is a modifier's default; there is no
  `defaultVariants` analogue for them.
- **Custom axes** (`tokens.axes`) carry everything else — a renamed or extra
  enumerated axis (`radius`, `shape`, Ant's `type`) becomes
  `axes={{ type: 'primary' }}` → `[data-type="primary"]`, validated and
  typed like the named three.

`defaultVariants` lives at **recipe** level: values applied when the axis
attribute is absent, i.e. CSS-only defaults.

### 3.1b Spacing is a ramp, and the ramp is a mechanism

`--space-2xs` … `--space-2xl` is not a convenience scale. Because a recipe
writes `var(--space-md)` rather than `0.5rem`, an app gets a **density mode**
with no help from zero at all:

```css
[data-density="compact"] { --space-md: 0.375rem; --space-lg: 0.5rem; }
```

Custom properties inherit, so that scopes to any subtree; app CSS is
unlayered, so it beats the `:where(:root)` a design system writes into
`zero.tokens` ([§5](#5-the-compiler-and-css-architecture)); it needs no JS and
survives a runtime design-system swap, because the swap replaces the `<link>`
that defines the ramp and every reference re-resolves.

Every literal is inert under that switch. So a hardcoded padding is not a
style opinion, it is a hole in a mechanism — which is why the `spacing/*`
audit rules exist and why `spacing/off-ramp` is an error rather than a
warning. The leak they were written for was structural rather than careless:
`size` variants were spelled as spacing literals (`padding: '0.25rem 0.5rem'`,
where `0.25rem` IS `--space-xs`), so the size axis and the spacing ramp were
two uncoordinated systems doing the same job.

Three spellings are deliberately exempt, and each is exempt because the naive
rule gets it wrong. `em` lengths are spacing that tracks TYPE rather than the
ramp — a different, legitimate choice. Anything inside parentheses is
arithmetic rather than a step, so `calc(var(--space-lg) - 2px)` already rides
the ramp; only top-level components of a value are judged. And `0` needs no
token.

One authoring rule follows for **recipe packs** specifically, and was found by
`zero:fragment`'s hostile-vocabulary probe rather than by reasoning:
`system.spacing` is optional, and a design system that omits it emits no
`--space-*` at all. On web `css/base.css` still resolves the reference from
`@layer zero.fallback`; lynx has no such layer, so the declaration is dropped
and the part paints nothing. A design system's own recipes may write
`var(--space-md)`; a pack that may be adopted by any design system writes
`var(--space-md, 0.5rem)`.

### 3.2 Build-time validation

Two questions are asked at build time, by two different mechanisms.
**Validation** (`validateDesignSystem` / `validateRecipes`) asks "is this
correct?" — its errors gate the build, and nothing is emitted from an
invalid source. The **audit** (`auditDesignSystem`, [§9](#9-the-verification-architecture),
#403) asks "does what was built say what it claims?" by reading the
*compiled* CSS; it is quality rather than correctness, so it never gates
the build — `runStandardBuild` runs it, writes it as `dist/audit.json`,
folds its counts into `report.json` under `audit` and scores them, and
`sigx zero:audit` is the command with the exit code (error findings fail
it, `--strict` fails on warnings, `info` never). A design system
mid-iteration must be able to read its own audit and still get artifacts
to look at; that is the whole reason the two are not one command.

`validateDesignSystem` / `validateRecipes`
(`packages/zero-kit/src/resolve/`) enforce one principle stated in the
source: **an explicit declaration closes its set.** Colour against `roles`,
variant against `tokens.variants`, a custom axis against `tokens.axes`, size
against an *explicitly declared* `tokens.sizes`, and any value against a
scope's own `tokens.scopes` entry — all errors listing the declared set.
Only the default-resolved size ramp stays advisory (the author never wrote
the set down). The other rules worth knowing:

- **A contrast failure carries its fix.** The per-theme WCAG check (error
  below 3:1, warning below 4.5:1 on every `contrastPairs` pair) solves the
  content side's lightness with the palette solver
  ([§7](#7-the-authoring-surface)) at AA and attaches it twice: in prose
  (` — suggest primary-content: oklch(…)`) and as `ValidationIssue.suggest
  { token, value }` under `rule: 'contrast-floor'`, so an agent iterating
  on a generated theme pastes the value rather than guessing a lightness.
  `rule` and `suggest` are optional on every issue; a rule carries them
  only when it can vouch for a fix.
- **`defaultVariants` is validated unconditionally** — against the recipe
  itself (wired keys and values), so it needs no declaration to be checked.
- **An axis wired with zero values is an error** — the components emitter
  would otherwise print an empty union.
- **Compound variants**: matching an axis the recipe never wires in
  `variants` is an error (the value would be harvested into the type union
  while the CSS only half-supports it); matching a value the axis doesn't
  wire is a warning.
- **Union honesty diagnostics.** When one scope narrows an axis and a styled
  sibling does not, the sibling is still offering values declared for
  someone else — a *cross-talk* warning. A union value in no scope's
  vocabulary is *unclaimed* — reportable only once every styled scope is
  restricted, because an unrestricted scope's vocabulary *is* the union.
- **Token-name grammar**: `recipe.tokens` keys must be `--kebab-case` (a key
  missing `--` would be emitted as a plain CSS declaration on every carrier
  element); two roles whose derived properties collide (`danger` derives
  `--color-danger-soft`; a role literally named `danger-soft` emits the same
  property) are an error — a live hazard, since `danger-soft` is a real
  HeroUI variant name.
- **Axis-value grammar** (#198): names and values are graded separately.
  An axis, modifier or role *name* is `TOKEN_KEY_PATTERN` (kebab-case, digit
  allowed first) because it becomes `data-<axis>`, `data-mod-<name>`,
  `--color-<role>`. An axis *value* is `AXIS_VALUE_PATTERN`
  (`/^[a-z0-9]+(-+[a-z0-9]+)*$/`): repeated hyphens are admitted, which is
  Carbon's entire `kind` axis (`danger--tertiary`) declared verbatim; `%`
  and `.` are not, because the lynx target writes a value into an
  unescaped class name (`zx-a-<axis>-<value>`) and zero's runtime composes
  the same class — so Radix's `105%` stays an `api.values` remap. Quotes,
  backslashes and whitespace stay out so every interpolation site
  (`[data-…="…"]`, the single-quoted unions in `register.d.ts`, the class
  compounds) stays escape-free; uppercase stays out because `data-*` values
  are case-sensitive. The validator (`checkAxisValues` / `checkAxisNames`),
  `assertAxisToken('value', …)` on both emitters, and the `axisValue` /
  `kebabToken` defs in every schema move together — the constant is
  parity-tested between kit and zero.
- **CSS property names** (#51): every declaration key is checked against
  `resolve/css-properties.ts`, the property names the CSS specifications
  define, generated from a pinned `@webref/css` by
  `scripts/gen-css-properties.mjs` and held equal to it by a test. A key
  within two edits of a real property (`paddding`) is an error carrying
  `rule: 'css-property'` and `suggest`; a key near nothing is a warning,
  because new CSS must pass while a typo of something exotic must still be
  seen. Keyframes bodies are read; the raw `css` hatch is not (its at-rule
  descriptors — `src`, `syntax`, `symbols` — are not properties). Custom
  properties, vendor-prefixed spellings and keys under four characters
  (the SVG geometry properties are two edits from any short typo) never
  reach the error tier. This is the one authoring slip no other gate can
  see — the browser drops the declaration and says nothing.
- Reserved names: an axis may not shadow a named prop (`color`, `size`,
  `variant`, `mods`, `axes`) nor anything the anatomy contract owns
  (`scope`, `part`, `state`, `orientation`, the flag vocabulary). The kit
  keeps its own copies of these sets — it must stay a pure Node tool — held
  honest by the contract parity test.

### 3.3 Compilation

`packages/zero-kit/src/targets/web/recipe-css.ts`. Axis rules are anchored
on the **carrier part**: the part named `root`, else the first declared part
(`carrierPart` in the kit's contract module). Four scopes have no `root` —
dialog, menu, popover, tooltip render a fragment Root — so their carrier is
the **trigger**, and their axis attributes live there.

For the carrier itself the rule is flat: the attribute sits on the element,
`[data-scope="s"][data-part="trigger"][data-variant="v"]`. For any other
part the attribute is on an *ancestor*, and a bare descendant selector is
unbounded — card-in-card would let the outer instance's axis rules reach the
inner one, with source order rather than proximity deciding. The compiler
therefore emits a **donut scope**:

```css
@scope ([data-scope=s][data-part=root][data-variant=v]) to ([data-scope=s][data-part=root])
```

The lower bound is any nested same-scope carrier — its subtree leaves the
scope. Two CSS facts make this correct: scoping proximity outranks source
order, so each part resolves to its *nearest* carrier; and an unscoped rule
counts as infinitely distant, so the axis refinement still beats the flat
base rules. Because the four rootless scopes render their popups as
**top-layer siblings** of the trigger, the donut can never reach them — so
the validator errors on any variant/modifier/compound rule for a part whose
declared `parent` chain does not reach the carrier: those selectors would
compile but never match ("dead rules"). Axis styling on those scopes styles
the trigger, in each skin's button idiom.

Other compilation facts a reader needs:

- **Defaults are mirrored onto absence.** A single-axis rule whose value is
  the recipe's default is emitted twice: `[attr="v"]` and `:not([attr])`.
  Compound variants take the same treatment as a **cross product**: each
  matched axis contributes `[attr="v"]`, plus `:not([attr])` when the value
  is that axis's default — without it, a compound naming a defaulted axis
  would match nothing, since the attribute is simply absent. (`match: true`
  contributes a modifier's presence attribute, which is how modifiers
  participate in compounds.)
- **Emission order is a correctness concern, not taste.** At-rules add no
  specificity, so conditional buckets are emitted in a fixed tier order —
  raw conditions, preference queries, breakpoints, reduced-motion,
  `@starting-style` — with reduced-motion late so an accessibility override
  is never overwritten by a wider viewport, and `@starting-style` after the
  open-state rules it interpolates from. The same prelude reached at two
  different tiers (a raw `@media (min-width: 640px)` next to a declared
  `sm`) is a hard error: its position would otherwise depend on visit
  order.
- Everything lands inside `@layer zero.recipes`; `@keyframes` are emitted
  outside the layer.
- Compound rules are emitted separately rather than comma-joined, because
  part-style emission appends pseudo-element suffixes and `&` substitutions
  that would bind only to the last selector of a list.

### 3.4 Harvest

`compileDesignSystem` (`packages/zero-kit/src/design-system.ts`) records,
per scope, what the recipes **actually wire**:
`CompiledComponentAxes { color, size, variant, axes, mods, defaults?,
offered? }`. Each axis's value set is the recipe's `variants` keys unioned
with every `compoundVariants[].match` value — the compiler emits CSS for
both, and the types must cover everything the CSS matches. `defaults` is
carried for the manifest but never widens a union (validation already
guaranteed membership). `offered` is the scope's resolved `tokens.scopes`
entry, present only when the scope restricts something: *offered is the
promise, the sibling fields are the delivery, and the gap between them is a
finding* — the coverage report and the register artifact read the same
shared predicates so they cannot disagree.

This is why the emitted types describe **the harvest, not the declaration**:
the harvest is strictly stronger. It refuses to type a value the compiled
CSS does not implement.

### 3.5 The register artifact

`packages/zero-kit/src/targets/web/register-dts.ts` emits
`dist/register.d.ts` + an empty `dist/register.js` for every design system.
The mechanism is module augmentation of one empty interface:

```ts
// @sigx/zero
export interface ZeroVocabulary {}
```

The generated file augments it with `theme`, `breakpoint`, `property`,
`tokens` (per-category key unions) and `components` — one entry per compiled
scope, each carrying `color` / `size` / `variant` / `axes` / `mods`. An app
opts in with one side-effect import (`import '@sigx/zero-basic/register'`);
without it, every scoped resolver falls back to the open unions, so **no
augmentation means no change for anyone**.

The encoding rules are where the correctness lives:

- **An unwired axis is `never`**, with a generated doc comment naming the
  reason (scope declared it empty, the design system has no such axis, or
  no recipe wires it) — so the error explains itself.
- **An empty `axes`/`mods` bag is `Record<string, never>`, never `{}`** —
  `{}` is the top object type and would silently permit any bag, which is
  the exact failure class the mechanism exists to remove.
- The consumer-side resolvers (`packages/zero/src/contract/vocabulary.ts`)
  keep three cases distinguishable — no augmentation → open fallback;
  declared → literal union; declared empty → `never` — and the
  `[Scoped<S>] extends [never]` guard must come **first**, because testing
  the axis result against `never` cannot separate "no augmentation" from
  "declared empty".
- The file ends with two self-verifying assertions that make it fail its
  *own* compilation rather than silently degrade: `_ScopesValid` asserts
  every `components` key is a `ZeroScope` (a typo'd or version-skewed scope
  would otherwise take the open fallback and un-narrow exactly the
  component it meant to narrow) — with ecosystem scopes **excluded by
  name** in an `Exclude<…>` form whose comment lines double as the record of
  which scopes are foreign and who owns them; and `_EntriesValid` asserts
  every entry carries all five members, because the resolvers fall back to
  the open union for a member they cannot find, so a truncated entry would
  silently un-narrow the axis it omitted.

The consumer proof for this path is `examples/typed-app/src/register.tsx`,
which compiles against the **emitted** artifact through real package
exports ([§9](#9-the-verification-architecture)).

### 3.6 The components artifact — vendor-named apis

Zero's stance, stated once: **visual and behavioural fidelity is
guaranteed; API-surface fidelity is an adapter, not a contract change.** The
pass-through attributes (`data-color`/`data-size`/`data-variant`) are part
of the anatomy contract for the same reason `data-part` is — they are the
stable surface the runtime design-system swap depends on. A vendor's prop
*names* (`kind`, `type`, `isIconOnly`) are restored one layer up.

That layer is `defineApi` (`packages/zero-kit/src/api.ts`) plus the
generated `./components` module
(`packages/zero-kit/src/targets/web/components-dts.ts`):

- An api declaration maps zero's surfaces to vendor names — axis renames
  (`variant` → `kind`), per-value respellings (`values` remap:
  `danger-tertiary` ↔ Carbon's `danger--tertiary`, a spelling the attribute
  grammar cannot carry), and modifiers as flat vendor booleans
  (`isIconOnly`). Per-scope overrides live under `api.components.<scope>`.
- `RESERVED_PROPS_BY_SCOPE` guards the rename: a **design-system-wide**
  mapping onto a component-specific Root prop (`name` on Select, `type` on
  Button) is an error — it would silently delete that prop — while the same
  mapping under `api.components.<scope>` is deliberate vendor-faithful
  shadowing and allowed. The table is re-derived from zero's actual
  `*RootProps` declarations by a parity test.
- The emitted `components.d.ts` is **self-contained**: no `declare module`,
  no `ZeroVocabulary` augmentation, no `/register` import needed — so two
  design systems' `./components` modules can coexist in one program, which
  two register augmentations never could. Unwired axes are simply *absent*
  from the surface (omission is this artifact's `never`). `components.js`
  is data only: one `adapt(Base, spec)` call per routing component, with
  all behavior in `@sigx/zero/adapt`.

Emission and consumption differ: `writeArtifacts` always writes the
register artifact, and writes `components.*` only when an api is declared
(today: zero-heroui, zero-carbon, and zero-daisyui — the first to combine
an api with the recommended colour axis; the Ant fixture proves the
per-scope override). But **a consumer picks one path per program** — the register path
narrows zero's own prop names via augmentation; the components path
delivers vendor names with the vocabulary untouched. `examples/typed-app`
compiles the two (plus carbon's values remap) as three isolated programs
for exactly this reason.

### 3.7 Runtime

`variantAttrs` (`packages/zero/src/contract/props.ts`) is the single
pass-through: `color`/`size`/`variant` → `data-*`, the `axes` bag →
`data-<axis>`, `mods` → `data-mod-<name>=""`. Its guards are the runtime
half of the contract — JS consumers have no types, so the runtime is the
only thing protecting them: an axis that shadows a named prop throws, a
reserved/contract-owned axis throws, a non-kebab name throws; `undefined`
axis values are skipped *before* the guards (a narrowed bag has optional
members); falsy mods are skipped (presence-only — `false` and `undefined`
both mean absent).

All but the layout tier compose `WithVariantAxes<'<scope>'>` — the scope
literal is constrained to `ZeroScope`, so a typo'd literal
(`WithVariantAxes<'buton'>`) is a compile error rather than a silently
*different* type taking the open fallback. Ecosystem components use
`WithVariantAxesOpen<S extends string>`: the open constraint is the
deliberate cost of an out-of-tree scope. For the four rootless scopes the
axis props sit on the **Trigger**, not the fragment Root, matching where the
compiler anchors the rules ([§3.3](#33-compilation)).

One typing behavior worth naming because assertions depend on it: sigx's
JSX prop surface **strips `never`-valued props** from the parameter type, so
an unwired axis surfaces as *no prop at all* rather than a prop no value
satisfies. Both spellings mean "no value compiles"; the type tests treat
them as one predicate (`Unusable`).

### 3.8 The ledgers

`packages/zero-kit/__tests__/axis-coverage.test.ts` guards the
accepts-but-unwired gap — a component that accepts an axis at runtime which
no design system wires — and carries two ledgers, both bound from **both
ends** because the two ways a ledger goes stale are opposite:

- **`NO_VARIANT`** records, per carrier that wires no `variant` anywhere,
  the surveyed reason (per-vendor prop tables, dated). A new carrier
  arriving unrecorded fails; a recorded reason whose carrier has since been
  wired fails. It is a record of *decisions*.
- **`UNWIRED_AXES`** records `(scope, axis)` pairs a design system may
  leave unwired *for now* — debt with an issue, not a decision. It is
  **empty today**: its one population so far (the Contract v1 carriers'
  colour/size axes) emptied when #329 wired all six skins (closing #321),
  and the ledger's stale check is what forced the cleanup — an entry
  outliving its recipes would silently re-open the hole.

Carrier discovery is structural (the test greps component sources for
`WithVariantAxes`), so a new carrier cannot arrive unnoticed.

## 4. The manifest contract

Two different artifacts share the filename `manifest.json`, and they share
**only** the filename.

**Zero's anatomy manifest** — emitted at build by
`packages/zero/scripts/gen-manifest.mjs` into `dist/manifest.json`,
published as the `./manifest.json` subpath, governed by
`packages/zero-kit/schemas/manifest.schema.json`. It carries `$schema`,
`zeroVersion`, the `attributeSpec` (attribute names, flag form, the flag /
state / placement vocabularies, the synonym table, the variant axes, and the
layout family as `layoutPrefix` plus a `layoutVocabulary` of attribute →
permitted values and whether it varies per breakpoint), the
token grammar (`colors`, `categories`, recommended ramps), and `components`
— an **array** of `anatomy.toJSON()` snapshots, each part with its
`parent`, `states`, `flags`, `placements`, `layout`, `hiddenIn`, `pseudo`, hints, and
ready-made per-state selector fragments (what the recipe compiler
consumes), and — for a component whose API carries state — `models`: one
entry per model with what it binds (`name`, absent for the unnamed `model`
prop), its `concept`, its value `type`, the compound `member` that carries
it when not Root, `multiple` / `formControl`, and the two companion names
`default` and `change`, *derived* from the concept by the naming rule
(`default<N>` + `<n>Change`) rather than declared, so the manifest cannot
spell them differently from the components (a parity test holds the
sources to the anatomy; `mergeManifests` holds ecosystem fragments to the
same rule). There is no `manifestVersion`: a contract change ships a new
zero version and a new schema.

**A design system's artifact manifest** — emitted by `writeArtifacts` into
the package's `dist/manifest.json`, governed by
`packages/zero-kit/schemas/ds-manifest.schema.json`. Required keys:
`$schema`, `manifestVersion` (`const 1` — consumers hard-check the number
rather than sniffing keys), `zeroVersion` (the kit's own version; lockstep
makes them the same train), `name`, `themes`, `tokens` (roles, sizes,
variants, axes, modifiers, scopes, custom, breakpoints, system/systemDark,
and `properties` — every custom property the compiled tokens.css actually
emits, read back off the stylesheet so it cannot drift), and `components` —
a **record**, scope → the harvested `CompiledComponentAxes`
([§3.4](#34-harvest)), plus `api` when one is declared. The array/record
asymmetry is the cleanest one-line proof the two files are different
artifacts.

The DS manifest is **self-validated at write time**: `writeArtifacts`
JSON-round-trips the object and validates it against the schema with Ajv,
so a manifest the schema rejects fails the build that *produces* it, not
the app that reads it. Consumers use the exported TS types
(`DesignSystemManifest`, `DS_MANIFEST_VERSION`) rather than re-declaring
the shape — the drift that motivated this (playground, smoke spec and
contrast audit each carrying their own copy) is the recorded incident.

**Fragments** are how a scope zero doesn't ship enters a design system's
manifest: `{ version: 1, package, components }`, schema
`fragment.schema.json`, where `components` literally `$ref`s the anatomy
manifest's component shape — a fragment is zero's own component shape plus
ownership. `mergeManifests` enforces, in order: the version pin (a
pre-`hiddenIn` fragment used to slide straight through), the package
specifier grammar (it is interpolated into generated import statements),
scope and part-name grammar (the scope is also a filename and a selector),
selector-breakout characters, and then the shared vocabularies on the
ecosystem surface — flags against `FLAG_VOCABULARY`, states against
`STATE_NAMES` with synonyms in the message, placements, `hiddenIn ⊆
states`, and `parent` acyclicity. A scope collision is a hard error naming
the existing owner; every merged component is stamped with its owning
`package` (provenance), which survives compilation and drives the
register artifact's `Exclude`-form gate and the components module's import
specifiers.

## 5. The compiler and CSS architecture

**Four cascade layers, one statement.**
`LAYER_ORDER_STATEMENT` (`packages/zero-kit/src/contract.ts`):

```css
@layer zero.fallback, zero.tokens, zero.recipes, zero.structure;
```

It is declared in `packages/zero/css/base.css` **and** emitted atop every
compiled `tokens.css`, because the *first* mention of a layer fixes its
position: a design-system stylesheet parsed before base.css would otherwise
create `zero.tokens` first and leave the fallbacks above it. Restating the
order is idempotent; relying on load order is not. What each layer holds:

| Layer | Contents |
|---|---|
| `zero.fallback` | base.css only: design-system-neutral structural token defaults (radius/size/text ramps, durations, …) so an unstyled page is sane. |
| `zero.tokens` | Compiled design-system tokens: `:where(:root)` defaults, `@property`-adjacent blocks, theme blocks. |
| `zero.recipes` | All compiled recipe CSS, plus base.css's few structural necessities (summary marker removal, `cursor: not-allowed`). |
| `zero.structure` | One rule: `[data-scope][data-part][hidden]:not([hidden="until-found" i]) { display: none }`. |

`zero.structure` exists because `[hidden]` otherwise relies on the UA
sheet — the weakest declaration in the document — and all six design
systems shipped an unconditional `display: flex` that defeated it (#209: a
collapsed tree branch hid nothing, anywhere, for five PRs). A *later layer*
rather than higher specificity (compound selectors can reach (0,8,0)) and
never `!important` (which would also outrank the consumer's unlayered app
CSS — the consumer must always win). `hidden="until-found"` is exempt
because the UA gives it `content-visibility: hidden` for find-in-page.

**Specificity is designed, not accidental.** Root token defaults are
emitted as `:where(:root)` — (0,0,0) — so any `[data-theme="x"]` block at
(0,1,0) beats them regardless of source order, a nested `data-theme`
re-themes its subtree by inheritance, and unlayered app CSS beats
everything. Theme blocks are diff-only (only what diverges from `:root`),
with two deliberate exceptions restated per theme: scheme-divergent
non-colour props (or a `data-theme="light"` island under a system-dark root
would inherit the dark value), and tokens whose values *reference colour
properties* — `var()` in a custom property substitutes where **declared**,
not where used, so a `--shadow-md: … var(--color-primary)` declared only at
`:root` would capture `:root`'s primary forever ("a phosphor glow written
that way stayed green on an amber theme").

**`@property` registrations are per design system**, emitted above the
layers in each compiled tokens.css — every declared colour role (typed
`<color>`, so theme switches animate) plus declared customs carrying a
`syntax`. They cannot live in zero's base.css, which does not know the
declared role names; `-soft` is unregistered because its value can be
`color-mix()`, invalid as an `initial-value`.

**Reduced motion** collapses every *declared* duration key to `0.01ms` —
not `0ms`, because a zero duration suppresses the `transitionend` /
`animationend` events presence/exit coordination waits on. The block's
selector is `:root, [data-theme]` at (0,1,0), emitted last inside the
layer, so it ties-and-wins against every theme block — `:where(:root)`
would silently lose the moment a theme was selected. base.css carries the
same block for the recommended durations only. A validator warning flags
`transition` shorthands with literal durations (reduced motion can only
collapse `var(--duration-*)`); infinite loops are deliberately exempt from
the collapse-to-zero logic and handled by their own e2e
([§9](#9-the-verification-architecture)): a loop at ~0s strobes rather
than stops.

**The physical-direction lint** (`resolve/validate-recipes.ts`) warns on
physical properties that have logical twins (`left` → `inset-inline-start`,
`margin-left` → `margin-inline-start`, physical corner radii → logical
ones) — in part declarations, `@keyframes` bodies, and the raw `recipe.css`
escape hatch alike. Exemptions are reasoned, not silenced: parts that are
rotated/drawn, pure centring translations, and `--press-x` (a measured
pixel offset from the element's own left edge). Its known blind spot is
**`transform`**: `translateX(8px)` moves physically right under both
directions and has no logical spelling — which is exactly why the RTL e2e
measures rendered boxes; the lint reads declarations, the spec reads boxes,
and neither subsumes the other.

**Interpolation guards.** Every point where authored strings are spliced
into emitted CSS is validated, each with its motivating incident recorded
at the guard: `assertAxisToken` on axis names and values (a value carrying
`"` closes the attribute selector early — a seeded
`size: { 'x"], [data-part="panel': … }` emitted a second, unrelated
selector that styled every tab in any panel: selector injection, not a
typo); property-name grammar and a `CSS_BREAKOUT` check on declaration
values (`x;} [data-scope]{color` restyled every scoped element on the
page); pseudo-element projections; `@keyframes` names (a keyframes named
`none` would capture `animation: none`); theme names into
`[data-theme="…"]`; token keys; and fragment package specifiers (selector
injection *and* path traversal). The policy is a hard error rather than
escaping — a recipe that needs `content: '";"'` is asked to spell it
differently, because an escape hatch here is an injection surface.

## 6. The theme model

**The registry holds metadata, never values.**
`packages/zero/src/theme/registry.ts` stores names, colour-scheme,
light/dark pairing and an optional swatch; token *values* live in the
design system's compiled CSS. `ThemeSource` is typed structurally on
purpose: the kit's `TokensInput` is assignable to it, so every
`installThemes()` passes the whole declaration and the registry reads only
the keys it needs — zero never imports the kit, which is Node-only.

**Scheme and theme are different axes.** The colour scheme is the closed
CSS pair `'light' | 'dark'` (it maps onto `color-scheme` and
`prefers-color-scheme`, which have exactly those values); theme names are
open — `dim` is a *theme* whose scheme is dark, not a third scheme.
Selection is three-valued: an explicit theme name, or `null` = follow the
system. The system default needs **no JavaScript**: compiled CSS uses
`light-dark()` with `color-scheme: light dark` on `:root` (colour tokens
only — a non-colour token that differs between the default themes goes into
a `prefers-color-scheme: dark` block instead, because `light-dark()` is a
`<color>` function). The controller only manages *explicit* choices via the
`data-theme` attribute.

**`pickThemeFor` prefers declared defaults.** The registry stores each
source's `defaultLight`/`defaultDark` and prefers them (when registered
with the matching scheme) over first-registered — the latent bug only a
third theme exposes; zero-daisyui's five themes (`light`, `dark`, `dim`,
`nord`, `sunset`) are the shipped exercise. `toggle()` prefers a theme's
registered `pair`, else `pickThemeFor` of the opposite scheme.

**Name typing follows one rule: authoring is closed, anything that
round-trips through storage or the registry is open.** `setTheme` and the
provider props take the closed `ZeroThemeName` (narrowed by a register
artifact); `theme()`'s *return*, `getTheme`, `registerTheme` and the
storage boundary stay open — a persisted name may come from an older app
version or a runtime-registered tenant theme, so a closed type there would
be a lie.

**Controller and Provider are split, and the split has a known desync.**
`themeController()` is a lazily-created browser singleton (throws under
SSR); `ThemeProvider` creates a *separate* controller instance for its
subtree (and is the per-request answer on the server); `ThemeScope` is just
a `data-theme` island. Every client controller writes the same
`document.documentElement` attribute while holding its own signal state,
and nothing synchronizes the signals. Only the singleton registers for
`clearThemes()` notifications — so after a design-system swap, a
provider-created client controller keeps an explicit theme naming a
stylesheet that left. This is **known, documented at the registration site,
and deliberately unfixed**: per-request server controllers can never see
`clearThemes` (it throws on the server), and provider-created controllers
are owned by their provider. The playground works around it explicitly —
capture the theme before `clearThemes()`, re-apply after `installThemes()`
if the incoming system defines the same name.

**FOUC handling** is one line: `themeInitScript()` returns an inline IIFE
for `<head>` that reads the persisted explicit choice from `localStorage`
and stamps `data-theme` before first paint. The *system* preference needs
no script at all — that is `light-dark()`'s job.

## 7. The authoring surface

**Two runtime-facing entries, one Node surface.**
`@sigx/zero-kit` exports four subpaths: the Node-only barrel, `./build`,
`./plugin`, and `./define` — the one surface a design-system *source* may
import at runtime. `./define`'s module graph is `node:`-free **by
contract**: `ds-runtime-imports.test.ts` walks the graph and fails on the
first `node:` import, because the incident it encodes (a `defineApi` value
import dragging the kit's Node surface into a design system's runtime
graph) presented as a hung e2e suite, not as an error.

**`runStandardBuild` makes a design-system package's build script data.**
The pipeline — merge fragments → validate → throw before emitting anything
on failure → compile → build the coverage report → `writeArtifacts` — used
to be copied byte-identically across six `build.mjs` files; it now lives
once in `@sigx/zero-kit/build`, and a skin's `build.mjs` is ~15 lines of
declaration passing. The CLI (`sigx zero:build` / `zero:validate` /
`zero:audit`, aliased `build`/`validate`/`audit`, discovered through the
`"sigx-cli"` field) calls the same functions, so the CLI path and the
build.mjs path cannot drift.

**The audit is an artifact as well as a command.** After the compile,
`runStandardBuild` runs `auditDesignSystem` on it (opt-out `audit: false`),
logs every error-severity finding as a warning, and hands the result to
both writers: `writeArtifacts` emits it as `dist/audit.json`
(`schemas/audit.schema.json` — findings, waivers, summary, sorted severity →
rule → where; every skin exports it as `./audit.json`), and `buildReport`
takes it as a fifth input, carrying its counts under `report.audit` and
scoring them as the sixth criterion (`auditScore`: the issues formula
applied to findings, `info` never charged). `zero:validate --report` runs
the same audit for the report's sake, so the report it prints and the one
the build writes are one document — which is what lets a later
`--diff dist/report.json` compare like with like.

**Scaffolding is a `create-*` package, not a plugin command.** `init` was
declined (#10): a `sigx` plugin only loads where `@sigx/zero-kit` is already
installed, so it could never run in the empty directory a new design system
starts as, and `@sigx/cli`'s `create` has no template hook. `@sigx/create-zero-ds`
(`pnpm create @sigx/zero-ds <name> --brief <id>`, #401) sidesteps both: a
Node-only bin with no runtime dependencies, templates embedded at build time
(zero-basic's `recipes.ts` and `tokens.ts`, the six briefs, a `versions.json`
with the lockstep ranges — lockstep is what makes embedding and reading the
installed packages content-identical, and neither source file is reachable
through an `exports` map anyway). The generated package is the brief's tokens
and worked Button over **zero-basic's 50 recipes as the baseline**, composed
in `src/recipes.ts` through `fitRecipesToVocabulary` — the kit's one
non-`define*` export on `/define`, a pure function that keeps exactly what
the tokens declare (roles, the size ramp, the variant vocabulary, custom
axes, modifiers; dropped defaults and compounds follow) and redraws every
undeclared role or category step on the base surfaces or the category's
resting step. It is the identity for the recommended shape (all six skins
round-trip deep-equal), and the reason a `roles: {}` / `sizes: []` brief
compiles on its first build instead of erroring on every one of basic's
size blocks and role references. `eject` remains open (#11).

**Colour is derived before it is authored.** `derivePalette` /
`deriveThemePair` (`packages/zero-kit/src/palette.ts`, on `./define`) turn
seed hues into the exact token set `requiredColorTokens(roles)` names, with
every `<role>`/`<role>-content` pair solved to its floor (4.5:1; 7:1 for
`base-100`/`base-content`) and every value clamped into sRGB *before* the
validator ever sees it — the guarantee is measured on the formatted
`oklch()` string, so what the validator re-parses is what the solver
measured. The module carries no dependency: the `./define` graph may only
reach relative modules, so the oklch → linear-sRGB conversion is
hand-rolled on culori's own matrices and pinned to `wcagContrast` at 1e-6
by `palette.test.ts`. The validator remains the measurement of record;
derivation is the front door that makes its contrast check a formality.

**The generation skill** (`packages/zero-kit/skills/design-system/`, shipped
in the package) is the repo's graded asset: a model reads the anatomy
manifest, writes `tokens.ts` + `recipes.ts` against the token grammar, and
iterates against `zero:validate`. It travels with a **brief pack** (six
worked style briefs — `seeded` derives its whole palette through
`deriveThemePair` and is the pack's worked example of the `/define` runtime
import; `zero-brutalist` is the end-to-end regression test for the skill
itself) and the **conformance fixtures** — compiling
`TokensInput`/`RecipeInput` files for HeroUI, Material, Radix Themes, Ant
and Carbon, each proving a non-default axis surface.

**The conformance program** keeps the "any design system can be built on
this" claim honest with three artifacts split by lifetime: the grading
rules (frozen — `exact` / `renamed` / `reshaped` / `unsupported`, where
`renamed` means the same surface under a vendor name restored by the
generated `./components` module), the data
([`docs/design-system-conformance.md`](./design-system-conformance.md) —
**generated**, never hand-edited), and the proof (the fixtures and the
shipped packages). The matrix is emitted by
`formatConformanceMatrix` (`packages/zero-kit/src/resolve/conformance.ts`)
and pinned as a vitest file snapshot — `pnpm test -- conformance` fails on
drift and `--update` rewrites the doc — so a row and its declaring artifact
are the same object and cannot drift apart. Tier-3 rows are generated from
`buildReport` over the six in-repo systems; the same report ships as each
package's `dist/report.json` and behind `sigx zero:validate --report`:
components styled, axes wired per scope, declared-but-unwired values, the
axis-agnostic divergence partition, state coverage, and the minimum
contrast margin per theme — and, since `reportVersion: 2` (#408), a
**composite score** folded from those sections (`resolve/score.ts`): five
named criteria (components 25, vocabulary 15, states 20, contrast 25,
issues 15 — an `audit` sixth when `zero:audit` hands one in), each 0–100
with the counts it came from, weighted into a total and a letter grade.
The score is the scalar a generating agent iterates against, and three
properties are pinned rather than hoped: a declined axis costs nothing
(`declaredOut` axes and fill roles — `isFillRole` in `contract.ts`, the one
predicate the skins, the value-coverage guard and the score share, so #286
is a one-function change — leave the denominator), `skipStates` earns half
credit so the score cannot be raised by delegating everything, and the
weakest theme is the one graded. Per-scope `variant` wiring is not scored:
the `NO_VARIANT` ledger owns that decision. The six in-repo skins score
93–97 (A), pinned as floors in `report.test.ts`. What a change *did* is
the third question, answered by `diffReports` (`resolve/report-diff.ts`,
`sigx zero:validate --diff <report.json>`, #415): score and criterion
deltas, scopes newly styled or unstyled, values newly wired or unwired,
states newly covered or uncovered, and role pairs crossing a contrast
threshold — with a state moved into `skipStates` reported as skipped, never
as resolved, and a `reportVersion` mismatch refused rather than
approximated. And whether the loop is *converging* is the fourth, answered
by the iteration log (`resolve/iteration.ts` + `commands/iteration-log.ts`,
`ZERO_ITERATION_LOG=<path>` or `sigx zero:validate --log <path>`, #426):
opt-in, local, one JSON line per run — counts, score, the rules that fired
most, wall-clock — and a trend line printed beside each run, which is what
lets an edit to the skill be measured by the iterations it saves.
Automated vendor-doc
checking is out of scope by design — it rots, then gets muted; the dated
source column is the honest amount of process.

## 8. Ecosystem components

Zero's component set is closed; its authoring surface is not. The full
guide is [`docs/building-your-own-component.md`](./building-your-own-component.md);
the architecture facts, briefly:

- An ecosystem package is a **peer** of `@sigx/zero`, not a plugin into it:
  it declares a vendor-prefixed anatomy with `defineAnatomy`, builds the
  component from the same public behaviors zero's own components use, types
  it with `WithVariantAxesOpen`, and holds itself to the contract with
  `expectAnatomy`.
- It reaches design systems as **data**: a fragment
  (`{ version, package, components }`) plus an optional recipe pack written
  against the recommended token grammar, from an entry whose module graph
  stays free of component imports — a design system's Node build script
  imports it.
- **Discovery is a package.json field**, `"sigx-zero"`, shaped like the
  `"sigx-cli"` field the sigx CLI is itself discovered through: a
  package-relative path to that data entry, and an optional `requires`
  range. Every dependency declaring the field contributes its fragment and
  its recipe pack, **by default** — installing such a package is the opt-in,
  and `ecosystem: false` or `ZERO_ECOSYSTEM=0` is the way out. The field carries a *path* rather than an exports subpath
  because none of the resolver spellings work from the kit's position —
  `require.resolve('<pkg>/package.json')` is not exported,
  `require.resolve('<pkg>/fragment')` fails the `require` condition, and
  `import.meta.resolve` resolves against the kit rather than the consuming
  project (`packages/zero-kit/src/discover.ts` records the whole dead end).
  `ZERO_ECOSYSTEM=0` overrides any build.
- Discovery is **loud and ordered**. The CLI's plugin walk ends in
  `catch {}`; this one does not — a dependency that declares the field and
  then cannot deliver (unbuilt fragment, stale contract version, a scope
  another package already claims) is reported by name and skipped, because
  silence there means a design system ships without a component it believed
  it had covered. `strict: true` turns those back into build failures.
  Packs are adopted in package-name order, so CSS, manifest key order and
  report do not depend on dependency-declaration order. Explicit
  `fragments:` merge first and win a collision.
- **Composition is fit, then de-dup, then append.** A discovered pack's
  recipes are run through `fitRecipesToVocabulary` against the adopting
  design system's tokens, so a pack written to the recommended grammar
  compiles under a skin with no colour axis or a fused variant; the fit is
  the identity for a recommended vocabulary and is logged only when it is
  not. A pack may style only the scopes its own fragment declares — otherwise
  an installed dependency could restyle its host's `button`. Precedence is
  **de-dup, not ordering**: `compileDesignSystem` throws on a second recipe
  for one scope in either order, so a discovered recipe for a scope the
  design system already styles is dropped with a log line naming the loser,
  rather than shadowed. What remains is **appended**, because recipe order is
  the key order of `compiled.components` and therefore of `manifest.json`,
  `register.d.ts` and `report.json`.
- **The lynx target degrades for packs and fails for first parties.** The
  lynx emitter rejects references to `RUNTIME_PROPERTIES` (`var(--press-x)`
  and the rest of the web press-feedback surface). A first-party recipe in
  that position fails the build, as it should; a discovered pack's loses only
  the lynx target, recorded in `report.json` under `lynx.webOnly` — the
  design system's author neither wrote that recipe nor can fix it, and a
  scope with no lynx CSS is the documented unstyled-but-accessible fallback
  while a failed build is nothing.
- **api mode plus an adopted pack emits an import a consumer must resolve.**
  `components.d.ts` imports each external scope's component from the package
  that owns it, and that import ships. The build warns when the owning
  package is not a `dependency` or `peerDependency` of the design system — a
  warning rather than an error, because a monorepo building both
  (zero-heroui and the private zero-ext-example, here) is a legitimate
  instance of exactly that shape. zero-heroui is also where api mode and
  fragment mode are composed in a real build for the first time; the
  export-name convention they share broke once, unnoticed, precisely because
  nothing shipped that pairing.
- **The authoring side has a gate of its own.** `sigx zero:fragment`, run in
  a component package, emits `dist/fragment.json` and checks what would
  otherwise surface in an adopter's build: the `version` literal against
  `FRAGMENT_VERSION`, the schema, the merge, `"files"` coverage of the
  declared path, recipes confined to declared parts and scopes, the
  `componentExportName` root export, and a hostile-vocabulary probe (fitted
  to no colour roles and no size ramp, does the pack still compile — and
  still paint). It is the reason the `version` literal is safe to
  hand-write, and the reason the kit is a devDependency of every component
  package.
- **A diagnostic about someone else's recipe says so.** An adopted pack's
  recipes are compiled as the design system's own, which means its
  diagnostics are too. `ValidationIssue` carries a structured `scope`
  (`AuditFinding` and `LynxFinding` already do, or now do), and one
  annotation pass stamps `package` from the merged manifest's provenance, so
  every printed line and every written artifact can say which dependency to
  report against. `where` stays a display string — nothing parses it.
- **Provenance is in the emitted manifest.** `dist/manifest.json` carries an
  optional top-level `externalScopes` (scope → owning package), the same
  shape `CompiledDesignSystem` already tracks. Not a field on each
  component's axis entry: `componentAxes` holds what a recipe *wires*, and an
  owning package is not an axis fact. Additive and optional, so no
  `manifestVersion` bump; the lynx manifest carries it by construction, and
  the mechanical schema-parity gate requires the two descriptions to match
  exactly.
- **The app-side path closes the cross-repo loop.** A published design
  system ships prebuilt CSS and cannot depend on component packages that do
  not exist yet, so `sigx zero:extend` inverts it: the app depends on both,
  recompiles the installed design system's `./design-system` export against
  its own discovered packs, and keeps the difference — an add-on stylesheet
  of the added scopes only, and a **replacement** register module — a
  `.d.ts` with its `export {}` companion, the same pair a design system's own
  `/register` ships, so the specifier resolves at runtime rather than being a
  declaration nobody can import. Replacement rather than addition because
  `ZeroVocabulary.components` is a property declaration: two augmentations
  collide with TS2717, and since augmentations accumulate across a program
  the app must drop its `<ds>/register` import rather than keep both. That module is
  byte-identical to what the design system's own build would have emitted had
  it adopted the pack, which is why the swap is safe — and it is the file
  `type-tests/ecosystem/` already compiles. Resolving the design system's
  entry reads its `exports` map by hand, because `require.resolve` asks for
  the `require` condition an ESM package does not declare — the same dead end
  the `"sigx-zero"` field's path spelling avoids.
- **One resolve path, two callers.** `zero:build` reaches a design system
  through `runStandardBuild`, while `zero:validate` and `zero:audit` reach
  it through `commands/shared.ts`'s `loadInputs`. Both call
  `resolveEcosystem`. Wiring only one would make a build and a validate of
  the same directory disagree about which components exist — the spurious
  report diff `resolve/report-diff.ts` documents, made permanent.
- The **export-name convention** is load-bearing: the package's root export
  carries `componentExportName(scope)` (`ext-stepper` → `ExtStepper`),
  because an api-declaring design system's generated `./components` module
  imports exactly that name from exactly that package. The convention broke
  once, unnoticed, because api mode and fragment mode had never been
  composed — which is why the components-dts tests now assert it.
- The merge enforces the shared vocabularies at the boundary and stamps
  provenance; the generated register artifact excludes merged scopes **by
  name** from its `ZeroScope` gate rather than dropping the gate
  ([§3.5](#35-the-register-artifact), [§4](#4-the-manifest-contract)).
  `packages/zero-ext-example` + zero-basic's `build.mjs` is the shipped
  round trip, and `packages/zero/type-tests/ecosystem/` is its compile-time
  proof.
- A design system that never merges the fragment leaves the component
  **unstyled but accessible**. That fallback is the contract.

## 9. The verification architecture

The gates, as an inventory. The working law behind all of them: **a new
gate must be shown red first** — mutate the code until the gate must fail,
watch it fail, then trust it. A gate accepted on a green run has proven
only that it can pass. (In writing, this exists as the PR template's
red-→-green checkbox and as the recorded practice in nearly every guard's
docblock — several of which exist *because* a previous gate was green while
checking a fraction of what it claimed.)

| Gate | Where | What it proves |
|---|---|---|
| Unit suites | `packages/*/__tests__/`, vitest over **source** via aliases | Behaviors, SSR safety, per-component contracts, compiler semantics. |
| CSS goldens | `zero-kit/__tests__/css-golden.test.ts` | Byte-for-byte compiled CSS per skin: ordering, layering, specificity are the product. |
| Parity family (6) | `contract-parity`, `registry-parity`, `reserved-props-parity`, `schemas`, `llms-doc`, `type-test-paths` | Every deliberately duplicated surface (kit↔zero contract copies, manifest↔registry, api reserved props↔real Root props, schemas↔reality, llms.txt claims↔source, type-test paths↔package exports) is pinned from both sides. |
| Audit rules (in-kit) | `zero-kit/src/audit/rules/` via `auditDesignSystem`; the six skins through the thin callers `state-legibility.test.ts`, `button-affordance.test.ts`, `axis-value-coverage.test.ts`, `axis-coverage.test.ts`; `audit-api.test.ts` + `reduced-motion-loop.test.ts` hold every rule's red fixture | Every declared state is visually distinct (component / indicator / in-flow disclosure, honoring `hiddenIn` and per-part `skipStates`); every real `<button>` part resets `appearance`; no declared axis step goes unhonored by the recipes that claim it, and at most one claims the base; no styled scope accepts a declared `color`/`size` axis and wires nothing (ledgered, [§3.8](#38-the-ledgers)); every infinite animation stops under `prefers-reduced-motion` on the same selector; every padding, margin and gap rides the declared `--space-*` ramp rather than restating a number (`spacing/literal` where the number IS a step, `spacing/off-ramp` where it is on none). All read from **compiled CSS**, and — since #403 — reachable by a design system built outside this repo. |
| Audit command + artifact | `zero-kit/src/commands/audit.ts` (`sigx zero:audit`), `build.ts` → `dist/audit.json` + `report.audit`; `audit-cli.test.ts`, `audit-artifacts.test.ts`, `schemas.test.ts` (`audit.schema.json`, and the rule enum pinned to `AUDIT_RULES` in both schemas) | The exit-code contract (errors fail, `--strict` adds warnings, `info` never; `--json -` owns stdout; a non-compiling DS is refused in the validator's words); the build never fails on a finding but writes, summarises and scores every one; `zero:validate --report` and `dist/report.json` are the same document. |
| Type tests (6 isolated projects) | `packages/zero/type-tests/` — `open`, `augmented`, `generated`, `components`, `registered-components`, `ecosystem` | Each proves one narrowing regime in its own program (augmentation leaks program-wide, so isolation is the point): the unaugmented open fallback; a hand-written augmentation (a `.ts`, so `skipLibCheck` cannot skip it); the real emitted material golden; the emitted `components.d.ts` goldens with the vocabulary untouched, two design systems coexisting; **every scope's real prop surface** under the emitted zero-basic golden; and the ecosystem `Exclude`-gate round trip. |
| Register compile gate | `zero-kit/__tests__/register-dts-compile.test.ts` | Every skin's emitted `register.d.ts` compiles with `skipLibCheck: false` against a generated stub of `@sigx/zero`, so the artifact's self-assertions actually execute ([§3.5](#35-the-register-artifact)). |
| Typed-app capstone | `examples/typed-app` (CI, after build) | The consumer side: three isolated programs against **emitted `dist/`** through real package exports — register narrowing, the no-register components surface, and carbon's values remap. |
| Interaction e2e (22 specs) | `examples/playground/e2e/` — press-feedback, dialog, drawer, popover, tooltip, menu-submenu, context-menu, combobox, select, toast-presence, tabs, tree-view, slider, number-input, rating-group, carousel, diff | Real-browser contracts (chromium/firefox/webkit, plus reduced-motion and forced-colors projects), under the **locator law** (`e2e/demo.ts`): a part is located through a named root, never page-wide selectors or cross-demo positional indexing. |
| Static contrast matrix | `zero-kit/src/audit/contrast/` via the `contrast/*` audit rules; `contrast-static.test.ts` (the six skins at zero `contrast/*` errors and a named set of unmeasured reasons each; one red fixture per browser finding — #210, #116, #211, #207 — and one per `unmeasured` reason), `contrast-selector.test.ts`, `contrast-cascade.test.ts` | The browser contrast audit's two matrices computed from **compiled CSS**: the same cell product (ported, the indicator chains now derived from the part tree), a three-valued selector matcher for the emitted grammar, a computed-style model for what a reading depends on, the same compositing and floors. Every cell the reader cannot judge is `unmeasured` with a closed reason and reported as `info` — never a pass. Reachable by a design system built outside this repo. |
| Contrast audit | `e2e/contrast-audit.spec.ts` | Two matrices over every state combination × skin × theme: text legibility for text-bearing parts and indicator paint for parts whose job is paint, measured in their real ancestor chains (derived from the part tree); each skin's wired axis surface rides the text matrix; 3:1 hard floor, 2:1 for `disabled` measured pre-fade. The ground truth the static matrix answers to. |
| Contrast parity gate | `e2e/contrast-audit.spec.ts`, the parity block in every `contrast:` / `indicator contrast:` test, plus `reference media` | The static matrix against the browser matrix on every cell the static side CLAIMS: one cell product (the spec imports `textCells`/`axisCellsFor`/`indicatorCellsFor`/`cellKey` from the kit — a reading the static side does not list, or a claim the browser has no reading for, is a disagreement), painted-at-all agrees, ratios agree to `max(0.15, 2%)` (8-bit premultiplied canvas compositing of a translucent wash over a dark surface), floor verdicts agree except within tolerance of the floor (annotated). The measured share is pinned per skin from BOTH ends (`STATIC_COVERAGE`, +5 points of headroom): the estimate can neither retreat into `unmeasured` unnoticed nor quietly claim more. `reference media` holds the chromium project to `REFERENCE_MEDIA`. Its first run found three misreads in the estimate — `calc()` border widths read as zero, the UA stylesheet's `buttontext` on real form controls, and `color-mix()` inventing a hue for an achromatic endpoint — all fixed in the kit, never by bending the browser side. |
| DS smoke | `e2e/ds-smoke.spec.ts` | All six skins: `hidden` computes `display: none`, no undeclared axis/mod value renders, the runtime swap leaves one live stylesheet and re-seeds vocabulary + themes, boot logs no console error. |
| Reduced motion / RTL | `e2e/reduced-motion.spec.ts`, `e2e/rtl.spec.ts` | The two loops (Skeleton, Spinner) assert `animation-name` running under chromium **and** `none` under reduced-motion — both directions, or a never-animating recipe passes; RTL measures rendered boxes across all six skins, complementing the physical-direction lint's `transform` blind spot ([§5](#5-the-compiler-and-css-architecture)). |
| Axe audit | `e2e/axe-audit.spec.ts` | axe-core over every playground page, hard-failing serious/critical WCAG A/AA, with an **empty allowlist** (`axe-allowlist.json` — stale entries fail; a real bug gets fixed in `packages/zero`, never allowlisted). |
| Scaffold e2e | `create-zero-ds/__tests__/scaffold.test.ts`, `zero-kit/__tests__/fit.test.ts`, `scripts/verify-pack.js` | Every brief scaffolds in-process into a package that validates with **zero errors and zero warnings**, styles every scope and builds; `fitRecipesToVocabulary` is the identity for all six skins and fits basic's recipes to riso's tokens (counts pinned); verify-pack scaffolds riso and glass(lynx) from the **packed** tarballs and compiles + builds them, so the templates ship and the generated code holds against the published kit types. |
| CI ordering | `.github/workflows/ci.yml` | lint → catalog → typecheck → build → **type tests after build** (so unmapped subpaths cannot fall through to an absent `dist/`) → test; the e2e job adds playground typecheck + typed-app + Playwright. Bundle-size budgets run as their own workflow; `verify-pack` dry-runs publishing. |

## 10. Known limitations and open directions

Honesty section. These are the edges the tree knows about today:

- **`@sigx/runtime-core` blocks a full lib check.** Its shipped
  declarations fail `skipLibCheck: false` (a side-effect
  `import './jsx-types.d.ts'` rejected as TS2882), so every type-test
  project and typed-app program keeps `skipLibCheck: true` for
  *dependency* declarations, and the register compile gate runs against a
  generated stub instead of zero's real source. The flip to `false` the day
  core ships clean declarations is the whole remaining gap, and the
  tsconfigs say so in place.
- **The static contrast matrix is an estimate, and says so.** Its blind
  spots are a closed list rather than a silent default: interaction
  pseudo-classes are not measured (the resting render, as in the browser
  matrix), a gradient's extent and a `filter`'s effect are not modelled, a
  selector outside the emitted grammar (`:has()` on a node with children,
  `:nth-*()`, sibling combinators) is not evaluated, a condition outside
  `@media` (`@supports`, `@container`) is not decided, and nested same-scope
  instances are not built. Each surfaces as `unmeasured` with its reason;
  `@media` itself is decided against the fixed reference page the browser
  matrix runs in (`REFERENCE_MEDIA`, Playwright's Desktop Chrome);
  the browser matrix (`e2e/contrast-audit.spec.ts`) is the ground truth,
  and its parity gate ([§9](#9-the-verification-architecture)) holds the
  estimate to it on every cell it claims, with the measured share pinned per
  skin. What the browser draws and the static reader models are the same
  page, `REFERENCE_MEDIA` included; the UA stylesheet is modelled for the
  elements whose defaults paint (button, the form controls, `a`, `dialog`),
  and nothing else.
- **The dual-controller theme desync** ([§6](#6-the-theme-model)) is known
  and deliberately unfixed; consumers that swap design systems at runtime
  carry the playground's capture/re-apply pattern.
- **The component surface is finite.** Fifty-six components, skewed to
  primitives plus the content, navigation, layout and behavior tiers; there
  is no DatePicker and no data grid (Table ships the semantic anatomy, not
  sorting or virtualization). The ecosystem path
  ([§8](#8-ecosystem-components)) exists precisely so those need not enter
  zero's own inventory to be first-class.
- **Multi-target shipped its second target: lynx.** The multi-target RFC's
  groundwork (`--text-fixed-*` aliases, web-only runtime properties, the
  anatomy superset parts, the kit's core/emitter split) finally carried its
  building (#347/#350/#354/#356): `runStandardBuild({ targets: ['web',
  'lynx'] })` emits `dist/lynx/{tokens.css, components/<scope>.css,
  index.css, manifest.json}` beside the web artifacts. The lynx projection
  is class-grammar CSS (`zx-<scope>__<part>` compounds from
  `@sigx/zero/contract`'s `class-names.ts`, mirrored parity-tested in the
  kit) because lynx's engine has no attribute selectors, pseudo-classes or
  pseudo-elements; axis rules follow the runtime push-down contract (no
  combinators, no `:not()` default twins), colors bake to literals with
  culori (no `oklch()`/`color-mix()`/`light-dark()` there), and every
  declaration gets one of three capability verdicts — translate, drop with
  a `report.json` entry, or reject (the web-only `RUNTIME_PROPERTIES`).
  Recipes gained per-target sections (`RecipeInput.targets`, deep-merged by
  `resolveRecipeForTarget`) for the web-runtime declarations and lynx
  replacements; zero-basic and zero-daisyui compile both targets from one
  source. What remains aspirational is the *published* third-party SPI
  (#97's original shape) — targets are still in-tree modules under
  `zero-kit/src/targets/`.
- **Open contract directions, by issue:**
  [#280](https://github.com/signalxjs/zero/issues/280) (should overlay
  triggers show their overlay is open),
  [#286](https://github.com/signalxjs/zero/issues/286) (`tokens.roles` is
  both palette and colour vocabulary, so a token-only role reads as a
  declared axis value),
  [#197](https://github.com/signalxjs/zero/issues/197) /
  [#199](https://github.com/signalxjs/zero/issues/199) (ancestor-scoped
  axes, responsive axis values),
  [#11](https://github.com/signalxjs/zero/issues/11) (`eject`),
  [#17](https://github.com/signalxjs/zero/issues/17) (first publish — the
  standing deadline that made every breaking change above free).

## 11. History — the RFCs and where they went

Three RFCs proposed most of what [§2](#2-the-anatomy-contract)–[§7](#7-the-authoring-surface)
describe; a 2026-08 verification-and-contract campaign then moved the tree
past all of them, which is why they were deleted and this document written
in their place (#330). The full texts remain reachable in the git history of
`docs/rfcs/`.

| RFC | Proposed | Landed | Status |
|---|---|---|---|
| **0001 — Multi-target design systems** (#95, amendment #107; texts merged as #101, #108) | One authoring toolchain emitting per-target through a published SPI; Lynx as the pilot; a unified token contract | The platform-neutral groundwork only: the contract changes (#109 — `--text-fixed-*`, runtime properties declared web-only), the shared-anatomy changes (#110 — slider superset parts, dialog `backdrop`/`footer`), and the kit's split into a target-neutral core plus web emitters (#111) | **Implemented in-tree (#347/#350/#354/#356, 2026-08).** The lynx target emits class-grammar CSS with culori-baked literals through the same `runStandardBuild`; recipes carry per-target sections; zero-basic and zero-daisyui compile both targets from one source. Only the *published third-party* SPI shape of #97 remains open — targets are in-tree modules |
| **0002 — Typed design systems** (#127; revision #139 merged as #140) | Declared axis vocabularies, the `ZeroVocabulary` augmentation seam, the generated `register.d.ts`, per-category token typing, multi-theme | Phase by phase: declared vocabularies (#145), the seam and per-component narrowing (#150), the register artifact and `/register` subpaths (#151), wiring the then-unwired axes (#152, closing #103), daisyui multi-theme + `pickThemeFor` defaults (#153) | **Implemented**, then re-verified and hardened by the 2026-08 campaign (self-verifying artifacts, all-31 resolution — see below) |
| **0003 — Contract expressiveness** (#156) | `data-mod-*` modifiers, `sizes: []`, compound/default correctness, the conformance program, `zero-heroui`, vendor-named apis, per-scope vocabularies | Correctness fixes (#159 compound×default cross product, #161 `ThemeInput.components` removal, #163 token-name validation, #165 `sizes: []`); modifiers (#167); the coverage report (#178); the generated conformance matrix + fixtures (#184, #186); `zero-heroui` (#170, #192) and the playground reading the live vocabulary (#172); the api surface (#180/#181/#182, issue #179) and `zero-carbon` (#185, #193, issue #183); the variant survey ledger (#169, #293, issue #175); per-scope vocabularies as `tokens.scopes` (#296, issue #294) | **Implemented** — including both questions the RFC left open (the restriction unit is the scope; the fourteen unwired carriers became a ledger of recorded decisions) |
| **2026-08 campaign** (issues #316–#326, #321) | — (issues, not RFCs: the "the RFCs are archaeology now" work) | Real verification gates: all-31 type-test resolution, self-verifying register artifacts, 6/6 parity, CI ordering, the llms.txt pin (#320); compiler hygiene + `/define` + `/build` + per-scope api (#322); Contract v1: the part tree, `@scope` axis bounding, state/placement governance, axes on all 31, the versioned DS manifest (#323); runtime a11y consistency (#324); overlay e2e + axe + typed-app (#327); component completions (#328); skin axis wiring for the Contract v1 carriers (#329, closing #321) | **This is the tree §§2–9 describe** |
