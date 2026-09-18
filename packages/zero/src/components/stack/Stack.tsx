/**
 * Stack — a flex row or column whose spacing comes from the design system.
 *
 * ```tsx
 * <Col gap="lg" pad="xl">
 *     <Row gap={{ base: 'sm', md: 'lg' }} align="center" justify="between">
 *         <span>Title</span>
 *         <Stack.Item grow>…</Stack.Item>
 *     </Row>
 * </Col>
 * ```
 *
 * `Row` and `Col` are the same scope with a different default orientation —
 * see `anatomy.ts`. Prefer them: `<Row>` says what it is, where
 * `<Stack orientation="horizontal">` makes the reader assemble it.
 *
 * `Stack` itself defaults to `horizontal`, matching `data-orientation`'s
 * default everywhere else in zero (Divider, Join) rather than the vertical
 * default some other libraries give a component of this name. That is the
 * cost of one spelling being consistent with the contract instead of with
 * other libraries, and it is why the presets exist.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { renderAsChild } from '../../contract/as-child.js';
import { layoutAttrs } from '../../contract/layout-attrs.js';
import type { LayoutProp } from '../../contract/layout-attrs.js';
import type { PartProps, WithAsChild, WithClass, WithOrientation } from '../../contract/props.js';
import type { Orientation } from '../../contract/data-attrs.js';
import { stackAnatomy } from './anatomy.js';

const SCOPE = stackAnatomy.scope;

/**
 * The spacing props, named for the attributes they render. `gapX`/`padY`
 * rather than `gap-x`: a JSX prop is an identifier, and the hyphenated
 * spelling belongs to the attribute, not to the API.
 */
export type StackRootProps =
    & WithOrientation
    & WithClass
    & Define.Prop<'gap', LayoutProp<'gap'>, false>
    & Define.Prop<'gapX', LayoutProp<'gap-x'>, false>
    & Define.Prop<'gapY', LayoutProp<'gap-y'>, false>
    & Define.Prop<'pad', LayoutProp<'pad'>, false>
    & Define.Prop<'padX', LayoutProp<'pad-x'>, false>
    & Define.Prop<'padY', LayoutProp<'pad-y'>, false>
    & Define.Prop<'align', LayoutProp<'align'>, false>
    & Define.Prop<'justify', LayoutProp<'justify'>, false>
    & Define.Prop<'wrap', LayoutProp<'wrap'>, false>
    & Define.Slot<'default'>;

/**
 * One root factory, three exported spellings.
 *
 * A wrapper component would have to forward slots and every prop by hand, and
 * would show up in the tree as an extra layer; a factory closing over the
 * default is the same pattern Card already uses for its five near-identical
 * bands.
 */
function makeStackRoot(fallbackOrientation: Orientation, name: string) {
    return component<StackRootProps>(({ props, slots }) => {
        const orientation = (): Orientation => props.orientation ?? fallbackOrientation;
        return () => (
            <div
                data-scope={SCOPE}
                data-part="root"
                data-orientation={orientation()}
                {...layoutAttrs({
                    'gap': props.gap,
                    'gap-x': props.gapX,
                    'gap-y': props.gapY,
                    'pad': props.pad,
                    'pad-x': props.padX,
                    'pad-y': props.padY,
                    'align': props.align,
                    'justify': props.justify,
                    'wrap': props.wrap,
                }, stackAnatomy.parts.root.layout)}
                class={props.class}
            >
                {slots.default?.()}
            </div>
        );
    }, { name });
}

const StackRoot = makeStackRoot('horizontal', 'Stack.Root');

/** A horizontal stack. */
export const Row = makeStackRoot('horizontal', 'Row');
/** A vertical stack. */
export const Col = makeStackRoot('vertical', 'Col');

export type StackItemProps =
    & WithClass
    & WithAsChild
    /**
     * Take the leftover room. A boolean rather than the attribute's `0 | 1`,
     * because `<Stack.Item grow>` is the only thing anyone wants to write;
     * `false` renders no attribute at all, which is already the default.
     */
    & Define.Prop<'grow', boolean, false>
    & Define.Slot<'default', PartProps>;

const StackItem = component<StackItemProps>(({ props, slots }) => {
    return () => {
        const bag: PartProps = {
            'data-scope': SCOPE,
            'data-part': 'item',
            ...layoutAttrs({ grow: props.grow ? '1' : undefined }, stackAnatomy.parts.item.layout),
        };
        if (props.asChild) return renderAsChild(slots.default, bag);
        return (
            <div class={props.class} {...bag}>
                {slots.default?.(bag)}
            </div>
        );
    };
}, { name: 'Stack.Item' });

export const Stack = compound(StackRoot, {
    Root: StackRoot,
    Item: StackItem,
    Row,
    Col,
});
