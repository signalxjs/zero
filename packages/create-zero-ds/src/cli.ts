/**
 * `create-zero-ds <name> --brief <id> [options]` — the command behind
 * `pnpm create @sigx/zero-ds`. Non-interactive by design: agents drive it,
 * so a missing argument is an exit code and a usage line, never a prompt.
 */
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { checkPlan, defaultDir, planScaffold, validatePackageName, writePlan } from './scaffold.js';
import type { ScaffoldOptions } from './scaffold.js';
import { loadTemplates, ownVersion } from './templates.js';
import type { Templates } from './templates.js';
import type { Target } from './render.js';

export interface CliIo {
    stdout: (line: string) => void;
    stderr: (line: string) => void;
    cwd: string;
    /** Override for tests — the templates to scaffold from. */
    templates?: Templates;
    /** Override for tests — where to load templates from when `templates` is not given. */
    templatesDir?: string;
}

const USAGE = `Usage: create-zero-ds <name> --brief <id> [options]

  <name>               package name: zero-acme, or @acme/zero-acme
  --brief <id>         style brief to start from (required)
  --baseline basic|none
                       basic (default): @sigx/zero-basic's 50 recipes, fitted
                       to the brief's vocabulary; none: the brief's Button only
  --targets web[,lynx] emit targets (default: web)
  --dir <path>         output directory (default: ./<last segment of name>)
  --dry-run            print the file plan, write nothing (same
                       non-empty check as a real run)
  --force              write into a non-empty directory (lists what it overwrites)
  -h, --help           this text
  -v, --version        print the version`;

export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_USAGE = 2;

function parseTargets(raw: string): Target[] {
    const targets = raw.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
    for (const t of targets) {
        if (t !== 'web' && t !== 'lynx') throw new Error(`unknown target "${t}" — web, lynx`);
    }
    if (!targets.includes('web')) throw new Error('--targets must include web');
    return [...new Set(targets)] as Target[];
}

export async function main(argv: readonly string[], io: CliIo = {
    stdout: (l) => console.log(l),
    stderr: (l) => console.error(l),
    cwd: process.cwd(),
}): Promise<number> {
    let parsed: ReturnType<typeof parseArgs<{ options: Record<string, { type: 'string' | 'boolean'; short?: string }>; allowPositionals: true }>>;
    try {
        parsed = parseArgs({
            args: [...argv],
            allowPositionals: true,
            options: {
                brief: { type: 'string' },
                baseline: { type: 'string' },
                targets: { type: 'string' },
                dir: { type: 'string' },
                'dry-run': { type: 'boolean' },
                force: { type: 'boolean' },
                help: { type: 'boolean', short: 'h' },
                version: { type: 'boolean', short: 'v' },
            },
        });
    } catch (error) {
        io.stderr(`create-zero-ds: ${(error as Error).message}`);
        io.stderr(USAGE);
        return EXIT_USAGE;
    }
    const { values, positionals } = parsed;
    const load = (): Templates => io.templates ?? loadTemplates(io.templatesDir);

    // --help and --version answer without the templates: those are built
    // (a half-built checkout has none), and neither flag needs them — the
    // brief list is a bonus, the version is this package's own.
    if (values.help) {
        io.stdout(USAGE);
        try {
            io.stdout(`\nBriefs: ${Object.keys(load().briefs).join(', ')}`);
        } catch {
            // No templates — the usage text stands on its own.
        }
        return EXIT_OK;
    }
    if (values.version) {
        io.stdout(ownVersion());
        return EXIT_OK;
    }

    let templates: Templates;
    try {
        templates = load();
    } catch (error) {
        io.stderr(`create-zero-ds: ${(error as Error).message}`);
        return EXIT_FAILED;
    }

    const name = positionals[0];
    if (!name || positionals.length > 1) {
        io.stderr(positionals.length > 1 ? 'create-zero-ds: one <name>, please' : 'create-zero-ds: <name> is required');
        io.stderr(USAGE);
        return EXIT_USAGE;
    }
    if (!values.brief) {
        io.stderr(`create-zero-ds: --brief is required — one of: ${Object.keys(templates.briefs).join(', ')}`);
        io.stderr(USAGE);
        return EXIT_USAGE;
    }
    try {
        validatePackageName(name);
    } catch (error) {
        io.stderr(`create-zero-ds: ${(error as Error).message}`);
        io.stderr(USAGE);
        return EXIT_USAGE;
    }
    if (values.baseline !== undefined && values.baseline !== 'basic' && values.baseline !== 'none') {
        io.stderr(`create-zero-ds: --baseline must be basic or none (got "${values.baseline}")`);
        return EXIT_USAGE;
    }

    let options: ScaffoldOptions;
    try {
        options = {
            name,
            brief: values.brief as string,
            baseline: (values.baseline as 'basic' | 'none' | undefined) ?? 'basic',
            targets: values.targets ? parseTargets(values.targets as string) : ['web'],
        };
    } catch (error) {
        io.stderr(`create-zero-ds: ${(error as Error).message}`);
        return EXIT_USAGE;
    }

    const dir = resolve(io.cwd, (values.dir as string | undefined) ?? defaultDir(name));
    try {
        const plan = planScaffold(options, templates);
        const force = values.force === true;
        if (values['dry-run']) {
            // The same refusal the real run makes, so a dry run that passes
            // means the real one will too.
            const existing = new Set(checkPlan(dir, plan, { force }));
            io.stdout(`Would write ${plan.length} files into ${dir}:`);
            for (const file of plan) {
                io.stdout(`  ${file.path}  (${file.content.length} bytes)${existing.has(file.path) ? '  (overwrites)' : ''}`);
            }
            return EXIT_OK;
        }
        const overwritten = new Set(writePlan(dir, plan, { force }));
        io.stdout(`Scaffolded ${name} from the "${options.brief}" brief into ${dir}:`);
        for (const file of plan) io.stdout(`  ${file.path}${overwritten.has(file.path) ? '  (overwritten)' : ''}`);
        io.stdout('');
        io.stdout('Next:');
        io.stdout(`  cd ${dir}`);
        io.stdout('  pnpm install');
        io.stdout('  pnpm build                       # tsc + compile to dist/css');
        io.stdout('  export ZERO_ITERATION_LOG=.zero-iterations.jsonl  # optional: a trend line per validate run');
        io.stdout('  npx sigx zero:validate --report  # then iterate — see node_modules/@sigx/zero-kit/skills/design-system/SKILL.md');
        io.stdout('  npx sigx zero:audit              # does what you built say what it claims (the compiled CSS)');
        return EXIT_OK;
    } catch (error) {
        io.stderr(`create-zero-ds: ${(error as Error).message}`);
        return EXIT_FAILED;
    }
}
