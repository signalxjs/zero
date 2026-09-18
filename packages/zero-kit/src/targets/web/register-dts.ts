/**
 * The register artifact — a generated `.d.ts` that augments `@sigx/zero`'s
 * empty `ZeroVocabulary` with the vocabulary this design system's compiled
 * CSS actually answers to (see docs/architecture.md, "The register
 * artifact").
 *
 * Web-target by construction: the augmented specifier (`@sigx/zero`) is
 * foundation-specific, so this lives beside `tokens-css.ts` and
 * `recipe-css.ts` rather than in the target-neutral core.
 *
 * Everything emitted is harvested from the COMPILED design system — the
 * `properties` list is read back off the emitted CSS, per-component axes come
 * from `CompiledDesignSystem.components` — so the types cannot drift from the
 * stylesheet backing them. Every value interpolated into a literal union has
 * already passed the validator's axis-value grammar (`AXIS_VALUE_PATTERN`:
 * lowercase, digits, hyphens — no quotes, backslashes or whitespace), so
 * plain single-quoting is safe.
 */
import { TOKEN_CATEGORIES, systemNodeAt } from '../../contract.js';
import type { CompiledComponentAxes, CompiledDesignSystem } from '../../design-system.js';
// The "declared out of existence" predicate is shared with the coverage report,
// so the two artifacts name the same axes by construction (see
// docs/architecture.md, "Harvest").
import { offeredFor, undeclaredAxes, externalPackage } from '../../design-system.js';

const union = (values: readonly string[]): string =>
    values.length === 0 ? 'never' : values.map((v) => `'${v}'`).join(' | ');

/** The per-category token unions: recommended keys ∪ declared system/systemDark keys. */
function tokenUnions(compiled: CompiledDesignSystem): Array<[string, string]> {
    const tiers = [compiled.tokens.system, compiled.tokens.systemDark];
    const entries: Array<[string, string]> = [];
    for (const category of TOKEN_CATEGORIES) {
        if (category.shape === 'scalar') continue; // keyless — nothing to union
        const keys = new Set<string>(category.recommended);
        for (const tier of tiers) {
            const node = systemNodeAt(tier, category.path);
            if (typeof node !== 'object' || node === null) continue;
            for (const key of Object.keys(node)) keys.add(key);
        }
        entries.push([category.id, union([...keys])]);
    }
    return entries;
}

function componentEntry(
    scope: string,
    axes: CompiledComponentAxes,
    dsName: string,
    undeclared: ReadonlySet<string>,
): string {
    const named = (['color', 'size', 'variant'] as const).filter((a) => axes[a].length > 0);
    const custom = Object.keys(axes.axes);
    const mods = [...axes.mods].sort();
    const wired = [...named, ...custom.map((a) => `axes.${a}`), ...mods.map((m) => `mods.${m}`)];
    const summary = wired.length > 0
        ? `${scope} — ${wired.join(', ')} wired.`
        : `${scope} — no axis wired by ${dsName}; every axis errors under this register module.`;

    const axisLine = (axis: 'color' | 'size' | 'variant'): string => {
        const values = axes[axis];
        if (values.length > 0) return `                ${axis}: ${union(values)};`;
        const why = undeclared.has(axis)
            ? (offeredFor(axes, axis)?.length === 0
                ? `${dsName} declares no ${axis} axis for ${scope}`
                : `${dsName} declares no ${axis} axis at all`)
            : `no ${dsName} recipe wires it`;
        return [
            `                /** Accepts \`${axis}\` at runtime, but ${why} — the attribute would match nothing. */`,
            `                ${axis}: never;`,
        ].join('\n');
    };
    // Empty axes MUST be Record<string, never>, not {} — `{}` is the top
    // object type and would silently permit any bag (docs/architecture.md,
    // "The register artifact"). Axis keys
    // are quoted for the same reason scope keys are: they are kebab-case.
    const axesLine = custom.length > 0
        ? `                axes: { ${custom.map((a) => `'${a}': ${union(axes.axes[a]!)}`).join('; ')} };`
        : '                axes: Record<string, never>;';
    // Modifiers are presence-only, so the value type is `boolean` and there is
    // no vocabulary to union — the NAMES are the vocabulary. `Record<string,
    // never>` for the empty case, same `{}`-is-the-top-type trap as `axes`.
    const modsLine = mods.length > 0
        ? `                mods: { ${mods.map((m) => `'${m}': boolean`).join('; ')} };`
        : '                mods: Record<string, never>;';

    return [
        `            /** ${summary} */`,
        // Quoted: scope names are kebab-case ('radio-group'), which is not a
        // valid bare property name — a syntax error the compile gate caught.
        `            '${scope}': {`,
        axisLine('color'),
        axisLine('size'),
        axisLine('variant'),
        axesLine,
        modsLine,
        '            };',
    ].join('\n');
}

