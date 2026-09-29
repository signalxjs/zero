/**
 * The optional indicator parts (#437), measured in boxes.
 *
 * `toggle-group.item-indicator` and the `indicator` inside a collapsible or
 * accordion trigger are empty, `aria-hidden` spans the runtime keeps in step
 * with their item's `on|off` / `open|closed`; everything a reader sees is the
 * recipe's. The CSS goldens record the declarations, not whether they add up
 * to a mark, so this spec reads the rendered result in every design system:
 *
 * - the check is painted inside an on item, BEFORE its label, and gone from
 *   an off one — and a click moves it (material slides it in, so the reading
 *   is polled until the transition lands);
 * - the chevron is painted inside the trigger, AFTER its label, and turns
 *   between closed and open;
 * - a trigger that holds an indicator draws no second chevron of its own
 *   (daisyui, heroui and carbon hand their `::after` arrow over to the part;
 *   material's `::after` is its zero-size ripple).
 *
 * Chromium only, one page load per design system and page: box geometry is
 * not where engines differ, the six skins are where this could.
 */
import { expect, test, type Locator } from '@playwright/test';
import { bootPage } from './nav';
import { DESIGN_SYSTEMS, partsOf, rootLabelled } from './demo';

/** Sub-pixel slack for fractional boxes. */
const EPS = 1;

interface Mark {
    /** The mark's border box (all zero when it is not rendered). */
    left: number;
    right: number;
    width: number;
    height: number;
    /** The label text's box: every text node of the host, as one range. */
    textLeft: number;
    textRight: number;
    /** The host part's box. */
    hostLeft: number;
    hostRight: number;
    /** What turns a mark: the resolved `transform` and `rotate`. */
    turn: string;
}

/** A mark and the host it sits in, measured in ONE read. */
function measure(host: Locator, markSelector: string): Promise<Mark> {
    return host.evaluate((el, sel) => {
        const mark = el.querySelector<HTMLElement>(sel)!;
        const m = mark.getBoundingClientRect();
        const range = document.createRange();
        const texts = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
        range.setStartBefore(texts[0]!);
        range.setEndAfter(texts.at(-1)!);
        const t = range.getBoundingClientRect();
        const h = el.getBoundingClientRect();
        const cs = getComputedStyle(mark);
        return {
            left: m.left, right: m.right, width: m.width, height: m.height,
            textLeft: t.left, textRight: t.right,
            hostLeft: h.left, hostRight: h.right,
            turn: `${cs.transform}|${cs.rotate}`,
        };
    }, markSelector);
}

/** Whether the host's own `::after` draws anything a reader could take for a second mark. */
const drawsAfter = (host: Locator): Promise<boolean> => host.evaluate((el) => {
    const cs = getComputedStyle(el, '::after');
    if (cs.display === 'none' || cs.content === 'none' || cs.content === 'normal') return false;
    // A zero-size pseudo (material's resting ripple) paints nothing.
    return !(parseFloat(cs.width) === 0 || parseFloat(cs.height) === 0);
});

const CHECK = '[data-scope="toggle-group"][data-part="item-indicator"]';

test.describe('optional indicator parts (#437)', () => {
    test.beforeEach(({}, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'box geometry is not engine-specific — one engine is enough');
    });

    for (const ds of DESIGN_SYSTEMS) {
        test(`${ds}: a toggle-group item draws its check before the label, only while on`, async ({ page }) => {
            await bootPage(page, 'toggle-group', ds);
            const group = rootLabelled(page, 'toggle-group', 'Month');
            const item = (name: string) => partsOf(group, 'toggle-group')('item').filter({ hasText: name });

            const painted = async (name: string) => {
                const m = await measure(item(name), CHECK);
                return m.width > EPS && m.height > EPS;
            };

            await expect(item('Week').locator(CHECK)).toHaveAttribute('data-state', 'on');
            await expect.poll(() => painted('Week'), { message: `${ds}: the on item's check` }).toBe(true);
            await expect.poll(() => painted('Day'), { message: `${ds}: an off item draws no check` }).toBe(false);

            const on = await measure(item('Week'), CHECK);
            expect(on.right, `${ds}: the check sits before the label`).toBeLessThanOrEqual(on.textLeft + EPS);
            expect(on.left, `${ds}: the check sits inside its item`).toBeGreaterThanOrEqual(on.hostLeft - EPS);

            await item('Day').click();
            await expect(item('Day').locator(CHECK)).toHaveAttribute('data-state', 'on');
            await expect.poll(() => painted('Day'), { message: `${ds}: the check follows the click` }).toBe(true);
            await expect.poll(() => painted('Week'), { message: `${ds}: and leaves the item it left` }).toBe(false);
        });

        test(`${ds}: a disclosure indicator sits after the label and turns`, async ({ page }) => {
            await bootPage(page, 'collapsible', ds);
            const root = rootLabelled(page, 'collapsible', 'Release notes');
            const trigger = partsOf(root, 'collapsible')('trigger');
            const MARK = '[data-scope="collapsible"][data-part="indicator"]';

            const closed = await measure(trigger, MARK);
            expect(closed.width > EPS && closed.height > EPS, `${ds}: the chevron is painted`).toBe(true);
            expect(closed.left, `${ds}: the chevron follows the label`).toBeGreaterThanOrEqual(closed.textRight - EPS);
            expect(closed.right, `${ds}: the chevron stays inside its trigger`).toBeLessThanOrEqual(closed.hostRight + EPS);
            expect(await drawsAfter(trigger), `${ds}: the trigger draws no second chevron of its own`).toBe(false);

            await trigger.click();
            await expect(trigger.locator(MARK)).toHaveAttribute('data-state', 'open');
            await expect.poll(async () => (await measure(trigger, MARK)).turn, {
                message: `${ds}: the open chevron is turned from the closed one`,
            }).not.toBe(closed.turn);
        });

        test(`${ds}: accordion indicators follow their own item`, async ({ page }) => {
            await bootPage(page, 'accordion', ds);
            const root = rootLabelled(page, 'accordion', 'Shipping');
            const trigger = (name: string) => partsOf(root, 'accordion')('trigger').filter({ hasText: name });
            const MARK = '[data-scope="accordion"][data-part="indicator"]';

            const open = await measure(trigger('Shipping'), MARK);
            const closed = await measure(trigger('Returns'), MARK);
            for (const [what, m] of [['open', open], ['closed', closed]] as const) {
                expect(m.width > EPS && m.height > EPS, `${ds}: the ${what} chevron is painted`).toBe(true);
                expect(m.left, `${ds}: the ${what} chevron follows the label`).toBeGreaterThanOrEqual(m.textRight - EPS);
            }
            expect(open.turn, `${ds}: open and closed chevrons differ`).not.toBe(closed.turn);
            expect(await drawsAfter(trigger('Returns')), `${ds}: the trigger draws no second chevron of its own`).toBe(false);
        });
    }
});
