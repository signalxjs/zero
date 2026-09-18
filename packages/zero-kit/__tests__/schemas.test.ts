/**
 * The published JSON Schemas, checked against reality.
 *
 * The schemas in `packages/zero-kit/schemas/` are hand-authored, so nothing
 * ties them to the TypeScript types they mirror — this suite is that tie.
 * Every shipped design system's tokens and every one of its recipes must
 * validate (JSON-roundtripped first, so a non-JSON value fails loudly rather
 * than sliding through as an object ajv shrugs at), and the zero manifest —
 * built here the same way `gen-manifest.mjs` builds it — must validate too.
 *
 * The negative half matters just as much: a schema that accepts everything
 * would pass all of the above while being worthless to the authoring loop
 * (an AI emits tokens/recipes as JSON, this schema rejects the malformed
 * attempt before `zero-kit validate` does the semantic checks). Each schema
 * gets malformed samples that must FAIL for the reason stated.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv/dist/2020.js';
import { anatomies } from '@sigx/zero/anatomy';
import {
    RECOMMENDED_ROLE_LIST,
    BASE_SURFACE_TOKEN_LIST,
    TOKEN_CATEGORIES,
    SIZE_SCALE_LIST,
    FLAG_VOCABULARY,
    STATE_VOCABULARY,
    STATE_SYNONYMS,
    PLACEMENT_VOCABULARY,
    LAYOUT_ATTR_PREFIX,
    LAYOUT_VOCABULARY,
} from '@sigx/zero/contract';
import { AUDIT_RULES, auditDesignSystem, buildAuditArtifact, buildDsManifest, buildReport, compileDesignSystem } from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent } from '@sigx/zero-kit';
import { compileDesignSystemLynx } from '../src/targets/lynx/index.js';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { designSystem as daisyDS } from '@sigx/zero-daisyui';
import { designSystem as materialDS } from '@sigx/zero-material';
import { designSystem as brutalistDS } from '@sigx/zero-brutalist';
import { designSystem as herouiDS } from '@sigx/zero-heroui';
import { designSystem as carbonDS } from '@sigx/zero-carbon';

// Paths resolve from the repo root (vitest's cwd), matching briefs.test.ts —
// `import.meta.url` is rewritten by the test server and doesn't hit disk.
const loadSchema = (name: string): Record<string, unknown> =>
    JSON.parse(readFileSync(resolve(process.cwd(), `packages/zero-kit/schemas/${name}.schema.json`), 'utf8'));

// One ajv instance for all three: `$id`s are distinct, and sharing catches an
// accidental `$id` collision between the schema files as a compile error.
// Strict mode stays on (it catches schema-authoring typos like an ignored
// keyword); `allowUnionTypes` only permits the deliberate string|number
// union that CSS values need.
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
const validateManifest = ajv.compile(loadSchema('manifest'));
const validateTokens = ajv.compile(loadSchema('tokens'));
const validateRecipe = ajv.compile(loadSchema('recipe'));
const validateReport = ajv.compile(loadSchema('report'));
const validateAudit = ajv.compile(loadSchema('audit'));

/**
 * JSON roundtrip before validating. The design systems are authored as TS
 * modules, so a value that doesn't survive JSON (a function, `undefined`, a
 * class instance) would otherwise reach ajv as something the schema was never
 * written for — roundtripping makes such a value fail HERE, loudly.
 */
const asJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

const expectValid = (validate: ValidateFunction, data: unknown, label: string): void => {
    const ok = validate(data);
    expect(ok, `${label}: ${ajv.errorsText(validate.errors, { separator: '\n' })}`).toBe(true);
};

const SYSTEMS = [
    ['basic', basicDS],
    ['daisyui', daisyDS],
    ['material', materialDS],
    ['brutalist', brutalistDS],
    ['heroui', herouiDS],
    ['carbon', carbonDS],
] as const;

// ── manifest.schema.json ─────────────────────────────────────────────────

/**
 * The manifest as `packages/zero/scripts/gen-manifest.mjs` emits it — same
 * wrapper shape, same literal `$schema` URL, components from the same
 * `anatomies` registry. Rebuilt here (rather than read from dist/) so the
 * test needs no prior build; prose fields differ only in wording the schema
 * deliberately doesn't pin.
 */
