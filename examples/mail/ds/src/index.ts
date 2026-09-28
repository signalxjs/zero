/**
 * The runtime half: the CSS is the design system (`<pkg>/css`); this module
 * seeds the zero theme registry so `useTheme()` / `themeController()` know
 * the available themes, their schemes and pairs.
 */
import { registerThemes } from '@sigx/zero';
import { tokens } from './tokens.js';

export { roles, tokens } from './tokens.js';
export { recipes } from './recipes.js';
export { designSystem } from './design-system.js';

export function installThemes(): void {
    registerThemes(tokens);
}
