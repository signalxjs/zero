/**
 * Lynx token emitter — compiles a `TokensInput` to the class-hosted, literal
 * token CSS lynx's engine can consume. The web emitter's modern machinery is
 * exactly what lynx lacks, so every one of its moves has a baked counterpart:
 *
 * - No `:root` → tokens live on the `.zx-root` host class (the theme
 *   provider's element) and on one `.zx-theme-<name>` class per theme.
 * - No `light-dark()` / `prefers-color-scheme` collapsing → `.zx-root`
 *   carries the default light theme and every theme block is a FULL
 *   restatement, so switching is one class swap with no inherited residue.
 *   (Scheme following is the runtime's job — the theme controller picks the
 *   class; this mirrors the lynx repo's proven generated-theme-CSS delivery.)
 * - No `oklch()` / `color-mix()` → every color is culori-baked to a hex
 *   literal, and soft tints are the same oklab mix evaluated at compile time.
 * - No `@property`, no `@layer`, no reduced-motion `@media` → omitted, with
 *   report entries where an author could reasonably wonder where they went.
 * - `var()` indirection between non-color tokens is unproven on lynx →
 *   substituted to literals at compile time (fixpoint, cycle-guarded).
 *   References to `--color-*` stay live: single-level color `var()` is the
 *   one proven indirection, and it is what keeps a shadow's glow following
 *   the theme.
 * - `--text-fixed-<key>` aliases are materialized as the ramp's LITERAL
 *   values — their whole reason to exist: the lynx runtime re-emits scaled
 *   `--text-*` under the user's font scale, and the fixed alias must be the
 *   unscaled value the scaler never touches.
 */
import {
    BASE_SURFACE_TOKEN_LIST,
    TEXT_FIXED_PREFIX,
    TOKEN_KEY_PATTERN,
    resolveRoles,
} from '../../contract.js';
import type { RolesDecl, SystemTokens, ThemeInput, TokensInput } from '../../tokens.js';
import { STRUCTURAL_FALLBACKS, resolveSystemTokens } from '../shared.js';

/**
 * Re-exported from `../shared.ts`, where the structural fallbacks moved once
 * the static contrast matrix needed the same table the lynx tokens emit
 * first inside `.zx-root` (#403). Same values, one home.
 */
export { STRUCTURAL_FALLBACKS };
import type { LynxCapabilityReport } from './capabilities.js';
import { bakeColor, bakeColorValue, bakeSoft, hasComparisonFunction, hasUnsupportedColorFunction, LynxRuntimePropertyError, runtimePropertyIn } from './capabilities.js';
import { HOST_CLASS, themeClass } from './class-names.js';
import type { LynxThemeColors } from './recipe-css.js';

/* eslint-disable @typescript-eslint/no-explicit-any -- same variance erasure
   as the web emitter: `R` appears in both positions. */
type AnyTheme = ThemeInput<any, any>;

const color = (theme: AnyTheme, token: string): string | undefined =>
    (theme.colors as Record<string, string>)[token];

const customProp = (name: string): string => (name.startsWith('--') ? name : `--${name}`);

const TEXT_PREFIX = '--text-';
const isScalableText = (prop: string): boolean =>
    prop.startsWith(TEXT_PREFIX) && !prop.startsWith(TEXT_FIXED_PREFIX);

/** `var(--anything)` with an optional fallback, for the substitution pass. */
const VAR_REF = /var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,\s*([^()]*))?\)/;

/**
 * Substitute non-color `var()` references with the literal values the same
 * property map resolves them to, to a fixpoint. Color references stay —
 * single-level color `var()` is lynx-proven and theme-live. A reference to a
 * property the map does not define keeps its fallback if it has one, else
 * survives verbatim and is reported: it may resolve against an app-provided
 * inline variable, but nothing here can prove it.
 */
function inlineNonColorVars(
    props: Record<string, string>,
    where: string,
    report: LynxCapabilityReport,
): Record<string, string> {
    const out: Record<string, string> = { ...props };
    for (const prop of Object.keys(out)) {
        let value = out[prop]!;
        for (let hops = 0; hops < 16; hops++) {
            const match = VAR_REF.exec(value);
            if (!match || match[1]!.startsWith('--color-')) break;
            const [whole, ref, fallback] = match;
            const resolved = out[ref!] ?? props[ref!] ?? fallback;
            if (resolved === undefined) break;
            value = value.replace(whole, resolved.trim());
        }
        const leftover = VAR_REF.exec(value);
        if (leftover && !leftover[1]!.startsWith('--color-')) {
            report.dropped.push({
                where,
                what: `${prop}: ${props[prop]!}`,
                detail: `references ${leftover[1]!}, which nothing in the token source defines — kept verbatim, but var() indirection beyond color tokens is unproven on lynx`,
            });
        }
        out[prop] = value;
    }
    return out;
}

