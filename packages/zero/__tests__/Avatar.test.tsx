import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { Avatar, avatarAnatomy } from '@sigx/zero';
import type { AvatarStatus, PartProps } from '@sigx/zero';
import { expectAnatomy } from './helpers';

/** Initial status resolution is deferred one microtask past mount. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('Avatar', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    function parts() {
        return {
            root: container.querySelector<HTMLElement>('[data-part="root"]')!,
            image: container.querySelector<HTMLElement>('[data-part="image"]')!,
            fallback: container.querySelector<HTMLElement>('[data-part="fallback"]')!,
        };
    }

    it('renders a valid anatomy, loading until the image resolves', () => {
        render(
            <Avatar.Root>
                <Avatar.Image src="/me.png" alt="Me" />
                <Avatar.Fallback>ME</Avatar.Fallback>
            </Avatar.Root>,
            container,
        );
        expectAnatomy(container, avatarAnatomy);
        const { root, image, fallback } = parts();
        expect(root.getAttribute('data-state')).toBe('loading');
        expect(image.getAttribute('data-state')).toBe('loading');
        expect(image.getAttribute('src')).toBe('/me.png');
        expect(image.getAttribute('alt')).toBe('Me');
        expect(fallback.getAttribute('data-state')).toBe('loading');
        expect(fallback.hasAttribute('hidden')).toBe(false);
    });

    it('exactly one representation is in the accessibility tree at a time', () => {
        render(
            <Avatar.Root>
                <Avatar.Image src="/me.png" alt="Me" />
                <Avatar.Fallback>ME</Avatar.Fallback>
            </Avatar.Root>,
            container,
        );
        const { image, fallback } = parts();
        // Loading: the fallback speaks, the image stays silent.
        expect(image.getAttribute('aria-hidden')).toBe('true');
        expect(fallback.hasAttribute('hidden')).toBe(false);
        image.dispatchEvent(new Event('load'));
        // Loaded: the image speaks, the fallback is gone entirely.
        expect(image.hasAttribute('aria-hidden')).toBe(false);
        expect(fallback.hasAttribute('hidden')).toBe(true);
    });

    it('load event moves every part to loaded and hides the fallback', () => {
        const events: AvatarStatus[] = [];
        render(
            <Avatar.Root onStatusChange={(s) => events.push(s)}>
                <Avatar.Image src="/me.png" alt="Me" />
                <Avatar.Fallback>ME</Avatar.Fallback>
            </Avatar.Root>,
            container,
        );
        const { root, image, fallback } = parts();
        image.dispatchEvent(new Event('load'));
        expect(root.getAttribute('data-state')).toBe('loaded');
        expect(image.getAttribute('data-state')).toBe('loaded');
        expect(fallback.getAttribute('data-state')).toBe('loaded');
        expect(fallback.hasAttribute('hidden')).toBe(true);
        expect(image.hasAttribute('hidden')).toBe(false);
        expect(events).toEqual(['loaded']);
    });

    it('error event shows the fallback and hides the broken image', () => {
        render(
            <Avatar.Root>
                <Avatar.Image src="/broken.png" alt="" />
                <Avatar.Fallback>ME</Avatar.Fallback>
            </Avatar.Root>,
            container,
        );
        const { root, image, fallback } = parts();
        image.dispatchEvent(new Event('error'));
        expect(root.getAttribute('data-state')).toBe('error');
        expect(image.hasAttribute('hidden')).toBe(true);
        expect(fallback.hasAttribute('hidden')).toBe(false);
    });

    it('no src resolves to error on mount', async () => {
        render(
            <Avatar.Root>
                <Avatar.Image alt="" />
                <Avatar.Fallback>ME</Avatar.Fallback>
            </Avatar.Root>,
            container,
        );
        await tick();
        expect(parts().root.getAttribute('data-state')).toBe('error');
        expect(parts().fallback.hasAttribute('hidden')).toBe(false);
    });

    async function withCachedImage(naturalWidthValue: number, run: () => Promise<void>) {
        const proto = HTMLImageElement.prototype;
        const complete = Object.getOwnPropertyDescriptor(proto, 'complete');
        const naturalWidth = Object.getOwnPropertyDescriptor(proto, 'naturalWidth');
        Object.defineProperty(proto, 'complete', { configurable: true, get: () => true });
        Object.defineProperty(proto, 'naturalWidth', { configurable: true, get: () => naturalWidthValue });
        try {
            await run();
        } finally {
            if (complete) Object.defineProperty(proto, 'complete', complete);
            else Reflect.deleteProperty(proto, 'complete');
            if (naturalWidth) Object.defineProperty(proto, 'naturalWidth', naturalWidth);
            else Reflect.deleteProperty(proto, 'naturalWidth');
        }
    }

    it('an already-complete cached image is detected without a load event', async () => {
        await withCachedImage(64, async () => {
            render(
                <Avatar.Root>
                    <Avatar.Image src="/cached.png" alt="" />
                    <Avatar.Fallback>ME</Avatar.Fallback>
                </Avatar.Root>,
                container,
            );
            await tick();
            expect(parts().root.getAttribute('data-state')).toBe('loaded');
        });
    });

    it('a cached failure (complete, no pixels) resolves to error without an error event', async () => {
        await withCachedImage(0, async () => {
            render(
                <Avatar.Root>
                    <Avatar.Image src="/cached-broken.png" alt="" />
                    <Avatar.Fallback>ME</Avatar.Fallback>
                </Avatar.Root>,
                container,
            );
            await tick();
            expect(parts().root.getAttribute('data-state')).toBe('error');
            expect(parts().image.hasAttribute('hidden')).toBe(true);
        });
    });

    // The src-swap reset lives in a `watch` on props.src. Plain props are
    // only reactive under the sigx compiler (the vite plugin), which the
    // vitest JSX transform does not run, so that path is exercised in the
    // playground rather than here.

    it('asChild image keeps load detection through the spread bag', () => {
        render(
            <Avatar.Root>
                <Avatar.Image src="/me.png" alt="Me" asChild>
                    {(p: PartProps) => <img {...p} data-custom="" />}
                </Avatar.Image>
                <Avatar.Fallback>ME</Avatar.Fallback>
            </Avatar.Root>,
            container,
        );
        const image = container.querySelector<HTMLElement>('[data-custom]')!;
        expect(image.getAttribute('data-part')).toBe('image');
        image.dispatchEvent(new Event('load'));
        expect(parts().root.getAttribute('data-state')).toBe('loaded');
    });
});
