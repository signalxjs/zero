/**
 * NavList — the navigation list an app shell's sidebar is made of (#132).
 *
 * ```tsx
 * <NavList.Root label="Main">
 *     <NavList.Group>
 *         <NavList.Heading>Workspace</NavList.Heading>
 *         <NavList.List>
 *             <NavList.Item>
 *                 <NavList.Link href="/inbox" current={route() === '/inbox'}>
 *                     <NavList.Icon>✉</NavList.Icon>
 *                     Inbox
 *                     <NavList.Meta><Badge>12</Badge></NavList.Meta>
 *                 </NavList.Link>
 *             </NavList.Item>
 *         </NavList.List>
 *     </NavList.Group>
 * </NavList.Root>
 * ```
 *
 * No behaviour: which link is current is the router's knowledge, passed in
 * as `current`. A `Link` is `asChild` for a router's own anchor component.
 * It renders inside a responsive `Drawer.Panel` as it renders anywhere —
 * the drawer decides whether the sidebar is docked or a sheet; the list
 * does not know.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { renderAsChild } from '../../contract/as-child.js';
import { stateAttr } from '../../contract/data-attrs.js';
import { createId } from '../../behaviors/create-id.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { navListAnatomy } from './anatomy.js';

const SCOPE = navListAnatomy.scope;

// ── Root ──

export type NavListRootProps =
    /** Accessible name of the navigation landmark — required by APG when a page has more than one. */
    & Define.Prop<'label', string, false>
    & WithVariantAxes<'nav-list'>
    & WithClass
    /** Not `role`: the root is the `navigation` landmark. */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Slot<'default'>;

const NavListRoot = component<NavListRootProps>(({ props, slots }) => () => {
    const attrs = htmlAttrs(props);
    return (
        <nav
            {...attrs}
            aria-label={props.label ?? attrs['aria-label']}
            data-scope={SCOPE}
            data-part="root"
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
        </nav>
    );
}, { name: 'NavList.Root' });

export type NavListPartProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

// ── Group / Heading ──

interface NavListGroupContext {
    headingId: string;
    setHeadingPresent(present: boolean): void;
}

const useNavListGroup = defineInjectable<NavListGroupContext | null>(() => null);

/**
 * A section of the sidebar. `role="group"`, named by its Heading through
 * `aria-labelledby` — the heading's id is minted here (SSR-safe) and
 * provided down, and the reference is written only while a Heading is
 * actually rendered (Dialog's `titlePresent` seam), so a group without one
 * never points at an element that does not exist. A group with no Heading
 * is an unnamed group; give it `aria-label` if it needs a name. An app
 * `aria-labelledby` or `role` wins. Server-rendered, the reference lands at
 * hydration (nothing re-renders on the server after the heading registers),
 * which is the same shape as a Dialog's title reference.
 */
const NavListGroup = component<NavListPartProps>(({ props, slots, signal }) => {
    const headingId = createId('zx-nav-list-heading');
    // Written from Heading one microtask after its setup — a write made
    // during the render pass is invisible to the already-rendered group
    // (Dialog's reasoning for its `present` flags).
    const present = signal({ heading: false });
    defineProvide(useNavListGroup, () => ({
        headingId,
        setHeadingPresent: (p) => { present.heading = p; },
    }));
    return () => {
        const attrs = htmlAttrs(props);
        const labelledBy = typeof attrs['aria-labelledby'] === 'string'
            ? attrs['aria-labelledby']
            : present.heading ? headingId : undefined;
        return (
            <div
                {...attrs}
                role={typeof attrs.role === 'string' ? attrs.role : 'group'}
                aria-labelledby={labelledBy}
                data-scope={SCOPE}
                data-part="group"
                class={props.class}
            >
                {slots.default?.()}
            </div>
        );
    };
}, { name: 'NavList.Group' });

const NavListHeading = component<NavListPartProps>(({ props, slots, onUnmounted }) => {
    const group = useNavListGroup();
    let alive = true;
    queueMicrotask(() => { if (alive) group?.setHeadingPresent(true); });
    onUnmounted(() => {
        alive = false;
        group?.setHeadingPresent(false);
    });
    return () => {
        const attrs = htmlAttrs(props);
        return (
            <div {...attrs} id={typeof attrs.id === 'string' ? attrs.id : group?.headingId} data-scope={SCOPE} data-part="heading" class={props.class}>
                {slots.default?.()}
            </div>
        );
    };
}, { name: 'NavList.Heading' });

// ── List / Item ──

const NavListList = component<NavListPartProps>(({ props, slots }) => () => (
    <ul {...htmlAttrs(props)} data-scope={SCOPE} data-part="list" class={props.class}>
        {slots.default?.()}
    </ul>
), { name: 'NavList.List' });

const NavListItem = component<NavListPartProps>(({ props, slots }) => () => (
    <li {...htmlAttrs(props)} data-scope={SCOPE} data-part="item" class={props.class}>
        {slots.default?.()}
    </li>
), { name: 'NavList.Item' });

// ── Link ──

export type NavListLinkProps =
    & Define.Prop<'href', string, false>
    /** This is the page the user is on: `aria-current="page"` + `data-state="active"`. */
    & Define.Prop<'current', boolean, false>
    & WithClass
    & WithHtmlAttrs
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const NavListLink = component<NavListLinkProps>(({ props, slots }) => {
    const bag = (): PartProps => ({
        ...htmlAttrs(props),
        'data-scope': SCOPE,
        'data-part': 'link',
        'data-state': stateAttr(props.current, 'active', 'inactive'),
        'aria-current': props.current ? 'page' : undefined,
        // Only when given: an asChild consumer's own `<a href>` must not be
        // clobbered by an undefined one from the bag.
        ...(props.href !== undefined ? { href: props.href } : {}),
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
}, { name: 'NavList.Link' });

// ── Icon / Meta ──

const NavListIcon = component<NavListPartProps>(({ props, slots }) => () => (
    <span {...htmlAttrs(props)} aria-hidden="true" data-scope={SCOPE} data-part="icon" class={props.class}>
        {slots.default?.()}
    </span>
), { name: 'NavList.Icon' });

const NavListMeta = component<NavListPartProps>(({ props, slots }) => () => (
    <span {...htmlAttrs(props)} data-scope={SCOPE} data-part="meta" class={props.class}>
        {slots.default?.()}
    </span>
), { name: 'NavList.Meta' });

export const NavList = compound(NavListRoot, {
    Root: NavListRoot,
    Group: NavListGroup,
    Heading: NavListHeading,
    List: NavListList,
    Item: NavListItem,
    Link: NavListLink,
    Icon: NavListIcon,
    Meta: NavListMeta,
});