/**
 * Bake one theme's full color map: roles, `-content` counterparts, base
 * surfaces, then soft tints (explicit values baked, derived ones mixed in
 * oklab against this theme's own `base-100` at its `softMix`). Returned as a
 * token → literal map because two consumers need it: the emitted
 * declarations, and `bakeColorValue`, which resolves `var(--color-*)` inside
 * color functions against exactly this map.
 */
function bakedColors(
    theme: AnyTheme,
    roles: RolesDecl,
    where: string,
    report: LynxCapabilityReport,
): Record<string, string> {
    const out: Record<string, string> = {};
    const mix = theme.softMix ?? 0.16;

    const push = (token: string) => {
        const value = color(theme, token);
        if (value) out[token] = bakeColor(value, where);
    };
    for (const [name, decl] of Object.entries(roles)) {
        push(name);
        if (decl.content !== false) push(`${name}-content`);
    }
    for (const token of BASE_SURFACE_TOKEN_LIST) push(token);
    for (const [name, decl] of Object.entries(roles)) {
        if (decl.soft === false) continue;
        const explicit = color(theme, `${name}-soft`);
        if (explicit) {
            out[`${name}-soft`] = bakeColor(explicit, where);
            continue;
        }
        const role = color(theme, name);
        const base = color(theme, 'base-100');
        if (!role || !base) {
            report.dropped.push({
                where,
                what: `--color-${name}-soft`,
                detail: `derived soft tints need both the role and base-100 in this theme; ${role ? 'base-100' : `"${name}"`} is missing, so no soft value is emitted`,
            });
            continue;
        }
        out[`${name}-soft`] = bakeSoft(role, base, mix, where);
    }
    return out;
}

/**
 * Every non-color property one theme resolves to, baked for lynx: category
 * tiers, the theme's own `custom`/`extra`, unproven `var()` chains inlined,
 * color functions in values baked, `--text-fixed-*` materialized as the
 * ramp's literals.
 */
function bakedNonColor(
    input: TokensInput<any, any>,
    theme: AnyTheme,
    themeColors: Record<string, string>,
    where: string,
    report: LynxCapabilityReport,
): Record<string, string> {
    const resolved: Record<string, string> = {
        ...resolveSystemTokens(
            input.system,
            theme.colorScheme === 'dark' ? input.systemDark : undefined,
            theme.system,
        ),
    };
    for (const [name, value] of Object.entries(theme.custom ?? {})) resolved[customProp(name)] = value;
    for (const [name, value] of Object.entries(theme.extra ?? {})) resolved[customProp(name)] = value;

    const inlined = inlineNonColorVars(resolved, where, report);

    for (const [prop, value] of Object.entries(inlined)) {
        const runtime = runtimePropertyIn(`${prop} ${value}`);
        if (runtime) {
            throw new LynxRuntimePropertyError(
                `[zero-kit] ${where}: "${prop}" references ${runtime}, a web-runtime-published property with no lynx equivalent — move it into a web-only section`,
                runtime,
            );
        }
        if (hasComparisonFunction(value)) {
            // Same verdict as the recipe emitter: lynx does not implement
            // min()/max()/clamp(), so a token declared with one would be
            // dropped on device and every reference to it would then resolve
            // to nothing. Dropping it here is what makes that visible — and
            // what `assertNoDanglingVars` turns into a build failure if
            // anything still reads it.
            report.dropped.push({
                where,
                what: `${prop}: ${value}`,
                detail: 'min()/max()/clamp() are not implemented by lynx\'s engine — dropped; declare a literal for this target instead',
            });
            delete inlined[prop];
            continue;
        }
        if (/\bcurrentcolor\b/i.test(value)) {
            // Same verdict as the recipe emitter: currentColor never resolves
            // on device (signalxjs/lynx#1079), so a token carrying it would
            // make every consuming declaration silently paint nothing.
            report.dropped.push({
                where,
                what: `${prop}: ${value}`,
                detail: 'currentColor never resolves on lynx (measured on device on both platforms, signalxjs/lynx#1079) — dropped; declare a concrete ink for this target instead',
            });
            delete inlined[prop];
            continue;
        }
        if (hasUnsupportedColorFunction(value)) {
            // A color function anywhere in the value — a whole-value accent
            // spelled in oklch, or one EMBEDDED in a shadow/border shorthand —
            // bakes per theme against this theme's own colors (legal because
            // every theme block is a full restatement). What cannot be
            // resolved throws: the author wrote paint, and silence would ship
            // a stylesheet that quietly never renders it.
            inlined[prop] = bakeColorValue(value, themeColors, theme.colorScheme, `${where} ("${prop}")`);
        }
    }

    // Materialize the fixed-text aliases last, from the final literal ramp.
    for (const prop of Object.keys(inlined)) {
        if (!isScalableText(prop)) continue;
        const alias = `${TEXT_FIXED_PREFIX}${prop.slice(TEXT_PREFIX.length)}`;
        if (!(alias in inlined)) inlined[alias] = inlined[prop]!;
    }
    return inlined;
}

