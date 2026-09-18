/**
 * The playground's entire router.
 *
 * Hash-based on purpose: `vite preview` and any static host serve it with no
 * SPA fallback, a deep link (`/#/dialog`) is copy-pasteable, back/forward come
 * free from `hashchange`, and Playwright's `page.goto('/#/combobox')` works
 * both cold (full load — the module reads `location.hash` at import) and warm
 * (same-document hash change). Zero has no router package and this does not
 * argue for one — it is playground plumbing, not framework.
 *
 * An unknown or empty hash resolves to the first registry page rather than a
 * blank screen: specs (and people) land on `/` and must always get a page
 * that boots cleanly.
 */
import { signal } from 'sigx';
import { pages } from './pages/registry';

/** The kitchen-sink route — every page's demos on one document (see pages/all.tsx). */
export const ALL_PAGE_ID = 'all';

const parse = (): string => {
    const id = location.hash.replace(/^#\/?/, '');
    if (id === ALL_PAGE_ID || pages.some((p) => p.id === id)) return id;
    return pages[0]!.id;
};

const state = signal({ page: parse() });
const onHashChange = (): void => {
    state.page = parse();
};
window.addEventListener('hashchange', onHashChange);
// Registered at module scope, so each Vite HMR re-execution would stack a
// fresh listener on top of the last one — remove the old one when this
// module version is disposed.
import.meta.hot?.dispose(() => {
    window.removeEventListener('hashchange', onHashChange);
});

/** Reactive when read inside a render closure. */
export const currentPage = (): string => state.page;

export const hrefFor = (id: string): string => `#/${id}`;
