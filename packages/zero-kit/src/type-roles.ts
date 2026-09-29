/**
 * Composite type roles — `typography.roles` (#423).
 *
 * A type role is one typographic voice: a size, a line height, a weight, a
 * tracking and optionally a family, named once (`title-medium`). The kit's
 * separate ramps can hold the same values under parallel keys, but nothing in
 * that shape says the four values form one role, and nothing stops a recipe
 * pairing `--text-title-medium` with `--leading-body-small`.
 *
 * A role is a DECLARATION over the existing categories, not a category of its
 * own: each field folds into the ramp it belongs to under the role's name, so
 * `title-medium` emits exactly the custom properties the parallel-keys spelling
 * did (`--text-title-medium`, `--leading-title-medium`, `--weight-title-medium`,
 * `--tracking-title-medium`, and `--font-title-medium` when it names a
 * family). Every consumer that reads a category — emission, the vocabulary,
 * the register artifact, override checks — sees the folded ramps through
 * `withTypeRoles`, so none of them needed a second branch. What the role adds
 * is the record: the manifest lists each role with the properties it binds
 * (`CompiledDesignSystem.tokens.typeRoles`), and the recipe validator warns
 * when one declaration block reads two roles' tokens.
 */
import { TOKEN_CATEGORIES, systemNodeAt, tokenProperty } from './contract.js';

/** A type role's fields, in declaration order. */
export type TypeRoleField = 'size' | 'leading' | 'weight' | 'tracking' | 'font';

/**
 * Each field of a role and the token category it folds into. `font` is the
 * one optional field: a design system with one family has nothing to say per
 * role.
 */
export const TYPE_ROLE_FIELDS: ReadonlyArray<{
    readonly field: TypeRoleField;
    readonly category: 'text' | 'leading' | 'weight' | 'tracking' | 'font';
    readonly required: boolean;
    /** The CSS property a recipe sets from it — what the mixing check reads. */
    readonly cssProperty: string;
}> = [
    { field: 'size', category: 'text', required: true, cssProperty: 'font-size' },
    { field: 'leading', category: 'leading', required: true, cssProperty: 'line-height' },
    { field: 'weight', category: 'weight', required: true, cssProperty: 'font-weight' },
    { field: 'tracking', category: 'tracking', required: true, cssProperty: 'letter-spacing' },
    { field: 'font', category: 'font', required: false, cssProperty: 'font-family' },
];

/** Where the roles live in the authoring shape, under `system`. */
export const TYPE_ROLES_PATH = ['typography', 'roles'] as const;

const categoryOf = (id: string) => TOKEN_CATEGORIES.find((c) => c.id === id)!;

const isKeyMap = (node: unknown): node is Record<string, unknown> =>
    typeof node === 'object' && node !== null && !Array.isArray(node);

/** The `typography.roles` node of a tier, when it is a key map. */
export function typeRolesOf(tier: unknown): Record<string, Record<string, unknown>> {
    const node = systemNodeAt(tier, TYPE_ROLES_PATH);
    if (!isKeyMap(node)) return {};
    const out: Record<string, Record<string, unknown>> = {};
    for (const [name, role] of Object.entries(node)) if (isKeyMap(role)) out[name] = role;
    return out;
}

/**
 * The custom properties one role binds, by field — only the fields it sets.
 * This is the manifest record's shape.
 */
export function typeRoleProperties(name: string, role: Record<string, unknown>): Partial<Record<TypeRoleField, string>> {
    const out: Partial<Record<TypeRoleField, string>> = {};
    for (const { field, category } of TYPE_ROLE_FIELDS) {
        if (role[field] === undefined || role[field] === null) continue;
        out[field] = tokenProperty(categoryOf(category), name);
    }
    return out;
}

/**
 * A token tier with its `typography.roles` folded into the ramps: role
 * `title-medium`'s `size` becomes `typography.sizes['title-medium']`, and so on.
 *
 * A key the tier's own ramp already spells wins — the same precedence
 * `typography.scale` gives explicit `sizes` — but in the base tier that
 * collision is a validation error, since the role and the ramp would each
 * claim the property. In an override tier it is legitimate: a theme may
 * restate one role-emitted property directly (`sizes['title-medium']`).
 *
 * Returns the tier itself when it declares no roles, so callers can apply it
 * unconditionally.
 */
export function withTypeRoles<T>(tier: T): T {
    const roles = typeRolesOf(tier);
    if (Object.keys(roles).length === 0) return tier;
    const typography = { ...(tier as { typography?: Record<string, unknown> }).typography };
    for (const { field, category } of TYPE_ROLE_FIELDS) {
        const leaf = categoryOf(category).path[1]!;
        const folded: Record<string, unknown> = {};
        for (const [name, role] of Object.entries(roles)) {
            const value = role[field];
            if (value !== undefined && value !== null) folded[name] = value;
        }
        if (Object.keys(folded).length === 0) continue;
        const own = typography[leaf];
        // A malformed ramp is the validator's to report; folding into it
        // would replace the evidence.
        if (own !== undefined && !isKeyMap(own)) continue;
        typography[leaf] = { ...folded, ...own };
    }
    return { ...tier, typography } as T;
}
