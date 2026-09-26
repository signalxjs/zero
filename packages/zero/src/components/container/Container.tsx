/**
 * Container — bound the page width, and keep content off the edges.
 *
 * ```tsx
 * <Container measure="lg" padX="xl">
 *     <Col gap="xl">…</Col>
 * </Container>
 *
 * <Container measure="prose">…</Container>
 * ```
 *
 * See `anatomy.ts` for why the width is a layout attribute rather than the
 * `size` axis.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { renderAsChild } from '../../contract/as-child.js';
import { layoutAttrs } from '../../contract/layout-attrs.js';
import type { LayoutProp } from '../../contract/layout-attrs.js';
import { htmlAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithHtmlAttrs } from '../../contract/props.js';
import { containerAnatomy } from './anatomy.js';

const SCOPE = containerAnatomy.scope;

export type ContainerRootProps =
    & WithClass
    & WithHtmlAttrs
    /** The maximum width, from the design system's `--measure-*` ramp. */
    & Define.Prop<'measure', LayoutProp<'measure'>, false>
    & Define.Prop<'pad', LayoutProp<'pad'>, false>
    & Define.Prop<'padX', LayoutProp<'pad-x'>, false>
    & Define.Prop<'padY', LayoutProp<'pad-y'>, false>
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const ContainerRoot = component<ContainerRootProps>(({ props, slots }) => {
    return () => {
        const bag: PartProps = {
            ...htmlAttrs(props),
            'data-scope': SCOPE,
            'data-part': 'root',
            ...layoutAttrs({
                'measure': props.measure,
                'pad': props.pad,
                'pad-x': props.padX,
                'pad-y': props.padY,
            }, containerAnatomy.parts.root.layout),
        };
        if (props.asChild) return renderAsChild(slots.default, bag);
        return (
            <div class={props.class} {...bag}>
                {slots.default?.(bag)}
            </div>
        );
    };
}, { name: 'Container.Root' });

// See Badge: single-part scopes still carry `.Root`.
export const Container = compound(ContainerRoot, { Root: ContainerRoot });
