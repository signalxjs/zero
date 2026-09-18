/**
 * Stats — figures with their labels, in a row or a column.
 *
 * ```tsx
 * <Stats.Root>
 *     <Stats.Item>
 *         <Stats.Figure><RevenueIcon /></Stats.Figure>
 *         <Stats.Title>Total revenue</Stats.Title>
 *         <Stats.Value>$12,930</Stats.Value>
 *         <Stats.Desc>+8% month over month</Stats.Desc>
 *     </Stats.Item>
 * </Stats.Root>
 * ```
 *
 * No behavior and no ARIA — see `anatomy.ts`. The one piece of wiring is
 * orientation: the root provides it and every item mirrors it, because the
 * between-item divider is directional CSS on the item and a sibling selector
 * cannot see the root.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import type { Orientation } from '../../contract/data-attrs.js';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithOrientation, WithVariantAxes } from '../../contract/props.js';
import { statsAnatomy } from './anatomy.js';

const SCOPE = statsAnatomy.scope;

interface StatsContext {
    orientation(): Orientation;
}

export const useStatsContext = defineInjectable<StatsContext>(() => ({
    orientation: () => 'horizontal',
}));

export type StatsRootProps =
    & WithOrientation
    & WithVariantAxes<'stats'>
    & WithClass
    & Define.Slot<'default'>;

const StatsRoot = component<StatsRootProps>(({ props, slots }) => {
    const orientation = (): Orientation => props.orientation ?? 'horizontal';
    defineProvide(useStatsContext, () => ({ orientation }));
    return () => (
        <div
            data-scope={SCOPE}
            data-part="root"
            data-orientation={orientation()}
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Stats.Root' });

export type StatsPartProps = WithClass & Define.Slot<'default'>;

const StatsItem = component<StatsPartProps>(({ props, slots }) => {
    const stats = useStatsContext();
    return () => (
        <div
            data-scope={SCOPE}
            data-part="item"
            data-orientation={stats.orientation()}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Stats.Item' });

const band = (partName: 'title' | 'value' | 'desc' | 'figure', name: string) =>
    component<StatsPartProps>(({ props, slots }) => {
        return () => (
            <div data-scope={SCOPE} data-part={partName} class={props.class}>
                {slots.default?.()}
            </div>
        );
    }, { name });

const StatsTitle = band('title', 'Stats.Title');
const StatsValue = band('value', 'Stats.Value');
const StatsDesc = band('desc', 'Stats.Desc');
const StatsFigure = band('figure', 'Stats.Figure');

export const Stats = compound(StatsRoot, {
    Root: StatsRoot,
    Item: StatsItem,
    Title: StatsTitle,
    Value: StatsValue,
    Desc: StatsDesc,
    Figure: StatsFigure,
});
