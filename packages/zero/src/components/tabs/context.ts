import { defineInjectable, defineProvide } from 'sigx';
import { createInertState, type ControllableState } from '../../behaviors/controllable.js';
import type { ListController } from '../../behaviors/list.js';
import { createListController } from '../../behaviors/list.js';
import type { Orientation } from '../../contract/data-attrs.js';

export type TabsActivationMode = 'automatic' | 'manual';

export interface TabsContext {
    state: ControllableState<string>;
    list: ListController;
    orientation(): Orientation;
    activationMode(): TabsActivationMode;
    loop(): boolean;
    tabId(value: string): string;
    panelId(value: string): string;
    keydown(e: KeyboardEvent, value: string): void;
}

function makeInertTabs(): TabsContext {
    return {
        state: createInertState<string>(''),
        list: createListController(),
        orientation: () => 'horizontal',
        activationMode: () => 'automatic',
        loop: () => true,
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
