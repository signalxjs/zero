/**
 * Declared public hooks (#73) — the two checks that give `RecipeInput.hooks`
 * its meaning.
 *
 * 1. `hookIssues`: a declared hook must name something the recipe really has
 *    (a custom property it sets or reads, a keyframe in its `keyframes`, a
 *    pseudo-element a `selectors` key on that part draws). An error: a hook
 *    that names nothing is a promise the base cannot keep, and the manifest
 *    would publish it.
 * 2. `privateNameIssues`: for a design system `extendDesignSystem` derived,
 *    every name a patch reaches that the BASE recipe has but does not declare
 *    a hook. A warning, not an error — relying on a private name is a
 *    stability risk across the base's releases, not a broken build.
 *
 * What counts as the base's: a custom property the base recipe sets or reads
 * (minus the token grammar, the runtime-published and medium properties —
 * `vocabulary.names` — which are contract, not the recipe's); a keyframe the
 * base defines; a `::before` / `::after` the base draws on that part. A
 * patch "reaches" a name when it sets, reads or deletes the property,
 * references the keyframe in `animation` / `animation-name` (or redefines or
 * deletes it), or styles the pseudo-element on the same part.
 */
import type { DesignSystemDerivation } from '../extend.js';
import { HOOK_PSEUDO_ELEMENTS } from '../recipes.js';
import type { RecipeInput } from '../recipes.js';
import type { ValidationIssue } from './validate.js';

/** Everything one recipe (or one patch of a recipe) sets, reads, animates and draws. */
interface Usage {
    /** Custom properties declared (`--x: …`), including ones a patch deletes with `null`. */
    sets: Set<string>;
    /** Custom properties referenced through `var(--x)`. */
    reads: Set<string>;
    /** Identifiers in `animation` / `animation-name` values — keyframe candidates. */
    animations: Set<string>;
    /** Keyframe names defined (or, in a patch, redefined or deleted). */
    keyframes: Set<string>;
    /** part → the generated-content pseudo-elements its `selectors` keys draw. */
    pseudo: Map<string, Set<string>>;
}

type Plain = Record<string, unknown>;

