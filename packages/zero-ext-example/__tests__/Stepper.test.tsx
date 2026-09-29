/**
 * The acceptance test's own tests: the component is held to the anatomy
 * contract through the PUBLISHED conformance assertion — `expectAnatomy`
 * from `@sigx/zero/testing`, never a path into zero's internals — because
 * proving that an ecosystem package can be held to the same bar as zero's
 * own components is this package's reason to exist.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { component, signal } from 'sigx';
import { expectAnatomy } from '@sigx/zero/testing';
import { ExtStepper as Stepper, stepperAnatomy } from '@sigx/zero-ext-example';

function mountStepper(container: HTMLElement, extra: { defaultStep?: string } = {}) {
    render(
        <Stepper.Root defaultStep={extra.defaultStep ?? 'details'} label="Checkout">
            <Stepper.Item value="cart">Cart</Stepper.Item>
            <Stepper.Item value="details">Details</Stepper.Item>
            <Stepper.Item value="pay">Pay</Stepper.Item>
        </Stepper.Root>,
        container,
    );
}

const items = (container: HTMLElement) =>
    [...container.querySelectorAll<HTMLElement>('[data-part="item"]')];

describe('Stepper (ecosystem acceptance)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy per the published conformance assertion', () => {
        mountStepper(container);
        expectAnatomy(container, stepperAnatomy);
    });

    it('publishes its item count as the declared runtime property, and follows an unmount (#456)', async () => {
        // The one runtime property the anatomy declares: the pack's web grid
        // reads it bare, so it must be on the root, current, and nothing else.
        expect(stepperAnatomy.toJSON().runtimeProperties).toEqual(['--ext-stepper-count']);
        const state = signal({ extra: true });
        const Demo = component(() => () => (
            <Stepper.Root defaultStep="cart" label="Checkout">
                <Stepper.Item value="cart">Cart</Stepper.Item>
                <Stepper.Item value="details">Details</Stepper.Item>
                <Stepper.Item value="pay">Pay</Stepper.Item>
                {state.extra ? <Stepper.Item value="done">Done</Stepper.Item> : null}
            </Stepper.Root>
        ));
        render(<Demo />, container);
        const root = container.querySelector<HTMLElement>('[data-scope="ext-stepper"][data-part="root"]')!;
        const count = (): string => root.style.getPropertyValue('--ext-stepper-count');
        for (let i = 0; i < 8; i++) await Promise.resolve();
        expect(count()).toBe('4');
        expectAnatomy(container, stepperAnatomy);
        state.extra = false;
        for (let i = 0; i < 4; i++) await Promise.resolve();
        expect(items(container)).toHaveLength(3);
        expect(count()).toBe('3');
    });

    it('derives complete/active/inactive from DOM order and the model', () => {
        mountStepper(container);
        expect(items(container).map((el) => el.getAttribute('data-state')))
            .toEqual(['complete', 'active', 'inactive']);
        const active = items(container)[1]!;
        expect(active.getAttribute('aria-current')).toBe('step');
    });

    it('selects on click and re-derives every phase', () => {
        mountStepper(container);
        items(container)[2]!.click();
        expect(items(container).map((el) => el.getAttribute('data-state')))
            .toEqual(['complete', 'complete', 'active']);
    });

    it('keeps one tab stop, on the active step', () => {
        mountStepper(container);
        expect(items(container).map((el) => el.tabIndex)).toEqual([-1, 0, -1]);
    });

    it('arrow keys rove focus without changing the step', () => {
        mountStepper(container);
        const [, details] = items(container);
        details!.focus();
        details!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        expect(document.activeElement).toBe(items(container)[2]);
        expect(items(container)[1]!.getAttribute('data-state')).toBe('active');
    });

    it('with no step set, nothing is active or complete, and the first item is the tab stop', () => {
        render(
            <Stepper.Root label="Steps">
                <Stepper.Item value="a">A</Stepper.Item>
                <Stepper.Item value="b">B</Stepper.Item>
            </Stepper.Root>,
            container,
        );
        expect(items(container).map((el) => el.getAttribute('data-state')))
            .toEqual(['inactive', 'inactive']);
        expect(items(container).map((el) => el.tabIndex)).toEqual([0, -1]);
        expectAnatomy(container, stepperAnatomy);
    });

    it('a disabled item renders the presence-only flag and does not select', () => {
        render(
            <Stepper.Root defaultStep="a" label="Steps">
                <Stepper.Item value="a">A</Stepper.Item>
                <Stepper.Item value="b" disabled>B</Stepper.Item>
            </Stepper.Root>,
            container,
        );
        const disabled = items(container)[1]!;
        expect(disabled.getAttribute('data-disabled')).toBe('');
        disabled.click();
        expect(items(container)[0]!.getAttribute('data-state')).toBe('active');
        expectAnatomy(container, stepperAnatomy);
    });
    it('forwards html attributes through WithHtmlAttrs, the part keeping its own', () => {
        render(
            <Stepper.Root defaultStep="a" id="checkout-steps" aria-label="Checkout" data-testid="stepper">
                <Stepper.Item value="a" id="step-a" title="First" aria-describedby="hint">A</Stepper.Item>
                <Stepper.Item value="b" role="tab" aria-current="false">B</Stepper.Item>
            </Stepper.Root>,
            container,
        );
        const root = container.querySelector<HTMLElement>('[data-part="root"]')!;
        expect(root.id).toBe('checkout-steps');
        expect(root.getAttribute('aria-label')).toBe('Checkout');
        expect(root.getAttribute('data-testid')).toBe('stepper');
        expect(root.getAttribute('role')).toBe('group');
        const [a, b] = items(container);
        expect(a!.id).toBe('step-a');
        expect(a!.title).toBe('First');
        expect(a!.getAttribute('aria-describedby')).toBe('hint');
        expect(b!.getAttribute('role')).toBe('tab');
        // The part's own ARIA wins on a name both set: the inactive step carries no aria-current.
        expect(b!.hasAttribute('aria-current')).toBe(false);
    });

    it('a label wins over an app aria-label on the root', () => {
        render(
            <Stepper.Root label="Checkout" aria-label="Ignored">
                <Stepper.Item value="a">A</Stepper.Item>
            </Stepper.Root>,
            container,
        );
        expect(container.querySelector('[data-part="root"]')!.getAttribute('aria-label')).toBe('Checkout');
    });
});
