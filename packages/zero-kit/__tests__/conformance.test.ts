/**
 * The conformance fixtures are documentation that runs (docs/architecture.md,
 * "The authoring surface"; issues
 * #174/#179) — the same rule the brief pack follows.
 *
 * Three layers, matching §7.4's honesty mechanisms:
 *
 * 1. Every fixture's api validates against its own vocabulary, and the
 *    grades the matrix prints are DERIVED from the declarations — asserted
 *    independently here, so a row and its artifact are the same object.
 * 2. Every Tier-1/2 fixture that is not proven by a package COMPILES as a
 *    Button-only design system and emits the selector strings its row
 *    claims — a compiler regression breaks the conformance claim directly.
 * 3. The living document (`docs/design-system-conformance.md`) is generated
 *    here and snapshot-compared: row↔fixture parity by construction, and
 *    Tier-3 rows regenerate from `buildReport` on every run.
 */
import { describe, expect, it } from 'vitest';
import type { ConformanceGrade, DesignSystemInput, ManifestComponent } from '@sigx/zero-kit';
import {
    apiGrade,
    buildReport,
    compileDesignSystem,
    conformanceRows,
    formatConformanceMatrix,
    modifierGrade,
    reportRows,
    scopeApi,
    validateApi,
    validateDesignSystem,
} from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { designSystem as daisyDS } from '@sigx/zero-daisyui';
import { designSystem as materialDS } from '@sigx/zero-material';
import { designSystem as brutalistDS } from '@sigx/zero-brutalist';
import { designSystem as herouiDS } from '@sigx/zero-heroui';
import * as carbon from '../skills/design-system/conformance/carbon.js';
import * as ant from '../skills/design-system/conformance/ant.js';
import * as radix from '../skills/design-system/conformance/radix.js';
import * as heroui from '../skills/design-system/conformance/heroui.js';
import * as material from '../skills/design-system/conformance/material.js';
import { tokens as herouiPackageTokens } from '../../zero-heroui/src/tokens.js';
import { roles as materialPackageRoles, tokens as materialPackageTokens } from '../../zero-material/src/tokens.js';
import { tokens as carbonPackageTokens } from '../../zero-carbon/src/tokens.js';
import { designSystem as carbonPackageDS } from '../../zero-carbon/src/design-system.js';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

const FIXTURES = [
    ['carbon', carbon],
    ['ant', ant],
    ['radix', radix],
    ['heroui', heroui],
    ['material', material],
] as const;

/** The fixtures whose proof is the fixture itself — they must compile. */
const EXECUTING = [
    ['carbon', carbon],
    ['ant', ant],
    ['radix', radix],
] as const;

const fixtureDS = (fixture: (typeof EXECUTING)[number][1]): DesignSystemInput => ({
    name: fixture.matrix.system.toLowerCase().replace(/\s+/g, '-'),
    tokens: fixture.tokens,
    recipes: [fixture.button],
    api: fixture.api,
});

