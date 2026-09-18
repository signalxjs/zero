/**
 * Web token emitter — compiles a `TokensInput` to modern, layered CSS.
 *
 * - Soft tints are LIVE CSS (`color-mix()` driven by the theme's `softMix`),
 *   so overriding `--color-primary` re-derives `--color-primary-soft` for
 *   free. Explicit soft values still win.
 * - The default light/dark pair is additionally emitted on `:root` as
 *   `light-dark()` pairs with `color-scheme: light dark` → system-correct
 *   first paint with ZERO JavaScript.
 * - `light-dark()` is a `<color>` function, so ANY other token that differs
 *   between the default light and dark themes — a category value, a declared
 *   `custom` token, an `extra` token, a component override — is emitted in a
 *   `prefers-color-scheme: dark` block instead, and restated by every theme
 *   block so an explicit choice still wins and nested `[data-theme]` scopes
 *   don't inherit the wrong value.
 * - Declared roles (and `custom` tokens carrying a `syntax`) are registered
 *   via `@property` so theme switches can animate typed values.
 * - Everything sits in `@layer zero.tokens` behind `:where()` so app CSS
 *   always wins without specificity fights.
 */
import {
    BASE_SURFACE_TOKEN_LIST,
    LAYER_ORDER_STATEMENT,
    TEXT_FIXED_PREFIX,
    TOKEN_CATEGORIES,
    TOKEN_KEY_PATTERN,
    resolveRoles,
    systemNodeAt,
    tokenProperty,
} from '../../contract.js';
import { resolveSystemTokens } from '../shared.js';
import type { RolesDecl, SystemTokens, ThemeInput, TokensInput } from '../../tokens.js';

const softVar = (role: string, mix: number): string =>
    `color-mix(in oklab, var(--color-${role}) ${Math.round(mix * 100)}%, var(--color-base-100))`;

/* eslint-disable @typescript-eslint/no-explicit-any -- `R` appears in both
   variance positions, so internal plumbing erases it. */
type AnyTheme = ThemeInput<any, any>;
const color = (theme: AnyTheme, token: string): string | undefined =>
    (theme.colors as Record<string, string>)[token];

const customProp = (name: string): string => (name.startsWith('--') ? name : `--${name}`);

// Token-tier resolution (`resolveSystemTokens`) lives in `../shared.ts` —
// the lynx token emitter walks the identical tiers.

/** `--prop: value;` lines, optionally restricted to a subset of properties. */
function systemDecls(props: Record<string, string>, only?: ReadonlySet<string>): string[] {
    return Object.entries(props)
        .filter(([prop]) => !only || only.has(prop))
        .map(([prop, value]) => `${prop}: ${value};`);
}

/**
 * A reference to any color token — role, base surface, `-content` or `-soft`.
 * `[,)]` rather than `)` so a fallback (`var(--color-primary, red)`) counts:
 * the value still has to be substituted where the theme's colors are in scope.
 */
const COLOR_REF = /var\(\s*--color-[a-z0-9-]+\s*[,)]/;

/** Properties whose resolved value differs between the two property maps. */
function divergentProps(a: Record<string, string>, b: Record<string, string>): Set<string> {
    const out = new Set<string>();
    for (const prop of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (a[prop] !== b[prop]) out.add(prop);
    }
    return out;
}

function colorDecls(theme: AnyTheme, roles: RolesDecl): string[] {
    const decls: string[] = [];
    const mix = theme.softMix ?? 0.16;

    for (const [name, decl] of Object.entries(roles)) {
        const value = color(theme, name);
        if (value) decls.push(`--color-${name}: ${value};`);
        if (decl.content !== false) {
            const content = color(theme, `${name}-content`);
            if (content) decls.push(`--color-${name}-content: ${content};`);
        }
    }
    for (const token of BASE_SURFACE_TOKEN_LIST) {
        const value = color(theme, token);
        if (value) decls.push(`--color-${token}: ${value};`);
    }
    for (const [name, decl] of Object.entries(roles)) {
        if (decl.soft === false) continue;
        const explicit = color(theme, `${name}-soft`);
        decls.push(`--color-${name}-soft: ${explicit ?? softVar(name, mix)};`);
    }
    return decls;
}

/**
 * A theme's non-category custom properties: declared `custom` values and the
 * untyped `extra` escape hatch.
 */
function themeOwnProps(theme: AnyTheme): Record<string, string> {
    const props: Record<string, string> = {};
    for (const [name, value] of Object.entries(theme.custom ?? {})) {
        props[customProp(name)] = value;
    }
    for (const [name, value] of Object.entries(theme.extra ?? {})) {
        props[customProp(name)] = value;
    }
    return props;
}

