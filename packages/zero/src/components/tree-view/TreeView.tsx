/**
 * TreeView — the WAI-ARIA APG tree pattern, unstyled.
 *
 * ```tsx
 * <TreeView.Root model={() => state.selected} defaultExpandedValues={['src']}>
 *     <TreeView.Label>Files</TreeView.Label>
 *     <TreeView.Tree>
 *         <TreeView.Branch value="src">
 *             <TreeView.BranchTrigger>
 *                 <TreeView.BranchIndicator />src
 *             </TreeView.BranchTrigger>
 *             <TreeView.BranchContent>
 *                 <TreeView.Item value="src/index.ts">index.ts</TreeView.Item>
 *             </TreeView.BranchContent>
 *         </TreeView.Branch>
 *         <TreeView.Item value="README.md">README.md</TreeView.Item>
 *     </TreeView.Tree>
 * </TreeView.Root>
 * ```
 *
 * Named-models convention: the unnamed `model` is the selected value (the
 * essential state); `model:expandedValues` is the branch expansion set,
 * with the standard `defaultExpandedValues` + `expandedValuesChange` companions.
 * Single selection in v1.
 *
 * The keyboard walks VISIBLE nodes — the tree controller implements the
 * flat list interface over them, so roving and typeahead are the same
 * behaviors every list component uses, unchanged. ArrowRight expands a
 * closed branch, then steps to the first child; ArrowLeft collapses an
 * open branch, else climbs to the parent; Enter/Space select (selection
 * and expansion are separate acts). Collapsed content stays mounted and
 * `hidden` — nodes keep their registration, they just stop being visible
 * to navigation.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define, Model } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { createRovingKeydown } from '../../behaviors/roving.js';
import { createTypeahead } from '../../behaviors/typeahead.js';
import { createTreeController, type TreeController, type TreeItem } from '../../behaviors/tree.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type {
    PartProps,
    WithAsChild,
    WithClass,
    WithDisabled,
    WithHtmlAttrs,
    WithVariantAxes,
} from '../../contract/props.js';
import { isRtl } from '../../behaviors/direction.js';
import { treeViewAnatomy } from './anatomy.js';

const SCOPE = treeViewAnatomy.scope;

/**
 * The text a reader is given: descend like `textContent`, but skip anything
 * `aria-hidden` — decorative glyphs (the default BranchIndicator's `›`) are
 * invisible to AT and must be invisible to typeahead too.
 */
function visibleText(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (node instanceof Element && node.getAttribute('aria-hidden') === 'true') return '';
    let text = '';
    for (const child of node.childNodes) text += visibleText(child);
    return text;
}

interface TreeNodeInfo {
    value: string;
    isBranch: boolean;
    parentValue: string | null;
}

interface TreeViewContext {
    selected: ControllableState<string>;
    tree: TreeController;
    labelId(): string;
    disabled(): boolean;
    isExpanded(value: string): boolean;
    toggleBranch(value: string): void;
    select(value: string): void;
    isTabbable(value: string): boolean;
    /** From a node's mount/unmount: the registry changed, re-derive the stop. */
    nodesChanged(): void;
    keydown(e: KeyboardEvent, node: TreeNodeInfo): void;
    /** A typeahead search is running — Space is search text, not a press. */
    searching(): boolean;
    setRoot(el: HTMLElement | null): void;
}

interface TreeBranchContext {
    /** null at the root level (the fallback provider). */
    value: string | null;
    /**
     * The branch element owns focus (it is the treeitem); the row mirrors
     * it so recipes ring the row, never the whole subtree.
     */
    focus: { visible: boolean };
    /**
     * The BranchTrigger hands the branch its element, so typeahead reads
     * the row it was given — an `asChild` row may carry the app's own
     * `data-scope`/`data-part`, which a part-name query cannot find (#157).
     */
    setTrigger(el: HTMLElement | null): void;
}

function makeInert(): TreeViewContext {
    return {
        selected: createInertState<string>(''),
        tree: createTreeController({ isExpanded: () => true }),
        labelId: () => 'zx-tree-inert',
        disabled: () => false,
        isExpanded: () => false,
        toggleBranch: () => {},
        select: () => {},
        isTabbable: () => false,
        nodesChanged: () => {},
        keydown: () => {},
        searching: () => false,
        setRoot: () => {},
    };
}

