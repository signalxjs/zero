/**
 * HoverCard — a hover-intent preview card whose content may be interactive,
 * on `popover="manual"`.
 *
 * ```tsx
 * <HoverCard.Root>
 *     <HoverCard.Trigger href="/users/ada">@ada</HoverCard.Trigger>
 *     <HoverCard.Popup>
 *         <HoverCard.Arrow />
 *         Ada Lovelace — <a href="/users/ada/followers">1.2k followers</a>
 *     </HoverCard.Popup>
 * </HoverCard.Root>
 * ```
 *
 * The preview a sighted pointer user gets on the way to a destination: a
 * profile behind an `@mention`, a page behind a link. The trigger is a link
 * (`asChild` for your own element) and the card is an enhancement, never the
 * only way to its content — so the trigger is not a disclosure (no
 * `aria-expanded`) and the card is not a description (no `role="tooltip"`,
 * no `aria-describedby`): it may hold links and buttons.
 *
 * Opens on mouse/pen hover after `openDelay` (700 ms; touch "hover" is
 * ignored) and on KEYBOARD focus of the trigger at once (a focus matching
 * `:focus-visible`; a click that focuses it does not; `openOnFocus={false}`
 * turns focus-opening off). Closes `closeDelay` (300 ms) after the pointer
 * leaves both the trigger and the card; while the pointer travels from the
 * trigger toward the card inside the safe triangle between them, the close
 * keeps being pushed back, so a slow trip still arrives. Focus moving into
 * the card keeps it open — the card closes when focus leaves both, unless
 * the pointer is over one of them. Escape closes it from anywhere (the
 * dismiss layer) and, when focus was inside the card, returns focus to the
 * trigger without reopening it. An outside press does not close it.
 *
 * `HoverCard.Arrow`, rendered inside the popup, is pointed at the trigger's
 * centre by the position strategy (`--arrow-x`/`--arrow-y`).
 */
import { component, compound, defineInjectable, defineProvide, effect } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { createDismissable } from '../../behaviors/dismiss.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createHoverIntent } from '../../behaviors/hover-intent.js';
import { createAnchorPosition, type Placement, type PositionStrategy } from '../../behaviors/position.js';
import { pointInTriangle, safeTriangleTo } from '../../behaviors/safe-triangle.js';
import { createTopLayerExit } from '../../behaviors/top-layer-exit.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { hoverCardAnatomy } from './anatomy.js';
import { mountScope } from '../../behaviors/mount-scope.js';

const SCOPE = hoverCardAnatomy.scope;

/** Default hover-intent delay (ms) before the card opens. */
const HOVER_CARD_OPEN_DELAY = 700;

/** Default delay (ms) after the pointer leaves before the card closes. */
const HOVER_CARD_CLOSE_DELAY = 300;

interface HoverCardContext {
    state: ControllableState<boolean>;
    ids: { popup: string };
    /** Pointer entered / left the trigger or the popup. */
    enter(e: PointerEvent, on: 'trigger' | 'popup'): void;
    leave(e: PointerEvent, on: 'trigger' | 'popup'): void;
    /** The trigger took focus; `visible` when it matches `:focus-visible`. */
    focusTrigger(visible: boolean): void;
    /** Focus entered the popup. */
    focusPopup(): void;
    /** Focus left the trigger or the popup for `next`. */
    blur(next: EventTarget | null): void;
    /** Move focus back to the trigger without reopening the card. */
    restoreFocus(): void;
    setAnchor(el: HTMLElement | null): void;
    setPopup(el: HTMLElement | null): void;
    /** The rendered `HoverCard.Arrow`, which the position strategy points at the trigger. */
    setArrow(el: HTMLElement | null): void;
}

function makeInert(): HoverCardContext {
    return {
        state: createInertState<boolean>(false),
        ids: { popup: 'zx-hover-card-inert' },
        enter: () => {},
        leave: () => {},
        focusTrigger: () => {},
        focusPopup: () => {},
        blur: () => {},
        restoreFocus: () => {},
        setAnchor: () => {},
        setPopup: () => {},
        setArrow: () => {},
    };
}

export const useHoverCardContext = defineInjectable<HoverCardContext>(() => makeInert());

// ── Root ──

export type HoverCardRootProps =
    & Define.Model<boolean>
    & Define.Prop<'defaultOpen', boolean, false>
    & Define.Event<'openChange', boolean>
    /** Hover-intent delay, ms, before the card opens (default 700). */
    & Define.Prop<'openDelay', number, false>
    /** Delay, ms, after the pointer leaves before the card closes (default 300). */
    & Define.Prop<'closeDelay', number, false>
    /** Open at once when the trigger takes KEYBOARD focus (default true). */
    & Define.Prop<'openOnFocus', boolean, false>
    /** Default `bottom`. */
    & Define.Prop<'placement', Placement, false>
    /** Gap, px, between the trigger and the card (default 8). */
    & Define.Prop<'offset', number, false>
    /** Margin, px, the popup keeps from the viewport edges when flipping and shifting (default 8). */
    & Define.Prop<'collisionPadding', number, false>
    /** Cross-axis offset, px, from a `-start`/`-end` alignment (default 0). */
    & Define.Prop<'alignOffset', number, false>
    /** Minimum distance, px, between a `HoverCard.Arrow` and the popup's corners (default 8). */
    & Define.Prop<'arrowPadding', number, false>
    & Define.Prop<'positionStrategy', PositionStrategy, false>
    & Define.Slot<'default'>;

