/**
 * `<role>-soft-content` (#421): the soft tint's own ink.
 *
 * Before it existed, everything painted on `-soft` — the kit's layout Box
 * included — used the role's key colour as ink, which only reads while the
 * tint stays a light wash of the role. Material's tonal fill is the role's
 * container, which goes dark in M3's medium- and high-contrast schemes, and
 * the key colour on it measured 1.55:1.
 *
 * The token is optional and defaults to the role, so a theme that never
 * sets it paints exactly what it painted before; the validator measures the
 * pair either way, since the default is the pair a reader sees.
 */
import { describe, it, expect } from 'vitest';
import {
    compileTokensCss,
    defineTokens,
    derivePalette,
    fitRecipesToVocabulary,
    validateDesignSystem,
} from '@sigx/zero-kit';
import type { ManifestComponent, RecipeInput, TokensInput } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem as materialDS } from '@sigx/zero-material';
import { compileLynxTokensCss, emptyReport } from '../src/targets/lynx/index.js';
import { tokenVocabulary } from '../src/resolve/vocabulary.js';

const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };

const base = {
    'base-100': '#ffffff',
    'base-200': '#f4f4f5',
    'base-300': '#e4e4e7',
    'base-content': '#18181b',
};

/** One role, one light theme — `extra` colours spread into it. */
const tokensWith = (extra: Record<string, string> = {}, dark?: Record<string, string>) => defineTokens({
    roles: { brand: {} },
    themes: {
        day: {
            colorScheme: 'light',
            softMix: 0.16,
            colors: { ...base, brand: '#1d4ed8', 'brand-content': '#ffffff', ...extra },
        },
        ...(dark
            ? {
                night: {
                    colorScheme: 'dark' as const,
                    colors: {
                        'base-100': '#18181b', 'base-200': '#27272a', 'base-300': '#3f3f46', 'base-content': '#fafafa',
                        brand: '#93c5fd', 'brand-content': '#0c0a09', ...dark,
                    },
                },
            }
            : {}),
    },
    defaultLight: 'day',
    ...(dark ? { defaultDark: 'night' } : {}),
});

const validate = (tokens: TokensInput) => validateDesignSystem({ name: 'x', tokens, recipes: [] }, manifest);

