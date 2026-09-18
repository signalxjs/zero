/**
 * The vendor-named component API declaration (issue #179; docs/architecture.md,
 * "The components artifact — vendor-named apis").
 *
 * A design system may declare, beside its tokens and recipes, how zero's axis
 * surfaces appear under the vendor's own prop names — Carbon's `kind`, Ant's
 * `type`, HeroUI's `isIconOnly`. The declaration is data: the kit validates it
 * here, derives the conformance grade from it (`apiGrade`), and — in the build
 * — emits the `./components` artifact from it. Nothing about zero's own
 * components changes: `variant` stays `variant`, the rendered attribute stays
 * `data-variant`, and the playground keeps swapping design systems over the
 * same JSX. The declaration only shapes the *additional*, per-design-system
 * `./components` module.
 *
 * Target-neutral: the conformance fixtures and #174's matrix read the grades
 * from the same objects the web emitter consumes, so a matrix row cannot claim
 * a mapping the artifact doesn't implement — they are the same data.
 */
import type { ManifestComponent } from './contract.js';
import { RESERVED_AXES, TOKEN_KEY_PATTERN, VARIANT_AXES, carrierPart, resolveRoles, resolveSizes } from './contract.js';
import type { RolesDecl } from './tokens.js';
import type { CompiledComponentAxes } from './design-system.js';
import type { ValidationIssue } from './resolve/validate.js';

/** How one zero axis surfaces on the vendor-named component module. */
export interface AxisApi {
    /**
     * The vendor prop name (Carbon's `kind`, Ant's `type`). Omitted → the
     * axis surfaces under zero's own name — an explicit `exact` claim,
     * distinct from declaring no mapping at all (`unsupported`).
     *
     * A vendor name may shadow a component-specific prop (Ant's `type` over
     * Button's native `type`) — that is vendor-faithful, but it is a
     * PER-COMPONENT decision: declare it under `api.components.<scope>`,
     * where the shadowing is chosen for that scope. Design-system-wide, a
     * name in `RESERVED_PROPS_BY_SCOPE` is rejected — `api.variant = { as:
     * 'name' }` would silently delete Select's `name` on every wired scope.
     * A name zero's contract owns on every component (`variant`, `mods`,
     * `class`, `asChild`, …) is rejected at either tier.
     */
    as?: string;
    /**
     * zero value → vendor spelling, for the values the attribute grammar
     * cannot hold (`'danger-tertiary'` → `'danger--tertiary'`). Injective,
     * and every key must be a declared value of this axis. The rendered
     * attribute keeps the zero spelling — only the prop surface respells.
     */
    values?: Record<string, string>;
}

/** A presence-only modifier surfaced as a vendor boolean prop. */
export interface ModifierApi {
    /**
     * The vendor boolean prop (`hasIconOnly`, `isExpressive`). Omitted → the
     * modifier surfaces under its own name.
     */
    as?: string;
}

/**
 * One tier of the declaration — the design-system-wide surface, and also the
 * shape of a per-scope override (#318): every named axis, the custom axes,
 * and the modifiers. An override REPLACES the DS-wide entry for a surface it
 * names (entry-level, per axis / per modifier), and says nothing about the
 * surfaces it omits.
 */
export interface ScopeApiOverride {
    /** The `color` axis (values are the declared roles). */
    color?: AxisApi;
    /** The `size` axis (values are the declared ramp). */
    size?: AxisApi;
    /** The `variant` axis. */
    variant?: AxisApi;
    /** Custom axes (`tokens.axes`): axis name → its surfacing. */
    axes?: Record<string, AxisApi>;
    /** Modifiers (`tokens.modifiers`): modifier name → its surfacing. */
    modifiers?: Record<string, ModifierApi>;
}

