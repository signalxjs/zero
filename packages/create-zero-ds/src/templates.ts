/**
 * The embedded templates — read once from the package's `templates/` folder
 * (collected at build time by `scripts/collect-templates.mjs`).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Versions {
    /** The lockstep version of `@sigx/zero`, `@sigx/zero-kit` and `@sigx/zero-basic`. */
    version: string;
    /** The `@sigx/cli` range zero-kit itself depends on. */
    sigxCli: string;
    /** The TypeScript range the workspace builds with. */
    typescript: string;
}

export interface Templates {
    /** `@sigx/zero-basic`'s `src/recipes.ts`, verbatim. */
    baselineRecipes: string;
    /** `@sigx/zero-basic`'s `tsconfig.json`, verbatim. */
    tsconfig: string;
    /** Brief id → the brief's source (`basic` is zero-basic's `tokens.ts`). */
    briefs: Record<string, string>;
    versions: Versions;
}

/** The package's own `templates/` folder — the published location. */
export function defaultTemplatesDir(): string {
    return join(packageRoot(), 'templates');
}

/**
 * The package root, from this module's own path (`src/` or `dist/`, one
 * level down either way). A path join rather than `new URL('../', …)`:
 * under a DOM test environment the global `URL` is not Node's, and
 * `fileURLToPath` rejects it.
 */
function packageRoot(): string {
    return join(dirname(fileURLToPath(import.meta.url)), '..');
}

/**
 * This package's own version, from its package.json — which ships in every
 * install, unlike `templates/` (built), so `--version` never needs them.
 */
export function ownVersion(): string {
    const pkg = JSON.parse(readFileSync(join(packageRoot(), 'package.json'), 'utf8')) as { version: string };
    return pkg.version;
}

/**
 * How many recipes the baseline source's `export const recipes = [...]` list
 * holds — so the scaffold states the count of what it actually copied rather
 * than a number remembered from when the template was written (#197). The
 * list is identifiers only (zero-basic's convention, which the collect test
 * pins), so counting its comma-separated entries is exact. Throws rather
 * than guess when the list is not there.
 */
export function baselineRecipeCount(source: string): number {
    const match = /^export const recipes\b[^=]*=\s*\[([\s\S]*?)\];/m.exec(source);
    if (!match) {
        throw new Error('[create-zero-ds] the baseline template has no `export const recipes = [...]` list to count');
    }
    return match[1]!.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0).length;
}

const BRIEF_FILE =/^brief\.([a-z0-9-]+)\.ts\.txt$/;

export function loadTemplates(dir: string = defaultTemplatesDir()): Templates {
    const read = (name: string): string => readFileSync(join(dir, name), 'utf8');
    const briefs: Record<string, string> = {};
    for (const file of readdirSync(dir).sort()) {
        const match = BRIEF_FILE.exec(file);
        if (match) briefs[match[1]!] = read(file);
    }
    if (Object.keys(briefs).length === 0) {
        throw new Error(`[create-zero-ds] no briefs found in ${dir} — was the package built?`);
    }
    return {
        baselineRecipes: read('baseline.recipes.ts.txt'),
        tsconfig: read('tsconfig.json.txt'),
        briefs,
        versions: JSON.parse(read('versions.json')) as Versions,
    };
}
