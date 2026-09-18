import type { DesignSystemInput } from '@sigx/zero-kit';
import { defineApi } from '@sigx/zero-kit/define';
import { modifiers, roles, system, tokens, variants } from './tokens.js';
import { layoutCss, layoutRecipes } from '@sigx/zero-kit/define';
import { recipes } from './recipes.js';

/**
 * The vendor-named API (issue #183): Carbon's own prop spellings for the
 * `./components` module — and the first RUNTIME use of the api `values`
 * remap. `kind` is zero's `variant` renamed, with the two double-hyphen
 * members respelled at the prop boundary (`kind="danger--tertiary"` renders
 * `data-variant="danger-tertiary"`); `hasIconOnly`/`isExpressive` are
 * Carbon's names for the two modifiers. This declaration graduates the kit's
 * `conformance/carbon.ts` fixture into a shipped artifact — the matrix row
 * and the emitted module are the same object.
 *
 * `defineApi` from `@sigx/zero-kit/define`, the node:-free authoring
 * subpath (#318): this module is in the package's RUNTIME graph (the barrel
 * re-exports `designSystem`), and the kit's BARREL is Node-only — but the
 * define surface is importable from a browser graph by contract, pinned by
 * zero-kit's `ds-runtime-imports.test.ts`. The two-argument form narrows
 * `values` keys and modifier names against the declared vocabulary, the same
 * checking the previous `satisfies` reimplementation hand-rolled.
 */
const api = defineApi(
    { variants, modifiers },
    {
        variant: {
            as: 'kind',
            values: {
                'danger-tertiary': 'danger--tertiary',
                'danger-ghost': 'danger--ghost',
            },
        },
        modifiers: {
            'icon-only': { as: 'hasIconOnly' },
            expressive: { as: 'isExpressive' },
            zebra: { as: 'useZebraStyles' },
        },
    },
);

export const designSystem: DesignSystemInput<typeof roles, typeof system> = {
    name: 'carbon',
    tokens,
    // The layout tier, generated from this design system's own spacing ramp
    // and breakpoints. Composed HERE rather than in `recipes.ts`, which
    // `@sigx/create-zero-ds` copies verbatim as a scaffold's frozen baseline.
    recipes: [...layoutRecipes(tokens), ...recipes],
    css: [layoutCss(tokens)],
    api,
};

export default designSystem;
