/**
 * Chip — a compact action, choice, filter or entity.
 *
 * ```tsx
 * // An action.
 * <Chip.Root><Chip.Action onClick={share}><Chip.Icon>↗</Chip.Icon><Chip.Label>Share</Chip.Label></Chip.Action></Chip.Root>
 *
 * // A standalone filter: a toggle.
 * <Chip.Root selectable model={() => state.unread}><Chip.Action>Unread</Chip.Action></Chip.Root>
 *
 * // An entity: removable.
 * <Chip.Root removable onRemove={() => drop('ada')}>
 *     <Chip.Action>Ada Lovelace</Chip.Action>
 *     <Chip.Remove />
 * </Chip.Root>
 * ```
 *
 * `root` is a container, not a button: an entity chip is two buttons side
 * by side (the action and the remove), which one `<button>` could not hold.
 * `action` is the chip's own button — through `asChild`, a link — and the
 * roving stop inside a `ChipGroup`.
 *
 * A **selectable** chip is a toggle: `action` carries `aria-pressed`, and
 * `root` and `action` hold `on | off`. Standalone it binds its own boolean
 * (`model` / `defaultSelected` / `selectedChange`); inside a `selectable`
 * ChipGroup every chip is selectable and the group owns the value, so
 * the chip's `value` is what it contributes.
 *
 * A **removable** chip emits `remove` from its `Remove` button, and from
 * Backspace or Delete on its action — the combobox tag's keyboard path, which
 * is why `Remove` stays out of the tab order. zero removes nothing itself:
 * the app drops the chip from its data. Inside a group, focus moves to the
 * neighbouring chip first, so it never falls back to `<body>`.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { type ListItem } from '../../behaviors/list.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild, synthesizesClickFrom } from '../../contract/as-child.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type {
    PartProps,
    WithAsChild,
    WithClass,
    WithDisabled,
    WithHtmlAttrs,
    WithInteractionHandlers,
    WithVariantAxes,
} from '../../contract/props.js';
import { useChipGroupContext } from '../chip-group/ChipGroup.js';
import { chipAnatomy } from './anatomy.js';

const SCOPE = chipAnatomy.scope;

interface ChipContext {
    value(): string;
    selectable(): boolean;
    on(): boolean;
    toggle(): void;
    disabled(): boolean;
    removable(): boolean;
    remove(): void;
    /** The action's accessible name override, if any. */
    label(): string | undefined;
    /** What the chip reads as — the default Remove button's name uses it. */
    text(): string;
    setActionEl(el: HTMLElement | null): void;
}

function makeInert(): ChipContext {
    const state = createInertState<boolean>(false);
    return {
        value: () => '',
        selectable: () => false,
        on: () => state.value,
        toggle: () => {},
        disabled: () => false,
        removable: () => false,
        remove: () => {},
        label: () => undefined,
        text: () => '',
        setActionEl: () => {},
    };
}

export const useChipContext = defineInjectable<ChipContext>(() => makeInert());

// ── Root ──

