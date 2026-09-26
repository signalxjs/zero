/**
 * Menu — a WAI-ARIA APG menu button on the `popover` attribute.
 *
 * ```tsx
 * <Menu.Root onSelect={(v) => act(v)}>
 *     <Menu.Trigger>Actions</Menu.Trigger>
 *     <Menu.Popup>
 *         <Menu.Item value="rename">Rename</Menu.Item>
 *         <Menu.Item value="duplicate">Duplicate</Menu.Item>
 *         <Menu.Separator />
 *         <Menu.Item value="delete">Delete…</Menu.Item>
 *     </Menu.Popup>
 * </Menu.Root>
 * ```
 *
 * Keyboard: ArrowDown/ArrowUp on the closed trigger open on the first/last
 * enabled item; inside, ArrowDown/Up move focus through enabled items,
 * Home/End jump, typeahead matches item text, Enter/Space activate (Enter on
 * an asChild `<a href>` item keeps its default, so the link navigates),
 * Escape closes (native popover) and focus returns to the trigger. Tab and
 * Shift+Tab close the whole chain (root and every open submenu) and let the
 * browser move focus onward — it is not pulled back to the trigger; focus
 * leaving the menu any other way (a pointer, an AT) closes it too. `loop`
 * (default true) wraps ArrowDown/ArrowUp at the ends, at every level.
 *
 * Stateful items follow the APG menu-button pattern's checkbox/radio roles:
 * ```tsx
 * <Menu.CheckboxItem value="statusbar" model={() => state.statusbar}>
 *     Status bar
 * </Menu.CheckboxItem>
 * <Menu.RadioGroup model={() => state.sortBy}>
 *     <Menu.GroupLabel>Sort by</Menu.GroupLabel>
 *     <Menu.RadioItem value="name">Name</Menu.RadioItem>
 *     <Menu.RadioItem value="date">Date</Menu.RadioItem>
 * </Menu.RadioGroup>
 * ```
 * Toggling either kind leaves the menu OPEN by default (`closeOnSelect` on
 * the item opts back into closing); both emit the root's `select` alongside
 * their own model events. Each renders an `item-indicator` part mirroring its
 * checked state for the design system's mark (asChild items render only the
 * consumer's element — bring your own mark there).
 *
 * Submenus nest the same parts:
 * ```tsx
 * <Menu.Sub>
 *     <Menu.SubTrigger>Share</Menu.SubTrigger>
 *     <Menu.SubPopup>
 *         <Menu.Item value="email">Email</Menu.Item>
 *     </Menu.SubPopup>
 * </Menu.Sub>
 * ```
 * `Menu.Sub` shadows the menu context for its subtree, so Item/Group/
 * Separator work unchanged at any depth and `select` bubbles to the root.
 * The nested `popover="auto"` is a DOM descendant of the parent popup, so
 * the platform provides the stacking model: opening a child keeps ancestors
 * open, Escape closes only the innermost, light dismiss closes the chain,
 * and opening a sibling submenu closes the other. Keyboard: ArrowRight (LTR)
 * / Enter / Space open and focus the first item, ArrowLeft closes back to
 * the sub-trigger. Hover opens/closes with intent delays and never moves
 * focus into the submenu. Once a submenu is open, a mouse leaving its
 * trigger toward it gets a safe triangle (#19): sibling items crossed on
 * the diagonal do not take hover while the pointer stays between the exit
 * point and the submenu's near edge. `closeDelay` still bounds it — a
 * pointer that lingers closes the submenu, and the item under it then
 * takes hover.
 *
 * `Menu.Shortcut` is the visible shortcut hint inside an item — decorative
 * (`aria-hidden`); the item's `keyshortcuts` prop renders
 * `aria-keyshortcuts`, which is what AT announces. Zero binds no keys.
 *
 * Inside a `Menubar.Root` the root's `value` names the menu, its open state
 * follows the bar's model and its Trigger becomes a roving `menuitem` of the
 * bar (see `Menubar`); outside one, `value` is unused.
 *
 * `Menu.Arrow`, rendered inside the root `Menu.Popup`, is pointed at the
 * trigger's centre by the position strategy (`--arrow-x`/`--arrow-y`).
 * Submenus take no arrow: an arrow inside a `Menu.SubPopup` renders but is
 * never positioned, and no recipe places it.
 */
import { component, compound, defineInjectable, defineProvide, effect, watch } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { createListController, type ListItem } from '../../behaviors/list.js';
import { createRovingKeydown } from '../../behaviors/roving.js';
import { createTypeahead } from '../../behaviors/typeahead.js';
import { createAnchorPosition, pointAnchor, type Placement, type PositionAnchor, type PositionStrategy } from '../../behaviors/position.js';
import { createFocusRestore } from '../../behaviors/focus.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { createPointerGrace, pointInTriangle, safeTriangle, type Point, type PointerGrace } from '../../behaviors/safe-triangle.js';
import { createTopLayerExit } from '../../behaviors/top-layer-exit.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithDisabled, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { menuAnatomy } from './anatomy.js';
import { mountScope } from '../../behaviors/mount-scope.js';
import { derivedModel } from '../../behaviors/derived-model.js';
import { inertMenubarContext, useMenubarContext, type MenubarContext } from '../menubar/context.js';

const SCOPE = menuAnatomy.scope;

interface MenuContext {
    state: ControllableState<boolean>;
    /**
     * The enclosing `Menubar.Root`'s context, or the inert fallback
     * (`bar.inert`) for a menu outside any bar. Captured by the root: the
     * root hides the bar from its own subtree, so a menu nested inside
     * never mistakes itself for a bar menu.
     */
    bar: MenubarContext;
    /** This menu's identity in its bar — the root's `value`, else a generated id. */
    value(): string;
    list: ReturnType<typeof createListController>;
    ids: { trigger: string; popup: string };
    /**
     * The popup is labelled by its trigger only while a Menu.Trigger is
     * actually rendered — a context-menu-only composition has no visible
     * trigger to name it, and a dangling aria-labelledby is worse than none.
     */
    triggerPresent(): boolean;
    setTriggerPresent(present: boolean): void;
    /** The rendered Menu.Trigger — focus landing on it does not close the menu. */
    setTriggerEl(el: HTMLElement | null): void;
    /**
     * Tab/Shift+Tab: close this level and every ancestor, leaving focus
     * where the browser's own Tab puts it (APG menu button).
     */
    closeChain(): void;
    /** Whether ArrowDown/ArrowUp wrap at the ends — the root's `loop`, at every level. */
    loop(): boolean;
    keydown(e: KeyboardEvent, value: string): void;
    /** A typeahead search is running in this list — Space continues it instead of activating. */
    searching(): boolean;
    /**
     * Which end of the list the NEXT open focuses — `'last'` only after an
     * ArrowUp open from the trigger (APG). One-shot: the popup consumes it.
     */
    takeOpenFocus(): 'first' | 'last';
    setOpenFocus(end: 'first' | 'last'): void;
    /**
     * Emit `select` and close per the root's `closeOnSelect` — unless the
     * activating item overrides the close decision (`closeOverride`): a
     * checkbox/radio item stays open by default so the user can set several
     * options in one visit (the Radix behavior).
     */
    select(value: string, closeOverride?: boolean): void;
    setAnchor(anchor: PositionAnchor | null): void;
    /**
     * Open anchored at client coordinates (a context menu). While already
     * open, repositions in place — a second right-click must not flicker
     * through close/reopen.
     */
    openAt(x: number, y: number): void;
    setPopup(el: HTMLElement | null): void;
    /**
     * The rendered `Menu.Arrow`, which the position strategy points at the
     * anchor. The root popup's only — a submenu level ignores it.
     */
    setArrow(el: HTMLElement | null): void;
    /**
     * This level's safe-triangle hover grace (#19): an open child submenu
     * starts it, the level's items consult it before taking hover.
     */
    grace: PointerGrace;
}

