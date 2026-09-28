/**
 * The mailbox store: one reactive state object, derived views, and every
 * action the UI can take. Mutations are synchronous against the mock data;
 * the "server" latency is only simulated where a real client would wait
 * (switching folders, sending).
 */
import { computed, signal, watch } from 'sigx';
import { toast, toaster } from '@sigx/zero';
import { createMailbox, lastDate, ME, participants, snippet } from './data/mock';
import type { Attachment, Category, Contact, FolderId, LabelId, Message, Thread } from './data/mock';
import { navigate, route } from './router';

export type SortOrder = 'newest' | 'oldest' | 'unread';
export type DateRange = 'any' | 'week' | 'month' | 'year';
export type Density = 'comfortable' | 'compact';

export interface Draft {
    to: string[];
    cc: string[];
    showCc: boolean;
    subject: string;
    body: string;
    files: File[];
    replyTo?: string;
}

const emptyDraft = (): Draft => ({ to: [], cc: [], showCc: false, subject: '', body: '', files: [] });

export const st = signal({
    threads: createMailbox() as Thread[],
    category: 'primary' as Category,
    selected: [] as string[],
    highlight: 0,
    query: '',
    filters: { from: '', attachments: false, unread: false, range: 'any' as DateRange },
    sort: 'newest' as SortOrder,
    loading: false,
    listWidth: 440,
    composeOpen: false,
    draft: emptyDraft(),
    settingsOpen: false,
    shortcutsOpen: false,
    filtersOpen: false,
    navOpen: false,
    density: 'comfortable' as Density,
    snippets: true,
    advanceOnArchive: true,
    signature: 'Alex Morgan\nProduct engineer · Zero',
    notify: { desktop: true, sound: false, importantOnly: false },
    /** Per message: expanded in the reading pane. */
    expanded: {} as Record<string, boolean>,
    reply: { open: false, mode: 'reply' as 'reply' | 'reply-all' | 'forward', body: '' },
});

export const FOLDERS: { id: FolderId | 'starred'; name: string; icon: 'inbox' | 'star' | 'clock' | 'send' | 'file' | 'archive' | 'spam' | 'trash' }[] = [
    { id: 'inbox', name: 'Inbox', icon: 'inbox' },
    { id: 'starred', name: 'Starred', icon: 'star' },
    { id: 'snoozed', name: 'Snoozed', icon: 'clock' },
    { id: 'sent', name: 'Sent', icon: 'send' },
    { id: 'drafts', name: 'Drafts', icon: 'file' },
    { id: 'archive', name: 'Archive', icon: 'archive' },
    { id: 'spam', name: 'Spam', icon: 'spam' },
    { id: 'trash', name: 'Trash', icon: 'trash' },
];

export const CATEGORIES: { id: Category; name: string; icon: 'inbox' | 'users' | 'megaphone' }[] = [
    { id: 'primary', name: 'Primary', icon: 'inbox' },
    { id: 'social', name: 'Social', icon: 'users' },
    { id: 'promotions', name: 'Promotions', icon: 'megaphone' },
];

// ── Derived views ──

const DAY = 86_400_000;
const RANGE_DAYS: Record<DateRange, number> = { any: Infinity, week: 7, month: 31, year: 366 };

function inView(t: Thread): boolean {
    const r = route();
    if (r.kind === 'label') return t.labels.includes(r.id) && t.folder !== 'trash' && t.folder !== 'spam';
    if (r.id === 'starred') return t.starred && t.folder !== 'trash';
    if (t.folder !== r.id) return false;
    if (r.id === 'inbox' && !searching()) return t.category === st.category;
    return true;
}

/** True while a query or filter narrows the list — search spans the categories. */
export const searching = (): boolean =>
    st.query.trim() !== '' || st.filters.from !== '' || st.filters.attachments || st.filters.unread || st.filters.range !== 'any';

function matches(t: Thread): boolean {
    const f = st.filters;
    if (f.unread && t.read) return false;
    if (f.attachments && !t.messages.some((m) => m.attachments.length > 0)) return false;
    if (f.from && !t.messages.some((m) => m.from.email === f.from)) return false;
    if (f.range !== 'any' && Date.now() - lastDate(t) > RANGE_DAYS[f.range] * DAY) return false;
    const q = st.query.trim().toLowerCase();
    if (!q) return true;
    return t.subject.toLowerCase().includes(q)
        || participants(t).some((c) => c.name.toLowerCase().includes(q) || c.email.includes(q))
        || snippet(t).toLowerCase().includes(q);
}

// A new search starts at the top of its results.
watch(() => `${st.query}|${JSON.stringify(st.filters)}|${st.category}`, () => { st.highlight = 0; st.selected = []; });