/**
 * `:where(:root)` — the scheme-following defaults.
 *
 * Colors collapse into `light-dark()` pairs. Nothing else can:
 * `light-dark()` is a `<color>` function, so every other property emits its
 * light value here, and any that differ under dark go in the caller's
 * `prefers-color-scheme: dark` block.
 */
function rootDecls(
    light: AnyTheme,
    dark: AnyTheme | undefined,
    roles: RolesDecl,
    nonColorLight: Record<string, string>,
): string[] {
    if (!dark) {
        return [
            'color-scheme: light;',
            ...colorDecls(light, roles),
            ...systemDecls(nonColorLight),
        ];
    }
    const decls: string[] = ['color-scheme: light dark;'];
    const mix = light.softMix ?? 0.16;

    const pushPair = (token: string) => {
        const lv = color(light, token);
        const dv = color(dark, token);
        if (lv && dv && lv !== dv) decls.push(`--color-${token}: light-dark(${lv}, ${dv});`);
        else if (lv) decls.push(`--color-${token}: ${lv};`);
    };
    for (const [name, decl] of Object.entries(roles)) {
        pushPair(name);
        if (decl.content !== false) pushPair(`${name}-content`);
    }
    for (const token of BASE_SURFACE_TOKEN_LIST) pushPair(token);
    for (const [name, decl] of Object.entries(roles)) {
        if (decl.soft === false) continue;
        const le = color(light, `${name}-soft`);
        const de = color(dark, `${name}-soft`);
        if (le && de && le !== de) decls.push(`--color-${name}-soft: light-dark(${le}, ${de});`);
        else decls.push(`--color-${name}-soft: ${le ?? softVar(name, mix)};`);
    }
    decls.push(...systemDecls(nonColorLight));
    return decls;
}

/**
 * `@property` registrations for declared roles (typed, animatable theme
 * switches) and for declared custom tokens that carry a `syntax`.
 * Initial values come from the default light theme. Derivatives are not
 * registered: `-soft` values can be `color-mix()` expressions (invalid as
 * `initial-value`), and `-content` is deliberately kept off the registration
 * surface to match the role-only registration zero's base.css previously
 * shipped — roles are the tokens theme transitions animate.
 */
function propertyRegistrations(input: TokensInput<any>, roles: RolesDecl, light: AnyTheme): string[] {
    const rules: string[] = [];
    for (const name of Object.keys(roles)) {
        const initial = color(light, name);
        if (!initial) continue;
        rules.push(`@property --color-${name} { syntax: '<color>'; inherits: true; initial-value: ${initial}; }`);
    }
    // Custom names may be spelled with or without the leading `--`; compare
    // through the normalized property name so spellings can't drift apart.
    const customValues = Object.fromEntries(
        Object.entries(light.custom ?? {}).map(([n, v]) => [customProp(n), v]),
    );
    for (const [name, decl] of Object.entries(input.custom ?? {})) {
        if (!decl.syntax) continue;
        const prop = customProp(name);
        const initial = customValues[prop];
        if (!initial && decl.syntax !== '*') continue;
        rules.push(
            `@property ${prop} { syntax: '${decl.syntax}'; inherits: true;${initial ? ` initial-value: ${initial};` : ''} }`,
        );
    }
    return rules;
}

const block = (selector: string, decls: string[], indent = '    '): string =>
    `${indent}${selector} {\n${decls.map((d) => `${indent}    ${d}`).join('\n')}\n${indent}}`;

const TEXT_PREFIX = '--text-';

/** `--text-<key>` and not itself a fixed alias. */
const isScalableText = (prop: string): boolean =>
    prop.startsWith(TEXT_PREFIX) && !prop.startsWith(TEXT_FIXED_PREFIX);

/**
 * Add the contract's `--text-fixed-<key>` alias for every emitted
 * `--text-<key>` (see `TEXT_FIXED_PREFIX`). On the web the alias is pure
 * indirection — `var(--text-<key>)` — so an app override of the ramp still
 * flows through. A key the design system literally declared as `fixed-*`
 * wins over the derived alias.
 */
function withTextFixedAliases(props: Record<string, string>): Record<string, string> {
    const out = { ...props };
    for (const prop of Object.keys(props)) {
        if (!isScalableText(prop)) continue;
        const alias = `${TEXT_FIXED_PREFIX}${prop.slice(TEXT_PREFIX.length)}`;
        if (!(alias in out)) out[alias] = `var(${prop})`;
    }
    return out;
}

