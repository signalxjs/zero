/**
 * Countdown — display-only digits; the APP owns time (#340).
 *
 * The decisions pinned here:
 * - NO internal timer, deliberately: a timer is application logic (which
 *   clock? paused when? what happens at zero?) and an SSR hazard — a
 *   setInterval started in a component is exactly the module-global
 *   mutable state the SSR rule forbids, and server markup would render an
 *   instantly stale tick anyway. The app passes `value`; the component
 *   renders it.
 * - The anatomy is Root (a container for composed units — hours, minutes,
 *   seconds are separate `Value`s with consumer separators between) plus
 *   `value`/`digits` per unit. `digits` is KEYED by the value, so a change
 *   replaces the element and a recipe's enter animation (translate/fade,
 *   collapsed under reduced motion) plays per tick — CSS owns the motion,
 *   the runtime owns nothing but the swap.
 * - The digits are REAL TEXT (AT reads the number; no aria mirrors), and
 *   the numeric value is published as `--countdown-value` for recipes
 *   that want the property.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { Countdown, countdownAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

const selector = (scope: string, name: string) => `[data-scope="${scope}"][data-part="${name}"]`;
const part = (c: HTMLElement, name: string) =>
    c.querySelector<HTMLElement>(selector('countdown', name))!;
const parts = (c: HTMLElement, name: string) =>
    [...c.querySelectorAll<HTMLElement>(selector('countdown', name))];

describe('Countdown', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy: composed units with real digit text', () => {
        render(
            <Countdown.Root>
                <Countdown.Value value={10} digits={2} />
                :
                <Countdown.Value value={4} digits={2} />
            </Countdown.Root>,
            container,
        );
        expectAnatomy(container, countdownAnatomy);
        const values = parts(container, 'value');
        expect(values.length).toBe(2);
        // Real text — a screen reader reads "10:04" straight off the DOM.
        expect(container.textContent).toBe('10:04');
    });

    it('publishes the numeric value and pads to the declared digits', () => {
        render(<Countdown.Root><Countdown.Value value={7} digits={3} /></Countdown.Root>, container);
        const value = part(container, 'value');
        expect(value.style.getPropertyValue('--countdown-value')).toBe('7');
        expect(part(container, 'digits').textContent).toBe('007');
    });

    it('renders the plain number when no digits are declared', () => {
        render(<Countdown.Root><Countdown.Value value={42} /></Countdown.Root>, container);
        expect(part(container, 'digits').textContent).toBe('42');
    });

    it('clamps below zero — a countdown never displays negative time', () => {
        render(<Countdown.Root><Countdown.Value value={-3} digits={2} /></Countdown.Root>, container);
        expect(part(container, 'digits').textContent).toBe('00');
        expect(part(container, 'value').style.getPropertyValue('--countdown-value')).toBe('0');
    });

    it('has no states, no flags, no timer — display only', () => {
        for (const name of countdownAnatomy.partNames()) {
            expect(countdownAnatomy.parts[name].states, `${name} must declare no states`).toBeUndefined();
            expect(countdownAnatomy.parts[name].flags, `${name} must declare no flags`).toBeUndefined();
        }
        // The anatomy is exactly the three parts — nothing to tick with.
        expect(countdownAnatomy.partNames()).toEqual(['root', 'value', 'digits']);
    });
});