export const useTreeViewContext = defineInjectable<TreeViewContext>(() => makeInert());
export const useTreeBranchContext = defineInjectable<TreeBranchContext>(
    () => ({ value: null, focus: { visible: false }, setTrigger: () => {} }),
);

// ── Root ──

export type TreeViewRootProps =
    & Define.Model<string>
    & Define.Prop<'defaultValue', string, false>
    & Define.Event<'valueChange', string>
    & Define.Model<'expandedValues', string[]>
    & Define.Prop<'defaultExpandedValues', string[], false>
    & Define.Event<'expandedValuesChange', string[]>
    & WithDisabled
    & WithVariantAxes<'tree-view'>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const TreeViewRoot = component<TreeViewRootProps>(({ props, slots, emit, onMounted, signal }) => {
    const selected = createControllableState<string>(
        () => props.model,
        props.defaultValue ?? '',
        (v) => emit('valueChange', v),
    );
    const expanded = createControllableState<string[]>(
        () => props.expandedValues as Model<string[]> | undefined,
        props.defaultExpandedValues ?? [],
        (v) => emit('expandedValuesChange', v),
    );
    const baseId = createId('zx-tree');
    let rootEl: HTMLElement | null = null;

    const isExpanded = (value: string): boolean => expanded.value.includes(value);
    const tree = createTreeController({ isExpanded });

    const rtl = (): boolean => isRtl(rootEl);

    // The registry isn't reactive (#165): `settled` flips once the root has
    // mounted (every first-render node has registered), and `version` bumps
    // on each later node mount/unmount so `isTabbable` re-derives the stop.
    const registry = signal({ settled: false, version: 0 });
    onMounted(() => {
        registry.settled = true;
        registry.version++;
    });

    const roving = createRovingKeydown({
        list: tree,
        orientation: () => 'vertical',
        loop: () => false,
        onMove: () => {},
    });
    const typeahead = createTypeahead({
        list: tree,
        onMatch: (item) => item.el()?.focus(),
    });

    const toggleBranch = (value: string): void => {
        if (props.disabled) return;
        expanded.value = isExpanded(value)
            ? expanded.value.filter((v) => v !== value)
            : [...expanded.value, value];
    };

    /**
     * The nearest enabled visible node BEFORE `value` (`forward`, so a step
     * forward from it lands after `value`) or AFTER it (a step back lands
     * before `value`); null when that side has none.
     */
    const standIn = (value: string, forward: boolean): string | null => {
        const visible = tree.visibleItems();
        const at = visible.findIndex((n) => n.value === value);
        if (at === -1) return null;
        const side = forward ? visible.slice(0, at).reverse() : visible.slice(at + 1);
        return side.find((n) => !n.disabled())?.value ?? null;
    };

    const ctx: TreeViewContext = {
        selected,
        tree,
        labelId: () => `${baseId}-label`,
        disabled: () => !!props.disabled,
        isExpanded,
        toggleBranch,
        select(value) {
            if (props.disabled) return;
            selected.value = value;
        },
        nodesChanged() {
            if (registry.settled) registry.version++;
        },
        isTabbable(value) {
            // One tab stop: the selected node while it is VISIBLE and
            // enabled, else the first visible enabled node — a selection
            // hidden under a collapsed branch must not leave the tree
            // unreachable by keyboard. Selection and expansion are both
            // reactive reads, so this recomputes on every change; only the
            // initial render can transiently see an incomplete registry
            // (a second stop that heals on the first interaction), which
            // beats a permanently missing one.
            void registry.version;
            const sel = selected.value;
            if (sel !== '') {
                const selNode = tree.findNode(sel);
                // Unregistered BEFORE the root mounts means "registers later
                // this render pass" — the claim stands, or the initial render
                // would hand a second stop to the first node. Once mounted,
                // an unregistered value names nothing (a typo, a removed
                // node, #165) and falls back like a registered-but-hidden
                // (collapsed ancestor) or disabled one.
                if (!selNode) {
                    if (!registry.settled) return sel === value;
                } else if (!selNode.disabled() && tree.find(sel)) return sel === value;
            }
            return tree.enabledItems()[0]?.value === value;
        },
        searching: () => typeahead.searching(),
        keydown(e, node) {
            if (props.disabled) return;
            const expandKey = rtl() ? 'ArrowLeft' : 'ArrowRight';
            const collapseKey = rtl() ? 'ArrowRight' : 'ArrowLeft';
            // A disabled node still gets focus from a pointer (tabindex=-1
            // takes a click's focus), so its keys must still NAVIGATE —
            // only activation and expansion stay blocked (#177).
            const inert = !!tree.findNode(node.value)?.disabled();

            if (e.key === expandKey) {
                e.preventDefault();
                if (node.isBranch && !isExpanded(node.value)) {
                    if (!inert) toggleBranch(node.value);
                } else if (node.isBranch) {
                    tree.childrenOf(node.value).find((c) => !c.disabled())?.el()?.focus();
                }
                return;
            }
            if (e.key === collapseKey) {
                e.preventDefault();
                if (node.isBranch && isExpanded(node.value)) {
                    if (!inert) toggleBranch(node.value);
                } else if (node.parentValue !== null) {
                    tree.findNode(node.parentValue)?.el()?.focus();
                }
                return;
            }
            // Space continues a running typeahead search ("Save As").
            if (e.key === 'Enter' || (e.key === ' ' && !typeahead.searching())) {
                e.preventDefault();
                if (!inert) ctx.select(node.value);
                return;
            }
            // Roving and typeahead index the ENABLED nodes, where a disabled
            // one is absent (Down would jump to the first node, Up to the
            // last, typeahead would search from the top). Stand in its
            // nearest enabled neighbour on the side the key moves away
            // from, so a step lands on the node next to it. Home/End need
            // no stand-in: they ignore where they start.
            if (!inert) {
                roving(e, node.value);
                if (!e.defaultPrevented) typeahead(e, node.value);
                return;
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                roving(e, standIn(node.value, e.key === 'ArrowDown') ?? node.value);
                return;
            }
            roving(e, node.value);
            if (!e.defaultPrevented) typeahead(e, standIn(node.value, true));
        },
        setRoot: (el) => { rootEl = el; },
    };
    defineProvide(useTreeViewContext, () => ctx);

    return () => (
        <div
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="root"
            data-disabled={dataAttr(props.disabled)}
            {...variantAttrs(props)}
            class={props.class}
            ref={(node: HTMLElement | null) => { rootEl = node; }}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'TreeView.Root' });

// ── Label ──

/** Not `id`: the Tree is labelled by the Label's own. */
export type TreeViewLabelProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const TreeViewLabel = component<TreeViewLabelProps>(({ props, slots }) => {
    const ctx = useTreeViewContext();
    return () => (
        <div {...htmlAttrs(props)} id={ctx.labelId()} data-scope={SCOPE} data-part="label" class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'TreeView.Label' });

// ── Tree ──

/**
 * Not `role`: this is the `tree`. An app `aria-labelledby` joins the
 * Label's.
 */
export type TreeViewTreeProps = WithClass & Omit<WithHtmlAttrs, 'role'> & Define.Slot<'default'>;

const TreeViewTree = component<TreeViewTreeProps>(({ props, slots }) => {
    const ctx = useTreeViewContext();
    return () => {
        const attrs = htmlAttrs(props);
        return (
            <div
                {...attrs}
                role="tree"
                data-scope={SCOPE}
                data-part="tree"
                aria-labelledby={[ctx.labelId(), attrs['aria-labelledby']].filter(Boolean).join(' ')}
                class={props.class}
            >
                {slots.default?.()}
            </div>
        );
    };
}, { name: 'TreeView.Tree' });

// ── Item (leaf) ──

export type TreeViewItemProps =
    & Define.Prop<'value', string, true>
    & WithDisabled
    & WithClass
    /** Not `role`: an item is a `treeitem`. */
    & Omit<WithHtmlAttrs, 'role'>
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const TreeViewItem = component<TreeViewItemProps>(({ props, slots, onMounted, onUnmounted, signal }) => {
    const ctx = useTreeViewContext();
    const branch = useTreeBranchContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });

    const disabled = (): boolean => !!props.disabled || ctx.disabled();
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => disabled(),
    });

    const node: TreeItem = {
        id: `tree-item-${props.value}`,
        get value() { return props.value; },
        parentValue: branch.value,
        isBranch: () => false,
        disabled: () => disabled(),
        el: () => el,
        textValue: () => el?.textContent?.trim() ?? props.value,
    };
    const unregister = ctx.tree.registerNode(node);
    onMounted(() => ctx.nodesChanged());
    onUnmounted(() => {
        unregister();
        ctx.nodesChanged();
    });

    const isSelected = (): boolean => ctx.selected.value === props.value;

    const bag = (): PartProps => ({
        ...htmlAttrs(props),
        'data-scope': SCOPE,
        'data-part': 'item',
        'data-selected': dataAttr(isSelected()),
        'data-disabled': dataAttr(disabled()),
        'data-focus-visible': dataAttr(focus.visible),
        role: 'treeitem',
        tabIndex: ctx.isTabbable(props.value) ? 0 : -1,
        'aria-selected': isSelected() ? 'true' : 'false',
        // No aria-posinset/setsize: the whole tree is in the DOM under
        // proper role=group nesting, so AT computes them — and computing
        // them here at render time would freeze counts before later
        // siblings have registered.
        'aria-level': ctx.tree.level(props.value),
        'aria-disabled': disabled() ? 'true' : undefined,
        ref: (n: HTMLElement | null) => { el = n; },
        onClick: () => {
            if (!disabled()) ctx.select(props.value);
        },
        onKeydown: (e: KeyboardEvent) => {
            // No early return when disabled: press feedback is gated by
            // isDisabled, and ctx.keydown still roves from here (#177).
            // A Space that continues a search is search text, not a press.
            if (!(e.key === ' ' && ctx.searching())) press.onKeydown(e);
            ctx.keydown(e, { value: props.value, isBranch: false, parentValue: branch.value });
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
            <div class={props.class} {...b}>
                {slots.default?.(b)}
            </div>
        );
    };
}, { name: 'TreeView.Item' });

