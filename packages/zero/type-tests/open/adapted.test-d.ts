/**
 * `Adapted` — the type constructor the generated `components.d.ts` files
 * instantiate (issue #179).
 *
 * Checked in the OPEN project on purpose: an adapted surface must be fully
 * narrowed with `ZeroVocabulary` unaugmented — that is the whole point of the
 * `./components` module needing no `/register` import. The vendor props are
 * self-contained literals; the rest of the surface derives from the base
 * factory's brands, so it cannot drift from zero's source.
 */
import type { Adapted } from '@sigx/zero/adapt';
import { Button } from '@sigx/zero';
import type { Equal, MustBeTrue } from '../assert.js';

/** What the kit emits for a Carbon-flavoured Button, hand-written here. */
type CarbonVendorProps = {
    kind?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger--tertiary';
    hasIconOnly?: boolean;
    isExpressive?: boolean;
};
type ZeroAxisProp = 'color' | 'size' | 'variant' | 'axes' | 'mods';
type CarbonButton = Adapted<typeof Button, ZeroAxisProp, CarbonVendorProps>;

type CarbonProps = Parameters<CarbonButton>[0];

// The vendor surface narrows: declared spellings in, everything else out.
const ok: CarbonProps = { kind: 'ghost', hasIconOnly: true };
const respelled: CarbonProps = { kind: 'danger--tertiary' };
// @ts-expect-error — not in the vendor union
const bogus: CarbonProps = { kind: 'nope' };

// The mapped zero props are GONE, not merely widened — one way to write one
// attribute.
// @ts-expect-error — variant was removed by the adapter
const zeroName: CarbonProps = { variant: 'ghost' };
// @ts-expect-error — mods was removed by the adapter
const modsBag: CarbonProps = { mods: { 'icon-only': true } };
// @ts-expect-error — color was removed by the adapter
const colorProp: CarbonProps = { color: 'primary' };

// Everything unrouted survives with its base typing.
const passthrough: CarbonProps = {
    kind: 'primary',
    disabled: true,
    class: 'cta',
    type: 'submit',
    onClick: (e) => void e.preventDefault(),
};
// @ts-expect-error — base typing still checks what it keeps
const badType: CarbonProps = { type: 'sbumit' };

// Ref and slots come from the base factory unchanged.
export type _refPreserved = MustBeTrue<Equal<CarbonButton['__ref'], (typeof Button)['__ref']>>;
export type _slotsPreserved = MustBeTrue<Equal<CarbonButton['__slots'], (typeof Button)['__slots']>>;

export const _use = [ok, respelled, bogus, zeroName, modsBag, colorProp, passthrough, badType];
