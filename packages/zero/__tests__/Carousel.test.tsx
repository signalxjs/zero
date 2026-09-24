/**
 * Carousel — a scroll-snap viewport with an active-index model (#340).
 *
 * The decisions pinned here:
 * - The MODEL IS THE ACTIVE INDEX, derived from real scroll position by an
 *   IntersectionObserver (created only in onMounted — SSR never observes)
 *   and driven back by scrolling THE VIEWPORT (never the page, #171) to
 *   centre the item on model set. In this
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
import { signal } from 'sigx';
import { Carousel, carouselAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

const selector = (scope: string, name: string) => `[data-scope="${scope}"][data-part="${name}"]`;
const part = (c: HTMLElement, name: string) =>
    c.querySelector<HTMLElement>(selector('carousel', name))!;
const parts = (c: HTMLElement, name: string) =>
    [...c.querySelectorAll<HTMLElement>(selector('carousel', name))];

const tick = () => new Promise((r) => setTimeout(r, 0));
/** One animation frame: the viewport's mount work waits for the document. */
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

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

    /**
     * Pin the geometry happy-dom cannot lay out: the viewport's box, its
     * scroll offset, and one box per item. Returns the recorded
     * `viewport.scrollTo` calls.
     */
    function layout(viewport: HTMLElement, itemLefts: number[], width = 400) {
        const box = (left: number) => ({
            left, right: left + width, width, top: 0, bottom: 100, height: 100, x: left, y: 0,
            toJSON() { return this; },
        }) as DOMRect;
        viewport.getBoundingClientRect = () => box(0);
        Object.defineProperty(viewport, 'scrollLeft', { configurable: true, value: 0 });
        for (const [i, item] of parts(container, 'item').entries()) {
            item.getBoundingClientRect = () => box(itemLefts[i]!);
        }
        const calls: ScrollToOptions[] = [];
        viewport.scrollTo = ((o: ScrollToOptions) => { calls.push(o); }) as typeof viewport.scrollTo;
        return calls;
    }

    /** Record every `scrollIntoView` — the call that scrolls the PAGE too (#171). */
    function spyScrollIntoView(): { calls: unknown[]; restore: () => void } {
        const calls: unknown[] = [];
        const original = HTMLElement.prototype.scrollIntoView;
        HTMLElement.prototype.scrollIntoView = function (o: unknown) { calls.push(o); } as typeof original;
        return { calls, restore: () => { HTMLElement.prototype.scrollIntoView = original; } };
    }

    it('a model set scrolls only the viewport, never the page (#171)', async () => {
        const spy = spyScrollIntoView();
        try {
            render(sample(), container);
            await frame();
            const calls = layout(part(container, 'viewport'), [0, 400, 800]);
            part(container, 'next-trigger').click();
            await tick();
            // scrollIntoView scrolls every scrollable ancestor, the document
            // included — a below-the-fold carousel would jump the page.
            expect(spy.calls).toEqual([]);
            expect(calls.length).toBe(1);
            // Slide 2's centre (400 + 200) onto the viewport's centre (200).
            expect(calls[0]).toMatchObject({ left: 400 });
        } finally {
            spy.restore();
        }
    });

    it('the viewport scroll target is direction-agnostic: RTL scrolls negative (#171)', async () => {
        render(sample(), container);
        await frame();
        // RTL: later slides lie to the LEFT, and scrollLeft runs negative.
        const calls = layout(part(container, 'viewport'), [0, -400, -800]);
        parts(container, 'indicator')[2]!.click();
        await tick();
        expect(calls[0]).toMatchObject({ left: -800 });
    });

    it('a non-zero initial index scrolls its slide into place on mount, instantly, viewport only', async () => {
        const spy = spyScrollIntoView();
        const calls: ScrollToOptions[] = [];
        const original = HTMLElement.prototype.scrollTo;
        HTMLElement.prototype.scrollTo = function (o: ScrollToOptions) { calls.push(o); } as typeof original;
        try {
            render(sample({ defaultIndex: 2 }), container);
            await frame();
        } finally {
            HTMLElement.prototype.scrollTo = original;
            spy.restore();
        }
        // The resting scroll position must agree with the model — and the
        // initial position is a fact, not an animation: behavior 'auto'.
        expect(spy.calls).toEqual([]);
        expect(calls.length).toBe(1);
        expect(calls[0]).toMatchObject({ behavior: 'auto' });
        expect(parts(container, 'item')[2]!.getAttribute('data-state')).toBe('active');
    });

    it('a tree mounted detached waits for the document before its mount scroll (#171)', async () => {
        const calls: ScrollToOptions[] = [];
        const original = HTMLElement.prototype.scrollTo;
        HTMLElement.prototype.scrollTo = function (o: ScrollToOptions) { calls.push(o); } as typeof original;
        let observers = 0;
        const Original = globalThis.IntersectionObserver;
        globalThis.IntersectionObserver = class {
            constructor() { observers++; }
            observe() {}
            unobserve() {}
            disconnect() {}
        } as unknown as typeof IntersectionObserver;
        try {
            const detached = document.createElement('div');
            render(sample({ defaultIndex: 2 }), detached);
            // Detached for several frames: no layout, so no scroll and no
            // observer yet — its first report would write slide 0 back.
            await frame();
            await frame();
            await frame();
            expect(calls).toEqual([]);
            expect(observers).toBe(0);
            container.appendChild(detached);
            await frame();
            expect(calls).toEqual([expect.objectContaining({ behavior: 'auto' })]);
            expect(observers).toBe(1);
            expect(parts(detached, 'item')[2]!.getAttribute('data-state')).toBe('active');
        } finally {
            HTMLElement.prototype.scrollTo = original;
            globalThis.IntersectionObserver = Original;
        }
    });

    it('a bound model: a slide the scroll passes does not scroll it back (#171)', async () => {
        // A stand-in observer: the test reports intersections by hand.
        let report: IntersectionObserverCallback | null = null;
        const Original = globalThis.IntersectionObserver;
        globalThis.IntersectionObserver = class {
            constructor(cb: IntersectionObserverCallback) { report = cb; }
            observe() {}
            unobserve() {}
            disconnect() {}
        } as unknown as typeof IntersectionObserver;
        try {
            const tour = signal({ index: 0 });
            render(sample({ model: [tour, 'index'] }), container);
            await frame();
            const calls = layout(part(container, 'viewport'), [0, 400, 800]);
            // An external write: scroll smoothly toward slide 3.
            tour.index = 2;
            await tick();
            expect(calls).toEqual([expect.objectContaining({ left: 800 })]);
            // Mid-scroll the observer reports slide 2 passing by. The model
            // follows the scroll — and the bound model's echo of that write
            // must not scroll back to slide 2, which stalled the scroll there.
            const items = parts(container, 'item');
            report!([{ isIntersecting: true, target: items[1]! } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
            await tick();
            expect(tour.index).toBe(1);
            expect(calls.length).toBe(1);
        } finally {
            globalThis.IntersectionObserver = Original;
        }
    });

    it('declares the activation family on item and indicator', () => {
        expect(carouselAnatomy.parts.item.states).toEqual(['active', 'inactive']);
        expect(carouselAnatomy.parts.indicator.states).toEqual(['active', 'inactive']);
        // The dot is a paint part: no text hint, so the contrast audit's
        // indicator matrix (not the text matrix) grades it.
        expect(carouselAnatomy.parts.indicator.tokens).not.toContain('text');
    });
});