// ── Branch ──

export type TreeViewBranchProps =
    & Define.Prop<'value', string, true>
    & WithDisabled
    & WithClass
    /** Not `role`: a branch is a `treeitem`. */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Slot<'default'>;

const TreeViewBranch = component<TreeViewBranchProps>(({ props, slots, onMounted, onUnmounted, signal }) => {
    const ctx = useTreeViewContext();
    const parent = useTreeBranchContext();
    let el: HTMLElement | null = null;
    let triggerEl: HTMLElement | null = null;
    const focus = signal({ visible: false });

    const disabled = (): boolean => !!props.disabled || ctx.disabled();

    const node: TreeItem = {
        id: `tree-branch-${props.value}`,
        get value() { return props.value; },
        parentValue: parent.value,
        isBranch: () => true,
        disabled: () => disabled(),
        el: () => el,
        // The branch's text is its trigger row, not the whole subtree — and
        // not the row's decoration either: the default BranchIndicator is a
        // `›` glyph, and `textContent` would put it FIRST, so typeahead
        // could never match a branch by the label the user actually reads.
        // What typeahead searches is the accessible text (#326). The row is
        // the element the BranchTrigger registered — whatever an `asChild`
        // row is stamped with (#157) — with the part query as the fallback.
        textValue: () => {
            const row = triggerEl ?? el?.querySelector('[data-part="branch-trigger"]');
            return row ? visibleText(row).trim() || props.value : props.value;
        },
    };
    const unregister = ctx.tree.registerNode(node);
    onMounted(() => ctx.nodesChanged());
    onUnmounted(() => {
        unregister();
        ctx.nodesChanged();
    });

    defineProvide(useTreeBranchContext, () => ({
        value: props.value,
        focus,
        setTrigger: (n) => { triggerEl = n; },
    }));

    const isOpen = (): boolean => ctx.isExpanded(props.value);
    const isSelected = (): boolean => ctx.selected.value === props.value;

    return () => (
        <div
            {...htmlAttrs(props)}
            role="treeitem"
            data-scope={SCOPE}
            data-part="branch"
            data-state={stateAttr(isOpen(), 'open', 'closed')}
            data-selected={dataAttr(isSelected())}
            data-disabled={dataAttr(disabled())}
            tabIndex={ctx.isTabbable(props.value) ? 0 : -1}
            aria-expanded={isOpen() ? 'true' : 'false'}
            aria-selected={isSelected() ? 'true' : 'false'}
            aria-level={ctx.tree.level(props.value)}
            aria-disabled={disabled() ? 'true' : undefined}
            class={props.class}
            ref={(n: HTMLElement | null) => { el = n; }}
            onKeydown={(e: KeyboardEvent) => {
                // Bubbled keydowns from descendant treeitems handle
                // themselves — only events targeting THIS branch count. A
                // disabled branch still navigates (#177); ctx.keydown
                // blocks its selection and expansion.
                if (e.target !== el) return;
                ctx.keydown(e, { value: props.value, isBranch: true, parentValue: parent.value });
            }}
            onFocus={(e: FocusEvent) => {
                if (e.target === el) focus.visible = isFocusVisible(el);
            }}
            onBlur={(e: FocusEvent) => {
                if (e.target === el) focus.visible = false;
            }}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'TreeView.Branch' });

// ── BranchTrigger ──

export type TreeViewBranchTriggerProps =
    & WithClass
    & WithHtmlAttrs
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const TreeViewBranchTrigger = component<TreeViewBranchTriggerProps>(({ props, slots }) => {
    const ctx = useTreeViewContext();
    const branch = useTreeBranchContext();
    let el: HTMLElement | null = null;

    const value = (): string => branch.value ?? '';
    const disabled = (): boolean => ctx.disabled() || !!ctx.tree.findNode(value())?.disabled();
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => disabled(),
    });

    const bag = (): PartProps => ({
        ...htmlAttrs(props),
        'data-scope': SCOPE,
        'data-part': 'branch-trigger',
        'data-state': stateAttr(ctx.isExpanded(value()), 'open', 'closed'),
        'data-selected': dataAttr(ctx.selected.value === value()),
        'data-disabled': dataAttr(disabled()),
        // The branch element (the treeitem) owns focus; the row mirrors it
        // so recipes ring the row, never the whole subtree.
        'data-focus-visible': dataAttr(branch.focus.visible),
        ref: (n: HTMLElement | null) => {
            el = n;
            branch.setTrigger(n);
        },
        onClick: () => {
            if (disabled()) return;
            ctx.toggleBranch(value());
            // Toggling from the pointer parks focus on the branch (the
            // treeitem), so keyboard continues from where the user is.
            ctx.tree.findNode(value())?.el()?.focus();
        },
        onKeydown: press.onKeydown,
        onKeyup: press.onKeyup,
        // Safety net for asChild rows that are themselves focusable: a key
        // held across a focus move must not strand data-pressed.
        onBlur: press.onBlur,
        onPointerdown: press.onPointerdown,
        onPointerup: press.onPointerup,
        onPointercancel: press.onPointercancel,
        onPointerleave: press.onPointerleave,
    });

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <div class={props.class} {...b}>
                {slots.default?.(b)}
            </div>
        );
    };
}, { name: 'TreeView.BranchTrigger' });