const HoverCardRoot = component<HoverCardRootProps>(({ props, slots, emit, onUnmounted }) => {
    const state = createControllableState<boolean>(
        () => props.model,
        props.defaultOpen ?? false,
        (v) => emit('openChange', v),
    );
    const baseId = createId('zx-hover-card');
    let anchor: HTMLElement | null = null;
    let popup: HTMLElement | null = null;
    let arrow: HTMLElement | null = null;
    // What holds the card open: a pointer over the trigger or the card, and
    // focus inside either. Either one keeps it; it closes when both let go.
    let hovered = false;
    let focused = false;
    // Set while restoreFocus() moves focus to the trigger, so that focus
    // does not reopen the card the user just closed.
    let restoring = false;

    const intent = createHoverIntent((open) => { state.value = open; });
    const openDelay = () => props.openDelay ?? HOVER_CARD_OPEN_DELAY;
    const closeDelay = () => props.closeDelay ?? HOVER_CARD_CLOSE_DELAY;

    // The trip from the trigger to the card: while the pointer moves inside
    // the safe triangle toward the card, each move restarts the close delay.
    let stopTravel: (() => void) | null = null;
    const endTravel = () => {
        stopTravel?.();
        stopTravel = null;
    };
    const startTravel = (e: PointerEvent) => {
        endTravel();
        if (!popup || typeof document === 'undefined') return;
        const tri = safeTriangleTo({ x: e.clientX, y: e.clientY }, popup.getBoundingClientRect());
        if (!tri) return;
        const onMove = (m: PointerEvent) => {
            if (pointInTriangle({ x: m.clientX, y: m.clientY }, tri)) intent.close(closeDelay());
        };
        document.addEventListener('pointermove', onMove);
        stopTravel = () => document.removeEventListener('pointermove', onMove);
    };

    onUnmounted(() => {
        intent.cancel();
        endTravel();
    });

    const release = () => {
        if (hovered || focused) return;
        intent.close(0);
    };

    const dismiss = () => {
        hovered = false;
        focused = false;
        endTravel();
        intent.close(0);
    };

    const ctx: HoverCardContext = {
        state,
        ids: { popup: `${baseId}-popup` },
        enter(e, on) {
            // Touch has no hover: its pointerenter is the first beat of a
            // tap (which follows the link), not an intent to preview.
            if (e.pointerType === 'touch') return;
            hovered = true;
            endTravel();
            if (state.value) intent.cancelClose();
            // Entering a card that is closing (its exit still playing) does
            // not bring it back; only the trigger opens it.
            else if (on === 'trigger') intent.open(openDelay());
        },
        leave(e, on) {
            if (e.pointerType === 'touch') return;
            hovered = false;
            if (focused) return;
            // Also cancels a pending open: a pass shorter than openDelay
            // never opens the card.
            intent.close(closeDelay());
            if (on === 'trigger' && state.value) startTravel(e);
        },
        focusTrigger(visible) {
            if (restoring || !visible || props.openOnFocus === false) return;
            focused = true;
            intent.open(0);
        },
        focusPopup() {
            focused = true;
            if (state.value) intent.cancelClose();
        },
        blur(next) {
            const n = next as Node | null;
            if (n && (popup?.contains(n) || anchor?.contains(n))) return;
            if (!focused) return;
            focused = false;
            release();
        },
        restoreFocus() {
            focused = false;
            if (!anchor) return;
            restoring = true;
            try {
                anchor.focus();
            } finally {
                restoring = false;
            }
        },
        setAnchor: (el) => { anchor = el; },
        setPopup: (el) => { popup = el; },
        // An arrow mounted while the card is open (conditional render) is
        // placed a microtask later, once it is in the document.
        setArrow: (el) => {
            if (arrow === el) return;
            arrow = el;
            queueMicrotask(() => position.update());
        },
    };
    defineProvide(useHoverCardContext, () => ctx);

    // A close by any path ends the trip, so no stale listener pushes the
    // close of a card that is already shut, and lets go of focus: a card
    // the model closed must not stay pinned by a focus it no longer holds.
    effect(() => {
        if (state.value) return;
        endTravel();
        focused = false;
    });

    const position = createAnchorPosition({
        getAnchor: () => anchor,
        getFloating: () => popup,
        isOpen: () => state.value,
        placement: () => props.placement ?? 'bottom',
        offset: () => props.offset ?? 8,
        collisionPadding: () => props.collisionPadding,
        alignOffset: () => props.alignOffset,
        getArrow: () => arrow,
        arrowPadding: () => props.arrowPadding,
        strategy: props.positionStrategy,
    });

    // Escape closes the card wherever focus is (the pointer may be resting
    // on the trigger with focus elsewhere). An outside press does not: the
    // card closes because the pointer and focus left, never because the
    // user clicked something else.
    createDismissable({
        getElement: () => popup,
        isOpen: () => state.value,
        dismiss,
        outsidePress: false,
    });

    return () => <>{slots.default?.()}</>;
}, { name: 'HoverCard.Root' });

