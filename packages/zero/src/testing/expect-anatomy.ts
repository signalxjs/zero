/**
 * The DOM entry to the anatomy oracle — the signature zero's own tests and
 * every ecosystem package have always used. The rules live in
 * `expect-anatomy-core.ts` over a structural {@link ElementLike}; this module
 * only collects the scope's elements from a real DOM subtree and wraps them.
 */
import type { Anatomy } from '../contract/anatomy.js';
import type { ElementLike, ExpectAnatomyOptions } from './expect-anatomy-core.js';
import { expectAnatomyElements } from './expect-anatomy-core.js';

export type { ExpectAnatomyOptions } from './expect-anatomy-core.js';

function wrapDom(el: Element): ElementLike {
    return {
        getAttribute: (name) => el.getAttribute(name),
        getAttributeNames: () => el.getAttributeNames(),
        parent: () => (el.parentElement ? wrapDom(el.parentElement) : null),
    };
}

/**
 * The anatomy doubles as a test oracle: walk every rendered part of a scope
 * and check it against the declaration. See `expectAnatomyElements` for the
 * rules; this wrapper owns only the DOM walk.
 */
export function expectAnatomy(container: ParentNode, anatomy: Anatomy, options: ExpectAnatomyOptions = {}): void {
    const selector = `[data-scope="${anatomy.scope}"]`;
    // querySelectorAll only sees descendants, and the container is often the
    // component's own root part — which must not escape the walk. Duck-typed
    // rather than `instanceof Element`: a Document or DocumentFragment has no
    // `matches`, and cross-realm elements fail instanceof.
    const rendered = [
        ...('matches' in container && (container as Element).matches(selector) ? [container as Element] : []),
        ...container.querySelectorAll(selector),
    ];
    expectAnatomyElements(rendered.map(wrapDom), anatomy, options);
}
