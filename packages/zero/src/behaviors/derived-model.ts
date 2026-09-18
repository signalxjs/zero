/**
 * A Model over a read/write pair — the binding law's mechanism for a native
 * control that binds a PROJECTION of the component's state rather than the
 * state itself: a slider's scalar over a `number | number[]` model, a number
 * input's draft text over a `number | null` one. The control takes it as
 * `model=` and sigx's platform processor owns the write-back, exactly as for
 * the state itself (`createControllableState` is this over its own read and
 * guarded write).
 *
 * One write path: the tuple is `[holder, 'value']` where `holder.value`'s
 * setter IS the handler, so whichever route sigx takes — the processor's
 * direct `obj[key] = v` on an intrinsic element, or the handler on a
 * component boundary — lands in `write`.
 */
import { createModel } from 'sigx';
import type { Model } from 'sigx';

export function derivedModel<T>(read: () => T, write: (value: T) => void): Model<T> {
    const holder = {
        get value(): T { return read(); },
        set value(v: T) { write(v); },
    };
    return createModel<T>([holder, 'value'], write);
}
