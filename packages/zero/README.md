# @sigx/zero

Unstyled, accessible component primitives for [SignalX](https://sigx.dev).
Components render a stable, machine-readable anatomy — `data-scope`,
`data-part`, `data-state` — and no styling; a design system is a separate CSS
artifact compiled by [`@sigx/zero-kit`](https://npmjs.com/package/@sigx/zero-kit)
(start with `@sigx/zero-basic` or `@sigx/zero-daisyui`).

```bash
npm install @sigx/zero sigx
```

Coming from 0.2.0-beta.1? The
[upgrade guide](https://github.com/signalxjs/zero/blob/main/docs/upgrading.md)
has a before/after for every breaking change.

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

Button · Tabs · Collapsible · Accordion · Dialog · Popover · Tooltip · HoverCard · Menu ·
Select · Switch · Checkbox · CheckboxGroup · RadioGroup · Slider · Progress ·
Field · Fieldset · Avatar · Toast · Combobox · Toggle · ToggleGroup · NumberInput ·
RatingGroup · TreeView · Input · Textarea · Card · Alert · EmptyState · Badge · Divider ·
Skeleton · Spinner · Kbd · Status · Indicator · Stats · Timeline · Chat · RadialProgress · Join ·
Navbar · NavList · Breadcrumbs · Pagination · Steps · Drawer · Table · FileUpload · Carousel · Swap · Countdown · Diff
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

**One roving tab stop, whatever the model says.** Tabs, ToggleGroup, Steps
and TreeView keep exactly one item in the tab order: the selected item while
it is rendered and enabled, else the first enabled item. Once the group has
mounted, a value that names nothing (a typo, a removed item) or only
disabled items never leaves it unreachable by keyboard. Server-rendered HTML
is the one gap: until hydration, a value that names nothing yields no stop,
because an unregistered value may still name an item that renders later.
Horizontal arrow keys follow the reading direction: under `dir="rtl"`
ArrowRight moves to the item on the visual right, which is the previous one
in DOM order.

**A disabled TreeView node still navigates.** A pointer can focus a disabled
node, and from there the arrow keys, Home/End and typeahead move to its
enabled neighbours (ArrowLeft on an open disabled branch climbs to the
parent), while selecting (Enter/Space) and expanding or collapsing it stay
blocked. The same holds for a disabled `asChild` Steps item: its arrows and
Home/End rove to the enabled steps beside it, and it never activates.

**TreeView: pointer, `*` and loading branches.** A click on a branch row
selects the branch, as Enter does, and — while `TreeView.Root`'s
`expandOnClick` is on (the default) — toggles it too. With
`expandOnClick={false}` the row only selects, and a click on the
`BranchIndicator` only toggles. `*` expands every enabled branch at the
focused node's level, the focused node included, as APG's reference tree does
(one `expandedValuesChange`). A `TreeView.Branch` marked
`loading` (its children are being fetched) is `aria-busy="true"`; its
`branch-indicator` reads `data-state="loading"`, and so does its
`branch-content` while open — closed content stays `closed` and `hidden`.

**TreeView: `multiple`.** `TreeView.Root multiple` makes the model a
`string[]` (`defaultValue` / `valueChange` follow; single mode keeps its
`string`, `''` when none) and the tree `aria-multiselectable="true"`; each
selected node carries the same `data-selected` flag as in single mode, so a
recipe needs nothing new. The keys are APG's recommended multi-select tree:
Space toggles the focused node; Shift+ArrowDown/Up move focus and select from
the anchor to it; Shift+Space selects the anchor→focused range;
Ctrl/Cmd+Shift+Home/End extend it to the first/last visible node; Ctrl/Cmd+A
adds every visible enabled node (a selection collapsed out of sight stays).
Enter keeps its activation — it selects the focused node alone. A plain click
replaces the selection, Ctrl/Cmd+click toggles, Shift+click selects the range;
a modified click on a branch row never folds it. The anchor is the node last
selected alone or toggled, ranges run over the VISIBLE nodes in DOM order and
replace the selection, and a range whose anchor has since been collapsed away
selects its far end alone. No gesture puts a disabled node in the
selection, though a model that names one still renders it selected: disabled
blocks interaction, not state, as in single mode. The tab stop is the first
selected visible node. Because `''` is single mode's "nothing selected", an
item or branch valued `''` throws there (as a ToggleGroup item does); under
`multiple` it is an ordinary value.

**TreeView: checkable.** Bind `model:checkedValues` (a `string[]` of checked
LEAF values; `defaultCheckedValues` / `checkedValuesChange` follow), or set
`checkable`, and every treeitem carries `aria-checked`. A branch's state is
derived, never stored: `true` when every enabled descendant leaf is checked,
`mixed` when some are, `false` otherwise — the rule `Checkbox.Root parent`
uses, now shared as `triState` / `toggleTriState` in `@sigx/zero/behaviors`
(and `createTreeController`'s new `leavesOf(value)` lists a branch's leaves).
A branch whose every leaf is disabled shows what they hold and cannot be
toggled. Space toggles the focused node's check (on a branch: every enabled
leaf beneath it, all or none; a disabled leaf keeps its value); Enter keeps
the selection, and under `multiple` Shift+Space keeps its range.
`TreeView.NodeCheckbox` — part `node-checkbox`, an `aria-hidden` span with
`data-state="checked|unchecked|indeterminate"` and `data-disabled` when
nothing can toggle it (the tree, the node, or a branch whose every leaf is
disabled) — is the paint hook: put it in an `Item` or a `BranchTrigger` row; a click on it
toggles the check and changes neither selection nor expansion. The selection
stays in use under `multiple`, a bound `model` or a `defaultValue`; without
any of them a checkable tree renders no `aria-selected`, and a click on (or
Enter at) a leaf row toggles its check — the row is the box's label. The
leaves a branch derives from are the ones REGISTERED, so a lazily loaded
branch with no children yet reads unchecked and toggles nothing, and a
server render shows branches unchecked until the tree mounts.

**The form contract.** Every posting control takes the same five props
(`name`, `form`, `disabled`, `invalid`, `required` — `WithFormControl`, plus
`readonly` on every value control — see below) and answers to a `Field.Root` for all
of them — and to an enclosing `Fieldset.Root` for `disabled`, `readonly`
and `invalid` (#285). A control posts only while it carries a `name`; a disabled control
never posts; `form="id"` associates it from outside the form's subtree; and
the owning form's `reset()` restores the component default into the model
and the DOM. Select, Combobox and ToggleGroup post through a real,
visually-hidden `<select>` — one field in single mode, a repeated field per
value under `multiple` — so `required` is a platform constraint (the invalid
focus lands on the trigger / input / the group's tab stop) rather than an
`aria-required` hint. RatingGroup posts through a visually-hidden text
`<input>` for the same reason (a `type="hidden"` input is barred from
constraint validation): a required rating left at 0 fails
`checkValidity()`, the invalid focus lands on its tab stop, and the
radiogroup carries `aria-required`. The runtime
half is `createFormControl` + `onFormReset` (`@sigx/zero/behaviors`), the
one `VISUALLY_HIDDEN_STYLE` beside them; a component of your own that renders
a non-native control reads an enclosing Fieldset's flags from
`createFormControl` for free, or directly through `useFieldsetContext()`.

**FileUpload checks its files, and reports what it refused (#273).**
`FileUpload.Root` takes `maxFiles`, `minFileSize` and `maxFileSize`
(bytes) and `validate(file) => code | code[] | null`, beside `accept`. Both
paths — the picker and a drop — check every candidate: `'invalid-type'`,
`'too-large'`, `'too-small'`, any string `validate` returns, and
`'too-many'` for an otherwise-valid file past `maxFiles` (single mode has
room for one). Accepted files join the model; the rest arrive once per
selection through the `filesReject` event as `{ file, errors }[]` (an
event, not a model: a refusal is news, not state), and the input's own
FileList is re-synced so a refused file never posts. Render a refused
file through `<FileUpload.Item file={f} invalid>` for `data-invalid`.
`FileUpload.ClearTrigger` empties the model and hands focus to the
trigger; it renders nothing while there is nothing to clear, and its name
defaults to "Clear files". `ItemRemove` hands focus to the next file's
remove button, else the previous one, else the trigger. A `required`
upload left empty cancels the platform's bubble (it would point at a 1px
input), focuses the trigger and reads invalid until the files change.
`directory` sets `webkitdirectory`; `capture` (`'user' | 'environment'`)
reaches the input.

```tsx
<FileUpload.Root name="docs" multiple accept="image/*,.pdf" maxFiles={3} maxFileSize={5_000_000}
    onFilesReject={(rejected) => { state.rejected = rejected; }}>
    <FileUpload.Trigger>Add files…</FileUpload.Trigger>
    <FileUpload.ClearTrigger>Clear</FileUpload.ClearTrigger>
    …
</FileUpload.Root>
```

**Native constraints and keyboard hints are typed props.** `Input.Root`
takes `minlength`, `pattern`, `inputmode`, `enterkeyhint`, `spellcheck`,
`autocapitalize`, `autocorrect` (`'on' | 'off'`) and `autofocus`
beside `autocomplete` / `maxlength`; `Textarea.Root` takes `minlength`,
`wrap` (`'soft' | 'hard'`), `spellcheck`, `autocapitalize`,
`enterkeyhint` and `autofocus`. They render on the `<input>` /
`<textarea>`, so the platform's own constraint validation runs
(`checkValidity()` honours `pattern`), and a misspelt `inputmode` is a
compile error (`InputMode`, `EnterKeyHint` and `Autocapitalize` are
exported). `spellcheck` is a boolean that renders the enumerated
`"true"` / `"false"` token; unset leaves the browser's default. There is
no native `size` (the character width): `size` on a Root is the design
system's size axis (`data-size`), so width belongs to the recipe.

```tsx
<Input.Root name="code" pattern="[0-9]{6}" inputmode="numeric" enterkeyhint="done"
    autocomplete="one-time-code" autocorrect="off" spellcheck={false}>
    <Input.Control><Input.Input /></Input.Control>
</Input.Root>
```

**Input's control holds three affordances (#281).** `Input.Adornment`
(part `adornment`, `placement="start" | "end"` → `data-placement`) puts
consumer content — an icon, a unit, a prefix — at a logical edge of the
control; a press on it that lands on nothing interactive focuses the input
and keeps its caret. `aria-hidden` is not forced: whether it speaks is the
app's call. `Input.ClearTrigger` (part `clear-trigger`) empties the value
the way typing would — the model writes, `valueChange` fires, and an
`input` event reaches the app's own listeners — then focuses the input. It
is out of the tab order (`tabindex="-1"`), points at the input through
`aria-controls`, renders nothing while the field is empty — what the
field shows, so text a `lazy` or `debounce` model has not taken yet
counts — is disabled with the field and while it is readonly, and its
name defaults to "Clear".
In a `type="search"` field Escape does the same while there is something
to clear, and cancels the key so an enclosing dialog or popover stays
open; an empty field lets Escape through. `Input.VisibilityTrigger` (part
`visibility-trigger`, states `on|off`) toggles `model:visible` on the Root
(`defaultVisible`, `visibleChange`); while it is on, a `type="password"`
input renders `type="text"`. It is a toggle button: `aria-pressed`, one
constant name ("Show password"), `aria-controls` the input. Both triggers
take `label`, and render a default glyph when given no children; the
visibility trigger's slot receives `{ visible }` to swap an icon. Every
skin lays them out in the control's row with `order` and logical padding,
so they flip with the reading direction.

```tsx
<Input.Root type="password" model={() => state.password} model:visible={() => state.shown}>
    <Input.Label>Password</Input.Label>
    <Input.Control>
        <Input.Adornment placement="start"><LockIcon /></Input.Adornment>
        <Input.Input />
        <Input.ClearTrigger />
        <Input.VisibilityTrigger />
    </Input.Control>
</Input.Root>
```

**Readonly reaches every value control, not only text (#267).** Input,
Textarea, NumberInput, Combobox, RatingGroup — and Checkbox, Switch,
RadioGroup, Select and Slider — take `readonly` (`WithReadonly`), the prop OR
the Field's, so `<Field.Root readonly>` means the same thing whatever it
wraps. A readonly control stays focusable and renders `data-readonly` on its
root and the parts a design system paints (checkbox/switch `control`,
radio-group `item`/`item-control`, select `trigger`, slider `control`/
`track`/`thumb`), but refuses every user write while an app's model write
still lands: Checkbox and Switch cancel the native click (a native checkbox
ignores `readonly`), so no press, label click or Space toggles them;
RadioGroup cancels the radios' activation, so the platform's arrow-key
roving still moves focus but chooses nothing; Select does not open, and no
key — typeahead included — changes it; Slider neither steps on a key nor
moves on a press or drag, the native range's own input put back. ARIA
follows each role: `aria-readonly` on the checkbox input, the radiogroup,
the select's `combobox` trigger and every `slider` (thumb or native range);
the `switch` role does not support it, so a readonly Switch says so through
`data-readonly` alone. As on a native readonly control, a readonly
`required` control never blocks the submit — its value is not the user's
to fix. RadioGroup also restates `invalid` on each `item` and
`item-control` (Checkbox and Switch parity), and writes
`aria-orientation` on the radiogroup.

**CheckboxGroup: one `string[]` model for a set of boxes, and a derived
parent box (#282).** `CheckboxGroup.Root` renders a `role="group"` named by
its `CheckboxGroup.Label` (referenced only while it is rendered) and hands
one model to the `Checkbox.Root`s inside it. A boxed child needs a `value`:
it is checked while the group's model includes that value, and toggling it
writes the group model — its own model is not needed. Every child posts
under the group's `name`/`form`; the group's `disabled`, `invalid` and
`readonly` (the prop OR an enclosing Field's) reach every box, ORed with the
box's own; its `size` sizes every box that sets none. `required` means "at
least one": the boxes carry the native `required` only while none is
checked, so the platform blocks the submit on the first box and lets go as
soon as one is. Inside a `Field.Root` the group ROOT is what the Field
labels and describes (its label joins the root's `aria-labelledby`, its
description and error the root's `aria-describedby`); the boxes keep ids of
their own, so no two inputs claim the field's control id. `orientation`
renders `data-orientation` (default `vertical`) for the skins' row layout.

`Checkbox.Root parent` is the tri-state "select all" box. Its state derives
from the group's `allValues` — by default, every child box's value —
`checked` when all are selected, `unchecked` when none, `indeterminate`
when some; toggling it selects all or none of them (values outside
`allValues` stay where they are). Its input names the child inputs in
`aria-controls` and posts nothing unless given a `name` of its own.

```tsx
<CheckboxGroup.Root model={() => state.toppings} name="toppings" allValues={['ham', 'olives', 'basil']}>
    <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
    <Checkbox.Root parent>All toppings</Checkbox.Root>
    <Checkbox.Root value="ham">Ham</Checkbox.Root>
    <Checkbox.Root value="olives">Olives</Checkbox.Root>
    <Checkbox.Root value="basil">Basil</Checkbox.Root>
</CheckboxGroup.Root>
```

An indeterminate `Checkbox.Root` now stays indeterminate after a click
while its `indeterminate` prop is still true: the platform clears the
native property on activation, and the box writes it back after every
change, so `data-state` and the input assistive tech reads never disagree.

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

**A Field validates through the platform (#284).** Every control inside a
`Field.Root` reports the element constraint validation runs on — Input's
and Textarea's own, NumberInput's text input, Checkbox's and Switch's hidden
checkbox, the first radio of a RadioGroup, FileUpload's file input, the
hidden `<select>` a named Select or Combobox posts through (an unnamed one
has none, so only `validate` runs), a Slider's native range. The Field
listens for that element's `invalid` event (a submit, `reportValidity()`,
`checkValidity()`), snapshots its `ValidityState`, and every control's
`data-invalid`/`aria-invalid` reads `invalid || (validated && !valid)`.

- `validate(value, validity)` — synchronous, over the control's model value
  (a string, a boolean, a number, the selected key(s), `File[]`) and a copy
  of its native validity taken with no custom message set. A message (or
  an array) goes through `setCustomValidity`, so a native submit blocks on
  it; it is kept current on every change, whatever `validateOn` says. Async
  and schema orchestration stay the app's — set `invalid` from them.
- `validateOn` — when the Field SHOWS its validity: `'submit'` (default,
  the first failed submit), `'blur'` (focus leaving the Field) or
  `'change'`. After a failed submit every change revalidates, and so does
  any change while an error shows, so fixing the value clears it.
- `Field.Error match` — a `ValidityState` key (`valueMissing`, `tooShort`,
  `patternMismatch`, `typeMismatch`, …), `'custom'` for a `validate`
  message, or `true`. With a key it renders only while that key is set,
  under an id of its own (`<error id>-<key>`), and the control's
  `aria-describedby` follows it; without `match` (or with `true`) it renders
  as before. With no children it renders the message: the platform's for a
  key, `validate`'s for `custom`, all of them otherwise.
- A Field that renders a `Field.Error` cancels the `invalid` event, so the
  platform's bubble does not repeat the message, and focuses the FIRST
  invalid control of the form itself (the trigger, for a Select). Without
  one, the platform's bubble and focus stand.
- A form `reset` forgets what was shown.

```tsx
<form>
    <Field.Root validate={(v) => (v === 'admin' ? 'That username is reserved.' : null)}>
        <Field.Label>Username</Field.Label>
        <Input.Root name="user" required pattern="[a-z]{3,}">…</Input.Root>
        <Field.Error match="valueMissing">Choose a username.</Field.Error>
        <Field.Error match="patternMismatch">Three or more lowercase letters.</Field.Error>
        <Field.Error match="custom" />
    </Field.Root>
</form>
```

**A Fieldset groups controls and says their flags once (#285).**
`Fieldset.Root` renders a native `<fieldset>` and `Fieldset.Legend` the
native `<legend>` — render it as the Root's first child: the platform names
the group from it (`role="group"`, no `aria-labelledby` of zero's own).
`disabled` sets the native attribute, which disables every native control
inside; the controls zero draws itself (a Slider thumb, a RadioGroup item,
a RatingGroup star, a Select trigger's `data-disabled`) read the Fieldset's
context through `createFormControl` / `Field.Root`, so they render
`data-disabled` / `aria-disabled`, refuse input and never post either.
`readonly` and `invalid` have no native fieldset spelling and travel by the
context alone. A control's effective flag is its own OR its Field's OR any
enclosing fieldset's — nested fieldsets chain — and a `Field.Root` inside
takes them too, so its Label dims with the group. Controls inside the Legend
answer to the fieldsets *outside* it, as the platform exempts a legend's
controls from its fieldset's `disabled`: that is where the "enable this
section" checkbox goes. The root carries `data-disabled` / `data-readonly`
/ `data-invalid`, the legend `data-disabled` / `data-invalid`; the six
skins reset the UA frame (brutalist keeps it as an inked box) and undo its
`min-inline-size: min-content`.

```tsx
<Fieldset.Root disabled={!state.shipElsewhere}>
    <Fieldset.Legend>
        <Checkbox.Root model={() => state.shipElsewhere}>Ship to a different address</Checkbox.Root>
    </Fieldset.Legend>
    <Field.Root>
        <Field.Label>Street</Field.Label>
        <Input.Root name="street">…</Input.Root>
    </Field.Root>
    <Slider.Root name="priority" defaultValue={[2]}>…</Slider.Root>
</Fieldset.Root>
```

`tooShort` and `tooLong` are raised by the platform only for a value the
user last edited, and sigx's value binding writes the model back into the
element on every keystroke, which a browser counts as a script's change —
so in a real engine they do not report today. Spell a length rule with
`pattern` or `validate` until the binding skips an unchanged value.
Native-platform first: `<dialog>` +
top layer (no Portal), the `popover` attribute, `<details>`, real form
inputs. SSR-safe ids via `app.use(zeroPlugin())` per request. Collapsible
and Accordion keep their model in step with the `<details>` they render: when
the browser opens one itself (find-in-page, a `#fragment` link into a closed
section), the native `toggle` event writes the model — an Accordion in single
mode then closes the others, as a click would — and a change the model
refuses (a disabled root or item) is put back on the element.

**Accordion keyboard and regions** (#276). Accordion follows the APG
accordion pattern: ArrowDown/ArrowUp move focus between the enabled triggers
(ArrowRight/ArrowLeft under `orientation="horizontal"`, flipped in RTL),
wrapping unless `loop={false}`, and Home/End jump to the first/last. Arrival
opens nothing, and there is no roving tabindex — every trigger stays in the
Tab sequence. `data-orientation` rides the root and every trigger. Each
panel is `role="region"` labelled by its trigger (`aria-labelledby`); pass
`regions={false}` when many panels can be open at once — APG warns that more
than about six region landmarks become noise. A Collapsible panel is
labelled by its trigger too, with no role. Both triggers therefore own their
`id` (it is not a prop).

**Disclosure closes can animate** (#276). Removing `open` hides a
`<details>` at once in every engine, so no stylesheet can animate the close.
Collapsible and Accordion panels publish their measured content size as
`--collapsible-panel-height`/`--collapsible-panel-width` and
`--accordion-panel-height`/`--accordion-panel-width` (px, from
`scrollHeight`/`scrollWidth`, kept fresh while open and re-measured as a
close starts). On close, `data-state` flips to `closed` immediately while
the element stays `open` until the panel's own animations have finished,
and only then does it shut — so a recipe animates the panel's `closed`
state from `var(--accordion-panel-height)` to `0`. No animation (none
declared, `prefers-reduced-motion: reduce`) closes at once; reopening
mid-exit cancels it; find-in-page and fragment navigation still sync the
model as above. Five of the six bundled skins animate it; brutalist cuts.

**A Tabs indicator can slide** (#283). `Tabs.Indicator` is an optional,
`aria-hidden` span placed inside `Tabs.List`. It publishes the active tab's
box as `--tabs-indicator-inset-inline-start`,
`--tabs-indicator-inset-block-start`, `--tabs-indicator-inline-size` and
`--tabs-indicator-block-size` (px), relative to the list's padding box in its
scrolled content. The inline offset is measured from the list's inline-start
edge, so a recipe that positions the indicator `absolute` inside a
`relative` list with `inset-inline-start` lands on the tab in both writing
directions. The box is re-measured when the value changes and whenever the
list or a tab resizes; a scale or translate on the tab (a press effect) is
undone first. Until the first measurement, and while no tab is active, the
indicator is `display: none`, so a transition on those properties never
plays on first paint. basic, material and carbon slide their underline with
it and hand the active tab's own underline over to it; daisyui, brutalist
and heroui keep their static active style and render it `display: none`.

```tsx
<Tabs.Root defaultValue="a" lazyMount>
    <Tabs.List aria-label="Account">
        <Tabs.Tab value="a">Profile</Tabs.Tab>
        <Tabs.Tab value="b">Billing</Tabs.Tab>
        <Tabs.Indicator />
    </Tabs.List>
    <Tabs.Panel value="a">…</Tabs.Panel>
    <Tabs.Panel value="b">…</Tabs.Panel>
</Tabs.Root>
```

**Tabs panels can render lazily** (#283). With `lazyMount` on `Tabs.Root`, a
panel renders its content only once its tab has been active, and keeps it
afterwards. With `unmountOnExit`, a panel renders its content only while its
tab is active, so state inside it resets when the user leaves; together the
two behave like `unmountOnExit`. Either way the panel element itself always
renders (empty and `hidden`), so every tab's `aria-controls` resolves.

**Popup exits play in every engine** (#17). A design system animates a
popup's exit in CSS off `data-state="closed"`, and on Chromium CSS `overlay`
keeps the element in the top layer while it plays. Firefox and WebKit have
no `overlay`, so there Dialog, Drawer, Popover, Menu, Tooltip, HoverCard,
Select and Combobox hold the native `close()` / `hidePopover()` back until the popup's
own exit transition or animation has finished — never longer than its
computed length, so a stalled one cannot leave a popup stuck open. For
that span the popup is still shown natively (a modal dialog stays modal),
and reopening it cancels the pending close. A close the platform makes by
itself — `popover="auto"` light dismiss, a `<form method="dialog">` submit —
has already happened when zero hears of it, and stays instant there.

The peer-parity surfaces ship too: Menu has stateful items
(`Menu.CheckboxItem`, `Menu.RadioGroup`/`Menu.RadioItem` — APG
menuitemcheckbox/menuitemradio; toggling keeps the menu open unless the item
sets `closeOnSelect`), and its submenus predict the pointer: a mouse
heading diagonally for an open submenu does not hand hover to the sibling
items it crosses while it stays inside the safe triangle between where it
left the sub-trigger and the submenu's near edge — `closeDelay` still closes
the submenu if the pointer stops short. On the keyboard, ArrowDown on a
closed `Menu.Trigger` opens on the first enabled item and ArrowUp on the
last, Enter on an `asChild` `<a href>` item keeps its default, so the
link navigates as well as selecting, and Tab or Shift+Tab from any item
closes the whole chain (root and every open submenu) while the browser
moves focus on to the next or previous tab stop — it is not pulled back to
the trigger; focus leaving the menu any other way (a pointer, assistive
technology) closes it too. `loop` on `Menu.Root` (default `true`) decides
whether ArrowDown/ArrowUp wrap at the ends, at every level; Dialog has an alert-dialog preset
(`role="alertdialog"`: no backdrop dismiss, initial focus on the
least-destructive `Dialog.Cancel`), and every Dialog/Drawer close reports
why on a `close` event that follows `openChange(false)` — `{ reason, value }`
with `reason` one of `close` · `cancel` · `escape` · `backdrop` ·
`programmatic` (Drawer has no `cancel`) and `value` from the closing
`Dialog.Close value="…"`, the `<form method="dialog">` + `returnValue` pair
in model form, so a confirm dialog needs no flag beside its model; a modal
Dialog or Drawer dismisses on the backdrop only when the press both starts
and ends outside its box, so dragging a text selection out over the backdrop
never closes it, and `dismissible={false}` holds however often Escape is
pressed (zero prevents the Escape keydown itself, because browsers let a page
cancel only the first close request made without a fresh user activation);
Slider's `model` accepts `number[]` for a
composed multi-thumb range (`Slider.Track`/`Range`/`Thumb`, thumbs clamp at
their neighbors, `marks` renders ticks) while a scalar model keeps the native
`<input type=range>`, and `orientation="vertical"` turns either projection
bottom-to-top (`data-orientation` on the root and every positioned part,
`aria-orientation` on the thumbs and the control, pointer mapped through
`clientY`, Up/Right increase with no RTL mirroring, the native control
spelled `writing-mode: vertical-lr; direction: rtl`); Select and Combobox group options
(`Group`/`GroupLabel`, the optgroup equivalent).

**Range stepping shares one vocabulary** (#272). Slider, NumberInput and
Diff's handle all move by `step` on the arrows and by `largeStep` on
PageUp/PageDown and Shift+Arrow (default ten steps; Diff's `step` 1 and
`largeStep` 10, in percent) — a native `Slider.Control` included, whose own
PageUp is engine-defined. Slider's `minStepsBetweenThumbs` (default 0; a fraction rounds up to
whole steps) keeps neighbouring thumbs that many steps apart, and each thumb announces the gap
in its `aria-valuemin`/`aria-valuemax`; a gap its neighbours leave no room
for degrades to plain no-crossing, so the bounds never invert or leave
`[min, max]`, and they always hold the thumb's own value. Slider's `valueCommit` fires with
the model's shape once a drag is released, after each keyboard step, and on
the native control's `change` — each only when the value moved. It is an
event, not a model: there is no `model:valueCommit` to bind, and the `value`
model's own `valueChange` keeps firing on every intermediate value. A NumberInput value that sits off
the step grid (an off-grid `max`, a value written from outside) steps to the
neighbouring grid value in the direction of travel — 5 on `step={2}` goes
Up to 6 and Down to 4, where rounding to the nearest used to skip to 8.
Diff's handle speaks `getValueText(value)` as `aria-valuetext` (default
`"50%"`), and `disabled` on `Diff.Root` freezes it: `data-disabled` on the
root and handle, `aria-disabled`, out of the tab order, no keys, no drag.

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
into the same collection. An `items` that is still `undefined` on the first
render (a list still loading) may arrive later: the root turns data-driven
the moment it does — Select, Combobox and RadioGroup alike — and "nothing
selected" becomes `null` from then on (an uncontrolled model seeded `''`
still reads as empty). The types follow: `items={query.data}` typed
`T[] | undefined` picks the data overload, so the model is `T | null` (or
`V | null` with `itemValue`) with no cast. Passing `[]` while loading keeps
the model's shape fixed from the start. Combobox filters by default — a contains-match on
the label — `filter` replaces the rule and `filter={false}` shows a
server-filtered list as is; `Combobox.Empty` renders only while nothing is
visible. Under `multiple`, Combobox renders each chosen value as a tag in
the control (`Combobox.Tags` / `Tag` / `TagLabel` / `TagRemove`; the root's
`tag` slot supplies per-tag content). Backspace on an empty input removes
the last tag, and `allowCustom` commits free text on Enter. Both post through a real hidden `<select>` (every item as an
option in data mode, `multiple` under `multiple`). There is no separate
native select: the hidden `<select>` is the form control, and a native
projection would be a prop on this anatomy, never a second component.

**The Combobox input shows what the form posts.** When the list closes
(Escape, Tab, an outside press, the trigger) or focus leaves the combobox,
the typed text is resynced with the value. In single mode, text that was
never picked reverts to the chosen option's label, or to `''` when nothing
is chosen, and emptied text clears the value. Under `allowCustom` the text
is committed as the value instead, and under `multiple` the query is
dropped (the tags are the value). The keyboard follows the APG editable
combobox: Alt+ArrowDown opens without moving the highlight (it lands on
the chosen option, or nowhere), Alt+ArrowUp commits the highlight and
closes, and Escape on a closed combobox clears the text and, in single
mode, the value. That Escape calls `preventDefault` only when it cleared
something, so on an empty combobox it still reaches an enclosing dialog.
`openOnClick` (default `false`) opens the list on a pointer click in the
input as well.

**Clearing, separators and loading (#280).** `Select.ClearTrigger` is a real
button in the tab order, a *sibling* of `Select.Trigger` inside the root
(never inside it — a button cannot hold a button, and the trigger's name
must not absorb it), `aria-label` "Clear selection" (`label` overrides). It
renders only while something is selected and the select is editable, and a
click writes the empty value (`null`, `''` for hand-written items, `[]` under
`multiple`) and puts focus back on the trigger. `Combobox.ClearTrigger` sits
in the control beside the input and trigger, a pointer affordance like the
trigger (`tabIndex=-1`, `aria-label` "Clear"; Escape on the closed input is
the keyboard's clear), rendered while there is a value *or* typed text; a
click empties both and refocuses the input. `clearable` on either Root adds
one to the default composition. `Select.Separator` / `Combobox.Separator`
draw a rule between runs of options: `role="separator"`, `aria-hidden`
(ARIA's listbox owns only options and groups), and never an option — the
arrows, typeahead and a reader's option count walk straight past it.
`Combobox.Root loading` says the list is still arriving: the listbox is
`aria-busy="true"`, `Combobox.Loading` renders its content (the data
expansion renders `loadingText`), and `Combobox.Empty` holds back — an
unfinished list is not an empty one. The popup's open state is untouched.
Like `Empty`, `Loading` is `presentation` in the listbox rather than a
`status` region, which a listbox may not own.

**Trigger mode: `@mentions` over a Textarea.** `Combobox.Root trigger="@"`
(or a RegExp matched before the caret, whose first group is the query)
turns the `Textarea.Textarea` composed inside it into the combobox's
control. It can also be a single-line `Input.Input` (#106), for a chat line
or a command bar with `/`-commands. The binding is the same, and Enter goes
to the app (or submits its form) only while the list is closed. It is the same scope, so the popup, items, groups and empty
state are the ones every design system already styles. The token at the
caret — the trigger at the start of the text or after whitespace, then
non-whitespace — is the query (`model:inputValue` holds it, and `items`
are filtered by it as usual). The list opens while there is a token and
something matches (or `emptyText` says nothing does), with the first option
highlighted. While it is open the textarea is an ARIA combobox (`role`,
`aria-expanded`, `aria-activedescendant`; `aria-autocomplete` and
`aria-controls` stay on all the time), and Arrow keys, Enter, Tab and
Escape belong to it — the app's own `onKeydown` does not see them, so a
composer's Enter-to-send only sends while the list is closed. Shift+Enter
is still a line break. A commit replaces the whole token with the trigger,
the label and a space (reusing one that already follows — never two)
through the editing stack (it undoes), keeps the
caret after it and emits `insert` (`{ value, label, text }`).
`itemInsert` replaces that default text (#107). It gets
`{ item, value, key, label, prefix, query }` and returns what goes in, which
is inserted as returned: no space is added, none is stepped over, and the
caret lands after it. Use it for a mention stored as an id, no trailing
space, or an emoji for a `:` trigger. `item` is `undefined` for a
hand-written option.

```tsx
<Combobox.Root trigger="@" items={members}
    itemInsert={({ prefix, label, value }) => `${prefix}[${label}](user:${value.id})`}>
```

There is no selection: `model` is never written, and nothing posts but the
textarea. A press on the list never takes focus from the textarea. The data
expansion renders only the popup; hand-written items go in a
`Combobox.Popup` of your own beside the textarea.

Where the list opens is `anchor` (#105). Without it the popup docks to the
textarea's box, the way a chat app puts its list above the composer.
`anchor={caretAnchor}` opens it beside the typed `@` instead, on the token's
own line, however tall the composer is. `caretAnchor` (from
`@sigx/zero/behaviors`, and the barrel) measures the caret with a hidden
mirror of the textarea: the same font, padding, width and wrapping. It
re-measures only when the text or width changes, and follows the page's and
the textarea's scroll. It is passed in, so a composer that docks to the box
never ships it (about 0.6 kB brotli). Under `rtl` a placement above or
below aligns to the reading direction, as every positioned popup's does, so
the default `bottom-start` puts the list's right edge at the `@` and it
opens leftwards (`data-placement` still reads `bottom-start`). A vertical `writing-mode`
falls back to the box.
Any `(control, index) => PositionAnchor | null` works as an `anchor`; the
index is the token's first character.

```tsx
import { caretAnchor } from '@sigx/zero/behaviors';

<Combobox.Root trigger="@" anchor={caretAnchor} items={members} itemKey={(m) => m.id} itemLabel={(m) => m.name}
    onInsert={({ value }) => mention(value.id)}>
    <Textarea.Root model={() => state.draft} minRows={1} maxRows={8}>
        <Textarea.Label visuallyHidden>Message</Textarea.Label>
        <Textarea.Textarea onKeydown={sendOnEnter} />
    </Textarea.Root>
</Combobox.Root>

<Combobox.Root trigger="/" anchor={caretAnchor} items={commands}>
    <Input.Root model={() => state.line}>
        <Input.Label visuallyHidden>Command</Input.Label>
        <Input.Control><Input.Input onKeydown={runOnEnter} /></Input.Control>
    </Input.Root>
</Combobox.Root>
```

**Long lists: `virtual`.** On a data-mode Select or Combobox,
`virtual={virtualListbox}` windows the options through `createVirtualList`
(#96): only the options near the popup's scroll position are in the
document, so ten thousand items cost a screenful of elements.
`estimateItemSize` (px, default 36) sizes an option until it has been
measured. The strategy lives in its own entry, `@sigx/zero/virtual-listbox`
(also on the barrel), so the `select` and `combobox` entries never carry
windowing: only a list that windows pays for it, about 3.3 kB brotli (#119).

```tsx
import { virtualListbox } from '@sigx/zero/virtual-listbox';

<Select.Root items={timeZones} virtual={virtualListbox} itemLabel={(z) => z.name} model={() => state.zone} />
<Combobox.Root items={timeZones} virtual={virtualListbox} itemLabel={(z) => z.name} model={() => state.zone} />
```

- **Every highlight is real.** Arrow keys, Home/End, typeahead and — only
  while windowed — PageUp/PageDown (a viewport's worth of options) reach
  options that were never rendered. The window scrolls to the highlighted
  option, which stays rendered (pinned) even when the list is scrolled away
  from it, so `aria-activedescendant` always names an element. Opening
  scrolls to the selection.
- **Each option says where it stands**: `aria-setsize` is the number of
  visible (filtered) options, and `aria-posinset` is the option's position
  among them.
- **The popup is the scroll viewport.** Rows the window skips are stood in
  for by `spacer` parts (aria-hidden, sized inline). The popup must be
  bounded for anything to be windowed; `css/base.css` bounds a windowed
  popup at `min(20rem, 60vh)` in its lowest layer (`zero.fallback`), so a
  design system's popup recipe or your own CSS sets the real height. Options
  stack as blocks without margins.
- **Groups window too (#127).** A `group` element contains its options,
  so it cannot be split across a window. Windowed, each `itemGroup` group
  is a `group-heading` part instead: a row of the window, beside the
  options rather than around them, and measured like one. It is
  `aria-hidden`; each option under it names it through `aria-describedby`
  while it is rendered, and the highlighted option's heading is pinned with
  it, so the option `aria-activedescendant` names always carries its group.
  A group the Combobox query empties has no heading. The keyboard walks
  groups in the order they render, windowed or not: a group's later members
  are pulled up under its heading, so they come next.
- **What stays whole.** Hand-written `Select.Item` / `Combobox.Item`
  children are never windowed. They register as they mount, so nothing
  knows an item before it is rendered, and `virtual` is ignored. To window
  a long list, pass it as `items`. Under `virtual`, the hidden `<select>`
  carries only the chosen options, not one per item. `multiple`, tags,
  `allowCustom` and trigger mode work as they do unwindowed.

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

Popup geometry is published the same way (#278). Every popup the built-in
position strategy places — Select, Combobox, Menu and its submenus, Popover,
Tooltip, HoverCard — carries, beside `data-placement`, the custom properties
`POSITION_PROPERTIES` names (`@sigx/zero/contract`), re-measured on every
update:

| Property | Value |
|---|---|
| `--anchor-width` / `--anchor-height` | the anchor's size, px |
| `--available-width` / `--available-height` | the room between the anchor and the viewport edge on the side the popup resolved to (after a flip), less the offset and the collision padding; the cross axis is the viewport less the padding at both ends |
| `--transform-origin` | the anchor-facing edge and the aligned point, physical keywords: `top left` for `bottom-start` (`top right` under `rtl`) |

So a listbox as wide as its trigger that never runs off screen is
`box-sizing: border-box; min-width: var(--anchor-width, 12rem);
max-height: min(20rem, var(--available-height, 20rem)); overflow-y: auto`
— what all six design systems now do for Select and Combobox; `border-box`
keeps the padding and border inside the available room — and a popup that
scales in grows out of its anchor with
`transform-origin: var(--transform-origin, center)`. Read
them with a fallback: a substituted `positionStrategy` may not publish
them. They are left in place when the popup closes, so an exit transition
keeps its size and origin.

Those six roots also take `collisionPadding` (px, default 8): the margin a
popup keeps from the viewport edges. The flip treats it as the edge, the
shift clamps inside it, and the available sizes subtract it. And
`alignOffset` (px, default 0) moves a `-start`/`-end` popup along the cross
axis, away from the edge it aligns to — in the reading direction for an
alignment above or below. A centred placement ignores it. `Menu.Sub` takes
both too.

**The arrow (#279).** Popover, Tooltip, HoverCard and Menu take an arrow
part — `Popover.Arrow`, `Tooltip.Arrow`, `HoverCard.Arrow`, `Menu.Arrow` —
rendered only when the app
renders it, inside the popup: an empty `<span aria-hidden="true">` the
design system draws. Only the strategy knows where the anchor's centre
lands on the popup edge that faces it once the flip and the shift have
run, so it writes that on the arrow — `ARROW_PROPERTIES`
(`@sigx/zero/contract`):

| Property | Value |
|---|---|
| `--arrow-x` | on a `top*`/`bottom*` popup: the arrow's left offset along that edge, px from the popup's padding edge |
| `--arrow-y` | on a side popup (`left*`, `right*`, `start`, `end`): its top offset, px |

One is set and the other removed. The offset centres the arrow on the
anchor, clamped to `[arrowPadding, edge - arrowSize - arrowPadding]` so it
never slides onto a rounded corner — and when the popup has been shifted
back on screen, it still points at the anchor rather than at the popup's
middle. `arrowPadding` (px, default 8) is a prop on each of the three roots.
Which edge the arrow sits on is the recipe's to read from the popup's
`data-placement` (`[data-placement^="top"] > [data-part="arrow"]` sits on
the bottom edge, and so on); `popupArrow` in `@sigx/zero-kit/define` is that
reading, ready-made. The arrow is the root popup's only: a `Menu.Arrow`
inside a `Menu.SubPopup` is never positioned, and no shipped skin paints it.
A popup that holds an arrow lets it paint outside its box
(`overflow: visible` in every skin that paints one), so give such a popup's scrolling
content its own scroller.

```tsx
<Popover.Root placement="bottom">
    <Popover.Trigger>Sharing</Popover.Trigger>
    <Popover.Popup>
        <Popover.Arrow />
        <Popover.Title>Sharing</Popover.Title>
        <Popover.Description>Shared with 3 people.</Popover.Description>
    </Popover.Popup>
</Popover.Root>
```

**Popover.Description and Popover.Anchor.** `Popover.Description` (a
`<p>`) describes the popup: the popup's `aria-describedby` names it only
while it is rendered, joined with any app `aria-describedby`, like Dialog's.
`Popover.Anchor` (a `<div>`, `asChild`) is what the popup is positioned
against in the trigger's place, while it is rendered — a whole row whose
trigger is a small button inside it. The trigger stays the toggle and the
element focus returns to on close; unmount the anchor and the trigger
anchors again.

ARIA wiring is presence-aware: an overlay references its `Title` /
`Description` ids only while those parts are actually rendered, so omitting a
title never leaves a dangling `aria-labelledby` (which would suppress the
accessible-name fallback). The same holds for Labels (#169): a
`RadioGroup.Label` names its radiogroup with or without a Field (joined with
the Field's label and any app `aria-labelledby`), a `Progress.Label` /
`RadialProgress.Label` is referenced only while rendered, a range slider's
thumbs without their own `label` are named by `Slider.Label`, and the
Label's and ValueText's `for` appear only while a native `Slider.Control`
is mounted. Presence reports land a microtask after mount, so RadioGroup,
Progress, RadialProgress and Slider render these references optimistically
until then: server markup keeps the Label reference (and, outside thumb
mode, the Label's `for`) a composed widget needs, and the client drops any that
would dangle once mounted. A Field works the same way (#266): every
control's `aria-describedby` names `Field.Description` and `Field.Error`
only while they are rendered — an Error rendered on and off with the
value's validity is followed — joined with any app `aria-describedby`, and
the attribute is absent when neither is (server markup names both). A
`Slider.Control` and every `Slider.Thumb` inside a Field take its
description ids too, and `getValueText` speaks for the native control as
it does for a thumb (`aria-valuetext`). A progressbar's
`aria-valuenow` is clamped to `[min, max]`. Escape dismissal is universal — a tooltip closes
from anywhere (WCAG 2.1 SC 1.4.13), and it is hoverable too: leaving the
trigger closes it only after a 120 ms pointer-leave grace period, so the
pointer can cross the offset gap onto the popup. Blur still closes at once,
and an explicit `closeDelay` replaces both (`closeDelay={0}` restores the
immediate pointer-leave close). A non-modal Dialog falls back to the
dismiss layer where the platform fires no `cancel`. That layer (and an
inline Drawer's) yields Escape to what sits inside it: an Escape a widget
already handled (`defaultPrevented` — a Combobox or Select closing its
list) and one from an open popup nested in the surface (a Menu,
Select or Popover) close only the inner widget, and the next Escape closes
the dialog. Close buttons whose
content is a glyph (`Alert.Close`, `Toast.Close`) default to
`aria-label="Close"` with a `label` prop override, and RatingGroup's per-item
names localize through `itemLabel={(index, count) => …}`, as Pagination's
page buttons do through `pageLabel={(n) => …}` (default `Page n`; the
landmark and prev/next names are `label`, `prevLabel`, `nextLabel`). Controls that
consume the Field context (Input, Textarea, Combobox, Select, RatingGroup,
…) adopt its control id, so `Field.Label` names them — Select's trigger
included, a button being a labelable element. Outside a Field,
`Select.Trigger` takes a `label` prop (`aria-label`): `role="combobox"`
prohibits name-from-content, so the value text inside the trigger can never
name it, and TreeView's typeahead matches the accessible text of a branch
row (skipping `aria-hidden` decoration such as the default indicator glyph)
— the element `BranchTrigger` renders, even an `asChild` row stamped with
the app's own `data-scope`/`data-part`.

**Feedback announces what users see** (#274):

- **Progress / RadialProgress** render `aria-valuetext`, and the default
  `ValueText` paints the same string — so a 256-of-1024 upload is heard as
  "25%", not "256". The string comes from `getValueText(value, { min, max,
  percent })` when given, else from `Intl.NumberFormat(locale,
  formatOptions)` with `formatOptions` merged over `{ style: 'percent' }`
  (so `{ minimumFractionDigits: 1 }` is still a percent): a percent style
  formats the filled fraction, any other style formats the value (`{ style: 'unit', unit: 'megabyte' }` → "62 MB"). An indeterminate
  bar has no value text. Server-rendered, pass `locale` so server and client
  format alike; custom `ValueText` children are painted only — use
  `getValueText` to change what is announced.
- **Spinner** says its words as TEXT: a visually hidden `label` part holds
  `label ?? aria-label ?? "Loading"` inside the `role="status"` root, which
  carries no `aria-label` (a live region announces content; a name in an
  attribute alone is skipped). `decorative` is for a spinner beside text
  that already says it: no role, no label, `aria-hidden="true"`.
- **Alert** is named by its `Title` (`aria-labelledby`) and described by its
  `Description` (`aria-describedby`), each only while rendered and joined
  with any app reference. `live="assertive"` (default) renders
  `role="alert"`; `live="polite"` renders `role="status"` for a
  confirmation that should wait its turn. Closing an alert that holds focus
  (its Close button, typically) moves focus to `finalFocus()` when that
  returns a focusable element, else to the nearest focusable element before
  the alert among its siblings (the last tabbable inside one), else leaves it
  alone; focus that is elsewhere is never moved.
- **Skeleton** is `inert` while `loading`, so links and buttons in the
  placeholder take neither focus nor clicks; the attribute goes once loaded.
- **Swap** (interactive) states its state once: with a `label` (or an app
  `aria-label`/`aria-labelledby`) the name is fixed, `aria-pressed` carries
  the state and both faces are `aria-hidden`; without one the active face is
  the name, `aria-pressed` is omitted, and a console warning asks for a
  label.
- **Avatar** settles to `error` a microtask after mount when no
  `Avatar.Image` is rendered (or the last one unmounts), so an image-less
  avatar shows its fallback instead of sitting in `loading`.
  `Avatar.Fallback delay={ms}` keeps the fallback out of the DOM until the
  delay passes, so a fast image never flashes initials first — a client-only
  timer, cleared on unmount; server markup renders no fallback while a delay
  is set.

**Drawer width is `measure`.** `Drawer.Panel measure="md"` sizes the panel
from the design system's `--measure-*` ramp — Container's layout attribute,
not the `size` axis, which rides the trigger and cannot reach a panel that
is not inside it. The measure is a cap: the panel fills the space it is given
up to it — its container inline, the viewport as a modal sheet — so
`measure="full"` is a full-screen sheet. Unset, each design system keeps its
own drawer width.

**The regime is `data-l-dock` on the panel** (#83): `sheet` for a modal
drawer, `inline` for `modal={false}`, and for a responsive one whichever side
of its breakpoint the viewport is on. Unlike `:modal`, which stops matching
the moment `close()` runs, it holds through a sheet's exit, so a design
system keys the sheet's geometry on `[data-l-dock="sheet"]` and the sheet
keeps its box while it leaves. That is what lets material, daisyUI, HeroUI
and Carbon slide the sheet in from its edge and back out to it (the travel
flips with the placement and with `dir="rtl"`; reduced motion drops it), while
basic and brutalist keep the fade. Outside Chromium the exit plays through
zero's deferred close (#17).

**One drawer for both regimes: `modal={{ below: 'md' }}`.** A modal sheet
below the design system's `md`, the panel docked open inline at or above it —
an app shell's navigation rendered once, not twice (#82).

```tsx
<Drawer.Root modal={{ below: 'md' }} label="Navigation">
    <Drawer.Trigger>Menu</Drawer.Trigger>
    <Drawer.Panel>…links…<Drawer.Close>Close</Drawer.Close></Drawer.Panel>
</Drawer.Root>
```

- **The model governs the sheet only.** Docked, the panel is open whatever
  the model holds, and Close, Escape and model writes do nothing visible; a
  model set to `true` while docked opens the sheet when the viewport
  narrows.
- **Crossing the breakpoint is not a close.** No `openChange`, no `close`
  event. A sheet still up when the viewport widens goes away silently (the
  model is reset without reporting it), so narrowing again does not bring it
  back.
- **SSR-correct.** The server cannot see the viewport, so it renders the
  docked markup — the panel `open`, every part stamped
  `data-l-dock-above="md"` (the breakpoint is the value, as `Table.Root
  stack="md"` spells it) — and the design system's compiled CSS (emitted
  per breakpoint by `@sigx/zero-kit`, in `@layer zero.structure`) hides the
  trigger and close at or above `md` and the docked panel below it. The
  runtime catches up on mount; nothing flashes. The docked panel is put back
  in flow (`position: relative`, no UA `margin: auto`).
- **Focus.** A sheet outgrown by the viewport keeps focus where it was — the
  same element, now in the docked panel — instead of the native restore to a
  trigger that just hid. Focus inside a docked panel that stops showing
  moves to the trigger, which a sheet opened from there restores to.
- The breakpoint is the design system's (`useMediaQuery`'s `(min-width: …)`
  boundary), so `installThemes()` must have run — on the server too; an
  undeclared name throws at setup. The form of `modal` is read once, at
  setup.

`@sigx/zero/css` (like every design system's `./css`) carries a `types`
condition pointing at an empty declaration, so the extensionless side-effect
import typechecks under `noUncheckedSideEffectImports` with no app-side shim.

**EmptyState: what stands where the content would be** (#131). Nothing
yet, nothing found, nothing reachable — every app writes those three by
hand, and the parts they share are `Icon` (decorative), `Title` (`asChild`
so it can be the heading the page's outline wants), `Description` and an
`Actions` band for the way out, holding your own `Button.Root`s:

```tsx
<EmptyState.Root color="error">
    <EmptyState.Icon>⚠</EmptyState.Icon>
    <EmptyState.Title asChild>{(p) => <h2 {...p}>Could not load your projects</h2>}</EmptyState.Title>
    <EmptyState.Description>The server did not answer. Your work is saved.</EmptyState.Description>
    <EmptyState.Actions>
        <Button.Root onClick={retry}>Try again</Button.Root>
        <Button.Root asChild variant="ghost">{(p) => <a href="/status" {...p}>Service status</a>}</Button.Root>
    </EmptyState.Actions>
</EmptyState.Root>
```

The tone is the `color` axis, Alert's answer — a failure is `error`, an
offline notice `warning` — so there is no variant to invent. It is not an
Alert: an alert announces itself (`role="alert"`) and can be dismissed; an
empty state is the page's content while there is none, read in flow, and
stays until the content arrives. No role of its own (pass `role="status"`
to have a failure announced), no open/closed — presence is your `if`.

**NavList: the sidebar's navigation list** (#132) — and the `<nav>` a
Navbar deliberately does not carry (its `<header>` holds a logo, a search
field, an account menu; the landmark for *exactly the links* is this). A
labelled `<nav>` over groups of links, the current page as
`aria-current="page"` and `data-state="active"` — Breadcrumbs' rule, one
level down: the current page is the activation state, never a flag — an
`Icon` in front and a `Meta` slot at the far edge for a count or a key hint:

```tsx
<NavList.Root label="Main">
    <NavList.Group>
        <NavList.Heading>Workspace</NavList.Heading>
        <NavList.List>
            <NavList.Item>
                <NavList.Link href="/inbox" current={route() === '/inbox'}>
                    <NavList.Icon>✉</NavList.Icon>
                    Inbox
                    <NavList.Meta><Badge>12</Badge></NavList.Meta>
                </NavList.Link>
            </NavList.Item>
        </NavList.List>
    </NavList.Group>
</NavList.Root>
```

No behaviour: which link is current is the router's knowledge, passed in;
`Link` is `asChild` for a router's own anchor. A `Group` is a `role="group"`
named by its `Heading` with the ids wired for you. It renders inside a
responsive `Drawer.Panel` (`modal={{ below: 'md' }}`) as it renders
anywhere — the drawer decides whether the sidebar is docked or a sheet.

**Attribute pass-through.** sigx forwards no rest props, so a part only
renders what it declares. Every part an app writes takes `WithHtmlAttrs` and
forwards `aria-*`, the app's own `data-*`, `id`, `title` and `role` onto the
element it renders (into the asChild bag too) — `Button.Root` also declares
its native `form`/`name`/`value`, `Table.Cell`/`Table.HeaderCell` take
`colSpan`/`rowSpan`, and `Card.Root` takes `asChild` for a card that is an
`<article>`. Where the attributes land:

- **On the part's own element**, for nearly every part. A fragment root
  (`Dialog.Root`, `Drawer.Root`, `Popover.Root`, `Tooltip.Root`,
  `HoverCard.Root`, `Menu.Root`, `Menu.Sub`, `Combobox.Tags`) renders no element and takes
  none: the Trigger and the popup each carry their own.
- **Split, where the part wraps the element assistive tech reads**:
  `Table.Root` puts `aria-*` and `role` on the `<table>` and the rest on its
  scroll wrapper (with no `Table.Caption`, an app `aria-label` or
  `aria-labelledby` also names the wrapper's scroll region); `Checkbox.Root`, `Switch.Root` and `RadioGroup.Item` put
  `aria-*` on their input and `id`/`title`/`data-*` on the row.
- **Nowhere**, for parts zero renders on its own — hidden inputs,
  Pagination's page buttons, a switch thumb, a dialog backdrop, an item
  indicator. There is no component to take an attribute.

The part's own attributes win where both set one, with three refinements:

- A name the part always sets itself is refused by the type rather than
  silently dropped: `role` wherever the role is the component's semantics
  (`Divider`, `Spinner`, `Status`, `Countdown`, `Alert.Root`, the progress
  roots, `Tabs.List`/`Tab`/`Panel`, the TreeView tree and its items,
  `Steps.Root`/`Item`, `Carousel.Root`/`Item`, `Diff.Handle`, the switch,
  checkbox, radio, toggle, slider-thumb and spinbutton parts, every popup
  but `Drawer.Panel` (a native `<dialog>`), the Select trigger and Combobox
  input (a `combobox`), every menu item, option, group and separator,
  `Toast.Root`/`Viewport`),
  and `id` wherever another part points at it (every Label and Title, the
  descriptions, `Field.Error`, the disclosure Panels, `Tabs.Tab`/`Panel`,
  every popup, `Menu.Trigger`/`SubTrigger`, the Select trigger and items,
  the Combobox input, trigger and items, the Field control of NumberInput,
  RatingGroup, Slider and FileUpload). `Dialog.Popup`'s role is the Root's
  `role` prop.
- A name the part only defaults gives way: an app `aria-label` replaces
  Spinner's "Loading" (as the hidden label's text, not an attribute on
  the live region), Breadcrumbs' "Breadcrumb", Pagination's
  "Pagination" and every icon trigger's default (`Alert.Close`, the
  Carousel triggers and dots, `Diff.Handle`, the NumberInput steppers,
  `FileUpload.ItemRemove`/`ClearTrigger`, `Input.ClearTrigger`/`VisibilityTrigger`,
  a Carousel slide's "n of m", `Toast.Close`,
  the toast viewport's "Notifications (F8)", `Combobox.Trigger`/`TagRemove`,
  `Select.Trigger`) — the `label` prop
  still beats both — and names `Status` (a named dot is an `img`) and
  `Countdown` (a named countdown is a `timer`) the way `label` does. An app
  `aria-labelledby`/`aria-describedby` joins the one the part wires (a
  progressbar's, a tab panel's, a tree's, a control's Field description, a
  popup's or an alert's title and description, a group's label, a tooltip
  trigger's popup).
- State ARIA stays the component's: `aria-busy` and `inert` on a loading Skeleton,
  `aria-current` on the current `Breadcrumbs.Link`, `aria-valuenow`,
  `aria-expanded`, `aria-selected`, `aria-checked`, `aria-pressed`,
  `aria-controls`, `aria-haspopup`, `aria-activedescendant`, `aria-modal`.

A `data-*` name the contract owns — `data-scope`/`part`/`state`/
`orientation`/`placement`, a flag, `data-color`/`size`/`variant`,
`data-mod-*`, `data-l-*` — is a compile error where TypeScript can see it
and throws at runtime either way. Build your own forwarding part the same
way: intersect `WithHtmlAttrs` into the props (`Omit` the names your part
owns) and spread `htmlAttrs(props)` first.

```tsx
<Button.Root aria-label="Close" data-testid="close" onClick={close}>×</Button.Root>
<Table.Row data-row-id={row.id}><Table.Cell colSpan={5}>No results</Table.Cell></Table.Row>
<Card.Root role="region" aria-labelledby="report-title">…</Card.Root>
<Stack.Root role="list" data-testid="members">…</Stack.Root>
<Alert.Close aria-label="Dismiss" />
<Tabs.List aria-label="Settings">…</Tabs.List>
<Checkbox.Root aria-label="Accept terms" data-testid="terms" />
<Dialog.Popup aria-describedby="terms-summary" data-testid="confirm">…</Dialog.Popup>
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

**Bound triggers stay focusable.** Pagination's and Carousel's prev/next
triggers are `aria-disabled="true"` plus `data-disabled` at their bound
(page 1, the last page, the first or last slide), never natively
`disabled`: a native `disabled` dropped keyboard focus to `<body>` on the
very press that reached the bound. They stay in the tab order and a press
there is a no-op. `Pagination.Root disabled` still disables every button
natively and puts the declared `data-disabled` flag on the root. Carousel
slides are counted in document order, so a slide rendered conditionally
ahead of the others is "1 of n", and the viewport is a polite, non-atomic
live region (`aria-live` is overridable — set `off` for auto-rotation).
Carousel's `indicator` no longer declares a `disabled` flag it never
rendered.

**Pagination edges and links.** `withEdges` adds `first-trigger` and
`last-trigger` outside prev/next — `«`/`»` glyphs (flipped under RTL by the
design system, like `‹`/`›`), named "First page"/"Last page"
(`firstLabel`/`lastLabel`), with the same focusable `aria-disabled` bound
as prev/next. `getPageHref={(n) => …}` switches the row to links: every
page and trigger renders `<a href>` instead of a button (the anatomy's
`element: 'button'` is the default), the current page keeps
`aria-current="page"`, and a control that goes nowhere — a bound, or
anything under a disabled root — renders `<a>` with no `href`,
`role="link"` and `aria-disabled` (a bound keeps a tab stop). A plain
click still moves the model and zero never prevents it, so an SPA router
can intercept the navigation; a modified click (new tab) leaves the
model alone.

```tsx
<Pagination.Root count={12} model={[state, 'page']} withEdges
    getPageHref={(n) => `/posts?page=${n}`} />
```

**Scrollable tables are keyboard stops.** `Table.Root`'s scroll wrapper has
`tabIndex=0` (axe `scrollable-region-focusable`: a table wider than its
container must scroll without a pointer — focused, the arrow keys scroll
it) and carries `data-focus-visible`, which every shipped design system
rings inside the box. The wrapper is a `role="region"` named the way the
table is: by the app's `aria-label`/`aria-labelledby` when given (which
also overrides the caption as the table's own name, so the two never
diverge), else by a rendered `Table.Caption` (`aria-labelledby`,
presence-tracked like Field's references, so it never dangles); with
neither it stays a plain focusable box rather than a nameless landmark. The caption carries
that id, so `Table.Caption` takes no `id` of its own
(`TableCaptionProps`).

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

**Sortable tables.** A `Table.HeaderCell` with `sortable` wraps its content
in a real `<button>` (the `sort-trigger` part) followed by the
`sort-indicator` mark (an `aria-hidden` span with zero's `▲`, which recipes
turn for descending and hide on an unsorted column until the trigger is
hovered or keyboard-focused). The `<th>` carries `aria-sort`, and the cell,
trigger and indicator all carry the same `data-state`: `ascending`,
`descending` or `none` (a sortable column the table is not sorted by; a
cell that cannot sort has no state). The sort lives on the root as the named
model `model:sort` — `{ column, direction } | null`, seeded by
`defaultSort`, reported by `sortChange`. A press on an unsorted column sorts
it `ascending`, and on the sorted one flips it; `sortCycle="three"` adds a
third press back to unsorted (`null`). The same cycle is exported as
`nextTableSort(current, column, cycle?)`. A cell sorts under its `column`:
a string name, or the `key` of the spec column an index names, and a column
spec entry with `sortable: true` makes `<Table.Head />` render it sortable
(it then needs a `key`). With no column spec, a sortable cell's string
`column` is just the sort name. `disabled` disables the trigger and keeps
the sort it shows. **The runtime never re-orders rows**: the app owns the
data and sorts it from the model.

```tsx
const state = signal({ sort: null as TableSort | null });
<Table.Root model:sort={() => state.sort}>
    <Table.Head>
        <Table.Row>
            <Table.HeaderCell sortable column="name">Name</Table.HeaderCell>
            <Table.HeaderCell sortable column="size">Size</Table.HeaderCell>
            <Table.HeaderCell>Owner</Table.HeaderCell>
        </Table.Row>
    </Table.Head>
    <Table.Body>{sortFiles(files, state.sort).map((f) => <Table.Row>…</Table.Row>)}</Table.Body>
</Table.Root>
```

**Stacked tables.** `Table.Root stack="md"` names a design-system
breakpoint. Below it, every row becomes one block, and a cell that names a
labelled column opens with that label: the `cell-label` part, an
`aria-hidden` `<span>` rendered only on a table that can stack. The root
carries `data-l-stack="md"`, a breakpoint-valued layout attribute that
`/register` narrows to the declared names. The geometry is zero's, emitted
by each design system's build into `@layer zero.structure` per breakpoint.
Rows turn into blocks, the head row is visually hidden but stays in the
accessibility tree, the `<col>` widths reset, and the label hangs beside the
value. The card chrome (border, fill, the gap between cards) is the design
system's recipe. `css/base.css` hides the label until the table actually
stacks. While it can stack, the table restates its native roles (`table`,
`rowgroup`, `row`, `cell`, `columnheader`/`rowheader`), because some
engines drop table semantics once the elements stop being displayed as
table parts. An app `role` still wins. Only `Table.Cell` prints a label;
a cell that names no column, or a column with no `label`, prints none.

```tsx
<Table.Root stack="md" columns={[{ label: 'Service' }, { label: 'What' }]}>
    <Table.Head />
    <Table.Body>
        <Table.Row>
            <Table.Cell column={0}>api-gateway</Table.Cell>
            <Table.Cell column={1}>Deployed <code>2.14.0</code></Table.Cell>
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
selection, measuring. Inside a trigger-mode `Combobox.Root`, either one
becomes the combobox's control (#58, #106), and the combobox sees each key
before the app's `onKeydown`.

```tsx
let composer: TextareaHandle | null = null;
<Textarea.Textarea
    role="combobox" aria-expanded={open()} aria-controls="mentions"
    onKeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
    ref={(h) => { composer = h; }}
/>
composer?.element?.setSelectionRange(caret, caret);
```

**Autosize.** `Textarea.Root` takes `minRows` / `maxRows` (either one turns
it on; `minRows` defaults to 1): the box grows with its content — soft wraps
included — never below `minRows` lines, and scrolls past `maxRows`. The
textarea part renders `data-autosize` and the bounds as
`--textarea-min-rows` / `--textarea-max-rows`, and `css/base.css` does the
growing in `@layer zero.structure` with `field-sizing: content` and `lh`
bounds — so it is right before hydration (the element's `rows` follows
`minRows` meanwhile, for engines without `field-sizing`), and a design system has nothing to
write (the rule also sets `resize: none`, since a manual resize would switch
the growth off). `createAutosize` (on `@sigx/zero/behaviors`) is the runtime
half: it measures the block padding + border a `border-box` element's bounds
must add (`--textarea-block-chrome`), and on an engine without
`field-sizing` it measures `scrollHeight` and writes the height inline. Like
`visuallyHidden`, it is a presentation request declared by the anatomy
(`autosize: true`), not a flag.

```tsx
<Textarea.Root model={() => state.draft} minRows={1} maxRows={8}>
    <Textarea.Label visuallyHidden>Message</Textarea.Label>
    <Textarea.Textarea placeholder="Write a message…" />
</Textarea.Root>
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

**Toast timing.** Auto-dismiss pauses while anything holds the viewport:
the pointer or focus in `Toast.Viewport`, a hidden document
(`visibilitychange`), or an unfocused window (`blur`/`focus`). It resumes
only once every hold has gone, so moving the mouse out does not restart
timers while a keyboard user is on a toast, and a toast raised in a
background tab waits to be seen. Closing the focused toast releases its hold
even though the removed button fires no `focusout`: the viewport re-reads
focus after every removal. The queue's pause is one shared flag, not a
count: the viewport's `resume()` also clears a `toaster.pause()` of your
own, and your `resume()` clears the viewport's hold.

**Toast keyboard and focus.** `F8` moves focus to the first toast from
anywhere in the document (`hotkey`: keys that must all be down, modifiers
named by their event flag — `['altKey', 'KeyT']` — the rest by
`KeyboardEvent.code` or `key`; `hotkey={false}` turns it off). The listener
is attached only while there are toasts. The viewport's name is a template:
`label` defaults to `"Notifications ({hotkey})"`, which reads
"Notifications (F8)", and with the hotkey off the ` ({hotkey})` suffix is
dropped. `Escape` inside a toast dismisses it (an `Escape` a widget inside
already handled with `preventDefault()` does not). Each root is focusable
(`tabindex="-1"`), and before a focused toast is removed, focus moves to the
next toast, else the previous one, else the element focus came from when it
entered the viewport, else the viewport — never to `<body>`.

**Toast announcements.** The viewport — always mounted, so it exists before
any toast does — is the polite live region (`aria-live="polite"`,
`aria-relevant="additions text"`, `aria-atomic="false"`), and each root is
a named `group` inside it rather than a `status` of its own: a live region
inserted together with its content is announced unreliably. The root is
focusable, so it is always named — by its Title, else (when the app names
it neither with `aria-label` nor `aria-labelledby`) by its Description,
else `aria-label="Notification"`. A
`role: 'alert'` toast opts its root out (`aria-live="off"`) and is spoken
through a visually-hidden `aria-live="assertive"` span the viewport renders
beside the region, filled a frame after the toast mounts (and again when an
alert's text changes), so nothing is announced twice.

**Promise toasts.** `toaster().promise(p, { loading, success, error })`
shows one toast for the life of a promise and returns its id: the
`loading` stage is sticky (`duration: Infinity`) with `status: 'loading'`,
and when `p` settles the same toast is updated in place with `success`
(`status: 'complete'`) or `error` (`status: 'error'`) and the toaster's
default duration re-armed, unless that stage sets its own. Each stage is a
title string or the options of an ordinary toast; `success` and `error` may
also be functions of the value or the reason. The rejection is handled
there, and a toast dismissed before the promise settles stays gone. Any
toast can carry a `status` (`create`/`update`). `Toast.Indicator` renders
it — a decorative (`aria-hidden`) `span` with `data-state="loading" |
"complete" | "error"`, and nothing at all while the toast has no status; the
stock composition includes one, the recipe draws the mark, and the title
says the outcome in words.

**Toast stack.** The viewport carries `data-state`: `open` while the stack
is expanded — the pointer over it or focus inside it (the same holds that
pause the timers), or always with `expand="always"` — and `closed` at rest
(`expand` defaults to `'hover'`). Each root publishes where it stands:
`--toast-index` (oldest first) of `--toast-count`, and, measured with a
`ResizeObserver`, its own `--toast-height` and `--toast-offset` — the summed
heights of the newer toasts in front of it, in px. That is enough for a
recipe to lay a resting stack out as a deck of cards and fan it into a
column when it opens (zero-basic and zero-heroui do; the other skins keep a
plain column). All four are web runtime properties (`RUNTIME_PROPERTIES`).

**Toasts over a modal dialog.** A toast raised while the viewport is
already showing re-shows it (`hidePopover()` + `showPopover()`), the only
way to the top of the top layer, so a toast raised during a modal dialog
paints above the dialog. Its actions and Close stay inert until the dialog
closes — a modal dialog makes everything outside it inert, by spec — so
anything a user must act on during a modal belongs in the dialog.

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

**The status pill.** A badge with a leading dot (#130) — `Badge.Dot`
re-carries `color`, so a dot with a colour of its own is the status while
the pill's colour is its tone; a dot without one follows the pill (the
nearest carrier wins, #94), and on an uncoloured pill it is the ink. Its
one state is the governed `running` (#93), absent at rest:

```tsx
<Badge variant="soft"><Badge.Dot color="success" running />Deploying</Badge>
<Badge color="error" variant="solid"><Badge.Dot />Failed</Badge>
```

Every shipped skin draws `running` as a halo the pulse breathes and keeps
the halo under reduced motion, so the state never vanishes; a coloured dot
is the role's fill inside a ring in the role's `-content` ink — the
timeline marker's construction, and what keeps a dot that follows a solid
pill visible on that pill's own fill — and the contrast audit measures it
per colour. The dot is `aria-hidden`: the pill's text is the label.

**The app shell.** A composition, not a component (#133): `Navbar` for the
top bar, a responsive `Drawer` for the sidebar with a `NavList` inside it,
and a `Container` for `<main>`. `Drawer.Root` renders no element, so it
wraps the whole shell and its trigger can sit in the bar; at or above
`md` the panel docks open in flow and the trigger hides, below it the
navigation is a sheet the trigger opens — from the design system's own
breakpoint, correct before any script runs. The navigation is rendered
once:

```tsx
<Drawer.Root modal={{ below: 'md' }}>
    <Navbar.Root>
        <Navbar.Start>
            <Drawer.Trigger aria-label="Open navigation">☰</Drawer.Trigger>
            <strong>Acme</strong>
        </Navbar.Start>
        <Navbar.End>…</Navbar.End>
    </Navbar.Root>
    <Row align="start" gap="none">
        <Drawer.Panel measure="xs">
            <Drawer.Title visuallyHidden>Navigation</Drawer.Title>
            <NavList.Root label="Main">…</NavList.Root>
            <Drawer.Close>Close navigation</Drawer.Close>
        </Drawer.Panel>
        <Stack.Item grow asChild>
            {(p) => <main {...p}><Container measure="md" padY="lg">…</Container></main>}
        </Stack.Item>
    </Row>
</Drawer.Root>
```

The page keeps one banner (the Navbar's `<header>`, at document scope) and
one navigation landmark (NavList's `<nav>`) in both regimes. Page CSS
sits outside or after the four layers — `@layer zero, app;` first in the
app's entry stylesheet (docs/architecture.md, "App CSS").

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

A **disabled** link button stops being a link that goes anywhere: it renders
without its `href` (spread the bag after your own attributes, as above, so
the bag's wins), with `role="link"` and `aria-disabled="true"` so it still
reads as a link, out of the tab order, and middle-click (`auxclick`) is
cancelled too.

**A button on any element** (#275). `asChild` over an element with no
button semantics of its own — a `<span>`, a `<div>`, a custom element — gets
the whole button contract, read from the element's tag once it mounts:
`role="button"` (unless you pass a `role`), `tabindex="0"`, Enter activating
on press and Space on release, like the native one. A `<button>`, `<input>`
or `<summary>` already has all of that, and a link keeps its link semantics,
so neither gets the synthesized role or keys — a second, synthesized click
would activate twice. Disabled, the element leaves the tab order
(`tabindex="-1"`) and activates nothing; an asChild `<button>` or `<input>`
gets the native `disabled` itself, like the built-in button, so it is no
longer a form's implicit submitter. Server rendering cannot see the
element's tag, so the contract arrives on mount.

**Disabled, but still focusable.** `focusableWhenDisabled` keeps a disabled
button a tab stop — `aria-disabled="true"` instead of the native `disabled`,
activation still blocked — so a keyboard or screen-reader user can reach it
and hear why it cannot act (a tooltip on it, a greyed-out toolbar command):

```tsx
<Button.Root disabled focusableWhenDisabled aria-describedby="why">Publish</Button.Root>
```

It applies to every element `Button.Root` renders: a native button keeps
focus, an `asChild` element keeps `tabindex="0"`, a disabled link stays a
tab stop.

**The element the semantics want** (#275). The layout and content roots —
`Box`, `Center`, `Container`, `Grid`, `Stack` (and `Row`/`Col`), `Join`,
`Chat` and `Stats` — take `asChild`, and so do `Card.Title` (an `<h3>` by
default) and `Card.Description` (a `<p>`). A `<div>` root forced a wrapper
whenever the thing was really a landmark, a list or a heading at another
level; now the semantic element carries the part, the layout attributes and
the axes itself:

```tsx
<Container asChild measure="lg" padX="xl">{(p) => <main {...p}>…</main>}</Container>
<Grid asChild cols="auto" gap="md">
    {(p) => (
        <ul {...p}>
            <Grid.Cell asChild>{(c) => <li {...c}><Card.Root>…</Card.Root></li>}</Grid.Cell>
        </ul>
    )}
</Grid>
<Card.Title asChild>{(p) => <h2 {...p}>Monthly report</h2>}</Card.Title>
```

**The confirm dialog.** A destructive confirm is `Dialog.Root
role="alertdialog"` — no backdrop dismiss, initial focus on the
least-destructive action — with the dependents as the description's own
list and the destructive action as the app's own `Button` in its danger
colour. It is not a dialog part: a skin paints `Dialog.Close` and
`Dialog.Cancel` as the quiet pair, and the one button that must not look
quiet is yours. Make it a `type="submit"` inside a `<form method="dialog">`
and the platform closes the dialog for you, with the submitter's `value` as
the `close` event's `value` (reason `programmatic`, since zero did not start
it). `Dialog.Cancel` is `type="button"`, so it sits in the same form:

```tsx
<Dialog.Root role="alertdialog" onClose={(d) => { if (d.value === 'delete') remove(); }}>
    <Dialog.Trigger>Delete workspace…</Dialog.Trigger>
    <Dialog.Popup aria-describedby="dependents">
        <Dialog.Title>Delete "acme"?</Dialog.Title>
        <Dialog.Description>This cannot be undone. It also removes:</Dialog.Description>
        <ul id="dependents"><li>3 members' access</li><li>2 shared folders</li></ul>
        <form method="dialog">
            <Dialog.Footer>
                <Dialog.Cancel>Keep workspace</Dialog.Cancel>
                <Button.Root type="submit" value="delete" color="error">Delete workspace</Button.Root>
            </Dialog.Footer>
        </form>
    </Dialog.Popup>
</Dialog.Root>
```

`Dialog.Description` is a `<p>`, so the dependents are its sibling list,
and the popup's `aria-describedby` joins the list's id to the description's
(#74) — a reader hears both. Where a quiet destructive action is fine,
`Dialog.Close value="delete"` reports `{ reason: 'close', value: 'delete' }`
with no form at all. Either way the model needs no flag beside it: the
close says what happened.

**The carousel that starts mid-way.** `Carousel.Root defaultIndex={2}` (or a
bound `model`) scrolls its slide into place on mount, and every later model
write scrolls to its slide. Only the carousel's own viewport scrolls: zero
centres the slide with `viewport.scrollTo`, never `scrollIntoView`, which
would also scroll the page (#171). A carousel below the fold therefore opens
on its slide without pulling the reader down to it, and an app can drive the
model from elsewhere on the page without moving the page. The target is
measured from the boxes, so it is right in an RTL viewport too. When the tree
mounts before it is attached to the document, the viewport waits, frame by frame,
until it is attached (about a second at most) before it scrolls and starts observing.

**The toolbar of tooltips.** A tooltip opens on *keyboard* focus at once
(a focus matching `:focus-visible` — the click that focuses a trigger does
not open it) and on mouse or pen hover after `openDelay`; a touch
`pointerenter` is ignored, since touch has no hover. Pressing the trigger
closes it at once, and it stays closed until the pointer has left the
trigger — so a tooltip never hangs over the menu or dialog the press
opened. Escape closes it wherever focus is (WCAG 1.4.13). Wrap a set of
tooltips in `Tooltip.Group` to share their timing:

```tsx
<Tooltip.Group openDelay={600} skipDelay={300}>
    <Tooltip.Root>
        <Tooltip.Trigger>Bold</Tooltip.Trigger>
        <Tooltip.Popup>Bold (Ctrl+B)</Tooltip.Popup>
    </Tooltip.Root>
    <Tooltip.Root>
        <Tooltip.Trigger>Italic</Tooltip.Trigger>
        <Tooltip.Popup>Italic (Ctrl+I)</Tooltip.Popup>
    </Tooltip.Root>
</Tooltip.Group>
```

The group renders no element and has no anatomy part. Its `openDelay`
(default 600) and `closeDelay` are the defaults of every member Root — a
Root's own props win. Only one member is open at a time: opening one closes
the open sibling at once. While a member is open, or within `skipDelay` ms
(default 300) of one closing, hovering another opens it with no delay — the
user has already shown they are reading labels. The shared state lives in
the provided context, one per rendered group, so nothing leaks across SSR
requests.

**The hover card (#290).** A preview on the way to a destination — the
profile behind an `@mention`, the page behind a link — whose content may be
interactive:

```tsx
<HoverCard.Root>
    <HoverCard.Trigger href="/users/ada">@ada</HoverCard.Trigger>
    <HoverCard.Popup>
        <HoverCard.Arrow />
        Ada Lovelace — <a href="/users/ada/followers">1.2k followers</a>
    </HoverCard.Popup>
</HoverCard.Root>
```

Parts: `trigger` (an `<a>`, `asChild` for your own element; `href` rides the
bag; `data-state` open|closed and `data-focus-visible`), `popup` (a
`popover="manual"` div, open|closed, anchor-positioned with the published
geometry and `data-placement`) and `arrow`. The root takes `model` /
`defaultOpen` / `openChange`, `openDelay` (default 700), `closeDelay`
(default 300), `openOnFocus` (default true), `placement` (default `bottom`),
`offset` (default 8) and the other anchored-popup props (`collisionPadding`,
`alignOffset`, `arrowPadding`, `positionStrategy`).

It is deliberately neither a tooltip nor a disclosure: the popup has no
`role="tooltip"`, the trigger gets no `aria-describedby` and no
`aria-expanded`. The card is an enhancement for sighted pointer and keyboard
users; the link's destination is the accessible path to the same content.

It opens on mouse or pen hover after `openDelay` (a touch `pointerenter` is
ignored) and at once on *keyboard* focus of the trigger (`:focus-visible`;
`openOnFocus={false}` turns that off). It closes `closeDelay` after the
pointer has left both the trigger and the card; while the pointer travels
from the trigger toward the card inside the safe triangle between them, each
move pushes the close back, so a slow trip still arrives. Focus inside the
card keeps it open, and it closes when focus leaves both — unless the pointer
is over one of them. Escape closes it wherever focus is (the dismiss layer);
when focus was inside the card, it goes back to the trigger, and that focus
does not reopen the card. An outside press does not close it. Tooltip and
HoverCard share their open/close timers (`createHoverIntent`, exported with
the behaviors).

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
    // (A drawer that is a sheet below `md` needs none of this — see
    // `Drawer.Root modal={{ below: 'md' }}`.)
    return () => (wide.value ? <SideNav /> : <BottomNav />);
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
- **Pinned rows.** `pinned: () => index` (or an array of indices) keeps
  rows rendered wherever the viewport is. In a listbox that is the
  highlighted option, which its `aria-activedescendant` must be able to
  name, and its group's heading, which the option's `aria-describedby`
  names. A pinned row outside the window is rendered apart from it, and
  its `skip` (on each `VirtualRow`) is the height of the unrendered rows in
  between: render it as a spacer or a block-start margin before the row.
  `skip` is 0 everywhere else.
- **Hidden viewports.** A row with no box (inside a closed popover or an
  inactive tab) is not measured — it keeps its estimate until it is shown.
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

## Theme controller

`themeController()` (the browser singleton) and `useTheme()` (the nearest
`ThemeProvider`'s instance) hold the explicit theme choice: `theme()` is a
name, or `null` to follow the system. `resolvedScheme()` returns the
effective scheme, `'light' | 'dark'`. It is reactive in both modes. With an
explicit theme it follows `theme()`. When following the system it follows
the OS: a `(prefers-color-scheme: dark)` change re-runs any render or effect
that read it, so a sun/moon icon stays correct (#178). The media listener is
created on the first follow-system read, in the browser only, and every
controller on the page shares it. On the server, and where `matchMedia` does
not exist, the system scheme is `'light'`. The page colours never depend on
this value: the compiled CSS follows the OS through `light-dark()`.

```tsx
const ctl = themeController();
return () => <button onClick={() => ctl.toggle()}>{ctl.resolvedScheme() === 'dark' ? 'Moon' : 'Sun'}</button>;
```

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

**A custom axis, end to end: `Avatar.Root axes={{ shape }}`.** Every
shipped design system declares `shape: circle | square | rounded` in
`tokens.axes` and wires it on avatar (#129) — the first custom axis in the
repo, and so the acceptance test for the whole path: the recipe keys
`variants.shape`, the compiled CSS carries `[data-shape="square"]`, the
`/register` module types `axes: { shape: … }` on `avatar` and
`Record<string, never>` everywhere else, and the playground's smoke spec
holds a rendered `data-shape` to the scope's wired values exactly as it
holds `data-variant`. Zero itself needed no change: `axes` already reached
the DOM. Unset, each skin keeps its own avatar radius.

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
  layout attributes name theirs as `layout`; a part that re-carries a named
  axis beside the scope's carrier names it in `carries`; a part whose job
  is paint rather than text (a check, a thumb, a dot) declares `paint` — and `toJSON()`
  emits exactly the shape zero's own `manifest.json` carries per component.
  States are governed: every value must be a member of `STATE_VOCABULARY`
  (with `STATE_SYNONYMS` naming the member for a rejected spelling), flags of
  `FLAG_VOCABULARY`, placements of `PLACEMENT_VOCABULARY`, layout attributes
  of `LAYOUT_VOCABULARY` — and
  `mergeManifests` enforces all four on published fragments, so an ecosystem
  scope cannot invent synonyms either. Work in flight (a job, tool call or
  deploy) has its own family, lifecycle: `running|paused|denied|cancelled`,
  alongside `loading` for the wait before it starts and `complete|error`
  for the outcome. A sortable table column has the sort family,
  `ascending|descending|none` — `aria-sort`'s own spellings (`asc`, `desc`
  and `unsorted` are the rejected synonyms). `FRAGMENT_VERSION` is the version a
  fragment declares — here so a package's `./fragment` entry can read it at
  runtime without the kit, which is only its devDependency.
- `@sigx/zero/behaviors` — controllable state, SSR-safe ids (`createId`, plus
  `idToken(value: string)` to put a user-supplied string inside an id —
  injective over strings, so distinct values never share an id: whitespace
  would split the IDREFS that point at it, so build both the `id` and every
  `aria-*` reference with it), roving tabindex,
  dismissal, focus management (`createFocusRestore`, `focusFirst`,
  `getTabbables`, `isFocusable`: tabbable detection skips anything
  disabled — a disabled `<fieldset>` included, bar its first legend —
  inert, hidden or unrendered, and a radio group is one stop;
  `createFocusRestore(isOpen, { getSurface, fallback, skip })` hands focus back
  on close only while it is still on the surface or on nothing (and never
  when `skip()` answers true — a close that sent focus onward on purpose, like
  Menu's Tab), and falls back — to the trigger, in Popover, Menu, Dialog and Drawer — when the
  element focused before opening can no longer take it), list/tree registration with listbox-highlight stepping
  (`moveHighlight`, `optionText`), typeahead (`createTypeahead`: a
  multi-character search refines the current match instead of stepping past
  it, and its `searching()` tells a caller that routes Space to activation to
  hand Space to a running search, so "Save As" is reachable), anchor
  positioning (`createAnchorPosition` over a pluggable `PositionStrategy`;
  the built-in `fixedPositionStrategy` flips on the main axis only — a
  `bottom-start` menu in the bottom-right corner flips to `top-start` and
  shifts left — aligns `-start`/`-end` above or below to the reading
  direction and puts bare `start`/`end` on the inline-start/-end side,
  keeps `collisionPadding` (default 8) off the viewport edges, offsets an
  aligned popup by `alignOffset`, publishes the logical placement as
  `data-placement` and the `POSITION_PROPERTIES` geometry
  (`--anchor-*`, `--available-*`, `--transform-origin`), points an arrow
  element (`getArrow`, clamped by `arrowPadding`) at the anchor through
  `ARROW_PROPERTIES` (`--arrow-x`/`--arrow-y`), and re-measures on
  scroll, resize and a `ResizeObserver` over the popup and the anchor
  element; a virtual anchor may name a `contextElement`, which is observed
  and read the direction from), press feedback, the form contract (`createFormControl`, `onFormReset`), and the
  listbox layer: `createCollection` (items as data — `itemKey` /
  `itemLabel` / `itemValue` / `itemDisabled` / `itemGroup`, with JSX items
  registering into the same list; an optional `mode` getter decides data vs
  JSX reactively), `createListbox` (visibility with a
  default contains-filter, single/multiple selection over the model,
  highlight stepping, typeahead over the visible labels with
  `typeaheadSearching()`, id-safe option ids),
  `createListboxItem` (the `role="option"` bag), `createGroupPresence`,
  `syncPopover` (returns its stopper), `useMediaQuery`, `createVirtualList`
  for windowing, and `mountScope` — call it during setup and run a mount
  hook's reactive work through it (`onMounted(() => scoped(() => { effect(…) }))`)
  so effects created after setup still stop on unmount. sigx only owns the
  effects a component creates *during* setup; one created inside `onMounted`
  would otherwise outlive the part (#163).
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
  declared part tree, `hidden` exactly where `hiddenIn` says, and
  `data-color`/`data-size`/`data-variant` only on the carrier or a part that
  declares it `carries` that axis. It throws a
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
- A part's `carries` lists the named axes it RE-CARRIES (#94): it takes the
  axis as a prop of its own and renders the attribute on itself, beside the
  scope's carrier — `timeline.marker` carries `color`, so
  `<Timeline.Marker color="error">` paints one entry's dot while
  `<Timeline.Root color="neutral">` paints the rest; `steps.item` carries
  `color` too (#112), so `<Steps.Item color="error">` paints one step's
  disc, bridge and title; and `stats.item` (#161), so `<Stats.Item
  color="warning">` paints one figure in a row. The nearest carrier wins: a design system's
  compiled CSS lets the part's own value outrank the carrier's, and a part
  without one follows the carrier.
- A part's `paint` says its job is PAINT rather than text (#31) — a check,
  a thumb, a range, a dot, a spinner, the rating star. The contrast audit
  measures every declared paint part against the 3:1 non-text floor, in
  every state, inside its real ancestor chain. `paint: true` when nothing
  more is needed; otherwise `{ glyph?, only?, host? }`: the default mark
  zero renders without children (`select.indicator` → `▾`), the flag the
  part cannot exist without (`select.item-indicator` only mounts
  `selected`), and the part the mark is measured on when `parent` names
  only the containing one (`menu.item-indicator` → `checkbox-item`). An
  ecosystem component declares its own marks the same way.
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
