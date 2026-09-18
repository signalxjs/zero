/**
 * Spinner — a busy indicator, and nothing else.
 *
 * ```tsx
 * <Spinner />
 * <Spinner label="Uploading" size="lg" />
 * ```
 *
 * `role="status"` carries an implicit `aria-live="polite"`, which is what
 * makes the name useful rather than noisy: the reader is told "Loading" when
 * the spinner appears, not repeatedly while it turns.
 *
 * The mark is the design system's — zero renders an empty element and the
 * recipe draws into it (a border ring, a conic gradient, a pseudo-element),
 * because a spinner's whole identity is how it is drawn. That also means every
 * skin owes it a `prefers-reduced-motion` answer that still reads as "working"
 * when nothing moves.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithVariantAxes } from '../../contract/props.js';
import { spinnerAnatomy } from './anatomy.js';

const SCOPE = spinnerAnatomy.scope;

export type SpinnerRootProps =
    /** Accessible name; defaults to "Loading". */
    & Define.Prop<'label', string, false>
    & WithVariantAxes<'spinner'>
    & WithClass;

const SpinnerRoot = component<SpinnerRootProps>(({ props }) => () => (
    <span
        role="status"
        aria-label={props.label ?? 'Loading'}
        data-scope={SCOPE}
        data-part="root"
        {...variantAttrs(props)}
        class={props.class}
    />
), { name: 'Spinner.Root' });

// See Skeleton: single-part scopes still carry `.Root`.
export const Spinner = compound(SpinnerRoot, { Root: SpinnerRoot });
