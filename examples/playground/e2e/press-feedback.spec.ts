/**
 * The press-feedback contract, driven with real input.
 *
 * Every test reads `window.__pressLog` — an instrumentation stream of
 * `data-pressed` / `data-press-animating` mutations and `*-ripple`
 * animationstarts installed before the app boots. Real clicks are too fast
 * to observe the attributes after the fact; the log records the transient
 * truth.
 *
 * Two deliberate leniencies, learned from cross-engine runs:
 * - The relative order of press-END versus animation-START varies by engine
 *   (a quick click can release before or after the first animation frame),
 *   so ordering is asserted per concern, never across concerns.
 * - An element hidden by its own activation (a select option or menu item
 *   closing its popup) races its ripple: Chromium starts the animation
 *   before the hide lands, Firefox does not. Those tests assert the press
 *   lifecycle and the activation outcome, not the ripple.
 */
import { test, expect, type Page } from '@playwright/test';
import { controlledPopup, demoLabelled, demoPosting, settledBox } from './demo';

const media = (name: string) => name === 'reduced-motion' || name === 'forced-colors';

// Linux WebKit (WPE, as on CI runners) does not reliably synthesize keyboard
// and touch input in headless mode — the same tests pass on macOS WebKit and
// on the other engines. Pointer coverage on WebKit is unaffected.
const webkitOnLinux = (name: string) => name === 'webkit' && process.platform === 'linux';

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('zero-ds', 'material');
        const log: string[] = [];
        (window as unknown as { __pressLog: string[] }).__pressLog = log;
        const tag = (el: Element) => {
            const d = (el as HTMLElement).dataset;
            return `${d?.scope ?? el.tagName}/${d?.part ?? '?'}`;
        };
        const observe = () => {
            new MutationObserver((muts) => {
                for (const m of muts) {
                    if (m.attributeName?.startsWith('data-press')) {
                        const has = (m.target as Element).hasAttribute(m.attributeName);
                        log.push(`${tag(m.target as Element)}:${m.attributeName}:${has ? 'on' : 'off'}`);
                    }
                }
            }).observe(document.documentElement, {
                attributes: true,
                subtree: true,
                attributeFilter: ['data-pressed', 'data-press-animating'],
            });
            document.addEventListener('animationstart', (e) => {
                if ((e as AnimationEvent).animationName.endsWith('-ripple')) {
                    log.push(`anim:${(e as AnimationEvent).animationName}`);
                }
            }, true);
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe);
        else observe();
    });
    // The kitchen-sink route: this spec presses parts from a dozen different
    // demos, and `#/all` renders every page's demos on one document.
    await page.goto('/#/all');
    await expect(page.locator('link[data-zero-ds]')).toHaveAttribute('data-zero-ds', 'material');
});

const readLog = (page: Page): Promise<string[]> =>
    page.evaluate(() => (window as unknown as { __pressLog: string[] }).__pressLog);

const clearLog = (page: Page): Promise<void> =>
    page.evaluate(() => { (window as unknown as { __pressLog: string[] }).__pressLog.length = 0; });

/** Poll until the log contains `entry`, then return the log. */
const logWith = async (page: Page, entry: string): Promise<string[]> => {
    await expect
        .poll(async () => (await readLog(page)).includes(entry), { timeout: 10_000 })
        .toBe(true);
    return readLog(page);
};

/** Assert `entries` appear in the log in this relative order. */
const expectSequence = (log: string[], entries: string[]) => {
    let from = 0;
    for (const entry of entries) {
        const at = log.indexOf(entry, from);
        expect(log.slice(from), `expected "${entry}" after index ${from}`).toContain(entry);
        from = at + 1;
    }
};

/**
 * A part of the ONE component of that scope the playground renders. Strict
 * mode is the guard: a second instance turns this into a visible failure
 * rather than a silent pick. Anything rendered more than once is located
 * through a named demo root instead — `demoLabelled` / `demoPosting`, from
 * `demo.ts`, which also states the convention.
 */
const part = (page: Page, scope: string, name: string) =>
    page.locator(`[data-scope="${scope}"][data-part="${name}"]`);

/**
 * The toolbar's `system` theme button — the one these press tests drive.
 *
 * It is also what `part(page, 'button', 'root').first()` used to resolve to,
 * since the toolbar precedes the panels: the same element, now named. Every
 * other Button on the page is labelled from the live design system's own
 * vocabulary (`solid`, `primary`, a colour role), so there is nothing stable to
 * name them by — and a `.first()` over the lot is exactly the retarget that
 * cost #241 a long investigation.
 */
