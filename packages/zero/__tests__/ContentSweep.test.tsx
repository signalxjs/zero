/**
 * The content-tier sweep (#334): kbd, status, indicator, stats, timeline,
 * chat, radial-progress, join. One file in the ContentTier.test.tsx mould —
 * these are anatomy-plus-recipes components with little behavior between
 * them, and splitting eight anatomy assertions across eight files would be
 * filing, not testing. RadialProgress has the only value model here and gets
 * the bulk of it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import type { PartProps } from '@sigx/zero';
import {
    Chat, chatAnatomy,
    Indicator, indicatorAnatomy,
    Join, joinAnatomy,
    RadialProgress, radialProgressAnatomy,
    Kbd, kbdAnatomy,
    PLACEMENT_VOCABULARY,
    Stats, statsAnatomy,
    Status, statusAnatomy,
    Timeline, timelineAnatomy,
} from '@sigx/zero';
import { expectAnatomy } from './helpers';

const selector = (scope: string, name: string) => `[data-scope="${scope}"][data-part="${name}"]`;

/** The part, asserted present — for the cases that go on to read it. */
const part = (c: HTMLElement, scope: string, name: string) =>
    c.querySelector<HTMLElement>(selector(scope, name))!;

describe('Kbd', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a semantic <kbd> with a valid anatomy', () => {
        render(<Kbd size="sm">⌘</Kbd>, container);
        expectAnatomy(container, kbdAnatomy);
        const root = part(container, 'kbd', 'root');
        // The element IS the semantics: <kbd> is how assistive tech and
        // reader modes know this span of text is keyboard input, so a styled
        // <span> would drop the one meaning the component carries.
        expect(root.tagName).toBe('KBD');
        expect(root.textContent).toBe('⌘');
        expect(root.getAttribute('data-size')).toBe('sm');
    });

    it('is one part, and the carrier bears the text', () => {
        // Badge's shape: at keycap scale the fill is the component, so root
        // both carries the axes and renders the text.
        expect(kbdAnatomy.partNames()).toEqual(['root']);
        expect(kbdAnatomy.parts.root.tokens).toContain('text');
    });

    it('declares no states — a keycap has no lifecycle', () => {
        expect(kbdAnatomy.parts.root.states).toBeUndefined();
        render(<Kbd>K</Kbd>, container);
        expect(part(container, 'kbd', 'root').hasAttribute('data-state')).toBe(false);
    });
});

describe('Status', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid one-part anatomy with the colour pass-through', () => {
        render(<Status color="success" />, container);
        expectAnatomy(container, statusAnatomy);
        const root = part(container, 'status', 'root');
        expect(root.tagName).toBe('SPAN');
        expect(root.getAttribute('data-color')).toBe('success');
        expect(root.textContent).toBe('');
    });

    it('declares no states — the colour axis IS the vocabulary', () => {
        // A static presence dot has no lifecycle: "online" and "busy" are
        // different colours of the same resting render, not machine states,
        // so inventing a data-state family for them would be styling wearing
        // a contract costume.
        expect(statusAnatomy.parts.root.states).toBeUndefined();
        expect(statusAnatomy.parts.root.flags).toBeUndefined();
    });

    it('is decorative until a label makes it meaningful', () => {
        // Without a label the dot is presentation — the visible text beside
        // it ("Online") carries the meaning, and announcing the dot too
        // would say everything twice.
        render(<Status color="success" />, container);
        expect(part(container, 'status', 'root').getAttribute('aria-hidden')).toBe('true');

        const labelled = document.createElement('div');
        document.body.appendChild(labelled);
        render(<Status color="error" label="Service degraded" />, labelled);
        const root = part(labelled, 'status', 'root');
        // With a label the dot IS the content: role="img" names a static
        // graphic — role="status" would be a live region for a thing that
        // never changes.
        expect(root.getAttribute('role')).toBe('img');
        expect(root.getAttribute('aria-label')).toBe('Service degraded');
        expect(root.hasAttribute('aria-hidden')).toBe(false);
    });
});

