/**
 * The phase-2 compile gate of issue #179, run against the REAL emitted
 * `components.d.ts` goldens (kept current by
 * `zero-kit/__tests__/components-dts.test.ts`).
 *
 * Deliberately isolated with NO register golden in the program: everything
 * asserted here must hold with `ZeroVocabulary` unaugmented, because that is
 * the promise of the `./components` module — full narrowing with no
 * `/register` import. Two design systems' modules coexist in this one
 * program, which two register augmentations never could.
 */
import { Button as CarbonButton } from './carbon.components.js';
import { Button as HerouiButton, Tabs as HerouiTabs } from './heroui.components.js';
import { Button as DaisyButton } from './daisyui.components.js';
import type { Equal, MustBeTrue } from '../assert.js';

type CarbonProps = Parameters<typeof CarbonButton>[0];
type HerouiProps = Parameters<typeof HerouiButton>[0];
type DaisyProps = Parameters<typeof DaisyButton>[0];

// ── the gate, clause 1: vendor props typecheck, narrowed per design system ──
const carbonOk: CarbonProps = { kind: 'ghost', hasIconOnly: true };
const herouiOk: HerouiProps = { variant: 'danger-soft', isIconOnly: true, size: 'lg' };

// The full union carries the vendor spellings the attribute grammar cannot.
export type _kindUnion = MustBeTrue<Equal<
    NonNullable<CarbonProps['kind']>,
    'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger' | 'danger--tertiary' | 'danger--ghost'
>>;
const respelled: CarbonProps = { kind: 'danger--tertiary' };

// ── clause 2: a value outside the vocabulary is rejected ──
// @ts-expect-error — not a Carbon kind
const carbonBogus: CarbonProps = { kind: 'nope' };
// @ts-expect-error — wired means CLOSED: a heroui typo errors with no register
const herouiBogus: HerouiProps = { variant: 'solid' };

// ── clause 3: the mapped zero prop is gone, and a foreign vendor name never existed ──
// @ts-expect-error — carbon maps variant to kind; the zero name is removed
const carbonZeroName: CarbonProps = { variant: 'ghost' };
// @ts-expect-error — the mods bag is replaced by the vendor booleans
const carbonMods: CarbonProps = { mods: { 'icon-only': true } };
// @ts-expect-error — heroui declares no rename, so Carbon's kind means nothing here
const herouiForeign: HerouiProps = { kind: 'ghost' };
// @ts-expect-error — heroui declares no color axis; the prop is simply absent
const herouiColor: HerouiProps = { color: 'primary' };

// ── daisyui (#332): api + the recommended colour axis on one surface ──
// The old @sigx/daisyui Button call shape, fully typed from one import:
// identity modifiers as booleans, identity variant, unrouted color as-is.
const daisyOk: DaisyProps = { wide: true, loading: true, variant: 'dash', color: 'primary' };
// @ts-expect-error — not a daisy variant (typo of 'primary', which is a COLOR here)
const daisyBogus: DaisyProps = { variant: 'primryy' };
// @ts-expect-error — heroui's vendor prop never existed on daisy's surface
const daisyForeign: DaisyProps = { isIconOnly: true };
// @ts-expect-error — the mods bag is replaced by the vendor booleans
const daisyMods: DaisyProps = { mods: { wide: true } };
// @ts-expect-error — glass was dropped from the modifier set (not in daisy 5)
const daisyGlass: DaisyProps = { glass: true };

// ── the base surface survives: unrouted props keep zero's typing ──
const passthrough: CarbonProps = { kind: 'primary', disabled: true, class: 'cta' };

// ── compound statics pass through the adapter ──
export type _tabsListPreserved = MustBeTrue<Equal<
    (typeof HerouiTabs)['List'] extends undefined ? false : true,
    true
>>;
const tabsRootOk: Parameters<(typeof HerouiTabs)['Root']>[0] = { size: 'md' };

export const _use = [
    carbonOk, herouiOk, respelled, carbonBogus, herouiBogus,
    carbonZeroName, carbonMods, herouiForeign, herouiColor, passthrough, tabsRootOk,
    daisyOk, daisyBogus, daisyForeign, daisyMods, daisyGlass,
];
