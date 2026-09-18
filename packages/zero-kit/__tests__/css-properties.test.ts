/**
 * The CSS property spell-check (#51).
 *
 * A misspelled declaration key is the one authoring mistake nothing else in
 * the pipeline can see: `paddding: 1rem` compiles, emits, and the browser
 * drops it silently. The rule reads a checked-in list generated from
 * @webref/css; the first block here keeps that list honest (regenerate in
 * memory, compare byte for byte), the second pins the rule's verdicts.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDesignSystem } from '@sigx/zero-kit';
import type { CssProps, DesignSystemInput, ManifestComponent, RecipeInput } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { CSS_PROPERTIES, CSS_PROPERTIES_SOURCE } from '../src/resolve/css-properties.js';
// @ts-expect-error -- untyped build script, imported for its pure helpers
import { collectCssProperties, renderCssProperties } from '../scripts/gen-css-properties.mjs';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

const colors = {
    'base-100': 'oklch(100% 0 0)',
    'base-200': 'oklch(96% 0 0)',
    'base-300': 'oklch(92% 0 0)',
    'base-content': 'oklch(20% 0 0)',
    primary: 'oklch(50% 0.2 260)',
    'primary-content': 'oklch(98% 0.01 260)',
};

const dsWith = (recipe: RecipeInput): DesignSystemInput => ({
    name: 'probe',
    recipes: [recipe],
    tokens: {
        roles: { primary: {} },
        defaultLight: 'l',
        themes: { l: { colorScheme: 'light', colors } },
    } as DesignSystemInput['tokens'],
});

const tabsWith = (base: CssProps): RecipeInput => ({
    component: 'tabs',
    parts: { tab: { base, states: { 'focus-visible': { outline: '1px solid' } } } },
});

const propertyIssues = (recipe: RecipeInput) => {
    const r = validateDesignSystem(dsWith(recipe), manifest);
    return [...r.errors, ...r.warnings].filter((i) => i.rule === 'css-property');
};

describe('the checked-in property list', () => {
    it('is exactly what @webref/css generates — a stale list is a failing test, not a trap', async () => {
        const data = await collectCssProperties();
        // vitest runs from the repo root; the generated file lives beside the rule.
        // A Windows checkout with autocrlf hands the file back with CRLF; the
        // comparison is about content, so both sides are read as LF.
        const lf = (s: string) => s.replace(/\r\n/g, '\n');
        const committed = readFileSync(resolve('packages/zero-kit/src/resolve/css-properties.ts'), 'utf8');
        expect(lf(committed)).toBe(lf(renderCssProperties(data)));
        expect(CSS_PROPERTIES_SOURCE).toBe(`@webref/css ${data.version}`);
    });

    it('carries the spellings the recipes lean on', () => {
        for (const name of ['all', 'padding-inline-start', 'inset-block-end', 'appearance', 'interpolate-size',
            'overlay', 'field-sizing', 'text-wrap', 'transition-behavior', 'content-visibility', '-webkit-appearance']) {
            expect(CSS_PROPERTIES.has(name), name).toBe(true);
        }
        expect(CSS_PROPERTIES.size).toBeGreaterThan(700);
    });
});

describe('the css-property rule', () => {
    it('errors on a near miss and names the property it meant', () => {
        const issues = propertyIssues(tabsWith({ paddding: '1rem' } as CssProps));
        expect(issues).toHaveLength(1);
        const [issue] = issues;
        expect(issue!.level).toBe('error');
        expect(issue!.message).toBe(
            '"paddding" is not a CSS property — did you mean "padding"? The browser drops the declaration silently',
        );
        expect(issue!.suggest).toEqual({ token: 'paddding', value: 'padding' });
        expect(issue!.where).toBe('recipes.tabs.parts.tab.base');
    });

    it('reads the authoring spelling and reports the kebab form', () => {
        const issues = propertyIssues(tabsWith({ borderRadus: '4px' } as CssProps));
        expect(issues.map((i) => i.level)).toEqual(['error']);
        expect(issues[0]!.message).toContain('"border-radus" is not a CSS property — did you mean "border-radius"?');
    });

    it('only warns when nothing is close — new CSS must pass, a typo must not render', () => {
        const issues = propertyIssues(tabsWith({ glorbification: 'none' } as CssProps));
        expect(issues.map((i) => i.level)).toEqual(['warning']);
        expect(issues[0]!.message).toBe(
            `"glorbification" is not a property this kit knows (${CSS_PROPERTIES_SOURCE}) — new CSS passes here, a typo does not render`,
        );
        expect(issues[0]!.suggest).toBeUndefined();
    });

    it('never questions a custom property or a vendor-prefixed hack', () => {
        expect(propertyIssues(tabsWith({
            '--tab-ink': 'red',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            MsOverflowStyle: 'none',
            '-ms-overflow-style': 'none',
            WebkitTapHighlightColor: 'transparent',
        } as CssProps))).toEqual([]);
    });

    it('names the vendor prefix that lost its hyphen — msOverflowStyle emits ms-overflow-style, which nothing reads', () => {
        const issues = propertyIssues(tabsWith({ msOverflowStyle: 'none', webkitAppearance: 'none' } as CssProps));
        expect(issues.map((i) => i.level)).toEqual(['error', 'error']);
        expect(issues[0]!.message).toBe(
            '"ms-overflow-style" is not a CSS property — a vendor prefix needs its leading hyphen: write "MsOverflowStyle" so it emits as "-ms-overflow-style". The browser drops the declaration silently',
        );
        expect(issues[0]!.suggest).toEqual({ token: 'ms-overflow-style', value: '-ms-overflow-style' });
        expect(issues[1]!.suggest).toEqual({ token: 'webkit-appearance', value: '-webkit-appearance' });
        // a kebab-authored key is told the literal spelling, not a capitalised hybrid
        const kebab = propertyIssues(tabsWith({ 'ms-overflow-style': 'none' } as CssProps));
        expect(kebab[0]!.message).toContain('write "-ms-overflow-style" so it emits as "-ms-overflow-style"');
    });

    it('reaches states, variants, conditions and keyframe-free nested styles', () => {
        const recipe: RecipeInput = {
            component: 'tabs',
            parts: {
                tab: {
                    base: { padding: '1rem' },
                    states: { 'focus-visible': { outlien: '1px solid' } as CssProps, active: { colr: 'red' } as CssProps },
                    at: { 'reduced-motion': { base: { transiton: 'none' } as CssProps } },
                },
            },
            variants: { size: { sm: { tab: { base: { fontSiz: '12px' } as CssProps } } } },
        };
        const issues = propertyIssues(recipe);
        expect(issues.map((i) => i.suggest!.value).sort()).toEqual(['color', 'font-size', 'outline', 'transition']);
    });

    it('reads declaration heads inside keyframes bodies', () => {
        const recipe: RecipeInput = {
            component: 'tabs',
            parts: { tab: { base: { padding: '1rem' }, states: { 'focus-visible': { outline: '1px solid' } } } },
            keyframes: { pulse: 'from { opacty: 0 } 50% { opacity: 1; trnsform: scale(1.1); --tab-ink: blue } to { opacity: 0 }' },
        };
        const issues = propertyIssues(recipe);
        expect(issues.map((i) => `${i.where} ${i.suggest?.value ?? '?'}`).sort()).toEqual([
            'recipes.tabs.keyframes.pulse opacity',
            'recipes.tabs.keyframes.pulse transform',
        ]);
    });

    it('leaves the raw css hatch alone — at-rule descriptors are not properties', () => {
        const recipe: RecipeInput = {
            component: 'tabs',
            parts: { tab: { base: { padding: '1rem' }, states: { 'focus-visible': { outline: '1px solid' } } } },
            css: [
                '@font-face { font-family: X; src: url(x.woff2); font-display: swap }',
                '@property --tab-ink { syntax: "<color>"; inherits: true; initial-value: red }',
                '@counter-style dots { system: cyclic; symbols: "•" }',
                // and a genuine typo the hatch is NOT asked about — the
                // author chose the hatch, so the author checks it.
                '[data-part="tab"]:hover { colr: red }',
            ].join(' '),
        };
        expect(propertyIssues(recipe)).toEqual([]);
    });

    it('never suggests for a short key — the SVG geometry properties are two edits from anything', () => {
        const issues = propertyIssues(tabsWith({ tpo: '0', xx: '1' } as CssProps));
        expect(issues.map((i) => i.level)).toEqual(['warning', 'warning']);
        expect(issues.every((i) => i.suggest === undefined)).toBe(true);
        // …while a four-letter typo of a real property still names it.
        expect(propertyIssues(tabsWith({ colr: 'red' } as CssProps))[0]!.suggest).toEqual({ token: 'colr', value: 'color' });
    });

    it('lets every real property through', () => {
        expect(propertyIssues(tabsWith({
            padding: '1rem', insetInlineStart: '0', interpolateSize: 'allow-keywords', textWrap: 'balance',
            fieldSizing: 'content', transitionBehavior: 'allow-discrete', all: 'unset',
        }))).toEqual([]);
    });
});
