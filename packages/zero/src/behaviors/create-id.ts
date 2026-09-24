/**
 * SSR-safe id generation.
 *
 * Aria wiring (`aria-controls`, `aria-labelledby`, …) needs ids that are
 * unique per app AND deterministic between the server render and client
 * hydration. A module-global counter breaks both: it leaks across SSR
 * requests and drifts between server and client. The generator therefore
 * lives behind DI:
 *
 * - Client-only apps: the injectable's fallback singleton is fine — ids just
 *   need uniqueness.
 * - SSR apps install `zeroPlugin()` (`app.use(zeroPlugin())`) in the app
 *   factory that runs per request, so counters reset per request and setup
 *   order makes server and client agree.
 */
import { defineInjectable } from 'sigx';
import type { Plugin } from 'sigx';

export interface IdGenerator {
    next(prefix: string): string;
}

function makeGenerator(): IdGenerator {
    let n = 0;
    return { next: (prefix) => `${prefix}-${++n}` };
}

/** Inject the app's id generator (falls back to a shared singleton). */
export const useIdGenerator = defineInjectable<IdGenerator>(() => makeGenerator());

/**
 * Create a stable unique id. Call during component setup; the id is stable
 * for the life of the component instance.
 */
export function createId(prefix = 'zx'): string {
    return useIdGenerator().next(prefix);
}

const ID_SAFE = /[A-Za-z0-9-]/;

/**
 * Encode a string (a tab's `value`, a collection key) into a token
 * that is safe inside a DOM id. HTML ids must not contain whitespace, and the
 * IDREFS attributes that point at them (`aria-controls`, `aria-labelledby`)
 * split on whitespace — so `tab-New York` names two ids that do not exist.
 *
 * ASCII letters, digits and `-` pass through unchanged (so `apple` stays
 * `apple`); every other code point — `_` included, since it is the escape —
 * becomes `_<hex>_`. The mapping is injective over strings: `New York` →
 * `New_20_York` and `New_York` → `New_5f_York` never collide, so two
 * distinct values never share an id. The result is also a valid CSS identifier tail, so a
 * `#${id}` selector needs no escaping.
 *
 * Build BOTH sides of a reference with it — the element's `id` and every
 * attribute naming it — or they drift apart.
 */
export function idToken(value: string): string {
    let out = '';
    for (const ch of value) {
        out += ID_SAFE.test(ch) ? ch : `_${ch.codePointAt(0)!.toString(16)}_`;
    }
    return out;
}

/**
 * App plugin providing a per-app id generator. Required for SSR (call in the
 * per-request app factory); harmless everywhere else.
 *
 * ```ts
 * app.use(zeroPlugin());
 * ```
 */
export function zeroPlugin(): Plugin {
    return {
        name: 'zero',
        install(app) {
            app.defineProvide(useIdGenerator, makeGenerator);
        },
    };
}
