/**
 * asChild where semantics demand it (#275): the layout and content roots
 * that used to be a fixed `<div>`, and Card's title and description.
 *
 * A `<div>` root forced a wrapper whenever the thing was really a landmark
 * (`<main>`), a list (`<ul>`/`<li>`) or a heading at another level — pushing
 * the semantic element a level down, away from the attributes that lay it
 * out. Each case renders the root as the element it should be and checks the
 * whole bag landed there: scope/part, the layout attributes, the axes and
 * `data-orientation`/`data-placement`, and forwarded attributes.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import type { PartProps } from '@sigx/zero';
import {
    Box, Card, Center, Chat, Col, Container, Grid, Join, Row, Stack, Stats,
    boxAnatomy, cardAnatomy, centerAnatomy, chatAnatomy, containerAnatomy,
    gridAnatomy, joinAnatomy, stackAnatomy, statsAnatomy,
} from '@sigx/zero';
import { expectAnatomy } from './helpers';

let container: HTMLElement;
beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
});

const part = (scope: string, name: string): HTMLElement =>
    container.querySelector<HTMLElement>(`[data-scope="${scope}"][data-part="${name}"]`)!;

describe('layout and content roots take asChild (#275)', () => {
    it('Box renders as an <aside>, padding and tint on it', () => {
        render(
            <Box asChild pad="lg" color="warning" aria-label="Note">
                {(p: PartProps) => <aside {...p}>Heads up</aside>}
            </Box>,
            container,
        );
        const root = part('box', 'root');
        expect(root.tagName).toBe('ASIDE');
        expect(root.getAttribute('data-l-pad')).toBe('lg');
        expect(root.getAttribute('data-color')).toBe('warning');
        expect(root.getAttribute('aria-label')).toBe('Note');
        expect(root.parentElement).toBe(container);
        expectAnatomy(container, boxAnatomy);
    });

    it('Center renders as a <section>', () => {
        render(
            <Center asChild axis="inline" pad="md">
                {(p: PartProps) => <section {...p}>middle</section>}
            </Center>,
            container,
        );
        const root = part('center', 'root');
        expect(root.tagName).toBe('SECTION');
        expect(root.getAttribute('data-l-axis')).toBe('inline');
        expect(root.getAttribute('data-l-pad')).toBe('md');
        expectAnatomy(container, centerAnatomy);
    });

    it('Container renders as the page <main>', () => {
        render(
            <Container asChild measure="lg" padX="xl" id="content">
                {(p: PartProps) => <main {...p}>page</main>}
            </Container>,
            container,
        );
        const root = part('container', 'root');
        expect(root.tagName).toBe('MAIN');
        expect(root.getAttribute('data-l-measure')).toBe('lg');
        expect(root.getAttribute('data-l-pad-x')).toBe('xl');
        expect(root.id).toBe('content');
        expectAnatomy(container, containerAnatomy);
    });

    it('Grid renders as a <ul> of <li> cells', () => {
        render(
            <Grid asChild cols={{ base: 1, md: 3 }} gap="md">
                {(p: PartProps) => (
                    <ul {...p}>
                        <Grid.Cell asChild>{(c: PartProps) => <li {...c}>one</li>}</Grid.Cell>
                        <Grid.Cell asChild span="full">{(c: PartProps) => <li {...c}>two</li>}</Grid.Cell>
                    </ul>
                )}
            </Grid>,
            container,
        );
        const root = part('grid', 'root');
        expect(root.tagName).toBe('UL');
        expect(root.getAttribute('data-l-cols')).toBe('1');
        expect(root.getAttribute('data-l-md-cols')).toBe('3');
        expect(root.getAttribute('data-l-gap')).toBe('md');
        expect([...root.children].map((c) => c.tagName)).toEqual(['LI', 'LI']);
        expectAnatomy(container, gridAnatomy);
    });

    it('Stack, Row and Col render as the caller\'s element, orientation included', () => {
        render(
            <div>
                <Stack asChild gap="sm">{(p: PartProps) => <nav {...p}>a</nav>}</Stack>
                <Row asChild justify="between">{(p: PartProps) => <ul {...p}><li>b</li></ul>}</Row>
                <Col asChild align="center">{(p: PartProps) => <ol {...p}><li>c</li></ol>}</Col>
            </div>,
            container,
        );
        const roots = container.querySelectorAll<HTMLElement>('[data-scope="stack"][data-part="root"]');
        expect([...roots].map((r) => r.tagName)).toEqual(['NAV', 'UL', 'OL']);
        expect([...roots].map((r) => r.getAttribute('data-orientation'))).toEqual(['horizontal', 'horizontal', 'vertical']);
        expect(roots[0]!.getAttribute('data-l-gap')).toBe('sm');
        expect(roots[1]!.getAttribute('data-l-justify')).toBe('between');
        expect(roots[2]!.getAttribute('data-l-align')).toBe('center');
        expectAnatomy(container, stackAnatomy);
    });

    it('Join renders as a <fieldset>, and its items still read its orientation', () => {
        render(
            <Join asChild orientation="vertical">
                {(p: PartProps) => (
                    <fieldset {...p}>
                        <Join.Item asChild>{(i: PartProps) => <button {...i}>A</button>}</Join.Item>
                    </fieldset>
                )}
            </Join>,
            container,
        );
        const root = part('join', 'root');
        expect(root.tagName).toBe('FIELDSET');
        expect(root.getAttribute('data-orientation')).toBe('vertical');
        expect(part('join', 'item').getAttribute('data-orientation')).toBe('vertical');
        expectAnatomy(container, joinAnatomy);
    });

    it('Chat rows render as <li> inside the consumer\'s log list', () => {
        render(
            <ol role="log">
                <Chat asChild placement="end" color="primary">
                    {(p: PartProps) => (
                        <li {...p}>
                            <Chat.Bubble>Agreed.</Chat.Bubble>
                        </li>
                    )}
                </Chat>
            </ol>,
            container,
        );
        const root = part('chat', 'root');
        expect(root.tagName).toBe('LI');
        expect(root.parentElement!.tagName).toBe('OL');
        expect(root.getAttribute('data-placement')).toBe('end');
        expect(root.getAttribute('data-color')).toBe('primary');
        expectAnatomy(container, chatAnatomy);
    });

    it('Stats renders as a <section>, items still mirroring its orientation', () => {
        render(
            <Stats asChild orientation="vertical" aria-label="This month">
                {(p: PartProps) => (
                    <section {...p}>
                        <Stats.Item>
                            <Stats.Title>Revenue</Stats.Title>
                            <Stats.Value>$12,930</Stats.Value>
                        </Stats.Item>
                    </section>
                )}
            </Stats>,
            container,
        );
        const root = part('stats', 'root');
        expect(root.tagName).toBe('SECTION');
        expect(root.getAttribute('aria-label')).toBe('This month');
        expect(part('stats', 'item').getAttribute('data-orientation')).toBe('vertical');
        expectAnatomy(container, statsAnatomy);
    });

    it('without asChild every root is still a <div> with its class', () => {
        render(
            <div>
                <Box class="b" />
                <Center class="c" />
                <Container class="d" />
                <Grid class="e" />
                <Stack class="f" />
                <Join class="g" />
                <Chat class="h" />
                <Stats class="i" />
            </div>,
            container,
        );
        const roots = container.querySelectorAll<HTMLElement>('[data-part="root"]');
        expect(roots).toHaveLength(8);
        for (const r of roots) expect(r.tagName).toBe('DIV');
        expect([...roots].map((r) => r.className)).toEqual(['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
    });
});

describe('Card title and description take asChild (#275)', () => {
    it('default to an <h3> and a <p>', () => {
        render(
            <Card.Root>
                <Card.Header>
                    <Card.Title class="t">Report</Card.Title>
                    <Card.Description>Updated</Card.Description>
                </Card.Header>
            </Card.Root>,
            container,
        );
        expect(part('card', 'title').tagName).toBe('H3');
        expect(part('card', 'title').className).toBe('t');
        expect(part('card', 'description').tagName).toBe('P');
        expectAnatomy(container, cardAnatomy);
    });

    it('render the heading level the outline wants, and a multi-paragraph description', () => {
        render(
            <Card.Root asChild>
                {(p: PartProps) => (
                    <article {...p}>
                        <Card.Header>
                            <Card.Title asChild id="report-title">{(t: PartProps) => <h2 {...t}>Report</h2>}</Card.Title>
                            <Card.Description asChild>
                                {(d: PartProps) => <div {...d}><p>One.</p><p>Two.</p></div>}
                            </Card.Description>
                        </Card.Header>
                    </article>
                )}
            </Card.Root>,
            container,
        );
        const title = part('card', 'title');
        expect(title.tagName).toBe('H2');
        expect(title.id).toBe('report-title');
        const description = part('card', 'description');
        expect(description.tagName).toBe('DIV');
        expect(description.querySelectorAll('p')).toHaveLength(2);
        expectAnatomy(container, cardAnatomy);
    });
});
