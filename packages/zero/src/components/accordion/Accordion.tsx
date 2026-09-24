/**
 * Accordion — exclusive or multiple disclosure over native `<details>`.
 *
 * ```tsx
 * <Accordion.Root model={() => state.openItems} multiple>
 *     <Accordion.Item value="a">
 *         <Accordion.Trigger>Section A</Accordion.Trigger>
 *         <Accordion.Panel>…</Accordion.Panel>
 *     </Accordion.Item>
 * </Accordion.Root>
 * ```
 *
 * The model is `string[]` (open item values). Single mode (default) keeps
 * at most one open; `collapsible={false}` keeps at least one open. When the
 * browser opens an item itself (find-in-page, fragment navigation), the
 * native `toggle` event syncs back into the model.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, type ControllableState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { WithClass, WithDisabled, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { accordionAnatomy } from './anatomy.js';

const SCOPE = accordionAnatomy.scope;

interface AccordionContext {
    isOpen(value: string): boolean;
    toggle(value: string): void;
    disabled(): boolean;
}

const INERT: AccordionContext = {
    isOpen: () => false,
    toggle: () => {},
    disabled: () => false,
};

export const useAccordionContext = defineInjectable<AccordionContext>(() => INERT);

interface AccordionItemContext {
    value(): string;
    disabled(): boolean;
    ids: { panel: string };
}

const INERT_ITEM: AccordionItemContext = {
    value: () => '',
    disabled: () => false,
    ids: { panel: 'zx-accordion-inert-panel' },
};

const useAccordionItemContext = defineInjectable<AccordionItemContext>(() => INERT_ITEM);

// ── Root ──

export type AccordionRootProps =
    & Define.Model<string[]>
    & Define.Prop<'defaultValue', string[], false>
    & Define.Event<'valueChange', string[]>
    & Define.Prop<'multiple', boolean, false>
    & Define.Prop<'collapsible', boolean, false>
    & WithDisabled
    & WithVariantAxes<'accordion'>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const AccordionRoot = component<AccordionRootProps>(({ props, slots, emit }) => {
    const state: ControllableState<string[]> = createControllableState<string[]>(
        () => props.model,
        props.defaultValue ?? [],
        (v) => emit('valueChange', v),
    );

    const ctx: AccordionContext = {
        isOpen: (value) => state.value.includes(value),
        toggle(value) {
            const open = state.value;
            const isOpen = open.includes(value);
            if (isOpen) {
                if ((props.collapsible ?? true) === false && open.length === 1) return;
                state.value = open.filter((v) => v !== value);
            } else {
                state.value = props.multiple ? [...open, value] : [value];
            }
        },
        disabled: () => !!props.disabled,
    };
    defineProvide(useAccordionContext, () => ctx);

    return () => (
        <div {...htmlAttrs(props)} data-scope={SCOPE} data-part="root" {...variantAttrs(props)} class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'Accordion.Root' });

// ── Item ──

export type AccordionItemProps =
    & Define.Prop<'value', string, true>
    & WithDisabled
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const AccordionItem = component<AccordionItemProps>(({ props, slots }) => {
    const accordion = useAccordionContext();
    const baseId = createId('zx-accordion-item');
    const itemCtx: AccordionItemContext = {
        value: () => props.value,
        disabled: () => !!props.disabled || accordion.disabled(),
        ids: { panel: `${baseId}-panel` },
    };
    defineProvide(useAccordionItemContext, () => itemCtx);

    return () => (
        <details
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="item"
            data-state={stateAttr(accordion.isOpen(props.value), 'open', 'closed')}
            data-disabled={dataAttr(itemCtx.disabled())}
            open={accordion.isOpen(props.value)}
            class={props.class}
            onToggle={(e: Event) => {
                // The platform opens a closed <details> by itself for
                // find-in-page and fragment navigation (#166). Route that
                // through `toggle` like a click (single mode then closes the
                // others); if the model refuses (a disabled item or root,
                // a controlled parent that re-asserts), put the element back — the
                // vdom won't, since its `open` prop never changed. Our own
                // writes arrive here already in agreement.
                const el = e.currentTarget as HTMLDetailsElement;
                if (e.target !== el || el.open === accordion.isOpen(props.value)) return;
                if (!itemCtx.disabled()) accordion.toggle(props.value);
                const open = accordion.isOpen(props.value);
                if (el.open !== open) el.open = open;
            }}
        >
            {slots.default?.()}
        </details>
    );
}, { name: 'Accordion.Item' });

// ── Trigger ──

export type AccordionTriggerProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

const AccordionTrigger = component<AccordionTriggerProps>(({ props, slots, signal }) => {
    const accordion = useAccordionContext();
    const item = useAccordionItemContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => item.disabled(),
    });

    return () => (
        <summary
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="trigger"
            data-state={stateAttr(accordion.isOpen(item.value()), 'open', 'closed')}
            data-disabled={dataAttr(item.disabled())}
            data-focus-visible={dataAttr(focus.visible)}
            // Native <summary> conveys expansion in most ATs; the explicit
            // wiring covers the rest, and <summary> has no disabled
            // attribute, so aria-disabled is the only announcement it gets.
            aria-expanded={accordion.isOpen(item.value()) ? 'true' : 'false'}
            aria-controls={item.ids.panel}
            aria-disabled={item.disabled() ? 'true' : undefined}
            class={props.class}
            ref={(node: HTMLElement | null) => { el = node; }}
            onClick={(e: MouseEvent) => {
                e.preventDefault();
                if (!item.disabled()) accordion.toggle(item.value());
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
}, { name: 'Accordion.Trigger' });

// ── Panel ──

/** Not `id`: the Trigger's `aria-controls` points at the Panel's own. */
export type AccordionPanelProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const AccordionPanel = component<AccordionPanelProps>(({ props, slots }) => {
    const accordion = useAccordionContext();
    const item = useAccordionItemContext();
    return () => (
        <div
            {...htmlAttrs(props)}
            id={item.ids.panel}
            data-scope={SCOPE}
            data-part="panel"
            data-state={stateAttr(accordion.isOpen(item.value()), 'open', 'closed')}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Accordion.Panel' });

export const Accordion = compound(AccordionRoot, {
    Root: AccordionRoot,
    Item: AccordionItem,
    Trigger: AccordionTrigger,
    Panel: AccordionPanel,
});