/**
 * The whole declaration: the DS-wide tier plus per-scope overrides. `color`
 * and `size` have first-class entries (#318 — carbon's `size` could never be
 * respelled without them), and `components` is the formerly reserved
 * per-scope key: scope → the overrides for that component. A DS-wide rename
 * that would shadow one scope's component-specific prop (Select's `name`) is
 * rejected with a pointer here — the override is scoped ON PURPOSE, so the
 * shadowing is a per-component decision, never a design-system-wide accident.
 */
export interface DesignSystemApi extends ScopeApiOverride {
    /** Per-scope overrides: component scope → its own surfacing. */
    components?: Record<string, ScopeApiOverride>;
}

/** `AxisApi` with `values` keys narrowed to a declared vocabulary. */
export interface AxisApiFor<Value extends string> {
    as?: string;
    values?: Partial<Record<Value, string>>;
}

/**
 * `DesignSystemApi` narrowed against a declared vocabulary — see `defineApi`.
 * `C`/`S` (colors and sizes) trail with open defaults so declarations written
 * before those axes had entries keep compiling unchanged.
 */
export interface DesignSystemApiFor<
    V extends string,
    M extends string,
    A extends Record<string, readonly string[]>,
    C extends string = string,
    S extends string = string,
> {
    color?: AxisApiFor<C>;
    size?: AxisApiFor<S>;
    variant?: AxisApiFor<V>;
    axes?: { [K in keyof A]?: AxisApiFor<Extract<A[K][number], string>> };
    modifiers?: Partial<Record<M, ModifierApi>>;
    components?: Record<string, Omit<DesignSystemApiFor<V, M, A, C, S>, 'components'>>;
}

/**
 * The authoring entry point — identity with typing.
 *
 * The two-argument form narrows the declaration against the vocabulary it
 * maps: `values` keys must be declared variant values, `modifiers` keys
 * declared modifiers, `axes` keys declared axes. Pass the same objects the
 * tokens declare (`defineApi({ variants, modifiers }, { … })`) and mistakes
 * fail at the declaration; a design system whose vocabulary isn't exported
 * as `const` arrays degrades to the one-argument form, where `validateApi`
 * catches the same mistakes at build time instead.
 */
export function defineApi(api: DesignSystemApi): DesignSystemApi;
export function defineApi<
    const V extends readonly string[] = readonly never[],
    const M extends readonly string[] = readonly never[],
    const A extends Record<string, readonly string[]> = Record<never, readonly string[]>,
    const C extends readonly string[] = readonly string[],
    const S extends readonly string[] = readonly string[],
>(
    vocabulary: { variants?: V; modifiers?: M; axes?: A; colors?: C; sizes?: S },
    api: DesignSystemApiFor<V[number] & string, M[number] & string, A, C[number] & string, S[number] & string>,
): DesignSystemApi;
export function defineApi(first: object, second?: object): DesignSystemApi {
    return (second ?? first) as DesignSystemApi;
}

/** Conformance fidelity grade (docs/architecture.md, "The authoring
 * surface"), derived mechanically from the declaration. */
export type ConformanceGrade = 'exact' | 'renamed' | 'reshaped' | 'unsupported';

/**
 * The grades a PRESENT mapping can earn. `unsupported` is the absence of a
 * mapping, so anything derived from an entry — a report row, a generated
 * artifact — can never carry it; the report schema states the same exclusion.
 */
export type MappedGrade = Exclude<ConformanceGrade, 'unsupported'>;

/**
 * The grade an axis mapping earns. `unsupported` — the only grade a human
 * still asserts by hand — is simply the absence of a mapping.
 */
export function apiGrade(entry: AxisApi): MappedGrade;
export function apiGrade(entry: AxisApi | undefined): ConformanceGrade;
export function apiGrade(entry: AxisApi | undefined): ConformanceGrade {
    if (!entry) return 'unsupported';
    if (entry.values && Object.keys(entry.values).length > 0) return 'reshaped';
    if (entry.as) return 'renamed';
    return 'exact';
}

