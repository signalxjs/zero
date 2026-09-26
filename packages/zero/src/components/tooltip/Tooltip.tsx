/**
 * Tooltip — hover/focus-intent label on `popover="manual"`.
 *
 * ```tsx
 * <Tooltip.Root>
 *     <Tooltip.Trigger asChild>{(p) => <button {...p}>Save</button>}</Tooltip.Trigger>
 *     <Tooltip.Popup>Save the document</Tooltip.Popup>
 * </Tooltip.Root>
 * ```
 *
 * APG tooltip semantics: opens on KEYBOARD focus immediately (a focus that
 * matches `:focus-visible` — a click that focuses the trigger does not open
 * it) and on mouse/pen hover after `openDelay` (touch "hover" is ignored);
 * closes on press (and stays closed until the pointer leaves), on blur and
 * on Escape WITHOUT moving focus, and on
 * pointer leave after a grace period ({@link TOOLTIP_CLOSE_GRACE} ms unless
 * `closeDelay` is set) so the pointer can cross onto the popup (WCAG 1.4.13
 * hoverable). `closeDelay` has no single default: unset, pointer leave waits
 * the grace period and blur closes at once; set, it applies to both.
 * The popup is `role="tooltip"` and referenced from the trigger via
 * `aria-describedby`. `popover="manual"` gives the top layer without light
 * dismiss (a tooltip must not close because the user clicked elsewhere —
 * it closes because the pointer/focus left).
 *
 * `Tooltip.Group` (no element, no anatomy part) shares the delays across a
 * set of tooltips — a toolbar: once one has opened, moving to a sibling
 * opens it at once and closes the first.
 */
import { component, compound, defineInjectable, defineProvide, effect } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { createDismissable } from '../../behaviors/dismiss.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createAnchorPosition, type Placement, type PositionStrategy } from '../../behaviors/position.js';
import { createTopLayerExit } from '../../behaviors/top-layer-exit.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithDisabled, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { tooltipAnatomy } from './anatomy.js';
import { mountScope } from '../../behaviors/mount-scope.js';

const SCOPE = tooltipAnatomy.scope;

/**
 * Default pointer-leave grace period (ms). The popup sits `offset` px off
 * its trigger, so a pointer moving from one to the other crosses a gap that
 * belongs to neither; the popup's `pointerenter` cancels this timer. Without
 * it the tooltip is not hoverable (WCAG 2.1 SC 1.4.13, #167).
 */
const TOOLTIP_CLOSE_GRACE = 120;

/** Default hover-intent delay (ms), for a Root and for a Group. */
const TOOLTIP_OPEN_DELAY = 600;

// ── Group ──

/**
 * The shared timing state of a `Tooltip.Group`. Lives in the provided
 * context (one per rendered Group), never module-global, so nothing leaks
 * across SSR requests.
 */
interface TooltipGroupContext {
    readonly openDelay: number | undefined;
    readonly closeDelay: number | undefined;
    readonly skipDelay: number;
    /** `Date.now()` when a member last closed; `-Infinity` before any has. */
    lastClosedAt: number;
    /** The member currently open, and how to close it instantly. */
    open: { id: string; close(): void } | null;
}

const useTooltipGroup = defineInjectable<TooltipGroupContext | null>(() => null);

export type TooltipGroupProps =
    /** Hover-intent delay for every member without its own. Default 600. */
    & Define.Prop<'openDelay', number, false>
    /** Close delay for every member without its own (Root's semantics when unset). */
    & Define.Prop<'closeDelay', number, false>
    /**
     * How long (ms) after a member closes a hover on another member opens it
     * with no delay. Default 300. While a member is open, hovering another
     * always opens it at once.
     */
    & Define.Prop<'skipDelay', number, false>
    & Define.Slot<'default'>;

const TooltipGroup = component<TooltipGroupProps>(({ props, slots }) => {
    const group: TooltipGroupContext = {
        get openDelay() { return props.openDelay; },
        get closeDelay() { return props.closeDelay; },
        get skipDelay() { return props.skipDelay ?? 300; },
        lastClosedAt: -Infinity,
        open: null,
    };
    defineProvide(useTooltipGroup, () => group);
    return () => <>{slots.default?.()}</>;
}, { name: 'Tooltip.Group' });

interface TooltipContext {
    state: ControllableState<boolean>;
    ids: { popup: string };
    show(immediate?: boolean): void;
    /**
     * `pointer` hides after `closeDelay ?? TOOLTIP_CLOSE_GRACE` (the hover
     * grace period); a blur hides after `closeDelay ?? 0`.
     */
    hide(pointer?: boolean): void;
    /** Close at once, cancelling any pending open or close. */
    dismiss(): void;
    setAnchor(el: HTMLElement | null): void;
    getAnchor(): HTMLElement | null;
    setPopup(el: HTMLElement | null): void;
    getPopup(): HTMLElement | null;
}

