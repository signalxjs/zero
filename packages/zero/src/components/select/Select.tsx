/**
 * Select — a listbox picker (WAI-ARIA select-only combobox pattern), typed
 * generic at the JSX level over a collection of items.
 *
 * ```tsx
 * // Items as data: T infers from `items`; the model holds the ITEM …
 * <Select.Root items={countries} itemKey={(c) => c.code} itemLabel={(c) => c.name}
 *     model={() => state.country} name="country" placeholder="Pick a country…" />
 *
 * // … unless `itemValue` says what it holds (a key model) …
 * <Select.Root items={countries} itemValue={(c) => c.code} itemLabel={(c) => c.name}
 *     model={() => state.code} />
 *
 * // … and `multiple` makes it an array, posted as a real <select multiple>.
 * <Select.Root items={countries} multiple model={() => state.selected} />
 *
 * // Hand-written items register into the same collection.
 * <Select.Root model={() => state.fruit} placeholder="Pick a fruit…">
 *     <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
 *     <Select.Popup>
 *         <Select.Item value="apple">Apple</Select.Item>
 *     </Select.Popup>
 * </Select.Root>
 * ```
 *
 * THE COLLECTION IS THE TRUTH (#438): keys, labels and groups resolve from
 * `items` before anything mounts, so a preset value shows its label on the
 * first render and typeahead works before the popup has ever opened. With
 * `items` and no children the Root renders the default composition —
 * Trigger(Value, Indicator) + Popup(Item per item, Group/GroupLabel per
 * distinct group in first-appearance order) — through the same anatomy, the
 * `item` slot customising each option's content. Explicit children win
 * entirely when both are given.
 *
 * Focus stays on the trigger; the highlighted option is conveyed via
 * `aria-activedescendant` and `data-highlighted`. Keyboard: ArrowDown/Up
 * open and move, Home/End jump, typeahead works closed (selects) and open
 * (moves the highlight), Enter/Space select, Escape closes. Under `multiple`
 * a selection toggles and the popup stays open.
 *
 * FORM PARTICIPATION is a real, visually-hidden `<select>` (`hidden-input`)
 * with an option per key, rendered only while `name` is set: `required` is a
 * platform constraint, autofill sees the options, a form `reset()` restores
 * the default, `form="id"` associates from outside. The invalid focus lands
 * on the trigger.
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
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import type { FactoryBrands, JsxProps } from '../../contract/generic.js';
import { variantAttrs } from '../../contract/props.js';
import type {
    PartProps,
    WithAsChild,
    WithClass,
    WithDisabled,
    WithFormControl,
    WithVariantAxes,
} from '../../contract/props.js';
import { selectAnatomy } from './anatomy.js';

const SCOPE = selectAnatomy.scope;

interface SelectContext {
    state: ControllableState<unknown>;
    collection: Collection<unknown, unknown>;
    listbox: Listbox<unknown>;
    list: ListController;
    open: { value: boolean };
    ids: { popup: string };
    /** The trigger's rendered id — the field's control id when wrapped in a Field. */
    triggerId(): string;
    placeholder(): string | undefined;
    multiple(): boolean;
    /** Refuses the empty key in single mode — it is the placeholder's. */
    guardKey(key: string): void;
    disabled(): boolean;
    invalid(): boolean;
    required(): boolean;
    describedBy(): string | undefined;
    setTrigger(el: HTMLElement | null): void;
    setPopup(el: HTMLElement | null): void;
    triggerKeydown(e: KeyboardEvent): void;
}

function makeInert(): SelectContext {
    const state = createInertState<unknown>('');
    const collection = createCollection<unknown, unknown>();
    const list = createListController();
    return {
        state,
        collection,
        listbox: createListbox({ collection, selection: state, list, idBase: 'zx-select-inert' }),
        list,
        open: { value: false },
        ids: { popup: 'zx-select-inert-popup' },
        triggerId: () => 'zx-select-inert-trigger',
        placeholder: () => undefined,
        multiple: () => false,
        guardKey: () => {},
        disabled: () => false,
        invalid: () => false,
        required: () => false,
        describedBy: () => undefined,
        setTrigger: () => {},
        setPopup: () => {},
        triggerKeydown: () => {},
    };
}

export const useSelectContext = defineInjectable<SelectContext>(() => makeInert());

