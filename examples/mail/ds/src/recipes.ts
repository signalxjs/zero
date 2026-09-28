/**
 * The recipe list the design system compiles.
 *
 * `baseline.ts` is @sigx/zero-basic's 58 recipes, copied whole by the
 * scaffold and fitted to this vocabulary. `overrides.ts` replaces the
 * recipes the mail client leans on outright and patches others in place
 * (`extendRecipe`), and `mail.ts` styles the kit's own scopes.
 */
import type { RecipeInput } from '@sigx/zero-kit';
import { extendRecipe, fitRecipesToVocabulary } from '@sigx/zero-kit/define';
import { recipes as baseline } from './baseline.js';
import { button } from './button.js';
import { mailRecipes } from './mail.js';
import { overrides, patches } from './overrides.js';
import { tokens } from './tokens.js';

const authored: RecipeInput[] = [button, ...overrides, ...mailRecipes];
const replaced = new Set(authored.map((r) => r.component));

export const recipes: RecipeInput[] = [
    ...fitRecipesToVocabulary(baseline, tokens)
        .filter((recipe) => !replaced.has(recipe.component))
        .map((recipe) => (patches[recipe.component] ? extendRecipe(recipe, patches[recipe.component]!) : recipe)),
    ...authored,
];
