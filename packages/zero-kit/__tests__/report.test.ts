/**
 * The coverage report (issue #173; docs/architecture.md, "The authoring
 * surface").
 *
 * The load-bearing test here is `the gate`: the report's `never` set is checked
 * against the *generated register artifact*, parsed back out of the emitted
 * `.d.ts` rather than restated. Both read one predicate (`undeclaredAxes` plus
 * the empty-harvest test, in `design-system.ts`), so a disagreement means one of
 * them regressed — which is exactly what #173 asks this report to guarantee, and
 * what Tier-3 rows of the conformance matrix will be generated on top of.
 *
 * The rest asserts the report against the five shipped design systems, each of
 * which stresses a different corner: heroui has no colour axis, material
 * declares thirteen roles and wires nine, and daisyUI ships five themes.
 */
import { describe, it, expect } from 'vitest';
import {
    buildReport,
    compileDesignSystem,
    compileRegisterDts,
    formatReport,
    validateDesignSystem,
} from '@sigx/zero-kit';
import type {
    DesignSystemInput,
    DesignSystemReport,
    ManifestComponent,
    StyledComponentReport,
} from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { auditDesignSystem, summarizeContrast } from '@sigx/zero-kit';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { designSystem as daisyDS } from '@sigx/zero-daisyui';
import { designSystem as materialDS } from '@sigx/zero-material';
import { designSystem as brutalistDS } from '@sigx/zero-brutalist';
import { designSystem as herouiDS } from '@sigx/zero-heroui';
import { designSystem as carbonDS } from '@sigx/zero-carbon';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

const shipped: Array<[string, DesignSystemInput]> = [
    ['basic', basicDS as DesignSystemInput],
    ['daisyui', daisyDS as DesignSystemInput],
    ['material', materialDS as DesignSystemInput],
    ['brutalist', brutalistDS as DesignSystemInput],
    ['heroui', herouiDS as DesignSystemInput],
    ['carbon', carbonDS as DesignSystemInput],
];

const reportFor = (ds: DesignSystemInput): DesignSystemReport =>
    buildReport(compileDesignSystem(ds, manifest), ds, manifest);

const styled = (report: DesignSystemReport, scope: string): StyledComponentReport => {
    const component = report.components[scope];
    if (!component?.styled) throw new Error(`expected "${scope}" to be styled`);
    return component;
};

/**
 * The axes each scope's generated register entry types `never`, read back off
 * the emitted `.d.ts`.
 *
 * Parsed rather than recomputed on purpose: recomputing would compare the
 * report against itself and prove nothing. The shape it matches is fixed by
 * `compileRegisterDts` — twelve spaces, a quoted kebab-case scope, then axis
 * lines at sixteen.
 */
function neverAxesFromRegister(dts: string): Map<string, string[]> {
    const out = new Map<string, string[]>();
    let scope: string | null = null;
    for (const line of dts.split('\n')) {
        const opening = /^ {12}'([a-z0-9-]+)': \{$/.exec(line);
        if (opening) {
            scope = opening[1]!;
            out.set(scope, []);
            continue;
        }
        if (scope && /^ {12}\};$/.test(line)) {
            scope = null;
            continue;
        }
        const axis = scope ? /^ {16}(color|size|variant): never;$/.exec(line) : null;
        if (scope && axis) out.get(scope)!.push(axis[1]!);
    }
    return out;
}

describe('the gate — the report names exactly the axes the register artifact types `never`', () => {
    it.each(shipped)('%s', (_name, ds) => {
        const compiled = compileDesignSystem(ds, manifest);
        const report = buildReport(compiled, ds, manifest);
        const fromRegister = neverAxesFromRegister(compileRegisterDts(compiled));

        // The register artifact emits an entry per RECIPE, not per anatomy
        // scope — an unstyled component has no entry at all, so it has no
        // `never` to agree about.
        expect([...fromRegister.keys()].sort()).toEqual(Object.keys(compiled.components).sort());

        for (const [scope, axes] of fromRegister) {
            expect(styled(report, scope).never, `${scope}`).toEqual([...axes].sort());
        }
    });

    it('is not vacuous — heroui and material both have real `never` axes', () => {
        // If the parser silently matched nothing, every assertion above would
        // pass on two empty maps.
        const heroui = reportFor(herouiDS as DesignSystemInput);
        expect(styled(heroui, 'button').never).toEqual(['color']);
        expect(styled(heroui, 'tabs').never).toEqual(['color', 'variant']);

        const material = reportFor(materialDS as DesignSystemInput);
        expect(styled(material, 'button').never).toEqual([]);
        expect(styled(material, 'tabs').never).toEqual(['variant']);
    });
});

