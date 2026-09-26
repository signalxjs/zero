import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Tabs, tabsAnatomy, type PartProps } from '@sigx/zero';
import { expectAnatomy } from './helpers';

function mountTabs(container: HTMLElement, extra: { defaultValue?: string } = {}) {
    render(
        <Tabs.Root defaultValue={extra.defaultValue ?? 'a'}>
            <Tabs.List>
                <Tabs.Tab value="a">First</Tabs.Tab>
                <Tabs.Tab value="b">Second</Tabs.Tab>
                <Tabs.Tab value="c" disabled>Third</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="a">Panel A</Tabs.Panel>
            <Tabs.Panel value="b">Panel B</Tabs.Panel>
        </Tabs.Root>,
        container,
    );
}

describe('Tabs', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy', () => {
        mountTabs(container);
        expectAnatomy(container, tabsAnatomy);
    });

    it('wires the APG tablist pattern', () => {
        mountTabs(container);
        const list = container.querySelector('[data-part="list"]')!;
        expect(list.getAttribute('role')).toBe('tablist');

        const tabA = container.querySelector<HTMLElement>('[data-part="tab"][data-state="active"]')!;
        expect(tabA.getAttribute('role')).toBe('tab');
        expect(tabA.getAttribute('aria-selected')).toBe('true');
        expect(tabA.tabIndex).toBe(0);

        const panelA = document.getElementById(tabA.getAttribute('aria-controls')!)!;
        expect(panelA.getAttribute('role')).toBe('tabpanel');
        expect(panelA.getAttribute('aria-labelledby')).toBe(tabA.id);
        expect(panelA.hasAttribute('hidden')).toBe(false);

        const tabB = container.querySelectorAll<HTMLElement>('[data-part="tab"]')[1]!;
        expect(tabB.getAttribute('aria-selected')).toBe('false');
        expect(tabB.tabIndex).toBe(-1);
        const panelB = document.getElementById(tabB.getAttribute('aria-controls')!)!;
        expect(panelB.hasAttribute('hidden')).toBe(true);
    });

    it('click selects a tab and toggles panels', () => {
        mountTabs(container);
        const tabB = container.querySelectorAll<HTMLElement>('[data-part="tab"]')[1]!;
        tabB.click();
        expect(tabB.getAttribute('data-state')).toBe('active');
        expect(tabB.getAttribute('aria-selected')).toBe('true');
        const panels = container.querySelectorAll<HTMLElement>('[data-part="panel"]');
        expect(panels[0]!.hasAttribute('hidden')).toBe(true);
        expect(panels[1]!.hasAttribute('hidden')).toBe(false);
    });

    it('disabled tabs carry the flag and do not select', () => {
        mountTabs(container);
        const tabC = container.querySelectorAll<HTMLElement>('[data-part="tab"]')[2]!;
        expect(tabC.getAttribute('data-disabled')).toBe('');
        tabC.click();
        expect(tabC.getAttribute('data-state')).toBe('inactive');
    });

    it('arrow keys rove and (automatic mode) select, skipping disabled', () => {
        mountTabs(container);
        const tabs = container.querySelectorAll<HTMLElement>('[data-part="tab"]');
        tabs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        expect(tabs[1]!.getAttribute('data-state')).toBe('active');
        // From b, ArrowRight skips disabled c and wraps to a.
        tabs[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        expect(tabs[0]!.getAttribute('data-state')).toBe('active');
    });

    it('two-way model binding', () => {
        const state = signal({ tab: 'a' });
        render(
            <Tabs.Root model={[state, 'tab']}>
                <Tabs.List>
                    <Tabs.Tab value="a">First</Tabs.Tab>
                    <Tabs.Tab value="b">Second</Tabs.Tab>
                </Tabs.List>
            </Tabs.Root>,
            container,
        );
        const tabs = container.querySelectorAll<HTMLElement>('[data-part="tab"]');
        tabs[1]!.click();
        expect(state.tab).toBe('b');
        state.tab = 'a';
        expect(tabs[0]!.getAttribute('data-state')).toBe('active');
    });

    it('publishes press feedback on a tab press and release', () => {
        mountTabs(container);
        const tab = container.querySelector<HTMLElement>('[data-scope="tabs"][data-part="tab"]')!;
        tab.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(tab.hasAttribute('data-pressed')).toBe(true);
        tab.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        expect(tab.hasAttribute('data-pressed')).toBe(false);
    });

    it('keyboard press feedback composes with roving selection', () => {
        mountTabs(container);
        const tabs = container.querySelectorAll<HTMLElement>('[data-part="tab"]');
        tabs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        expect(tabs[0]!.hasAttribute('data-pressed')).toBe(true);
        tabs[0]!.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
        expect(tabs[0]!.hasAttribute('data-pressed')).toBe(false);
        // Press runs first in the keydown chain — the roving keys must still
        // reach the tablist handler after it.
        tabs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        expect(tabs[1]!.getAttribute('data-state')).toBe('active');
    });

    it('publishes no press feedback on a disabled tab', () => {
        mountTabs(container);
        const tabC = container.querySelectorAll<HTMLElement>('[data-part="tab"]')[2]!;
        tabC.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(tabC.hasAttribute('data-pressed')).toBe(false);
    });

    it('asChild renders the caller element with the spread bag', () => {
        render(
            <Tabs.Root defaultValue="a">
                <Tabs.List>
                    <Tabs.Tab value="a" asChild>
                        {(p: PartProps) => <a href="#a" {...p}>Link tab</a>}
                    </Tabs.Tab>
                </Tabs.List>
            </Tabs.Root>,
            container,
        );
        const link = container.querySelector('a')!;
        expect(link.getAttribute('data-part')).toBe('tab');
        expect(link.getAttribute('role')).toBe('tab');
        expect(link.getAttribute('data-state')).toBe('active');
    });

    it('a disabled tab announces aria-disabled through the bag (asChild included)', () => {
        render(
            <Tabs.Root defaultValue="a">
                <Tabs.List>
                    <Tabs.Tab value="a">A</Tabs.Tab>
                    <Tabs.Tab value="b" disabled asChild>
                        {(p: PartProps) => <a href="#b" {...p}>Link tab</a>}
                    </Tabs.Tab>
                </Tabs.List>
            </Tabs.Root>,
            container,
        );
        // An <a> has no disabled attribute — without aria-disabled in the
        // bag, an asChild consumer's disabled tab announces as a normal one.
        const link = container.querySelector('a')!;
        expect(link.getAttribute('aria-disabled')).toBe('true');
        const enabled = container.querySelector<HTMLElement>('[data-part="tab"]')!;
        expect(enabled.hasAttribute('aria-disabled')).toBe(false);
    });
    it('values with whitespace still wire resolvable IDREFS (#164)', () => {
        render(
            <Tabs.Root defaultValue="New York">
                <Tabs.List aria-label="Cities">
                    <Tabs.Tab value="New York">NY</Tabs.Tab>
                    <Tabs.Tab value="New_York">NY (underscore)</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="New York">ny</Tabs.Panel>
                <Tabs.Panel value="New_York">ny2</Tabs.Panel>
            </Tabs.Root>,
            container,
        );
        const tabs = container.querySelectorAll<HTMLElement>('[role="tab"]');
        const panels = container.querySelectorAll<HTMLElement>('[role="tabpanel"]');
        // aria-controls / aria-labelledby are IDREFS — whitespace splits them.
        const resolve = (refs: string) => refs.split(/\s+/).map((t) => document.getElementById(t));
        for (const [i, tab] of [...tabs].entries()) {
            expect(tab.id).not.toMatch(/\s/);
            expect(resolve(tab.getAttribute('aria-controls')!)).toEqual([panels[i]]);
            expect(resolve(panels[i]!.getAttribute('aria-labelledby')!)).toEqual([tab]);
        }
        // The encoding is injective: 'New York' and 'New_York' never collide.
        expect(tabs[0]!.id).not.toBe(tabs[1]!.id);
    });
});

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

