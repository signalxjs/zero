/**
 * MailList + MailRow — a virtualised, keyboard-navigable message list.
 *
 * ```tsx
 * <MailList.Root label="Inbox" count={ids.length} itemKey={(i) => ids[i]}
 *     model={() => st.highlight} onOpen={(i) => open(ids[i])} onToggle={(i) => select(ids[i])}
 *     renderRow={(i) => <MailRow.Root index={i} active={…} selected={…} mods={{ unread: … }}>…</MailRow.Root>} />
 * ```
 *
 * Zero ships the windowing (`createVirtualList`) but only as a behavior: the
 * scroll box, the list, the padding that stands in for unrendered rows and
 * the measured row elements are all the app's markup (#440). This wraps that
 * markup as parts, and adds the roving the list needs on top: one tab stop
 * (the highlighted row), ArrowUp/Down/Home/End/PageUp/PageDown move it, Enter
 * opens, Space toggles selection. Rows keep their own controls (a checkbox,
 * a star) — a row's click opens only when it did not land on one of them.
 */
import { component, compound, defineInjectable, defineProvide, watch } from 'sigx';
import type { Define, Model } from 'sigx';
import { createControllableState, createInertState, createVirtualList, dataAttr, htmlAttrs, isFocusVisible, mergePartProps, variantAttrs } from '@sigx/zero';
import type { PartProps, VirtualList, WithClass, WithHtmlAttrs, WithLend, WithVariantAxesOpen } from '@sigx/zero';
import { mailListAnatomy, mailRowAnatomy } from './anatomy.js';

interface MailListContext {
    highlight: Model<number>;
    virtual: VirtualList | null;
    open(index: number): void;
    focus(index: number): void;
}

export const useMailListContext = defineInjectable<MailListContext>(() => ({
    highlight: createInertState<number>(0),
    virtual: null,
    open: () => {},
    focus: () => {},
}));

/** Interactive descendants whose clicks and keys are their own, not the row's. */
const OWN_CONTROL = 'button, input, label, a[href], textarea, select, [role="button"], [role="checkbox"]';

export type MailListRootProps =
    & WithVariantAxesOpen<'mail-list'>
    & WithClass
    /** Not `role`: the list is always a `list`. */
    & Omit<WithHtmlAttrs, 'role'>
    /**
     * Another zero part's asChild bag — a `Menu.ContextTrigger`'s (#450), so
     * the list itself is the right-click surface with no wrapper around it.
     * Merged through zero's public `mergePartProps`: the lent ref and
     * handlers run first, and the list keeps its own anatomy.
     */
    & WithLend
    & Define.Prop<'label', string, true>
    & Define.Prop<'count', number, true>
    & Define.Prop<'itemKey', (index: number) => string, true>
    & Define.Prop<'renderRow', (index: number) => unknown, true>
    & Define.Prop<'estimateSize', number, false>
    /** Change it to start over at the top — a new folder, a new search. */
    & Define.Prop<'scrollKey', string, false>
    & Define.Model<number>
    & Define.Prop<'defaultHighlight', number, false>
    & Define.Event<'highlightChange', number>
    /** Enter on a row, or a click that did not land on one of its controls. */
    & Define.Event<'open', number>
    /** Space on a row — the selection toggle. */
    & Define.Event<'toggle', number>;

