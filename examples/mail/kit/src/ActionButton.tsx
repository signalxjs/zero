/**
 * ActionButton — an icon button that DOES something and says what on hover.
 *
 * ```tsx
 * <ActionButton icon="archive" label="Archive" shortcut="E" onClick={archive} />
 * ```
 *
 * Built on `<Tooltip.Trigger onClick>` (#486): the trigger is the button, its
 * own `onClick` runs the action, and the tooltip labels it — no asChild, no
 * raw `<button>`. The design system paints it through the tooltip trigger's
 * recipe — the same quiet trigger menus and popovers open from, so a toolbar
 * reads as one row.
 */
import { component } from 'sigx';
import type { Define } from 'sigx';
import { Kbd, Tooltip } from '@sigx/zero';
import type { Placement } from '@sigx/zero';
import { Icon } from './Icon.js';
import type { IconName } from './Icon.js';
import type { Tone } from './Text.js';

export type ActionButtonProps =
    & Define.Prop<'icon', IconName, true>
    /** The accessible name, and the tooltip's text. */
    & Define.Prop<'label', string, true>
    /** A key hint shown in the tooltip (display only — bind it with Hotkeys). */
    & Define.Prop<'shortcut', string, false>
    & Define.Prop<'disabled', boolean, false>
    & Define.Prop<'pressed', boolean, false>
    & Define.Prop<'tone', Tone, false>
    & Define.Prop<'placement', Placement, false>
    & Define.Prop<'size', 'xs' | 'sm' | 'md' | 'lg' | 'xl', false>
    & Define.Event<'click', MouseEvent>;

export const ActionButton = component<ActionButtonProps>(({ props, emit }) => () => (
    <Tooltip.Root placement={props.placement ?? 'bottom'} openDelay={500}>
        <Tooltip.Trigger
            size={props.size ?? 'sm'}
            disabled={props.disabled}
            aria-label={props.label}
            aria-pressed={props.pressed === undefined ? undefined : String(props.pressed)}
            aria-keyshortcuts={props.shortcut}
            onClick={(e: MouseEvent) => emit('click', e)}
        >
            <Icon name={props.icon} tone={props.tone} />
        </Tooltip.Trigger>
        <Tooltip.Popup>
            {props.label}
            {props.shortcut ? <>{' '}<Kbd size="xs">{props.shortcut}</Kbd></> : null}
        </Tooltip.Popup>
    </Tooltip.Root>
), { name: 'ActionButton' });