const pressButton = (page: Page) => page.getByRole('button', { name: 'system', exact: true });

/** The Actions menu, and the popup its trigger publishes through aria-controls. */
const actionsTrigger = (page: Page) => page.getByRole('button', { name: 'Actions', exact: true });
const actionsPopup = (page: Page) => controlledPopup(page, actionsTrigger(page), 'the Actions menu trigger');

test('button: a real click plays the full press lifecycle, ripple outliving release', async ({ page }) => {
    test.skip(media(test.info().project.name), 'covered by the media-specific tests');
    await pressButton(page).click();
    const log = await logWith(page, 'button/root:data-press-animating:off');
    expectSequence(log, ['button/root:data-pressed:on', 'button/root:data-pressed:off']);
    expectSequence(log, [
        'button/root:data-press-animating:on',
        'anim:btn-ripple',
        'button/root:data-press-animating:off',
    ]);
});

test('button: real keyboard Enter presses at the center', async ({ page }) => {
    test.skip(media(test.info().project.name), 'covered by the media-specific tests');
    test.skip(webkitOnLinux(test.info().project.name), 'Linux WebKit headless keyboard synthesis');
    // WebKit occasionally hasn't granted a fresh headless page keyboard
    // focus when the first synthetic key arrives — focus-and-press until the
    // press registers instead of pressing once into the void.
    const button = pressButton(page);
    await expect
        .poll(async () => {
            await button.focus();
            await page.keyboard.press('Enter');
            return (await readLog(page)).includes('button/root:data-pressed:on');
        }, { timeout: 10_000 })
        .toBe(true);
    const log = await logWith(page, 'button/root:data-press-animating:off');
    expectSequence(log, ['button/root:data-pressed:on', 'anim:btn-ripple']);
});

test('disabled button: nothing is published', async ({ page }) => {
    // Positional, and safe by construction: the selector itself pins the only
    // property under test (`data-disabled`), and the assertion is negative and
    // universal — NOTHING may be published. Landing on a different disabled
    // button in the variant matrix proves exactly the same thing.
    await page.locator('[data-scope="button"][data-part="root"][data-disabled]').first()
        .click({ force: true });
    await page.waitForTimeout(300);
    expect(await readLog(page)).toEqual([]);
});

test('tabs: click ripples; arrow roving still works and is not a press', async ({ page }) => {
    test.skip(media(test.info().project.name), 'covered by the media-specific tests');
    // The playground renders one Tabs; `first`/`nth` index ITS own tab strip,
    // which is the convention's carve-out.
    const tabs = part(page, 'tabs', 'tab');
    await tabs.first().click();
    const log = await logWith(page, 'anim:tab-ripple');
    expectSequence(log, ['tabs/tab:data-pressed:on', 'anim:tab-ripple']);
    await logWith(page, 'tabs/tab:data-press-animating:off');
    await clearLog(page);
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toHaveAttribute('data-state', 'active');
    expect(await readLog(page)).toEqual([]);
});

test('switch: pressing the label row marks the control and toggles exactly once', async ({ page }) => {
    // The Notifications switch from the Switch demo. Its label row and its
    // hidden input have to belong to the SAME switch for "toggles exactly
    // once" to mean anything — two `.first()` calls only agreed by accident.
    const notifications = demoLabelled(page, 'switch', 'Notifications');
    const input = notifications('hidden-input');
    const before = await input.isChecked();
    await notifications('label').click();
    const log = await logWith(page, 'switch/control:data-pressed:off');
    expectSequence(log, ['switch/control:data-pressed:on', 'switch/control:data-pressed:off']);
    expect(log).not.toContain('switch/root:data-pressed:on');
    await expect
        .poll(() => input.isChecked())
        .toBe(!before);
});

test('checkbox and radio: label-row press lands on the control with the halo ripple', async ({ page }) => {
    test.skip(media(test.info().project.name), 'covered by the media-specific tests');
    await clearLog(page);
    // The size-ramp demo also renders a checkbox per step — `.first()` once
    // reached one of those instead of this named row, and waited 30s for a
    // hidden element to become clickable.
    await demoLabelled(page, 'checkbox', 'Weekly newsletter')('label').click();
    // One group, three items: the item is named, not counted off.
    await part(page, 'radio-group', 'item-label').filter({ hasText: 'Pro' }).click();
    const log = await logWith(page, 'anim:radio-ripple');
    expectSequence(log, ['checkbox/control:data-pressed:on', 'anim:checkbox-ripple']);
    expectSequence(log, ['radio-group/item-control:data-pressed:on', 'anim:radio-ripple']);
});

