/**
 * `caretAnchor` / `measureCaret` (#105) against a DOM with no layout: the
 * boxes are stubbed, so these pin the arithmetic (the mirror's offsets, the
 * control's scroll, the clamp, `rtl`, the single-line input) and the
 * housekeeping (the mirror never stays in the document, and a scroll reuses
 * the measurement). Real glyph geometry is the e2e suite's
 * (`examples/playground/e2e/combobox-trigger.spec.ts`).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { caretAnchor, measureCaret } from '@sigx/zero';

interface Box { left: number; top: number; width: number; height: number }
const rect = ({ left, top, width, height }: Box): DOMRect =>
    ({ x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({}) }) as DOMRect;

/** The control at (100, 200), 300×120; the mirror at the origin; the marker where `marker` says. */
function stubLayout(marker: Box, control: Box = { left: 100, top: 200, width: 300, height: 120 }) {
    let mirrors = 0;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        if (this.tagName === 'SPAN') return rect(marker);
        if (this.tagName === 'DIV' && (this as HTMLElement).style.position === 'fixed') { mirrors++; return rect({ left: 0, top: 0, width: 300, height: 0 }); }
        return rect(control);
    });
    vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
        return [rect(this.tagName === 'SPAN' ? marker : control)] as unknown as DOMRectList;
    });
    return { mirrors: () => mirrors };
}

function textarea(value: string, style = ''): HTMLTextAreaElement {
    const el = document.createElement('textarea');
    el.setAttribute('style', style);
    el.value = value;
    document.body.appendChild(el);
    return el;
}

afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
});

describe('measureCaret', () => {
    it('reads the marker against the mirror and leaves nothing behind', () => {
        stubLayout({ left: 42, top: 36, width: 9, height: 18 });
        const el = textarea('hello\nworld @ada');
        expect(measureCaret(el, 12)).toEqual({ x: 42, y: 36, height: 18 });
        expect(document.body.querySelectorAll('div').length).toBe(0);
    });

    it('copies the font, padding, direction and wrapping, and marks the character', () => {
        const el = textarea('a @b', 'font-size: 19px; padding-left: 7px; direction: rtl; letter-spacing: 2px');
        let seen: HTMLElement | null = null;
        const append = document.body.appendChild.bind(document.body);
        vi.spyOn(document.body, 'appendChild').mockImplementation(<T extends Node>(node: T): T => {
            seen = node as unknown as HTMLElement;
            return append(node);
        });
        measureCaret(el, 2);
        const mirror = seen! as HTMLElement;
        expect(mirror.style.fontSize).toBe('19px');
        expect(mirror.style.paddingLeft).toBe('7px');
        expect(mirror.style.direction).toBe('rtl');
        expect(mirror.style.letterSpacing).toBe('2px');
        expect(mirror.style.visibility).toBe('hidden');
        expect(mirror.querySelector('span')!.textContent).toBe('@');
        expect(mirror.textContent).toBe('a @b');
    });

    it('stands a zero-width space in for a line break or the end of the text', () => {
        const el = textarea('a\n');
        let seen: HTMLElement | null = null;
        const append = document.body.appendChild.bind(document.body);
        vi.spyOn(document.body, 'appendChild').mockImplementation(<T extends Node>(node: T): T => {
            seen = node as unknown as HTMLElement;
            return append(node);
        });
        measureCaret(el, 1);
        expect((seen! as HTMLElement).querySelector('span')!.textContent).toBe('​');
        measureCaret(el, 2);
        expect((seen! as HTMLElement).querySelector('span')!.textContent).toBe('​');
    });
});

describe('caretAnchor', () => {
    it('is a zero-width, one-line rect at the character, in client coordinates', () => {
        stubLayout({ left: 42, top: 36, width: 9, height: 18 });
        const r = caretAnchor(textarea('x @a'), 2)!.getBoundingClientRect();
        expect([r.left, r.top, r.width, r.height]).toEqual([142, 236, 0, 18]);
    });

    it('follows the control\'s own scroll without measuring again', () => {
        const layout = stubLayout({ left: 42, top: 96, width: 9, height: 18 });
        const el = textarea('x @a');
        const anchor = caretAnchor(el, 2)!;
        expect(anchor.getBoundingClientRect().top).toBe(296);
        el.scrollTop = 40;
        expect(anchor.getBoundingClientRect().top).toBe(256);
        expect(layout.mirrors()).toBe(1);
        // The text changed: measured again.
        el.value = 'x @ab';
        anchor.getBoundingClientRect();
        expect(layout.mirrors()).toBe(2);
    });

    it('a caret scrolled out of view answers at the control\'s nearest edge', () => {
        stubLayout({ left: 42, top: 400, width: 9, height: 18 });
        const r = caretAnchor(textarea('x @a'), 2)!.getBoundingClientRect();
        // The control's bottom (320) less the line.
        expect(r.top).toBe(302);
    });

    it('under rtl the inline start is the character\'s right edge', () => {
        stubLayout({ left: 42, top: 36, width: 9, height: 18 });
        const r = caretAnchor(textarea('x @a', 'direction: rtl'), 2)!.getBoundingClientRect();
        expect(r.left).toBe(151);
    });

    it('an input is one line: only the inline position is measured', () => {
        stubLayout({ left: 42, top: 3, width: 9, height: 18 }, { left: 100, top: 200, width: 300, height: 40 });
        const el = document.createElement('input');
        el.value = 'x @a';
        document.body.appendChild(el);
        const r = caretAnchor(el, 2)!.getBoundingClientRect();
        expect([r.left, r.top, r.height]).toEqual([142, 200, 40]);
    });

    it('declines a vertical writing mode', () => {
        expect(caretAnchor(textarea('x @a', 'writing-mode: vertical-rl'), 2)).toBeNull();
    });
});
