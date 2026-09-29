import type { DesignSystemInput } from '@sigx/zero-kit';
import { documentCss, layoutCss, layoutRecipes } from '@sigx/zero-kit/define';
import { roles, tokens } from './tokens.js';
import { recipes } from './recipes.js';

/**
 * The layout tier (Stack, Spacer, …) is generated from the tokens above —
 * this design system's own spacing ramp and breakpoints — rather than
 * authored, because `gap="md"` has to mean the same rung in every design
 * system. You choose what `--space-md` IS; the pack decides nothing else.
 *
 * Composed here rather than in `recipes.ts` so it stays out of the frozen
 * baseline copy. Override any of it by adding your own recipe for the same
 * component AFTER the spread.
 */

export const designSystem: DesignSystemInput<typeof roles> = {
    name: 'mail',
    tokens,
    recipes: [
        ...layoutRecipes(tokens),
        ...recipes,
    ],
    // The page's margin, ground and type (#455): the mail client stands on
    // base-200 so its panes on base-100 read as raised.
    css: [layoutCss(tokens), documentCss(tokens, { ground: 'base-200' })],
};

export default designSystem;
