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
 * fallback is what paints until the image reports in.
 */
import { component, compound, defineInjectable, defineProvide, watch } from 'sigx';
import type { Define } from 'sigx';
import { variantAttrs } from '../../contract/props.js';
import { renderAsChild } from '../../contract/as-child.js';
import type { PartProps, WithAsChild, WithClass, WithVariantAxes } from '../../contract/props.js';
import { avatarAnatomy } from './anatomy.js';

const SCOPE = avatarAnatomy.scope;

export type AvatarStatus = 'loading' | 'loaded' | 'error';

interface AvatarContext {
    status(): AvatarStatus;
    setStatus(s: AvatarStatus): void;
}

function makeInert(): AvatarContext {
    return { status: () => 'error', setStatus: () => {} };
}

export const useAvatarContext = defineInjectable<AvatarContext>(() => makeInert());

// ── Root ──

export type AvatarRootProps =
    & Define.Event<'statusChange', AvatarStatus>
    & WithVariantAxes<'avatar'>
    & WithClass
    & Define.Slot<'default'>;

const AvatarRoot = component<AvatarRootProps>(({ props, slots, emit, signal }) => {
    const state = signal({ status: 'loading' as AvatarStatus });
    const ctx: AvatarContext = {
        status: () => state.status,
        setStatus: (s) => {
            if (state.status === s) return;
            state.status = s;
            emit('statusChange', s);
        },
    };
    defineProvide(useAvatarContext, () => ctx);

    return () => (
        <span
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
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const AvatarImage = component<AvatarImageProps>(({ props, slots, onMounted }) => {
    const avatar = useAvatarContext();
    let el: HTMLElement | null = null;

    watch(
        () => props.src,
        (src, prev) => {
            if (src === prev) return;
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
        });
    });

    const bag = (): PartProps => ({
        'data-scope': SCOPE,
        'data-part': 'image',
        'data-state': avatar.status(),
        src: props.src,
        alt: props.alt,
        hidden: avatar.status() === 'error' ? true : undefined,
        // Until the image is what the avatar shows, the fallback is the one
        // accessible representation — otherwise AT announces initials AND alt.
        'aria-hidden': avatar.status() === 'loaded' ? undefined : 'true',
        onLoad: () => avatar.setStatus('loaded'),
        onError: () => avatar.setStatus('error'),
        ref: (node: HTMLElement | null) => { el = node; },
    });

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return <img class={props.class} {...b} />;
    };
}, { name: 'Avatar.Image' });

// ── Fallback ──

export type AvatarFallbackProps = WithClass & Define.Slot<'default'>;

const AvatarFallback = component<AvatarFallbackProps>(({ props, slots }) => {
    const avatar = useAvatarContext();
    return () => (
        <span
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
