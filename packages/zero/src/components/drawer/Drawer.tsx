/**
 * Drawer — the edge panel on the native `<dialog>`.
 *
 * ```tsx
 * <Drawer.Root model={() => state.open} label="Site navigation">
 *     <Drawer.Trigger>Menu</Drawer.Trigger>
 *     <Drawer.Panel>
 *         <Drawer.Title>Navigation</Drawer.Title>
 *         <nav>…links…</nav>
 *         <Drawer.Close>Close</Drawer.Close>
 *     </Drawer.Panel>
 * </Drawer.Root>
 * ```
 *
 * Modal by default — `showModal()` gives focus trapping, Escape, inert
 * background and focus restore natively, and the scrim dismisses by the
 * same click geometry Dialog uses (a `::backdrop` click targets the
 * `<dialog>` element itself; only a pointer outside the panel's box can be
 * the backdrop). `modal={false}` is the INLINE mode: the panel renders in
 * flow via `show()`, keeps no dismiss trap (outside clicks are a
 * non-event for furniture), closes on Escape through the dismissable
 * behavior, and covers focus restore itself since `show()` provides
 * neither. See `anatomy.ts` for the placement and labelling decisions.
 */
import { component, compound, defineInjectable, defineProvide, effect } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { createDismissable } from '../../behaviors/dismiss.js';
import { createFocusRestore } from '../../behaviors/focus.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import { variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithDisabled, WithVariantAxes } from '../../contract/props.js';
import { drawerAnatomy } from './anatomy.js';

const SCOPE = drawerAnatomy.scope;

/** Which reading edge the panel sits on — the logical pair. */
export type DrawerPlacement = 'start' | 'end';

interface DrawerContext {
    state: ControllableState<boolean>;
    modal(): boolean;
    dismissible(): boolean;
    placement(): DrawerPlacement;
    label(): string | undefined;
    ids: { panel: string; title: string };
    /** Title reports its presence so the panel's ARIA ref never dangles. */
    titlePresent(): boolean;
    setTitlePresent(present: boolean): void;
}

function makeInert(): DrawerContext {
    return {
        state: createInertState<boolean>(false),
        modal: () => true,
        dismissible: () => true,
        placement: () => 'start',
        label: () => undefined,
        ids: { panel: 'zx-drawer-inert', title: 'zx-drawer-inert-title' },
        titlePresent: () => false,
        setTitlePresent: () => {},
    };
}

export const useDrawerContext = defineInjectable<DrawerContext>(() => makeInert());

// ── Root ──

export type DrawerRootProps =
    & Define.Model<boolean>
    & Define.Prop<'defaultOpen', boolean, false>
    & Define.Event<'openChange', boolean>
    & Define.Prop<'modal', boolean, false>
    & Define.Prop<'dismissible', boolean, false>
    /** Which reading edge the panel sits on. Default `start`. */
    & Define.Prop<'placement', DrawerPlacement, false>
    /** Accessible name of the panel when no `Drawer.Title` renders. */
    & Define.Prop<'label', string, false>
    & Define.Slot<'default'>;

const DrawerRoot = component<DrawerRootProps>(({ props, slots, emit, signal }) => {
    const state = createControllableState<boolean>(
        () => props.model,
        props.defaultOpen ?? false,
        (v) => emit('openChange', v),
    );
    const baseId = createId('zx-drawer');
    // Written from Title one microtask after its setup — a write made during
    // the render pass is invisible to the already-rendered panel (the same
    // deferral Dialog documents on its `present` signal).
    const present = signal({ title: false });
    const ctx: DrawerContext = {
        state,
        modal: () => props.modal ?? true,
        dismissible: () => props.dismissible ?? true,
        placement: () => props.placement ?? 'start',
        label: () => props.label,
        ids: {
            panel: `${baseId}-panel`,
            title: `${baseId}-title`,
        },
        titlePresent: () => present.title,
        setTitlePresent: (p) => { present.title = p; },
    };
    defineProvide(useDrawerContext, () => ctx);

    // `showModal()` restores focus natively on close; `show()` does not —
    // cover the inline path so Escape/Close never strand focus.
    createFocusRestore(() => state.value && !(props.modal ?? true));

    return () => <>{slots.default?.()}</>;
}, { name: 'Drawer.Root' });

// ── Trigger ──

