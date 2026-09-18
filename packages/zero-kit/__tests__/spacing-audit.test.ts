/**
 * `spacing/*` — the ramp is the vocabulary, and a number is not.
 *
 * The rule exists for a mechanism, not for tidiness: because recipes
 * reference `var(--space-md)`, an app can redefine the ramp under a selector
 * and get a density mode for free. Every literal is inert under that switch,
 * so these cases are really about which spellings participate in it.
 *
 * The exemptions carry most of the design, and each is here because a naive
 * version of this rule gets it wrong: `em` is spacing that tracks type on
 * purpose, `calc(var(--space-lg) - 2px)` already rides the ramp, and `0`
 * needs no token.
 */
import { describe, expect, it } from 'vitest';
import { parseRules } from '@sigx/zero-kit';
import { spacingFindings, topLevelComponents } from '../src/audit/rules/spacing.js';

/** zero-basic's ramp, as every skin declares one. */
const ramp = new Map([
    ['0.125rem', '2xs'], ['0.25rem', 'xs'], ['0.375rem', 'sm'],
    ['0.5rem', 'md'], ['0.75rem', 'lg'], ['1rem', 'xl'], ['1.5rem', '2xl'],
]);

const findings = (css: string, index: ReadonlyMap<string, string> = ramp) =>
    spacingFindings('button', parseRules(`@layer zero.recipes {\n${css}\n}`), index);

const rule = (decls: string) => `[data-scope="button"][data-part="root"] { ${decls} }`;

describe('spacingFindings', () => {
    it('names the token a literal is standing in for', () => {
        const [finding, ...rest] = findings(rule('padding: 0.5rem;'));
        expect(rest).toEqual([]);
        expect(finding).toMatchObject({ rule: 'spacing/literal', severity: 'warning', scope: 'button', part: 'root' });
        expect(finding?.message).toContain('var(--space-md)');
    });

    it('calls a value on no step what it is', () => {
        const [finding] = findings(rule('padding: 0.875rem;'));
        expect(finding).toMatchObject({ rule: 'spacing/off-ramp', severity: 'error' });
        // The message lists the steps, so the fix does not require reading the
        // design system's tokens.ts to find out what was available.
        expect(finding?.message).toContain('0.75rem');
    });

    it('says nothing about a value already on the ramp', () => {
        expect(findings(rule('padding: var(--space-md);'))).toEqual([]);
    });

    it.each([
        ['type-relative spacing', 'gap: 0.5em;'],
        ['an adjustment inside calc', 'padding-inline-start: calc(var(--space-lg) - 2px);'],
        ['zero', 'margin: 0;'],
        ['zero with a unit', 'margin: 0px;'],
        ['a length that is not spacing', 'width: 0.875rem;'],
    ])('leaves %s alone', (_what, decls) => {
        expect(findings(rule(decls))).toEqual([]);
    });

    it('judges each component of a shorthand on its own', () => {
        // The trap a whole-value check falls into: one literal beside one
        // token is still a literal.
        const found = findings(rule('padding: 0.5rem var(--space-md);'));
        expect(found).toHaveLength(1);
        expect(found[0]).toMatchObject({ rule: 'spacing/literal' });

        const shorthand = findings(rule('padding: 0.5rem 0.875rem;'));
        expect(shorthand.map((f) => f.rule)).toEqual(['spacing/literal', 'spacing/off-ramp']);
    });

    it('covers the properties the category claims, and only those', () => {
        const spacing = findings(rule(
            'padding-inline: 0.875rem; margin-block-start: 0.875rem; row-gap: 0.875rem; gap: 0.875rem;',
        ));
        expect(spacing).toHaveLength(4);
        expect(findings(rule('inset: 0.875rem; border-width: 0.875rem;'))).toEqual([]);
    });

    it('stays silent for a design system that declares no ramp', () => {
        // Nothing to be off, so nothing to say.
        expect(findings(rule('padding: 0.875rem;'), new Map())).toEqual([]);
    });

    it('attributes to the scope when the selector names no part', () => {
        const [finding] = spacingFindings(
            'button',
            parseRules('@layer zero.recipes {\n[data-scope="button"] { padding: 0.875rem; }\n}'),
            ramp,
        );
        expect(finding?.where).toBe('button');
        expect(finding?.part).toBeUndefined();
    });
});

describe('topLevelComponents', () => {
    it('keeps a parenthesised expression whole', () => {
        expect(topLevelComponents('calc(var(--space-lg) - 2px)')).toEqual(['calc(var(--space-lg) - 2px)']);
        expect(topLevelComponents('0.5rem var(--space-md)')).toEqual(['0.5rem', 'var(--space-md)']);
        expect(topLevelComponents('clamp(1rem, 2vw, 3rem) 0.5rem'))
            .toEqual(['clamp(1rem, 2vw, 3rem)', '0.5rem']);
    });
});
