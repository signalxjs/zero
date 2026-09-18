/**
 * Timeline — events along an axis.
 *
 * ```tsx
 * <Timeline.Root>
 *     <Timeline.Item>
 *         <Timeline.Marker />
 *         <Timeline.Content>v1.0 shipped</Timeline.Content>
 *         <Timeline.Connector />
 *     </Timeline.Item>
 *     <Timeline.Item>
 *         <Timeline.Marker>★</Timeline.Marker>
 *         <Timeline.Content placement="start">v2.0 shipped</Timeline.Content>
 *     </Timeline.Item>
 * </Timeline.Root>
 * ```
 *
 * Vertical by default — a feed of events grows downward; the horizontal
 * process strip is the variant. Marker and connector are `aria-hidden`
 * decoration: the reader gets each event from the content text, and hearing
 * "star" between two of them is noise, not information.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import type { Orientation } from '../../contract/data-attrs.js';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithOrientation, WithVariantAxes } from '../../contract/props.js';
import { timelineAnatomy } from './anatomy.js';

const SCOPE = timelineAnatomy.scope;

/** Which side of the axis a content box sits on — the logical pair. */
export type TimelinePlacement = 'start' | 'end';

interface TimelineContext {
    orientation(): Orientation;
}

export const useTimelineContext = defineInjectable<TimelineContext>(() => ({
    orientation: () => 'vertical',
}));

export type TimelineRootProps =
    & WithOrientation
    & WithVariantAxes<'timeline'>
    & WithClass
    & Define.Slot<'default'>;

const TimelineRoot = component<TimelineRootProps>(({ props, slots }) => {
    const orientation = (): Orientation => props.orientation ?? 'vertical';
    defineProvide(useTimelineContext, () => ({ orientation }));
    return () => (
        <ul
            data-scope={SCOPE}
            data-part="root"
            data-orientation={orientation()}
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
        </ul>
    );
}, { name: 'Timeline.Root' });

export type TimelinePartProps = WithClass & Define.Slot<'default'>;

const TimelineItem = component<TimelinePartProps>(({ props, slots }) => {
    const timeline = useTimelineContext();
    return () => (
        <li
            data-scope={SCOPE}
            data-part="item"
            data-orientation={timeline.orientation()}
            class={props.class}
        >
            {slots.default?.()}
        </li>
    );
}, { name: 'Timeline.Item' });

const TimelineMarker = component<TimelinePartProps>(({ props, slots }) => {
    return () => (
        <div
            aria-hidden="true"
            data-scope={SCOPE}
            data-part="marker"
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Timeline.Marker' });

const TimelineConnector = component<WithClass>(({ props }) => {
    const timeline = useTimelineContext();
    return () => (
        <div
            aria-hidden="true"
            data-scope={SCOPE}
            data-part="connector"
            data-orientation={timeline.orientation()}
            class={props.class}
        />
    );
}, { name: 'Timeline.Connector' });

export type TimelineContentProps =
    & Define.Prop<'placement', TimelinePlacement, false>
    & WithClass
    & Define.Slot<'default'>;

const TimelineContent = component<TimelineContentProps>(({ props, slots }) => {
    const timeline = useTimelineContext();
    return () => (
        <div
            data-scope={SCOPE}
            data-part="content"
            data-placement={props.placement ?? 'end'}
            data-orientation={timeline.orientation()}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Timeline.Content' });

export const Timeline = compound(TimelineRoot, {
    Root: TimelineRoot,
    Item: TimelineItem,
    Marker: TimelineMarker,
    Connector: TimelineConnector,
    Content: TimelineContent,
});