const pointOf = (e: PointerEvent): Point => ({ x: e.clientX, y: e.clientY });

/**
 * Hover for an item of a level whose child submenu may hold a safe
 * triangle: held while the pointer is inside it, taken on the first move
 * outside it (or replayed by the submenu when its close delay runs out).
 */
function graceHover(grace: PointerGrace, hover: () => void) {
    const take = (e: PointerEvent): void => {
        if (grace.holds(pointOf(e), hover)) return;
        grace.release();
        hover();
    };
    return {
        enter: take,
        // Only a held item listens to moves — without a grace, hover stays
        // enter-only, exactly as before.
        move: (e: PointerEvent): void => { if (grace.isHeld(hover)) take(e); },
        leave: (): void => grace.release(hover),
    };
}

function makeInert(): MenuContext {
    return {
        state: createInertState<boolean>(false),
        bar: inertMenubarContext(),
        value: () => '',
        list: createListController(),
        ids: { trigger: 'zx-menu-inert-trigger', popup: 'zx-menu-inert' },
        triggerPresent: () => false,
        setTriggerPresent: () => {},
        setTriggerEl: () => {},
        closeChain: () => {},
        loop: () => true,
        keydown: () => {},
        searching: () => false,
        takeOpenFocus: () => 'first',
        setOpenFocus: () => {},
        select: () => {},
        setAnchor: () => {},
        openAt: () => {},
        setPopup: () => {},
        setArrow: () => {},
        grace: createPointerGrace(),
    };
}

export const useMenuContext = defineInjectable<MenuContext>(() => makeInert());

// ── Root ──

export type MenuRootProps =
    /**
     * Identity inside a `Menubar.Root`: the bar's `value` names the open
     * menu by it. Defaults to a generated id; outside a bar it is unused.
     */
    & Define.Prop<'value', string, false>
    & Define.Model<boolean>
    & Define.Prop<'defaultOpen', boolean, false>
    & Define.Event<'openChange', boolean>
    & Define.Event<'select', string>
    & Define.Prop<'closeOnSelect', boolean, false>
    /** ArrowDown/ArrowUp wrap from the last item to the first and back — default true, at every level. */
    & Define.Prop<'loop', boolean, false>
    & Define.Prop<'placement', Placement, false>
    & Define.Prop<'offset', number, false>
    /** Margin, px, the popup keeps from the viewport edges when flipping and shifting (default 8). */
    & Define.Prop<'collisionPadding', number, false>
    /** Cross-axis offset, px, from a `-start`/`-end` alignment (default 0). */
    & Define.Prop<'alignOffset', number, false>
    /** Minimum distance, px, between a `Menu.Arrow` and the popup's corners (default 8). */
    & Define.Prop<'arrowPadding', number, false>
    & Define.Prop<'positionStrategy', PositionStrategy, false>
    & Define.Slot<'default'>;

const MenuRoot = component<MenuRootProps>(({ props, slots, emit, signal, onUnmounted }) => {
    const bar = useMenubarContext();
    const inBar = !bar.inert;
    const baseId = createId('zx-menu');
    const value = (): string => props.value ?? baseId;
    const own = createControllableState<boolean>(
        () => props.model,
        props.defaultOpen ?? false,
        (v) => emit('openChange', v),
    );
    // Inside a bar the bar's `value` is the one source of truth: this menu
    // is open while the bar names it. Opening names it; closing clears the
    // bar only while it still names THIS menu — a switch to a sibling has
    // already moved it on.
    const state: ControllableState<boolean> = inBar
        ? derivedModel<boolean>(
            () => bar.state.value === value(),
            (open) => {
                if (open) bar.state.value = value();
                else if (bar.state.value === value()) bar.state.value = '';
            },
        )
        : own;
    if (inBar) watch(() => state.value, (open) => emit('openChange', open));
    // A Menu.Root nested inside this one is not a bar menu.
    defineProvide(useMenubarContext, () => inertMenubarContext());
    const list = createListController();
    // Written from Trigger one microtask after its setup — a write made
    // during the render pass is invisible to the already-rendered popup.
    const present = signal({ trigger: false });
    let anchor: PositionAnchor | null = null;
    let popup: HTMLElement | null = null;
    let arrow: HTMLElement | null = null;
    let triggerEl: HTMLElement | null = null;
    let openFocus: 'first' | 'last' = 'first';
    // A close that must not hand focus back: focus already went (or is
    // going) where the user sent it. Re-armed on every open.
    let skipRestore = false;
    let tabClose: ReturnType<typeof setTimeout> | null = null;
    const loop = (): boolean => props.loop ?? true;

    const closeWithoutRestore = (): void => {
        if (!state.value) return;
        skipRestore = true;
        state.value = false;
        // A controlled owner that keeps it open must not leave the flag
        // armed for some later, ordinary close.
        if (state.value) skipRestore = false;
    };

    const roving = createRovingKeydown({
        list,
        orientation: () => 'vertical',
        loop,
        onMove: () => {},
    });
    const typeahead = createTypeahead({
        list,
        onMatch: (item: ListItem) => item.el()?.focus(),
    });

    const pos = createAnchorPosition({
        getAnchor: () => anchor,
        getFloating: () => popup,
        isOpen: () => state.value,
        placement: () => props.placement ?? 'bottom-start',
        offset: () => props.offset ?? 4,
        collisionPadding: () => props.collisionPadding,
        alignOffset: () => props.alignOffset,
        getArrow: () => arrow,
        arrowPadding: () => props.arrowPadding,
        strategy: props.positionStrategy,
    });

    const ctx: MenuContext = {
        state,
        bar,
        value,
        list,
        ids: { trigger: `${baseId}-trigger`, popup: `${baseId}-popup` },
        triggerPresent: () => present.trigger,
        setTriggerPresent: (p) => { present.trigger = p; },
        setTriggerEl: (el) => { triggerEl = el; },
        closeChain() {
            // Not now: closing inside the keydown hides the popover while it
            // still holds focus, and the native hide hands focus back to the
            // opener before Tab's default action runs — Tab would then move
            // on from the trigger, and Shift+Tab would skip it. Unprevented,
            // Tab moves focus first; the close follows a task later (and a
            // focusin outside the menu may already have made it).
            if (tabClose != null) clearTimeout(tabClose);
            tabClose = setTimeout(() => {
                tabClose = null;
                closeWithoutRestore();
            }, 0);
        },
        loop,
        keydown(e, item) {
            if (e.key === 'Tab') {
                ctx.closeChain();
                return;
            }
            if (inBar && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                // A submenu level forwards its inline-end arrow here (and a
                // sub-trigger its inline-start one): across a horizontal bar
                // it steps to the adjacent menu; down a vertical one the
                // inline-start arrow closes back to the trigger.
                const forward = e.key === (bar.rtl() ? 'ArrowLeft' : 'ArrowRight');
                if (bar.orientation() === 'horizontal') {
                    e.preventDefault();
                    bar.step(value(), forward ? 1 : -1);
                    return;
                }
                if (!forward) {
                    e.preventDefault();
                    state.value = false;
                    return;
                }
            }
            roving(e, item);
            if (!e.defaultPrevented) typeahead(e, item);
        },
        searching: () => typeahead.searching(),
        takeOpenFocus() {
            const end = openFocus;
            openFocus = 'first';
            return end;
        },
        setOpenFocus: (end) => { openFocus = end; },
        select(value, closeOverride) {
            emit('select', value);
            if (closeOverride ?? (props.closeOnSelect ?? true)) state.value = false;
        },
        setAnchor: (a) => { anchor = a; },
        openAt(x, y) {
            anchor = pointAnchor(x, y);
            if (state.value) pos.update();
            else state.value = true;
        },
        setPopup: (el) => { popup = el; },
        // An arrow mounted while the menu is open (conditional render) is
        // placed a microtask later, once it is in the document — not at the
        // next scroll or resize: the strategy otherwise runs only on
        // open/close and its own listeners.
        setArrow: (el) => {
            if (arrow === el) return;
            arrow = el;
            queueMicrotask(() => pos.update());
        },
        grace: createPointerGrace(),
    };
    defineProvide(useMenuContext, () => ctx);

    // Focus goes back only while it is still the popup's: an outside
    // pointerdown on an input, or a Tab out, keeps it where it went (#262).
    createFocusRestore(() => state.value, {
        getSurface: () => popup,
        fallback: () => (anchor instanceof HTMLElement ? anchor : null),
        // A bar menu restores on its own terms, below.
        skip: () => skipRestore || inBar,
    });

    // In a bar, focus goes back to THIS menu's trigger — never to what was
    // focused when it opened, which after a switch is an item of the
    // sibling menu, now hidden — and only when the bar closed outright
    // (Escape, a selection): a switch hands focus to the next menu itself.
    if (inBar && typeof document !== 'undefined') {
        watch(
            () => state.value,
            (open, wasOpen) => {
                if (open || !wasOpen || skipRestore || bar.state.value !== '') return;
                // Ours to move: on nothing, inside the popup — or on a sibling
                // trigger, where the platform's own hide put it (a switch
                // hides the previous menu first, so THIS popover recorded
                // that menu's trigger as the element to hand focus back to).
                const active = document.activeElement;
                const onBar = bar.list.items().some((i) => i.el() === active);
                if (active && active !== document.body && !popup?.contains(active) && !onBar) return;
                triggerEl?.focus();
            },
        );
    }

    // Focus leaving the menu tree — to anything but the trigger, whose own
    // click toggles — closes the whole chain. Submenu popups are DOM
    // descendants of the root popup, so one `contains` covers every level.
    watch(
        () => state.value,
        (open, _prev, onCleanup) => {
            if (!open) return;
            skipRestore = false;
            if (typeof document === 'undefined') return;
            const onFocusin = (e: FocusEvent): void => {
                const target = e.target as Node | null;
                if (!target || !popup) return;
                if (popup.contains(target) || triggerEl?.contains(target)) return;
                // Focus on another trigger of the same bar is the bar's
                // business: a switch, or a pointer on its way to a click.
                if (inBar && bar.list.items().some((i) => i.el()?.contains(target))) return;
                closeWithoutRestore();
            };
            document.addEventListener('focusin', onFocusin);
            onCleanup(() => document.removeEventListener('focusin', onFocusin));
        },
        { immediate: true },
    );

    onUnmounted(() => {
        if (tabClose != null) clearTimeout(tabClose);
    });

    return () => <>{slots.default?.()}</>;
}, { name: 'Menu.Root' });

