/**
 * Readonly on the non-text controls, in real engines (#267).
 *
 * What the unit suite cannot prove: that a cancelled click really leaves a
 * native checkbox and a native radio group where they were — the platform's
 * half of a cancelled activation re-checks the previously checked radio,
 * which happy-dom does not run — that the platform's arrow-key roving moves
 * focus between readonly radios without choosing, and that a native range
 * neither steps nor drags. Every control here is readonly through its
 * `Field.Root`, except the composed range slider, which takes the prop.
 */
import { test, expect } from '@playwright/test';
import { bootPage } from './nav';
import { demoPosting, rootPosting, settledBox } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'forms', 'basic');
});

for (const [scope, name, before] of [
    ['checkbox', 'ro-terms', 'checked'],
    ['switch', 'ro-notify', 'unchecked'],
] as const) {
    test(`a readonly ${scope} is focusable, and neither a click nor Space toggles it`, async ({ page }) => {
        const root = rootPosting(page, scope, name);
        const part = demoPosting(page, scope, name);
        await expect(root).toHaveAttribute('data-readonly', '');
        await root.click();
        await part('control').click();
        await expect(root).toHaveAttribute('data-state', before);
        await expect(part('hidden-input')).toBeChecked({ checked: before === 'checked' });

        await part('hidden-input').focus();
        await expect(part('hidden-input')).toBeFocused();
        await page.keyboard.press('Space');
        await expect(root).toHaveAttribute('data-state', before);
        await expect(part('hidden-input')).toBeChecked({ checked: before === 'checked' });
    });
}

test('a readonly radio group: a click chooses nothing, and the arrow keys move focus without choosing', async ({ page }) => {
    const plan = demoPosting(page, 'radio-group', 'ro-plan');
    const radios = plan('hidden-input');
    await expect(rootPosting(page, 'radio-group', 'ro-plan')).toHaveAttribute('aria-readonly', 'true');

    await plan('item').nth(1).click();
    await expect(plan('item').nth(0)).toHaveAttribute('data-state', 'checked');
    await expect(plan('item').nth(1)).toHaveAttribute('data-state', 'unchecked');
    // The platform put the previous radio back, not only the clicked one.
    await expect(radios.nth(0)).toBeChecked();
    await expect(radios.nth(1)).not.toBeChecked();

    await radios.nth(0).focus();
    await page.keyboard.press('ArrowDown');
    await expect(radios.nth(1)).toBeFocused();
    await expect(radios.nth(0)).toBeChecked();
    await expect(radios.nth(1)).not.toBeChecked();
    await expect(plan('item').nth(0)).toHaveAttribute('data-state', 'checked');
});

test('a readonly select stays focusable but neither opens nor changes on a key', async ({ page }) => {
    const fruit = demoPosting(page, 'select', 'ro-fruit');
    const trigger = fruit('trigger');
    await expect(trigger).toHaveAttribute('aria-readonly', 'true');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(fruit('popup')).toHaveAttribute('data-state', 'closed');

    await trigger.focus();
    await expect(trigger).toBeFocused();
    for (const key of ['ArrowDown', 'Enter', 'Space', 'c']) {
        await page.keyboard.press(key);
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    }
    await expect(fruit('value')).toHaveText('Banana');
    await expect(fruit('hidden-input')).toHaveValue('banana');
});

test('a readonly native range neither steps on a key nor moves on a press or a drag', async ({ page }) => {
    const control = demoPosting(page, 'slider', 'ro-volume')('control');
    await control.focus();
    await expect(control).toBeFocused();
    for (const key of ['ArrowRight', 'PageUp', 'End']) await page.keyboard.press(key);
    await expect(control).toHaveValue('40');

    const box = await settledBox(control, 'readonly range');
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.4, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.9, y, { steps: 5 });
    await page.mouse.up();
    await page.mouse.click(box.x + box.width * 0.1, y);
    await expect(control).toHaveValue('40');
});

test('a readonly composed range slider: thumbs focus, but no key, press or drag moves them', async ({ page }) => {
    const price = demoPosting(page, 'slider', 'ro-price');
    const thumbs = price('thumb');
    await expect(price('value-text')).toHaveText('20 – 60');

    await thumbs.nth(0).focus();
    await expect(thumbs.nth(0)).toBeFocused();
    for (const key of ['ArrowRight', 'PageUp', 'Home']) await page.keyboard.press(key);
    await expect(thumbs.nth(0)).toHaveAttribute('aria-valuenow', '20');

    const thumb = await settledBox(thumbs.nth(1), 'readonly thumb');
    const track = await settledBox(price('track'), 'readonly track');
    const y = thumb.y + thumb.height / 2;
    await page.mouse.move(thumb.x + thumb.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(track.x + track.width * 0.95, y, { steps: 5 });
    await page.mouse.up();
    await page.mouse.click(track.x + track.width * 0.05, track.y + track.height / 2);
    await expect(price('value-text')).toHaveText('20 – 60');
    await expect(rootPosting(page, 'slider', 'ro-price')).toHaveAttribute('data-readonly', '');
});
