/**
 * The four content-tier components (#311). One file rather than four: Card,
 * Badge and Divider have no behavior between them, and splitting three
 * anatomy assertions across three files would be filing, not testing. Alert
 * has the only state machine here and gets the bulk of it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import type { PartProps } from '@sigx/zero';
import {
    Alert, alertAnatomy,
    Badge, badgeAnatomy,
    Card, cardAnatomy,
    Divider, dividerAnatomy,
} from '@sigx/zero';
import { expectAnatomy } from './helpers';

const selector = (scope: string, name: string) => `[data-scope="${scope}"][data-part="${name}"]`;

/** The part, asserted present — for the cases that go on to read it. */
const part = (c: HTMLElement, scope: string, name: string) =>
    c.querySelector<HTMLElement>(selector(scope, name))!;

/**
 * The part as the DOM actually reports it. Absence assertions go through this
 * rather than `part()`: the `!` there is a compile-time claim, so
 * `expect(part(…)).toBeNull()` passes at runtime while asserting something
 * the types say cannot happen — which is a lie that would survive a refactor.
 */
const maybePart = (c: HTMLElement, scope: string, name: string) =>
    c.querySelector<HTMLElement>(selector(scope, name));

describe('Card', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy with every band', () => {
        render(
            <Card.Root color="primary" variant="outline">
                <Card.Header>
                    <Card.Title>Monthly report</Card.Title>
                    <Card.Description>Updated 4 minutes ago</Card.Description>
                </Card.Header>
                <Card.Body>Body copy.</Card.Body>
                <Card.Footer>Footer</Card.Footer>
            </Card.Root>,
            container,
        );
        expectAnatomy(container, cardAnatomy);
        for (const name of ['root', 'header', 'title', 'description', 'body', 'footer']) {
            expect(part(container, 'card', name), `card/${name} must render`).toBeTruthy();
        }
        expect(part(container, 'card', 'root').getAttribute('data-color')).toBe('primary');
        expect(part(container, 'card', 'root').getAttribute('data-variant')).toBe('outline');
    });

    it('puts the title in the document outline as a heading', () => {
        // A card title that is a <div> is invisible to a heading-list, which
        // is how most screen-reader users navigate a page of cards.
        render(<Card.Root><Card.Title>Report</Card.Title></Card.Root>, container);
        expect(part(container, 'card', 'title').tagName).toBe('H3');
        expect(part(container, 'card', 'root').tagName).toBe('DIV');
    });

    it('renders with only the parts the caller used', () => {
        render(<Card.Root><Card.Body>Just a body.</Card.Body></Card.Root>, container);
        expectAnatomy(container, cardAnatomy);
        expect(maybePart(container, 'card', 'header')).toBeNull();
        expect(maybePart(container, 'card', 'footer')).toBeNull();
    });
});

describe('Badge', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy and passes its axes through', () => {
        render(<Badge color="success" variant="soft" size="sm">Active</Badge>, container);
        expectAnatomy(container, badgeAnatomy);
        const root = part(container, 'badge', 'root');
        expect(root.tagName).toBe('SPAN');
        expect(root.textContent).toBe('Active');
        expect(root.getAttribute('data-color')).toBe('success');
        expect(root.getAttribute('data-variant')).toBe('soft');
        expect(root.getAttribute('data-size')).toBe('sm');
    });

    it('is the carrier AND the only text-bearing part', () => {
        // Not incidental: the contrast audit's one-element probe can only
        // measure a variant-wiring scope shaped this way, and badge is the
        // content-tier component that wires its own vocabulary because of it.
        expect(badgeAnatomy.partNames()).toEqual(['root']);
        expect(badgeAnatomy.parts.root.tokens).toContain('text');
    });

    it('asChild hands the attribute bag to the caller\'s element', () => {
        render(
            <Badge color="error" asChild>
                {(p: PartProps) => <a href="/failed" {...p}>3 failed</a>}
            </Badge>,
            container,
        );
        const root = part(container, 'badge', 'root');
        expect(root.tagName).toBe('A');
        expect(root.getAttribute('href')).toBe('/failed');
        expect(root.getAttribute('data-color')).toBe('error');
    });
});

