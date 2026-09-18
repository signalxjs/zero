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
 * Keyboard: ArrowDown/Up move focus through enabled items, Home/End jump,
 * typeahead matches item text, Enter/Space activate, Escape closes (native
 * popover) and focus returns to the trigger.
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
 * focus into the submenu.
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
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import { variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithDisabled, WithVariantAxes } from '../../contract/props.js';
import { menuAnatomy } from './anatomy.js';

const SCOPE = menuAnatomy.scope;

interface MenuContext {
    state: ControllableState<boolean>;
    list: ReturnType<typeof createListController>;
    ids: { trigger: string; popup: string };
    /**
     * The popup is labelled by its trigger only while a Menu.Trigger is
     * actually rendered — a context-menu-only composition has no visible
     * trigger to name it, and a dangling aria-labelledby is worse than none.
     */
    triggerPresent(): boolean;
    setTriggerPresent(present: boolean): void;
    keydown(e: KeyboardEvent, value: string): void;
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
}

function makeInert(): MenuContext {
    return {
        state: createInertState<boolean>(false),
        list: createListController(),
        ids: { trigger: 'zx-menu-inert-trigger', popup: 'zx-menu-inert' },
        triggerPresent: () => false,
        setTriggerPresent: () => {},
        keydown: () => {},
        select: () => {},
        setAnchor: () => {},
        openAt: () => {},
        setPopup: () => {},
    };
}

export const useMenuContext = defineInjectable<MenuContext>(() => makeInert());

// ── Root ──

export type MenuRootProps =
    & Define.Model<boolean>
    & Define.Prop<'defaultOpen', boolean, false>
    & Define.Event<'openChange', boolean>
    & Define.Event<'select', string>
    & Define.Prop<'closeOnSelect', boolean, false>
    & Define.Prop<'placement', Placement, false>
    & Define.Prop<'offset', number, false>
    & Define.Prop<'positionStrategy', PositionStrategy, false>
    & Define.Slot<'default'>;

const MenuRoot = component<MenuRootProps>(({ props, slots, emit, signal }) => {
    const state = createControllableState<boolean>(
        () => props.model,
        props.defaultOpen ?? false,
        (v) => emit('openChange', v),
    );
    const list = createListController();
    const baseId = createId('zx-menu');
    // Written from Trigger one microtask after its setup — a write made
    // during the render pass is invisible to the already-rendered popup.
    const present = signal({ trigger: false });
    let anchor: PositionAnchor | null = null;
    let popup: HTMLElement | null = null;

    const roving = createRovingKeydown({
        list,
        orientation: () => 'vertical',
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
        strategy: props.positionStrategy,
    });

    const ctx: MenuContext = {
        state,
        list,
        ids: { trigger: `${baseId}-trigger`, popup: `${baseId}-popup` },
        triggerPresent: () => present.trigger,
        setTriggerPresent: (p) => { present.trigger = p; },
        keydown(e, value) {
            roving(e, value);
            if (!e.defaultPrevented) typeahead(e, value);
        },
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
    };
    defineProvide(useMenuContext, () => ctx);

    createFocusRestore(() => state.value);

    return () => <>{slots.default?.()}</>;
}, { name: 'Menu.Root' });

// ── Trigger ──

