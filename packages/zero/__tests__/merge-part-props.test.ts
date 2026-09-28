/**
 * `mergePartProps` (#452) — the merge table a host applies to a lent bag.
 * One test per row of the table in the #452 plan, then the edges: the
 * guard, case-insensitive handler grouping, every inert spelling, object
 * refs, an explicit host `undefined`, and associativity across a three-level
 * chain (tooltip → menu → button).
 */
import { describe, it, expect, vi } from 'vitest';
import { mergePartProps, LAYOUT_ATTR_PREFIX } from '@sigx/zero';
import type { LentBag } from '@sigx/zero';

const bag = (extra: Record<string, unknown> = {}): LentBag => ({
    'data-scope': 'tooltip',
    'data-part': 'trigger',
    ...extra,
});

const own = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    'data-scope': 'button',
    'data-part': 'root',
    ...extra,
});

describe('mergePartProps', () => {
    it('row 1: no lent bag returns the host props unchanged', () => {
        const mine = own({ id: 'b' });
        expect(mergePartProps(undefined, mine)).toBe(mine);
    });

    it('throws on a bag without data-scope/data-part', () => {
        expect(() => mergePartProps({ id: 'a' } as unknown as LentBag, own())).toThrow(/\[zero\] lend/);
        expect(() => mergePartProps({ 'data-scope': 'x' } as unknown as LentBag, own())).toThrow(/\[zero\] lend/);
    });

    it('row 2: the lender\'s runtime-written anatomy is dropped', () => {
        const out = mergePartProps(bag({
            'data-state': 'open',
            'data-orientation': 'vertical',
            'data-placement': 'top',
            'data-disabled': '',
            'data-highlighted': '',
            'data-focus-visible': '',
            'data-pressed': '',
            'data-visually-hidden': '',
            'data-autosize': '',
        }), own({ 'data-state': 'idle' }));
        expect(out).toEqual(own({ 'data-state': 'idle' }));
    });

    it.each([
        ['data-color', 'primary'],
        ['data-size', 'sm'],
        ['data-variant', 'ghost'],
        ['data-mod-block', ''],
        [`${LAYOUT_ATTR_PREFIX}gap`, 'md'],
    ])('row 3: paint on the lender throws (%s)', (key, value) => {
        expect(() => mergePartProps(bag({ [key]: value }), own())).toThrow(/set it on the host/);
    });

    it('row 3: an unset paint key on the lender is not paint', () => {
        expect(mergePartProps(bag({ 'data-color': undefined }), own())).toEqual(own());
    });

    it('row 4: any other lender data-* is dropped', () => {
        const out = mergePartProps(bag({ 'data-testid': 'tip' }), own({ 'data-row-id': 'r' }));
        expect(out['data-testid']).toBeUndefined();
        expect(out['data-row-id']).toBe('r');
    });

    it('row 5: hidden on the lender throws', () => {
        expect(() => mergePartProps(bag({ hidden: true }), own())).toThrow(/\[zero\] hidden/);
        expect(() => mergePartProps(bag({ hidden: undefined }), own())).not.toThrow();
    });

    it('row 6: handlers chain, lender first', () => {
        const calls: string[] = [];
        const out = mergePartProps(
            bag({ onClick: () => calls.push('lender'), onFocus: () => calls.push('lender-focus') }),
            own({ onClick: () => calls.push('host') }),
        );
        (out.onClick as () => void)();
        (out.onFocus as () => void)();
        expect(calls).toEqual(['lender', 'host', 'lender-focus']);
    });

    it('row 6: handlers group case-insensitively by event name', () => {
        const calls: string[] = [];
        const out = mergePartProps(
            bag({ onKeyDown: () => calls.push('lender') }),
            own({ onKeydown: () => calls.push('host') }),
        );
        expect(Object.keys(out).filter((k) => k.toLowerCase() === 'onkeydown')).toEqual(['onKeydown']);
        (out.onKeydown as () => void)();
        expect(calls).toEqual(['lender', 'host']);
    });

    it.each([
        ['aria-disabled="true"', { 'aria-disabled': 'true' }],
        ['aria-disabled={true}', { 'aria-disabled': true }],
        ['data-disabled', { 'data-disabled': '' }],
        ['disabled', { disabled: true }],
    ])('row 6: an inert host (%s) skips the lender\'s activation handlers only', (_name, inert) => {
        const lent = {
            onClick: vi.fn(), onAuxclick: vi.fn(), onKeydown: vi.fn(), onContextmenu: vi.fn(),
            onFocus: vi.fn(), onBlur: vi.fn(), onPointerenter: vi.fn(), onPointerdown: vi.fn(),
        };
        const hostClick = vi.fn();
        const out = mergePartProps(bag(lent), own({ ...inert, onClick: hostClick }));
        for (const key of Object.keys(lent)) (out[key] as (() => void) | undefined)?.();
        expect(hostClick).toHaveBeenCalledOnce();
        expect(lent.onClick).not.toHaveBeenCalled();
        expect(lent.onAuxclick).not.toHaveBeenCalled();
        expect(lent.onKeydown).not.toHaveBeenCalled();
        expect(lent.onContextmenu).not.toHaveBeenCalled();
        expect(lent.onFocus).toHaveBeenCalledOnce();
        expect(lent.onBlur).toHaveBeenCalledOnce();
        expect(lent.onPointerenter).toHaveBeenCalledOnce();
        expect(lent.onPointerdown).toHaveBeenCalledOnce();
    });

    it('row 6: aria-disabled="false" is not inert', () => {
        const onClick = vi.fn();
        const out = mergePartProps(bag({ onClick }), own({ 'aria-disabled': 'false' }));
        (out.onClick as () => void)();
        expect(onClick).toHaveBeenCalledOnce();
    });

    it('row 7: refs chain, lender first', () => {
        const calls: string[] = [];
        const out = mergePartProps(
            bag({ ref: (el: unknown) => calls.push(`lender:${String(el)}`) }),
            own({ ref: (el: unknown) => calls.push(`host:${String(el)}`) }),
        );
        (out.ref as (el: unknown) => void)('E');
        expect(calls).toEqual(['lender:E', 'host:E']);
    });

    it('row 7: { current } refs on either side', () => {
        const lent = { current: null as unknown };
        const mine = { current: null as unknown };
        const out = mergePartProps(bag({ ref: lent }), own({ ref: mine }));
        (out.ref as (el: unknown) => void)('E');
        expect(lent.current).toBe('E');
        expect(mine.current).toBe('E');
        // The lender's alone passes through as it is.
        expect(mergePartProps(bag({ ref: lent }), own()).ref).toBe(lent);
    });

    it('row 8: IDREF lists join, lender tokens first, deduped', () => {
        const out = mergePartProps(
            bag({ 'aria-describedby': 'tip  shared', 'aria-controls': 'menu', 'aria-owns': '' }),
            own({ 'aria-describedby': 'shared hint', 'aria-labelledby': 'l' }),
        );
        expect(out['aria-describedby']).toBe('tip shared hint');
        expect(out['aria-controls']).toBe('menu');
        expect(out['aria-labelledby']).toBe('l');
        expect('aria-owns' in out).toBe(false);
    });

    it('row 9: id — the host\'s, else the lender\'s; a conflict throws', () => {
        expect(mergePartProps(bag({ id: 't' }), own()).id).toBe('t');
        expect(mergePartProps(bag({ id: 't' }), own({ id: 't' })).id).toBe('t');
        expect(mergePartProps(bag(), own({ id: 'b' })).id).toBe('b');
        expect(() => mergePartProps(bag({ id: 't' }), own({ id: 'b' }))).toThrow(/\[zero\] id/);
    });

    it('row 10: role — the host\'s, else the lender\'s; a conflict throws', () => {
        expect(mergePartProps(bag({ role: 'tab' }), own()).role).toBe('tab');
        expect(() => mergePartProps(bag({ role: 'tab' }), own({ role: 'button' }))).toThrow(/\[zero\] role/);
    });

    it('row 11: other aria-* fill in; a conflict throws', () => {
        const out = mergePartProps(bag({ 'aria-haspopup': 'menu', 'aria-expanded': false }), own({ 'aria-expanded': 'false' }));
        expect(out['aria-haspopup']).toBe('menu');
        expect(out['aria-expanded']).toBe('false');
        expect(() => mergePartProps(bag({ 'aria-expanded': true }), own({ 'aria-expanded': false }))).toThrow(/aria-expanded/);
    });

    it('row 12: tabIndex — the lower of two numbers, else the host\'s, else the lender\'s', () => {
        expect(mergePartProps(bag({ tabIndex: -1 }), own({ tabIndex: 0 })).tabIndex).toBe(-1);
        expect(mergePartProps(bag({ tabIndex: 0 }), own({ tabIndex: -1 })).tabIndex).toBe(-1);
        expect(mergePartProps(bag({ tabIndex: 0 }), own()).tabIndex).toBe(0);
        expect(mergePartProps(bag(), own({ tabIndex: 0 })).tabIndex).toBe(0);
    });

    it('row 13: class concatenates; any other key is the host\'s, else the lender\'s', () => {
        const out = mergePartProps(bag({ class: 'lent', type: 'button', title: 'Tip' }), own({ class: 'mine', type: 'submit' }));
        expect(out.class).toBe('lent mine');
        expect(out.type).toBe('submit');
        expect(out.title).toBe('Tip');
    });

    it('row 13: a host key set to undefined still wins, as a spread would', () => {
        const out = mergePartProps(bag({ href: '/x' }), own({ href: undefined }));
        expect('href' in out).toBe(true);
        expect(out.href).toBeUndefined();
    });

    it('row 14: the lender\'s disabled is an ordinary key', () => {
        expect(mergePartProps(bag({ disabled: true }), own()).disabled).toBe(true);
        expect(mergePartProps(bag({ disabled: true }), own({ disabled: false })).disabled).toBe(false);
    });

    it('associativity: tooltip → menu → button chains in the same order either way', () => {
        const log: string[] = [];
        const level = (name: string, scope: string, part: string): LentBag => ({
            'data-scope': scope,
            'data-part': part,
            onClick: () => log.push(`click:${name}`),
            ref: () => log.push(`ref:${name}`),
            'aria-describedby': `${name}-desc`,
        });
        const t = level('tooltip', 'tooltip', 'trigger');
        const m = level('menu', 'menu', 'trigger');
        const b = level('button', 'button', 'root');

        const nested = mergePartProps(t, mergePartProps(m, b));
        const chained = mergePartProps(mergePartProps(t, m), b);
        const run = (out: Record<string, unknown>): string[] => {
            log.length = 0;
            (out.onClick as () => void)();
            (out.ref as (el: unknown) => void)(null);
            return [...log, String(out['aria-describedby']), String(out['data-scope'])];
        };
        const expected = [
            'click:tooltip', 'click:menu', 'click:button',
            'ref:tooltip', 'ref:menu', 'ref:button',
            'tooltip-desc menu-desc button-desc', 'button',
        ];
        expect(run(nested)).toEqual(expected);
        expect(run(chained)).toEqual(expected);
    });
});
