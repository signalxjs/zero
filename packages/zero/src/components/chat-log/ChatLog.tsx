/**
 * ChatLog — the transcript container around `Chat` rows.
 *
 * ```tsx
 * // A scroll box needs a definite height: size it through its container
 * // (a sized grid cell, as here) or a `class` — no zero part takes `style`.
 * <div style="display: grid; block-size: 24rem">
 *     <ChatLog.Root label="Conversation with Ada">
 *         <ChatLog.Content>
 *             {state.messages.map((m) => (
 *                 <Chat.Root key={m.id} placement={m.mine ? 'end' : 'start'}>
 *                     <Chat.Bubble>{m.text}</Chat.Bubble>
 *                 </Chat.Root>
 *             ))}
 *         </ChatLog.Content>
 *         <ChatLog.JumpTrigger />
 *     </ChatLog.Root>
 * </div>
 * ```
 *
 * The root is a `role="log"` scroll box (`aria-live="polite"`,
 * `aria-relevant="additions"`, a keyboard stop named by `label`) that
 * follows its tail: an appended row, or a last row streaming text, keeps
 * the end in view. Scrolling up — or the wheel or touch gesture about to —
 * lets go, and the jump trigger appears; scrolling back to the end, or the
 * trigger, follows again. While the reader is up in the history, rows
 * prepended above ("load earlier") leave the row being read where it was.
 * The behavior is `createStickToBottom`, the same rules `createVirtualList`
 * follows its tail by — a transcript too long to render whole windows its
 * rows with that instead, inside a `role="log"` of its own.
 *
 * Whether it follows is the root's named model, `model:following`
 * (`defaultFollowing` true, `followingChange`): the reader's scroll writes
 * it, and the app can too — setting it true jumps to the end.
 *
 * Opt-in: a `Chat` row does not need a ChatLog, and renders the same inside
 * one.
 */
import { component, compound, defineInjectable, defineProvide, watch } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, namedModel } from '../../behaviors/controllable.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { createStickToBottom } from '../../behaviors/stick-to-bottom.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { chatLogAnatomy } from './anatomy.js';

const SCOPE = chatLogAnatomy.scope;

/** The default name (and text) of the jump trigger. */
const JUMP_LABEL = 'Jump to latest';

interface ChatLogContext {
    /** Following the tail. */
    following(): boolean;
    /** Jump to the end and follow; focus on the trigger moves to the log. */
    jump(): void;
    readonly contentRef: (el: HTMLElement | null) => void;
}

export const useChatLogContext = defineInjectable<ChatLogContext>(() => ({
    following: () => true,
    jump: () => {},
    contentRef: () => {},
}));

// ── Root ──

export type ChatLogRootProps =
    /** The log's accessible name (its `aria-label`). */
    & Define.Prop<'label', string, false>
    /** Distance from the end, in px, that still counts as AT the end. Default 24. */
    & Define.Prop<'threshold', number, false>
    /**
     * Whether the log follows its tail. The reader's scroll writes it
     * (false on scrolling up, true on reaching the end); writing true jumps
     * to the end.
     */
    & Define.Model<'following', boolean>
    & Define.Prop<'defaultFollowing', boolean, false>
    & Define.Event<'followingChange', boolean>
    & WithVariantAxes<'chat-log'>
    & WithClass
    /** Not `role`: the root is the `log`. */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Slot<'default'>;

