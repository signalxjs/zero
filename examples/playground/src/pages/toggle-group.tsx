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
        </>
    );
}, { name: 'ToggleGroupDemos' });

export const toggleGroupPage: PageEntry = {
    id: 'toggle-group',
    title: 'ToggleGroup',
    category: 'Actions',
    Demos: ToggleGroupDemos,
};