/** Lay the list and its tabs out by hand: happy-dom has no layout. */
function layout(boxes: (el: Element) => { left: number; top: number; width: number; height: number } | null) {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const b = boxes(this) ?? { left: 0, top: 0, width: 0, height: 0 };
        return { ...b, x: b.left, y: b.top, right: b.left + b.width, bottom: b.top + b.height, toJSON: () => b } as DOMRect;
    });
    vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
        return (boxes(this) ? [this.getBoundingClientRect()] : []) as unknown as DOMRectList;
    });
}

describe('Tabs.Indicator (#283)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        vi.restoreAllMocks();
        container.remove();
    });

    // A list at (10, 20); First at +2..+82, Second at +90..+180, both 36 tall
    // and 2px down from the list's top.
    const boxes = (el: Element) => {
        const part = el.getAttribute('data-part');
        if (part === 'list') return { left: 10, top: 20, width: 300, height: 40 };
        if (part !== 'tab') return null;
        return el.textContent === 'First'
            ? { left: 12, top: 22, width: 80, height: 36 }
            : { left: 100, top: 22, width: 90, height: 36 };
    };

    const mount = async (props: { defaultValue?: string; dir?: 'rtl' } = {}) => {
        if (props.dir) container.style.direction = props.dir;
        render(
        <Tabs.Root defaultValue={props.defaultValue ?? 'a'}>
            <Tabs.List>
                <Tabs.Tab value="a">First</Tabs.Tab>
                <Tabs.Tab value="b">Second</Tabs.Tab>
                <Tabs.Indicator />
            </Tabs.List>
            <Tabs.Panel value="a">Panel A</Tabs.Panel>
            <Tabs.Panel value="b">Panel B</Tabs.Panel>
        </Tabs.Root>,
        container,
        );
        await frame();
    };
    const indicator = () => container.querySelector<HTMLElement>('[data-part="indicator"]')!;
    const vars = () => {
        const style = indicator().style;
        return ['inset-inline-start', 'inset-block-start', 'inline-size', 'block-size']
            .map((name) => style.getPropertyValue(`--tabs-indicator-${name}`));
    };

    it('renders a decorative span inside the list, with a valid anatomy', async () => {
        layout(boxes);
        await mount();
        expectAnatomy(container, tabsAnatomy);
        const el = indicator();
        expect(el.tagName).toBe('SPAN');
        expect(el.getAttribute('aria-hidden')).toBe('true');
        expect(el.getAttribute('data-orientation')).toBe('horizontal');
        expect(el.parentElement!.getAttribute('data-part')).toBe('list');
    });

    it('publishes the active tab\'s box relative to the list, and follows the value', async () => {
        layout(boxes);
        await mount();
        expect(vars()).toEqual(['2px', '2px', '80px', '36px']);
        expect(indicator().style.display).toBe('');

        container.querySelectorAll<HTMLElement>('[data-part="tab"]')[1]!.click();
        await frame();
        expect(vars()).toEqual(['90px', '2px', '90px', '36px']);
    });

    it('measures the inline offset from the inline-start edge under RTL', async () => {
        layout(boxes);
        await mount({ dir: 'rtl' });
        // The list's right edge is 310; First ends at 92 → 218px from it.
        expect(vars()).toEqual(['218px', '2px', '80px', '36px']);
    });

    it('is not displayed until it has something to measure', async () => {
        // Rendered but not yet measured (SSR's markup, the first render): the
        // element is out of the box tree, so no transition plays from nowhere.
        layout(() => null);
        const pending = mount();
        expect(indicator().style.display).toBe('none');
        expect(vars()).toEqual(['', '', '', '']);
        // A list with no layout (a hidden ancestor) stays that way.
        await pending;
        expect(indicator().style.display).toBe('none');
    });

    it('is not displayed when no tab is active', async () => {
        layout(boxes);
        await mount({ defaultValue: '' });
        expect(indicator().style.display).toBe('none');
    });
});

