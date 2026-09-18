/**
 * The layout attribute family: the closed vocabulary, the parse, and the
 * projection from props onto attributes.
 *
 * A module of its own for two reasons. It is `lib.dom`-free, so a platform
 * without DOM types can import it — the same split that separates
 * `variant-attrs.ts` from `props.ts`. And the vocabulary must NOT live in
 * `data-attrs.ts`: every component imports that module (for `Orientation`,
 * `dataAttr`, `stateAttr`), `LAYOUT_ATTR_NAMES` is a module-level `new Set`
 * the bundler cannot prove pure, and the table therefore rode into every
 * component's bundle — measurably, three subpaths went over their size
 * budget. A table only the layout tier reads has no business on that path.
 */
import { TOKEN_KEY_PATTERN } from './tokens.js';
import type { ZeroBreakpointName } from './vocabulary.js';

/**
 * The closed layout-attribute vocabulary — the geometry half of the contract,
 * rendered under the `data-l-` prefix and declared per part as `PartSpec.layout`.
 *
 * ## Why this is a family of its own, and not an axis
 *
 * A design-system AXIS answers "which one" out of a vocabulary the skin
 * invents (`solid`, `danger--tertiary`); zero passes it through and attaches
 * no meaning. A layout attribute answers "how much" out of a ramp the TOKEN
 * contract already fixes — `gap="md"` means the `md` rung of `--space-*`, and
 * it has to mean that in every design system or a page laid out against one
 * skin falls apart under the next. Modelling it as an axis would make every
 * skin declare `tokens.axes.gap`, and `harvestAxes` would surface it as
 * `components.stack.axes.gap` in `register.d.ts`: a per-skin vocabulary for
 * the one thing that must not vary.
 *
 * ## Why the `data-l-` prefix
 *
 * The same reasoning as `MOD_ATTR_PREFIX` (see `WithMods`), plus an ambiguity
 * that only shows up here.
 *
 * Responsive values render as a second attribute with the breakpoint in
 * PREFIX position — `data-l-gap="sm" data-l-md-gap="lg"`. Unprefixed and with
 * the breakpoint on the tail, `data-gap-x` would read as both "the x-axis
 * gap" and "gap at a breakpoint named `x`", and breakpoint names are open
 * kebab-case, so nothing disambiguates them. Prefix position makes the parse
 * "strip the prefix, then split once" — see {@link parseLayoutAttr}.
 *
 * The namespace also keeps ~15 extremely ordinary words (`gap`, `align`,
 * `space`, `track`…) out of `RESERVED_AXES`. Unprefixed they would each have
 * to be reserved forever, for every design system in the ecosystem, and a
 * skin that legitimately wants an axis called `align` would start failing
 * validation.
 */
export const LAYOUT_ATTR_PREFIX = 'data-l-';

/**
 * The key {@link Responsive} uses for the UNQUALIFIED value, and therefore a
 * name no breakpoint may take: `{ base: 'md' }` renders `data-l-gap="md"`,
 * not `data-l-base-gap="md"`. A design system that declared a breakpoint
 * called `base` could never reach it — `@sigx/zero-kit` refuses the
 * declaration for that reason, the way it already refuses one colliding with
 * a built-in condition.
 */
export const BASE_BREAKPOINT_KEY = 'base';

/** One layout attribute: its closed value set, and whether it varies per breakpoint. */
export interface LayoutAttrSpec {
    readonly values: readonly string[];
    /**
     * True when the attribute may also be written per breakpoint
     * (`data-l-<bp>-<attr>`). Deliberately not universal: `wrap`, `grow`,
     * `track` and `axis` describe what a box IS rather than how much room it
     * takes, and each responsive attribute multiplies the emitted CSS by the
     * number of declared breakpoints.
     */
    readonly responsive?: true;
}

/**
 * The spacing ramp as an attribute vocabulary: `TOKEN_CATEGORIES.space`'s
 * recommended keys, plus `none`.
 *
 * Closed on purpose, and this is the point rather than a limitation — a
 * layout prop cannot spell a value the ramp does not have, so an app cannot
 * write `gap: 13px` and a `[data-density="compact"]` redefinition of
 * `--space-*` re-spaces every layout in the app at once. A design system with
 * extra spacing keys still uses them freely in its own recipes; what it
 * cannot do is expose a rung the other five skins have no answer for.
 */
