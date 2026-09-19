/**
 * Badge — a small standing label: a count, a status, a tag.
 *
 * ```tsx
 * <Badge color="success" variant="soft">Active</Badge>
 * ```
 *
 * One part, no state, no behavior. It exists in zero for the same reason
 * Button does: the axes have to land on something the design system can
 * select, and a `<span class="badge">` the consumer writes is not that.
 *
 * `variant` is the interesting one. zero-basic narrows badge's vocabulary to
 * `solid | soft | outline` through `tokens.scopes` — the design-system-wide
 * set also has `ghost`, and a ghost badge is a word with no box.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { renderAsChild } from '../../contract/as-child.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithColor, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { badgeAnatomy } from './anatomy.js';

const SCOPE = badgeAnatomy.scope;

export type BadgeRootProps =
    & WithVariantAxes<'badge'>
    & WithClass
    & WithHtmlAttrs
    & WithAsChild
    & Define.Slot<'default', PartProps>;

/**
 * `asChild` because a badge is so often already something else — an `<a>` to
 * the filtered list, a `<button>` that removes the tag. Without it the caller
 * has to nest, and a link inside a badge is not the same box as a badge that
 * IS a link.
 */
const BadgeRoot = component<BadgeRootProps>(({ props, slots }) => {
    return () => {
        const bag: PartProps = {
            ...htmlAttrs(props),
            'data-scope': SCOPE,
            'data-part': 'root',
            ...variantAttrs(props),
        };
        if (props.asChild) return renderAsChild(slots.default, bag);
        return (
            <span class={props.class} {...bag}>
                {slots.default?.(bag)}
            </span>
        );
    };
}, { name: 'Badge.Root' });

/**
 * The status dot (#130). `color` is the dot's own — typed per scope like the
 * Root's, so it narrows under a `/register` module and is `never` where the
 * design system declares no colour axis — and `running` puts the dot in the
 * governed in-flight state (a pulse in every shipped skin, with a static
 * ring under reduced motion). Decorative: the pill's text is the label, so
 * the dot is `aria-hidden` and takes no `role`.
 */
export type BadgeDotProps =
    & WithColor<'badge'>
    & Define.Prop<'running', boolean, false>
    & WithClass
    & Omit<WithHtmlAttrs, 'role'>;

const BadgeDot = component<BadgeDotProps>(({ props }) => {
    return () => (
        <span
            {...htmlAttrs(props)}
            aria-hidden="true"
            data-scope={SCOPE}
            data-part="dot"
            data-state={props.running ? 'running' : undefined}
            data-color={props.color}
            class={props.class}
        />
    );
}, { name: 'Badge.Dot' });

// Root is the whole badge; every scope in the anatomy exports
// `<Pascal>.Root`, and the kit's `./components` emitter relies on it (Button
// and Toggle are the same shape). `<Badge>` stays callable directly.
export const Badge = compound(BadgeRoot, { Root: BadgeRoot, Dot: BadgeDot });
