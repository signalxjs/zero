/**
 * The states-look-alike guard — the six in-repo skins, through the kit's
 * `state-legibility/*` audit rules.
 *
 * The rules themselves live in `src/audit/rules/state-legibility.ts` (#403),
 * lifted verbatim from this file so that a design system generated OUTSIDE
 * this repo gets the same three assertions through `auditDesignSystem`. The
 * reasoning — why the compiled CSS and not the recipe tree, what counts as a
 * difference, why three rules and not one — moved with the code and is the
 * docblock there. What stays here is what is a fact about THIS repo: the
 * six skins are clean, the disclosure rule is pointed at exactly the three
 * in-flow components it claims, avatar's `hiddenIn` reaches the manifest,
 * and the guard's own teeth — state-blind fixtures the rules MUST report.
 */
import { describe, it, expect } from 'vitest';
import { auditDesignSystem, compileDesignSystem, compileRecipeCss } from '@sigx/zero-kit';
import type { AuditFinding, AuditRuleId, CompiledDesignSystem, DesignSystemInput, ManifestComponent, PartStyles, RecipeInput } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { designSystem as daisyDS } from '@sigx/zero-daisyui';
import { designSystem as materialDS } from '@sigx/zero-material';
import { designSystem as brutalistDS } from '@sigx/zero-brutalist';
import { designSystem as herouiDS } from '@sigx/zero-heroui';
import { designSystem as carbonDS } from '@sigx/zero-carbon';
import {
    caseOf,
    componentFindings,
    disclosureFindings,
    distinguishes,
    fingerprint,
    indicatorFindings,
    isOverlayComponent,
    isTriggerPart,
    ownGroups,
    pairsOf,
    presenceDiffers,
} from '../src/audit/index.js';
import type { LegibilityCase as Case } from '../src/audit/index.js';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

// Compiled one by one for the same reason `css-golden.test.ts` does it:
// `DesignSystemInput<R>` is invariant in `R`, so the inputs cannot be widened
// into one array, while the compiled results share a non-generic type. The
// recipes ride along because `skipStates` is this guard's exemption and lives on
// the recipe, not in the CSS.
interface System {
    name: string;
    ds: DesignSystemInput;
    recipes: readonly RecipeInput[];
    compiled: CompiledDesignSystem;
}

const SYSTEMS: readonly System[] = [
    { name: 'basic', ds: basicDS as DesignSystemInput, recipes: basicDS.recipes, compiled: compileDesignSystem(basicDS, manifest) },
    { name: 'daisyui', ds: daisyDS as DesignSystemInput, recipes: daisyDS.recipes, compiled: compileDesignSystem(daisyDS, manifest) },
    { name: 'material', ds: materialDS as DesignSystemInput, recipes: materialDS.recipes, compiled: compileDesignSystem(materialDS, manifest) },
    { name: 'brutalist', ds: brutalistDS as DesignSystemInput, recipes: brutalistDS.recipes, compiled: compileDesignSystem(brutalistDS, manifest) },
    { name: 'heroui', ds: herouiDS as DesignSystemInput, recipes: herouiDS.recipes, compiled: compileDesignSystem(herouiDS, manifest) },
    { name: 'carbon', ds: carbonDS as DesignSystemInput, recipes: carbonDS.recipes, compiled: compileDesignSystem(carbonDS, manifest) },
];

/** One rule's findings for one skin, as the messages a reader would see. */
const findingsFor = (system: System, rule: AuditRuleId): string[] =>
    auditDesignSystem(system.ds, manifest, { rules: [rule], compiled: system.compiled })
        .findings.map((f) => `${system.name}/${f.message}`);

const messages = (findings: readonly AuditFinding[]): string[] => findings.map((f) => f.message);

/** Every judgeable unit across the six skins, tagged with its skin for the pins below. */
const CASES: Array<Case & { ds: string }> = SYSTEMS.flatMap(({ name, recipes, compiled }) =>
    manifest.components.flatMap((component) => {
        const css = compiled.componentCss[component.scope];
        const recipe = recipes.find((r) => r.component === component.scope);
        // A component with no recipe is a different failure the validator
        // already warns about ("will render unstyled"); conflating the two would
        // make this fail for a reason it was not built to catch.
        if (!css || !recipe) return [];
        return [{ ds: name, ...caseOf(component, recipe, css) }];
    }));

