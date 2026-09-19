/**
 * Windowed Select/Combobox (`virtual`, #96) against a DOM with no layout
 * engine. The geometry is a model: the popup is a 180px viewport, every
 * option is 36px, a spacer is its inline block size, and the popup scrolls
 * over the sum. What this proves is the listbox half — the window, the
 * pinned highlight, the ARIA, the keyboard, the fallbacks. That a real
 * engine agrees is the playground spec's job
 * (`examples/playground/e2e/virtual-listbox.spec.ts`).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { defineApp, signal } from 'sigx';
import { render } from '@sigx/runtime-dom';
import { renderToString } from '@sigx/server-renderer';
import { Combobox, Select, comboboxAnatomy, selectAnatomy, virtualListbox } from '@sigx/zero';
import { expectAnatomy } from './helpers';

const VIEWPORT = 180;
const ROW = 36;

interface Zone { value: string; label: string; group?: string }

/** 10,000 zones — "Zone 0" … "Zone 9999", and a last one typeahead can find. */
const zones: Zone[] = Array.from({ length: 10_000 }, (_, i) => ({
    value: `z${i}`,
    label: i === 9_999 ? 'Yukon' : `Zone ${i}`,
}));

const flush = async (): Promise<void> => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
};
/** Opening scrolls in the next frame. */
const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

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

const isPopup = (el: Element): boolean => el.getAttribute('data-part') === 'popup';
const scrollTops = new WeakMap<Element, number>();
/** The popup's content: its spacers plus a row per rendered option. */
const contentHeight = (popup: Element): number => {
    let h = 0;
    for (const child of popup.children) {
        if (child.getAttribute('data-part') === 'spacer') h += Number.parseFloat((child as HTMLElement).style.getPropertyValue('block-size') || '0');
        else if (child.getAttribute('role') === 'option') h += ROW;
    }
    return h;
};

beforeEach(() => {
    stub('clientHeight', function () { return isPopup(this) ? VIEWPORT : 0; });
    stub('scrollHeight', function () { return isPopup(this) ? contentHeight(this) : 0; });
    stub('scrollTop', function () { return scrollTops.get(this) ?? 0; }, function (value) {
        const max = isPopup(this) ? Math.max(0, contentHeight(this) - VIEWPORT) : 0;
        scrollTops.set(this, Math.min(Math.max(0, value), max));
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const height = this.getAttribute('role') === 'option' ? ROW : 0;
        // The leading spacer is the list's origin: it scrolls with the content.
        const parent = this.parentElement;
        const top = parent && isPopup(parent) && parent.firstElementChild === this ? -(scrollTops.get(parent) ?? 0) : 0;
        return { top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON() {} } as DOMRect;
    });
});
afterEach(() => {
    vi.restoreAllMocks();
    for (const restore of restores.splice(0)) restore();
    document.body.innerHTML = '';
});

function host(): HTMLElement {
    const el = document.createElement('div');
    document.body.appendChild(el);
    return el;
}

const key = (el: Element, k: string): void => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true }));
};
const options = (root: Element): HTMLElement[] => [...root.querySelectorAll<HTMLElement>('[role="option"]')];
const posinsets = (root: Element): number[] => options(root).map((o) => Number(o.getAttribute('aria-posinset')));
/** The option the control's aria-activedescendant names — which must exist. */
function active(control: Element): HTMLElement {
    const id = control.getAttribute('aria-activedescendant');
    expect(id, 'aria-activedescendant is set').toBeTruthy();
    const el = document.getElementById(id!);
    expect(el, `#${id} is rendered`).not.toBeNull();
    return el!;
}

