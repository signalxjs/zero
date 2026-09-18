/**
 * Skeleton — the shape of what is coming.
 *
 * ```tsx
 * <Skeleton.Root model={() => state.pending}>
 *     <p>{article.title}</p>
 * </Skeleton.Root>
 * ```
 *
 * The model is `loading` and defaults to **true**: a skeleton is rendered
 * because something has not arrived yet, so the useful default is the opposite
 * of Dialog's. Children render in both states — see `anatomy.ts` for why
 * holding the layout is the entire job.
 *
 * `aria-busy` rather than a live region: the reader is told this region is
 * being updated, and told once it settles. A skeleton that announced itself
 * would interrupt for something that is, by definition, not content yet.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState } from '../../behaviors/controllable.js';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithVariantAxes } from '../../contract/props.js';
import { skeletonAnatomy } from './anatomy.js';

const SCOPE = skeletonAnatomy.scope;

export type SkeletonRootProps =
    & Define.Model<boolean>
    & Define.Prop<'defaultLoading', boolean, false>
    & Define.Event<'loadingChange', boolean>
    & WithVariantAxes<'skeleton'>
    & WithClass
    & Define.Slot<'default'>;

const SkeletonRoot = component<SkeletonRootProps>(({ props, slots, emit }) => {
    const state = createControllableState<boolean>(
        () => props.model,
        props.defaultLoading ?? true,
        (v) => emit('loadingChange', v),
    );

    return () => (
        <div
            data-scope={SCOPE}
            data-part="root"
            data-state={state.value ? 'loading' : 'loaded'}
            aria-busy={state.value ? 'true' : undefined}
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Skeleton.Root' });

// One part, but still a compound: every scope in the anatomy exports
// `<Pascal>.Root`, and the kit's `./components` emitter relies on it.
export const Skeleton = compound(SkeletonRoot, { Root: SkeletonRoot });