describe('Indicator', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy and stamps the default corner', () => {
        render(
            <Indicator.Root>
                <Indicator.Item>3</Indicator.Item>
                <button type="button">Inbox</button>
            </Indicator.Root>,
            container,
        );
        expectAnatomy(container, indicatorAnatomy);
        const item = part(container, 'indicator', 'item');
        // The daisy default, and the overwhelmingly common one: a count sits
        // on the top reading-end corner of what it counts.
        expect(item.getAttribute('data-placement')).toBe('top-end');
        expect(item.textContent).toBe('3');
    });

    it('stamps the requested placement, spelled logically', () => {
        render(
            <Indicator.Root>
                <Indicator.Item placement="bottom-start">!</Indicator.Item>
                <span>avatar</span>
            </Indicator.Root>,
            container,
        );
        expect(part(container, 'indicator', 'item').getAttribute('data-placement')).toBe('bottom-start');
        expectAnatomy(container, indicatorAnatomy);
    });

    it('declares the eight anchor slots, all from the governed vocabulary', () => {
        // Four corners, two edge midpoints, and the two logical inline sides
        // ('start'/'end' — the middle-row anchors, which is what put the bare
        // logical pair into PLACEMENT_VOCABULARY). No 'left'/'right': an
        // indicator anchors to the reading direction, not to the glass.
        expect([...(indicatorAnatomy.parts.item.placements ?? [])].sort()).toEqual([
            'bottom', 'bottom-end', 'bottom-start', 'end', 'start', 'top', 'top-end', 'top-start',
        ]);
        const vocabulary = new Set<string>(PLACEMENT_VOCABULARY);
        for (const p of indicatorAnatomy.parts.item.placements ?? []) {
            expect(vocabulary.has(p), `"${p}" must be in PLACEMENT_VOCABULARY`).toBe(true);
        }
    });
});

describe('Stats', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    function mount(orientation?: 'horizontal' | 'vertical') {
        render(
            <Stats.Root orientation={orientation}>
                <Stats.Item>
                    <Stats.Figure>↑</Stats.Figure>
                    <Stats.Title>Total revenue</Stats.Title>
                    <Stats.Value>$12,930</Stats.Value>
                    <Stats.Desc>+8% month over month</Stats.Desc>
                </Stats.Item>
                <Stats.Item>
                    <Stats.Title>Signups</Stats.Title>
                    <Stats.Value>1,204</Stats.Value>
                </Stats.Item>
            </Stats.Root>,
            container,
        );
    }

    it('renders a valid anatomy with every band, horizontal by default', () => {
        mount();
        expectAnatomy(container, statsAnatomy);
        for (const name of ['root', 'item', 'title', 'value', 'desc', 'figure']) {
            expect(part(container, 'stats', name), `stats/${name} must render`).toBeTruthy();
        }
        expect(part(container, 'stats', 'root').getAttribute('data-orientation')).toBe('horizontal');
        // Items carry the orientation too — the between-item divider is
        // directional CSS, and a sibling selector cannot reach up to the root.
        expect(part(container, 'stats', 'item').getAttribute('data-orientation')).toBe('horizontal');
    });

    it('propagates the vertical orientation to every item', () => {
        mount('vertical');
        for (const item of container.querySelectorAll('[data-scope="stats"][data-part="item"]')) {
            expect(item.getAttribute('data-orientation')).toBe('vertical');
        }
        expectAnatomy(container, statsAnatomy);
    });

    it('every band below an item is optional', () => {
        render(
            <Stats.Root>
                <Stats.Item>
                    <Stats.Value>42</Stats.Value>
                </Stats.Item>
            </Stats.Root>,
            container,
        );
        expectAnatomy(container, statsAnatomy);
        expect(container.querySelector('[data-part="title"]')).toBeNull();
        expect(container.querySelector('[data-part="figure"]')).toBeNull();
    });
});

