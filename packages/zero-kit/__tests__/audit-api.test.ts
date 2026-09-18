/**
 * `auditDesignSystem` — the API contract, and every rule's teeth through it.
 *
 * The four guard files this audit was lifted from each keep their own teeth
 * against the primitives. This file asks the same questions THROUGH the
 * public function, on synthetic design systems compiled by the real
 * compiler: one fixture per rule that MUST produce the finding, and a
 * passing twin that must not — so a rule wired into the registry but
 * returning nothing would fail here rather than pass by silence. Then the
 * things only the aggregate has: severity → rule → where ordering, the
 * `rules` filter, the `compiled` short-cut, the waiver list, and
 * `formatAudit`.
 *
 * Red-first (#403): each fixture was run with the rule's `run` stubbed to
 * `[]`, and the assertion went red before the real rule went back in. The
 * mutations are recorded in the PR.
 */
import { describe, it, expect } from 'vitest';
import { AUDIT_RULES, auditDesignSystem, compileDesignSystem, formatAudit } from '@sigx/zero-kit';
import type { AuditRuleId, DesignSystemInput, ManifestComponent, PartStyles, RecipeInput, TokensInput } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

/** A one-theme token set the compiler accepts; `roles`/`sizes`/`scopes` override per fixture. */
const tokens = (over: Partial<TokensInput> = {}): TokensInput => ({
    roles: { primary: {} },
    themes: {
        day: {
            colorScheme: 'light',
            colors: {
                'base-100': 'white', 'base-200': 'white', 'base-300': 'white',
                'base-content': 'black', primary: 'blue', 'primary-content': 'white',
            },
        },
    },
    defaultLight: 'day',
    ...over,
});

const fixture = (recipes: RecipeInput[], over: Partial<TokensInput> = {}): DesignSystemInput => ({
    name: 'fixture',
    tokens: tokens(over),
    recipes,
});

const rulesOf = (ds: DesignSystemInput, rules?: AuditRuleId[]): AuditRuleId[] =>
    auditDesignSystem(ds, manifest, rules ? { rules } : {}).findings.map((f) => f.rule);

// ── state legibility ────────────────────────────────────────────────────────

/** A control that says "selected" without saying which kind — as they all do. */
const control: PartStyles = {
    base: { width: '1rem', height: '1rem', border: '1px solid gray' },
    states: { checked: { background: 'blue' }, indeterminate: { background: 'blue' }, unchecked: {} },
};

/** #212 verbatim: three declared states, one empty box, nothing drawn. */
const blind: PartStyles = {
    base: { width: '100%', height: '100%' },
    states: { checked: {}, unchecked: {}, indeterminate: {} },
};

const drawn: PartStyles = {
    ...blind,
    states: {
        checked: { clipPath: 'polygon(0 0, 100% 0, 100% 100%)' },
        indeterminate: { clipPath: 'polygon(0 40%, 100% 40%, 100% 60%, 0 60%)' },
        unchecked: { clipPath: 'polygon(0 0, 0 0, 0 0)' },
    },
};

/** #220 verbatim: a header that is byte-identical open and closed. */
const blindTrigger: PartStyles = {
    base: { display: 'flex', justifyContent: 'space-between', padding: '1rem' },
    states: { open: {}, closed: {} },
};

