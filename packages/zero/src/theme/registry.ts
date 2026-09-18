/**
 * Theme registry — metadata about the themes a design system compiled.
 *
 * Token VALUES live in the DS's CSS; the registry holds what the runtime
 * needs: names, color-scheme, light/dark pairing, and an optional swatch
 * palette for pickers/canvas/charts. Design-system packages seed it from
 * their `installThemes()` side-effect entry.
 *
 * Write-once configuration seeded at module load (identical on server and
 * client), so a module-level Map is safe under SSR.
 *
 * `clearThemes()` is the one exception, and it is client-only by intent: a host
 * that swaps design systems at runtime must shed the previous DS's themes,
 * because theme names are DS-specific and a stale entry would advertise a
 * `[data-theme]` block whose stylesheet is no longer loaded. Never call it per
 * SSR request — that would race concurrent renders sharing this module.
 */
import { RECOMMENDED_ROLE_LIST, defaultSwatch } from '../contract/tokens.js';
import type { ZeroThemeNameOrCustom } from '../contract/vocabulary.js';

// `console` is host-provided everywhere zero runs (browsers, Node, Lynx's JS
// runtimes) but typed only by lib.dom / @types/node — declared locally so
// this module compiles without either (it is part of the `portable` gate).
declare const console: { warn(message: string): void };

export interface ThemeInfo {
    name: string;
    colorScheme: 'light' | 'dark';
    /** The counterpart theme `toggle()` switches to. */
    pair?: string;
    /** Optional representative colors for theme pickers (token → CSS color). */
    swatch?: Record<string, string>;
}

const themes = new Map<string, ThemeInfo>();

/**
 * The source-declared scheme defaults. With one theme per scheme they change
 * nothing; with three, they are what keeps `pickThemeFor` from returning
 * whichever dark theme happened to register first.
 */
const schemeDefaults: { light?: string; dark?: string } = {};

/**
 * Listeners `clearThemes()` runs after emptying the registry — how the
 * browser theme controller singleton sheds an explicit theme whose design
 * system just left, without this module importing the controller (it imports
 * us). Client-only by construction: `clearThemes` throws on the server.
 * @internal
 */
const clearListeners = new Set<() => void>();

/** @internal — see `clearListeners`. */
export function onThemesCleared(listener: () => void): void {
    clearListeners.add(listener);
}

/**
 * Field-by-field equality, deliberately not `JSON.stringify` — stringify is
 * insertion-order-sensitive, so two semantically identical registrations
 * whose `swatch` keys arrive in a different order would warn about a change
 * that is not one.
 */
function sameThemeInfo(a: ThemeInfo, b: ThemeInfo): boolean {
    if (a.name !== b.name || a.colorScheme !== b.colorScheme || a.pair !== b.pair) return false;
    const aSwatch = a.swatch ?? {};
    const bSwatch = b.swatch ?? {};
    const keys = Object.keys(aSwatch);
    if (keys.length !== Object.keys(bSwatch).length) return false;
    return keys.every((key) => aSwatch[key] === bSwatch[key]);
}

export function registerTheme(info: ThemeInfo): void {
    // Warn — never throw — on a re-registration that CHANGES the entry.
    // Design systems register at module init, which on the server runs once
    // per process while the registry is shared by every concurrent render: a
    // same-name-different-content registration is one design system bleeding
    // into another (or two installed without a `clearThemes()` between them).
    // An identical re-registration is a legitimate double-install and stays
    // silent. Merge either way: last write wins, loudly.
    const existing = themes.get(info.name);
    if (existing && !sameThemeInfo(existing, info)) {
        console.warn(
            `[zero] theme "${info.name}" is already registered with different settings — re-registering over it. `
            + 'Two design systems appear to be installing themes into one registry (under SSR, one request\'s '
            + 'design system bleeding into another\'s); call clearThemes() between design systems on the client, '
            + 'and never share one process-wide registry across requests that use different design systems.',
        );
    }
    themes.set(info.name, info);
}

/**
 * A design system's token declaration, as much of it as the registry needs.
 *
 * Typed STRUCTURALLY on purpose: `@sigx/zero-kit`'s `TokensInput` is
 * assignable to this, but zero never imports the kit — the kit is a Node-only
 * authoring tool and this code runs in the browser. The layering survives and
 * design systems still pass their `tokens` object whole.
 */
