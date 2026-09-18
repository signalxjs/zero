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
and the DOM. Select, Combobox and ToggleGroup post through a real,
visually-hidden `<select>` — one field in single mode, a repeated field per
value under `multiple` — so `required` is a platform constraint (the invalid
focus lands on the trigger / input / the group's tab stop) rather than an
`aria-required` hint. The runtime
half is `createFormControl` + `onFormReset` (`@sigx/zero/behaviors`), the
one `VISUALLY_HIDDEN_STYLE` beside them.

**A sized Field sizes its control.** A control with no `size` of its own
renders its Field's, the same way it adopts the Field's flags, so a compact
field is one prop — the label goes with `visuallyHidden`. The control's own
`size` still wins, and only `size` is inherited: a Field's `color` accents
its label, not the control.

```tsx
<Field.Root size="xs">
    <Field.Label visuallyHidden>Mode for Bash</Field.Label>
    <Select.Root items={['ask', 'allow', 'deny']} defaultValue="ask" />
</Field.Root>
```
Native-platform first: `<dialog>` +
top layer (no Portal), the `popover` attribute, `<details>`, real form
inputs. SSR-safe ids via `app.use(zeroPlugin())` per request.

The peer-parity surfaces ship too: Menu has stateful items
(`Menu.CheckboxItem`, `Menu.RadioGroup`/`Menu.RadioItem` — APG
menuitemcheckbox/menuitemradio; toggling keeps the menu open unless the item
sets `closeOnSelect`); Dialog has an alert-dialog preset
(`role="alertdialog"`: no backdrop dismiss, initial focus on the
least-destructive `Dialog.Cancel`), and every Dialog/Drawer close reports
why on a `close` event that follows `openChange(false)` — `{ reason, value }`
with `reason` one of `close` · `cancel` · `escape` · `backdrop` ·
`programmatic` (Drawer has no `cancel`) and `value` from the closing
`Dialog.Close value="…"`, the `<form method="dialog">` + `returnValue` pair
in model form, so a confirm dialog needs no flag beside its model; Slider's `model` accepts `number[]` for a
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
visible. Under `multiple`, Combobox renders each chosen value as a tag in
the control (`Combobox.Tags` / `Tag` / `TagLabel` / `TagRemove`; the root's
`tag` slot supplies per-tag content). Backspace on an empty input removes
the last tag, and `allowCustom` commits free text on Enter. Both post through a real hidden `<select>` (every item as an
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

**Drawer width is `measure`.** `Drawer.Panel measure="md"` sizes the panel
from the design system's `--measure-*` ramp — Container's layout attribute,
not the `size` axis, which rides the trigger and cannot reach a panel that
is not inside it. An inline panel is exactly that wide; a modal sheet spans
the viewport up to it, so `measure="full"` is a full-screen sheet. Unset,
each design system keeps its own drawer width.

`@sigx/zero/css` (like every design system's `./css`) carries a `types`
condition pointing at an empty declaration, so the extensionless side-effect
import typechecks under `noUncheckedSideEffectImports` with no app-side shim.

**Attribute pass-through.** sigx forwards no rest props, so a part only
renders what it declares. The parts below take `WithHtmlAttrs` and forward
`aria-*`, the app's own `data-*`, `id`, `title` and `role` onto the element
they render (into the asChild bag too): `Button.Root` (plus its native
`form`/`name`/`value`), every `Table` part (`Table.Root` puts `aria-*` and
`role` on the `<table>` and the rest on its scroll wrapper; `Table.Cell` and
`Table.HeaderCell` also take `colSpan`/`rowSpan`), and every `Card` part
(`Card.Root` also takes `asChild`, for a card that is an `<article>`). The
part's own attributes win where both set one, and a `data-*` name the
contract owns — `data-scope`/`part`/`state`/`orientation`/`placement`, a
flag, `data-color`/`size`/`variant`, `data-mod-*`, `data-l-*` — is a compile
error where TypeScript can see it and throws at runtime either way. Build
your own forwarding part the same way: intersect `WithHtmlAttrs` into the
props and spread `htmlAttrs(props)` first.

```tsx
<Button.Root aria-label="Close" data-testid="close" onClick={close}>×</Button.Root>
<Table.Row data-row-id={row.id}><Table.Cell colSpan={5}>No results</Table.Cell></Table.Row>
<Card.Root role="region" aria-labelledby="report-title">…</Card.Root>
```

**Visually hidden, still named.** `Field.Label`, `Input.Label`,
`Textarea.Label`, `Dialog.Title` and `Drawer.Title` take `visuallyHidden`,
and `Switch.Root` / `Checkbox.Root` take `hideLabel` for their `label` part:
the part stays in the accessibility tree — the label still names its
control through `for`, the title still names its popup through
`aria-labelledby` — and leaves the screen. It renders
`data-visually-hidden`, which `css/base.css` clips in
`@layer zero.structure`, so no recipe can put the box back and a design
system has nothing to write. It is a presentation request, not a flag: the
anatomy declares which parts offer it (`visuallyHidden: true`), and
`expectAnatomy` fails the attribute anywhere else. For content that is not
a part — an icon button's text — `VisuallyHidden` (`@sigx/zero/visually-hidden`,
`asChild` supported) renders the same attribute; it is deliberately not a
scope, since there is nothing in it to style.

```tsx
<Field.Root>
    <Field.Label visuallyHidden>Search the docs</Field.Label>
    <Input.Root>…</Input.Root>
</Field.Root>

<button><Icon name="close" /><VisuallyHidden>Close</VisuallyHidden></button>
```

**Field + Switch share one accessible name — give it once.** Inside a
Field, `Field.Label` (`for` the input) and `Switch.Root` (a `<label>`
wrapping it) are both labels of the same input, and a control's accessible
name concatenates every label it has. So name it in exactly one place:
either `Field.Label` and a `Switch.Root` with no children of its own, or the
Switch's own text and no `Field.Label`. When a row elsewhere carries the
visible text, keep the Switch's text as the name with `hideLabel`. The same
holds for Checkbox.

```tsx
<Field.Root>
    <Field.Label>Dark mode</Field.Label>
    <Switch.Root />               {/* name: "Dark mode" */}
</Field.Root>

<Switch.Root hideLabel>Airplane mode</Switch.Root>
```

**Table columns.** `Table.Root` takes a column spec (`columns`: per column
an optional `label`, `width`, `align` and `key`). `<Table.Head />` with no
children renders the header row from the labels. Head also renders the
widths as a `<colgroup>` of `column` parts: each `<col>` carries
`--table-column-width`, and a `zero.structure` rule applies it. It's a custom
property, never a `width` literal, so a responsive rule can take it back. A
`Table.Cell` or `Table.HeaderCell` that names its column (`column={2}` or
`column="age"`) takes the alignment as `--table-cell-align`, which every
skin's cell recipe reads. A header cell with no children renders its
column's label. Naming a column the spec doesn't have throws.

```tsx
<Table.Root columns={[{ label: 'Time', width: '8rem' }, { label: 'What' }, { key: 'cost', label: 'Cost', align: 'end' }]}>
    <Table.Caption>Activity</Table.Caption>
    <Table.Head />
    <Table.Body>
        <Table.Row>
            <Table.Cell column={0}>09:12</Table.Cell>
            <Table.Cell column={1}>Deployed</Table.Cell>
            <Table.Cell column="cost">$0.42</Table.Cell>
        </Table.Row>
    </Table.Body>
</Table.Root>
```

**Text controls.** `Input.Input` and `Textarea.Textarea` are what an app
builds a composer, a search box or an autocomplete on, so they forward the
native `onKeydown`/`onKeyup`, `onBeforeinput`/`onInput`,
`onCompositionstart`/`onCompositionend` and `onFocus`/`onBlur` to the element
(`WithTextControlEvents`) — `preventDefault()` works there, and `onInput`
runs after the model has the new value. They also forward `aria-*`,
`data-*`, `title` and `role` (a combobox-style composer's ARIA), but not
`id` or `aria-invalid`, which belong to the form contract; an app
`aria-describedby` joins the Field's. Their `ref` receives a handle —
`{ element, focus() }` — for what only the element can do: the caret, the
selection, measuring.

```tsx
let composer: TextareaHandle | null = null;
<Textarea.Textarea
    role="combobox" aria-expanded={open()} aria-controls="mentions"
    onKeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
    ref={(h) => { composer = h; }}
/>
composer?.element?.setSelectionRange(caret, caret);
```

`css/base.css` also declares `--print-ink`, the ink a print fallback draws
with. Paper is not theme-aware — `print-color-adjust: economy` drops background
paint, so a mark drawn as a background comes back as a glyph, and every
theme-carried candidate for that glyph's ink is white on one side or the other
(`--color-base-content` and `CanvasText` under a dark theme, an on-accent ink
under a light one, over a fill that did not print). A design system may
override it; it never has to declare it.

**Where your app's CSS goes.** `css/base.css` declares the cascade order
`zero.fallback, zero.tokens, zero.recipes, zero.structure`, and every design
system's `tokens.css` restates it. Everything zero and a design system emit
sits in those layers, so your page CSS beats all of it in either of two
ways:

- **Unlayered**, the simplest option. Unlayered CSS outranks every layer
  whatever its specificity or load order.
- **In a layer of your own, ordered after zero's.** Put the order statement
  first in your entry stylesheet, before any import:

  ```css
  @layer zero, app;          /* zero's sublayers nest under `zero` */
  @layer app { .page { … } }
  ```

  A layer's position is fixed by its first mention. If the statement is
  missing and your stylesheet loads before `base.css`, `app` is created
  first and ranks below every `zero.*` layer. Your unlayered overrides
  still beat `app`.

`base.css` deliberately does not name an app layer. It would not remove the
load-order dependency described above, and the layer's name belongs to you.

## Patterns

Compositions the pieces above are designed to express — no component grows a
prop for what a composition already says. (Loading used to be one; it is a
state since #50, because `aria-busy` and a press that does nothing are
behaviour a composition could not say.)

**The loading button.** `loading` is Button's one state — work in flight:

```tsx
<Button.Root loading={saving()} onClick={save}>Save</Button.Root>
```

It renders `data-state="loading"`, `aria-busy="true"` and
`aria-disabled="true"`, blocks activation (no `onClick`, no form submission,
no press feedback) and renders a `spinner` part — an empty, `aria-hidden`
span before the label — that every shipped design system draws. It does
**not** set the native `disabled`: that would drop focus from the button the
user just pressed. The label stays; it is what the reader is waiting on.
Styling hooks are the part and the state (`parts.spinner`,
`states.loading`), so an app extending a design system sizes the spinner by
name rather than through a skin's pseudo-element. An `asChild` element gets
the state and the ARIA but no spinner, since its children are the caller's.
Announce long operations with your own live region when a label change
alone won't be heard.

**The link button.** A link that looks like a button is `asChild` over an
`<a>`. It is a real link, with middle-click, "copy link" and the right role,
and it wears the button's anatomy and recipe:

```tsx
<Button.Root asChild variant="outline">
    {(p) => <a href="/docs" {...p}>Docs</a>}
</Button.Root>
```

A design system's recipes live in `@layer zero.recipes`, and any unlayered
rule beats any layered one, whatever the specificity. So an app stylesheet
with a plain `a { color: … }` repaints every link button. That is the
layering promise (app CSS always wins) working as designed, which is why zero
does not ship an unlayered override of its own. Hand the colour back with one
unlayered rule in the app:

```css
a[data-scope="button"][data-part="root"] { color: revert-layer; text-decoration: revert-layer; }
```

`revert-layer` rolls the property back to the layered cascade, the button
recipe included. Every shipped button recipe sets `text-decoration: none`, so
the underline reverts to none rather than the browser's link default.

## Responsive: breakpoints and `useMediaQuery`

The design system owns the breakpoint ramp. JS reads it through the theme
registry, which its `installThemes()` seeds; CSS reads it through the
compiled stylesheet — no app restates a pixel.

```tsx
import { useMediaQuery, getBreakpoints } from '@sigx/zero';

const Shell = component(() => {
    // `initial` is what the server and the first client render read — pick
    // the layout the server should emit. The real match arrives on mount.
    const wide = useMediaQuery({ above: 'md' }, { initial: true });
    return () => <Drawer.Root modal={!wide.value}>…</Drawer.Root>;
});

useMediaQuery({ below: 'lg' });                  // (width < <lg>)
useMediaQuery({ above: 'sm', below: 'lg' });     // the band between
useMediaQuery('(prefers-reduced-motion: reduce)');
getBreakpoints();                                // { sm: '640px', md: '768px', lg: '1024px' }
```

- **SSR-safe.** Never reads `matchMedia` before mount, so server markup and
  hydration agree; where `matchMedia` does not exist it stays `initial`.
- **Context-bound.** Call it from a component's setup (it throws elsewhere);
  each call owns its subscription and detaches on unmount.
- **The compiler's boundaries.** `above: 'md'` is exactly the
  `(min-width: …)` a recipe's `at: { md }` compiles to; `below: 'md'` is its
  complement `(width < …)` — no `767.98px`, no width that matches both. An
  undeclared name throws (and is a type error under a `/register` import).
  `breakpointQuery(range)` returns the query string for a `<source media>`
  or your own `matchMedia`.
- **From CSS**, the design system's `:root` declares `--breakpoint-<name>`
  (for `calc()` and `getComputedStyle` — not usable inside `@media`), and
  `@sigx/<ds>/css/breakpoints` defines `@custom-media --above-<name>` /
  `--below-<name>` for a build step that resolves custom media
  (postcss-custom-media, Lightning CSS): `@media (--below-md) { … }`.

On a non-DOM platform `getBreakpoints()` (from `@sigx/zero/theme/registry`)
is the same ramp; `useMediaQuery` is web-only.

## Long lists: `createVirtualList`

A windowing behavior for a chat transcript, a log or any list too long to
keep in the document. It decides which rows to render; you render them. The
rows that are not rendered become the list's block padding.

```tsx
import { createVirtualList } from '@sigx/zero';

const Transcript = component(({ props }) => {
    const v = createVirtualList({
        count: () => props.messages.length,
        key: (i) => props.messages[i]!.id,
        estimateSize: 72,             // px, until a row has been measured
        stickToBottom: true,          // follow the tail until the reader scrolls up
    });
    return () => (
        <section>
            <div ref={v.viewportRef} role="log" aria-label="Transcript" tabIndex={0} style="overflow-y: auto; height: 30rem">
                <ol ref={v.listRef} style={`padding-block: ${v.before()}px ${v.after()}px`}>
                    {v.rows().map((row) => (
                        <li key={row.key} ref={v.measureRef(row.key)}>{/* props.messages[row.index] */}</li>
                    ))}
                </ol>
            </div>
            {!v.following() && <button onClick={() => v.scrollToEnd()}>Jump to latest</button>}
        </section>
    );
});
```

- **Keyed rows with measured heights.** Each rendered row is measured in the
  same task it renders in, then watched by one `ResizeObserver` for later
  changes such as streamed text or a late image. A height is remembered by
  key, so it survives the row leaving the window. Rows not yet measured
  count `estimateSize`.
- **Anchor-preserving.** The row at the top of the viewport stays still when
  rows are prepended above it, or when a row above it measures taller or
  shorter than its estimate. The browser's own scroll anchoring is turned
  off on the viewport, because two correctors would fight.
- **Stick to bottom.** With `stickToBottom`, appends and a growing last row
  keep the end in view. This continues until the reader scrolls up.
  Scrolling back to the end (within `threshold`, 24px by default) or calling
  `scrollToEnd()` resumes it. Only an upward scroll lets go, so content
  arriving faster than scroll events can't be mistaken for the reader
  leaving.
- **`scrollToIndex(i, align)`** jumps to a row that may never have been
  measured, and keeps it in place while the rows around it measure.
- **Layout rules.** Rows stack vertically and have no margins. Pass the
  list's CSS `gap` as `gap`. If anything scrolls with the list above it
  (such as a "load earlier" button), wire `listRef`.
- **SSR-safe and context-bound.** Call it from the setup of the component
  that renders the rows. Before mount it renders the first `initialCount`
  rows (the last ones under `stickToBottom`), so the server and the first
  client render agree.
- **Semantics are yours.** A log wants `role="log"`. A `listbox` or `feed`
  wants `aria-setsize={v.count()}` and `aria-posinset={row.index + 1}` on
  each row, because only a window is in the accessibility tree.

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
  scope cannot invent synonyms either. Work in flight (a job, tool call or
  deploy) has its own family, lifecycle: `running|paused|denied|cancelled`,
  alongside `loading` for the wait before it starts and `complete|error`
  for the outcome. `FRAGMENT_VERSION` is the version a
  fragment declares — here so a package's `./fragment` entry can read it at
  runtime without the kit, which is only its devDependency.
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
  `createListboxItem` (the `role="option"` bag), `createGroupPresence`,
  `syncPopover`, `useMediaQuery`, and `createVirtualList` for windowing.
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
