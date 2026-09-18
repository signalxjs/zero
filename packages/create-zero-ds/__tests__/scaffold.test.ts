/**
 * The scaffold, end to end and in-process: collect the templates from the
 * workspace exactly as the package build does, scaffold every brief into a
 * temp dir, import the generated design-system module through vitest, and
 * run it through the same validate → compile → build pipeline a consumer's
 * `pnpm build` would. Zero errors and zero warnings, for every brief, is the
 * bar — a scaffolded package must start clean or the loop it hands the agent
 * begins with noise that is not theirs.
 *
 * Shown red first: with the fit call stripped from the generated recipes.ts,
 * the riso case fails validation on basic's size blocks and role references.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import { auditDesignSystem, compileDesignSystem, validateDesignSystem } from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent } from '@sigx/zero-kit';
import { runStandardBuild } from '@sigx/zero-kit/build';
import { collectTemplates } from '../src/collect.js';
import { designSystemName, planScaffold, writePlan } from '../src/scaffold.js';
import { loadTemplates } from '../src/templates.js';
import type { Templates } from '../src/templates.js';
import { LAYOUT_SCOPES } from '@sigx/zero-kit';

const workspaceRoot = resolve(import.meta.dirname, '../../..');
const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };
const silent = { log() {}, warn() {}, error() {} };

const tempDirs: string[] = [];
/** For build output — nothing is imported from here. */
const tempDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'create-zero-ds-'));
    tempDirs.push(dir);
    return dir;
};
/**
 * For scaffolds the test IMPORTS: vitest's module runner serves only files
 * under the project root, so a generated `design-system.ts` in the OS temp
 * dir is "Cannot find module". `.scaffold-out/` is gitignored and sits
 * outside both `src/` and `__tests__/`, so neither tsconfig nor the test
 * glob ever picks it up as source.
 */
