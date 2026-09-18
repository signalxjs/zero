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
import { layoutAttrs } from '../../contract/layout-attrs.js';
import type { LayoutProp } from '../../contract/layout-attrs.js';
import type { WithClass } from '../../contract/props.js';
import { centerAnatomy } from './anatomy.js';

const SCOPE = centerAnatomy.scope;

export type CenterRootProps =
    & WithClass
    /** Which axis to centre on. Logical, so it follows writing mode. */
    & Define.Prop<'axis', LayoutProp<'axis'>, false>
    & Define.Prop<'pad', LayoutProp<'pad'>, false>
    & Define.Prop<'padX', LayoutProp<'pad-x'>, false>
    & Define.Prop<'padY', LayoutProp<'pad-y'>, false>
    & Define.Prop<'gap', LayoutProp<'gap'>, false>
    & Define.Slot<'default'>;

const CenterRoot = component<CenterRootProps>(({ props, slots }) => {
    return () => (
        <div
            data-scope={SCOPE}
            data-part="root"
            {...layoutAttrs({
                'axis': props.axis,
                'pad': props.pad,
                'pad-x': props.padX,
                'pad-y': props.padY,
                'gap': props.gap,
            }, centerAnatomy.parts.root.layout)}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Center.Root' });

// See Badge: single-part scopes still carry `.Root`.
export const Center = compound(CenterRoot, { Root: CenterRoot });
