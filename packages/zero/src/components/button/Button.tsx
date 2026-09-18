/**
 * Button — the variant-carrying primitive.
 *
 * ```tsx
 * <Button.Root color="primary" variant="outline" size="lg">Save</Button.Root>
 * <Button.Root asChild><a href="/docs">Docs</a></Button.Root>
 * ```
 *
 * There is no behavior to speak of here, and that is the point: a native
 * `<button>` already handles keyboard activation, form submission and the
 * disabled semantics. What zero adds is the anatomy — one stable selector
 * carrying `data-color` / `data-size` / `data-variant`, so a design system
 * has somewhere to put the fill styles the contract has always advertised.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import { variantAttrs } from '../../contract/props.js';
import type {
    PartProps,
    WithAsChild,
    WithClass,
    WithDisabled,
    WithVariantAxes,
} from '../../contract/props.js';
import { buttonAnatomy } from './anatomy.js';

const SCOPE = buttonAnatomy.scope;

export type ButtonRootProps =
    & WithVariantAxes<'button'>
    & WithDisabled
    & WithClass
    & WithAsChild
    /**
     * Defaults to `button`. The native default is `submit`, which silently
     * posts the enclosing form — a footgun for a component people reach for
     * to mean "a thing you click".
     */
    & Define.Prop<'type', 'button' | 'submit' | 'reset', false>
    /**
     * Interaction handlers are declared rather than forwarded: sigx passes no
     * rest props, so a `<Button.Root onClick={…}>` would otherwise be inert.
     * They compose with the component's own focus tracking rather than
     * replacing it.
     */
    & Define.Prop<'onClick', (e: MouseEvent) => void, false>
    & Define.Prop<'onKeydown', (e: KeyboardEvent) => void, false>
    & Define.Prop<'onFocus', (e: FocusEvent) => void, false>
    & Define.Prop<'onBlur', (e: FocusEvent) => void, false>
    & Define.Slot<'default', PartProps>;

const ButtonRoot = component<ButtonRootProps>(({ props, slots, signal }) => {
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    // Always on: one listener set, zero work until a press, and whether
    // anything visible happens is the design system's call (CSS on
    // data-pressed / data-press-animating / --press-*), not the app's.
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => !!props.disabled,
    });

    const bag = (): PartProps => ({
        'data-scope': SCOPE,
        'data-part': 'root',
        'data-disabled': dataAttr(props.disabled),
        'data-focus-visible': dataAttr(focus.visible),
        // A native <button disabled> is inert already; an asChild <a> is not,
        // so disabled has to be conveyed and enforced by hand there.
        // The literal string: ARIA is string-valued, and a boolean true
        // serializes to an empty attribute, which reads as aria-disabled="".
        'aria-disabled': props.asChild && props.disabled ? 'true' : undefined,
        ...variantAttrs(props),
        ref: (node: HTMLElement | null) => { el = node; },
        onClick: (e: MouseEvent) => {
            if (props.disabled) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            props.onClick?.(e);
        },
        onKeydown: (e: KeyboardEvent) => {
            if (props.disabled) return;
            press.onKeydown(e);
            props.onKeydown?.(e);
        },
        onKeyup: press.onKeyup,
        onFocus: (e: FocusEvent) => {
            focus.visible = isFocusVisible(el);
            props.onFocus?.(e);
        },
        onBlur: (e: FocusEvent) => {
            press.onBlur(e);
            focus.visible = false;
            props.onBlur?.(e);
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
            <button
                type={props.type ?? 'button'}
                class={props.class}
                disabled={props.disabled}
                {...b}
            >
                {slots.default?.(b)}
            </button>
        );
    };
}, { name: 'Button.Root' });

export const Button = compound(ButtonRoot, { Root: ButtonRoot });
