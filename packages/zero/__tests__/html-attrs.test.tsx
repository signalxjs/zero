/**
 * The attribute pass-through (#49).
 *
 * sigx hands a component every prop, but nothing reaches the element unless
 * the part puts it there — so an `aria-label` on `Button.Root` used to
 * compile (TypeScript never flags a hyphenated JSX attribute) and vanish.
 * Pinned here: `htmlAttrs` forwards `aria-*`, the app's `data-*`, `id`,
 * `title` and `role`; the contract's own `data-*` throws; the part's own
 * attributes win where both set one; and the parts the issue named forward.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { component, signal } from 'sigx';
import { anatomies } from '@sigx/zero/anatomy';
import {
    Alert, Avatar, Badge, Box, Breadcrumbs, Button, Card, Center, Chat, Container, Countdown, Divider,
    Grid, Indicator, Join, Kbd, Navbar, Progress, RadialProgress, Skeleton, Spacer, Spinner, Stack,
    Stats, Status, Table, Timeline,
    htmlAttrs, RESERVED_DATA_ATTRS, FLAG_VOCABULARY, LAYOUT_ATTR_PREFIX, MOD_ATTR_PREFIX,
} from '@sigx/zero';

describe('htmlAttrs', () => {
    it('forwards aria-*, data-*, id, title and role — nothing else', () => {
        expect(htmlAttrs({
            'aria-label': 'Close',
            'aria-busy': true,
            'data-row-id': 3,
            id: 'x',
            title: 't',
            role: 'region',
            class: 'c',
            onClick: () => {},
            disabled: true,
            children: [],
        })).toEqual({
            'aria-label': 'Close',
            'aria-busy': 'true',
            'data-row-id': 3,
            id: 'x',
            title: 't',
            role: 'region',
        });
    });

    it('skips an undefined value before the reserved guard', () => {
        expect(htmlAttrs({ 'aria-label': undefined, 'data-state': undefined })).toEqual({});
    });

    it.each([
        'data-scope', 'data-part', 'data-state', 'data-orientation', 'data-placement',
        'data-color', 'data-size', 'data-variant', 'data-disabled', 'data-focus-visible',
        'data-mod-block', 'data-l-gap', 'data-l-md-gap',
    ])('throws on the contract-owned %s', (name) => {
        expect(() => htmlAttrs({ [name]: 'x' })).toThrow(/anatomy contract/);
    });

    it.each([[{}], [null], [() => 'x'], [Symbol('s')]])('throws on a value an attribute cannot carry: %s', (value) => {
        expect(() => htmlAttrs({ 'aria-label': value })).toThrow(/string, number or boolean/);
    });

    it('takes only a string for id, title and role', () => {
        expect(() => htmlAttrs({ id: 3 })).toThrow(/expected a string/);
        expect(() => htmlAttrs({ role: true })).toThrow(/expected a string/);
    });

    it('renders an aria-* boolean as its token, keeps a data-* boolean', () => {
        expect(htmlAttrs({ 'aria-expanded': false, 'aria-busy': true, 'data-open': true }))
            .toEqual({ 'aria-expanded': 'false', 'aria-busy': 'true', 'data-open': true });
    });

    it('reserves every flag, and restates the layout and mod prefixes honestly', () => {
        for (const flag of FLAG_VOCABULARY) expect(RESERVED_DATA_ATTRS.has(`data-${flag}`)).toBe(true);
        // html-attrs.ts restates the layout prefix rather than importing it.
        expect(() => htmlAttrs({ [`${LAYOUT_ATTR_PREFIX}gap`]: 'md' })).toThrow();
        expect(() => htmlAttrs({ [`${MOD_ATTR_PREFIX}x`]: '' })).toThrow();
    });
});

describe('forwarding parts', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    const q = (scope: string, part: string) =>
        container.querySelector<HTMLElement>(`[data-scope="${scope}"][data-part="${part}"]`)!;

    it('Button.Root: aria-*, data-*, id, title and the form attributes', () => {
        render(
            <Button.Root
                aria-label="Close" aria-describedby="hint" data-testid="close" id="close" title="Close it"
                type="submit" form="settings" name="intent" value="close"
            >×</Button.Root>,
            container,
        );
        const el = q('button', 'root') as HTMLButtonElement;
        expect(el.getAttribute('aria-label')).toBe('Close');
        expect(el.getAttribute('aria-describedby')).toBe('hint');
        expect(el.getAttribute('data-testid')).toBe('close');
        expect(el.id).toBe('close');
        expect(el.title).toBe('Close it');
        expect(el.getAttribute('form')).toBe('settings');
        expect(el.name).toBe('intent');
        expect(el.value).toBe('close');
    });

    it('Button.Root: forwarded attributes ride the asChild bag', () => {
        render(
            <Button.Root asChild aria-label="Docs" data-testid="docs">
                {(p: Record<string, unknown>) => <a href="/docs" {...p}>?</a>}
            </Button.Root>,
            container,
        );
        const el = q('button', 'root');
        expect(el.tagName).toBe('A');
        expect(el.getAttribute('aria-label')).toBe('Docs');
        expect(el.getAttribute('data-testid')).toBe('docs');
    });

    it("Button.Root: the part's own attribute wins, an app's survives where the part sets none", () => {
        render(
            <Button.Root asChild disabled aria-disabled="false">
                {(p: Record<string, unknown>) => <a href="/docs" {...p}>Docs</a>}
            </Button.Root>,
            container,
        );
        expect(q('button', 'root').getAttribute('aria-disabled')).toBe('true');
        container.innerHTML = '';
        render(<Button.Root aria-disabled="true">Save</Button.Root>, container);
        expect(q('button', 'root').getAttribute('aria-disabled')).toBe('true');
    });

    it('Button.Root: a forwarded attribute follows its value', () => {
        const state = signal({ label: 'Save' });
        const App = component(() => () => <Button.Root aria-label={state.label}>✓</Button.Root>);
        render(<App />, container);
        expect(q('button', 'root').getAttribute('aria-label')).toBe('Save');
        state.label = 'Saved';
        expect(q('button', 'root').getAttribute('aria-label')).toBe('Saved');
    });

    it('Button.Root: a reserved data-* throws (the untyped caller — TS refuses it)', () => {
        const attrs: Record<string, unknown> = { 'data-state': 'open' };
        expect(() => render(<Button.Root {...attrs}>x</Button.Root>, container)).toThrow(/anatomy contract/);
    });

    it('Table: rows and cells forward, cells span, aria names the <table>', () => {
        render(
            <Table.Root aria-label="History" role="grid" data-testid="history" id="t">
                <Table.Head>
                    <Table.Row><Table.HeaderCell colSpan={2} id="h">When</Table.HeaderCell></Table.Row>
                </Table.Head>
                <Table.Body data-section="days">
                    <Table.Row data-day-row="mon" aria-rowindex={2}>
                        <Table.Cell colSpan={2} rowSpan={1} title="Monday">Mon</Table.Cell>
                    </Table.Row>
                </Table.Body>
            </Table.Root>,
            container,
        );
        const root = q('table', 'root');
        expect(root.id).toBe('t');
        expect(root.getAttribute('data-testid')).toBe('history');
        // aria-label on the scroll wrapper would name a generic div; the
        // table is what AT reads.
        expect(root.hasAttribute('aria-label')).toBe(false);
        expect(root.hasAttribute('role')).toBe(false);
        expect(q('table', 'table').getAttribute('aria-label')).toBe('History');
        expect(q('table', 'table').getAttribute('role')).toBe('grid');
        expect(q('table', 'body').getAttribute('data-section')).toBe('days');
        const row = container.querySelector<HTMLElement>('[data-day-row="mon"]')!;
        expect(row.getAttribute('data-part')).toBe('row');
        expect(row.getAttribute('aria-rowindex')).toBe('2');
        const cell = q('table', 'cell') as HTMLTableCellElement;
        expect(cell.colSpan).toBe(2);
        expect(cell.rowSpan).toBe(1);
        expect(cell.title).toBe('Monday');
        const th = q('table', 'header-cell') as HTMLTableCellElement;
        expect(th.colSpan).toBe(2);
        expect(th.id).toBe('h');
    });

    it('Card: role/aria on the root, and asChild renders the element a named card is', () => {
        render(
            <Card.Root role="region" aria-labelledby="t" data-testid="report">
                <Card.Title id="t">Report</Card.Title>
            </Card.Root>,
            container,
        );
        const root = q('card', 'root');
        expect(root.getAttribute('role')).toBe('region');
        expect(root.getAttribute('aria-labelledby')).toBe('t');
        expect(root.getAttribute('data-testid')).toBe('report');
        expect(q('card', 'title').id).toBe('t');

        container.innerHTML = '';
        render(
            <Card.Root asChild variant="outline">
                {(p: Record<string, unknown>) => <article aria-labelledby="t2" {...p}>Body</article>}
            </Card.Root>,
            container,
        );
        const article = q('card', 'root');
        expect(article.tagName).toBe('ARTICLE');
        expect(article.getAttribute('data-variant')).toBe('outline');
        expect(article.getAttribute('aria-labelledby')).toBe('t2');
    });
});

/**
 * The roll-out (#74): every part an app writes forwards. Table-driven
 * rather than one test per part — each fixture renders its scope with a
 * `data-probe="<part>"` on every part component, and the sweep asserts each
 * probe landed on the element carrying that part. The guard below it holds
 * the table to the anatomy registry, so a new part (or scope) that forgets
 * the pass-through fails here rather than in an app.
 */
