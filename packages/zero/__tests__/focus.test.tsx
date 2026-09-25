import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Collapsible, Dialog, Menu, Popover, createFocusRestore, focusFirst, getTabbables, isFocusable } from '@sigx/zero';

const tick = () => new Promise((r) => setTimeout(r, 0));

let container: HTMLElement;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});
afterEach(() => {
    vi.restoreAllMocks();
    container.remove();
    (document.activeElement as HTMLElement | null)?.blur?.();
});

function fixture(html: string): HTMLElement {
    container.innerHTML = html;
    return container;
}

const ids = (els: HTMLElement[]) => els.map((el) => el.id);

/**
 * happy-dom's `checkVisibility` knows `display` and `visibility` but not
 * what a closed `<details>` does to its content — stub the browser's
 * reading: everything but the summary is unrendered while closed.
 */
function stubDetailsVisibility(): void {
    const original = HTMLElement.prototype.checkVisibility;
    vi.spyOn(HTMLElement.prototype, 'checkVisibility').mockImplementation(function (this: HTMLElement, opts) {
        const details = this.closest('details');
        if (details && !details.open && !this.closest('summary')) return false;
        return original.call(this, opts);
    });
}

describe('getTabbables', () => {
    it('reaches the widened set: summary, iframe, controls media, contenteditable', () => {
        // happy-dom renders every <audio> as display:none (a browser shows
        // one with controls), so it cannot be asked about here.
        fixture(`
            <details><summary id="s">more</summary></details>
            <iframe id="f"></iframe>
            <video id="v" controls></video>
            <div id="ce" contenteditable></div>
            <div id="ce-off" contenteditable="false"></div>
            <div id="ce-plain" contenteditable="plaintext-only"></div>
        `);
        expect(ids(getTabbables(container))).toEqual(['s', 'f', 'v', 'ce', 'ce-plain']);
    });

    it('skips a button in a closed Collapsible panel', () => {
        stubDetailsVisibility();
        const state = signal({ open: false });
        render(
            <Collapsible.Root model={[state, 'open']}>
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel><button id="inner">inside</button></Collapsible.Panel>
            </Collapsible.Root>,
            container,
        );
        const tabbables = getTabbables(container);
        expect(tabbables.map((el) => el.getAttribute('data-part'))).toEqual(['trigger']);
        expect(isFocusable(container.querySelector('#inner'))).toBe(false);
    });

    it('skips everything under [inert]', () => {
        fixture('<div inert><button id="a">a</button><a id="l" href="#x">l</a></div><button id="b">b</button>');
        expect(ids(getTabbables(container))).toEqual(['b']);
    });

    it('skips a display:none ancestor, a visibility:hidden one, and a hidden attribute', () => {
        fixture(`
            <div style="display:none"><button id="a">a</button></div>
            <div style="visibility:hidden"><button id="b">b</button></div>
            <div hidden><button id="c">c</button></div>
            <button id="d">d</button>
        `);
        expect(ids(getTabbables(container))).toEqual(['d']);
    });

    it('without checkVisibility, still skips what a hidden attribute hides', () => {
        const proto = Element.prototype as unknown as Record<string, unknown>;
        const own = Object.getOwnPropertyDescriptor(proto, 'checkVisibility');
        delete proto.checkVisibility;
        try {
            expect(typeof (document.body as { checkVisibility?: unknown }).checkVisibility).toBe('undefined');
            fixture('<div hidden><button id="a">a</button></div><button id="b">b</button>');
            expect(ids(getTabbables(container))).toEqual(['b']);
        } finally {
            if (own) Object.defineProperty(proto, 'checkVisibility', own);
        }
    });

    it('skips the form controls a disabled fieldset disables — but not its first legend, or links', () => {
        fixture(`
            <fieldset disabled>
                <legend><button id="in-legend">legend</button></legend>
                <button id="btn">b</button>
                <input id="inp">
                <a id="link" href="#x">link</a>
                <fieldset><legend><button id="nested-legend">n</button></legend></fieldset>
            </fieldset>
            <button id="after">after</button>
        `);
        expect(ids(getTabbables(container))).toEqual(['in-legend', 'link', 'after']);
    });

    it('collapses a named radio group to its checked radio, or its first', () => {
        fixture(`
            <input type="radio" name="size" id="s1">
            <input type="radio" name="size" id="s2" checked>
            <input type="radio" name="size" id="s3">
            <input type="radio" name="tone" id="t1">
            <input type="radio" name="tone" id="t2">
            <input type="radio" id="lone">
            <button id="b">b</button>
        `);
        expect(ids(getTabbables(container))).toEqual(['s2', 't1', 'lone', 'b']);
    });
});

