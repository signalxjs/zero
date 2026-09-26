/**
 * Menubar — the WAI-ARIA APG menubar, over `Menu`.
 *
 * ```tsx
 * <Menubar.Root aria-label="Editor">
 *     <Menu.Root value="file">
 *         <Menu.Trigger>File</Menu.Trigger>
 *         <Menu.Popup>
 *             <Menu.Item value="new" keyshortcuts="Control+N">
 *                 New <Menu.Shortcut>Ctrl+N</Menu.Shortcut>
 *             </Menu.Item>
 *         </Menu.Popup>
 *     </Menu.Root>
 *     <Menu.Root value="edit">…</Menu.Root>
 * </Menubar.Root>
 * ```
 *
 * The bar is pure coordination: it renders one `role="menubar"` row and
 * every menu in it stays an ordinary `Menu`. Inside a bar, a `Menu.Root`'s
 * open state follows the bar's `value` (the open menu's `value`, `''` when
 * none — `model` / `defaultValue` / `valueChange`), and its `Menu.Trigger`
 * renders `role="menuitem"` with a roving `tabindex`: the bar is one tab
 * stop, the trigger that last had focus (else the first enabled one).
 *
 * Keyboard (horizontal; `orientation="vertical"` moves with Up/Down
 * instead): ArrowLeft/ArrowRight move between triggers (flipped under RTL),
 * Home/End jump, `loop` (default true) wraps. On a trigger, ArrowDown /
 * Enter / Space open its menu on the first item and ArrowUp on the last
 * (vertical: Enter / Space / the inline-end arrow open). Inside an open
 * menu, ArrowRight from an item that does not open a submenu — and
 * ArrowLeft from a top-level item — close it and open the adjacent menu on
 * its first item. Escape closes back to the trigger; Tab closes the chain
 * and moves on. While a menu is open, hovering another trigger switches to
 * its menu.
 */
import { component, compound, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState } from '../../behaviors/controllable.js';
import { createListController } from '../../behaviors/list.js';
import { createRovingKeydown, createRovingTabStop } from '../../behaviors/roving.js';
import { isRtl } from '../../behaviors/direction.js';
import { dataAttr, type Orientation } from '../../contract/data-attrs.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { WithClass, WithDisabled, WithHtmlAttrs, WithOrientation, WithVariantAxes } from '../../contract/props.js';
import { menubarAnatomy } from './anatomy.js';
import { useMenubarContext, type MenubarContext } from './context.js';

export type { MenubarContext } from './context.js';
export { useMenubarContext } from './context.js';

const SCOPE = menubarAnatomy.scope;

export type MenubarRootProps =
    /** The open menu's `value`; `''` while none is open. */
    & Define.Model<string>
    & Define.Prop<'defaultValue', string, false>
    & Define.Event<'valueChange', string>
    /** Arrow keys wrap from the last trigger to the first and back — default true. */
    & Define.Prop<'loop', boolean, false>
    & WithOrientation
    & WithDisabled
    & WithVariantAxes<'menubar'>
    & WithClass
    /** Not `role`: the root is the `menubar`. Name it with `aria-label`. */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Slot<'default'>;

const MenubarRoot = component<MenubarRootProps>(({ props, slots, emit, signal, onMounted }) => {
    const state = createControllableState<string>(
        () => props.model,
        props.defaultValue ?? '',
        (v) => emit('valueChange', v),
    );
    const list = createListController();
    const tabStop = createRovingTabStop(list);
    onMounted(() => tabStop.settle());
    const focus = signal({ last: '' });
    let rootEl: HTMLElement | null = null;
    const orientation = (): Orientation => props.orientation ?? 'horizontal';
    const loop = (): boolean => props.loop ?? true;
    const rtl = (): boolean => isRtl(rootEl);

    const roving = createRovingKeydown({
        list,
        orientation,
        loop,
        rtl,
        onMove: () => {},
    });

    const ctx: MenubarContext = {
        inert: false,
        state,
        list,
        tabStop,
        orientation,
        disabled: () => !!props.disabled,
        rtl,
        root: () => rootEl,
        focused: () => focus.last,
        setFocused: (value) => { focus.last = value; },
        keydown: roving,
        step(from, delta) {
            const items = list.enabledItems();
            if (items.length === 0) return;
            const current = items.findIndex((i) => i.value === from);
            let next = current === -1 ? 0 : current + delta;
            if (next < 0) next = loop() ? items.length - 1 : 0;
            if (next >= items.length) next = loop() ? 0 : items.length - 1;
            const target = items[next]!;
            if (target.value === from) return;
            focus.last = target.value;
            state.value = target.value;
        },
    };
    defineProvide(useMenubarContext, () => ctx);

    return () => (
        <div
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="root"
            data-orientation={orientation()}
            data-disabled={dataAttr(props.disabled)}
            {...variantAttrs(props)}
            role="menubar"
            aria-orientation={orientation()}
            aria-disabled={props.disabled ? 'true' : undefined}
            class={props.class}
            ref={(node: HTMLElement | null) => { rootEl = node; }}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Menubar.Root' });

export const Menubar = compound(MenubarRoot, {
    Root: MenubarRoot,
});
