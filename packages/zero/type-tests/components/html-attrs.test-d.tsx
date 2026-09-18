/**
 * The attribute pass-through (#49) against the REAL parts: `WithHtmlAttrs`
 * admits `aria-*`, the app's `data-*`, `id`, `title` and `role`, and makes
 * the contract-owned `data-*` names a compile error rather than a silent
 * override. (A hyphenated JSX attribute is only ever checked against a
 * property of that exact name, so `aria-label={{}}` or `data-mod-x` cannot
 * be caught here — those answer to `htmlAttrs` at runtime.)
 */
import { Alert, Badge, Button, Card, Checkbox, Dialog, Divider, Field, Menu, Progress, Select, Spinner, Stack, Switch, Table, Tabs } from '@sigx/zero';

// ── valid ──
export const labelled = <Button.Root aria-label="Close" aria-busy={true} aria-describedby="hint">×</Button.Root>;
export const appData = <Button.Root data-testid="save" data-row-id={3} id="save" title="Save" role="menuitem">Save</Button.Root>;
export const posting = <Button.Root type="submit" form="settings" name="intent" value="save">Save</Button.Root>;
export const row = <Table.Row data-row-id="r1" aria-rowindex={2}><Table.Cell colSpan={3} rowSpan={1}>Empty</Table.Cell></Table.Row>;
export const header = <Table.HeaderCell colSpan={2} id="h">H</Table.HeaderCell>;
export const region = <Card.Root role="region" aria-labelledby="t"><Card.Title id="t">Title</Card.Title></Card.Root>;
// The roll-out (#74): every part, asChild bags included.
export const badge = <Badge asChild id="b" title="Unread" data-testid="b">{(bag: Record<string, unknown>) => <a {...bag}>3</a>}</Badge>;
export const layout = <Stack.Root role="list" id="s"><Stack.Item role="listitem" data-row-id={1}>x</Stack.Item></Stack.Root>;
export const alert = <Alert.Root id="quota" title="Quota"><Alert.Close aria-label="Dismiss" /></Alert.Root>;
export const labelled2 = <Progress.Root aria-labelledby="h" id="p"><Progress.Label title="Upload">Upload</Progress.Label></Progress.Root>;

// ── invalid ──
// @ts-expect-error — data-state is the contract's
export const e1 = <Button.Root data-state="open">x</Button.Root>;
// @ts-expect-error — data-color is the `color` prop's
export const e2 = <Button.Root data-color="primary">x</Button.Root>;
// @ts-expect-error — data-disabled is a flag zero renders
export const e3 = <Button.Root data-disabled="">x</Button.Root>;
// @ts-expect-error — data-scope is the anatomy
export const e4 = <Table.Row data-scope="x">x</Table.Row>;
// @ts-expect-error — `title` is a string
export const e5 = <Button.Root title={1}>x</Button.Root>;
// @ts-expect-error — colSpan is a number
export const e6 = <Table.Cell colSpan="3">x</Table.Cell>;
export const tabs = <Tabs.List aria-label="Settings" data-testid="tabs"><Tabs.Tab value="a" title="A">A</Tabs.Tab></Tabs.List>;
export const check = <Checkbox.Root id="terms" title="Terms" aria-label="Accept" data-testid="terms" />;
export const dialog = <Dialog.Popup aria-describedby="extra" data-testid="confirm" title="Confirm">x</Dialog.Popup>;
export const trigger = <Select.Trigger aria-label="Fruit" data-testid="fruit">x</Select.Trigger>;

// ── refused: the name is the part's own (#74) ──
// @ts-expect-error — a divider IS a separator
export const r1 = <Divider role="presentation" />;
// @ts-expect-error — a spinner is a live `status`
export const r2 = <Spinner role="img" />;
// @ts-expect-error — the root is the `alert` live region
export const r3 = <Alert.Root role="status">x</Alert.Root>;
// @ts-expect-error — the Label's id is what the progressbar points at
export const r4 = <Progress.Label id="mine">x</Progress.Label>;
// @ts-expect-error — the contract's own data-* stays refused on every part
export const r5 = <Badge data-variant="soft">x</Badge>;
// @ts-expect-error — the Panel is labelled by the tab's own id
export const r6 = <Tabs.Tab value="a" id="mine">A</Tabs.Tab>;
// @ts-expect-error — the input is the `switch`
export const r7 = <Switch.Root role="checkbox" />;
// @ts-expect-error — the control is labelled by the Label's own id
export const r8 = <Field.Label id="mine">Email</Field.Label>;
// @ts-expect-error — the Root's `role` prop picks dialog or alertdialog
export const r9 = <Dialog.Popup role="alertdialog">x</Dialog.Popup>;
// @ts-expect-error — the item's id is the active descendant
export const r10 = <Select.Item value="a" id="mine">A</Select.Item>;
// @ts-expect-error — a menu item is a `menuitem`
export const r11 = <Menu.Item value="a" role="option">A</Menu.Item>;
