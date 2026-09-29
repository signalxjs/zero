# @sigx/zero-ext-example

The acceptance test for the **ecosystem-component contract**: a component zero
doesn't ship (`ExtStepper`, scope `ext-stepper`), built **entirely from
`@sigx/zero`'s public surface** — `defineAnatomy`, the behaviors
(controllable state, list registration, roving tabindex, press feedback,
focus-visible), the contract helpers (`variantAttrs`, `htmlAttrs`, `renderAsChild`,
`synthesizesClickFrom`) — and held to the contract by the published
`@sigx/zero/testing` assertion. Private on purpose: it proves the loop the
way zero-heroui proves axis shapes, rather than shipping a product.

Both parts forward html attributes (`id`, `title`, `role`, `aria-*`, the
app's own `data-*`) through `WithHtmlAttrs` and `htmlAttrs(props)`, as zero's
own parts do. The package's `build` emits declarations for them, which is what
holds zero to exporting every type `WithHtmlAttrs` names (#447).

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

**A declared runtime property** (#456). The root writes its item count
inline as `--ext-stepper-count`, and the anatomy declares it
(`runtimeProperties: ['--ext-stepper-count']`), so the fragment carries it
and `mergeManifests` holds it to the `--ext-stepper-` prefix. The pack reads
it bare, and only in `targets.web`: there the root is a grid with one equal
track per item (`repeat(var(--ext-stepper-count), minmax(min-content, 1fr))`),
while the shared section keeps the flex row, so an adopter's lynx build keeps
the scope. `examples/playground/e2e/ext-stepper.spec.ts` measures the tracks
in basic and heroui.

**A domain flag: the optional step** (#457). `<ExtStepper.Item optional>`
marks a step the user need not complete to advance. The anatomy declares it
on the item (`domainFlags: ['optional']`), so the fragment carries it and its
selector (`selectors['x-optional'] = '[data-x-optional]'`), and the item
renders it presence-only through zero's public `domainFlagAttrs`:
`data-x-optional=""`, absent (never `="false"`) on a required step. The pack
paints it under the recipe key `'x-optional'` in the item's `states`, as a
dashed border. A data attribute carries no accessibility meaning, so the
native button also says it in text: a `VisuallyHidden` ", optional" after
its label, making the accessible name "Shipping, optional". With `asChild`
the app owns the element and its name, so the item adds the attribute but
injects no text there; put the word in your own element's name. The
playground's "Details" step is optional, and `ds-smoke` holds every
`data-x-*` on the page to the part whose anatomy declares it.

`@sigx/zero-basic` consumes both — which makes it the end-to-end proof that a
merged scope compiles, that the generated `register.d.ts` takes the
`Exclude<…>` form and still typechecks (`type-tests/ecosystem/`), and that a
design system that never merges the fragment simply leaves the component
unstyled-but-accessible.

The playground renders it on its own page (`#/ext-stepper`, #194), so the
e2e sweeps — ds-smoke, press-feedback, the axe audit — see the adopted scope
in zero-basic, and `examples/playground/e2e/scope-coverage.spec.ts` fails if any scope a design
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
