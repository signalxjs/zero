/**
 * The caret of a `<textarea>` or `<input>` as a place on screen (#105) — so
 * a trigger-mode Combobox can open its list beside the typed `@` rather than
 * under the whole composer.
 *
 * A text control reports its caret as an index, never as coordinates, so it
 * is measured with a MIRROR: a hidden element given the control's font,
 * padding, width and wrapping, holding the text up to the index and a marker
 * for the character at it. The marker's box is where that character is laid
 * out inside the control, before the control's own scroll.
 *
 * - **Bidi-aware.** The mirror copies `direction`, and under `rtl` the
 *   point is the marker's RIGHT edge — the character's inline start.
 * - **Horizontal writing only.** A vertical `writing-mode` returns `null`
 *   from `caretAnchor`, and the caller keeps anchoring to the control's box.
 * - **Opt-in by import.** A trigger-mode Combobox takes it as
 *   `anchor={caretAnchor}`, so a composer that docks its list to the box
 *   never ships the measurement.
 * - **Measured when read.** The mirror is built only when the text, the
 *   index or the control's width changed since the last read; a scroll
 *   (the page's or the control's own) reuses the measurement and only moves
 *   it, so a positioning strategy can re-read it on every scroll event.
 * - **Clamped to the control.** A caret scrolled out of the control's view
 *   answers at its nearest edge, so the list never floats away from it.
 *
 * DOM-only, called when positioning runs — never at setup, never on the
 * server.
 */
import { rectAt, type PositionAnchor, type VirtualAnchor } from './position.js';

/**
 * What the mirror copies. Everything that moves a glyph: the font, the
 * spacing, the padding (the text's origin), the wrapping and the direction.
 */
const MIRRORED = [
    'direction', 'unicode-bidi', 'writing-mode',
    'font-family', 'font-size', 'font-style', 'font-variant', 'font-weight', 'font-stretch',
    'font-size-adjust', 'font-feature-settings', 'font-variation-settings', 'font-kerning',
    'line-height', 'letter-spacing', 'word-spacing', 'tab-size', 'text-align', 'text-indent',
    'text-transform', 'text-rendering', 'word-break', 'overflow-wrap', 'hyphens',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
];

/** Where a character of a text control is laid out: px from its border box, before its scroll. */
export interface CaretPoint {
    /** The character's inline start — its left edge, or its right edge under `rtl`. */
    x: number;
    /** The top of the character's line box. */
    y: number;
    /** The height of the character's box (about one line). */
    height: number;
}

/**
 * Measure where the character at `index` of `el`'s value is laid out. The
 * point is relative to the control's border box and ignores its scroll.
 */
export function measureCaret(el: HTMLTextAreaElement | HTMLInputElement, index: number): CaretPoint {
    const doc = el.ownerDocument;
    const computed = doc.defaultView!.getComputedStyle(el);
    const mirror = doc.createElement('div');
    const style = mirror.style;
    for (const name of MIRRORED) style.setProperty(name, computed.getPropertyValue(name));
    // Fixed at the origin and invisible: laid out, never painted, and never
    // widening the page it sits in.
    style.position = 'fixed';
    style.top = '0';
    style.left = '0';
    style.visibility = 'hidden';
    style.pointerEvents = 'none';
    style.overflow = 'hidden';
    style.margin = '0';
    style.border = '0';
    style.boxSizing = 'border-box';
    // The padding box without a scrollbar: the text wraps where the
    // control's does.
    style.width = `${el.clientWidth}px`;
    // A textarea wraps the way its own computed style says (pre-wrap by
    // default); an input never wraps.
    style.whiteSpace = el.tagName === 'TEXTAREA' ? computed.whiteSpace || 'pre-wrap' : 'pre';

    const value = el.value;
    const at = Math.max(0, Math.min(index, value.length));
    const char = value.charAt(at);
    const marker = doc.createElement('span');
    // A line break (or the end of the text) has no glyph to measure: a
    // zero-width space stands in, where the character would be.
    marker.textContent = char === '' || char === '\n' ? '​' : char;
    // The rest of the text follows, so the marker's word wraps as it does
    // in the control.
    mirror.append(value.slice(0, at), marker, value.slice(at + 1));
    doc.body.appendChild(mirror);
    try {
        const box = mirror.getBoundingClientRect();
        const r = marker.getClientRects()[0] ?? marker.getBoundingClientRect();
        const rtl = computed.direction === 'rtl';
        return {
            x: (rtl ? r.right : r.left) - box.left + el.clientLeft,
            y: r.top - box.top + el.clientTop,
            height: r.height,
        };
    } finally {
        mirror.remove();
    }
}

/**
 * Where a text control's popup anchors, given the control and a character
 * index — `caretAnchor` is one; `null` means "the control's box".
 */
export type TextAnchor = (el: HTMLTextAreaElement | HTMLInputElement, index: number) => PositionAnchor | null;

/**
 * A virtual anchor at the character `index` of `el` — a zero-width rect one
 * line tall, at the character's inline start, following the control and the
 * page as they scroll. `null` under a vertical `writing-mode`.
 *
 * An `<input>` is one line, vertically centred in its box: its anchor spans
 * the box's height, and only the inline position is measured.
 */
export function caretAnchor(el: HTMLTextAreaElement | HTMLInputElement, index: number): VirtualAnchor | null {
    const computed = el.ownerDocument.defaultView!.getComputedStyle(el);
    if (computed.writingMode && !computed.writingMode.startsWith('horizontal')) return null;
    const multiline = el.tagName === 'TEXTAREA';
    let key = '';
    let point: CaretPoint = { x: 0, y: 0, height: 0 };
    const clamp = (n: number, min: number, max: number): number => Math.min(Math.max(n, min), Math.max(min, max));
    return {
        getBoundingClientRect() {
            const next = `${index}|${el.clientWidth}|${el.value}`;
            if (next !== key) {
                point = measureCaret(el, index);
                key = next;
            }
            const box = el.getBoundingClientRect();
            const x = clamp(box.left + point.x - el.scrollLeft, box.left, box.right);
            if (!multiline) return rectAt(x, box.top, 0, box.height);
            const y = clamp(box.top + point.y - el.scrollTop, box.top, box.bottom - point.height);
            return rectAt(x, y, 0, point.height);
        },
    };
}
