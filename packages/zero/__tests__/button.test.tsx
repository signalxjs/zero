/**
 * Button behaviour.
 *
 * `onClick` gets its own test because sigx forwards no rest props: a handler
 * that isn't declared and wired makes the component silently inert, which is
 * exactly how it shipped the first time.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { component, signal } from 'sigx';
import { Button, buttonAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

describe('Button', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    const root = () =>
        container.querySelector<HTMLButtonElement>('[data-scope="button"][data-part="root"]')!;

    it('renders the declared anatomy on a native button', () => {
        render(<Button.Root>Save</Button.Root>, container);
        expectAnatomy(container, buttonAnatomy);
        expect(root().tagName).toBe('BUTTON');
    });

    it('defaults type to button, not the native submit', () => {
        // The native default posts the enclosing form.
        render(<Button.Root>Save</Button.Root>, container);
        expect(root().type).toBe('button');
    });

    it('honours an explicit type', () => {
        render(<Button.Root type="submit">Go</Button.Root>, container);
        expect(root().type).toBe('submit');
    });

    it('calls onClick', () => {
        const onClick = vi.fn();
        render(<Button.Root onClick={onClick}>Save</Button.Root>, container);
        root().click();
        expect(onClick).toHaveBeenCalledOnce();
    });

    it('does not call onClick when disabled', () => {
        const onClick = vi.fn();
        render(<Button.Root disabled onClick={onClick}>Save</Button.Root>, container);
        root().click();
        expect(onClick).not.toHaveBeenCalled();
    });

    it('passes the variant axes through as data attributes', () => {
        render(
            <Button.Root color="success" size="lg" variant="outline">Save</Button.Root>,
            container,
        );
        expect(root().getAttribute('data-color')).toBe('success');
        expect(root().getAttribute('data-size')).toBe('lg');
        expect(root().getAttribute('data-variant')).toBe('outline');
    });

    it('accepts a design-system size name off the recommended ramp', () => {
        // The `size` axis is DS vocabulary, not contract: Material specifies
        // density, other systems number their steps. This is as much a
        // type-level assertion as a runtime one — `size="comfortable"` was a
        // compile error while `SizeScale` was a closed union, so a design
        // system with its own ramp could not be consumed at all.
        render(
            <Button.Root color="brand" size="comfortable" variant="tonal">Save</Button.Root>,
            container,
        );
        expect(root().getAttribute('data-size')).toBe('comfortable');
        expect(root().getAttribute('data-color')).toBe('brand');
        expect(root().getAttribute('data-variant')).toBe('tonal');
    });

    it('passes a design-system axis beyond the named three', () => {
        // The kit has always compiled `[data-density="compact"]` selectors,
        // and until `axes` existed nothing could set that attribute — the
        // rules were dead on arrival. A design language with density,
        // emphasis or tone now has a route to the DOM.
        render(
            <Button.Root color="primary" axes={{ density: 'compact', emphasis: 'high' }}>Save</Button.Root>,
            container,
        );
        expect(root().getAttribute('data-density')).toBe('compact');
        expect(root().getAttribute('data-emphasis')).toBe('high');
        expect(root().getAttribute('data-color')).toBe('primary');
    });

    it('renders modifiers as presence-only attributes', () => {
        // Presence-only, like the contract's own flags: the attribute is
        // there or it is not, and it never carries `="false"`. `false` and an
        // omitted key are the same statement.
        render(
            <Button.Root color="primary" mods={{ block: true, wide: false }}>Save</Button.Root>,
            container,
        );
        expect(root().getAttribute('data-mod-block')).toBe('');
        expect(root().hasAttribute('data-mod-wide')).toBe(false);
    });

    it('a modifier cannot shadow a contract flag, because of the prefix', () => {
        // The whole reason modifiers are namespaced. `axes={{ disabled: … }}`
        // throws; a modifier NAMED `disabled` is harmless, because it lands on
        // `data-mod-disabled` and leaves zero's own `data-disabled` alone.
        render(<Button.Root mods={{ disabled: true }}>Save</Button.Root>, container);
        expect(root().getAttribute('data-mod-disabled')).toBe('');
        expect(root().hasAttribute('data-disabled')).toBe(false);
    });

    it('refuses a modifier name that could not be an attribute', () => {
        expect(() => render(
            <Button.Root mods={{ 'Not Kebab': true }}>Save</Button.Root>,
            container,
        )).toThrow(/not a kebab-case identifier/);
    });

    it('refuses an axis that would shadow the anatomy contract', () => {
        // Overwriting `data-state` from userland would make every
        // [data-state="open"] rule in the design system match the wrong
        // thing, with no error anywhere. Loud beats silent: the value comes
        // from application code, not from user input.
        expect(() => render(
            <Button.Root axes={{ state: 'open' }}>Save</Button.Root>,
            container,
        )).toThrow(/part of the anatomy contract/);

        expect(() => render(
            <Button.Root axes={{ disabled: 'yes' }}>Save</Button.Root>,
            container,
        )).toThrow(/part of the anatomy contract/);

        expect(() => render(
            <Button.Root axes={{ 'Not Kebab': 'x' }}>Save</Button.Root>,
            container,
        )).toThrow(/not a kebab-case identifier/);
    });

    it('refuses an axis that already has a prop of its own', () => {
        // `axes` is applied after the named props, so this silently won:
        // color="primary" axes={{ color: 'x' }} rendered data-color="x".
        // Two ways to write one attribute, with precedence nobody would guess.
        expect(() => render(
            <Button.Root color="primary" axes={{ color: 'hijacked' }}>Save</Button.Root>,
            container,
        )).toThrow(/has a prop of its own/);

        // …even without the named prop present, so the rule is one thing to
        // learn rather than a conditional collision.
        for (const axis of ['color', 'size', 'variant']) {
            expect(() => render(
                <Button.Root axes={{ [axis]: 'x' }}>Save</Button.Root>,
                container,
            )).toThrow(/has a prop of its own/);
        }
    });

    it('omits the axes it was not given', () => {
        // Absent, not empty — the CSS-only defaults hang off :not([data-size]).
        render(<Button.Root>Save</Button.Root>, container);
        expect(root().hasAttribute('data-size')).toBe(false);
        expect(root().hasAttribute('data-variant')).toBe(false);
    });

    it('does not call onClick when asChild and disabled', () => {
        // The native <button disabled> case is enforced by the platform; an
        // <a> is not, so this branch does it by hand and is the one that can
        // regress silently.
        const onClick = vi.fn();
        render(
            <Button.Root asChild disabled onClick={onClick}>
                {(p: Record<string, unknown>) => <a href="/docs" {...p}>Docs</a>}
            </Button.Root>,
            container,
        );
        container.querySelector<HTMLElement>('[data-scope="button"]')!.click();
        expect(onClick).not.toHaveBeenCalled();
    });

    it('still calls onClick for an enabled asChild render', () => {
        const onClick = vi.fn();
        render(
            <Button.Root asChild onClick={onClick}>
                {(p: Record<string, unknown>) => <a href="/docs" {...p}>Docs</a>}
            </Button.Root>,
            container,
        );
        container.querySelector<HTMLElement>('[data-scope="button"]')!.click();
        expect(onClick).toHaveBeenCalledOnce();
    });

    it('marks an asChild render disabled, since the element may not support it', () => {
        render(
            <Button.Root asChild disabled>
                {(p: Record<string, unknown>) => <a {...p}>Docs</a>}
            </Button.Root>,
            container,
        );
        const el = container.querySelector('[data-scope="button"]')!;
        expect(el.tagName).toBe('A');
        expect(el.getAttribute('aria-disabled')).toBe('true');
        expect(el.hasAttribute('data-disabled')).toBe(true);
    });

    it('publishes press feedback on pointer press and release', () => {
        // The behavior itself is covered in press.test.ts; this pins the
        // wiring — the handlers actually reach the rendered element.
        render(<Button.Root>Save</Button.Root>, container);
        root().dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(root().hasAttribute('data-pressed')).toBe(true);
        expect(root().style.getPropertyValue('--press-x')).toBe('0px');
        root().dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        expect(root().hasAttribute('data-pressed')).toBe(false);
    });

    it('publishes no press feedback while disabled', () => {
        render(<Button.Root disabled>Save</Button.Root>, container);
        root().dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(root().hasAttribute('data-pressed')).toBe(false);
    });

    it('gives an asChild render press feedback through the bag', () => {
        render(
            <Button.Root asChild>
                {(p: Record<string, unknown>) => <a href="/docs" {...p}>Docs</a>}
            </Button.Root>,
            container,
        );
        const el = container.querySelector<HTMLElement>('[data-scope="button"]')!;
        el.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(el.hasAttribute('data-pressed')).toBe(true);
        el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        expect(el.hasAttribute('data-pressed')).toBe(false);
    });
});

describe('Button asChild semantics (#275)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    const root = () =>
        container.querySelector<HTMLElement>('[data-scope="button"][data-part="root"]')!;
    const key = (type: 'keydown' | 'keyup', k: string) => {
        const e = new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true });
        root().dispatchEvent(e);
        return e;
    };
    const span = (p: Record<string, unknown>) => <span {...p}>Save</span>;

    it('gives a non-interactive element the button contract: role and a tab stop', () => {
        render(<Button.Root asChild>{span}</Button.Root>, container);
        expect(root().tagName).toBe('SPAN');
        expect(root().getAttribute('role')).toBe('button');
        expect(root().tabIndex).toBe(0);
        root().focus();
        expect(document.activeElement).toBe(root());
        expectAnatomy(container, buttonAnatomy);
    });

    it('keeps an app-named role', () => {
        render(<Button.Root asChild role="menuitem">{span}</Button.Root>, container);
        expect(root().getAttribute('role')).toBe('menuitem');
    });

    it('activates once from Enter (on press) and once from Space (on release)', () => {
        const onClick = vi.fn();
        render(<Button.Root asChild onClick={onClick}>{span}</Button.Root>, container);
        expect(key('keydown', 'Enter').defaultPrevented).toBe(true);
        expect(onClick).toHaveBeenCalledTimes(1);
        key('keyup', 'Enter');
        expect(onClick).toHaveBeenCalledTimes(1);
        // Space: nothing on press (it only stops the page scrolling) …
        expect(key('keydown', ' ').defaultPrevented).toBe(true);
        expect(onClick).toHaveBeenCalledTimes(1);
        // … and one click on release.
        key('keyup', ' ');
        expect(onClick).toHaveBeenCalledTimes(2);
    });

    it('a Space release that did not start here activates nothing', () => {
        const onClick = vi.fn();
        render(<Button.Root asChild onClick={onClick}>{span}</Button.Root>, container);
        key('keyup', ' ');
        expect(onClick).not.toHaveBeenCalled();
    });

    it('adds no role, tab stop or synthesized click to a native button or a link', () => {
        const onClick = vi.fn();
        render(
            <div>
                <Button.Root asChild onClick={onClick}>
                    {(p: Record<string, unknown>) => <button type="button" {...p}>Save</button>}
                </Button.Root>
                <Button.Root asChild onClick={onClick}>
                    {(p: Record<string, unknown>) => <a href="/docs" {...p}>Docs</a>}
                </Button.Root>
            </div>,
            container,
        );
        for (const el of container.querySelectorAll<HTMLElement>('[data-scope="button"]')) {
            expect(el.hasAttribute('role')).toBe(false);
            expect(el.hasAttribute('tabindex')).toBe(false);
            // The platform synthesizes these; a second click would double it.
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        }
        expect(onClick).not.toHaveBeenCalled();
        expect(container.querySelector('a')!.getAttribute('href')).toBe('/docs');
    });

    it('a disabled element leaves the tab order and activates nothing', () => {
        const onClick = vi.fn();
        render(<Button.Root asChild disabled onClick={onClick}>{span}</Button.Root>, container);
        expect(root().tabIndex).toBe(-1);
        expect(root().getAttribute('aria-disabled')).toBe('true');
        key('keydown', 'Enter');
        key('keydown', ' ');
        key('keyup', ' ');
        root().click();
        expect(onClick).not.toHaveBeenCalled();
    });

    it('a disabled link loses its href, keeps the link role, and cancels middle-click', () => {
        const state = signal({ disabled: true });
        const App = component(() => () => (
            <Button.Root asChild disabled={state.disabled}>
                {(p: Record<string, unknown>) => <a href="/docs" {...p}>Docs</a>}
            </Button.Root>
        ));
        render(<App />, container);
        expect(root().tagName).toBe('A');
        expect(root().hasAttribute('href')).toBe(false);
        expect(root().getAttribute('role')).toBe('link');
        expect(root().getAttribute('aria-disabled')).toBe('true');
        expect(root().tabIndex).toBe(-1);
        const aux = new MouseEvent('auxclick', { button: 1, bubbles: true, cancelable: true });
        root().dispatchEvent(aux);
        expect(aux.defaultPrevented).toBe(true);
        // Enabled again, it is a plain link once more.
        state.disabled = false;
        expect(root().getAttribute('href')).toBe('/docs');
        expect(root().hasAttribute('role')).toBe(false);
        expect(root().hasAttribute('tabindex')).toBe(false);
        expect(root().hasAttribute('aria-disabled')).toBe(false);
    });

    it('a disabled native asChild button gets the native disabled, so it cannot submit', () => {
        const state = signal({ disabled: true, focusable: false });
        const App = component(() => () => (
            <Button.Root asChild disabled={state.disabled} focusableWhenDisabled={state.focusable}>
                {(p: Record<string, unknown>) => <button type="submit" {...p}>Save</button>}
            </Button.Root>
        ));
        render(<App />, container);
        const el = root() as HTMLButtonElement;
        expect(el.disabled).toBe(true);
        // focusableWhenDisabled trades it for aria-disabled, as on the built-in button.
        state.focusable = true;
        expect(el.disabled).toBe(false);
        expect(el.getAttribute('aria-disabled')).toBe('true');
        state.focusable = false;
        state.disabled = false;
        expect(el.disabled).toBe(false);
    });

    it('a disabled asChild summary gets no disabled attribute it does not have', () => {
        render(
            <Button.Root asChild disabled>
                {(p: Record<string, unknown>) => <details><summary {...p}>More</summary></details>}
            </Button.Root>,
            container,
        );
        expect(root().hasAttribute('disabled')).toBe(false);
        expect(root().getAttribute('aria-disabled')).toBe('true');
    });

    it('focusableWhenDisabled: a native button keeps its tab stop and blocks activation', () => {
        const onClick = vi.fn();
        const onSubmit = vi.fn((e: Event) => e.preventDefault());
        const form = document.createElement('form');
        form.addEventListener('submit', onSubmit);
        container.appendChild(form);
        render(<Button.Root disabled focusableWhenDisabled type="submit" onClick={onClick}>Save</Button.Root>, form);
        const el = root() as HTMLButtonElement;
        expect(el.disabled).toBe(false);
        expect(el.getAttribute('aria-disabled')).toBe('true');
        expect(el.hasAttribute('data-disabled')).toBe(true);
        el.focus();
        expect(document.activeElement).toBe(el);
        el.click();
        expect(onClick).not.toHaveBeenCalled();
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('focusableWhenDisabled: an asChild element keeps tabindex 0 and blocks activation', () => {
        const onClick = vi.fn();
        render(<Button.Root asChild disabled focusableWhenDisabled onClick={onClick}>{span}</Button.Root>, container);
        expect(root().tabIndex).toBe(0);
        expect(root().getAttribute('aria-disabled')).toBe('true');
        expect(key('keydown', ' ').defaultPrevented).toBe(true);
        key('keyup', ' ');
        key('keydown', 'Enter');
        root().click();
        expect(onClick).not.toHaveBeenCalled();
    });

    it('focusableWhenDisabled: a disabled link stays a tab stop', () => {
        render(
            <Button.Root asChild disabled focusableWhenDisabled>
                {(p: Record<string, unknown>) => <a href="/docs" {...p}>Docs</a>}
            </Button.Root>,
            container,
        );
        expect(root().hasAttribute('href')).toBe(false);
        expect(root().tabIndex).toBe(0);
    });
});

describe('Button loading (#50)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    const root = () =>
        container.querySelector<HTMLButtonElement>('[data-scope="button"][data-part="root"]')!;
    const spinner = () => container.querySelector('[data-scope="button"][data-part="spinner"]');

    it('renders the loading state, the ARIA and a spinner before the label', () => {
        render(<Button.Root loading>Save</Button.Root>, container);
        expectAnatomy(container, buttonAnatomy);
        expect(root().getAttribute('data-state')).toBe('loading');
        expect(root().getAttribute('aria-busy')).toBe('true');
        expect(root().getAttribute('aria-disabled')).toBe('true');
        expect(spinner()!.getAttribute('aria-hidden')).toBe('true');
        expect(root().firstElementChild).toBe(spinner());
        // The label stays: it is what the reader is waiting on.
        expect(root().textContent).toBe('Save');
    });

    it('keeps the button focusable — not the native disabled', () => {
        render(<Button.Root loading>Save</Button.Root>, container);
        expect(root().disabled).toBe(false);
        root().focus();
        expect(document.activeElement).toBe(root());
    });

    it('blocks activation: no onClick, no form submission, no press feedback', () => {
        const onClick = vi.fn();
        const onSubmit = vi.fn((e: Event) => e.preventDefault());
        const form = document.createElement('form');
        form.addEventListener('submit', onSubmit);
        container.appendChild(form);
        render(<Button.Root loading type="submit" onClick={onClick}>Save</Button.Root>, form);
        root().dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(root().hasAttribute('data-pressed')).toBe(false);
        root().click();
        expect(onClick).not.toHaveBeenCalled();
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('carries no state, ARIA or spinner at rest, and follows the prop', () => {
        const state = signal({ saving: false });
        const App = component(() => () => <Button.Root loading={state.saving}>Save</Button.Root>);
        render(<App />, container);
        expect(root().hasAttribute('data-state')).toBe(false);
        expect(root().hasAttribute('aria-busy')).toBe(false);
        expect(root().hasAttribute('aria-disabled')).toBe(false);
        expect(spinner()).toBeNull();
        state.saving = true;
        expect(root().getAttribute('data-state')).toBe('loading');
        expect(spinner()).not.toBeNull();
        state.saving = false;
        expect(spinner()).toBeNull();
    });

    it('gives an asChild element the state and the ARIA, but no spinner', () => {
        const onClick = vi.fn();
        render(
            <Button.Root asChild loading onClick={onClick}>
                {(p: Record<string, unknown>) => <a href="/docs" {...p}>Docs</a>}
            </Button.Root>,
            container,
        );
        const el = container.querySelector<HTMLElement>('[data-scope="button"][data-part="root"]')!;
        expect(el.getAttribute('data-state')).toBe('loading');
        expect(el.getAttribute('aria-busy')).toBe('true');
        expect(spinner()).toBeNull();
        el.click();
        expect(onClick).not.toHaveBeenCalled();
    });
});
