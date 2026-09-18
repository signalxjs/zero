import { component } from 'sigx';
import { Avatar, Chat } from '@sigx/zero';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';

const ChatDemos = component(() => () => (
    <>
        <p>
            One message row per <code>Chat.Root</code>, pure content. The row
            declares its inline side as{' '}
            <code>data-placement="start|end"</code> — logical, so a transcript
            mirrors under RTL without touching the rows. The colour axis rides
            the row and each design system wires it to the bubble's fill.
        </p>
        <div style="max-width: 34rem; display: grid">
            <Chat.Root>
                <Chat.Avatar>
                    <Avatar.Root>
                        <Avatar.Fallback>AL</Avatar.Fallback>
                    </Avatar.Root>
                </Chat.Avatar>
                <Chat.Header>Ada · 12:45</Chat.Header>
                <Chat.Bubble>The contract is the anatomy — recipes are just data over it.</Chat.Bubble>
                <Chat.Footer>Delivered</Chat.Footer>
            </Chat.Root>
            <Chat.Root placement="end" color={pickRole('primary')}>
                <Chat.Bubble>Agreed. Shipping the sweep now.</Chat.Bubble>
                <Chat.Footer>Seen 12:46</Chat.Footer>
            </Chat.Root>
            <Chat.Root>
                <Chat.Avatar>
                    <Avatar.Root>
                        <Avatar.Fallback>AL</Avatar.Fallback>
                    </Avatar.Root>
                </Chat.Avatar>
                <Chat.Bubble>A bare row needs neither header nor footer.</Chat.Bubble>
            </Chat.Root>
        </div>
    </>
), { name: 'ChatDemos' });

export const chatPage: PageEntry = {
    id: 'chat',
    title: 'Chat',
    category: 'Display & feedback',
    Demos: ChatDemos,
};
