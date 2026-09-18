import { component } from 'sigx';
import { Badge, Box, Button, Card, Center, Col, Container, Grid, Row, Spacer, Stack } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import { pickRole, pickScopeVariant } from '../design-systems';
import type { PageEntry } from './registry';

/**
 * A boxed child, so the geometry demos have something with visible edges.
 * Deliberately a zero component rather than a styled div: the page has to
 * survive the ds-smoke vocabulary invariant like any other.
 */
const Cell = component<{ children?: unknown }>(({ slots }) => () => (
    // No `variant`: not every skin wires one for badge (daisyui does not),
    // and the ds-smoke vocabulary invariant rightly fails a demo that
    // renders an axis value the live manifest never declared.
    <Badge>{slots.default?.()}</Badge>
), { name: 'Cell' });

const LayoutDemos = component(() => () => (
    <>
        <p>
            The layout tier. <code>Row</code> and <code>Col</code> are the same{' '}
            <code>stack</code> scope with a different{' '}
            <code>data-orientation</code>; <code>Spacer</code> pushes one
            boundary apart where <code>gap</code> would space everything
            equally.
        </p>
        <p>
            Every value here is a rung of the design system's own{' '}
            <code>--space-*</code> ramp, never a length — so switching the
            toolbar re-spaces this whole page, not just its controls. That is
            the thing to look at: the components do not change, the rhythm
            does.
        </p>

        <h3>gap</h3>
        <p>
            The same row at four rungs. A skin with a tight ramp (basic) and
            one with a coarse one (brutalist) disagree about how far apart
            these sit, and both are right.
        </p>
        {(['xs', 'sm', 'md', 'xl'] as const).map((gap) => (
            <DemoRow align="center">
                <code style="min-inline-size: 3rem">{gap}</code>
                <Row gap={gap}>
                    <Cell>one</Cell>
                    <Cell>two</Cell>
                    <Cell>three</Cell>
                </Row>
            </DemoRow>
        ))}

        <h3>align and justify</h3>
        <DemoRow>
            <Row gap="md" align="center" justify="between" padY="sm">
                <Cell>start</Cell>
                <Cell>middle</Cell>
                <Cell>end</Cell>
            </Row>
        </DemoRow>

        <h3>Spacer</h3>
        <p>
            The toolbar shape: a label at the reading edge, actions at the
            other, and nothing nested to achieve it.
        </p>
        {/* Deliberately NOT inside a DemoRow: that is itself a flex row, so
            the toolbar would be sized by its own content and a flexible
            Spacer would have no leftover room to take. At block level a Row
            is full width, which is the shape a real toolbar has. */}
        <Row gap="sm" align="center" padY="sm">
            <strong>Document</strong>
            <Spacer />
            <Button.Root variant={pickScopeVariant('button', 'outline', 'ghost', 'tertiary')} size="sm">Cancel</Button.Root>
            <Button.Root color={pickRole('primary')} size="sm">Save</Button.Root>
        </Row>
        <p>
            Given a <code>space</code> it stops flexing and becomes a fixed
            rung instead.
        </p>
        <DemoRow align="center">
            <Row gap="none">
                <Cell>a</Cell>
                <Spacer space="2xl" />
                <Cell>b</Cell>
            </Row>
        </DemoRow>

        <h3>Stack.Item grow</h3>
        <p>
            <code>flex-grow</code> applies to the flex item itself, so the
            child carries the part — which is why <code>Item</code> supports{' '}
            <code>asChild</code>.
        </p>
        <DemoRow>
            <Row gap="md">
                <Cell>fixed</Cell>
                <Stack.Item grow>
                    <Card.Root>
                        <Card.Body>takes the rest</Card.Body>
                    </Card.Root>
                </Stack.Item>
            </Row>
        </DemoRow>

        <h3>Responsive</h3>
        <p>
            A per-instance value per breakpoint —{' '}
            <code>{'gap={{ base: \'xs\', md: \'xl\' }}'}</code> renders{' '}
            <code>data-l-gap</code> plus <code>data-l-md-gap</code>. Narrow the
            window past this design system's <code>md</code> and the row
            tightens. The breakpoints are the skin's own, so the width this
            happens at changes with the toolbar too.
        </p>
        <DemoRow>
            <Row gap={{ base: 'xs', md: 'xl' }}>
                <Cell>one</Cell>
                <Cell>two</Cell>
                <Cell>three</Cell>
            </Row>
        </DemoRow>

        <h3>Grid</h3>
        <p>
            Counted columns, and cells that span. <code>cols</code> takes a
            breakpoint record like everything else, so this is three across on
            a wide window and one on a narrow one.
        </p>
        <Grid cols={{ base: 1, md: 3 }} gap="md">
            <Cell>one</Cell>
            <Cell>two</Cell>
            <Cell>three</Cell>
            <Grid.Cell span="full"><Cell>full width</Cell></Grid.Cell>
        </Grid>

        <p>
            <code>cols="auto"</code> is the mode that needs no breakpoint at
            all: tracks reflow by available width, and <code>track</code> sets
            how narrow a column may get first.
        </p>
        <Grid cols="auto" track="xs" gap="md">
            <Cell>alpha</Cell>
            <Cell>beta</Cell>
            <Cell>gamma</Cell>
            <Cell>delta</Cell>
            <Cell>epsilon</Cell>
        </Grid>

        <h3>Center</h3>
        <p>
            Both axes by default. <code>axis="inline"</code> centres
            horizontally and leaves the block axis alone — the distinction
            that makes this a component rather than a reminder about{' '}
            <code>place-items</code>.
        </p>
        <DemoRow>
            <Center pad="xl"><Cell>middle</Cell></Center>
        </DemoRow>

        <h3>Container</h3>
        <p>
            The element that stops a page running the full width of a large
            monitor. The width is a rung of this design system's own{' '}
            <code>--measure-*</code> ramp — a token family of its own, because
            the density ramp cannot reach page scale. Switch the toolbar and
            these change width.
        </p>
        <Col gap="sm">
            <Container measure="xs" padY="xs"><Box pad="sm">measure="xs"</Box></Container>
            <Container measure="sm" padY="xs"><Box pad="sm">measure="sm"</Box></Container>
            <Container measure="md" padY="xs"><Box pad="sm">measure="md"</Box></Container>
        </Col>
        <p>
            <code>measure="prose"</code> is the reading measure, in{' '}
            <code>ch</code>, so it tracks the type rather than the page.
        </p>
        <Container measure="prose" padY="xs">
            <Box pad="md">
                <code>measure="prose"</code> — a paragraph bounded by the
                reading measure rather than by the window. Line length is a
                typographic decision, which is why this rung is expressed in
                characters and not in rem.
            </Box>
        </Container>

        <h3>Box</h3>
        <p>
            The tier's one scope that paints: a padded surface that takes a
            semantic colour. The tint is the role's <code>-soft</code>
            derivation, because a panel is a large area of colour and a large
            area of <code>--color-error</code> is a warning label rather than
            a container.
        </p>
        <Col gap="md">
            <Box pad="lg">Plain — the base surface.</Box>
            <Box pad="lg" color={pickRole('primary')}>Tinted by role.</Box>
            <Box pad="lg" color={pickRole('warning', 'secondary')}>
                Another role, same component.
            </Box>
        </Col>
        <p>
            Padding is the layout attribute, not a <code>size</code> axis —
            a Box's size <em>is</em> its padding, and one fact gets one
            spelling.
        </p>
        <Row gap="md" wrap="wrap">
            <Box padX="2xl" padY="2xs" color={pickRole('info', 'primary')}>wide, short</Box>
            <Box pad="2xs" color={pickRole('success', 'primary')}>tight</Box>
        </Row>

        <h3>Nesting</h3>
        <p>
            A <code>Col</code> of <code>Row</code>s. Each layout part
            re-declares its own spacing, so the inner rows keep their own gap
            rather than inheriting the outer one.
        </p>
        <DemoRow>
            <Col gap="lg" pad="md">
                <Row gap="2xs"><Cell>tight</Cell><Cell>tight</Cell></Row>
                <Row gap="xl"><Cell>loose</Cell><Cell>loose</Cell></Row>
            </Col>
        </DemoRow>
    </>
), { name: 'LayoutDemos' });

export const layoutPage: PageEntry = {
    id: 'layout',
    title: 'Layout',
    category: 'Layout',
    Demos: LayoutDemos,
};
