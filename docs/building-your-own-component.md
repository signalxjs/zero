# Building your own component on zero

Zero's component set is closed; its **authoring surface is not**. An
ecosystem component package is a *peer* of `@sigx/zero` — it ships a
component zero doesn't, built from the same public machinery zero's own
components are built from, and held to the same contract. This guide is the
map; the worked example is
[`packages/zero-ext-example`](../packages/zero-ext-example) (an `ExtStepper`),
adopted end to end by
[`packages/zero-basic`](../packages/zero-basic)'s `build.mjs`.

## The shape of an ecosystem package

Four exports, two entries:

| What | From | Why |
|---|---|---|
| the anatomy | main entry | `defineAnatomy('<vendor>-<name>', parts)` — the source of truth |
| the component | main entry | built from `@sigx/zero`'s behaviors + contract helpers — exported under the scope's Pascal spelling (`acme-stepper` → `AcmeStepper`): an api-declaring design system's generated `./components` module imports exactly that name |
| the **manifest fragment** | a data-only entry | how a design system learns the scope exists |
| a **recipe pack** (optional) | the same data entry | default styling any recommended-vocabulary DS can adopt |

Keep the fragment/recipes entry free of component imports — a design
system's Node build script imports it, and must not drag in a UI runtime.

## 1. Declare the anatomy

```ts
import { defineAnatomy } from '@sigx/zero/anatomy';

export const stepperAnatomy = defineAnatomy('acme-stepper', {
    'root': { element: 'div' },
    'item': {
        element: 'button',
        states: ['active', 'complete', 'inactive'],   // closed set
        flags: ['disabled', 'focus-visible'],          // from FLAG_VOCABULARY only
        tokens: ['color', 'radius-selector', 'text'],
        asChild: true,
    },
});
```

Rules that make it a *zero* anatomy:

- **Vendor-prefix the scope** (`acme-stepper`). The merge hard-errors on
  collisions; the prefix is what keeps you out of everyone's way.
- `data-state` values form a closed set; boolean flags come from zero's
  shared `FLAG_VOCABULARY` (never invent synonyms) and render presence-only.
- A part the runtime hides with `hidden` in some state declares `hiddenIn`.
- `anatomy.toJSON()` emits exactly the manifest component shape — you never
  hand-write manifest JSON.

## 2. Build the component from the public surface

Everything zero's own components use is exported: `createControllableState`
(the `Define.Model` convention), `createId`/`zeroPlugin` (SSR-safe ids),
`createListController` + `createRovingKeydown` (registration and arrow-key
focus), `createDismissable`, focus utilities, `createPressFeedback`,
`createTypeahead`, `createAnchorPosition`, and the contract helpers
`dataAttr` / `stateAttr` / `variantAttrs` / `renderAsChild`.

Conventions worth copying from any component in `packages/zero/src/components`:

- **Anatomy first**: import part names from your `anatomy.ts`; render
  `data-scope` / `data-part` / `data-state` exactly as declared.
- **Inert context fallback**: `defineInjectable` with a do-nothing default so
  a bare part still renders outside its root.
