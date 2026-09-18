# Changelog

## [Unreleased]

### Added — a `measure` token category, and Container (#484)

- **`--measure-*`** joins `TOKEN_CATEGORIES`: page-scale widths, recommended
  keys `xs`…`xl` plus `prose`, with fallbacks in `css/base.css`. The density
  ramp could not reach these — `--space-*` tops out around `1.5rem` and
  `--size-*` is the base unit control sizing multiplies — so a Container had
  nothing to resolve against.

  A category rather than a default baked into the layout pack, because how
  wide a page runs is IDENTITY. One shared number would have made every
  skin's pages the same width, which is the leak the layout tier exists to
  close. All six skins declare their own, and they disagree.

- **`Container`** — bounds the page width and keeps content off the edges.
  `measure` is a layout attribute, not the `size` axis: `size="lg"` means a
  chunkier Button and would mean a wider page, and those ramps have no reason
  to move together; `prose` is not a size at all. `full` compiles to `none`
  rather than `100%`, since a container told not to bound itself should have
  no maximum. Unbounded by default, and carries no colour — a container is a
  constraint, not a surface.

### Added — the layout tier: Box (#485)

- **`Box`** — a padded surface tinted by meaning, and the tier's one scope
  that paints. Card is the structured sibling; Box is the unstructured one.
  It follows Card's axis answer rather than inventing a second: `color` is
  wired, `variant` is not (recorded in the `NO_VARIANT` ledger — no surveyed
  system varies a plain surface's chrome, and the ones that do call it a
  Card).
- `size` is declared out of existence, the one place Box departs from Card:
  a Box's size IS its padding, and `pad` already says that. One fact, one
  spelling.
- The tint is the role's `-soft` derivation and the ink is the role itself,
  not `-content`: a panel is a large area of colour, and a large area of
  `--color-error` is a warning label rather than a container. `-content` is
  the ink for the solid fill.

`Container` is deliberately NOT here — it needs a page-scale length the token
contract has no category for, which is #484.

### Added — the layout tier: Grid and Center (#478)

- **`Grid`**, with **`Grid.Cell`**. `cols` is a twelve-column count or
  `auto`; `auto` reflows by available width with no breakpoint named at all,
  which is what a collection of cards wants, and `track` sets how narrow a
  column may get first. `Cell` carries `span` (a count, or `full`) and
  supports `asChild`, because `grid-column` is a property of the grid ITEM —
  a wrapper cannot make the child span.
- **`Center`** — `place-items` on a single-child grid, the one construction
  that centres on both axes without caring what the child is. `axis` is
  `both` / `inline` / `block`, logical, and the one-axis values pin the other
  to `stretch` so `axis="inline"` does not also collapse the child.

Neither carries `color`, `size` or `variant`, so both take the uniform
`layoutScopes` waiver and neither touches the axis-coverage ledgers. This
phase adds no new mechanism — only vocabulary on the table #473 built.

### Added — the layout tier begins: Stack and Spacer (#473)

- **`Stack`**, with **`Row`** and **`Col`** presets. One scope, one recipe,
  one manifest entry: the presets are the same `stack` with a different
  default `data-orientation`, not separate components. Spacing props take a
  rung of the design system's `--space-*` ramp — `gap`, `gapX`, `gapY`,
  `pad`, `padX`, `padY` — alongside `align`, `justify` and `wrap`. `gap`,
  `pad`, `align` and `justify` also accept a breakpoint record
  (`gap={{ base: 'sm', md: 'lg' }}`).
- **`Stack.Item`** with `grow`, and `asChild` for Join's reason: `flex-grow`
  applies to the flex ITEM, so a wrapper cannot grow the control inside it.
- **`Spacer`** — flexible room by default, a fixed rung when given `space`.
  `aria-hidden`, because it holds room rather than content.

Neither carries `color`, `size` or `variant`: a Stack is geometry, and
`data-color` on it would paint nothing.

The spacing values are closed to the ramp on purpose — an app cannot write
`gap: 13px`, which is what lets a `[data-density="compact"]` redefinition of
`--space-*` re-space every layout at once (#470).

### Added — the layout attribute family (#471)

- **`LAYOUT_VOCABULARY`** (`contract/layout-attrs.ts`) closes a fifteen-attribute
  set — `gap`/`gap-x`/`gap-y`, `pad`/`pad-x`/`pad-y`, `align`, `justify`,
  `wrap`, `cols`, `span`, `track`, `grow`, `axis`, `space` — each with its own
  closed value list and a flag for whether it varies per breakpoint. Spacing
  values are the `--space-*` ramp plus `none`, so a layout prop cannot spell a
  gap the design system has no token for.
- **`PartSpec.layout`** declares which attributes a part may carry, governed
  and checked exactly like `placements`. `expectAnatomy` now accepts declared
  layout attributes (it previously rejected every undeclared `data-*`) and
  fails an undeclared one, an unknown value, or a name under the prefix the
  vocabulary does not know — the last of which used to surface as a baffling
  "undeclared flag \"l-gap\"".
- **`layoutAttrs(props, spec)`** (`contract/layout-attrs.ts`, `lib.dom`-free
  like `variant-attrs.ts`) renders the attributes, expanding the responsive
  record form. It throws rather than drops on an undeclared attribute, an
  out-of-set value, or a record given to a non-responsive attribute — a
  silently missing attribute being the failure this whole mechanism removes.
- **`Responsive<T>`** and **`ZeroBreakpointName`**, the CLOSED breakpoint
  union — the authoring twin of the open `ZeroBreakpoint`, standing in the
  same relation to it as `ZeroThemeName` does to `ZeroThemeNameOrCustom`.
  With a design system's `/register` imported, `gap={{ mdd: 'lg' }}` is a
  compile error instead of an attribute that matches nothing.
- **`data-l-` prefix, breakpoint in prefix position** (`data-l-md-gap="lg"`).
  The prefix keeps fifteen ordinary words out of `RESERVED_AXES`, so a design
  system may still declare an axis called `align` or `track`; prefix position
  is what keeps the multi-word attributes (`data-l-gap-x`) unambiguous against
  an open set of breakpoint names.
- **Class grammar version 2**: `layoutClass(attr, value)` → `zx-l-<attr>-<value>`.
- The manifest's `attributeSpec` gains `layoutPrefix` and `layoutVocabulary`,
  and each part its `layout`.

No components carry layout attributes yet — the layout tier's own scopes land
in follow-ups. This is the contract they need.

### Changed — the remaining value shapes, and the last two bound controls (#455, part of #438)

- **Breaking: ToggleGroup's model follows `multiple`.** Single mode holds
  the pressed value as a `string` (`''` when none); `multiple` holds a
  `string[]` — Select's rule, typed through the overload cast so a string
  signal binds a single-select group and an array a multiple one. Was always
  `string[]`. Its `ModelSpec` is `{ concept: 'value', type: 'string', multiple: true }`.
- **Added: RadioGroup `items`** — `itemKey` (the posted value; defaults
  `value` / `id` / the primitive), `itemLabel`, `itemDisabled` and the
  `item` slot, over the collection's accessors; `T` infers from `items`
  through `RadioGroupRoot`; the model stays the posted string. Explicit
  children win entirely. An item keyed `''` is refused.
- **Slider.Control and NumberInput.Input bind with `model=`.** The range
  binds a derived scalar Model (write → `setValueAt(0, …)`, so quantizing
  and clamping hold for the platform's write; `modelModifiers={{ number }}`
  hands it a number), the number input binds a derived draft Model (write
  → the draft; commit unchanged). The binding law's exemptions are now
  exactly Slider's range projection and FileUpload's `FileList`.
- **Added: `derivedModel(read, write)`** in `@sigx/zero/behaviors` — a
  Model over a read/write pair, the mechanism under both and under
  `createControllableState` itself.

### Changed — the naming rule for models, and a `ModelSpec` in the anatomy (#451, part of #438)

- **The naming rule is law.** Every model has a concept `N` and exactly two
  companions, `default<N>` and `<n>Change`; a named model's concept is its
  name. Five outliers now follow it — **Breaking:**
  - Swap: `defaultOn` → `defaultActive`, the `change` event → `activeChange`
    (handler `onActiveChange`); the faces keep `data-state on|off`.
  - TreeView: `expandedChange` → `expandedValuesChange`.
  - NumberInput: `defaultValue` is `number | null`, the model's type (`null`
    is an explicit empty seed).
- **Added:** `defaultFiles` on FileUpload (the seed, and what a form reset
  restores); `defaultOpen` on Tooltip, Menu.Root and Menu.Sub.
- **`ModelSpec` in the anatomy.** `defineAnatomy(scope, parts, { models })`
  declares each model the API carries — `name` (the `model:<name>` key,
  absent for the unnamed `model`), `concept`, `type`, `member` (the compound
  member when not Root), `multiple`, `formControl` — and `toJSON()` emits
  `models` into `manifest.json` with the companions `default` and `change`
  DERIVED from the concept (`defaultPropOf` / `changeEventOf` are exported).
  A parity test holds every component source to its anatomy, both ways, and
  a type test holds each seed's type and change payload to the model's value
  type. `MenuSubProps` / `MenuSubTriggerProps` / `MenuSubPopupProps` are
  exported from the barrel.

### Changed — Select and Combobox over the collection core (#445, part of #438)

- **Breaking:** `options` is `items`, and the roots are typed generic at the
  JSX level: `T` infers from `items`; the model holds the item unless
  `itemValue` says what it holds (a `{ value, label }` list with a string
  model now takes `itemValue={(o) => o.value}`), typed `T | null` /
  `V | null` since nothing selected is `null` for a data-driven root;
  `multiple` makes it an array. `itemKey` / `itemLabel` / `itemDisabled` / `itemGroup` are the
  accessors; the `item` slot customises a generated option. Labels resolve
  from data before anything mounts.
