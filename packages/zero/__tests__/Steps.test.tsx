/**
 * Steps (#339) — the first-class promotion of the ext-stepper pattern.
 *
 * The behavior half (phase derivation, roving, one tab stop) mirrors the
 * ecosystem package's own suite deliberately: the promotion must not drift
 * from the pattern it promotes. What is NEW here is the richer anatomy
 * (indicator/separator/title/description bands), the states those bands
 * stamp, and orientation — none of which the ext scope carries.
 * `packages/zero-ext-example` REMAINS as the ecosystem acceptance test;
 * both READMEs record the relationship.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { Steps, stepsAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

const selector = (name: string) => `[data-scope="steps"][data-part="${name}"]`;

const items = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>(selector('item'))];

function mountSteps(container: HTMLElement, extra: { defaultStep?: string } = {}) {
    render(
        <Steps.Root defaultStep={extra.defaultStep ?? 'details'} label="Checkout">
            <Steps.Item value="cart">
                <Steps.Indicator>1</Steps.Indicator>
                <Steps.Title>Cart</Steps.Title>
                <Steps.Description>What you picked</Steps.Description>
                <Steps.Separator />
            </Steps.Item>
            <Steps.Item value="details">
                <Steps.Indicator>2</Steps.Indicator>
                <Steps.Title>Details</Steps.Title>
                <Steps.Separator />
            </Steps.Item>
            <Steps.Item value="pay">
                <Steps.Indicator>3</Steps.Indicator>
                <Steps.Title>Pay</Steps.Title>
            </Steps.Item>
        </Steps.Root>,
        container,
    );
}

describe('Steps', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy: group root, button items, phrasing bands', () => {
        mountSteps(container);
        expectAnatomy(container, stepsAnatomy);
        const root = container.querySelector<HTMLElement>(selector('root'))!;
        expect(root.getAttribute('role')).toBe('group');
        expect(root.getAttribute('aria-label')).toBe('Checkout');
        for (const item of items(container)) expect(item.tagName).toBe('BUTTON');
        // The bands inside the button are phrasing elements — a <button>'s
        // content model excludes flow content, so every band is a <span>.
        for (const name of ['indicator', 'title', 'description', 'separator'] as const) {
            expect(container.querySelector<HTMLElement>(selector(name))!.tagName).toBe('SPAN');
        }
    });

    it('derives complete/active/inactive from DOM order and the model', () => {
        mountSteps(container);
        expect(items(container).map((el) => el.getAttribute('data-state')))
            .toEqual(['complete', 'active', 'inactive']);
        expect(items(container)[1]!.getAttribute('aria-current')).toBe('step');
    });

    it('stamps the item phase on the indicator, and the walked pair on the separator', () => {
        mountSteps(container);
        const indicators = [...container.querySelectorAll<HTMLElement>(selector('indicator'))];
        expect(indicators.map((el) => el.getAttribute('data-state')))
            .toEqual(['complete', 'active', 'inactive']);
        // The separator is the line FROM its item toward the next: it reads
        // "walked" only once its own item is complete. An active item's
        // separator is inactive — the walk has reached it, not crossed it.
        const separators = [...container.querySelectorAll<HTMLElement>(selector('separator'))];
        expect(separators.map((el) => el.getAttribute('data-state')))
            .toEqual(['complete', 'inactive']);
        for (const sep of separators) expect(sep.getAttribute('aria-hidden')).toBe('true');
        // The indicator is NOT hidden: its number is information ("step 2"),
        // and for an item rendered with only an indicator it is the button's
        // entire accessible name (review finding, pinned).
        for (const ind of indicators) expect(ind.hasAttribute('aria-hidden')).toBe(false);
    });

    it('selects on click and re-derives every phase', () => {
        mountSteps(container);
        items(container)[2]!.click();
        expect(items(container).map((el) => el.getAttribute('data-state')))
            .toEqual(['complete', 'complete', 'active']);
    });

    it('keeps one tab stop on the active step; arrows rove without selecting', () => {
        mountSteps(container);
        expect(items(container).map((el) => el.tabIndex)).toEqual([-1, 0, -1]);
        const details = items(container)[1]!;
        details.focus();
        details.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        expect(document.activeElement).toBe(items(container)[2]);
        expect(details.getAttribute('data-state')).toBe('active');
    });

    it('roves vertically when the orientation says so', () => {
        render(
            <Steps.Root defaultStep="a" orientation="vertical" label="Setup">
                <Steps.Item value="a"><Steps.Title>A</Steps.Title></Steps.Item>
                <Steps.Item value="b"><Steps.Title>B</Steps.Title></Steps.Item>
            </Steps.Root>,
            container,
        );
        const root = container.querySelector<HTMLElement>(selector('root'))!;
        expect(root.getAttribute('data-orientation')).toBe('vertical');
        const [a, b] = items(container);
        a!.focus();
        a!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(document.activeElement).toBe(b);
        expectAnatomy(container, stepsAnatomy);
    });

    it('a disabled item renders the presence-only flag and does not select', () => {
        render(
            <Steps.Root defaultStep="a" label="Steps">
                <Steps.Item value="a"><Steps.Title>A</Steps.Title></Steps.Item>
                <Steps.Item value="b" disabled><Steps.Title>B</Steps.Title></Steps.Item>
            </Steps.Root>,
            container,
        );
        const disabled = items(container)[1]!;
        expect(disabled.getAttribute('data-disabled')).toBe('');
        disabled.click();
        expect(items(container)[0]!.getAttribute('data-state')).toBe('active');
        expectAnatomy(container, stepsAnatomy);
    });

    it('passes the variant axes through on the root', () => {
        render(
            <Steps.Root defaultStep="a" color="primary" size="lg" label="Steps">
                <Steps.Item value="a"><Steps.Title>A</Steps.Title></Steps.Item>
            </Steps.Root>,
            container,
        );
        const root = container.querySelector<HTMLElement>(selector('root'))!;
        expect(root.getAttribute('data-color')).toBe('primary');
        expect(root.getAttribute('data-size')).toBe('lg');
    });
});
