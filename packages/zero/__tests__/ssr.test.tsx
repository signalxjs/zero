import { describe, it, expect } from 'vitest';
import { renderToString } from '@sigx/server-renderer';
import { defineApp } from 'sigx';
import { Alert, Avatar, Badge, Breadcrumbs, Card, Carousel, Chat, Collapsible, Combobox, Countdown, Dialog, Diff, Divider, Drawer, FileUpload, Indicator, Input, Join, Kbd, Navbar, NumberInput, Pagination, RadialProgress, RatingGroup, Select, Skeleton, Spinner, Stats, Status, Steps, Swap, Switch, Table, Tabs, Textarea, Timeline, Toast, ToggleGroup, TreeView, createToaster, zeroPlugin } from '@sigx/zero';

function page() {
    return (
        <div>
            <Tabs.Root defaultValue="a">
                <Tabs.List>
                    <Tabs.Tab value="a">First</Tabs.Tab>
                    <Tabs.Tab value="b">Second</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="a">Panel A</Tabs.Panel>
                <Tabs.Panel value="b">Panel B</Tabs.Panel>
            </Tabs.Root>
            <Collapsible.Root defaultOpen>
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>
            <Switch.Root defaultChecked color="primary">Label</Switch.Root>
            <Dialog.Root>
                <Dialog.Trigger>Open</Dialog.Trigger>
                <Dialog.Popup>
                    <Dialog.Title>Title</Dialog.Title>
                    <Dialog.Close>Close</Dialog.Close>
                </Dialog.Popup>
            </Dialog.Root>
            <Avatar.Root>
                <Avatar.Image src="/me.png" alt="Me" />
                <Avatar.Fallback>ME</Avatar.Fallback>
            </Avatar.Root>
            <Toast.Viewport toaster={createToaster()} />
            <Combobox.Root name="fruit" defaultValue="apple">
                <Combobox.Control>
                    <Combobox.Input />
                    <Combobox.Trigger />
                </Combobox.Control>
                <Combobox.Popup>
                    <Combobox.Item value="apple">Apple</Combobox.Item>
                </Combobox.Popup>
            </Combobox.Root>
            <Select.Root name="pet" defaultValue="cat" placeholder="Pick a pet…">
                <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popup>
                    <Select.Item value="cat">Cat</Select.Item>
                    <Select.Item value="dog">Dog</Select.Item>
                </Select.Popup>
            </Select.Root>
            <ToggleGroup.Root defaultValue="b">
                <ToggleGroup.Item value="a">A</ToggleGroup.Item>
                <ToggleGroup.Item value="b">B</ToggleGroup.Item>
            </ToggleGroup.Root>
            <NumberInput.Root name="qty" defaultValue={3} min={0} max={9}>
                <NumberInput.Label>Qty</NumberInput.Label>
                <NumberInput.Control>
                    <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
                    <NumberInput.Input />
                    <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
                </NumberInput.Control>
            </NumberInput.Root>
            <Input.Root name="email" type="email" defaultValue="a@b.c">
                <Input.Label>Email</Input.Label>
                <Input.Control>
                    <Input.Input placeholder="you@example.com" />
                </Input.Control>
            </Input.Root>
            <Textarea.Root name="bio" rows={3} defaultValue="hi">
                <Textarea.Label>Bio</Textarea.Label>
                <Textarea.Textarea />
            </Textarea.Root>
            <Card.Root variant="outline">
                <Card.Header>
                    <Card.Title>Report</Card.Title>
                    <Card.Description>Updated</Card.Description>
                </Card.Header>
                <Card.Body>Body</Card.Body>
                <Card.Footer>Footer</Card.Footer>
            </Card.Root>
            <Alert.Root color="warning">
                <Alert.Icon>!</Alert.Icon>
                <Alert.Title>Quota</Alert.Title>
                <Alert.Description>92% used.</Alert.Description>
                <Alert.Close />
            </Alert.Root>
            <Badge color="success">Active</Badge>
            <Kbd size="sm">⌘</Kbd>
            <Status color="success" label="All systems go" />
            <Indicator.Root>
                <Indicator.Item><Badge color="error">9</Badge></Indicator.Item>
                <button type="button">Inbox</button>
            </Indicator.Root>
            <Stats.Root>
                <Stats.Item>
                    <Stats.Title>Revenue</Stats.Title>
                    <Stats.Value>$12,930</Stats.Value>
                    <Stats.Desc>+8%</Stats.Desc>
                </Stats.Item>
            </Stats.Root>
            <Chat.Root placement="end" color="primary">
                <Chat.Header>Me</Chat.Header>
                <Chat.Bubble>Agreed.</Chat.Bubble>
            </Chat.Root>
            <Timeline.Root>
                <Timeline.Item>
                    <Timeline.Marker />
                    <Timeline.Content placement="start">v1.0</Timeline.Content>
                    <Timeline.Connector />
                </Timeline.Item>
                <Timeline.Item>
                    <Timeline.Marker />
                    <Timeline.Content>v2.0</Timeline.Content>
                </Timeline.Item>
            </Timeline.Root>
            <Join.Root>
                <Join.Item><button type="button">One</button></Join.Item>
                <Join.Item><button type="button">Two</button></Join.Item>
            </Join.Root>
            <Navbar.Root>
                <Navbar.Start>Acme</Navbar.Start>
                <Navbar.Center><nav aria-label="Primary"><a href="/docs">Docs</a></nav></Navbar.Center>
                <Navbar.End><button type="button">Sign in</button></Navbar.End>
            </Navbar.Root>
            <Pagination.Root count={10} defaultPage={4} />
            <Drawer.Root label="Site navigation">
                <Drawer.Trigger>Menu</Drawer.Trigger>
                <Drawer.Panel>
                    <Drawer.Title>Navigation</Drawer.Title>
                    <Drawer.Close>Close</Drawer.Close>
                </Drawer.Panel>
            </Drawer.Root>
            <Steps.Root defaultStep="details" label="Checkout">
                <Steps.Item value="cart">
                    <Steps.Indicator>1</Steps.Indicator>
                    <Steps.Title>Cart</Steps.Title>
                    <Steps.Separator />
                </Steps.Item>
                <Steps.Item value="details">
                    <Steps.Indicator>2</Steps.Indicator>
                    <Steps.Title>Details</Steps.Title>
                </Steps.Item>
            </Steps.Root>
            <Breadcrumbs.Root>
                <Breadcrumbs.List>
                    <Breadcrumbs.Item>
                        <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
                        <Breadcrumbs.Separator />
                    </Breadcrumbs.Item>
                    <Breadcrumbs.Item>
                        <Breadcrumbs.Link href="/docs" current>Docs</Breadcrumbs.Link>
                    </Breadcrumbs.Item>
                </Breadcrumbs.List>
            </Breadcrumbs.Root>
            <Diff.Root defaultValue={40}>
                <Diff.Before><span>before</span></Diff.Before>
                <Diff.After><span>after</span></Diff.After>
                <Diff.Handle />
            </Diff.Root>
            <Countdown.Root label="Time remaining">
                <Countdown.Value value={10} digits={2} />
                :
                <Countdown.Value value={4} digits={2} />
            </Countdown.Root>
            <Swap.Root interactive label="Toggle theme" defaultActive>
                <Swap.On>On</Swap.On>
                <Swap.Off>Off</Swap.Off>
            </Swap.Root>
            <Carousel.Root label="Featured">
                <Carousel.Viewport>
                    <Carousel.Item>One</Carousel.Item>
                    <Carousel.Item>Two</Carousel.Item>
                </Carousel.Viewport>
                <Carousel.PrevTrigger>Prev</Carousel.PrevTrigger>
                <Carousel.NextTrigger>Next</Carousel.NextTrigger>
                <Carousel.IndicatorGroup>
                    <Carousel.Indicator index={0} />
                    <Carousel.Indicator index={1} />
                </Carousel.IndicatorGroup>
            </Carousel.Root>
            <FileUpload.Root name="attachments" accept="image/*" multiple>
                <FileUpload.Label>Attachments</FileUpload.Label>
                <FileUpload.Dropzone>Drop files here</FileUpload.Dropzone>
                <FileUpload.Trigger>Browse files</FileUpload.Trigger>
                <FileUpload.ItemGroup>{() => null}</FileUpload.ItemGroup>
            </FileUpload.Root>
            <Table.Root mods={{ zebra: true }}>
                <Table.Caption>Quarterly revenue</Table.Caption>
                <Table.Head>
                    <Table.Row>
                        <Table.HeaderCell>Quarter</Table.HeaderCell>
                        <Table.HeaderCell>Revenue</Table.HeaderCell>
                    </Table.Row>
                </Table.Head>
                <Table.Body>
                    <Table.Row selected>
                        <Table.Cell>Q1</Table.Cell>
                        <Table.Cell>$12,930</Table.Cell>
                    </Table.Row>
                </Table.Body>
            </Table.Root>
            <Divider />
            <Skeleton.Root>Article title</Skeleton.Root>
            <Spinner label="Loading results" />
            <RadialProgress.Root value={62}>
                <RadialProgress.Label>Upload</RadialProgress.Label>
                <RadialProgress.ValueText />
            </RadialProgress.Root>
            <RatingGroup.Root name="stars" defaultValue={2.5} allowHalf>
                <RatingGroup.Label>Stars</RatingGroup.Label>
                <RatingGroup.Control>
                    <RatingGroup.Item index={1} />
                    <RatingGroup.Item index={2} />
                    <RatingGroup.Item index={3} />
                </RatingGroup.Control>
            </RatingGroup.Root>
            <TreeView.Root defaultValue="a/1" defaultExpandedValues={['a']}>
                <TreeView.Label>Tree</TreeView.Label>
                <TreeView.Tree>
                    <TreeView.Branch value="a">
                        <TreeView.BranchTrigger><TreeView.BranchIndicator />a</TreeView.BranchTrigger>
                        <TreeView.BranchContent>
                            <TreeView.Item value="a/1">one</TreeView.Item>
                        </TreeView.BranchContent>
                    </TreeView.Branch>
                    <TreeView.Item value="b">b</TreeView.Item>
                </TreeView.Tree>
            </TreeView.Root>
        </div>
    );
}

