/**
 * Axis VALUES are graded by their own grammar, not the token-key one (#198).
 *
 * A value only ever lands inside a quoted attribute selector
 * (`[data-variant="danger--tertiary"]`), a single-quoted literal union in
 * `register.d.ts`, and — on the lynx target — an UNESCAPED class selector
 * (`.zx-a-variant-danger--tertiary`). `AXIS_VALUE_PATTERN` admits what all
 * three carry verbatim: lowercase letters, digits and hyphens, repeated
 * hyphens included, which is Carbon's entire `kind` axis. It stops where the
 * class grammar stops: `%` and `.` would need CSS escaping in a class name,
 * so Radix's `105%` stays an `api.values` remap; quotes, backslashes and
 * whitespace stay out so every interpolation site stays escape-free.
 *
 * Axis, modifier and role NAMES keep `TOKEN_KEY_PATTERN` — they become
 * `data-<axis>`, `data-mod-<name>` and `--color-<role>`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import {
    AXIS_VALUE_PATTERN,
    TOKEN_KEY_PATTERN,
    buildDsManifest,
    buildReport,
    compileDesignSystem,
    compileRecipeCss,
    compileRegisterDts,
    validateDesignSystem,
} from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent, RecipeInput } from '@sigx/zero-kit';
import { compileLynxRecipeCss, emptyReport } from '../src/targets/lynx/index.js';

const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };
const button = anatomies.button.toJSON() as ManifestComponent;

const colors = {
    'base-100': 'oklch(100% 0 0)',
    'base-200': 'oklch(96% 0 0)',
    'base-300': 'oklch(92% 0 0)',
    'base-content': 'oklch(20% 0 0)',
};

/** A colourless design system (the Carbon shape) whose button wires one fused variant. */
const dsWith = (value: string, extra: Partial<DesignSystemInput['tokens']> = {}): DesignSystemInput => ({
    name: 'probe',
    tokens: {
        roles: {},
        variants: [value],
        defaultLight: 'l',
        themes: { l: { colorScheme: 'light', colors } },
        ...extra,
    } as DesignSystemInput['tokens'],
    recipes: [{
        component: 'button',
        parts: { root: { base: { padding: '0' }, states: { 'focus-visible': { outline: '1px solid' } } } },
        variants: { variant: { [value]: { root: { base: { color: 'var(--color-base-content)' } } } } },
    }],
});

const messages = (ds: DesignSystemInput) => validateDesignSystem(ds, manifest).errors.map((e) => e.message);

describe('AXIS_VALUE_PATTERN', () => {
    it('admits repeated hyphens and rejects what a class name cannot carry verbatim', () => {
        for (const ok of ['solid', 'danger--tertiary', 'danger---x', '2xl', 'x-1-2']) {
            expect(AXIS_VALUE_PATTERN.test(ok), ok).toBe(true);
        }
        for (const bad of ['105%', 'x.y', 'Not Kebab', 'a"b', 'a\\b', 'a b', '-lead', 'trail-', '', 'a]b', 'highContrast']) {
            expect(AXIS_VALUE_PATTERN.test(bad), bad).toBe(false);
        }
    });

    it('is strictly wider than the token-key grammar, never narrower', () => {
        for (const key of ['solid', '2xl', 'x-1-2', 'a']) {
            expect(TOKEN_KEY_PATTERN.test(key) && AXIS_VALUE_PATTERN.test(key), key).toBe(true);
        }
        expect(TOKEN_KEY_PATTERN.test('danger--tertiary')).toBe(false);
        expect(AXIS_VALUE_PATTERN.test('danger--tertiary')).toBe(true);
    });
});

describe('the validator', () => {
    it('accepts a Carbon spelling as a declared and wired variant value', () => {
        expect(messages(dsWith('danger--tertiary'))).toEqual([]);
    });

    it('accepts it in tokens.axes and tokens.scopes values too', () => {
        const ds = dsWith('danger--tertiary', {
            axes: { kind: ['danger--ghost'] },
            scopes: { button: { variants: ['danger--tertiary'], axes: { kind: ['danger--ghost'] } } },
        });
        expect(messages(ds)).toEqual([]);
    });

    it('rejects a value the lynx class grammar cannot carry, naming the reason', () => {
        for (const bad of ['105%', 'x.y']) {
            const errors = messages(dsWith(bad));
            expect(errors, bad).toContainEqual(expect.stringContaining(`"${bad}" is not a valid axis value`));
            expect(errors, bad).toContainEqual(expect.stringContaining('.zx-a-'));
        }
    });

    it('still rejects uppercase — data-* values are case-sensitive', () => {
        expect(messages(dsWith('Not Kebab'))).toContainEqual(expect.stringContaining('not a valid axis value'));
    });

    it('keeps the token-key grammar for names: modifiers, axes, per-scope modifiers', () => {
        const ds = dsWith('solid', {
            modifiers: ['icon--only'],
            axes: { 'kind--x': ['a'] },
            scopes: { button: { modifiers: ['icon--only'] } },
        });
        const issues = validateDesignSystem(ds, manifest).errors;
        expect(issues).toContainEqual(expect.objectContaining({
            where: 'tokens.modifiers',
            message: expect.stringContaining('"icon--only" is not a kebab-case identifier — it becomes the tail of data-mod-icon--only'),
        }));
        expect(issues).toContainEqual(expect.objectContaining({
            where: 'tokens.scopes.button.modifiers',
            message: expect.stringContaining('"icon--only" is not a kebab-case identifier'),
        }));
        expect(issues.map((i) => i.message)).toContainEqual(expect.stringContaining('"kind--x" is not a kebab-case identifier'));
    });

    it('keeps the empty-declaration error for a custom axis, and only there', () => {
        // `variants: []` is a claim — "no variant axis" (#200/#295), the
        // grammar `sizes: []` uses — so it is no longer "declared but empty".
        // A custom axis has no recommended default to decline and no named
        // prop to switch off, so `[]` there still says nothing an omission
        // doesn't.
        const noVariants = messages(dsWith('solid', { variants: [] }));
        expect(noVariants).not.toContainEqual(expect.stringContaining('declared but empty'));
        expect(noVariants).toContainEqual(expect.stringContaining('declares no variant axis (tokens.variants is empty)'));
        expect(validateDesignSystem(dsWith('solid', { axes: { density: [] } }), manifest).errors)
            .toContainEqual(expect.objectContaining({
                where: 'tokens.axes.density',
                message: expect.stringContaining('declared but empty'),
            }));
    });
});

