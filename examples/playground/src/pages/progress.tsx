import { component } from 'sigx';
import { Progress } from '@sigx/zero';
import type { PageEntry } from './registry';

const ProgressDemos = component(() => () => (
    <>
        {/*
          * All three progress states, since `value` is what decides
          * them: no value at all is `indeterminate` — zero writes no
          * width, so the design system's own rule sizes and animates
          * the range — and reaching the max is `complete`, which is a
          * different state rather than a fuller `loading`. The
          * `loading` sample on the Slider page mirrors a live value.
          */}
        <Progress.Root value={40}>
            <Progress.Label>Loading</Progress.Label>
            <Progress.Track><Progress.Range /></Progress.Track>
            <Progress.ValueText />
        </Progress.Root>
        <Progress.Root>
            <Progress.Label>Indeterminate (no value)</Progress.Label>
            <Progress.Track><Progress.Range /></Progress.Track>
            <Progress.ValueText />
        </Progress.Root>
        <Progress.Root value={100}>
            <Progress.Label>Complete</Progress.Label>
            <Progress.Track><Progress.Range /></Progress.Track>
            <Progress.ValueText />
        </Progress.Root>
    </>
), { name: 'ProgressDemos' });

export const progressPage: PageEntry = {
    id: 'progress',
    title: 'Progress',
    category: 'Display & feedback',
    Demos: ProgressDemos,
};