// ── Trigger ──

export type MenuTriggerProps =
    & WithDisabled
    & WithClass
    /** Not `id`: the popup is labelled by the Trigger's own. */
    & Omit<WithHtmlAttrs, 'id'>
    & WithVariantAxes<'menu'>
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const MenuTrigger = component<MenuTriggerProps>(({ props, slots, signal, onMounted, onUnmounted }) => {
    const menu = useMenuContext();
    const bar = menu.bar;
    const inBar = !bar.inert;
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const disabled = (): boolean => !!props.disabled || bar.disabled();
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: disabled,
    });
    // Deferred past the render pass — see the note on `present` in Root.
    let alive = true;
    queueMicrotask(() => { if (alive) menu.setTriggerPresent(true); });
    onUnmounted(() => {
        alive = false;
        menu.setTriggerPresent(false);
    });

    // In a bar the trigger is a `menuitem` of the bar's roving row.
    if (inBar) {
        const item: ListItem = {
            id: `menubar-trigger-${menu.ids.trigger}`,
            get value() { return menu.value(); },
            disabled,
            el: () => el,
            textValue: () => el?.textContent?.trim() ?? menu.value(),
        };
        const unregister = bar.list.register(item);
        onMounted(() => bar.tabStop.changed());
        onUnmounted(() => {
            unregister();
            bar.tabStop.changed();
        });
    }
    const isTabStop = (): boolean => {
        const last = bar.focused();
        return bar.tabStop.isTabStop(menu.value(), last !== '' ? [last] : []);
    };

    const open = (end: 'first' | 'last'): void => {
        menu.setAnchor(el);
        if (menu.state.value) {
            // Already open (focus came back to the trigger): just go in.
            const items = menu.list.enabledItems();
            items[end === 'last' ? items.length - 1 : 0]?.el()?.focus();
            return;
        }
        menu.setOpenFocus(end);
        menu.state.value = true;
    };

    // A bar trigger's click follows the pointer's story, not a blind toggle:
    // a menu open BEFORE the pointer came (a click on its own open trigger)
    // closes, while one the pointer's hover just switched to stays open —
    // the popover's light dismiss may already have closed either by the
    // time `click` fires, so the decision is taken at pointerdown.
    let hoverOpened = false;
    let pointerGesture = false;
    let closeOnClick = false;

    const bag = (): PartProps => ({
        ...htmlAttrs(props),
        id: menu.ids.trigger,
        'data-scope': SCOPE,
        'data-part': 'trigger',
        ...variantAttrs(props),
        'data-state': stateAttr(menu.state.value, 'open', 'closed'),
        'data-disabled': dataAttr(disabled()),
        'data-focus-visible': dataAttr(focus.visible),
        role: inBar ? 'menuitem' : undefined,
        tabIndex: inBar ? (isTabStop() ? 0 : -1) : undefined,
        'aria-haspopup': 'menu',
        'aria-expanded': menu.state.value ? 'true' : 'false',
        'aria-controls': menu.ids.popup,
        onClick: () => {
            const pointer = pointerGesture;
            const close = closeOnClick;
            pointerGesture = closeOnClick = false;
            if (disabled()) return;
            // Re-claim the anchor on every open: a context-trigger open may
            // have moved it to a point — last opener wins.
            menu.setAnchor(el);
            if (inBar && pointer) {
                const open = !close;
                menu.state.value = open;
                // The popover's light dismiss answers the same gesture: it
                // hides a menu the press landed outside of (this trigger is
                // outside its own popup) and reports it in a `toggle` task
                // that lands AFTER this click. Restate the decision once
                // that report is in, or a menu meant to stay open would
                // close under the pointer.
                if (open) setTimeout(() => { if (!disabled() && el?.isConnected) menu.state.value = true; }, 0);
                return;
            }
            menu.state.value = !menu.state.value;
        },
        onKeydown: (e: KeyboardEvent) => {
            press.onKeydown(e);
            if (disabled()) return;
            if (inBar) {
                // Horizontal bar: ArrowDown/ArrowUp open on the first/last
                // item. Vertical: the inline-end arrow opens, Up/Down rove.
                const vertical = bar.orientation() === 'vertical';
                if (!vertical && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                    e.preventDefault();
                    open(e.key === 'ArrowUp' ? 'last' : 'first');
                    return;
                }
                if (vertical && e.key === (bar.rtl() ? 'ArrowLeft' : 'ArrowRight')) {
                    e.preventDefault();
                    open('first');
                    return;
                }
                bar.keydown(e, menu.value());
                return;
            }
            // ArrowDown on a closed trigger opens the menu on its first
            // item, ArrowUp on its last (APG menu button).
            if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !menu.state.value) {
                e.preventDefault();
                open(e.key === 'ArrowUp' ? 'last' : 'first');
            }
        },
        onKeyup: press.onKeyup,
        onFocus: () => {
            focus.visible = isFocusVisible(el);
            if (inBar) bar.setFocused(menu.value());
        },
        onBlur: (e: FocusEvent) => {
            press.onBlur(e);
            focus.visible = false;
        },
        onPointerenter: () => {
            // While any menu of the bar is open, hovering another trigger
            // switches to its menu.
            if (!inBar || disabled() || bar.state.value === '' || menu.state.value) return;
            hoverOpened = true;
            open('first');
        },
        onPointerdown: (e: PointerEvent) => {
            pointerGesture = true;
            closeOnClick = menu.state.value && !hoverOpened;
            hoverOpened = false;
            press.onPointerdown(e);
        },
        onPointerup: press.onPointerup,
        onPointercancel: press.onPointercancel,
        onPointerleave: (e: PointerEvent) => {
            hoverOpened = false;
            press.onPointerleave(e);
        },
        ref: (node: HTMLElement | null) => { el = node; menu.setAnchor(node); menu.setTriggerEl(node); },
    });

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <button type="button" class={props.class} {...b} disabled={disabled()}>
                {slots.default?.(b)}
            </button>
        );
    };
}, { name: 'Menu.Trigger' });

