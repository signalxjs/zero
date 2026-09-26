/**
 * Steps — a wizard's step rail.
 *
 * ```tsx
 * <Steps.Root defaultStep="details" label="Checkout">
 *     <Steps.Item value="cart">
 *         <Steps.Indicator>1</Steps.Indicator>
 *         <Steps.Title>Cart</Steps.Title>
 *         <Steps.Separator />
 *     </Steps.Item>
 *     <Steps.Item value="details">
 *         <Steps.Indicator>2</Steps.Indicator>
 *         <Steps.Title>Details</Steps.Title>
 *     </Steps.Item>
 * </Steps.Root>
 * ```
 *
 * The behavior is the promoted ext-stepper pattern verbatim: arrow keys
 * rove focus without changing the step (the Tabs/ToggleGroup convention,
 * here orientation-aware), click/Space/Enter select, one tab stop on the
 * active step, and `complete` derives from registration order — DOM order.
 * See `anatomy.ts` for the promotion notes and the state decisions.
 *
 * `color` on the Root colours the whole rail; `color` on one Item colours
 * that step alone (#112) — the anatomy declares the item re-carries the
 * axis, and the design system's compiled CSS lets the nearest carrier win.
 *
 * The wizard half (#296) needs no app plumbing:
 *
 * ```tsx
 * <Steps.Root defaultStep="cart" linear label="Checkout">
 *     <Steps.Item value="cart"><Steps.Title>Cart</Steps.Title></Steps.Item>
 *     <Steps.Item value="pay" invalid><Steps.Title>Pay</Steps.Title></Steps.Item>
 *     <Steps.Content value="cart">…</Steps.Content>
 *     <Steps.Content value="pay">…</Steps.Content>
 *     <Steps.PrevTrigger>Back</Steps.PrevTrigger>
 *     <Steps.NextTrigger>Next</Steps.NextTrigger>
 * </Steps.Root>
 * ```
 *
 * `Steps.Content` is the active step's panel (`role="region"`, labelled by
 * its step's title; the rest are `hidden`, and root `lazyMount` defers a
 * panel's content until its step has been active once). The triggers step
 * through the enabled items in DOM order and stay focusable, aria-disabled,
 * at a bound. `linear` gates every item past the next reachable one;
 * `invalid` on an item flags the step and adds a visually-hidden
 * `invalidLabel` (", has errors") to its name.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createId, idToken } from '../../behaviors/create-id.js';
import { countPresence, reportPresence, settleAfterMount } from '../../behaviors/part-presence.js';
import { createListController, type ListController, type ListItem } from '../../behaviors/list.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { createRovingKeydown, createRovingTabStop, type RovingTabStop } from '../../behaviors/roving.js';
import { isRtl } from '../../behaviors/direction.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import type { Orientation } from '../../contract/data-attrs.js';
import { renderAsChild, synthesizesClickFrom } from '../../contract/as-child.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithColor, WithDisabled, WithHtmlAttrs, WithOrientation, WithVariantAxes } from '../../contract/props.js';
import { stepsAnatomy } from './anatomy.js';

const SCOPE = stepsAnatomy.scope;

export type StepsPhase = 'active' | 'complete' | 'inactive';

interface StepsContext {
    state: ControllableState<string>;
    list: ListController;
    tabStop: RovingTabStop;
    orientation(): Orientation;
    disabled(): boolean;
    lazyMount(): boolean;
    invalidLabel(): string;
    select(value: string): void;
    keydown(e: KeyboardEvent, value: string): void;
    /** An item mounted or unmounted: the DOM-ordered derivations re-run. */
    changed(): void;
    /** `linear` gating (#296): this item is past the next reachable step. */
    locked(value: string): boolean;
    /** The step Prev (-1) / Next (1) moves to, or undefined at that bound. */
    target(direction: -1 | 1): string | undefined;
    itemId(value: string): string;
    titleId(value: string): string;
    contentId(value: string): string;
    /** The item's `aria-controls`: its content panel, while one is rendered. */
    controls(value: string): string | undefined;
    /** The content's `aria-labelledby`: the step's title, else the item. */
    labelledBy(value: string): string;
    setTitlePresent(value: string, present: boolean): void;
    setContentPresent(value: string, present: boolean): void;
}

