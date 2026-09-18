/**
 * The static contrast matrix (#403, slice C) — the browser contrast audit's
 * two matrices, computed from compiled CSS, as `contrast/*` audit rules.
 *
 * Three things are held here. The six in-repo skins clear the same floors
 * statically that they clear in the browser, with the cells the estimate
 * cannot judge confined to a named set of reasons per skin (so the estimate
 * cannot quietly retreat into `unmeasured`). The cell product is the browser
 * spec's: every paint-only part has a chain, and the chains the part tree
 * derives are the ones the spec's hand table declared. And each rule has
 * fixtures it MUST report — the browser findings that motivated the matrix
 * (#210, #116, #211, #207), plus one cell per `unmeasured` reason, each of
 * which must be reported as unmeasured and never as a pass.
 *
 * Red-first: with `measureText`/`measureIndicator` stubbed to a passing
 * reading, every fixture below went red before the real measurement went
 * back in (recorded in the PR).
 */
import { describe, it, expect } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import {
    INDICATORS, auditDesignSystem, indicatorChains, uncoveredPaintParts,
} from '@sigx/zero-kit';
import type {
    AuditRuleId, ContrastCell, DesignSystemInput, ManifestComponent, RecipeInput, TokensInput, UnmeasuredReason,
} from '@sigx/zero-kit';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { designSystem as daisyDS } from '@sigx/zero-daisyui';
import { designSystem as materialDS } from '@sigx/zero-material';
import { designSystem as brutalistDS } from '@sigx/zero-brutalist';
import { designSystem as herouiDS } from '@sigx/zero-heroui';
import { designSystem as carbonDS } from '@sigx/zero-carbon';

const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };
const CONTRAST: AuditRuleId[] = ['contrast/text', 'contrast/indicator', 'contrast/unmeasured'];

// ── The six skins ───────────────────────────────────────────────────────────

/**
 * What each skin is allowed not to measure — and only that. A new reason
 * appearing for a skin is a regression in the estimate or a new recipe
 * shape; either way it is looked at, not absorbed.
 */
const ALLOWED_UNMEASURED: Record<string, UnmeasuredReason[]> = {
    basic: [],
    // `+active` is `filter: brightness(0.92)`; the control fills carry daisy's
    // noise texture as a second background layer; the star preview brightens.
    daisyui: ['filter-or-blend', 'gradient-or-image'],
    material: [],
    brutalist: [],
    // The half star is a hard-stop gradient on `::before`.
    heroui: ['gradient-or-image'],
    carbon: [],
};

const skins: Array<[string, DesignSystemInput]> = [
    ['basic', basicDS], ['daisyui', daisyDS], ['material', materialDS],
    ['brutalist', brutalistDS], ['heroui', herouiDS], ['carbon', carbonDS],
];

// A full static matrix (daisyui: five themes, the largest cell count) runs
// past vitest's 5 s default under coverage instrumentation — the budget is
// for the instrumented run, not a sign the audit is slow.
const MATRIX_TIMEOUT = 30_000;

