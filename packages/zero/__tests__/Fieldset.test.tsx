/**
 * Fieldset (#285): a native `<fieldset>` + `<legend>`, and the context that
 * carries its disabled / readonly / invalid to the controls the platform
 * cannot reach — the ones zero renders as non-native elements.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { renderToString } from '@sigx/server-renderer';
import { component, defineApp, signal } from 'sigx';
import {
    Checkbox,
    Field,
    Fieldset,
    FileUpload,
    Input,
    RadioGroup,
    RatingGroup,
    Select,
    Slider,
    ToggleGroup,
    fieldsetAnatomy,
    zeroPlugin,
} from '@sigx/zero';
import { expectAnatomy } from './helpers';

let container: HTMLElement;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});

const part = <E extends Element = HTMLElement>(scope: string, name: string, root: ParentNode = container): E =>
    root.querySelector<E>(`[data-scope="${scope}"][data-part="${name}"]`)!;
const parts = <E extends Element = HTMLElement>(scope: string, name: string, root: ParentNode = container): E[] =>
    [...root.querySelectorAll<E>(`[data-scope="${scope}"][data-part="${name}"]`)];
const key = (el: Element, k: string): void => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true }));
};

describe('Fieldset anatomy', () => {
    it('renders a native fieldset whose first child is the native legend', () => {
        render(
            <Fieldset.Root color="primary" size="sm">
                <Fieldset.Legend>Shipping</Fieldset.Legend>
                <Input.Root name="street"><Input.Input /></Input.Root>
            </Fieldset.Root>,
            container,
        );
        expectAnatomy(container, fieldsetAnatomy);
        const root = part('fieldset', 'root');
        const legend = part('fieldset', 'legend');
        expect(root.tagName).toBe('FIELDSET');
        expect(legend.tagName).toBe('LEGEND');
        expect(root.firstElementChild).toBe(legend);
        // The platform names the group from the legend — no ARIA of our own.
        expect(root.hasAttribute('aria-labelledby')).toBe(false);
        expect(root.hasAttribute('role')).toBe(false);
        expect(root.getAttribute('data-color')).toBe('primary');
        expect(root.getAttribute('data-size')).toBe('sm');
        for (const flag of ['data-disabled', 'data-readonly', 'data-invalid']) {
            expect(root.hasAttribute(flag)).toBe(false);
            expect(legend.hasAttribute(flag)).toBe(false);
        }
    });

    it('declares the parts, the flags and no models', () => {
        expect(fieldsetAnatomy.partNames()).toEqual(['root', 'legend']);
        expect(fieldsetAnatomy.parts.root.element).toBe('fieldset');
        expect(fieldsetAnatomy.parts.legend.element).toBe('legend');
        expect(fieldsetAnatomy.parts.legend.parent).toBe('root');
        expect(fieldsetAnatomy.models ?? []).toEqual([]);
    });

    it('renders the flags presence-only, on the root and the legend, and follows the props', async () => {
        const s = signal({ disabled: true, readonly: true, invalid: true });
        const App = component(() => () => (
            <Fieldset.Root disabled={s.disabled} readonly={s.readonly} invalid={s.invalid}>
                <Fieldset.Legend>Shipping</Fieldset.Legend>
            </Fieldset.Root>
        ));
        render(<App />, container);
        expectAnatomy(container, fieldsetAnatomy);
        const root = part<HTMLFieldSetElement>('fieldset', 'root');
        const legend = part('fieldset', 'legend');
        expect(root.disabled).toBe(true);
        expect(root.getAttribute('data-disabled')).toBe('');
        expect(root.getAttribute('data-readonly')).toBe('');
        expect(root.getAttribute('data-invalid')).toBe('');
        expect(legend.getAttribute('data-disabled')).toBe('');
        expect(legend.getAttribute('data-invalid')).toBe('');

        s.disabled = false;
        s.readonly = false;
        s.invalid = false;
        await Promise.resolve();
        expect(root.disabled).toBe(false);
        for (const flag of ['data-disabled', 'data-readonly', 'data-invalid']) {
            expect(root.hasAttribute(flag)).toBe(false);
        }
        expect(legend.hasAttribute('data-disabled')).toBe(false);
    });

    it('server-renders the same markup, with the flags', async () => {
        const app = defineApp(
            <Fieldset.Root disabled invalid>
                <Fieldset.Legend>Shipping</Fieldset.Legend>
                <Slider.Root name="priority" defaultValue={[3]} min={0} max={5}>
                    <Slider.Track><Slider.Thumb label="Priority" /></Slider.Track>
                </Slider.Root>
            </Fieldset.Root>,
        );
        app.use(zeroPlugin());
        const html = await renderToString(app);
        expect(html).toMatch(/<fieldset[^>]*disabled/);
        expect(html).toMatch(/<fieldset[^>]*data-scope="fieldset"[^>]*data-part="root"/);
        expect(html).toMatch(/<legend[^>]*data-part="legend"[^>]*data-disabled=""/);
        expect(html).toMatch(/data-scope="slider" data-part="thumb"[^>]*data-disabled=""/);
    });
});

describe('Fieldset disabled reaches the controls the platform does not', () => {
    it('slider thumbs: data-disabled, aria-disabled, no keyboard steps', () => {
        const state = signal({ v: [2] as number[] });
        render(
            <Fieldset.Root disabled>
                <Fieldset.Legend>Priority</Fieldset.Legend>
                <Slider.Root model={[state, 'v']} min={0} max={5}>
                    <Slider.Track><Slider.Thumb label="Priority" /></Slider.Track>
                </Slider.Root>
            </Fieldset.Root>,
            container,
        );
        const thumb = part('slider', 'thumb');
        expect(thumb.getAttribute('data-disabled')).toBe('');
        expect(thumb.getAttribute('aria-disabled')).toBe('true');
        expect(part('slider', 'root').getAttribute('data-disabled')).toBe('');
        key(thumb, 'ArrowRight');
        expect(state.v).toEqual([2]);
    });

    it('radio-group items: data-disabled, and a click selects nothing', () => {
        const state = signal({ plan: 'free' });
        render(
            <Fieldset.Root disabled>
                <RadioGroup.Root model={[state, 'plan']}>
                    <RadioGroup.Label>Plan</RadioGroup.Label>
                    <RadioGroup.Item value="free">Free</RadioGroup.Item>
                    <RadioGroup.Item value="pro">Pro</RadioGroup.Item>
                </RadioGroup.Root>
            </Fieldset.Root>,
            container,
        );
        const items = parts('radio-group', 'item');
        expect(items.every((el) => el.hasAttribute('data-disabled'))).toBe(true);
        items[1]!.click();
        expect(state.plan).toBe('free');
    });

    it('select trigger, rating items, toggle-group items and the file-upload trigger', () => {
        render(
            <Fieldset.Root disabled>
                <Select.Root name="fruit" placeholder="Pick…">
                    <Select.Trigger label="Fruit"><Select.Value /></Select.Trigger>
                    <Select.Popup>
                        <Select.Item value="apple">Apple</Select.Item>
                    </Select.Popup>
                </Select.Root>
                <RatingGroup.Root name="stars" defaultValue={2}>
                    <RatingGroup.Label>Stars</RatingGroup.Label>
                    <RatingGroup.Control />
                </RatingGroup.Root>
                <ToggleGroup.Root name="align">
                    <ToggleGroup.Item value="l">L</ToggleGroup.Item>
                </ToggleGroup.Root>
                <FileUpload.Root name="files">
                    <FileUpload.Trigger>Browse</FileUpload.Trigger>
                </FileUpload.Root>
            </Fieldset.Root>,
            container,
        );
        expect(part('select', 'trigger').hasAttribute('data-disabled')).toBe(true);
        expect(part('select', 'root').hasAttribute('data-disabled')).toBe(true);
        expect(parts('rating-group', 'item').every((el) => el.hasAttribute('data-disabled'))).toBe(true);
        expect(part('toggle-group', 'item').hasAttribute('data-disabled')).toBe(true);
        expect(part('file-upload', 'trigger').hasAttribute('data-disabled')).toBe(true);
        // A disabled control never posts — the hidden control says so too.
        expect(part<HTMLSelectElement>('select', 'hidden-input').disabled).toBe(true);
    });

    it('a Field inside adopts it: the Field, its Label and its control', () => {
        render(
            <Fieldset.Root disabled>
                <Field.Root>
                    <Field.Label>Street</Field.Label>
                    <Input.Root name="street"><Input.Input /></Input.Root>
                </Field.Root>
            </Fieldset.Root>,
            container,
        );
        expect(part('field', 'root').hasAttribute('data-disabled')).toBe(true);
        expect(part('field', 'label').hasAttribute('data-disabled')).toBe(true);
        expect(part('input', 'root').hasAttribute('data-disabled')).toBe(true);
        expect(part<HTMLInputElement>('input', 'input').disabled).toBe(true);
    });

    it('follows the prop both ways', async () => {
        const s = signal({ off: true });
        const App = component(() => () => (
            <Fieldset.Root disabled={s.off}>
                <Checkbox.Root name="terms">Terms</Checkbox.Root>
            </Fieldset.Root>
        ));
        render(<App />, container);
        expect(part('checkbox', 'root').hasAttribute('data-disabled')).toBe(true);
        s.off = false;
        await Promise.resolve();
        expect(part('checkbox', 'root').hasAttribute('data-disabled')).toBe(false);
        expect(part<HTMLInputElement>('checkbox', 'hidden-input').disabled).toBe(false);
    });
});

describe('Fieldset readonly and invalid', () => {
    it('readonly reaches a text input (native attribute) and a checkbox (flag)', () => {
        render(
            <Fieldset.Root readonly>
                <Input.Root name="street"><Input.Input /></Input.Root>
                <Checkbox.Root name="terms">Terms</Checkbox.Root>
            </Fieldset.Root>,
            container,
        );
        expect(part<HTMLInputElement>('input', 'input').readOnly).toBe(true);
        expect(part('input', 'root').hasAttribute('data-readonly')).toBe(true);
        expect(part('checkbox', 'root').hasAttribute('data-readonly')).toBe(true);
        // Readonly is not disabled: the controls still post and take focus.
        expect(part<HTMLInputElement>('input', 'input').disabled).toBe(false);
        expect(part<HTMLFieldSetElement>('fieldset', 'root').disabled).toBe(false);
    });

    it('invalid reaches every control and a Field inside', () => {
        render(
            <Fieldset.Root invalid>
                <Field.Root>
                    <Field.Label>Street</Field.Label>
                    <Input.Root name="street"><Input.Input /></Input.Root>
                </Field.Root>
                <Checkbox.Root name="terms">Terms</Checkbox.Root>
            </Fieldset.Root>,
            container,
        );
        expect(part('field', 'root').hasAttribute('data-invalid')).toBe(true);
        expect(part('input', 'root').hasAttribute('data-invalid')).toBe(true);
        expect(part('input', 'input').getAttribute('aria-invalid')).toBe('true');
        expect(part('checkbox', 'root').hasAttribute('data-invalid')).toBe(true);
    });
});

describe('Fieldset nesting and the legend exemption', () => {
    it('nested fieldsets chain: an outer flag reaches the inner group and its controls', () => {
        render(
            <Fieldset.Root disabled readonly>
                <Fieldset.Legend>Outer</Fieldset.Legend>
                <Fieldset.Root invalid>
                    <Fieldset.Legend>Inner</Fieldset.Legend>
                    <Slider.Root name="v" defaultValue={[1]}>
                        <Slider.Track><Slider.Thumb label="Level" /></Slider.Track>
                    </Slider.Root>
                </Fieldset.Root>
            </Fieldset.Root>,
            container,
        );
        const [outer, inner] = parts('fieldset', 'root');
        expect(outer!.hasAttribute('data-invalid')).toBe(false);
        expect(inner!.hasAttribute('data-disabled')).toBe(true);
        expect(inner!.hasAttribute('data-readonly')).toBe(true);
        expect(inner!.hasAttribute('data-invalid')).toBe(true);
        const thumb = part('slider', 'thumb');
        expect(thumb.hasAttribute('data-disabled')).toBe(true);
        expect(part('slider', 'root').hasAttribute('data-invalid')).toBe(true);
    });

    it('a control in the legend answers to the fieldsets outside, as the platform rules', async () => {
        const s = signal({ on: false });
        const App = component(() => () => (
            <Fieldset.Root disabled={!s.on} invalid>
                <Fieldset.Legend>
                    <Checkbox.Root model={[s, 'on']}>Ship somewhere else</Checkbox.Root>
                </Fieldset.Legend>
                <Input.Root name="street"><Input.Input /></Input.Root>
            </Fieldset.Root>
        ));
        render(<App />, container);
        const checkbox = part('checkbox', 'root');
        expect(checkbox.hasAttribute('data-disabled')).toBe(false);
        expect(checkbox.hasAttribute('data-invalid')).toBe(false);
        expect(part('input', 'root').hasAttribute('data-disabled')).toBe(true);
        part<HTMLInputElement>('checkbox', 'hidden-input').click();
        expect(s.on).toBe(true);
        await Promise.resolve();
        expect(part('input', 'root').hasAttribute('data-disabled')).toBe(false);
    });

    it('a legend inside a disabled fieldset still answers to an outer disabled one', () => {
        render(
            <Fieldset.Root disabled>
                <Fieldset.Root>
                    <Fieldset.Legend>
                        <Checkbox.Root>Inner toggle</Checkbox.Root>
                    </Fieldset.Legend>
                </Fieldset.Root>
            </Fieldset.Root>,
            container,
        );
        expect(part('checkbox', 'root').hasAttribute('data-disabled')).toBe(true);
    });
});