describe('Select virtual', () => {
    function mount(extra: Record<string, unknown> = {}) {
        const state = signal({ zone: null as Zone | null });
        const root = host();
        render(<Select.Root items={zones} virtual={virtualListbox} model={[state, 'zone']} name="zone" placeholder="Pick a zone" {...extra} />, root);
        const trigger = root.querySelector<HTMLElement>('[data-part="trigger"]')!;
        const popup = root.querySelector<HTMLElement>('[data-part="popup"]')!;
        return { state, root, trigger, popup };
    }

    it('renders a window of options between spacers, each placed in the whole list', async () => {
        const { root, trigger, popup } = mount();
        await flush();
        trigger.click();
        await flush();
        const shown = options(root);
        expect(shown.length).toBeGreaterThan(4);
        expect(shown.length).toBeLessThan(20);
        expect(shown.every((o) => o.getAttribute('aria-setsize') === '10000')).toBe(true);
        expect(posinsets(root)).toEqual(shown.map((_, i) => i + 1));
        const spacers = [...popup.querySelectorAll<HTMLElement>('[data-part="spacer"]')];
        expect(spacers.length).toBe(2);
        expect(spacers.every((s) => s.getAttribute('aria-hidden') === 'true')).toBe(true);
        expect(spacers[0]).toBe(popup.firstElementChild);
        expect(spacers[1]).toBe(popup.lastElementChild);
        // The spacers and the rows add up to the whole list.
        expect(contentHeight(popup)).toBe(10_000 * ROW);
        expectAnatomy(root, selectAnatomy);
    });

    it('posts the selection alone: no hidden <option> per item', async () => {
        const { root, state } = mount();
        await flush();
        const hidden = root.querySelector<HTMLSelectElement>('select[data-part="hidden-input"]')!;
        expect(hidden.options.length).toBe(1); // the placeholder
        state.zone = zones[4_321]!;
        await flush();
        expect([...hidden.options].map((o) => o.value)).toEqual(['', 'z4321']);
        expect(hidden.value).toBe('z4321');
    });

    it('End, Home, PageDown and PageUp move the highlight — rendered before it is named', async () => {
        const { root, trigger, state } = mount();
        await flush();
        key(trigger, 'ArrowDown');
        await flush();
        expect(active(trigger).getAttribute('aria-posinset')).toBe('1');

        key(trigger, 'End');
        await flush();
        expect(active(trigger).textContent).toContain('Yukon');
        expect(active(trigger).getAttribute('aria-posinset')).toBe('10000');
        // The window followed it: the last rows are what is rendered.
        expect(posinsets(root).at(-1)).toBe(10_000);
        expect(posinsets(root)).not.toContain(1);

        key(trigger, 'Home');
        await flush();
        expect(active(trigger).getAttribute('aria-posinset')).toBe('1');

        // A page is the viewport's worth of rows: 180 / 36.
        key(trigger, 'PageDown');
        await flush();
        expect(active(trigger).getAttribute('aria-posinset')).toBe('6');
        key(trigger, 'PageDown');
        key(trigger, 'PageUp');
        await flush();
        expect(active(trigger).getAttribute('aria-posinset')).toBe('6');

        key(trigger, 'End');
        key(trigger, 'Enter');
        await flush();
        expect(state.zone?.value).toBe('z9999');
    });

    it('typeahead reaches an option that was never rendered', async () => {
        const { trigger } = mount();
        await flush();
        key(trigger, 'ArrowDown');
        await flush();
        key(trigger, 'y');
        await flush();
        expect(active(trigger).textContent).toContain('Yukon');
    });

    it('the highlighted option stays rendered when the list scrolls away from it', async () => {
        const { root, trigger, popup } = mount();
        await flush();
        key(trigger, 'ArrowDown');
        key(trigger, 'End');
        await flush();
        popup.scrollTop = 0;
        popup.dispatchEvent(new Event('scroll'));
        await flush();
        expect(posinsets(root)).toContain(1);
        const pinned = active(trigger);
        expect(pinned.getAttribute('aria-posinset')).toBe('10000');
        // Pinned apart from the window, a spacer stands in for the rows between.
        const before = pinned.previousElementSibling as HTMLElement;
        expect(before.getAttribute('data-part')).toBe('spacer');
        expect(Number.parseFloat(before.style.getPropertyValue('block-size'))).toBeGreaterThan(9_000 * ROW);
        expect(contentHeight(popup)).toBe(10_000 * ROW);
        expectAnatomy(root, selectAnatomy);
    });

    it('opens scrolled to the selection', async () => {
        const { root, trigger, state } = mount();
        state.zone = zones[5_000]!;
        await flush();
        trigger.click();
        await frame();
        await flush();
        expect(active(trigger).getAttribute('aria-posinset')).toBe('5001');
        expect(posinsets(root)).toContain(5_001);
        expect(posinsets(root)).not.toContain(1);
    });

    it('with groups, renders the whole list', async () => {
        const grouped: Zone[] = Array.from({ length: 30 }, (_, i) => ({ value: `g${i}`, label: `G ${i}`, group: i < 15 ? 'East' : 'West' }));
        const root = host();
        render(<Select.Root items={grouped} virtual={virtualListbox} defaultOpen />, root);
        await flush();
        expect(options(root)).toHaveLength(30);
        expect(root.querySelector('[data-part="spacer"]')).toBeNull();
        expect(root.querySelectorAll('[data-part="group"]')).toHaveLength(2);
    });

    it('without virtual, renders every option and no spacer', async () => {
        const few = zones.slice(0, 40);
        const root = host();
        render(<Select.Root items={few} defaultOpen name="zone" />, root);
        await flush();
        expect(options(root)).toHaveLength(40);
        expect(root.querySelector('[data-part="spacer"]')).toBeNull();
        expect(options(root)[0]!.hasAttribute('aria-setsize')).toBe(false);
        // Every item still posts.
        expect(root.querySelector<HTMLSelectElement>('select[data-part="hidden-input"]')!.options.length).toBe(41);
    });

    it('renders the first rows on the server', async () => {
        const html = await renderToString(defineApp(<Select.Root items={zones} virtual={virtualListbox} />));
        expect(html.match(/role="option"/g)).toHaveLength(20);
        expect(html).toContain('data-part="spacer"');
        expect(html).toContain('aria-setsize="10000"');
    });
});