const manifest = {
    $schema: 'https://signalxjs.github.io/zero/schemas/manifest.schema.json',
    zeroVersion: (JSON.parse(
        readFileSync(resolve(process.cwd(), 'packages/zero/package.json'), 'utf8'),
    ) as { version: string }).version,
    attributeSpec: {
        scope: 'data-scope',
        part: 'data-part',
        state: 'data-state',
        flagForm: 'presence (data-<flag>=""), never "false"',
        flagVocabulary: [...FLAG_VOCABULARY],
        stateVocabulary: Object.fromEntries(
            Object.entries(STATE_VOCABULARY).map(([family, states]) => [family, [...states]]),
        ),
        stateSynonyms: { ...STATE_SYNONYMS },
        placementVocabulary: [...PLACEMENT_VOCABULARY],
        layoutPrefix: LAYOUT_ATTR_PREFIX,
        layoutVocabulary: Object.fromEntries(
            Object.entries(LAYOUT_VOCABULARY).map(([attr, spec]) => [
                attr,
                { values: [...spec.values], ...('responsive' in spec ? { responsive: true } : {}) },
            ]),
        ),
        variantAxes: {
            color: 'data-color',
            size: 'data-size',
            variant: 'data-variant',
        },
        extraAxisForm:
            'data-<axis>, set via the `axes` prop; <axis> is kebab-case and may not '
            + 'collide with the attributes above or with flagVocabulary',
    },
    tokens: {
        colors: {
            convention: { prefix: '--color-', contentSuffix: '-content', softSuffix: '-soft' },
            required: BASE_SURFACE_TOKEN_LIST.map((t) => `--color-${t}`),
            recommendedRoles: [...RECOMMENDED_ROLE_LIST],
        },
        categories: TOKEN_CATEGORIES.map((c) => ({ ...c, path: [...c.path], recommended: [...c.recommended] })),
        recommendedSizes: [...SIZE_SCALE_LIST],
    },
    components: Object.values(anatomies).map((a) => a.toJSON()),
};

describe('manifest.schema.json', () => {
    it('accepts the manifest gen-manifest.mjs emits', () => {
        expectValid(validateManifest, asJson(manifest), 'zero manifest');
    });

    it('rejects an unknown top-level key (the emitter is closed)', () => {
        expect(validateManifest(asJson({ ...manifest, vendor: 'acme' }))).toBe(false);
    });

    it('rejects a part missing its element', () => {
        const bad = asJson(manifest) as typeof manifest;
        delete (bad.components[0]!.parts[0] as Partial<{ element: string }>).element;
        expect(validateManifest(bad)).toBe(false);
    });

    it('rejects a token category with an unknown shape', () => {
        const bad = asJson(manifest) as typeof manifest;
        (bad.tokens.categories[0] as { shape: string }).shape = 'ramp';
        expect(validateManifest(bad)).toBe(false);
    });

    it('carries the models block, and rejects a model without its change event or with a stray key', () => {
        const select = (asJson(manifest) as typeof manifest).components.find((c) => c.scope === 'select')!;
        expect(select.models).toEqual([
            { concept: 'value', type: 'T | null', multiple: true, formControl: true, default: 'defaultValue', change: 'valueChange' },
            { name: 'open', concept: 'open', type: 'boolean', default: 'defaultOpen', change: 'openChange' },
        ]);
        const noChange = asJson(manifest) as typeof manifest;
        delete (noChange.components.find((c) => c.scope === 'select')!.models![0] as Partial<{ change: string }>).change;
        expect(validateManifest(noChange)).toBe(false);
        const stray = asJson(manifest) as typeof manifest;
        (stray.components.find((c) => c.scope === 'select')!.models![0] as unknown as { event: string }).event = 'valueChange';
        expect(validateManifest(stray)).toBe(false);
        const empty = asJson(manifest) as typeof manifest;
        (empty.components.find((c) => c.scope === 'badge') as { models?: unknown[] }).models = [];
        expect(validateManifest(empty)).toBe(false);
    });

    it('rejects a non-kebab flag name', () => {
        const bad = asJson(manifest) as typeof manifest;
        (bad.attributeSpec.flagVocabulary as string[]).push('Focus_Visible');
        expect(validateManifest(bad)).toBe(false);
    });
});

