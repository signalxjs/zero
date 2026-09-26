/**
 * FileUpload in real engines (#273).
 *
 * What the unit suite cannot prove: that a real form submission with a
 * `required` file input left empty fires `invalid` on the visually-hidden
 * input and focus really lands on the trigger (the platform's bubble would
 * otherwise anchor to a 1px element); that a picker selection really
 * leaves only the accepted files in the input's FileList (`DataTransfer`
 * is constructible here, not simulated); that focus survives a removal
 * and a clear by landing on a real, focusable element; and that a
 * `dragleave` whose `relatedTarget` is a real descendant keeps the
 * dropzone highlighted.
 */
import { test, expect } from '@playwright/test';
import { bootPage } from './nav';
import { demoPosting, rootPosting } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'file-upload', 'basic');
});

const MB = 1_000_000;

test('an empty required upload blocks the submit, focuses the trigger and reads invalid until a file is chosen', async ({ page }) => {
    const root = rootPosting(page, 'file-upload', 'resume');
    const part = demoPosting(page, 'file-upload', 'resume');
    const form = page.locator('form[aria-label="Required upload"]');

    await form.getByRole('button', { name: 'Submit' }).click();
    await expect(part('trigger')).toBeFocused();
    await expect(root).toHaveAttribute('data-invalid', '');
    await expect(part('trigger')).toHaveAttribute('aria-invalid', 'true');
    await expect(form.locator('output')).toHaveText('');

    await part('input').setInputFiles({ name: 'resume.txt', mimeType: 'text/plain', buffer: Buffer.from('cv') });
    await expect(root).not.toHaveAttribute('data-invalid', '');
    await expect(part('trigger')).not.toHaveAttribute('aria-invalid', 'true');
    await form.getByRole('button', { name: 'Submit' }).click();
    await expect(form.locator('output')).toHaveText('Submitted.');
});

test('constraints: refused files are reported through Item invalid and never reach the input', async ({ page }) => {
    const part = demoPosting(page, 'file-upload', 'constrained');
    // Seeded with two files; the limit is three.
    await expect(part('item-name')).toHaveText(['notes.md', 'data.csv']);

    await part('input').setInputFiles([
        { name: 'big.txt', mimeType: 'text/plain', buffer: Buffer.alloc(2 * MB, 97) },
        { name: 'empty.txt', mimeType: 'text/plain', buffer: Buffer.alloc(0) },
        { name: 'archive.zip', mimeType: 'application/zip', buffer: Buffer.from('zip') },
        { name: 'draft-1.txt', mimeType: 'text/plain', buffer: Buffer.from('d') },
        { name: 'ok.txt', mimeType: 'text/plain', buffer: Buffer.from('ok') },
        { name: 'extra.txt', mimeType: 'text/plain', buffer: Buffer.from('ex') },
    ]);

    const accepted = part('item').and(page.locator(':not([data-invalid])'));
    const refused = part('item').and(page.locator('[data-invalid]'));
    await expect(accepted.locator('[data-part="item-name"]')).toHaveText(['notes.md', 'data.csv', 'ok.txt']);
    await expect(refused.locator('[data-part="item-name"]'))
        .toHaveText(['big.txt', 'empty.txt', 'archive.zip', 'draft-1.txt', 'extra.txt']);
    await expect(refused.filter({ hasText: 'archive.zip' })).toContainText('not a text or image file');
    await expect(refused.filter({ hasText: 'extra.txt' })).toContainText('over the three-file limit');
    // What posts is what the list shows: the refused selection was written
    // out of the input's own FileList.
    const posted = await part('input').evaluate((el) => [...((el as HTMLInputElement).files ?? [])].map((f) => f.name));
    expect(posted).toEqual(['notes.md', 'data.csv', 'ok.txt']);
});

test('removing a file hands focus to the next remove button, then the previous, then the trigger; clear to the trigger', async ({ page }) => {
    const part = demoPosting(page, 'file-upload', 'constrained');
    const remove = (name: string) => part('item-remove').and(page.getByRole('button', { name: `Remove ${name}` }));

    await part('input').setInputFiles({ name: 'third.txt', mimeType: 'text/plain', buffer: Buffer.from('3') });
    await expect(part('item-name')).toHaveText(['notes.md', 'data.csv', 'third.txt']);

    await remove('data.csv').focus();
    await page.keyboard.press('Enter');
    await expect(part('item-name')).toHaveText(['notes.md', 'third.txt']);
    await expect(remove('third.txt')).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(part('item-name')).toHaveText(['notes.md']);
    await expect(remove('notes.md')).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(part('item-name')).toHaveCount(0);
    await expect(part('trigger')).toBeFocused();
    // Nothing to clear, so no clear trigger.
    await expect(part('clear-trigger')).toHaveCount(0);

    await part('input').setInputFiles({ name: 'again.txt', mimeType: 'text/plain', buffer: Buffer.from('a') });
    await expect(part('clear-trigger')).toHaveAccessibleName('Clear files');
    await part('clear-trigger').focus();
    await page.keyboard.press('Enter');
    await expect(part('item')).toHaveCount(0);
    await expect(part('clear-trigger')).toHaveCount(0);
    await expect(part('trigger')).toBeFocused();
});

test('a drag moving onto a child of the dropzone keeps it highlighted; leaving clears it', async ({ page }) => {
    const part = demoPosting(page, 'file-upload', 'constrained');
    const dropzone = part('dropzone');
    const fire = (type: string, into: 'child' | 'outside' | 'none') => dropzone.evaluate((el, [t, where]) => {
        const dt = new DataTransfer();
        dt.items.add(new File(['x'], 'x.txt', { type: 'text/plain' }));
        const child = el.querySelector('small');
        const relatedTarget = where === 'child' ? child : where === 'outside' ? document.body : null;
        const target = t === 'dragenter' && where === 'child' ? child! : el;
        target.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt, relatedTarget }));
    }, [type, into] as const);

    await fire('dragenter', 'none');
    await fire('dragover', 'none');
    await expect(dropzone).toHaveAttribute('data-highlighted', '');
    await fire('dragenter', 'child');
    await fire('dragleave', 'child');
    await expect(dropzone).toHaveAttribute('data-highlighted', '');
    await fire('dragleave', 'outside');
    await expect(dropzone).not.toHaveAttribute('data-highlighted', '');
});
