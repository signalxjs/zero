/**
 * RadialProgress — determinate/indeterminate circular progress.
 *
 * ```tsx
 * <RadialProgress.Root value={62}>
 *     <RadialProgress.Label>Upload</RadialProgress.Label>
 *     <RadialProgress.ValueText />
 * </RadialProgress.Root>
 * ```
 *
 * Progress's value model on a radial anatomy — see `anatomy.ts` for why it
 * is its own scope. Display-only (no model): `value` drives the
 * `role="progressbar"` aria values and `--progress-percent`, which recipes
 * turn into the arc (conic-gradient masks). Children render centred in the
 * ring's eye by every recipe, which is where the value text lives.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { countPresence, reportPresence } from '../../behaviors/part-presence.js';
import { createId } from '../../behaviors/create-id.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { WithClass, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { radialProgressAnatomy } from './anatomy.js';

const SCOPE = radialProgressAnatomy.scope;

interface RadialProgressContext {
    value(): number | null;
    percent(): number | null;
    state(): 'loading' | 'complete' | 'indeterminate';
    ids: { label: string };
    /** Label reports its presence so the root's reference never dangles (#169). */
    setLabelPresent(present: boolean): void;
}

function makeInert(): RadialProgressContext {
    return {
        value: () => null,
        percent: () => null,
        state: () => 'indeterminate',
        ids: { label: 'zx-radial-progress-inert' },
        setLabelPresent: () => {},
    };
}

export const useRadialProgressContext =
    defineInjectable<RadialProgressContext>(() => makeInert());

export type RadialProgressRootProps =
    & Define.Prop<'value', number | null, false>
    & Define.Prop<'min', number, false>
    & Define.Prop<'max', number, false>
    & WithVariantAxes<'radial-progress'>
    & WithClass
    /**
     * Not `role`: the root is the `progressbar`. An app `aria-labelledby`
     * joins the Label's rather than replacing it.
     */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Slot<'default'>;

const RadialProgressRoot = component<RadialProgressRootProps>(({ props, slots, signal }) => {
    const baseId = createId('zx-radial-progress');
    const min = () => props.min ?? 0;
    const max = () => props.max ?? 100;
    const value = () => props.value ?? null;
    // Reported by the Label (`reportPresence`): the root references it only
    // while it is actually rendered.
    const present = signal({ label: 0 });
    // aria-valuenow must sit inside [aria-valuemin, aria-valuemax] (#169).
    const valueNow = (): number | undefined => {
        const v = value();
        return v == null ? undefined : Math.min(max(), Math.max(min(), v));
    };
    const percent = (): number | null => {
        const v = value();
        if (v == null) return null;
        // A degenerate range (max <= min) has nothing left to fill: any
        // present value reads as done, and the guard keeps NaN/Infinity out
        // of `--progress-percent` and the value text. Mirrored in Progress —
        // the shared value model includes its edge cases.
        const span = max() - min();
        if (!(span > 0)) return 100;
        return Math.min(100, Math.max(0, ((v - min()) / span) * 100));
    };
    const ctx: RadialProgressContext = {
        value,
        percent,
        state: () => {
            const p = percent();
            if (p == null) return 'indeterminate';
            return p >= 100 ? 'complete' : 'loading';
        },
        ids: { label: `${baseId}-label` },
        setLabelPresent: (p) => { present.label = countPresence(present.label, p); },
    };
    defineProvide(useRadialProgressContext, () => ctx);

    return () => {
        const attrs = htmlAttrs(props);
        return (
            <div
                {...attrs}
                role="progressbar"
                data-scope={SCOPE}
                data-part="root"
                data-state={ctx.state()}
                aria-valuemin={min()}
                aria-valuemax={max()}
                aria-valuenow={valueNow()}
                aria-labelledby={[
                    present.label > 0 ? ctx.ids.label : undefined,
                    attrs['aria-labelledby'],
                ].filter(Boolean).join(' ') || undefined}
                style={percent() != null ? { '--progress-percent': `${percent()}%` } : undefined}
                {...variantAttrs(props)}
                class={props.class}
            >
                {slots.default?.()}
            </div>
        );
    };
}, { name: 'RadialProgress.Root' });

/** Not `id`: the root is labelled by the Label's own. */
export type RadialProgressLabelProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const RadialProgressLabel = component<RadialProgressLabelProps>(({ props, slots, onUnmounted }) => {
    const radial = useRadialProgressContext();
    reportPresence(radial.setLabelPresent, onUnmounted);
    return () => (
        <div {...htmlAttrs(props)} id={radial.ids.label} data-scope={SCOPE} data-part="label" class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'RadialProgress.Label' });

export type RadialProgressValueTextProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

const RadialProgressValueText = component<RadialProgressValueTextProps>(({ props, slots }) => {
    const radial = useRadialProgressContext();
    return () => (
        <div {...htmlAttrs(props)} data-scope={SCOPE} data-part="value-text" class={props.class}>
            {slots.default?.() ?? (radial.value() != null ? `${Math.round(radial.percent()!)}%` : null)}
        </div>
    );
}, { name: 'RadialProgress.ValueText' });

export const RadialProgress = compound(RadialProgressRoot, {
    Root: RadialProgressRoot,
    Label: RadialProgressLabel,
    ValueText: RadialProgressValueText,
});
