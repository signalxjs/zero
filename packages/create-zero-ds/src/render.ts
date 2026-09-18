/**
 * The generated files, one renderer each. Pure string functions of the
 * scaffold options — nothing here touches the filesystem.
 */
import type { Versions } from './templates.js';

export type Target = 'web' | 'lynx';

export interface RenderContext {
    /** The npm package name, as given (`zero-acme`, `@acme/zero-acme`). */
    packageName: string;
    /** The design system's name — the manifest / CSS identifier. */
    dsName: string;
    brief: string;
    baseline: 'basic' | 'none';
    targets: readonly Target[];
    /** Whether the brief supplies a Button recipe (`src/button.ts` exists). */
    hasButton: boolean;
    versions: Versions;
}

const lynx = (ctx: RenderContext): boolean => ctx.targets.includes('lynx');

export function renderPackageJson(ctx: RenderContext): string {
    const range = `^${ctx.versions.version}`;
    const exports: Record<string, unknown> = {
        '.': { types: './dist/index.d.ts', import: './dist/index.js' },
        // The compiled input, so an app can run `sigx zero:extend` against
        // this design system once it is published.
        './design-system': { types: './dist/design-system.d.ts', import: './dist/design-system.js' },
        './register': { types: './dist/register.d.ts', import: './dist/register.js' },
        './css': './dist/css/index.css',
        './css/tokens': './dist/css/tokens.css',
        './css/*': './dist/css/components/*.css',
        './manifest.json': './dist/manifest.json',
        './report.json': './dist/report.json',
    };
    if (lynx(ctx)) {
        exports['./lynx/index.css'] = './dist/lynx/index.css';
        exports['./lynx/tokens.css'] = './dist/lynx/tokens.css';
        exports['./lynx/manifest.json'] = './dist/lynx/manifest.json';
    }
    const pkg = {
        name: ctx.packageName,
        version: '0.1.0',
        description: `A SignalX Zero design system — scaffolded from the "${ctx.brief}" brief by @sigx/create-zero-ds.`,
        type: 'module',
        main: './dist/index.js',
        types: './dist/index.d.ts',
        exports,
        files: ['dist', 'src'],
        sideEffects: false,
        scripts: {
            build: 'tsc -p tsconfig.json && node build.mjs',
            typecheck: 'tsc --noEmit -p tsconfig.json',
            validate: 'tsc -p tsconfig.json && sigx zero:validate --report',
        },
        peerDependencies: { '@sigx/zero': range },
        devDependencies: {
            '@sigx/cli': ctx.versions.sigxCli,
            '@sigx/zero': range,
            '@sigx/zero-kit': range,
            typescript: ctx.versions.typescript,
        },
    };
    return `${JSON.stringify(pkg, null, 4)}\n`;
}

export function renderBuildMjs(ctx: RenderContext): string {
    const lines = [
        '// Compile the design system to CSS artifacts. Runs after tsc has emitted',
        '// dist/*.js (the design-system module) — see the package build script.',
        '// The pipeline (validate → compile → report → writeArtifacts) lives in',
        "// @sigx/zero-kit/build; this file is only the package's data.",
        "import { fileURLToPath } from 'node:url';",
        "import { anatomies } from '@sigx/zero/anatomy';",
        "import { runStandardBuild } from '@sigx/zero-kit/build';",
        "import { designSystem } from './dist/design-system.js';",
        '',
        'await runStandardBuild({',
        '    designSystem,',
        '    manifest: { components: Object.values(anatomies).map((a) => a.toJSON()) },',
    ];
    if (lynx(ctx)) lines.push("    targets: ['web', 'lynx'],");
    lines.push(
        '    // fileURLToPath (not .pathname): on Windows .pathname is `/C:/…`, which fs rejects.',
        "    outDir: fileURLToPath(new URL('./dist', import.meta.url)),",
        '});',
        '',
    );
    return lines.join('\n');
}

export function renderIndexTs(_ctx: RenderContext): string {
    return [
        '/**',
        ' * The runtime half: the CSS is the design system (`<pkg>/css`); this module',
        ' * seeds the zero theme registry so `useTheme()` / `themeController()` know',
        ' * the available themes, their schemes and pairs.',
        ' */',
        "import { registerThemes } from '@sigx/zero';",
        "import { tokens } from './tokens.js';",
        '',
        "export { roles, tokens } from './tokens.js';",
        "export { recipes } from './recipes.js';",
        "export { designSystem } from './design-system.js';",
        '',
        'export function installThemes(): void {',
        '    registerThemes(tokens);',
        '}',
        '',
    ].join('\n');
}

