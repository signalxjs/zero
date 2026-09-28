/**
 * A `multiple` combobox wraps its tags onto new rows inside the control
 * (`flex-wrap: wrap`), so the control's height must be a floor, never a cap:
 * a fixed `height` pins it to one row and the wrapped tags spill out over
 * whatever follows the field (#407). Every shipped design system, web and
 * lynx, is held to that here.
 */
import { describe, expect, it } from 'vitest';
import { compileDesignSystem } from '@sigx/zero-kit';
import type { CompiledDesignSystem, ManifestComponent } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { compileDesignSystemLynx } from '../src/targets/lynx/index.js';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { designSystem as daisyDS } from '@sigx/zero-daisyui';
import { designSystem as materialDS } from '@sigx/zero-material';
import { designSystem as brutalistDS } from '@sigx/zero-brutalist';
import { designSystem as herouiDS } from '@sigx/zero-heroui';
import { designSystem as carbonDS } from '@sigx/zero-carbon';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

const SYSTEMS: ReadonlyArray<readonly [string, CompiledDesignSystem]> = [
    ['basic', compileDesignSystem(basicDS, manifest)],
    ['daisyui', compileDesignSystem(daisyDS, manifest)],
    ['material', compileDesignSystem(materialDS, manifest)],
    ['brutalist', compileDesignSystem(brutalistDS, manifest)],
    ['heroui', compileDesignSystem(herouiDS, manifest)],
    ['carbon', compileDesignSystem(carbonDS, manifest)],
];

/** Every declaration block whose selector ends on the combobox control part. */
const controlBlocks = (css: string): string[] =>
    [...css.matchAll(/\[data-scope="combobox"\]\[data-part="control"\][^{,]*\{([^}]*)\}/g)].map((m) => m[1]!);

/** A fixed `height:` — `height: auto` and `min-height:` are fine. */
const FIXED_HEIGHT = /(?:^|[;\s])height:\s*(?!auto\b)[^\s;]/;

describe.each(SYSTEMS)('%s combobox control', (_name, compiled) => {
    it('never fixes its height, so wrapped tags grow the box', () => {
        const blocks = controlBlocks(compiled.componentCss['combobox']!);
        expect(blocks.length).toBeGreaterThan(0);
        for (const block of blocks) expect(block).not.toMatch(FIXED_HEIGHT);
    });
});

describe('zero-daisyui combobox control', () => {
    it('keeps the field step as a floor, on web and lynx', () => {
        const web = compileDesignSystem(daisyDS, manifest).componentCss['combobox']!;
        expect(web).toMatch(/\[data-scope="combobox"\]\[data-part="control"\] \{[^}]*min-height: calc\(var\(--size-field\) \* 12\);/);

        const lynx = compileDesignSystemLynx(daisyDS as never, manifest).componentCss['combobox']!;
        expect(lynx).toMatch(/\.zx-combobox__control \{[^}]*min-height: calc\(var\(--size-field\) \* 12\);/);
        const lynxControl = [...lynx.matchAll(/\.zx-combobox__control[^{]*\{([^}]*)\}/g)].map((m) => m[1]!);
        for (const block of lynxControl) expect(block).not.toMatch(FIXED_HEIGHT);
    });
});
