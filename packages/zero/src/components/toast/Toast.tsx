/**
 * Toast — transient notifications from an imperative queue.
 *
 * ```tsx
 * <Toast.Viewport placement="bottom-end" />   // once, near the app root
 * toast({ title: 'Saved', color: 'success' }) // from anywhere, browser-only
 * ```
 *
 * Or compose per toast:
 * ```tsx
 * <Toast.Viewport>
 *     {(t) => (
 *         <Toast.Root toast={t} key={t.id}>
 *             <Toast.Title>{t.title}</Toast.Title>
 *             <Toast.Close>Dismiss</Toast.Close>
 *         </Toast.Root>
 *     )}
 * </Toast.Viewport>
 * ```
 *
 * Presence is runtime-managed — the one deliberate exception to zero's
 * "presence is declarative CSS" rule, because toasts must eventually
 * UNMOUNT (popups never do). A toast enters `closed` and flips to `open` a
 * frame later; `dismiss()` flips it back and the root stays mounted until
 * its longest transition/animation finishes (instantly when there is none,
 * reduced motion included). Recipes therefore style the plain two-state
 * transition and must NOT use `@starting-style`/`allow-discrete` here.
 *
 * The viewport is a `popover="manual"` top layer: no z-index, no portal, no
 * light dismiss, and it stays out of the way when empty. Placement is data
 * (`data-placement` on viewport and root); stacking is data too —
 * `--toast-index` / `--toast-count` on each root.
 */
import { component, compound, defineInjectable, defineProvide, effect, watch } from 'sigx';
import type { Define } from 'sigx';
import { createId } from '../../behaviors/create-id.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithDisabled, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { toastAnatomy } from './anatomy.js';
import { createToaster, useToaster, type Toaster, type ToastData } from './toaster.js';
import { mountScope } from '../../behaviors/mount-scope.js';

const SCOPE = toastAnatomy.scope;

export type ToastPlacement =
    | 'top-start' | 'top' | 'top-end'
    | 'bottom-start' | 'bottom' | 'bottom-end';

interface ToastViewportContext {
    toaster(): Toaster;
    placement(): ToastPlacement;
    /** Before a root leaves: move focus out of it, if it holds focus. */
    handOffFocus(root: HTMLElement): void;
    /**
     * Speak through the viewport's assertive live channel. The text is read
     * a frame later, once the re-render it follows has reached the DOM.
     */
    announce(read: () => string): void;
}

function makeInertViewport(): ToastViewportContext {
    let inert: Toaster | null = null;
    return {
        toaster: () => (inert ??= createToaster()),
        placement: () => 'bottom-end',
        handOffFocus: () => {},
        announce: () => {},
    };
}

const nextFrame: (cb: () => void) => void =
    typeof requestAnimationFrame === 'function'
        ? (cb) => requestAnimationFrame(() => cb())
        : (cb) => void setTimeout(cb, 16);

interface ToastItemContext {
    toast(): ToastData;
    ids: { title: string; description: string };
    dismiss(): void;
    /** Title/Description report their presence so the root's ARIA refs never dangle. */
    setTitlePresent(present: boolean): void;
    setDescriptionPresent(present: boolean): void;
}

function makeInertItem(): ToastItemContext {
    return {
        toast: () => ({ id: 'zx-toast-inert', open: false, role: 'status', duration: Infinity }),
        ids: { title: 'zx-toast-inert-title', description: 'zx-toast-inert-desc' },
        dismiss: () => {},
        setTitlePresent: () => {},
        setDescriptionPresent: () => {},
    };
}

export const useToastViewportContext = defineInjectable<ToastViewportContext>(() => makeInertViewport());
export const useToastItemContext = defineInjectable<ToastItemContext>(() => makeInertItem());

