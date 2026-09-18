import type { DesignSystemInput } from '@sigx/zero-kit';
import { roles, system, tokens } from './tokens.js';
import { layoutCss, layoutRecipes } from '@sigx/zero-kit/define';
import { recipes } from './recipes.js';

export const designSystem: DesignSystemInput<typeof roles, typeof system> = {
    name: 'brutalist',
    tokens,
    // The layout tier, generated from this design system's own spacing ramp
    // and breakpoints. Composed HERE rather than in `recipes.ts`, which
    // `@sigx/create-zero-ds` copies verbatim as a scaffold's frozen baseline.
    recipes: [...layoutRecipes(tokens), ...recipes],
    css: [layoutCss(tokens)],
};

export default designSystem;
