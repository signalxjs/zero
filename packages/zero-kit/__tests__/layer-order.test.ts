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
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import type { DesignSystemInput, ManifestComponent } from '@sigx/zero-kit';
import { LAYER_ORDER_STATEMENT, compileDesignSystem, compileTokensCss } from '@sigx/zero-kit';
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
});
