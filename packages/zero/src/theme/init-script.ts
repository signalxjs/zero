/**
 * First-paint theme restoration.
 *
 * The system preference needs no script at all — compiled themes use
 * `light-dark()` + `color-scheme` on `:root`. This inline script only
 * restores a *persisted explicit* choice before first paint, so SSR/SSG
 * pages never flash the wrong theme. Inject the returned string into a
 * `<script>` in `<head>`.
 */
import { DEFAULT_STORAGE_KEY } from './theme-state.js';

export function themeInitScript(options: { storageKey?: string } = {}): string {
    const key = JSON.stringify(options.storageKey ?? DEFAULT_STORAGE_KEY);
    return `(function(){try{var t=localStorage.getItem(${key});if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
}
