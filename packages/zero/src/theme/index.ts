// Theme engine — registry, headless controller, provider, first-paint script.
// Theme *data* (palettes, compiled CSS) lives in each design-system package.

export type { ThemeInfo, ThemeSource } from './registry.js';
export {
    registerTheme,
    registerThemes,
    clearThemes,
    getTheme,
    listThemes,
    pairOf,
    pickThemeFor,
} from './registry.js';

export type { ThemeController, ThemeControllerOptions } from './theme-state.js';
export {
    createThemeController,
    themeController,
    useTheme,
    DEFAULT_STORAGE_KEY,
} from './theme-state.js';

export { ThemeProvider, ThemeScope } from './ThemeProvider.js';
export type { ThemeProviderProps, ThemeScopeProps } from './ThemeProvider.js';

export { themeInitScript } from './init-script.js';
