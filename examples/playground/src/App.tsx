/**
 * The shell: sidebar navigation, toolbar, and the routed outlet.
 *
 * The sidebar is plain anchors on purpose, not zero components: demo chrome
 * must never render a `data-*` axis attribute, because `ds-smoke.spec.ts`
 * sweeps EVERY element against the live design system's declared vocabulary.
 * Which page is active is stated with `aria-current="page"` — the same claim
 * to a screen reader as to the eye — and styled by the playground's own CSS.
 *
 * `Toast.Viewport` lives here rather than on the Toast page: the queue is
 * app-global, and a toast fired just before a navigation must survive it.
 */
import { component } from 'sigx';
import { Toast } from '@sigx/zero';
import { Toolbar } from './Toolbar';
import { ALL_PAGE_ID, currentPage, hrefFor } from './router';
import { categories, pages } from './pages/registry';
import { AllPages } from './pages/all';

export const App = component(() => {
    return () => {
        const active = currentPage();
        // `parse` only ever answers a registry id or ALL_PAGE_ID, so a miss
        // here IS the kitchen sink — no separate not-found state exists.
        const entry = pages.find((p) => p.id === active);

        return (
            <div class="shell">
                <aside class="shell-sidebar">
                    <a class="shell-masthead" href={hrefFor(pages[0]!.id)}>SignalX Zero playground</a>
                    <nav aria-label="Pages">
                        {categories.map((category) => (
                            <section>
                                <h2 class="shell-category">{category}</h2>
                                <ul>
                                    {pages.filter((p) => p.category === category).map((p) => (
                                        <li>
                                            <a
                                                href={hrefFor(p.id)}
                                                aria-current={p.id === active ? 'page' : undefined}
                                            >
                                                {p.title}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                        <h2 class="shell-category">Everything</h2>
                        <ul>
                            <li>
                                <a
                                    href={hrefFor(ALL_PAGE_ID)}
                                    aria-current={active === ALL_PAGE_ID ? 'page' : undefined}
                                >
                                    All demos
                                </a>
                            </li>
                        </ul>
                    </nav>
                </aside>

                <main class="shell-main">
                    <Toolbar />
                    <Toast.Viewport placement="bottom-end" />
                    {entry
                        ? (
                            <article>
                                <h1>{entry.title}</h1>
                                <entry.Demos />
                            </article>
                        )
                        : <AllPages />}
                </main>
            </div>
        );
    };
});