/**
 * A mapped modifier is always `reshaped`: the vendor surface is a boolean
 * prop, zero's is a presence-only attribute — the shape changes even when the
 * name doesn't.
 */
export function modifierGrade(entry: ModifierApi): 'reshaped';
export function modifierGrade(entry: ModifierApi | undefined): ConformanceGrade;
export function modifierGrade(entry: ModifierApi | undefined): ConformanceGrade {
    return entry ? 'reshaped' : 'unsupported';
}

/**
 * A vendor prop name: it becomes a property in the generated
 * `components.d.ts` and a JSX attribute. Kebab-case survives both (JSX
 * attributes may contain dashes), so a modifier surfacing under its own name
 * stays valid; what cannot survive is whitespace, quotes or a leading digit.
 */
export const API_PROP_PATTERN = /^[a-zA-Z_$][a-zA-Z0-9_$-]*$/;

/**
 * A vendor value spelling: interpolated into a single-quoted literal in the
 * generated `.d.ts` and compared verbatim against the prop at runtime.
 * Deliberately looser than `TOKEN_KEY_PATTERN` — holding the spellings that
 * pattern rejects is the whole point of `values` — but still printable ASCII
 * with no whitespace, quotes or backslashes.
 */
const VENDOR_VALUE_PATTERN = /^[\x21\x23-\x26\x28-\x5b\x5d-\x7e]+$/;

/**
 * Prop names zero's contract owns on every component. Composed from the
 * parity-tested contract constants rather than redeclared — `adapt()` never
 * re-validates (generated artifacts are downstream of this validator, the
 * same trust model `register.js` has), so this set exists only here.
 */
const CONTRACT_PROPS = new Set([
    ...Object.keys(VARIANT_AXES),
    'axes',
    'mods',
    'class',
    'asChild',
    'children',
]);

/** The vocabulary half of `TokensInput` — all `validateApi` needs to read. */
export interface ApiVocabulary {
    /**
     * The declared colour roles — the `TokensInput` declaration shape, or a
     * bare list of role names (the conformance fixtures' shape). Resolved
     * like compilation resolves them: omitted means the recommended roles,
     * explicitly empty means the axis does not exist.
     */
    roles?: RolesDecl | readonly string[];
    /** The declared size ramp — resolved like compilation resolves it. */
    sizes?: readonly string[];
    variants?: readonly string[];
    modifiers?: readonly string[];
    axes?: Record<string, readonly string[]>;
}

export interface ValidateApiOptions {
    /**
     * The component scopes of the anatomy manifest, for checking
     * `api.components` keys. Optional because a conformance fixture validates
     * without a manifest; `validateDesignSystem` always passes it.
     */
    scopes?: readonly string[];
}

/**
 * Component-specific props on each scope's ROOT component — the props a
 * vendor rename would shadow through `adapt()`'s props view, beyond the
 * structural `CONTRACT_PROPS` every component shares. A DS-WIDE mapping onto
 * one of these names is rejected (it silently deletes the prop on that scope
 * — `api.variant = { as: 'name' }` deleted Select's `name`); the same
 * mapping under `api.components.<scope>` is the deliberate, vendor-faithful
 * shadowing and is allowed.
 *
 * Hand-maintained mirror of zero's component sources, kept honest by
 * `reserved-props-parity.test.ts`, which re-derives this table from the
 * `*RootProps` declarations in `packages/zero/src/components` and fails on
 * any drift.
 */
