/**
 * The coverage report — what a design system *covers*, as opposed to what is
 * wrong with it (docs/architecture.md, "The authoring surface").
 *
 * `validateDesignSystem` answers "is this correct". It returns a flat list of
 * issues, which is what an author needs while fixing one. It never answers "how
 * much of the contract did I actually skin", which is what a reviewer — human
 * or otherwise — needs when looking at a generated design system for the first
 * time. This module answers that, in a shape a tool can read: Tier-3 rows of
 * the conformance matrix are generated from it, so they cannot go stale by hand.
 *
 * Target-neutral by construction. Everything here reads the compiled design
 * system, the authoring input and the anatomy manifest; nothing reads emitted
 * CSS, and nothing is web-specific.
 *
 * Two properties are load-bearing and deliberately not re-derived:
 *
 * - **The `never` set matches the register artifact.** `undeclaredAxes` and the
 *   empty-harvest test both live in `design-system.ts`, and `compileRegisterDts`
 *   reads the same two. A component's `never` here is exactly the set of axes
 *   typed `never` there — the gate #173 puts on this report.
 * - **Divergence keeps the colour rule's semantics** (`validate-recipes.ts`):
 *   compared against the union wired ANYWHERE rather than against the declared
 *   vocabulary, so a value held back everywhere on purpose says nothing while a
 *   component lagging behind its siblings does.
 */
import { parse, wcagContrast } from 'culori';
import type { ManifestComponent, ManifestPart, ZeroManifest } from '../contract.js';
import { contrastPairs } from '../contract.js';
import type { CompiledDesignSystem, DesignSystemInput } from '../design-system.js';
import { axisClaims, offeredFor, undeclaredAxes } from '../design-system.js';
import type { ScopeVocabulary } from '../tokens.js';
import type { PartStyles, RecipeInput } from '../recipes.js';
import type { DesignSystemApi, MappedGrade } from '../api.js';
import { apiGrade, modifierGrade } from '../api.js';
import type { ValidationResult } from './validate.js';
import type { ContrastMatrix } from '../audit/contrast/matrix.js';
import type { ReportScore } from './score.js';
import { computeScore, formatScore } from './score.js';
import type { AuditResult, AuditRuleId } from '../audit/types.js';

/** The contract axes, in the order the register artifact emits them. */
const CONTRACT_AXES = ['color', 'size', 'variant'] as const;
type ContractAxis = (typeof CONTRACT_AXES)[number];

export const REPORT_SCHEMA_URL = 'https://signalxjs.github.io/zero/schemas/report.schema.json';

/**
 * Whether an axis is wired, left unwired, or declared out of existence.
 *
 * `undeclared` is reachable for every named axis — see `undeclaredAxes`.
 * Both non-`wired` states produce `never` in the register artifact; they differ
 * only in what an author should do about it, which is why the report keeps them
 * apart rather than collapsing to a boolean.
 */
export type AxisStatus = 'wired' | 'unwired' | 'undeclared';

export interface AxisReport {
    /** The values this component's recipe wires, sorted. */
    wired: string[];
    status: AxisStatus;
    /**
     * The values this component's scope vocabulary OFFERS, sorted — present
     * only when `tokens.scopes` restricts this axis for this scope (#294).
     * `wired` is what the recipe delivers against it; the gap between the two
     * is what the coverage guard reports.
     */
    offered?: string[];
}

/**
 * How one part's declared vocabulary is covered.
 *
 * `coveredIndirectly` is the honest middle: a state styled only inside an `at`
 * condition, a variant block, a compound or a modifier IS styled, but not
 * unconditionally — and the validator's coverage warning deliberately only
 * looks at `parts.<part>.states`. Splitting the two lets the report be more
 * thorough than that warning without contradicting it.
 */
export interface CoverageSplit {
    covered: string[];
    coveredIndirectly: string[];
    /** Listed in the recipe's `skipStates` — deliberately delegated elsewhere. */
    skipped: string[];
    uncovered: string[];
}

export interface PartReport {
    /**
     * Whether the recipe styles this part anywhere — `parts.<name>`, a variant
     * or compound block, or a modifier. A part reached only through a variant
     * is styled, so this agrees with the coverage buckets below rather than
     * with the shape of the authoring input.
     */
    styled: boolean;
    /** Coverage of `ManifestPart.states` — the closed `data-state` vocabulary. */
    states: CoverageSplit;
    /** Coverage of `ManifestPart.flags` — the presence-only flags. */
    flags: CoverageSplit;
}