// ── ContextTrigger ──

export type MenuContextTriggerProps =
    & WithDisabled
    & WithClass
    & WithHtmlAttrs
    & WithAsChild
    & Define.Slot<'default', PartProps>;

/**
 * The right-click surface. Wrap any content: `contextmenu` (right-click,
 * long-press on Android) opens the menu at the pointer, Shift+F10 / the
 * ContextMenu key open it anchored to the surface's rect (APG — the
 * keyboard has no pointer position). iOS has no native `contextmenu`
 * event; pair with `-webkit-touch-callout: none` and a long-press
 * recognizer of your own until zero grows one.
 */
const MenuContextTrigger = component<MenuContextTriggerProps>(({ props, slots, signal }) => {
    const menu = useMenuContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });

    const bag = (): PartProps => ({
        ...htmlAttrs(props),
        'data-scope': SCOPE,
        'data-part': 'context-trigger',
        'data-state': stateAttr(menu.state.value, 'open', 'closed'),
        'data-disabled': dataAttr(props.disabled),
        'data-focus-visible': dataAttr(focus.visible),
        // aria-haspopup and aria-controls are ARIA *globals*, valid on this
        // role-less wrapper (`generic`) — but aria-expanded is not: it is a
        // widget state, and stating it on `generic` is invalid ARIA (axe:
        // critical, #326). The open/closed fact stays on `data-state`.
        'aria-haspopup': 'menu',
        'aria-controls': menu.ids.popup,
        ref: (node: HTMLElement | null) => { el = node; },
        onContextmenu: (e: MouseEvent) => {
            if (props.disabled) return;
            e.preventDefault();
            const { clientX, clientY } = e;
            // Never open inside the right-click gesture: the popup is an
            // auto popover, and the gesture's own pointerup light-dismisses
            // a popover it didn't press inside — racily, at millisecond
            // granularity. When contextmenu fires with the button still
            // down (macOS convention), wait for the release; either way,
            // open a task later so the gesture's input processing is fully
            // done before showPopover().
            const openDeferred = (): void => {
                setTimeout(() => {
                    // The world may have moved during the deferral: a
                    // disabled or unmounted surface no longer opens.
                    if (props.disabled || !el?.isConnected) return;
                    menu.openAt(clientX, clientY);
                }, 0);
            };
            if (e.buttons !== 0) {
                // Paired teardown: a canceled gesture (or one that never
                // completes) must not leave a listener alive to open the
                // menu at stale coordinates on some later pointerup.
                const detach = (): void => {
                    window.removeEventListener('pointerup', onUp, true);
                    window.removeEventListener('pointercancel', onCancel, true);
                    window.removeEventListener('blur', onCancel);
                };
                const onUp = (): void => {
                    detach();
                    openDeferred();
                };
                const onCancel = (): void => detach();
                window.addEventListener('pointerup', onUp, { capture: true });
                window.addEventListener('pointercancel', onCancel, { capture: true });
                window.addEventListener('blur', onCancel);
            } else {
                openDeferred();
            }
        },
        onKeydown: (e: KeyboardEvent) => {
            if (props.disabled) return;
            // Bubbles from any focused descendant — the surface itself needs
            // no tab stop of its own.
            if ((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu') {
                e.preventDefault();
                if (!el) return;
                menu.setAnchor(el);
                menu.state.value = true;
            }
        },
        // `focus`/`blur` don't bubble, so this reports the SURFACE's own
        // focus — never a descendant's, which carries its own ring. The
        // surface is a tab stop only when the consumer makes it one, and
        // that is exactly when a design system may want to paint it: Escape
        // from an open context menu restores focus here.
        onFocus: () => { focus.visible = isFocusVisible(el); },
        onBlur: () => { focus.visible = false; },
    });

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <div class={props.class} {...b}>
                {slots.default?.(b)}
            </div>
        );
    };
}, { name: 'Menu.ContextTrigger' });

// ── Popup ──

export type MenuPopupProps =
    & WithClass
    /** Not `id`/`role`: the Trigger points at the popup, which is the `menu`. */
    & Omit<WithHtmlAttrs, 'id' | 'role'>
    & Define.Slot<'default'>;

const MenuPopup = component<MenuPopupProps>(({ props, slots, onMounted }) => {
    const menu = useMenuContext();
    let el: HTMLElement | null = null;
    // Outside Chromium the native close waits for the exit to play (#17).
    const exit = createTopLayerExit();
    let wasOpen = false;

    const scoped = mountScope();
    onMounted(() => scoped(() => {
        effect(() => {
            const open = menu.state.value;
            const node = el as (HTMLElement & { showPopover?(): void; hidePopover?(): void; matches(s: string): boolean }) | null;
            if (!node || typeof node.showPopover !== 'function') return;
            if (open) exit.cancel();
            const showing = node.matches(':popover-open');
            const opening = open && !wasOpen;
            wasOpen = open;
            if (open && !showing) node.showPopover();
            if (opening) {
                // Focus lands on the first enabled item — the last after an
                // ArrowUp open (APG menu button). Keyed to the closed → open
                // transition, not to showing the popover: outside Chromium a
                // reopen mid-exit finds it still :popover-open, and it must
                // both move focus and spend the one-shot hint, or a stale
                // 'last' would leak into the next, unrelated open.
                const end = menu.takeOpenFocus();
                const items = menu.list.enabledItems();
                items[end === 'last' ? items.length - 1 : 0]?.el()?.focus();
            } else if (!open && showing) {
                exit.close(node, () => {
                    if (!menu.state.value && node.matches(':popover-open')) node.hidePopover!();
                });
            }
        });
    }));

    return () => {
        const attrs = htmlAttrs(props);
        return (
            <div
                {...attrs}
                id={menu.ids.popup}
                data-scope={SCOPE}
                data-part="popup"
                data-state={stateAttr(menu.state.value, 'open', 'closed')}
                popover="auto"
                role="menu"
                // An app's own references join the Trigger's.
                aria-labelledby={[
                    menu.triggerPresent() ? menu.ids.trigger : undefined,
                    attrs['aria-labelledby'],
                ].filter(Boolean).join(' ') || undefined}
                class={props.class}
                ref={(node: HTMLElement | null) => { el = node; menu.setPopup(node); }}
                onToggle={(e: Event) => {
                    const open = (e as ToggleEvent).newState === 'open';
                    if (menu.state.value !== open) menu.state.value = open;
                }}
            >
                {slots.default?.()}
            </div>
        );
    };
}, { name: 'Menu.Popup' });

// ── Item core ──

/** The slice of the component setup context the item core needs. */
interface ItemHooks {
    signal<T extends object>(v: T): T;
    onUnmounted(fn: () => void): void;
}

interface ItemCoreOpts {
    value(): string;
    textValue(): string | undefined;
    disabled(): boolean;
    activate(): void;
}

/**
 * The shared item skeleton: registration in the enclosing menu's list (roving
 * + typeahead), press feedback, highlight tracking, and the APG activation
 * keys. Item, CheckboxItem and RadioItem differ only in role, checked
 * semantics and what activation does — everything else must stay identical,
 * so it lives here once.
 */
