/**
 * The embedded templates — read once from the package's `templates/` folder
 * (collected at build time by `scripts/collect-templates.mjs`).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
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
    return fileURLToPath(new URL('../templates/', import.meta.url));
}

const BRIEF_FILE = /^brief\.([a-z0-9-]+)\.ts\.txt$/;

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
