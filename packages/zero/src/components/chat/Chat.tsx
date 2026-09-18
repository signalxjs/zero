/**
 * Chat — one message row.
 *
 * ```tsx
 * <Chat.Root>
 *     <Chat.Avatar><img src="/ada.png" alt="" /></Chat.Avatar>
 *     <Chat.Header>Ada · 12:45</Chat.Header>
 *     <Chat.Bubble>The contract is the anatomy.</Chat.Bubble>
 *     <Chat.Footer>Delivered</Chat.Footer>
 * </Chat.Root>
 * <Chat.Root placement="end" color="primary">
 *     <Chat.Bubble>Agreed.</Chat.Bubble>
 * </Chat.Root>
 * ```
 *
 * Pure content — no state, no ids, no ARIA of its own: a transcript that
 * needs log semantics is a `role="log"` container the consumer writes
 * AROUND the rows. See `anatomy.ts` for the placement reasoning.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithVariantAxes } from '../../contract/props.js';
import { chatAnatomy } from './anatomy.js';

const SCOPE = chatAnatomy.scope;

/** Which inline side a row sits on — the logical pair. */
export type ChatPlacement = 'start' | 'end';

export type ChatRootProps =
    & Define.Prop<'placement', ChatPlacement, false>
    & WithVariantAxes<'chat'>
    & WithClass
    & Define.Slot<'default'>;

const ChatRoot = component<ChatRootProps>(({ props, slots }) => {
    return () => (
        <div
            data-scope={SCOPE}
            data-part="root"
            data-placement={props.placement ?? 'start'}
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Chat.Root' });

export type ChatPartProps = WithClass & Define.Slot<'default'>;

const chatPart = (partName: 'avatar' | 'header' | 'bubble' | 'footer', name: string) =>
    component<ChatPartProps>(({ props, slots }) => {
        return () => (
            <div data-scope={SCOPE} data-part={partName} class={props.class}>
                {slots.default?.()}
            </div>
        );
    }, { name });

const ChatAvatar = chatPart('avatar', 'Chat.Avatar');
const ChatHeader = chatPart('header', 'Chat.Header');
const ChatBubble = chatPart('bubble', 'Chat.Bubble');
const ChatFooter = chatPart('footer', 'Chat.Footer');

export const Chat = compound(ChatRoot, {
    Root: ChatRoot,
    Avatar: ChatAvatar,
    Header: ChatHeader,
    Bubble: ChatBubble,
    Footer: ChatFooter,
});
