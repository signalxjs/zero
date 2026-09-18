/**
 * `resolveRecipeForTarget` (#355): the per-target recipe sections. The load-
 * bearing claims: absent `targets` leaves both views identical to the shared
 * recipe (which is what keeps every existing web golden byte-stable), the
 * merge is per-declaration with override winning, arrays concatenate, and
 * the raw `css` hatch is asymmetric by design (shared+web concatenate for
 * web; only `targets.lynx.css` reaches the lynx view).
 */
import { describe, expect, it } from 'vitest';
import type { RecipeInput } from '../src/recipes.js';
import { resolveRecipeForTarget } from '../src/recipes.js';
import { anatomies } from '@sigx/zero/anatomy';
import type { ManifestComponent } from '@sigx/zero-kit';
import { compileRecipeCss } from '@sigx/zero-kit';

const button = anatomies.button.toJSON() as ManifestComponent;

describe('resolveRecipeForTarget', () => {
    it('absent targets: both views compile byte-identically to the shared recipe', () => {
        const recipe: RecipeInput = {
            component: 'button',
            tokens: { '--btn-pad': '1rem' },
            parts: { root: { base: { color: 'red' }, states: { disabled: { opacity: '0.5' } } } },
            variants: { size: { xs: { root: { base: { padding: '2px' } } } } },
            keyframes: { pulse: 'from { opacity: 1; } to { opacity: 0.5; }' },
        };
        const web = resolveRecipeForTarget(recipe, 'web');
        const lynx = resolveRecipeForTarget(recipe, 'lynx');
        expect(compileRecipeCss(web, button)).toBe(compileRecipeCss(recipe, button));
        expect(lynx.parts).toEqual(recipe.parts);
        expect(web).not.toHaveProperty('targets');
        expect(lynx).not.toHaveProperty('targets');
    });

    it('merges per declaration, override wins, and only the named target sees its section', () => {
        const recipe: RecipeInput = {
            component: 'button',
            parts: { root: { base: { color: 'red', padding: '4px' } } },
            targets: {
                web: { parts: { root: { base: { color: 'blue', outline: 'none' } } } },
                lynx: { parts: { root: { base: { color: 'green' } } } },
            },
        };
        const web = resolveRecipeForTarget(recipe, 'web');
        const lynx = resolveRecipeForTarget(recipe, 'lynx');
        expect(web.parts['root']!.base).toEqual({ color: 'blue', padding: '4px', outline: 'none' });
        expect(lynx.parts['root']!.base).toEqual({ color: 'green', padding: '4px' });
    });

    it('merges states/selectors/at per key and concatenates compoundVariants', () => {
        const recipe: RecipeInput = {
            component: 'button',
            parts: {
                root: {
                    states: { disabled: { opacity: '0.4' } },
                    at: { 'reduced-motion': { base: { transition: 'none' } } },
                },
            },
            compoundVariants: [{ match: { color: 'primary' }, parts: { root: { base: { border: '1px' } } } }],
            targets: {
                web: {
                    parts: {
                        root: {
                            states: { disabled: { cursor: 'not-allowed' }, hover: { color: 'blue' } },
                            at: { 'reduced-motion': { base: { animation: 'none' } } },
                        },
                    },
                    compoundVariants: [{ match: { size: 'xs' }, parts: { root: { base: { gap: '1px' } } } }],
                },
            },
        };
        const web = resolveRecipeForTarget(recipe, 'web');
        expect(web.parts['root']!.states).toEqual({
            disabled: { opacity: '0.4', cursor: 'not-allowed' },
            hover: { color: 'blue' },
        });
        expect(web.parts['root']!.at!['reduced-motion']).toEqual({
            base: { transition: 'none', animation: 'none' },
        });
        expect(web.compoundVariants).toHaveLength(2);
    });

    it('css: shared+web concatenate for web; only targets.lynx.css reaches lynx', () => {
        const recipe: RecipeInput = {
            component: 'button',
            parts: {},
            css: '/* web-spelled shared */',
            targets: {
                web: { css: '/* web extra */' },
                lynx: { css: '/* lynx-authored */' },
            },
        };
        expect(resolveRecipeForTarget(recipe, 'web').css).toBe('/* web-spelled shared */\n/* web extra */');
        expect(resolveRecipeForTarget(recipe, 'lynx').css).toBe('/* lynx-authored */');
        const noLynxCss: RecipeInput = { component: 'button', parts: {}, css: '/* shared */' };
        expect(resolveRecipeForTarget(noLynxCss, 'lynx').css).toBeUndefined();
    });

    it('unions skipStates and merges keyframes/tokens per key', () => {
        const recipe: RecipeInput = {
            component: 'button',
            parts: {},
            tokens: { '--a': '1' },
            keyframes: { spin: 'from {} to {}' },
            skipStates: { root: ['focus-visible'] },
            targets: {
                lynx: {
                    tokens: { '--a': '2', '--b': '3' },
                    keyframes: { fade: 'from {} to {}' },
                    skipStates: { root: ['pressed'], label: ['disabled'] },
                },
            },
        };
        const lynx = resolveRecipeForTarget(recipe, 'lynx');
        expect(lynx.tokens).toEqual({ '--a': '2', '--b': '3' });
        expect(Object.keys(lynx.keyframes!)).toEqual(['spin', 'fade']);
        expect(lynx.skipStates).toEqual({ root: ['focus-visible', 'pressed'], label: ['disabled'] });
    });
});