export interface StyledComponentReport {
    styled: true;
    axes: Record<ContractAxis, AxisReport>;
    /** Custom axes (`tokens.axes`) this recipe wires: name → sorted values. */
    customAxes: Record<string, string[]>;
    /** Presence-only modifiers this recipe wires, sorted. */
    mods: string[];
    /** The recipe's `defaultVariants`, when it has any. */
    defaults?: Record<string, string>;
    /**
     * The contract axes typed `never` by this design system's register
     * artifact, sorted. Present only on styled components — `compileRegisterDts`
     * emits no entry at all for a scope with no recipe.
     */
    never: string[];
    parts: Record<string, PartReport>;
}

export interface UnstyledComponentReport {
    styled: false;
    /** Always empty: with no recipe there is nothing to cover, part by part. */
    parts: Record<string, never>;
}

export type ComponentReport = StyledComponentReport | UnstyledComponentReport;

export interface AxisDivergence {
    /** Every value any component wires for this axis, sorted. */
    wiredAnywhere: string[];
    /** scope → its sorted value set. Only components wiring at least one value. */
    byComponent: Record<string, string[]>;
    /**
     * Components wiring a STRICT subset of `wiredAnywhere` — the divergence
     * the report exists to surface. A component wiring nothing is not listed:
     * that is not divergence, and it is already visible as `never`.
     */
    subsets: Array<{ scope: string; wired: string[]; missing: string[] }>;
    /**
     * Of `subsets`, the scopes whose narrower set is exactly what their scope
     * vocabulary declared (#294). A declared narrowing is not divergence — it
     * is the design system saying what it means — so without this the report
     * would start crying wolf the moment `tokens.scopes` is used.
     */
    declared: string[];
}

export interface ThemeContrastReport {
    name: string;
    colorScheme: 'light' | 'dark';
    pair?: string;
    /**
     * The smallest WCAG ratio across every declared role pair, rounded to two
     * decimals — the margin the theme has left. `null` when no pair could be
     * measured (a theme missing or mis-spelling its colour tokens, which the
     * validator reports as errors of its own).
     */
    minContrast: number | null;
    worstPair: [string, string] | null;
    /** Pairs below the 3:1 hard floor, and below the 4.5:1 AA text threshold. */
    belowMin: number;
    belowAA: number;
    pairs: Array<{ bg: string; fg: string; ratio: number }>;
}

/**
 * One surface of the vendor-named component API (issue #179): the prop the
 * `./components` module exposes, where it routes, and the conformance
 * fidelity grade — derived from the same declaration the emitter consumes, so
 * a conformance-matrix row generated from this report cannot claim a mapping
 * the artifact doesn't implement.
 */
export interface ApiSurfaceReport {
    /** The vendor prop consumers write (`kind`, `isIconOnly`). */
    prop: string;
    /** Where it routes: `color`, `size`, `variant`, `axes.<axis>` or `mods.<modifier>`. */
    zero: string;
    /** Never `unsupported` — an unmapped surface has no row (see `MappedGrade`). */
    grade: MappedGrade;
    /** Vendor spellings that differ from the zero value they map to. Sorted. */
    respelled: string[];
}

/**
 * One theme of the static contrast matrix, summarised (#403). The full cell
 * table lives on `AuditResult.contrast`; this is what a reviewer reads
 * first — how much was measured, how much of it failed, and what the
 * estimate could not judge, by reason, so `unmeasured` is a number on the
 * record rather than a silent gap.
 */
export interface ContrastReportTheme {
    name: string;
    /** Every cell the matrix produced for this theme. */
    cells: number;
    /** Cells with a ratio: `cells` minus unmeasured, unrendered and unpainted. */
    measured: number;
    /** Below the 3:1 floor. */
    failing: number;
    /** In the 3:1–4.5:1 band. */
    warnings: number;
    /** `disabled` cells whose pre-fade pair is below 2:1. */
    disabledFailing: number;
    unrendered: number;
    unpainted: number;
    /** Reason → how many cells the estimate could not judge for it. */
    unmeasured: Record<string, number>;
    /** The ten lowest measured ratios, worst first. */
    worst: Array<{ key: string; ratio: number; ink: string; bg: string }>;
}