describe('Divider', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a separator, horizontal by default', () => {
        render(<Divider />, container);
        expectAnatomy(container, dividerAnatomy);
        const root = part(container, 'divider', 'root');
        expect(root.getAttribute('role')).toBe('separator');
        expect(root.getAttribute('data-orientation')).toBe('horizontal');
        // Horizontal is the role's own default — restating it would be a
        // second source of truth for the same fact.
        expect(root.getAttribute('aria-orientation')).toBeNull();
    });

    it('announces the vertical orientation, which is not the default', () => {
        render(<Divider orientation="vertical" />, container);
        const root = part(container, 'divider', 'root');
        expect(root.getAttribute('data-orientation')).toBe('vertical');
        expect(root.getAttribute('aria-orientation')).toBe('vertical');
    });

    it('is not focusable — it separates, it does not move', () => {
        render(<Divider />, container);
        expect(part(container, 'divider', 'root').hasAttribute('tabindex')).toBe(false);
    });
});

describe('Alert', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    function mount(extra: { model?: unknown; defaultOpen?: boolean } = {}) {
        render(
            <Alert.Root model={extra.model as never} defaultOpen={extra.defaultOpen} color="warning">
                <Alert.Icon>⚠</Alert.Icon>
                <Alert.Title>Approaching your quota</Alert.Title>
                <Alert.Description>92% used.</Alert.Description>
                <Alert.Close />
            </Alert.Root>,
            container,
        );
    }

    it('renders a valid anatomy, open by default', () => {
        mount();
        expectAnatomy(container, alertAnatomy);
        const root = part(container, 'alert', 'root');
        expect(root.getAttribute('role')).toBe('alert');
        expect(root.getAttribute('data-state')).toBe('open');
        expect(root.hasAttribute('hidden')).toBe(false);
        for (const name of ['icon', 'title', 'description', 'close']) {
            expect(part(container, 'alert', name), `alert/${name} must render`).toBeTruthy();
        }
    });

    it('the icon is decorative — the severity is already in the text', () => {
        mount();
        expect(part(container, 'alert', 'icon').getAttribute('aria-hidden')).toBe('true');
    });

    it('Close dismisses it, and the runtime hides the root', () => {
        mount();
        part(container, 'alert', 'close').click();
        const root = part(container, 'alert', 'root');
        expect(root.getAttribute('data-state')).toBe('closed');
        // `hiddenIn: ['closed']` is a claim about the runtime, and this is the
        // assertion that keeps it true — expectAnatomy checks it both ways.
        expect(root.hasAttribute('hidden')).toBe(true);
        expectAnatomy(container, alertAnatomy);
    });

    it('a model drives presence in both directions', () => {
        const state = signal({ open: true });
        mount({ model: () => state.open });
        part(container, 'alert', 'close').click();
        expect(state.open).toBe(false);

        state.open = true;
        const root = part(container, 'alert', 'root');
        expect(root.getAttribute('data-state')).toBe('open');
        expect(root.hasAttribute('hidden')).toBe(false);
    });

    it('starts closed when told to', () => {
        mount({ defaultOpen: false });
        const root = part(container, 'alert', 'root');
        expect(root.getAttribute('data-state')).toBe('closed');
        expect(root.hasAttribute('hidden')).toBe(true);
        expectAnatomy(container, alertAnatomy);
    });

    it('Close carries a name of its own, overridable', () => {
        mount();
        expect(part(container, 'alert', 'close').getAttribute('aria-label')).toBe('Close');

        const other = document.createElement('div');
        document.body.appendChild(other);
        render(
            <Alert.Root><Alert.Close label="Dismiss warning" /></Alert.Root>,
            other,
        );
        expect(part(other, 'alert', 'close').getAttribute('aria-label')).toBe('Dismiss warning');
    });

    it('a disabled Close does not dismiss', () => {
        render(
            <Alert.Root><Alert.Close disabled /></Alert.Root>,
            container,
        );
        part(container, 'alert', 'close').click();
        expect(part(container, 'alert', 'root').getAttribute('data-state')).toBe('open');
        expect(part(container, 'alert', 'close').getAttribute('data-disabled')).toBe('');
    });
});
