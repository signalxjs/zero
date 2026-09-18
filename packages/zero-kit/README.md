# @sigx/zero-kit

Design-system authoring for [SignalX Zero](https://npmjs.com/package/@sigx/zero):
typed tokens and per-part recipes compiled to plain, layered CSS against the
zero anatomy manifest. The barrel is Node-only — a built design system ships
CSS plus a tiny runtime module — with two purpose-built subpaths:
`@sigx/zero-kit/define` (the `define*` helpers from a `node:`-free module
graph, safe in a browser bundle) and `@sigx/zero-kit/build` (the standard
build pipeline as one function).

```bash
npm install -D @sigx/zero-kit @sigx/cli
```

`@sigx/cli` provides the `sigx` binary; the kit plugs its `zero:build` /
`zero:validate` commands into it on install (see [CLI](#cli) below). Install it
alongside — a package manager only links the executables of *direct*
dependencies.

```ts
import { defineTokens, defineRecipe, defineDesignSystem } from '@sigx/zero-kit';

export const designSystem = defineDesignSystem({
    name: 'acme',
    tokens: defineTokens({
        // The color vocabulary is YOURS: declare any roles (omit for the
        // recommended eight). Each emits --color-<role> (+ -content/-soft).
        roles: { primary: {}, surface: { content: false, soft: false } },
        // The size axis is yours too — omit for the recommended xs–xl ramp.
        sizes: ['compact', 'comfortable', 'spacious'],
        // The variant axis, and any custom axes. Declaring them closes the
        // set: a recipe typo becomes a build error, not a minted value.
        variants: ['solid', 'outline', 'ghost'],
        axes: { density: ['compact', 'comfortable'] },
        // Non-color tokens: declared ONCE for the design system, not per
        // theme. Categories are closed; the keys inside them are yours.
        system: {
            radius: { selector: '0.375rem', field: '0.375rem', box: '0.75rem' },
            border: '1px',
        },
        // Values that must differ by color scheme (light-dark() is a <color>
        // function, so non-color tokens need this).
        systemDark: { border: '2px' },
        // DS-specific tokens, declared → validated + in the manifest.
        custom: { 'glass-blur': { description: 'backdrop blur', syntax: '<length>' } },
        defaultLight: 'acme', defaultDark: 'acme-dark',
        themes: {
            acme: {
                colorScheme: 'light',
                colors: { primary: 'oklch(60% 0.2 260)', 'primary-content': 'oklch(98% 0.01 260)', surface: 'oklch(97% 0 0)', /* + base-100/200/300/base-content */ },
                custom: { 'glass-blur': '12px' },
            }, /* … */
        },
    }),
    recipes: [
        defineRecipe({
            component: 'tabs',
            parts: { tab: { base: { padding: '0.5rem 1rem' }, states: { active: { color: 'var(--color-primary)' } } } },
        }),
    ],
});
```

Only the base surfaces (`base-100/200/300/base-content`) are fixed — they
anchor `-soft` derivation, `light-dark()` emission and theme swatches.
Declared roles are `@property`-registered in the compiled CSS and surfaced,
with `sizes`, `variants`, `modifiers`, `axes`, `system`, `custom` and
`breakpoints`, in the DS's `dist/manifest.json` (which also lists every custom
property the design system emits, and the axis values each recipe wires, per
component).
`writeArtifacts` additionally emits `dist/register.d.ts` — a **generated,
never authored** augmentation of `@sigx/zero`'s `ZeroVocabulary`, so an app
importing `@sigx/<ds>/register` gets the design system's themes, tokens and
per-component axis values as closed types.

Every variant axis works this way. `roles` names what `color` accepts,
`sizes` what `size` accepts, `variants` what `variant` accepts, `modifiers`
what `mods` accepts, and `axes` declares any further axes. The rule is one
principle: **an explicit declaration closes its set** — recipe values outside a
declared vocabulary are errors, while the default recommended ramps stay
advisory warnings. (`variants`/`modifiers`/`axes` have no recommended default,
so omitting them leaves those axes unchecked.) `sizes` is the `data-size` axis
— not `system.size`, which is the `--size-*` control-sizing unit.

**A vocabulary may belong to one scope.** Real design systems do not give every
component the same variants — Radix Themes varies a select as
`classic | surface | soft` and a button as something else. Declare the **union**
at the top level and say which part of it each scope offers:

```ts
variants: ['solid', 'outline', 'classic', 'surface', 'soft'],   // the UNION
scopes: {
    button: { variants: ['solid', 'outline'] },
    select: { variants: ['classic', 'surface', 'soft'] },
},
```

Every axis takes a restriction (`colors`, `sizes`, `variants`, `axes`,
`modifiers`), a scope may only narrow, and the vocabulary reaches the manifest,
the report and `register.d.ts`. An **absent** key means the scope offers the
whole union; an **empty list** is the claim "this scope has no such axis at
all", the same grammar `sizes: []` and `variants: []` use design-system-wide
(an omitted `variants` is only silence — the manifest's
`tokens.variantsDeclared` tells the two apart). The unit is the
scope rather than the part: zero puts one attribute per axis on the scope's
carrier and cascades it to every part below, so two vocabularies inside one
component are two **axes** — declare the second in `axes`. See
`docs/architecture.md`, "Declared vocabulary".

The cascade to inner parts is emitted as an `@scope` donut
(`@scope ([carrier][attr]) to ([carrier]) { [part] { … } }`) rather than an
unbounded descendant selector: nest one instance of a scope inside another (a
card in a card) and each part resolves its axis to the NEAREST carrier by CSS
scoping proximity, instead of source order deciding which instance's value
leaks through.

Not every modifier is an axis, either. An axis answers *which one* and always
carries a value; some design-system modifiers answer *is it on* and carry none
— daisyUI's `block` and `wide`, Radix's `high-contrast`, HeroUI's `icon-only`.
Declare those in `modifiers`, wire them in a recipe's `modifiers` block, and
consumers set them through zero's `mods` prop:

```ts
// tokens.ts
modifiers: ['block', 'icon-only'],

// recipes.ts
modifiers: { block: { root: { base: { width: '100%' } } } },
```

```tsx
<Button.Root mods={{ block: true }}>Save</Button.Root>   // → data-mod-block
```

They render into their own `data-mod-*` namespace rather than as bare
`data-<name>` flags. Zero owns the unprefixed presence-only vocabulary
(`data-disabled`, `data-pressed`, …) and **extends it between versions**, so an
unprefixed modifier named `busy` would silently start matching a `data-busy`
flag a later zero adds — with exactly the right shape and no error. A valued
axis cannot fail that way: a collision there simply never matches, and the
runtime throws. Different hazard, different treatment. A modifier has no
`defaultVariants` analogue, because absence already is its default.

Nor is the SET of axes closed. `color` / `size` / `variant` have named props
because almost every design language has them; key `variants` on any other
axis your design needs and consumers reach it through zero's `axes` prop:

```ts
variants: { density: { compact: { root: { base: { paddingBlock: '0.15rem' } } } } },
```
```tsx
<Button.Root color="primary" axes={{ density: 'compact' }}>Save</Button.Root>
```

Axis names are kebab-case and may not be ones the anatomy contract owns
(`scope`, `part`, `state`, `orientation`, or any flag) — see `RESERVED_AXES`.
Axis **values** take a wider grammar, `AXIS_VALUE_PATTERN`: lowercase letters,
digits and hyphens, repeated hyphens included — Carbon's `danger--tertiary` is
a legal declared value. What stays out is what an unescaped lynx class name
(`zx-a-<axis>-<value>`) cannot carry verbatim: `%`, `.`, quotes, whitespace,
uppercase. A spelling the grammar refuses is what the `api.values` remap is
for.

Both halves of the token contract work the same way: a **closed set of
categories**, each fixing a `--prefix-` and a value grammar, with **open keys
inside** that the design system declares. `zero-kit` curates the categories
because they carry semantics tooling needs; the vocabulary within is yours.
Omitting a category is fine — `@sigx/zero/css` ships fallbacks for the
recommended keys, so absence is never a validation error.

```bash
sigx zero:validate   # tokens, WCAG contrast (a failing pair carries a suggested passing value), recipe structure + content, CSS property spelling (`paddding` is an error naming `padding`)
sigx zero:validate --report   # what the design system covers, not what's wrong
sigx zero:audit      # does what it built say what it claims — read from the compiled CSS
sigx zero:build      # dist/css/index.css + per-component files + manifest + report + audit
```

Conditional styles live in `parts.<part>.at`, keyed by a declared breakpoint
(`@media (min-width: …)`), a built-in preference query (`reduced-motion`,
`hover-none`, `prefers-dark`, `forced-colors`, `print`) or a raw `@` prelude
(`@container`, `@supports`, `@starting-style`). Nesting composes the
at-rules, and because `variants` hold the same shape, responsive variants
need nothing extra. Author mobile-first — breakpoints are `min-width`, and
declaration order is emission order.

Unknown parts/states fail the build — the anatomy manifest is the contract.
So do undeclared token references: a recipe that says `var(--color-brnad)`
is an error naming the nearest declared token, not a stylesheet that silently
renders nothing. The vocabulary is derived from your own declaration, so it
grows with the design system rather than being a list to maintain.
The `skills/design-system` folder ships an agent skill that generates a
complete design system from a style brief and iterates against `validate`.

## Starting a design system

```sh
pnpm create @sigx/zero-ds zero-acme --brief riso    # or npm create @sigx/zero-ds …
cd zero-acme && pnpm install && pnpm build
npx sigx zero:validate --report
```

[`@sigx/create-zero-ds`](../create-zero-ds) lays down the whole package from
nothing: the brief's tokens and worked Button (`src/tokens.ts`,
`src/button.ts`), `@sigx/zero-basic`'s 50 recipes as `src/baseline.ts`, and a
`src/recipes.ts` that composes them through `fitRecipesToVocabulary` — so the
first build styles every component, whatever axis shape the brief declares.
`--brief` takes `brutalist | glass | corporate | terminal | riso | seeded | basic`;
`--baseline none` scaffolds the Button alone; `--targets web,lynx` adds the
lynx target. Non-interactive throughout — it is built for agents to drive.

## Building a design system

Every design system runs the same pipeline; it ships as one function on the
`@sigx/zero-kit/build` subpath, and a package's `build.mjs` is only its data:

```js
import { fileURLToPath } from 'node:url';
import { anatomies } from '@sigx/zero/anatomy';
import { runStandardBuild } from '@sigx/zero-kit/build';
import { designSystem } from './dist/design-system.js';

await runStandardBuild({
    designSystem,
    manifest: { components: Object.values(anatomies).map((a) => a.toJSON()) },
    // fragments: [fragment],   // ecosystem manifest fragments, merged in
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
});
```

It validates, prints every issue, refuses to emit from an invalid source
(throws after printing), compiles, runs the audit, builds the coverage report
and writes the artifacts. `sigx zero:build` calls the same function. The
audit (below) never fails the build: its findings are logged, written as
`dist/audit.json`, summarised in `report.json` under `audit` and scored;
`audit: false` skips all of that.

`targets` selects the emit targets (default `['web']`, which is today's
output exactly). The list is validated up front: unknown names fail, `web`
is not optional (every other target emits beside it), and `'lynx'` — the
class-grammar target for platforms without attribute selectors — emits
`dist/lynx/{tokens.css, components/<scope>.css, index.css, manifest.json}`
beside the web artifacts, with every declaration translated, dropped with a
`report.json` entry, or refused (the capability verdicts live in
`src/targets/lynx/capabilities.ts`). `@sigx/zero-basic` and
`@sigx/zero-daisyui` pass `targets: ['web', 'lynx']` in their `build.mjs`;
a recipe restates web-runtime references and lynx replacements in its
`targets.web` / `targets.lynx` sections.

## The authoring surface in a browser graph

The kit's barrel is Node-only — a design-system package may never
value-import it at runtime (one import drags `node:fs` into every browser
consumer). The `define*` helpers live on `@sigx/zero-kit/define`, whose
module graph is `node:`-free by contract (pinned by a test that walks it), so
a design-system module that sits in a package's runtime graph writes:

```ts
import { defineApi } from '@sigx/zero-kit/define';
```

and keeps the full literal narrowing without a `satisfies` reimplementation.

### `fitRecipesToVocabulary`

The one thing on `/define` that is not a `define*` helper. Given a recipe
list and a `TokensInput`, it returns the recipes fitted to what the tokens
declare: `variants.color` keeps declared roles only; `variants.size`,
`variants.variant`, custom axes and `modifiers` keep declared values once
the corresponding vocabulary is declared (`sizes: []` empties the size
axis); `defaultVariants` and `compoundVariants` naming a dropped value go
with it; every `var(--color-<role>…)` the tokens never define is redrawn on
the base surfaces (`base-content` / `base-100` / `base-200`), and a
category step the tokens never declare (`var(--ease-exit)`) collapses to
the category's resting step (`--ease-standard`). Pure, and the identity for
recipes that already fit — every in-repo skin round-trips deep-equal.
`explainFit` returns the counts instead of the recipes. The scaffold's
generated `src/recipes.ts` is its caller; delete the call once the recipes
speak the design system's own vocabulary.

## Deriving a palette

Every theme colour used to be authored by hand, and the only thing between
a guessed `oklch()` and a shipped 2.8:1 label was the validator's contrast
check after the fact. `derivePalette` runs the other way: from the hues that
carry the brief it derives every token `requiredColorTokens(roles)` asks for
— base surfaces, roles, `-content` pairs — and solves each pair's lightness
so the floor holds **by construction**. `deriveThemePair` does it for a
light and a dark theme at once, already wired to each other:

```ts
import { deriveThemePair } from '@sigx/zero-kit/define';

export const tokens = {
    roles,
    defaultLight: 'ink',
    defaultDark: 'ink-dark',
    themes: {
        ...deriveThemePair({ roles, seeds: { primary: 205, accent: 55 }, light: 'ink', dark: 'ink-dark' }),
    },
};
```

`{ primary: 260 }` is enough. The four semantic roles take fixed hues (info
245, success 155, warning 85, error 25), `secondary` and `accent` follow the
`harmony` rotation (`analogous` by default; `complementary`, `split`,
`triadic`), `neutral` is the primary hue desaturated, and any role the kit
has no opinion about (`tertiary`, `surface-container`) falls back to the
primary hue at an index-derived lightness — seed it for a real colour. A
seed can be a bare hue or `{ hue, chroma?, lightness? }`; `base` tints the
surfaces; `floors` moves the targets (4.5:1 per role pair, 7:1 for
`base-100` against `base-content` by default).

What is guaranteed, measured on the emitted strings: every `<role>` /
`<role>-content` pair at or above the floor, every value inside the sRGB
gamut, a seeded hue preserved to the tenth of a degree, and exactly the
declared key set — no `-content` for a `content: false` role, never a
`-soft` (the compiler derives those from `softMix`), only the base surfaces
for `roles: {}`. The derivation is deterministic: the same seeds always
produce the same strings, so a derived theme can sit in a golden.

It lives on `@sigx/zero-kit/define`, so a `tokens.ts` in the browser bundle
may call it. The colour math is hand-rolled for that reason (the `/define`
graph may only reach relative modules) and is pinned against culori to 1e-6
by `palette.test.ts`. `solveContentLightness(fg, against, floor)` and
`contrastRatio` are exported for callers that have already parsed a colour
and want the same solver — the validator's suggested fix for a failing pair
is built on it.

## The vendor-named component API

A design system may declare, beside `tokens` and `recipes`, how zero's axis
surfaces appear under the vendor's own prop names (issue #179;
`docs/architecture.md`, "The components artifact — vendor-named apis"):