// ── Trigger ──

export type HoverCardTriggerProps =
    /** The destination the card previews. Also in the asChild bag. */
    & Define.Prop<'href', string, false>
    & WithClass
    & WithHtmlAttrs
    & WithVariantAxes<'hover-card'>
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const HoverCardTrigger = component<HoverCardTriggerProps>(({ props, slots, signal }) => {
    const card = useHoverCardContext();
    const focus = signal({ visible: false });

    const bag = (): PartProps => ({
        ...htmlAttrs(props),
        'data-scope': SCOPE,
        'data-part': 'trigger',
        ...variantAttrs(props),
        'data-state': stateAttr(card.state.value, 'open', 'closed'),
        'data-focus-visible': dataAttr(focus.visible),
        href: props.href,
        onPointerenter: (e: PointerEvent) => card.enter(e, 'trigger'),
        onPointerleave: (e: PointerEvent) => card.leave(e, 'trigger'),
        // Keyboard focus only: a click focuses the trigger too, and follows
        // the link — a card popping up over the navigation is noise.
        onFocus: (e: FocusEvent) => {
            focus.visible = isFocusVisible(e.currentTarget as Element);
            card.focusTrigger(focus.visible);
        },
        onBlur: (e: FocusEvent) => {
            focus.visible = false;
            card.blur(e.relatedTarget);
        },
        ref: (node: HTMLElement | null) => card.setAnchor(node),
    });

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <a href={props.href} class={props.class} {...b}>
                {slots.default?.(b)}
            </a>
        );
    };
}, { name: 'HoverCard.Trigger' });

// ── Popup ──

/** Not `id`: the popup's id is the component's. */
export type HoverCardPopupProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const HoverCardPopup = component<HoverCardPopupProps>(({ props, slots, onMounted }) => {
    const card = useHoverCardContext();
    let el: HTMLElement | null = null;
    // Outside Chromium the native close waits for the exit to play (#17).
    const exit = createTopLayerExit();

    const scoped = mountScope();
    onMounted(() => scoped(() => {
        const sync = (open: boolean) => {
            const node = el as (HTMLElement & { showPopover?(): void; hidePopover?(): void; matches(s: string): boolean }) | null;
            if (!node) return;
            // Closing with focus inside would drop it on <body>: hand it back
            // to the trigger first.
            if (!open && typeof document !== 'undefined' && node.contains(document.activeElement)) {
                card.restoreFocus();
            }
            if (typeof node.showPopover !== 'function') return;
            if (open) exit.cancel();
            const showing = node.matches(':popover-open');
            if (open && !showing) {
                // A popup mounted below another element can run before its
                // subtree is inserted; `showPopover()` on a detached element
                // throws (#102).
                if (!node.isConnected) {
                    queueMicrotask(() => { if (node.isConnected) sync(card.state.value); });
                    return;
                }
                node.showPopover();
            } else if (!open && showing) {
                exit.close(node, () => {
                    if (!card.state.value && node.matches(':popover-open')) node.hidePopover!();
                });
            }
        };
        effect(() => sync(card.state.value));
    }));

    return () => (
        <div
            {...htmlAttrs(props)}
            id={card.ids.popup}
            data-scope={SCOPE}
            data-part="popup"
            data-state={stateAttr(card.state.value, 'open', 'closed')}
            popover="manual"
            class={props.class}
            ref={(node: HTMLElement | null) => { el = node; card.setPopup(node); }}
            onPointerenter={(e: PointerEvent) => card.enter(e, 'popup')}
            onPointerleave={(e: PointerEvent) => card.leave(e, 'popup')}
            onFocusin={() => card.focusPopup()}
            onFocusout={(e: FocusEvent) => card.blur(e.relatedTarget)}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'HoverCard.Popup' });

// ── Arrow ──

/** The arrow is decoration: it renders `aria-hidden="true"` whatever the app passes. */
export type HoverCardArrowProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

/**
 * A mark on the popup edge facing the trigger, pointed at the trigger's
 * centre through `--arrow-x`/`--arrow-y` (see `Popover.Arrow`). Empty by
 * default — the recipe draws it; children (an SVG) replace the drawing.
 */
const HoverCardArrow = component<HoverCardArrowProps>(({ props, slots, onUnmounted }) => {
    const card = useHoverCardContext();
    let el: HTMLElement | null = null;
    onUnmounted(() => {
        if (el) card.setArrow(null);
    });
    return () => (
        <span
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="arrow"
            aria-hidden="true"
            class={props.class}
            ref={(node: HTMLElement | null) => { el = node; card.setArrow(node); }}
        >
            {slots.default?.()}
        </span>
    );
}, { name: 'HoverCard.Arrow' });

export const HoverCard = compound(HoverCardRoot, {
    Root: HoverCardRoot,
    Trigger: HoverCardTrigger,
    Popup: HoverCardPopup,
    Arrow: HoverCardArrow,
});
