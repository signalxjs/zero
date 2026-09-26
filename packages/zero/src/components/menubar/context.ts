/**
 * The seam between `Menubar.Root` and the `Menu.Root`s inside it.
 *
 * It lives apart from the bar component so Menu can read it without pulling
 * the bar into `@sigx/zero/menu`: a menu outside any bar sees the inert
 * fallback (`inert: true`) and behaves exactly as it always has.
 */
import { defineInjectable } from 'sigx';
import { createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createListController, type ListController } from '../../behaviors/list.js';
import { createRovingTabStop, type RovingTabStop } from '../../behaviors/roving.js';
import type { Orientation } from '../../contract/data-attrs.js';

export interface MenubarContext {
    /** True on the fallback — a `Menu.Root` outside any bar. */
    inert: boolean;
    /** The open menu's `value`, `''` while none is open. */
    state: ControllableState<string>;
    /** The bar's triggers, one per menu, DOM-ordered. */
    list: ListController;
    /** The one tab stop across the triggers. */
    tabStop: RovingTabStop;
    orientation(): Orientation;
    disabled(): boolean;
    /** The bar's reading direction — horizontal arrows flip under RTL. */
    rtl(): boolean;
    /** The rendered bar root — focus moving inside it is the bar's own business. */
    root(): HTMLElement | null;
    /** The trigger that last took focus: the bar's tab stop while it is enabled. */
    focused(): string;
    setFocused(value: string): void;
    /** Arrow/Home/End on a trigger: rove between the bar's triggers. */
    keydown(e: KeyboardEvent, value: string): void;
    /**
     * From inside an open menu: close it and open the adjacent one, focused
     * on its first item (the loop wraps; at an end without it, nothing moves).
     */
    step(from: string, delta: 1 | -1): void;
}

function makeInert(): MenubarContext {
    const list = createListController();
    return {
        inert: true,
        state: createInertState<string>(''),
        list,
        tabStop: createRovingTabStop(list),
        orientation: () => 'horizontal',
        disabled: () => false,
        rtl: () => false,
        root: () => null,
        focused: () => '',
        setFocused: () => {},
        keydown: () => {},
        step: () => {},
    };
}

export const useMenubarContext = defineInjectable<MenubarContext>(() => makeInert());

/** A fresh inert context — what `Menu.Root` hides the bar behind for its own subtree. */
export const inertMenubarContext = makeInert;
