/**
 * Toolbar — `role="toolbar"` with ONE tab stop (#440: zero has no toolbar).
 *
 * ```tsx
 * <Toolbar.Root label="Message actions">
 *     <Toolbar.Group><Button.Root>Archive</Button.Root>…</Toolbar.Group>
 *     <Toolbar.Separator />
 *     <Button.Root>…</Button.Root>
 * </Toolbar.Root>
 * ```
 *
 * The children are zero components that know nothing of the toolbar, so
 * zero's list registration (`createListController`) cannot reach them. The
 * roving is therefore DOM-derived: the toolbar's items are its focusable
 * descendants outside any popup, re-read on every key and focus — the same
 * shape the APG toolbar pattern describes, and the part of this component a
 * zero-native toolbar would do through registration instead.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { htmlAttrs, variantAttrs } from '@sigx/zero';
import type { WithClass, WithHtmlAttrs, WithVariantAxesOpen } from '@sigx/zero';
import { toolbarAnatomy } from './anatomy.js';

const SCOPE = toolbarAnatomy.scope;

const FOCUSABLE = 'button, input:not([type="hidden"]), a[href], [role="button"], [role="checkbox"], [role="switch"], [tabindex]';
/** Anything inside these is a popup's content, not a toolbar item. */
const POPUP = '[popover], dialog, [role="menu"], [role="listbox"], [role="dialog"]';

function items(root: HTMLElement): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
        if (el.closest('[role="toolbar"]') !== root) return false;
        const popup = el.closest(POPUP);
        if (popup && root.contains(popup)) return false;
        if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return false;
        // Zero's Checkbox focuses its (visually hidden) native input, which is
        // the item; anything else not laid out is not.
        return el.getClientRects().length > 0;
    });
}

function settle(root: HTMLElement, current: HTMLElement | undefined): void {
    const all = items(root);
    const stop = current && all.includes(current) ? current : all[0];
    for (const el of all) el.tabIndex = el === stop ? 0 : -1;
}

export type ToolbarRootProps =
    & WithVariantAxesOpen<'mail-toolbar'>
    & WithClass
    /** Not `role`: the root is always a `toolbar`. */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Prop<'label', string, true>
    & Define.Prop<'orientation', 'horizontal' | 'vertical', false>
    & Define.Slot<'default'>;

const ToolbarRoot = component<ToolbarRootProps>(({ props, slots, onMounted, onUnmounted }) => {
    let root: HTMLElement | null = null;
    let current: HTMLElement | undefined;
    let observer: MutationObserver | undefined;

    onMounted(() => {
        if (!root) return;
        settle(root, current);
        // Items come and go (a bulk-action group appears on selection); keep
        // exactly one stop without waiting for the next key.
        observer = new MutationObserver(() => { if (root) settle(root, current); });
        observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'aria-disabled'] });
    });
    onUnmounted(() => observer?.disconnect());

    const keys = (): Record<string, 1 | -1 | 'first' | 'last'> => (props.orientation === 'vertical'
        ? { ArrowDown: 1, ArrowUp: -1, Home: 'first', End: 'last' }
        : { ArrowRight: 1, ArrowLeft: -1, Home: 'first', End: 'last' });

    const onKeydown = (e: KeyboardEvent): void => {
        if (!root || e.defaultPrevented) return;
        const step = keys()[e.key];
        if (step === undefined) return;
        const target = e.target as HTMLElement;
        // Keys typed into a text field stay the field's.
        if (target instanceof HTMLInputElement && target.type !== 'checkbox' && target.type !== 'radio') return;
        const all = items(root);
        if (all.length === 0) return;
        const at = all.indexOf(target.closest(FOCUSABLE) as HTMLElement);
        if (at === -1) return;
        let next: number;
        if (step === 'first') next = 0;
        else if (step === 'last') next = all.length - 1;
        else next = (at + step + all.length) % all.length;
        e.preventDefault();
        current = all[next];
        settle(root, current);
        current?.focus();
    };

    const onFocusin = (e: FocusEvent): void => {
        if (!root) return;
        const target = (e.target as HTMLElement).closest(FOCUSABLE) as HTMLElement | null;
        if (target && items(root).includes(target)) {
            current = target;
            settle(root, current);
        }
    };

    return () => (
        <div
            ref={(el: HTMLElement | null) => { root = el; }}
            class={props.class}
            {...htmlAttrs(props)}
            role="toolbar"
            aria-label={props.label}
            aria-orientation={props.orientation ?? 'horizontal'}
            data-scope={SCOPE}
            data-part="root"
            data-orientation={props.orientation ?? 'horizontal'}
            {...variantAttrs(props)}
            onKeydown={onKeydown}
            onFocusin={onFocusin}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Toolbar.Root' });

export type ToolbarGroupProps = WithClass & Omit<WithHtmlAttrs, 'role'> & Define.Prop<'label', string, false> & Define.Slot<'default'>;

const ToolbarGroup = component<ToolbarGroupProps>(({ props, slots }) => () => (
    <div class={props.class} {...htmlAttrs(props)} role="group" aria-label={props.label} data-scope={SCOPE} data-part="group">
        {slots.default?.()}
    </div>
), { name: 'Toolbar.Group' });

const ToolbarSeparator = component<WithClass>(({ props }) => () => (
    // Decorative: the groups already carry the structure, so the rule is not announced.
    <div class={props.class} aria-hidden="true" data-scope={SCOPE} data-part="separator" />
), { name: 'Toolbar.Separator' });

export const Toolbar = compound(ToolbarRoot, { Root: ToolbarRoot, Group: ToolbarGroup, Separator: ToolbarSeparator });