describe('axis status', () => {
    it('separates "declared out of existence" from "left unwired"', () => {
        // The distinction the register artifact's two doc comments carry: an
        // author told to "go wire colour" under heroui would be given wrong
        // advice — there is no colour axis to wire.
        const heroui = reportFor(herouiDS as DesignSystemInput);
        expect(heroui.vocabulary.declaredOut).toEqual(['color']);
        expect(styled(heroui, 'button').axes.color.status).toBe('undeclared');
        expect(styled(heroui, 'tabs').axes.variant.status).toBe('unwired');
        expect(styled(heroui, 'button').axes.variant.status).toBe('wired');
    });

    it('leaves an OMITTED `variants` declarable-but-unwired rather than undeclared', () => {
        // Omitting `tokens.variants` means "declared nothing", not "no variant
        // axis" — every shipped skin declares a vocabulary, so `variant` never
        // appears in their declaredOut.
        for (const [, ds] of shipped) {
            expect(reportFor(ds).vocabulary.declaredOut).not.toContain('variant');
        }
    });

    it('reads `variants: []` as the variant axis declared out of existence', () => {
        // #200/#295: the claim `sizes: []` makes about size. The report says
        // "no such axis" (not "wired by nothing"), the per-scope status is
        // `undeclared`, and the register artifact gives the declared-out
        // reason — one predicate, two readers.
        const probe: DesignSystemInput = {
            ...(basicDS as DesignSystemInput),
            tokens: { ...(basicDS as DesignSystemInput).tokens, variants: [] },
            recipes: (basicDS as DesignSystemInput).recipes.map((r) => {
                const { variant: _variant, ...axes } = r.variants ?? {};
                const { variant: _default, ...defaults } = r.defaultVariants ?? {};
                return {
                    ...r,
                    variants: axes,
                    defaultVariants: defaults,
                    compoundVariants: r.compoundVariants?.filter((c) => !('variant' in c.match)),
                };
            }),
        };
        const report = reportFor(probe);
        expect(report.vocabulary.declaredOut).toEqual(['variant']);
        expect(report.vocabulary.variants).toEqual([]);
        expect(styled(report, 'button').axes.variant.status).toBe('undeclared');
        expect(styled(report, 'button').axes.color.status).toBe('wired');
        const dts = compileRegisterDts(compileDesignSystem(probe, manifest));
        expect(dts).toContain('basic declares no variant axis at all');
        expect(dts).not.toContain('no basic recipe wires it');
    });

    it('reports the four colour-carrying systems as having no declaredOut axes', () => {
        for (const name of ['basic', 'daisyui', 'material', 'brutalist']) {
            const ds = shipped.find(([n]) => n === name)![1];
            expect(reportFor(ds).vocabulary.declaredOut, name).toEqual([]);
        }
    });
});

describe('component coverage', () => {
    it('counts styled components against the anatomy manifest', () => {
        // No shipped system has an unstyled component any more, so the
        // negative path probes heroui's tokens with a button-only recipe set.
        const probe: DesignSystemInput = {
            ...(herouiDS as DesignSystemInput),
            recipes: (herouiDS as DesignSystemInput).recipes.filter((r) => r.component === 'button'),
        };
        const report = reportFor(probe);
        expect(report.coverage.componentsTotal).toBe(manifest.components.length);
        expect(report.coverage.componentsStyled).toBe(1);
        expect(report.coverage.unstyled).toHaveLength(manifest.components.length - 1);
        expect(report.coverage.unstyled).toContain('accordion');
        expect(report.components['accordion']).toEqual({ styled: false, parts: {} });

        const heroui = reportFor(herouiDS as DesignSystemInput);
        expect(heroui.coverage.componentsStyled).toBe(manifest.components.length);
        expect(heroui.coverage.unstyled).toEqual([]);
    });

    it('reports the four full skins as complete', () => {
        for (const name of ['basic', 'daisyui', 'material', 'brutalist']) {
            const report = reportFor(shipped.find(([n]) => n === name)![1]);
            expect(report.coverage.unstyled, name).toEqual([]);
            expect(report.coverage.componentsStyled, name).toBe(report.coverage.componentsTotal);
        }
    });
});

