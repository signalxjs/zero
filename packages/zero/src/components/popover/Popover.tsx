/**
 * Popover — anchor-positioned, non-modal overlay on the `popover` attribute.
 *
 * ```tsx
 * <Popover.Root model={() => state.open} placement="bottom-start">
 *     <Popover.Trigger>Filters</Popover.Trigger>
 *     <Popover.Popup>
 *         <Popover.Title>Filters</Popover.Title>
 *         …
 *         <Popover.Close>Done</Popover.Close>
 *     </Popover.Popup>
 * </Popover.Root>
 * ```
 *
 * `popover="auto"` supplies the top layer, light dismiss and Escape
 * natively; the model mirrors into `showPopover()`/`hidePopover()` and
 * native `toggle` events sync back. Positioning comes from the pluggable
 * anchor-position behavior (fixed-coordinates strategy by default).
 */
import { component, compound, defineInjectable, defineProvide, effect } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { createAnchorPosition, type Placement, type PositionStrategy } from '../../behaviors/position.js';
import { createFocusRestore, focusFirst } from '../../behaviors/focus.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import { variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithDisabled, WithVariantAxes } from '../../contract/props.js';
import { popoverAnatomy } from './anatomy.js';

const SCOPE = popoverAnatomy.scope;

interface PopoverContext {
    state: ControllableState<boolean>;
    ids: { popup: string; title: string };
    /** Title reports its presence so the popup's ARIA ref never dangles. */
    titlePresent(): boolean;
    setTitlePresent(present: boolean): void;
    setAnchor(el: HTMLElement | null): void;
    getAnchor(): HTMLElement | null;
    setPopup(el: HTMLElement | null): void;
    getPopup(): HTMLElement | null;
}

function makeInert(): PopoverContext {
    return {
        state: createInertState<boolean>(false),
        ids: { popup: 'zx-popover-inert', title: 'zx-popover-inert-title' },
        titlePresent: () => false,
        setTitlePresent: () => {},
        setAnchor: () => {},
        getAnchor: () => null,
        setPopup: () => {},
        getPopup: () => null,
    };
}

export const usePopoverContext = defineInjectable<PopoverContext>(() => makeInert());

// ── Root ──

export type PopoverRootProps =
    & Define.Model<boolean>
    & Define.Prop<'defaultOpen', boolean, false>
    & Define.Event<'openChange', boolean>
    & Define.Prop<'placement', Placement, false>
    & Define.Prop<'offset', number, false>
    & Define.Prop<'positionStrategy', PositionStrategy, false>
    & Define.Slot<'default'>;

const PopoverRoot = component<PopoverRootProps>(({ props, slots, emit, signal }) => {
    const state = createControllableState<boolean>(
        () => props.model,
        props.defaultOpen ?? false,
        (v) => emit('openChange', v),
    );
    const baseId = createId('zx-popover');
    // Written from Title one microtask after its setup — a write made during
    // the render pass is invisible to the already-rendered popup.
    const present = signal({ title: false });
    let anchor: HTMLElement | null = null;
    let popup: HTMLElement | null = null;

    const ctx: PopoverContext = {
        state,
        ids: { popup: `${baseId}-popup`, title: `${baseId}-title` },
        titlePresent: () => present.title,
        setTitlePresent: (p) => { present.title = p; },
        setAnchor: (el) => { anchor = el; },
        getAnchor: () => anchor,
        setPopup: (el) => { popup = el; },
        getPopup: () => popup,
    };
    defineProvide(usePopoverContext, () => ctx);

    createAnchorPosition({
        getAnchor: () => anchor,
        getFloating: () => popup,
        isOpen: () => state.value,
        placement: () => props.placement ?? 'bottom',
        offset: () => props.offset ?? 6,
        strategy: props.positionStrategy,
    });
    createFocusRestore(() => state.value);

    return () => <>{slots.default?.()}</>;
}, { name: 'Popover.Root' });

// ── Trigger ──

