/**
 * @sigx/zero-kit plugin
 *
 * Registers the design-system build, validate and audit commands with the
 * sigx CLI.
 * Auto-discovered in any package that has `@sigx/zero-kit` installed — see the
 * `"sigx-cli"` field in this package's package.json.
 *
 * Commands are namespaced (`zero:build`) rather than bare (`build`), because
 * the sigx CLI resolves command-name collisions last-plugin-wins: a project
 * that is both a Lynx app and a design-system package would otherwise get
 * whichever `build` loaded last. The bare names are registered as aliases, so
 * `sigx build` still works when nothing else claims it — a colliding alias is
 * dropped with a warning rather than silently taking over.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { a, definePlugin } from '@sigx/cli/plugin';

/** Shared flag declarations — identical across the three commands. */
const entryArg = a
    .positional()
    .default('./dist/design-system.js')
    .describe('Compiled ES module exporting `designSystem` (or default)');

const manifestArg = a
    .string()
    .valueHint('path')
    .describe('Anatomy manifest path (default: @sigx/zero/manifest.json, resolved from this directory)');

const extraManifestArg = a
    .string()
    .valueHint('path')
    .multiple()
    .describe('Ecosystem manifest fragment ({ package, components }) merged into the base manifest — repeatable');

// On by default, matching `runStandardBuild`. `ZERO_ECOSYSTEM=0` is the off
// switch — @sigx/args has no `--no-x` negation, so the env var carries it.
const ecosystemArg = a
    .boolean()
    .default(true)
    .describe('Adopt every dependency declaring a "sigx-zero" field (ZERO_ECOSYSTEM=0 turns it off)');

const ecosystemExcludeArg = a
    .string()
    .valueHint('package')
    .multiple()
    .describe('Package to leave out of --ecosystem adoption — repeatable');

/**
 * A project this plugin has something to say about: one that pulls in the
 * kit, or one that declares an ecosystem component.
 *
 * The kit dependency was the whole test, and nothing looser would have earned
 * its keep for the build/validate/audit commands: the CLI only loads this
 * plugin after finding `@sigx/zero-kit` among the project's own dependencies,
 * so by the time `detect` runs that much is already established, and a
 * source-shape heuristic on top could only produce false positives.
 *
 * `zero:fragment` widened it. A component package may depend on `@sigx/zero`
 * alone and never on the kit, and the field it declares says plainly what it
 * is — a stronger signal than any heuristic.
 */
function isZeroProject(cwd: string): boolean {
    const pkgPath = join(cwd, 'package.json');
    if (!existsSync(pkgPath)) return false;
    try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
            name?: string;
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
            'sigx-zero'?: unknown;
        };
        if (pkg.name === '@sigx/zero-kit') return false; // the kit itself, not a consumer
        // Presence, not truthiness: a malformed field (`null`, a string) is
        // exactly when the author needs `zero:fragment` to tell them why, and
        // hiding the command is the least helpful possible response.
        if ('sigx-zero' in pkg) return true;
        return Boolean(pkg.dependencies?.['@sigx/zero-kit'] || pkg.devDependencies?.['@sigx/zero-kit']);
    } catch {
        return false; // unparseable manifest — claim nothing
    }
}

