/**
 * `sigx zero:audit` — the command over `auditDesignSystem` (#403, slice B).
 *
 * The API never throws on a finding; the COMMAND is where an exit code lives,
 * and this file pins that contract: error findings fail the run, warnings
 * fail it only under `--strict`, `info` never does, `--json -` owns stdout
 * and nothing else may write there, and a design system that does not
 * compile is refused with the validator's own words rather than a stack.
 *
 * `runAudit` itself is not reachable from this suite — `loadDesignSystem`
 * dynamic-imports the entry through vite's module runner, which cannot load
 * a file written outside the project — so the command is split: `runAudit`
 * loads, and `auditInputs` does everything after. That seam is what is
 * exercised here, on synthetic design systems compiled by the real compiler.
 *
 * Red-first (#403): the `FAILED audit` assertion and the stdout-purity
 * assertion were both watched failing before `commands/audit.ts` existed.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { anatomies } from '@sigx/zero/anatomy';
import { AUDIT_SCHEMA_URL, validateDesignSystem } from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent, PartStyles, RecipeInput, TokensInput, ZeroManifest } from '@sigx/zero-kit';
import { auditInputs } from '../src/commands/audit.js';
import type { LoadedInputs } from '../src/commands/shared.js';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
} as ZeroManifest;

/**
 * No colour axis and no size ramp, so the only rules that can speak are the
 * ones each fixture is about — the recommended vocabulary would otherwise
 * add an `axis-coverage` warning per styled scope and an `unused` warning
 * per declared step, and the exit assertions below count warnings.
 */
const tokens: TokensInput = {
    roles: {},
    sizes: [],
    themes: {
        day: {
            colorScheme: 'light',
            colors: { 'base-100': 'white', 'base-200': 'white', 'base-300': 'white', 'base-content': 'black' },
        },
    },
    defaultLight: 'day',
};

const fixture = (recipes: RecipeInput[], over: Partial<TokensInput> = {}): DesignSystemInput => ({
    name: 'fixture',
    tokens: { ...tokens, ...over },
    recipes,
});

/** What `loadInputs` would have returned for this design system. */
const inputsFor = (ds: DesignSystemInput): LoadedInputs => ({ ds, manifest, result: validateDesignSystem(ds, manifest), packs: [] });

const logger = () => ({ log: vi.fn<(m: string) => void>(), warn: vi.fn<(m: string) => void>(), error: vi.fn<(m: string) => void>() });

/** A focus ring keeps the validator's focus-visible rule quiet — the fixtures below must VALIDATE, not only compile. */
const focusRing = { 'focus-visible': { outline: '2px solid black' } };
const control: PartStyles = {
    base: { width: '1rem', height: '1rem', border: '1px solid gray' },
    states: { checked: { background: 'blue' }, indeterminate: { background: 'blue' }, unchecked: {}, ...focusRing },
};
/** #212: three declared states, nothing drawn — two error findings. */
const blind: PartStyles = { base: { width: '100%' }, states: { checked: {}, unchecked: {}, indeterminate: {} } };
const drawn: PartStyles = {
    ...blind,
    states: {
        checked: { clipPath: 'polygon(0 0, 100% 0, 100% 100%)' },
        indeterminate: { clipPath: 'polygon(0 40%, 100% 40%, 100% 60%, 0 60%)' },
        unchecked: { clipPath: 'polygon(0 0, 0 0, 0 0)' },
    },
};

const failing = fixture([{ component: 'checkbox', parts: { control, indicator: blind } }]);
const passing = fixture([{ component: 'checkbox', parts: { control, indicator: drawn } }]);
/** A styled scope that accepts a declared colour axis and wires nothing — one warning, no errors. */
const warningOnly = fixture([
    // `appearance: none` keeps button-affordance quiet; the one role is wired here, so `unused` is quiet too.
    { component: 'button', parts: { root: { base: { appearance: 'none' }, states: focusRing } }, variants: { color: { primary: { root: { base: { background: 'blue' } } } } } },
    { component: 'avatar', parts: { root: { base: {} } } },
], {
    roles: { primary: {} },
    themes: {
        day: {
            colorScheme: 'light',
            colors: {
                'base-100': 'white', 'base-200': 'white', 'base-300': 'white',
                'base-content': 'black', primary: 'blue', 'primary-content': 'white',
            },
        },
    },
});

const tempDirs: string[] = [];
afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
});

