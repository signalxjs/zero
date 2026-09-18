# @sigx/zero

Unstyled, accessible component primitives for [SignalX](https://sigx.dev).
Components render a stable, machine-readable anatomy — `data-scope`,
`data-part`, `data-state` — and no styling; a design system is a separate CSS
artifact compiled by [`@sigx/zero-kit`](https://npmjs.com/package/@sigx/zero-kit)
(start with `@sigx/zero-basic` or `@sigx/zero-daisyui`).

```bash
npm install @sigx/zero sigx
```

```tsx
import { Dialog } from '@sigx/zero/dialog';
import '@sigx/zero/css';               // layer order + token fallbacks
import '@sigx/zero-basic/css';         // ← the design system (swappable)

<Dialog.Root model={() => state.open}>
    <Dialog.Trigger>Open</Dialog.Trigger>
    <Dialog.Popup>
        <Dialog.Title>Native top layer</Dialog.Title>
        <Dialog.Close>Close</Dialog.Close>
    </Dialog.Popup>
</Dialog.Root>
```

## Components

Button · Tabs · Collapsible · Accordion · Dialog · Popover · Tooltip · Menu ·
Select · Switch · Checkbox · RadioGroup · Slider · Progress ·
Field · Avatar · Toast · Combobox · Toggle · ToggleGroup · NumberInput ·
RatingGroup · TreeView · Input · Textarea · Card · Alert · Badge · Divider ·
Skeleton · Spinner · Kbd · Status · Indicator · Stats · Timeline · Chat · RadialProgress · Join ·
Navbar · Breadcrumbs · Pagination · Steps · Drawer · Table · FileUpload · Carousel · Swap · Countdown · Diff
Stack (Row/Col) · Spacer · Grid · Center · Box · Container

All state is one two-way `model` prop (sigx `Define.Model`) — bind a signal
property with `model={() => state.open}`, or leave it uncontrolled with
`defaultOpen` / `defaultValue`. No controlled/uncontrolled prop triplets.

**The naming rule.** Every model has a concept `N` and exactly two
companions: `default<N>` seeds it uncontrolled and `<n>Change` reports a
write (`onOpenChange`, `onValueChange`, `onActiveChange`). A named model
(`model:open`, `model:expandedValues`) has its name for a concept. The
anatomy declares each model (`models` on `defineAnatomy`, emitted into
`manifest.json` with the derived companion names, the value type, the
compound member that carries it, and whether it posts to a form), and a
parity test holds every component source to it — so a tool can tell a
Select from a Card without reading component code.

**The binding law.** Every zero model *is* a sigx `Model`, and every native
control zero renders binds to it with `model=` — never a hand-wired
`value=`/`onInput` pair. sigx's platform processor owns the write-back, so a
zero wrapper does everything the raw element does: `modelModifiers`
(`trim`, `number`, `lazy`, `debounce`, custom) work on `Input.Root` and
`Textarea.Root` exactly as on a bare `<input>`, a `Checkbox.Root` bound to a
`string[]` is sigx's array mode (several boxes toggling their own `value`'s
membership), and a `RadioGroup.Item` is a real radio bound to the group's
model. A native control that binds a *projection* of the state binds a
`derivedModel(read, write)` — Slider's range binds the first value (its
write quantizes and clamps), NumberInput's text input binds the draft (its
write never touches the model; commit does). The only hand-wired controls
left are the ones sigx has no processor for: Slider's range projection
(hidden inputs, one per value) and FileUpload's `FileList`. Value transforms
run once at the component boundary; timing reaches the element.
`createControllableState` (public, `@sigx/zero/behaviors`) returns that
Model, and `createInertState` seeds a part's fallback context.

**Value shapes follow `multiple`.** Select, Combobox and ToggleGroup hold
one value in single mode (`T | null` / `V | null` for a data-driven Select or
Combobox, `string` for hand-written items and for ToggleGroup) and an array
under `multiple` — typed through the overloads, so a string signal never
binds a multiple group. RadioGroup takes `items` too (`itemKey` is the
posted value, `itemLabel`, `itemDisabled`, the `item` slot); its model stays
the string a native radio group posts.

**The form contract.** Every posting control takes the same five props
(`name`, `form`, `disabled`, `invalid`, `required` — `WithFormControl`, plus
`readonly` where the platform has it) and answers to a `Field.Root` for all
of them. A control posts only while it carries a `name`; a disabled control
never posts; `form="id"` associates it from outside the form's subtree; and
the owning form's `reset()` restores the component default into the model
and the DOM. Select and Combobox post through a real, visually-hidden
`<select>`, so `required` is a platform constraint (the invalid focus lands
on the trigger / input) rather than an `aria-required` hint. The runtime
half is `createFormControl` + `onFormReset` (`@sigx/zero/behaviors`), the
one `VISUALLY_HIDDEN_STYLE` beside them.
Native-platform first: `<dialog>` +
top layer (no Portal), the `popover` attribute, `<details>`, real form
inputs. SSR-safe ids via `app.use(zeroPlugin())` per request.