describe('state legibility', () => {
    it('reads a rule per state out of the compiled CSS', () => {
        // A sanity check on the substrate: if parsing yielded nothing, every
        // assertion below would pass vacuously.
        expect(CASES.length).toBeGreaterThan(100);
        const checkbox = CASES.find((c) => c.ds === 'material' && c.scope === 'checkbox')!;
        expect(checkbox.groups).toContain('control');
        expect(checkbox.groups).toContain('indicator');
        expect(fingerprint(checkbox.rules, 'control', 'checked').length).toBeGreaterThan(0);
    });

    it.each(SYSTEMS.map((s) => s.name))('%s: no component renders two of a part\'s states alike', (ds) => {
        expect(findingsFor(SYSTEMS.find((s) => s.name === ds)!, 'state-legibility/component')).toEqual([]);
    });

    it.each(SYSTEMS.map((s) => s.name))('%s: every stateful indicator part differs across its states', (ds) => {
        expect(findingsFor(SYSTEMS.find((s) => s.name === ds)!, 'state-legibility/indicator')).toEqual([]);
    });

    it.each(SYSTEMS.map((s) => s.name))('%s: every in-flow disclosure control differs across its states', (ds) => {
        expect(findingsFor(SYSTEMS.find((s) => s.name === ds)!, 'state-legibility/disclosure')).toEqual([]);
    });

    it('the audit runs the three rules over the same cases this file reads', () => {
        // The thin-caller contract: what `auditDesignSystem` judges is exactly
        // what the primitives judge case by case — otherwise a green audit
        // above could be a rule that silently skipped a scope.
        const basic = SYSTEMS[0]!;
        const direct = CASES.filter((c) => c.ds === 'basic')
            .flatMap((c) => [...componentFindings(c), ...indicatorFindings(c), ...disclosureFindings(c)])
            .map((f) => f.message).sort();
        const audited = auditDesignSystem(basic.ds, manifest, {
            rules: ['state-legibility/component', 'state-legibility/indicator', 'state-legibility/disclosure'],
        }).findings.map((f) => f.message).sort();
        expect(audited).toEqual(direct);
        // …and the waivers are listed rather than swallowed: material's
        // checkbox skips the selection states on `root` and `label`, and
        // avatar's `hiddenIn` excuses every pair of its three states.
        const material = SYSTEMS.find((s) => s.name === 'material')!;
        const waived = auditDesignSystem(material.ds, manifest, { rules: ['state-legibility/component'] }).waived;
        expect(waived.some((w) => w.scope === 'avatar' && w.waivedBy.mechanism === 'hiddenIn')).toBe(true);
        expect(waived.every((w) => w.rule === 'state-legibility/component')).toBe(true);
    });

    it('assertion C is pointed at the parts it claims to be pointed at', () => {
        // An assertion nobody can see the scope of is an assertion nobody can
        // trust. Name the three components it judges and the reason the rest
        // are out, so a part rename or a new component shows up here as a
        // change in scope rather than as silence.
        const inFlow = manifest.components
            .filter((c) => !isOverlayComponent(c))
            .filter((c) => c.parts.some((p) => isTriggerPart(p.name) && p.states?.length))
            .map((c) => c.scope);
        expect(inFlow.sort()).toEqual(['accordion', 'collapsible', 'tree-view']);
        // …and the escape hatch is load-bearing for exactly one of them: every
        // design system differentiates tree-view on `branch-indicator` and none
        // on `branch-trigger`, while collapsible and accordion have no
        // indicator part to hand the signal to.
        const tree = CASES.find((c) => c.ds === 'basic' && c.scope === 'tree-view')!;
        expect(disclosureFindings(tree)).toEqual([]);
        expect(ownGroups(tree, 'branch-trigger')
            .some((g) => distinguishes(tree.rules, g, 'open', 'closed'))).toBe(false);
        expect(ownGroups(tree, 'branch-indicator')
            .some((g) => distinguishes(tree.rules, g, 'open', 'closed'))).toBe(true);
    });

    it('the presence exemption comes from the manifest, and avatar still claims it', () => {
        // The exemption is only as real as the declaration it reads, so name
        // the cause here rather than leaving it to be inferred. If `hiddenIn`
        // stopped reaching the manifest, the assertions above WOULD fail — but
        // they would fail with sixteen findings against six design systems,
        // reading as "everyone's avatar is unstyled" rather than as "the
        // plumbing broke", and the tempting fix would be to restate the fact
        // six times in `skipStates`. This fails first, and points at the
        // anatomy. Avatar is the case the field was added for.
        const avatar = manifest.components.find((c) => c.scope === 'avatar')!;
        const hiddenIn = Object.fromEntries(
            avatar.parts.filter((p) => p.hiddenIn?.length).map((p) => [p.name, p.hiddenIn]));
        expect(hiddenIn).toEqual({ image: ['error'], fallback: ['loaded'] });
        // …and it covers every pair of avatar's states, which is why avatar is
        // silent here despite painting all three identically everywhere.
        const c = CASES.find((x) => x.ds === 'basic' && x.scope === 'avatar')!;
        for (const [a, b] of pairsOf(['loading', 'loaded', 'error'])) {
            expect(presenceDiffers(c, ['root', 'image', 'fallback'], a, b), `${a}/${b}`).toBe(true);
        }
    });
});