export type DrawerTriggerProps =
    & WithDisabled
    & WithClass
    & WithVariantAxes<'drawer'>
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const DrawerTrigger = component<DrawerTriggerProps>(({ props, slots, signal }) => {
    const drawer = useDrawerContext();
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
        'data-state': stateAttr(drawer.state.value, 'open', 'closed'),
        'data-disabled': dataAttr(props.disabled),
        'data-focus-visible': dataAttr(focus.visible),
        'aria-haspopup': 'dialog',
        'aria-expanded': drawer.state.value ? 'true' : 'false',
        'aria-controls': drawer.ids.panel,
        onClick: () => {
            if (!props.disabled) drawer.state.value = true;
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
}, { name: 'Drawer.Trigger' });

// ── Panel ──

export type DrawerPanelProps = WithClass & Define.Slot<'default'>;

const DrawerPanel = component<DrawerPanelProps>(({ props, slots, onMounted }) => {
    const drawer = useDrawerContext();
    let el: HTMLDialogElement | null = null;

    // A non-modal <dialog> fires no cancel event, so `dismissible` would be
    // a silent no-op without this fallback. Escape only — an inline drawer
    // is furniture that survives clicks elsewhere, and it has no backdrop.
    createDismissable({
        getElement: () => el,
        isOpen: () => drawer.state.value && !drawer.modal() && drawer.dismissible(),
        dismiss: () => { drawer.state.value = false; },
        outsidePress: false,
    });

    onMounted(() => {
        effect(() => {
            const open = drawer.state.value;
            const node = el;
            if (!node || typeof node.showModal !== 'function') return;
            if (open && !node.open) {
                if (drawer.modal()) node.showModal();
                else node.show();
            } else if (!open && node.open) {
                node.close();
            }
        });
    });

    return () => (
        <dialog
            id={drawer.ids.panel}
            data-scope={SCOPE}
            data-part="panel"
            data-state={stateAttr(drawer.state.value, 'open', 'closed')}
            data-placement={drawer.placement()}
            aria-labelledby={drawer.titlePresent() ? drawer.ids.title : undefined}
            aria-label={drawer.titlePresent() ? undefined : drawer.label()}
            class={props.class}
            ref={(node: HTMLDialogElement | null) => { el = node; }}
            onClose={() => { drawer.state.value = false; }}
            onCancel={(e: Event) => {
                // Native Escape: let the model decide. Prevent the default
                // close and route through state so non-dismissible drawers
                // stay open and controlled parents stay authoritative.
                e.preventDefault();
                if (drawer.dismissible()) drawer.state.value = false;
            }}
            onClick={(e: MouseEvent) => {
                // A ::backdrop click targets the <dialog> element itself —
                // but so does a click on the panel's own padding. Geometry
                // decides: only a pointer position outside the panel's box
                // can be the scrim. Modal only — an inline drawer has no
                // backdrop at all.
                if (!drawer.modal() || !drawer.dismissible()) return;
                if (!el || e.target !== el) return;
                // A keyboard-synthesized click carries no geometry.
                if (e.detail === 0) return;
                const rect = el.getBoundingClientRect();
                const inside = e.clientX >= rect.left && e.clientX <= rect.right
                    && e.clientY >= rect.top && e.clientY <= rect.bottom;
                if (!inside) drawer.state.value = false;
            }}
        >
            {slots.default?.()}
        </dialog>
    );
}, { name: 'Drawer.Panel' });

// ── Title ──

export type DrawerTitleProps = WithClass & Define.Slot<'default'>;

const DrawerTitle = component<DrawerTitleProps>(({ props, slots, onUnmounted }) => {
    const drawer = useDrawerContext();
    // Deferred past the render pass — see the note on `present` in Root.
    let alive = true;
    queueMicrotask(() => { if (alive) drawer.setTitlePresent(true); });
    onUnmounted(() => {
        alive = false;
        drawer.setTitlePresent(false);
    });
    return () => (
        <h2 id={drawer.ids.title} data-scope={SCOPE} data-part="title" class={props.class}>
            {slots.default?.()}
        </h2>
    );
}, { name: 'Drawer.Title' });

// ── Close ──

export type DrawerCloseProps =
    & WithDisabled
    & WithClass
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const DrawerClose = component<DrawerCloseProps>(({ props, slots, signal }) => {
    const drawer = useDrawerContext();
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
            if (!props.disabled) drawer.state.value = false;
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
}, { name: 'Drawer.Close' });

export const Drawer = compound(DrawerRoot, {
    Root: DrawerRoot,
    Trigger: DrawerTrigger,
    Panel: DrawerPanel,
    Title: DrawerTitle,
    Close: DrawerClose,
});
