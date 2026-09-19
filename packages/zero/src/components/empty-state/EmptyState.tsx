/**
 * EmptyState — what stands where the content would be (#131).
 *
 * ```tsx
 * <EmptyState.Root color="error">
 *     <EmptyState.Icon>⚠</EmptyState.Icon>
 *     <EmptyState.Title asChild>{(p) => <h2 {...p}>Could not load your projects</h2>}</EmptyState.Title>
 *     <EmptyState.Description>The server did not answer. Your work is saved.</EmptyState.Description>
 *     <EmptyState.Actions>
 *         <Button.Root onClick={retry}>Try again</Button.Root>
 *         <Button.Root asChild variant="ghost">{(p) => <a href="/status" {...p}>Service status</a>}</Button.Root>
 *     </EmptyState.Actions>
 * </EmptyState.Root>
 * ```
 *
 * No state and no behaviour: presence is the consumer's `if`, and the way
 * out is the consumer's own buttons in `Actions`. What zero contributes is
 * the anatomy the design system paints — the same four parts under every
 * empty, failed and offline view an app has, instead of three hand-written
 * ones.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { renderAsChild } from '../../contract/as-child.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { emptyStateAnatomy } from './anatomy.js';

const SCOPE = emptyStateAnatomy.scope;

// ── Root ──

export type EmptyStateRootProps =
    & WithVariantAxes<'empty-state'>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const EmptyStateRoot = component<EmptyStateRootProps>(({ props, slots }) => () => (
    <div
        {...htmlAttrs(props)}
        data-scope={SCOPE}
        data-part="root"
        {...variantAttrs(props)}
        class={props.class}
    >
        {slots.default?.()}
    </div>
), { name: 'EmptyState.Root' });

// ── Icon ──

export type EmptyStateIconProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

const EmptyStateIcon = component<EmptyStateIconProps>(({ props, slots }) => () => (
    // Decorative, Alert's reasoning: the tone it paints is in the text.
    <span {...htmlAttrs(props)} aria-hidden="true" data-scope={SCOPE} data-part="icon" class={props.class}>
        {slots.default?.()}
    </span>
), { name: 'EmptyState.Icon' });

// ── Title ──

export type EmptyStateTitleProps =
    & WithClass
    & WithHtmlAttrs
    & WithAsChild
    & Define.Slot<'default', PartProps>;

/**
 * `asChild` so the title can be the heading the page's outline wants —
 * which level is the page's call, not the component's.
 */
const EmptyStateTitle = component<EmptyStateTitleProps>(({ props, slots }) => () => {
    const bag: PartProps = { ...htmlAttrs(props), 'data-scope': SCOPE, 'data-part': 'title' };
    if (props.asChild) return renderAsChild(slots.default, bag);
    return (
        <div class={props.class} {...bag}>
            {slots.default?.(bag)}
        </div>
    );
}, { name: 'EmptyState.Title' });

// ── Description ──

export type EmptyStateDescriptionProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

const EmptyStateDescription = component<EmptyStateDescriptionProps>(({ props, slots }) => () => (
    <div {...htmlAttrs(props)} data-scope={SCOPE} data-part="description" class={props.class}>
        {slots.default?.()}
    </div>
), { name: 'EmptyState.Description' });

// ── Actions ──

export type EmptyStateActionsProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

const EmptyStateActions = component<EmptyStateActionsProps>(({ props, slots }) => () => (
    <div {...htmlAttrs(props)} data-scope={SCOPE} data-part="actions" class={props.class}>
        {slots.default?.()}
    </div>
), { name: 'EmptyState.Actions' });

export const EmptyState = compound(EmptyStateRoot, {
    Root: EmptyStateRoot,
    Icon: EmptyStateIcon,
    Title: EmptyStateTitle,
    Description: EmptyStateDescription,
    Actions: EmptyStateActions,
});
