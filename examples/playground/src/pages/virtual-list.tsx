import { component } from 'sigx';
import { Button, Chat, createVirtualList } from '@sigx/zero';
import type { PageEntry } from './registry';

const WORDS = (
    'the contract is the anatomy and recipes are data over it so a window keeps only '
    + 'the rows near the viewport in the document while the rest are padding'
).split(' ');

/** Deterministic text of message `n` — 3 to 42 words, so rows differ in height. */
function messageText(n: number, extra = 0): string {
    const length = 3 + ((n * 7919) % 40) + extra;
    const words: string[] = [];
    for (let i = 0; i < length; i++) words.push(WORDS[(n * 31 + i * 7) % WORDS.length]!);
    return words.join(' ');
}

const viewportStyle = 'overflow-y: auto; border: 1px solid var(--color-base-300); border-radius: var(--radius-box, 0.5rem); background: var(--color-base-100);';

/**
 * A chat transcript of 2,000 messages that follows its tail. Message numbers
 * are the keys: "Load earlier" prepends by lowering the first number, so a
 * key never changes meaning.
 */
const TranscriptDemo = component(({ signal }) => {
    const st = signal({ first: 1000, end: 3000, streamed: 0 });
    const v = createVirtualList({
        count: () => st.end - st.first,
        key: (i) => `m${st.first + i}`,
        estimateSize: 72,
        gap: 8,
        stickToBottom: true,
    });
    const last = (): number => st.end - 1;

    return () => (
        <div style="display: grid; gap: 0.75rem; max-width: 34rem">
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem">
                <Button.Root disabled={st.first === 0} onClick={() => { st.first = Math.max(0, st.first - 50); }}>
                    Load 50 earlier
                </Button.Root>
                <Button.Root onClick={() => { st.streamed = 0; st.end += 1; }}>Append a message</Button.Root>
                <Button.Root onClick={() => { st.streamed += 12; }}>Stream into the last message</Button.Root>
                <Button.Root disabled={v.following()} onClick={() => v.scrollToEnd()}>Jump to latest</Button.Root>
            </div>
            <div
                ref={v.viewportRef}
                role="log"
                aria-label="Virtualised transcript"
                tabIndex={0}
                style={`${viewportStyle} height: 22rem; padding-inline: 0.75rem`}
            >
                <ol
                    ref={v.listRef}
                    style={`list-style: none; margin: 0; display: flex; flex-direction: column; gap: 8px; padding: ${v.before()}px 0 ${v.after()}px`}
                >
                    {v.rows().map((row) => {
                        const n = st.first + row.index;
                        return (
                            <li key={row.key} ref={v.measureRef(row.key)} data-index={row.index}>
                                <Chat.Root placement={n % 3 === 0 ? 'end' : 'start'}>
                                    <Chat.Header>{`#${n}`}</Chat.Header>
                                    <Chat.Bubble>{messageText(n, n === last() ? st.streamed : 0)}</Chat.Bubble>
                                </Chat.Root>
                            </li>
                        );
                    })}
                </ol>
            </div>
            <p>
                {`${v.count()} messages · ${v.rows().length} in the document · ${v.following() ? 'following the tail' : 'paused'}`}
            </p>
        </div>
    );
}, { name: 'TranscriptDemo' });

/** Ten thousand rows, every seventh one a line taller than its estimate. */
const RowsDemo = component(() => {
    const v = createVirtualList({ count: () => 10_000, key: (i) => `r${i}`, estimateSize: 36 });
    return () => (
        <div style="display: grid; gap: 0.75rem; max-width: 34rem">
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem">
                <Button.Root onClick={() => v.scrollToIndex(4999, 'start')}>Scroll to row 5,000</Button.Root>
                <Button.Root onClick={() => v.scrollToIndex(0, 'start')}>Back to the top</Button.Root>
            </div>
            <div
                ref={v.viewportRef}
                role="region"
                aria-label="Ten thousand rows"
                tabIndex={0}
                style={`${viewportStyle} height: 16rem`}
            >
                <ul ref={v.listRef} style={`list-style: none; margin: 0; padding: ${v.before()}px 0 ${v.after()}px`}>
                    {v.rows().map((row) => (
                        <li
                            key={row.key}
                            ref={v.measureRef(row.key)}
                            data-index={row.index}
                            style="padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--color-base-300)"
                        >
                            {`Row ${(row.index + 1).toLocaleString('en-US')}`}
                            {row.index % 7 === 0 ? <><br />A taller row, with a second line.</> : null}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}, { name: 'RowsDemo' });

const VirtualListDemos = component(() => () => (
    <>
        <p>
            <code>createVirtualList</code> (from <code>@sigx/zero/behaviors</code>)
            decides which rows of a long list to render; the app renders them.
            Rows are keyed and measured as they render, and the rows that are
            not rendered become the list's padding. A row keeps its measured
            height by key, so prepending older messages does not move the one
            you are reading.
        </p>
        <p>
            With <code>stickToBottom</code> the transcript follows its tail:
            appends and streamed text keep the end in view until you scroll
            up. Scroll back to the end, or press Jump to latest, to follow it
            again.
        </p>
        <TranscriptDemo />
        <p>A plain long list, and <code>scrollToIndex</code> into rows that have not been measured yet:</p>
        <RowsDemo />
    </>
), { name: 'VirtualListDemos' });

export const virtualListPage: PageEntry = {
    id: 'virtual-list',
    title: 'Virtual list',
    category: 'Display & feedback',
    Demos: VirtualListDemos,
};
