/**
 * What one theme makes every custom property mean — the environment a
 * recipe's `var()` references resolve against.
 *
 * A real page resolves them through three stylesheets: `@sigx/zero`'s
 * `css/base.css` (the structural fallbacks, lowest), the design system's
 * `tokens.css` (roles, `-content`, `-soft`, base surfaces, every declared
 * category, `custom` and `extra`), and the recipe rules on top. The first
 * two are reproduced here as one flat map per theme, with the colours
 * already BAKED to literals by the same evaluator the lynx target uses
 * (`resolve/color-bake.ts`) — `light-dark()` picked by the theme's scheme,
 * `-soft` mixed in oklab at the theme's `softMix`, `oklch()` parsed. Baking
 * up front is what lets a recipe value like
 * `color-mix(in oklab, var(--color-primary) 60%, transparent)` evaluate at a
 * cell: substitute the hex, then bake the rest.
 *
 * Everything non-colour stays as written — `var(--space-md)` chains are
 * resolved lazily by the cascade at the node that reads them, which is also
 * where a recipe-local override of the same property would have to win.
 */
import { BASE_SURFACE_TOKEN_LIST, TEXT_FIXED_PREFIX, resolveRoles } from '../../contract.js';
import type { DesignSystemInput } from '../../design-system.js';
import { bakeColor, bakeSoft } from '../../resolve/color-bake.js';
import { STRUCTURAL_FALLBACKS, resolveSystemTokens } from '../../targets/shared.js';
import type { ThemeInput } from '../../tokens.js';

export interface ThemeEnv {
    name: string;
    colorScheme: 'light' | 'dark';
    /** Colour token (`primary`, `primary-soft`, `base-100`) → hex literal. */
    colors: Record<string, string>;
    /** Every custom property the page would resolve, `--prop` → value; colours baked. */
    props: Record<string, string>;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- the same variance
   erasure the emitters use: `R` appears in both positions. */
type AnyTheme = ThemeInput<any, any>;

const customProp = (name: string): string => (name.startsWith('--') ? name : `--${name}`);

const TEXT_PREFIX = '--text-';

/**
 * Bake one theme's colour map the way `lynx/tokens-css.ts` does — the same
 * function calls, so a token can never mean one thing to the lynx emitter
 * and another to the audit. A token the theme mis-spells or omits is simply
 * absent here (the validator reports it as an error of its own), and a
 * consumer's `var()` then falls through to its fallback or to `unresolved`.
 */
function bakedColors(theme: AnyTheme, roles: ReturnType<typeof resolveRoles>): Record<string, string> {
    const colors = theme.colors as Record<string, string>;
    const out: Record<string, string> = {};
    const mix = theme.softMix ?? 0.16;
    const push = (token: string): void => {
        const value = colors[token];
        if (!value) return;
        try { out[token] = bakeColor(value, 'audit'); } catch { /* unparseable: the validator's error */ }
    };
    for (const [name, decl] of Object.entries(roles)) {
        push(name);
        if (decl.content !== false) push(`${name}-content`);
    }
    for (const token of BASE_SURFACE_TOKEN_LIST) push(token);
    for (const [name, decl] of Object.entries(roles)) {
        if (decl.soft === false) continue;
        if (colors[`${name}-soft`]) { push(`${name}-soft`); continue; }
        const role = colors[name];
        const base = colors['base-100'];
        if (!role || !base) continue;
        try { out[`${name}-soft`] = bakeSoft(role, base, mix, 'audit'); } catch { /* as above */ }
    }
    return out;
}

/** One environment per declared theme, in declaration order. */
export function themeEnvironments(ds: DesignSystemInput): ThemeEnv[] {
    const roles = resolveRoles(ds.tokens.roles);
    const input = ds.tokens;
    return Object.entries(input.themes).map(([name, raw]) => {
        const theme = raw as AnyTheme;
        const colors = bakedColors(theme, roles);
        const props: Record<string, string> = { ...STRUCTURAL_FALLBACKS };
        // base.css also aliases the fixed ramp onto the scalable one; a design
        // system that declares a ramp re-emits the aliases for its own keys.
        for (const prop of Object.keys(STRUCTURAL_FALLBACKS)) {
            if (prop.startsWith(TEXT_PREFIX)) props[`${TEXT_FIXED_PREFIX}${prop.slice(TEXT_PREFIX.length)}`] = `var(${prop})`;
        }
        Object.assign(props, resolveSystemTokens(
            input.system,
            theme.colorScheme === 'dark' ? input.systemDark : undefined,
            theme.system,
        ));
        for (const [prop, value] of Object.entries(props)) {
            if (prop.startsWith(TEXT_PREFIX) && !prop.startsWith(TEXT_FIXED_PREFIX)) {
                props[`${TEXT_FIXED_PREFIX}${prop.slice(TEXT_PREFIX.length)}`] = value;
            }
        }
        for (const [key, value] of Object.entries(theme.custom ?? {})) props[customProp(key)] = value;
        for (const [key, value] of Object.entries(theme.extra ?? {})) props[customProp(key)] = value;
        for (const [token, value] of Object.entries(colors)) props[`--color-${token}`] = value;
        return { name, colorScheme: theme.colorScheme, colors, props };
    });
}