export const visible = computed((): Thread[] => {
    const list = st.threads.filter((t) => inView(t) && matches(t));
    const order = st.sort;
    return list.sort((a, b) => {
        if (order === 'unread' && a.read !== b.read) return a.read ? 1 : -1;
        return order === 'oldest' ? lastDate(a) - lastDate(b) : lastDate(b) - lastDate(a);
    });
});

export const openThread = computed((): Thread | undefined => {
    const id = route().thread;
    return id ? st.threads.find((t) => t.id === id) : undefined;
});

export function unreadCount(folder: FolderId | 'starred' | Category): number {
    return st.threads.filter((t) => {
        if (t.read) return false;
        if (folder === 'starred') return t.starred && t.folder !== 'trash';
        if (folder === 'primary' || folder === 'social' || folder === 'promotions') return t.folder === 'inbox' && t.category === folder;
        return t.folder === folder;
    }).length;
}

export function folderCount(folder: FolderId): number {
    return st.threads.filter((t) => t.folder === folder).length;
}

export function labelCount(label: LabelId): number {
    return st.threads.filter((t) => t.labels.includes(label) && !t.read && t.folder !== 'trash' && t.folder !== 'spam').length;
}

// ── Navigation ──

let loadingTimer: ReturnType<typeof setTimeout> | undefined;

/** Called when the route's mailbox changes: reset per-view state and fake a fetch. */
export function onMailboxChange(): void {
    st.selected = [];
    st.highlight = 0;
    st.reply.open = false;
    st.loading = true;
    clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => { st.loading = false; }, 380);
}

function mailboxHref(): string {
    const r = route();
    return r.kind === 'label' ? `#/label/${r.id}` : `#/${r.id}`;
}

export function openThreadById(id: string): void {
    const t = st.threads.find((x) => x.id === id);
    if (!t) return;
    if (t.folder === 'drafts') {
        editDraft(t);
        return;
    }
    t.read = true;
    // Newest message open, plus every unread one; the rest collapse.
    const last = t.messages[t.messages.length - 1]!;
    for (const m of t.messages) st.expanded[m.id] = m === last || !!st.expanded[m.id];
    st.reply = { open: false, mode: 'reply', body: '' };
    const index = visible.value.indexOf(t);
    if (index >= 0) st.highlight = index;
    navigate(`${mailboxHref()}/${id}`);
}

export function closeThread(): void {
    navigate(mailboxHref());
}

/** Open the thread `step` rows away from the open (or highlighted) one. */
export function step(stepBy: 1 | -1, open = true): void {
    const list = visible.value;
    if (list.length === 0) return;
    const current = openThread.value ? list.indexOf(openThread.value) : st.highlight;
    const next = Math.max(0, Math.min(list.length - 1, (current < 0 ? st.highlight : current) + stepBy));
    st.highlight = next;
    if (open) openThreadById(list[next]!.id);
}

// ── Mutations (every destructive one undoable) ──

type Snapshot = Pick<Thread, 'folder' | 'read' | 'starred' | 'labels' | 'snoozedUntil'>;

function snapshot(ids: string[]): Map<string, Snapshot> {
    const map = new Map<string, Snapshot>();
    for (const t of st.threads) {
        if (ids.includes(t.id)) map.set(t.id, { folder: t.folder, read: t.read, starred: t.starred, labels: [...t.labels], snoozedUntil: t.snoozedUntil });
    }
    return map;
}

function restore(map: Map<string, Snapshot>): void {
    for (const t of st.threads) {
        const s = map.get(t.id);
        if (s) Object.assign(t, s, { labels: s.labels });
    }
}

function threadsOf(ids: string[]): Thread[] {
    return st.threads.filter((t) => ids.includes(t.id));
}

/** The ids an action applies to: the checked rows, else the open thread, else the highlighted row. */
export function targets(): string[] {
    if (st.selected.length > 0) return [...st.selected];
    const open = openThread.value;
    if (open) return [open.id];
    const row = visible.value[st.highlight];
    return row ? [row.id] : [];
}

const plural = (n: number, one: string): string => (n === 1 ? `1 ${one}` : `${n} ${one}s`);

function leave(ids: string[], folder: FolderId, verb: string): void {
    if (ids.length === 0) return;
    const before = snapshot(ids);
    const openId = openThread.value?.id;
    const nextId = openId && ids.includes(openId) && st.advanceOnArchive ? neighbour(openId, ids) : undefined;
    for (const t of threadsOf(ids)) {
        t.folder = folder;
        if (folder !== 'snoozed') t.snoozedUntil = undefined;
    }
    st.selected = st.selected.filter((id) => !ids.includes(id));
    if (openId && ids.includes(openId)) {
        if (nextId) openThreadById(nextId);
        else closeThread();
    }
    toast({
        title: `${plural(ids.length, 'conversation')} ${verb}`,
        duration: 6000,
        action: {
            label: 'Undo',
            onClick: () => {
                restore(before);
                toast({ title: 'Action undone', duration: 2500 });
            },
        },
    });
}

