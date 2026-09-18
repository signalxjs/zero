/**
 * `adapt` — the one generic runtime behind every vendor-named component
 * module (issue #179; docs/architecture.md, "The components artifact —
 * vendor-named apis").
 *
 * A design system that declares an `api` gets a generated
 * `dist/components.js` from the kit: pure data, one `adapt(Base, spec)` call
 * per component. All behaviour lives here, written once — the generated file
 * may never contain logic, the same line `/register` draws for types.
 *
 * The mechanism is setup delegation, not a wrapper component: the adapted
 * factory is a real sigx component whose setup calls the base component's
 * setup with the same context, substituting only `props` with a renaming
 * view. One component instance — slots, events, models, `expose`/ref and
 * lifecycle all belong to the base setup and pass through untouched. The
 * view answers the base's zero-named reads (`variant`, `axes`, `mods`) by
 * reading the vendor props at that moment, so every read lands on the
 * tracking props accessor inside whatever effect asked — reactivity needs no
 * extra machinery.
 *
 * Two conventions this relies on, both true of every zero component:
 * - Props are read through `ctx.props` (never via `getCurrentInstance()`),
 *   so the substituted view is the only door.
 * - The rendered attributes are zero's: a routed `kind="ghost"` renders
 *   `data-variant="ghost"`, never `data-kind` — the anatomy contract is
 *   untouched by renaming.
 *
 * `adapt` performs no name validation: the spec is kit-generated and
 * kit-validated (the same trust model `register.js` has), and the generated
 * `components.d.ts` — not the loose signature here — is the typed surface
 * consumers see.
 */
import { component, getComponentMeta } from 'sigx';
import type { AnyComponentFactory, ComponentFactory } from 'sigx';

/** How one vendor prop routes onto zero's variant surface. */
export type AdaptRoute =
    /**
     * An axis value: `axis` is `color`/`size`/`variant` (the named props) or
     * a custom axis (folded into the `axes` bag). `values` respells at the
     * prop boundary — vendor spelling → zero value, identity entries omitted
     * — so the attribute keeps the zero spelling the recipes matched.
     */
    | { axis: string; values?: Record<string, string> }
    /** A presence modifier: the vendor prop is a boolean, folded into `mods`. */
    | { modifier: string };

/**
 * The kit-generated wiring data for one component: vendor prop → route.
 * Everything is plain data so the generated module stays behaviour-free.
 */
export interface AdaptSpec {
    props: Record<string, AdaptRoute>;
}

/**
 * The adapted factory's type, re-parameterized from the base so nothing is
 * restated: the combined props (`__events` carries them in full), ref and
 * slots come from the base component and cannot drift from zero's source.
 * The generated `components.d.ts` instantiates this with the vendor props —
 * `Adapted<typeof Button, 'variant' | 'mods', { kind?: …; hasIconOnly?: … }>`.
 */
export type Adapted<
    TBase extends AnyComponentFactory,
    TRemove extends string,
    TAdd extends Record<string, unknown>,
> = ComponentFactory<Omit<TBase['__events'], TRemove> & TAdd, TBase['__ref'], TBase['__slots']>;

/**
 * A compound namespace's non-carrier statics — everything except the
 * self-referential `Root` and the factory's own machinery (call signature and
 * brands, which the `Adapted` main supplies afresh). The generated
 * `components.d.ts` intersects this with the adapted main, so `Tabs.List`,
 * `Menu.Item` and friends keep their real types without the emitter ever
 * having to know a compound's static names.
 */
export type AdaptedStatics<TBase> = Omit<
    TBase,
    'Root' | keyof AnyComponentFactory | '__name' | '__islandId'
>;

/** The spec, indexed once per `adapt` call rather than per instance. */
interface Routing {
    /** vendor prop → its route (also the set of props the adapter consumes). */
    byVendor: Map<string, AdaptRoute>;
    /** named zero prop (`variant`, …) → the vendor prop + value map serving it. */
    named: Map<string, { vendorProp: string; values?: Record<string, string> }>;
    /** custom-axis routes, folded into the `axes` bag. */
    axes: Array<{ axis: string; vendorProp: string; values?: Record<string, string> }>;
    /** modifier routes, folded into the `mods` bag. */
    mods: Array<{ name: string; vendorProp: string }>;
}

/** The three axes with named props — everything else folds into `axes`. */
const NAMED_AXES = new Set(['color', 'size', 'variant']);

function index(spec: AdaptSpec): Routing {
    const routing: Routing = { byVendor: new Map(), named: new Map(), axes: [], mods: [] };
    for (const [vendorProp, route] of Object.entries(spec.props)) {
        routing.byVendor.set(vendorProp, route);
        if ('modifier' in route) {
            routing.mods.push({ name: route.modifier, vendorProp });
        } else if (NAMED_AXES.has(route.axis)) {
            routing.named.set(route.axis, { vendorProp, values: route.values });
        } else {
            routing.axes.push({ axis: route.axis, vendorProp, values: route.values });
        }
    }
    return routing;
}