const MailListRoot = component<MailListRootProps>(({ props, emit, onMounted }) => {
    const highlight = createControllableState<number>(
        () => props.model,
        props.defaultHighlight ?? 0,
        (v) => emit('highlightChange', v),
    );
    const virtual = createVirtualList({
        count: () => props.count,
        key: (i) => props.itemKey(i),
        estimateSize: props.estimateSize ?? 72,
        overscan: 6,
    });
    let content: HTMLElement | null = null;

    const rowEl = (index: number): HTMLElement | null =>
        content?.querySelector<HTMLElement>(`[data-scope="mail-row"][data-index="${index}"]`) ?? null;

    const focus = (index: number): void => {
        virtual.scrollToIndex(index, 'auto');
        // The row may be outside the window until the scroll lands.
        requestAnimationFrame(() => requestAnimationFrame(() => rowEl(index)?.focus({ preventScroll: true })));
    };

    const clamp = (i: number): number => Math.max(0, Math.min(props.count - 1, i));

    // The highlight is the app's too (j/k): follow it into view whoever moved it.
    let mounted = false;
    onMounted(() => { mounted = true; });
    watch(() => highlight.value, (i) => {
        if (mounted && props.count > 0) virtual.scrollToIndex(clamp(i), 'auto');
    });
    watch(() => props.scrollKey, () => {
        if (mounted && props.count > 0) virtual.scrollToIndex(0, 'start');
    });

    const ctx: MailListContext = {
        highlight,
        get virtual() { return virtual; },
        open: (index) => emit('open', index),
        focus,
    };
    defineProvide(useMailListContext, () => ctx);

    const PAGE = 8;
    const onKeydown = (e: KeyboardEvent): void => {
        const row = (e.target as HTMLElement).closest<HTMLElement>('[data-scope="mail-row"]');
        if (!row || e.target !== row || props.count === 0) return;
        const at = Number(row.dataset.index);
        const moves: Record<string, number> = {
            ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: props.count - 1,
            PageDown: at + PAGE, PageUp: at - PAGE,
        };
        if (e.key in moves) {
            e.preventDefault();
            const next = clamp(moves[e.key]!);
            highlight.value = next;
            focus(next);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            emit('open', at);
        } else if (e.key === ' ') {
            e.preventDefault();
            emit('toggle', at);
        }
    };

    return () => (
        <div
            {...mergePartProps(props.lend, {
                ref: virtual.viewportRef,
                ...htmlAttrs(props),
                'data-scope': mailListAnatomy.scope,
                'data-part': 'root',
                ...variantAttrs(props),
                class: props.class,
            })}
        >
            <div
                ref={(el: HTMLElement | null) => { content = el; virtual.listRef(el); }}
                role="list"
                aria-label={props.label}
                data-scope={mailListAnatomy.scope}
                data-part="content"
                style={{ paddingBlockStart: `${virtual.before()}px`, paddingBlockEnd: `${virtual.after()}px` }}
                onKeydown={onKeydown}
            >
                {virtual.rows().map((row) => (
                    <MailListSlot key={row.key} index={row.index} rowKey={row.key} render={props.renderRow} />
                ))}
            </div>
        </div>
    );
}, { name: 'MailList.Root' });

/** Keys the rendered row by message, so a re-sorted list reuses the right element. */
const MailListSlot = component<
    & Define.Prop<'index', number, true>
    & Define.Prop<'rowKey', string, true>
    & Define.Prop<'render', (index: number) => unknown, true>
>(({ props }) => () => props.render(props.index) as JSX.Element, { name: 'MailList.Slot' });

export type MailRowRootProps =
    & WithVariantAxesOpen<'mail-row'>
    & WithClass
    /** Not `role`: the row is always a `listitem`. */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Prop<'index', number, true>
    & Define.Prop<'itemKey', string, true>
    /** The message open in the reading pane — `data-state="active"`, `aria-current`. */
    & Define.Prop<'active', boolean, false>
    /** Checked for a bulk action — `data-selected`. */
    & Define.Prop<'selected', boolean, false>
    & Define.Slot<'default'>;

const MailRowRoot = component<MailRowRootProps>(({ props, slots, signal }) => {
    const list = useMailListContext();
    const focus = signal({ visible: false });
    let el: HTMLElement | null = null;
    return () => {
        const virtual = list.virtual;
        const measure = virtual?.measureRef(props.itemKey);
        return (
            <div
                ref={(node: HTMLElement | null) => { el = node; measure?.(node); }}
                class={props.class}
                {...htmlAttrs(props)}
                role="listitem"
                tabIndex={list.highlight.value === props.index ? 0 : -1}
                aria-current={props.active ? 'true' : undefined}
                aria-setsize={virtual?.count()}
                aria-posinset={props.index + 1}
                data-index={props.index}
                data-scope={mailRowAnatomy.scope}
                data-part="root"
                data-state={props.active ? 'active' : 'inactive'}
                data-selected={dataAttr(props.selected)}
                // The keyboard cursor (j/k, arrows) — shown even while focus is elsewhere.
                data-highlighted={dataAttr(list.highlight.value === props.index)}
                data-focus-visible={dataAttr(focus.visible)}
                {...variantAttrs(props)}
                onFocus={() => {
                    focus.visible = isFocusVisible(el);
                    list.highlight.value = props.index;
                }}
                onBlur={() => { focus.visible = false; }}
                // A context menu over the list acts on the row it opened on.
                onContextmenu={() => { list.highlight.value = props.index; }}
                onClick={(e: MouseEvent) => {
                    const own = (e.target as HTMLElement).closest(OWN_CONTROL);
                    if (own && own !== el && el?.contains(own)) return;
                    list.highlight.value = props.index;
                    list.open(props.index);
                }}
            >
                {slots.default?.()}
            </div>
        );
    };
}, { name: 'MailRow.Root' });

export const MailList = compound(MailListRoot, { Root: MailListRoot });
export const MailRow = compound(MailRowRoot, { Root: MailRowRoot });
