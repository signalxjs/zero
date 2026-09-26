/**
 * Spinner — a busy indicator, and nothing else.
 *
 * ```tsx
 * <Spinner />
 * <Spinner label="Uploading" size="lg" />
 * <Button>
 *     <Spinner decorative /> Saving…
 * </Button>
 * ```
 *
 * `role="status"` carries an implicit `aria-live="polite"`, which is what
 * makes the name useful rather than noisy: the reader is told "Loading" when
 * the spinner appears, not repeatedly while it turns. The words live in a
 * visually hidden `label` part as TEXT, not in an `aria-label` on the root:
 * a live region announces its content, and screen readers skip a name that
 * only sits in an attribute (#274). `decorative` is for a spinner beside
 * text that already says it — it drops the role and the label and hides the
 * mark from assistive technology.
 *
 * The mark is the design system's — zero renders no visible content and the
 * recipe draws into the root (a border ring, a conic gradient, a
 * pseudo-element), because a spinner's whole identity is how it is drawn.
 * That also means every skin owes it a `prefers-reduced-motion` answer that
 * still reads as "working" when nothing moves.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { WithClass, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { spinnerAnatomy } from './anatomy.js';

const SCOPE = spinnerAnatomy.scope;

export type SpinnerRootProps =
    /**
     * What the spinner announces; defaults to "Loading". An app
     * `aria-label` is read as the same thing when `label` is absent — both
     * become the hidden label's text.
     */
    & Define.Prop<'label', string, false>
    /**
     * Decoration beside text that already says it: no `status` role, no
     * label, and `aria-hidden` on the mark.
     */
    & Define.Prop<'decorative', boolean, false>
    & WithVariantAxes<'spinner'>
    & WithClass
    /** Not `role`: a spinner is a live `status` (or, decorative, nothing). */
    & Omit<WithHtmlAttrs, 'role'>;

const SpinnerRoot = component<SpinnerRootProps>(({ props }) => () => {
    const { 'aria-label': appLabel, ...attrs } = htmlAttrs(props);
    if (props.decorative) {
        return (
            <span
                {...attrs}
                aria-hidden="true"
                data-scope={SCOPE}
                data-part="root"
                {...variantAttrs(props)}
                class={props.class}
            />
        );
    }
    return (
        <span
            {...attrs}
            role="status"
            data-scope={SCOPE}
            data-part="root"
            {...variantAttrs(props)}
            class={props.class}
        >
            <span data-scope={SCOPE} data-part="label" data-visually-hidden="">
                {props.label ?? (appLabel as string | undefined) ?? 'Loading'}
            </span>
        </span>
    );
}, { name: 'Spinner.Root' });

// See Skeleton: single-part scopes still carry `.Root`.
export const Spinner = compound(SpinnerRoot, { Root: SpinnerRoot });
