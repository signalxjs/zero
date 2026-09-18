/**
 * Divider — a separator with the role the platform already has for one.
 *
 * ```tsx
 * <Divider />
 * <Divider orientation="vertical" />
 * ```
 *
 * `role="separator"` without a `tabindex` is the NON-focusable flavour, which
 * is the right one here: the focusable variant exists for split-pane handles
 * that can be moved, and this one cannot. `aria-orientation` is emitted only
 * for `vertical` — horizontal is the role's own default, and restating a
 * default is how two sources of truth start.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import type { Orientation } from '../../contract/data-attrs.js';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithVariantAxes } from '../../contract/props.js';
import { dividerAnatomy } from './anatomy.js';

const SCOPE = dividerAnatomy.scope;

export type DividerRootProps =
    & Define.Prop<'orientation', Orientation, false>
    & WithVariantAxes<'divider'>
    & WithClass;

const DividerRoot = component<DividerRootProps>(({ props }) => {
    const orientation = (): Orientation => props.orientation ?? 'horizontal';
    return () => (
        <div
            role="separator"
            aria-orientation={orientation() === 'vertical' ? 'vertical' : undefined}
            data-scope={SCOPE}
            data-part="root"
            data-orientation={orientation()}
            {...variantAttrs(props)}
            class={props.class}
        />
    );
}, { name: 'Divider.Root' });

// See Badge: single-part scopes still carry `.Root`.
export const Divider = compound(DividerRoot, { Root: DividerRoot });
