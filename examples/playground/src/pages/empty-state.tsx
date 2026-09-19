import { component, signal } from 'sigx';
import { Button, EmptyState } from '@sigx/zero';
import type { PartProps } from '@sigx/zero';
import { pickRole, pickVariant } from '../design-systems';
import type { PageEntry } from './registry';

const EmptyStateDemos = component(() => {
    const state = signal({ attempts: 0 });

    return () => (
        <>
            <p>
                What stands where the content would be (#131): nothing yet,
                nothing found, nothing reachable. Every app wrote these three
                by hand; the parts they share are an <code>Icon</code>, a{' '}
                <code>Title</code>, a <code>Description</code> and an{' '}
                <code>Actions</code> band for the way out. No state, no
                behaviour — presence is your <code>if</code> — and no role of
                its own: it is the page's content while there is none, not an
                announcement. The tone is the <code>color</code> axis, Alert's
                answer.
            </p>
            <div style="max-width: 36rem; display: grid; gap: 1rem">
                <EmptyState.Root>
                    <EmptyState.Icon>∅</EmptyState.Icon>
                    <EmptyState.Title asChild>{(p: PartProps) => <h3 {...p}>No projects yet</h3>}</EmptyState.Title>
                    <EmptyState.Description>
                        Projects you create or are invited to will show up here.
                    </EmptyState.Description>
                    <EmptyState.Actions>
                        <Button.Root color={pickRole('primary')}>New project</Button.Root>
                        <Button.Root asChild variant={pickVariant('ghost', 'tertiary')}>
                            {(p: PartProps) => <a href="#/empty-state" {...p}>Browse templates</a>}
                        </Button.Root>
                    </EmptyState.Actions>
                </EmptyState.Root>

                <EmptyState.Root color={pickRole('error', 'danger')} data-demo="failure">
                    <EmptyState.Icon>⚠</EmptyState.Icon>
                    <EmptyState.Title asChild>{(p: PartProps) => <h3 {...p}>Could not load your projects</h3>}</EmptyState.Title>
                    <EmptyState.Description>
                        The server did not answer. Your work is saved.
                        {state.attempts > 0 ? ` Tried ${state.attempts} time${state.attempts === 1 ? '' : 's'}.` : ''}
                    </EmptyState.Description>
                    <EmptyState.Actions>
                        <Button.Root onClick={() => { state.attempts++; }}>Try again</Button.Root>
                    </EmptyState.Actions>
                </EmptyState.Root>

                <EmptyState.Root color={pickRole('warning')} size="sm" role="status">
                    <EmptyState.Icon>⌁</EmptyState.Icon>
                    <EmptyState.Title>You are offline</EmptyState.Title>
                    <EmptyState.Description>
                        Changes are kept on this device and sent when the connection returns.
                    </EmptyState.Description>
                </EmptyState.Root>
            </div>
        </>
    );
}, { name: 'EmptyStateDemos' });

export const emptyStatePage: PageEntry = {
    id: 'empty-state',
    title: 'EmptyState',
    category: 'Display & feedback',
    Demos: EmptyStateDemos,
};
