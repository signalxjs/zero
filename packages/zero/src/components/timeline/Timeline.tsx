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
 *         <Timeline.Marker color="success">★</Timeline.Marker>
 *         <Timeline.Content placement="start">
 *             <Timeline.Title>v2.0 shipped</Timeline.Title>
 *             <Timeline.Description>The design-system rewrite.</Timeline.Description>
 *         </Timeline.Content>
 *     </Timeline.Item>
 * </Timeline.Root>
 * ```
 *
 * Vertical by default — a feed of events grows downward; the horizontal
 * process strip is the variant. Marker and connector are `aria-hidden`
 * decoration: the reader gets each event from the content text, and hearing
 * "star" between two of them is noise, not information.
 *
 * `color` on the Root colours every marker; `color` on one Marker colours that
 * marker alone (#94) — the anatomy declares the marker re-carries the axis,
 * and the design system's compiled CSS lets the nearest carrier win.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import type { Orientation } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type {
    PartProps,
    WithAsChild,
    WithClass,
    WithColor,
    WithHtmlAttrs,
    WithOrientation,
    WithVariantAxes,
} from '../../contract/props.js';
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
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const TimelineRoot = component<TimelineRootProps>(({ props, slots }) => {
    const orientation = (): Orientation => props.orientation ?? 'vertical';
    defineProvide(useTimelineContext, () => ({ orientation }));
    return () => (
        <ul
            {...htmlAttrs(props)}
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

export type TimelinePartProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

const TimelineItem = component<TimelinePartProps>(({ props, slots }) => {
    const timeline = useTimelineContext();
    return () => (
        <li
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="item"
            data-orientation={timeline.orientation()}
            class={props.class}
        >
            {slots.default?.()}
        </li>
    );
}, { name: 'Timeline.Item' });

/**
 * The marker takes the scope's colour vocabulary for itself — typed per
 * scope like the Root's, so it narrows under a `/register` module and is
 * `never` where the design system declares no colour axis.
 */
export type TimelineMarkerProps = WithColor<'timeline'> & TimelinePartProps;

const TimelineMarker = component<TimelineMarkerProps>(({ props, slots }) => {
    return () => (
        <div
            {...htmlAttrs(props)}
            aria-hidden="true"
            data-scope={SCOPE}
            data-part="marker"
            data-color={props.color}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Timeline.Marker' });

const TimelineConnector = component<WithClass & WithHtmlAttrs>(({ props }) => {
    const timeline = useTimelineContext();
    return () => (
        <div
            {...htmlAttrs(props)}
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
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const TimelineContent = component<TimelineContentProps>(({ props, slots }) => {
    const timeline = useTimelineContext();
    return () => (
        <div
            {...htmlAttrs(props)}
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

export type TimelineTitleProps =
    & WithClass
    & WithHtmlAttrs
    /**
     * Render your own element — the heading level the page's outline wants
     * (an `<h3>` per release in a changelog). The slot receives the bag;
     * spread it.
     */
    & WithAsChild
    & Define.Slot<'default', PartProps>;

/**
 * `title` (#302): the event's name inside `content`. A `div`, because an
 * event is not a heading unless the page says so — `asChild` is how it
 * says so.
 */
const TimelineTitle = component<TimelineTitleProps>(({ props, slots }) => () => {
    const bag: PartProps = { ...htmlAttrs(props), 'data-scope': SCOPE, 'data-part': 'title' };
    if (props.asChild) return renderAsChild(slots.default, bag);
    return <div {...bag} class={props.class}>{slots.default?.(bag)}</div>;
}, { name: 'Timeline.Title' });

/** `description` (#302): the event's detail line(s) under its title. */
const TimelineDescription = component<TimelinePartProps>(({ props, slots }) => () => (
    <div {...htmlAttrs(props)} data-scope={SCOPE} data-part="description" class={props.class}>
        {slots.default?.()}
    </div>
), { name: 'Timeline.Description' });

export const Timeline = compound(TimelineRoot, {
    Root: TimelineRoot,
    Item: TimelineItem,
    Marker: TimelineMarker,
    Connector: TimelineConnector,
    Content: TimelineContent,
    Title: TimelineTitle,
    Description: TimelineDescription,
});
