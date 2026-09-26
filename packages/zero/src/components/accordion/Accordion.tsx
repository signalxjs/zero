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
 *
 * Keyboard (APG accordion): ArrowDown/ArrowUp — ArrowRight/ArrowLeft under
 * `orientation="horizontal"`, flipped in RTL — move focus between the enabled
 * triggers, wrapping unless `loop={false}`; Home/End jump to the first/last.
 * There is no roving tabindex: every trigger stays in the Tab sequence.
 *
 * Each panel is a `region` labelled by its trigger (`regions={false}` drops
 * the role — APG advises against regions once more than ~6 panels can be open
 * together, where the landmarks turn into noise). Panels publish their
 * measured size as `--accordion-panel-height` / `--accordion-panel-width`,
 * and a closing item stays `open` until its panel's exit animation has played
 * (`data-state` flips at once), so a close can animate (#276).
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, type ControllableState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { isRtl } from '../../behaviors/direction.js';
import { createDisclosurePresence, type DisclosurePresence } from '../../behaviors/disclosure-presence.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createListController, type ListController, type ListItem } from '../../behaviors/list.js';
import { mountScope } from '../../behaviors/mount-scope.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { createRovingKeydown } from '../../behaviors/roving.js';
import { dataAttr, stateAttr, type Orientation } from '../../contract/data-attrs.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { WithClass, WithDisabled, WithHtmlAttrs, WithOrientation, WithVariantAxes } from '../../contract/props.js';
import { accordionAnatomy } from './anatomy.js';

const SCOPE = accordionAnatomy.scope;

interface AccordionContext {
    isOpen(value: string): boolean;
    toggle(value: string): void;
    disabled(): boolean;
    orientation(): Orientation;
    regions(): boolean;
    triggers: ListController;
    keydown(e: KeyboardEvent, value: string): void;
}

const INERT: AccordionContext = {
    isOpen: () => false,
    toggle: () => {},
    disabled: () => false,
    orientation: () => 'vertical',
    regions: () => true,
    triggers: createListController(),
    keydown: () => {},
};

export const useAccordionContext = defineInjectable<AccordionContext>(() => INERT);

interface AccordionItemContext {
    value(): string;
    disabled(): boolean;
    ids: { trigger: string; panel: string };
    presence: DisclosurePresence;
}

const INERT_ITEM: AccordionItemContext = {
    value: () => '',
    disabled: () => false,
    ids: { trigger: 'zx-accordion-inert-trigger', panel: 'zx-accordion-inert-panel' },
    presence: createDisclosurePresence({ isOpen: () => false, prefix: '--accordion-panel' }),
};

const useAccordionItemContext = defineInjectable<AccordionItemContext>(() => INERT_ITEM);

// ── Root ──

export type AccordionRootProps =
    & Define.Model<string[]>
    & Define.Prop<'defaultValue', string[], false>
    & Define.Event<'valueChange', string[]>
    & Define.Prop<'multiple', boolean, false>
    & Define.Prop<'collapsible', boolean, false>
    /** Arrow keys wrap from the last trigger to the first (default true). */
    & Define.Prop<'loop', boolean, false>
    /**
     * Panels are `role="region"` landmarks labelled by their trigger
     * (default true). APG: turn it off when more than ~6 panels can be open
     * at once.
     */
    & Define.Prop<'regions', boolean, false>
    /** The triggers' arrow-key axis (default `vertical`). */
    & WithOrientation
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
    const orientation = (): Orientation => props.orientation ?? 'vertical';
    const triggers = createListController();
    let rootEl: HTMLElement | null = null;
    // Focus moves only; nothing activates on arrival (APG accordion).
    const keydown = createRovingKeydown({
        list: triggers,
        orientation,
        loop: () => props.loop ?? true,
        rtl: () => isRtl(rootEl),
        onMove: () => {},
    });

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
        orientation,
        regions: () => props.regions ?? true,
        triggers,
        keydown,
    };
    defineProvide(useAccordionContext, () => ctx);

    return () => (
        <div
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="root"
            data-orientation={orientation()}
            {...variantAttrs(props)}
            class={props.class}
            ref={(node: HTMLElement | null) => { rootEl = node; }}
        >
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

const AccordionItem = component<AccordionItemProps>(({ props, slots, onMounted, onUnmounted }) => {
    const accordion = useAccordionContext();
    const baseId = createId('zx-accordion-item');
    const presence = createDisclosurePresence({
        isOpen: () => accordion.isOpen(props.value),
        prefix: '--accordion-panel',
    });
    const itemCtx: AccordionItemContext = {
        value: () => props.value,
        disabled: () => !!props.disabled || accordion.disabled(),
        ids: { trigger: `${baseId}-trigger`, panel: `${baseId}-panel` },
        presence,
    };
    defineProvide(useAccordionItemContext, () => itemCtx);

    let el: HTMLDetailsElement | null = null;
    const scoped = mountScope();
    onMounted(() => scoped(() => presence.mount(el)));
    onUnmounted(() => presence.unmount());

    return () => (
        <details
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="item"
            data-state={stateAttr(accordion.isOpen(props.value), 'open', 'closed')}
            data-disabled={dataAttr(itemCtx.disabled())}
            // Open, or still playing the panel's exit (#276).
            open={presence.shown()}
            class={props.class}
            ref={(node: HTMLDetailsElement | null) => { el = node; }}
            onToggle={(e: Event) => {
                // The platform opens a closed <details> by itself for
                // find-in-page and fragment navigation (#166). Route that
                // through `toggle` like a click (single mode then closes the
                // others); if the model refuses (a disabled item or root, or
                // a toggle it rejects such as collapsible={false}), put the
                // element back — the vdom won't, since its `open` prop never
                // changed. Our own writes arrive here already in agreement.
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

/** Not `id`: the Panel's `aria-labelledby` points at the Trigger's own. */
export type AccordionTriggerProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const AccordionTrigger = component<AccordionTriggerProps>(({ props, slots, signal, onUnmounted }) => {
    const accordion = useAccordionContext();
    const item = useAccordionItemContext();
    let el: HTMLElement | null = null;
    const entry: ListItem = {
        id: item.ids.trigger,
        get value() { return item.value(); },
        disabled: () => item.disabled(),
        el: () => el,
        textValue: () => el?.textContent?.trim() ?? item.value(),
    };
    onUnmounted(accordion.triggers.register(entry));
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => item.disabled(),
    });

    return () => (
        <summary
            {...htmlAttrs(props)}
            id={item.ids.trigger}
            data-scope={SCOPE}
            data-part="trigger"
            data-state={stateAttr(accordion.isOpen(item.value()), 'open', 'closed')}
            data-orientation={accordion.orientation()}
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
            onKeydown={(e: KeyboardEvent) => {
                press.onKeydown(e);
                accordion.keydown(e, item.value());
            }}
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

/**
 * Not `id`: the Trigger's `aria-controls` points at the Panel's own. An app
 * `aria-labelledby` joins the Trigger's; an app `role` applies only under
 * `regions={false}`.
 */
export type AccordionPanelProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const AccordionPanel = component<AccordionPanelProps>(({ props, slots, onUnmounted }) => {
    const accordion = useAccordionContext();
    const item = useAccordionItemContext();
    onUnmounted(() => item.presence.setPanel(null));
    return () => {
        const attrs = htmlAttrs(props);
        return (
            <div
                {...attrs}
                id={item.ids.panel}
                data-scope={SCOPE}
                data-part="panel"
                data-state={stateAttr(accordion.isOpen(item.value()), 'open', 'closed')}
                role={accordion.regions() ? 'region' : (attrs.role as string | undefined)}
                aria-labelledby={[item.ids.trigger, attrs['aria-labelledby']].filter(Boolean).join(' ')}
                class={props.class}
                ref={(node: HTMLElement | null) => { if (node) item.presence.setPanel(node); }}
            >
                {slots.default?.()}
            </div>
        );
    };
}, { name: 'Accordion.Panel' });

export const Accordion = compound(AccordionRoot, {
    Root: AccordionRoot,
    Item: AccordionItem,
    Trigger: AccordionTrigger,
    Panel: AccordionPanel,
});
