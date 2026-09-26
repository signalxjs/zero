/**
 * Breadcrumbs — the trail from the hierarchy's root to the current page.
 *
 * ```tsx
 * <Breadcrumbs.Root>
 *     <Breadcrumbs.List>
 *         <Breadcrumbs.Item>
 *             <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
 *             <Breadcrumbs.Separator />
 *         </Breadcrumbs.Item>
 *         <Breadcrumbs.Item>
 *             <Breadcrumbs.Link href="/docs/anatomy" current>Anatomy</Breadcrumbs.Link>
 *         </Breadcrumbs.Item>
 *     </Breadcrumbs.List>
 * </Breadcrumbs.Root>
 * ```
 *
 * The APG breadcrumb pattern — see `anatomy.ts` for the semantics
 * decisions (nav + ol, `current` as the activation state, the aria-hidden
 * separator). Links navigate; the browser does the rest.
 *
 * A long trail collapses (#295): with `maxItems` set and more items than
 * that, the middle items render `hidden` (`data-state="closed"`) and the
 * `Breadcrumbs.Ellipsis` the consumer placed after the leading items opens
 * in their place. Its trigger expands the trail (`model:expanded`) and
 * moves focus to the first revealed link.
 *
 * ```tsx
 * <Breadcrumbs.Root maxItems={3}>
 *     <Breadcrumbs.List>
 *         <Breadcrumbs.Item>…Home…</Breadcrumbs.Item>
 *         <Breadcrumbs.Ellipsis>
 *             <Breadcrumbs.EllipsisTrigger />
 *             <Breadcrumbs.Separator />
 *         </Breadcrumbs.Ellipsis>
 *         <Breadcrumbs.Item>…</Breadcrumbs.Item>
 *         …
 *     </Breadcrumbs.List>
 * </Breadcrumbs.Root>
 * ```
 */
import { component, compound, defineInjectable, defineProvide, signal } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, namedModel, type ControllableState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createListController, type ListController, type ListItem } from '../../behaviors/list.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { renderAsChild } from '../../contract/as-child.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { breadcrumbsAnatomy } from './anatomy.js';

const SCOPE = breadcrumbsAnatomy.scope;

/**
 * What the Root shares with its parts — and with the app: an ellipsis made
 * into a `Menu.Trigger` (or anything else) reads `hiddenCount()` and
 * `hiddenIndices()` here to render the crumbs the collapse hid.
 */
export interface BreadcrumbsContext {
    /** The items, registered in DOM order. */
    list: ListController;
    /** `model:expanded` — the trail shows every item while true. */
    expanded: ControllableState<boolean>;
    /** A collapse is active: `maxItems` is exceeded and the trail is not expanded. */
    collapsed(): boolean;
    /** DOM-order indices of the items the collapse hides (empty when none). */
    hiddenIndices(): number[];
    /** How many items the collapse hides. */
    hiddenCount(): number;
    /** Whether the collapse hides this item. */
    isHidden(item: ListItem): boolean;
    /** Expand the trail and move focus to the first revealed link. */
    expand(): void;
    /** From an item's or the ellipsis's mount/unmount: the registry changed. */
    changed(): void;
    /** The ellipsis registers its element for the placement check. */
    setEllipsis(el: HTMLElement | null): void;
}

function makeInert(): BreadcrumbsContext {
    return {
        list: createListController(),
        expanded: createInertState<boolean>(false),
        collapsed: () => false,
        hiddenIndices: () => [],
        hiddenCount: () => 0,
        isHidden: () => false,
        expand: () => {},
        changed: () => {},
        setEllipsis: () => {},
    };
}

export const useBreadcrumbsContext = defineInjectable<BreadcrumbsContext>(() => makeInert());

/** The first focusable thing inside a revealed item — its link, as a rule. */
function focusTarget(item: HTMLElement): HTMLElement | null {
    return item.querySelector<HTMLElement>(`[data-scope="${SCOPE}"][data-part="link"]`)
        ?? item.querySelector<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
}

