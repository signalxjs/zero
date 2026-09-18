/**
 * The no-UA-chrome guard — the six in-repo skins, through the kit's
 * `button-affordance` audit rule.
 *
 * The rule lives in `src/audit/rules/button-affordance.ts` (#403), lifted
 * verbatim from this file so a design system generated outside this repo is
 * asked the same question through `auditDesignSystem`. The reasoning — why
 * `appearance` is the proxy, why only the unconditional rule counts — moved
 * with it. What stays here: the six skins are clean, the manifest still
 * carries `element` (else every assertion passes vacuously), and the guard's
 * own teeth — resets behind a state, a variant and a media query that each
 * leave the plain render beveled.
 */
import { describe, it, expect } from 'vitest';
import { auditDesignSystem, compileDesignSystem, compileRecipeCss, parseRules } from '@sigx/zero-kit';
import type { CompiledDesignSystem, DesignSystemInput, ManifestComponent, RecipeInput } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { designSystem as daisyDS } from '@sigx/zero-daisyui';
import { designSystem as materialDS } from '@sigx/zero-material';
import { designSystem as brutalistDS } from '@sigx/zero-brutalist';
import { designSystem as herouiDS } from '@sigx/zero-heroui';
import { designSystem as carbonDS } from '@sigx/zero-carbon';
import { buttonParts, resetsAppearance } from '../src/audit/index.js';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

interface System {
    name: string;
    ds: DesignSystemInput;
    compiled: CompiledDesignSystem;
}

// One by one, for the reason `css-golden.test.ts` and `state-legibility.test.ts`
// give: `DesignSystemInput<R>` is invariant in `R`, so the inputs cannot be
// widened into one array while the compiled results share a non-generic type.
const SYSTEMS: readonly System[] = [
    { name: 'basic', ds: basicDS as DesignSystemInput, compiled: compileDesignSystem(basicDS, manifest) },
    { name: 'daisyui', ds: daisyDS as DesignSystemInput, compiled: compileDesignSystem(daisyDS, manifest) },
    { name: 'material', ds: materialDS as DesignSystemInput, compiled: compileDesignSystem(materialDS, manifest) },
    { name: 'brutalist', ds: brutalistDS as DesignSystemInput, compiled: compileDesignSystem(brutalistDS, manifest) },
    { name: 'heroui', ds: herouiDS as DesignSystemInput, compiled: compileDesignSystem(herouiDS, manifest) },
    { name: 'carbon', ds: carbonDS as DesignSystemInput, compiled: compileDesignSystem(carbonDS, manifest) },
];

/** Every `(scope, part)` zero renders as a real `<button>`. */
const BUTTON_PARTS = buttonParts(manifest);

/** The cells in one design system where a `<button>` keeps its UA chrome. */
const findings = (system: System): string[] =>
    auditDesignSystem(system.ds, manifest, { rules: ['button-affordance'], compiled: system.compiled })
        .findings.map((f) => `${system.name}/${f.where}`);

describe('button affordance', () => {
    it('knows which parts zero renders as a <button>', () => {
        // A sanity check on the substrate: if the manifest stopped carrying
        // `element`, every assertion below would pass vacuously.
        const names = BUTTON_PARTS.map((p) => `${p.scope}.${p.part}`);
        expect(names).toContain('tooltip.trigger');
        expect(names).toContain('button.root');
        expect(names).toContain('toggle-group.item');
        expect(names.length).toBe(29);
    });

    // No allowlist. #213 shipped with three exemptions — heroui's dialog,
    // popover and menu triggers, the last `{ cursor: 'pointer' }` holdouts —
    // and #214 adopted `overlayTrigger` on all three, so there is nothing left
    // to excuse. 18 parts × 6 design systems = 108 cells, all clean
    // (`alert.close` from #311; `dialog.cancel` from #325).
    it.each(SYSTEMS.map((s) => s.name))('%s: no <button> part leaves its paint to the UA', (ds) => {
        const system = SYSTEMS.find((s) => s.name === ds)!;
        expect(findings(system).sort()).toEqual([]);
    });
});

/**
 * The guard's own teeth.
 *
 * Everything above asserts six design systems are clean, which is also what a
 * guard that can see nothing reports. So the failure mode gets fixtures: recipes
 * compiled through the real compiler that this file MUST report, including the
 * three near-misses — a reset behind a state, behind a variant, and behind a
 * media query — that each leave the plain render beveled.
 */
describe('the guard\'s own teeth', () => {
    const tooltip = manifest.components.find((c) => c.scope === 'tooltip')!;

    const report = (parts: RecipeInput['parts']): string[] => {
        const recipe: RecipeInput = { component: 'tooltip', parts };
        const css = compileRecipeCss(recipe, tooltip);
        return resetsAppearance(parseRules(css), 'trigger') ? [] : ['tooltip.trigger'];
    };

    it('reports #213 verbatim — a mentioned part with an empty base', () => {
        expect(report({ trigger: { base: {}, states: { open: {}, closed: {}, disabled: {} } } }))
            .toEqual(['tooltip.trigger']);
    });

    it('reports a part painted everywhere except where the UA is', () => {
        // Background, border and font are all set and the chip survives: the UA
        // still supplies the bevel-shaped box. This is what makes `appearance`
        // the proxy rather than "any declaration".
        expect(report({
            trigger: {
                base: { background: 'red', border: '1px solid blue', fontFamily: 'serif', cursor: 'help' },
                states: { open: {}, closed: {}, disabled: {} },
            },
        })).toEqual(['tooltip.trigger']);
    });

    it('reports a reset that only applies in one state', () => {
        expect(report({
            trigger: { base: {}, states: { open: { appearance: 'none' }, closed: {}, disabled: {} } },
        })).toEqual(['tooltip.trigger']);
    });

    it('reports a reset that only applies on hover', () => {
        expect(report({
            trigger: {
                base: {},
                selectors: { '&:hover': { appearance: 'none' } },
                states: { open: {}, closed: {}, disabled: {} },
            },
        })).toEqual(['tooltip.trigger']);
    });

    it('reports a reset that only applies under a media query', () => {
        const out = report({
            trigger: { base: {}, at: { print: { base: { appearance: 'none' } } }, states: { open: {}, closed: {}, disabled: {} } },
        });
        expect(out).toEqual(['tooltip.trigger']);
    });

    it('accepts an unconditional reset, prefixed or not', () => {
        expect(report({ trigger: { base: { appearance: 'none' }, states: { open: {}, closed: {}, disabled: {} } } }))
            .toEqual([]);
        expect(report({ trigger: { base: { WebkitAppearance: 'none' }, states: { open: {}, closed: {}, disabled: {} } } }))
            .toEqual([]);
    });
});
