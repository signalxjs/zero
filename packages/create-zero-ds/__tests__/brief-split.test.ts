/**
 * The brief split convention, pinned against every brief in the pack.
 *
 * The scaffold cuts a brief at the end of its `tokens` block (head →
 * `src/tokens.ts`, tail → `src/button.ts`). That only works while every brief
 * keeps `tokens` as the last token-side export and `button` in the tail — so
 * this test reads the real files and fails the day a brief reorders them,
 * instead of the scaffold writing a module that does not compile.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportedNames, referencedNames, splitBrief, withoutTypeImport } from '../src/brief.js';

const briefsDir = resolve(import.meta.dirname, '../../zero-kit/skills/design-system/briefs');
const briefs = readdirSync(briefsDir).filter((f) => f.endsWith('.ts')).sort();

describe.each(briefs)('brief %s splits at the end of its tokens block', (file) => {
    const source = readFileSync(resolve(briefsDir, file), 'utf8');
    const split = splitBrief(source);

    it('head ends with the tokens export and carries every token-side export', () => {
        expect(split.tokens.trimEnd().endsWith('};')).toBe(true);
        expect(split.tokens).toMatch(/^export const tokens\b/m);
        const heads = exportedNames(split.tokens);
        expect(heads).toContain('brief');
        expect(heads).toContain('roles');
        expect(heads).toContain('system');
        expect(heads.at(-1)).toBe('tokens');
    });

    it('tail is the Button recipe, and references only head exports it can import', () => {
        expect(split.button).toBeDefined();
        expect(split.button).toMatch(/^export const button: RecipeInput = \{/m);
        expect(split.button).not.toMatch(/^export const tokens\b/m);
        // Whatever the tail references from the head, it must be an export —
        // a `const` the head keeps private would leave the tail dangling.
        const needed = referencedNames(split.button!, exportedNames(split.tokens));
        // Every brief's Button reads at least one token-side export — `roles`
        // for the colour loop, `system` where the recipe reads the ramp.
        expect(needed.length).toBeGreaterThan(0);
        const privateHeads = [...split.tokens.matchAll(/^const ([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]!);
        for (const name of referencedNames(split.button!, privateHeads)) {
            expect.fail(`${file}: the Button tail references private head binding "${name}"`);
        }
    });

    it('the head drops RecipeInput from its type import without disturbing the rest', () => {
        const head = withoutTypeImport(split.tokens, 'RecipeInput');
        expect(head).not.toMatch(/\bRecipeInput\b/);
        expect(head).toMatch(/^import type \{ [^}]*TokensInput[^}]* \} from '@sigx\/zero-kit';$/m);
    });
});

describe('the basic brief (zero-basic tokens.ts) has no tail', () => {
    it('splits into tokens only', () => {
        const source = readFileSync(resolve(import.meta.dirname, '../../zero-basic/src/tokens.ts'), 'utf8');
        const split = splitBrief(source);
        expect(split.button).toBeUndefined();
        expect(exportedNames(split.tokens).at(-1)).toBe('tokens');
    });
});

describe('referencedNames', () => {
    it('sees identifiers, not property keys or member accesses', () => {
        const tail = 'const a = { variants: { x: roles }, y: obj.modifiers, z: custom }';
        expect(referencedNames(tail, ['variants', 'roles', 'modifiers', 'custom', 'system'])).toEqual(['roles', 'custom']);
    });
});
