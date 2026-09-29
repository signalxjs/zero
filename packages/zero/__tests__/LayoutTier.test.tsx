/**
 * The layout tier — Stack (with its Row/Col presets) and Spacer.
 *
 * Grouped the way ContentTier is: these are attribute carriers with no state
 * and no behavior, so splitting four anatomy assertions across four files
 * would be filing rather than testing.
 *
 * What is worth asserting here is exactly what zero owns — the attributes —
 * because everything else is the design system's. The CSS those attributes
 * select is covered by the kit's goldens, and the fact that it re-scales per
 * skin by the playground's e2e sweep.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import type { PartProps } from '@sigx/zero';
import {
    AppShell, Box, Center, Col, Container, Grid, Row, Spacer, Stack,
    appShellAnatomy, boxAnatomy, centerAnatomy, containerAnatomy, gridAnatomy, spacerAnatomy, stackAnatomy,
} from '@sigx/zero';
import { expectAnatomy } from './helpers';

let container: HTMLElement;
beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
});

const part = (scope: string, name: string): HTMLElement =>
    container.querySelector<HTMLElement>(`[data-scope="${scope}"][data-part="${name}"]`)!;

describe('Stack', () => {
    it('renders a valid anatomy and passes its layout attributes through', () => {
        render((
            <Stack gap="md" padX="lg" align="center" justify="between" wrap="wrap">
                <Stack.Item grow>a</Stack.Item>
            </Stack>
        ), container);
        expectAnatomy(container, stackAnatomy);

        const root = part('stack', 'root');
        expect(root.getAttribute('data-l-gap')).toBe('md');
        expect(root.getAttribute('data-l-pad-x')).toBe('lg');
        expect(root.getAttribute('data-l-align')).toBe('center');
        expect(root.getAttribute('data-l-justify')).toBe('between');
        expect(root.getAttribute('data-l-wrap')).toBe('wrap');
        expect(part('stack', 'item').getAttribute('data-l-grow')).toBe('1');
    });

    it('expands a responsive value into one attribute per breakpoint', () => {
        render(<Stack gap={{ base: 'sm', md: 'lg', xl: '2xl' }} />, container);
        const root = part('stack', 'root');
        expect(root.getAttribute('data-l-gap')).toBe('sm');
        expect(root.getAttribute('data-l-md-gap')).toBe('lg');
        expect(root.getAttribute('data-l-xl-gap')).toBe('2xl');
        expectAnatomy(container, stackAnatomy);
    });

    it('emits nothing for an unset prop', () => {
        render(<Stack />, container);
        const root = part('stack', 'root');
        expect(root.getAttributeNames().filter((n) => n.startsWith('data-l-'))).toEqual([]);
        // `grow` is a boolean, and `false` must mean "absent" rather than
        // `data-l-grow="0"` — the default already is 0.
        render(<Stack.Item grow={false}>x</Stack.Item>, container);
        expect(container.querySelector('[data-part="item"]')!.hasAttribute('data-l-grow')).toBe(false);
    });

    it('Row and Col are the same scope with a different orientation', () => {
        // A fresh container per render: the renderer owns the node it mounts
        // into, so clearing innerHTML between renders leaves it holding a
        // tree that is no longer in the document.
        const rendered = (node: ReturnType<typeof Row>): HTMLElement => {
            const host = document.createElement('div');
            document.body.append(host);
            render(node, host);
            return host.querySelector<HTMLElement>('[data-scope="stack"][data-part="root"]')!;
        };

        expect(rendered(<Row />).getAttribute('data-orientation')).toBe('horizontal');

        const col = rendered(<Col />);
        expect(col.getAttribute('data-orientation')).toBe('vertical');
        // Same SCOPE, which is the point: one anatomy, one recipe, one
        // manifest entry — the presets are spellings, not components.
        expect(col.getAttribute('data-scope')).toBe('stack');

        // An explicit orientation still wins over the preset's default, so
        // the presets stay a convenience rather than a constraint.
        expect(rendered(<Col orientation="horizontal" />).getAttribute('data-orientation')).toBe('horizontal');
    });

    it('asChild hands the attribute bag to the caller\'s element', () => {
        // The honest joint: `flex-grow` applies to the flex ITEM, so a
        // wrapper cannot grow the control inside it.
        render((
            <Stack>
                <Stack.Item grow asChild>{(p: PartProps) => <nav {...p}>menu</nav>}</Stack.Item>
            </Stack>
        ), container);
        const item = part('stack', 'item');
        expect(item.tagName).toBe('NAV');
        expect(item.getAttribute('data-l-grow')).toBe('1');
        expectAnatomy(container, stackAnatomy);
    });

    it('Stack, Row and Col take grow on the root (#459)', () => {
        // A nested Row or Col fills what its parent has left by growing
        // itself — a growing Stack.Item wrapper cannot hand its height on.
        const rootOf = (node: ReturnType<typeof Row>): HTMLElement => {
            const host = document.createElement('div');
            document.body.append(host);
            render(node, host);
            expectAnatomy(host, stackAnatomy);
            return host.querySelector<HTMLElement>('[data-scope="stack"][data-part="root"]')!;
        };
        expect(rootOf(<Col grow />).getAttribute('data-l-grow')).toBe('1');
        expect(rootOf(<Row grow />).getAttribute('data-l-grow')).toBe('1');
        expect(rootOf(<Stack grow />).getAttribute('data-l-grow')).toBe('1');
        // `false` and absent both mean no attribute: the default is 0.
        expect(rootOf(<Row grow={false} />).hasAttribute('data-l-grow')).toBe(false);
        expect(rootOf(<Col />).hasAttribute('data-l-grow')).toBe(false);
    });

    it('refuses a value outside the attribute\'s closed set', () => {
        // Contract data zero owns, so a typo is an error rather than an
        // attribute that silently matches nothing.
        expect(() => render(<Stack gap={'roomy' as never} />, container))
            .toThrow(/not a value of "gap"/);
    });
});

describe('Spacer', () => {
    it('renders a valid anatomy and is hidden from the accessibility tree', () => {
        render(<Spacer />, container);
        expectAnatomy(container, spacerAnatomy);
        const root = part('spacer', 'root');
        expect(root.getAttribute('aria-hidden')).toBe('true');
        // Absent `space` is the flexible spacer — the default, so no
        // attribute at all.
        expect(root.hasAttribute('data-l-space')).toBe(false);
    });

    it('takes a fixed rung of the spacing ramp', () => {
        render(<Spacer space="xl" />, container);
        expect(part('spacer', 'root').getAttribute('data-l-space')).toBe('xl');
        expectAnatomy(container, spacerAnatomy);
    });
});

describe('Grid', () => {
    it('renders a valid anatomy and passes its layout attributes through', () => {
        render((
            <Grid cols={3} gap="lg" align="center">
                <Grid.Cell span={2}>a</Grid.Cell>
            </Grid>
        ), container);
        expectAnatomy(container, gridAnatomy);

        const root = part('grid', 'root');
        // A number is stringified — `cols={3}` is how this gets written.
        expect(root.getAttribute('data-l-cols')).toBe('3');
        expect(root.getAttribute('data-l-gap')).toBe('lg');
        expect(root.getAttribute('data-l-align')).toBe('center');
        expect(part('grid', 'cell').getAttribute('data-l-span')).toBe('2');
    });

    it('takes the auto mode and its track', () => {
        render(<Grid cols="auto" track="lg" />, container);
        const root = part('grid', 'root');
        expect(root.getAttribute('data-l-cols')).toBe('auto');
        expect(root.getAttribute('data-l-track')).toBe('lg');
        expectAnatomy(container, gridAnatomy);
    });

    it('spans the whole row, and varies by breakpoint', () => {
        render((
            <Grid cols={{ base: 1, md: 2 }}>
                <Grid.Cell span="full">a</Grid.Cell>
            </Grid>
        ), container);
        const root = part('grid', 'root');
        expect(root.getAttribute('data-l-cols')).toBe('1');
        expect(root.getAttribute('data-l-md-cols')).toBe('2');
        expect(part('grid', 'cell').getAttribute('data-l-span')).toBe('full');
        expectAnatomy(container, gridAnatomy);
    });

    it('refuses a count outside the twelve-column grid', () => {
        expect(() => render(<Grid cols={13 as never} />, container))
            .toThrow(/not a value of "cols"/);
    });

    it('asChild hands the cell bag to the caller\'s element', () => {
        render((
            <Grid>
                <Grid.Cell span="full" asChild>{(p: PartProps) => <section {...p}>wide</section>}</Grid.Cell>
            </Grid>
        ), container);
        expect(part('grid', 'cell').tagName).toBe('SECTION');
        expectAnatomy(container, gridAnatomy);
    });
});

describe('Center', () => {
    it('renders a valid anatomy and defaults to both axes', () => {
        render(<Center pad="xl">x</Center>, container);
        expectAnatomy(container, centerAnatomy);
        const root = part('center', 'root');
        expect(root.getAttribute('data-l-pad')).toBe('xl');
        // Absent `axis` is `both` — the default, so no attribute.
        expect(root.hasAttribute('data-l-axis')).toBe(false);
    });

    it('centres on one axis when asked', () => {
        render(<Center axis="inline">x</Center>, container);
        expect(part('center', 'root').getAttribute('data-l-axis')).toBe('inline');
        expectAnatomy(container, centerAnatomy);
    });
});

describe('Box', () => {
    it('carries a colour axis and layout padding together', () => {
        render(<Box color="warning" pad="lg">careful</Box>, container);
        expectAnatomy(container, boxAnatomy);
        const root = part('box', 'root');
        // The two families coexist on one element: `data-color` is the
        // design system's vocabulary, `data-l-pad` is zero's.
        expect(root.getAttribute('data-color')).toBe('warning');
        expect(root.getAttribute('data-l-pad')).toBe('lg');
    });

    it('takes the axis-split padding like the rest of the tier', () => {
        render(<Box padX="xl" padY="sm" />, container);
        const root = part('box', 'root');
        expect(root.getAttribute('data-l-pad-x')).toBe('xl');
        expect(root.getAttribute('data-l-pad-y')).toBe('sm');
        expectAnatomy(container, boxAnatomy);
    });

    it('renders no axis attribute when unset', () => {
        render(<Box />, container);
        const root = part('box', 'root');
        expect(root.hasAttribute('data-color')).toBe(false);
        expect(root.getAttributeNames().filter((n) => n.startsWith('data-l-'))).toEqual([]);
    });
});

describe('Container', () => {
    it('renders a valid anatomy and takes a measure', () => {
        render(<Container measure="lg" padX="xl">page</Container>, container);
        expectAnatomy(container, containerAnatomy);
        const root = part('container', 'root');
        expect(root.getAttribute('data-l-measure')).toBe('lg');
        expect(root.getAttribute('data-l-pad-x')).toBe('xl');
    });

    it('takes the reading measure and the unbounded one', () => {
        render(<Container measure="prose" />, container);
        expect(part('container', 'root').getAttribute('data-l-measure')).toBe('prose');

        const host = document.createElement('div');
        document.body.append(host);
        render(<Container measure="full" />, host);
        expect(host.querySelector('[data-part="root"]')!.getAttribute('data-l-measure')).toBe('full');
    });

    it('carries no colour axis — a container is a constraint, not a surface', () => {
        render(<Container />, container);
        const root = part('container', 'root');
        expect(root.hasAttribute('data-color')).toBe(false);
        // Unbounded by default: a page that wants no maximum should not have
        // to say `measure="full"`.
        expect(root.hasAttribute('data-l-measure')).toBe(false);
    });

    it('refuses a measure outside the ramp', () => {
        expect(() => render(<Container measure={'2xl' as never} />, container))
            .toThrow(/not a value of "measure"/);
    });
});

describe('AppShell', () => {
    const shell = (region: Record<string, unknown> = {}) => (
        <AppShell.Root>
            <AppShell.Body>
                <AppShell.Main>
                    <Row grow gap="none">
                        <AppShell.Region label="Messages" {...region}>list</AppShell.Region>
                        <AppShell.Region label="Reading pane">body</AppShell.Region>
                    </Row>
                </AppShell.Main>
            </AppShell.Body>
        </AppShell.Root>
    );

    it('renders a valid anatomy on the full composition', () => {
        render(shell(), container);
        expectAnatomy(container, appShellAnatomy);
        expect(container.querySelectorAll('[data-scope="app-shell"][data-part="region"]')).toHaveLength(2);
    });

    it('renders the landmarks: <main>, and each region a named, focusable <section>', () => {
        render(shell(), container);
        expect(part('app-shell', 'root').tagName).toBe('DIV');
        expect(part('app-shell', 'body').tagName).toBe('DIV');
        expect(part('app-shell', 'main').tagName).toBe('MAIN');
        const region = part('app-shell', 'region');
        expect(region.tagName).toBe('SECTION');
        expect(region.getAttribute('aria-label')).toBe('Messages');
        // Always focusable: WebKit does not make a scroller focusable, so a
        // text-only region would be unreachable by keyboard otherwise.
        expect(region.getAttribute('tabindex')).toBe('0');
    });

    it('carries no axis and no layout attribute — it is geometry only', () => {
        render(shell(), container);
        for (const el of container.querySelectorAll('[data-scope="app-shell"]')) {
            const names = el.getAttributeNames();
            expect(names.filter((n) => n.startsWith('data-l-') || ['data-color', 'data-size', 'data-variant'].includes(n))).toEqual([]);
        }
    });

    it('forwards id, aria-* and data-* on every part', () => {
        render((
            <AppShell.Root id="app" data-probe="root">
                <AppShell.Body aria-hidden="false" data-probe="body">
                    <AppShell.Main id="content" aria-describedby="hint" data-probe="main">
                        <AppShell.Region label="List" id="list" aria-busy="true" data-probe="region">x</AppShell.Region>
                    </AppShell.Main>
                </AppShell.Body>
            </AppShell.Root>
        ), container);
        expect(part('app-shell', 'root').id).toBe('app');
        expect(part('app-shell', 'body').getAttribute('aria-hidden')).toBe('false');
        expect(part('app-shell', 'main').id).toBe('content');
        expect(part('app-shell', 'main').getAttribute('aria-describedby')).toBe('hint');
        const region = part('app-shell', 'region');
        expect(region.id).toBe('list');
        expect(region.getAttribute('aria-busy')).toBe('true');
        for (const name of ['root', 'body', 'main', 'region']) {
            expect(part('app-shell', name).getAttribute('data-probe')).toBe(name);
        }
    });

    it('the part attributes win over the pass-through', () => {
        // `label` names the region; an `aria-label` from the bag loses to it.
        render(shell({ 'aria-label': 'Other' }), container);
        expect(part('app-shell', 'region').getAttribute('aria-label')).toBe('Messages');
    });

    it('refuses a reserved data-* (the untyped caller — TS refuses it)', () => {
        const attrs: Record<string, unknown> = { 'data-state': 'open' };
        expect(() => render(<AppShell.Main {...attrs}>x</AppShell.Main>, container)).toThrow(/data-state/);
    });

    it('requires a label on a region', () => {
        // Type-level only: an unnamed <section> is not a region landmark.
        // @ts-expect-error — `label` is required
        const node = <AppShell.Region>x</AppShell.Region>;
        expect(node).toBeTruthy();
    });
});