// ── Root ──

/**
 * The props, generic over the item `T` and the model `M`. The exported
 * `Select.Root` narrows `M` from the props: `T | null` (item model),
 * `V | null` when `itemValue` returns `V`, and arrays of either under
 * `multiple`.
 */
export type SelectRootProps<T = unknown, M = unknown> =
    & Define.Model<M>
    /** Typed per overload on the exported root (see below); `unknown` here. */
    & Define.Prop<'defaultValue', unknown, false>
    & Define.Event<'valueChange', M>
    & Define.Model<'open', boolean>
    & Define.Prop<'defaultOpen', boolean, false>
    & Define.Event<'openChange', boolean>
    /** The items as data. Absent → hand-written `Select.Item` children. */
    & Define.Prop<'items', ReadonlyArray<T>, false>
    /** String identity: DOM id, typeahead target, posted value (default: `value` / `id` / the primitive). */
    & Define.Prop<'itemKey', (item: T) => string, false>
    /** Display and typeahead text (default: `label` / the key). */
    & Define.Prop<'itemLabel', (item: T) => string, false>
    & Define.Prop<'itemDisabled', (item: T) => boolean, false>
    & Define.Prop<'itemGroup', (item: T) => string | undefined, false>
    /** Several selections: the model is an array, the hidden select `multiple`. */
    & Define.Prop<'multiple', boolean, false>
    & Define.Prop<'placeholder', string, false>
    & WithFormControl
    & Define.Prop<'placement', Placement, false>
    & Define.Prop<'positionStrategy', PositionStrategy, false>
    & WithVariantAxes<'select'>
    & WithClass
    /** Custom content for a generated option (data mode). */
    & Define.Slot<'item', { item: T }>
    & Define.Slot<'default'>;

/**
 * The implementation's props: the public type plus `itemValue`, which the
 * public type deliberately omits — declared there AND on the overloads, the
 * arrow's parameter would face an intersection of two signatures and lose
 * its contextual type, taking `T`'s inference with it. The overloads are
 * the one place it is typed.
 */
type SelectRootImplProps = SelectRootProps & Define.Prop<'itemValue', (item: unknown) => unknown, false>;

