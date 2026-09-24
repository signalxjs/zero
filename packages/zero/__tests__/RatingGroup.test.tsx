import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { RatingGroup, ratingGroupAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

function mount(container: HTMLElement, extra: {
    model?: unknown;
    defaultValue?: number;
    allowHalf?: boolean;
    deselectable?: boolean;
    name?: string;
    readonly?: boolean;
    disabled?: boolean;
    count?: number;
    required?: boolean;
} = {}) {
    const count = extra.count ?? 5;
    render(
        <RatingGroup.Root
            model={extra.model as never}
            defaultValue={extra.defaultValue}
            allowHalf={extra.allowHalf}
            deselectable={extra.deselectable}
            name={extra.name}
            readonly={extra.readonly}
            disabled={extra.disabled}
            count={count}
            required={extra.required}
        >
            <RatingGroup.Label>Rating</RatingGroup.Label>
            <RatingGroup.Control>
                {Array.from({ length: count }, (_, i) => <RatingGroup.Item index={i + 1} />)}
            </RatingGroup.Control>
        </RatingGroup.Root>,
        container,
    );
}

const items = (c: HTMLElement) => c.querySelectorAll<HTMLElement>('[data-part="item"]');
const key = (k: string) => new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });

describe('RatingGroup', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy with radiogroup semantics', () => {
        mount(container, { defaultValue: 3, name: 'stars' });
        expectAnatomy(container, ratingGroupAnatomy);
        const control = container.querySelector<HTMLElement>('[data-part="control"]')!;
        expect(control.getAttribute('role')).toBe('radiogroup');
        expect(control.getAttribute('aria-labelledby'))
            .toBe(container.querySelector('[data-part="label"]')!.id);
        const all = items(container);
        expect(all.length).toBe(5);
        expect(all[2]!.getAttribute('aria-checked')).toBe('true');
        expect(all[0]!.getAttribute('aria-checked')).toBe('false');
    });

    it('items default to an "N of M" name; itemLabel overrides it', () => {
        mount(container, { defaultValue: 3 });
        expect(items(container)[2]!.getAttribute('aria-label')).toBe('3 of 5');

        const other = document.createElement('div');
        document.body.appendChild(other);
        render(
            <RatingGroup.Root defaultValue={2} itemLabel={(index, count) => `${index} av ${count} stjärnor`}>
                <RatingGroup.Control>
                    {Array.from({ length: 5 }, (_, i) => <RatingGroup.Item index={i + 1} />)}
                </RatingGroup.Control>
            </RatingGroup.Root>,
            other,
        );
        // The hardcoded English string was untranslatable — the override is
        // the localization seam.
        expect(items(other)[2]!.getAttribute('aria-label')).toBe('3 av 5 stjärnor');
    });

    it('data-state mirrors the committed value: full up to it, empty after', () => {
        mount(container, { defaultValue: 3 });
        const states = [...items(container)].map((i) => i.getAttribute('data-state'));
        expect(states).toEqual(['full', 'full', 'full', 'empty', 'empty']);
    });

    it('a fractional value renders a half item', () => {
        mount(container, { defaultValue: 2.5, allowHalf: true });
        const states = [...items(container)].map((i) => i.getAttribute('data-state'));
        expect(states).toEqual(['full', 'full', 'half', 'empty', 'empty']);
    });

    /**
     * The default symbol is `★`/`★`/`☆` — `half` is a FULL star, deliberately.
     *
     * The half-star codepoint `⯪` (U+2BEA) has no coverage in the macOS/Chromium
     * sans stacks and resolved to the last-resort tofu box (#222). Rendering a
     * distinct half belongs to the design system: `@sigx/zero-daisyui` halves
     * this glyph with `mask-size: 50% 100%` and `@sigx/zero-material` with a
     * hard-stop gradient under `background-clip: text` — both need a full-width
     * star in the `half` state to cut in two. Do not "restore" a half glyph.
     */
    it('the default symbol is a text star, and half is a full one', () => {
        mount(container, { defaultValue: 3.5, allowHalf: true });
        const all = [...items(container)];
        expect(all.map((i) => i.getAttribute('data-state')))
            .toEqual(['full', 'full', 'full', 'half', 'empty']);
        expect([all[2]!, all[3]!, all[4]!].map((i) => i.textContent))
            .toEqual(['★', '★', '☆']);
        // A bare text node, not an element: design systems gate their drawn
        // geometry on `:not(:has(> *))` / `:has(*)` to tell the default apart
        // from a consumer's own symbol.
        expect(all[3]!.children.length).toBe(0);
    });

    it('click commits the item index', () => {
        const state = signal({ stars: 0 });
        mount(container, { model: [state, 'stars'] });
        items(container)[3]!.click();
        expect(state.stars).toBe(4);
    });

    it('deselectable: clicking the current value clears to 0', () => {
        const state = signal({ stars: 2 });
        mount(container, { model: [state, 'stars'], deselectable: true });
        items(container)[1]!.click();
        expect(state.stars).toBe(0);
        items(container)[1]!.click();
        expect(state.stars).toBe(2);
    });

    it('keyboard moves the value, not element focus semantics: arrows, Home, End', () => {
        const state = signal({ stars: 2 });
        mount(container, { model: [state, 'stars'] });
        const all = items(container);
        all[1]!.dispatchEvent(key('ArrowRight'));
        expect(state.stars).toBe(3);
        all[2]!.dispatchEvent(key('ArrowLeft'));
        expect(state.stars).toBe(2);
        all[1]!.dispatchEvent(key('End'));
        expect(state.stars).toBe(5);
        all[4]!.dispatchEvent(key('Home'));
        expect(state.stars).toBe(1);
        all[0]!.dispatchEvent(key('ArrowDown'));
        expect(state.stars).toBe(0);
    });

    it('allowHalf steps by 0.5 and Home is the half step', () => {
        const state = signal({ stars: 2 });
        mount(container, { model: [state, 'stars'], allowHalf: true });
        const all = items(container);
        all[1]!.dispatchEvent(key('ArrowUp'));
        expect(state.stars).toBe(2.5);
        all[2]!.dispatchEvent(key('Home'));
        expect(state.stars).toBe(0.5);
    });

    it('one tab stop rides ceil(value), falling back to item 1', () => {
        mount(container, { defaultValue: 2.5, allowHalf: true });
        const all = items(container);
        expect([...all].map((i) => i.tabIndex)).toEqual([-1, -1, 0, -1, -1]);

        const empty = document.createElement('div');
        document.body.appendChild(empty);
        mount(empty, {});
        expect([...items(empty)].map((i) => i.tabIndex)).toEqual([0, -1, -1, -1, -1]);
    });

    it('hover previews without committing; leaving the control clears it', () => {
        const state = signal({ stars: 1 });
        mount(container, { model: [state, 'stars'] });
        const all = items(container);
        all[3]!.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
        expect(all[3]!.getAttribute('data-state')).toBe('full');
        expect(all[3]!.hasAttribute('data-highlighted')).toBe(true);
        expect(all[1]!.hasAttribute('data-highlighted')).toBe(true);
        expect(all[4]!.hasAttribute('data-highlighted')).toBe(false);
        expect(state.stars).toBe(1);
        container.querySelector<HTMLElement>('[data-part="control"]')!
            .dispatchEvent(new PointerEvent('pointerleave'));
        expect(all[3]!.getAttribute('data-state')).toBe('empty');
    });

    it('the hidden input posts the value; empty rating posts nothing; disabled does not submit', () => {
        mount(container, { defaultValue: 3.5, allowHalf: true, name: 'stars' });
        expect(container.querySelector<HTMLInputElement>('[data-part="hidden-input"]')!.value).toBe('3.5');

        const c2 = document.createElement('div');
        document.body.appendChild(c2);
        mount(c2, { name: 'stars' });
        expect(c2.querySelector<HTMLInputElement>('[data-part="hidden-input"]')!.value).toBe('');

        const c3 = document.createElement('div');
        document.body.appendChild(c3);
        mount(c3, { name: 'stars', defaultValue: 2, disabled: true });
        expect(c3.querySelector<HTMLInputElement>('[data-part="hidden-input"]')!.disabled).toBe(true);
    });

    it('readonly renders the value and suppresses all interaction', () => {
        const state = signal({ stars: 2 });
        mount(container, { model: [state, 'stars'], readonly: true });
        const all = items(container);
        expect(all[1]!.getAttribute('data-state')).toBe('full');
        all[3]!.click();
        all[1]!.dispatchEvent(key('ArrowRight'));
        all[3]!.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
        expect(state.stars).toBe(2);
        expect(all[3]!.getAttribute('data-state')).toBe('empty');
    });

    it('disabled blocks commits and carries the flag everywhere', () => {
        const state = signal({ stars: 2 });
        mount(container, { model: [state, 'stars'], disabled: true });
        const all = items(container);
        expect(all[0]!.getAttribute('data-disabled')).toBe('');
        expect(all[0]!.tabIndex).toBe(-1);
        all[3]!.click();
        expect(state.stars).toBe(2);
    });

    it('deselect-to-0 parks focus on the new tab stop (item 1)', () => {
        const state = signal({ stars: 3 });
        mount(container, { model: [state, 'stars'], deselectable: true });
        const all = items(container);
        all[2]!.click();
        expect(state.stars).toBe(0);
        expect(document.activeElement).toBe(all[0]);
        expect(all[0]!.tabIndex).toBe(0);
    });

    it('keydown clears a lingering hover preview so the commit shows', () => {
        const state = signal({ stars: 2 });
        mount(container, { model: [state, 'stars'] });
        const all = items(container);
        all[4]!.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
        expect(all[4]!.getAttribute('data-state')).toBe('full');
        all[1]!.dispatchEvent(key('ArrowRight'));
        expect(state.stars).toBe(3);
        expect(all[4]!.getAttribute('data-state')).toBe('empty');
        expect(all[2]!.getAttribute('data-state')).toBe('full');
    });

    it('End respects a custom count', () => {
        const state = signal({ stars: 0 });
        mount(container, { model: [state, 'stars'], count: 3 });
        items(container)[0]!.dispatchEvent(key('End'));
        expect(state.stars).toBe(3);
    });

    it('Space and Enter on a focused item commit it (APG radio)', () => {
        const state = signal({ stars: 0 });
        mount(container, { model: [state, 'stars'] });
        const all = items(container);
        // At 0, item 1 is the tab stop — Space must be able to check it.
        const space = key(' ');
        all[0]!.dispatchEvent(space);
        expect(state.stars).toBe(1);
        expect(space.defaultPrevented).toBe(true);
        expect(all[0]!.getAttribute('aria-checked')).toBe('true');
        all[3]!.dispatchEvent(key('Enter'));
        expect(state.stars).toBe(4);
    });

    it('Space/Enter commit nothing while readonly or disabled', () => {
        const state = signal({ stars: 2 });
        mount(container, { model: [state, 'stars'], readonly: true });
        items(container)[3]!.dispatchEvent(key(' '));
        items(container)[3]!.dispatchEvent(key('Enter'));
        expect(state.stars).toBe(2);

        const other = document.createElement('div');
        container.appendChild(other);
        const disabledState = signal({ stars: 2 });
        mount(other, { model: [disabledState, 'stars'], disabled: true });
        items(other)[3]!.dispatchEvent(key(' '));
        items(other)[3]!.dispatchEvent(key('Enter'));
        expect(disabledState.stars).toBe(2);
    });

    it('readonly + required at 0 does not block the submit', () => {
        const form = document.createElement('form');
        container.appendChild(form);
        mount(form, { name: 'stars', required: true, readonly: true });
        const input = form.querySelector<HTMLInputElement>('[data-part="hidden-input"]')!;
        expect(input.required).toBe(false);
        expect(input.readOnly).toBe(true);
        expect(form.checkValidity()).toBe(true);
    });

    it('required carries aria-required and blocks an unrated form submit', () => {
        const form = document.createElement('form');
        container.appendChild(form);
        mount(form, { name: 'stars', required: true });
        const control = form.querySelector<HTMLElement>('[data-part="control"]')!;
        expect(control.getAttribute('aria-required')).toBe('true');
        expect(form.checkValidity()).toBe(false);
        items(form)[1]!.click();
        expect(form.checkValidity()).toBe(true);
        expect(new FormData(form).get('stars')).toBe('2');
    });

    it('not required: no aria-required, and an unrated form is valid', () => {
        const form = document.createElement('form');
        container.appendChild(form);
        mount(form, { name: 'stars' });
        expect(form.querySelector('[data-part="control"]')!.hasAttribute('aria-required')).toBe(false);
        expect(form.checkValidity()).toBe(true);
    });

    it('the invalid event lands focus on the tab stop, not the 1px input', () => {
        const form = document.createElement('form');
        container.appendChild(form);
        mount(form, { name: 'stars', required: true });
        const input = form.querySelector<HTMLInputElement>('[data-part="hidden-input"]')!;
        const invalid = new Event('invalid', { cancelable: true });
        input.dispatchEvent(invalid);
        expect(invalid.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(items(form)[0]);
    });
});
