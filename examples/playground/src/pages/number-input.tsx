import { component, signal } from 'sigx';
import { NumberInput } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import type { PageEntry } from './registry';

const NumberInputDemos = component(() => {
    const state = signal({ qty: 2 as number | null, amount: 1234.5 as number | null });

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
                {/*
                  * Step 2 with a large step of 10 (PageUp/PageDown and
                  * Shift+Arrow). A value off the grid — the odd max End
                  * lands on, or a 5 written from outside — steps to the grid
                  * value in the direction of travel: 5 → ArrowUp 6,
                  * ArrowDown 4.
                  */}
                <NumberInput.Root defaultValue={4} min={0} max={99} step={2} largeStep={10}>
                    <NumberInput.Label>Even (step 2, large step 10)</NumberInput.Label>
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
            <p>
                <code>locale</code> and <code>formatOptions</code> hand display
                and parsing to <code>Intl.NumberFormat</code>: the committed
                value shows in the locale's own spelling (and is what
                <code>aria-valuetext</code> reads), typed text parses back
                through that locale's group, decimal and minus symbols with
                its currency or percent sign optional, and the hidden input
                still posts the canonical decimal.
            </p>
            <DemoRow gap="1rem" align="flex-end">
                <NumberInput.Root model={() => state.amount} name="amount" min={0} step={0.01} locale="de-DE" formatOptions={{ style: 'currency', currency: 'EUR' }}>
                    <NumberInput.Label>Betrag (de-DE, EUR)</NumberInput.Label>
                    <NumberInput.Control>
                        <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
                        <NumberInput.Input />
                        <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
                    </NumberInput.Control>
                </NumberInput.Root>
                {/* The narrow no-break space groups; any typed space does too. */}
                <NumberInput.Root defaultValue={1234567.5} locale="fr-FR">
                    <NumberInput.Label>Montant (fr-FR)</NumberInput.Label>
                    <NumberInput.Control>
                        <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
                        <NumberInput.Input />
                        <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
                    </NumberInput.Control>
                </NumberInput.Root>
                {/*
                  * The model is the fraction (0.15 shows as 15%) and a
                  * percent format steps by one percent unless told otherwise.
                  * No fraction digits and min 0: the numeric keypad.
                  */}
                <NumberInput.Root defaultValue={0.15} min={0} max={1} locale="en-US" formatOptions={{ style: 'percent' }}>
                    <NumberInput.Label>Discount (percent)</NumberInput.Label>
                    <NumberInput.Control>
                        <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
                        <NumberInput.Input />
                        <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
                    </NumberInput.Control>
                </NumberInput.Root>
            </DemoRow>
            <p><small>Betrag model: <code>{state.amount ?? '—'}</code></small></p>
        </>
    );
}, { name: 'NumberInputDemos' });

export const numberInputPage: PageEntry = {
    id: 'number-input',
    title: 'NumberInput',
    category: 'Forms & inputs',
    Demos: NumberInputDemos,
};
