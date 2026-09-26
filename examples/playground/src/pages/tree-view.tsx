import { component, signal } from 'sigx';
import { TreeView } from '@sigx/zero';
import type { PageEntry } from './registry';

const TreeViewDemos = component(({ onUnmounted }) => {
    const state = signal({ file: '' });
    const multi = signal({ files: [] as string[] });
    // Leaf values only: `ui/legacy` is disabled and stays checked whatever
    // its branch does; `core/runtime` alone leaves `core` mixed.
    const checks = signal({ values: ['core/runtime', 'ui/legacy'] as string[] });
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
            <p>
                <code>multiple</code>: the model is a <code>string[]</code> and the
                tree is <code>aria-multiselectable</code>. Space toggles the focused
                node, Shift+ArrowUp/Down and Shift+Space select from the anchor,
                Ctrl/Cmd+Shift+Home/End extend to the edges, Ctrl/Cmd+A selects
                every visible node. A click replaces the selection,
                Ctrl/Cmd+click toggles, Shift+click selects the range.
            </p>
            <TreeView.Root multiple model={() => multi.files} defaultExpandedValues={['assets']}>
                <TreeView.Label>Multi-select files</TreeView.Label>
                <TreeView.Tree>
                    <TreeView.Branch value="assets">
                        <TreeView.BranchTrigger>
                            <TreeView.BranchIndicator />
                            assets
                        </TreeView.BranchTrigger>
                        <TreeView.BranchContent>
                            <TreeView.Item value="assets/logo.svg">logo.svg</TreeView.Item>
                            <TreeView.Item value="assets/draft.psd" disabled>draft.psd</TreeView.Item>
                            <TreeView.Item value="assets/hero.png">hero.png</TreeView.Item>
                        </TreeView.BranchContent>
                    </TreeView.Branch>
                    <TreeView.Item value="index.html">index.html</TreeView.Item>
                    <TreeView.Item value="styles.css">styles.css</TreeView.Item>
                    <TreeView.Item value="main.js">main.js</TreeView.Item>
                </TreeView.Tree>
            </TreeView.Root>
            <p><small>Selected: <code data-testid="tree-multi-selection">{multi.files.length > 0 ? multi.files.join(', ') : '—'}</code></small></p>
            <p>
                Checkable: <code>model:checkedValues</code> holds the checked
                {' '}<em>leaf</em> values, and a branch derives its state from its
                enabled leaves — checked when all are, mixed when some are. Space
                (or a click on the box) toggles the check; on a branch it checks or
                unchecks every enabled leaf beneath it, and a disabled leaf keeps
                its value. With no selection model, a click on a leaf row checks it
                too.
            </p>
            <TreeView.Root model:checkedValues={() => checks.values} defaultExpandedValues={['packages', 'core', 'ui']}>
                <TreeView.Label>Build targets</TreeView.Label>
                <TreeView.Tree>
                    <TreeView.Branch value="packages">
                        <TreeView.BranchTrigger>
                            <TreeView.BranchIndicator />
                            <TreeView.NodeCheckbox />
                            packages
                        </TreeView.BranchTrigger>
                        <TreeView.BranchContent>
                            <TreeView.Branch value="core">
                                <TreeView.BranchTrigger>
                                    <TreeView.BranchIndicator />
                                    <TreeView.NodeCheckbox />
                                    core
                                </TreeView.BranchTrigger>
                                <TreeView.BranchContent>
                                    <TreeView.Item value="core/runtime"><TreeView.NodeCheckbox />runtime</TreeView.Item>
                                    <TreeView.Item value="core/reactivity"><TreeView.NodeCheckbox />reactivity</TreeView.Item>
                                </TreeView.BranchContent>
                            </TreeView.Branch>
                            <TreeView.Branch value="ui">
                                <TreeView.BranchTrigger>
                                    <TreeView.BranchIndicator />
                                    <TreeView.NodeCheckbox />
                                    ui
                                </TreeView.BranchTrigger>
                                <TreeView.BranchContent>
                                    <TreeView.Item value="ui/button"><TreeView.NodeCheckbox />button</TreeView.Item>
                                    <TreeView.Item value="ui/dialog"><TreeView.NodeCheckbox />dialog</TreeView.Item>
                                    <TreeView.Item value="ui/legacy" disabled><TreeView.NodeCheckbox />legacy</TreeView.Item>
                                </TreeView.BranchContent>
                            </TreeView.Branch>
                        </TreeView.BranchContent>
                    </TreeView.Branch>
                    <TreeView.Item value="docs"><TreeView.NodeCheckbox />docs</TreeView.Item>
                </TreeView.Tree>
            </TreeView.Root>
            <p><small>Checked: <code data-testid="tree-checked-values">{checks.values.length > 0 ? checks.values.join(', ') : '—'}</code></small></p>
        </>
    );
}, { name: 'TreeViewDemos' });

export const treeViewPage: PageEntry = {
    id: 'tree-view',
    title: 'TreeView',
    category: 'Navigation & structure',
    Demos: TreeViewDemos,
};