describe('Timeline', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    function mount(orientation?: 'horizontal' | 'vertical') {
        render(
            <Timeline.Root orientation={orientation}>
                <Timeline.Item>
                    <Timeline.Marker />
                    <Timeline.Content placement="start">v1.0 shipped</Timeline.Content>
                    <Timeline.Connector />
                </Timeline.Item>
                <Timeline.Item>
                    <Timeline.Marker>★</Timeline.Marker>
                    <Timeline.Content>v2.0 shipped</Timeline.Content>
                </Timeline.Item>
            </Timeline.Root>,
            container,
        );
    }

    it('renders a semantic list with a valid anatomy, vertical by default', () => {
        mount();
        expectAnatomy(container, timelineAnatomy);
        const root = part(container, 'timeline', 'root');
        // A timeline is an ordered sequence of events: a real list, so
        // assistive tech announces "list, 2 items" and can walk it.
        expect(root.tagName).toBe('UL');
        expect(part(container, 'timeline', 'item').tagName).toBe('LI');
        // Vertical is the default — a feed of events grows downward; the
        // horizontal process strip is the variant, unlike Divider.
        expect(root.getAttribute('data-orientation')).toBe('vertical');
        expect(part(container, 'timeline', 'item').getAttribute('data-orientation')).toBe('vertical');
    });

    it('content stamps its declared side, end by default', () => {
        mount();
        const contents = container.querySelectorAll<HTMLElement>('[data-scope="timeline"][data-part="content"]');
        expect(contents[0]!.getAttribute('data-placement')).toBe('start');
        expect(contents[1]!.getAttribute('data-placement')).toBe('end');
        // Content needs BOTH the side and the axis: start means the inline
        // side of a vertical timeline and the block side of a horizontal one,
        // and a recipe can only compose the two on the same element.
        expect(contents[0]!.getAttribute('data-orientation')).toBe('vertical');
        expect([...(timelineAnatomy.parts.content.placements ?? [])].sort()).toEqual(['end', 'start']);
    });

    it('marker and connector are decoration — the content carries the event', () => {
        mount();
        // The marker may hold an icon glyph, but the reader gets the event
        // from the content text; announcing "star" in between is noise.
        expect(part(container, 'timeline', 'marker').getAttribute('aria-hidden')).toBe('true');
        expect(part(container, 'timeline', 'connector').getAttribute('aria-hidden')).toBe('true');
    });

    it('propagates a horizontal orientation everywhere it is needed', () => {
        mount('horizontal');
        expect(part(container, 'timeline', 'root').getAttribute('data-orientation')).toBe('horizontal');
        expect(part(container, 'timeline', 'item').getAttribute('data-orientation')).toBe('horizontal');
        expect(part(container, 'timeline', 'connector').getAttribute('data-orientation')).toBe('horizontal');
        expect(part(container, 'timeline', 'content').getAttribute('data-orientation')).toBe('horizontal');
        expectAnatomy(container, timelineAnatomy);
    });
});

describe('Chat', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy; a row is the other party by default', () => {
        render(
            <Chat.Root color="primary">
                <Chat.Avatar><img src="/ada.png" alt="" /></Chat.Avatar>
                <Chat.Header>Ada · 12:45</Chat.Header>
                <Chat.Bubble>The contract is the anatomy.</Chat.Bubble>
                <Chat.Footer>Delivered</Chat.Footer>
            </Chat.Root>,
            container,
        );
        expectAnatomy(container, chatAnatomy);
        const root = part(container, 'chat', 'root');
        // `start` — the reading edge — is where the OTHER party sits in every
        // messenger; your own rows opt into `end`.
        expect(root.getAttribute('data-placement')).toBe('start');
        expect(root.getAttribute('data-color')).toBe('primary');
        for (const name of ['avatar', 'header', 'bubble', 'footer']) {
            expect(part(container, 'chat', name), `chat/${name} must render`).toBeTruthy();
        }
    });

    it('an own message sits at the reading end', () => {
        render(
            <Chat.Root placement="end">
                <Chat.Bubble>Agreed.</Chat.Bubble>
            </Chat.Root>,
            container,
        );
        expect(part(container, 'chat', 'root').getAttribute('data-placement')).toBe('end');
        expectAnatomy(container, chatAnatomy);
    });

    it('declares exactly the logical pair — a chat row has no physical side', () => {
        // A row from the other party sits at the reading start in BOTH
        // directions; 'left' would be wrong in one of them.
        expect([...(chatAnatomy.parts.root.placements ?? [])].sort()).toEqual(['end', 'start']);
    });
});