export type ChipRootProps =
    /** What the chip contributes to a ChipGroup's value (and its roving key). */
    & Define.Prop<'value', string, false>
    /** Standalone: the chip is a toggle. Inside a `selectable` group it always is. */
    & Define.Prop<'selectable', boolean, false>
    & Define.Model<boolean>
    & Define.Prop<'defaultSelected', boolean, false>
    & Define.Event<'selectedChange', boolean>
    /** Backspace/Delete on the action remove the chip, as its `Remove` button does. */
    & Define.Prop<'removable', boolean, false>
    & Define.Event<'remove', void>
    /** The action's accessible name (`aria-label`) — for an icon-only chip. */
    & Define.Prop<'label', string, false>
    & WithVariantAxes<'chip'>
    & WithDisabled
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const ChipRoot = component<ChipRootProps>(({ props, slots, emit }) => {
    const group = useChipGroupContext();
    const state = createControllableState<boolean>(
        () => props.model,
        props.defaultSelected ?? false,
        (v) => emit('selectedChange', v),
    );
    const fallbackValue = createId('zx-chip');
    const value = (): string => props.value ?? fallbackValue;
    const grouped = (): boolean => group.inGroup && group.selection() !== 'none';
    const selectable = (): boolean => grouped() || !!props.selectable;
    const on = (): boolean => (grouped() ? group.selected().includes(value()) : selectable() && state.value);
    const disabled = (): boolean => !!props.disabled || group.disabled();
    let actionEl: HTMLElement | null = null;
    let rootEl: HTMLElement | null = null;

    const ctx: ChipContext = {
        value,
        selectable,
        on,
        toggle: () => {
            if (disabled() || !selectable()) return;
            if (grouped()) group.toggle(value());
            else state.value = !state.value;
        },
        disabled,
        removable: () => !!props.removable,
        remove: () => {
            if (disabled()) return;
            // Focus leaves before the app drops the chip, so it lands on a
            // neighbour rather than falling back to <body> — only when it is
            // in this chip: a removal from elsewhere moves nothing.
            if (group.inGroup && rootEl?.contains(document.activeElement)) group.focusNeighbour(value());
            emit('remove');
        },
        label: () => props.label,
        text: () => props.label ?? actionEl?.textContent?.trim() ?? '',
        setActionEl: (el) => { actionEl = el; },
    };
    defineProvide(useChipContext, () => ctx);

    return () => (
        <div
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="root"
            data-state={selectable() ? stateAttr(on(), 'on', 'off') : undefined}
            data-selected={dataAttr(selectable() && on())}
            data-disabled={dataAttr(disabled())}
            {...variantAttrs(props)}
            class={props.class}
            ref={(node: HTMLElement | null) => { rootEl = node; }}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Chip.Root' });

// ── Action ──

export type ChipActionProps =
    /**
     * Declared rather than forwarded (sigx passes no rest props), and composed
     * with the chip's own handling — Button's rule.
     */
    & WithInteractionHandlers
    & WithClass
    /** Not `role`: an asChild action is given `button` (a link keeps its own). */
    & Omit<WithHtmlAttrs, 'role'>
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const ChipAction = component<ChipActionProps>(({ props, slots, onMounted, onUnmounted, onUpdated, signal }) => {
    const chip = useChipContext();
    const group = useChipGroupContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    // Whether an asChild element is an anchor, read once mounted (Button's
    // rule): a link chip keeps its link semantics unless it toggles, since
    // `aria-pressed` needs `role="button"`.
    const child = signal({ link: false });
    const readKind = (): void => {
        if (!props.asChild) return;
        const link = el?.tagName === 'A';
        if (link !== child.link) child.link = link;
    };
    onMounted(readKind);
    onUpdated(readKind);
    const press = createPressFeedback({
        owner: { scope: SCOPE, part: 'action' },
        getElement: () => el,
        isDisabled: () => chip.disabled(),
    });

    // Inside a group the action is a roving stop, keyed by the chip's value.
    let unregister = (): void => {};
    if (group.inGroup) {
        const item: ListItem = {
            id: `chip-${chip.value()}`,
            get value() { return chip.value(); },
            disabled: () => chip.disabled(),
            el: () => el,
            textValue: () => el?.textContent?.trim() ?? chip.value(),
        };
        unregister = group.list.register(item);
        onMounted(() => group.rovingStop.changed());
    }
    onUnmounted(() => {
        unregister();
        if (group.inGroup) group.rovingStop.changed();
    });

    const tabIndex = (): number | undefined => {
        if (!group.inGroup) return props.asChild && !chip.disabled() ? 0 : undefined;
        if (chip.disabled()) return -1;
        return group.rovingStop.isTabStop(chip.value(), group.selected()) ? 0 : -1;
    };

    const bag = (): PartProps => {
        const attrs = htmlAttrs(props);
        const selectable = chip.selectable();
        return {
            ...attrs,
            'data-scope': SCOPE,
            'data-part': 'action',
            'data-state': selectable ? stateAttr(chip.on(), 'on', 'off') : undefined,
            'data-disabled': dataAttr(chip.disabled()),
            'data-focus-visible': dataAttr(focus.visible),
            tabIndex: tabIndex(),
            'aria-pressed': selectable ? (chip.on() ? 'true' : 'false') : undefined,
            'aria-label': chip.label() ?? attrs['aria-label'],
            'aria-keyshortcuts': chip.removable() ? 'Backspace Delete' : undefined,
            // asChild elements get the button contract supplied by hand.
            'aria-disabled': props.asChild && chip.disabled() ? 'true' : undefined,
            role: props.asChild && (selectable || !child.link) ? 'button' : undefined,
            ref: (node: HTMLElement | null) => { el = node; chip.setActionEl(node); },
            onClick: (e: MouseEvent) => {
                if (chip.disabled()) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                chip.toggle();
                props.onClick?.(e);
            },
            onKeydown: (e: KeyboardEvent) => {
                if (chip.disabled()) return;
                press.onKeydown(e);
                props.onKeydown?.(e);
                if (e.defaultPrevented) return;
                if (group.inGroup) group.keydown(e, chip.value());
                if (chip.removable() && (e.key === 'Backspace' || e.key === 'Delete')) {
                    e.preventDefault();
                    chip.remove();
                    return;
                }
                if (props.asChild && !e.repeat && (e.key === 'Enter' || e.key === ' ') && !synthesizesClickFrom(e.currentTarget, e.key)) {
                    e.preventDefault();
                    chip.toggle();
                }
            },
            onKeyup: press.onKeyup,
            onFocus: (e: FocusEvent) => {
                focus.visible = isFocusVisible(el);
                props.onFocus?.(e);
            },
            onBlur: (e: FocusEvent) => {
                press.onBlur(e);
                focus.visible = false;
                props.onBlur?.(e);
            },
            onPointerdown: press.onPointerdown,
            onPointerup: press.onPointerup,
            onPointercancel: press.onPointercancel,
            onPointerleave: press.onPointerleave,
        };
    };

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <button type="button" class={props.class} disabled={chip.disabled()} {...b}>
                {slots.default?.(b)}
            </button>
        );
    };
}, { name: 'Chip.Action' });

// ── Icon, Label ──

export type ChipSlotProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

/** Decorative, like Alert's and NavList's icons: the label names the chip. */
const ChipIcon = component<ChipSlotProps>(({ props, slots }) => () => (
    <span {...htmlAttrs(props)} aria-hidden="true" data-scope={SCOPE} data-part="icon" class={props.class}>
        {slots.default?.()}
    </span>
), { name: 'Chip.Icon' });

const ChipLabel = component<ChipSlotProps>(({ props, slots }) => () => (
    <span {...htmlAttrs(props)} data-scope={SCOPE} data-part="label" class={props.class}>
        {slots.default?.()}
    </span>
), { name: 'Chip.Label' });

// ── Remove ──

export type ChipRemoveProps =
    /** Accessible name; defaults to "Remove <the chip's text>". */
    & Define.Prop<'label', string, false>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const ChipRemove = component<ChipRemoveProps>(({ props, slots, signal }) => {
    const chip = useChipContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        owner: { scope: SCOPE, part: 'remove' },
        getElement: () => el,
        isDisabled: () => chip.disabled(),
    });
    return () => {
        const attrs = htmlAttrs(props);
        const text = chip.text();
        return (
            <button
                type="button"
                {...attrs}
                data-scope={SCOPE}
                data-part="remove"
                data-disabled={dataAttr(chip.disabled())}
                data-focus-visible={dataAttr(focus.visible)}
                disabled={chip.disabled()}
                // A pointer affordance: the keyboard path is Backspace/Delete on the action.
                tabIndex={-1}
                aria-label={props.label ?? attrs['aria-label'] ?? (text ? `Remove ${text}` : 'Remove')}
                class={props.class}
                ref={(node: HTMLElement | null) => { el = node; }}
                onClick={() => chip.remove()}
                onKeydown={press.onKeydown}
                onKeyup={press.onKeyup}
                onFocus={() => { focus.visible = isFocusVisible(el); }}
                onBlur={(e: FocusEvent) => { press.onBlur(e); focus.visible = false; }}
                onPointerdown={press.onPointerdown}
                onPointerup={press.onPointerup}
                onPointercancel={press.onPointercancel}
                onPointerleave={press.onPointerleave}
            >
                {slots.default ? slots.default() : <span aria-hidden="true">×</span>}
            </button>
        );
    };
}, { name: 'Chip.Remove' });

export const Chip = compound(ChipRoot, {
    Root: ChipRoot,
    Action: ChipAction,
    Icon: ChipIcon,
    Label: ChipLabel,
    Remove: ChipRemove,
});
