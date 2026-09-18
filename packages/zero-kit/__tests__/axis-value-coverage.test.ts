/**
 * The declared-step-nobody-honours guard — the six in-repo skins, through
 * the kit's `axis-value-coverage/*` audit rules.
 *
 * The rules live in `src/audit/rules/axis-value-coverage.ts` (#403), lifted
 * verbatim from this file so a design system generated outside this repo is
 * asked the same three questions through `auditDesignSystem`: no scope skips
 * a step its siblings implement (`gap`), at most one value per scope claims
 * the base (`ambiguous-base`), and a declared value some recipe uses
 * (`unused`). The reasoning — the un-attributed step, why the compiled CSS,
 * why it is not the naive rule and what that rule would have reported —
 * moved with the code. What stays here is this repo's ledger (Material's
 * four fill roles are the one deliberate let-through, now listed as waivers)
 * and the guard's own teeth.
 */
import { describe, it, expect } from 'vitest';
import { auditDesignSystem, compileDesignSystem } from '@sigx/zero-kit';
import type {
    AuditFinding,
    AuditRuleId,
    CompiledDesignSystem,
    DesignSystemInput,
    ManifestComponent,
    RecipeInput,
    ScopeVocabulary,
} from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { designSystem as daisyDS } from '@sigx/zero-daisyui';
import { designSystem as materialDS } from '@sigx/zero-material';
import { designSystem as brutalistDS } from '@sigx/zero-brutalist';
import { designSystem as herouiDS } from '@sigx/zero-heroui';
import { designSystem as carbonDS } from '@sigx/zero-carbon';
import {
    ambiguousBases as ambiguousBaseFindings,
    coverageGaps as coverageGapFindings,
    declaredVocabulary,
    implementedSomewhere,
    isFillOrHairline,
    paintedValues,
    participatingCells,
    unusedVocabulary,
} from '../src/audit/index.js';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

// One by one, for the reason `css-golden.test.ts`, `state-legibility.test.ts`
// and `button-affordance.test.ts` all give: `DesignSystemInput<R>` is invariant
// in `R`, so the inputs cannot be widened into one array while the compiled
// results share a non-generic type.
const SYSTEMS: ReadonlyArray<{ name: string; ds: DesignSystemInput; compiled: CompiledDesignSystem }> = [
    { name: 'basic', ds: basicDS as DesignSystemInput, compiled: compileDesignSystem(basicDS, manifest) },
    { name: 'daisyui', ds: daisyDS as DesignSystemInput, compiled: compileDesignSystem(daisyDS, manifest) },
    { name: 'material', ds: materialDS as DesignSystemInput, compiled: compileDesignSystem(materialDS, manifest) },
    { name: 'brutalist', ds: brutalistDS as DesignSystemInput, compiled: compileDesignSystem(brutalistDS, manifest) },
    { name: 'heroui', ds: herouiDS as DesignSystemInput, compiled: compileDesignSystem(herouiDS, manifest) },
    { name: 'carbon', ds: carbonDS as DesignSystemInput, compiled: compileDesignSystem(carbonDS, manifest) },
];

const audit = (name: string, rule: AuditRuleId) => {
    const system = SYSTEMS.find((s) => s.name === name)!;
    return auditDesignSystem(system.ds, manifest, { rules: [rule], compiled: system.compiled });
};

/** The guard's old one-line spelling of a finding: `scope.axis: value, value`. */
const cell = (f: AuditFinding): string => `${f.where}: ${(f.values ?? []).join(', ')}`;
const coverageGaps = (compiled: CompiledDesignSystem): string[] => coverageGapFindings(compiled).map(cell);
const ambiguousBases = (compiled: CompiledDesignSystem): string[] => ambiguousBaseFindings(compiled).map(cell);

