/**
 * Design-system-level custom token values (#424): `system.custom` gives a
 * declared `tokens.custom` token its value once, emitted under the root, and
 * a theme may override it in its own `custom`. zero-material's M3 state-layer
 * opacities are the first user.
 */
import { describe, it, expect } from 'vitest';
import {
    compileTokensCss,
    defineTokens,
    themeEnvironments,
    validateDesignSystem,
} from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent, TokensInput } from '@sigx/zero-kit';
import { compileLynxTokensCss } from '../src/targets/lynx/index.js';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem as materialDS } from '@sigx/zero-material';

const colors = {
    'base-100': 'oklch(100% 0 0)',
    'base-200': 'oklch(96% 0 0)',
    'base-300': 'oklch(92% 0 0)',
    'base-content': 'oklch(20% 0 0)',
    primary: 'oklch(50% 0.2 260)',
    'primary-content': 'oklch(98% 0.01 260)',
} as const;
const darkColors = {
    'base-100': 'oklch(20% 0 0)',
    'base-200': 'oklch(24% 0 0)',
    'base-300': 'oklch(28% 0 0)',
    'base-content': 'oklch(96% 0 0)',
    primary: 'oklch(70% 0.15 260)',
    'primary-content': 'oklch(20% 0.01 260)',
} as const;
const roles = { primary: {} } as const;

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

const custom = {
    'state-hover': { description: 'hover layer', syntax: '<number>' },
    'glow': { description: 'a glow ink' },
} as const;

/** Two themes: `l` takes the design-system values, `d` overrides one. */
const tokens = (): TokensInput => defineTokens({
    roles,
    custom,
    system: { custom: { 'state-hover': 0.08, '--glow': 'oklch(70% 0.2 140)' } },
    defaultLight: 'l',
    defaultDark: 'd',
    themes: {
        l: { colorScheme: 'light', colors },
        d: { colorScheme: 'dark', colors: darkColors, custom: { glow: 'oklch(80% 0.2 140)' } },
        e: { colorScheme: 'light', colors },
    },
}) as TokensInput;

const ds = (t: Partial<DesignSystemInput['tokens']>): DesignSystemInput => ({
    name: 'probe',
    recipes: [],
    tokens: { ...tokens(), ...t } as DesignSystemInput['tokens'],
});
const messages = (input: DesignSystemInput) =>
    validateDesignSystem(input, manifest).errors.map((e) => `${e.where}: ${e.message}`);

function blockOf(css: string, selector: string): string {
    const start = css.indexOf(`${selector} {`);
    expect(start, `selector ${selector} not found`).toBeGreaterThan(-1);
    return css.slice(start, css.indexOf('\n    }', start));
}

describe('system.custom on the web', () => {
    const css = compileTokensCss(tokens());

    it('emits each value once under :root', () => {
        const root = blockOf(css, ':where(:root)');
        expect(root).toContain('--state-hover: 0.08;');
        expect(root).toContain('--glow: oklch(70% 0.2 140);');
        // A theme that does not override it inherits the root value.
        expect(blockOf(css, '[data-theme="e"]')).not.toContain('--state-hover');
    });

    it('lets a theme override one in its own custom', () => {
        expect(blockOf(css, '[data-theme="d"]')).toContain('--glow: oklch(80% 0.2 140);');
        expect(blockOf(css, '[data-theme="d"]')).not.toContain('--state-hover');
        // The dark default differs, so system dark states it and the light
        // theme restates its own value.
        const media = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
        expect(media).toContain('--glow: oklch(80% 0.2 140);');
        expect(blockOf(css, '[data-theme="l"]')).toContain('--glow: oklch(70% 0.2 140);');
    });

    it('registers a typed token with the design-system value as its initial value', () => {
        expect(css).toContain("@property --state-hover { syntax: '<number>'; inherits: true; initial-value: 0.08; }");
    });

    it('takes the light theme\'s own value for the registration when it overrides one', () => {
        const t = tokens();
        (t.themes['l'] as { custom?: Record<string, string> }).custom = { 'state-hover': '0.1' };
        expect(compileTokensCss(t)).toContain('initial-value: 0.1;');
    });
});