describe('RadialProgress', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    function mount(value: number | null | undefined, extra: { min?: number; max?: number } = {}) {
        render(
            <RadialProgress.Root value={value} min={extra.min} max={extra.max}>
                <RadialProgress.Label>Upload</RadialProgress.Label>
                <RadialProgress.ValueText />
            </RadialProgress.Root>,
            container,
        );
    }

    it('is its own scope — a radial has no track/range geometry', () => {
        // The decision the issue asked for, pinned: linear progress paints a
        // range INSIDE a track (two rendered boxes with real geometry); a
        // radial is one painted ring on the root. Reusing progress's anatomy
        // would ship two dead parts, and a `data-mod-radial` is a
        // design-system styling hook, not a structural switch.
        expect(radialProgressAnatomy.scope).toBe('radial-progress');
        expect(radialProgressAnatomy.partNames()).toEqual(['root', 'label', 'value-text']);
    });

    it('shares the linear value model: progressbar semantics and the percent property', () => {
        mount(62);
        expectAnatomy(container, radialProgressAnatomy);
        const root = part(container, 'radial-progress', 'root');
        expect(root.getAttribute('role')).toBe('progressbar');
        expect(root.getAttribute('aria-valuemin')).toBe('0');
        expect(root.getAttribute('aria-valuemax')).toBe('100');
        expect(root.getAttribute('aria-valuenow')).toBe('62');
        expect(root.getAttribute('data-state')).toBe('loading');
        // The SAME custom property linear progress publishes, on purpose —
        // recipes paint the arc from it (conic-gradient masks), and tooling
        // that reads one progress component reads both.
        expect(root.getAttribute('style')).toContain('--progress-percent: 62%');
        // The default value text is the rounded percent, like linear's.
        expect(part(container, 'radial-progress', 'value-text').textContent).toBe('62%');
    });

    it('scales percent over a custom range, clamped', () => {
        mount(150, { min: 100, max: 200 });
        const root = part(container, 'radial-progress', 'root');
        expect(root.getAttribute('aria-valuenow')).toBe('150');
        expect(root.getAttribute('style')).toContain('--progress-percent: 50%');
    });

    it('null is indeterminate: no valuenow, no percent, the loop state', () => {
        mount(null);
        const root = part(container, 'radial-progress', 'root');
        expect(root.getAttribute('data-state')).toBe('indeterminate');
        expect(root.hasAttribute('aria-valuenow')).toBe(false);
        expect(root.getAttribute('style') ?? '').not.toContain('--progress-percent');
        expect(part(container, 'radial-progress', 'value-text').textContent).toBe('');
    });

    it('a full ring is complete', () => {
        mount(100);
        expect(part(container, 'radial-progress', 'root').getAttribute('data-state')).toBe('complete');
        expectAnatomy(container, radialProgressAnatomy);
    });

    it('a degenerate range never leaks NaN into the percent property', () => {
        // max === min has nothing left to fill: any present value reads as
        // done, and the guard keeps NaN/Infinity out of --progress-percent
        // and the value text.
        mount(5, { min: 5, max: 5 });
        const root = part(container, 'radial-progress', 'root');
        expect(root.getAttribute('data-state')).toBe('complete');
        expect(root.getAttribute('style')).toContain('--progress-percent: 100%');
        expect(part(container, 'radial-progress', 'value-text').textContent).toBe('100%');
    });

    it('the label names the progressbar', () => {
        mount(30);
        const root = part(container, 'radial-progress', 'root');
        const label = part(container, 'radial-progress', 'label');
        expect(root.getAttribute('aria-labelledby')).toBe(label.id);
    });
});

describe('Join', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy; root and items carry the orientation', () => {
        render(
            <Join.Root>
                <Join.Item><button type="button">One</button></Join.Item>
                <Join.Item><button type="button">Two</button></Join.Item>
                <Join.Item><button type="button">Three</button></Join.Item>
            </Join.Root>,
            container,
        );
        expectAnatomy(container, joinAnatomy);
        expect(part(container, 'join', 'root').getAttribute('data-orientation')).toBe('horizontal');
        const items = container.querySelectorAll<HTMLElement>('[data-scope="join"][data-part="item"]');
        expect(items.length).toBe(3);
        // The radius collapse is directional CSS on the item (`item + item`),
        // so every item carries the orientation — stats' reasoning.
        for (const item of items) {
            expect(item.getAttribute('data-orientation')).toBe('horizontal');
        }
    });

    it('stacks vertically when told to', () => {
        render(
            <Join.Root orientation="vertical">
                <Join.Item><input /></Join.Item>
                <Join.Item><button type="button">Go</button></Join.Item>
            </Join.Root>,
            container,
        );
        expect(part(container, 'join', 'root').getAttribute('data-orientation')).toBe('vertical');
        expect(part(container, 'join', 'item').getAttribute('data-orientation')).toBe('vertical');
        expectAnatomy(container, joinAnatomy);
    });

    it('asChild puts the item attributes ON the control — the honest joint', () => {
        // A wrapper cannot collapse the radius of the control inside it; the
        // recipes' corner rules only reach what carries the part attributes,
        // so the control itself should carry them.
        render(
            <Join.Root>
                <Join.Item asChild>
                    {(p: PartProps) => <button type="button" {...p}>Save</button>}
                </Join.Item>
            </Join.Root>,
            container,
        );
        const item = part(container, 'join', 'item');
        expect(item.tagName).toBe('BUTTON');
        expect(item.getAttribute('data-orientation')).toBe('horizontal');
        expectAnatomy(container, joinAnatomy);
    });

    it('declares no states and no ARIA — grouping is the consumer\'s meaning', () => {
        // role="group" was considered and cut: a join is VISUAL grouping (a
        // segmented look), and a search field + button joined together is not
        // a semantic group the reader needs announced. A consumer who means
        // "toolbar" or "group" writes the role on the root.
        expect(joinAnatomy.parts.root.states).toBeUndefined();
        expect(joinAnatomy.parts.item.states).toBeUndefined();
        render(<Join.Root><Join.Item><button type="button">A</button></Join.Item></Join.Root>, container);
        expect(part(container, 'join', 'root').hasAttribute('role')).toBe(false);
    });
});