function useMenuItemCore({ signal, onUnmounted }: ItemHooks, opts: ItemCoreOpts) {
    const menu = useMenuContext();
    let el: HTMLElement | null = null;
    const focus = signal({ highlighted: false });
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => opts.disabled(),
    });

    const item: ListItem = {
        id: `item-${opts.value()}`,
        get value() { return opts.value(); },
        disabled: () => opts.disabled(),
        el: () => el,
        textValue: () => opts.textValue() ?? el?.textContent?.trim() ?? opts.value(),
    };
    const unregister = menu.list.register(item);
    onUnmounted(() => unregister());

    const activate = (): void => {
        if (!opts.disabled()) opts.activate();
    };
    const hover = graceHover(menu.grace, () => el?.focus());

    /** The behavior half of the part bag; the caller adds identity + ARIA. */
    const handlers = (): Omit<PartProps, 'data-scope' | 'data-part'> => ({
        'data-disabled': dataAttr(opts.disabled()),
        'data-highlighted': dataAttr(focus.highlighted),
        tabIndex: -1,
        'aria-disabled': opts.disabled() ? 'true' : undefined,
        onClick: () => activate(),
        onKeydown: (e: KeyboardEvent) => {
            // A Space that continues a search is search text, not a press.
            const searchSpace = e.key === ' ' && menu.searching();
            if (!searchSpace) press.onKeydown(e);
            if (e.key === 'Enter' || (e.key === ' ' && !searchSpace)) {
                // An enabled link item (asChild `<a href>`) keeps Enter's
                // default: the browser turns it into the link's own click,
                // which navigates AND activates through onClick — preventing
                // it would select without navigating (#175).
                if (e.key === 'Enter' && !opts.disabled() && el?.matches('a[href], area[href]')) return;
                e.preventDefault();
                activate();
                return;
            }
            menu.keydown(e, opts.value());
        },
        onKeyup: press.onKeyup,
        onPointerenter: hover.enter,
        onPointermove: hover.move,
        onPointerdown: press.onPointerdown,
        onPointerup: press.onPointerup,
        onPointercancel: press.onPointercancel,
        onPointerleave: (e: PointerEvent) => {
            press.onPointerleave(e);
            hover.leave();
        },
        onFocus: () => { focus.highlighted = true; },
        onBlur: (e: FocusEvent) => {
            press.onBlur(e);
            focus.highlighted = false;
        },
        ref: (node: HTMLElement | null) => { el = node; },
    });

    return { menu, handlers };
}

// ── Item ──

export type MenuItemProps =
    & Define.Prop<'value', string, true>
    & Define.Prop<'textValue', string, false>
    /**
     * The keyboard shortcut the app binds for this item, in
     * `aria-keyshortcuts` syntax (`"Control+S"`). Announced only — zero binds
     * no keys; pair it with a visible `Menu.Shortcut`.
     */
    & Define.Prop<'keyshortcuts', string, false>
    & WithDisabled
    & WithClass
    /** Not `role`: the item's role is its menu semantics. */
    & Omit<WithHtmlAttrs, 'role'>
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const MenuItem = component<MenuItemProps>(({ props, slots, signal, onUnmounted }) => {
    const core = useMenuItemCore({ signal, onUnmounted }, {
        value: () => props.value,
        textValue: () => props.textValue,
        disabled: () => !!props.disabled,
        activate: () => core.menu.select(props.value),
    });

    const bag = (): PartProps => ({
        ...htmlAttrs(props),
        ...core.handlers(),
        'data-scope': SCOPE,
        'data-part': 'item',
        'aria-keyshortcuts': props.keyshortcuts,
        role: 'menuitem',
    });

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <div class={props.class} {...b}>
                {slots.default?.(b)}
            </div>
        );
    };
}, { name: 'Menu.Item' });

// ── CheckboxItem ──

export type MenuCheckboxItemProps =
    & Define.Prop<'value', string, true>
    & Define.Model<boolean>
    & Define.Prop<'defaultChecked', boolean, false>
    & Define.Event<'checkedChange', boolean>
    /** Close the menu when this item toggles — default FALSE (unlike plain items). */
    & Define.Prop<'closeOnSelect', boolean, false>
    & Define.Prop<'textValue', string, false>
    /**
     * The keyboard shortcut the app binds for this item, in
     * `aria-keyshortcuts` syntax (`"Control+S"`). Announced only — zero binds
     * no keys; pair it with a visible `Menu.Shortcut`.
     */
    & Define.Prop<'keyshortcuts', string, false>
    & WithDisabled
    & WithClass
    /** Not `role`: the item's role is its menu semantics. */
    & Omit<WithHtmlAttrs, 'role'>
    & WithAsChild
    & Define.Slot<'default', PartProps>;

/**
 * APG `menuitemcheckbox` — a per-item boolean model. Activation toggles,
 * emits the root's `select`, and leaves the menu OPEN by default so several
 * options can be set in one visit; `closeOnSelect` opts back into closing.
 */
const MenuCheckboxItem = component<MenuCheckboxItemProps>(({ props, slots, emit, signal, onUnmounted }) => {
    const checked = createControllableState<boolean>(
        () => props.model,
        props.defaultChecked ?? false,
        (v) => emit('checkedChange', v),
    );
    const core = useMenuItemCore({ signal, onUnmounted }, {
        value: () => props.value,
        textValue: () => props.textValue,
        disabled: () => !!props.disabled,
        activate: () => {
            checked.value = !checked.value;
            core.menu.select(props.value, props.closeOnSelect ?? false);
        },
    });

    const bag = (): PartProps => ({
        ...htmlAttrs(props),
        ...core.handlers(),
        'data-scope': SCOPE,
        'data-part': 'checkbox-item',
        'aria-keyshortcuts': props.keyshortcuts,
        'data-state': stateAttr(checked.value, 'checked', 'unchecked'),
        role: 'menuitemcheckbox',
        'aria-checked': checked.value ? 'true' : 'false',
    });

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <div class={props.class} {...b}>
                <span
                    data-scope={SCOPE}
                    data-part="item-indicator"
                    data-state={stateAttr(checked.value, 'checked', 'unchecked')}
                    aria-hidden="true"
                />
                {slots.default?.(b)}
            </div>
        );
    };
}, { name: 'Menu.CheckboxItem' });

// ── RadioGroup / RadioItem ──

interface MenuRadioGroupContext {
    state: ControllableState<string>;
}

function makeInertRadioGroup(): MenuRadioGroupContext {
    return {
        state: createInertState<string>(''),
    };
}

export const useMenuRadioGroupContext = defineInjectable<MenuRadioGroupContext>(() => makeInertRadioGroup());

export type MenuRadioGroupProps =
    & Define.Model<string>
    & Define.Prop<'defaultValue', string, false>
    & Define.Event<'valueChange', string>
    & WithClass
    /** Not `role`: it renders the `group` part (see Menu.Group). */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Slot<'default'>;

/**
 * One string model over a set of `Menu.RadioItem`s. Renders the same labelled
 * `group` part `Menu.Group` does (a radio set IS a group — `Menu.GroupLabel`
 * works inside unchanged); the model context is the only addition.
 */
const MenuRadioGroup = component<MenuRadioGroupProps>(({ props, slots, emit }) => {
    const state = createControllableState<string>(
        () => props.model,
        props.defaultValue ?? '',
        (v) => emit('valueChange', v),
    );
    defineProvide(useMenuRadioGroupContext, () => ({ state }));
    return () => <MenuGroup {...htmlAttrs(props)} class={props.class}>{slots.default?.()}</MenuGroup>;
}, { name: 'Menu.RadioGroup' });

