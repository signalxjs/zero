/**
 * Design-system validation — the check half of the AI-generate → validate →
 * iterate loop.
 *
 * - Role declaration: names are kebab-case identifiers outside the reserved
 *   `base-*` namespace; custom-token names stay outside `--color-*` and
 *   outside every token category's namespace.
 * - Token categories: declared keys are spellable as custom properties, and
 *   a `systemDark` / per-theme override only names keys the design system
 *   declared. Absence of a category is never an error — `css/base.css` ships
 *   fallbacks for the recommended keys.
 * - Token completeness: every declared role (+ `-content` where declared),
 *   every base surface, and every declared custom token present per theme;
 *   colors parseable. Color keys a theme defines but the DS never declared
 *   are errors — declare the role or drop the value.
 * - Contrast: WCAG ratio on every declared `role` / `role-content` pair and
 *   the base pairs (error < 3:1, warning < 4.5:1).
 * - Recipe coverage: recipes only touch known components/parts/states
 *   (compile already hard-errors); every declared machine state of a styled
 *   part is addressed or explicitly listed in `skipStates`.
 */
import { converter, parse, wcagContrast } from 'culori';
import type { ZeroManifest } from '../contract.js';
import { badAxisValue } from './messages.js';
import {
    BASE_SURFACE_TOKEN_LIST,
    BASE_BREAKPOINT_KEY,
    RESERVED_AXES,
    RESERVED_ROLE_NAMES,
    TOKEN_CATEGORIES,
    AXIS_VALUE_PATTERN,
    TOKEN_KEY_PATTERN,
    VARIANT_AXES,
    systemNodeAt,
    tokenProperty,
    ROLE_NAME_PATTERN,
    contrastPairs,
    requiredColorTokens,
    resolveRoles,
    resolveSizes,
} from '../contract.js';
import type { RolesDecl } from '../tokens.js';
import { validateApi } from '../api.js';
import { BUILTIN_CONDITIONS, resolveRecipeForTarget } from '../recipes.js';
import type { DesignSystemInput } from '../design-system.js';
import { compileDesignSystem } from '../design-system.js';
import { validateRecipes } from './validate-recipes.js';
import { tokenVocabulary } from './vocabulary.js';
import { formatOklch, solveContentLightness } from '../palette.js';

export interface ValidationIssue {
    level: 'error' | 'warning';
    where: string;
    message: string;
    /**
     * A stable id for the rule that raised the issue — for tooling that
     * counts or filters by rule (an iteration log, a score). Rules gain ids
     * as they need them; absence means the rule has none yet.
     */
    rule?: string;
    /**
     * The anatomy scope the issue is about, when it is about one. A
     * structured field rather than something to be recovered from `where`,
     * which stays a display string.
     */
    scope?: string;
    /**
     * The ecosystem package that owns `scope`, when a discovered pack does.
     * Filled in after the fact by `attributeIssues`, from the merged
     * manifest's provenance — so a design-system author reading a diagnostic
     * about a recipe they did not write can see whose it is.
     */
    package?: string;
    /**
     * A concrete replacement the rule can vouch for: paste `value` in as
     * the theme's `token` and this issue goes away. Only rules that can
     * compute a fix carry it; the message repeats it in prose.
     */
    suggest?: { token: string; value: string };
}

/** WCAG AA for text — the floor a suggested content colour must clear. */
const CONTRAST_AA = 4.5;

const toOklch = converter('oklch');

/**
 * The nearest value for `fg` that reaches `floor` against `bg` — hue and
 * chroma kept, lightness moved by `solveContentLightness` — formatted the
 * way the briefs spell colours, or `null` when no lightness reaches the
 * floor from either side (a mid-grey `bg`; at 4.5:1 that cannot happen,
 * since black or white always clears it, but at 7:1 it can). Both inputs
 * are any CSS colour culori can parse.
 */
export function suggestContrastFix(bg: string, fg: string, floor: number): string | null {
    const b = toOklch(bg);
    const f = toOklch(fg);
    if (!b || !f) return null;
    const solved = solveContentLightness({ l: f.l, c: f.c, h: f.h ?? 0 }, { l: b.l, c: b.c, h: b.h ?? 0 }, floor);
    return solved ? formatOklch(solved) : null;
}

export interface ValidationResult {
    ok: boolean;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
}

const FUNCTION_HEAD = /^\s*(?:var|calc|clamp|min|max|env|attr)\(/i;

/**
 * True when the value is ENTIRELY one CSS function call.
 *
 * A prefix test isn't enough in either direction: `150 var(--x)` must not
 * pass, and neither must `var(--x)junk` — both are invalid values CSS drops
 * silently, which is exactly what this validation exists to catch. So the
 * parens are balanced and the close has to land at the end of the string.
 */
function isWhollyFunctional(text: string): boolean {
    const head = FUNCTION_HEAD.exec(text);
    if (!head) return false;
    let depth = 0;
    for (let i = head[0].length - 1; i < text.length; i++) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')' && --depth === 0) return text.slice(i + 1).trim() === '';
    }
    return false; // unbalanced — not a value we can vouch for
}
const TIME_VALUE = /^[+-]?(?:\d+\.?\d*|\.\d+)m?s$/i;
const NUMBER_VALUE = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

