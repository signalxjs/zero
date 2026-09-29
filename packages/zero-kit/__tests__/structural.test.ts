/**
 * Structural roles (#422): a design system names its own shape scale and
 * maps zero's structural roles onto it with `system.structural`. The token
 * hints, the structural fallbacks and the layout Box resolve through the map,
 * and the manifest records the resolved token.
 */
import { describe, it, expect } from 'vitest';
import {
    STRUCTURAL_ROLES,
    TOKEN_CATEGORIES,
    compileDesignSystem,
    compileTokensCss,
    defineTokens,
    layoutRecipes,
    resolveStructural,
    structuralToken,
    structuralTokenMap,
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

/** A shape scale named its own way, with the three radius roles mapped onto it. */
const mapped = {
    structural: { radius: { selector: 'small', field: 'small', box: 'medium' } },
    radius: { none: '0', small: '0.25rem', medium: '0.75rem' },
} as const;

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

const ds = (tokens: Partial<DesignSystemInput['tokens']>): DesignSystemInput => ({
    name: 'probe',
    recipes: [],
    tokens: {
        roles,
        defaultLight: 'l',
        themes: { l: { colorScheme: 'light', colors } },
        ...tokens,
    } as DesignSystemInput['tokens'],
});
const messages = (input: DesignSystemInput) =>
    validateDesignSystem(input, manifest).errors.map((e) => `${e.where}: ${e.message}`);

function blockOf(css: string, selector: string): string {
    const start = css.indexOf(`${selector} {`);
    expect(start, `selector ${selector} not found`).toBeGreaterThan(-1);
    return css.slice(start, css.indexOf('\n    }', start));
}

describe('the structural roles', () => {
    it('are exactly the recommended keys of their categories', () => {
        for (const [id, roleList] of Object.entries(STRUCTURAL_ROLES)) {
            expect(TOKEN_CATEGORIES.find((c) => c.id === id)!.recommended).toEqual(roleList);
        }
    });

    it('resolve to the recommended name when unmapped, and to the mapped key when mapped', () => {
        expect(resolveStructural(undefined).radius).toEqual({ selector: 'selector', field: 'field', box: 'box' });
        expect(resolveStructural(mapped).radius).toEqual({ selector: 'small', field: 'small', box: 'medium' });
        expect(resolveStructural(mapped).text['md']).toBe('md');
        expect(structuralToken(mapped, 'radius', 'box')).toBe('radius-medium');
        expect(structuralToken({}, 'radius', 'box')).toBe('radius-box');
    });

    it('flatten to recommended token → resolved token, identity entries included', () => {
        const map = structuralTokenMap(mapped);
        expect(map['radius-box']).toBe('radius-medium');
        expect(map['radius-selector']).toBe('radius-small');
        expect(map['text-md']).toBe('text-md');
        expect(Object.keys(map)).toHaveLength(STRUCTURAL_ROLES.radius.length + STRUCTURAL_ROLES.text.length);
    });
});

describe('emission', () => {
    it('emits a mapped role as an indirection to its key, and nothing for an unmapped system', () => {
        const css = compileTokensCss(defineTokens({
            roles, system: mapped, defaultLight: 'l',
            themes: { l: { colorScheme: 'light', colors } },
        }));
        const root = blockOf(css, ':where(:root)');
        expect(root).toContain('--radius-box: var(--radius-medium);');
        expect(root).toContain('--radius-selector: var(--radius-small);');
        expect(root).toContain('--radius-field: var(--radius-small);');

        const plain = compileTokensCss(defineTokens({
            roles, system: { radius: { box: '0.75rem' } }, defaultLight: 'l',
            themes: { l: { colorScheme: 'light', colors } },
        }));
        expect(blockOf(plain, ':where(:root)')).toContain('--radius-box: 0.75rem;');
        expect(plain).not.toContain('var(--radius-');
    });

    it('restates the role in a theme block that re-emits its key, so a nested theme is not stale', () => {
        // `var()` in a custom property substitutes where it is DECLARED: a
        // role declared only on :root would keep :root's key value inside a
        // [data-theme] scope that changed the key.
        const css = compileTokensCss(defineTokens({
            roles, system: mapped, defaultLight: 'l', defaultDark: 'd',
            themes: {
                l: { colorScheme: 'light', colors },
                d: { colorScheme: 'dark', colors: darkColors, system: { radius: { medium: '1rem' } } },
            },
        }));
        const dark = blockOf(css, '[data-theme="d"]');
        expect(dark).toContain('--radius-medium: 1rem;');
        expect(dark).toContain('--radius-box: var(--radius-medium);');
        expect(dark).not.toContain('--radius-field');
        // Scheme-divergent, so the light theme restates both too — and the
        // media block that redeclares the key on :root needs no alias.
        expect(blockOf(css, '[data-theme="l"]')).toContain('--radius-box: var(--radius-medium);');
    });

    it('maps a text role, and the fixed alias follows it', () => {
        const css = compileTokensCss(defineTokens({
            roles,
            system: {
                structural: { text: { md: 'body' } },
                typography: { sizes: { body: '1rem', xs: '0.75rem' } },
            },
            defaultLight: 'l', defaultDark: 'd',
            themes: {
                l: { colorScheme: 'light', colors },
                d: { colorScheme: 'dark', colors: darkColors, system: { typography: { sizes: { body: '1.125rem' } } } },
            },
        }));
        const root = blockOf(css, ':where(:root)');
        expect(root).toContain('--text-md: var(--text-body);');
        expect(root).toContain('--text-fixed-md: var(--text-md);');
        const dark = blockOf(css, '[data-theme="d"]');
        expect(dark).toContain('--text-md: var(--text-body);');
        expect(dark).toContain('--text-fixed-md: var(--text-md);');
    });

    it('materialises a mapped role as its key\'s literal on lynx', () => {
        const report = { translated: [], dropped: [] };
        const css = compileLynxTokensCss(defineTokens({
            roles, system: mapped, defaultLight: 'l',
            themes: { l: { colorScheme: 'light', colors } },
        }) as TokensInput, report);
        const theme = blockOf(css, '.zx-root.zx-theme-l');
        // 0.75rem at lynx's 16px/rem rewrite.
        expect(theme).toContain('--radius-box: 12px;');
        expect(theme).not.toContain('var(--radius');
    });

    it('points the layout Box at the mapped key', () => {
        const box = (system: object) => layoutRecipes(defineTokens({
            roles, system, defaultLight: 'l',
            themes: { l: { colorScheme: 'light', colors } },
        }) as TokensInput).find((r) => r.component === 'box')!;
        expect(box(mapped).parts!['root']!.base!['borderRadius']).toBe('var(--radius-medium)');
        expect(box({}).parts!['root']!.base!['borderRadius']).toBe('var(--radius-box)');
    });

    it('records the resolved tokens in the compiled manifest', () => {
        const compiled = compileDesignSystem(ds({ system: mapped }), manifest);
        expect(compiled.tokens.structural['radius-box']).toBe('radius-medium');
        expect(compiled.tokens.structural['text-md']).toBe('text-md');
        expect(compiled.tokens.properties).toContain('--radius-box');
    });
});

describe('validation', () => {
    it('accepts a map onto declared keys', () => {
        expect(messages(ds({ system: mapped }))).toEqual([]);
    });

    it('accepts a text role mapped onto a key a modular scale generates', () => {
        expect(messages(ds({
            system: { structural: { text: { md: 'base' } }, typography: { scale: { base: '1rem', ratio: 1.25, steps: ['sm', 'base', 'lg'] } } },
        } as never))).toEqual([]);
    });

    it('refuses a role mapped onto a key the category never declares', () => {
        expect(messages(ds({ system: { structural: { radius: { box: 'huge' } }, radius: { small: '0.25rem' } } as never })))
            .toContainEqual(expect.stringMatching(/structural\.radius\.box: .*"huge".*--radius-box would resolve to nothing/));
    });

    it('refuses a role both mapped away and declared under its own name', () => {
        expect(messages(ds({ system: { ...mapped, radius: { ...mapped.radius, box: '1rem' } } })))
            .toContainEqual(expect.stringMatching(/structural\.radius\.box: .*also declares "box"/));
    });

    it('refuses an unknown category, an unknown role and a non-key value', () => {
        const errors = messages(ds({
            system: { structural: { shadow: { md: 'x' }, radius: { card: 'small', box: 3 } }, radius: { small: '0.25rem' } },
        } as never));
        expect(errors).toContainEqual(expect.stringContaining('"shadow" has no structural roles'));
        expect(errors).toContainEqual(expect.stringContaining('"card" is not a structural radius role'));
        expect(errors).toContainEqual(expect.stringContaining('structural.radius.box: must name a key'));
    });

    it('refuses a remap anywhere but tokens.system', () => {
        const errors = messages(ds({
            system: mapped,
            systemDark: { structural: { radius: { box: 'small' } } },
            themes: { l: { colorScheme: 'light', colors, system: { structural: { radius: { box: 'small' } } } } },
        } as never));
        expect(errors).toContainEqual(expect.stringContaining('tokens.systemDark.structural: remaps the structural roles'));
        expect(errors).toContainEqual(expect.stringContaining('themes.l.system.structural: remaps the structural roles'));
    });
});

describe('zero-material', () => {
    const compiled = compileDesignSystem(materialDS, manifest);

    it('declares M3\'s corner scale by its own names only — no recommended-name aliases', () => {
        const radius = compiled.tokens.system['radius'] as Record<string, string>;
        for (const role of STRUCTURAL_ROLES.radius) expect(radius).not.toHaveProperty(role);
    });

    it('maps the radius roles onto M3 corners, and the manifest says so', () => {
        expect(compiled.tokens.structural).toMatchObject({
            'radius-selector': 'radius-extra-small',
            'radius-field': 'radius-extra-small',
            'radius-box': 'radius-medium',
        });
        expect(compiled.tokensCss).toContain('--radius-box: var(--radius-medium);');
    });
});
