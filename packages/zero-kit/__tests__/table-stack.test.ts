/**
 * Table's stacked mode (zero#55) on the kit side: the per-breakpoint
 * geometry `compileDesignSystem` writes into `@layer zero.structure`, and
 * `tableStackAt`, the helper a skin draws its cards with.
 *
 * The real browser proof — rows stack below the breakpoint and not above it,
 * in all six skins — is `examples/playground/e2e/table.spec.ts`. These pin
 * the emission: which rules, where, and that nothing grades zero's geometry
 * as the skin's.
 */
import { describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import { auditDesignSystem, compileDesignSystem, compileRecipeCss, parseRules, tableStackAt, tableStackCss } from '@sigx/zero-kit';
import type { ManifestComponent, RecipeInput } from '@sigx/zero-kit';
import { designSystem as basic } from '@sigx/zero-basic';
import { compileLynxRecipeCss, emptyReport } from '../src/targets/lynx/index.js';

const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };
const table = manifest.components.find((c) => c.scope === 'table')!;
const breakpoints = { sm: '40rem', md: '48rem' };
const ROOT_MD = '[data-scope="table"][data-part="root"][data-l-stack="md"]';

describe('tableStackCss — the geometry', () => {
    const css = tableStackCss(breakpoints);
    const rules = parseRules(css);
    const under = (width: string) => rules.filter((r) => r.at.includes(`@media (width < ${width})`));

    it('is one zero.structure block: the label default, then one range per breakpoint', () => {
        expect(css.startsWith('@layer zero.structure {')).toBe(true);
        expect(rules.every((r) => r.at[0] === '@layer zero.structure')).toBe(true);
        expect(rules[0]).toEqual({
            at: ['@layer zero.structure'],
            selector: '[data-scope="table"][data-part="cell-label"]',
            decls: ['display: none'],
        });
        expect(under('40rem').length).toBeGreaterThan(0);
        expect(under('48rem').length).toBe(under('40rem').length);
    });

    it('keys every range on its own breakpoint name, through the whole child chain', () => {
        for (const rule of under('48rem')) {
            expect(rule.selector.startsWith(`${ROOT_MD} > [data-scope="table"][data-part="table"]`)).toBe(true);
            expect(rule.selector).not.toContain('data-l-stack="sm"');
        }
    });

    it('hides the head from sight but not from the tree, and resets the column widths', () => {
        const head = under('48rem').find((r) => r.selector.endsWith('[data-part="head"]'))!;
        expect(head.decls).toContain('clip-path: inset(50%)');
        expect(head.decls).not.toContain('display: none');
        const column = under('48rem').find((r) => r.selector.endsWith('[data-part="column"]'))!;
        expect(column.decls).toEqual(['width: auto']);
    });

    it('hangs the label in the start padding of a cell that has one', () => {
        const padded = under('48rem').find((r) => r.selector.includes(':has('))!;
        expect(padded.selector.endsWith(':has(> [data-scope="table"][data-part="cell-label"])')).toBe(true);
        expect(padded.decls[0]).toMatch(/^padding-inline-start: calc\(var\(--table-stack-label-size, 8rem\) \+ /);
        const label = under('48rem').find((r) => r.selector.endsWith('[data-part="cell-label"]'))!;
        expect(label.decls).toContain('float: inline-start');
        expect(label.decls).toContain('display: block');
    });

    it('is empty for a design system with no breakpoints — no stack value could name one', () => {
        expect(tableStackCss({})).toBe('');
    });
});

describe('compileDesignSystem writes it', () => {
    it("into the table's component stylesheet, and so the index", () => {
        const compiled = compileDesignSystem(basic, manifest);
        expect(compiled.componentCss.table).toContain('@layer zero.structure {');
        expect(compiled.componentCss.table).toContain(`@media (width < ${basic.tokens.breakpoints!.md})`);
        // Once: through the table's stylesheet, not again on its own (the
        // drawer's dock structure, #82, is a block of its own).
        expect(compiled.indexCss.split(tableStackCss(basic.tokens.breakpoints!)).length - 1).toBe(1);
    });

    it('straight into the index when the skin styles no table', () => {
        const compiled = compileDesignSystem({ ...basic, recipes: basic.recipes.filter((r) => r.component !== 'table') }, manifest);
        expect(compiled.componentCss.table).toBeUndefined();
        expect(compiled.indexCss).toContain(tableStackCss(basic.tokens.breakpoints!));
    });

    it('only while the manifest table declares the attribute', () => {
        const without = {
            components: manifest.components.map((c) => (c.scope !== 'table' ? c : {
                ...c, parts: c.parts.map((p) => (p.name === 'root' ? { ...p, layout: undefined } : p)),
            })),
        };
        expect(compileDesignSystem(basic, without).indexCss).not.toContain(tableStackCss(basic.tokens.breakpoints!));
    });

    it("is not graded as the skin's spacing — the clip's -1px margin is zero's", () => {
        const result = auditDesignSystem(basic, manifest, { rules: ['spacing/off-ramp'] });
        expect(result.findings.filter((f) => f.scope === 'table')).toEqual([]);
    });
});

describe('tableStackAt — the chrome', () => {
    const at = tableStackAt({ breakpoints }, 'row', { padding: '1rem' });

    it('is one below-<breakpoint> condition per declared breakpoint', () => {
        expect(Object.keys(at)).toEqual(['below-sm', 'below-md']);
    });

    it("keeps the part's own specificity: the chain is inside :where()", () => {
        expect(at['below-md']).toEqual({
            selectors: {
                [`:where(${ROOT_MD} > [data-scope="table"][data-part="table"] > [data-scope="table"]) > &`]: { padding: '1rem' },
            },
        });
        expect(Object.keys(tableStackAt({ breakpoints }, 'root', {})['below-md']!.selectors!)).toEqual(['&[data-l-stack="md"]']);
    });

    it('compiles to the range the geometry uses', () => {
        const recipe: RecipeInput = { component: 'table', parts: { row: { at } } };
        const css = compileRecipeCss(recipe, table, { breakpoints });
        expect(css).toContain('@media (width < 48rem) {');
        expect(css).toContain(`:where(${ROOT_MD} > [data-scope="table"][data-part="table"] > [data-scope="table"]) > [data-scope="table"][data-part="row"] {`);
    });

    it('is nothing without breakpoints', () => {
        expect(tableStackAt({}, 'cell', { padding: '0' })).toEqual({});
    });

    it('is dropped and reported on lynx, like every condition', () => {
        const report = emptyReport();
        compileLynxRecipeCss({ component: 'table', parts: { row: { base: { padding: '0' }, at } } }, table, report);
        expect(report.dropped.filter((d) => d.what.startsWith('at["below-')).map((d) => d.what)).toEqual(['at["below-sm"]', 'at["below-md"]']);
    });
});
