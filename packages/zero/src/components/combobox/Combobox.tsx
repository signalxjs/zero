/**
 * Combobox — an editable text input over a filtered listbox (WAI-ARIA
 * editable combobox pattern), typed generic at the JSX level over a
 * collection of items.
 *
 * ```tsx
 * // Items as data: zero filters (contains-match on the label) as you type.
 * <Combobox.Root items={countries} itemKey={(c) => c.code} itemLabel={(c) => c.name}
 *     model={() => state.country} model:inputValue={() => state.query}
 *     placeholder="Search countries…" emptyText="No match" />
 *
 * // A server-filtered list: pass what came back, and no filter.
 * <Combobox.Root items={results} filter={false} model={() => state.country}
 *     model:inputValue={() => state.query} />
 *
 * // Hand-written items: what you render is what is visible — filter yourself.
 * <Combobox.Root model={() => state.fruit} model:inputValue={() => state.query}>
 *     <Combobox.Control><Combobox.Input /><Combobox.Trigger /></Combobox.Control>
 *     <Combobox.Popup>
 *         {fruits.filter((f) => f.includes(state.query)).map((f) => (
 *             <Combobox.Item value={f} key={f}>{f}</Combobox.Item>
 *         ))}
 *         <Combobox.Empty>No fruit found</Combobox.Empty>
 *     </Combobox.Popup>
 * </Combobox.Root>
 * ```
 *
 * THE NAMED-MODELS CONVENTION: exactly one unnamed `model`, the essential
 * value — what the hidden select posts. `model:inputValue` is the text,
 * `model:open` the popup, each with `default<Name>` + `<name>Change`.
 *
 * THE COLLECTION IS THE TRUTH (#438): with `items` the visible list is the
 * items whose label contains the query (`filter` replaces the rule,
 * `filter={false}` shows everything), and a preset value's label reaches the
 * input before any item mounts. Hand-written items register into the same
 * collection and stay consumer-filtered. `Combobox.Empty` renders only while
 * the visible list is empty. Under `multiple` a selection toggles, clears
 * the input and keeps the popup open.
 *
 * TAGS (#39): under `multiple` the data expansion renders a `Combobox.Tag`
 * per chosen value in the control, before the input — its label and a
 * remove button, or the root's `tag` slot in their place (a per-tag control
 * such as a mode select). Hand-written roots place `Combobox.Tags` (or
 * individual `Combobox.Tag`s) themselves. Backspace on an empty input
 * removes the last value. `allowCustom` commits free text on Enter while no
 * option is highlighted — the option whose label it matches, else the text
 * itself — and a custom value posts like any other.
 *
 * TRIGGER MODE (#58): with `trigger` (`'@'`, or a RegExp) the control is
 * the `Textarea.Textarea` — or, single-line, the `Input.Input` (#106) —
 * composed inside the root rather than an input: an `@mention` over a
 * message box, a `/command` in a command line:
 *
 * ```tsx
 * <Combobox.Root trigger="@" items={people} itemLabel={(p) => p.name} onInsert={(d) => …}>
 *     <Textarea.Root model={() => state.draft} minRows={1} maxRows={8}>
 *         <Textarea.Label visuallyHidden>Message</Textarea.Label>
 *         <Textarea.Textarea onKeydown={sendOnEnter} />
 *     </Textarea.Root>
 * </Combobox.Root>
 * ```
 *
 * The token at the caret (the trigger at the start of the text or after
 * whitespace, then non-whitespace) is the query — it is what
 * `model:inputValue` holds, and what the list filters on. The popup opens
 * while there is one and something matches (or `emptyText` says nothing
 * does); the first option is highlighted, so Enter or Tab commits at once.
 * A commit replaces the whole token with the trigger, the label and a space
 * — the one already following the token if there is one, never two —
 * through the editing stack, so it undoes; puts the caret after it and
 * emits `insert`; there is no selection, so `model` is not written. While
 * the popup is open the textarea is an ARIA combobox and Arrow keys, Enter,
 * Tab and Escape are its — the app's own `onKeydown` does not see them.
 * The data expansion renders only the popup; hand-written items go in a
 * `Combobox.Popup` of your own beside the textarea.
 *
 * Focus stays in the input; the highlighted option is conveyed via
 * `aria-activedescendant` + `data-highlighted`. ArrowDown/Up open and move,
 * Enter selects, Escape closes, Tab closes without being swallowed, Home/End
 * stay with the text caret (APG). The popup is `popover="manual"` + the
 * dismiss layer: native `auto` light dismiss would close the list on a caret
 * click in the input.
 */