export interface DesignSystemReport {
    $schema: string;
    reportVersion: 2;
    name: string;
    /**
     * The composite score (`score.ts`): five named criteria weighted into a
     * total and a letter grade — the scalar a generating agent iterates
     * against. Derived from the sections below, never from anything else.
     */
    score: ReportScore;
    /**
     * The lynx target's capability findings — present only when the build
     * ran with `targets: ['web', 'lynx']`. What the lynx emitters translated
     * or dropped, so "what did the lynx copy lose" has one answer, in the
     * same file that already answers "what did this design system ship".
     */
    lynx?: {
        translated: { where: string; what: string; detail: string }[];
        dropped: { where: string; what: string; detail: string }[];
        /**
         * Ecosystem scopes excluded from the lynx target because their pack's
         * recipe references a web-runtime mechanism the emitter refuses.
         * Present only when a discovered pack hit that: a first-party recipe
         * in the same position fails the build instead.
         */
        webOnly?: { scope: string; package: string; reason: string }[];
    };
    coverage: {
        componentsStyled: number;
        componentsTotal: number;
        /** Manifest scopes with no recipe — they render unstyled. Sorted. */
        unstyled: string[];
    };
    vocabulary: {
        roles: string[];
        sizes: string[];
        variants: string[];
        axes: Record<string, string[]>;
        modifiers: string[];
        /** Axes declared OUT of existence (`roles: {}`, `sizes: []`), sorted. */
        declaredOut: string[];
        /**
         * Per-scope restrictions of the vocabularies above, as declared (#294)
         * — `{}` when the design system declares none, which is what makes the
         * lists above the whole vocabulary rather than a union.
         */
        scopes: Record<string, ScopeVocabulary>;
    };
    /**
     * Declared, but wired by no recipe anywhere — the attribute renders and
     * matches nothing. The validator warns for `variant`, custom axes and
     * modifiers; `color` and `size` have no such check, so for those this is
     * the only place the gap surfaces.
     */
    unwired: {
        color: string[];
        size: string[];
        variant: string[];
        axes: Record<string, string[]>;
        modifiers: string[];
    };
    /**
     * Declared, but in NO scope's vocabulary — the union carries a value that
     * belongs to nobody (#294). Distinct from `unwired`, which is about what
     * the recipes paint; this is about what the declaration promises. Only
     * ever populated once every styled scope is restricted for that axis:
     * while one is still open its vocabulary IS the union, so nothing can be
     * unclaimed.
     */
    unclaimed: {
        color: string[];
        size: string[];
        variant: string[];
        axes: Record<string, string[]>;
        modifiers: string[];
    };
    components: Record<string, ComponentReport>;
    /** Axis name → its per-component partition. `mods` is included as an axis. */
    divergence: Record<string, AxisDivergence>;
    themes: ThemeContrastReport[];
    /**
     * The static contrast matrix, per theme — present when the report was
     * built beside an audit that computed it (an audit that carried it).
     * Declared-pair contrast (`themes`) says what the tokens promise; this
     * says what the recipe cascade produces when states combine.
     */
    contrast?: ContrastReportTheme[];
    /**
     * The vendor-named component API surfaces, sorted by prop — present only
     * when the design system declares an `api`.
     */
    api?: ApiSurfaceReport[];
    issues?: { errors: number; warnings: number };
    /**
     * The audit's counts (`auditDesignSystem`, #403) — present when the
     * report was built beside an audit, which `runStandardBuild` and
     * `zero:validate --report` both do, so `dist/report.json` and the
     * command's report agree. The findings themselves live in
     * `dist/audit.json`; this is the summary the score reads.
     */
    audit?: {
        auditVersion: 1;
        errors: number;
        warnings: number;
        info: number;
        byRule: Partial<Record<AuditRuleId, number>>;
    };
}

const sorted = (values: Iterable<string>): string[] => [...new Set(values)].sort();

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Whether a raw selector key styles the state whose manifest fragment this is.
 *
 * Every shipped design system reaches `pressed` as
 * `'&[data-pressed]:not([data-disabled])'` rather than through `states`, so a
 * report that only read `states` would tell an author to style something they
 * already styled. Occurrences inside `:not()` are stripped first — that
 * selector styles the ABSENCE of `disabled`, and counting it as coverage is the
 * same mistake pointed the other way. Structural, matching the press-animating
 * check in `validate-recipes.ts`, rather than a substring test.
 */
function gatesOn(selector: string, fragment: string): boolean {
    const negated = new RegExp(`:not\\(\\s*${escapeRegExp(fragment)}\\s*\\)`, 'g');
    return selector.replace(negated, '').includes(fragment);
}

/** What one part's styles cover, split by whether an attribute has to match first. */
interface PartScan {
    /** State/flag names keyed in `states`. */
    states: Set<string>;
    /** Raw `selectors` keys, tested against the manifest's selector fragments. */
    selectors: string[];
}

const emptyScan = (): PartScan => ({ states: new Set(), selectors: [] });

/** Fold a block and everything below it into one sink. */
function scanInto(styles: PartStyles | undefined, into: PartScan): void {
    if (!styles) return;
    for (const state of Object.keys(styles.states ?? {})) into.states.add(state);
    into.selectors.push(...Object.keys(styles.selectors ?? {}));
    for (const nested of Object.values(styles.at ?? {})) scanInto(nested, into);
}

/**
 * A top-level `parts.<part>` block: its own declarations are unconditional,
 * while anything under an `at` condition is conditional however deep it sits.
 */