// ── report.schema.json ───────────────────────────────────────────────────

/**
 * The coverage report as `writeArtifacts` emits it — built here from the same
 * `buildReport` the build calls, so the schema is checked against real output
 * rather than a hand-written sample. heroui is included even though the other
 * three suites skip it: it is the only design system that exercises
 * `declaredOut` and `mods` divergence.
 */
describe('report.schema.json', () => {
    const reportManifest = { components: manifest.components as ManifestComponent[] };
    const reports = SYSTEMS.map(
        ([name, ds]) =>
            [name, buildReport(compileDesignSystem(ds as DesignSystemInput, reportManifest), ds as DesignSystemInput, reportManifest)] as const,
    );

    /** By name, not by index — the negative cases below need a SPECIFIC system. */
    const reportNamed = (name: string): unknown =>
        reports.find(([n]) => n === name)![1];

    it.each(reports)('accepts the report emitted for %s', (name, report) => {
        expectValid(validateReport, asJson(report), `${name} report`);
    });

    it('accepts a report carrying the lynx section, findings and all', () => {
        // The reports above are built without one, which is how `scope` and
        // `package` reached LynxFinding without reaching the schema: nothing
        // validated a report that actually had lynx findings in it.
        const ds = basicDS as DesignSystemInput;
        const report = buildReport(compileDesignSystem(ds, reportManifest), ds, reportManifest);
        const lynx = compileDesignSystemLynx(ds, reportManifest);
        expect(lynx.report.dropped.length, 'expected zero-basic to drop something on lynx').toBeGreaterThan(0);

        report.lynx = {
            translated: lynx.report.translated,
            dropped: lynx.report.dropped.map((f) => ({ ...f, scope: 'acme-stepper', package: '@acme/stepper' })),
            webOnly: [{ scope: 'acme-stepper', package: '@acme/stepper', reason: 'references --press-x' }],
        };
        expectValid(validateReport, asJson(report), 'basic report with lynx');
    });


    it('rejects a lynx finding that attributes a package to no scope', () => {
        const report = reportNamed('basic') as Record<string, unknown>;
        const orphaned = {
            ...report,
            lynx: { translated: [], dropped: [{ where: 'w', what: 'x', detail: 'y', package: '@acme/stepper' }] },
        };
        expect(validateReport(asJson(orphaned))).toBe(false);
    });

    it('rejects a lynx finding whose scope is not a kebab token', () => {
        const report = reportNamed('basic') as Record<string, unknown>;
        const withLynx = {
            ...report,
            lynx: { translated: [], dropped: [{ where: 'w', what: 'x', detail: 'y', scope: 'Not Kebab' }] },
        };
        expect(validateReport(asJson(withLynx))).toBe(false);
    });

    it('rejects an unknown top-level key (the emitter is closed)', () => {
        expect(validateReport(asJson({ ...(reportNamed('basic') as object), vendor: 'acme' }))).toBe(false);
    });

    it('rejects a report without its score, and a version-1 report', () => {
        const { score: _score, ...noScore } = asJson(reportNamed('basic')) as { score: unknown };
        expect(validateReport(noScore)).toBe(false);
        expect(validateReport({ ...(reportNamed('basic') as object), reportVersion: 1 })).toBe(false);
    });

    it('accepts the contrast section an audit-backed build adds, and keeps it closed', () => {
        const contrast = [{
            name: 'basic', cells: 802, measured: 727, failing: 0, warnings: 56, disabledFailing: 0,
            unrendered: 4, unpainted: 15, unmeasured: { 'filter-or-blend': 0 },
            worst: [{ key: 'basic/basic/badge/root/-/-/-', ratio: 3.4, ink: '#8a8a8a', bg: 'inherit(base-100)' }],
        }];
        expectValid(validateReport, asJson({ ...(reportNamed('basic') as object), contrast }), 'report with contrast');
        const [theme] = contrast;
        expect(validateReport(asJson({ ...(reportNamed('basic') as object), contrast: [{ ...theme, vendor: 1 }] }))).toBe(false);
        const { worst: _worst, ...noWorst } = theme!;
        expect(validateReport(asJson({ ...(reportNamed('basic') as object), contrast: [noWorst] }))).toBe(false);
    });

    it('rejects a grade outside the closed set', () => {
        const bad = asJson(reportNamed('basic')) as { score: { grade: string } };
        bad.score.grade = 'S';
        expect(validateReport(bad)).toBe(false);
    });

    it('accepts `variant` in declaredOut and rejects an axis that cannot be declared out', () => {
        // Every named axis can be declared out of existence (#200/#295) —
        // `variants: []` lands `variant` here. A custom axis never can: `[]`
        // in `tokens.axes` is an error, not a claim.
        const report = asJson(reportNamed('basic')) as { vocabulary: { declaredOut: string[] } };
        report.vocabulary.declaredOut.push('variant');
        expectValid(validateReport, report, 'variant declared out');
        report.vocabulary.declaredOut.push('density');
        expect(validateReport(report)).toBe(false);
    });

    it('rejects an unstyled component that carries axes anyway', () => {
        // No shipped system has an unstyled component any more — probe with
        // heroui's tokens and a button-only recipe set to get one to corrupt.
        const probe: DesignSystemInput = {
            ...(herouiDS as DesignSystemInput),
            recipes: (herouiDS as DesignSystemInput).recipes.filter((r) => r.component === 'button'),
        };
        const report = buildReport(compileDesignSystem(probe, reportManifest), probe, reportManifest);
        const bad = asJson(report) as { components: Record<string, unknown> };
        expect(bad.components['accordion']).toEqual({ styled: false, parts: {} });
        bad.components['accordion'] = { styled: false, parts: {}, mods: [] };
        expect(validateReport(bad)).toBe(false);
    });

    it('rejects a state landing in no coverage bucket', () => {
        const bad = asJson(reportNamed('basic')) as {
            components: Record<string, { parts: Record<string, { flags: Record<string, unknown> }> }>;
        };
        delete bad.components['button']!.parts['root']!.flags['uncovered'];
        expect(validateReport(bad)).toBe(false);
    });

    it('rejects an axis status outside the closed set', () => {
        const bad = asJson(reportNamed('basic')) as {
            components: Record<string, { axes: Record<string, { status: string }> }>;
        };
        bad.components['button']!.axes['color']!.status = 'partial';
        expect(validateReport(bad)).toBe(false);
    });
});

