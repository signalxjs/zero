import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { createListController, createTypeahead, Menu, Select, TreeView } from '@sigx/zero';

/**
 * #173: a multi-character search must refine the CURRENT match rather than
 * step past it, a stale buffer must not turn Space into a search, and a
 * running search must be able to continue across a Space ("Save As") in
 * every component that routes Space to activation.
 */
const LABELS = ['Open', 'Save', 'Save As', 'Share'];

function setup() {
    const list = createListController();
    for (const t of LABELS) {
        list.register({ id: t, value: t, disabled: () => false, el: () => null, textValue: () => t });
    }
    let current: string | null = 'Open';
    const hits: string[] = [];
    const ta = createTypeahead({ list, onMatch: (i) => { current = i.value; hits.push(i.value); } });
    const type = (k: string) => {
        const e = new KeyboardEvent('keydown', { key: k, cancelable: true });
        ta(e, current);
        return e;
    };
    return { ta, type, hits, current: () => current };
}

// Press feedback leaves either flag behind: `data-pressed` until keyup or
// blur (the search moves focus on), `data-press-animating` until the effect
// ends — and happy-dom runs no animations, so it would linger.
const pressed = (el: Element) => el.hasAttribute('data-pressed') || el.hasAttribute('data-press-animating');

const keydown = (el: Element, k: string) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true }));

describe('createTypeahead', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(10_000); });
    afterEach(() => { vi.useRealTimers(); });

    it('a multi-character search stays on the item it refines (no bounce)', () => {
        const { type, hits } = setup();
        for (const c of 'sav') type(c);
        expect(hits).toEqual(['Save', 'Save', 'Save']);
    });

    it('the first character still steps past the current item', () => {
        const { type, hits } = setup();
        type('s');
        vi.advanceTimersByTime(1500);
        type('s');
        expect(hits).toEqual(['Save', 'Save As']);
    });

    it('a running search continues across Space', () => {
        const { type, hits, ta } = setup();
        expect(ta.searching()).toBe(false);
        for (const c of 'save') type(c);
        expect(ta.searching()).toBe(true);
        expect(type(' ').defaultPrevented).toBe(true);
        type('a');
        expect(hits.at(-1)).toBe('Save As');
    });

    it('a stale buffer does not turn Space into a search', () => {
        const { type, ta } = setup();
        type('s');
        vi.advanceTimersByTime(5000);
        expect(ta.searching()).toBe(false);
        const space = type(' ');
        expect(space.defaultPrevented).toBe(false);
        // The buffer was reset, not seeded with ' ': 's' searches afresh.
        expect(type('s').defaultPrevented).toBe(true);
    });
});

describe('typeahead across Space in components', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        render(null, container);
        container.remove();
    });

    it('Select (closed): "save a" lands on Save As instead of opening', () => {
        const state = signal({ v: '' });
        render(
            <Select.Root model={[state, 'v']}>
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Popup>
                    {LABELS.map((l) => <Select.Item value={l}>{l}</Select.Item>)}
                </Select.Popup>
            </Select.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        for (const c of 'sav') keydown(trigger, c);
        expect(state.v).toBe('Save');
        for (const c of 'e ') keydown(trigger, c);
        // The Space is search text: no press feedback on the trigger.
        expect(pressed(trigger)).toBe(false);
        keydown(trigger, 'a');
        expect(state.v).toBe('Save As');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('Menu: Space continues a running search rather than activating', async () => {
        const onSelect = vi.fn();
        render(
            <Menu.Root defaultOpen onSelect={onSelect}>
                <Menu.Trigger>File</Menu.Trigger>
                <Menu.Popup>
                    {LABELS.map((l) => <Menu.Item value={l}>{l}</Menu.Item>)}
                </Menu.Popup>
            </Menu.Root>,
            container,
        );
        await new Promise((r) => setTimeout(r, 0));
        const items = [...container.querySelectorAll<HTMLElement>('[data-part="item"]')];
        items[0]!.focus();
        for (const c of 'save ') keydown(document.activeElement!, c);
        // The Space is search text: no press feedback on the focused item.
        expect(pressed(items[1]!)).toBe(false);
        keydown(document.activeElement!, 'a');
        expect(onSelect).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(items[2]);
        // With no search running, Space activates.
        vi.useFakeTimers();
        try {
            vi.setSystemTime(Date.now() + 5000);
            keydown(document.activeElement!, ' ');
        } finally {
            vi.useRealTimers();
        }
        expect(onSelect).toHaveBeenCalledWith('Save As');
    });

    it('TreeView: Space continues a running search rather than selecting', () => {
        const state = signal({ v: '' });
        render(
            <TreeView.Root model={[state, 'v']}>
                <TreeView.Tree>
                    {LABELS.map((l) => <TreeView.Item value={l}>{l}</TreeView.Item>)}
                </TreeView.Tree>
            </TreeView.Root>,
            container,
        );
        const node = (v: string) =>
            [...container.querySelectorAll<HTMLElement>('[role="treeitem"]')].find((e) => e.textContent?.trim() === v)!;
        node('Open').focus();
        for (const c of 'save ') keydown(document.activeElement!, c);
        // The Space is search text: no press feedback on the focused node.
        expect(pressed(node('Save'))).toBe(false);
        keydown(document.activeElement!, 'a');
        expect(state.v).toBe('');
        expect(document.activeElement).toBe(node('Save As'));
    });
});
