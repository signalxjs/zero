import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
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

    it('selection survives collapsing its branch', () => {
        const state = signal({ file: '' });
        mountTree(container, { model: [state, 'file'], defaultExpandedValues: ['src'] });
        byValue(container, 'index.ts').click();
        expect(state.file).toBe('src/index.ts');
        container.querySelector<HTMLElement>('[data-part="branch-trigger"]')!.click();
        expect(state.file).toBe('src/index.ts');
        expect(byValue(container, 'src').getAttribute('data-state')).toBe('closed');
    });
});
