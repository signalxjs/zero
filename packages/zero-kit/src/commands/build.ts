/** `sigx zero:build` — validate a design system, then compile it to CSS artifacts. */
import { resolve } from 'node:path';
import { runStandardBuild } from '../build.js';
import type { CommandEnv } from './shared.js';
import { ecosystemOptionsFrom, loadDesignSystem, loadManifest } from './shared.js';

export interface BuildOptions {
    entry: string;
    manifest?: string;
    /** Ecosystem manifest fragments to merge into the base manifest. */
    extraManifest?: string[];
    /** Adopt dependencies that declare a `"sigx-zero"` field. */
    ecosystem?: boolean;
    /** Package names to leave out of that adoption. */
    ecosystemExclude?: string[];
    out: string;
}

export async function runBuild(env: CommandEnv, opts: BuildOptions): Promise<void> {
    // Fragments merge inside `loadManifest` (it resolves specifiers), so the
    // harness gets the already-merged manifest and no `fragments` argument —
    // the pipeline from validation on is the same `runStandardBuild` every
    // design-system build.mjs calls.
    const [ds, manifest] = await Promise.all([
        loadDesignSystem(env.cwd, opts.entry),
        loadManifest(env.cwd, opts.manifest, opts.extraManifest ?? []),
    ]);
    await runStandardBuild({
        designSystem: ds,
        manifest,
        // The command knows the project directory; the harness would otherwise
        // have to infer it from outDir.
        ecosystem: ecosystemOptionsFrom(env, opts),
        outDir: resolve(env.cwd, opts.out),
        logger: env.logger,
    });
}