```ts
import { defineApi } from '@sigx/zero-kit/define';
import { variants, modifiers } from './tokens.js';

export const api = defineApi({ variants, modifiers }, {
    variant: { as: 'kind', values: { 'danger-tertiary': 'danger--tertiary' } },
    size: { values: { sm: 'small', md: 'medium' } },
    modifiers: { 'icon-only': { as: 'hasIconOnly' } },
    components: { button: { variant: { as: 'type' } } },
});
```

`as` renames a surface (Carbon's `kind`, Ant's `type`); `values` respells
individual members whose vendor spelling the attribute grammar cannot hold —
the rendered attribute keeps the zero spelling, only the prop surface
respells. All five surfaces map: `color`, `size`, `variant`, custom `axes`
and `modifiers`. `components` scopes an override to one component,
REPLACING the DS-wide entry for the surfaces it names — and it is where a
rename that shadows a component-specific prop must live: `api.variant = {
as: 'name' }` design-system-wide would silently delete Select's `name`, so
the validator rejects any DS-wide mapping onto a prop in
`RESERVED_PROPS_BY_SCOPE` and points at `api.components.<scope>`, where the
shadowing is a per-component decision (Ant's `type` over Button's native
`type` — vendor-faithful, chosen for Button alone). Zero's own components are untouched: `variant` stays `variant`
everywhere, and the declaration only shapes the design system's *additional*
`./components` module. The declaration is validated against the declared
vocabulary (`validateApi`, run inside `validateDesignSystem`), and the
conformance grade — `exact | renamed | reshaped | unsupported` — derives from
it mechanically (`apiGrade` / `modifierGrade`), so a conformance-matrix row
and the artifact it points at are the same object. The coverage report gains
an `api` section listing every vendor prop, where it routes, and its grade.

