/**
 * Collapsible — a disclosure built on native `<details>`/`<summary>`.
 *
 * ```tsx
 * <Collapsible.Root model={() => state.open}>
 *     <Collapsible.Trigger>Details</Collapsible.Trigger>
 *     <Collapsible.Panel>…</Collapsible.Panel>
 * </Collapsible.Root>
 * ```
 *
 * The native element gives keyboard interaction, semantics and (server
 * rendered) zero-JS toggling for free; the component keeps the `model` in
 * charge by intercepting the summary click and rendering `open` from state.
 * When the browser opens the element itself (find-in-page, fragment
 * navigation), the native `toggle` event syncs back into the model.
 *
 * The panel publishes its measured size as `--collapsible-panel-height` /
 * `--collapsible-panel-width`, and a close keeps the element `open` until the
 * panel's exit animation has played (`data-state` flips at once) — the only
 * way a `<details>` close can animate (#276). The panel is labelled by the
 * trigger.
 *
 * A `Collapsible.Indicator` inside the trigger (#437) is the disclosure's
 * optional mark — an empty, `aria-hidden` span mirroring `open|closed` that
 * a design system draws a chevron in.
 *
 * `native={false}` (#453) trades the native pair for a construction that
 * composes: a `<summary>` must be its `<details>`' first child, so it can
 * never sit inside another part's layout (a Card header, a table row). The
 * root renders a `<div>`, the trigger a `<button aria-expanded
 * aria-controls>` that can sit anywhere inside it — with `asChild`, and as a
 * lender (`lend`, #452) — and the panel hides with `hidden="until-found"`,
 * whose `beforematch` writes the model so find-in-page still opens it.
 *
 * ```tsx
 * <Collapsible.Root native={false}>
 *     <Card.Root>
 *         <Card.Header>
 *             <Collapsible.Trigger asChild>
 *                 {(c) => <Button.Root lend={c}>Expand</Button.Root>}
 *             </Collapsible.Trigger>
 *         </Card.Header>
 *         <Collapsible.Panel><Card.Body>…</Card.Body></Collapsible.Panel>
 *     </Card.Root>
 * </Collapsible.Root>
 * ```
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { createDisclosurePresence, type DisclosurePresence } from '../../behaviors/disclosure-presence.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { mountScope } from '../../behaviors/mount-scope.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { renderAsChild, synthesizesClickFrom } from '../../contract/as-child.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { mergePartProps } from '../../contract/merge-part-props.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithDisabled, WithHtmlAttrs, WithLend, WithVariantAxes } from '../../contract/props.js';
import { collapsibleAnatomy } from './anatomy.js';

const SCOPE = collapsibleAnatomy.scope;

interface CollapsibleContext {
    state: ControllableState<boolean>;
    disabled(): boolean;
    /** `<details>`/`<summary>` (the default), or div/button/until-found. */
    native(): boolean;
    ids: { trigger: string; panel: string };
    presence: DisclosurePresence;
}

function makeInert(): CollapsibleContext {
    return {
        state: createInertState<boolean>(false),
        disabled: () => false,
        native: () => true,
        ids: { trigger: 'zx-collapsible-inert-trigger', panel: 'zx-collapsible-inert-panel' },
        presence: createDisclosurePresence({ isOpen: () => false, prefix: '--collapsible-panel' }),
    };
}

export const useCollapsibleContext = defineInjectable<CollapsibleContext>(() => makeInert());

// ── Root ──

