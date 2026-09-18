/**
 * `adapt()` — the generic runtime behind vendor-named component modules
 * (issue #179).
 *
 * These tests use hand-rolled specs in the exact shape the kit generates
 * (`AdaptSpec`), so they double as the runtime half of the phase-2 gate:
 * vendor props in, zero attributes out, with the anatomy contract untouched.
 * The compound-statics case pins the `compound() === Object.assign` fact the
 * statics copy relies on — if sigx changes that, this fails loudly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { renderToString } from '@sigx/server-renderer';
import { component, signal } from 'sigx';
import { Button, Tabs } from '@sigx/zero';
import type { Adapted } from '@sigx/zero/adapt';
import { adapt } from '@sigx/zero/adapt';

// The runtime returns the base's own type — the narrow vendor surface is the
// generated components.d.ts's job. These aliases restate what the kit emits,
// so the tests exercise exactly the shape consumers get.
type ZeroAxisProp = 'color' | 'size' | 'variant' | 'axes' | 'mods';
type Vendor<T extends Record<string, unknown>, R extends string = ZeroAxisProp> =
    Adapted<typeof Button, R, T>;

/** Carbon-flavoured Button: variant → kind (respelled), renamed boolean mods. */
type CarbonFactory = Vendor<{
    kind?: 'primary' | 'ghost' | 'danger' | 'danger--tertiary';
    hasIconOnly?: boolean;
    isExpressive?: boolean;
    color?: string;
    size?: string;
}>;
const CarbonButton = adapt(Button, {
    props: {
        kind: { axis: 'variant', values: { 'danger--tertiary': 'danger-tertiary' } },
        hasIconOnly: { modifier: 'icon-only' },
        isExpressive: { modifier: 'expressive' },
    },
}) as unknown as CarbonFactory & { Root: CarbonFactory };

describe('adapt — routing', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    const root = () =>
        container.querySelector<HTMLButtonElement>('[data-scope="button"][data-part="root"]')!;

    it('renders a routed vendor prop as the zero attribute, never a vendor one', () => {
        render(<CarbonButton kind="ghost">Cancel</CarbonButton>, container);
        expect(root().getAttribute('data-variant')).toBe('ghost');
        expect(root().hasAttribute('data-kind')).toBe(false);
    });

    it('respells a vendor value back to the zero spelling the recipes matched', () => {
        render(<CarbonButton kind="danger--tertiary">Delete</CarbonButton>, container);
        expect(root().getAttribute('data-variant')).toBe('danger-tertiary');
    });

    it('folds vendor booleans into presence-only mod attributes', () => {
        render(
            <CarbonButton hasIconOnly isExpressive={false}>×</CarbonButton>,
            container,
        );
        expect(root().getAttribute('data-mod-icon-only')).toBe('');
        expect(root().hasAttribute('data-mod-expressive')).toBe(false);
    });

    it('routes a custom axis into the axes bag', () => {
        const AntButton = adapt(Button, { props: { shape: { axis: 'shape' } } }) as unknown as
            Vendor<{ shape?: 'circle' | 'round' }>;
        render(<AntButton shape="round">Go</AntButton>, container);
        expect(root().getAttribute('data-shape')).toBe('round');
    });

    it('a vendor prop shadowing a base prop is consumed, not leaked', () => {
        // Ant's `type` is its variant axis; zero-Button's `type` is the native
        // button type. The adapter must eat the vendor value — a native
        // type="primary" would silently make the button submit nothing.
        const AntButton = adapt(Button, { props: { type: { axis: 'variant' } } }) as unknown as
            Vendor<{ type?: 'primary' | 'dashed' | 'default' }, ZeroAxisProp | 'type'>;
        render(<AntButton type="primary">Go</AntButton>, container);
        expect(root().getAttribute('data-variant')).toBe('primary');
        expect(root().type).toBe('button');
    });

    it('passes everything unrouted through untouched', () => {
        const onClick = vi.fn();
        render(
            <CarbonButton kind="ghost" color="success" size="lg" disabled onClick={onClick}>
                Save
            </CarbonButton>,
            container,
        );
        expect(root().getAttribute('data-color')).toBe('success');
        expect(root().getAttribute('data-size')).toBe('lg');
        expect(root().hasAttribute('data-disabled')).toBe(true);
        root().click();
        expect(onClick).not.toHaveBeenCalled(); // disabled — the base wiring, intact
    });

    it('forwards slots — asChild renders the child with the routed anatomy', () => {
        render(
            <CarbonButton asChild kind="ghost">
                {(p: Record<string, unknown>) => <a href="/docs" {...p}>Docs</a>}
            </CarbonButton>,
            container,
        );
        const anchor = container.querySelector<HTMLAnchorElement>('a[data-scope="button"]')!;
        expect(anchor.getAttribute('data-variant')).toBe('ghost');
        expect(anchor.getAttribute('href')).toBe('/docs');
    });

    it('stays reactive through the renaming view', () => {
        const state = signal<{ kind: 'ghost' | 'danger'; iconOnly: boolean }>({ kind: 'ghost', iconOnly: false });
        const Host = component<Record<string, never>>(() => () => (
            <CarbonButton kind={state.kind} hasIconOnly={state.iconOnly}>Save</CarbonButton>
        ));
        render(<Host />, container);
        expect(root().getAttribute('data-variant')).toBe('ghost');
        expect(root().hasAttribute('data-mod-icon-only')).toBe(false);

        state.kind = 'danger';
        state.iconOnly = true;
        expect(root().getAttribute('data-variant')).toBe('danger');
        expect(root().getAttribute('data-mod-icon-only')).toBe('');
    });
});