describe('isFocusable', () => {
    it('answers for the element itself', () => {
        fixture(`
            <button id="ok">ok</button>
            <button id="dis" disabled>dis</button>
            <div id="minus" tabindex="-1">focusable, not tabbable</div>
            <span id="plain">text</span>
        `);
        const q = (id: string) => container.querySelector<HTMLElement>(`#${id}`);
        expect(isFocusable(q('ok'))).toBe(true);
        expect(isFocusable(q('dis'))).toBe(false);
        expect(isFocusable(q('minus'))).toBe(true);
        expect(isFocusable(q('plain'))).toBe(false);
        expect(isFocusable(null)).toBe(false);
        expect(isFocusable(document.body)).toBe(false);
        const detached = document.createElement('button');
        expect(isFocusable(detached)).toBe(false);
    });
});

describe('focusFirst', () => {
    it('passes over a tabbable that refuses focus to the next', () => {
        fixture('<button id="a">a</button><button id="b">b</button>');
        const a = container.querySelector<HTMLElement>('#a')!;
        a.focus = () => {};
        focusFirst(container);
        expect(document.activeElement?.id).toBe('b');
    });

    it('falls back to the container, giving it tabIndex -1 when it has none', () => {
        fixture('<span>text only</span>');
        expect(container.hasAttribute('tabindex')).toBe(false);
        focusFirst(container);
        expect(container.getAttribute('tabindex')).toBe('-1');
        expect(document.activeElement).toBe(container);
    });

    it('leaves a container tabindex it already has alone', () => {
        fixture('<span>text only</span>');
        container.tabIndex = 0;
        focusFirst(container);
        expect(container.getAttribute('tabindex')).toBe('0');
        expect(document.activeElement).toBe(container);
    });
});

describe('createFocusRestore', () => {
    function setup(opts: { withSurface?: boolean } = {}) {
        fixture(`
            <button id="trigger">trigger</button>
            <input id="outside">
            <div id="surface"><button id="inside">inside</button></div>
        `);
        const q = (id: string) => container.querySelector<HTMLElement>(`#${id}`)!;
        const state = signal({ open: false });
        createFocusRestore(() => state.open, {
            getSurface: opts.withSurface === false ? undefined : () => q('surface'),
            fallback: () => q('trigger'),
        });
        return { state, q };
    }

    it('restores the element focused before opening while focus is inside the surface', async () => {
        const { state, q } = setup();
        q('outside').focus();
        state.open = true;
        await tick();
        q('inside').focus();
        state.open = false;
        await tick();
        expect(document.activeElement).toBe(q('outside'));
    });

    it('restores when focus fell to body', async () => {
        const { state, q } = setup();
        q('trigger').focus();
        state.open = true;
        await tick();
        q('inside').focus();
        q('inside').blur();
        state.open = false;
        await tick();
        expect(document.activeElement).toBe(q('trigger'));
    });

    it('does not restore when focus already moved outside the surface', async () => {
        const { state, q } = setup();
        q('trigger').focus();
        state.open = true;
        await tick();
        q('inside').focus();
        // An outside pointerdown on an input, or a Tab out.
        q('outside').focus();
        state.open = false;
        await tick();
        expect(document.activeElement).toBe(q('outside'));
    });

    it('falls back when the remembered element is disconnected', async () => {
        const { state, q } = setup();
        const gone = document.createElement('button');
        container.appendChild(gone);
        gone.focus();
        state.open = true;
        await tick();
        gone.remove();
        q('inside').focus();
        state.open = false;
        await tick();
        expect(document.activeElement).toBe(q('trigger'));
    });

    it('falls back when the remembered element can no longer take focus', async () => {
        const { state, q } = setup();
        q('outside').focus();
        state.open = true;
        await tick();
        q('outside').setAttribute('disabled', '');
        q('inside').focus();
        state.open = false;
        await tick();
        expect(document.activeElement).toBe(q('trigger'));
    });

    it('without a surface getter, always restores', async () => {
        const { state, q } = setup({ withSurface: false });
        q('trigger').focus();
        state.open = true;
        await tick();
        q('outside').focus();
        state.open = false;
        await tick();
        expect(document.activeElement).toBe(q('trigger'));
    });
});