describe('state-legibility through the audit', () => {
    it('reports #212 — a checkbox whose indicator draws nothing — on both rules', () => {
        const ds = fixture([{ component: 'checkbox', parts: { control, indicator: blind } }]);
        const result = auditDesignSystem(ds, manifest, {
            rules: ['state-legibility/component', 'state-legibility/indicator'],
        });
        expect(result.findings.map((f) => [f.rule, f.where])).toEqual([
            ['state-legibility/component', 'checkbox'],
            ['state-legibility/indicator', 'checkbox.indicator'],
        ]);
        const indicator = result.findings[1]!;
        expect(indicator.severity).toBe('error');
        expect(indicator.scope).toBe('checkbox');
        expect(indicator.part).toBe('indicator');
        expect(indicator.states).toEqual(expect.arrayContaining(['checked', 'indeterminate', 'unchecked']));
        expect(indicator.message).toContain('"checked"/"indeterminate"');
        expect(result.summary).toEqual({
            errors: 2, warnings: 0, info: 0,
            byRule: { 'state-legibility/component': 1, 'state-legibility/indicator': 1 },
        });
    });

    it('accepts the twin whose indicator draws a mark', () => {
        const ds = fixture([{ component: 'checkbox', parts: { control, indicator: drawn } }]);
        expect(rulesOf(ds, ['state-legibility/component', 'state-legibility/indicator'])).toEqual([]);
    });

    it('lists what skipStates excused as a waiver, not a finding', () => {
        const ds = fixture([{
            component: 'checkbox',
            parts: { control, indicator: blind },
            skipStates: { indicator: ['checked', 'unchecked', 'indeterminate'] },
        }]);
        const result = auditDesignSystem(ds, manifest, { rules: ['state-legibility/indicator'] });
        expect(result.findings).toEqual([]);
        expect(result.waived.length).toBeGreaterThan(0);
        expect(result.waived.every((w) => w.waivedBy.mechanism === 'skipStates' && w.part === 'indicator')).toBe(true);
    });

    it('lists what the anatomy\'s hiddenIn excused as a waiver', () => {
        // Avatar's real shape: three states painted identically, and the
        // runtime hides `image` in `error` and `fallback` in `loaded`.
        const ds = fixture([{
            component: 'avatar',
            parts: {
                root: { base: { display: 'inline-flex' }, states: { loading: {}, loaded: {}, error: {} } },
                image: { base: { width: '100%' }, states: { loading: {}, loaded: {}, error: {} } },
                fallback: { base: { display: 'grid' }, states: { loading: {}, loaded: {}, error: {} } },
            },
        }]);
        const result = auditDesignSystem(ds, manifest, { rules: ['state-legibility/component'] });
        expect(result.findings).toEqual([]);
        expect(result.waived.map((w) => w.waivedBy.mechanism)).toEqual(['hiddenIn', 'hiddenIn', 'hiddenIn']);
    });

    it('reports #220 — an in-flow disclosure control that says nothing', () => {
        const ds = fixture([{ component: 'collapsible', parts: { trigger: blindTrigger } }]);
        const [finding] = auditDesignSystem(ds, manifest, { rules: ['state-legibility/disclosure'] }).findings;
        expect(finding?.where).toBe('collapsible.trigger');
        expect(finding?.message).toContain('no indicator part');
    });

    it('accepts the twin whose control says which way it points', () => {
        const ds = fixture([{
            component: 'collapsible',
            parts: { trigger: { ...blindTrigger, states: { open: { background: 'rebeccapurple' }, closed: {} } } },
        }]);
        expect(rulesOf(ds, ['state-legibility/disclosure'])).toEqual([]);
    });
});

// ── button affordance ───────────────────────────────────────────────────────

describe('button-affordance through the audit', () => {
    const states = { open: {}, closed: {}, disabled: {} };

    it('reports #213 — a tooltip trigger with an empty base', () => {
        const ds = fixture([{ component: 'tooltip', parts: { trigger: { base: {}, states } } }]);
        const [finding] = auditDesignSystem(ds, manifest, { rules: ['button-affordance'] }).findings;
        expect(finding?.where).toBe('tooltip.trigger');
        expect(finding?.severity).toBe('error');
        expect(finding?.message).toContain('appearance');
    });

    it('reports a reset that only applies under a media query', () => {
        const ds = fixture([{
            component: 'tooltip',
            parts: { trigger: { base: {}, at: { print: { base: { appearance: 'none' } } }, states } },
        }]);
        expect(rulesOf(ds, ['button-affordance'])).toEqual(['button-affordance']);
    });

    it('accepts the twin with an unconditional reset', () => {
        const ds = fixture([{ component: 'tooltip', parts: { trigger: { base: { appearance: 'none' }, states } } }]);
        expect(rulesOf(ds, ['button-affordance'])).toEqual([]);
    });
});

// ── axis value coverage ─────────────────────────────────────────────────────

const RAMP = ['sm', 'md', 'lg', 'xl'];
const size = (values: Record<string, Record<string, unknown>>): RecipeInput['variants'] =>
    ({ size: values as Record<string, Record<string, never>> });
const height = (v: string) => ({ root: { base: { minHeight: v } } });
const fullRamp = size({ sm: height('2rem'), md: {}, lg: height('3rem'), xl: height('4rem') });

