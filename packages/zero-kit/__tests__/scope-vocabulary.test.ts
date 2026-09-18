/**
 * Per-scope axis vocabularies — the contract half of #294
 * (docs/architecture.md, "Declared vocabulary").
 *
 * The gate the issue set is one sentence: *a design system can give `select` a
 * vocabulary `button` does not have, and the manifest, `register.d.ts` and the
 * report all narrow to it.* The last describe block is exactly that sentence,
 * executed. Everything above it is the validation that makes the narrowing
 * mean something — a restriction nothing enforces is a comment.
 *
 * ── WHY THE UNION ────────────────────────────────────────────────────────────
 * §4 originally sketched a map that only NARROWS. That is not sufficient on its
 * own, and the survey in #175 is why: Radix gives `select` `classic | surface`,
 * and the button's declared set contains neither, so there is nothing to narrow
 * *from*. `tokens.variants` therefore becomes the **union** of every scope's
 * vocabulary, and a scope names its part of it.
 *
 * That trade is the whole design, and it has a cost worth being explicit about:
 * the design-system-wide list stops being "the vocabulary" and becomes "every
 * value some scope offers". Two diagnostics exist only to pay it back — the
 * cross-talk warning, for a design system that restricts one scope and leaves
 * its sibling offering the whole union, and the unclaimed warning, for a value
 * in the union that belongs to nobody. Both are asserted below.
 *
 * ── WHY THE SCOPE AND NOT THE PART ───────────────────────────────────────────
 * Radix's Select varies Trigger and Content differently, which read as evidence
 * for per-PART vocabularies. It is not. Zero carries one attribute per axis on
 * the scope's carrier part and cascades it to every part below by descendant
 * selector, so two different vocabularies on two parts are two AXES — the
 * second one is a `tokens.axes` entry, which zero has always been able to
 * express. `parts` is rejected by name inside a scope entry (below) so that a
 * per-part restriction, if it is ever wanted, stays additive.
 */
import { describe, it, expect } from 'vitest';
import { buildReport, compileDesignSystem, compileRegisterDts, validateDesignSystem } from '@sigx/zero-kit';
import type {
    DesignSystemInput,
    ManifestComponent,
    RecipeInput,
    ScopeVocabulary,
} from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

const colors = {
    'base-100': 'oklch(100% 0 0)',
    'base-200': 'oklch(96% 0 0)',
    'base-300': 'oklch(92% 0 0)',
    'base-content': 'oklch(20% 0 0)',
    primary: 'oklch(50% 0.2 260)',
    'primary-content': 'oklch(98% 0.01 260)',
    danger: 'oklch(52% 0.19 25)',
    'danger-content': 'oklch(98% 0.01 25)',
};

/**
 * The fixture the whole file runs on: a button and a select over the real
 * anatomies, with whatever vocabulary the case under test needs.
 *
 * `select` rather than an easier scope on purpose — it is the carrier the
 * issue names, and the one whose parts fan out furthest below the carrier.
 */
const ds = (
    tokens: {
        variants?: string[];
        sizes?: string[];
        modifiers?: string[];
        axes?: Record<string, string[]>;
        scopes?: Record<string, ScopeVocabulary>;
    },
    recipes: RecipeInput[],
): DesignSystemInput => ({
    name: 'probe',
    recipes,
    tokens: {
        roles: { primary: {}, danger: {} },
        ...tokens,
        defaultLight: 'l',
        themes: { l: { colorScheme: 'light', colors } },
    } as DesignSystemInput['tokens'],
});

const fill = (value: string) => ({ root: { base: { background: value } } });

/** A button wiring exactly the values it is given. */
const button = (variants: string[]): RecipeInput => ({
    component: 'button',
    parts: {
        root: {
            base: { color: 'var(--color-base-content)' },
            states: { 'focus-visible': { outline: '2px solid var(--color-primary)' } },
        },
    },
    variants: { variant: Object.fromEntries(variants.map((v) => [v, fill('var(--color-primary)')])) },
});

