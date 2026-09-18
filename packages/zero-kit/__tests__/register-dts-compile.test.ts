/**
 * The generator gate the type-test tsconfigs promise (tsconfig.base.json):
 * compile every design system's EMITTED register.d.ts with `skipLibCheck:
 * false`, because a real app's `skipLibCheck: true` skips declaration files
 * wholesale — including the `_ScopesValid`/`_EntriesValid` assertions the
 * emitter writes into them. Here the emitted file IS the program, so a
 * syntactically broken emission or a failing embedded assertion is a test
 * failure rather than something an app silently never checks.
 *
 * The program maps `@sigx/zero` to a generated stub carrying only what the
 * artifact references — the empty `ZeroVocabulary` and the real `ZeroScope`
 * union built from the live anatomy registry. Deliberately no dependency on
 * zero's full source: runtime-core's shipped declarations do not survive a
 * full lib check, and this gate is about the ARTIFACT, not the runtime.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { compileDesignSystem, compileRegisterDts, mergeManifests } from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { fragment as extFragment, recipes as extRecipes } from '@sigx/zero-ext-example/fragment';
import { designSystem as daisyDS } from '@sigx/zero-daisyui';
import { designSystem as materialDS } from '@sigx/zero-material';
import { designSystem as brutalistDS } from '@sigx/zero-brutalist';
import { designSystem as herouiDS } from '@sigx/zero-heroui';
import { designSystem as carbonDS } from '@sigx/zero-carbon';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

// The workspace root's bin stub — the same tsgo `pnpm typecheck` runs.
// (import.meta.dirname, not import.meta.url: the transform URL is not file:)
// On Windows the extensionless shim is not spawnable; the .CMD twin is, and
// .cmd files must go through a shell since Node's CVE-2024-27980 hardening.
const win = process.platform === 'win32';
const tsgo = resolve(import.meta.dirname, `../../../node_modules/.bin/tsgo${win ? '.CMD' : ''}`);

const stub = [
    "declare module '@sigx/zero' {",
    '    export interface ZeroVocabulary {}',
    `    export type ZeroScope = ${Object.keys(anatomies).map((s) => `'${s}'`).join(' | ')};`,
    '}',
    '',
].join('\n');

let dir: string;
beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'zero-register-gate-'));
    writeFileSync(join(dir, 'zero-stub.d.ts'), stub);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function compiles(name: string, dts: string): { ok: boolean; output: string } {
    const caseDir = join(dir, name);
    mkdirSync(caseDir, { recursive: true });
    writeFileSync(join(caseDir, 'register.d.ts'), dts);
    writeFileSync(join(caseDir, 'tsconfig.json'), JSON.stringify({
        include: ['register.d.ts', '../zero-stub.d.ts'],
        compilerOptions: {
            target: 'ESNext',
            module: 'ESNext',
            moduleResolution: 'bundler',
            strict: true,
            noEmit: true,
            skipLibCheck: false,
            types: [],
            paths: { '@sigx/zero': ['../zero-stub.d.ts'] },
        },
    }));
    const run = spawnSync(
        win ? `"${tsgo}"` : tsgo,
        ['--noEmit', '-p', win ? `"${caseDir}"` : caseDir],
        { encoding: 'utf8', shell: win },
    );
    // A spawn failure is NOT a compile failure — without this, the red cases
    // below would pass vacuously on a platform where tsgo never ran (which is
    // exactly how the Windows CI leg first failed).
    if (run.error) throw run.error;
    return { ok: run.status === 0, output: `${run.stdout}\n${run.stderr}` };
}

describe('every emitted register.d.ts survives a full lib check', () => {
    it.each<[string, DesignSystemInput]>([
        ['basic', basicDS as DesignSystemInput],
        ['daisyui', daisyDS as DesignSystemInput],
        ['material', materialDS as DesignSystemInput],
        ['brutalist', brutalistDS as DesignSystemInput],
        ['heroui', herouiDS as DesignSystemInput],
        ['carbon', carbonDS as DesignSystemInput],
    ])('%s', (name, ds) => {
        const compiled = compileDesignSystem(ds, manifest);
        const result = compiles(name, compileRegisterDts(compiled));
        expect(result.ok, result.output).toBe(true);
    });

    it('basic + the ecosystem pack (the Exclude-form gate) survives too', () => {
        const ds = basicDS as DesignSystemInput;
        const compiled = compileDesignSystem(
            { ...ds, recipes: [...ds.recipes, ...extRecipes] },
            mergeManifests(manifest, extFragment),
        );
        const result = compiles('basic-ext', compileRegisterDts(compiled));
        expect(result.ok, result.output).toBe(true);
    });

    // The gate must be able to FAIL — a gate first seen green is no gate.
    it('rejects an emission naming a scope the registry lacks', () => {
        const compiled = compileDesignSystem(basicDS as DesignSystemInput, manifest);
        const dts = compileRegisterDts(compiled).replace("'button':", "'buton':");
        const result = compiles('bad-scope', dts);
        expect(result.ok).toBe(false);
        expect(result.output).toContain('error TS');
    });

    it('rejects an entry that dropped one of its five members', () => {
        const compiled = compileDesignSystem(basicDS as DesignSystemInput, manifest);
        const dts = compileRegisterDts(compiled)
            .replace('                mods: Record<string, never>;\n', '');
        const result = compiles('bad-entry', dts);
        expect(result.ok).toBe(false);
        expect(result.output).toContain('error TS');
    });

    it('rejects a syntactically broken emission', () => {
        const compiled = compileDesignSystem(basicDS as DesignSystemInput, manifest);
        const dts = compileRegisterDts(compiled).replace("theme: '", "theme: ;'");
        const result = compiles('bad-syntax', dts);
        expect(result.ok).toBe(false);
        expect(result.output).toContain('error TS');
    });
});
