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
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState } from '../../behaviors/controllable.js';
import { createListController, type ListItem } from '../../behaviors/list.js';
import { createRovingKeydown } from '../../behaviors/roving.js';
import { createId } from '../../behaviors/create-id.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr, type Orientation } from '../../contract/data-attrs.js';
import { variantAttrs } from '../../contract/props.js';
import { renderAsChild } from '../../contract/as-child.js';
import type { PartProps, WithAsChild, WithClass, WithDisabled, WithOrientation, WithVariantAxes } from '../../contract/props.js';
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
    & WithOrientation
    & WithVariantAxes<'tabs'>
    & WithClass
    & Define.Slot<'default'>;

const TabsRoot = component<TabsRootProps>(({ props, slots, emit }) => {
    const state = createControllableState<string>(
        () => props.model,
        props.defaultValue ?? '',
        (v) => emit('valueChange', v),
    );
    const list = createListController();
    const baseId = createId('zx-tabs');
    const orientation = (): Orientation => props.orientation ?? 'horizontal';
    const activationMode = (): TabsActivationMode => props.activationMode ?? 'automatic';

    const roving = createRovingKeydown({
        list,
        orientation,
        loop: () => props.loop ?? true,
        onMove(item: ListItem) {
            if (activationMode() === 'automatic') state.value = item.value;
        },
    });

    const ctx: TabsContext = {
        state,
        list,
        orientation,
        activationMode,
        loop: () => props.loop ?? true,
        tabId: (value) => `${baseId}-tab-${value}`,
        panelId: (value) => `${baseId}-panel-${value}`,
        keydown: roving,
    };
    provideTabsContext(ctx);

    return () => (
        <div
            data-scope={SCOPE}
            data-part="root"
            data-orientation={orientation()}
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Tabs.Root' });

// ── List ──

export type TabsListProps = WithClass & Define.Slot<'default'>;

const TabsList = component<TabsListProps>(({ props, slots }) => {
    const tabs = useTabsContext();
    return () => (
        <div
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
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const TabsTab = component<TabsTabProps>(({ props, slots, onUnmounted, signal }) => {
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
    onUnmounted(() => unregister());

    const isSelected = (): boolean => tabs.state.value === props.value;

    const select = () => {
        if (props.disabled) return;
        tabs.state.value = props.value;
    };

    const isTabbable = (): boolean => {
        if (isSelected()) return true;
        if (tabs.state.value !== '') return false;
        // No selection anywhere: the first enabled tab stays tabbable.
        return tabs.list.enabledItems()[0]?.value === props.value;
    };

    const bag = (): PartProps => ({
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
    & Define.Slot<'default'>;

const TabsPanel = component<TabsPanelProps>(({ props, slots }) => {
    const tabs = useTabsContext();
    const isSelected = (): boolean => tabs.state.value === props.value;

    return () => (
        <div
            id={tabs.panelId(props.value)}
            data-scope={SCOPE}
            data-part="panel"
            data-state={stateAttr(isSelected(), 'active', 'inactive')}
            data-orientation={tabs.orientation()}
            role="tabpanel"
            aria-labelledby={tabs.tabId(props.value)}
            hidden={!isSelected()}
            tabIndex={0}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Tabs.Panel' });

export const Tabs = compound(TabsRoot, {
    Root: TabsRoot,
    List: TabsList,
    Tab: TabsTab,
    Panel: TabsPanel,
});
