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

const key = (el: HTMLElement, k: string) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

function sample(extra: Record<string, unknown> = {}) {
    return (
        <Diff.Root {...extra}>
            <Diff.Before><span>before</span></Diff.Before>
            <Diff.After><span>after</span></Diff.After>
            <Diff.Handle />
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

    it('declares the handle as the one interactive part', () => {
        expect(diffAnatomy.partNames()).toEqual(['root', 'before', 'after', 'handle']);
        expect(diffAnatomy.parts.handle.flags).toContain('focus-visible');
        expect(diffAnatomy.parts.handle.flags).toContain('pressed');
        // A paint part: the contrast audit's indicator matrix grades it.
        expect(diffAnatomy.parts.handle.tokens).not.toContain('text');
    });
});