/** Longest computed transition/animation on the element, in ms. */
function longestAnimationMs(el: Element): number {
    if (typeof getComputedStyle !== 'function') return 0;
    const style = getComputedStyle(el);
    const times = (value: string): number[] =>
        value.split(',').map((raw) => {
            const s = raw.trim();
            if (s.endsWith('ms')) return parseFloat(s) || 0;
            if (s.endsWith('s')) return (parseFloat(s) || 0) * 1000;
            return 0;
        });
    const longest = (durations: string, delays: string): number => {
        const d = times(durations || '0s');
        const dl = times(delays || '0s');
        return Math.max(0, ...d.map((v, i) => v + (dl[i % dl.length] ?? 0)));
    };
    return Math.max(
        longest(style.transitionDuration, style.transitionDelay),
        longest(style.animationDuration, style.animationDelay),
    );
}

/**
 * Sigx passes function children through uncalled (the same reason
 * `renderAsChild` exists): the slot accessor yields the raw function child,
 * which must then be called with the scoped toast.
 */
function renderToastSlot(slot: (data: ToastData) => unknown, data: ToastData): unknown {
    const out = slot(data);
    if (out == null) return null;
    const items = Array.isArray(out) ? out : [out];
    const rendered = items.map((item) => (typeof item === 'function' ? (item as (d: ToastData) => unknown)(data) : item));
    return rendered.length === 1 ? rendered[0] : rendered;
}

// ── Viewport ──

const ROOT_SELECTOR = `[data-scope="${SCOPE}"][data-part="root"]`;
const DEFAULT_HOTKEY: readonly string[] = ['F8'];
const DEFAULT_LABEL = 'Notifications ({hotkey})';
const MODIFIER_KEYS = new Set(['altKey', 'ctrlKey', 'metaKey', 'shiftKey']);

/** `['altKey', 'KeyT']` reads "alt+T"; `['F8']` reads "F8". */
function hotkeyText(keys: readonly string[]): string {
    return keys.join('+').replace(/Key|Digit/g, '');
}

/**
 * The viewport's accessible name. `{hotkey}` in the template is replaced by
 * the hotkey; with the hotkey off, a ` ({hotkey})` suffix is dropped
 * (and any bare placeholder with it), so the default reads "Notifications".
 */
function viewportLabel(template: string, keys: readonly string[] | null): string {
    if (keys) return template.replace(/\{hotkey\}/g, hotkeyText(keys));
    return template.replace(/\s*\(\{hotkey\}\)/g, '').replace(/\{hotkey\}/g, '').trim();
}

/** Every key in the combination is down: modifiers by flag, the rest by `code` or `key`. */
function matchesHotkey(e: KeyboardEvent, keys: readonly string[]): boolean {
    return keys.every((k) =>
        MODIFIER_KEYS.has(k) ? !!(e as unknown as Record<string, boolean>)[k] : e.code === k || e.key === k);
}

export type ToastViewportProps =
    & Define.Prop<'placement', ToastPlacement, false>
    /**
     * The region's accessible name, as a template: `{hotkey}` becomes the
     * hotkey ("Notifications ({hotkey})" by default, which reads
     * "Notifications (F8)"). With `hotkey={false}` a ` ({hotkey})` suffix
     * is dropped.
     */
    & Define.Prop<'label', string, false>
    /**
     * Keys that move focus to the first toast from anywhere in the document
     * — all down at once, modifiers named by their event flag
     * (`['altKey', 'KeyT']`), others by `KeyboardEvent.code` or `key`.
     * `['F8']` by default; `false` turns it off.
     */
    & Define.Prop<'hotkey', readonly string[] | false, false>
    & Define.Prop<'toaster', Toaster, false>
    & WithClass
    /** Not `role`: the viewport is a named `region` landmark. */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Slot<'default', ToastData>;

/** What holds the queue's timers: any one of them keeps it paused. */
type Hold = 'hover' | 'focus' | 'visibility' | 'blur';

type PopoverElement = HTMLElement & { showPopover?(): void; hidePopover?(): void };

