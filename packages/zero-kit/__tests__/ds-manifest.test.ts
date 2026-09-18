/**
 * The design-system manifest as a VERSIONED artifact (#317 item 5).
 *
 * dist/manifest.json used to ship with no $schema, no version and no schema
 * file at all — so every consumer (the playground, ds-smoke, the contrast
 * audit) re-declared its shape by hand and carried drift-defense code. This
 * suite pins the envelope, checks the emitter's own output against the
 * published schema, and proves writeArtifacts REFUSES to write a manifest the
 * schema rejects — self-validation, so a compiler change that breaks the
 * shape fails the build that produces it rather than the app that reads it.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { afterAll, describe, expect, it } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { anatomies } from '@sigx/zero/anatomy';
import {
    DS_MANIFEST_VERSION,
    compileDesignSystem,
    writeArtifacts,
} from '@sigx/zero-kit';
import type { CompiledDesignSystem, DesignSystemManifest, ManifestComponent } from '@sigx/zero-kit';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { designSystem as herouiDS } from '@sigx/zero-heroui';
import { designSystem as carbonDS } from '@sigx/zero-carbon';

const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };

const schema = JSON.parse(readFileSync(
    resolve(process.cwd(), 'packages/zero-kit/schemas/ds-manifest.schema.json'), 'utf8',
)) as Record<string, unknown>;
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
const validate = ajv.compile(schema);

const tempDirs: string[] = [];
afterAll(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

async function emit(compiled: CompiledDesignSystem): Promise<DesignSystemManifest> {
    const dir = mkdtempSync(join(tmpdir(), 'zero-ds-manifest-'));
    tempDirs.push(dir);
    await writeArtifacts(compiled, dir);
    return JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as DesignSystemManifest;
}

describe('the emitted design-system manifest', () => {
    // basic (roles + scopes + fragmentless), heroui (roles: {}, fused
    // variant, mods), carbon (api block) — the three envelope-relevant
    // shapes.
    const systems = {
        basic: compileDesignSystem(basicDS, manifest),
        heroui: compileDesignSystem(herouiDS, manifest),
        carbon: compileDesignSystem(carbonDS, manifest),
    };

    it.each(Object.keys(systems))('%s: carries the versioned envelope and validates against ds-manifest.schema.json', async (name) => {
        const emitted = await emit(systems[name as keyof typeof systems]);
        expect(emitted.$schema).toBe('https://signalxjs.github.io/zero/schemas/ds-manifest.schema.json');
        expect(emitted.manifestVersion).toBe(DS_MANIFEST_VERSION);
        // Lockstep: the kit's own version IS the zero contract version.
        const kitVersion = (JSON.parse(readFileSync(
            resolve(process.cwd(), 'packages/zero-kit/package.json'), 'utf8',
        )) as { version: string }).version;
        expect(emitted.zeroVersion).toBe(kitVersion);
        const ok = validate(emitted);
        expect(ok, ajv.errorsText(validate.errors, { separator: '\n' })).toBe(true);
    });

    it('writeArtifacts refuses to write a manifest the schema rejects (self-validation)', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'zero-ds-manifest-'));
        tempDirs.push(dir);
        // A compiled form a buggy compiler could plausibly produce: a
        // non-array wired axis. The write must fail, not ship it.
        const corrupted: CompiledDesignSystem = JSON.parse(JSON.stringify(systems.basic)) as CompiledDesignSystem;
        (corrupted.components['button'] as unknown as { color: string }).color = 'primary';
        await expect(writeArtifacts(corrupted, dir)).rejects.toThrow(/manifest.*schema|schema.*manifest/i);
    });

    it('the schema refuses a provenance entry that says nothing', async () => {
        // `externalScopes` is documented as absent when nothing was adopted,
        // so an empty map — or an empty package name in one — is a malformed
        // claim rather than a harmless one.
        const emitted = await emit(systems.basic);
        expect(validate({ ...emitted, externalScopes: {} })).toBe(false);
        expect(validate({ ...emitted, externalScopes: { 'acme-stepper': '' } })).toBe(false);
        expect(validate({ ...emitted, externalScopes: { 'acme-stepper': '@acme/stepper' } })).toBe(true);
    });

    it('the schema itself rejects a version it does not know', () => {
        // The consumer contract: check manifestVersion, not key-sniffing.
        expect(validate({ manifestVersion: 2 })).toBe(false);
    });
});
