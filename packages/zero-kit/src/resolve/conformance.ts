/**
 * The conformance matrix (docs/architecture.md, "The authoring surface";
 * issue #174) — rows RENDERED from the
 * artifacts that implement them, never asserted by hand.
 *
 * Three sources feed one table:
 *
 * - A **conformance fixture** (`skills/design-system/conformance/*.ts`)
 *   declares a vendor's Button axis surface as a real vocabulary + `api`
 *   declaration; its rows derive here, so a row cannot claim a mapping the
 *   declaration doesn't make (issue #179's unification).
 * - A **zero-native design system** (no `api`) surfaces zero's own prop
 *   names — every declared surface grades `exact` by construction, which is
 *   what §7.3 means by "same prop name in the contract".
 * - A **coverage report** (Tier 3) contributes the same shape for every
 *   in-repo design system, generated rather than written (§7.4 mechanism 3).
 *
 * The living document (`docs/design-system-conformance.md`) is emitted by
 * `formatConformanceMatrix` and snapshot-tested: drift between a row and its
 * fixture IS the failing test, which is a strictly stronger form of the
 * row↔fixture parity §7.4 asks for — they are the same object.
 */
import type { DesignSystemApi } from '../api.js';
import { apiGrade, modifierGrade, scopeApi } from '../api.js';
import type { ConformanceGrade } from '../api.js';
import type { DesignSystemReport } from './report.js';

export interface ConformanceSource {
    url: string;
    version: string;
    /** ISO date the source was last read — §7.4's honest amount of process. */
    verified: string;
}

/** The declared vocabulary a fixture's rows derive from. */
export interface ConformanceVocabulary {
    roles?: readonly string[];
    sizes?: readonly string[];
    variants?: readonly string[];
    axes?: Record<string, readonly string[]>;
    modifiers?: readonly string[];
}

export interface ConformanceFixtureInput {
    /** Display name, e.g. `Carbon`. */
    system: string;
    /**
     * §7.2: 1 = buildable as a package, 2 = buildable with a declared
     * adapter, 3 = generated from an in-repo report (`reportRows`).
     */
    tier: 1 | 2 | 3;
    /** Absent on Tier-3 rows — an in-repo report needs no vendor source. */
    source?: ConformanceSource;
    vocabulary: ConformanceVocabulary;
    /**
     * The vendor-name mapping. Absent → the system is zero-native (its
     * documented surface IS zero's), and every declared surface is `exact`.
     */
    api?: DesignSystemApi;
    /** The executing artifact column 8 points at. */
    provenBy: string;
}

/** §7.3 column 3. `per-component-divergent` is reserved; no current row needs it. */
export type SurfaceKind = 'enumeration' | 'presence-flag' | 'numeric ramp';

export interface ConformanceRow {
    system: string;
    tier: 1 | 2 | 3;
    source?: ConformanceSource;
    /** Column 2 — the vendor's prop name for this surface. */
    surface: string;
    kind: SurfaceKind;
    /** Column 4 — the vendor's spellings (respelled through the api `values`). */
    vocabulary: readonly string[];
    /** Column 5 — `color` / `size` / `variant` / `axes.<a>` / `mods.<m>`. */
    zero: string;
    grade: ConformanceGrade;
    provenBy: string;
}

const kindOf = (values: readonly string[]): SurfaceKind =>
    values.length > 0 && values.every((v) => /^\d+$/.test(v)) ? 'numeric ramp' : 'enumeration';

/** Vendor spellings for a declared value list, through an api `values` remap. */
const respelled = (values: readonly string[], remap?: Record<string, string>): string[] =>
    values.map((v) => remap?.[v] ?? v);

/** Derive every row a fixture's declaration supports. */
export function conformanceRows(fixture: ConformanceFixtureInput): ConformanceRow[] {
    const { system, tier, source, vocabulary, provenBy } = fixture;
    // The matrix is Button-scoped by charter (§7.2), so a fixture's
    // `api.components.button` override — Ant's `type`, the shadowing that is
    // per-scope since #318 — resolves into the surface the rows describe.
    const api = fixture.api === undefined ? undefined : scopeApi(fixture.api, 'button');
    const native = api === undefined;
    const rows: ConformanceRow[] = [];
    const row = (partial: Omit<ConformanceRow, 'system' | 'tier' | 'source' | 'provenBy'>) =>
        rows.push({ system, tier, source, provenBy, ...partial });

    // `color` and `size` have no api surface (nothing surveyed renames them):
    // the vendor prop name IS zero's, so a declared vocabulary grades exact.
    if (vocabulary.roles && vocabulary.roles.length > 0) {
        row({ surface: 'color', kind: kindOf(vocabulary.roles), vocabulary: vocabulary.roles, zero: 'color', grade: 'exact' });
    }
    if (vocabulary.sizes && vocabulary.sizes.length > 0) {
        row({ surface: 'size', kind: kindOf(vocabulary.sizes), vocabulary: vocabulary.sizes, zero: 'size', grade: 'exact' });
    }
    if (vocabulary.variants && vocabulary.variants.length > 0) {
        const entry = api?.variant;
        row({
            surface: entry?.as ?? 'variant',
            kind: kindOf(vocabulary.variants),
            vocabulary: respelled(vocabulary.variants, entry?.values),
            zero: 'variant',
            grade: native ? 'exact' : apiGrade(entry),
        });
    }
    for (const [axis, values] of Object.entries(vocabulary.axes ?? {})) {
        const entry = api?.axes?.[axis];
        row({
            surface: entry?.as ?? axis,
            kind: kindOf(values),
            vocabulary: respelled(values, entry?.values),
            zero: `axes.${axis}`,
            grade: native ? 'exact' : apiGrade(entry),
        });
    }
    for (const name of vocabulary.modifiers ?? []) {
        const entry = api?.modifiers?.[name];
        row({
            surface: entry?.as ?? name,
            kind: 'presence-flag',
            vocabulary: [],
            zero: `mods.${name}`,
            // A zero-native modifier is still spelled `mods={{ name: true }}`
            // by the consumer, so `exact` (same prop, the `mods` bag); a
            // vendor boolean prop is a reshape however it is named.
            grade: native ? 'exact' : modifierGrade(entry),
        });
    }
    return rows;
}

