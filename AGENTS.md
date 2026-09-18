# SignalX Zero — shared agent guide

> ⚠️ **BRANCH FIRST — never work on `main`.** Before touching ANY file, create a
> worktree (`pnpm wt new <N-short-slug>`) and do everything from
> `<repo>/branches/<N-short-slug>`. This applies to every change, however small —
> editing or committing in the primary checkout (`<repo>/main`) causes conflicts
> for parallel sessions. Check yourself before every commit:
> `git branch --show-current` must print your worktree's branch name — if it
> prints `main` or nothing (detached HEAD), stop.
> Already edited files in `main` by mistake? Move the work, don't commit it:
> `git stash -u` → `pnpm wt new <N-short-slug>` →
> `cd <repo>/branches/<N-short-slug>` → `git stash pop`.

Canonical guidance for **any** AI agent working in this repo (Claude Code, GitHub
Copilot CLI, work agents, …). Tool-specific notes live in `CLAUDE.md`; it defers
here for everything shared — when it conflicts with this file, the tool-specific
file wins for that tool only.

This is the sigx standard agent setup. The same pattern (this file +
`scripts/worktree.mjs` + a thin tool-specific file) is used across sigx repos.

SignalX Zero is a pnpm monorepo (ESM, `"type": "module"`) holding the
design-system-neutral component foundation for the web: unstyled, accessible
compound components that render a stable `data-scope`/`data-part`/`data-state`
anatomy, plus the authoring kit that compiles typed tokens+recipes into plain
CSS. Published to npm under the `@sigx` scope, **lockstep-versioned**.
Tech stack: TypeScript (strict), tsgo, Vite 8, Vitest (happy-dom), oxlint.

## Development workflow (issue → PR → Copilot review → merge)

**This is mandatory for EVERY agent-driven change — including one-line fixes.
Never commit straight to `main`.** Repo: `signalxjs/zero`, base branch `main`.

1. **Issue first.** If no GitHub issue already tracks the work, create one *before*
   writing code and put the plan in it:
   ```sh
   gh issue create --title "<concise title>" --body "<what & why, plus the plan/checklist>"
   ```
   If you worked in plan mode, the approved plan **is** the issue body. Note the
   number it returns (`#N`).

2. **Worktree, always.** Never work on `main`. Use the worktree flow (below):
   `pnpm wt new <N-short-slug>` gives an isolated checkout on branch
   `<N-short-slug>`. Don't substitute `git switch -c` in the primary checkout —
   it occupies `<repo>/main`, which parallel sessions share.

3. **Implement & verify.** Make the change, then prove it: `pnpm typecheck` (always,
   for any `.ts`) plus the relevant `pnpm test` / `pnpm build`. Stage specific
   files (`git add <path>`), never `git add -A`. No co-author trailers.

4. **Open a PR with Copilot as the reviewer.** Reference the issue so it auto-closes
   on merge:
   ```sh
   gh pr create --base main --title "<title>" \
     --body "Closes #N. <short summary of the change>" --reviewer @copilot
   ```
   The PR description becomes the squash commit **body** verbatim, and the PR
   title (with ` (#<pr>)` appended) becomes its subject — see step 6. Write the
   description as the commit body you want on `main`.
   (On an already-open PR: `gh pr edit <pr> --add-reviewer @copilot`.) The bot
   `copilot-pull-request-reviewer` posts its review within a minute or two. If your
   `gh` is too old to resolve `@copilot` (error: `'@copilot' not found`), request it
   via the API instead — don't skip it:
   ```sh
   gh api --method POST repos/signalxjs/zero/pulls/<pr>/requested_reviewers \
     -f 'reviewers[]=copilot-pull-request-reviewer[bot]'
   ```
   (The reviewer-request API takes the `[bot]`-suffixed slug; the review author
   login in `.reviews[].author.login` appears *without* the suffix.)

