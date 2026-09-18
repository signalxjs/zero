/**
 * The components artifact — a generated `./components` module giving a design
 * system's consumers zero's components under the vendor's own prop names
 * (issue #179; docs/architecture.md, "The components artifact —
 * vendor-named apis").
 *
 * Two halves, one derivation:
 *
 * - `components.d.ts` — SELF-CONTAINED types. No `declare module`, no
 *   `ZeroVocabulary` augmentation: every export is typed by re-parameterizing
 *   zero's real factory types (`Adapted<typeof ZButton, …>`) with inline
 *   literal unions, so importing the module has no global type side effects,
 *   needs no `/register`, and two design systems' `./components` can coexist.
 * - `components.js` — DATA ONLY. One PURE-annotated `adapt(Base, {…})` call
 *   per component that routes anything; a plain re-export when nothing does.
 *   All behaviour lives in `@sigx/zero/adapt`, written once and never
 *   generated — the same line `/register` draws for types.
 *
 * Web-target by construction: the emitted specifiers (`@sigx/zero/<scope>`,
 * `@sigx/zero/adapt`) are foundation-specific, so this lives beside
 * `register-dts.ts` rather than in the target-neutral core. Everything is
 * harvested from the COMPILED design system, so the types cannot drift from
 * the stylesheet backing them; every interpolated value has passed either the
 * axis-value grammar (`AXIS_VALUE_PATTERN`) or the api validator's
 * vendor-spelling grammar, so plain single-quoting is safe.
 */
import type { CompiledComponentApi } from '../../api.js';
import type { CompiledComponentAxes, CompiledDesignSystem } from '../../design-system.js';
import { externalPackage } from '../../design-system.js';

const union = (values: readonly string[]): string => {
    // Defense in depth behind the validator's empty-axis rule: an empty
    // union prints as nothing, and `'axis'?: ;` is a syntax error inside a
    // generated .d.ts — exactly where skipLibCheck would hide it.
    if (values.length === 0) {
        throw new Error('components.d.ts: refusing to emit an empty union — an axis with no wired values reached the emitter');
    }
    return values.map((v) => `'${v}'`).join(' | ');
};

/** `'radio-group'` → `RadioGroup` — the export-binding convention of `@sigx/zero/<scope>`. */
export function componentExportName(scope: string): string {
    return scope.split('-').map((part) => part[0]!.toUpperCase() + part.slice(1)).join('');
}

/** The vendor spelling of one wired zero value — authoring direction, rebuilt from the inverted route. */
function respeller(route: { values?: Record<string, string> }): (zero: string) => string {
    const byZero = new Map(Object.entries(route.values ?? {}).map(([vendor, zero]) => [zero, vendor]));
    return (zero) => byZero.get(zero) ?? zero;
}

interface Surface {
    /** The emitted prop lines, in order: named axes, custom axes bag, mods bag. */
    lines: string[];
    /** `prop ← zero-surface` fragments for the summary doc comment. */
    summary: string[];
}

/**
 * One component's vendor prop surface. The five contract props are always
 * removed by `Adapted`; what this rebuilds is the wired subset — routed
 * surfaces under their vendor names (respelled), unrouted wired surfaces
 * under zero's own names. Unwired axes are simply ABSENT: on a self-contained
 * surface, omission is the `never` of the register artifact — excess-property
 * checking rejects the prop with a better error than a `never` type would.
 */
function vendorSurface(axes: CompiledComponentAxes, api: CompiledComponentApi): Surface {
    const lines: string[] = [];
    const summary: string[] = [];

    const axisRoutes = new Map<string, { vendorProp: string; values?: Record<string, string> }>();
    const modRoutes: Array<{ vendorProp: string; modifier: string }> = [];
    for (const [vendorProp, route] of Object.entries(api.props)) {
        if ('modifier' in route) modRoutes.push({ vendorProp, modifier: route.modifier });
        else axisRoutes.set(route.axis, { vendorProp, values: route.values });
    }

    for (const axis of ['color', 'size', 'variant'] as const) {
        const wired = axes[axis];
        if (wired.length === 0) continue;
        const route = axisRoutes.get(axis);
        if (route) {
            const respell = respeller(route);
            const respelled = Object.keys(route.values ?? {}).length;
            summary.push(`${route.vendorProp} ← ${axis}${respelled > 0 ? ` (${respelled} respelled)` : ''}`);
            lines.push(`    '${route.vendorProp}'?: ${union(wired.map(respell))};`);
        } else {
            lines.push(`    ${axis}?: ${union(wired)};`);
        }
    }

    const bagEntries: string[] = [];
    for (const [axis, wired] of Object.entries(axes.axes)) {
        const route = axisRoutes.get(axis);
        if (route) {
            const respell = respeller(route);
            summary.push(`${route.vendorProp} ← axes.${axis}`);
            lines.push(`    '${route.vendorProp}'?: ${union(wired.map(respell))};`);
        } else {
            bagEntries.push(`'${axis}'?: ${union(wired)}`);
        }
    }
    if (bagEntries.length > 0) lines.push(`    axes?: { ${bagEntries.join('; ')} };`);

    const routedMods = new Map(modRoutes.map((r) => [r.modifier, r.vendorProp]));
    const bagMods = [...axes.mods].sort().filter((m) => !routedMods.has(m));
    for (const { vendorProp, modifier } of [...modRoutes].sort((a, b) => a.vendorProp.localeCompare(b.vendorProp))) {
        summary.push(`${vendorProp} ← mods.${modifier}`);
        lines.push(`    '${vendorProp}'?: boolean;`);
    }
    if (bagMods.length > 0) lines.push(`    mods?: { ${bagMods.map((m) => `'${m}'?: boolean`).join('; ')} };`);

    return { lines, summary };
}