/** A select wiring exactly the values it is given, on its own carrier. */
const select = (variants: string[]): RecipeInput => ({
    component: 'select',
    parts: {
        root: { base: {} },
        trigger: {
            base: { color: 'var(--color-base-content)' },
            states: { 'focus-visible': { outline: '2px solid var(--color-primary)' } },
        },
    },
    variants: {
        variant: Object.fromEntries(
            variants.map((v) => [v, { trigger: { base: { background: 'var(--color-base-200)' } } }]),
        ),
    },
});

const issues = (input: DesignSystemInput) => {
    const r = validateDesignSystem(input, manifest);
    return {
        errors: r.errors.map((e) => `${e.where}: ${e.message}`),
        warnings: r.warnings.map((e) => `${e.where}: ${e.message}`),
    };
};

const has = (list: string[], fragment: string): boolean => list.some((m) => m.includes(fragment));

// ── the declaration ──────────────────────────────────────────────────────────

describe('declaring a per-scope vocabulary', () => {
    it('accepts a scope that narrows the union', () => {
        const { errors } = issues(ds(
            { variants: ['solid', 'classic', 'surface'], scopes: { button: { variants: ['solid'] }, select: { variants: ['classic', 'surface'] } } },
            [button(['solid']), select(['classic', 'surface'])],
        ));
        expect(errors.filter((e) => e.startsWith('tokens.scopes'))).toEqual([]);
    });

    it('rejects a scope that widens it, and says where the value belongs', () => {
        // The first mistake every author makes: adding the value here and
        // nowhere else. The message has to teach the union, or it reads as
        // "that value does not exist" for a value the author just wrote down.
        const { errors } = issues(ds(
            { variants: ['solid'], scopes: { select: { variants: ['classic'] } } },
            [button(['solid']), select([])],
        ));
        expect(has(errors, 'is the UNION of every scope\'s vocabulary')).toBe(true);
        expect(has(errors, 'narrows the design-system-wide list, never adds to it')).toBe(true);
    });

    it('rejects a restriction on an axis the design system never declares', () => {
        const { errors } = issues(ds(
            { scopes: { select: { variants: ['classic'] } } },
            [button([]), select([])],
        ));
        expect(has(errors, 'restricts an axis this design system never declares')).toBe(true);
    });

    it('rejects a scope that is not a component in the anatomy', () => {
        const { errors } = issues(ds(
            { variants: ['solid'], scopes: { chip: { variants: ['solid'] } } },
            [button(['solid'])],
        ));
        expect(has(errors, '"chip" is not a component in zero\'s anatomy')).toBe(true);
    });

    it('rejects `parts` by name, so per-part stays additive', () => {
        // The reserved key, and the reason it is reserved rather than ignored:
        // a design system written against a later kit must fail loudly here
        // instead of silently narrowing less than it says.
        const input = ds({ variants: ['solid'], scopes: { select: { variants: ['solid'] } } }, [button(['solid']), select(['solid'])]);
        (input.tokens as unknown as { scopes: Record<string, Record<string, unknown>> })
            .scopes['select']!['parts'] = { trigger: { variants: ['solid'] } };
        const { errors } = issues(input);
        expect(has(errors, 'the restriction unit is the scope, not the part')).toBe(true);
        expect(has(errors, 'declare the second one in `tokens.axes`')).toBe(true);
    });

    it('rejects any other unknown key inside a scope entry', () => {
        const input = ds({ variants: ['solid'], scopes: { select: { variants: ['solid'] } } }, [button(['solid']), select(['solid'])]);
        (input.tokens as unknown as { scopes: Record<string, Record<string, unknown>> })
            .scopes['select']!['roles'] = ['primary'];
        expect(has(issues(input).errors, 'unknown key "roles"')).toBe(true);
    });

    it('warns on an entry that restricts nothing, and not on one that restates the union', () => {
        // Restating the whole union is the explicit claim "yes, this scope
        // carries all of it" — and it is what keeps the coverage guard quiet
        // once a sibling narrows. Warning on it would push authors to delete
        // the one line that says what they mean.
        const empty = issues(ds(
            { variants: ['solid'], scopes: { select: {} } },
            [button(['solid']), select(['solid'])],
        ));
        expect(has(empty.warnings, 'restricts nothing')).toBe(true);

        const restated = issues(ds(
            { variants: ['solid'], scopes: { button: { variants: ['solid'] }, select: { variants: ['solid'] } } },
            [button(['solid']), select(['solid'])],
        ));
        expect(has(restated.warnings, 'restricts nothing')).toBe(false);
    });

    it('warns when one scope narrows and a styled sibling does not', () => {
        // Half-adopting the union, named at the declaration rather than
        // discovered later as a coverage finding against the sibling.
        const { warnings } = issues(ds(
            { variants: ['solid', 'classic'], scopes: { select: { variants: ['classic'] } } },
            [button(['solid']), select(['classic'])],
        ));
        expect(has(warnings, 'narrow the `variant` vocabulary but "button" do not')).toBe(true);
    });

    it('does not call an OPTING-OUT scope a narrowing one', () => {
        // `[]` says "this scope has no such axis at all" — it declares no
        // values, so no sibling can be silently offering values that were
        // added for it, which is the entire subject of the warning above.
        //
        // The layout tier is the case that made this visible: a Stack is
        // geometry and wires neither colour nor size, and saying so must not
        // make all fifty siblings look under-declared. Before this, adopting
        // the layout pack produced a warning in every skin naming every
        // other scope.
        const { warnings } = issues(ds(
            { variants: ['solid', 'classic'], scopes: { select: { variants: [] } } },
            [button(['solid']), select(['classic'])],
        ));
        expect(has(warnings, 'narrow the `variant` vocabulary')).toBe(false);
    });

    it('warns about a union value that belongs to no scope', () => {
        const { warnings } = issues(ds(
            {
                variants: ['solid', 'classic', 'assist'],
                scopes: { button: { variants: ['solid'] }, select: { variants: ['classic'] } },
            },
            [button(['solid']), select(['classic'])],
        ));
        expect(has(warnings, '"assist" is declared but belongs to no scope\'s vocabulary')).toBe(true);
    });

    it('does not call a value unclaimed while a styled scope is still unrestricted', () => {
        const { warnings } = issues(ds(
            { variants: ['solid', 'classic', 'assist'], scopes: { select: { variants: ['classic'] } } },
            [button(['solid']), select(['classic'])],
        ));
        expect(has(warnings, 'belongs to no scope\'s vocabulary')).toBe(false);
    });
});

