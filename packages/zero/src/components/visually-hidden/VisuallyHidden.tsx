/**
 * VisuallyHidden — content for assistive technology only: out of sight, in
 * the accessibility tree.
 *
 * ```tsx
 * <button><Icon name="close" /><VisuallyHidden>Close</VisuallyHidden></button>
 *
 * <VisuallyHidden asChild>{(p) => <h2 {...p}>Navigation</h2>}</VisuallyHidden>
 * ```
 *
 * It renders `data-visually-hidden`, and `css/base.css` does the hiding in
 * `@layer zero.structure` — the rule a part's own `visuallyHidden` option
 * (`Field.Label`, `Dialog.Title`, …) lands on too, so there is one technique
 * and one place it lives. Prefer that option when the thing to hide IS a
 * part: the part keeps its identity for the design system and its wiring
 * (`for`, `aria-labelledby`), where wrapping its text would leave an empty
 * styled box behind.
 *
 * Deliberately not a scope. It has no anatomy because there is nothing for a
 * design system to style — the structure layer outranks every recipe — so it
 * renders no `data-scope`/`data-part`, like `ThemeProvider`.
 */
import { component } from 'sigx';
import type { Define } from 'sigx';
import { renderAsChild } from '../../contract/as-child.js';
import type { WithAsChild, WithClass } from '../../contract/props.js';

/** What an `asChild` slot spreads onto its element. */
export interface VisuallyHiddenBag {
    'data-visually-hidden': '';
}

export type VisuallyHiddenProps =
    & WithClass
    & WithAsChild
    & Define.Slot<'default', VisuallyHiddenBag>;

export const VisuallyHidden = component<VisuallyHiddenProps>(({ props, slots }) => {
    const bag: VisuallyHiddenBag = { 'data-visually-hidden': '' };
    return () => {
        if (props.asChild) return renderAsChild(slots.default, bag);
        return <span {...bag} class={props.class}>{slots.default?.(bag)}</span>;
    };
}, { name: 'VisuallyHidden' });
