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
 * APG tooltip semantics: opens on focus immediately and on hover after
 * `openDelay`; closes on blur and on Escape WITHOUT moving focus, and on
 * pointer leave after a grace period ({@link TOOLTIP_CLOSE_GRACE} ms unless
 * `closeDelay` is set) so the pointer can cross onto the popup (WCAG 1.4.13
 * hoverable). `closeDelay` has no single default: unset, pointer leave waits
 * the grace period and blur closes at once; set, it applies to both.
 * The popup is `role="tooltip"` and referenced from the trigger via
 * `aria-describedby`. `popover="manual"` gives the top layer without light
 * dismiss (a tooltip must not close because the user clicked elsewhere —
 * it closes because the pointer/focus left).
 */
import { component, compound, defineInjectable, defineProvide, effect } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { createDismissable } from '../../behaviors/dismiss.js';
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

interface TooltipContext {
    state: ControllableState<boolean>;
    ids: { popup: string };
    show(immediate?: boolean): void;
    /**
     * `pointer` hides after `closeDelay ?? TOOLTIP_CLOSE_GRACE` (the hover
     * grace period); a blur hides after `closeDelay ?? 0`.
     */
    hide(pointer?: boolean): void;
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
    & Define.Prop<'positionStrategy', PositionStrategy, false>
    & Define.Slot<'default'>;

const TooltipRoot = component<TooltipRootProps>(({ props, slots, emit, onUnmounted }) => {
    const state = createControllableState<boolean>(
        () => props.model,
        props.defaultOpen ?? false,
        (v) => emit('openChange', v),
    );
    const baseId = createId('zx-tooltip');
    let anchor: HTMLElement | null = null;
    let popup: HTMLElement | null = null;
    let openTimer: ReturnType<typeof setTimeout> | undefined;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    onUnmounted(() => {
        clearTimeout(openTimer);
        clearTimeout(closeTimer);
    });

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
            openTimer = setTimeout(() => { state.value = true; }, props.openDelay ?? 600);
        },
        hide(pointer = false) {
            clearTimeout(openTimer);
            clearTimeout(closeTimer);
            // Blur keeps closing immediately by default — focus has left for
            // good; only a pointer can be on its way to the popup.
            const delay = props.closeDelay ?? (pointer ? TOOLTIP_CLOSE_GRACE : 0);
            if (delay === 0) state.value = false;
            else closeTimer = setTimeout(() => { state.value = false; }, delay);
        },
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
        dismiss: () => {
            clearTimeout(openTimer);
            clearTimeout(closeTimer);
            state.value = false;
        },
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
            onPointerenter: () => tooltip.show(),
            onPointerleave: () => tooltip.hide(true),
            onFocus: () => tooltip.show(true),
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
    Trigger: TooltipTrigger,
    Popup: TooltipPopup,
});