describe('declared but unwired', () => {
    it('surfaces material\'s four tonal roles, which no validator rule catches', () => {
        // `color` and `size` have no declared-but-unwired check in the
        // validator — only `variant`, `tokens.axes` and `modifiers` do — so
        // this report is the only place the gap is stated.
        const material = reportFor(materialDS as DesignSystemInput);
        expect(material.vocabulary.roles).toHaveLength(13);
        expect(material.unwired.color).toEqual([
            'outline', 'surface', 'surface-container', 'surface-container-high',
        ]);
    });

    it('finds nothing unwired in the design systems that declare only what they use', () => {
        const basic = reportFor(basicDS as DesignSystemInput);
        expect(basic.unwired).toEqual({ color: [], size: [], variant: [], axes: {}, modifiers: [] });

        const heroui = reportFor(herouiDS as DesignSystemInput);
        expect(heroui.unwired.variant).toEqual([]);
        expect(heroui.unwired.modifiers).toEqual([]);
    });
});

describe('the axis-agnostic divergence report', () => {
    it('generalises the colour-only warning to every axis a design system wires', () => {
        const material = reportFor(materialDS as DesignSystemInput);
        // 'mods' joined when table's zebra/hover landed (#340).
        expect(Object.keys(material.divergence).sort()).toEqual(['color', 'mods', 'size', 'variant']);

        // The colour rule's own semantics, preserved: compared against the
        // union wired ANYWHERE, not against the declared vocabulary — so the
        // four roles no component wires are absent here while showing up in
        // `unwired.color`.
        expect(material.divergence['color']!.wiredAnywhere).not.toContain('surface');
    });

    it('covers modifiers, which are a value set like any other', () => {
        const heroui = reportFor(herouiDS as DesignSystemInput);
        expect(Object.keys(heroui.divergence).sort()).toEqual(['mods', 'size', 'variant']);
        expect(heroui.divergence['mods']!.wiredAnywhere).toEqual(['icon-only', 'pending', 'striped']);
    });

    it('lists only components that wire something — wiring nothing is `never`, not divergence', () => {
        const basic = reportFor(basicDS as DesignSystemInput);
        const variant = basic.divergence['variant']!;
        // `button` wires the whole vocabulary; `badge` and `select` wire the
        // subsets they declare for themselves (#311, #297). Three carriers,
        // per #175 and its successors (docs/architecture.md, "The ledgers").
        expect(Object.keys(variant.byComponent)).toEqual(['badge', 'button', 'select']);
        // Both narrowings ARE strict subsets, and that is the point:
        // `declared` is what keeps the report from crying wolf about them. A
        // narrowing the design system wrote down is not divergence, and this
        // is the assertion that says the two are told apart rather than
        // conflated.
        expect(variant.subsets.map((s) => s.scope)).toEqual(['badge', 'select']);
        expect(variant.declared).toEqual(['badge', 'select']);
    });

    it('flags a component wiring a strict subset of its siblings', () => {
        const ds: DesignSystemInput = {
            ...(basicDS as DesignSystemInput),
            recipes: [
                {
                    component: 'button',
                    parts: { root: { states: { 'focus-visible': { outline: '1px solid' } } } },
                    variants: {
                        color: {
                            primary: { root: { base: { color: 'red' } } },
                            success: { root: { base: { color: 'green' } } },
                        },
                    },
                },
                {
                    component: 'switch',
                    parts: { root: { states: { 'focus-visible': { outline: '1px solid' } } } },
                    variants: { color: { primary: { root: { base: { color: 'red' } } } } },
                },
            ],
        };
        const divergence = reportFor(ds).divergence['color']!;
        expect(divergence.wiredAnywhere).toEqual(['primary', 'success']);
        expect(divergence.subsets).toEqual([
            { scope: 'switch', wired: ['primary'], missing: ['success'] },
        ]);
    });
});

