/**
 * Countdown — display-only digits with a per-tick enter animation hook.
 *
 * ```tsx
 * <Countdown.Root label="Time remaining">
 *     <Countdown.Value value={minutes} digits={2} />
 *     :
 *     <Countdown.Value value={seconds} digits={2} />
 * </Countdown.Root>
 * ```
 *
 * The app owns time — there is no timer here (see `anatomy.ts` for why).
 * `digits` is keyed by the rendered value: each change replaces the
 * element, so a recipe's enter animation plays once per tick.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithVariantAxes } from '../../contract/props.js';
import { countdownAnatomy } from './anatomy.js';

const SCOPE = countdownAnatomy.scope;

export type CountdownRootProps =
    /** Optional accessible name; with one the root announces as a timer. */
    & Define.Prop<'label', string, false>
    & WithVariantAxes<'countdown'>
    & WithClass
    & Define.Slot<'default'>;

const CountdownRoot = component<CountdownRootProps>(({ props, slots }) => {
    return () => (
        <span
            data-scope={SCOPE}
            data-part="root"
            // role=timer only when named: an unlabelled group of digits is
            // already readable as text, and a nameless timer role is noise.
            role={props.label ? 'timer' : undefined}
            aria-label={props.label}
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
        </span>
    );
}, { name: 'Countdown.Root' });

export type CountdownValueProps =
    /** The number to display. Clamped at zero — a countdown never goes negative. */
    & Define.Prop<'value', number>
    /** Minimum digit count, zero-padded (`digits={2}` renders 7 as "07"). */
    & Define.Prop<'digits', number, false>
    & WithClass;

const CountdownValue = component<CountdownValueProps>(({ props }) => {
    return () => {
        const raw = Math.max(0, Math.floor(props.value ?? 0));
        const text = props.digits ? String(raw).padStart(props.digits, '0') : String(raw);
        return (
            <span
                data-scope={SCOPE}
                data-part="value"
                style={{ '--countdown-value': String(raw) }}
                class={props.class}
            >
                {/*
                  * Keyed by the text: a tick REPLACES the element, so a
                  * recipe's enter animation replays. Real text — AT reads
                  * the number, no aria mirror.
                  */}
                <span data-scope={SCOPE} data-part="digits" key={text}>
                    {text}
                </span>
            </span>
        );
    };
}, { name: 'Countdown.Value' });

export const Countdown = compound(CountdownRoot, {
    Root: CountdownRoot,
    Value: CountdownValue,
});