const SelectRootImpl = component<SelectRootImplProps>(({ props, slots, emit, onMounted, onUnmounted }) => {
    const multiple = (): boolean => !!props.multiple;
    // What the runtime WRITES for "nothing chosen": null for a data-driven
    // root — an item or a value model alike (V may be a number, so no member
    // of it is asked to stand for nothing) — and '' for hand-written items,
    // whose keys are their values and whose model is the <select>'s string.
    // What it READS as nothing: null, that sentinel, and '' under any shape
    // (the core reserves '' as the single-select empty sentinel; the guard
    // below refuses it as a key).
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
    const openState = createControllableState<boolean>(
        () => namedModel<boolean>(props.open),
        props.defaultOpen ?? false,
        (v) => emit('openChange', v),
    );
    const fc = createFormControl({ props: () => props, idBase: 'zx-select', controlPart: 'trigger' });
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
        emptyValue: emptyValue(),
        // A single selection closes; a multiple one toggles and stays open.
        onSelect: () => { if (!multiple()) setOpen(false); },
    });

    // The highlight follows the OPEN state however it was written — a
    // consumer's `model:open` write included, so aria-activedescendant is
    // never unset on open or stale after close.
    watch(
        () => openState.value,
        (open) => {
            if (open) listbox.highlightSelectedOrFirst();
            else listbox.highlighted.value = null;
        },
    );

    // The hidden select follows the model — a microtask later, so the
    // options the render inserts exist, and on a form reset, when the
    // platform has just selected the placeholder.
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
            throw new Error('[zero] Select: an item keyed or valued "" is reserved for the placeholder in single mode — give it a non-empty itemKey / itemValue');
        }
        return keys;
    };
    const hiddenKeys = (): string[] => guardKeys(collection.mode() === 'data' ? collection.keys() : listbox.selectedKeys());

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
        // Without a name there is no hidden select — the trigger is a
        // <button>, form-associated like any control, so reset still restores.
        detachReset = onFormReset(() => hidden ?? (trigger as HTMLButtonElement | null), () => {
            state.value = seed();
            syncHidden();
        });
    });
    onUnmounted(() => detachReset());

    const ctx: SelectContext = {
        state,
        collection,
        listbox,
        list,
        open: {
            get value() { return openState.value; },
            set value(v: boolean) { setOpen(v); },
        },
        ids: { popup: `${baseId}-popup` },
        // Adopting the field's control id is what lets Field.Label name the
        // trigger through `for` — a button is a labelable element.
        triggerId: fc.controlId,
        placeholder: () => props.placeholder,
        multiple,
        guardKey: (key) => { guardKeys([key]); },
        disabled: fc.disabled,
        invalid: fc.invalid,
        required: fc.required,
        describedBy: fc.describedBy,
        setTrigger: (el) => { trigger = el; },
        setPopup: (el) => { popup = el; },
        triggerKeydown(e) {
            if (ctx.disabled()) return;
            const key = e.key;
            if (!openState.value) {
                if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
                    e.preventDefault();
                    setOpen(true);
                    return;
                }
                // Closed typeahead: a single select picks directly; a multiple
                // one opens on the match, since picking would toggle blind.
                listbox.typeahead(e, listbox.selectedKeys()[0] ?? null, (k) => {
                    if (multiple()) { setOpen(true); listbox.highlighted.value = k; }
                    else listbox.select(k);
                });
                return;
            }
            if (key === 'ArrowDown') { e.preventDefault(); listbox.move(1); return; }
            if (key === 'ArrowUp') { e.preventDefault(); listbox.move(-1); return; }
            if (key === 'Home') { e.preventDefault(); listbox.move('first'); return; }
            if (key === 'End') { e.preventDefault(); listbox.move('last'); return; }
            if (key === 'Enter' || key === ' ') {
                e.preventDefault();
                const h = listbox.highlighted.value;
                if (h != null) listbox.select(h);
                return;
            }
            if (key === 'Escape') { e.preventDefault(); setOpen(false); return; }
            if (key === 'Tab') { setOpen(false); return; }
            listbox.typeahead(e, listbox.highlighted.value, (k) => { listbox.highlighted.value = k; });
        },
    };
    defineProvide(useSelectContext, () => ctx);

    createAnchorPosition({
        getAnchor: () => trigger,
        getFloating: () => popup,
        isOpen: () => openState.value,
        placement: () => props.placement ?? 'bottom-start',
        offset: () => 4,
        strategy: props.positionStrategy,
    });

    // The data expansion: the default composition, built from the same
    // compound parts a consumer would write — sugar over the anatomy, never
    // a parallel render path.
    const dataItem = (item: unknown): JSXElement => (
        <SelectItem value={collection.keyOf(item)} textValue={collection.labelOf(item)} disabled={collection.isItemDisabled(item)} key={collection.keyOf(item)}>
            {slots.item ? slots.item({ item }) : collection.labelOf(item)}
        </SelectItem>
    );
    const dataContent = (): JSXElement => {
        guardKeys(collection.keys());
        return (
        <>
            <SelectTrigger>
                <SelectValue />
                <SelectIndicator />
            </SelectTrigger>
            <SelectPopup>
                {collection.segments().map((segment) => segment.group === undefined
                    ? segment.items.map(dataItem)
                    : (
                        <SelectGroup key={`group:${segment.group}`}>
                            <SelectGroupLabel>{segment.group}</SelectGroupLabel>
                            {segment.items.map(dataItem)}
                        </SelectGroup>
                    ))}
            </SelectPopup>
        </>
        );
    };

    return () => (
        <div
            data-scope={SCOPE}
            data-part="root"
            {...fc.flags()}
            {...variantAttrs(props)}
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
                        onInvalid={(e: Event) => { e.preventDefault(); trigger?.focus(); }}
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
}, { name: 'Select.Root' });

/**
 * The generic root: `T` infers from `items`; the model is `T` unless
 * `itemValue` returns `V`; `multiple` makes it an array of either.
 */