// ── the recipes ──────────────────────────────────────────────────────────────

describe('wiring against a per-scope vocabulary', () => {
    it('errors on a value the scope declined, without sending the author to tokens.variants', () => {
        // The message that matters most. "not a declared variant" would send
        // the author to `tokens.variants`, where `ghost` is already sitting —
        // and there is nothing to do there.
        const { errors } = issues(ds(
            {
                variants: ['solid', 'classic', 'ghost'],
                scopes: { button: { variants: ['solid', 'ghost'] }, select: { variants: ['classic'] } },
            },
            [button(['solid', 'ghost']), select(['classic', 'ghost'])],
        ));
        expect(has(errors, 'is not in select\'s variant vocabulary (classic)')).toBe(true);
        expect(has(errors, 'tokens.scopes.select narrows the design-system-wide tokens.variants')).toBe(true);
        expect(has(errors, 'is not a declared variant')).toBe(false);
    });

    it('errors on wiring an axis the scope declared out of existence', () => {
        const { errors } = issues(ds(
            { variants: ['solid'], scopes: { select: { variants: [] } } },
            [button(['solid']), select(['solid'])],
        ));
        expect(has(errors, 'tokens.scopes.select declares no variant axis (variants: [])')).toBe(true);
    });

    it('warns when a scope promises a value and its recipe wires nothing for it', () => {
        // The gap the map exists to make statable: design-system-wide, `surface`
        // IS wired — by nobody who offers it.
        const { warnings } = issues(ds(
            {
                variants: ['solid', 'classic', 'surface'],
                scopes: { button: { variants: ['solid', 'surface'] }, select: { variants: ['classic'] } },
            },
            [button(['solid']), select(['classic', 'surface'])],
        ));
        expect(has(warnings, '"surface" is in button\'s vocabulary but its recipe wires no rule for it')).toBe(true);
    });

    it('holds a scope to its own size ramp, as an error rather than a hint', () => {
        // Not variant-only. A scope that wrote its ramp down has closed the set
        // as deliberately as a design system that wrote one down, so an
        // off-ramp step is an error here even though the design system took the
        // recommended ramp by default.
        const { errors } = issues(ds(
            { scopes: { select: { sizes: ['sm', 'md'] } } },
            [
                button([]),
                {
                    component: 'select',
                    parts: {
                        root: { base: {} },
                        trigger: {
                            base: { color: 'var(--color-base-content)' },
                            states: { 'focus-visible': { outline: '2px solid var(--color-primary)' } },
                        },
                    },
                    variants: { size: { sm: {}, md: {}, lg: { trigger: { base: { minHeight: '3rem' } } } } },
                },
            ],
        ));
        expect(has(errors, 'is not in select\'s size vocabulary (sm, md)')).toBe(true);
    });
});