describe('<role>-soft-content — emission', () => {
    it('defaults to the role colour, by reference', () => {
        const css = compileTokensCss(tokensWith());
        expect(css).toContain('--color-brand-soft-content: var(--color-brand);');
    });

    it('emits an explicit value verbatim', () => {
        const css = compileTokensCss(tokensWith({ 'brand-soft-content': '#1e3a8a' }));
        expect(css).toContain('--color-brand-soft-content: #1e3a8a;');
        expect(css).not.toContain('--color-brand-soft-content: var(--color-brand);');
    });

    it('pairs each scheme\'s own side at :root, the default filling the unset one', () => {
        const css = compileTokensCss(tokensWith({ 'brand-soft-content': '#1e3a8a' }, {}));
        expect(css).toContain('--color-brand-soft-content: light-dark(#1e3a8a, var(--color-brand));');
    });

    it('is not emitted for a role that opts out of -soft', () => {
        const tokens = defineTokens({
            roles: { brand: {}, fill: { soft: false } },
            themes: { day: { colorScheme: 'light', colors: { ...base, brand: '#1d4ed8', 'brand-content': '#fff', fill: '#eee', 'fill-content': '#111' } } },
            defaultLight: 'day',
        });
        const css = compileTokensCss(tokens);
        expect(css).toContain('--color-brand-soft-content');
        expect(css).not.toContain('--color-fill-soft-content');
        expect(tokenVocabulary(tokens).names.has('--color-brand-soft-content')).toBe(true);
        expect(tokenVocabulary(tokens).names.has('--color-fill-soft-content')).toBe(false);
    });

    it('bakes to a literal on lynx — the role, or the explicit value', () => {
        expect(compileLynxTokensCss(tokensWith(), emptyReport())).toMatch(/--color-brand-soft-content: #1d4ed8;/);
        expect(compileLynxTokensCss(tokensWith({ 'brand-soft-content': '#1e3a8a' }), emptyReport()))
            .toMatch(/--color-brand-soft-content: #1e3a8a;/);
    });
});

describe('<role>-soft-content — validation', () => {
    it('is a declared colour token a theme may set', () => {
        const result = validate(tokensWith({ 'brand-soft-content': '#1e3a8a' }));
        expect(result.errors.filter((e) => e.message.includes('not in the declared vocabulary'))).toEqual([]);
    });

    it('measures the default pairing — the role on its own tint', () => {
        // A light yellow reads on nothing light; the Box painted exactly this.
        const result = validate(tokensWith({ brand: '#facc15', 'brand-content': '#000000' }));
        const soft = result.errors.find((e) => e.message.startsWith('contrast brand-soft vs brand-soft-content'));
        expect(soft?.message).toContain('brand-soft-content is unset, so it is brand');
        expect(soft?.suggest?.token).toBe('brand-soft-content');
    });

    it('is satisfied by an explicit ink, and the suggestion it gives clears the floor', () => {
        const failing = tokensWith({ brand: '#facc15', 'brand-content': '#000000' });
        const suggestion = validate(failing).errors
            .find((e) => e.message.startsWith('contrast brand-soft vs'))!.suggest!.value;
        // The suggestion is solved at AA to the printed precision; a lightness
        // point darker absorbs the 8-bit rounding of the derived tint.
        const darker = suggestion.replace(/oklch\(([\d.]+)%/, (_, l: string) => `oklch(${(Number(l) - 1).toFixed(1)}%`);
        const fixed = validate(tokensWith({ brand: '#facc15', 'brand-content': '#000000', 'brand-soft-content': darker }));
        expect(fixed.errors.concat(fixed.warnings).filter((i) => i.message.includes('brand-soft'))).toEqual([]);
    });

    it('refuses a role whose name would emit another role\'s soft ink', () => {
        const tokens = defineTokens({
            roles: { brand: {}, 'brand-soft': {} },
            themes: {
                day: {
                    colorScheme: 'light',
                    colors: { ...base, brand: '#1d4ed8', 'brand-content': '#fff', 'brand-soft': '#dbeafe', 'brand-soft-content': '#1e3a8a' },
                },
            },
            defaultLight: 'day',
        });
        expect(validate(tokens).errors.map((e) => e.message))
            .toContainEqual(expect.stringContaining('both emit --color-brand-soft-content'));
    });

    it('holds zero-material\'s tonal pairs in every contrast scheme', () => {
        // The finding: primary on its container was 1.55:1 in the
        // high-contrast schemes. The soft ink is on-*-container now.
        const result = validateDesignSystem(materialDS, manifest);
        expect(result.errors.filter((e) => e.rule === 'contrast-floor')).toEqual([]);
        for (const theme of Object.values(materialDS.tokens.themes)) {
            const colors = theme.colors as Record<string, string>;
            expect(colors['primary-soft-content']).toBe(colors['primary-container-content']);
        }
    });
});

describe('<role>-soft-content — the kit\'s consumers', () => {
    it('derivePalette emits it only where the role falls short on its tint', () => {
        const colors = derivePalette({ scheme: 'light', seeds: { primary: 260 } }) as Record<string, string>;
        // Amber at the preset lightness clears the ink floor, not a label.
        expect(colors['warning-soft-content']).toBeDefined();
        expect(colors['primary-soft-content']).toBeUndefined();
    });

    it('fits to base-content where a vocabulary lacks the role, like other ink', () => {
        const recipe: RecipeInput = {
            component: 'box',
            parts: { root: { base: { background: 'var(--color-ghost-soft)', color: 'var(--color-ghost-soft-content)' } } },
        };
        const [fitted] = fitRecipesToVocabulary([recipe], tokensWith());
        expect(fitted!.parts.root!.base).toEqual({
            background: 'var(--color-base-200)',
            color: 'var(--color-base-content)',
        });
    });
});