export type MenuTriggerProps =
    & WithDisabled
    & WithClass
    & WithVariantAxes<'menu'>
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const MenuTrigger = component<MenuTriggerProps>(({ props, slots, signal, onUnmounted }) => {
    const menu = useMenuContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => !!props.disabled,
    });
    // Deferred past the render pass — see the note on `present` in Root.
    let alive = true;
    queueMicrotask(() => { if (alive) menu.setTriggerPresent(true); });
    onUnmounted(() => {
        alive = false;
        menu.setTriggerPresent(false);
    });

    const bag = (): PartProps => ({
        id: menu.ids.trigger,
        'data-scope': SCOPE,
        'data-part': 'trigger',
        ...variantAttrs(props),
        'data-state': stateAttr(menu.state.value, 'open', 'closed'),
        'data-disabled': dataAttr(props.disabled),
        'data-focus-visible': dataAttr(focus.visible),
        'aria-haspopup': 'menu',
        'aria-expanded': menu.state.value ? 'true' : 'false',
        'aria-controls': menu.ids.popup,
        onClick: () => {
            if (props.disabled) return;
            // Re-claim the anchor on every open: a context-trigger open may
            // have moved it to a point — last opener wins.
            menu.setAnchor(el);
            menu.state.value = !menu.state.value;
        },
        onKeydown: (e: KeyboardEvent) => {
            press.onKeydown(e);
            // ArrowDown on a closed trigger opens the menu (APG).
            if (e.key === 'ArrowDown' && !menu.state.value && !props.disabled) {
                e.preventDefault();
                menu.setAnchor(el);
                menu.state.value = true;
            }
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
        ref: (node: HTMLElement | null) => { el = node; menu.setAnchor(node); },
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
}, { name: 'Menu.Trigger' });

// ── ContextTrigger ──

export type MenuContextTriggerProps =
    & WithDisabled
    & WithClass
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

export type MenuPopupProps = WithClass & Define.Slot<'default'>;

const MenuPopup = component<MenuPopupProps>(({ props, slots, onMounted }) => {
    const menu = useMenuContext();
    let el: HTMLElement | null = null;

    onMounted(() => {
        effect(() => {
            const open = menu.state.value;
            const node = el as (HTMLElement & { showPopover?(): void; hidePopover?(): void; matches(s: string): boolean }) | null;
            if (!node || typeof node.showPopover !== 'function') return;
            const showing = node.matches(':popover-open');
            if (open && !showing) {
                node.showPopover();
                // Focus lands on the first enabled item (APG menu button).
                menu.list.enabledItems()[0]?.el()?.focus();
            } else if (!open && showing) {
                node.hidePopover!();
            }
        });
    });

    return () => (
        <div
            id={menu.ids.popup}
            data-scope={SCOPE}
            data-part="popup"
            data-state={stateAttr(menu.state.value, 'open', 'closed')}
            popover="auto"
            role="menu"
            aria-labelledby={menu.triggerPresent() ? menu.ids.trigger : undefined}
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

    /** The behavior half of the part bag; the caller adds identity + ARIA. */
    const handlers = (): Omit<PartProps, 'data-scope' | 'data-part'> => ({
        'data-disabled': dataAttr(opts.disabled()),
        'data-highlighted': dataAttr(focus.highlighted),
        tabIndex: -1,
        'aria-disabled': opts.disabled() ? 'true' : undefined,
        onClick: () => activate(),
        onKeydown: (e: KeyboardEvent) => {
            press.onKeydown(e);
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate();
                return;
            }
            menu.keydown(e, opts.value());
        },
        onKeyup: press.onKeyup,
        onPointerenter: () => { el?.focus(); },
        onPointerdown: press.onPointerdown,
        onPointerup: press.onPointerup,
        onPointercancel: press.onPointercancel,
        onPointerleave: press.onPointerleave,
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
    & WithDisabled
    & WithClass
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
        ...core.handlers(),
        'data-scope': SCOPE,
        'data-part': 'item',
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
    & WithDisabled
    & WithClass
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
        ...core.handlers(),
        'data-scope': SCOPE,
        'data-part': 'checkbox-item',
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
    return () => <MenuGroup class={props.class}>{slots.default?.()}</MenuGroup>;
}, { name: 'Menu.RadioGroup' });

export type MenuRadioItemProps =
    & Define.Prop<'value', string, true>
    /** Close the menu when this item is chosen — default FALSE, like CheckboxItem. */
    & Define.Prop<'closeOnSelect', boolean, false>
    & Define.Prop<'textValue', string, false>
    & WithDisabled
    & WithClass
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
        ...core.handlers(),
        'data-scope': SCOPE,
        'data-part': 'radio-item',
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

    const open = (focusFirst: boolean): void => {
        cancelTimers();
        pendingFocus = focusFirst;
        state.value = true;
    };

    const close = (refocusTrigger: boolean): void => {
        cancelTimers();
        pendingFocus = false;
        state.value = false;
        if (refocusTrigger) subTrigger?.focus();
    };

    const roving = createRovingKeydown({
        list,
        orientation: () => 'vertical',
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
        list,
        ids: { trigger: `${baseId}-trigger`, popup: `${baseId}-popup` },
        // The SubPopup labels itself from the sub-trigger unconditionally —
        // a submenu without its trigger cannot open at all.
        triggerPresent: () => true,
        setTriggerPresent: () => {},
        keydown(e, value) {
            const closeKey = isRtl() ? 'ArrowRight' : 'ArrowLeft';
            if (e.key === closeKey) {
                e.preventDefault();
                close(true);
                return;
            }
            roving(e, value);
            if (!e.defaultPrevented) typeahead(e, value);
        },
        select(value, closeOverride) {
            parent.select(value, closeOverride);
        },
        setAnchor: () => {},
        // A context trigger inside a submenu would re-anchor the WRONG
        // popup; submenus anchor to their sub-trigger, so this is inert.
        openAt: () => {},
        setPopup: (el) => { subPopup = el; },
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
            closeHandle = setTimeout(() => close(false), props.closeDelay ?? 300);
        },
        cancelTimers,
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
            if (!openNow || typeof document === 'undefined') return;
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

    onUnmounted(() => cancelTimers());

    return () => <>{slots.default?.()}</>;
}, { name: 'Menu.Sub' });

// ── SubTrigger ──

export type MenuSubTriggerProps =
    /** Identity in the PARENT list (roving/typeahead); defaults to the sub id. */
    & Define.Prop<'value', string, false>
    & Define.Prop<'textValue', string, false>
    & WithDisabled
    & WithClass
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
            press.onKeydown(e);
            if (props.disabled) return;
            const openKey = e.key === 'Enter' || e.key === ' '
                || e.key === (sub.isRtl() ? 'ArrowLeft' : 'ArrowRight');
            if (openKey) {
                e.preventDefault();
                sub.open(true);
                return;
            }
            sub.parent.keydown(e, value());
        },
        onKeyup: press.onKeyup,
        onPointerenter: () => {
            el?.focus();
            if (!props.disabled) sub.scheduleOpen();
        },
        onPointerdown: press.onPointerdown,
        onPointerup: press.onPointerup,
        onPointercancel: press.onPointercancel,
        onPointerleave: (e: PointerEvent) => {
            press.onPointerleave(e);
            sub.scheduleClose();
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

export type MenuSubPopupProps = WithClass & Define.Slot<'default'>;

const MenuSubPopup = component<MenuSubPopupProps>(({ props, slots, onMounted }) => {
    const sub = useMenuSubContext();
    // The shadowed context — this IS the sub's own list/state.
    const menu = useMenuContext();
    let el: HTMLElement | null = null;

    onMounted(() => {
        effect(() => {
            const open = sub.state.value;
            const node = el as (HTMLElement & { showPopover?(): void; hidePopover?(): void; matches(s: string): boolean }) | null;
            if (!node || typeof node.showPopover !== 'function') return;
            const showing = node.matches(':popover-open');
            if (open && !showing) {
                node.showPopover();
                // Unlike the root popup, focus only moves in when the open
                // was a keyboard gesture — hover leaves it on the trigger.
                if (sub.consumePendingFocus()) menu.list.enabledItems()[0]?.el()?.focus();
            } else if (!open && showing) {
                node.hidePopover!();
            }
        });
    });

    return () => (
        <div
            id={sub.ids.popup}
            data-scope={SCOPE}
            data-part="sub-popup"
            data-state={stateAttr(sub.state.value, 'open', 'closed')}
            popover="auto"
            role="menu"
            aria-labelledby={sub.ids.trigger}
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
            onPointerenter={() => sub.cancelTimers()}
            onPointerleave={() => sub.scheduleClose()}
        >
            {slots.default?.()}
        </div>
    );
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

export type MenuGroupProps = WithClass & Define.Slot<'default'>;

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
}, { name: 'Menu.Group' });

export type MenuGroupLabelProps = WithClass & Define.Slot<'default'>;

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
        <div id={group.labelId} data-scope={SCOPE} data-part="group-label" class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'Menu.GroupLabel' });

export type MenuSeparatorProps = WithClass;

const MenuSeparator = component<MenuSeparatorProps>(({ props }) => {
    return () => (
        <div data-scope={SCOPE} data-part="separator" role="separator" class={props.class} />
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
});
