/**
 * `modelModifiers` pass-through for components that render a native control.
 *
 * sigx splits a modifier into a value TRANSFORM (`trim`, `number`, custom —
 * applied at the write-back boundary) and a TIMING hint (`lazy`, `debounce` —
 * mapped by the platform onto the element's own events). A component
 * boundary already applies the transforms (sigx wraps the parent's Model
 * handler; `createControllableState` covers the uncontrolled case), so the
 * inner element must receive ONLY the timing keys: forwarding `trim` too
 * would run it twice, and the DOM platform warns about transform keys on a
 * toggle element anyway.
 *
 * The split is looked up in sigx's modifier registry rather than hardcoded,
 * so a custom timing modifier registered by the app is honoured too.
 */
import type { ModelModifiers } from 'sigx';
import { getModelModifier } from '@sigx/runtime-core/internals';

export function timingModifiers(modifiers: ModelModifiers | undefined): ModelModifiers | undefined {
    if (!modifiers) return undefined;
    let out: Record<string, unknown> | undefined;
    for (const key of Object.keys(modifiers)) {
        const option = (modifiers as Record<string, unknown>)[key];
        // sigx's own absence test (resolveTiming / applyModelTransforms):
        // `false` and nullish mean unset; `0` is a real zero-millisecond debounce.
        if (option === false || option == null) continue;
        if (getModelModifier(key)?.timing) (out ??= {})[key] = option;
    }
    return out as ModelModifiers | undefined;
}
