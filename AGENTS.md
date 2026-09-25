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
   Repeat until Copilot has no remaining actionable feedback. The ruleset blocks
   merging while any review thread is open, so resolve each thread you address
   (and reply on, then resolve, any you deliberately decline):
   ```sh
   # list the open threads: id, file, first comment
   gh api graphql -F pr=<pr> -f query='query($pr:Int!){repository(owner:"signalxjs",name:"zero"){pullRequest(number:$pr){reviewThreads(first:100){nodes{id isResolved path comments(first:1){nodes{body}}}}}}}' \
     -q '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved|not) | "\(.id) \(.path) \(.comments.nodes[0].body[0:80])"'
   # resolve one
   gh api graphql -f query='mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}' -f id=<thread-id>
   ```

6. **Merge it yourself — through the merge queue.** Once Copilot's feedback is
   resolved, the PR's checks are green (`e2e` included — it is a required
   check and runs again in the queue, against what landed ahead), and — for user-facing
   changes — the docs issue is filed on the docs repo and linked from the PR
   (see "Documentation"), enqueue it:
   ```sh
   gh pr merge <pr> --squash --auto
   ```
   `main` has a merge queue (#159): it tests queued PRs in groups against the
   latest `main` and squash-merges them, so there is no "update branch" step —
   don't rebase a PR just to make it current. The squash commit takes the PR
   title plus ` (#<pr>)` as its subject and the PR description as its body
   (repo settings), so write the description as the commit body you want. If
   the queue evicts a PR, there is a real conflict (usually a CHANGELOG
   `[Unreleased]` entry): rebase on `main`, keep both sides, push, and enqueue
   again. Making the CHANGELOG entry the PR's last commit keeps that window
   small. GitHub generates the queue's commit message itself, and it appends
   `Co-authored-by:` trailers when a branch commit's author differs from the
   merging account, so keep every commit on your branch authored by you. If
   you used a worktree, remove it once the PR has landed: `pnpm wt rm <name>`.

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
pnpm test:types    # compile-time type tests (zero's ZeroVocabulary seam), 7 isolated tsconfig projects under packages/zero/type-tests/
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
combobox, menu-submenu, menu-keyboard (ArrowUp opens on the last item; Enter
on an asChild link item really navigates, #175), toast, select, and since #326 the overlays and
composites a simulated DOM cannot host: dialog (real `showModal()` top layer,
the geometric backdrop-vs-padding click from #324, the non-modal
dismiss-layer fallback), popover (`focusFirst` on open, light dismiss, focus
restore — the restore tests open by KEYBOARD, because WebKit does not focus
buttons on click, so a click-open leaves the restore target as body and the
assertion would prove nothing), tooltip (hover-intent delay asserted as a
lower bound only, and WCAG 1.4.13: Escape dismisses a hover-opened tooltip
while focus sits elsewhere), tabs (one roving tab stop, automatic
activation), slider drag under implicit pointer capture (and, since
#170, a vertical slider: bottom-to-top drags on both projections, and a
rail every skin stands upright, measured in boxes), tree-view
keyboard (expand/descend/collapse/climb, typeahead against the accessible
text), carousel (real scroll-snap: buttons and dots move the scroll, and a
REAL scroll drives the model back through the IntersectionObserver),
diff (the divider handle's captured drag moves the painted reveal, APG
keyboard steps, and an RTL check measured in boxes — the reveal is a
logical inline-size, which the physical-direction lint cannot see), and
the `createVirtualList` behavior (#56: measured rows tile with no gap
under real layout, stick-to-bottom follows the tail and lets go on a
wheel scroll up, a prepend leaves the row being read in place, and no
"ResizeObserver loop" error in any engine) — plus
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
does not declare (and, since #129, no `data-<axis>` value of a declared
custom axis the scope does not wire — `data-shape` on avatar is the first), that a toolbar switch leaves exactly one live
`link[data-zero-ds]` and refetches the vocabulary and theme registry, and that
boot logs no console error); the **reduced-motion spec** (`e2e/reduced-motion.spec.ts`) — the two
components whose resting state is an infinite loop (Skeleton, Spinner) across
all six design systems, asserting the OPPOSITE thing in two projects:
`animation-name` must be running under `chromium` and `none` under
`reduced-motion`. Both directions, because a one-way check passes for a
recipe that never animated — and `animation-name` rather than duration,
because the kit collapses `--duration-*` to ~0 under reduced motion and a
loop at ~0s strobes rather than stops (the same both-ways check holds the
drawer sheet's slide in the four skins that slide, #83);
and the **RTL spec** (`e2e/rtl.spec.ts`), the other
spec that walks all six — chromium-only, one page load per design system, it
sets `dir="rtl"` *after* boot (an `addInitScript` runs before `documentElement`
exists, so the attribute is silently lost, which reads exactly like a broken
fix) and then measures boxes rather than declarations: the switch thumb starts
at the reading edge and stays inside its own control, a toast viewport sits on
the side its `data-placement` names, a collapsed branch indicator and a submenu
chevron point at the reading end, the indeterminate progress sweep travels
the reading way (seeked through `getAnimations()`, since the loop makes
wall-clock sampling straddle a wrap), and a sliding skin's modal drawer
sheet enters from its reading edge, measured early in the entry (#83). It
exists because a `transform` has no logical spelling, so the kit's
physical-direction lint cannot see it — the two checks are complementary, not
redundant;
the **app-shell spec** (`e2e/app-shell.spec.ts`, #133) — the Navbar +
responsive Drawer + NavList + Container composition, three engines: the
same NavList is the docked sidebar beside `<main>` at `md` and a sheet
below it, the trigger in the bar hides when docked, and the shell keeps one
header and one navigation landmark either way;
the **narrow-dialog spec** (`e2e/narrow-dialog.spec.ts`, #101) — in the
`narrow` project (below), one page load per design system at a 400px
viewport, it opens the
modal dialog and asserts the popup's *border box* sits inside the viewport
on both axes. Geometric on purpose: a `<dialog>` keeps the UA's
`content-box` and zero ships no reset, so a recipe's `calc(100% - 2rem)`
plus padding rendered wider than it said in four skins, which neither the
unit suite (no layout) nor the CSS goldens (the declaration, not its
sufficiency) could see;
the **narrow-pagination spec** (`e2e/narrow-pagination.spec.ts`, #44) —
the same shape at 400px for the "wider window" Pagination: the root stays
inside its column while genuinely overflowing (the row is constant-width,
so every skin makes the root its scroll box, Table's answer), the last
control is reachable scrolled to the end, and a keyboard-focused trigger at
either end keeps its whole focus ring inside the scrollport — a scroll box
clips at its padding box, so the recipes pad the root by the ring's reach;
the **narrow-stats spec** (`e2e/narrow-stats.spec.ts`, #43) — the same
shape for Stats: a value never wraps, so the root is the row's scroll box.
At the case that found it (brutalist at 1100px, where shout-scale values
pushed the document sideways) the document stays put and the root stays
inside its column while genuinely overflowing; there and at the project's
phone width in every skin, every value stays inside its own item and the
last one is reachable scrolled to the end (the sweep below already holds
the phone-width containment, so the spec does not repeat it);
the **switch forced-colors spec** (`e2e/switch-forced-colors.spec.ts`, #189)
— forced-colors project only, all six design systems, measured in decoded
pixels: the control differs strongly from the same box with it hidden, and
checked differs strongly from unchecked. Forced colours revalue every author
background to Canvas, so a background-only track or thumb vanished in four
skins. Byte-equal screenshots are too weak a test here, because daisyUI's
noise texture made two identical-looking states differ;
and the **axe audit** (`e2e/axe-audit.spec.ts`, #326) — the ARIA counterpart
to the contrast audit: chromium + zero-basic only (semantics are engine- and
skin-independent), it walks every registry page (ids read from the rendered
sidebar — importing the registry would drag every page's JSX through
Playwright's transpiler), scans each page once per surface that idles closed
(`SCANS`: a named step list per state, each from a fresh load — every
dialog and alertdialog, the submenus, the context menu, each select and
combobox popup incl. grouped/virtual and the forms page's, and the app
shell's sheet at a narrow viewport, #194; a closed popup contributes nothing
to the scanned tree), and
hard-fails on serious/critical WCAG A/AA violations. `color-contrast` is
disabled by name: contrast answers to the contrast audit's own floors, not
axe's single resting-state sample. Documented exceptions live in
`e2e/axe-allowlist.json` as `{ rule, selector, reason }` rows; stale rows
fail the spec, and a real bug never goes there — it gets fixed in
`packages/zero`, which is how this audit already paid for itself: a nameless
Select trigger (`role="combobox"` prohibits name-from-content — hence
`Select.Trigger`'s `label` prop), an invalid `aria-expanded` on the
role-less context-menu surface, and unlabelled combobox demo inputs);
and the **scope-coverage spec** (`e2e/scope-coverage.spec.ts`, #194) —
chromium, one load of `#/all`: every scope zero-basic's manifest declares
(ecosystem `ext-stepper` included, rendered from `@sigx/zero-ext-example` on
its own page) must render somewhere, plus the standalone `VisuallyHidden`,
since an unrendered scope is invisible to every sweeping spec at once); and
the **narrow-viewport sweep** (`e2e/narrow-viewport.spec.ts`, #45) — the
`narrow` project (Desktop Chrome at 420px) owns every `narrow-*.spec.ts`,
this sweep and the dialog, pagination and stats specs above; every other
project `testIgnore`s them and `narrow` runs nothing else. The sweep is one
test per design system walking every registry page:
the document must not scroll sideways, and no visible
`[data-scope][data-part]` may escape the content column — measured against
`main.shell-main`'s content box, never the viewport, whose shell offsets
would bury the signal. Out of scope by construction: parts inside an
ancestor whose `overflow-x` is not `visible` (the scroller itself is still
measured — that is how a scrolling pagination or horizontal timeline
passes), `position: fixed` parts, and 1px visually-hidden boxes. Deliberate
exceptions are `{ ds, scope, part, reason }` rows in
`e2e/narrow-allowlist.json` (`ds: "*"` for all six; the final slider mark's
label is the one today), and stale rows fail like the axe allowlist's
(target it with `--project=narrow`). Widths depend on the face, so the
playground bundles every face a skin names (`src/fonts.ts`: IBM Plex,
Roboto, Inter from `@fontsource`, playground devDependencies only) and
`bootPage` waits on `document.fonts.ready`. Without that, carbon's rows
measured in Segoe UI on Windows and the wider DejaVu Sans on the CI runner,
and the sweep passed locally but failed in CI on the same code: `pnpm build`,
then `pnpm --filter zero-playground e2e` (first run:
`pnpm --filter zero-playground exec playwright install`). Filtering needs
`exec` — `pnpm --filter zero-playground e2e -- <name>` drops the argument and
runs everything; use
`pnpm --filter zero-playground exec playwright test <file> --project=<project>`.
The dev server's port is `ZERO_E2E_PORT` (default 5199) — set it to run the
suite from two worktrees at once, since `reuseExistingServer` would otherwise
let the second borrow the first's server and test the wrong code. CI runs them
on every PR, records a trace on each test's first retry, and on failure
uploads `playwright-report/` + `test-results/` as the `playwright-report`
artifact (`playwright show-report` / `show-trace` on the download). The root `pnpm
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
Use the box it returns — re-reading `boundingBox()` afterwards brings the
unchecked null back.

A spec that runs once per design system iterates `DESIGN_SYSTEMS` from that
module, never a retyped list (#193). It is derived from
`examples/playground/src/design-system-list.ts`, the same data the toolbar's
registry (`src/design-systems.ts`) is built from — so a new skin is covered
by every such spec the moment it is registered. The list and the registry
are kept in sync at compile time (a `Record<DesignSystemId, …>`); `ds-smoke`
adds that the toolbar renders the whole registry in list order, and that no
spec may hardcode every id (a per-spec subset, like the skins whose drawer
slides, is fine).

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
  a different *shape*. Full component coverage (52 recipes, plus the kit's layout tier), with `variant`
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
  pack written against the recommended token grammar, pointed at by its
  package.json `"sigx-zero"` field. Adoption is discovery, not a hand-edit:
  `packages/zero-basic` and `packages/zero-heroui` list it as a
  devDependency, and `runStandardBuild` finds the field, fits the pack's
  recipes to the skin's vocabulary and merges the fragment (build-only, so
  the private package stays out of the published module graph). That makes
  zero-basic's emitted `register.d.ts` the Exclude-form compile proof
  (`packages/zero/type-tests/ecosystem/`), and zero-heroui the one real
  build composing api mode with an adopted pack. Private — it proves the loop the
  way the heroui skin proves axis shapes.
- `packages/create-zero-ds` → `@sigx/create-zero-ds` — the scaffold behind
  `pnpm create @sigx/zero-ds <name> --brief <id>` (#401): a Node-only bin with
  zero runtime deps that lays down a design-system package from nothing —
  the brief's tokens + Button, `@sigx/zero-basic`'s 52 recipes as
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
  runs all three; CI runs it in the e2e job after Build.
  `skipLibCheck` is `false` (#145): since core's declarations became
  lib-checkable, every program checks its dependencies' `.d.ts` too, as a
  strict consumer would.
  Private, excluded from the root typecheck like the playground.

**Lockstep versioning**: every publishable package shares one version. Never
bump a single package's version — use `pnpm version:patch|minor|major`.
Publishing is handled by `scripts/publish.js` in topological order.

## Cutting a release

Releases are plain semver — `0.4.0`, `0.5.0`, … — from #148 on; the betas
ended at 0.3.0-beta.1. Every step but the tag goes through a PR like any
other change, and the tag is what publishes:

1. `pnpm wt new <N-release-X.Y.Z>`, then `pnpm version:minor` (or `patch` /
   `major`; `pnpm version:set X.Y.Z` for an exact one). It moves every
   publishable package to the one version and cuts both CHANGELOGs
   (`[Unreleased]` → `[X.Y.Z] - <today>` under a fresh `[Unreleased]`). A
   bump from a prerelease drops it and bumps: 0.3.0-beta.1 → `minor` →
   0.4.0. It plans every package before writing any: a relative bump
   refuses a tree whose publishable packages already disagree (exit 1,
   nothing written) — `version:set X.Y.Z` puts one back in step.
2. `pnpm typecheck && pnpm test && pnpm build && pnpm verify:pack`, then a
   PR (`chore(release): X.Y.Z`) with Copilot as reviewer, merged like any
   other — that is the release commit.
3. On `main` at that commit: `git tag vX.Y.Z && git push origin vX.Y.Z`.
   `release.yml` first fails unless the tag equals every publishable
   package's version (`scripts/check-release-tag.mjs`, #196 — a tag on the
   wrong commit used to skip everything on npm and still cut a GitHub
   release; run it locally with `node scripts/check-release-tag.mjs vX.Y.Z`),
   then lints, typechecks, builds, tests, verify-packs and
   publishes the five packages with npm trusted publishing (OIDC — no
   token) and provenance, then creates the GitHub release. A plain tag
   lands on npm `latest`; a prerelease tag (`v0.4.0-rc.1`, still possible
   through `version:set`) lands on its own dist-tag and never `latest`.
4. Comment the tag on every open signalxjs.github.io docs issue the release
   ships (the Documentation section above), and tick the tracker.

Two things a release can trip on. **A package's first-ever publish is
manual**: trusted publishing can only publish to a package that exists, so a
new name 404s on PUT in CI — `pnpm publish:all` from an authenticated shell
on the tagged commit publishes it (it skips what is already on the
registry), then add the trusted publisher for it on npmjs.com and re-run
the failed workflow. And **the `beta` dist-tag is frozen at 0.3.0-beta.1**:
a consumer still pinning `beta` sees nothing after it — pin `latest` or a
caret range.

**Core alignment PRs** (`core-sync.yml`) open with the `CORE_SYNC_TOKEN`
secret — a fine-grained PAT or GitHub App token with contents +
pull-requests write on this repo — because a PR opened with the default
`GITHUB_TOKEN` starts no `pull_request` workflows, so CI never ran on it.
Without the secret the workflow falls back to `GITHUB_TOKEN`: close and
reopen the PR (or push an empty commit to it) to start CI.

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
- A non-carrier part that takes an axis prop of its own declares it:
  `carries: ['color']` on `timeline.marker` (#94), `steps.item` (#112) and
  `stats.item` (#161).
  It renders the attribute
  itself, the compiler lets the nearest carrier win, and `expectAnatomy`
  fails a `data-color`/`data-size`/`data-variant` on any part that is
  neither the carrier nor declares it. Named axes only, never on the carrier.
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
- sigx stops only the effects a component creates *during setup*. An
  `effect()`/`watch()` created inside `onMounted` is owned by nothing and
  outlives the part (#163) — run the mount hook's reactive work through a
  `mountScope()` created in setup (`onMounted(() => scoped(() => { … }))`).
  `__tests__/mount-effects.test.tsx` holds the popups and the toast viewport
  to it.

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
