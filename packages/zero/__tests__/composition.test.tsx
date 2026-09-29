/**
 * Composition (#452, #494, #495): a Tooltip lent to a Button, and the
 * trigger hosts that chain — tooltip → menu → button, a menubar trigger
 * lent to a Button, a Dialog.Close lent to a Button.
 *
 * ```tsx
 * <Tooltip.Trigger asChild>
 *     {(p) => <Button.Root lend={p} onClick={archive} aria-label="Archive">…</Button.Root>}
 * </Tooltip.Trigger>
 * ```
 *
 * One element, the Button's: it keeps `button.root` and its paint, while
 * the tooltip trigger it absorbed contributes its hover/focus intent, the
 * `aria-describedby` and the anchor.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { component, signal } from 'sigx';
import { Button, Dialog, Menu, Menubar, Tooltip, buttonAnatomy, menuAnatomy, tooltipAnatomy } from '@sigx/zero';
import type { PositionAnchor, PositionStrategy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

function pointer(type: string, pointerType = 'mouse'): Event {
    return new PointerEvent(type, { pointerType });
}

describe('composition: Tooltip lent to Button', () => {
    let container: HTMLElement;
    beforeEach(() => {
        vi.useFakeTimers();
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        vi.useRealTimers();
        container.remove();
    });

    function mount(opts: {
        loading?: boolean;
        focusableWhenDisabled?: boolean;
        disabled?: boolean;
        onClick?: (e: MouseEvent) => void;
        strategy?: PositionStrategy;
    } = {}) {
        render(
            <Tooltip.Root openDelay={500} positionStrategy={opts.strategy}>
                <Tooltip.Trigger asChild>
                    {(p) => (
                        <Button.Root
                            lend={p}
                            loading={opts.loading}
                            disabled={opts.disabled}
                            focusableWhenDisabled={opts.focusableWhenDisabled}
                            onClick={opts.onClick}
                            aria-label="Archive"
                        >
                            A
                        </Button.Root>
                    )}
                </Tooltip.Trigger>
                <Tooltip.Popup>Archive the thread</Tooltip.Popup>
            </Tooltip.Root>,
            container,
        );
        return {
            el: container.querySelector<HTMLElement>('button')!,
            popup: container.querySelector<HTMLElement>('[data-scope="tooltip"][data-part="popup"]')!,
        };
    }

    it('renders one element with the Button\'s anatomy and none of the trigger\'s', () => {
        const { el } = mount();
        expect(container.querySelectorAll('button')).toHaveLength(1);
        expect(el.getAttribute('data-scope')).toBe('button');
        expect(el.getAttribute('data-part')).toBe('root');
        expect(el.hasAttribute('data-state')).toBe(false);
        expect(container.querySelector('[data-scope="tooltip"][data-part="trigger"]')).toBeNull();
        expectAnatomy(container, buttonAnatomy);
        expectAnatomy(container, tooltipAnatomy);
    });

    it('opens on hover only after openDelay, and joins aria-describedby while open', () => {
        const { el, popup } = mount();
        el.dispatchEvent(pointer('pointerenter'));
        vi.advanceTimersByTime(499);
        expect(popup.getAttribute('data-state')).toBe('closed');
        expect(el.hasAttribute('aria-describedby')).toBe(false);
        vi.advanceTimersByTime(1);
        expect(popup.getAttribute('data-state')).toBe('open');
        expect(el.getAttribute('aria-describedby')?.split(' ')).toContain(popup.id);
        // The trigger's state never lands on the Button.
        expect(el.hasAttribute('data-state')).toBe(false);
        expectAnatomy(container, buttonAnatomy);
        expectAnatomy(container, tooltipAnatomy);
    });

    it('a click fires the Button\'s onClick exactly once', () => {
        const onClick = vi.fn();
        const { el } = mount({ onClick });
        el.click();
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('anchors the popup to the Button element', async () => {
        vi.useRealTimers();
        const anchors: PositionAnchor[] = [];
        const strategy: PositionStrategy = { apply: (anchor) => { anchors.push(anchor); return () => {}; } };
        const { el } = mount({ strategy });
        el.focus();
        await new Promise((r) => setTimeout(r, 0));
        expect(anchors.at(-1)).toBe(el);
    });

    it('a loading Button still shows the tooltip on focus but ignores activation', () => {
        const onClick = vi.fn();
        const { el, popup } = mount({ loading: true, onClick });
        expect(el.getAttribute('aria-disabled')).toBe('true');
        // happy-dom answers `:focus-visible` for anything focused.
        el.focus();
        expect(popup.getAttribute('data-state')).toBe('open');
        el.click();
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(onClick).not.toHaveBeenCalled();
    });

    it('a focusableWhenDisabled Button shows the tooltip on hover and ignores clicks', () => {
        const onClick = vi.fn();
        const { el, popup } = mount({ disabled: true, focusableWhenDisabled: true, onClick });
        expect(el.hasAttribute('disabled')).toBe(false);
        el.dispatchEvent(pointer('pointerenter'));
        vi.advanceTimersByTime(500);
        expect(popup.getAttribute('data-state')).toBe('open');
        el.click();
        expect(onClick).not.toHaveBeenCalled();
    });

    describe('an inert host skips the lender\'s app handlers', () => {
        function mountLender(host: { loading?: boolean; disabled?: boolean; focusableWhenDisabled?: boolean }) {
            const lent = vi.fn();
            const lentKey = vi.fn();
            render(
                <Tooltip.Root>
                    <Tooltip.Trigger asChild onClick={lent} onKeydown={lentKey}>
                        {(p) => (
                            <Button.Root
                                lend={p}
                                loading={host.loading}
                                disabled={host.disabled}
                                focusableWhenDisabled={host.focusableWhenDisabled}
                                aria-label="Archive"
                            >
                                A
                            </Button.Root>
                        )}
                    </Tooltip.Trigger>
                    <Tooltip.Popup>Archive the thread</Tooltip.Popup>
                </Tooltip.Root>,
                container,
            );
            const el = container.querySelector<HTMLElement>('button')!;
            el.click();
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            return { lent, lentKey };
        }

        it('control: a plain Button hands the lender its click and keydown', () => {
            const { lent, lentKey } = mountLender({});
            expect(lent).toHaveBeenCalledTimes(1);
            expect(lentKey).toHaveBeenCalledTimes(1);
        });

        it('a loading Button', () => {
            const { lent, lentKey } = mountLender({ loading: true });
            expect(lent).not.toHaveBeenCalled();
            expect(lentKey).not.toHaveBeenCalled();
        });

        it('a disabled focusableWhenDisabled Button', () => {
            const { lent, lentKey } = mountLender({ disabled: true, focusableWhenDisabled: true });
            expect(lent).not.toHaveBeenCalled();
            expect(lentKey).not.toHaveBeenCalled();
        });
    });

    it('a disabled lender goes quiet: its handlers stop, the host acts', () => {
        const lent = vi.fn();
        const own = vi.fn();
        render(
            <Tooltip.Root>
                <Tooltip.Trigger asChild disabled onClick={lent}>
                    {(p) => <Button.Root lend={p} onClick={own} aria-label="Archive">A</Button.Root>}
                </Tooltip.Trigger>
                <Tooltip.Popup>Archive the thread</Tooltip.Popup>
            </Tooltip.Root>,
            container,
        );
        const el = container.querySelector<HTMLElement>('button')!;
        // The lender's disabled flag is its own anatomy: dropped, not the host's.
        expect(el.hasAttribute('data-disabled')).toBe(false);
        el.click();
        expect(lent).not.toHaveBeenCalled();
        expect(own).toHaveBeenCalledTimes(1);
    });

    it('chains: an outer tooltip lent through an inner one to the Button', () => {
        const model = signal({ outer: false, inner: false });
        const App = component(() => () => (
            <Tooltip.Root model={[model, 'outer']}>
                <Tooltip.Trigger asChild>
                    {(t) => (
                        <Tooltip.Root model={[model, 'inner']}>
                            <Tooltip.Trigger asChild lend={t}>
                                {(p) => <Button.Root lend={p} aria-label="Archive">A</Button.Root>}
                            </Tooltip.Trigger>
                            <Tooltip.Popup>Inner</Tooltip.Popup>
                        </Tooltip.Root>
                    )}
                </Tooltip.Trigger>
                <Tooltip.Popup>Outer</Tooltip.Popup>
            </Tooltip.Root>
        ));
        render(<App />, container);
        const el = container.querySelector<HTMLElement>('button')!;
        expect(el.getAttribute('data-scope')).toBe('button');
        el.focus();
        expect(model.outer).toBe(true);
        expect(model.inner).toBe(true);
        const idOf = (text: string) => [...container.querySelectorAll('[role="tooltip"]')].find((p) => p.textContent === text)!.id;
        // Lender tokens first: the outer tooltip's, then the inner one's.
        expect(el.getAttribute('aria-describedby')?.split(' ')).toEqual([idOf('Outer'), idOf('Inner')]);
    });
});

// happy-dom has no popover API, and a menu popup only moves focus once it
// has shown itself — stub the three members the popups touch (see Menu.test).
type PopoverProto = { showPopover?: () => void; hidePopover?: () => void };
const proto = HTMLElement.prototype as PopoverProto;
const savedPopover = { show: proto.showPopover, hide: proto.hidePopover, matches: Element.prototype.matches };
function stubPopover(): void {
    proto.showPopover = function (this: HTMLElement) { this.setAttribute('data-test-popover-open', ''); };
    proto.hidePopover = function (this: HTMLElement) { this.removeAttribute('data-test-popover-open'); };
    (Element.prototype as { matches(sel: string): boolean }).matches = function (this: Element, sel: string) {
        return sel === ':popover-open' ? this.hasAttribute('data-test-popover-open') : savedPopover.matches.call(this, sel);
    };
}
function restorePopover(): void {
    if (savedPopover.show) proto.showPopover = savedPopover.show; else delete proto.showPopover;
    if (savedPopover.hide) proto.hidePopover = savedPopover.hide; else delete proto.hidePopover;
    Element.prototype.matches = savedPopover.matches;
}

const keydown = (el: Element, key: string): void => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
};

describe('composition: Tooltip lent to Menu.Trigger (#495)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        vi.useFakeTimers();
        stubPopover();
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        render(null, container);
        vi.useRealTimers();
        restorePopover();
        container.remove();
    });

    /** `host: 'button'` lends the menu trigger on to a Button.Root; `'menu'` renders it itself. */
    function mount(host: 'button' | 'menu') {
        const state = signal({ menu: false, tooltip: false });
        const refs = { tooltip: [] as unknown[], button: [] as unknown[] };
        const App = component(() => () => (
            <Menu.Root model={[state, 'menu']}>
                <Tooltip.Root openDelay={500} model={[state, 'tooltip']}>
                    <Tooltip.Trigger asChild>
                        {(t) => {
                            // A spy ref riding with the tooltip's bag: the
                            // lender's refs must reach the rendered element.
                            const lent = { ...t, ref: (el: unknown) => { (t.ref as (el: unknown) => void)?.(el); refs.tooltip.push(el); } };
                            return host === 'button'
                                ? (
                                    <Menu.Trigger asChild lend={lent}>
                                        {(m) => (
                                            <Button.Root lend={m} aria-label="More actions" aria-describedby="hint">
                                                …
                                            </Button.Root>
                                        )}
                                    </Menu.Trigger>
                                )
                                : <Menu.Trigger lend={lent} aria-label="More actions" aria-describedby="hint">…</Menu.Trigger>;
                        }}
                    </Tooltip.Trigger>
                    <Tooltip.Popup>More actions</Tooltip.Popup>
                </Tooltip.Root>
                <Menu.Popup>
                    <Menu.Item value="archive">Archive</Menu.Item>
                    <Menu.Item value="delete">Delete</Menu.Item>
                </Menu.Popup>
            </Menu.Root>
        ));
        render(<App />, container);
        const el = container.querySelector<HTMLElement>('button')!;
        return {
            state,
            refs,
            el,
            tooltipPopup: container.querySelector<HTMLElement>('[data-scope="tooltip"][data-part="popup"]')!,
            menuPopup: container.querySelector<HTMLElement>('[data-scope="menu"][data-part="popup"]')!,
        };
    }

    for (const host of ['button', 'menu'] as const) {
        describe(host === 'button' ? 'lent on to a Button.Root' : 'the Menu.Trigger renders itself', () => {
            it(`renders one element with ${host}'s anatomy and none of the lenders'`, () => {
                const { el, refs } = mount(host);
                expect(container.querySelectorAll('button')).toHaveLength(1);
                expect(el.getAttribute('data-scope')).toBe(host);
                expect(el.getAttribute('data-part')).toBe(host === 'button' ? 'root' : 'trigger');
                expect(container.querySelector('[data-scope="tooltip"][data-part="trigger"]')).toBeNull();
                if (host === 'button') expect(container.querySelector('[data-scope="menu"][data-part="trigger"]')).toBeNull();
                // The menu button's ARIA survives the hops.
                expect(el.getAttribute('aria-haspopup')).toBe('menu');
                expect(el.getAttribute('aria-expanded')).toBe('false');
                expect(el.getAttribute('aria-controls')).toBe(container.querySelector('[data-scope="menu"][data-part="popup"]')!.id);
                // Both lenders' refs got the element.
                expect(refs.tooltip).toContain(el);
                expectAnatomy(container, tooltipAnatomy);
                expectAnatomy(container, menuAnatomy);
                if (host === 'button') expectAnatomy(container, buttonAnatomy);
            });

            it('hover opens the tooltip, whose id joins aria-describedby', () => {
                const { el, state, tooltipPopup } = mount(host);
                el.dispatchEvent(pointer('pointerenter'));
                vi.advanceTimersByTime(500);
                expect(state.tooltip).toBe(true);
                expect(el.getAttribute('aria-describedby')?.split(' ')).toEqual([tooltipPopup.id, 'hint']);
                expect(state.menu).toBe(false);
            });

            it('a click opens the menu and dismisses the tooltip', () => {
                const { el, state } = mount(host);
                el.dispatchEvent(pointer('pointerenter'));
                vi.advanceTimersByTime(500);
                expect(state.tooltip).toBe(true);
                el.dispatchEvent(pointer('pointerdown'));
                el.click();
                expect(state.menu).toBe(true);
                expect(state.tooltip).toBe(false);
                expect(el.getAttribute('aria-expanded')).toBe('true');
                el.click();
                expect(state.menu).toBe(false);
            });

            it('ArrowDown opens the menu', () => {
                const { el, state } = mount(host);
                keydown(el, 'ArrowDown');
                expect(state.menu).toBe(true);
            });
        });
    }

    it('anchors both popups to the one element', async () => {
        vi.useRealTimers();
        const anchors: { menu: PositionAnchor[]; tooltip: PositionAnchor[] } = { menu: [], tooltip: [] };
        const spy = (into: PositionAnchor[]): PositionStrategy => ({ apply: (anchor) => { into.push(anchor); return () => {}; } });
        render(
            <Menu.Root positionStrategy={spy(anchors.menu)}>
                <Tooltip.Root positionStrategy={spy(anchors.tooltip)}>
                    <Tooltip.Trigger asChild>
                        {(t) => (
                            <Menu.Trigger asChild lend={t}>
                                {(m) => <Button.Root lend={m} aria-label="More actions">…</Button.Root>}
                            </Menu.Trigger>
                        )}
                    </Tooltip.Trigger>
                    <Tooltip.Popup>More actions</Tooltip.Popup>
                </Tooltip.Root>
                <Menu.Popup><Menu.Item value="a">A</Menu.Item></Menu.Popup>
            </Menu.Root>,
            container,
        );
        const el = container.querySelector<HTMLElement>('button')!;
        el.focus();
        await new Promise((r) => setTimeout(r, 0));
        expect(anchors.tooltip.at(-1)).toBe(el);
        keydown(el, 'ArrowDown');
        await new Promise((r) => setTimeout(r, 0));
        expect(anchors.menu.at(-1)).toBe(el);
    });
});