describe('axis-value-coverage through the audit', () => {
    it('reports #258 — a sibling skips the tail of the ramp', () => {
        const ds = fixture([
            { component: 'button', parts: { root: { base: {} } }, variants: fullRamp },
            { component: 'avatar', parts: { root: { base: {} } }, variants: size({ sm: height('2rem'), md: {}, lg: height('3rem') }) },
        ], { sizes: RAMP });
        const [finding] = auditDesignSystem(ds, manifest, { rules: ['axis-value-coverage/gap'] }).findings;
        expect(finding?.where).toBe('avatar.size');
        expect(finding?.values).toEqual(['xl']);
        expect(finding?.severity).toBe('error');
    });

    it('reports a gap "fixed" by a second empty entry as an ambiguous base', () => {
        const ds = fixture([
            { component: 'button', parts: { root: { base: {} } }, variants: fullRamp },
            { component: 'avatar', parts: { root: { base: {} } }, variants: size({ sm: height('2rem'), md: {}, lg: height('3rem'), xl: {} }) },
        ], { sizes: RAMP });
        const result = auditDesignSystem(ds, manifest, {
            rules: ['axis-value-coverage/gap', 'axis-value-coverage/ambiguous-base'],
        });
        expect(result.findings.map((f) => [f.rule, f.where, f.values])).toEqual([
            ['axis-value-coverage/ambiguous-base', 'avatar.size', ['md', 'xl']],
        ]);
    });

    it('reports a declared step nobody implements, at design-system granularity', () => {
        const ds = fixture([
            { component: 'button', parts: { root: { base: {} } }, variants: fullRamp },
            { component: 'avatar', parts: { root: { base: {} } }, variants: fullRamp },
        ], { sizes: [...RAMP, '2xl'] });
        const findings = auditDesignSystem(ds, manifest, { rules: ['axis-value-coverage/unused'] }).findings;
        // `primary` is declared and wired by neither recipe — true, and the
        // rule says so beside the step this case is about.
        expect(findings.map((f) => [f.where, f.severity])).toEqual([
            ['color.primary', 'warning'],
            ['size.2xl', 'warning'],
        ]);
        expect(findings[1]?.scope).toBeUndefined();
    });

    it('waives a fill or hairline role rather than reporting it', () => {
        const ds = fixture([
            { component: 'button', parts: { root: { base: {} } }, variants: fullRamp },
        ], { roles: { primary: {}, outline: { content: false, soft: false } }, sizes: RAMP });
        const result = auditDesignSystem(ds, manifest, { rules: ['axis-value-coverage/unused'] });
        expect(result.findings.map((f) => f.where)).toEqual(['color.primary']);
        expect(result.waived.map((w) => [w.where, w.waivedBy.mechanism])).toEqual([['color.outline', 'role-decl']]);
    });

    it('accepts the twin where both scopes ship the whole ramp', () => {
        const ds = fixture([
            { component: 'button', parts: { root: { base: {} } }, variants: fullRamp },
            { component: 'avatar', parts: { root: { base: {} } }, variants: fullRamp },
        ], { sizes: RAMP });
        expect(rulesOf(ds, ['axis-value-coverage/gap', 'axis-value-coverage/ambiguous-base'])).toEqual([]);
    });
});

// ── axis coverage ───────────────────────────────────────────────────────────

describe('axis-coverage through the audit', () => {
    const fill = (v: string) => ({ root: { base: { background: v } } });

    it('reports a styled scope that wires nothing for a declared axis', () => {
        const ds = fixture([
            { component: 'button', parts: { root: { base: {} } }, variants: { color: { primary: fill('blue') } } },
            { component: 'avatar', parts: { root: { base: {} } } },
        ], { sizes: [] });
        const findings = auditDesignSystem(ds, manifest, { rules: ['axis-coverage'] }).findings;
        expect(findings.map((f) => [f.where, f.severity])).toEqual([['avatar.color', 'warning']]);
        expect(findings[0]?.axis).toBe('color');
    });

    it('waives the scope that declared the axis away for itself', () => {
        const ds = fixture([
            { component: 'button', parts: { root: { base: {} } }, variants: { color: { primary: fill('blue') } } },
            { component: 'avatar', parts: { root: { base: {} } } },
        ], { sizes: [], scopes: { avatar: { colors: [] } } });
        const result = auditDesignSystem(ds, manifest, { rules: ['axis-coverage'] });
        expect(result.findings).toEqual([]);
        expect(result.waived.map((w) => [w.where, w.waivedBy.mechanism, w.waivedBy.detail]))
            .toEqual([['avatar.color', 'tokens.scopes', 'tokens.scopes.avatar.colors: []']]);
    });

    it('says nothing when the design system declares the axis out of existence', () => {
        const ds = fixture([
            { component: 'button', parts: { root: { base: {} } } },
            { component: 'avatar', parts: { root: { base: {} } } },
        ], {
            roles: {},
            sizes: [],
            themes: {
                day: {
                    colorScheme: 'light',
                    colors: { 'base-100': 'white', 'base-200': 'white', 'base-300': 'white', 'base-content': 'black' },
                },
            },
        });
        const result = auditDesignSystem(ds, manifest, { rules: ['axis-coverage'] });
        expect(result.findings).toEqual([]);
        expect(result.waived).toEqual([]);
    });
});

