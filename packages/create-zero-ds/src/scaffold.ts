/**
 * Planning and writing a scaffold — `planScaffold` is pure (options +
 * templates → the files), `writePlan` is the only thing that touches disk.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join } from 'node:path';
import { exportedNames, referencedNames, splitBrief, withoutTypeImport } from './brief.js';
import {
    provenance,
    renderBuildMjs,
    renderDesignSystemTs,
    renderGitignore,
    renderIndexTs,
    renderPackageJson,
    renderReadme,
    renderRecipesTs,
} from './render.js';
import type { RenderContext, Target } from './render.js';
import { baselineRecipeCount } from './templates.js';
import type { Templates } from './templates.js';

export interface ScaffoldOptions {
    /** The npm package name (`zero-acme`, `@acme/zero-acme`). */
    name: string;
    brief: string;
    baseline?: 'basic' | 'none';
    targets?: readonly Target[];
}

export interface PlannedFile {
    /** Relative to the target directory, `/`-separated. */
    path: string;
    content: string;
}

/** `[a-z][a-z0-9-]*` — what a `data-scope`-adjacent identifier and a CSS-safe name both accept. */
const KEBAB = /^[a-z][a-z0-9-]*$/;

/**
 * npm's package-name grammar (what `validate-npm-package-name` accepts for a
 * new package): an optional lowercase `@scope/`, then one lowercase segment
 * of lowercase letters, digits, `-`, `.` and `_`, neither starting with `.` or `_`, at most 214
 * characters in all, and — unscoped — not a Node core-module name. Anything
 * else scaffolds a package.json npm rejects.
 */
const NPM_SEGMENT = '[a-z0-9-][a-z0-9._-]*';
const NPM_NAME = new RegExp(`^(?:@${NPM_SEGMENT}/)?${NPM_SEGMENT}$`);

/** Throws unless `packageName` is a valid npm name AND yields a design-system name. */
export function validatePackageName(packageName: string): void {
    if (packageName.length > 214 || !NPM_NAME.test(packageName)) {
        throw new Error(`"${packageName}" is not a valid npm package name — lowercase, an optional @scope/, one name segment of letters, digits, "-", "." or "_" (not leading . or _)`);
    }
    if (!packageName.startsWith('@') && builtinModules.includes(packageName)) {
        throw new Error(`"${packageName}" is a Node core module name — npm does not accept it for a new package`);
    }
    designSystemName(packageName);
}

/** The design-system name from the package name: last path segment, minus a leading `zero-`. */
export function designSystemName(packageName: string): string {
    const segment = packageName.split('/').pop() ?? packageName;
    const name = segment.startsWith('zero-') ? segment.slice('zero-'.length) : segment;
    if (!KEBAB.test(name)) {
        throw new Error(`"${packageName}" does not yield a kebab-case design-system name (got "${name}") — use lowercase letters, digits and hyphens`);
    }
    return name;
}

/** The default output directory: the package name's last segment. */
export function defaultDir(packageName: string): string {
    return packageName.split('/').pop() ?? packageName;
}

export function planScaffold(options: ScaffoldOptions, templates: Templates): PlannedFile[] {
    const brief = templates.briefs[options.brief];
    if (!brief) {
        throw new Error(`unknown brief "${options.brief}" — available: ${Object.keys(templates.briefs).join(', ')}`);
    }
    validatePackageName(options.name);
    const baseline = options.baseline ?? 'basic';
    const targets = options.targets ?? ['web'];
    const split = splitBrief(brief);
    if (baseline === 'none' && !split.button) {
        throw new Error(`the "${options.brief}" brief carries no Button recipe, so --baseline none would scaffold no recipes at all`);
    }
    const ctx: RenderContext = {
        packageName: options.name,
        dsName: designSystemName(options.name),
        brief: options.brief,
        baseline,
        targets,
        hasButton: split.button !== undefined,
        baselineRecipeCount: baselineRecipeCount(templates.baselineRecipes),
        versions: templates.versions,
    };

    const briefSource = options.brief === 'basic'
        ? '@sigx/zero-basic src/tokens.ts'
        : `the "${options.brief}" brief in @sigx/zero-kit/skills/design-system/briefs`;

    const files: PlannedFile[] = [
        { path: 'package.json', content: renderPackageJson(ctx) },
        { path: 'tsconfig.json', content: templates.tsconfig },
        { path: 'build.mjs', content: renderBuildMjs(ctx) },
        { path: 'README.md', content: renderReadme(ctx) },
        { path: '.gitignore', content: renderGitignore() },
        { path: 'src/index.ts', content: renderIndexTs(ctx) },
        { path: 'src/design-system.ts', content: renderDesignSystemTs(ctx) },
        { path: 'src/recipes.ts', content: renderRecipesTs(ctx) },
    ];

    // tokens.ts: the brief's head. `RecipeInput` moves to button.ts with the
    // recipe that needs it (an unused type import is harmless, but a file
    // that imports what it does not use reads as unfinished).
    const tokensHead = split.button ? withoutTypeImport(split.tokens, 'RecipeInput') : split.tokens;
    files.push({ path: 'src/tokens.ts', content: provenance('Tokens', briefSource, ctx) + tokensHead });

    if (split.button) {
        const names = referencedNames(split.button, exportedNames(split.tokens));
        const header = [
            provenance('The worked Button recipe', briefSource, ctx),
            "import type { RecipeInput } from '@sigx/zero-kit';",
            ...(names.length > 0 ? [`import { ${names.join(', ')} } from './tokens.js';`] : []),
            '',
        ].join('\n');
        files.push({ path: 'src/button.ts', content: header + split.button });
    }

    if (baseline === 'basic') {
        files.push({
            path: 'src/baseline.ts',
            content: provenance('Baseline recipes', '@sigx/zero-basic src/recipes.ts', ctx) + templates.baselineRecipes,
        });
    }

    return files;
}

export interface WriteOptions {
    /** Write into a non-empty directory. Default: refuse. */
    force?: boolean;
}

const targetPath = (dir: string, file: PlannedFile): string => join(dir, ...file.path.split('/'));

/**
 * The checks `writePlan` makes before writing, without writing: throws for a
 * non-empty `dir` unless forced, and returns the planned paths that already
 * exist there (what a forced write overwrites). `--dry-run` runs this, so it
 * refuses exactly what the real run refuses.
 */
export function checkPlan(dir: string, plan: readonly PlannedFile[], options: WriteOptions = {}): string[] {
    if (existsSync(dir) && readdirSync(dir).length > 0 && !options.force) {
        throw new Error(`${dir} is not empty — pass --force to write into it anyway`);
    }
    return plan.filter((file) => existsSync(targetPath(dir, file))).map((file) => file.path);
}

/**
 * Write a plan under `dir`. Creates it; refuses a non-empty one unless
 * forced. Returns the planned paths that existed before and were overwritten.
 */
export function writePlan(dir: string, plan: readonly PlannedFile[], options: WriteOptions = {}): string[] {
    const overwritten = checkPlan(dir, plan, options);
    for (const file of plan) {
        const target = targetPath(dir, file);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, file.content);
    }
    return overwritten;
}
