/**
 * Tabs — WAI-ARIA APG Tabs pattern, unstyled.
 *
 * ```tsx
 * <Tabs.Root model={() => state.tab} orientation="horizontal">
 *     <Tabs.List>
 *         <Tabs.Tab value="a">First</Tabs.Tab>
 *         <Tabs.Tab value="b">Second</Tabs.Tab>
 *     </Tabs.List>
 *     <Tabs.Panel value="a">…</Tabs.Panel>
 *     <Tabs.Panel value="b">…</Tabs.Panel>
 * </Tabs.Root>
 * ```
 *
 * State: one default `model` (selected value). Uncontrolled via
 * `defaultValue`. Keyboard: arrow keys rove (orientation-aware), Home/End,
 * automatic or manual activation.
 *
 * `Tabs.Indicator` (optional, inside the list) publishes the active tab's
 * box as `--tabs-indicator-*` so a recipe can slide a mark between tabs;
 * root `lazyMount` / `unmountOnExit` defer or drop inactive panels' content
 * (#283).
 */
import { component, compound, effect } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState } from '../../behaviors/controllable.js';
import { createListController, type ListItem } from '../../behaviors/list.js';
import { createRovingKeydown, createRovingTabStop } from '../../behaviors/roving.js';
import { isRtl } from '../../behaviors/direction.js';
import { createId, idToken } from '../../behaviors/create-id.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr, type Orientation } from '../../contract/data-attrs.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import { renderAsChild } from '../../contract/as-child.js';
import { mountScope } from '../../behaviors/mount-scope.js';
import type { PartProps, WithAsChild, WithClass, WithDisabled, WithHtmlAttrs, WithOrientation, WithVariantAxes } from '../../contract/props.js';
import { tabsAnatomy } from './anatomy.js';
import { provideTabsContext, useTabsContext, type TabsActivationMode, type TabsContext } from './context.js';

const SCOPE = tabsAnatomy.scope;

// ── Root ──

export type TabsRootProps =
    & Define.Model<string>
    & Define.Prop<'defaultValue', string, false>
    & Define.Event<'valueChange', string>
    & Define.Prop<'activationMode', TabsActivationMode, false>
    & Define.Prop<'loop', boolean, false>
    /**
     * Render a panel's content only after its tab has been active once; it
     * then stays rendered. The panel element itself always renders, so a
     * tab's `aria-controls` never dangles.
     */
    & Define.Prop<'lazyMount', boolean, false>
    /**
     * Drop an inactive panel's content — rendered only while its tab is
     * active, so state inside a panel resets when it is left. The panel
     * element itself always renders.
     */
    & Define.Prop<'unmountOnExit', boolean, false>
    & WithOrientation
    & WithVariantAxes<'tabs'>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const TabsRoot = component<TabsRootProps>(({ props, slots, emit, onMounted }) => {
    const state = createControllableState<string>(
        () => props.model,
        props.defaultValue ?? '',
        (v) => emit('valueChange', v),
    );
    const list = createListController();
    const tabStop = createRovingTabStop(list);
    onMounted(() => tabStop.settle());
    let rootEl: HTMLElement | null = null;
    const baseId = createId('zx-tabs');
    const orientation = (): Orientation => props.orientation ?? 'horizontal';
    const activationMode = (): TabsActivationMode => props.activationMode ?? 'automatic';

    const roving = createRovingKeydown({
        list,
        orientation,
        loop: () => props.loop ?? true,
        rtl: () => isRtl(rootEl),
        onMove(item: ListItem) {
            if (activationMode() === 'automatic') state.value = item.value;
        },
    });

    const ctx: TabsContext = {
        state,
        list,
        tabStop,
        orientation,
        activationMode,
        loop: () => props.loop ?? true,
        lazyMount: () => !!props.lazyMount,
        unmountOnExit: () => !!props.unmountOnExit,
        tabId: (value) => `${baseId}-tab-${idToken(value)}`,
        panelId: (value) => `${baseId}-panel-${idToken(value)}`,
        keydown: roving,
    };
    provideTabsContext(ctx);

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
}, { name: 'Tabs.Root' });

// ── List ──

/** Not `role`: the list is the `tablist`. Name it with `aria-label`. */
export type TabsListProps = WithClass & Omit<WithHtmlAttrs, 'role'> & Define.Slot<'default'>;