export type CollapsibleRootProps =
    & Define.Model<boolean>
    & Define.Prop<'defaultOpen', boolean, false>
    & Define.Event<'openChange', boolean>
    /**
     * `true` (the default): native `<details>`/`<summary>` — keyboard,
     * semantics and server-rendered toggling with no JS, but the trigger must
     * be the root's first child. `false` (#453): a `<div>` root, a `<button>`
     * trigger that can sit anywhere inside it and takes `asChild`/`lend`, and
     * a `hidden="until-found"` panel. Read once: not reactive.
     */
    & Define.Prop<'native', boolean, false>
    & WithDisabled
    & WithVariantAxes<'collapsible'>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const CollapsibleRoot = component<CollapsibleRootProps>(({ props, slots, emit, onMounted, onUnmounted }) => {
    const state = createControllableState<boolean>(
        () => props.model,
        props.defaultOpen ?? false,
        (v) => emit('openChange', v),
    );
    const baseId = createId('zx-collapsible');
    const presence = createDisclosurePresence({ isOpen: () => state.value, prefix: '--collapsible-panel' });
    // Read once: switching the element under a mounted disclosure would
    // remount every part, and nothing a trigger lent elsewhere could follow.
    const native = props.native !== false;
    const ctx: CollapsibleContext = {
        state,
        disabled: () => !!props.disabled,
        native: () => native,
        ids: { trigger: `${baseId}-trigger`, panel: `${baseId}-panel` },
        presence,
    };
    defineProvide(useCollapsibleContext, () => ctx);

    let el: HTMLElement | null = null;
    const scoped = mountScope();
    onMounted(() => scoped(() => presence.mount(el)));
    onUnmounted(() => presence.unmount());

    if (!native) {
        // No `open`, no toggle: the panel hides itself (until-found), and
        // its `beforematch` is the platform's way back into the model.
        return () => (
            <div
                {...htmlAttrs(props)}
                data-scope={SCOPE}
                data-part="root"
                data-state={stateAttr(state.value, 'open', 'closed')}
                data-disabled={dataAttr(props.disabled)}
                {...variantAttrs(props)}
                class={props.class}
                ref={(node: HTMLElement | null) => { el = node; }}
            >
                {slots.default?.()}
            </div>
        );
    }

    return () => (
        <details
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="root"
            data-state={stateAttr(state.value, 'open', 'closed')}
            data-disabled={dataAttr(props.disabled)}
            {...variantAttrs(props)}
            // Open, or still playing the panel's exit (#276).
            open={presence.shown()}
            class={props.class}
            ref={(node: HTMLElement | null) => { el = node; }}
            onToggle={(e: Event) => {
                // The platform opens a closed <details> by itself for
                // find-in-page and fragment navigation (#166). Adopt that
                // into the model; if the model refuses (a disabled root),
                // put the element back — the vdom won't, since its `open`
                // prop never changed.
                // Our own writes arrive here already in agreement.
                const el = e.currentTarget as HTMLDetailsElement;
                if (e.target !== el || el.open === state.value) return;
                if (!props.disabled) state.value = el.open;
                if (el.open !== state.value) el.open = state.value;
            }}
        >
            {slots.default?.()}
        </details>
    );
}, { name: 'Collapsible.Root' });

// ── Trigger ──

export type CollapsibleTriggerProps =
    & WithClass
    /** Not `id`: the Panel's `aria-labelledby` points at the Trigger's own. */
    & Omit<WithHtmlAttrs, 'id'>
    /**
     * Non-native mode only (`native={false}` on the Root): render through
     * the slot. The native `<summary>` must be the `<details>`' first child,
     * so it cannot be another element — asChild there throws.
     */
    & WithAsChild
    /**
     * Non-native mode only: another zero part's asChild bag (#452) — an
     * outer tooltip's trigger lent to this one, whose own bag is then lent
     * on to a `Button.Root`. Throws in native mode, like `asChild`.
     */
    & WithLend
    & Define.Slot<'default', PartProps>;

