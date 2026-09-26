/**
 * Focus management utilities.
 *
 * Native `<dialog>` traps and restores focus by itself — these helpers cover
 * the surfaces the platform doesn't: popover panels that should return focus
 * to their trigger, and initial-focus placement.
 */
import { watch } from 'sigx';

/**
 * Elements that can take focus by their nature (or by a `tabindex`). Whether
 * one actually can right now — enabled, rendered, not inert — is
 * {@link isFocusable}'s question; whether it sits in the Tab order is
 * {@link getTabbables}'.
 */
const FOCUSABLE_SELECTOR = [
    'a[href]',
    'area[href]',
    'button',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    'summary',
    'iframe',
    'audio[controls]',
    'video[controls]',
    '[contenteditable]:not([contenteditable="false"])',
    '[tabindex]',
].join(',');

/** The controls a `disabled` attribute (their own, or a fieldset's) disables. */
const FORM_CONTROL = /^(BUTTON|INPUT|SELECT|TEXTAREA)$/;

/**
 * A disabled `<fieldset>` disables the form controls inside it — except
 * those inside its first `<legend>` child (HTML's "actually disabled").
 * Links and `tabindex` elements inside it stay focusable.
 */
function inDisabledFieldset(el: HTMLElement): boolean {
    if (!FORM_CONTROL.test(el.tagName)) return false;
    let fieldset = el.parentElement?.closest('fieldset') ?? null;
    while (fieldset) {
        if (fieldset.hasAttribute('disabled')) {
            const legend = Array.from(fieldset.children).find((c) => c.tagName === 'LEGEND');
            if (!legend?.contains(el)) return true;
        }
        fieldset = fieldset.parentElement?.closest('fieldset') ?? null;
    }
    return false;
}

/**
 * Rendered, as far as focus is concerned: not under a `hidden` attribute
 * (zero's own hidden parts compute `display: none`, and the check needs no
 * layout), and — where `checkVisibility` exists — not `display: none` by
 * any other rule, not `visibility: hidden`, not skipped by
 * `content-visibility`.
 */
function isRendered(el: HTMLElement): boolean {
    if (el.closest('[hidden]')) return false;
    if (typeof el.checkVisibility !== 'function') return true;
    return el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true });
}

/** The element's `tabindex` attribute as a number, or null when absent/invalid. */
function tabindexAttr(el: HTMLElement): number | null {
    const raw = el.getAttribute('tabindex');
    if (raw === null || raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isInteger(n) ? n : null;
}

/**
 * Whether `el` can take focus right now: connected, a focusable element (or
 * one with a `tabindex`), not disabled (its own attribute or a disabled
 * fieldset's), not inside `[inert]`, and rendered.
 */
export function isFocusable(el: Element | null | undefined): el is HTMLElement {
    if (!el || !(el instanceof HTMLElement) || !el.isConnected) return false;
    if (!el.matches(FOCUSABLE_SELECTOR)) return false;
    if (FORM_CONTROL.test(el.tagName) && el.hasAttribute('disabled')) return false;
    if (el.closest('[inert]')) return false;
    if (inDisabledFieldset(el)) return false;
    return isRendered(el);
}

/**
 * The elements inside `container` that Tab stops on, in DOM order: focusable
 * (see {@link isFocusable}) and not opted out with a negative `tabindex`. A
 * radio group is one stop — its checked radio, or its first when none is. A
 * group is its `name` within one form owner (or, form-less, one tree), as the
 * browser scopes it: same-named radios in two forms are two stops.
 */
export function getTabbables(container: HTMLElement): HTMLElement[] {
    const candidates = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter((el) => (tabindexAttr(el) ?? 0) >= 0 && isFocusable(el));

    // Collapse each radio group to the one radio Tab reaches.
    const groups = new Map<Node, Map<string, HTMLInputElement>>();
    const groupOf = (el: HTMLInputElement): Map<string, HTMLInputElement> => {
        const owner: Node = el.form ?? el.getRootNode();
        let byName = groups.get(owner);
        if (!byName) groups.set(owner, (byName = new Map()));
        return byName;
    };
    const isGroupedRadio = (el: HTMLElement): el is HTMLInputElement =>
        el instanceof HTMLInputElement && el.type === 'radio' && !!el.name;
    for (const el of candidates) {
        if (!isGroupedRadio(el)) continue;
        const byName = groupOf(el);
        const current = byName.get(el.name);
        if (!current || (el.checked && !current.checked)) byName.set(el.name, el);
    }
    return candidates.filter((el) => !isGroupedRadio(el) || groupOf(el).get(el.name) === el);
}

/**
 * Focus the first tabbable inside `container` that actually takes focus —
 * one refusing it (a browser's own reasons: an unrendered box the checks
 * above could not see) passes to the next — or else the container itself,
 * given a `tabIndex` of -1 when it has none.
 */
export function focusFirst(container: HTMLElement | null): void {
    if (!container) return;
    for (const el of getTabbables(container)) {
        el.focus?.();
        if (document.activeElement === el) return;
    }
    if (tabindexAttr(container) === null && !container.matches(FOCUSABLE_SELECTOR)) container.tabIndex = -1;
    container.focus?.();
}

export interface FocusRestoreOptions {
    /**
     * The surface being closed. Focus is handed back only while it is still
     * the surface's to hand: on nothing (`<body>`/null) or inside it. Focus
     * the user already moved elsewhere — a pointerdown on an outside input,
     * a Tab out — stays where they put it. Omitted, focus is always restored.
     */
    getSurface?(): HTMLElement | null;
    /**
     * Where focus goes when the element focused before opening can no longer
     * take it (removed, disabled, hidden) — typically the trigger.
     */
    fallback?(): HTMLElement | null;
    /**
     * Consulted as the surface closes: true leaves focus where it is. For a
     * close that already sent focus somewhere on purpose — a menu closed by
     * Tab, whose focus the browser moves onward itself.
     */
    skip?(): boolean;
}

/**
 * Capture `document.activeElement` when `isOpen()` flips true and restore it
 * when it flips false — if focus is still ours to move (see
 * {@link FocusRestoreOptions.getSurface}). Call from component setup.
 */
export function createFocusRestore(isOpen: () => boolean, options: FocusRestoreOptions = {}): void {
    if (typeof document === 'undefined') return;

    let previous: HTMLElement | null = null;
    watch(
        () => isOpen(),
        (open, wasOpen) => {
            if (open) {
                const active = document.activeElement;
                previous = active instanceof HTMLElement ? active : null;
                return;
            }
            if (!wasOpen) return;
            const remembered = previous;
            previous = null;
            if (options.skip?.()) return;
            if (!focusIsOurs(options.getSurface)) return;
            const target = isFocusable(remembered) ? remembered : options.fallback?.() ?? null;
            if (isFocusable(target)) target.focus();
        },
    );
}

function focusIsOurs(getSurface: FocusRestoreOptions['getSurface']): boolean {
    if (!getSurface) return true;
    const active = document.activeElement;
    if (!active || active === document.body) return true;
    return !!getSurface()?.contains(active);
}
