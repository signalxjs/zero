/**
 * ChatLog — the transcript container (#299), against a DOM with no layout
 * engine: the geometry is a model here. The log is 100px tall, each row is
 * as tall as its `data-h`, and a row's box sits where the rows before it
 * put it, minus the scroll position. What this proves is the bookkeeping
 * (the attributes, following, letting go, the anchor, the model); that
 * real layout agrees is the playground's `e2e/chat-log.spec.ts`.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { component, defineApp, signal } from 'sigx';
import { render } from '@sigx/runtime-dom';
import { renderToString } from '@sigx/server-renderer';
import { ChatLog, chatLogAnatomy, createStickToBottom, zeroPlugin } from '@sigx/zero';
import { expectAnatomy } from './helpers';

const VIEWPORT = 100;

/** A ResizeObserver the test drives: `fire()` delivers one (empty) notification to each. */
class FakeResizeObserver {
    static instances: FakeResizeObserver[] = [];
    readonly observed = new Set<Element>();
    constructor(readonly callback: (entries: ResizeObserverEntry[]) => void) {
        FakeResizeObserver.instances.push(this);
    }
    observe(el: Element): void { this.observed.add(el); }
    unobserve(el: Element): void { this.observed.delete(el); }
    disconnect(): void { this.observed.clear(); }
    static fire(): void {
        for (const ro of FakeResizeObserver.instances) if (ro.observed.size) ro.callback([]);
    }
}

const flush = async (): Promise<void> => {
    for (let i = 0; i < 4; i++) await Promise.resolve();
};

const selector = (name: string) => `[data-scope="chat-log"][data-part="${name}"]`;

const restores: Array<() => void> = [];
function stub(name: string, get: (this: HTMLElement) => number, set?: (this: HTMLElement, value: number) => void): void {
    const proto = HTMLElement.prototype;
    const own = Object.getOwnPropertyDescriptor(proto, name);
    Object.defineProperty(proto, name, { configurable: true, get, set: set ?? (() => {}) });
    restores.push(() => {
        if (own) Object.defineProperty(proto, name, own);
        else delete (proto as unknown as Record<string, unknown>)[name];
    });
}

const isRoot = (el: Element): boolean => el.matches(selector('root'));

interface Harness {
    host: HTMLElement;
    root: HTMLElement;
    trigger: HTMLButtonElement;
    state: { first: number; end: number; following: boolean; changes: boolean[] };
    rows(): string[];
    /** The reader scrolls: a new position plus the scroll event. */
    scrollTo(top: number): void;
    /** Layout changed: deliver the ResizeObserver notifications. */
    relayout(): Promise<void>;
}

/**
 * Mount a log of rows `first..end`, each 20px unless `tall` says otherwise.
 * `controlled` binds `model:following` to `state.following`.
 */