// ── Root ──

export type BreadcrumbsRootProps =
    /** Accessible name of the navigation landmark. Default: "Breadcrumb" (APG). */
    & Define.Prop<'label', string, false>
    /**
     * Collapse the trail when it has more items than this: the items between
     * the leading `itemsBeforeCollapse` and the trailing `itemsAfterCollapse`
     * hide behind the `Breadcrumbs.Ellipsis`. Absent → never collapses.
     */
    & Define.Prop<'maxItems', number, false>
    /** Items kept before the ellipsis while collapsed. Default 1. */
    & Define.Prop<'itemsBeforeCollapse', number, false>
    /** Items kept after the ellipsis while collapsed. Default 1. */
    & Define.Prop<'itemsAfterCollapse', number, false>
    /** Whether a collapsible trail shows every item (the ellipsis trigger sets it). */
    & Define.Model<'expanded', boolean>
    & Define.Prop<'defaultExpanded', boolean, false>
    & Define.Event<'expandedChange', boolean>
    & WithVariantAxes<'breadcrumbs'>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const BreadcrumbsRoot = component<BreadcrumbsRootProps>(({ props, slots, emit, onMounted }) => {
    const expanded = createControllableState<boolean>(
        () => namedModel<boolean>(props.expanded),
        props.defaultExpanded ?? false,
        (v) => emit('expandedChange', v),
    );
    const list = createListController();
    // Registration is not reactive, and during the first render pass an item
    // sees only the items registered before it. The Root settles once
    // mounted (the registry is complete) and items bump the version as they
    // come and go, so every item's hidden reading recomputes — the same
    // shape as the roving tab stop. Until then nothing hides: a server
    // render ships the whole trail, and the collapse applies on mount.
    const registry = signal({ settled: false, version: 0 });
    let ellipsisEl: HTMLElement | null = null;

    const items = (): ListItem[] => {
        void registry.version;
        return registry.settled ? list.items() : [];
    };
    // A non-finite count (NaN from a parsed attribute) falls back to the
    // default rather than reaching Array.from as an invalid length.
    const count = (n: number | undefined, fallback: number): number =>
        Math.max(0, Math.floor(typeof n === 'number' && Number.isFinite(n) ? n : fallback));

    const hiddenIndices = (): number[] => {
        const max = props.maxItems;
        // NaN reads as absent, never as "collapse everything".
        if (max == null || Number.isNaN(max) || expanded.value) return [];
        const total = items().length;
        if (total <= max) return [];
        const before = count(props.itemsBeforeCollapse, 1);
        const after = count(props.itemsAfterCollapse, 1);
        // Nothing left to hide between the kept ends: show the whole trail.
        if (before + after >= total) return [];
        return Array.from({ length: total - before - after }, (_, i) => before + i);
    };

    const checkPlacement = (): void => {
        const hidden = hiddenIndices();
        if (hidden.length === 0) return;
        // Not `isConnected`: a root can mount inside a subtree that is
        // attached to the document only afterwards, and document position
        // within that subtree is still well defined.
        if (!ellipsisEl) {
            console.warn(
                '[zero] Breadcrumbs.Root collapses its trail (maxItems) but renders no Breadcrumbs.Ellipsis: '
                + 'the hidden items have no way back. Place a Breadcrumbs.Ellipsis after the leading items.',
            );
            return;
        }
        const leading = items().filter((i) => {
            const el = i.el();
            return !!el && !!(el.compareDocumentPosition(ellipsisEl!) & Node.DOCUMENT_POSITION_FOLLOWING);
        }).length;
        if (leading !== hidden[0]) {
            console.warn(
                `[zero] Breadcrumbs.Ellipsis is misplaced: it follows ${leading} item(s), but the collapse keeps `
                + `${hidden[0]} before it (itemsBeforeCollapse). Place it right after the leading items.`,
            );
        }
    };

    const ctx: BreadcrumbsContext = {
        list,
        expanded,
        collapsed: () => hiddenIndices().length > 0,
        hiddenIndices,
        hiddenCount: () => hiddenIndices().length,
        isHidden: (item) => {
            const hidden = hiddenIndices();
            return hidden.length > 0 && hidden.includes(items().indexOf(item));
        },
        expand: () => {
            const hidden = hiddenIndices();
            const first = hidden.length > 0 ? items()[hidden[0]!]?.el() : null;
            expanded.value = true;
            // The trigger hides with the ellipsis, which would drop focus
            // to <body>: hand it to the first revealed crumb once the
            // re-render has removed its `hidden`.
            if (!first) return;
            const move = (): void => {
                const target = focusTarget(first);
                if (target && !first.hidden) target.focus();
            };
            queueMicrotask(() => {
                if (!first.hidden) move();
                else requestAnimationFrame(move);
            });
        },
        changed: () => { if (registry.settled) registry.version++; },
        setEllipsis: (el) => { ellipsisEl = el; },
    };
    defineProvide(useBreadcrumbsContext, () => ctx);

    onMounted(() => {
        registry.settled = true;
        registry.version++;
        checkPlacement();
    });

    return () => {
        const attrs = htmlAttrs(props);
        return (
            <nav
                {...attrs}
                aria-label={props.label ?? attrs['aria-label'] ?? 'Breadcrumb'}
                data-scope={SCOPE}
                data-part="root"
                {...variantAttrs(props)}
                class={props.class}
            >
                {slots.default?.()}
            </nav>
        );
    };
}, { name: 'Breadcrumbs.Root' });

