/**
 * What a design system actually declared — the custom properties it
 * guarantees, and the vocabularies its variant axes accept.
 *
 * Recipes are checked against this rather than against hardcoded lists: it is
 * derived from the declaration, so every category added to `TOKEN_CATEGORIES`
 * starts being enforced without touching the validator, and a design system
 * with its own size ramp is checked against *its* ramp.
 */
import {
    BASE_SURFACE_TOKEN_LIST,
    MEDIUM_PROPERTIES,
    RUNTIME_PROPERTIES,
    TEXT_FIXED_PREFIX,
    TOKEN_CATEGORIES,
    resolveRoles,
    resolveSizes,
    tokenProperty,
} from '../contract.js';
import type { RolesDecl, ScopeVocabulary, TokensInput } from '../tokens.js';
import { systemNodeAt } from '../contract.js';
import { nearestOf } from './nearest.js';

/**
 * The vocabulary in force for ONE scope — the union, narrowed by that scope's
 * `tokens.scopes` entry (#294; docs/architecture.md, "Declared
 * vocabulary").
 *
 * Same field names and meanings as `TokenVocabulary`, so a check written
 * against one reads the same against the other. What differs is only how much
 * of the vocabulary is in it.
 */
export interface ScopeView {
    /** The `color` values this scope may key on. */
    roles: ReadonlySet<string>;
    /** The `size` ramp this scope may key on. */
    sizes: readonly string[];
    /**
     * True when the ramp was written down — by `tokens.sizes`, or by this
     * scope's own restriction. A scope that states its ramp has closed the set
     * as deliberately as a design system that states one, so an off-ramp value
     * is an error here too rather than the advisory warning the recommended
     * default gets.
     */
    sizesDeclared: boolean;
    /** The `variant` vocabulary this scope may key on — undefined when undeclared. */
    variants: readonly string[] | undefined;
    /** Custom axes this scope may key on — undefined when undeclared. */
    axes: Readonly<Record<string, readonly string[]>> | undefined;
    /** Presence-only modifiers this scope may key on — undefined when undeclared. */
    modifiers: readonly string[] | undefined;
    /**
     * The axes this scope narrowed, by the name the recipe keys on (`color`,
     * `size`, `variant`, a custom axis name, or `modifiers`).
     *
     * Read by the diagnostics, which say something different about a value the
     * design system never declared and a value this scope declined: "not a
     * declared variant" sends an author to `tokens.variants` and strands them
     * when it is already there.
     *
     * An axis restricted to the EMPTY list is in here too — that is the claim
     * "this scope has no such axis", not an omission.
     */
    restricted: ReadonlySet<string>;
}

export interface TokenVocabulary {
    /** Every custom property the design system defines. */
    names: ReadonlySet<string>;
    /**
     * The `size` axis values this design system declared, resolved — its own
     * `tokens.sizes`, else the recommended ramp.
     */
    sizes: readonly string[];
    /**
     * True when `tokens.sizes` was explicitly declared. An explicit
     * declaration closes its set — off-ramp recipe values are then errors,
     * where the default recommended ramp only warns.
     */
    sizesDeclared: boolean;
    /** The declared colour roles — what the `color` axis may key on. */
    roles: ReadonlySet<string>;
    /** The declared `variant` axis vocabulary — undefined when undeclared. */
    variants: readonly string[] | undefined;
    /** Declared custom axes: axis name → values — undefined when undeclared. */
    axes: Readonly<Record<string, readonly string[]>> | undefined;
    /** Declared presence-only modifiers — undefined when undeclared. */
    modifiers: readonly string[] | undefined;
    /**
     * The per-scope restrictions, exactly as declared (#294).
     *
     * The four fields above are the **union** — every value any scope may key
     * on — and every design-system-wide consumer is right to read them: an
     * `api` mapping, for instance, describes the whole design system's props.
     * A per-recipe check wants `forScope` instead.
     */
    scopes: Readonly<Record<string, ScopeVocabulary>>;
    /**
     * The vocabulary one scope may key on. An unrestricted scope gets the
     * union back, so a design system that declares no `scopes` behaves exactly
     * as it did before this existed.
     */
    forScope(scope: string): ScopeView;
    /** Closest known name, for a "did you mean" hint. */
    nearest(name: string): string | undefined;
}

const normProp = (name: string): string => (name.startsWith('--') ? name : `--${name}`);

/** Shared by every unrestricted scope — there is nothing to allocate per call. */
const EMPTY_RESTRICTED: ReadonlySet<string> = new Set();

