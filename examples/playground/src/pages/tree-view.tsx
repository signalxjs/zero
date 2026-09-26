import { component, signal } from 'sigx';
import { TreeView } from '@sigx/zero';
import type { PageEntry } from './registry';

const TreeViewDemos = component(({ onUnmounted }) => {
    const state = signal({ file: '' });
    // The lazy tree: `remote` has no children until it is first opened,
    // and is `loading` while they are "fetched".
    const lazy = signal({ file: '', loading: false, loaded: [] as string[] });
    let timer: ReturnType<typeof setTimeout> | undefined;
    onUnmounted(() => clearTimeout(timer));
    const onExpand = (values: string[]) => {
        if (!values.includes('remote') || lazy.loading || lazy.loaded.length > 0) return;
        lazy.loading = true;
        timer = setTimeout(() => {
            lazy.loaded = ['main.ts', 'server.ts'];
            lazy.loading = false;
        }, 1200);
    };

    return () => (
        <>
            <p>
                The APG tree: the controller exposes only <em>visible</em> nodes
                through the same flat-list interface every other component uses,
                so roving and typeahead work unchanged. ArrowRight expands then
                descends, ArrowLeft collapses then climbs, Enter/Space select —
                selection and expansion are separate acts on the keyboard;
                <kbd>*</kbd> expands every sibling branch. A click on a branch
                row selects it and toggles it.
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
            <p>
                <code>expandOnClick={'{false}'}</code>: a click on the row only
                selects, and the chevron is the toggle. <code>remote</code> loads
                its children on first open — the branch is <code>aria-busy</code>{' '}
                and its indicator reads <code>data-state="loading"</code> meanwhile.
            </p>
            <TreeView.Root model={() => lazy.file} expandOnClick={false} onExpandedValuesChange={onExpand}>
                <TreeView.Label>Remote files</TreeView.Label>
                <TreeView.Tree>
                    <TreeView.Branch value="remote" loading={lazy.loading}>
                        <TreeView.BranchTrigger>
                            <TreeView.BranchIndicator />
                            remote
                        </TreeView.BranchTrigger>
                        <TreeView.BranchContent>
                            {lazy.loaded.map((name) => (
                                <TreeView.Item value={`remote/${name}`}>{name}</TreeView.Item>
                            ))}
                        </TreeView.BranchContent>
                    </TreeView.Branch>
                    <TreeView.Branch value="docs">
                        <TreeView.BranchTrigger>
                            <TreeView.BranchIndicator />
                            docs
                        </TreeView.BranchTrigger>
                        <TreeView.BranchContent>
                            <TreeView.Item value="docs/guide.md">guide.md</TreeView.Item>
                        </TreeView.BranchContent>
                    </TreeView.Branch>
                </TreeView.Tree>
            </TreeView.Root>
            <p><small>Selected: <code>{lazy.file || '—'}</code></small></p>
        </>
    );
}, { name: 'TreeViewDemos' });

export const treeViewPage: PageEntry = {
    id: 'tree-view',
    title: 'TreeView',
    category: 'Navigation & structure',
    Demos: TreeViewDemos,
};
