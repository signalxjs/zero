/**
 * Planning and writing a scaffold — `planScaffold` is pure (options +
 * templates → the files), `writePlan` is the only thing that touches disk.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
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

/** Write a plan under `dir`. Creates it; refuses a non-empty one unless forced. */
export function writePlan(dir: string, plan: readonly PlannedFile[], options: WriteOptions = {}): void {
    if (existsSync(dir) && readdirSync(dir).length > 0 && !options.force) {
        throw new Error(`${dir} is not empty — pass --force to write into it anyway`);
    }
    for (const file of plan) {
        const target = join(dir, ...file.path.split('/'));
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, file.content);
    }
}