function scanPart(styles: PartStyles | undefined, direct: PartScan, conditional: PartScan): void {
    if (!styles) return;
    for (const state of Object.keys(styles.states ?? {})) direct.states.add(state);
    direct.selectors.push(...Object.keys(styles.selectors ?? {}));
    for (const nested of Object.values(styles.at ?? {})) scanInto(nested, conditional);
}

/**
 * Per part: what is styled unconditionally on `parts.<part>`, and what is only
 * reachable through a condition, a variant, a compound or a modifier.
 *
 * `validate-recipes.ts` has a `declarations()` walker, but it yields flattened
 * path strings for the token/colour checks — the wrong shape to key by part.
 */
function scanByPart(recipe: RecipeInput): Map<string, { direct: PartScan; indirect: PartScan }> {
    const byPart = new Map<string, { direct: PartScan; indirect: PartScan }>();
    const entry = (part: string) => {
        let found = byPart.get(part);
        if (!found) byPart.set(part, (found = { direct: emptyScan(), indirect: emptyScan() }));
        return found;
    };

    for (const [part, styles] of Object.entries(recipe.parts)) {
        const found = entry(part);
        scanPart(styles, found.direct, found.indirect);
    }

    // Everything below styles the part only when an axis or modifier attribute
    // matches, so it covers the state conditionally however it is spelled.
    const indirectBlock = (parts: Record<string, PartStyles>): void => {
        for (const [part, styles] of Object.entries(parts)) scanInto(styles, entry(part).indirect);
    };
    for (const values of Object.values(recipe.variants ?? {})) {
        for (const parts of Object.values(values)) indirectBlock(parts);
    }
    for (const parts of Object.values(recipe.modifiers ?? {})) indirectBlock(parts);
    for (const compound of recipe.compoundVariants ?? []) indirectBlock(compound.parts);

    return byPart;
}

function splitCoverage(
    vocabulary: readonly string[],
    fragments: Record<string, string>,
    scan: { direct: PartScan; indirect: PartScan } | undefined,
    skipped: ReadonlySet<string>,
): CoverageSplit {
    const split: CoverageSplit = { covered: [], coveredIndirectly: [], skipped: [], uncovered: [] };
    const hits = (side: PartScan | undefined, name: string): boolean => {
        if (!side) return false;
        if (side.states.has(name)) return true;
        const fragment = fragments[name];
        return fragment !== undefined && side.selectors.some((sel) => gatesOn(sel, fragment));
    };
    for (const name of vocabulary) {
        // Styled beats skipped: `skipStates` states an intent, but a rule that
        // exists is coverage whatever the recipe also claims about it.
        if (hits(scan?.direct, name)) split.covered.push(name);
        else if (hits(scan?.indirect, name)) split.coveredIndirectly.push(name);
        else if (skipped.has(name)) split.skipped.push(name);
        else split.uncovered.push(name);
    }
    for (const list of Object.values(split)) list.sort();
    return split;
}

function partReport(
    part: ManifestPart,
    byPart: Map<string, { direct: PartScan; indirect: PartScan }>,
    recipe: RecipeInput,
): PartReport {
    const scan = byPart.get(part.name);
    const skipped = new Set(recipe.skipStates?.[part.name] ?? []);
    return {
        // Anywhere, not just `parts.<name>`: a part styled only inside a
        // variant block is styled, and reporting it as unstyled would
        // contradict the coverage buckets right beside it, which count exactly
        // that as `coveredIndirectly`.
        styled: scan !== undefined,
        states: splitCoverage(part.states ?? [], part.selectors, scan, skipped),
        flags: splitCoverage(part.flags ?? [], part.selectors, scan, skipped),
    };
}

/**
 * The axis-agnostic divergence partition — the cheap half of
 * per-component vocabularies, generalised from the colour-only warning.
 */
function divergence(compiled: CompiledDesignSystem): Record<string, AxisDivergence> {
    const byAxis = new Map<string, Map<string, string[]>>();
    const record = (axis: string, scope: string, values: readonly string[]): void => {
        if (values.length === 0) return; // wiring nothing is `never`, not divergence
        let scopes = byAxis.get(axis);
        if (!scopes) byAxis.set(axis, (scopes = new Map()));
        scopes.set(scope, sorted(values));
    };

    for (const [scope, axes] of Object.entries(compiled.components)) {
        for (const axis of CONTRACT_AXES) record(axis, scope, axes[axis]);
        for (const [axis, values] of Object.entries(axes.axes)) record(axis, scope, values);
        // Modifiers have no value vocabulary — the NAMES are the vocabulary, so
        // the same subset question applies unchanged.
        record('mods', scope, axes.mods);
    }

    const out: Record<string, AxisDivergence> = {};
    for (const axis of [...byAxis.keys()].sort()) {
        const scopes = byAxis.get(axis)!;
        const wiredAnywhere = sorted([...scopes.values()].flat());
        const subsets: AxisDivergence['subsets'] = [];
        const byComponent: Record<string, string[]> = {};
        const declared: string[] = [];
        for (const scope of [...scopes.keys()].sort()) {
            const wired = scopes.get(scope)!;
            byComponent[scope] = wired;
            const missing = wiredAnywhere.filter((value) => !wired.includes(value));
            if (missing.length === 0) continue;
            subsets.push({ scope, wired, missing });
            // The scope told us so: it wires exactly the vocabulary it
            // declared, and the "missing" values were never its to wire.
            const offered = offeredFor(compiled.components[scope]!, axis);
            if (offered && sorted(offered).join() === wired.join()) declared.push(scope);
        }
        out[axis] = { wiredAnywhere, byComponent, subsets, declared };
    }
    return out;
}

