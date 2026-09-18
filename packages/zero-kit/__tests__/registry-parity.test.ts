/**
 * The theme registry must agree with the design system's own manifest.
 *
 * Every design system compiles theme metadata into `dist/manifest.json` (the
 * kit's job) and seeds the same metadata into zero's runtime registry via
 * `installThemes()` (the browser's job). Those are two derivations of one
 * declaration, and until #57 they were written independently — so
 * `@sigx/zero-basic` shipped a manifest naming six swatch tokens and a
 * registry holding four, and nothing noticed.
 *
 * This is what notices. It runs against every shipped design system, so it
 * also covers the NEXT one: a design system whose distinguishing colours
 * aren't `primary`/`neutral` gets a picker that matches its manifest, or this
 * fails.
 */
import { describe, it, expect } from 'vitest';
import { compileDesignSystem } from '@sigx/zero-kit';
import type { CompiledDesignSystem, ManifestComponent } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { getTheme, listThemes } from '@sigx/zero';
import * as basic from '@sigx/zero-basic';
import * as daisy from '@sigx/zero-daisyui';
import * as material from '@sigx/zero-material';
import * as brutalist from '@sigx/zero-brutalist';
import * as heroui from '@sigx/zero-heroui';
import * as carbon from '@sigx/zero-carbon';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

// The registry is a module-level Map keyed by theme name, so installing every
// design system into one process is only safe because their theme names don't
// collide (basic/basic-dark, light/dark, material/material-dark,
// brutalist/brutalist-dark). Assert that rather than assume it — a future
// design system that reused a name would otherwise make this suite lie.
const SYSTEMS: ReadonlyArray<readonly [string, CompiledDesignSystem, () => void]> = [
    ['basic', compileDesignSystem(basic.designSystem, manifest), basic.installThemes],
    ['daisyui', compileDesignSystem(daisy.designSystem, manifest), daisy.installThemes],
    ['material', compileDesignSystem(material.designSystem, manifest), material.installThemes],
    ['brutalist', compileDesignSystem(brutalist.designSystem, manifest), brutalist.installThemes],
    ['heroui', compileDesignSystem(heroui.designSystem, manifest), heroui.installThemes],
    ['carbon', compileDesignSystem(carbon.designSystem, manifest), carbon.installThemes],
];

for (const [, , installThemes] of SYSTEMS) installThemes();

describe('registry ↔ manifest parity', () => {
    it('every design system uses distinct theme names', () => {
        const all = SYSTEMS.flatMap(([, compiled]) => compiled.themes.map((t) => t.name));
        expect(new Set(all).size).toBe(all.length);
        expect(listThemes()).toHaveLength(all.length);
    });

    describe.each(SYSTEMS)('%s', (_name, compiled) => {
        it.each(compiled.themes.map((t) => [t.name, t] as const))(
            '%s registers exactly what it compiles',
            (name, compiledTheme) => {
                // `toEqual`, not `toStrictEqual`: the compiler omits `pair`
                // when a theme has none, while `registerTheme` stores it as
                // `undefined`. Same theme, different spelling of absent.
                expect(getTheme(name)).toEqual(compiledTheme);
            },
        );

        it('samples the swatch the design system declared', () => {
            const declared = compiled.themes[0]!.swatch;
            // Non-empty, or the assertion above would pass vacuously on a
            // design system whose swatch derivation silently produced nothing.
            expect(Object.keys(declared).length).toBeGreaterThan(0);
            for (const theme of compiled.themes) {
                expect(Object.keys(getTheme(theme.name)!.swatch!)).toEqual(Object.keys(declared));
            }
        });
    });
});
