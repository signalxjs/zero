import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * AvatarGroup — a stack of avatars with a count for the ones left out (#297).
 *
 * `root` is a `div` with `role="group"`, named by the `label` prop. It is
 * the axis carrier, and a design system uses that to size (and seat) the
 * `Avatar.Root`s inside it — a recipe's `composes` borrows the avatar's own
 * size value in context, so `<AvatarGroup.Root size="sm">` renders small
 * avatars without a prop on each, while an avatar's own `size` still wins.
 * The overlap and the ring that separates stacked faces are the skin's
 * choice; zero draws neither.
 *
 * `overflow` is the "+N" chip after the last avatar. The consumer slices
 * its own list and passes what it left out as `count`: there is no
 * registration of the avatars, which belong to another scope. The visible
 * "+N" is `aria-hidden`; what assistive technology reads is a visually
 * hidden "N more" (or the `label` prop), so the chip is words, not a
 * glyph. It has no state — a count of zero renders no chip at all.
 */
export const avatarGroupAnatomy = defineAnatomy('avatar-group', {
    root: {
        element: 'div',
        tokens: ['color', 'size'],
    },
    overflow: {
        element: 'span',
        parent: 'root',
        tokens: ['color', 'radius-selector', 'text'],
    },
});
