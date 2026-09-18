/**
 * Headless theme controller.
 *
 * Theme selection is three-valued: an explicit theme name (persisted), or
 * `null` = follow the system. The system default needs NO JavaScript — the
 * design system's compiled CSS uses `light-dark()` + `color-scheme` on
 * `:root`, so the controller only manages *explicit* choices via the
 * `data-theme` attribute.
 *
 * SSR safety: the browser gets one lazily-created singleton
 * (`themeController`); on the server `useTheme` resolves to the instance a
 * `ThemeProvider` provided per request (never the browser singleton).
 */
import { defineInjectable, signal } from 'sigx';
import { getTheme, onThemesCleared, pairOf, pickThemeFor } from './registry.js';
import type { ZeroThemeName, ZeroThemeNameOrCustom } from '../contract/vocabulary.js';

export interface ThemeControllerOptions {
    /** localStorage key for the persisted explicit choice. */
    storageKey?: string;
    /** Initial explicit theme (e.g. from a request cookie under SSR). */
    initial?: ZeroThemeName | null;
}

export interface ThemeController {
    /**
     * The explicit theme name, or `null` when following the system. OPEN
     * (`ZeroThemeNameOrCustom`), not closed: the value can come from
     * persisted storage written by an older app version or a
     * runtime-registered tenant theme, so a closed return type would lie.
     */
    theme(): ZeroThemeNameOrCustom | null;
    /** The effective color scheme (explicit theme's, else the system's). */
    resolvedScheme(): 'light' | 'dark';
    /**
     * Set an explicit theme, or `null` to follow the system again. CLOSED
     * (`ZeroThemeName`) — the authoring surface, where `setTheme('dimm')`
     * becoming an error is most of the value of a register module.
     */
    setTheme(name: ZeroThemeName | null): void;
    /** Switch to the current theme's registered pair (or the other scheme's default). */
    toggle(): void;
}

export const DEFAULT_STORAGE_KEY = 'zero-theme';

const isClient = (): boolean => typeof document !== 'undefined';

export function createThemeController(options: ThemeControllerOptions = {}): ThemeController {
    const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
    const state = signal({ theme: options.initial ?? null as string | null });

    if (isClient()) {
        if (options.initial === undefined) {
            try {
                state.theme = localStorage.getItem(storageKey);
            } catch {
                // Storage unavailable (privacy mode) — follow the system.
            }
        }
        if (state.theme) {
            document.documentElement.setAttribute('data-theme', state.theme);
        }
    }

    const systemScheme = (): 'light' | 'dark' => {
        if (isClient() && typeof matchMedia === 'function') {
            try {
                return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            } catch {
                return 'light';
            }
        }
        return 'light';
    };

    const setTheme = (name: string | null): void => {
        state.theme = name;
        if (isClient()) {
            if (name) document.documentElement.setAttribute('data-theme', name);
            else document.documentElement.removeAttribute('data-theme');
            try {
                if (name) localStorage.setItem(storageKey, name);
                else localStorage.removeItem(storageKey);
            } catch {
                // Persistence is best-effort.
            }
        }
    };

    return {
        theme: () => state.theme,
        resolvedScheme: () => {
            const explicit = state.theme;
            if (explicit) return getTheme(explicit)?.colorScheme ?? 'light';
            return systemScheme();
        },
        setTheme,
        toggle() {
            const current = state.theme;
            if (current) {
                const pair = pairOf(current);
                if (pair) return setTheme(pair);
            }
            const targetScheme = this.resolvedScheme() === 'dark' ? 'light' : 'dark';
            const target = pickThemeFor(targetScheme);
            if (target) setTheme(target);
        },
    };
}

let browserController: ThemeController | null = null;

/**
 * The app-wide theme handle for the BROWSER — import and call from anywhere
 * (stores, services, effects) with no provider required. On the server this
 * throws; server code resolves `useTheme()` from a per-request
 * `ThemeProvider` instead.
 */
export function themeController(): ThemeController {
    if (!isClient()) {
        throw new Error(
            '[zero] themeController() is browser-only. Under SSR, resolve useTheme() from a ThemeProvider.',
        );
    }
    if (!browserController) {
        browserController = createThemeController();
        // The SURVIVING controller after a design-system swap: `clearThemes()`
        // empties the registry, so an explicit theme this singleton still
        // holds names a stylesheet that just left — reset to follow-the-system
        // (attribute and persistence included; a host that re-seeds with a
        // design system defining the same name re-applies it explicitly).
        // Only the singleton registers: per-request server controllers never
        // see clearThemes (it throws on the server), and provider-created
        // client controllers are owned by their provider.
        const singleton = browserController;
        onThemesCleared(() => singleton.setTheme(null));
    }
    return browserController;
}

/**
 * Inject the nearest provided theme controller; falls back to the browser
 * singleton on the client.
 */
export const useTheme = defineInjectable<ThemeController>(() => themeController());