export interface ThemeSource {
    /**
     * The design system's color role declaration. Only the KEYS are read, and
     * their declaration order is the default swatch order.
     */
    roles?: Record<string, unknown>;
    /** Explicit swatch declaration; overrides the default derivation. */
    swatch?: readonly string[];
    themes: Record<string, {
        colorScheme: 'light' | 'dark';
        pair?: string;
        colors: Record<string, string>;
    }>;
    /**
     * The theme `:root` uses under a light system — `pickThemeFor('light')`
     * prefers it over first-registered. Flows structurally from the kit's
     * `TokensInput`, so no design-system package passes it explicitly.
     */
    defaultLight?: string;
    /** The `defaultLight` counterpart for system dark. */
    defaultDark?: string;
}

/**
 * Seed the registry from a design system's declaration — the runtime half of
 * `@sigx/zero-kit`'s compile step, and the only thing a DS package's
 * `installThemes()` needs to call.
 *
 * The swatch is DERIVED from the declaration, never hardcoded: a design system
 * whose distinguishing colors aren't `primary`/`neutral` would otherwise get a
 * picker that renders every one of its themes identically. `defaultSwatch` is
 * the same rule the compiler applies, so what lands here matches the design
 * system's own `manifest.json`.
 */
export function registerThemes(source: ThemeSource): void {
    // No `roles` means the design system took the recommended vocabulary —
    // the kit's `resolveRoles` default, restated in terms zero already knows.
    const roleNames = source.roles ? Object.keys(source.roles) : RECOMMENDED_ROLE_LIST;
    const swatchTokens = source.swatch ?? defaultSwatch(roleNames);

    for (const [name, theme] of Object.entries(source.themes)) {
        registerTheme({
            name,
            colorScheme: theme.colorScheme,
            pair: theme.pair,
            // Skip tokens this theme doesn't define rather than registering
            // `undefined` — matches what the compiler emits.
            swatch: Object.fromEntries(
                swatchTokens.flatMap((token) =>
                    theme.colors[token] ? [[token, theme.colors[token]]] : []),
            ),
        });
    }
    if (source.defaultLight) schemeDefaults.light = source.defaultLight;
    if (source.defaultDark) schemeDefaults.dark = source.defaultDark;
}

/**
 * Drop every registered theme — browser-only, for hosts that exchange design
 * systems at runtime. Re-seed immediately afterwards with the incoming DS's
 * `installThemes()`; between the two calls `listThemes()` is empty and
 * `pickThemeFor()` returns undefined.
 *
 * Also resets the browser controller singleton's explicit theme to
 * follow-the-system (attribute and persistence included): theme names are
 * DS-specific, so whatever it held names a stylesheet that just left. A host
 * that wants to keep a same-named theme across the swap captures it before
 * clearing and re-applies it after re-seeding.
 *
 * Throws on the server rather than trusting the docs: this is the one call that
 * can unpick write-once configuration, and on the server that registry is
 * shared by every concurrent render. Failing loudly beats bleeding one
 * request's design system into another's.
 */
export function clearThemes(): void {
    // A cast property read rather than `typeof document === 'undefined'`:
    // same runtime answer, but it names no lib.dom global, so this module
    // stays compilable without DOM types (a non-browser client platform like
    // Lynx has no document either — the throw below is about SSR, and a Lynx
    // host swapping design systems would need its own registry-reset path).
    if ((globalThis as { document?: unknown }).document === undefined) {
        throw new Error(
            '[zero] clearThemes() is browser-only — clearing the shared registry under SSR would race concurrent renders.',
        );
    }
    themes.clear();
    delete schemeDefaults.light;
    delete schemeDefaults.dark;
    // Theme names are DS-specific, so any explicit choice the surviving
    // browser controller still holds names a theme whose stylesheet just
    // left — reset it to follow-the-system (the listener is registered by the
    // controller singleton). A host that re-seeds with a design system
    // defining the same name re-applies it explicitly afterwards.
    for (const listener of clearListeners) listener();
}

export function getTheme(name: ZeroThemeNameOrCustom): ThemeInfo | undefined {
    return themes.get(name);
}

export function listThemes(): ThemeInfo[] {
    return [...themes.values()];
}

/** The registered pair of a theme, if any. */
export function pairOf(name: ZeroThemeNameOrCustom): string | undefined {
    return themes.get(name)?.pair;
}

/**
 * The theme to use for a color scheme: the source's declared
 * `defaultLight`/`defaultDark` when it is registered with the matching
 * scheme, else the first registered match. First-registered was correct by
 * construction with one theme per scheme and arbitrary with three — the
 * latent bug only a third theme exposes (docs/architecture.md, "The theme
 * model").
 */
export function pickThemeFor(scheme: 'light' | 'dark'): string | undefined {
    const preferred = schemeDefaults[scheme];
    if (preferred && themes.get(preferred)?.colorScheme === scheme) return preferred;
    for (const t of themes.values()) {
        if (t.colorScheme === scheme) return t.name;
    }
    return undefined;
}