interface StepsItemContext {
    value(): string;
    phase(): StepsPhase;
    invalid(): boolean;
}

function makeInert(): StepsContext {
    const list = createListController();
    return {
        state: createInertState<string>(''),
        list,
        tabStop: createRovingTabStop(list),
        orientation: () => 'horizontal',
        disabled: () => false,
        lazyMount: () => false,
        invalidLabel: () => DEFAULT_INVALID_LABEL,
        select: () => {},
        keydown: () => {},
        changed: () => {},
        locked: () => false,
        target: () => undefined,
        itemId: () => '',
        titleId: () => '',
        contentId: () => '',
        controls: () => undefined,
        labelledBy: () => '',
        setTitlePresent: () => {},
        setContentPresent: () => {},
    };
}

const DEFAULT_INVALID_LABEL = ', has errors';

export const useStepsContext = defineInjectable<StepsContext>(() => makeInert());
export const useStepsItemContext = defineInjectable<StepsItemContext>(() => ({
    value: () => '',
    phase: () => 'inactive',
    invalid: () => false,
}));

// ── Root ──

export type StepsRootProps =
    & Define.Model<string>
    & Define.Prop<'defaultStep', string, false>
    & Define.Event<'stepChange', string>
    & Define.Prop<'loop', boolean, false>
    /** Accessible name for the `role="group"` container (`aria-label`). */
    & Define.Prop<'label', string, false>
    /**
     * Linear wizard (#296): only the steps up to the next reachable one can
     * be activated — every later item renders `data-disabled` and
     * `aria-disabled` and ignores click/Enter and the Next trigger, while
     * staying focusable and roved, so its title is still read. Earlier
     * steps stay free: going back is never gated.
     */
    & Define.Prop<'linear', boolean, false>
    /**
     * Render a `Steps.Content` panel's content only once its step has been
     * active; it then stays rendered. The panel element itself always
     * renders, so an item's `aria-controls` never dangles.
     */
    & Define.Prop<'lazyMount', boolean, false>
    /**
     * The visually-hidden text an `invalid` item appends to its accessible
     * name (`aria-invalid` is not allowed on a button). Default
     * `', has errors'`.
     */
    & Define.Prop<'invalidLabel', string, false>
    & WithOrientation
    & WithVariantAxes<'steps'>
    & WithDisabled
    & WithClass
    /** Not `role`: the root is the `group`; `label` or `aria-label` names it. */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Slot<'default'>;

