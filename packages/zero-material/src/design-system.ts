import type { DesignSystemInput } from '@sigx/zero-kit';
import { defineApi, layoutCss, layoutRecipes } from '@sigx/zero-kit/define';
import { axes, modifiers, roles, system, tokens, variants } from './tokens.js';
import { recipes } from './recipes.js';

/**
 * The M3 component API (#415) for the `./components` module.
 *
 * `variant` carries M3's style names as they are (`filled`, `tonal`,
 * `elevated`, `outlined`, `text`), and `shape` its `round` / `square`
 * (both `exact`). Buttons and toggles also take M3 Expressive's size names:
 * `size="s"`, `"m"` and `"l"` render zero's `sm`, `md` and `lg` (`xs` and
 * `xl` are spelled the same in both). M3 ships icon buttons and FABs as
 * separate components; here they are `icon` and `fab` modifiers on one
 * Button (`reshaped`).
 *
 * `defineApi` comes from `@sigx/zero-kit/define`, the node:-free authoring
 * subpath: this module is in the package's runtime graph (the barrel
 * re-exports `designSystem`).
 */
const m3Sizes = { size: { values: { sm: 's', md: 'm', lg: 'l' } } } as const;

export const api = defineApi(
    { variants, modifiers, axes },
    {
        variant: {},
        axes: { shape: {} },
        modifiers: { icon: {}, fab: {}, zebra: {}, hover: {}, inline: {} },
        components: { button: m3Sizes, toggle: m3Sizes },
    },
);

export const designSystem: DesignSystemInput<typeof roles, typeof system> = {
    name: 'material',
    tokens,
    // The layout tier, generated from this design system's own spacing ramp
    // and breakpoints. Composed HERE rather than in `recipes.ts`, which
    // `@sigx/create-zero-ds` copies verbatim as a scaffold's frozen baseline.
    recipes: [...layoutRecipes(tokens), ...recipes],
    css: [layoutCss(tokens)],
    api,
};

export default designSystem;
