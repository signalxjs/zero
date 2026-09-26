/**
 * Avatar — image with graceful fallback.
 *
 * ```tsx
 * <Avatar.Root>
 *     <Avatar.Image src="/me.png" alt="Andreas Ekdahl" />
 *     <Avatar.Fallback>AE</Avatar.Fallback>
 * </Avatar.Root>
 * ```
 *
 * Display-only (no model): every part mirrors the image load status as
 * `data-state="loading|loaded|error"`. A missing `src` resolves to `error`.
 * Zero toggles `hidden` — fallback while `loaded`, image while `error` (the
 * broken-image glyph) — and styles nothing. Server markup always renders
 * `loading`; the status resolves on mount (a microtask after render), so the
 * fallback is what paints until the image reports in. A root with no
 * `Avatar.Image` at all settles to `error` a microtask after mount — the
 * fallback is then the avatar, not a placeholder stuck `loading` (#274).
 *
 * `Avatar.Fallback delay={ms}` keeps the fallback out of the DOM for that
 * long, so a fast image never flashes initials first. The timer is
 * client-only: server markup renders no fallback while a delay is set.
 */
import { component, compound, defineInjectable, defineProvide, watch } from 'sigx';
import type { Define } from 'sigx';
import { countPresence, reportPresence, settleAfterMount } from '../../behaviors/part-presence.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import { renderAsChild } from '../../contract/as-child.js';
import type { PartProps, WithAsChild, WithClass, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { avatarAnatomy } from './anatomy.js';

const SCOPE = avatarAnatomy.scope;

export type AvatarStatus = 'loading' | 'loaded' | 'error';

interface AvatarContext {
    status(): AvatarStatus;
    setStatus(s: AvatarStatus): void;
    /** The Image reports its presence: with none, the avatar is its fallback. */
    setImagePresent(present: boolean): void;
}

function makeInert(): AvatarContext {
    return { status: () => 'error', setStatus: () => {}, setImagePresent: () => {} };
}

export const useAvatarContext = defineInjectable<AvatarContext>(() => makeInert());

// ── Root ──

export type AvatarRootProps =
    & Define.Event<'statusChange', AvatarStatus>
    & WithVariantAxes<'avatar'>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const AvatarRoot = component<AvatarRootProps>(({ props, slots, emit, signal, onMounted }) => {
    const state = signal({ status: 'loading' as AvatarStatus });
    // Plain counters: nothing renders from them, only the settle reads them.
    let images = 0;
    let settled = false;
    const setStatus = (s: AvatarStatus): void => {
        if (state.status === s) return;
        state.status = s;
        emit('statusChange', s);
    };
    // No Image after the mount settles (or the last one gone since) — there
    // is nothing left to load, so the fallback is the avatar.
    const settle = (): void => {
        if (settled && images === 0) setStatus('error');
    };
    settleAfterMount(onMounted, () => { settled = true; settle(); });
    const ctx: AvatarContext = {
        status: () => state.status,
        setStatus,
        setImagePresent: (p) => {
            images = countPresence(images, p);
            settle();
        },
    };
    defineProvide(useAvatarContext, () => ctx);

    return () => (
        <span
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="root"
            data-state={ctx.status()}
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
        </span>
    );
}, { name: 'Avatar.Root' });

// ── Image ──

export type AvatarImageProps =
    & Define.Prop<'src', string, false>
    // Required: once loaded, the image is the avatar's ONLY accessible
    // representation (the fallback is hidden). Pass alt="" only for an
    // avatar that is genuinely decorative next to a visible name.
    & Define.Prop<'alt', string, true>
    & WithClass
    & WithHtmlAttrs
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const AvatarImage = component<AvatarImageProps>(({ props, slots, onMounted, onUnmounted }) => {
    const avatar = useAvatarContext();
    let el: HTMLElement | null = null;
    /** The element's own load/error event has settled the status. */
    let answered = false;
    reportPresence(avatar.setImagePresent, onUnmounted);

    watch(
        () => props.src,
        (src, prev) => {
            if (src === prev) return;
            answered = false;
            avatar.setStatus(src ? 'loading' : 'error');
        },
    );

    onMounted(() => {
        // Deferred: a status write during the mount pass is invisible to the
        // root, whose render is still executing. Server markup stays `loading`.
        queueMicrotask(() => {
            if (!props.src) {
                // No src can never load.
                avatar.setStatus('error');
                return;
            }
            // A cached image settles before hydration attaches the handlers —
            // the rendered element itself is the probe, in both directions: a
            // complete image with no pixels is one whose error event already
            // fired.
            const img = el as HTMLImageElement | null;
            if (img?.complete) avatar.setStatus(img.naturalWidth > 0 ? 'loaded' : 'error');
            // An image mounted into a root that had already settled on
            // `error` (none was there) has something to load again — unless
            // its own load/error event already answered.
            else if (!answered) avatar.setStatus('loading');
        });
    });

    const bag = (): PartProps => ({
        ...htmlAttrs(props),
        'data-scope': SCOPE,
        'data-part': 'image',
        'data-state': avatar.status(),
        src: props.src,
        alt: props.alt,
        hidden: avatar.status() === 'error' ? true : undefined,
        // Until the image is what the avatar shows, the fallback is the one
        // accessible representation — otherwise AT announces initials AND alt.
        'aria-hidden': avatar.status() === 'loaded' ? undefined : 'true',
        onLoad: () => { answered = true; avatar.setStatus('loaded'); },
        onError: () => { answered = true; avatar.setStatus('error'); },
        ref: (node: HTMLElement | null) => { el = node; },
    });

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return <img class={props.class} {...b} />;
    };
}, { name: 'Avatar.Image' });

// ── Fallback ──

export type AvatarFallbackProps =
    /**
     * Milliseconds the fallback stays out of the DOM, so a fast image never
     * flashes initials first. Client-only: server markup renders no
     * fallback while it is set.
     */
    & Define.Prop<'delay', number, false>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const AvatarFallback = component<AvatarFallbackProps>(({ props, slots, signal, onMounted, onUnmounted }) => {
    const avatar = useAvatarContext();
    const wait = signal({ over: !(props.delay && props.delay > 0) });
    let timer: ReturnType<typeof setTimeout> | undefined;
    onMounted(() => {
        if (wait.over) return;
        timer = setTimeout(() => { wait.over = true; }, props.delay);
    });
    onUnmounted(() => { if (timer !== undefined) clearTimeout(timer); });
    return () => !wait.over ? null : (
        <span
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="fallback"
            data-state={avatar.status()}
            hidden={avatar.status() === 'loaded'}
            class={props.class}
        >
            {slots.default?.()}
        </span>
    );
}, { name: 'Avatar.Fallback' });

export const Avatar = compound(AvatarRoot, {
    Root: AvatarRoot,
    Image: AvatarImage,
    Fallback: AvatarFallback,
});
