/**
 * @sigx/zero-carbon runtime — theme metadata registration.
 *
 * The CSS is the design system (`@sigx/zero-carbon/css`); this module only
 * seeds the zero theme registry so `useTheme()`/`themeController()` know the
 * available themes, their schemes and pairs.
 */
import { registerThemes } from '@sigx/zero';
import { tokens } from './tokens.js';

export { custom, modifiers, roles, system, systemDark, tokens, variants } from './tokens.js';
export { button, recipes } from './recipes.js';
export { designSystem } from './design-system.js';

export function installThemes(): void {
    registerThemes(tokens);
}
