import { component } from 'sigx';
import { Button, VisuallyHidden } from '@sigx/zero';
import type { VisuallyHiddenBag } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import type { PageEntry } from './registry';

/**
 * The standalone `VisuallyHidden` (#194). It is deliberately not a scope —
 * no anatomy, no recipe; `css/base.css` clips `data-visually-hidden` in
 * `@layer zero.structure` — so the part option (`Field.Label visuallyHidden`,
 * on the Field page) already covered the CSS. This page renders the component
 * itself, so the axe audit sees the names it supplies.
 */
const VisuallyHiddenDemos = component(() => () => (
    <>
        <p>
            Content for assistive technology only: out of sight, in the
            accessibility tree. Prefer a part's own <code>visuallyHidden</code>{' '}
            option when the thing to hide <em>is</em> a part; reach for{' '}
            <code>VisuallyHidden</code> for text that is not — an icon
            button's name, a heading only a screen reader needs.
        </p>
        <DemoRow>
            <Button.Root data-demo="vh-icon-button">
                <span aria-hidden="true">✕</span>
                <VisuallyHidden>Close panel</VisuallyHidden>
            </Button.Root>
            <Button.Root>
                <span aria-hidden="true">★</span>
                <VisuallyHidden>Add to favourites</VisuallyHidden>
            </Button.Root>
        </DemoRow>
        <VisuallyHidden asChild>
            {(p: VisuallyHiddenBag) => <h2 {...p}>Heading for screen readers only</h2>}
        </VisuallyHidden>
        <p>
            The heading above this paragraph is an <code>asChild</code>{' '}
            <code>&lt;h2&gt;</code>: in the outline, not on the screen.
        </p>
    </>
), { name: 'VisuallyHiddenDemos' });

export const visuallyHiddenPage: PageEntry = {
    id: 'visually-hidden',
    title: 'Visually hidden',
    category: 'Display & feedback',
    Demos: VisuallyHiddenDemos,
};