/** Whether a route changes anything at runtime — an unrenamed, unrespelled axis doesn't. */
function isTrivial(vendorProp: string, route: CompiledComponentApi['props'][string]): boolean {
    // A modifier route is NEVER trivial: the vendor surface is a flat boolean
    // prop, zero's is the `mods` bag — the shape always changes.
    return 'axis' in route && !route.values && vendorProp === route.axis;
}

function needsAdapt(api: CompiledComponentApi): boolean {
    return Object.entries(api.props).some(([prop, route]) => !isTrivial(prop, route));
}

/**
 * The emitters only make sense for a design system that declared an `api` —
 * `writeArtifacts` gates on the same field. Failing fast here turns a
 * mis-wired direct call into a named error instead of a cryptic undefined
 * read partway through emission.
 */
function componentApiOf(compiled: CompiledDesignSystem): Record<string, CompiledComponentApi> {
    if (!compiled.componentApi) {
        throw new Error(
            `[zero-kit] design system "${compiled.name}" declares no \`api\` — there is no ./components artifact to emit`,
        );
    }
    return compiled.componentApi;
}

/**
 * Where a scope's component is imported from. Zero's own components live on
 * subpath exports; an ecosystem scope's live at the root of the package its
 * manifest fragment named — the fragment convention is that the package's
 * root export carries `componentExportName(scope)`.
 */
function moduleSpecifierFor(compiled: CompiledDesignSystem, scope: string): string {
    return externalPackage(compiled, scope) ?? `@sigx/zero/${scope}`;
}

export function compileComponentsDts(compiled: CompiledDesignSystem): string {
    const componentApi = componentApiOf(compiled);
    const scopes = Object.keys(compiled.components);

    const imports = scopes.map((scope) => {
        const name = componentExportName(scope);
        return `import type { ${name} as Z${name} } from '${moduleSpecifierFor(compiled, scope)}';`;
    });

    const blocks = scopes.map((scope) => {
        const axes = compiled.components[scope]!;
        const api = componentApi[scope]!;
        const name = componentExportName(scope);
        const { lines, summary } = vendorSurface(axes, api);
        const removed = ['ZeroAxisProp', ...Object.keys(api.props).map((p) => `'${p}'`)].join(' | ');
        const doc = summary.length > 0
            ? `/** ${scope} — ${summary.join('; ')}. Attributes stay zero-spelled. */`
            : `/** ${scope} — no vendor route; the wired surface keeps zero's names. */`;
        const propsType = lines.length > 0 ? `{\n${lines.join('\n')}\n}` : 'Record<never, never>';
        const statics = api.singlePart
            ? `{ Root: ${name}Adapted }`
            : `AdaptedStatics<typeof Z${name}> & { Root: ${name}Adapted }`;
        return [
            doc,
            `type ${name}Props = ${propsType};`,
            `type ${name}Adapted = Adapted<typeof Z${name}, ${removed}, ${name}Props>;`,
            `export declare const ${name}: ${name}Adapted & ${statics};`,
        ].join('\n');
    });

    return [
        `// ${compiled.name} — generated by @sigx/zero-kit. Do not edit.`,
        '//',
        "// Vendor-named component API (issue #179): zero's components under this",
        "// design system's prop names, narrowed to what its recipes wire.",
        '// Self-contained — nothing here augments ZeroVocabulary, no /register',
        '// import is needed or consulted. The rendered attributes are unchanged:',
        '// a routed vendor value renders the zero-spelled data-* attribute.',
        "import type { Adapted, AdaptedStatics } from '@sigx/zero/adapt';",
        ...imports,
        '',
        "type ZeroAxisProp = 'color' | 'size' | 'variant' | 'axes' | 'mods';",
        '',
        ...blocks.flatMap((block) => [block, '']),
    ].join('\n');
}

export function compileComponentsJs(compiled: CompiledDesignSystem): string {
    const componentApi = componentApiOf(compiled);
    const scopes = Object.keys(compiled.components);
    const adapted = scopes.filter((scope) => needsAdapt(componentApi[scope]!));
    const reexported = scopes.filter((scope) => !needsAdapt(componentApi[scope]!));

    const serializeRoute = (route: CompiledComponentApi['props'][string]): string => {
        if ('modifier' in route) return `{ modifier: '${route.modifier}' }`;
        const values = route.values
            ? `, values: { ${Object.entries(route.values).map(([vendor, zero]) => `'${vendor}': '${zero}'`).join(', ')} }`
            : '';
        return `{ axis: '${route.axis}'${values} }`;
    };

    const calls = adapted.map((scope) => {
        const name = componentExportName(scope);
        const api = componentApi[scope]!;
        const props = Object.entries(api.props)
            .map(([prop, route]) => `        '${prop}': ${serializeRoute(route)},`)
            .join('\n');
        return [
            `export const ${name} = /* @__PURE__ */ adapt(Z${name}, {`,
            '    props: {',
            props,
            '    },',
            '});',
        ].join('\n');
    });

    return [
        `// ${compiled.name} — generated by @sigx/zero-kit. Do not edit.`,
        '// Data only: one adapt() call per component that routes anything, a',
        '// re-export when nothing does. The behaviour lives in @sigx/zero/adapt,',
        '// written once and never generated (issue #179).',
        ...(adapted.length > 0 ? ["import { adapt } from '@sigx/zero/adapt';"] : []),
        ...adapted.map((scope) => {
            const name = componentExportName(scope);
            return `import { ${name} as Z${name} } from '${moduleSpecifierFor(compiled, scope)}';`;
        }),
        '',
        ...calls.flatMap((call) => [call, '']),
        ...reexported.map((scope) => `export { ${componentExportName(scope)} } from '${moduleSpecifierFor(compiled, scope)}';`),
        '',
    ].join('\n');
}
