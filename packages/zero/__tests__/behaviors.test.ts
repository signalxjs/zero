import { describe, it, expect, vi } from 'vitest';
import {
    createAnchorPosition, createControllableState, createInertState, createListController, createRovingKeydown, derivedModel,
    fixedPositionStrategy, focusFirst, getTabbables, moveHighlight, pointAnchor, timingModifiers,
} from '@sigx/zero';
import type { ListItem, PositionAnchor } from '@sigx/zero';
import { isModel, signal } from 'sigx';
import { createModel } from '@sigx/runtime-core';

describe('createControllableState', () => {
    it('uncontrolled: internal state + change callback', () => {
        const onChange = vi.fn();
        const state = createControllableState<string>(() => undefined, 'a', onChange);
        expect(state.value).toBe('a');
        state.value = 'b';
        expect(state.value).toBe('b');
        expect(onChange).toHaveBeenCalledWith('b');
    });

    it('same-value writes do not fire onChange', () => {
        const onChange = vi.fn();
        const state = createControllableState<string>(() => undefined, 'a', onChange);
        state.value = 'a';
        expect(onChange).not.toHaveBeenCalled();
    });

    it('controlled: the model is the source of truth', () => {
        const backing = signal({ open: false });
        const model = createModel<boolean>([backing, 'open'], (v) => { backing.open = v; });
        const onChange = vi.fn();
        const state = createControllableState<boolean>(() => model, false, onChange);

        state.value = true;
        expect(backing.open).toBe(true);
        expect(state.value).toBe(true);
        expect(onChange).toHaveBeenCalledWith(true);

        backing.open = false;
        expect(state.value).toBe(false);
    });
});

describe('the binding law: derivedModel is a Model over a read/write pair', () => {
    it('reads through read, writes through write on both of sigx\'s routes', () => {
        let backing = 10;
        const writes: number[] = [];
        const m = derivedModel<number>(() => backing, (v) => { writes.push(v); backing = Math.min(v, 100); });
        expect(isModel(m)).toBe(true);
        expect(m.value).toBe(10);
        // The handler route (a component boundary) …
        m.value = 150;
        expect(backing).toBe(100);
        // … and the processor's direct tuple write (an intrinsic element).
        const [obj, key] = m.binding;
        (obj as Record<string, number>)[key] = 42;
        expect(backing).toBe(42);
        expect(writes).toEqual([150, 42]);
    });
});

