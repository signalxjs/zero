import { component, signal } from 'sigx';
import { Skeleton, Spinner } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import { pickRole, pickSize } from '../design-systems';
import type { PageEntry } from './registry';

const SkeletonDemos = component(() => {
    const state = signal({ loading: true });

    return () => (
        <>
            <p>
                A skeleton holds the layout its content will occupy, so the
                children stay in the DOM through both states — swapping them
                out for a placeholder box would make the box the wrong size and
                the page jump when the real thing arrives. The recipe paints
                over them while <code>loading</code> and paints nothing once{' '}
                <code>loaded</code>. While loading the root is{' '}
                <code>inert</code>, so a link in the placeholder takes neither
                focus nor clicks.
            </p>
            <p>
                <small>
                    <button type="button" onClick={() => { state.loading = !state.loading; }}>
                        {state.loading ? 'Finish loading' : 'Start loading'}
                    </button>{' '}
                    state: <code>{state.loading ? 'loading' : 'loaded'}</code>
                </small>
            </p>
            {/*
              * The e2e reduced-motion spec finds this one by its text, so the
              * label is a stable handle rather than decoration.
              */}
            <div style="max-width: 24rem; display: grid; gap: 0.5rem">
                <Skeleton.Root model={() => state.loading}>
                    Quarterly revenue summary
                </Skeleton.Root>
                <Skeleton.Root model={() => state.loading} color={pickRole('primary')}>
                    A second line, tinted by the role
                </Skeleton.Root>
                {/* Placeholder controls are `inert` while loading (#274). */}
                <Skeleton.Root model={() => state.loading}>
                    <a href="#/skeleton">Read the full report</a>
                </Skeleton.Root>
            </div>
            <p>
                Under <code>prefers-reduced-motion</code> the loop stops rather
                than speeding up — a duration token would collapse to ~0 and
                strobe, so the animation duration is a literal and the fallback
                is a flat fill that still reads as "not content yet".
            </p>
        </>
    );
}, { name: 'SkeletonDemos' });

export const skeletonPage: PageEntry = {
    id: 'skeleton',
    title: 'Skeleton',
    category: 'Display & feedback',
    Demos: SkeletonDemos,
};

const SpinnerDemos = component(() => () => (
    <>
        <p>
            A busy indicator and nothing else — no state, because it spins or it
            is not rendered. <code>role="status"</code> carries an implicit
            polite live region, which is what makes the accessible name useful
            rather than noisy: it is announced when the spinner appears, not on
            every frame. The words are a visually hidden <code>label</code> part's
            text — a live region announces content, not an{' '}
            <code>aria-label</code>. The mark itself is the design system's.
        </p>
        {/*
          * Distinct labels on purpose: a spinner's hidden label is the only
          * text that names the instance — and the e2e specs locate by that
          * text rather than by document order (see the convention in
          * `e2e/demo.ts`).
          */}
        <DemoRow gap="1rem" align="center">
            <Spinner label="Loading results" />
            <Spinner color={pickRole('secondary')} label="Saving draft" />
            <Spinner color={pickRole('error', 'danger')} label="Retrying" />
        </DemoRow>
        <p>
            Beside text that already says it, <code>decorative</code> drops the
            role and the label and hides the mark:{' '}
            <Spinner decorative size={pickSize('sm')} /> Syncing your library…
        </p>
        <p>
            It is measured by the contrast audit's indicator matrix, unlike the
            skeleton: a spinner is a UI component and answers to the 3:1
            non-text floor, where a skeleton is the absence of content and a
            placeholder that loud would read as a filled block someone meant.
        </p>
    </>
), { name: 'SpinnerDemos' });

export const spinnerPage: PageEntry = {
    id: 'spinner',
    title: 'Spinner',
    category: 'Display & feedback',
    Demos: SpinnerDemos,
};