// ── tokens.schema.json ───────────────────────────────────────────────────

describe('report.schema.json — the audit section', () => {
    const reportManifest = { components: manifest.components as ManifestComponent[] };
    const withAudit = (): unknown => {
        const ds = basicDS as DesignSystemInput;
        const compiled = compileDesignSystem(ds, reportManifest);
        return asJson(buildReport(compiled, ds, reportManifest, undefined, auditDesignSystem(ds, reportManifest, { compiled })));
    };

    it('accepts a report carrying the audit summary and its criterion', () => {
        expectValid(validateReport, withAudit(), 'basic report with audit');
    });

    it('rejects an audit section with an unknown key or a stray rule id', () => {
        const report = withAudit() as { audit: Record<string, unknown> & { byRule: Record<string, number> } };
        expect(validateReport({ ...report, audit: { ...report.audit, vendor: 'acme' } })).toBe(false);
        expect(validateReport({ ...report, audit: { ...report.audit, byRule: { 'not-a-rule': 1 } } })).toBe(false);
    });
});

// ── audit.schema.json ────────────────────────────────────────────────────

describe('audit.schema.json', () => {
    const auditManifest = { components: manifest.components as ManifestComponent[] };
    const audits = SYSTEMS.map(
        ([name, ds]) => [name, buildAuditArtifact(auditDesignSystem(ds as DesignSystemInput, auditManifest))] as const,
    );
    const basic = (): unknown => asJson(audits.find(([n]) => n === 'basic')![1]);

    it.each(audits)('accepts the audit emitted for %s', (name, audit) => {
        expectValid(validateAudit, asJson(audit), `${name} audit`);
    });

    it('accepts an attributed finding, and refuses a package with nothing to attribute', () => {
        // `package` reached AuditFinding with the ecosystem attribution but
        // the schema knew nothing about it, so an audit.json from a build that
        // adopted a pack no longer matched its own schema. And a package
        // without a scope is an attribution to nowhere.
        const artifact = basic() as { findings: unknown[] };
        const attributed = { ...artifact, findings: [
            { rule: 'contrast/text', severity: 'error', where: 'acme-stepper.item', message: 'm',
              scope: 'acme-stepper', package: '@acme/stepper' },
        ] };
        expectValid(validateAudit, asJson(attributed), 'attributed audit');

        const orphaned = { ...artifact, findings: [
            { rule: 'contrast/text', severity: 'error', where: 'x', message: 'm', package: '@acme/stepper' },
        ] };
        expect(validateAudit(asJson(orphaned))).toBe(false);
    });

    it('accepts findings and waivers of every shape the rules produce', () => {
        // A synthetic design system that trips several rules at once, so the
        // finding and waiver item shapes are exercised, not just the empty list.
        const ds: DesignSystemInput = {
            name: 'noisy',
            tokens: {
                roles: { primary: {} },
                sizes: [],
                defaultLight: 'day',
                themes: { day: { colorScheme: 'light', colors: {
                    'base-100': 'white', 'base-200': 'white', 'base-300': 'white',
                    'base-content': 'black', primary: 'blue', 'primary-content': 'white',
                } } },
            },
            recipes: [
                { component: 'button', parts: { root: { base: {} } }, variants: { color: { primary: { root: { base: { background: 'blue' } } } } } },
                { component: 'avatar', parts: { root: { base: {} } } },
                { component: 'tooltip', parts: { trigger: { base: { padding: '1rem' }, states: { open: {}, closed: {} } } } },
                {
                    component: 'checkbox',
                    parts: { control: { base: {} }, indicator: { base: {}, states: { checked: {}, unchecked: {}, indeterminate: {} } } },
                    skipStates: { indicator: ['checked', 'unchecked', 'indeterminate'] },
                },
            ],
        };
        const artifact = buildAuditArtifact(auditDesignSystem(ds, auditManifest));
        expect(artifact.findings.length).toBeGreaterThan(0);
        expect(artifact.waived.length).toBeGreaterThan(0);
        expectValid(validateAudit, asJson(artifact), 'noisy audit');
    });

    it('rejects an unknown top-level key (the emitter is closed)', () => {
        expect(validateAudit({ ...(basic() as object), vendor: 'acme' })).toBe(false);
    });

    it('pins the rule enum in both schemas to AUDIT_RULES', () => {
        // Two hand-written copies of one closed set (audit.schema.json's
        // ruleId and report.schema.json's audit.byRule keys) — the kind of
        // mirror this suite exists to keep honest.
        const audit = loadSchema('audit') as { $defs: { ruleId: { enum: string[] } } };
        const report = loadSchema('report') as { properties: { audit: { properties: { byRule: { propertyNames: { enum: string[] } } } } } };
        expect(audit.$defs.ruleId.enum).toEqual([...AUDIT_RULES]);
        expect(report.properties.audit.properties.byRule.propertyNames.enum).toEqual([...AUDIT_RULES]);
    });

    it('rejects a finding whose rule or severity is outside the closed sets', () => {
        const finding = { rule: 'button-affordance', severity: 'error', where: 'button.root', message: 'x' };
        const ok = { ...(basic() as { summary: unknown }), findings: [finding] };
        expectValid(validateAudit, ok, 'one finding');
        expect(validateAudit({ ...ok, findings: [{ ...finding, rule: 'not-a-rule' }] })).toBe(false);
        expect(validateAudit({ ...ok, findings: [{ ...finding, severity: 'fatal' }] })).toBe(false);
    });

    it('rejects a waiver without its mechanism, and a version other than 1', () => {
        const waiver = { rule: 'axis-coverage', severity: 'warning', where: 'avatar.color', message: 'x', waivedBy: { mechanism: 'tokens.scopes', detail: 'd' } };
        const ok = { ...(basic() as object), waived: [waiver] };
        expectValid(validateAudit, ok, 'one waiver');
        const { waivedBy: _w, ...bare } = waiver;
        expect(validateAudit({ ...ok, waived: [bare] })).toBe(false);
        expect(validateAudit({ ...(basic() as object), auditVersion: 2 })).toBe(false);
    });
});

