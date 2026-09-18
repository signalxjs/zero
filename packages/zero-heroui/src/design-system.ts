import type { DesignSystemInput } from '@sigx/zero-kit';
import { defineApi } from '@sigx/zero-kit/define';
import { modifiers, roles, system, tokens, variants } from './tokens.js';
import { layoutCss, layoutRecipes } from '@sigx/zero-kit/define';
import { recipes } from './recipes.js';

/**
 * The vendor-named API (issue #179): HeroUI's own prop spellings for the
 * `./components` module. The fused `variant` maps exactly (grade `exact`);
 * `isIconOnly`/`isPending` are HeroUI's names for the two modifiers (grade
 * `reshaped` — boolean prop → presence attribute). This declaration is the
 * graduation of the kit's `conformance/heroui.ts` fixture into a shipped
 * artifact — the matrix row and the emitted module are the same object.
 *
 * `defineApi` from `@sigx/zero-kit/define`, the node:-free authoring
 * subpath (#318): this module is in the package's RUNTIME graph (the barrel
 * re-exports `designSystem`, and the playground imports the barrel in the
 * browser), and the kit's BARREL is Node-only — but the define surface is
 * importable from a browser graph by contract, pinned by zero-kit's
 * `ds-runtime-imports.test.ts`. The two-argument form narrows modifier
 * names and any `values` keys against the declared vocabulary, the same
 * checking the previous `satisfies` reimplementation hand-rolled.
 */
const api = defineApi(
    { variants, modifiers },
    {
        variant: {},
        modifiers: {
            'icon-only': { as: 'isIconOnly' },
            pending: { as: 'isPending' },
            striped: { as: 'isStriped' },
        },
    },
);

export const designSystem: DesignSystemInput<typeof roles, typeof system> = {
    name: 'heroui',
    tokens,
    // The layout tier, generated from this design system's own spacing ramp
    // and breakpoints. Composed HERE rather than in `recipes.ts`, which
    // `@sigx/create-zero-ds` copies verbatim as a scaffold's frozen baseline.
    recipes: [...layoutRecipes(tokens), ...recipes],
    css: [layoutCss(tokens)],
    api,
};

export default designSystem;