function mount(opts: { controlled?: boolean; tall?: (n: number) => number | undefined; defaultFollowing?: boolean } = {}): Harness {
    const state = signal({ first: 0, end: 20, following: true, changes: [] as boolean[] });
    const height = (n: number): number => opts.tall?.(n) ?? 20;
    const Log = component(() => () => {
        const rows = [];
        for (let n = state.first; n < state.end; n++) {
            rows.push(<div key={`m${n}`} data-row={String(n)} data-h={String(height(n))}>{`row ${n}`}</div>);
        }
        const content = (
            <>
                <ChatLog.Content>{rows}</ChatLog.Content>
                <ChatLog.JumpTrigger />
            </>
        );
        return opts.controlled
            ? <ChatLog.Root label="Conversation" model:following={[state, 'following']}>{content}</ChatLog.Root>
            : (
                <ChatLog.Root
                    label="Conversation"
                    defaultFollowing={opts.defaultFollowing}
                    onFollowingChange={(v: boolean) => { state.changes.push(v); }}
                >
                    {content}
                </ChatLog.Root>
            );
    });

    let scrollTop = 0;
    const contentHeight = (): number => {
        let h = 0;
        for (const row of document.querySelectorAll<HTMLElement>('[data-row]')) h += Number(row.dataset.h);
        return h;
    };
    const max = (): number => Math.max(0, contentHeight() - VIEWPORT);
    stub('clientHeight', function (this: HTMLElement) { return isRoot(this) ? VIEWPORT : 0; });
    stub('scrollHeight', function (this: HTMLElement) { return isRoot(this) ? Math.max(VIEWPORT, contentHeight()) : 0; });
    stub('scrollTop', function (this: HTMLElement) { return isRoot(this) ? scrollTop : 0; }, function (this: HTMLElement, value: number) {
        if (isRoot(this)) scrollTop = Math.min(Math.max(0, value), max());
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        let top = 0;
        let h = 0;
        if (this instanceof HTMLElement && this.dataset.row !== undefined) {
            h = Number(this.dataset.h);
            for (let el = this.previousElementSibling; el; el = el.previousElementSibling) top += Number((el as HTMLElement).dataset.h ?? 0);
            top -= scrollTop;
        }
        return { top, bottom: top + h, height: h, left: 0, right: 0, width: 0, x: 0, y: top, toJSON() {} } as DOMRect;
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    render(<Log />, host);
    const root = host.querySelector<HTMLElement>(selector('root'))!;
    return {
        host,
        root,
        trigger: host.querySelector<HTMLButtonElement>(selector('jump-trigger'))!,
        state,
        rows: () => [...host.querySelectorAll('[data-row]')].map((r) => r.textContent!),
        scrollTo(top: number) {
            root.scrollTop = top;
            root.dispatchEvent(new Event('scroll'));
        },
        async relayout() {
            await flush();
            FakeResizeObserver.fire();
            await flush();
        },
    };
}

beforeEach(() => {
    FakeResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    for (const restore of restores.splice(0)) restore();
    document.body.innerHTML = '';
});

describe('ChatLog — anatomy and semantics', () => {
    it('renders a valid anatomy in both states', async () => {
        const t = mount();
        await t.relayout();
        expectAnatomy(t.host, chatLogAnatomy);
        t.scrollTo(100);
        await flush();
        expectAnatomy(t.host, chatLogAnatomy);
    });

    it('the root is a named, focusable log that announces additions politely', () => {
        const t = mount();
        expect(t.root.getAttribute('role')).toBe('log');
        expect(t.root.getAttribute('aria-live')).toBe('polite');
        expect(t.root.getAttribute('aria-relevant')).toBe('additions');
        expect(t.root.getAttribute('aria-label')).toBe('Conversation');
        expect(t.root.tabIndex).toBe(0);
        expect(t.root.querySelector(selector('content'))!.querySelectorAll('[data-row]')).toHaveLength(20);
    });

    it('the jump trigger is a named button, closed and hidden while following', () => {
        const t = mount();
        expect(t.trigger.tagName).toBe('BUTTON');
        expect(t.trigger.type).toBe('button');
        expect(t.trigger.getAttribute('aria-label')).toBe('Jump to latest');
        expect(t.trigger.textContent).toBe('Jump to latest');
        expect(t.trigger.getAttribute('data-state')).toBe('closed');
        expect(t.trigger.hidden).toBe(true);
    });

    it('server-renders the log, following, with the trigger hidden', async () => {
        const app = defineApp(
            <ChatLog.Root label="Transcript">
                <ChatLog.Content><div>hello</div></ChatLog.Content>
                <ChatLog.JumpTrigger label="Latest" />
            </ChatLog.Root>,
        );
        app.use(zeroPlugin());
        const html = await renderToString(app);
        expect(html).toContain('role="log"');
        expect(html).toContain('aria-label="Transcript"');
        expect(html).toMatch(/data-part="jump-trigger"[^>]*data-state="closed"|data-state="closed"[^>]*data-part="jump-trigger"/);
        expect(html).toContain('>Latest</button>');
    });
});

describe('ChatLog — following the tail', () => {
    it('mounts on the tail and follows appends', async () => {
        const t = mount();
        await t.relayout();
        expect(t.root.scrollTop).toBe(400 - VIEWPORT);
        t.state.end = 23;
        await t.relayout();
        expect(t.root.scrollTop).toBe(460 - VIEWPORT);
    });

    it('an upward scroll lets go: the trigger opens, and appends leave the reader alone', async () => {
        const t = mount();
        await t.relayout();
        t.scrollTo(200);
        await flush();
        expect(t.state.changes).toEqual([false]);
        expect(t.trigger.getAttribute('data-state')).toBe('open');
        expect(t.trigger.hidden).toBe(false);
        t.state.end = 25;
        await t.relayout();
        expect(t.root.scrollTop).toBe(200);
    });

    it('a small upward move lets go even inside `threshold` — a smooth scroll\'s first frame', async () => {
        const t = mount();
        await t.relayout();
        t.scrollTo(300 - 6);
        await flush();
        expect(t.state.changes).toEqual([false]);
        expect(t.root.scrollTop).toBe(294);
        // Back DOWN within `threshold` follows again.
        t.scrollTo(300 - 3);
        await flush();
        expect(t.state.changes).toEqual([false, true]);
    });

    it('a wheel moving up lets go before the scroll lands; one with nothing to scroll does not', async () => {
        const t = mount();
        await t.relayout();
        t.root.dispatchEvent(new WheelEvent('wheel', { deltaY: 40 }));
        expect(t.state.changes).toEqual([]);
        t.root.dispatchEvent(new WheelEvent('wheel', { deltaY: -40 }));
        await flush();
        expect(t.state.changes).toEqual([false]);

        document.body.innerHTML = '';
        for (const restore of restores.splice(0)) restore();
        vi.restoreAllMocks();
        const short = mount();
        short.state.end = 3;
        await short.relayout();
        short.root.dispatchEvent(new WheelEvent('wheel', { deltaY: -40 }));
        await flush();
        expect(short.state.changes).toEqual([]);
    });

    it('a touch dragging the content down lets go', async () => {
        const t = mount();
        await t.relayout();
        const touch = (type: string, y: number) => {
            const e = new Event(type) as Event & { touches: Array<{ clientY: number }> };
            Object.defineProperty(e, 'touches', { value: [{ clientY: y }] });
            t.root.dispatchEvent(e);
        };
        touch('touchstart', 50);
        touch('touchmove', 52);
        expect(t.state.changes).toEqual([]);
        touch('touchmove', 70);
        await flush();
        expect(t.state.changes).toEqual([false]);
    });

    it('content growing before the scroll event fires is not the reader leaving', async () => {
        const t = mount();
        await t.relayout();
        t.state.end = 30;
        await flush();
        // A stale scroll event: the position has not moved, the content has.
        t.root.dispatchEvent(new Event('scroll'));
        await t.relayout();
        expect(t.state.changes).toEqual([]);
        expect(t.root.scrollTop).toBe(600 - VIEWPORT);
    });

    it('the jump trigger resumes following at the end, and hands its focus to the log', async () => {
        const t = mount();
        await t.relayout();
        t.scrollTo(100);
        await flush();
        t.trigger.focus();
        t.trigger.click();
        await flush();
        expect(t.state.changes).toEqual([false, true]);
        expect(t.root.scrollTop).toBe(400 - VIEWPORT);
        expect(t.trigger.hidden).toBe(true);
        expect(document.activeElement).toBe(t.root);
    });
});

describe('ChatLog — the anchor', () => {
    it('rows prepended above leave the row being read where it was', async () => {
        const t = mount();
        await t.relayout();
        t.scrollTo(110); // halfway into row 5
        await flush();
        t.state.first = -10; // ten rows arrive above
        await t.relayout();
        expect(t.root.scrollTop).toBe(110 + 10 * 20);
    });

    it('a row above the reader growing does not shove the reader', async () => {
        const tall = signal({ h: 20 });
        const t = mount({ tall: (n) => (n === 2 ? tall.h : undefined) });
        await t.relayout();
        t.scrollTo(100);
        await flush();
        tall.h = 60;
        t.state.end = 20; // re-render with row 2 at its new height
        const row2 = t.host.querySelector<HTMLElement>('[data-row="2"]')!;
        row2.dataset.h = '60';
        await t.relayout();
        expect(t.root.scrollTop).toBe(140);
    });
});

describe('ChatLog — the model', () => {
    it('defaultFollowing false starts with the trigger open', async () => {
        const t = mount({ defaultFollowing: false });
        await t.relayout();
        expect(t.trigger.getAttribute('data-state')).toBe('open');
        expect(t.root.scrollTop).toBe(0);
    });

    it('model:following drives it both ways; writing true jumps to the end', async () => {
        const t = mount({ controlled: true });
        await t.relayout();
        t.scrollTo(50);
        await flush();
        expect(t.state.following).toBe(false);
        expect(t.trigger.getAttribute('data-state')).toBe('open');
        t.state.following = true;
        await flush();
        expect(t.root.scrollTop).toBe(400 - VIEWPORT);
        expect(t.trigger.getAttribute('data-state')).toBe('closed');
    });

    it('detaches on unmount', async () => {
        const t = mount();
        await t.relayout();
        const ro = FakeResizeObserver.instances[0]!;
        expect(ro.observed.size).toBe(2);
        render(null, t.host);
        expect(ro.observed.size).toBe(0);
    });
});

describe('createStickToBottom', () => {
    it('must be called from a component setup', () => {
        expect(() => createStickToBottom()).toThrow(/component's setup/);
    });
});
