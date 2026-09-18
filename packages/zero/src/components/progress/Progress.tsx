/**
 * Progress — determinate/indeterminate progress bar.
 *
 * ```tsx
 * <Progress.Root value={62}>
 *     <Progress.Label>Uploading…</Progress.Label>
 *     <Progress.Track><Progress.Range /></Progress.Track>
 *     <Progress.ValueText />
 * </Progress.Root>
 * ```
 *
 * Display-only (no model): the `value` prop drives `role="progressbar"`
 * aria values and the range width custom property `--progress-percent`.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { createId } from '../../behaviors/create-id.js';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithVariantAxes } from '../../contract/props.js';
import { progressAnatomy } from './anatomy.js';

const SCOPE = progressAnatomy.scope;

interface ProgressContext {
    value(): number | null;
    min(): number;
    max(): number;
    percent(): number | null;
    state(): 'loading' | 'complete' | 'indeterminate';
    ids: { label: string };
}

function makeInert(): ProgressContext {
    return {
        value: () => null,
        min: () => 0,
        max: () => 100,
        percent: () => null,
        state: () => 'indeterminate',
        ids: { label: 'zx-progress-inert' },
    };
}

export const useProgressContext = defineInjectable<ProgressContext>(() => makeInert());

export type ProgressRootProps =
    & Define.Prop<'value', number | null, false>
    & Define.Prop<'min', number, false>
    & Define.Prop<'max', number, false>
    & WithVariantAxes<'progress'>
    & WithClass
    & Define.Slot<'default'>;

const ProgressRoot = component<ProgressRootProps>(({ props, slots }) => {
    const baseId = createId('zx-progress');
    const min = () => props.min ?? 0;
    const max = () => props.max ?? 100;
    const value = () => props.value ?? null;
    const percent = (): number | null => {
        const v = value();
        if (v == null) return null;
        // A degenerate range (max <= min) has nothing left to fill: any
        // present value reads as done, and the guard keeps NaN/Infinity out
        // of `--progress-percent`. Mirrored in RadialProgress (#334) — the
        // shared value model includes its edge cases.
        const span = max() - min();
        if (!(span > 0)) return 100;
        return Math.min(100, Math.max(0, ((v - min()) / span) * 100));
    };
    const ctx: ProgressContext = {
        value,
        min,
        max,
        percent,
        state: () => {
            const p = percent();
            if (p == null) return 'indeterminate';
            return p >= 100 ? 'complete' : 'loading';
        },
        ids: { label: `${baseId}-label` },
    };
    defineProvide(useProgressContext, () => ctx);

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
}, { name: 'Progress.Root' });

export type ProgressLabelProps = WithClass & Define.Slot<'default'>;

const ProgressLabel = component<ProgressLabelProps>(({ props, slots }) => {
    const progress = useProgressContext();
    return () => (
        <div id={progress.ids.label} data-scope={SCOPE} data-part="label" class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'Progress.Label' });

export type ProgressTrackProps = WithClass & Define.Slot<'default'>;

const ProgressTrack = component<ProgressTrackProps>(({ props, slots }) => {
    return () => (
        <div data-scope={SCOPE} data-part="track" class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'Progress.Track' });

export type ProgressRangeProps = WithClass;

const ProgressRange = component<ProgressRangeProps>(({ props }) => {
    const progress = useProgressContext();
    return () => (
        <div
            data-scope={SCOPE}
            data-part="range"
            data-state={progress.state()}
            style={progress.percent() != null ? { width: `${progress.percent()}%` } : undefined}
            class={props.class}
        />
    );
}, { name: 'Progress.Range' });

export type ProgressValueTextProps = WithClass & Define.Slot<'default'>;

const ProgressValueText = component<ProgressValueTextProps>(({ props, slots }) => {
    const progress = useProgressContext();
    return () => (
        <div data-scope={SCOPE} data-part="value-text" class={props.class}>
            {slots.default?.() ?? (progress.value() != null ? `${Math.round(progress.percent()!)}%` : null)}
        </div>
    );
}, { name: 'Progress.ValueText' });

export const Progress = compound(ProgressRoot, {
    Root: ProgressRoot,
    Label: ProgressLabel,
    Track: ProgressTrack,
    Range: ProgressRange,
    ValueText: ProgressValueText,
});
