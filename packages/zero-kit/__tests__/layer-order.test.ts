/**
 * Layer-order emission (#318). Compiled DS CSS writes into `@layer
 * zero.tokens` / `zero.recipes` but never DECLARED the layer order — it
 * relied on `@sigx/zero/css/base.css` being parsed first. Load the DS
 * stylesheet first and the first `@layer zero.tokens {` block establishes
 * `zero.tokens` before `zero.fallback` exists, so base.css's neutral
 * fallbacks land ABOVE the design system's tokens and override them.
 *
 * The fix: every compiled tokens.css and index.css opens with the same
 * `@layer` order statement base.css carries, from one shared constant — and
 * this suite pins the constant byte-equal to the statement in base.css, so
 * the two can never disagree about which layer beats which.
 *
 * Red-first: compiled CSS contained no layer-order statement at all before
 * the change.
 *
 * #180: the per-component files (`css/components/<scope>.css`, public as
 * `./css/*`) and `sigx zero:extend`'s add-on stylesheet are importable on
 * their own too. Each is a bare `@layer zero.recipes { … }`, so importing one
 * first created `zero.recipes` BEFORE the other layers — base.css's order
 * statement then appended fallback/tokens above it (recipes < fallback <
 * tokens < structure). Both now open with the same statement.
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import type { DesignSystemInput, ManifestComponent } from '@sigx/zero-kit';
import { LAYER_ORDER_STATEMENT, compileDesignSystem, compileTokensCss, writeArtifacts } from '@sigx/zero-kit';
import { extendedCss } from '../src/commands/extend.js';
import { designSystem as basicDS, tokens as basicTokens } from '@sigx/zero-basic';

const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };

/** The first at-rule in a stylesheet, ignoring comments and whitespace. */
function firstAtRule(css: string): string {
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    return /@[^;{]*[;{]/.exec(withoutComments)?.[0] ?? '';
}

describe('the shared layer-order statement', () => {
    it('is byte-equal to the statement in @sigx/zero css/base.css', () => {
        const base = readFileSync(
            resolve(import.meta.dirname, '../../zero/css/base.css'),
            'utf8',
        );
        const statement = base.split('\n').find((line) => /^@layer [^{]+;$/.test(line.trim()));
        expect(statement?.trim()).toBe(LAYER_ORDER_STATEMENT);
    });

    it('opens every compiled tokens.css, before any layer block', () => {
        const css = compileTokensCss(basicTokens);
        expect(firstAtRule(css)).toBe('@layer zero.fallback, zero.tokens, zero.recipes, zero.structure;');
    });

    it('opens the compiled index.css, so loading DS CSS before base.css cannot invert the layers', () => {
        const compiled = compileDesignSystem(basicDS as DesignSystemInput, manifest);
        expect(firstAtRule(compiled.indexCss)).toBe('@layer zero.fallback, zero.tokens, zero.recipes, zero.structure;');
        expect(firstAtRule(compiled.tokensCss)).toBe('@layer zero.fallback, zero.tokens, zero.recipes, zero.structure;');
    });

    it('opens every written css/components/<scope>.css file', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'zero-layer-order-'));
        try {
            await writeArtifacts(compileDesignSystem(basicDS as DesignSystemInput, manifest), dir);
            const files = readdirSync(join(dir, 'css/components')).filter((f) => f.endsWith('.css'));
            expect(files.length).toBeGreaterThan(0);
            for (const file of files) {
                const css = readFileSync(join(dir, 'css/components', file), 'utf8');
                expect(firstAtRule(css), file).toBe(LAYER_ORDER_STATEMENT);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('opens the zero:extend add-on stylesheet', () => {
        const compiled = compileDesignSystem(basicDS as DesignSystemInput, manifest);
        const css = extendedCss(compiled, ['button', 'dialog'], 'basic');
        expect(firstAtRule(css)).toBe(LAYER_ORDER_STATEMENT);
        // Once, not once per scope.
        expect(css.split(LAYER_ORDER_STATEMENT).length - 1).toBe(1);
    });
});