describe('the six skins clear the floors statically', () => {
    it.each(skins)('%s: no cell below 3:1, no disabled pair below 2:1', (_name, ds) => {
        const result = auditDesignSystem(ds, manifest, { rules: CONTRAST });
        const errors = result.findings.filter((f) => f.severity === 'error').map((f) => f.message);
        expect(errors).toEqual([]);
        expect(result.contrast.themes.length).toBeGreaterThan(0);
    }, MATRIX_TIMEOUT);

    it.each(skins)('%s: measures at least 85%% of its cells, and the rest for a named reason', (name, ds) => {
        const result = auditDesignSystem(ds, manifest, { rules: CONTRAST });
        for (const theme of result.contrast.themes) {
            const unmeasured = theme.cells.filter((c) => c.verdict === 'unmeasured');
            const share = (theme.cells.length - unmeasured.length) / theme.cells.length;
            expect(share, `${name}/${theme.name}: ${unmeasured.length} of ${theme.cells.length} unmeasured`).toBeGreaterThanOrEqual(0.85);
            expect(theme.cells.length).toBeGreaterThan(400);
            const reasons = [...new Set(unmeasured.map((c) => c.reason))].sort();
            expect(reasons, `${name}/${theme.name}`).toEqual([...ALLOWED_UNMEASURED[name]!].sort());
        }
    }, MATRIX_TIMEOUT);

    it('the axis surface rides the matrix: a variant-wiring scope contributes axis cells through its chains', () => {
        const result = auditDesignSystem(basicDS, manifest, { rules: CONTRAST, themes: ['basic'] });
        const cells = result.contrast.themes[0]!.cells;
        const select = cells.filter((c) => c.scope === 'select' && c.axes?.variant);
        expect(select.length).toBeGreaterThan(100);
        expect(select.some((c) => c.part === 'item' && c.axes?.color === 'error')).toBe(true);
    });

    it('a theme filter measures only that theme', () => {
        const result = auditDesignSystem(basicDS, manifest, { rules: CONTRAST, themes: ['basic-dark'] });
        expect(result.contrast.themes.map((t) => t.name)).toEqual(['basic-dark']);
    });
});

// ── The cell product ────────────────────────────────────────────────────────

describe('the cell product is the browser spec\'s', () => {
    it('every paint-only part the selection rule picks has an entry', () => {
        expect(uncoveredPaintParts(manifest.components)).toEqual([]);
    });

    it('the chains the part tree derives are the ones the spec declared by hand', () => {
        // The browser spec's `INDICATORS` table, ancestors outermost first,
        // as it stood when the table moved into the kit (#403). One entry
        // (`menu`) keeps a hand chain; every other row is derived.
        const hand: Record<string, string[]> = {
            'checkbox/indicator': ['root', 'control'],
            'radio-group/item-indicator': ['root', 'item', 'item-control'],
            'switch/thumb': ['root', 'control'],
            'progress/range': ['root', 'track'],
            'slider/range': ['root', 'track'],
            'slider/thumb': ['root', 'track'],
            'menu/item-indicator': ['popup=open', 'checkbox-item'],
            'select/indicator': ['root', 'trigger'],
            'select/item-indicator': ['root', 'popup=open', 'item'],
            'combobox/item-indicator': ['root', 'popup=open', 'item'],
            'tree-view/branch-indicator': ['root', 'tree', 'branch', 'branch-trigger'],
            'rating-group/item': ['root', 'control'],
            'spinner/root': [],
            'status/root': [],
            'timeline/marker': ['root', 'item'],
            'carousel/indicator': ['root', 'indicator-group'],
            'diff/handle': ['root'],
            'radial-progress/root': [],
            'pagination/prev-trigger': ['root'],
            'pagination/next-trigger': ['root'],
        };
        const derived = Object.fromEntries(indicatorChains(manifest.components).map(({ spec, ancestors }) => [`${spec.scope}/${spec.part}`, ancestors]));
        expect(derived).toEqual(hand);
        expect(INDICATORS.length).toBe(Object.keys(hand).length);
    });
});

// ── Fixtures: the browser findings that motivated the matrix ────────────────

const tokens = (over: Partial<TokensInput> = {}, colors: Record<string, string> = {}): TokensInput => ({
    roles: { primary: {}, neutral: {} },
    themes: {
        day: {
            colorScheme: 'light',
            colors: {
                'base-100': '#ffffff', 'base-200': '#eeeeee', 'base-300': '#e0e0e0', 'base-content': '#111111',
                primary: '#1d4ed8', 'primary-content': '#ffffff', neutral: '#444444', 'neutral-content': '#ffffff',
                ...colors,
            },
        },
    },
    defaultLight: 'day',
    ...over,
});

