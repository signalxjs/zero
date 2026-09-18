/**
 * @sigx/zero-material runtime — theme metadata registration.
 *
 * The CSS is the design system (`@sigx/zero-material/css`); this module only
 * seeds the zero theme registry so `useTheme()`/`themeController()` know the
 * available themes, their schemes and pairs.
 */
import { registerThemes } from '@sigx/zero';
import { tokens } from './tokens.js';

export { roles, system, systemDark, tokens } from './tokens.js';
export { recipes } from './recipes.js';
export { designSystem } from './design-system.js';

/**
 * `registerThemes` reads the swatch off this design system's own declaration —
 * which matters here more than anywhere: Material's themes differ in their
 * tonal surfaces, not in `primary`/`neutral`, so `tokens.swatch` names
 * `surface-container` and a picker that ignored it would render every Material
 * theme identically.
 */
export function installThemes(): void {
    registerThemes(tokens);
}
