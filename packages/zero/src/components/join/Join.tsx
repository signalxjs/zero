/**
 * Join — collapse adjacent controls into one segmented shape.
 *
 * ```tsx
 * <Join.Root>
 *     <Join.Item asChild>{(p) => <input {...p} placeholder="Search…" />}</Join.Item>
 *     <Join.Item asChild>{(p) => <button {...p}>Go</button>}</Join.Item>
 * </Join.Root>
 * ```
 *
 * See `anatomy.ts` — the component is attribute carriers only; every visual
 * fact (radius collapse, seam borders) is the design system's.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { renderAsChild } from '../../contract/as-child.js';
import type { PartProps } from '../../contract/props.js';
import { variantAttrs } from '../../contract/props.js';
import type { WithAsChild, WithClass, WithOrientation, WithVariantAxes } from '../../contract/props.js';
import type { Orientation } from '../../contract/data-attrs.js';
import { joinAnatomy } from './anatomy.js';

const SCOPE = joinAnatomy.scope;

interface JoinContext {
    orientation(): Orientation;
}

export const useJoinContext = defineInjectable<JoinContext>(() => ({
    orientation: () => 'horizontal',
}));

export type JoinRootProps =
    & WithOrientation
    & WithVariantAxes<'join'>
    & WithClass
    & Define.Slot<'default'>;

const JoinRoot = component<JoinRootProps>(({ props, slots }) => {
    const orientation = (): Orientation => props.orientation ?? 'horizontal';
    defineProvide(useJoinContext, () => ({ orientation }));
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
}, { name: 'Join.Root' });

export type JoinItemProps =
    & WithClass
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const JoinItem = component<JoinItemProps>(({ props, slots }) => {
    const join = useJoinContext();
    return () => {
        const bag: PartProps = {
            'data-scope': SCOPE,
            'data-part': 'item',
            'data-orientation': join.orientation(),
        };
        if (props.asChild) return renderAsChild(slots.default, bag);
        return (
            <div class={props.class} {...bag}>
                {slots.default?.(bag)}
            </div>
        );
    };
}, { name: 'Join.Item' });

export const Join = compound(JoinRoot, {
    Root: JoinRoot,
    Item: JoinItem,
});
