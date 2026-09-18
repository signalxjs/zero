/**
 * The switcher bar.
 *
 * Built from zero's own components, so the control restyles itself along with
 * everything it controls — which is the whole claim: one anatomy, four skins,
 * no component code touched.
 */
import { component, signal } from 'sigx';
import { Button, listThemes, themeController, ToggleGroup } from '@sigx/zero';
import {
    activateDesignSystem,
    activeDesignSystemId,
    designSystems,
    pickVariant,
    type DesignSystemEntry,
} from './design-systems';

/**
 * A `string` model over a single-valued source — ToggleGroup's single-mode
 * model is the pressed value, `''` when none (#455).
 *
 * Bound as a tuple (`model={[m, 'value']}`) rather than the `() => state.x`
 * sugar because neither selection the toolbar renders lives in a signal shaped
 * like the model: the design system is whichever stylesheet the document
 * actually holds, and the theme is whatever the controller says. The getter
 * re-reads that source on every render, so a switch that fails to commit snaps
 * the selection back instead of leaving the toolbar claiming otherwise.
 *
 * `null` means "nothing selected" — the theme row's honest state while
 * following the system.
 */
const singleSelection = (read: () => string | null, write: (value: string) => void): { value: string } => ({
    get value(): string {
        return read() ?? '';
    },
    set value(next: string) {
        // Empty is meaningful on the way OUT — the getter answers `''` for "no
        // selection", which is the Theme row's honest state while following the
        // system — but there is nothing to write for it, and `write` takes a
        // name. With `deselectable={false}` the group never sends `''`; the
        // guard keeps a caller that does a no-op rather than `write('')`.
        if (next !== '') write(next);
    },
});

export const Toolbar = component(() => {
    const state = signal({
        // Mirrors the live stylesheet. Updated only AFTER the swap resolves,
        // so the theme list below never renders against a registry that is
        // still holding the previous design system's themes.
        ds: activeDesignSystemId() ?? designSystems[0]!.id,
        busy: false,
    });

    const switchTo = async (id: string): Promise<void> => {
        const entry = designSystems.find((d) => d.id === id);
        // Compare against the document, not the cached selection: if the first
        // load failed there is no link at all, and short-circuiting on
        // `state.ds` would make the seemingly-active item a dead retry.
        if (!entry || state.busy || entry.id === activeDesignSystemId()) return;
        state.busy = true;
        try {
            await activateDesignSystem(entry);
        } finally {
            // Read back what is actually in the document rather than assuming
            // the switch took: a stylesheet that failed to load leaves the
            // previous design system live, and the toolbar must say so.
            state.ds = activeDesignSystemId() ?? state.ds;
            state.busy = false;
        }
    };

    // Both selections read their source of truth, never a copy of it: the
    // design system through the mirror `switchTo` only writes after the swap
    // resolves, the theme straight off the controller.
    const dsSelection = singleSelection(() => state.ds, (id) => void switchTo(id));
    const themeSelection = singleSelection(
        () => themeController().theme(),
        (name) => themeController().setTheme(name),
    );

    return () => {
        const active: DesignSystemEntry =
            designSystems.find((d) => d.id === state.ds) ?? designSystems[0]!;
        // Read `state.ds` first (above) so this closure re-runs on a switch and
        // picks up the freshly re-seeded registry.
        const themes = listThemes();
        const current = themeController().theme();

        return (
            <header
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    marginBottom: '1.5rem',
                    borderRadius: 'var(--radius-box)',
                    background: 'var(--color-base-200)',
                    color: 'var(--color-base-content)',
                    opacity: state.busy ? 0.6 : 1,
                }}
            >
                {/*
                  * Which one is live is SELECTION, not colour. A variant pair
                  * would have to name values — `solid`/`outline` did — and no
                  * such pair exists across every vocabulary: carbon declares
                  * neither, so both halves fell through to the recipe base and
                  * all six buttons rendered identically. `on|off` on
                  * `data-state`, plus `data-selected` and `aria-pressed`, is
                  * carried by every design system because the anatomy requires
                  * it, and is the same claim to a screen reader as to the eye.
                  */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 'var(--text-sm)' }}>Design system</strong>
                    <ToggleGroup.Root
                        size="sm"
                        label="Design system"
                        model={[dsSelection, 'value']}
                        deselectable={false}
                        disabled={state.busy}
                    >
                        {designSystems.map((ds) => (
                            <ToggleGroup.Item value={ds.id}>{ds.label}</ToggleGroup.Item>
                        ))}
                    </ToggleGroup.Root>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 'var(--text-sm)' }}>Theme</strong>
                    <ToggleGroup.Root
                        size="sm"
                        label="Theme"
                        model={[themeSelection, 'value']}
                        deselectable={false}
                    >
                        {themes.map((theme) => (
                            <ToggleGroup.Item value={theme.name}>
                                <Swatch theme={theme.swatch} />
                                {theme.name}
                            </ToggleGroup.Item>
                        ))}
                    </ToggleGroup.Root>
                    {/*
                      * `system` is not a member of the theme selection — it is
                      * the absence of one, so it sits outside the group, and
                      * an empty group is exactly what following the system
                      * looks like. Here a variant IS the right expression, and
                      * it is picked from the live vocabulary rather than
                      * named: `solid` under the four that declare it,
                      * `primary` under heroui and carbon.
                      */}
                    <Button.Root
                        size="sm"
                        variant={current
                            ? pickVariant('ghost', 'outline', 'tertiary')
                            : pickVariant('solid', 'primary')}
                        onClick={() => themeController().setTheme(null)}
                    >
                        system
                    </Button.Root>
                </div>

                <p
                    style={{
                        margin: 0,
                        marginInlineStart: 'auto',
                        fontSize: 'var(--text-sm)',
                        opacity: 0.75,
                    }}
                >
                    {active.blurb}
                    {' — '}
                    <code>{current ?? 'system'}</code>
                    {' / '}
                    <code>{themeController().resolvedScheme()}</code>
                </p>
            </header>
        );
    };
}, { name: 'Toolbar' });

/**
 * Renders the `swatch` colors every design system already publishes through
 * `installThemes()` — until now, nothing in the repo read them.
 *
 * Whatever the registry holds is drawn, in order, rather than a fixed set of
 * role names: the swatch is derived from each design system's own declaration,
 * so material's thirteen-role vocabulary shows different colours here than
 * basic's eight. Hardcoding `primary`/`neutral` would render every design
 * system's themes identically — the thing that derivation exists to prevent.
 */
const Swatch = component<{ theme?: Record<string, string> }>(({ props }) => () => {
    const colors = Object.values(props.theme ?? {});
    if (!colors.length) return null;
    return (
        <span
            aria-hidden="true"
            style={{
                display: 'inline-flex',
                marginInlineEnd: '0.375rem',
                verticalAlign: 'middle',
                borderRadius: 'var(--radius-selector)',
                overflow: 'hidden',
                outline: '1px solid var(--color-base-300)',
            }}
        >
            {colors.map((color) => (
                <span style={{ width: '0.375rem', height: '0.75rem', background: color }} />
            ))}
        </span>
    );
}, { name: 'Swatch' });
