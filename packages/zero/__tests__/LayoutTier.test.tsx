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
import { Box, Center, Col, Container, Grid, Row, Spacer, Stack, boxAnatomy, centerAnatomy, containerAnatomy, gridAnatomy, spacerAnatomy, stackAnatomy } from '@sigx/zero';
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
