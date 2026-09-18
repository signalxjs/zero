import { component, signal } from 'sigx';
import { Avatar, Button } from '@sigx/zero';
import { pickVariant } from '../design-systems';
import { DemoRow } from '../demo/Section';
import { AVATAR_A, AVATAR_B } from './fixtures';
import type { PageEntry } from './registry';

const AvatarDemos = component(() => {
    const state = signal({ avatarSrc: AVATAR_A });

    return () => (
        <>
            <p>
                Image with graceful fallback: every part mirrors the load status
                as <code>data-state</code>, a broken or missing <code>src</code>
                shows the fallback, and the design system decides shape and fill.
                Swapping the src resets to <code>loading</code> until the new
                image reports in.
            </p>
            <DemoRow gap="0.75rem">
                <Avatar.Root>
                    <Avatar.Image src={AVATAR_A} alt="A loaded avatar" />
                    <Avatar.Fallback>OK</Avatar.Fallback>
                </Avatar.Root>
                <Avatar.Root>
                    <Avatar.Image src="/definitely-missing.png" alt="A broken avatar" />
                    <Avatar.Fallback>404</Avatar.Fallback>
                </Avatar.Root>
                <Avatar.Root>
                    <Avatar.Image alt="No image at all" />
                    <Avatar.Fallback>ZX</Avatar.Fallback>
                </Avatar.Root>
                <Avatar.Root>
                    <Avatar.Image src={state.avatarSrc} alt="A swappable avatar" />
                    <Avatar.Fallback>…</Avatar.Fallback>
                </Avatar.Root>
                {/*
                  * Picked, never named — the same rule the Button page's rows
                  * follow. `outline` was hardcoded here: five of the
                  * six design systems declare it and carbon does not,
                  * so under carbon this button carried a `data-variant`
                  * nothing in the sheet matched and rendered as the
                  * bare recipe base. Silent, because an unmatched axis
                  * value is just an attribute nobody styled — which is
                  * what the smoke spec's vocabulary invariant exists to
                  * make loud.
                  */}
                <Button.Root
                    variant={pickVariant('outline', 'tertiary', 'secondary')}
                    onClick={() => { state.avatarSrc = state.avatarSrc === AVATAR_A ? AVATAR_B : AVATAR_A; }}
                >
                    Swap src
                </Button.Root>
            </DemoRow>
        </>
    );
}, { name: 'AvatarDemos' });

export const avatarPage: PageEntry = {
    id: 'avatar',
    title: 'Avatar',
    category: 'Display & feedback',
    Demos: AvatarDemos,
};
