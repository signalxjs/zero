# Changelog

## [Unreleased]

### Added

- **The `measure` token category, and the Container recipe** (#484).
  `SystemTokens.measure`, the `tokens.schema.json` entry (in both the system
  and the per-theme override blocks), and the `--measure-*` emission that
  follows from the category table. The brutalist brief is re-synced, since it
  excerpts the package's `system` and a test holds the two honest.

- **The layout pack covers Box** (#485). Its colour blocks are generated
  from the design system's own `axisRoles`, so a skin with no colour axis
  (heroui, carbon) gets no `variants` key at all rather than an empty block —
  dead CSS and an axis the register would type `never` for a reason nobody
  could read.

  `layoutScopes` is per-scope rather than uniform as a result: the four
  geometry scopes declare all three axes out of existence, Box declares only
  `sizes` and `variants`, because its colour is real.

- **The layout pack covers Grid and Center** (#478). Two more recipes and
  four more attributes on the step table (`cols`, `span`, `track`, `axis`).
  `cols` and `span` are computed rather than tabled — `repeat(N, minmax(0,
  1fr))` and `span N` — since a count has no token to resolve through.

  The table went from 154 rules to 266. Worth recording precisely, because
  the amortisation claim is about vocabulary rather than scope count: Center
  cost three rules, Grid cost 109, because `cols` and `span` are
  thirteen-value responsive attributes and so are 52 rows each. A scope that
  reuses attributes already tabled costs nothing.

- **The layout pack** (#473): `layoutRecipes`, `layoutCss`, `layoutScopes`
  and `LAYOUT_SCOPES`, exported from the barrel and from
  `@sigx/zero-kit/define`. Every design system gets the layout tier generated
  from its OWN spacing ramp and breakpoints rather than authoring it, because
  `gap="md"` has to mean the same rung in all of them — the skin chooses what
  `--space-md` IS, not what `md` MEANS.

  Emitted as two layers. `layoutCss` is a scope-agnostic **step table**
  (`[data-l-gap="md"] { --l-gap: var(--space-md) }`) emitted once per design
  system through `DesignSystemInput.css`; the recipes declare each property's
  default on the carrier and consume it. Putting the table in the recipes
  instead would multiply one design-system-wide fact by the number of layout
  scopes and again by the breakpoint tiers — measured at ~900 rules per skin
  against ~155 for the table, and it would have grown with every scope added.

  Declaring the defaults ON the carrier rather than as `var()` fallbacks is
  what stops a nested layout part inheriting its parent's spacing, and what
  keeps the lynx target free of dangling vars (the table is not emitted
  there, so those references resolve to the declared default and lynx renders
  a flex row with no gap rather than nothing). It also means the table has to
  out-specify the carrier, hence the `[data-scope][data-part]` prefix.

  `layoutScopes` is the second half of adoption: `axis-coverage` walks every
  scope that has a recipe, so a layout scope raises a `color` and a `size`
  finding per skin until it declares them out of existence.

- **The layout attribute family, kit side** (#471). `contract.ts` mirrors
  `LAYOUT_ATTR_PREFIX`, `LAYOUT_VOCABULARY`, `SPACE_STEPS`, `layoutAttrSpec`
  and `parseLayoutAttr` from `@sigx/zero/contract`, held by
  `contract-parity.test.ts` — by value for the vocabulary, and behaviorally
  for the two functions, swept over every name both copies can render.
  `ManifestPart.layout` carries a part's declared subset, the manifest schema
  declares `attributeSpec.layoutPrefix` / `attributeSpec.layoutVocabulary`
  and `part.layout`, and `mergeManifests` holds an ecosystem fragment's
  layout attributes to the vocabulary the way it already does flags, states
  and placements.
- **Lynx: layout selectors project onto the class grammar.**
  `&[data-l-gap="md"]` now emits `.zx-l-gap-md` instead of being dropped as
  an inexpressible selector — without this branch the `zx-l-` grammar would
  be dead code and the layout tier would render entirely unstyled on lynx. A
  per-breakpoint selector is still dropped, but now says so ("responsive
  styling is runtime JS on lynx") rather than reporting an unknown selector.

### Changed

- **Class grammar version 2** (`targets/lynx/class-names.ts`), adding
  `layoutClass`. `lynx-manifest.schema.json` pins `classGrammarVersion` to
  `2`, so a runtime refuses a stylesheet emitted under version 1 — an
  external coordination item with `@sigx/lynx-zero`.

- **The manifest's `models` block** (#451). `ManifestComponent.models` /
  `ManifestModel` type the entries zero's anatomies now emit; the manifest
  schema declares `$defs/model` (`concept`, `type`, `default`, `change`
  required; `name`, `member`, `multiple`, `formControl` optional; closed);
  `mergeManifests` holds an ecosystem fragment's models to the naming rule
  (`default<Concept>` + `<concept>Change`, a named model's concept its name,
  a camelCase concept, a non-empty type), failing by name.
  It holds the block to the schema's shape as well (#453): no empty
  `models`, a camelCase `name`, a PascalCase `member`, and `multiple` /
  `formControl` presence-only `true`, no unknown key — so a merged manifest never fails
  validation downstream.

### Fixed

- **`color-mix()` toward an achromatic colour invented a hue** (#403,
  slice D). CSS Color 4 §12.3: a MISSING component — black's hue in oklch,
  any grey's, `transparent`'s — is carried over from the other colour before
  interpolating. culori marks it `undefined` and, left alone, drifted the
  hue: `color-mix(in oklch, #0087a0 86%, black)` baked to `#00716a` where
  Chrome paints `#006d82`. `carryMissingComponents` (internal to the baker) now runs
  before the premultiplied mix in the shared baker, so the static contrast
  matrix reads what the browser paints — **and the lynx artifacts of every
  recipe that mixes toward black/white/grey in a polar space change to the
  colour the web has always shown** (zero-basic's and zero-material's
  pressed `solid` buttons, among others). Found by the browser parity gate.
- **The static contrast matrix read a `calc()` border width as zero** and
  called the spinner's ring, the carousel dot and the status/timeline marks
  unpainted where the browser painted them at 6:1. Border widths are now
  evaluated as lengths on the reference page (`px`, `rem`/`em` at 16px,
  `calc()` folded innermost-first); a width the reader cannot evaluate
  (`%`, `max()`) is `unmeasured: unknown-geometry`, never "no border".
- **The static contrast matrix ignored the user agent stylesheet.** A real
  `<button>` that no recipe colours renders `buttontext` (black on a light
  scheme, white on dark), not its parent's ink — the browser chain builds
  real elements, and steps/item measured 20:1 there against the reader's
  inherited 14.9:1. `uaDefaults(element, scheme)` (internal to the cascade) seeds Chromium's
  colour, background and border for `button`, `input`/`textarea`/`select`,
  `a` and `dialog` below every author declaration.

- **A fresh scaffold clears `sigx zero:audit`** (#422). The audit became an
  artifact (#403) and immediately found three things the brief pack had been
  getting away with. (1) The five default-shape briefs wired Button's `size`
  axis as `sm|md|lg` over a baseline that paints `xs…xl` on every sibling —
  the ramp-with-a-hole `axis-value-coverage/gap` refuses; they wire the whole
  ramp now. (2) Three briefs spent a role the recommended recipes use as INK
  — outline/soft/ghost text, the radio dot, the rating fill — at a lightness
  no page surface can carry (brutalist's amber at 80%, glass's warning at
  78%, terminal's paper warning at 52%); the values moved, hue kept.
  (3) `fitRecipesToVocabulary` under a fused `variant` vocabulary left
  basic's badge and select wiring the one value the two vocabularies shared,
  which is the same hole one axis over; a block that no longer covers its
  scope's vocabulary is now dropped whole (`droppedVariantBlocks`), and a
  scope narrowing from `tokens.scopes` is the vocabulary that counts (daisyui's
  tabs `border|lift|box` survive). `packages/create-zero-ds`'s scaffold
  suite asserts zero audit errors for every brief beside its zero
  validation errors, so the pack cannot regress into any of the three.
- **`derivePalette` has an ink floor, and a dark neutral is light** (#422).
  Every role is now solved to ≥ 3:1 (`floors.ink`) against `base-200` AND
  against its own soft surface, derived the way the compiler does
  (`color-mix(in oklab, role softMix, base-100)` — `softMix` is a new option,
  `deriveThemePair` passes its own through). A preset warning at 0.65 lands
  near 0.6 in light. The dark preset's `neutral` was 0.33 on a 0.19 surface —
  1.5:1, an invisible ink — and is 0.80.

### Added

- **Ecosystem components are discovered, not hand-wired: the `"sigx-zero"`
  package.json field** (#449). A component package — one shipping a component
  zero itself does not — declares `"sigx-zero": { "fragment":
  "./dist/fragment.js", "requires": ">=0.2.0" }`, and a design system adopts
  every dependency that declares one — `ecosystem: true` on
  `runStandardBuild`, or `--ecosystem` on
  `zero:build` / `zero:validate` / `zero:audit`. Adoption used to be two
  hand-edits in a `build.mjs` (merge the fragment *and* spread the recipes),
  which is one edit per skin per component package, and a release-order
  problem waiting for the first cross-repo consumer.

  **Off by default** for now: turning it on changes what an unchanged design
  system emits, because a package devDepended for tests would begin shipping
  its scopes and moving the report score. `ZERO_ECOSYSTEM=0` disables it for
  a single run whatever the build asks for.

  The field carries a package-relative **path**, like `"sigx-cli".plugin`,
  and not an exports subpath — every tidier spelling is a dead end from the
  kit's position: `require.resolve('<pkg>/package.json')` throws
  `ERR_PACKAGE_PATH_NOT_EXPORTED`, `require.resolve('<pkg>/fragment')` fails
  the CJS `require` condition, and `import.meta.resolve` resolves against
  the kit's own module, which under pnpm's isolated store cannot see the
  consuming project's graph at all. The loader treats the path as hostile
  input the way `mergeManifests` already treats fragment content: absolute
  paths and anything escaping the package directory are refused.

  Three properties worth relying on. Discovery is **loud** — unlike the sigx
  CLI's plugin walk, which ends in `catch {}`, a dependency that declares the
  field and then cannot deliver is reported by name and skipped, never
  swallowed, because silence means a design system ships without a component
  it believed it had covered (`strict: true` makes it fatal). It is
  **ordered** — packs are adopted in package-name order, so CSS, manifest key
  order and the report do not depend on how dependencies happen to be written
  down. And it runs on **one path with two callers**: `runStandardBuild` and
  the CLI's `loadInputs` both call `resolveEcosystem`, so a build and a
  validate of the same directory can never disagree about which components
  exist.

  `include` is a mode rather than a filter (it means *only* these), passing it
  with `exclude` is an error, and naming a package that is not a dependency is
  an error in either list — a typo'd exclusion that silently does nothing is
  how "we disabled that pack" survives as a belief. The same rule reaches the
  flag boundary: `--ecosystem-exclude` without `--ecosystem` is refused rather
  than quietly excluding packages from a discovery that never runs. (Narrowing
  is otherwise programmatic — the CLI surfaces only the exclusion half.)

- **`spacing/literal` and `spacing/off-ramp` — the ramp is the vocabulary,
  and a number is not** (#469). Two audit rules, and every skin put on the
  ramp in the same change so they land green.

  The point is a mechanism, not tidiness. Because a recipe writes
  `var(--space-md)` rather than `0.5rem`, an app gets a density mode with no
  help from zero: `[data-density="compact"] { --space-md: 0.375rem }`
  inherits, beats the design system's `:where(:root)` (app CSS is unlayered),
  needs no JS, and survives a design-system swap. Every literal is inert
  under that switch, so a hardcoded padding is a hole in a mechanism.

  The leak was structural. `size` variants were spelled as spacing literals —
  `padding: '0.25rem 0.5rem'`, where `0.25rem` IS `--space-xs` — so the size
  axis and the spacing ramp were two uncoordinated systems doing the same
  job. Elsewhere values sat on no step at all (`0.0625rem`, `0.875rem`):
  numbers no reader could trace to a token.

  `spacing/off-ramp` is an **error** (untraceable *and* inert);
  `spacing/literal` is a **warning** (renders correctly, only costs density).
  Three spellings are exempt because the naive rule gets them wrong: `em`
  lengths are spacing that tracks TYPE rather than the ramp; anything inside
  parentheses is arithmetic, so `calc(var(--space-lg) - 2px)` already rides
  it, and only top-level components of a value are judged; `0` needs no
  token.

  All six skins are clean. 50 off-ramp errors and 60 literal warnings fixed —
  the literal ones pixel-identical by construction, the off-ramp ones snapped
  to a step and each rendered change recorded. zero-carbon's slider was the
  interesting case: its off-ramp margins were not spacing at all but geometry
  centring a thumb over a rail, so they became arithmetic over named
  component tokens (`--slider-thumb-size`) instead of being snapped — the
  same pixels, and honest about what they are.

  One authoring rule fell out, found by `zero:fragment`'s hostile-vocabulary
  probe rather than by reasoning: a **recipe pack** writes
  `var(--space-md, 0.5rem)` where a design system's own recipes may write
  `var(--space-md)`. `system.spacing` is optional; a design system that omits
  it emits no `--space-*`, and while web resolves the reference from
  `@layer zero.fallback`, lynx has no such layer and drops the declaration
  entirely.

- **`sigx zero:extend` — adopt ecosystem packs against an already-published
  design system** (#465). The piece that makes the protocol work across
  repositories. A design system ships as prebuilt CSS and can never devDepend
  on every component package that might exist; the app depends on both, and
  is the only place that knows which packs are present. So the app recompiles
  the installed design system's new `./design-system` export against its own
  discovered packs.

  Two artifacts. `zero-extend.css` carries the added scopes and nothing else
  — never the design system's own, and never a re-emitted `tokens.css`, which
  would duplicate its `@property` registrations; each scope's rules are
  self-layered, so import order does not matter. `zero-extend.js` and its
  `.d.ts` are a **replacement** register module — the same pair a design
  system's own `/register` ships, the declaration doing the work and the
  runtime file existing so the specifier resolves.
  `ZeroVocabulary.components` is a property declaration, so two modules
  augmenting it collide with TS2717 and there is no additive form: the app
  imports this one and **removes** its `<ds>/register` import, since
  augmentations accumulate across a program rather than replacing one
  another.

  That replacement is safe for a reason worth recording: the emitted module
  is byte-identical to what the design system's own build emits when it
  adopts the same pack — verified against
  `packages/zero/type-tests/ecosystem/basic-ext.register.d.ts`, which
  `pnpm test:types` already compiles in an isolated project.

  All six design systems gain a `"./design-system"` export (their barrels
  always re-exported `designSystem`, but no exports map reached it, so it
  worked only by accident through the root). Resolving that subpath reads the
  exports map by hand: `createRequire().resolve()` asks for the `require`
  condition an ESM package never declares — the same dead end that makes the
  `"sigx-zero"` field carry a path, walked into once here before being fixed.

  The command refuses a `zeroVersion` mismatch between the installed design
  system and the app's kit, since recompiling across a contract version
  produces CSS the design system's own artifacts disagree with.

- **Ecosystem discovery is on by default, and two skins now adopt through
  it** (#464). Installing a package that declares `"sigx-zero"` is the opt-in;
  `ecosystem: false` on `runStandardBuild` or `ZERO_ECOSYSTEM=0` for one run
  is the way out.

  **What changes for an existing design system.** A package devDepended for
  tests now ships its scopes: new `dist/css/components/<scope>.css`, new
  entries in `manifest.json`, `register.d.ts` and `report.json`, and its
  findings folded into the audit — where the score is
  `100 − 10·errors − 2·warnings`, so a third party's recipe can move your
  grade, and a `zero:audit --strict` CI can start failing on a transitive
  dependency. Every one of those findings names the package it came from
  (#460).

  `zero-basic` drops the two hand-edits it used to carry (spread the pack,
  pass the fragment) — the devDependency now implies both, and its emitted
  `register.d.ts` is byte-identical to the golden, which is what the append
  decision in #457 was for. `zero-heroui` adopts the same pack, and is the
  more interesting proof: it declares `roles: {}`, so the fit drops 8 colour
  values and rewrites 6 role references, and it declares an `api`, so this is
  the first real build composing api mode with fragment mode — the pairing
  whose export-name convention broke once unnoticed because nothing shipped
  it.

  That pairing also surfaced a rule worth stating: an api-declaring design
  system emits `import { … } from '<owning package>'` into its
  `components.d.ts`, and that import ships. The build now warns when the
  owning package is not a `dependency` or `peerDependency` — a warning, not
  an error, because a monorepo building both (exactly what zero-heroui and
  the private zero-ext-example are) is a legitimate instance of the shape.

  And a pack a design system already merged by hand is now skipped quietly
  rather than reported as a scope collision: mid-migration, a `fragments:`
  entry for a package you also depend on is not a conflict with itself.

  `register-dts.test.ts` builds its golden through `resolveEcosystem` instead
  of re-performing the composition by hand — otherwise the golden could stay
  green while the shipped build emitted something else, which is the failure
  its own docblock warns about.

- **`sigx zero:fragment` — the authoring-side gate for a component package**
  (#463). Everything else in the kit is the adopting side; the authoring side
  had none, so every way a fragment can be wrong was discovered in a
  stranger's build. Run in the package, it emits `dist/fragment.json` and
  checks: the `version` literal against `FRAGMENT_VERSION` (which is what
  makes hand-writing it safe — importing the constant would drag the kit into
  the data entry's runtime graph); the JSON schema; `mergeManifests` against
  the installed `@sigx/zero`; that the declared path is inside `"files"`
  (present locally, missing for every consumer, is the failure an author
  cannot see from their own checkout); that recipes style only parts and
  scopes the fragment declares; that the package root exports
  `componentExportName(scope)`, the convention an api-declaring adopter's
  generated `./components` module depends on and which
  `docs/architecture.md` records as having broken once unnoticed; and a
  hostile-vocabulary probe — the pack fitted to a design system with no
  colour roles and no size ramp still compiles, and still *paints*. That last
  one needs a real check rather than a `trim()`: a recipe whose every rule was
  fitted away still emits its `@layer zero.recipes { }` wrapper.

  Warnings rather than errors for an unprefixed scope (what counts as a vendor
  is not checkable, and zero itself promoted `steps` out of this pattern; the
  collision it invites later IS an error) and for a pack that is not
  lynx-clean (that costs adopters one target, not the build).

  Registered with **no bare alias** — `fragment` is a word other plugins may
  want, and the CLI resolves alias collisions last-plugin-wins. `detect`
  widens to accept a package declaring `"sigx-zero"`, since a component
  package may depend on `@sigx/zero` alone and never on the kit.

  This replaces the ~15-line `emit-fragment.mjs` every author would otherwise
  rewrite (`zero-ext-example`'s is deleted and its build now calls the
  command), and accepts one cost worth stating: **`@sigx/zero-kit` becomes a
  devDependency of every component package.**

- **Diagnostics name the ecosystem package they are about, and the emitted
  manifest records who owns what** (#460). A design system that adopts a pack
  compiles its recipes as its own — including into its diagnostics. So a
  warning about someone else's recipe used to read exactly like a warning
  about the author's, with nothing saying whose it was or where to report it.
  `ValidationIssue` now carries a structured `scope` (set once in the recipe
  loop, where every per-scope finding originates), `AuditFinding` and
  `LynxFinding` carry `package`, and one annotation pass fills it from the
  merged manifest's provenance. Printed lines read
  `recipes.acme-stepper (from @acme/zero-stepper)`; a first-party scope stays
  unannotated, which is what makes the annotation mean something. `where`
  stays a display string throughout — nothing parses it.

  `dist/manifest.json` gains an optional top-level `externalScopes`
  (scope → owning package). Previously provenance reached `register.d.ts` as
  comments and an `Exclude<>` gate and stopped there, so a consumer reading
  the manifest could not tell which scopes were foreign. A top-level key
  rather than a field on each component's axis entry: `componentAxes` holds
  what a recipe *wires*, and an owning package is not an axis fact. Additive
  and optional, so no `manifestVersion` bump. The lynx manifest carries it by
  construction — and the mechanical schema-parity gate promptly required the
  two descriptions to match to the character, which is the gate working.

- **An adopted pack's recipes are composed, fitted and de-duplicated** (#457).
  Discovery merged a fragment and left its recipes on the shelf; a scope
  arrived styled by nobody. Now each pack's recipes are run through
  `fitRecipesToVocabulary` against the adopting design system's tokens — so a
  pack written to the recommended grammar compiles under a skin with no
  colour axis, a fused variant or its own size ramp — and folded in. The fit
  is the identity for a recommended vocabulary and is logged only when it
  actually changed something.

  **Precedence is de-dup, not ordering.** The obvious design — spread the
  pack's recipes first so the design system's own wins — cannot work:
  `compileDesignSystem` throws on a second recipe for one scope in *either*
  order, so "I like the pack but my stepper is square" would have failed the
  build with a message naming neither package. A discovered recipe for a
  scope the design system already styles is dropped, and the log says who
  lost. What remains is **appended**, because recipe order is the key order
  of `compiled.components` and therefore of `manifest.json`, `register.d.ts`
  and `report.json` — prepending would churn all three for no cascade
  benefit, since selectors for different scopes cannot collide.

  A pack may style only the scopes its own fragment declares. Shipping a
  recipe for `button` would let an installed dependency restyle its host's
  own components; the pack is refused by name, and refused *before* its
  fragment is merged — dropping only its recipes would leave its scopes in
  the manifest styled by nobody.

  **The lynx target degrades for packs and still fails for first parties.**
  The lynx emitter rejects references to `RUNTIME_PROPERTIES` (`var(--press-x)`
  and the rest of zero's web press-feedback surface), which a perfectly
  reasonable pack can carry. A first-party recipe in that position keeps
  failing the build; a discovered pack's now loses only the lynx target and
  is recorded in `report.json` under a new optional `lynx.webOnly`. The
  design system's author neither wrote that recipe nor can fix it, and a
  scope with no lynx CSS is the documented unstyled-but-accessible fallback
  while a failed build is nothing.

  The degradation is gated on a **type**, not a message: the lynx emitter's
  three runtime-property refusals now throw `LynxRuntimePropertyError`, and
  only that class degrades. Every other lynx rejection — an unknown state, a
  scope mismatch — keeps failing the build, whoever wrote the recipe, rather
  than being filed under `webOnly` as something it is not.

  `resolveEcosystem` returns a `contributed` map (scope → the package whose
  recipe styles it) so callers that must treat pack recipes differently do
  not have to infer ownership from the fragments. The two differ exactly
  where it matters: when a design system writes its own recipe for a
  pack-declared scope, the pack's is dropped, and the authored one has to
  keep failing the lynx build rather than being degraded on the pack's
  behalf. `fitRecipes` (on `/define`) returns the fitted recipes and the
  `FitReport` from one walk, which composition needs for every pack.

  Also corrects `audit/context.ts`, which claimed its first-recipe-wins map
  matched `compileDesignSystem`'s behaviour. It never did — the compiler
  throws — and two derivations of "what happens on a duplicate", one of them
  false, is exactly the drift this feature exercises.

- **`sigx zero:validate --log <path>` / `ZERO_ITERATION_LOG=<path>` — an
  iteration log for the generate → validate → fix loop** (#426). Opt-in,
  local, append-only JSONL: every run appends one line (timestamp, error and
  warning counts, score and grade when the design system compiled, the five
  rules that fired most — `ValidationIssue.rule` or the first two segments
  of `where` — and wall-clock) and prints its trend line, each count beside
  the run before (`iteration 7 — errors 0 (was 3), warnings 3 (was 14),
  score 92 → A (was 71 C); top: contrast-floor ×2`). The flag wins over the
  environment; there is no bare `--log` (#177). `resolve/iteration.ts`
  (`iterationEntryFrom`, `formatIterationLog`, `whereFamily`, pure) and
  `commands/iteration-log.ts` (append with parents, tolerant read — a line a
  killed run left half-written is skipped). The scaffold's `.gitignore`
  carries `.zero-iterations.jsonl`, and the skill's step 6 sets the variable
  before the first run.

- **The browser parity gate for the static contrast matrix** (#403, slice D
  — the last one). `examples/playground/e2e/contrast-audit.spec.ts` imports
  the cell product from the kit (`textCells`, `axisCellsFor`,
  `indicatorCellsFor`, `cellKey`, `INDICATORS`, `uncoveredPaintParts`) —
  its own copies and the hand-listed indicator chains are gone — and every
  `contrast:` / `indicator contrast:` test now runs `auditDesignSystem`
  Node-side from the skin's built `dist/design-system.js` and holds every
  cell the static side CLAIMS to the browser's reading under the same key:
  same cell product, same painted-at-all, ratios within `max(0.15, 2%)`,
  same floor verdict (annotated when the browser sits within tolerance of
  the floor). The measured share is pinned per skin from both ends
  (`STATIC_COVERAGE`). A `reference media` test holds the chromium project
  to `REFERENCE_MEDIA`, now exported with `evaluateMedia`. First run: 244
  disagreements, all three classes above plus the text probe's missing
  transition kill; final run: 0 across 12,996 claimed cells.

- **`sigx zero:validate --diff <report.json>` — what moved between two
  coverage reports** (#415). `diffReports(prev, next)` and
  `formatReportDiff(diff)` in `resolve/report-diff.ts` (pure, exported from
  the barrel) compare two `reportVersion: 2` documents: the score and each
  criterion's delta, scopes newly styled or unstyled, `axis:value` keys newly
  wired or unwired, `scope.part.state` keys newly covered or uncovered over
  the scopes styled in both, declared role pairs crossing the 4.5:1 or 3:1
  thresholds in either direction (the most severe crossing when a pair falls
  through both), and the validation counts when both reports carry them. A
  state moved into `skipStates` is reported as newly *skipped*, never as
  resolved — the half-credit stance the score takes, kept so a waiver cannot
  read as progress. A `reportVersion` mismatch throws naming both versions.
  The flag is a required-value flag (`@sigx/args` has no optional form, #177);
  `zero:build` writes `dist/report.json` every run, so
  `--diff dist/report.json` compares against the last build. The diff prints
  after the report and before the verdict, stays silent under
  `--report-json -`, and an unreadable path fails the run naming it.

- **A misspelled CSS property is now an error** (#51). `validate-recipes`
  checks every declaration key against a checked-in list of the property
  names the CSS specifications define (`src/resolve/css-properties.ts`,
  generated from a pinned `@webref/css` by `scripts/gen-css-properties.mjs`;
  `__tests__/css-properties.test.ts` regenerates and compares, so a stale
  list fails rather than drifts). A key within two edits of a real property
  (`paddding`, `border-radus`) is an **error** carrying `rule:
  'css-property'` and `suggest: { token, value }` — the browser drops such a
  declaration silently, which is why nothing else in the pipeline could ever
  say. A key near nothing is a **warning**: new CSS must pass, a typo of
  something exotic must not render unnoticed. Keyframes bodies are read
  too (a keyframe block holds nothing but declarations); the raw `css` hatch
  is not — it exists to hold `@font-face`/`@property`/`@counter-style`
  blocks whose descriptors (`src`, `syntax`, `symbols`) are not properties.
  Custom properties and vendor-prefixed spellings (`WebkitAppearance`,
  `MsOverflowStyle` — the capital is what opens the emitted name with the
  hyphen; a lowercase-led `msOverflowStyle` emits `ms-overflow-style`, which
  nothing reads, and is an error naming the fix) are never questioned, and
  a key under four characters
  only ever warns: the SVG geometry properties (`r`, `x`, `cx`) sit two
  edits from any short typo. The Levenshtein helper the token vocabulary's "did you mean"
  used moved to `src/resolve/nearest.ts` so both rules share it; the hints
  are byte-identical. All six skins, the ecosystem recipe pack and the six
  briefs produce no new issue.

- **A derived brief: `seeded`** (#414). The sixth file in
  `skills/design-system/briefs/` writes no colour: its `themes` block is
  one `deriveThemePair` call over two seed hues (indigo primary, coral
  accent), the worked example both of the palette derivation below and of
  the one runtime import a `tokens.ts` may make from the kit
  (`@sigx/zero-kit/define`). The skill's step 3 now leads with derivation —
  seed the hues that carry the brief, hand-author only a locked value — and
  the brief pack, cheat-sheet table, `briefs/README.md` and the scaffold's
  `--brief` choices carry the new entry.
- **`sigx zero:audit`, `dist/audit.json`, `report.audit`** (#403, slice B).
  The audit is now a command and an artifact, not only an API. The command
  is where the exit code lives: error findings fail it, `--strict` fails on
  warning findings too, `info` never fails; `--rule <id>` (repeatable) runs
  a subset, `--json <path>` writes the artifact (`-` for stdout, which then
  carries nothing else). A design system that fails to compile is refused
  in the validator's words rather than a compiler stack. `runStandardBuild`
  runs the audit after the compile (opt-out `audit: false`), logs every
  error-severity finding as a warning, writes `dist/audit.json`
  (`schemas/audit.schema.json`, `auditVersion: 1`; every skin exports
  `./audit.json`) and hands the result to `buildReport`, which gained a
  fifth parameter: the counts land in `report.json` under `audit` and
  score as the sixth criterion (`auditScore` — `100 − 10·errors −
  2·warnings`, `info` never charged; `computeScore`'s `extras.audit` now
  takes the counts as well as a number). `zero:validate --report` runs the
  audit for the report's sake too, so the report it prints and the one the
  build writes are the same document. The build never fails on a finding.
  Red-first: the `FAILED audit` exit, the stdout purity of `--json -`, the
  presence of `audit.json` and of the `audit` criterion were each watched
  failing before the code that satisfies them existed.

- **`variants: []` declares the variant axis out of existence** (#200,
  #295). The claim `sizes: []` makes about size and `roles: {}` about
  colour, now available for the third named axis: the validator accepts the
  empty list (it used to error "declared but empty"), every recipe keying
  `variants.variant` errors with "declares no variant axis (tokens.variants
  is empty)", the coverage report lists `variant` under `declaredOut` (and
  the score charges nothing for it), and `register.d.ts` emits
  `variant: never` with the declared-out reason ("declares no variant axis
  at all") instead of the unwired one — `variant: never` can finally say
  which of its two meanings it has. An *omitted* `variants` still means
  "declared nothing, check nothing"; since `variant` has no recommended
  default, both spellings compile to an empty list, and the compiled form
  and the DS manifest gain `tokens.variantsDeclared: boolean` to keep them
  apart (`ds-manifest.schema.json` and its lynx mirror require it;
  `report.schema.json`'s `declaredOut` enum gains `variant`). A custom axis
  in `tokens.axes` still cannot be declared away — `[]` there stays an
  error, there being no named prop to switch off.
- **The static contrast matrix — `contrast/text`, `contrast/indicator`,
  `contrast/unmeasured`** (#403, slice C; closes #118). The browser contrast
  audit (`e2e/contrast-audit.spec.ts`) ran its two matrices over the six
  in-repo skins on every PR, and a design system built anywhere else never
  ran it. The same matrices are now computed from the compiled CSS inside
  `auditDesignSystem`: the cell product ported function-for-function
  (`src/audit/contrast/cells.ts`, `paint-parts.ts` — with the indicator
  ancestor chains DERIVED from the part tree instead of restated by hand;
  one entry, `menu`, keeps a hand chain because the mark sits on a host row
  the tree does not name), a selector matcher for the grammar the kit emits
  that answers `yes`/`no`/`unknown` and never lets an unknown collapse into a
  match (`selector.ts`), a computed-style model for the properties a
  contrast reading depends on — cascade order, `!important`, `var()`
  chains resolved at the declaring element and inherited resolved,
  `currentColor`, the `background`/`border` shorthands in their physical
  and logical spellings, `@scope` donuts evaluated against the chain, the
  geometry that collapses a mark (`cascade.ts`) — and the browser spec's
  compositing and WCAG formulas with 8-bit rounding where a canvas would
  round (`color.ts`, `matrix.ts`). Same floors: 3:1 per cell, the AA band as one
  warning per part and theme for text (worst cell named) and a note for a
  non-text mark (WCAG 1.4.11 stops at 3:1) — the AA band as a
  warning, `disabled` on its own 2:1 pre-fade floor. Every cell is on
  `AuditResult.contrast` with its verdict; a cell the reader cannot judge is
  `unmeasured` with one of a closed set of reasons and is reported as `info`,
  never as a pass. Conditional at-rules are evaluated the way the browser
  matrix's page would see them, not skipped: `@media` against a fixed
  reference environment (`REFERENCE_MEDIA` — Playwright's Desktop Chrome,
  1280×720, a fine pointer that hovers, light scheme, no preference flags),
  so a `min-width` breakpoint the page meets applies and `hover: none`,
  `forced-colors` or `print` blocks do not; `@starting-style` is never the
  resting render; `@supports`, `@container` and any query the model cannot
  decide taint what they declare (`conditional-rule`). An unreadable raw
  `css` rule taints every box it could have styled, pseudo-elements
  included. Two blind spots the browser probe had are gone in the
  process: text parts below their carrier are measured inside the chain
  the part tree derives, so a recipe's component tokens (declared on the
  carrier) resolve where the bare probe silently fell back to the inherited
  colour — which is how the matrix found the two recipe bugs under Fixed.
  `AuditOptions.themes` filters the themes measured; `AuditOptions.axisCellBudget`
  raises the chained-cell ceiling. An audit handed to `buildReport` folds its matrix into a
  matrix into the new optional `report.contrast` section (`summarizeContrast`;
  `report.schema.json` gains `contrastTheme`; `formatReport` prints one
  line per theme). The cell product, the paint table, the colour math and
  the floors are exported so the browser spec can import them (slice D).
- **Palette derivation** (#402): `derivePalette`, `deriveThemePair`,
  `solveContentLightness`, `contrastRatio`, `clampChroma` and `formatOklch`
  on `@sigx/zero-kit/define` (and the barrel). From seed hues — `{ primary:
  260 }` is enough — `derivePalette` produces exactly
  `requiredColorTokens(roles)` for one scheme with every `<role>` /
  `<role>-content` pair at or above 4.5:1 and `base-100`/`base-content` at
  or above 7:1 **by construction**, every value inside sRGB, hues preserved,
  deterministic; `deriveThemePair` returns a light and a dark theme already
  wired with `colorScheme`, `pair` and `softMix`, spreadable into `themes`.
  The semantic four take fixed hues, `secondary`/`accent` follow a
  `harmony` rotation, `neutral` is the primary hue desaturated, unknown
  role names fall back deterministically. The oklch → linear-sRGB math is
  hand-rolled (the `/define` graph may only reach relative modules) and
  pinned against culori to 1e-6; every guarantee is measured on the
  formatted string, so rounding cannot eat the margin. The validator's
  suggested fix for a failing pair (#412, below) and a derived brief build
  on this.

- **Contrast failures suggest the nearest passing value** (#412). When a
  `contrastPairs` pair fails in `validateDesignSystem` — error below 3:1,
  warning below 4.5:1 — the issue now ends ` — suggest <token>: oklch(…)`:
  the content side (`<role>-content`, or `base-content` for the base
  surfaces) moved in lightness only, hue and chroma kept, to the nearest
  value that clears **AA (4.5:1)** even for the error tier, since a fix
  that only just clears 3:1 would come straight back as the warning. The
  same fix is carried structurally: `ValidationIssue` gains two optional
  fields, `rule` (a stable id — `contrast-floor` here; other rules stamp
  theirs as tooling needs them) and `suggest: { token, value }`, so a
  generating agent can apply it without parsing prose. `suggestContrastFix(bg,
  fg, floor)` is exported for callers with their own floor; it returns
  `null` when no lightness reaches the floor from either side (impossible
  at 4.5:1 — black or white always clears a mid-grey — but real at 7:1),
  and the validator then says the role itself has to move.
- **A composite score and grade in the coverage report** (#408;
  `resolve/score.ts`, `computeScore` / `formatScore` / `pairScore` /
  `gradeFor` / `SCORE_WEIGHTS` exported from the barrel). Five named
  criteria, each 0–100 with the counts it was computed from: components
  styled (weight 25), declared axis values honoured and claimed (15), part
  states and flags covered with `skipStates` at half credit (20), the WCAG
  margin of the declared pairs in the weakest theme — mean over pairs, min
  over themes, full marks at 4.5:1, half at 3:1 (25), and the validation
  counts when the report was built alongside a validation pass — ten points
  an error, two a warning (15). `computeScore(report, compiled, { audit })`
  takes a sixth, `audit`, for `zero:audit` to fill; absent criteria drop out
  and the weights renormalise. Grades: A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, else
  F. A declined axis (`declaredOut`) and a fill role cost nothing; per-scope
  `variant` wiring is deliberately not scored. Measured: basic 96.5, daisyui
  93.2, material 97.1, brutalist 95.0, heroui 97.4, carbon 96.8 — all A,
  pinned as floors in `report.test.ts`; a Button-only start scores 68.4 (D).
- **`isFillRole` and `axisRoles`** in `contract.ts`, exported from the barrel
  and from `/define`: the one predicate for "a role that opts out of
  `-content` or `-soft` is a token, not a `color`-axis value" (#286).
  zero-basic, zero-material, zero-daisyui and zero-brutalist derive their
  `ROLES` through `axisRoles(roles)` instead of each restating the filter;
  CSS output byte-identical (css-golden gate). When #286 gives the
  declaration an explicit field, this is the one function that changes.

- **`fitRecipesToVocabulary` / `explainFit` on `/define`** (#401): fit a
  recipe list to what a `TokensInput` declares — `variants.color` keeps
  declared roles only; `size`, `variant`, custom axes and `modifiers` keep
  declared values once the vocabulary is declared (`sizes: []` empties the
  axis); `defaultVariants` / `compoundVariants` naming a dropped value go with
  it; `var(--color-<role>…)` the tokens never define is redrawn on the base
  surfaces, and an undeclared category step (`--ease-exit`) collapses to the
  category's resting step. Pure, and the identity for recipes that already
  fit (all six in-repo skins round-trip deep-equal). The caller is the new
  `@sigx/create-zero-ds` scaffold's generated `src/recipes.ts`, which lays
  `@sigx/zero-basic`'s 51 recipes under any brief.

### Changed

- **`report.json` is `reportVersion: 2`** (#408): the required `score`
  section was added (below). A consumer pinned to version 1 must read
  `score` or ignore it; nothing else in the shape moved. `formatReport`
  prints the score line first, under the title.

- **The generation skill's step 2 runs the scaffold** (#401):
  `pnpm create @sigx/zero-ds <name> --brief <id>` replaces the hand-copied
  package layout, and the brief pack's "copy the closest file" instruction
  becomes "pass it as `--brief`". The skill now documents the generated
  `baseline.ts` / `button.ts` / `recipes.ts` split and when to delete the fit
  call.

- **`auditDesignSystem` / `formatAudit` — the compiled-CSS guards, shipped
  with the kit** (#403, slice A). The state-legibility guard (three rules:
  `component`, `indicator`, `disclosure`), the button-affordance guard, the
  axis-value-coverage guard (`gap`, `ambiguous-base`, `unused`) and the
  design-system half of the axis-coverage guard were vitest files importing
  this repo's six skins by name — the skill told an external author "CI
  fails it", and for them nothing did. They now live under
  `src/audit/rules/`, lifted verbatim with their reasoning, and the four
  in-repo tests are thin callers of them (keeping the carrier discovery and
  the `NO_VARIANT` / `UNWIRED_AXES` / material ledgers, which are facts
  about this repo rather than about a design system). One new rule joins
  them: `reduced-motion/loop`, the static half of the browser reduced-motion
  spec — an infinite animation must have an `animation: none` under
  `prefers-reduced-motion: reduce` for the SAME selector, since `@media`
  adds no specificity and a broader cancel stops nothing — and (#418) with
  the reduced-motion query as the cancel's ONLY condition, since one also
  gated by `@supports` or a second `@media` stops the loop for some readers,
  not all; only `@layer`/`@scope` count as structure, so a loop that exists
  only behind `@supports`/`@container` is not judged as the default
  render's. Findings carry a rule id, a severity (the former hard-fails are
  errors; the two advisory rules are warnings), a `where`, the structured
  scope/part/states/axis/values, and a message naming the fix; what
  `skipStates`, `hiddenIn`, `tokens.scopes` or a fill-role declaration
  excused is listed under `waived` rather than swallowed. `parseRules` (the
  CSS reader the guards stand on, formerly a test helper) is exported beside
  them. Exported from the barrel and from `@sigx/zero-kit/build`; the `sigx
  zero:audit` command, `dist/audit.json` and the static contrast matrix are
  the B and C slices.

- **Axis values are graded by their own grammar, not the token-key one**
  (#198). `AXIS_VALUE_PATTERN` (`/^[a-z0-9]+(-+[a-z0-9]+)*$/`, exported from
  the kit and from `@sigx/zero/contract`, parity-tested) now governs
  `tokens.sizes`, `tokens.variants`, `tokens.axes.<axis>` and
  `tokens.scopes.*` values, recipe `variants`/`compoundVariants`/
  `defaultVariants` values, `assertAxisToken('value', …)` on both emitters,
  and the value positions of every schema (`axisValue` beside `kebabToken`;
  `report.schema.json` gains `valueList`/`valueListsByAxis`). Repeated
  hyphens are admitted, so Carbon's entire `kind` axis (`danger--tertiary`)
  is a legal declared value rather than something to remap. `%` and `.` are
  deliberately still refused: the lynx target writes a value into an
  unescaped class name (`zx-a-<axis>-<value>`) and the runtime composes the
  same class, so Radix's `105%` stays an `api.values` remap. Quotes,
  backslashes, whitespace and uppercase stay out as before. Axis, modifier
  and role NAMES keep `TOKEN_KEY_PATTERN` — `checkAxisValues` is split from a
  new `checkAxisNames` so the two grammars cannot drift back into one — and
  the value error now reads `"…" is not a valid axis value` naming both
  places the value is written verbatim. Modifier-name errors name the
  `data-mod-` tail they would become.

### Fixed

- **`color-mix()` bakes with premultiplied alpha** (#403). The shared colour
  evaluator (`resolve/color-bake.ts`, extracted from the lynx target so the
  static contrast matrix and the lynx emitters can never disagree about a
  colour) interpolated `color-mix()` without premultiplying, so a mix toward
  `transparent` drifted toward black: `color-mix(in oklch, #e8e9ea 70%,
  transparent)` came out `#909091b3` instead of `#e8e9eab3`. CSS Color 5
  specifies premultiplied interpolation, and the static matrix was the first
  reader to notice — thirty-odd dark-theme cells read as failing until the
  evaluator agreed with the browser. The lynx artifacts of any design system
  mixing toward transparency (daisyUI's `color-mix(… 60%, #0000)` inks)
  change accordingly, to what the web has always painted.

- **Two recipe bugs the matrix found the day it could see carrier tokens.**
  zero-basic's and zero-material's pagination `item` lost its accent fill
  while pressed on the ACTIVE page: the pressed wash (`base-content` at 12%
  over transparent) outranked the active fill and left `--pg-accent-content`
  on a base-tinted surface — 1.27:1 in light, 1.05:1 in material's dark.
  The active page now deepens under the press instead. zero-daisyui's
  completed step indicator read 2.96:1 under nord's muted primary (the 95%
  role ink on a 20% tint); the ink is deepened toward `base-content`.

## [0.2.0-beta.6] - 2026-08-22

### Fixed

- **Lynx target refuses logical inset/margin/padding spellings and the
  standalone `translate`/`rotate`/`scale` properties** (#392): measured on
  device (signalxjs/lynx#1084, four-bar probe on the Android emulator; iOS
  resolves all four bars), the logical spellings (`inset-block-*`,
  `inset-inline-*`, `margin-block-*`, `margin-inline-*`, `padding-block-*`,
  `padding-inline-*`) and the standalone transform properties resolve on iOS
  but NOT on Android — the daisy slider thumb sat visibly off-center there.
  This supersedes the re-measure recorded under 0.2.0-beta.5 (#388), which was wrong.
  Cross-platform-asymmetric is treated as unsupported: the recipe emitter
  drops every occurrence (declarations and keyframes bodies) with a report
  entry — the #363/#389 refuse-with-report pattern — and both structural
  gates forbid the spellings in the compiled artifacts. Physical spellings
  (`top`/`right`/`bottom`/`left`, physical margins/paddings) and
  `transform` functions are proven on both platforms; every affected recipe
  in zero-basic, zero-daisyui and zero-ext-example restates its geometry
  physically in its `targets.lynx` section (physical is the lynx target's
  norm — no RTL flow there), the slider thumb centering with
  `top: 50%; transform: translateY(-50%); margin-left: …`, and the
  indeterminate-progress sweeps with per-name-replaced `margin-left`
  keyframes. Web output is byte-identical throughout.

## [0.2.0-beta.5] - 2026-08-21

### Fixed

- **Lynx target refuses `currentColor`** (#388): measured on device on both
  platforms against 0.2.0-beta.4 (signalxjs/lynx#1079), `currentColor` never
  resolves on lynx — a declaration valued with it ships and silently paints
  nothing. The recipe emitter (declarations and keyframes bodies) and the
  tokens emitter now drop every occurrence with a report entry (the #363
  refuse-with-report pattern), and both structural gates forbid it in the
  compiled artifacts. zero-daisyui's four affected spends — the tabs
  border-flavor underline, the checkbox tick, and the radio checked ring and
  dot — are restated in their recipes' `targets.lynx` sections with the named
  inks the web spellings resolve to (the tabs color axis now bakes its active
  ink into a per-color/per-theme `--tab-active-ink` custom property the
  underline consumes; checkbox/radio spend their accent variables directly),
  which also restores the checkbox/radio border rings whose
  color-mix-over-currentColor fallbacks previously dropped whole
  declarations. (The same measurement round also declared the standalone
  `translate` property and the logical inset/margin properties working on
  both platforms; that verdict was wrong — superseded by #392 (0.2.0-beta.6), which
  measured them iOS-only and refuses them.)

## [0.2.0-beta.4] - 2026-08-21

### Fixed

- **Lynx target inlines calc-holding custom-property chains and rewrites
  `inline-flex`** (#382): measured on device (signalxjs/lynx#1075, iOS 18.3),
  lynx drops any declaration consuming `var(--x)` — bare, with a fallback, or
  nested in a `calc()` — whenever `--x`'s value contains `calc()` (the daisy
  progress track rendered zero-height because of it). A new `calc-chains.ts`
  pass substitutes every calc-holding custom property — directly or
  transitively through a var chain — into its consumers, parenthesized inside
  an outer `calc()`; where a size ramp redefines the property per axis
  compound on the carrier, the consumer is re-emitted on the consuming part
  under the same compound (the axis push-down contract stamps the classes on
  every part, so the compound matches), with variant emissions equal to the
  base elided. The now-inert definitions are dropped; plain-value definitions
  stay. Chains the pass cannot resolve statically REFUSE the build naming the
  property and scope (a definition under a theme host or state/flag compound,
  a cycle, a consumer in raw lynx `css`/keyframes, a fan-out above 256
  compounds); `assertNoCalcVarChains` backstops the whole stylesheet for
  cross-scope chains. `display: inline-flex` rewrites to `flex` — lynx has no
  inline formatting context (the daisy tabs list stacked vertically);
  `grid`/`inline-grid` pass through as authored and are called out in the
  capability notes. In zero-daisyui this inlines 20 chain properties across
  17 components, each a `translated` report entry. Web goldens untouched.

## [0.2.0-beta.3] - 2026-08-21

No changes to this package's code — lockstep version bump. Published
metadata only: every package's `repository`/`bugs` URL now points at
`andtii/zero-wip` (#374) so npm provenance validation passes. The version
was cut on 2026-08-20; the tag was re-pointed and published on 2026-08-21
after `scripts/publish.js` learned to derive the prerelease dist-tag when no
`--tag` is given (#370).

## [0.2.0-beta.2] - 2026-08-15

### Fixed

- **Lynx target: `calc()` over `var()` emits, theme-dependent colour
  functions restate per theme, the structural fallbacks ship, and a dangling
  `var()` fails the build** (#359). First on-device run of the lynx target
  (signalxjs/lynx#1029, iPhone 16 Pro / iOS 18.3): zero-daisyui's report goes
  from 594 dropped declarations to 219. `calc()` over `var()` — the whole of
  daisy's size system — was dropped as unproven; the Zero Pilot probe card
  measures it resolving, so it emits. A theme-agnostic recipe value such as
  `color-mix(in oklab, var(--color-base-content) 60%, #0000)` could not bake
  once; it is now re-emitted once per theme under that theme's host class,
  baked to a literal (the default theme rides `.zx-root` alone; a named theme
  is one class more specific). What genuinely cannot bake still drops and
  says which reason applies: `currentColor` (a runtime value) or a
  recipe-local property set by an axis rule (no single per-theme literal).
  `@sigx/zero`'s `css/base.css` structural fallbacks — which lynx, having no
  `@layer` and no base stylesheet, never shipped — now emit first inside
  `.zx-root`, pinned equal to the real `base.css` by a test. And the bug the
  rest was hiding: the emitter dropped declarations that DEFINED a custom
  property while keeping every declaration that READ it (24 undefined
  properties reaching 295 of 1043 rules), and on lynx an unresolvable `var()`
  paints nothing at all — daisy's switch shipped invisible. `assertNoDanglingVars`
  runs over the whole design system (`index.css` is tokens plus every
  component) and fails the build; a property an app is expected to supply
  must carry `var(--x, <fallback>)`.

- **Lynx target refuses `min()`/`max()`/`clamp()` instead of emitting them.**
  Measured (signalxjs/lynx#1066): lynx does not implement `min()`, in either
  shape daisy's switch spends it — bare or nested inside `calc()` — and the
  failure mode is the declaration being dropped. The three CSS Values 4
  comparison functions are refused on the same evidence (no engine has ever
  shipped one without the others; stated explicitly in the capability doc)
  and drop with a report entry asking for a lynx replacement rather than
  being folded — the motivating radius mixes `rem` with `px`, which no
  unit-blind evaluator can reduce. Both structural-safety gates gain the
  three functions.

## [0.2.0-beta.1] - 2026-08-13

### Added

- **Recipe per-target sections** (#355): `RecipeInput.targets?: { web?,
  lynx? }`, each a `RecipeTargetOverride` (the styling surface — tokens/
  parts/variants/modifiers/compoundVariants/keyframes/css/skipStates),
  deep-merged over the shared recipe by `resolveRecipeForTarget` before
  that target compiles. Absent `targets`, both views are the shared recipe
  byte-identically (every existing web golden is the proof). Merge shapes:
  props per declaration (override wins), parts/variants/modifiers per part
  and per state/selector/condition, `compoundVariants` concatenate,
  `keyframes` per name, `skipStates` union. The raw `css` hatch is
  asymmetric by design: shared+web concatenate for the web view; only
  `targets.lynx.css` (lynx-authored by construction) reaches the lynx view,
  with a shared `css` recorded as dropped. The web compile, the validator
  and the axis harvest all run on the web view; `recipe.schema.json` gains
  the `targets` property. Keyframes bodies now get the same capability
  checks as declarations on lynx (runtime refs reject; calc-over-var and
  theme-var color functions drop the animation with a report entry).
- **zero-basic and zero-daisyui compile the lynx target** (`targets:
  ['web', 'lynx']` in both build.mjs; `./lynx/index.css`,
  `./lynx/tokens.css` and `./lynx/manifest.json` exports on both
  packages). Their web-runtime references (`--slider-percent`,
  `--diff-percent`) moved into `targets.web` — web output byte-identical
  (goldens untouched); the migrated declarations simply do not exist in
  the lynx view. A whole-skin structural gate compiles both skins'
  entire lynx stylesheets and asserts nothing the lynx engine cannot
  parse appears and every selector is a flat class compound.

- **Lynx target: capability set + token emitter** (#351). `targets/lynx/`
  gains the first half of the lynx emit target:

  - `class-names.ts` — the kit's parity-tested mirror of zero's class
    grammar (`zx-<scope>__<part>`, state/flag/axis/mod/orientation/
    placement/theme families, the `zx-root` host).
  - `capabilities.ts` — the capability set `RUNTIME_PROPERTIES`' doc
    anticipated, as code: `bakeColor`/`bakeColorValue` (culori-baked
    literals for `oklch()`, `light-dark()` — picked per theme scheme —
    and `color-mix()` — evaluated in its declared space against the
    theme's own colors; constant `calc()` alphas folded),
    `bakeSoft` (the oklab soft-tint derivation, evaluated at compile
    time), `runtimePropertyIn` (rejects `var(--press-*)` and friends —
    the web-runtime mechanism with no lynx equivalent), and the
    `LynxCapabilityReport` (translated/dropped findings for report.json).
  - `tokens-css.ts` — `compileLynxTokensCss`: tokens on the `.zx-root`
    host class plus one full-restatement `.zx-root.zx-theme-<name>` block
    per theme (switching is a class swap), every color a hex literal,
    non-color `var()` chains inlined to literals (color references stay
    live — the one lynx-proven indirection), `--text-fixed-*`
    materialized as the ramp's literals. No `:root`, no `@layer`, no
    `@property`, no `@media`.
  - `recipe-css.ts` — `compileLynxRecipeCss`: flat class compounds only
    (`.zx-tabs__tab.zx-s-active`), machine states/flags from the manifest,
    interaction states through the runtime-stamped flag classes (`hover`
    drops with a report entry), anatomy pseudo parts as real part classes,
    axis/modifier/compound rules per the push-down contract (never a
    combinator, no `:not()` default twins), the two contract attribute
    selectors (`&[data-orientation]`, `&[data-placement]`) translated,
    other `selectors:` keys and all `at:` conditions dropped with report
    entries, `flex: <n>` expanded long-form, literal color functions
    baked, theme-var-dependent ones dropped (a recipe is theme-agnostic),
    `var(--press-*)` and the raw `css` hatch rejected.
  - `compile.ts` — `compileDesignSystemLynx` + `writeLynxArtifacts`:
    `dist/lynx/{tokens.css, components/<scope>.css, index.css,
    manifest.json}`, wired into `runStandardBuild` via
    `targets: ['web', 'lynx']`; capability findings land in the shared
    `report.json` under `lynx`, the lynx manifest carries the DS
    manifest's content plus `{target, classGrammarVersion, capabilities}`.
    `buildDsManifest` extracted from `writeArtifacts` so both targets
    share one manifest derivation.
  - The real skins do not compile for lynx YET — they spell web-runtime
    references (`var(--slider-percent)`) in shared recipe sections, which
    the target correctly rejects (pinned in `build-targets.test.ts`);
    their migration into per-target recipe sections is the follow-up.
  - Tests: capability-primitive units, per-verdict recipe emitter tests,
    lynx-safety structural gate over the compiled output of zero-basic
    AND zero-daisyui tokens (no attribute/pseudo selectors, no at-rules,
    no unbaked color functions — verified red on an injected
    `light-dark()`), a golden snapshot, a synthetic end-to-end
    `runStandardBuild` case, and class-grammar parity rows in
    `contract-parity.test.ts` over the whole real vocabulary.

### Changed

- `resolveSystemTokens` (token-tier resolution) moved from the web token
  emitter into `targets/shared.ts` — the lynx emitter walks the identical
  tiers; web output byte-identical (css-golden gate).

- **Multi-target build plumbing** (#348): `runStandardBuild` takes
  `targets?: readonly ('web' | 'lynx')[]` (default `['web']` — existing
  builds byte-identical). The list is validated up front: unknown names
  fail, `web` is not optional, and `lynx` fails honestly with "not
  implemented yet" until its emitters land. `BUILD_TARGETS`/`BuildTarget`
  exported from `@sigx/zero-kit/build`.

### Changed

- **Target-neutral emitter machinery extracted to `targets/shared.ts`**
  (#348): declaration guards (`declBlock`, breakout/property patterns),
  `findPart`, the emission sink with its tiered condition ordering
  (`resolveCondition`, `TIER`, `renderBucket`, `compareChains`), and the
  axis/keyframes token assertions moved out of the web emitter verbatim, so
  the lynx emitter reuses the exact guards instead of re-deriving them.
  `targets/web/recipe-css.ts` keeps only the web selector shapes; emitted
  CSS is byte-identical (css-golden gate).

- **The rootless-variant validation now checks reachability, not existence**
  (#321). A component with no `root` part (dialog/popover/tooltip/menu) used
  to hard-error on ANY `variants`/`modifiers`/`compoundVariants`; it now
  errors only when a rule styles a part that never renders under the carrier
  (the popup and its descendants — those donuts are dead CSS). Rules on the
  carrier part itself — the trigger the axis attributes actually sit on —
  are flat selectors and are accepted, which is what lets a design system
  wire `color`/`size` for the trigger-carried Contract v1 scopes at all.

### Added

- **Contract v1: @scope-bounded axis rules, a versioned self-validating DS
  manifest, versioned vocabulary-enforced fragments** (#317). The kit's half
  of the coordinated contract break:

  - Non-carrier axis rules are emitted inside an `@scope` donut —
    `@scope ([carrier][attrs]) to ([carrier]) { [part] { … } }` — instead of
    an unbounded descendant selector. Nested same-scope instances (card in
    card) now resolve each part's axis to the NEAREST carrier by CSS scoping
    proximity rather than source order; unscoped rules count as infinitely
    far, so axis refinements keep beating the flat base rules they used to
    outrank by specificity. Carrier rules stay flat.
  - The design-system `dist/manifest.json` is a versioned artifact: a new
    `schemas/ds-manifest.schema.json` (distinct from the zero ANATOMY
    manifest's `manifest.schema.json` — the two share a basename and nothing
    else), a `$schema`/`manifestVersion: 1`/`zeroVersion` envelope,
    `DS_MANIFEST_VERSION` and the `DesignSystemManifest` type exported from
    the package root, and `writeArtifacts` self-validates against the schema
    before writing — a shape break fails the build that produces the
    manifest, not the app that reads it. (`ajv` is a runtime dependency now.)
  - `ManifestFragment` requires `version` (`FRAGMENT_VERSION = 1`);
    `mergeManifests` hard-errors on a missing or unknown one, and now holds
    every fragment part to the shared vocabularies — flags, governed states
    (synonyms fail with the member to use), placements, `hiddenIn ⊆ states`,
    and a dangling/self/cyclic-free part tree — so the "no synonyms" rule
    finally binds on the ecosystem surface.
  - Kit-side parity copies of `FLAG_VOCABULARY`, `STATE_VOCABULARY`,
    `STATE_NAMES`, `STATE_SYNONYMS` and `PLACEMENT_VOCABULARY`
    (contract-parity-tested against zero's); `RESERVED_AXES` is now derived
    from the flag list on this side too. `ManifestPart` mirrors `parent` and
    `placements`.

- **`@sigx/zero-kit/build` — the standard build as one function** (#318).
  `runStandardBuild({ designSystem, manifest, fragments?, outDir, logger? })`
  runs merge → validate → compile → `buildReport` → `writeArtifacts` with
  uniform issue printing, and throws (after printing every issue) when
  validation fails. The six in-repo design systems' `build.mjs` files shrink
  to data/config calls, and `sigx zero:build` calls the same function — one
  derivation of "what a build is", however it is invoked.

- **`@sigx/zero-kit/define` — the authoring surface for browser graphs**
  (#318). Re-exports `defineTokens` / `defineRecipe` / `defineDesignSystem` /
  `defineApi` from a module graph that is `node:`-free by contract:
  `ds-runtime-imports.test.ts` walks it and fails on the first non-relative
  import. A design-system module in a package's runtime graph may
  value-import this subpath (and only this subpath) — zero-carbon and
  zero-heroui drop their `satisfies` reimplementations for the real
  two-argument `defineApi`.

- **api: `color`/`size` entries, per-scope `components` overrides, and
  `RESERVED_PROPS_BY_SCOPE`** (#318). The vendor-named api declaration gains
  first-class `color` and `size` entries (validated against the roles/ramp as
  compilation resolves them — Carbon's `size` can finally be respelled), and
  the formerly reserved `components` key activates: scope → an override that
  replaces the DS-wide entry per surface. One merge seam (`scopeApi`) feeds
  `deriveComponentApi`, so the emitters, the manifest and the runtime spec
  read the same resolution. A DS-WIDE `as` rename onto a scope's
  component-specific prop (Select's `name`, Button's `type`) is now an error
  naming the clashing scopes and pointing at `api.components.<scope>` — the
  same rename scoped to one component is the deliberate, vendor-faithful
  shadowing and stays legal. The table of component-specific props is pinned
  to zero's actual `RootProps` declarations by a parity test.

- **Layer-order emission** (#318). Every compiled `tokens.css` (and therefore
  `index.css`) opens with `@layer zero.fallback, zero.tokens, zero.recipes,
  zero.structure;` from a shared `LAYER_ORDER_STATEMENT` constant pinned
  byte-equal to the statement in `@sigx/zero/css/base.css`. Compiled DS CSS
  previously relied on base.css being parsed first; loading the DS stylesheet
  first created `zero.tokens` before `zero.fallback` existed and left the
  neutral fallbacks overriding the design system's tokens.

- **Interpolation guards on the remaining verbatim compiler sites** (#318).
  Declaration property names get a CSS property grammar (camelCase authoring
  and vendor prefixes pass), declaration values and `selectors` keys get a
  breakout guard (no braces, semicolons or newlines), and `@keyframes` names
  must be a single CSS identifier that is not a CSS-wide keyword — modeled on
  the `assertAxisToken` / `PSEUDO_ELEMENT_PATTERN` precedent, red-first with
  the documented incident inputs.

- **Token-layer validation** (#318). `tokens.custom` and `theme.extra` names
  now answer to `TOKEN_KEY_PATTERN` (a `--My Token:` declaration was emitted
  verbatim and silently dropped by the browser); every `var()` reference in
  token VALUES (system / systemDark / theme.system / theme.custom /
  theme.extra) resolves against the declared vocabulary with the same
  error-or-fallback-warning semantics the recipe layer has always had; and
  custom-property definition cycles (`--a: var(--b); --b: var(--a)`) are
  detected per theme — CSS makes every property in a cycle invalid,
  fallbacks included.

- **Fragment hardening** (#318). `mergeManifests` requires kebab-case scope
  and part names (a fragment's scope is both a selector and the
  `css/components/<scope>.css` filename, so one grammar closes selector
  injection and path traversal) and applies the breakout guard to per-state
  selector fragments; `writeArtifacts` gets the same grammar as a backstop
  for direct callers.

- **The spinner joins the contrast audit's indicator matrix** (#314). Its name
  matches no `PAINT_ONLY_PART` pattern, so it was opted in by hand: a spinner
  is pure paint on the page and an invisible one is a real bug, answering to
  the same 3:1 non-text floor (WCAG 1.4.11) the matrix already enforces. Empty
  ancestor chain, because a spinner stands on the app surface.

  **Skeleton is deliberately not there**, and the distinction is the point. A
  skeleton is not a control and not content — it is the absence of content, and
  a placeholder loud enough to clear 3:1 would read as a filled block someone
  meant. Holding it to a control's floor would make every design system draw a
  worse skeleton.

- **Ancestor chains for the contrast audit's axis matrix, and the first
  non-button carrier wired against its own vocabulary** (#297). #294 landed
  per-scope vocabularies and #311 gave them a first caller in `badge`, which
  could go first only because its carrier IS its text-bearing part — the one
  shape the audit's one-element probe can measure. Thirteen of the remaining
  carriers fail that: `select`'s text lives in `trigger`, `value` and `item`,
  none of which is the carrier, and the `axis coverage` guard hard-failed on
  exactly that.

  The audit now declares chains for those parts (`AXIS_CHAINS`, the sibling of
  `INDICATORS`), builds the real ancestor nesting, and — the load-bearing
  detail — puts the axis attributes on the chain ROOT rather than the measured
  element, because that is where the compiler anchors the selector
  (`[data-part="root"][data-variant="soft"] [data-part="trigger"]`). A probe
  carrying the attribute itself would select a rule that does not exist and
  report the unvaried colour as a pass. The measured part is read against its
  nearest painted ancestor rather than the page, so an item is measured on the
  popup's fill.

  `@sigx/zero-basic` wires `select` to `outline | soft | ghost` — three of the
  four values `button` offers, without `solid`, because a field filled with the
  role at full strength stops reading as an input. `select` leaves the
  `NO_VARIANT` ledger; the blocker on the other seventeen is now work rather
  than expressiveness.

  Chained cells are bounded to the resting combos (`{}` plus each state, no
  state × flag pairs) — the roles are deliberately NOT the dimension cut, since
  the daisyUI #210 finding was per-role. The count is annotated on every run
  and capped by `AXIS_CELL_BUDGET`, so the next scope that lands shows up in
  the output rather than in the wall clock.

### Fixed

- **`data-variant` is checked per SCOPE, not against the design system's
  union** (#297). `ds-smoke`'s undeclared-value invariant (#215) asked whether
  a value exists design-system-wide, which stopped being the right question the
  moment a scope could wire its own: daisyUI declares `soft` and wires it on
  `button` alone, so `select[data-variant="soft"]` passed while selecting
  nothing — #215's own bug, one level down from where that fix looked.

  Two playground demos were doing exactly that and neither failed until the
  check existed: `badge` (shipped in #311) and `select` (in this PR before
  review). Both now go through a new scope-aware `pickScopeVariant`, and the
  invariant names the scope and what it actually wires when it fires.

### Changed

- **The contrast audit reads `carrierPart` and the manifest types from
  `@sigx/zero-kit`** (#297) instead of a hand copy. The copy had no parity
  test and was about to become load-bearing in two places at once — it decides
  both the chain roots and the guard that checks them, so a drifted copy would
  have let the two agree with each other while both were wrong. The local
  `ManifestPart` mirror went the same way: it had silently omitted `hiddenIn`
  and `selectors`.

- **`tokens.scopes` has its first real caller** (#311). `#294` landed
  per-scope axis vocabularies and the expressiveness RFC said to revisit
  them "when the content tier lands (card, alert, badge, chip)" — until now no design system
  declared one, so the mechanism shipped unexercised. `@sigx/zero-basic` now
  narrows `badge` to `solid | soft | outline` out of its design-system-wide
  `solid | outline | soft | ghost`. `ghost` is the value it drops, and the
  reason is the argument for the whole feature: a ghost button is furniture
  that reveals itself on hover, but a badge has no hover and nothing to
  reveal.

  The narrowing is enforced end to end, which this exercise checked rather
  than assumed: a badge recipe keying `ghost` fails validation with a message
  naming `tokens.scopes.badge`, the emitted `register.d.ts` types `Badge`'s
  `variant` as the three while `Button` keeps four in the same file, and the
  compiled manifest advertises only the three. `AxisDivergence.declared`
  already told a declared narrowing apart from accidental divergence, and now
  has a case proving it.

### Changed

- **The partial-narrowing warning no longer names scopes that wire nothing**
  (#311). Writing the first `tokens.scopes` declaration made the validator
  warn about every *styled* scope that had not declared one — twenty-nine of
  them in zero-basic, twenty-eight of which wire no `variant` at all (#175)
  and so offer nothing a sibling's narrowing could expose; the recipe harvest
  already compiles those to `never`. A list that long reads as "you did
  something wrong" rather than as the one question actually worth asking,
  which was whether `button` means to carry the whole set. The warning now
  considers only scopes that paint the axis, and `button` says so explicitly.

- **Ecosystem manifest fragments: `mergeManifests` and `--extra-manifest`**
  (#302, the building-on-top-of-zero track). An ecosystem component package —
  a peer of `@sigx/zero` shipping its own scopes, built from zero's public
  authoring surface — publishes `{ "package": "<specifier>", "components":
  [anatomy.toJSON()] }` (JSON Schema: `schemas/fragment.schema.json`), and a
  design system opts into covering it by MERGING the fragment into the base
  manifest rather than replacing it: `--extra-manifest <path|specifier>`
  (repeatable) on `zero:build`/`zero:validate`, or `mergeManifests(base,
  ...fragments)` programmatically. The merge stamps each component with its
  owning package and hard-errors on any scope collision; everything downstream
  was already scope-agnostic, so the merged scope flows through validation,
  recipe compilation, per-scope vocabularies and the coverage report unchanged.

- **The register artifact tolerates external scopes without weakening its
  gate.** `ZeroScope` stays closed on purpose — a merged scope's anatomy lives
  outside zero's registry, so it can never satisfy the union. The generated
  `register.d.ts` now excludes external scopes BY NAME
  (`Exclude<keyof ZeroVocabulary['components'], 'acme-stepper'> extends
  ZeroScope`), keeping the typo/version-skew guard (docs/architecture.md,
  "The register artifact") at full
  strength for every zero-origin scope, and records each external scope's
  owning package in the emitted comment. A design system with no external
  scopes emits byte-identical output. Under api mode, the generated
  `./components` module imports an external scope from its owning package's
  root export instead of the nonexistent `@sigx/zero/<scope>` subpath.
  Compiled provenance rides on `CompiledDesignSystem.externalScopes`.

- **A vocabulary can belong to one scope: `tokens.scopes`** (#294;
  docs/architecture.md, "Declared vocabulary"). Per-scope axis vocabularies,
  the thing the expressiveness RFC deferred "until the content
  tier makes divergence real" — and the caller that arrived first was the
  fourteen unwired `variant` carriers, twelve of which have a variant in a real
  design system and not one of which spells it `solid | outline | soft | ghost`.

  ```ts
  variants: ['solid', 'outline', 'classic', 'surface', 'soft'],   // the UNION
  scopes: {
      button: { variants: ['solid', 'outline'] },
      select: { variants: ['classic', 'surface', 'soft'] },
  },
  ```

  **`tokens.variants` is now the union of every scope's vocabulary.** A map that
  only narrows would not have worked: `select` wants `classic` and `surface`,
  and no button's set contains them, so there was nothing to narrow from. Every
  axis takes a restriction — `colors`, `sizes`, `variants`, `axes`, `modifiers`
  — because restricting `variant` alone would have left `tokens.axes` (the
  recommended escape hatch for a second vocabulary) unrestricted, and because
  #258 was a *size* problem. An absent key means the scope offers the whole
  union; an empty list is the claim "no such axis here", the same grammar
  `sizes: []` already uses.

  **The restriction unit is the scope, and per-part is settled rather than
  deferred again.** Zero puts one attribute per axis on the scope's carrier part
  and cascades it to every part below by descendant selector, so Radix Select's
  Trigger/Content split is two *axes*, not two vocabularies — and it is
  expressible today, because zero has no portals and
  `[data-part="root"][data-content-variant="soft"] [data-part="popup"]` matches.
  A `parts` key inside a scope entry is reserved and rejected by name, so a
  per-part restriction stays additive if it is ever wanted.

  Three new diagnostics, all paying back the union: a value in the scope's
  vocabulary its recipe wires nothing for; a union value belonging to no scope
  at all; and — the one real behaviour change — **cross-talk**, where one scope
  narrows an axis and a styled sibling does not, so the sibling is still
  offering values declared for someone else. `validateDesignSystem` warns at the
  declaration, and `axis-value-coverage.test.ts` reports the same fact as a
  coverage gap. The escape is to restrict the sibling too; restating the whole
  union for a scope is deliberately not warned about, since it is how a scope
  says "yes, I carry all of it".

  `register.d.ts` deliberately still emits the **harvest**, not the declaration:
  wiring outside a scope's vocabulary is now an error, so the harvest narrows to
  it anyway and is strictly stronger — it additionally refuses to type a value
  the compiled CSS does not implement. `api.components` stays reserved;
  per-scope vocabulary does not imply per-scope api.

  No design system in this repo declares `scopes`, so every golden, snapshot,
  compiled stylesheet and conformance row is byte-identical — the manifests gain
  `"scopes": {}` and the reports gain an empty `unclaimed`. The fourteen carriers
  are unblocked but still unwired, and the `NO_VARIANT` ledger stands with its
  reasons now meaning "not declared yet" rather than "cannot be said".

- **The `variant` axis is settled on the fourteen carriers that left it unwired,
  and the answer is a ledger rather than 84 recipe blocks** (#175). Fifteen
  components compose `WithVariantAxes`; `button` is the one that wires `variant`
  and stays as it is, so the fourteen below are the rest.

  `axis-coverage.test.ts` traded its axis-wide `DEFERRED_AXES = ['variant']`
  for `NO_VARIANT`, a per-carrier record whose value IS the reason — the shape
  `KNOWN_UNSHARED` uses in `contract-parity.test.ts`. It discharges the
  expressiveness RFC's phase-5 gate ("wire it,
  or record the divergence per component with its reason") and supersedes the
  note below: #175 leaving `variant` on `button` alone is now decided, not
  provisional.

  The fourteen were surveyed one at a time against the conformance vendor
  set (docs/architecture.md §7), and the
  result is more uniform than the issue guessed. **Twelve of the fourteen do
  carry a variant in a real design system. Not one of the twelve spells it
  `solid | outline | soft | ghost`** — Radix Themes varies checkbox, switch,
  radio-group, slider, progress and text fields as `classic | surface | soft`;
  Ant v6's AutoComplete is `outlined | borderless | filled | underlined`;
  HeroUI v3's tabs are `primary | secondary`. Only `rating-group` and
  `tree-view` have no style axis anywhere in the set, so "a ghost progress bar
  is meaningless" was the wrong reading: a *varied* progress bar is ordinary,
  and it is `ghost` specifically that the vocabulary cannot mean.

  So the blocker is §4, not effort — and one finding outgrows §4 as drafted:
  Radix's Select varies its Trigger as `classic | surface | soft | ghost` and
  its Content as `solid | soft`, two vocabularies inside one scope, which a
  per-*scope* restriction map would not express either. Recorded in the
  expressiveness RFC, with the per-scope deferral gaining the fourteen as its
  demonstrated caller (resolved by `tokens.scopes` — docs/architecture.md,
  "Declared vocabulary").

  Nothing wires a new variant, so no recipe, manifest, golden or contrast cell
  moves. The ledger fails in both directions: a carrier arriving unrecorded, and
  a recorded reason whose carrier has since been wired.

- **The design-system skill teaches the axis surface it actually has** (#176).
  The contract gained modifiers (#166), `sizes: []` (#164) and a design
  system's own `variant` vocabulary (#99); `SKILL.md` knew none of it, so a
  generated design system inherited the default shape by omission. It now
  covers four things it did not:

  - **`tokens.modifiers`** — presence-only styling, `[data-mod-<name>]` and
    the `mods` prop, with the one-member axis (`axes: { block: ['block'] }`)
    named as the encoding it replaced. The skill had been steering authors
    straight at it.
  - **Declining an axis** — `roles: {}` and `sizes: []`, and why empty is a
    different statement from absent: omission takes the recommended
    vocabulary, empty says there is no such axis and reaches the manifest, the
    report and the generated types.
  - **`solid | outline | soft | ghost` as convention, not contract.** Four of
    six in-repo systems declare it, which is exactly what made it look
    load-bearing. HeroUI's fused seven-member vocabulary — `danger-soft` a
    single value rather than a crossing — is shown as the counter-example.
  - **`compoundVariants`**, previously one passing mention: that it honours
    `defaultVariants` (#158) and that a `match` value of `true` names a
    modifier rather than an axis value.

  Step 6's iterate loop now also runs **`sigx zero:validate --report`** (#173)
  and says what to do about `declared out of existence`, `wired by nothing`
  and the per-scope axis status — validation asks whether anything is wrong,
  the report asks whether you built what you declared, and the second is the
  question a generated design system gets wrong.

- **A fifth style brief: `riso`** (`skills/design-system/briefs/riso.ts`).
  The other four all take the recommended eight roles, the `xs…xl` ramp and
  the four-name variant set, so the pack demonstrated one axis surface four
  times. `riso` is a duotone risograph print, and the look forces the shape:
  `roles: {}` (two inks are not eight semantic roles) with the palette as
  declared `custom` tokens, `sizes: []`, a fused five-member `variant`
  vocabulary naming an ink *or* a treatment, two modifiers, and a
  `compoundVariants` entry that matches one. `briefs.test.ts` compiles it like
  the rest and pins the mechanisms — that `[data-mod-overprint]` is
  valueless, that the compound crosses an axis value with a modifier, and that
  both axes come back declared-out of the compiled system.

- **The Reference section names `@sigx/zero-heroui` and `@sigx/zero-carbon`**
  as the worked non-default axis surfaces, and cites the
  `skills/design-system/conformance/` fixtures as miniature examples of the
  shapes the brief pack does not cover (a numeric size ramp, a `tokens.axes`
  entry, a vendor-renamed axis, camelCase modifiers restored at the API
  boundary).
- **A physical-direction lint in `validate-recipes`** (#277, #290). Warns on
  every physical property that has a logical twin — `left`, `right`,
  `margin-left/right`, `padding-left/right`, `border-left*`/`border-right*` and
  the physical corner radii — across part declarations, `@keyframes` bodies and
  the raw `css` escape hatch alike, naming the logical property that was meant.
  Nothing is exempt from being *read*: the level is `warning`, so no input needs
  somewhere to hide, and an unscanned one would be a blind spot in the middle of
  a check whose premise is that this bug class is otherwise invisible. In the
  raw block a physical property must sit at the head of a declaration, so
  `linear-gradient(to left, …)` and `transform-origin: bottom left` read as the
  values they are. A physical direction is not
  a typo: it compiles, it renders, and it is simply the *same* side in both
  writing directions, so one rule stays put while everything around it mirrors.
  Nothing else in the repo could see that — the css goldens record the physical
  spelling faithfully and no unit test sets `dir`.

  It found 36 sites across all six design systems, including four switch thumbs
  and every toast viewport, all fixed in the same change.

  Deliberately **not** #51's problem. That one is "validate every CSS property
  name", which needs a list that goes stale against new CSS; this is a dozen-odd
  physical properties whose logical twins have been stable for years.

  Three exemptions, each because a real site needs it: **centring** (`left: 50%`
  paired with a half-width pull-back is symmetric — every toast viewport's
  `top`/`bottom` placement is this), **a physically-measured value**
  (`left: var(--press-x)`, which `press.ts` measures from the element's own left
  edge), and **a part that rotates** (once a box is rotated its `border-left` is
  a stroke of a drawn glyph, not an edge of a box — and a check mark is not
  mirrored in RTL; Carbon's checkbox already said so in a comment above the
  declarations this would otherwise have flagged). The rotation exemption is
  scoped to the part rather than the block, because the rotation is declared in
  `base` while a state or an `at` override adjusts one arm.

  **What it cannot see, by construction:** a `transform`. `translateX(8px)` has
  no logical spelling to suggest — the fix is a direction-valued custom property,
  which is a shape rather than a rename. heroui's switch is the proof: it
  anchored with `inset-inline-start` and then travelled with a bare positive
  `translate`, so under RTL the anchor mirrored, the travel did not, and the
  thumb left the track. Clean to this lint, broken on screen. That half is
  covered by `e2e/rtl.spec.ts`, which reads boxes instead of declarations;
  neither check subsumes the other.

- **The declared-step-nobody-honours guard**
  (`__tests__/axis-value-coverage.test.ts`, #273). A design system's
  `tokens.sizes` / `tokens.variants` / `tokens.roles` / `tokens.axes` reach
  `manifest.json`, the docs site and the generated `register.d.ts`; an app may
  pass any value in them, and `data-size="2xl"` reaches the DOM whether or not
  a rule matches. A declared value nothing matches doesn't fail — it silently
  renders the base. So #258: zero-carbon declared `sm md lg xl 2xl` and only
  `button` shipped `xl`/`2xl`, so the other fourteen size-bearing scopes fell
  back to their `md` base at both steps — *smaller than `lg`*, so growing the
  size axis shrank the control (avatar 48 → 40px, checkbox 22 → 18, switch
  56×28 → 48×24). The whole suite was green: the css goldens recorded the
  absent rules faithfully, `validate-recipes` only asks whether a value names a
  declared one, and `axis-coverage.test.ts` asks whether a scope wires the axis
  *at all* — avatar wired `sm` and `lg`, so it was wiring size. Nothing asked
  whether the ramp had holes in it.

  **The un-attributed step** is what the naive rule was missing, and it needed
  no new syntax: an entry that emits nothing (`md: {}`, and zero-carbon's
  button writes `lg: {}` because Carbon's default button is the 48px one) IS
  the claim that the base stands for that step. So a declared value is
  accounted for when it paints in the default render, **or** when the recipe
  writes it as an entry that paints nowhere at all. `defaultVariants` is
  deliberately not a second way to say it — it would let a forgotten step be
  excused by a field written for another purpose, and the point of the empty
  entry is that an author who forgot a step wrote nothing. "Paints nowhere at
  all" rather than "nowhere here": an entry whose only rule sits inside a
  `@media` has been thought about and is not claiming the base, and at the
  default viewport it renders as the base without meaning to — a gap.

  Three assertions over the compiled CSS of all six design systems, for the
  reason `state-legibility.test.ts` gives: a value can be implemented through
  `variants`, `compoundVariants` or the raw `css` escape hatch, and only the
  artifact sees all three. **A** — no participating scope skips a step one of
  its siblings implements. **B** — at most one value per scope claims the base,
  because two silent entries render identically, which is #258's harm reached
  by the other door ("fix" a missing `xl` by writing `xl: {}`). **C** — a
  declared value no recipe paints or claims is reported at design-system
  granularity, exempting colour roles that opted out of `-content` or `-soft`:
  those are fills and hairlines (Material's tonal `surface*`, its `outline`),
  which `tokens.roles` carries as palette rather than as `data-color` values,
  and which SKILL.md already tells authors to filter out of the axis. A ledger
  test pins that exemption to exactly those four so a fifth cannot join it
  quietly.

  Scoped, not naive. Measured before it was written: "every declared value in
  every scope with a recipe" reports **1267** findings across the six design
  systems — the shape that got the per-part legibility guard reverted at 164.
  Restricting to scopes that participate in the axis takes it to 124, reading
  the un-attributed step to 64, and restricting to values some scope in the
  design system implements to **0**. On zero-carbon's pre-#272 recipes it
  reports the 28 that #258 actually was, naming all fourteen scopes and both
  missing steps. `variant` needs no exemption and gets none: #175 leaves it
  wired on `button` only, and a scope that wires nothing for an axis is not
  participating in it.

- **The state-legibility guard grew a third assertion: an in-flow disclosure
  control says which way it is pointing** (#248). Assertion A judges at
  *component* level on purpose — "the difference lives on a sibling part" is
  legitimate and extremely common, and judging every part separately reported
  164 false findings — but that looseness cleared #220: zero-material's
  collapsible and accordion triggers were byte-identical open vs closed, and A
  was satisfied by `[data-part="root"][open]::details-content { block-size:
  auto }`, i.e. by the panel physically expanding, which is what `<details>`
  does in every design system whether or not the recipe says anything. The
  guard's whole reason for existing missed the flagship instance of exactly
  that. Assertion C asks the question of the part the claim is about: for a
  `*trigger` part in a component that declares **no `popup` part** — the ones
  that disclose *in flow*, so the panel is a sibling under the control and both
  are on screen in both states — the difference must live on that control or on
  a sibling `*indicator`, and nowhere else. Triggers of overlay components
  (dialog, popover, tooltip, menu, select, combobox) are deliberately out of
  scope: the revealed thing floats above the page and takes focus, the six
  design systems disagree about whether the trigger should also change, and
  both readings are defensible. The sibling-indicator escape is the hand-off to
  the stricter Assertion B, and it is load-bearing for exactly one component —
  all six design systems differentiate `tree-view.branch-trigger` through its
  rotating `branch-indicator` and none through the trigger itself; collapsible
  and accordion declare no indicator part, which is precisely why #220 was a
  bug and not a style. Not fixed by discounting `::details-content` as "the
  browser's box": that is the property denylist this file argues against, and a
  recipe styling its `panel` at all would defeat it — the fixtures assert both.
  Zero new findings across all six design systems; the failure mode is covered
  by seven fixtures, the central one being the same recipe judged by both
  assertions, where A reports clean and C reports the trigger.

- **`MEDIUM_PROPERTIES` — custom properties that are facts about a medium
  rather than design tokens** (#233). Today one name, `--print-ink`, declared
  by `@sigx/zero/css`. The recipe validator now treats it the way it already
  treats `RUNTIME_PROPERTIES`: a recipe may reference it whether or not the
  design system overrides it, instead of failing with *"references
  `--print-ink`, which this design system never declares"*. The distinction is
  worth a separate list from the runtime one — a runtime property is written by
  zero's JavaScript onto an element, a medium property is a stylesheet default
  every design system inherits and any may override.

- **The no-UA-chrome guard** (`__tests__/button-affordance.test.ts`, #213).
  Reads the `element` each part declares out of the manifest and asserts, over
  the emitted CSS of all six in-repo design systems, that every part zero
  renders as a real `<button>` carries an `appearance` declaration in the
  **unconditional** rule — a reset that only applies in one state, on hover,
  under a variant or inside a `@media` query leaves the plain render wearing
  the user agent's bevel, so none of those count. `appearance` is the proxy
  because it is the one declaration that means "the paint is mine now": a
  background, a border and a font can each be set while the UA still supplies
  the chip. Sixteen parts × six design systems; it does not claim the treatment
  is *good*, only that the design system looked at the part — which is exactly
  what nothing asked before. `validate-recipes` sees `trigger: { base: {},
  states: { open: {}, closed: {}, disabled: {} } }` as fully covered, the css
  goldens recorded the absence faithfully, and the state-legibility guard is
  satisfied by a sibling part carrying the difference. Caught, on the pre-fix
  tree: seven cells — the `tooltip/trigger` of basic, daisyui, heroui and
  carbon, plus heroui's dialog, popover and menu triggers. The latter three
  shipped as its allowlist and were fixed by #214, so the guard now runs with
  **no exemptions at all**: 16 parts × 6 design systems, every cell clean. Its
  own failure mode is covered by fixtures, including the three near-misses.

- **`hiddenIn` on `ManifestPart` and in `manifest.schema.json`** (#227): the
  states zero's runtime hides a part in, mirroring `PartSpec.hiddenIn` in
  `@sigx/zero/contract`. The state-legibility guard reads it instead of the
  hardcoded avatar exemption it shipped with — a fact about zero's runtime is
  the anatomy's to state, not a test's to remember, and not something six
  design systems should each restate through `skipStates`. Unlike
  `skipStates`, one part is enough at component level: `hiddenIn` states a
  difference (a part appearing and disappearing) where a skip waives one. The
  two assertions read it as two different questions — a pair is legible when
  some part is rendered in *exactly* one of the states (hidden in both, it is
  absent either way and differentiates nothing), while an indicator is excused
  when it is hidden in *either*, since no recipe can differentiate a state it
  never renders in.

- **`print` is a named built-in condition** (#226). `at: { print: … }` emits
  `@media print` and sorts with the other preference queries — after the flat
  rules it refines, before any breakpoint. Naming it matters because print is
  the second medium where a `background`-painted indicator disappears
  (backgrounds are dropped by default, as author colours are revalued under
  `forced-colors`), and `forced-colors` having a name while `print` did not
  made the raw `@media print` prelude look like the only route.

- **The state-legibility guard** (`__tests__/state-legibility.test.ts`, #226).
  Compiles all six in-repo design systems and asserts, over the *emitted* CSS,
  that (A) for every component no pair of a part's declared states renders
  identically in every part, and (B) any `indicator` part that declares states
  distinguishes all of them itself. It reads compiled CSS rather than the
  recipe tree because state styling arrives through `states`, `selectors`,
  variants, compound variants, modifiers, nested `at` and the raw `css` hatch —
  only the output sees all seven. It judges the **default render**: rules inside
  any `@media` are excluded (the `forced-colors`/`print` glyph fallback must not
  be what proves a mark exists), as are declarations that only say how a state
  arrives (`transition*`, `will-change`, `animation-delay`) — a rule left with
  nothing else is dropped whole. `skipStates` waives it **per part**, and at
  component level only when every part carrying those states waives them.
  Caught, on the pre-fix tree: a rating group
  whose `full` and `half` were the same declaration in all six design systems,
  three checkbox indicators that painted no mark at all, and two progress bars
  where `complete` looked like `loading`. Its own failure mode is covered too:
  state-blind fixture recipes, including one differentiated only by a
  forced-colors glyph and one only by a transition, that the assertions must
  report.
  The design-system skill now teaches the rule the guard enforces: a state
  indicator is drawn geometry, interpolating between states, with a glyph
  fallback under `forced-colors` and `print`.

- **The conformance matrix, generated** (#174; docs/architecture.md, "The
  authoring surface").
  `conformanceRows` / `reportRows` / `formatConformanceMatrix` derive
  `docs/design-system-conformance.md` from the conformance fixtures and the
  in-repo coverage reports; the snapshot test in `conformance.test.ts` IS the
  row↔fixture parity check, since a row and its declaration are the same
  object. The Carbon/Ant/Radix fixtures gained the executing half — a
  Button-only design system each, validated and compiled, with the emitted
  selector strings asserted (§7.4 mechanism 2); Radix's is the repo's first
  real `tokens.axes` use and first numeric size ramp. A Material 3 fixture
  joins as the zero-native Tier-1 row, pinned verbatim to
  `packages/zero-material`.

- **The vendor-named component API declaration** (issue #179;
  docs/architecture.md, "The components artifact — vendor-named apis").
  A design system may declare, beside `tokens` and `recipes`, how zero's axis
  surfaces appear under the vendor's own prop names —
  `api: defineApi({ variants, modifiers }, { variant: { as: 'kind' }, … })`.
  This release ships the declaration only: `defineApi` (with an optional
  vocabulary argument that narrows `values` keys and modifier names at the
  declaration), `validateApi` wired into `validateDesignSystem`, and
  `apiGrade`/`modifierGrade` deriving the conformance grade
  (`exact | renamed | reshaped | unsupported`) mechanically from the
  declaration. The coverage report gains an optional `api` section (one row
  per vendor prop: where it routes, its grade, its respelled values), and
  `skills/design-system/conformance/` holds four vendor fixtures (Carbon, Ant,
  Radix Themes, HeroUI) that validate and grade in CI.

- **The generated `./components` artifact** (issue #179, phase 2). A design
  system with an `api` now gets `dist/components.d.ts` + `dist/components.js`
  from the same build: self-contained vendor-named types (no `/register`
  needed, no `ZeroVocabulary` augmentation — two design systems' modules can
  coexist) over a data-only runtime of PURE `adapt()` calls and re-exports.
  `compileDesignSystem` derives the per-component routing
  (`CompiledDesignSystem.componentApi`, via `deriveComponentApi` — the
  design-system-level declaration filtered to what each recipe wires,
  `values` pre-inverted for the runtime), `writeArtifacts` writes the module
  when present, and the DS manifest carries the routing under `api`.
  `carrierPart` moved from the web recipe compiler to `contract.ts` (pure
  manifest logic) and is now exported. `@sigx/zero-heroui` ships the first
  real adapter (`variant` exact, `isIconOnly`/`isPending` renamed), and the
  emitted `.d.ts` goldens are compiled end to end by a fourth isolated
  type-test project asserting the issue's gate.

### Changed

- **The design-system skill states that `hiddenIn` is now enforced** (#209).
  Zero's `@layer zero.structure` sits after `zero.recipes` and hides any
  `[data-scope][data-part][hidden]`, so a `display` set on a part in one of
  its `hiddenIn` states is dead rather than dangerous — it used to defeat the
  hiding outright, which is how every design system's `display: flex` on
  `tree-view.branch-content` kept collapsed branches on screen.

- **`skipStates` documents its second consumer** (#226). An entry has always
  silenced the validator's coverage warning; it is now also how a design system
  waives the state-legibility guard, i.e. it asserts "this state is deliberately
  indistinguishable from its siblings". Same field, same semantics, two readers —
  spelled out in the JSDoc, the recipe schema, the README and the skill, because
  an author silencing a warning should know they are also making a design claim.

- **`sizes: []` is now legal and means "this design system has no size axis"**
  (#164; docs/architecture.md, "Declared vocabulary"). It used to be a hard
  error, and an omitted ramp is
  silently replaced by the recommended `xs`–`xl`, so *every* compiled manifest
  advertised a size ramp — including for a design system that has none, which
  the docs site and the generation skill both read as fact. Absence and
  emptiness are now different statements: omitting `sizes` still takes the
  recommended ramp ("I didn't say"), `[]` declares there is no axis ("there
  isn't one"), matching what `roles: {}` already does for colour. A recipe
  wiring `variants.size` under an empty ramp is an error naming the missing
  axis rather than the missing value.

### Removed

- **BREAKING — `ThemeInput.components` is gone** (#160). It was
  documented as per-component theme overrides, but the emitter discarded the
  component key and wrote every value at theme scope. Worse, those values land
  in `@layer zero.tokens` while `recipe.tokens` declarations land in
  `@layer zero.recipes`, which `packages/zero/css/base.css` orders later — so a
  `theme.components` entry could never override a component token a recipe
  declares, which is exactly what the field was named for. Where it did work
  (defining a token a recipe only references) it was indistinguishable from
  `theme.extra`. No design system used it, and the emitted CSS is unchanged.
  Migration: `components: { button: { '--btn-radius': v } }` →
  `extra: { '--btn-radius': v }`, with the same cascade-layer caveat.

- **BREAKING — the `zero-kit` binary is gone.** Its two commands are now
  contributed to the [`sigx` CLI](https://www.npmjs.com/package/@sigx/cli) as a
  plugin: `zero-kit build` → `sigx zero:build`, `zero-kit validate` →
  `sigx zero:validate` (the bare `sigx build` / `sigx validate` aliases resolve
  when no other plugin claims them). Install `@sigx/cli` alongside the kit to
  get the `sigx` executable. Flags are unchanged, and each design-system
  package's own `build.mjs` — which calls the library directly — is unaffected.

### Added

- **The coverage report** (#173; docs/architecture.md, "The authoring
  surface"):
  `sigx zero:validate --report` prints what a design system *covers*, and
  `--report-json <path>` writes the machine-readable shape (`-` for stdout,
  which then carries nothing else — diagnostics go to stderr and pass/fail is
  the exit code). `sigx zero:build` writes the same report to
  `dist/report.json`, alongside `manifest.json` and `register.d.ts`, so a built
  design system carries it without anyone running `validate`. Validation
  returns a flat issue list, which says
  what is *wrong*; a scored report is what makes a generated design system
  reviewable, and the conformance matrix generates its already-proven-in-repo
  rows from this file rather than by hand.

  It carries: components styled against the anatomy manifest; the axes each
  component wires and which its `register.d.ts` types `never`; declared-but-
  unwired values per axis and per modifier — the only place an unused colour
  role or size step surfaces, since the validator has no rule for those (Material
  declares thirteen roles and wires nine); per-part state and flag coverage,
  splitting what is styled unconditionally from what only a condition, variant,
  compound or modifier reaches, and what `skipStates` delegates deliberately;
  the **axis-agnostic divergence report** — per axis,
  the per-component value sets, flagging any component wiring a strict subset of
  its siblings, generalising the colour-only cross-component warning without
  adding an authoring surface; and the minimum WCAG contrast margin per theme.

  New exports: `buildReport`, `formatReport`, `REPORT_SCHEMA_URL`, their types,
  and `undeclaredAxes` — which moved out of the register generator so the report
  and the register artifact name the same axes by construction rather than by
  coincidence. `writeArtifacts` takes an optional third argument, the report to
  emit; callers that pass nothing are unaffected. New JSON Schema
  `report.schema.json`, shipped in `dist/schemas/` like the other three.

  Two flags rather than one `--report=json` because `@sigx/args` has no
  optional-value form — a value flag given no value is a `MISSING_VALUE` parse
  error, and `.required()` governs flag presence, not value presence. They
  collapse once signalxjs/terminal#102 lands (tracked as #177).

- **Presence-only modifiers** (#166; docs/architecture.md, "Declared
  vocabulary"): `TokensInput.modifiers`
  declares them, `RecipeInput.modifiers` (name → part → styles) wires them, and
  the compiler emits `[data-mod-<name>]` — valueless, because a modifier has no
  vocabulary; the names are the vocabulary. `compoundVariants[].match` accepts
  `true` for a modifier, which is also how a presence-only condition joins a
  compound at all. Harvested into `CompiledComponentAxes.mods` and emitted by
  the register generator as `mods: { 'block': boolean }` (or
  `Record<string, never>` when a design system declares none), so an undeclared
  modifier is a type error under an opted-in design system. Declared-but-unwired
  modifiers warn like any other declared vocabulary. There is no
  `defaultVariants` analogue — absence already is a modifier's default.

  This closes the one thing the axis grammar could not express: daisyUI's
  `btn-block`/`btn-wide`, Radix's `highContrast`, Ant's boolean `danger`,
  HeroUI v3's `isIconOnly`. The closest previous encoding was a one-member axis
  (`axes: { block: ['block'] }`), which restates the name as its own value.

- **The kit is a `sigx` CLI plugin** (#154): a `"sigx-cli"` manifest field and
  a new `@sigx/zero-kit/plugin` export, built on `definePlugin` and
  `@sigx/args`. Auto-discovered in any package that depends on the kit. This
  replaces ~113 lines of hand-rolled argv parsing with declared, typed args and
  brings `--help`/`-h` per command, `--flag=value` as well as `--flag value`,
  kebab↔camel flag names, rejection of unknown flags and of value flags given
  no value, and generated help text — none of which the old parser had. The
  command surface gains its first tests.

- **The generated register artifact** (#131; docs/architecture.md, "The
  register artifact"):
  `writeArtifacts` emits `dist/register.d.ts` + `dist/register.js` per design
  system — a generated (never authored) augmentation of `@sigx/zero`'s
  `ZeroVocabulary` carrying theme names, breakpoints, the emitted
  custom-property union, per-category token unions (recommended ∪ declared
  keys), and per-component wired axis values, `never` where nothing is wired
  and `Record<string, never>` for empty axes. Every recipe scope is emitted,
  scope keys are quoted (they are kebab-case) and the file carries a
  compile-time assertion against `ZeroScope`. Exposed as
  `compileRegisterDts`/`compileRegisterJs` beside the other web-target
  emitters; `CompiledDesignSystem` gains `components`
  (`CompiledComponentAxes`: `variants` keys ∪ `compoundVariants` matches,
  `defaultVariants` recorded without widening). All four design-system
  packages gain the `"./register"` exports subpath.

### Fixed

- **The register artifact said the wrong thing about an axis a design system
  declares out of existence** (#99). A `never` axis was always explained as
  "no `<ds>` recipe wires it", which sends an author looking for a recipe gap —
  wrong advice when the design system declared `roles: {}` or `sizes: []` and
  there is no axis to wire. The generator now distinguishes the two:
  *"heroui declares no color axis at all"* versus *"no heroui recipe wires
  it"*, decided per axis rather than per design system, so a declared-but-
  unwired `variant` still reads as the recipe gap it is. Only `color` and
  `size` can be declared away — via `roles: {}` / `sizes: []`, which are
  distinguishable from an omission because omitting either yields the
  recommended set. Omitting `tokens.variants` means "check nothing", not "no
  variant axis", so `variant` is never reported that way. Surfaced by the first
  design system with no colour axis; the four existing goldens are unchanged.

- **Two unvalidated token-name paths** (#162). `recipe.tokens`
  keys were not checked at all: a key spelled without the leading `--` is
  passed through by `declBlock` as an ordinary declaration, so
  `tokens: { color: 'red' }` silently restyled every carrier element of the
  component instead of defining a token. Now an error, and so is a key that is
  not `--` plus the same kebab-case identifier every other declared name uses
  (`--Btn_Accent` is legal CSS and still wrong here). And two roles could
  derive the same custom property — role `danger-soft` emits
  `--color-danger-soft`, which role `danger` already derives — with the later
  one silently winning; now an error naming both roles. A role declaring
  `soft: false` frees the derived name, and is not flagged.

- **`compoundVariants` silently ignored `defaultVariants`** (#158). The single-axis loop mirrors a defaulted value onto the attribute's
  absence (`:not([data-variant])`); the compound loop did not, so a compound
  matching `{ variant: 'solid', color: 'primary' }` under
  `defaultVariants: { variant: 'solid' }` never applied to
  `<Button.Root color="primary">` — which carries no `data-variant` at all —
  and nothing reported it. The compound selector is now the cross product of
  each matched axis's alternatives, emitted as one rule per combination
  (`emitPartStyles` appends pseudo-element suffixes and state selectors to what
  it is handed, so a comma-joined list would bind them to the last selector
  only). No shipped design system used `compoundVariants`, so no emitted CSS
  changes.

- **Two new compound-variant validator rules** (#158): an **error** when a
  compound matches an axis the recipe never wires in `variants` — the generated
  types harvest compound match values into the axis union, so such an axis
  type-checks on its own and then matches nothing — and a **warning** when the
  axis is wired but has no rule for that particular value.

### Changed

- **`dist/manifest.json`'s `components` field changed shape**: from a bare
  scope-name array to the per-scope wired-axes record (scope names remain its
  keys). In-repo consumers updated; the zero package's own manifest is
  unaffected.

- **Declared axis vocabularies** (#129; docs/architecture.md, "Declared
  vocabulary"): `TokensInput`
  gains `variants` (the `variant` axis value set) and `axes` (custom axis
  name → value set). Both are validated like `sizes` (non-empty, kebab-case,
  no duplicates); axis names are additionally rejected against the named-prop
  axes and `RESERVED_AXES` — the validator rejects exactly what the zero
  runtime refuses to render. Once declared, a recipe `variants.variant` or
  custom-axis value outside the list is an error listing the declared set,
  wiring an undeclared custom axis is an error, and a declared value no
  recipe wires warns. Both fields flow into `CompiledDesignSystem.tokens`,
  `dist/manifest.json` and `tokens.schema.json`. Omitting them preserves
  previous behaviour exactly.
- **`defaultVariants` validation**, unconditional: every key must name an
  axis the recipe wires and every value must be one the axis wires
  (`variants` keys plus `compoundVariants` matches). Previously
  `defaultVariants: { variant: 'ghots' }` was a silent no-op.

### Changed

- **An explicit declaration closes its set**: a `variants.size` value off an
  *explicitly declared* `tokens.sizes` ramp is now an error (previously a
  warning); the default recommended ramp still warns. No shipped design
  system declares `tokens.sizes`, so nothing shipped changes behaviour.
- The duplicate colour-variant warning in `validateDesignSystem` was removed;
  the same condition is already an error in `validateRecipes`, and every
  violation used to report twice at two severities.
- All four design systems declare `variants: ['solid', 'outline', 'soft',
  'ghost']`.

## [0.1.0] - 2026-07-27

### Added

- **Pseudo-part projection** (the multi-target RFC — docs/architecture.md
  §11 — #98):
  `ManifestPart.pseudo` marks a part that renders no element of its own on
  the web (dialog's `backdrop`). `compileRecipeCss` attaches such a part's
  rules to the host part with the pseudo-element last —
  `[data-part="popup"][data-state="open"]::backdrop` — across base, states,
  nested selectors, variants and compound variants. The manifest schema
  gains the matching optional `pseudo` object.

- **`--text-fixed-<key>` aliases** (part of the multi-target RFC —
  docs/architecture.md §11 — #96): `compileTokensCss` derives a `--text-fixed-<key>:
  var(--text-<key>)` alias for every emitted `--text-<key>`, restating it in
  exactly the theme blocks that re-emit the underlying key (an alias
  substitutes its `var()` where declared — the same capture trap as
  color-referencing tokens). A literal `typography.sizes` key spelling a
  `fixed-*` name wins over the derived alias. The aliases join the token
  vocabulary, so recipes may reference `var(--text-fixed-<key>)` for any
  declared or recommended key. Exported as `TEXT_FIXED_PREFIX`
  (parity-tested against `@sigx/zero/contract`).
- **Contract docs for cross-target semantics**: `RUNTIME_PROPERTIES` are
  documented as web-only (a target that cannot resolve inline-written
  `var()` has no equivalent mechanism), and `-soft` derivation is documented
  as oklab-at-`softMix` for every emit target.

- **JSON Schemas for the authoring surfaces** (draft 2020-12), shipped in
  `schemas/` and copied to `dist/schemas/` by the build, for publication at
  `https://signalxjs.github.io/zero/schemas/`:
  `tokens.schema.json` (`TokensInput`), `recipe.schema.json` (`RecipeInput`)
  and `manifest.schema.json` — the manifest `@sigx/zero` already emitted with
  that `$schema` URL, which now exists. A generator can emit tokens/recipes as
  plain JSON, schema-check the structure, then run `zero-kit validate` for the
  semantic half. The schemas are validated against every shipped design
  system (and the real zero manifest) by the test suite, including negative
  cases, so they cannot silently drift from the TypeScript types.

- **`RUNTIME_PROPERTIES`** — the custom properties the `@sigx/zero` runtime
  writes on elements (`--press-x/y/r`, `--progress-percent`,
  `--slider-percent`) are now part of the token vocabulary, so recipes may
  reference them without a "never declares" error. The press trio is new;
  the percent pair was always written by Progress/Slider and merely never
  referenced by a shipped recipe.
- The validator warns when a recipe targets `data-press-animating` but never
  starts an animation — the runtime clears the flag as soon as no animation
  is running, so such a rule matches for zero frames.

- **A recipe may key `variants` on any axis, not just the contract three.**
  The old warning — *"no zero component ever sets that attribute, so nothing
  can match them"* — was accurate and is now obsolete: `@sigx/zero`'s new
  `axes` prop sets `data-<axis>`. It is replaced by an **error** on an axis
  that shadows the anatomy contract (`RESERVED_AXES`, mirrored from
  `@sigx/zero/contract`'s prop fragments and parity-tested), the one case that must
  still fail — `data-state` as a variant axis would repoint every
  `[data-state="open"]` rule in the design system.
- Two validator rules for the colour axis, the counterpart to the size-ramp
  check: an **error** on a `variants.color` key that names no declared role
  (it compiles to a selector `data-color` can never match), and a **warning**
  when one component wires fewer roles than its siblings. The second catches
  a component claiming the axis and under-delivering — `@sigx/zero-daisyui`
  styled only `primary` on Tabs while Button looped all eight, so
  `<Tabs.Root color="success">` type-checked, emitted the attribute and
  matched nothing. A role held back consistently across every component
  (`@sigx/zero-material`'s tonal surfaces) is a deliberate choice and says
  nothing.
- `TokenVocabulary` gains `roles`, alongside `sizes`.

### Fixed

- **Selector injection through variant axis names and values.** Recipe
  compilation interpolated them straight into `[data-<axis>="<value>"]`, so a
  value containing a quote closed the attribute early and everything after it
  was read as CSS — `size: { 'x"], [data-part="panel': … }` emitted a second,
  unrelated selector styling every tab inside any panel. `compileRecipeCss`
  now throws on an axis name or value that isn't a kebab-case identifier (the
  same `TOKEN_KEY_PATTERN` every other declared name obeys), and
  `validateRecipes` reports it as an error first, including for
  `compoundVariants.match`. `tokens.sizes` entries are checked at the
  declaration too. Affects all axes, not just `size`.

### Changed (breaking — pre-release)

- `ZeroManifest.tokens.sizeScale` is now `tokens.recommendedSizes`, matching
  `tokens.colors.recommendedRoles`. `SizeScale` widens to accept any
  DS-declared size name.
- **Extensible color roles**: the color vocabulary is now DS-declared.
  `TokensInput.roles` declares role names (each emitting `--color-<role>`,
  plus `-content` / `-soft` per its `RoleDecl`); omitting `roles` selects the
  recommended eight. `defineTokens` / `defineDesignSystem` are generic over
  the declaration, so theme `colors` keys stay autocompleted and
  completeness-checked. Only the base surfaces
  (`base-100/200/300/base-content`) remain fixed.
- The validator derives completeness and WCAG contrast pairs from the role
  declaration, errors on color tokens outside the declared vocabulary, and
  warns when `extra` is used instead of declared `custom` tokens.
- `@property` registrations for declared roles (and `custom` tokens with a
  `syntax`) are emitted at the top of the compiled `tokens.css` (moved from
  `@sigx/zero`'s `base.css`, which cannot know DS-declared names).
- The DS-level `dist/manifest.json` now carries `tokens: { roles, custom,
  breakpoints }` — the declared vocabulary for tooling and the generation
  skill.
- Removed the fixed-vocabulary exports `COLOR_VARIANT_LIST`,
  `CORE_COLOR_TOKEN_LIST`, `CONTRAST_PAIRS` in favor of
  `RECOMMENDED_ROLE_LIST`, `DEFAULT_ROLES`, `BASE_SURFACE_TOKEN_LIST`,
  `resolveRoles`, `requiredColorTokens`, `contrastPairs`.

### Added

- `TokensInput.custom` — declared DS-specific tokens (`name → { description,
  syntax? }`), valued per-theme via `ThemeInput.custom`, validated for
  completeness and surfaced in the DS manifest.
- `TokensInput.sizes` — the design system's `size` axis vocabulary, the
  analogue of `roles` for the other axis zero interprets. Recipes are
  validated against *this* ramp instead of a fixed `xs`–`xl`, so a design
  system with density steps is no longer warned on every one of them, and it
  is surfaced in the DS manifest as `tokens.sizes`. Omitted → the recommended
  ramp. `SIZE_SCALE_LIST` and `RecommendedSize`/`SizeScale` are now exported,
  so a design system can extend rather than retype it
  (`sizes: [...SIZE_SCALE_LIST, '2xl']`).
- `TokenVocabulary` gains `sizes` — it now carries the declared variant-axis
  vocabularies alongside the custom-property names, which is what the recipe
  validator checks against.
- `TokensInput.swatch` — declaration-driven theme-picker swatch (default:
  first four declared roles + base surfaces).
- `defaultSwatch(roleNames)` — that default rule, exported and mirrored in
  `@sigx/zero/contract` so `registerThemes` applies the same one at runtime.
  Previously it was inlined in the compiler and copy-pasted into each design
  system's `installThemes()`, which is how the registry and the manifest drifted
  apart; the contract-parity suite now guards it.
- `TokensInput.breakpoints` — reserved DS-level breakpoint declaration,
  surfaced in the DS manifest (consumed by the upcoming conditions support).

- `starting-style` is a built-in recipe condition, emitted after the rule it
  interpolates from. Presence — enter and exit animation — is declarative:
  zero never unmounts a popup, so transitioning `display`/`overlay` with
  `allow-discrete` is all the platform needs, and no runtime helper is
  involved.
- The validator warns about a half-animated part: `starting-style` with no
  transition to interpolate, or with no discrete property (`display`,
  `overlay`, `content-visibility`) carried by `allow-discrete`.
  The second is the silent one — the entry animates and the exit does not,
  because the element stops being rendered before it can play.
- A style-brief pack ships with the design-system skill:
  `skills/design-system/briefs/` holds four complete, compiling starting points
  (brutalist, glass, corporate, terminal), each one a full `TokensInput` plus a
  worked Button recipe. They are validated and compiled by the test suite, and
  the skill's cheat-sheet table is compared against them cell by cell, so a
  brief that goes stale fails a test instead of misleading the next reader.
- A `tokens.system` value that references a colour now resolves per theme.
  CSS substitutes `var()` where a property is *declared*, so a system-tier
  token declared once at `:root` captured that colour and every `[data-theme]`
  block inherited the captured value — a phosphor glow written
  `0 0 16px var(--color-primary)` stayed green on the amber theme. Such tokens
  are now restated inside each theme block, the way scheme-divergent values
  already were, so the reference resolves against that theme's own colours.
  This replaces the validator warning shipped alongside the brief pack: the
  shape it warned about is the shape that works.
- The validator rejects an unknown key under `system`. It was ignored
  silently, so a design system could declare a whole token category that
  never appeared, with nothing to explain why — which is exactly what a
  stale line in the agent skill caused. The message names the categories
  and suggests the right path for a category reached by its old name.
- `@sigx/zero-material` is the acceptance test for the extensible token
  vocabulary: a design language zero was not designed around, expressed
  entirely as data. It validates with no errors and no warnings, styles all
  fifteen components, and required no change to the kit.
- Both shipped design systems implement the `size` and `variant` axes for
  the new Button. They were advertised by the contract and implemented
  nowhere -- three `variants` blocks existed across both systems, all
  `color` -- so a generator had no worked example to imitate.
- **Typography in the token contract** -- `system.typography` declares
  `fonts`, `weights`, `leading`, `tracking` and the `--text-*` ramp,
  emitting `--font-*`, `--weight-*`, `--leading-*`, `--tracking-*`.
  Previously only a font-SIZE ramp existed, so a design system could not
  state its typographic voice at all: families and weights were reachable
  only through `extra`, which the validator warns on and which never
  reaches the manifest.
- `typography.scale: { base, ratio }` generates the `--text-*` ramp as a
  modular scale; explicit `typography.sizes` win per key, so a generated
  ramp with one hand-tuned display size is expressible.
- **`--font-*` means FAMILIES.** Sizes stay `--text-*`. This settles the
  naming against `@sigx/lynx-zero`, which currently uses `--font-*` for a
  control-label size ramp; that side renames when it is rewritten.
- `ThemeInput.text` / `TokensInput.system.text` moved to
  `system.typography.sizes` (breaking, pre-release).
- The validator rejects a `<number>` token carrying a unit -- CSS drops
  `font-weight: 700px` and a united `line-height` silently, the same
  failure mode as a unitless duration.
- **Recipe content validation.** Structure was already checked hard -- an
  unknown part or state fails the build -- but nothing looked inside a
  declaration, so a typo'd `var(--color-brnad)` compiled straight through
  to the shipped stylesheet and resolved to nothing. Recipes are now checked
  against a token vocabulary derived from the design system's own
  declaration, so every category added to `TOKEN_CATEGORIES` is enforced
  without touching the validator.
- New errors: an undeclared `var()` reference (with a "did you mean"), a
  component that styles `focus-visible` nowhere, a `skipStates` entry naming
  neither a state nor a flag, and variants on a component with no `root`
  part (the selectors could never match).
- New warnings: hardcoded palette colours, literal `transition` durations
  (which opt out of reduced motion), components with no recipe, and a part
  that declares `focus-visible` without styling it.
- `skipStates` now covers flags as well as machine states. Entries like
  `skipStates: { label: ['invalid', 'required'] }` were dead config, since
  those are flags -- they now mean what they always appeared to.
- Exported `tokenVocabulary` and `validateRecipes` for tooling that wants
  the vocabulary or the content pass on its own.
- **Spacing and shadow token categories** -- `system.spacing` emits
  `--space-*` and `system.shadow` emits `--shadow-*`, so a design system
  states its density and elevation once instead of scattering rem literals
  and box-shadows through its recipes. Keys are open, so an elevation ramp
  named `level1`..`level5` needs no special-casing.
- Both shipped design systems moved onto them: 76 spacing declarations and
  11 shadows, verified to resolve to byte-identical CSS. zero-basic also
  gains a heavier dark-scheme elevation ramp via `systemDark.shadow` -- a
  shadow tuned for a white page is nearly invisible on a dark one, and
  `light-dark()` cannot express it because it only takes colors.
- **Conditional recipe styles** -- `PartStyles.at` maps a condition to the
  same shape, recursively. Keys resolve to a declared breakpoint's
  `@media (min-width: ...)`, a built-in preference query, or a raw `@`
  prelude (`@container`, `@supports`, `@starting-style`).
  `TokensInput.breakpoints` -- declared but inert since it was added -- is
  now consumed. Because `variants` hold `PartStyles`, responsive variants
  need no separate mechanism.
- `compileRecipeCss` takes a third `RecipeContext` argument carrying the
  design system's breakpoints; `compileDesignSystem` passes it for you.
- `RecipeInput.css` -- raw CSS appended inside the component's own layer
  block, for anything the typed surface cannot express.
- The validator checks breakpoint declarations: kebab-case names, px/rem/em
  values, no collision with a built-in condition name, and **ascending
  order** -- declaration order is emission order, so a largest-first list
  would silently make the wider breakpoint lose to the narrower one.
- **Motion tokens** (`system.motion`) — `durations` and `easings` emit
  `--duration-*` / `--ease-*`, so a design system states its motion
  personality once instead of scattering `0.15s` through its recipes.
- **`prefers-reduced-motion` is now honored.** The compiler emits a block
  collapsing every *declared* duration to `0.01ms`. It has to be emitted per
  design system rather than living in `@sigx/zero`'s `base.css`, because
  duration keys are DS-declared and base.css cannot know a name like
  `--duration-emphasized-decelerate` — the same reason `@property`
  registration moved out of base.css. `0.01ms` rather than `0ms` keeps
  `transitionend` / `animationend` firing, which presence and exit-animation
  coordination depends on.
- The validator rejects a unitless duration. CSS ignores `150` outright, so
  the transition silently never runs and no event ever fires.
- **Token categories** — the declared-vocabulary architecture, generalized
  beyond color. `TOKEN_CATEGORIES` is a closed, kit-curated table (each entry
  fixing a `--prefix-`, the keys `@sigx/zero/css` ships fallbacks for, and a
  value grammar); the keys inside each category are declared by the design
  system and open, so a custom elevation ramp or type scale flows into the DS
  manifest without special-casing.
- `TokensInput.system` declares non-color token values **once for the design
  system** instead of restating them in every theme, with `TokensInput.
  systemDark` for dark-scheme overrides and `ThemeInput.system` for a single
  theme. Resolution: `system` → `systemDark` → `theme.system`.
  `defineTokens` / `defineDesignSystem` take a second `const` type parameter,
  so per-theme overrides narrow to exactly the keys that were declared.
- The DS `dist/manifest.json` gains `tokens.system`, `tokens.systemDark` and
  `tokens.properties` — the flat, sorted list of every custom property the
  design system emits, read back off the compiled CSS so it cannot drift
  (it includes derived tokens like `--color-<role>-soft`).

### Changed (breaking — pre-release)

- `ThemeInput.radius` / `size` / `text` / `border` / `disabledOpacity` moved
  to `TokensInput.system`. A theme keeps a `system` block for genuine
  per-theme differences.
- Compiled `tokens.css` no longer restates design-system-level token values
  inside every `[data-theme]` block — they live on `:where(:root)` and are
  inherited. Themes emit only what they actually change (plus any
  scheme-divergent values, see below). Computed values are unchanged; both
  shipped design systems lost 14 lines of pure duplication.

### Fixed

- **Every token kind now follows the system color scheme, not just colors and
  token categories.** Declared `custom` tokens, `extra` tokens and
  `components` overrides were emitted on `:where(:root)` from the default
  *light* theme unconditionally, so a theme pair whose `--glass-blur` differed
  resolved to the light value under system dark until the user explicitly
  picked a theme. All non-color properties now go through one map and one
  scheme-divergence pass, so the `prefers-color-scheme` block and the
  per-theme restatement cover them equally.
- **Non-color tokens can now differ by color scheme.** `:where(:root)` took
  *all* structural values from the light theme, so a dark theme's differing
  radius or border silently never applied under system dark. `light-dark()`
  can't help — it is a `<color>` function. Scheme-divergent values now emit a
  `@media (prefers-color-scheme: dark)` block, and every theme restates them
  so explicitly choosing the light theme while the OS is dark actually wins.
- The validator's `--color-*` namespace check for custom tokens now applies
  to every category namespace, and `systemDark` / per-theme overrides that
  name an undeclared key are errors (the runtime mirror of the type error,
  since `validate` runs against compiled JS).
- The kit's copy of zero's token contract is now genuinely parity-guarded.
  `contract.ts` claimed `zero-kit validate` cross-checked the installed
  `@sigx/zero` manifest — it never did, so the two copies could drift
  undetected. A dedicated test now compares every shared export by value,
  fails when a new shared export is added without a parity row, and
  re-derives the reserved-role-name rule from zero's actual
  `resolveColorToken` behavior. The misleading docstrings are corrected.
- Golden CSS fixtures cover the full compiled output (tokens, every
  component, and the combined index) of both shipped design systems, so
  ordering, layering and specificity regressions in the compiler are caught
  rather than assumed.
