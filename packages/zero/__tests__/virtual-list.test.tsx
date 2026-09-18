/**
 * createVirtualList against a DOM with no layout engine: the geometry is a
 * model here — a row's height is its `data-h`, the viewport is 100px tall and
 * scrolls over the list the behavior says it laid out. What this proves is
 * the bookkeeping (the window, the padding, measurement by key, following,
 * the anchor); that real layout agrees with it is the playground e2e spec's
 * job (`examples/playground/e2e/virtual-list.spec.ts`).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { component, defineApp, signal } from 'sigx';
import { render } from '@sigx/runtime-dom';
import { renderToString } from '@sigx/server-renderer';
import { createVirtualList } from '@sigx/zero';
import type { VirtualList, VirtualListOptions } from '@sigx/zero';

const VIEWPORT = 100;

/** A ResizeObserver the test drives: `resize(el, h)` delivers one entry. */
class FakeResizeObserver {
    static instances: FakeResizeObserver[] = [];
    readonly observed = new Set<Element>();
    constructor(readonly callback: (entries: ResizeObserverEntry[]) => void) {
        FakeResizeObserver.instances.push(this);
    }
    observe(el: Element): void { this.observed.add(el); }
    unobserve(el: Element): void { this.observed.delete(el); }
    disconnect(): void { this.observed.clear(); }
    resize(el: Element, height: number): void {
        el.setAttribute('data-h', String(height));
        this.callback([{ target: el, borderBoxSize: [{ blockSize: height, inlineSize: 0 }] } as unknown as ResizeObserverEntry]);
    }
}

const flush = async (): Promise<void> => {
    for (let i = 0; i < 4; i++) await Promise.resolve();
};

interface Harness {
    v: VirtualList;
    host: HTMLElement;
    viewport: HTMLElement;
    rows(): string[];
    scrollTo(top: number): void;
    state: { first: number; end: number; height: number };
}

/**
 * Mount a list of rows `first..end`, each `height` px tall unless `tall`
 * says otherwise. The viewport's scroll geometry is modelled from what the
 * behavior rendered: its padding plus the rendered rows' `data-h`.
 */
function mount(options: Partial<VirtualListOptions> = {}, tall: (n: number) => number | undefined = () => undefined): Harness {
    const state = signal({ first: 0, end: 100, height: 20 });
    const h: Partial<Harness> = { state };
    let viewport!: HTMLElement;
    const List = component(() => {
        const v = createVirtualList({
            count: () => state.end - state.first,
            key: (i) => `k${state.first + i}`,
            estimateSize: 20,
            overscan: 2,
            ...options,
        });
        h.v = v;
        return () => (
            <div ref={(el: HTMLElement | null) => { if (el) viewport = el; v.viewportRef(el); }} data-vp="">
                <ol ref={v.listRef} style={`padding-top: ${v.before()}px; padding-bottom: ${v.after()}px`}>
                    {v.rows().map((row) => {
                        const n = state.first + row.index;
                        return <li key={row.key} ref={v.measureRef(row.key)} data-h={String(tall(n) ?? state.height)}>{`row ${n}`}</li>;
                    })}
                </ol>
            </div>
        );
    });
    const host = document.createElement('div');
    document.body.appendChild(host);

    // The layout model. Content height = list padding + rendered rows.
    let scrollTop = 0;
    const contentHeight = (): number => {
        const ol = viewport.querySelector('ol')!;
        const pad = (side: string) => Number.parseFloat(ol.style.getPropertyValue(`padding-${side}`) || '0');
        let rows = 0;
        for (const li of ol.querySelectorAll('li')) rows += Number(li.getAttribute('data-h'));
        return pad('top') + rows + pad('bottom');
    };
    const max = (): number => Math.max(0, contentHeight() - VIEWPORT);
    // Stubbed on the prototype, before render: the ref hands the element to
    // the behavior during mount. Only the viewport (`data-vp`) has geometry.
    stub('clientHeight', function (this: HTMLElement) { return this.hasAttribute('data-vp') ? VIEWPORT : 0; });
    stub('scrollHeight', function (this: HTMLElement) { return this.hasAttribute('data-vp') ? contentHeight() : 0; });
    stub('scrollTop', function (this: HTMLElement) { return this.hasAttribute('data-vp') ? scrollTop : 0; }, function (this: HTMLElement, value: number) {
        if (this.hasAttribute('data-vp')) scrollTop = Math.min(Math.max(0, value), max());
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const height = this.tagName === 'LI' ? Number(this.getAttribute('data-h')) : 0;
        // The list scrolls with the content: its top is -scrollTop.
        const top = this.tagName === 'OL' ? listTop - scrollTop : 0;
        return { top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON() {} } as DOMRect;
    });

    render(<List />, host);
    return Object.assign(h, {
        host,
        viewport,
        rows: () => [...host.querySelectorAll('li')].map((li) => li.textContent!),
        scrollTo(top: number) {
            viewport.scrollTop = top;
            viewport.dispatchEvent(new Event('scroll'));
        },
    }) as Harness;
}

