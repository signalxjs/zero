/**
 * Toast manager — the queue behind `<Toast.Viewport>`.
 *
 * Three ways to get one, mirroring the theme controller exactly:
 * `createToaster()` (a factory — apps and tests), `toaster()` (the lazy
 * browser singleton; throws under SSR), and `useToaster` (injectable — a
 * provided instance, else the singleton in the browser and a fresh empty
 * manager per resolution on the server, so requests can never share toasts).
 *
 * The manager owns the data and the timers; presence is the component's job:
 * a toast is created `open: false`, flipped to `open` one frame after it
 * mounts (so the closed→open styles transition), and `dismiss()` flips it
 * back while `<Toast.Root>` keeps the node alive until its exit
 * transition/animation finishes. Timer code never runs on the server —
 * client-only module state, like the dismiss layer stack.
 */
import { defineInjectable, signal } from 'sigx';
import type { ColorValueFor } from '../../contract/vocabulary.js';

export type ToastRole = 'status' | 'alert';

export interface ToastActionData {
    label: string;
    onClick?: () => void;
}

export interface ToastOptions {
    /** Stable identity; creating with an existing id updates that toast. */
    id?: string;
    title?: string;
    description?: string;
    /** Passes through as `data-color` on the toast root. */
    color?: ColorValueFor<'toast'>;
    /** `status` announces politely (default); `alert` interrupts. */
    role?: ToastRole;
    /** Auto-dismiss after this many ms; `Infinity` = sticky. */
    duration?: number;
    /** Data for the stock composition's action button. */
    action?: ToastActionData;
    /** App payload for custom viewport slots. */
    data?: unknown;
}

export interface ToastData {
    readonly id: string;
    /** Presence: false while entering (one frame) and after dismissal. */
    open: boolean;
    title?: string;
    description?: string;
    color?: ColorValueFor<'toast'>;
    role: ToastRole;
    duration: number;
    action?: ToastActionData;
    data?: unknown;
}

export interface ToasterOptions {
    /** Default auto-dismiss duration in ms (5000). */
    duration?: number;
    /** Mounted toasts cap; extras queue FIFO and promote as slots free (5). */
    max?: number;
}

export interface Toaster {
    /** The mounted toasts, oldest first — what a viewport renders. */
    toasts(): readonly ToastData[];
    /** Mounted plus queued. */
    count(): number;
    create(options?: ToastOptions): string;
    update(id: string, options: Partial<ToastOptions>): void;
    /** Begin a toast's exit (all toasts when no id). Removal follows the exit animation. */
    dismiss(id?: string): void;
    /** Drop immediately, no exit — `<Toast.Root>` calls this after the exit plays. */
    remove(id?: string): void;
    /** Suspend auto-dismiss timers, banking the time left on each. */
    pause(): void;
    resume(): void;
}

const isClient = (): boolean => typeof document !== 'undefined';

const nextFrame: (cb: () => void) => void =
    typeof requestAnimationFrame === 'function'
        ? (cb) => requestAnimationFrame(() => cb())
        : (cb) => void setTimeout(cb, 16);