const isPlain = (value: unknown): value is Plain =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const VAR_REF = /var\(\s*(--[A-Za-z0-9_-]+)/g;
/** A custom-property declaration inside raw CSS (a keyframes body, the `css` hatch). */
const RAW_SET = /(?:^|[;{\s])(--[A-Za-z0-9_-]+)\s*:/g;
const PSEUDO = /::(?:before|after)\b/g;
const IDENT = /^-?[A-Za-z_][A-Za-z0-9_-]*$/;
const PROPERTY_NAME = /^--[A-Za-z0-9_-]+$/;

const kebab = (prop: string): string => prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

function emptyUsage(): Usage {
    return { sets: new Set(), reads: new Set(), animations: new Set(), keyframes: new Set(), pseudo: new Map() };
}

function scanRaw(text: string, usage: Usage): void {
    for (const [, name] of text.matchAll(VAR_REF)) usage.reads.add(name!);
    for (const [, name] of text.matchAll(RAW_SET)) usage.sets.add(name!);
}

function declarations(props: unknown, usage: Usage): void {
    if (!isPlain(props)) return;
    for (const [prop, value] of Object.entries(props)) {
        if (prop.startsWith('--')) usage.sets.add(prop);
        if (typeof value !== 'string') continue;
        for (const [, name] of value.matchAll(VAR_REF)) usage.reads.add(name!);
        const name = kebab(prop);
        if (name === 'animation' || name === 'animation-name') {
            for (const word of value.split(/[\s,]+/)) if (IDENT.test(word)) usage.animations.add(word);
        }
    }
}

/** One part's styles; `part` is undefined for a nested (composed) scope's part. */
function partStyles(styles: unknown, part: string | undefined, usage: Usage): void {
    if (!isPlain(styles)) return;
    declarations(styles['base'], usage);
    if (isPlain(styles['states'])) for (const props of Object.values(styles['states'])) declarations(props, usage);
    if (isPlain(styles['selectors'])) {
        for (const [selector, props] of Object.entries(styles['selectors'])) {
            declarations(props, usage);
            if (part === undefined) continue;
            for (const [pseudo] of selector.matchAll(PSEUDO)) {
                let set = usage.pseudo.get(part);
                if (!set) usage.pseudo.set(part, (set = new Set()));
                set.add(pseudo);
            }
        }
    }
    if (isPlain(styles['at'])) for (const nested of Object.values(styles['at'])) partStyles(nested, part, usage);
}

function partsRecord(parts: unknown, usage: Usage, own = true): void {
    if (!isPlain(parts)) return;
    for (const [part, styles] of Object.entries(parts)) partStyles(styles, own ? part : undefined, usage);
}

/**
 * Walk a recipe or a patch of one — the same shape, except that a patch may
 * hold `null` anywhere (a deletion still names what it deletes).
 */
function walk(recipe: unknown, usage: Usage = emptyUsage()): Usage {
    if (!isPlain(recipe)) return usage;
    declarations(recipe['tokens'], usage);
    partsRecord(recipe['parts'], usage);
    if (isPlain(recipe['variants'])) {
        for (const values of Object.values(recipe['variants'])) {
            if (isPlain(values)) for (const parts of Object.values(values)) partsRecord(parts, usage);
        }
    }
    if (isPlain(recipe['modifiers'])) for (const parts of Object.values(recipe['modifiers'])) partsRecord(parts, usage);
    if (Array.isArray(recipe['compoundVariants'])) {
        for (const compound of recipe['compoundVariants']) if (isPlain(compound)) partsRecord(compound['parts'], usage);
    }
    // A composed scope's parts belong to ANOTHER scope: its declarations
    // count (they set and read this recipe's names), its pseudo-elements do
    // not — they are drawn on the nested scope's parts.
    if (isPlain(recipe['composes'])) {
        for (const composed of Object.values(recipe['composes'])) if (isPlain(composed)) partsRecord(composed['parts'], usage, false);
    }
    if (isPlain(recipe['keyframes'])) {
        for (const [name, body] of Object.entries(recipe['keyframes'])) {
            usage.keyframes.add(name);
            if (typeof body === 'string') scanRaw(body, usage);
        }
    }
    if (typeof recipe['css'] === 'string') scanRaw(recipe['css'], usage);
    if (isPlain(recipe['targets'])) for (const section of Object.values(recipe['targets'])) walk(section, usage);
    return usage;
}

/**
 * Build-time check: every declared hook names something the recipe has.
 * Reads the recipe as authored, `targets` included — a keyframe a target
 * section defines is still the recipe's.
 */
export function hookIssues(recipes: readonly RecipeInput[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    for (const recipe of recipes) {
        const hooks = recipe.hooks;
        if (!hooks) continue;
        const scope = recipe.component;
        const where = `recipes.${scope}.hooks`;
        const error = (at: string, message: string) =>
            issues.push({ level: 'error', where: `${where}.${at}`, message, rule: 'hook', scope });
        const usage = walk(recipe);

        for (const [name, meaning] of Object.entries(hooks.properties ?? {})) {
            if (!PROPERTY_NAME.test(name)) {
                error('properties', `"${name}" is not a custom property name (--kebab-case)`);
            } else if (!usage.sets.has(name) && !usage.reads.has(name)) {
                error('properties', `"${name}" is declared a hook, but the recipe never sets or reads it`);
            }
            if (typeof meaning !== 'string' || meaning.trim() === '') {
                error('properties', `"${name}" needs a description — a hook is documentation for the system derived from this one`);
            }
        }
        for (const name of hooks.keyframes ?? []) {
            if (!usage.keyframes.has(name)) {
                error('keyframes', `"${name}" is declared a hook, but the recipe's keyframes do not define it`);
            }
        }
        for (const [part, list] of Object.entries(hooks.pseudo ?? {})) {
            for (const pseudo of list) {
                if (!(HOOK_PSEUDO_ELEMENTS as readonly string[]).includes(pseudo)) {
                    error('pseudo', `${part}${pseudo}: only the generated-content pseudo-elements (${HOOK_PSEUDO_ELEMENTS.join(', ')}) can be hooks — the platform's own pseudo-elements are not the recipe's to publish`);
                } else if (!usage.pseudo.get(part)?.has(pseudo)) {
                    error('pseudo', `${part}${pseudo} is declared a hook, but no selectors key on "${part}" draws it`);
                }
            }
        }
    }
    return issues;
}

/**
 * The warning half: for each scope a derivation patched, every name the patch
 * reaches that the base recipe keeps private. `contract` is the set of custom
 * properties that are nobody's private name — the derived design system's
 * token grammar, runtime and medium properties (`TokenVocabulary.names`).
 */
export function privateNameIssues(
    derivation: DesignSystemDerivation,
    contract: ReadonlySet<string>,
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const owner = derivation.name;
    for (const [scope, { base, patch }] of Object.entries(derivation.patches)) {
        const hooks = base.hooks ?? {};
        const baseUse = walk(base);
        const patchUse = walk(patch);
        const reached = new Set<string>();
        const warn = (name: string) => {
            if (reached.has(name)) return;
            reached.add(name);
            issues.push({
                level: 'warning',
                where: `recipes.${scope}`,
                message: `references ${name}, private to "${owner}" — not a declared hook`,
                rule: 'private-name',
                scope,
            });
        };

        const publicProps = new Set(Object.keys(hooks.properties ?? {}));
        const baseProps = new Set([...baseUse.sets, ...baseUse.reads]);
        for (const name of [...patchUse.sets, ...patchUse.reads]) {
            if (baseProps.has(name) && !publicProps.has(name) && !contract.has(name)) warn(name);
        }

        const publicKeyframes = new Set(hooks.keyframes ?? []);
        for (const name of [...patchUse.animations, ...patchUse.keyframes]) {
            if (baseUse.keyframes.has(name) && !publicKeyframes.has(name)) warn(`keyframes ${name}`);
        }

        for (const [part, drawn] of patchUse.pseudo) {
            for (const pseudo of drawn) {
                if (baseUse.pseudo.get(part)?.has(pseudo) && !hooks.pseudo?.[part]?.includes(pseudo)) {
                    warn(`${part}${pseudo}`);
                }
            }
        }
    }
    return issues;
}
