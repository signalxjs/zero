/**
 * Toggle — a two-state button (WAI-ARIA button with `aria-pressed`).
 *
 * ```tsx
 * <Toggle.Root model={() => state.bold} label="Bold">B</Toggle.Root>
 * ```
 *
 * Button plus one bit of state: `on|off` rides `data-state`, `aria-pressed`
 * carries it to AT. Not a form control — a mode you flip, not a value you
 * submit; Switch owns the form-participating case.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState } from '../../behaviors/controllable.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild, synthesizesClickFrom } from '../../contract/as-child.js';
import { variantAttrs } from '../../contract/props.js';
import type {
    PartProps,
    WithAsChild,
    WithClass,
    WithDisabled,
    WithVariantAxes,
} from '../../contract/props.js';
import { toggleAnatomy } from './anatomy.js';

const SCOPE = toggleAnatomy.scope;

export type ToggleRootProps =
    & Define.Model<boolean>
    & Define.Prop<'defaultPressed', boolean, false>
    & Define.Event<'pressedChange', boolean>
    /** Accessible name (`aria-label`) — required for icon-only toggles. */
    & Define.Prop<'label', string, false>
    & WithVariantAxes<'toggle'>
    & WithDisabled
    & WithClass
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const ToggleRoot = component<ToggleRootProps>(({ props, slots, emit, signal }) => {
    const state = createControllableState<boolean>(
        () => props.model,
        props.defaultPressed ?? false,
        (v) => emit('pressedChange', v),
    );
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => !!props.disabled,
    });

    const bag = (): PartProps => ({
        'data-scope': SCOPE,
        'data-part': 'root',
        'data-state': stateAttr(state.value, 'on', 'off'),
        'data-disabled': dataAttr(props.disabled),
        'data-focus-visible': dataAttr(focus.visible),
        'aria-pressed': state.value ? 'true' : 'false',
        'aria-label': props.label,
        // A native <button disabled> is inert already; an asChild element is
        // not, so disabled has to be conveyed and enforced by hand there —
        // and a non-interactive asChild element needs the whole button
        // contract supplied: role, a tab stop, and Enter/Space activation.
        'aria-disabled': props.asChild && props.disabled ? 'true' : undefined,
        role: props.asChild ? 'button' : undefined,
        tabIndex: props.asChild && !props.disabled ? 0 : undefined,
        ...variantAttrs(props),
        ref: (node: HTMLElement | null) => { el = node; },
        onClick: (e: MouseEvent) => {
            if (props.disabled) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            state.value = !state.value;
        },
        onKeydown: (e: KeyboardEvent) => {
            if (props.disabled) return;
            press.onKeydown(e);
            // Keyboard activation for asChild elements where the platform
            // won't synthesize a click from this key (a span always; an
            // anchor on Space). Where it will, ours must stay out of the way
            // or the press toggles twice.
            // `!e.repeat`: a held key auto-repeats keydown; a toggle must
            // flip once per press, not strobe.
            if (props.asChild && !e.repeat && (e.key === 'Enter' || e.key === ' ') && !synthesizesClickFrom(e.currentTarget, e.key)) {
                e.preventDefault();
                state.value = !state.value;
            }
        },
        onKeyup: press.onKeyup,
        onFocus: () => { focus.visible = isFocusVisible(el); },
        onBlur: (e: FocusEvent) => {
            press.onBlur(e);
            focus.visible = false;
        },
        onPointerdown: press.onPointerdown,
        onPointerup: press.onPointerup,
        onPointercancel: press.onPointercancel,
        onPointerleave: press.onPointerleave,
    });

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <button type="button" class={props.class} disabled={props.disabled} {...b}>
                {slots.default?.(b)}
            </button>
        );
    };
}, { name: 'Toggle.Root' });

export const Toggle = compound(ToggleRoot, { Root: ToggleRoot });