export const RESERVED_PROPS_BY_SCOPE: Readonly<Record<string, readonly string[]>> = {
    accordion: ['collapsible', 'defaultValue', 'multiple', 'value'],
    alert: ['defaultOpen', 'value'],
    avatar: [],
    badge: [],
    box: ['pad', 'padX', 'padY'],
    breadcrumbs: ['label'],
    button: ['onBlur', 'onClick', 'onFocus', 'onKeydown', 'type'],
    card: [],
    carousel: ['defaultIndex', 'label', 'value'],
    center: ['axis', 'gap', 'pad', 'padX', 'padY'],
    chat: ['placement'],
    checkbox: ['defaultChecked', 'form', 'indeterminate', 'invalid', 'name', 'required', 'value'],
    collapsible: ['defaultOpen', 'value'],
    container: ['measure', 'pad', 'padX', 'padY'],
    combobox: ['defaultInputValue', 'defaultOpen', 'defaultValue', 'emptyText', 'filter', 'form', 'invalid', 'itemDisabled', 'itemGroup', 'itemKey', 'itemLabel', 'itemValue', 'items', 'multiple', 'name', 'placeholder', 'placement', 'positionStrategy', 'readonly', 'required', 'value'],
    countdown: ['label'],
    dialog: ['defaultOpen', 'dismissible', 'modal', 'role', 'value'],
    diff: ['defaultValue', 'value'],
    divider: ['orientation'],
    drawer: ['defaultOpen', 'dismissible', 'label', 'modal', 'placement', 'value'],
    field: ['invalid', 'readonly', 'required'],
    grid: ['align', 'cols', 'gap', 'gapX', 'gapY', 'justify', 'pad', 'padX', 'padY', 'track'],
    'file-upload': ['accept', 'defaultFiles', 'form', 'invalid', 'multiple', 'name', 'required', 'value'],
    indicator: [],
    input: ['autocomplete', 'defaultValue', 'form', 'invalid', 'maxlength', 'name', 'readonly', 'required', 'type', 'value'],
    join: [],
    kbd: [],
    menu: ['closeOnSelect', 'defaultOpen', 'offset', 'placement', 'positionStrategy', 'value'],
    navbar: [],
    'number-input': ['allowWheel', 'clampOnBlur', 'defaultValue', 'form', 'format', 'invalid', 'max', 'min', 'name', 'parse', 'readonly', 'required', 'step', 'value'],
    pagination: ['boundaryCount', 'count', 'defaultPage', 'label', 'nextLabel', 'prevLabel', 'siblingCount', 'value'],
    popover: ['defaultOpen', 'offset', 'placement', 'positionStrategy', 'value'],
    progress: ['max', 'min', 'value'],
    'radial-progress': ['max', 'min', 'value'],
    'radio-group': ['defaultValue', 'form', 'invalid', 'itemDisabled', 'itemKey', 'itemLabel', 'items', 'name', 'required', 'value'],
    'rating-group': ['allowHalf', 'count', 'defaultValue', 'deselectable', 'form', 'invalid', 'itemLabel', 'name', 'readonly', 'required', 'value'],
    select: ['defaultOpen', 'defaultValue', 'form', 'invalid', 'itemDisabled', 'itemGroup', 'itemKey', 'itemLabel', 'itemValue', 'items', 'multiple', 'name', 'placeholder', 'placement', 'positionStrategy', 'required', 'value'],
    skeleton: ['defaultLoading', 'value'],
    spacer: ['space'],
    slider: ['defaultValue', 'form', 'getValueText', 'invalid', 'marks', 'max', 'min', 'name', 'step', 'value'],
    spinner: ['label'],
    stack: ['align', 'gap', 'gapX', 'gapY', 'justify', 'pad', 'padX', 'padY', 'wrap'],
    stats: [],
    status: ['label'],
    steps: ['defaultStep', 'label', 'loop', 'value'],
    swap: ['defaultActive', 'interactive', 'label', 'value'],
    switch: ['defaultChecked', 'form', 'invalid', 'name', 'required', 'value'],
    table: [],
    tabs: ['activationMode', 'defaultValue', 'loop', 'value'],
    textarea: ['autocomplete', 'defaultValue', 'form', 'invalid', 'maxlength', 'name', 'readonly', 'required', 'rows', 'value'],
    timeline: [],
    toast: ['toast'],
    toggle: ['defaultPressed', 'label', 'value'],
    'toggle-group': ['defaultValue', 'deselectable', 'label', 'loop', 'multiple', 'value'],
    tooltip: ['closeDelay', 'defaultOpen', 'offset', 'openDelay', 'placement', 'positionStrategy', 'value'],
    'tree-view': ['defaultExpandedValues', 'defaultValue', 'value'],
};

