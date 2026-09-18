/**
 * Recipe CONTENT validation — the half of the generate → validate → iterate
 * loop that was missing.
 *
 * Structure was already checked hard: an unknown part or state fails the
 * build. But nothing looked inside a declaration, so the mistakes a generator
 * actually makes were all silent — a typo'd `var(--color-brnad)` compiled
 * straight through to the shipped stylesheet, where it resolves to nothing.
 */
import { parse, converter } from 'culori';
import type { ManifestPart, ZeroManifest } from '../contract.js';
import { AXIS_VALUE_PATTERN, RESERVED_AXES, TOKEN_KEY_PATTERN } from '../contract.js';
import { badAxisValue } from './messages.js';
import { CSS_PROPERTIES, CSS_PROPERTIES_SOURCE } from './css-properties.js';
import { nearestOf } from './nearest.js';
import type { CssProps, PartStyles, RecipeInput } from '../recipes.js';
import type { ValidationIssue } from './validate.js';
import type { TokenVocabulary } from './vocabulary.js';

const VAR_REF = /var\(\s*(--[A-Za-z0-9_-]+)\s*(,)?/g;
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const COLOR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;
/** A bare time, i.e. not `var(--duration-…)`. */
const BARE_TIME = /(?:^|[\s,(])(-?(?:\d+\.?\d*|\.\d+)m?s)(?=[\s,)]|$)/;

/** Properties whose values are prose or identifiers, not colors. */
const NOT_COLOR_VALUED = new Set([
    'content', 'font', 'font-family', 'grid-template-areas', 'counter-reset', 'counter-increment',
    // A mask's "colors" are alpha carriers — only the channel's opacity
    // paints, so `#000` in a mask gradient is geometry, not ink, and there is
    // nothing a role reference could retheme (#334: radial-progress's
    // annulus/sweep masks are the first shipped case). Membership is tested
    // on the kebab spelling (see the check site), so `maskImage`,
    // `WebkitMaskImage` and `-webkit-mask-image` all land on the same entry.
    'mask', 'mask-image', '-webkit-mask', '-webkit-mask-image',
]);

/**
 * Physical-direction properties, and the logical property that says what the
 * author actually meant. Keyed and valued in kebab — `kebabProp` normalises the
 * camelCase authoring spelling before the lookup, and a keyframes body is
 * already kebab.
 *
 * A physical direction is not a typo; it compiles and it renders. It is simply
 * the same side in both writing directions, so a control that mirrors
 * everything else on the page does not mirror this one rule. That is invisible
 * to every other check in this repo: the goldens record the physical spelling
 * faithfully, and no unit test sets `dir`.
 *
 * This is deliberately NOT the general "is this a real CSS property" problem
 * (#51), which needs a list of every property and goes stale against new CSS.
 * These dozen-odd physical properties have had stable logical twins for years;
 * the list does not move.
 *
 * ── WHAT IT CANNOT SEE ───────────────────────────────────────────────────────
 * A transform. `translateX(+8px)` moves toward the physical right in both
 * writing directions and there is no logical spelling to suggest — the fix is a
 * direction-valued custom property, which is a shape, not a rename. So a part
 * can pass this check and still be wrong, and one in this repo did: heroui's
 * switch thumb anchors with `inset-inline-start` and then travels with a bare
 * positive `translate`, so under RTL the anchor mirrors, the travel does not,
 * and the thumb leaves the track. Clean here, broken on screen.
 *
 * That is the division of labour, not an oversight: this lint reads
 * declarations, and `e2e/rtl.spec.ts` reads boxes. Neither one subsumes the
 * other, and the transform cases are exactly why the spec exists.
 */
const LOGICAL_TWIN: Record<string, string> = {
    'left': 'inset-inline-start',
    'right': 'inset-inline-end',
    'margin-left': 'margin-inline-start',
    'margin-right': 'margin-inline-end',
    'padding-left': 'padding-inline-start',
    'padding-right': 'padding-inline-end',
    'border-left': 'border-inline-start',
    'border-right': 'border-inline-end',
    'border-left-width': 'border-inline-start-width',
    'border-right-width': 'border-inline-end-width',
    'border-left-style': 'border-inline-start-style',
    'border-right-style': 'border-inline-end-style',
    'border-left-color': 'border-inline-start-color',
    'border-right-color': 'border-inline-end-color',
    'border-top-left-radius': 'border-start-start-radius',
    'border-top-right-radius': 'border-start-end-radius',
    'border-bottom-left-radius': 'border-end-start-radius',
    'border-bottom-right-radius': 'border-end-end-radius',
};

/**
 * The same kebab-casing the web target applies before emitting, so a recipe can
 * be authored in either spelling and still be checked. Custom properties are
 * case-sensitive and never physical, so they pass through untouched.
 */
const kebabProp = (prop: string): string =>
    prop.startsWith('--') ? prop : prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/**
 * `-webkit-appearance`, `-moz-appearance`, `-ms-overflow-style`… — a
 * deliberate vendor hack the property check leaves alone. The kebab form
 * MUST carry the leading hyphen: the emitter turns `WebkitAppearance` into
 * `-webkit-appearance` (the capital opens with a hyphen) but `msOverflowStyle`
 * into `ms-overflow-style`, which no engine reads. The lowercase-led form is
 * therefore not exempt — it is the one vendor slip worth naming, see
 * `VENDOR_PREFIX_MISSING_HYPHEN`.
 */
const VENDOR_PREFIX = /^-(?:webkit|moz|ms|o)-/;

/** A vendor prefix without its hyphen — `ms-overflow-style` from `msOverflowStyle`. */
const VENDOR_PREFIX_MISSING_HYPHEN = /^(?:webkit|moz|ms|o)-/;

/**
 * A declaration head inside a keyframes body: a property-shaped word after
 * the start, a `;` or a `{`, followed by `:` and a value that runs to `;` or
 * `}` (left unconsumed, so it can anchor the next head) without opening a
 * block. The last clause is what tells `50% { … }` (a selector, opens a
 * block) from `opacity: 0;` (a declaration). `--x` custom properties match
 * too and are exempted by the caller like every other custom property.
 *
 * Only keyframes bodies are read this way. A keyframe block can hold nothing
 * but property declarations, so every head is a property or a typo. The raw
 * `css` hatch is not read: it is the escape hatch precisely so an author can
 * write what the typed surface cannot — `@font-face { src: … }`,
 * `@property { syntax: …; inherits: … }`, `@counter-style { symbols: … }` —
 * and those descriptors are not properties. A checker that reads them would
 * call `src` a typo of `r`.
 */
const DECLARATION_HEAD = /(?:^|[;{])\s*(--?[A-Za-z_][\w-]*|[A-Za-z][\w-]*)\s*:\s*[^;{}]*(?=[;}])/g;

/** A physical property named at the head of a declaration inside a raw body. */
const PHYSICAL_IN_BODY = new RegExp(
    `(?:^|[;{\\s])(${Object.keys(LOGICAL_TWIN).join('|')})\\s*:`,
    'g',
);

/**
 * The INLINE-axis translation a block applies to itself, as written.
 *
 * Only the x component counts, and only the first one found: `translateY(-50%)`
 * moves nothing horizontally, and a block that centres vertically has not said
 * anything about the inline axis at all.
 */
function inlineTranslation(props: CssProps): string | undefined {
    // A leading `+` is legal CSS and means the same as no sign, so it is
    // normalised away rather than rejected — `translateX(+50%)` is how a
    // correctly centred `right: 50%` may well be written.
    const normalise = (x: string) => (x.startsWith('+') ? x.slice(1) : x);
    for (const [prop, raw] of Object.entries(props)) {
        const name = kebabProp(prop);
        const value = String(raw);
        // `translateX(…)`, `translate(x, …)`, `translate3d(x, …)` — but never
        // `translateY(…)`, whose `Y` matches neither the optional `X|3d` nor
        // the paren.
        if (name === 'transform') {
            const x = /\btranslate(?:X|3d)?\(\s*([+-]?[\d.]+%)/.exec(value);
            if (x) return normalise(x[1]!);
        } else if (name === 'translate') {
            // The individual property, whose first component is x.
            const x = /^\s*([+-]?[\d.]+%)/.exec(value);
            if (x) return normalise(x[1]!);
        }
    }
    return undefined;
}

/**
 * Centring is symmetric, so `left: 50%` is not a direction — but only when the
 * block pulls itself back by half its own width, which is what makes the pair
 * mean "centre" rather than "start at the midpoint".
 *
 * Both halves of that have to match, and matching loosely gets both wrong:
 *
 * - **The axis.** `left: 50%` beside a `translateY(-50%)` is vertical centring
 *   with an uncentred horizontal offset — it really does pick a side, and a
 *   substring test for `-50%` would wave it through.
 * - **The sign.** `left: 50%` pulls back by `-50%`; `right: 50%` pulls the
 *   other way, by `+50%`. Requiring a negative value would warn on a correctly
 *   centred `right`.
 *
 * A bare `left: 50%` with no inline pull-back at all is not centring either.
 */
function isCentring(prop: string, value: string, props: CssProps): boolean {
    if (prop !== 'left' && prop !== 'right') return false;
    if (value.trim() !== '50%') return false;
    return inlineTranslation(props) === (prop === 'left' ? '-50%' : '50%');
}

/** The part a diagnostic path belongs to, wherever in the recipe it sits. */
function partOf(path: string): string | undefined {
    return /^parts\.([^.]+)/.exec(path)?.[1]
        ?? /^variants\.[^.]+\.[^.]+\.([^.]+)/.exec(path)?.[1]
        ?? /^compoundVariants\[\d+\]\.parts\.([^.]+)/.exec(path)?.[1];
}

/**
 * Parts that draw a glyph out of rotated box edges — every checkbox tick in
 * this repo, daisyUI's disclosure chevron, Carbon's progress check.
 *
 * Once a box is rotated, its `border-left` is a *stroke of the drawing*, not
 * the inline start of anything: swapping it for `border-inline-start` mirrors
 * the glyph. A check mark is not mirrored in RTL — Carbon's own recipe says so
 * in a comment above the very declarations this would otherwise flag — so the
 * logical spelling would be the bug rather than the fix.
 *
 * Scoped to the PART, not the block: a part draws or it does not, and the
 * rotation is usually declared in `base` while `at["forced-colors"]` or a state
 * adjusts one arm. A block-local test would clear the base and flag the
 * override, which is the same glyph.
 */
function drawnParts(recipe: RecipeInput): Set<string> {
    const drawn = new Set<string>();
    for (const { path, props } of declarations(recipe)) {
        const part = partOf(path);
        if (part === undefined || drawn.has(part)) continue;
        for (const [prop, raw] of Object.entries(props)) {
            const name = kebabProp(prop);
            const rotates = name === 'rotate'
                || ((name === 'transform' || name === 'translate') && String(raw).includes('rotate('));
            if (rotates) { drawn.add(part); break; }
        }
    }
    return drawn;
}

const toOklch = converter('oklch');

/**
 * Achromatic-with-alpha values are shadows and scrims, not palette colors.
 *
 * Without this every raw color in both shipped design systems — all of them
 * `oklch(0% 0 0 / α)` — would be flagged, and the rule would be turned off
 * rather than obeyed.
 */
/**
 * The properties that keep an element rendered through its exit. Transitioning
 * one of these with `allow-discrete` is what buys the closing animation;
 * `overlay` is additionally what keeps a popup in the top layer.
 */
const DISCRETE_PRESENCE_PROPERTIES = ['display', 'overlay', 'content-visibility'] as const;

function isScrim(literal: string): boolean {
    const parsed = parse(literal);
    if (!parsed) return false;
    if ((parsed.alpha ?? 1) >= 1) return false;
    return (toOklch(parsed)?.c ?? 0) < 0.02;
}

/**
 * Remove every `var(…)` call, matching parens rather than scanning to the
 * first `)`. A fallback can itself contain a function
 * (`var(--x, color-mix(in oklab, …))`), which the naive form cuts in half and
 * leaves fragments of behind.
 */
function stripVars(value: string): string {
    let out = '';
    for (let i = 0; i < value.length; i++) {
        if (!value.startsWith('var(', i)) {
            out += value[i];
            continue;
        }
        let depth = 0;
        let j = i + 3;
        for (; j < value.length; j++) {
            if (value[j] === '(') depth++;
            else if (value[j] === ')' && --depth === 0) break;
        }
        i = j; // skip the whole call; an unbalanced tail drops entirely
    }
    return out;
}

/** Every color literal in a value, ignoring the contents of `var()`. */
function colorLiterals(value: string): string[] {
    const withoutVars = stripVars(value);
    const found = [...withoutVars.matchAll(HEX)].map((m) => m[0]);
    for (const m of withoutVars.matchAll(COLOR_FN)) {
        // Balance from the opening paren so nested functions come along.
        let depth = 0;
        for (let i = m.index! + m[0].length - 1; i < withoutVars.length; i++) {
            if (withoutVars[i] === '(') depth++;
            else if (withoutVars[i] === ')' && --depth === 0) {
                found.push(withoutVars.slice(m.index!, i + 1));
                break;
            }
        }
    }
    return found;
}

/** Walk every declaration a recipe contains, with a path for diagnostics. */
function* declarations(recipe: RecipeInput): Generator<{ path: string; props: CssProps }> {
    function* fromPart(path: string, styles: PartStyles): Generator<{ path: string; props: CssProps }> {
        if (styles.base) yield { path: `${path}.base`, props: styles.base };
        for (const [state, props] of Object.entries(styles.states ?? {})) {
            yield { path: `${path}.states.${state}`, props };
        }
        for (const [sel, props] of Object.entries(styles.selectors ?? {})) {
            yield { path: `${path}.selectors["${sel}"]`, props };
        }
        for (const [key, nested] of Object.entries(styles.at ?? {})) {
            yield* fromPart(`${path}.at["${key}"]`, nested);
        }
    }

    if (recipe.tokens) yield { path: 'tokens', props: recipe.tokens };
    for (const [part, styles] of Object.entries(recipe.parts)) yield* fromPart(`parts.${part}`, styles);
    for (const [axis, values] of Object.entries(recipe.variants ?? {})) {
        for (const [value, parts] of Object.entries(values)) {
            for (const [part, styles] of Object.entries(parts)) {
                yield* fromPart(`variants.${axis}.${value}.${part}`, styles);
            }
        }
    }
    const compounds = recipe.compoundVariants ?? [];
    for (let i = 0; i < compounds.length; i++) {
        for (const [part, styles] of Object.entries(compounds[i]!.parts)) {
            yield* fromPart(`compoundVariants[${i}].parts.${part}`, styles);
        }
    }
}

/** Custom properties a recipe defines itself, so referencing them is fine. */
function locallyDefined(recipe: RecipeInput): Set<string> {
    const names = new Set(Object.keys(recipe.tokens ?? {}));
    for (const { props } of declarations(recipe)) {
        for (const prop of Object.keys(props)) if (prop.startsWith('--')) names.add(prop);
    }
    return names;
}

/** Every state/flag name a part can carry. */
const partVocabulary = (part: ManifestPart): string[] => [
    ...(part.states ?? []),
    ...(part.flags ?? []),
];

export function validateRecipes(
    recipes: readonly RecipeInput[],
    manifest: Pick<ZeroManifest, 'components'>,
    vocabulary: TokenVocabulary,
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    // Findings carry the scope they are about as a field, so a reader never
    // has to recover it from `where` (a display string). Most originate
    // inside the recipe loop, which sets `currentScope`; the design-system
    // level checks that run after it clear the variable, and the per-scope
    // coverage checks pass their scope explicitly through `warnFor` — they
    // iterate scopes of their own, and an inner binding named `scope` does
    // NOT reach a closure defined out here.
    let currentScope: string | undefined;
    /**
     * The ONE place an issue is pushed. Every finding goes through here so
     * none can quietly miss the scope tag — the `css-property` findings, which
     * carry a `rule` and a `suggest`, were exactly that leak.
     */
    const push = (issue: Omit<ValidationIssue, 'scope'> & { scope?: string }): void => {
        const scope = issue.scope ?? currentScope;
        issues.push({ ...issue, ...(scope ? { scope } : {}) });
    };
    const error = (where: string, message: string) => push({ level: 'error', where, message });
    const warn = (where: string, message: string) => push({ level: 'warning', where, message });
    const warnFor = (scope: string, where: string, message: string) =>
        push({ level: 'warning', where, message, scope });

    // Axis names and values are interpolated into `[data-<axis>="<value>"]`
    // (and, on lynx, into `.zx-a-<axis>-<value>`). The vocabularies are open
    // by design, so "open" has to stop at what those carry verbatim —
    // otherwise a value carrying a quote closes the selector early and
    // everything after it is read as CSS, silently styling parts the recipe
    // never named. Names take the token-key grammar, values the wider axis
    // value grammar (#198). `compileRecipeCss` throws on the same input; this
    // is where an author gets told, with all the other issues.
    const checkAxisName = (axis: string, where: string) => {
        if (!TOKEN_KEY_PATTERN.test(axis)) {
            error(where, `axis "${axis}" is not a kebab-case identifier — it becomes the attribute name data-${axis}`);
        }
    };
    const checkAxisValue = (_axis: string, value: string, where: string) => {
        if (!AXIS_VALUE_PATTERN.test(value)) {
            error(where, badAxisValue(value));
        }
    };

    // A declaration key the CSS specifications do not define never renders:
    // the browser drops the whole declaration and says nothing (#51), so
    // this is the one authoring slip no later gate can see. Near a real
    // property it is a typo and an error; far from every property it is
    // either brand-new CSS or a typo of something exotic, and the honest
    // verdict is a warning. Custom properties are the author's to name, and
    // a vendor-prefixed spelling is a deliberate hack the specs mostly do
    // not list — neither is questioned.
    //
    // The suggestion needs both names to be at least four characters. The
    // list holds the SVG geometry properties (`r`, `x`, `cx`, `rx`…), and
    // two edits from a three-letter key reaches most of them — `tpo` would
    // be "corrected" to `r`. A short unknown key is the warning tier.
    const checkProperty = (prop: string, at: string) => {
        const name = kebabProp(prop);
        if (name.startsWith('--') || CSS_PROPERTIES.has(name) || VENDOR_PREFIX.test(name)) return;
        if (VENDOR_PREFIX_MISSING_HYPHEN.test(name)) {
            // `msOverflowStyle` → `ms-overflow-style`: the hyphen the prefix
            // needs never appears, because only a capital opens with one.
            const fixed = `-${name}`;
            // A camelCase key gets the capital that opens the hyphen; a kebab
            // key already spells itself and only lacks the hyphen.
            const spelled = prop.includes('-') ? fixed : prop[0]!.toUpperCase() + prop.slice(1);
            push({
                level: 'error',
                where: at,
                rule: 'css-property',
                suggest: { token: name, value: fixed },
                message: `"${name}" is not a CSS property — a vendor prefix needs its leading hyphen: write "${spelled}" so it emits as "${fixed}". The browser drops the declaration silently`,
            });
            return;
        }
        const near = name.length >= 4 ? nearestOf(name, CSS_PROPERTIES, 3) : undefined; // within two edits
        if (near && near.length >= 4) {
            push({
                level: 'error',
                where: at,
                rule: 'css-property',
                suggest: { token: name, value: near },
                message: `"${name}" is not a CSS property — did you mean "${near}"? The browser drops the declaration silently`,
            });
        } else {
            push({
                level: 'warning',
                where: at,
                rule: 'css-property',
                message: `"${name}" is not a property this kit knows (${CSS_PROPERTIES_SOURCE}) — new CSS passes here, a typo does not render`,
            });
        }
    };

    const byScope = new Map(manifest.components.map((c) => [c.scope, c]));

    /** component scope → the roles its `color` axis wires. Compared at the end. */
    const colorAxisByComponent = new Map<string, Set<string>>();

    /** axis → every value any recipe wires, for the declared-but-unwired check. */
    const wiredByAxis = new Map<string, Set<string>>();
    /** Every modifier any recipe wires — same check, but names have no values. */
    const wiredMods = new Set<string>();
    /**
     * The same harvest, kept per scope: `<scope>/<axis>` → wired values, with
     * modifiers under the pseudo-axis `modifiers`.
     *
     * A scope that declares its own vocabulary can be behind on it while the
     * design system as a whole is not — select promising `classic | surface`
     * and painting only `classic` is invisible to the union check above,
     * because button paints `surface`. That gap is the thing the per-scope
     * declaration exists to make statable (#294).
     */
    const wiredByScope = new Map<string, Set<string>>();
    const wireScoped = (scope: string, axis: string, value: string): void => {
        const key = `${scope}/${axis}`;
        let set = wiredByScope.get(key);
        if (!set) wiredByScope.set(key, (set = new Set()));
        set.add(value);
    };
    const wire = (axis: string, value: string): void => {
        let set = wiredByAxis.get(axis);
        if (!set) wiredByAxis.set(axis, (set = new Set()));
        set.add(value);
    };

    // ── every component the manifest declares should be styled ──
    const styled = new Set(recipes.map((r) => r.component));
    const unstyled = manifest.components.map((c) => c.scope).filter((s) => !styled.has(s));
    if (unstyled.length > 0) {
        warn(
            'recipes',
            `${unstyled.length} component(s) have no recipe and will render unstyled: ${unstyled.join(', ')}`,
        );
    }

    for (const recipe of recipes) {
        currentScope = recipe.component;
        const component = byScope.get(recipe.component);
        if (!component) continue; // already an error elsewhere
        const where = `recipes.${recipe.component}`;
        // The vocabulary THIS scope may key on — the union, narrowed by its
        // `tokens.scopes` entry. Identical to the union for a scope that
        // declares no restriction, which is every scope in a design system
        // that declares no `scopes` at all.
        const scoped = vocabulary.forScope(recipe.component);
        const local = locallyDefined(recipe);
        const partsByName = new Map(component.parts.map((p) => [p.name, p]));

        // ── component-token NAMES ──
        // `recipe.tokens` is emitted verbatim onto the carrier part, and
        // `declBlock` passes anything that is not a custom property through as
        // an ordinary declaration. So `tokens: { color: 'red' }` — a token
        // someone forgot the `--` on — silently restyles every carrier element
        // of the component instead of defining anything. The values are already
        // walked below; only the keys were unchecked.
        // The grammar is `--` plus the same kebab-case identifier every other
        // declared name uses, not merely "is a custom property": `--Btn_Accent`
        // is legal CSS and still wrong here, and a token nobody can predict the
        // spelling of is one nothing else can reference.
        for (const name of Object.keys(recipe.tokens ?? {})) {
            if (!name.startsWith('--')) {
                error(
                    `${where}.tokens`,
                    `"${name}" is not a custom property — component tokens must be spelled --like-this, ` +
                    'or it is emitted as a plain CSS declaration on every carrier element',
                );
            } else if (!TOKEN_KEY_PATTERN.test(name.slice(2))) {
                error(
                    `${where}.tokens`,
                    `component token "${name}" is not kebab-case — every other declared name in a design system is`,
                );
            }
        }

        // ── token references and literal values ──
        const values: Array<{ path: string; prop: string; value: string }> = [];
        for (const { path, props } of declarations(recipe)) {
            for (const [prop, raw] of Object.entries(props)) {
                values.push({ path, prop, value: String(raw) });
            }
        }
        for (const [name, body] of Object.entries(recipe.keyframes ?? {})) {
            values.push({ path: `keyframes.${name}`, prop: '', value: body });
        }
        if (recipe.css) values.push({ path: 'css', prop: '', value: recipe.css });

        for (const { path, prop, value } of values) {
            if (prop !== '') {
                checkProperty(prop, `${where}.${path}`);
            } else if (path.startsWith('keyframes.')) {
                // a keyframes body: a declaration there vanishes just as
                // silently, so its head is checked too. The raw `css` hatch
                // is deliberately not read — see DECLARATION_HEAD.
                for (const head of value.matchAll(DECLARATION_HEAD)) checkProperty(head[1]!, `${where}.${path}`);
            }
            for (const match of value.matchAll(VAR_REF)) {
                const token = match[1]!;
                const hasFallback = Boolean(match[2]);
                if (vocabulary.names.has(token) || local.has(token)) continue;
                const near = vocabulary.nearest(token);
                const hint = near ? ` — did you mean "${near}"?` : '';
                if (hasFallback) {
                    warn(
                        `${where}.${path}`,
                        `references undeclared token "${token}", but has a fallback so it still renders${hint}`,
                    );
                } else {
                    error(
                        `${where}.${path}`,
                        `references "${token}", which this design system never declares — it resolves to nothing${hint}`,
                    );
                }
            }

            if (!NOT_COLOR_VALUED.has(kebabProp(prop)) && !value.includes('"') && !value.includes("'")) {
                for (const literal of colorLiterals(value)) {
                    if (isScrim(literal)) continue;
                    warn(
                        `${where}.${path}`,
                        `hardcodes the color "${literal}" — reference a declared role so the design system can retheme it`,
                    );
                }
            }

            // A literal duration opts the rule out of prefers-reduced-motion,
            // which only collapses `var(--duration-*)`. Looping animations are
            // exempt: collapsing those speeds them up instead of stopping them.
            const isTiming = prop === 'transition' || prop.startsWith('transition');
            if (isTiming && BARE_TIME.test(value)) {
                warn(
                    `${where}.${path}`,
                    `"${prop}" uses a literal duration — reference var(--duration-*) so reduced motion applies`,
                );
            }
        }

        // ── physical directions where a logical property exists ──
        // Walked over `declarations` rather than the flat `values` above,
        // because the centring exemption needs the sibling declarations in the
        // same block, which flattening throws away.
        const drawn = drawnParts(recipe);
        for (const { path, props } of declarations(recipe)) {
            const part = partOf(path);
            if (part !== undefined && drawn.has(part)) continue;
            for (const [rawProp, raw] of Object.entries(props)) {
                const prop = kebabProp(rawProp);
                const twin = LOGICAL_TWIN[prop];
                if (!twin) continue;
                const value = String(raw);
                if (isCentring(prop, value, props)) continue;
                // `--press-x` is a pixel offset the runtime measures from the
                // element's own left edge (`behaviors/press.ts`), so `left` is
                // the correct pairing — a logical inset would put the ripple
                // somewhere the pointer never was.
                if (value.includes('--press-x')) continue;
                warn(
                    `${where}.${path}`,
                    `"${rawProp}" is a physical direction — use ${twin}, or this paints the same side ` +
                    'under `dir="rtl"` while everything around it mirrors',
                );
            }
        }
        for (const [name, body] of Object.entries(recipe.keyframes ?? {})) {
            for (const match of body.matchAll(PHYSICAL_IN_BODY)) {
                const prop = match[1]!;
                warn(
                    `${where}.keyframes.${name}`,
                    `"${prop}" is a physical direction — use ${LOGICAL_TWIN[prop]}, or the animation ` +
                    'travels the same way under `dir="rtl"` while the element it moves in mirrors',
                );
            }
        }
        // The raw escape hatch gets the same reading. It is not exempt: the
        // level here is `warning`, so nothing needs somewhere to hide, and
        // leaving one input unscanned would put a blind spot in the middle of a
        // check whose whole premise is that this bug class is otherwise
        // invisible. The property has to be at the head of a declaration, so a
        // `linear-gradient(to left, …)` or a `transform-origin: bottom left`
        // reads as the value it is.
        //
        // The one thing lost here is the drawn-glyph exemption — raw CSS has no
        // part to attribute a rotation to — so a glyph drawn through this route
        // warns. It stays advisory rather than being carved out: a rotated
        // border in a raw block is worth a second look either way.
        for (const match of (recipe.css ?? '').matchAll(PHYSICAL_IN_BODY)) {
            const prop = match[1]!;
            warn(
                `${where}.css`,
                `"${prop}" is a physical direction — use ${LOGICAL_TWIN[prop]}, or this paints the ` +
                'same side under `dir="rtl"` while everything around it mirrors',
            );
        }

        // ── presence: an entry animation without an exit ──
        //
        // `@starting-style` gives the state an element animates FROM, so a
        // part that declares it is asking for an entry animation. Two ways
        // that silently half-works, both checkable:
        //
        //  - no `transition` at all, so there is nothing to interpolate and
        //    the starting styles are simply never used;
        //  - a transition that doesn't carry `display`/`overlay` through
        //    `allow-discrete`, so the element is gone before the exit can
        //    play. The entry animates, the exit does not, and nothing says so.
        const declaresEntry = (styles: PartStyles): boolean =>
            Object.entries(styles.at ?? {}).some(
                ([key, nested]) =>
                    key === 'starting-style' || key.trim() === '@starting-style' || declaresEntry(nested),
            );
        const transitionValues = (styles: PartStyles): string[] => [
            ...[styles.base, ...Object.values(styles.states ?? {}), ...Object.values(styles.selectors ?? {})]
                .flatMap((block) => Object.entries(block ?? {}))
                .filter(([prop]) => prop === 'transition' || prop === 'transitionBehavior')
                .map(([, value]) => String(value)),
            ...Object.values(styles.at ?? {}).flatMap(transitionValues),
        ];
        // Every source of styles for a part, keyed by part: a variant can
        // carry an entry animation as readily as the base block, and its
        // transition may live in either.
        const partSources = new Map<string, PartStyles[]>();
        const addSource = (part: string, styles: PartStyles): void => {
            partSources.set(part, [...(partSources.get(part) ?? []), styles]);
        };
        for (const [part, styles] of Object.entries(recipe.parts)) addSource(part, styles);
        for (const values of Object.values(recipe.variants ?? {})) {
            for (const parts of Object.values(values)) {
                for (const [part, styles] of Object.entries(parts)) addSource(part, styles);
            }
        }
        for (const compound of recipe.compoundVariants ?? []) {
            for (const [part, styles] of Object.entries(compound.parts)) addSource(part, styles);
        }

        for (const [partName, sources] of partSources) {
            // Recursive: a responsive entry animation nests the starting
            // styles under the breakpoint, and needs the exit half just the same.
            if (!sources.some(declaresEntry)) continue;
            const transitions = sources.flatMap(transitionValues);
            if (transitions.length === 0) {
                warn(
                    `${where}.${partName}`,
                    'declares starting-style but never transitions, so the entry styles are never used',
                );
                continue;
            }
            // Both halves are needed, and they can live in separate
            // declarations (`transition-behavior` alongside a `transition`
            // list). `allow-discrete` on its own changes nothing if the list
            // holds only continuous properties like opacity — the element
            // still stops being rendered immediately.
            const allowsDiscrete = transitions.some((value) => value.includes('allow-discrete'));
            const movesDiscrete = transitions.some((value) =>
                DISCRETE_PRESENCE_PROPERTIES.some((prop) => new RegExp(`(^|[\\s,])${prop}([\\s,]|$)`).test(value)));
            if (!allowsDiscrete || !movesDiscrete) {
                warn(
                    `${where}.${partName}`,
                    'declares starting-style but does not transition a discrete property with allow-discrete — ' +
                    'the entry will animate and the exit will not, because the element stops being rendered ' +
                    'before it can play. Transition `display` (and `overlay`, for a top-layer popup) with ' +
                    'allow-discrete',
                );
            }
        }

        // ── press-animating without an animation ──
        //
        // The runtime removes `data-press-animating` the moment it sees no
        // CSS animation running on the part, so a rule gated on the flag that
        // never starts one is dead: it matches for zero frames. The held
        // state (`data-pressed`) is what a non-animated press effect keys on.
        {
            // Structural match, not a path-substring one: a variant VALUE named
            // "press-animating" is a legal (if odd) axis vocabulary entry and
            // must not trip this. A press-animating gate is exactly a
            // `states['press-animating']` block or a selector key that carries
            // `[data-press-animating]` outside `:not()` — a negated occurrence
            // styles the flag's ABSENCE and needs no animation.
            const gatesOnFlag = (sel: string): boolean =>
                sel.replace(/:not\(\s*\[data-press-animating\]\s*\)/g, '').includes('[data-press-animating]');
            const targets: Array<{ path: string; props: CssProps }> = [];
            const collect = (path: string, styles: PartStyles): void => {
                const pressState = styles.states?.['press-animating'];
                if (pressState) targets.push({ path: `${path}.states.press-animating`, props: pressState });
                for (const [sel, props] of Object.entries(styles.selectors ?? {})) {
                    if (gatesOnFlag(sel)) {
                        targets.push({ path: `${path}.selectors["${sel}"]`, props });
                    }
                }
                for (const [key, nested] of Object.entries(styles.at ?? {})) {
                    collect(`${path}.at["${key}"]`, nested);
                }
            };
            for (const [part, styles] of Object.entries(recipe.parts)) collect(`parts.${part}`, styles);
            for (const [axis, axisValues] of Object.entries(recipe.variants ?? {})) {
                for (const [value, parts] of Object.entries(axisValues)) {
                    for (const [part, styles] of Object.entries(parts)) {
                        collect(`variants.${axis}.${value}.${part}`, styles);
                    }
                }
            }
            const compounds = recipe.compoundVariants ?? [];
            for (let i = 0; i < compounds.length; i++) {
                for (const [part, styles] of Object.entries(compounds[i]!.parts)) {
                    collect(`compoundVariants[${i}].parts.${part}`, styles);
                }
            }
            // `animation: 'none'` starts nothing, so it counts for nothing.
            const startsAnimation = targets.some(({ props }) =>
                Object.entries(props).some(([p, v]) =>
                    (p === 'animation' || p === 'animationName') && String(v).trim() !== 'none'));
            if (targets.length > 0 && !startsAnimation) {
                warn(
                    `${where}.${targets[0]!.path}`,
                    'targets data-press-animating but never sets an animation — the runtime clears the flag ' +
                    'as soon as no animation is running, so the rule matches for zero frames. Start a ' +
                    'keyframe animation here, or key a non-animated press effect on data-pressed instead',
                );
            }
        }

        // ── focus-visible coverage ──
        const focusableParts = component.parts.filter((p) => (p.flags ?? []).includes('focus-visible'));
        if (focusableParts.length > 0) {
            // An EMPTY block doesn't count. `states: { 'focus-visible': {} }`
            // is the established "deliberately covered, no styling" idiom, so
            // accepting it here would let a recipe satisfy the rule while
            // rendering no visible ring at all — `skipStates` is how you say
            // the ring lives somewhere else.
            const stylesFocus = (styles: PartStyles | undefined): boolean => {
                if (!styles) return false;
                if (Object.keys(styles.states?.['focus-visible'] ?? {}).length > 0) return true;
                return Object.values(styles.at ?? {}).some(stylesFocus);
            };
            const anywhere = focusableParts.some((p) => stylesFocus(recipe.parts[p.name]));
            if (!anywhere) {
                error(
                    where,
                    `styles no focus-visible state, so keyboard focus is invisible on ${focusableParts.map((p) => p.name).join(', ')}`,
                );
            }
            for (const part of focusableParts) {
                const skipped = new Set(recipe.skipStates?.[part.name] ?? []);
                if (recipe.parts[part.name] && !stylesFocus(recipe.parts[part.name]) && !skipped.has('focus-visible')) {
                    warn(
                        `${where}.${part.name}`,
                        'declares focus-visible but does not style it — delegate deliberately by listing it in skipStates',
                    );
                }
            }
        }

        // ── skipStates must name something real ──
        for (const [partName, skipped] of Object.entries(recipe.skipStates ?? {})) {
            const part = partsByName.get(partName);
            if (!part) {
                error(`${where}.skipStates`, `"${partName}" is not a part of "${recipe.component}"`);
                continue;
            }
            const known = new Set(partVocabulary(part));
            for (const name of skipped) {
                if (!known.has(name)) {
                    error(
                        `${where}.skipStates.${partName}`,
                        `"${name}" is neither a state nor a flag of "${partName}" (has: ${[...known].join(', ') || 'none'})`,
                    );
                }
            }
        }

        // ── variant axes and values ──
        // Vocabulary membership is checked per axis. The rule is one
        // principle: an EXPLICIT declaration closes its set — colour against
        // `roles` (always declared, if only by default), variant against
        // `tokens.variants`, a custom axis against `tokens.axes`, size against
        // an explicitly declared `tokens.sizes` — all errors. Only the size
        // ramp resolved by DEFAULT stays advisory: the author never wrote the
        // set down, so a step outside it may be deliberate.
        //
        // Checked against the SCOPE's vocabulary (#294), which is the
        // design-system-wide one unless `tokens.scopes` narrowed it. A value
        // the scope declined gets its own message rather than the plain "not
        // declared" one: the latter sends an author to `tokens.variants`,
        // where they find the value already sitting there and no way forward.
        const declined = (axis: string, value: string, where_: string, site: string, own: readonly string[]): void => {
            error(
                where_,
                `"${value}" is not in ${recipe.component}'s ${axis} vocabulary (${own.join(', ') || 'none'}) — `
                + `tokens.scopes.${recipe.component} narrows the design-system-wide ${site}`,
            );
        };
        const checkMembership = (axis: string, value: string, where_: string): void => {
            if (axis === 'color') {
                // A colour key that names no declared role is dead CSS: zero
                // passes `data-color` through verbatim, so the selector is
                // emitted and simply never matches anything the design system
                // can produce.
                if (!scoped.roles.has(value)) {
                    if (scoped.restricted.has('color') && vocabulary.roles.has(value)) {
                        if (scoped.roles.size === 0) {
                            error(where_, `tokens.scopes.${recipe.component} declares no color axis (colors: []), so "color" cannot be wired here`);
                        } else {
                            declined('color', value, where_, 'tokens.roles', [...scoped.roles]);
                        }
                    } else {
                        error(where_, `"${value}" is not a declared role (${[...vocabulary.roles].join(', ')})`);
                    }
                }
            } else if (axis === 'size') {
                // Checked against the DESIGN SYSTEM's ramp, not a fixed one:
                // `tokens.sizes` if it declared its own (Material's density
                // steps, a numbered ramp), else the recommended xs–xl. A scope
                // that stated its own ramp has closed the set just as
                // deliberately, which is why `sizesDeclared` is true for it.
                if (!scoped.sizes.includes(value)) {
                    if (scoped.sizes.length === 0) {
                        // `sizes: []` — no size axis at all, so this is not a
                        // value off the ramp but a whole axis that should not
                        // exist. Either tier can make that claim.
                        error(
                            where_,
                            scoped.restricted.has('size')
                                ? `tokens.scopes.${recipe.component} declares no size axis (sizes: []), so "${axis}" cannot be wired here`
                                : `this design system declares no size axis (tokens.sizes is empty), so "${axis}" cannot be wired`,
                        );
                    } else if (scoped.restricted.has('size') && vocabulary.sizes.includes(value)) {
                        declined('size', value, where_, 'tokens.sizes', scoped.sizes);
                    } else if (scoped.sizesDeclared) {
                        error(where_, `"${value}" is not on this design system's declared size ramp (${scoped.sizes.join(', ')})`);
                    } else {
                        warn(where_, `"${value}" is not on this design system's size ramp (${scoped.sizes.join(', ')}) — declare it in tokens.sizes if it belongs there`);
                    }
                }
            } else if (axis === 'variant') {
                if (scoped.variants && !scoped.variants.includes(value)) {
                    if (scoped.restricted.has('variant')) {
                        if (scoped.variants.length === 0) {
                            error(where_, `tokens.scopes.${recipe.component} declares no variant axis (variants: []), so "variant" cannot be wired here`);
                        } else if (vocabulary.variants?.includes(value)) {
                            declined('variant', value, where_, 'tokens.variants', scoped.variants);
                        } else {
                            error(where_, `"${value}" is not a declared variant (${vocabulary.variants?.join(', ') ?? 'none'})`);
                        }
                    } else if (scoped.variants.length === 0) {
                        // `variants: []` design-system-wide — no variant axis
                        // at all (#200/#295), the same claim `sizes: []` makes
                        // above: not a value off the set but a whole axis
                        // that should not exist.
                        error(where_, `this design system declares no variant axis (tokens.variants is empty), so "${axis}" cannot be wired`);
                    } else {
                        error(where_, `"${value}" is not a declared variant (${scoped.variants.join(', ')})`);
                    }
                }
            } else if (scoped.axes && !RESERVED_AXES.has(axis)) {
                // Reserved axes already get their own error — a membership
                // complaint on top would be noise about the wrong problem.
                const declared = scoped.axes[axis];
                if (!declared) {
                    error(where_, `axis "${axis}" is not declared in tokens.axes (declared: ${Object.keys(scoped.axes).join(', ') || 'none'})`);
                } else if (!declared.includes(value)) {
                    if (scoped.restricted.has(axis)) {
                        if (declared.length === 0) {
                            error(where_, `tokens.scopes.${recipe.component} declares no "${axis}" axis (${axis}: []), so it cannot be wired here`);
                        } else if (vocabulary.axes?.[axis]?.includes(value)) {
                            declined(axis, value, where_, `tokens.axes.${axis}`, declared);
                        } else {
                            error(where_, `"${value}" is not a declared value of axis "${axis}" (${vocabulary.axes?.[axis]?.join(', ') ?? 'none'})`);
                        }
                    } else {
                        error(where_, `"${value}" is not a declared value of axis "${axis}" (${declared.join(', ')})`);
                    }
                }
            }
        };

        // A modifier has no vocabulary of values — the NAMES are the
        // vocabulary — so this is the whole membership rule for one.
        const checkModifier = (name: string, where_: string): void => {
            if (!TOKEN_KEY_PATTERN.test(name)) {
                error(where_, `modifier "${name}" is not a kebab-case identifier — it becomes the attribute name data-mod-${name}`);
            }
            if (scoped.modifiers && !scoped.modifiers.includes(name)) {
                if (scoped.restricted.has('modifiers') && scoped.modifiers.length === 0) {
                    error(where_, `tokens.scopes.${recipe.component} declares no modifiers (modifiers: []), so none can be wired here`);
                } else if (scoped.restricted.has('modifiers') && vocabulary.modifiers?.includes(name)) {
                    declined('modifier', name, where_, 'tokens.modifiers', scoped.modifiers);
                } else {
                    error(where_, `"${name}" is not a declared modifier (${vocabulary.modifiers?.join(', ') || 'none'})`);
                }
            }
        };

        for (const name of Object.keys(recipe.modifiers ?? {})) {
            checkModifier(name, `${where}.modifiers`);
            wiredMods.add(name);
            wireScoped(recipe.component, 'modifiers', name);
        }

        for (const [axis, values_] of Object.entries(recipe.variants ?? {})) {
            checkAxisName(axis, `${where}.variants`);
            // An axis with NO values is not a smaller axis, it is a broken
            // artifact downstream: the harvest records it, and the vendor-api
            // emitter would print `'axis'?: ;` — an empty union is a syntax
            // error inside a generated .d.ts, where skipLibCheck hides it.
            if (Object.keys(values_).length === 0) {
                error(
                    `${where}.variants.${axis}`,
                    `axis "${axis}" declares no values — remove the axis or wire at least one value`,
                );
            }
            for (const value of Object.keys(values_)) {
                checkAxisValue(axis, value, `${where}.variants.${axis}`);
                checkMembership(axis, value, `${where}.variants.${axis}`);
                wire(axis, value);
                wireScoped(recipe.component, axis, value);
            }
            // An axis outside the three with named props is fine — an app
            // sets it through zero's `axes` prop. What is NOT fine is taking a
            // name the anatomy contract already owns: `data-state` from
            // userland would make every `[data-state="open"]` rule in the
            // design system match the wrong thing, silently.
            if (RESERVED_AXES.has(axis)) {
                error(
                    `${where}.variants`,
                    `axis "${axis}" is part of the anatomy contract — data-${axis} already means something, and zero refuses to set it from \`axes\``,
                );
            }
            if (axis === 'color') {
                colorAxisByComponent.set(recipe.component, new Set(Object.keys(values_)));
            }
        }

        for (const compound of recipe.compoundVariants ?? []) {
            for (const [axis, value] of Object.entries(compound.match)) {
                // `true` means "this modifier must be present" — a different
                // grammar from an axis equality, so a different check.
                if (value === true) {
                    checkModifier(axis, `${where}.compoundVariants`);
                    wiredMods.add(axis);
                    wireScoped(recipe.component, 'modifiers', axis);
                    continue;
                }
                checkAxisName(axis, `${where}.compoundVariants`);
                checkAxisValue(axis, value, `${where}.compoundVariants.${axis}`);
                checkMembership(axis, value, `${where}.compoundVariants.${axis}`);
                // A compound REFINES single-axis rules; it cannot be the only
                // thing an axis or a value is wired by. The generated types
                // harvest compound match values into the axis union, so an axis
                // reachable only through a compound type-checks on its own and
                // then matches nothing — the exact "accepts it, styles nothing"
                // failure the axis vocabulary exists to make impossible.
                const axisValues = recipe.variants?.[axis];
                if (!axisValues) {
                    error(
                        `${where}.compoundVariants.${axis}`,
                        `"${axis}" is matched by a compound but this recipe never wires it in \`variants\` — ` +
                        `\`${axis}\` would be offered on its own and match nothing`,
                    );
                } else if (!Object.hasOwn(axisValues, value)) {
                    warn(
                        `${where}.compoundVariants.${axis}`,
                        `"${value}" is matched by a compound but "${axis}" wires no rule for it ` +
                        `(${Object.keys(axisValues).join(', ')}) — the combination styles it, the value alone does not`,
                    );
                }
                // Same rule as `variants`: a match key is a variant axis, and a
                // reserved one compiles to a selector the anatomy owns —
                // `[data-pressed="…"]` never matches a presence-only flag.
                if (RESERVED_AXES.has(axis)) {
                    error(
                        `${where}.compoundVariants`,
                        `axis "${axis}" is part of the anatomy contract — data-${axis} already means something, and zero refuses to set it from \`axes\``,
                    );
                }
                wire(axis, value);
                wireScoped(recipe.component, axis, value);
            }
        }

        // ── defaultVariants must select among what the recipe wires ──
        // Unconditional — it validates the recipe against ITSELF, so it needs
        // no declaration. `defaultVariants: { variant: 'ghots' }` is otherwise
        // a silent no-op: the default selects nothing and nothing reports it.
        for (const [axis, value] of Object.entries(recipe.defaultVariants ?? {})) {
            const wired = new Set([
                ...Object.keys(recipe.variants?.[axis] ?? {}),
                ...(recipe.compoundVariants ?? []).flatMap((c) => (c.match[axis] !== undefined ? [c.match[axis]] : [])),
            ]);
            if (wired.size === 0) {
                error(
                    `${where}.defaultVariants`,
                    `"${axis}" names an axis this recipe does not wire (wired: ${Object.keys(recipe.variants ?? {}).join(', ') || 'none'})`,
                );
            } else if (!wired.has(value)) {
                error(
                    `${where}.defaultVariants.${axis}`,
                    `"${value}" is not a value this recipe wires for "${axis}" (${[...wired].join(', ')})`,
                );
            }
        }

        // ── variant rules must be reachable from the carrier part ──
        //
        // A component with no `root` part carries the axis attributes on its
        // first declared part (dialog/popover/tooltip/menu: the trigger), and
        // its OTHER parts are top-layer siblings of that carrier — so a
        // variant rule for them compiles to an `@scope` donut rooted in an
        // element the part never sits under, and the rule is dead. Rules on
        // the carrier itself are flat and perfectly alive (#321 wires
        // exactly those), as are rules for any part whose declared `parent`
        // chain reaches the carrier.
        if (!partsByName.has('root')) {
            // Anatomies cannot be empty, so the fallback carrier always
            // exists — same invariant `carrierPart` in contract.ts relies on.
            const carrier = component.parts[0]!.name;
            const reachesCarrier = (name: string): boolean => {
                let cursor = partsByName.get(name);
                while (cursor) {
                    if (cursor.name === carrier) return true;
                    cursor = cursor.parent === undefined ? undefined : partsByName.get(cursor.parent);
                }
                return false;
            };
            const styledParts = new Set<string>([
                ...Object.values(recipe.variants ?? {}).flatMap((values) =>
                    Object.values(values).flatMap((parts) => Object.keys(parts))),
                ...Object.values(recipe.modifiers ?? {}).flatMap((parts) => Object.keys(parts)),
                ...(recipe.compoundVariants ?? []).flatMap((c) => Object.keys(c.parts)),
            ]);
            const dead = [...styledParts].filter((part) => !reachesCarrier(part));
            if (dead.length > 0) {
                error(
                    `${where}.variants`,
                    `"${recipe.component}" has no "root" part, so the variant attribute sits on "${carrier}" — ` +
                    `and ${dead.map((p) => `"${p}"`).join(', ')} never renders under it, so the generated ` +
                    'descendant selectors would not match and the rules are dead',
                );
            }
        }
    }
    // Everything from here down speaks at design-system level, or names its
    // own scope: leaving the last recipe's tag in place would misattribute it.
    currentScope = undefined;

    // ── the colour axis should mean the same thing on every component ──
    //
    // Zero passes `data-color` through verbatim, so `<Tabs.Root color="success">`
    // type-checks and emits the attribute whether or not any rule matches it.
    // A component wiring fewer roles than its siblings therefore fails
    // silently: the consumer gets the default colour and no diagnostic.
    //
    // Compared against the UNION the design system wires rather than against
    // its declared roles, so a role held back everywhere on purpose (a tonal
    // surface that is a fill, not an action colour) says nothing, while one
    // component lagging behind the others does.
    //
    // Intersected with what each scope's own vocabulary OFFERS (#294): a role
    // a scope declined in `tokens.scopes` is precisely the "held back on
    // purpose" case this warning already reasons about, now sayable per scope
    // instead of only design-system-wide.
    if (colorAxisByComponent.size > 1) {
        const wiredAnywhere = new Set(
            [...colorAxisByComponent.values()].flatMap((roles) => [...roles]),
        );
        for (const [scope, wired] of colorAxisByComponent) {
            const offered = vocabulary.forScope(scope).roles;
            const expected = [...wiredAnywhere].filter((role) => offered.has(role));
            const missing = expected.filter((role) => !wired.has(role));
            if (missing.length > 0) {
                warnFor(
                    scope,
                    `recipes.${scope}.variants.color`,
                    `wires ${wired.size} of the ${expected.length} roles other components style — `
                    + `color="${missing[0]}" renders as the default here but not elsewhere `
                    + `(missing: ${missing.join(', ')})`,
                );
            }
        }
    }

    // ── declared but wired by nothing ──
    // The inverse of the membership errors. A declared value no recipe
    // anywhere keys on reads as broken rather than as deliberately absent:
    // the app passes it, the attribute renders, nothing matches.
    //
    // Once a design system declares per-scope vocabularies this splits three
    // ways (#294), and the three say genuinely different things:
    //
    //  1. **Per scope** — a value in THIS scope's vocabulary that its own
    //     recipe wires nothing for. Invisible to (2), because a sibling may
    //     well be painting the same value.
    //  2. **Per design system** — a union value no recipe anywhere wires. The
    //     original check, unchanged.
    //  3. **Unclaimed** — a union value that belongs to no scope's vocabulary
    //     at all. Only meaningful once EVERY styled scope is restricted: while
    //     one is still open, its vocabulary is the whole union and no value
    //     can be claimed by nobody.
    const styledScopes = [...new Set(recipes.map((r) => r.component))];
    /** Per axis: is some styled scope still offering the whole union? */
    const unrestricted = (axis: string): boolean =>
        styledScopes.some((scope) => !vocabulary.forScope(scope).restricted.has(axis));

    const perScope = (axis: string, site: string, use: (value: string) => string): void => {
        for (const scope of styledScopes) {
            const own = vocabulary.forScope(scope);
            if (!own.restricted.has(axis)) continue;
            const declared = axis === 'variant' ? own.variants : axis === 'modifiers' ? own.modifiers : own.axes?.[axis];
            const wired = wiredByScope.get(`${scope}/${axis}`) ?? new Set();
            for (const value of declared ?? []) {
                if (!wired.has(value)) {
                    warnFor(
                        scope,
                        `tokens.scopes.${scope}.${site}`,
                        `"${value}" is in ${scope}'s vocabulary but its recipe wires no rule for it — ${use(value)} on a ${scope} selects nothing`,
                    );
                }
            }
        }
    };
    const unclaimed = (axis: string, site: string, union: readonly string[]): void => {
        if (unrestricted(axis)) return;
        for (const value of union) {
            const claimed = styledScopes.some((scope) => {
                const own = vocabulary.forScope(scope);
                const declared = axis === 'variant' ? own.variants : axis === 'modifiers' ? own.modifiers : own.axes?.[axis];
                return (declared ?? []).includes(value);
            });
            if (!claimed) {
                warn(
                    site,
                    `"${value}" is declared but belongs to no scope's vocabulary — add it to a tokens.scopes entry, or drop it from the union`,
                );
            }
        }
    };

    if (vocabulary.variants) {
        const wired = wiredByAxis.get('variant') ?? new Set();
        for (const value of vocabulary.variants) {
            if (!wired.has(value)) {
                warn('tokens.variants', `"${value}" is declared but no recipe wires it — variant="${value}" selects nothing`);
            }
        }
        perScope('variant', 'variants', (v) => `variant="${v}"`);
        unclaimed('variant', 'tokens.variants', vocabulary.variants);
    }
    for (const [axis, values] of Object.entries(vocabulary.axes ?? {})) {
        const wired = wiredByAxis.get(axis) ?? new Set();
        for (const value of values) {
            if (!wired.has(value)) {
                warn(`tokens.axes.${axis}`, `"${value}" is declared but no recipe wires it — axes={{ ${axis}: '${value}' }} selects nothing`);
            }
        }
        perScope(axis, `axes.${axis}`, (v) => `axes={{ ${axis}: '${v}' }}`);
        unclaimed(axis, `tokens.axes.${axis}`, values);
    }
    if (vocabulary.modifiers) {
        for (const name of vocabulary.modifiers) {
            if (!wiredMods.has(name)) {
                warn('tokens.modifiers', `"${name}" is declared but no recipe wires it — mods={{ '${name}': true }} selects nothing`);
            }
        }
        perScope('modifiers', 'modifiers', (n) => `mods={{ '${n}': true }}`);
        unclaimed('modifiers', 'tokens.modifiers', vocabulary.modifiers);
    }

    return issues;
}
