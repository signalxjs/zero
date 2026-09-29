/**
 * MenuAction — an icon button that opens a menu and says which on hover.
 *
 * ```tsx
 * <Menu.Root onSelect={moveTo}>
 *     <MenuAction icon="folder" label="Move to" />
 *     <Menu.Popup>…</Menu.Popup>
 * </Menu.Root>
 * ```
 *
 * Three parts, one element (#495): a tooltip lent to a `Menu.Trigger`, lent
 * in turn to a `Button.Root`. The Button renders and keeps its anatomy, so
 * the menu button carries the same quiet ghost paint as an `ActionButton`;
 * the menu trigger adds `aria-haspopup`/`aria-expanded`/`aria-controls`
 * and the open keys, the tooltip its hover label. A press dismisses the
 * tooltip, so it never sits over the menu it opened. Render it inside the
 * `Menu.Root` it opens. Pass `icon`, or children (an avatar) in its place.
 */
import { component } from 'sigx';
import type { Define } from 'sigx';
import { Button, Menu, Tooltip } from '@sigx/zero';
import type { Placement } from '@sigx/zero';
import { Icon } from './Icon.js';
import type { IconName } from './Icon.js';

export type MenuActionProps =
    & Define.Prop<'icon', IconName, false>
    /** The accessible name, and the tooltip's text. */
    & Define.Prop<'label', string, true>
    & Define.Prop<'placement', Placement, false>
    & Define.Prop<'size', 'xs' | 'sm' | 'md' | 'lg' | 'xl', false>
    & Define.Slot<'default'>;

export const MenuAction = component<MenuActionProps>(({ props, slots }) => () => (
    <Tooltip.Root placement={props.placement ?? 'bottom'} openDelay={500}>
        <Tooltip.Trigger asChild>
            {(t) => (
                <Menu.Trigger asChild lend={t}>
                    {(m) => (
                        <Button.Root
                            lend={m}
                            variant="ghost"
                            color="neutral"
                            size={props.size ?? 'sm'}
                            aria-label={props.label}
                        >
                            {props.icon ? <Icon name={props.icon} /> : slots.default?.()}
                        </Button.Root>
                    )}
                </Menu.Trigger>
            )}
        </Tooltip.Trigger>
        <Tooltip.Popup>{props.label}</Tooltip.Popup>
    </Tooltip.Root>
), { name: 'MenuAction' });
