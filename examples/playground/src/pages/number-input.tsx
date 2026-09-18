import { component, signal } from 'sigx';
import { NumberInput } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import type { PageEntry } from './registry';

const NumberInputDemos = component(() => {
    const state = signal({ qty: 2 as number | null });

    return () => (
        <>
            <p>
                A spinbutton over a real text input: typing is an uncommitted
                draft (commits on blur/Enter — parse → clamp → snap), stepping
                commits immediately, holding a trigger auto-repeats, and the
                hidden input posts the canonical decimal whatever the display
                format shows.
            </p>
            <DemoRow gap="1rem" align="flex-end">
                <NumberInput.Root model={() => state.qty} min={0} max={99}>
                    <NumberInput.Label>Quantity (0–99)</NumberInput.Label>
                    <NumberInput.Control>
                        <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
                        <NumberInput.Input />
                        <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
                    </NumberInput.Control>
                </NumberInput.Root>
                <NumberInput.Root defaultValue={19.9} min={0} step={0.1} allowWheel format={(v) => v.toFixed(2)}>
                    <NumberInput.Label>Price (step 0.1, wheel, formatted)</NumberInput.Label>
                    <NumberInput.Control>
                        <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
                        <NumberInput.Input />
                        <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
                    </NumberInput.Control>
                </NumberInput.Root>
                <NumberInput.Root defaultValue={5} disabled>
                    <NumberInput.Label>Disabled</NumberInput.Label>
                    <NumberInput.Control>
                        <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
                        <NumberInput.Input />
                        <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
                    </NumberInput.Control>
                </NumberInput.Root>
                {/*
                  * Readonly is not disabled: the value stays selectable
                  * and focusable, only the ways of changing it are shut —
                  * typing, stepping, the wheel and both triggers.
                  */}
                <NumberInput.Root defaultValue={7} readonly>
                    <NumberInput.Label>Readonly</NumberInput.Label>
                    <NumberInput.Control>
                        <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
                        <NumberInput.Input />
                        <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
                    </NumberInput.Control>
                </NumberInput.Root>
                <NumberInput.Root defaultValue={120} max={99} invalid>
                    <NumberInput.Label>Invalid (over max)</NumberInput.Label>
                    <NumberInput.Control>
                        <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
                        <NumberInput.Input />
                        <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
                    </NumberInput.Control>
                </NumberInput.Root>
            </DemoRow>
            <p><small>Quantity model: <code>{state.qty ?? '—'}</code></small></p>
        </>
    );
}, { name: 'NumberInputDemos' });

export const numberInputPage: PageEntry = {
    id: 'number-input',
    title: 'NumberInput',
    category: 'Forms & inputs',
    Demos: NumberInputDemos,
};