describe('the pass-through reaches every part', () => {
    const p = (part: string) => ({ 'data-probe': part });

    const SWEEP: Record<string, () => unknown> = {
        alert: () => (
            <Alert.Root {...p('root')}>
                <Alert.Icon {...p('icon')}>!</Alert.Icon>
                <Alert.Title {...p('title')}>T</Alert.Title>
                <Alert.Description {...p('description')}>D</Alert.Description>
                <Alert.Close {...p('close')} />
            </Alert.Root>
        ),
        avatar: () => (
            <Avatar.Root {...p('root')}>
                <Avatar.Image {...p('image')} src="a.png" alt="A" />
                <Avatar.Fallback {...p('fallback')}>A</Avatar.Fallback>
            </Avatar.Root>
        ),
        badge: () => <Badge {...p('root')}>1</Badge>,
        box: () => <Box {...p('root')}>x</Box>,
        breadcrumbs: () => (
            <Breadcrumbs.Root {...p('root')}>
                <Breadcrumbs.List {...p('list')}>
                    <Breadcrumbs.Item {...p('item')}>
                        <Breadcrumbs.Link {...p('link')} href="/">Home</Breadcrumbs.Link>
                    </Breadcrumbs.Item>
                    <Breadcrumbs.Separator {...p('separator')} />
                </Breadcrumbs.List>
            </Breadcrumbs.Root>
        ),
        button: () => <Button.Root {...p('root')} loading>Save</Button.Root>,
        card: () => (
            <Card.Root {...p('root')}>
                <Card.Header {...p('header')}>
                    <Card.Title {...p('title')}>T</Card.Title>
                    <Card.Description {...p('description')}>D</Card.Description>
                </Card.Header>
                <Card.Body {...p('body')}>B</Card.Body>
                <Card.Footer {...p('footer')}>F</Card.Footer>
            </Card.Root>
        ),
        center: () => <Center {...p('root')}>x</Center>,
        chat: () => (
            <Chat.Root {...p('root')}>
                <Chat.Avatar {...p('avatar')}>A</Chat.Avatar>
                <Chat.Header {...p('header')}>H</Chat.Header>
                <Chat.Bubble {...p('bubble')}>B</Chat.Bubble>
                <Chat.Footer {...p('footer')}>F</Chat.Footer>
            </Chat.Root>
        ),
        container: () => <Container {...p('root')}>x</Container>,
        countdown: () => (
            <Countdown.Root {...p('root')}>
                <Countdown.Value {...p('value')} value={7} />
            </Countdown.Root>
        ),
        divider: () => <Divider {...p('root')} />,
        grid: () => (
            <Grid.Root {...p('root')}>
                <Grid.Cell {...p('cell')}>x</Grid.Cell>
            </Grid.Root>
        ),
        indicator: () => (
            <Indicator.Root {...p('root')}>
                <Indicator.Item {...p('item')}>1</Indicator.Item>
            </Indicator.Root>
        ),
        join: () => (
            <Join.Root {...p('root')}>
                <Join.Item {...p('item')}>x</Join.Item>
            </Join.Root>
        ),
        kbd: () => <Kbd {...p('root')}>K</Kbd>,
        navbar: () => (
            <Navbar.Root {...p('root')}>
                <Navbar.Start {...p('start')}>S</Navbar.Start>
                <Navbar.Center {...p('center')}>C</Navbar.Center>
                <Navbar.End {...p('end')}>E</Navbar.End>
            </Navbar.Root>
        ),
        progress: () => (
            <Progress.Root {...p('root')} value={40}>
                <Progress.Label {...p('label')}>Upload</Progress.Label>
                <Progress.Track {...p('track')}>
                    <Progress.Range {...p('range')} />
                </Progress.Track>
                <Progress.ValueText {...p('value-text')} />
            </Progress.Root>
        ),
        'radial-progress': () => (
            <RadialProgress.Root {...p('root')} value={40}>
                <RadialProgress.Label {...p('label')}>Upload</RadialProgress.Label>
                <RadialProgress.ValueText {...p('value-text')} />
            </RadialProgress.Root>
        ),
        skeleton: () => <Skeleton {...p('root')} />,
        spacer: () => <Spacer {...p('root')} />,
        spinner: () => <Spinner {...p('root')} />,
        stack: () => (
            <Stack.Root {...p('root')}>
                <Stack.Item {...p('item')}>x</Stack.Item>
            </Stack.Root>
        ),
        stats: () => (
            <Stats.Root {...p('root')}>
                <Stats.Item {...p('item')}>
                    <Stats.Title {...p('title')}>T</Stats.Title>
                    <Stats.Value {...p('value')}>V</Stats.Value>
                    <Stats.Desc {...p('desc')}>D</Stats.Desc>
                    <Stats.Figure {...p('figure')}>F</Stats.Figure>
                </Stats.Item>
            </Stats.Root>
        ),
        status: () => <Status {...p('root')} />,
        timeline: () => (
            <Timeline.Root {...p('root')}>
                <Timeline.Item {...p('item')}>
                    <Timeline.Marker {...p('marker')} />
                    <Timeline.Connector {...p('connector')} />
                    <Timeline.Content {...p('content')}>C</Timeline.Content>
                </Timeline.Item>
            </Timeline.Root>
        ),
    };

    /**
     * Parts zero renders itself, inside a part the app wrote — there is no
     * component to hand an attribute to.
     */
    const RENDERED_BY_ZERO: Record<string, readonly string[]> = {
        button: ['spinner'],
        countdown: ['digits'],
    };

    /**
     * Swept elsewhere, for a reason: Table.Root splits its attributes between
     * the scroll wrapper and the <table> (see "Table: rows and cells forward").
     */
    const SWEPT_ELSEWHERE = ['table'];

    /**
     * The scopes the roll-out has not reached yet (#74 part 2: the parts
     * that mint their own ids and roles, which need a per-part rule).
     * Shrinks to nothing.
     */
    const PENDING = [
        'accordion', 'carousel', 'checkbox', 'collapsible', 'combobox', 'dialog', 'diff',
        'drawer', 'field', 'file-upload', 'input', 'menu', 'number-input', 'pagination',
        'popover', 'radio-group', 'rating-group', 'select', 'slider', 'steps', 'swap',
        'switch', 'tabs', 'textarea', 'toast', 'toggle', 'toggle-group', 'tooltip', 'tree-view',
    ];

    it('accounts for every scope in the anatomy registry', () => {
        const accounted = [...Object.keys(SWEEP), ...SWEPT_ELSEWHERE, ...PENDING].sort();
        expect(accounted).toEqual(Object.keys(anatomies).sort());
    });

    it.each(Object.keys(SWEEP))('%s: every part forwards to its own element', (scope) => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        render(SWEEP[scope]!() as never, container);
        const probed = [...container.querySelectorAll<HTMLElement>('[data-probe]')];
        for (const el of probed) {
            expect(el.getAttribute('data-scope'), `data-probe="${el.dataset.probe}"`).toBe(scope);
            expect(el.getAttribute('data-part')).toBe(el.dataset.probe);
        }
        const reached = probed.map((el) => el.dataset.probe).sort();
        const expected = anatomies[scope as keyof typeof anatomies].partNames()
            .filter((part) => !RENDERED_BY_ZERO[scope]?.includes(part))
            .sort();
        expect(reached).toEqual(expected);
        container.remove();
    });
});

