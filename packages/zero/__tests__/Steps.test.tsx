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
import { signal } from 'sigx';
import { Steps, stepsAnatomy } from '@sigx/zero';
import type { PartProps } from '@sigx/zero';
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

    it('a pointer-focused disabled asChild item still roves its arrows, but never activates', () => {
        render(
            <Steps.Root defaultStep="a" label="Steps">
                {['a', 'b', 'c', 'd'].map((v) => (
                    <Steps.Item value={v} disabled={v === 'b'} asChild>
                        {(p: PartProps) => <div {...p}>{v.toUpperCase()}</div>}
                    </Steps.Item>
                ))}
            </Steps.Root>,
            container,
        );
        const [a, b, c, d] = items(container);
        const press = (el: HTMLElement, k: string) => {
            const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
            el.dispatchEvent(e);
            return e;
        };
        // tabindex=-1 still takes a pointer's focus: the disabled step is
        // focused, and its keys used to return before roving — a dead end.
        expect(b!.tabIndex).toBe(-1);
        b!.focus();
        expect(press(b!, 'ArrowRight').defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(c);
        b!.focus();
        press(b!, 'ArrowLeft');
        expect(document.activeElement).toBe(a);
        b!.focus();
        press(b!, 'End');
        expect(document.activeElement).toBe(d);
        // Activation stays gated.
        b!.focus();
        press(b!, 'Enter');
        press(b!, ' ');
        expect(b!.getAttribute('data-state')).not.toBe('active');
        expect(a!.getAttribute('data-state')).toBe('active');
    });

    it('a disabled asChild step at either edge never strands its arrows', () => {
        const mount = (loop: boolean) => render(
            <Steps.Root defaultStep="b" label="Steps" loop={loop}>
                {['a', 'b', 'c', 'd'].map((v) => (
                    <Steps.Item value={v} disabled={v === 'a' || v === 'd'} asChild>
                        {(p: PartProps) => <div {...p}>{v.toUpperCase()}</div>}
                    </Steps.Item>
                ))}
            </Steps.Root>,
            container,
        );
        const press = (el: HTMLElement, k: string) => {
            const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
            el.dispatchEvent(e);
            return e;
        };
        mount(false);
        let [a, b, c, d] = items(container);
        // Nothing past the edge and no loop: the nearest enabled step behind.
        a!.focus();
        expect(press(a!, 'ArrowLeft').defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(b);
        d!.focus();
        press(d!, 'ArrowRight');
        expect(document.activeElement).toBe(c);
        render(null, container);
        mount(true);
        [a, b, c, d] = items(container);
        // With loop, past the edge wraps.
        a!.focus();
        press(a!, 'ArrowLeft');
        expect(document.activeElement).toBe(c);
        d!.focus();
        press(d!, 'ArrowRight');
        expect(document.activeElement).toBe(b);
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

    it('an item re-carries the colour axis: its own data-color, beside the root\'s (#112)', () => {
        render(
            <Steps.Root defaultStep="b" color="primary" label="Steps">
                <Steps.Item value="a" color="error">
                    <Steps.Indicator>1</Steps.Indicator>
                    <Steps.Separator />
                </Steps.Item>
                <Steps.Item value="b"><Steps.Indicator>2</Steps.Indicator></Steps.Item>
            </Steps.Root>,
            container,
        );
        // The anatomy declares it, so expectAnatomy lets the attribute through.
        expect(stepsAnatomy.parts.item.carries).toEqual(['color']);
        expectAnatomy(container, stepsAnatomy);
        const [coloured, bare] = items(container);
        expect(coloured!.getAttribute('data-color')).toBe('error');
        // No colour of its own → no attribute: the item follows the root.
        expect(bare!.hasAttribute('data-color')).toBe(false);
        // Only the item carries it — the parts inside reach it through the cascade.
        for (const name of ['indicator', 'separator'] as const) {
            expect(container.querySelector(selector(name))!.hasAttribute('data-color')).toBe(false);
        }
        expect(container.querySelector(selector('root'))!.getAttribute('data-color')).toBe('primary');
    });

    it('an asChild item carries its colour onto the child', () => {
        render(
            <Steps.Root defaultStep="a" label="Steps">
                <Steps.Item value="a" color="success" asChild>
                    {(p: PartProps) => <a href="#a" {...p}>A</a>}
                </Steps.Item>
            </Steps.Root>,
            container,
        );
        expect(items(container)[0]!.tagName).toBe('A');
        expect(items(container)[0]!.getAttribute('data-color')).toBe('success');
        expectAnatomy(container, stepsAnatomy);
    });
});

/**
 * The wizard half (#296): content panels, Prev/Next, `linear` and
 * `invalid` — Steps as a wizard with no app plumbing.
 */
describe('Steps wizard', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
    const one = (name: string) => container.querySelector<HTMLElement>(selector(name))!;
    const all = (name: string) => [...container.querySelectorAll<HTMLElement>(selector(name))];
    const phases = () => items(container).map((el) => el.getAttribute('data-state'));
    const key = (el: HTMLElement, k: string) => {
        const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
        el.dispatchEvent(e);
        return e;
    };

    function mountWizard(opts: {
        defaultStep?: string;
        linear?: boolean;
        lazyMount?: boolean;
        disabled?: string[];
        invalid?: string[];
        rootDisabled?: boolean;
        state?: { step: string };
    } = {}) {
        const values = ['cart', 'details', 'pay', 'done'];
        render(
            <Steps.Root
                {...(opts.state ? { model: [opts.state, 'step'] } : { defaultStep: opts.defaultStep ?? 'cart' })}
                linear={opts.linear}
                lazyMount={opts.lazyMount}
                disabled={opts.rootDisabled}
                label="Checkout"
            >
                {values.map((v, i) => (
                    <Steps.Item value={v} disabled={opts.disabled?.includes(v)} invalid={opts.invalid?.includes(v)}>
                        <Steps.Indicator>{i + 1}</Steps.Indicator>
                        <Steps.Title>{v}</Steps.Title>
                        {i < values.length - 1 ? <Steps.Separator /> : null}
                    </Steps.Item>
                ))}
                {values.map((v) => (
                    <Steps.Content value={v}><p data-body={v}>{v} body</p></Steps.Content>
                ))}
                <Steps.PrevTrigger>Back</Steps.PrevTrigger>
                <Steps.NextTrigger>Next</Steps.NextTrigger>
            </Steps.Root>,
            container,
        );
    }

    it('renders a valid anatomy with content panels and both triggers', async () => {
        mountWizard();
        await tick();
        expectAnatomy(container, stepsAnatomy);
        for (const name of ['prev-trigger', 'next-trigger'] as const) {
            expect(one(name).tagName).toBe('BUTTON');
            expect(one(name).getAttribute('type')).toBe('button');
        }
        const panels = all('content');
        expect(panels.map((el) => el.getAttribute('data-state'))).toEqual(['active', 'inactive', 'inactive', 'inactive']);
        expect(panels.map((el) => el.hidden)).toEqual([false, true, true, true]);
    });

    it('wires item ↔ content: aria-controls, a region labelled by the step title', async () => {
        mountWizard();
        await tick();
        const [cart] = items(container);
        const panel = all('content')[0]!;
        const title = all('title')[0]!;
        expect(panel.getAttribute('role')).toBe('region');
        expect(cart!.getAttribute('aria-controls')).toBe(panel.id);
        expect(panel.getAttribute('aria-labelledby')).toBe(title.id);
        expect(title.id).not.toBe('');
        // Every IDREF resolves inside the rendered tree.
        for (const el of container.querySelectorAll<HTMLElement>('[aria-controls], [aria-labelledby]')) {
            for (const attr of ['aria-controls', 'aria-labelledby']) {
                for (const id of (el.getAttribute(attr) ?? '').split(' ').filter(Boolean)) {
                    expect(document.getElementById(id), `${attr}=${id}`).not.toBeNull();
                }
            }
        }
    });

    it('an item without a content panel carries no aria-controls; a title-less step labels its panel by the item', async () => {
        render(
            <Steps.Root defaultStep="a" label="Steps">
                <Steps.Item value="a"><Steps.Indicator>1</Steps.Indicator></Steps.Item>
                <Steps.Item value="b"><Steps.Title>B</Steps.Title></Steps.Item>
                <Steps.Content value="a">A body</Steps.Content>
            </Steps.Root>,
            container,
        );
        await tick();
        const [a, b] = items(container);
        expect(a!.getAttribute('aria-controls')).toBe(one('content').id);
        expect(b!.hasAttribute('aria-controls')).toBe(false);
        expect(one('content').getAttribute('aria-labelledby')).toBe(a!.id);
    });

    it('Next/Prev step through the items in DOM order and move every panel with them', async () => {
        mountWizard();
        await tick();
        const next = one('next-trigger');
        const prev = one('prev-trigger');
        next.click();
        expect(phases()).toEqual(['complete', 'active', 'inactive', 'inactive']);
        expect(all('content').map((el) => el.hidden)).toEqual([true, false, true, true]);
        next.click();
        next.click();
        expect(phases()).toEqual(['complete', 'complete', 'complete', 'active']);
        prev.click();
        expect(phases()).toEqual(['complete', 'complete', 'active', 'inactive']);
    });

    it('the triggers skip disabled items', async () => {
        mountWizard({ disabled: ['details'] });
        await tick();
        one('next-trigger').click();
        expect(phases()).toEqual(['complete', 'complete', 'active', 'inactive']);
        one('prev-trigger').click();
        expect(phases()[0]).toBe('active');
    });

    it('at a bound a trigger stays focusable, aria-disabled, and does nothing', async () => {
        mountWizard();
        await tick();
        const prev = one('prev-trigger');
        const next = one('next-trigger');
        expect(prev.getAttribute('aria-disabled')).toBe('true');
        expect(prev.getAttribute('data-disabled')).toBe('');
        // Not natively disabled: that would drop focus to <body> on the very
        // press that reaches the bound.
        expect((prev as HTMLButtonElement).disabled).toBe(false);
        expect(next.hasAttribute('aria-disabled')).toBe(false);
        prev.click();
        expect(phases()[0]).toBe('active');
        for (let i = 0; i < 3; i++) next.click();
        next.focus();
        expect(next.getAttribute('aria-disabled')).toBe('true');
        next.click();
        expect(phases()).toEqual(['complete', 'complete', 'complete', 'active']);
        expect(document.activeElement).toBe(next);
        expectAnatomy(container, stepsAnatomy);
    });

    it('a disabled root disables the triggers natively', async () => {
        mountWizard({ rootDisabled: true, defaultStep: 'details' });
        await tick();
        for (const name of ['prev-trigger', 'next-trigger'] as const) {
            expect((one(name) as HTMLButtonElement).disabled).toBe(true);
            expect(one(name).getAttribute('data-disabled')).toBe('');
            expect(one(name).hasAttribute('aria-disabled')).toBe(false);
        }
    });

    it('drives a controlled model and follows it', async () => {
        const state = signal({ step: 'cart' });
        mountWizard({ state });
        await tick();
        one('next-trigger').click();
        expect(state.step).toBe('details');
        state.step = 'done';
        await tick();
        expect(all('content').map((el) => el.hidden)).toEqual([true, true, true, false]);
        expect(one('next-trigger').getAttribute('aria-disabled')).toBe('true');
    });

    it('lazyMount defers a panel\'s content until its step has been active, then keeps it', async () => {
        mountWizard({ lazyMount: true });
        await tick();
        const bodies = () => [...container.querySelectorAll('[data-body]')].map((el) => el.getAttribute('data-body'));
        expect(bodies()).toEqual(['cart']);
        // Every panel element still renders, so aria-controls never dangles.
        expect(all('content')).toHaveLength(4);
        one('next-trigger').click();
        expect(bodies()).toEqual(['cart', 'details']);
        one('prev-trigger').click();
        expect(bodies()).toEqual(['cart', 'details']);
    });

    it('without lazyMount every panel renders its content (hidden)', async () => {
        mountWizard();
        await tick();
        expect(container.querySelectorAll('[data-body]')).toHaveLength(4);
    });

    describe('linear', () => {
        it('locks every item past the next reachable step: data-disabled + aria-disabled, never natively', async () => {
            mountWizard({ linear: true });
            await tick();
            const [cart, details, pay, done] = items(container);
            expect(cart!.hasAttribute('data-disabled')).toBe(false);
            expect(details!.hasAttribute('data-disabled')).toBe(false);
            for (const el of [pay!, done!]) {
                expect(el.getAttribute('data-disabled')).toBe('');
                expect(el.getAttribute('aria-disabled')).toBe('true');
                expect((el as HTMLButtonElement).disabled).toBe(false);
            }
            expectAnatomy(container, stepsAnatomy);
        });

        it('a locked item ignores click and Enter; the next step and earlier ones activate', async () => {
            mountWizard({ linear: true });
            await tick();
            const [, details, pay] = items(container);
            pay!.click();
            expect(phases()[0]).toBe('active');
            key(pay!, 'Enter');
            expect(phases()[0]).toBe('active');
            details!.click();
            expect(phases()).toEqual(['complete', 'active', 'inactive', 'inactive']);
            // The lock moves with the walk: `pay` is now the next step.
            expect(pay!.hasAttribute('data-disabled')).toBe(false);
            expect(items(container)[3]!.getAttribute('data-disabled')).toBe('');
            // Going back is never gated.
            items(container)[0]!.click();
            expect(phases()[0]).toBe('active');
        });

        it('locked items stay reachable by the arrow keys', async () => {
            mountWizard({ linear: true });
            await tick();
            const [cart, details, pay, done] = items(container);
            cart!.focus();
            key(cart!, 'ArrowRight');
            expect(document.activeElement).toBe(details);
            key(details!, 'ArrowRight');
            expect(document.activeElement).toBe(pay);
            key(pay!, 'End');
            expect(document.activeElement).toBe(done);
        });

        it('Next moves one step at a time, past a disabled item to the next enabled one', async () => {
            mountWizard({ linear: true, disabled: ['details'] });
            await tick();
            // `details` is disabled, so `pay` is the next reachable step.
            expect(items(container)[2]!.hasAttribute('data-disabled')).toBe(false);
            expect(items(container)[3]!.getAttribute('data-disabled')).toBe('');
            one('next-trigger').click();
            expect(phases()).toEqual(['complete', 'complete', 'active', 'inactive']);
        });
    });

    describe('invalid', () => {
        it('flags the item, its indicator and its separator, and names the error', async () => {
            mountWizard({ invalid: ['details'] });
            await tick();
            const details = items(container)[1]!;
            expect(details.getAttribute('data-invalid')).toBe('');
            expect(all('indicator')[1]!.getAttribute('data-invalid')).toBe('');
            expect(all('separator')[1]!.getAttribute('data-invalid')).toBe('');
            // `aria-invalid` is not allowed on a button: the error is in the name.
            expect(details.hasAttribute('aria-invalid')).toBe(false);
            const hidden = details.querySelector<HTMLElement>('[data-visually-hidden]')!;
            expect(hidden.textContent).toBe(', has errors');
            expect(details.textContent).toContain('details, has errors');
            // No other step carries any of it.
            expect(items(container)[0]!.hasAttribute('data-invalid')).toBe(false);
            expect(items(container)[0]!.querySelector('[data-visually-hidden]')).toBeNull();
            expectAnatomy(container, stepsAnatomy);
        });

        it('the hidden text is the root\'s invalidLabel', async () => {
            render(
                <Steps.Root defaultStep="a" label="Steps" invalidLabel=", fehlerhaft">
                    <Steps.Item value="a" invalid><Steps.Title>A</Steps.Title></Steps.Item>
                </Steps.Root>,
                container,
            );
            await tick();
            expect(items(container)[0]!.querySelector('[data-visually-hidden]')!.textContent).toBe(', fehlerhaft');
        });
    });
});
