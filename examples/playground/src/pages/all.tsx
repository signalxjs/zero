/**
 * The kitchen-sink route (`#/all`): every registry page's demos on one
 * document, derived from the registry rather than hand-maintained.
 *
 * Load-bearing for the e2e suite, not just convenient: `ds-smoke.spec.ts`
 * sweeps the whole DOM per design system and pays for ONE page load per
 * engine × DS by documented design (its "COST" header), and
 * `press-feedback.spec.ts` needs every pressable part visible at once. A
 * per-component route can never satisfy either — this page is how the
 * single-page density the specs were written against survives the split
 * into pages.
 */
import { component } from 'sigx';
import { pages } from './registry';

export const AllPages = component(() => () => (
    <article>
        {pages.map((entry) => (
            <section>
                <h2>{entry.title}</h2>
                <entry.Demos />
            </section>
        ))}
    </article>
), { name: 'AllPages' });
