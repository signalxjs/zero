/**
 * A part may MIRROR its carrier's axes (#514): `PartSpec.mirrorsAxes`. The
 * fragment-rooted scopes (dialog, popover, tooltip, menu, hover-card, drawer)
 * carry their axis props on the trigger, and the runtime copies every axis
 * attribute the trigger renders onto the popup — a top-layer sibling no
 * selector rooted on the trigger can reach. This file holds every pipeline
 * stage that had to learn the fact: the merge, the tree walks, the compiler,
 * the validator and the contrast cell product.
 */
import { describe, it, expect } from 'vitest';
import {
    axisAnchor,
    axisCellsFor,
    carriersOf,
    compileRecipeCss,
    derivedChainAncestors,
    mergeManifests,
    textCells,
    validateDesignSystem,
} from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent, ManifestFragment, RecipeInput } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';

const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };
const scope = (name: string) => manifest.components.find((c) => c.scope === name)!;
const sel = (s: string, part: string) => `[data-scope="${s}"][data-part="${part}"]`;

describe('the anatomy fact', () => {
    it('each fragment-rooted scope\'s popup mirrors its trigger, and the manifest carries it', () => {
        const mirroring = manifest.components.flatMap((c) =>
            c.parts.filter((p) => p.mirrorsAxes).map((p) => `${c.scope}.${p.name}`));
        expect(mirroring.sort()).toEqual([
            'dialog.popup', 'drawer.panel', 'hover-card.popup', 'menu.popup', 'popover.popup', 'tooltip.popup',
        ]);
    });

    it('axisAnchor walks up to the carrier or the nearest mirroring part', () => {
        const dialog = scope('dialog');
        expect(axisAnchor(dialog, 'trigger')).toBe('trigger');
        expect(axisAnchor(dialog, 'popup')).toBe('popup');
        expect(axisAnchor(dialog, 'title')).toBe('popup');
        expect(axisAnchor(dialog, 'close')).toBe('popup');
        // A submenu sits inside the root popup.
        expect(axisAnchor(scope('menu'), 'sub-popup')).toBe('popup');
        expect(axisAnchor(scope('menu'), 'group-label')).toBe('popup');
        // Top-level parts that neither are the carrier nor mirror it.
        expect(axisAnchor(scope('popover'), 'anchor')).toBeUndefined();
        expect(axisAnchor(scope('menu'), 'context-trigger')).toBeUndefined();
        // A root-carrying scope is untouched.
        expect(axisAnchor(scope('timeline'), 'marker')).toBe('root');
    });

    it('carriersOf stops at a mirroring part like it stops at the carrier', () => {
        expect(carriersOf(scope('dialog'), 'title', 'color')).toEqual([]);
    });
});