export type SelectRoot = {
    // `defaultValue` is typed here rather than on the shared props: declared
    // there as `M`, TypeScript stops inferring `T` for the `itemValue`
    // overload (an inference-priority quirk the type test pins).
    // Hand-written items (no `items`): a key IS its value, so the model is
    // the <select>'s string — '' for nothing selected — or string[].
    (props: JsxProps<SelectRootProps<unknown, string>> & { items?: undefined; defaultValue?: string; itemValue?: undefined; multiple?: false }): JSXElement;
    (props: JsxProps<SelectRootProps<unknown, string[]>> & { items?: undefined; defaultValue?: string[]; itemValue?: undefined; multiple: true }): JSXElement;
    // An item model is `T | null`: nothing selected is `null` (the runtime
    // writes it on clear, reset and a platform write), never a fake item.
    <T>(props: JsxProps<SelectRootProps<T, T | null>> & { items: ReadonlyArray<T>; defaultValue?: T | null; itemValue?: undefined; multiple?: false }): JSXElement;
    <T>(props: JsxProps<SelectRootProps<T, T[]>> & { items: ReadonlyArray<T>; defaultValue?: T[]; itemValue?: undefined; multiple: true }): JSXElement;
    // A value model is `V | null` for the same reason — V is whatever
    // `itemValue` returns (a number as readily as a string), so no member of
    // it can stand for "nothing selected".
    <T, V>(props: JsxProps<SelectRootProps<T, V | null>> & { items: ReadonlyArray<T>; defaultValue?: V | null; itemValue: (item: T) => V; multiple?: false }): JSXElement;
    <T, V>(props: JsxProps<SelectRootProps<T, V[]>> & { items: ReadonlyArray<T>; defaultValue?: V[]; itemValue: (item: T) => V; multiple: true }): JSXElement;
} & FactoryBrands;

const SelectRoot = SelectRootImpl as unknown as SelectRoot;

// ── Trigger ──

export type SelectTriggerProps =
    /**
     * Accessible name for a Select outside a Field. `role="combobox"`
     * prohibits name-from-content, so the value/placeholder text inside the
     * trigger can never name it — without a `Field.Label` (which names the
     * trigger through the field's control id) a bare Select is a nameless
     * button to AT (#326). Omit inside a Field: `aria-label` would override
     * the field's visible label.
     */
    & Define.Prop<'label', string, false>
    & WithClass
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const SelectTrigger = component<SelectTriggerProps>(({ props, slots, signal }) => {
    const select = useSelectContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    // Disabled lives in the root's context, not on this part's props.
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => select.disabled(),
    });

    const bag = (): PartProps => ({
        id: select.triggerId(),
        'data-scope': SCOPE,
        'data-part': 'trigger',
        'data-state': stateAttr(select.open.value, 'open', 'closed'),
        'data-disabled': dataAttr(select.disabled()),
        'data-invalid': dataAttr(select.invalid()),
        'data-placeholder': dataAttr(select.listbox.selectedKeys().length === 0),
        'data-focus-visible': dataAttr(focus.visible),
        role: 'combobox',
        'aria-label': props.label,
        'aria-haspopup': 'listbox',
        'aria-expanded': select.open.value ? 'true' : 'false',
        'aria-controls': select.ids.popup,
        'aria-invalid': select.invalid() ? 'true' : undefined,
        'aria-required': select.required() ? 'true' : undefined,
        'aria-describedby': select.describedBy(),
        'aria-activedescendant': select.listbox.activeDescendant(select.open.value),
        onClick: () => {
            if (!select.disabled()) select.open.value = !select.open.value;
        },
        onKeydown: (e: KeyboardEvent) => {
            press.onKeydown(e);
            select.triggerKeydown(e);
        },
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
        ref: (node: HTMLElement | null) => { el = node; select.setTrigger(node); },
    });

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <button type="button" class={props.class} {...b} disabled={select.disabled()}>
                {slots.default?.(b)}
            </button>
        );
    };
}, { name: 'Select.Trigger' });

// ── Value ──

/**
 * The slot sees the model value and the selected ITEMS — the item behind
 * each key, or the key itself for a hand-written `Select.Item` (no data
 * stands behind it, and its key is its value).
 */
export type SelectValueProps = WithClass & Define.Slot<'default', { value: unknown; items: unknown[] }>;

/** The selected labels (joined under `multiple`), or the placeholder. */
const SelectValue = component<SelectValueProps>(({ props, slots }) => {
    const select = useSelectContext();
    return () => {
        const keys = select.listbox.selectedKeys();
        const isPlaceholder = keys.length === 0;
        return (
            <span
                data-scope={SCOPE}
                data-part="value"
                data-placeholder={dataAttr(isPlaceholder)}
                class={props.class}
            >
                {slots.default?.({ value: select.state.value, items: keys.map((k) => select.collection.byKey(k) ?? select.collection.valueForKey(k)) })
                    ?? (isPlaceholder ? select.placeholder() ?? '' : select.listbox.displayText())}
            </span>
        );
    };
}, { name: 'Select.Value' });