/** The thread after `id` in the list that is not also leaving. */
function neighbour(id: string, leaving: string[]): string | undefined {
    const list = visible.value;
    const at = list.findIndex((t) => t.id === id);
    const after = list.slice(at + 1).find((t) => !leaving.includes(t.id));
    const before = list.slice(0, at).reverse().find((t) => !leaving.includes(t.id));
    return (after ?? before)?.id;
}

export const archive = (ids = targets()): void => leave(ids, 'archive', 'archived');
export const trash = (ids = targets()): void => {
    const inTrash = threadsOf(ids).every((t) => t.folder === 'trash');
    if (inTrash) deleteForever(ids);
    else leave(ids, 'trash', 'moved to Trash');
};
export const markSpam = (ids = targets()): void => leave(ids, 'spam', 'marked as spam');
export const moveTo = (folder: FolderId, ids = targets()): void => leave(ids, folder, `moved to ${folder[0]!.toUpperCase()}${folder.slice(1)}`);

export function snooze(days: number, ids = targets()): void {
    const until = Date.now() + days * DAY;
    for (const t of threadsOf(ids)) t.snoozedUntil = until;
    leave(ids, 'snoozed', `snoozed until ${new Date(until).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}`);
}

function deleteForever(ids: string[]): void {
    const removed = threadsOf(ids);
    if (openThread.value && ids.includes(openThread.value.id)) closeThread();
    st.threads = st.threads.filter((t) => !ids.includes(t.id));
    st.selected = [];
    toast({
        title: `${plural(removed.length, 'conversation')} deleted forever`,
        duration: 6000,
        action: { label: 'Undo', onClick: () => { st.threads = [...st.threads, ...removed]; } },
    });
}

export function setRead(read: boolean, ids = targets()): void {
    for (const t of threadsOf(ids)) t.read = read;
    if (!read && openThread.value && ids.includes(openThread.value.id)) closeThread();
}

export function toggleStar(id: string): void {
    const t = st.threads.find((x) => x.id === id);
    if (t) t.starred = !t.starred;
}

export function toggleLabel(label: LabelId, ids = targets()): void {
    const ts = threadsOf(ids);
    const all = ts.every((t) => t.labels.includes(label));
    for (const t of ts) t.labels = all ? t.labels.filter((l) => l !== label) : [...new Set([...t.labels, label])];
}

export function markAllRead(): void {
    const ids = visible.value.filter((t) => !t.read).map((t) => t.id);
    if (ids.length === 0) {
        toast({ title: 'Nothing unread here', duration: 2500 });
        return;
    }
    const before = snapshot(ids);
    setRead(true, ids);
    toast({ title: `${plural(ids.length, 'conversation')} marked as read`, duration: 5000, action: { label: 'Undo', onClick: () => restore(before) } });
}

export function toggleSelected(id: string): void {
    st.selected = st.selected.includes(id) ? st.selected.filter((x) => x !== id) : [...st.selected, id];
}

export function refresh(): void {
    st.loading = true;
    const id = toast({ title: 'Checking for new mail…', status: 'loading', duration: Infinity });
    setTimeout(() => {
        st.loading = false;
        const from = participants(st.threads.find((t) => t.folder === 'inbox')!)[0]!;
        const tid = `t-new-${Date.now()}`;
        st.threads = [{
            id: tid,
            subject: 'Quick sync about the release?',
            folder: 'inbox', category: 'primary', labels: ['work'], read: false, starred: false, important: true,
            messages: [{ id: `${tid}-m1`, from, to: [ME], cc: [], date: Date.now(), attachments: [], body: ['Hey — do you have ten minutes today to go over the release checklist? Mostly the migration notes.'] }],
        }, ...st.threads];
        toast({ id, title: '1 new message', description: `From ${from.name}`, status: 'complete', color: 'success', duration: 4000 });
    }, 900);
}

// ── Compose & reply ──

export function compose(prefill: Partial<Draft> = {}): void {
    st.draft = { ...emptyDraft(), ...prefill };
    if (st.draft.cc.length) st.draft.showCc = true;
    st.composeOpen = true;
}

function editDraft(t: Thread): void {
    const m = t.messages[0]!;
    compose({ to: m.to.map((c) => c.email), subject: t.subject.replace(/ \(draft\)$/, ''), body: m.body.join('\n\n'), replyTo: t.id });
}

function contactFor(email: string): Contact {
    const known = [...new Set(st.threads.flatMap((t) => t.messages.flatMap((m) => [m.from, ...m.to])))].find((c) => c.email === email);
    return known ?? { id: email, name: email.split('@')[0]!, email, color: 'neutral' };
}