import { component, compound, defineInjectable, defineProvide, effect, untrack, watch } from 'sigx';
import type { Define, JSXElement } from 'sigx';
import { createControllableState, createInertState, namedModel, type ControllableState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { createCollection, type Collection } from '../../behaviors/collection.js';
import { createFormControl, settleHiddenSelect } from '../../behaviors/form-control.js';
import { onFormReset } from '../../behaviors/form-reset.js';
import { VISUALLY_HIDDEN_STYLE } from '../../behaviors/visually-hidden.js';
import { createListController, type ListController } from '../../behaviors/list.js';
import {
    announceGroupLabel, createGroupPresence, createListbox, createListboxItem, type GroupPresence, type Listbox,
} from '../../behaviors/listbox.js';
import { syncPopover } from '../../behaviors/popover-sync.js';
import type { ListboxWindowHost, ListboxWindowing, VirtualListbox } from '../../behaviors/virtual-listbox.js';
import { useTextControlBinding, type TextControlBinding, type TextControlClaim } from '../../behaviors/text-control-binding.js';
import { replaceToken, triggerTokenAt, type TriggerToken } from '../../behaviors/trigger-token.js';
import { createAnchorPosition, type Placement, type PositionAnchor, type PositionStrategy } from '../../behaviors/position.js';
import type { TextAnchor } from '../../behaviors/caret-anchor.js';
import { createDismissable } from '../../behaviors/dismiss.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import type { FactoryBrands, JsxProps } from '../../contract/generic.js';
import { htmlAttrs } from '../../contract/props.js';
import type {
    PartProps,
    WithAsChild,
    WithClass,
    WithDisabled,
    WithFormControl,
    WithHtmlAttrs,
    WithReadonly,
    WithVariantAxes,
} from '../../contract/props.js';
import { comboboxAnatomy } from './anatomy.js';
import { mountScope } from '../../behaviors/mount-scope.js';

const SCOPE = comboboxAnatomy.scope;

interface ComboboxContext {
    state: ControllableState<unknown>;
    inputValue: ControllableState<string>;
    collection: Collection<unknown, unknown>;
    listbox: Listbox<unknown>;
    list: ListController;
    open: { value: boolean };
    ids: { trigger: string; popup: string };
    placeholder(): string | undefined;
    multiple(): boolean;
    /** A chosen value's display text — remembered, so a consumer-filtered item that unmounts keeps its tag's label. */
    tagLabel(key: string): string;
    /** Deselect one chosen value (a tag's remove). */
    remove(key: string): void;
    /** Something to clear: a chosen value or typed text (the clear-trigger renders while true). */
    clearable(): boolean;
    /** Clear the value and the text, and focus the input (the clear-trigger's click). */
    clear(): void;
    /** The root's `loading` — the listbox is `aria-busy`, `empty` holds back. */
    loading(): boolean;
    /** Refuses the empty key in single mode — it is the placeholder's. */
    guardKey(key: string): void;
    disabled(): boolean;
    invalid(): boolean;
    required(): boolean;
    readonly(): boolean;
    describedBy(): string | undefined;
    /** The input's rendered id — the field's control id when wrapped in a Field. */
    inputId(): string;
    inputFocusVisible: { value: boolean };
    setControl(el: HTMLElement | null): void;
    setInput(el: HTMLElement | null): void;
    setTrigger(el: HTMLElement | null): void;
    setPopup(el: HTMLElement | null): void;
    focusInput(): void;
    inputKeydown(e: KeyboardEvent): void;
    onInput(value: string): void;
    /** A pointer click on the input — opens under `openOnClick`. */
    inputClick(): void;
    /** The input lost focus — resyncs the text unless focus stayed in the combobox. */
    inputBlur(e: FocusEvent): void;
    /** Trigger mode: the popup keeps focus in the textarea, and names itself by it. */
    triggerMode(): boolean;
    /** The id the popup is labelled by — the input's, or in trigger mode the textarea's. */
    labelledBy(): string | undefined;
    /** The windowed list (`virtual`), while one is rendered. */
    virtual: { current: VirtualListbox<unknown> | null };
}

function makeInert(): ComboboxContext {
    const state = createInertState<unknown>('');
    const collection = createCollection<unknown, unknown>();
    const list = createListController();
    return {
        state,
        inputValue: createInertState<string>(''),
        collection,
        listbox: createListbox({ collection, selection: state, list, idBase: 'zx-combobox-inert' }),
        list,
        open: { value: false },
        ids: { trigger: 'zx-combobox-inert-trigger', popup: 'zx-combobox-inert-popup' },
        placeholder: () => undefined,
        multiple: () => false,
        tagLabel: (key) => key,
        remove: () => {},
        clearable: () => false,
        clear: () => {},
        loading: () => false,
        guardKey: () => {},
        disabled: () => false,
        invalid: () => false,
        required: () => false,
        readonly: () => false,
        describedBy: () => undefined,
        inputId: () => 'zx-combobox-inert-input',
        inputFocusVisible: { value: false },
        setControl: () => {},
        setInput: () => {},
        setTrigger: () => {},
        setPopup: () => {},
        focusInput: () => {},
        inputKeydown: () => {},
        onInput: () => {},
        inputClick: () => {},
        inputBlur: () => {},
        triggerMode: () => false,
        labelledBy: () => undefined,
        virtual: { current: null },
    };
}

export const useComboboxContext = defineInjectable<ComboboxContext>(() => makeInert());

// ── Root ──

/** The props, generic over the item `T` and the model `M` (see `SelectRootProps`). */
export type ComboboxRootProps<T = unknown, M = unknown> =
    & Define.Model<M>
    /** Typed per overload on the exported root (see below); `unknown` here. */
    & Define.Prop<'defaultValue', unknown, false>
    & Define.Event<'valueChange', M>
    & Define.Model<'inputValue', string>
    & Define.Prop<'defaultInputValue', string, false>
    & Define.Event<'inputValueChange', string>
    & Define.Model<'open', boolean>
    & Define.Prop<'defaultOpen', boolean, false>
    & Define.Event<'openChange', boolean>
    /** The items as data. Absent → hand-written `Combobox.Item` children, consumer-filtered. */
    & Define.Prop<'items', ReadonlyArray<T>, false>
    & Define.Prop<'itemKey', (item: T) => string, false>
    & Define.Prop<'itemLabel', (item: T) => string, false>
    & Define.Prop<'itemDisabled', (item: T) => boolean, false>
    & Define.Prop<'itemGroup', (item: T) => string | undefined, false>
    /**
     * Data-mode visibility: the default is a case-insensitive contains-match
     * on the label; a function replaces it; `false` shows every item (a
     * server-filtered list).
     */
    & Define.Prop<'filter', false | ((item: T, query: string) => boolean), false>
    /** Rendered as `Combobox.Empty` by the data expansion while nothing is visible. */
    & Define.Prop<'emptyText', string, false>
    /**
     * The list is still arriving (#280): the listbox is `aria-busy`,
     * `Combobox.Loading` renders and `Combobox.Empty` holds back — an
     * unfinished list is not an empty one. Opens nothing by itself.
     */
    & Define.Prop<'loading', boolean, false>
    /** Rendered as `Combobox.Loading` by the data expansion while `loading`. */
    & Define.Prop<'loadingText', string, false>
    /** The data expansion renders a `Combobox.ClearTrigger` between the input and the trigger. */
    & Define.Prop<'clearable', boolean, false>
    & Define.Prop<'multiple', boolean, false>
    /**
     * Enter commits the typed text while no option is highlighted: the
     * option whose label it matches, else the text itself as the value
     * (narrowed per overload to string models).
     */
    & Define.Prop<'allowCustom', boolean, false>
    & Define.Prop<'placeholder', string, false>
    /** A pointer click on the input opens the popup (default false: typing and the arrows do). */
    & Define.Prop<'openOnClick', boolean, false>
    /**
     * Window the options (#96): only those near the popup's scroll position
     * are rendered. Takes the strategy from its own entry, so only a list
     * that windows pays for it (#119) — `virtual={virtualListbox}`, from
     * `@sigx/zero/virtual-listbox`. Data mode only (`items`, no children):
     * hand-written items register as they mount, so they render whole. With
     * `itemGroup` groups, each heading is a `group-heading` row its options
     * name through `aria-describedby` (#127); a group the query empties has
     * no row.
     */
    & Define.Prop<'virtual', ListboxWindowing, false>
    /** Under `virtual`: an option's height before it is measured, in px (default 36). */
    & Define.Prop<'estimateItemSize', number, false>
    /**
     * Trigger mode (#58): autocomplete a token typed into the
     * `Textarea.Textarea` or `Input.Input` (#106) inside the root — `'@'`
     * for mentions, `'/'` for commands, or a RegExp matched before the caret
     * whose first group is the query. Read at setup.
     */
    & Define.Prop<'trigger', string | RegExp, false>
    /**
     * Trigger mode: where the list opens (#105). Without it, against the
     * text control's box — the way a chat app docks its list to the
     * composer. `anchor={caretAnchor}` (from `@sigx/zero/behaviors`) opens it
     * beside the token being typed, measured in the control; it is passed
     * in, so only a composer that anchors at the caret ships the
     * measurement. Given the control and the index of the token's first
     * character; `null` falls back to the box. Under `rtl` a placement above
     * or below aligns to the reading direction (`bottom-start` opens leftwards
     * from the token), as every positioned popup does.
     */
    & Define.Prop<'anchor', TextAnchor, false>
    /**
     * Trigger mode: the text an option replaces the token with (#107), in
     * place of the default — the prefix, the label and a space. Inserted as
     * returned, with the caret after it: no space is added, and none is
     * stepped over. For mentions stored as ids (`@[Ada](user:42)`), no
     * trailing space, or an emoji for a `:` trigger.
     */
    & Define.Prop<'itemInsert', (detail: ComboboxItemInsertContext<T, InsertValue<M>>) => string, false>
    /** Trigger mode: an option replaced the token. */
    & Define.Event<'insert', ComboboxInsertDetail<InsertValue<M>>>
    & WithFormControl
    & WithReadonly
    & Define.Prop<'placement', Placement, false>
    /** Margin, px, the popup keeps from the viewport edges when flipping and shifting (default 8). */
    & Define.Prop<'collisionPadding', number, false>
    /** Cross-axis offset, px, from a `-start`/`-end` alignment (default 0). */
    & Define.Prop<'alignOffset', number, false>
    & Define.Prop<'positionStrategy', PositionStrategy, false>
    & WithVariantAxes<'combobox'>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'item', { item: T }>
    /** Per-tag content under `multiple` (data mode) — replaces the label + remove button. */
    & Define.Slot<'tag', ComboboxTagSlotProps<T>>
    & Define.Slot<'default'>;

/** What `insert` carries: the committed option's value and label, and the text that replaced the token. */
export interface ComboboxInsertDetail<V = unknown> {
    value: V;
    label: string;
    text: string;
}

/** What `itemInsert` is given: the option being committed, and the token it replaces. */
export interface ComboboxItemInsertContext<T = unknown, V = unknown> {
    /** The data item — `undefined` for a hand-written `Combobox.Item`. */
    item: T | undefined;
    /** The option's value — what `insert` carries. */
    value: V;
    /** The option's key. */
    key: string;
    label: string;
    /**
     * What the token keeps in front of the query: the trigger for a string
     * trigger; for a RegExp, whatever it matched before its first group
     * (whitespace included).
     */
    prefix: string;
    /** The typed query the option replaces. */
    query: string;
}

/** An option's value for the model shape `M` — one member of it. */
type InsertValue<M> = M extends readonly (infer E)[] ? E : NonNullable<M>;

/** What a tag's content slot receives: the key, its label, and the data item (absent for a custom value). */
export interface ComboboxTagSlotProps<T = unknown> {
    value: string;
    label: string;
    item: T | undefined;
}

/**
 * The implementation's props: the public type plus `itemValue`, which the
 * public type deliberately omits — declared there AND on the overloads, the
 * arrow's parameter would face an intersection of two signatures and lose
 * its contextual type, taking `T`'s inference with it. The overloads are
 * the one place it is typed.
 */
type ComboboxRootImplProps = ComboboxRootProps & Define.Prop<'itemValue', (item: unknown) => unknown, false>;

const ComboboxRootImpl = component<ComboboxRootImplProps>(({ props, slots, emit, signal, onMounted, onUnmounted, onUpdated }) => {
    // Trigger mode is a shape, not a state: read once, like the data mode.
    // An empty trigger could never start a token, so it is no trigger.
    const triggerMode = props.trigger !== undefined && props.trigger !== '';
    const multiple = (): boolean => !triggerMode && !!props.multiple;
    // Explicit children win ENTIRELY over `items`: with a default slot the
    // data is not rendered, so the collection must not hold it either — the
    // highlight, the typeahead and the hidden select follow what is rendered.
    // Without children the root is data-driven exactly when `items` was
    // given — an EMPTY list counts, sigx props being plain values that a
    // later list arrives into — so the mode never flips on what the list
    // holds, and an omitted `items` is the hand-written (string-model) shape
    // the overloads promise. The decision is REACTIVE (#172): an `items` that
    // is undefined on the first render (still loading) and arrives later
    // turns the root data-driven then — the collection's mode and the empty
    // sentinel follow; the '' seed reads as empty under either.
    // In trigger mode the children are the textarea, so `items` alone decides.
    const items = (): ReadonlyArray<unknown> | undefined =>
        (triggerMode ? props.items : slots.default || props.items === undefined ? undefined : props.items);
    const emptyValue = (): unknown => (items() ? null : '');
    // The seed is exactly what the consumer provided — an explicit
    // `defaultValue={null}` included — and the empty shape otherwise.
    const seed = (): unknown => (props.defaultValue !== undefined ? props.defaultValue : multiple() ? [] : emptyValue());
    const state = createControllableState<unknown>(
        () => props.model,
        seed(),
        (v) => emit('valueChange', v),
    );
    const inputValue = createControllableState<string>(
        () => props.inputValue,
        props.defaultInputValue ?? '',
        (v) => emit('inputValueChange', v),
    );
    const openState = createControllableState<boolean>(
        () => namedModel<boolean>(props.open),
        props.defaultOpen ?? false,
        (v) => emit('openChange', v),
    );
    const fc = createFormControl({ props: () => props, idBase: 'zx-combobox', controlPart: 'input' });
    const baseId = fc.baseId;
    const collection = createCollection<unknown, unknown>({
        items,
        mode: () => (items() !== undefined ? 'data' : 'jsx'),
        itemKey: props.itemKey,
        itemLabel: props.itemLabel,
        itemValue: props.itemValue,
        itemDisabled: props.itemDisabled,
        itemGroup: props.itemGroup,
    });
    const list = createListController();
    const inputFocusVisible = signal({ value: false });
    let control: HTMLElement | null = null;
    let input: HTMLElement | null = null;
    let trigger: HTMLElement | null = null;
    let popup: HTMLElement | null = null;
    let hidden: HTMLSelectElement | null = null;

    const setOpen = (v: boolean): void => {
        if (openState.value !== v) openState.value = v;
    };

    // Trigger mode commits text, not a selection: an option is never
    // `selected`, and the model is never written.
    const noSelection = { get value(): unknown { return ''; }, set value(_: unknown) {} };
    const trig = signal({ token: null as TriggerToken | null, dismissed: false, textId: '' });
    let textEl: HTMLTextAreaElement | HTMLInputElement | null = null;

    const listbox = createListbox<unknown>({
        collection,
        selection: triggerMode ? noSelection : state,
        multiple,
        list,
        idBase: baseId,
        query: () => inputValue.value,
        filter: props.filter,
        emptyValue,
        // A single selection fills the input with the label and closes; a
        // multiple one toggles, clears the query and stays open.
        onSelect: (key) => {
            if (triggerMode) { commit(key); return; }
            if (multiple()) { inputValue.value = ''; return; }
            // Remembered: a consumer-filtered item may unmount before the
            // text is next resynced from the value.
            inputValue.value = tagLabel(key);
            setOpen(false);
        },
    });
    // The hidden select's `<option selected>` attributes say it; the
    // property settles it in every DOM, after the options exist (#145).
    onUpdated(() => settleHiddenSelect(hidden, listbox.selectedKeys(), multiple()));

    // The hidden select's options: every item in data mode (autofill sees
    // the list), the selected keys alone in JSX mode — hand-written items
    // register during their own setup, after this root has rendered, so a
    // registry read here would be stale until an unrelated re-render.
    // The empty key is the single-mode placeholder AND the key model's empty
    // sentinel: an item keyed '' would be indistinguishable from "nothing
    // selected" (selecting it clears; it could neither post nor round-trip
    // from a platform write) — fail fast at every entry: the data expansion,
    // a hand-written item, the hidden select.
    const guardKeys = (keys: string[]): string[] => {
        // The key AND the value: an explicit itemKey can hide an itemValue of
        // '' — which the core reads as nothing selected, so it never selects.
        // Trigger mode has no selection, so no placeholder to collide with.
        if (!triggerMode && !multiple() && keys.some((k) => k === '' || collection.valueForKey(k) === '')) {
            throw new Error('[zero] Combobox: an item keyed or valued "" is reserved for the placeholder in single mode — give it a non-empty itemKey / itemValue');
        }
        return keys;
    };
    // Windowed: data mode. Groups window too (#127) — each one's heading
    // becomes a row of the window rather than an element containing it.
    const windowed = (): boolean => !!props.virtual && items() !== undefined;
    // What the windowing strategy renders from — the window registers
    // itself here as `current`. A new query scrolls back to the highlight,
    // or the top.
    const virtual: ListboxWindowHost = {
        scope: SCOPE,
        listbox,
        collection,
        idBase: baseId,
        open: () => openState.value,
        estimateSize: () => props.estimateItemSize,
        resetOn: () => inputValue.value,
        item: (item, index, size, heading) => dataItem(item, index, size, heading),
        heading: (group, id, ref) => (
            <div key={id} id={id} data-scope={SCOPE} data-part="group-heading" aria-hidden="true" ref={ref}>
                {group}
            </div>
        ),
        current: null,
    };
    /** PageUp/PageDown on a windowed list: a page of options. False when not handled. */
    const pageKey = (e: KeyboardEvent): boolean => {
        if ((e.key !== 'PageDown' && e.key !== 'PageUp') || !virtual.current || !openState.value) return false;
        e.preventDefault();
        const page = virtual.current.pageSize();
        listbox.move(e.key === 'PageDown' ? page : -page);
        return true;
    };

    // Data mode posts every item plus any chosen value the data does not
    // hold (a custom one, or one from a page not loaded) — the chosen values
    // alone when windowed: ten thousand hidden <option>s would undo what the
    // window saves.
    const hiddenKeys = (): string[] => {
        if (collection.mode() !== 'data' || windowed()) return guardKeys(listbox.selectedKeys());
        const keys = collection.keys();
        const known = new Set(keys);
        return guardKeys([...keys, ...listbox.selectedKeys().filter((k) => !known.has(k))]);
    };

    // A tag's label outlives its item: hand-written items are
    // consumer-filtered, so a chosen one unmounts as the query moves on and
    // the registry forgets its label — the last one seen stands in.
    const labels = new Map<string, string>();
    const tagLabel = (key: string): string => {
        if (collection.has(key)) {
            const label = collection.label(key);
            labels.set(key, label);
            return label;
        }
        return labels.get(key) ?? key;
    };
    const remove = (key: string): void => {
        if (fc.disabled() || fc.readonly()) return;
        if (!multiple()) {
            if (listbox.isSelected(key)) listbox.clear();
            return;
        }
        const current = Array.isArray(state.value) ? state.value : [];
        state.value = current.filter((v) => collection.keyForValue(v) !== key);
    };
    // allowCustom: the option (or chosen custom value) whose label the text
    // names, case-insensitively, else the text itself — a key the collection
    // does not hold is its own value (`valueForKey`) and its own label.
    const commitText = (text: string): void => {
        const lower = text.toLowerCase();
        const named = (k: string): boolean => tagLabel(k).toLowerCase() === lower;
        const key = listbox.selectedKeys().find(named)
            ?? collection.keys().find((k) => !collection.isDisabled(k) && named(k))
            ?? text;
        if (!multiple()) {
            if (key === '') return;
            state.value = collection.valueForKey(key);
            // Remembered, like onSelect: the named option may have unmounted.
            inputValue.value = tagLabel(key);
            setOpen(false);
            return;
        }
        if (!listbox.isSelected(key)) {
            const current = Array.isArray(state.value) ? state.value : [];
            state.value = [...current, collection.valueForKey(key)];
        }
        inputValue.value = '';
    };

    /**
     * Resync the text with the value (#265) — on a close, and on a blur
     * that leaves the combobox — so what the input shows is what posts.
     * Single mode: empty text clears the value; other text reverts to the
     * value's label ('' for none). `allowCustom` commits the text instead.
     * Multiple mode: the typed query is dropped (the tags are the value).
     */
    const commitInputText = (): void => {
        if (triggerMode || fc.disabled() || fc.readonly()) return;
        const text = inputValue.value;
        if (multiple()) {
            if (text !== '') inputValue.value = '';
            return;
        }
        const keys = listbox.selectedKeys();
        if (text.trim() === '') {
            if (keys.length > 0) listbox.clear();
            if (inputValue.value !== '') inputValue.value = '';
            return;
        }
        if (props.allowCustom) {
            commitText(text.trim());
            return;
        }
        const display = keys.length > 0 ? tagLabel(keys[0]!) : '';
        if (text !== display) inputValue.value = display;
    };

    // ── Trigger mode ──

    /** Where the token's own text starts: past any whitespace a RegExp prefix matched. */
    const tokenStart = (token: TriggerToken): number => token.start + token.prefix.length - token.prefix.trimStart().length;
    const sameToken = (a: TriggerToken | null, b: TriggerToken | null): boolean =>
        a === b || (!!a && !!b && a.start === b.start && a.end === b.end && a.query === b.query && a.prefix === b.prefix);

    /** Re-read the token at the caret — after input (`edited`), keyup and click. */
    const syncToken = (edited = false): void => {
        const el = textEl;
        const trigger = props.trigger;
        if (!el || trigger === undefined) return;
        // An edit un-dismisses: Escape holds only until the next one.
        if (edited && trig.dismissed) trig.dismissed = false;
        const start = el.selectionStart ?? el.value.length;
        const next = start === el.selectionEnd ? triggerTokenAt(el.value, start, trigger) : null;
        if (!sameToken(trig.token, next)) trig.token = next;
        const query = next?.query ?? '';
        if (inputValue.value !== query) inputValue.value = query;
    };

    /**
     * Replace the token with the option. Through `insertText` where the
     * engine has it, so the edit lands on the undo stack and the textarea's
     * own `input` updates its model; else written and announced by hand.
     */
    const commit = (key: string): void => {
        const el = textEl;
        const token = trig.token;
        if (!el || !token) return;
        const label = collection.label(key);
        // The implementation's `M` is `unknown`, so an option's value type is
        // `NonNullable<unknown>`; only that is asserted, the shapes stay checked.
        const value = collection.valueForKey(key) as NonNullable<unknown>;
        const custom = props.itemInsert;
        // By default one space after the label — the one already there, if
        // a space follows the token (the caret steps over it), else a new
        // one. A custom text is inserted as returned.
        const spaced = !custom && /[ \t]/.test(el.value.charAt(token.end));
        const text = custom
            ? custom({ item: collection.byKey(key), value, key, label, prefix: token.prefix, query: token.query })
            : `${token.prefix}${label}${spaced ? '' : ' '}`;
        const replaced = replaceToken(el.value, token, text);
        const next = { text: replaced.text, caret: replaced.caret + (spaced ? 1 : 0) };
        el.focus();
        el.setSelectionRange(token.start, token.end);
        let inserted = false;
        try {
            inserted = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text);
        } catch {
            inserted = false;
        }
        if (!inserted || el.value !== next.text) {
            el.value = next.text;
            el.setSelectionRange(next.caret, next.caret);
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        el.setSelectionRange(next.caret, next.caret);
        // The model's re-render writes the same value back; the caret must
        // survive it.
        queueMicrotask(() => {
            if (textEl === el && el.ownerDocument.activeElement === el) el.setSelectionRange(next.caret, next.caret);
        });
        syncToken(true);
        emit('insert', { value, label, text });
    };

    const triggerKeydown = (e: KeyboardEvent): boolean => {
        if (e.isComposing || !openState.value) return false;
        if (pageKey(e)) return true;
        const key = e.key;
        if (key === 'ArrowDown' || key === 'ArrowUp') {
            e.preventDefault();
            listbox.move(key === 'ArrowDown' ? 1 : -1);
            return true;
        }
        if (key === 'Enter' || key === 'Tab') {
            // Shift+Enter is still a line break, Shift+Tab still leaves.
            if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return false;
            const h = listbox.highlighted.value;
            if (h === null) return false;
            e.preventDefault();
            listbox.select(h);
            return true;
        }
        if (key === 'Escape') {
            e.preventDefault();
            trig.dismissed = true;
            return true;
        }
        return false;
    };

    if (triggerMode) {
        let claimed = false;
        const binding: TextControlBinding = {
            claim: () => {
                if (claimed) return null;
                claimed = true;
                const claim: TextControlClaim = {
                    // A combobox for the popup's lifetime (#58); a textbox
                    // that autocompletes the rest of the time.
                    attrs: () => {
                        const open = openState.value;
                        return {
                            role: open ? 'combobox' : undefined,
                            'aria-autocomplete': 'list',
                            'aria-expanded': open ? 'true' : undefined,
                            'aria-controls': ctx.ids.popup,
                            'aria-activedescendant': listbox.activeDescendant(open),
                        };
                    },
                    keydown: triggerKeydown,
                    sync: syncToken,
                    blur: (e) => {
                        const to = e.relatedTarget as Node | null;
                        if (to && popup?.contains(to)) return;
                        trig.token = null;
                    },
                    setElement: (el) => {
                        textEl = el;
                        if (el && trig.textId !== el.id) trig.textId = el.id;
                    },
                    release: () => {
                        claimed = false;
                        textEl = null;
                        trig.token = null;
                        trig.textId = '';
                    },
                };
                return claim;
            },
        };
        defineProvide(useTextControlBinding, () => binding);

        // Open while a token is at the caret, not dismissed, and something
        // (or `emptyText`) is there to show.
        effect(() => {
            setOpen(!!trig.token && !trig.dismissed && !fc.disabled() && !fc.readonly()
                && (!listbox.isEmpty() || props.emptyText !== undefined
                    || (!!props.loading && props.loadingText !== undefined)));
        });
        // The first option is highlighted on open and whenever the query
        // moves, so Enter commits the best match at once.
        let lastQuery: string | null = null;
        effect(() => {
            const open = openState.value;
            const query = inputValue.value;
            const visible = listbox.visibleKeys();
            const h = listbox.highlighted.value;
            if (!open) { lastQuery = null; return; }
            if (query !== lastQuery || h === null || !visible.includes(h)) {
                lastQuery = query;
                listbox.move('first');
            }
        });
    }

    // A close clears the highlight however the open state was written (a
    // consumer's `model:open` included); an open leaves it to the arrows.
    // It also resyncs the text (#265): Escape, Tab, an outside press, the
    // trigger's toggle — a closed list never leaves a stray query behind.
    watch(
        () => openState.value,
        (open) => {
            if (open) return;
            listbox.highlighted.value = null;
            untrack(commitInputText);
        },
    );

    const syncHidden = (): void => {
        queueMicrotask(() => {
            if (!hidden) return;
            const keys = listbox.selectedKeys();
            if (multiple()) {
                const selected = new Set(keys);
                for (const o of Array.from(hidden.options)) o.selected = selected.has(o.value);
            } else if (hidden.value !== (keys[0] ?? '')) {
                hidden.value = keys[0] ?? '';
            }
        });
    };
    let detachReset = (): void => {};
    const scoped = mountScope();
    onMounted(() => scoped(() => {
        effect(() => { listbox.selectedKeys(); syncHidden(); });
        // Without a name there is no hidden select — the input itself is
        // form-associated, so reset still restores.
        detachReset = onFormReset(() => hidden ?? (input as HTMLInputElement | null), () => {
            state.value = seed();
            inputValue.value = props.defaultInputValue ?? (multiple() ? '' : listbox.displayText());
            syncHidden();
            if (input) (input as HTMLInputElement).value = inputValue.value;
        });
    }));
    onUnmounted(() => detachReset());

    const ctx: ComboboxContext = {
        state,
        inputValue,
        collection,
        listbox,
        list,
        open: {
            get value() { return openState.value; },
            set value(v: boolean) { setOpen(v); },
        },
        ids: { trigger: `${baseId}-trigger`, popup: `${baseId}-popup` },
        placeholder: () => props.placeholder,
        multiple,
        tagLabel,
        remove,
        clearable: () => !triggerMode && (inputValue.value !== '' || listbox.selectedKeys().length > 0),
        clear: () => {
            if (fc.disabled() || fc.readonly()) return;
            if (listbox.selectedKeys().length > 0) {
                if (multiple()) state.value = [];
                else listbox.clear();
            }
            if (inputValue.value !== '') inputValue.value = '';
            ctx.focusInput();
        },
        loading: () => !!props.loading,
        guardKey: (key) => { guardKeys([key]); },
        disabled: fc.disabled,
        invalid: fc.invalid,
        required: fc.required,
        readonly: fc.readonly,
        describedBy: fc.describedBy,
        inputId: fc.controlId,
        inputFocusVisible,
        setControl: (el) => { control = el; },
        setInput: (el) => { input = el; },
        setTrigger: (el) => { trigger = el; },
        setPopup: (el) => { popup = el; },
        focusInput: () => { (input ?? textEl)?.focus(); },
        inputKeydown(e) {
            if (ctx.disabled() || ctx.readonly()) return;
            if (pageKey(e)) return;
            const key = e.key;
            if (e.altKey && (key === 'ArrowDown' || key === 'ArrowUp')) {
                // APG: Alt+Down opens without moving the highlight — onto
                // the chosen option if it is listed, else none; Alt+Up
                // commits the highlight and closes.
                if (key === 'ArrowDown') {
                    e.preventDefault();
                    if (openState.value) return;
                    setOpen(true);
                    const chosen = listbox.selectedKeys()[0];
                    if (chosen !== undefined && listbox.isVisible(chosen) && !collection.isDisabled(chosen)) {
                        listbox.highlighted.value = chosen;
                    }
                    return;
                }
                if (!openState.value) return;
                e.preventDefault();
                const h = listbox.highlighted.value;
                if (h != null) listbox.select(h);
                setOpen(false);
                return;
            }
            if (key === 'ArrowDown' || key === 'ArrowUp') {
                e.preventDefault();
                if (!openState.value) {
                    setOpen(true);
                    listbox.move(key === 'ArrowDown' ? 'first' : 'last');
                    return;
                }
                listbox.move(key === 'ArrowDown' ? 1 : -1);
                return;
            }
            if (key === 'Enter') {
                const h = listbox.highlighted.value;
                if (openState.value && h != null) {
                    // Only swallow Enter while it means "pick the highlight"
                    // or "commit the text" — otherwise the form submit proceeds.
                    e.preventDefault();
                    listbox.select(h);
                    return;
                }
                const text = inputValue.value.trim();
                if (props.allowCustom && text !== '') {
                    e.preventDefault();
                    commitText(text);
                }
                return;
            }
            if (key === 'Backspace') {
                // Backspace on an empty input removes the last tag.
                const keys = listbox.selectedKeys();
                if (multiple() && inputValue.value === '' && keys.length > 0) remove(keys[keys.length - 1]!);
                return;
            }
            if (key === 'Escape') {
                if (openState.value) {
                    // The close reverts the text (the open watch).
                    e.preventDefault();
                    setOpen(false);
                    return;
                }
                // Closed: Escape clears (APG) — the text, and in single
                // mode the value with it, so nothing posts that the input
                // no longer shows. Swallowed only when it cleared something:
                // an empty combobox lets Escape reach an enclosing layer.
                const single = !multiple();
                const hasValue = single && listbox.selectedKeys().length > 0;
                if (inputValue.value === '' && !hasValue) return;
                e.preventDefault();
                if (hasValue) listbox.clear();
                if (inputValue.value !== '') inputValue.value = '';
                return;
            }
            if (key === 'Tab') {
                // An open list's close resyncs (the open watch); a closed
                // one resyncs here.
                if (openState.value) setOpen(false);
                else commitInputText();
                return;
            }
            // Home/End & the rest stay with the text caret (APG editable
            // combobox) — no typeahead: typing IS the filter.
        },
        onInput(value) {
            inputValue.value = value;
            if (!openState.value && !ctx.disabled() && !ctx.readonly()) setOpen(true);
        },
        inputClick() {
            if (props.openOnClick && !openState.value && !ctx.disabled() && !ctx.readonly()) setOpen(true);
        },
        inputBlur(e) {
            // Focus moving within the combobox (the trigger, a tag's remove)
            // is not leaving it. Nowhere, with the list open, is a press on
            // the list (its options take no focus) or outside it — the
            // option's click selects; the outside press closes, and the
            // close resyncs.
            const to = e.relatedTarget as Node | null;
            if (to && (control?.contains(to) || popup?.contains(to) || trigger?.contains(to))) return;
            if (!to && openState.value) return;
            if (openState.value) setOpen(false);
            else commitInputText();
        },
        triggerMode: () => triggerMode,
        labelledBy: () => (triggerMode ? trig.textId || undefined : fc.controlId()),
        virtual,
    };
    defineProvide(useComboboxContext, () => ctx);

    // Trigger mode anchors at the token (#105): the character after any
    // whitespace a RegExp trigger's prefix matched — the `@` itself. The
    // caret anchor carries the control as its context element, so under
    // `rtl` the strategy aligns a `-start` placement to the token's reading
    // start (the list opens leftwards from it).
    const caretAt = (): PositionAnchor | null => {
        const token = trig.token;
        if (!triggerMode || !textEl || !token || !props.anchor) return null;
        return props.anchor(textEl, tokenStart(token));
    };
    const position = createAnchorPosition({
        getAnchor: () => caretAt() ?? control ?? input ?? textEl,
        getFloating: () => popup,
        isOpen: () => openState.value,
        placement: () => props.placement ?? 'bottom-start',
        offset: () => 4,
        collisionPadding: () => props.collisionPadding,
        alignOffset: () => props.alignOffset,
        strategy: props.positionStrategy,
    });
    // A new token, or the typed query rewrapping the line the token is on —
    // a new place for the list, without a close in between.
    if (triggerMode) watch(() => trig.token, (token) => { if (token) position.update(); });

    // popover="manual" opts out of native light dismiss (a caret click in
    // the input must not close the list), so dismissal is the layer stack's:
    // outside-press only; Escape stays with inputKeydown, its one owner.
    createDismissable({
        getElement: () => popup,
        isOpen: () => openState.value,
        dismiss: () => { if (triggerMode) trig.dismissed = true; else setOpen(false); },
        escape: false,
        getExtraTargets: () => [control, input, trigger, textEl],
    });

    // A preset value's label reaches the input at setup — from data, before
    // any item mounts (hand-written items reflect on mount instead).
    if (!triggerMode && !multiple() && collection.mode() === 'data' && inputValue.value === '' && listbox.selectedKeys().length > 0) {
        inputValue.value = listbox.displayText();
    }

    // An external value write (form reset, server data) reflects into the
    // input text — from the collection, so before any item mounts.
    watch(
        () => state.value,
        (value, prev) => {
            if (value === prev || multiple() || triggerMode) return;
            const text = listbox.displayText();
            if (inputValue.value !== text) inputValue.value = text;
        },
    );

    // The data expansion: the default composition through the same parts.
    // Windowed, only a window is in the accessibility tree: each option
    // says where it stands in the whole visible list.
    const dataItem = (item: unknown, index?: number, size?: number, heading?: string): JSXElement => (
        <ComboboxItem
            value={collection.keyOf(item)}
            textValue={collection.labelOf(item)}
            disabled={collection.isItemDisabled(item)}
            aria-setsize={size}
            aria-posinset={index === undefined ? undefined : index + 1}
            aria-describedby={heading}
            key={collection.keyOf(item)}
        >
            {slots.item ? slots.item({ item }) : collection.labelOf(item)}
        </ComboboxItem>
    );
    const dataContent = (): JSXElement => {
        guardKeys(collection.keys());
        return (
        <>
            <ComboboxControl>
                {multiple()
                    ? (slots.tag ? <ComboboxTags slots={{ default: (p: ComboboxTagSlotProps) => slots.tag!(p) }} /> : <ComboboxTags />)
                    : null}
                <ComboboxInput />
                {props.clearable ? <ComboboxClearTrigger /> : null}
                <ComboboxTrigger />
            </ComboboxControl>
            {dataPopup()}
        </>
        );
    };
    const dataPopup = (): JSXElement => (
            <ComboboxPopup>
                {props.loading && props.loadingText !== undefined
                    ? <ComboboxLoading>{props.loadingText}</ComboboxLoading>
                    : null}
                {listbox.visibleItems().length === 0 && props.emptyText !== undefined
                    ? <ComboboxEmpty>{props.emptyText}</ComboboxEmpty>
                    : null}
                {windowed()
                    ? props.virtual!.render(virtual)
                    : collection.segments().map((segment) => {
                        const visible = segment.items.filter((i) => listbox.isVisible(collection.keyOf(i)));
                        if (visible.length === 0) return null;
                        return segment.group === undefined
                            ? visible.map((i) => dataItem(i))
                            : (
                                <ComboboxGroup key={`group:${segment.group}`}>
                                    <ComboboxGroupLabel>{segment.group}</ComboboxGroupLabel>
                                    {visible.map((i) => dataItem(i))}
                                </ComboboxGroup>
                            );
                    })}
            </ComboboxPopup>
    );

    return () => (
        <div
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="root"
            {...fc.flags()}
            data-readonly={dataAttr(ctx.readonly())}
            {...fc.axisAttrs()}
            class={props.class}
        >
            {/* Explicit children win ENTIRELY over `items` — no merging —
                except in trigger mode, where they are the textarea. */}
            {triggerMode
                ? <>{slots.default?.()}{items() ? dataPopup() : null}</>
                : slots.default ? slots.default() : items() ? dataContent() : null}
            {!triggerMode && fc.hasName()
                ? (
                    <select
                        data-scope={SCOPE}
                        data-part="hidden-input"
                        style={VISUALLY_HIDDEN_STYLE}
                        {...fc.hiddenAttrs()}
                        multiple={multiple()}
                        required={ctx.required()}
                        tabIndex={-1}
                        aria-hidden="true"
                        ref={(node: HTMLSelectElement | null) => { hidden = node; }}
                        // The platform's bubble would anchor to a 1px element:
                        // cancel it and land focus where the user can act.
                        onInvalid={(e: Event) => { e.preventDefault(); ctx.focusInput(); }}
                        // The platform writes the hidden select itself (autofill,
                        // form restoration): its selection flows back into the model.
                        onChange={() => {
                            if (!hidden) return;
                            // Only the single-mode placeholder carries the empty key;
                            // under `multiple` an empty-string key is a real item.
                            const keys = Array.from(hidden.options)
                                .filter((o) => o.selected && (multiple() || o.value !== ''))
                                .map((o) => o.value);
                            state.value = multiple()
                                ? keys.map((k) => collection.valueForKey(k))
                                : keys.length > 0 ? collection.valueForKey(keys[0]!) : emptyValue();
                        }}
                    >
                        {multiple() ? null : <option value="" selected={listbox.selectedKeys().length === 0}>{props.placeholder ?? ''}</option>}
                        {hiddenKeys().map((k) => (
                            <option value={k} selected={listbox.isSelected(k)} disabled={collection.isDisabled(k)} key={k}>{collection.label(k)}</option>
                        ))}
                    </select>
                )
                : null}
        </div>
    );
}, { name: 'Combobox.Root' });

/** The generic root — the same narrowing as `Select.Root`. */
export type ComboboxRoot = {
    // `defaultValue` is typed here rather than on the shared props: declared
    // there as `M`, TypeScript stops inferring `T` for the `itemValue`
    // overload (an inference-priority quirk the type test pins).
    // Hand-written items (no `items`): a key IS its value, so the model is
    // the <select>'s string — '' for nothing selected — or string[].
    (props: JsxProps<ComboboxRootProps<unknown, string>> & { items?: undefined; defaultValue?: string; itemValue?: undefined; multiple?: false }): JSXElement;
    (props: JsxProps<ComboboxRootProps<unknown, string[]>> & { items?: undefined; defaultValue?: string[]; itemValue?: undefined; multiple: true }): JSXElement;
    // An item model is `T | null`: nothing selected is `null` (the runtime
    // writes it on clear, reset and a platform write), never a fake item.
    // `items` may be `undefined` while a list loads (`items={query.data}`,
    // #172): a present-but-undefined prop is still this data shape.
    // `allowCustom` commits the TEXT as the value, so it types only where the
    // model is a string: hand-written items, string items, a string itemValue.
    <T>(props: JsxProps<ComboboxRootProps<T, T | null>> & { items: ReadonlyArray<T> | undefined; defaultValue?: T | null; itemValue?: undefined; multiple?: false; allowCustom?: CustomFor<T> }): JSXElement;
    <T>(props: JsxProps<ComboboxRootProps<T, T[]>> & { items: ReadonlyArray<T> | undefined; defaultValue?: T[]; itemValue?: undefined; multiple: true; allowCustom?: CustomFor<T> }): JSXElement;
    // A value model is `V | null` for the same reason — V is whatever
    // `itemValue` returns (a number as readily as a string), so no member of
    // it can stand for "nothing selected".
    <T, V>(props: JsxProps<ComboboxRootProps<T, V | null>> & { items: ReadonlyArray<T> | undefined; defaultValue?: V | null; itemValue: (item: T) => V; multiple?: false; allowCustom?: CustomFor<V> }): JSXElement;
    <T, V>(props: JsxProps<ComboboxRootProps<T, V[]>> & { items: ReadonlyArray<T> | undefined; defaultValue?: V[]; itemValue: (item: T) => V; multiple: true; allowCustom?: CustomFor<V> }): JSXElement;
} & FactoryBrands;

/** `allowCustom` is open only to a string model — free text can be nothing else. */
type CustomFor<M> = [M] extends [string] ? boolean : false;

const ComboboxRoot = ComboboxRootImpl as unknown as ComboboxRoot;

// ── Control ──

export type ComboboxControlProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

const ComboboxControl = component<ComboboxControlProps>(({ props, slots }) => {
    const combobox = useComboboxContext();
    return () => (
        <div
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="control"
            data-state={stateAttr(combobox.open.value, 'open', 'closed')}
            data-disabled={dataAttr(combobox.disabled())}
            data-invalid={dataAttr(combobox.invalid())}
            data-focus-visible={dataAttr(combobox.inputFocusVisible.value)}
            class={props.class}
            ref={(node: HTMLElement | null) => { combobox.setControl(node); }}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Combobox.Control' });

// ── Tags / Tag / TagLabel / TagRemove ──

interface ComboboxTagContext {
    value(): string;
    label(): string;
}

export const useComboboxTagContext = defineInjectable<ComboboxTagContext>(() => ({ value: () => '', label: () => '' }));

export type ComboboxTagsProps = Define.Slot<'default', ComboboxTagSlotProps>;

/**
 * One `Combobox.Tag` per chosen value, in selection order. Renders no
 * element of its own — the tags sit directly in the control. The scoped
 * default slot is each tag's content (label + remove when absent).
 */
const ComboboxTags = component<ComboboxTagsProps>(({ slots }) => {
    const combobox = useComboboxContext();
    return () => (
        <>
            {combobox.listbox.selectedKeys().map((key) => (slots.default
                ? (
                    <ComboboxTag value={key} key={key}>
                        {slots.default({ value: key, label: combobox.tagLabel(key), item: combobox.collection.byKey(key) })}
                    </ComboboxTag>
                )
                : <ComboboxTag value={key} key={key} />))}
        </>
    );
}, { name: 'Combobox.Tags' });

export type ComboboxTagProps =
    /** The chosen value's key (what an item's `value` is). */
    & Define.Prop<'value', string, true>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const ComboboxTag = component<ComboboxTagProps>(({ props, slots }) => {
    const combobox = useComboboxContext();
    const ctx: ComboboxTagContext = {
        value: () => props.value,
        label: () => combobox.tagLabel(props.value),
    };
    defineProvide(useComboboxTagContext, () => ctx);
    return () => (
        <span
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="tag"
            data-disabled={dataAttr(combobox.disabled())}
            class={props.class}
        >
            {slots.default
                ? slots.default()
                : (
                    <>
                        <ComboboxTagLabel />
                        <ComboboxTagRemove />
                    </>
                )}
        </span>
    );
}, { name: 'Combobox.Tag' });

export type ComboboxTagLabelProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

/** The tag's text — its label unless children replace it. */
const ComboboxTagLabel = component<ComboboxTagLabelProps>(({ props, slots }) => {
    const tag = useComboboxTagContext();
    return () => (
        <span {...htmlAttrs(props)} data-scope={SCOPE} data-part="tag-label" class={props.class}>
            {slots.default ? slots.default() : tag.label()}
        </span>
    );
}, { name: 'Combobox.TagLabel' });

export type ComboboxTagRemoveProps =
    /** Accessible name (default `Remove <label>`). */
    & Define.Prop<'label', string, false>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const ComboboxTagRemove = component<ComboboxTagRemoveProps>(({ props, slots, signal }) => {
    const combobox = useComboboxContext();
    const tag = useComboboxTagContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const disabled = (): boolean => combobox.disabled() || combobox.readonly();
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: disabled,
    });
    return () => {
        const attrs = htmlAttrs(props);
        return (
            <button
                {...attrs}
                type="button"
                data-scope={SCOPE}
                data-part="tag-remove"
                data-disabled={dataAttr(disabled())}
                data-focus-visible={dataAttr(focus.visible)}
                aria-label={props.label ?? attrs['aria-label'] ?? `Remove ${tag.label()}`}
                disabled={disabled()}
                class={props.class}
                ref={(node: HTMLElement | null) => { el = node; }}
                onClick={() => {
                    if (disabled()) return;
                    combobox.remove(tag.value());
                    // The button leaves with its tag: focus goes where typing resumes.
                    combobox.focusInput();
                }}
                onKeydown={press.onKeydown}
                onKeyup={press.onKeyup}
                onFocus={() => { focus.visible = isFocusVisible(el); }}
                onBlur={(e: FocusEvent) => {
                    press.onBlur(e);
                    focus.visible = false;
                }}
                onPointerdown={press.onPointerdown}
                onPointerup={press.onPointerup}
                onPointercancel={press.onPointercancel}
                onPointerleave={press.onPointerleave}
            >
                {slots.default ? slots.default() : <span aria-hidden="true">×</span>}
            </button>
        );
    };
}, { name: 'Combobox.TagRemove' });

// ── Input ──

export type ComboboxInputProps =
    & Define.Prop<'placeholder', string, false>
    & WithClass
    /**
     * Not `id`/`role`: the Field's label and the popup point at the input,
     * which is the `combobox`. An app `aria-describedby` joins the Field's.
     */
    & Omit<WithHtmlAttrs, 'id' | 'role'>;

const ComboboxInput = component<ComboboxInputProps>(({ props }) => {
    const combobox = useComboboxContext();
    let el: HTMLElement | null = null;

    return () => {
        const attrs = htmlAttrs(props);
        return (
            <input
                {...attrs}
                id={combobox.inputId()}
                type="text"
                data-scope={SCOPE}
                data-part="input"
                data-state={stateAttr(combobox.open.value, 'open', 'closed')}
                data-disabled={dataAttr(combobox.disabled())}
                data-invalid={dataAttr(combobox.invalid())}
                data-required={dataAttr(combobox.required())}
                data-readonly={dataAttr(combobox.readonly())}
                data-focus-visible={dataAttr(combobox.inputFocusVisible.value)}
                role="combobox"
                aria-expanded={combobox.open.value ? 'true' : 'false'}
                aria-controls={combobox.ids.popup}
                aria-autocomplete="list"
                aria-activedescendant={combobox.listbox.activeDescendant(combobox.open.value)}
                aria-invalid={combobox.invalid() ? 'true' : undefined}
                aria-describedby={[combobox.describedBy(), attrs['aria-describedby']].filter(Boolean).join(' ') || undefined}
                placeholder={props.placeholder ?? combobox.placeholder()}
                value={combobox.inputValue.value}
                disabled={combobox.disabled()}
                readOnly={combobox.readonly()}
                required={combobox.required()}
                class={props.class}
                ref={(node: HTMLElement | null) => { el = node; combobox.setInput(node); }}
                onInput={(e: Event) => { combobox.onInput((e.target as HTMLInputElement).value); }}
                onKeydown={(e: KeyboardEvent) => { combobox.inputKeydown(e); }}
                onFocus={() => { combobox.inputFocusVisible.value = isFocusVisible(el); }}
                onClick={() => { combobox.inputClick(); }}
                onBlur={(e: FocusEvent) => {
                    combobox.inputFocusVisible.value = false;
                    combobox.inputBlur(e);
                }}
            />
        );
    };
}, { name: 'Combobox.Input' });

// ── Trigger ──

export type ComboboxTriggerProps =
    /** Accessible name for the disclosure button (default "Show options"). */
    & Define.Prop<'label', string, false>
    & WithClass
    /** Not `id`: the trigger's own is minted with the root's. */
    & Omit<WithHtmlAttrs, 'id'>
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const ComboboxTrigger = component<ComboboxTriggerProps>(({ props, slots, signal }) => {
    const combobox = useComboboxContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => combobox.disabled(),
    });

    const bag = (): PartProps => {
        const attrs = htmlAttrs(props);
        return {
            ...attrs,
            id: combobox.ids.trigger,
            'data-scope': SCOPE,
            'data-part': 'trigger',
            'data-state': stateAttr(combobox.open.value, 'open', 'closed'),
            'data-disabled': dataAttr(combobox.disabled()),
            'data-focus-visible': dataAttr(focus.visible),
            // Focus lives in the input; the button is a pointer affordance.
            tabIndex: -1,
            'aria-label': props.label ?? attrs['aria-label'] ?? 'Show options',
            'aria-expanded': combobox.open.value ? 'true' : 'false',
            'aria-controls': combobox.ids.popup,
            onClick: () => {
                if (combobox.disabled() || combobox.readonly()) return;
                combobox.open.value = !combobox.open.value;
                combobox.focusInput();
            },
            onKeydown: press.onKeydown,
            onKeyup: press.onKeyup,
            onFocus: () => { focus.visible = isFocusVisible(el); },
            onBlur: (e: FocusEvent) => {
                press.onBlur(e);
                focus.visible = false;
            },
            onPointerdown: press.onPointerdown,
            onPointerup: press.onPointerup,
            onPointercancel: press.onPointercancel,
            onPointerleave: press.onPointerleave,
            ref: (node: HTMLElement | null) => { el = node; combobox.setTrigger(node); },
        };
    };

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <button type="button" class={props.class} {...b} disabled={combobox.disabled()}>
                {slots.default?.(b) ?? '▾'}
            </button>
        );
    };
}, { name: 'Combobox.Trigger' });

