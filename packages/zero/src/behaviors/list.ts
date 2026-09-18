/**
 * The web view of the list behavior: everything in `list-core.ts`
 * specialized to `HTMLElement`, plus the one genuinely DOM-bound helper
 * (`optionText`, a childNodes walk). Web components and tests import from
 * here and see the exact surface this module has always had; the neutral
 * core exists so platforms without DOM types (`@sigx/zero/behaviors/core`)
 * share the same controller.
 */
import type {
    HighlightStep as CoreHighlightStep,
    ListController as CoreListController,
    ListItem as CoreListItem,
} from './list-core.js';
import { createListController as createListControllerCore } from './list-core.js';

export { moveHighlight, sortByDomOrder } from './list-core.js';
export type HighlightStep = CoreHighlightStep;

/** {@link CoreListItem} with the element pinned to `HTMLElement`. */
export type ListItem = CoreListItem<HTMLElement>;

/** {@link CoreListController} with the element pinned to `HTMLElement`. */
export type ListController = CoreListController<HTMLElement>;

export function createListController(): ListController {
    return createListControllerCore<HTMLElement>();
}

/**
 * An option's label text — child text minus decorative parts (the selected
 * `item-indicator` would otherwise leak into the value display and
 * typeahead). Shared by Select and Combobox items.
 */
export function optionText(el: HTMLElement | null): string | undefined {
    if (!el) return undefined;
    let text = '';
    for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? '';
        else if (node instanceof HTMLElement && node.getAttribute('data-part') !== 'item-indicator') {
            text += node.textContent ?? '';
        }
    }
    const trimmed = text.trim();
    return trimmed === '' ? undefined : trimmed;
}
