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
 * Focus stays in the input; the highlighted option is conveyed via
 * `aria-activedescendant` + `data-highlighted`. ArrowDown/Up open and move,
 * Enter selects, Escape closes, Tab closes without being swallowed, Home/End
 * stay with the text caret (APG). The popup is `popover="manual"` + the
 * dismiss layer: native `auto` light dismiss would close the list on a caret
 * click in the input.
 */
import { component, compound, defineInjectable, defineProvide, effect, watch } from 'sigx';
import type { Define, JSXElement } from 'sigx';
import { createControllableState, createInertState, namedModel, type ControllableState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { createCollection, type Collection } from '../../behaviors/collection.js';
import { createFormControl } from '../../behaviors/form-control.js';
import { onFormReset } from '../../behaviors/form-reset.js';
import { VISUALLY_HIDDEN_STYLE } from '../../behaviors/visually-hidden.js';
import { createListController, type ListController } from '../../behaviors/list.js';
import {
    announceGroupLabel, createGroupPresence, createListbox, createListboxItem, type GroupPresence, type Listbox,
} from '../../behaviors/listbox.js';
import { syncPopover } from '../../behaviors/popover-sync.js';
import { createAnchorPosition, type Placement, type PositionStrategy } from '../../behaviors/position.js';
import { createDismissable } from '../../behaviors/dismiss.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import type { FactoryBrands, JsxProps } from '../../contract/generic.js';
import type {
    PartProps,
    WithAsChild,
    WithClass,
    WithDisabled,
    WithFormControl,
    WithReadonly,
    WithVariantAxes,
} from '../../contract/props.js';
import { comboboxAnatomy } from './anatomy.js';

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
    & Define.Prop<'multiple', boolean, false>
    /**
     * Enter commits the typed text while no option is highlighted: the
     * option whose label it matches, else the text itself as the value
     * (narrowed per overload to string models).
     */
    & Define.Prop<'allowCustom', boolean, false>
    & Define.Prop<'placeholder', string, false>
    & WithFormControl
    & WithReadonly
    & Define.Prop<'placement', Placement, false>
    & Define.Prop<'positionStrategy', PositionStrategy, false>
    & WithVariantAxes<'combobox'>
    & WithClass
    & Define.Slot<'item', { item: T }>
    /** Per-tag content under `multiple` (data mode) — replaces the label + remove button. */
    & Define.Slot<'tag', ComboboxTagSlotProps<T>>
    & Define.Slot<'default'>;

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

const ComboboxRootImpl = component<ComboboxRootImplProps>(({ props, slots, emit, signal, onMounted, onUnmounted }) => {
    const multiple = (): boolean => !!props.multiple;
    // Explicit children win ENTIRELY over `items`: with a default slot the
    // data is not rendered, so the collection must not hold it either — the
    // highlight, the typeahead and the hidden select follow what is rendered.
    // Without children the root is data-driven exactly when `items` was
    // given — an EMPTY list counts, sigx props being plain values that a
    // later list arrives into — so the mode never flips on what the list
    // holds, and an omitted `items` is the hand-written (string-model) shape
    // the overloads promise.
    const items = (): ReadonlyArray<unknown> | undefined => (slots.default || props.items === undefined ? undefined : props.items);
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
        items: items() ? items : undefined,
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

    const listbox = createListbox<unknown>({
        collection,
        selection: state,
        multiple,
        list,
        idBase: baseId,
        query: () => inputValue.value,
        filter: props.filter,
        emptyValue: emptyValue(),
        // A single selection fills the input with the label and closes; a
        // multiple one toggles, clears the query and stays open.
        onSelect: (key) => {
            if (multiple()) { inputValue.value = ''; return; }
            inputValue.value = collection.label(key);
            setOpen(false);
        },
    });

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
        if (!multiple() && keys.some((k) => k === '' || collection.valueForKey(k) === '')) {
            throw new Error('[zero] Combobox: an item keyed or valued "" is reserved for the placeholder in single mode — give it a non-empty itemKey / itemValue');
        }
        return keys;
    };
    // Data mode posts every item plus any chosen value the data does not
    // hold (a custom one, or one from a page not loaded).
    const hiddenKeys = (): string[] => {
        if (collection.mode() !== 'data') return guardKeys(listbox.selectedKeys());
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
            inputValue.value = collection.label(key);
            setOpen(false);
            return;
        }
        if (!listbox.isSelected(key)) {
            const current = Array.isArray(state.value) ? state.value : [];
            state.value = [...current, collection.valueForKey(key)];
        }
        inputValue.value = '';
    };

    // A close clears the highlight however the open state was written (a
    // consumer's `model:open` included); an open leaves it to the arrows.
    watch(
        () => openState.value,
        (open) => { if (!open) listbox.highlighted.value = null; },
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
    onMounted(() => {
        effect(() => { listbox.selectedKeys(); syncHidden(); });
        // Without a name there is no hidden select — the input itself is
        // form-associated, so reset still restores.
        detachReset = onFormReset(() => hidden ?? (input as HTMLInputElement | null), () => {
            state.value = seed();
            inputValue.value = props.defaultInputValue ?? (multiple() ? '' : listbox.displayText());
            syncHidden();
            if (input) (input as HTMLInputElement).value = inputValue.value;
        });
    });
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
        focusInput: () => { input?.focus(); },
        inputKeydown(e) {
            if (ctx.disabled() || ctx.readonly()) return;
            const key = e.key;
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
                    e.preventDefault();
                    setOpen(false);
                }
                return;
            }
            if (key === 'Tab') {
                setOpen(false);
                return;
            }
            // Home/End & the rest stay with the text caret (APG editable
            // combobox) — no typeahead: typing IS the filter.
        },
        onInput(value) {
            inputValue.value = value;
            if (!openState.value && !ctx.disabled() && !ctx.readonly()) setOpen(true);
        },
    };
    defineProvide(useComboboxContext, () => ctx);

    createAnchorPosition({
        getAnchor: () => control ?? input,
        getFloating: () => popup,
        isOpen: () => openState.value,
        placement: () => props.placement ?? 'bottom-start',
        offset: () => 4,
        strategy: props.positionStrategy,
    });

    // popover="manual" opts out of native light dismiss (a caret click in
    // the input must not close the list), so dismissal is the layer stack's:
    // outside-press only; Escape stays with inputKeydown, its one owner.
    createDismissable({
        getElement: () => popup,
        isOpen: () => openState.value,
        dismiss: () => setOpen(false),
        escape: false,
        getExtraTargets: () => [control, input, trigger],
    });

    // A preset value's label reaches the input at setup — from data, before
    // any item mounts (hand-written items reflect on mount instead).
    if (!multiple() && collection.mode() === 'data' && inputValue.value === '' && listbox.selectedKeys().length > 0) {
        inputValue.value = listbox.displayText();
    }

    // An external value write (form reset, server data) reflects into the
    // input text — from the collection, so before any item mounts.
    watch(
        () => state.value,
        (value, prev) => {
            if (value === prev || multiple()) return;
            const text = listbox.displayText();
            if (inputValue.value !== text) inputValue.value = text;
        },
    );

    // The data expansion: the default composition through the same parts.
    const dataItem = (item: unknown): JSXElement => (
        <ComboboxItem value={collection.keyOf(item)} textValue={collection.labelOf(item)} disabled={collection.isItemDisabled(item)} key={collection.keyOf(item)}>
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
                <ComboboxTrigger />
            </ComboboxControl>
            <ComboboxPopup>
                {listbox.visibleItems().length === 0 && props.emptyText !== undefined
                    ? <ComboboxEmpty>{props.emptyText}</ComboboxEmpty>
                    : null}
                {collection.segments().map((segment) => {
                    const visible = segment.items.filter((i) => listbox.isVisible(collection.keyOf(i)));
                    if (visible.length === 0) return null;
                    return segment.group === undefined
                        ? visible.map(dataItem)
                        : (
                            <ComboboxGroup key={`group:${segment.group}`}>
                                <ComboboxGroupLabel>{segment.group}</ComboboxGroupLabel>
                                {visible.map(dataItem)}
                            </ComboboxGroup>
                        );
                })}
            </ComboboxPopup>
        </>
        );
    };

    return () => (
        <div
            data-scope={SCOPE}
            data-part="root"
            {...fc.flags()}
            data-readonly={dataAttr(ctx.readonly())}
            {...fc.axisAttrs()}
            class={props.class}
        >
            {/* Explicit children win ENTIRELY over `items` — no merging. */}
            {slots.default ? slots.default() : items() ? dataContent() : null}
            {fc.hasName()
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
    // `allowCustom` commits the TEXT as the value, so it types only where the
    // model is a string: hand-written items, string items, a string itemValue.
    <T>(props: JsxProps<ComboboxRootProps<T, T | null>> & { items: ReadonlyArray<T>; defaultValue?: T | null; itemValue?: undefined; multiple?: false; allowCustom?: CustomFor<T> }): JSXElement;
    <T>(props: JsxProps<ComboboxRootProps<T, T[]>> & { items: ReadonlyArray<T>; defaultValue?: T[]; itemValue?: undefined; multiple: true; allowCustom?: CustomFor<T> }): JSXElement;
    // A value model is `V | null` for the same reason — V is whatever
    // `itemValue` returns (a number as readily as a string), so no member of
    // it can stand for "nothing selected".
    <T, V>(props: JsxProps<ComboboxRootProps<T, V | null>> & { items: ReadonlyArray<T>; defaultValue?: V | null; itemValue: (item: T) => V; multiple?: false; allowCustom?: CustomFor<V> }): JSXElement;
    <T, V>(props: JsxProps<ComboboxRootProps<T, V[]>> & { items: ReadonlyArray<T>; defaultValue?: V[]; itemValue: (item: T) => V; multiple: true; allowCustom?: CustomFor<V> }): JSXElement;
} & FactoryBrands;

/** `allowCustom` is open only to a string model — free text can be nothing else. */
type CustomFor<M> = [M] extends [string] ? boolean : false;

const ComboboxRoot = ComboboxRootImpl as unknown as ComboboxRoot;

// ── Control ──

export type ComboboxControlProps = WithClass & Define.Slot<'default'>;

const ComboboxControl = component<ComboboxControlProps>(({ props, slots }) => {
    const combobox = useComboboxContext();
    return () => (
        <div
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

export type ComboboxTagLabelProps = WithClass & Define.Slot<'default'>;

/** The tag's text — its label unless children replace it. */
const ComboboxTagLabel = component<ComboboxTagLabelProps>(({ props, slots }) => {
    const tag = useComboboxTagContext();
    return () => (
        <span data-scope={SCOPE} data-part="tag-label" class={props.class}>
            {slots.default ? slots.default() : tag.label()}
        </span>
    );
}, { name: 'Combobox.TagLabel' });

export type ComboboxTagRemoveProps =
    /** Accessible name (default `Remove <label>`). */
    & Define.Prop<'label', string, false>
    & WithClass
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
    return () => (
        <button
            type="button"
            data-scope={SCOPE}
            data-part="tag-remove"
            data-disabled={dataAttr(disabled())}
            data-focus-visible={dataAttr(focus.visible)}
            aria-label={props.label ?? `Remove ${tag.label()}`}
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
}, { name: 'Combobox.TagRemove' });

// ── Input ──

export type ComboboxInputProps =
    & Define.Prop<'placeholder', string, false>
    & WithClass;

const ComboboxInput = component<ComboboxInputProps>(({ props }) => {
    const combobox = useComboboxContext();
    let el: HTMLElement | null = null;

    return () => (
        <input
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
            aria-describedby={combobox.describedBy()}
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
            onBlur={() => { combobox.inputFocusVisible.value = false; }}
        />
    );
}, { name: 'Combobox.Input' });

// ── Trigger ──

export type ComboboxTriggerProps =
    /** Accessible name for the disclosure button (default "Show options"). */
    & Define.Prop<'label', string, false>
    & WithClass
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

    const bag = (): PartProps => ({
        id: combobox.ids.trigger,
        'data-scope': SCOPE,
        'data-part': 'trigger',
        'data-state': stateAttr(combobox.open.value, 'open', 'closed'),
        'data-disabled': dataAttr(combobox.disabled()),
        'data-focus-visible': dataAttr(focus.visible),
        // Focus lives in the input; the button is a pointer affordance.
        tabIndex: -1,
        'aria-label': props.label ?? 'Show options',
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
    });

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

// ── Popup ──

export type ComboboxPopupProps = WithClass & Define.Slot<'default'>;

const ComboboxPopup = component<ComboboxPopupProps>(({ props, slots, onMounted }) => {
    const combobox = useComboboxContext();
    let el: HTMLElement | null = null;

    onMounted(() => { syncPopover(() => el, () => combobox.open.value); });

    return () => (
        <div
            id={combobox.ids.popup}
            data-scope={SCOPE}
            data-part="popup"
            data-state={stateAttr(combobox.open.value, 'open', 'closed')}
            popover="manual"
            role="listbox"
            aria-multiselectable={combobox.multiple() ? 'true' : undefined}
            aria-labelledby={combobox.inputId()}
            class={props.class}
            ref={(node: HTMLElement | null) => { el = node; combobox.setPopup(node); }}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Combobox.Popup' });

// ── Item ──

export type ComboboxItemProps =
    & Define.Prop<'value', string, true>
    & Define.Prop<'textValue', string, false>
    & WithDisabled
    & WithClass
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
    const item = createListboxItem({
        listbox: combobox.listbox,
        collection: combobox.collection,
        list: combobox.list,
        scope: SCOPE,
        key: () => props.value,
        textValue: () => props.textValue,
        disabled: () => !!props.disabled,
        getEl: () => el,
        afterSelect: () => combobox.focusInput(),
    });
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
        ...item.bag(),
        onPointerdown: press.onPointerdown,
        onPointerup: press.onPointerup,
        onPointercancel: press.onPointercancel,
        onPointerleave: press.onPointerleave,
        ref: (node: HTMLElement | null) => { el = node; },
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

export type ComboboxEmptyProps = WithClass & Define.Slot<'default'>;

/** Renders its content only while the visible list is empty. */
const ComboboxEmpty = component<ComboboxEmptyProps>(({ props, slots }) => {
    const combobox = useComboboxContext();
    return () => (combobox.listbox.isEmpty()
        ? (
            <div data-scope={SCOPE} data-part="empty" role="presentation" class={props.class}>
                {slots.default?.()}
            </div>
        )
        : null);
}, { name: 'Combobox.Empty' });

// ── Group / GroupLabel ──

export const useComboboxGroupContext = defineInjectable<GroupPresence>(
    () => createGroupPresence('zx-combobox-group-inert-label', { label: false }),
);

export type ComboboxGroupProps = WithClass & Define.Slot<'default'>;

/**
 * The optgroup equivalent — `role="group"` inside the listbox, named by its
 * `GroupLabel` while one is rendered (an unlabelled group stays anonymous
 * rather than dangling a reference).
 */
const ComboboxGroup = component<ComboboxGroupProps>(({ props, slots, signal }) => {
    const baseId = createId('zx-combobox-group');
    const ctx = createGroupPresence(`${baseId}-label`, signal({ label: false }));
    defineProvide(useComboboxGroupContext, () => ctx);
    return () => (
        <div
            data-scope={SCOPE}
            data-part="group"
            role="group"
            aria-labelledby={ctx.labelPresent() ? ctx.labelId : undefined}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Combobox.Group' });

export type ComboboxGroupLabelProps = WithClass & Define.Slot<'default'>;

const ComboboxGroupLabel = component<ComboboxGroupLabelProps>(({ props, slots, onUnmounted }) => {
    const group = useComboboxGroupContext();
    onUnmounted(announceGroupLabel(group));
    // No role: the label must stay in the accessibility tree for the group's
    // aria-labelledby to compute a name from it.
    return () => (
        <div id={group.labelId} data-scope={SCOPE} data-part="group-label" class={props.class}>
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
    Popup: ComboboxPopup,
    Group: ComboboxGroup,
    GroupLabel: ComboboxGroupLabel,
    Item: ComboboxItem,
    Empty: ComboboxEmpty,
});