// ── ClearTrigger ──

export type ComboboxClearTriggerProps =
    /** Accessible name (default "Clear"). */
    & Define.Prop<'label', string, false>
    & WithClass
    & WithHtmlAttrs
    /** The mark (default `×`, aria-hidden). */
    & Define.Slot<'default'>;

/**
 * Clears the value (`null`, `''` for hand-written items, `[]` under
 * `multiple`) and the text, and puts focus back in the input. A pointer
 * affordance like the trigger (`tabIndex=-1`; Escape is the keyboard's
 * clear), rendered only while there is something to clear and the
 * combobox is editable.
 */
const ComboboxClearTrigger = component<ComboboxClearTriggerProps>(({ props, slots }) => {
    const combobox = useComboboxContext();
    return () => {
        if (!combobox.clearable() || combobox.disabled() || combobox.readonly()) return null;
        const attrs = htmlAttrs(props);
        return (
            <button
                {...attrs}
                type="button"
                data-scope={SCOPE}
                data-part="clear-trigger"
                tabIndex={-1}
                aria-label={props.label ?? attrs['aria-label'] ?? 'Clear'}
                class={props.class}
                onClick={() => { combobox.clear(); }}
            >
                {slots.default ? slots.default() : <span aria-hidden="true">×</span>}
            </button>
        );
    };
}, { name: 'Combobox.ClearTrigger' });