const block = (selector: string, decls: string[]): string =>
    `${selector} {\n${decls.map((d) => `    ${d}`).join('\n')}\n}`;


/**
 * The per-theme literal color maps, for the recipe emitter's per-theme
 * restatements. Same baking as the token blocks — deliberately the same
 * function, so a recipe declaration and a token declaration can never
 * disagree about what `var(--color-primary)` means in a given theme.
 *
 * Reports go to a throwaway report: whatever `bakedColors` would record here
 * it already recorded while emitting `tokens.css`, and counting it twice
 * would inflate the capability summary.
 */
export function lynxThemeColors<R extends RolesDecl, T extends SystemTokens>(
    input: TokensInput<R, T>,
): LynxThemeColors[] {
    const roles = resolveRoles(input.roles);
    const throwaway: LynxCapabilityReport = { translated: [], dropped: [] };
    return Object.entries(input.themes).map(([name, theme]) => ({
        name,
        colorScheme: (theme as AnyTheme).colorScheme,
        isDefault: name === input.defaultLight,
        colors: bakedColors(theme as AnyTheme, roles, `lynx tokens, theme "${name}"`, throwaway),
    }));
}

/** Compile a `TokensInput` to the design system's lynx `tokens.css`. */
export function compileLynxTokensCss<R extends RolesDecl, T extends SystemTokens>(
    input: TokensInput<R, T>,
    report: LynxCapabilityReport,
): string {
    const roles = resolveRoles(input.roles);
    const light = input.themes[input.defaultLight];
    if (!light) throw new Error(`[zero-kit] defaultLight theme "${input.defaultLight}" is not in themes`);

    const themeDecls = (name: string, theme: AnyTheme): string[] => {
        const where = `lynx tokens, theme "${name}"`;
        const colors = bakedColors(theme, roles, where, report);
        const nonColor = bakedNonColor(input, theme, colors, where, report);
        return [
            ...Object.entries(colors).map(([token, value]) => `--color-${token}: ${value};`),
            ...Object.entries(nonColor).map(([prop, value]) => `${prop}: ${value};`),
        ];
    };

    // `.zx-root` carries the default light theme so an app that never picks a
    // theme still paints; every theme (the default ones included) also gets
    // its own full block, because explicit selection must not depend on which
    // theme happened to be the default.
    // Fallbacks first inside the block, so a design system's own value for the
    // same property overrides by source order. `--text-fixed-*` is deliberately
    // NOT among them: on this target the fixed aliases are materialized as the
    // scalable ramp's literals per theme, and a fallback alias pointing at
    // `var(--text-*)` would be indirection the font scaler can still move.
    const fallbackDecls = Object.entries(STRUCTURAL_FALLBACKS)
        .map(([prop, value]) => `${prop}: ${value};`);
    const blocks: string[] = [
        block(`.${HOST_CLASS}`, [...fallbackDecls, ...themeDecls(input.defaultLight, light)]),
    ];
    for (const [name, theme] of Object.entries(input.themes)) {
        // The name is interpolated into a class selector — the same injection
        // surface as the web's [data-theme="…"] attribute.
        if (!TOKEN_KEY_PATTERN.test(name)) {
            throw new Error(
                `[zero-kit] theme "${name}" is not a kebab-case identifier — it becomes the selector .${themeClass(name)}`,
            );
        }
        blocks.push(block(`.${HOST_CLASS}.${themeClass(name)}`, themeDecls(name, theme)));
    }

    // What the web emits and this target deliberately does not, recorded once
    // per compile so report readers see decisions rather than gaps.
    report.translated.push({
        where: 'lynx tokens',
        what: '@property registrations, @layer, light-dark()/prefers-color-scheme',
        detail: 'omitted: colors are baked per theme block and switching is a class swap, so there is nothing left for them to do',
    });
    if (blocks.some((b) => b.includes('--duration-'))) {
        report.dropped.push({
            where: 'lynx tokens',
            what: 'prefers-reduced-motion duration collapse',
            detail: 'no @media on this target by default — the runtime theme provider owns reduced-motion handling',
        });
    }

    return `${blocks.join('\n\n')}\n`;
}