The peer-parity surfaces ship too: Menu has stateful items
(`Menu.CheckboxItem`, `Menu.RadioGroup`/`Menu.RadioItem` — APG
menuitemcheckbox/menuitemradio; toggling keeps the menu open unless the item
sets `closeOnSelect`); Dialog has an alert-dialog preset
(`role="alertdialog"`: no backdrop dismiss, initial focus on the
least-destructive `Dialog.Cancel`); Slider's `model` accepts `number[]` for a
composed multi-thumb range (`Slider.Track`/`Range`/`Thumb`, thumbs clamp at
their neighbors, `marks` renders ticks) while a scalar model keeps the native
`<input type=range>`; Select and Combobox group options
(`Group`/`GroupLabel`, the optgroup equivalent).

**Select and Combobox are typed generic over their items.** `items` is
the data; `T` infers from it, and the model holds the item unless
`itemValue` says what it holds (`itemValue={(c) => c.code}` makes a
string model; a number is as welcome) — `null` while nothing is selected
either way, `multiple` making it an array instead. `itemKey` is the string
identity (the DOM id, the typeahead target, the posted value), `itemLabel`
the display text, `itemDisabled` and `itemGroup` complete the accessors;
the defaults read an object's `value` / `label` / `disabled` / `group` or
the primitive itself. Labels resolve from data before anything mounts. With
`items` and no slot children the Root renders the full default composition
through the same anatomy (the `item` slot customises an option); explicit
children win entirely, and hand-written `Select.Item` children register
into the same collection. Combobox filters by default — a contains-match on
the label — `filter` replaces the rule and `filter={false}` shows a
server-filtered list as is; `Combobox.Empty` renders only while nothing is
visible. Both post through a real hidden `<select>` (every item as an
option in data mode, `multiple` under `multiple`). There is no separate
native select: the hidden `<select>` is the form control, and a native
projection would be a prop on this anatomy, never a second component.

Interaction state is published as data for the design system to style:
`data-focus-visible`, and press feedback on every interactive part —
`data-pressed` while the pointer/key is down (a press ends when the gesture
ends: captured pointers, like a slider drag, hold it until release),
`data-press-animating` until the press animation ends — finished, cancelled,
or destroyed with the stylesheet that declared it — with the press
point as `--press-x` / `--press-y` / `--press-r`. Checkable controls
(Switch, Checkbox, RadioGroup) take the press from anywhere in their label
row and surface it on the visible control. That is what makes a
pointer-anchored effect like Material's ink ripple — or its selection-control
halo and slider-thumb halo — expressible as pure CSS.

ARIA wiring is presence-aware: an overlay references its `Title` /
`Description` ids only while those parts are actually rendered, so omitting a
title never leaves a dangling `aria-labelledby` (which would suppress the
accessible-name fallback). Escape dismissal is universal — a tooltip closes
from anywhere (WCAG 2.1 SC 1.4.13), and a non-modal Dialog falls back to the
dismiss layer where the platform fires no `cancel`. Close buttons whose
content is a glyph (`Alert.Close`, `Toast.Close`) default to
`aria-label="Close"` with a `label` prop override, and RatingGroup's per-item
names localize through `itemLabel={(index, count) => …}`. Controls that
consume the Field context (Input, Textarea, Combobox, Select, RatingGroup,
…) adopt its control id, so `Field.Label` names them — Select's trigger
included, a button being a labelable element. Outside a Field,
`Select.Trigger` takes a `label` prop (`aria-label`): `role="combobox"`
prohibits name-from-content, so the value text inside the trigger can never
name it, and TreeView's typeahead matches the accessible text of a branch
row (skipping `aria-hidden` decoration such as the default indicator glyph).

`css/base.css` also declares `--print-ink`, the ink a print fallback draws
with. Paper is not theme-aware — `print-color-adjust: economy` drops background
paint, so a mark drawn as a background comes back as a glyph, and every
theme-carried candidate for that glyph's ink is white on one side or the other
(`--color-base-content` and `CanvasText` under a dark theme, an on-accent ink
under a light one, over a fill that did not print). A design system may
override it; it never has to declare it.

## Patterns

Compositions the pieces above are designed to express — no component grows a
prop for what a composition already says.

**The loading button.** Button stays behavior-free: there is no `loading`
prop, because "busy" is a *styling* state the design system draws and a
*semantics* the app owns. Compose it:

```tsx
<Button.Root
    disabled={saving()}
    mods={saving() ? { loading: true } : undefined}
    onClick={save}
>
    Save
</Button.Root>
```

`mods` renders the presence-only `data-mod-loading` attribute; a design
system that declares the `loading` modifier — `@sigx/zero-daisyui` does —
draws the spinner (and hides or dims the label) in pure CSS off
`[data-mod-loading]`, a recipe-drawn mark the same way checkbox ticks work.
Under a design system that does *not* declare it, the attribute would match
no rule, so pass the mod only when the active vocabulary declares it (the
manifest's `tokens.modifiers`) and the composition degrades to a plain
disabled button — the accessible truth (`disabled` while the request is in
flight) never depended on the paint.
Announce long operations to AT with your own live region or a
`Spinner label="Saving…"` beside the button when the design draws nothing.

## Typed vocabulary (opt-in)

The variant-axis props (`color`, `size`, `variant`, `axes`, `mods`) are open unions
by default — any design-system-declared value is valid, recommended names
autocomplete. They are generic on the component scope through an empty
`ZeroVocabulary` interface: a design system's **generated** `/register`
module (emitted by `sigx zero:build`; see docs/architecture.md, "The
variant-axis pipeline") augments it, and one
`import '@sigx/<ds>/register'` at the app entry narrows every component's
props to exactly what that design system's compiled CSS answers to — plus
theme names on the authoring surface (`setTheme('dimm')` becomes an error),
custom-property and breakpoint autocomplete, and per-category token keys
through the `cssVar(name)` and `token(category, key)` helpers. No import,
no change — the open unions stay.

## Vendor-named surfaces (`@sigx/zero/adapt`)

A design system that declares an `api` (see `@sigx/zero-kit`) ships a
generated `./components` module — zero's components under the vendor's own
prop names (`<Button kind="ghost" hasIconOnly>`), fully typed with no
`/register` import. The behaviour behind every such module is one generic
helper here:

```ts
import { adapt } from '@sigx/zero/adapt';
export const Button = adapt(ZeroButton, {
    props: {
        kind: { axis: 'variant', values: { 'danger--tertiary': 'danger-tertiary' } },
        hasIconOnly: { modifier: 'icon-only' },
    },
});
```

`adapt` delegates the base component's setup with a renaming view over its
props — one component instance, so slots, events, models, refs and lifecycle
pass through untouched, and reads stay reactive. The rendered attributes are
unchanged (`kind="ghost"` renders `data-variant="ghost"`, never `data-kind`):
renaming lives at the prop boundary, the anatomy contract does not move. The
spec is kit-generated and kit-validated data; `adapt` performs no validation,
and the generated `components.d.ts` (instantiating the exported `Adapted`
type) is the typed surface consumers see.

## Building your own components

The authoring surface zero's own components are built from is public, so an
ecosystem package can ship a component zero doesn't — same anatomy contract,
same behaviors, held to the same conformance assertion:

- `defineAnatomy` (from `@sigx/zero/anatomy` or the root) declares the scope,
  parts, closed `data-state` sets, flags, `hiddenIn`, the part tree
  (`parent` — which same-scope part each part renders inside) and, for parts
  that carry `data-placement`, the `placements` subset; parts that take
  layout attributes name theirs as `layout` — and `toJSON()`
  emits exactly the shape zero's own `manifest.json` carries per component.
  States are governed: every value must be a member of `STATE_VOCABULARY`
  (with `STATE_SYNONYMS` naming the member for a rejected spelling), flags of
  `FLAG_VOCABULARY`, placements of `PLACEMENT_VOCABULARY`, layout attributes
  of `LAYOUT_VOCABULARY` — and
  `mergeManifests` enforces all four on published fragments, so an ecosystem
  scope cannot invent synonyms either.
- `@sigx/zero/behaviors` — controllable state, SSR-safe ids, roving tabindex,
  dismissal, focus management (`createFocusRestore`, `focusFirst`,
  `getTabbables`), list/tree registration with listbox-highlight stepping
  (`moveHighlight`, `optionText`), typeahead, anchor positioning, press
  feedback, the form contract (`createFormControl`, `onFormReset`), and the
  listbox layer: `createCollection` (items as data — `itemKey` /
  `itemLabel` / `itemValue` / `itemDisabled` / `itemGroup`, with JSX items
  registering into the same list), `createListbox` (visibility with a
  default contains-filter, single/multiple selection over the model,
  highlight stepping, typeahead over the visible labels, option ids),
  `createListboxItem` (the `role="option"` bag), `createGroupPresence` and
  `syncPopover`.
- `@sigx/zero/contract` also carries `JsxProps` and `FactoryBrands`: a root
  written once against `unknown` is exported through a cast to a generic call
  signature, so `items` infers `T` at the JSX level (the mechanism behind the
  typed Select of #438).
- The contract helpers — `dataAttr`, `stateAttr`, `variantAttrs`,
  `renderAsChild`, and `synthesizesClickFrom` for parts that combine
  `asChild` with keyboard activation (skip the keys the platform already
  synthesizes a click from, or an anchor activates twice per Enter).
- `@sigx/zero/testing` — `expectAnatomy(container, anatomy)`, the assertion
  zero's own test suite runs against every rendered part: declared parts
  only, states from the closed set, flags declared and presence-only,
  `data-placement` from the part's declared subset, DOM nesting matching the
  declared part tree, and `hidden` exactly where `hiddenIn` says. It throws a
  plain `Error`, so it works under any test runner. A component rendering
  custom axes names them: `expectAnatomy(el, anatomy, { axes: ['emphasis'] })`.
  The rules themselves are platform-neutral: `expectAnatomyElements`
  runs them over an `ElementLike` (`getAttribute`/`getAttributeNames`/
  `parent`), so a non-DOM test renderer wraps its nodes and holds components
  to the identical contract.

## Non-DOM platforms

The contract is not web-shaped, and two subpath exports keep the layers a
non-DOM runtime (`@sigx/lynx-zero`) builds on importable without `lib.dom`:

- `@sigx/zero/contract/core` — the DOM-free contract surface: everything
  `./contract` exports except the deliberately DOM-typed asChild bag
  (`props.ts`) and helpers (`as-child.ts`). This is the entry a platform
  runtime imports the vocabularies, `variantAttrs` and the class grammar
  from.
- `@sigx/zero/behaviors/core` — the platform-neutral behavior subset:
  controllable state, ids, field context, option segmentation, and the list
  controller with its element type open (a runtime that never mounts DOM
  elements registers `el: () => null` and gets the registration-order
  fallback — depth-first render order, which is visual order there).
- `@sigx/zero/theme/registry` — the theme-metadata registry alone, without
  the browser controller/provider.
- The **class grammar** (`@sigx/zero/contract`): on a platform whose style
  engine cannot select on attributes, `data-*` still renders (tests,
  tooling) but styling hooks are classes — `partClass('tabs', 'tab')` →
  `zx-tabs__tab`, plus `zx-s-<state>`, `zx-f-<flag>`, `zx-a-<axis>-<value>`,
  `zx-m-<mod>`, `zx-o-<orientation>`, `zx-p-<placement>`,
  `zx-theme-<name>` and the `zx-root` token host. `CLASS_GRAMMAR_VERSION`
  stamps compiled artifacts; `@sigx/zero-kit`'s non-web targets emit
  selectors from a parity-tested mirror of the same grammar.

The `portable` type-test project compiles this whole surface under
`lib: ["es2022"]`, so a DOM type leaking into it fails this repo's CI, not a
downstream platform's build.

## For tooling / AI

- `@sigx/zero/anatomy` — every component's parts × states × flags as typed
  objects with a `selector()` builder.
- `@sigx/zero/manifest.json` — the same registry as JSON, states as
  ready-made CSS selectors.
- A part's `hiddenIn` lists the states in which the runtime sets `hidden` on
  it — `avatar.image` while `error`, `tabs.panel` while `inactive`. Rules for
  those states never paint, so a design system may leave them unstyled (and
  need not tell them apart from a visible state), and a generator can skip
  emitting them.
- A part's `parent` names the same-scope part it renders inside — the
  anatomy's part TREE, from which tooling derives real ancestor chains
  (the contrast audit builds its measurement DOM from it) instead of
  hand-maintaining nesting tables. Top-level parts omit it.
- **A slotted default is a text node; a consumer's symbol is an element.**
  Where zero renders default content at all, it renders bare text — no
  wrapper. That is a difference CSS can see, and design systems depend on it
  to decide whether to draw their own mark or leave the consumer's alone:
  `&:not(:has(> *))` selects the default, `&:has(*)` the override. Never wrap
  a default in an element.

  The one case today is `RatingGroup.Item`, whose default content is
  `★` (full) / `★` (half) / `☆` (empty). `half` is a **full** star on purpose:
  the half-star codepoint `⯪` (U+2BEA) is poorly covered in the common system
  sans stacks and renders as tofu, so rendering a *distinct* half is the design
  system's job — by drawing geometry, or by masking/clipping this glyph, both
  of which need a full-width star in all three states. The value itself never
  depends on the symbol: it lives on the hidden input, and each item carries
  its own aria-label.
- `llms.txt` — the compact spec for language models.

MIT © Andreas Ekdahl
