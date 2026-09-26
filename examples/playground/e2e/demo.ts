/**
 * Shared locating and measuring for the playground's interaction specs.
 *
 * ## The convention
 *
 * > An interaction spec locates a part through a **named root** — never
 * > through a page-wide `[data-scope][data-part]`, and never through a
 * > positional `.first()` / `.nth()` that reaches across demos.
 *
 * With one carve-out, which is identity rather than accident: positional
 * indexing *within a single demo's own ordered set* — tab 0, radio item 1, the
 * third star of one rating — is fine. That index means something. An index
 * into every instance on the page does not.
 *
 * The specs used to be coupled to "the playground renders exactly one of each
 * component". Nothing said so and nothing enforced it, and the first PR to add
 * a second Combobox took `combobox/input` to three elements and turned 21
 * tests red. `.first()` is the specific trap: it couples a test to incidental
 * document order, so it passes for the wrong reason and breaks for an
 * unrelated one. This repo has paid for that twice — once on a long
 * investigation into a `button/root` that silently changed which button it
 * resolved to, and once on a `checkbox/label.first()` that reached a control on
 * the tab the test had just navigated away from and then waited the full 30 s
 * for a hidden element to become clickable.
 *
 * So name the instance instead, by something the demo owns:
 * - `demoLabelled` — the text a reader can see on it.
 * - `demoPosting` — the field name it posts.
 * - `controlledPopup` — for a component whose surface is a sibling rather than
 *   a descendant (Menu renders no root element), the `aria-controls` id that
 *   ties one trigger to one popup.
 *
 * Any of those survives a reshuffle. Document order does not.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { DESIGN_SYSTEM_LIST, type DesignSystemId } from '../src/design-system-list';

export { DESIGN_SYSTEM_LIST, type DesignSystemId };

/**
 * Every design system the playground's toolbar offers, by id — the list a
 * per-design-system spec iterates. Derived from the same module
 * `src/design-systems.ts` builds the toolbar from, so a new skin is covered
 * the moment it is registered; never retype it in a spec (`ds-smoke`
 * fails a spec that does, and fails when the toolbar and this list disagree).
 * A per-spec SUBSET (the skins whose drawer slides, …) stays that spec's own
 * data.
 */
export const DESIGN_SYSTEMS: readonly DesignSystemId[] = DESIGN_SYSTEM_LIST.map((ds) => ds.id);

/** Every `scope` part inside `root`, as a `(part) => Locator`. */
export const partsOf = (root: Locator, scope: string) =>
    (name: string): Locator => root.locator(`[data-scope="${scope}"][data-part="${name}"]`);

const roots = (page: Page, scope: string): Locator =>
    page.locator(`[data-scope="${scope}"][data-part="root"]`);

/** The one `scope` root whose own text reads `text`. */
export const rootLabelled = (page: Page, scope: string, text: string): Locator =>
    roots(page, scope).filter({ hasText: text });

/**
 * The one `scope` root that posts the field `name` — through whichever of
 * its parts carries the name: a hidden control, or the visible native
 * element itself (Input's `input`).
 */
export const rootPosting = (page: Page, scope: string, name: string): Locator =>
    roots(page, scope).filter({
        has: page.locator(`[data-scope="${scope}"][name="${name}"]`),
    });

/** The parts of the one `scope` instance whose root reads `text`. */
export const demoLabelled = (page: Page, scope: string, text: string) =>
    partsOf(rootLabelled(page, scope, text), scope);

/** The parts of the one `scope` instance that posts the field `name`. */
export const demoPosting = (page: Page, scope: string, name: string) =>
    partsOf(rootPosting(page, scope, name), scope);

/**
 * The surface `control` owns, resolved through its `aria-controls`.
 *
 * For Menu there is no root element to hang a demo root off — `Menu.Root`
 * renders nothing, and the popup is a *sibling* of the trigger — so the id the
 * runtime already publishes is the only non-positional link between one
 * trigger and one popup. The playground holds several menus; this is what
 * tells them apart.
 */
export async function controlledPopup(page: Page, control: Locator, what = 'control'): Promise<Locator> {
    const id = await control.getAttribute('aria-controls');
    expect(id, `${what}: no aria-controls, so its popup cannot be identified`).toBeTruthy();
    return page.locator(`#${id}`);
}

/**
 * The element's box once its animations have landed — or a failure that says
 * why there was no box.
 *
 * Two hazards, both of which have cost real time here:
 *
 * 1. A transition that translates the element. Measuring mid-flight reads a
 *    coordinate the element is only passing through, so wait for
 *    `getAnimations()` to settle first.
 * 2. `boundingBox()` returns **null** for anything not rendered — a closed
 *    `popover`, a `hidden` part, a detached node. Dereferencing that null is
 *    `TypeError: Cannot read properties of null (reading 'x')`, which reads as
 *    a broken test rather than as "the popup was not showing". That is exactly
 *    how #196 presented, and why it sat unexplained through several sweeps.
 *
 * The visibility assertion is a precondition, not politeness: it still FAILS
 * when the element genuinely is not visible. It just fails with a sentence.
 * The null check after it is not redundant — the element can stop being
 * rendered between the check and the measurement, which is precisely the
 * contended-runner case — and it names that race instead of throwing.
 */
export async function settledBox(loc: Locator, what = 'element'): Promise<
    { x: number; y: number; width: number; height: number }
> {
    await expect(loc, `${what}: not visible, so it has no box to measure`).toBeVisible();
    await loc.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {}))));
    const box = await loc.boundingBox();
    expect(
        box,
        `${what}: visible, but boundingBox() was null — it stopped being rendered before it could be measured`,
    ).not.toBeNull();
    return box!;
}

/**
 * An anchored popup, its arrow and the element it points at, measured in ONE
 * read once all three have settled (#279), plus the placement the strategy
 * resolved at that moment. One read, because the strategy re-positions on
 * every scroll: focus moving into a menu can scroll the page, flip the popup,
 * and leave separately measured boxes describing two different layouts.
 */
export async function arrowGeometry(popup: Locator, target: Locator, what = 'popup') {
    await settledBox(target, `${what}: the anchor`);
    await settledBox(popup, what);
    const arrow = popup.locator(':scope > [data-part="arrow"]');
    await settledBox(arrow, `${what}: the arrow`);
    const handle = await target.elementHandle();
    return popup.evaluate((el, anchor) => {
        const box = (e: Element) => {
            const r = e.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
        };
        return {
            placement: el.getAttribute('data-placement'),
            popup: box(el),
            arrow: box(el.querySelector(':scope > [data-part="arrow"]')!),
            target: box(anchor as Element),
        };
    }, handle);
}

/**
 * A scroll box's scrollport — its padding box, the rectangle it clips its
 * content to — in viewport coordinates. What a scrolled-to-end claim or a
 * focus-ring-inside claim measures against (Pagination #44, Stats #43):
 * the border box would count the border as visible room it is not.
 */
export const scrollport = (root: Locator) => root.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
        left: r.left + el.clientLeft,
        right: r.left + el.clientLeft + el.clientWidth,
        top: r.top + el.clientTop,
        bottom: r.top + el.clientTop + el.clientHeight,
    };
});
