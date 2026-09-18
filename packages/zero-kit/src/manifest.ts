/**
 * Manifest fragments — how an ecosystem component package joins the pipeline.
 *
 * An ecosystem package is a peer of `@sigx/zero`, not a plugin into it: it
 * ships its own anatomy (built with zero's public `defineAnatomy`) and
 * publishes it as a fragment — the `components` shape of zero's own manifest
 * plus the one fact zero's manifest never needs, WHO OWNS THE SCOPE. A design
 * system opts into covering the component by merging the fragment into the
 * manifest it compiles against; one that never merges it leaves the component
 * unstyled-but-accessible, which is the contract's baseline.
 *
 * Zero's own scope registry stays closed (`ZeroScope` is a literal union on
 * purpose — docs/architecture.md, "The register artifact"). Merging does
 * not reopen it: merged components
 * carry their `package` provenance, and every downstream consumer that must
 * distinguish zero-origin from ecosystem scopes (the register artifact's
 * compile gate, the api emitters' import specifiers) reads it from there.
 */
import type { ManifestComponent, ZeroManifest } from './contract.js';
import {
    FLAG_VOCABULARY,
    PLACEMENT_VOCABULARY,
    LAYOUT_ATTR_NAMES,
    STATE_NAMES,
    STATE_SYNONYMS,
    TOKEN_KEY_PATTERN,
} from './contract.js';

/**
 * The shape of a bare or scoped npm specifier, optionally with subpath
 * segments. Deliberately conservative — the specifier is interpolated into
 * generated import statements and comments, so anything a quote, backslash or
 * whitespace could smuggle into emitted code must never get past the merge.
 */
const PACKAGE_SPECIFIER_PATTERN = /^(@[a-z0-9~][\w.~-]*\/)?[a-z0-9~][\w.~-]*(\/[\w.~-]+)*$/;

/**
 * What can never appear in a selector fragment a fragment ships: the
 * characters that close the current rule and start another. A fragment's
 * `selectors` values are spliced into compiled selectors verbatim (the same
 * surface `stateSelector` trusts for zero's own anatomies), so this is the
 * merge-time twin of the recipe compiler's breakout guard.
 */
const CSS_BREAKOUT = /[{};\n\r]/;

/**
 * The version of the fragment CONTRACT this kit understands. A fragment
 * declares the version it was built against; the merge hard-errors on a
 * missing or unknown one, because an unversioned fragment merges whatever
 * contract era it came from — a pre-`hiddenIn` fragment used to slide
 * straight through (#317 item 5).
 */
export const FRAGMENT_VERSION = 1;

/** A model concept: a camelCase identifier (it becomes the stem of two prop names). */
const MODEL_CONCEPT_PATTERN = /^[a-z][A-Za-z0-9]*$/;
/** A compound member: PascalCase (`CheckboxItem`). */
const MODEL_MEMBER_PATTERN = /^[A-Z][A-Za-z0-9]*$/;
/** The closed key set of a model entry (the schema's `$defs/model`). */
const MODEL_KEYS = new Set(['name', 'concept', 'type', 'member', 'multiple', 'formControl', 'default', 'change']);

export interface ManifestFragment {
    /**
     * The fragment contract version this fragment was built against —
     * `FRAGMENT_VERSION` at publish time. Required: see the constant.
     */
    version: number;
    /**
     * The package that owns these scopes — provenance for diagnostics, the
     * import specifier for api-mode emitters, and required on purpose: an
     * unowned scope is exactly the anonymous drift the merge must not admit.
     */
    package: string;
    components: ManifestComponent[];
}

/**
 * Base manifest plus ecosystem fragments, as a new manifest — inputs are
 * never mutated. Each merged component is stamped with its fragment's
 * `package`; a scope collision is a hard error rather than a precedence rule,
 * because both spellings of that mistake (a fragment shadowing zero, two
 * fragments claiming one scope) mean two anatomies claim the same DOM.
 */
