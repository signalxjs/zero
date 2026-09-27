import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { renderToString } from '@sigx/server-renderer';
import { defineApp, signal, component } from 'sigx';
import { Avatar, AvatarGroup, avatarGroupAnatomy, zeroPlugin } from '@sigx/zero';
import { expectAnatomy } from './helpers';

describe('AvatarGroup', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    const root = () => container.querySelector<HTMLElement>('[data-scope="avatar-group"][data-part="root"]')!;
    const overflow = () => container.querySelector<HTMLElement>('[data-scope="avatar-group"][data-part="overflow"]');

    function group(count: number, label?: string) {
        return (
            <AvatarGroup.Root label="Project members" size="sm" color="primary">
                <Avatar.Root><Avatar.Fallback>AE</Avatar.Fallback></Avatar.Root>
                <Avatar.Root><Avatar.Fallback>JD</Avatar.Fallback></Avatar.Root>
                <AvatarGroup.Overflow count={count} label={label} />
            </AvatarGroup.Root>
        );
    }

    it('renders a valid anatomy: a named group carrying the axes', () => {
        render(group(3), container);
        expectAnatomy(container, avatarGroupAnatomy);
        const r = root();
        expect(r.tagName).toBe('DIV');
        expect(r.getAttribute('role')).toBe('group');
        expect(r.getAttribute('aria-label')).toBe('Project members');
        expect(r.getAttribute('data-size')).toBe('sm');
        expect(r.getAttribute('data-color')).toBe('primary');
        // The avatars are another scope's roots, untouched: the group sizes
        // them through the design system, not through attributes.
        const avatar = r.querySelector('[data-scope="avatar"][data-part="root"]')!;
        expect(avatar.hasAttribute('data-size')).toBe(false);
    });

    it('overflow shows "+N" to sight and says "N more" to assistive technology', () => {
        render(group(3), container);
        const o = overflow()!;
        expect(o.parentElement).toBe(root());
        const [glyph, words] = Array.from(o.children) as HTMLElement[];
        expect(glyph.textContent).toBe('+3');
        expect(glyph.getAttribute('aria-hidden')).toBe('true');
        expect(words.textContent).toBe('3 more');
        expect(words.hasAttribute('data-visually-hidden')).toBe(true);
        expect(words.hasAttribute('aria-hidden')).toBe(false);
        // The part itself is not hidden: the words are its accessible text.
        expect(o.hasAttribute('aria-hidden')).toBe(false);
    });

    it('`label` replaces the words, never the visible count', () => {
        render(group(12, '12 weitere Mitglieder'), container);
        const [glyph, words] = Array.from(overflow()!.children) as HTMLElement[];
        expect(glyph.textContent).toBe('+12');
        expect(words.textContent).toBe('12 weitere Mitglieder');
    });

    it('renders no chip for a count of zero or less (or not a number)', () => {
        for (const count of [0, -2, Number.NaN]) {
            container = document.createElement('div');
            document.body.appendChild(container);
            render(group(count), container);
            expect(overflow()).toBeNull();
            expectAnatomy(container, avatarGroupAnatomy);
        }
    });

    it('floors a fractional count', () => {
        render(group(2.7), container);
        expect(overflow()!.children[0].textContent).toBe('+2');
        expect(overflow()!.children[1].textContent).toBe('2 more');
    });

    it('follows a changing count, appearing and leaving', async () => {
        const state = signal({ count: 0 });
        const Demo = component(() => () => (
            <AvatarGroup.Root>
                <Avatar.Root><Avatar.Fallback>AE</Avatar.Fallback></Avatar.Root>
                <AvatarGroup.Overflow count={state.count} />
            </AvatarGroup.Root>
        ));
        render(<Demo />, container);
        expect(overflow()).toBeNull();
        state.count = 4;
        await Promise.resolve();
        expect(overflow()!.children[0].textContent).toBe('+4');
        state.count = 0;
        await Promise.resolve();
        expect(overflow()).toBeNull();
    });

    it('an app aria-label names the group when `label` is absent; `label` wins over it', () => {
        render(
            <>
                <AvatarGroup.Root aria-label="Reviewers" />
                <AvatarGroup.Root aria-label="ignored" label="Owners" />
            </>,
            container,
        );
        const [a, b] = Array.from(container.querySelectorAll('[data-scope="avatar-group"][data-part="root"]'));
        expect(a.getAttribute('aria-label')).toBe('Reviewers');
        expect(b.getAttribute('aria-label')).toBe('Owners');
    });

    it('Overflow reads an app aria-label as its words, never as an attribute; `label` wins', () => {
        render(
            <AvatarGroup.Root>
                <AvatarGroup.Overflow count={2} aria-label="2 others" />
                <AvatarGroup.Overflow count={3} aria-label="ignored" label="3 others" />
            </AvatarGroup.Root>,
            container,
        );
        const [a, b] = Array.from(container.querySelectorAll('[data-scope="avatar-group"][data-part="overflow"]'));
        expect(a.hasAttribute('aria-label')).toBe(false);
        expect(a.children[1].textContent).toBe('2 others');
        expect(b.hasAttribute('aria-label')).toBe(false);
        expect(b.children[1].textContent).toBe('3 others');
    });

    it('an unlabelled group is still a group, with no empty aria-label', () => {
        render(<AvatarGroup.Root />, container);
        expect(root().getAttribute('role')).toBe('group');
        expect(root().hasAttribute('aria-label')).toBe(false);
    });

    it('server-renders the group, the count and its words', async () => {
        const app = defineApp(group(5));
        app.use(zeroPlugin());
        const html = await renderToString(app);
        expect(html).toMatch(/<div[^>]*role="group"[^>]*aria-label="Project members"[^>]*data-scope="avatar-group"[^>]*data-part="root"/);
        expect(html).toMatch(/data-part="overflow"[^>]*><span aria-hidden="true">\+5<\/span><span data-visually-hidden="">5 more<\/span>/);
    });
});
