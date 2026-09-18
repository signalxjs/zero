// Collects the scaffold's templates from the workspace into templates/ as
// the second half of the package build (after tsgo has emitted dist/). The
// logic lives in src/collect.ts so the tests can run it typed; this file is
// only the entry point. Same shape as zero-kit's copy-schemas.mjs.
import { fileURLToPath } from 'node:url';
import { collectTemplates } from '../dist/collect.js';

const workspaceRoot = fileURLToPath(new URL('../../..', import.meta.url));
const outDir = fileURLToPath(new URL('../templates', import.meta.url));
const { templates, versions } = await collectTemplates(workspaceRoot, outDir);
console.log(`[create-zero-ds] collected ${templates.length} template(s) at ${versions.version} into templates/`);
