/**
 * Spacer — flexible room, or a fixed rung of the spacing ramp.
 *
 * ```tsx
 * <Row>
 *     <span>Left</span>
 *     <Spacer />
 *     <button>Right</button>
 * </Row>
 * ```
 *
 * See `anatomy.ts` for why this exists alongside `gap`.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { layoutAttrs } from '../../contract/layout-attrs.js';
import type { LayoutProp } from '../../contract/layout-attrs.js';
import type { WithClass } from '../../contract/props.js';
import { spacerAnatomy } from './anatomy.js';

const SCOPE = spacerAnatomy.scope;

export type SpacerRootProps =
    & WithClass
    /** A fixed size instead of flexing. Absent means "take what is left". */
    & Define.Prop<'space', LayoutProp<'space'>, false>;

const SpacerRoot = component<SpacerRootProps>(({ props }) => {
    return () => (
        <div
            // Decorative by definition: it holds room, never content, so it
            // is hidden from the accessibility tree rather than announced as
            // an empty group.
            aria-hidden="true"
            data-scope={SCOPE}
            data-part="root"
            {...layoutAttrs({ space: props.space }, spacerAnatomy.parts.root.layout)}
            class={props.class}
        />
    );
}, { name: 'Spacer.Root' });

// See Badge: single-part scopes still carry `.Root`.
export const Spacer = compound(SpacerRoot, { Root: SpacerRoot });
