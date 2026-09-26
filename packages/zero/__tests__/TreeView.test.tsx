import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { component, signal } from 'sigx';
import { TreeView, treeViewAnatomy, createTreeController } from '@sigx/zero';
import type { TreeItem } from '@sigx/zero';
import { expectAnatomy } from './helpers';

// ── Controller math (DOM-free) ──

function fakeNode(value: string, parentValue: string | null, isBranch = false, disabled = false): TreeItem {
    const el = document.createElement('div');
    document.body.appendChild(el);
    return {
        id: value,
        value,
        parentValue,
        isBranch: () => isBranch,
        disabled: () => disabled,
        el: () => el,
        textValue: () => value,
    };
}

describe('createTreeController', () => {
    it('items() shows only nodes whose ancestors are all expanded', () => {
        const expanded = new Set(['a']);
        const tree = createTreeController({ isExpanded: (v) => expanded.has(v) });
        tree.registerNode(fakeNode('a', null, true));
        tree.registerNode(fakeNode('a.1', 'a'));
        tree.registerNode(fakeNode('a.2', 'a', true));
        tree.registerNode(fakeNode('a.2.x', 'a.2'));
        tree.registerNode(fakeNode('b', null));

        expect(tree.items().map((i) => i.value)).toEqual(['a', 'a.1', 'a.2', 'b']);
        expanded.add('a.2');
        expect(tree.items().map((i) => i.value)).toEqual(['a', 'a.1', 'a.2', 'a.2.x', 'b']);
        expanded.delete('a');
        // Collapsing the root hides the whole subtree, including the still-
        // expanded a.2.
        expect(tree.items().map((i) => i.value)).toEqual(['a', 'b']);
    });

    it('level, childrenOf and find respect the hierarchy', () => {
        const tree = createTreeController({ isExpanded: () => false });
        tree.registerNode(fakeNode('a', null, true));
        tree.registerNode(fakeNode('a.1', 'a'));
        tree.registerNode(fakeNode('a.2', 'a', true));
        tree.registerNode(fakeNode('a.2.x', 'a.2'));

        expect(tree.level('a')).toBe(1);
        expect(tree.level('a.2.x')).toBe(3);
        expect(tree.childrenOf('a').map((i) => i.value)).toEqual(['a.1', 'a.2']);
        expect(tree.childrenOf(null).map((i) => i.value)).toEqual(['a']);
        // find() is visibility-scoped (the list interface); findNode is not.
        expect(tree.find('a.1')).toBeUndefined();
        expect(tree.findNode('a.1')?.value).toBe('a.1');
    });

    it('a disabled branch still counts in setsize', () => {
        const tree = createTreeController({ isExpanded: () => true });
        tree.registerNode(fakeNode('a', null));
        tree.registerNode(fakeNode('b', null, true, true));
        tree.registerNode(fakeNode('c', null));
        expect(tree.childrenOf(null).length).toBe(3);
        expect(tree.enabledItems().map((i) => i.value)).toEqual(['a', 'c']);
    });

    it('range() spans visible nodes in DOM order, either way round; empty when an end is hidden', () => {
        const tree = createTreeController({ isExpanded: (v) => v === 'a' });
        tree.registerNode(fakeNode('a', null, true));
        tree.registerNode(fakeNode('a.1', 'a'));
        tree.registerNode(fakeNode('b', null, true));
        tree.registerNode(fakeNode('b.1', 'b'));
        tree.registerNode(fakeNode('c', null, false, true));
        tree.registerNode(fakeNode('d', null));
        expect(tree.range('a.1', 'd').map((i) => i.value)).toEqual(['a.1', 'b', 'c', 'd']);
        expect(tree.range('d', 'a.1').map((i) => i.value)).toEqual(['a.1', 'b', 'c', 'd']);
        expect(tree.range('b', 'b').map((i) => i.value)).toEqual(['b']);
        // b.1 sits under the collapsed b.
        expect(tree.range('a', 'b.1')).toEqual([]);
        expect(tree.range('a', 'nope')).toEqual([]);
    });
});

// ── Component ──

function mountTree(container: HTMLElement, extra: {
    model?: unknown;
    defaultValue?: string;
    defaultExpandedValues?: string[];
    onExpandedValuesChange?: (v: string[]) => void;
} = {}) {
    render(
        <TreeView.Root
            model={extra.model as never}
            defaultValue={extra.defaultValue}
            defaultExpandedValues={extra.defaultExpandedValues ?? []}
            onExpandedValuesChange={extra.onExpandedValuesChange}
        >
            <TreeView.Label>Files</TreeView.Label>
            <TreeView.Tree>
                <TreeView.Branch value="src">
                    <TreeView.BranchTrigger>
                        <TreeView.BranchIndicator />
                        src
                    </TreeView.BranchTrigger>
                    <TreeView.BranchContent>
                        <TreeView.Item value="src/index.ts">index.ts</TreeView.Item>
                        <TreeView.Branch value="src/lib">
                            <TreeView.BranchTrigger>lib</TreeView.BranchTrigger>
                            <TreeView.BranchContent>
                                <TreeView.Item value="src/lib/util.ts">util.ts</TreeView.Item>
                            </TreeView.BranchContent>
                        </TreeView.Branch>
                    </TreeView.BranchContent>
                </TreeView.Branch>
                <TreeView.Item value="README.md">README.md</TreeView.Item>
                <TreeView.Item value="LICENSE" disabled>LICENSE</TreeView.Item>
            </TreeView.Tree>
        </TreeView.Root>,
        container,
    );
}

