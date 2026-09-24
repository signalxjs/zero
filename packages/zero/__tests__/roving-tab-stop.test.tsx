/**
 * #165 — the roving tab stop of Tabs, ToggleGroup and Steps survives a
 * value that names no enabled item (a typo, a removed item, a disabled
 * one), and Tabs/Steps flip horizontal arrows under `dir="rtl"` like
 * ToggleGroup and TreeView already did.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Steps, Tabs, ToggleGroup } from '@sigx/zero';

const tabIndexes = (c: HTMLElement, part: string): number[] =>
    [...c.querySelectorAll<HTMLElement>(`[data-part="${part}"]`)].map((el) => el.tabIndex);

/** Exactly one item is a tab stop, and it can actually take focus. */
function expectOneFocusableStop(c: HTMLElement, part: string): HTMLElement {
    const stops = [...c.querySelectorAll<HTMLElement>(`[data-part="${part}"]`)].filter((el) => el.tabIndex === 0);
    expect(stops).toHaveLength(1);
    const stop = stops[0]!;
    expect((stop as HTMLButtonElement).disabled).toBeFalsy();
    stop.focus();
    expect(document.activeElement).toBe(stop);
    return stop;
}

function press(el: HTMLElement, key: string) {
    el.focus();
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('roving tab stop (#165)', () => {
    let c: HTMLElement;
    beforeEach(() => {
        c = document.createElement('div');
        document.body.appendChild(c);
    });
    afterEach(() => {
        render(null as never, c);
        c.remove();
    });

    describe('a value that names no enabled item', () => {
        it('Tabs: an unknown value leaves the first enabled tab as the stop', () => {
            render(
                <Tabs.Root defaultValue="typo">
                    <Tabs.List aria-label="x">
                        <Tabs.Tab value="a" disabled>A</Tabs.Tab>
                        <Tabs.Tab value="b">B</Tabs.Tab>
                        <Tabs.Tab value="c">C</Tabs.Tab>
                    </Tabs.List>
                </Tabs.Root>,
                c,
            );
            expect(tabIndexes(c, 'tab')).toEqual([-1, 0, -1]);
            expect(expectOneFocusableStop(c, 'tab').textContent).toBe('B');
        });

        it('Tabs: a selected but disabled tab hands the stop to the first enabled tab', () => {
            render(
                <Tabs.Root defaultValue="a">
                    <Tabs.List aria-label="x">
                        <Tabs.Tab value="a" disabled>A</Tabs.Tab>
                        <Tabs.Tab value="b">B</Tabs.Tab>
                    </Tabs.List>
                </Tabs.Root>,
                c,
            );
            expect(tabIndexes(c, 'tab')).toEqual([-1, 0]);
            expectOneFocusableStop(c, 'tab');
        });

        it('Tabs: a selected tab that renders after the others still claims the stop alone', () => {
            render(
                <Tabs.Root defaultValue="c">
                    <Tabs.List aria-label="x">
                        <Tabs.Tab value="a">A</Tabs.Tab>
                        <Tabs.Tab value="b">B</Tabs.Tab>
                        <Tabs.Tab value="c">C</Tabs.Tab>
                    </Tabs.List>
                </Tabs.Root>,
                c,
            );
            expect(tabIndexes(c, 'tab')).toEqual([-1, -1, 0]);
        });

        it('Tabs: removing the selected tab moves the stop to the first enabled tab', () => {
            const show = signal({ c: true });
            render(
                <Tabs.Root defaultValue="c">
                    <Tabs.List aria-label="x">
                        <Tabs.Tab value="a">A</Tabs.Tab>
                        <Tabs.Tab value="b">B</Tabs.Tab>
                        {() => (show.c ? <Tabs.Tab value="c">C</Tabs.Tab> : null)}
                    </Tabs.List>
                </Tabs.Root>,
                c,
            );
            expect(tabIndexes(c, 'tab')).toEqual([-1, -1, 0]);
            show.c = false;
            expect(tabIndexes(c, 'tab')).toEqual([0, -1]);
        });

        it('Steps: an unknown current step leaves the first enabled item as the stop', () => {
            render(
                <Steps.Root defaultStep="typo" label="s">
                    <Steps.Item value="a">A</Steps.Item>
                    <Steps.Item value="b">B</Steps.Item>
                </Steps.Root>,
                c,
            );
            expect(tabIndexes(c, 'item')).toEqual([0, -1]);
            expectOneFocusableStop(c, 'item');
        });

        it('Steps: a disabled current step hands the stop to the first enabled item', () => {
            render(
                <Steps.Root defaultStep="a" label="s">
                    <Steps.Item value="a" disabled>A</Steps.Item>
                    <Steps.Item value="b">B</Steps.Item>
                </Steps.Root>,
                c,
            );
            expect(tabIndexes(c, 'item')).toEqual([-1, 0]);
            expectOneFocusableStop(c, 'item');
        });

        it('ToggleGroup: an unknown pressed value leaves the first enabled item as the stop', () => {
            render(
                <ToggleGroup.Root defaultValue={['typo']} multiple aria-label="t">
                    <ToggleGroup.Item value="a">A</ToggleGroup.Item>
                    <ToggleGroup.Item value="b">B</ToggleGroup.Item>
                </ToggleGroup.Root>,
                c,
            );
            expect(tabIndexes(c, 'item')).toEqual([0, -1]);
            expectOneFocusableStop(c, 'item');
        });

        it('ToggleGroup: a pressed but disabled item hands the stop to the first enabled item', () => {
            render(
                <ToggleGroup.Root defaultValue="a" aria-label="t">
                    <ToggleGroup.Item value="a" disabled>A</ToggleGroup.Item>
                    <ToggleGroup.Item value="b">B</ToggleGroup.Item>
                </ToggleGroup.Root>,
                c,
            );
            expect(tabIndexes(c, 'item')).toEqual([-1, 0]);
            expectOneFocusableStop(c, 'item');
        });
    });

    describe('dir="rtl" flips horizontal arrows', () => {
        beforeEach(() => {
            c.setAttribute('dir', 'rtl');
            c.style.direction = 'rtl';
        });

        it('Tabs: ArrowRight moves to the previous tab in DOM order (visually right)', () => {
            render(
                <Tabs.Root defaultValue="b">
                    <Tabs.List aria-label="x">
                        <Tabs.Tab value="a">A</Tabs.Tab>
                        <Tabs.Tab value="b">B</Tabs.Tab>
                        <Tabs.Tab value="c">C</Tabs.Tab>
                    </Tabs.List>
                </Tabs.Root>,
                c,
            );
            const tabs = c.querySelectorAll<HTMLElement>('[data-part="tab"]');
            press(tabs[1]!, 'ArrowRight');
            expect(document.activeElement).toBe(tabs[0]);
            press(tabs[0]!, 'ArrowLeft');
            expect(document.activeElement).toBe(tabs[1]);
        });

        it('Steps: ArrowRight moves to the previous item in DOM order (visually right)', () => {
            render(
                <Steps.Root defaultStep="b" label="s">
                    <Steps.Item value="a">A</Steps.Item>
                    <Steps.Item value="b">B</Steps.Item>
                    <Steps.Item value="c">C</Steps.Item>
                </Steps.Root>,
                c,
            );
            const items = c.querySelectorAll<HTMLElement>('[data-part="item"]');
            press(items[1]!, 'ArrowRight');
            expect(document.activeElement).toBe(items[0]);
            press(items[0]!, 'ArrowLeft');
            expect(document.activeElement).toBe(items[1]);
        });

        it('vertical orientation ignores direction', () => {
            render(
                <Tabs.Root defaultValue="a" orientation="vertical">
                    <Tabs.List aria-label="x">
                        <Tabs.Tab value="a">A</Tabs.Tab>
                        <Tabs.Tab value="b">B</Tabs.Tab>
                    </Tabs.List>
                </Tabs.Root>,
                c,
            );
            const tabs = c.querySelectorAll<HTMLElement>('[data-part="tab"]');
            press(tabs[0]!, 'ArrowDown');
            expect(document.activeElement).toBe(tabs[1]);
        });
    });
});
