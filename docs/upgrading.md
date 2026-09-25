# Upgrading from 0.2.0-beta.1 to 0.3.0-beta.1

Everything below is what changed between `@sigx/zero` / `@sigx/zero-kit`
**0.2.0-beta.1** (the npm `latest` before this release; beta.2–beta.6
carried only lynx-target fixes and lockstep bumps) and **0.3.0-beta.1**. It
is the consumer-facing companion to the two changelogs — the
[`@sigx/zero` changelog](../packages/zero/CHANGELOG.md) and the
[`@sigx/zero-kit` changelog](../packages/zero-kit/CHANGELOG.md) say *what*
landed and why; this page says what to change in an app, a design system or
an ecosystem package, with a before/after per item.

The two packages are lockstep-versioned: upgrade both together, plus every
`@sigx/zero-*` design system you use.

Sections: [Breaking](#breaking-changes) (do these first), then
[New surface that replaces hand-rolled code](#new-surface-that-replaces-hand-rolled-code)
(delete your workarounds), then the [design-system and kit](#design-systems-and-the-kit)
changes, then [ecosystem packages](#ecosystem-component-packages).

---

## Breaking changes

### The peer is sigx core 1.x

0.3.0-beta.1 peers on `sigx ^1.0.0` (and `@sigx/reactivity`,
`@sigx/runtime-core`, `@sigx/runtime-dom`), from `^0.15.0`. Move the app to
core 1.0.1 first — one copy of each, the way the catalog in this repo
enforces it; core 1.0 also ships its own duplicate-copy guard. What that
major changes for a zero consumer:

- Every JSX expression is typed (`JSXElement`) rather than `any`, because
  core now ships the global `JSX` namespace. A hand-written `asChild` seam
  that returned `unknown` from a view stops compiling — return the slot's
  result typed as `JSXElement | JSXElement[] | undefined` (zero's
  `renderAsChild` does now).
- `@sigx/vite` moves with it (1.x); the `^0.13` pin some consumers copied
  from this repo is no longer needed.

### Select and Combobox: `options` is `items`, and the model holds the item

The roots are generic over their data. `T` infers from `items`; the model
holds the **item** unless `itemValue` says what it holds. Nothing selected
is `null`, not `''`. The accessors are `itemKey` / `itemLabel` /
`itemDisabled` / `itemGroup`; the `item` slot customises a generated option.

```tsx
// before
<Select.Root options={[{ value: 'ask', label: 'Ask' }, { value: 'deny', label: 'Deny' }]}
             model={() => state.mode} />            // model: string, '' when empty

// after — a string model needs itemValue
<Select.Root items={[{ value: 'ask', label: 'Ask' }, { value: 'deny', label: 'Deny' }]}
             itemValue={(o) => o.value}
             model={() => state.mode} />            // model: string | null

// after — or let the model hold the item
<Select.Root items={modes} itemLabel={(m) => m.title} model={() => state.mode} /> // Mode | null
```

- `multiple` makes the model an array (`T[]` / `V[]`), typed through the
  overloads — a string signal never binds a multiple root.
- **Combobox with `items` filters by default** (a contains-match on the
  label). Pass `filter={(item, query) => …}` for your own rule or
  `filter={false}` to keep filtering yourself. Hand-written `Combobox.Item`
  children stay consumer-filtered.
- **Removed:** `NativeSelect` (there is one Select; its hidden `<select>` is
  the form control), `segmentOptions` and `OptionInput` (the `options`
  sugar). `segmentBy` on `createCollection` is the grouping walk.
- Select gains `model:open` / `defaultOpen`, and `multiple` (the hidden
  `<select multiple>`, `Select.Value` joining the labels).

### Select, Combobox and ToggleGroup post through a hidden `<select>`

The `hidden-input` part is `element: 'select'` — a real, visually-hidden
`<select>` rather than `<input type="hidden">`. `required` is a platform
constraint (the invalid focus lands on the trigger / input / the group's tab
stop), a disabled control never posts, and a form `reset()` restores the
default. A hidden control renders **only while `name` is set**.

```css
/* before */
[data-scope="select"] input[type="hidden"] { … }
```
```css
/* after */
[data-scope="select"] select[data-part="hidden-input"] { … }
```

Anything reading the posted field from the DOM (tests, form serialisers that
walk elements) selects `select[data-part="hidden-input"]` now.

### ToggleGroup's model follows `multiple`

Single mode holds the pressed value as a `string` (`''` when none);
`multiple` holds a `string[]`. It was always `string[]`.

```tsx
// before
<ToggleGroup.Root model={() => state.view} />          // state.view: string[]
// after
<ToggleGroup.Root model={() => state.view} />          // state.view: string
<ToggleGroup.Root multiple model={() => state.views} /> // state.views: string[]
```

ToggleGroup also takes the form contract now (`name`, `form`, `disabled`,
`invalid`, `required`): with a `name` it posts through the hidden
`<select>` above — one field in single mode, a repeated field per pressed
value under `multiple` — so a segmented control in a `<form>` no longer
needs a hand-written hidden input beside it.

### Model naming: five renames

Every model has a concept `N` and exactly two companions, `default<N>` and
`<n>Change`. Five outliers were brought to the rule:

| Component | Before | After |
|---|---|---|
| Swap | `defaultOn` | `defaultActive` |
| Swap | `change` event (`onChange`) | `activeChange` (`onActiveChange`) |
| TreeView | `expandedChange` (`onExpandedChange`) | `expandedValuesChange` (`onExpandedValuesChange`) |
| NumberInput | `defaultValue: number` | `defaultValue: number \| null` (`null` is an explicit empty seed) |

```tsx
// before
<Swap.Root defaultOn onChange={(on) => …} />
<TreeView.Root onExpandedChange={(ids) => …} />
// after
<Swap.Root defaultActive onActiveChange={(active) => …} />
<TreeView.Root onExpandedValuesChange={(ids) => …} />
```

New seeds, for symmetry: `defaultFiles` on FileUpload; `defaultOpen` on
Tooltip, `Menu.Root` and `Menu.Sub`.

### `ControllableState<T>` is `Model<T>`; hand-written state literals do not type

`createControllableState` returns a real sigx `Model<T>`, and
`ControllableState<T>` is now an alias of it. A hand-written
`{ get value, set value }` literal — the shape ecosystem components used
for an inert fallback context — no longer satisfies it.

```ts
// before
const state: ControllableState<boolean> = { get value() { return false; }, set value(_) {} };
// after
import { createInertState } from '@sigx/zero/behaviors';
const state = createInertState(false);
```

Consequences you may notice: `modelModifiers` (`trim`, `number`, `lazy`,
`debounce`, custom) work through `Input.Root` and `Textarea.Root`;
`Checkbox.Root`'s model widens to `boolean | string[]` (sigx's array mode);
`Slider.Control` and `NumberInput.Input` bind with `model=` (a
`modelModifiers={{ number }}` hands the range a number). `derivedModel(read,
write)` in `@sigx/zero/behaviors` is the mechanism, if you build your own.

### A hand-built `FieldContext` must provide `size`

A form control with no `size` of its own now renders its Field's, exactly as
it adopts the Field's `disabled` / `invalid` / `required` / `readonly`.
`FieldContext.size()` carries it, and `FormControl.axisAttrs()` (from
`createFormControl`) returns the root's `variantAttrs` with that fallback
applied.

```ts
// before — an ecosystem control inside a Field
<div {...variantAttrs(props)} …>
// after
const control = createFormControl(…);
<div {...control.axisAttrs()} …>
```

A `FieldContext` you provide by hand needs a `size` member (return
`undefined` for "no size").

### Some parts refuse `role` / `id` at the type level

Every app-written part now forwards `aria-*`, your own `data-*`, `id`,
`title` and `role` (see [attribute pass-through](#every-part-forwards-aria--data--id-title-and-role)
below). Where a part's role or id **is** the component's semantics, the prop
is refused by the type rather than silently overridden — `role` on a tab,
a tree item, a switch, a popup (`Dialog.Popup`'s role is the Root's `role`
prop), a Select/Combobox item; `id` on labels, titles, descriptions,
disclosure panels, and everything another part points at. A `data-*` name
the contract owns (`data-state`, `data-color`, every flag, the `data-mod-` /
`data-l-` prefixes) throws.

If you were spreading a bag of attributes onto a part, remove the refused
keys from it; the compiler tells you which.

### Drawer and Dialog: the `close` event, and `open` in markup

- A non-modal `Dialog.Popup` / `Drawer.Panel` whose model starts `true`
  **server-renders with the `open` attribute** and no longer flashes open at
  hydration. If you hid one with CSS to cover the flash, remove that.
- `openChange(false)` still fires; a new **`close` event** follows it with
  `{ reason, value? }`. A confirm dialog reads the value instead of keeping
  a flag beside its model:

```tsx
// before
let confirmed = false;
<Dialog.Root onOpenChange={(open) => { if (!open && confirmed) doIt(); confirmed = false; }}>
  <Dialog.Close onClick={() => { confirmed = true; }}>Delete</Dialog.Close>
// after
<Dialog.Root onClose={(d) => { if (d.value === 'delete') doIt(); }}>
  <Dialog.Cancel>Cancel</Dialog.Cancel>
  <Dialog.Close value="delete">Delete</Dialog.Close>
```

`reason` is `close` · `cancel` · `escape` · `backdrop` · `programmatic`
(Drawer has no `cancel`). `Dialog.Root role="alertdialog"` is the alert
preset: no backdrop dismiss, initial focus on `Dialog.Cancel`.

### Drawer: the responsive attribute is `data-l-dock-above="md"`

This one only matters if you wrote CSS or tests against the unreleased
`main` between #82 and #122. A responsive drawer
(`modal={{ below: 'md' }}`) stamps `data-l-dock-above="md"` — the
breakpoint as the **value** — on its trigger, panel and close; the
per-breakpoint-name spelling `data-l-md-dock="inline"` no longer exists.
The panel's live regime is still `data-l-dock="sheet|inline"`.

The rule it settled: a layout attribute that switches a *mode* at a
breakpoint takes the breakpoint as its value (`data-l-stack="md"`,
`data-l-dock-above="md"`); the per-breakpoint name form (`data-l-md-gap`)
is only for a responsive *value*.

### Button: the loading composition is a prop

```tsx
// before
<Button.Root disabled mods={{ loading: true }}>Save</Button.Root>
// after
<Button.Root loading>Save</Button.Root>
```

`loading` renders `data-state="loading"`, `aria-busy` + `aria-disabled`,
blocks activation without touching the native `disabled` (so the button
keeps focus), and draws a `spinner` part. daisyUI's `loading` modifier gives
way to it.

### Kit: things a design-system author will hit on the first build

- **Ecosystem discovery is on by default.** Every dependency that declares
  a `"sigx-zero"` package.json field is adopted: its scopes are emitted
  into `dist/css/components/`, `manifest.json`, `register.d.ts` and
  `report.json`, and its findings count toward the audit score. A package
  you devDepend on *for tests* now ships. `ecosystem: false` on
  `runStandardBuild` (or `ZERO_ECOSYSTEM=0` for one run) turns it off;
  `exclude: ['<pkg>']` narrows it. A pack you also merge by hand through
  `fragments:` is skipped quietly.
- **`report.json` is `reportVersion: 2`** — a required `score` section was
  added; nothing else moved. A consumer pinned to version 1 reads `score`
  or ignores it.
- **`spacing/off-ramp` is an error.** A length that sits on no step of the
  `--space-*` ramp (`0.0625rem`, `0.875rem`) fails the build;
  `spacing/literal` (a literal that *is* a step, `0.5rem` for `--space-md`)
  is a warning. `em` lengths, anything inside `calc()`/parentheses, and `0`
  are exempt. Snap the value to a step or write it as arithmetic over a
  token.
- **`variants: []` means "no variant axis".** The validator used to reject
  the empty list; it now declares the axis out of existence, like
  `sizes: []` and `roles: {}` — every recipe keying `variants.variant`
  errors, `register.d.ts` emits `variant: never` with that reason, and the
  compiled tokens carry `variantsDeclared: boolean`. An *omitted*
  `variants` still means "declared nothing, check nothing".
- **The lynx class grammar is version 2** (`layoutClass` joined it).
  `lynx-manifest.schema.json` pins `classGrammarVersion: 2`, so a
  `@sigx/lynx-zero` runtime built for version 1 refuses the new
  stylesheets — upgrade both.
- **A misspelled CSS property is an error**, and axis *values* are graded
  by their own grammar (`AXIS_VALUE_PATTERN`: repeated hyphens allowed, so
  `danger--tertiary` is a legal value; `%` and `.` are not).
- **A dark-only design system no longer gets `color-scheme: light`** on
  `:root`; it states the default theme's own scheme. Drop the
  "name one theme as both defaults" workaround and any app-level
  `color-scheme` pin. A `defaultLight`/`defaultDark` pair whose sides are
  the wrong schemes is now a validation error.

---

## New surface that replaces hand-rolled code

Each of these existed as a workaround in at least one consumer. Delete the
workaround.

### The layout tier: Stack, Row, Col, Spacer, Grid, Center, Box, Container

`@sigx/zero` ships geometry primitives, and every design system's build
generates their CSS from its **own** spacing ramp and breakpoints. Hand-
written `Stack`/`Row`/`Spacer` components, and the unlayered CSS behind
them, go.

```tsx
// before — an app's own flex helpers
<div class="row gap-md align-center">…</div>
// after
import { Row, Stack, Spacer, Grid, Center, Box, Container } from '@sigx/zero';
<Row gap="md" align="center">…</Row>
<Stack gap={{ base: 'sm', md: 'lg' }} pad="lg">…</Stack>
<Grid cols="auto" track="sm"><Grid.Cell span="full">…</Grid.Cell></Grid>
<Container measure="prose">…</Container>
```

Values are closed to the ramp (`gap="md"` is `--space-md` in every skin;
`gap: 13px` cannot be spelled), which is what makes a density mode possible:
`[data-density="compact"] { --space-md: 0.375rem }` re-spaces every layout
at once. `Box` is the one scope that paints (`color`, `pad`); `Container`
bounds width from the new `--measure-*` token category.

### Every part forwards `aria-*`, `data-*`, `id`, `title` and `role`

`Button.Root`, every Table and Card part, and — as of #74 — every
app-written part of every component take `WithHtmlAttrs`. A kit `Button`
that re-stamped zero's anatomy on a raw `<button>` because `Button.Root`
forwarded no `aria-*` / `form` is no longer needed:

```tsx
// before — a raw element wearing zero's anatomy
<button data-scope="button" data-part="root" aria-label="Save" form="editor" …>
// after
<Button.Root aria-label="Save" form="editor" name="action" value="save">Save</Button.Root>
<Table.Cell colSpan={2} aria-describedby="hint">…</Table.Cell>
<Tabs.List aria-label="Settings">…</Tabs.List>
<Card.Root asChild><article>…</article></Card.Root>
```

An app `aria-label` replaces a part's default name (`Toast.Close`'s "Close",
Spinner's "Loading"); an app `aria-labelledby` / `aria-describedby` *joins*
the one the part wires. Raw `<tr data-scope="table">` rows are the same
story: `Table.Row` takes what you were putting on the element.

### Text controls: events, ARIA, a `ref`, and autosize

`Input.Input` and `Textarea.Textarea` take `onKeydown`, `onKeyup`,
`onBeforeinput`, `onInput` (after the model has the value),
`onCompositionstart` / `onCompositionend`, `onFocus`, `onBlur`, forward
`aria-*` / `data-*` / `title`, and expose a handle:

```tsx
let composer: TextareaHandle | undefined;
<Textarea.Root minRows={1} maxRows={8} name="draft">
  <Textarea.Textarea ref={(h) => { composer = h; }}
                     onKeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
</Textarea.Root>
composer?.focus(); composer?.element?.setSelectionRange(0, 0);   // `element` is null until mount
```

`minRows` / `maxRows` on `Textarea.Root` is the autosize: CSS
(`field-sizing: content`, bounds in `lh`) before hydration, a measured
height where the engine lacks it. A newline-counting `rows` stopgap goes.

### Combobox: `@mention` trigger mode, tags, `allowCustom`, caret anchoring

A hand-rolled composer listbox with imperatively synced ARIA is
`Combobox.Root trigger`:

```tsx
import { caretAnchor } from '@sigx/zero/behaviors';
<Combobox.Root trigger="@" anchor={caretAnchor} items={members}
               itemKey={(m) => m.id} itemLabel={(m) => m.name}
               itemInsert={({ item }) => `@[${item.name}](user:${item.id})`}
               onInsert={(d) => …}>
  <Textarea.Root><Textarea.Textarea /></Textarea.Root>   {/* or Input.Root > Input.Input */}
</Combobox.Root>
```

The root owns the token at the caret, the popup, the textarea's ARIA, the
keys (before your `onKeydown`), and the undoable commit. Under `multiple`
the data expansion renders `Combobox.Tag`s (with `TagLabel` / `TagRemove`),
Backspace on an empty input removes the last value, and `allowCustom`
commits free text.

### Windowed lists: `virtual={virtualListbox}` and `createVirtualList`

```tsx
import { virtualListbox } from '@sigx/zero/virtual-listbox';
<Select.Root items={tenThousand} virtual={virtualListbox} estimateItemSize={36} … />
```

`virtual` takes the strategy object, not a boolean, so the `select` /
`combobox` entries never carry windowing. For a chat log or any long
collection of your own, `createVirtualList({ count, key, estimateSize,
stickToBottom, … })` in `@sigx/zero/behaviors` returns the window, the
padding, and refs — stick-to-bottom follows the tail until the reader
scrolls up.

### Drawer: responsive sidebar, `measure`, a hidden title, sliding skins

```tsx
// before — the navigation rendered twice: a sidebar above md and a drawer below
// after — one drawer
<Drawer.Root modal={{ below: 'md' }} label="Navigation">
  <Drawer.Trigger>Menu</Drawer.Trigger>
  <Drawer.Panel measure="sm">
    <Drawer.Title visuallyHidden>Navigation</Drawer.Title>
    …
  </Drawer.Panel>
</Drawer.Root>
```

Below `md` it is a modal sheet; at or above, the panel is docked open
inline and the trigger/close hide — SSR-correct, from the design system's
compiled per-breakpoint CSS. `measure` sizes the panel from the
`--measure-*` ramp (`full` is a full-screen sheet). Four skins slide the
sheet from its edge; a closed panel is `display: none` structurally.

### `VisuallyHidden`, `visuallyHidden`, `hideLabel`

```tsx
<Field.Label visuallyHidden>Mode</Field.Label>
<Switch.Root hideLabel>Dark mode</Switch.Root>
<Button.Root><Icon /><VisuallyHidden>Settings</VisuallyHidden></Button.Root>
```

One `[data-visually-hidden]` rule in `css/base.css` (`@layer
zero.structure`) does the clipping; an app's own `.sr-only` goes.

### Table: `columns` and `stack`

```tsx
<Table.Root columns={[{ key: 'name', label: 'Name', width: '40%' }, { key: 'size', label: 'Size', align: 'end' }]}
            stack="md">
  <Table.Head />                     {/* renders <colgroup> + the header row from the labels */}
  <Table.Body>
    <Table.Row><Table.Cell column="name">…</Table.Cell><Table.Cell column="size">…</Table.Cell></Table.Row>
```

Below `stack`'s breakpoint every row becomes one block and each cell is
captioned by its column's label (`cell-label` part). Widths ride a
`<colgroup>`; alignment rides `--table-cell-align`.

### `useMediaQuery`, `getBreakpoints`, and breakpoints in CSS

```ts
import { useMediaQuery } from '@sigx/zero/behaviors';
const wide = useMediaQuery({ above: 'md' }, { initial: false });   // SSR-safe, reactive
```
```css
@import '@sigx/zero-basic/css/breakpoints';   /* @custom-media --above-md / --below-md */
@media (--below-md) { … }
```

`above: 'md'` is exactly the `(min-width: …)` the recipes compile
`at: { md }` to; `below` the exact complement. `getBreakpoints()` (from
`@sigx/zero/theme`) reads the registered ramp; `tokens.css` declares
`--breakpoint-<name>` on `:root`.

### Governed lifecycle states

`STATE_VOCABULARY.lifecycle` — `running`, `paused`, `denied`, `cancelled` —
joins `loading` and the outcomes `complete` / `error`. An ecosystem card
that borrowed `active` for "running" or `closed` for a refusal uses the
real spelling; `mergeManifests` accepts it, and the synonym table maps
`in-progress`, `rejected`, `canceled` and friends onto the governed one.

### Per-part colour: `Timeline.Marker color`, `Steps.Item color`, `Stats.Item color`

`PartSpec.carries` lets a part below the carrier take an axis of its own.
`<Timeline.Root color="neutral">` colours every dot, `<Timeline.Marker
color="error">` colours one; the same for `Steps.Item` and `Stats.Item`
(#161). A row of stats that needed one `Stats.Root color` per figure is now
one `Stats.Root` with a `color` on the item that differs.

---

## Design systems and the kit

### Extend a published design system: `extendDesignSystem` / `extendRecipe`

A `withOverride` deep-merge reaching into a skin's private internals is
replaced by a declared, validated derivation:

```ts
import { extendDesignSystem } from '@sigx/zero-kit/define';
import { designSystem as daisy } from '@sigx/zero-daisyui/design-system';

export const designSystem = extendDesignSystem(daisy, {
    name: 'acme',
    tokens: { roles: { primary: '#0a58ca' } },
    recipes: { button: { parts: { root: { base: { borderRadius: '999px' } } } } },   // a RecipePatch per scope
});
```

Objects merge per key, arrays and scalars replace, `null` deletes,
`compoundVariants` are addressed by `match`, and the layout tier is
regenerated from the derived tokens. `extendRecipe(base, patch)` is the
same merge for one recipe on its own; `addRecipes` adds scopes the base
does not style (patching one it does not style is an error). Skins declare public `hooks`
(`recipe.hooks`) for the seams they mean to be patched; patching a
`private-name` warns. A derived system now carries its base's `api` (the
self-import bug is fixed), and every shipped design system exports
`./design-system`.

### Recipes: `composes`, `below-<bp>`, `sameAs`, `hooks`

```ts
composes: { button: { within: 'footer', parts: { root: { base: { … } } } } }  // a nested scope, in context
at: { 'below-md': { … } }                                    // (width < …) — the exact complement of `md`
sameAs: { root: { paused: 'running' } }                      // two states that look alike on purpose
```

`composes` may also borrow the nested scope's own axis values and condition
on the host's. A no-op declaration written only to make two states differ
(`opacity: '1'`) becomes `sameAs`.

### `tokens.contrast`: declared pairs over custom tokens

```ts
contrast: [{ fg: 'caption-ink', bg: 'base-100', min: 4.5, description: 'dim captions' }]
```

`validateDesignSystem` measures every declared pair in every theme and
suggests the nearest passing value. A skin's own luminance code goes.

### `zero:audit`, `dist/audit.json`, and the static contrast matrix

The compiled-CSS guards (state legibility, button affordance, axis-value
coverage, reduced-motion loops) and the two contrast matrices (`contrast/
text`, `contrast/indicator`) ship in the kit: `sigx zero:audit` (or
`auditDesignSystem`) runs them for any design system, not only the six in
this repo. The report carries a composite `score` and `grade`.

### Papercuts closed

- `@sigx/zero/css` and every skin's `./css`, `./css/tokens`, `./css/*` have
  a `types` condition, so `noUncheckedSideEffectImports` no longer needs an
  ambient `*.css` shim.
- `FRAGMENT_VERSION` is on `@sigx/zero/contract` (and on
  `@sigx/zero-kit/define`), so a `./fragment` entry no longer hand-writes
  the literal.
- `sigx zero:validate --package <pkg>` / `zero:audit --package <pkg>` check
  an installed design system by name from a consumer app.
- `--extra-manifest` takes a JS fragment module or a bare package name, not
  only a JSON file.

---

## Ecosystem component packages

A package shipping a component zero does not (`@agentic/ui`'s `ai-*`
scopes, say) had to hand-run the fragment checks and be hand-wired into
every design system. Three commands replace that:

- **`"sigx-zero"` in package.json** —
  `{ "fragment": "./dist/fragment.js", "requires": ">=0.2.0" }` — is how a
  design system *discovers* the pack. The path is package-relative (not an
  exports subpath, for resolution reasons the kit changelog records).
- **`sigx zero:fragment`** is the authoring-side gate: the `version` against
  `FRAGMENT_VERSION`, `mergeManifests` against the installed
  `@sigx/zero/manifest.json`, recipe parts that exist in the anatomy,
  `validateRecipes` under the recommended vocabulary (a hostile-vocabulary
  probe included), the field, and the export-name convention. A
  `fragment.test.ts` that did all of that by hand goes.
- **`sigx zero:extend --ds <package> --out <dir>`**, run in the **app**,
  recompiles an installed design system against the app's own packs:
  `zero-extend.css` (the added scopes only) and a `zero-extend.js` /
  `.d.ts` **replacement** register — import that and **remove** the
  `<ds>/register` import, since two augmentations of
  `ZeroVocabulary.components` collide.

Two authoring rules that fell out:

- A pack recipe writes `var(--space-md, 0.5rem)` — with the fallback —
  where a design system's own recipe may write `var(--space-md)`: a design
  system that omits `system.spacing` emits no ramp, and lynx has no fallback
  layer.
- A pack may decline an axis for its own scopes with the fragment's
  optional `scopes` export (`{ 'acme-feed': { colors: [] } }`), so a
  component that renders no `data-color` need not wire every role to keep
  the guards quiet.

---

## Checklist

1. Bump `@sigx/zero`, `@sigx/zero-kit` and every `@sigx/zero-*` skin to the
   same version.
2. Fix the compile errors: `options → items` (+ `itemValue`), the five
   renames, refused `role`/`id` props, `ControllableState` literals →
   `createInertState`, a hand-built `FieldContext`'s `size`.
3. Fix the runtime shapes: `null` for an empty Select/Combobox,
   ToggleGroup's `string` in single mode, `select[data-part="hidden-input"]`
   in selectors.
4. Rebuild the design system; read the audit. Turn off ecosystem discovery
   or exclude the test-only packs if the emitted scopes surprise you; snap
   off-ramp spacing; pin `reportVersion: 2` consumers.
5. Delete the workarounds the [new surface](#new-surface-that-replaces-hand-rolled-code)
   covers — layout helpers, the kit `Button`, `.sr-only`, the composer
   listbox, the double-rendered navigation, the `withOverride` merge, the
   hand-run fragment checks.
