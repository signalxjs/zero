import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { component, defineApp } from 'sigx';
import { render } from '@sigx/runtime-dom';
import { renderToString } from '@sigx/server-renderer';
import { breakpointQuery, clearThemes, getBreakpoints, registerThemes, useMediaQuery } from '@sigx/zero';
import type { BreakpointRange, MediaQueryInput, MediaQueryMatch, MediaQueryOptions } from '@sigx/zero';

type Listener = (e: { matches: boolean }) => void;

/** A controllable matchMedia: one list for every query, `fire()` flips it. */
function fakeMatchMedia(initial: boolean) {
    const listeners = new Set<Listener>();
    const list = {
        matches: initial,
        media: '',
        addEventListener: (_: string, fn: Listener) => { listeners.add(fn); },
        removeEventListener: (_: string, fn: Listener) => { listeners.delete(fn); },
    };
    const matchMedia = vi.fn((query: string) => {
        list.media = query;
        return list as unknown as MediaQueryList;
    });
    const fire = (matches: boolean) => {
        list.matches = matches;
        for (const fn of listeners) fn({ matches });
    };
    return { matchMedia, fire, listeners };
}

const ramp = {
    themes: { light: { colorScheme: 'light' as const, colors: {} } },
    breakpoints: { sm: '640px', md: '768px', lg: '1024px' },
};

describe('breakpoints in the theme registry', () => {
    beforeEach(() => clearThemes());

    it('registerThemes seeds them from the same tokens object, in declaration order', () => {
        expect(getBreakpoints()).toEqual({});
        registerThemes(ramp);
        expect(Object.entries(getBreakpoints())).toEqual([['sm', '640px'], ['md', '768px'], ['lg', '1024px']]);
        expect(Object.isFrozen(getBreakpoints())).toBe(true);
    });

    it('a ramp is replaced whole, and clearThemes drops it with the themes', () => {
        registerThemes(ramp);
        registerThemes({ ...ramp, breakpoints: { md: '900px' } });
        expect(getBreakpoints()).toEqual({ md: '900px' });
        // A source that declares no ramp does not inherit the previous one.
        registerThemes({ themes: ramp.themes });
        expect(getBreakpoints()).toEqual({});
        registerThemes(ramp);
        clearThemes();
        expect(getBreakpoints()).toEqual({});
    });
});

