/**
 * Indicator — anchor an item to the corner of what it decorates.
 *
 * ```tsx
 * <Indicator.Root>
 *     <Indicator.Item><Badge color="error">99+</Badge></Indicator.Item>
 *     <Button>Inbox</Button>
 * </Indicator.Root>
 * ```
 *
 * No behavior, no ARIA of its own: what the item MEANS is the item's job (a
 * Badge with text, a labelled Status dot). Zero stamps `data-placement` from
 * the declared eight-slot subset — always, including the default, so a
 * recipe keys every slot the same way and needs no "absent attribute" case.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithVariantAxes } from '../../contract/props.js';
import { indicatorAnatomy, INDICATOR_PLACEMENTS } from './anatomy.js';

const SCOPE = indicatorAnatomy.scope;

/** One of the eight declared anchor slots — see `anatomy.ts` for the shape. */
export type IndicatorPlacement = typeof INDICATOR_PLACEMENTS[number];

export type IndicatorRootProps =
    & WithVariantAxes<'indicator'>
    & WithClass
    & Define.Slot<'default'>;

const IndicatorRoot = component<IndicatorRootProps>(({ props, slots }) => {
    return () => (
        <div
            data-scope={SCOPE}
            data-part="root"
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Indicator.Root' });

export type IndicatorItemProps =
    & Define.Prop<'placement', IndicatorPlacement, false>
    & WithClass
    & Define.Slot<'default'>;

const IndicatorItem = component<IndicatorItemProps>(({ props, slots }) => {
    return () => (
        <span
            data-scope={SCOPE}
            data-part="item"
            data-placement={props.placement ?? 'top-end'}
            class={props.class}
        >
            {slots.default?.()}
        </span>
    );
}, { name: 'Indicator.Item' });

export const Indicator = compound(IndicatorRoot, {
    Root: IndicatorRoot,
    Item: IndicatorItem,
});
