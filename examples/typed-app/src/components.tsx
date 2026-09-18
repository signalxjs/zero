/**
 * Program (b): heroui's `./components` no-register surface (#326).
 *
 * The promise of the module: full narrowing with ZeroVocabulary untouched —
 * no `/register` import anywhere in this program. HeroUI is the
 * non-orthogonal acceptance case: no color axis at all, colour fused into a
 * seven-member `variant`, mods surfaced as vendor booleans
 * (`isIconOnly`/`isPending`). Checked against the EMITTED
 * `dist/components.d.ts` through package exports.
 */
import { component } from 'sigx';
import { Button, Tabs } from '@sigx/zero-heroui/components';

export const App = component(() => () => (
    <>
        {/* ── vendor props compile, narrowed to heroui's vocabulary ── */}
        <Button.Root variant="danger-soft" size="lg" isIconOnly>×</Button.Root>
        <Button.Root variant="ghost" isPending>Loading…</Button.Root>
        {/* compound statics survive the adapter */}
        <Tabs.Root size="md" defaultValue="one">
            <Tabs.List>
                <Tabs.Tab value="one">One</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="one">…</Tabs.Panel>
        </Tabs.Root>

        {/* ── wired means CLOSED, register or not ── */}
        <Button.Root
            /* @ts-expect-error — `solid` is not a heroui variant */
            variant="solid"
        >
            Nope
        </Button.Root>
        {/* heroui declares no color axis, so the prop is simply absent */}
        <Button.Root
            /* @ts-expect-error — no color prop on this surface */
            color="primary"
        >
            Nope
        </Button.Root>
        <Button.Root
            /* @ts-expect-error — Carbon's vendor name means nothing here */
            kind="ghost"
        >
            Nope
        </Button.Root>
        {/* the mods bag is replaced by the vendor booleans */}
        <Button.Root
            /* @ts-expect-error — no mods prop on this surface */
            mods={{ 'icon-only': true }}
        >
            Nope
        </Button.Root>
    </>
), { name: 'TypedApp.Components' });