/**
 * Every non-color custom property a theme resolves to: the token categories
 * after all three tiers, then the theme's own `custom` / `extra` /
 * `components` values, then the derived `--text-fixed-*` aliases.
 *
 * One map, because scheme handling has to apply to all of them equally —
 * `light-dark()` only rescues colors, so anything else that differs per
 * scheme needs the `prefers-color-scheme` treatment regardless of which
 * authoring field it came from.
 */
function nonColorFor(input: TokensInput<any, any>, theme: AnyTheme): Record<string, string> {
    return withTextFixedAliases({
        ...resolveSystemTokens(
            input.system,
            theme.colorScheme === 'dark' ? input.systemDark : undefined,
            theme.system,
        ),
        ...themeOwnProps(theme),
    });
}

/**
 * Collapse every declared duration under `prefers-reduced-motion: reduce`.
 *
 * This cannot live in `@sigx/zero`'s `base.css` the way the structural
 * fallbacks do: duration KEYS are design-system-declared, so base.css can
 * only neutralize the recommended ones and would miss a DS's own
 * `--duration-emphasized-decelerate`. Same reasoning that moved `@property`
 * registration into the compiled tokens.css.
 *
 * Two details that look arbitrary and aren't:
 *
 * - `0.01ms`, not `0ms`. A zero duration suppresses `transitionend` /
 *   `animationend` entirely, and the presence/exit-animation work (#29)
 *   waits on those events to know when an overlay may close. 0.01ms is
 *   visually instant and still fires them.
 * - `:root, [data-theme]` — both branches are (0,1,0), the same specificity
 *   as a `[data-theme="x"]` block. Emitted last inside the layer, it wins the
 *   tie; `:where(:root)` at (0,0,0) would silently lose to every theme block,
 *   so reduced motion would stop working the moment a theme was selected.
 */
function reducedMotionBlock(input: TokensInput<any, any>, light: AnyTheme): string | undefined {
    const durations = TOKEN_CATEGORIES.find((c) => c.id === 'duration')!;
    const declared = new Set<string>();
    for (const tier of [input.system, input.systemDark, light.system]) {
        for (const key of Object.keys((systemNodeAt(tier, durations.path) ?? {}) as object)) {
            declared.add(tokenProperty(durations, key));
        }
    }
    for (const theme of Object.values(input.themes)) {
        for (const key of Object.keys((systemNodeAt(theme.system, durations.path) ?? {}) as object)) {
            declared.add(tokenProperty(durations, key));
        }
    }
    if (declared.size === 0) return undefined;
    const decls = [...declared].map((prop) => `${prop}: 0.01ms;`);
    return (
        `    @media (prefers-reduced-motion: reduce) {\n` +
        `${block(':root, [data-theme]', decls, '        ')}\n` +
        `    }`
    );
}