describe('state and flag coverage', () => {
    it('counts a state reached through a raw selector as covered', () => {
        // Every shipped design system styles `pressed` as
        // `&[data-pressed]:not([data-disabled])` rather than through `states`.
        // Reading only `states` would tell an author to style what they already
        // styled — and would report `disabled` as covered by that same
        // selector, which negates it.
        const basic = reportFor(basicDS as DesignSystemInput);
        expect(styled(basic, 'button').parts['root']!.flags.covered).toContain('pressed');
    });

    it('does not count a state that a `:not()` excludes', () => {
        const ds: DesignSystemInput = {
            ...(basicDS as DesignSystemInput),
            recipes: [{
                component: 'button',
                parts: {
                    root: {
                        states: { 'focus-visible': { outline: '1px solid' } },
                        selectors: { '&[data-pressed]:not([data-disabled])': { transform: 'none' } },
                    },
                },
            }],
        };
        const flags = styled(reportFor(ds), 'button').parts['root']!.flags;
        expect(flags.covered).toEqual(['focus-visible', 'pressed']);
        expect(flags.uncovered).toEqual(['disabled', 'press-animating']);
    });

    it('separates conditional coverage from unconditional', () => {
        const ds: DesignSystemInput = {
            ...(basicDS as DesignSystemInput),
            recipes: [{
                component: 'button',
                parts: {
                    root: {
                        states: { 'focus-visible': { outline: '1px solid' } },
                        // Only under a condition — real, but not unconditional.
                        at: { 'reduced-motion': { states: { disabled: { opacity: '0.5' } } } },
                    },
                },
                variants: { color: { primary: { root: { states: { pressed: { opacity: '0.9' } } } } } },
            }],
        };
        const flags = styled(reportFor(ds), 'button').parts['root']!.flags;
        expect(flags.covered).toEqual(['focus-visible']);
        expect(flags.coveredIndirectly).toEqual(['disabled', 'pressed']);
        expect(flags.uncovered).toEqual(['press-animating']);
    });

    it('round-trips `skipStates` as deliberately skipped, per part', () => {
        const material = reportFor(materialDS as DesignSystemInput);
        expect(styled(material, 'progress').parts['root']!.states.skipped)
            .toEqual(['complete', 'indeterminate', 'loading']);
        expect(styled(material, 'radio-group').parts['item']!.flags.skipped).toEqual(['focus-visible']);
    });

    it('counts a part styled only inside a variant as styled', () => {
        // No shipped design system does this today, so the rule is latent —
        // but `styled: false` beside a non-empty `coveredIndirectly` would be
        // the report contradicting itself.
        const ds: DesignSystemInput = {
            ...(basicDS as DesignSystemInput),
            recipes: [{
                component: 'tabs',
                parts: { root: { states: { active: { color: 'red' } } } },
                variants: { color: { primary: { panel: { base: { background: 'red' } } } } },
            }],
        };
        const parts = styled(reportFor(ds), 'tabs').parts;
        expect(parts['panel']!.styled).toBe(true);
        expect(parts['root']!.styled).toBe(true);
        // A part named nowhere in the recipe stays unstyled.
        expect(parts['list']!.styled).toBe(false);
    });

    it('reports every manifest part, styled or not', () => {
        const basic = reportFor(basicDS as DesignSystemInput);
        const select = manifest.components.find((c) => c.scope === 'select')!;
        expect(Object.keys(styled(basic, 'select').parts).sort())
            .toEqual(select.parts.map((p) => p.name).sort());
    });
});

describe('contrast margin per theme', () => {
    it('reports the worst declared pair per theme, for every shipped system', () => {
        for (const [name, ds] of shipped) {
            const report = reportFor(ds);
            expect(report.themes.map((t) => t.name), name)
                .toEqual(Object.keys(ds.tokens.themes));
            for (const theme of report.themes) {
                expect(theme.minContrast, `${name}/${theme.name}`).not.toBeNull();
                // The validator errors below 3:1, and every shipped system is
                // green — so the report must agree.
                expect(theme.minContrast!, `${name}/${theme.name}`).toBeGreaterThanOrEqual(3);
                expect(theme.belowMin, `${name}/${theme.name}`).toBe(0);
                expect(theme.worstPair).not.toBeNull();
                const worst = theme.pairs.find(
                    (p) => p.bg === theme.worstPair![0] && p.fg === theme.worstPair![1],
                );
                expect(worst!.ratio).toBe(theme.minContrast);
            }
        }
    });

    it('counts the sub-AA pairs the validator warns about', () => {
        // daisyUI's light theme has one pair between 3:1 and 4.5:1; the
        // validator warns for it, and the report has to show the same margin.
        const daisy = reportFor(daisyDS as DesignSystemInput);
        const light = daisy.themes.find((t) => t.name === 'light')!;
        expect(light.belowAA).toBe(1);
        expect(light.belowMin).toBe(0);
        expect(light.minContrast!).toBeLessThan(4.5);

        const warnings = validateDesignSystem(daisyDS as DesignSystemInput, manifest).warnings
            .filter((w) => w.where === 'themes.light' && w.message.includes('contrast'));
        expect(warnings).toHaveLength(light.belowAA);
    });

    it('collapses to the base surfaces when a design system declares no roles', () => {
        const heroui = reportFor(herouiDS as DesignSystemInput);
        for (const theme of heroui.themes) {
            expect(theme.pairs.map((p) => p.bg)).toEqual(['base-100', 'base-200', 'base-300']);
        }
    });

    it('rounds ratios, so a committed report is not a diff against itself', () => {
        for (const [, ds] of shipped) {
            for (const theme of reportFor(ds).themes) {
                for (const pair of theme.pairs) {
                    expect(pair.ratio).toBe(Number(pair.ratio.toFixed(2)));
                }
            }
        }
    });
});

