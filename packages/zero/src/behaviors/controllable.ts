/**
 * Controllable state — the zero standard for stateful components, and the
 * binding law in one function.
 *
 * One optional `model` prop (sigx two-way binding) replaces the
 * controlled/uncontrolled `value`/`defaultValue`/`onChange` triplet:
 *
 * - `model` present → the parent's signal is the source of truth
 *   (`<Dialog.Root model={() => state.open}>` is fully controlled, zero wiring).
 * - `model` absent → an internal signal seeded from the `default*` prop.
 * - Every actual change fires `onChange` (→ the component's change event),
 *   in both modes.
 *
 * THE BINDING LAW: what this returns IS a sigx `Model<T>`, not a look-alike.
 * A component forwards it straight to the native control it renders —
 * `<input model={state}>` — and sigx's platform processor owns write-back
 * (text, textarea, boolean AND array checkboxes, radios, single and
 * `multiple` selects, the server's resting attributes). Zero never hand-wires
 * `value=`+`onInput` or `checked=`+`onChange` around a native control again;
 * doing so is exactly how `modelModifiers` timing, checkbox array mode and
 * `<select multiple>` went missing from every zero wrapper while a raw sigx
 * element had them for free.
 *
 * The mechanism is one write path. The Model's tuple is `[holder, 'value']`
 * where `holder.value`'s SETTER is the same function the Model's handler is,
 * so whichever route sigx takes — the processor's direct `obj[key] = v` on an
 * intrinsic element, or the handler on a component boundary — lands in the
 * same guard and the same emit.
 *
 * Modifiers: a consumer's `modelModifiers` on the component reach the parent's
 * Model handler in controlled mode (sigx wraps it, jsx-runtime), so the value
 * transforms already ran by the time `model.value = v` returns. Uncontrolled
 * there is no parent handler, so zero applies them here — once. Timing
 * (`lazy`/`debounce`) is an element concern; components forward it to the
 * element with `timingModifiers()` (`model-modifiers.ts`).
 */
import { signal } from 'sigx';
import type { Model, ModelModifiers } from 'sigx';
import { applyModelTransforms } from '@sigx/runtime-core/internals';
import { derivedModel } from './derived-model.js';

/** Historical alias — every zero state is a real sigx `Model`. */
export type ControllableState<T> = Model<T>;

export interface ControllableOptions {
    /**
     * The consumer's `modelModifiers`, read reactively. Value transforms
     * apply at the write in uncontrolled mode only; controlled mode leaves
     * them to the parent's handler, which sigx has already wrapped.
     */
    modifiers?: () => ModelModifiers | undefined;
}

export function createControllableState<T>(
    getModel: () => Model<T> | undefined,
    defaultValue: T,
    onChange?: (value: T) => void,
    opts?: ControllableOptions,
): Model<T> {
    const internal = signal({ current: defaultValue });

    const read = (): T => {
        const model = getModel();
        return model ? model.value : (internal.current as T);
    };

    const write = (next: T): void => {
        const model = getModel();
        const v = model ? next : (applyModelTransforms(next, opts?.modifiers?.()) as T);
        const prev = model ? model.value : (internal.current as T);
        if (Object.is(prev, v)) return;
        if (model) {
            model.value = v;
        } else {
            internal.current = v as typeof internal.current;
        }
        // What the model reads back, post any parent-side transform.
        onChange?.(model ? model.value : v);
    };

    return derivedModel(read, write);
}

/**
 * The inert-context seed: a standalone Model for the fallback a part sees
 * when rendered outside its Root. Replaces the hand-written
 * `{ get value, set value }` literals, which stopped type-checking the day
 * `ControllableState` became the real `Model`.
 */
export function createInertState<T>(initial: T): Model<T> {
    return createControllableState<T>(() => undefined, initial);
}

/**
 * Collapse a named model's type. `Define.Model<'open', boolean>` distributes
 * `boolean` into `Model<true> | Model<false>`, which `createControllableState`
 * cannot take; this is the one cast, named, instead of one per call site.
 */
export function namedModel<T>(model: unknown): Model<T> | undefined {
    return model as Model<T> | undefined;
}