describe('composition: a Menubar trigger lent to Button.Root (#495)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        stubPopover();
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        render(null, container);
        restorePopover();
        container.remove();
    });

    it('keeps role="menuitem" and the roving tabIndex', async () => {
        render(
            <Menubar.Root aria-label="Editor">
                <Menu.Root value="file">
                    <Menu.Trigger asChild>{(m) => <Button.Root lend={m}>File</Button.Root>}</Menu.Trigger>
                    <Menu.Popup><Menu.Item value="new">New</Menu.Item></Menu.Popup>
                </Menu.Root>
                <Menu.Root value="edit">
                    <Menu.Trigger asChild>{(m) => <Button.Root lend={m}>Edit</Button.Root>}</Menu.Trigger>
                    <Menu.Popup><Menu.Item value="undo">Undo</Menu.Item></Menu.Popup>
                </Menu.Root>
            </Menubar.Root>,
            container,
        );
        await new Promise((r) => setTimeout(r, 0));
        const [file, edit] = [...container.querySelectorAll<HTMLElement>('button')];
        for (const el of [file, edit]) {
            expect(el.getAttribute('data-scope')).toBe('button');
            expect(el.getAttribute('role')).toBe('menuitem');
        }
        expect([file.tabIndex, edit.tabIndex]).toEqual([0, -1]);
        file.focus();
        keydown(file, 'ArrowRight');
        await new Promise((r) => setTimeout(r, 0));
        expect(document.activeElement).toBe(edit);
        expect([file.tabIndex, edit.tabIndex]).toEqual([-1, 0]);
        expectAnatomy(container, buttonAnatomy);
    });
});

