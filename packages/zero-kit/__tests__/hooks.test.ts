/**
 * Declared public hooks (#73) — what a design system derived from a skin may
 * rely on, and the warning for a patch that reaches past it.
 *
 * Four claims:
 *
 * 1. **A hook names something real.** A declared property the recipe never
 *    sets or reads, a keyframe it does not define, a pseudo-element no
 *    selector on that part draws — each is a build error, so the manifest can
 *    never publish a promise the skin cannot keep. Every in-repo skin passes.
 * 2. **Hooks are metadata.** They reach `components[scope].hooks` in the DS
 *    manifest and nothing else: a recipe compiles to the same CSS with or
 *    without them.
 * 3. **Provenance.** `extendDesignSystem` records the base and each patched
 *    recipe as `derivedFrom`.
 * 4. **The warning.** The fixture is andtii/agentic's `overrides.ts` against
 *    zero-daisyui — the consumer this exists for. What it relies on is
 *    declared, so it validates clean; a patch reaching daisy's private names
 *    (a property, a keyframe, a drawn pseudo-element) warns once per name.
 */
import { describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import {
    buildDsManifest,
    compileDesignSystem,
    extendDesignSystem,
    validateDesignSystem,
} from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent, RecipeInput, ValidationIssue } from '@sigx/zero-kit';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { designSystem as daisy } from '@sigx/zero-daisyui';
import { designSystem as materialDS } from '@sigx/zero-material';
import { designSystem as brutalistDS } from '@sigx/zero-brutalist';
import { designSystem as herouiDS } from '@sigx/zero-heroui';
import { designSystem as carbonDS } from '@sigx/zero-carbon';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

const SYSTEMS = [basicDS, daisy, materialDS, brutalistDS, herouiDS, carbonDS] as unknown as DesignSystemInput[];

const byRule = (issues: readonly ValidationIssue[], rule: string) => issues.filter((i) => i.rule === rule);
const lines = (issues: readonly ValidationIssue[]) => issues.map((i) => `${i.where}: ${i.message}`);

const recipe: RecipeInput = {
    component: 'badge',
    tokens: { '--badge-fill': 'var(--color-base-200)' },
    parts: {
        root: {
            base: { background: 'var(--badge-fill)', color: 'var(--badge-ink, currentColor)', animation: 'pulse 1s' },
            selectors: { '&::before': { content: '""' } },
        },
    },
    keyframes: { pulse: 'to { opacity: 0.5 }' },
};

const withBadge = (badge: RecipeInput): DesignSystemInput => ({
    ...(basicDS as unknown as DesignSystemInput),
    recipes: [...(basicDS as unknown as DesignSystemInput).recipes.filter((r) => r.component !== 'badge'), badge],
});

describe('declared hooks — checked at build', () => {
    it.each(SYSTEMS.map((ds) => [ds.name, ds] as const))('%s declares only hooks its recipes have', (_name, ds) => {
        const result = validateDesignSystem(ds, manifest);
        expect(lines(byRule(result.errors, 'hook'))).toEqual([]);
    });

    it('accepts a property the recipe sets or only reads, a defined keyframe, a drawn pseudo-element', () => {
        const ds = withBadge({
            ...recipe,
            hooks: {
                properties: { '--badge-fill': 'The fill.', '--badge-ink': 'The ink — read with a fallback.' },
                keyframes: ['pulse'],
                pseudo: { root: ['::before'] },
            },
        });
        expect(lines(byRule(validateDesignSystem(ds, manifest).errors, 'hook'))).toEqual([]);
    });

    it('refuses a hook that names nothing', () => {
        const ds = withBadge({
            ...recipe,
            hooks: {
                properties: { '--badge-glow': 'Never set.', 'badge-ink': 'Not a custom property.', '--badge-fill': '' },
                keyframes: ['spin'],
                pseudo: { root: ['::after', '::placeholder'] },
            },
        });
        expect(lines(byRule(validateDesignSystem(ds, manifest).errors, 'hook'))).toEqual([
            'recipes.badge.hooks.properties: "--badge-glow" is declared a hook, but the recipe never sets or reads it',
            'recipes.badge.hooks.properties: "badge-ink" is not a custom property name (--kebab-case)',
            'recipes.badge.hooks.properties: "--badge-fill" needs a description — a hook is documentation for the system derived from this one',
            'recipes.badge.hooks.keyframes: "spin" is declared a hook, but the recipe\'s keyframes do not define it',
            'recipes.badge.hooks.pseudo: root::after is declared a hook, but no selectors key on "root" draws it',
            'recipes.badge.hooks.pseudo: root::placeholder: only the generated-content pseudo-elements (::before, ::after) can be hooks — the platform\'s own pseudo-elements are not the recipe\'s to publish',
        ]);
    });
});

describe('declared hooks — metadata in the DS manifest', () => {
    it('emits components[scope].hooks, and nothing for a recipe without them', () => {
        const compiled = compileDesignSystem(daisy as unknown as DesignSystemInput, manifest);
        const dsManifest = buildDsManifest(compiled);
        expect(dsManifest.components['switch']!.hooks!.properties).toHaveProperty('--switch-accent');
        expect(dsManifest.components['dialog']!.hooks).toEqual({ keyframes: ['zero-daisy-pop'] });
        expect(dsManifest.components['collapsible']!.hooks!.pseudo).toEqual({ trigger: ['::after'] });
        expect(dsManifest.components['menu']).not.toHaveProperty('hooks');
    });

    it('never reaches the CSS', () => {
        const stripped = {
            ...(daisy as unknown as DesignSystemInput),
            recipes: (daisy as unknown as DesignSystemInput).recipes.map(({ hooks: _hooks, ...rest }) => rest),
        };
        expect(compileDesignSystem(stripped, manifest).indexCss)
            .toBe(compileDesignSystem(daisy as unknown as DesignSystemInput, manifest).indexCss);
    });
});

