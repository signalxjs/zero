import { component } from 'sigx';
import { Avatar, Button, Chat, ChatLog } from '@sigx/zero';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';


const WORDS = 'the log follows its tail until you scroll up then the rows you are reading stay where they are'.split(' ');

/** Deterministic text of message `n` — 3 to 22 words, so rows differ in height. */
function messageText(n: number, extra = 0): string {
    const length = 3 + ((n * 7919) % 20) + extra;
    const words: string[] = [];
    for (let i = 0; i < length; i++) words.push(WORDS[(n * 31 + i * 7) % WORDS.length]!);
    return words.join(' ');
}

/**
 * A transcript in a ChatLog: it follows its tail, lets go when you scroll
 * up (the jump trigger appears), and keeps the row you are reading still
 * when earlier messages load above it. Message numbers are the keys.
 */
const TranscriptDemo = component(({ signal }) => {
    const st = signal({ first: 100, end: 130, streamed: 0, following: true });
    return () => {
        const rows = [];
        for (let n = st.first; n < st.end; n++) {
            rows.push(
                <Chat.Root key={`m${n}`} placement={n % 3 === 0 ? 'end' : 'start'} color={n % 3 === 0 ? pickRole('primary') : undefined}>
                    <Chat.Header>{`#${n}`}</Chat.Header>
                    <Chat.Bubble>{messageText(n, n === st.end - 1 ? st.streamed : 0)}</Chat.Bubble>
                </Chat.Root>,
            );
        }
        return (
            <div style="display: grid; gap: 0.75rem; max-width: 34rem">
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem">
                    <Button.Root disabled={st.first === 0} onClick={() => { st.first = Math.max(0, st.first - 10); }}>
                        Load 10 earlier
                    </Button.Root>
                    <Button.Root onClick={() => { st.streamed = 0; st.end += 1; }}>Append a message</Button.Root>
                    <Button.Root onClick={() => { st.streamed += 8; }}>Stream into the last message</Button.Root>
                </div>
                {/* The log fills a sized cell: a scroll box needs a definite height. */}
                <div style="display: grid; block-size: 20rem">
                    <ChatLog.Root label="Conversation" color={pickRole('primary')} model:following={[st, 'following']}>
                        <ChatLog.Content>{rows}</ChatLog.Content>
                        <ChatLog.JumpTrigger />
                    </ChatLog.Root>
                </div>
                <p>{`${st.end - st.first} messages · ${st.following ? 'following the tail' : 'paused'}`}</p>
            </div>
        );
    };
}, { name: 'ChatLogTranscriptDemo' });

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
        <h3>Transcript</h3>
        <p>
            <code>ChatLog</code> is the container a transcript needs around the
            rows: a <code>role="log"</code> scroll box that follows its tail.
            Scroll up and it lets go — the jump trigger appears; append while
            you read and nothing moves; load earlier messages and the row you
            are on stays put.
        </p>
        <TranscriptDemo />
    </>
), { name: 'ChatDemos' });

export const chatPage: PageEntry = {
    id: 'chat',
    title: 'Chat',
    category: 'Display & feedback',
    Demos: ChatDemos,
};