describe('composition: Dialog.Close lent to Button.Root (#495)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        render(null, container);
        container.remove();
    });

    function mount(opts: { loading?: boolean; veto?: boolean; onSave?: () => void } = {}) {
        const state = signal({ open: true });
        const closes: unknown[] = [];
        render(
            <Dialog.Root model={[state, 'open']} onClose={(d) => closes.push(d)}>
                <Dialog.Popup>
                    <Dialog.Title>Edit</Dialog.Title>
                    <Dialog.Close
                        asChild
                        value="save"
                        onClick={(e: MouseEvent) => { if (opts.veto) e.preventDefault(); }}
                    >
                        {(p) => <Button.Root lend={p} loading={opts.loading} onClick={opts.onSave}>Save and close</Button.Root>}
                    </Dialog.Close>
                </Dialog.Popup>
            </Dialog.Root>,
            container,
        );
        const el = [...container.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent === 'Save and close')!;
        return { state, closes, el };
    }

    it('a click closes, with the Close\'s value, and still reaches the Button', () => {
        const onSave = vi.fn();
        const { state, closes, el } = mount({ onSave });
        expect(el.getAttribute('data-scope')).toBe('button');
        expect(container.querySelector('[data-scope="dialog"][data-part="close"]')).toBeNull();
        el.click();
        expect(state.open).toBe(false);
        expect(closes).toEqual([{ reason: 'close', value: 'save' }]);
        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('a loading Button does not close', () => {
        const { state, el } = mount({ loading: true });
        el.click();
        expect(state.open).toBe(true);
    });

    it('a veto in Dialog.Close\'s onClick keeps it open', () => {
        const { state, el } = mount({ veto: true });
        el.click();
        expect(state.open).toBe(true);
    });
});

describe('composition: conflicts throw (#495)', () => {
    it('an id on the host that differs from the lender\'s', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        try {
            expect(() => render(
                <Menu.Root>
                    <Menu.Trigger asChild>{(m) => <Button.Root lend={m} id="mine">More</Button.Root>}</Menu.Trigger>
                    <Menu.Popup><Menu.Item value="a">A</Menu.Item></Menu.Popup>
                </Menu.Root>,
                container,
            )).toThrow(/id: the host says "mine", the lent menu\.trigger/);
        } finally {
            container.remove();
        }
    });
});