// ── Popup ──

export type ComboboxPopupProps =
    & WithClass
    /** Not `id`/`role`: the input points at the popup, which is the `listbox`. */
    & Omit<WithHtmlAttrs, 'id' | 'role'>
    & Define.Slot<'default'>;

const ComboboxPopup = component<ComboboxPopupProps>(({ props, slots, onMounted }) => {
    const combobox = useComboboxContext();
    let el: HTMLElement | null = null;

    const scoped = mountScope();
    onMounted(() => scoped(() => { syncPopover(() => el, () => combobox.open.value); }));

    return () => {
        const attrs = htmlAttrs(props);
        return (
            <div
                {...attrs}
                id={combobox.ids.popup}
                data-scope={SCOPE}
                data-part="popup"
                data-state={stateAttr(combobox.open.value, 'open', 'closed')}
                popover="manual"
                role="listbox"
                aria-multiselectable={combobox.multiple() ? 'true' : undefined}
                aria-busy={combobox.loading() ? 'true' : undefined}
                aria-labelledby={[combobox.labelledBy(), attrs['aria-labelledby']].filter(Boolean).join(' ') || undefined}
                class={props.class}
                ref={(node: HTMLElement | null) => { el = node; combobox.setPopup(node); }}
                // Trigger mode: a press on the list must not take focus (and
                // the caret) out of the textarea it is completing.
                onMousedown={combobox.triggerMode() ? (e: MouseEvent) => e.preventDefault() : undefined}
            >
                {slots.default?.()}
            </div>
        );
    };
}, { name: 'Combobox.Popup' });