export const SPACE_STEPS = ['none', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const;

/** Column/span counts — a twelve-column grid, the one every layout system agrees on. */
const TRACK_COUNTS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'] as const;

export const LAYOUT_VOCABULARY = {
    gap: { values: SPACE_STEPS, responsive: true },
    'gap-x': { values: SPACE_STEPS },
    'gap-y': { values: SPACE_STEPS },
    pad: { values: SPACE_STEPS, responsive: true },
    'pad-x': { values: SPACE_STEPS },
    'pad-y': { values: SPACE_STEPS },
    align: { values: ['start', 'center', 'end', 'stretch', 'baseline'], responsive: true },
    justify: { values: ['start', 'center', 'end', 'between', 'around', 'evenly'], responsive: true },
    wrap: { values: ['wrap', 'nowrap', 'wrap-reverse'] },
    /** `auto` is `repeat(auto-fit, minmax(<track>, 1fr))` — the responsive grid without a breakpoint. */
    cols: { values: [...TRACK_COUNTS, 'auto'], responsive: true },
    span: { values: [...TRACK_COUNTS, 'full'], responsive: true },
    /** Minimum track width for `cols="auto"`; the design system picks the lengths. */
    track: { values: ['xs', 'sm', 'md', 'lg', 'xl'] },
    grow: { values: ['0', '1'] },
    /** Which axis a Center centers on. */
    axis: { values: ['both', 'inline', 'block'] },
    /** Spacer's fixed size; absent means it flexes. */
    space: { values: SPACE_STEPS },
    /**
     * A Container's maximum width — a rung of the `--measure-*` ramp, or
     * `full` for no bound at all.
     *
     * Deliberately NOT the `size` axis. A container's width is a different
     * question from a control's size: `size="lg"` on a Button means a
     * chunkier button, and on a Container it would mean a wider page. Those
     * ramps have no reason to move together, and `prose` — a reading measure
     * in `ch` — is not a size at all.
     */
    measure: { values: ['xs', 'sm', 'md', 'lg', 'xl', 'prose', 'full'] },
} as const satisfies Record<string, LayoutAttrSpec>;

export type LayoutAttrName = keyof typeof LAYOUT_VOCABULARY;

/**
 * The literal value union of one layout attribute — what a component's prop
 * should be typed as.
 *
 * `LAYOUT_VOCABULARY` is `as const satisfies`, so each `values` is a literal
 * tuple rather than `string[]`, and indexing it gives real autocomplete:
 * `LayoutValue<'gap'>` is `'none' | '2xs' | … | '2xl'`. Closed on purpose —
 * unlike an axis, whose vocabulary belongs to the design system, a layout
 * value is contract data zero owns, so a typo should be a compile error
 * rather than an attribute that matches nothing.
 */
export type LayoutValue<A extends LayoutAttrName> = typeof LAYOUT_VOCABULARY[A]['values'][number];

/** Every layout attribute name, flat — the membership check's set. */
export const LAYOUT_ATTR_NAMES: ReadonlySet<string> = new Set(Object.keys(LAYOUT_VOCABULARY));

/**
 * One attribute's spec, widened to {@link LayoutAttrSpec}.
 *
 * `LAYOUT_VOCABULARY` is `as const satisfies`, so indexing it yields a union
 * of literal object types in which `responsive` is absent from some members —
 * reading it off the union is an error even though every member satisfies the
 * interface. Widening once here keeps the literal `values` tuples available
 * to type-level consumers while giving the runtime a single uniform shape.
 */
export const layoutAttrSpec = (attr: LayoutAttrName): LayoutAttrSpec => LAYOUT_VOCABULARY[attr];

/**
 * Attribute names longest-first — the scan order {@link parseLayoutAttr}
 * needs so `md-gap-x` resolves to the attribute `gap-x` rather than stopping
 * at `gap` and leaving a breakpoint of `md-gap`.
 */
const ATTRS_LONGEST_FIRST: readonly LayoutAttrName[] =
    (Object.keys(LAYOUT_VOCABULARY) as LayoutAttrName[]).sort((a, b) => b.length - a.length);

/**
 * Split a rendered layout attribute back into its parts, or `undefined` when
 * the name is not one of ours.
 *
 * `data-l-gap` → `{ attr: 'gap' }`; `data-l-gap-x` → `{ attr: 'gap-x' }`;
 * `data-l-md-gap` → `{ attr: 'gap', breakpoint: 'md' }`.
 *
 * The base name is tried WHOLE before any split, which is what keeps the
 * multi-word attributes (`gap-x`) unambiguous. Failing that, the ATTRIBUTE is
 * matched as a suffix, longest first — not the breakpoint as a prefix.
 * Splitting at the first hyphen would read `data-l-tablet-lg-gap` as
 * breakpoint `tablet` + attribute `lg-gap` and reject it, and a breakpoint
 * name may legitimately contain a hyphen: the kit holds them to
 * `TOKEN_KEY_PATTERN`, the same grammar that allows `gap-x`. Matching from
 * the end works because the attribute vocabulary is closed and the
 * breakpoint set is not — the known half is the half worth anchoring on.
 *
 * A breakpoint that is not kebab-case is refused here exactly as
 * {@link layoutAttrs} refuses to emit one, so the two halves of the round
 * trip cannot disagree about what is a legal name.
 */
export function parseLayoutAttr(name: string): { attr: LayoutAttrName; breakpoint?: string } | undefined {
    if (!name.startsWith(LAYOUT_ATTR_PREFIX)) return undefined;
    const rest = name.slice(LAYOUT_ATTR_PREFIX.length);
    if (LAYOUT_ATTR_NAMES.has(rest)) return { attr: rest as LayoutAttrName };
    for (const attr of ATTRS_LONGEST_FIRST) {
        const suffix = `-${attr}`;
        if (!rest.endsWith(suffix)) continue;
        const breakpoint = rest.slice(0, rest.length - suffix.length);
        if (breakpoint.length === 0) return undefined;
        // The longest attribute match is THE interpretation: falling back to
        // a shorter one would let `md-gap-x` be re-read as a breakpoint of
        // `md-gap` the moment `gap-x` turned out not to be responsive.
        if (!layoutAttrSpec(attr).responsive) return undefined;
        if (!TOKEN_KEY_PATTERN.test(breakpoint)) return undefined;
        // `base` names the unqualified value, so `data-l-base-gap` is a name
        // `layoutAttrs` can never write. Accepting it here would let
        // `expectAnatomy` pass a render no stylesheet targets.
        if (breakpoint === BASE_BREAKPOINT_KEY) return undefined;
        return { attr, breakpoint };
    }
    return undefined;
}

/**
 * A layout value, optionally varying per breakpoint.
 *
 * ```tsx
 * <Grid cols={4} />
 * <Grid cols={{ base: 1, md: 2, xl: 4 }} />
 * ```
 *
 * `base` is the unqualified value — spelled out rather than implied, because
 * `{ md: 2 }` alone is a legitimate thing to write (vary only above `md`) and
 * a bare-value-plus-record union would make the reader guess which half a
 * lone key belonged to.
 *
 * The record's keys are {@link ZeroBreakpointName}, the CLOSED union: with a
 * design system's `/register` imported, a breakpoint it never declared is a
 * compile error rather than an attribute that silently matches nothing.
 */
export type Responsive<T> = T | ({ base?: T } & Partial<Record<ZeroBreakpointName, T>>);

/**
 * The number a fully numeric attribute value also accepts.
 *
 * `cols={4}` is how every consumer will write it — `cols="4"` reads as a
 * typo — and {@link layoutAttrs} stringifies accordingly. The twin belongs on
 * the PROP rather than on {@link LayoutValue}: the rendered attribute is
 * always a string, so the value union stays the set of values, and this is
 * the boundary where a number is allowed in. `'2xs'` is not fully numeric
 * and therefore contributes nothing.
 */
type NumericTwin<V> = V extends `${infer N extends number}` ? N : never;

/** One attribute's accepted values at the prop boundary: its union, plus the numeric twin. */
type LayoutPropValue<A extends LayoutAttrName> = LayoutValue<A> | NumericTwin<LayoutValue<A>>;

/**
 * The prop type of one layout attribute — its accepted values, wrapped in
 * {@link Responsive} only when the vocabulary says it varies per breakpoint.
 *
 * DERIVED from `LAYOUT_VOCABULARY` rather than written per prop, because the
 * two can otherwise disagree: typing a non-responsive attribute as
 * `Responsive<…>` lets `gapX={{ md: 'lg' }}` compile and then throw at
 * runtime, which is the opposite of what the closed vocabulary is for. The
 * conditional makes that shape unrepresentable.
 */
export type LayoutProp<A extends LayoutAttrName> =
    typeof LAYOUT_VOCABULARY[A] extends { responsive: true }
        ? Responsive<LayoutPropValue<A>>
        : LayoutPropValue<A>;

/** The layout props a part accepts, as a bag keyed by attribute name. */
export type LayoutProps = { [A in LayoutAttrName]?: LayoutProp<A> | undefined };

/**
 * The responsive form is a plain object. An ARRAY is not one, and the
 * distinction has to be made explicitly: `typeof [] === 'object'`, so a
 * permissive check turns `gap={['md']}` into `data-l-0-gap="md"` — an
 * attribute named after an array index, which no stylesheet will ever match.
 * `Responsive<T>` does not admit an array, so this only guards the untyped
 * caller; it throws rather than drops, like every other guard here.
 */
const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Build the `data-l-*` attributes for a part from its layout props.
 *
 * `spec` is the part's declared `layout` list. An attribute the part never
 * declared THROWS rather than being dropped, for `variantAttrs`' reason: the
 * value comes from application code, not user input, and a silently missing
 * attribute is the exact failure this whole mechanism exists to remove. A
 * value outside the attribute's closed set throws for the same reason —
 * unlike an axis, whose vocabulary belongs to the design system and which
 * zero therefore cannot check, a layout value is contract data zero owns.
 *
 * An `undefined` value is skipped before the guards run, so an unset optional
 * prop neither throws nor emits an attribute.
 */
export function layoutAttrs(
    props: LayoutProps,
    spec: readonly string[] | undefined,
): Record<string, string | undefined> {
    const attrs: Record<string, string | undefined> = {};
    const declared = spec ?? [];
    for (const [name, value] of Object.entries(props)) {
        if (value === undefined) continue;
        const attr = name as LayoutAttrName;
        // Vocabulary membership BEFORE the declared check, because it is the
        // more fundamental error and because the declared list is not itself
        // guaranteed sound: `defineAnatomy` carries no runtime guard (it is
        // on every component's size budget), so a typo'd `layout: ['gutter']`
        // would satisfy `declared.includes` and then dereference an undefined
        // spec — a bare "cannot read properties of undefined" where every
        // other path here names what went wrong.
        if (!LAYOUT_ATTR_NAMES.has(attr)) {
            throw new Error(
                `[zero] layout: "${attr}" is not a layout attribute (known: ${[...LAYOUT_ATTR_NAMES].join(', ')})`,
            );
        }
        if (!declared.includes(attr)) {
            throw new Error(
                `[zero] layout: this part does not declare "${attr}" — add it to the part's \`layout\` in its anatomy, or drop the prop`,
            );
        }
        const vocabulary = layoutAttrSpec(attr);
        const put = (breakpoint: string | undefined, raw: unknown): void => {
            if (raw === undefined) return;
            const v = String(raw);
            if (!vocabulary.values.includes(v)) {
                throw new Error(
                    `[zero] layout: "${v}" is not a value of "${attr}" (expected one of: ${vocabulary.values.join(', ')})`,
                );
            }
            if (breakpoint !== undefined) {
                // The key becomes part of an attribute NAME, so it answers to
                // the same grammar `variantAttrs` holds axis names to.
                // `data-*` names are case-sensitive and the lynx class
                // grammar carries them unescaped, so `Md` or `md!` would
                // render something that matches nothing, silently — which is
                // the failure this module exists to remove. Whether the
                // breakpoint is one the design system DECLARED is a question
                // only the design system can answer; the type does that under
                // `/register`.
                if (!TOKEN_KEY_PATTERN.test(breakpoint)) {
                    throw new Error(
                        `[zero] layout: "${breakpoint}" is not a kebab-case breakpoint name — it becomes the attribute name ${LAYOUT_ATTR_PREFIX}${breakpoint}-${attr}`,
                    );
                }
            }
            attrs[`${LAYOUT_ATTR_PREFIX}${breakpoint === undefined ? '' : `${breakpoint}-`}${attr}`] = v;
        };
        // An array is neither form, and it cannot be left to fall through to
        // the bare-value path: `String(['md'])` is `'md'`, so a one-element
        // array passes the value check and emits a perfectly valid attribute
        // by accident. Two elements would have failed. Rejected explicitly so
        // the two cases behave the same way.
        if (Array.isArray(value)) {
            throw new Error(
                `[zero] layout: "${attr}" takes a value or a breakpoint record, not an array`,
            );
        }
        // A record is the responsive form; anything else is the bare value.
        // `number` is deliberately accepted and stringified — `cols={4}` is
        // how every consumer will write it, and `cols="4"` reads as a typo.
        if (isRecord(value)) {
            // Checked on the RECORD, not per key. Gating this on "a
            // breakpoint was present" let `{ base: 'wrap' }` through on a
            // non-responsive attribute, because `base` resolves to no
            // breakpoint at all — so the one message that says "pass a single
            // value rather than a record" was accepting a record.
            if (!vocabulary.responsive) {
                throw new Error(
                    `[zero] layout: "${attr}" does not vary per breakpoint — pass a single value rather than a record`,
                );
            }
            for (const [key, inner] of Object.entries(value)) {
                put(key === BASE_BREAKPOINT_KEY ? undefined : key, inner);
            }
        } else {
            put(undefined, value);
        }
    }
    return attrs;
}
