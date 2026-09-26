import { defineInjectable, defineProvide } from 'sigx';
import { createInertState, type ControllableState } from '../../behaviors/controllable.js';
import type { ListController } from '../../behaviors/list.js';
import { createListController } from '../../behaviors/list.js';
import { createRovingTabStop, type RovingTabStop } from '../../behaviors/roving.js';
import type { Orientation } from '../../contract/data-attrs.js';

export type TabsActivationMode = 'automatic' | 'manual';

export interface TabsContext {
    state: ControllableState<string>;
    list: ListController;
    tabStop: RovingTabStop;
    orientation(): Orientation;
    activationMode(): TabsActivationMode;
    loop(): boolean;
    /** Root `lazyMount`: a panel renders its slot only once it has been active. */
    lazyMount(): boolean;
    /** Root `unmountOnExit`: an inactive panel drops its slot. */
    unmountOnExit(): boolean;
    tabId(value: string): string;
    panelId(value: string): string;
    keydown(e: KeyboardEvent, value: string): void;
}

function makeInertTabs(): TabsContext {
    const list = createListController();
    return {
        state: createInertState<string>(''),
        list,
        tabStop: createRovingTabStop(list),
        orientation: () => 'horizontal',
        activationMode: () => 'automatic',
        loop: () => true,
        lazyMount: () => false,
        unmountOnExit: () => false,
        tabId: (v) => `zx-tabs-inert-tab-${v}`,
        panelId: (v) => `zx-tabs-inert-panel-${v}`,
        keydown: () => {},
    };
}

/**
 * Inject the nearest `Tabs.Root` context. Outside any root this resolves to
 * an inert, non-shared context so a bare part still renders.
 */
export const useTabsContext = defineInjectable<TabsContext>(() => makeInertTabs());

/** Provide the context for the subtree. Call once from `Tabs.Root` setup. */
export function provideTabsContext(ctx: TabsContext): void {
    defineProvide(useTabsContext, () => ctx);
}