function themeReports(ds: DesignSystemInput, compiled: CompiledDesignSystem): ThemeContrastReport[] {
    const pairs = contrastPairs(compiled.tokens.roles);
    return Object.entries(ds.tokens.themes).map(([name, theme]) => {
        const colors = theme.colors as Record<string, string>;
        const measured: Array<{ bg: string; fg: string; ratio: number }> = [];
        for (const [bg, fg] of pairs) {
            const a = colors[bg];
            const b = colors[fg];
            // Same guard as the validator: an unparseable or missing token is
            // an error there, and silence here rather than a bogus ratio.
            if (!a || !b || !parse(a) || !parse(b)) continue;
            // Rounded: this lands in a committed artifact, and raw float tails
            // would make every report a diff against itself across platforms.
            measured.push({ bg, fg, ratio: Number(wcagContrast(a, b).toFixed(2)) });
        }
        const worst = measured.reduce<(typeof measured)[number] | null>(
            (min, pair) => (min === null || pair.ratio < min.ratio ? pair : min),
            null,
        );
        return {
            name,
            colorScheme: theme.colorScheme,
            ...(theme.pair ? { pair: theme.pair } : {}),
            minContrast: worst ? worst.ratio : null,
            worstPair: worst ? [worst.bg, worst.fg] : null,
            belowMin: measured.filter((p) => p.ratio < 3).length,
            belowAA: measured.filter((p) => p.ratio < 4.5).length,
            pairs: measured,
        };
    });
}

/**
 * Declared values no recipe anywhere wires.
 *
 * The validator already warns for `variant`, `tokens.axes` and `modifiers`.
 * `color` and `size` have no such check — material declares thirteen roles and
 * wires nine — so for those two this is the only place the gap is stated.
 */
function unwired(compiled: CompiledDesignSystem): DesignSystemReport['unwired'] {
    const entries = Object.values(compiled.components);
    const wiredIn = (pick: (axes: (typeof entries)[number]) => readonly string[]): Set<string> =>
        new Set(entries.flatMap((axes) => [...pick(axes)]));

    const color = wiredIn((a) => a.color);
    const size = wiredIn((a) => a.size);
    const variant = wiredIn((a) => a.variant);
    const mods = wiredIn((a) => a.mods);

    return {
        color: Object.keys(compiled.tokens.roles).filter((role) => !color.has(role)).sort(),
        size: compiled.tokens.sizes.filter((value) => !size.has(value)).sort(),
        variant: compiled.tokens.variants.filter((value) => !variant.has(value)).sort(),
        axes: Object.fromEntries(
            Object.entries(compiled.tokens.axes).map(([axis, values]) => {
                const declared = wiredIn((a) => a.axes[axis] ?? []);
                return [axis, values.filter((value) => !declared.has(value)).sort()];
            }),
        ),
        modifiers: compiled.tokens.modifiers.filter((name) => !mods.has(name)).sort(),
    };
}

/**
 * Declared values that belong to no scope's vocabulary (#294).
 *
 * `unwired` asks whether anything PAINTS a value; this asks whether anything
 * CLAIMS it. The two separate once the design-system-wide list is a union: a
 * value can be painted by the one scope that declared it (so not unwired) and
 * still be missing from every other scope's vocabulary, and a value can be
 * claimed by a scope that has not painted it yet (so not unclaimed) and still
 * be unwired. `axisClaims` short-circuits the whole thing while any styled
 * scope is unrestricted — its vocabulary is the union, so nothing is unclaimed.
 */
function unclaimed(compiled: CompiledDesignSystem): DesignSystemReport['unclaimed'] {
    const missing = (axis: string, declared: readonly string[]): string[] => {
        const claims = axisClaims(compiled, axis);
        if (claims.unrestricted) return [];
        return declared.filter((value) => !claims.claimed.has(value)).sort();
    };
    return {
        color: missing('color', Object.keys(compiled.tokens.roles)),
        size: missing('size', compiled.tokens.sizes),
        variant: missing('variant', compiled.tokens.variants),
        axes: Object.fromEntries(
            Object.entries(compiled.tokens.axes).map(([axis, values]) => [axis, missing(axis, values)]),
        ),
        modifiers: missing('mods', compiled.tokens.modifiers),
    };
}

