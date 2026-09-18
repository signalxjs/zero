import { component } from 'sigx';
import { Button } from '@sigx/zero';
import type { PageEntry } from './registry';

const ExtensibleAxesDemos = component(() => () => (
    <>
        <p>
            <code>color</code>, <code>size</code> and <code>variant</code> have
            named props because almost every design language has them — they are
            not the whole list. <code>axes</code> passes any other axis through
            as <code>data-&lt;axis&gt;</code>, so a design system with density,
            emphasis or tone has somewhere to put it. The two rules below are
            playground CSS rather than a design system; what zero contributes is
            the attribute reaching the DOM at all.
        </p>
        <style>{`
            .axis-demo [data-density="compact"] { padding-block: 0.15rem; font-size: 0.8rem; }
            .axis-demo [data-density="spacious"] { padding-block: 0.7rem; letter-spacing: 0.04em; }
        `}</style>
        <div class="axis-demo" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Button.Root axes={{ density: 'compact' }}>compact</Button.Root>
            <Button.Root>default</Button.Root>
            <Button.Root axes={{ density: 'spacious' }}>spacious</Button.Root>
        </div>
    </>
), { name: 'ExtensibleAxesDemos' });

export const extensibleAxesPage: PageEntry = {
    id: 'extensible-axes',
    title: 'Extensible axes',
    category: 'Concepts',
    Demos: ExtensibleAxesDemos,
};