export function createToaster(options: ToasterOptions = {}): Toaster {
    const defaultDuration = options.duration ?? 5000;
    // Clamped: max 0 would admit nothing and queue everything forever.
    const max = Math.max(1, options.max ?? 5);

    const state = signal({ items: [] as ToastData[], queued: 0 });
    // Data-only FIFO for toasts past the cap — not rendered, not reactive;
    // `state.queued` mirrors its length for `count()`.
    const pending: ToastData[] = [];
    const timers = new Map<string, { handle: ReturnType<typeof setTimeout> | null; deadline: number; remaining: number }>();
    let paused = false;
    let serial = 0;

    const find = (id: string): ToastData | undefined =>
        state.items.find((t) => t.id === id) ?? pending.find((t) => t.id === id);

    const disarm = (id: string): void => {
        const timer = timers.get(id);
        if (!timer) return;
        if (timer.handle != null) clearTimeout(timer.handle);
        timers.delete(id);
    };

    const arm = (item: ToastData, ms: number): void => {
        disarm(item.id);
        if (!isClient() || !Number.isFinite(ms)) return;
        if (paused) {
            timers.set(item.id, { handle: null, deadline: 0, remaining: ms });
            return;
        }
        timers.set(item.id, {
            handle: setTimeout(() => dismiss(item.id), ms),
            deadline: Date.now() + ms,
            remaining: ms,
        });
    };

    const admit = (item: ToastData): void => {
        state.items = [...state.items, item];
        arm(item, item.duration);
        if (!isClient()) return;
        // Double rAF: the closed styles must be computed before the flip, or
        // the browser coalesces both frames and no transition plays. Resolve
        // the item through the store — the signal proxies what it holds, and
        // only writes through the proxy are reactive.
        nextFrame(() => nextFrame(() => {
            const live = state.items.find((t) => t.id === item.id);
            if (live) live.open = true;
        }));
    };

    const promote = (): void => {
        while (pending.length > 0 && state.items.length < max) {
            const item = pending.shift()!;
            state.queued = pending.length;
            admit(item);
        }
    };

    const hardRemove = (id: string): void => {
        disarm(id);
        const queuedAt = pending.findIndex((t) => t.id === id);
        if (queuedAt !== -1) {
            pending.splice(queuedAt, 1);
            state.queued = pending.length;
            return;
        }
        if (!state.items.some((t) => t.id === id)) return;
        state.items = state.items.filter((t) => t.id !== id);
        promote();
    };

    const dismiss = (id?: string): void => {
        if (id === undefined) {
            pending.length = 0;
            state.queued = 0;
            // Snapshot the ids — dismissing an unopened toast mutates the list.
            for (const itemId of state.items.map((t) => t.id)) dismiss(itemId);
            return;
        }
        const item = find(id);
        if (!item) return;
        disarm(id);
        // Never shown (still entering, or still queued): nothing to animate.
        if (!item.open) hardRemove(id);
        else item.open = false;
    };

    const update = (id: string, patch: Partial<ToastOptions>): void => {
        const item = find(id);
        if (!item) return;
        if (patch.title !== undefined) item.title = patch.title;
        if (patch.description !== undefined) item.description = patch.description;
        if (patch.color !== undefined) item.color = patch.color;
        if (patch.role !== undefined) item.role = patch.role;
        if (patch.action !== undefined) item.action = patch.action;
        if (patch.data !== undefined) item.data = patch.data;
        if (patch.duration !== undefined) {
            item.duration = patch.duration;
            if (state.items.some((t) => t.id === id)) arm(item, patch.duration);
        }
    };

    const create = (options: ToastOptions = {}): string => {
        if (options.id !== undefined && find(options.id)) {
            update(options.id, options);
            return options.id;
        }
        const item: ToastData = {
            id: options.id ?? `zx-toast-${++serial}`,
            open: false,
            title: options.title,
            description: options.description,
            color: options.color,
            role: options.role ?? 'status',
            duration: options.duration ?? defaultDuration,
            action: options.action,
            data: options.data,
        };
        if (state.items.length >= max) {
            pending.push(item);
            state.queued = pending.length;
        } else {
            admit(item);
        }
        return item.id;
    };

    return {
        toasts: () => state.items,
        count: () => state.items.length + state.queued,
        create,
        update,
        dismiss,
        remove: (id?: string) => {
            if (id === undefined) {
                pending.length = 0;
                state.queued = 0;
                for (const t of state.items) disarm(t.id);
                state.items = [];
                return;
            }
            hardRemove(id);
        },
        pause: () => {
            if (paused) return;
            paused = true;
            for (const timer of timers.values()) {
                if (timer.handle == null) continue;
                clearTimeout(timer.handle);
                timer.handle = null;
                timer.remaining = Math.max(0, timer.deadline - Date.now());
            }
        },
        resume: () => {
            if (!paused) return;
            paused = false;
            for (const [id, timer] of timers) {
                timer.deadline = Date.now() + timer.remaining;
                timer.handle = setTimeout(() => dismiss(id), timer.remaining);
            }
        },
    };
}

let browserToaster: Toaster | null = null;

/**
 * The app-wide toast queue for the BROWSER — import `toast()` and call from
 * anywhere, no provider required. Throws on the server: server code resolves
 * `useToaster()` or passes a `toaster` prop to the viewport instead.
 */
export function toaster(): Toaster {
    if (!isClient()) {
        throw new Error(
            '[zero] toaster() is browser-only. Under SSR, provide a toaster via useToaster or the Toast.Viewport `toaster` prop.',
        );
    }
    return (browserToaster ??= createToaster());
}

/** `toaster().create(options)` — the one-liner. Browser-only, like `toaster()`. */
export function toast(options?: ToastOptions): string {
    return toaster().create(options);
}

/**
 * Inject the nearest provided toaster; falls back to the browser singleton on
 * the client and to a fresh empty manager per resolution on the server.
 */
export const useToaster = defineInjectable<Toaster>(() => (isClient() ? toaster() : createToaster()));
