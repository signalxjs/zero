/**
 * @sigx/zero-brutalist runtime — theme metadata registration.
 *
 * The CSS is the design system (`@sigx/zero-brutalist/css`); this module only
 * seeds the zero theme registry so `useTheme()`/`themeController()` know the
 * available themes, their schemes and pairs.
 */
import { registerThemes } from '@sigx/zero';
import { tokens } from './tokens.js';

export { roles, system, systemDark, tokens } from './tokens.js';
export { recipes } from './recipes.js';
export { designSystem } from './design-system.js';

export function installThemes(): void {
    registerThemes(tokens);
}
