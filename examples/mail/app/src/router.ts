/**
 * Hash routing — `#/inbox`, `#/label/work`, `#/inbox/t12`. The mailbox lives
 * in the URL so NavList links are real links and Back works on a phone.
 */
import { signal } from 'sigx';
import type { FolderId, LabelId } from './data/mock';

export type Route =
    | { kind: 'folder'; id: FolderId | 'starred'; thread?: string }
    | { kind: 'label'; id: LabelId; thread?: string };

const FOLDER_IDS = ['inbox', 'starred', 'snoozed', 'sent', 'drafts', 'archive', 'spam', 'trash'];
const LABEL_IDS = ['work', 'personal', 'travel', 'finance', 'design'];

function parse(hash: string): Route {
    const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (parts[0] === 'label' && LABEL_IDS.includes(parts[1] ?? '')) {
        return { kind: 'label', id: parts[1] as LabelId, thread: parts[2] };
    }
    if (FOLDER_IDS.includes(parts[0] ?? '')) {
        return { kind: 'folder', id: parts[0] as FolderId | 'starred', thread: parts[1] };
    }
    return { kind: 'folder', id: 'inbox' };
}

const state = signal({ hash: typeof location === 'undefined' ? '' : location.hash });

if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', () => { state.hash = location.hash; });
}

export function route(): Route {
    return parse(state.hash);
}

/** The mailbox part of the route — changes on folder/label switches only. */
export function mailboxKey(): string {
    const r = route();
    return `${r.kind}:${r.id}`;
}

export function navigate(hash: string): void {
    if (location.hash === hash) return;
    location.hash = hash;
    state.hash = hash;
}