describe('Tabs lazyMount / unmountOnExit (#283)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => container.remove());

    const mount = (props: { lazyMount?: boolean; unmountOnExit?: boolean }) => render(
        <Tabs.Root defaultValue="a" {...props}>
            <Tabs.List>
                <Tabs.Tab value="a">First</Tabs.Tab>
                <Tabs.Tab value="b">Second</Tabs.Tab>
                <Tabs.Tab value="c">Third</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="a"><i>A</i></Tabs.Panel>
            <Tabs.Panel value="b"><i>B</i></Tabs.Panel>
            <Tabs.Panel value="c"><i>C</i></Tabs.Panel>
        </Tabs.Root>,
        container,
    );
    const panels = () => [...container.querySelectorAll<HTMLElement>('[data-part="panel"]')];
    const rendered = () => panels().map((p) => p.textContent);
    const select = (i: number) => container.querySelectorAll<HTMLElement>('[data-part="tab"]')[i]!.click();

    it('renders every panel\'s content by default', () => {
        mount({});
        expect(rendered()).toEqual(['A', 'B', 'C']);
    });

    it('lazyMount renders a panel\'s content once it has been active, then keeps it', () => {
        mount({ lazyMount: true });
        expect(rendered()).toEqual(['A', '', '']);
        select(1);
        expect(rendered()).toEqual(['A', 'B', '']);
        select(0);
        expect(rendered()).toEqual(['A', 'B', '']);
    });

    it('unmountOnExit renders only the active panel\'s content', () => {
        mount({ unmountOnExit: true });
        expect(rendered()).toEqual(['A', '', '']);
        select(2);
        expect(rendered()).toEqual(['', '', 'C']);
    });

    it('lazyMount with unmountOnExit behaves like unmountOnExit', () => {
        mount({ lazyMount: true, unmountOnExit: true });
        select(1);
        select(0);
        expect(rendered()).toEqual(['A', '', '']);
    });

    it('every panel element still renders, so no tab\'s aria-controls dangles', () => {
        mount({ lazyMount: true, unmountOnExit: true });
        expect(panels()).toHaveLength(3);
        for (const tab of container.querySelectorAll<HTMLElement>('[data-part="tab"]')) {
            expect(document.getElementById(tab.getAttribute('aria-controls')!)).not.toBeNull();
        }
        expectAnatomy(container, tabsAnatomy);
    });
});

