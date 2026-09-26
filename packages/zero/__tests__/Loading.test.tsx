/**
 * Skeleton and Spinner (#314) — the two animated content-tier components.
 * One file: between them they have one state machine and no interaction.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Skeleton, skeletonAnatomy, Spinner, spinnerAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

const part = (c: HTMLElement, scope: string, name: string) =>
    c.querySelector<HTMLElement>(`[data-scope="${scope}"][data-part="${name}"]`)!;

describe('Skeleton', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy, loading by default', () => {
        render(<Skeleton.Root>Article title</Skeleton.Root>, container);
        expectAnatomy(container, skeletonAnatomy);
        const root = part(container, 'skeleton', 'root');
        expect(root.getAttribute('data-state')).toBe('loading');
        expect(root.getAttribute('aria-busy')).toBe('true');
    });

    it('keeps its children in the DOM in BOTH states', () => {
        // The entire point of a skeleton: it holds the layout its content will
        // occupy. Swapping the content out would make the box the wrong size
        // and the page jump when the real thing arrives.
        const state = signal({ loading: true });
        render(<Skeleton.Root model={() => state.loading}>Article title</Skeleton.Root>, container);
        expect(part(container, 'skeleton', 'root').textContent).toBe('Article title');

        state.loading = false;
        const root = part(container, 'skeleton', 'root');
        expect(root.textContent).toBe('Article title');
        expect(root.getAttribute('data-state')).toBe('loaded');
    });

    it('is inert while loading, so placeholder controls take no focus (#274)', () => {
        const state = signal({ loading: true });
        render(
            <Skeleton.Root model={() => state.loading}><a href="#x">Read more</a></Skeleton.Root>,
            container,
        );
        const root = part(container, 'skeleton', 'root');
        expect(root.hasAttribute('inert')).toBe(true);
        state.loading = false;
        expect(root.hasAttribute('inert')).toBe(false);
    });

    it('drops aria-busy once loaded — the region has settled', () => {
        render(<Skeleton.Root defaultLoading={false}>Done</Skeleton.Root>, container);
        const root = part(container, 'skeleton', 'root');
        expect(root.getAttribute('data-state')).toBe('loaded');
        expect(root.hasAttribute('aria-busy')).toBe(false);
        expectAnatomy(container, skeletonAnatomy);
    });

    it('nothing is hidden in either state — the states differ by paint', () => {
        // The contrast with Avatar, which swaps by presence. Declaring
        // `hiddenIn` here would excuse a design system from telling the two
        // states apart, which is the one thing it must do.
        expect(skeletonAnatomy.parts.root.hiddenIn).toBeUndefined();
        expect(skeletonAnatomy.parts.root.states).toEqual(['loading', 'loaded']);
    });

    it('passes the variant axes through', () => {
        render(<Skeleton.Root color="primary" size="lg">x</Skeleton.Root>, container);
        const root = part(container, 'skeleton', 'root');
        expect(root.getAttribute('data-color')).toBe('primary');
        expect(root.getAttribute('data-size')).toBe('lg');
    });
});

describe('Spinner', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy with a status role and a default name', () => {
        render(<Spinner />, container);
        expectAnatomy(container, spinnerAnatomy);
        const root = part(container, 'spinner', 'root');
        expect(root.tagName).toBe('SPAN');
        expect(root.getAttribute('role')).toBe('status');
        // A spinner that says nothing is a decoration that happens to move;
        // `role="status"` is what makes the words useful rather than noisy,
        // since it announces on appearance and not on every frame. The words
        // are TEXT in a visually hidden label (#274) — a live region
        // announces content, and an aria-label alone is skipped.
        expect(root.hasAttribute('aria-label')).toBe(false);
        const label = part(container, 'spinner', 'label');
        expect(label.textContent).toBe('Loading');
        expect(label.hasAttribute('data-visually-hidden')).toBe(true);
        expect(label.parentElement).toBe(root);
    });

    it('takes words of its own', () => {
        render(<Spinner label="Uploading" />, container);
        expect(part(container, 'spinner', 'label').textContent).toBe('Uploading');
        expect(part(container, 'spinner', 'root').hasAttribute('aria-label')).toBe(false);
    });

    it('a decorative spinner is out of the accessibility tree: no role, no label', () => {
        render(<Spinner decorative label="ignored" />, container);
        const root = part(container, 'spinner', 'root');
        expect(root.getAttribute('aria-hidden')).toBe('true');
        expect(root.hasAttribute('role')).toBe(false);
        expect(root.childNodes.length).toBe(0);
        expectAnatomy(container, spinnerAnatomy);
    });

    it('declares its label part visually hidden, under the root', () => {
        expect(spinnerAnatomy.parts.label.visuallyHidden).toBe(true);
        expect(spinnerAnatomy.parts.label.parent).toBe('root');
    });

    it('has no state — it spins or it is not rendered', () => {
        expect(spinnerAnatomy.parts.root.states).toBeUndefined();
        render(<Spinner />, container);
        expect(part(container, 'spinner', 'root').hasAttribute('data-state')).toBe(false);
        expect(spinnerAnatomy.parts.label.states).toBeUndefined();
    });

    it('renders nothing visible of its own — the mark is the design system\'s', () => {
        render(<Spinner />, container);
        // The only child is the clipped label; the root is the canvas.
        const children = [...part(container, 'spinner', 'root').children];
        expect(children).toEqual([part(container, 'spinner', 'label')]);
    });

    it('passes the variant axes through', () => {
        render(<Spinner color="primary" size="sm" />, container);
        const root = part(container, 'spinner', 'root');
        expect(root.getAttribute('data-color')).toBe('primary');
        expect(root.getAttribute('data-size')).toBe('sm');
    });
});