- **Registration isn't reactive**: at first render an item may only depend on
  items registered *before* it (DOM order) plus the model — derive state
  accordingly (see the `phase()` comment in the example's `Stepper.tsx`).
- **`asChild` + keyboard**: synthesize activation only for keys the platform
  won't — `synthesizesClickFrom(target, key)` is the exact test; skipping it
  double-activates anchors on Enter.
- Variant pass-through is `{...variantAttrs(props)}` on the carrier part;
  zero attaches no styling to any of it.

## 3. Hold it to the contract

`@sigx/zero/testing` ships the assertion zero's own suite runs:

```ts
import { expectAnatomy } from '@sigx/zero/testing';
expectAnatomy(container, stepperAnatomy);            // throws plain Error
expectAnatomy(el, anatomy, { axes: ['emphasis'] }); // custom axes, declared
```

It checks: declared parts only, states from the closed set, flags declared
and presence-only, `hidden` exactly where `hiddenIn` says. Runner-agnostic.

## 4. Publish the fragment (and the pack)

```ts
export const fragment = {
    version: 1,                           // the contract version — required
    package: '@acme/zero-stepper',        // your npm specifier — required
    components: [stepperAnatomy.toJSON()],
};

export const recipes: RecipeInput[] = [{ component: 'acme-stepper', /* … */ }];
```

`version` is a **literal, not an import**. `FRAGMENT_VERSION` lives in
`@sigx/zero-kit`, and this entry must stay importable from a design system's
Node build script without dragging the kit into your runtime graph — so the
number is written out and checked at the boundary instead: `mergeManifests`
rejects a fragment that declares none, and rejects one built against a
version it no longer speaks, rather than merging a stale anatomy silently.

## 4a. Check it before you publish

`sigx zero:fragment`, run in your package, emits `dist/fragment.json` beside
the module and checks the things that otherwise fail in *someone else's*
build:

- the `version` literal still matches the kit's `FRAGMENT_VERSION` — this
  check is what makes hand-writing it safe;
- the JSON validates against `schemas/fragment.schema.json`, and
  `mergeManifests` accepts it against the installed `@sigx/zero`: flags,
  governed states, placements, `hiddenIn`, the part tree, and a scope nobody
  else claims;
- the declared fragment path is inside your `"files"` — present locally and
  missing for every consumer is the failure you cannot see from your own
  checkout. Strict for an exact path and for a directory prefix (`dist`,
  `dist/**`); a glob it cannot model (`**/*.js`) is assumed to ship, since
  this is here to catch the forgotten `dist`, not to reimplement npm's
  packer;
- every part your recipes style is one your anatomy declares, and every scope
  they style is one your fragment declares;
- your package root exports `componentExportName(scope)` — the name an
  api-declaring adopter's generated `./components` module imports;
- and a **hostile-vocabulary probe**: your pack, fitted to a design system
  with no colour roles and no size ramp, still compiles — and still paints. A
  scope that draws only through the colour axis renders as nothing there, and
  you should hear that from this command rather than from an adopter.

It warns rather than fails on an unprefixed scope (what counts as a vendor is
not checkable; the collision it invites later is), and on a pack that is not
lynx-clean (that costs adopters one target, not the build).

`sigx` is `@sigx/cli`, which discovers this command through the kit — so a
component package running it needs both as devDependencies. That is the one
place `@sigx/zero-kit` stops being purely a type-only import for you.

## 4b. The pack

The recipe pack targets the **recommended token grammar** — role names from
`RECOMMENDED_ROLE_LIST` (`var(--color-primary)` …), the recommended sizes —
so it styles itself under any design system that keeps the recommended
vocabulary without naming one. Generate a `color` axis over the *whole*
recommended role list rather than a subset (a partial axis diverges from
every sibling component, and the kit's validator says so). Style every
declared state distinctly — the state-legibility tooling measures ink.
JSON form of the fragment validates against the kit's
`schemas/fragment.schema.json`.

## 5. A design system adopts you

Declare one field, and every zero build finds the package:

```json
"sigx-zero": {
    "fragment": "./dist/fragment.js",
    "requires": ">=0.2.0"
}
```

`fragment` is a **package-relative path**, like the `"sigx-cli"` field the
sigx CLI is discovered through — not an exports subpath. The tidier-looking
spellings are all dead ends: `require.resolve('<pkg>/package.json')` throws
`ERR_PACKAGE_PATH_NOT_EXPORTED` because your exports map declares `.` and
`./fragment` and nothing else; `require.resolve('<pkg>/fragment')` fails
because that subpath declares only `types` and `import` while the CJS
resolver asks for `require`; and `import.meta.resolve` resolves against the
kit's own module, which under pnpm's isolated store cannot see the consuming
project's dependency graph. Point it at the built file, and keep that path
inside your `"files"` list — otherwise the fragment is missing for consumers
and present for you.

A design system that installs your package has already opted in — discovery
is on by default:

```js
await runStandardBuild({ designSystem, manifest, outDir });   // adopts you
await runStandardBuild({ designSystem, manifest, outDir, ecosystem: false });
```

`ZERO_ECOSYSTEM=0` turns it off for one run whatever the build asks for, and
`--ecosystem-exclude` (repeatable) drops named packages on the CLI.

Narrowing lives on the programmatic options — `ecosystem: { include: [...] }`
or `{ exclude: [...] }` passed to `runStandardBuild`; the CLI surfaces the
exclusion half as `--ecosystem-exclude` and has no `include` flag. `include`
is a mode rather than a filter — it means *only* these — so passing it
alongside `exclude` is an error, and so is naming a package that is not a
dependency: a typo'd exclusion that silently does nothing is how "we disabled
that pack" survives as a belief.

Two properties worth relying on. A pack that fails — an unbuilt fragment, a
stale contract version, a scope another package already claims — is reported
by name and skipped, not swallowed: one stale transitive dependency cannot
stop a design system from building the components it owns (`strict: true`
turns those back into build failures). And packs are adopted in package-name
order, so the emitted CSS, manifest key order and report do not depend on how
your dependencies happen to be written down.

### When the design system is already published

Everything above assumes the design system is built from source with your
package installed. Most are not: a design system ships as prebuilt CSS, and
it can never devDepend on every component package that might exist — that is
a release-order cycle across repositories, and it is the reason this protocol
inverts the dependency.

The **app** depends on both, and it is the only place that knows which packs
are present. So it recompiles the installed design system against them:

```sh
sigx zero:extend --ds @sigx/zero-daisyui --out src/generated
```

which writes two files:

- `zero-extend.css` — your scopes' CSS and nothing else. Never the design
  system's own scopes, never a re-emitted `tokens.css` (that would duplicate
  its `@property` registrations). Each scope's rules are self-layered, so it
  imports in any order beside the design system's stylesheet.
- `zero-extend.js` and `zero-extend.d.ts` — a **replacement** register
  module, carrying the design system's whole vocabulary plus your scopes. The
  pair is shaped exactly like a design system's own `/register`: the
  declaration does the work, and the `.js` (`export {}`) exists so the
  specifier resolves at runtime.

  The app imports `zero-extend.js` and **removes** its
  `@sigx/<ds>/register` import. Both halves matter. `ZeroVocabulary` is an
  interface whose `components` is a property, so two modules augmenting it
  collide with TS2717 — and augmentations accumulate across a TypeScript
  program, so leaving the old import in place declares the same vocabulary
  twice and reintroduces exactly the collision the replacement avoids.

The command refuses to run when the installed design system was built against
a different `@sigx/zero` than the app's — recompiling across a contract
version would produce CSS the design system's own artifacts disagree with.

### What happens to your recipe pack

Four things, in this order.

**It is fitted to the adopting skin's vocabulary.** Your pack is written to
the recommended token grammar; the design system adopting it may have no
colour axis at all, a fused `variant`, its own size ramp. The kit runs your
recipes through `fitRecipesToVocabulary` before composing: undeclared role
values are dropped from the axis and their `var(--color-<role>)` references
redrawn on the base surfaces, off-ramp sizes go, undeclared modifiers go. For
a design system that keeps the recommended vocabulary the fit is the identity
and costs you nothing. Anything it had to change is logged once, named.

**It may only style the scopes your fragment declares.** A pack shipping a
recipe for `button` would let an installed dependency restyle its host's own
components — a different product from this one. The whole pack is refused by
name, before its fragment is merged: dropping only the recipes would leave
your scopes in the manifest styled by nobody.

**A scope the design system already styles keeps the design system's
recipe.** Precedence is de-dup, not ordering, because two recipes for one
scope is a hard compile error in *either* order — so "I like your stepper but
mine is square" has to be a drop, not a shadow. The build says which package
lost. Everything else is appended, which is why your scope lands last in
`manifest.json`, `register.d.ts` and `report.json`.

**A recipe lynx cannot express costs you that target, not the build.** The
lynx emitter refuses references to web-runtime properties — `var(--press-x)`
and the rest of zero's press-feedback surface. In a first-party recipe that
fails the build; in a discovered pack it drops your scope from the lynx target
and records it in `report.json` under `lynx.webOnly`, because the design
system's author neither wrote your recipe nor can fix it. If you want lynx,
put those declarations in your recipe's `targets.web` section.

Composing by hand still works, and still wins:

```js
// build.mjs — the explicit form; `fragments` merge before discovery
import { mergeManifests } from '@sigx/zero-kit';
import { fragment, recipes as stepperRecipes } from '@acme/zero-stepper/fragment';

const manifest = mergeManifests(zeroManifest, fragment);
const ds = { ...designSystem, recipes: [...designSystem.recipes, ...stepperRecipes] };
```

or with the fragment as JSON, for a pack that ships no module entry:

```sh
sigx zero:validate --extra-manifest ./node_modules/@acme/zero-stepper/dist/fragment.json
sigx zero:build    --extra-manifest ./node_modules/@acme/zero-stepper/dist/fragment.json
```

`--extra-manifest` is repeatable and takes a path or a module specifier; it
is accepted by `zero:build`, `zero:validate` and `zero:audit` alike.

Either way, merging is a statement of intent: a merged scope with no recipe
draws the ordinary `N component(s) have no recipe` warning — that is validate
telling you the adoption is half done, not a false positive to suppress.

Everything downstream is automatic: validation, recipe compilation and the
coverage report treat the merged scope like any other; provenance is stamped
per component; the generated `register.d.ts` excludes merged scopes **by
name** from its ZeroScope compile gate (`ZeroScope` itself stays closed — see
`packages/zero/type-tests/ecosystem/` for the compile-time proof); and under
api mode the `./components` module imports the scope from your package.

If the ecosystem package is private or the design system is published,
keep the adoption in build tooling the package never ships — an import
reachable from the published entry would make the package uninstallable.

## 6. The fallback is the contract

A design system that never merges your fragment leaves your component
**unstyled but accessible** — correctly attributed anatomy, working
behavior, `[data-scope][data-part][hidden]` still honored by zero's base
CSS. That is the baseline of the whole thesis, not an error state. Ship
sensible unstyled rendering, and let recipe packs or per-DS recipes carry
the ink.
