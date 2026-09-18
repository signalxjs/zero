/**
 * The sigx CLI plugin surface.
 *
 * The old hand-rolled CLI had no tests — its single-pass `parseArgs` and its
 * `if (command === …)` chain were only ever exercised by hand. Standing on
 * `@sigx/args` makes both halves testable without spawning a process:
 * `parseArgs` throws a structured `ParseError` instead of printing and
 * exiting, and `detect` is a plain predicate.
 *
 * What's asserted here is the *contract with the CLI host* — the command
 * names and aliases the sigx CLI registers, the flag grammar each command
 * accepts, and which directories the plugin claims. The compile/validate
 * behaviour behind them is covered by the rest of this suite.
 */
import { afterAll, describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineAnatomy } from '@sigx/zero/anatomy';
import { parseArgs, ParseError } from '@sigx/args';
import type { ArgsShape } from '@sigx/args';
import plugin from '../src/plugin.js';
import { DEFAULT_ENTRY, commandEntry, loadManifest, packageDesignSystemEntry } from '../src/commands/shared.js';

/** A throwaway project directory; `detect` only ever reads from disk. */
function projectDir(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), 'zero-kit-plugin-'));
    for (const [rel, contents] of Object.entries(files)) {
        const path = join(dir, rel);
        mkdirSync(join(path, '..'), { recursive: true });
        writeFileSync(path, contents);
    }
    return dir;
}

const pkg = (deps: Record<string, unknown>) => JSON.stringify({ name: 'x', ...deps });

/** The args shape the CLI host would hand to `parseArgs` for a command. */
const shapeOf = (name: string): ArgsShape => plugin.commands[name]!.args as ArgsShape;

describe('plugin registration', () => {
    it('registers namespaced commands, with bare aliases where they are safe', () => {
        // Namespaced so a project that is also a Lynx app doesn't get whichever
        // `build` loaded last; the bare alias still resolves when unclaimed.
        expect(Object.keys(plugin.commands).sort())
            .toEqual(['zero:audit', 'zero:build', 'zero:extend', 'zero:fragment', 'zero:validate']);
        expect(plugin.commands['zero:build']!.aliases).toEqual(['build']);
        expect(plugin.commands['zero:validate']!.aliases).toEqual(['validate']);
        expect(plugin.commands['zero:audit']!.aliases).toEqual(['audit']);
        // No bare alias for either: `fragment` and `extend` are words other
        // plugins may want, and the CLI resolves collisions last-plugin-wins.
        expect(plugin.commands['zero:fragment']!.aliases).toBeUndefined();
        expect(plugin.commands['zero:extend']!.aliases).toBeUndefined();
    });

    it('describes every command and flag', () => {
        // The description text IS the generated help — an empty one ships a
        // blank column in `sigx --help`.
        for (const [name, cmd] of Object.entries(plugin.commands)) {
            expect(cmd.description, name).toBeTruthy();
        }
    });
});

describe('detect', () => {
    it('claims a package that depends on the kit', () => {
        expect(plugin.detect(projectDir({ 'package.json': pkg({ devDependencies: { '@sigx/zero-kit': '^0.1.0' } }) }))).toBe(true);
        expect(plugin.detect(projectDir({ 'package.json': pkg({ dependencies: { '@sigx/zero-kit': '^0.1.0' } }) }))).toBe(true);
    });

    it('claims a component package that declares sigx-zero and never depends on the kit', () => {
        // The kit dependency was the whole test; `zero:fragment` widened it,
        // because a component package may depend on @sigx/zero alone.
        const dir = projectDir({
            'package.json': JSON.stringify({ name: '@acme/zero-stepper', 'sigx-zero': { fragment: './dist/fragment.js' } }),
        });
        expect(plugin.detect(dir)).toBe(true);
    });

    it('claims one whose sigx-zero field is malformed, so the command can say why', () => {
        // Presence, not truthiness. Hiding the command from the author of a
        // broken field is the least helpful possible response.
        for (const field of ['null', '""', '{}']) {
            const dir = projectDir({
                'package.json': `{ "name": "@acme/zero-stepper", "sigx-zero": ${field} }`,
            });
            expect(plugin.detect(dir), `sigx-zero: ${field}`).toBe(true);
        }
    });

    it('ignores unrelated projects', () => {
        expect(plugin.detect(projectDir({ 'package.json': pkg({ dependencies: { vite: '^8.0.0' } }) }))).toBe(false);
        expect(plugin.detect(projectDir({}))).toBe(false);
    });

    it('does not claim the kit itself', () => {
        // zero-kit ships src/design-system.ts as library code — no source-shape
        // heuristic may mistake that for a design system to compile.
        const dir = projectDir({
            'package.json': JSON.stringify({ name: '@sigx/zero-kit' }),
            'src/design-system.ts': 'export function defineDesignSystem() {}',
        });
        expect(plugin.detect(dir)).toBe(false);
    });

    it('survives an unparseable package.json', () => {
        // A broken manifest must not crash discovery for every other plugin.
        expect(plugin.detect(projectDir({ 'package.json': '{ not json' }))).toBe(false);
    });
});