const StepsRoot = component<StepsRootProps>(({ props, slots, emit, onMounted, signal }) => {
    const state = createControllableState<string>(
        () => props.model,
        props.defaultStep ?? '',
        (v) => emit('stepChange', v),
    );
    const list = createListController();
    const tabStop = createRovingTabStop(list);
    const baseId = createId('zx-steps');
    // `version` re-runs every derivation that reads the DOM-ordered item
    // list (registration itself is not reactive): the triggers' bounds and
    // `linear`'s gate. `titles`/`contents` are the part-presence counts
    // behind the IDREFs, optimistic until settled after mount (#169).
    const reg = signal<{ version: number; settled: boolean; titles: Record<string, number>; contents: Record<string, number> }>({
        version: 0,
        settled: false,
        titles: {},
        contents: {},
    });
    onMounted(() => {
        tabStop.settle();
        reg.version++;
    });
    settleAfterMount(onMounted, () => { reg.settled = true; });
    let rootEl: HTMLElement | null = null;
    const orientation = (): Orientation => props.orientation ?? 'horizontal';

    const rtl = (): boolean => isRtl(rootEl);
    const roving = createRovingKeydown({
        list,
        orientation,
        loop: () => props.loop ?? false,
        rtl,
        // Focus moves, the step doesn't: selection is click/Space/Enter only.
        onMove: () => {},
    });

    /**
     * Roving indexes the ENABLED items, where a disabled one is absent — an
     * arrow from it would jump to the first or last step. A disabled asChild
     * item still takes a pointer's focus (tabindex=-1), so its arrows move
     * to the nearest enabled step in the key's direction; past the end they
     * wrap when `loop` is on, else settle on the nearest enabled step
     * behind — never staying on the disabled one. Home/End ignore where
     * they start.
     */
    const keydown = (e: KeyboardEvent, value: string): void => {
        const item = list.items().find((i) => i.value === value);
        if (!item?.disabled()) {
            roving(e, value);
            return;
        }
        const horizontal = orientation() === 'horizontal';
        const [back, forth] = horizontal
            ? (rtl() ? ['ArrowRight', 'ArrowLeft'] : ['ArrowLeft', 'ArrowRight'])
            : ['ArrowUp', 'ArrowDown'];
        if (e.key !== back && e.key !== forth) {
            roving(e, value);
            return;
        }
        const enabled = list.enabledItems();
        if (enabled.length === 0) return;
        e.preventDefault();
        const all = list.items();
        const at = all.indexOf(item);
        const ahead = e.key === forth ? all.slice(at + 1) : all.slice(0, at).reverse();
        const behind = e.key === forth ? all.slice(0, at).reverse() : all.slice(at + 1);
        const wrap = e.key === forth ? enabled[0] : enabled[enabled.length - 1];
        const target = ahead.find((i) => !i.disabled())
            ?? (props.loop ? wrap : behind.find((i) => !i.disabled()));
        target?.el()?.focus();
    };

    /** Registered items in DOM order, re-read whenever one (un)mounts. */
    const ordered = (): ListItem[] => {
        void reg.version;
        return list.items();
    };

    /**
     * The step Prev/Next moves to: the nearest ENABLED item before/after the
     * active one, in DOM order. With no active step, Next is the first
     * enabled item and Prev has nowhere to go. A `linear` lock never makes
     * this skip — the Next target is by definition the next reachable step.
     */
    const target = (direction: -1 | 1): string | undefined => {
        const all = ordered();
        const current = state.value;
        const at = current ? all.findIndex((i) => i.value === current) : -1;
        if (at === -1) return direction === 1 && !current ? all.find((i) => !i.disabled())?.value : undefined;
        const ahead = direction === 1 ? all.slice(at + 1) : all.slice(0, at).reverse();
        return ahead.find((i) => !i.disabled())?.value;
    };

    /**
     * `linear`: an item is locked when it sits AFTER the next reachable step
     * (the Next target, or the active step itself when there is none). At
     * first render the list holds only the items registered so far — this
     * one and those before it — which is exactly enough: an active step not
     * yet registered comes later, so this item is before it and free.
     */
    const locked = (value: string): boolean => {
        if (!props.linear) return false;
        const all = ordered();
        const mine = all.findIndex((i) => i.value === value);
        if (mine === -1) return false;
        const current = state.value;
        const at = current ? all.findIndex((i) => i.value === current) : -1;
        if (current && at === -1) return false;
        const next = target(1);
        const reach = next === undefined ? at : all.findIndex((i) => i.value === next);
        return mine > Math.max(reach, at);
    };

    const itemId = (value: string): string => `${baseId}-item-${idToken(value)}`;
    const titleId = (value: string): string => `${baseId}-title-${idToken(value)}`;
    const contentId = (value: string): string => `${baseId}-content-${idToken(value)}`;

    const ctx: StepsContext = {
        state,
        list,
        tabStop,
        orientation,
        disabled: () => !!props.disabled,
        lazyMount: () => !!props.lazyMount,
        invalidLabel: () => props.invalidLabel ?? DEFAULT_INVALID_LABEL,
        select: (value) => { state.value = value; },
        keydown,
        changed: () => {
            tabStop.changed();
            reg.version++;
        },
        locked,
        target,
        itemId,
        titleId,
        contentId,
        controls: (value) => (!reg.settled || (reg.contents[value] ?? 0) > 0 ? contentId(value) : undefined),
        labelledBy: (value) => (!reg.settled || (reg.titles[value] ?? 0) > 0 ? titleId(value) : itemId(value)),
        setTitlePresent: (value, present) => {
            reg.titles = { ...reg.titles, [value]: countPresence(reg.titles[value] ?? 0, present) };
        },
        setContentPresent: (value, present) => {
            reg.contents = { ...reg.contents, [value]: countPresence(reg.contents[value] ?? 0, present) };
        },
    };
    defineProvide(useStepsContext, () => ctx);

    return () => {
        const attrs = htmlAttrs(props);
        return (
            <div
                {...attrs}
                role="group"
                aria-label={props.label ?? attrs['aria-label']}
                data-scope={SCOPE}
                data-part="root"
                data-orientation={orientation()}
                data-disabled={dataAttr(props.disabled)}
                {...variantAttrs(props)}
                class={props.class}
                ref={(node: HTMLElement | null) => { rootEl = node; }}
            >
                {slots.default?.()}
            </div>
        );
    };
}, { name: 'Steps.Root' });