/**
 * The compile gate: every scope this module augments must be in zero's
 * anatomy registry, or the module fails to typecheck — a typo or a version
 * skew would otherwise silently take the open fallback (see
 * docs/architecture.md, "The register artifact").
 *
 * Ecosystem scopes merged from a manifest fragment are excluded BY NAME
 * rather than the gate being dropped: `ZeroScope` stays closed (their anatomy
 * lives outside zero's registry, so it can never satisfy the union), the
 * guard keeps its full strength for every zero-origin scope, and the emitted
 * lines double as the record of which scopes are foreign and who owns them.
 */
function scopesValid(compiled: CompiledDesignSystem): string[] {
    const external = Object.keys(compiled.components)
        .filter((scope) => externalPackage(compiled, scope) !== undefined)
        .sort();
    const scopesExpr = external.length > 0
        ? `Exclude<keyof import('@sigx/zero').ZeroVocabulary['components'], ${union(external)}>`
        : "keyof import('@sigx/zero').ZeroVocabulary['components']";
    return [
        '// Fails to compile if a scope above is not in zero\'s anatomy registry',
        '// (a typo or a version skew would otherwise silently take the open',
        '// fallback — docs/architecture.md, "The register artifact").',
        ...(external.length > 0 ? [
            '// Ecosystem scopes are excluded from the gate by name — their anatomy',
            '// was merged from a manifest fragment, not zero\'s registry:',
            ...external.map((scope) => `//   ${scope} — ${externalPackage(compiled, scope)!}`),
        ] : []),
        'type _MustBeTrue<T extends true> = T;',
        'type _ScopesValid = _MustBeTrue<',
        `    ${scopesExpr} extends import('@sigx/zero').ZeroScope`,
        '        ? true : false',
        '>;',
        '// Fails to compile if any entry above drops one of the five members.',
        '// A dropped key is not a smaller entry: the vocabulary resolvers fall',
        '// back to the OPEN union for a member they cannot find, so a truncated',
        '// entry silently un-narrows the axis it omitted (#316).',
        'type _EntryShape = {',
        '    color: string; size: string; variant: string;',
        '    axes: Record<string, string>; mods: Record<string, boolean>;',
        '};',
        "type _Entries = import('@sigx/zero').ZeroVocabulary['components'];",
        'type _EntriesValid = _MustBeTrue<',
        '    { [K in keyof _Entries]: _Entries[K] extends _EntryShape ? true : false }[keyof _Entries] extends true',
        '        ? true : false',
        '>;',
    ];
}

export function compileRegisterDts(compiled: CompiledDesignSystem): string {
    const themes = compiled.themes.map((t) => t.name);
    const breakpoints = Object.keys(compiled.tokens.breakpoints);
    const scopes = Object.keys(compiled.components);

    return [
        `// ${compiled.name} — generated by @sigx/zero-kit. Do not edit.`,
        '//',
        "// Augments @sigx/zero's ZeroVocabulary with this design system's compiled",
        "// vocabulary. Opt in with:  import '@sigx/<ds>/register';",
        "declare module '@sigx/zero' {",
        '    interface ZeroVocabulary {',
        `        theme: ${union(themes)};`,
        `        breakpoint: ${union(breakpoints)};`,
        `        property: ${union(compiled.tokens.properties)};`,
        '        tokens: {',
        ...tokenUnions(compiled).map(([id, u]) => `            ${id}: ${u};`),
        '        };',
        '        components: {',
        // `undeclaredAxes` is asked PER SCOPE, so a scope that declared an axis
        // out of existence for itself gets that reason rather than the weaker
        // "no recipe wires it" (#294). Both readers of the predicate pass the
        // scope, which is what keeps this artifact and the report in step.
        ...scopes.map((scope) => componentEntry(
            scope,
            compiled.components[scope]!,
            compiled.name,
            undeclaredAxes(compiled, scope),
        )),
        '        };',
        '    }',
        '}',
        '',
        ...scopesValid(compiled),
        'export {};',
        '',
    ].join('\n');
}

/** The runtime half of the `/register` subpath — resolvable, empty, side-effect-free. */
export function compileRegisterJs(compiled: CompiledDesignSystem): string {
    return [
        `// ${compiled.name} — generated by @sigx/zero-kit. Do not edit.`,
        '// The /register module is types-only; this file exists so the specifier',
        '// resolves at runtime. Nothing may ever hang behaviour off it.',
        'export {};',
        '',
    ].join('\n');
}
