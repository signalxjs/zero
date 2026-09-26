/**
 * Card — a surface with a conventional interior.
 *
 * ```tsx
 * <Card.Root variant="outline">
 *     <Card.Header>
 *         <Card.Title>Monthly report</Card.Title>
 *         <Card.Description>Updated 4 minutes ago</Card.Description>
 *     </Card.Header>
 *     <Card.Body>…</Card.Body>
 *     <Card.Footer><Button.Root>Open</Button.Root></Card.Footer>
 * </Card.Root>
 * ```
 *
 * No state, no context, no ids — see `anatomy.ts` for why the obvious
 * `aria-labelledby` wiring is deliberately absent. Every part below `root` is
 * optional; the axes ride `root` and cascade to the rest through the compiled
 * CSS, so only `root` takes them.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { renderAsChild } from '../../contract/as-child.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { cardAnatomy } from './anatomy.js';

const SCOPE = cardAnatomy.scope;

export type CardRootProps =
    & WithVariantAxes<'card'>
    & WithClass
    & WithHtmlAttrs
    /**
     * Render the card as your own element — the `<article>` or `<section>`
     * a card that needs a name is (see `anatomy.ts`). The slot receives the
     * bag; spread it.
     */
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const CardRoot = component<CardRootProps>(({ props, slots }) => () => {
    const bag: PartProps = {
        ...htmlAttrs(props),
        'data-scope': SCOPE,
        'data-part': 'root',
        ...variantAttrs(props),
    };
    if (props.asChild) return renderAsChild(slots.default, bag);
    return (
        <div {...bag} class={props.class}>
            {slots.default?.(bag)}
        </div>
    );
}, { name: 'Card.Root' });

export type CardPartProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

/**
 * The three plain bands are the same component with a different part name —
 * writing them out longhand would be three places for one convention to
 * drift.
 */
function makeBand(part: 'header' | 'body' | 'footer', name: string) {
    return component<CardPartProps>(({ props, slots }) => () => (
        <div {...htmlAttrs(props)} data-scope={SCOPE} data-part={part} class={props.class}>
            {slots.default?.()}
        </div>
    ), { name });
}

export type CardTextProps =
    & WithClass
    & WithHtmlAttrs
    /**
     * Render your own element — the heading level the page's outline wants
     * (`<h2>` under a page `<h1>`), or a `<div>` for a description that is
     * more than one paragraph. The slot receives the bag; spread it.
     */
    & WithAsChild
    & Define.Slot<'default', PartProps>;

/**
 * `title` and `description`: text parts with a default element and an
 * asChild escape (EmptyState.Title's shape).
 */
function makeText(part: 'title' | 'description', element: 'h3' | 'p', name: string) {
    return component<CardTextProps>(({ props, slots }) => () => {
        const bag: PartProps = { ...htmlAttrs(props), 'data-scope': SCOPE, 'data-part': part };
        if (props.asChild) return renderAsChild(slots.default, bag);
        const children = slots.default?.(bag);
        if (element === 'h3') return <h3 {...bag} class={props.class}>{children}</h3>;
        return <p {...bag} class={props.class}>{children}</p>;
    }, { name });
}

const CardHeader = makeBand('header', 'Card.Header');
// `h3` by default: a card title is a heading in the document outline, and the
// level is the one that sits under a page (h1) and a section (h2) without the
// consumer having to think. When the outline differs, `asChild` renders the
// heading it needs.
const CardTitle = makeText('title', 'h3', 'Card.Title');
const CardDescription = makeText('description', 'p', 'Card.Description');
const CardBody = makeBand('body', 'Card.Body');
const CardFooter = makeBand('footer', 'Card.Footer');

export const Card = compound(CardRoot, {
    Root: CardRoot,
    Header: CardHeader,
    Title: CardTitle,
    Description: CardDescription,
    Body: CardBody,
    Footer: CardFooter,
});