describe('mergeManifests holds a fragment\'s mirrorsAxes to the contract', () => {
    const withPopup = (popup: Record<string, unknown>): ManifestFragment => ({
        version: 1,
        package: '@acme/zero-float',
        components: [{
            scope: 'acme-float',
            parts: [
                { name: 'trigger', element: 'button', selectors: {} },
                { name: 'popup', element: 'div', selectors: {}, ...popup },
                { name: 'item', element: 'div', parent: 'popup', selectors: {} },
            ],
        } as ManifestComponent],
    });

    it('accepts a top-level sibling of the carrier', () => {
        expect(() => mergeManifests(manifest, withPopup({ mirrorsAxes: true }))).not.toThrow();
    });

    it('rejects a non-true value, the carrier, a nested part, a pseudo, an absorbable part and carries', () => {
        expect(() => mergeManifests(manifest, withPopup({ mirrorsAxes: false }))).toThrow(/presence-only/);
        expect(() => mergeManifests(manifest, withPopup({ mirrorsAxes: true, parent: 'trigger' }))).toThrow(/declares a parent/);
        expect(() => mergeManifests(manifest, withPopup({ mirrorsAxes: true, carries: ['color'] }))).toThrow(/every axis already/);
        expect(() => mergeManifests(manifest, withPopup({ mirrorsAxes: true, pseudo: { of: 'trigger', selector: '::after' } })))
            .toThrow(/"pseudo"/);
        const onCarrier: ManifestFragment = {
            version: 1,
            package: '@acme/zero-float',
            components: [{ scope: 'acme-float', parts: [{ name: 'trigger', element: 'button', selectors: {}, mirrorsAxes: true }] } as ManifestComponent],
        };
        expect(() => mergeManifests(manifest, onCarrier)).toThrow(/is the scope's carrier/);
    });
});

describe('the web compiler anchors a popup\'s axis rules on the popup', () => {
    const recipe: RecipeInput = {
        component: 'dialog',
        parts: {},
        variants: {
            variant: {
                basic: { popup: { base: { maxWidth: '35rem' } } },
                'full-screen': {
                    trigger: { base: { fontWeight: '700' } },
                    popup: { base: { width: '100%' } },
                    title: { base: { fontSize: '1.5rem' } },
                },
            },
        },
        modifiers: { dense: { popup: { base: { padding: '0' } } } },
        compoundVariants: [{ match: { variant: 'full-screen', dense: true }, parts: { footer: { base: { gap: '0' } } } }],
        defaultVariants: { variant: 'basic' },
    };
    const css = compileRecipeCss(recipe, scope('dialog'));
    const popup = sel('dialog', 'popup');
    const trigger = sel('dialog', 'trigger');

    it('emits the popup\'s own rule flat on its mirrored attribute', () => {
        expect(css).toContain(`${popup}[data-variant="full-screen"] {`);
        expect(css).toContain(`${popup}[data-mod-dense] {`);
    });

    it('keeps the trigger\'s rule flat on the trigger', () => {
        expect(css).toContain(`${trigger}[data-variant="full-screen"] {`);
    });

    it('reaches a part inside the popup through a donut rooted on the popup', () => {
        expect(css).toContain(`@scope (${popup}[data-variant="full-screen"]) to (${popup}) {`);
        expect(css).toContain(`@scope (${popup}[data-variant="full-screen"][data-mod-dense]) to (${popup}) {`);
    });

    it('mirrors the CSS-only default onto the popup as the absence of the attribute', () => {
        expect(css).toContain(`${popup}:not([data-variant]) {`);
    });

    it('never roots a popup rule on the trigger, where it could not match', () => {
        expect(css).not.toContain(`@scope (${trigger}`);
    });
});

describe('the validator: a mirroring popup\'s rules are alive', () => {
    const ds = (recipe: RecipeInput): DesignSystemInput => ({
        name: 'mirror-test',
        recipes: [recipe],
        tokens: {
            roles: { error: {} },
            variants: ['wide'],
            modifiers: ['flush'],
            defaultLight: 'l',
            themes: { l: { colorScheme: 'light', colors: {
                'base-100': 'oklch(100% 0 0)', 'base-200': 'oklch(96% 0 0)', 'base-300': 'oklch(92% 0 0)',
                'base-content': 'oklch(20% 0 0)', error: 'oklch(50% 0.2 25)', 'error-content': 'oklch(98% 0.01 25)',
            } } },
        } as DesignSystemInput['tokens'],
    });

    it('does not call a variant, a modifier or a compound on the popup (or inside it) dead', () => {
        const result = validateDesignSystem(ds({
            component: 'tooltip',
            parts: { trigger: { base: { display: 'inline-flex' } } },
            variants: { variant: { wide: { popup: { base: { maxWidth: '20rem' } }, arrow: { base: { width: '1rem' } } } } },
            modifiers: { flush: { popup: { base: { padding: '0' } } } },
        }), manifest);
        expect(result.errors.filter((e) => /rules are dead/.test(e.message))).toEqual([]);
    });

    it('still does for a top-level part that mirrors nothing', () => {
        const result = validateDesignSystem(ds({
            component: 'popover',
            parts: { trigger: { base: { display: 'inline-flex' } } },
            modifiers: { flush: { anchor: { base: { padding: '0' } } } },
        }), manifest);
        expect(result.errors.some((e) => /rules are dead/.test(e.message))).toBe(true);
    });
});

describe('the contrast cells root a popup\'s chains on the popup', () => {
    it('derives a chain from the popup down, with the popup pinned open', () => {
        const dialog = scope('dialog');
        const title = dialog.parts.find((p) => p.name === 'title')!;
        const popup = dialog.parts.find((p) => p.name === 'popup')!;
        expect(derivedChainAncestors(dialog, title)).toEqual(['popup=open']);
        expect(derivedChainAncestors(dialog, popup)).toEqual([]);
        const menu = scope('menu');
        expect(derivedChainAncestors(menu, menu.parts.find((p) => p.name === 'group-label')!)).toEqual(['popup=open', 'group']);
    });

    it('measures a popup\'s text inside the popup in the text matrix', () => {
        const title = textCells([scope('dialog')]).filter((c) => c.part === 'title');
        expect(title.length).toBeGreaterThan(0);
        for (const cell of title) expect(cell.chain?.map((n) => n.part)).toEqual(['popup', 'title']);
    });

    it('puts a variant-wiring overlay\'s popup in the axis product, as a probe carrying the axes', () => {
        const cells = axisCellsFor({ tooltip: { variant: ['plain', 'rich'] } }, manifest.components);
        const popup = cells.filter((c) => c.part === 'popup');
        expect(popup.map((c) => c.axes?.variant)).toEqual(expect.arrayContaining(['plain', 'rich']));
        for (const cell of popup) expect(cell.chain).toBeUndefined();
        const dialog = axisCellsFor({ dialog: { variant: ['basic', 'full-screen'] } }, manifest.components);
        const title = dialog.filter((c) => c.part === 'title');
        expect(title.length).toBeGreaterThan(0);
        for (const cell of title) expect(cell.chain?.[0]?.part).toBe('popup');
    });
});