const byValue = (c: HTMLElement, text: string) =>
    [...c.querySelectorAll<HTMLElement>('[role="treeitem"]')].find((el) =>
        (el.getAttribute('data-part') === 'branch'
            ? el.querySelector('[data-part="branch-trigger"]')!.textContent
            : el.textContent)?.trim().includes(text))!;

const key = (k: string) => new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });

describe('TreeView', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy with APG tree roles', () => {
        mountTree(container, { defaultExpandedValues: ['src'] });
        expectAnatomy(container, treeViewAnatomy);
        const tree = container.querySelector('[data-part="tree"]')!;
        expect(tree.getAttribute('role')).toBe('tree');
        expect(tree.getAttribute('aria-labelledby'))
            .toBe(container.querySelector('[data-part="label"]')!.id);
        const branch = byValue(container, 'src');
        expect(branch.getAttribute('aria-expanded')).toBe('true');
        expect(branch.getAttribute('aria-level')).toBe('1');
        expect(container.querySelector('[data-part="branch-content"]')!.getAttribute('role')).toBe('group');
    });

    it('aria-level follows the hierarchy; posinset/setsize are left to the DOM', () => {
        mountTree(container, { defaultExpandedValues: ['src', 'src/lib'] });
        const util = byValue(container, 'util.ts');
        expect(util.getAttribute('aria-level')).toBe('3');
        const readme = byValue(container, 'README.md');
        expect(readme.getAttribute('aria-level')).toBe('1');
        // The full tree is in the DOM under role=group nesting, so AT
        // computes position/size — rendering them would freeze counts
        // before later siblings register.
        expect(readme.hasAttribute('aria-posinset')).toBe(false);
        expect(readme.hasAttribute('aria-setsize')).toBe(false);
    });

    it('collapsed content is hidden and invisible to navigation', () => {
        mountTree(container);
        const content = container.querySelector<HTMLElement>('[data-part="branch-content"]')!;
        expect(content.hasAttribute('hidden')).toBe(true);
        const branch = byValue(container, 'src');
        branch.focus();
        branch.dispatchEvent(key('ArrowDown'));
        // Next VISIBLE node is README.md, not the hidden index.ts.
        expect(document.activeElement).toBe(byValue(container, 'README.md'));
    });

    it('trigger click toggles and emits expandedValuesChange; focus parks on the branch', () => {
        const onExpandedValuesChange = vi.fn();
        mountTree(container, { onExpandedValuesChange });
        const trigger = container.querySelector<HTMLElement>('[data-part="branch-trigger"]')!;
        trigger.click();
        expect(onExpandedValuesChange).toHaveBeenCalledWith(['src']);
        expect(byValue(container, 'src').getAttribute('data-state')).toBe('open');
        expect(document.activeElement).toBe(byValue(container, 'src'));
        trigger.click();
        expect(byValue(container, 'src').getAttribute('data-state')).toBe('closed');
    });

    it('ArrowRight expands, then steps into the first child; ArrowLeft collapses, then climbs', () => {
        mountTree(container);
        const branch = byValue(container, 'src');
        branch.focus();
        branch.dispatchEvent(key('ArrowRight'));
        expect(branch.getAttribute('aria-expanded')).toBe('true');
        branch.dispatchEvent(key('ArrowRight'));
        expect(document.activeElement).toBe(byValue(container, 'index.ts'));
        byValue(container, 'index.ts').dispatchEvent(key('ArrowLeft'));
        expect(document.activeElement).toBe(branch);
        branch.dispatchEvent(key('ArrowLeft'));
        expect(branch.getAttribute('aria-expanded')).toBe('false');
    });

    it('Enter and Space select without toggling expansion', () => {
        const state = signal({ file: '' });
        mountTree(container, { model: [state, 'file'] });
        const branch = byValue(container, 'src');
        branch.dispatchEvent(key('Enter'));
        expect(state.file).toBe('src');
        expect(branch.getAttribute('aria-expanded')).toBe('false');
        const readme = byValue(container, 'README.md');
        readme.dispatchEvent(key(' '));
        expect(state.file).toBe('README.md');
        expect(readme.getAttribute('data-selected')).toBe('');
        expect(readme.getAttribute('aria-selected')).toBe('true');
    });

    it('trigger click selects the branch too, as Enter does', () => {
        const state = signal({ file: '' });
        mountTree(container, { model: [state, 'file'] });
        container.querySelector<HTMLElement>('[data-part="branch-trigger"]')!.click();
        expect(state.file).toBe('src');
        const branch = byValue(container, 'src');
        expect(branch.getAttribute('aria-selected')).toBe('true');
        expect(branch.getAttribute('aria-expanded')).toBe('true');
    });

    it('expandOnClick=false: the row only selects; the indicator only toggles', () => {
        const state = signal({ file: '' });
        const onExpandedValuesChange = vi.fn();
        render(
            <TreeView.Root model={[state, 'file'] as never} expandOnClick={false} onExpandedValuesChange={onExpandedValuesChange}>
                <TreeView.Tree>
                    <TreeView.Branch value="src">
                        <TreeView.BranchTrigger>
                            <TreeView.BranchIndicator />
                            src
                        </TreeView.BranchTrigger>
                        <TreeView.BranchContent>
                            <TreeView.Item value="src/index.ts">index.ts</TreeView.Item>
                        </TreeView.BranchContent>
                    </TreeView.Branch>
                </TreeView.Tree>
            </TreeView.Root>,
            container,
        );
        const branch = byValue(container, 'src');
        container.querySelector<HTMLElement>('[data-part="branch-trigger"]')!.click();
        expect(state.file).toBe('src');
        expect(branch.getAttribute('aria-expanded')).toBe('false');
        expect(onExpandedValuesChange).not.toHaveBeenCalled();

        state.file = '';
        const click = new MouseEvent('click', { bubbles: true, cancelable: true });
        container.querySelector<HTMLElement>('[data-part="branch-indicator"]')!.dispatchEvent(click);
        // No default activation either: an asChild link trigger stays put.
        expect(click.defaultPrevented).toBe(true);
        expect(branch.getAttribute('aria-expanded')).toBe('true');
        expect(onExpandedValuesChange).toHaveBeenCalledWith(['src']);
        // The indicator toggles alone: the row's click never saw it.
        expect(state.file).toBe('');
        expect(document.activeElement).toBe(branch);
    });

    it('expandOnClick=false: an indicator outside any Branch toggles nothing and swallows nothing', () => {
        const state = signal({ file: '' });
        const onExpandedValuesChange = vi.fn();
        render(
            <TreeView.Root model={[state, 'file'] as never} expandOnClick={false} onExpandedValuesChange={onExpandedValuesChange}>
                <TreeView.Tree>
                    <TreeView.Item value="leaf">
                        <TreeView.BranchIndicator />
                        leaf
                    </TreeView.Item>
                </TreeView.Tree>
            </TreeView.Root>,
            container,
        );
        const click = new MouseEvent('click', { bubbles: true, cancelable: true });
        container.querySelector<HTMLElement>('[data-part="branch-indicator"]')!.dispatchEvent(click);
        expect(onExpandedValuesChange).not.toHaveBeenCalled();
        // The click reaches the item it sits in, default intact.
        expect(click.defaultPrevented).toBe(false);
        expect(state.file).toBe('leaf');
    });

    it("'*' on a closed branch expands it along with its level", () => {
        const onExpandedValuesChange = vi.fn();
        render(
            <TreeView.Root onExpandedValuesChange={onExpandedValuesChange}>
                <TreeView.Tree>
                    {['a', 'b'].map((v) => (
                        <TreeView.Branch value={v}>
                            <TreeView.BranchTrigger>{v}</TreeView.BranchTrigger>
                            <TreeView.BranchContent>
                                <TreeView.Item value={`${v}/x`}>x</TreeView.Item>
                            </TreeView.BranchContent>
                        </TreeView.Branch>
                    ))}
                </TreeView.Tree>
            </TreeView.Root>,
            container,
        );
        const a = byValue(container, 'a');
        a.focus();
        a.dispatchEvent(key('*'));
        // APG's reference tree expands the current node with its siblings.
        expect(onExpandedValuesChange).toHaveBeenCalledWith(['a', 'b']);
        expect(document.activeElement).toBe(a);
    });

    it("'*' expands every enabled sibling branch and emits once", () => {
        const onExpandedValuesChange = vi.fn();
        render(
            <TreeView.Root defaultExpandedValues={['b']} onExpandedValuesChange={onExpandedValuesChange}>
                <TreeView.Tree>
                    <TreeView.Item value="leaf">leaf</TreeView.Item>
                    {['a', 'b', 'c'].map((v) => (
                        <TreeView.Branch value={v} disabled={v === 'c'}>
                            <TreeView.BranchTrigger>{v}</TreeView.BranchTrigger>
                            <TreeView.BranchContent>
                                <TreeView.Branch value={`${v}/n`}>
                                    <TreeView.BranchTrigger>{`${v}-nested`}</TreeView.BranchTrigger>
                                    <TreeView.BranchContent>
                                        <TreeView.Item value={`${v}/n/x`}>x</TreeView.Item>
                                    </TreeView.BranchContent>
                                </TreeView.Branch>
                            </TreeView.BranchContent>
                        </TreeView.Branch>
                    ))}
                </TreeView.Tree>
            </TreeView.Root>,
            container,
        );
        const leaf = byValue(container, 'leaf');
        leaf.focus();
        const e = key('*');
        leaf.dispatchEvent(e);
        // preventDefault: typeahead never searches for the `*`.
        expect(e.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(leaf);
        // Siblings only — never the nested level, never the disabled `c`.
        expect(onExpandedValuesChange).toHaveBeenCalledTimes(1);
        expect(onExpandedValuesChange).toHaveBeenCalledWith(['b', 'a']);
        // Nothing left to expand: no second emission.
        leaf.dispatchEvent(key('*'));
        expect(onExpandedValuesChange).toHaveBeenCalledTimes(1);
    });

    it('a loading branch is aria-busy; its indicator and open content read loading', () => {
        const loading = signal({ v: true });
        const App = component(() => () => (
            <TreeView.Root>
                <TreeView.Tree>
                    <TreeView.Branch value="remote" loading={loading.v}>
                        <TreeView.BranchTrigger>
                            <TreeView.BranchIndicator />
                            remote
                        </TreeView.BranchTrigger>
                        <TreeView.BranchContent />
                    </TreeView.Branch>
                </TreeView.Tree>
            </TreeView.Root>
        ));
        render(<App />, container);
        const branch = container.querySelector<HTMLElement>('[data-part="branch"]')!;
        const indicator = container.querySelector<HTMLElement>('[data-part="branch-indicator"]')!;
        const content = container.querySelector<HTMLElement>('[data-part="branch-content"]')!;
        expect(branch.getAttribute('aria-busy')).toBe('true');
        expect(indicator.getAttribute('data-state')).toBe('loading');
        // Closed content is hidden: it stays `closed`, loading or not.
        expect(content.getAttribute('data-state')).toBe('closed');
        expect(content.hidden).toBe(true);
        expectAnatomy(container, treeViewAnatomy);

        branch.focus();
        branch.dispatchEvent(key('ArrowRight'));
        expect(content.getAttribute('data-state')).toBe('loading');
        expect(content.hidden).toBe(false);
        expectAnatomy(container, treeViewAnatomy);

        loading.v = false;
        expect(branch.hasAttribute('aria-busy')).toBe(false);
        expect(indicator.getAttribute('data-state')).toBe('open');
        expect(content.getAttribute('data-state')).toBe('open');
    });

    it('item click selects; disabled items do not', () => {
        const state = signal({ file: '' });
        mountTree(container, { model: [state, 'file'] });
        byValue(container, 'README.md').click();
        expect(state.file).toBe('README.md');
        byValue(container, 'LICENSE').click();
        expect(state.file).toBe('README.md');
    });

    it('Up/Down rove visible nodes, skipping disabled; Home/End hit the edges', () => {
        mountTree(container, { defaultExpandedValues: ['src'] });
        const branch = byValue(container, 'src');
        branch.focus();
        branch.dispatchEvent(key('End'));
        // LICENSE is disabled — End lands on README.md.
        expect(document.activeElement).toBe(byValue(container, 'README.md'));
        byValue(container, 'README.md').dispatchEvent(key('Home'));
        expect(document.activeElement).toBe(branch);
    });

    it('typeahead jumps to a visible match', () => {
        mountTree(container, { defaultExpandedValues: ['src'] });
        const branch = byValue(container, 'src');
        branch.focus();
        branch.dispatchEvent(key('R'));
        expect(document.activeElement).toBe(byValue(container, 'README.md'));
    });

    it('typeahead matches a branch by its visible label, not its indicator glyph', () => {
        mountTree(container, { defaultExpandedValues: ['src'] });
        // The src trigger renders `›src` in textContent terms — the default
        // BranchIndicator glyph comes FIRST. Typeahead must see the
        // accessible text (`src`), or no branch with an indicator is ever
        // reachable by its label (#326).
        const readme = byValue(container, 'README.md');
        readme.focus();
        readme.dispatchEvent(key('s'));
        expect(document.activeElement).toBe(byValue(container, 'src'));
    });

    it('typeahead reads an asChild BranchTrigger row stamped with its own scope (#157)', () => {
        render(
            <TreeView.Root defaultExpandedValues={['packages']}>
                <TreeView.Tree>
                    <TreeView.Branch value="packages">
                        <TreeView.BranchTrigger asChild>
                            {(p) => <div {...p} data-scope="app-file-tree" data-part="item">packages</div>}
                        </TreeView.BranchTrigger>
                        <TreeView.BranchContent>
                            <TreeView.Branch value="packages/ui">
                                <TreeView.BranchTrigger asChild>
                                    {(p) => <div {...p} data-scope="app-file-tree" data-part="item">ui</div>}
                                </TreeView.BranchTrigger>
                                <TreeView.BranchContent>
                                    <TreeView.Item value="packages/ui/index.ts">index.ts</TreeView.Item>
                                </TreeView.BranchContent>
                            </TreeView.Branch>
                        </TreeView.BranchContent>
                    </TreeView.Branch>
                </TreeView.Tree>
            </TreeView.Root>,
            container,
        );
        const branches = [...container.querySelectorAll<HTMLElement>('[data-part="branch"]')];
        const [top, nested] = branches;
        // The row carries the app's own part name — the part query finds
        // nothing, so the text used to fall back to the value (`packages/ui`)
        // and `u` never reached the nested folder.
        expect(nested.querySelector('[data-part="branch-trigger"]')).toBeNull();
        top.focus();
        top.dispatchEvent(key('u'));
        expect(document.activeElement).toBe(nested);
    });

    it('one tab stop: the selected node, else the first visible enabled node', () => {
        mountTree(container, { defaultValue: 'README.md' });
        expect(byValue(container, 'README.md').tabIndex).toBe(0);
        expect(byValue(container, 'src').tabIndex).toBe(-1);

        const c2 = document.createElement('div');
        document.body.appendChild(c2);
        mountTree(c2);
        expect(byValue(c2, 'src').tabIndex).toBe(0);
        expect(byValue(c2, 'README.md').tabIndex).toBe(-1);
    });

    it('a selection hidden by collapse yields the tab stop to the first visible node', () => {
        const state = signal({ file: '' });
        mountTree(container, { model: [state, 'file'], defaultExpandedValues: ['src'] });
        byValue(container, 'index.ts').click();
        expect(byValue(container, 'index.ts').tabIndex).toBe(0);
        container.querySelector<HTMLElement>('[data-part="branch-trigger"]')!.click();
        // The selected node is now invisible — the stop falls back so the
        // tree stays keyboard-reachable.
        expect(byValue(container, 'src').tabIndex).toBe(0);
        expect(byValue(container, 'README.md').tabIndex).toBe(-1);
    });

    // #177: a pointer focuses a disabled node (tabindex=-1 still takes a
    // click's focus), and its keydown used to return before roving — the
    // arrows, Home/End and typeahead went dead there. Navigation must
    // still work FROM a disabled node; only activation and expansion stay
    // blocked.
    describe('keys pressed while a disabled node has focus (#177)', () => {
        function mountDisabled(c: HTMLElement, state = signal({ v: '' }), expanded = signal({ v: [] as string[] })) {
            render(
                <TreeView.Root model={[state, 'v']} model:expandedValues={[expanded, 'v']}>
                    <TreeView.Tree>
                        <TreeView.Item value="alpha">alpha</TreeView.Item>
                        <TreeView.Item value="bravo" disabled>bravo</TreeView.Item>
                        <TreeView.Item value="charlie">charlie</TreeView.Item>
                        <TreeView.Branch value="delta" disabled>
                            <TreeView.BranchTrigger>delta</TreeView.BranchTrigger>
                            <TreeView.BranchContent>
                                <TreeView.Item value="delta/x">x</TreeView.Item>
                            </TreeView.BranchContent>
                        </TreeView.Branch>
                        <TreeView.Item value="echo">echo</TreeView.Item>
                    </TreeView.Tree>
                </TreeView.Root>,
                c,
            );
            return { state, expanded };
        }

        it('a disabled item roves: Up/Down to its enabled neighbours, Home/End to the edges', () => {
            mountDisabled(container);
            const bravo = byValue(container, 'bravo');
            bravo.focus();
            bravo.dispatchEvent(key('ArrowDown'));
            expect(document.activeElement).toBe(byValue(container, 'charlie'));
            bravo.focus();
            bravo.dispatchEvent(key('ArrowUp'));
            expect(document.activeElement).toBe(byValue(container, 'alpha'));
            bravo.focus();
            bravo.dispatchEvent(key('End'));
            expect(document.activeElement).toBe(byValue(container, 'echo'));
            bravo.focus();
            bravo.dispatchEvent(key('Home'));
            expect(document.activeElement).toBe(byValue(container, 'alpha'));
        });

        it('typeahead runs from a disabled item', () => {
            mountDisabled(container);
            const bravo = byValue(container, 'bravo');
            bravo.focus();
            bravo.dispatchEvent(key('e'));
            expect(document.activeElement).toBe(byValue(container, 'echo'));
        });

        it('a disabled item still refuses Enter and Space', () => {
            const { state } = mountDisabled(container);
            const bravo = byValue(container, 'bravo');
            bravo.focus();
            bravo.dispatchEvent(key('Enter'));
            bravo.dispatchEvent(key(' '));
            expect(state.v).toBe('');
            expect(bravo.hasAttribute('data-selected')).toBe(false);
        });

        it('a disabled branch roves but neither expands nor selects', () => {
            const { state, expanded } = mountDisabled(container);
            const delta = byValue(container, 'delta');
            delta.focus();
            delta.dispatchEvent(key('ArrowRight'));
            expect(expanded.v).toEqual([]);
            expect(delta.getAttribute('aria-expanded')).toBe('false');
            delta.dispatchEvent(key('Enter'));
            delta.dispatchEvent(key(' '));
            expect(state.v).toBe('');
            delta.dispatchEvent(key('ArrowDown'));
            expect(document.activeElement).toBe(byValue(container, 'echo'));
            delta.focus();
            delta.dispatchEvent(key('ArrowUp'));
            expect(document.activeElement).toBe(byValue(container, 'charlie'));
        });

        it('an expanded disabled branch neither collapses, nor strands its children', () => {
            const { expanded } = mountDisabled(container, undefined, signal({ v: ['delta'] }));
            const delta = byValue(container, 'delta');
            delta.focus();
            delta.dispatchEvent(key('ArrowLeft'));
            expect(expanded.v).toEqual(['delta']);
            // Moving into the open subtree is navigation, not expansion.
            delta.dispatchEvent(key('ArrowRight'));
            expect(document.activeElement).toBe(byValue(container, 'x'));
            byValue(container, 'x').dispatchEvent(key('ArrowLeft'));
            expect(document.activeElement).toBe(delta);
        });

        it('ArrowLeft on an open disabled branch climbs to its parent', () => {
            const expanded = signal({ v: ['outer', 'outer/inner'] as string[] });
            render(
                <TreeView.Root model:expandedValues={[expanded, 'v']}>
                    <TreeView.Tree>
                        <TreeView.Branch value="outer">
                            <TreeView.BranchTrigger>outer</TreeView.BranchTrigger>
                            <TreeView.BranchContent>
                                <TreeView.Branch value="outer/inner" disabled>
                                    <TreeView.BranchTrigger>inner</TreeView.BranchTrigger>
                                    <TreeView.BranchContent>
                                        <TreeView.Item value="outer/inner/leaf">leaf</TreeView.Item>
                                    </TreeView.BranchContent>
                                </TreeView.Branch>
                            </TreeView.BranchContent>
                        </TreeView.Branch>
                    </TreeView.Tree>
                </TreeView.Root>,
                container,
            );
            const inner = byValue(container, 'inner');
            inner.focus();
            inner.dispatchEvent(key('ArrowLeft'));
            expect(expanded.v).toEqual(['outer', 'outer/inner']);
            expect(document.activeElement).toBe(byValue(container, 'outer'));
        });
    });

    it('selection survives collapsing its branch', () => {
        const state = signal({ file: '' });
        mountTree(container, { model: [state, 'file'], defaultExpandedValues: ['src'] });
        byValue(container, 'index.ts').click();
        expect(state.file).toBe('src/index.ts');
        // The keyboard collapse — a click on the row would select the branch.
        byValue(container, 'src').dispatchEvent(key('ArrowLeft'));
        expect(state.file).toBe('src/index.ts');
        expect(byValue(container, 'src').getAttribute('data-state')).toBe('closed');
    });
    it('refuses a node valued "" in single mode — it is the empty sentinel', () => {
        for (const node of [
            <TreeView.Item value="">none</TreeView.Item>,
            <TreeView.Branch value=""><TreeView.BranchTrigger>none</TreeView.BranchTrigger></TreeView.Branch>,
        ]) {
            expect(() => render(
                <TreeView.Root><TreeView.Tree>{node}</TreeView.Tree></TreeView.Root>,
                container,
            )).toThrow(/reserved/);
        }
    });

    it('accepts a node valued "" under multiple, where the model has no sentinel', () => {
        render(
            <TreeView.Root multiple><TreeView.Tree><TreeView.Item value="">none</TreeView.Item></TreeView.Tree></TreeView.Root>,
            container,
        );
        expect(container.querySelector('[role="treeitem"]')!.hasAttribute('data-selected')).toBe(false);
    });

});

