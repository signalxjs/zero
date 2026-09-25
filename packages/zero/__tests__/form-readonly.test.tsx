/**
 * Readonly on the five controls text inputs already honoured it beside
 * (#267): checkbox, switch, radio-group, select and slider. Each one stays
 * focusable and renders `data-readonly` (plus `aria-readonly` where its role
 * supports it), refuses every user write, adopts the flag from a
 * `Field.Root readonly`, and never blocks a submit. Radio-group also gains
 * the `invalid` flag on its item and item-control, and `aria-orientation`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import {
    Checkbox,
    Field,
    RadioGroup,
    Select,
    Slider,
    Switch,
    checkboxAnatomy,
    radioGroupAnatomy,
    selectAnatomy,
    sliderAnatomy,
    switchAnatomy,
} from '@sigx/zero';
import { expectAnatomy } from './helpers';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

let container: HTMLElement;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});

const part = <E extends Element = HTMLElement>(scope: string, name: string, root: ParentNode = container): E =>
    root.querySelector<E>(`[data-scope="${scope}"][data-part="${name}"]`)!;
const parts = <E extends Element = HTMLElement>(scope: string, name: string, root: ParentNode = container): E[] =>
    [...root.querySelectorAll<E>(`[data-scope="${scope}"][data-part="${name}"]`)];
const key = (el: Element, k: string): KeyboardEvent => {
    const e = new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true });
    el.dispatchEvent(e);
    return e;
};

describe.each([
    ['checkbox', Checkbox, checkboxAnatomy],
    ['switch', Switch, switchAnatomy],
] as const)('%s readonly', (scope, Component, anatomy) => {
    it('renders the flag on root and control; a click, a label press and Space never toggle it', () => {
        const state = signal({ on: false });
        render(<Component.Root model={[state, 'on']} readonly>Terms</Component.Root>, container);
        expectAnatomy(container, anatomy);
        expect(part(scope, 'root').hasAttribute('data-readonly')).toBe(true);
        expect(part(scope, 'control').hasAttribute('data-readonly')).toBe(true);
        const input = part<HTMLInputElement>(scope, 'hidden-input');
        // Focusable: nothing disables it.
        expect(input.disabled).toBe(false);
        input.focus();
        expect(document.activeElement).toBe(input);

        input.click();
        expect(input.checked).toBe(false);
        expect(state.on).toBe(false);
        part(scope, 'label').click();
        expect(input.checked).toBe(false);
        expect(state.on).toBe(false);
        expect(part(scope, 'root').getAttribute('data-state')).toBe('unchecked');
    });

    it('a model write still lands — readonly refuses the user, not the app', () => {
        const state = signal({ on: false });
        render(<Component.Root model={[state, 'on']} readonly>Terms</Component.Root>, container);
        state.on = true;
        expect(part<HTMLInputElement>(scope, 'hidden-input').checked).toBe(true);
        expect(part(scope, 'root').getAttribute('data-state')).toBe('checked');
    });

    it('publishes no press feedback while readonly', () => {
        render(<Component.Root readonly>Terms</Component.Root>, container);
        part(scope, 'root').dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(part(scope, 'control').hasAttribute('data-pressed')).toBe(false);
    });

    it('adopts readonly from its Field, and a readonly required box never blocks the submit', () => {
        const form = container.appendChild(document.createElement('form'));
        render(
            <Field.Root readonly required>
                <Field.Label>Terms</Field.Label>
                <Component.Root name="terms">Agree</Component.Root>
            </Field.Root>,
            form,
        );
        expect(part(scope, 'root', form).hasAttribute('data-readonly')).toBe(true);
        expect(part(scope, 'root', form).hasAttribute('data-required')).toBe(true);
        const input = part<HTMLInputElement>(scope, 'hidden-input', form);
        expect(input.required).toBe(false);
        expect(form.checkValidity()).toBe(true);
    });

    it('without readonly the click still toggles', () => {
        const state = signal({ on: false });
        render(<Component.Root model={[state, 'on']}>Terms</Component.Root>, container);
        part<HTMLInputElement>(scope, 'hidden-input').click();
        expect(state.on).toBe(true);
        expect(part(scope, 'root').hasAttribute('data-readonly')).toBe(false);
    });
});

describe('aria-readonly by role', () => {
    it('checkbox carries it on its input; switch cannot (the role does not support it)', () => {
        render(
            <>
                <Checkbox.Root readonly>A</Checkbox.Root>
                <Switch.Root readonly>B</Switch.Root>
            </>,
            container,
        );
        expect(part('checkbox', 'hidden-input').getAttribute('aria-readonly')).toBe('true');
        expect(part('switch', 'hidden-input').hasAttribute('aria-readonly')).toBe(false);
    });
});

describe('RadioGroup readonly', () => {
    const mount = (state: { plan: string }, extra: { readonly?: boolean; invalid?: boolean } = {}) => render(
        <RadioGroup.Root model={[state, 'plan']} readonly={extra.readonly} invalid={extra.invalid}>
            <RadioGroup.Label>Plan</RadioGroup.Label>
            <RadioGroup.Item value="free">Free</RadioGroup.Item>
            <RadioGroup.Item value="pro">Pro</RadioGroup.Item>
        </RadioGroup.Root>,
        container,
    );

    it('renders data-readonly on root, item and item-control and aria-readonly on the radiogroup', () => {
        mount(signal({ plan: 'free' }), { readonly: true });
        expectAnatomy(container, radioGroupAnatomy);
        const root = part('radio-group', 'root');
        expect(root.hasAttribute('data-readonly')).toBe(true);
        expect(root.getAttribute('aria-readonly')).toBe('true');
        for (const name of ['item', 'item-control']) {
            for (const el of parts('radio-group', name)) expect(el.hasAttribute('data-readonly')).toBe(true);
        }
    });

    it('a click or a label press never changes the value; the radios stay focusable', () => {
        const state = signal({ plan: 'free' });
        mount(state, { readonly: true });
        const radios = parts<HTMLInputElement>('radio-group', 'hidden-input');
        expect(radios.every((r) => !r.disabled)).toBe(true);
        radios[1]!.focus();
        expect(document.activeElement).toBe(radios[1]);
        radios[1]!.click();
        expect(state.plan).toBe('free');
        // The clicked radio is put back. Re-checking the previous one is the
        // platform's half of a cancelled activation, which happy-dom does not
        // run — the e2e forms spec holds it in three real engines.
        expect(radios[1]!.checked).toBe(false);
        parts('radio-group', 'item-label')[1]!.click();
        expect(state.plan).toBe('free');
        expect(parts('radio-group', 'item')[0]!.getAttribute('data-state')).toBe('checked');
    });

    it('adopts readonly from its Field, and a readonly required group never blocks the submit', () => {
        const form = container.appendChild(document.createElement('form'));
        render(
            <Field.Root readonly required>
                <Field.Label>Plan</Field.Label>
                <RadioGroup.Root name="plan">
                    <RadioGroup.Item value="free">Free</RadioGroup.Item>
                </RadioGroup.Root>
            </Field.Root>,
            form,
        );
        expect(part('radio-group', 'root', form).hasAttribute('data-readonly')).toBe(true);
        expect(part<HTMLInputElement>('radio-group', 'hidden-input', form).required).toBe(false);
        expect(form.checkValidity()).toBe(true);
    });

    it('invalid lands on each item and item-control, not only the root', () => {
        mount(signal({ plan: 'free' }), { invalid: true });
        expectAnatomy(container, radioGroupAnatomy);
        for (const name of ['item', 'item-control']) {
            const els = parts('radio-group', name);
            expect(els.length).toBe(2);
            for (const el of els) expect(el.hasAttribute('data-invalid')).toBe(true);
        }
    });

    it('aria-orientation follows the orientation', () => {
        render(
            <RadioGroup.Root orientation="horizontal">
                <RadioGroup.Item value="a">A</RadioGroup.Item>
            </RadioGroup.Root>,
            container,
        );
        expect(part('radio-group', 'root').getAttribute('aria-orientation')).toBe('horizontal');
        const second = document.body.appendChild(document.createElement('div'));
        render(<RadioGroup.Root><RadioGroup.Item value="a">A</RadioGroup.Item></RadioGroup.Root>, second);
        expect(part('radio-group', 'root', second).getAttribute('aria-orientation')).toBe('vertical');
    });
});

describe('Select readonly', () => {
    const mount = (state: { fruit: string }, readonly = true) => render(
        <Select.Root model={[state, 'fruit']} placeholder="Pick…" name="fruit" readonly={readonly}>
            <Select.Trigger label="Fruit">
                <Select.Value />
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popup>
                <Select.Item value="apple">Apple</Select.Item>
                <Select.Item value="banana">Banana</Select.Item>
            </Select.Popup>
        </Select.Root>,
        container,
    );

    it('renders the flag on root and trigger, aria-readonly on the combobox; the trigger stays focusable', () => {
        mount(signal({ fruit: 'apple' }));
        expectAnatomy(container, selectAnatomy);
        expect(part('select', 'root').hasAttribute('data-readonly')).toBe(true);
        const trigger = part<HTMLButtonElement>('select', 'trigger');
        expect(trigger.hasAttribute('data-readonly')).toBe(true);
        expect(trigger.getAttribute('aria-readonly')).toBe('true');
        expect(trigger.disabled).toBe(false);
        trigger.focus();
        expect(document.activeElement).toBe(trigger);
    });

    it('does not open on click or on an opening key, and the keys are not swallowed', () => {
        mount(signal({ fruit: 'apple' }));
        const trigger = part('select', 'trigger');
        trigger.click();
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        for (const k of ['ArrowDown', 'ArrowUp', 'Enter', ' ']) {
            expect(key(trigger, k).defaultPrevented).toBe(false);
            expect(trigger.getAttribute('aria-expanded')).toBe('false');
        }
    });

    it('the closed typeahead does not change the value', async () => {
        const state = signal({ fruit: 'apple' });
        mount(state);
        key(part('select', 'trigger'), 'b');
        await tick();
        expect(state.fruit).toBe('apple');
        expect(part('select', 'value').textContent).toBe('Apple');
    });

    it('a popup the app opens still selects nothing', () => {
        const state = signal({ fruit: 'apple' });
        const open = signal({ value: true });
        render(
            <Select.Root model={[state, 'fruit']} model:open={[open, 'value']} readonly>
                <Select.Trigger label="Fruit"><Select.Value /></Select.Trigger>
                <Select.Popup>
                    <Select.Item value="apple">Apple</Select.Item>
                    <Select.Item value="banana">Banana</Select.Item>
                </Select.Popup>
            </Select.Root>,
            container,
        );
        parts('select', 'item')[1]!.click();
        expect(state.fruit).toBe('apple');
    });

    it('adopts readonly from its Field, and a readonly required select never blocks the submit', () => {
        const form = container.appendChild(document.createElement('form'));
        render(
            <Field.Root readonly required>
                <Field.Label>Fruit</Field.Label>
                <Select.Root name="fruit" placeholder="Pick…">
                    <Select.Trigger><Select.Value /></Select.Trigger>
                    <Select.Popup><Select.Item value="apple">Apple</Select.Item></Select.Popup>
                </Select.Root>
            </Field.Root>,
            form,
        );
        expect(part('select', 'trigger', form).hasAttribute('data-readonly')).toBe(true);
        expect(part<HTMLSelectElement>('select', 'hidden-input', form).required).toBe(false);
        expect(form.checkValidity()).toBe(true);
    });

    it('without readonly the trigger still opens', () => {
        mount(signal({ fruit: '' }), false);
        const trigger = part('select', 'trigger');
        trigger.click();
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(trigger.hasAttribute('data-readonly')).toBe(false);
    });
});

describe('Slider readonly', () => {
    it('native projection: flags on root and control, aria-readonly, value keys cancelled, input put back', () => {
        const state = signal({ volume: 30 });
        render(
            <Slider.Root model={[state, 'volume']} readonly>
                <Slider.Label>Volume</Slider.Label>
                <Slider.Control />
            </Slider.Root>,
            container,
        );
        expectAnatomy(container, sliderAnatomy);
        expect(part('slider', 'root').hasAttribute('data-readonly')).toBe(true);
        const input = part<HTMLInputElement>('slider', 'control');
        expect(input.hasAttribute('data-readonly')).toBe(true);
        expect(input.getAttribute('aria-readonly')).toBe('true');
        expect(input.disabled).toBe(false);
        expect(key(input, 'ArrowRight').defaultPrevented).toBe(true);
        expect(key(input, 'Tab').defaultPrevented).toBe(false);

        input.value = '70';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        expect(state.volume).toBe(30);
        expect(input.value).toBe('30');

        input.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(input.hasAttribute('data-pressed')).toBe(false);
    });

    it('composed projection: flags on track and thumbs; keys and presses move nothing and are not swallowed', () => {
        const state = signal({ price: [20, 60] });
        render(
            <Slider.Root model={[state, 'price']} readonly>
                <Slider.Track>
                    <Slider.Range />
                    <Slider.Thumb label="Min" />
                    <Slider.Thumb label="Max" />
                </Slider.Track>
            </Slider.Root>,
            container,
        );
        expectAnatomy(container, sliderAnatomy);
        const track = part('slider', 'track');
        expect(track.hasAttribute('data-readonly')).toBe(true);
        const thumbs = parts('slider', 'thumb');
        for (const t of thumbs) {
            expect(t.hasAttribute('data-readonly')).toBe(true);
            expect(t.getAttribute('aria-readonly')).toBe('true');
            expect(t.tabIndex).toBe(0);
        }
        for (const k of ['ArrowRight', 'PageUp', 'Home', 'End']) {
            expect(key(thumbs[0]!, k).defaultPrevented).toBe(false);
        }
        expect(state.price).toEqual([20, 60]);

        track.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 0, bubbles: true, cancelable: true }));
        thumbs[1]!.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true, cancelable: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: 0 }));
        window.dispatchEvent(new PointerEvent('pointerup', {}));
        expect(state.price).toEqual([20, 60]);
        expect(thumbs[1]!.hasAttribute('data-pressed')).toBe(false);
    });

    it('adopts readonly from its Field', () => {
        render(
            <Field.Root readonly>
                <Field.Label>Volume</Field.Label>
                <Slider.Root defaultValue={40}>
                    <Slider.Control />
                </Slider.Root>
            </Field.Root>,
            container,
        );
        expect(part('slider', 'root').hasAttribute('data-readonly')).toBe(true);
        expect(part('slider', 'control').getAttribute('aria-readonly')).toBe('true');
    });
});
