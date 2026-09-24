/**
 * Give a mount hook's effects the component's lifetime.
 *
 * sigx ties the effects a component creates *during setup* to that
 * component and stops them on unmount. A mount hook runs later, with no
 * collection scope active, so an `effect()` created inside `onMounted` is
 * owned by nobody: it outlives the part, stays subscribed to whatever state
 * survives it (a root's model, a toaster) and re-runs a dead closure on every
 * write (#163).
 *
 * Call `mountScope()` during setup — the effect scope it creates is itself a
 * setup reaction, so the component stops it on unmount — then run the mount
 * hook's reactive work through it:
 *
 * ```ts
 * const scoped = mountScope();
 * onMounted(() => scoped(() => {
 *     effect(() => sync(el, state.value));
 * }));
 * ```
 *
 * Everything the callback creates synchronously (`effect`, `watch`, a nested
 * scope) stops with the component. Platform-neutral: no DOM.
 */
import { effectScope } from 'sigx';

export function mountScope(): <T>(fn: () => T) => T | undefined {
    const scope = effectScope();
    return (fn) => scope.run(fn);
}
