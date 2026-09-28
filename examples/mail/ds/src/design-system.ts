import type { DesignSystemInput, RecipePatch } from '@sigx/zero-kit';
import { extendRecipe, layoutCss, layoutRecipes } from '@sigx/zero-kit/define';
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
/**
 * The page itself. Zero ships no document baseline (#440), so an app whose
 * root claims the viewport inherits the UA's 8px body margin and scrolls by
 * 16px. The design system owns the page's ground and type, so it says so.
 */
const documentCss = `@layer zero.fallback {
    html, body { margin: 0; block-size: 100%; }
    body {
        background: var(--color-base-200);
        color: var(--color-base-content);
        font-family: var(--font-sans);
        -webkit-font-smoothing: antialiased;
    }
}`;

/** Amendments to zero-kit's generated layout tier (tracked in #440). */
const LAYOUT_PATCHES: Record<string, RecipePatch> = {
    // Stack has no shrink/basis control, and a growing item with long
    // (truncated) text kept its content basis, squeezing its fixed siblings
    // — a timestamp beside a subject line. Growing from zero takes only what
    // is left.
    stack: { parts: { item: { selectors: { '&[data-l-grow="1"]': { flexBasis: '0' } } } } },
};

export const designSystem: DesignSystemInput<typeof roles> = {
    name: 'mail',
    tokens,
    recipes: [
        ...layoutRecipes(tokens).map((r) => (LAYOUT_PATCHES[r.component] ? extendRecipe(r, LAYOUT_PATCHES[r.component]!) : r)),
        ...recipes,
    ],
    css: [layoutCss(tokens), documentCss],
};

export default designSystem;
