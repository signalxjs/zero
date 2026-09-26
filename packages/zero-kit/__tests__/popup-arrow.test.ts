/**
 * `popupArrow` / `popupArrowHost` (zero#279): the recipe half of the popup
 * arrow. The runtime writes `--arrow-x`/`--arrow-y`; these pin what the
 * compiled CSS does with them — the edge per placement, the RTL turn, the
 * inert default outside a root popup, and the popup letting it out.
 *
 * The real-layout proof (the tip over the trigger's centre, still inside the
 * popup after a shift) is `examples/playground/e2e/popover.spec.ts`.
 */
import { describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import { compileRecipeCss, parseRules, popupArrow, popupArrowHost } from '@sigx/zero-kit';
import type { ManifestComponent, RecipeInput } from '@sigx/zero-kit';

const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };
const popover = manifest.components.find((c) => c.scope === 'popover')!;

const recipe: RecipeInput = {
    component: 'popover',
    parts: {
        popup: { base: { background: 'var(--color-base-100)' }, selectors: popupArrowHost('popover') },
        arrow: popupArrow('popover', { size: '10px', paint: { background: 'var(--color-base-100)' } }),
    },
};
/** Each rule's declarations as a property → value map. */
const rules = parseRules(compileRecipeCss(recipe, popover)).map((r) => ({
    selector: r.selector,
    decls: Object.fromEntries(r.decls.map((d) => {
        const at = d.indexOf(':');
        return [d.slice(0, at).trim(), d.slice(at + 1).trim()];
    })) as Record<string, string>,
}));
const ARROW = '[data-scope="popover"][data-part="arrow"]';
const on = (placement: string, rtl = false) => rules.find((r) => r.selector
    === `[data-scope="popover"][data-part="popup"][data-placement^="${placement}"]`
    + (rtl ? ':where(:dir(rtl), [dir="rtl"], [dir="rtl"] *)' : '')
    + ` > ${ARROW}`)?.decls;

describe('popupArrow', () => {
    it('is inert by default — only a root popup with a placement shows it', () => {
        const base = rules.find((r) => r.selector === ARROW)!.decls;
        expect(base).toMatchObject({ display: 'none', position: 'absolute', rotate: '45deg', width: '10px', background: 'var(--color-base-100)' });
        for (const side of ['top', 'bottom', 'left', 'right', 'start', 'end']) {
            expect(on(side)?.display, side).toBe('block');
        }
        // No rule keys on a sub-popup: a Menu.Arrow there stays display:none.
        expect(rules.some((r) => r.selector.includes('sub-popup'))).toBe(false);
    });

    it('sits on the edge facing the anchor, along the published offset', () => {
        expect(on('top')).toMatchObject({ top: 'calc(100% - 10px / 2)', left: 'var(--arrow-x, calc(50% - 10px / 2))' });
        expect(on('bottom')).toMatchObject({ top: 'calc(10px / -2)', left: 'var(--arrow-x, calc(50% - 10px / 2))' });
        expect(on('left')).toMatchObject({ left: 'calc(100% - 10px / 2)', top: 'var(--arrow-y, calc(50% - 10px / 2))' });
        expect(on('right')).toMatchObject({ left: 'calc(10px / -2)', top: 'var(--arrow-y, calc(50% - 10px / 2))' });
        // start/end are logical: the inset mirrors under RTL by itself…
        expect(on('start')).toMatchObject({ 'inset-inline-start': 'calc(100% - 10px / 2)' });
        expect(on('end')).toMatchObject({ 'inset-inline-start': 'calc(10px / -2)' });
    });

    it('clips to the half pointing at the anchor, and turns the inline tips under RTL', () => {
        const down = 'polygon(100% 0, 100% 100%, 0 100%)';
        const up = 'polygon(0 0, 100% 0, 0 100%)';
        const right = 'polygon(0 0, 100% 0, 100% 100%)';
        const left = 'polygon(0 0, 100% 100%, 0 100%)';
        expect([on('top')?.['clip-path'], on('bottom')?.['clip-path'], on('left')?.['clip-path'], on('right')?.['clip-path']])
            .toEqual([down, up, right, left]);
        // …but a clip has no logical spelling.
        expect([on('start')?.['clip-path'], on('end')?.['clip-path']]).toEqual([right, left]);
        expect([on('start', true)?.['clip-path'], on('end', true)?.['clip-path']]).toEqual([left, right]);
    });

    it('lets the popup show it only while an arrow is rendered', () => {
        const host = rules.find((r) => r.selector
            === `[data-scope="popover"][data-part="popup"]:has(> ${ARROW})`);
        expect(host?.decls).toEqual({ overflow: 'visible' });
    });
});