describe('a design system that does not compile', () => {
    /**
     * Why `runValidate` catches around `buildReport`.
     *
     * `validateDesignSystem` compiles inside its own try/catch and turns the
     * throw into an error on `recipes`, so plain `zero:validate` reports a
     * FAILED validation. The report path compiles a second time — and if that
     * throw escaped, asking for a report would replace that message with a raw
     * compiler stack, for the one input where the report has nothing to say.
     *
     * The command itself is not reachable from this suite: `loadDesignSystem`
     * dynamic-imports the entry, and under vitest that goes through vite's
     * module runner, which cannot load a file written outside the project. This
     * asserts the premise the catch rests on instead.
     */
    const broken: DesignSystemInput = {
        ...(basicDS as DesignSystemInput),
        recipes: [{ component: 'not-a-component', parts: { root: {} } }],
    };

    it('throws from the compiler but is only an error from the validator', () => {
        expect(() => compileDesignSystem(broken, manifest)).toThrow(/unknown component/);

        const result = validateDesignSystem(broken, manifest);
        expect(result.ok).toBe(false);
        expect(result.errors.map((e) => `${e.where}: ${e.message}`).join('\n'))
            .toMatch(/recipes: .*unknown component "not-a-component"/);
    });
});

describe('the score — every shipped skin clears the floor', () => {
    // Measured 2026-09-08 (#408): basic 96.5, daisyui 93.2, material 97.1,
    // brutalist 95.0, heroui 97.4, carbon 96.8. The floors sit under the
    // measurements with room for an honest regression to register before
    // the grade flips, and the states floor is the loosest because that is
    // the criterion the skins actually differ on (74.8 – 87.2).
    it.each(shipped)('%s', (_name, ds) => {
        const report = reportFor(ds);
        expect(report.reportVersion).toBe(2);
        expect(report.score.grade).toBe('A');
        expect(report.score.total).toBeGreaterThanOrEqual(90);
        expect(report.score.criteria.components.score).toBe(100);
        expect(report.score.criteria.vocabulary.score).toBe(100);
        expect(report.score.criteria.states.score).toBeGreaterThanOrEqual(70);
        expect(report.score.criteria.contrast.score).toBeGreaterThanOrEqual(85);
    });

    it('sits right after the name, where a reader of the JSON looks first', () => {
        expect(Object.keys(reportFor(basicDS as DesignSystemInput)).slice(0, 4))
            .toEqual(['$schema', 'reportVersion', 'name', 'score']);
    });
});

describe('report shape', () => {
    it('is JSON-serialisable and stable across two builds', () => {
        for (const [name, ds] of shipped) {
            const once = JSON.stringify(reportFor(ds));
            expect(JSON.stringify(reportFor(ds)), name).toBe(once);
        }
    });

    it('carries the issue counts when handed a validation result', () => {
        const result = validateDesignSystem(basicDS as DesignSystemInput, manifest);
        const compiled = compileDesignSystem(basicDS as DesignSystemInput, manifest);
        const report = buildReport(compiled, basicDS as DesignSystemInput, manifest, result);
        expect(report.issues).toEqual({ errors: result.errors.length, warnings: result.warnings.length });
        // Optional: the report stands on its own as a coverage document.
        expect(buildReport(compiled, basicDS as DesignSystemInput, manifest).issues).toBeUndefined();
    });
});

