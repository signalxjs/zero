/**
 * `mergePartProps` — lending one zero part's asChild bag to another zero
 * component (#452).
 *
 * The composition rule: when one zero part is merged into another, the
 * element that renders keeps its OWN anatomy. The lent part (the "lender",
 * a Tooltip.Trigger's bag) contributes behaviour and ARIA only; the host
 * (the Button.Root that renders the element) keeps its `data-scope`,
 * `data-part`, state and paint.
 *
 * sigx's own `mergeProps` chains handlers and refs but is last-wins on every
 * plain key: it cannot drop anatomy, join IDREF lists or gate handlers, so
 * zero merges with this. It is for component AUTHORS — a host calls it on
 * its `lend` prop and its own bag; an app never does (it writes `lend={p}`).
 *
 * DOM-free at runtime and in its types, so the DOM-less contract entry
 * (`contract/core.ts`) exports it too.
 */
import { DOMAIN_FLAG_PREFIX, FLAG_VOCABULARY } from './data-attrs.js';
import { MOD_ATTR_PREFIX, VARIANT_AXES } from './variant-attrs.js';

/**
 * A lent bag: any part's asChild bag. Structural rather than `PartProps` so
 * this module names no DOM type; a `PartProps` is assignable to it.
 */
export type LentBag = { 'data-scope': string; 'data-part': string } & Record<string, unknown>;

/**
 * `LAYOUT_ATTR_PREFIX`, restated for `html-attrs.ts`'s reason: importing
 * `layout-attrs.ts` drags its vocabulary table into every host.
 * `merge-part-props.test.ts`'s row-3 case (keyed off the real constant)
 * holds the two honest.
 */
const LAYOUT_PREFIX = 'data-l-';

/** Runtime-written anatomy: the host writes its own, the lender's is dropped. */
const DROPPED: ReadonlySet<string> = new Set([
    'data-scope',
    'data-part',
    'data-state',
    'data-orientation',
    'data-placement',
    'data-visually-hidden',
    'data-autosize',
    ...FLAG_VOCABULARY.map((flag) => `data-${flag}`),
]);

/** Paint the app set on the lender — it belongs on the element that renders. */
const PAINT: ReadonlySet<string> = new Set(Object.values(VARIANT_AXES));
const isPaint = (key: string): boolean =>
    PAINT.has(key) || key.startsWith(MOD_ATTR_PREFIX) || key.startsWith(LAYOUT_PREFIX);

/** The IDREF-list ARIA attributes: both sides' tokens survive. */
const IDREF_LISTS: ReadonlySet<string> = new Set([
    'aria-describedby',
    'aria-labelledby',
    'aria-controls',
    'aria-owns',
    'aria-details',
    'aria-flowto',
]);

/** The events an inert host must not hand to its lender. */
const ACTIVATION: ReadonlySet<string> = new Set(['click', 'auxclick', 'keydown', 'contextmenu']);

type Handler = (...args: unknown[]) => unknown;
type RefLike = ((el: unknown) => void) | { current: unknown };

const isHandlerKey = (key: string, value: unknown): value is Handler =>
    key.length > 2 && key.startsWith('on') && typeof value === 'function';

const isRef = (value: unknown): value is RefLike =>
    typeof value === 'function' || (typeof value === 'object' && value !== null && 'current' in value);

const setRef = (ref: RefLike, el: unknown): void => {
    if (typeof ref === 'function') ref(el);
    else ref.current = el;
};

/**
 * Chained refs, cached per (lender ref, host ref) pair: two stable refs merge
 * to a stable chained ref. sigx patches a CHANGED ref as detach(null) +
 * attach(el), so a fresh chain per render would re-run both refs on every
 * host re-render (a virtual list's viewport observer, say).
 */
const chainedRefs = new WeakMap<object, WeakMap<object, (el: unknown) => void>>();
const chainRefs = (lent: RefLike, mine: RefLike): ((el: unknown) => void) => {
    let byMine = chainedRefs.get(lent);
    if (!byMine) chainedRefs.set(lent, byMine = new WeakMap());
    let chained = byMine.get(mine);
    if (!chained) {
        chained = (el: unknown) => { setRef(lent, el); setRef(mine, el); };
        byMine.set(mine, chained);
    }
    return chained;
};

const isInert = (own: Record<string, unknown>): boolean =>
    own['aria-disabled'] === 'true' || own['aria-disabled'] === true
    || own['data-disabled'] !== undefined
    || !!own.disabled;

const tokens = (value: unknown): string[] =>
    typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : [];