export type BreadcrumbsPartProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

const BreadcrumbsList = component<BreadcrumbsPartProps>(({ props, slots }) => (
    () => (
        <ol {...htmlAttrs(props)} data-scope={SCOPE} data-part="list" class={props.class}>
            {slots.default?.()}
        </ol>
    )
), { name: 'Breadcrumbs.List' });

const BreadcrumbsItem = component<BreadcrumbsPartProps>(({ props, slots, onMounted, onUnmounted }) => {
    const ctx = useBreadcrumbsContext();
    let el: HTMLElement | null = null;
    const id = createId('zx-breadcrumbs-item');
    const item: ListItem = {
        id,
        value: id,
        disabled: () => false,
        el: () => el,
        textValue: () => el?.textContent?.trim() ?? '',
    };
    const unregister = ctx.list.register(item);
    onMounted(() => ctx.changed());
    onUnmounted(() => {
        unregister();
        ctx.changed();
    });

    return () => {
        // The item's own separator sits inside it, so it hides with it.
        const hidden = ctx.isHidden(item);
        return (
            <li
                {...htmlAttrs(props)}
                data-scope={SCOPE}
                data-part="item"
                data-state={stateAttr(!hidden, 'open', 'closed')}
                hidden={hidden || undefined}
                class={props.class}
                ref={(node: HTMLElement | null) => { el = node; }}
            >
                {slots.default?.()}
            </li>
        );
    };
}, { name: 'Breadcrumbs.Item' });

/**
 * The stand-in for the hidden items: rendered by the consumer after the
 * leading items (a console warning names a misplaced one), open only while
 * a collapse is active and `hidden` otherwise. It holds the
 * `Breadcrumbs.EllipsisTrigger` and, like an item, its own separator.
 */
const BreadcrumbsEllipsis = component<BreadcrumbsPartProps>(({ props, slots, onMounted, onUnmounted }) => {
    const ctx = useBreadcrumbsContext();
    onMounted(() => ctx.changed());
    onUnmounted(() => {
        ctx.setEllipsis(null);
        ctx.changed();
    });
    return () => {
        const open = ctx.collapsed();
        return (
            <li
                {...htmlAttrs(props)}
                data-scope={SCOPE}
                data-part="ellipsis"
                data-state={stateAttr(open, 'open', 'closed')}
                hidden={!open || undefined}
                class={props.class}
                ref={(node: HTMLElement | null) => { if (node) ctx.setEllipsis(node); }}
            >
                {slots.default?.()}
            </li>
        );
    };
}, { name: 'Breadcrumbs.Ellipsis' });

