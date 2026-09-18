/**
 * llms.txt is generator INPUT: design systems are generated against what it
 * says. It shipped claiming "Eighteen components" while 31 existed, and its
 * variant-axes list omitted six carriers — drift that produces design
 * systems which under-wire axes for real components (#316). These pins tie
 * the two load-bearing claims to the code they describe.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { anatomies } from '@sigx/zero/anatomy';

const pkgRoot = resolve(import.meta.dirname, '..');
const llms = readFileSync(join(pkgRoot, 'llms.txt'), 'utf8');

/** 'radio-group' → 'RadioGroup' — the spelling the prose uses. */
const pascal = (scope: string): string =>
    scope.split('-').map((p) => p[0]!.toUpperCase() + p.slice(1)).join('');

describe('llms.txt matches the code it documents', () => {
    it('states the real component count', () => {
        const match = llms.match(/(\d+) components ship today/);
        expect(match, 'the component-count sentence must exist').not.toBeNull();
        expect(Number(match![1])).toBe(Object.keys(anatomies).length);
    });

    it('lists exactly the components that carry the variant axes', () => {
        // The carriers, derived from source: a component whose module
        // composes WithVariantAxes<'scope'> accepts the axis props.
        const componentsDir = join(pkgRoot, 'src/components');
        const carriers = new Set<string>();
        for (const scope of readdirSync(componentsDir)) {
            const dir = join(componentsDir, scope);
            for (const file of readdirSync(dir)) {
                if (!file.endsWith('.tsx')) continue;
                if (readFileSync(join(dir, file), 'utf8').includes(`WithVariantAxes<'${scope}'>`)) {
                    carriers.add(pascal(scope));
                }
            }
        }
        expect(carriers.size, 'carrier derivation must find components').toBeGreaterThan(0);

        const sentence = llms.match(
            /Variant axes \(`color`\/`size`\/`variant`\) are accepted by ([\s\S]*?);/,
        );
        expect(sentence, 'the carrier sentence must exist').not.toBeNull();
        const listed = sentence![1]!
            .replace(/\band\b/g, ',')
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean);

        expect([...listed].sort()).toEqual([...carriers].sort());
    });
});