/** Tier-3 rows — the same shape, generated from a coverage report (§7.4). */
export function reportRows(report: DesignSystemReport, provenBy: string): ConformanceRow[] {
    const api = new Map((report.api ?? []).map((s) => [s.zero, s]));
    const rows = conformanceRows({
        system: report.name,
        tier: 3,
        vocabulary: {
            roles: report.vocabulary.roles,
            sizes: report.vocabulary.sizes,
            variants: report.vocabulary.variants,
            axes: report.vocabulary.axes,
            modifiers: report.vocabulary.modifiers,
        },
        provenBy,
    });
    // A reported design system with an api section carries its derived grades
    // — the report already computed them from the same declaration.
    return rows.map((row) => {
        const surface = api.get(row.zero);
        return surface ? { ...row, surface: surface.prop, grade: surface.grade } : row;
    });
}

const escapeCell = (text: string): string => text.replace(/\|/g, '\\|');

const vocabularyCell = (row: ConformanceRow): string =>
    row.kind === 'presence-flag' ? 'boolean' : escapeCell(row.vocabulary.join(', '));

function tableFor(rows: ConformanceRow[], withSource: boolean): string[] {
    const header = withSource
        ? '| system | source | their name | kind | their vocabulary | zero mapping | fidelity | gap | proven by |'
        : '| system | their name | kind | their vocabulary | zero mapping | fidelity | proven by |';
    const rule = withSource
        ? '|---|---|---|---|---|---|---|---|---|'
        : '|---|---|---|---|---|---|---|';
    const lines = [header, rule];
    for (const row of rows) {
        const source = row.source
            ? `[${row.source.version}](${row.source.url}) (${row.source.verified})`
            : '—';
        // Column "gap": empty iff `exact` per §7.3. A renamed/reshaped
        // surface points at #179's shipped adapter mechanism rather than an
        // open gap; an `unsupported` surface has NO mapping, so it must not
        // claim that coverage — it stays an honest open item.
        const gap = row.grade === 'exact' ? '—'
            : row.grade === 'unsupported' ? 'unmapped — no api declaration'
                : '#179 (shipped)';
        const cells = withSource
            ? [row.system, source, `\`${row.surface}\``, row.kind, vocabularyCell(row), `\`${row.zero}\``, row.grade, gap, `\`${row.provenBy}\``]
            : [row.system, `\`${row.surface}\``, row.kind, vocabularyCell(row), `\`${row.zero}\``, row.grade, `\`${row.provenBy}\``];
        lines.push(`| ${cells.join(' | ')} |`);
    }
    return lines;
}

/**
 * The whole living document. Regenerate by updating the fixtures (or a
 * design system's declaration) and running the snapshot test with `-u`.
 */
export function formatConformanceMatrix(
    tier12: ConformanceRow[],
    tier3: ConformanceRow[],
): string {
    return [
        '# Design-system conformance matrix',
        '',
        '<!-- GENERATED by packages/zero-kit/src/resolve/conformance.ts from the',
        '     conformance fixtures and the in-repo coverage reports. Do not edit',
        '     by hand: update a fixture or a design system, then refresh via',
        '     `pnpm test -- conformance` with `--update`. The snapshot test IS',
        '     the row-fixture parity check (docs/architecture.md §7) — a row and its',
        '     declaration are the same object, so they cannot drift apart. -->',
        '',
        'The rules live in docs/architecture.md §7 (the conformance program);',
        'this file is the data (living, regenerated);',
        'the fixtures under `packages/zero-kit/skills/design-system/conformance/`',
        'and the design-system packages are the proof (executing). A row may',
        'claim `exact` or `renamed` only because the artifact in its last column',
        'declares exactly that mapping.',
        '',
        'Grades (§7.3): `exact` — same prop name in the contract; `renamed` — the',
        'same surface under a vendor name, restored by the generated',
        '`./components` module; `reshaped` — a value respelling or a boolean',
        'prop over a presence attribute; `unsupported` — no mapping declared',
        '(the only hand-asserted grade). Automated vendor-doc checking is out of',
        'scope by design — the dated source column is the honest process.',
        '',
        '## Tier 1 & 2 — vendor surfaces',
        '',
        'Tier 1 must be buildable as a package (HeroUI and Material 3 are; Radix',
        'Themes is proven by its fixture); Tier 2 is buildable with a declared',
        'adapter. Zero-native packages grade `exact` by construction: their',
        'documented surface IS zero\'s. Material\'s row grades the shipped',
        'package surface, not Google\'s component API — an M3-component-API',
        'adapter would be its own fixture with an `api` declaration.',
        '',
        ...tableFor(tier12, true),
        '',
        '## Tier 3 — in-repo coverage (generated from the reports)',
        '',
        'One row per declared surface of every in-repo design system, generated',
        'from `buildReport` — what each system actually declares and wires, with',
        'api-derived grades where a system declares one.',
        '',
        ...tableFor(tier3, false),
        '',
    ].join('\n');
}