describe('every declared axis value is honoured or claimed', () => {
    it('reads a vocabulary and a stylesheet worth asserting on', () => {
        // A sanity check on the substrate: every assertion below is an
        // emptiness check, which is also what a guard that can see nothing
        // reports.
        const carbon = SYSTEMS.find((s) => s.name === 'carbon')!.compiled;
        expect(declaredVocabulary(carbon)['size']).toEqual(['sm', 'md', 'lg', 'xl', '2xl']);
        expect([...paintedValues(carbon.componentCss['button']!, 'size', 'default')].sort())
            .toEqual(['2xl', 'md', 'sm', 'xl']);
        // …and `lg` is Carbon's un-attributed button step, written and silent.
        expect(participatingCells(carbon).find((c) => c.scope === 'button' && c.axis === 'size')?.claims)
            .toEqual(['lg']);
        // 23 before #321; the eight Contract v1 carriers joined the axis,
        // then the content-tier sweep (#334) grew
        // it scope by scope — re-derived from the compiled scope count so
        // every carbon recipe keeps owing a full size ramp without a hand
        // bump per scope.
        // …minus the scopes that declared the axis out of existence. The
        // layout tier is geometry: a Stack has no size ramp to owe, and
        // `sizes: []` is how it says so. Named rather than subtracted
        // silently, so a scope that opts out by accident still shows up here.
        const optedOutOfSize = Object.keys(carbon.componentCss)
            .filter((scope) => carbon.components[scope]?.offered?.size?.length === 0)
            .sort();
        expect(optedOutOfSize).toEqual(['box', 'center', 'container', 'grid', 'spacer', 'stack']);
        expect(participatingCells(carbon).filter((c) => c.axis === 'size').length)
            .toBe(Object.keys(carbon.componentCss).length - optedOutOfSize.length);
    });

    it.each(SYSTEMS.map((s) => s.name))(
        '%s: no scope skips a step its siblings implement',
        (name) => {
            expect(
                audit(name, 'axis-value-coverage/gap').findings.map(cell),
                `${name} declares these values, implements them in some scope, and silently renders the base in these`,
            ).toEqual([]);
        },
    );

    it.each(SYSTEMS.map((s) => s.name))(
        '%s: at most one value per scope claims the base',
        (name) => {
            expect(
                audit(name, 'axis-value-coverage/ambiguous-base').findings.map(cell),
                `${name} writes these values as empty entries, so they all render as the base — and identically to each other`,
            ).toEqual([]);
        },
    );

    it.each(SYSTEMS.map((s) => s.name))(
        '%s: a declared value no recipe uses is a token, not an axis value',
        (name) => {
            // The deliberate let-through, made visible rather than silent. A
            // colour role that is a fill or a hairline is legitimately never a
            // `data-color` value, and the rule lists it as a WAIVER; anything
            // else — a size step, a variant, a custom axis value, a full colour
            // role — is a word the design system says and never uses, and this
            // is where it surfaces.
            expect(
                audit(name, 'axis-value-coverage/unused').findings.map((f) => `${f.axis}: ${(f.values ?? []).join(', ')}`),
                `${name} declares these and no recipe paints or claims them — an app may pass them and get the base`,
            ).toEqual([]);
        },
    );

    it('records the vocabulary that is declared and deliberately unwired', () => {
        // Not a formality: the exemption above is only safe while it is exactly
        // Material's tonal surfaces. If a design system adds a fill role and
        // then starts wiring it, or another one grows an unused role, this
        // fails and the reasoning gets revisited rather than inherited.
        // Both classes in one sorted list, keyed apart: an unclaimed value is
        // a different mistake from an unpainted one, and either breaking this
        // must fail rather than be absorbed by the other.
        const ledger = SYSTEMS.flatMap((s) =>
            unusedVocabulary(s.compiled).map((u) =>
                `${s.name}/${u.axis}: ${u.value}${u.reason === 'unclaimed' ? ' (unclaimed)' : ''}`));
        expect(ledger.sort()).toEqual([
            'material/color: outline',
            'material/color: surface',
            'material/color: surface-container',
            'material/color: surface-container-high',
        ]);
        // …and the audit lists exactly those as waivers, by the mechanism
        // that excuses them, rather than dropping them on the floor.
        const waived = SYSTEMS.flatMap((s) =>
            audit(s.name, 'axis-value-coverage/unused').waived.map((w) => `${s.name}/${w.where} (${w.waivedBy.mechanism})`));
        expect(waived.sort()).toEqual([
            'material/color.outline (role-decl)',
            'material/color.surface (role-decl)',
            'material/color.surface-container (role-decl)',
            'material/color.surface-container-high (role-decl)',
        ]);
    });
});