const ToastViewport = component<ToastViewportProps>(({ props, slots, signal, onMounted, onUnmounted }) => {
    const injected = useToaster();
    const manager = (): Toaster => props.toaster ?? injected;
    const placement = (): ToastPlacement => props.placement ?? 'bottom-end';
    const hotkeys = (): readonly string[] | null => {
        if (props.hotkey === false) return null;
        const keys = props.hotkey ?? DEFAULT_HOTKEY;
        return keys.length > 0 ? keys : null;
    };

    let el: HTMLElement | null = null;
    // The element focus came from when it entered the viewport — where it
    // goes back to when the last toast holding it leaves.
    let returnFocus: HTMLElement | null = null;
    // The assertive channel for `role: 'alert'` toasts. It lives outside the
    // popover, so it is in the accessibility tree before it is filled.
    const live = signal({ text: '' });

    const handOffFocus = (root: HTMLElement): void => {
        if (typeof document === 'undefined') return;
        const active = document.activeElement;
        if (!active || !root.contains(active)) return;
        const roots = el ? Array.from(el.querySelectorAll<HTMLElement>(ROOT_SELECTOR)) : [];
        const at = roots.indexOf(root);
        const staying = (r: HTMLElement): boolean => r !== root && r.getAttribute('data-state') === 'open';
        const next = (at === -1 ? [] : roots.slice(at + 1)).find(staying)
            ?? (at === -1 ? roots : roots.slice(0, at)).reverse().find(staying);
        const back = returnFocus?.isConnected && !el?.contains(returnFocus) ? returnFocus : null;
        for (const target of [next, back, el]) {
            if (!target) continue;
            target.focus({ preventScroll: true });
            if (!root.contains(document.activeElement)) return;
        }
    };

    const announce = (read: () => string): void => {
        // Cleared first and filled a frame later, so the same message twice
        // in a row is still a change the live region reports. The one frame
        // also lets a text change reach the DOM before it is read.
        live.text = '';
        nextFrame(() => {
            const text = read();
            if (text) live.text = text;
        });
    };

    const ctx: ToastViewportContext = { toaster: manager, placement, handOffFocus, announce };
    defineProvide(useToastViewportContext, () => ctx);

    // The viewport pauses the queue while anything holds it: the pointer or
    // focus in it, a hidden document, an unfocused window. `pause()` /
    // `resume()` are one shared flag, not a count: the viewport only avoids
    // resuming when it never paused, so an app's own `pause()` is still
    // released by the viewport's `resume()`.
    const holds = new Set<Hold>();
    // The toaster the hold was taken on, so a `toaster` prop swap mid-hold
    // releases the one that was paused.
    let heldBy: Toaster | null = null;
    let recheck: ReturnType<typeof setTimeout> | null = null;
    const sync = (): void => {
        const want = holds.size > 0;
        if (want === (heldBy != null)) return;
        if (want) {
            heldBy = manager();
            heldBy.pause();
        } else {
            const held = heldBy!;
            heldBy = null;
            held.resume();
        }
    };
    const hold = (reason: Hold, on: boolean): void => {
        if (on) holds.add(reason);
        else holds.delete(reason);
        sync();
    };

    const onVisibility = (): void => hold('visibility', document.visibilityState === 'hidden');
    const onWindowBlur = (): void => hold('blur', true);
    const onWindowFocus = (): void => hold('blur', false);

    const scoped = mountScope();
    onMounted(() => scoped(() => {
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', onVisibility);
            if (document.visibilityState === 'hidden') hold('visibility', true);
        }
        if (typeof window !== 'undefined') {
            window.addEventListener('blur', onWindowBlur);
            window.addEventListener('focus', onWindowFocus);
        }
        // Removing the focused node (closing a toast from its Close button)
        // fires no focusout in Firefox/WebKit/the spec, and Chromium's goes to
        // the detached node, so it never bubbles here: re-read focus after
        // every removal instead (#168).
        // By id, not length: at the cap a removal promotes a queued toast.
        let lastIds = new Set(manager().toasts().map((t) => t.id));
        effect(() => {
            const ids = new Set(manager().toasts().map((t) => t.id));
            const removed = [...lastIds].some((id) => !ids.has(id));
            lastIds = ids;
            if (!removed || heldBy == null) return;
            if (recheck != null) clearTimeout(recheck);
            // After the re-render has detached the removed toast.
            recheck = setTimeout(() => {
                recheck = null;
                // An emptied viewport is hidden: neither the pointer nor
                // focus (handed to the viewport by the last toast) is in it.
                if (manager().count() === 0) {
                    holds.delete('hover');
                    holds.delete('focus');
                }
                const active = typeof document === 'undefined' ? null : document.activeElement;
                if (!(el && active && el.contains(active))) holds.delete('focus');
                sync();
            }, 0);
        });
        // Show while there are toasts, hide when there are none — and when a
        // toast arrives while already showing, re-show: a popover shown
        // earlier sits BELOW a modal dialog opened since, and hide + show is
        // the only way to the top of the top layer. (Its actions stay inert
        // under the modal by spec; the toast is at least seen.)
        let shownIds = new Set<string>();
        effect(() => {
            const ids = manager().toasts().map((t) => t.id);
            const arrived = ids.some((id) => !shownIds.has(id));
            shownIds = new Set(ids);
            const showing = manager().count() > 0;
            const node = el as PopoverElement | null;
            if (!node || typeof node.showPopover !== 'function') return;
            let isShowing: boolean;
            try {
                isShowing = node.matches(':popover-open');
            } catch {
                return; // an engine without the pseudo-class: nothing to stack
            }
            if (showing && !isShowing) node.showPopover();
            else if (!showing && isShowing) node.hidePopover!();
            else if (showing && arrived) {
                // Hiding drops focus from inside the popover; put it back.
                const active = document.activeElement as HTMLElement | null;
                const keep = active && node.contains(active) ? active : null;
                try {
                    node.hidePopover!();
                    node.showPopover();
                } catch { /* already in the requested state */ }
                if (keep && document.activeElement !== keep) keep.focus({ preventScroll: true });
            }
        });
        // The hotkey listens only while there is a toast to reach.
        watch(
            () => manager().count() > 0 && hotkeys() != null,
            (on, _prev, onCleanup) => {
                if (!on || typeof document === 'undefined') return;
                const onKeydown = (e: KeyboardEvent): void => {
                    const keys = hotkeys();
                    if (!keys || e.defaultPrevented || !matchesHotkey(e, keys)) return;
                    const first = el?.querySelector<HTMLElement>(ROOT_SELECTOR);
                    if (!first) return;
                    e.preventDefault();
                    const active = document.activeElement as HTMLElement | null;
                    if (active && active !== document.body && !el!.contains(active)) returnFocus = active;
                    first.focus({ preventScroll: true });
                };
                document.addEventListener('keydown', onKeydown);
                onCleanup(() => document.removeEventListener('keydown', onKeydown));
            },
            { immediate: true },
        );
    }));
    onUnmounted(() => {
        if (recheck != null) clearTimeout(recheck);
        if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
        if (typeof window !== 'undefined') {
            window.removeEventListener('blur', onWindowBlur);
            window.removeEventListener('focus', onWindowFocus);
        }
        holds.clear();
        sync();
    });

    return () => {
        const attrs = htmlAttrs(props);
        return (
            <>
                <ol
                    {...attrs}
                    data-scope={SCOPE}
                    data-part="viewport"
                    data-placement={placement()}
                    popover="manual"
                    role="region"
                    aria-label={viewportLabel(props.label ?? (attrs['aria-label'] != null ? String(attrs['aria-label']) : DEFAULT_LABEL), hotkeys())}
                    // One polite live region for every toast: it exists before
                    // any toast does, so additions to it are announced — a
                    // live region inserted together with its content is not,
                    // reliably. Alert toasts opt out (`aria-live="off"` on
                    // their root) and speak through the assertive channel.
                    aria-live="polite"
                    aria-relevant="additions text"
                    aria-atomic="false"
                    tabIndex={-1}
                    class={props.class}
                    ref={(node: HTMLElement | null) => { el = node; }}
                    onPointerenter={() => hold('hover', true)}
                    onPointerleave={() => hold('hover', false)}
                    onFocusin={(e: FocusEvent) => {
                        if (!holds.has('focus')) {
                            const from = e.relatedTarget as HTMLElement | null;
                            if (from && !el?.contains(from)) returnFocus = from;
                        }
                        hold('focus', true);
                    }}
                    onFocusout={(e: FocusEvent) => {
                        if (!el?.contains(e.relatedTarget as Node | null)) hold('focus', false);
                    }}
                >
                    {manager().toasts().map((t) =>
                        slots.default
                            ? renderToastSlot(slots.default, t)
                            : (
                                <ToastRoot toast={t} key={t.id}>
                                    {t.title ? <ToastTitle>{t.title}</ToastTitle> : null}
                                    {t.description ? <ToastDescription>{t.description}</ToastDescription> : null}
                                    {t.action ? <ToastAction onClick={() => t.action?.onClick?.()}>{t.action.label}</ToastAction> : null}
                                    <ToastClose>✕</ToastClose>
                                </ToastRoot>
                            ))}
                </ol>
                <span data-visually-hidden="" aria-live="assertive" aria-atomic="true">{live.text}</span>
            </>
        );
    };
}, { name: 'Toast.Viewport' });

