/**
 * Program (c): carbon's renamed prop surface — the api `values` remap
 * (#183) as an app consumes it (#326).
 *
 * Carbon's `./components` module routes zero's `variant` axis through the
 * vendor prop name `kind`, restoring Carbon's double-hyphen spellings
 * (`danger--tertiary`) that the attribute grammar cannot carry. Checked
 * against the EMITTED `dist/components.d.ts` through package exports, with
 * no register import in the program.
 */
import { component } from 'sigx';
import { Button } from '@sigx/zero-carbon/components';

export const App = component(() => () => (
    <>
        {/* ── the vendor spelling compiles — this exact string is the point ── */}
        <Button.Root kind="danger--tertiary">Delete</Button.Root>
        <Button.Root kind="ghost" hasIconOnly>×</Button.Root>

        {/* ── and the remap is total ── */}
        <Button.Root
            /* @ts-expect-error — not a Carbon kind */
            kind="nope"
        >
            Nope
        </Button.Root>
        {/* carbon maps variant to kind; the zero name is removed */}
        <Button.Root
            /* @ts-expect-error — no variant prop on this surface */
            variant="ghost"
        >
            Nope
        </Button.Root>
        {/* the vendor union carries `danger--tertiary`, not the
          * single-hyphen zero spelling */}
        <Button.Root
            /* @ts-expect-error — not a Carbon kind spelling */
            kind="danger-tertiary"
        >
            Nope
        </Button.Root>
    </>
), { name: 'TypedApp.Api' });