describe('overlays keep focus the user moved elsewhere', () => {
    it('Popover: an outside input focused before the close keeps focus', async () => {
        const state = signal({ open: false });
        render(
            <div>
                <Popover.Root model={[state, 'open']}>
                    <Popover.Trigger>Filters</Popover.Trigger>
                    <Popover.Popup><Popover.Close>Done</Popover.Close></Popover.Popup>
                </Popover.Root>
                <input id="outside" />
            </div>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-scope="popover"][data-part="trigger"]')!;
        trigger.focus();
        trigger.click();
        await tick();
        expect(document.activeElement).toBe(container.querySelector('[data-scope="popover"][data-part="close"]'));
        const input = container.querySelector<HTMLElement>('#outside')!;
        input.focus();
        state.open = false;
        await tick();
        expect(document.activeElement).toBe(input);
    });

    it('Popover: falls back to the trigger when the element focused before opening is gone', async () => {
        const state = signal({ open: false });
        render(
            <Popover.Root model={[state, 'open']}>
                <Popover.Trigger>Filters</Popover.Trigger>
                <Popover.Popup><Popover.Close>Done</Popover.Close></Popover.Popup>
            </Popover.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-scope="popover"][data-part="trigger"]')!;
        const opener = document.createElement('button');
        document.body.appendChild(opener);
        opener.focus();
        state.open = true;
        await tick();
        opener.remove();
        state.open = false;
        await tick();
        expect(document.activeElement).toBe(trigger);
    });

    it('Menu: an outside input focused before the close keeps focus', async () => {
        const state = signal({ open: false });
        render(
            <div>
                <Menu.Root model={[state, 'open']}>
                    <Menu.Trigger>Actions</Menu.Trigger>
                    <Menu.Popup><Menu.Item value="a">A</Menu.Item></Menu.Popup>
                </Menu.Root>
                <input id="outside" />
            </div>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-scope="menu"][data-part="trigger"]')!;
        trigger.focus();
        state.open = true;
        await tick();
        const input = container.querySelector<HTMLElement>('#outside')!;
        input.focus();
        state.open = false;
        await tick();
        expect(document.activeElement).toBe(input);
    });

    it('Dialog (non-modal): an outside input focused before the close keeps focus', async () => {
        const state = signal({ open: false });
        render(
            <div>
                <Dialog.Root model={[state, 'open']} modal={false}>
                    <Dialog.Trigger>Open</Dialog.Trigger>
                    <Dialog.Popup><Dialog.Title>T</Dialog.Title><Dialog.Close>Close</Dialog.Close></Dialog.Popup>
                </Dialog.Root>
                <input id="outside" />
            </div>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-scope="dialog"][data-part="trigger"]')!;
        trigger.focus();
        trigger.click();
        await tick();
        const input = container.querySelector<HTMLElement>('#outside')!;
        input.focus();
        state.open = false;
        await tick();
        expect(document.activeElement).toBe(input);
    });
});
