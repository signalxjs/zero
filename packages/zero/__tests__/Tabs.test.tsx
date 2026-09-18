import { describe, it, expect, beforeEach } from 'vitest';
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
});