describe('tokens.schema.json', () => {
    it.each(SYSTEMS)('accepts %s tokens', (name, ds) => {
        expectValid(validateTokens, asJson(ds.tokens), `${name} tokens`);
    });

    it('rejects an unknown top-level key', () => {
        const bad = asJson(basicDS.tokens) as Record<string, unknown>;
        bad['palette'] = {};
        expect(validateTokens(bad)).toBe(false);
    });

    it('rejects a role name that is not a bare kebab-case identifier', () => {
        expect(validateTokens(asJson({
            ...basicDS.tokens,
            roles: { 'Brand Primary': {} },
        }))).toBe(false);
    });

    it('rejects a variant value that is not a kebab-case identifier', () => {
        expect(validateTokens(asJson({
            ...basicDS.tokens,
            variants: ['solid', 'Not Kebab'],
        }))).toBe(false);
    });

    it('rejects a custom axis whose name is not kebab-case', () => {
        expect(validateTokens(asJson({
            ...basicDS.tokens,
            axes: { 'Not Kebab': ['tight'] },
        }))).toBe(false);
    });

    it('accepts a per-scope vocabulary, including the empty-list opt-out', () => {
        expectValid(validateTokens, asJson({
            ...basicDS.tokens,
            scopes: {
                select: { variants: ['solid', 'soft'], colors: ['primary'] },
                avatar: { variants: [] },
                tabs: { axes: { density: ['compact'] }, modifiers: ['boxed'] },
            },
        }), 'per-scope vocabularies');
    });

    it('rejects an unknown key inside a scope vocabulary — `parts` included', () => {
        // The reserved key, at the JSON layer. `parts` is the per-PART
        // restriction the contract settled against (docs/architecture.md,
        // "Declared vocabulary"); rejecting it by name here
        // and in the validator is what keeps adding it later additive.
        expect(validateTokens(asJson({
            ...basicDS.tokens,
            scopes: { select: { parts: { trigger: { variants: ['soft'] } } } },
        }))).toBe(false);
    });

    it('rejects a scope vocabulary value that is not a kebab-case identifier', () => {
        expect(validateTokens(asJson({
            ...basicDS.tokens,
            scopes: { select: { variants: ['Not Kebab'] } },
        }))).toBe(false);
    });

    it('rejects an unknown category under system (the category set is closed)', () => {
        expect(validateTokens(asJson({
            ...basicDS.tokens,
            system: { elevation: { low: '0 1px 2px #0002' } },
        }))).toBe(false);
    });

    it('rejects a theme with the wrong colorScheme value', () => {
        expect(validateTokens(asJson({
            themes: { t: { colorScheme: 'blue', colors: { 'base-100': '#fff' } } },
            defaultLight: 't',
        }))).toBe(false);
    });

    it('rejects a theme missing colors', () => {
        expect(validateTokens(asJson({
            themes: { t: { colorScheme: 'light' } },
            defaultLight: 't',
        }))).toBe(false);
    });

    it('rejects softMix outside 0–1', () => {
        expect(validateTokens(asJson({
            themes: { t: { colorScheme: 'light', softMix: 12, colors: { 'base-100': '#fff' } } },
            defaultLight: 't',
        }))).toBe(false);
    });

    it('rejects a theme name that would break out of [data-theme="…"]', () => {
        // Mirrors the compiler's throw and the validator's error: the name is
        // interpolated into a selector, so the schema closes the same door
        // at the JSON layer.
        expect(validateTokens(asJson({
            themes: { 'x"] *': { colorScheme: 'light', colors: { 'base-100': '#fff' } } },
            defaultLight: 'x"] *',
        }))).toBe(false);
    });

    it('rejects a typography scale in an override tier (declarations live in system)', () => {
        expect(validateTokens(asJson({
            ...basicDS.tokens,
            systemDark: { typography: { scale: { base: '1rem', ratio: 1.2 } } },
        }))).toBe(false);
    });
});

