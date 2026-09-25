# @sigx/zero-ext-example

The acceptance test for the **ecosystem-component contract**: a component zero
doesn't ship (`ExtStepper`, scope `ext-stepper`), built **entirely from
`@sigx/zero`'s public surface** — `defineAnatomy`, the behaviors
(controllable state, list registration, roving tabindex, press feedback,
focus-visible), the contract helpers (`variantAttrs`, `renderAsChild`,
`synthesizesClickFrom`) — and held to the contract by the published
`@sigx/zero/testing` assertion. Private on purpose: it proves the loop the
way zero-heroui proves axis shapes, rather than shipping a product.

What it publishes to design systems, from the data-only `./fragment` entry:

- **`fragment`** — the manifest fragment
  (`{ package: '@sigx/zero-ext-example', components: [anatomy.toJSON()] }`).
  A design system opts into covering the component by merging it:
  `mergeManifests(zeroManifest, fragment)` in its build script, or
  `--extra-manifest` on the CLI.
- **`recipes`** — the recipe pack: default styling written against the
  *recommended* token grammar (`var(--color-primary)`,
  `var(--radius-selector)`), so any design system keeping the recommended
  vocabulary adopts it by spreading into its `recipes`. It wires both
  checked axes the way every sibling component does: `color` over the whole
  recommended role list and `size` over the recommended `xs`–`xl` ramp (type
  steps along `--text-*`, the `em` padding follows; a design system with a
  closed ramp such as `sm | md | lg` keeps the steps it declares when the
  pack is fitted on adoption). An item with no `size` renders the `md` step
  (`--text-md`) rather than inheriting its surrounding font size — the
  un-attributed render is the middle step, as in every sibling skin. A disabled item fades by the adopter's own
  `--disabled-opacity`, never a literal of the pack's.

`@sigx/zero-basic` consumes both — which makes it the end-to-end proof that a
merged scope compiles, that the generated `register.d.ts` takes the
`Exclude<…>` form and still typechecks (`type-tests/ecosystem/`), and that a
design system that never merges the fragment simply leaves the component
unstyled-but-accessible.

The playground renders it on its own page (`#/ext-stepper`, #194), so the
e2e sweeps — ds-smoke, press-feedback, the axe audit — see the adopted scope
in zero-basic; the contrast audit measures the item's every state from each
adopter's merged manifest (#245), inside its `root` — the part tree declares
`item` below the carrier, which is where the compiler anchors the axis rules, and `examples/playground/e2e/scope-coverage.spec.ts` fails if any scope a design
system declares goes unrendered again.

Zero has since **promoted the stepper pattern into a first-class `steps`
scope** (#339) — richer anatomy (indicator/separator/title/description
bands), orientation, recipes in every shipped skin. This package deliberately
does NOT go away and does not adopt the `steps` scope: its job is to prove
the ecosystem path with a scope zero does not own, and `ext-stepper` remains
exactly that. Apps wanting a stepper should use `Steps` from `@sigx/zero`;
packages wanting to see how an out-of-tree component is built should read
this one.

MIT © Andreas Ekdahl
