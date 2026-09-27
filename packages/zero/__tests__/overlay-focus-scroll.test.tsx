/**
 * Overlay focus targets, modal scroll lock and preventable dismissal (#277)
 * — Dialog, Drawer, Popover and Menu.
 *
 * happy-dom has `showModal()` (with a synchronous `close` event) but no
 * top layer, no native focus restore and no Popover API, so this suite
 * holds the wiring: which element each prop focuses, the lock's ref count on
 * the root element, and that a prevented `escapeKeyDown` / `interactOutside`
 * keeps the model open. The real-engine half — a wheel over the backdrop,
 * native restore failing into a closed menu, the light-dismiss re-show — is
 * `examples/playground/e2e/dialog.spec.ts` and `popover.spec.ts`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Dialog, Drawer, Menu, Popover, createDismissable } from '@sigx/zero';
import { acquireScrollLock, scrollLockHolders } from '../src/behaviors/scroll-lock.js';
import { createLightDismissGuard } from '../src/behaviors/dismiss.js';
import { focusHandOff, restoreFocus } from '../src/behaviors/focus.js';
import { pressDialog } from './helpers';

const tick = () => new Promise((r) => setTimeout(r, 0));
const root = () => document.documentElement;
const box = () => ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

let container: HTMLElement;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});
afterEach(() => {
    // Unmounting releases every hold the test's overlays took.
    render(null, container);
    container.remove();
    root().removeAttribute('style');
});

function escapeOn(target: EventTarget): KeyboardEvent {
    const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    target.dispatchEvent(e);
    return e;
}

describe('scroll lock', () => {
    it('ref-counts holders: the root is restored only when the last one releases', () => {
        root().style.overflow = 'clip';
        const a = acquireScrollLock();
        const b = acquireScrollLock();
        expect(root().style.overflow).toBe('hidden');
        a();
        a(); // idempotent: a second release gives up nothing more
        expect(scrollLockHolders()).toBe(1);
        expect(root().style.overflow).toBe('hidden');
        b();
        expect(scrollLockHolders()).toBe(0);
        expect(root().style.overflow).toBe('clip');
    });

    it('pads the inline end by the scrollbar width, unless scrollbar-gutter already reserves it', () => {
        const width = vi.spyOn(root(), 'clientWidth', 'get').mockReturnValue(window.innerWidth - 15);
        try {
            const release = acquireScrollLock();
            expect(root().style.paddingInlineEnd).toBe('15px');
            release();
            expect(root().style.paddingInlineEnd).toBe('');

            root().style.setProperty('scrollbar-gutter', 'stable');
            const again = acquireScrollLock();
            expect(root().style.paddingInlineEnd).toBe('');
            again();
        } finally {
            width.mockRestore();
        }
    });

    function modal(state: { open: boolean }, extra: Record<string, unknown> = {}) {
        return (
            <Dialog.Root model={[state, 'open']} {...extra}>
                <Dialog.Popup>
                    <Dialog.Title>Title</Dialog.Title>
                    <Dialog.Close>Close</Dialog.Close>
                </Dialog.Popup>
            </Dialog.Root>
        );
    }

    it('two modal dialogs hold one lock between them; closing both releases it', async () => {
        const a = signal({ open: false });
        const b = signal({ open: false });
        render(<div>{modal(a)}{modal(b)}</div>, container);
        await tick();
        a.open = true;
        expect(root().style.overflow).toBe('hidden');
        b.open = true;
        expect(scrollLockHolders()).toBe(2);
        a.open = false;
        expect(scrollLockHolders()).toBe(1);
        expect(root().style.overflow).toBe('hidden');
        b.open = false;
        expect(scrollLockHolders()).toBe(0);
        expect(root().style.overflow).toBe('');
    });

    it('preventScroll={false} and a non-modal dialog never lock', async () => {
        const a = signal({ open: false });
        const b = signal({ open: false });
        render(<div>{modal(a, { preventScroll: false })}{modal(b, { modal: false })}</div>, container);
        await tick();
        a.open = true;
        b.open = true;
        expect(scrollLockHolders()).toBe(0);
        expect(root().style.overflow).toBe('');
    });

    it('unmounting an open modal releases its hold', async () => {
        const a = signal({ open: true });
        render(modal(a), container);
        await tick();
        expect(scrollLockHolders()).toBe(1);
        render(null, container);
        expect(scrollLockHolders()).toBe(0);
    });

    it('a drawer locks in the sheet regime, never inline', async () => {
        const sheet = signal({ open: false });
        const inline = signal({ open: false });
        render(
            <div>
                <Drawer.Root model={[sheet, 'open']} label="Sheet"><Drawer.Panel>Sheet</Drawer.Panel></Drawer.Root>
                <Drawer.Root model={[inline, 'open']} modal={false} label="Inline"><Drawer.Panel>Inline</Drawer.Panel></Drawer.Root>
            </div>,
            container,
        );
        await tick();
        inline.open = true;
        expect(scrollLockHolders()).toBe(0);
        sheet.open = true;
        expect(scrollLockHolders()).toBe(1);
        sheet.open = false;
        expect(scrollLockHolders()).toBe(0);
    });
});

describe('initialFocus / finalFocus', () => {
    it('Dialog: initialFocus is focused on open, finalFocus after close', async () => {
        const state = signal({ open: false });
        const outside = document.createElement('button');
        outside.textContent = 'elsewhere';
        container.after(outside);
        render(
            <Dialog.Root
                model={[state, 'open']}
                initialFocus={() => container.querySelector<HTMLElement>('[data-testid="second"]')}
                finalFocus={() => outside}
            >
                <Dialog.Trigger>Open</Dialog.Trigger>
                <Dialog.Popup>
                    <button>First</button>
                    <button data-testid="second">Second</button>
                </Dialog.Popup>
            </Dialog.Root>,
            container,
        );
        await tick();
        container.querySelector<HTMLElement>('[data-part="trigger"]')!.focus();
        state.open = true;
        expect(document.activeElement).toBe(container.querySelector('[data-testid="second"]'));
        state.open = false;
        expect(document.activeElement).toBe(outside);
        outside.remove();
    });

    it('Dialog: a null initialFocus / finalFocus keeps the default', async () => {
        const state = signal({ open: false });
        render(
            <Dialog.Root model={[state, 'open']} initialFocus={() => null} finalFocus={() => null}>
                <Dialog.Trigger>Open</Dialog.Trigger>
                <Dialog.Popup>
                    <button data-testid="inner">Inner</button>
                </Dialog.Popup>
            </Dialog.Root>,
            container,
        );
        await tick();
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.focus();
        state.open = true;
        container.querySelector<HTMLElement>('[data-testid="inner"]')!.focus();
        state.open = false;
        expect(document.activeElement).toBe(trigger);
    });

    it('Dialog: a restore target inside a popup that has since closed hands off to that popup\'s trigger', async () => {
        const state = signal({ open: false });
        // A menu's shape: the trigger controls the popup the item sits in.
        container.innerHTML = '';
        const host = document.createElement('div');
        host.innerHTML = '<button aria-controls="pop" id="menu-trigger">Actions</button>'
            + '<div popover id="pop"><button id="item">Delete…</button></div>';
        document.body.appendChild(host);
        render(
            <Dialog.Root model={[state, 'open']}>
                <Dialog.Popup><button>Confirm</button></Dialog.Popup>
            </Dialog.Root>,
            container,
        );
        await tick();
        document.getElementById('item')!.focus();
        state.open = true;
        // The menu hides under the dialog.
        document.getElementById('pop')!.hidden = true;
        state.open = false;
        expect(document.activeElement).toBe(document.getElementById('menu-trigger'));
        host.remove();
    });

    it('Dialog (non-modal): finalFocus overrides the restore', async () => {
        const state = signal({ open: false });
        render(
            <Dialog.Root model={[state, 'open']} modal={false} finalFocus={() => container.querySelector<HTMLElement>('[data-testid="after"]')}>
                <Dialog.Trigger>Open</Dialog.Trigger>
                <Dialog.Popup><Dialog.Close>Close</Dialog.Close></Dialog.Popup>
                <button data-testid="after">After</button>
            </Dialog.Root>,
            container,
        );
        await tick();
        container.querySelector<HTMLElement>('[data-part="trigger"]')!.focus();
        state.open = true;
        container.querySelector<HTMLElement>('[data-part="close"]')!.focus();
        state.open = false;
        await tick();
        expect(document.activeElement).toBe(container.querySelector('[data-testid="after"]'));
    });

    it('Drawer: initialFocus on open, finalFocus after close', async () => {
        const state = signal({ open: false });
        render(
            <Drawer.Root
                model={[state, 'open']}
                label="Nav"
                initialFocus={() => container.querySelector<HTMLElement>('[data-testid="link"]')}
                finalFocus={() => container.querySelector<HTMLElement>('[data-testid="after"]')}
            >
                <Drawer.Trigger>Menu</Drawer.Trigger>
                <Drawer.Panel>
                    <Drawer.Close>Close</Drawer.Close>
                    <a href="#x" data-testid="link">Home</a>
                </Drawer.Panel>
                <button data-testid="after">After</button>
            </Drawer.Root>,
            container,
        );
        await tick();
        container.querySelector<HTMLElement>('[data-part="trigger"]')!.focus();
        state.open = true;
        expect(document.activeElement).toBe(container.querySelector('[data-testid="link"]'));
        state.open = false;
        expect(document.activeElement).toBe(container.querySelector('[data-testid="after"]'));
    });

    it('Popover: initialFocus replaces the first tabbable; finalFocus replaces the trigger', async () => {
        const state = signal({ open: false });
        render(
            <Popover.Root
                model={[state, 'open']}
                initialFocus={() => container.querySelector<HTMLElement>('[data-testid="second"]')}
                finalFocus={() => container.querySelector<HTMLElement>('[data-testid="after"]')}
            >
                <Popover.Trigger>Filters</Popover.Trigger>
                <Popover.Popup>
                    <button>First</button>
                    <button data-testid="second">Second</button>
                </Popover.Popup>
                <button data-testid="after">After</button>
            </Popover.Root>,
            container,
        );
        await tick();
        container.querySelector<HTMLElement>('[data-part="trigger"]')!.focus();
        state.open = true;
        await tick();
        expect(document.activeElement).toBe(container.querySelector('[data-testid="second"]'));
        state.open = false;
        await tick();
        expect(document.activeElement).toBe(container.querySelector('[data-testid="after"]'));
    });

    it('Popover: without initialFocus the first tabbable still takes focus', async () => {
        const state = signal({ open: false });
        render(
            <Popover.Root model={[state, 'open']}>
                <Popover.Trigger>Filters</Popover.Trigger>
                <Popover.Popup>
                    <button data-testid="first">First</button>
                </Popover.Popup>
            </Popover.Root>,
            container,
        );
        await tick();
        state.open = true;
        await tick();
        expect(document.activeElement).toBe(container.querySelector('[data-testid="first"]'));
    });

    it('focusHandOff walks aria-controls outwards, and gives up on nothing focusable', () => {
        const host = document.createElement('div');
        host.innerHTML = '<button aria-controls="m" id="t">Menu</button>'
            + '<div popover id="m" hidden><button aria-controls="s" id="st">Share</button>'
            + '<div popover id="s" hidden><button id="deep">Email</button></div></div>'
            + '<div popover id="orphan" hidden><button id="lost">Lost</button></div>';
        document.body.appendChild(host);
        expect(focusHandOff(document.getElementById('deep'))).toBe(document.getElementById('t'));
        expect(focusHandOff(document.getElementById('lost'))).toBeNull();
        expect(focusHandOff(document.getElementById('t'))).toBe(document.getElementById('t'));
        host.remove();
    });

    it('restoreFocus leaves focus the user moved elsewhere', () => {
        const host = document.createElement('div');
        host.innerHTML = '<button id="a">A</button><button id="b">B</button><div id="s"></div>';
        document.body.appendChild(host);
        document.getElementById('b')!.focus();
        restoreFocus(document.getElementById('a'), { getSurface: () => document.getElementById('s') });
        expect(document.activeElement).toBe(document.getElementById('b'));
        host.remove();
    });
});

describe('preventable escapeKeyDown / interactOutside', () => {
    function mountDialog(state: { open: boolean }, handlers: Record<string, unknown>, extra: Record<string, unknown> = {}) {
        render(
            <Dialog.Root model={[state, 'open']} {...handlers} {...extra}>
                <Dialog.Popup>
                    <Dialog.Title>Title</Dialog.Title>
                    <Dialog.Close>Close</Dialog.Close>
                </Dialog.Popup>
            </Dialog.Root>,
            container,
        );
        const popup = container.querySelector<HTMLDialogElement>('dialog')!;
        popup.getBoundingClientRect = box;
        return popup;
    }

    // Stops at the container, as Dialog.test.tsx does: only this dialog's
    // own guard is under test.
    const escapeInside = (target: HTMLElement) => {
        const stop = (ev: Event) => ev.stopPropagation();
        container.addEventListener('keydown', stop);
        const e = escapeOn(target);
        container.removeEventListener('keydown', stop);
        return e;
    };

    it('Dialog: a prevented escapeKeyDown stops the Escape before it is a close request', () => {
        const state = signal({ open: true });
        const seen: KeyboardEvent[] = [];
        const popup = mountDialog(state, { onEscapeKeyDown: (e: KeyboardEvent) => { seen.push(e); e.preventDefault(); } });
        const e = escapeInside(container.querySelector<HTMLElement>('[data-part="title"]')!);
        expect(seen).toEqual([e]);
        expect(e.defaultPrevented).toBe(true);
        expect(popup.open).toBe(true);
        expect(state.open).toBe(true);
    });

    it('Dialog: an unprevented escapeKeyDown lets the native cancel close it, asked once', () => {
        const state = signal({ open: true });
        const onEscape = vi.fn();
        const popup = mountDialog(state, { onEscapeKeyDown: onEscape });
        const e = escapeInside(popup);
        expect(e.defaultPrevented).toBe(false);
        // The close request the keydown becomes.
        popup.dispatchEvent(new Event('cancel', { cancelable: true }));
        expect(onEscape).toHaveBeenCalledTimes(1);
        expect(state.open).toBe(false);
    });

    it('Dialog: a cancel with no keydown seen asks with a synthesized Escape', () => {
        const state = signal({ open: true });
        const seen: KeyboardEvent[] = [];
        const popup = mountDialog(state, { onEscapeKeyDown: (e: KeyboardEvent) => { seen.push(e); e.preventDefault(); } });
        popup.dispatchEvent(new Event('cancel', { cancelable: true }));
        expect(seen).toHaveLength(1);
        expect(seen[0]!.key).toBe('Escape');
        expect(state.open).toBe(true);
    });

    it('Dialog: escapeKeyDown does not fire when Escape would not dismiss', () => {
        const onEscape = vi.fn();
        const popup = mountDialog(signal({ open: true }), { onEscapeKeyDown: onEscape }, { dismissible: false });
        escapeInside(popup);
        popup.dispatchEvent(new Event('cancel', { cancelable: true }));
        expect(onEscape).not.toHaveBeenCalled();
    });

    it('Dialog: a prevented interactOutside keeps a backdrop press from dismissing', () => {
        const state = signal({ open: true });
        const seen: Event[] = [];
        const popup = mountDialog(state, { onInteractOutside: (e: Event) => { seen.push(e); e.preventDefault(); } });
        pressDialog(popup, { x: 300, y: 50 });
        expect(seen).toHaveLength(1);
        expect(state.open).toBe(true);
    });

    it('Dialog: an unprevented interactOutside dismisses as before', () => {
        const state = signal({ open: true });
        const onOutside = vi.fn();
        const popup = mountDialog(state, { onInteractOutside: onOutside });
        pressDialog(popup, { x: 300, y: 50 });
        expect(onOutside).toHaveBeenCalledTimes(1);
        expect(state.open).toBe(false);
    });

    it('Dialog (non-modal): a prevented escapeKeyDown keeps the dismiss layer from closing', async () => {
        const state = signal({ open: true });
        mountDialog(state, { onEscapeKeyDown: (e: KeyboardEvent) => e.preventDefault() }, { modal: false });
        await tick();
        escapeOn(document.body);
        expect(state.open).toBe(true);
        state.open = false;
    });

    it('Drawer: escapeKeyDown and interactOutside veto the sheet\'s dismissals', () => {
        const state = signal({ open: true });
        render(
            <Drawer.Root
                model={[state, 'open']}
                label="Nav"
                onEscapeKeyDown={(e: KeyboardEvent) => e.preventDefault()}
                onInteractOutside={(e: Event) => e.preventDefault()}
            >
                <Drawer.Panel><Drawer.Close>Close</Drawer.Close></Drawer.Panel>
            </Drawer.Root>,
            container,
        );
        const panel = container.querySelector<HTMLDialogElement>('dialog')!;
        panel.getBoundingClientRect = box;
        pressDialog(panel, { x: 300, y: 50 });
        expect(state.open).toBe(true);
        panel.dispatchEvent(new Event('cancel', { cancelable: true }));
        expect(state.open).toBe(true);
    });

    it('Popover: Escape and an outside press ask first; the trigger is not outside', async () => {
        const state = signal({ open: true });
        const escapes: KeyboardEvent[] = [];
        const outside: Event[] = [];
        render(
            <div>
                <Popover.Root
                    model={[state, 'open']}
                    onEscapeKeyDown={(e: KeyboardEvent) => { escapes.push(e); e.preventDefault(); }}
                    onInteractOutside={(e: Event) => outside.push(e)}
                >
                    <Popover.Trigger>Filters</Popover.Trigger>
                    <Popover.Popup><button>Inside</button></Popover.Popup>
                </Popover.Root>
                <button data-testid="elsewhere">Elsewhere</button>
            </div>,
            container,
        );
        await tick();
        const e = escapeOn(container.querySelector('[data-part="popup"] button')!);
        expect(escapes).toEqual([e]);
        expect(e.defaultPrevented).toBe(true);
        const press = (el: Element) => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        press(container.querySelector('[data-part="trigger"]')!);
        press(container.querySelector('[data-part="popup"] button')!);
        expect(outside).toHaveLength(0);
        press(container.querySelector('[data-testid="elsewhere"]')!);
        expect(outside).toHaveLength(1);
        state.open = false;
    });

    it('Menu: focus moving outside asks interactOutside first, and a veto keeps it open', async () => {
        const state = signal({ open: true });
        const seen: Event[] = [];
        render(
            <div>
                <Menu.Root model={[state, 'open']} onInteractOutside={(e: Event) => { seen.push(e); e.preventDefault(); }}>
                    <Menu.Trigger>Actions</Menu.Trigger>
                    <Menu.Popup><Menu.Item value="a">A</Menu.Item></Menu.Popup>
                </Menu.Root>
                <button data-testid="elsewhere">Elsewhere</button>
            </div>,
            container,
        );
        await tick();
        container.querySelector<HTMLElement>('[data-testid="elsewhere"]')!.focus();
        expect(seen.some((e) => e.type === 'focusin')).toBe(true);
        expect(state.open).toBe(true);
        state.open = false;
    });

    it('Menu: escapeKeyDown fires for the root, not while a nested close watcher owns Escape', async () => {
        const state = signal({ open: true });
        const onEscape = vi.fn();
        render(
            <Menu.Root model={[state, 'open']} onEscapeKeyDown={onEscape}>
                <Menu.Trigger>Actions</Menu.Trigger>
                <Menu.Popup>
                    <Menu.Item value="a">A</Menu.Item>
                    <dialog data-testid="nested"><button>Inner</button></dialog>
                </Menu.Popup>
            </Menu.Root>,
            container,
        );
        await tick();
        const nested = container.querySelector<HTMLDialogElement>('[data-testid="nested"]')!;
        nested.show();
        escapeOn(nested.querySelector('button')!);
        expect(onEscape).not.toHaveBeenCalled();
        nested.close();
        escapeOn(container.querySelector('[role="menuitem"]')!);
        expect(onEscape).toHaveBeenCalledTimes(1);
        state.open = false;
    });
});

describe('createLightDismissGuard', () => {
    it('remembers a prevented outside press for the toggle that follows, once', () => {
        const state = signal({ open: true });
        const surface = document.createElement('div');
        const outside = document.createElement('button');
        document.body.append(surface, outside);
        const guard = createLightDismissGuard({
            getElement: () => surface,
            isOpen: () => state.open,
            onInteractOutside: (e) => e.preventDefault(),
        });
        outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
        expect(guard.keepOpen()).toBe(true);
        expect(guard.keepOpen()).toBe(false);
        state.open = false;
        surface.remove();
        outside.remove();
    });

    it('an unprevented press, or a closed model, never keeps it open', () => {
        const state = signal({ open: true });
        const surface = document.createElement('div');
        const outside = document.createElement('button');
        document.body.append(surface, outside);
        let veto = false;
        const guard = createLightDismissGuard({
            getElement: () => surface,
            isOpen: () => state.open,
            onInteractOutside: (e) => { if (veto) e.preventDefault(); },
        });
        outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
        expect(guard.keepOpen()).toBe(false);
        veto = true;
        outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
        state.open = false;
        expect(guard.keepOpen()).toBe(false);
        surface.remove();
        outside.remove();
    });
});

describe('createDismissable hooks', () => {
    it('onEscapeKeyDown and onInteractOutside run before the dismissal and can veto it', () => {
        const state = signal({ open: true });
        const surface = document.createElement('div');
        const outside = document.createElement('button');
        document.body.append(surface, outside);
        const dismiss = vi.fn();
        let veto = true;
        createDismissable({
            getElement: () => surface,
            isOpen: () => state.open,
            dismiss,
            onEscapeKeyDown: (e) => { if (veto) e.preventDefault(); },
            onInteractOutside: (e) => { if (veto) e.preventDefault(); },
        });
        escapeOn(document.body);
        outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
        expect(dismiss).not.toHaveBeenCalled();
        veto = false;
        escapeOn(document.body);
        outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
        expect(dismiss).toHaveBeenCalledTimes(2);
        state.open = false;
        surface.remove();
        outside.remove();
    });
});

describe('askToPrevent', () => {
    it('observes a veto on an event that is not cancelable, and chains through an enclosing ask', async () => {
        const { askToPrevent } = await import('../src/behaviors/dismiss.js');
        const focus = new FocusEvent('focusin');
        expect(askToPrevent(focus, (e) => {
            e.preventDefault();
            expect(e.defaultPrevented).toBe(true);
        })).toBe(true);
        // Back to the platform's own answer once the ask is over.
        expect(focus.defaultPrevented).toBe(false);
        expect(askToPrevent(new FocusEvent('focusin'), () => {})).toBe(false);

        const key = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
        const outer = askToPrevent(key, (e) => {
            expect(askToPrevent(e, (inner) => inner.preventDefault())).toBe(true);
        });
        expect(outer).toBe(true);
        expect(key.defaultPrevented).toBe(true);
    });
});