export function mergeManifests<M extends Pick<ZeroManifest, 'components'>>(
    base: M,
    ...fragments: ManifestFragment[]
): M {
    const owners = new Map<string, string>(
        base.components.map((c) => [c.scope, c.package ?? '@sigx/zero']),
    );
    const merged: ManifestComponent[] = [...base.components];

    for (const [index, fragment] of fragments.entries()) {
        const where = typeof fragment?.package === 'string' && fragment.package.length > 0
            ? `fragment "${fragment.package}"`
            : `fragment #${index + 1}`;
        if (typeof fragment?.package !== 'string' || fragment.package.length === 0) {
            throw new Error(`[zero-kit] ${where} declares no "package" — a manifest fragment must name the package that owns its scopes`);
        }
        if (!PACKAGE_SPECIFIER_PATTERN.test(fragment.package)) {
            throw new Error(`[zero-kit] ${where}: "${fragment.package}" is not a package specifier — it becomes an import specifier in generated artifacts`);
        }
        if (fragment.version === undefined) {
            throw new Error(`[zero-kit] ${where} declares no "version" — a fragment states the contract version it was built against (currently ${FRAGMENT_VERSION}), so a stale one fails here instead of merging silently`);
        }
        if (fragment.version !== FRAGMENT_VERSION) {
            throw new Error(`[zero-kit] ${where} declares fragment version ${fragment.version}, but this kit understands version ${FRAGMENT_VERSION} — rebuild the fragment against a matching @sigx/zero-kit`);
        }
        if (!Array.isArray(fragment.components) || fragment.components.length === 0) {
            throw new Error(`[zero-kit] ${where} has no "components" array — nothing to merge`);
        }
        for (const component of fragment.components) {
            if (typeof component?.scope !== 'string' || !Array.isArray(component.parts) || component.parts.length === 0) {
                throw new Error(`[zero-kit] ${where} has a component without a "scope" and "parts" — not an anatomy (defineAnatomy().toJSON() emits the expected shape)`);
            }
            // A fragment's scope becomes `[data-scope="…"]` in every compiled
            // selector AND the artifact filename `dist/css/components/
            // <scope>.css` — one grammar closes both the selector-injection
            // and the path-traversal reading of a hostile scope. Zero's own
            // registry is out of reach here by construction; this checks the
            // one door anatomies enter from outside.
            if (!TOKEN_KEY_PATTERN.test(component.scope)) {
                throw new Error(`[zero-kit] ${where}: scope "${component.scope}" is not a kebab-case identifier — it becomes [data-scope="…"] selectors and the css/components/<scope>.css filename`);
            }
            // Fail here, by name, rather than as a confusing downstream throw
            // in recipe compilation — this is the exported programmatic entry,
            // not only the schema-validated CLI path.
            for (const part of component.parts) {
                if (typeof part?.name !== 'string' || typeof part?.element !== 'string'
                    || typeof part?.selectors !== 'object' || part.selectors === null) {
                    throw new Error(`[zero-kit] ${where}: component "${component.scope}" has a part without "name", "element" and "selectors" — not an anatomy (defineAnatomy().toJSON() emits the expected shape)`);
                }
                if (!TOKEN_KEY_PATTERN.test(part.name)) {
                    throw new Error(`[zero-kit] ${where}: part "${part.name}" of "${component.scope}" is not a kebab-case identifier — it becomes [data-part="…"] selectors`);
                }
                for (const [state, fragmentSelector] of Object.entries(part.selectors)) {
                    if (CSS_BREAKOUT.test(fragmentSelector)) {
                        throw new Error(`[zero-kit] ${where}: selector for "${component.scope}"."${part.name}" state "${state}" cannot hold a brace, semicolon or newline — it is spliced into compiled selectors verbatim`);
                    }
                }
            }
            // The shared vocabularies, enforced on the ECOSYSTEM surface.
            // Zero's own anatomies are governed by zero's test suite and
            // `defineAnatomy` carries no runtime guard (it is on every
            // component's size budget) — so a published fragment's flags,
            // states, placements, layout attributes and part tree are
            // checked HERE, where the
            // fragment joins the pipeline. The "no synonyms" rule finally
            // binds for third-party scopes.
            const flagSet = new Set<string>(FLAG_VOCABULARY);
            const placementSet = new Set<string>(PLACEMENT_VOCABULARY);
            const partNames = new Set(component.parts.map((p) => p.name));
            const at = (part: string) => `${where}: "${component.scope}"."${part}"`;
            for (const part of component.parts) {
                for (const flag of part.flags ?? []) {
                    if (!flagSet.has(flag)) {
                        throw new Error(`[zero-kit] ${at(part.name)} declares flag "${flag}", which is not in the shared flag vocabulary [${FLAG_VOCABULARY.join(', ')}] — components never invent synonyms`);
                    }
                }
                for (const state of part.states ?? []) {
                    if (!STATE_NAMES.has(state)) {
                        const synonym = STATE_SYNONYMS[state];
                        throw new Error(`[zero-kit] ${at(part.name)} declares state "${state}", which is not in the governed state vocabulary${synonym ? ` — use "${synonym}"` : ''}`);
                    }
                }
                for (const placement of part.placements ?? []) {
                    if (!placementSet.has(placement)) {
                        throw new Error(`[zero-kit] ${at(part.name)} declares placement "${placement}", which is not in the placement vocabulary [${PLACEMENT_VOCABULARY.join(', ')}]`);
                    }
                }
                if (part.layout !== undefined) {
                    // Absent, never empty — the anatomy's rule for every
                    // declared-subset key, and the schema says `minItems: 1`.
                    // A JSON fragment is caught there; this is the
                    // PROGRAMMATIC entrypoint, where a hand-built object
                    // would otherwise slip an invalid shape through. `models`
                    // above guards itself the same way.
                    if (!Array.isArray(part.layout) || part.layout.length === 0) {
                        throw new Error(`[zero-kit] ${at(part.name)} has a "layout" that is not a non-empty array — omit the key when the part takes none`);
                    }
                    for (const attr of part.layout) {
                        if (!LAYOUT_ATTR_NAMES.has(attr)) {
                            throw new Error(`[zero-kit] ${at(part.name)} declares layout attribute "${attr}", which is not in the layout vocabulary [${[...LAYOUT_ATTR_NAMES].join(', ')}]`);
                        }
                    }
                }
                for (const state of part.hiddenIn ?? []) {
                    if (!(part.states ?? []).includes(state)) {
                        throw new Error(`[zero-kit] ${at(part.name)} declares hiddenIn "${state}", which is not one of the part's own states`);
                    }
                }
                if (part.parent !== undefined) {
                    if (part.parent === part.name) {
                        throw new Error(`[zero-kit] ${at(part.name)} declares itself as its own parent`);
                    }
                    if (!partNames.has(part.parent)) {
                        throw new Error(`[zero-kit] ${at(part.name)} declares parent "${part.parent}", which is not a declared part`);
                    }
                }
            }
            // Acyclicity over the whole tree — bounded walk per part, so a
            // cycle fails by name instead of hanging the build.
            const byName = new Map(component.parts.map((p) => [p.name, p]));
            for (const part of component.parts) {
                let cursor = part.parent;
                let hops = 0;
                while (cursor !== undefined) {
                    if (++hops > component.parts.length) {
                        throw new Error(`[zero-kit] ${at(part.name)}: parent chain does not terminate (cycle)`);
                    }
                    cursor = byName.get(cursor)?.parent;
                }
            }
            // The models a fragment claims follow zero's naming rule — the
            // companions are DERIVED from the concept, so a fragment spelling
            // them differently is describing an API zero's tooling would
            // misread.
            if (component.models !== undefined) {
                if (!Array.isArray(component.models) || component.models.length === 0) {
                    throw new Error(`[zero-kit] ${where}: component "${component.scope}" has a "models" that is not a non-empty array — omit the key when there are none`);
                }
                for (const model of component.models) {
                    const label = `${where}: "${component.scope}" model${model?.name ? `:${model.name}` : ''}`;
                    if (typeof model?.concept !== 'string' || !MODEL_CONCEPT_PATTERN.test(model.concept)) {
                        throw new Error(`[zero-kit] ${label} needs a camelCase "concept" — the stem of default<Concept> and <concept>Change`);
                    }
                    if (model.name !== undefined && (typeof model.name !== 'string' || !MODEL_CONCEPT_PATTERN.test(model.name))) {
                        throw new Error(`[zero-kit] ${label}: "name" is the camelCase model:<name> key`);
                    }
                    if (model.name !== undefined && model.name !== model.concept) {
                        throw new Error(`[zero-kit] ${label}: a named model's concept IS its name — "${model.concept}" does not match`);
                    }
                    if (typeof model.type !== 'string' || model.type.length === 0) {
                        throw new Error(`[zero-kit] ${label} needs a "type" (a TypeScript type expression)`);
                    }
                    const expectedDefault = `default${model.concept.charAt(0).toUpperCase()}${model.concept.slice(1)}`;
                    const expectedChange = `${model.concept}Change`;
                    if (model.default !== expectedDefault) {
                        throw new Error(`[zero-kit] ${label}: the seed prop of concept "${model.concept}" is "${expectedDefault}", not "${String(model.default)}"`);
                    }
                    if (model.change !== expectedChange) {
                        throw new Error(`[zero-kit] ${label}: the change event of concept "${model.concept}" is "${expectedChange}", not "${String(model.change)}"`);
                    }
                    // The schema's shape for the optional fields, so a merged
                    // manifest never fails validation downstream.
                    if (model.member !== undefined && (typeof model.member !== 'string' || !MODEL_MEMBER_PATTERN.test(model.member))) {
                        throw new Error(`[zero-kit] ${label}: "member" is a PascalCase compound member (CheckboxItem), or omitted for Root`);
                    }
                    for (const key of Object.keys(model)) {
                        if (!MODEL_KEYS.has(key)) {
                            throw new Error(`[zero-kit] ${label}: unknown key "${key}" — a model entry is closed to [${[...MODEL_KEYS].join(', ')}]`);
                        }
                    }
                    for (const flag of ['multiple', 'formControl'] as const) {
                        if (model[flag] !== undefined && model[flag] !== true) {
                            throw new Error(`[zero-kit] ${label}: "${flag}" is presence-only — true or omitted, never ${String(model[flag])}`);
                        }
                    }
                }
            }
            const owner = owners.get(component.scope);
            if (owner) {
                throw new Error(`[zero-kit] ${where} redeclares scope "${component.scope}", already owned by ${owner} — two anatomies cannot claim one scope`);
            }
            owners.set(component.scope, fragment.package);
            merged.push({ ...component, package: fragment.package });
        }
    }

    // The cast: spreading widens `components` to the base array type, which
    // is exactly what the merge produced — `M` only ever narrows other keys.
    return { ...base, components: merged } as M;
}

