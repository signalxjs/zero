/**
 * Grid — two-dimensional layout whose spacing comes from the design system.
 *
 * ```tsx
 * <Grid cols={{ base: 1, md: 2, lg: 4 }} gap="lg">
 *     <Card.Root>…</Card.Root>
 *     <Grid.Cell span="full"><Card.Root>…</Card.Root></Grid.Cell>
 * </Grid>
 *
 * <Grid cols="auto" track="md" gap="md">…</Grid>
 * ```
 *
 * `cols="auto"` reflows by available width with no breakpoint named at all,
 * which is usually what a collection of cards wants; `track` sets how narrow
 * a column may get first. See `anatomy.ts`.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { renderAsChild } from '../../contract/as-child.js';
import { layoutAttrs } from '../../contract/layout-attrs.js';
import type { LayoutProp } from '../../contract/layout-attrs.js';
import type { PartProps, WithAsChild, WithClass } from '../../contract/props.js';
import { gridAnatomy } from './anatomy.js';

const SCOPE = gridAnatomy.scope;

export type GridRootProps =
    & WithClass
    & Define.Prop<'cols', LayoutProp<'cols'>, false>
    & Define.Prop<'track', LayoutProp<'track'>, false>
    & Define.Prop<'gap', LayoutProp<'gap'>, false>
    & Define.Prop<'gapX', LayoutProp<'gap-x'>, false>
    & Define.Prop<'gapY', LayoutProp<'gap-y'>, false>
    & Define.Prop<'pad', LayoutProp<'pad'>, false>
    & Define.Prop<'padX', LayoutProp<'pad-x'>, false>
    & Define.Prop<'padY', LayoutProp<'pad-y'>, false>
    & Define.Prop<'align', LayoutProp<'align'>, false>
    & Define.Prop<'justify', LayoutProp<'justify'>, false>
    & Define.Slot<'default'>;

const GridRoot = component<GridRootProps>(({ props, slots }) => {
    return () => (
        <div
            data-scope={SCOPE}
            data-part="root"
            {...layoutAttrs({
                'cols': props.cols,
                'track': props.track,
                'gap': props.gap,
                'gap-x': props.gapX,
                'gap-y': props.gapY,
                'pad': props.pad,
                'pad-x': props.padX,
                'pad-y': props.padY,
                'align': props.align,
                'justify': props.justify,
            }, gridAnatomy.parts.root.layout)}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Grid.Root' });

export type GridCellProps =
    & WithClass
    & WithAsChild
    /** How many columns to span, or `full` for the whole row. */
    & Define.Prop<'span', LayoutProp<'span'>, false>
    & Define.Slot<'default', PartProps>;

const GridCell = component<GridCellProps>(({ props, slots }) => {
    return () => {
        const bag: PartProps = {
            'data-scope': SCOPE,
            'data-part': 'cell',
            ...layoutAttrs({ span: props.span }, gridAnatomy.parts.cell.layout),
        };
        if (props.asChild) return renderAsChild(slots.default, bag);
        return (
            <div class={props.class} {...bag}>
                {slots.default?.(bag)}
            </div>
        );
    };
}, { name: 'Grid.Cell' });

export const Grid = compound(GridRoot, {
    Root: GridRoot,
    Cell: GridCell,
});