/**
 * The guard's own teeth.
 *
 * Everything above asserts that six design systems are clean, which is exactly
 * what a guard that finds nothing also reports. So the failure mode gets its own
 * coverage: state-blind fixture recipes, compiled through the real compiler,
 * that the assertions above MUST report. Three of these are mutations that
 * passed an earlier draft of this file — the forced-colors glyph, the print
 * glyph and the transition-only state — and each one made the assertion vacuous
 * for the very pair (#212's `checked`/`indeterminate`) it was written to
 * protect.
 */
describe('the guard\'s own teeth', () => {
    const checkbox = manifest.components.find((c) => c.scope === 'checkbox')!;

    const fixture = (
        parts: RecipeInput['parts'],
        skipStates?: RecipeInput['skipStates'],
        // The anatomy is a parameter because one exemption — `hiddenIn` —
        // lives there rather than in the recipe.
        component: ManifestComponent = checkbox,
    ): { c: Case; css: string } => {
        const recipe: RecipeInput = { component: 'checkbox', parts, ...(skipStates ? { skipStates } : {}) };
        const css = compileRecipeCss(recipe, component);
        return { c: caseOf(component, recipe, css), css };
    };

    /** The same checkbox, but the runtime hides `indicator` in the given states. */
    const hidingIndicator = (...hiddenIn: string[]): ManifestComponent => ({
        ...checkbox,
        parts: checkbox.parts.map((p) => (p.name === 'indicator' ? { ...p, hiddenIn } : p)),
    });

    /** A control that says "selected" without saying which kind — as they all do. */
    const control: PartStyles = {
        base: { width: '1rem', height: '1rem', border: '1px solid gray' },
        states: {
            checked: { background: 'blue' },
            indeterminate: { background: 'blue' },
            unchecked: {},
        },
    };

    /** #212 verbatim: three declared states, one empty box, nothing drawn. */
    const blind: PartStyles = {
        base: { width: '100%', height: '100%' },
        states: { checked: {}, unchecked: {}, indeterminate: {} },
    };

    const GLYPH_FALLBACK: PartStyles = {
        selectors: {
            '&[data-state="checked"]::before': { content: '"\\2713"' },
            '&[data-state="indeterminate"]::before': { content: '"\\2212"' },
        },
    };

    it('reports an indicator that draws nothing', () => {
        const { c } = fixture({ control, indicator: blind });
        expect(indicatorFindings(c)).toHaveLength(1);
        expect(messages(indicatorFindings(c))[0]).toContain('"checked"/"indeterminate"');
        expect(messages(indicatorFindings(c))[0]).toContain('"checked"/"unchecked"');
    });

    it('reports it even when a forced-colors or print glyph tells the states apart', () => {
        const { c, css } = fixture({
            control,
            indicator: { ...blind, at: { 'forced-colors': GLYPH_FALLBACK, print: GLYPH_FALLBACK } },
        });
        // The fallback really is in the artifact — this is not a compile failure
        // dressed up as a finding.
        expect(css).toContain('@media (forced-colors: active)');
        expect(css).toContain('@media print');
        expect(css.match(/content: "\\2713"/g)).toHaveLength(2);
        expect(messages(indicatorFindings(c))[0]).toContain('"checked"/"indeterminate"');
    });

    it('reports it when the only difference is how the state arrives', () => {
        const { c, css } = fixture({
            control,
            indicator: {
                ...blind,
                states: {
                    checked: { transition: 'scale 150ms linear' },
                    indeterminate: { transition: 'scale 400ms linear', willChange: 'scale' },
                    unchecked: {},
                },
            },
        });
        expect(css).toContain('transition: scale 150ms linear');
        expect(messages(indicatorFindings(c))[0]).toContain('"checked"/"indeterminate"');
    });

    it('accepts a mark that is actually drawn', () => {
        const { c } = fixture({
            control,
            indicator: {
                ...blind,
                states: {
                    checked: { clipPath: 'polygon(0 0, 100% 0, 100% 100%)' },
                    indeterminate: { clipPath: 'polygon(0 40%, 100% 40%, 100% 60%, 0 60%)' },
                    unchecked: { clipPath: 'polygon(0 0, 0 0, 0 0)' },
                },
            },
        });
        expect(indicatorFindings(c)).toEqual([]);
    });

    it('does not let a sibling part\'s skipStates excuse the indicator', () => {
        // The real shape of this: zero-brutalist's radio-group skips
        // `checked`/`unchecked` on `item` and `item-label`.
        const { c } = fixture(
            { control, indicator: blind, label: { base: { fontSize: '1rem' } } },
            { control: ['checked', 'unchecked', 'indeterminate'], label: ['checked'] },
        );
        expect(messages(indicatorFindings(c))[0]).toContain('"checked"/"indeterminate"');
    });

    it('honours skipStates declared on the indicator itself', () => {
        const { c } = fixture(
            { control, indicator: blind },
            { indicator: ['checked', 'unchecked', 'indeterminate'] },
        );
        expect(indicatorFindings(c)).toEqual([]);
        // …and only for the states it names.
        const partial = fixture({ control, indicator: blind }, { indicator: ['indeterminate'] });
        expect(messages(indicatorFindings(partial.c))[0]).toContain('"checked"/"unchecked"');
        expect(messages(indicatorFindings(partial.c))[0]).not.toContain('"checked"/"indeterminate"');
    });

    it('reports a component where no part tells two states apart', () => {
        const { c } = fixture({ control, indicator: blind });
        // `control` paints `checked` and `indeterminate` the same and the
        // indicator paints nothing, so the component as a whole cannot say
        // which of the two it is in — #212's render exactly.
        expect(componentFindings(c)).toHaveLength(1);
        expect(messages(componentFindings(c))[0]).toContain('"checked" and "indeterminate"');
    });

    it('does not let a skip on the row and the text excuse the whole component', () => {
        // Material's and daisy's checkboxes both skip the selection states on
        // `root` and `label` — honestly, since neither changes when you tick the
        // box. That must not add up to "the component may render `checked` and
        // `indeterminate` alike".
        const { c } = fixture(
            { control, indicator: blind, label: { base: { fontSize: '1rem' } } },
            { root: ['checked', 'unchecked', 'indeterminate'], label: ['checked', 'unchecked', 'indeterminate'] },
        );
        expect(messages(componentFindings(c))[0]).toContain('"checked" and "indeterminate"');
    });

    it('honours the anatomy\'s hiddenIn, for exactly the states it names', () => {
        // Avatar's shape, run on the fixture: identical CSS, one line of
        // anatomy between "unstyled" and "correct". Same recipe both times.
        const before = fixture({ control, indicator: blind });
        expect(messages(indicatorFindings(before.c))[0]).toContain('"checked"/"indeterminate"');
        expect(componentFindings(before.c)).toHaveLength(1);

        const { c } = fixture({ control, indicator: blind }, undefined, hidingIndicator('indeterminate'));
        // A state that never paints cannot be reported for not painting…
        expect(messages(indicatorFindings(c))[0]).not.toContain('"indeterminate"');
        expect(componentFindings(c)).toEqual([]);
        // …and every other pair still has to earn its difference.
        expect(messages(indicatorFindings(c))[0]).toContain('"checked"/"unchecked"');
    });

    it('does not let a part hidden in BOTH states excuse the component', () => {
        // Presence differentiates only when the part is there in one state and
        // gone in the other. Hidden in both, it is absent either way and says
        // nothing — so the component still owes the reader a difference, and
        // reading `hiddenIn` as "either state is listed" would have waived it.
        const { c } = fixture({ control, indicator: blind }, undefined,
            hidingIndicator('checked', 'indeterminate'));
        expect(componentFindings(c)).toHaveLength(1);
        expect(messages(componentFindings(c))[0]).toContain('"checked" and "indeterminate"');
        // The indicator ITSELF is excused throughout — every pair now involves
        // a state it never renders in, and no recipe can differentiate those.
        // The two assertions ask different questions of the same declaration.
        expect(indicatorFindings(c)).toEqual([]);
    });

    it('accepts a component whose difference lives on a sibling part', () => {
        const { c } = fixture({
            control,
            indicator: {
                ...blind,
                states: {
                    checked: { clipPath: 'polygon(0 0, 100% 0, 100% 100%)' },
                    indeterminate: { clipPath: 'polygon(0 40%, 100% 40%, 100% 60%, 0 60%)' },
                    unchecked: { clipPath: 'polygon(0 0, 0 0, 0 0)' },
                },
            },
        });
        expect(componentFindings(c)).toEqual([]);
    });
});