// ── Item ──

export type ComboboxItemProps =
    & Define.Prop<'value', string, true>
    & Define.Prop<'textValue', string, false>
    & WithDisabled
    & WithClass
    /** Not `id`/`role`: the input's active descendant is the item's id, an `option`. */
    & Omit<WithHtmlAttrs, 'id' | 'role'>
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const ComboboxItem = component<ComboboxItemProps>(({ props, slots, onMounted, onUnmounted }) => {
    const combobox = useComboboxContext();
    let el: HTMLElement | null = null;
    // Pointer-only press: keyboard selection lives on the input
    // (aria-activedescendant — focus never reaches the option).
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => !!props.disabled,
    });

    combobox.guardKey(props.value);
    // A windowed option is measured by the window; its key never changes
    // (the rows are keyed by it), so neither does the measuring ref.
    const measure = combobox.virtual.current?.measureRef(props.value);
    const item = createListboxItem({
        listbox: combobox.listbox,
        collection: combobox.collection,
        list: combobox.list,
        scope: SCOPE,
        key: () => props.value,
        textValue: () => props.textValue,
        disabled: () => !!props.disabled,
        getEl: () => el,
        collect: measure === undefined,
        afterSelect: () => combobox.focusInput(),
    });
    const setEl = (node: HTMLElement | null): void => {
        el = node;
        measure?.(node);
    };
    onMounted(() => {
        // Hand-written items: a value set before this item existed could
        // not reflect its label into the input (the collection only learns
        // the label from the element). Deferred: a write during the mount
        // pass is invisible to the already-rendered input.
        queueMicrotask(() => {
            if (combobox.multiple() || !item.isSelected()) return;
            const current = combobox.inputValue.value;
            // Never clobber a user-typed query — only fill emptiness or the
            // raw-key fallback.
            if (current === '' || current === props.value) {
                combobox.inputValue.value = combobox.collection.label(props.value);
            }
        });
    });
    onUnmounted(() => item.unregister());

    const bag = (): PartProps => ({
        ...htmlAttrs(props),
        ...item.bag(),
        onPointerdown: press.onPointerdown,
        onPointerup: press.onPointerup,
        onPointercancel: press.onPointercancel,
        onPointerleave: press.onPointerleave,
        ref: setEl,
    });

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <div class={props.class} {...b}>
                {slots.default?.(b)}
                {item.isSelected()
                    ? (
                        <span data-scope={SCOPE} data-part="item-indicator" data-selected="" aria-hidden="true">
                            ✓
                        </span>
                    )
                    : null}
            </div>
        );
    };
}, { name: 'Combobox.Item' });

