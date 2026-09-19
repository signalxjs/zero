/**
 * A part may re-carry an axis (#94): `PartSpec.carries`, the second carrier
 * in one scope. Timeline's marker is the shipped case — `Timeline.Marker
 * color` paints one entry's dot while the root keeps its own colour — and
 * this file holds every stage of the pipeline that had to learn the fact:
 * the merge, the validator, the compiler, the components artifact, the
 * axis-coverage rule and the contrast matrix.
 */
import { describe, it, expect } from 'vitest';
import {
    auditDesignSystem,
    axisHost,
    carriersOf,
    compileComponentsDts,
    compileComponentsJs,
    compileDesignSystem,
    compileRecipeCss,
    defineApi,
    indicatorCellsFor,
    mergeManifests,
    reachesCarrier,
    validateDesignSystem,
} from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent, ManifestFragment, RecipeInput } from '@sigx/zero-kit';
import { anatomies, defineAnatomy } from '@sigx/zero/anatomy';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { parseRules } from '../src/audit/css-rules.js';
import type { StyleNode } from '../src/audit/contrast/cascade.js';
import { computeChain } from '../src/audit/contrast/cascade.js';
import type { ThemeEnv } from '../src/audit/contrast/theme-env.js';

const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };
const timeline = manifest.components.find((c) => c.scope === 'timeline')!;

/**
 * A synthetic scope for the shapes timeline does not have: a re-carrier with
 * a part INSIDE it (`row` > `bubble`), and a rootless scope whose re-carrier
 * is a top-layer popup the carrier never contains.
 */
const railAnatomy = defineAnatomy('acme-rail', {
    'root': { element: 'div' },
    'row': { element: 'div', parent: 'root', carries: ['color'] },
    'bubble': { element: 'div', parent: 'row' },
    'label': { element: 'span', parent: 'root' },
});
const floatAnatomy = defineAnatomy('acme-float', {
    'trigger': { element: 'button' },
    'popup': { element: 'div', carries: ['color'] },
    'item': { element: 'div', parent: 'popup' },
});
const fragment = (): ManifestFragment => ({
    version: 1,
    package: '@acme/zero-rail',
    components: [railAnatomy.toJSON() as ManifestComponent, floatAnatomy.toJSON() as ManifestComponent],
});
const merged = () => mergeManifests(manifest, fragment());
const rail = () => merged().components.find((c) => c.scope === 'acme-rail')!;
const float = () => merged().components.find((c) => c.scope === 'acme-float')!;

const sel = (scope: string, part: string) => `[data-scope="${scope}"][data-part="${part}"]`;

describe('the anatomy fact', () => {
    it('timeline\'s marker declares it re-carries colour, and the manifest carries it', () => {
        expect(timeline.parts.find((p) => p.name === 'marker')!.carries).toEqual(['color']);
    });

    it('carriersOf walks the part tree up to the carrier, nearest first', () => {
        expect(carriersOf(timeline, 'marker', 'color')).toEqual(['marker']);
        expect(carriersOf(timeline, 'marker', 'size')).toEqual([]);
        expect(carriersOf(timeline, 'content', 'color')).toEqual([]);
        expect(carriersOf(rail(), 'bubble', 'color')).toEqual(['row']);
        expect(carriersOf(rail(), 'row', 'color')).toEqual(['row']);
        expect(carriersOf(rail(), 'label', 'color')).toEqual([]);
        expect(reachesCarrier(float(), 'item')).toBe(false);
        expect(reachesCarrier(rail(), 'bubble')).toBe(true);
    });
});

