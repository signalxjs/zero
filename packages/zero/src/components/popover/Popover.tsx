/**
 * Popover — anchor-positioned, non-modal overlay on the `popover` attribute.
 *
 * ```tsx
 * <Popover.Root model={() => state.open} placement="bottom-start">
 *     <Popover.Trigger>Filters</Popover.Trigger>
 *     <Popover.Popup>
 *         <Popover.Arrow />
 *         <Popover.Title>Filters</Popover.Title>
 *         <Popover.Description>Narrow the list.</Popover.Description>
 *         …
 *         <Popover.Close>Done</Popover.Close>
 *     </Popover.Popup>
 * </Popover.Root>
 * ```
 *
 * `Popover.Anchor`, when rendered, is what the popup is positioned against
 * instead of the trigger (a field the trigger sits inside); the trigger
 * stays the toggle and the focus-restore target. `Popover.Arrow` is pointed
 * at the anchor's centre by the position strategy (`--arrow-x`/`--arrow-y`).
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
import { createTopLayerExit } from '../../behaviors/top-layer-exit.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithDisabled, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { popoverAnatomy } from './anatomy.js';
import { mountScope } from '../../behaviors/mount-scope.js';

const SCOPE = popoverAnatomy.scope;

interface PopoverContext {
    state: ControllableState<boolean>;
    ids: { popup: string; title: string; description: string };
    /**
     * Title/Description report their presence so the popup's ARIA refs never
     * dangle — counted, one `true` per mounted instance and one `false` per
     * unmounted one, so a swap that mounts the new part before the old one
     * reports gone still ends present.
     */
    titlePresent(): boolean;
    setTitlePresent(present: boolean): void;
    descriptionPresent(): boolean;
    setDescriptionPresent(present: boolean): void;
    /** The rendered Trigger — the toggle and the focus-restore target. */
    setTrigger(el: HTMLElement | null): void;
    /** The rendered `Popover.Anchor`, which positions the popup in the trigger's place. */
    setAnchor(el: HTMLElement | null): void;
    /** What the popup is positioned against: the Anchor when rendered, else the Trigger. */
    getAnchor(): HTMLElement | null;
    setPopup(el: HTMLElement | null): void;
    getPopup(): HTMLElement | null;
    /** The rendered `Popover.Arrow`, which the position strategy points at the anchor. */
    setArrow(el: HTMLElement | null): void;
}