/**
 * The renaming view over the tracking props accessor.
 *
 * Reads FORWARD at call time — nothing is copied — so a routed read stays a
 * tracked read of the underlying accessor. The vendor props themselves
 * disappear from the base's perspective (`undefined`, absent from `in` and
 * enumeration): a vendor name may deliberately shadow a base prop (Ant's
 * `type` over Button's native `type`), and the shadowed prop must not leak
 * the vendor's axis value into the DOM.
 */
function propsView(props: Record<string, unknown>, routing: Routing): Record<string, unknown> {
    const { byVendor, named, axes, mods } = routing;

    const namedValue = (route: { vendorProp: string; values?: Record<string, string> }): unknown => {
        const value = props[route.vendorProp];
        return typeof value === 'string' ? (route.values?.[value] ?? value) : value;
    };
    // The bags are rebuilt per read (they are tiny), with each vendor prop
    // read HERE so it is tracked by whatever effect asked for the bag.
    const axesBag = (): unknown => {
        const base = props['axes'] as Record<string, string> | undefined;
        let bag = base === undefined ? undefined : { ...base };
        for (const route of axes) {
            const value = props[route.vendorProp];
            if (typeof value !== 'string') continue;
            (bag ??= {})[route.axis] = route.values?.[value] ?? value;
        }
        return bag;
    };
    const modsBag = (): unknown => {
        const base = props['mods'] as Record<string, boolean> | undefined;
        let bag = base === undefined ? undefined : { ...base };
        for (const route of mods) {
            const value = props[route.vendorProp];
            if (value === undefined) continue;
            (bag ??= {})[route.name] = value as boolean;
        }
        return bag;
    };
    const views = (key: string): (() => unknown) | undefined => {
        const route = named.get(key);
        if (route) return () => namedValue(route);
        if (key === 'axes' && axes.length > 0) return axesBag;
        if (key === 'mods' && mods.length > 0) return modsBag;
        return undefined;
    };
    const has = (key: string): boolean => {
        const route = named.get(key);
        if (route) return route.vendorProp in props;
        if (key === 'axes' && axes.length > 0) return 'axes' in props || axes.some((r) => r.vendorProp in props);
        if (key === 'mods' && mods.length > 0) return 'mods' in props || mods.some((r) => r.vendorProp in props);
        if (byVendor.has(key)) return false;
        return key in props;
    };

    return new Proxy(props, {
        get(target, key) {
            if (typeof key !== 'string') return undefined;
            const view = views(key);
            if (view) return view();
            if (byVendor.has(key)) return undefined;
            return target[key];
        },
        has: (_target, key) => typeof key === 'string' && has(key),
        ownKeys(target) {
            const keys: string[] = [];
            for (const key of Reflect.ownKeys(target)) {
                if (typeof key !== 'string' || byVendor.has(key)) continue;
                keys.push(key);
            }
            for (const [axis, route] of named) {
                if (route.vendorProp in props && !keys.includes(axis)) keys.push(axis);
            }
            if (axes.some((r) => r.vendorProp in props) && !keys.includes('axes')) keys.push('axes');
            if (mods.some((r) => r.vendorProp in props) && !keys.includes('mods')) keys.push('mods');
            return keys;
        },
        // Same descriptor shape as sigx's own props accessor, so spread
        // (ownKeys → this → [[Get]]) behaves identically through the view.
        getOwnPropertyDescriptor(_target, key) {
            if (typeof key === 'string' && has(key)) {
                return { enumerable: true, configurable: true, writable: false };
            }
            return undefined;
        },
    });
}

/**
 * Adapt a zero component (or compound namespace) to a vendor prop surface.
 *
 * Returns a new factory whose setup delegates to the base's with the props
 * view substituted. Compound statics are carried over by enumeration, with
 * self-references remapped — `compound()` is `Object.assign(main, sub)`, so
 * `Button.Root === Button`, and the adapted namespace keeps that shape
 * (`adapted.Root === adapted`). Non-carrier parts pass through by identity:
 * only the part carrying the variant attributes reads them.
 */
export function adapt<TBase extends AnyComponentFactory>(base: TBase, spec: AdaptSpec): TBase {
    const meta = getComponentMeta(base);
    const setup = meta?.setup ?? base.__setup;
    if (typeof setup !== 'function') {
        throw new Error('[zero] adapt() needs a sigx component factory (did the design system pass a non-component export?)');
    }
    const routing = index(spec);
    type Ctx = { props: Record<string, unknown> };
    const wrapped = component<Record<string, unknown>>((ctx) => {
        let view: Record<string, unknown> | undefined;
        const delegated = new Proxy(ctx as object, {
            get(target, key, receiver) {
                if (key === 'props') return (view ??= propsView((target as Ctx).props, routing));
                return Reflect.get(target, key, receiver);
            },
        });
        return (setup as (c: unknown) => ReturnType<Parameters<typeof component>[0]>)(delegated);
    }, meta?.name !== undefined ? { name: meta.name } : undefined);

    for (const key of Object.keys(base)) {
        if (key.startsWith('__')) continue; // brands belong to the wrapped factory itself
        const value = (base as Record<string, unknown>)[key];
        (wrapped as unknown as Record<string, unknown>)[key] = value === (base as unknown) ? wrapped : value;
    }
    return wrapped as unknown as TBase;
}
