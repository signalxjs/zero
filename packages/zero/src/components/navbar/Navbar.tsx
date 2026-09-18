/**
 * Navbar — the landmark header bar.
 *
 * ```tsx
 * <Navbar.Root>
 *     <Navbar.Start>Acme</Navbar.Start>
 *     <Navbar.Center>
 *         <nav aria-label="Primary">…links…</nav>
 *     </Navbar.Center>
 *     <Navbar.End><Button.Root>Sign in</Button.Root></Navbar.End>
 * </Navbar.Root>
 * ```
 *
 * Root renders a `<header>` (the banner landmark at document scope — see
 * the anatomy comment for why it is not a `<nav>`); the sections are plain
 * containers the recipes distribute along the bar. All three are optional.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithVariantAxes } from '../../contract/props.js';
import { navbarAnatomy } from './anatomy.js';

const SCOPE = navbarAnatomy.scope;

export type NavbarRootProps =
    & WithVariantAxes<'navbar'>
    & WithClass
    & Define.Slot<'default'>;

const NavbarRoot = component<NavbarRootProps>(({ props, slots }) => (
    () => (
        <header
            data-scope={SCOPE}
            data-part="root"
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
        </header>
    )
), { name: 'Navbar.Root' });

export type NavbarSectionProps = WithClass & Define.Slot<'default'>;

const section = (partName: 'start' | 'center' | 'end', name: string) =>
    component<NavbarSectionProps>(({ props, slots }) => (
        () => (
            <div data-scope={SCOPE} data-part={partName} class={props.class}>
                {slots.default?.()}
            </div>
        )
    ), { name });

const NavbarStart = section('start', 'Navbar.Start');
const NavbarCenter = section('center', 'Navbar.Center');
const NavbarEnd = section('end', 'Navbar.End');

export const Navbar = compound(NavbarRoot, {
    Root: NavbarRoot,
    Start: NavbarStart,
    Center: NavbarCenter,
    End: NavbarEnd,
});
