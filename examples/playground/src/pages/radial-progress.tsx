import { component, signal } from 'sigx';
import { RadialProgress } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';

const RadialProgressDemos = component(() => {
    const state = signal({ value: 62 });

    return () => (
        <>
            <p>
                Circular progress as its own scope — a radial has no
                track/range geometry, so the ring is one painted layer on the
                root. The value model is linear progress's, verbatim:{' '}
                <code>value: number | null</code>,{' '}
                <code>role="progressbar"</code>, and the same runtime-published{' '}
                <code>--progress-percent</code> the recipes turn into the arc.
            </p>
            <DemoRow gap="2rem" align="center">
                <RadialProgress.Root value={state.value}>
                    <RadialProgress.Label>Upload</RadialProgress.Label>
                    <RadialProgress.ValueText />
                </RadialProgress.Root>
                <RadialProgress.Root value={state.value} color={pickRole('info')}>
                    <RadialProgress.Label>Sync</RadialProgress.Label>
                    <RadialProgress.ValueText />
                </RadialProgress.Root>
                <RadialProgress.Root value={100}>
                    <RadialProgress.Label>Backup</RadialProgress.Label>
                    <RadialProgress.ValueText>Done</RadialProgress.ValueText>
                </RadialProgress.Root>
                <RadialProgress.Root value={null}>
                    <RadialProgress.Label>Indexing</RadialProgress.Label>
                </RadialProgress.Root>
            </DemoRow>
            <p>
                <small>
                    <button type="button" onClick={() => { state.value = Math.max(0, state.value - 10); }}>-10</button>{' '}
                    <button type="button" onClick={() => { state.value = Math.min(100, state.value + 10); }}>+10</button>{' '}
                    value: <code>{state.value}</code> — at 100 the state flips
                    to <code>complete</code>; <code>null</code> is{' '}
                    <code>indeterminate</code>, whose loop stops (rather than
                    strobes) under reduced motion.
                </small>
            </p>
        </>
    );
}, { name: 'RadialProgressDemos' });

export const radialProgressPage: PageEntry = {
    id: 'radial-progress',
    title: 'RadialProgress',
    category: 'Display & feedback',
    Demos: RadialProgressDemos,
};