// ── Multiple selection (#287) ──

describe('TreeView multiple', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    /**
     * Visible with `a` open: a, a/1, a/2 (disabled), a/3, b, c (closed), d.
     * `c/1` is registered but hidden.
     */
    function mountMulti(extra: {
        model?: unknown;
        defaultValue?: string[];
        onValueChange?: (v: string[]) => void;
        expandOnClick?: boolean;
    } = {}) {
        render(
            <TreeView.Root
                multiple
                model={extra.model as never}
                defaultValue={extra.defaultValue}
                onValueChange={extra.onValueChange}
                defaultExpandedValues={['a']}
                expandOnClick={extra.expandOnClick}
            >
                <TreeView.Label>Files</TreeView.Label>
                <TreeView.Tree>
                    <TreeView.Branch value="a">
                        <TreeView.BranchTrigger>a</TreeView.BranchTrigger>
                        <TreeView.BranchContent>
                            <TreeView.Item value="a/1">a1</TreeView.Item>
                            <TreeView.Item value="a/2" disabled>a2</TreeView.Item>
                            <TreeView.Item value="a/3">a3</TreeView.Item>
                        </TreeView.BranchContent>
                    </TreeView.Branch>
                    <TreeView.Item value="b">bee</TreeView.Item>
                    <TreeView.Branch value="c">
                        <TreeView.BranchTrigger>c</TreeView.BranchTrigger>
                        <TreeView.BranchContent>
                            <TreeView.Item value="c/1">c1</TreeView.Item>
                        </TreeView.BranchContent>
                    </TreeView.Branch>
                    <TreeView.Item value="d">dee</TreeView.Item>
                </TreeView.Tree>
            </TreeView.Root>,
            container,
        );
    }

    const LABEL: Record<string, string> = { a: 'a', 'a/1': 'a1', 'a/2': 'a2', 'a/3': 'a3', b: 'bee', c: 'c', 'c/1': 'c1', d: 'dee' };
    const labelOf = (el: HTMLElement): string => (el.getAttribute('data-part') === 'branch'
        ? el.querySelector('[data-part="branch-trigger"]')!.textContent!
        : el.textContent!).trim();
    const node = (value: string): HTMLElement =>
        [...container.querySelectorAll<HTMLElement>('[role="treeitem"]')].find((el) => labelOf(el) === LABEL[value])!;
    const press = (el: HTMLElement, k: string, init: KeyboardEventInit = {}) => {
        el.focus();
        const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
        el.dispatchEvent(e);
        return e;
    };
    const click = (el: HTMLElement, init: MouseEventInit = {}) =>
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
    const row = (value: string) => node(value).querySelector<HTMLElement>(':scope > [data-part="branch-trigger"]')!;
    const selectedNow = () => [...container.querySelectorAll<HTMLElement>('[role="treeitem"][aria-selected="true"]')]
        .map(labelOf);

    it('the tree is aria-multiselectable, every node reads aria-selected, and the seed is []', () => {
        const state = signal({ files: [] as string[] });
        mountMulti({ model: [state, 'files'] });
        expectAnatomy(container, treeViewAnatomy);
        expect(container.querySelector('[data-part="tree"]')!.getAttribute('aria-multiselectable')).toBe('true');
        for (const el of container.querySelectorAll('[role="treeitem"]')) {
            expect(el.getAttribute('aria-selected')).toBe('false');
        }
    });

    it('single mode renders no aria-multiselectable', () => {
        render(
            <TreeView.Root>
                <TreeView.Tree><TreeView.Item value="x">x</TreeView.Item></TreeView.Tree>
            </TreeView.Root>,
            container,
        );
        expect(container.querySelector('[data-part="tree"]')!.hasAttribute('aria-multiselectable')).toBe(false);
    });

    it('Space toggles the focused node in and out; the model is an array', () => {
        const state = signal({ files: [] as string[] });
        mountMulti({ model: [state, 'files'] });
        press(node('a/1'), ' ');
        press(node('b'), ' ');
        expect(state.files).toEqual(['a/1', 'b']);
        expect(node('b').getAttribute('data-selected')).toBe('');
        expect(node('b').getAttribute('aria-selected')).toBe('true');
        press(node('a/1'), ' ');
        expect(state.files).toEqual(['b']);
        expect(node('a/1').getAttribute('aria-selected')).toBe('false');
        expect(node('a/1').hasAttribute('data-selected')).toBe(false);
    });

    it('Space on a branch selects it without toggling expansion', () => {
        const state = signal({ files: [] as string[] });
        mountMulti({ model: [state, 'files'] });
        press(node('c'), ' ');
        expect(state.files).toEqual(['c']);
        expect(node('c').getAttribute('aria-expanded')).toBe('false');
    });

    it('Shift+ArrowDown/Up move focus and select anchor→focus, skipping disabled nodes', () => {
        const state = signal({ files: [] as string[] });
        mountMulti({ model: [state, 'files'] });
        press(node('a/1'), ' '); // anchor
        press(node('a/1'), 'ArrowDown', { shiftKey: true });
        expect(document.activeElement).toBe(node('a/3'));
        expect(state.files).toEqual(['a/1', 'a/3']);
        press(node('a/3'), 'ArrowDown', { shiftKey: true });
        expect(document.activeElement).toBe(node('b'));
        expect(state.files).toEqual(['a/1', 'a/3', 'b']);
        // Back past the anchor: the range flips to the other side.
        press(node('b'), 'ArrowUp', { shiftKey: true });
        press(node('a/3'), 'ArrowUp', { shiftKey: true });
        press(node('a/1'), 'ArrowUp', { shiftKey: true });
        expect(document.activeElement).toBe(node('a'));
        expect(state.files).toEqual(['a', 'a/1']);
    });

    it('Shift+ArrowDown without an anchor starts the range at the focused node', () => {
        const state = signal({ files: [] as string[] });
        mountMulti({ model: [state, 'files'] });
        press(node('b'), 'ArrowDown', { shiftKey: true });
        expect(document.activeElement).toBe(node('c'));
        expect(state.files).toEqual(['b', 'c']);
    });

    it('plain arrows move focus only', () => {
        const state = signal({ files: ['b'] });
        mountMulti({ model: [state, 'files'] });
        press(node('b'), 'ArrowDown');
        expect(document.activeElement).toBe(node('c'));
        expect(state.files).toEqual(['b']);
    });

    it('Shift+Space selects the anchor→focused range, replacing the selection', () => {
        const state = signal({ files: ['d'] as string[] });
        mountMulti({ model: [state, 'files'] });
        press(node('a/1'), ' '); // anchor, toggled in: [d, a/1]
        press(node('b'), ' ', { shiftKey: true });
        expect(state.files).toEqual(['a/1', 'a/3', 'b']);
    });

    it('Ctrl+Shift+End / Home extend to the last / first visible enabled node', () => {
        const state = signal({ files: [] as string[] });
        mountMulti({ model: [state, 'files'] });
        press(node('b'), ' ');
        press(node('b'), 'End', { ctrlKey: true, shiftKey: true });
        expect(document.activeElement).toBe(node('d'));
        expect(state.files).toEqual(['b', 'c', 'd']);
        press(node('d'), 'Home', { metaKey: true, shiftKey: true });
        expect(document.activeElement).toBe(node('a'));
        expect(state.files).toEqual(['a', 'a/1', 'a/3', 'b']);
    });

    it('Ctrl/Cmd+A selects every visible enabled node, keeping hidden selections, before typeahead', () => {
        const state = signal({ files: ['c/1'] as string[] });
        mountMulti({ model: [state, 'files'] });
        const e = press(node('b'), 'a', { ctrlKey: true });
        expect(e.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(node('b'));
        expect([...state.files].sort()).toEqual(['a', 'a/1', 'a/3', 'b', 'c', 'c/1', 'd']);
        state.files = [];
        press(node('d'), 'A', { metaKey: true });
        expect(state.files).toEqual(['a', 'a/1', 'a/3', 'b', 'c', 'd']);
    });

    it('Enter keeps its activation: the focused node alone', () => {
        const state = signal({ files: ['a/1', 'b'] as string[] });
        mountMulti({ model: [state, 'files'] });
        press(node('d'), 'Enter');
        expect(state.files).toEqual(['d']);
    });

    it('a plain click replaces, Ctrl/Cmd+click toggles, Shift+click selects the visible range', () => {
        const onValueChange = vi.fn();
        mountMulti({ onValueChange });
        click(node('a/1'));
        expect(onValueChange).toHaveBeenLastCalledWith(['a/1']);
        click(node('b'), { ctrlKey: true });
        expect(onValueChange).toHaveBeenLastCalledWith(['a/1', 'b']);
        click(node('a/1'), { metaKey: true });
        expect(onValueChange).toHaveBeenLastCalledWith(['b']);
        // The anchor is the last toggled node (a/1), the range runs to d.
        click(node('d'), { shiftKey: true });
        expect(onValueChange).toHaveBeenLastCalledWith(['a/1', 'a/3', 'b', 'c', 'd']);
        expect(document.activeElement).toBe(node('d'));
        click(node('a/3'));
        expect(onValueChange).toHaveBeenLastCalledWith(['a/3']);
        expect(selectedNow()).toEqual(['a3']);
    });

    it('Shift+click on an item keeps its mousedown from selecting text', () => {
        mountMulti();
        const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true, shiftKey: true });
        node('b').dispatchEvent(down);
        expect(down.defaultPrevented).toBe(true);
        const plain = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        node('b').dispatchEvent(plain);
        expect(plain.defaultPrevented).toBe(false);
    });

    it('a branch row: a plain click replaces and toggles; a modified click only selects', () => {
        const state = signal({ files: [] as string[] });
        mountMulti({ model: [state, 'files'] });
        click(row('c'));
        expect(state.files).toEqual(['c']);
        expect(node('c').getAttribute('aria-expanded')).toBe('true');
        click(row('a'), { ctrlKey: true });
        expect(state.files).toEqual(['c', 'a']);
        expect(node('a').getAttribute('aria-expanded')).toBe('true');
        click(row('a'), { shiftKey: true });
        expect(node('a').getAttribute('aria-expanded')).toBe('true');
        expect(document.activeElement).toBe(node('a'));
    });

    it('disabled nodes never enter the selection', () => {
        const state = signal({ files: [] as string[] });
        mountMulti({ model: [state, 'files'] });
        click(node('a/2'));
        click(node('a/2'), { ctrlKey: true });
        expect(state.files).toEqual([]);
        press(node('a/2'), ' ');
        expect(state.files).toEqual([]);
        // A range across it skips it.
        click(node('a/1'));
        click(node('b'), { shiftKey: true });
        expect(state.files).toEqual(['a/1', 'a/3', 'b']);
        // Ctrl+A too.
        press(node('b'), 'a', { ctrlKey: true });
        expect(state.files).not.toContain('a/2');
    });

    it('a Shift range from a disabled focused node anchors on its target', () => {
        const state = signal({ files: [] as string[] });
        mountMulti({ model: [state, 'files'] });
        press(node('a/2'), 'ArrowDown', { shiftKey: true });
        expect(document.activeElement).toBe(node('a/3'));
        expect(state.files).toEqual(['a/3']);
    });

    it('a range whose anchor has collapsed out of sight selects its far end alone', () => {
        const state = signal({ files: [] as string[] });
        mountMulti({ model: [state, 'files'] });
        click(node('a/1')); // anchor
        press(node('a'), 'ArrowLeft'); // collapse a
        click(node('d'), { shiftKey: true });
        expect(state.files).toEqual(['d']);
        // …and d is the anchor now.
        click(node('b'), { shiftKey: true });
        expect(state.files).toEqual(['b', 'c', 'd']);
    });

    it('one tab stop: the first selected visible node in DOM order', () => {
        const state = signal({ files: ['d', 'b'] as string[] });
        mountMulti({ model: [state, 'files'] });
        const stops = [...container.querySelectorAll<HTMLElement>('[role="treeitem"]')].filter((el) => el.tabIndex === 0);
        expect(stops).toEqual([node('b')]);
        state.files = ['c/1'];
        const fallback = [...container.querySelectorAll<HTMLElement>('[role="treeitem"]')].filter((el) => el.tabIndex === 0);
        expect(fallback).toEqual([node('a')]);
    });

    it('defaultValue seeds an uncontrolled selection', () => {
        mountMulti({ defaultValue: ['b', 'd'] });
        expect(selectedNow()).toEqual(['bee', 'dee']);
    });
});
