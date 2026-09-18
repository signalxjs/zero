/**
 * The class grammar is a cross-package contract (the kit's lynx target
 * mirrors it, the lynx runtime emits it), so its shapes are pinned literally:
 * a change here is a grammar version bump, not a refactor.
 */
import { describe, expect, it } from 'vitest';
import {
    CLASS_GRAMMAR_VERSION,
    HOST_CLASS,
    axisClass,
    flagClass,
    layoutClass,
    modClass,
    orientationClass,
    partClass,
    placementClass,
    stateClass,
    themeClass,
} from '../src/contract/class-names.js';
import { FLAG_VOCABULARY, STATE_NAMES } from '../src/contract/data-attrs.js';
import { LAYOUT_VOCABULARY, layoutAttrSpec } from '../src/contract/layout-attrs.js';
import { anatomies } from '../src/anatomy.js';

describe('class grammar (version 2)', () => {
    it('pins the literal shapes', () => {
        expect(CLASS_GRAMMAR_VERSION).toBe(2);
        expect(HOST_CLASS).toBe('zx-root');
        expect(partClass('tabs', 'tab')).toBe('zx-tabs__tab');
        expect(stateClass('open')).toBe('zx-s-open');
        expect(flagClass('disabled')).toBe('zx-f-disabled');
        expect(axisClass('size', 'xs')).toBe('zx-a-size-xs');
        expect(modClass('block')).toBe('zx-m-block');
        expect(orientationClass('vertical')).toBe('zx-o-vertical');
        expect(placementClass('top-start')).toBe('zx-p-top-start');
        expect(layoutClass('gap', 'md')).toBe('zx-l-gap-md');
        expect(layoutClass('gap-x', '2xs')).toBe('zx-l-gap-x-2xs');
        expect(themeClass('dark')).toBe('zx-theme-dark');
    });

    it('every class is a single CSS-safe token for every real input', () => {
        // The grammar leans on its inputs being kebab-case; prove the
        // composed output stays one selector-safe class token across the
        // entire real vocabulary — every scope, part, state and flag zero
        // ships, not just the doc examples.
        const CSS_CLASS = /^[a-z][a-z0-9_-]*$/;
        for (const anatomy of Object.values(anatomies)) {
            for (const part of Object.keys(anatomy.parts)) {
                expect(partClass(anatomy.scope, part)).toMatch(CSS_CLASS);
            }
        }
        for (const state of STATE_NAMES) expect(stateClass(state)).toMatch(CSS_CLASS);
        for (const flag of FLAG_VOCABULARY) expect(flagClass(flag)).toMatch(CSS_CLASS);
        // The layout family is the one whose VALUES carry digits (`cols`,
        // `grow`, and the `2xs` rung), so it is the one that could produce a
        // class starting with a digit if an attribute name ever went away.
        for (const attr of Object.keys(LAYOUT_VOCABULARY) as Array<keyof typeof LAYOUT_VOCABULARY>) {
            for (const value of layoutAttrSpec(attr).values) expect(layoutClass(attr, value)).toMatch(CSS_CLASS);
        }
    });

    it('part classes never collide across the real anatomy registry', () => {
        const seen = new Map<string, string>();
        for (const anatomy of Object.values(anatomies)) {
            for (const part of Object.keys(anatomy.parts)) {
                const cls = partClass(anatomy.scope, part);
                const prior = seen.get(cls);
                expect(prior, `class "${cls}" collides: ${prior} vs ${anatomy.scope}/${part}`).toBeUndefined();
                seen.set(cls, `${anatomy.scope}/${part}`);
            }
        }
    });

    it('prefix families are disjoint from part classes', () => {
        // A part class always contains `__`; no prefix-family class ever
        // does. That is what keeps a scope named like a family prefix ("s",
        // "f") from ever producing an ambiguous compound.
        for (const anatomy of Object.values(anatomies)) {
            for (const part of Object.keys(anatomy.parts)) {
                expect(partClass(anatomy.scope, part)).toContain('__');
            }
        }
        for (const cls of [stateClass('open'), flagClass('disabled'), axisClass('size', 'xs'),
            modClass('block'), orientationClass('vertical'), placementClass('top'), themeClass('dark'),
            layoutClass('gap', 'md'), HOST_CLASS]) {
            expect(cls).not.toContain('__');
        }
    });
});