// ── the gate ─────────────────────────────────────────────────────────────────

describe('the gate: select carries a vocabulary button does not have', () => {
    const input = ds(
        {
            variants: ['solid', 'outline', 'classic', 'surface', 'soft'],
            scopes: {
                button: { variants: ['solid', 'outline'] },
                select: { variants: ['classic', 'surface', 'soft'] },
            },
        },
        [button(['solid', 'outline']), select(['classic', 'surface', 'soft'])],
    );
    const compiled = compileDesignSystem(input, manifest);

    it('validates clean — the two vocabularies are not a mistake', () => {
        const { errors, warnings } = issues(input);
        expect(errors).toEqual([]);
        // The only warnings left are about the 21 components this fixture does
        // not skin, which is not what this file is about.
        expect(warnings.filter((w) => w.startsWith('tokens.'))).toEqual([]);
    });

    it('the manifest carries both the union and each scope\'s part of it', () => {
        expect(compiled.tokens.variants).toEqual(['solid', 'outline', 'classic', 'surface', 'soft']);
        expect(compiled.tokens.scopes['select']).toEqual({ variants: ['classic', 'surface', 'soft'] });
        expect(compiled.components['select']!.offered).toEqual({ variant: ['classic', 'surface', 'soft'] });
        expect(compiled.components['button']!.offered).toEqual({ variant: ['solid', 'outline'] });
    });

    it('register.d.ts narrows each scope to its own vocabulary', () => {
        // Emitted from the HARVEST, not the declaration — which narrows to the
        // scope vocabulary anyway, because wiring outside it is an error, and
        // is strictly stronger: it additionally refuses to type a value the
        // compiled CSS does not implement.
        const dts = compileRegisterDts(compiled);
        expect(dts).toContain("variant: 'classic' | 'surface' | 'soft';");
        expect(dts).toContain("variant: 'solid' | 'outline';");
    });

    it('the report narrows too, and reports nothing unclaimed', () => {
        const report = buildReport(compiled, input, manifest);
        const selectAxes = report.components['select'];
        const buttonAxes = report.components['button'];
        expect(selectAxes!.styled && selectAxes.axes.variant).toEqual({
            wired: ['classic', 'soft', 'surface'],
            status: 'wired',
            offered: ['classic', 'soft', 'surface'],
        });
        expect(buttonAxes!.styled && buttonAxes.axes.variant.offered).toEqual(['outline', 'solid']);
        expect(report.vocabulary.scopes['select']).toEqual({ variants: ['classic', 'surface', 'soft'] });
        expect(report.unclaimed.variant).toEqual([]);

        // …and the partition stops calling a declared narrowing "divergence".
        // Both scopes wire a strict subset of the union anything wires, which
        // is what they said they would do.
        expect(report.divergence['variant']!.declared.sort()).toEqual(['button', 'select']);
    });

    it('a scope may also decline the axis entirely, and the artifacts say so', () => {
        const declined = ds(
            { variants: ['solid'], scopes: { button: { variants: ['solid'] }, select: { variants: [] } } },
            [button(['solid']), select([])],
        );
        const c = compileDesignSystem(declined, manifest);
        const dts = compileRegisterDts(c);
        expect(dts).toContain('probe declares no variant axis for select');
        const report = buildReport(c, declined, manifest);
        const selectReport = report.components['select'];
        expect(selectReport!.styled && selectReport.axes.variant.status).toBe('undeclared');
        // Design-system-wide, `variant` is emphatically declared — the claim is
        // this scope's, so it must not leak into the vocabulary's own summary.
        expect(report.vocabulary.declaredOut).not.toContain('variant');
    });
});