// ── recipe.schema.json ───────────────────────────────────────────────────

describe('recipe.schema.json', () => {
    it.each(SYSTEMS)('accepts every %s recipe', (name, ds) => {
        for (const recipe of ds.recipes) {
            expectValid(validateRecipe, asJson(recipe), `${name}/${recipe.component}`);
        }
    });

    it('rejects a recipe without a component', () => {
        expect(validateRecipe(asJson({ parts: { root: { base: { color: 'red' } } } }))).toBe(false);
    });

    it('rejects an unknown key inside PartStyles (the shape is closed, so typos fail)', () => {
        expect(validateRecipe(asJson({
            component: 'tabs',
            parts: { tab: { stales: { active: { color: 'red' } } } },
        }))).toBe(false);
    });

    it('rejects a variant axis name that is not kebab-case (it becomes a [data-…] selector)', () => {
        expect(validateRecipe(asJson({
            component: 'tabs',
            parts: { root: {} },
            variants: { 'My Axis': { compact: { root: { base: { padding: 0 } } } } },
        }))).toBe(false);
    });

    it('rejects a compound variant whose match value would break out of the selector', () => {
        expect(validateRecipe(asJson({
            component: 'tabs',
            parts: { root: {} },
            compoundVariants: [{
                match: { size: 'x"], [data-part="panel' },
                parts: { root: { base: { color: 'red' } } },
            }],
        }))).toBe(false);
    });

    it('rejects an at-condition key that is neither kebab nor a raw @ prelude', () => {
        expect(validateRecipe(asJson({
            component: 'button',
            parts: { root: { at: { 'Not Kebab': { base: { color: 'red' } } } } },
        }))).toBe(false);
    });

    it('rejects a CSS value that is neither string nor number', () => {
        expect(validateRecipe(asJson({
            component: 'tabs',
            parts: { root: { base: { padding: { top: 4 } } } },
        }))).toBe(false);
    });
});

