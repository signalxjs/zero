/**
 * Center — put a thing in the middle.
 *
 * ```tsx
 * <Center pad="xl">
 *     <Spinner />
 * </Center>
 *
 * <Center axis="inline">…</Center>
 * ```
 *
 * See `anatomy.ts` for why this is a component rather than a reminder to
 * write `place-items: center`.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { renderAsChild } from '../../contract/as-child.js';
import { layoutAttrs } from '../../contract/layout-attrs.js';
import type { LayoutProp } from '../../contract/layout-attrs.js';
import { htmlAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithHtmlAttrs } from '../../contract/props.js';
import { centerAnatomy } from './anatomy.js';

const SCOPE = centerAnatomy.scope;

export type CenterRootProps =
    & WithClass
    & WithHtmlAttrs
    /** Which axis to centre on. Logical, so it follows writing mode. */
    & Define.Prop<'axis', LayoutProp<'axis'>, false>
    & Define.Prop<'pad', LayoutProp<'pad'>, false>
    & Define.Prop<'padX', LayoutProp<'pad-x'>, false>
    & Define.Prop<'padY', LayoutProp<'pad-y'>, false>
    & Define.Prop<'gap', LayoutProp<'gap'>, false>
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const CenterRoot = component<CenterRootProps>(({ props, slots }) => {
    return () => {
        const bag: PartProps = {
            ...htmlAttrs(props),
            'data-scope': SCOPE,
            'data-part': 'root',
            ...layoutAttrs({
                'axis': props.axis,
                'pad': props.pad,
                'pad-x': props.padX,
                'pad-y': props.padY,
                'gap': props.gap,
            }, centerAnatomy.parts.root.layout),
        };
        if (props.asChild) return renderAsChild(slots.default, bag);
        return (
            <div class={props.class} {...bag}>
                {slots.default?.(bag)}
            </div>
        );
    };
}, { name: 'Center.Root' });

// See Badge: single-part scopes still carry `.Root`.
export const Center = compound(CenterRoot, { Root: CenterRoot });