function makeInert(): PopoverContext {
    return {
        state: createInertState<boolean>(false),
        ids: { popup: 'zx-popover-inert', title: 'zx-popover-inert-title', description: 'zx-popover-inert-description' },
        titlePresent: () => false,
        setTitlePresent: () => {},
        descriptionPresent: () => false,
        setDescriptionPresent: () => {},
        setTrigger: () => {},
        setAnchor: () => {},
        getAnchor: () => null,
        setPopup: () => {},
        getPopup: () => null,
        setArrow: () => {},
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
    /** Margin, px, the popup keeps from the viewport edges when flipping and shifting (default 8). */
    & Define.Prop<'collisionPadding', number, false>
    /** Cross-axis offset, px, from a `-start`/`-end` alignment (default 0). */
    & Define.Prop<'alignOffset', number, false>
    /** Minimum distance, px, between a `Popover.Arrow` and the popup's corners (default 8). */
    & Define.Prop<'arrowPadding', number, false>
    & Define.Prop<'positionStrategy', PositionStrategy, false>
    & Define.Slot<'default'>;

const PopoverRoot = component<PopoverRootProps>(({ props, slots, emit, signal }) => {
    const state = createControllableState<boolean>(
        () => props.model,
        props.defaultOpen ?? false,
        (v) => emit('openChange', v),
    );
    const baseId = createId('zx-popover');
    // Written from Title/Description one microtask after their setup — a
    // write made during the render pass is invisible to the already-rendered
    // popup.
    const present = signal({ title: 0, description: 0 });
    let trigger: HTMLElement | null = null;
    let anchor: HTMLElement | null = null;
    let popup: HTMLElement | null = null;
    let arrow: HTMLElement | null = null;
    const positionAnchor = (): HTMLElement | null => anchor ?? trigger;

    const ctx: PopoverContext = {
        state,
        ids: { popup: `${baseId}-popup`, title: `${baseId}-title`, description: `${baseId}-description` },
        titlePresent: () => present.title > 0,
        setTitlePresent: (p) => { present.title += p ? 1 : -1; },
        descriptionPresent: () => present.description > 0,
        setDescriptionPresent: (p) => { present.description += p ? 1 : -1; },
        setTrigger: (el) => { trigger = el; },
        setAnchor: (el) => { anchor = el; },
        getAnchor: positionAnchor,
        setPopup: (el) => { popup = el; },
        getPopup: () => popup,
        setArrow: (el) => { arrow = el; },
    };
    defineProvide(usePopoverContext, () => ctx);

    createAnchorPosition({
        getAnchor: positionAnchor,
        getFloating: () => popup,
        isOpen: () => state.value,
        placement: () => props.placement ?? 'bottom',
        offset: () => props.offset ?? 6,
        collisionPadding: () => props.collisionPadding,
        alignOffset: () => props.alignOffset,
        getArrow: () => arrow,
        arrowPadding: () => props.arrowPadding,
        strategy: props.positionStrategy,
    });
    // Focus goes back only while it is still the popup's: an outside
    // pointerdown on an input, or a Tab out, keeps it where it went (#262).
    // The fallback is the TRIGGER, never a `Popover.Anchor`: the anchor is
    // where the popup sits, the trigger is what the user pressed.
    createFocusRestore(() => state.value, {
        getSurface: () => popup,
        fallback: () => trigger,
    });

    return () => <>{slots.default?.()}</>;
}, { name: 'Popover.Root' });

// ── Trigger ──

export type PopoverTriggerProps =
    & WithDisabled
    & WithClass
    & WithHtmlAttrs
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
        ...htmlAttrs(props),
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
        ref: (node: HTMLElement | null) => { el = node; popover.setTrigger(node); },
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

export type PopoverPopupProps =
    & WithClass
    /** Not `id`/`role`: the Trigger points at the popup, which is a `dialog`. */
    & Omit<WithHtmlAttrs, 'id' | 'role'>
    & Define.Slot<'default'>;

const PopoverPopup = component<PopoverPopupProps>(({ props, slots, onMounted }) => {
    const popover = usePopoverContext();
    let el: HTMLElement | null = null;
    // Outside Chromium the native close waits for the exit to play (#17).
    const exit = createTopLayerExit();

    const scoped = mountScope();
    onMounted(() => scoped(() => {
        const sync = (open: boolean) => {
            const node = el as (HTMLElement & { showPopover?(): void; hidePopover?(): void; matches(s: string): boolean }) | null;
            if (!node) return;
            if (typeof node.showPopover === 'function') {
                if (open) exit.cancel();
                const showing = node.matches(':popover-open');
                if (open && !showing) {
                    // A popup below another element mounts before its parent
                    // has inserted the subtree, and `showPopover()` on a
                    // detached element throws (#102) — Dialog's deferral.
                    if (!node.isConnected) {
                        queueMicrotask(() => { if (node.isConnected) sync(popover.state.value); });
                        return;
                    }
                    node.showPopover();
                } else if (!open && showing) {
                    exit.close(node, () => {
                        if (!popover.state.value && node.matches(':popover-open')) node.hidePopover!();
                    });
                }
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
        };
        effect(() => sync(popover.state.value));
    }));

    return () => {
        const attrs = htmlAttrs(props);
        return (
            <div
                {...attrs}
                id={popover.ids.popup}
                data-scope={SCOPE}
                data-part="popup"
                data-state={stateAttr(popover.state.value, 'open', 'closed')}
                popover="auto"
                role="dialog"
                tabIndex={-1}
                // An app's own references join the Title's and Description's.
                aria-labelledby={[
                    popover.titlePresent() ? popover.ids.title : undefined,
                    attrs['aria-labelledby'],
                ].filter(Boolean).join(' ') || undefined}
                aria-describedby={[
                    popover.descriptionPresent() ? popover.ids.description : undefined,
                    attrs['aria-describedby'],
                ].filter(Boolean).join(' ') || undefined}
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
    };
}, { name: 'Popover.Popup' });

// ── Title ──

/** Not `id`: the popup is labelled by the Title's own. */
export type PopoverTitleProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

/**
 * Report a labelling part's presence to the Root. Both writes are deferred a
 * microtask: the mount's past the render pass (see `present` in Root), and
 * the unmount's because it runs INSIDE the popup's re-render, which has
 * already read the flag — a write there would not re-run it, and the popup
 * would keep pointing at an id that is gone. An instance unmounted before its
 * mount write landed reports nothing either way.
 */
function reportPresence(set: (present: boolean) => void, onUnmounted: (fn: () => void) => void): void {
    let alive = true;
    let reported = false;
    queueMicrotask(() => {
        if (!alive) return;
        reported = true;
        set(true);
    });
    onUnmounted(() => {
        alive = false;
        if (reported) queueMicrotask(() => set(false));
    });
}

const PopoverTitle = component<PopoverTitleProps>(({ props, slots, onUnmounted }) => {
    const popover = usePopoverContext();
    reportPresence(popover.setTitlePresent, onUnmounted);
    return () => (
        <h3 {...htmlAttrs(props)} id={popover.ids.title} data-scope={SCOPE} data-part="title" class={props.class}>
            {slots.default?.()}
        </h3>
    );
}, { name: 'Popover.Title' });

// ── Description ──

/** Not `id`: the popup is described by the Description's own. */
export type PopoverDescriptionProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const PopoverDescription = component<PopoverDescriptionProps>(({ props, slots, onUnmounted }) => {
    const popover = usePopoverContext();
    reportPresence(popover.setDescriptionPresent, onUnmounted);
    return () => (
        <p {...htmlAttrs(props)} id={popover.ids.description} data-scope={SCOPE} data-part="description" class={props.class}>
            {slots.default?.()}
        </p>
    );
}, { name: 'Popover.Description' });

// ── Anchor ──

export type PopoverAnchorProps =
    & WithClass
    & WithHtmlAttrs
    & WithAsChild
    & Define.Slot<'default', PartProps>;

/**
 * What the popup is positioned against, in the trigger's place — a field
 * whose trigger is a small button inside it, a row the popup should line up
 * with. Only while rendered: unmounted, the trigger anchors again. No
 * behaviour of its own; the trigger still toggles and still receives focus
 * back on close.
 */
const PopoverAnchor = component<PopoverAnchorProps>(({ props, slots, onUnmounted }) => {
    const popover = usePopoverContext();
    let el: HTMLElement | null = null;
    onUnmounted(() => {
        if (el) popover.setAnchor(null);
    });
    const bag = (): PartProps => ({
        ...htmlAttrs(props),
        'data-scope': SCOPE,
        'data-part': 'anchor',
        ref: (node: HTMLElement | null) => { el = node; popover.setAnchor(node); },
    });
    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return <div class={props.class} {...b}>{slots.default?.(b)}</div>;
    };
}, { name: 'Popover.Anchor' });

// ── Arrow ──

/** The arrow is decoration: it renders `aria-hidden="true"` whatever the app passes. */
export type PopoverArrowProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

/**
 * A mark on the popup edge facing the anchor. The position strategy writes
 * `--arrow-x` (a popup above or below) or `--arrow-y` (one beside) on it, the
 * offset that points it at the anchor's centre after any flip or shift; the
 * recipe places it on the edge the popup's `data-placement` names and draws
 * it. Empty by default — children (an SVG) replace the recipe's drawing.
 */
const PopoverArrow = component<PopoverArrowProps>(({ props, slots, onUnmounted }) => {
    const popover = usePopoverContext();
    let el: HTMLElement | null = null;
    onUnmounted(() => {
        if (el) popover.setArrow(null);
    });
    return () => (
        <span
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="arrow"
            aria-hidden="true"
            class={props.class}
            ref={(node: HTMLElement | null) => { el = node; popover.setArrow(node); }}
        >
            {slots.default?.()}
        </span>
    );
}, { name: 'Popover.Arrow' });

// ── Close ──

export type PopoverCloseProps =
    & WithDisabled
    & WithClass
    & WithHtmlAttrs
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
        ...htmlAttrs(props),
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
    Description: PopoverDescription,
    Anchor: PopoverAnchor,
    Arrow: PopoverArrow,
    Close: PopoverClose,
});
