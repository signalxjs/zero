/**
 * The static contrast matrix's selector matcher (#403, slice C): the grammar
 * the kit emits is evaluated, everything else is `unknown`, and the
 * three-valued logic never lets an `unknown` collapse into a `yes`.
 */
import { describe, it, expect } from 'vitest';
import type { MatchNode } from '../src/audit/contrast/selector.js';
import { matchScopePrelude, matchSelector, parseSelector } from '../src/audit/contrast/selector.js';

const node = (attrs: Record<string, string>, parent?: MatchNode, element = 'div'): MatchNode => ({
    element,
    attrs: new Map(Object.entries(attrs)),
    hasElementChildren: false,
    ...(parent ? { parent } : {}),
});

const root = node({ 'data-scope': 'select', 'data-part': 'root', 'data-variant': 'soft' });
root.hasElementChildren = true;
const trigger = node({ 'data-scope': 'select', 'data-part': 'trigger', 'data-state': 'open', 'data-disabled': '' }, root, 'button');

const match = (selector: string, at: MatchNode, box?: '::before' | '::after') => matchSelector(parseSelector(selector), at, box);

describe('what is evaluated', () => {
    it('attribute presence and equality, on the node itself', () => {
        expect(match('[data-scope="select"][data-part="trigger"]', trigger).match).toBe('yes');
        expect(match('[data-part="trigger"][data-state="open"]', trigger).match).toBe('yes');
        expect(match('[data-part="trigger"][data-state="closed"]', trigger).match).toBe('no');
        expect(match('[data-disabled]', trigger).match).toBe('yes');
        expect(match('[data-invalid]', trigger).match).toBe('no');
    });

    it('descendant and child combinators walk the chain', () => {
        expect(match('[data-part="root"] [data-part="trigger"]', trigger).match).toBe('yes');
        expect(match('[data-part="root"] > [data-part="trigger"]', trigger).match).toBe('yes');
        expect(match('[data-part="popup"] [data-part="trigger"]', trigger).match).toBe('no');
        // The root has no parent, so a descendant requirement above it fails.
        expect(match('[data-part="trigger"] [data-part="root"]', root).match).toBe('no');
    });

    it(':not() / :is() / :where() are three-valued', () => {
        expect(match('[data-part="trigger"]:not([data-disabled])', trigger).match).toBe('no');
        expect(match('[data-part="trigger"]:not([data-invalid])', trigger).match).toBe('yes');
        expect(match('[data-part="trigger"]:is([data-state="open"], [data-state="closed"])', trigger).match).toBe('yes');
        expect(match('[data-part="trigger"]:where([data-invalid])', trigger).match).toBe('no');
        // An unknown inside :not() cannot become a yes.
        expect(match('[data-part="trigger"]:not(:nth-child(2n))', trigger).match).toBe('unknown');
    });

    it('interaction pseudo-classes are the resting render: no', () => {
        for (const p of [':hover', ':active', ':focus', ':focus-visible', ':focus-within']) {
            expect(match(`[data-part="trigger"]${p}`, trigger).match, p).toBe('no');
        }
        expect(match('[data-part="trigger"]:hover:not([data-disabled])', trigger).match).toBe('no');
    });

    it('direction: an unattributed probe is left-to-right', () => {
        expect(match('[data-part="trigger"]:where(:dir(rtl), [dir="rtl"], [dir="rtl"] *)', trigger).match).toBe('no');
        expect(match('[data-part="trigger"]:dir(ltr)', trigger).match).toBe('yes');
    });

    it('native proxies read the data-state they proxy', () => {
        expect(match('[data-part="trigger"]:open', trigger).match).toBe('yes');
        expect(match('[data-part="trigger"]:popover-open', trigger).match).toBe('yes');
        expect(match('[data-part="trigger"][open]', trigger).match).toBe('no'); // the attribute itself is not set
        expect(match('[data-part="trigger"]:checked', trigger).match).toBe('no');
        expect(match('[data-part="trigger"]:disabled', trigger).match).toBe('yes');
    });

    it('structural pseudo-classes answer for a probe chain', () => {
        expect(match('[data-part="trigger"]:first-child', trigger).match).toBe('yes');
        expect(match('[data-part="trigger"]:last-child', trigger).match).toBe('yes');
        expect(match('[data-part="trigger"]:empty', trigger).match).toBe('no');
        expect(match('[data-part="trigger"]:modal', trigger).match).toBe('no');
        // `:has()` on a childless node is answerable; on a node with children it is not.
        expect(match('[data-part="trigger"]:not(:has(> *))', trigger).match).toBe('yes');
        expect(match('[data-part="root"]:has(> *)', root).match).toBe('unknown');
    });

    it('pseudo-elements select the box asked for', () => {
        const sel = parseSelector('[data-part="trigger"]::after');
        expect(sel.pseudoElement).toBe('::after');
        expect(matchSelector(sel, trigger, '::after').match).toBe('yes');
        expect(matchSelector(sel, trigger, undefined).match).toBe('no');
        expect(parseSelector('[data-part="popup"]::backdrop').pseudoElement).toBe('other');
        expect(parseSelector('[data-part="trigger"]:before').pseudoElement).toBe('::before');
    });
});