// ── Root ──

export type ToastRootProps =
    & Define.Prop<'toast', ToastData, true>
    & WithVariantAxes<'toast'>
    & WithClass
    /**
     * Not `role`: a toast is a named `group` inside the viewport's live
     * region; `toast({ role: 'alert' })` routes it to the assertive channel.
     * An app `aria-labelledby`/`aria-describedby` joins the Title's and
     * Description's. The root is focusable, so it is always named: by the
     * Title, else (with no app name) the Description, else "Notification".
     */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Slot<'default'>;

const ToastRoot = component<ToastRootProps>(({ props, slots, signal, onMounted, onUnmounted }) => {
    const viewport = useToastViewportContext();
    const baseId = createId('zx-toast');
    const ids = { title: `${baseId}-title`, description: `${baseId}-desc` };
    // Written from Title/Description setup; the initial render misses the
    // write (it is still executing) but the enter flip re-renders one frame
    // later, before the toast is announced.
    const present = signal({ title: false, description: false });

    let el: HTMLElement | null = null;
    let seenOpen = false;
    let exiting = false;
    let fallbackHandle: ReturnType<typeof setTimeout> | null = null;

    const finish = (): void => {
        if (fallbackHandle != null) clearTimeout(fallbackHandle);
        fallbackHandle = null;
        el?.removeEventListener('transitionend', onEnd);
        el?.removeEventListener('animationend', onEnd);
        // Before the node goes: a focused toast hands focus on, or the
        // removal drops it on <body>.
        if (el) viewport.handOffFocus(el);
        viewport.toaster().remove(props.toast.id);
    };
    // Child transitions bubble the same events — only the root's own count.
    const onEnd = (e: Event): void => { if (e.target === el) finish(); };

    const beginExit = (): void => {
        if (exiting) return;
        exiting = true;
        const node = el;
        if (!node) return finish();
        const total = longestAnimationMs(node);
        if (total <= 0) return finish();
        node.addEventListener('transitionend', onEnd);
        node.addEventListener('animationend', onEnd);
        // The exit must never wedge: whichever of the end event and the
        // computed-duration timeout fires first wins.
        fallbackHandle = setTimeout(finish, total + 50);
    };

    /** What an alert says: its rendered Title and Description, else the queue's text. */
    const alertText = (): string => {
        const text = (part: string): string =>
            el?.querySelector(`[data-scope="${SCOPE}"][data-part="${part}"]`)?.textContent?.trim() ?? '';
        const [title, description] = [text('title'), text('description')].some(Boolean)
            ? [text('title'), text('description')]
            : [props.toast.title?.trim() ?? '', props.toast.description?.trim() ?? ''];
        if (!title || !description) return title || description;
        return `${title}${/[.!?…:]$/.test(title) ? ' ' : '. '}${description}`;
    };

    const scoped = mountScope();
    onMounted(() => scoped(() => {
        effect(() => {
            if (props.toast.open) {
                seenOpen = true;
                return;
            }
            if (seenOpen) beginExit();
        });
        // An alert is not announced by the polite region its root sits in
        // (`aria-live="off"`); it speaks through the viewport's assertive
        // channel instead — once rendered, and again when its text changes.
        effect(() => {
            const t = props.toast;
            if (t.role !== 'alert') return;
            void t.title;
            void t.description;
            void t.data;
            viewport.announce(() => (exiting ? '' : alertText()));
        });
    }));
    onUnmounted(() => {
        if (fallbackHandle != null) clearTimeout(fallbackHandle);
    });

    const ctx: ToastItemContext = {
        toast: () => props.toast,
        ids,
        dismiss: () => viewport.toaster().dismiss(props.toast.id),
        setTitlePresent: (p) => { present.title = p; },
        setDescriptionPresent: (p) => { present.description = p; },
    };
    defineProvide(useToastItemContext, () => ctx);

    const index = (): number => viewport.toaster().toasts().findIndex((t) => t.id === props.toast.id);

    // The queue's per-toast colour is the common path (`toast({ color })`);
    // an explicit prop on a composed root wins over it, and both flow through
    // the shared `variantAttrs` guard rather than a hand-rolled attribute.
    return () => {
        const attrs = htmlAttrs(props);
        // Focusable (the hotkey lands here), so always named: the Title, or
        // — with none and no app name — the Description, or a generic label.
        const appNamed = attrs['aria-label'] != null || attrs['aria-labelledby'] != null;
        const labelByDescription = !present.title && !appNamed && present.description;
        return (
            <li
                {...attrs}
                data-scope={SCOPE}
                data-part="root"
                data-state={stateAttr(props.toast.open, 'open', 'closed')}
                {...variantAttrs({
                    color: props.color ?? props.toast.color,
                    size: props.size,
                    variant: props.variant,
                    axes: props.axes,
                    mods: props.mods,
                })}
                data-placement={viewport.placement()}
                // A named group, focusable for the hotkey and the focus
                // hand-off. Not `status`/`alert`: a live region inserted with
                // its content is announced unreliably, so the always-present
                // viewport is the live region instead.
                role="group"
                aria-live={props.toast.role === 'alert' ? 'off' : undefined}
                tabIndex={-1}
                aria-label={attrs['aria-label'] ?? (!present.title && !appNamed && !present.description ? 'Notification' : undefined)}
                aria-labelledby={[
                    present.title ? ids.title : labelByDescription ? ids.description : undefined,
                    attrs['aria-labelledby'],
                ].filter(Boolean).join(' ') || undefined}
                aria-describedby={[
                    present.description && !labelByDescription ? ids.description : undefined,
                    attrs['aria-describedby'],
                ].filter(Boolean).join(' ') || undefined}
                style={{
                    '--toast-index': String(Math.max(0, index())),
                    '--toast-count': String(viewport.toaster().toasts().length),
                }}
                class={props.class}
                ref={(node: HTMLElement | null) => { el = node; }}
                onKeydown={(e: KeyboardEvent) => {
                    if (e.key !== 'Escape' || e.defaultPrevented) return;
                    e.preventDefault();
                    ctx.dismiss();
                }}
            >
                {slots.default?.()}
            </li>
        );
    };
}, { name: 'Toast.Root' });

