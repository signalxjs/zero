#!/usr/bin/env node

/**
 * SignalX Zero - Pre-publish pack smoke test
 *
 * Catches packaging bugs that lint/typecheck/test miss:
 *   - missing files in `files` array
 *   - broken `exports` map (zero ships 21 subpaths on @sigx/zero alone)
 *   - unresolved `workspace:^` / `catalog:` ranges
 *   - dist/ produced by stale builds
 *   - non-JS artifacts dropped from the package (manifest.json, the CSS a
 *     design system IS)
 *
 * What it does:
 *   1. Build every publishable package.
 *   2. `pnpm pack` each into a temp dir.
 *   3. Spin up a minimal scratch project with `file:` deps on the tarballs.
 *   4. Typecheck a small TSX program that imports the main entries and
 *      several subpath entries, proving the published shape works.
 *   5. Resolve the non-JS artifacts from the installed packages, since a
 *      typecheck alone would never notice them missing.
 *
 * Usage:
 *   node scripts/verify-pack.js
 *
 * No flags. Exits non-zero on any failure.
 */

import { execSync } from 'child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'fs';
import { gunzipSync } from 'zlib';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Every publishable package, in dependency order (mirrors scripts/publish.js).
const PACKAGES = [
    'packages/zero',
    'packages/zero-kit',
    'packages/zero-basic',
    'packages/zero-daisyui',
    'packages/create-zero-ds',
];

const sandbox = join(tmpdir(), `sigx-zero-verify-pack-${Date.now()}`);
const tarballDir = join(sandbox, 'tarballs');
const appDir = join(sandbox, 'app');

function run(cmd, opts = {}) {
    console.log(`$ ${cmd}${opts.cwd ? `  (in ${opts.cwd})` : ''}`);
    execSync(cmd, { stdio: 'inherit', ...opts });
}

function step(label) {
    console.log(`\n▶  ${label}`);
}

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf-8'));
}

// Extract a single file's text from a gzipped npm tarball using only Node
// built-ins (no `tar`/`yaml` dep, cross-platform). npm/pnpm tarballs store
// entries under `package/`; ustar headers are 512-byte blocks with the name in
// bytes 0..100 and the octal size in bytes 124..136. Entry names here are short
// (`package/package.json`), so no GNU/PAX long-name handling is needed.
function readFileFromTarball(tarballPath, wantName) {
    const buf = gunzipSync(readFileSync(tarballPath));
    for (let offset = 0; offset + 512 <= buf.length; ) {
        const name = buf.subarray(offset, offset + 100).toString('utf-8').replace(/\0.*$/s, '');
        if (name === '') break; // end-of-archive zero blocks
        // Octal size field (bytes 124..136). Fail fast on a malformed header
        // rather than defaulting to 0 and silently desynchronizing the scan.
        const rawSize = buf.subarray(offset + 124, offset + 136).toString('utf-8').replace(/\0.*$/s, '').trim();
        const size = parseInt(rawSize, 8);
        if (!Number.isSafeInteger(size) || size < 0) {
            throw new Error(
                `Malformed tar header for "${name}" in ${tarballPath}: unparseable size field ${JSON.stringify(rawSize)}`
            );
        }
        offset += 512;
        if (offset + size > buf.length) {
            throw new Error(
                `Malformed tar entry "${name}" in ${tarballPath}: payload (${size} bytes) runs past end of archive`
            );
        }
        if (name === wantName) {
            return buf.subarray(offset, offset + size).toString('utf-8');
        }
        offset += Math.ceil(size / 512) * 512;
    }
    throw new Error(`${wantName} not found in ${tarballPath}`);
}

function packPackage(pkgPath) {
    const pkgFullPath = join(rootDir, pkgPath);
    const pkgJson = readJson(join(pkgFullPath, 'package.json'));
    run('pnpm pack --pack-destination ' + JSON.stringify(tarballDir), { cwd: pkgFullPath });
    const tarballs = readdirSync(tarballDir).filter((f) => f.endsWith('.tgz'));
    const safeName = pkgJson.name.replace('@', '').replace('/', '-');
    const match = tarballs.find((f) => f.startsWith(safeName));
    if (!match) {
        throw new Error(`Could not find tarball for ${pkgJson.name} in ${tarballDir}`);
    }
    const tarball = join(tarballDir, match);
    // Read the PUBLISHED manifest from inside the tarball, not the source
    // package.json: `pnpm pack` rewrites workspace `catalog:` specifiers to
    // their concrete ranges (e.g. `^0.12.0`), and that resolved form is what a
    // consumer actually installs. Reading source would leak the literal
    // `catalog:` protocol, which npm cannot resolve (EUNSUPPORTEDPROTOCOL).
    const publishedManifest = JSON.parse(readFileFromTarball(tarball, 'package/package.json'));
    return { name: pkgJson.name, version: pkgJson.version, tarball, publishedManifest };
}