// ── Empty ──

/** Not `role`: the empty state is `presentation` inside the listbox. */
export type ComboboxEmptyProps = WithClass & Omit<WithHtmlAttrs, 'role'> & Define.Slot<'default'>;

/** Renders its content only while the visible list is empty — and not still loading. */
const ComboboxEmpty = component<ComboboxEmptyProps>(({ props, slots }) => {
    const combobox = useComboboxContext();
    return () => (combobox.listbox.isEmpty() && !combobox.loading()
        ? (
            <div {...htmlAttrs(props)} data-scope={SCOPE} data-part="empty" role="presentation" class={props.class}>
                {slots.default?.()}
            </div>
        )
        : null);
}, { name: 'Combobox.Empty' });

// ── Loading ──

/** Not `role`: like the empty state, the part is `presentation` inside the listbox. */
export type ComboboxLoadingProps = WithClass & Omit<WithHtmlAttrs, 'role'> & Define.Slot<'default'>;

/**
 * Renders its content only while the root is `loading`. `presentation`,
 * like `Combobox.Empty`: ARIA's listbox owns only options and groups, so
 * neither `role="status"` nor a role-less `aria-live` region may sit in it
 * (axe: aria-required-children). What AT hears is the listbox's own
 * `aria-busy`; the row is what a sighted user sees.
 */