export type BreadcrumbsEllipsisTriggerProps =
    /**
     * The trigger's accessible name, given the number of hidden items.
     * Default: "Show N more breadcrumbs".
     */
    & Define.Prop<'label', (hiddenCount: number) => string, false>
    & WithClass
    & WithHtmlAttrs
    & WithAsChild
    & Define.Slot<'default', PartProps>;

/**
 * The button that brings the hidden items back. Its default activation
 * expands the trail and moves focus to the first revealed link. With
 * `asChild` the bag goes to the consumer's element, so an app that wants a
 * menu of the hidden crumbs instead composes it with a `Menu.Trigger`
 * (spreading the menu's bag over this one) and renders the items from the
 * context's `hiddenIndices()`. Content defaults to `…`.
 */
const BreadcrumbsEllipsisTrigger = component<BreadcrumbsEllipsisTriggerProps>(({ props, slots }) => {
    const ctx = useBreadcrumbsContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => false,
    });

    const bag = (): PartProps => {
        const attrs = htmlAttrs(props);
        const n = ctx.hiddenCount();
        return {
            ...attrs,
            'data-scope': SCOPE,
            'data-part': 'ellipsis-trigger',
            'data-focus-visible': dataAttr(focus.visible),
            'aria-label': props.label ? props.label(n) : attrs['aria-label'] ?? `Show ${n} more breadcrumbs`,
            'aria-expanded': 'false',
            ref: (node: HTMLElement | null) => { el = node; },
            onClick: () => ctx.expand(),
            onKeydown: press.onKeydown,
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
        };
    };

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <button type="button" class={props.class} {...b}>
                {slots.default ? slots.default(b) : '…'}
            </button>
        );
    };
}, { name: 'Breadcrumbs.EllipsisTrigger' });

export type BreadcrumbsLinkProps =
    & Define.Prop<'href', string, false>
    /** This is the page the user is on: `aria-current="page"` + `data-state="active"`. */
    & Define.Prop<'current', boolean, false>
    & WithClass
    & WithHtmlAttrs
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const BreadcrumbsLink = component<BreadcrumbsLinkProps>(({ props, slots }) => {
    const bag = (): PartProps => ({
        ...htmlAttrs(props),
        'data-scope': SCOPE,
        'data-part': 'link',
        'data-state': stateAttr(props.current, 'active', 'inactive'),
        'aria-current': props.current ? 'page' : undefined,
        // The bag carries everything the built-in <a> would have — an
        // asChild consumer spreading onto their own anchor keeps the
        // destination without restating it.
        href: props.href,
    });

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <a href={props.href} class={props.class} {...b}>
                {slots.default?.(b)}
            </a>
        );
    };
}, { name: 'Breadcrumbs.Link' });

const BreadcrumbsSeparator = component<BreadcrumbsPartProps>(({ props, slots }) => (
    () => (
        <span {...htmlAttrs(props)} aria-hidden="true" data-scope={SCOPE} data-part="separator" class={props.class}>
            {slots.default ? slots.default() : '/'}
        </span>
    )
), { name: 'Breadcrumbs.Separator' });

export const Breadcrumbs = compound(BreadcrumbsRoot, {
    Root: BreadcrumbsRoot,
    List: BreadcrumbsList,
    Item: BreadcrumbsItem,
    Link: BreadcrumbsLink,
    Separator: BreadcrumbsSeparator,
    Ellipsis: BreadcrumbsEllipsis,
    EllipsisTrigger: BreadcrumbsEllipsisTrigger,
});
