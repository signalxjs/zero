/**
 * The composite score (`src/resolve/score.ts`, #408) — the scalar a
 * generating agent iterates against.
 *
 * Three things a score can get wrong are pinned here rather than hoped
 * about: it must not punish a design system for DECLINING an axis (heroui's
 * `roles: {}`, material's fill roles), it must not be raisable by moving
 * states into `skipStates`, and its weights must renormalise over the
 * criteria that are present so a report built without a validation pass is
 * comparable to one built with it. The six shipped skins' floors live in
 * `report.test.ts`, beside the rest of the report gate.
 */
import { describe, it, expect } from 'vitest';
import { buildReport, compileDesignSystem, computeScore, formatScore, gradeFor, pairScore, SCORE_WEIGHTS, validateDesignSystem } from '@sigx/zero-kit';
import type { DesignSystemInput, DesignSystemReport, ManifestComponent, RecipeInput } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { designSystem as materialDS } from '@sigx/zero-material';
import { designSystem as herouiDS } from '@sigx/zero-heroui';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

const reportFor = (ds: DesignSystemInput, validate = false): DesignSystemReport =>
    buildReport(compileDesignSystem(ds, manifest), ds, manifest, validate ? validateDesignSystem(ds, manifest) : undefined);

describe('pairScore', () => {
    it('is full marks at AA, half at the validator floor, nothing at 1:1, linear between', () => {
        expect(pairScore(21)).toBe(100);
        expect(pairScore(4.5)).toBe(100);
        expect(pairScore(3)).toBe(50);
        expect(pairScore(1)).toBe(0);
        expect(pairScore(0.5)).toBe(0);
        // The plan's calibration point: a pair just over the floor is barely
        // better than the floor, not "fine".
        expect(pairScore(3.05)).toBeCloseTo(51.67, 1);
        expect(pairScore(3.75)).toBe(75);
        expect(pairScore(2)).toBe(25);
    });
});

describe('gradeFor', () => {
    it('uses the fixed thresholds, inclusive', () => {
        expect(gradeFor(100)).toBe('A');
        expect(gradeFor(90)).toBe('A');
        expect(gradeFor(89.9)).toBe('B');
        expect(gradeFor(80)).toBe('B');
        expect(gradeFor(70)).toBe('C');
        expect(gradeFor(60)).toBe('D');
        expect(gradeFor(59.9)).toBe('F');
        expect(gradeFor(0)).toBe('F');
    });
});

describe('a declined axis costs nothing', () => {
    it('heroui scores full vocabulary marks although `color` is declared out of existence', () => {
        const report = reportFor(herouiDS as DesignSystemInput);
        expect(report.vocabulary.declaredOut).toContain('color');
        expect(report.score.criteria.vocabulary.score).toBe(100);
        expect(report.score.criteria.vocabulary.detail['declaredOut']).toBe('color');
    });

    it('a design system with `variants: []` scores full vocabulary marks', () => {
        // #200/#295: declared out of existence is a statement, not a gap —
        // the same treatment heroui's `roles: {}` gets above.
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
        expect(report.score.criteria.vocabulary.score).toBe(100);
        expect(report.score.criteria.vocabulary.detail['declaredOut']).toBe('variant');
    });

    it('material scores full vocabulary marks although four fill roles are unwired', () => {
        // The four tonal `surface*`/`outline` roles are tokens, not axis
        // values (#286) — `unwired.color` lists them, the score must not.
        const report = reportFor(materialDS as DesignSystemInput);
        expect(report.unwired.color.length).toBe(4);
        expect(report.score.criteria.vocabulary.score).toBe(100);
    });

    it('a declared value nobody wires does cost — the same role declared as an axis value', () => {
        // Same recipes as basic, one more role that no recipe reads: one of
        // nineteen declared values unhonoured.
        const basic = basicDS as DesignSystemInput;
        const ds: DesignSystemInput = {
            ...basic,
            tokens: {
                ...basic.tokens,
                roles: { ...basic.tokens.roles, tertiary: {} },
                themes: Object.fromEntries(Object.entries(basic.tokens.themes).map(([name, theme]) => [name, {
                    ...theme,
                    colors: { ...theme.colors, tertiary: 'oklch(50% 0.1 300)', 'tertiary-content': 'oklch(98% 0.01 300)' },
                }])),
            } as DesignSystemInput['tokens'],
        };
        const report = reportFor(ds);
        expect(report.unwired.color).toEqual(['tertiary']);
        const { declared, unhonoured } = report.score.criteria.vocabulary.detail;
        expect(unhonoured).toBe(1);
        expect(report.score.criteria.vocabulary.score).toBe(Number((((declared as number) - 1) / (declared as number) * 100).toFixed(1)));
    });
});

describe('components', () => {
    it('is zero with no recipes at all, and the total is graded F', () => {
        const ds: DesignSystemInput = { ...(herouiDS as DesignSystemInput), recipes: [] };
        const report = reportFor(ds);
        expect(report.score.criteria.components.score).toBe(0);
        expect(report.score.criteria.components.detail).toEqual({ styled: 0, total: manifest.components.length });
        expect(report.score.grade).toBe('F');
    });

    it('a Button-only design system is not "done" — the discriminating case', () => {
        const heroui = herouiDS as DesignSystemInput;
        const probe: DesignSystemInput = { ...heroui, recipes: heroui.recipes.filter((r) => r.component === 'button') };
        const report = reportFor(probe, true);
        expect(report.score.criteria.components.score).toBeLessThan(3);
        expect(report.score.grade).not.toBe('A');
        expect(report.score.grade).not.toBe('B');
        expect(report.score.total).toBeLessThan(reportFor(heroui, true).score.total - 25);
    });
});

