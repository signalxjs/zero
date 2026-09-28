/**
 * Mock mailbox — deterministic (seeded), dated relative to "now" so the list
 * always reads as recent. No backend: this module is the whole server.
 */

export type Role = 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error' | 'neutral';

export interface Contact {
    id: string;
    name: string;
    email: string;
    color: Role;
    title?: string;
    company?: string;
}

export interface Attachment {
    name: string;
    size: number;
    kind: 'pdf' | 'image' | 'doc' | 'sheet' | 'zip';
}

export interface Message {
    id: string;
    from: Contact;
    to: Contact[];
    cc: Contact[];
    date: number;
    body: string[];
    attachments: Attachment[];
}

export type FolderId = 'inbox' | 'snoozed' | 'sent' | 'drafts' | 'archive' | 'spam' | 'trash';
export type Category = 'primary' | 'social' | 'promotions';
export type LabelId = 'work' | 'personal' | 'travel' | 'finance' | 'design';

export interface Thread {
    id: string;
    subject: string;
    folder: FolderId;
    category: Category;
    labels: LabelId[];
    messages: Message[];
    read: boolean;
    starred: boolean;
    important: boolean;
    snoozedUntil?: number;
}

export const ME: Contact = { id: 'me', name: 'Alex Morgan', email: 'alex@zeromail.dev', color: 'primary', title: 'Product engineer', company: 'Zero' };

export const LABELS: { id: LabelId; name: string; color: Role }[] = [
    { id: 'work', name: 'Work', color: 'primary' },
    { id: 'personal', name: 'Personal', color: 'success' },
    { id: 'travel', name: 'Travel', color: 'info' },
    { id: 'finance', name: 'Finance', color: 'warning' },
    { id: 'design', name: 'Design', color: 'accent' },
];

const PEOPLE: [string, string, string, string][] = [
    ['Maya Chen', 'maya.chen', 'Design lead', 'Northwind'],
    ['Jonas Berg', 'jonas', 'Staff engineer', 'Zero'],
    ['Priya Nair', 'priya.nair', 'Product manager', 'Zero'],
    ['Lucas Moreau', 'lucas', 'Founder', 'Atelier Moreau'],
    ['Sofia Rossi', 'sofia.rossi', 'Recruiter', 'Hireline'],
    ['Ethan Walker', 'ethan', 'CTO', 'Brightwave'],
    ['Amara Okafor', 'amara', 'Engineering manager', 'Zero'],
    ['Kenji Watanabe', 'kenji.w', 'Frontend engineer', 'Zero'],
    ['Olivia Bennett', 'olivia', 'Accountant', 'Bennett & Co'],
    ['Mateo García', 'mateo', 'Photographer', 'Freelance'],
    ['Hannah Schmidt', 'hannah', 'Research', 'Lumen Labs'],
    ['Noah Johansson', 'noah.j', 'Designer', 'Northwind'],
    ['Isabella Costa', 'isa.costa', 'Marketing', 'Brightwave'],
    ['Liam O’Connor', 'liam', 'Support', 'Zero'],
    ['Zara Ahmed', 'zara', 'Data scientist', 'Lumen Labs'],
    ['Daniel Kim', 'dan.kim', 'Security', 'Zero'],
    ['Chloé Dubois', 'chloe', 'Travel agent', 'Voyage Bleu'],
    ['Grace Liu', 'grace', 'Sister', ''],
    ['Tom Hughes', 'tom', 'Landlord', ''],
    ['Elena Petrova', 'elena', 'Advisor', 'Vector Capital'],
];

const DOMAINS: Record<string, string> = {
    Zero: 'zeromail.dev', Northwind: 'northwind.io', 'Atelier Moreau': 'moreau.studio', Hireline: 'hireline.com',
    Brightwave: 'brightwave.co', 'Bennett & Co': 'bennett.co', Freelance: 'fastmail.com', 'Lumen Labs': 'lumenlabs.ai',
    'Voyage Bleu': 'voyagebleu.fr', 'Vector Capital': 'vector.vc', '': 'gmail.com',
};

const COLORS: Role[] = ['primary', 'accent', 'info', 'success', 'warning', 'error', 'secondary', 'neutral'];

export const CONTACTS: Contact[] = PEOPLE.map(([name, handle, title, company], i) => ({
    id: handle,
    name,
    email: `${handle}@${DOMAINS[company]}`,
    color: COLORS[i % COLORS.length]!,
    title,
    company: company || undefined,
}));

