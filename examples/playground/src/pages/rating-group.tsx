import { component, signal } from 'sigx';
import { RatingGroup } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import type { PageEntry } from './registry';

const RatingGroupDemos = component(() => {
    const state = signal({ stars: 3.5 });

    return () => (
        <>
            <p>
                Radio semantics with fractional display: hover previews without
                committing (<code>data-highlighted</code> marks the range), the
                pointer x decides halves with <code>allowHalf</code>, and the
                keyboard moves the <em>value</em> — one tab stop that rides{' '}
                <code>ceil(value)</code>.
            </p>
            <DemoRow gap="2rem" align="flex-end">
                <RatingGroup.Root model={() => state.stars} allowHalf name="stars">
                    <RatingGroup.Label>Rate this (halves)</RatingGroup.Label>
                    <RatingGroup.Control>
                        {[1, 2, 3, 4, 5].map((i) => <RatingGroup.Item index={i} />)}
                    </RatingGroup.Control>
                </RatingGroup.Root>
                <RatingGroup.Root defaultValue={4} deselectable>
                    <RatingGroup.Label>Whole stars, deselectable</RatingGroup.Label>
                    <RatingGroup.Control>
                        {[1, 2, 3, 4, 5].map((i) => <RatingGroup.Item index={i} />)}
                    </RatingGroup.Control>
                </RatingGroup.Root>
                <RatingGroup.Root defaultValue={3.5} allowHalf readonly>
                    <RatingGroup.Label>Readonly average</RatingGroup.Label>
                    <RatingGroup.Control>
                        {[1, 2, 3, 4, 5].map((i) => <RatingGroup.Item index={i} />)}
                    </RatingGroup.Control>
                </RatingGroup.Root>
                <RatingGroup.Root defaultValue={0} required invalid>
                    <RatingGroup.Label>Invalid (a rating is required)</RatingGroup.Label>
                    <RatingGroup.Control>
                        {[1, 2, 3, 4, 5].map((i) => <RatingGroup.Item index={i} />)}
                    </RatingGroup.Control>
                </RatingGroup.Root>
            </DemoRow>
            <p><small>Model: <code>{state.stars}</code></small></p>
        </>
    );
}, { name: 'RatingGroupDemos' });

export const ratingGroupPage: PageEntry = {
    id: 'rating-group',
    title: 'RatingGroup',
    category: 'Forms & inputs',
    Demos: RatingGroupDemos,
};