/**
 * Build the coverage report for one design system.
 *
 * `manifest` is `Pick<…, 'components'>` to match `compileDesignSystem`: each
 * design-system `build.mjs` assembles a manifest from `@sigx/zero/anatomy` with
 * no `zeroVersion`, so nothing here may depend on the rest of it.
 *
 * `result` is optional and only fills the issue counts — the report is about
 * coverage, and stands on its own without a validation pass.
 */
/**
 * The declaration flattened to one row per vendor prop — the shape a
 * conformance-matrix row needs (their name, the zero mapping, the grade),
 * derived rather than asserted.
 */
function apiSurfaces(api: DesignSystemApi): ApiSurfaceReport[] {
    const respelled = (values?: Record<string, string>): string[] =>
        sorted(Object.entries(values ?? {}).flatMap(([zero, vendor]) => (vendor === zero ? [] : [vendor])));
    const surfaces: ApiSurfaceReport[] = [];
    // The DS-wide tier only: per-scope `components` overrides surface through
    // the manifest's per-scope api, not this design-system-level summary.
    for (const axis of ['color', 'size', 'variant'] as const) {
        const entry = api[axis];
        if (!entry) continue;
        surfaces.push({
            prop: entry.as ?? axis,
            zero: axis,
            grade: apiGrade(entry),
            respelled: respelled(entry.values),
        });
    }
    for (const [axis, entry] of Object.entries(api.axes ?? {})) {
        surfaces.push({
            prop: entry.as ?? axis,
            zero: `axes.${axis}`,
            grade: apiGrade(entry),
            respelled: respelled(entry.values),
        });
    }
    for (const [name, entry] of Object.entries(api.modifiers ?? {})) {
        surfaces.push({ prop: entry.as ?? name, zero: `mods.${name}`, grade: modifierGrade(entry), respelled: [] });
    }
    return surfaces.sort((a, b) => a.prop.localeCompare(b.prop));
}

/** The report's view of an audit's contrast matrix — counts and the worst ten, per theme. */
export function summarizeContrast(matrix: ContrastMatrix): ContrastReportTheme[] {
    return matrix.themes.map((theme) => {
        const count = (verdict: string): number => theme.cells.filter((c) => c.verdict === verdict).length;
        const unmeasured: Record<string, number> = {};
        for (const cell of theme.cells) {
            if (cell.verdict !== 'unmeasured') continue;
            const reason = cell.reason ?? 'unknown';
            unmeasured[reason] = (unmeasured[reason] ?? 0) + 1;
        }
        const measuredCells = theme.cells.filter((c) => c.ratio !== undefined);
        return {
            name: theme.name,
            cells: theme.cells.length,
            measured: measuredCells.length,
            failing: count('fail'),
            warnings: count('warn'),
            disabledFailing: count('disabled-fail'),
            unrendered: count('unrendered'),
            unpainted: count('unpainted'),
            unmeasured: Object.fromEntries(Object.entries(unmeasured).sort(([a], [b]) => a.localeCompare(b))),
            worst: [...measuredCells]
                .sort((a, b) => a.ratio! - b.ratio! || a.key.localeCompare(b.key))
                .slice(0, 10)
                .map((c) => ({ key: c.key, ratio: c.ratio!, ink: c.ink ?? 'none', bg: c.bg ?? 'none' })),
        };
    });
}


