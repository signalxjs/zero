/**
 * A Field's `aria-describedby` and the text controls' native attributes in
 * real engines (#266).
 *
 * What happy-dom cannot prove: that the platform's own constraint
 * validation runs on the typed `pattern`, that `autocorrect="off"` and
 * `spellcheck="false"` survive as tokens in WebKit (whose `autocorrect`
 * property is a boolean that would read "off" as true), and that the
 * control's `aria-describedby` names only elements that exist as a
 * Field.Error comes and goes with the value's validity.
 */
import { test, expect, type Locator } from '@playwright/test';
import { bootPage } from './nav';
import { demoPosting } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'input', 'basic');
});

/** Every id `aria-describedby` names, each resolved to an element. */
async function describedIds(control: Locator): Promise<{ ids: string[]; dangling: string[] }> {
    return control.evaluate((el) => {
        const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
        return { ids, dangling: ids.filter((id) => !document.getElementById(id)) };
    });
}

test('the verification code renders its native hints as tokens', async ({ page }) => {
    const input = demoPosting(page, 'input', 'code')('input');
    await expect(input).toHaveAttribute('pattern', '[0-9]{6}');
    await expect(input).toHaveAttribute('inputmode', 'numeric');
    await expect(input).toHaveAttribute('enterkeyhint', 'done');
    await expect(input).toHaveAttribute('autocorrect', 'off');
    await expect(input).toHaveAttribute('autocapitalize', 'off');
    await expect(input).toHaveAttribute('spellcheck', 'false');
    expect(await input.evaluate((el: HTMLInputElement) => el.spellcheck)).toBe(false);
});

test("the control's aria-describedby follows the Field.Error, and never dangles", async ({ page }) => {
    const field = page.locator('[data-demo="verification-code"]');
    const input = demoPosting(page, 'input', 'code')('input');
    const error = field.locator('[data-scope="field"][data-part="error"]');

    // No Description, no Error: nothing to describe it.
    await expect(error).toHaveCount(0);
    await expect(input).not.toHaveAttribute('aria-describedby');

    // The platform's pattern check fails, the Error renders and is named.
    await input.fill('12ab');
    expect(await input.evaluate((el: HTMLInputElement) => el.validity.patternMismatch)).toBe(true);
    await expect(error).toHaveCount(1);
    const errorId = await error.getAttribute('id');
    await expect(input).toHaveAttribute('aria-describedby', errorId!);
    expect((await describedIds(input)).dangling).toEqual([]);

    // Valid again: the Error leaves, and so does the reference.
    await input.fill('123456');
    await expect(error).toHaveCount(0);
    await expect(input).not.toHaveAttribute('aria-describedby');
});