test('select: the trigger ripples; a real option press selects', async ({ page }) => {
    test.skip(media(test.info().project.name), 'covered by the media-specific tests');
    await clearLog(page);
    // The fruit select — the one that posts `name="fruit"`. The Select demo
    // renders an invalid sample with the same placeholder and the same three
    // options, and the size ramp renders one per step: seven triggers in all.
    const fruit = demoPosting(page, 'select', 'fruit');
    await fruit('trigger').click();
    const log = await logWith(page, 'anim:select-ripple');
    expectSequence(log, ['select/trigger:data-pressed:on', 'anim:select-ripple']);
    await fruit('item').filter({ hasText: 'Apple' }).click();
    // The option's own ripple races the popup close (engine-dependent) —
    // assert the press and the outcome, not the animation.
    const itemLog = await logWith(page, 'select/item:data-pressed:off');
    expectSequence(itemLog, ['select/item:data-pressed:on', 'select/item:data-pressed:off']);
    await expect(fruit('value')).not.toHaveText(/Pick a fruit/);
});

test('menu: the trigger ripples; a real item press activates and closes', async ({ page }) => {
    test.skip(media(test.info().project.name), 'covered by the media-specific tests');
    // The Actions menu. `menu/popup`.first() and `menu/item`.first() reached
    // across BOTH menus on the page and picked this one only because the
    // Actions demo precedes the context menu in document order. `Menu.Root`
    // renders no element, so the popup is a SIBLING of the trigger — the
    // trigger's `aria-controls` is what ties the two together.
    const popup = await actionsPopup(page);
    await actionsTrigger(page).click();
    const log = await logWith(page, 'anim:menu-ripple');
    expectSequence(log, ['menu/trigger:data-pressed:on', 'anim:menu-ripple']);
    await popup.locator('[data-part="item"]').filter({ hasText: 'Rename' }).click();
    const itemLog = await logWith(page, 'menu/item:data-pressed:off');
    expectSequence(itemLog, ['menu/item:data-pressed:on', 'menu/item:data-pressed:off']);
    await expect(popup).not.toBeVisible();
});

test('disclosure triggers ripple on their native summaries', async ({ page }) => {
    test.skip(media(test.info().project.name), 'covered by the media-specific tests');
    await part(page, 'collapsible', 'trigger').click();
    const log = await logWith(page, 'anim:collapsible-ripple');
    expectSequence(log, ['collapsible/trigger:data-pressed:on', 'anim:collapsible-ripple']);
});

test('slider: the press survives a drag that leaves the track (capture) and never one-shots', async ({ page }) => {
    // The Volume slider — the Slider demo also renders an invalid one, whose
    // control is the same anatomy.
    const slider = demoLabelled(page, 'slider', 'Volume')('control');
    await slider.hover(); // scrolls into view; coordinates measured after
    const box = await settledBox(slider, 'the Volume slider control');
    const before = await slider.evaluate((el) => (el as HTMLInputElement).value);
    await clearLog(page);

    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
    await page.mouse.down();
    await expect(slider).toHaveAttribute('data-pressed', ''); // press started
    // drag along the track first — the value must follow the pointer
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2, { steps: 5 });
    // then wander far BELOW the input — off its box, mid-gesture
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height + 120, { steps: 8 });
    await expect(slider).toHaveAttribute('data-pressed', ''); // survived leaving
    await page.mouse.up();

    await expect(slider).not.toHaveAttribute('data-pressed', '');
    const after = await slider.evaluate((el) => (el as HTMLInputElement).value);
    expect(after).not.toBe(before);
    expect(await readLog(page)).not.toContain('slider/control:data-press-animating:on');
});

test('touch: a real tap presses and the ripple completes', async ({ page }) => {
    test.skip(!test.info().project.use.hasTouch, 'project has no touchscreen');
    test.skip(webkitOnLinux(test.info().project.name), 'Linux WebKit headless touch synthesis');
    const box = await settledBox(pressButton(page), 'the system button');
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    const log = await logWith(page, 'button/root:data-press-animating:off');
    expectSequence(log, ['button/root:data-pressed:on', 'button/root:data-pressed:off']);
    expect(log).toContain('anim:btn-ripple');
});

