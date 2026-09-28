// Compile the design system to CSS artifacts. Runs after tsgo has emitted
// dist/*.js (the design-system module) — see the package build script.
//
// The mail kit's scopes join zero's through its manifest fragment: passed
// explicitly rather than discovered, because the kit ships no recipe pack —
// this design system styles those scopes itself (src/mail.ts).
import { fileURLToPath } from 'node:url';
import { anatomies } from '@sigx/zero/anatomy';
import { runStandardBuild } from '@sigx/zero-kit/build';
import { fragment } from '@sigx/zero-mail-kit/fragment';
import { designSystem } from './dist/design-system.js';

await runStandardBuild({
    designSystem,
    manifest: { components: Object.values(anatomies).map((a) => a.toJSON()) },
    fragments: [fragment],
    ecosystem: false,
    // fileURLToPath (not .pathname): on Windows .pathname is `/C:/…`, which fs rejects.
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
});