export type MenuRadioItemProps =
    & Define.Prop<'value', string, true>
    /** Close the menu when this item is chosen — default FALSE, like CheckboxItem. */
    & Define.Prop<'closeOnSelect', boolean, false>
    & Define.Prop<'textValue', string, false>
    /**
     * The keyboard shortcut the app binds for this item, in
     * `aria-keyshortcuts` syntax (`"Control+S"`). Announced only — zero binds
     * no keys; pair it with a visible `Menu.Shortcut`.
     */
    & Define.Prop<'keyshortcuts', string, false>
    & WithDisabled
    & WithClass
    /** Not `role`: the item's role is its menu semantics. */
    & Omit<WithHtmlAttrs, 'role'>
    & WithAsChild
    & Define.Slot<'default', PartProps>;

/** APG `menuitemradio` — checked when the enclosing RadioGroup's model matches. */
const MenuRadioItem = component<MenuRadioItemProps>(({ props, slots, signal, onUnmounted }) => {
    const group = useMenuRadioGroupContext();
    const isChecked = (): boolean => group.state.value === props.value;
    const core = useMenuItemCore({ signal, onUnmounted }, {
        value: () => props.value,
        textValue: () => props.textValue,
        disabled: () => !!props.disabled,
        activate: () => {
            group.state.value = props.value;
            core.menu.select(props.value, props.closeOnSelect ?? false);
        },
    });

    const bag = (): PartProps => ({
        ...htmlAttrs(props),
        ...core.handlers(),
        'data-scope': SCOPE,
        'data-part': 'radio-item',
        'aria-keyshortcuts': props.keyshortcuts,
        'data-state': stateAttr(isChecked(), 'checked', 'unchecked'),
        role: 'menuitemradio',
        'aria-checked': isChecked() ? 'true' : 'false',
    });

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <div class={props.class} {...b}>
                <span
                    data-scope={SCOPE}
                    data-part="item-indicator"
                    data-state={stateAttr(isChecked(), 'checked', 'unchecked')}
                    aria-hidden="true"
                />
                {slots.default?.(b)}
            </div>
        );
    };
}, { name: 'Menu.RadioItem' });

// ── Sub ──

interface MenuSubContext {
    parent: MenuContext;
    state: ControllableState<boolean>;
    ids: { trigger: string; popup: string };
    /** Open; when `focusFirst`, focus moves to the first enabled sub item once the popover shows. */
    open(focusFirst: boolean): void;
    /** Close; when `refocusTrigger`, focus returns to the sub-trigger (keyboard paths). */
    close(refocusTrigger: boolean): void;
    scheduleOpen(): void;
    scheduleClose(): void;
    cancelTimers(): void;
    /** A mouse left the sub-trigger at `e`: start the safe triangle toward the open popup. */
    startGrace(e: PointerEvent): void;
    /** The pointer reached the popup or came back to the trigger: the triangle is spent. */
    endGrace(): void;
    consumePendingFocus(): boolean;
    isRtl(): boolean;
    setSubTrigger(el: HTMLElement | null): void;
    subTrigger(): HTMLElement | null;
    setSubPopup(el: HTMLElement | null): void;
}

function makeInertSub(): MenuSubContext {
    return {
        parent: makeInert(),
        state: createInertState<boolean>(false),
        ids: { trigger: 'zx-menu-sub-inert-trigger', popup: 'zx-menu-sub-inert-popup' },
        open: () => {},
        close: () => {},
        scheduleOpen: () => {},
        scheduleClose: () => {},
        cancelTimers: () => {},
        startGrace: () => {},
        endGrace: () => {},
        consumePendingFocus: () => false,
        isRtl: () => false,
        setSubTrigger: () => {},
        subTrigger: () => null,
        setSubPopup: () => {},
    };
}

export const useMenuSubContext = defineInjectable<MenuSubContext>(() => makeInertSub());

export type MenuSubProps =
    & Define.Model<boolean>
    & Define.Prop<'defaultOpen', boolean, false>
    & Define.Event<'openChange', boolean>
    & Define.Prop<'placement', Placement, false>
    & Define.Prop<'offset', number, false>
    /** Margin, px, the popup keeps from the viewport edges when flipping and shifting (default 8). */
    & Define.Prop<'collisionPadding', number, false>
    /** Cross-axis offset, px, from a `-start`/`-end` alignment (default 0). */
    & Define.Prop<'alignOffset', number, false>
    & Define.Prop<'positionStrategy', PositionStrategy, false>
    /** Hover-intent delays in ms; openDelay 100, closeDelay 300. */
    & Define.Prop<'openDelay', number, false>
    & Define.Prop<'closeDelay', number, false>
    & Define.Slot<'default'>;