export function discardDraft(): void {
    st.composeOpen = false;
    st.draft = emptyDraft();
    toast({ title: 'Draft discarded', duration: 2500 });
}

/** Closing the composer keeps what was written, as a draft. */
export function saveDraft(): void {
    const d = st.draft;
    if (!d.subject && !d.body && d.to.length === 0) return;
    const existing = d.replyTo ? st.threads.find((t) => t.id === d.replyTo && t.folder === 'drafts') : undefined;
    const message: Message = {
        id: `${existing?.id ?? `d${Date.now()}`}-m1`, from: ME, to: d.to.map(contactFor), cc: d.cc.map(contactFor),
        date: Date.now(), body: d.body.split(/\n{2,}/), attachments: [],
    };
    if (existing) {
        existing.subject = d.subject || '(no subject)';
        existing.messages = [message];
    } else {
        const id = `d${Date.now()}`;
        st.threads = [{ id, subject: d.subject || '(no subject)', folder: 'drafts', category: 'primary', labels: [], read: true, starred: false, important: false, messages: [{ ...message, id: `${id}-m1` }] }, ...st.threads];
    }
    toast({ title: 'Draft saved', duration: 2500 });
}

function attachmentsOf(files: File[]): Attachment[] {
    return files.map((f) => ({
        name: f.name,
        size: f.size,
        kind: f.type.startsWith('image/') ? 'image' : f.name.endsWith('.pdf') ? 'pdf' : f.name.endsWith('.zip') ? 'zip' : 'doc',
    }));
}

export function send(): boolean {
    const d = st.draft;
    if (d.to.length === 0) {
        toast({ title: 'Add at least one recipient', color: 'error', role: 'alert', duration: 3500 });
        return false;
    }
    const id = `s${Date.now()}`;
    const body = [...d.body.split(/\n{2,}/).filter(Boolean), ...(st.signature ? [`— ${st.signature.split('\n')[0]}`] : [])];
    const thread: Thread = {
        id, subject: d.subject || '(no subject)', folder: 'sent', category: 'primary', labels: [], read: true, starred: false, important: false,
        messages: [{ id: `${id}-m1`, from: ME, to: d.to.map(contactFor), cc: d.cc.map(contactFor), date: Date.now(), body, attachments: attachmentsOf(d.files) }],
    };
    const draftId = d.replyTo;
    st.threads = [thread, ...st.threads.filter((t) => !(t.id === draftId && t.folder === 'drafts'))];
    st.composeOpen = false;
    st.draft = emptyDraft();
    toast({
        title: 'Message sent',
        description: `To ${thread.messages[0]!.to.map((c) => c.name).join(', ')}`,
        duration: 6000,
        action: {
            label: 'Undo',
            onClick: () => {
                st.threads = st.threads.filter((t) => t.id !== id);
                compose({ ...d });
            },
        },
    });
    return true;
}

export function startReply(mode: 'reply' | 'reply-all' | 'forward'): void {
    const t = openThread.value;
    if (!t) return;
    if (mode === 'forward') {
        const last = t.messages[t.messages.length - 1]!;
        compose({
            subject: `Fwd: ${t.subject}`,
            body: `\n\n---------- Forwarded message ----------\nFrom: ${last.from.name} <${last.from.email}>\n\n${last.body.join('\n\n')}`,
        });
        return;
    }
    st.reply = { open: true, mode, body: st.reply.open ? st.reply.body : '' };
}

export function replyRecipients(t: Thread, mode: 'reply' | 'reply-all' | 'forward'): Contact[] {
    const last = [...t.messages].reverse().find((m) => m.from.id !== ME.id) ?? t.messages[0]!;
    const main = last.from.id === ME.id ? last.to : [last.from];
    if (mode !== 'reply-all') return main;
    return [...new Map([...main, ...last.to, ...last.cc].filter((c) => c.id !== ME.id).map((c) => [c.id, c])).values()];
}

export function sendReply(): void {
    const t = openThread.value;
    const text = st.reply.body.trim();
    if (!t || !text) return;
    const to = replyRecipients(t, st.reply.mode);
    const message: Message = { id: `${t.id}-r${Date.now()}`, from: ME, to, cc: [], date: Date.now(), body: text.split(/\n{2,}/), attachments: [] };
    t.messages = [...t.messages, message];
    st.expanded[message.id] = true;
    st.reply = { open: false, mode: 'reply', body: '' };
    toast({
        title: 'Reply sent',
        duration: 6000,
        action: {
            label: 'Undo',
            onClick: () => {
                t.messages = t.messages.filter((m) => m.id !== message.id);
                st.reply = { open: true, mode: 'reply', body: text };
            },
        },
    });
}

export function dismissToasts(): void {
    toaster().dismiss();
}

export { ME };
