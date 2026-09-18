/**
 * Carousel — a scroll-snap viewport with an active-index model (#340).
 *
 * The decisions pinned here:
 * - The MODEL IS THE ACTIVE INDEX, derived from real scroll position by an
 *   IntersectionObserver (created only in onMounted — SSR never observes)
 *   and driven back by scrolling the item into view on model set. In this
 *   DOM-less suite the observer half is inert by design; the e2e spec
 *   (carousel.spec.ts) owns the real-scroll claims.
 * - Prev/next are plain buttons that CLAMP (no wrap — a carousel that
 *   wraps announces "1 of 5" after "5 of 5", which reads as a bug), and
 *   each disables at its bound.
 * - The dots are BUTTONS, not tabs: APG's grouped-carousel pagination.
 *   No roving tabindex — every dot is a tab stop with its own label.
 * - ARIA per APG carousel: root is a labelled region with
 *   aria-roledescription="carousel"; each item is a "slide" group labelled
 *   "n of m" unless the consumer names it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { Carousel, carouselAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

const selector = (scope: string, name: string) => `[data-scope="${scope}"][data-part="${name}"]`;
const part = (c: HTMLElement, name: string) =>
    c.querySelector<HTMLElement>(selector('carousel', name))!;
const parts = (c: HTMLElement, name: string) =>
    [...c.querySelectorAll<HTMLElement>(selector('carousel', name))];

const tick = () => new Promise((r) => setTimeout(r, 0));

function sample(extra: Record<string, unknown> = {}) {
    return (
        <Carousel.Root label="Featured" {...extra}>
            <Carousel.Viewport>
                <Carousel.Item>One</Carousel.Item>
                <Carousel.Item>Two</Carousel.Item>
                <Carousel.Item>Three</Carousel.Item>
            </Carousel.Viewport>
            <Carousel.PrevTrigger>Prev</Carousel.PrevTrigger>
            <Carousel.NextTrigger>Next</Carousel.NextTrigger>
            <Carousel.IndicatorGroup>
                <Carousel.Indicator index={0} />
                <Carousel.Indicator index={1} />
                <Carousel.Indicator index={2} />
            </Carousel.IndicatorGroup>
        </Carousel.Root>
    );
}

describe('Carousel', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy with APG carousel semantics', () => {
        render(sample(), container);
        expectAnatomy(container, carouselAnatomy);
        const root = part(container, 'root');
        expect(root.getAttribute('role')).toBe('region');
        expect(root.getAttribute('aria-roledescription')).toBe('carousel');
        expect(root.getAttribute('aria-label')).toBe('Featured');
        // A scrollable region must be keyboard-reachable — focused, the
        // platform's arrow keys scroll it.
        expect(part(container, 'viewport').getAttribute('tabindex')).toBe('0');
    });

    it('items are slides, labelled "n of m" from registration', () => {
        render(sample(), container);
        const items = parts(container, 'item');
        expect(items.length).toBe(3);
        for (const [i, item] of items.entries()) {
            expect(item.getAttribute('role')).toBe('group');
            expect(item.getAttribute('aria-roledescription')).toBe('slide');
            expect(item.getAttribute('aria-label')).toBe(`${i + 1} of 3`);
        }
        expect(items[0]!.getAttribute('data-state')).toBe('active');
        expect(items[1]!.getAttribute('data-state')).toBe('inactive');
    });

    it('next/prev step the model and clamp at the bounds, disabling there', () => {
        render(sample(), container);
        const prev = part(container, 'prev-trigger') as unknown as HTMLButtonElement;
        const next = part(container, 'next-trigger') as unknown as HTMLButtonElement;

        // At index 0 prev has nowhere to go.
        expect(prev.disabled).toBe(true);
        expect(prev.getAttribute('data-disabled')).toBe('');
        expect(next.disabled).toBe(false);

        next.click();
        expect(parts(container, 'item')[1]!.getAttribute('data-state')).toBe('active');
        next.click();
        expect(parts(container, 'item')[2]!.getAttribute('data-state')).toBe('active');
        // Clamped: a third click stays at the end, and next is disabled.
        expect(next.disabled).toBe(true);
        next.click();
        expect(parts(container, 'item')[2]!.getAttribute('data-state')).toBe('active');

        prev.click();
        expect(parts(container, 'item')[1]!.getAttribute('data-state')).toBe('active');
    });

    it('dots are labelled buttons that jump straight to a slide', () => {
        const changes: number[] = [];
        render(sample({ onIndexChange: (i: number) => changes.push(i) }), container);
        const dots = parts(container, 'indicator');
        expect(dots[2]!.tagName).toBe('BUTTON');
        expect(dots[2]!.getAttribute('aria-label')).toBe('Go to slide 3');
        expect(dots[0]!.getAttribute('data-state')).toBe('active');
        expect(dots[0]!.getAttribute('aria-current')).toBe('true');

        dots[2]!.click();
        expect(changes).toEqual([2]);
        expect(dots[2]!.getAttribute('data-state')).toBe('active');
        expect(dots[0]!.getAttribute('data-state')).toBe('inactive');
        expect(dots[0]!.hasAttribute('aria-current')).toBe(false);
    });

    it('a model set scrolls its item into view', async () => {
        render(sample(), container);
        const items = parts(container, 'item');
        const calls: unknown[] = [];
        for (const item of items) {
            (item as HTMLElement & { scrollIntoView: (o: unknown) => void }).scrollIntoView =
                (o: unknown) => calls.push(o);
        }
        part(container, 'next-trigger').click();
        await tick();
        expect(calls.length).toBe(1);
        // block: 'nearest' — the page must not scroll vertically for a
        // horizontal carousel movement.
        expect(calls[0]).toMatchObject({ block: 'nearest' });
    });

    it('a non-zero initial index scrolls its slide into place on mount, instantly', () => {
        const calls: unknown[] = [];
        const original = HTMLElement.prototype.scrollIntoView;
        HTMLElement.prototype.scrollIntoView = function (o: unknown) { calls.push(o); } as typeof original;
        try {
            render(sample({ defaultIndex: 2 }), container);
        } finally {
            HTMLElement.prototype.scrollIntoView = original;
        }
        // The resting scroll position must agree with the model — and the
        // initial position is a fact, not an animation: behavior 'auto'.
        expect(calls.length).toBe(1);
        expect(calls[0]).toMatchObject({ behavior: 'auto' });
        expect(parts(container, 'item')[2]!.getAttribute('data-state')).toBe('active');
    });

    it('declares the activation family on item and indicator', () => {
        expect(carouselAnatomy.parts.item.states).toEqual(['active', 'inactive']);
        expect(carouselAnatomy.parts.indicator.states).toEqual(['active', 'inactive']);
        // The dot is a paint part: no text hint, so the contrast audit's
        // indicator matrix (not the text matrix) grades it.
        expect(carouselAnatomy.parts.indicator.tokens).not.toContain('text');
    });
});
