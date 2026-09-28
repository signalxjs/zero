/**
 * The `lend` prop (#452): `WithLend` accepts a real asChild bag
 * (`PartProps`), and only that. A hand-built object without the anatomy is
 * not a bag, and a part that is not an opt-in host has no `lend` at all.
 * The hosts (#494): `Button.Root` takes a lent bag, `Tooltip.Trigger` takes
 * one too so lenders chain, and spreading a bag onto a zero component stays
 * an error (`ReservedByZero`) — `lend={p}` is the spelling. Collapsible's
 * trigger (#453) is a host for its non-native mode.
 *
 * No runtime: a regression here is a compile error in `pnpm test:types`.
 */
import { component } from 'sigx';
import type { JSXElement } from 'sigx';
import { Button, Collapsible, Tabs, Tooltip } from '@sigx/zero';
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

// ── the hosts (#494) ──
export const button = <Button.Root lend={p} aria-label="Archive" />;
export const buttonFromTooltip = (
    <Tooltip.Trigger asChild>
        {(bag: PartProps) => <Button.Root lend={bag} aria-label="Archive">A</Button.Root>}
    </Tooltip.Trigger>
);
export const chained = (
    <Tooltip.Trigger asChild>
        {(t: PartProps) => (
            <Tooltip.Trigger asChild lend={t}>
                {(bag: PartProps) => <Button.Root lend={bag} aria-label="Archive">A</Button.Root>}
            </Tooltip.Trigger>
        )}
    </Tooltip.Trigger>
);

export const collapsible = (
    <Collapsible.Root native={false}>
        <Tooltip.Trigger asChild>
            {(t: PartProps) => (
                <Collapsible.Trigger asChild lend={t}>
                    {(c: PartProps) => <Button.Root lend={c} aria-label="Expand">v</Button.Root>}
                </Collapsible.Trigger>
            )}
        </Tooltip.Trigger>
    </Collapsible.Root>
);

// ── invalid ──
// @ts-expect-error — a bag spread onto a zero component: its anatomy is ReservedByZero; write lend={p}
export const e0 = <Button.Root {...p} />;
// @ts-expect-error — a bag, not a string
export const e1 = <Host lend="x" />;
// @ts-expect-error — no data-scope/data-part: not a part's bag
export const e2 = <Host lend={{ id: 'a' }} />;
// @ts-expect-error — Tabs.Tab is not a lend host
export const e3 = <Tabs.Tab value="a" lend={p}>A</Tabs.Tab>;
