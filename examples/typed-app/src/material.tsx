/**
 * Program (d): Material 3's component API as an app consumes it (#415).
 *
 * zero-material's `./components` module carries M3's own names — the five
 * common-button styles, `round` / `square`, Expressive's `xs | s | m | l | xl`
 * sizes on buttons and toggles, and the icon-button and FAB configurations as
 * booleans. Checked against the EMITTED `dist/components.d.ts` through
 * package exports, with no register import in the program.
 */
import { component } from 'sigx';
import { Button, Toggle } from '@sigx/zero-material/components';

export const App = component(() => () => (
    <>
        <Button.Root variant="tonal" size="s">Save</Button.Root>
        <Button.Root variant="outlined" shape="square" size="m">Share</Button.Root>
        <Button.Root fab icon color="tertiary" aria-label="Compose">+</Button.Root>
        <Toggle.Root variant="elevated" icon aria-label="Favourite">♥</Toggle.Root>

        <Button.Root
            /* @ts-expect-error — zero's `sm` is respelled `s` on this surface */
            size="sm"
        >
            Nope
        </Button.Root>
        <Toggle.Root
            /* @ts-expect-error — M3 never toggles a text button */
            variant="text"
        >
            Nope
        </Toggle.Root>
    </>
), { name: 'TypedApp.Material' });