describe(':has() over a named chain — a closed world (#469)', () => {
    /** field.root > field.label, each naming its child the way the matrix builds a probe. */
    const chain = (...specs: Array<Record<string, string>>): MatchNode[] => {
        const nodes: MatchNode[] = [];
        for (const attrs of specs) {
            const parent = nodes[nodes.length - 1];
            const n = node(attrs, parent);
            if (parent) { parent.hasElementChildren = true; parent.child = n; }
            nodes.push(n);
        }
        return nodes;
    };
    const [fieldRoot, fieldLabel] = chain(
        { 'data-scope': 'field', 'data-part': 'root' },
        { 'data-scope': 'field', 'data-part': 'label' },
    );
    const TEXT = ':is([data-scope="input"][data-part="root"], [data-scope="select"][data-part="root"])';
    const [selRoot, selTrigger, selValue] = chain(
        { 'data-scope': 'select', 'data-part': 'root' },
        { 'data-scope': 'select', 'data-part': 'trigger' },
        { 'data-scope': 'select', 'data-part': 'value', 'data-placeholder': '' },
    );

    it('answers from the chain\'s own nodes, both ways', () => {
        // Material's FIELD_HOST: the probe's field holds a label, not a text field.
        expect(match(`[data-part="root"]:has(> ${TEXT}) > [data-part="label"]`, fieldLabel!).match).toBe('no');
        expect(match('[data-part="root"]:has(> [data-part="label"])', fieldRoot!).match).toBe('yes');
        expect(match('[data-part="root"]:has(> *)', fieldRoot!).match).toBe('yes');
        // Material's LABELLED: the select probe renders no label of its own.
        expect(match('[data-part="root"]:has(> [data-part="label"]:not([data-visually-hidden])) [data-part="value"]', selValue!).match).toBe('no');
    });

    it('reaches every descendant, and `>` only the child', () => {
        expect(match('[data-part="root"]:has([data-placeholder])', selRoot!).match).toBe('yes');
        expect(match('[data-part="root"]:has(> [data-placeholder])', selRoot!).match).toBe('no');
        expect(match('[data-part="root"]:has(> [data-part="trigger"] > [data-placeholder])', selRoot!).match).toBe('yes');
        expect(match('[data-part="root"]:has([data-part="trigger"] [data-part="value"])', selRoot!).match).toBe('yes');
        // The anchor is `:scope`, never one of the argument's compounds.
        expect(match('[data-part="root"]:has([data-part="root"] [data-part="trigger"])', selRoot!).match).toBe('no');
        expect(match('[data-part="trigger"]:has([data-part="value"])', selTrigger!).match).toBe('yes');
    });

    it('siblings: none below the root, the page\'s on it', () => {
        expect(match('[data-part="trigger"]:has(+ *)', selTrigger!).match).toBe('no');
        expect(match('[data-part="root"]:has(~ *)', selRoot!).match).toBe('unknown');
        expect(match('[data-part="root"]:has(> * + *)', selRoot!).match).toBe('no');
    });

    it('stays three-valued inside the argument', () => {
        expect(match('[data-part="root"]:has(> :nth-child(2))', selRoot!).match).toBe('unknown');
        expect(match('[data-part="root"]:has(> [data-part="popup"]:nth-child(2))', selRoot!).match).toBe('no');
    });

    it('takes its most specific argument\'s specificity, like :is()', () => {
        expect(match('[data-part="root"]:has(> [data-a], > [data-b][data-c])', selRoot!).specificity).toEqual([0, 3, 0]);
        expect(match('[data-part="trigger"]:not(:has(> *))', selValue!).specificity).toEqual([0, 1, 0]);
    });
});