// ── the aggregate ───────────────────────────────────────────────────────────

describe('the aggregate', () => {
    /**
     * Every rule at once. The tooltip trigger is state-blind AND unreset, so
     * two rules report it; `primary` is declared and wired by nobody; three
     * styled scopes wire no colour. Four errors from three rules, four
     * warnings from two — enough to show the order is severity, then rule,
     * then where.
     */
    const mixed = fixture([
        { component: 'checkbox', parts: { control, indicator: blind } },
        { component: 'tooltip', parts: { trigger: { base: {}, states: { open: {}, closed: {}, disabled: {} } } } },
        { component: 'avatar', parts: { root: { base: {} } } },
    ], { sizes: [] });

    it('sorts severity → rule → where', () => {
        const result = auditDesignSystem(mixed, manifest);
        const seen = result.findings.map((f) => `${f.severity} ${f.rule} ${f.where}`);
        expect(seen).toEqual([
            'error state-legibility/component checkbox',
            'error state-legibility/component tooltip',
            'error state-legibility/indicator checkbox.indicator',
            'error button-affordance tooltip.trigger',
            'warning axis-value-coverage/unused color.primary',
            'warning axis-coverage avatar.color',
            'warning axis-coverage checkbox.color',
            'warning axis-coverage tooltip.color',
        ]);
        expect(result.auditVersion).toBe(1);
        expect(result.name).toBe('fixture');
        expect(result.summary.errors).toBe(4);
        expect(result.summary.warnings).toBe(4);
    });

    it('runs only the rules asked for, and refuses one it does not know', () => {
        expect(rulesOf(mixed, ['button-affordance'])).toEqual(['button-affordance']);
        expect(rulesOf(mixed, ['axis-coverage']).every((r) => r === 'axis-coverage')).toBe(true);
        expect(() => auditDesignSystem(mixed, manifest, { rules: ['contrast/nope' as AuditRuleId] }))
            .toThrow(/unknown audit rule "contrast\/nope"/);
        // …and the default is every rule the registry knows.
        expect(AUDIT_RULES.length).toBe(14);
    });

    it('takes a compile the caller already has and reaches the same verdict', () => {
        const compiled = compileDesignSystem(mixed, manifest);
        const a = auditDesignSystem(mixed, manifest);
        const b = auditDesignSystem(mixed, manifest, { compiled });
        expect(b).toEqual(a);
    });

    it('formats errors first, grouped under their rule, with a closing count', () => {
        const lines = formatAudit(auditDesignSystem(mixed, manifest));
        expect(lines[0]).toBe('fixture — audit');
        expect(lines[1]).toBe('  state-legibility/component (error) ×2');
        expect(lines.some((l) => l === '  axis-coverage (warning) ×3')).toBe(true);
        expect(lines[lines.length - 1]).toBe('  4 error(s), 4 warning(s), 0 info');
        // The rule header precedes its findings, and a finding is indented under it.
        const header = lines.indexOf('  button-affordance (error) ×1');
        expect(lines[header + 1]).toMatch(/^ {4}tooltip\.trigger: /);
    });

    it('says so when there is nothing to say', () => {
        const clean = fixture([
            { component: 'checkbox', parts: { control, indicator: drawn }, variants: { color: { primary: { root: { base: { color: 'blue' } } } } } },
        ], { sizes: [] });
        const result = auditDesignSystem(clean, manifest);
        expect(result.findings).toEqual([]);
        expect(formatAudit(result)).toEqual([
            'fixture — audit',
            '  no findings',
            // The contrast line is a count, not a finding: cells it measured,
            // and — were there any — cells it could not.
            expect.stringMatching(/^ {2}contrast day: \d+ cells, \d+ measured, 0 below floor, 0 below 4.5:1$/),
            '  0 error(s), 0 warning(s), 0 info',
        ]);
    });
});