describe('breakpointQuery', () => {
    beforeEach(() => {
        clearThemes();
        registerThemes(ramp);
    });

    it('above is the min-width the kit compiles `at: { md }` to; below is its exact complement', () => {
        expect(breakpointQuery({ above: 'md' })).toBe('(min-width: 768px)');
        expect(breakpointQuery({ below: 'md' })).toBe('(width < 768px)');
        expect(breakpointQuery({ above: 'sm', below: 'lg' })).toBe('(min-width: 640px) and (width < 1024px)');
    });

    it('resolves against an explicit ramp instead of the registered one', () => {
        expect(breakpointQuery({ above: 'tablet' }, { tablet: '50em' })).toBe('(min-width: 50em)');
    });

    it('throws on an undeclared breakpoint, naming the declared ones', () => {
        expect(() => breakpointQuery({ above: 'xl' })).toThrow(/"xl" is not declared — the ramp declares sm, md, lg/);
        // Inherited names are not breakpoints.
        expect(() => breakpointQuery({ above: 'toString' })).toThrow(/not declared/);
        // An explicit ramp is named as a ramp, not as the design system's.
        expect(() => breakpointQuery({ above: 'md' }, { tablet: '50em' })).toThrow(/the ramp declares tablet$/);
        clearThemes();
        expect(() => breakpointQuery({ below: 'md' })).toThrow(/the ramp is empty: call your design system's installThemes\(\)/);
    });

    it('throws on an empty range (for an untyped caller — the type refuses it)', () => {
        expect(() => breakpointQuery({} as BreakpointRange)).toThrow(/needs `above`, `below`, or both/);
    });
});

describe('useMediaQuery', () => {
    const original = window.matchMedia;
    beforeEach(() => {
        clearThemes();
        registerThemes(ramp);
    });
    afterEach(() => {
        window.matchMedia = original;
    });

    function probe(input: MediaQueryInput, options?: MediaQueryOptions) {
        const seen: boolean[] = [];
        const handle: { match?: MediaQueryMatch } = {};
        const Probe = component(() => {
            const match = useMediaQuery(input, options);
            handle.match = match;
            seen.push(match.value);
            return () => <i>{String(match.value)}</i>;
        });
        return { Probe, seen, handle };
    }

    it('renders `initial` first, reads the real match on mount, then follows changes', async () => {
        const mm = fakeMatchMedia(true);
        window.matchMedia = mm.matchMedia;
        const { Probe, seen, handle } = probe('(min-width: 768px)');
        const host = document.createElement('div');
        render(<Probe />, host);

        expect(seen[0]).toBe(false);
        expect(mm.matchMedia).toHaveBeenCalledWith('(min-width: 768px)');
        expect(handle.match!.value).toBe(true);
        await Promise.resolve();
        expect(host.textContent).toBe('true');

        mm.fire(false);
        expect(handle.match!.value).toBe(false);
        await Promise.resolve();
        expect(host.textContent).toBe('false');
    });

    it('a caller-supplied initial is what the first render reads', () => {
        const mm = fakeMatchMedia(false);
        window.matchMedia = mm.matchMedia;
        const { Probe, seen, handle } = probe({ above: 'md' }, { initial: true });
        render(<Probe />, document.createElement('div'));
        expect(seen[0]).toBe(true);
        expect(handle.match!.value).toBe(false);
    });

    it('a breakpoint range asks matchMedia the resolved query', () => {
        const mm = fakeMatchMedia(false);
        window.matchMedia = mm.matchMedia;
        const { Probe } = probe({ below: 'lg' });
        render(<Probe />, document.createElement('div'));
        expect(mm.matchMedia).toHaveBeenCalledWith('(width < 1024px)');
    });

    it('detaches its listener on unmount', () => {
        const mm = fakeMatchMedia(false);
        window.matchMedia = mm.matchMedia;
        const { Probe } = probe('(prefers-reduced-motion: reduce)');
        const host = document.createElement('div');
        render(<Probe />, host);
        expect(mm.listeners.size).toBe(1);
        render(<span />, host);
        expect(mm.listeners.size).toBe(0);
    });

    it('two components never share state — each call owns its subscription', () => {
        const mm = fakeMatchMedia(true);
        window.matchMedia = mm.matchMedia;
        const a = probe('(min-width: 1px)');
        const b = probe('(min-width: 1px)', { initial: true });
        render(<div><a.Probe /><b.Probe /></div>, document.createElement('div'));
        expect(mm.listeners.size).toBe(2);
        expect(a.seen[0]).toBe(false);
        expect(b.seen[0]).toBe(true);
    });

    it('stays at `initial` where matchMedia does not exist', () => {
        window.matchMedia = undefined as unknown as typeof window.matchMedia;
        const { Probe, handle } = probe('(min-width: 1px)', { initial: true });
        render(<Probe />, document.createElement('div'));
        expect(handle.match!.value).toBe(true);
    });

    it('is context-bound: outside a component setup it throws', () => {
        expect(() => useMediaQuery('(min-width: 1px)')).toThrow(/must be called from a component's setup/);
    });

    it('an undeclared breakpoint throws at setup rather than never matching', () => {
        const { Probe } = probe({ above: 'xl' });
        expect(() => render(<Probe />, document.createElement('div'))).toThrow(/"xl" is not declared/);
    });

    it('server-renders `initial` and never asks matchMedia', async () => {
        const mm = fakeMatchMedia(true);
        window.matchMedia = mm.matchMedia;
        const narrow = probe({ above: 'md' });
        const wide = probe({ above: 'md' }, { initial: true });
        const html = await renderToString(defineApp(<div><narrow.Probe /><wide.Probe /></div>));
        expect(html).toContain('<i>false</i>');
        expect(html).toContain('<i>true</i>');
        expect(mm.matchMedia).not.toHaveBeenCalled();
    });
});