describe('formatReport', () => {
    // Derived, not retyped: every one of these lines is "N of all components",
    // and hardcoding the total makes four assertions that fail for the one
    // reason they are not about — a new component landing.
    const total = manifest.components.length;

    it('names the design system, the coverage and every theme', () => {
        const lines = formatReport(reportFor(herouiDS as DesignSystemInput));
        expect(lines[0]).toBe('heroui — coverage report');
        expect(lines[1]).toMatch(/^  score \d+(\.\d)? \(A\): components 100 · /);
        expect(lines.join('\n')).toContain(`components styled: ${total}/${total} (100%)`);
        expect(lines.join('\n')).toContain(`color wired: 0/${total} (0%) — no such axis`);
        expect(lines.join('\n')).toContain('theme hero-light: min contrast');
    });

    it('distinguishes an axis with no vocabulary from one nothing wires', () => {
        // Under heroui `color` does not exist; under the colour systems
        // `variant` exists and only `button` wires it. Same zero, different
        // advice.
        expect(formatReport(reportFor(herouiDS as DesignSystemInput)).join('\n'))
            .toContain(`color wired: 0/${total} (0%) — no such axis`);
        expect(formatReport(reportFor(basicDS as DesignSystemInput)).join('\n'))
            // Three now: button on the full vocabulary, badge and select on
            // vocabularies of their own (#311, #297).
            .toContain(`variant wired: 3/${total} (`);
    });

    it('returns lines rather than printing, so the caller picks the channel', () => {
        // The CLI logger prefixes `[sigx] ` per line; the JSON path must not go
        // near it.
        const lines = formatReport(reportFor(basicDS as DesignSystemInput));
        expect(Array.isArray(lines)).toBe(true);
        expect(lines.every((l) => !l.includes('\n'))).toBe(true);
    });
});

describe('the static contrast matrix, summarised (#403)', () => {
    const audit = auditDesignSystem(basicDS, manifest, { rules: ['contrast/text', 'contrast/indicator', 'contrast/unmeasured'] });
    const matrix = audit.contrast;

    it('folds the audit\'s cell table into `report.contrast`, one row per theme, and prints it', () => {
        const compiled = compileDesignSystem(basicDS, manifest);
        const report = buildReport(compiled, basicDS, manifest, undefined, audit);
        expect(report.contrast?.map((t) => t.name)).toEqual(matrix.themes.map((t) => t.name));
        const [row] = report.contrast!;
        const [theme] = matrix.themes;
        expect(row!.cells).toBe(theme!.cells.length);
        expect(row!.measured + row!.unrendered + row!.unpainted + Object.values(row!.unmeasured).reduce((a, b) => a + b, 0)).toBe(row!.cells);
        expect(row!.failing).toBe(0);
        expect(row!.worst.length).toBeLessThanOrEqual(10);
        expect(row!.worst.map((w) => w.ratio)).toEqual([...row!.worst.map((w) => w.ratio)].sort((a, b) => a - b));
        expect(formatReport(report).some((line) => /state matrix \d+ cells, \d+ measured/.test(line))).toBe(true);
    });

    it('is absent, not empty, when the report was built without an audit', () => {
        const report = reportFor(basicDS);
        expect('contrast' in report).toBe(false);
        expect(formatReport(report).some((line) => line.includes('state matrix'))).toBe(false);
    });

    it('summarizeContrast counts unmeasured cells by reason', () => {
        const [row] = summarizeContrast({
            themes: [{
                name: 't',
                cells: [
                    { key: 'a', scope: 's', part: 'p', matrix: 'text', verdict: 'unmeasured', reason: 'gradient-or-image' },
                    { key: 'b', scope: 's', part: 'p', matrix: 'text', verdict: 'unmeasured', reason: 'gradient-or-image' },
                    { key: 'c', scope: 's', part: 'p', matrix: 'text', verdict: 'fail', ratio: 1.5, inGroup: 1.5, ink: '#fff', bg: '#eee' },
                ],
            }],
        });
        expect(row).toMatchObject({ cells: 3, measured: 1, failing: 1, unmeasured: { 'gradient-or-image': 2 } });
        expect(row!.worst).toEqual([{ key: 'c', ratio: 1.5, ink: '#fff', bg: '#eee' }]);
    });
});
