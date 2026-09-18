/**
 * The attribute pass-through — the policy for everyday HTML attributes a
 * part does not model itself: `aria-*`, the app's own `data-*`, `id`,
 * `title` and `role`.
 *
 * sigx hands a component every prop it was given, but nothing reaches the
 * rendered element unless the component puts it there — so an `aria-label`
 * on `<Button.Root>` used to vanish without a trace. A part that intersects
 * {@link WithHtmlAttrs} into its props and spreads {@link htmlAttrs} onto
 * its element (or into its asChild bag) forwards them.
 *
 * lib.dom-free, like `variant-attrs.ts`: the type and the runtime half name
 * no DOM shape.
 */
import { FLAG_VOCABULARY } from './data-attrs.js';
import { MOD_ATTR_PREFIX, VARIANT_AXES } from './variant-attrs.js';

/**
 * `LAYOUT_ATTR_PREFIX`, restated rather than imported: `layout-attrs.ts`
 * carries a module-level vocabulary table the bundler cannot drop, and this
 * module rides into every part that forwards attributes.
 * `html-attrs.test.ts` holds the two honest.
 */
const LAYOUT_PREFIX = 'data-l-';

/**
 * The `data-*` attributes the anatomy contract owns — `data-scope`,
 * `data-part`, `data-state`, `data-orientation`, `data-placement`, every flag,
 * the three named axes, and `data-autosize` (a part renders it from its own
 * props — an app's would be overridden, or dropped when the part turns it
 * off). `data-visually-hidden` is deliberately not here: an app may stamp it
 * on any element of its own. A design system selects on every one of them, so
 * an app writing `data-state="open"` from outside would make the skin's
 * `[data-state="open"]` rules match something the component never said.
 * The `data-mod-` and `data-l-` namespaces are owned too (by `mods` and the
 * layout props); those are prefixes, checked separately.
 */
export const RESERVED_DATA_ATTRS: ReadonlySet<string> = new Set([
    'data-scope',
    'data-part',
    'data-state',
    'data-orientation',
    'data-placement',
    'data-autosize',
    ...FLAG_VOCABULARY.map((flag) => `data-${flag}`),
    ...Object.values(VARIANT_AXES),
]);

/** A value an `aria-*` / `data-*` attribute can take in JSX. */
export type HtmlAttrValue = string | number | boolean | undefined;

/**
 * The value type of a reserved `data-*` name: nothing a JSX attribute can
 * spell, so writing one is a compile error that names the reason. Not
 * `never` — an optional `never` reads as `undefined`, and sigx's
 * `EventNames` takes any prop whose type is `undefined`-assignable-to-an-event
 * for an event, which would quietly turn `data-state` into `onData-state`.
 */
export interface ReservedByZero {
    readonly __reservedByZero: 'set through the component props — color/size/variant/axes/mods, layout, disabled, …';
}

type ReservedDataAttr =
    | 'data-scope' | 'data-part' | 'data-state' | 'data-orientation' | 'data-placement' | 'data-autosize'
    | `data-${typeof FLAG_VOCABULARY[number]}`
    | 'data-color' | 'data-size' | 'data-variant';

/**
 * The attributes a part forwards to the element it renders.
 *
 * - `aria-*` — any; the part's own ARIA wins where it sets the same name
 *   (a Tab's `aria-selected` is the component's, not the app's).
 * - `data-*` — any the contract does not own: `data-row-id`, `data-testid`.
 *   A reserved name (`data-state`, `data-color`, `data-mod-*`, …) throws in
 *   {@link htmlAttrs}, and the spelled-out ones are compile errors too.
 * - `id`, `title`, `role` — the global attributes an app reaches for daily.
 *
 * `aria-*` and `data-*` need no declaration to compile: TypeScript never
 * reports a hyphenated JSX attribute as excess, which is exactly why an
 * `aria-label` on a part used to compile and then silently vanish. It also
 * checks one only against a property of that EXACT name — a
 * `` `data-${string}` `` pattern member is ignored in JSX, and worse, it
 * absorbs the literal reserved names out of `keyof` so sigx's JSX
 * signature (a `Pick` over the props) drops them. So the type spells out
 * only the names it can enforce; the prefixes (`data-mod-*`, `data-l-*`)
 * answer to the runtime guard.
 */
export type WithHtmlAttrs =
    & { id?: string; title?: string; role?: string }
    & { [K in ReservedDataAttr]?: ReservedByZero };

const isForwarded = (key: string): boolean =>
    key === 'id' || key === 'title' || key === 'role'
    || key.startsWith('aria-') || key.startsWith('data-');

const isReserved = (key: string): boolean =>
    RESERVED_DATA_ATTRS.has(key)
    || key.startsWith(MOD_ATTR_PREFIX)
    || key.startsWith(LAYOUT_PREFIX);

/**
 * Pick the forwardable attributes out of a part's props.
 *
 * Spread it FIRST, before the part's own attributes, so the part wins on any
 * name both set. A reserved `data-*` name throws rather than being dropped,
 * and so does a value the attribute cannot carry (`id`/`title`/`role` take
 * a string; `aria-*`/`data-*` a string, number or boolean, an `aria-*`
 * boolean rendering as the `"true"`/`"false"` token),
 * for `variantAttrs`' reason: it comes from application code, and a silently
 * missing (or silently overridden) attribute is the failure this exists to
 * remove. An `undefined` value is skipped before the guard, so an unset
 * optional prop neither throws nor emits.
 */
export function htmlAttrs(props: Record<string, unknown>): Record<string, HtmlAttrValue> {
    const attrs: Record<string, HtmlAttrValue> = {};
    for (const key of Object.keys(props)) {
        if (!isForwarded(key)) continue;
        const value = props[key];
        if (value === undefined) continue;
        if (isReserved(key)) {
            // Terse on purpose: this module rides into every forwarding part.
            throw new Error(`[zero] ${key} is part of the anatomy contract — set it through the component's props`);
        }
        // The type says as much, but an untyped spread does not: an object
        // would serialize to "[object Object]", a function to its source.
        const kind = typeof value;
        const global = !key.startsWith('aria-') && !key.startsWith('data-');
        if (global ? kind !== 'string' : kind !== 'string' && kind !== 'number' && kind !== 'boolean') {
            throw new Error(`[zero] ${key}: expected a string${global ? '' : ', number or boolean'}`);
        }
        // ARIA is string-valued: a boolean `true` renders as an empty
        // attribute (`aria-busy=""`, which is invalid) and `false` as none at
        // all, where `aria-expanded="false"` is a statement. A `data-*`
        // boolean keeps the presence semantics the flags use.
        attrs[key] = kind === 'boolean' && key.startsWith('aria-') ? String(value) : value as HtmlAttrValue;
    }
    return attrs;
}
