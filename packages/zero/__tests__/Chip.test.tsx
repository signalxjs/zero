/**
 * Chip and ChipGroup (#544): the three behaviours a chip is some mix of —
 * action, selection, removal — standalone and inside a group with one roving
 * tab stop and an optional value model.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Chip, ChipGroup, chipAnatomy, chipGroupAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

let container: HTMLElement;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});
afterEach(() => {
    render(null, container);
    container.remove();
});

const actions = () => [...container.querySelectorAll<HTMLElement>('[data-scope="chip"][data-part="action"]')];
const roots = () => [...container.querySelectorAll<HTMLElement>('[data-scope="chip"][data-part="root"]')];
const key = (el: HTMLElement, k: string) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

describe('Chip', () => {
    it('renders a valid anatomy, the remove button included', () => {
        render(
            <Chip.Root removable>
                <Chip.Action><Chip.Icon>★</Chip.Icon><Chip.Label>Ada</Chip.Label></Chip.Action>
                <Chip.Remove />
            </Chip.Root>,
            container,
        );
        expectAnatomy(container, chipAnatomy);
        // The icon is decorative: the label alone names the chip.
        expect(container.querySelector('[data-part="icon"]')!.getAttribute('aria-hidden')).toBe('true');
    });

    it('an action chip is a plain button: no pressed state, no data-state', () => {
        const onClick = vi.fn();
        render(<Chip.Root><Chip.Action onClick={onClick}>Share</Chip.Action></Chip.Root>, container);
        const [action] = actions();
        expect(action!.tagName).toBe('BUTTON');
        expect(action!.hasAttribute('aria-pressed')).toBe(false);
        expect(roots()[0]!.hasAttribute('data-state')).toBe(false);
        action!.click();
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('a selectable chip is a toggle, and binds its own model', () => {
        const state = signal({ on: false });
        render(<Chip.Root selectable model={() => state.on}><Chip.Action>Unread</Chip.Action></Chip.Root>, container);
        const [action] = actions();
        expect(action!.getAttribute('aria-pressed')).toBe('false');
        expect(roots()[0]!.getAttribute('data-state')).toBe('off');
        action!.click();
        expect(state.on).toBe(true);
        expect(action!.getAttribute('aria-pressed')).toBe('true');
        expect(roots()[0]!.getAttribute('data-state')).toBe('on');
        expect(roots()[0]!.hasAttribute('data-selected')).toBe(true);
    });

    it('a removable chip emits remove from its button and from Backspace/Delete on the action', () => {
        const onRemove = vi.fn();
        render(
            <Chip.Root removable onRemove={onRemove}>
                <Chip.Action>Ada Lovelace</Chip.Action>
                <Chip.Remove />
            </Chip.Root>,
            container,
        );
        const remove = container.querySelector<HTMLButtonElement>('[data-part="remove"]')!;
        expect(remove.getAttribute('aria-label')).toBe('Remove Ada Lovelace');
        expect(remove.tabIndex).toBe(-1);
        expect(actions()[0]!.getAttribute('aria-keyshortcuts')).toBe('Backspace Delete');
        remove.click();
        key(actions()[0]!, 'Backspace');
        key(actions()[0]!, 'Delete');
        expect(onRemove).toHaveBeenCalledTimes(3);
    });

    it('an asChild link keeps its link role unless the chip toggles', async () => {
        render(
            <>
                <Chip.Root><Chip.Action asChild>{(p: Record<string, unknown>) => <a href="#docs" {...p}>Docs</a>}</Chip.Action></Chip.Root>
                <Chip.Root selectable><Chip.Action asChild>{(p: Record<string, unknown>) => <a href="#pin" {...p}>Pin</a>}</Chip.Action></Chip.Root>
                <Chip.Root><Chip.Action asChild>{(p: Record<string, unknown>) => <span {...p}>Span</span>}</Chip.Action></Chip.Root>
            </>,
            container,
        );
        await Promise.resolve();
        const [docs, pin, span] = actions();
        expect(docs!.tagName).toBe('A');
        expect(docs!.hasAttribute('role')).toBe(false);
        expect(pin!.getAttribute('role')).toBe('button');
        expect(pin!.getAttribute('aria-pressed')).toBe('false');
        expect(span!.getAttribute('role')).toBe('button');
        expect(span!.tabIndex).toBe(0);
    });

    it('Backspace does nothing on a chip that is not removable', () => {
        const onRemove = vi.fn();
        render(<Chip.Root onRemove={onRemove}><Chip.Action>Ada</Chip.Action></Chip.Root>, container);
        key(actions()[0]!, 'Backspace');
        expect(onRemove).not.toHaveBeenCalled();
    });

    it('a disabled chip neither toggles nor removes', () => {
        const onRemove = vi.fn();
        render(
            <Chip.Root selectable removable disabled onRemove={onRemove}>
                <Chip.Action>Ada</Chip.Action>
                <Chip.Remove />
            </Chip.Root>,
            container,
        );
        const [action] = actions();
        expect((action as HTMLButtonElement).disabled).toBe(true);
        expect(roots()[0]!.hasAttribute('data-disabled')).toBe(true);
        action!.click();
        key(action!, 'Delete');
        expect(action!.getAttribute('aria-pressed')).toBe('false');
        expect(onRemove).not.toHaveBeenCalled();
    });
});

describe('ChipGroup', () => {
    const three = (props: Record<string, unknown> = {}) => (
        <ChipGroup.Root label="Filters" {...props}>
            <Chip.Root value="open"><Chip.Action>Open</Chip.Action></Chip.Root>
            <Chip.Root value="mine"><Chip.Action>Mine</Chip.Action></Chip.Root>
            <Chip.Root value="old" disabled><Chip.Action>Old</Chip.Action></Chip.Root>
            <Chip.Root value="bugs"><Chip.Action>Bugs</Chip.Action></Chip.Root>
        </ChipGroup.Root>
    );

    it('renders a valid anatomy: a named group', () => {
        render(three(), container);
        expectAnatomy(container, chipGroupAnatomy);
        const root = container.querySelector('[data-scope="chip-group"]')!;
        expect(root.getAttribute('role')).toBe('group');
        expect(root.getAttribute('aria-label')).toBe('Filters');
    });

    it('holds one tab stop, and the arrows rove it past a disabled chip, wrapping', () => {
        render(three(), container);
        const [open, mine, old, bugs] = actions();
        expect(actions().map((a) => a.tabIndex)).toEqual([0, -1, -1, -1]);
        open!.focus();
        key(open!, 'ArrowRight');
        expect(document.activeElement).toBe(mine);
        key(mine!, 'ArrowRight');
        expect(document.activeElement).toBe(bugs);
        expect(old!.tabIndex).toBe(-1);
        key(bugs!, 'ArrowRight');
        expect(document.activeElement).toBe(open);
    });

    it('an unselectable group makes no chip a toggle', () => {
        render(three(), container);
        expect(actions().some((a) => a.hasAttribute('aria-pressed'))).toBe(false);
    });

    it('selectable multiple toggles values into a string[]', () => {
        const state = signal({ value: [] as string[] });
        render(three({ selectable: true, multiple: true, model: () => state.value }), container);
        const [open, mine] = actions();
        open!.click();
        mine!.click();
        expect(state.value).toEqual(['open', 'mine']);
        open!.click();
        expect(state.value).toEqual(['mine']);
        expect(mine!.getAttribute('aria-pressed')).toBe('true');
    });

    it('selectable single holds one string, and pressing it again clears it', () => {
        const state = signal({ value: '' });
        render(three({ selectable: true, model: () => state.value }), container);
        const [open, mine] = actions();
        open!.click();
        expect(state.value).toBe('open');
        mine!.click();
        expect(state.value).toBe('mine');
        mine!.click();
        expect(state.value).toBe('');
    });

    it('a removal inside the group hands focus to the next chip, else the previous', () => {
        const drop = vi.fn();
        render(
            <ChipGroup.Root label="People">
                <Chip.Root value="ada" removable onRemove={() => drop('ada')}><Chip.Action>Ada</Chip.Action><Chip.Remove /></Chip.Root>
                <Chip.Root value="grace" removable onRemove={() => drop('grace')}><Chip.Action>Grace</Chip.Action><Chip.Remove /></Chip.Root>
            </ChipGroup.Root>,
            container,
        );
        const [ada, grace] = actions();
        ada!.focus();
        key(ada!, 'Delete');
        expect(drop).toHaveBeenCalledWith('ada');
        expect(document.activeElement).toBe(grace);
        key(grace!, 'Backspace');
        expect(document.activeElement).toBe(ada);
    });

    it('posts the chosen values through a hidden select while named', async () => {
        render(
            <form>
                <ChipGroup.Root label="Filters" name="filter" selectable multiple defaultValue={['open', 'bugs']}>
                    <Chip.Root value="open"><Chip.Action>Open</Chip.Action></Chip.Root>
                    <Chip.Root value="bugs"><Chip.Action>Bugs</Chip.Action></Chip.Root>
                </ChipGroup.Root>
            </form>,
            container,
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
        // happy-dom's FormData reads a <select> by `value` alone, so the
        // repeated entries are asserted on the options (ToggleGroup's rule).
        const hidden = container.querySelector<HTMLSelectElement>('[data-scope="chip-group"][data-part="hidden-input"]')!;
        expect(hidden.multiple).toBe(true);
        expect(hidden.name).toBe('filter');
        expect([...hidden.selectedOptions].map((o) => o.value)).toEqual(['open', 'bugs']);
    });
});
