import { component, signal } from 'sigx';
import { Pagination } from '@sigx/zero';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';

const PaginationDemos = component(() => {
    const state = signal({ page: 3 });
    return () => (
        <>
            <p>
                A page picker over a numbered range, options-driven: the row
                derives from <code>count</code> and the model, windowed at
                constant width (the sibling block slides near the edges
                instead of shrinking). The current page carries{' '}
                <code>aria-current="page"</code>; the <code>‹</code>/
                <code>›</code> triggers disable at the bounds.
            </p>
            <Pagination.Root count={12} model={[state, 'page']} />
            <p>Page {String(state.page)} of 12 — the model is two-way.</p>
            <p>Wider window: two siblings, two boundary pages.</p>
            <Pagination.Root count={20} defaultPage={9} siblingCount={2} boundaryCount={2} />
            <p>Coloured and small, where the vocabulary has roles:</p>
            <Pagination.Root count={8} defaultPage={2} color={pickRole('primary')} size="sm" label="Result pages" />
        </>
    );
}, { name: 'PaginationDemos' });

export const paginationPage: PageEntry = {
    id: 'pagination',
    title: 'Pagination',
    category: 'Navigation & structure',
    Demos: PaginationDemos,
};