/**
 * Assertion C's teeth — #220, reconstructed.
 *
 * The one that matters is `the false green`: the same fixture, judged by both
 * assertions, where A says clean and C says broken. That divergence IS the bug
 * report in #248, and if a later edit ever makes the two agree here, one of
 * them has stopped doing its job.
 */
describe('the in-flow disclosure control', () => {
    const collapsible = manifest.components.find((c) => c.scope === 'collapsible')!;
    const treeView = manifest.components.find((c) => c.scope === 'tree-view')!;
    const menu = manifest.components.find((c) => c.scope === 'menu')!;

    const caseFor = (
        component: ManifestComponent,
        parts: RecipeInput['parts'],
        skipStates?: RecipeInput['skipStates'],
    ): Case => {
        const recipe: RecipeInput = {
            component: component.scope, parts, ...(skipStates ? { skipStates } : {}),
        };
        return caseOf(component, recipe, compileRecipeCss(recipe, component));
    };

    /** #220 verbatim: a header that is byte-identical open and closed. */
    const blindTrigger: PartStyles = {
        base: { display: 'flex', justifyContent: 'space-between', padding: '1rem' },
        states: { open: {}, closed: {} },
    };

    /**
     * `<details>` opening, expressed the way material expresses it — the rule
     * that cleared assertion A. Every design system with a `<details>`-backed
     * disclosure writes something like it, because `interpolate-size` plus a
     * `block-size` endpoint is the only way to animate `auto`.
     */
    const detailsPresence: PartStyles = {
        base: { interpolateSize: 'allow-keywords' },
        selectors: {
            '&::details-content': { blockSize: '0', overflow: 'hidden' },
            '&[open]::details-content': { blockSize: 'auto' },
        },
    };

    it('reports a control that declares open/closed and styles neither', () => {
        const c = caseFor(collapsible, { trigger: blindTrigger });
        expect(disclosureFindings(c)).toHaveLength(1);
        expect(messages(disclosureFindings(c))[0]).toContain('collapsible.trigger');
        expect(messages(disclosureFindings(c))[0]).toContain('"open"/"closed"');
        expect(messages(disclosureFindings(c))[0]).toContain('no indicator part');
    });

    it('the false green: assertion A clears what assertion C reports', () => {
        // #220's shape exactly — a blind trigger under a root that carries the
        // presence rules. `groupOf` keys those as `root::details-content`,
        // `[open]` is a NATIVE_PROXY for `open`, so A finds SOME group in the
        // component that tells the states apart and stops looking.
        const c = caseFor(collapsible, { root: detailsPresence, trigger: blindTrigger });
        expect(c.groups).toContain('root::details-content');
        expect(distinguishes(c.rules, 'root::details-content', 'open', 'closed')).toBe(true);
        expect(componentFindings(c)).toEqual([]);
        // …and the browser opening the panel is not the header saying anything.
        expect(disclosureFindings(c)).toHaveLength(1);
        expect(messages(disclosureFindings(c))[0]).toContain('collapsible.trigger');
    });

    it('is not satisfied by the panel either, which a property denylist would have been', () => {
        // The narrower candidate fix — discount `::details-content` because it
        // is the browser's box — would go green again the moment a recipe gave
        // its panel any open-only style. This one still asks the trigger.
        const c = caseFor(collapsible, {
            root: detailsPresence,
            trigger: blindTrigger,
            panel: { states: { open: { paddingBlockEnd: '1rem' }, closed: { paddingBlockEnd: '0' } } },
        });
        expect(componentFindings(c)).toEqual([]);
        expect(disclosureFindings(c)).toHaveLength(1);
    });

    it('accepts a control that says which way it is pointing', () => {
        const c = caseFor(collapsible, {
            root: detailsPresence,
            trigger: {
                ...blindTrigger,
                states: { open: { background: 'rebeccapurple', color: 'white' }, closed: {} },
            },
        });
        expect(disclosureFindings(c)).toEqual([]);
    });

    it('accepts a control whose disclosure marker carries it — tree-view\'s shape', () => {
        const c = caseFor(treeView, {
            'branch-trigger': { base: { display: 'flex' }, states: { open: {}, closed: {} } },
            'branch-indicator': {
                states: { open: { rotate: '90deg' }, closed: { rotate: '0deg' } },
            },
        });
        expect(disclosureFindings(c)).toEqual([]);
        // Only that sibling, though: a difference on the branch row is the
        // "some other part did it" excuse assertion A allows and C does not.
        const elsewhere = caseFor(treeView, {
            branch: { states: { open: { background: 'gainsboro' }, closed: {} } },
            'branch-trigger': { base: { display: 'flex' }, states: { open: {}, closed: {} } },
        });
        expect(componentFindings(elsewhere)).toEqual([]);
        expect(disclosureFindings(elsewhere)).toHaveLength(1);
        expect(messages(disclosureFindings(elsewhere))[0]).toContain('"branch-indicator"');
    });

    it('honours skipStates declared on the control itself', () => {
        const c = caseFor(collapsible, { trigger: blindTrigger }, { trigger: ['open'] });
        expect(disclosureFindings(c)).toEqual([]);
        // …and a skip on a sibling says nothing about the control, exactly as
        // it does not for an indicator.
        const sibling = caseFor(collapsible, { trigger: blindTrigger }, { panel: ['open', 'closed'] });
        expect(disclosureFindings(sibling)).toHaveLength(1);
    });

    it('leaves an overlay trigger alone — the limit it deliberately accepts', () => {
        // A menu declares `popup`, so the revealed thing floats above the page
        // rather than sitting under the control. Whether the trigger also
        // changes is a taste question the six design systems answer differently,
        // and this assertion does not arbitrate it.
        const c = caseFor(menu, {
            trigger: { base: { padding: '0.5rem' }, states: { open: {}, closed: {} } },
            popup: { states: { open: { opacity: '1' }, closed: { opacity: '0' } } },
        });
        expect(disclosureFindings(c)).toEqual([]);
    });
});
