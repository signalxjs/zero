/**
 * Docs drift guard (#197): every count the docs state about the tree is held
 * to the tree.
 *
 * The prose said "50 unstyled components" (58), "zero-basic's 50 recipes"
 * (52), heroui/carbon "40 components" (52 recipes), "six isolated tsconfig
 * projects" (seven), typed-app's `skipLibCheck` "stays true" (it is false),
 * the ext-example adoption as a `build.mjs` hand-edit (it is devDependency
 * discovery now, in two skins) and "one anatomy, four skins" (six) — each
 * true once, each left behind by a PR that changed the tree and not the
 * sentence. A count nobody re-derives is a count that rots, so each one is
 * derived here from its source of truth and every phrasing of it in the docs
 * must agree.
 *
 * Each pattern must match at least once overall: rewording a sentence out
 * from under its check fails here instead of silently retiring the guard.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { anatomies } from '@sigx/zero/anatomy';
import { recipes as basicRecipes } from '../../packages/zero-basic/src/recipes.js';
import { recipes as heroRecipes } from '../../packages/zero-heroui/src/recipes.js';
import { recipes as carbonRecipes } from '../../packages/zero-carbon/src/recipes.js';
import { DESIGN_SYSTEM_LIST } from '../../examples/playground/src/design-system-list.js';

const root = resolve(import.meta.dirname, '../..');
const read = (p: string): string => readFileSync(resolve(root, p), 'utf-8');

const WORDS: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};
const toNumber = (raw: string): number => WORDS[raw.toLowerCase()] ?? Number(raw);

/** Every capture of `pattern` across `files`, as `file: number`. */
function claims(files: readonly string[], pattern: RegExp): { where: string; value: number }[] {
    const out: { where: string; value: number }[] = [];
    for (const file of files) {
        for (const match of read(file).matchAll(pattern)) {
            for (const group of match.slice(1)) {
                if (group !== undefined) out.push({ where: `${file}: "${match[0]}"`, value: toNumber(group) });
            }
        }
    }
    return out;
}

function expectClaims(files: readonly string[], pattern: RegExp, actual: number): void {
    const found = claims(files, pattern);
    expect(found.length, `no file states ${pattern} any more — reword the check with the sentence`).toBeGreaterThan(0);
    expect(found.filter((c) => c.value !== actual).map((c) => c.where), `the tree says ${actual}`).toEqual([]);
}

const typeTestProjects = [...(JSON.parse(read('package.json')) as { scripts: Record<string, string> })
    .scripts['test:types']!.matchAll(/-p packages\/zero\/type-tests\/([a-z-]+)\/tsconfig\.json/g)].map((m) => m[1]!);

describe('the counts the docs state', () => {
    it('zero ships as many unstyled components as it has anatomies', () => {
        expectClaims(['README.md'], /\b(\d+) unstyled components/g, Object.keys(anatomies).length);
    });

    it("zero-basic's baseline recipe count, wherever the scaffold is described", () => {
        expectClaims([
            'README.md',
            'AGENTS.md',
            'docs/architecture.md',
            'packages/create-zero-ds/README.md',
            'packages/create-zero-ds/src/cli.ts',
            'packages/zero-kit/README.md',
            'packages/zero-kit/skills/design-system/SKILL.md',
            'packages/zero-kit/skills/design-system/briefs/README.md',
        ], /zero-basic`?'s (\d+) recipes/g, basicRecipes.length);
    });

    it("heroui and carbon's recipe coverage", () => {
        expectClaims(['AGENTS.md'], /Full component coverage \((\d+) recipes/g, heroRecipes.length);
        expectClaims(['packages/zero-heroui/README.md'], /all (\d+) authored recipes \((\d+)\/(\d+)\)/gi, heroRecipes.length);
        expectClaims(['packages/zero-carbon/README.md'], /all (\d+) authored recipes/gi, carbonRecipes.length);
    });

    it('the type-test project count, and every project named where they are listed', () => {
        expect(typeTestProjects.length).toBeGreaterThan(0);
        expectClaims(['AGENTS.md'], /\b(\w+) isolated tsconfig projects under packages\/zero\/type-tests/g, typeTestProjects.length);
        expectClaims(['docs/architecture.md'], /Type tests \((\d+) isolated projects\)/g, typeTestProjects.length);
        const row = read('docs/architecture.md').split('\n').find((line) => line.startsWith('| Type tests ('))!;
        for (const project of typeTestProjects) expect(row, project).toContain(`\`${project}\``);
    });

    it('the playground toolbar names as many skins as it switches between', () => {
        expectClaims(['examples/playground/src/Toolbar.tsx'], /one anatomy, (\w+) skins/g, DESIGN_SYSTEM_LIST.length);
    });

    it("verify-pack hard-codes no count of zero's subpath exports", () => {
        expect(read('scripts/verify-pack.js')).not.toMatch(/ships \d+/);
    });
});

describe('the statements the docs make about the tree', () => {
    it("typed-app's skipLibCheck, as its tsconfig sets it", () => {
        const value = /"skipLibCheck":\s*(true|false)/.exec(read('examples/typed-app/tsconfig.base.json'))![1];
        expect(read('AGENTS.md')).toContain(`\`skipLibCheck\` is \`${value}\``);
    });

    it('the ext-example adoption: devDependency discovery, in every skin that devDepends on it', () => {
        const agents = read('AGENTS.md');
        const start = agents.indexOf('- `packages/zero-ext-example`');
        expect(start, 'AGENTS.md has no `packages/zero-ext-example` entry').toBeGreaterThanOrEqual(0);
        // The entry runs to the next package bullet, or to the end of the
        // list's section when it is the last one.
        const ends = [agents.indexOf('\n- `', start + 1), agents.indexOf('\n#', start)].filter((i) => i >= 0);
        const entry = agents.slice(start, ends.length > 0 ? Math.min(...ends) : undefined);
        expect(entry).toContain('"sigx-zero"');
        expect(entry).not.toMatch(/spread the pack/);
        for (const ds of ['basic', 'daisyui', 'material', 'brutalist', 'heroui', 'carbon']) {
            const pkg = JSON.parse(read(`packages/zero-${ds}/package.json`)) as { devDependencies?: Record<string, string> };
            const adopts = pkg.devDependencies?.['@sigx/zero-ext-example'] !== undefined;
            expect(entry.includes(`zero-${ds}`), `zero-${ds} ${adopts ? 'adopts' : 'does not adopt'} the pack`).toBe(adopts);
        }
    });
});