/** The surface keys one tier of the declaration may carry. */
const TIER_KEYS = ['color', 'size', 'variant', 'axes', 'modifiers'] as const;

/**
 * Validate a declaration against the vocabulary it maps. Standalone (rather
 * than folded into `validateDesignSystem`) so a conformance fixture can check
 * its api against its own vocabulary without constructing a full design
 * system — the fixture and the validator see the same objects.
 */
export function validateApi(
    api: DesignSystemApi,
    vocabulary: ApiVocabulary,
    options: ValidateApiOptions = {},
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const error = (where: string, message: string) => issues.push({ level: 'error', where, message });
    const warn = (where: string, message: string) => issues.push({ level: 'warning', where, message });

    // ── Shape: only the keys this kit understands ──
    // An unknown key is an error, not a skip: a newer declaration read by an
    // older kit must fail loudly rather than silently emit less than it says.
    for (const key of Object.keys(api)) {
        if ((TIER_KEYS as readonly string[]).includes(key) || key === 'components') continue;
        error('api', `unknown key "${key}" — the api declares color, size, variant, axes, modifiers and components`);
    }
    const checkEntryKeys = (where: string, entry: object, allowed: readonly string[]): void => {
        for (const key of Object.keys(entry)) {
            if (!allowed.includes(key)) {
                error(where, `unknown key "${key}" — a mapping declares ${allowed.join(' and ')}`);
            }
        }
    };

    const checkAs = (where: string, as: string, ownName: string): void => {
        if (!API_PROP_PATTERN.test(as)) {
            error(where, `as: "${as}" is not a valid prop name — it becomes a property in the generated components.d.ts`);
            return;
        }
        if (as === ownName) {
            warn(where, `as: "${as}" is the surface's own name — omit \`as\` to surface it unrenamed`);
            return;
        }
        if (Object.hasOwn(VARIANT_AXES, as) || as === 'axes' || as === 'mods') {
            error(where, `as: "${as}" is zero's own prop for an axis — a prop of that name could never route anywhere else`);
        } else if (RESERVED_AXES.has(as)) {
            error(where, `as: "${as}" is part of the anatomy contract — a prop of that name would shadow what zero already renders`);
        } else if (CONTRACT_PROPS.has(as)) {
            error(where, `as: "${as}" is a structural prop on every zero component — the adapter could never forward it`);
        }
    };

    /**
     * DS-WIDE tier only: a prop that is component-specific on some scope may
     * not be claimed design-system-wide — the rename would silently shadow
     * that scope's own prop. Scoped under `api.components.<scope>` the same
     * name is the deliberate vendor shadowing, so per-scope entries skip this.
     */
    const checkReservedByScope = (where: string, prop: string): void => {
        const clashing = Object.entries(RESERVED_PROPS_BY_SCOPE)
            .filter(([, props]) => props.includes(prop))
            .map(([scope]) => `"${scope}"`);
        if (clashing.length === 0) return;
        error(
            where,
            `"${prop}" is a component-specific prop on ${clashing.join(', ')} — a design-system-wide mapping would shadow it there. ` +
            'Declare the mapping under api.components.<scope> for the scopes that want the vendor shadowing, or pick another name.',
        );
    };

    const checkValues = (
        where: string,
        values: Record<string, string>,
        declared: ReadonlySet<string>,
        surface: string,
    ): void => {
        const seenVendor = new Map<string, string>();
        for (const [zero, vendor] of Object.entries(values)) {
            if (!declared.has(zero)) {
                error(where, `values remaps "${zero}", which is not in ${surface} — the adapter can only respell declared values`);
            }
            if (!VENDOR_VALUE_PATTERN.test(vendor)) {
                error(where, `values respells "${zero}" as "${vendor}", which is not a plain printable spelling (no whitespace, quotes or backslashes)`);
                continue;
            }
            if (vendor === zero) {
                warn(where, `values remaps "${zero}" to itself — remove the entry (an untouched value needs no remap)`);
                continue;
            }
            if (declared.has(vendor)) {
                error(where, `values respells "${zero}" as "${vendor}", which is itself a declared value — the vendor union would carry one name with two meanings`);
            }
            const already = seenVendor.get(vendor);
            if (already) {
                error(where, `values maps "${already}" and "${zero}" both to "${vendor}" — the remap must be injective so adapt() can route each vendor value back to one zero value`);
            } else {
                seenVendor.set(vendor, zero);
            }
        }
    };

    // ── The named axes and the vocabulary each maps ──
    // `color`/`size` resolve exactly as compilation resolves them: an omitted
    // declaration means the recommended vocabulary, an explicitly empty one
    // (`roles: {}` / `sizes: []`) means the axis does not exist.
    const namedAxes = [
        {
            axis: 'color' as const,
            declared: Array.isArray(vocabulary.roles)
                ? [...(vocabulary.roles as readonly string[])]
                : Object.keys(resolveRoles(vocabulary.roles as RolesDecl | undefined)),
            surface: 'tokens.roles',
            emptyMessage: 'maps the color axis, but this design system declares no colour axis (roles: {})',
        },
        {
            axis: 'size' as const,
            declared: [...resolveSizes(vocabulary.sizes)],
            surface: 'tokens.sizes',
            emptyMessage: 'maps the size axis, but this design system declares no size axis (sizes: [])',
        },
        {
            axis: 'variant' as const,
            declared: [...(vocabulary.variants ?? [])],
            surface: 'tokens.variants',
            emptyMessage: 'maps the variant axis, but tokens.variants is undeclared — declare the vocabulary so the generated types have a union to narrow',
        },
    ];

    /**
     * One tier — the DS-wide declaration, or one scope's override. `claim`
     * carries the tier's duplicate-prop table; `dsWide` gates the
     * reserved-by-scope check, which is exactly the difference between the
     * accidental shadowing and the deliberate one.
     */
    const validateTier = (
        tier: ScopeApiOverride,
        prefix: string,
        claim: (where: string, prop: string) => void,
        dsWide: boolean,
    ): void => {
        for (const { axis, declared, surface, emptyMessage } of namedAxes) {
            const entry = tier[axis];
            if (!entry) continue;
            const where = `${prefix}.${axis}`;
            checkEntryKeys(where, entry, ['as', 'values']);
            if (declared.length === 0) error(where, emptyMessage);
            if (entry.as !== undefined) checkAs(where, entry.as, axis);
            const prop = entry.as ?? axis;
            if (dsWide && entry.as !== undefined) checkReservedByScope(where, prop);
            claim(where, prop);
            if (entry.values) checkValues(where, entry.values, new Set(declared), surface);
        }

        for (const [axis, entry] of Object.entries(tier.axes ?? {})) {
            const where = `${prefix}.axes.${axis}`;
            checkEntryKeys(where, entry, ['as', 'values']);
            const declared = vocabulary.axes?.[axis];
            if (!declared) {
                error(`${prefix}.axes`, `"${axis}" is not declared in tokens.axes — declare the axis or remove the mapping`);
            }
            if (entry.as !== undefined) checkAs(where, entry.as, axis);
            const prop = entry.as ?? axis;
            if (dsWide) checkReservedByScope(where, prop);
            claim(where, prop);
            if (entry.values) checkValues(where, entry.values, new Set(declared ?? []), `tokens.axes.${axis}`);
        }

        for (const [name, entry] of Object.entries(tier.modifiers ?? {})) {
            const where = `${prefix}.modifiers.${name}`;
            checkEntryKeys(where, entry, ['as']);
            if (!(vocabulary.modifiers ?? []).includes(name)) {
                error(`${prefix}.modifiers`, `"${name}" is not declared in tokens.modifiers — declare the modifier or remove the mapping`);
            }
            if (entry.as !== undefined) {
                checkAs(where, entry.as, name);
            } else if (CONTRACT_PROPS.has(name) || RESERVED_AXES.has(name)) {
                // Modifier NAMES live behind the data-mod- prefix, so
                // declaration never checks them against the contract's
                // namespace — but a modifier surfacing as a PROP steps out
                // from behind the prefix.
                error(where, `"${name}" would surface as a prop zero already owns — give it a vendor name with \`as\``);
            }
            const prop = entry.as ?? name;
            if (dsWide) checkReservedByScope(where, prop);
            claim(where, prop);
        }
    };

    // ── DS-wide tier ──
    // An entry without `as` still occupies a prop (its own name): two routes
    // to one prop would leave adapt() unable to say which axis a value is for.
    const propOwners = new Map<string, string>();
    validateTier(api, 'api', (where, prop) => {
        const owner = propOwners.get(prop);
        if (owner) {
            error('api', `${owner} and ${where} both expose the prop "${prop}" — every vendor prop must route to exactly one axis`);
        } else {
            propOwners.set(prop, where);
        }
    }, true);

    // ── Per-scope overrides (#318) ──
    for (const [scope, override] of Object.entries(api.components ?? {})) {
        const where = `api.components.${scope}`;
        if (!TOKEN_KEY_PATTERN.test(scope) || (options.scopes && !options.scopes.includes(scope))) {
            error(where, `"${scope}" is not a component scope in the anatomy manifest`);
        }
        for (const key of Object.keys(override)) {
            if ((TIER_KEYS as readonly string[]).includes(key)) continue;
            error(where, key === 'components'
                ? 'overrides cannot nest — `components` only exists at the top level'
                : `unknown key "${key}" — an override declares color, size, variant, axes and modifiers`);
        }

        // The duplicate-prop table for THIS scope's effective surface: seeded
        // with every DS-wide prop that survives the override (an overridden
        // surface's DS-wide prop is replaced, so its name is free again), then
        // the override's own entries claim against it. Seeds never re-report
        // collisions among themselves — those are DS-level findings.
        const scopeOwners = new Map<string, string>();
        for (const { axis } of namedAxes) {
            const entry = api[axis];
            if (entry && !override[axis]) scopeOwners.set(entry.as ?? axis, `api.${axis}`);
        }
        for (const [axis, entry] of Object.entries(api.axes ?? {})) {
            if (!override.axes?.[axis]) scopeOwners.set(entry.as ?? axis, `api.axes.${axis}`);
        }
        for (const [name, entry] of Object.entries(api.modifiers ?? {})) {
            if (!override.modifiers?.[name]) scopeOwners.set(entry.as ?? name, `api.modifiers.${name}`);
        }
        validateTier(override, where, (entryWhere, prop) => {
            const owner = scopeOwners.get(prop);
            if (owner) {
                error(where, `${owner} and ${entryWhere} both expose the prop "${prop}" — every vendor prop must route to exactly one axis`);
            } else {
                scopeOwners.set(prop, entryWhere);
            }
        }, false);
    }

    return issues;
}

