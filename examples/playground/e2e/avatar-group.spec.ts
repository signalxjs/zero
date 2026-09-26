/**
 * AvatarGroup in real layout, in every design system (#297).
 *
 * The group's `size` reaches the avatars inside through the recipe alone —
 * a borrowed `composes` rule, an `@scope` block keyed on the group's
 * `data-size` — and the "+N" chip tracks the same ramp through a token of
 * its own. Neither is visible without layout: the unit suite has no
 * cascade, and the CSS goldens prove the rules exist, not that they land.
 * So this measures boxes: the chip is as tall as the faces beside it, a
 * small group's faces really are smaller than a default group's while
 * carrying no `data-size` of their own, and the stack keeps reading order
 * however far a skin overlaps it.
 *
 * The groups are located by their accessible name (`role="group"` +
 * `label`), which is also the claim that the label names them.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { partsOf, settledBox, DESIGN_SYSTEMS } from './demo';

const group = (page: Page, name: string): Locator => page.getByRole('group', { name, exact: true });

async function faces(root: Locator, what: string) {
    const avatars = partsOf(root, 'avatar')('root');
    const boxes = [];
    for (let i = 0; i < await avatars.count(); i++) {
        boxes.push(await settledBox(avatars.nth(i), `${what}: avatar ${i}`));
    }
    return boxes;
}

for (const ds of DESIGN_SYSTEMS) {
    test(`${ds}: the chip matches its faces, and a group's size reaches its avatars`, async ({ page }) => {
        await bootPage(page, 'avatar', ds);
        const members = group(page, 'Project members');
        const reviewers = group(page, 'Reviewers');

        // The words assistive technology reads, and the glyph it does not.
        const chip = partsOf(members, 'avatar-group')('overflow');
        await expect(chip.locator(':scope > :not([aria-hidden="true"])')).toHaveText('3 more');
        await expect(chip.locator(':scope > [aria-hidden="true"]')).toHaveText('+3');

        for (const [root, what] of [[members, 'members'], [reviewers, 'reviewers']] as const) {
            const boxes = await faces(root, `${ds} ${what}`);
            const chipBox = await settledBox(partsOf(root, 'avatar-group')('overflow'), `${ds} ${what}: the chip`);
            // The chip is one more face: the same height as the avatars.
            expect(Math.abs(chipBox.height - boxes[0].height), `${ds} ${what}: chip vs avatar height`).toBeLessThanOrEqual(0.5);
            // Overlap or not, the stack reads in order along the inline axis,
            // and the chip comes last.
            const starts = [...boxes.map((b) => b.x), chipBox.x];
            for (let i = 1; i < starts.length; i++) {
                expect(starts[i], `${ds} ${what}: item ${i} starts after item ${i - 1}`).toBeGreaterThan(starts[i - 1]);
            }
        }

        // The Reviewers demo picks a size below the default; its avatars take
        // it from the group, with no attribute of their own.
        const size = await reviewers.getAttribute('data-size');
        expect(size, `${ds}: the reviewers demo picked no size`).toBeTruthy();
        await expect(partsOf(reviewers, 'avatar')('root').first()).not.toHaveAttribute('data-size', /.*/);
        const [small] = await faces(reviewers, `${ds} reviewers`);
        const [regular] = await faces(members, `${ds} members`);
        expect(small.height, `${ds}: a ${size} group's avatar vs a default group's`).toBeLessThan(regular.height - 1);
    });
}
