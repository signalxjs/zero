/**
 * Shell and Split — the full-height frame an app needs and zero's layout tier
 * does not cover (#440): Stack/Row lay out, but nothing claims the viewport,
 * gives a column an independent scroll, renders `<main>` without `asChild`
 * markup, or lets the user resize a pane.
 *
 * ```tsx
 * <Shell.Root>
 *     <Navbar.Root>…</Navbar.Root>
 *     <Shell.Main>
 *         <Split.Root label="Resize message list" model={() => st.listWidth}>
 *             <Split.Pane primary><Shell.Region label="Messages">…</Shell.Region></Split.Pane>
 *             <Split.Handle />
 *             <Split.Pane><Shell.Region label="Reading pane">…</Shell.Region></Split.Pane>
 *         </Split.Root>
 *     </Shell.Main>
 * </Shell.Root>
 * ```
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define, Model } from 'sigx';
import { createControllableState, createInertState, dataAttr, htmlAttrs, isFocusVisible, variantAttrs } from '@sigx/zero';
import type { WithClass, WithHtmlAttrs, WithVariantAxesOpen } from '@sigx/zero';
import { shellAnatomy, splitAnatomy } from './anatomy.js';

// ── Shell ──

export type ShellRootProps = WithVariantAxesOpen<'mail-shell'> & WithClass & WithHtmlAttrs & Define.Slot<'default'>;

const ShellRoot = component<ShellRootProps>(({ props, slots }) => () => (
    <div class={props.class} {...htmlAttrs(props)} data-scope={shellAnatomy.scope} data-part="root" {...variantAttrs(props)}>
        {slots.default?.()}
    </div>
), { name: 'Shell.Root' });

/** The row under the app bar: a docked sidebar beside `<main>`, filling the height left. */
const ShellBody = component<WithClass & WithHtmlAttrs & Define.Slot<'default'>>(({ props, slots }) => () => (
    <div class={props.class} {...htmlAttrs(props)} data-scope={shellAnatomy.scope} data-part="body">
        {slots.default?.()}
    </div>
), { name: 'Shell.Body' });

const ShellMain = component<WithClass & WithHtmlAttrs & Define.Slot<'default'>>(({ props, slots }) => () => (
    <main class={props.class} {...htmlAttrs(props)} data-scope={shellAnatomy.scope} data-part="main">
        {slots.default?.()}
    </main>
), { name: 'Shell.Main' });

export type ShellRegionProps =
    & WithClass
    & WithHtmlAttrs
    /** Names the region landmark. */
    & Define.Prop<'label', string, true>
    & Define.Slot<'default'>;

/** A scrolling column, named as a region landmark. */
const ShellRegion = component<ShellRegionProps>(({ props, slots }) => () => (
    <section class={props.class} {...htmlAttrs(props)} aria-label={props.label} data-scope={shellAnatomy.scope} data-part="region">
        {slots.default?.()}
    </section>
), { name: 'Shell.Region' });

export const Shell = compound(ShellRoot, { Root: ShellRoot, Body: ShellBody, Main: ShellMain, Region: ShellRegion });

// ── Split ──

interface SplitContext {
    size: Model<number>;
    min(): number;
    max(): number;
    label(): string;
    root(): HTMLElement | null;
}

const useSplitContext = defineInjectable<SplitContext>(() => ({
    size: createInertState(320),
    min: () => 0,
    max: () => 0,
    label: () => '',
    root: () => null,
}));

export type SplitRootProps =
    & WithVariantAxesOpen<'mail-split'>
    & WithClass
    & WithHtmlAttrs
    /** Accessible name of the separator. */
    & Define.Prop<'label', string, true>
    /** The primary pane's inline size, in px. */
    & Define.Model<number>
    & Define.Prop<'defaultSize', number, false>
    & Define.Event<'sizeChange', number>
    & Define.Prop<'min', number, false>
    & Define.Prop<'max', number, false>
    /**
     * Below the design system's `md`, which single pane shows. Omitted →
     * both stack (the design system decides). Ignored at `md` and up, where
     * the panes sit side by side.
     */
    & Define.Prop<'show', 'primary' | 'secondary', false>
    & Define.Slot<'default'>;

const SplitRoot = component<SplitRootProps>(({ props, slots, emit }) => {
    const size = createControllableState<number>(() => props.model, props.defaultSize ?? 380, (v) => emit('sizeChange', v));
    let el: HTMLElement | null = null;
    defineProvide(useSplitContext, () => ({
        size,
        min: () => props.min ?? 260,
        max: () => props.max ?? 640,
        label: () => props.label,
        root: () => el,
    }));
    return () => (
        <div
            ref={(node: HTMLElement | null) => { el = node; }}
            class={props.class}
            {...htmlAttrs(props)}
            data-scope={splitAnatomy.scope}
            data-part="root"
            {...variantAttrs(props)}
            data-show={props.show}
            style={{ '--split-size': `${size.value}px` }}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Split.Root' });

export type SplitPaneProps =
    & WithClass
    & WithHtmlAttrs
    /** The pane whose size the model holds; the other takes the rest. */
    & Define.Prop<'primary', boolean, false>
    & Define.Slot<'default'>;

const SplitPane = component<SplitPaneProps>(({ props, slots }) => () => (
    <div
        class={props.class}
        {...htmlAttrs(props)}
        data-scope={splitAnatomy.scope}
        data-part="pane"
        data-primary={props.primary ? '' : undefined}
    >
        {slots.default?.()}
    </div>
), { name: 'Split.Pane' });

const SplitHandle = component<WithClass>(({ props, signal }) => {
    const split = useSplitContext();
    const focus = signal({ visible: false });
    let handle: HTMLElement | null = null;
    let drag: { x: number; from: number; dir: number } | null = null;

    const set = (px: number): void => {
        split.size.value = Math.round(Math.max(split.min(), Math.min(split.max(), px)));
    };
    const direction = (): number =>
        getComputedStyle(split.root() ?? document.documentElement).direction === 'rtl' ? -1 : 1;

    return () => (
        <div
            ref={(el: HTMLElement | null) => { handle = el; }}
            class={props.class}
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-label={split.label()}
            aria-valuenow={split.size.value}
            aria-valuemin={split.min()}
            aria-valuemax={split.max()}
            data-scope={splitAnatomy.scope}
            data-part="handle"
            data-focus-visible={dataAttr(focus.visible)}
            onFocus={(e: FocusEvent) => { focus.visible = isFocusVisible(e.currentTarget as HTMLElement); }}
            onBlur={() => { focus.visible = false; }}
            onPointerdown={(e: PointerEvent) => {
                if (e.button !== 0) return;
                e.preventDefault();
                drag = { x: e.clientX, from: split.size.value, dir: direction() };
                handle?.setPointerCapture(e.pointerId);
            }}
            onPointermove={(e: PointerEvent) => {
                if (drag) set(drag.from + (e.clientX - drag.x) * drag.dir);
            }}
            onPointerup={() => { drag = null; }}
            onPointercancel={() => { drag = null; }}
            onKeydown={(e: KeyboardEvent) => {
                const step = (e.shiftKey ? 64 : 16) * direction();
                const moves: Record<string, number> = {
                    ArrowRight: split.size.value + step,
                    ArrowLeft: split.size.value - step,
                    Home: split.min(),
                    End: split.max(),
                };
                if (e.key in moves) {
                    e.preventDefault();
                    set(moves[e.key]!);
                }
            }}
        />
    );
}, { name: 'Split.Handle' });

export const Split = compound(SplitRoot, { Root: SplitRoot, Pane: SplitPane, Handle: SplitHandle });