/**
 * Scope → the ecosystem package that owns it, for every merged component.
 * Empty for a design system that adopted nothing: a zero-origin component
 * carries no `package`, and that absence is what marks it zero's own.
 */
export function packagesByScope(manifest: Pick<ZeroManifest, 'components'>): Record<string, string> {
    // Null prototype. Scope names take the kebab grammar, which is lowercase
    // — so not `toString`, but `constructor` passes it, and on a plain object
    // a lookup for that one returns something inherited and truthy: the
    // finding would be attributed to a function.
    const owners: Record<string, string> = Object.create(null) as Record<string, string>;
    for (const component of manifest.components) {
        if (component.package) owners[component.scope] = component.package;
    }
    return owners;
}

/**
 * Stamp `package` onto every finding about a scope an ecosystem pack owns.
 *
 * A design system that adopts a pack compiles its recipes as its own, so
 * without this a warning about someone else's recipe reads exactly like a
 * warning about the author's — with nothing saying whose it is or where to
 * report it. Mutates in place: the findings are freshly built by the pass
 * that produced them, and copying them would fork the arrays the report and
 * the audit artifact already hold.
 */
export function attributeFindings<T extends { scope?: string; package?: string }>(
    findings: readonly T[],
    owners: Record<string, string>,
): void {
    if (Object.keys(owners).length === 0) return;
    for (const finding of findings) {
        // `hasOwn` as well as the null prototype above, because the map may
        // reach here from a caller that built it as a plain object.
        const from = finding.scope && Object.hasOwn(owners, finding.scope) ? owners[finding.scope] : undefined;
        if (from) finding.package = from;
    }
}

/** `<where>` for a human, with the owning package when a pack owns it. */
export function whereWithOwner(finding: { where: string; package?: string }): string {
    return finding.package ? `${finding.where} (from ${finding.package})` : finding.where;
}
