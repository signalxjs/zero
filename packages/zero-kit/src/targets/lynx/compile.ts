/**
 * Lynx design-system compile + artifacts: the lynx counterpart of
 * `compileDesignSystem` + `writeArtifacts`, emitted BESIDE the web artifacts
 * under `dist/lynx/`:
 *
 * ```
 * dist/lynx/tokens.css              (.zx-root + per-theme class blocks, literals)
 * dist/lynx/components/<scope>.css  (class-grammar recipes)
 * dist/lynx/index.css               (tokens + all components, one stylesheet)
 * dist/lynx/manifest.json           (the DS manifest + lynx envelope: target,
 *                                    classGrammarVersion, capability summary)
 * ```
 *
 * The manifest reuses the web compile's themes/tokens/components — one
 * design system, one truth about its vocabulary; only the delivery differs.
 * The capability report also lands in the web `report.json` under `lynx`
 * (wired by `runStandardBuild`), so one file still answers "what did this
 * design system ship".
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv/dist/2020.js';
import type { ZeroManifest } from '../../contract.js';
import { TOKEN_KEY_PATTERN } from '../../contract.js';
import type { CompiledDesignSystem, DesignSystemInput } from '../../design-system.js';
import { resolveRecipeForTarget } from '../../recipes.js';
import type { DesignSystemManifest } from '../../artifacts.js';
import type { LynxCapabilityReport } from './capabilities.js';
import { emptyReport } from './capabilities.js';
import { CLASS_GRAMMAR_VERSION } from './class-names.js';
import { compileLynxRecipeCss } from './recipe-css.js';
import { compileLynxTokensCss, lynxThemeColors } from './tokens-css.js';

export interface CompiledLynxTarget {
    tokensCss: string;
    componentCss: Record<string, string>;
    indexCss: string;
    report: LynxCapabilityReport;
}

/** The lynx manifest: the DS manifest's content plus the lynx envelope. */
export interface LynxTargetManifest extends Omit<DesignSystemManifest, '$schema'> {
    $schema: string;
    target: 'lynx';
    classGrammarVersion: number;
    /** Counts only — the findings themselves live in report.json under `lynx`. */
    capabilities: { translated: number; dropped: number };
}

/** Compile the lynx target for one design system. */
export function compileDesignSystemLynx(
    ds: DesignSystemInput,
    manifest: Pick<ZeroManifest, 'components'>,
): CompiledLynxTarget {
    const report = emptyReport();
    const tokensCss = compileLynxTokensCss(ds.tokens, report);
    // The recipe emitter restates theme-dependent declarations once per
    // theme; these are the literal color maps it bakes them against.
    const themes = lynxThemeColors(ds.tokens);

    const byScope = new Map(manifest.components.map((c) => [c.scope, c]));
    const componentCss: Record<string, string> = {};
    for (const recipe of ds.recipes) {
        const component = byScope.get(recipe.component);
        if (!component) {
            const known = [...byScope.keys()].join(', ');
            throw new Error(
                `[zero-kit] design system "${ds.name}" has a recipe for unknown component "${recipe.component}" (known: ${known})`,
            );
        }
        // The lynx view: shared sections + targets.lynx merged. A shared raw
        // `css` block is web spelling by definition — the resolver already
        // withholds it from this view; record the drop so the report says so.
        if (recipe.css?.trim()) {
            report.dropped.push({
                where: `lynx recipe for "${recipe.component}"`,
                scope: recipe.component,
                what: 'css (raw stylesheet escape hatch)',
                detail: 'shared raw CSS is web spelling and is not emitted on this target — move it into targets.web (or author a lynx counterpart in targets.lynx.css)',
            });
        }
        // Tagged here rather than threaded through a dozen push sites: the
        // scope is only known at this level, and everything the emitter adds
        // while compiling this recipe belongs to this recipe.
        const before = { translated: report.translated.length, dropped: report.dropped.length };
        const css = compileLynxRecipeCss(resolveRecipeForTarget(recipe, 'lynx'), component, report, themes);
        // By index: `slice` would allocate a copy per recipe, and the work
        // should be proportional to the findings added, not to the report.
        for (let i = before.translated; i < report.translated.length; i++) {
            report.translated[i]!.scope = recipe.component;
        }
        for (let i = before.dropped; i < report.dropped.length; i++) {
            report.dropped[i]!.scope = recipe.component;
        }
        if (css) componentCss[recipe.component] = css;
    }

    // `ds.css` (the raw web escape hatch) is deliberately NOT appended — it is
    // web spelling by definition and drops with one report entry.
    if ((ds.css ?? []).some((c) => c.trim())) {
        report.dropped.push({
            where: `lynx design system "${ds.name}"`,
            what: 'css (raw stylesheet escape hatch)',
            detail: 'raw web CSS is not emitted on this target',
        });
    }

    const indexCss = [
        `/* ${ds.name} — lynx target, generated by @sigx/zero-kit. Do not edit. */`,
        tokensCss,
        ...Object.values(componentCss),
    ].join('\n');

    assertNoDanglingVars(ds.name, indexCss);
    assertNoCalcVarChains(ds.name, indexCss);

    return { tokensCss, componentCss, indexCss, report };
}

