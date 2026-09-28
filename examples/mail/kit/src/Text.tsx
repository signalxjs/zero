/**
 * Text, Heading and Time: the typography zero does not ship (#440).
 *
 * ```tsx
 * <Text axes={{ tone: 'muted' }} size="sm" mods={{ truncate: true }}>…</Text>
 * <Heading level={2} size="lg">Inbox</Heading>
 * <Time value={date} />
 * ```
 *
 * Every visual choice is an axis the design system declares — `size` for the
 * type step, `tone` for the ink, `weight` for emphasis, `truncate` and
 * `clamp` as modifiers — so the app never writes a style.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { htmlAttrs, renderAsChild, variantAttrs } from '@sigx/zero';
import type { PartProps, WithAsChild, WithClass, WithHtmlAttrs, WithVariantAxesOpen } from '@sigx/zero';
import { headingAnatomy, textAnatomy, timeAnatomy } from './anatomy.js';

/** Ink steps the design system declares as the `tone` axis. */
export type Tone = 'muted' | 'subtle' | 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error';
export type Weight = 'normal' | 'medium' | 'semibold' | 'bold';

/**
 * Named props over the design system's typography vocabulary — `tone` and
 * `weight` are custom axes, `truncate` and `clamp` modifiers. Sugar only: they
 * land in `axes` / `mods`, so `data-tone` etc. stay the design system's words.
 */
export type TypeProps =
    & Define.Prop<'tone', Tone, false>
    & Define.Prop<'weight', Weight, false>
    & Define.Prop<'truncate', boolean, false>
    & Define.Prop<'clamp', boolean, false>;

export function typeAttrs(props: {
    tone?: Tone; weight?: Weight; truncate?: boolean; clamp?: boolean;
    axes?: Record<string, string | undefined>; mods?: Record<string, boolean | undefined>;
}): { axes: Record<string, string | undefined>; mods: Record<string, boolean | undefined> } {
    return {
        axes: { tone: props.tone, weight: props.weight, ...props.axes },
        mods: { truncate: props.truncate, clamp: props.clamp, ...props.mods },
    };
}

/** The elements a Text may render as. `span` is the anatomy's default. */
export type TextElement = 'span' | 'p' | 'div' | 'strong' | 'em' | 'label';

export type TextRootProps =
    & WithVariantAxesOpen<'mail-text'>
    & WithClass
    & WithHtmlAttrs
    & WithAsChild
    & TypeProps
    & Define.Prop<'as', TextElement, false>
    & Define.Slot<'default', PartProps>;

const TextRoot = component<TextRootProps>(({ props, slots }) => () => {
    const bag: PartProps = {
        ...htmlAttrs(props),
        'data-scope': textAnatomy.scope,
        'data-part': 'root',
        ...variantAttrs({ ...props, ...typeAttrs(props) }),
    };
    if (props.asChild) return renderAsChild(slots.default, bag);
    const Tag = props.as ?? 'span';
    return <Tag class={props.class} {...bag}>{slots.default?.(bag)}</Tag>;
}, { name: 'Text.Root' });

export const Text = compound(TextRoot, { Root: TextRoot });

export type HeadingRootProps =
    & WithVariantAxesOpen<'mail-heading'>
    & WithClass
    & WithHtmlAttrs
    & TypeProps
    /** The outline level, `h1`–`h6`. Defaults to 2. */
    & Define.Prop<'level', 1 | 2 | 3 | 4 | 5 | 6, false>
    & Define.Slot<'default'>;

const HeadingRoot = component<HeadingRootProps>(({ props, slots }) => () => {
    const Tag = `h${props.level ?? 2}` as 'h2';
    return (
        <Tag
            class={props.class}
            {...htmlAttrs(props)}
            data-scope={headingAnatomy.scope}
            data-part="root"
            {...variantAttrs({ ...props, ...typeAttrs(props) })}
        >
            {slots.default?.()}
        </Tag>
    );
}, { name: 'Heading.Root' });

export const Heading = compound(HeadingRoot, { Root: HeadingRoot });

export type TimeFormat = 'relative' | 'short' | 'long' | 'time';

export type TimeRootProps =
    & WithVariantAxesOpen<'mail-time'>
    & WithClass
    & WithHtmlAttrs
    & TypeProps
    & Define.Prop<'value', Date | number | string, true>
    /** `relative` (default) reads like a mail list: "14:05", "Tue", "3 Mar". */
    & Define.Prop<'format', TimeFormat, false>
    /** The clock to compare against — pinned in tests and mock data. */
    & Define.Prop<'now', Date | number, false>
    & Define.Prop<'locale', string, false>;

const DAY = 86_400_000;

function startOfDay(d: Date): number {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Mail-list style: today → time, this week → weekday, this year → day + month, else a date. */
export function formatMailTime(value: Date, format: TimeFormat, now: Date, locale?: string): string {
    if (format === 'long') {
        return value.toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    if (format === 'short') return value.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    if (format === 'time') return value.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    const days = (startOfDay(now) - startOfDay(value)) / DAY;
    if (days <= 0) return value.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    if (days < 7) return value.toLocaleDateString(locale, { weekday: 'short' });
    if (value.getFullYear() === now.getFullYear()) return value.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    return value.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

const TimeRoot = component<TimeRootProps>(({ props }) => () => {
    const value = new Date(props.value);
    const now = props.now === undefined ? new Date() : new Date(props.now);
    const format = props.format ?? 'relative';
    return (
        <time
            class={props.class}
            {...htmlAttrs(props)}
            data-scope={timeAnatomy.scope}
            data-part="root"
            {...variantAttrs({ ...props, ...typeAttrs(props) })}
            dateTime={value.toISOString()}
            title={format === 'long' ? undefined : formatMailTime(value, 'long', now, props.locale)}
        >
            {formatMailTime(value, format, now, props.locale)}
        </time>
    );
}, { name: 'Time.Root' });

export const Time = compound(TimeRoot, { Root: TimeRoot });
