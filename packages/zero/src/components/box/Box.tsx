/**
 * Box — a padded surface, tinted by meaning.
 *
 * ```tsx
 * <Box pad="lg">…</Box>
 * <Box pad="md" color="warning">Heads up.</Box>
 * ```
 *
 * See `anatomy.ts` for why it wires `color` but not `variant` or `size`.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { layoutAttrs } from '../../contract/layout-attrs.js';
import type { LayoutProp } from '../../contract/layout-attrs.js';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithVariantAxes } from '../../contract/props.js';
import { boxAnatomy } from './anatomy.js';

const SCOPE = boxAnatomy.scope;

export type BoxRootProps =
    & WithVariantAxes<'box'>
    & WithClass
    & Define.Prop<'pad', LayoutProp<'pad'>, false>
    & Define.Prop<'padX', LayoutProp<'pad-x'>, false>
    & Define.Prop<'padY', LayoutProp<'pad-y'>, false>
    & Define.Slot<'default'>;

const BoxRoot = component<BoxRootProps>(({ props, slots }) => {
    return () => (
        <div
            data-scope={SCOPE}
            data-part="root"
            {...variantAttrs(props)}
            {...layoutAttrs({
                'pad': props.pad,
                'pad-x': props.padX,
                'pad-y': props.padY,
            }, boxAnatomy.parts.root.layout)}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Box.Root' });

// See Badge: single-part scopes still carry `.Root`.
export const Box = compound(BoxRoot, { Root: BoxRoot });