const TabsList = component<TabsListProps>(({ props, slots }) => {
    const tabs = useTabsContext();
    return () => (
        <div
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="list"
            data-orientation={tabs.orientation()}
            role="tablist"
            aria-orientation={tabs.orientation()}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Tabs.List' });

// ── Tab ──

export type TabsTabProps =
    & Define.Prop<'value', string, true>
    & WithDisabled
    & WithClass
    /** Not `id` or `role`: the Panel is labelled by the `tab`'s own id. */
    & Omit<WithHtmlAttrs, 'id' | 'role'>
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const TabsTab = component<TabsTabProps>(({ props, slots, onMounted, onUnmounted, signal }) => {
    const tabs = useTabsContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => !!props.disabled,
    });

    const item: ListItem = {
        id: `tab-${props.value}`,
        get value() { return props.value; },
        disabled: () => !!props.disabled,
        el: () => el,
        textValue: () => el?.textContent?.trim() ?? props.value,
    };
    const unregister = tabs.list.register(item);
    onMounted(() => tabs.tabStop.changed());
    onUnmounted(() => {
        unregister();
        tabs.tabStop.changed();
    });

    const isSelected = (): boolean => tabs.state.value === props.value;

    const select = () => {
        if (props.disabled) return;
        tabs.state.value = props.value;
    };

    // One tab stop: the selected tab while it is registered and enabled,
    // else the first enabled tab (#165).
    const isTabbable = (): boolean => {
        const v = tabs.state.value;
        return tabs.tabStop.isTabStop(props.value, v !== '' ? [v] : []);
    };

    const bag = (): PartProps => ({
        ...htmlAttrs(props),
        id: tabs.tabId(props.value),
        'data-scope': SCOPE,
        'data-part': 'tab',
        'data-state': stateAttr(isSelected(), 'active', 'inactive'),
        'data-disabled': dataAttr(props.disabled),
        'data-focus-visible': dataAttr(focus.visible),
        'data-orientation': tabs.orientation(),
        role: 'tab',
        tabIndex: isTabbable() ? 0 : -1,
        'aria-selected': isSelected() ? 'true' : 'false',
        'aria-controls': tabs.panelId(props.value),
        // In the bag, not only the native `disabled` attribute — an asChild
        // consumer's element (an <a>) has no disabled attribute to announce.
        'aria-disabled': props.disabled ? 'true' : undefined,
        onClick: () => select(),
        onKeydown: (e: KeyboardEvent) => {
            press.onKeydown(e);
            tabs.keydown(e, props.value);
        },
        onKeyup: press.onKeyup,
        onFocus: () => {
            focus.visible = isFocusVisible(el);
            if (tabs.activationMode() === 'automatic') select();
        },
        onBlur: (e: FocusEvent) => {
            press.onBlur(e);
            focus.visible = false;
        },
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
}, { name: 'Tabs.Tab' });

// ── Panel ──

export type TabsPanelProps =
    & Define.Prop<'value', string, true>
    & WithClass
    /**
     * Not `id` or `role`: the Tab controls the `tabpanel`'s own id. An app
     * `aria-labelledby` joins the Tab's.
     */
    & Omit<WithHtmlAttrs, 'id' | 'role'>
    & Define.Slot<'default'>;

const TabsPanel = component<TabsPanelProps>(({ props, slots }) => {
    const tabs = useTabsContext();
    const isSelected = (): boolean => tabs.state.value === props.value;
    // Whether this panel has ever been active — what `lazyMount` keeps. Not
    // reactive state: it only changes on a render that `isSelected` drives.
    let visited = false;

    return () => {
        const attrs = htmlAttrs(props);
        const selected = isSelected();
        if (selected) visited = true;
        const content = selected || (!tabs.unmountOnExit() && (visited || !tabs.lazyMount()));
        return (
            <div
                {...attrs}
                id={tabs.panelId(props.value)}
                data-scope={SCOPE}
                data-part="panel"
                data-state={stateAttr(isSelected(), 'active', 'inactive')}
                data-orientation={tabs.orientation()}
                role="tabpanel"
                aria-labelledby={[tabs.tabId(props.value), attrs['aria-labelledby']].filter(Boolean).join(' ')}
                hidden={!isSelected()}
                tabIndex={0}
                class={props.class}
            >
                {content ? slots.default?.() : null}
            </div>
        );
    };
}, { name: 'Tabs.Panel' });

// ── Indicator ──

/** Always `aria-hidden`: the indicator is decoration; the tabs carry the semantics. */
export type TabsIndicatorProps = WithClass & WithHtmlAttrs;

/** The active tab's box in the list's content coordinates (px). */
interface IndicatorBox { inlineStart: number; blockStart: number; inlineSize: number; blockSize: number }

const LIST_SELECTOR = `[data-scope="${SCOPE}"][data-part="list"]`;

/**
 * The tab's layout box relative to the list's padding box, in the list's
 * scrolled content coordinates (so scrolling the list changes nothing), with
 * the inline offset taken from the list's inline-start edge — a recipe's
 * `inset-inline-start` then lands on the tab in both directions. A scale or
 * translate on the tab (a press or hover effect) is undone, so a value that
 * changes mid-press does not measure the pressed box.
 */
function measureTab(list: HTMLElement, tab: HTMLElement): IndicatorBox | null {
    if (tab.getClientRects().length === 0) return null;
    const lr = list.getBoundingClientRect();
    const tr = tab.getBoundingClientRect();
    let { left, top, width, height } = tr;
    const transform = getComputedStyle(tab).transform;
    if (transform && transform !== 'none' && typeof DOMMatrixReadOnly === 'function') {
        const m = new DOMMatrixReadOnly(transform);
        // A scale/translate about the default centre origin: the rect's
        // centre is the layout centre moved by the translation.
        if (m.b === 0 && m.c === 0 && m.a > 0 && m.d > 0) {
            const cx = left + width / 2 - m.e;
            const cy = top + height / 2 - m.f;
            width /= m.a;
            height /= m.d;
            left = cx - width / 2;
            top = cy - height / 2;
        }
    }
    const cs = getComputedStyle(list);
    const px = (v: string): number => parseFloat(v) || 0;
    const inlineStart = cs.direction === 'rtl'
        ? (lr.right - px(cs.borderRightWidth)) - (left + width) - list.scrollLeft
        : left - (lr.left + px(cs.borderLeftWidth)) + list.scrollLeft;
    const blockStart = top - (lr.top + px(cs.borderTopWidth)) + list.scrollTop;
    const round = (n: number): number => Math.round(n * 100) / 100;
    return { inlineStart: round(inlineStart), blockStart: round(blockStart), inlineSize: round(width), blockSize: round(height) };
}

const sameBox = (a: IndicatorBox | null, b: IndicatorBox | null): boolean =>
    a === b || (!!a && !!b && a.inlineStart === b.inlineStart && a.blockStart === b.blockStart
        && a.inlineSize === b.inlineSize && a.blockSize === b.blockSize);

const TabsIndicator = component<TabsIndicatorProps>(({ props, signal, onMounted, onUnmounted }) => {
    const tabs = useTabsContext();
    const state = signal<{ box: IndicatorBox | null }>({ box: null });
    let el: HTMLElement | null = null;
    let observer: ResizeObserver | null = null;
    const observed = new Set<Element>();
    let frame = 0;

    const measure = (): void => {
        const list = el?.closest<HTMLElement>(LIST_SELECTOR) ?? null;
        const value = tabs.state.value;
        const tab = value !== '' ? tabs.list.find(value)?.el() ?? null : null;
        if (observer) {
            // The list, and every tab: a sibling that changes size (a
            // bolder active label) moves the active tab without resizing it.
            const now = new Set<Element>(list ? [list, ...tabs.list.items().map((i) => i.el()).filter((e): e is HTMLElement => !!e)] : []);
            for (const node of observed) if (!now.has(node)) { observer.unobserve(node); observed.delete(node); }
            for (const node of now) if (!observed.has(node)) { observer.observe(node); observed.add(node); }
        }
        const box = list && tab?.isConnected && list.contains(tab) ? measureTab(list, tab) : null;
        if (!sameBox(box, state.box)) state.box = box;
    };
    // After the render the value change caused, and before that frame paints.
    const schedule = (): void => {
        if (frame) return;
        if (typeof requestAnimationFrame !== 'function') { measure(); return; }
        frame = requestAnimationFrame(() => { frame = 0; measure(); });
    };

    const scoped = mountScope();
    onMounted(() => scoped(() => {
        if (typeof ResizeObserver === 'function') observer = new ResizeObserver(() => measure());
        measure();
        effect(() => {
            void tabs.state.value;
            void tabs.orientation();
            schedule();
        });
    }));
    onUnmounted(() => {
        observer?.disconnect();
        observer = null;
        observed.clear();
        if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
        frame = 0;
    });

    return () => {
        const box = state.box;
        return (
            <span
                {...htmlAttrs(props)}
                data-scope={SCOPE}
                data-part="indicator"
                data-orientation={tabs.orientation()}
                aria-hidden="true"
                class={props.class}
                // Not displayed until measured, nor while no tab is active:
                // an element that was not rendered has no before-change
                // style, so a recipe's transition never plays from nowhere.
                style={box
                    ? {
                        '--tabs-indicator-inset-inline-start': `${box.inlineStart}px`,
                        '--tabs-indicator-inset-block-start': `${box.blockStart}px`,
                        '--tabs-indicator-inline-size': `${box.inlineSize}px`,
                        '--tabs-indicator-block-size': `${box.blockSize}px`,
                    }
                    : { display: 'none' }}
                ref={(node: HTMLElement | null) => { el = node; }}
            />
        );
    };
}, { name: 'Tabs.Indicator' });

export const Tabs = compound(TabsRoot, {
    Root: TabsRoot,
    List: TabsList,
    Tab: TabsTab,
    Indicator: TabsIndicator,
    Panel: TabsPanel,
});
