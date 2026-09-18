import type { DesignSystemInput } from '@sigx/zero-kit';
import { defineApi } from '@sigx/zero-kit/define';
import { modifiers, roles, system, tableModifiers, tokens, variants } from './tokens.js';
import { layoutCss, layoutRecipes } from '@sigx/zero-kit/define';
import { recipes } from './recipes.js';

/**
 * The daisy-native API (#332): the third api-declaring design system after
 * zero-heroui (#179) and zero-carbon (#183), and the first to combine an api
 * with the recommended orthogonal colour axis. daisy's own docs already say
 * `color` and `variant` — its CSS composes `btn-outline` WITH `btn-primary`,
 * which is why the old `@sigx/daisyui` fused ButtonVariant union was a
 * modeling artifact rather than the real shape — so no axis is renamed and
 * no value respelled: `variant: {}` is the explicit `exact` claim. What the
 * api adds is the modifier surface: the old library's boolean props
 * (`wide`, `block`, `square`, `circle`, `active`, `loading`) surface under
 * their own names on the generated `./components` module, so
 * `<Button wide loading variant="dash" color="primary">` is fully typed from
 * one import. None of the six collides with `RESERVED_PROPS_BY_SCOPE` — the
 * validator checks exactly that for every identity-named modifier.
 *
 * `defineApi` from `@sigx/zero-kit/define`, the node:-free authoring
 * subpath (#318): this module is in the package's RUNTIME graph (the barrel
 * re-exports `designSystem`), and the kit's BARREL is Node-only — but the
 * define surface is importable from a browser graph by contract, pinned by
 * zero-kit's `ds-runtime-imports.test.ts`. The two-argument form narrows
 * modifier names and any `values` keys against the declared vocabulary.
 */
const api = defineApi(
    { variants, modifiers: [...modifiers, ...tableModifiers] },
    {
        variant: {},
        modifiers: {
            wide: {},
            block: {},
            square: {},
            circle: {},
            active: {},
            loading: {},
            zebra: {},
            hover: {},
        },
    },
);

export const designSystem: DesignSystemInput<typeof roles, typeof system> = {
    name: 'daisyui',
    tokens,
    // The layout tier, generated from this design system's own spacing ramp
    // and breakpoints. Composed HERE rather than in `recipes.ts`, which
    // `@sigx/create-zero-ds` copies verbatim as a scaffold's frozen baseline.
    recipes: [...layoutRecipes(tokens), ...recipes],
    css: [layoutCss(tokens)],
    api,
};

export default designSystem;
