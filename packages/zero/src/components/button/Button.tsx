/**
 * Button — the variant-carrying primitive.
 *
 * ```tsx
 * <Button.Root color="primary" variant="outline" size="lg">Save</Button.Root>
 * <Button.Root asChild><a href="/docs">Docs</a></Button.Root>
 * ```
 *
 * There is little behavior here, and that is the point: a native `<button>`
 * already handles keyboard activation, form submission and the disabled
 * semantics. What zero adds is the anatomy — one stable selector carrying
 * `data-color` / `data-size` / `data-variant`, so a design system has
 * somewhere to put the fill styles the contract has always advertised — and
 * the one state a native button has no spelling for: `loading`.
 *
 * A lend host (#452): another zero part's asChild bag reaches it through
 * `lend`, never a spread. The Button keeps its own anatomy and paint; the
 * lent part adds behaviour and ARIA only, chained before the Button's own:
 *
 * ```tsx
 * <Tooltip.Trigger asChild>
 *     {(p) => <Button.Root lend={p} onClick={archive} aria-label="Archive"><Icon name="archive" /></Button.Root>}
 * </Tooltip.Trigger>
 * ```
 *
 * An inert Button (`disabled`, `loading`) gates the lent activation handlers
 * (click, keydown, …) but not focus, blur or pointer ones — so a tooltip lent
 * to a `loading` or `focusableWhenDisabled` Button still shows.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr } from '../../contract/data-attrs.js';
import { mergePartProps } from '../../contract/merge-part-props.js';
import { renderAsChild, synthesizesClickFrom } from '../../contract/as-child.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type {
    PartProps,
    WithAsChild,
    WithClass,
    WithDisabled,
    WithForm,
    WithHtmlAttrs,
    WithInteractionHandlers,
    WithLend,
    WithName,
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
     * Another zero part's asChild bag — a `Tooltip.Trigger`'s, say (#452).
     * Its handlers and ref run before the Button's own, its IDREF ARIA
     * joins, and its anatomy is dropped: the Button keeps its own.
     */
    & WithLend
    & WithHtmlAttrs
    /**
     * The native button's own form attributes: `name`/`value` post with a
     * submitter, `form` associates it with a form by id. They land on the
     * built-in `<button>`; an asChild element carries its own.
     */
    & WithName
    & WithForm
    & Define.Prop<'value', string, false>
    /**
     * Defaults to `button`. The native default is `submit`, which silently
     * posts the enclosing form — a footgun for a component people reach for
     * to mean "a thing you click".
     */
    & Define.Prop<'type', 'button' | 'submit' | 'reset', false>
    /**
     * Work in flight: `aria-busy` + `aria-disabled`, `data-state="loading"`,
     * activation blocked (a click neither fires `onClick` nor submits), and
     * a `spinner` part rendered before the label for the design system to
     * draw. NOT the native `disabled`: that would drop focus from the button
     * the user just pressed. An asChild element gets the state and the ARIA
     * but no spinner — its children are the caller's.
     */
    & Define.Prop<'loading', boolean, false>
    /**
     * Disabled, but still a tab stop: `aria-disabled="true"` instead of the
     * native `disabled`, so a keyboard or screen-reader user can reach the
     * button and hear why it cannot act (a tooltip on it, a disabled menu
     * command). Activation stays blocked. On an asChild element it keeps the
     * `tabindex="0"` the button contract gives it.
     */
    & Define.Prop<'focusableWhenDisabled', boolean, false>
    /**
     * Interaction handlers are declared rather than forwarded: sigx passes no
     * rest props, so a `<Button.Root onClick={…}>` would otherwise be inert.
     * They compose with the component's own focus tracking rather than
     * replacing it.
     */
    & WithInteractionHandlers
    & Define.Slot<'default', PartProps>;

/**
 * What an asChild element already is, read from its tag once mounted:
 * `native` activates from the keyboard by itself (a `<button>`, an
 * `<input>`, a `<summary>`), `link` is an anchor — keep its link semantics,
 * but a disabled one must stop navigating — and `other` (a `<span>`, a
 * `<div>`) has none of the button contract and is given all of it. `''`
 * until mounted: the server cannot see the element, so SSR renders the bag
 * without the contract and the client adds it on mount.
 */
type ChildKind = '' | 'native' | 'link' | 'other';

function childKind(el: HTMLElement | null): ChildKind {
    const tag = el?.tagName ?? '';
    if (!tag) return '';
    if (tag === 'A') return 'link';
    // The tags `synthesizesClickFrom` knows click from both keys.
    return synthesizesClickFrom(el, ' ') ? 'native' : 'other';
}