describe('the compile guards', () => {
    const recipe = (value: string): RecipeInput => ({
        component: 'button',
        parts: { root: { base: { padding: '0' } } },
        variants: { variant: { [value]: { root: { base: { color: 'red' } } } } },
    });

    it('web: writes the value into the attribute selector verbatim', () => {
        expect(compileRecipeCss(recipe('danger--tertiary'), button)).toContain('[data-variant="danger--tertiary"]');
    });

    it('lynx: writes the value into the class compound verbatim', () => {
        const { css } = { css: compileLynxRecipeCss(recipe('danger--tertiary'), button, emptyReport()) };
        expect(css).toContain('.zx-a-variant-danger--tertiary');
    });

    it('both: still throw on anything that would escape the selector', () => {
        for (const bad of ['a"b', 'a]b', 'a b', 'a\\b', '105%', 'x.y']) {
            expect(() => compileRecipeCss(recipe(bad), button), bad).toThrow(/not a valid axis value/);
            expect(() => compileLynxRecipeCss(recipe(bad), button, emptyReport()), bad).toThrow(/not a valid axis value/);
        }
    });

    it('axis and modifier NAMES still take the token-key grammar', () => {
        expect(() => compileRecipeCss({
            component: 'button',
            parts: { root: { base: { padding: '0' } } },
            variants: { 'kind--x': { a: { root: { base: { color: 'red' } } } } },
        }, button)).toThrow(/axis "kind--x".*not a kebab-case identifier/);
        expect(() => compileRecipeCss({
            component: 'button',
            parts: { root: { base: { padding: '0' } } },
            modifiers: { 'icon--only': { root: { base: { color: 'red' } } } },
        }, button)).toThrow(/modifier "icon--only".*not a kebab-case identifier/);
    });
});

describe('the emitted artifacts', () => {
    const compiled = compileDesignSystem(dsWith('danger--tertiary'), manifest);

    it('register.d.ts carries the spelling in the literal union, single-quoted', () => {
        expect(compileRegisterDts(compiled)).toContain(`'danger--tertiary'`);
    });

    it('the DS manifest and the report validate against their schemas with it', () => {
        const loadSchema = (name: string): Record<string, unknown> =>
            JSON.parse(readFileSync(resolve(import.meta.dirname, `../schemas/${name}.schema.json`), 'utf8'));
        const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
        const json = (v: unknown) => JSON.parse(JSON.stringify(v));
        const validateManifest = ajv.compile(loadSchema('ds-manifest'));
        const validateReport = ajv.compile(loadSchema('report'));
        const validateTokens = ajv.compile(loadSchema('tokens'));
        const validateRecipe = ajv.compile(loadSchema('recipe'));

        const ds = dsWith('danger--tertiary', { axes: { kind: ['danger--ghost'] } });
        expect(validateTokens(json(ds.tokens)), JSON.stringify(validateTokens.errors)).toBe(true);
        expect(validateRecipe(json(ds.recipes[0])), JSON.stringify(validateRecipe.errors)).toBe(true);
        const compiledWithAxis = compileDesignSystem(ds, manifest);
        const dsManifest = json(buildDsManifest(compiledWithAxis));
        expect(validateManifest(dsManifest), JSON.stringify(validateManifest.errors)).toBe(true);
        const report = json(buildReport(compiledWithAxis, ds, manifest));
        expect(validateReport(report), JSON.stringify(validateReport.errors)).toBe(true);

        // …and the schemas still refuse what the validator refuses.
        expect(validateTokens(json({ ...ds.tokens, variants: ['a"b'] }))).toBe(false);
        expect(validateTokens(json({ ...ds.tokens, variants: ['105%'] }))).toBe(false);
        expect(validateTokens(json({ ...ds.tokens, modifiers: ['icon--only'] }))).toBe(false);
        expect(validateRecipe(json({
            ...ds.recipes[0],
            variants: { variant: { 'a"b': { root: { base: { color: 'red' } } } } },
        }))).toBe(false);
    });
});