// The per-request app factory pattern: a fresh app with zeroPlugin() gives
// each render its own id generator, so ids are deterministic per request.
function renderPage(): Promise<string> {
    const app = defineApp(page());
    app.use(zeroPlugin());
    return renderToString(app);
}

describe('SSR', () => {
    it('server markup is deterministic across renders', async () => {
        const a = await renderPage();
        const b = await renderPage();
        expect(a).toBe(b);
    });

    it('renders the anatomy and closed overlays on the server', async () => {
        const html = await renderPage();
        expect(html).toContain('data-scope="tabs"');
        expect(html).toContain('data-state="active"');
        expect(html).toContain('data-scope="collapsible"');
        // Overlays render closed; content is present for SEO but the dialog
        // is not open.
        expect(html).toContain('data-scope="dialog"');
        expect(html).toMatch(/<dialog[^>]*data-state="closed"/);
        expect(html).not.toMatch(/<dialog[^>]*\sopen/);
        // Variant axes serialize.
        expect(html).toContain('data-color="primary"');
        // Avatar renders loading on the server; the fallback stays visible.
        expect(html).toMatch(/data-scope="avatar"[^>]*data-part="root"[^>]*data-state="loading"/);
        // The toast viewport server-renders as an empty top-layer region.
        expect(html).toMatch(/<ol[^>]*data-scope="toast"[^>]*popover="manual"/);
        expect(html).not.toMatch(/data-scope="toast"[^>]*data-part="root"/);
        // Native controls bound with model= carry their resting value on the
        // server — sigx's processor runs there too, so no hand-wired value=.
        expect(html).toMatch(/<input[^>]*data-scope="input"[^>]*data-part="input"[^>]*value="a@b.c"/);
        expect(html).toMatch(/<input[^>]*data-scope="switch"[^>]*data-part="hidden-input"[^>]*checked/);
        // The combobox posts pre-hydration through a real hidden <select>:
        // the selection is `selected` on its option, since a <select> has no
        // value attribute of its own (#441).
        expect(html).toMatch(/<select[^>]*data-scope="combobox"[^>]*data-part="hidden-input"[^>]*>[\s\S]*?<option value="apple"[^>]*selected/);
        // The select posts pre-hydration too, and its listbox renders closed.
        expect(html).toMatch(/<select[^>]*data-scope="select"[^>]*data-part="hidden-input"[^>]*>[\s\S]*?<option value="cat"[^>]*selected/);
        expect(html).toMatch(/data-scope="select"[^>]*data-part="popup"[^>]*data-state="closed"/);
        expect(html).toMatch(/data-scope="combobox"[^>]*data-part="popup"[^>]*data-state="closed"/);
        // The toggle group's single tab stop resolves server-side from the
        // model (registration order stands in for DOM order).
        expect(html).toMatch(/data-scope="toggle-group"[^>]*data-part="item"[^>]*data-state="off"[^>]*tabindex="-1"/i);
        expect(html).toMatch(/data-scope="toggle-group"[^>]*data-part="item"[^>]*data-state="on"[^>]*tabindex="0"/i);
        // The number input posts pre-hydration and renders the committed value.
        expect(html).toMatch(/data-scope="number-input"[^>]*data-part="hidden-input"[^>]*value="3"/);
        // The draft binds with model= (#455): the server emits the resting value.
        expect(html).toMatch(/role="spinbutton"[^>]*data-scope="number-input"[^>]*data-part="input"[^>]*value="3"/);
        // Rating renders the fractional display server-side and posts it.
        expect(html).toMatch(/data-scope="rating-group"[^>]*data-part="item"[^>]*data-state="half"/);
        expect(html).toMatch(/data-scope="rating-group"[^>]*data-part="hidden-input"[^>]*value="2.5"/);
        // The tree renders open branches, levels and the selected tab stop
        // server-side (registration order stands in for DOM order).
        expect(html).toMatch(/data-scope="tree-view"[^>]*data-part="branch"[^>]*data-state="open"/);
        expect(html).toMatch(/data-scope="tree-view"[^>]*data-part="item"[^>]*data-selected=""[^>]*tabindex="0"/i);
        expect(html).toMatch(/aria-level="2"/);
    });
});
