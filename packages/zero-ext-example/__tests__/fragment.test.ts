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
import { auditDesignSystem, fitRecipesToVocabulary } from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent, TokensInput } from '@sigx/zero-kit';
import { SIZE_SCALE_LIST } from '@sigx/zero/contract';
import { fragment, recipes } from '@sigx/zero-ext-example/fragment';

const manifest = { components: fragment.components as ManifestComponent[] };

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
});
