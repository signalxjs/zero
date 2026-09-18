import { component, signal } from 'sigx';
import { TreeView } from '@sigx/zero';
import type { PageEntry } from './registry';

const TreeViewDemos = component(() => {
    const state = signal({ file: '' });

    return () => (
        <>
            <p>
                The APG tree: the controller exposes only <em>visible</em> nodes
                through the same flat-list interface every other component uses,
                so roving and typeahead work unchanged. ArrowRight expands then
                descends, ArrowLeft collapses then climbs, Enter/Space select —
                selection and expansion are separate acts.
            </p>
            <TreeView.Root model={() => state.file} defaultExpandedValues={['src']}>
                <TreeView.Label>Project files</TreeView.Label>
                <TreeView.Tree>
                    <TreeView.Branch value="src">
                        <TreeView.BranchTrigger>
                            <TreeView.BranchIndicator />
                            src
                        </TreeView.BranchTrigger>
                        <TreeView.BranchContent>
                            <TreeView.Item value="src/index.ts">index.ts</TreeView.Item>
                            <TreeView.Branch value="src/components">
                                <TreeView.BranchTrigger>
                                    <TreeView.BranchIndicator />
                                    components
                                </TreeView.BranchTrigger>
                                <TreeView.BranchContent>
                                    <TreeView.Item value="src/components/App.tsx">App.tsx</TreeView.Item>
                                    <TreeView.Item value="src/components/Nav.tsx">Nav.tsx</TreeView.Item>
                                </TreeView.BranchContent>
                            </TreeView.Branch>
                        </TreeView.BranchContent>
                    </TreeView.Branch>
                    <TreeView.Item value="package.json">package.json</TreeView.Item>
                    <TreeView.Item value="secrets.env" disabled>secrets.env</TreeView.Item>
                </TreeView.Tree>
            </TreeView.Root>
            <p><small>Selected: <code>{state.file || '—'}</code></small></p>
        </>
    );
}, { name: 'TreeViewDemos' });

export const treeViewPage: PageEntry = {
    id: 'tree-view',
    title: 'TreeView',
    category: 'Navigation & structure',
    Demos: TreeViewDemos,
};