describe('adapt — compound namespaces', () => {
    it('keeps the self-referential main (compound mutates main, so Root === the factory)', () => {
        // Pins the Object.assign(main, sub) fact the statics copy relies on.
        expect(Button.Root).toBe(Button);
        expect(CarbonButton.Root).toBe(CarbonButton);
        expect(CarbonButton).not.toBe(Button);
    });

    it('passes non-carrier parts through by identity', () => {
        const HTabs = adapt(Tabs, { props: { size: { axis: 'size' } } });
        expect(HTabs.Root).toBe(HTabs);
        expect(HTabs.List).toBe(Tabs.List);
        expect(HTabs.Tab).toBe(Tabs.Tab);
        expect(HTabs.Panel).toBe(Tabs.Panel);
    });

    it('an adapted compound renders and behaves through the carrier', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const HTabs = adapt(Tabs, { props: { size: { axis: 'size' } } });
        render(
            <HTabs.Root defaultValue="a" size="lg">
                <HTabs.List>
                    <HTabs.Tab value="a">First</HTabs.Tab>
                    <HTabs.Tab value="b">Second</HTabs.Tab>
                </HTabs.List>
                <HTabs.Panel value="a">Panel A</HTabs.Panel>
            </HTabs.Root>,
            container,
        );
        const tabsRoot = container.querySelector<HTMLElement>('[data-scope="tabs"][data-part="root"]')!;
        expect(tabsRoot.getAttribute('data-size')).toBe('lg');
        const tabs = container.querySelectorAll<HTMLElement>('[data-part="tab"]');
        tabs[1]!.click();
        expect(tabs[1]!.getAttribute('data-state')).toBe('active');
    });

    it('rejects a non-component', () => {
        expect(() => adapt({} as never, { props: {} })).toThrow(/component factory/);
    });

    it('renders through SSR with the routed attributes', async () => {
        const html = await renderToString(<CarbonButton kind="ghost" hasIconOnly>×</CarbonButton>);
        expect(html).toContain('data-variant="ghost"');
        expect(html).toContain('data-mod-icon-only');
        expect(html).not.toContain('data-kind');
    });
});