describe('Combobox virtual', () => {
    function mount(extra: Record<string, unknown> = {}) {
        const state = signal({ zone: null as Zone | null, zones: [] as Zone[], query: '' });
        const root = host();
        render(
            <Combobox.Root items={zones} virtual={virtualListbox} model={[state, 'zone']} model:inputValue={[state, 'query']} name="zone" {...extra} />,
            root,
        );
        const input = root.querySelector<HTMLInputElement>('[data-part="input"]')!;
        const popup = root.querySelector<HTMLElement>('[data-part="popup"]')!;
        return { state, root, input, popup };
    }
    const type = (input: HTMLInputElement, text: string): void => {
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    it('windows the filtered list, counting what the filter leaves', async () => {
        const { root, input } = mount();
        await flush();
        key(input, 'ArrowDown');
        await flush();
        expect(options(root)[0]!.getAttribute('aria-setsize')).toBe('10000');
        expect(options(root).length).toBeLessThan(20);
        // "Zone 99" matches Zone 99 and Zone 990–999 and 9900–9998.
        type(input, 'Zone 99');
        await flush();
        const expected = zones.filter((z) => z.label.includes('Zone 99')).length;
        expect(options(root)[0]!.getAttribute('aria-setsize')).toBe(String(expected));
        expect(options(root)[0]!.textContent).toContain('Zone 99');
        expectAnatomy(root, comboboxAnatomy);
    });

    it('ArrowUp opens on the last option, and Enter selects it', async () => {
        const { input, state } = mount();
        await flush();
        key(input, 'ArrowUp');
        await flush();
        expect(active(input).textContent).toContain('Yukon');
        key(input, 'PageUp');
        await flush();
        expect(active(input).getAttribute('aria-posinset')).toBe(String(10_000 - 5));
        key(input, 'End'); // stays with the caret (APG): the highlight holds
        key(input, 'Enter');
        await flush();
        expect(state.zone?.value).toBe(`z${10_000 - 6}`);
        expect(input.value).toBe(`Zone ${10_000 - 6}`);
    });

    it('multiple: selections toggle into tags, the list stays open, the hidden select posts them', async () => {
        const state = signal({ picked: [] as Zone[] });
        const root = host();
        render(<Combobox.Root items={zones} virtual={virtualListbox} multiple model={[state, 'picked']} name="zones" />, root);
        const input = root.querySelector<HTMLInputElement>('[data-part="input"]')!;
        await flush();
        key(input, 'ArrowUp');
        await flush();
        key(input, 'Enter');
        key(input, 'ArrowUp');
        key(input, 'Enter');
        await flush();
        expect(state.picked.map((z) => z.value)).toEqual(['z9999', 'z9998']);
        expect(input.getAttribute('aria-expanded')).toBe('true');
        expect([...root.querySelectorAll('[data-part="tag-label"]')].map((t) => t.textContent)).toEqual(['Yukon', 'Zone 9998']);
        const hidden = root.querySelector<HTMLSelectElement>('select[data-part="hidden-input"]')!;
        expect([...hidden.selectedOptions].map((o) => o.value)).toEqual(['z9999', 'z9998']);
        expect(hidden.options.length).toBe(2);
    });

    it('allowCustom still commits free text', async () => {
        const state = signal({ code: null as string | null });
        const root = host();
        render(<Combobox.Root items={zones.map((z) => z.label)} virtual={virtualListbox} allowCustom model={[state, 'code']} />, root);
        const input = root.querySelector<HTMLInputElement>('[data-part="input"]')!;
        await flush();
        type(input, 'Atlantis');
        await flush();
        key(input, 'Enter');
        await flush();
        expect(state.code).toBe('Atlantis');
    });
});
