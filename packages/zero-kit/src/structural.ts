/**
 * Structural roles (#422) — how a design system's own scale names reach the
 * places zero reads a radius or text step by NAME.
 *
 * The anatomy's token hints (`radius-box`), `@sigx/zero/css`'s structural
 * fallbacks and the kit's layout Box all name the recommended keys. Those
 * keys are a default, not a requirement: a design system that calls its
 * corners `extra-small … full` maps the roles onto them with
 * `system.structural`, and everything here resolves through that map.
 *
 * - `resolveStructural` — role → key, per category, defaults filled in.
 * - `structuralToken` — the resolved token NAME for one role
 *   (`radius-medium`), what the layout Box reads and the manifest records.
 * - `structuralAliases` — the custom properties the compiled tokens emit so
 *   a reference by the recommended name (a shared recipe, an ecosystem pack,
 *   app CSS, base.css's own `--text-fixed-*` indirection) still reads the
 *   mapped key rather than the neutral fallback.
 *
 * Pure and `node:`-free: the layout recipes and the emitters both read it.
 */
import { STRUCTURAL_ROLES, TOKEN_CATEGORIES, tokenProperty } from './contract.js';
import type { StructuralCategory } from './contract.js';

/** Role → the design system's key, per structural category. */
export type ResolvedStructural = { readonly [C in StructuralCategory]: Readonly<Record<string, string>> };

const categoryOf = (id: StructuralCategory) => TOKEN_CATEGORIES.find((c) => c.id === id)!;

/** The declared `structural` map of a system tier, or undefined — never throws on a malformed one (the validator reports it). */
function declaredMap(system: unknown, category: StructuralCategory): Record<string, unknown> | undefined {
    if (typeof system !== 'object' || system === null) return undefined;
    const structural = (system as { structural?: unknown }).structural;
    if (typeof structural !== 'object' || structural === null) return undefined;
    const map = (structural as Record<string, unknown>)[category];
    return typeof map === 'object' && map !== null && !Array.isArray(map) ? (map as Record<string, unknown>) : undefined;
}

/**
 * Every structural role resolved to the design system's own key. A role the
 * map leaves out — or a design system with no map at all — resolves to the
 * recommended key of the same name.
 */
export function resolveStructural(system: unknown): ResolvedStructural {
    const out = {} as Record<StructuralCategory, Record<string, string>>;
    for (const category of Object.keys(STRUCTURAL_ROLES) as StructuralCategory[]) {
        const declared = declaredMap(system, category);
        const resolved: Record<string, string> = {};
        for (const role of STRUCTURAL_ROLES[category]) {
            const key = declared?.[role];
            resolved[role] = typeof key === 'string' && key.length > 0 ? key : role;
        }
        out[category] = resolved;
    }
    return out;
}

/** The resolved token name for one role — `radius-medium` for `radius`/`box` under M3's map. */
export function structuralToken(system: unknown, category: StructuralCategory, role: string): string {
    const key = resolveStructural(system)[category][role] ?? role;
    return tokenProperty(categoryOf(category), key).slice(2);
}

/**
 * The flat, manifest-facing form: every recommended structural token name →
 * the token that plays it in this design system (`radius-box` →
 * `radius-medium`). Identity entries included, so a reader resolving an
 * anatomy hint never needs to know the default.
 */
export function structuralTokenMap(system: unknown): Record<string, string> {
    const out: Record<string, string> = {};
    const resolved = resolveStructural(system);
    for (const category of Object.keys(STRUCTURAL_ROLES) as StructuralCategory[]) {
        const decl = categoryOf(category);
        for (const [role, key] of Object.entries(resolved[category])) {
            out[tokenProperty(decl, role).slice(2)] = tokenProperty(decl, key).slice(2);
        }
    }
    return out;
}

/**
 * Recommended-name property → the property it resolves to, for every role
 * mapped AWAY from its own name (`--radius-box` → `--radius-medium`). Empty
 * for a design system with no map, which therefore emits nothing new.
 */
export function structuralAliases(system: unknown): Record<string, string> {
    const out: Record<string, string> = {};
    const resolved = resolveStructural(system);
    for (const category of Object.keys(STRUCTURAL_ROLES) as StructuralCategory[]) {
        const decl = categoryOf(category);
        for (const [role, key] of Object.entries(resolved[category])) {
            if (key !== role) out[tokenProperty(decl, role)] = tokenProperty(decl, key);
        }
    }
    return out;
}
