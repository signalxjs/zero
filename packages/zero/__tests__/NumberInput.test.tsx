import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { NumberInput, numberInputAnatomy } from '@sigx/zero';
import { clamp, precisionOf, snapToStep } from '../src/components/number-input/number.js';
import { expectAnatomy } from './helpers';

function mount(container: HTMLElement, extra: {
    model?: unknown;
    defaultValue?: number | null;
    min?: number;
    max?: number;
    step?: number;
    clampOnBlur?: boolean;
    allowWheel?: boolean;
    name?: string;
    format?: (v: number) => string;
    disabled?: boolean;
    readonly?: boolean;
} = {}) {
    render(
        <NumberInput.Root
            model={extra.model as never}
            defaultValue={extra.defaultValue}
            min={extra.min}
            max={extra.max}
            step={extra.step}
            clampOnBlur={extra.clampOnBlur}
            allowWheel={extra.allowWheel}
            name={extra.name}
            format={extra.format}
            disabled={extra.disabled}
            readonly={extra.readonly}
        >
            <NumberInput.Label>Quantity</NumberInput.Label>
            <NumberInput.Control>
                <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
                <NumberInput.Input />
                <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
            </NumberInput.Control>
        </NumberInput.Root>,
        container,
    );
}

const input = (c: HTMLElement) => c.querySelector<HTMLInputElement>('[data-part="input"]')!;
const inc = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-part="increment-trigger"]')!;
const dec = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-part="decrement-trigger"]')!;

function type(el: HTMLInputElement, text: string) {
    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
}
const key = (k: string) => new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
const pointerDown = () => new PointerEvent('pointerdown', { button: 0, bubbles: true, cancelable: true });
const pointerUp = () => new PointerEvent('pointerup', { bubbles: true });

describe('number math', () => {
    it('precisionOf reads decimals as written', () => {
        expect(precisionOf(10)).toBe(0);
        expect(precisionOf(0.25)).toBe(2);
        expect(precisionOf(1e-7)).toBe(7);
    });

    it('clamp respects open ends', () => {
        expect(clamp(5, 0, 10)).toBe(5);
        expect(clamp(-1, 0)).toBe(0);
        expect(clamp(99, undefined, 10)).toBe(10);
    });

    it('snapToStep anchors at min and kills float noise', () => {
        expect(snapToStep(4, 2, 1)).toBe(5);
        expect(snapToStep(0.30000000000000004, 0.1)).toBe(0.3);
        expect(snapToStep(0.35, 0.1)).toBe(0.4);
    });
});