A design system that declares an `api` gets a generated `./components`
module in its build: `dist/components.d.ts` (self-contained vendor-named
types — no `/register` import needed, nothing augments `ZeroVocabulary`) and
`dist/components.js` (data only — one PURE `adapt()` call per component that
routes anything, a plain re-export otherwise; all behaviour lives in
`@sigx/zero/adapt`, written once and never generated). Add the subpath to the
package's exports map:

```json
"./components": { "types": "./dist/components.d.ts", "import": "./dist/components.js" }
```

and consumers write `import { Button } from '@sigx/<ds>/components'` —
`<Button kind="ghost" hasIconOnly>` fully narrowed, rendering the unchanged
zero attributes. The DS manifest carries the per-component routing under
`api` for tooling. `skills/design-system/conformance/` holds real vendor
fixtures (Carbon, Ant, Radix Themes, HeroUI, Material 3) that validate,
compile and grade in CI; `@sigx/zero-heroui` ships the first real adapter,
and `docs/design-system-conformance.md` — the conformance matrix
(`docs/architecture.md` §7) — is generated from the fixtures and the
in-repo coverage reports
(`conformanceRows` / `reportRows` / `formatConformanceMatrix`), so a matrix
row and the artifact it cites are the same object.

## CLI

The kit is a plugin for the [`sigx` CLI](https://www.npmjs.com/package/@sigx/cli):
having `@sigx/zero-kit` in a package's dependencies is the whole wiring. The
CLI discovers it there and offers its commands in any directory that looks like
a design-system package.

```
sigx zero:validate [entry] [--manifest <path>] [--extra-manifest <path>]...
                   [--strict] [--report] [--report-json <path>] [--diff <path>]
                   [--log <path>]
sigx zero:audit    [entry] [--manifest <path>] [--extra-manifest <path>]...
                   [--strict] [--rule <id>]... [--json <path>]
sigx zero:build    [entry] [--manifest <path>] [--extra-manifest <path>]...
                   [--out <dir>]
```

`entry` is a compiled ES module (default `./dist/design-system.js`) exporting
the design system as `designSystem` or as its default export. `--manifest`
defaults to `@sigx/zero/manifest.json` resolved from the current directory, so
the contract checked is the one the project ships; it takes either a path or a
module specifier. `--strict` turns warnings into a failure — the flag to use in
CI.

`--extra-manifest` (repeatable, path or module specifier) merges an ecosystem
**manifest fragment** into the base manifest instead of replacing it — how a
design system opts into covering a component some other package ships. See
"Ecosystem components" below.

## Spacing rides the ramp

`sigx zero:audit` includes two `spacing/*` rules, and they are about a
mechanism rather than tidiness. Because a recipe writes `var(--space-md)`
rather than `0.5rem`, an app gets a density mode for free:

```css
[data-density="compact"] { --space-md: 0.375rem; --space-lg: 0.5rem; }
```

Custom properties inherit, app CSS is unlayered so it wins, no JS is
involved, and it survives a design-system swap. Every literal is inert under
that switch, so:

- **`spacing/literal`** (warning) — the number IS a declared step, written
  out. Replacing it with the token is pixel-identical.
- **`spacing/off-ramp`** (error) — the number is on no declared step, so it
  is both untraceable to a token and inert. Fixing it changes pixels.

Exempt on purpose: `em` lengths (spacing that tracks type, not the ramp),
anything inside parentheses (`calc(var(--space-lg) - 2px)` already rides it),
and `0`.

A **recipe pack** should give its ramp references a fallback —
`var(--space-md, 0.5rem)`. `system.spacing` is optional, and a design system
that omits it emits no `--space-*`; on web zero's base stylesheet still
resolves the reference, but lynx has no fallback layer, so the declaration
would be dropped and the part would paint nothing. `sigx zero:fragment`'s
hostile-vocabulary probe refuses exactly that.

## Ecosystem components

An ecosystem component package is a peer of `@sigx/zero`: it builds its
component from zero's public surface (`defineAnatomy`, the behaviors, the
contract helpers — see zero's "Building your own components") and publishes a
**manifest fragment**:

```json
{
    "version": 1,
    "package": "@acme/zero-stepper",
    "components": [ /* defineAnatomy(...).toJSON() */ ]
}
```

`version` is the fragment contract version (`FRAGMENT_VERSION`) and is
required — the merge hard-errors on a missing or unknown one, so a fragment
built against an older contract fails by name instead of merging silently.

`sigx zero:fragment`, run inside the component package, emits
`dist/fragment.json` and checks what would otherwise fail in an adopter's
build: the `version` literal against `FRAGMENT_VERSION`, the schema, the
merge against the installed `@sigx/zero`, that the declared path is inside
`"files"` (strictly for an exact path or a directory prefix like `dist` or
`dist/**`; a glob it cannot model is assumed to ship), that recipes style only
parts and scopes the fragment declares,
that the root exports `componentExportName(scope)`, and that the pack still
compiles *and paints* when fitted to a vocabulary with no colour roles and no
size ramp. An unprefixed scope and a pack that is not lynx-clean are warnings,
not failures. No bare alias — `fragment` is a word other plugins may want.

The package points at that data entry with a `"sigx-zero"` field, shaped like
the `"sigx-cli"` field this plugin is itself discovered through:

```json
"sigx-zero": { "fragment": "./dist/fragment.js", "requires": ">=0.2.0" }
```

A design system then adopts every dependency that declares one, **by
default** — installing the package is the opt-in. `ecosystem: false` on
`runStandardBuild` turns it off, and `ZERO_ECOSYSTEM=0` overrides any build. Narrowing is programmatic:
`ecosystem: { exclude: [...] }` or `{ include: [...] }`, where `include`
means *only* those; the CLI surfaces the exclusion half as
`--ecosystem-exclude` and has no `include` flag. A pack that cannot be
loaded or merged is named and skipped rather than swallowed — `strict: true`
makes it fatal — and packs are adopted in package-name order so the emitted
artifacts do not depend on how dependencies were written down.

Diagnostics about an adopted scope name their owner — validation issues,
audit findings and lynx capability findings all carry an optional `package`,
and the printed line reads `recipes.acme-stepper (from @acme/zero-stepper)`.
The emitted `dist/manifest.json` carries a top-level `externalScopes`
(scope → owning package) for the same reason: a consumer must be able to tell
a foreign scope from one of the design system's own.

An adopted pack's recipes are fitted to the adopting vocabulary
(`fitRecipesToVocabulary`), restricted to the scopes the pack's own fragment
declares, de-duplicated against scopes the design system already styles (the
design system's recipe wins; two recipes for one scope is a hard compile
error, so this is a drop rather than a shadow) and then appended. A pack
recipe the lynx emitter refuses costs that scope the lynx target — recorded
in `report.json` under `lynx.webOnly` — where a first-party recipe would fail
the build.

`sigx zero:extend --ds <package> --out <dir>`, run in an **app**, compiles an
already-published design system against that app's own ecosystem packs. It
writes `zero-extend.css` (the added scopes only) and a `zero-extend.js` /
`.d.ts` pair — a replacement register, shaped like a design system's own
`/register`. The app imports the `.js` and **removes** its
`<package>/register` import: `ZeroVocabulary.components` is a property, so two
augmentations collide, and they accumulate across a program rather than
replacing one another. It
refuses a `zeroVersion` mismatch between the installed design system and the
app's kit.

A design system can also merge the fragment by hand — `--extra-manifest` on
the CLI, or `mergeManifests(base, fragment)` in a `build.mjs`-style script —
and write (or import) a recipe for the scope like any other. Hand-passed
`fragments:` merge before discovery and win a scope collision. Everything downstream is scope-agnostic, so validation, recipe
compilation, the vocabulary system and the coverage report all just work; the
merge hard-errors on a scope collision, which is why fragment scopes should
carry a vendor prefix (`acme-stepper`). It also holds the fragment to the
shared vocabularies — flags, governed states (a synonym like `expanded` fails
with "use `open`"), placements, `hiddenIn ⊆ states`, an acyclic part
tree, and the naming rule on any `models` it declares (`default<Concept>` +
`<concept>Change`, a named model's concept its name) — so the "no synonyms"
rule binds on the ecosystem surface, not only on zero's own anatomies.

Provenance travels with the merge. Merged scopes are tracked as *external* on
the compiled design system (`externalScopes`), the generated `register.d.ts`
excludes exactly them — by name — from its ZeroScope compile gate (the
typo/version-skew guard keeps full strength for zero-origin scopes, and the
emitted comment records who owns what), and under api mode the generated
`./components` module imports an external scope from its owning package's root
export instead of `@sigx/zero/<scope>`.

A component may also ship a **recipe pack** — `RecipeInput[]` written against
the recommended token grammar (`var(--color-primary)`, the recommended sizes)
— so any design system that keeps the recommended vocabulary can adopt its
styling by importing the recipes rather than writing them. A design system
that never merges the fragment simply leaves the component unstyled — which is
still accessible and correctly attributed, the contract's baseline.

The commands are namespaced so another plugin's `build` can't shadow them; the
bare `sigx build` / `sigx validate` aliases also resolve when nothing else
claims those names. Both exit non-zero on failure, and `sigx zero:build --help`
prints the current flags.

## The coverage report

Validation answers "is this correct" and returns a flat list of issues.
`--report` answers the other question — what the design system actually
*covers*:

```bash
sigx zero:validate --report                 # human-readable summary
sigx zero:validate --report-json report.json
sigx zero:validate --report-json -          # JSON on stdout, ready to pipe
```

```
heroui — coverage report
  score 68.4 (D): components 2 · vocabulary 92.3 · states 75 · contrast 100 · issues 94
  components styled: 1/52 (2%)
    unstyled: accordion, avatar, collapsible, combobox, menu, …
  declared out of existence: color
  color wired: 0/1 (0%) — no such axis
  size wired: 1/1 (100%)
  variant wired: 1/1 (100%)
  states+flags covered: 6/8 (75%) (0 conditionally, 0 skipped deliberately)
  theme hero-light: min contrast 14.33:1 (base-300 vs base-content)
```

The **score** is the line a generating agent iterates against — one number
that moves, and a grade that says when to stop (`A` ≥ 90, `B` ≥ 80, `C` ≥ 70,
`D` ≥ 60, else `F`). It is folded from the sections under it, never from
anything else: components styled (weight 25), declared axis values honoured
by some recipe and claimed by some scope (15), part states and flags covered
(20), the WCAG margin of the declared role pairs in the *weakest* theme (25),
and the validation counts when the report was built alongside a validation
pass (15 — ten points an error, two a warning). A sixth criterion, `audit`,
joins the weighting when an audit score is handed to `computeScore`; absent
criteria drop out and the weights renormalise, so a report built without a
validation pass is comparable to one built with it. Three things it
deliberately does not do: penalise a declined axis (`roles: {}` / `sizes: []`
are statements — an axis in `declaredOut` leaves the denominator, and a role
declared as a fill with `content: false` / `soft: false` is a token, not an
axis value), give full credit for `skipStates` (half — a recipe that skips
every state cannot score above 50 on that criterion), or score per-scope
`variant` wiring (the carriers that leave it unwired do so by recorded
decision). Every criterion carries the counts it was computed from under
`detail`, so a number can be argued with. The six in-repo skins score
93–97 (A); a Button-only start scores 68 (D).

The report is emitted whether or not validation passes — a design system that
fails is exactly the one whose coverage is worth reading. (The one exception is
a design system that does not compile at all: that is already an error, and
there is nothing to report about it.)

`sigx zero:build` writes the same report to `dist/report.json` alongside
`manifest.json` and `register.d.ts`, as does `writeArtifacts` when handed one —
so a built design system carries its report without anyone running `validate`.
The document is `reportVersion: 2` (`schemas/report.schema.json`); version 2
added the required `score` section.

It carries, per design system: the score above; components styled against the anatomy manifest;
the axes each component wires, and which its `register.d.ts` types `never`
(derived from the same harvest, so the two cannot disagree); declared-but-unwired
values per axis and per modifier — the only place a declared-but-unused colour
role or size step surfaces, since the validator has no rule for those; per-part
state and flag coverage, including what `skipStates` delegates deliberately
(that field has a second reader — the state-legibility guard treats an entry as
"this state is deliberately indistinguishable from its siblings", so it waives
more than the coverage warning); the
**axis-agnostic divergence report**, listing per axis the per-component value
sets and flagging any component wiring a strict subset of its siblings; and the
minimum WCAG contrast margin per theme across the declared role pairs.

`--report-json -` makes stdout carry the JSON and nothing else — diagnostics go
to stderr and pass/fail is the exit code. Two flags rather than one
`--report=json` because `@sigx/args` has no optional-value form yet; they
collapse once it does.

### Comparing two runs

```sh
sigx zero:validate --diff dist/report.json   # what moved since the last build
```

`--diff <path>` reads an earlier `report.json` and prints what changed between
it and the report of the current source: the score and each criterion's delta,
scopes newly styled or unstyled, values newly wired or unwired, states newly
covered or uncovered, declared role pairs that crossed the 4.5:1 or 3:1
contrast thresholds in either direction, and the validation counts when both
reports carry them. `sigx zero:build` writes `dist/report.json` every run, so
the loop is build → change → `--diff dist/report.json`. Programmatically it is
`diffReports(prev, next)` and `formatReportDiff(diff)`, pure functions over two
reports — no design system, no manifest, no `node:`.

Compare like with like: a build that merged an ecosystem fragment
(`build.mjs` with `mergeManifests`) and a validate run without the matching
`--extra-manifest` were asked about different manifests, and the diff says so
(`manifest differs … removed ext-stepper`) rather than calling the missing scope
unstyled.

Two things the diff will not do. A state moved into `skipStates` is listed as
*newly skipped*, never as resolved — the same half-credit stance the score
takes, so a waiver cannot read as progress. And two reports of different
`reportVersion` are refused with a message naming both: the older one needs
regenerating with this kit, not a best-effort comparison of two shapes.

### Watching the loop

```sh
export ZERO_ITERATION_LOG=.zero-iterations.jsonl   # once, before the first run
sigx zero:validate --report                        # every run appends one line…
# [sigx] iteration 7 — errors 0 (was 3), warnings 3 (was 14), score 92 → A (was 71 C); top: contrast-floor ×2, recipes.button ×1
```

The skill calls generate → validate → fix "the point", and this is what
observes it: opt-in, local, append-only. With `ZERO_ITERATION_LOG=<path>` in
the environment (or `--log <path>` on one run — the flag wins), every
`zero:validate` appends one JSON line — timestamp, error and warning counts,
the score and grade when the design system compiled, the five rules that
fired most, and wall-clock — and prints the trend line for that run, each
count beside what it was the run before. The rule ids are `ValidationIssue.rule`
where a rule has one and the first two segments of `where` (`recipes.button`,
`themes.dark`) where it does not. Nothing runs unless a path is named, and
nothing leaves the machine; add the file to `.gitignore`. A log that cannot
be written warns and the run carries on to its verdict. Programmatically:
`iterationEntryFrom(...)` builds an entry, `formatIterationLine(entry, index, prev)`
the line for one run and `formatIterationLog(entries)` every line — all pure. A line a killed run left half-written is skipped, never
fatal.
## The audit

Validation says whether the design system is *correct*; the report says what it
*covers*; the audit says whether what it built **says what it claims** — the
questions this repo's own CI asked of its six skins from vitest files, and
which a design system generated anywhere else could not ask at all until they
shipped with the kit:

```ts
import { auditDesignSystem, formatAudit } from '@sigx/zero-kit';

const result = auditDesignSystem(designSystem, manifest);
console.log(formatAudit(result).join('\n'));
result.findings;   // AuditFinding[] — severity → rule → where, each naming its fix
result.waived;     // what a declared mechanism excused, listed rather than swallowed
result.contrast;   // the static contrast matrix's full cell table, per theme
result.summary;    // { errors, warnings, info, byRule }
```

Every rule reads the **compiled CSS**, not the recipe tree — state styling
reaches the stylesheet through seven doors (`states`, `selectors`,
`variants.*`, `compoundVariants`, `modifiers`, nested `at`, raw `css`) and only
the artifact sees all of them. Twelve rules:

| Rule | Severity | It reports… | Waived by |
|---|---|---|---|
| `state-legibility/component` | error | two declared states no part of the component renders differently | `skipStates` on every part that has them; the anatomy's `hiddenIn` |
| `state-legibility/indicator` | error | an `*indicator` part that renders identically across its own states — a spacer, not an indicator | `skipStates` on the indicator; `hiddenIn` |
| `state-legibility/disclosure` | error | the control of an in-flow disclosure (collapsible, accordion, tree-view) that says nothing about `open`/`closed` — the panel expanding is the browser's doing | `skipStates` on the control; a sibling `*indicator` that differentiates |
| `button-affordance` | error | a part zero renders as a real `<button>` with no unconditional `appearance` reset, so the user agent paints its chip | — (set `appearance: none`) |
| `axis-value-coverage/gap` | error | a declared step a sibling scope implements that this scope neither paints nor claims as its base (#258's shape) | `tokens.scopes` |
| `axis-value-coverage/ambiguous-base` | error | two values written as empty entries, both claiming the base and rendering identically | — |
| `axis-value-coverage/unused` | warning | a declared value no recipe paints or claims; or one in no scope's vocabulary | a role declared `content: false` / `soft: false` (a fill, not an axis value) |
| `axis-coverage` | warning | a styled scope that accepts a declared `color`/`size` axis at runtime and wires nothing | `roles: {}` / `sizes: []`; `tokens.scopes.<scope>.colors: []` / `.sizes: []` |
| `reduced-motion/loop` | error | an infinite animation in the default render with no `animation: none` for the same selector under `prefers-reduced-motion: reduce` as its only condition — the kit collapses durations there, so a loop strobes rather than stops; a cancel also gated by `@supports` or a second `@media` stops it for some readers, not all | — (a loop that only exists behind `@supports` / `@container` is not the default render's and is not judged) |
| `contrast/text` | error below 3:1 per cell; warning 3–4.5:1, once per (part, theme) naming the worst cell; `disabled` error below 2:1 pre-fade | a text-bearing part whose computed ink against its effective background clears no floor, in any state × flag combination, in any theme — the design system's own axis surface (every wired `variant`/`color` value, each modifier) included | — |
| `contrast/indicator` | error below 3:1 per cell; 3–4.5:1 is `info` (a non-text mark meets WCAG 1.4.11 at 3:1) | a mark whose whole job is paint (the tick, the dot, the thumb, the range, the chevrons, the star) that cannot be seen against what it is painted on, measured inside its real ancestor chain | — |
| `contrast/unmeasured` | info | cells the static reader could not judge, once per (scope, part, reason) with the count — never a pass, never a failure | — |

Only the default render counts: a difference that lives under a `@media`
(the `forced-colors` glyph fallback, a breakpoint, `print`) is not the reader
differentiating. The rule modules under `src/audit/rules/` carry the full
reasoning in their docblocks, and each has fixtures it MUST report — the
in-repo skins are held to zero findings through the same function.

### The static contrast matrix

The three `contrast/*` rules are the browser contrast audit
(`examples/playground/e2e/contrast-audit.spec.ts`) computed from the compiled
CSS: the same two matrices (text legibility over every text-bearing part in
every renderable state combination plus the wired axis surface; indicator
paint over the parts whose job is paint, each in its real ancestor chain),
the same cell keys, the same colour math (premultiplied, 8-bit rounded where
a canvas would round), the same floors — 3:1, the 4.5:1 AA band as a
warning for text (one finding per part and theme, the worst cell named; the
table keeps every cell) and a note for a mark (WCAG 1.4.11 holds a non-text
mark to 3:1), and `disabled` on its own 2:1 floor measured on the pair *before*
the state's uniform fade. Every cell is on `result.contrast` with its verdict
(`pass`, `warn`, `fail`, `disabled-fail`, `unrendered`, `unpainted`,
`unmeasured`), ratio, in-group ratio, ink, backdrop and carrier.

What makes it honest rather than merely static: a browser always produces a
pixel, and a reader of CSS sometimes cannot. Every such cell is `unmeasured`
with one of a closed set of reasons — `gradient-or-image` (paint whose extent
the reader cannot see), `unresolved-var`, `runtime-property` (`--press-*`,
written inline by the runtime), `unsupported-selector` (`:has()` on a node
with children, `:nth-*()`, sibling combinators), `unparseable-color`,
`currentcolor-cycle`, `filter-or-blend` (light changed after the fact),
`unknown-geometry` (a transform with no determinant the reader can take),
`raw-css`, `conditional-rule` (a declaration under `@supports`, `@container`
or a `@media` query the reference page cannot decide) — and
`contrast/unmeasured` lists them as `info`: cells to eyeball
in the playground, never a pass and never a build break. Interaction
pseudo-classes are not measured (the resting render, as in the browser),
`box-shadow` does not count as a carrier (it does not survive
`forced-colors`), and nested same-scope instances are not modelled. `@media`
queries are evaluated against the browser matrix's page (`REFERENCE_MEDIA`:
Playwright's Desktop Chrome — 1280×720, `hover: hover`, `pointer: fine`,
light scheme, no preference flags), so a `min-width` breakpoint that page
meets applies and a `hover: none` block does not. The
browser audit stays the ground truth; the six in-repo skins are held to zero
`contrast/*` errors through this function and to a named set of unmeasured
reasons each, so the estimate can neither drift into lying nor retreat into
not measuring.

Pass `{ themes: ['dark'] }` to measure a subset of themes and
`{ axisCellBudget }` to raise the chained-cell ceiling (tripped, never
silently applied). `buildReport(…, { contrast: result.contrast })` folds the
matrix into `report.contrast` — per theme: cells, measured, failing,
warnings, disabled failures, and the unmeasured count by reason — via
`summarizeContrast`, which `formatReport` prints as one line per theme.

`auditDesignSystem` never throws on a finding: a design system mid-iteration
must be able to read its own audit. Pass `{ rules: [...] }` to run a subset
and `{ compiled }` to reuse a compile you already have.

**It is held to the browser.** The playground's `e2e/contrast-audit.spec.ts`
imports this cell product and, in every `contrast:` test, compares the
static reading of each claimed cell to the browser's under the same key —
painted-at-all, ratio within `max(0.15, 2%)`, floor verdict — and pins each
skin's measured share from both ends. The browser is the ground truth; a
disagreement is fixed by making the reader report `unmeasured` for the
construct it misread (or by modelling it, as the UA stylesheet's
`buttontext` on a real `<button>` and `calc()` border widths now are),
never by bending the floor.

### `sigx zero:audit` and `dist/audit.json`

The command is where the exit code lives: error findings fail it, warnings
fail it under `--strict`, `info` never does. It prints the audit (errors
first, one line per finding, a `waived:` count per mechanism), and
`--json <path>` writes the artifact — `-` for stdout, which then carries
nothing else, so it pipes.

```bash
sigx zero:audit                              # every rule; exit 1 on an error finding
sigx zero:audit --strict                     # …and on a warning finding
sigx zero:audit --rule button-affordance     # one rule (repeatable)
sigx zero:audit --json -                     # the audit.json document on stdout
```

`zero:build` runs the same audit after the compile, before the report
(which folds the summary in and scores it), and writes it as
`dist/audit.json` (`schemas/audit.schema.json`: `findings`, `waived`,
`summary`, sorted severity → rule → where). The summary — `{ errors,
warnings, info, byRule }` — also lands in `report.json` under `audit`, and
the score's sixth criterion reads it: `100 − 10·errors − 2·warnings`, the
issues formula applied to findings (`auditScore`), `info` never charged.
`zero:validate --report` runs the audit for the report's sake too, so the
report it prints and the one the build writes are the same document. A
design system that fails validation cannot be audited (there is no compiled
CSS to read); the command says so in the validator's words.

## JSON Schemas

The package ships JSON Schemas (draft 2020-12) for the authoring surfaces.
`schemas/` is in-repo source; the npm package publishes only `dist/`, so
consumers find them at `dist/schemas/`. Each `$id` points at the docs-site
URL where they will be served (publishing tracked on the docs repo):

- `https://signalxjs.github.io/zero/schemas/tokens.schema.json` — `TokensInput`
- `https://signalxjs.github.io/zero/schemas/recipe.schema.json` — `RecipeInput`
- `https://signalxjs.github.io/zero/schemas/manifest.schema.json` — the
  `@sigx/zero` anatomy manifest (`dist/manifest.json` declares it as its
  `$schema`)
- `https://signalxjs.github.io/zero/schemas/ds-manifest.schema.json` — the
  **design-system** manifest a compiled DS ships as `dist/manifest.json`.
  A different artifact from the anatomy manifest — the two share a basename
  and nothing else. Versioned (`manifestVersion`, `DS_MANIFEST_VERSION` in
  code, the `DesignSystemManifest` type on the package root), and
  `writeArtifacts` self-validates against it before writing, so a shape break
  fails the build that produces the manifest rather than the app that reads it
- `https://signalxjs.github.io/zero/schemas/audit.schema.json` — the audit
  (`dist/audit.json`, `sigx zero:audit --json`): findings, waivers, summary
- `https://signalxjs.github.io/zero/schemas/report.schema.json` — the coverage
  report (`dist/report.json` declares it as its `$schema`)
- `https://signalxjs.github.io/zero/schemas/fragment.schema.json` — the
  ecosystem manifest fragment (`--extra-manifest` / `mergeManifests`)

They close the JSON-first authoring loop: a generator (AI or otherwise) emits
tokens and recipes as plain JSON, checks them against the schema for
structural mistakes, wraps them in `defineTokens` / `defineRecipe`, and runs
`sigx zero:validate` for the semantic half — completeness, WCAG contrast,
anatomy and token-reference checks the schema can't see. The schemas are kept
honest by the test suite, which validates every shipped design system's
tokens and recipes (and the real zero manifest) against them.

MIT © Andreas Ekdahl
