/**
 * ActionButton — an icon button that DOES something and says what on hover.
 *
 * ```tsx
 * <ActionButton icon="archive" label="Archive" shortcut="E" onClick={archive} />
 * ```
 *
 * A tooltip lent to a `Button.Root` (#494): the Button renders the one
 * element and keeps its anatomy, so it brings the design system's button
 * paint (a quiet neutral ghost here), `loading` and `focusableWhenDisabled`;
 * the tooltip trigger it absorbs adds the hover/focus intent, the
 * `aria-describedby` and the anchor. A disabled action stays a tab stop
 * (`focusableWhenDisabled`), so its tooltip still says what it would do.
 */
import { component } from 'sigx';
import type { Define } from 'sigx';
import { Button, Kbd, Tooltip } from '@sigx/zero';
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
        <Tooltip.Trigger asChild>
            {(p) => (
                <Button.Root
                    lend={p}
                    variant="ghost"
                    color="neutral"
                    size={props.size ?? 'sm'}
                    disabled={props.disabled}
                    focusableWhenDisabled
                    aria-label={props.label}
                    aria-pressed={props.pressed === undefined ? undefined : String(props.pressed)}
                    aria-keyshortcuts={props.shortcut}
                    onClick={(e: MouseEvent) => emit('click', e)}
                >
                    <Icon name={props.icon} tone={props.tone} />
                </Button.Root>
            )}
        </Tooltip.Trigger>
        <Tooltip.Popup>
            {props.label}
            {props.shortcut ? <>{' '}<Kbd size="xs">{props.shortcut}</Kbd></> : null}
        </Tooltip.Popup>
    </Tooltip.Root>
), { name: 'ActionButton' });
