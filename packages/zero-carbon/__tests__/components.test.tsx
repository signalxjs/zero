/**
 * The runtime half of issue #183's gate: the api `values` remap, exercised
 * end to end through the same wiring the generated `components.js` ships.
 *
 * The spec fed to `adapt()` here is not hand-rolled — it is the compiled
 * `componentApi` the build emits, so this test renders through exactly the
 * data the `./components` module contains. Carbon's double-hyphen spelling
 * goes in at the prop; the kebab spelling the recipes matched comes out in
 * the DOM; the vendor spelling never appears anywhere in the rendered tree.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { Button } from '@sigx/zero';
import type { Adapted } from '@sigx/zero/adapt';
import { adapt } from '@sigx/zero/adapt';
import type { ManifestComponent } from '@sigx/zero-kit';
import { compileDesignSystem } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem, variants } from '@sigx/zero-carbon';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

// The spec the generated components.js inlines, straight from the compiler.
const compiled = compileDesignSystem(designSystem, manifest);
const buttonApi = compiled.componentApi!['button']!;

type CarbonKind = Exclude<(typeof variants)[number], 'danger-tertiary' | 'danger-ghost'>
    | 'danger--tertiary' | 'danger--ghost';
type CarbonButton = Adapted<typeof Button, 'color' | 'size' | 'variant' | 'axes' | 'mods', {
    kind?: CarbonKind;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    hasIconOnly?: boolean;
    isExpressive?: boolean;
}>;
const CarbonButtonRoot = adapt(Button, { props: buttonApi.props }) as unknown as CarbonButton;

describe('the values remap, at runtime', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    const root = () =>
        container.querySelector<HTMLButtonElement>('[data-scope="button"][data-part="root"]')!;

    it('compiles the remap into the button routing, inverted and identity-free', () => {
        expect(buttonApi.props['kind']).toEqual({
            axis: 'variant',
            values: { 'danger--ghost': 'danger-ghost', 'danger--tertiary': 'danger-tertiary' },
        });
        expect(buttonApi.props['hasIconOnly']).toEqual({ modifier: 'icon-only' });
        expect(buttonApi.props['isExpressive']).toEqual({ modifier: 'expressive' });
    });

    it('renders the vendor spelling as the kebab attribute the recipes matched', () => {
        render(<CarbonButtonRoot kind="danger--tertiary" hasIconOnly>×</CarbonButtonRoot>, container);
        expect(root().getAttribute('data-variant')).toBe('danger-tertiary');
        expect(root().getAttribute('data-mod-icon-only')).toBe('');
        // The vendor spelling never reaches the DOM, under any attribute.
        expect(container.innerHTML).not.toContain('danger--tertiary');
        expect(container.innerHTML).not.toContain('data-kind');
    });

    it('passes unremapped members through untouched', () => {
        render(<CarbonButtonRoot kind="ghost" size="sm" isExpressive>Add</CarbonButtonRoot>, container);
        expect(root().getAttribute('data-variant')).toBe('ghost');
        expect(root().getAttribute('data-size')).toBe('sm');
        expect(root().getAttribute('data-mod-expressive')).toBe('');
    });

    it('the compiled stylesheet matches what the adapter renders', () => {
        // The two halves of the same claim: the recipe emitted a selector for
        // the kebab spelling, and the adapter renders that exact attribute.
        expect(compiled.componentCss['button']).toContain(
            '[data-scope="button"][data-part="root"][data-variant="danger-tertiary"]',
        );
        expect(compiled.componentCss['button']).not.toContain('danger--tertiary');
    });
});