describe('system.custom on lynx and in the contrast audit', () => {
    it('resolves into every lynx theme block, the override winning', () => {
        const report = { translated: [], dropped: [] };
        const css = compileLynxTokensCss(tokens(), report);
        expect(blockOf(css, '.zx-root.zx-theme-l')).toContain('--state-hover: 0.08;');
        expect(blockOf(css, '.zx-root.zx-theme-d')).toContain('--state-hover: 0.08;');
        // Lynx bakes colours to hex: the override and the base value differ.
        const glow = (theme: string) => /--glow: (#[0-9a-f]+);/.exec(blockOf(css, `.zx-root.zx-theme-${theme}`))?.[1];
        expect(glow('e')).toBe(glow('l'));
        expect(glow('d')).toBeDefined();
        expect(glow('d')).not.toBe(glow('l'));
    });

    it('reaches the audit\'s theme environments', () => {
        const envs = Object.fromEntries(themeEnvironments(ds({})).map((e) => [e.name, e.props]));
        expect(envs['l']!['--state-hover']).toBe('0.08');
        expect(envs['d']!['--glow']).toBe('oklch(80% 0.2 140)');
        expect(envs['e']!['--glow']).toBe('oklch(70% 0.2 140)');
    });
});

describe('validating system.custom', () => {
    it('accepts a theme that omits a token the design system values', () => {
        expect(messages(ds({}))).toEqual([]);
    });

    it('still requires a value for a token with none at either tier', () => {
        const input = ds({ system: { custom: { 'state-hover': 0.08 } } });
        expect(messages(input)).toEqual(expect.arrayContaining([
            expect.stringMatching(/^themes\.l: missing value for declared custom token "glow"/),
            expect.stringMatching(/^themes\.e: missing value for declared custom token "glow"/),
        ]));
        expect(messages(input).some((m) => m.startsWith('themes.d: missing'))).toBe(false);
    });

    it('refuses an undeclared name, a non-scalar value and a break-out', () => {
        const errors = messages(ds({
            system: { custom: { 'state-hover': 0.08, glow: 'red', nope: '1', } },
        }));
        expect(errors).toContainEqual('tokens.system.custom: custom token "nope" is not declared in tokens.custom');
        expect(messages(ds({ system: { custom: { 'state-hover': { a: 1 }, glow: 'red' } } as never })))
            .toContainEqual('tokens.system.custom: "state-hover": must be a string or a number, got object');
        expect(messages(ds({ system: { custom: { 'state-hover': '1; color: red', glow: 'red' } } })))
            .toEqual(expect.arrayContaining([expect.stringMatching(/^tokens\.system\.custom: "state-hover": the value /)]));
        expect(messages(ds({ system: { custom: ['x'] } as never })))
            .toContainEqual('tokens.system.custom: must be an object of custom token name → value, got an array');
    });

    it('refuses custom in systemDark and in a theme\'s system — the override is the theme\'s own custom', () => {
        expect(messages(ds({ systemDark: { custom: { glow: 'red' } } as never }))).toContainEqual(
            expect.stringMatching(/^tokens\.systemDark\.custom: sets custom token values, which are declared once in tokens\.system\.custom/),
        );
        const t = tokens();
        (t.themes['e'] as { system?: unknown }).system = { custom: { glow: 'red' } };
        expect(messages(ds({ themes: t.themes }))).toContainEqual(
            expect.stringMatching(/^themes\.e\.system\.custom: sets custom token values/),
        );
    });

    it('resolves a var() reference inside a design-system value', () => {
        const errors = messages(ds({ system: { custom: { 'state-hover': 0.08, glow: 'var(--color-primray)' } } }));
        expect(errors).toEqual(expect.arrayContaining([
            expect.stringMatching(/^tokens\.system\.custom: references "--color-primray"/),
        ]));
    });

    it('measures a contrast pair against the design-system value', () => {
        const input = ds({
            system: { custom: { 'state-hover': 0.08, glow: 'oklch(99% 0 0)' } },
            themes: {
                l: { colorScheme: 'light', colors },
                d: { colorScheme: 'dark', colors: darkColors, custom: { glow: 'oklch(99% 0 0)' } },
            },
            contrast: [{ fg: 'glow', bg: 'base-100', min: 3 }],
        });
        expect(messages(input)).toContainEqual(expect.stringMatching(/^themes\.l: contrast base-100 vs glow is 1\.\d+:1/));
    });

    it('warns at tokens.system.custom when the value cannot be an initial value', () => {
        const input = ds({ system: { custom: { 'state-hover': 'var(--x, 0.1)', glow: 'red' } } });
        const warnings = validateDesignSystem(input, manifest).warnings.map((w) => `${w.where}: ${w.message}`);
        expect(warnings).toContainEqual(expect.stringMatching(/^tokens\.system\.custom: custom token "state-hover" has the light value/));
    });
});

describe('zero-material', () => {
    it('declares its state layers once, in system.custom, and no theme restates them', () => {
        const system = materialDS.tokens.system as { custom?: Record<string, unknown> };
        expect(Object.keys(system.custom ?? {})).toEqual([
            'state-hover', 'state-focus', 'state-pressed', 'state-dragged', 'state-disabled-container',
        ]);
        for (const [name, theme] of Object.entries(materialDS.tokens.themes)) {
            for (const key of Object.keys(system.custom ?? {})) {
                expect(theme.custom?.[key], `${name} restates ${key}`).toBeUndefined();
            }
        }
        const css = compileTokensCss(materialDS.tokens as TokensInput);
        expect(blockOf(css, ':where(:root)')).toContain('--state-hover: 0.08;');
        expect(blockOf(css, '[data-theme="material-dark"]')).not.toContain('--state-hover');
    });
});