5. **Wait for Copilot's review, then fix.** Do not merge before it has reviewed. Poll
   until a review by the bot appears, then read it:
   ```sh
   gh pr view <pr> --json reviews -q '.reviews[].author.login'   # wait for "copilot-pull-request-reviewer"
   gh pr view <pr> --json reviews,comments
   ```
   Address every actionable comment with follow-up commits and push. If the review
   doesn't re-trigger on its own, re-request it: `gh pr edit <pr> --add-reviewer @copilot`.
   Repeat until Copilot has no remaining actionable feedback.

6. **Merge it yourself.** Once Copilot's feedback is resolved, CI is green, and —
   for user-facing changes — the docs issue is filed on the docs repo and linked
   from the PR (see "Documentation"), merge (squash — repo rules block merge
   commits) and clean up:
   ```sh
   pr=123                                     # your PR number (digits only)
   gh pr checks "$pr"                         # must be all green first
   gh pr merge "$pr" --squash --delete-branch \
     --subject "$(gh pr view "$pr" --json title -q .title) (#$pr)" \
     --body "$(gh pr view "$pr" --json body -q .body)"
   ```
   Pass `--subject`/`--body` explicitly, exactly as above — GitHub appends
   `Co-authored-by:` trailers to every message it generates itself whenever a
   branch-commit author differs from the merging account; an explicit message is
   used verbatim, so no trailers. If you used a worktree, remove it afterward:
   `pnpm wt rm <name>`.

## Build, Test, Lint

```bash
pnpm install
pnpm build         # all packages (vite lib build / tsgo per package + CSS compile for DS packages)
pnpm test          # vitest run
pnpm test -- packages/zero            # single test file/dir (substring match)
pnpm test -- -t "name of test"        # single test by name (vitest -t)
pnpm test:watch
pnpm test:coverage
pnpm typecheck     # tsgo --noEmit against package sources (path-aliased)
pnpm test:types    # compile-time type tests (zero's ZeroVocabulary seam), six isolated tsconfig projects under packages/zero/type-tests/
pnpm lint          # oxlint packages
pnpm lint:fix
pnpm verify:catalog  # catalog: usage check for @sigx core deps
pnpm verify:pack   # publish dry-run
pnpm --filter @sigx/zero-kit gen:css-properties  # regenerate the CSS property list from the pinned @webref/css (a test fails when it is stale)
```

To run the playground: `pnpm build` (it loads each design system's compiled CSS
from `dist/`), then `pnpm --filter zero-playground dev`.