// ── Title / Description ──

/** Not `id`: the toast is labelled by the Title's own. */
export type ToastTitleProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const ToastTitle = component<ToastTitleProps>(({ props, slots, onUnmounted }) => {
    const item = useToastItemContext();
    item.setTitlePresent(true);
    onUnmounted(() => item.setTitlePresent(false));
    return () => (
        <div {...htmlAttrs(props)} id={item.ids.title} data-scope={SCOPE} data-part="title" class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'Toast.Title' });

/** Not `id`: the toast is described by the Description's own. */
export type ToastDescriptionProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const ToastDescription = component<ToastDescriptionProps>(({ props, slots, onUnmounted }) => {
    const item = useToastItemContext();
    item.setDescriptionPresent(true);
    onUnmounted(() => item.setDescriptionPresent(false));
    return () => (
        <div {...htmlAttrs(props)} id={item.ids.description} data-scope={SCOPE} data-part="description" class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'Toast.Description' });

// ── Action ──

export type ToastActionProps =
    & Define.Event<'click', MouseEvent>
    & WithDisabled
    & WithClass
    & WithHtmlAttrs
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const ToastAction = component<ToastActionProps>(({ props, slots, emit, signal }) => {
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => !!props.disabled,
    });

    const bag = (): PartProps => ({
        ...htmlAttrs(props),
        'data-scope': SCOPE,
        'data-part': 'action',
        'data-disabled': dataAttr(props.disabled),
        'data-focus-visible': dataAttr(focus.visible),
        onClick: (e: MouseEvent) => {
            if (!props.disabled) emit('click', e);
        },
        onFocus: () => { focus.visible = isFocusVisible(el); },
        onBlur: (e: FocusEvent) => {
            press.onBlur(e);
            focus.visible = false;
        },
        onKeydown: press.onKeydown,
        onKeyup: press.onKeyup,
        onPointerdown: press.onPointerdown,
        onPointerup: press.onPointerup,
        onPointercancel: press.onPointercancel,
        onPointerleave: press.onPointerleave,
        ref: (node: HTMLElement | null) => { el = node; },
    });

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <button type="button" class={props.class} {...b} disabled={props.disabled}>
                {slots.default?.(b)}
            </button>
        );
    };
}, { name: 'Toast.Action' });