- **Breaking:** Combobox with `items` filters by default (contains-match on
  the label); `filter` replaces the rule, `filter={false}` opts out.
  Hand-written items stay consumer-filtered. `Combobox.Empty` renders only
  while the visible list is empty; `emptyText` renders it from the data
  expansion. Under `multiple` a selection toggles, clears the query and keeps
  the popup open.
- Select gains `model:open` + `defaultOpen` (closes #104) and `multiple`
  (the hidden `<select>` is `multiple`, `Value` joins the labels, the popup
  is `aria-multiselectable`). The hidden select carries every item as an
  option in data mode.
- **Breaking:** `NativeSelect` is removed (decision in #438: one Select; the
  real hidden `<select>` is the form control). `segmentOptions` /
  `OptionInput` are removed with the `options` sugar (`segmentBy` on the
  collection is the walk).
- Select.tsx and Combobox.tsx are thin shells over `createCollection` /
  `createListbox` / `createListboxItem` / `createGroupPresence` /
  `syncPopover`: the 426 duplicated lines are gone.

### Added — the collection and listbox core (#443, part of #438)

- `createCollection` (`@sigx/zero/behaviors`, DOM-free): items as data with
  two identities kept apart — the KEY (`itemKey`: DOM id, typeahead target,
  posted value) and the VALUE (`itemValue`: what the model holds, default the
  item) — plus `itemLabel`, `itemDisabled`, `itemGroup`; labels, values and
  groups resolve before anything mounts; JSX-written items register into
  the same list. `segmentBy` is the grouping walk (`segmentOptions` was an
  alias over it until the `options` sugar went, above).
- `createListboxCore` / `createListbox`: visibility (default contains-match
  on the label, a custom `filter`, or `filter: false`), single and
  `multiple` selection over a model, highlight stepping over enabled
  visible keys, `pruneHighlight`, option ids and `activeDescendant`,
  `displayText()`, typeahead over the visible labels, scroll-into-view.
- `createListboxItem` (the `role="option"` bag and both registrations),
  `createGroupPresence` + `announceGroupLabel` (the presence-tracked group
  label), `syncPopover` (the native popover ↔ model effect).
- `JsxProps` and `FactoryBrands` (`@sigx/zero/contract`): the typed cast that
  makes a root generic at the JSX level, pinned by a type test.

### Changed — the form contract (#441, part of #438)

- One form-participation regime for every posting control: `createFormControl`
  (Field adoption, ids, `flags()`, `hiddenAttrs()`) and
  `onFormReset` in `@sigx/zero/behaviors`, `VISUALLY_HIDDEN_STYLE` beside
  them, and the `WithName`/`WithForm`/`WithInvalid`/`WithRequired`/
  `WithReadonly`/`WithFormControl` prop fragments in the contract. Every
  posting control gains `form`; `Field.Root` gains `readonly` and controls
  adopt it like the other three flags.
- A hidden control renders only while `name` is set and carries `disabled`
  and `form` — a disabled Select, Combobox or range Slider no longer posts.
- **Breaking:** Select and Combobox post through a real, visually-hidden
  `<select>` (`hidden-input` is now `element: 'select'`): `required` is a
  platform constraint, the invalid focus lands on the trigger/input, and a
  form `reset()` restores the default. Anything that selected
  `input[type=hidden]` inside them selects `select[data-part=hidden-input]`.
- The owning form's `reset()` restores every control's component default
  into the model and the DOM (sigx sets `value`/`checked` as properties, so
  the platform's own reset landed on the empty attribute default before).

### Changed — the binding law (#439, part of #438)

- `createControllableState` returns a real sigx `Model<T>` (built on a
  holder whose setter is the model's own handler, so a processor's direct
  tuple write and the handler are one write path). `ControllableState<T>` is
  now an alias of `Model<T>`; hand-written `{ get value, set value }`
  literals no longer type — use the new `createInertState(initial)`.
  `namedModel()` collapses the named-model type distribution.
- Input, Textarea, Checkbox, Switch, RadioGroup and NativeSelect bind their
  native control with `model=` instead of hand-wired `value=`/`onInput` and
  `checked=`/`onChange` pairs. Consequences: `modelModifiers` (`trim`,
  `number`, `lazy`, `debounce`, custom) work through `Input.Root` and
  `Textarea.Root` (new `WithModelModifiers` prop fragment; transforms apply
  once at the boundary, timing is forwarded to the element by the new
  `timingModifiers()`), and `Checkbox.Root`'s model widens to
  `boolean | string[]` — sigx's array mode.
- Breaking for ecosystem components that built an inert context by hand:
  replace the literal with `createInertState`.

## [0.2.0-beta.6] - 2026-08-22

No changes — lockstep version bump.

## [0.2.0-beta.5] - 2026-08-21

No changes — lockstep version bump.

## [0.2.0-beta.4] - 2026-08-21

No changes — lockstep version bump.

## [0.2.0-beta.3] - 2026-08-21

No changes to this package's code — lockstep version bump. Published
metadata only: `repository`/`bugs` URLs point at `andtii/zero-wip` (#374).

## [0.2.0-beta.2] - 2026-08-15

No changes — lockstep version bump.

## [0.2.0-beta.1] - 2026-08-13

### Added

- **Lynx target groundwork** (#346): the contract now projects onto
  platforms without attribute selectors.

  - **Class grammar** (`contract/class-names.ts`, exported from
    `@sigx/zero/contract`): `partClass('tabs', 'tab')` → `zx-tabs__tab`,
    `zx-s-<state>`, `zx-f-<flag>`, `zx-a-<axis>-<value>`, `zx-m-<mod>`,
    `zx-o-<orientation>`, `zx-p-<placement>`, `zx-theme-<name>`, `zx-root`
    (the token host), stamped `CLASS_GRAMMAR_VERSION = 1`. Axis rules follow
    the push-down rule: the runtime stamps axis/modifier classes on every
    part from carrier context, so a non-web emitter never needs a
    combinator (or the `:not()` default twins) for them.
  - **`@sigx/zero/contract/core`** — the DOM-free contract surface
    (vocabularies, token contract, anatomy machinery, `variantAttrs`, the
    class grammar) as a real export subpath, so the portable gate covers
    the entrypoint consumers resolve.
  - **`@sigx/zero/behaviors/core`** — the platform-neutral behavior subset
    (controllable state, ids, field context, options, list controller). The
    list controller's element type is now structurally open
    (`ItemElement`, two members) in `list-core.ts`; `@sigx/zero/behaviors`
    re-exports it pinned to `HTMLElement` — no web import site changes.
  - **`@sigx/zero/theme/registry`** — the theme-metadata registry as its
    own DOM-free subpath.
  - **`expectAnatomyElements` + `ElementLike`** (`@sigx/zero/testing`):
    the anatomy-oracle rules extracted over a three-member element shape;
    `expectAnatomy(container, …)` is now the DOM wrapper over them, so a
    non-DOM test renderer holds components to the identical contract.
  - `synthesizesClickFrom` reads `tagName` duck-typed instead of
    `instanceof HTMLElement` — the contract's one runtime DOM binding gone.
  - New `portable` type-test project compiles the whole portable surface
    under `lib: ["es2022"]` (no DOM lib), gating regressions here rather
    than in a downstream platform's build.

- **The navigation tier** (#339): Drawer, Navbar, Breadcrumbs, Pagination
  and Steps — the behavior tier's navigation half, each shipped with
  recipes in all six design systems:

  - **Drawer**: `Root(model=open, modal, dismissible, placement, label)`/
    `Trigger`/`Panel`/`Title`/`Close` — the edge panel on the native
    `<dialog>`, Dialog's machinery inherited deliberately (top layer,
    scrim with the geometric backdrop test, Escape via `cancel` routed
    through the model, native focus restore, the `::backdrop` pseudo part,
    presence-tracked labelling — with the `label` prop as the `aria-label`
    fallback, since a navigation drawer often has no visible heading).
    What is Drawer's own is the EDGE: the panel stamps
    `data-placement="start|end"` from the logical pair (an edge panel
    anchors to the reading direction), recipes pin it with
    `inset-inline-*` so RTL mirrors free, and modal-vs-inline needs no
    attribute — `:modal` is the platform's own spelling of the split.
    `modal={false}` is the INLINE mode: in flow via `show()`, no dismiss
    trap, Escape through the dismissable behavior, focus restore covered
    by zero since `show()` provides neither. Real-browser contract in
    `e2e/drawer.spec.ts` (edges measured as boxes, scrim geometry, both
    Escape paths, labelling).

  - **Navbar**: `Root`/`Start`/`Center`/`End` — the landmark header bar,
    pure composition (no states, no behavior). The root is a `<header>`
    (the banner landmark at document scope), deliberately NOT a `<nav>`:
    a bar holds branding, search and actions too, so wrapping all of it in
    a navigation landmark would mislabel most of it — the consumer puts a
    labelled `<nav>` around exactly the link set, inside a section.
    `start`/`end` are the logical pair, so RTL mirrors free.
  - **Breadcrumbs**: `Root(label)`/`List`/`Item`/`Link(current, asChild)`/
    `Separator` — the APG breadcrumb pattern: a `<nav>` named "Breadcrumb"
    around an `<ol>` (order is the meaning). The current page is a STATE,
    not a new flag: `data-current` is not in `FLAG_VOCABULARY` and the
    synonym table rules `current → active`, so the current link carries
    `aria-current="page"` + `data-state="active"` and every other link
    `"inactive"` — exactly tabs' shape. The separator is `aria-hidden`
    punctuation inside the item (default `/`, replaceable slot), keeping
    the `<ol>` to `<li>` children only.
  - **Pagination**: `Root(model=page, count, siblingCount, boundaryCount,
    label, prevLabel/nextLabel)` — options-driven: the row derives from
    `count` and the model, so zero renders the page buttons, aria-hidden
    ellipses and the `‹`/`›` triggers itself, with constant-width
    windowing (the sibling block slides near the edges instead of
    shrinking). The current item carries `aria-current="page"` +
    `data-state="active"`; the triggers disable at the bounds. Ordinary
    buttons in a labelled `<nav>` — deliberately no roving tabindex (there
    is no APG pagination pattern; each page is its own meaningful tab
    stop) and no `<ul>` (the windowed row is controls, not content —
    contrast Breadcrumbs, where the trail is content and order the
    meaning). All three interactive parts publish press feedback.
  - **Steps**: `Root(model=step, defaultStep, loop, label, orientation)`/
    `Item(value, asChild)`/`Indicator`/`Separator`/`Title`/`Description` —
    the wizard step rail, promoted from the ecosystem `ext-stepper`
    pattern into a first-class scope (`@sigx/zero-ext-example` REMAINS as
    the ecosystem acceptance test with its own scope; the behavior — arrow
    keys rove without selecting, one tab stop on the active step,
    `complete` derived from DOM order — is the pattern verbatim). What the
    promotion adds is the rail's paintable anatomy: the numbered
    `indicator` disc mirroring its item's phase, the `separator` line
    carrying only the walked pair (`complete` once its OWN item is
    complete — an active item's separator is a line the walk has reached,
    not crossed), and the `title`/`description` bands (stateless — style
    them through the item's state). Orientation-aware roving.
  - Promoting Steps surfaced a real ordering bug, fixed at the source:
    `sortByDomOrder` (the shared list-registration order) trusted
    `compareDocumentPosition` between elements that were created but not
    yet CONNECTED, where the answer is implementation-defined — Steps'
    indicator was the first reader to derive state in that window.
    Disconnected elements now take the registration-order fallback exactly
    like absent ones.
- **The behavior-tier data & misc sweep** (#340), each scope shipped with
  recipes in all six design systems:

  - **Table**: semantic data table over the REAL table elements —
    `Root`/`Table`/`Caption`/`Head`/`Body`/`Foot`/`Row`/`HeaderCell`/`Cell`
    rendering `div > table > caption/thead/tbody/tfoot/tr/th/td`. The root
    is the SCROLL CONTAINER: a `<table>` cannot be its own overflow box, so
    the wrapper is anatomy, carries the axes, and recipes give it
    `overflow-x: auto`. No states (a table has no machine lifecycle); a row
    can carry the shared `data-selected` flag (`selected` prop). Zebra
    striping and hover-highlight are design-system MODS — per-instance
    styling choices from each skin's own vocabulary (`zebra`/`hover` in
    four skins, HeroUI's `isStriped`, Carbon's `useZebraStyles` through the
    api's modifier rename), never anatomy. Sorting is deliberately out
    (follow-up): `HeaderCell` renders the `<th>` that will carry
    `aria-sort`, so the anatomy is ready without dead parts. Write a
    `Caption` — it is the table's accessible name.
  - **FileUpload**: a `File[]` model over a REAL `<input type="file">` —
    `Root`/`Label`/`Trigger`/`Input`/`Dropzone`/`ItemGroup`/`Item(file)`/
    `ItemName`/`ItemSize`/`ItemRemove`. The input IS the control (it holds
    `name`/`accept`/`multiple`/`required` and posts natively), visually
    hidden and out of the tab order; the TRIGGER is the one keyboard path
    to the picker, and the DROPZONE is a pointer affordance only — never
    focusable, no role, because APG defines no drop-target pattern and a
    focusable dropzone would duplicate the trigger. Drag-over is the shared
    `highlighted` FLAG (on dropzone and root), not a new state — the
    vocabulary already had the word. `multiple` appends across selections
    (dedupe by name+size+lastModified), single replaces, drops are filtered
    by `accept` so both ingestion paths agree, and the input's own FileList
    is re-synced through `DataTransfer` best-effort. Field-context aware
    exactly like Input; `ItemRemove` announces "Remove <name>". Exposes
    `acceptsFile` and `formatBytes`.
  - **Carousel**: a scroll-snap viewport whose MODEL IS THE ACTIVE INDEX —
    `Root(label required)`/`Viewport`/`Item`/`PrevTrigger`/`NextTrigger`/
    `IndicatorGroup`/`Indicator(index)`. The index is derived from real
    scroll by an IntersectionObserver (created in `onMounted`, so SSR never
    observes) and driven back by `scrollIntoView` on model set — smooth,
    collapsing to a jump under `prefers-reduced-motion`. APG carousel
    ARIA (labelled region, "slide" groups labelled "n of m"); prev/next
    clamp and disable at the bounds (no wrap); the dots are labelled
    buttons — not tabs, no roving tabindex — with `aria-current` on the
    active one. The dot is a paint part graded by the contrast audit's
    indicator matrix in both states. Real-scroll behavior is pinned by
    `e2e/carousel.spec.ts`.

- **The content-tier sweep** (#334): the cheap 60% of the coverage gap
  against `@sigx/daisyui` — components that are anatomy plus recipes with
  little or no behavior, each shipped with recipes in all six design
  systems:

  - **Kbd**: one part on a semantic `<kbd>` — the element is the meaning, so
    there is no `asChild`. No states; `size` is the axis that matters and
    `color` rides the uniform carrier surface.
  - **Status**: an empty presence dot the design system paints, with NO
    states on purpose — online/busy/degraded are colours of one resting
    render (the `color` axis), not a machine lifecycle. `aria-hidden`
    without a `label`; `role="img"` with one (`role="status"` is a live
    region and was rejected for a static mark). Joins the contrast audit's
    indicator matrix beside Spinner: pure paint answers the 3:1 non-text
    floor.
  - **Indicator**: `Root`/`Item(placement)` — anchors a floating item to a
    corner or edge of whatever `Root` wraps. `Item` stamps `data-placement`
    from a declared eight-slot subset, all spelled LOGICALLY — which is what
    added the bare `start`/`end` pair to `PLACEMENT_VOCABULARY`: `left`
    names a physical side of the glass (where a flipped popup really
    landed), `start` names the reading edge, and an indicator anchors to
    the reading direction. Recipes position with `inset-inline-*`, so RTL
    mirrors for free.
  - **Stats**: `Root(orientation)`/`Item`/`Title`/`Value`/`Desc`/`Figure` —
    Card's cousin, a pure styling container for figures with labels. Both
    root and item carry `data-orientation`, because the between-item
    divider is directional CSS on the item and a sibling selector cannot
    see the root (the toggle-group precedent). Every band below `Item` is
    optional.
  - **Timeline**: `Root(orientation, default vertical)`/`Item`/`Marker`/
    `Connector`/`Content(placement)` on a real `<ul>`/`<li>` list. Flatter
    than daisy's start/middle/end triple: one marker (a paint part — the
    contrast audit's indicator matrix grades it inside its `root > item`
    chain), one connector (the segment toward the next item, `aria-hidden`
    like the marker), and one content box that declares its SIDE of the
    axis as `data-placement="start|end"` — the logical pair, so alternating
    layouts are per-item markup and RTL mirrors free.
  - **Chat**: `Root(placement start|end)`/`Avatar`/`Header`/`Bubble`/
    `Footer` — one message row, pure content. `start` (the reading edge) is
    the other party, `end` is you; logical, so a transcript mirrors under
    RTL without touching the rows. The colour axis rides the row and every
    skin wires it to the bubble's fill through the part tree.
  - **RadialProgress**: circular progress as its own scope —
    `Root(value|null, min, max)`/`Label`/`ValueText`. A radial has no
    track/range geometry (the ring is one painted layer on the root), so it
    does not reuse progress's anatomy; what it DOES share is the value
    model verbatim, including the same `--progress-percent` custom
    property, `role="progressbar"` semantics and the
    `loading|complete|indeterminate` states. Recipes paint the arc as a
    background-colour ink under conic-gradient masks — measurable by the
    contrast audit's indicator matrix, where the root is opted in beside
    Spinner — and stop the indeterminate loop under reduced motion.
  - **Join**: `Root(orientation)`/`Item(asChild)` — pure radius-collapsing
    composition: two attribute carriers, every visual fact the design
    system's (corner rules on first/last, seam margins between). No
    `role="group"`, considered and cut — a join is VISUAL grouping, and a
    consumer who means toolbar/group writes the role. `asChild` is the
    honest joint: a wrapper cannot collapse the radius of the control
    inside it, so the control itself carries the item attributes.

- **The sugar tier** (#333) — the one-liner DX the old `@sigx/daisyui`
  library had and zero's compound anatomy made verbose:

  - **`options` on `Select.Root` and `Combobox.Root`**:
    `options?: ReadonlyArray<{ value; label?; disabled?; group? }>`. With no
    slot children the Root renders its full default composition through the
    EXISTING anatomy — Select expands to `Trigger(Value, Indicator)` +
    `Popup`, Combobox to `Control(Input, Trigger)` + `Popup`, each with an
    `Item` per entry and a `Group`/`GroupLabel` per distinct `group` in
    first-appearance order (later members fold back into their group);
    `label` defaults to `value`. Precedence is total: explicit slot children
    win entirely — never merged — so a custom trigger means hand-writing the
    popup too. For Combobox this is rendering sugar only: filtering stays
    the consumer's (bind `model:inputValue`, pass a narrowed array). The
    generated trigger/input carry no `aria-label`; name an options-driven
    instance through a `Field`. The grouping walk is shared
    (`segmentOptions` in `@sigx/zero/behaviors`), so the components cannot
    drift on its semantics.

  - **`NativeSelect`** (`@sigx/zero/native-select`, scope `native-select`):
    a real `<select>` in zero anatomy — `root` (span wrapper, the axis
    carrier) > `control` (the `<select>` itself) + `indicator` (the
    recipe-drawn replacement chevron, `aria-hidden`). The platform owns the
    popup, the keyboard and the a11y tree; recipes own the well
    (`appearance: none`). Takes the same `options` array (`group` → a real
    `<optgroup>`, first-appearance order; hand-written `<option>` children
    win entirely), a string `model` (SSR posts through `selected` on the
    generated options, since a `<select>`'s value attribute means nothing
    before its options exist), and a `placeholder` rendered as the
    conventional disabled empty option, driving a `data-placeholder` flag
    while the value is empty. Without a placeholder, "nothing chosen" is not
    representable — a `<select>` with no empty option always has a value, so
    an empty model is coerced to the control's actual value on mount and the
    model matches what the form would post. No `data-state` anywhere — the popup never
    exists in this DOM — and no hidden input: the visible element IS the
    form control and carries `name`. Field-context aware exactly like Input
    (control id, flags, `aria-describedby`). All six design systems ship
    recipes, each on its own field idiom (basic/daisyui/material/brutalist
    wire `color` + `size`; heroui and carbon, declaring no colour roles,
    wire their own size ramps only), and the chevron joins the indicator
    contrast matrix — proven red-first by painting it paper-on-paper and
    watching the audit fail at 1:1 before reverting.

  - **The loading-button pattern**, documented (README "Patterns") and
    demoed rather than shipped as API: Button stays behavior-free — compose
    `disabled` with `mods={{ loading: true }}` and let a design system that
    declares the `loading` modifier (`@sigx/zero-daisyui`'s recipe-drawn
    ring, #332) draw the spinner off `[data-mod-loading]` in pure CSS. Pass
    the mod only when the active vocabulary declares it; the composition
    degrades to a plain disabled button under a design system that doesn't.

- **Component-surface completions** (#325). The peer-parity gaps every
  comparable library (Radix/Ark/Zag) covers, closed in one wave:

  - **Menu stateful items**: `Menu.CheckboxItem` (per-item boolean model,
    `role="menuitemcheckbox"`, `aria-checked`, `data-state`
    checked|unchecked) and `Menu.RadioGroup`/`Menu.RadioItem` (one string
    model on the group, `role="menuitemradio"`). Both participate in the
    existing roving/typeahead list, emit the root's `select` alongside their
    own model events, and keep the menu OPEN on toggle by default — a
    per-item `closeOnSelect` opts back into closing. Each auto-renders an
    `item-indicator` part mirroring its checked state (the radio-group
    idiom) for the design system's mark. `Menu.RadioGroup` renders the same
    labelled `group` part `Menu.Group` does, so `Menu.GroupLabel` works
    inside unchanged.
  - **AlertDialog** as a preset, not a new scope: `Dialog.Root` takes
    `role="alertdialog"` — the popup announces as `alertdialog`, a backdrop
    click never dismisses (Escape stays live under `dismissible`), and
    initial focus goes to the least-destructive action: the new
    `Dialog.Cancel` part, a close button that carries `autofocus` in
    alertdialog mode so `showModal()`'s own focusing steps implement APG's
    initial-focus rule.
  - **Slider range/multi-thumb**: `model` accepts `number | number[]`. A
    scalar model keeps the native `<input type=range>` unchanged; an array
    model composes the real `Slider.Track`/`Slider.Range`/`Slider.Thumb`
    parts — one APG `role="slider"` tab stop per value (indexed by
    registration order; `index` pins), keyboard per APG on the focused
    thumb (RTL-aware; Home/End go to the thumb's ALLOWED bounds), thumbs
    clamp at their neighbors and announce the clamp as
    `aria-valuemin`/`aria-valuemax`, `aria-valuetext` from
    `getValueText(value, index)`, per-thumb `label`. Track presses move the
    nearest thumb and start a drag; `Slider.Range` spans lowest→highest; a
    `marks` prop renders positioned `mark` tick parts; a range model posts
    one hidden input per value under the shared `name`. Zero positions the
    moving parts structurally (logical `inset-inline-start` percents — RTL
    mirrors for free) and paints nothing.
  - **Select and Combobox option groups**: `Group` + `GroupLabel` parts —
    `role="group"` inside the listbox, named by its label through the same
    presence-tracked `aria-labelledby` `Menu.Group` uses. Labels never
    register as options, so typeahead and the highlight walk straight
    through; flat usage is unchanged.

  All new parts are declared in their anatomies (parent, closed states from
  `STATE_VOCABULARY`, flags from `FLAG_VOCABULARY`) and styled by all six
  in-repo design systems.
- **Verification-depth fixes** (#326), found by the new playground-wide axe
  audit and overlay e2e specs:

  - `Select.Trigger` gains a `label` prop (`aria-label`) — `role="combobox"`
    prohibits name-from-content, so a Select outside a Field had no way to
    get an accessible name at all.
  - `Menu.ContextTrigger` no longer states `aria-expanded`: it is a widget
    state, invalid on the role-less surface (`generic`). The
    `aria-haspopup`/`aria-controls` globals stay; open/closed stays on
    `data-state`.
  - TreeView typeahead matches a branch's *accessible* text — the default
    `BranchIndicator` glyph (`›`) led `textContent`, so no branch with an
    indicator was ever reachable by its visible label.

- **Runtime a11y + consistency** (#319). The accessible-name and dismissal
  gaps found by the architecture review, closed in one pass:

  - Dialog and Popover popups reference their Title/Description ids only
    while those parts are actually rendered (Toast's presence-tracking
    pattern) — composing a dialog without a `Title` no longer leaves an
    `aria-labelledby` naming nothing, which suppressed the accessible-name
    fallback entirely.
  - Tooltip: Escape dismisses no matter where focus is (WCAG 2.1
    SC 1.4.13) through the dismiss layer's document listener, immediately,
    clearing any pending hover-open. The trigger-local handler — which only
    fired for focus-opened tooltips — is gone.
  - Dialog `modal={false}`: `dismissible` works now — a non-modal
    `<dialog>` fires no `cancel`, so Escape goes through a dismiss-layer
    fallback; focus is restored on close (`show()` doesn't restore the way
    `showModal()` does); and backdrop-click detection is modal-only and
    geometric, so a click on the dialog's own padding no longer closes it.
  - Menu: the trigger carries an id and the root popup is labelled by it,
    presence-tracked (a context-menu-only composition stays unlabelled
    rather than dangling); `Menu.Group` is named by its `GroupLabel`, which
    gains an id and loses the self-defeating `role="presentation"`.
  - Select field integration: the trigger adopts `field.ids.control` so
    `Field.Label` names it (a button is labelable), and announces
    `aria-invalid` / `aria-required` / `aria-describedby` from the merged
    field + prop state. Both Select and Combobox scroll the highlighted
    option into view (`block: 'nearest'`) — `aria-activedescendant` moves
    no real focus, so nothing scrolled natively. Select joins the SSR
    suite and gains its first e2e spec.
  - `behaviors/list.ts` gains `moveHighlight` and `optionText` (exported
    from the behaviors barrel), replacing byte-identical private copies in
    Select and Combobox.
  - `Toast.Close` defaults `aria-label="Close"` with a `label` prop
    override (Alert.Close's pattern); RatingGroup gains
    `itemLabel?: (index, count) => string` as the localization seam over
    the previously hardcoded English `"N of M"`; `Tabs.Tab` carries
    `aria-disabled` in its bag so asChild consumers (an `<a>` has no
    `disabled` attribute) announce disabled tabs.
  - Accordion and Collapsible wire explicit disclosure semantics: panels
    mint SSR-safe ids, triggers carry `aria-expanded` / `aria-controls`,
    and `aria-disabled` when disabled (`<summary>` has no `disabled`
    attribute to announce).
  - Popover moves focus into the popup on open — the first tabbable, or
    the popup itself (`tabIndex={-1}`) — and `createFocusRestore` hands it
    back on close; `focusFirst`/`getTabbables` gain their first tests.

- **Contract v1: the part tree, governed states, declared placements, and
  axes on all 31** (#317). One coordinated contract break carrying every
  shape change at once:

  - `PartSpec.parent` declares which same-scope part each part renders
    inside — the anatomy's part TREE, across all 31 anatomies. It names the
    containing part rather than the immediate element (a menu item inside a
    group is still inside the popup); top-level parts omit it, pseudo parts
    never declare it. `expectAnatomy` now asserts the rendered DOM matches
    the tree, and tooling derives real ancestor chains from it instead of
    hand-maintaining nesting tables.
  - `data-state` values are governed the way flags always were:
    `STATE_VOCABULARY` (grouped families, membership checked against the
    union) plus a `STATE_SYNONYMS` table so a rejected spelling fails with
    the member to use (`expanded` → "use `open`").
  - `data-placement` is declared contract data, not a blanket-exempt
    attribute: `PLACEMENT_VOCABULARY` closes the value set (and
    `behaviors/position.ts` derives its `Placement` type from it), and a
    part that can carry it declares its subset as `PartSpec.placements` —
    the six anchored-position popups take the full twelve, toast's
    viewport/root the six edge slots. `expectAnatomy` checks it per part
    like `data-state`; the old exemption is gone.
  - Every component now carries the variant-axis surface: accordion,
    collapsible and field gained `WithVariantAxes` on their Root; dialog,
    menu, popover and tooltip carry the props on their **Trigger** (their
    Root renders a fragment, and the trigger is the carrier part axis
    selectors anchor on); toast routes `toast({ color })` through the shared
    `variantAttrs` (an explicit prop on a composed root wins) — which makes
    the four design systems' already-emitted `toast.color` recipes reachable
    for the first time. Per-skin wiring of the remaining color/size recipes
    is tracked in #321.
  - `registerTheme` warns (never throws — design systems register at module
    init on the server) when a theme name is re-registered with different
    content, and merges last-write-wins: the SSR-bleed guard. `clearThemes()`
    now also resets the browser controller singleton's explicit theme to
    follow-the-system — theme names are DS-specific, so after a
    design-system swap the name it held belonged to a stylesheet that left.
  - Alert renders its `data-state` through the shared `stateAttr` helper.
  - The manifest's `attributeSpec` gains `stateVocabulary`, `stateSynonyms`
    and `placementVocabulary`; parts gain `parent` and `placements`.

- **`Skeleton` and `Spinner` — closing the typed-design-systems RFC's
  content-tier list** (#314). The RFC (deleted; docs/architecture.md §11)
  named ten; `rating` shipped, `input`/`textarea` landed in #310,
  `card`/`alert`/`badge`/`divider` in #311, and two are deliberately out —
  `steps` would remove `zero-ext-example`'s premise (#304) and `table` is
  markup and styling rather than behavior. These are the last two.

  `Skeleton` takes a `loading` model defaulting to **true** and keeps its
  children in the DOM in BOTH states. That is the whole component: it exists
  to hold the layout its content will occupy, so swapping the children for a
  placeholder box would make the box the wrong size and the page jump when the
  real thing arrived. It declares no `hiddenIn` — nothing is hidden in either
  state, so the two are told apart by paint and every design system has to make
  them differ.

  `Spinner` has no state (it spins or it is not rendered) and renders an empty
  element: the mark is the design system's, because how a spinner is drawn is
  its whole identity. `role="status"` with an `aria-label` defaulting to
  `"Loading"` — a spinner with no accessible name is a decoration that happens
  to move, and `status` announces on appearance rather than on every frame.

  Both loop, so both owe a `prefers-reduced-motion` answer, and it has to STOP
  rather than speed up: the kit collapses declared `--duration-*` tokens to ~0
  under reduced motion, and a loop at ~0s strobes. Their durations are
  therefore literals, and `e2e/reduced-motion.spec.ts` asserts the opposite
  thing in two projects — running under `chromium`, `none` under
  `reduced-motion` — because a one-way check passes for a recipe that never
  animated at all.

- **The content tier — `Card`, `Alert`, `Badge`, `Divider`** (#311). The
  typed-design-systems RFC named the gap ("the content tier a design system is visually judged on is
  absent: card, alert, badge, skeleton, spinner, steps, divider, rating,
  table"), and this takes the four the next RFC then singled out. `steps` is
  deliberately left out — `zero-ext-example` ships `Stepper` precisely as a
  component zero does not (#304) — and `table` is markup and styling rather
  than behavior.

  `Card` is a styling container and nothing else: no state, no context, no
  ids. The obvious `aria-labelledby` from `root` to `title` is deliberately
  absent — it does nothing on a plain `div`, and giving `root` a role to make
  it work would turn every card on a page into a landmark to walk past.
  `Card.Title` renders an `<h3>` so a page of cards is navigable from a
  heading list.

  `Alert` carries `role="alert"`, and that is the line between it and Card: an
  alert nobody is told about is a coloured box, and a coloured box is a card.
  The role costs nothing when server-rendered, because a live region announces
  *changes* — static content at load is silent, and an alert inserted later is
  announced. Its model is presence and defaults to open; `Alert.Close` sets it
  false and the runtime sets `hidden`, declared as `hiddenIn: ['closed']`, so
  no design system paints `closed` and the state-legibility guard accepts the
  pair on presence alone.

  `Badge` is one part, and that shape is load-bearing: its carrier IS its
  text-bearing part, which is the only shape the contrast audit's one-element
  probe can measure. That is why badge, alone in this batch, wires its own
  `variant` vocabulary — see below. `Divider` is `role="separator"`,
  non-focusable, with `aria-orientation` emitted only for `vertical`.

- **`Input` and `Textarea` — the two basic form controls zero was missing**
  (#309). The form family was otherwise complete (Field, Checkbox, Switch,
  RadioGroup, Slider, Select, Combobox, NumberInput, RatingGroup), but the
  only real text inputs in the package were locked inside Combobox and
  NumberInput, and a raw `<input>` dropped into a `Field.Root` got no
  `for` / `aria-describedby` wiring — adoption only happens when a zero
  control asks for the field context itself.

  `Input` is `Root/Label/Control/Input`, the same control-wraps-input split
  Combobox and NumberInput use: the border, the focus ring and the invalid
  tint draw on `control`, and that seam is what makes a leading icon or a
  trailing affordance possible later without a breaking anatomy change.
  `type` is a closed union — `text | email | password | search | tel | url` —
  because `number` is NumberInput's job, the selection types are other
  components wearing the same tag name, and the date/time types render
  browser chrome no recipe can honour.

  `Textarea` is `Root/Label/Textarea`, deliberately without a `control`:
  nothing sits inside a textarea for a wrapper to hold (the scrollbar and the
  resize handle belong to the element), so the chrome draws on the element
  itself. `rows` passes through; auto-sizing is a layout behavior zero does
  not take on, and `resize` is the design system's call.

  Both take a plain `string` model written through on every keystroke — no
  draft/commit split, since a half-typed string is still a string — and both
  carry `name` on the visible element rather than through a `hidden-input`,
  because unlike Checkbox/Switch/NumberInput the visible element *is* the
  form control. Neither wires a `variant` axis (#175). All six design systems
  ship recipes for them.

- **`@sigx/zero/testing` — the anatomy conformance assertion, published**
  (#300). `expectAnatomy(container, anatomy, { axes? })` walks every rendered
  part of a scope and checks it against the declaration: known part,
  `data-state` from the closed set, flags declared and presence-only, and the
  `hidden` attribute exactly where `hiddenIn` says it goes. Framework-agnostic
  on purpose — it throws a plain `Error` rather than using any runner's
  assertion API — so an ecosystem component package can hold its parts to the
  same contract zero's own components are held to (zero's test suite now runs
  through this exact helper). The variant surface is exempt as declared
  vocabulary: contract axes and `data-mod-*` always, custom axes when named
  via `axes`.

- **`synthesizesClickFrom` is public** (#300). The per-key, per-element test
  for native click synthesis that zero's components use to synthesize
  keyboard activation for `asChild` parts without double-activating — a
  `<button>` synthesizes from both keys, an anchor only from Enter.
  `renderAsChild` was already exported; this is its sibling, and the missing
  piece for a third-party part combining `asChild` with keyboard activation.

- **`--print-ink` — the ink a print fallback draws with** (#233). Declared in
  `css/base.css` beside the other structural fallbacks, and the one colour
  there that is not a design decision: it is a fact about the medium. A mark
  drawn as a `background` does not print (`print-color-adjust: economy` is the
  browser default), so it comes back as a glyph — and every theme-carried
  candidate for that glyph's ink is white on one side or the other.
  `--color-base-content` and `CanvasText` are both white under a dark theme;
  an on-accent ink is white under a light one, over a fill that did not print.
  Both print at 1.00:1 on white paper. A design system may override it and
  never has to declare it — `@sigx/zero-kit` knows the name (`MEDIUM_PROPERTIES`).

- **`PartSpec.hiddenIn` — the anatomy declares the states the runtime hides a
  part in** (#227). Optional and additive: `hiddenIn: ['error']` on avatar's
  `image` says zero sets the `hidden` attribute there, so a rule for that
  state can never paint and styling it identically to a visible state is
  correct rather than lazy — the difference is presence, and the runtime owns
  it. Declared on the four parts zero hides: `avatar.image` (`error`),
  `avatar.fallback` (`loaded`), `tabs.panel` (`inactive`) and
  `tree-view.branch-content` (`closed`). Emitted into `manifest.json` (key
  omitted for every other part), so tooling reads the fact instead of
  hardcoding it — zero-kit's state-legibility guard carried exactly such a
  hardcoded avatar exemption until now. `expectAnatomy` checks the
  declaration against the DOM in both directions.

- **`@sigx/zero/adapt` — the generic runtime behind vendor-named component
  modules** (issue #179; docs/architecture.md, "The components artifact —
  vendor-named apis"). `adapt(Base, spec)` returns a factory
  whose setup delegates to the base component's with a renaming view over its
  props: vendor props (`kind`, `hasIconOnly`) route onto zero's variant
  surface (`variant`, `mods`, custom axes) at read time, values respell at
  the prop boundary, and the rendered attributes keep zero's spelling — the
  anatomy contract does not move. One component instance: slots, events,
  models, refs and lifecycle pass through untouched, reactivity included. A
  vendor prop deliberately shadows same-named base props (Ant's `type`) and
  is consumed, never leaked to the DOM. Ships with the `Adapted` type the
  kit-generated `components.d.ts` instantiates, and `AdaptedStatics` for a
  compound's non-carrier statics. New subpath export, ~0.95 kB; nothing else
  in zero imports it.

- **The `mods` prop — presence-only design-system modifiers** (#166;
  docs/architecture.md, "Declared vocabulary"). An axis answers *which one* and always carries a value; a modifier
  answers *is it on* and carries none. `<Button.Root mods={{ block: true }}>`
  renders `data-mod-block=""`, and `false` or an omitted key render nothing —
  the same presence-only shape the anatomy contract's own flags use. Added to
  `WithVariantAxes`, so every component already accepting the axis props
  accepts `mods` too, and narrowed per component by a design system's
  `/register` module through the new `ModsFor<S>`.

  They render into a `data-mod-*` namespace rather than as bare `data-<name>`
  flags. Zero owns the unprefixed presence-only vocabulary and **extends it
  between versions**, so an unprefixed modifier named `busy` would silently
  start matching a `data-busy` flag a later zero adds. A valued axis cannot
  fail that way — a collision there never matches, and `variantAttrs` throws.
  New exports: `WithMods`, `ModsFor`, `MOD_ATTR_PREFIX`.

- **`ThemeSource.defaultLight` / `defaultDark`** (#132; docs/architecture.md,
  "The theme model"):
  the registry stores the source's declared scheme defaults (they flow
  structurally from the kit's `TokensInput`, so `installThemes()` calls need
  no change) and `pickThemeFor` prefers them over first-registered — the
  latent bug only a third theme exposes. `clearThemes` drops them with the
  themes. With one theme per scheme nothing changes.

- **Theme, property, breakpoint and token-key narrowing** (#131;
  docs/architecture.md, "The register artifact"): `ZeroThemeName` (closed on the authoring surface — `setTheme`, the
  `ThemeProvider`/`ThemeScope` `theme` props, `ThemeControllerOptions.initial`)
  and `ZeroThemeNameOrCustom` (the lookup surface — `getTheme`, `pairOf`, and
  `theme()`'s return, which can carry persisted or tenant-registered names);
  `ZeroProperty` and `ZeroBreakpoint` (open with autocomplete);
  `ZeroTokenCategory` and `TokenKeyFor<C>`, whose unaugmented fallback is the
  category's *recommended* keys so autocomplete works before any design
  system opts in. Two one-line runtime helpers: `cssVar(name)` and
  `token(category, key)` → `var(--<prefix>-<key>)`. All resolve to today's
  open types until a `/register` module is imported.

- **The `ZeroVocabulary` augmentation seam** (#130; docs/architecture.md,
  "The register artifact"):
  `@sigx/zero` exports an empty `ZeroVocabulary` interface plus the scoped
  resolvers `ColorValueFor<S>` / `SizeScaleFor<S>` / `VariantValueFor<S>` /
  `AxesFor<S>`. The four variant-axis prop fragments become generic on the
  component scope (defaulting to the open unions), a combined
  `WithVariantAxes<S>` composes them, and every component carrying the axes
  names its own scope — toast's `ToastOptions.color`/`ToastData.color`
  included. With no augmentation every helper resolves to exactly the union
  it replaced; a design system's generated `/register` module (phase 3) is
  what narrows them. Also new: `ZeroAnatomies`/`ZeroScope` (the anatomy
  registry keeps its literal keys), an exported `VARIANT_AXES`
  (parity-tested against the kit's copy; previously the private
  `NAMED_AXES`), and compile-time type tests under `pnpm test:types` in two
  isolated projects, since module augmentation leaks program-wide.

### Fixed

- **`Switch` reads its `Field`** (#269). It was the one control inside a
  `Field.Root` that adopted nothing from it — `disabled`, `invalid` and
  `required` were read from its own props only, so
  `<Field.Root invalid><Switch.Root/></Field.Root>` left the switch unmarked in
  the DOM *and* in the accessibility tree (`aria-invalid` never set). Now the
  same `!!props.x || field.x()` derivation every other control uses: the prop
  wins when set, the Field supplies the rest, and a Field cannot un-set what a
  prop asserts.

  The ids came with it: the hidden input takes the field's `control` id and its
  `aria-describedby`, so `Field.Label`'s `for` finally lands on something and
  the description and error are announced. A switch that adopted the flags but
  not the id would still have had no accessible name from its field.

- **`switch/control` declares the `invalid` flag** (#269, additive anatomy
  change). The runtime already emitted `data-invalid` on `switch/root`, but the
  track — the thing a design system paints — could not carry it, so every
  recipe would have needed a descendant selector for a fact the control knows
  about itself. `checkbox/control` has carried the flag all along; this is the
  matching declaration, and the attribute is now emitted there.
- **`data-press-animating` no longer outlives an animation destroyed with its
  stylesheet** (#243). `createPressFeedback` cleared the flag on
  `animationend` / `animationcancel`, plus a synchronous escape hatch for a
  design system that animates nothing. Neither path covers the animation that
  *vanishes*: remove the stylesheet that declared it — which a runtime
  design-system swap does by construction — and the running `CSSAnimation` is
  destroyed while `animationcancel` is not reliably dispatched for it. The
  flag was then stranded for the life of the page, and any recipe rule keyed
  on it kept painting; only a later press on the same element cleared it, by
  accident of the restart path.

  Press-start now also follows `Animation.finished` on the animations it
  already collects for the escape-hatch check. That promise settles however
  the animation ends — resolving when it finishes, rejecting with `AbortError`
  when it is cancelled, stylesheet teardown included — and does not depend on
  an event being dispatched. No duration is assumed anywhere: a `--duration-*`
  token can be anything, so a timeout would either strand a slow animation's
  flag or cut a fast one short. The events stay as the path for an animation
  that starts after press-start.

  Keyed to the press that armed the flag, so the cancellation a re-press
  causes when it restarts the one-shot cannot clear the new press's flag.
  Measured on the playground's design-system swap, single press, 20 runs per
  engine: stranded 19/20 on webkit and 5/20 on firefox before, 0/20 on
  webkit, firefox and chromium after.

- **`RatingGroup.Item`'s default `half` symbol is now `★`, not `⯪`** (#222).
  `⯪` (U+2BEA STAR WITH LEFT HALF BLACK) has essentially no coverage in the
  macOS/Chromium sans stacks: it resolved to the last-resort tofu box, proven
  by canvas advance-width equality against a guaranteed-unmapped codepoint.
  The default is now `state === 'empty' ? '☆' : '★'`.

  `★` rather than something cleverer — an inline SVG, a wrapper, a `clip-path`
  on a child — because the default has to stay a bare **text node**: a
  consumer's symbol arrives as an element, and design systems tell the two
  apart with exactly that difference (`:not(:has(> *))` in `@sigx/zero-basic`,
  the inverse `:has(*)` in `@sigx/zero-heroui`). Wrapping the default would
  silently switch their drawn stars off. It also repairs the two skins that
  render a half by masking or clipping this very glyph —
  `@sigx/zero-daisyui`'s `mask-size: 50% 100%` and `@sigx/zero-material`'s
  hard-stop gradient under `background-clip: text` — both of which were
  halving a tofu box and now get the full-width star they were written for.

  The residual, stated plainly: with **no design system loaded at all**, a
  half now renders identically to a full star. `⯪` was distinguishable but
  wrong; `★` is correct under every real skin, and rendering a *distinct* half
  is the design system's job. The value is never lost to assistive tech — the
  hidden input carries it and each item carries its own aria-label.

### Changed

- **BREAKING (anatomy): `menu`'s `context-trigger` part carries
  `data-focus-visible`** (#252). Changing an anatomy is a breaking change —
  the part's flag set grows from `['disabled']` to
  `['disabled', 'focus-visible']`, so `manifest.json` moves and any tool,
  generator or test pinning that list has to be regenerated. Nothing that
  reads the old attributes breaks: the addition is purely additive at the DOM
  level.

  Why: the surface is focusable in practice — it becomes a tab stop whenever
  the consumer makes it one, and Escape from an open context menu restores
  focus to it — but with `disabled` as its only flag a design system had
  nothing to hang its own focus ring on, so the part fell back to the UA
  default while every other focusable part carried the system's ring.
  `Menu.ContextTrigger` did no focus tracking at all; it now reports the
  platform's `:focus-visible` heuristic through `onFocus`/`onBlur`, the same
  way `Menu.Trigger` and `RatingGroup.Item` do. `focus`/`blur` don't bubble,
  so the flag reports the surface's OWN focus — a focused descendant carries
  its own ring, not one drawn around the whole surface.

  No design system paints it yet: the part is typically the consumer's own
  content (`asChild`), so the ring the app draws around that content stays
  the right default. `@sigx/zero-heroui` and `@sigx/zero-carbon` — the two
  that declare a `context-trigger` recipe part — say that deliberately with
  `skipStates: { 'context-trigger': ['focus-visible'] }`. No compiled CSS
  changed.

- `variantAttrs` accepts `axes` values of `string | undefined` and skips
  `undefined` entries before its guards — a narrowed `AxesFor<S>` bag has
  optional members, and an unset one must neither throw nor emit an
  attribute. The guards themselves are unchanged.

- **TreeView** (`@sigx/zero/tree-view`) — the APG tree pattern. Unnamed
  model = selected value; `model:expandedValues` (named-models convention)
  = the expansion set. ArrowRight expands then descends, ArrowLeft
  collapses then climbs (RTL-mirrored), Enter/Space select, typeahead over
  visible nodes, one tab stop. Collapsed content stays mounted and
  `hidden`. Single selection in v1.
- **`createTreeController` behavior** (`behaviors/tree.ts`) — hierarchical
  registration that IMPLEMENTS the flat `ListController` interface over the
  VISIBLE nodes (every ancestor expanded, DOM-ordered), so
  `createRovingKeydown` and `createTypeahead` work on a tree unchanged.
  `sortByDomOrder` is now exported from `behaviors/list.ts` (shared by
  both controllers).

- **RatingGroup** (`@sigx/zero/rating-group`) — radio semantics over a row
  of symbols with hover preview and optional half values. The `item` part
  carries the library's one three-value state set (`full|half|empty`),
  driven by the DISPLAYED value (preview included);
  `data-highlighted` marks the preview range. Keyboard moves the VALUE —
  with `allowHalf` two values share one element, so element roving can't
  express the step; one tab stop rides `ceil(value)`. Pointer x decides
  halves (RTL-aware); touch taps commit with the same math; `deselectable`
  re-click clears; `hidden-input` posts the fractional value; `readonly`
  renders fractional averages without interaction.

- **Context menu: `Menu.ContextTrigger`** — an additive `context-trigger`
  part on the `menu` anatomy (no separate component: same popup, items,
  submenus, typeahead and focus restore). Wrap any surface; right-click /
  Android long-press opens the popup at the pointer through a virtual
  anchor — deferred until the gesture completes, because an auto popover
  opened mid-gesture is racily light-dismissed by its own pointerup —
  and Shift+F10 / the ContextMenu key open it anchored to the surface's
  rect (APG). A second right-click outside the popup re-anchors it; the
  regular `Menu.Trigger` re-claims the anchor on open, so the last opener
  wins. iOS long-press (no native `contextmenu`) is deferred.

- **NumberInput** (`@sigx/zero/number-input`) — a WAI-ARIA spinbutton over a
  real `type="text" inputmode="decimal"` input. Model is `number | null`
  (empty is not 0); typing edits an uncommitted draft committed on
  blur/Enter (parse → clamp → step-snap anchored at `min`,
  decimal-precision-safe), stepping (arrows, PageUp/Down ×10, Home/End,
  hold-to-repeat triggers, opt-in focus-gated `allowWheel`) commits
  immediately. `hidden-input` posts the canonical decimal — the visible
  input never carries `name`, so a custom display `format` can't corrupt
  form data. `clampOnBlur` (default true) opt-out keeps out-of-range
  commits and flags `data-invalid`.
- **`createSpinPress` behavior** (`behaviors/spin.ts`) — press-and-hold
  auto-repeat for stepper triggers: one spin on press, repeat after
  `delay` (400ms) every `interval` (64ms), release-anywhere via a one-shot
  window listener, stops on drag-off and on going disabled mid-hold.

- **Toggle** (`@sigx/zero/toggle`) — a two-state button (`aria-pressed`,
  `on|off` on `data-state`). A mode you flip, not a form value; Switch keeps
  the form-participating case.
- **ToggleGroup** (`@sigx/zero/toggle-group`) — toggle buttons under one
  `string[]` model, single (`deselectable` opt-out) or `multiple` selection,
  orientation-aware arrow-key roving with a single tab stop, RTL-aware. The
  `item` part mirrors the standalone toggle's `on|off` contract and doubles
  the on state as a `data-selected` presence flag.
- **Virtual anchors in the positioning behavior** — `PositionAnchor =
  HTMLElement | VirtualAnchor` (anything with `getBoundingClientRect()`),
  a `pointAnchor(x, y, size?)` factory for anchoring at client coordinates,
  and `createAnchorPosition` now returns an `AnchorPositionHandle` whose
  `update()` re-runs the strategy while open — a moved anchor repositions
  without a close/reopen. `PositionStrategy.apply` and
  `AnchorPositionInput.getAnchor` widen to `PositionAnchor`; element
  anchors and existing custom strategies keep working unchanged. One
  type-level change: `createAnchorPosition` returns the handle instead of
  `void` — callers that ignored the return value are unaffected, but a
  wrapper typed as returning `void` will need its annotation updated.

### Fixed

- **`hidden` parts now actually hide, in every design system** (#209). A
  collapsed `tree-view.branch-content` is hidden by the `hidden` attribute
  alone, which leans on the UA sheet's `[hidden] { display: none }` — the
  weakest declaration in the document. Every design system's recipe put an
  unconditional `display: flex` on that part inside `@layer zero.recipes`, so
  collapsing a branch hid nothing in all six: `data-state="closed"`,
  `hidden`, and 75–149px of subtree still on screen. `css/base.css` now
  declares a fourth cascade layer, `zero.structure`, ordered after
  `zero.recipes`, holding
  `[data-scope][data-part][hidden]:not([hidden="until-found" i]) { display: none }`.
  A later layer rather than higher specificity, so no design system can
  out-specify it whatever it writes; a layer rather than `!important`, so a
  consumer's unlayered app CSS still wins. `hidden="until-found"` is exempt —
  the UA gives it `content-visibility: hidden` for find-in-page, and this
  guard must not become the next thing overriding the UA. The same rule
  closes the latent version of the bug on `tabs.panel` and `avatar.image` /
  `avatar.fallback`, which until now survived only because no design system
  happened to set `display` on them. Proved in real engines by
  `examples/playground/e2e/hidden-parts.spec.ts` (six design systems ×
  chromium/firefox/webkit); happy-dom resolves no layered cascade, so no unit
  test can see this.

## [0.1.0] - 2026-07-27

### Changed (breaking — pre-release, the multi-target RFC — docs/architecture.md §11 — #98)

- **Slider: the styled part is `control`, not `input`** (`Slider.Control`
  replaces `Slider.Input`), and the anatomy grows the cross-platform superset
  parts `track`, `range`, `thumb` — the projection for platforms without a
  native range widget. The web renders only `control`; rules against the new
  parts are inert here, which is what lets one recipe carry both projections.
- **Dialog: the backdrop is now a first-class `backdrop` part.** It renders
  no element on the web — the anatomy declares it
  `pseudo: { of: 'popup', selector: '::backdrop' }` and recipes style
  `parts.backdrop` instead of hand-writing
  `selectors: { '&::backdrop': … }` (states narrow the popup:
  `[data-state="open"]::backdrop`). Dialog also gains a `footer` part and
  `Dialog.Footer` component — the shared action row.
- `defineAnatomy` supports **pseudo parts** (`PartSpec.pseudo`): parts that
  render no element of their own on the web and project onto a
  pseudo-element of another part. `selector()` and `toJSON()` compose the
  host + state fragments + pseudo-element (always last).

### Added

- **`--text-fixed-<key>` aliases in the token contract** (`TEXT_FIXED_PREFIX`
  in `@sigx/zero/contract`): for every emitted `--text-<key>` the compiler
  also emits `--text-fixed-<key>` — on the web pure indirection
  (`var(--text-<key>)`); on an emit target with a runtime font scale (lynx's
  `fontScale`) a materialized literal that scaling never touches. Recipes
  reference it for control chrome that must not grow with in-app text
  scaling. `css/base.css` ships fallback aliases for the recommended ramp.
  Part of the multi-target RFC (docs/architecture.md §11, #96).

### Changed (breaking — pre-release)

- **The `size` axis is now open, like the color axis.** `SizeScale` was a
  closed union (`'xs' | 'sm' | 'md' | 'lg' | 'xl'`) while `ColorValue` had the
  `(string & {})` escape hatch, so a design system specifying density
  (`compact`, `comfortable`) or a numbered ramp could not be consumed at all —
  `<Button.Root size="comfortable">` was a compile error. It is now
  `RecommendedSize | (string & {})`; `SIZE_SCALE_LIST` keeps its name and
  becomes the *recommended* ramp, with `RecommendedSize` as its element type.
- `manifest.json` `tokens.sizeScale` is now `tokens.recommendedSizes`, named
  like `tokens.colors.recommendedRoles` because it means the same thing: a
  default a design system may replace, not a closed set.
- **The color contract is now a naming grammar, not a fixed vocabulary**:
  design systems declare their own roles (via `@sigx/zero-kit`); zero knows
  only the `--color-<role>[-content|-soft]` convention and the fixed base
  surfaces (`base-100/200/300/base-content`).
- `resolveColorToken` resolves by convention: `--x` → `var(--x)`, bare
  kebab-case identifiers → `var(--color-<name>)` (CSS-wide keywords,
  `transparent`, `currentcolor` excluded), everything else passes through.
  Named CSS colors like `'red'` now resolve as token names — write literal
  colors as `#f00` / `rgb()`.
- The `color` prop (`WithColor`) accepts any DS-declared role;
  recommended roles keep autocomplete.
- `manifest.json` `tokens.colors` is now `{ convention, required,
  recommendedRoles }` instead of a flat token list.
- `css/base.css` no longer registers `@property` for the eight recommended
  roles — registrations are emitted per-declaration by the kit into each
  design system's compiled `tokens.css`.
- Removed the fixed-vocabulary exports `COLOR_VARIANT_LIST`,
  `CORE_COLOR_TOKEN_LIST`, `COLOR_TOKEN_LIST`, `ColorVariant`, `ColorToken`,
  `CoreColorToken`, `SoftColorToken` in favor of `RECOMMENDED_ROLE_LIST`,
  `BASE_SURFACE_TOKEN_LIST`, `RecommendedRole`, `BaseSurfaceToken`,
  `ColorValue`.

- **Token categories replace the flat structural token list.**
  `STRUCTURAL_TOKEN_LIST` / `StructuralToken` are removed in favor of
  `TOKEN_CATEGORIES`, `TokenCategory`, `TokenCategoryId`, `TOKEN_KEY_PATTERN`
  and `tokenProperty`. A flat closed array could not express the open,
  design-system-declared keys the contract is built on — the same reason the
  color vocabulary stopped being a fixed list.
- `manifest.json` `tokens.structural` (a flat array of property names) is now
  `tokens.categories`, publishing the grammar: prefix, recommended keys,
  value syntax and intent per category. `cat.recommended.map(k => cat.prefix
  + k)` reproduces the old array.

### Added

- **Combobox component** (`@sigx/zero/combobox`) — and with it the
  **named-models convention**: a component has exactly one unnamed `model`
  (its essential value, what `hidden-input` posts); every additional
  controllable state is a named model (`model:inputValue`, `model:open` in
  JSX, via sigx `Define.Model<'name', T>`), each keeping the standard
  `default<Name>` + `<name>Change` companions. Parts:
  Root/Control/Input/Trigger/Popup/Item/ItemIndicator/Empty/HiddenInput —
  Control is the field chrome around input + trigger, mirroring
  open/invalid/focus-visible so recipes draw the ring on the box; the input
  is a real `<input>` (no `data-placeholder`; use `:placeholder-shown`).
  APG editable combobox: focus stays in the input, highlight travels by
  `aria-activedescendant`, Home/End stay with the caret, Enter fills the
  input with the picked item's label. **Filtering belongs to the consumer**
  (items are JSX children); zero prunes a highlight whose item unmounts so
  the activedescendant never dangles. The popup is `popover="manual"` plus
  the dismiss layer — the first component consumer of
  `createDismissable` — because native light dismiss would close the list
  on a caret click in the input. All four design systems ship a combobox
  recipe.
- **Avatar component** (`@sigx/zero/avatar`): Root/Image/Fallback, every part
  mirroring the image load status as `data-state="loading|loaded|error"` (a
  missing `src` resolves to `error` on mount). Zero toggles `hidden` — the
  fallback while `loaded`, the image while `error` — and styles nothing, so
  recipes must gate any `display` they set on those parts behind
  `&:not([hidden])`. Cached images that complete before hydration are
  detected from the element itself; server markup always renders `loading`.
  `statusChange` event; `asChild` on Image keeps load detection through the
  spread bag. All four design systems ship an avatar recipe.
- **Toast component + manager/queue** (`@sigx/zero/toast`):
  Viewport/Root/Title/Description/Action/Close over an imperative queue —
  `toast({ title, color, duration, role })` from anywhere in the browser,
  `createToaster()` for apps and tests, `useToaster` injectable with a
  fresh-empty server fallback so SSR requests can never share toasts. The
  viewport is a `popover="manual"` top layer (`role=region`) with
  pause-on-hover/focus; each root is `role=status`/`alert`, carries
  `data-color` and `data-placement`, and publishes
  `--toast-index`/`--toast-count`. Mounted toasts cap at `max` (default 5)
  with a FIFO overflow queue. **Presence is runtime-managed** — the one
  deliberate exception to the declarative presence rule, because toasts must
  unmount: roots enter `closed`→`open` a frame apart and stay mounted after
  dismissal until their longest computed transition/animation finishes
  (instant when none — every engine, reduced motion included). Recipes style
  the plain two-state transition; `@starting-style`/`allow-discrete` are
  wrong here, and the skill documents why. All four design systems ship a
  toast recipe with a role-driven `variants.color` block.
- **Menu submenus** (`Menu.Sub` / `Menu.SubTrigger` / `Menu.SubPopup`):
  nested menus to any depth, built on nested `popover="auto"` — the platform
  supplies the stacking model (opening a child keeps ancestors open, Escape
  closes one level, light dismiss closes the chain, opening a sibling closes
  the other). `Menu.Sub` shadows the menu context for its subtree, so
  Item/Group/Separator work unchanged and `select` bubbles to the root.
  Anatomy grows two parts (additive): `sub-trigger` (data-state open|closed
  plus the item flags — style `[data-state="open"]` to keep it active while
  focus is in the submenu) and `sub-popup` (its own part so it can animate
  on its own axis). Keyboard per APG (ArrowRight/Enter/Space open + focus
  first, ArrowLeft closes back, mirrored under RTL, per-level typeahead);
  hover opens after `openDelay` (100ms) without moving focus and closes
  after `closeDelay` (300ms). All four design systems style the new parts.
- `fixedPositionStrategy` now shifts into the viewport after flipping (a
  tall submenu near the bottom edge rendered partly off screen — flip picks
  the side, shift keeps it on screen) and re-measures one frame after
  placement, because the open-state write races `showPopover()` across
  reactive callbacks and a still-hidden float measures 0×0.
- **Real-browser interaction suite** (Playwright over the playground):
  the press contract on chromium/firefox/webkit plus reduced-motion and
  forced-colors projects, with real pointer, keyboard and touch input.
  Runs in CI. It immediately caught the mouse-drag slider fix below.
- **Press feedback everywhere Material presses.** The primitive shipped on
  Button now covers every interactive part: tabs tab, dialog/popover
  trigger+close, menu trigger+item, select trigger+item (item pointer-only —
  keyboard selection lives on the trigger), collapsible/accordion trigger,
  switch/checkbox control and radio-group item-control (cross-element: the
  press lands anywhere in the label row, the feedback on the visible
  control, Space via the hidden input), and slider input. Anatomy flags are
  additive per part; slider declares only `pressed`.
- `createPressFeedback` gained `oneShot: false` for drag surfaces — skips
  the `data-press-animating` machinery entirely (a drag has no ripple).

### Fixed (pre-release)

- `llms.txt` documented 4 of the 14 shipped components; it now lists all
  fourteen with their parts and notes which accept variant axes.
- **A mouse drag off the slider no longer drops the held state.** Implicit
  pointer capture is a touch behavior, so a mouse drag fired pointerleave
  the moment it wandered off the box. The slider spreads no pointerleave
  handler, and press feedback now installs a one-shot, pointer-scoped
  window-level pointerup/pointercancel listener at pointer-press-start,
  ending the press wherever the release lands. Explicit `setPointerCapture`
  was rejected: it breaks WebKit's native range-drag value tracking.
- **Press lifecycle is now capture-aware.** `pointerleave` ended the press
  unconditionally; that is right for uncaptured pointers (drag off a button
  to cancel) but wrong under pointer capture — a native range input
  implicitly captures during drag, and touch implicitly captures on any
  element. A press now ends when the gesture ends: leave is ignored while
  the element holds capture for that pointer; pointerup/pointercancel (which
  capture retargets to the element) end it.

- **Press feedback — `createPressFeedback` and the `pressed` /
  `press-animating` flags.** CSS can see `:active` but not *where* a press
  landed, so pointer-anchored effects (Material's ink ripple) were
  inexpressible as pure recipe data. On parts whose anatomy declares the
  `pressed` flag — Button root, in this release — the runtime now sets
  `data-pressed` while the pointer/key is down, sets `data-press-animating`
  from press-start until the part's CSS animation finishes (so a quick tap
  plays a one-shot effect to completion; cleared on `animationend`, or
  synchronously when the active design system attaches no animation), and
  writes the press point as `--press-x` / `--press-y` / `--press-r` (px;
  `r` is the farthest-corner radius). Keyboard presses (Enter/Space) press
  at the box center. The design system consumes all of it in plain CSS; the
  behavior is exported as `createPressFeedback` for future components.
- Button's anatomy root gains the `pressed` and `press-animating` flags
  (additive), and the `PartProps` bag documents the pointer/keyup handlers
  it now carries — asChild renders get press feedback through the ordinary
  bag spread.
- **`axes` — the variant-axis set is open.** `variantAttrs` hardcoded exactly
  `color`/`size`/`variant`, and sigx forwards no rest props, so a design system
  with a fourth axis (density, emphasis, tone) had no route to the DOM at all:
  the kit compiled `[data-density="compact"]` selectors and then correctly
  warned they were dead on arrival. `axes` passes any other axis through as
  `data-<axis>`:

  ```tsx
  <Button.Root color="primary" axes={{ density: 'compact' }}>Save</Button.Root>
  ```

  Available on every component carrying variant axes (Button, Checkbox,
  Progress, RadioGroup, Select, Slider, Switch, Tabs). The three named props
  stay — they are the axes almost every design language has, and they keep
  autocomplete. An axis name must be kebab-case and may not be one the anatomy
  contract owns (`RESERVED_AXES`: `scope`, `part`, `state`, `orientation`, and
  every flag), nor one of the three that already has a prop (`color`, `size`,
  `variant` — use those, and keep their autocomplete). Zero throws rather than
  dropping it silently: shadowing `data-state` from userland would repoint
  every `[data-state="open"]` rule a design system wrote, and a second spelling
  of `data-color` would win over the named prop by loop order alone.
- `RESERVED_AXES` — exported from `@sigx/zero/contract` (it lives with the prop
  fragments, beside `variantAttrs`, not with the token vocabulary), mirrored in
  `@sigx/zero-kit` and parity-tested, so the validator rejects exactly what the
  runtime refuses.
- `manifest.json` `attributeSpec` gains `extraAxisForm`; `variantAxes` is now
  documented as the axes with named props rather than as the whole set.

- `clearThemes()` — drop every registered theme, for hosts that exchange design
  systems at runtime. Theme names are design-system-specific, so re-seeding
  without clearing would leave a previous DS's names selectable while its
  stylesheet is gone: `listThemes()` would offer a `[data-theme]` block that no
  longer exists, and `pickThemeFor()`/`toggle()` could land on a theme belonging
  to a design system that is no longer loaded. Browser-only by intent — the
  registry is otherwise write-once so a module-level Map stays SSR-safe.
- `registerThemes(tokens)` + the `ThemeSource` type — seed the theme registry
  from a design system's token declaration in one call, with the picker swatch
  DERIVED from that declaration (`tokens.swatch`, else the first four declared
  roles plus the base pair) instead of hardcoded per package. Design systems'
  `installThemes()` collapse to a single line, and what lands in the registry
  now matches what the kit compiles into their `manifest.json` — previously
  `@sigx/zero-basic` and `@sigx/zero-daisyui` registered four swatch tokens
  while their own manifests named six. `ThemeSource` is typed structurally, so
  `@sigx/zero-kit`'s `TokensInput` is assignable to it without zero taking any
  dependency on the Node-only kit.
- `defaultSwatch(roleNames)` on the token contract — the rule the compiler and
  the runtime registry share, mirrored in `@sigx/zero-kit` and parity-tested,
  so a theme picker can no longer disagree with the design system's manifest.

- **Button** — one part on a native `<button>`, carrying all three variant
  axes. Zero shipped fourteen components and none of them was the one every
  design system is judged on; `data-variant` (outline / soft / ghost) had
  nothing to apply to.

- `css/base.css` ships fallbacks for the typography categories
  (`--font-*` families, `--weight-*`, `--leading-*`, `--tracking-*`).
  `--font-*` is families only; sizes remain `--text-*`.
- `css/base.css` ships fallbacks for the spacing and elevation categories
  (`--space-2xs`…`--space-2xl`, `--shadow-xs`…`--shadow-xl`), so zero
  primitives have sane density and elevation before any design system loads.
  A design system's own keys come from its compiled `tokens.css`.
- `css/base.css` ships fallbacks for the motion categories
  (`--duration-*`, `--ease-*`) and a global
  `@media (prefers-reduced-motion: reduce)` block neutralizing the
  recommended durations, so zero primitives honor the preference before any
  design system loads. A design system's own duration keys are neutralized by
  its compiled `tokens.css`.

- `CSS_COLOR_KEYWORDS` and `ROLE_NAME_PATTERN` are now exported from the
  contract. `resolveColorToken` resolves through them rather than through
  private constants, so `@sigx/zero-kit`'s mirrored copy of the contract can
  be compared against them by an automated parity test.
