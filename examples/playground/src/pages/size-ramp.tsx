import { component } from 'sigx';
import { Avatar, Button, Checkbox, Select, Switch } from '@sigx/zero';
import { activeVocabulary } from '../design-systems';
import { DemoRow, AxisLabel } from '../demo/Section';
import { AVATAR_A } from './fixtures';
import type { PageEntry } from './registry';

const SizeRampDemos = component(() => {
    const axes = activeVocabulary;

    return () => (
        <>
            <p>
                The <code>size</code> axis is not a button's private property —
                fifteen scopes ship <code>[data-size]</code> rules. The ramp is
                the design system's own, read from the same manifest as the Button
                page's rows: no step is named in this file, so a system declaring
                three renders three rows and one declaring <code>2xl</code>{' '}
                renders it.
            </p>
            {axes().sizes.map((size) => (
                <DemoRow gap="0.75rem">
                    <AxisLabel width="3rem">{size}</AxisLabel>
                    <Avatar.Root size={size}>
                        {/* Decorative here: the row is a size sample, not a person. */}
                        <Avatar.Image src={AVATAR_A} alt="" />
                        <Avatar.Fallback>ZX</Avatar.Fallback>
                    </Avatar.Root>
                    <Button.Root size={size}>Button</Button.Root>
                    {/*
                      * Labelled, not bare: both render their label part
                      * only when given a default slot, so a childless
                      * one has no accessible name at all — an unnamed
                      * checkbox once per step, in every design system.
                      */}
                    <Checkbox.Root size={size} defaultChecked>Checkbox</Checkbox.Root>
                    <Switch.Root size={size} defaultChecked>Switch</Switch.Root>
                    <Select.Root size={size} defaultValue="apple">
                        {/* Same reason as the checkbox note above: a bare
                          * combobox trigger has no name-from-content (#326). */}
                        <Select.Trigger label={`Fruit (${size})`}>
                            <Select.Value />
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popup>
                            <Select.Item value="apple">Apple</Select.Item>
                            <Select.Item value="banana">Banana</Select.Item>
                        </Select.Popup>
                    </Select.Root>
                </DemoRow>
            ))}
        </>
    );
}, { name: 'SizeRampDemos' });

export const sizeRampPage: PageEntry = {
    id: 'size-ramp',
    title: 'Size ramp',
    category: 'Concepts',
    Demos: SizeRampDemos,
};