// ── Close ──

export type ToastCloseProps =
    /** Accessible name for the close button (default "Close"). */
    & Define.Prop<'label', string, false>
    & WithDisabled
    & WithClass
    & WithHtmlAttrs
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const ToastClose = component<ToastCloseProps>(({ props, slots, signal }) => {
    const item = useToastItemContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => !!props.disabled,
    });

    const bag = (): PartProps => {
        const attrs = htmlAttrs(props);
        return {
            ...attrs,
            'data-scope': SCOPE,
            'data-part': 'close',
            'data-disabled': dataAttr(props.disabled),
            'data-focus-visible': dataAttr(focus.visible),
            // The button's own content is usually a glyph, so it needs a name of
            // its own; "Close" is the conventional one, and `label` (or an app
            // `aria-label`) overrides it (Alert.Close's pattern).
            'aria-label': props.label ?? attrs['aria-label'] ?? 'Close',
            onClick: () => {
                if (!props.disabled) item.dismiss();
            },
            onFocus: () => { focus.visible = isFocusVisible(el); },
            onBlur: (e: FocusEvent) => {
                press.onBlur(e);
                focus.visible = false;
            },
            onKeydown: press.onKeydown,
            onKeyup: press.onKeyup,
            onPointerdown: press.onPointerdown,
            onPointerup: press.onPointerup,
            onPointercancel: press.onPointercancel,
            onPointerleave: press.onPointerleave,
            ref: (node: HTMLElement | null) => { el = node; },
        };
    };

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <button type="button" class={props.class} {...b} disabled={props.disabled}>
                {slots.default?.(b)}
            </button>
        );
    };
}, { name: 'Toast.Close' });

export const Toast = compound(ToastViewport, {
    Viewport: ToastViewport,
    Root: ToastRoot,
    Title: ToastTitle,
    Description: ToastDescription,
    Action: ToastAction,
    Close: ToastClose,
});