const ButtonRoot = component<ButtonRootProps>(({ props, slots, signal, onMounted, onUpdated }) => {
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const child = signal({ kind: '' as ChildKind });
    // Re-read after every update too: the slot may swap the element.
    const readKind = (): void => {
        if (!props.asChild) return;
        const kind = childKind(el);
        if (kind !== child.kind) child.kind = kind;
    };
    onMounted(readKind);
    onUpdated(readKind);
    // A Space press on a synthesized button activates on release, like the
    // native one does — and only if the press started here.
    let spaceDown = false;
    // One ref for the part's life: a ref that changed between renders is
    // patched as detach(null) + attach(el), which every lender chained
    // through `lend` would feel on every re-render.
    const setEl = (node: HTMLElement | null): void => { el = node; };
    // Always on: one listener set, zero work until a press, and whether
    // anything visible happens is the design system's call (CSS on
    // data-pressed / data-press-animating / --press-*), not the app's.
    // Loading blocks activation like disabled does, without the native
    // attribute (see the prop).
    const inert = (): boolean => !!props.disabled || !!props.loading;
    const press = createPressFeedback({
        owner: { scope: SCOPE, part: 'root' },
        getElement: () => el,
        isDisabled: inert,
    });

    const bag = (): PartProps => {
        const attrs = htmlAttrs(props);
        const kind = props.asChild ? child.kind : '';
        const disabled = !!props.disabled;
        const focusableDisabled = disabled && !!props.focusableWhenDisabled;
        // The button contract for an element that has none of it: a role
        // (unless the app named one), a tab stop, and keyboard activation
        // below. A disabled one leaves the tab order but stays
        // click-focusable; focusableWhenDisabled keeps the stop.
        const contract: Record<string, unknown> = kind === 'other'
            ? { role: attrs.role ?? 'button', tabIndex: disabled && !focusableDisabled ? -1 : 0 }
            // A disabled link must not navigate: no href at all, not a
            // cancelled click alone (middle-click, "open in new tab" and the
            // context menu never reach onClick). Without an href an <a> is no
            // longer a link to AT, so the role says it still is one.
            : kind === 'link' && disabled
                ? { href: undefined, role: attrs.role ?? 'link', tabIndex: focusableDisabled ? 0 : -1 }
                // A native control disables natively, as the built-in <button>
                // does: out of the tab order, and no longer a form's implicit
                // submitter (Enter in a field would otherwise still post
                // through it). Only where the element has the attribute — a
                // <summary> does not — and never when focusableWhenDisabled
                // trades it for aria-disabled. Absent rather than `false`
                // otherwise, so the element's own `disabled` survives.
                : kind === 'native' && disabled && !focusableDisabled && el && 'disabled' in el
                    ? { disabled: true }
                    : {};
        // The lent bag merges under the Button's own: its anatomy dropped,
        // its handlers and ref chained first, and — while the Button is
        // inert — its activation handlers skipped.
        return mergePartProps(props.lend, {
            // First, so the part's own attributes win on any name both set.
            ...attrs,
            'data-scope': SCOPE,
            'data-part': 'root',
            // In the bag so a lent class concatenates; kept off an asChild bag,
            // where the slot's element owns its class.
            ...(props.asChild ? {} : { class: props.class }),
            'data-state': props.loading ? 'loading' : undefined,
            'data-disabled': dataAttr(props.disabled),
            'data-focus-visible': dataAttr(focus.visible),
            // A native <button disabled> is inert already; an asChild <a> is not,
            // so disabled has to be conveyed and enforced by hand there.
            // The literal string: ARIA is string-valued, and a boolean true
            // serializes to an empty attribute, which reads as aria-disabled="".
            // Spread only when it applies, so an app's own `aria-disabled` (the
            // focusable-disabled pattern) survives otherwise. Loading conveys it
            // on every element: the button stays focusable, and a press does
            // nothing.
            ...((props.asChild && props.disabled) || focusableDisabled || props.loading ? { 'aria-disabled': 'true' as const } : {}),
            ...(props.loading ? { 'aria-busy': 'true' as const } : {}),
            ...contract,
            ...variantAttrs(props),
            ref: setEl,
            onClick: (e: MouseEvent) => {
                if (inert()) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                props.onClick?.(e);
            },
            // Middle-click never fires `click`; on an inert link it would still
            // open the target in a new tab.
            onAuxclick: (e: MouseEvent) => {
                if (inert()) e.preventDefault();
            },
            onKeydown: (e: KeyboardEvent) => {
                if (inert()) {
                    // A focusable inert button still owns Space: the page
                    // must not scroll under it, as it does not under a native one.
                    if (kind === 'other' && e.key === ' ') e.preventDefault();
                    return;
                }
                press.onKeydown(e);
                props.onKeydown?.(e);
                if (e.defaultPrevented || kind !== 'other' || synthesizesClickFrom(e.currentTarget, e.key)) return;
                // The native button's timing: Enter activates on press (and
                // repeats while held, like the platform's), Space on release.
                if (e.key === 'Enter') {
                    e.preventDefault();
                    el?.click();
                } else if (e.key === ' ') {
                    // Also keeps the page from scrolling.
                    e.preventDefault();
                    spaceDown = true;
                }
            },
            onKeyup: (e: KeyboardEvent) => {
                press.onKeyup(e);
                if (e.key !== ' ' || !spaceDown) return;
                spaceDown = false;
                if (kind === 'other' && !inert()) el?.click();
            },
            onFocus: (e: FocusEvent) => {
                focus.visible = isFocusVisible(el);
                props.onFocus?.(e);
            },
            onBlur: (e: FocusEvent) => {
                press.onBlur(e);
                spaceDown = false;
                focus.visible = false;
                props.onBlur?.(e);
            },
            onPointerdown: press.onPointerdown,
            onPointerup: press.onPointerup,
            onPointercancel: press.onPointercancel,
            onPointerleave: press.onPointerleave,
        });
    };

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <button
                type={props.type ?? 'button'}
                name={props.name}
                value={props.value}
                form={props.form}
                // focusableWhenDisabled trades the native attribute for
                // aria-disabled (in the bag) — the native one drops focus.
                disabled={props.disabled && !props.focusableWhenDisabled}
                {...b}
            >
                {props.loading ? <span data-scope={SCOPE} data-part="spinner" aria-hidden="true" /> : null}
                {slots.default?.(b)}
            </button>
        );
    };
}, { name: 'Button.Root' });

export const Button = compound(ButtonRoot, { Root: ButtonRoot });