describe('`skipStates` is half credit', () => {
    it('a recipe that skips every state and flag cannot score above 50', () => {
        const button = manifest.components.find((c) => c.scope === 'button')!;
        const parts: RecipeInput['parts'] = {};
        const skipStates: Record<string, string[]> = {};
        for (const part of button.parts) {
            parts[part.name] = { base: { color: 'var(--color-base-content)' } };
            const names = [...(part.states ?? []), ...(part.flags ?? [])];
            if (names.length > 0) skipStates[part.name] = names;
        }
        const ds: DesignSystemInput = {
            ...(herouiDS as DesignSystemInput),
            recipes: [{ component: 'button', parts, skipStates }],
        };
        const report = reportFor(ds);
        const { states } = report.score.criteria;
        expect(states.detail['uncovered']).toBe(0);
        expect(states.detail['covered']).toBe(0);
        expect(states.detail['skipped']).toBeGreaterThan(0);
        expect(states.score).toBe(50);
    });

    it('covering the same states scores full marks', () => {
        const report = reportFor(herouiDS as DesignSystemInput);
        const { covered, coveredIndirectly, skipped, total } = report.score.criteria.states.detail as Record<string, number>;
        expect(report.score.criteria.states.score)
            .toBe(Number((((covered + coveredIndirectly + 0.5 * skipped) / total) * 100).toFixed(1)));
    });
});

describe('contrast grades the weakest theme', () => {
    it('is the min over themes of the mean pair score', () => {
        const report = reportFor(basicDS as DesignSystemInput);
        const means = report.themes.map((t) => t.pairs.reduce((s, p) => s + pairScore(p.ratio), 0) / t.pairs.length);
        expect(report.score.criteria.contrast.score).toBe(Number(Math.min(...means).toFixed(1)));
        expect(report.themes.map((t) => t.name)).toContain(report.score.criteria.contrast.detail['weakestTheme']);
    });

    it('is zero, and says why, when nothing could be measured', () => {
        // Reached through the report body rather than a design system: the
        // compiler refuses a themeless input, and an unparseable colour is a
        // validator error — but a report is a plain document, and a consumer
        // handing one in with nothing measurable must get 0 with a reason,
        // never a bogus 100.
        const ds = herouiDS as DesignSystemInput;
        const compiled = compileDesignSystem(ds, manifest);
        const { score: _score, ...body } = reportFor(ds);
        expect(computeScore({ ...body, themes: [] }, compiled).criteria.contrast)
            .toEqual({ score: 0, weight: SCORE_WEIGHTS.contrast, detail: { reason: 'no themes' } });
        const unmeasured = body.themes.map((t) => ({ ...t, pairs: [], minContrast: null, worstPair: null }));
        const contrast = computeScore({ ...body, themes: unmeasured }, compiled).criteria.contrast;
        expect(contrast.score).toBe(0);
        expect(contrast.detail['reason']).toBe('no measurable pair');
    });
});

describe('weights renormalise over the present criteria', () => {
    const ds = basicDS as DesignSystemInput;
    const compiled = compileDesignSystem(ds, manifest);

    it('omits `issues` without a validation pass and `audit` without an audit', () => {
        const report = reportFor(ds);
        expect(report.issues).toBeUndefined();
        expect(report.score.criteria.issues).toBeUndefined();
        expect(report.score.criteria.audit).toBeUndefined();
        const present = Object.values(report.score.criteria);
        expect(present.reduce((s, c) => s + c.weight, 0)).toBe(85);
        const mean = present.reduce((s, c) => s + c.score * c.weight, 0) / 85;
        expect(report.score.total).toBe(Number(mean.toFixed(1)));
    });

    it('carries `issues` with a validation pass — ten points an error, two a warning', () => {
        const report = reportFor(ds, true);
        expect(report.score.criteria.issues?.weight).toBe(SCORE_WEIGHTS.issues);
        const { errors, warnings } = report.issues!;
        expect(report.score.criteria.issues?.score).toBe(Math.max(0, 100 - 10 * errors - 2 * warnings));
        expect(Object.values(report.score.criteria).reduce((s, c) => s + c.weight, 0)).toBe(100);
    });

    it('takes an audit score as a sixth criterion, which moves the total', () => {
        const report = reportFor(ds, true);
        const { score: _score, ...body } = report;
        const without = computeScore(body, compiled);
        const withAudit = computeScore(body, compiled, { audit: 0 });
        expect(without).toEqual(report.score);
        expect(withAudit.criteria.audit).toEqual({ score: 0, weight: SCORE_WEIGHTS.audit, detail: {} });
        expect(withAudit.total).toBeLessThan(without.total);
        expect(computeScore(body, compiled, { audit: 100 }).total).toBeGreaterThan(without.total);
    });
});

describe('formatScore', () => {
    it('is one line, total and grade first, every present criterion after', () => {
        const line = formatScore(reportFor(basicDS as DesignSystemInput, true).score);
        expect(line).toMatch(/^score \d+(\.\d)? \([A-F]\): components \d+(\.\d)? · vocabulary \d+(\.\d)? · states \d+(\.\d)? · contrast \d+(\.\d)? · issues \d+(\.\d)?$/);
    });
});
