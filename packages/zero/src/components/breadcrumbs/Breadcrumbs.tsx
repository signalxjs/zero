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
 * Pure anatomy over the APG breadcrumb pattern — see `anatomy.ts` for the
 * semantics decisions (nav + ol, `current` as the activation state, the
 * aria-hidden separator). No behavior: links navigate, the browser does the
 * rest.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { renderAsChild } from '../../contract/as-child.js';
import { stateAttr } from '../../contract/data-attrs.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { breadcrumbsAnatomy } from './anatomy.js';

const SCOPE = breadcrumbsAnatomy.scope;

export type BreadcrumbsRootProps =
    /** Accessible name of the navigation landmark. Default: "Breadcrumb" (APG). */
    & Define.Prop<'label', string, false>
    & WithVariantAxes<'breadcrumbs'>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const BreadcrumbsRoot = component<BreadcrumbsRootProps>(({ props, slots }) => () => {
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
}, { name: 'Breadcrumbs.Root' });

export type BreadcrumbsPartProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

const BreadcrumbsList = component<BreadcrumbsPartProps>(({ props, slots }) => (
    () => (
        <ol {...htmlAttrs(props)} data-scope={SCOPE} data-part="list" class={props.class}>
            {slots.default?.()}
        </ol>
    )
), { name: 'Breadcrumbs.List' });

const BreadcrumbsItem = component<BreadcrumbsPartProps>(({ props, slots }) => (
    () => (
        <li {...htmlAttrs(props)} data-scope={SCOPE} data-part="item" class={props.class}>
            {slots.default?.()}
        </li>
    )
), { name: 'Breadcrumbs.Item' });

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
});
