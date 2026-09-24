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
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { WithClass, WithDisabled, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { collapsibleAnatomy } from './anatomy.js';

const SCOPE = collapsibleAnatomy.scope;

interface CollapsibleContext {
    state: ControllableState<boolean>;
    disabled(): boolean;
    ids: { panel: string };
}

function makeInert(): CollapsibleContext {
    return {
        state: createInertState<boolean>(false),
        disabled: () => false,
        ids: { panel: 'zx-collapsible-inert-panel' },
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

const CollapsibleRoot = component<CollapsibleRootProps>(({ props, slots, emit }) => {
    const state = createControllableState<boolean>(
        () => props.model,
        props.defaultOpen ?? false,
        (v) => emit('openChange', v),
    );
    const baseId = createId('zx-collapsible');
    const ctx: CollapsibleContext = {
        state,
        disabled: () => !!props.disabled,
        ids: { panel: `${baseId}-panel` },
    };
    defineProvide(useCollapsibleContext, () => ctx);

    return () => (
        <details
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="root"
            data-state={stateAttr(state.value, 'open', 'closed')}
            data-disabled={dataAttr(props.disabled)}
            {...variantAttrs(props)}
            open={state.value}
            class={props.class}
            onToggle={(e: Event) => {
                // The platform opens a closed <details> by itself for
                // find-in-page and fragment navigation (#166). Adopt that
                // into the model; if the model refuses (disabled, or a
                // controlled parent that re-asserts), put the element back
                // — the vdom won't, since its `open` prop never changed.
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

export type CollapsibleTriggerProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

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

/** Not `id`: the Trigger's `aria-controls` points at the Panel's own. */
export type CollapsiblePanelProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const CollapsiblePanel = component<CollapsiblePanelProps>(({ props, slots }) => {
    const ctx = useCollapsibleContext();
    return () => (
        <div
            {...htmlAttrs(props)}
            id={ctx.ids.panel}
            data-scope={SCOPE}
            data-part="panel"
            data-state={stateAttr(ctx.state.value, 'open', 'closed')}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Collapsible.Panel' });

export const Collapsible = compound(CollapsibleRoot, {
    Root: CollapsibleRoot,
    Trigger: CollapsibleTrigger,
    Panel: CollapsiblePanel,
});