/**
 * The guard's own teeth.
 *
 * Everything above asserts six design systems are clean, which is also what a
 * guard that can see nothing reports. So every carve-out gets a fixture that it
 * MUST report — and one that it must NOT, so the carve-out is shown to be a
 * carve-out rather than a blanket.
 */
describe('the guard\'s own teeth', () => {
    const size = (values: Record<string, Record<string, unknown>>): RecipeInput['variants'] =>
        ({ size: values as Record<string, Record<string, never>> });

    const height = (v: string) => ({ root: { base: { minHeight: v } } });

    /** A two-scope design system over the real `button` and `avatar` anatomies. */
    const fixture = (
        sizes: string[],
        button: RecipeInput['variants'],
        avatar: RecipeInput['variants'],
        scopes?: Record<string, ScopeVocabulary>,
    ): CompiledDesignSystem => compileDesignSystem({
        name: 'fixture',
        tokens: {
            roles: { primary: {} },
            sizes,
            ...(scopes ? { scopes } : {}),
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
        },
        recipes: [
            { component: 'button', parts: { root: { base: {} } }, variants: button },
            { component: 'avatar', parts: { root: { base: {} } }, variants: avatar },
        ],
    }, manifest);

    const RAMP = ['sm', 'md', 'lg', 'xl'];

    it('reports #258 verbatim — button ships the tail of the ramp and a sibling does not', () => {
        const ds = fixture(
            RAMP,
            size({ sm: height('2rem'), md: {}, lg: height('3rem'), xl: height('4rem') }),
            size({ sm: height('2rem'), md: {}, lg: height('3rem') }),
        );
        expect(coverageGaps(ds)).toEqual(['avatar.size: xl']);
    });

    it('reports a hole in the MIDDLE of a ramp, not just a short tail', () => {
        const ds = fixture(
            RAMP,
            size({ sm: height('2rem'), md: {}, lg: height('3rem'), xl: height('4rem') }),
            size({ sm: height('2rem'), md: {}, xl: height('4rem') }),
        );
        expect(coverageGaps(ds)).toEqual(['avatar.size: lg']);
    });

    it('reports a step implemented only inside a media query', () => {
        // `xl` matches a selector, so a `toContain('[data-size="xl"]')` would
        // pass it — and at the default viewport the control still renders as
        // `md`, which is the whole bug. It is also why an entry has to paint
        // NOWHERE to count as the base claim: this one paints somewhere, so it
        // is not claiming anything, and A reports the gap.
        const ds = fixture(
            RAMP,
            size({ sm: height('2rem'), md: {}, lg: height('3rem'), xl: height('4rem') }),
            size({
                sm: height('2rem'), md: {}, lg: height('3rem'),
                xl: { root: { at: { print: { base: { minHeight: '4rem' } } } } },
            }),
        );
        expect(coverageGaps(ds)).toEqual(['avatar.size: xl']);
    });

    it('accepts the un-attributed step, wherever in the ramp it sits', () => {
        // Both scopes ship every step, each claiming a DIFFERENT base — which
        // is zero-carbon's real shape (button on `lg`, everything else on `md`).
        const ds = fixture(
            RAMP,
            size({ sm: height('2rem'), md: height('2.5rem'), lg: {}, xl: height('4rem') }),
            size({ sm: height('2rem'), md: {}, lg: height('3rem'), xl: height('4rem') }),
        );
        expect(coverageGaps(ds)).toEqual([]);
        expect(ambiguousBases(ds)).toEqual([]);
    });

    it('reports a gap "fixed" by writing a second empty entry', () => {
        // The escape hatch assertion A would otherwise open: `xl: {}` accounts
        // for `xl` and renders it identically to `md`, i.e. smaller than `lg`.
        const ds = fixture(
            RAMP,
            size({ sm: height('2rem'), md: {}, lg: height('3rem'), xl: height('4rem') }),
            size({ sm: height('2rem'), md: {}, lg: height('3rem'), xl: {} }),
        );
        expect(coverageGaps(ds)).toEqual([]);
        expect(ambiguousBases(ds)).toEqual(['avatar.size: md, xl']);
    });

    it('says nothing about a scope that wires no step at all', () => {
        // Not this guard's question — `axis-coverage.test.ts` owns whether a
        // scope that ACCEPTS the axis ought to wire it, and the components that
        // take no size prop (dialog, popover, tooltip) must not be reported
        // here at all.
        const ds = fixture(RAMP, size({ sm: height('2rem'), md: {}, lg: height('3rem'), xl: height('4rem') }), {});
        expect(coverageGaps(ds)).toEqual([]);
        expect(ambiguousBases(ds)).toEqual([]);
        expect(participatingCells(ds).some((c) => c.scope === 'avatar' && c.axis === 'size')).toBe(false);
    });

    // The fixture declares one colour role and wires it on neither component,
    // so `color: primary` is unused in every case below — true, and not what
    // these two are about.
    const unusedSizes = (ds: CompiledDesignSystem): string[] =>
        unusedVocabulary(ds).filter((u) => u.axis === 'size').map((u) => u.value);

    it('reports a declared step no scope implements — at design-system granularity', () => {
        // Assertion A is silent here by design: nothing promised `2xl`, so
        // there is no sibling to hold anyone to. C is the one that speaks, once
        // per design system instead of once per scope.
        const ds = fixture(
            [...RAMP, '2xl'],
            size({ sm: height('2rem'), md: {}, lg: height('3rem'), xl: height('4rem') }),
            size({ sm: height('2rem'), md: {}, lg: height('3rem'), xl: height('4rem') }),
        );
        expect(coverageGaps(ds)).toEqual([]);
        expect(unusedSizes(ds)).toEqual(['2xl']);
    });

    it('does not call a universally un-attributed base unused', () => {
        // `md` is painted by nobody in this fixture, and it is not a gap: every
        // participating scope writes it as the entry that claims the base.
        const ds = fixture(
            RAMP,
            size({ sm: height('2rem'), md: {}, lg: height('3rem'), xl: height('4rem') }),
            size({ sm: height('2rem'), md: {}, lg: height('3rem'), xl: height('4rem') }),
        );
        expect(implementedSomewhere(ds, 'size').has('md')).toBe(false);
        expect(unusedSizes(ds)).toEqual([]);
    });

    it('reports an unwired colour role that is a full role, not a fill', () => {
        // Assertion C's carve-out is `content: false` / `soft: false`, and this
        // is the other side of it: the fixture's `primary` is a full role that
        // no recipe paints, and C says so.
        const ds = fixture(
            RAMP,
            size({ sm: height('2rem'), md: {}, lg: height('3rem'), xl: height('4rem') }),
            size({ sm: height('2rem'), md: {}, lg: height('3rem'), xl: height('4rem') }),
        );
        expect(unusedVocabulary(ds)).toEqual([{ axis: 'color', value: 'primary', reason: 'unused' }]);
        expect(isFillOrHairline(ds.tokens.roles['primary'])).toBe(false);
        // …and the same role declared as a fill is exempt, which is exactly
        // what material's `surface*`/`outline` are.
        expect(isFillOrHairline({ content: false, soft: false })).toBe(true);
    });

    it('sees a value reached only through a compoundVariant', () => {
        // `variants` is not the only door: a value can be implemented by a
        // compound alone, and `harvestAxes` plus the compiled selector both see
        // it. A guard reading `variants` keys only would report a false gap.
        const ds = compileDesignSystem({
            name: 'fixture',
            tokens: {
                roles: { primary: {} },
                sizes: RAMP,
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
            },
            recipes: [
                {
                    component: 'button',
                    parts: { root: { base: {} } },
                    variants: size({ sm: height('2rem'), md: {}, lg: height('3rem'), xl: height('4rem') }),
                },
                {
                    component: 'avatar',
                    parts: { root: { base: {} } },
                    variants: size({ sm: height('2rem'), md: {}, lg: height('3rem') }),
                    compoundVariants: [
                        { match: { size: 'xl', color: 'primary' }, parts: { root: { base: { minHeight: '4rem' } } } },
                    ],
                },
            ],
        }, manifest);
        expect(coverageGaps(ds)).toEqual([]);
    });

    // ── per-scope vocabularies (#294) ─────────────────────────────────────
    //
    // The union is what makes these necessary. Once `tokens.variants` is the
    // union of every scope's vocabulary rather than one vocabulary they share,
    // "a value a sibling implements" stops meaning "a value this scope owes
    // you" — and every assertion above was written on the old reading.

    const fill = (v: string) => ({ root: { base: { background: v } } });
    const variant = (values: Record<string, Record<string, unknown>>): RecipeInput['variants'] =>
        ({ variant: values as Record<string, Record<string, never>> });

    /** The same two scopes, over a declared `variant` vocabulary. */
    const variantFixture = (
        variants: string[],
        button: RecipeInput['variants'],
        avatar: RecipeInput['variants'],
        scopes?: Record<string, ScopeVocabulary>,
    ): CompiledDesignSystem => compileDesignSystem({
        name: 'fixture',
        tokens: {
            roles: { primary: {} },
            variants,
            ...(scopes ? { scopes } : {}),
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
        },
        recipes: [
            { component: 'button', parts: { root: { base: {} } }, variants: button },
            { component: 'avatar', parts: { root: { base: {} } }, variants: avatar },
        ],
    }, manifest);

    it('says nothing when each scope declares only its own values', () => {
        // The issue's headline: `classic` is select's, `solid` is button's, and
        // the union carries both. On the sibling reading this reports BOTH
        // scopes, which is exactly the false finding the union would otherwise
        // introduce the day per-scope vocabularies were used.
        const ds = variantFixture(
            ['solid', 'classic'],
            variant({ solid: fill('blue') }),
            variant({ classic: fill('grey') }),
            { button: { variants: ['solid'] }, avatar: { variants: ['classic'] } },
        );
        expect(coverageGaps(ds)).toEqual([]);
        expect(unusedVocabulary(ds).filter((u) => u.axis === 'variant')).toEqual([]);
    });

    it('reports the cross-talk when only one side restricts', () => {
        // Half-adopting the union, pinned rather than left to be discovered
        // inside a real design system: `button` still offers the whole union,
        // so `classic` — declared for `avatar` — really does render as the base
        // on a button. `validateDesignSystem` warns about this at the
        // declaration; this is the same fact seen from the coverage side.
        const ds = variantFixture(
            ['solid', 'classic'],
            variant({ solid: fill('blue') }),
            variant({ classic: fill('grey') }),
            { avatar: { variants: ['classic'] } },
        );
        expect(coverageGaps(ds)).toEqual(['button.variant: classic']);
    });

    it('reports a scope that promises a vocabulary and paints none of it', () => {
        // The sharpest #258 available: the declaration is the promise, and this
        // scope shipped nothing against it. Before per-scope vocabularies a
        // scope wiring nothing was silent — correctly, since it had promised
        // nothing.
        const ds = variantFixture(
            ['solid', 'classic'],
            variant({ solid: fill('blue') }),
            {},
            { avatar: { variants: ['classic'] } },
        );
        expect(coverageGaps(ds)).toEqual(['avatar.variant: classic']);
    });

    it('says nothing about a scope that declares the axis out of existence for itself', () => {
        // `variants: []` is the claim "no variant axis here", the same grammar
        // `sizes: []` uses design-system-wide — so there is nothing to cover
        // and no cell at all.
        const ds = variantFixture(
            ['solid'],
            variant({ solid: fill('blue') }),
            {},
            { avatar: { variants: [] } },
        );
        expect(coverageGaps(ds)).toEqual([]);
        expect(participatingCells(ds).some((c) => c.scope === 'avatar' && c.axis === 'variant')).toBe(false);
    });

    it('the empty restriction is not the absent one', () => {
        // Where the natural bug lives: `[] ?? union` keeps the empty list and
        // `[] || union` silently discards it. A scope that WIRES the axis makes
        // the two observably different — absent participates, empty does not.
        const wiring = variant({ solid: fill('grey') });
        const absent = variantFixture(['solid'], variant({ solid: fill('blue') }), wiring);
        const empty = variantFixture(
            ['solid'],
            variant({ solid: fill('blue') }),
            wiring,
            { avatar: { variants: [] } },
        );
        expect(participatingCells(absent).some((c) => c.scope === 'avatar' && c.axis === 'variant')).toBe(true);
        expect(participatingCells(empty).some((c) => c.scope === 'avatar' && c.axis === 'variant')).toBe(false);
    });

    const variantFindings = (ds: CompiledDesignSystem): string[] =>
        unusedVocabulary(ds).filter((u) => u.axis === 'variant').map((u) => `${u.value} (${u.reason})`).sort();

    it('reports a union value no scope\'s vocabulary claims', () => {
        // C2. `assist` is in the union and in nobody's vocabulary — a different
        // mistake from "declared and never painted", with a different fix.
        const ds = variantFixture(
            ['solid', 'classic', 'assist'],
            variant({ solid: fill('blue') }),
            variant({ classic: fill('grey') }),
            { button: { variants: ['solid'] }, avatar: { variants: ['classic'] } },
        );
        expect(variantFindings(ds)).toEqual(['assist (unclaimed)']);
        expect(coverageGaps(ds)).toEqual([]);
    });

    it('does not call a union value unclaimed while any scope is unrestricted', () => {
        // C2's negative, and what makes `unrestricted` legible: with `button`
        // open its vocabulary IS the union, so `assist` is claimed — and C1
        // reports it the old way instead, for the old reason.
        const ds = variantFixture(
            ['solid', 'classic', 'assist'],
            variant({ solid: fill('blue') }),
            variant({ classic: fill('grey') }),
            { avatar: { variants: ['classic'] } },
        );
        expect(variantFindings(ds)).toEqual(['assist (unused)']);
    });

    it('a per-scope size restriction retires a #258 finding', () => {
        // Not variant-only: #258 itself was a size problem, and declaring
        // avatar's ramp is the honest answer to it rather than a suppression.
        const shapes = [
            size({ sm: height('2rem'), md: {}, lg: height('3rem'), xl: height('4rem') }),
            size({ sm: height('2rem'), md: {}, lg: height('3rem') }),
        ] as const;
        expect(coverageGaps(fixture(RAMP, shapes[0], shapes[1]))).toEqual(['avatar.size: xl']);
        expect(coverageGaps(fixture(RAMP, shapes[0], shapes[1], { avatar: { sizes: ['sm', 'md', 'lg'] } })))
            .toEqual([]);
    });

    it('a claim outside the scope\'s own vocabulary is still an ambiguous base', () => {
        // A and B must not start covering for each other: restricting the ramp
        // accounts for the MISSING step, and says nothing about the scope
        // writing a second silent entry that renders identically to its base.
        const ds = fixture(
            RAMP,
            size({ sm: height('2rem'), md: {}, lg: height('3rem'), xl: height('4rem') }),
            size({ sm: height('2rem'), md: {}, lg: height('3rem'), xl: {} }),
            { avatar: { sizes: ['sm', 'md', 'lg'] } },
        );
        expect(coverageGaps(ds)).toEqual([]);
        expect(ambiguousBases(ds)).toEqual(['avatar.size: md, xl']);
    });
});
