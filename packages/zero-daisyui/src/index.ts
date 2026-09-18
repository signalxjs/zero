/**
 * @sigx/zero-daisyui runtime — theme metadata registration.
 * The CSS is the design system (`@sigx/zero-daisyui/css`).
 */
import { registerThemes } from '@sigx/zero';
import { tokens } from './tokens.js';

export { tokens } from './tokens.js';
export { recipes } from './recipes.js';
export { designSystem } from './design-system.js';

export function installThemes(): void {
    registerThemes(tokens);
}
