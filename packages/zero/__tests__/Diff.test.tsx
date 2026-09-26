/**
 * Diff — a before/after reveal with an APG slider handle (#340).
 *
 * The decisions pinned here:
 * - The HANDLE IS A SLIDER: `role="slider"`, `aria-valuenow` 0–100,
 *   arrows/PageUp/PageDown/Home/End, pointer capture like Slider's thumb.
 *   The panes are CONTENT and stay inert — a click on an image is not a
 *   command, and the handle is the one control.
 * - The model is the reveal percent (0–100, default 50), published as
 *   `--diff-percent` on the root — recipes clip the `after` pane with a
 *   logical `inline-size`, so RTL mirrors without a transform (and the
 *   physical-direction half is measured in e2e/diff.spec.ts, since a
 *   happy-dom box has no geometry).
 * - Keyboard is RTL-aware exactly like Slider: ArrowRight increases in
 *   LTR and decreases in RTL, so the handle always moves the way the key
 *   points.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { Diff, diffAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

const selector = (scope: string, name: string) => `[data-scope="${scope}"][data-part="${name}"]`;
const part = (c: HTMLElement, name: string) =>
    c.querySelector<HTMLElement>(selector('diff', name))!;

const key = (el: HTMLElement, k: string, init: KeyboardEventInit = {}) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));

function sample(extra: Record<string, unknown> = {}, handle: Record<string, unknown> = {}) {
    return (
        <Diff.Root {...extra}>
            <Diff.Before><span>before</span></Diff.Before>
            <Diff.After><span>after</span></Diff.After>
            <Diff.Handle {...handle} />
        </Diff.Root>
    );
}

describe('Diff', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy; the handle carries APG slider semantics', () => {
        render(sample(), container);
        expectAnatomy(container, diffAnatomy);
        const handle = part(container, 'handle');
        expect(handle.getAttribute('role')).toBe('slider');
        expect(handle.getAttribute('aria-valuemin')).toBe('0');
        expect(handle.getAttribute('aria-valuemax')).toBe('100');
        expect(handle.getAttribute('aria-valuenow')).toBe('50');
        expect(handle.getAttribute('aria-orientation')).toBe('horizontal');
        expect(handle.getAttribute('tabindex')).toBe('0');
        // A glyph-only handle needs a name of its own; overridable via label.
        expect(handle.getAttribute('aria-label')).toBe('Comparison');
    });

    it('the panes are content, not controls', () => {
        render(sample(), container);
        for (const name of ['before', 'after'] as const) {
            const pane = part(container, name);
            expect(pane.hasAttribute('role')).toBe(false);
            expect(pane.hasAttribute('tabindex')).toBe(false);
        }
    });

    it('publishes the reveal percent on the root', () => {
        render(sample({ defaultValue: 30 }), container);
        expect(part(container, 'root').style.getPropertyValue('--diff-percent')).toBe('30%');
    });

    it('keyboard steps per APG: arrows, PageUp/Down, Home/End, clamped', () => {
        const changes: number[] = [];
        render(sample({ onValueChange: (v: number) => changes.push(v) }), container);
        const handle = part(container, 'handle');

        key(handle, 'ArrowRight');
        expect(handle.getAttribute('aria-valuenow')).toBe('51');
        key(handle, 'ArrowLeft');
        key(handle, 'ArrowLeft');
        expect(handle.getAttribute('aria-valuenow')).toBe('49');
        key(handle, 'ArrowUp');
        expect(handle.getAttribute('aria-valuenow')).toBe('50');
        key(handle, 'ArrowDown');
        expect(handle.getAttribute('aria-valuenow')).toBe('49');
        key(handle, 'PageUp');
        expect(handle.getAttribute('aria-valuenow')).toBe('59');
        key(handle, 'PageDown');
        expect(handle.getAttribute('aria-valuenow')).toBe('49');
        key(handle, 'End');
        expect(handle.getAttribute('aria-valuenow')).toBe('100');
        key(handle, 'ArrowRight');
        expect(handle.getAttribute('aria-valuenow')).toBe('100');
        key(handle, 'Home');
        expect(handle.getAttribute('aria-valuenow')).toBe('0');
        key(handle, 'ArrowLeft');
        expect(handle.getAttribute('aria-valuenow')).toBe('0');

        expect(changes).toEqual([51, 50, 49, 50, 49, 59, 49, 100, 0]);
        expect(part(container, 'root').style.getPropertyValue('--diff-percent')).toBe('0%');
    });

    it('the handle sits at the logical position of its value', () => {
        render(sample({ defaultValue: 70 }), container);
        // Structural inline style, logical inset — RTL mirrors for free.
        expect(part(container, 'handle').style.insetInlineStart).toBe('70%');
    });

    it('speaks its value as a percent by default; getValueText overrides (#272)', () => {
        render(sample({ defaultValue: 30 }), container);
        const handle = part(container, 'handle');
        expect(handle.getAttribute('aria-valuetext')).toBe('30%');
        key(handle, 'ArrowRight');
        expect(handle.getAttribute('aria-valuetext')).toBe('31%');

        const other = document.createElement('div');
        document.body.appendChild(other);
        render(sample({ defaultValue: 30 }, { getValueText: (v: number) => `${v} percent revealed` }), other);
        expect(part(other, 'handle').getAttribute('aria-valuetext')).toBe('30 percent revealed');
    });

    it('step and largeStep drive the keys; Shift+Arrow is a large step (#272)', () => {
        render(sample({}, { step: 5, largeStep: 25 }), container);
        const handle = part(container, 'handle');
        key(handle, 'ArrowRight');
        expect(handle.getAttribute('aria-valuenow')).toBe('55');
        key(handle, 'PageUp');
        expect(handle.getAttribute('aria-valuenow')).toBe('80');
        key(handle, 'ArrowLeft', { shiftKey: true });
        expect(handle.getAttribute('aria-valuenow')).toBe('55');
        key(handle, 'PageDown');
        expect(handle.getAttribute('aria-valuenow')).toBe('30');
    });

    it('a fractional step does not drift or stick', () => {
        render(sample({}, { step: 0.1 }), container);
        const handle = part(container, 'handle');
        key(handle, 'ArrowRight');
        key(handle, 'ArrowRight');
        key(handle, 'ArrowRight');
        expect(handle.getAttribute('aria-valuenow')).toBe('50.3');
        key(handle, 'ArrowLeft');
        expect(handle.getAttribute('aria-valuenow')).toBe('50.2');
    });

    it('disabled freezes the handle: aria-disabled, no tab stop, no keys, no drag (#272)', () => {
        const changes: number[] = [];
        render(sample({ disabled: true, onValueChange: (v: number) => changes.push(v) }), container);
        expectAnatomy(container, diffAnatomy);
        const root = part(container, 'root');
        const handle = part(container, 'handle');
        expect(root.getAttribute('data-disabled')).toBe('');
        expect(handle.getAttribute('data-disabled')).toBe('');
        expect(handle.getAttribute('aria-disabled')).toBe('true');
        expect(handle.hasAttribute('tabindex')).toBe(false);
        key(handle, 'ArrowRight');
        key(handle, 'End');
        root.getBoundingClientRect = () =>
            ({ left: 0, top: 0, right: 100, bottom: 10, width: 100, height: 10, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
        handle.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 50, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: 80 }));
        window.dispatchEvent(new PointerEvent('pointerup', {}));
        expect(handle.hasAttribute('data-pressed')).toBe(false);
        expect(changes).toEqual([]);
        expect(handle.getAttribute('aria-valuenow')).toBe('50');
    });

    it('an enabled handle has no disabled flag', () => {
        render(sample(), container);
        expect(part(container, 'root').hasAttribute('data-disabled')).toBe(false);
        expect(part(container, 'handle').hasAttribute('aria-disabled')).toBe(false);
    });

    it('declares the handle as the one interactive part', () => {
        expect(diffAnatomy.partNames()).toEqual(['root', 'before', 'after', 'handle']);
        expect(diffAnatomy.parts.handle.flags).toContain('focus-visible');
        expect(diffAnatomy.parts.handle.flags).toContain('pressed');
        expect(diffAnatomy.parts.handle.flags).toContain('disabled');
        expect(diffAnatomy.parts.root.flags).toContain('disabled');
        // A paint part: the contrast audit's indicator matrix grades it.
        expect(diffAnatomy.parts.handle.tokens).not.toContain('text');
    });
});