describe('NumberInput', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('defaultValue is typed as the model — null is an explicit empty seed', () => {
        mount(container, { name: 'qty', defaultValue: null });
        expect(container.querySelector<HTMLInputElement>('[data-part="hidden-input"]')!.value).toBe('');
    });

    it('renders a valid anatomy including the hidden input', () => {
        mount(container, { name: 'qty', defaultValue: 3 });
        expectAnatomy(container, numberInputAnatomy);
        const hidden = container.querySelector<HTMLInputElement>('[data-part="hidden-input"]')!;
        expect(hidden.getAttribute('name')).toBe('qty');
        expect(hidden.value).toBe('3');
    });

    it('wires the APG spinbutton pattern', () => {
        mount(container, { defaultValue: 5, min: 0, max: 10 });
        const el = input(container);
        expect(el.getAttribute('role')).toBe('spinbutton');
        expect(el.getAttribute('aria-valuemin')).toBe('0');
        expect(el.getAttribute('aria-valuemax')).toBe('10');
        expect(el.getAttribute('aria-valuenow')).toBe('5');
        expect(el.getAttribute('inputmode')).toBe('decimal');
        const label = container.querySelector<HTMLLabelElement>('[data-part="label"]')!;
        expect(label.getAttribute('for')).toBe(el.id);
        // Triggers are satellites, not tab stops.
        expect(inc(container).tabIndex).toBe(-1);
        expect(inc(container).getAttribute('aria-controls')).toBe(el.id);
    });

    it('typing is uncommitted until blur', () => {
        const state = signal({ qty: 1 as number | null });
        mount(container, { model: [state, 'qty'] });
        const el = input(container);
        type(el, '42');
        expect(state.qty).toBe(1);
        el.dispatchEvent(new FocusEvent('blur'));
        expect(state.qty).toBe(42);
    });

    it('Enter commits without blurring', () => {
        const state = signal({ qty: 1 as number | null });
        mount(container, { model: [state, 'qty'] });
        const el = input(container);
        type(el, '7');
        el.dispatchEvent(key('Enter'));
        expect(state.qty).toBe(7);
    });

    it('unparseable text reverts to the last committed value', () => {
        const state = signal({ qty: 5 as number | null });
        mount(container, { model: [state, 'qty'] });
        const el = input(container);
        type(el, 'garbage');
        el.dispatchEvent(new FocusEvent('blur'));
        expect(state.qty).toBe(5);
        expect(el.value).toBe('5');
    });

    it('partial entries like "-" and "1e" do not reach the model', () => {
        const state = signal({ qty: 2 as number | null });
        mount(container, { model: [state, 'qty'] });
        const el = input(container);
        for (const partial of ['-', '.', '1e']) {
            type(el, partial);
            expect(state.qty).toBe(2);
            el.dispatchEvent(new FocusEvent('blur'));
            expect(state.qty).toBe(2);
        }
    });

    it('empty commits null, not 0', () => {
        const state = signal({ qty: 5 as number | null });
        mount(container, { model: [state, 'qty'] });
        const el = input(container);
        type(el, '');
        el.dispatchEvent(new FocusEvent('blur'));
        expect(state.qty).toBe(null);
        expect(el.value).toBe('');
    });

    it('arrow keys step, PageUp/Down jump by 10 steps, Home/End hit the edges', () => {
        const state = signal({ qty: 5 as number | null });
        mount(container, { model: [state, 'qty'], min: 0, max: 100 });
        const el = input(container);
        el.dispatchEvent(key('ArrowUp'));
        expect(state.qty).toBe(6);
        el.dispatchEvent(key('ArrowDown'));
        expect(state.qty).toBe(5);
        el.dispatchEvent(key('PageUp'));
        expect(state.qty).toBe(15);
        el.dispatchEvent(key('PageDown'));
        expect(state.qty).toBe(5);
        el.dispatchEvent(key('Home'));
        expect(state.qty).toBe(0);
        el.dispatchEvent(key('End'));
        expect(state.qty).toBe(100);
    });

    it('repeated decimal stepping stays precise', () => {
        const state = signal({ qty: 0.1 as number | null });
        mount(container, { model: [state, 'qty'], step: 0.1 });
        const el = input(container);
        el.dispatchEvent(key('ArrowUp'));
        el.dispatchEvent(key('ArrowUp'));
        expect(state.qty).toBe(0.3);
    });

    it('committed values snap to the step grid anchored at min', () => {
        const state = signal({ qty: 1 as number | null });
        mount(container, { model: [state, 'qty'], min: 1, step: 2 });
        const el = input(container);
        type(el, '4');
        el.dispatchEvent(new FocusEvent('blur'));
        expect(state.qty).toBe(5);
        el.dispatchEvent(key('ArrowUp'));
        expect(state.qty).toBe(7);
    });

    it('clampOnBlur clamps an out-of-range commit; opting out keeps it and flags invalid', () => {
        const state = signal({ qty: 1 as number | null });
        mount(container, { model: [state, 'qty'], max: 10 });
        type(input(container), '999');
        input(container).dispatchEvent(new FocusEvent('blur'));
        expect(state.qty).toBe(10);

        const loose = signal({ qty: 1 as number | null });
        const c2 = document.createElement('div');
        document.body.appendChild(c2);
        mount(c2, { model: [loose, 'qty'], max: 10, clampOnBlur: false });
        type(input(c2), '999');
        input(c2).dispatchEvent(new FocusEvent('blur'));
        expect(loose.qty).toBe(999);
        expect(input(c2).hasAttribute('data-invalid')).toBe(true);
    });

    it('a trigger press steps once — no click double-step', () => {
        const state = signal({ qty: 5 as number | null });
        mount(container, { model: [state, 'qty'] });
        inc(container).dispatchEvent(pointerDown());
        inc(container).dispatchEvent(pointerUp());
        (inc(container) as HTMLButtonElement).click();
        expect(state.qty).toBe(6);
        dec(container).dispatchEvent(pointerDown());
        dec(container).dispatchEvent(pointerUp());
        expect(state.qty).toBe(5);
    });

    it('holding a trigger auto-repeats after the delay', () => {
        vi.useFakeTimers();
        const state = signal({ qty: 0 as number | null });
        mount(container, { model: [state, 'qty'] });
        inc(container).dispatchEvent(pointerDown());
        expect(state.qty).toBe(1);
        vi.advanceTimersByTime(400 + 64 * 3 + 1);
        expect(state.qty).toBe(4);
        inc(container).dispatchEvent(pointerUp());
        vi.advanceTimersByTime(1000);
        expect(state.qty).toBe(4);
    });

    it('a held spin stops at max', () => {
        vi.useFakeTimers();
        const state = signal({ qty: 8 as number | null });
        mount(container, { model: [state, 'qty'], max: 10 });
        inc(container).dispatchEvent(pointerDown());
        vi.advanceTimersByTime(400 + 64 * 10);
        expect(state.qty).toBe(10);
        expect(inc(container).hasAttribute('data-disabled')).toBe(true);
    });

    it('from empty, the first increment lands on the floor of the range', () => {
        const state = signal({ qty: null as number | null });
        mount(container, { model: [state, 'qty'], min: 3, max: 10 });
        inc(container).dispatchEvent(pointerDown());
        expect(state.qty).toBe(3);
    });

    it('the hidden input posts the canonical decimal under a custom display format', () => {
        mount(container, { name: 'price', defaultValue: 4.5, format: (v) => `$${v.toFixed(2)}` });
        expect(input(container).value).toBe('$4.50');
        expect(container.querySelector<HTMLInputElement>('[data-part="hidden-input"]')!.value).toBe('4.5');
    });

    it('wheel steps only when opted in and focused', () => {
        const state = signal({ qty: 5 as number | null });
        mount(container, { model: [state, 'qty'], allowWheel: true });
        const el = input(container);
        // Unfocused: the page keeps its scroll.
        el.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, bubbles: true, cancelable: true }));
        expect(state.qty).toBe(5);
        el.focus();
        el.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, bubbles: true, cancelable: true }));
        expect(state.qty).toBe(6);
        el.dispatchEvent(new WheelEvent('wheel', { deltaY: 1, bubbles: true, cancelable: true }));
        expect(state.qty).toBe(5);
    });

    it('a horizontal wheel (deltaY 0) does not step', () => {
        const state = signal({ qty: 5 as number | null });
        mount(container, { model: [state, 'qty'], allowWheel: true });
        const el = input(container);
        el.focus();
        el.dispatchEvent(new WheelEvent('wheel', { deltaY: 0, deltaX: 40, bubbles: true, cancelable: true }));
        expect(state.qty).toBe(5);
    });

    it('wheel is off by default', () => {
        const state = signal({ qty: 5 as number | null });
        mount(container, { model: [state, 'qty'] });
        const el = input(container);
        el.focus();
        el.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, bubbles: true, cancelable: true }));
        expect(state.qty).toBe(5);
    });

    it('non-decimal syntaxes like 0x10 revert instead of committing 16', () => {
        const state = signal({ qty: 5 as number | null });
        mount(container, { model: [state, 'qty'] });
        const el = input(container);
        for (const text of ['0x10', '0b101', 'Infinity']) {
            type(el, text);
            el.dispatchEvent(new FocusEvent('blur'));
            expect(state.qty).toBe(5);
        }
        // Scientific notation IS decimal syntax.
        type(el, '1e2');
        el.dispatchEvent(new FocusEvent('blur'));
        expect(state.qty).toBe(100);
    });

    it('step={0} coerces to 1 instead of poisoning the model', () => {
        const state = signal({ qty: 5 as number | null });
        mount(container, { model: [state, 'qty'], step: 0 });
        input(container).dispatchEvent(key('ArrowUp'));
        expect(state.qty).toBe(6);
    });

    it('a custom parse leaking NaN/Infinity reverts instead of committing', () => {
        const state = signal({ qty: 5 as number | null });
        render(
            <NumberInput.Root model={[state, 'qty']} parse={() => Infinity}>
                <NumberInput.Control><NumberInput.Input /></NumberInput.Control>
            </NumberInput.Root>,
            container,
        );
        const el = input(container);
        type(el, '9');
        el.dispatchEvent(new FocusEvent('blur'));
        expect(state.qty).toBe(5);
    });

    it('aria-valuenow goes silent while a draft is typed; valuetext carries the draft', () => {
        mount(container, { defaultValue: 5 });
        const el = input(container);
        expect(el.getAttribute('aria-valuenow')).toBe('5');
        type(el, '51');
        expect(el.getAttribute('aria-valuenow')).toBe(null);
        expect(el.getAttribute('aria-valuetext')).toBe('51');
        el.dispatchEvent(new FocusEvent('blur'));
        expect(el.getAttribute('aria-valuenow')).toBe('51');
    });

    it('End lands exactly on an off-grid max', () => {
        const state = signal({ qty: 0 as number | null });
        mount(container, { model: [state, 'qty'], min: 0, max: 5, step: 4 });
        input(container).dispatchEvent(key('End'));
        expect(state.qty).toBe(5);
    });

    it('readonly leaves arrow keys to the caret (no preventDefault)', () => {
        const state = signal({ qty: 5 as number | null });
        mount(container, { model: [state, 'qty'], readonly: true });
        const e = key('ArrowUp');
        input(container).dispatchEvent(e);
        expect(e.defaultPrevented).toBe(false);
        expect(state.qty).toBe(5);
    });

    it('a trigger press hands focus to the spinbutton', () => {
        mount(container, { defaultValue: 5 });
        inc(container).dispatchEvent(pointerDown());
        expect(document.activeElement).toBe(input(container));
    });

    it('a disabled control does not submit its hidden input', () => {
        mount(container, { name: 'qty', defaultValue: 5, disabled: true });
        const hidden = container.querySelector<HTMLInputElement>('[data-part="hidden-input"]')!;
        expect(hidden.disabled).toBe(true);
    });

    it('disabled and readonly block stepping', () => {
        const state = signal({ qty: 5 as number | null });
        mount(container, { model: [state, 'qty'], disabled: true });
        input(container).dispatchEvent(key('ArrowUp'));
        inc(container).dispatchEvent(pointerDown());
        expect(state.qty).toBe(5);

        const ro = signal({ qty: 5 as number | null });
        const c2 = document.createElement('div');
        document.body.appendChild(c2);
        mount(c2, { model: [ro, 'qty'], readonly: true });
        input(c2).dispatchEvent(key('ArrowUp'));
        expect(ro.qty).toBe(5);
        expect(input(c2).hasAttribute('readonly')).toBe(true);
    });
});
