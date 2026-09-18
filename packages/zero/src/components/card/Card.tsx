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
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithVariantAxes } from '../../contract/props.js';
import { cardAnatomy } from './anatomy.js';

const SCOPE = cardAnatomy.scope;

export type CardRootProps =
    & WithVariantAxes<'card'>
    & WithClass
    & Define.Slot<'default'>;

const CardRoot = component<CardRootProps>(({ props, slots }) => () => (
    <div data-scope={SCOPE} data-part="root" {...variantAttrs(props)} class={props.class}>
        {slots.default?.()}
    </div>
), { name: 'Card.Root' });

export type CardPartProps = WithClass & Define.Slot<'default'>;

/**
 * The four plain bands and the description are the same component with a
 * different part name and element — writing five near-identical factories out
 * longhand would be five places for one convention to drift.
 */
function makePart(part: string, element: 'div' | 'h3' | 'p', name: string) {
    return component<CardPartProps>(({ props, slots }) => () => {
        const bag = { 'data-scope': SCOPE, 'data-part': part, class: props.class };
        const children = slots.default?.();
        if (element === 'h3') return <h3 {...bag}>{children}</h3>;
        if (element === 'p') return <p {...bag}>{children}</p>;
        return <div {...bag}>{children}</div>;
    }, { name });
}

const CardHeader = makePart('header', 'div', 'Card.Header');
// `h3` rather than a `div`: a card title is a heading in the document outline,
// and the level is the one that sits under a page (h1) and a section (h2)
// without the consumer having to think. Pass `asChild`-style overrides by
// rendering your own heading inside `Card.Header` when the outline differs.
const CardTitle = makePart('title', 'h3', 'Card.Title');
const CardDescription = makePart('description', 'p', 'Card.Description');
const CardBody = makePart('body', 'div', 'Card.Body');
const CardFooter = makePart('footer', 'div', 'Card.Footer');

export const Card = compound(CardRoot, {
    Root: CardRoot,
    Header: CardHeader,
    Title: CardTitle,
    Description: CardDescription,
    Body: CardBody,
    Footer: CardFooter,
});
