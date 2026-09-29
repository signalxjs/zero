/**
 * The recipe pack, audited the way an adopting design system audits it
 * (#192): every axis the adopter declares must be wired, and the pack must
 * answer to the adopter's scalar tokens rather than hard-code its own.
 *
 * Two adopters, because the pack is fitted to the vocabulary it lands in:
 * the recommended five-step ramp (zero-basic's shape) and a closed
 * three-step one (zero-heroui's `sm | md | lg`), where the fit drops the
 * off-ramp steps and what survives must still wire the axis.
 */
import { describe, it, expect } from 'vitest';
import { auditDesignSystem, compileDesignSystem, fitRecipesToVocabulary, validateDesignSystem } from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent, TokensInput } from '@sigx/zero-kit';
import { SIZE_SCALE_LIST } from '@sigx/zero/contract';
import { fragment, recipes } from '@sigx/zero-ext-example/fragment';

const components: ManifestComponent[] = fragment.components;
const manifest = { components };

const tokens = (sizes: readonly string[]): TokensInput => ({
    roles: { primary: {} },
    sizes: [...sizes],
    themes: {
        day: {
            colorScheme: 'light',
            colors: {
                'base-100': 'white', 'base-200': 'white', 'base-300': 'gray',
                'base-content': 'black', primary: 'blue', 'primary-content': 'white',
            },
        },
    },
    defaultLight: 'day',
});

const adopter = (sizes: readonly string[]): DesignSystemInput => {
    const t = tokens(sizes);
    return { name: 'adopter', tokens: t, recipes: fitRecipesToVocabulary(recipes, t) };
};

describe('ext-stepper recipe pack', () => {
    for (const [name, sizes] of [['recommended ramp', SIZE_SCALE_LIST], ['closed sm|md|lg ramp', ['sm', 'md', 'lg']]] as const) {
        it(`wires the size axis for an adopter declaring the ${name}`, () => {
            const { findings } = auditDesignSystem(adopter(sizes), manifest, { rules: ['axis-coverage'] });
            expect(findings.map((f) => f.where)).toEqual([]);
        });
    }

    it('keys every recommended size step', () => {
        const stepper = recipes.find((r) => r.component === 'ext-stepper')!;
        expect(Object.keys(stepper.variants?.size ?? {})).toEqual([...SIZE_SCALE_LIST]);
    });

    it("fades a disabled item by the adopter's --disabled-opacity, not a literal", () => {
        const stepper = recipes.find((r) => r.component === 'ext-stepper')!;
        const opacity = stepper.parts.item?.states?.disabled?.opacity;
        expect(opacity).toMatch(/^var\(--disabled-opacity\b/);
    });

    describe('the runtime property the root publishes (#456)', () => {
        it('rides the fragment, so an adopter learns it from the manifest', () => {
            expect(components[0]!.runtimeProperties).toEqual(['--ext-stepper-count']);
        });

        it('is read bare in the web target only, and validates without a declaration', () => {
            const ds = adopter(SIZE_SCALE_LIST);
            const result = validateDesignSystem(ds, manifest);
            expect(result.errors.map((e) => e.message).filter((m) => m.includes('--ext-stepper-count'))).toEqual([]);
            expect(result.errors).toEqual([]);
            const css = compileDesignSystem(ds, manifest).componentCss['ext-stepper']!;
            expect(css).toContain('repeat(var(--ext-stepper-count), minmax(min-content, 1fr))');
            // Web-only: the shared section never reads it, so the lynx view
            // keeps the pack (the lynx compile itself is held in the kit's
            // lynx-recipe-css suite).
            const stepper = recipes.find((r) => r.component === 'ext-stepper')!;
            expect(JSON.stringify(stepper.parts)).not.toContain('--ext-stepper-count');
            expect(JSON.stringify(stepper.variants)).not.toContain('--ext-stepper-count');
        });
    });
});