// ── Indicator ──

export type SelectIndicatorProps = WithClass & Define.Slot<'default'>;

const SelectIndicator = component<SelectIndicatorProps>(({ props, slots }) => {
    const select = useSelectContext();
    return () => (
        <span
            data-scope={SCOPE}
            data-part="indicator"
            data-state={stateAttr(select.open.value, 'open', 'closed')}
            aria-hidden="true"
            class={props.class}
        >
            {slots.default?.() ?? '▾'}
        </span>
    );
}, { name: 'Select.Indicator' });

// ── Popup ──

export type SelectPopupProps = WithClass & Define.Slot<'default'>;

const SelectPopup = component<SelectPopupProps>(({ props, slots, onMounted }) => {
    const select = useSelectContext();
    let el: HTMLElement | null = null;

    onMounted(() => { syncPopover(() => el, () => select.open.value); });

    return () => (
        <div
            id={select.ids.popup}
            data-scope={SCOPE}
            data-part="popup"
            data-state={stateAttr(select.open.value, 'open', 'closed')}
            popover="auto"
            role="listbox"
            aria-multiselectable={select.multiple() ? 'true' : undefined}
            aria-labelledby={select.triggerId()}
            class={props.class}
            ref={(node: HTMLElement | null) => { el = node; select.setPopup(node); }}
            onToggle={(e: Event) => {
                const open = (e as ToggleEvent).newState === 'open';
                if (select.open.value !== open) select.open.value = open;
            }}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Select.Popup' });

// ── Item ──

export type SelectItemProps =
    & Define.Prop<'value', string, true>
    & Define.Prop<'textValue', string, false>
    & WithDisabled
    & WithClass
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const SelectItem = component<SelectItemProps>(({ props, slots, onUnmounted }) => {
    const select = useSelectContext();
    let el: HTMLElement | null = null;
    // Pointer-only: keyboard selection happens on the trigger
    // (aria-activedescendant — focus never reaches the option), so keyboard
    // press feedback deliberately lives on the trigger instead.
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => !!props.disabled,
    });

    select.guardKey(props.value);
    const item = createListboxItem({
        listbox: select.listbox,
        collection: select.collection,
        list: select.list,
        scope: SCOPE,
        key: () => props.value,
        textValue: () => props.textValue,
        disabled: () => !!props.disabled,
        getEl: () => el,
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
}, { name: 'Select.Item' });

// ── Group / GroupLabel ──

export const useSelectGroupContext = defineInjectable<GroupPresence>(
    () => createGroupPresence('zx-select-group-inert-label', { label: false }),
);

export type SelectGroupProps = WithClass & Define.Slot<'default'>;

/**
 * The optgroup equivalent — `role="group"` inside the listbox, named by its
 * `GroupLabel` while one is rendered (an unlabelled group stays anonymous
 * rather than dangling a reference).
 */
const SelectGroup = component<SelectGroupProps>(({ props, slots, signal }) => {
    const baseId = createId('zx-select-group');
    const ctx = createGroupPresence(`${baseId}-label`, signal({ label: false }));
    defineProvide(useSelectGroupContext, () => ctx);
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
}, { name: 'Select.Group' });

export type SelectGroupLabelProps = WithClass & Define.Slot<'default'>;

const SelectGroupLabel = component<SelectGroupLabelProps>(({ props, slots, onUnmounted }) => {
    const group = useSelectGroupContext();
    onUnmounted(announceGroupLabel(group));
    // No role: the label must stay in the accessibility tree for the group's
    // aria-labelledby to compute a name from it.
    return () => (
        <div id={group.labelId} data-scope={SCOPE} data-part="group-label" class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'Select.GroupLabel' });

export const Select = compound(SelectRoot, {
    Root: SelectRoot,
    Trigger: SelectTrigger,
    Value: SelectValue,
    Indicator: SelectIndicator,
    Popup: SelectPopup,
    Group: SelectGroup,
    GroupLabel: SelectGroupLabel,
    Item: SelectItem,
});