/**
 * The declaration in force for ONE scope: the DS-wide tier with that scope's
 * `components` override applied — entry-level replacement per surface, per
 * custom axis and per modifier. The single seam every consumer of a
 * per-component api goes through (`compileDesignSystem` calls it before
 * `deriveComponentApi`), so the emitters, the manifest and the runtime spec
 * all read one merge.
 */
export function scopeApi(api: DesignSystemApi, scope: string): ScopeApiOverride {
    const override = api.components?.[scope];
    if (!override) return api;
    const merged: ScopeApiOverride = {};
    for (const axis of ['color', 'size', 'variant'] as const) {
        const entry = override[axis] ?? api[axis];
        if (entry) merged[axis] = entry;
    }
    if (api.axes || override.axes) merged.axes = { ...api.axes, ...override.axes };
    if (api.modifiers || override.modifiers) merged.modifiers = { ...api.modifiers, ...override.modifiers };
    return merged;
}

/**
 * One vendor prop's routing in the compiled, per-component form — structurally
 * the entry type of `AdaptSpec['props']` in `@sigx/zero/adapt`, because the
 * generated `components.js` inlines these objects verbatim into `adapt()`
 * calls. `values` is INVERTED from the authoring direction (vendor spelling →
 * zero value): the runtime looks up what the consumer passed, and identity
 * entries are omitted because a lookup miss falls through to the value itself.
 */
