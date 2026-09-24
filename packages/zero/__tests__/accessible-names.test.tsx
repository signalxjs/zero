/**
 * Accessible names (#169) — a visible Label names its widget without a
 * Field, and no ARIA/`for` reference points at an element that is not
 * rendered. Presence is registered a microtask after a part's setup (the
 * Dialog/NavList seam), so every test settles before reading.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { component, signal } from 'sigx';
import { Field, Progress, RadialProgress, RadioGroup, Slider } from '@sigx/zero';

let container: HTMLElement;
beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
});

const settle = () => new Promise((r) => setTimeout(r, 0));
const q = (scope: string, part: string) =>
    container.querySelector<HTMLElement>(`[data-scope="${scope}"][data-part="${part}"]`)!;
/** Every id an IDREF-list attribute names must exist in the document. */
const resolves = (el: Element, attr: string): boolean =>
    (el.getAttribute(attr) ?? '').split(/\s+/).filter(Boolean).every((id) => document.getElementById(id) !== null);

describe('RadioGroup.Label', () => {
    it('names a standalone radiogroup', async () => {
        render(
            <RadioGroup.Root>
                <RadioGroup.Label>Plan</RadioGroup.Label>
                <RadioGroup.Item value="a">A</RadioGroup.Item>
            </RadioGroup.Root>,
            container,
        );
        await settle();
        const root = q('radio-group', 'root');
        const label = q('radio-group', 'label');
        expect(label.id).toBeTruthy();
        expect(root.getAttribute('aria-labelledby')).toBe(label.id);
    });

    it('joins the Field label and an app value; without a Label nothing dangles', async () => {
        render(
            <div>
                <Field.Root>
                    <Field.Label>Billing</Field.Label>
                    <RadioGroup.Root aria-labelledby="extra">
                        <RadioGroup.Label>Plan</RadioGroup.Label>
                        <RadioGroup.Item value="a">A</RadioGroup.Item>
                    </RadioGroup.Root>
                </Field.Root>
                <span id="extra">Extra</span>
            </div>,
            container,
        );
        await settle();
        const root = q('radio-group', 'root');
        const ids = root.getAttribute('aria-labelledby')!.split(' ');
        expect(ids).toContain(q('field', 'label').id);
        expect(ids).toContain(q('radio-group', 'label').id);
        expect(ids).toContain('extra');
        expect(resolves(root, 'aria-labelledby')).toBe(true);

        container.innerHTML = '';
        render(<RadioGroup.Root><RadioGroup.Item value="a">A</RadioGroup.Item></RadioGroup.Root>, container);
        await settle();
        expect(q('radio-group', 'root').hasAttribute('aria-labelledby')).toBe(false);
    });

    it('drops the reference when the Label unmounts', async () => {
        const s = signal({ show: true });
        const App = component(() => () => (
            <RadioGroup.Root>
                {s.show ? <RadioGroup.Label>Plan</RadioGroup.Label> : null}
                <RadioGroup.Item value="a">A</RadioGroup.Item>
            </RadioGroup.Root>
        ));
        render(<App />, container);
        await settle();
        expect(q('radio-group', 'root').hasAttribute('aria-labelledby')).toBe(true);
        s.show = false;
        await settle();
        expect(q('radio-group', 'root').hasAttribute('aria-labelledby')).toBe(false);
    });
});

describe('Slider composed projection', () => {
    it('names unlabelled thumbs by Slider.Label, and no `for` dangles without a Control', async () => {
        const state = signal({ price: [20, 60] });
        render(
            <Slider.Root model={[state, 'price']}>
                <Slider.Label>Price</Slider.Label>
                <Slider.Track><Slider.Thumb /><Slider.Thumb /></Slider.Track>
                <Slider.ValueText />
            </Slider.Root>,
            container,
        );
        await settle();
        const label = q('slider', 'label');
        const output = q('slider', 'value-text');
        expect(label.hasAttribute('for')).toBe(false);
        expect(output.hasAttribute('for')).toBe(false);
        const thumbs = container.querySelectorAll<HTMLElement>('[data-part="thumb"]');
        for (const thumb of thumbs) {
            expect(thumb.getAttribute('aria-labelledby')).toBe(label.id);
            expect(resolves(thumb, 'aria-labelledby')).toBe(true);
        }
    });

    it("a thumb's own label names it (aria-labelledby would override it)", async () => {
        const state = signal({ price: [20, 60] });
        render(
            <Slider.Root model={[state, 'price']}>
                <Slider.Label>Price</Slider.Label>
                <Slider.Track><Slider.Thumb label="Minimum" /><Slider.Thumb label="Maximum" /></Slider.Track>
            </Slider.Root>,
            container,
        );
        await settle();
        const thumb = container.querySelector<HTMLElement>('[data-part="thumb"]')!;
        expect(thumb.getAttribute('aria-label')).toBe('Minimum');
        expect(thumb.hasAttribute('aria-labelledby')).toBe(false);
    });

    it('a thumb without any Label stays unreferenced', async () => {
        const state = signal({ price: [20, 60] });
        render(
            <Slider.Root model={[state, 'price']}>
                <Slider.Track><Slider.Thumb /><Slider.Thumb /></Slider.Track>
            </Slider.Root>,
            container,
        );
        await settle();
        const thumb = container.querySelector<HTMLElement>('[data-part="thumb"]')!;
        expect(thumb.hasAttribute('aria-labelledby')).toBe(false);
    });

    it('keeps `for` on the Label and ValueText while a Control is mounted', async () => {
        render(
            <Slider.Root defaultValue={30}>
                <Slider.Label>Volume</Slider.Label>
                <Slider.Control />
                <Slider.ValueText />
            </Slider.Root>,
            container,
        );
        await settle();
        const control = q('slider', 'control');
        expect(q('slider', 'label').getAttribute('for')).toBe(control.id);
        expect(q('slider', 'value-text').getAttribute('for')).toBe(control.id);
    });
});

describe('Progress / RadialProgress', () => {
    it('no Label, no aria-labelledby; aria-valuenow is clamped to [min, max]', async () => {
        render(
            <div>
                <Progress.Root value={150} aria-label="Upload"><Progress.Track><Progress.Range /></Progress.Track></Progress.Root>
                <RadialProgress.Root value={-20} aria-label="Sync" />
            </div>,
            container,
        );
        await settle();
        const bar = q('progress', 'root');
        expect(bar.hasAttribute('aria-labelledby')).toBe(false);
        expect(bar.getAttribute('aria-valuenow')).toBe('100');
        const ring = q('radial-progress', 'root');
        expect(ring.hasAttribute('aria-labelledby')).toBe(false);
        expect(ring.getAttribute('aria-valuenow')).toBe('0');
    });

    it('a Label names the bar, joined with an app value', async () => {
        render(
            <div>
                <Progress.Root value={1} aria-labelledby="heading"><Progress.Label>Upload</Progress.Label></Progress.Root>
                <RadialProgress.Root value={1}><RadialProgress.Label>Sync</RadialProgress.Label></RadialProgress.Root>
            </div>,
            container,
        );
        await settle();
        expect(q('progress', 'root').getAttribute('aria-labelledby')).toBe(`${q('progress', 'label').id} heading`);
        expect(q('radial-progress', 'root').getAttribute('aria-labelledby')).toBe(q('radial-progress', 'label').id);
    });
});