const MenuSub = component<MenuSubProps>(({ props, slots, emit, onUnmounted }) => {
    // Captured BEFORE shadowing: the enclosing level, whatever its depth.
    const parent = useMenuContext();
    const state = createControllableState<boolean>(
        () => props.model,
        props.defaultOpen ?? false,
        (v) => emit('openChange', v),
    );
    const list = createListController();
    const baseId = createId('zx-menu-sub');
    let subTrigger: HTMLElement | null = null;
    let subPopup: HTMLElement | null = null;
    let pendingFocus = false;
    let openHandle: ReturnType<typeof setTimeout> | null = null;
    let closeHandle: ReturnType<typeof setTimeout> | null = null;
    // Identity of this submenu's safe triangle in the PARENT level's grace.
    const graceOwner = {};
    let stopGraceMoves: (() => void) | null = null;
    const endGrace = (): (() => void) | null => {
        stopGraceMoves?.();
        stopGraceMoves = null;
        return parent.grace.end(graceOwner);
    };

    const isRtl = (): boolean => {
        const el = subTrigger;
        if (!el) return false;
        try {
            if (el.matches(':dir(rtl)')) return true;
        } catch {
            // :dir() unsupported — fall through to computed style.
        }
        return typeof getComputedStyle === 'function' && getComputedStyle(el).direction === 'rtl';
    };

    const cancelTimers = (): void => {
        if (openHandle != null) clearTimeout(openHandle);
        if (closeHandle != null) clearTimeout(closeHandle);
        openHandle = closeHandle = null;
    };

    const armClose = (): void => {
        closeHandle = setTimeout(() => {
            // The delay ran out with the pointer still short of the popup:
            // the sibling it rests on takes the hover it was held from.
            const replay = endGrace();
            close(false);
            replay?.();
        }, props.closeDelay ?? 300);
    };

    const open = (focusFirst: boolean): void => {
        cancelTimers();
        pendingFocus = focusFirst;
        state.value = true;
    };

    const close = (refocusTrigger: boolean): void => {
        cancelTimers();
        endGrace();
        pendingFocus = false;
        state.value = false;
        if (refocusTrigger) subTrigger?.focus();
    };

    const roving = createRovingKeydown({
        list,
        orientation: () => 'vertical',
        loop: () => parent.loop(),
        onMove: () => {},
    });
    const typeahead = createTypeahead({
        list,
        onMatch: (item: ListItem) => item.el()?.focus(),
    });

    // The subtree context: Item/Group/Separator inside the SubPopup use it
    // unchanged. Selection bubbles to the root; ArrowLeft steps back out.
    const subCtx: MenuContext = {
        state,
        bar: parent.bar,
        value: parent.value,
        list,
        ids: { trigger: `${baseId}-trigger`, popup: `${baseId}-popup` },
        // The SubPopup labels itself from the sub-trigger unconditionally —
        // a submenu without its trigger cannot open at all.
        triggerPresent: () => true,
        setTriggerPresent: () => {},
        setTriggerEl: () => {},
        // Tab closes the chain from the root down: the submenus follow
        // their parents' state.
        closeChain: () => parent.closeChain(),
        loop: () => parent.loop(),
        keydown(e, value) {
            if (e.key === 'Tab') {
                parent.closeChain();
                return;
            }
            const closeKey = isRtl() ? 'ArrowRight' : 'ArrowLeft';
            if (e.key === closeKey) {
                e.preventDefault();
                close(true);
                return;
            }
            // The opening arrow on an item that opens nothing is the
            // enclosing level's to answer — in a menubar, the root steps to
            // the adjacent menu (APG); a standalone menu ignores it.
            if (e.key === (isRtl() ? 'ArrowLeft' : 'ArrowRight')) {
                parent.keydown(e, value);
                return;
            }
            roving(e, value);
            if (!e.defaultPrevented) typeahead(e, value);
        },
        searching: () => typeahead.searching(),
        // A submenu opens from its sub-trigger, never by ArrowUp: always first.
        takeOpenFocus: () => 'first',
        setOpenFocus: () => {},
        select(value, closeOverride) {
            parent.select(value, closeOverride);
        },
        setAnchor: () => {},
        // A context trigger inside a submenu would re-anchor the WRONG
        // popup; submenus anchor to their sub-trigger, so this is inert.
        openAt: () => {},
        setPopup: (el) => { subPopup = el; },
        // Submenus take no arrow (#279): the root popup's is the only one
        // the strategy positions, so one rendered here stays inert.
        setArrow: () => {},
        grace: createPointerGrace(),
    };
    defineProvide(useMenuContext, () => subCtx);

    const ctx: MenuSubContext = {
        parent,
        state,
        ids: { trigger: `${baseId}-trigger`, popup: `${baseId}-popup` },
        open,
        close,
        scheduleOpen: () => {
            cancelTimers();
            openHandle = setTimeout(() => open(false), props.openDelay ?? 100);
        },
        scheduleClose: () => {
            cancelTimers();
            armClose();
        },
        cancelTimers,
        startGrace: (e) => {
            endGrace();
            // Touch has no hover to protect, and a closed or unmeasurable
            // popup has no edge to aim at — the delays alone apply.
            if (e.pointerType === 'touch' || !state.value || !subPopup || typeof document === 'undefined') return;
            const tri = safeTriangle(pointOf(e), subPopup.getBoundingClientRect());
            if (!tri) return;
            const inside = (p: Point): boolean => pointInTriangle(p, tri);
            parent.grace.start(graceOwner, inside);
            // Travel time is not lingering: every move still inside the
            // triangle restarts the close delay, so a slow, steady approach
            // arrives. A pointer that stops (or strays) lets it run out.
            const onMove = (ev: PointerEvent): void => {
                if (closeHandle != null && inside(pointOf(ev))) {
                    clearTimeout(closeHandle);
                    armClose();
                }
            };
            document.addEventListener('pointermove', onMove, true);
            stopGraceMoves = () => document.removeEventListener('pointermove', onMove, true);
        },
        endGrace: () => { endGrace(); },
        consumePendingFocus: () => {
            const wanted = pendingFocus;
            pendingFocus = false;
            return wanted;
        },
        isRtl,
        setSubTrigger: (el) => { subTrigger = el; },
        subTrigger: () => subTrigger,
        setSubPopup: (el) => { subPopup = el; },
    };
    defineProvide(useMenuSubContext, () => ctx);

    createAnchorPosition({
        getAnchor: () => subTrigger,
        getFloating: () => subPopup,
        isOpen: () => state.value,
        placement: () => props.placement ?? (isRtl() ? 'left-start' : 'right-start'),
        offset: () => props.offset ?? 4,
        collisionPadding: () => props.collisionPadding,
        alignOffset: () => props.alignOffset,
        strategy: props.positionStrategy,
    });

    // The native popover cascade closes descendants with their ancestors —
    // this mirrors it in state land for controlled parents and non-popover
    // environments.
    watch(
        () => parent.state.value,
        (parentOpen) => {
            if (!parentOpen) close(false);
        },
    );

    // Roving/hover moving to a DIFFERENT parent-level item closes this sub.
    watch(
        () => state.value,
        (openNow, _prev, onCleanup) => {
            if (!openNow) {
                // A native close (Escape, light dismiss) writes the state
                // straight from `toggle`, bypassing close(): the triangle
                // and a pending close must not outlive it — a later timer
                // would replay a held hover into a closed menu.
                if (closeHandle != null) clearTimeout(closeHandle);
                closeHandle = null;
                endGrace();
                return;
            }
            if (typeof document === 'undefined') return;
            const onFocusin = (e: FocusEvent): void => {
                const target = e.target as Node | null;
                if (!target) return;
                if (subTrigger?.contains(target) || subPopup?.contains(target)) return;
                close(false);
            };
            document.addEventListener('focusin', onFocusin);
            onCleanup(() => document.removeEventListener('focusin', onFocusin));
        },
    );

    onUnmounted(() => {
        cancelTimers();
        endGrace();
    });

    return () => <>{slots.default?.()}</>;
}, { name: 'Menu.Sub' });

// ── SubTrigger ──

export type MenuSubTriggerProps =
    /** Identity in the PARENT list (roving/typeahead); defaults to the sub id. */
    & Define.Prop<'value', string, false>
    & Define.Prop<'textValue', string, false>
    & WithDisabled
    & WithClass
    /** Not `id`/`role`: the sub-popup is labelled by it, and it is a `menuitem`. */
    & Omit<WithHtmlAttrs, 'id' | 'role'>
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const MenuSubTrigger = component<MenuSubTriggerProps>(({ props, slots, signal, onUnmounted }) => {
    const sub = useMenuSubContext();
    let el: HTMLElement | null = null;
    const focus = signal({ highlighted: false });
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => !!props.disabled,
    });

    const value = (): string => props.value ?? sub.ids.trigger;
    const hover = graceHover(sub.parent.grace, () => {
        el?.focus();
        if (!props.disabled) sub.scheduleOpen();
    });

    // A parent-level item: arrows and typeahead at the parent level rove
    // through it like any other item. It never emits `select`.
    const item: ListItem = {
        id: `sub-trigger-${sub.ids.trigger}`,
        get value() { return value(); },
        disabled: () => !!props.disabled,
        el: () => el,
        textValue: () => props.textValue ?? el?.textContent?.trim() ?? value(),
    };
    const unregister = sub.parent.list.register(item);
    onUnmounted(() => unregister());

    const bag = (): PartProps => ({
        ...htmlAttrs(props),
        id: sub.ids.trigger,
        'data-scope': SCOPE,
        'data-part': 'sub-trigger',
        'data-state': stateAttr(sub.state.value, 'open', 'closed'),
        'data-disabled': dataAttr(props.disabled),
        'data-highlighted': dataAttr(focus.highlighted),
        role: 'menuitem',
        tabIndex: -1,
        'aria-haspopup': 'menu',
        'aria-expanded': sub.state.value ? 'true' : 'false',
        'aria-controls': sub.ids.popup,
        'aria-disabled': props.disabled ? 'true' : undefined,
        onClick: () => {
            if (props.disabled) return;
            if (sub.state.value) sub.close(false);
            else sub.open(false);
        },
        onKeydown: (e: KeyboardEvent) => {
            // Space continues a running parent-level typeahead search — it is
            // search text then, so it gets no press feedback either.
            const searchSpace = e.key === ' ' && sub.parent.searching();
            if (!searchSpace) press.onKeydown(e);
            if (props.disabled) return;
            const openKey = e.key === 'Enter' || (e.key === ' ' && !searchSpace)
                || e.key === (sub.isRtl() ? 'ArrowLeft' : 'ArrowRight');
            if (openKey) {
                e.preventDefault();
                sub.open(true);
                return;
            }
            sub.parent.keydown(e, value());
        },
        onKeyup: press.onKeyup,
        onPointerenter: (e: PointerEvent) => {
            // Back on its own trigger: this submenu's triangle is spent. A
            // SIBLING submenu's triangle can still hold this trigger.
            sub.endGrace();
            hover.enter(e);
        },
        onPointermove: hover.move,
        onPointerdown: press.onPointerdown,
        onPointerup: press.onPointerup,
        onPointercancel: press.onPointercancel,
        onPointerleave: (e: PointerEvent) => {
            press.onPointerleave(e);
            hover.leave();
            sub.scheduleClose();
            sub.startGrace(e);
        },
        onFocus: () => { focus.highlighted = true; },
        onBlur: (e: FocusEvent) => {
            press.onBlur(e);
            focus.highlighted = false;
        },
        ref: (node: HTMLElement | null) => { el = node; sub.setSubTrigger(node); },
    });

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <div class={props.class} {...b}>
                {slots.default?.(b)}
            </div>
        );
    };
}, { name: 'Menu.SubTrigger' });