const scaffoldRoot = resolve(import.meta.dirname, '../.scaffold-out');
const scaffoldDir = (): string => {
    mkdirSync(scaffoldRoot, { recursive: true });
    const dir = mkdtempSync(join(scaffoldRoot, 'ds-'));
    tempDirs.push(dir);
    return dir;
};
afterAll(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

let templates: Templates;
beforeAll(async () => {
    const dir = tempDir();
    await collectTemplates(workspaceRoot, dir);
    templates = loadTemplates(dir);
});

const BRIEFS = ['brutalist', 'glass', 'corporate', 'terminal', 'riso', 'seeded', 'basic'] as const;

const EXPECTED_FILES = [
    'package.json', 'tsconfig.json', 'build.mjs', 'README.md', '.gitignore',
    'src/index.ts', 'src/design-system.ts', 'src/recipes.ts', 'src/tokens.ts',
];

describe('the templates collected from the workspace', () => {
    it('carry every brief plus the baseline, at the lockstep version', () => {
        expect(Object.keys(templates.briefs).sort()).toEqual([...BRIEFS].sort());
        expect(templates.baselineRecipes).toMatch(/^export const recipes: RecipeInput\[\] = \[/m);
        const kit = JSON.parse(readFileSync(resolve(workspaceRoot, 'packages/zero-kit/package.json'), 'utf8')) as { version: string };
        expect(templates.versions.version).toBe(kit.version);
        expect(templates.versions.sigxCli).toMatch(/^\^/);
    });
});

/**
 * The generated module as an import specifier. A `file://` URL rather than
 * the bare path: Node's `import()` rejects an absolute Windows path (`C:\…`
 * parses as a `c:` scheme), and the CI matrix runs the suite on Windows.
 */
const generated = (dir: string): string => pathToFileURL(join(dir, 'src', 'design-system.ts')).href;

/** One scaffold per brief, written on first use (templates arrive in `beforeAll`). */
const scaffolds = new Map<string, { dir: string; plan: ReturnType<typeof planScaffold> }>();
function scaffolded(brief: string): { dir: string; plan: ReturnType<typeof planScaffold> } {
    let entry = scaffolds.get(brief);
    if (!entry) {
        const dir = scaffoldDir();
        const plan = planScaffold({ name: `zero-${brief}-demo`, brief }, templates);
        writePlan(dir, plan);
        entry = { dir, plan };
        scaffolds.set(brief, entry);
    }
    return entry;
}

describe.each(BRIEFS)('scaffold --brief %s', (brief) => {
    it('writes exactly the planned file set', () => {
        const { dir, plan } = scaffolded(brief);
        const expected = [...EXPECTED_FILES, 'src/baseline.ts', ...(brief === 'basic' ? [] : ['src/button.ts'])];
        expect(plan.map((f) => f.path).sort()).toEqual(expected.sort());
        for (const file of expected) expect(existsSync(join(dir, file)), file).toBe(true);
    });

    it('stamps provenance on every copied file', () => {
        const { dir } = scaffolded(brief);
        const baseline = readFileSync(join(dir, 'src/baseline.ts'), 'utf8');
        expect(baseline.split('\n')[0]).toContain(`copied from @sigx/zero-basic src/recipes.ts by @sigx/create-zero-ds@${templates.versions.version}`);
        const tokens = readFileSync(join(dir, 'src/tokens.ts'), 'utf8');
        expect(tokens.split('\n')[0]).toContain(brief === 'basic' ? '@sigx/zero-basic src/tokens.ts' : `the "${brief}" brief`);
    });

    it('generates a design system that validates with no errors and no warnings', async () => {
        const { dir } = scaffolded(brief);
        const { designSystem } = await import(generated(dir)) as { designSystem: DesignSystemInput };
        expect(designSystem.name).toBe(`${brief}-demo`);
        const result = validateDesignSystem(designSystem, manifest);
        expect(result.errors.map((e) => `${e.where}: ${e.message}`)).toEqual([]);
        expect(result.warnings.map((w) => `${w.where}: ${w.message}`)).toEqual([]);
    });

    it('passes zero:audit with no error findings — the brief sits over a baseline that paints the whole ramp', async () => {
        // #422: the four default-shape briefs used to wire Button's size axis
        // as sm|md|lg while the baseline paints xs…xl on every sibling, so a
        // fresh scaffold exited 1 from `sigx zero:audit` (axis-value-coverage/gap).
        // Zero validation errors is not enough; the pack must clear the audit too.
        const { dir } = scaffolded(brief);
        const { designSystem } = await import(generated(dir)) as { designSystem: DesignSystemInput };
        const audit = auditDesignSystem(designSystem, manifest);
        const errors = audit.findings.filter((f) => f.severity === 'error');
        expect(errors.map((f) => `${f.rule} ${f.where}: ${f.message}`)).toEqual([]);
    });

    it('styles every component in the manifest', async () => {
        const { dir } = scaffolded(brief);
        const { designSystem } = await import(generated(dir)) as { designSystem: DesignSystemInput };
        const compiled = compileDesignSystem(designSystem, manifest);
        expect(Object.keys(compiled.componentCss).sort()).toEqual(manifest.components.map((c) => c.scope).sort());
    });

    // A full design system: compile, audit (the static contrast matrix over
    // every theme), report, write. Windows CI once crossed vitest's 5 s
    // default (#434); the 30 s budget is the honest cost, not a guess.
    it('builds the web artifacts through runStandardBuild', async () => {
        const { dir } = scaffolded(brief);
        const { designSystem } = await import(generated(dir)) as { designSystem: DesignSystemInput };
        const outDir = tempDir();
        await runStandardBuild({ designSystem, manifest, outDir, logger: silent });
        expect(existsSync(join(outDir, 'css', 'index.css'))).toBe(true);
        expect(existsSync(join(outDir, 'register.d.ts'))).toBe(true);
        expect(existsSync(join(outDir, 'manifest.json'))).toBe(true);
        expect(existsSync(join(outDir, 'lynx'))).toBe(false);
    }, 30_000);
});

describe("the brief's signature survives the composition", () => {
    it('riso: the overprint modifier and the fused variant reach the CSS, and no role token leaks', async () => {
        const dir = scaffoldDir();
        writePlan(dir, planScaffold({ name: '@acme/zero-riso', brief: 'riso' }, templates));
        const { designSystem } = await import(generated(dir)) as { designSystem: DesignSystemInput };
        const compiled = compileDesignSystem(designSystem, manifest);
        expect(compiled.componentCss.button).toContain('[data-mod-overprint]');
        expect(compiled.componentCss.button).toContain('[data-variant="key"]');
        const all = Object.values(compiled.componentCss).join('\n');
        expect(all).not.toMatch(/var\(--color-(?!base-|riso-)/);
    });

    it('brutalist: the tracked-out mono type and zero radius are what every component wears', async () => {
        const dir = scaffoldDir();
        writePlan(dir, planScaffold({ name: 'zero-brut', brief: 'brutalist' }, templates));
        const { designSystem } = await import(generated(dir)) as { designSystem: DesignSystemInput };
        const compiled = compileDesignSystem(designSystem, manifest);
        expect(compiled.tokensCss).toContain('--tracking-wide: 0.1em');
        expect(compiled.tokensCss).toContain('--radius-box: 0');
    });
});

describe('options', () => {
    it('--targets web,lynx writes the lynx exports and build line, and the build emits dist/lynx', async () => {
        const dir = scaffoldDir();
        const plan = planScaffold({ name: 'zero-glass-lynx', brief: 'glass', targets: ['web', 'lynx'] }, templates);
        writePlan(dir, plan);
        const pkg = JSON.parse(plan.find((f) => f.path === 'package.json')!.content) as { exports: Record<string, unknown> };
        expect(pkg.exports['./lynx/index.css']).toBe('./dist/lynx/index.css');
        expect(plan.find((f) => f.path === 'build.mjs')!.content).toContain("targets: ['web', 'lynx']");
        const { designSystem } = await import(generated(dir)) as { designSystem: DesignSystemInput };
        const outDir = tempDir();
        await runStandardBuild({ designSystem, manifest, outDir, targets: ['web', 'lynx'], logger: silent });
        expect(existsSync(join(outDir, 'lynx', 'index.css'))).toBe(true);
    }, 30_000);

    it('--baseline none scaffolds the Button alone, and only "have no recipe" remains', async () => {
        const dir = scaffoldDir();
        const plan = planScaffold({ name: 'zero-terminal-min', brief: 'terminal', baseline: 'none' }, templates);
        writePlan(dir, plan);
        expect(plan.map((f) => f.path)).not.toContain('src/baseline.ts');
        const { designSystem } = await import(generated(dir)) as { designSystem: DesignSystemInput };
        // Button alone OF THE AUTHORED recipes. The layout tier rides along
        // whatever the baseline choice, because it is generated from the
        // tokens rather than copied — `--baseline none` means "none of
        // zero-basic's fifty", not "no Stack".
        // Derived from LAYOUT_SCOPES rather than listed, so the layout tier
        // can grow without a hand bump here.
        expect(designSystem.recipes.map((r) => r.component).sort())
            .toEqual(['button', ...LAYOUT_SCOPES].sort());
        const result = validateDesignSystem(designSystem, manifest);
        expect(result.errors).toEqual([]);
        expect(result.warnings.filter((w) => !w.message.includes('have no recipe'))).toEqual([]);
    });

    it('--baseline none with the basic brief is refused — there would be no recipe at all', () => {
        expect(() => planScaffold({ name: 'zero-x', brief: 'basic', baseline: 'none' }, templates))
            .toThrow(/carries no Button recipe/);
    });

    it('an unknown brief names the available ones', () => {
        expect(() => planScaffold({ name: 'zero-x', brief: 'bauhaus' }, templates)).toThrow(/available: .*riso/);
    });

    it('refuses a non-empty directory unless forced', () => {
        const dir = tempDir();
        const plan = planScaffold({ name: 'zero-x', brief: 'glass' }, templates);
        writePlan(dir, plan);
        expect(() => writePlan(dir, plan)).toThrow(/not empty/);
        expect(() => writePlan(dir, plan, { force: true })).not.toThrow();
    });
});

describe('designSystemName', () => {
    it('is the last segment minus a leading zero-', () => {
        expect(designSystemName('zero-acme')).toBe('acme');
        expect(designSystemName('@acme/zero-acme')).toBe('acme');
        expect(designSystemName('@acme/monograph')).toBe('monograph');
        expect(designSystemName('zero-riso-2')).toBe('riso-2');
    });
    it('rejects what cannot be a manifest name', () => {
        expect(() => designSystemName('Zero-Acme')).toThrow(/kebab-case/);
        expect(() => designSystemName('zero-')).toThrow(/kebab-case/);
        expect(() => designSystemName('zero_acme')).toThrow(/kebab-case/);
    });
});
