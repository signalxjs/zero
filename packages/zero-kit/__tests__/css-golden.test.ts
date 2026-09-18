/**
 * Golden fixtures for the compiled CSS of every shipped design system.
 *
 * The kit's unit tests assert that individual features appear somewhere in the
 * output (`toContain`), which cannot see ordering, layering, specificity or
 * emission regressions — and those are exactly what the compiler's correctness
 * rests on (the `:where(:root)` → `[data-theme]` specificity ladder, the
 * anatomy-wins-over-pseudo-class rule, at-rule placement).
 *
 * These snapshots are the whole artifact, byte for byte. A PR that does not
 * intend to change emitted CSS must leave them untouched; a PR that does must
 * show the diff in review. `@sigx/zero`'s token-contract rearchitecture used
 * "compiled CSS is byte-identical" as its regression gate, verified by hand —
 * this makes that gate a test.
 *
 * Update deliberately with `pnpm test -u` and read the diff.
 */
import { describe, it, expect } from 'vitest';
import { compileDesignSystem } from '@sigx/zero-kit';
import type { CompiledDesignSystem, ManifestComponent } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { designSystem as daisyDS } from '@sigx/zero-daisyui';
import { designSystem as materialDS } from '@sigx/zero-material';
import { designSystem as brutalistDS } from '@sigx/zero-brutalist';
import { designSystem as herouiDS } from '@sigx/zero-heroui';
import { designSystem as carbonDS } from '@sigx/zero-carbon';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

// Compile each design system against its own concrete role declaration —
// `DesignSystemInput<R>` is invariant in `R`, so the two cannot be widened
// into one array. `CompiledDesignSystem` is not generic, so the *results*
// share a type and the suite below can be written once.
const SYSTEMS: ReadonlyArray<readonly [string, CompiledDesignSystem]> = [
    ['basic', compileDesignSystem(basicDS, manifest)],
    ['daisyui', compileDesignSystem(daisyDS, manifest)],
    ['material', compileDesignSystem(materialDS, manifest)],
    ['brutalist', compileDesignSystem(brutalistDS, manifest)],
    ['heroui', compileDesignSystem(herouiDS, manifest)],
    ['carbon', compileDesignSystem(carbonDS, manifest)],
];

describe.each(SYSTEMS)('%s compiled CSS', (name, compiled) => {
    it('tokens.css', async () => {
        await expect(compiled.tokensCss).toMatchFileSnapshot(
            `./__snapshots__/css/${name}/tokens.css`,
        );
    });

    it.each(Object.keys(compiled.componentCss).sort())('%s.css', async (scope) => {
        await expect(compiled.componentCss[scope]).toMatchFileSnapshot(
            `./__snapshots__/css/${name}/components/${scope}.css`,
        );
    });

    it('index.css', async () => {
        await expect(compiled.indexCss).toMatchFileSnapshot(
            `./__snapshots__/css/${name}/index.css`,
        );
    });
});