// ── BranchIndicator ──

export type TreeViewBranchIndicatorProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

const TreeViewBranchIndicator = component<TreeViewBranchIndicatorProps>(({ props, slots }) => {
    const ctx = useTreeViewContext();
    const branch = useTreeBranchContext();
    return () => (
        <span
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="branch-indicator"
            data-state={stateAttr(ctx.isExpanded(branch.value ?? ''), 'open', 'closed')}
            aria-hidden="true"
            class={props.class}
        >
            {slots.default ? slots.default() : '›'}
        </span>
    );
}, { name: 'TreeView.BranchIndicator' });

// ── BranchContent ──

/** Not `role`: the content is the branch's `group`. */
export type TreeViewBranchContentProps = WithClass & Omit<WithHtmlAttrs, 'role'> & Define.Slot<'default'>;

const TreeViewBranchContent = component<TreeViewBranchContentProps>(({ props, slots }) => {
    const ctx = useTreeViewContext();
    const branch = useTreeBranchContext();
    const isOpen = (): boolean => ctx.isExpanded(branch.value ?? '');
    return () => (
        <div
            {...htmlAttrs(props)}
            role="group"
            data-scope={SCOPE}
            data-part="branch-content"
            data-state={stateAttr(isOpen(), 'open', 'closed')}
            hidden={!isOpen()}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'TreeView.BranchContent' });

export const TreeView = compound(TreeViewRoot, {
    Root: TreeViewRoot,
    Label: TreeViewLabel,
    Tree: TreeViewTree,
    Item: TreeViewItem,
    Branch: TreeViewBranch,
    BranchTrigger: TreeViewBranchTrigger,
    BranchIndicator: TreeViewBranchIndicator,
    BranchContent: TreeViewBranchContent,
});