// ── SubPopup ──

export type MenuSubPopupProps =
    & WithClass
    /** Not `id`/`role`: the SubTrigger points at the popup, which is a `menu`. */
    & Omit<WithHtmlAttrs, 'id' | 'role'>
    & Define.Slot<'default'>;

const MenuSubPopup = component<MenuSubPopupProps>(({ props, slots, onMounted }) => {
    const sub = useMenuSubContext();
    // The shadowed context — this IS the sub's own list/state.
    const menu = useMenuContext();
    let el: HTMLElement | null = null;
    const exit = createTopLayerExit();

    const scoped = mountScope();
    onMounted(() => scoped(() => {
        effect(() => {
            const open = sub.state.value;
            const node = el as (HTMLElement & { showPopover?(): void; hidePopover?(): void; matches(s: string): boolean }) | null;
            if (!node || typeof node.showPopover !== 'function') return;
            if (open) exit.cancel();
            const showing = node.matches(':popover-open');
            if (open && !showing) {
                node.showPopover();
                // Unlike the root popup, focus only moves in when the open
                // was a keyboard gesture — hover leaves it on the trigger.
                if (sub.consumePendingFocus()) menu.list.enabledItems()[0]?.el()?.focus();
            } else if (!open && showing) {
                exit.close(node, () => {
                    if (!sub.state.value && node.matches(':popover-open')) node.hidePopover!();
                });
            }
        });
    }));

    return () => {
        const attrs = htmlAttrs(props);
        return (
            <div
                {...attrs}
                id={sub.ids.popup}
                data-scope={SCOPE}
                data-part="sub-popup"
                data-state={stateAttr(sub.state.value, 'open', 'closed')}
                popover="auto"
                role="menu"
                aria-labelledby={attrs['aria-labelledby'] ? `${sub.ids.trigger} ${attrs['aria-labelledby']}` : sub.ids.trigger}
                class={props.class}
                ref={(node: HTMLElement | null) => { el = node; sub.setSubPopup(node); }}
                onToggle={(e: Event) => {
                    const open = (e as ToggleEvent).newState === 'open';
                    if (sub.state.value === open) return;
                    // A native close (Escape) with focus still inside would
                    // strand it on a hidden element; hand it back to the
                    // sub-trigger. A light-dismiss click has already moved focus
                    // to the clicked target, so `contains` is false and nothing
                    // is stolen.
                    if (!open && el?.contains(document.activeElement)) sub.subTrigger()?.focus();
                    sub.state.value = open;
                }}
                onPointerenter={() => {
                    sub.cancelTimers();
                    sub.endGrace();
                }}
                onPointerleave={() => sub.scheduleClose()}
            >
                {slots.default?.()}
            </div>
        );
    };
}, { name: 'Menu.SubPopup' });

// ── Group / GroupLabel / Separator ──

interface MenuGroupContext {
    labelId: string;
    labelPresent(): boolean;
    setLabelPresent(present: boolean): void;
}

function makeInertGroup(): MenuGroupContext {
    return {
        labelId: 'zx-menu-group-inert-label',
        labelPresent: () => false,
        setLabelPresent: () => {},
    };
}

export const useMenuGroupContext = defineInjectable<MenuGroupContext>(() => makeInertGroup());

export type MenuGroupProps =
    & WithClass
    /** Not `role`: the part is the `group`. An app `aria-labelledby` joins the GroupLabel's. */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Slot<'default'>;

const MenuGroup = component<MenuGroupProps>(({ props, slots, signal }) => {
    const baseId = createId('zx-menu-group');
    // Written from GroupLabel one microtask after its setup — a write made
    // during the render pass is invisible to the already-rendered group.
    const present = signal({ label: false });
    const ctx: MenuGroupContext = {
        labelId: `${baseId}-label`,
        labelPresent: () => present.label,
        setLabelPresent: (p) => { present.label = p; },
    };
    defineProvide(useMenuGroupContext, () => ctx);
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
}, { name: 'Menu.Group' });

/** Not `id`: the group is labelled by the GroupLabel's own. */
export type MenuGroupLabelProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const MenuGroupLabel = component<MenuGroupLabelProps>(({ props, slots, onUnmounted }) => {
    const group = useMenuGroupContext();
    // Deferred past the render pass — see the note on `present` in Group.
    let alive = true;
    queueMicrotask(() => { if (alive) group.setLabelPresent(true); });
    onUnmounted(() => {
        alive = false;
        group.setLabelPresent(false);
    });
    // No role: the label must stay in the accessibility tree for the group's
    // aria-labelledby to compute a name from it — role="presentation" was
    // self-defeating.
    return () => (
        <div {...htmlAttrs(props)} id={group.labelId} data-scope={SCOPE} data-part="group-label" class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'Menu.GroupLabel' });

// ── Arrow ──

/** The arrow is decoration: it renders `aria-hidden="true"` whatever the app passes. */
export type MenuArrowProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

/**
 * A mark on the root popup's edge facing the trigger, pointed at the
 * trigger's centre (or a context menu's pointer) through
 * `--arrow-x`/`--arrow-y` (see `Popover.Arrow`). Root popup only — see the
 * module note on submenus.
 */
const MenuArrow = component<MenuArrowProps>(({ props, slots, onUnmounted }) => {
    const menu = useMenuContext();
    let el: HTMLElement | null = null;
    onUnmounted(() => {
        if (el) menu.setArrow(null);
    });
    return () => (
        <span
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="arrow"
            aria-hidden="true"
            class={props.class}
            ref={(node: HTMLElement | null) => { el = node; menu.setArrow(node); }}
        >
            {slots.default?.()}
        </span>
    );
}, { name: 'Menu.Arrow' });

// ── Shortcut ──

/** The hint is decoration: it renders `aria-hidden="true"` — the item's `keyshortcuts` is what AT announces. */
export type MenuShortcutProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

/**
 * The visible keyboard-shortcut hint inside an item (`⌘S`, `Ctrl+S`).
 * Hidden from AT — the item's `keyshortcuts` prop states the shortcut as
 * `aria-keyshortcuts` instead, so it is announced once, in a form a reader
 * can parse. Zero binds no keys.
 */
const MenuShortcut = component<MenuShortcutProps>(({ props, slots }) => {
    return () => (
        <span {...htmlAttrs(props)} data-scope={SCOPE} data-part="shortcut" aria-hidden="true" class={props.class}>
            {slots.default?.()}
        </span>
    );
}, { name: 'Menu.Shortcut' });

/** Not `role`: the part is a `separator`. */
export type MenuSeparatorProps = WithClass & Omit<WithHtmlAttrs, 'role'>;

const MenuSeparator = component<MenuSeparatorProps>(({ props }) => {
    return () => (
        <div {...htmlAttrs(props)} data-scope={SCOPE} data-part="separator" role="separator" class={props.class} />
    );
}, { name: 'Menu.Separator' });

export const Menu = compound(MenuRoot, {
    Root: MenuRoot,
    Trigger: MenuTrigger,
    ContextTrigger: MenuContextTrigger,
    Popup: MenuPopup,
    Item: MenuItem,
    CheckboxItem: MenuCheckboxItem,
    RadioGroup: MenuRadioGroup,
    RadioItem: MenuRadioItem,
    Sub: MenuSub,
    SubTrigger: MenuSubTrigger,
    SubPopup: MenuSubPopup,
    Group: MenuGroup,
    GroupLabel: MenuGroupLabel,
    Separator: MenuSeparator,
    Arrow: MenuArrow,
    Shortcut: MenuShortcut,
});