/* eslint-disable @typescript-eslint/no-explicit-any -- variance-erased plumbing */
export function tokenVocabulary(tokens: TokensInput<any, any>): TokenVocabulary {
    const names = new Set<string>();

    // ── colors, per the declared role vocabulary ──
    const roles = resolveRoles(tokens.roles as RolesDecl | undefined);
    for (const [role, decl] of Object.entries(roles)) {
        names.add(`--color-${role}`);
        if (decl.content !== false) names.add(`--color-${role}-content`);
        if (decl.soft !== false) names.add(`--color-${role}-soft`);
    }
    for (const surface of BASE_SURFACE_TOKEN_LIST) names.add(`--color-${surface}`);

    // ── categories: what this design system declared, plus the recommended
    // keys `@sigx/zero/css` ships fallbacks for (those always resolve, so a
    // recipe may reference them even if the design system never set them) ──
    const tiers = [
        tokens.system,
        tokens.systemDark,
        ...Object.values(tokens.themes ?? {}).map((t) => (t as { system?: unknown }).system),
    ];
    for (const category of TOKEN_CATEGORIES) {
        if (category.shape === 'scalar') {
            names.add(tokenProperty(category));
            continue;
        }
        // Every text key also emits its `--text-fixed-<key>` alias (see
        // `TEXT_FIXED_PREFIX`), so a recipe may reference the alias of any
        // key it could reference directly. A key that itself spells a
        // `fixed-*` name gets no alias — the compiler skips those too, so
        // adding one here would accept a token that is never emitted.
        const add = (key: string): void => {
            names.add(tokenProperty(category, key));
            if (category.id === 'text' && !key.startsWith('fixed-')) {
                names.add(`${TEXT_FIXED_PREFIX}${key}`);
            }
        };
        for (const key of category.recommended) add(key);
        for (const tier of tiers) {
            const node = systemNodeAt(tier, category.path);
            if (typeof node !== 'object' || node === null) continue;
            for (const key of Object.keys(node)) add(key);
        }
    }

    // ── runtime-published properties: the zero runtime writes these on
    // elements (press point, progress/slider percent), so a recipe may
    // reference them even though no design system declares them ──
    for (const name of RUNTIME_PROPERTIES) names.add(name);

    // ── medium properties: `@sigx/zero/css` declares these, so a recipe may
    // reference one whether or not this design system overrides it ──
    for (const name of MEDIUM_PROPERTIES) names.add(name);

    // ── declared custom tokens, plus the untyped escape hatch. `extra` is
    // emitted verbatim, so a reference to one resolves — it gets its own
    // "declare it instead" warning elsewhere. ──
    for (const name of Object.keys(tokens.custom ?? {})) names.add(normProp(name));
    for (const theme of Object.values(tokens.themes ?? {})) {
        const t = theme as {
            custom?: Record<string, string>;
            extra?: Record<string, string>;
        };
        for (const name of Object.keys(t.extra ?? {})) names.add(normProp(name));
    }

    const sizes = resolveSizes(tokens.sizes);
    const roleNames = new Set(Object.keys(roles));
    const scopes = tokens.scopes ?? {};

    return {
        names,
        sizes,
        sizesDeclared: tokens.sizes !== undefined,
        roles: roleNames,
        variants: tokens.variants,
        axes: tokens.axes,
        modifiers: tokens.modifiers,
        scopes,
        forScope(scope) {
            const own = scopes[scope];
            if (!own) {
                return {
                    roles: roleNames,
                    sizes,
                    sizesDeclared: tokens.sizes !== undefined,
                    variants: tokens.variants,
                    axes: tokens.axes,
                    modifiers: tokens.modifiers,
                    restricted: EMPTY_RESTRICTED,
                };
            }
            // `??` and not `||`: an EMPTY restriction is the claim "this scope
            // has no such axis", so it must survive into the view rather than
            // falling back to the union. Everything downstream reads a
            // zero-length vocabulary as exactly that claim.
            const restricted = new Set<string>();
            if (own.colors) restricted.add('color');
            if (own.sizes) restricted.add('size');
            if (own.variants) restricted.add('variant');
            if (own.modifiers) restricted.add('modifiers');
            for (const axis of Object.keys(own.axes ?? {})) restricted.add(axis);
            return {
                roles: own.colors ? new Set(own.colors) : roleNames,
                sizes: own.sizes ?? sizes,
                sizesDeclared: tokens.sizes !== undefined || own.sizes !== undefined,
                variants: own.variants ?? tokens.variants,
                // A restricted axis replaces the union's entry for that axis
                // only — an axis the scope says nothing about keeps the
                // design-system-wide vocabulary.
                axes: own.axes ? { ...tokens.axes, ...own.axes } : tokens.axes,
                modifiers: own.modifiers ?? tokens.modifiers,
                restricted,
            };
        },
        nearest(name) {
            return nearestOf(name, names, 4); // anything further apart isn't a typo
        },
    };
}