export function renderDesignSystemTs(ctx: RenderContext): string {
    return [
        "import type { DesignSystemInput } from '@sigx/zero-kit';",
        "import { layoutCss, layoutRecipes } from '@sigx/zero-kit/define';",
        "import { roles, tokens } from './tokens.js';",
        "import { recipes } from './recipes.js';",
        '',
        '/**',
        ' * The layout tier (Stack, Spacer, …) is generated from the tokens above —',
        " * this design system's own spacing ramp and breakpoints — rather than",
        ' * authored, because `gap="md"` has to mean the same rung in every design',
        ' * system. You choose what `--space-md` IS; the pack decides nothing else.',
        ' *',
        ' * Composed here rather than in `recipes.ts` so it stays out of the frozen',
        ' * baseline copy. Override any of it by adding your own recipe for the same',
        ' * component AFTER the spread.',
        ' */',
        'export const designSystem: DesignSystemInput<typeof roles> = {',
        `    name: '${ctx.dsName}',`,
        '    tokens,',
        '    recipes: [...layoutRecipes(tokens), ...recipes],',
        '    css: [layoutCss(tokens)],',
        '};',
        '',
        'export default designSystem;',
        '',
    ].join('\n');
}

export function renderRecipesTs(ctx: RenderContext): string {
    const lines: string[] = [];
    if (ctx.baseline === 'basic') {
        lines.push(
            '/**',
            ' * The recipe list the design system compiles.',
            ' *',
            " * `baseline.ts` is @sigx/zero-basic's recipes, copied whole so every one of",
            ' * the 50 components is styled from the first build. `fitRecipesToVocabulary`',
            " * keeps only what `tokens.ts` declares — for the recommended vocabulary it is",
            ' * the identity; for a brief that declines the colour or size axis, or fuses',
            ' * `variant`, it drops the blocks those axes would have wired and redraws every',
            ' * undeclared role in `base-content` on `base-100`.',
            ' *',
            ' * Delete the fit call once every recipe speaks this design system\'s own',
            " * vocabulary — it is scaffolding, not architecture. Diverge freely from the",
            ' * baseline in the meantime; it is yours now.',
            ' */',
            "import { fitRecipesToVocabulary } from '@sigx/zero-kit/define';",
            "import { recipes as baseline } from './baseline.js';",
        );
        if (ctx.hasButton) lines.push("import { button } from './button.js';");
        lines.push("import { tokens } from './tokens.js';", '');
        if (ctx.hasButton) {
            lines.push(
                'export const recipes = [',
                "    ...fitRecipesToVocabulary(baseline, tokens).filter((recipe) => recipe.component !== 'button'),",
                '    button,',
                '];',
            );
        } else {
            lines.push('export const recipes = fitRecipesToVocabulary(baseline, tokens);');
        }
    } else {
        lines.push(
            '/**',
            ' * The recipe list the design system compiles — the brief\'s Button only.',
            ' * Every other component renders unstyled but accessible until you write',
            ' * its recipe (`sigx zero:validate` lists what is missing).',
            ' */',
            "import { button } from './button.js';",
            '',
            'export const recipes = [button];',
        );
    }
    lines.push('');
    return lines.join('\n');
}

export function renderReadme(ctx: RenderContext): string {
    const baseline = ctx.baseline === 'basic'
        ? "every component styled from `@sigx/zero-basic`'s recipes (`src/baseline.ts`), fitted to this brief's vocabulary"
        : 'the brief\'s Button only — the other components are yours to style';
    return [
        `# ${ctx.packageName}`,
        '',
        `A [SignalX Zero](https://npmjs.com/package/@sigx/zero) design system, scaffolded from the **${ctx.brief}** brief by \`@sigx/create-zero-ds\` — ${baseline}.`,
        '',
        '## Build',
        '',
        '```sh',
        'pnpm install',
        'pnpm build                      # tsc, then compile tokens + recipes to dist/css',
        'export ZERO_ITERATION_LOG=.zero-iterations.jsonl  # optional: one trend line per run, gitignored',
        'npx sigx zero:validate --report # the generate → validate → fix loop',
        'npx sigx zero:audit             # …and the audit: does the compiled CSS say what it claims',
        '```',
        '',
        '## Use',
        '',
        '```ts',
        `import '${ctx.packageName}/css';`,
        `import { installThemes } from '${ctx.packageName}';`,
        'installThemes();',
        '```',
        '',
        '## Next',
        '',
        `The \`design-system\` agent skill in \`node_modules/@sigx/zero-kit/skills/design-system/SKILL.md\` is the procedure: step 3 tunes \`src/tokens.ts\`, step 4 writes recipes against the anatomy manifest, step 6 is the validate loop.${ctx.baseline === 'basic' ? ' `src/baseline.ts` is a starting point, not a dependency — diverge from it, and delete the `fitRecipesToVocabulary` call in `src/recipes.ts` once every recipe speaks your vocabulary.' : ''}`,
        '',
    ].join('\n');
}

export function renderGitignore(): string {
    // `.zero-iterations.jsonl` is where the skill's step 6 keeps the
    // validate loop's iteration log (ZERO_ITERATION_LOG) — local, never shipped.
    return 'dist/\nnode_modules/\n.zero-iterations.jsonl\n';
}

/** The comment block stamped at the top of a copied file — where it came from, and that it is now the author's. */
export function provenance(what: string, from: string, ctx: RenderContext): string {
    return [
        `// ${what} — copied from ${from} by @sigx/create-zero-ds@${ctx.versions.version}.`,
        '// It is yours now: edit freely, nothing keeps it in sync with the source.',
        '',
    ].join('\n');
}
