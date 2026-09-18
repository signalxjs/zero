/**
 * Collecting the scaffold's templates from the workspace — run at package
 * build time by `scripts/collect-templates.mjs`, and by the tests, which
 * collect into a temp dir and scaffold from it.
 *
 * Templates are EMBEDDED at build time rather than read from the installed
 * packages at run time: lockstep versioning makes the two content-identical,
 * and neither `@sigx/zero-basic/src/recipes.ts` nor a brief inside zero-kit's
 * `skills/` folder is reachable through those packages' `exports` maps. Every
 * file lands as `.txt` so the workspace's tsconfig and lint globs never see
 * it as source. `versions.json` records the lockstep version plus the ranges
 * a generated package needs, so the scaffold never guesses them.
 */
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Versions } from './templates.js';

/** Workspace-relative sources → template names. */
export const TEMPLATE_SOURCES: Readonly<Record<string, string>> = {
    'baseline.recipes.ts.txt': 'packages/zero-basic/src/recipes.ts',
    'brief.basic.ts.txt': 'packages/zero-basic/src/tokens.ts',
    'tsconfig.json.txt': 'packages/zero-basic/tsconfig.json',
};

export const BRIEFS_DIR = 'packages/zero-kit/skills/design-system/briefs';

interface PackageJson {
    version: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
}

/**
 * Collect every template into `outDir`. Recreates the directory rather than
 * merging, so a renamed brief cannot leave its old copy behind to ship.
 */
export async function collectTemplates(
    workspaceRoot: string,
    outDir: string,
): Promise<{ templates: string[]; versions: Versions }> {
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });

    for (const [name, source] of Object.entries(TEMPLATE_SOURCES)) {
        await copyFile(resolve(workspaceRoot, source), join(outDir, name));
    }

    const briefsDir = resolve(workspaceRoot, BRIEFS_DIR);
    const briefs = (await readdir(briefsDir)).filter((f) => f.endsWith('.ts')).sort();
    if (briefs.length === 0) {
        throw new Error(`[create-zero-ds] ${BRIEFS_DIR} holds no briefs — nothing to scaffold from`);
    }
    for (const file of briefs) {
        await copyFile(join(briefsDir, file), join(outDir, `brief.${file}.txt`));
    }

    const pkg = async (p: string): Promise<PackageJson> =>
        JSON.parse(await readFile(resolve(workspaceRoot, p), 'utf8')) as PackageJson;
    const kit = await pkg('packages/zero-kit/package.json');
    const basic = await pkg('packages/zero-basic/package.json');
    const root = await pkg('package.json');
    if (kit.version !== basic.version) {
        throw new Error(`[create-zero-ds] lockstep broken: zero-kit ${kit.version} vs zero-basic ${basic.version}`);
    }
    const sigxCli = kit.dependencies?.['@sigx/cli'];
    const typescript = root.devDependencies?.typescript;
    if (!sigxCli || !typescript) {
        throw new Error('[create-zero-ds] could not read the @sigx/cli or typescript range from the workspace');
    }
    const versions: Versions = { version: kit.version, sigxCli, typescript };
    await writeFile(join(outDir, 'versions.json'), `${JSON.stringify(versions, null, 4)}\n`);
    return {
        templates: [...Object.keys(TEMPLATE_SOURCES), ...briefs.map((f) => `brief.${f}.txt`), 'versions.json'],
        versions,
    };
}
