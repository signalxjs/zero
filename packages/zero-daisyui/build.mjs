// Compile the design system to CSS artifacts. Runs after tsgo has emitted
// dist/*.js (the design-system module) — see the package build script.
// The pipeline (validate → compile → report → writeArtifacts) lives in
// @sigx/zero-kit/build; this file is only the package's data.
import { fileURLToPath } from 'node:url';
import { anatomies } from '@sigx/zero/anatomy';
import { runStandardBuild } from '@sigx/zero-kit/build';
import { designSystem } from './dist/design-system.js';

await runStandardBuild({
    designSystem,
    manifest: { components: Object.values(anatomies).map((a) => a.toJSON()) },
    // fileURLToPath (not .pathname): on Windows .pathname is `/C:/…`, which fs rejects.
    targets: ['web', 'lynx'],
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
});