describe('zero:audit exit contract', () => {
    it('fails the run on an error finding, after printing the audit', async () => {
        const env = { cwd: process.cwd(), logger: logger() };
        await expect(auditInputs(env, inputsFor(failing), { strict: false })).rejects.toThrow(/"fixture" FAILED audit \(2 errors, 0 warnings\)/);
        const printed = env.logger.log.mock.calls.map(([m]) => m).join('\n');
        expect(printed).toContain('fixture — audit');
        expect(printed).toContain('state-legibility/indicator (error)');
    });

    it('passes the twin and says so', async () => {
        expect(inputsFor(passing).result.ok).toBe(true);
        const env = { cwd: process.cwd(), logger: logger() };
        await expect(auditInputs(env, inputsFor(passing), { strict: false })).resolves.toBeUndefined();
        expect(env.logger.log.mock.calls.at(-1)?.[0]).toMatch(/"fixture" passed audit \(0 warnings\)/);
    });

    it('lets warnings through unless --strict', async () => {
        const env = { cwd: process.cwd(), logger: logger() };
        await expect(auditInputs(env, inputsFor(warningOnly), { strict: false })).resolves.toBeUndefined();
        expect(env.logger.log.mock.calls.at(-1)?.[0]).toMatch(/passed audit \(1 warnings\)/);
        await expect(auditInputs(env, inputsFor(warningOnly), { strict: true })).rejects.toThrow(/FAILED audit \(0 errors, 1 warnings\)/);
    });

    it('runs only the rules asked for', async () => {
        const env = { cwd: process.cwd(), logger: logger() };
        // The indicator rule alone: one error rather than two.
        await expect(auditInputs(env, inputsFor(failing), { strict: false, rule: ['state-legibility/indicator'] }))
            .rejects.toThrow(/FAILED audit \(1 errors/);
    });

    it('refuses an unknown rule by name, listing the known ones', async () => {
        const env = { cwd: process.cwd(), logger: logger() };
        await expect(auditInputs(env, inputsFor(passing), { strict: false, rule: ['nope'] }))
            .rejects.toThrow(/unknown audit rule "nope".*known rules: state-legibility\/component/);
    });

    it('prints the audit but still fails a design system that compiles and fails validation', async () => {
        // An undeclared token reference compiles (the CSS is emitted as
        // written) and is a validation ERROR; the audit itself is clean.
        const invalid = fixture([{
            component: 'checkbox',
            parts: { control: { ...control, base: { ...control.base, color: 'var(--color-nope)' } }, indicator: drawn },
        }]);
        const inputs = inputsFor(invalid);
        expect(inputs.result.ok).toBe(false);
        const env = { cwd: process.cwd(), logger: logger() };
        await expect(auditInputs(env, inputs, { strict: false }))
            .rejects.toThrow(/passed audit \(0 warnings\) but FAILED validation \(1 errors\)/);
        // The audit was still printed — that is the mid-iteration value.
        expect(env.logger.log.mock.calls.map(([m]) => m).join('\n')).toContain('fixture — audit');
    });

    it('refuses a design system that does not compile, in the validator\'s words', async () => {
        const broken = fixture([{ component: 'not-a-component', parts: { root: {} } }]);
        const env = { cwd: process.cwd(), logger: logger() };
        await expect(auditInputs(env, inputsFor(broken), { strict: false }))
            .rejects.toThrow(/"fixture" does not compile, so it cannot be audited.*unknown component "not-a-component"/s);
    });
});

describe('zero:audit --json', () => {
    it('with "-" writes the artifact to stdout and nothing else to stdout', async () => {
        const chunks: string[] = [];
        vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
            chunks.push(String(chunk));
            return true;
        }) as typeof process.stdout.write);
        const env = { cwd: process.cwd(), logger: logger() };
        await expect(auditInputs(env, inputsFor(failing), { strict: false, json: '-' })).rejects.toThrow(/FAILED audit/);
        expect(env.logger.log).not.toHaveBeenCalled();
        expect(chunks).toHaveLength(1);
        const artifact = JSON.parse(chunks[0]!) as { $schema: string; auditVersion: number; summary: { errors: number } };
        expect(artifact.$schema).toBe(AUDIT_SCHEMA_URL);
        expect(artifact.auditVersion).toBe(1);
        expect(artifact.summary.errors).toBe(2);
    });

    it('with a path writes the artifact there, creating parents', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'zero-kit-audit-cli-'));
        tempDirs.push(dir);
        const env = { cwd: dir, logger: logger() };
        await auditInputs(env, inputsFor(passing), { strict: false, json: 'reports/audit.json' });
        const path = join(dir, 'reports', 'audit.json');
        expect(existsSync(path)).toBe(true);
        const artifact = JSON.parse(readFileSync(path, 'utf8')) as { name: string; findings: unknown[] };
        expect(artifact.name).toBe('fixture');
        expect(artifact.findings).toEqual([]);
        // The human lines still print when stdout is not the JSON.
        expect(env.logger.log).toHaveBeenCalled();
    });
});