// ── Item ──

/**
 * The item takes the scope's colour vocabulary for itself (#112) — typed per
 * scope like the Root's, so it narrows under a `/register` module and is
 * `never` where the design system declares no colour axis.
 */
export type StepsItemProps =
    & Define.Prop<'value', string, true>
    & WithColor<'steps'>
    & WithDisabled
    /**
     * The step has errors (#296): `data-invalid` on the item, its indicator
     * and its separator, and the root's visually-hidden `invalidLabel`
     * appended to the item's name. An `asChild` item renders its own
     * element's content, so it adds that text itself.
     */
    & Define.Prop<'invalid', boolean, false>
    & WithClass
    /**
     * Not `id` (the Content is labelled by and controlled from ids the
     * steps generate) or `role` (an asChild item is made a `button`).
     */
    & Omit<WithHtmlAttrs, 'id' | 'role'>
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const StepsItem = component<StepsItemProps>(({ props, slots, onMounted, onUnmounted, signal }) => {
    const steps = useStepsContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });

    const disabled = (): boolean => !!props.disabled || steps.disabled();
    // `linear`'s lock (#296) is not `disabled`: the item stays focusable and
    // roved (its title is still read), it only refuses activation.
    const locked = (): boolean => !disabled() && steps.locked(props.value);
    const inert = (): boolean => disabled() || locked();
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => inert(),
    });

    const item: ListItem = {
        id: `step-${props.value}`,
        get value() { return props.value; },
        disabled: () => disabled(),
        el: () => el,
        textValue: () => el?.textContent?.trim() ?? props.value,
    };
    const unregister = steps.list.register(item);
    onMounted(() => steps.changed());
    onUnmounted(() => {
        unregister();
        steps.changed();
    });

    const phase = (): StepsPhase => {
        const current = steps.state.value;
        // No step set (uncontrolled, no defaultStep): nothing is active and
        // nothing has been walked past — the same "no active step" reading
        // isTabbable takes, which otherwise diverges here into every item
        // claiming complete via the indexOf(-1) path below.
        if (!current) return 'inactive';
        if (props.value === current) return 'active';
        // Registration isn't reactive, so at first render an item may only
        // depend on items registered BEFORE it (DOM order) plus the model.
        // That is enough: the active step absent from the list means it
        // registers after me — I am before it, hence complete. Once it is
        // registered (every later recompute — phases re-derive when the
        // model changes, and by then the list is full), plain index order
        // decides.
        const values = steps.list.items().map((i) => i.value);
        const active = values.indexOf(current);
        if (active === -1) return 'complete';
        const mine = values.indexOf(props.value);
        return mine !== -1 && mine < active ? 'complete' : 'inactive';
    };
    defineProvide(useStepsItemContext, () => ({
        value: () => props.value,
        phase,
        invalid: () => !!props.invalid,
    }));

    const isTabbable = (): boolean => {
        // One tab stop: the active step while it is registered and enabled,
        // else the first enabled item (#165).
        if (disabled()) return false;
        const current = steps.state.value;
        return steps.tabStop.isTabStop(props.value, current ? [current] : []);
    };

    const bag = (): PartProps => ({
        ...htmlAttrs(props),
        id: steps.itemId(props.value),
        'data-scope': SCOPE,
        'data-part': 'item',
        'data-state': phase(),
        'data-orientation': steps.orientation(),
        'data-color': props.color,
        'data-disabled': dataAttr(inert()),
        'data-invalid': dataAttr(props.invalid),
        'data-focus-visible': dataAttr(focus.visible),
        tabIndex: isTabbable() ? 0 : -1,
        'aria-current': phase() === 'active' ? 'step' : undefined,
        'aria-controls': steps.controls(props.value),
        // asChild elements get the button contract supplied by hand: the
        // native <button> below carries `disabled` itself. A linear lock is
        // aria-disabled on both, never natively disabled — that would take
        // the step out of the roving and its title out of reach.
        'aria-disabled': (props.asChild && disabled()) || locked() ? 'true' : undefined,
        role: props.asChild ? 'button' : undefined,
        ref: (node: HTMLElement | null) => { el = node; },
        onClick: (e: MouseEvent) => {
            if (inert()) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            steps.select(props.value);
        },
        onKeydown: (e: KeyboardEvent) => {
            // A disabled asChild item still takes a pointer's focus, so its
            // arrows must still rove — only activation is gated (press
            // feedback is gated by isDisabled).
            press.onKeydown(e);
            steps.keydown(e, props.value);
            if (inert()) return;
            // Keyboard activation for asChild elements where the platform
            // won't synthesize a click from this key; where it will, ours
            // stays out of the way (double activation is the failure mode
            // `synthesizesClickFrom` exists to remove).
            if (props.asChild && !e.repeat && (e.key === 'Enter' || e.key === ' ') && !synthesizesClickFrom(e.currentTarget, e.key)) {
                e.preventDefault();
                steps.select(props.value);
            }
        },
        onKeyup: press.onKeyup,
        onFocus: () => { focus.visible = isFocusVisible(el); },
        onBlur: (e: FocusEvent) => {
            press.onBlur(e);
            focus.visible = false;
        },
        onPointerdown: press.onPointerdown,
        onPointerup: press.onPointerup,
        onPointercancel: press.onPointercancel,
        onPointerleave: press.onPointerleave,
    });

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <button type="button" class={props.class} disabled={disabled()} {...b}>
                {slots.default?.(b)}
                {props.invalid ? <span data-visually-hidden="">{steps.invalidLabel()}</span> : null}
            </button>
        );
    };
}, { name: 'Steps.Item' });