export type CompiledApiRoute =
    | { axis: string; values?: Record<string, string> }
    | { modifier: string };

/**
 * One component's resolved vendor API: the design-system-level declaration
 * filtered to what this component's recipe actually wires. A declared mapping
 * for an axis this recipe leaves unwired contributes nothing — the vendor
 * prop simply doesn't exist on this component, the same closed-world rule the
 * register artifact applies to zero's own props.
 */
export interface CompiledComponentApi {
    /** The manifest part carrying the variant attributes (`root`, else first). */
    carrier: string;
    /** True when the anatomy has exactly one part — the adapted export IS the component. */
    singlePart: boolean;
    /** vendor prop → routing, keys sorted for deterministic emission. */
    props: Record<string, CompiledApiRoute>;
}

/**
 * Filter the declaration down to one component's wired surface. Callers with
 * a per-scope `components` override resolve it FIRST (`scopeApi`) — this
 * function reads one flat tier.
 *
 * An axis entry without `as` still produces a route (under the axis's own
 * name): the generated `.d.ts` replaces the WHOLE variant surface, so even an
 * unrenamed axis flows through the same door — one mechanism, graded `exact`.
 */
export function deriveComponentApi(
    api: ScopeApiOverride,
    axes: CompiledComponentAxes,
    component: ManifestComponent,
): CompiledComponentApi {
    const props: Record<string, CompiledApiRoute> = {};

    const inverted = (
        values: Record<string, string> | undefined,
        wired: readonly string[],
    ): Record<string, string> | undefined => {
        const entries = Object.entries(values ?? {})
            .filter(([zero, vendor]) => vendor !== zero && wired.includes(zero))
            .map(([zero, vendor]) => [vendor, zero] as const)
            .sort(([a], [b]) => a.localeCompare(b));
        return entries.length > 0 ? Object.fromEntries(entries) : undefined;
    };

    for (const axis of ['color', 'size', 'variant'] as const) {
        const entry = api[axis];
        if (!entry || axes[axis].length === 0) continue;
        const values = inverted(entry.values, axes[axis]);
        props[entry.as ?? axis] = { axis, ...(values ? { values } : {}) };
    }
    for (const [axis, entry] of Object.entries(api.axes ?? {})) {
        const wired = axes.axes[axis];
        if (!wired || wired.length === 0) continue;
        const values = inverted(entry.values, wired);
        props[entry.as ?? axis] = { axis, ...(values ? { values } : {}) };
    }
    for (const [name, entry] of Object.entries(api.modifiers ?? {})) {
        if (!axes.mods.includes(name)) continue;
        props[entry.as ?? name] = { modifier: name };
    }

    return {
        carrier: carrierPart(component),
        singlePart: component.parts.length === 1,
        props: Object.fromEntries(Object.entries(props).sort(([a], [b]) => a.localeCompare(b))),
    };
}
