/**
 * Status — a tiny presence dot.
 *
 * ```tsx
 * <Status color="success" /> Online
 * <Status color="error" label="Service degraded" />
 * ```
 *
 * Renders empty: the mark is the design system's paint, exactly like
 * Spinner. The accessibility split is the component's one decision:
 *
 * - without `label`, the dot is `aria-hidden` — it decorates visible text
 *   ("Online") that already carries the meaning, and announcing both would
 *   say everything twice;
 * - with `label`, the dot IS the content, so it announces as `role="img"`
 *   with that name. `role="status"` was rejected on purpose: that is a LIVE
 *   region, and a static dot that announced itself on every render would be
 *   noise — while one that never changes would announce nothing at all.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithVariantAxes } from '../../contract/props.js';
import { statusAnatomy } from './anatomy.js';

const SCOPE = statusAnatomy.scope;

export type StatusRootProps =
    & Define.Prop<'label', string, false>
    & WithVariantAxes<'status'>
    & WithClass;

const StatusRoot = component<StatusRootProps>(({ props }) => {
    return () => (
        <span
            role={props.label ? 'img' : undefined}
            aria-label={props.label || undefined}
            aria-hidden={props.label ? undefined : 'true'}
            data-scope={SCOPE}
            data-part="root"
            {...variantAttrs(props)}
            class={props.class}
        />
    );
}, { name: 'Status.Root' });

// One part, but still a compound: every scope in the anatomy exports
// `<Pascal>.Root`, and the kit's `./components` emitter relies on it.
export const Status = compound(StatusRoot, { Root: StatusRoot });