export function buildReport(
    compiled: CompiledDesignSystem,
    ds: DesignSystemInput,
    manifest: Pick<ZeroManifest, 'components'>,
    result?: ValidationResult,
    audit?: AuditResult,
): DesignSystemReport {
    const recipesByScope = new Map<string, RecipeInput>(ds.recipes.map((r) => [r.component, r]));
    const byScope = new Map<string, ManifestComponent>(manifest.components.map((c) => [c.scope, c]));

    const components: Record<string, ComponentReport> = {};
    const unstyled: string[] = [];
    for (const scope of [...byScope.keys()].sort()) {
        const axes = compiled.components[scope];
        const recipe = recipesByScope.get(scope);
        if (!axes || !recipe) {
            unstyled.push(scope);
            components[scope] = { styled: false, parts: {} };
            continue;
        }
        const byPart = scanByPart(recipe);
        const parts: Record<string, PartReport> = {};
        for (const part of byScope.get(scope)!.parts) {
            parts[part.name] = partReport(part, byPart, recipe);
        }
        // Asked PER SCOPE, so a scope that declared an axis out of existence
        // for itself reads `undeclared` rather than the weaker `unwired`
        // (#294). `compileRegisterDts` passes the same scope to the same
        // predicate, which is the gate the conformance program
        // (docs/architecture.md §7) puts on this report.
        const undeclared = undeclaredAxes(compiled, scope);
        const axisReports = {} as Record<ContractAxis, AxisReport>;
        for (const axis of CONTRACT_AXES) {
            const offered = offeredFor(axes, axis);
            axisReports[axis] = {
                wired: sorted(axes[axis]),
                status: axes[axis].length > 0 ? 'wired' : undeclared.has(axis) ? 'undeclared' : 'unwired',
                ...(offered ? { offered: sorted(offered) } : {}),
            };
        }
        components[scope] = {
            styled: true,
            axes: axisReports,
            customAxes: Object.fromEntries(
                Object.entries(axes.axes)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([axis, values]) => [axis, sorted(values)]),
            ),
            mods: sorted(axes.mods),
            ...(axes.defaults ? { defaults: { ...axes.defaults } } : {}),
            never: CONTRACT_AXES.filter((axis) => axisReports[axis].status !== 'wired'),
            parts,
        };
    }

    const body: Omit<DesignSystemReport, 'score'> = {
        $schema: REPORT_SCHEMA_URL,
        reportVersion: 2,
        name: compiled.name,
        coverage: {
            componentsStyled: Object.keys(compiled.components).length,
            componentsTotal: manifest.components.length,
            unstyled,
        },
        vocabulary: {
            // Ordered vocabularies keep DECLARATION order: `xs`…`xl` is a ramp
            // and `variants` is authored deliberately, so sorting either would
            // say something the design system didn't. `roles` and `modifiers`
            // are sets with no meaningful order, and the axis KEYS are a set
            // too, so those are sorted — as is every harvested value list,
            // where order is an artifact of recipe authoring rather than intent.
            roles: Object.keys(compiled.tokens.roles).sort(),
            sizes: [...compiled.tokens.sizes],
            variants: [...compiled.tokens.variants],
            axes: Object.fromEntries(
                Object.entries(compiled.tokens.axes)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([axis, values]) => [axis, [...values]]),
            ),
            modifiers: [...compiled.tokens.modifiers].sort(),
            // Design-system-wide, deliberately: a scope declaring an axis away
            // for itself is a per-COMPONENT fact and lands in that component's
            // axis status, not in the design system's vocabulary.
            declaredOut: [...undeclaredAxes(compiled)].sort(),
            scopes: compiled.tokens.scopes,
        },
        unwired: unwired(compiled),
        unclaimed: unclaimed(compiled),
        components,
        divergence: divergence(compiled),
        themes: themeReports(ds, compiled),
        ...(audit?.contrast.themes.length ? { contrast: summarizeContrast(audit.contrast) } : {}),
        ...(ds.api ? { api: apiSurfaces(ds.api) } : {}),
        ...(result ? { issues: { errors: result.errors.length, warnings: result.warnings.length } } : {}),
        ...(audit ? { audit: { auditVersion: audit.auditVersion, ...audit.summary } } : {}),
    };
    // The score reads the finished sections, so it is folded in last — and
    // placed right after `name`, where a reader of the JSON looks first. The
    // audit joins as the sixth criterion only when one was handed in.
    const { $schema, reportVersion, name, ...rest } = body;
    return {
        $schema, reportVersion, name,
        score: computeScore(body, compiled, audit ? { audit: audit.summary } : {}),
        ...rest,
    };
}

/** `n/total (pct%)`, the one number a reviewer reads first. */
const ratio = (n: number, total: number): string =>
    `${n}/${total} (${total === 0 ? 0 : Math.round((n / total) * 100)}%)`;

/**
 * The human-readable convenience view. The JSON is the deliverable — §7.4
 * consumes it — so this stays a summary and never tries to be lossless.
 *
 * Returned as lines rather than printed: the CLI logger prefixes every line
 * with `[sigx] `, and the caller decides where they go.
 */