const CollapsibleTrigger = component<CollapsibleTriggerProps>(({ props, slots, signal }) => {
    const ctx = useCollapsibleContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        owner: { scope: SCOPE, part: 'trigger' },
        getElement: () => el,
        isDisabled: () => ctx.disabled(),
    });
    const toggle = (): void => {
        if (!ctx.disabled()) ctx.state.value = !ctx.state.value;
    };

    if (ctx.native()) {
        return () => {
            if (props.asChild || props.lend) {
                throw new Error('[zero] Collapsible.Trigger: asChild and lend need <Collapsible.Root native={false}> — a native <summary> must be its <details>\' first child, so it cannot render as (or inside) another element');
            }
            return (
                <summary
                    {...htmlAttrs(props)}
                    id={ctx.ids.trigger}
                    data-scope={SCOPE}
                    data-part="trigger"
                    data-state={stateAttr(ctx.state.value, 'open', 'closed')}
                    data-disabled={dataAttr(ctx.disabled())}
                    data-focus-visible={dataAttr(focus.visible)}
                    // Native <summary> conveys expansion in most ATs; the explicit
                    // wiring covers the rest, and <summary> has no disabled
                    // attribute, so aria-disabled is the only announcement it gets.
                    aria-expanded={ctx.state.value ? 'true' : 'false'}
                    aria-controls={ctx.ids.panel}
                    aria-disabled={ctx.disabled() ? 'true' : undefined}
                    class={props.class}
                    ref={(node: HTMLElement | null) => { el = node; }}
                    onClick={(e: MouseEvent) => {
                        // The model stays in charge: never let the platform toggle
                        // ahead of (or against) the bound state.
                        e.preventDefault();
                        toggle();
                    }}
                    onKeydown={press.onKeydown}
                    onKeyup={press.onKeyup}
                    onPointerdown={press.onPointerdown}
                    onPointerup={press.onPointerup}
                    onPointercancel={press.onPointercancel}
                    onPointerleave={press.onPointerleave}
                    onFocus={() => { focus.visible = isFocusVisible(el); }}
                    onBlur={(e: FocusEvent) => {
                        press.onBlur(e);
                        focus.visible = false;
                    }}
                >
                    {/* No bag: native mode has no asChild to hand one to. */}
                    {slots.default?.(undefined as never)}
                </summary>
            );
        };
    }

    // Non-native: a disclosure button (APG) — or, asChild, whatever the app
    // renders, lent on to another zero part if it likes.
    // One ref for the part's life: a ref that changed between renders is
    // patched as detach(null) + attach(el), which a host chaining this one
    // through `lend` would feel on every re-render.
    const setEl = (node: HTMLElement | null): void => { el = node; };
    const bag = (): PartProps => {
        const disabled = ctx.disabled();
        return mergePartProps(props.lend, {
            ...htmlAttrs(props),
            id: ctx.ids.trigger,
            'data-scope': SCOPE,
            'data-part': 'trigger',
            // In the bag so a lent class concatenates; kept off an asChild bag,
            // where the slot's element owns its class.
            ...(props.asChild ? {} : { class: props.class }),
            'data-state': stateAttr(ctx.state.value, 'open', 'closed'),
            'data-disabled': dataAttr(disabled),
            'data-focus-visible': dataAttr(focus.visible),
            'aria-expanded': ctx.state.value ? 'true' : 'false',
            'aria-controls': ctx.ids.panel,
            // The built-in <button> disables natively; an asChild element
            // is not, so the state is announced (and enforced below) by hand.
            'aria-disabled': disabled && props.asChild ? 'true' : undefined,
            onClick: toggle,
            onKeydown: (e: KeyboardEvent) => {
                press.onKeydown(e);
                // Keyboard activation where the platform will not synthesize
                // a click from this key (a span always, an anchor on Space) —
                // Toggle's rule. Where it will, ours stays out of the way or
                // the press toggles twice; a host that already handled the
                // key (`defaultPrevented`) owns it.
                if (!props.asChild || e.repeat || e.defaultPrevented) return;
                if ((e.key === 'Enter' || e.key === ' ') && !synthesizesClickFrom(e.currentTarget, e.key)) {
                    e.preventDefault();
                    toggle();
                }
            },
            onKeyup: press.onKeyup,
            onPointerdown: press.onPointerdown,
            onPointerup: press.onPointerup,
            onPointercancel: press.onPointercancel,
            onPointerleave: press.onPointerleave,
            onFocus: () => { focus.visible = isFocusVisible(el); },
            onBlur: (e: FocusEvent) => {
                press.onBlur(e);
                focus.visible = false;
            },
            ref: setEl,
        });
    };

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <button type="button" {...b} disabled={ctx.disabled()}>
                {slots.default?.(b)}
            </button>
        );
    };
}, { name: 'Collapsible.Trigger' });

