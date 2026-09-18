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
import { createId } from '../../behaviors/create-id.js';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithVariantAxes } from '../../contract/props.js';
import { radialProgressAnatomy } from './anatomy.js';

const SCOPE = radialProgressAnatomy.scope;

interface RadialProgressContext {
    value(): number | null;
    percent(): number | null;
    state(): 'loading' | 'complete' | 'indeterminate';
    ids: { label: string };
}

function makeInert(): RadialProgressContext {
    return {
        value: () => null,
        percent: () => null,
        state: () => 'indeterminate',
        ids: { label: 'zx-radial-progress-inert' },
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
    & Define.Slot<'default'>;

const RadialProgressRoot = component<RadialProgressRootProps>(({ props, slots }) => {
    const baseId = createId('zx-radial-progress');
    const min = () => props.min ?? 0;
    const max = () => props.max ?? 100;
    const value = () => props.value ?? null;
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
    };
    defineProvide(useRadialProgressContext, () => ctx);

    return () => (
        <div
            role="progressbar"
            data-scope={SCOPE}
            data-part="root"
            data-state={ctx.state()}
            aria-valuemin={min()}
            aria-valuemax={max()}
            aria-valuenow={value() ?? undefined}
            aria-labelledby={ctx.ids.label}
            style={percent() != null ? { '--progress-percent': `${percent()}%` } : undefined}
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'RadialProgress.Root' });

export type RadialProgressLabelProps = WithClass & Define.Slot<'default'>;

const RadialProgressLabel = component<RadialProgressLabelProps>(({ props, slots }) => {
    const radial = useRadialProgressContext();
    return () => (
        <div id={radial.ids.label} data-scope={SCOPE} data-part="label" class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'RadialProgress.Label' });

export type RadialProgressValueTextProps = WithClass & Define.Slot<'default'>;

const RadialProgressValueText = component<RadialProgressValueTextProps>(({ props, slots }) => {
    const radial = useRadialProgressContext();
    return () => (
        <div data-scope={SCOPE} data-part="value-text" class={props.class}>
            {slots.default?.() ?? (radial.value() != null ? `${Math.round(radial.percent()!)}%` : null)}
        </div>
    );
}, { name: 'RadialProgress.ValueText' });

export const RadialProgress = compound(RadialProgressRoot, {
    Root: RadialProgressRoot,
    Label: RadialProgressLabel,
    ValueText: RadialProgressValueText,
});