const ChatLogRoot = component<ChatLogRootProps>(({ props, slots, emit, signal, onMounted }) => {
    const following = createControllableState<boolean>(
        () => namedModel<boolean>(props.following),
        props.defaultFollowing ?? true,
        (v) => emit('followingChange', v),
    );
    const tail = createStickToBottom({ state: following, threshold: () => props.threshold ?? 24 });
    const focus = signal({ visible: false });
    let el: HTMLElement | null = null;

    // Following again — the reader reaching the end, the trigger, or the
    // app writing the model — puts the end in view. A microtask: a write
    // flushes the render synchronously, so the DOM is current by then.
    watch(() => tail.following(), (on) => {
        if (on) queueMicrotask(() => tail.pin());
    });
    onMounted(() => tail.pin());

    const ctx: ChatLogContext = {
        following: () => tail.following(),
        jump: () => {
            // Only the trigger's own focus moves: it is about to be hidden,
            // and focus it held would drop to <body>. The log itself is the
            // nearest stop that stays. Focus anywhere else — a link in a row,
            // an app calling jump() — is left where it is.
            const active = typeof document !== 'undefined' ? document.activeElement : null;
            const triggerHadFocus = !!el && !!active
                && active.matches(`[data-scope="${SCOPE}"][data-part="jump-trigger"]`)
                && active.closest(`[data-scope="${SCOPE}"][data-part="root"]`) === el;
            tail.scrollToEnd();
            if (triggerHadFocus) el?.focus({ preventScroll: true });
        },
        contentRef: tail.contentRef,
    };
    defineProvide(useChatLogContext, () => ctx);
    // One ref for the component's life: an inline arrow is a new ref every
    // render, which detaches and re-attaches the behavior (and forgets the
    // reading anchor) on each one.
    const rootRef = (node: HTMLElement | null): void => {
        el = node;
        tail.viewportRef(node);
    };

    return () => {
        const attrs = htmlAttrs(props);
        return (
            <div
                {...attrs}
                role="log"
                aria-live="polite"
                aria-relevant="additions"
                aria-label={props.label ?? attrs['aria-label']}
                tabIndex={0}
                data-scope={SCOPE}
                data-part="root"
                data-focus-visible={dataAttr(focus.visible)}
                {...variantAttrs(props)}
                class={props.class}
                ref={rootRef}
                onFocus={(e: FocusEvent) => {
                    // The root's OWN focus only — a focusable inside a row
                    // (a link, the jump trigger) bubbles here too and is not
                    // the scroll box's ring.
                    focus.visible = e.target === el && isFocusVisible(el);
                }}
                onBlur={() => { focus.visible = false; }}
            >
                {slots.default?.()}
            </div>
        );
    };
}, { name: 'ChatLog.Root' });

// ── Content ──

export type ChatLogContentProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

const ChatLogContent = component<ChatLogContentProps>(({ props, slots }) => {
    const ctx = useChatLogContext();
    return () => (
        <div {...htmlAttrs(props)} data-scope={SCOPE} data-part="content" class={props.class} ref={ctx.contentRef}>
            {slots.default?.()}
        </div>
    );
}, { name: 'ChatLog.Content' });

// ── JumpTrigger ──

export type ChatLogJumpTriggerProps =
    /** Its accessible name — and its text, with no children. Default "Jump to latest". */
    & Define.Prop<'label', string, false>
    & WithClass
    & WithHtmlAttrs
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const ChatLogJumpTrigger = component<ChatLogJumpTriggerProps>(({ props, slots, signal }) => {
    const ctx = useChatLogContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({ getElement: () => el, isDisabled: () => false });

    const bag = (): PartProps => {
        const attrs = htmlAttrs(props);
        const open = !ctx.following();
        return {
            ...attrs,
            'aria-label': props.label ?? attrs['aria-label'] ?? JUMP_LABEL,
            'data-scope': SCOPE,
            'data-part': 'jump-trigger',
            'data-state': stateAttr(open, 'open', 'closed'),
            'data-focus-visible': dataAttr(focus.visible),
            hidden: !open,
            onClick: () => ctx.jump(),
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
            <button type="button" class={props.class} {...b}>
                {slots.default?.(b) ?? props.label ?? JUMP_LABEL}
            </button>
        );
    };
}, { name: 'ChatLog.JumpTrigger' });

export const ChatLog = compound(ChatLogRoot, {
    Root: ChatLogRoot,
    Content: ChatLogContent,
    JumpTrigger: ChatLogJumpTrigger,
});
