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