export function formatReport(report: DesignSystemReport): string[] {
    const lines: string[] = [`${report.name} — coverage report`];

    // The score first: it is the one line that answers "better or worse than
    // last time", and everything under it is what it was computed from.
    lines.push(`  ${formatScore(report.score)}`);

    lines.push(`  components styled: ${ratio(report.coverage.componentsStyled, report.coverage.componentsTotal)}`);
    if (report.coverage.unstyled.length > 0) {
        lines.push(`    unstyled: ${report.coverage.unstyled.join(', ')}`);
    }

    if (report.vocabulary.declaredOut.length > 0) {
        lines.push(`  declared out of existence: ${report.vocabulary.declaredOut.join(', ')}`);
    }

    // Per-axis wiring, counted over the components that HAVE a recipe — an
    // unstyled component wires nothing by definition and would drown the signal.
    const styledScopes = Object.entries(report.components).flatMap(([scope, c]) => (c.styled ? [[scope, c] as const] : []));
    for (const axis of CONTRACT_AXES) {
        const wired = styledScopes.filter(([, c]) => c.axes[axis].status === 'wired');
        const status = styledScopes.length > 0 && wired.length === 0
            ? report.vocabulary.declaredOut.includes(axis) ? ' — no such axis' : ' — wired by nothing'
            : '';
        lines.push(`  ${axis} wired: ${ratio(wired.length, styledScopes.length)}${status}`);
    }

    for (const [axis, values] of Object.entries(report.unwired.axes)) {
        if (values.length > 0) lines.push(`  axes.${axis} declared but unwired: ${values.join(', ')}`);
    }
    for (const axis of ['color', 'size', 'variant', 'modifiers'] as const) {
        const values = report.unwired[axis];
        if (values.length > 0) lines.push(`  ${axis} declared but unwired: ${values.join(', ')}`);
    }

    for (const [axis, values] of Object.entries(report.unclaimed.axes)) {
        if (values.length > 0) lines.push(`  axes.${axis} in no scope's vocabulary: ${values.join(', ')}`);
    }
    for (const axis of ['color', 'size', 'variant', 'modifiers'] as const) {
        const values = report.unclaimed[axis];
        if (values.length > 0) lines.push(`  ${axis} in no scope's vocabulary: ${values.join(', ')}`);
    }

    for (const [axis, part] of Object.entries(report.divergence)) {
        if (part.subsets.length === 0) continue;
        lines.push(`  ${axis} diverges across components:`);
        for (const { scope, wired, missing } of part.subsets) {
            // A scope that wires exactly the vocabulary it declared is not
            // diverging — it is doing what it said. Annotated rather than
            // dropped, so the partition stays complete (#294).
            const why = part.declared.includes(scope) ? ' (declared)' : '';
            lines.push(`    ${scope}: ${wired.length}/${part.wiredAnywhere.length} — missing ${missing.join(', ')}${why}`);
        }
    }

    let covered = 0;
    let indirect = 0;
    let skippedTotal = 0;
    let total = 0;
    for (const [, component] of styledScopes) {
        for (const part of Object.values(component.parts)) {
            for (const split of [part.states, part.flags]) {
                covered += split.covered.length;
                indirect += split.coveredIndirectly.length;
                skippedTotal += split.skipped.length;
                total += split.covered.length + split.coveredIndirectly.length + split.skipped.length + split.uncovered.length;
            }
        }
    }
    lines.push(
        `  states+flags covered: ${ratio(covered + indirect, total)}`
        + ` (${indirect} conditionally, ${skippedTotal} skipped deliberately)`,
    );

    if (report.api && report.api.length > 0) {
        lines.push(`  api: ${report.api
            .map((s) => `${s.prop} ← ${s.zero} (${s.grade}${s.respelled.length > 0 ? `, ${s.respelled.length} respelled` : ''})`)
            .join(', ')}`);
    }

    for (const theme of report.themes) {
        const margin = theme.minContrast === null ? 'not measurable' : `${theme.minContrast.toFixed(2)}:1`;
        const flags = [
            theme.belowMin > 0 ? `${theme.belowMin} below 3:1` : '',
            theme.belowAA > 0 ? `${theme.belowAA} below 4.5:1 AA` : '',
        ].filter(Boolean);
        lines.push(
            `  theme ${theme.name}: min contrast ${margin}`
            + (theme.worstPair ? ` (${theme.worstPair[0]} vs ${theme.worstPair[1]})` : '')
            + (flags.length > 0 ? ` — ${flags.join(', ')}` : ''),
        );
    }

    if (report.audit) {
        lines.push(`  audit: ${report.audit.errors} errors, ${report.audit.warnings} warnings, ${report.audit.info} info`);
    }
    for (const theme of report.contrast ?? []) {
        const unmeasured = Object.entries(theme.unmeasured);
        const total = unmeasured.reduce((n, [, c]) => n + c, 0);
        lines.push(
            `  theme ${theme.name}: state matrix ${theme.cells} cells, ${theme.measured} measured, `
            + `${theme.failing + theme.disabledFailing} below floor, ${theme.warnings} below 4.5:1`
            + (total > 0 ? `, ${total} unmeasured (${unmeasured.map(([r, c]) => `${r} ${c}`).join(', ')})` : ''),
        );
    }

    if (report.issues) {
        lines.push(`  validation: ${report.issues.errors} errors, ${report.issues.warnings} warnings`);
    }
    return lines;
}
