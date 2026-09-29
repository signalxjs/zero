import { component, signal } from 'sigx';
import { ToggleGroup } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import type { PageEntry } from './registry';

const ToggleGroupDemos = component(() => {
    const state = signal({ align: 'left' });

    return () => (
        <>
            <p>
                The group keeps one tab stop and roves with arrow keys; its model
                is always <code>string[]</code> — <code>multiple</code> changes
                the setter, not the shape.
            </p>
            <DemoRow gap="1rem">
                <ToggleGroup.Root model={() => state.align} deselectable={false} label="Alignment">
                    <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
                    <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
                    <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
                </ToggleGroup.Root>
                <ToggleGroup.Root multiple defaultValue={['bold']} label="Formatting">
                    <ToggleGroup.Item value="bold"><b>B</b></ToggleGroup.Item>
                    <ToggleGroup.Item value="italic"><i>I</i></ToggleGroup.Item>
                    <ToggleGroup.Item value="underline"><u>U</u></ToggleGroup.Item>
                    <ToggleGroup.Item value="strike" disabled><s>S</s></ToggleGroup.Item>
                </ToggleGroup.Root>
            </DemoRow>
            <p>
                An item may hold a <code>ToggleGroup.ItemIndicator</code>: an
                empty, <code>aria-hidden</code> span mirroring the item's{' '}
                <code>on|off</code>, where a design system draws a check —
                Material's segmented button slides one in before the label.
            </p>
            <DemoRow gap="1rem">
                <ToggleGroup.Root defaultValue="week" deselectable={false} label="Calendar view">
                    <ToggleGroup.Item value="day"><ToggleGroup.ItemIndicator />Day</ToggleGroup.Item>
                    <ToggleGroup.Item value="week"><ToggleGroup.ItemIndicator />Week</ToggleGroup.Item>
                    <ToggleGroup.Item value="month"><ToggleGroup.ItemIndicator />Month</ToggleGroup.Item>
                </ToggleGroup.Root>
                <ToggleGroup.Root multiple defaultValue={['wifi']} label="Connections">
                    <ToggleGroup.Item value="wifi"><ToggleGroup.ItemIndicator />Wi-Fi</ToggleGroup.Item>
                    <ToggleGroup.Item value="bluetooth"><ToggleGroup.ItemIndicator />Bluetooth</ToggleGroup.Item>
                    <ToggleGroup.Item value="cellular" disabled><ToggleGroup.ItemIndicator />Cellular</ToggleGroup.Item>
                </ToggleGroup.Root>
            </DemoRow>
        </>
    );
}, { name: 'ToggleGroupDemos' });

export const toggleGroupPage: PageEntry = {
    id: 'toggle-group',
    title: 'ToggleGroup',
    category: 'Actions',
    Demos: ToggleGroupDemos,
};