describe('mergeManifests holds a fragment\'s carries to the contract', () => {
    const withPart = (part: Record<string, unknown>): ManifestFragment => ({
        version: 1,
        package: '@acme/zero-evil',
        components: [{
            scope: 'acme-evil',
            parts: [
                { name: 'root', element: 'div', selectors: {} },
                { name: 'dot', element: 'span', parent: 'root', selectors: {}, ...part },
            ],
        } as ManifestComponent],
    });

    it('accepts a named axis on a rendered non-carrier part', () => {
        expect(() => mergeManifests(manifest, withPart({ carries: ['color', 'size'] }))).not.toThrow();
    });

    it('rejects a custom axis, an empty or repeated list, the carrier, and a pseudo part', () => {
        expect(() => mergeManifests(manifest, withPart({ carries: ['tone'] }))).toThrow(/not a named axis/);
        expect(() => mergeManifests(manifest, withPart({ carries: [] }))).toThrow(/not a non-empty array/);
        expect(() => mergeManifests(manifest, withPart({ carries: ['color', 'color'] }))).toThrow(/twice/);
        expect(() => mergeManifests(manifest, withPart({ carries: ['color'], parent: undefined, pseudo: { of: 'root', selector: '::before' } })))
            .toThrow(/pseudo part/);
        const onCarrier: ManifestFragment = {
            version: 1,
            package: '@acme/zero-evil',
            components: [{ scope: 'acme-evil', parts: [{ name: 'root', element: 'div', selectors: {}, carries: ['color'] }] } as ManifestComponent],
        };
        expect(() => mergeManifests(manifest, onCarrier)).toThrow(/is the scope's carrier/);
    });
});

describe('the web compiler: the nearest carrier wins', () => {
    const recipe: RecipeInput = {
        component: 'timeline',
        parts: {},
        variants: {
            color: {
                primary: { marker: { base: { '--timeline-accent': 'var(--color-primary)' } } },
                error: { marker: { base: { '--timeline-accent': 'var(--color-error)' } }, content: { base: { color: 'red' } } },
            },
            size: { lg: { marker: { base: { '--timeline-marker-size': '2rem' } } } },
        },
        compoundVariants: [{ match: { color: 'error', size: 'lg' }, parts: { marker: { base: { outline: '1px solid' } } } }],
        defaultVariants: { color: 'primary' },
    };
    const css = compileRecipeCss(recipe, timeline);
    const root = sel('timeline', 'root');
    const marker = sel('timeline', 'marker');

    it('keeps the carrier\'s donut and adds the rule flat on the re-carrying part', () => {
        expect(css).toContain(`@scope (${root}[data-color="error"]) to (${root}) {`);
        expect(css).toContain(`${marker}[data-color="error"] {`);
        expect(css).toContain(`${marker}[data-color="primary"] {`);
    });

    it('never mirrors the default onto the part: a marker without a colour follows its root', () => {
        expect(css).toContain(`@scope (${root}:not([data-color])) to (${root}) {`);
        expect(css).not.toContain(`${marker}:not([data-color])`);
    });

    it('re-carries only the declared axis, only on the declared part, and never through a compound', () => {
        expect(css).not.toContain(`${marker}[data-size="lg"]`);
        expect(css).not.toContain(`${sel('timeline', 'content')}[data-color="error"]`);
        expect(css).not.toMatch(/\[data-part="marker"\]\[data-color="error"\]\[data-size/);
    });

    it('reaches a part INSIDE a re-carrier through a donut rooted on it, bounded by the carrier and the next re-carrier', () => {
        const out = compileRecipeCss({
            component: 'acme-rail',
            parts: {},
            variants: { color: { error: { bubble: { base: { color: 'red' } } } } },
        }, rail());
        const r = sel('acme-rail', 'root');
        const row = sel('acme-rail', 'row');
        expect(out).toContain(`@scope (${r}[data-color="error"]) to (${r}) {`);
        expect(out).toContain(`@scope (${row}[data-color="error"]) to (${r}, ${row}) {`);
        // Source order agrees with proximity: the re-carrier's donut comes after the carrier's.
        expect(out.indexOf(`@scope (${row}`)).toBeGreaterThan(out.indexOf(`@scope (${r}`));
    });

    it('drops the dead carrier-anchored rule for a top-layer re-carrier, and emits its own', () => {
        const out = compileRecipeCss({
            component: 'acme-float',
            parts: {},
            variants: { color: { error: { popup: { base: { color: 'red' } }, item: { base: { color: 'maroon' } } } } },
        }, float());
        const trigger = sel('acme-float', 'trigger');
        const popup = sel('acme-float', 'popup');
        expect(out).toContain(`${popup}[data-color="error"] {`);
        expect(out).toContain(`@scope (${popup}[data-color="error"]) to (${trigger}, ${popup}) {`);
        expect(out).not.toContain(`@scope (${trigger}[data-color="error"])`);
    });

    it('the cascade reads the marker\'s own colour over the root\'s, and the root\'s where the marker has none', () => {
        // The static contrast matrix's cascade model — specificity, then
        // source order — over the shipped zero-basic CSS.
        const compiled = compileDesignSystem(basicDS as DesignSystemInput, manifest);
        const rules = parseRules(compiled.componentCss.timeline!);
        const env: ThemeEnv = { name: 't', colorScheme: 'light', colors: {}, props: {} };
        const chain = (rootColor: string, markerColor?: string): StyleNode[] => {
            const rootNode: StyleNode = {
                scope: 'timeline', part: 'root', element: 'ul', hasElementChildren: true,
                attrs: new Map([['data-scope', 'timeline'], ['data-part', 'root'], ['data-color', rootColor]]),
            };
            const item: StyleNode = {
                scope: 'timeline', part: 'item', element: 'li', hasElementChildren: true, parent: rootNode,
                attrs: new Map([['data-scope', 'timeline'], ['data-part', 'item']]),
            };
            const dot: StyleNode = {
                scope: 'timeline', part: 'marker', element: 'div', hasElementChildren: false, parent: item,
                attrs: new Map([['data-scope', 'timeline'], ['data-part', 'marker'], ...(markerColor ? [['data-color', markerColor] as [string, string]] : [])]),
            };
            return [rootNode, item, dot];
        };
        const accent = (nodes: StyleNode[]) => computeChain(nodes, rules, env)[2]!.boxes.self.decls.get('--timeline-accent')?.value;
        expect(accent(chain('neutral', 'error'))).toBe('var(--color-error)');
        expect(accent(chain('neutral'))).toBe('var(--color-neutral)');
    });
});

describe('the validator: a re-carrier\'s own rules are alive where the carrier cannot reach', () => {
    const ds = (recipe: RecipeInput): DesignSystemInput => ({
        name: 'float-test',
        recipes: [recipe],
        tokens: {
            roles: { error: {} },
            defaultLight: 'l',
            themes: { l: { colorScheme: 'light', colors: {
                'base-100': 'oklch(100% 0 0)', 'base-200': 'oklch(96% 0 0)', 'base-300': 'oklch(92% 0 0)',
                'base-content': 'oklch(20% 0 0)', error: 'oklch(50% 0.2 25)', 'error-content': 'oklch(98% 0.01 25)',
            } } },
        } as DesignSystemInput['tokens'],
    });

    it('does not call a colour rule on a re-carrying popup (or inside it) dead', () => {
        const result = validateDesignSystem(ds({
            component: 'acme-float',
            parts: { trigger: { base: { display: 'inline-flex' } } },
            variants: { color: { error: { popup: { base: { color: 'red' } }, item: { base: { color: 'maroon' } } } } },
        }), merged());
        expect(result.errors.filter((e) => /rules are dead/.test(e.message))).toEqual([]);
    });

    it('still does for an axis the popup does not carry, and for a modifier', () => {
        const result = validateDesignSystem(ds({
            component: 'acme-float',
            parts: { trigger: { base: { display: 'inline-flex' } } },
            modifiers: { flush: { popup: { base: { padding: '0' } } } },
        }), merged());
        expect(result.errors.some((e) => /rules are dead/.test(e.message))).toBe(true);
    });
});

describe('the components artifact: a re-carrying member takes the carrier\'s surface for its axes', () => {
    const toned = (): DesignSystemInput => ({
        ...(basicDS as DesignSystemInput),
        name: 'toned',
        api: defineApi({ color: { as: 'tone' } }),
    });

    it('records the member on the compiled api', () => {
        const compiled = compileDesignSystem(toned(), manifest);
        expect(compiled.componentApi!.timeline!.members).toEqual({ Marker: { part: 'marker', axes: ['color'] } });
        expect(compiled.componentApi!.button!.members).toBeUndefined();
    });

    it('types Marker under the vendor name, narrowed to the wired roles', () => {
        const dts = compileComponentsDts(compileDesignSystem(toned(), manifest));
        expect(dts).toContain("type TimelineMarkerAdapted = Adapted<typeof ZTimeline.Marker, 'color' | 'tone', {\n    'tone'?: 'primary'");
        expect(dts).toContain("Omit<AdaptedStatics<typeof ZTimeline>, 'Marker'> & { Root: TimelineAdapted; Marker: TimelineMarkerAdapted }");
    });

    it('adapts the member at runtime with the carried routes only', () => {
        const js = compileComponentsJs(compileDesignSystem(toned(), manifest));
        const call = js.slice(js.indexOf('export const Timeline'), js.indexOf('});', js.indexOf('export const Timeline')));
        expect(call).toContain("members: {\n        Marker: {\n            props: {\n                'tone': { axis: 'color' },");
    });

    it('drops the prop where the design system wires no such axis (a colourless skin)', () => {
        const colourless: DesignSystemInput = {
            ...(basicDS as DesignSystemInput),
            name: 'colourless',
            recipes: (basicDS as DesignSystemInput).recipes.map((r) => (r.component === 'timeline' ? { ...r, variants: { size: r.variants!.size! } } : r)),
            api: defineApi({ variants: [] }, {}),
        };
        const dts = compileComponentsDts(compileDesignSystem(colourless, manifest));
        expect(dts).toContain("type TimelineMarkerAdapted = Adapted<typeof ZTimeline.Marker, 'color', Record<never, never>>;");
        // Nothing routes, so nothing is adapted at runtime.
        expect(compileComponentsJs(compileDesignSystem(colourless, manifest))).not.toContain('members:');
    });
});

describe('axis-coverage: a re-carrier the recipe never keys', () => {
    it('reports scope.part.axis when the scope wires the axis but no value styles the part', () => {
        const ds = basicDS as DesignSystemInput;
        const recipes = ds.recipes.map((r) => (r.component !== 'timeline' ? r : {
            ...r,
            variants: { ...r.variants, color: Object.fromEntries(Object.keys(r.variants!.color!).map((c) => [c, { content: { base: { color: `var(--color-${c})` } } }])) },
        }));
        const findings = auditDesignSystem({ ...ds, recipes }, manifest, { rules: ['axis-coverage'] }).findings;
        const marker = findings.filter((f) => f.where === 'timeline.marker.color');
        expect(marker).toHaveLength(1);
        expect(marker[0]).toMatchObject({ scope: 'timeline', part: 'marker', axis: 'color', severity: 'warning' });
        // The shipped recipe keys it, so the shipped skin is clean.
        expect(auditDesignSystem(ds, manifest, { rules: ['axis-coverage'] }).findings.filter((f) => f.part === 'marker')).toEqual([]);
    });
});

describe('the contrast matrix measures the marker\'s own colour on the marker', () => {
    const compiled = compileDesignSystem(basicDS as DesignSystemInput, manifest);

    it('adds one indicator cell per wired colour, with the attribute on the re-carrying part', () => {
        const cells = indicatorCellsFor(manifest.components, compiled.components)
            .filter((c) => c.scope === 'timeline' && c.axes);
        expect(cells.map((c) => c.axes!.color).sort()).toEqual([...compiled.components.timeline!.color].sort());
        for (const cell of cells) expect(cell.chain[axisHost(cell.chain, 'color')]!.part).toBe('marker');
        // Without a design system's wiring there is no colour dimension to add.
        expect(indicatorCellsFor(manifest.components).some((c) => c.axes)).toBe(false);
    });

    it('every shipped basic cell clears the floor', () => {
        const result = auditDesignSystem(basicDS as DesignSystemInput, manifest, { rules: ['contrast/indicator'] });
        const carried = result.contrast.themes.flatMap((t) => t.cells).filter((c) => c.scope === 'timeline' && c.axes);
        expect(carried.length).toBeGreaterThan(0);
        expect(carried.filter((c) => c.verdict === 'fail')).toEqual([]);
    });
});
