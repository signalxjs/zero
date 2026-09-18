/**
 * ThemeProvider — provides a `ThemeController` to the subtree.
 *
 * At the app root it manages `data-theme` on `<html>`; under SSR the
 * per-request instance keeps request state out of module globals (pass the
 * request's persisted theme via `theme`). For a *scoped* sub-tree theme, use
 * `ThemeScope` instead — custom properties inherit, so a nested
 * `data-theme` island costs nothing.
 */
import { component, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { createThemeController, useTheme } from './theme-state.js';
import type { ZeroThemeName } from '../contract/vocabulary.js';
import { DEFAULT_STORAGE_KEY } from './theme-state.js';

export type ThemeProviderProps =
    & Define.Prop<'theme', ZeroThemeName | null, false>
    & Define.Prop<'storageKey', string, false>
    & Define.Slot<'default'>;

export const ThemeProvider = component<ThemeProviderProps>(({ props, slots }) => {
    defineProvide(useTheme, () => createThemeController({
        storageKey: props.storageKey ?? DEFAULT_STORAGE_KEY,
        initial: props.theme,
    }));
    return () => <>{slots.default?.()}</>;
}, { name: 'ThemeProvider' });

export type ThemeScopeProps =
    & Define.Prop<'theme', ZeroThemeName, true>
    & Define.Prop<'class', string, false>
    & Define.Slot<'default'>;

/** A scoped theme island: everything inside uses `theme`'s tokens. */
export const ThemeScope = component<ThemeScopeProps>(({ props, slots }) => {
    return () => (
        <div data-theme={props.theme} class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'ThemeScope' });