describe('the per-part rules', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    const q = (scope: string, part: string) =>
        container.querySelector<HTMLElement>(`[data-scope="${scope}"][data-part="${part}"]`)!;

    it('an id or role the part sets itself wins over an untyped caller (TS refuses both)', () => {
        const role: Record<string, unknown> = { role: 'presentation' };
        const id: Record<string, unknown> = { id: 'mine' };
        render(
            <div>
                <Divider {...role} />
                <Progress.Root value={1}><Progress.Label {...id}>L</Progress.Label></Progress.Root>
            </div>,
            container,
        );
        expect(q('divider', 'root').getAttribute('role')).toBe('separator');
        expect(q('progress', 'label').id).not.toBe('mine');
        expect(q('progress', 'root').getAttribute('aria-labelledby')).toBe(q('progress', 'label').id);
    });

    it('a default name gives way to an app aria-label; the label prop beats both', () => {
        render(
            <div>
                <Spinner aria-label="Saving" />
                <Breadcrumbs.Root aria-label="You are here" />
                <Alert.Root><Alert.Close aria-label="Dismiss" /></Alert.Root>
                <Countdown.Root aria-label="Launch in" />
                <Status aria-label="Online" />
            </div>,
            container,
        );
        expect(q('spinner', 'root').getAttribute('aria-label')).toBe('Saving');
        expect(q('breadcrumbs', 'root').getAttribute('aria-label')).toBe('You are here');
        expect(q('alert', 'close').getAttribute('aria-label')).toBe('Dismiss');
        // A name is what turns these two on: the timer role, and the dot
        // from hidden decoration into a named image.
        expect(q('countdown', 'root').getAttribute('role')).toBe('timer');
        expect(q('status', 'root').getAttribute('role')).toBe('img');
        expect(q('status', 'root').hasAttribute('aria-hidden')).toBe(false);

        container.innerHTML = '';
        render(<Spinner label="Uploading" aria-label="Saving" />, container);
        expect(q('spinner', 'root').getAttribute('aria-label')).toBe('Uploading');
    });

    it("an app aria-labelledby joins the progressbar's own", () => {
        render(
            <Progress.Root value={1} aria-labelledby="heading">
                <Progress.Label>Upload</Progress.Label>
            </Progress.Root>,
            container,
        );
        expect(q('progress', 'root').getAttribute('aria-labelledby'))
            .toBe(`${q('progress', 'label').id} heading`);
    });

    it('forwarded attributes ride the asChild bag', () => {
        render(
            <Badge asChild aria-label="3 unread" data-testid="unread">
                {(bag: Record<string, unknown>) => <a href="/inbox" {...bag}>3</a>}
            </Badge>,
            container,
        );
        const el = q('badge', 'root');
        expect(el.tagName).toBe('A');
        expect(el.getAttribute('aria-label')).toBe('3 unread');
        expect(el.getAttribute('data-testid')).toBe('unread');
    });
});