describe('the binding law: createControllableState returns a real sigx Model', () => {
    it('is a Model — forwardable to a native control with model=', () => {
        const state = createControllableState<string>(() => undefined, 'a');
        expect(isModel(state)).toBe(true);
        // The platform processor writes the binding tuple directly
        // (obj[key] = v, never the handler); that path must be the same
        // write as the handler's, or a forwarded state would split in two.
        const [obj, key] = state.binding;
        (obj as Record<string, string>)[key] = 'b';
        expect(state.value).toBe('b');
    });

    it('controlled: the tuple write reaches the parent model and fires onChange once', () => {
        const backing = signal({ v: 'a' });
        const model = createModel<string>([backing, 'v'], (v) => { backing.v = v; });
        const onChange = vi.fn();
        const state = createControllableState<string>(() => model, '', onChange);
        const [obj, key] = state.binding;
        (obj as Record<string, string>)[key] = 'z';
        expect(backing.v).toBe('z');
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('z');
    });

    it('uncontrolled: value transforms from modelModifiers apply once, and onChange sees the result', () => {
        const onChange = vi.fn();
        const state = createControllableState<string>(() => undefined, '', onChange, {
            modifiers: () => ({ trim: true }),
        });
        state.value = '  hi  ';
        expect(state.value).toBe('hi');
        expect(onChange).toHaveBeenCalledWith('hi');
        // Trimmed equals trimmed — the same-value guard sees post-transform.
        state.value = ' hi ';
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('createInertState is a standalone Model', () => {
        const inert = createInertState<number>(3);
        expect(isModel(inert)).toBe(true);
        inert.value = 4;
        expect(inert.value).toBe(4);
    });

    it('timingModifiers forwards only the timing keys, by registry lookup', () => {
        expect(timingModifiers({ trim: true, lazy: true, debounce: 200 })).toEqual({ lazy: true, debounce: 200 });
        expect(timingModifiers({ trim: true, number: true })).toBeUndefined();
        expect(timingModifiers({ lazy: false })).toBeUndefined();
        // `0` is a value, not absence — the same test sigx applies.
        expect(timingModifiers({ debounce: 0 })).toEqual({ debounce: 0 });
        expect(timingModifiers(undefined)).toBeUndefined();
    });
});

function fakeItem(value: string, disabled = false): ListItem & { focused: boolean } {
    const el = document.createElement('button');
    document.body.appendChild(el);
    const item = {
        id: value,
        value,
        disabled: () => disabled,
        el: () => el,
        textValue: () => value,
        focused: false,
    };
    el.focus = () => { item.focused = true; };
    return item;
}

describe('createListController', () => {
    it('registers, unregisters and filters disabled', () => {
        const list = createListController();
        const un = list.register(fakeItem('a'));
        list.register(fakeItem('b', true));
        list.register(fakeItem('c'));
        expect(list.items().map((i) => i.value)).toEqual(['a', 'b', 'c']);
        expect(list.enabledItems().map((i) => i.value)).toEqual(['a', 'c']);
        un();
        expect(list.items().map((i) => i.value)).toEqual(['b', 'c']);
    });

    it('DISCONNECTED elements keep registration order — created is not mounted', () => {
        // The #339 regression pin: during the first render pass an item's
        // element exists before the tree is attached, and
        // compareDocumentPosition across two disconnected nodes is
        // implementation-defined. Steps' indicator was the first reader to
        // evaluate order in that window and derived phases from the
        // arbitrary answer. Detached elements must take the same
        // registration-order fallback as absent ones.
        const list = createListController();
        const els = ['a', 'b', 'c'].map(() => document.createElement('button'));
        ['a', 'b', 'c'].forEach((value, i) => {
            const item = fakeItem(value);
            item.el = () => els[i]!;
            list.register(item);
        });
        expect(list.items().map((i) => i.value)).toEqual(['a', 'b', 'c']);

        // Once attached — in REVERSE document order — DOM order wins.
        const host = document.createElement('div');
        document.body.appendChild(host);
        host.append(els[2]!, els[1]!, els[0]!);
        expect(list.items().map((i) => i.value)).toEqual(['c', 'b', 'a']);
        host.remove();
    });
});

describe('createRovingKeydown', () => {
    function setup() {
        const list = createListController();
        const items = [fakeItem('a'), fakeItem('b', true), fakeItem('c')];
        for (const i of items) list.register(i);
        const moves: string[] = [];
        const keydown = createRovingKeydown({
            list,
            orientation: () => 'horizontal',
            onMove: (item) => moves.push(item.value),
        });
        return { items, moves, keydown };
    }

    const key = (k: string) => new KeyboardEvent('keydown', { key: k, cancelable: true });

    it('ArrowRight skips disabled items', () => {
        const { items, moves, keydown } = setup();
        keydown(key('ArrowRight'), 'a');
        expect(moves).toEqual(['c']);
        expect(items[2]!.focused).toBe(true);
    });

    it('wraps around by default', () => {
        const { moves, keydown } = setup();
        keydown(key('ArrowRight'), 'c');
        expect(moves).toEqual(['a']);
    });

    it('Home and End jump to edges', () => {
        const { moves, keydown } = setup();
        keydown(key('End'), 'a');
        keydown(key('Home'), 'c');
        expect(moves).toEqual(['c', 'a']);
    });

    it('vertical orientation ignores horizontal arrows', () => {
        const list = createListController();
        list.register(fakeItem('a'));
        list.register(fakeItem('b'));
        const moves: string[] = [];
        const keydown = createRovingKeydown({
            list,
            orientation: () => 'vertical',
            onMove: (i) => moves.push(i.value),
        });
        keydown(key('ArrowRight'), 'a');
        expect(moves).toEqual([]);
        keydown(key('ArrowDown'), 'a');
        expect(moves).toEqual(['b']);
    });
});

/** A floating element with a mocked layout size (happy-dom does no layout). */
function fakeFloating(width: number, height: number): HTMLElement {
    const el = document.createElement('div');
    Object.defineProperty(el, 'offsetWidth', { value: width });
    Object.defineProperty(el, 'offsetHeight', { value: height });
    document.body.appendChild(el);
    return el;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('pointAnchor', () => {
    it('reports a zero-size rect at the point', () => {
        const rect = pointAnchor(120, 45).getBoundingClientRect();
        expect(rect.left).toBe(120);
        expect(rect.top).toBe(45);
        expect(rect.width).toBe(0);
        expect(rect.height).toBe(0);
        expect(rect.right).toBe(120);
        expect(rect.bottom).toBe(45);
    });

    it('supports a square virtual size', () => {
        const rect = pointAnchor(10, 20, 4).getBoundingClientRect();
        expect(rect.width).toBe(4);
        expect(rect.right).toBe(14);
        expect(rect.bottom).toBe(24);
    });
});

describe('fixedPositionStrategy with a virtual anchor', () => {
    it('places bottom-start off the point', () => {
        const floating = fakeFloating(100, 40);
        const cleanup = fixedPositionStrategy.apply(pointAnchor(200, 100), floating, {
            placement: 'bottom-start', offset: 2, flip: true,
        });
        expect(floating.style.position).toBe('fixed');
        expect(floating.style.left).toBe('200px');
        expect(floating.style.top).toBe('102px');
        expect(floating.getAttribute('data-placement')).toBe('bottom-start');
        cleanup();
    });

    it('flips to the opposite side at the viewport edge', () => {
        const floating = fakeFloating(100, 40);
        const y = window.innerHeight - 10;
        const cleanup = fixedPositionStrategy.apply(pointAnchor(200, y), floating, {
            placement: 'bottom-start', offset: 2, flip: true,
        });
        expect(floating.getAttribute('data-placement')).toBe('top-start');
        expect(floating.style.top).toBe(`${y - 40 - 2}px`);
        cleanup();
    });
});

describe('createAnchorPosition handle', () => {
    it('update() repositions against a moved virtual anchor without a close/reopen', async () => {
        const state = signal({ open: false });
        let anchor: PositionAnchor = pointAnchor(50, 50);
        const floating = fakeFloating(100, 40);

        const handle = createAnchorPosition({
            getAnchor: () => anchor,
            getFloating: () => floating,
            isOpen: () => state.open,
            placement: () => 'bottom-start',
            offset: () => 2,
        });

        // No-op while closed.
        handle.update();
        expect(floating.style.top).toBe('');

        state.open = true;
        await tick();
        expect(floating.style.top).toBe('52px');
        expect(floating.style.left).toBe('50px');

        anchor = pointAnchor(300, 200);
        handle.update();
        expect(floating.style.top).toBe('202px');
        expect(floating.style.left).toBe('300px');

        // The microtask window: the model has flipped closed but the watch
        // cleanup hasn't flushed — update() must already be inert.
        state.open = false;
        anchor = pointAnchor(500, 400);
        handle.update();
        expect(floating.style.left).toBe('300px');

        await tick();
        // Closed and flushed: still inert.
        anchor = pointAnchor(400, 300);
        handle.update();
        expect(floating.style.left).toBe('300px');
    });
});

describe('getTabbables / focusFirst', () => {
    function fixture(html: string): HTMLElement {
        const c = document.createElement('div');
        c.innerHTML = html;
        document.body.appendChild(c);
        return c;
    }

    it('finds tabbable descendants in DOM order, skipping the untabbable', () => {
        const c = fixture(`
            <span>text</span>
            <button disabled>disabled</button>
            <input type="hidden">
            <a>anchor without href</a>
            <button hidden>hidden</button>
            <div tabindex="-1">opted out</div>
            <a href="#x">link</a>
            <input type="text">
            <div tabindex="0">stop</div>
        `);
        expect(getTabbables(c).map((el) => el.tagName)).toEqual(['A', 'INPUT', 'DIV']);
    });

    it('focusFirst focuses the first tabbable', () => {
        const c = fixture('<button>first</button><button>second</button>');
        focusFirst(c);
        expect(document.activeElement).toBe(c.querySelector('button'));
    });

    it('focusFirst falls back to the container itself when nothing is tabbable', () => {
        const c = fixture('<span>text only</span>');
        c.tabIndex = -1;
        focusFirst(c);
        expect(document.activeElement).toBe(c);
    });

    it('focusFirst tolerates null', () => {
        expect(() => focusFirst(null)).not.toThrow();
    });
});

describe('moveHighlight', () => {
    function listOf(...values: string[]) {
        const list = createListController();
        for (const value of values) {
            list.register(fakeItem(value, value.startsWith('!')));
        }
        return list;
    }

    it('steps through enabled items, clamping at the edges (no wrap)', () => {
        const list = listOf('a', '!b', 'c');
        const highlighted = { value: null as string | null };
        moveHighlight(list, highlighted, 1);
        expect(highlighted.value).toBe('a');
        moveHighlight(list, highlighted, 1);
        expect(highlighted.value).toBe('c'); // b is disabled
        moveHighlight(list, highlighted, 1);
        expect(highlighted.value).toBe('c'); // clamped, no wrap
        moveHighlight(list, highlighted, 'first');
        expect(highlighted.value).toBe('a');
        moveHighlight(list, highlighted, -1);
        expect(highlighted.value).toBe('a'); // clamped at the start
        moveHighlight(list, highlighted, 'last');
        expect(highlighted.value).toBe('c');
    });

    it('does nothing on an empty (or fully disabled) list', () => {
        const highlighted = { value: 'stale' as string | null };
        moveHighlight(listOf('!a'), highlighted, 1);
        expect(highlighted.value).toBe('stale');
    });
});