// ── lynx-manifest.schema.json ────────────────────────────────────────────

/**
 * The lynx target's manifest envelope (#351). Two claims: the schema accepts
 * exactly what `writeLynxArtifacts` derives from a real DS manifest, and the
 * schema's SHARED content stays a mechanical derivation of
 * ds-manifest.schema.json — everything except `$id`/`title`/`description`,
 * the `$schema` const and the three envelope fields must be byte-equal, so
 * a ds-manifest schema change cannot silently strand the lynx copy.
 */
describe('lynx-manifest.schema.json', () => {
    const validateLynxManifest = ajv.compile(loadSchema('lynx-manifest'));
    const dsSchema = loadSchema('ds-manifest');
    const lynxSchema = loadSchema('lynx-manifest');

    it('is the ds-manifest schema plus the envelope, mechanically', () => {
        const ENVELOPE = new Set(['target', 'classGrammarVersion', 'capabilities']);
        const dsProps = dsSchema['properties'] as Record<string, unknown>;
        const lynxProps = lynxSchema['properties'] as Record<string, unknown>;
        for (const [name, value] of Object.entries(lynxProps)) {
            if (ENVELOPE.has(name)) continue;
            if (name === '$schema') {
                expect((value as { const: string }).const)
                    .toBe('https://signalxjs.github.io/zero/schemas/lynx-manifest.schema.json');
                continue;
            }
            expect(value, `properties.${name}`).toEqual(dsProps[name]);
        }
        expect(lynxSchema['$defs']).toEqual(dsSchema['$defs']);
        expect(lynxSchema['required']).toEqual([
            ...(dsSchema['required'] as string[]),
            'target', 'classGrammarVersion', 'capabilities',
        ]);
    });

    it('accepts the manifest a real lynx build derives and rejects a broken envelope', () => {
        const compiled = compileDesignSystem(basicDS as DesignSystemInput, { components: manifest.components as ManifestComponent[] });
        const base = asJson(buildDsManifest(compiled)) as Record<string, unknown>;
        const lynxManifest = {
            ...base,
            $schema: 'https://signalxjs.github.io/zero/schemas/lynx-manifest.schema.json',
            target: 'lynx',
            classGrammarVersion: 2,
            capabilities: { translated: 1, dropped: 2 },
        };
        expectValid(validateLynxManifest, asJson(lynxManifest), 'basic lynx manifest');
        // The SUPERSEDED version is the one that must be refused: this is the
        // check a runtime relies on to reject a stylesheet emitted under a
        // grammar it no longer speaks.
        expect(validateLynxManifest(asJson({ ...lynxManifest, classGrammarVersion: 1 }))).toBe(false);
        expect(validateLynxManifest(asJson({ ...lynxManifest, target: 'web' }))).toBe(false);
        const { capabilities: _dropped, ...withoutCaps } = lynxManifest;
        expect(validateLynxManifest(asJson(withoutCaps))).toBe(false);
    });
});
