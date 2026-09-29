/**
 * #460 — `createHotkeys` / `<Hotkeys>`: `aria-keyshortcuts` parsing, the
 * matcher's modifier rules, and the guards a keydown passes before a
 * binding fires. `:modal` and `:popover-open` need a real engine (happy-dom
 * matches neither), so the modal and native-popup guards are also held by
 * `examples/playground/e2e/hotkeys.spec.ts`; here the modal one is reached
 * through a stubbed `querySelectorAll`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { component, signal } from 'sigx';
import {
    Combobox, Dialog, Drawer, Hotkeys, Tooltip,
    createHotkeys, isEditableTarget, matchesHotkey, matchesKeyCombo, parseHotkey,
} from '@sigx/zero';
import type { HotkeyBindings, HotkeysOptions } from '@sigx/zero';

const tick = () => new Promise((r) => setTimeout(r, 0));

function key(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
    const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(e);
    return e;
}

const ev = (init: KeyboardEventInit): KeyboardEvent => new KeyboardEvent('keydown', init);

describe('parseHotkey', () => {
    it('reads modifiers and the key, in aria-keyshortcuts syntax', () => {
        expect(parseHotkey('Control+Shift+K')).toEqual([{ key: 'K', ctrl: true, alt: false, meta: false, shift: true }]);
        expect(parseHotkey('Shift+?')).toEqual([{ key: '?', ctrl: false, alt: false, meta: false, shift: true }]);
        expect(parseHotkey('?')).toEqual([{ key: '?', ctrl: false, alt: false, meta: false, shift: false }]);
        expect(parseHotkey('j')).toEqual([{ key: 'j', ctrl: false, alt: false, meta: false, shift: false }]);
        expect(parseHotkey('Escape')[0].key).toBe('Escape');
        expect(parseHotkey('F8')[0].key).toBe('F8');
    });

    it('takes the last token as the key, so "Control++" binds "+"', () => {
        expect(parseHotkey('Control++')).toEqual([{ key: '+', ctrl: true, alt: false, meta: false, shift: false }]);
        expect(parseHotkey('+')[0].key).toBe('+');
    });

    it('splits space-separated alternatives', () => {
        const alts = parseHotkey('Control+S  Meta+S');
        expect(alts).toHaveLength(2);
        expect(alts[0]).toMatchObject({ key: 'S', ctrl: true, meta: false });
        expect(alts[1]).toMatchObject({ key: 'S', ctrl: false, meta: true });
    });

    it('maps Space to the space key and rejects unknown modifiers', () => {
        expect(parseHotkey('Space')[0].key).toBe(' ');
        expect(() => parseHotkey('Hyper+K')).toThrow(/unknown modifier/);
    });
});

describe('matchesHotkey', () => {
    it('matches letters case-insensitively, with Shift exact', () => {
        expect(matchesHotkey(ev({ key: 'j' }), 'j')).toBe(true);
        expect(matchesHotkey(ev({ key: 'J', shiftKey: true }), 'j')).toBe(false);
        expect(matchesHotkey(ev({ key: 'K', shiftKey: true, ctrlKey: true }), 'Control+Shift+K')).toBe(true);
        expect(matchesHotkey(ev({ key: 'k', ctrlKey: true }), 'Control+Shift+K')).toBe(false);
    });

    it('never fires on an unbound modifier chord', () => {
        expect(matchesHotkey(ev({ key: 'j', ctrlKey: true }), 'j')).toBe(false);
        expect(matchesHotkey(ev({ key: 'j', metaKey: true }), 'j')).toBe(false);
        expect(matchesHotkey(ev({ key: 'j', altKey: true }), 'j')).toBe(false);
        expect(matchesHotkey(ev({ key: 'Escape', shiftKey: true }), 'Escape')).toBe(false);
    });

    it('lets Shift through for a symbol typed as itself, unless the binding names it', () => {
        expect(matchesHotkey(ev({ key: '?', shiftKey: true }), '?')).toBe(true);
        expect(matchesHotkey(ev({ key: '?' }), '?')).toBe(true);
        expect(matchesHotkey(ev({ key: '?', shiftKey: true }), 'Shift+?')).toBe(true);
        expect(matchesHotkey(ev({ key: '?' }), 'Shift+?')).toBe(false);
    });

    it('lets AltGr through for a symbol typed as itself', () => {
        expect(matchesHotkey(ev({ key: '@', ctrlKey: true, altKey: true }), '@')).toBe(true);
        expect(matchesHotkey(ev({ key: '@', ctrlKey: true }), '@')).toBe(false);
    });

    it('falls back to the physical key for an Option chord', () => {
        expect(matchesHotkey(ev({ key: '˚', code: 'KeyK', altKey: true }), 'Alt+K')).toBe(true);
        expect(matchesHotkey(ev({ key: 'a', code: 'KeyQ' }), 'q')).toBe(false);
    });

    it('matches any alternative', () => {
        expect(matchesHotkey(ev({ key: 's', metaKey: true }), 'Control+S Meta+S')).toBe(true);
        expect(matchesHotkey(ev({ key: 's', ctrlKey: true }), 'Control+S Meta+S')).toBe(true);
    });

    it('matchesKeyCombo keeps Toast\'s form: every key down, by flag, code or key', () => {
        expect(matchesKeyCombo(ev({ key: 'F8', code: 'F8' }), ['F8'])).toBe(true);
        expect(matchesKeyCombo(ev({ key: 't', code: 'KeyT', altKey: true }), ['altKey', 'KeyT'])).toBe(true);
        expect(matchesKeyCombo(ev({ key: 't', code: 'KeyT' }), ['altKey', 'KeyT'])).toBe(false);
    });
});

describe('isEditableTarget', () => {
    it('is true for typing surfaces and false for the rest', () => {
        const make = (html: string): Element => {
            const host = document.createElement('div');
            host.innerHTML = html;
            return host.firstElementChild!;
        };
        expect(isEditableTarget(make('<input>'))).toBe(true);
        expect(isEditableTarget(make('<input type="search">'))).toBe(true);
        expect(isEditableTarget(make('<textarea></textarea>'))).toBe(true);
        expect(isEditableTarget(make('<select></select>'))).toBe(true);
        expect(isEditableTarget(make('<div role="combobox"></div>'))).toBe(true);
        expect(isEditableTarget(make('<div role="textbox"></div>'))).toBe(true);
        expect(isEditableTarget(make('<input type="checkbox">'))).toBe(false);
        expect(isEditableTarget(make('<input type="range">'))).toBe(false);
        expect(isEditableTarget(make('<button></button>'))).toBe(false);
        expect(isEditableTarget(document)).toBe(false);
    });
});

describe('createHotkeys', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        render(<span />, container);
        container.remove();
        vi.restoreAllMocks();
    });

    function probe(bindings: HotkeyBindings | (() => HotkeyBindings), options?: HotkeysOptions) {
        return component(() => {
            createHotkeys(bindings, options);
            return () => <button type="button">probe</button>;
        }, { name: 'HotkeysProbe' });
    }

    it('fires the matching binding from the document and prevents its default', () => {
        const j = vi.fn();
        const Probe = probe({ j });
        render(<Probe />, container);
        const e = key(document.body, { key: 'j' });
        expect(j).toHaveBeenCalledTimes(1);
        expect(j).toHaveBeenCalledWith(e);
        expect(e.defaultPrevented).toBe(true);
        // An unbound key is left alone.
        expect(key(document.body, { key: 'x' }).defaultPrevented).toBe(false);
    });

    it('throws outside a component setup', () => {
        expect(() => createHotkeys({ j: () => {} })).toThrow(/setup/);
    });

    it('ignores typing: input, textarea, contenteditable, combobox role', () => {
        const j = vi.fn();
        const Probe = probe({ j });
        render(<Probe />, container);
        for (const html of ['<input>', '<textarea></textarea>', '<div contenteditable="true"></div>', '<div role="combobox" tabindex="0"></div>']) {
            const host = document.createElement('div');
            host.innerHTML = html;
            container.appendChild(host);
            key(host.firstElementChild!, { key: 'j' });
            host.remove();
        }
        expect(j).not.toHaveBeenCalled();
        const box = document.createElement('input');
        box.type = 'checkbox';
        container.appendChild(box);
        key(box, { key: 'j' });
        expect(j).toHaveBeenCalledTimes(1);
    });

    it('ignores an unbound modifier chord, IME composition and a handled keydown', () => {
        const j = vi.fn();
        const Probe = probe({ j });
        render(<Probe />, container);
        key(document.body, { key: 'j', ctrlKey: true });
        key(document.body, { key: 'j', isComposing: true });
        key(document.body, { key: 'Process', keyCode: 229 });
        const handled = new KeyboardEvent('keydown', { key: 'j', bubbles: true, cancelable: true });
        handled.preventDefault();
        document.body.dispatchEvent(handled);
        expect(j).not.toHaveBeenCalled();
    });

    it('stays quiet while a modal dialog is up', () => {
        const j = vi.fn();
        const Probe = probe({ j });
        render(<Probe />, container);
        const dialog = document.createElement('dialog');
        container.appendChild(dialog);
        // happy-dom matches no `:modal`: stand in for the engine.
        const real = document.querySelectorAll.bind(document);
        vi.spyOn(document, 'querySelectorAll').mockImplementation(((sel: string) =>
            sel === 'dialog:modal' ? [dialog] : real(sel)) as typeof document.querySelectorAll);
        key(document.body, { key: 'j' });
        expect(j).not.toHaveBeenCalled();
    });

    it('a non-modal Dialog owns only the keys typed inside it', async () => {
        const j = vi.fn();
        const Probe = probe({ j });
        const state = signal({ open: true });
        render(
            <div>
                <Probe />
                <Dialog.Root model={[state, 'open']} modal={false}>
                    <Dialog.Trigger>Open</Dialog.Trigger>
                    <Dialog.Popup><Dialog.Title>Title</Dialog.Title><button type="button">inside</button></Dialog.Popup>
                </Dialog.Root>
            </div>,
            container,
        );
        await tick();
        const inside = container.querySelector<HTMLElement>('[data-scope="dialog"][data-part="popup"] button')!;
        key(inside, { key: 'j' });
        expect(j).not.toHaveBeenCalled();
        // The page beside a non-modal dialog stays live.
        key(document.body, { key: 'j' });
        expect(j).toHaveBeenCalledTimes(1);
        state.open = false;
        await tick();
        key(inside, { key: 'j' });
        expect(j).toHaveBeenCalledTimes(2);
    });

    it('an inline Drawer owns only the keys typed inside it', async () => {
        const j = vi.fn();
        const Probe = probe({ j });
        const state = signal({ open: true });
        render(
            <div>
                <Probe />
                <Drawer.Root model={[state, 'open']} modal={false}>
                    <Drawer.Panel><Drawer.Title>Nav</Drawer.Title><button type="button">inside</button></Drawer.Panel>
                </Drawer.Root>
            </div>,
            container,
        );
        await tick();
        key(container.querySelector<HTMLElement>('[data-scope="drawer"][data-part="panel"] button')!, { key: 'j' });
        expect(j).not.toHaveBeenCalled();
        key(document.body, { key: 'j' });
        expect(j).toHaveBeenCalledTimes(1);
    });

    it('stays quiet while a Combobox list is open', async () => {
        const j = vi.fn();
        const Probe = probe({ j });
        const state = signal({ open: true });
        render(
            <div>
                <Probe />
                <Combobox.Root model:open={[state, 'open']}>
                    <Combobox.Control><Combobox.Input /></Combobox.Control>
                    <Combobox.Popup><Combobox.Item value="a">A</Combobox.Item></Combobox.Popup>
                </Combobox.Root>
            </div>,
            container,
        );
        await tick();
        key(document.body, { key: 'j' });
        expect(j).not.toHaveBeenCalled();
    });

    it('an open Tooltip does not take the keyboard', async () => {
        const j = vi.fn();
        const Probe = probe({ j });
        render(
            <div>
                <Probe />
                <Tooltip.Root defaultOpen>
                    <Tooltip.Trigger>Save</Tooltip.Trigger>
                    <Tooltip.Popup>Save the document</Tooltip.Popup>
                </Tooltip.Root>
            </div>,
            container,
        );
        await tick();
        expect(container.querySelector('[data-scope="tooltip"][data-part="popup"]')!.getAttribute('data-state')).toBe('open');
        key(document.body, { key: 'j' });
        expect(j).toHaveBeenCalledTimes(1);
    });

    it('a listener inside the owning surface still fires', async () => {
        const j = vi.fn();
        const state = signal({ open: true });
        const Inner = component(() => {
            // The ref is set before mount hooks run, which is when the
            // target is first read.
            let el: HTMLElement | null = null;
            createHotkeys({ j }, { target: () => el });
            return () => <div ref={(n: HTMLElement | null) => { el = n; }} tabIndex={-1}>inner</div>;
        }, { name: 'Inner' });
        render(
            <Dialog.Root model={[state, 'open']} modal={false}>
                <Dialog.Trigger>Open</Dialog.Trigger>
                <Dialog.Popup><Dialog.Title>Title</Dialog.Title><Inner /></Dialog.Popup>
            </Dialog.Root>,
            container,
        );
        await tick();
        const inner = container.querySelector<HTMLElement>('[tabindex="-1"]')!;
        key(inner, { key: 'j' });
        expect(j).toHaveBeenCalledTimes(1);
        // The document outside its target never reaches it.
        key(document.body, { key: 'j' });
        expect(j).toHaveBeenCalledTimes(1);
    });

    it('follows enabled and reads the bindings getter on every keydown', () => {
        const a = vi.fn();
        const b = vi.fn();
        const state = signal({ on: true, which: 'a' as 'a' | 'b' });
        const Probe = probe(() => ({ j: state.which === 'a' ? a : b }), { enabled: () => state.on });
        render(<Probe />, container);
        key(document.body, { key: 'j' });
        state.on = false;
        key(document.body, { key: 'j' });
        state.on = true;
        state.which = 'b';
        key(document.body, { key: 'j' });
        expect(a).toHaveBeenCalledTimes(1);
        expect(b).toHaveBeenCalledTimes(1);
    });

    it('unmount removes the listener', () => {
        const j = vi.fn();
        const Probe = probe({ j });
        const add = vi.spyOn(document, 'addEventListener');
        const remove = vi.spyOn(document, 'removeEventListener');
        render(<Probe />, container);
        const listener = add.mock.calls.find(([type]) => type === 'keydown')![1];
        render(<span />, container);
        expect(remove).toHaveBeenCalledWith('keydown', listener);
        key(document.body, { key: 'j' });
        expect(j).not.toHaveBeenCalled();
    });
});

describe('<Hotkeys>', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        render(<span />, container);
        container.remove();
    });

    it('renders nothing and fires its bindings', () => {
        const help = vi.fn();
        const esc = vi.fn();
        render(<div><Hotkeys bindings={{ '?': help, Escape: esc }} /></div>, container);
        expect(container.firstElementChild!.childElementCount).toBe(0);
        key(document.body, { key: '?', shiftKey: true });
        key(document.body, { key: 'Escape' });
        expect(help).toHaveBeenCalledTimes(1);
        expect(esc).toHaveBeenCalledTimes(1);
    });

    it('enabled={false} turns it off, and a target narrows it', async () => {
        const j = vi.fn();
        const state = signal({ on: false });
        const zone = document.createElement('div');
        container.appendChild(zone);
        const host = document.createElement('div');
        container.appendChild(host);
        render(<Hotkeys bindings={{ j }} enabled={state.on} target={zone} />, host);
        key(zone, { key: 'j' });
        expect(j).not.toHaveBeenCalled();
        render(<Hotkeys bindings={{ j }} enabled target={zone} />, host);
        await tick();
        key(zone, { key: 'j' });
        key(document.body, { key: 'j' });
        expect(j).toHaveBeenCalledTimes(1);
        render(<span />, host);
    });
});
