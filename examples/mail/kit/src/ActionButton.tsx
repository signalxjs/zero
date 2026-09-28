/**
 * ActionButton — an icon button that DOES something and says what on hover.
 *
 * ```tsx
 * <ActionButton icon="archive" label="Archive" shortcut="E" onClick={archive} />
 * ```
 *
 * Zero cannot compose this from its own parts (#440): `Tooltip.Trigger` has no
 * `onClick`, and a zero `Button` cannot take a trigger's `asChild` bag — the
 * bag carries `data-scope`/`data-part`/`data-color`, which Button's html
 * pass-through rejects (a type error, and a throw at runtime). So the trigger
 * renders its own `<button>` here, where the kit is allowed markup, and the
 * design system paints it through the tooltip trigger's recipe — the same
 * quiet trigger menus and popovers open from, so a toolbar reads as one row.
 */
import { component } from 'sigx';
import type { Define } from 'sigx';
import { Kbd, Tooltip } from '@sigx/zero';
import type { PartProps, Placement } from '@sigx/zero';
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
        <Tooltip.Trigger asChild size={props.size ?? 'sm'}>
            {(p: PartProps) => (
                <button
                    type="button"
                    {...p}
                    aria-label={props.label}
                    aria-pressed={props.pressed === undefined ? undefined : String(props.pressed)}
                    aria-keyshortcuts={props.shortcut}
                    disabled={props.disabled}
                    onClick={(e: MouseEvent) => emit('click', e)}
                >
                    <Icon name={props.icon} tone={props.tone} />
                </button>
            )}
        </Tooltip.Trigger>
        <Tooltip.Popup>
            {props.label}
            {props.shortcut ? <>{' '}<Kbd size="xs">{props.shortcut}</Kbd></> : null}
        </Tooltip.Popup>
    </Tooltip.Root>
), { name: 'ActionButton' });