const ComboboxLoading = component<ComboboxLoadingProps>(({ props, slots }) => {
    const combobox = useComboboxContext();
    return () => (combobox.loading()
        ? (
            <div {...htmlAttrs(props)} data-scope={SCOPE} data-part="loading" role="presentation" class={props.class}>
                {slots.default?.()}
            </div>
        )
        : null);
}, { name: 'Combobox.Loading' });

// ── Separator ──

/** Not `role`: the part is a `separator`, hidden from the accessibility tree. */
export type ComboboxSeparatorProps = WithClass & Omit<WithHtmlAttrs, 'role'>;

/**
 * A rule between runs of options — aria-hidden (a listbox owns options and
 * groups only) and never an option: navigation and set positions skip it.
 */
const ComboboxSeparator = component<ComboboxSeparatorProps>(({ props }) => () => (
    <div {...htmlAttrs(props)} data-scope={SCOPE} data-part="separator" role="separator" aria-hidden="true" class={props.class} />
), { name: 'Combobox.Separator' });

// ── Group / GroupLabel ──

export const useComboboxGroupContext = defineInjectable<GroupPresence>(
    () => createGroupPresence('zx-combobox-group-inert-label', { label: false }),
);

export type ComboboxGroupProps =
    & WithClass
    /** Not `role`: the part is the `group`. An app `aria-labelledby` joins the GroupLabel's. */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Slot<'default'>;

