/**
 * AppShell — the frame: claim the viewport, render `<main>`, scroll a region.
 *
 * ```tsx
 * <AppShell.Root>
 *     <Drawer.Root modal={{ below: 'md' }}>
 *         <Navbar.Root>…</Navbar.Root>
 *         <AppShell.Body>
 *             <Drawer.Panel>…</Drawer.Panel>
 *             <AppShell.Main>
 *                 <Row grow gap="none">
 *                     <AppShell.Region label="Messages">…</AppShell.Region>
 *                     <AppShell.Region label="Reading pane">…</AppShell.Region>
 *                 </Row>
 *             </AppShell.Main>
 *         </AppShell.Body>
 *     </Drawer.Root>
 * </AppShell.Root>
 * ```
 *
 * See `anatomy.ts` for what each part is for.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { htmlAttrs } from '../../contract/props.js';
import type { WithClass, WithHtmlAttrs } from '../../contract/props.js';
import { appShellAnatomy } from './anatomy.js';

const SCOPE = appShellAnatomy.scope;

export type AppShellRootProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;
export type AppShellBodyProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;
export type AppShellMainProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;
export type AppShellRegionProps =
    & WithClass
    & WithHtmlAttrs
    /** Names the region landmark (`aria-label`) — an unnamed `<section>` is not one. */
    & Define.Prop<'label', string, true>
    & Define.Slot<'default'>;

const AppShellRoot = component<AppShellRootProps>(({ props, slots }) => () => (
    <div class={props.class} {...htmlAttrs(props)} data-scope={SCOPE} data-part="root">
        {slots.default?.()}
    </div>
), { name: 'AppShell.Root' });

/** The row under the app bar: a docked sidebar beside `main`, filling the height left. */
const AppShellBody = component<AppShellBodyProps>(({ props, slots }) => () => (
    <div class={props.class} {...htmlAttrs(props)} data-scope={SCOPE} data-part="body">
        {slots.default?.()}
    </div>
), { name: 'AppShell.Body' });

/** The `<main>` landmark. It does not scroll — a region inside it does. */
const AppShellMain = component<AppShellMainProps>(({ props, slots }) => () => (
    <main class={props.class} {...htmlAttrs(props)} data-scope={SCOPE} data-part="main">
        {slots.default?.()}
    </main>
), { name: 'AppShell.Main' });

/**
 * A scrolling column, named as a region landmark. Always `tabindex="0"`:
 * WebKit does not make a scroller focusable, so a text-only region would
 * otherwise be unreachable by keyboard (WCAG 2.1.1, axe's
 * `scrollable-region-focusable`).
 */
const AppShellRegion = component<AppShellRegionProps>(({ props, slots }) => () => (
    <section
        class={props.class}
        {...htmlAttrs(props)}
        aria-label={props.label}
        tabIndex={0}
        data-scope={SCOPE}
        data-part="region"
    >
        {slots.default?.()}
    </section>
), { name: 'AppShell.Region' });

export const AppShell = compound(AppShellRoot, {
    Root: AppShellRoot,
    Body: AppShellBody,
    Main: AppShellMain,
    Region: AppShellRegion,
});