function makeInert(): TooltipContext {
    return {
        state: createInertState<boolean>(false),
        ids: { popup: 'zx-tooltip-inert' },
        show: () => {},
        hide: () => {},
        dismiss: () => {},
        setAnchor: () => {},
        getAnchor: () => null,
        setPopup: () => {},
        getPopup: () => null,
    };
}

export const useTooltipContext = defineInjectable<TooltipContext>(() => makeInert());

// ── Root ──

export type TooltipRootProps =
    & Define.Model<boolean>
    & Define.Prop<'defaultOpen', boolean, false>
    & Define.Event<'openChange', boolean>
    & Define.Prop<'openDelay', number, false>
    & Define.Prop<'closeDelay', number, false>
    & Define.Prop<'placement', Placement, false>
    & Define.Prop<'offset', number, false>
    /** Margin, px, the popup keeps from the viewport edges when flipping and shifting (default 8). */
    & Define.Prop<'collisionPadding', number, false>
    /** Cross-axis offset, px, from a `-start`/`-end` alignment (default 0). */
    & Define.Prop<'alignOffset', number, false>
    & Define.Prop<'positionStrategy', PositionStrategy, false>
    & Define.Slot<'default'>;

const TooltipRoot = component<TooltipRootProps>(({ props, slots, emit, onUnmounted }) => {
    const state = createControllableState<boolean>(
        () => props.model,
        props.defaultOpen ?? false,
        (v) => emit('openChange', v),
    );
    const baseId = createId('zx-tooltip');
    const group = useTooltipGroup();
    let anchor: HTMLElement | null = null;
    let popup: HTMLElement | null = null;
    let openTimer: ReturnType<typeof setTimeout> | undefined;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    onUnmounted(() => {
        clearTimeout(openTimer);
        clearTimeout(closeTimer);
        if (group?.open?.id === baseId) group.open = null;
    });

    const closeNow = () => {
        clearTimeout(openTimer);
        clearTimeout(closeTimer);
        state.value = false;
    };
    const closeDelay = () => props.closeDelay ?? group?.closeDelay;

    // Group membership: one member open at a time, and the close time the
    // skip window is measured from. Tracks the state itself, so a
    // model-driven open or close counts too.
    if (group) {
        let wasOpen = false;
        effect(() => {
            const open = state.value;
            if (open === wasOpen) return;
            wasOpen = open;
            if (open) {
                const other = group.open;
                group.open = { id: baseId, close: closeNow };
                if (other && other.id !== baseId) other.close();
            } else {
                if (group.open?.id === baseId) group.open = null;
                group.lastClosedAt = Date.now();
            }
        });
    }

    const ctx: TooltipContext = {
        state,
        ids: { popup: `${baseId}-popup` },
        show(immediate = false) {
            clearTimeout(closeTimer);
            if (immediate) {
                state.value = true;
                return;
            }
            clearTimeout(openTimer);
            // In a group, a hover while a sibling is open — or within
            // `skipDelay` of one closing — skips the intent delay.
            const skip = !!group && (
                (group.open !== null && group.open.id !== baseId)
                || Date.now() - group.lastClosedAt < group.skipDelay
            );
            const delay = skip ? 0 : props.openDelay ?? group?.openDelay ?? TOOLTIP_OPEN_DELAY;
            if (delay === 0) {
                state.value = true;
                return;
            }
            openTimer = setTimeout(() => { state.value = true; }, delay);
        },
        hide(pointer = false) {
            clearTimeout(openTimer);
            clearTimeout(closeTimer);
            // Blur keeps closing immediately by default — focus has left for
            // good; only a pointer can be on its way to the popup.
            const delay = closeDelay() ?? (pointer ? TOOLTIP_CLOSE_GRACE : 0);
            if (delay === 0) state.value = false;
            else closeTimer = setTimeout(() => { state.value = false; }, delay);
        },
        dismiss: closeNow,
        setAnchor: (el) => { anchor = el; },
        getAnchor: () => anchor,
        setPopup: (el) => { popup = el; },
        getPopup: () => popup,
    };
    defineProvide(useTooltipContext, () => ctx);

    createAnchorPosition({
        getAnchor: () => anchor,
        getFloating: () => popup,
        isOpen: () => state.value,
        placement: () => props.placement ?? 'top',
        offset: () => props.offset ?? 6,
        collisionPadding: () => props.collisionPadding,
        alignOffset: () => props.alignOffset,
        strategy: props.positionStrategy,
    });

    // Escape must dismiss the tooltip no matter where focus is (WCAG 2.1
    // SC 1.4.13) — a trigger-local keydown only fires when the tooltip was
    // focus-opened. The dismiss layer's document listener covers hover-opens
    // too. Outside press stays off: a tooltip closes because pointer/focus
    // left, never because the user clicked elsewhere. The dismissal is
    // immediate (no closeDelay) and clears any pending hover-open so the
    // tooltip cannot pop back up after the user asked it to go away.
    createDismissable({
        getElement: () => popup,
        isOpen: () => state.value,
        dismiss: closeNow,
        outsidePress: false,
    });

    return () => <>{slots.default?.()}</>;
}, { name: 'Tooltip.Root' });

