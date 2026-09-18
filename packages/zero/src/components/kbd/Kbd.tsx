/**
 * Kbd — a keyboard key, spelled with the element that means it.
 *
 * ```tsx
 * Press <Kbd>⌘</Kbd> <Kbd>K</Kbd> to search
 * ```
 *
 * One part, no state, no behavior — see `anatomy.ts` for why the `<kbd>`
 * element rather than a styled span is the component's whole substance.
 *
 * No `asChild`: a badge is often already a link or a button, but a keycap is
 * never anything except a keycap — offering the escape hatch would only
 * invite dropping the semantic element it exists for.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithVariantAxes } from '../../contract/props.js';
import { kbdAnatomy } from './anatomy.js';

const SCOPE = kbdAnatomy.scope;

export type KbdRootProps =
    & WithVariantAxes<'kbd'>
    & WithClass
    & Define.Slot<'default'>;

const KbdRoot = component<KbdRootProps>(({ props, slots }) => {
    return () => (
        <kbd
            data-scope={SCOPE}
            data-part="root"
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
        </kbd>
    );
}, { name: 'Kbd.Root' });

// One part, but still a compound: every scope in the anatomy exports
// `<Pascal>.Root`, and the kit's `./components` emitter relies on it.
export const Kbd = compound(KbdRoot, { Root: KbdRoot });
