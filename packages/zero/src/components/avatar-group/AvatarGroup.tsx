/**
 * AvatarGroup — a labelled stack of avatars with an overflow count (#297).
 *
 * ```tsx
 * <AvatarGroup.Root label="Project members" size="sm">
 *     {shown.map((u) => (
 *         <Avatar.Root>
 *             <Avatar.Image src={u.photo} alt={u.name} />
 *             <Avatar.Fallback>{u.initials}</Avatar.Fallback>
 *         </Avatar.Root>
 *     ))}
 *     <AvatarGroup.Overflow count={members.length - shown.length} />
 * </AvatarGroup.Root>
 * ```
 *
 * Display-only: no model, no state, no registration. The consumer decides
 * how many avatars to show and passes the rest as a number — the avatars are
 * another scope's roots, and counting them across scopes would buy nothing a
 * `slice` does not. The root is `role="group"` named by `label`, and it
 * carries the axis surface: a design system sizes the avatars inside from
 * the group's `size`, and an avatar's own `size` still wins.
 *
 * `Overflow` renders "+N" for sight (`aria-hidden`) and a visually hidden
 * "N more" for assistive technology — words, not a glyph a screen reader
 * spells out as "plus three". `label` replaces those words (translate them
 * there). A `count` of zero or less renders nothing, so `total - shown`
 * needs no guard.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { WithClass, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { VisuallyHidden } from '../visually-hidden/VisuallyHidden.js';
import { avatarGroupAnatomy } from './anatomy.js';

const SCOPE = avatarGroupAnatomy.scope;

// ── Root ──

export type AvatarGroupRootProps =
    /** The group's accessible name (`aria-label`) — "Project members". */
    & Define.Prop<'label', string, false>
    & WithVariantAxes<'avatar-group'>
    & WithClass
    /** Not `role`: the root is a `group`. */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Slot<'default'>;

const AvatarGroupRoot = component<AvatarGroupRootProps>(({ props, slots }) => () => {
    const attrs = htmlAttrs(props);
    return (
        <div
            {...attrs}
            role="group"
            aria-label={props.label ?? attrs['aria-label']}
            data-scope={SCOPE}
            data-part="root"
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'AvatarGroup.Root' });

// ── Overflow ──

export type AvatarGroupOverflowProps =
    /** How many avatars the group leaves out. Zero or less renders nothing. */
    & Define.Prop<'count', number, true>
    /**
     * What assistive technology reads instead of the visible "+N" — defaults
     * to "N more". The place to translate it.
     */
    & Define.Prop<'label', string, false>
    & WithClass
    & WithHtmlAttrs;

const AvatarGroupOverflow = component<AvatarGroupOverflowProps>(({ props }) => () => {
    const count = Math.floor(props.count);
    if (!(count > 0)) return null;
    const attrs = htmlAttrs(props);
    return (
        <span
            {...attrs}
            // `label` owns what assistive technology reads, as on Root: an
            // app `aria-label` (often spread in by accident) must not
            // override the words it replaces.
            aria-label={props.label === undefined ? attrs['aria-label'] : undefined}
            data-scope={SCOPE}
            data-part="overflow"
            class={props.class}
        >
            <span aria-hidden="true">{`+${count}`}</span>
            <VisuallyHidden>{props.label ?? `${count} more`}</VisuallyHidden>
        </span>
    );
}, { name: 'AvatarGroup.Overflow' });

export const AvatarGroup = compound(AvatarGroupRoot, {
    Root: AvatarGroupRoot,
    Overflow: AvatarGroupOverflow,
});