const fixture = (recipes: RecipeInput[], over: Partial<TokensInput> = {}, colors: Record<string, string> = {}): DesignSystemInput => ({
    name: 'fixture', tokens: tokens(over, colors), recipes,
});

const cellsOf = (ds: DesignSystemInput): ContrastCell[] =>
    auditDesignSystem(ds, manifest, { rules: CONTRAST }).contrast.themes[0]!.cells;
const rulesOf = (ds: DesignSystemInput): AuditRuleId[] =>
    auditDesignSystem(ds, manifest, { rules: CONTRAST }).findings.map((f) => f.rule);
const find = (cells: ContrastCell[], pick: (c: ContrastCell) => boolean): ContrastCell => {
    const cell = cells.find(pick);
    if (!cell) throw new Error(`no such cell among ${cells.length}`);
    return cell;
};

describe('contrast/text', () => {
    it('#210 verbatim: an outline button paints a raw role token as ink on a dark surface', () => {
        // A dark theme: the neutral role is a dark grey, fine as a FILL and
        // unreadable as INK on the dark page.
        const night = { 'base-100': '#111111', 'base-200': '#181818', 'base-300': '#222222', 'base-content': '#eeeeee', neutral: '#444444' };
        const ds = fixture([{
            component: 'button',
            parts: { root: { base: { color: 'var(--color-base-content)' } } },
            variants: { variant: { outline: { root: { base: { background: 'transparent', color: 'var(--color-neutral)' } } } } },
        }], { variants: ['outline'] }, night);
        const cell = find(cellsOf(ds), (c) => c.scope === 'button' && c.axes?.variant === 'outline' && !c.state && !c.flag);
        expect(cell.verdict).toBe('fail');
        expect(cell.ratio!).toBeLessThan(3);
        expect(rulesOf(ds)).toContain('contrast/text');

        // The twin: the same recipe reading the role's own content colour passes.
        const fixed = fixture([{
            component: 'button',
            parts: { root: { base: { color: 'var(--color-base-content)' } } },
            variants: { variant: { outline: { root: { base: { background: 'var(--color-neutral)', color: 'var(--color-neutral-content)' } } } } },
        }], { variants: ['outline'] }, night);
        expect(find(cellsOf(fixed), (c) => c.scope === 'button' && c.axes?.variant === 'outline' && !c.state && !c.flag).verdict).toBe('pass');
    });

    it('#116: the split pair — `highlighted` brings a colour, `open` only a background, and the combination is unreadable', () => {
        const ds = fixture([{
            component: 'menu',
            parts: {
                'sub-trigger': {
                    base: { color: 'var(--color-base-content)' },
                    // `open` is emitted after `highlighted`; at equal specificity
                    // it wins the background and inherits highlighted's white ink.
                    states: { highlighted: { background: '#111111', color: '#ffffff' }, open: { background: '#ffffff' }, closed: {} },
                },
            },
        }]);
        const cells = cellsOf(ds);
        expect(find(cells, (c) => c.part === 'sub-trigger' && c.state === 'open' && c.flag === 'highlighted').verdict).toBe('fail');
        expect(find(cells, (c) => c.part === 'sub-trigger' && !c.state && c.flag === 'highlighted').verdict).toBe('pass');
        expect(find(cells, (c) => c.part === 'sub-trigger' && c.state === 'open' && !c.flag).verdict).toBe('pass');
    });

    it('#207: a disabled label answers to the 2:1 floor on the pair BEFORE its fade', () => {
        const ds = fixture([{
            component: 'field',
            parts: {
                label: {
                    base: { color: 'var(--color-base-content)' },
                    states: { disabled: { color: 'var(--color-base-300)', background: 'var(--color-base-200)', opacity: 'var(--disabled-opacity)' }, invalid: {}, required: {} },
                },
            },
        }]);
        const cell = find(cellsOf(ds), (c) => c.scope === 'field' && c.part === 'label' && c.flag === 'disabled');
        expect(cell.verdict).toBe('disabled-fail');
        expect(cell.inGroup!).toBeLessThan(2);
        const finding = auditDesignSystem(ds, manifest, { rules: CONTRAST }).findings.find((f) => f.cell === cell.key)!;
        expect(finding.severity).toBe('error');
        expect(finding.message).toMatch(/before the state's fade/);
    });

    it('3–4.5:1 is a warning, not an error', () => {
        const ds = fixture([{ component: 'badge', parts: { root: { base: { color: '#8a8a8a' } } } }]);
        const cell = find(cellsOf(ds), (c) => c.scope === 'badge' && !c.state && !c.flag);
        expect(cell.verdict).toBe('warn');
        const finding = auditDesignSystem(ds, manifest, { rules: CONTRAST }).findings.find((f) => f.cell === cell.key)!;
        expect(finding.severity).toBe('warning');
    });

    it('the band is one finding per (part, theme), naming the worst cell — the table keeps every reading', () => {
        // Muted ink on the root and a darker one under `data-variant="solid"`:
        // two cells in the band, one finding, the lower ratio in front.
        const ds = fixture([{
            component: 'badge',
            parts: { root: { base: { color: '#8a8a8a' } } },
            variants: { variant: { solid: { root: { base: { color: '#767676' } } }, soft: { root: { base: { color: '#8a8a8a' } } } } },
        }], { variants: ['solid', 'soft'] });
        const result = auditDesignSystem(ds, manifest, { rules: CONTRAST });
        const warn = result.contrast.themes[0]!.cells.filter((c) => c.scope === 'badge' && c.verdict === 'warn');
        expect(warn.length).toBeGreaterThan(1);
        const findings = result.findings.filter((f) => f.rule === 'contrast/text' && f.scope === 'badge');
        expect(findings.length).toBe(1);
        expect(findings[0]!.severity).toBe('warning');
        expect(findings[0]!.message).toMatch(new RegExp(`\\(${warn.length} cells, worst shown\\)`));
        expect(findings[0]!.contrast!.ratio).toBe(Math.min(...warn.map((c) => c.ratio!)));
        expect(result.summary.warnings).toBe(1);
    });

    it('a non-text mark in the band is a note, not a warning — 3:1 is WCAG 1.4.11', () => {
        const ds = fixture([{
            component: 'checkbox',
            parts: {
                control: { base: { background: '#ffffff' }, states: { checked: {}, unchecked: {}, indeterminate: {} } },
                indicator: { base: { background: '#8a8a8a' }, states: { checked: {}, unchecked: {}, indeterminate: {} } },
            },
        }]);
        const result = auditDesignSystem(ds, manifest, { rules: CONTRAST });
        const cell = find(result.contrast.themes[0]!.cells, (c) => c.part === 'indicator' && c.state === 'checked');
        expect(cell.verdict).toBe('warn');
        const finding = result.findings.find((f) => f.rule === 'contrast/indicator' && f.part === 'indicator')!;
        expect(finding.severity).toBe('info');
        expect(result.summary.warnings).toBe(0);
        expect(result.summary.errors).toBe(0);
    });
});

describe('contrast/indicator', () => {
    it('#211: a white dot over an unfilled control on a white page reads ~1:1', () => {
        const ds = fixture([{
            component: 'radio-group',
            parts: {
                'item-control': { base: { border: '1px solid var(--color-neutral)' }, states: { checked: {}, unchecked: {} } },
                'item-indicator': { base: { background: '#ffffff' }, states: { checked: {}, unchecked: { transform: 'scale(0)' } } },
            },
        }]);
        const cells = cellsOf(ds);
        const checked = find(cells, (c) => c.part === 'item-indicator' && c.state === 'checked');
        expect(checked.verdict).toBe('fail');
        expect(checked.carrier).toBe('background');
        expect(checked.ratio).toBe(1);
        // The unchecked dot is scaled away: not a contrast problem, the state working.
        expect(find(cells, (c) => c.part === 'item-indicator' && c.state === 'unchecked').verdict).toBe('unpainted');
        expect(rulesOf(ds)).toContain('contrast/indicator');
    });

    it('a mark drawn on a pseudo-element with a stroke is measured through that carrier', () => {
        const ds = fixture([{
            component: 'checkbox',
            parts: {
                control: { base: { background: 'var(--color-primary)' }, states: { checked: {}, unchecked: {}, indeterminate: {} } },
                indicator: {
                    base: {},
                    states: { checked: {}, unchecked: {}, indeterminate: {} },
                    selectors: { '&[data-state="checked"]::after': { content: '""', display: 'block', width: '4px', height: '8px', border: '2px solid #ffffff' } },
                },
            },
        }]);
        const cell = find(cellsOf(ds), (c) => c.part === 'indicator' && c.state === 'checked');
        expect(cell.verdict).toBe('pass');
        expect(cell.carrier).toBe('border::after');
    });
});

describe('contrast/unmeasured — never a silent pass', () => {
    const cases: Array<[UnmeasuredReason, RecipeInput, (c: ContrastCell) => boolean]> = [
        ['gradient-or-image', { component: 'badge', parts: { root: { base: { background: 'linear-gradient(red, blue)', color: '#ffffff' } } } }, (c) => c.scope === 'badge'],
        ['unresolved-var', { component: 'badge', parts: { root: { base: { color: 'var(--nope)' } } } }, (c) => c.scope === 'badge'],
        ['runtime-property', { component: 'badge', parts: { root: { base: { color: 'var(--press-x)' } } } }, (c) => c.scope === 'badge'],
        ['unsupported-selector', { component: 'badge', parts: { root: { base: { color: '#111111' }, selectors: { '&:nth-child(2n)': { color: '#ffffff' } } } } }, (c) => c.scope === 'badge'],
        ['unparseable-color', { component: 'badge', parts: { root: { base: { color: 'oklch(calc(1rem) 0 0)' } } } }, (c) => c.scope === 'badge'],
        ['filter-or-blend', { component: 'badge', parts: { root: { base: { color: '#111111', filter: 'brightness(0.9)' } } } }, (c) => c.scope === 'badge'],
        ['raw-css', { component: 'badge', parts: { root: { base: { color: '#111111' } } }, css: '[data-scope="badge"][data-part="root"], & .x { color: #ffffff; }' }, (c) => c.scope === 'badge'],
        ['conditional-rule', { component: 'badge', parts: { root: { base: { color: '#111111' }, at: { '@supports (display: grid)': { base: { color: '#ffffff' } } } } } }, (c) => c.scope === 'badge'],
        // An unreadable rule may address a pseudo-element the self reading
        // never touches: the glyph it declares must taint the `::after` box,
        // not only `self`, or the mark measures through its background alone
        // and passes on a reading that never saw the glyph.
        ['raw-css', {
            component: 'checkbox',
            parts: {
                control: { base: { background: '#ffffff' }, states: { checked: {}, unchecked: {}, indeterminate: {} } },
                indicator: { base: { background: '#000000' }, states: { checked: {}, unchecked: {}, indeterminate: {} } },
            },
            css: '& [data-part="indicator"]::after { content: "x"; }',
        }, (c) => c.part === 'indicator'],
        ['unknown-geometry', {
            component: 'checkbox',
            parts: {
                control: { base: {}, states: { checked: {}, unchecked: {}, indeterminate: {} } },
                indicator: { base: { background: 'var(--color-primary)', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)' }, states: { checked: {}, unchecked: {}, indeterminate: {} } },
            },
        }, (c) => c.part === 'indicator'],
    ];

    it.each(cases)('%s is reported, once per (scope, part, reason), and the cell is not a pass', (reason, recipe, pick) => {
        const result = auditDesignSystem(fixture([recipe]), manifest, { rules: CONTRAST });
        const cells = result.contrast.themes[0]!.cells.filter(pick);
        expect(cells.length).toBeGreaterThan(0);
        for (const cell of cells) {
            expect(cell.verdict, cell.key).toBe('unmeasured');
            expect(cell.reason, cell.key).toBe(reason);
        }
        const info = result.findings.filter((f) => f.rule === 'contrast/unmeasured');
        expect(info.length).toBe(1);
        expect(info[0]!.severity).toBe('info');
        expect(info[0]!.reason).toBe(reason);
        expect(info[0]!.message).toMatch(new RegExp(`${cells.length} cell\\(s\\)`));
        // `info` never counts against the design system.
        expect(result.summary.errors).toBe(0);
        expect(result.summary.info).toBe(1);
    });

    it('the chained cell budget is a ceiling, tripped rather than silently applied', () => {
        expect(() => auditDesignSystem(basicDS, manifest, { rules: CONTRAST, axisCellBudget: 10 }))
            .toThrow(/chained axis cells .* exceed the budget \(10\)/);
    });
});

describe('conditional rules are decided against the reference page, never skipped', () => {
    // White ink on the white surface: 1:1 if the rule applies, a clean pass
    // on the #111 base if it does not. The verdict says which the model chose.
    type At = NonNullable<RecipeInput['parts'][string]['at']>;
    const conditional = (at: At, over: Partial<TokensInput> = {}): ContrastCell =>
        find(cellsOf(fixture([{ component: 'badge', parts: { root: { base: { color: '#111111' }, at } } }], over)), (c) => c.scope === 'badge' && !c.state && !c.flag && !c.axes);

    it('a min-width breakpoint the 1280px page meets applies — the browser matrix sees it too', () => {
        const cell = conditional({ sm: { base: { color: '#ffffff' } } }, { breakpoints: { sm: '640px' } });
        expect(cell.verdict).toBe('fail');
        expect(cell.ratio).toBe(1);
    });

    it('a min-width the page does not meet, a max-width it exceeds, and the preference queries do not apply', () => {
        const never: At[] = [
            { '@media (min-width: 1440px)': { base: { color: '#ffffff' } } },
            { '@media (max-width: 600px)': { base: { color: '#ffffff' } } },
            { 'hover-none': { base: { color: '#ffffff' } } },
            { 'reduced-motion': { base: { color: '#ffffff' } } },
            { 'forced-colors': { base: { color: '#ffffff' } } },
            { 'prefers-dark': { base: { color: '#ffffff' } } },
            { print: { base: { color: '#ffffff' } } },
            { '@starting-style': { base: { color: '#ffffff' } } },
        ];
        for (const at of never) {
            const cell = conditional(at);
            expect(cell.verdict, JSON.stringify(at)).toBe('pass');
        }
    });

    it('a rem breakpoint and the range syntax resolve against the same page', () => {
        expect(conditional({ '@media (min-width: 40rem)': { base: { color: '#ffffff' } } }).verdict).toBe('fail');
        expect(conditional({ '@media (width >= 600px)': { base: { color: '#ffffff' } } }).verdict).toBe('fail');
        expect(conditional({ '@media (400px < width < 900px)': { base: { color: '#ffffff' } } }).verdict).toBe('pass');
    });

    it('a query the page cannot decide is unmeasured, not a pass', () => {
        const undecidable: At[] = [
            { '@media (min-width: 50vw)': { base: { color: '#ffffff' } } },
            { '@media (color-gamut: p3)': { base: { color: '#ffffff' } } },
            { '@container (min-width: 300px)': { base: { color: '#ffffff' } } },
        ];
        for (const at of undecidable) {
            const cell = conditional(at);
            expect(cell.verdict, JSON.stringify(at)).toBe('unmeasured');
            expect(cell.reason).toBe('conditional-rule');
        }
    });
});