/**
 * The optgroup equivalent — `role="group"` inside the listbox, named by its
 * `GroupLabel` while one is rendered (an unlabelled group stays anonymous
 * rather than dangling a reference).
 */
const ComboboxGroup = component<ComboboxGroupProps>(({ props, slots, signal }) => {
    const baseId = createId('zx-combobox-group');
    const ctx = createGroupPresence(`${baseId}-label`, signal({ label: false }));
    defineProvide(useComboboxGroupContext, () => ctx);
    return () => {
        const attrs = htmlAttrs(props);
        return (
            <div
                {...attrs}
                data-scope={SCOPE}
                data-part="group"
                role="group"
                aria-labelledby={[
                    ctx.labelPresent() ? ctx.labelId : undefined,
                    attrs['aria-labelledby'],
                ].filter(Boolean).join(' ') || undefined}
                class={props.class}
            >
                {slots.default?.()}
            </div>
        );
    };
}, { name: 'Combobox.Group' });

/** Not `id`: the group is labelled by the GroupLabel's own. */
export type ComboboxGroupLabelProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const ComboboxGroupLabel = component<ComboboxGroupLabelProps>(({ props, slots, onUnmounted }) => {
    const group = useComboboxGroupContext();
    onUnmounted(announceGroupLabel(group));
    // No role: the label must stay in the accessibility tree for the group's
    // aria-labelledby to compute a name from it.
    return () => (
        <div {...htmlAttrs(props)} id={group.labelId} data-scope={SCOPE} data-part="group-label" class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'Combobox.GroupLabel' });

export const Combobox = compound(ComboboxRoot, {
    Root: ComboboxRoot,
    Control: ComboboxControl,
    Tags: ComboboxTags,
    Tag: ComboboxTag,
    TagLabel: ComboboxTagLabel,
    TagRemove: ComboboxTagRemove,
    Input: ComboboxInput,
    Trigger: ComboboxTrigger,
    ClearTrigger: ComboboxClearTrigger,
    Popup: ComboboxPopup,
    Group: ComboboxGroup,
    GroupLabel: ComboboxGroupLabel,
    Item: ComboboxItem,
    Empty: ComboboxEmpty,
    Loading: ComboboxLoading,
    Separator: ComboboxSeparator,
});