/** Same shape as the recipe layer's walk: a captured `(,)?` marks a fallback. */
const VAR_REF = /var\(\s*(--[A-Za-z0-9_-]+)\s*(,)?/g;

/**
 * Check a declared value against its category's grammar, for the grammars
 * where getting it wrong fails silently rather than loudly.
 *
 * `<time>`: CSS ignores a unitless `150`, so a mistyped duration doesn't
 * error — the transition simply never runs and `transitionend` never fires.
 *
 * `<number>`: a unit here is dropped the same way. `font-weight: 700px` and a
 * `line-height` carrying a unit both misbehave silently rather than erroring.
 *
 * `<length>` is deliberately NOT checked: `0`, percentages, `em`-relative and
 * functional values are all legitimate, and the false-positive risk outweighs
 * the benefit — a rule that flags correct values gets switched off.
 */
function badValue(syntax: string, value: unknown): string | undefined {
    const text = String(value);
    if (isWhollyFunctional(text)) return undefined;

    if (syntax === '<time>' && !TIME_VALUE.test(text)) {
        return `"${text}" is not a valid <time> — CSS ignores a unitless duration, so this transition would never run (use "${text}ms" or "${text}s")`;
    }
    if (syntax === '<number>' && !NUMBER_VALUE.test(text)) {
        // A unit here is silently dropped the same way: `font-weight: 600px`
        // and `line-height` with a unit both misbehave rather than error.
        return `"${text}" is not a valid <number> — this token is unitless (a weight, a multiplier or an opacity)`;
    }
    return undefined;
}

export function validateDesignSystem<R extends RolesDecl>(
    ds: DesignSystemInput<R>,
    manifest: Pick<ZeroManifest, 'components'>,
): ValidationResult {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const error = (where: string, message: string) => errors.push({ level: 'error', where, message });
    const warn = (where: string, message: string) => warnings.push({ level: 'warning', where, message });

    // ── Role + custom-token declarations ──
    const roles = resolveRoles(ds.tokens.roles);
    for (const name of Object.keys(roles)) {
        if (!ROLE_NAME_PATTERN.test(name)) {
            error('tokens.roles', `role "${name}" is not a kebab-case identifier`);
        }
        if (name === 'base' || name.startsWith('base-')) {
            error('tokens.roles', `role "${name}" uses the reserved base-* namespace (the base surfaces are fixed, not declarable roles)`);
        }
        if (RESERVED_ROLE_NAMES.has(name)) {
            error('tokens.roles', `role "${name}" is a CSS keyword — resolveColorToken would never resolve it to var(--color-${name})`);
        }
    }
    // A role emits `--color-<role>` plus `-content`/`-soft` per its
    // declaration, so two roles can quietly emit the same property: role
    // "danger-soft" lands on `--color-danger-soft`, which is exactly what role
    // "danger" derives. Both are written into the same block, the later one
    // wins, and nothing says so. Same rule `tokens.custom` already gets — and
    // not hypothetical: `danger-soft` is a real HeroUI v3 variant name.
    const emittedByRole = new Map<string, string>();
    for (const [name, decl] of Object.entries(roles)) {
        const props = [`--color-${name}`];
        if (decl.content !== false) props.push(`--color-${name}-content`);
        if (decl.soft !== false) props.push(`--color-${name}-soft`);
        for (const prop of props) {
            const clash = emittedByRole.get(prop);
            if (clash !== undefined && clash !== name) {
                error(
                    'tokens.roles',
                    `roles "${clash}" and "${name}" both emit ${prop} — rename one, ` +
                    'or opt the deriving role out with `soft: false` / `content: false`',
                );
            } else {
                emittedByRole.set(prop, name);
            }
        }
    }
    // Custom names may be spelled with or without the leading `--` — compare
    // through the normalized property name everywhere.
    const normProp = (name: string) => (name.startsWith('--') ? name : `--${name}`);
    const customDecls = ds.tokens.custom ?? {};
    const declaredCustom = new Map<string, string>();
    for (const name of Object.keys(customDecls)) {
        const prop = normProp(name);
        // The name becomes a custom property spelled verbatim — `--My Token:`
        // is emitted and then silently dropped by the browser, so the grammar
        // every other declared name obeys applies here too.
        if (!TOKEN_KEY_PATTERN.test(prop.slice(2))) {
            error('tokens.custom', `custom token "${name}" is not a kebab-case identifier (it becomes the custom property ${prop})`);
        }
        if (prop.startsWith('--color-')) {
            error('tokens.custom', `custom token "${name}" is inside the --color-* namespace — declare a role instead`);
        }
        // Same rule for every token category: a custom token that lands in a
        // category's namespace would be invisible to anything reasoning about
        // that category, so declare it under `system` instead.
        for (const category of TOKEN_CATEGORIES) {
            const collides = category.shape === 'scalar'
                ? prop === category.prefix
                : prop.startsWith(category.prefix);
            if (collides) {
                error(
                    'tokens.custom',
                    `custom token "${name}" is inside the ${category.prefix}* namespace — declare it under system.${category.path.join('.')} instead`,
                );
            }
        }
        const clash = declaredCustom.get(prop);
        if (clash) {
            error('tokens.custom', `custom tokens "${clash}" and "${name}" both emit ${prop} — declare one spelling`);
        } else {
            declaredCustom.set(prop, name);
        }
    }

    // ── Token categories ──
    // Absence is never an error: `css/base.css` ships fallbacks for every
    // recommended key, so a design system that declares no spacing (or no
    // categories at all) still resolves. What IS checked is that declared
    // keys can be spelled as custom properties, and that a per-theme override
    // names a key the design system actually declared — the runtime mirror of
    // the type error, since `validate` runs against compiled JS.
    const isKeyMap = (node: unknown): node is Record<string, unknown> =>
        typeof node === 'object' && node !== null && !Array.isArray(node);
    const categoryKeys = (node: unknown): string[] => (isKeyMap(node) ? Object.keys(node) : []);

    const declaredSystem = ds.tokens.system;

    /**
     * A key under `system` that matches no category is silently ignored by
     * the compiler — the values simply never appear, with nothing to say why.
     * That is how a stale doc cost a whole type ramp once, so it is an error
     * with a suggestion rather than a shrug.
     */
    const categoryRoots = new Set<string>(TOKEN_CATEGORIES.map((c) => c.path[0]!));
    // A nested category is plausibly reached for by two names other than its
    // real path: its category id (`text` — what `typography.sizes` was called
    // before it moved) and its leaf path segment (`sizes`). Both are unique
    // across the table today.
    const nestedAliases = new Map<string, readonly string[]>();
    for (const category of TOKEN_CATEGORIES) {
        if (category.path.length > 1) {
            nestedAliases.set(category.id, category.path);
            nestedAliases.set(category.path[category.path.length - 1]!, category.path);
        }
    }
    const checkSystemKeys = (where: string, source: unknown) => {
        if (!isKeyMap(source)) return;
        for (const key of Object.keys(source)) {
            if (categoryRoots.has(key)) continue;
            // The likely mistakes are naming a nested category by its id or
            // by its leaf, so say where the category actually lives.
            const nested = nestedAliases.get(key);
            const hint = nested ? ` — did you mean "${nested.join('.')}"?` : '';
            error(
                where,
                `"${key}" is not a token category (${[...categoryRoots].join(', ')}), so it is ignored${hint}`,
            );
        }
    };
    checkSystemKeys('tokens.system', declaredSystem);
    checkSystemKeys('tokens.systemDark', ds.tokens.systemDark);
    for (const category of TOKEN_CATEGORIES) {
        if (category.shape === 'scalar') continue;
        const path = category.path.join('.');
        const node = systemNodeAt(declaredSystem, category.path);
        if (node !== undefined && !isKeyMap(node)) {
            // Emission would otherwise spread a string into `--radius-0`,
            // `--radius-1`, … or silently drop it.
            error(
                `tokens.system.${path}`,
                `must be an object of key → value for the ${category.prefix}* category, got ${typeof node}`,
            );
            continue;
        }
        for (const [key, value] of Object.entries((node ?? {}) as Record<string, unknown>)) {
            if (!TOKEN_KEY_PATTERN.test(key)) {
                error(
                    `tokens.system.${path}`,
                    `key "${key}" is not a kebab-case identifier (it becomes ${category.prefix}${key})`,
                );
            }
            const bad = badValue(category.syntax, value);
            if (bad) error(`tokens.system.${path}`, `"${key}": ${bad}`);
        }
    }

    /**
     * An override may only touch values the design system declares.
     *
     * Beyond catching typos, this is what keeps scheme-divergence resettable:
     * a value that exists only under dark has no light counterpart for a
     * theme block to restate, so explicitly selecting a light theme while the
     * OS is dark could never override the `prefers-color-scheme` block.
     */
    const checkOverride = (where: string, source: unknown) => {
        if (!source) return;
        // `typography.scale` mints new `--text-*` keys, so it is a declaration
        // and belongs in `tokens.system`. `ThemeSystem` has no such field;
        // this is the runtime half, since `validate` sees compiled JS.
        if (systemNodeAt(source, ['typography', 'scale']) !== undefined) {
            error(
                `${where}.typography`,
                'declares a `scale` — a modular scale mints new --text-* keys, so it belongs in ' +
                'tokens.system.typography. Override individual steps with `sizes` instead',
            );
        }
        for (const category of TOKEN_CATEGORIES) {
            const path = category.path.join('.');
            const declaredNode = systemNodeAt(declaredSystem, category.path);
            const overrideNode = systemNodeAt(source, category.path);
            if (category.shape === 'scalar') {
                if (overrideNode !== undefined && declaredNode === undefined) {
                    error(
                        `${where}.${path}`,
                        `overrides "${path}", which the design system never declares in tokens.system.${path} — declare a base value there first`,
                    );
                }
                // An override is a declaration site for the VALUE even when it
                // isn't one for the key, so it needs the same value check.
                const bad = overrideNode === undefined
                    ? undefined
                    : badValue(category.syntax, overrideNode);
                if (bad) error(`${where}.${path}`, bad);
                continue;
            }
            const declared = new Set(categoryKeys(declaredNode));
            for (const [key, value] of Object.entries((overrideNode ?? {}) as Record<string, unknown>)) {
                if (!declared.has(key)) {
                    error(
                        `${where}.${path}`,
                        `overrides "${key}", which the design system never declares in tokens.system.${path} — declare a base value there first`,
                    );
                }
                const bad = badValue(category.syntax, value);
                if (bad) error(`${where}.${path}`, `"${key}": ${bad}`);
            }
        }
    };
    checkOverride('tokens.systemDark', ds.tokens.systemDark);


    // ── Token completeness + contrast, per theme ──
    const required = requiredColorTokens(roles);
    const declared = new Set<string>([
        ...required,
        ...Object.entries(roles).flatMap(([name, decl]) => (decl.soft === false ? [] : [`${name}-soft`])),
    ]);
    const pairs = contrastPairs(roles);
    for (const [themeName, theme] of Object.entries(ds.tokens.themes)) {
        // compileTokensCss throws on the same input; this is where an author
        // gets told, with all the other issues.
        if (!TOKEN_KEY_PATTERN.test(themeName)) {
            error(
                `themes.${themeName}`,
                `theme "${themeName}" is not a kebab-case identifier — it becomes the selector [data-theme="${themeName}"]`,
            );
        }
        checkOverride(`themes.${themeName}.system`, theme.system);
        checkSystemKeys(`themes.${themeName}.system`, theme.system);
        const colors = theme.colors as Record<string, string>;
        for (const token of required) {
            const value = colors[token];
            if (!value) {
                error(`themes.${themeName}`, `missing color token "${token}" (declared by the design system)`);
            } else if (!parse(value)) {
                error(`themes.${themeName}`, `color token "${token}" is not a parseable color: "${value}"`);
            }
        }
        for (const token of Object.keys(colors)) {
            if (!declared.has(token)) {
                error(`themes.${themeName}`, `color token "${token}" is not in the declared vocabulary — add it to tokens.roles or remove it`);
            }
        }
        for (const [bg, fg] of pairs) {
            const a = colors[bg];
            const b = colors[fg];
            if (!a || !b || !parse(a) || !parse(b)) continue;
            const ratio = wcagContrast(a, b);
            if (ratio >= CONTRAST_AA) continue;
            // The fix is solved at AA even for the 3:1 error tier: a value
            // that only just clears 3:1 would come straight back as the
            // warning on the next run, which is not a fix an author can
            // paste and move on from.
            const level = ratio < 3 ? 'error' : 'warning';
            const said = `contrast ${bg} vs ${fg} is ${ratio.toFixed(2)}:1 (${ratio < 3 ? '< 3:1' : `< ${CONTRAST_AA}:1 AA`})`;
            const value = suggestContrastFix(a, b, CONTRAST_AA);
            const issue: ValidationIssue = value
                ? {
                    level,
                    where: `themes.${themeName}`,
                    message: `${said} — suggest ${fg}: ${value}`,
                    rule: 'contrast-floor',
                    suggest: { token: fg, value },
                }
                : {
                    level,
                    where: `themes.${themeName}`,
                    message: `${said} — no ${fg} lightness reaches ${CONTRAST_AA}:1 against ${bg}; move ${bg}'s lightness instead`,
                    rule: 'contrast-floor',
                };
            (level === 'error' ? errors : warnings).push(issue);
        }
        const themeCustom = new Set(Object.keys(theme.custom ?? {}).map(normProp));
        for (const name of Object.keys(customDecls)) {
            if (!themeCustom.has(normProp(name))) {
                error(`themes.${themeName}`, `missing value for declared custom token "${name}"`);
            }
        }
        for (const name of Object.keys(theme.custom ?? {})) {
            if (!declaredCustom.has(normProp(name))) {
                error(`themes.${themeName}`, `custom token "${name}" is not declared in tokens.custom`);
            }
        }
        if (theme.extra && Object.keys(theme.extra).length > 0) {
            warn(`themes.${themeName}`, `uses ${Object.keys(theme.extra).length} undeclared extra token(s) — declare them in tokens.custom so they surface in the manifest`);
            // Escape hatch or not, an extra's NAME is still emitted as a
            // custom property verbatim — the same silent-drop trap as
            // `tokens.custom`, checked with the same grammar.
            for (const name of Object.keys(theme.extra)) {
                if (!TOKEN_KEY_PATTERN.test(normProp(name).slice(2))) {
                    error(`themes.${themeName}.extra`, `extra token "${name}" is not a kebab-case identifier (it becomes the custom property ${normProp(name)})`);
                }
            }
        }
        if (theme.pair && !ds.tokens.themes[theme.pair]) {
            error(`themes.${themeName}`, `pair "${theme.pair}" is not a defined theme`);
        }
    }
    if (!ds.tokens.themes[ds.tokens.defaultLight]) {
        error('tokens', `defaultLight "${ds.tokens.defaultLight}" is not a defined theme`);
    }
    if (ds.tokens.defaultDark && !ds.tokens.themes[ds.tokens.defaultDark]) {
        error('tokens', `defaultDark "${ds.tokens.defaultDark}" is not a defined theme`);
    }
    for (const name of ds.tokens.swatch ?? []) {
        if (!roles[name] && !(BASE_SURFACE_TOKEN_LIST as readonly string[]).includes(name)) {
            error('tokens.swatch', `swatch entry "${name}" is not a declared role or base surface`);
        }
    }

    // ── Sizes ──
    // A declared size becomes the value in `[data-size="…"]` (and the tail of
    // a lynx class), so the open vocabulary stops at what those carry
    // verbatim — `AXIS_VALUE_PATTERN`, the value grammar, not the token-key
    // one: `tokens.sizes` is pure axis vocabulary (the `--size-*` tokens come
    // from `system.size`, a separate scale). Caught at the declaration rather
    // than only where a recipe uses it.
    //
    // `sizes: []` is legal and means "this design system has no size axis" —
    // the same claim `roles: {}` already makes about colour. Omitting `sizes`
    // still takes the recommended ramp, so the two are not the same statement:
    // absence means "I didn't say", empty means "there isn't one". Without
    // this the manifest advertises a ramp to the docs site and the generation
    // skill for a design system that has none.
    const sizes = ds.tokens.sizes;
    if (sizes) {
        for (const size of sizes) {
            if (!AXIS_VALUE_PATTERN.test(size)) {
                error('tokens.sizes', badAxisValue(size));
            }
        }
        if (new Set(sizes).size !== sizes.length) {
            error('tokens.sizes', 'contains duplicate entries');
        }
    }

    // ── Variant axis vocabularies ──
    // Same rules as sizes: a declared value becomes the value in
    // `[data-variant="…"]` / `[data-<axis>="…"]` and the tail of a lynx
    // class, so the value grammar applies, caught at the declaration. Axis
    // and modifier NAMES take the token-key grammar instead — they become
    // `data-<axis>` / `data-mod-<name>` — and axis names additionally must
    // not re-declare an axis that has a named prop and must not take a name
    // the anatomy contract owns: the zero runtime throws on both, and the
    // validator must reject exactly what the runtime refuses to render.
    //
    // `empty` is the load-bearing option. For the named axes (`sizes`,
    // `variants`) an empty list is the claim "this design system has no such
    // axis" — the same statement `roles: {}` makes about colour (#200/#295) —
    // and the omission means "I didn't say": `sizes` then takes the
    // recommended ramp, `variants` stays undeclared and unchecked (it has no
    // recommended vocabulary, which is why the compiled form carries
    // `variantsDeclared`). A custom axis in `tokens.axes` has no named prop to
    // switch off, so `[]` there says nothing an omission doesn't and stays an
    // error. Per scope, empty is always the claim.
    const checkAxisValues = (
        where: string,
        values: readonly string[],
        opts: { empty: 'error' | 'means-none' } = { empty: 'error' },
    ): void => {
        if (values.length === 0 && opts.empty === 'error') {
            error(where, 'declared but empty — omit it to leave the vocabulary undeclared');
        }
        for (const value of values) {
            if (!AXIS_VALUE_PATTERN.test(value)) {
                error(where, badAxisValue(value));
            }
        }
        if (new Set(values).size !== values.length) {
            error(where, 'contains duplicate entries');
        }
    };
    // NAMES: the same shape checks, under the token-key grammar. Split from
    // `checkAxisValues` so the two grammars cannot drift back into one — the
    // value grammar is wider on purpose (#198).
    const checkAxisNames = (
        where: string,
        names: readonly string[],
        opts: { empty: 'error' | 'means-none' } = { empty: 'error' },
    ): void => {
        if (names.length === 0 && opts.empty === 'error') {
            error(where, 'declared but empty — omit it to leave the vocabulary undeclared');
        }
        for (const name of names) {
            if (!TOKEN_KEY_PATTERN.test(name)) {
                error(where, `"${name}" is not a kebab-case identifier — it becomes the tail of data-mod-${name}`);
            }
        }
        if (new Set(names).size !== names.length) {
            error(where, 'contains duplicate entries');
        }
    };
    // `variants: []` — no variant axis at all, the grammar `sizes: []` uses
    // (docs/architecture.md, "Declared vocabulary"). It reaches the manifest
    // (`variantsDeclared`), the report (`declaredOut`) and the register
    // artifact, where `variant` becomes `never` with the declared-out reason.
    if (ds.tokens.variants) checkAxisValues('tokens.variants', ds.tokens.variants, { empty: 'means-none' });
    // Modifier NAMES become the tail of `data-mod-<name>`. No reserved-name
    // check is needed: the prefix puts every modifier outside the anatomy
    // contract's namespace, which is the whole reason it exists.
    if (ds.tokens.modifiers) checkAxisNames('tokens.modifiers', ds.tokens.modifiers);
    for (const [axis, values] of Object.entries(ds.tokens.axes ?? {})) {
        if (!TOKEN_KEY_PATTERN.test(axis)) {
            error('tokens.axes', `"${axis}" is not a kebab-case identifier — it becomes the attribute name data-${axis}`);
        }
        if (Object.hasOwn(VARIANT_AXES, axis)) {
            error('tokens.axes', `"${axis}" already has a named prop — declare it in tokens.${axis === 'variant' ? 'variants' : axis === 'size' ? 'sizes' : 'roles'} instead`);
        }
        if (RESERVED_AXES.has(axis)) {
            error('tokens.axes', `"${axis}" is part of the anatomy contract — data-${axis} already means something, and zero refuses to set it from \`axes\``);
        }
        checkAxisValues(`tokens.axes.${axis}`, values);
    }

    // ── Per-scope axis vocabularies (#294; docs/architecture.md, "Declared vocabulary") ──
    // A scope entry NARROWS the vocabularies above for one component, which is
    // what makes the declarations above the UNION of every scope's vocabulary
    // rather than one vocabulary every scope shares. Everything here is a
    // subset rule plus the grammar the tier above already enforces — except
    // the two diagnostics at the end, which exist because the union is easy to
    // half-adopt.
    const scopeEntries = Object.entries(ds.tokens.scopes ?? {});
    if (scopeEntries.length > 0) {
        const knownScopes = manifest.components.map((c) => c.scope);
        const unions: Record<string, readonly string[] | undefined> = {
            colors: Object.keys(roles),
            sizes: resolveSizes(ds.tokens.sizes),
            variants: ds.tokens.variants,
            modifiers: ds.tokens.modifiers,
        };
        /** Where in `tokens.*` the union for a scope key is declared. */
        const unionSite: Record<string, string> = {
            colors: 'tokens.roles',
            sizes: 'tokens.sizes',
            variants: 'tokens.variants',
            modifiers: 'tokens.modifiers',
        };
        const restrictedAxes = new Map<string, Set<string>>();
        const note = (axis: string, scope: string): void => {
            let set = restrictedAxes.get(axis);
            if (!set) restrictedAxes.set(axis, (set = new Set()));
            set.add(scope);
        };

        for (const [scope, entry] of scopeEntries) {
            const where = `tokens.scopes.${scope}`;
            if (!knownScopes.includes(scope)) {
                error(where, `"${scope}" is not a component in zero's anatomy (known: ${knownScopes.join(', ')})`);
                continue;
            }
            for (const key of Object.keys(entry)) {
                if (key === 'parts') {
                    // Reserved by name, exactly as `api.components` is. The
                    // restriction unit is the SCOPE: zero carries one attribute
                    // per axis on the scope's carrier part and cascades it to
                    // every part below, so two vocabularies on two parts are
                    // two AXES, not one axis restricted twice
                    // (docs/architecture.md, "Declared vocabulary").
                    // Rejecting the key rather than ignoring it is what keeps a
                    // per-part restriction additive if one is ever wanted.
                    error(where, 'declares `parts` — the restriction unit is the scope, not the part. Two vocabularies inside one scope are two axes: declare the second one in `tokens.axes`. See docs/architecture.md, "Declared vocabulary".');
                    continue;
                }
                if (!Object.hasOwn(unions, key) && key !== 'axes') {
                    error(where, `unknown key "${key}" — a scope vocabulary declares colors, sizes, variants, axes or modifiers`);
                }
            }

            let narrows = false;
            const restrict = (key: string, values: readonly string[] | undefined): void => {
                if (values === undefined) return;
                narrows = true;
                const axis = key === 'colors' ? 'color' : key === 'sizes' ? 'size' : key === 'variants' ? 'variant' : key;
                // An EMPTY declaration is not a narrowing for the
                // half-adoption warning below. `[]` says "this scope has no
                // such axis at all" — it declares no values, so no sibling
                // can be silently offering values that were added for it.
                // Layout scopes are the case that made this visible: a Stack
                // is geometry and wires neither colour nor size, and saying
                // so must not make all fifty siblings look under-declared.
                if (values.length > 0) note(axis, scope);
                if (key === 'modifiers') checkAxisNames(`${where}.${key}`, values, { empty: 'means-none' });
                else checkAxisValues(`${where}.${key}`, values, { empty: 'means-none' });
                const union = unions[key];
                if (union === undefined) {
                    error(
                        `${where}.${key}`,
                        `restricts an axis this design system never declares — declare the union in ${unionSite[key]} first`,
                    );
                    return;
                }
                for (const value of values) {
                    if (!union.includes(value)) {
                        error(
                            `${where}.${key}`,
                            `"${value}" is not in ${unionSite[key]} — a scope vocabulary narrows the design-system-wide list, never adds to it. ${unionSite[key]} is the UNION of every scope's vocabulary, so declare "${value}" there too.`,
                        );
                    }
                }
            };
            restrict('colors', entry.colors);
            restrict('sizes', entry.sizes);
            restrict('variants', entry.variants);
            restrict('modifiers', entry.modifiers);
            for (const [axis, values] of Object.entries(entry.axes ?? {})) {
                unions[axis] = ds.tokens.axes?.[axis];
                unionSite[axis] = `tokens.axes.${axis}`;
                restrict(axis, values);
            }

            // Restating the whole union is deliberately NOT a warning: it is
            // the explicit claim "yes, this scope carries all of it", and it is
            // what keeps the coverage guard quiet once a sibling narrows. Warn
            // on it and authors delete the one line that says what they mean.
            if (!narrows) {
                warn(where, 'restricts nothing — remove the entry, or the scope reads as narrowed when it is not');
            }
        }

        // Half-adopting the union is the failure mode this whole section
        // creates: one scope declares its own vocabulary, a sibling says
        // nothing, and the sibling silently keeps offering values that were
        // added for someone else. Named here, at the declaration, rather than
        // discovered later as a coverage finding against the sibling.
        const styledScopes = [...new Set(ds.recipes.map((r) => r.component))].sort();
        /**
         * …but only a scope that actually PAINTS the axis is exposed by a
         * sibling's narrowing. One that wires no rules for it offers nothing
         * to begin with — the recipe harvest already compiles it to `never`
         * in `register.d.ts` and to an empty list in the manifest — so naming
         * it here would be reporting a exposure that does not exist.
         *
         * Found by writing the first `scopes` declaration in this repo (#311):
         * zero-basic narrows `badge`, and the warning named all twenty-nine
         * other styled scopes, twenty-eight of which wire no `variant` at all
         * (#175). A list that long reads as "you did something wrong", when
         * the one real question in it was whether `button` means to carry the
         * whole set — which it does, and now says so.
         */
        const wiresAxis = (scope: string, axis: string): boolean =>
            ds.recipes.some((r) => r.component === scope
                && Object.keys(
                    (r.variants as Record<string, Record<string, unknown>> | undefined)?.[axis] ?? {},
                ).length > 0);
        for (const [axis, scopes] of [...restrictedAxes].sort(([a], [b]) => a.localeCompare(b))) {
            const open = styledScopes.filter((scope) => !scopes.has(scope) && wiresAxis(scope, axis));
            if (open.length === 0) continue;
            warn(
                'tokens.scopes',
                `${[...scopes].sort().map((s) => `"${s}"`).join(', ')} narrow the \`${axis}\` vocabulary but ${open.map((s) => `"${s}"`).join(', ')} do not — they offer the whole union, including values declared for someone else`,
            );
        }
    }

    // ── Component API (vendor-named props) ──
    // Validated beside the vocabulary it maps: a mapping may only touch
    // declared surfaces, and every vendor prop it mints must route one-to-one
    // back onto zero's axes. The checks live in `validateApi` so a conformance
    // fixture can run them against its own vocabulary without a full design
    // system.
    if (ds.api) {
        const scopes = manifest.components.map((c) => c.scope);
        for (const issue of validateApi(ds.api, ds.tokens, { scopes })) {
            (issue.level === 'error' ? errors : warnings).push(issue);
        }
    }

    // ── Breakpoints ──
    // These become `@media (min-width: …)` preludes and the ORDER they are
    // declared in decides emission order, so a descending declaration would
    // silently make the wider breakpoint lose to the narrower one.
    const breakpoints = Object.entries(ds.tokens.breakpoints ?? {});
    let previousWidth = -Infinity;
    let unit: string | undefined;
    for (const [name, value] of breakpoints) {
        if (!TOKEN_KEY_PATTERN.test(name)) {
            error('tokens.breakpoints', `"${name}" is not a kebab-case identifier`);
        }
        if (Object.hasOwn(BUILTIN_CONDITIONS, name)) {
            error(
                'tokens.breakpoints',
                `"${name}" collides with the built-in condition of the same name — rename the breakpoint`,
            );
        }
        if (name === BASE_BREAKPOINT_KEY) {
            error(
                'tokens.breakpoints',
                `"${name}" is the key a responsive layout prop uses for its unqualified value `
                + `(gap={{ base: 'md' }} renders data-l-gap), so a breakpoint of this name could `
                + 'never be reached — rename the breakpoint',
            );
        }
        const width = /^(\d*\.?\d+)(px|rem|em)$/.exec(String(value));
        if (!width) {
            error('tokens.breakpoints', `"${name}": "${value}" is not a px/rem/em length`);
            continue;
        }
        // One unit throughout, so the ascending check below is a sound
        // comparison. Mixing them makes it meaningless in both directions:
        // `{ sm: '30rem', md: '400px' }` reads as ascending (30 < 400) while
        // 30rem is 480px at the default root size, and a rem list is anchored
        // to a root font size the design system doesn't control anyway.
        const [, magnitude, suffix] = width as unknown as [string, string, string];
        if (unit === undefined) {
            unit = suffix;
        } else if (suffix !== unit) {
            error(
                'tokens.breakpoints',
                `"${name}" is in ${suffix} but the others are in ${unit} — use one unit throughout so the ordering is comparable`,
            );
            continue;
        }
        const size = Number(magnitude);
        if (size <= previousWidth) {
            error(
                'tokens.breakpoints',
                `"${name}" (${value}) is not larger than the breakpoint before it — declare them mobile-first, ascending, since declaration order is emission order`,
            );
        }
        previousWidth = size;
    }

    // ── Token VALUES: var() references and definition cycles ──
    // The recipe layer has resolved every `var()` against the declared
    // vocabulary from the start; the token layer never did, so a typo'd
    // reference INSIDE a token value (`--shadow-md: 0 0 8px
    // var(--color-brnad)`) compiled clean and resolved to nothing at runtime.
    // Same walk, same messages, at the layer the tokens are declared.
    const vocabulary = tokenVocabulary(ds.tokens);
    /** Every token declaration site: where (for diagnostics) + prop + value. */
    const tokenDeclarations: Array<{ where: string; prop: string; value: string }> = [];
    const collectCategories = (
        where: string,
        tier: unknown,
        into?: Array<{ prop: string; value: string }>,
    ): void => {
        if (!tier) return;
        for (const category of TOKEN_CATEGORIES) {
            const node = systemNodeAt(tier, category.path);
            if (node === undefined || node === null) continue;
            const site = `${where}.${category.path.join('.')}`;
            const push = (prop: string, value: string): void => {
                tokenDeclarations.push({ where: site, prop, value });
                into?.push({ prop, value });
            };
            if (category.shape === 'scalar') {
                push(tokenProperty(category), String(node));
                continue;
            }
            if (typeof node !== 'object') continue; // already an error above
            for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
                if (value === undefined || value === null || !TOKEN_KEY_PATTERN.test(key)) continue;
                push(tokenProperty(category, key), String(value));
            }
        }
    };
    collectCategories('tokens.system', ds.tokens.system);
    collectCategories('tokens.systemDark', ds.tokens.systemDark);
    /** themeName → that theme's own definitions, for per-theme cycle detection. */
    const themeDeclarations = new Map<string, Array<{ prop: string; value: string }>>();
    for (const [themeName, theme] of Object.entries(ds.tokens.themes)) {
        const own: Array<{ prop: string; value: string }> = [];
        const collectOwn = (site: string, source: Record<string, string> | undefined): void => {
            for (const [name, value] of Object.entries(source ?? {})) {
                const decl = { where: site, prop: normProp(name), value: String(value) };
                tokenDeclarations.push(decl);
                own.push(decl);
            }
        };
        collectCategories(`themes.${themeName}.system`, theme.system, own);
        collectOwn(`themes.${themeName}.custom`, theme.custom as Record<string, string> | undefined);
        collectOwn(`themes.${themeName}.extra`, theme.extra);
        themeDeclarations.set(themeName, own);
    }

    for (const { where, value } of tokenDeclarations) {
        for (const match of value.matchAll(VAR_REF)) {
            const token = match[1]!;
            const hasFallback = Boolean(match[2]);
            if (vocabulary.names.has(token)) continue;
            const near = vocabulary.nearest(token);
            const hint = near ? ` — did you mean "${near}"?` : '';
            if (hasFallback) {
                warn(where, `references undeclared token "${token}", but has a fallback so it still renders${hint}`);
            } else {
                error(where, `references "${token}", which this design system never declares — it resolves to nothing${hint}`);
            }
        }
    }

    // ── Definition cycles ──
    // `--a: var(--b); --b: var(--a)` marks every property in the cycle
    // invalid at computed-value time — fallbacks included, per spec — so it
    // can never be what the author meant. Detected per theme (each theme is
    // one resolution context: system → systemDark → theme.system → its own
    // custom/extra values), deduped so one cycle reports once.
    const reportedCycles = new Set<string>();
    const baseDefinitions = tokenDeclarations.filter((d) => d.where.startsWith('tokens.'));
    for (const [themeName, own] of themeDeclarations) {
        const defs = new Map<string, string>();
        for (const { prop, value } of baseDefinitions) defs.set(prop, value);
        for (const { prop, value } of own) defs.set(prop, value);
        const refsOf = (prop: string): string[] =>
            [...(defs.get(prop) ?? '').matchAll(VAR_REF)].map((m) => m[1]!).filter((ref) => defs.has(ref));
        const state = new Map<string, 'visiting' | 'done'>();
        const stack: string[] = [];
        const visit = (prop: string): void => {
            state.set(prop, 'visiting');
            stack.push(prop);
            for (const ref of refsOf(prop)) {
                const seen = state.get(ref);
                if (seen === 'visiting') {
                    const cycle = [...stack.slice(stack.indexOf(ref)), ref];
                    const key = [...new Set(cycle)].sort().join(' ');
                    if (!reportedCycles.has(key)) {
                        reportedCycles.add(key);
                        error(
                            `themes.${themeName}`,
                            `custom properties reference each other in a cycle (${cycle.join(' → ')}) — CSS makes every property in a cycle invalid, fallbacks included`,
                        );
                    }
                } else if (seen === undefined) {
                    visit(ref);
                }
            }
            stack.pop();
            state.set(prop, 'done');
        };
        for (const prop of defs.keys()) if (!state.has(prop)) visit(prop);
    }

    // ── Recipes: unknown parts/states are hard compile errors — surface
    //    them as validation errors rather than throwing. ──
    try {
        compileDesignSystem(ds, manifest);
    } catch (e) {
        error('recipes', (e as Error).message);
    }

    // ── Recipe CONTENT: token references, literals, coverage ──
    // (Colour-variant role membership is checked in validateRecipes as an
    // error — a second, weaker copy of the rule here would double-report.)
    for (const issue of validateRecipes(ds.recipes.map((r) => resolveRecipeForTarget(r, 'web')), manifest, vocabulary)) {
        (issue.level === 'error' ? errors : warnings).push(issue);
    }

    // ── Recipe state coverage ──
    const byScope = new Map(manifest.components.map((c) => [c.scope, c]));
    for (const recipe of ds.recipes) {
        const component = byScope.get(recipe.component);
        if (!component) continue; // already an error above
        for (const [partName, styles] of Object.entries(recipe.parts)) {
            const part = component.parts.find((p) => p.name === partName);
            if (!part) continue; // already an error above
            const styled = new Set(Object.keys(styles.states ?? {}));
            const skipped = new Set(recipe.skipStates?.[partName] ?? []);
            for (const state of part.states ?? []) {
                if (!styled.has(state) && !skipped.has(state)) {
                    warn(
                        `recipes.${recipe.component}.${partName}`,
                        `declared state "${state}" is not styled (add it or list it in skipStates)`,
                    );
                }
            }
        }
    }

    return { ok: errors.length === 0, errors, warnings };
}