/**
 * Merge a lent part's bag (`outer`) into the host's own props (`own`). The
 * host renders the result on its element.
 *
 * - `outer` undefined: `own`, unchanged (the same object).
 * - Anatomy the runtime writes (`data-scope`/`part`/`state`/`orientation`/
 *   `placement`, every flag, every domain flag `data-x-*`,
 *   `data-visually-hidden`, `data-autosize`):
 *   dropped. Paint set on the lender (`data-color`/`size`/`variant`,
 *   `data-mod-*`, `data-l-*`) throws — set it on the host. Any other lender
 *   `data-*` is dropped; `hidden` on the lender throws.
 * - Handlers chain, lender first, grouped case-insensitively by event. While
 *   the host is inert (`aria-disabled`, `data-disabled`, `disabled`) the
 *   lender's click/auxclick/keydown/contextmenu are skipped; focus, blur and
 *   pointer handlers still run.
 * - `ref` chains, lender first; the same two refs always give the same
 *   chained ref, so stable refs stay stable across re-renders. IDREF-list ARIA joins, lender tokens first.
 * - `id`, `role` and other `aria-*`: the host's, else the lender's; both set
 *   and different throws. `tabIndex`: the lower of two numbers.
 * - `class` concatenates; any other key: the host's when it has the key
 *   (even as `undefined`, as a spread would), else the lender's.
 */
export function mergePartProps<T extends Record<string, unknown>>(outer: LentBag | undefined, own: T): T {
    if (outer === undefined) return own;
    if (typeof outer['data-scope'] !== 'string' || typeof outer['data-part'] !== 'string') {
        throw new Error('[zero] lend: expected a part\'s asChild bag (data-scope and data-part missing)');
    }
    const lender = `${outer['data-scope']}.${outer['data-part']}`;
    const inert = isInert(own);
    const out: Record<string, unknown> = { ...own };

    // Handlers, grouped by lower-cased event name: [key to emit, lender fns, host fns].
    const groups = new Map<string, { key: string; lent: Handler[]; mine: Handler[] }>();
    const group = (key: string): { key: string; lent: Handler[]; mine: Handler[] } => {
        const event = key.slice(2).toLowerCase();
        let g = groups.get(event);
        if (!g) groups.set(event, g = { key, lent: [], mine: [] });
        return g;
    };
    for (const key of Object.keys(own)) {
        const value = own[key];
        if (isHandlerKey(key, value)) {
            group(key).mine.push(value);
            delete out[key];
        }
    }

    for (const key of Object.keys(outer)) {
        const value = outer[key];

        if (key.startsWith('data-')) {
            // A domain flag (`data-x-*`, #457) is the lender's own runtime
            // anatomy, like its shared flags: the host writes its own.
            if (DROPPED.has(key) || key.startsWith(DOMAIN_FLAG_PREFIX)) continue;
            if (isPaint(key)) {
                if (value === undefined) continue;
                throw new Error(`[zero] ${key} on the lent ${lender} — set it on the host`);
            }
            continue;
        }
        if (key === 'hidden') {
            if (value === undefined || value === false) continue;
            throw new Error(`[zero] hidden on the lent ${lender} — hide the host`);
        }
        if (isHandlerKey(key, value)) {
            const g = group(key);
            if (!(inert && ACTIVATION.has(key.slice(2).toLowerCase()))) g.lent.push(value);
            continue;
        }
        if (key === 'ref') {
            const mine = own.ref;
            if (!isRef(value)) continue;
            out.ref = isRef(mine) ? chainRefs(value, mine) : value;
            continue;
        }
        if (IDREF_LISTS.has(key)) {
            const joined = [...new Set([...tokens(value), ...tokens(own[key])])].join(' ');
            if (joined) out[key] = joined;
            else delete out[key];
            continue;
        }
        if (key === 'id' || key === 'role' || key.startsWith('aria-')) {
            const mine = own[key];
            if (mine === undefined) {
                if (value !== undefined) out[key] = value;
            } else if (value !== undefined && String(value) !== String(mine)) {
                throw new Error(`[zero] ${key}: the host says "${String(mine)}", the lent ${lender} "${String(value)}"`);
            }
            continue;
        }
        if (key === 'tabIndex') {
            const mine = own.tabIndex;
            if (typeof mine === 'number' && typeof value === 'number') out.tabIndex = Math.min(mine, value);
            else if (mine === undefined && value !== undefined) out.tabIndex = value;
            continue;
        }
        if (key === 'class') {
            const joined = [value, own.class].filter((c) => typeof c === 'string' && c !== '').join(' ');
            if (joined) out.class = joined;
            continue;
        }
        if (!(key in own)) out[key] = value;
    }

    for (const { key, lent, mine } of groups.values()) {
        const all = [...lent, ...mine];
        if (all.length === 0) continue;
        out[key] = all.length === 1
            ? all[0]
            : (...args: unknown[]) => { for (const fn of all) fn(...args); };
    }
    return out as T;
}