const restores: Array<() => void> = [];
/** Content above the list inside the viewport (a "load earlier" button), in px. */
let listTop = 0;

/** Shadow a geometry property on `HTMLElement.prototype` for this test. */
function stub(name: string, get: (this: HTMLElement) => number, set?: (this: HTMLElement, value: number) => void): void {
    const proto = HTMLElement.prototype;
    const own = Object.getOwnPropertyDescriptor(proto, name);
    Object.defineProperty(proto, name, { configurable: true, get, set: set ?? (() => {}) });
    restores.push(() => {
        if (own) Object.defineProperty(proto, name, own);
        else delete (proto as unknown as Record<string, unknown>)[name];
    });
}

beforeEach(() => {
    FakeResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    for (const restore of restores.splice(0)) restore();
    listTop = 0;
    document.body.innerHTML = '';
});

describe('createVirtualList — before mount', () => {
    it('renders the first initialCount rows on the server, the LAST ones under stickToBottom', async () => {
        const Probe = (stick: boolean) => component(() => {
            const v = createVirtualList({ count: () => 100, key: (i) => `k${i}`, estimateSize: 20, initialCount: 5, stickToBottom: stick });
            return () => (
                <ol style={`padding-top: ${v.before()}px; padding-bottom: ${v.after()}px`}>
                    {v.rows().map((row) => <li key={row.key}>{`row ${row.index}`}</li>)}
                </ol>
            );
        });
        const Top = Probe(false);
        const Tail = Probe(true);
        const top = await renderToString(defineApp(<Top />));
        expect(top.match(/row \d+/g)).toEqual(['row 0', 'row 1', 'row 2', 'row 3', 'row 4']);
        expect(top).toContain('padding-top: 0px; padding-bottom: 1900px');
        const tail = await renderToString(defineApp(<Tail />));
        expect(tail.match(/row \d+/g)).toEqual(['row 95', 'row 96', 'row 97', 'row 98', 'row 99']);
        expect(tail).toContain('padding-top: 1900px; padding-bottom: 0px');
    });

    it('must be called from a component setup', () => {
        expect(() => createVirtualList({ count: () => 0, key: String })).toThrow(/must be called from a component's setup/);
    });
});

describe('createVirtualList — the window', () => {
    it('renders the rows the viewport shows plus overscan, and pads the rest', async () => {
        const t = mount();
        await flush();
        // 100px viewport over 20px rows: rows 0–4 visible, + 2 overscan.
        expect(t.rows()).toEqual(['row 0', 'row 1', 'row 2', 'row 3', 'row 4', 'row 5', 'row 6']);
        expect(t.v.before()).toBe(0);
        expect(t.v.after()).toBe(93 * 20);
        expect(t.v.totalSize()).toBe(2000);
    });

    it('moves with the scroll position', async () => {
        const t = mount();
        await flush();
        t.scrollTo(1000);
        await flush();
        expect(t.rows()[0]).toBe('row 48');
        expect(t.rows().at(-1)).toBe('row 56');
        expect(t.v.before()).toBe(48 * 20);
    });

    it('measures rendered rows by key and lays the rest out by estimate', async () => {
        const t = mount({}, (n) => (n % 2 === 0 ? 50 : undefined));
        await flush();
        // The estimate-based window rendered rows 0–6; measured, the even
        // ones are 50px, so the window shrinks to rows 0–2 + 2 overscan.
        expect(t.rows()).toEqual(['row 0', 'row 1', 'row 2', 'row 3', 'row 4']);
        expect(t.v.rows().map((r) => r.size)).toEqual([50, 20, 50, 20, 50]);
        // Rows 5 and 6 left the window but keep their measurement.
        expect(t.v.totalSize()).toBe(2000 + 4 * 30);
    });

    it('keeps a measurement by key when the row leaves the window and comes back', async () => {
        const t = mount({}, (n) => (n === 1 ? 64 : undefined));
        await flush();
        expect(t.v.rows()[1]!.size).toBe(64);
        t.scrollTo(1500);
        await flush();
        expect(t.rows()).not.toContain('row 1');
        expect(t.v.totalSize()).toBe(2000 + 44);
        t.scrollTo(0);
        await flush();
        expect(t.v.rows()[1]!.size).toBe(64);
    });

    it('re-measures through the ResizeObserver, from the frame after a row renders', async () => {
        const t = mount();
        await flush();
        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
        const ro = FakeResizeObserver.instances[0]!;
        const li = t.host.querySelector('li')!;
        expect(ro.observed.has(li)).toBe(true);
        ro.resize(li, 80);
        await flush();
        expect(t.v.rows()[0]!.size).toBe(80);
        expect(t.v.totalSize()).toBe(2060);
    });

    it('a measureRef is stable per key, so a re-render does not re-attach it', async () => {
        const t = mount();
        await flush();
        expect(t.v.measureRef('k3')).toBe(t.v.measureRef('k3'));
        expect(t.v.measureRef('k3')).not.toBe(t.v.measureRef('k4'));
    });

    it('scrollToIndex puts a row where it was asked', async () => {
        const t = mount();
        await flush();
        t.v.scrollToIndex(50, 'start');
        await flush();
        expect(t.viewport.scrollTop).toBe(1000);
        t.v.scrollToIndex(50, 'end');
        expect(t.viewport.scrollTop).toBe(1000 + 20 - VIEWPORT);
        // `auto` leaves a row that is already in view alone.
        t.v.scrollToIndex(49, 'auto');
        expect(t.viewport.scrollTop).toBe(1000 + 20 - VIEWPORT);
    });

    it('accounts for content above the list, and drops that offset with the list', async () => {
        listTop = 50;
        const t = mount();
        await flush();
        t.scrollTo(650); // 600px into the list: row 30, minus 2 overscan
        await flush();
        expect(t.v.before()).toBe(28 * 20);
        // With no list, scroll coordinates are the viewport's own again —
        // not the old list's, 50px off.
        t.v.listRef(null);
        await flush();
        t.scrollTo(600);
        await flush();
        expect(t.v.before()).toBe(28 * 20);
    });

    it('detaches on unmount', async () => {
        const t = mount();
        await flush();
        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
        const ro = FakeResizeObserver.instances[0]!;
        render(null, t.host);
        expect(ro.observed.size).toBe(0);
    });
});

describe('createVirtualList — stick to bottom', () => {
    it('mounts on the tail and follows appends', async () => {
        const t = mount({ stickToBottom: true });
        await flush();
        expect(t.v.following()).toBe(true);
        expect(t.viewport.scrollTop).toBe(2000 - VIEWPORT);
        expect(t.rows().at(-1)).toBe('row 99');
        t.state.end = 103;
        await flush();
        expect(t.viewport.scrollTop).toBe(2060 - VIEWPORT);
        expect(t.rows().at(-1)).toBe('row 102');
    });

    it('follows a last row that grows', async () => {
        const t = mount({ stickToBottom: true });
        await flush();
        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
        const last = [...t.host.querySelectorAll('li')].at(-1)!;
        FakeResizeObserver.instances[0]!.resize(last, 200);
        await flush();
        expect(t.viewport.scrollTop).toBe(2180 - VIEWPORT);
    });

    it('an upward scroll lets go of the tail; appends then leave the reader alone; scrollToEnd resumes', async () => {
        const t = mount({ stickToBottom: true });
        await flush();
        t.scrollTo(1500);
        await flush();
        expect(t.v.following()).toBe(false);
        t.state.end = 110;
        await flush();
        expect(t.viewport.scrollTop).toBe(1500);
        t.v.scrollToEnd();
        await flush();
        expect(t.v.following()).toBe(true);
        expect(t.viewport.scrollTop).toBe(2200 - VIEWPORT);
    });

    it('scrolling back to within `threshold` of the end follows again', async () => {
        const t = mount({ stickToBottom: true, threshold: 30 });
        await flush();
        t.scrollTo(1000);
        await flush();
        expect(t.v.following()).toBe(false);
        t.scrollTo(2000 - VIEWPORT - 25);
        await flush();
        expect(t.v.following()).toBe(true);
    });

    it('content growing faster than the scroll event is not mistaken for the reader leaving', async () => {
        const t = mount({ stickToBottom: true });
        await flush();
        // Rows appended: the list is now taller, the scroll position has not
        // caught up yet when a (stale) scroll event arrives — no upward move.
        t.state.end = 150;
        t.viewport.dispatchEvent(new Event('scroll'));
        await flush();
        expect(t.v.following()).toBe(true);
        expect(t.viewport.scrollTop).toBe(3000 - VIEWPORT);
    });
});

describe('createVirtualList — the anchor', () => {
    it('a prepend leaves the row being read where it was', async () => {
        const t = mount();
        await flush();
        t.scrollTo(1010); // halfway into row 50
        await flush();
        t.state.first = -30; // thirty rows arrive above
        await flush();
        expect(t.viewport.scrollTop).toBe(1010 + 30 * 20);
        expect(t.v.rows().find((r) => r.key === 'k50')!.start).toBe(1600);
    });

    it('a row above the reader measuring taller than its estimate does not shove the reader', async () => {
        const t = mount({}, (n) => (n === 48 ? 100 : undefined));
        await flush();
        // Row 48 has never rendered; the reader is at row 50.
        t.scrollTo(1000);
        await flush();
        // Row 48 is in the overscan now, measured at 100 instead of 20: row 50
        // moved down 80px in the content, and the viewport with it.
        expect(t.v.rows().find((r) => r.key === 'k50')!.start).toBe(1080);
        expect(t.viewport.scrollTop).toBe(1080);
    });
});