// ── Bands ──

export type StepsPartProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

// NOT aria-hidden, unlike the separator: the indicator's content is the
// step's number, which is information ("step 2"), and for an item rendered
// with only an indicator it is the button's entire accessible name — hiding
// it would leave that button nameless. A consumer whose indicator is purely
// decorative wraps the decoration in its own aria-hidden element.
const StepsIndicator = component<StepsPartProps>(({ props, slots }) => {
    const item = useStepsItemContext();
    return () => (
        <span
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="indicator"
            data-state={item.phase()}
            data-invalid={dataAttr(item.invalid())}
            class={props.class}
        >
            {slots.default?.()}
        </span>
    );
}, { name: 'Steps.Indicator' });

const StepsSeparator = component<WithClass & WithHtmlAttrs>(({ props }) => {
    const steps = useStepsContext();
    const item = useStepsItemContext();
    return () => (
        <span
            {...htmlAttrs(props)}
            aria-hidden="true"
            data-scope={SCOPE}
            data-part="separator"
            data-state={item.phase() === 'complete' ? 'complete' : 'inactive'}
            data-invalid={dataAttr(item.invalid())}
            data-orientation={steps.orientation()}
            class={props.class}
        />
    );
}, { name: 'Steps.Separator' });

/** Not `id`: the title's id is what its step's Content is labelled by. */
export type StepsTitleProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const StepsTitle = component<StepsTitleProps>(({ props, slots, onUnmounted }) => {
    const steps = useStepsContext();
    const item = useStepsItemContext();
    const value = item.value();
    if (value) reportPresence((p) => steps.setTitlePresent(value, p), onUnmounted);
    return () => (
        <span
            {...htmlAttrs(props)}
            id={value ? steps.titleId(value) : undefined}
            data-scope={SCOPE}
            data-part="title"
            class={props.class}
        >
            {slots.default?.()}
        </span>
    );
}, { name: 'Steps.Title' });

const StepsDescription = component<StepsPartProps>(({ props, slots }) => (
    () => (
        <span {...htmlAttrs(props)} data-scope={SCOPE} data-part="description" class={props.class}>
            {slots.default?.()}
        </span>
    )
), { name: 'Steps.Description' });

// ── Content ──

export type StepsContentProps =
    /** The step this panel belongs to — an item's `value`. */
    & Define.Prop<'value', string, true>
    & WithClass
    /**
     * Not `id` or `role`: the item controls the `region`'s own id. An app
     * `aria-labelledby` joins the step title's.
     */
    & Omit<WithHtmlAttrs, 'id' | 'role'>
    & Define.Slot<'default'>;

