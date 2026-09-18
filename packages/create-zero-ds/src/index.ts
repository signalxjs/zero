/**
 * `@sigx/create-zero-ds` — scaffold a SignalX Zero design system from a style
 * brief. The bin (`create-zero-ds`, behind `pnpm create @sigx/zero-ds`) is the
 * intended surface; this module exposes the same plumbing programmatically.
 */
export { main, EXIT_FAILED, EXIT_OK, EXIT_USAGE } from './cli.js';
export type { CliIo } from './cli.js';
export { defaultDir, designSystemName, planScaffold, writePlan } from './scaffold.js';
export type { PlannedFile, ScaffoldOptions, WriteOptions } from './scaffold.js';
export { BRIEFS_DIR, TEMPLATE_SOURCES, collectTemplates } from './collect.js';
export { defaultTemplatesDir, loadTemplates } from './templates.js';
export type { Templates, Versions } from './templates.js';
export { exportedNames, referencedNames, splitBrief, withoutTypeImport } from './brief.js';
export type { SplitBrief } from './brief.js';
export type { RenderContext, Target } from './render.js';
