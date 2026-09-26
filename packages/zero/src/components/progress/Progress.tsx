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
 * `aria-valuetext` and the default `ValueText` share one formatted string
 * (`getValueText` / `locale` / `formatOptions` — see `value-text.ts`), so
 * what is announced is what is shown.
 */
import { component, compound, computed, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { countPresence, reportPresence, settleAfterMount } from '../../behaviors/part-presence.js';
import { createId } from '../../behaviors/create-id.js';
import { progressValueText, type WithProgressValueText } from './value-text.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { WithClass, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { progressAnatomy } from './anatomy.js';

const SCOPE = progressAnatomy.scope;

interface ProgressContext {
    value(): number | null;
    min(): number;
    max(): number;
    percent(): number | null;
    /** The announced and shown value text; `undefined` while indeterminate (#274). */
    valueText(): string | undefined;
    state(): 'loading' | 'complete' | 'indeterminate';
    ids: { label: string };
    /** Label reports its presence so the root's reference never dangles (#169). */
    setLabelPresent(present: boolean): void;
}

function makeInert(): ProgressContext {
    return {
        value: () => null,
        min: () => 0,
        max: () => 100,
        percent: () => null,
        valueText: () => undefined,
        state: () => 'indeterminate',
        ids: { label: 'zx-progress-inert' },
        setLabelPresent: () => {},
    };
}

export const useProgressContext = defineInjectable<ProgressContext>(() => makeInert());

export type ProgressRootProps =
    & Define.Prop<'value', number | null, false>
    & Define.Prop<'min', number, false>
    & Define.Prop<'max', number, false>
    & WithProgressValueText
    & WithVariantAxes<'progress'>
    & WithClass
    /**
     * Not `role`: the root is the `progressbar`. An app `aria-labelledby`
     * joins the Label's rather than replacing it.
     */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Slot<'default'>;

const ProgressRoot = component<ProgressRootProps>(({ props, slots, signal, onMounted }) => {
    const baseId = createId('zx-progress');
    const min = () => props.min ?? 0;
    const max = () => props.max ?? 100;
    const value = () => props.value ?? null;
    // Reported by the Label (`reportPresence`): the root references it only
    // while it is actually rendered — optimistic until settled after mount,
    // so server markup keeps the reference a composed bar needs.
    const present = signal({ label: 0, settled: false });
    settleAfterMount(onMounted, () => { present.settled = true; });
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
        // of `--progress-percent`. Mirrored in RadialProgress (#334) — the
        // shared value model includes its edge cases.
        const span = max() - min();
        if (!(span > 0)) return 100;
        return Math.min(100, Math.max(0, ((v - min()) / span) * 100));
    };
    // One formatted string per update: the root's aria-valuetext and the
    // default ValueText both read it, so a custom `getValueText` (or the
    // Intl.NumberFormat) runs once, not once per reader.
    const valueText = computed(() => progressValueText(props, valueNow(), percent(), min(), max()));
    const ctx: ProgressContext = {
        value,
        min,
        max,
        percent,
        valueText: () => valueText.value,
        state: () => {
            const p = percent();
            if (p == null) return 'indeterminate';
            return p >= 100 ? 'complete' : 'loading';
        },
        ids: { label: `${baseId}-label` },
        setLabelPresent: (p) => { present.label = countPresence(present.label, p); },
    };
    defineProvide(useProgressContext, () => ctx);

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
                aria-valuetext={ctx.valueText()}
                aria-labelledby={[
                    !present.settled || present.label > 0 ? ctx.ids.label : undefined,
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
}, { name: 'Progress.Root' });

/** Not `id`: the root is labelled by the Label's own. */
export type ProgressLabelProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const ProgressLabel = component<ProgressLabelProps>(({ props, slots, onUnmounted }) => {
    const progress = useProgressContext();
    reportPresence(progress.setLabelPresent, onUnmounted);
    return () => (
        <div {...htmlAttrs(props)} id={progress.ids.label} data-scope={SCOPE} data-part="label" class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'Progress.Label' });

export type ProgressTrackProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

const ProgressTrack = component<ProgressTrackProps>(({ props, slots }) => {
    return () => (
        <div {...htmlAttrs(props)} data-scope={SCOPE} data-part="track" class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'Progress.Track' });

export type ProgressRangeProps = WithClass & WithHtmlAttrs;

const ProgressRange = component<ProgressRangeProps>(({ props }) => {
    const progress = useProgressContext();
    return () => (
        <div
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="range"
            data-state={progress.state()}
            style={progress.percent() != null ? { width: `${progress.percent()}%` } : undefined}
            class={props.class}
        />
    );
}, { name: 'Progress.Range' });

export type ProgressValueTextProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

const ProgressValueText = component<ProgressValueTextProps>(({ props, slots }) => {
    const progress = useProgressContext();
    return () => (
        <div {...htmlAttrs(props)} data-scope={SCOPE} data-part="value-text" class={props.class}>
            {slots.default?.() ?? progress.valueText() ?? null}
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
