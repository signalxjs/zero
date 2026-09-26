import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Menu, Menubar, menuAnatomy, menubarAnatomy } from '@sigx/zero';
import type { Orientation } from '@sigx/zero';
import { expectAnatomy } from './helpers';

/** watch()-driven cascades settle a task after the write. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const key = (el: Element, k: string, init: KeyboardEventInit = {}): void => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
};

// happy-dom has no popover API, and a popup only moves focus once it has
// shown itself — stub the three members the popups touch (see Menu.test).
type PopoverProto = { showPopover?: () => void; hidePopover?: () => void };
const proto = HTMLElement.prototype as PopoverProto;
const saved = { show: proto.showPopover, hide: proto.hidePopover, matches: Element.prototype.matches };
function stubPopover(): void {
    proto.showPopover = function (this: HTMLElement) { this.setAttribute('data-test-popover-open', ''); };
    proto.hidePopover = function (this: HTMLElement) { this.removeAttribute('data-test-popover-open'); };
    (Element.prototype as { matches(sel: string): boolean }).matches = function (this: Element, sel: string) {
        return sel === ':popover-open' ? this.hasAttribute('data-test-popover-open') : saved.matches.call(this, sel);
    };
}
function restorePopover(): void {
    // Delete rather than assign when happy-dom had no member, so no own
    // `undefined` property outlives the file.
    if (saved.show) proto.showPopover = saved.show; else delete proto.showPopover;
    if (saved.hide) proto.hidePopover = saved.hide; else delete proto.hidePopover;
    Element.prototype.matches = saved.matches;
}

describe('Menubar', () => {
    let container: HTMLElement;
    beforeEach(() => {
        stubPopover();
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        render(null, container);
        container.remove();
        restorePopover();
    });

    let bar = signal({ value: '' });

    function mount(opts: { orientation?: Orientation; loop?: boolean; disabled?: boolean; editDisabled?: boolean } = {}) {
        bar = signal({ value: '' });
        const selected: string[] = [];
        render(
            <Menubar.Root
                aria-label="Editor"
                model={[bar, 'value']}
                orientation={opts.orientation}
                loop={opts.loop}
                disabled={opts.disabled}
            >
                <Menu.Root value="file" onSelect={(v) => selected.push(v)}>
                    <Menu.Trigger>File</Menu.Trigger>
                    <Menu.Popup>
                        <Menu.Item value="new" keyshortcuts="Control+N">
                            New <Menu.Shortcut>Ctrl+N</Menu.Shortcut>
                        </Menu.Item>
                        <Menu.Sub>
                            <Menu.SubTrigger>Recent</Menu.SubTrigger>
                            <Menu.SubPopup>
                                <Menu.Item value="a.txt">a.txt</Menu.Item>
                            </Menu.SubPopup>
                        </Menu.Sub>
                        <Menu.Item value="close">Close</Menu.Item>
                    </Menu.Popup>
                </Menu.Root>
                <Menu.Root value="edit">
                    <Menu.Trigger disabled={opts.editDisabled}>Edit</Menu.Trigger>
                    <Menu.Popup>
                        <Menu.Item value="undo">Undo</Menu.Item>
                        <Menu.CheckboxItem value="wrap" keyshortcuts="Alt+Z">Wrap</Menu.CheckboxItem>
                    </Menu.Popup>
                </Menu.Root>
                <Menu.Root value="view">
                    <Menu.Trigger>View</Menu.Trigger>
                    <Menu.Popup>
                        <Menu.RadioGroup defaultValue="list">
                            <Menu.RadioItem value="list" keyshortcuts="Control+1">List</Menu.RadioItem>
                        </Menu.RadioGroup>
                        <Menu.Item value="zoom">Zoom</Menu.Item>
                    </Menu.Popup>
                </Menu.Root>
            </Menubar.Root>,
            container,
        );
        const triggers = Array.from(container.querySelectorAll<HTMLElement>('[data-scope="menu"][data-part="trigger"]'));
        const popups = Array.from(container.querySelectorAll<HTMLElement>('[data-scope="menu"][data-part="popup"]'));
        return { triggers, popups, selected };
    }

    const items = (popup: HTMLElement): HTMLElement[] =>
        Array.from(popup.querySelectorAll<HTMLElement>(':scope > [role^="menuitem"], :scope > [role="group"] > [role^="menuitem"]'));

    it('renders the menubar root and holds both anatomies', async () => {
        mount();
        await tick();
        const root = container.querySelector<HTMLElement>('[data-scope="menubar"][data-part="root"]')!;
        expect(root.getAttribute('role')).toBe('menubar');
        expect(root.getAttribute('aria-orientation')).toBe('horizontal');
        expect(root.getAttribute('data-orientation')).toBe('horizontal');
        expect(root.getAttribute('aria-label')).toBe('Editor');
        expectAnatomy(container, menubarAnatomy);
        expectAnatomy(container, menuAnatomy);
    });

    it('makes each trigger a menuitem, with ONE tab stop that follows focus', async () => {
        const { triggers } = mount();
        await tick();
        for (const t of triggers) {
            expect(t.getAttribute('role')).toBe('menuitem');
            expect(t.getAttribute('aria-haspopup')).toBe('menu');
            expect(t.getAttribute('aria-expanded')).toBe('false');
        }
        expect(triggers.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
        triggers[0]!.focus();
        key(triggers[0]!, 'ArrowRight');
        await tick();
        expect(document.activeElement).toBe(triggers[1]);
        expect(triggers.map((t) => t.tabIndex)).toEqual([-1, 0, -1]);
    });

    it('roves the triggers with ArrowLeft/ArrowRight, Home/End, and wraps', async () => {
        const { triggers } = mount();
        await tick();
        triggers[0]!.focus();
        key(triggers[0]!, 'ArrowLeft');
        expect(document.activeElement).toBe(triggers[2]);
        key(triggers[2]!, 'ArrowRight');
        expect(document.activeElement).toBe(triggers[0]);
        key(triggers[0]!, 'End');
        expect(document.activeElement).toBe(triggers[2]);
        key(triggers[2]!, 'Home');
        expect(document.activeElement).toBe(triggers[0]);
        // Roving never opens a menu.
        expect(bar.value).toBe('');
    });

    it('stops at the ends with loop={false}, and skips a disabled trigger', async () => {
        const { triggers } = mount({ loop: false, editDisabled: true });
        await tick();
        triggers[0]!.focus();
        key(triggers[0]!, 'ArrowLeft');
        expect(document.activeElement).toBe(triggers[0]);
        key(triggers[0]!, 'ArrowRight');
        expect(document.activeElement).toBe(triggers[2]);
        expect(triggers[1]!.hasAttribute('data-disabled')).toBe(true);
    });

    it('flips the horizontal arrows under RTL', async () => {
        container.setAttribute('dir', 'rtl');
        container.style.direction = 'rtl';
        const { triggers, popups } = mount();
        await tick();
        triggers[0]!.focus();
        key(triggers[0]!, 'ArrowLeft');
        expect(document.activeElement).toBe(triggers[1]);
        key(triggers[1]!, 'ArrowRight');
        expect(document.activeElement).toBe(triggers[0]);
        // Inside an open menu too: ArrowLeft is the reading-end arrow.
        key(triggers[0]!, 'ArrowDown');
        await tick();
        key(document.activeElement!, 'ArrowLeft');
        await tick();
        expect(bar.value).toBe('edit');
        expect(document.activeElement).toBe(items(popups[1]!)[0]);
    });

    it('moves with Up/Down when vertical, and opens with the inline-end arrow', async () => {
        const { triggers, popups } = mount({ orientation: 'vertical' });
        await tick();
        const root = container.querySelector('[data-scope="menubar"]')!;
        expect(root.getAttribute('aria-orientation')).toBe('vertical');
        triggers[0]!.focus();
        key(triggers[0]!, 'ArrowDown');
        expect(document.activeElement).toBe(triggers[1]);
        expect(bar.value).toBe('');
        key(triggers[1]!, 'ArrowRight');
        await tick();
        expect(bar.value).toBe('edit');
        expect(document.activeElement).toBe(items(popups[1]!)[0]);
        // The inline-start arrow from a top-level item closes back to the trigger.
        key(document.activeElement!, 'ArrowLeft');
        await tick();
        expect(bar.value).toBe('');
        expect(document.activeElement).toBe(triggers[1]);
    });

    it('opens on ArrowDown at the first item and on ArrowUp at the last', async () => {
        const { triggers, popups } = mount();
        await tick();
        triggers[0]!.focus();
        key(triggers[0]!, 'ArrowDown');
        await tick();
        expect(bar.value).toBe('file');
        expect(triggers[0]!.getAttribute('aria-expanded')).toBe('true');
        expect(popups[0]!.getAttribute('data-state')).toBe('open');
        expect(document.activeElement).toBe(items(popups[0]!)[0]);

        bar.value = '';
        await tick();
        triggers[2]!.focus();
        key(triggers[2]!, 'ArrowUp');
        await tick();
        expect(bar.value).toBe('view');
        const viewItems = items(popups[2]!);
        expect(document.activeElement).toBe(viewItems[viewItems.length - 1]);
    });

    it('follows a controlled value: one menu open at a time', async () => {
        const { popups } = mount();
        bar.value = 'edit';
        await tick();
        expect(popups.map((p) => p.getAttribute('data-state'))).toEqual(['closed', 'open', 'closed']);
        bar.value = 'view';
        await tick();
        expect(popups.map((p) => p.getAttribute('data-state'))).toEqual(['closed', 'closed', 'open']);
    });

    it('ArrowRight from an item opens the adjacent menu on its first item; ArrowLeft steps back', async () => {
        const { triggers, popups } = mount();
        await tick();
        triggers[0]!.focus();
        key(triggers[0]!, 'ArrowDown');
        await tick();
        key(document.activeElement!, 'ArrowRight');
        await tick();
        expect(bar.value).toBe('edit');
        expect(popups[0]!.getAttribute('data-state')).toBe('closed');
        expect(document.activeElement).toBe(items(popups[1]!)[0]);
        key(document.activeElement!, 'ArrowLeft');
        await tick();
        expect(bar.value).toBe('file');
        expect(document.activeElement).toBe(items(popups[0]!)[0]);
        // Wraps from the first menu back to the last.
        key(document.activeElement!, 'ArrowLeft');
        await tick();
        expect(bar.value).toBe('view');
    });

    it('ArrowRight on a sub-trigger opens its submenu instead; ArrowRight inside it moves on', async () => {
        const { triggers, popups } = mount();
        await tick();
        triggers[0]!.focus();
        key(triggers[0]!, 'ArrowDown');
        await tick();
        const subTrigger = popups[0]!.querySelector<HTMLElement>('[data-part="sub-trigger"]')!;
        subTrigger.focus();
        key(subTrigger, 'ArrowRight');
        await tick();
        expect(bar.value).toBe('file');
        const subPopup = popups[0]!.querySelector<HTMLElement>('[data-part="sub-popup"]')!;
        expect(subPopup.getAttribute('data-state')).toBe('open');
        const subItem = subPopup.querySelector<HTMLElement>('[role="menuitem"]')!;
        expect(document.activeElement).toBe(subItem);
        // From an item that opens nothing, ArrowRight closes the chain and
        // opens the next menu.
        key(subItem, 'ArrowRight');
        await tick();
        expect(bar.value).toBe('edit');
        expect(subPopup.getAttribute('data-state')).toBe('closed');
        expect(document.activeElement).toBe(items(popups[1]!)[0]);
    });

    it('ArrowLeft on a top-level sub-trigger steps to the previous menu', async () => {
        const { triggers, popups } = mount();
        await tick();
        triggers[0]!.focus();
        key(triggers[0]!, 'ArrowDown');
        await tick();
        const subTrigger = popups[0]!.querySelector<HTMLElement>('[data-part="sub-trigger"]')!;
        subTrigger.focus();
        key(subTrigger, 'ArrowLeft');
        await tick();
        expect(bar.value).toBe('view');
    });

    it('hovering another trigger while a menu is open switches to it; while none is, nothing opens', async () => {
        const { triggers, popups } = mount();
        await tick();
        triggers[1]!.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
        await tick();
        expect(bar.value).toBe('');

        bar.value = 'file';
        await tick();
        triggers[1]!.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
        await tick();
        expect(bar.value).toBe('edit');
        expect(popups[1]!.getAttribute('data-state')).toBe('open');
        expect(popups[0]!.getAttribute('data-state')).toBe('closed');
    });

    it('a click toggles: open on a closed trigger, closed on the open one — but a hover-switched menu stays open', async () => {
        const { triggers } = mount();
        await tick();
        const press = (el: HTMLElement): void => {
            el.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
            el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
            el.click();
        };
        press(triggers[0]!);
        await tick();
        expect(bar.value).toBe('file');
        press(triggers[0]!);
        await tick();
        expect(bar.value).toBe('');

        press(triggers[0]!);
        await tick();
        triggers[1]!.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
        await tick();
        expect(bar.value).toBe('edit');
        press(triggers[1]!);
        await tick();
        expect(bar.value).toBe('edit');
    });

    it('selecting an item closes the bar and returns focus to that menu\'s trigger', async () => {
        const { triggers, selected } = mount();
        await tick();
        triggers[0]!.focus();
        key(triggers[0]!, 'ArrowDown');
        await tick();
        key(document.activeElement!, 'ArrowRight');
        await tick();
        key(document.activeElement!, 'Enter');
        await tick();
        expect(bar.value).toBe('');
        expect(document.activeElement).toBe(triggers[1]);
        expect(selected).toEqual([]);
    });

    it('Tab from an open menu closes it without pulling focus back', async () => {
        const { triggers } = mount();
        await tick();
        triggers[0]!.focus();
        key(triggers[0]!, 'ArrowDown');
        await tick();
        key(document.activeElement!, 'Tab');
        await tick();
        expect(bar.value).toBe('');
    });

    it('a disabled bar disables every trigger and flags its root', async () => {
        const { triggers } = mount({ disabled: true });
        await tick();
        const root = container.querySelector('[data-scope="menubar"]')!;
        expect(root.hasAttribute('data-disabled')).toBe(true);
        expect(root.getAttribute('aria-disabled')).toBe('true');
        for (const t of triggers) {
            expect(t.hasAttribute('data-disabled')).toBe(true);
            expect((t as HTMLButtonElement).disabled).toBe(true);
        }
        triggers[0]!.click();
        await tick();
        expect(bar.value).toBe('');
    });

    it('emits valueChange and each menu\'s openChange', async () => {
        const changes: string[] = [];
        const opens: boolean[] = [];
        render(
            <Menubar.Root onValueChange={(v) => changes.push(v)}>
                <Menu.Root value="a" onOpenChange={(o) => opens.push(o)}>
                    <Menu.Trigger>A</Menu.Trigger>
                    <Menu.Popup><Menu.Item value="x">X</Menu.Item></Menu.Popup>
                </Menu.Root>
            </Menubar.Root>,
            container,
        );
        await tick();
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.click();
        await tick();
        trigger.click();
        await tick();
        expect(changes).toEqual(['a', '']);
        expect(opens).toEqual([true, false]);
    });

    it('a menu with no value gets a generated identity', async () => {
        render(
            <Menubar.Root defaultValue="">
                <Menu.Root>
                    <Menu.Trigger>A</Menu.Trigger>
                    <Menu.Popup><Menu.Item value="x">X</Menu.Item></Menu.Popup>
                </Menu.Root>
                <Menu.Root>
                    <Menu.Trigger>B</Menu.Trigger>
                    <Menu.Popup><Menu.Item value="y">Y</Menu.Item></Menu.Popup>
                </Menu.Root>
            </Menubar.Root>,
            container,
        );
        await tick();
        const [a, b] = Array.from(container.querySelectorAll<HTMLElement>('[data-part="trigger"]'));
        a!.click();
        await tick();
        const popups = Array.from(container.querySelectorAll<HTMLElement>('[data-part="popup"]'));
        expect(popups.map((p) => p.getAttribute('data-state'))).toEqual(['open', 'closed']);
        b!.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
        await tick();
        expect(popups.map((p) => p.getAttribute('data-state'))).toEqual(['closed', 'open']);
    });

    it('a Menu.Root nested inside a bar menu is an ordinary menu button', async () => {
        render(
            <Menubar.Root>
                <Menu.Root value="a" defaultOpen>
                    <Menu.Trigger>A</Menu.Trigger>
                    <Menu.Popup>
                        <Menu.Item value="x">X</Menu.Item>
                        <Menu.Root>
                            <Menu.Trigger class="inner">Inner</Menu.Trigger>
                            <Menu.Popup><Menu.Item value="y">Y</Menu.Item></Menu.Popup>
                        </Menu.Root>
                    </Menu.Popup>
                </Menu.Root>
            </Menubar.Root>,
            container,
        );
        await tick();
        const inner = container.querySelector<HTMLElement>('.inner')!;
        expect(inner.hasAttribute('role')).toBe(false);
        expect(inner.hasAttribute('tabindex')).toBe(false);
    });

    it('outside a bar, the trigger stays a plain menu button', async () => {
        render(
            <Menu.Root>
                <Menu.Trigger>A</Menu.Trigger>
                <Menu.Popup><Menu.Item value="x">X</Menu.Item></Menu.Popup>
            </Menu.Root>,
            container,
        );
        await tick();
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        expect(trigger.hasAttribute('role')).toBe(false);
        expect(trigger.hasAttribute('tabindex')).toBe(false);
    });
});

describe('Menu.Shortcut and keyshortcuts', () => {
    it('renders aria-keyshortcuts on every item kind and hides the visible hint from AT', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        render(
            <Menu.Root defaultOpen>
                <Menu.Trigger>Actions</Menu.Trigger>
                <Menu.Popup>
                    <Menu.Item value="save" keyshortcuts="Control+S">Save <Menu.Shortcut>Ctrl+S</Menu.Shortcut></Menu.Item>
                    <Menu.CheckboxItem value="wrap" keyshortcuts="Alt+Z">Wrap</Menu.CheckboxItem>
                    <Menu.RadioGroup defaultValue="a">
                        <Menu.RadioItem value="a" keyshortcuts="Control+1">A</Menu.RadioItem>
                    </Menu.RadioGroup>
                    <Menu.Item value="plain">Plain</Menu.Item>
                </Menu.Popup>
            </Menu.Root>,
            container,
        );
        await tick();
        const shortcut = container.querySelector<HTMLElement>('[data-scope="menu"][data-part="shortcut"]')!;
        expect(shortcut.tagName).toBe('SPAN');
        expect(shortcut.getAttribute('aria-hidden')).toBe('true');
        expect(shortcut.textContent).toBe('Ctrl+S');
        const byValue = (part: string) => container.querySelector<HTMLElement>(`[data-part="${part}"]`)!;
        expect(byValue('item').getAttribute('aria-keyshortcuts')).toBe('Control+S');
        expect(byValue('checkbox-item').getAttribute('aria-keyshortcuts')).toBe('Alt+Z');
        expect(byValue('radio-item').getAttribute('aria-keyshortcuts')).toBe('Control+1');
        const plain = container.querySelectorAll<HTMLElement>('[data-part="item"]')[1]!;
        expect(plain.hasAttribute('aria-keyshortcuts')).toBe(false);
        expectAnatomy(container, menuAnatomy);
        container.remove();
    });
});
