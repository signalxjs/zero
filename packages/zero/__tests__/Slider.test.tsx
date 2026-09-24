/**
 * Slider range/multi-thumb (#325 item 3) — the composed track/range/thumb
 * projection over `model: number[]`. The single-thumb native-input projection
 * keeps its own tests in `forms.test.tsx`, untouched: backward compatibility
 * is part of the contract here.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Slider, sliderAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

let container: HTMLElement;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});

function mountRange(state: { price: number[] }, extra: {
    getValueText?: (value: number, index: number) => string;
    marks?: readonly (number | { value: number; label?: string })[];
    disabled?: boolean;
    onValueChange?: (v: number | number[]) => void;
} = {}) {
    render(
        <Slider.Root
            model={[state, 'price']}
            min={0}
            max={100}
            step={1}
            name="price"
            disabled={extra.disabled}
            getValueText={extra.getValueText}
            marks={extra.marks}
            onValueChange={extra.onValueChange}
        >
            <Slider.Label>Price range</Slider.Label>
            <Slider.Track>
                <Slider.Range />
                <Slider.Thumb label="Minimum price" />
                <Slider.Thumb label="Maximum price" />
            </Slider.Track>
            <Slider.ValueText />
        </Slider.Root>,
        container,
    );
    return {
        thumbs: container.querySelectorAll<HTMLElement>('[data-part="thumb"]'),
        track: container.querySelector<HTMLElement>('[data-part="track"]')!,
        range: container.querySelector<HTMLElement>('[data-part="range"]')!,
    };
}

const key = (el: HTMLElement, k: string) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true }));

describe('Slider range', () => {
    it('renders one APG slider thumb per value, with a valid anatomy', () => {
        const { thumbs } = mountRange(signal({ price: [20, 60] }));
        expectAnatomy(container, sliderAnatomy);
        expect(thumbs.length).toBe(2);
        expect(thumbs[0]!.getAttribute('role')).toBe('slider');
        expect(thumbs[0]!.getAttribute('aria-valuenow')).toBe('20');
        expect(thumbs[1]!.getAttribute('aria-valuenow')).toBe('60');
        expect(thumbs[0]!.getAttribute('aria-label')).toBe('Minimum price');
        expect(thumbs[0]!.getAttribute('tabindex')).toBe('0');
        expect(thumbs[1]!.getAttribute('tabindex')).toBe('0');
        expect(thumbs[0]!.getAttribute('aria-orientation')).toBe('horizontal');
    });

    it('per-thumb aria bounds are clamped at the neighbor (APG multi-thumb)', () => {
        const { thumbs } = mountRange(signal({ price: [20, 60] }));
        expect(thumbs[0]!.getAttribute('aria-valuemin')).toBe('0');
        expect(thumbs[0]!.getAttribute('aria-valuemax')).toBe('60');
        expect(thumbs[1]!.getAttribute('aria-valuemin')).toBe('20');
        expect(thumbs[1]!.getAttribute('aria-valuemax')).toBe('100');
    });

    it('arrow keys step the focused thumb; Home/End go to its allowed bounds', () => {
        const state = signal({ price: [20, 60] });
        const { thumbs } = mountRange(state);
        key(thumbs[0]!, 'ArrowRight');
        expect(state.price).toEqual([21, 60]);
        key(thumbs[0]!, 'ArrowLeft');
        expect(state.price).toEqual([20, 60]);
        key(thumbs[0]!, 'PageUp');
        expect(state.price).toEqual([30, 60]);
        key(thumbs[0]!, 'Home');
        expect(state.price).toEqual([0, 60]);
        // End on the LOWER thumb clamps at the higher thumb, not at max.
        key(thumbs[0]!, 'End');
        expect(state.price).toEqual([60, 60]);
        key(thumbs[1]!, 'End');
        expect(state.price).toEqual([60, 100]);
    });

    it('thumbs cannot cross: stepping past the neighbor clamps', () => {
        const state = signal({ price: [58, 60] });
        const { thumbs } = mountRange(state);
        key(thumbs[0]!, 'PageUp');
        expect(state.price).toEqual([60, 60]);
        key(thumbs[1]!, 'PageDown');
        expect(state.price).toEqual([60, 60]);
        key(thumbs[1]!, 'Home');
        expect(state.price).toEqual([60, 60]);
    });

    it('the range part spans lowest to highest value', () => {
        const { range } = mountRange(signal({ price: [20, 60] }));
        expect(range.style.insetInlineStart).toBe('20%');
        expect(range.style.inlineSize).toBe('40%');
    });

    it('value text lists both values; getValueText feeds aria-valuetext', () => {
        const { thumbs } = mountRange(signal({ price: [20, 60] }), {
            getValueText: (v, i) => `${v} dollars (${i === 0 ? 'min' : 'max'})`,
        });
        expect(container.querySelector('[data-part="value-text"]')!.textContent).toBe('20 – 60');
        expect(thumbs[0]!.getAttribute('aria-valuetext')).toBe('20 dollars (min)');
        expect(thumbs[1]!.getAttribute('aria-valuetext')).toBe('60 dollars (max)');
    });

    it('posts one hidden input per value under the shared name', () => {
        mountRange(signal({ price: [20, 60] }));
        const inputs = container.querySelectorAll<HTMLInputElement>('[data-part="hidden-input"]');
        expect(inputs.length).toBe(2);
        expect(inputs[0]!.name).toBe('price');
        expect(inputs[0]!.value).toBe('20');
        expect(inputs[1]!.value).toBe('60');
    });

    it('valueChange emits the array shape', () => {
        const onValueChange = vi.fn();
        const state = signal({ price: [20, 60] });
        const { thumbs } = mountRange(state, { onValueChange });
        key(thumbs[1]!, 'ArrowUp');
        expect(onValueChange).toHaveBeenCalledWith([20, 61]);
    });

    it('marks render as positioned tick parts with their labels', () => {
        mountRange(signal({ price: [20, 60] }), { marks: [0, { value: 50, label: '50%' }, 100] });
        const marks = container.querySelectorAll<HTMLElement>('[data-part="mark"]');
        expect(marks.length).toBe(3);
        expect(marks[1]!.style.insetInlineStart).toBe('50%');
        expect(marks[1]!.textContent).toBe('50%');
        expect(marks[0]!.textContent).toBe('');
        expectAnatomy(container, sliderAnatomy);
    });

    it('a pointer press on the track moves the nearest thumb and starts a drag', () => {
        const state = signal({ price: [20, 60] });
        const { track, thumbs } = mountRange(state);
        track.getBoundingClientRect = () =>
            ({ left: 0, top: 0, right: 100, bottom: 10, width: 100, height: 10, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
        track.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 30, bubbles: true }));
        expect(state.price).toEqual([30, 60]);
        expect(document.activeElement).toBe(thumbs[0]);
        // The drag continues from window-level moves…
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: 45 }));
        expect(state.price).toEqual([45, 60]);
        // …cannot cross the other thumb…
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: 80 }));
        expect(state.price).toEqual([60, 60]);
        // …and ends on release.
        window.dispatchEvent(new PointerEvent('pointerup', {}));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: 10 }));
        expect(state.price).toEqual([60, 60]);
    });

    it('disabled: thumbs leave the tab order and ignore keys and pointers', () => {
        const state = signal({ price: [20, 60] });
        const { thumbs, track } = mountRange(state, { disabled: true });
        expect(thumbs[0]!.hasAttribute('tabindex')).toBe(false);
        expect(thumbs[0]!.getAttribute('aria-disabled')).toBe('true');
        expect(thumbs[0]!.getAttribute('data-disabled')).toBe('');
        key(thumbs[0]!, 'ArrowRight');
        expect(state.price).toEqual([20, 60]);
        track.getBoundingClientRect = () =>
            ({ left: 0, top: 0, right: 100, bottom: 10, width: 100, height: 10, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
        track.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 30, bubbles: true }));
        expect(state.price).toEqual([20, 60]);
    });

    it('the composed projection works for a single number model too', () => {
        const state = signal({ volume: 40 });
        render(
            <Slider.Root model={[state, 'volume']} min={0} max={100}>
                <Slider.Track>
                    <Slider.Range />
                    <Slider.Thumb label="Volume" />
                </Slider.Track>
            </Slider.Root>,
            container,
        );
        const thumb = container.querySelector<HTMLElement>('[data-part="thumb"]')!;
        const range = container.querySelector<HTMLElement>('[data-part="range"]')!;
        expect(thumb.getAttribute('aria-valuenow')).toBe('40');
        // A single-value range fills from min to the value, progress-style.
        expect(range.style.insetInlineStart).toBe('0%');
        expect(range.style.inlineSize).toBe('40%');
        key(thumb, 'ArrowRight');
        // The model keeps its scalar shape.
        expect(state.volume).toBe(41);
    });

    it('keyboard steps honor a fractional step without float drift', () => {
        const state = signal({ price: [0.2, 0.6] });
        render(
            <Slider.Root model={[state, 'price']} min={0} max={1} step={0.1}>
                <Slider.Track>
                    <Slider.Thumb />
                    <Slider.Thumb />
                </Slider.Track>
            </Slider.Root>,
            container,
        );
        const thumb = container.querySelectorAll<HTMLElement>('[data-part="thumb"]')[0]!;
        key(thumb, 'ArrowRight');
        expect(state.price).toEqual([0.3, 0.6]);
    });
});

describe('Slider orientation (#170)', () => {
    const rect = { left: 0, top: 0, right: 10, bottom: 100, width: 10, height: 100, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;

    function mountVertical(state: { price: number[] }) {
        render(
            <Slider.Root model={[state, 'price']} min={0} max={100} orientation="vertical" marks={[50]}>
                <Slider.Track>
                    <Slider.Range />
                    <Slider.Thumb label="Low" />
                    <Slider.Thumb label="High" />
                </Slider.Track>
            </Slider.Root>,
            container,
        );
        return {
            root: container.querySelector<HTMLElement>('[data-part="root"]')!,
            thumbs: container.querySelectorAll<HTMLElement>('[data-part="thumb"]'),
            track: container.querySelector<HTMLElement>('[data-part="track"]')!,
            range: container.querySelector<HTMLElement>('[data-part="range"]')!,
            mark: container.querySelector<HTMLElement>('[data-part="mark"]')!,
        };
    }

    it('defaults to horizontal and says so on the root and the positioned parts', () => {
        mountRange(signal({ price: [20, 60] }), { marks: [50] });
        for (const part of ['root', 'track', 'range', 'thumb', 'mark']) {
            expect(container.querySelector(`[data-part="${part}"]`)!.getAttribute('data-orientation')).toBe('horizontal');
        }
    });

    it('orientation="vertical" renders data-orientation and aria-orientation', () => {
        const { thumbs } = mountVertical(signal({ price: [20, 60] }));
        for (const part of ['root', 'track', 'range', 'thumb', 'mark']) {
            expect(container.querySelector(`[data-part="${part}"]`)!.getAttribute('data-orientation')).toBe('vertical');
        }
        expect(thumbs[0]!.getAttribute('aria-orientation')).toBe('vertical');
        expect(thumbs[1]!.getAttribute('aria-orientation')).toBe('vertical');
        expectAnatomy(container, sliderAnatomy);
    });

    it('positions the moving parts bottom-to-top on the block axis', () => {
        const { thumbs, range, mark } = mountVertical(signal({ price: [20, 60] }));
        expect(thumbs[0]!.style.bottom).toBe('20%');
        expect(thumbs[1]!.style.bottom).toBe('60%');
        expect(thumbs[0]!.style.insetInlineStart).toBe('');
        expect(range.style.bottom).toBe('20%');
        expect(range.style.height).toBe('40%');
        expect(range.style.inlineSize).toBe('');
        expect(mark.style.bottom).toBe('50%');
    });

    it('maps the pointer through clientY, bottom-to-top', () => {
        const state = signal({ price: [20, 60] });
        const { track } = mountVertical(state);
        track.getBoundingClientRect = () => rect;
        // 70px down a 100px rail is 30% up it.
        track.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 90, clientY: 70, bubbles: true }));
        expect(state.price).toEqual([30, 60]);
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, clientY: 90 }));
        expect(state.price).toEqual([10, 60]);
        window.dispatchEvent(new PointerEvent('pointerup', {}));
    });

    it('maps the pointer against the padding box, not the border box', () => {
        const state = signal({ price: [20, 60] });
        const { track } = mountVertical(state);
        // A 10px-bordered channel: border box y 0..120, padding box y 10..110.
        track.getBoundingClientRect = () =>
            ({ left: 80, right: 100, top: 0, bottom: 120, width: 20, height: 120, x: 80, y: 0, toJSON() {} }) as DOMRect;
        const layout = { offsetWidth: 20, offsetHeight: 120, clientLeft: 0, clientTop: 10, clientWidth: 20, clientHeight: 100 };
        for (const [k, v] of Object.entries(layout)) Object.defineProperty(track, k, { value: v, configurable: true });
        // 80px down the viewport is 70px into the 100px padding box: 30% up.
        track.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 90, clientY: 80, bubbles: true }));
        expect(state.price).toEqual([30, 60]);
        window.dispatchEvent(new PointerEvent('pointerup', {}));
    });

    it('arrow keys follow APG: Up/Right increase, Down/Left decrease', () => {
        const state = signal({ price: [20, 60] });
        const { thumbs } = mountVertical(state);
        key(thumbs[0]!, 'ArrowUp');
        expect(state.price).toEqual([21, 60]);
        key(thumbs[0]!, 'ArrowRight');
        expect(state.price).toEqual([22, 60]);
        key(thumbs[0]!, 'ArrowDown');
        key(thumbs[0]!, 'ArrowLeft');
        key(thumbs[0]!, 'ArrowLeft');
        expect(state.price).toEqual([19, 60]);
    });

    it('a vertical RTL slider does not flip Left/Right (the axis is not the reading one)', () => {
        const state = signal({ price: [20, 60] });
        container.setAttribute('dir', 'rtl');
        container.style.direction = 'rtl';
        const { thumbs } = mountVertical(state);
        key(thumbs[0]!, 'ArrowRight');
        expect(state.price).toEqual([21, 60]);
    });

    it('the native control projection is vertical too', () => {
        const state = signal({ volume: 40 });
        render(
            <Slider.Root model={[state, 'volume']} orientation="vertical">
                <Slider.Control />
            </Slider.Root>,
            container,
        );
        const control = container.querySelector<HTMLInputElement>('[data-part="control"]')!;
        expect(control.getAttribute('data-orientation')).toBe('vertical');
        expect(control.getAttribute('aria-orientation')).toBe('vertical');
        // The platform's spelling of a bottom-to-top range.
        expect(control.style.writingMode).toBe('vertical-lr');
        expect(control.style.direction).toBe('rtl');
        expectAnatomy(container, sliderAnatomy);
    });
});