describe.each(FIXTURES)('conformance fixture: %s', (_name, fixture) => {
    it('names a dated source', () => {
        expect(fixture.source.url).toMatch(/^https:\/\//);
        expect(fixture.source.verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(fixture.source.version.length).toBeGreaterThan(0);
    });

    it('places itself in the matrix with an executing artifact', () => {
        expect([1, 2]).toContain(fixture.matrix.tier);
        expect(fixture.matrix.provenBy.length).toBeGreaterThan(0);
    });

    it('declares an api that validates clean against its own vocabulary (when it has one)', () => {
        const api = (fixture as { api?: Parameters<typeof validateApi>[0] }).api;
        if (api) expect(validateApi(api, fixture.vocabulary)).toEqual([]);
    });
});

describe.each(EXECUTING)('executing fixture: %s', (_name, fixture) => {
    it('validates with no errors', () => {
        expect(validateDesignSystem(fixtureDS(fixture), manifest).errors).toEqual([]);
    });
});

describe('emitted selectors — the row claims, in CSS', () => {
    // §7.4 mechanism 2: fixtures assert the EMITTED selector strings, so a
    // compiler regression breaks the conformance claim rather than quietly.
    const cssOf = (fixture: (typeof EXECUTING)[number][1]): string =>
        compileDesignSystem(fixtureDS(fixture), manifest).componentCss['button']!;

    it('carbon: the kebab spellings of the double-hyphen members, and the modifiers', () => {
        const css = cssOf(carbon);
        expect(css).toContain('[data-scope="button"][data-part="root"][data-variant="danger-tertiary"]');
        expect(css).toContain('[data-scope="button"][data-part="root"][data-variant="danger-ghost"]');
        expect(css).toContain('[data-mod-icon-only]');
        expect(css).toContain('[data-mod-expressive]');
        // The vendor spelling never reaches the stylesheet — it lives only in
        // the api declaration and the generated prop surface.
        expect(css).not.toContain('danger--tertiary');
    });

    it('ant: the renamed variant, the shape custom axis and the boolean flags', () => {
        const css = cssOf(ant);
        expect(css).toContain('[data-scope="button"][data-part="root"][data-variant="dashed"]');
        expect(css).toContain('[data-scope="button"][data-part="root"][data-shape="circle"]');
        expect(css).toContain('[data-mod-danger]');
        expect(css).toContain('[data-mod-block]');
        // The vendor prop name is not an attribute: type → data-variant.
        expect(css).not.toContain('data-type');
    });

    it('radix: the numeric size ramp, the radius axis and the renamed modifier', () => {
        const css = cssOf(radix);
        expect(css).toContain('[data-scope="button"][data-part="root"][data-size="1"]');
        expect(css).toContain('[data-scope="button"][data-part="root"][data-size="4"]');
        expect(css).toContain('[data-scope="button"][data-part="root"][data-radius="full"]');
        expect(css).toContain('[data-mod-high-contrast]');
        expect(css).not.toContain('highContrast');
    });
});

/** The grades the matrix claims for these rows — asserted independently. */
const EXPECTED: Record<string, Record<string, ConformanceGrade>> = {
    carbon: { variant: 'reshaped', 'mods.icon-only': 'reshaped', 'mods.expressive': 'reshaped', 'mods.zebra': 'reshaped' },
    ant: {
        variant: 'renamed',
        'axes.shape': 'exact',
        'mods.danger': 'reshaped',
        'mods.ghost': 'reshaped',
        'mods.block': 'reshaped',
    },
    radix: {
        variant: 'exact',
        'axes.radius': 'exact',
        'mods.high-contrast': 'reshaped',
        'mods.loading': 'reshaped',
    },
    heroui: { variant: 'exact', 'mods.icon-only': 'reshaped', 'mods.pending': 'reshaped', 'mods.striped': 'reshaped' },
    material: {},
};

describe.each(FIXTURES)('derived grades: %s', (name, fixture) => {
    it('match what the matrix row claims', () => {
        // Through the same per-scope resolution the matrix rows use: the
        // matrix is Button-scoped, and Ant's `type` rename lives under
        // `api.components.button` since #318.
        const declared = (fixture as { api?: typeof carbon.api }).api;
        const api = declared === undefined ? undefined : scopeApi(declared, 'button');
        const derived: Record<string, ConformanceGrade> = {};
        if (api?.variant) derived['variant'] = apiGrade(api.variant);
        for (const [axis, entry] of Object.entries(api?.axes ?? {})) {
            derived[`axes.${axis}`] = apiGrade(entry);
        }
        for (const [mod, entry] of Object.entries(api?.modifiers ?? {})) {
            derived[`mods.${mod}`] = modifierGrade(entry);
        }
        expect(derived).toEqual(EXPECTED[name]);
    });
});

describe('fixtures describing in-repo packages stay verbatim', () => {
    // The graduation path: a package-proven fixture's vocabulary IS the
    // package's declared vocabulary. A drift here means the fixture describes
    // a design system that no longer exists.
    it('heroui matches @sigx/zero-heroui', () => {
        expect([...heroui.vocabulary.variants]).toEqual([...(herouiPackageTokens.variants ?? [])]);
        expect([...heroui.vocabulary.modifiers]).toEqual([...(herouiPackageTokens.modifiers ?? [])]);
    });

    it('material matches @sigx/zero-material', () => {
        expect([...material.vocabulary.roles]).toEqual(Object.keys(materialPackageRoles));
        expect([...material.vocabulary.variants]).toEqual([...(materialPackageTokens.variants ?? [])]);
    });

    it('carbon matches @sigx/zero-carbon, api included', () => {
        // The runtime package graduated the fixture (#183): same vocabulary,
        // same api object shape — the matrix row, the fixture and the shipped
        // ./components module all describe one artifact.
        expect([...carbon.vocabulary.variants]).toEqual([...(carbonPackageTokens.variants ?? [])]);
        expect([...carbon.vocabulary.modifiers]).toEqual([...(carbonPackageTokens.modifiers ?? [])]);
        expect(carbonPackageDS.api).toEqual(carbon.api);
    });
});

describe('the gap column', () => {
    it('never claims the shipped adapter for an unmapped surface', () => {
        // No current fixture produces an unsupported row, so this pins the
        // formatter directly: a vocabulary surface with a partial api (variant
        // mapped, a custom axis not) must render the honest open item.
        const rows = conformanceRows({
            system: 'Probe',
            tier: 2,
            source: { url: 'https://example.com', version: 'v1', verified: '2026-07-29' },
            vocabulary: { variants: ['solid'], axes: { tone: ['high'] } },
            api: { variant: { as: 'kind' } },
            provenBy: 'probe',
        });
        const doc = formatConformanceMatrix(rows, []);
        const toneRow = doc.split('\n').find((l) => l.includes('`tone`'))!;
        expect(toneRow).toContain('unsupported');
        expect(toneRow).toContain('unmapped — no api declaration');
        expect(toneRow).not.toContain('#179');
        const kindRow = doc.split('\n').find((l) => l.includes('`kind`'))!;
        expect(kindRow).toContain('#179 (shipped)');
    });
});

describe('the living document', () => {
    it('docs/design-system-conformance.md is exactly what the artifacts derive', async () => {
        const tier12 = FIXTURES.flatMap(([, fixture]) =>
            conformanceRows({
                ...fixture.matrix,
                source: fixture.source,
                vocabulary: fixture.vocabulary,
                api: (fixture as { api?: typeof carbon.api }).api,
            }),
        ).sort((a, b) => a.tier - b.tier || a.system.localeCompare(b.system));

        const tier3 = ([
            ['zero-basic', basicDS],
            ['zero-daisyui', daisyDS],
            ['zero-material', materialDS],
            ['zero-brutalist', brutalistDS],
            ['zero-heroui', herouiDS],
            ['zero-carbon', carbonPackageDS],
        ] as const).flatMap(([pkg, ds]) => {
            const input = ds as DesignSystemInput;
            const compiled = compileDesignSystem(input, manifest);
            return reportRows(buildReport(compiled, input, manifest), `packages/${pkg}`);
        });

        await expect(formatConformanceMatrix(tier12, tier3))
            .toMatchFileSnapshot('../../../docs/design-system-conformance.md');
    });
});
