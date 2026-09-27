import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { NumberInput, numberInputAnatomy } from '@sigx/zero';
import { clamp, precisionOf, snapToStep, stepToward } from '../src/components/number-input/number.js';
import { createLocaleNumberFormat } from '../src/components/number-input/locale.js';
import { expectAnatomy } from './helpers';

function mount(container: HTMLElement, extra: {
    model?: unknown;
    defaultValue?: number | null;
    min?: number;
    max?: number;
    step?: number;
    largeStep?: number;
    clampOnBlur?: boolean;
    allowWheel?: boolean;
    name?: string;
    format?: (v: number) => string;
    parse?: (t: string) => number | null;
    locale?: string;
    formatOptions?: Intl.NumberFormatOptions;
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
            largeStep={extra.largeStep}
            clampOnBlur={extra.clampOnBlur}
            allowWheel={extra.allowWheel}
            name={extra.name}
            format={extra.format}
            parse={extra.parse}
            locale={extra.locale}
            formatOptions={extra.formatOptions}
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
const key = (k: string, init: KeyboardEventInit = {}) => new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
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

describe('stepToward (#272)', () => {
    it('an on-grid value moves by the amount', () => {
        expect(stepToward(4, 1, 2, 0)).toBe(6);
        expect(stepToward(4, -1, 2, 0)).toBe(2);
        expect(stepToward(0.3, 1, 0.1)).toBe(0.4);
        expect(stepToward(4, 1, 2, 0, 20)).toBe(24);
    });

    it('an off-grid value lands on the neighbouring grid value in the direction of travel', () => {
        // Round-to-nearest would make Up from 5 skip 6 and land on 8.
        expect(stepToward(5, 1, 2, 0)).toBe(6);
        expect(stepToward(5, -1, 2, 0)).toBe(4);
        // The grid anchors at min: 1, 3, 5, …
        expect(stepToward(4, 1, 2, 1)).toBe(5);
        expect(stepToward(4, -1, 2, 1)).toBe(3);
        expect(stepToward(0.25, 1, 0.1)).toBe(0.3);
        expect(stepToward(0.25, -1, 0.1)).toBe(0.2);
    });

    it('the landing counts as the first step of a large amount', () => {
        expect(stepToward(5, 1, 2, 0, 20)).toBe(24);
        expect(stepToward(5, -1, 2, 0, 20)).toBe(-14);
    });
});

describe('locale number format (#300)', () => {
    it('en-US: strips grouping, keeps the dot decimal, rejects the rest', () => {
        const f = createLocaleNumberFormat('en-US', undefined);
        expect(f.format(-1234.5)).toBe('-1,234.5');
        expect(f.parse('1,234.5')).toBe(1234.5);
        expect(f.parse('-1,234.5')).toBe(-1234.5);
        expect(f.parse('\u22125')).toBe(-5);
        expect(f.parse('1 234')).toBeNull();
        expect(f.parse('12e3')).toBeNull();
        expect(f.parse('0x10')).toBeNull();
        expect(f.parse('abc')).toBeNull();
    });

    it('de-DE: the dot groups and the comma is the decimal', () => {
        const f = createLocaleNumberFormat('de-DE', undefined);
        expect(f.format(1234.5)).toBe('1.234,5');
        expect(f.parse('1.234,5')).toBe(1234.5);
        expect(f.parse('-1.234,5')).toBe(-1234.5);
        expect(f.parse('1,5')).toBe(1.5);
        expect(f.parse('1.5')).toBe(15);
    });

    it('fr-FR: the narrow no-break space groups, and any space does', () => {
        const f = createLocaleNumberFormat('fr-FR', undefined);
        expect(f.format(1234.5)).toBe('1\u202f234,5');
        expect(f.parse('1\u202f234,5')).toBe(1234.5);
        expect(f.parse('1 234,5')).toBe(1234.5);
        expect(f.parse('-1 234,5')).toBe(-1234.5);
        // A dot is neither the group nor the decimal here.
        expect(f.parse('1.5')).toBeNull();
    });

    it('percent: tolerates the sign and divides by 100 without float noise', () => {
        const f = createLocaleNumberFormat('en-US', { style: 'percent' });
        expect(f.format(0.25)).toBe('25%');
        expect(f.parse('25%')).toBe(0.25);
        expect(f.parse('25')).toBe(0.25);
        expect(f.parse('14.1 %')).toBe(0.141);
        expect(f.parse('-3%')).toBe(-0.03);
        expect(f.maximumFractionDigits).toBe(0);
    });

    it('currency: tolerates its own symbol, not another', () => {
        const usd = createLocaleNumberFormat('en-US', { style: 'currency', currency: 'USD' });
        expect(usd.format(1234.5)).toBe('$1,234.50');
        expect(usd.parse('$1,234.50')).toBe(1234.5);
        expect(usd.parse('-$5')).toBe(-5);
        expect(usd.parse('1234')).toBe(1234);
        expect(usd.parse('\u20ac5')).toBeNull();
        const eur = createLocaleNumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
        expect(eur.parse(eur.format(-1234.56))).toBe(-1234.56);
        expect(eur.parse('1.234,56 \u20ac')).toBe(1234.56);
    });

    it('accounting parentheses are not silently read as positive', () => {
        const f = createLocaleNumberFormat('en-US', { style: 'currency', currency: 'USD', currencySign: 'accounting' });
        expect(f.parse('($5.00)')).toBeNull();
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

    it('an off-grid value steps to the next grid value in the direction of travel (#272)', () => {
        const state = signal({ qty: 5 as number | null });
        mount(container, { model: [state, 'qty'], min: 0, step: 2 });
        const el = input(container);
        el.dispatchEvent(key('ArrowUp'));
        expect(state.qty).toBe(6);
        state.qty = 5;
        el.dispatchEvent(key('ArrowDown'));
        expect(state.qty).toBe(4);
        // On-grid values keep plain ±step.
        el.dispatchEvent(key('ArrowDown'));
        expect(state.qty).toBe(2);
    });

    it('an off-grid max steps down to the grid below it, not a full step past', () => {
        const state = signal({ qty: 5 as number | null });
        mount(container, { model: [state, 'qty'], min: 0, max: 5, step: 4 });
        input(container).dispatchEvent(key('ArrowDown'));
        expect(state.qty).toBe(4);
    });

    it('largeStep drives PageUp/PageDown and Shift+Arrow (#272)', () => {
        const state = signal({ qty: 50 as number | null });
        mount(container, { model: [state, 'qty'], min: 0, max: 100, largeStep: 25 });
        const el = input(container);
        el.dispatchEvent(key('PageUp'));
        expect(state.qty).toBe(75);
        el.dispatchEvent(key('PageDown'));
        expect(state.qty).toBe(50);
        el.dispatchEvent(key('ArrowUp', { shiftKey: true }));
        expect(state.qty).toBe(75);
        el.dispatchEvent(key('ArrowDown', { shiftKey: true }));
        expect(state.qty).toBe(50);
        el.dispatchEvent(key('ArrowUp'));
        expect(state.qty).toBe(51);
    });

    it('largeStep defaults to ten steps, Shift+Arrow included', () => {
        const state = signal({ qty: 10 as number | null });
        mount(container, { model: [state, 'qty'], step: 2 });
        input(container).dispatchEvent(key('ArrowUp', { shiftKey: true }));
        expect(state.qty).toBe(30);
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

    describe('locale and formatOptions (#300)', () => {
        it('displays the committed value through Intl and parses the locale back', () => {
            const state = signal({ qty: 1234.5 as number | null });
            mount(container, { model: [state, 'qty'], step: 0.01, locale: 'de-DE', name: 'n' });
            const el = input(container);
            expect(el.value).toBe('1.234,5');
            expect(el.getAttribute('aria-valuetext')).toBe('1.234,5');
            expect(el.getAttribute('aria-valuenow')).toBe('1234.5');
            type(el, '2.000,25');
            el.dispatchEvent(new FocusEvent('blur'));
            expect(state.qty).toBe(2000.25);
            expect(el.value).toBe('2.000,25');
            // The form still posts the canonical decimal.
            expect(container.querySelector<HTMLInputElement>('[data-part="hidden-input"]')!.value).toBe('2000.25');
            // Unparseable in this locale reverts.
            type(el, '12abc');
            el.dispatchEvent(new FocusEvent('blur'));
            expect(state.qty).toBe(2000.25);
            expect(el.value).toBe('2.000,25');
        });

        it('currency and percent formats round-trip through a commit', () => {
            const price = signal({ v: 5 as number | null });
            mount(container, { model: [price, 'v'], step: 0.01, locale: 'en-US', formatOptions: { style: 'currency', currency: 'USD' } });
            expect(input(container).value).toBe('$5.00');
            type(input(container), '$1,299.99');
            input(container).dispatchEvent(new FocusEvent('blur'));
            expect(price.v).toBe(1299.99);
            expect(input(container).value).toBe('$1,299.99');

            const c2 = document.createElement('div');
            document.body.appendChild(c2);
            const pct = signal({ v: 0.25 as number | null });
            mount(c2, { model: [pct, 'v'], min: 0, max: 1, locale: 'en-US', formatOptions: { style: 'percent' } });
            expect(input(c2).value).toBe('25%');
            type(input(c2), '40%');
            input(c2).dispatchEvent(new FocusEvent('blur'));
            expect(pct.v).toBe(0.4);
            // A percent format steps by one percent by default.
            input(c2).dispatchEvent(key('ArrowUp'));
            expect(pct.v).toBe(0.41);
            expect(input(c2).getAttribute('aria-valuetext')).toBe('41%');
        });

        it('formatOptions alone uses the runtime locale', () => {
            mount(container, { defaultValue: 3, formatOptions: { minimumFractionDigits: 2 } });
            expect(input(container).value).toBe(new Intl.NumberFormat(undefined, { minimumFractionDigits: 2 }).format(3));
        });

        it('custom format and parse still win', () => {
            const state = signal({ v: 2 as number | null });
            mount(container, {
                model: [state, 'v'],
                locale: 'de-DE',
                format: (v) => `#${v}`,
                parse: (t) => Number(t.replace('#', '')),
            });
            expect(input(container).value).toBe('#2');
            type(input(container), '#7');
            input(container).dispatchEvent(new FocusEvent('blur'));
            expect(state.v).toBe(7);
        });

        it('derives inputmode: numeric only for whole, non-negative fields', () => {
            mount(container, { defaultValue: 1, min: 0, locale: 'en-US', formatOptions: { maximumFractionDigits: 0 } });
            expect(input(container).getAttribute('inputmode')).toBe('numeric');
            const cases: Array<[number | undefined, Intl.NumberFormatOptions | undefined]> = [
                [undefined, { maximumFractionDigits: 0 }],
                [-5, { maximumFractionDigits: 0 }],
                [0, undefined],
            ];
            for (const [min, formatOptions] of cases) {
                const c = document.createElement('div');
                document.body.appendChild(c);
                mount(c, { defaultValue: 1, min, locale: 'en-US', formatOptions });
                expect(input(c).getAttribute('inputmode')).toBe('decimal');
            }
            // Without a locale format the field stays decimal (#300 is opt-in).
            const plain = document.createElement('div');
            document.body.appendChild(plain);
            mount(plain, { defaultValue: 1, min: 0 });
            expect(input(plain).getAttribute('inputmode')).toBe('decimal');
        });
    });
});