Real-browser interaction tests (Playwright over the playground; press-feedback
contract plus per-component interaction specs on chromium/firefox/webkit —
combobox, menu-submenu, toast, select, and since #326 the overlays and
composites a simulated DOM cannot host: dialog (real `showModal()` top layer,
the geometric backdrop-vs-padding click from #324, the non-modal
dismiss-layer fallback), popover (`focusFirst` on open, light dismiss, focus
restore — the restore tests open by KEYBOARD, because WebKit does not focus
buttons on click, so a click-open leaves the restore target as body and the
assertion would prove nothing), tooltip (hover-intent delay asserted as a
lower bound only, and WCAG 1.4.13: Escape dismisses a hover-opened tooltip
while focus sits elsewhere), tabs (one roving tab stop, automatic
activation), slider drag under implicit pointer capture, tree-view
keyboard (expand/descend/collapse/climb, typeahead against the accessible
text), carousel (real scroll-snap: buttons and dots move the scroll, and a
REAL scroll drives the model back through the IntersectionObserver), and
diff (the divider handle's captured drag moves the painted reveal, APG
keyboard steps, and an RTL check measured in boxes — the reveal is a
logical inline-size, which the physical-direction lint cannot see) — plus
reduced-motion and forced-colors projects, and
the state-matrix contrast audit — two matrices over every state combination ×
design system × theme, hard-fail below 3:1, chromium-only: **text legibility**
for every text-bearing part, and **indicator paint** for every part whose job
is paint rather than text, measured inside its real ancestor chain — the tick,
the dot, the thumb, the range, the chevrons, the star — and, since #403, a
**parity block** in every one of those tests holding the kit's static contrast
matrix (`auditDesignSystem`'s `contrast/*` rules) to the browser's reading on
every cell it claims, with each skin's measured share pinned from both ends. The text matrix also
carries each design system's own **axis surface**: every wired `data-variant`
value (crossed with `data-color` where both exist) and each declared
`data-mod-*`, for the scopes that wire a variant — reaching text that sits
BELOW the carrier through a declared ancestor chain, with the axis attributes
on the chain root where the compiler anchors them (#297), which is what let
`select` and `badge` wire vocabularies of their own; `button` is the third and the only
place HeroUI's and carbon's fused colour vocabulary (`danger-soft`,
`danger-ghost`) exists at all. `data-size` is deliberately out: it moves
metrics, not ink. `disabled` is no longer dropped — it answers to its own 2:1
floor, measured on the colour pair the recipe chose *before* the state's
uniform `opacity` fade, with the faded ratio annotated beside it; and the
**DS-generic smoke spec** (`e2e/ds-smoke.spec.ts`), the only spec that loads
more than one design system — it walks all six, three engines for the cascade
claim and one for the DOM ones, asserting that every
`[data-scope][data-part][hidden]` computes `display: none` (a layered cascade
happy-dom cannot resolve), that no element renders a
`data-color`/`data-size`/`data-variant`/`data-mod-*` value the live manifest
does not declare, that a toolbar switch leaves exactly one live
`link[data-zero-ds]` and refetches the vocabulary and theme registry, and that
boot logs no console error); the **reduced-motion spec** (`e2e/reduced-motion.spec.ts`) — the two
components whose resting state is an infinite loop (Skeleton, Spinner) across
all six design systems, asserting the OPPOSITE thing in two projects:
`animation-name` must be running under `chromium` and `none` under
`reduced-motion`. Both directions, because a one-way check passes for a
recipe that never animated — and `animation-name` rather than duration,
because the kit collapses `--duration-*` to ~0 under reduced motion and a
loop at ~0s strobes rather than stops;
and the **RTL spec** (`e2e/rtl.spec.ts`), the other
spec that walks all six — chromium-only, one page load per design system, it
sets `dir="rtl"` *after* boot (an `addInitScript` runs before `documentElement`
exists, so the attribute is silently lost, which reads exactly like a broken
fix) and then measures boxes rather than declarations: the switch thumb starts
at the reading edge and stays inside its own control, a toast viewport sits on
the side its `data-placement` names, a collapsed branch indicator and a submenu
chevron point at the reading end, and the indeterminate progress sweep travels
the reading way (seeked through `getAnimations()`, since the loop makes
wall-clock sampling straddle a wrap). It exists because a `transform` has no
logical spelling, so the kit's physical-direction lint cannot see it — the two
checks are complementary, not redundant;
and the **axe audit** (`e2e/axe-audit.spec.ts`, #326) — the ARIA counterpart
to the contrast audit: chromium + zero-basic only (semantics are engine- and
skin-independent), it walks every registry page (ids read from the rendered
sidebar — importing the registry would drag every page's JSX through
Playwright's transpiler), opens the primary overlay on pages whose component
idles closed (a closed popup contributes nothing to the scanned tree), and
hard-fails on serious/critical WCAG A/AA violations. `color-contrast` is
disabled by name: contrast answers to the contrast audit's own floors, not
axe's single resting-state sample. Documented exceptions live in
`e2e/axe-allowlist.json` as `{ rule, selector, reason }` rows; stale rows
fail the spec, and a real bug never goes there — it gets fixed in
`packages/zero`, which is how this audit already paid for itself: a nameless
Select trigger (`role="combobox"` prohibits name-from-content — hence
`Select.Trigger`'s `label` prop), an invalid `aria-expanded` on the
role-less context-menu surface, and unlabelled combobox demo inputs): `pnpm build`,
then `pnpm --filter zero-playground e2e` (first run:
`pnpm --filter zero-playground exec playwright install`). Filtering needs
`exec` — `pnpm --filter zero-playground e2e -- <name>` drops the argument and
runs everything; use
`pnpm --filter zero-playground exec playwright test <file> --project=<project>`.
The dev server's port is `ZERO_E2E_PORT` (default 5199) — set it to run the
suite from two worktrees at once, since `reuseExistingServer` would otherwise
let the second borrow the first's server and test the wrong code. CI runs them
on every PR. The root `pnpm
typecheck` excludes `examples/`, so the playground has its own:
`pnpm --filter zero-playground typecheck`.

**How an interaction spec locates a part** — the convention, and it is not
optional:

> Locate a part through a **named root**: never a page-wide
> `[data-scope][data-part]` where more than one instance exists, and never a
> positional `.first()` / `.nth()` that reaches across demos.

The one carve-out is identity rather than accident: positional indexing *within
a single demo's own ordered set* — tab 0, radio item 1, the third star of one
rating — is fine. The helpers live in `examples/playground/e2e/demo.ts`, which
carries the reasoning and the scars: `demoLabelled(page, scope, text)` names an
instance by the text on it, `demoPosting(page, scope, name)` by the field it
posts, and `controlledPopup(page, trigger)` follows `aria-controls` for a
component whose surface is a sibling rather than a descendant (Menu). `.first()`
is the specific trap — it couples a spec to incidental document order, so it
passes for the wrong reason and breaks for an unrelated one; the playground
renders several of most components and grows more.

That module also owns `settledBox(locator, what)`: measuring a part means
waiting out its animations *and* proving it is rendered first, because
`boundingBox()` returns **null** for anything that is not, and dereferencing
that null reports a `TypeError` instead of "the popup was not showing".

## Packages

- `packages/zero` → `@sigx/zero` — the runtime foundation: the anatomy
  contract (`data-scope`/`data-part`/`data-state` + machine-readable per-component
  anatomy exports), headless behaviors (controllable state via `Define.Model`,
  SSR-safe ids, roving tabindex, dismissal, focus, list registration),
  unstyled compound components (Tabs, Collapsible, Switch, Dialog, …), the
  token-name contract shared with `@sigx/lynx-zero`, and the theme engine
  (registry, `ThemeProvider`, headless `themeController`, `themeInitScript`).
  Peer-depends on `sigx` only; no CSS beyond `css/base.css` (@layer order +
  structural token fallbacks — `@property` registrations are emitted per
  design system by the kit, since only it knows the declared role names).
- `packages/zero-kit` → `@sigx/zero-kit` — Node-only authoring kit:
  `defineTokens` / `defineRecipe` / `defineDesignSystem`, the tokens/recipes →
  plain-CSS compiler, the `/build` subpath (`runStandardBuild` — the whole
  validate → compile → report → writeArtifacts pipeline every DS `build.mjs`
  and the CLI call), the `/define` subpath (the `define*` helpers from a
  `node:`-free module graph, the ONE zero-kit surface a DS package may
  value-import at runtime), the `sigx` CLI plugin (`zero:build | zero:validate | zero:audit`,
  aliased `build | validate | audit`, plus `zero:fragment` — the authoring-side
  gate an ecosystem component package runs, deliberately with no bare alias;
  `init` was declined — #10, a plugin command
  cannot run in the empty directory a new design system starts as, so
  scaffolding belongs to a `create-*` package — and `eject` remains open,
  #11), and the design-system generation agent skill, and the JSON schemas
  for manifest/tokens/recipes (shipped in `schemas/`, referenced by
  `manifest.json`). devDependency of DS packages; never a runtime dependency.
  It ships no binary of its own — commands are discovered by `@sigx/cli`
  through the `"sigx-cli"` field in its package.json.
- `packages/zero-basic` → `@sigx/zero-basic` — neutral starter design system
  (readable defaults). Dogfoods zero-kit; reference pair for the AI skill.
- `packages/zero-daisyui` → `@sigx/zero-daisyui` — daisyUI-flavored skin:
  daisy token values + recipes over zero anatomy. No Tailwind/daisyUI plugin
  required. The proof that a design system is data. Declares a daisy-native
  api (#332) — the third api-declaring DS and the first to combine one with
  the recommended colour axis: identity `variant` (incl. daisy 5's
  `dash`/`link`) and the six `btn-*` modifiers as identity-named booleans on
  the generated `./components` module.
- `packages/zero-material` → `@sigx/zero-material` — Material-flavoured skin,
  and the acceptance test for extensible vocabularies: thirteen colour roles,
  a `level1`–`level5` elevation ramp, its own easings, its own breakpoints.
  Private — it proves the contract rather than shipping a licensed token set.
- `packages/zero-brutalist` → `@sigx/zero-brutalist` — brutalist skin,
  generated from a style brief through the design-system agent skill. The
  end-to-end proof of the thesis, and the regression test for the skill
  itself. Private.
- `packages/zero-heroui` → `@sigx/zero-heroui` — HeroUI-flavoured skin, and
  the acceptance test for **non-orthogonal axis surfaces**: no colour axis at
  all (`roles: {}`), colour fused into a seven-member `variant`
  (`danger-soft` is one member), a declared three-step size ramp, and
  HeroUI's `isIconOnly`/`isPending` as `data-mod-*` modifiers. Where
  zero-material proves vocabularies can be *extended*, this proves they can be
  a different *shape*. Full component coverage (40 recipes), with `variant`
  wired on button only (the repo-wide decision, #175) — it exercises the axis
  surface, not a product. Private.
- `packages/zero-carbon` → `@sigx/zero-carbon` — Carbon-flavoured skin, and
  the runtime acceptance test for the **api `values` remap** (#183): no
  colour axis, the fused seven-member `kind` vocabulary declared kebab
  (`danger-tertiary`), with Carbon's double-hyphen spellings
  (`danger--tertiary`) restored only at the prop boundary by the generated
  `./components` module. Full recipe coverage; the `kind` axis and the remap
  stay Button-only — it exercises the vendor-named API surface that motivated
  #179, not a product. Private.
- `packages/zero-ext-example` → `@sigx/zero-ext-example` — the
  **ecosystem-component acceptance test** (#304): a `Stepper` zero doesn't
  ship, built entirely from `@sigx/zero`'s public surface (`defineAnatomy`,
  behaviors, contract helpers; `expectAnatomy` from `@sigx/zero/testing` in
  its tests) and published to design systems from a data-only `./fragment`
  entry — the manifest fragment (`{ package, components }`) plus a recipe
  pack written against the recommended token grammar. zero-basic adopts both
  in `build.mjs` (spread the pack, pass the fragment to `runStandardBuild` —
  build-only, so the private package stays out of the published module
  graph), which makes
  its emitted `register.d.ts` the Exclude-form compile proof
  (`packages/zero/type-tests/ecosystem/`). Private — it proves the loop the
  way zero-heroui proves axis shapes.
- `packages/create-zero-ds` → `@sigx/create-zero-ds` — the scaffold behind
  `pnpm create @sigx/zero-ds <name> --brief <id>` (#401): a Node-only bin with
  zero runtime deps that lays down a design-system package from nothing —
  the brief's tokens + Button, `@sigx/zero-basic`'s 50 recipes as
  `src/baseline.ts`, and a `src/recipes.ts` composing them through the kit's
  `fitRecipesToVocabulary` (on `/define`) so any axis shape compiles on the
  first build. Templates are embedded at build time
  (`scripts/collect-templates.mjs` → gitignored `templates/*.txt`, shipped via
  `files`), so the package devDepends on zero-basic and zero-kit for build
  order only. It exists in-repo because a CLI *plugin* can never run in an
  empty directory (#10) and `@sigx/cli`'s `create` has no template hook.
  Published, lockstep; listed in `scripts/publish.js` + `verify-pack.js`,
  and verify-pack scaffolds riso + glass(lynx) from the packed tarballs and
  builds them. Never gets a CHANGELOG (its notes live in its README).
- `examples/playground` — private demo app, structured like a docs site: a
  sidebar of per-component pages (hash-routed, `src/pages/registry.ts` is the
  single source the sidebar, the router and the derived `#/all` kitchen-sink
  route share; `#/all` is what the sweeping e2e specs boot). Switches between
  basic / daisyui / material / brutalist / heroui / carbon **at runtime** from
  its toolbar. A
  design system compiles to one stylesheet, so switching is a `<link>` swap
  (`src/design-systems.ts`) plus a theme-registry re-seed. Exactly one design
  system is live at a time — recipe CSS is not `data-theme`-scoped, so two
  stylesheets would blend rather than replace. Needs `pnpm build` first: the
  playground resolves each DS's CSS from its `dist/`.
- `examples/typed-app` — the consumer-side type capstone (#326): three
  isolated tsconfig programs compiling against the **emitted** dist/
  artifacts through real package exports (so it needs `pnpm build` first) —
  (a) `@sigx/zero-basic/register` narrowing with `@ts-expect-error` probes
  on invalid axis values and unwired axes, (b) heroui's no-register
  `./components` surface, (c) carbon's renamed `kind` prop with the
  `danger--tertiary` respelling. `pnpm --filter zero-typed-app typecheck`
  runs all three; CI runs it in the e2e job after Build. `skipLibCheck`
  stays `true` for now — every program transitively reaches
  `@sigx/runtime-core`, whose shipped d.ts fails a full lib check (see
  `tsconfig.base.json` there); flip it to `false` when core ships clean
  declarations. Private, excluded from the root typecheck like the
  playground.

**Lockstep versioning**: every publishable package shares one version. Never
bump a single package's version — use `pnpm version:patch|minor|major`.
Publishing is handled by `scripts/publish.js` in topological order.

## The anatomy contract (repo-specific law)

- Every rendered part carries `data-scope="<component>"` and
  `data-part="<part>"` (kebab-case).
- Parts declare their **tree**: `parent` on a `PartSpec` names the same-scope
  part it renders inside (the containing part, not necessarily the immediate
  element — a menu item inside a group is still inside the popup). Top-level
  parts omit it; pseudo parts never declare it. `expectAnatomy` asserts the
  rendered DOM matches; the contrast audit derives its ancestor chains from
  it; the recipe compiler bounds axis rules with it.
- `data-state` holds exactly one value from a closed, per-part set
  (`open|closed`, `checked|unchecked|indeterminate`, `active|inactive`, …) —
  and every value must be a member of the governed `STATE_VOCABULARY` in
  `contract/data-attrs.ts` (families + a synonym table: `expanded` is a
  rejected spelling of `open`). A new state value is a contract change there
  first.
- Boolean flags are presence-only (`data-disabled=""`), never `="false"`.
  Shared flag vocabulary: `data-disabled`, `data-highlighted`, `data-selected`,
  `data-invalid`, `data-required`, `data-readonly`, `data-placeholder`,
  `data-focus-visible`, `data-pressed`. Never invent synonyms.
- `data-placement` is declared contract data, not a free attribute: a part
  that can carry it lists its subset of `PLACEMENT_VOCABULARY` as
  `placements` in its anatomy (the anchored-position popups, toast's
  viewport/root). `expectAnatomy` checks it per part like `data-state`.
- `mergeManifests` enforces all of the above (flags, states with synonym
  hints, placements, `hiddenIn ⊆ states`, and the part tree) on ecosystem
  manifest fragments — which also carry a required `version`
  (`FRAGMENT_VERSION`).
- Contract variant props pass through as `data-color` / `data-size` /
  `data-variant`. Zero attaches **no styling** to any of these. Every
  component carries the axis surface (`WithVariantAxes`); for the
  fragment-rooted scopes (dialog, menu, popover, tooltip) the props live on
  the Trigger, which renders the carrier part.
- A part the runtime hides with the `hidden` attribute in some state declares
  it: `hiddenIn: ['error']` on `avatar.image`. It is a styling fact — a rule
  for a hidden state can never paint, so identical CSS across it and a visible
  state is correct — and tooling (the state-legibility guard) reads it from the
  manifest. Add `hidden` to a part in a new state and the declaration moves
  with it; `expectAnatomy` fails otherwise.
- Each component's `anatomy.ts` is the source of truth — the component imports
  part names from it, tests assert against it, and the build emits it into
  `manifest.json` for tooling/AI. Changing an anatomy is a breaking change.
- Every model a component's API carries is declared there too (`models` on
  `defineAnatomy`), and follows one naming rule: concept `N` binds through
  `model` (or `model:<name>`), seeds through `default<N>` and emits
  `<n>Change`. `model-parity.test.ts` holds the sources to the anatomy; a
  new model is a `ModelSpec` first.
- Setup functions never touch the DOM; DOM work lives in context-bound
  `onMounted`/effects. No module-global mutable state that could leak across
  SSR requests (client-only state like the dismiss layer stack is exempt).

## Documentation

Docs are part of the change, not a follow-up — in-repo docs ship in the same
PR, and the docs-site update is queued (as a docs-repo issue) before merge.

**In-repo docs — update in *this* PR when you touch the matching thing:**

| When you… | Update… |
|---|---|
| add / rename / remove a package | `AGENTS.md` "Packages" and the README package table — plus the `tsconfig` / `vitest` path aliases |
| add / change a component's anatomy | the component's `anatomy.ts` (source of truth), its tests, and the package `README.md` |
| change a build / test / lint script | `AGENTS.md` "Build, Test, Lint", `package.json` |
| change or add public API / behavior | the package's own `README.md`, and that same package's own `CHANGELOG.md` **if it keeps one** (never a repo-root one — there isn't one) — see below |
| change the workflow / process itself | `AGENTS.md` here — and upstream to [`signalxjs/repo-template`](https://github.com/signalxjs/repo-template) |
| change the architecture — a contract, a pipeline stage, a gate | `docs/architecture.md`, the design doc of the current system (there are no RFCs; the doc is descriptive and must keep matching the tree) |

**Only `@sigx/zero` and `@sigx/zero-kit` keep a `CHANGELOG.md`.** The six
design-system packages deliberately do not — nothing has been released yet, so
a skin has no history to record, and lockstep versioning means one never ships
independently of the contract anyway. A user-facing note about a skin goes in
that package's `README.md`.

Do not add a `CHANGELOG.md` to a design-system package. Adding one to whichever
skin a PR happens to touch is how a convention ends up followed one-sixth of
the time, which reads as signal when it isn't. Revisit this at the first
release if a skin ever needs its own history.

**The docs *site* is separate — don't edit it from here.** Before merging a PR
with user-facing changes, file an issue on
[`signalxjs/signalxjs.github.io`](https://github.com/signalxjs/signalxjs.github.io):
```sh
gh issue create --repo signalxjs/signalxjs.github.io \
  --title "zero: <what changed>" \
  --body "Source: signalxjs/zero#<pr>. <What needs documenting.> Not yet released."
```
When you cut a release (push a `vX.Y.Z` tag), comment the release tag on every
open docs issue covering a change shipped in that release.

## Parallel work with git worktrees

```sh
pnpm wt new <name> [--from <branch>]   # worktree at <repo>/branches/<name>: own branch + deps installed
pnpm wt list                           # show all worktrees
pnpm wt rm <name> [--force]            # remove a worktree
```

Layout convention (all sigx repos): the primary checkout lives at `<repo>/main`
and every worktree at `<repo>/branches/<name>`.

## Conventions & working principles

- **Plan first for non-trivial work.**
- **Verify before declaring done.** Run typecheck/tests for code changes.
- **Minimal, surgical edits.** Don't refactor unrelated code. Don't add
  backward-compat shims for things that never shipped.
- **READMEs stay in sync — same PR, not later.**
- **Cross-platform paths**: prefer Node scripts over shell one-liners for
  anything committed to the repo.
- **Git hygiene**: Stage specific files (`git add <path>`), never `git add -A`.
  Run `pnpm typecheck` before any commit touching `.ts`. Do **not** add
  co-author trailers to commits.
