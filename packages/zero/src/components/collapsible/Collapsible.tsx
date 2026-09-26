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
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { createDisclosurePresence, type DisclosurePresence } from '../../behaviors/disclosure-presence.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { mountScope } from '../../behaviors/mount-scope.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { WithClass, WithDisabled, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { collapsibleAnatomy } from './anatomy.js';

const SCOPE = collapsibleAnatomy.scope;

interface CollapsibleContext {
    state: ControllableState<boolean>;
    disabled(): boolean;
    ids: { trigger: string; panel: string };
    presence: DisclosurePresence;
}

function makeInert(): CollapsibleContext {
    return {
        state: createInertState<boolean>(false),
        disabled: () => false,
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
    const ctx: CollapsibleContext = {
        state,
        disabled: () => !!props.disabled,
        ids: { trigger: `${baseId}-trigger`, panel: `${baseId}-panel` },
        presence,
    };
    defineProvide(useCollapsibleContext, () => ctx);

    let el: HTMLDetailsElement | null = null;
    const scoped = mountScope();
    onMounted(() => scoped(() => presence.mount(el)));
    onUnmounted(() => presence.unmount());

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
            ref={(node: HTMLDetailsElement | null) => { el = node; }}
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

/** Not `id`: the Panel's `aria-labelledby` points at the Trigger's own. */
export type CollapsibleTriggerProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const CollapsibleTrigger = component<CollapsibleTriggerProps>(({ props, slots, signal }) => {
    const ctx = useCollapsibleContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => ctx.disabled(),
    });

    return () => (
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
                if (!ctx.disabled()) ctx.state.value = !ctx.state.value;
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
            {slots.default?.()}
        </summary>
    );
}, { name: 'Collapsible.Trigger' });

// ── Panel ──

/**
 * Not `id`: the Trigger's `aria-controls` points at the Panel's own. An app
 * `aria-labelledby` joins the Trigger's.
 */
export type CollapsiblePanelProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const CollapsiblePanel = component<CollapsiblePanelProps>(({ props, slots, onUnmounted }) => {
    const ctx = useCollapsibleContext();
    onUnmounted(() => ctx.presence.setPanel(null));
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
                class={props.class}
                ref={(node: HTMLElement | null) => { if (node) ctx.presence.setPanel(node); }}
            >
                {slots.default?.()}
            </div>
        );
    };
}, { name: 'Collapsible.Panel' });

export const Collapsible = compound(CollapsibleRoot, {
    Root: CollapsibleRoot,
    Trigger: CollapsibleTrigger,
    Panel: CollapsiblePanel,
});
