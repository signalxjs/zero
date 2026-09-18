/**
 * The demo-authoring primitives — the two layout idioms every page repeats.
 *
 * These are deliberately NOT zero components and carry no variant axes: demo
 * chrome must never render a `data-*` attribute the ds-smoke vocabulary
 * invariant would have to account for. Styling lives in `app.css` (unlayered,
 * so it wins over recipe CSS the way any consumer's app CSS does).
 */
import { component } from 'sigx';
import type { Define } from 'sigx';

/**
 * A wrapping flex row of demo instances. The default gap reads comfortably
 * for buttons; rows of larger controls pass their own.
 */
export const DemoRow = component<
    & { gap?: string; align?: string }
    & Define.Slot<'default'>
>(({ props, slots }) => () => {
    const style: Record<string, string> = {};
    if (props.gap !== undefined) style.gap = props.gap;
    if (props.align !== undefined) style.alignItems = props.align;
    return (
        <p class="demo-row" style={style}>
            {slots.default?.()}
        </p>
    );
}, { name: 'DemoRow' });

/**
 * The fixed-width `<code>` cell that names what a row demonstrates — an axis
 * value, an axis name, a size step.
 */
export const AxisLabel = component<
    & { width?: string }
    & Define.Slot<'default'>
>(({ props, slots }) => () => (
    <code class="axis-label" style={{ width: props.width ?? '7rem' }}>
        {slots.default?.()}
    </code>
), { name: 'AxisLabel' });
