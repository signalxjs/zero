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
 *
 * The root carries `data-scrolled` while the content it sits over is
 * scrolled past its block-start edge (#530): the document scroller by
 * default, or the element `scrollContainer` names — for a bar above an app
 * shell's scrolling `<main>` rather than a scrolling document.
 */
import { component, compound, toRaw, watch } from 'sigx';
import type { Define } from 'sigx';
import { dataAttr } from '../../contract/data-attrs.js';
import { mountScope } from '../../behaviors/mount-scope.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { WithClass, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { navbarAnatomy } from './anatomy.js';

const SCOPE = navbarAnatomy.scope;

/**
 * The scroll container a navbar watches: the element itself, a ref object
 * (`{ current }`), or a getter — the last two are read after mount, so they
 * may name an element rendered after the bar (a sibling `<main>`).
 */
export type NavbarScrollContainer =
    | HTMLElement
    | { readonly current: HTMLElement | null | undefined }
    | (() => HTMLElement | null | undefined);

export type NavbarRootProps =
    /**
     * The scroll container whose position sets `data-scrolled` (#530). Omit
     * it to watch the document scroller. A ref or getter that is still
     * empty at mount is read again on the next frame; a bar whose container
     * never arrives stays unscrolled.
     */
    & Define.Prop<'scrollContainer', NavbarScrollContainer, false>
    & WithVariantAxes<'navbar'>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

// `toRaw`: an element read through the reactive props is a proxy, and a
// proxy is the wrong receiver for `addEventListener`.
const resolveContainer = (target: NavbarScrollContainer): HTMLElement | null => {
    const raw = toRaw(target);
    const el = typeof raw === 'function'
        ? raw()
        : 'current' in raw && !(typeof Node !== 'undefined' && raw instanceof Node)
            ? raw.current
            : raw as HTMLElement;
    return el ? toRaw(el) : null;
};

const NavbarRoot = component<NavbarRootProps>(({ props, slots, signal, onMounted }) => {
    // False on the server and on the first client render, which must agree;
    // the real position is read on mount.
    const scroll = signal({ scrolled: false });
    const scoped = mountScope();

    onMounted(() => scoped(() => {
        if (typeof window === 'undefined') return;
        const DOCUMENT = 'document' as const;
        watch(
            // Resolved in the source, so a getter reading reactive state
            // re-attaches when that state names another element.
            () => props.scrollContainer === undefined ? DOCUMENT : resolveContainer(props.scrollContainer),
            (target, _prev, onCleanup) => {
                let frame = 0;
                let detach: (() => void) | null = null;
                const attach = (source: HTMLElement | Window, read: () => number): void => {
                    const update = (): void => {
                        const scrolled = read() > 0;
                        if (scroll.scrolled !== scrolled) scroll.scrolled = scrolled;
                    };
                    source.addEventListener('scroll', update, { passive: true });
                    detach = () => source.removeEventListener('scroll', update);
                    update();
                };
                const attachTo = (el: HTMLElement | null): boolean => {
                    if (!el) return false;
                    attach(el, () => el.scrollTop);
                    return true;
                };
                if (target === DOCUMENT) {
                    attach(window, () => (document.scrollingElement ?? document.documentElement).scrollTop);
                } else if (!attachTo(target)) {
                    if (scroll.scrolled) scroll.scrolled = false;
                    // A ref to an element rendered after the bar fills once
                    // the whole tree has mounted: read it once more.
                    if (typeof requestAnimationFrame === 'function') {
                        frame = requestAnimationFrame(() => {
                            frame = 0;
                            const t = props.scrollContainer;
                            if (t !== undefined) attachTo(resolveContainer(t));
                        });
                    }
                }
                onCleanup(() => {
                    if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
                    detach?.();
                });
            },
            { immediate: true },
        );
    }));

    return () => (
        <header
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="root"
            data-scrolled={dataAttr(scroll.scrolled)}
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
        </header>
    );
}, { name: 'Navbar.Root' });

export type NavbarSectionProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

const section = (partName: 'start' | 'center' | 'end', name: string) =>
    component<NavbarSectionProps>(({ props, slots }) => (
        () => (
            <div {...htmlAttrs(props)} data-scope={SCOPE} data-part={partName} class={props.class}>
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