export type PopoverTriggerProps =
    & WithDisabled
    & WithClass
    & WithVariantAxes<'popover'>
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const PopoverTrigger = component<PopoverTriggerProps>(({ props, slots, signal }) => {
    const popover = usePopoverContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => !!props.disabled,
    });

    const bag = (): PartProps => ({
        'data-scope': SCOPE,
        'data-part': 'trigger',
        ...variantAttrs(props),
        'data-state': stateAttr(popover.state.value, 'open', 'closed'),
        'data-disabled': dataAttr(props.disabled),
        'data-focus-visible': dataAttr(focus.visible),
        'aria-haspopup': 'dialog',
        'aria-expanded': popover.state.value ? 'true' : 'false',
        'aria-controls': popover.ids.popup,
        onClick: () => {
            if (!props.disabled) popover.state.value = !popover.state.value;
        },
        onFocus: () => { focus.visible = isFocusVisible(el); },
        onBlur: (e: FocusEvent) => {
            press.onBlur(e);
            focus.visible = false;
        },
        onKeydown: press.onKeydown,
        onKeyup: press.onKeyup,
        onPointerdown: press.onPointerdown,
        onPointerup: press.onPointerup,
        onPointercancel: press.onPointercancel,
        onPointerleave: press.onPointerleave,
        ref: (node: HTMLElement | null) => { el = node; popover.setAnchor(node); },
    });

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <button type="button" class={props.class} {...b} disabled={props.disabled}>
                {slots.default?.(b)}
            </button>
        );
    };
}, { name: 'Popover.Trigger' });

// ── Popup ──

export type PopoverPopupProps = WithClass & Define.Slot<'default'>;

const PopoverPopup = component<PopoverPopupProps>(({ props, slots, onMounted }) => {
    const popover = usePopoverContext();
    let el: HTMLElement | null = null;

    onMounted(() => {
        effect(() => {
            const open = popover.state.value;
            const node = el as (HTMLElement & { showPopover?(): void; hidePopover?(): void; matches(s: string): boolean }) | null;
            if (!node) return;
            if (typeof node.showPopover === 'function') {
                const showing = node.matches(':popover-open');
                if (open && !showing) node.showPopover();
                else if (!open && showing) node.hidePopover!();
            }
            // A dialog-role popup receives focus on open (APG): the first
            // tabbable, or the popup itself (tabIndex -1 below). After
            // showPopover(), never before — an unshown popover cannot take
            // focus. Deferred a task: createFocusRestore's watch captures
            // the previously focused element on a microtask, and moving
            // focus before that capture would make it "restore" into the
            // popup itself on close.
            if (open) {
                setTimeout(() => {
                    if (popover.state.value && node.isConnected) focusFirst(node);
                }, 0);
            }
        });
    });

    return () => (
        <div
            id={popover.ids.popup}
            data-scope={SCOPE}
            data-part="popup"
            data-state={stateAttr(popover.state.value, 'open', 'closed')}
            popover="auto"
            role="dialog"
            tabIndex={-1}
            aria-labelledby={popover.titlePresent() ? popover.ids.title : undefined}
            class={props.class}
            ref={(node: HTMLElement | null) => { el = node; popover.setPopup(node); }}
            onToggle={(e: Event) => {
                // Native light dismiss / Escape → model.
                const open = (e as ToggleEvent).newState === 'open';
                if (popover.state.value !== open) popover.state.value = open;
            }}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Popover.Popup' });

// ── Title ──

export type PopoverTitleProps = WithClass & Define.Slot<'default'>;

const PopoverTitle = component<PopoverTitleProps>(({ props, slots, onUnmounted }) => {
    const popover = usePopoverContext();
    // Deferred past the render pass — see the note on `present` in Root.
    let alive = true;
    queueMicrotask(() => { if (alive) popover.setTitlePresent(true); });
    onUnmounted(() => {
        alive = false;
        popover.setTitlePresent(false);
    });
    return () => (
        <h3 id={popover.ids.title} data-scope={SCOPE} data-part="title" class={props.class}>
            {slots.default?.()}
        </h3>
    );
}, { name: 'Popover.Title' });

// ── Close ──

export type PopoverCloseProps =
    & WithDisabled
    & WithClass
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const PopoverClose = component<PopoverCloseProps>(({ props, slots, signal }) => {
    const popover = usePopoverContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => !!props.disabled,
    });

    const bag = (): PartProps => ({
        'data-scope': SCOPE,
        'data-part': 'close',
        'data-disabled': dataAttr(props.disabled),
        'data-focus-visible': dataAttr(focus.visible),
        onClick: () => {
            if (!props.disabled) popover.state.value = false;
        },
        onFocus: () => { focus.visible = isFocusVisible(el); },
        onBlur: (e: FocusEvent) => {
            press.onBlur(e);
            focus.visible = false;
        },
        onKeydown: press.onKeydown,
        onKeyup: press.onKeyup,
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
            <button type="button" class={props.class} {...b} disabled={props.disabled}>
                {slots.default?.(b)}
            </button>
        );
    };
}, { name: 'Popover.Close' });

export const Popover = compound(PopoverRoot, {
    Root: PopoverRoot,
    Trigger: PopoverTrigger,
    Popup: PopoverPopup,
    Title: PopoverTitle,
    Close: PopoverClose,
});