/** Compile a `TokensInput` to the design system's `tokens.css`. */
export function compileTokensCss<R extends RolesDecl, T extends SystemTokens>(
    input: TokensInput<R, T>,
): string {
    const roles = resolveRoles(input.roles);
    const light = input.themes[input.defaultLight];
    if (!light) throw new Error(`[zero-kit] defaultLight theme "${input.defaultLight}" is not in themes`);
    const dark = input.defaultDark ? input.themes[input.defaultDark] : undefined;
    if (input.defaultDark && !dark) {
        throw new Error(`[zero-kit] defaultDark theme "${input.defaultDark}" is not in themes`);
    }

    const nonColorLight = nonColorFor(input, light);
    const nonColorDark = dark ? nonColorFor(input, dark) : {};
    // Properties that resolve differently per scheme. These need the
    // `prefers-color-scheme` block below AND must be restated by every theme
    // block — otherwise a `<div data-theme="light">` nested under a
    // system-dark root would inherit the dark value, and explicitly picking a
    // light theme while the OS is dark would leave the media block winning.
    //
    // Restricted to properties the light side also defines: a dark-only value
    // has nothing for a light theme block to restate. The kit cannot write
    // base.css's fallback either — `revert-layer` skips the whole
    // `zero.tokens` layer that base.css shares — so declaring the light value
    // is the only way to make the value resettable. `validateDesignSystem`
    // says so; here the emission simply can't produce the trap.
    const schemeDivergent = dark
        ? new Set(
            [...divergentProps(nonColorLight, nonColorDark)].filter((prop) => prop in nonColorLight),
        )
        : new Set<string>();

    /**
     * Properties whose value reads a color token, which every theme block must
     * restate for the same reason — but a subtler one.
     *
     * CSS substitutes `var()` in a custom property where the property is
     * DECLARED, not where it is used. A system-tier token is declared once, at
     * `:root`, so `--shadow-md: 0 0 8px var(--color-primary)` captures the
     * `:root` primary and inherits that captured color into every
     * `[data-theme]` block — the theme redeclares the role, but nothing
     * redeclares the token built from it. Measured: a phosphor glow written
     * that way stayed green on an amber theme.
     *
     * Restating the token inside each theme block re-runs the substitution
     * there, against that theme's own colors. `:root` itself is already
     * correct: the color it reads is a `light-dark()`, which resolves per
     * element from `color-scheme`.
     *
     * (Reading an unregistered token — a base surface — happens to survive as
     * a `light-dark()` token stream, but only for a single light/dark pair.
     * Both cases are handled the same way rather than relying on that.)
     */
    const colorReferencing = new Set(
        Object.entries(nonColorLight)
            .filter(([, value]) => COLOR_REF.test(value))
            .map(([prop]) => prop),
    );

    // Specificity ladder inside `@layer zero.tokens`:
    //   `:where(:root)` defaults      → (0,0,0)
    //   `[data-theme="x"]` overrides  → (0,1,0)  — always beat the defaults
    // so an explicit theme wins regardless of source order, and a nested
    // `[data-theme]` element re-themes its subtree via inheritance. App CSS
    // is unlayered, so it still wins over everything here.
    const blocks: string[] = [block(':where(:root)', rootDecls(light, dark, roles, nonColorLight))];

    if (schemeDivergent.size > 0) {
        blocks.push(
            `    @media (prefers-color-scheme: dark) {\n` +
            `${block(':where(:root)', systemDecls(nonColorDark, schemeDivergent), '        ')}\n` +
            `    }`,
        );
    }

    for (const [name, theme] of Object.entries(input.themes)) {
        // The name is interpolated into `[data-theme="<name>"]` — the same
        // selector-injection surface the axis values guard against. A quote
        // in a theme name would close the attribute and everything after it
        // would be read as CSS.
        if (!TOKEN_KEY_PATTERN.test(name)) {
            throw new Error(
                `[zero-kit] theme "${name}" is not a kebab-case identifier — it becomes the selector [data-theme="${name}"]`,
            );
        }
        const nonColor = nonColorFor(input, theme);
        // Emit only what this theme actually changes relative to the :root
        // defaults, plus the scheme-divergent set. Everything else is
        // inherited, so restating it would be dead weight in every theme.
        const own = divergentProps(nonColor, nonColorLight);
        const emit = new Set([...own, ...schemeDivergent, ...colorReferencing]);
        // The `--text-fixed-*` aliases capture their `var()` where DECLARED,
        // exactly like the color-referencing tokens above: an alias declared
        // only at `:root` keeps `:root`'s ramp value inside a `[data-theme]`
        // scope. So any theme block that re-emits a `--text-<key>` must
        // restate that key's alias, re-running the substitution against the
        // theme's own ramp. (The `prefers-color-scheme` block needs no such
        // treatment — it redeclares the ramp on `:root` itself, where the
        // alias already lives.)
        // Iterating the set while adding is safe: an added alias never passes
        // `isScalableText`, so nothing cascades.
        for (const prop of emit) {
            if (isScalableText(prop)) emit.add(`${TEXT_FIXED_PREFIX}${prop.slice(TEXT_PREFIX.length)}`);
        }
        // A theme that doesn't define a scheme-divergent property still has to
        // state one, or under system dark it would inherit the media block's
        // value instead of the `:root` default it actually resolves to. Only
        // `extra` and `components` can land here — declared `custom` tokens are
        // required in every theme, and category values resolve from `system`.
        // Iterates the full emit set so a restated `--text-fixed-*` alias is
        // covered too when the theme itself never resolves that text key.
        const source: Record<string, string> = { ...nonColor };
        for (const prop of emit) {
            if (!(prop in source)) source[prop] = nonColorLight[prop]!;
        }
        blocks.push(block(
            `[data-theme="${name}"]`,
            [
                `color-scheme: ${theme.colorScheme};`,
                ...colorDecls(theme, roles),
                ...systemDecls(source, emit),
            ],
        ));
    }
    const reduced = reducedMotionBlock(input, light);
    if (reduced) blocks.push(reduced);

    const registrations = propertyRegistrations(input, roles, light);
    const preamble = registrations.length ? `${registrations.join('\n')}\n\n` : '';
    // The layer-order statement comes first: writing into `zero.tokens` below
    // must never be the first mention of a zero layer, or loading this file
    // before base.css puts `zero.fallback` above the design system's tokens.
    return `${LAYER_ORDER_STATEMENT}\n\n${preamble}@layer zero.tokens {\n${blocks.join('\n\n')}\n}\n`;
}
