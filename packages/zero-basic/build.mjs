// Compile the design system to CSS artifacts. Runs after tsgo has emitted
// dist/*.js (the design-system module) — see the package build script.
// The pipeline (validate → compile → report → writeArtifacts) lives in
// @sigx/zero-kit/build; this file is only the package's data.
import { fileURLToPath } from 'node:url';
import { anatomies } from '@sigx/zero/anatomy';
import { runStandardBuild } from '@sigx/zero-kit/build';
import { designSystem } from './dist/design-system.js';

// The ecosystem adoption used to live here as two hand-edits — spread
// @sigx/zero-ext-example's recipe pack, pass its fragment. Both are now
// implied by the devDependency: the pack declares a "sigx-zero" field and
// discovery finds it, fits its recipes to this vocabulary and merges its
// anatomy. Nothing about the shipped result changed, including the emitted
// register.d.ts, which still excludes the ecosystem scope by name from its
// ZeroScope gate (see type-tests/ecosystem/).
//
// It still costs the published package nothing: this script is build tooling
// the `files` list never ships, so the private ext-example package stays out
// of the published module graph.
await runStandardBuild({
    designSystem,
    manifest: { components: Object.values(anatomies).map((a) => a.toJSON()) },
    // fileURLToPath (not .pathname): on Windows .pathname is `/C:/…`, which fs rejects.
    targets: ['web', 'lynx'],
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
});