describe('zero:build args', () => {
    const shape = shapeOf('zero:build');

    it('applies defaults', () => {
        const { args } = parseArgs([], shape);
        expect(args.entry).toBe('./dist/design-system.js');
        expect(args.out).toBe('./dist');
        expect(args.manifest).toBeUndefined();
    });

    it('takes the entry as a positional', () => {
        expect(parseArgs(['./build/ds.js'], shape).args.entry).toBe('./build/ds.js');
    });

    it('accepts --out x and --out=x identically', () => {
        expect(parseArgs(['--out', 'css'], shape).args.out).toBe('css');
        expect(parseArgs(['--out=css'], shape).args.out).toBe('css');
    });

    it('rejects an unknown flag with a machine-readable code', () => {
        // The old CLI silently ignored anything starting with `--`.
        try {
            parseArgs(['--nope'], shape);
            expect.unreachable('should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ParseError);
            expect((err as ParseError).code).toBe('UNKNOWN_FLAG');
        }
    });

    it('rejects a value flag with no value', () => {
        expect(() => parseArgs(['--out'], shape)).toThrow(ParseError);
    });
});

describe('loadManifest diagnostics', () => {
    // Every one of these surfaces as `error: <message>` and a non-zero exit.
    // Raw MODULE_NOT_FOUND / "components.map is not a function" read as
    // internal failures, so each names the cause and what to do about it.
    // The default-resolution branch (no --manifest, `@sigx/zero` missing from
    // the project) is deliberately not covered here: this suite runs under the
    // vitest config's `@sigx/zero` alias, which satisfies `require.resolve`
    // from any directory, so the failure can't be reproduced in-process.

    it('reports an unreadable explicit manifest', async () => {
        const dir = projectDir({ 'package.json': pkg({}) });
        await expect(loadManifest(dir, './missing.json')).rejects.toThrow(/cannot read the anatomy manifest/);
    });

    it('reports invalid JSON', async () => {
        const dir = projectDir({ 'm.json': '{ not json' });
        await expect(loadManifest(dir, './m.json')).rejects.toThrow(/is not valid JSON/);
    });

    it('rejects a well-formed file that is not an anatomy manifest', async () => {
        // A design system emits its own dist/manifest.json — same filename,
        // different shape, and an easy thing to point --manifest at.
        const dir = projectDir({ 'm.json': JSON.stringify({ name: 'basic', tokens: {} }) });
        await expect(loadManifest(dir, './m.json')).rejects.toThrow(/is not the zero anatomy manifest/);
    });

    it('accepts a real manifest', async () => {
        const dir = projectDir({ 'm.json': JSON.stringify({ components: [] }) });
        await expect(loadManifest(dir, './m.json')).resolves.toEqual({ components: [] });
    });

    it('reports an unresolvable module specifier as such', async () => {
        // --manifest takes a path, but the documented default is the specifier
        // `@sigx/zero/manifest.json`, so that form must resolve rather than be
        // read as a directory named "@sigx".
        const dir = projectDir({ 'package.json': pkg({}) });
        await expect(loadManifest(dir, '@sigx/nope/manifest.json')).rejects.toThrow(
            /cannot resolve the anatomy manifest "@sigx\/nope\/manifest\.json"/,
        );
    });
});

describe('--package: an installed design system by name (#37)', () => {
    // A consumer app — `@sigx/zero` plus a skin, no design system of its
    // own — checks the one it uses without reaching into node_modules.
    const installed = (exportsMap: Record<string, unknown>) => projectDir({
        'package.json': pkg({ devDependencies: { '@acme/skin': '1.0.0', '@sigx/zero-kit': '*' } }),
        'node_modules/@acme/skin/package.json': JSON.stringify({ name: '@acme/skin', exports: exportsMap }),
    });

    it.each(['zero:validate', 'zero:audit'])('%s takes --package, and leaves the entry default alone', (command) => {
        const shape = shapeOf(command);
        expect(parseArgs(['--package', '@acme/skin'], shape).args.package).toBe('@acme/skin');
        expect(parseArgs([], shape).args.package).toBeUndefined();
        // `commandEntry` tells "no entry given" by this default.
        expect(parseArgs([], shape).args.entry).toBe(DEFAULT_ENTRY);
    });

    it('resolves <package>/design-system through the exports map', () => {
        const dir = installed({ './design-system': { types: './dist/design-system.d.ts', import: './dist/design-system.js' } });
        const entry = join(dir, 'node_modules', '@acme', 'skin', 'dist', 'design-system.js');
        expect(packageDesignSystemEntry(dir, '@acme/skin')).toBe(entry);
        expect(commandEntry(dir, './dist/design-system.js', '@acme/skin', 'validated')).toBe(entry);
        expect(commandEntry(dir, './dist/design-system.js', undefined, 'validated')).toBe('./dist/design-system.js');
    });

    it('names a package that is not installed, and one that exports no ./design-system', () => {
        const dir = installed({ '.': './dist/index.js' });
        expect(() => packageDesignSystemEntry(dir, '@acme/missing')).toThrow(/@acme\/missing is not installed/);
        expect(() => packageDesignSystemEntry(dir, '@acme/skin')).toThrow(/exports no "\.\/design-system", so it cannot be validated/);
        // The error speaks the running command's verb, and names the fix.
        expect(() => commandEntry(dir, DEFAULT_ENTRY, '@acme/skin', 'audited'))
            .toThrow(/so it cannot be audited — upgrade @acme\/skin to a version that exports it/);
    });

    it('refuses an entry and --package together rather than ignoring one', () => {
        const dir = installed({ './design-system': './dist/design-system.js' });
        expect(() => commandEntry(dir, './mine.js', '@acme/skin', 'validated')).toThrow(/an entry or --package, not both/);
    });

    it('refuses an export target that leaves the package, as Node would', () => {
        // Resolved by hand, so Node's ERR_INVALID_PACKAGE_TARGET is enforced here.
        for (const target of ['../evil.js', './dist/../../evil.js', 'dist/design-system.js', './node_modules/x/ds.js', './C:/evil.js']) {
            const dir = installed({ './design-system': { import: target } });
            expect(() => packageDesignSystemEntry(dir, '@acme/skin'), target).toThrow(/is not a path inside the package/);
        }
    });
});

describe('--extra-manifest: a JSON file, a fragment module, or a package (#33)', () => {
    // Inside the repo rather than the OS temp dir: the module cases really
    // import the fragment, and vite's module runner cannot load a file
    // written outside the project.
    const roots: string[] = [];
    afterAll(() => { for (const dir of roots) rmSync(dir, { recursive: true, force: true }); });
    const inRepo = (files: Record<string, string>): string => {
        const dir = mkdtempSync(join(import.meta.dirname, '.tmp-extra-manifest-'));
        roots.push(dir);
        for (const [rel, contents] of Object.entries(files)) {
            const path = join(dir, rel);
            mkdirSync(join(path, '..'), { recursive: true });
            writeFileSync(path, contents);
        }
        return dir;
    };
    const fragment = {
        version: 1,
        package: '@acme/feed',
        components: [defineAnatomy('acme-feed', { root: { element: 'div' } }).toJSON()],
    };
    const asModule = `export const fragment = ${JSON.stringify(fragment)};\n`;
    const base = { 'package.json': pkg({ devDependencies: { '@acme/feed': '1.0.0' } }), 'm.json': JSON.stringify({ components: [] }) };
    const scopes = async (dir: string, extra: string) =>
        (await loadManifest(dir, './m.json', [extra])).components.map((c) => `${c.scope}@${c.package}`);

    it('merges a JSON fragment by path, as before', async () => {
        const dir = inRepo({ ...base, 'f.json': JSON.stringify(fragment) });
        expect(await scopes(dir, './f.json')).toEqual(['acme-feed@@acme/feed']);
    });

    it('imports a JS fragment module by path — `fragment`, or the default export', async () => {
        const dir = inRepo({ ...base, 'f.mjs': asModule, 'd.js': `export default ${JSON.stringify(fragment)};\n` });
        expect(await scopes(dir, './f.mjs')).toEqual(['acme-feed@@acme/feed']);
        expect(await scopes(dir, './d.js')).toEqual(['acme-feed@@acme/feed']);
    });

    it('reads a bare package name through its "sigx-zero" field', async () => {
        const dir = inRepo({
            ...base,
            'node_modules/@acme/feed/package.json': JSON.stringify({ name: '@acme/feed', 'sigx-zero': { fragment: './dist/fragment.js' } }),
            'node_modules/@acme/feed/dist/fragment.js': asModule,
        });
        expect(await scopes(dir, '@acme/feed')).toEqual(['acme-feed@@acme/feed']);
    });

    it('resolves a subpath export that declares only `import`, which require.resolve cannot see', async () => {
        const dir = inRepo({
            ...base,
            'node_modules/@acme/feed/package.json': JSON.stringify({
                name: '@acme/feed',
                exports: { './fragment': { types: './dist/fragment.d.ts', import: './dist/fragment.js' } },
            }),
            'node_modules/@acme/feed/dist/fragment.js': asModule,
        });
        expect(await scopes(dir, '@acme/feed/fragment')).toEqual(['acme-feed@@acme/feed']);
    });

    it('names a module with no fragment, and a package it cannot reach', async () => {
        const dir = inRepo({ ...base, 'none.mjs': 'export const recipes = [];\n' });
        await expect(loadManifest(dir, './m.json', ['./none.mjs'])).rejects.toThrow(/exports no "fragment" object/);
        await expect(loadManifest(dir, './m.json', ['@acme/missing'])).rejects.toThrow(
            /cannot resolve the manifest fragment "@acme\/missing".*"sigx-zero" field/,
        );
        await expect(loadManifest(dir, './m.json', ['@acme/missing/fragment'])).rejects.toThrow(
            /cannot resolve the manifest fragment "@acme\/missing\/fragment"/,
        );
    });

    it('refuses a subpath export that points outside its package', async () => {
        // Resolved by hand past require.resolve, so the escape check is ours.
        const dir = inRepo({
            ...base,
            'node_modules/@acme/feed/package.json': JSON.stringify({ name: '@acme/feed', exports: { './fragment': { import: '../../evil.mjs' } } }),
        });
        await expect(loadManifest(dir, './m.json', ['@acme/feed/fragment'])).rejects.toThrow(/is not a path inside the package/);
        // …and the specifier's own subpath is held to the same segments.
        await expect(loadManifest(dir, './m.json', ['@acme/feed/../../m.json'])).rejects.toThrow(/is not a subpath inside @acme\/feed/);
    });

    it('never falls back from a bare name to the package\'s main entry', async () => {
        // Installed, resolvable, but no "sigx-zero" field: the main module is
        // the package's runtime, and importing it as a fragment would run it.
        const dir = inRepo({
            ...base,
            'node_modules/@acme/feed/package.json': JSON.stringify({ name: '@acme/feed', main: './index.js' }),
            'node_modules/@acme/feed/index.js': 'throw new Error("runtime code ran");\n',
        });
        await expect(loadManifest(dir, './m.json', ['@acme/feed'])).rejects.toThrow(/"sigx-zero" field, which it does not declare/);
    });
});

describe('zero:validate args', () => {
    const shape = shapeOf('zero:validate');

    it('defaults --strict off', () => {
        expect(parseArgs([], shape).args.strict).toBe(false);
        expect(parseArgs(['--strict'], shape).args.strict).toBe(true);
    });

    it('does not let the --strict boolean swallow the next token', () => {
        // The hand-rolled parser read the next argv slot for every flag; a
        // boolean that eats its successor turns `--strict --manifest x` into
        // a silently manifest-less run.
        const { args } = parseArgs(['--strict', '--manifest', 'm.json'], shape);
        expect(args.strict).toBe(true);
        expect(args.manifest).toBe('m.json');
    });

    it('has no --out flag', () => {
        // Validation writes nothing; offering --out would be a lie.
        expect(() => parseArgs(['--out', 'x'], shape)).toThrow(ParseError);
    });

    it('defaults --report off and takes it as a bare boolean', () => {
        expect(parseArgs([], shape).args.report).toBe(false);
        expect(parseArgs(['--report'], shape).args.report).toBe(true);
    });

    it('takes --report-json as a path, kebab or camel', () => {
        expect(parseArgs(['--report-json', 'r.json'], shape).args.reportJson).toBe('r.json');
        expect(parseArgs(['--report-json=r.json'], shape).args.reportJson).toBe('r.json');
        expect(parseArgs([], shape).args.reportJson).toBeUndefined();
    });

    it('keeps the two report flags independent', () => {
        // The human summary and the machine artifact are separate asks — one
        // must not imply or suppress the other.
        const { args } = parseArgs(['--report', '--report-json', '-'], shape);
        expect(args.report).toBe(true);
        expect(args.reportJson).toBe('-');
    });

    it('takes --diff as a path, kebab or camel, and defaults it off', () => {
        expect(parseArgs(['--diff', 'dist/report.json'], shape).args.diff).toBe('dist/report.json');
        expect(parseArgs(['--diff=prev.json'], shape).args.diff).toBe('prev.json');
        expect(parseArgs([], shape).args.diff).toBeUndefined();
    });

    it('rejects a bare --diff: the previous report is not optional', () => {
        // Same @sigx/args limitation as --report-json (#177): a value flag has
        // no optional form, so `--diff` without a path is a parse error rather
        // than "diff against dist/report.json". The default is spelled out in
        // the help text instead.
        try {
            parseArgs(['--diff'], shape);
            expect.unreachable('should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ParseError);
            expect((err as ParseError).code).toBe('MISSING_VALUE');
        }
    });

    it('takes --log as a path, kebab or camel, and defaults it off', () => {
        expect(parseArgs(['--log', '.zero-iterations.jsonl'], shape).args.log).toBe('.zero-iterations.jsonl');
        expect(parseArgs(['--log=it.jsonl'], shape).args.log).toBe('it.jsonl');
        expect(parseArgs([], shape).args.log).toBeUndefined();
    });

    it('rejects a bare --log: the environment variable is the "always on" spelling', () => {
        // #177 again — no optional-value form — so `--log` alone cannot mean
        // "log to the default path". ZERO_ITERATION_LOG=<path> is that form.
        try {
            parseArgs(['--log'], shape);
            expect.unreachable('should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ParseError);
            expect((err as ParseError).code).toBe('MISSING_VALUE');
        }
    });

    it('rejects --report-json with no value, which is why the flag is split', () => {
        // This is the whole reason `--report` and `--report=json` cannot be one
        // flag: @sigx/args has no optional-value form, so a bare value flag is
        // a MISSING_VALUE error. Collapses once signalxjs/terminal#102 lands
        // (tracked as #177) — and this assertion is what will fail then.
        try {
            parseArgs(['--report-json'], shape);
            expect.unreachable('should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ParseError);
            expect((err as ParseError).code).toBe('MISSING_VALUE');
        }
    });
});

describe('zero:audit args', () => {
    const shape = shapeOf('zero:audit');

    it('applies the shared defaults and no others', () => {
        const { args } = parseArgs([], shape);
        expect(args.entry).toBe('./dist/design-system.js');
        expect(args.manifest).toBeUndefined();
        expect(args.strict).toBe(false);
        expect(args.json).toBeUndefined();
        expect(args.rule ?? []).toEqual([]);
    });

    it('takes --rule repeatedly', () => {
        const { args } = parseArgs(['--rule', 'button-affordance', '--rule', 'axis-coverage'], shape);
        expect(args.rule).toEqual(['button-affordance', 'axis-coverage']);
    });

    it('takes --json as a path, "-" included', () => {
        expect(parseArgs(['--json', 'audit.json'], shape).args.json).toBe('audit.json');
        expect(parseArgs(['--json=-'], shape).args.json).toBe('-');
    });

    it('rejects --json with no value (the --report-json rule, for the same reason)', () => {
        try {
            parseArgs(['--json'], shape);
            expect.unreachable('should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ParseError);
            expect((err as ParseError).code).toBe('MISSING_VALUE');
        }
    });

    it('does not let --strict swallow the next token', () => {
        const { args } = parseArgs(['--strict', '--manifest', 'm.json'], shape);
        expect(args.strict).toBe(true);
        expect(args.manifest).toBe('m.json');
    });

    it('has neither --out nor --report', () => {
        // The audit writes nothing but its own artifact, and the coverage
        // report is zero:validate's — offering either would be a lie.
        expect(() => parseArgs(['--out', 'x'], shape)).toThrow(ParseError);
        expect(() => parseArgs(['--report'], shape)).toThrow(ParseError);
    });
});
