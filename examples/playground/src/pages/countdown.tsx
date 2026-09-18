import { component } from 'sigx';
import { Countdown } from '@sigx/zero';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';

const CountdownDemos = component(({ signal, onMounted, onUnmounted }) => {
    // The APP owns time — this interval is demo logic, exactly where the
    // component's README says it belongs.
    const state = signal({ seconds: 5 * 60 + 42 });
    let timer: ReturnType<typeof setInterval> | undefined;
    onMounted(() => {
        timer = setInterval(() => {
            state.seconds = state.seconds > 0 ? state.seconds - 1 : 0;
        }, 1000);
    });
    onUnmounted(() => clearInterval(timer));

    return () => (
        <>
            <p>
                Display-only digits — the component has no timer of its own
                (time is app logic and an SSR hazard); this page's tick drives
                the <code>value</code> props. Each change replaces the digits
                element, so the skin's enter animation plays once per tick.
            </p>
            <p>
                <Countdown.Root label="Time remaining" size="lg">
                    <Countdown.Value value={Math.floor(state.seconds / 60)} digits={2} />
                    :
                    <Countdown.Value value={state.seconds % 60} digits={2} />
                </Countdown.Root>
            </p>
            <p>Static, with the colour axis and three units:</p>
            <p>
                <Countdown.Root color={pickRole('primary')}>
                    <Countdown.Value value={2} />h{' '}
                    <Countdown.Value value={41} digits={2} />m{' '}
                    <Countdown.Value value={7} digits={2} />s
                </Countdown.Root>
            </p>
        </>
    );
}, { name: 'CountdownDemos' });

export const countdownPage: PageEntry = {
    id: 'countdown',
    title: 'Countdown',
    category: 'Display & feedback',
    Demos: CountdownDemos,
};