const SERVICES: Contact[] = [
    { id: 'github', name: 'GitHub', email: 'notifications@github.com', color: 'neutral', company: 'GitHub' },
    { id: 'linear', name: 'Linear', email: 'notifications@linear.app', color: 'primary', company: 'Linear' },
    { id: 'figma', name: 'Figma', email: 'no-reply@figma.com', color: 'accent', company: 'Figma' },
    { id: 'stripe', name: 'Stripe', email: 'receipts@stripe.com', color: 'info', company: 'Stripe' },
    { id: 'airline', name: 'Nordic Air', email: 'booking@nordicair.com', color: 'info', company: 'Nordic Air' },
    { id: 'news', name: 'The Frontend Weekly', email: 'hello@frontendweekly.dev', color: 'warning', company: 'Frontend Weekly' },
    { id: 'shop', name: 'Kinfolk Supply', email: 'orders@kinfolk.shop', color: 'success', company: 'Kinfolk Supply' },
    { id: 'social', name: 'Mastodon', email: 'notifications@mastodon.social', color: 'accent', company: 'Mastodon' },
    { id: 'meetup', name: 'Meetup', email: 'info@meetup.com', color: 'error', company: 'Meetup' },
];

/** mulberry32 — a tiny seeded PRNG, so every reload shows the same mailbox. */
function rng(seed: number): () => number {
    let a = seed;
    return () => {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

interface Template {
    subject: string;
    from: 'person' | string;
    category: Category;
    labels?: LabelId[];
    body: string[];
    reply?: string[];
    attachments?: Attachment[];
    important?: boolean;
}

const TEMPLATES: Template[] = [
    {
        subject: 'Design review: new onboarding flow', from: 'person', category: 'primary', labels: ['work', 'design'], important: true,
        body: [
            'Hey Alex,',
            'I pushed the latest onboarding screens to the shared file. The biggest change is the progressive disclosure on step two — we now ask for the workspace name only after the user has picked a template, which cut the drop-off in the prototype test from 31% to 18%.',
            'Could you take a look before Thursday\'s review? I\'d especially love your take on the empty states and whether the illustration style still fits the rest of the product.',
            'Thanks!',
        ],
        reply: ['Looks great — the template-first ordering makes a lot of sense. Left a few comments on the empty states; mostly about the copy length on mobile.', 'Happy to pair on it tomorrow if that helps.'],
        attachments: [{ name: 'onboarding-v4.fig', size: 18_400_000, kind: 'image' }, { name: 'test-notes.pdf', size: 412_000, kind: 'pdf' }],
    },
    {
        subject: 'Q3 planning — draft roadmap', from: 'person', category: 'primary', labels: ['work'], important: true,
        body: [
            'Hi team,',
            'Attached is the first draft of the Q3 roadmap. Three themes: reliability (the sync engine rewrite), onboarding, and the design system migration.',
            'Please add comments directly in the doc by Friday. I\'ll consolidate everything over the weekend so we can walk through it together on Monday.',
            'Best, Priya',
        ],
        attachments: [{ name: 'Q3-roadmap-draft.pdf', size: 1_240_000, kind: 'pdf' }],
    },
    {
        subject: 'Re: the virtual list regression', from: 'person', category: 'primary', labels: ['work'],
        body: [
            'Found it. The measured row heights were keyed by index instead of by id, so a prepend shifted every cached size by one row.',
            'Switching the cache key to the message id fixes the jump, and the scroll position now survives "load earlier" in all three engines. PR is up, would appreciate a second pair of eyes.',
        ],
        reply: ['Nice catch! Reviewing now.'],
    },
    {
        subject: 'Invoice #2024-118', from: 'person', category: 'primary', labels: ['finance'],
        body: ['Hi Alex,', 'Please find attached the invoice for September\'s bookkeeping. Payment is due within 30 days.', 'Kind regards,', 'Olivia'],
        attachments: [{ name: 'invoice-2024-118.pdf', size: 88_000, kind: 'pdf' }],
    },
    {
        subject: 'Lunch on Friday?', from: 'person', category: 'primary', labels: ['personal'],
        body: ['Are you around on Friday? There\'s a new ramen place near the office that everyone keeps talking about. 12:30?'],
        reply: ['Yes! 12:30 works. I\'ll book a table for four.'],
    },
    {
        subject: 'Your trip to Lisbon — booking confirmed', from: 'airline', category: 'primary', labels: ['travel'], important: true,
        body: [
            'Your booking is confirmed. Booking reference: NX7Q2L.',
            'Outbound: Stockholm Arlanda (ARN) → Lisbon (LIS), 14 Oct, 07:25–11:10.',
            'Return: Lisbon (LIS) → Stockholm Arlanda (ARN), 20 Oct, 18:40–00:15.',
            'Check-in opens 24 hours before departure. Have a pleasant journey!',
        ],
        attachments: [{ name: 'e-ticket-NX7Q2L.pdf', size: 204_000, kind: 'pdf' }],
    },
    {
        subject: 'Hotel options for the offsite', from: 'person', category: 'primary', labels: ['travel', 'work'],
        body: [
            'Hi Alex,',
            'As requested, here are three hotels within walking distance of the venue. All of them have a meeting room we can use for the breakout sessions.',
            'The second one has the best reviews but is slightly over budget — let me know and I\'ll hold the rooms.',
            'Bien à vous, Chloé',
        ],
        attachments: [{ name: 'hotel-shortlist.pdf', size: 2_100_000, kind: 'pdf' }, { name: 'venue-map.png', size: 640_000, kind: 'image' }],
    },
    {
        subject: '[zero] PR #412: Tabs indicator slides under RTL', from: 'github', category: 'primary', labels: ['work'],
        body: ['kenji-w requested your review on this pull request.', 'The indicator now measures logical offsets, so it lands on the active tab in both directions. Adds an RTL e2e case per skin.', '4 files changed, +128 −31'],
    },
    {
        subject: 'ENG-2291 moved to In Review', from: 'linear', category: 'primary', labels: ['work'],
        body: ['Jonas Berg moved ENG-2291 "Sync engine: retry with jittered backoff" from In Progress to In Review.'],
    },
    {
        subject: 'Maya mentioned you in "Mail client — v2"', from: 'figma', category: 'social', labels: ['design'],
        body: ['Maya Chen mentioned you in a comment:', '"@Alex does the reading pane header still work at 1280? I think the actions wrap."'],
    },
    {
        subject: 'Your receipt from Brightwave', from: 'stripe', category: 'primary', labels: ['finance'],
        body: ['Receipt #1934-2210', 'Brightwave Pro — annual plan: $240.00', 'Paid with Visa ending 4242.'],
        attachments: [{ name: 'receipt-1934-2210.pdf', size: 52_000, kind: 'pdf' }],
    },
    {
        subject: 'Issue 214: CSS anchor positioning is here', from: 'news', category: 'promotions',
        body: ['This week: anchor positioning ships everywhere, a deep dive into view transitions for SPAs, and why your design tokens need a grammar.', 'Plus: 12 jobs, 3 conferences and one very opinionated take on CSS resets.'],
    },
    {
        subject: '20% off everything this weekend', from: 'shop', category: 'promotions',
        body: ['Our autumn collection just landed. Use code AUTUMN20 at checkout for 20% off everything, through Sunday.', 'Free shipping on orders over $50.'],
    },
    {
        subject: 'New followers and 3 boosts', from: 'social', category: 'social',
        body: ['You have 4 new followers since last week.', 'Your post "Design systems are data" was boosted 3 times.'],
    },
    {
        subject: 'Design Systems Stockholm — October meetup', from: 'meetup', category: 'social', labels: ['design'],
        body: ['A new event was announced: "Tokens all the way down" — 17 Oct, 18:00, at Northwind\'s office.', '42 people are going. RSVP to save your spot.'],
    },
    {
        subject: 'Photos from the weekend', from: 'person', category: 'primary', labels: ['personal'],
        body: ['Finally went through the photos from the lake! The light on Saturday evening was unreal.', 'I picked my favourites — the full set is in the shared album.'],
        attachments: [{ name: 'lake-01.jpg', size: 3_400_000, kind: 'image' }, { name: 'lake-02.jpg', size: 2_900_000, kind: 'image' }, { name: 'lake-03.jpg', size: 3_100_000, kind: 'image' }],
    },
    {
        subject: 'Contract renewal for next year', from: 'person', category: 'primary', labels: ['finance'],
        body: ['Hi Alex,', 'The lease comes up for renewal in December. I\'d like to keep the rent unchanged if you\'re happy to sign for another two years.', 'Let me know and I\'ll send over the paperwork.', 'Tom'],
        attachments: [{ name: 'lease-renewal.docx', size: 96_000, kind: 'doc' }],
    },
    {
        subject: 'Intro: Alex ↔ Elena (Vector Capital)', from: 'person', category: 'primary', labels: ['work'], important: true,
        body: ['Alex, meet Elena — she leads developer tooling investments at Vector and has been following Zero for a while.', 'Elena, meet Alex — one of the engineers behind the design-system compiler. I\'ll let you two take it from here!'],
        reply: ['Thanks for the intro! Elena, great to meet you — would a call next Tuesday or Wednesday work?'],
    },
    {
        subject: 'Security review: token rotation', from: 'person', category: 'primary', labels: ['work'], important: true,
        body: ['We\'re rotating all deploy tokens on Monday at 09:00 CET. Services should pick up the new secrets automatically; if anything in your area reads them at build time, please let me know before Friday.', 'Checklist attached.'],
        attachments: [{ name: 'rotation-checklist.pdf', size: 144_000, kind: 'pdf' }],
    },
    {
        subject: 'Interview availability — Senior Frontend role', from: 'person', category: 'primary', labels: ['work'],
        body: ['Hi Alex,', 'Thanks again for helping out with the loop. Could you share two or three slots next week for the system design interview (60 minutes)?', 'Best, Sofia'],
    },
    {
        subject: 'Dataset for the ranking experiment', from: 'person', category: 'primary', labels: ['work'],
        body: ['Here\'s the cleaned export — 1.2M rows, deduplicated by thread. The notebook explains the sampling; ping me if the schema needs changes.'],
        attachments: [{ name: 'ranking-sample.csv.zip', size: 48_000_000, kind: 'zip' }, { name: 'schema.xlsx', size: 34_000, kind: 'sheet' }],
    },
    {
        subject: 'Mum\'s birthday 🎂', from: 'person', category: 'primary', labels: ['personal'],
        body: ['Don\'t forget it\'s Mum\'s birthday on Sunday! I was thinking we could all chip in for the pottery class she keeps mentioning. You in?'],
        reply: ['Absolutely in. Send me the link and I\'ll transfer my share tonight.'],
    },
    {
        subject: 'Weekly metrics digest', from: 'person', category: 'primary', labels: ['work'],
        body: ['Weekly actives are up 6.4% week over week. Time-to-first-message dropped to 41 seconds after the onboarding change shipped.', 'Full dashboard linked in the doc.'],
    },
    {
        subject: 'Photo shoot quote', from: 'person', category: 'primary', labels: ['design'],
        body: ['Hi! Thanks for reaching out. For a half-day shoot of the team plus product flat-lays, I\'d quote €1,400 including editing. I have availability in the first two weeks of November.'],
    },
];

const SPAM: Template[] = [
    { subject: 'You have (1) unclaimed reward!!!', from: 'person', category: 'primary', body: ['Congratulations! Click here to claim your prize before it expires.'] },
    { subject: 'Urgent: verify your account now', from: 'person', category: 'primary', body: ['We detected unusual activity. Verify immediately or your account will be suspended.'] },
];

const DAY = 86_400_000;

export function createMailbox(seed = 7, now = Date.now()): Thread[] {
    const r = rng(seed);
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
    const threads: Thread[] = [];
    let n = 0;

    const sender = (t: Template): Contact => (t.from === 'person' ? pick(CONTACTS) : SERVICES.find((s) => s.id === t.from)!);

    const make = (t: Template, folder: FolderId, age: number): Thread => {
        const id = `t${++n}`;
        const from = sender(t);
        const date = now - age;
        const messages: Message[] = [];
        const others = CONTACTS.filter((c) => c !== from);
        const cc = r() < 0.25 ? [pick(others)] : [];
        messages.push({ id: `${id}-m1`, from, to: [ME], cc, date, body: t.body, attachments: t.attachments ?? [] });
        if (t.reply && folder !== 'spam') {
            const replyDate = date + (0.1 + r() * 0.4) * Math.min(age, DAY);
            messages.push({ id: `${id}-m2`, from: ME, to: [from], cc, date: replyDate, body: t.reply, attachments: [] });
            if (r() < 0.5) {
                messages.push({
                    id: `${id}-m3`, from, to: [ME], cc, date: replyDate + (age - (replyDate - date)) * 0.5,
                    body: [pick(['Perfect, thank you!', 'Sounds good — talk then.', 'Great, I\'ll follow up with details.', 'Got it, thanks for the quick reply.'])],
                    attachments: [],
                });
            }
        }
        const unreadChance = age < 2 * DAY ? 0.6 : age < 10 * DAY ? 0.2 : 0.03;
        return {
            id,
            subject: t.subject,
            folder,
            category: t.category,
            labels: t.labels ?? [],
            messages,
            read: folder === 'sent' || folder === 'drafts' ? true : r() >= unreadChance,
            starred: r() < (t.important ? 0.4 : 0.08),
            important: !!t.important,
            snoozedUntil: folder === 'snoozed' ? now + (1 + Math.floor(r() * 6)) * DAY : undefined,
        };
    };

    // The inbox: ~220 threads over the last ~120 days, denser recently.
    for (let i = 0; i < 220; i++) {
        const t = TEMPLATES[i % TEMPLATES.length]!;
        const age = Math.pow(r(), 2.2) * 120 * DAY + r() * 3_600_000;
        threads.push(make(t, 'inbox', age));
    }
    for (let i = 0; i < 90; i++) threads.push(make(pick(TEMPLATES), 'archive', (5 + r() * 300) * DAY));
    for (let i = 0; i < 6; i++) threads.push(make(pick(TEMPLATES), 'snoozed', r() * 10 * DAY));
    for (let i = 0; i < 9; i++) threads.push(make(pick(SPAM), 'spam', r() * 20 * DAY));
    for (let i = 0; i < 12; i++) threads.push(make(pick(TEMPLATES), 'trash', r() * 25 * DAY));

    // Sent: things Alex wrote.
    const SENT: [string, string[]][] = [
        ['Re: Q3 planning — draft roadmap', ['Left comments on the sync engine section — I think we can fold the retry work into the first milestone.']],
        ['Slides from today\'s demo', ['Here are the slides from the demo. The recording will follow once it has processed.']],
        ['Quick question about the API', ['Is the pagination cursor stable across deletes, or should the client refetch from the start?']],
        ['Thanks!', ['Thanks for all the help this week — the release went out smoothly.']],
        ['Re: Interview availability', ['Tuesday 10:00, Wednesday 14:00 or Thursday 09:00 all work for me.']],
    ];
    SENT.forEach(([subject, body], i) => {
        const to = pick(CONTACTS);
        const id = `t${++n}`;
        threads.push({
            id, subject, folder: 'sent', category: 'primary', labels: [], read: true, starred: false, important: false,
            messages: [{ id: `${id}-m1`, from: ME, to: [to], cc: [], date: now - (i * 2.3 + 0.2) * DAY, body, attachments: [] }],
        });
    });
    // One draft in progress.
    {
        const id = `t${++n}`;
        threads.push({
            id, subject: 'Offsite agenda (draft)', folder: 'drafts', category: 'primary', labels: ['work'], read: true, starred: false, important: false,
            messages: [{ id: `${id}-m1`, from: ME, to: [CONTACTS[2]!], cc: [], date: now - 0.3 * DAY, body: ['Day 1: roadmap, retro, team dinner.', 'Day 2: hack day — pick a gap in zero and build it.'], attachments: [] }],
        });
    }
    return threads;
}

/** A short plain-text preview of a thread's latest message. */
export function snippet(thread: Thread): string {
    const last = thread.messages[thread.messages.length - 1]!;
    return last.body.filter((p) => p.length > 12).join(' ').slice(0, 160) || last.body.join(' ');
}

export function initials(name: string): string {
    return name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

export function lastDate(thread: Thread): number {
    return thread.messages[thread.messages.length - 1]!.date;
}

/** Correspondents shown in the list: everyone but me, first-seen order. */
export function participants(thread: Thread): Contact[] {
    const seen = new Map<string, Contact>();
    for (const m of thread.messages) if (m.from.id !== ME.id) seen.set(m.from.id, m.from);
    if (seen.size === 0) for (const c of thread.messages[0]!.to) seen.set(c.id, c);
    return [...seen.values()];
}

export const ALL_CONTACTS: Contact[] = [...CONTACTS, ...SERVICES];