test('reduced motion: the one-shot resolves instantly and the held tint remains', async ({ page }) => {
    test.skip(test.info().project.name !== 'reduced-motion');
    const button = pressButton(page);
    const box = await settledBox(button, 'the system button');
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    // durations collapse to 0.01ms — animationend must fire almost at once
    await expect(button).not.toHaveAttribute('data-press-animating', '');
    await expect(button).toHaveAttribute('data-pressed', '');
    const tint = await button.evaluate((el) => getComputedStyle(el, '::before').opacity);
    expect(tint).toBe('0.12');
    await page.mouse.up();
    // the animation still STARTED (0.01ms, not 0) — the lifecycle never strands
    expect(await readLog(page)).toContain('anim:btn-ripple');
});

test('forced colors: decorative press layers are hidden', async ({ page }) => {
    test.skip(test.info().project.name !== 'forced-colors');
    const button = pressButton(page);
    const box = await settledBox(button, 'the system button');
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    const layers = await button.evaluate((el) => ({
        before: getComputedStyle(el, '::before').display,
        after: getComputedStyle(el, '::after').display,
    }));
    expect(layers).toEqual({ before: 'none', after: 'none' });
    await page.mouse.up();
});

test('a ripple destroyed with its stylesheet still clears its own flag', async ({ page }) => {
    test.skip(media(test.info().project.name), 'covered by the media-specific tests');
    // ONE press, and no second one to heal it — #243. The press starts
    // material's 500ms `btn-ripple` on the swap control and, in the same
    // gesture, tears material's stylesheet out from under it: `basic` declares
    // no `[data-press-animating]` rule at all, so the running CSSAnimation is
    // destroyed rather than finished, and no replacement takes its place.
    // `animationcancel` is not reliably dispatched for that destruction (webkit
    // and firefox strand the flag in roughly half of runs without the fix), so
    // the runtime has to learn it some other way.
    const swap = page.getByRole('button', { name: 'Basic', exact: true });
    await swap.click();
    await expect.poll(() => page.locator('link[data-zero-ds]').count()).toBe(1);
    await expect(page.locator('link[data-zero-ds]')).toHaveAttribute('data-zero-ds', 'basic');
    await expect.poll(() => page.locator('[data-press-animating]').count()).toBe(0);
});

test('design-system swap mid-ripple leaves no stale press state', async ({ page }) => {
    test.skip(media(test.info().project.name), 'covered by the media-specific tests');
    // Both presses land on the swap control itself, so the ripple in flight
    // belongs to the control the swap re-renders. This used to be implicit:
    // `part(page, 'button', 'root').first()` resolved to the header's `Basic`
    // design-system button, so the two lines pressed the same element by
    // accident of document order. The toolbar's rows are ToggleGroups now and
    // `.first()` resolves elsewhere, so the pairing is named rather than
    // inherited.
    const swap = page.getByRole('button', { name: 'Basic', exact: true });
    await swap.click();
    // Settle the swap before reading it. `activateDesignSystem` appends the
    // incoming stylesheet and awaits its load BEFORE removing the outgoing one
    // (design-systems.ts), so both <link> ELEMENTS exist for one frame — with
    // the incoming `.sheet` still null, which is why "exactly one live
    // stylesheet" survives it. The strict-mode locator below cannot tell the
    // two apart, and `expect` does not retry a strict-mode violation, so it
    // would report that documented window as a stacking bug. Asserting the
    // settled count first states the invariant outright instead of leaning on
    // strict mode for it, and fails as `2 !== 1` if links ever really stack.
    await expect.poll(() => page.locator('link[data-zero-ds]').count()).toBe(1);
    await expect(page.locator('link[data-zero-ds]')).toHaveAttribute('data-zero-ds', 'basic');
    // The second press, under the now-settled stylesheet. It used to be
    // load-bearing for the wrong reason: a press restarts the one-shot, and
    // that restart was the ONLY thing clearing a `data-press-animating` left
    // behind when the first ripple was destroyed with material's stylesheet
    // rather than finishing (#243) — so this test always ran in the healed
    // configuration and never exercised the destruction. The runtime clears
    // that flag itself now, and the single-press case is asserted by the test
    // above. The press stays because it is worth its own coverage: it is the
    // restart path, under a design system that declares no press animation at
    // all, and it proves the previous press's cancellation does not reach past
    // it — the flag it re-arms must still resolve, and must not be cleared by
    // the animation the restart itself destroyed.
    await swap.click();
    await expect.poll(() => page.locator('[data-press-animating]').count()).toBe(0);
    await expect.poll(() => page.locator('[data-pressed]').count()).toBe(0);
});