/** `--x` in a definition position: `--x: …`. */
const CUSTOM_PROP_DEFINITION = /(--[A-Za-z0-9_-]+)\s*:/g;
/** `--x` read through `var(--x)`, fallback ignored. */
const CUSTOM_PROP_REFERENCE = /var\(\s*(--[A-Za-z0-9_-]+)/g;

const names = (css: string, pattern: RegExp): Set<string> =>
    new Set([...css.matchAll(pattern)].map((m) => m[1]!));

/**
 * Rewrite every `var(--x, <fallback>)` to just `<fallback>`, innermost first.
 *
 * A fallback makes its OWN reference self-sufficient — `var(--maybe, 8px)`
 * paints without `--maybe` — but it does not excuse whatever the fallback
 * itself reads: `var(--x, var(--y))` still needs `--y`. Replacing the whole
 * expression with a placeholder would hide exactly that, so the fallback text
 * is kept and re-scanned. Parentheses are matched by depth because a fallback
 * may hold nested calls (`var(--x, color-mix(in oklab, var(--y), white))`).
 */
function dropFallbackHeads(css: string): string {
    let out = css;
    // Each pass rewrites at most one `var(…, …)`, so the total is bounded by
    // how many the stylesheet holds — no unbounded loop even on odd input.
    const bound = (css.match(/var\(/g) ?? []).length + 1;
    for (let pass = 0; pass < bound; pass++) {
        let rewrote = false;
        for (let i = out.indexOf('var('); i !== -1; i = out.indexOf('var(', i + 4)) {
            let depth = 0;
            let comma = -1;
            let end = -1;
            for (let j = i + 3; j < out.length; j++) {
                if (out[j] === '(') depth++;
                else if (out[j] === ')') {
                    if (--depth === 0) { end = j; break; }
                } else if (out[j] === ',' && depth === 1 && comma === -1) comma = j;
            }
            if (end === -1 || comma === -1) continue;
            out = out.slice(0, i) + out.slice(comma + 1, end).trim() + out.slice(end + 1);
            rewrote = true;
            break;
        }
        if (!rewrote) break;
    }
    return out;
}

/**
 * Refuse to ship a stylesheet that reads a custom property nothing in it
 * defines.
 *
 * This is a lynx-specific hazard with a web-shaped cause. On the web an
 * unresolvable `var()` is survivable — the declaration is invalid at
 * computed-value time and the cascade falls back to something. On lynx it
 * simply does not paint: the element renders with no background, no size, no
 * ink, and nothing anywhere says so. Combined with an emitter that may DROP a
 * declaration defining a property while KEEPING every declaration that reads
 * it, that turns one dropped line into a component that silently disappears
 * (signalxjs/lynx#1029: 24 undefined properties reached 295 of 1043 rules,
 * and the daisy switch shipped with no width, no radius and no ink).
 *
 * Checked against the whole design system at once — `index.css` is tokens
 * plus every component — because a component legitimately reads properties
 * the token layer defines. A property an APP is expected to supply must
 * therefore carry a `var(--x, <fallback>)`, which is also what makes the
 * expectation visible in the CSS.
 */
export function assertNoDanglingVars(dsName: string, indexCss: string): void {
    const defined = names(indexCss, CUSTOM_PROP_DEFINITION);
    const dangling = [...names(dropFallbackHeads(indexCss), CUSTOM_PROP_REFERENCE)]
        .filter((name) => !defined.has(name))
        .sort();
    if (dangling.length === 0) return;
    throw new Error(
        `[zero-kit] the lynx stylesheet for "${dsName}" reads ${dangling.length} custom `
        + `${dangling.length === 1 ? 'property' : 'properties'} that nothing defines: ${dangling.join(', ')}. `
        + 'On lynx an unresolvable var() does not fall back — the declaration is dropped and the element paints '
        + 'nothing at all, so this would ship as invisible components rather than as degraded styling. '
        + 'Either define them (a lynx recipe target section, or the tokens source), or give each reference a '
        + 'var(--x, <fallback>) so the stylesheet stands on its own.',
    );
}

/** `--x: value` in a definition position, value captured up to the `;`. */
const CUSTOM_PROP_DEFINITION_VALUE = /(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]*)/g;

/**
 * Refuse to ship a stylesheet where any `var(--x)` consumption can resolve to
 * a value that holds `calc()`.
 *
 * Measured on device (signalxjs/lynx#1075, iOS 18.3): lynx drops a
 * declaration consuming `var(--x)` — bare, with a fallback, or nested inside
 * a `calc()` — whenever `--x`'s value contains `calc()`. Direct `calc(var())`
 * works and plain var→var chains work; only the indirection through a
 * calc-holding property fails, silently, with the element laid out as though
 * the declaration were never written.
 *
 * The recipe emitter already inlines (or refuses) such chains within each
 * scope (`inlineCalcChains`); what reaches this whole-stylesheet check is the
 * cross-scope remainder the per-recipe pass cannot see — a calc-holding TOKEN
 * definition consumed by a recipe, or a chain minted in raw lynx css. Like
 * `assertNoDanglingVars`, failing the build that produces the stylesheet
 * beats shipping components that silently do not render.
 */
export function assertNoCalcVarChains(dsName: string, indexCss: string): void {
    const calcHolding = new Set<string>();
    for (const match of indexCss.matchAll(CUSTOM_PROP_DEFINITION_VALUE)) {
        if (/calc\(/i.test(match[2]!)) calcHolding.add(match[1]!);
    }
    if (calcHolding.size === 0) return;
    const chained = [...names(indexCss, CUSTOM_PROP_REFERENCE)]
        .filter((name) => calcHolding.has(name))
        .sort();
    if (chained.length === 0) return;
    throw new Error(
        `[zero-kit] the lynx stylesheet for "${dsName}" consumes ${chained.length} custom `
        + `${chained.length === 1 ? 'property' : 'properties'} whose ${chained.length === 1 ? 'definition holds' : 'definitions hold'} `
        + `calc(): ${chained.join(', ')}. On lynx a declaration consuming var(--x) is dropped whenever --x's value `
        + 'contains calc() (measured, signalxjs/lynx#1075) — the consumers would silently never apply. The recipe '
        + 'emitter inlines such chains within a scope; a chain surviving to the final stylesheet is defined outside '
        + 'the consuming scope (a token, or raw lynx css). Restate the definition as a plain value, or inline the '
        + 'calc() at the consumer.',
    );
}

const LYNX_MANIFEST_SCHEMA_URL = 'https://signalxjs.github.io/zero/schemas/lynx-manifest.schema.json';

const require = createRequire(import.meta.url);

/**
 * The schema, loaded from wherever this module runs — same two-location
 * resolution as the DS manifest validator in `artifacts.ts` (`dist/schemas/`
 * in the published package, `../schemas/` from source under test aliases).
 */
let validateLynxManifest: ValidateFunction | null = null;
function lynxManifestValidator(): ValidateFunction {
    if (validateLynxManifest) return validateLynxManifest;
    let path: string;
    try {
        path = require.resolve('../../schemas/lynx-manifest.schema.json');
    } catch {
        path = require.resolve('../../../schemas/lynx-manifest.schema.json');
    }
    const raw = readFileSync(path, 'utf8');
    const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
    return (validateLynxManifest = ajv.compile(JSON.parse(raw) as Record<string, unknown>));
}

/**
 * Write the lynx artifacts under `<outDir>/lynx/`. The manifest content
 * comes from the WEB compile (`compiled`) — same themes, tokens and wired
 * axes; the envelope says how this copy is delivered.
 */
export async function writeLynxArtifacts(
    compiled: CompiledDesignSystem,
    lynx: CompiledLynxTarget,
    manifest: DesignSystemManifest,
    outDir: string,
): Promise<string[]> {
    const lynxDir = join(outDir, 'lynx');
    const componentsDir = join(lynxDir, 'components');
    await mkdir(componentsDir, { recursive: true });

    const written: string[] = [];
    const write = async (path: string, content: string) => {
        await writeFile(path, content.endsWith('\n') ? content : content + '\n');
        written.push(path);
    };

    await write(join(lynxDir, 'tokens.css'), lynx.tokensCss);
    for (const [scope, css] of Object.entries(lynx.componentCss)) {
        // Same backstop as the web artifacts: the scope IS the filename.
        if (!TOKEN_KEY_PATTERN.test(scope)) {
            throw new Error(
                `[zero-kit] compiled scope "${scope}" is not a kebab-case identifier — it becomes the lynx/components/<scope>.css filename, so anything else could escape the output directory`,
            );
        }
        await write(join(componentsDir, `${scope}.css`), css);
    }
    await write(join(lynxDir, 'index.css'), lynx.indexCss);

    const lynxManifest: LynxTargetManifest = {
        ...manifest,
        $schema: LYNX_MANIFEST_SCHEMA_URL,
        target: 'lynx',
        classGrammarVersion: CLASS_GRAMMAR_VERSION,
        capabilities: {
            translated: lynx.report.translated.length,
            dropped: lynx.report.dropped.length,
        },
    };
    // Self-validation, exactly like the DS manifest: a manifest the schema
    // rejects fails the build that PRODUCES it, not the app that reads it.
    // JSON-roundtripped so the thing validated is byte-for-byte the thing
    // written.
    const emitted: unknown = JSON.parse(JSON.stringify(lynxManifest));
    const validate = lynxManifestValidator();
    if (!validate(emitted)) {
        const details = validate.errors
            ?.map((e) => `  ${e.instancePath || '(root)'} ${e.message ?? ''}`)
            .join('\n');
        throw new Error(
            `[zero-kit] the lynx manifest for "${compiled.name}" does not validate against `
            + `lynx-manifest.schema.json — refusing to write it:\n${details}`,
        );
    }
    await write(join(lynxDir, 'manifest.json'), JSON.stringify(emitted, null, 2));
    return written;
}
