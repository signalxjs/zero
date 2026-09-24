import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { effect } from 'sigx';
import { clearThemes, createThemeController, registerTheme } from '@sigx/zero';

/**
 * A controllable `(prefers-color-scheme: dark)` — one MediaQueryList whose
 * `matches` flips and dispatches `change`, the way the browser reports an
 * OS scheme switch.
 */
function mockSystemScheme(initialDark: boolean) {
    let dark = initialDark;
    const listeners = new Set<(e: MediaQueryListEvent) => void>();
    const list = {
        media: '(prefers-color-scheme: dark)',
        get matches() {
            return dark;
        },
        addEventListener: (_type: string, fn: (e: MediaQueryListEvent) => void) => listeners.add(fn),
        removeEventListener: (_type: string, fn: (e: MediaQueryListEvent) => void) => listeners.delete(fn),
    };
    vi.stubGlobal('matchMedia', vi.fn(() => list));
    return {
        set(next: boolean) {
            dark = next;
            for (const fn of listeners) fn({ matches: next, media: list.media } as MediaQueryListEvent);
        },
        listenerCount: () => listeners.size,
    };
}

describe('theme controller — follow-system (#178)', () => {
    beforeEach(() => {
        clearThemes();
        document.documentElement.removeAttribute('data-theme');
    });
    afterEach(() => vi.unstubAllGlobals());

    it('resolvedScheme re-runs a reactive reader when the OS scheme changes', () => {
        const os = mockSystemScheme(false);
        const ctl = createThemeController({ initial: null });
        const seen: string[] = [];
        effect(() => {
            seen.push(ctl.resolvedScheme());
        });
        expect(seen).toEqual(['light']);

        os.set(true);
        expect(seen).toEqual(['light', 'dark']);

        os.set(false);
        expect(seen).toEqual(['light', 'dark', 'light']);
    });

    it('an explicit theme is not affected by an OS change', () => {
        registerTheme({ name: 'l', colorScheme: 'light', pair: 'd' });
        registerTheme({ name: 'd', colorScheme: 'dark', pair: 'l' });
        const os = mockSystemScheme(false);
        const ctl = createThemeController({ initial: 'd' as never });
        const seen: string[] = [];
        effect(() => {
            seen.push(ctl.resolvedScheme());
        });
        os.set(false);
        expect(seen.at(-1)).toBe('dark');

        // Back to following the system: the reader tracks the OS again.
        ctl.setTheme(null);
        expect(seen.at(-1)).toBe('light');
        os.set(true);
        expect(seen.at(-1)).toBe('dark');
    });

    it('toggle picks the opposite of the current OS scheme after a switch', () => {
        registerTheme({ name: 'l', colorScheme: 'light', pair: 'd' });
        registerTheme({ name: 'd', colorScheme: 'dark', pair: 'l' });
        const os = mockSystemScheme(false);
        const ctl = createThemeController({ initial: null });
        os.set(true);
        ctl.toggle();
        expect(ctl.theme()).toBe('l');
    });

    it('subscribes lazily and once, however many controllers read it', () => {
        const os = mockSystemScheme(false);
        const a = createThemeController({ initial: null });
        const b = createThemeController({ initial: null });
        expect(os.listenerCount()).toBe(0);
        a.resolvedScheme();
        b.resolvedScheme();
        expect(os.listenerCount()).toBe(1);
    });

    it('without matchMedia the system scheme is light', () => {
        vi.stubGlobal('matchMedia', undefined);
        const ctl = createThemeController({ initial: null });
        expect(ctl.resolvedScheme()).toBe('light');
    });
});
