# SignalX Zero

**Unstyled components + generatable design systems for [SignalX](https://sigx.dev).**

Zero splits UI into two artifacts that evolve independently:

1. **`@sigx/zero`** — headless, accessible compound components (native-element
   first: `<dialog>`, `<details>`, real inputs) that render a stable,
   machine-readable anatomy: `data-scope` / `data-part` / `data-state`
   attributes and nothing else. State is one two-way `model` prop
   (`<Dialog.Root model={() => state.open}>`) — no controlled/uncontrolled prop triplets.
2. **A design system** — pure data: typed tokens + per-part recipes compiled
   to plain, layered CSS by **`@sigx/zero-kit`**. Swapping the app's whole
   look is an import swap; generating a *new* look is something an AI (or a
   human afternoon) can do against the published anatomy manifest, with
   `sigx zero:validate` checking token completeness, WCAG contrast and state
   coverage, and `sigx zero:audit` reading the compiled CSS for what the
   states, indicators and axes actually render.

```tsx
<Tabs.Root model={() => state.tab}>
    <Tabs.List>
        <Tabs.Tab value="a">First</Tabs.Tab>
        <Tabs.Tab value="b">Second</Tabs.Tab>
    </Tabs.List>
    <Tabs.Panel value="a">…</Tabs.Panel>
    <Tabs.Panel value="b">…</Tabs.Panel>
</Tabs.Root>
```

```ts
// The entire skin of the app:
import '@sigx/zero-daisyui/css';           // ← or '@sigx/zero-basic/css', or yours
import { installThemes } from '@sigx/zero-daisyui';
installThemes();
```

```sh
# …and "yours" starts as one command:
pnpm create @sigx/zero-ds zero-acme --brief riso
```

## Packages

| Package | What it is |
|---|---|
| [`@sigx/zero`](packages/zero) | The runtime foundation: anatomy contract, headless behaviors (controllable models, SSR-safe ids, roving focus, dismissal), 50 unstyled components (primitives plus the content, navigation and behavior tiers), theme engine, `manifest.json` + `llms.txt` |
| [`@sigx/zero-kit`](packages/zero-kit) | Node-only authoring kit: `defineTokens` / `defineRecipe` / `defineDesignSystem`, the CSS compiler, the `sigx` CLI plugin (`zero:build` / `zero:validate` / `zero:audit`), and the design-system generation agent skill |
| [`@sigx/zero-basic`](packages/zero-basic) | Neutral starter design system — readable defaults, and the reference input for the AI skill |
| [`@sigx/zero-daisyui`](packages/zero-daisyui) | daisyUI-flavored skin — daisy's tokens and component look as pure data, no Tailwind required; ships a daisy-native typed `./components` surface (`<Button wide loading variant="dash" color="primary">`) |
| [`@sigx/zero-material`](packages/zero-material) | Material-flavored skin — the acceptance test that a foreign design language (13 colour roles, `level1`–`level5` elevation, its own easings and breakpoints) fits the contract with no special-casing |
| [`@sigx/zero-brutalist`](packages/zero-brutalist) | Brutalist skin — generated from a one-line style brief through the design-system agent skill, as the end-to-end proof that a look is data |
| [`@sigx/zero-heroui`](packages/zero-heroui) | HeroUI-flavoured skin — the acceptance test for non-orthogonal axis surfaces: no colour axis at all, colour fused into a seven-member `variant`, and presence-only `data-mod-*` modifiers |
| [`@sigx/zero-carbon`](packages/zero-carbon) | Carbon-flavoured skin — the runtime acceptance test for the api `values` remap: the fused `kind` axis with Carbon's double-hyphen spellings restored at the prop boundary by the generated `./components` module |
| [`@sigx/create-zero-ds`](packages/create-zero-ds) | `pnpm create @sigx/zero-ds <name> --brief <id>` — scaffolds a design-system package from a style brief, with zero-basic's 50 recipes as the baseline fitted to the brief's vocabulary |
| [`@sigx/zero-ext-example`](packages/zero-ext-example) | Ecosystem-component acceptance test — a `Stepper` zero doesn't ship, built entirely from `@sigx/zero`'s public surface, published as a manifest fragment + recipe pack and adopted by zero-basic |

`examples/playground` is the kitchen sink — `pnpm --filter zero-playground dev`.
`examples/typed-app` is the consumer-side type capstone — three isolated
programs compiling against the *emitted* packages (`/register` narrowing,
heroui's `./components`, carbon's renamed props); `pnpm build`, then
`pnpm --filter zero-typed-app typecheck`.

## Why zero is different

- **Models, not prop triplets.** sigx two-way binding replaces
  `value`/`defaultValue`/`onValueChange` with one optional `model`.
- **Native platform first.** `<dialog>` + top layer means no Portal, free
  focus trapping and Escape; `<details>` disclosure works with zero JS under
  `@sigx/resume`; form controls are real inputs that post forms pre-hydration.
- **The anatomy is a contract.** Every component ships parts × states × token
  hints as JSON. Recipes typecheck against it, tests assert against it, and
  AI generates against it. A part rename is a breaking change, and the build
  says so.
- **One token vocabulary across web, Lynx and terminal** — shared verbatim
  with `@sigx/lynx-zero`, so one design-system source can skin every sigx
  target.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — the design doc of the
  current system: the anatomy contract, the variant-axis pipeline end to end,
  the manifests, the compiler, the theme model, the authoring surface, and
  the full verification-gate inventory. Descriptive, not aspirational — it
  was written when the RFCs were deleted, and records their history.
- [`docs/building-your-own-component.md`](docs/building-your-own-component.md)
  — shipping a component zero doesn't, as a peer package.
- [`docs/design-system-conformance.md`](docs/design-system-conformance.md) —
  the conformance matrix (generated; never hand-edited).

## Development

```bash
pnpm install
pnpm build && pnpm test && pnpm typecheck && pnpm lint
```

See [AGENTS.md](AGENTS.md) for the contribution workflow.

## License

MIT © Andreas Ekdahl
