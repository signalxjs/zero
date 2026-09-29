/**
 * `documentCss` — the opt-in document baseline (#455): the page's margin,
 * ground and type from a design system's own tokens, naming nothing the
 * tokens do not emit.
 */
import { describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import { compileDesignSystem, documentCss } from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent, TokensInput } from '@sigx/zero-kit';
import { documentCss as fromDefine } from '@sigx/zero-kit/define';
import { designSystem as basicDS } from '@sigx/zero-basic';

const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };
const tokens = basicDS.tokens as TokensInput;

/** The rule whose WHOLE selector is `selector` — `body` is not `html,\nbody`. */
const rule = (css: string, selector: string): string => {
    const found = css.split(/(?<=\})\n/).find((block) => block.replace(/^\/\*[\s\S]*?\*\/\n/, '').startsWith(`${selector} {`));
    expect(found, selector).toBeDefined();
    return found!;
};

describe('documentCss', () => {
    it('is on the /define surface', () => {
        expect(fromDefine).toBe(documentCss);
    });

    it('zeroes the margin and gives html and body the full height', () => {
        const root = rule(documentCss(tokens), 'html,\nbody');
        expect(root).toContain('margin: 0;');
        expect(root).toContain('block-size: 100%;');
    });

    it('fullHeight: false keeps the margin and drops the block-size', () => {
        const css = documentCss(tokens, { fullHeight: false });
        expect(rule(css, 'html,\nbody')).toContain('margin: 0;');
        expect(css).not.toContain('block-size');
    });

    it('stands the body on base-100 by default, and on the ground it is given', () => {
        const body = rule(documentCss(tokens), 'body');
        expect(body).toContain('background: var(--color-base-100);');
        expect(body).toContain('color: var(--color-base-content);');
        expect(rule(documentCss(tokens, { ground: 'base-200' }), 'body')).toContain('background: var(--color-base-200);');
    });

    it('refuses a ground that is not a base surface', () => {
        expect(() => documentCss(tokens, { ground: 'base-content' as never })).toThrow(/ground must be one of/);
        expect(() => documentCss(tokens, { ground: 'primary' as never })).toThrow(/ground must be one of/);
    });

    it('sets the type only in a font the design system declares', () => {
        expect(tokens.system?.typography?.fonts?.sans).toBeDefined();
        expect(documentCss(tokens)).toContain('font-family: var(--font-sans);');

        const noFonts = { ...tokens, system: { ...tokens.system, typography: {} } } as TokensInput;
        expect(documentCss(noFonts)).not.toContain('font-family');
        expect(documentCss({})).not.toContain('font-family');

        const sansOnly = { ...tokens, system: { ...tokens.system, typography: { fonts: { sans: 'system-ui' } } } } as TokensInput;
        expect(documentCss(sansOnly, { font: 'serif' })).not.toContain('font-family');
        expect(documentCss(sansOnly, { font: 'sans' })).toContain('font-family: var(--font-sans);');
    });

    it('wraps no layer of its own, and compiles inside @layer zero.recipes', () => {
        const css = documentCss(tokens, { ground: 'base-200' });
        expect(css).not.toContain('@layer');
        const ds: DesignSystemInput = { name: 'doc', tokens, recipes: [], css: [css] };
        const { indexCss } = compileDesignSystem(ds, manifest);
        const layer = indexCss.indexOf('@layer zero.recipes {\n');
        expect(layer).toBeGreaterThanOrEqual(0);
        expect(indexCss.indexOf(css, layer)).toBeGreaterThan(layer);
    });

    it('names only custom properties the compiled tokens define', () => {
        const ds: DesignSystemInput = { name: 'doc', tokens, recipes: [], css: [] };
        const defined = new Set(compileDesignSystem(ds, manifest).tokens.properties);
        for (const ground of ['base-100', 'base-200', 'base-300'] as const) {
            const css = documentCss(tokens, { ground });
            const named = [...css.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]!);
            expect(named.length).toBeGreaterThan(0);
            for (const prop of named) expect(defined, prop).toContain(prop);
        }
    });
});
