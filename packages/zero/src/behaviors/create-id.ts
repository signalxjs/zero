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