const StepsContent = component<StepsContentProps>(({ props, slots, onUnmounted }) => {
    const steps = useStepsContext();
    const value = props.value;
    reportPresence((p) => steps.setContentPresent(value, p), onUnmounted);
    const isActive = (): boolean => steps.state.value === props.value;
    // Whether this panel has ever been active — what `lazyMount` keeps. Not
    // reactive state: it only changes on a render that `isActive` drives.
    let visited = false;

    return () => {
        const attrs = htmlAttrs(props);
        const active = isActive();
        if (active) visited = true;
        const content = active || visited || !steps.lazyMount();
        return (
            <div
                {...attrs}
                id={steps.contentId(props.value)}
                data-scope={SCOPE}
                data-part="content"
                data-state={stateAttr(active, 'active', 'inactive')}
                data-orientation={steps.orientation()}
                role="region"
                aria-labelledby={[steps.labelledBy(props.value), attrs['aria-labelledby']].filter(Boolean).join(' ')}
                hidden={!active}
                class={props.class}
            >
                {content ? slots.default?.() : null}
            </div>
        );
    };
}, { name: 'Steps.Content' });

// ── Prev / Next ──

export type StepsTriggerProps =
    /** Accessible name for an icon-only trigger (`aria-label`). */
    & Define.Prop<'label', string, false>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

/**
 * Prev/Next: move the step to the nearest enabled item before/after the
 * active one. At a bound the trigger is aria-disabled, NOT natively
 * disabled — `disabled` would drop focus to <body> on the very press that
 * reaches the first or last step (the carousel/pagination convention,
 * #270). The Root's `disabled` still disables it natively.
 */
const stepTrigger = (partName: 'prev-trigger' | 'next-trigger', direction: -1 | 1, name: string) =>
    component<StepsTriggerProps>(({ props, slots, signal }) => {
        const steps = useStepsContext();
        let el: HTMLElement | null = null;
        const focus = signal({ visible: false });
        const destination = (): string | undefined => steps.target(direction);
        const atBound = (): boolean => destination() === undefined;
        const inert = (): boolean => steps.disabled() || atBound();
        const press = createPressFeedback({
            getElement: () => el,
            isDisabled: () => inert(),
        });
        const advance = (): void => {
            if (steps.disabled()) return;
            const to = destination();
            if (to !== undefined) steps.select(to);
        };

        return () => {
            const attrs = htmlAttrs(props);
            return (
                <button
                    {...attrs}
                    type="button"
                    data-scope={SCOPE}
                    data-part={partName}
                    data-disabled={dataAttr(inert())}
                    data-focus-visible={dataAttr(focus.visible)}
                    aria-disabled={!steps.disabled() && atBound() ? 'true' : undefined}
                    aria-label={props.label ?? attrs['aria-label']}
                    disabled={steps.disabled()}
                    class={props.class}
                    ref={(node: HTMLElement | null) => { el = node; }}
                    onClick={advance}
                    onKeydown={press.onKeydown}
                    onKeyup={press.onKeyup}
                    onPointerdown={press.onPointerdown}
                    onPointerup={press.onPointerup}
                    onPointercancel={press.onPointercancel}
                    onPointerleave={press.onPointerleave}
                    onFocus={() => { focus.visible = isFocusVisible(el); }}
                    onBlur={(e: FocusEvent) => {
                        press.onBlur(e);
                        focus.visible = false;
                    }}
                >
                    {slots.default?.()}
                </button>
            );
        };
    }, { name });

const StepsPrevTrigger = stepTrigger('prev-trigger', -1, 'Steps.PrevTrigger');
const StepsNextTrigger = stepTrigger('next-trigger', 1, 'Steps.NextTrigger');

export const Steps = compound(StepsRoot, {
    Root: StepsRoot,
    Item: StepsItem,
    Indicator: StepsIndicator,
    Separator: StepsSeparator,
    Title: StepsTitle,
    Description: StepsDescription,
    Content: StepsContent,
    PrevTrigger: StepsPrevTrigger,
    NextTrigger: StepsNextTrigger,
});
