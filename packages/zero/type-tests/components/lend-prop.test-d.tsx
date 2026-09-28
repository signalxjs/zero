/**
 * The `lend` prop (#452) before any zero part takes it: `WithLend` accepts a
 * real asChild bag (`PartProps`), and only that. A hand-built object without
 * the anatomy is not a bag, and a part that is not an opt-in host has no
 * `lend` at all. C1 adds the positive cases against `Button.Root`.
 *
 * No runtime: a regression here is a compile error in `pnpm test:types`.
 */
import { component } from 'sigx';
import type { JSXElement } from 'sigx';
import { Tabs, Tooltip } from '@sigx/zero';
import type { PartProps, WithLend } from '@sigx/zero';

const Host = component<WithLend>(() => () => null as unknown as JSXElement);

declare const p: PartProps;

// ── valid ──
export const lent = <Host lend={p} />;
export const unlent = <Host />;
export const fromSlot = (
    <Tooltip.Trigger asChild>
        {(bag: PartProps) => <Host lend={bag} />}
    </Tooltip.Trigger>
);

// ── invalid ──
// @ts-expect-error — a bag, not a string
export const e1 = <Host lend="x" />;
// @ts-expect-error — no data-scope/data-part: not a part's bag
export const e2 = <Host lend={{ id: 'a' }} />;
// @ts-expect-error — Tabs.Tab is not a lend host
export const e3 = <Tabs.Tab value="a" lend={p}>A</Tabs.Tab>;