// ── Panel ──

/**
 * Not `id`: the Trigger's `aria-controls` points at the Panel's own. An app
 * `aria-labelledby` joins the Trigger's.
 */
export type CollapsiblePanelProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const CollapsiblePanel = component<CollapsiblePanelProps>(({ props, slots, onMounted, onUnmounted }) => {
    const ctx = useCollapsibleContext();
    let el: HTMLElement | null = null;
    onUnmounted(() => ctx.presence.setPanel(null));

    // Non-native: find-in-page (and a text fragment) reveals an until-found
    // panel by itself — `beforematch` first, then the platform drops the
    // attribute. Adopt that into the model; a disabled root refuses, and the
    // attribute goes back once the platform is done (the vdom will not put
    // it back, its `hidden` prop never changed).
    // A plain listener: sigx's JSX has no `onBeforematch`, and nothing
    // reactive is created here.
    let unlisten: (() => void) | null = null;
    onMounted(() => {
        const node = el;
        if (ctx.native() || !node) return;
        const onBeforematch = (): void => {
            if (!ctx.disabled()) {
                ctx.state.value = true;
                return;
            }
            setTimeout(() => {
                if (!ctx.state.value && !ctx.presence.shown()) node.setAttribute('hidden', 'until-found');
            });
        };
        node.addEventListener('beforematch', onBeforematch);
        unlisten = () => node.removeEventListener('beforematch', onBeforematch);
    });
    onUnmounted(() => unlisten?.());

    return () => {
        const attrs = htmlAttrs(props);
        return (
            <div
                {...attrs}
                id={ctx.ids.panel}
                data-scope={SCOPE}
                data-part="panel"
                data-state={stateAttr(ctx.state.value, 'open', 'closed')}
                // No role: a disclosure's content is not a landmark (APG), but
                // the label keeps "whose content is this" inspectable.
                aria-labelledby={[ctx.ids.trigger, attrs['aria-labelledby']].filter(Boolean).join(' ')}
                // Non-native: hidden but findable while closed; shown while
                // open AND while the exit plays (#276), as native mode holds
                // the <details> open.
                hidden={ctx.native() || ctx.presence.shown() ? undefined : 'until-found'}
                class={props.class}
                ref={(node: HTMLElement | null) => {
                    el = node;
                    if (node) ctx.presence.setPanel(node);
                }}
            >
                {slots.default?.()}
            </div>
        );
    };
}, { name: 'Collapsible.Panel' });

// ── Indicator ──

/** Decorative: always `aria-hidden` — the trigger's `aria-expanded` carries the state. */
export type CollapsibleIndicatorProps = WithClass & Omit<WithHtmlAttrs, 'aria-hidden'> & Define.Slot<'default'>;

/**
 * The trigger's optional disclosure mark (#437): place it inside
 * `Collapsible.Trigger` and it mirrors the disclosure's `open|closed` — a
 * design system draws a chevron there and turns it. Zero renders an empty
 * span; children (an icon) are the app's own.
 */
const CollapsibleIndicator = component<CollapsibleIndicatorProps>(({ props, slots }) => {
    const ctx = useCollapsibleContext();
    return () => (
        <span
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="indicator"
            data-state={stateAttr(ctx.state.value, 'open', 'closed')}
            aria-hidden="true"
            class={props.class}
        >
            {slots.default?.()}
        </span>
    );
}, { name: 'Collapsible.Indicator' });

export const Collapsible = compound(CollapsibleRoot, {
    Root: CollapsibleRoot,
    Trigger: CollapsibleTrigger,
    Panel: CollapsiblePanel,
    Indicator: CollapsibleIndicator,
});