describe('extendDesignSystem — provenance', () => {
    it('records the base and each patched recipe, and nothing for a dropped one', () => {
        const baseSwitch = daisy.recipes.find((r) => r.component === 'switch')!;
        const patch = { parts: { control: { base: { boxShadow: 'none' } } } };
        const derived = extendDesignSystem(daisy, { name: 'x', recipes: { switch: patch, kbd: null } });
        expect(derived.derivedFrom!.name).toBe('daisyui');
        expect(Object.keys(derived.derivedFrom!.patches)).toEqual(['switch']);
        expect(derived.derivedFrom!.patches['switch']!.base).toBe(baseSwitch);
        expect(derived.derivedFrom!.patches['switch']!.patch).toBe(patch);
    });
});

describe('the private-name warning — agentic against zero-daisyui', () => {
    const motion = 'var(--duration-fast) var(--ease-standard)';
    const ring = { outline: '2px solid var(--color-primary)', outlineOffset: '2px' };

    /** What andtii/agentic's overrides.ts patches, reduced to the parts that reach into daisy. */
    const agentic = extendDesignSystem(daisy, {
        name: 'control-room',
        recipes: {
            button: { parts: { root: { base: { boxShadow: 'none', transition: `background ${motion}` }, states: { 'focus-visible': ring } } } },
            switch: {
                parts: {
                    control: {
                        states: { checked: { backgroundColor: 'var(--switch-accent)', borderColor: 'var(--switch-accent)' } },
                    },
                },
            },
            badge: { tokens: { '--badge-fill': 'transparent', '--badge-ink': 'var(--color-base-300)' } },
            dialog: { parts: { popup: { states: { open: { animation: 'zero-daisy-pop var(--duration-fast) var(--ease-standard)' } } } } },
            table: {
                tokens: { '--table-pad-block': '14px', '--table-pad-inline': 'var(--space-lg)', '--table-font': 'var(--text-lg)' },
                // Selector-shape reliance has no hook grammar: the anatomy's
                // parts and states are the contract a patch should key on.
                modifiers: {
                    hover: { row: { selectors: { '[data-scope="table"][data-part="body"] > &:hover:not([data-selected])': { background: 'transparent' } } } },
                },
            },
            timeline: { tokens: { '--timeline-marker-size': 'var(--space-sm)', '--timeline-accent': 'var(--color-base-300)' } },
            card: { tokens: { '--card-pad': 'var(--space-xl)' } },
            'toggle-group': { tokens: { '--toggle-group-accent': 'var(--color-base-300)', '--toggle-group-on-accent': 'var(--color-base-content)' } },
            skeleton: { tokens: { '--skeleton-fill': 'var(--color-base-300)' } },
            collapsible: { parts: { trigger: { selectors: { '&::after': { width: '0.35rem', height: '0.35rem' } } } } },
            // A platform pseudo-element is nobody's private name.
            input: { parts: { input: { selectors: { '&::placeholder': { color: 'var(--color-base-300)' } } } } },
        },
    });

    it('relies only on declared hooks, so it validates without a private-name warning', () => {
        const result = validateDesignSystem(agentic, manifest);
        expect(lines(result.errors)).toEqual([]);
        expect(lines(byRule(result.warnings, 'private-name'))).toEqual([]);
    });

    it('warns once per private name a patch reaches — a property, a keyframe, a drawn pseudo-element', () => {
        const reaching = extendDesignSystem(daisy, {
            name: 'reaching',
            recipes: {
                // `--switch-p` is daisy's internal knob padding: read, set and
                // deleted here — one warning.
                switch: { tokens: { '--switch-p': '2px' }, parts: { thumb: { base: { margin: 'var(--switch-p)' } } } },
                // Redefining daisy's spinner keyframes reaches it as surely as naming it.
                button: { keyframes: { 'zero-daisyui-btn-spin': 'to { rotate: 1turn }' } },
                // daisy's menu draws its checkmark on item-indicator::after; that is not a hook.
                menu: { parts: { 'item-indicator': { selectors: { '&[data-state="checked"]::after': { content: '"*"' } } } } },
            },
        });
        // In the base's recipe order.
        const warnings = byRule(validateDesignSystem(reaching, manifest).warnings, 'private-name');
        expect(lines(warnings)).toEqual([
            'recipes.switch: references --switch-p, private to "daisyui" — not a declared hook',
            'recipes.menu: references item-indicator::after, private to "daisyui" — not a declared hook',
            'recipes.button: references keyframes zero-daisyui-btn-spin, private to "daisyui" — not a declared hook',
        ]);
        expect(warnings.map((w) => w.scope)).toEqual(['switch', 'menu', 'button']);
    });

    it('is a warning, never an error, and silent for a system nobody derived', () => {
        const reaching = extendDesignSystem(daisy, { name: 'r', recipes: { switch: { tokens: { '--switch-p': '2px' } } } });
        expect(byRule(validateDesignSystem(reaching, manifest).errors, 'private-name')).toEqual([]);
        expect(byRule(validateDesignSystem(daisy as unknown as DesignSystemInput, manifest).warnings, 'private-name')).toEqual([]);
    });

    it('does not count a hook the patch itself declares as the base publishing it', () => {
        const reaching = extendDesignSystem(daisy, {
            name: 'r',
            recipes: { switch: { hooks: { properties: { '--switch-p': 'Mine now.' } }, tokens: { '--switch-p': '2px' } } },
        });
        expect(lines(byRule(validateDesignSystem(reaching, manifest).warnings, 'private-name'))).toEqual([
            'recipes.switch: references --switch-p, private to "daisyui" — not a declared hook',
        ]);
    });
});