// ── Trigger ──

export type TooltipTriggerProps =
    & WithDisabled
    & WithClass
    /** An app `aria-describedby` joins the popup's while it shows. */
    & WithHtmlAttrs
    & WithVariantAxes<'tooltip'>
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const TooltipTrigger = component<TooltipTriggerProps>(({ props, slots }) => {
    const tooltip = useTooltipContext();
    // Set by a press, cleared by the pointer leaving: a pressed trigger
    // stays quiet until the pointer has left and come back, so the tooltip
    // does not re-open over whatever the press opened (a menu, a dialog).
    let suppressUntilLeave = false;

    const bag = (): PartProps => {
        const attrs = htmlAttrs(props);
        return {
            ...attrs,
            'data-scope': SCOPE,
            'data-part': 'trigger',
            ...variantAttrs(props),
            'data-state': stateAttr(tooltip.state.value, 'open', 'closed'),
            'data-disabled': dataAttr(props.disabled),
            'aria-describedby': [
                tooltip.state.value ? tooltip.ids.popup : undefined,
                attrs['aria-describedby'],
            ].filter(Boolean).join(' ') || undefined,
            onPointerenter: (e: PointerEvent) => {
                // Touch has no hover: its pointerenter is the first beat of a
                // tap, not an intent to read the label.
                if (e.pointerType === 'touch' || suppressUntilLeave) return;
                tooltip.show();
            },
            onPointerleave: () => {
                suppressUntilLeave = false;
                tooltip.hide(true);
            },
            onPointerdown: () => {
                suppressUntilLeave = true;
                tooltip.dismiss();
            },
            // Keyboard focus only: a click focuses the trigger too, and a
            // tooltip over what the click opened is noise. `:focus-visible`
            // is the platform's own keyboard-vs-pointer heuristic.
            onFocus: (e: FocusEvent) => {
                if (isFocusVisible(e.currentTarget as Element)) tooltip.show(true);
            },
            onBlur: () => tooltip.hide(),
            // Escape is handled by the dismiss layer in Root (document-level,
            // WCAG 1.4.13) — no trigger-local keydown needed.
            ref: (node: HTMLElement | null) => tooltip.setAnchor(node),
        };
    };

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <button type="button" class={props.class} {...b} disabled={props.disabled}>
                {slots.default?.(b)}
            </button>
        );
    };
}, { name: 'Tooltip.Trigger' });

// ── Popup ──

/** Not `id`/`role`: the Trigger is described by the popup, a `tooltip`. */
export type TooltipPopupProps = WithClass & Omit<WithHtmlAttrs, 'id' | 'role'> & Define.Slot<'default'>;

const TooltipPopup = component<TooltipPopupProps>(({ props, slots, onMounted }) => {
    const tooltip = useTooltipContext();
    let el: HTMLElement | null = null;
    // Outside Chromium the native close waits for the exit to play (#17).
    const exit = createTopLayerExit();

    const scoped = mountScope();
    onMounted(() => scoped(() => {
        effect(() => {
            const open = tooltip.state.value;
            const node = el as (HTMLElement & { showPopover?(): void; hidePopover?(): void; matches(s: string): boolean }) | null;
            if (!node || typeof node.showPopover !== 'function') return;
            if (open) exit.cancel();
            const showing = node.matches(':popover-open');
            if (open && !showing) node.showPopover();
            else if (!open && showing) {
                exit.close(node, () => {
                    if (!tooltip.state.value && node.matches(':popover-open')) node.hidePopover!();
                });
            }
        });
    }));

    return () => (
        <div
            {...htmlAttrs(props)}
            id={tooltip.ids.popup}
            data-scope={SCOPE}
            data-part="popup"
            data-state={stateAttr(tooltip.state.value, 'open', 'closed')}
            popover="manual"
            role="tooltip"
            class={props.class}
            ref={(node: HTMLElement | null) => { el = node; tooltip.setPopup(node); }}
            onPointerenter={() => tooltip.show(true)}
            onPointerleave={() => tooltip.hide(true)}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Tooltip.Popup' });

export const Tooltip = compound(TooltipRoot, {
    Root: TooltipRoot,
    Group: TooltipGroup,
    Trigger: TooltipTrigger,
    Popup: TooltipPopup,
});