describe('what is not', () => {
    it('sibling combinators, :nth-*(), attribute operators other than =', () => {
        expect(match('[data-part="root"] + [data-part="trigger"]', trigger).match).toBe('unknown');
        expect(match('[data-part="root"] ~ [data-part="trigger"]', trigger).match).toBe('unknown');
        expect(match('[data-part="trigger"]:nth-child(2n)', trigger).match).toBe('unknown');
        expect(match('[data-part^="trig"]', trigger).match).toBe('unknown');
        expect(match('[data-part="trigger"]:placeholder-shown', trigger).match).toBe('unknown');
    });

    it('a selector it cannot read at all is raw-css', () => {
        expect(parseSelector('& [data-part="x"]').unreadable).toBe('raw-css');
        expect(parseSelector('[data-part="x"] {').unreadable).toBe('raw-css');
        expect(match('& [data-part="x"]', trigger).match).toBe('unknown');
    });
});

describe('specificity', () => {
    it('counts attributes and pseudo-classes as (0,1,0), elements and pseudo-elements as (0,0,1)', () => {
        expect(match('[data-scope="select"][data-part="trigger"]', trigger).specificity).toEqual([0, 2, 0]);
        expect(match('button[data-part="trigger"]::after', trigger, '::after').specificity).toEqual([0, 1, 2]);
        expect(match('[data-part="trigger"]:hover', trigger).specificity).toEqual([0, 2, 0]);
    });

    it(':where() adds nothing; :not()/:is() add their most specific argument', () => {
        expect(match('[data-part="trigger"]:where([data-a], [data-b][data-c])', trigger).specificity).toEqual([0, 1, 0]);
        expect(match('[data-part="trigger"]:not([data-a], [data-b][data-c])', trigger).specificity).toEqual([0, 3, 0]);
        expect(match('[data-part="trigger"]:is([data-state="open"])', trigger).specificity).toEqual([0, 2, 0]);
    });
});

describe('@scope donuts', () => {
    const outer = node({ 'data-scope': 'card', 'data-part': 'root', 'data-color': 'primary' });
    outer.hasElementChildren = true;
    const inner = node({ 'data-scope': 'card', 'data-part': 'root' }, outer);
    inner.hasElementChildren = true;
    const title = node({ 'data-scope': 'card', 'data-part': 'title' }, inner);
    const outerTitle = node({ 'data-scope': 'card', 'data-part': 'title' }, outer);

    const donut = '@scope ([data-scope="card"][data-part="root"][data-color="primary"]) to ([data-scope="card"][data-part="root"])';

    it('applies inside the axis-carrying root', () => {
        expect(matchScopePrelude(donut, outerTitle)).toBe('yes');
    });

    it('stops at a nested same-scope root — the limit excludes itself and its subtree', () => {
        expect(matchScopePrelude(donut, title)).toBe('no');
        expect(matchScopePrelude(donut, inner)).toBe('no');
    });

    it('does not apply outside any matching root', () => {
        const lone = node({ 'data-scope': 'card', 'data-part': 'title' });
        expect(matchScopePrelude(donut, lone)).toBe('no');
    });

    it('is unknown when the prelude is not a donut it can read', () => {
        expect(matchScopePrelude('@scope (:has(x)) to (y)', outerTitle)).toBe('unknown');
    });
});
