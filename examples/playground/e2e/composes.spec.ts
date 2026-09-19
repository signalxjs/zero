/**
 * `composes` in a real engine (#91): the two forms whose correctness is a
 * cascade claim no unit test can make.
 *
 * - **Borrowing** (`axes`): a nested button in a card footer looks like the
 *   design system's `sm` button, and an explicit `size` on the button wins
 *   over the borrowed one — the guard is `:not(:where([data-size]))` on the
 *   nested carrier. A nested scope whose size rules sit on a NON-carrier part
 *   (tabs: the rules style `tab`) is reached through its own donut, rooted on
 *   the guarded carrier.
 * - **Conditioned** (`compoundVariants[].composes`): the composition applies
 *   only while the host matches, the condition read on the host's carrier
 *   through an `@scope` donut — so a card nested in a matching card answers
 *   for its own subtree — and a conditioned borrow on a non-carrier part is
 *   an `@scope` inside an `@scope` whose inner prelude starts at `:scope`.
 *
 * The design system is zero-basic's compiled recipes with one card recipe
 * patched, compiled here through the kit (`compileDesignSystem`), so the CSS
 * under test is exactly what a build would emit. All three engines: `@scope`
 * and `:scope` in a nested prelude are exactly where engines could differ.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { compileDesignSystem } from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent } from '@sigx/zero-kit';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p: string): string => readFileSync(join(root, p), 'utf8');

async function stylesheet(): Promise<string> {
    const anatomy: { components: ManifestComponent[] } = JSON.parse(read('packages/zero/dist/manifest.json'));
    const url = pathToFileURL(join(root, 'packages/zero-basic/dist/design-system.js')).href;
    const { designSystem } = (await import(url)) as { designSystem: DesignSystemInput };
    const recipes = designSystem.recipes.map((recipe) => (recipe.component !== 'card' ? recipe : {
        ...recipe,
        composes: {
            // Unconditioned: every footer button borrows `sm`, and one
            // explicit style in the same entry rides beside it.
            button: { within: 'footer', axes: { size: 'sm' }, parts: { root: { base: { letterSpacing: '0.25em' } } } },
            // A non-carrier nested part: tabs' size rules style `tab`.
            tabs: { within: 'body', axes: { size: 'lg' } },
        },
        compoundVariants: [
            ...(recipe.compoundVariants ?? []),
            // Conditioned: an xs card shrinks its footer buttons and body tabs to xs.
            {
                match: { size: 'xs' },
                parts: {},
                composes: {
                    button: { within: 'footer', axes: { size: 'xs' } },
                    tabs: { within: 'body', axes: { size: 'xs' } },
                },
            },
        ],
    }));
    const compiled = compileDesignSystem({ ...designSystem, recipes }, anatomy);
    return `${read('packages/zero/css/base.css')}\n${compiled.indexCss}`;
}

const button = (size?: string): string =>
    `<button data-scope="button" data-part="root"${size ? ` data-size="${size}"` : ''}>Go</button>`;
const tabs = (): string =>
    '<div data-scope="tabs" data-part="root"><div data-scope="tabs" data-part="list">'
    + '<button data-scope="tabs" data-part="tab" data-state="active">One</button></div></div>';
const card = (attrs: string, footer: string, body = ''): string =>
    `<div data-scope="card" data-part="root"${attrs}><div data-scope="card" data-part="body">${body}</div>`
    + `<div data-scope="card" data-part="footer">${footer}</div></div>`;

/** Computed padding-inline-start, font-size and letter-spacing of every `sel` in `root`. */
async function metrics(page: Page, sel: string): Promise<Array<{ pad: string; font: string; tracking: string }>> {
    return page.locator(sel).evaluateAll((els) => els.map((el) => {
        const cs = getComputedStyle(el);
        return { pad: cs.paddingInlineStart, font: cs.fontSize, tracking: cs.letterSpacing };
    }));
}

/** The same element outside any card — what the nested recipe alone paints for `size`. */
async function bare(page: Page, markup: string, sel: string): Promise<{ pad: string; font: string }> {
    return page.evaluate(({ markup, sel }) => {
        const host = document.createElement('div');
        host.innerHTML = markup;
        document.body.append(host);
        const cs = getComputedStyle(host.querySelector(sel)!);
        const out = { pad: cs.paddingInlineStart, font: cs.fontSize };
        host.remove();
        return out;
    }, { markup, sel });
}

test.describe('composes borrows a nested scope\'s axis values (#91)', () => {
    let css = '';
    test.beforeAll(async () => { css = await stylesheet(); });

    test('borrowed in context, an explicit prop wins, and a condition on the host refines it', async ({ page }) => {
        await page.setContent(`<style>${css}</style>`
            + `<section id="plain">${card('', button() + button('lg'), tabs())}</section>`
            + `<section id="xs">${card(' data-size="xs"', button() + button('lg'), tabs())}</section>`
            + `<section id="nested">${card(' data-size="xs"', '', card('', button(), tabs()))}</section>`);

        const sm = await bare(page, button('sm'), '[data-part="root"]');
        const xs = await bare(page, button('xs'), '[data-part="root"]');
        const lg = await bare(page, button('lg'), '[data-part="root"]');
        const md = await bare(page, button(), '[data-part="root"]');
        const tabLg = await bare(page, tabs().replace('data-part="root"', 'data-part="root" data-size="lg"'), '[data-part="tab"]');
        const tabXs = await bare(page, tabs().replace('data-part="root"', 'data-part="root" data-size="xs"'), '[data-part="tab"]');
        // The control has to be able to fail: the steps must differ.
        expect(new Set([sm.pad, xs.pad, lg.pad, md.pad]).size).toBe(4);
        expect(tabLg.pad).not.toBe(tabXs.pad);

        const plain = await metrics(page, '#plain [data-scope="button"][data-part="root"]');
        expect(plain[0], 'a footer button with no size borrows the sm button').toMatchObject(sm);
        expect(plain[1], 'an explicit size on the instance wins over the borrowed one').toMatchObject(lg);
        expect(plain[0]!.tracking, 'the explicit in-context style rides beside the borrowed one').not.toBe('normal');
        const [plainTab] = await metrics(page, '#plain [data-scope="tabs"][data-part="tab"]');
        expect(plainTab, 'a borrowed value reaches a non-carrier part through the nested donut').toMatchObject(tabLg);

        const conditioned = await metrics(page, '#xs [data-scope="button"][data-part="root"]');
        expect(conditioned[0], 'an xs card shrinks its footer button to xs').toMatchObject(xs);
        expect(conditioned[1], 'the explicit size still wins under the condition').toMatchObject(lg);
        const [conditionedTab] = await metrics(page, '#xs [data-scope="tabs"][data-part="tab"]');
        expect(conditionedTab, 'a conditioned borrow reaches a non-carrier part (@scope inside @scope)').toMatchObject(tabXs);

        // A plain card inside an xs card answers for its own subtree: the
        // outer card's condition stops at the inner card's carrier.
        const [inner] = await metrics(page, '#nested [data-scope="button"][data-part="root"]');
        expect(inner, 'the outer card\'s condition does not reach a nested card\'s button').toMatchObject(sm);
        const [innerTab] = await metrics(page, '#nested [data-scope="tabs"][data-part="tab"]');
        expect(innerTab, 'nor a nested card\'s tabs').toMatchObject(tabLg);
    });
});