export default definePlugin({
    name: 'zero',
    detect: isZeroProject,
    commands: {
        'zero:build': {
            description: 'Compile a design system to CSS artifacts',
            aliases: ['build'],
            args: {
                entry: entryArg,
                manifest: manifestArg,
                extraManifest: extraManifestArg,
                ecosystem: ecosystemArg,
                ecosystemExclude: ecosystemExcludeArg,
                out: a.string().valueHint('dir').default('./dist').describe('Output directory'),
            },
            async run(ctx) {
                const { runBuild } = await import('./commands/build.js');
                await runBuild(ctx, {
                    entry: ctx.args.entry,
                    manifest: ctx.args.manifest,
                    extraManifest: ctx.args.extraManifest,
                    ecosystem: ctx.args.ecosystem,
                    ecosystemExclude: ctx.args.ecosystemExclude,
                    out: ctx.args.out,
                });
            },
        },
        'zero:validate': {
            description: 'Check a design system against the anatomy manifest',
            aliases: ['validate'],
            args: {
                entry: entryArg,
                manifest: manifestArg,
                extraManifest: extraManifestArg,
                ecosystem: ecosystemArg,
                ecosystemExclude: ecosystemExcludeArg,
                strict: a.boolean().default(false).describe('Fail on warnings, not just errors'),
                // Two flags for one concept, because @sigx/args has no
                // optional-value form: a value flag given no value is a
                // MISSING_VALUE parse error, so `--report` and `--report=json`
                // cannot be the same flag. Collapses to
                // `--report[=text|json]` once signalxjs/terminal#102 lands —
                // tracked here as #177.
                report: a.boolean().default(false).describe('Print a coverage report'),
                reportJson: a
                    .string()
                    .valueHint('path')
                    .describe('Write the coverage report as JSON to <path> ("-" for stdout, which then carries nothing else)'),
                diff: a
                    .string()
                    .valueHint('path')
                    .describe('Print what moved since an earlier report.json (zero:build writes dist/report.json every run, so `--diff dist/report.json` compares against the last build)'),
                log: a
                    .string()
                    .valueHint('path')
                    .describe('Append this run to an iteration log (JSONL) and print the trend line; ZERO_ITERATION_LOG=<path> does the same for every run'),
            },
            async run(ctx) {
                const { runValidate } = await import('./commands/validate.js');
                await runValidate(ctx, {
                    entry: ctx.args.entry,
                    manifest: ctx.args.manifest,
                    extraManifest: ctx.args.extraManifest,
                    ecosystem: ctx.args.ecosystem,
                    ecosystemExclude: ctx.args.ecosystemExclude,
                    strict: ctx.args.strict,
                    report: ctx.args.report,
                    reportJson: ctx.args.reportJson,
                    diff: ctx.args.diff,
                    log: ctx.args.log,
                });
            },
        },
        // Also no bare alias — and `detect` reaches this one through the kit
        // dependency an app extending a design system needs anyway.
        'zero:extend': {
            description: 'Compile an installed design system against this project\'s ecosystem packs',
            args: {
                ds: a.string().valueHint('package').describe('The installed design system to extend'),
                out: a.string().valueHint('dir').default('./src/generated').describe('Where to write the artifacts'),
                manifest: manifestArg,
                ecosystemExclude: ecosystemExcludeArg,
            },
            async run(ctx) {
                const { runExtend } = await import('./commands/extend.js');
                if (!ctx.args.ds) throw new Error('--ds is required: the installed design system to extend');
                await runExtend(ctx, {
                    ds: ctx.args.ds,
                    out: ctx.args.out,
                    manifest: ctx.args.manifest,
                    ecosystemExclude: ctx.args.ecosystemExclude,
                });
            },
        },
        // No bare alias: `fragment` is a word other plugins may well want, and
        // the CLI resolves alias collisions last-plugin-wins.
        'zero:fragment': {
            description: 'Check an ecosystem component package\'s fragment, and emit its JSON form',
            args: {
                manifest: manifestArg,
                emit: a.boolean().default(true).describe('Write fragment.json beside the declared fragment module'),
                strict: a.boolean().default(false).describe('Fail on warnings, not just errors'),
            },
            async run(ctx) {
                const { runFragment } = await import('./commands/fragment.js');
                await runFragment(ctx, {
                    manifest: ctx.args.manifest,
                    emit: ctx.args.emit,
                    strict: ctx.args.strict,
                });
            },
        },
        // A third command rather than a flag on validate: validation is
        // correctness and gates the build, the audit is quality and must be
        // readable mid-iteration — and their exit-code semantics differ
        // (`--strict` here fails on warning FINDINGS). The build runs the
        // audit too, but never fails on it; this is where the exit code lives.
        'zero:audit': {
            description: 'Audit a design system — does what it built say what it claims?',
            aliases: ['audit'],
            args: {
                entry: entryArg,
                manifest: manifestArg,
                extraManifest: extraManifestArg,
                ecosystem: ecosystemArg,
                ecosystemExclude: ecosystemExcludeArg,
                strict: a.boolean().default(false).describe('Fail on warning findings, not just errors'),
                rule: a
                    .string()
                    .multiple()
                    .describe('Run only this rule (repeatable; default every rule — unknown names list the known ones)'),
                // The same two-flag shape as `--report`/`--report-json`, for the
                // same reason (#177): a value flag cannot also be bare.
                json: a
                    .string()
                    .valueHint('path')
                    .describe('Write the audit as JSON to <path> ("-" for stdout, which then carries nothing else)'),
            },
            async run(ctx) {
                const { runAudit } = await import('./commands/audit.js');
                await runAudit(ctx, {
                    entry: ctx.args.entry,
                    manifest: ctx.args.manifest,
                    extraManifest: ctx.args.extraManifest,
                    ecosystem: ctx.args.ecosystem,
                    ecosystemExclude: ctx.args.ecosystemExclude,
                    strict: ctx.args.strict,
                    rule: ctx.args.rule,
                    json: ctx.args.json,
                });
            },
        },
    },
});