/**
 * The pack smoke test is only meaningful if it covers exactly what
 * `scripts/publish.js` ships. That script self-executes on import, so read its
 * PACKAGES array from source rather than importing it.
 *
 * Both lists being stale copies of the repo-template's is what made this
 * check fail on every run, so the agreement is asserted rather than asked for
 * in a comment.
 */
function assertPublishListMatches() {
    const source = readFileSync(join(rootDir, 'scripts/publish.js'), 'utf-8');
    // Tolerant of formatting — a reformat of publish.js (quote style, spacing,
    // trailing comma) must not red CI when the package list itself is
    // unchanged.
    const block = /const\s+PACKAGES\s*=\s*\[([\s\S]*?)\]/.exec(source);
    if (!block) {
        throw new Error('Could not find the PACKAGES array in scripts/publish.js');
    }
    const published = [...block[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
    const same =
        published.length === PACKAGES.length &&
        published.every((p, i) => p === PACKAGES[i]);
    if (!same) {
        throw new Error(
            'PACKAGES in scripts/verify-pack.js and scripts/publish.js disagree — ' +
                'the pack smoke test would not cover what gets published.\n' +
                `   verify-pack: ${JSON.stringify(PACKAGES)}\n` +
                `   publish:     ${JSON.stringify(published)}`
        );
    }
    console.log(`   ✓ package list matches scripts/publish.js (${PACKAGES.length} packages)`);
}

function main() {
    step(`Sandbox: ${sandbox}`);
    mkdirSync(tarballDir, { recursive: true });
    mkdirSync(appDir, { recursive: true });

    step('Check the package list against scripts/publish.js');
    assertPublishListMatches();

    step('Build all packages');
    run('pnpm run build', { cwd: rootDir });

    step('Pack each publishable package');
    const packed = PACKAGES.map(packPackage);
    for (const p of packed) {
        console.log(`   📦 ${p.name}@${p.version}  →  ${p.tarball}`);
    }

    step('Create scratch app');
    const rootPkg = readJson(join(rootDir, 'package.json'));
    const zero = packed.find((p) => p.name === '@sigx/zero');
    if (!zero) {
        throw new Error("Expected '@sigx/zero' among the packed packages, but it was not found");
    }
    // sigx and the @sigx/* core peers must resolve — the scratch app plays the
    // consumer, so it installs them itself. Take the ranges from the PUBLISHED
    // manifest (catalog: already rewritten to a concrete range) so npm sees a
    // consistent graph; reading the source package.json would leak the literal
    // `catalog:` protocol, which npm can't resolve (EUNSUPPORTEDPROTOCOL).
    const peers = zero.publishedManifest.peerDependencies;
    const deps = {
        ...Object.fromEntries(
            packed.map((p) => [p.name, `file:${p.tarball.replace(/\\/g, '/')}`])
        ),
        sigx: peers.sigx,
        '@sigx/reactivity': peers['@sigx/reactivity'],
        '@sigx/runtime-core': peers['@sigx/runtime-core'],
        '@sigx/runtime-dom': peers['@sigx/runtime-dom'],
    };
    const appPkg = {
        name: 'sigx-zero-pack-smoke',
        version: '0.0.0',
        private: true,
        type: 'module',
        scripts: { build: 'tsc -p .' },
        dependencies: deps,
        devDependencies: {
            typescript: rootPkg.devDependencies.typescript,
        },
    };
    writeFileSync(join(appDir, 'package.json'), JSON.stringify(appPkg, null, 2));

    writeFileSync(
        join(appDir, 'tsconfig.json'),
        JSON.stringify(
            {
                compilerOptions: {
                    target: 'ES2022',
                    module: 'ESNext',
                    moduleResolution: 'Bundler',
                    jsx: 'react-jsx',
                    jsxImportSource: 'sigx',
                    resolveJsonModule: true,
                    strict: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                    noEmit: true,
                },
                include: ['src'],
            },
            null,
            2
        )
    );

    mkdirSync(join(appDir, 'src'), { recursive: true });

    // Exercise the public surface: the barrel, a compound component tree (so
    // the JSX types resolve through the published .d.ts), the two-way `model`
    // binding, and a design system's runtime module.
    writeFileSync(
        join(appDir, 'src', 'main.tsx'),
        [
            "import { Dialog, Tabs, ThemeProvider } from '@sigx/zero';",
            "import { installThemes } from '@sigx/zero-basic';",
            "import { component, signal } from 'sigx';",
            '',
            'installThemes();',
            '',
            'const App = component(() => {',
            "    const state = signal({ open: false, tab: 'a' });",
            '    return () => (',
            '        <ThemeProvider>',
            '            <Tabs.Root model={() => state.tab}>',
            '                <Tabs.List>',
            '                    <Tabs.Tab value="a">First</Tabs.Tab>',
            '                </Tabs.List>',
            '                <Tabs.Panel value="a">',
            '                    <Dialog.Root model={() => state.open}>',
            '                        <Dialog.Trigger>Open</Dialog.Trigger>',
            '                        <Dialog.Popup>',
            '                            <Dialog.Title>Packed</Dialog.Title>',
            '                            <Dialog.Close>Close</Dialog.Close>',
            '                        </Dialog.Popup>',
            '                    </Dialog.Root>',
            '                </Tabs.Panel>',
            '            </Tabs.Root>',
            '        </ThemeProvider>',
            '    );',
            '});',
            '',
            'export type _R = typeof App;',
            '',
        ].join('\n')
    );

    // Subpath exports (the tree-shaking targets) must resolve from the
    // published shape — zero ships 21 of them, so a broken `exports` map is
    // the most likely packaging bug here.
    writeFileSync(
        join(appDir, 'src', 'subpath-check.ts'),
        [
            "import { Dialog } from '@sigx/zero/dialog';",
            "import { Button } from '@sigx/zero/button';",
            "import { Select } from '@sigx/zero/select';",
            "import { anatomies } from '@sigx/zero/anatomy';",
            "import { themeController } from '@sigx/zero/theme';",
            "import { RECOMMENDED_ROLE_LIST } from '@sigx/zero/contract';",
            "import { createControllableState } from '@sigx/zero/behaviors';",
            '',
            'export type _C = [',
            '    typeof Dialog, typeof Button, typeof Select, typeof anatomies,',
            '    typeof themeController, typeof RECOMMENDED_ROLE_LIST,',
            '    typeof createControllableState,',
            '];',
            '',
        ].join('\n')
    );

    // The generated /register subpath must resolve from the published shape,
    // and its augmentation must bind against node_modules' @sigx/zero — the
    // production direction of the augmentation-binding question
    // (docs/architecture.md, "The register artifact"; the in-repo type tests cover the
    // src-paths direction). One @ts-expect-error proves the narrowing is
    // actually in force, not silently absent.
    writeFileSync(
        join(appDir, 'src', 'register-check.ts'),
        [
            "import '@sigx/zero-basic/register';",
            "import type { ColorValueFor, VariantValueFor } from '@sigx/zero';",
            "// The portable subpaths a non-DOM runtime consumes must resolve",
            "// from the published shape.",
            "import { partClass, CLASS_GRAMMAR_VERSION } from '@sigx/zero/contract/core';",
            "import { createListController } from '@sigx/zero/behaviors/core';",
            "import { registerThemes } from '@sigx/zero/theme/registry';",
            '',
            "const wired: ColorValueFor<'button'> = 'primary';",
            "const fill: VariantValueFor<'button'> = 'ghost';",
            '// @ts-expect-error — a typo must be rejected under the register module',
            "const typo: ColorValueFor<'button'> = 'primry';",
            'export { wired, fill, typo, partClass, CLASS_GRAMMAR_VERSION, createListController, registerThemes };',
            '',
        ].join('\n')
    );

    // The authoring kit is Node-only and never enters an app bundle, so a
    // consumer uses it type-only from a DS package's build script. Prove the
    // published types resolve that way.
    writeFileSync(
        join(appDir, 'src', 'kit-check.ts'),
        [
            "import type { RecipeInput, TokensInput } from '@sigx/zero-kit';",
            "import { compileDesignSystem, validateDesignSystem } from '@sigx/zero-kit';",
            'export type _K = [',
            '    RecipeInput, TokensInput,',
            '    typeof compileDesignSystem, typeof validateDesignSystem,',
            '];',
            '',
        ].join('\n')
    );

    step('Install scratch app (npm — to avoid pnpm workspace hoisting interference)');
    run('npm install --no-audit --no-fund --loglevel=error', { cwd: appDir });

    step('Typecheck scratch app against the packed tarballs');
    run('npm run build', { cwd: appDir });

    // A typecheck can't see a missing .json or .css — but for these packages
    // those files ARE the product: manifest.json is the machine-readable
    // contract tooling and AI generate against, and a design system is its
    // compiled CSS. Resolve them the way a consumer would.
    step('Resolve non-JS published artifacts');
    const artifacts = [
        '@sigx/zero/manifest.json',
        '@sigx/zero/css',
        '@sigx/zero-basic/css',
        '@sigx/zero-basic/lynx/index.css',
        '@sigx/zero-basic/lynx/tokens.css',
        '@sigx/zero-basic/lynx/manifest.json',
        '@sigx/zero-basic/audit.json',
        '@sigx/zero-daisyui/css',
        '@sigx/zero-daisyui/audit.json',
        '@sigx/zero-daisyui/lynx/index.css',
        '@sigx/zero-daisyui/lynx/tokens.css',
        '@sigx/zero-daisyui/lynx/manifest.json',
    ];
    writeFileSync(
        join(appDir, 'resolve-check.mjs'),
        [
            "import { createRequire } from 'node:module';",
            "import { readFileSync } from 'node:fs';",
            "// The grammar version from the INSTALLED contract — the check",
            "// compares the skins' envelopes against the published source of",
            "// truth, so a version bump cannot drift past it.",
            "import { CLASS_GRAMMAR_VERSION } from '@sigx/zero/contract/core';",
            '',
            'const require = createRequire(import.meta.url);',
            `const artifacts = ${JSON.stringify(artifacts)};`,
            '',
            'for (const spec of artifacts) {',
            '    const path = require.resolve(spec);',
            '    const body = readFileSync(path, "utf8");',
            '    if (body.trim() === "") throw new Error(`${spec} resolved to an empty file`);',
            '    if (spec.endsWith(".json")) JSON.parse(body);',
            '    console.log(`   ✓ ${spec}`);',
            '}',
            '',
            '// The manifest is the anatomy contract — an empty or truncated one',
            '// would still parse, so assert it actually carries components.',
            'const manifest = require("@sigx/zero/manifest.json");',
            'if (!Array.isArray(manifest.components) || manifest.components.length === 0) {',
            '    throw new Error("manifest.json contains no components");',
            '}',
            'console.log(`   ✓ manifest.json declares ${manifest.components.length} components`);',
            '',
            '// The lynx copies carry the delivery envelope — a wrong grammar',
            '// version here is a stylesheet the runtime must refuse.',
            'for (const skin of ["@sigx/zero-basic", "@sigx/zero-daisyui"]) {',
            '    const lynx = require(`${skin}/lynx/manifest.json`);',
            '    if (lynx.target !== "lynx" || lynx.classGrammarVersion !== CLASS_GRAMMAR_VERSION) {',
            '        throw new Error(`${skin} lynx manifest envelope is wrong: ${lynx.target}/${lynx.classGrammarVersion}`);',
            '    }',
            '    console.log(`   ✓ ${skin}/lynx manifest envelope ok`);',
            '}',
            '',
        ].join('\n')
    );
    run('node resolve-check.mjs', { cwd: appDir });

    // The scaffold is only proven by what it writes AGAINST THE PUBLISHED
    // SHAPE: templates must travel in `files`, the bin must link, and the
    // generated package must compile and build against the packed kit types
    // (module resolution walks up to the scratch app's node_modules, so the
    // generated packages need no install of their own). Two briefs on
    // purpose — the recommended shape, and riso (roles: {}, sizes: [], a fused
    // variant), the shape the fit helper exists for. Glass also takes the lynx
    // target, so the extra exports and dist/lynx are exercised too.
    // The real JS entry points, not `.bin` shims: on Windows `.bin` holds
    // `.cmd` files, which `node` cannot execute.
    step('Scaffold two design systems from the packed @sigx/create-zero-ds and build them');
    const createBin = join('node_modules', '@sigx', 'create-zero-ds', 'bin', 'create-zero-ds.mjs');
    const tscBin = join('node_modules', 'typescript', 'bin', 'tsc');
    const scaffolds = [
        { name: 'zero-riso-smoke', brief: 'riso', targets: 'web' },
        { name: 'zero-glass-smoke', brief: 'glass', targets: 'web,lynx' },
    ];
    for (const { name, brief, targets } of scaffolds) {
        run(`node ${JSON.stringify(createBin)} ${name} --brief ${brief} --targets ${targets}`, { cwd: appDir });
        run(`node ${JSON.stringify(tscBin)} -p ${name}/tsconfig.json`, { cwd: appDir });
        run(`node ${name}/build.mjs`, { cwd: appDir });
        const css = join(appDir, name, 'dist', 'css', 'index.css');
        if (readFileSync(css, 'utf-8').trim() === '') throw new Error(`${name}: dist/css/index.css is empty`);
        if (targets.includes('lynx')) {
            const lynx = join(appDir, name, 'dist', 'lynx', 'index.css');
            if (readFileSync(lynx, 'utf-8').trim() === '') throw new Error(`${name}: dist/lynx/index.css is empty`);
        }
        console.log(`   ✓ ${name} (--brief ${brief} --targets ${targets}) scaffolded, compiled and built`);
    }

    step('✅ Pack smoke test passed');
}

try {
    main();
} catch (err) {
    console.error('\n❌ Pack smoke test failed:', err.message);
    console.error(`   Sandbox preserved for inspection: ${sandbox}`);
    process.exitCode = 1;
    process.exit(1);
}

try {
    rmSync(sandbox, { recursive: true, force: true });
} catch {
    // ignore
}
