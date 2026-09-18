# @sigx/create-zero-ds

Scaffold a [SignalX Zero](https://npmjs.com/package/@sigx/zero) design system
from a style brief — the command behind step 2 of the `design-system` agent
skill.

```sh
pnpm create @sigx/zero-ds zero-acme --brief riso
# npm create @sigx/zero-ds zero-acme -- --brief riso
# npx @sigx/create-zero-ds zero-acme --brief riso
cd zero-acme && pnpm install && pnpm build
npx sigx zero:validate --report
```

## What it writes

```
zero-acme/
  package.json        peer + dev dependency on @sigx/zero; dev on @sigx/zero-kit, @sigx/cli, typescript
  tsconfig.json
  build.mjs           runStandardBuild — validate → compile → report → writeArtifacts
  README.md, .gitignore   (dist/, node_modules/, .zero-iterations.jsonl — the validate loop's log)
  src/tokens.ts       the brief's TokensInput (roles, system, themes), provenance-stamped
  src/button.ts       the brief's worked Button recipe
  src/baseline.ts     @sigx/zero-basic's 50 recipes, copied whole — yours now
  src/recipes.ts      [...fitRecipesToVocabulary(baseline, tokens) minus button, button]
  src/design-system.ts, src/index.ts
```

`baseline.ts` is why the first build styles every component rather than one.
`fitRecipesToVocabulary` (from `@sigx/zero-kit/define`) keeps only what
`tokens.ts` declares: the identity for the recommended vocabulary, and for a
brief that declines the colour or size axis or fuses `variant` (riso) it drops
the blocks those axes would have wired and redraws every undeclared role in
`base-content` on `base-100`. Diverge from the baseline freely; delete the fit
call once every recipe speaks your own vocabulary.

## Options

```
create-zero-ds <name> --brief <id> [options]

  <name>                 zero-acme, or @acme/zero-acme (the design system is
                         named from the last segment, minus a leading zero-)
  --brief <id>           brutalist | glass | corporate | terminal | riso | seeded | basic
  --baseline basic|none  basic (default): zero-basic's recipes fitted to the
                         brief; none: the brief's Button only
  --targets web[,lynx]   emit targets (default: web)
  --dir <path>           output directory (default: ./<last segment of name>)
  --dry-run              print the file plan, write nothing
  --force                write into a non-empty directory
```

Non-interactive by design: a missing argument is an exit code (2) and a usage
line, never a prompt. Exit 1 is a failure the arguments could not have
prevented (an unknown brief, a non-empty directory without `--force`).

## Ecosystem components

The generated `build.mjs` needs no wiring for them: `runStandardBuild`
adopts every dependency declaring a `"sigx-zero"` field, so adding an
ecosystem component package is `pnpm add -D @acme/zero-stepper` and nothing
else. Its recipes are fitted to whatever vocabulary your brief gave you.
`ecosystem: false`, or `ZERO_ECOSYSTEM=0` for one run, opts out.

## Why a `create-*` package

A `sigx` CLI plugin only loads where `@sigx/zero-kit` is already installed, so
`sigx zero:init` could never run in the empty directory a new design system
starts as (#10). A `create-*` package runs from nothing — `pnpm create`,
`npm create` and `npx` all resolve `@sigx/zero-ds` to this package — and needs
no template hook in `@sigx/cli`.

The templates are embedded at build time: zero-basic's `recipes.ts` and
`tokens.ts`, the six briefs from `@sigx/zero-kit/skills/design-system/briefs`,
zero-basic's `tsconfig.json`, and a `versions.json` carrying the lockstep
version and the ranges a generated package needs. This package has no runtime
dependencies; `pnpm create` is instant.

## Versioning

Lockstep with `@sigx/zero`, `@sigx/zero-kit` and `@sigx/zero-basic`: the
package at version X scaffolds a design system that depends on `^X` of each.
User-facing notes for this package live here — it keeps no CHANGELOG.
