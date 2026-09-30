/**
 * zero-material recipes — Material 3 over zero's anatomy.
 *
 * Every value reads an M3 token from `tokens.ts`: the colour roles and their
 * containers, the corner scale (`--radius-extra-small` … `--radius-full`),
 * the type roles (`type('label-large')`), the duration and easing tokens
 * (`--duration-short2`, `--ease-emphasized-decelerate`), the elevation
 * levels and the state-layer opacities (`--state-hover` …). The per-component
 * M3 specs land phase by phase under #413.
 *
 * A role's tonal pair is zero's soft pair: `--color-<role>-soft` is the M3
 * container and `--color-<role>-soft-content` its on-container ink, so a
 * recipe that follows the `color` axis onto the tonal fill reads
 * `-soft` / `-soft-content` (#421). The four key-colour containers are also
 * roles of their own, for the places M3 names one outright — the
 * secondary-container selection indicator, the primary-container FAB.
 */
import type { CssProps, PartStyles, RecipeInput } from '@sigx/zero-kit';
import { axisRoles, popupArrow, popupArrowHost, tableStackAt } from '@sigx/zero-kit/define';
import { roles, tokens } from './tokens.js';

/**
 * Every role a consumer can pass as `color`, DERIVED from the declaration.
 *
 * It used to be retyped here, with a comment warning that the two had to be
 * kept in step: a role declared in `tokens.ts` but missing from this list
 * renders primary, because nothing sets `--btn-accent`, which reads as the
 * variant being broken rather than as one role being unwired.
 *
 * The declaration already says which roles are action colours. Material's
 * `surface*` tones opt out of `-soft` and `outline` opts out of `-content`,
 * because they are fills and hairlines — not something a button can be. So
 * the exclusion the hand-written list encoded by hand is exactly this filter.
 */
const ROLES = axisRoles(roles);

/**
 * "…and the reading direction is right-to-left" — appended to a selector, never
 * written alone.
 *
 * `:where()` is forgiving, so an engine without `:dir()` drops that one argument
 * and still matches the attribute forms. It also contributes no specificity, so
 * a rule using it ties with the one it corrects and wins on source order —
 * declare it after, not before.
 *
 * Only for what has no logical property: a `transform`, a keyframe, a glyph that
 * points. Anything with an `inset-inline-*` or `margin-inline-*` spelling should
 * use that instead and need no rule at all.
 */
const rtl = ':where(:dir(rtl), [dir="rtl"], [dir="rtl"] *)';

const focusRing: Record<string, CssProps> = {
    'focus-visible': {
        outline: '3px solid var(--color-secondary)',
        outlineOffset: '2px',
    },
};

const motion = (props: string): string =>
    props.split(', ').map((p) => `${p} var(--duration-short2) var(--ease-standard)`).join(', ');

/** Material's raised container: a tonal fill plus an elevation step. */
const raised = (level: 'level2' | 'level3'): CssProps => ({
    background: 'var(--color-surface-container-high)',
    color: 'var(--color-surface-container-high-content)',
    border: 'none',
    borderRadius: 'var(--radius-extra-large)',
    boxShadow: `var(--shadow-${level})`,
});

/** An M3 measure in dp, as rem (1dp = 1px here) — the unit M3's specs are written in. */
const dp = (n: number): string => `${n / 16}rem`;

/** M3's fifteen type roles. */
type TypeRole = `${'display' | 'headline' | 'title' | 'body' | 'label'}-${'large' | 'medium' | 'small'}`;

/**
 * An M3 type role as one declaration block — every field read from the one
 * role `tokens.ts` declares under `typography.roles`.
 */
const type = (role: TypeRole): CssProps => ({
    fontFamily: `var(--font-${role})`,
    fontSize: `var(--text-${role})`,
    lineHeight: `var(--leading-${role})`,
    fontWeight: `var(--weight-${role})`,
    letterSpacing: `var(--tracking-${role})`,
});

/** M3's label-large, less its line height — the caller sets the box. */
const label: CssProps = {
    fontFamily: 'var(--font-label-large)',
    fontSize: 'var(--text-label-large)',
    fontWeight: 'var(--weight-label-large)',
    letterSpacing: 'var(--tracking-label-large)',
};

// ── Press feedback ────────────────────────────────────────────────────────
// The runtime publishes the press (`data-pressed`, `data-press-animating`,
// `--press-x/y/r`); these fragments are the Material read of it — a held
// state layer plus the ink ripple. Compose onto a part with `withPresence`.

/**
 * Bounded press feedback: state layer + ink ripple clipped to the part.
 * `prefix` must be unique per RECIPE — keyframes are declared per recipe but
 * named globally, and each compiled component file must carry its own copy.
 */
const pressable = (prefix: string, ink = 'var(--color-primary)'): PartStyles => ({
    base: {
        position: 'relative',
        overflow: 'hidden',
        WebkitTapHighlightColor: 'transparent',
    },
    selectors: {
        '&::before': {
            content: '""',
            position: 'absolute',
            inset: '0',
            background: ink,
            opacity: '0',
            pointerEvents: 'none',
            transition: 'opacity var(--duration-short2) var(--ease-standard)',
        },
        // MD3 state layers: hover 8%, focus and pressed 10%. Pressed carries the
        // redundant :not so its specificity EQUALS hover's and it wins by
        // source order while both apply.
        '&:hover:not([data-disabled])::before': { opacity: 'var(--state-hover)' },
        // M3's focus state layer rides beside the focus ring. `:is()` takes
        // its argument's specificity, so hover, focus and pressed tie and
        // resolve by source order.
        '&:is(:focus-visible, [data-focus-visible]):not([data-disabled])::before': { opacity: 'var(--state-focus)' },
        '&[data-pressed]:not([data-disabled])::before': { opacity: 'var(--state-pressed)' },
        '&::after': {
            content: '""',
            position: 'absolute',
            left: 'var(--press-x, 50%)',
            top: 'var(--press-y, 50%)',
            width: 'calc(var(--press-r, 0px) * 2)',
            height: 'calc(var(--press-r, 0px) * 2)',
            borderRadius: '50%',
            background: ink,
            transform: 'translate(-50%, -50%) scale(0)',
            opacity: '0',
            pointerEvents: 'none',
        },
        '&[data-press-animating]::after': {
            animation: `${prefix}-ripple var(--duration-long2) var(--ease-standard)`,
        },
    },
    at: {
        // A tap on a touch screen must not leave a sticky hover layer.
        'hover-none': {
            selectors: { '&:hover:not([data-disabled])::before': { opacity: '0' } },
        },
        'forced-colors': {
            selectors: {
                '&::before': { display: 'none' },
                '&::after': { display: 'none' },
            },
        },
    },
});

/**
 * Unbounded press feedback for selection controls: a fixed circle centered
 * on the part (MD3's 40dp state layer), press coordinates ignored, and no
 * clipping — the halo extends past the box. A readonly control (#267) takes
 * no hover layer: the halo would promise a press that changes nothing.
 */
const pressableCentered = (prefix: string, diameter: string, ink = 'var(--color-primary)'): PartStyles => ({
    base: {
        position: 'relative',
        WebkitTapHighlightColor: 'transparent',
    },
    selectors: {
        '&::before': {
            content: '""',
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: diameter,
            height: diameter,
            borderRadius: '50%',
            background: ink,
            transform: 'translate(-50%, -50%)',
            opacity: '0',
            pointerEvents: 'none',
            transition: 'opacity var(--duration-short2) var(--ease-standard)',
        },
        '&:hover:not([data-disabled], [data-readonly])::before': { opacity: 'var(--state-hover)' },
        '&:is(:focus-visible, [data-focus-visible]):not([data-disabled])::before': { opacity: 'var(--state-focus)' },
        '&[data-pressed]:not([data-disabled])::before': { opacity: 'var(--state-pressed)' },
        // MD3 ink: on-surface while unselected, the accent once selected.
        '&[data-state="unchecked"]::before': { background: 'var(--color-base-content)' },
        '&[data-state="unchecked"]::after': { background: 'var(--color-base-content)' },
        '&::after': {
            content: '""',
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: diameter,
            height: diameter,
            borderRadius: '50%',
            background: ink,
            transform: 'translate(-50%, -50%) scale(0)',
            opacity: '0',
            pointerEvents: 'none',
        },
        '&[data-press-animating]::after': {
            animation: `${prefix}-ripple var(--duration-long2) var(--ease-standard)`,
        },
    },
    at: {
        'hover-none': {
            selectors: { '&:hover:not([data-disabled], [data-readonly])::before': { opacity: '0' } },
        },
        'forced-colors': {
            selectors: {
                '&::before': { display: 'none' },
                '&::after': { display: 'none' },
            },
        },
    },
});

const rippleKeyframes = (prefix: string): Record<string, string> => ({
    [`${prefix}-ripple`]:
        'from { transform: translate(-50%, -50%) scale(0); opacity: var(--state-pressed); } '
        + '60% { transform: translate(-50%, -50%) scale(1); opacity: var(--state-pressed); } '
        + 'to { transform: translate(-50%, -50%) scale(1); opacity: 0; }',
});

/**
 * The swipe-to-dismiss offset (#293): `createSwipe` publishes the drag as
 * `--swipe-x` / `--swipe-y` on a toast root or a drawer sheet, and this is
 * the one place it is read — composed first into the part's `transform`, so
 * an enter/exit offset or a slide rides on top of it. Unset, it is nothing.
 */
const SWIPE = 'translate(var(--swipe-x, 0px), var(--swipe-y, 0px))';

/**
 * Enter/exit presence for a top-layer popup.
 *
 * Zero never unmounts a popup; it toggles `data-state` and calls the native
 * `showPopover()` / `showModal()`. Transitioning `display` and `overlay` with
 * `allow-discrete` is all the platform needs — the browser keeps the element
 * in the top layer for the length of the exit, so two declarations buy both
 * directions. `@starting-style` supplies the state the entry animates FROM.
 *
 * `overlay` is Chromium-only as of writing; elsewhere the entry still animates
 * and the exit is instant.
 */
const popupTempo = (duration: string, ease: string): string =>
    `opacity ${duration} ${ease}, transform ${duration} ${ease}, `
    + `display ${duration} allow-discrete, overlay ${duration} allow-discrete`;

/**
 * M3's enter/exit pair (#418): a surface arrives on emphasized-decelerate
 * over medium4 (400ms) and leaves on emphasized-accelerate over short4
 * (200ms) — the transition on `open` is the entry, the base one the exit.
 */
const popupPresence = (from: string): PartStyles => ({
    base: {
        opacity: '0',
        transform: from,
        transition: popupTempo('var(--duration-short4)', 'var(--ease-emphasized-accelerate)'),
    },
    states: {
        open: {
            opacity: '1',
            transform: 'none',
            transition: popupTempo('var(--duration-medium4)', 'var(--ease-emphasized-decelerate)'),
        },
    },
    at: {
        'starting-style': { states: { open: { opacity: '0', transform: from } } },
        // Both directions: `open` carries the entry's own transition.
        'reduced-motion': { base: { transition: 'none' }, states: { open: { transform: 'none', transition: 'none' } } },
    },
});

/**
 * Enter/exit for a disclosure panel, which is not in the top layer.
 *
 * Collapsible and Accordion are native `<details>`, so the panel lives inside
 * the browser's `::details-content`. `interpolate-size: allow-keywords`
 * unlocks `auto` as a transition endpoint — set on the element itself rather
 * than globally, so nothing outside this design system changes behaviour.
 */
const disclosurePresence: PartStyles = {
    base: { interpolateSize: 'allow-keywords' },
    selectors: {
        '&::details-content': {
            blockSize: '0',
            overflow: 'hidden',
        },
        // Open only: a close removes `open`, which hides the content before
        // any transition could run — the panel animates that half (#276).
        '&[open]::details-content': {
            blockSize: 'auto',
            transition: 'block-size var(--duration-medium2) var(--ease-emphasized), '
                    + 'content-visibility var(--duration-medium2) allow-discrete',
        },
    },
    at: { 'reduced-motion': { selectors: { '&[open]::details-content': { transition: 'none' } } } },
};

/**
 * The panel's close (#276). Removing `open` hides a `<details>` at once, so
 * the close cannot live on `::details-content` the way the open does: zero
 * flips the panel to `closed` first and holds the element open until the
 * panel's own animation has played. The runtime publishes the panel's
 * measured height as `--<scope>-panel-height`, which is the one value this
 * needs — `auto` is not an endpoint any engine but Chromium can animate.
 * `border-box` so the measured height (content + padding) is the whole box.
 * Web-only: the property is written by the DOM runtime (`RUNTIME_PROPERTIES`).
 */
const disclosureExit = (scope: 'collapsible' | 'accordion'): RecipeInput['targets'] => ({
    web: {
        parts: {
            panel: {
                states: {
                    closed: {
                        boxSizing: 'border-box',
                        animation: `${scope}-panel-exit var(--duration-medium2) var(--ease-emphasized)`,
                    },
                },
                at: { 'reduced-motion': { states: { closed: { animation: 'none' } } } },
            },
        },
        keyframes: {
            [`${scope}-panel-exit`]:
                `from { block-size: var(--${scope}-panel-height); } to { block-size: 0; padding-block: 0; }`,
        },
    },
});

/**
 * Collapsible's non-native mode (#453): a `<div>` root, a `<button>` trigger
 * and a panel hidden with `hidden="until-found"`. Nothing lives on
 * `::details-content` there, so the panel does that wrapper's work itself:
 * collapsed while `hidden` (the UA's `content-visibility: hidden` keeps the
 * box — padding and border included — on the page), clipped so its content
 * never spills out of a box that is growing or shrinking, and grown
 * from collapsed to `auto` on the open state (`interpolate-size` is the
 * root's, and inherits); the close is `disclosureExit`'s, as in native mode.
 * Inert in native mode: a native panel is never `hidden`, and its block size
 * never moves.
 *
 * The trigger sheds the paint a UA `<button>` has and a `<summary>` never
 * had — only where the recipe's own base leaves a property unset, since this
 * rule (`:where(button)`, the base's specificity) is emitted after it.
 * Web-only, like `hidden="until-found"` itself.
 */
const BUTTON_RESET: CssProps = {
    appearance: 'none',
    margin: '0',
    padding: '0',
    border: '0',
    background: 'none',
    color: 'inherit',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    fontWeight: 'inherit',
    fontStyle: 'inherit',
    lineHeight: 'inherit',
    letterSpacing: 'inherit',
    textTransform: 'inherit',
    textAlign: 'start',
    inlineSize: '100%',
    boxSizing: 'border-box',
};
/** The reset minus what `base` states itself (a `borderRadius` is no border). */
const summaryLike = (base: CssProps = {}): CssProps => {
    const own = Object.keys(base).filter((key) => !key.endsWith('Radius'));
    return Object.fromEntries(Object.entries(BUTTON_RESET)
        .filter(([key]) => !own.some((k) => k === key || k.startsWith(key))));
};
const withNonNative = (recipe: RecipeInput): RecipeInput => {
    const web = recipe.targets?.web ?? {};
    const trigger = web.parts?.trigger ?? {};
    const panel = web.parts?.panel ?? {};
    const reduced = panel.at?.['reduced-motion'] ?? {};
    return {
        ...recipe,
        targets: {
            ...recipe.targets,
            web: {
                ...web,
                parts: {
                    ...web.parts,
                    trigger: {
                        ...trigger,
                        selectors: { ...trigger.selectors, '&:where(button)': summaryLike(recipe.parts.trigger?.base) },
                    },
                    panel: {
                        ...panel,
                        base: { ...panel.base, overflow: 'clip' },
                        selectors: {
                            ...panel.selectors,
                            '&[data-state="closed"][hidden]': {
                                blockSize: '0',
                                paddingBlock: '0',
                                borderBlockWidth: '0',
                                animation: 'none',
                            },
                        },
                        // The open half: from the collapsed box to `auto`.
                        states: {
                            ...panel.states,
                            open: {
                                ...panel.states?.open,
                                transition: 'block-size var(--duration-medium2) var(--ease-emphasized), padding-block var(--duration-medium2) var(--ease-emphasized)',
                            },
                        },
                        at: {
                            ...panel.at,
                            'reduced-motion': {
                                ...reduced,
                                states: { ...reduced.states, open: { transition: 'none' } },
                            },
                        },
                    },
                },
            },
        },
    };
};

/**
 * Merge presence into a part's own styles per KEY, not per block: a recipe
 * that already writes `states: { open: {} }` — the "deliberately unstyled"
 * idiom — would otherwise replace the open state presence needs and silently
 * lose the entry animation.
 */
const mergeKeyed = <T extends Record<string, CssProps>>(a: T | undefined, b: T | undefined): T =>
    Object.fromEntries(
        [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])]
            .map((key) => [key, { ...a?.[key], ...b?.[key] }]),
    ) as T;

const withPresence = (presence: PartStyles, styles: PartStyles): PartStyles => ({
    base: { ...presence.base, ...styles.base },
    states: mergeKeyed(presence.states, styles.states),
    selectors: mergeKeyed(presence.selectors, styles.selectors),
    at: Object.fromEntries(
        [...new Set([...Object.keys(presence.at ?? {}), ...Object.keys(styles.at ?? {})])].map(
            (key) => [key, withPresence(presence.at?.[key] ?? {}, styles.at?.[key] ?? {})],
        ),
    ),
});

// ── M3 text fields (#416) ─────────────────────────────────────────────────
/**
 * The M3 text field, filled and outlined, shared by every scope that is one:
 * input, textarea, number-input, select and combobox. Geometry and paint are
 * `--tf-*` custom properties set on the hosting root — the scope's own root,
 * or a `Field.Root` that holds one — so a variant, a density step, a leading
 * icon or an error is one rebinding, and the container, the active
 * indicator, the outline and the floating label all read the same values.
 *
 * The floating label is the stress test. It rests inside the field over the
 * input while the field is empty and unfocused, and floats to the top edge
 * (filled) or onto the outline (outlined) otherwise. "Empty" is
 * `data-placeholder`, which the runtime stamps on the text controls' roots
 * and on the select trigger (#416), and mirrors onto a `Field.Root` holding
 * one (#469).
 */

/** The text-field scopes, by the root a `Field.Root` would hold. */
const TEXT_FIELD_ROOTS = ['input', 'textarea', 'number-input', 'select', 'combobox']
    .map((s) => `[data-scope="${s}"][data-part="root"]`)
    .join(', ');

/** A `Field.Root` holding a text field, whose label therefore floats. */
const FIELD_HOST = `[data-scope="field"][data-part="root"]:has(> :is(${TEXT_FIELD_ROOTS}))`;

/** A host with a visible label of its own (`Input.Label` & co) or a field's. */
const LABELLED = ':has(> [data-part="label"]:not([data-visually-hidden]))';

/**
 * The filled field: surface-container-highest under a 1dp active indicator,
 * top corners extra-small, the floated label 8dp from the top edge at M3's
 * 56dp (scaled with the density), and the input pushed down to make room.
 */
const TF_FILLED: CssProps = {
    '--tf-fill': 'var(--color-surface-container-highest)',
    '--tf-hover-fill': 'color-mix(in oklch, var(--color-surface-container-highest), var(--color-base-content) 8%)',
    '--tf-disabled-fill': 'color-mix(in oklch, var(--color-base-content) 4%, transparent)',
    '--tf-radius': 'var(--radius-extra-small) var(--radius-extra-small) 0 0',
    '--tf-outline-width': '0px',
    '--tf-indicator': '1px',
    '--tf-indicator-focus': '2px',
    '--tf-ring-focus': '0px',
    '--tf-label-start-base': dp(16),
    '--tf-label-start-floated': 'var(--tf-label-start)',
    '--tf-label-pad': '0px',
    '--tf-float-y': `calc((var(--tf-height) - ${dp(40)}) / 2)`,
    '--tf-notch': 'transparent',
    '--tf-pad-top': `calc(var(--tf-height) - ${dp(32)})`,
    '--tf-pad-bottom': dp(8),
};

/**
 * The outlined field: a 1dp outline (2dp focused, drawn as an inset ring so
 * nothing reflows), extra-small corners all round, and the floated label
 * notched into the top edge. An input holding `Input.Outline` has a real
 * notch: the outline is its fieldset, cut by a legend the runtime sizes to
 * the label (#468, `tfOutline`). A scope without that part — textarea,
 * number-input, select, combobox — still backs the floated label with the
 * surface behind the field (`--tf-surface`, the page's `surface` unless a
 * container says otherwise), which is right on a flat surface only.
 */
const TF_OUTLINED: CssProps = {
    '--tf-fill': 'transparent',
    '--tf-hover-fill': 'transparent',
    '--tf-disabled-fill': 'transparent',
    '--tf-radius': 'var(--radius-extra-small)',
    '--tf-outline-width': '1px',
    '--tf-indicator': '0px',
    '--tf-indicator-focus': '0px',
    '--tf-ring-focus': '1px',
    '--tf-label-start-base': dp(12),
    '--tf-label-start-floated': dp(12),
    '--tf-label-pad': dp(4),
    '--tf-float-y': dp(-9),
    '--tf-notch': 'var(--tf-surface)',
    '--tf-pad-top': `calc((var(--tf-height) - ${dp(24)}) / 2)`,
    '--tf-pad-bottom': `calc((var(--tf-height) - ${dp(24)}) / 2)`,
};

/** The un-attributed host: M3's 56dp filled field, focused in primary. */
const TF_HOST: CssProps = {
    '--tf-height': dp(56),
    '--tf-accent': 'var(--color-primary)',
    '--tf-outline-color': 'var(--color-outline)',
    '--tf-indicator-color': 'var(--color-surface-variant-content)',
    '--tf-ring': '0px',
    '--tf-label-start': 'var(--tf-label-start-base)',
    ...TF_FILLED,
};

/** M3's densities (56 → 40dp); `lg` and `xl` step past M3 for the size axis. */
const TF_HEIGHTS: Record<string, number> = { xs: 40, sm: 48, lg: 64, xl: 72 };

/** The size axis on a text-field root: the height, the rest follows. */
const tfSizes = (part: string): Record<string, Record<string, PartStyles>> => ({
    ...Object.fromEntries(Object.entries(TF_HEIGHTS).map(([size, h]) => [size, { [part]: { base: { '--tf-height': dp(h) } } }])),
    md: {},
});

/** The colour axis: the role is the focused indicator, outline and label. */
const tfColors = (part: string): Record<string, Record<string, PartStyles>> =>
    Object.fromEntries(ROLES.map((c) => [c, { [part]: { base: { '--tf-accent': `var(--color-${c})` } } }]));

/**
 * A text-field root: the positioning context for its floating label, the
 * variant's custom properties, and the two things only the root can see —
 * a visible label (the input makes room for it when floated) and a leading
 * icon (the resting label moves past it).
 */
const tfRoot = (extra: CssProps = {}): PartStyles => ({
    base: {
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 'var(--space-2xs)',
        ...TF_HOST,
        ...extra,
    },
    selectors: {
        [`&${LABELLED}, ${FIELD_HOST}${LABELLED} > &`]: {
            '--tf-in-top': 'var(--tf-pad-top)',
            '--tf-in-bottom': 'var(--tf-pad-bottom)',
        },
        '&:has([data-part="adornment"][data-placement="start"])': {
            '--tf-label-start': `calc(var(--tf-label-start-base) + ${dp(36)})`,
        },
        // Inside a field, the field owns the outlined label's headroom.
        [`${FIELD_HOST} > &`]: { marginBlockStart: '0' },
    },
});

/** The variant axis on a text-field root. */
const tfVariants = (part: string): Record<string, Record<string, PartStyles>> => ({
    filled: {},
    // The floated label rides half its height above an outlined box, so the
    // field owns that space rather than laying it over whatever sits above.
    outlined: { [part]: { base: { ...TF_OUTLINED, marginBlockStart: 'var(--space-xs)' } } },
});

/**
 * The container: fill, corners, outline, and the active indicator as an
 * inset shadow — 1dp at rest, 2dp and the role colour while focused, error
 * while invalid, 38% on-surface while disabled. Hover lays M3's 8% on-surface
 * state layer into a filled field's fill and darkens an outline. `:focus-
 * within` because M3 shows focus on every focus, not only keyboard focus.
 */
const tfBox = (): PartStyles => ({
    base: {
        boxSizing: 'border-box',
        minBlockSize: 'var(--tf-height)',
        background: 'var(--tf-fill)',
        color: 'var(--color-base-content)',
        border: 'var(--tf-outline-width) solid var(--tf-outline-color)',
        borderRadius: 'var(--tf-radius)',
        boxShadow:
            'inset 0 calc(-1 * var(--tf-indicator)) 0 var(--tf-indicator-color), '
            + 'inset 0 0 0 var(--tf-ring) var(--tf-outline-color)',
        cursor: 'text',
        transition: motion('background-color, border-color, box-shadow'),
    },
    selectors: {
        '&:hover:not([data-disabled])': {
            background: 'var(--tf-hover-fill)',
            '--tf-indicator-color': 'var(--color-base-content)',
            '--tf-outline-color': 'var(--color-base-content)',
        },
        '&:focus-within:not([data-disabled]), &[data-state="open"]': {
            '--tf-indicator': 'var(--tf-indicator-focus)',
            '--tf-ring': 'var(--tf-ring-focus)',
            '--tf-indicator-color': 'var(--tf-accent)',
            '--tf-outline-color': 'var(--tf-accent)',
        },
        '&[data-invalid]': {
            '--tf-indicator-color': 'var(--color-error)',
            '--tf-outline-color': 'var(--color-error)',
        },
        '&[data-disabled]': {
            background: 'var(--tf-disabled-fill)',
            color: 'color-mix(in oklch, var(--color-base-content) 38%, transparent)',
            cursor: 'not-allowed',
            '--tf-indicator-color': 'color-mix(in oklch, var(--color-base-content) 38%, transparent)',
            '--tf-outline-color': 'color-mix(in oklch, var(--color-base-content) 12%, transparent)',
        },
    },
    at: {
        'reduced-motion': { base: { transition: 'none' } },
        // The fill is background paint, which forced colours revalue: keep
        // the field's bounds with a system-coloured border.
        'forced-colors': { base: { border: '1px solid CanvasText' } },
    },
});

/** The native field inside the box: M3's body-large, 16dp in, room for the label. */
const tfText = (): CssProps => ({
    boxSizing: 'border-box',
    minInlineSize: '0',
    appearance: 'none',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'inherit',
    ...type('body-large'),
    paddingInline: 'var(--space-md)',
    paddingBlockStart: `var(--tf-in-top, calc((var(--tf-height) - ${dp(24)}) / 2))`,
    paddingBlockEnd: `var(--tf-in-bottom, calc((var(--tf-height) - ${dp(24)}) / 2))`,
});

/**
 * M3 shows a placeholder only once the label has floated out of its way:
 * while a visible label rests in the field, the placeholder is transparent.
 */
const tfRestingPlaceholder = (host: string, target: string): Record<string, CssProps> => ({
    [`${host}${LABELLED}:not(:focus-within) ${target}, ${FIELD_HOST}${LABELLED}:not(:focus-within) ${target}`]: {
        color: 'transparent',
    },
});

/**
 * The floating label's declarations, for a host selector and the condition
 * that floats it. Returned as selector blocks, so a `Field.Label` — which
 * only floats while its field holds a text field — can take the same rules
 * under `FIELD_HOST`.
 */
const tfLabelRules = (host: string, floated: string): Record<string, CssProps> => ({
    [`${host} > &`]: {
        position: 'absolute',
        insetBlockStart: '0',
        insetInlineStart: 'var(--tf-label-start)',
        zIndex: '1',
        maxInlineSize: 'calc(100% - var(--tf-label-start) * 2)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        ...type('body-large'),
        color: 'var(--color-surface-variant-content)',
        paddingInline: 'var(--tf-label-pad)',
        background: 'transparent',
        transformOrigin: 'top left',
        transform: `translateY(calc(var(--tf-height) / 2 - ${dp(12)}))`,
        transition:
            'transform var(--duration-short3) var(--ease-standard), '
            + 'inset-inline-start var(--duration-short3) var(--ease-standard), '
            + 'color var(--duration-short3) var(--ease-standard), '
            + 'background-color var(--duration-short3) var(--ease-standard)',
    },
    [`${host}${rtl} > &`]: { transformOrigin: 'top right' },
    [`${host}${floated} > &`]: {
        transform: 'translateY(var(--tf-float-y)) scale(0.75)',
        insetInlineStart: 'var(--tf-label-start-floated)',
        background: 'var(--tf-notch)',
    },
    [`${host}:focus-within > &`]: { color: 'var(--tf-accent)' },
    [`${host} > &[data-invalid]`]: { color: 'var(--color-error)' },
    // M3's disabled label is the 38% ink alone: a Field.Label's own fade
    // (`opacity`) must not dim it a second time.
    [`${host} > &[data-disabled]`]: {
        color: 'color-mix(in oklch, var(--color-base-content) 38%, transparent)',
        opacity: '1',
    },
});

/**
 * A host whose input holds the optional outline part (#468): the outline
 * really is cut behind the floated label, so the label needs no backing.
 */
const NOTCHED = ':has([data-scope="input"][data-part="outline"])';

/**
 * The label over a notched outline: transparent, so it sits in the cut
 * rather than over a painted stand-in for the surface. Forced colours hide
 * the outline (the box's own system border stays), so there the label
 * backs itself with Canvas, as the surface paint did.
 */
const tfNotchedLabel = (host: string, floated: string): Pick<PartStyles, 'selectors' | 'at'> => ({
    selectors: { [`${host}${NOTCHED} > &`]: { background: 'transparent' } },
    at: { 'forced-colors': { selectors: { [`${host}${NOTCHED}${floated} > &`]: { background: 'Canvas' } } } },
});

/**
 * The outline part (#468): a fieldset laid over the box's border, drawing
 * M3's outline — 1dp, 2dp and the accent while focused — with its legend,
 * the notch, cut as wide as the floated label. The runtime publishes the
 * label's layout inline size (`--input-label-inline-size`); the notch takes
 * it at the 0.75 the label floats with, starts where the floated label
 * does, and closes to nothing while the label rests. A filled field has no
 * outline width, so the part draws nothing there.
 */
const TF_FLOATED = ':is(:focus-within, :not([data-placeholder]))';

const tfOutline = (): PartStyles => ({
    base: {
        position: 'absolute',
        inset: 'calc(-1 * var(--tf-outline-width))',
        boxSizing: 'border-box',
        margin: '0',
        padding: '0',
        minInlineSize: '0',
        border: 'calc(var(--tf-outline-width) + var(--tf-ring)) solid var(--tf-outline-color)',
        borderRadius: 'var(--tf-radius)',
        pointerEvents: 'none',
        transition: motion('border-color'),
    },
    at: {
        'reduced-motion': { base: { transition: 'none' } },
        'forced-colors': { base: { display: 'none' } },
    },
});

const tfNotch = (scope: string): PartStyles => ({
    base: {
        display: 'block',
        boxSizing: 'border-box',
        inlineSize: '0',
        blockSize: '0',
        padding: '0',
        marginInlineStart: 'calc(var(--tf-label-start-floated) - var(--tf-outline-width) - var(--tf-ring))',
        fontSize: '0',
        lineHeight: '0',
        transition: 'inline-size var(--duration-short3) var(--ease-standard)',
    },
    selectors: {
        [`[data-scope="${scope}"][data-part="root"]${TF_FLOATED} &`]: {
            inlineSize: 'calc(var(--input-label-inline-size, 0px) * 0.75)',
        },
    },
    at: { 'reduced-motion': { base: { transition: 'none' } } },
});

/** A text-field scope's own label (`Input.Label` & co). */
const tfLabel = (scope: string): PartStyles => ({
    selectors: {
        ...tfLabelRules(`[data-scope="${scope}"][data-part="root"]`, ':is(:focus-within, :not([data-placeholder]))'),
        '&[data-required]::after': { content: '" *"' },
    },
    at: { 'reduced-motion': { selectors: { [`[data-scope="${scope}"][data-part="root"] > &`]: { transition: 'none' } } } },
});

/**
 * M3 Expressive's common-button size ramp (#415), per zero size: container
 * height, inline padding, icon size, icon–label gap, label type role, the
 * `square` shape's corner, the corner a press morphs to, and the outline
 * width. `sm` is M3's default (S, 40dp) and the un-attributed render; the
 * `./components` module spells these `xs | s | m | l | xl`.
 */
const BUTTON_SIZES = {
    xs: { height: 32, pad: 12, icon: 20, gap: 4, type: 'label-large', square: 'medium', pressed: 'small', outline: 1 },
    sm: { height: 40, pad: 16, icon: 20, gap: 8, type: 'label-large', square: 'medium', pressed: 'small', outline: 1 },
    md: { height: 56, pad: 24, icon: 24, gap: 8, type: 'title-medium', square: 'large', pressed: 'medium', outline: 1 },
    lg: { height: 96, pad: 48, icon: 32, gap: 12, type: 'headline-small', square: 'extra-large', pressed: 'large', outline: 2 },
    xl: { height: 136, pad: 64, icon: 40, gap: 16, type: 'headline-large', square: 'extra-large', pressed: 'large', outline: 3 },
} as const satisfies Record<string, {
    height: number; pad: number; icon: number; gap: number; type: TypeRole;
    square: string; pressed: string; outline: number;
}>;

type ButtonSize = keyof typeof BUTTON_SIZES;

/** M3's icon-button icon sizes, which step apart from the label buttons'. */
const ICON_BUTTON_ICON: Record<ButtonSize, number> = { xs: 20, sm: 24, md: 24, lg: 32, xl: 40 };

/** One step of the ramp as the custom properties the shared base reads. */
const buttonStep = (size: ButtonSize): CssProps => {
    const s = BUTTON_SIZES[size];
    return {
        '--btn-height': dp(s.height),
        '--btn-pad': dp(s.pad),
        '--btn-icon': dp(s.icon),
        '--btn-icon-only': dp(ICON_BUTTON_ICON[size]),
        '--btn-gap': dp(s.gap),
        '--btn-square': `var(--radius-${s.square})`,
        '--btn-pressed': `var(--radius-${s.pressed})`,
        '--btn-outline': `${s.outline}px`,
        ...type(s.type),
    };
};

/** The size variants: the base carries `sm`, so its entry stays empty. */
const buttonSizeVariants = (part: string): Record<string, Record<string, PartStyles>> =>
    Object.fromEntries((Object.keys(BUTTON_SIZES) as ButtonSize[]).map((size) => [
        size,
        size === 'sm' ? {} : { [part]: { base: buttonStep(size) } },
    ]));

/**
 * The geometry and paint every M3 button-like control shares — button and
 * toggle (#415). Paint rides custom properties the variants set: `--btn-fill`,
 * `--btn-label`, `--btn-border`, `--btn-shadow` / `--btn-shadow-hover`. The
 * state layer and the ripple (`pressable`) take the label colour, as M3's do.
 *
 * Shape: `round` is a corner of half the height rather than `full`, so the
 * press morph interpolates between two real lengths instead of from 9999px.
 * A press morphs the corner to the size's pressed corner on the fast spatial
 * spring; `square` starts from the size's square corner.
 */
const m3ButtonRoot = (prefix: string): PartStyles => withPresence(pressable(prefix, 'var(--btn-label)'), {
    base: {
        appearance: 'none',
        // An asChild `<a>` gets no UA underline (see the README's
        // link-button note for the unlayered `a { color }` case).
        textDecoration: 'none',
        boxSizing: 'border-box',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...buttonStep('sm'),
        '--btn-radius': 'calc(var(--btn-height) / 2)',
        gap: 'var(--btn-gap)',
        blockSize: 'var(--btn-height)',
        paddingInline: 'var(--btn-pad)',
        paddingBlock: '0',
        background: 'var(--btn-fill, transparent)',
        color: 'var(--btn-label)',
        border: 'var(--btn-outline) solid var(--btn-border, transparent)',
        borderRadius: 'var(--btn-radius)',
        boxShadow: 'var(--btn-shadow, none)',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition:
            'border-radius var(--duration-spatial-fast) var(--ease-spatial-fast), '
            + 'box-shadow var(--duration-short2) var(--ease-standard), '
            + 'background-color var(--duration-short2) var(--ease-standard), '
            + 'color var(--duration-short2) var(--ease-standard)',
    },
    states: {
        // M3's disabled button: an on-surface container at 10% (none for
        // outlined and text) and the label at 38% — explicit colours, not a
        // fade, so the outline and the elevation go with it.
        disabled: {
            background: 'var(--btn-disabled-fill, color-mix(in oklch, var(--color-base-content) 10%, transparent))',
            color: 'color-mix(in oklch, var(--color-base-content) 38%, transparent)',
            borderColor: 'var(--btn-disabled-border, transparent)',
            boxShadow: 'none',
            cursor: 'not-allowed',
        },
        hover: { boxShadow: 'var(--btn-shadow-hover, var(--btn-shadow, none))' },
        ...focusRing,
    },
    selectors: {
        '& > svg': { inlineSize: 'var(--btn-icon)', blockSize: 'var(--btn-icon)', flex: 'none' },
        '&[data-pressed]:not([data-disabled])': { borderRadius: 'var(--btn-pressed)' },
    },
    at: {
        'reduced-motion': { base: { transition: 'none' } },
        // The fill is background paint, which forced colours revalue: keep
        // the button's bounds with a system-coloured border.
        'forced-colors': { base: { borderColor: 'ButtonText' } },
    },
});

/** The colour axis: each role rebinds the accent pair and its tonal pair. */
const buttonColors = (part: string): Record<string, Record<string, PartStyles>> =>
    Object.fromEntries(ROLES.map((c) => [c, { [part]: { base: {
        '--btn-accent': `var(--color-${c})`,
        '--btn-on-accent': `var(--color-${c}-content)`,
        '--btn-soft': `var(--color-${c}-soft)`,
        '--btn-on-soft': `var(--color-${c}-soft-content)`,
        '--btn-ink': `var(--color-${c})`,
    } } }]));

/**
 * The shape axis: `round` is the base; `square` starts from the size's
 * square corner (and still morphs on a press).
 */
const buttonShapes = (part: string): Record<string, Record<string, PartStyles>> => ({
    round: {},
    square: { [part]: { base: { '--btn-radius': 'var(--btn-square)' } } },
});

/**
 * The icon-button configuration (`mods.icon`): square to its height, no
 * inline padding, the icon on the icon-button ramp. M3's round icon button
 * is a circle; `square` still takes the size's square corner.
 */
const iconButton = (part: string): Record<string, PartStyles> => ({
    [part]: {
        base: { paddingInline: '0', inlineSize: 'var(--btn-height)', '--btn-icon': 'var(--btn-icon-only)' },
    },
});

export const button: RecipeInput = {
    component: 'button',
    // Public to a design system derived from this one (#73).
    hooks: {
        properties: {
            '--btn-accent': 'The role colour: filled fill, text and elevated label.',
            '--btn-on-accent': 'The ink on --btn-accent.',
            '--btn-soft': 'The tonal fill: the role container (secondary-container unset).',
            '--btn-on-soft': 'The ink on --btn-soft.',
            '--btn-ink': 'The outlined label and the standard icon: the role, on-surface-variant unset.',
        },
    },
    tokens: {
        '--btn-accent': 'var(--color-primary)',
        '--btn-on-accent': 'var(--color-primary-content)',
    },
    parts: {
        // The loading spinner (#50): a real part zero renders before the
        // label while `loading`, drawn as a ring in `currentColor` with one
        // transparent quadrant — it takes whatever ink the variant chose.
        // A literal duration and an explicit reduced-motion `none`: the kit
        // collapses `--duration-*` under reduced motion, and an infinite
        // loop at ~0s strobes rather than stops.
        spinner: {
            base: {
                boxSizing: 'border-box',
                inlineSize: 'var(--btn-icon)',
                blockSize: 'var(--btn-icon)',
                flex: 'none',
                borderRadius: '9999px',
                border: 'calc(var(--border) * 2) solid currentColor',
                borderBlockStartColor: 'transparent',
                animation: 'zero-material-btn-spin 0.8s linear infinite',
            },
            at: { 'reduced-motion': { base: { animation: 'none' } } },
        },
        root: withPresence(m3ButtonRoot('btn'), {
            // Work in flight (`loading`, #50): still focusable, still legible —
            // the label is what the reader is waiting on — so no fade here.
            states: { loading: { cursor: 'progress' } },
        }),
    },
    keyframes: {
        'zero-material-btn-spin': 'to { transform: rotate(360deg) }',
        ...rippleKeyframes('btn'),
    },
    variants: {
        color: buttonColors('root'),
        // M3's five common buttons (#415). Unset, a tonal button is
        // secondary-container and an outlined one on-surface-variant, as M3
        // draws them; a `color` rebinds each to that role.
        variant: {
            filled: { root: { base: {
                '--btn-fill': 'var(--btn-accent)',
                '--btn-label': 'var(--btn-on-accent)',
                '--btn-shadow-hover': 'var(--shadow-level1)',
            } } },
            tonal: { root: { base: {
                '--btn-fill': 'var(--btn-soft, var(--color-secondary-container))',
                '--btn-label': 'var(--btn-on-soft, var(--color-secondary-container-content))',
                '--btn-shadow-hover': 'var(--shadow-level1)',
            } } },
            elevated: { root: { base: {
                '--btn-fill': 'var(--color-surface-container-low)',
                '--btn-label': 'var(--btn-accent)',
                '--btn-shadow': 'var(--shadow-level1)',
                '--btn-shadow-hover': 'var(--shadow-level2)',
            } } },
            outlined: { root: { base: {
                '--btn-fill': 'transparent',
                '--btn-label': 'var(--btn-ink, var(--color-surface-variant-content))',
                '--btn-border': 'var(--color-outline-variant)',
                '--btn-disabled-fill': 'transparent',
                '--btn-disabled-border': 'color-mix(in oklch, var(--color-base-content) 10%, transparent)',
            } } },
            text: { root: { base: {
                '--btn-fill': 'transparent',
                '--btn-label': 'var(--btn-accent)',
                '--btn-disabled-fill': 'transparent',
            } } },
        },
        size: buttonSizeVariants('root'),
        shape: buttonShapes('root'),
    },
    modifiers: {
        icon: iconButton('root'),
        /**
         * M3's FAB: the role's container on the large corner at level 3
         * (level 4 on hover), no press morph. `fab` alone is the extended
         * FAB, sized by its label; `fab` + `icon` is the square FAB. `filled`
         * takes the role colour itself, `elevated` the surface FAB.
         */
        fab: {
            root: {
                base: {
                    '--btn-fill': 'var(--btn-soft, var(--color-primary-container))',
                    '--btn-label': 'var(--btn-on-soft, var(--color-primary-container-content))',
                    '--btn-shadow': 'var(--shadow-level3)',
                    '--btn-shadow-hover': 'var(--shadow-level4)',
                    '--btn-height': dp(56),
                    '--btn-pad': dp(16),
                    '--btn-gap': dp(12),
                    '--btn-icon': dp(24),
                    '--btn-icon-only': dp(24),
                    '--btn-radius': 'var(--radius-large)',
                    '--btn-pressed': 'var(--btn-radius)',
                    ...type('title-medium'),
                },
                selectors: {
                    '&[data-variant="filled"]': {
                        '--btn-fill': 'var(--btn-accent)',
                        '--btn-label': 'var(--btn-on-accent)',
                    },
                    '&[data-variant="elevated"]': {
                        '--btn-fill': 'var(--color-surface-container-high)',
                        '--btn-label': 'var(--btn-accent)',
                    },
                },
            },
        },
    },
    compoundVariants: [
        // The standard icon button: M3 draws its icon in on-surface-variant,
        // where a text button's label is the role colour.
        { match: { variant: 'text', icon: true }, parts: { root: { base: {
            '--btn-label': 'var(--btn-ink, var(--color-surface-variant-content))',
        } } } },
        // M3's FAB sizes: small (40dp, r12), FAB (56, r16), medium (80, r20)
        // and large (96, r28) — the square FAB's icon and the extended FAB's
        // label step with them.
        { match: { size: 'xs', fab: true }, parts: { root: { base: {
            '--btn-height': dp(40), '--btn-pad': dp(12), '--btn-radius': 'var(--radius-medium)',
        } } } },
        { match: { size: 'md', fab: true }, parts: { root: { base: {
            '--btn-height': dp(80), '--btn-pad': dp(26), '--btn-radius': 'var(--radius-large-increased)',
            '--btn-icon': dp(28), '--btn-icon-only': dp(28), ...type('title-large'),
        } } } },
        { match: { size: 'lg', fab: true }, parts: { root: { base: {
            '--btn-height': dp(96), '--btn-pad': dp(28), '--btn-radius': 'var(--radius-extra-large)',
            '--btn-icon': dp(36), '--btn-icon-only': dp(36), ...type('headline-small'),
        } } } },
        { match: { size: 'xl', fab: true }, parts: { root: { base: {
            '--btn-height': dp(96), '--btn-pad': dp(28), '--btn-radius': 'var(--radius-extra-large)',
            '--btn-icon': dp(36), '--btn-icon-only': dp(36), ...type('headline-small'),
        } } } },
    ],
    defaultVariants: { variant: 'filled', size: 'sm', shape: 'round' },
};

// ── Tabs ──────────────────────────────────────────────────────────────────
/**
 * A list that holds a `Tabs.Indicator` (#283): MD3's primary-tab indicator
 * slides between tabs, so the active tab hands its own underline to it —
 * otherwise the underline would snap into place under the moving one.
 */
const TABS_WITH_INDICATOR = '[data-scope="tabs"][data-part="list"]:has([data-scope="tabs"][data-part="indicator"])';

export const tabs: RecipeInput = {
    component: 'tabs',
    // Accent default in `tokens:` — the un-attributed render IS the primary
    // variant; `variants.color` only rebinds the custom property.
    // M3's tabs (#419): primary (3dp rounded indicator under the label, the
    // active label in the role) or secondary (2dp flat indicator across the
    // tab, the active label on-surface). The primary indicator is
    // content-width: it reads the `--tabs-indicator-content-*` pair, which
    // is the active tab's `Tabs.TabLabel` when it holds one and the tab's
    // own extent when not (#530).
    tokens: {
        '--tabs-accent': 'var(--color-primary)',
        '--tabs-active-ink': 'var(--tabs-accent)',
        '--tabs-ind-size': '3px',
        '--tabs-ind-radius': '3px',
    },
    parts: {
        root: { base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' } },
        list: {
            base: {
                display: 'flex',
                // The indicator's containing block: `--tabs-indicator-*` are
                // offsets from this padding box.
                position: 'relative',
                background: 'var(--color-surface)',
                // M3's tab divider: 1dp outline-variant.
                borderBottom: 'var(--border) solid var(--color-outline-variant)',
            },
        },
        // NOTE: `active` on a tab is the SELECTED anatomy state, not the
        // `:active` pseudo-class — press styling must stay in `selectors`.
        tab: withPresence(pressable('tab', 'var(--tabs-accent)'), {
            base: {
                appearance: 'none',
                background: 'none',
                border: 'none',
                borderBottom: 'var(--tabs-ind-size) solid transparent',
                marginBottom: 'calc(-1 * var(--border))',
                // M3's tab: 48dp, 16dp in, title-small in on-surface-variant.
                minBlockSize: dp(48),
                boxSizing: 'border-box',
                paddingInline: 'var(--space-md)',
                ...type('title-small'),
                color: 'var(--color-surface-variant-content)',
                cursor: 'pointer',
                transition: motion('color, border-color'),
            },
            states: {
                active: { color: 'var(--tabs-active-ink)', borderBottomColor: 'var(--tabs-accent)' },
                inactive: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                [`${TABS_WITH_INDICATOR} &[data-state="active"]`]: { borderBottomColor: 'transparent' },
            },
        }),
        // MD3's primary-tab indicator: the 3px accent bar with rounded top
        // corners, sliding to the active tab's LABEL — content-width, at
        // least 24dp, centred on the label when it is narrower (#530). The
        // secondary variant widens it to the tab. A border rather than a
        // fill, so forced colours keep it.
        indicator: {
            base: {
                '--tabs-ind-inline': `max(${dp(24)}, var(--tabs-indicator-content-inline-size))`,
                '--tabs-ind-at': 'calc(var(--tabs-indicator-content-inset-inline-start) '
                    + '+ (var(--tabs-indicator-content-inline-size) - var(--tabs-ind-inline)) / 2)',
                position: 'absolute',
                boxSizing: 'border-box',
                pointerEvents: 'none',
                insetInlineStart: 'var(--tabs-ind-at)',
                insetBlockStart: 'calc(var(--tabs-indicator-inset-block-start) + var(--tabs-indicator-block-size) - var(--tabs-ind-size))',
                inlineSize: 'var(--tabs-ind-inline)',
                blockSize: 'var(--tabs-ind-size)',
                borderBlockEnd: 'var(--tabs-ind-size) solid var(--tabs-accent)',
                borderStartStartRadius: 'var(--tabs-ind-radius)',
                borderStartEndRadius: 'var(--tabs-ind-radius)',
                transition: motion('inset-inline-start, inset-block-start, inline-size, block-size'),
            },
            selectors: {
                // A vertical list: the bar runs down the tab's inline-end
                // edge instead.
                '&[data-orientation="vertical"]': {
                    insetInlineStart: 'calc(var(--tabs-indicator-inset-inline-start) + var(--tabs-indicator-inline-size) - var(--tabs-ind-size))',
                    insetBlockStart: 'var(--tabs-indicator-inset-block-start)',
                    inlineSize: 'var(--tabs-ind-size)',
                    blockSize: 'var(--tabs-indicator-block-size)',
                    borderBlockEnd: 'none',
                    borderInlineEnd: 'var(--tabs-ind-size) solid var(--tabs-accent)',
                },
            },
            at: { 'reduced-motion': { base: { transition: 'none' } } },
        },
        // The tab's optional text wrapper (#530), which the indicator
        // measures for its content geometry: an icon beside the text sits on
        // its centre line, and the ink stays the tab's.
        'tab-label': { base: { display: 'inline-flex', alignItems: 'center', gap: 'var(--space-xs)' } },
        panel: {
            base: { fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', lineHeight: 'var(--leading-normal)' },
            states: { active: {}, inactive: {} },
        },
    },
    keyframes: rippleKeyframes('tab'),
    variants: {
        size: {
            xs: { tab: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-2xs) var(--space-2xs)' } } },
            sm: { tab: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-2xs) var(--space-xs)' } } },
            // `md` is the un-attributed render: the base already IS the
            // middle step, so restating it here would be a second copy free
            // to drift. An empty entry emits no rule and keeps the base.
            md: {},
            lg: { tab: { base: { fontSize: 'var(--text-sm)', padding: 'var(--space-xs) var(--space-md)' } } },
            xl: { tab: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-sm) var(--space-lg)' } } },
        },
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--tabs-accent': `var(--color-${c})`,
        } } }])),
        variant: {
            primary: {},
            secondary: {
                root: { base: {
                    '--tabs-active-ink': 'var(--color-base-content)',
                    '--tabs-ind-size': '2px',
                    '--tabs-ind-radius': '0',
                } },
                // The secondary indicator spans the whole tab.
                indicator: { base: {
                    '--tabs-ind-inline': 'var(--tabs-indicator-inline-size)',
                    '--tabs-ind-at': 'var(--tabs-indicator-inset-inline-start)',
                } },
            },
        },
    },
    defaultVariants: { variant: 'primary' },
};

// ── Disclosure ────────────────────────────────────────────────────────────
// A function of the ripple prefix: collapsible and accordion emit separate
// component stylesheets, so each must name (and declare) its own keyframe.
//
// ── WHY THE TRIGGER ITSELF HAS TO SAY IT (#220) ───────────────────────────
// Until #437 the collapsible and accordion anatomies declared `trigger` and
// `panel` and no `indicator`, so there was no part whose job is to point, and
// the trigger's own paint was the only signal. Now each declares an optional
// `indicator` inside the trigger, and this skin draws M3's expand chevron
// there (`disclosureIndicator`, below) — but it stays OPTIONAL: an app that
// renders none (the trigger's `justify-content: space-between` leaves the
// trailing slot to it) still has to read open from closed. So the trigger
// keeps saying it itself.
//
// ── WHAT CAN CARRY IT ──────────────────────────────────────────────────────
// Not a pseudo-element: `pressable()` owns BOTH — `::before` is the MD3 state
// layer and `::after` is the ink ripple — and it is the most-shared helper in
// this package (~26 call sites). Not weight either: this vocabulary maps
// `medium` and `semibold` to the same 500, so a bump to `--weight-semibold`
// would compile to no change at all.
//
// What is left is the element's own box, and MD3 already has a word for it:
// the SELECTED CONTAINER. An expanded header takes the tonal container fill
// and its on-container ink — M3's tonal pairing, which holds in every
// contrast level (the key ink on a container does not: in the high-contrast
// schemes the container goes dark). The inset hairline is the structural half of
// the same sentence: the header now has a panel under it. `box-shadow`, not
// `border-block-end`, so nothing reflows on toggle.
// The accent rides custom properties (`--disclosure-accent`/`-soft`/`-on-soft`)
// declared in each recipe's `tokens:` — the un-attributed render IS the
// primary variant and `variants.color` only rebinds them on the carrier.
const disclosureTrigger = (prefix: string): PartStyles => withPresence(pressable(prefix, 'var(--disclosure-accent)'), {
    base: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-md)',
        ...label,
        fontSize: 'var(--text-md)',
        cursor: 'pointer',
        transition: motion('background, color, box-shadow'),
    },
    states: {
        open: {
            background: 'var(--disclosure-soft)',
            color: 'var(--disclosure-on-soft)',
            boxShadow: 'inset 0 -1px 0 var(--color-outline)',
        },
        closed: {},
        disabled: { opacity: 'var(--disabled-opacity)' },
        ...focusRing,
    },
    at: {
        // A forced palette repaints fills, so the tint and the hairline both
        // vanish; `Highlight`/`HighlightText` is the system's own word for
        // "this one is the selected one".
        'forced-colors': {
            states: {
                open: { background: 'Highlight', color: 'HighlightText', boxShadow: 'none' },
            },
        },
    },
});

/** M3's expand icon (Material Symbols `expand_more`), drawn as a mask in `currentColor`. */
const EXPAND_MASK =
    'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E'
    + '%3Cpath d=\'M12 15.4 6 9.4 7.4 8l4.6 4.6L16.6 8 18 9.4z\'/%3E%3C/svg%3E") center / contain no-repeat';

/**
 * The disclosure chevron (#437): `collapsible.indicator` and
 * `accordion.indicator`, an app's optional mark inside the trigger. M3's
 * 24dp `expand_more` in the trigger's ink, turned half a turn while open —
 * the expanded list item's `expand_less`, reached by motion rather than a
 * glyph swap. Symmetric, so nothing mirrors under RTL.
 */
const disclosureIndicator: PartStyles = {
    base: {
        flex: 'none',
        inlineSize: dp(24),
        blockSize: dp(24),
        background: 'currentColor',
        mask: EXPAND_MASK,
        transition: motion('rotate'),
    },
    states: { open: { rotate: '180deg' }, closed: {} },
    at: {
        'reduced-motion': { base: { transition: 'none' } },
        // A mask paints its box's background, which forced colours revalue —
        // opt out so the chevron stays the trigger's (forced) ink.
        'forced-colors': { base: { forcedColorAdjust: 'none' } },
    },
};

/** The selected-container pair, per role — what `variants.color` rebinds. */
const disclosureColors = (): Record<string, Record<string, PartStyles>> =>
    Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
        '--disclosure-accent': `var(--color-${c})`,
        '--disclosure-soft': `var(--color-${c}-soft)`,
        '--disclosure-on-soft': `var(--color-${c}-soft-content)`,
    } } }]));

/**
 * The disclosure size ramp — trigger padding/type plus the panel inset that
 * follows it. `md` is the un-attributed render.
 */
const disclosureSizes: Record<string, Record<string, PartStyles>> = {
    xs: {
        trigger: { base: { padding: 'var(--space-2xs) var(--space-xs)', fontSize: 'var(--text-xs)' } },
        panel: { base: { padding: '0 var(--space-xs) var(--space-xs)' } },
    },
    sm: {
        trigger: { base: { padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--text-sm)' } },
        panel: { base: { padding: '0 var(--space-sm) var(--space-sm)' } },
    },
    md: {},
    lg: {
        trigger: { base: { padding: 'var(--space-lg)', fontSize: 'var(--text-lg)' } },
        panel: { base: { padding: '0 var(--space-lg) var(--space-lg)' } },
    },
    xl: {
        trigger: { base: { padding: 'var(--space-xl)', fontSize: 'var(--text-xl)' } },
        panel: { base: { padding: '0 var(--space-xl) var(--space-xl)' } },
    },
};

export const collapsible: RecipeInput = withNonNative({
    component: 'collapsible',
    targets: disclosureExit('collapsible'),
    // Public to a design system derived from this one (#73).
    hooks: {
        properties: {
            '--disclosure-accent': 'The accent of the open trigger.',
            '--disclosure-soft': 'The tonal fill of the open trigger: the M3 container of the role.',
            '--disclosure-on-soft': 'The ink on --disclosure-soft.',
        },
    },
    tokens: {
        '--disclosure-accent': 'var(--color-primary)',
        '--disclosure-soft': 'var(--color-primary-container)',
        '--disclosure-on-soft': 'var(--color-primary-container-content)',
    },
    parts: {
        root: withPresence(disclosurePresence, {
            base: {
                background: 'var(--color-surface-container)',
                color: 'var(--color-surface-container-content)',
                borderRadius: 'var(--radius-extra-large)',
                overflow: 'hidden',
            },
            states: { open: {}, closed: {} },
        }),
        trigger: disclosureTrigger('collapsible'),
        indicator: disclosureIndicator,
        panel: {
            base: { padding: '0 var(--space-md) var(--space-md)', lineHeight: 'var(--leading-normal)' },
            states: { open: {}, closed: {} },
        },
    },
    keyframes: rippleKeyframes('collapsible'),
    variants: { color: disclosureColors(), size: disclosureSizes },
});

export const accordion: RecipeInput = {
    component: 'accordion',
    targets: disclosureExit('accordion'),
    tokens: {
        '--disclosure-accent': 'var(--color-primary)',
        '--disclosure-soft': 'var(--color-primary-container)',
        '--disclosure-on-soft': 'var(--color-primary-container-content)',
    },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' },
            // `orientation="horizontal"` (#276): the containers sit in a row.
            selectors: { '&[data-orientation="horizontal"]': { flexDirection: 'row', alignItems: 'start' } },
        },
        item: withPresence(disclosurePresence, {
            base: {
                background: 'var(--color-surface-container)',
                color: 'var(--color-surface-container-content)',
                borderRadius: 'var(--radius-extra-large)',
                overflow: 'hidden',
            },
            states: { open: {}, closed: {} },
            selectors: { '[data-scope="accordion"][data-part="root"][data-orientation="horizontal"] > &': { flex: '1 1 0', minInlineSize: '0' } },
        }),
        trigger: disclosureTrigger('accordion'),
        indicator: disclosureIndicator,
        panel: {
            base: { padding: '0 var(--space-md) var(--space-md)', lineHeight: 'var(--leading-normal)' },
            states: { open: {}, closed: {} },
        },
    },
    keyframes: rippleKeyframes('accordion'),
    variants: { color: disclosureColors(), size: disclosureSizes },
};

/**
 * MD3's outlined button, the shape every overlay opens from — a fully rounded
 * pill in the primary ink inside a hairline outline. Dialog, popover and menu
 * wear it under `pressable`; tooltip wears it bare (see there).
 */
const outlinedTrigger: CssProps = {
    appearance: 'none',
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    // Phase 2's outlined button (#415/#418): the Expressive ramp's metrics,
    // an outline-variant hairline, and on-surface-variant ink unless a
    // `color` rebinds `--overlay-accent` — on the trigger itself, the
    // carrier part of these rootless scopes.
    ...buttonStep('sm'),
    blockSize: 'var(--btn-height)',
    paddingInline: 'var(--btn-pad)',
    gap: 'var(--btn-gap)',
    borderRadius: 'calc(var(--btn-height) / 2)',
    border: 'var(--btn-outline) solid var(--color-outline-variant)',
    background: 'transparent',
    color: 'var(--overlay-accent, var(--color-surface-variant-content))',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
};

/** The ink an overlay trigger's state layer and ripple take: its label's. */
const overlayInk = 'var(--overlay-accent, var(--color-surface-variant-content))';

/**
 * M3's text button, the dismiss actions' shape (dialog close and cancel,
 * popover and drawer close): 40dp, 12dp in, the primary label.
 */
const textAction: CssProps = {
    appearance: 'none',
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    blockSize: dp(40),
    paddingInline: 'var(--space-sm)',
    border: 'none',
    background: 'transparent',
    color: 'var(--color-primary)',
    borderRadius: dp(20),
    ...label,
    cursor: 'pointer',
};

/**
 * The disabled state every overlay trigger and dismiss action wears — the
 * button's own fade (#191). These parts paint an author ink, which overrides
 * the UA's GrayText for `:disabled`, and `pressable` only drops the hover and
 * press layers — so without this a disabled trigger kept its full accent and
 * a pointer cursor.
 */
const disabledFade: CssProps = {
    // M3's disabled button colours (#418), as Button wears them (#415):
    // the label at 38% on-surface, the outline at 12%.
    color: 'color-mix(in oklch, var(--color-base-content) 38%, transparent)',
    borderColor: 'color-mix(in oklch, var(--color-base-content) 12%, transparent)',
    cursor: 'not-allowed',
};

/** What every outlined-trigger recipe declares: nothing — unset, the ink is on-surface-variant. */
const overlayTriggerTokens = {};

/**
 * The axes for the outlined overlay triggers (#321). Dialog, popover,
 * tooltip and menu carry their axis props on the TRIGGER — the anatomy's
 * carrier part. Colour and size style the pill itself: colour re-inks the
 * label (Material's role tokens are inks by construction — the same
 * raw-role ink the button's outlined variant uses), size steps the pill on
 * the button's own ramp. The popup mirrors every axis attribute the trigger
 * renders (#514, `mirrorsAxes`), so an axis COULD reach the surface; these
 * two deliberately leave it alone — a Material menu or dialog does not take
 * its opener's role or size. The surface-level choices M3 does make are
 * popup variants: dialog's `basic` / `full-screen` and tooltip's `plain` /
 * `rich`.
 */
const overlayTriggerColors = (): Record<string, Record<string, PartStyles>> =>
    Object.fromEntries(ROLES.map((c) => [c, { trigger: { base: {
        '--overlay-accent': `var(--color-${c})`,
    } } }]));

// The button's Expressive ramp (#415): `sm` (40dp) is the un-attributed render.
const overlayTriggerSizes: Record<string, Record<string, PartStyles>> = {
    xs: { trigger: { base: buttonStep('xs') } },
    sm: {},
    md: { trigger: { base: buttonStep('md') } },
    lg: { trigger: { base: buttonStep('lg') } },
    xl: { trigger: { base: buttonStep('xl') } },
};

// ── Dialog ────────────────────────────────────────────────────────────────
export const dialog: RecipeInput = {
    component: 'dialog',
    tokens: overlayTriggerTokens,
    parts: {
        trigger: withPresence(pressable('dialog', overlayInk), {
            base: outlinedTrigger,
            states: { open: {}, closed: {}, disabled: disabledFade, ...focusRing },
        }),
        popup: withPresence(popupPresence('translateY(24px) scale(0.94)'), {
            // M3's basic dialog, at every width: a full-screen dialog is
            // chosen per use (a long form), not per viewport, so it is the
            // `full-screen` variant below — the trigger's `variant`, which
            // the popup mirrors (#514).
            base: {
                // A <dialog> keeps the UA's `content-box`, and zero ships no
                // reset — so a width or max-width meant to leave a gutter
                // grew by the padding, and at phone width the popup ran past
                // both edges (#101). Its box is the border box.
                boxSizing: 'border-box',
                width: 'calc(100% - var(--space-2xl))',
                // M3's basic dialog: 280-560dp wide.
                minWidth: `min(${dp(280)}, calc(100% - var(--space-2xl)))`,
                maxWidth: '35rem',
                // `auto` stretches an inset-positioned modal to fill; `fit-content`
                // is the UA's own dialog default and hugs the content (#114).
                height: 'fit-content',
                maxHeight: 'calc(100% - var(--space-2xl))',
                margin: 'auto',
                padding: 'var(--space-lg)',
                ...raised('level3'),
                '--tf-surface': 'var(--color-surface-container-high)',
            },
            states: { open: {}, closed: {} },
        }),
        backdrop: {
            base: { background: 'color-mix(in oklch, var(--color-scrim) 32%, transparent)' },
            states: { open: {}, closed: {} },
        },
        title: {
            base: {
                margin: '0 0 var(--space-md)',
                // M3 dialog: headline-small title, body-medium supporting
                // text in on-surface-variant.
                ...type('headline-small'),
            },
        },
        description: {
            base: {
                margin: '0 0 var(--space-lg)',
                ...type('body-medium'),
                color: 'var(--color-surface-variant-content)',
            },
        },
        // M3's action area: text buttons at the trailing edge, 8px apart,
        // separated from the supporting text by the dialog's own 24px step.
        footer: {
            base: {
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 'var(--space-xs)',
                marginBlockStart: 'var(--space-lg)',
            },
        },
        close: withPresence(pressable('dialog'), {
            base: textAction,
            states: { disabled: disabledFade, ...focusRing },
        }),
        // The alertdialog's least-destructive action — Material's text
        // button, same as close (M3 gives both dialog actions text style).
        cancel: withPresence(pressable('dialog'), {
            base: textAction,
            states: { disabled: disabledFade, ...focusRing },
        }),
    },
    keyframes: rippleKeyframes('dialog'),
    // Colour and size style the trigger — see `overlayTriggerColors`. The
    // variant styles the SURFACE, through the axes the popup mirrors from
    // its trigger (#514): `basic` is the base above, and `full-screen` is
    // M3's full-screen dialog — the whole viewport, square, flat, on the
    // same container — chosen per use, at any width.
    variants: {
        color: overlayTriggerColors(),
        size: overlayTriggerSizes,
        variant: {
            basic: {},
            'full-screen': {
                popup: {
                    base: {
                        width: '100%',
                        minWidth: '0',
                        maxWidth: 'none',
                        height: '100dvh',
                        maxHeight: 'none',
                        margin: '0',
                        borderRadius: '0',
                        boxShadow: 'none',
                    },
                },
            },
        },
    },
    defaultVariants: { variant: 'basic' },
};

// ── Floating surfaces ─────────────────────────────────────────────────────
/**
 * Every Material floating surface scales in, and a scale grows from its
 * origin: `--transform-origin` is the anchor-facing edge the
 * anchored-position strategy publishes (#278), so a menu below its trigger
 * unfolds from the trigger, and from above once flipped.
 */
const growFromAnchor: CssProps = { transformOrigin: 'var(--transform-origin, center)' };

/**
 * M3's menu surface (#418): surface-container at level 2 on the extra-small
 * corner, 8dp above and below the full-width items. Menus, the select's and
 * combobox's listboxes and submenus all wear it.
 */
const floating: CssProps = {
    background: 'var(--color-surface-container)',
    color: 'var(--color-surface-container-content)',
    border: 'none',
    borderRadius: 'var(--radius-extra-small)',
    boxShadow: 'var(--shadow-level2)',
    paddingBlock: 'var(--space-xs)',
    paddingInline: '0',
    ...growFromAnchor,
};

/**
 * M3's rich tooltip (#418) — what Popover and HoverCard are here, and the
 * surface of Tooltip's `rich` variant (#514):
 * surface-container at level 2 on the medium corner, 12dp over 8dp and 16dp
 * in, a title-small subhead and body-medium supporting text, both
 * on-surface-variant, at most 320dp wide.
 */
const richTooltip: CssProps = {
    background: 'var(--color-surface-container)',
    color: 'var(--color-surface-variant-content)',
    border: 'none',
    borderRadius: 'var(--radius-medium)',
    boxShadow: 'var(--shadow-level2)',
    paddingBlockStart: 'var(--space-sm)',
    paddingBlockEnd: 'var(--space-xs)',
    paddingInline: 'var(--space-md)',
    maxInlineSize: dp(320),
    ...type('body-medium'),
    ...growFromAnchor,
};

/**
 * The arrow a floating surface grows toward its anchor (#279). Material's
 * own surfaces carry none — it is here because an app that renders one
 * should get the surface it points from, not a stray box: borderless, in
 * the surface's container tone, and scaled in with the popup (it is a
 * child, so the popup's `transform-origin` carries it).
 */
const surfaceArrow = (scope: string, background: string): PartStyles =>
    popupArrow(scope, { size: '0.5rem', paint: { background, border: 'none' } });

/**
 * A listbox menu sized by the same published geometry: at least the width of
 * the field that opened it (`--anchor-width`, Material's 12rem menu floor
 * otherwise) and never taller than the room on the side it opened to
 * (`--available-height`), scrolling past a 20rem cap. Border-box, so both
 * bounds measure the box the strategy positions.
 */
const anchoredListbox: CssProps = {
    boxSizing: 'border-box',
    minWidth: 'var(--anchor-width, 12rem)',
    maxHeight: 'min(20rem, var(--available-height, 20rem))',
    overflowY: 'auto',
};

export const popover: RecipeInput = {
    component: 'popover',
    tokens: overlayTriggerTokens,
    parts: {
        trigger: withPresence(pressable('popover', overlayInk), {
            base: outlinedTrigger,
            states: { open: {}, closed: {}, disabled: disabledFade, ...focusRing },
        }),
        popup: withPresence(popupPresence('scale(0.9)'), {
            base: { ...richTooltip, '--tf-surface': 'var(--color-surface-container)' },
            states: { open: {}, closed: {} },
            selectors: popupArrowHost('popover'),
        }),
        // The rich tooltip's subhead and supporting text.
        title: { base: { margin: '0 0 var(--space-2xs)', ...type('title-small') } },
        description: {
            base: {
                margin: '0 0 var(--space-xs)',
                ...type('body-medium'),
                color: 'var(--color-surface-variant-content)',
            },
        },
        arrow: surfaceArrow('popover', 'var(--color-surface-container)'),
        // The rich tooltip's action: a text button.
        close: withPresence(pressable('popover'), {
            base: textAction,
            states: { disabled: disabledFade, ...focusRing },
        }),
    },
    keyframes: rippleKeyframes('popover'),
    // Trigger-carried axes — same wiring as dialog, same reason.
    variants: { color: overlayTriggerColors(), size: overlayTriggerSizes },
};

export const tooltip: RecipeInput = {
    component: 'tooltip',
    tokens: overlayTriggerTokens,
    parts: {
        // The outlined trigger its three sibling overlays wear, without
        // `pressable`. Not all of `pressable` would be dead here — its hover
        // state layer keys on `:hover:not([data-disabled])` and would work
        // fine. Its press half would not: `&[data-pressed]…::before` and
        // `&[data-press-animating]::after` read attributes tooltip's anatomy
        // does not declare and the runtime never publishes, and the `::after`
        // ripple geometry keys on `--press-x/y/r`, which nothing sets. Taking
        // the helper for the hover layer alone would ship those three rules
        // dead and drag a `rippleKeyframes('tooltip')` along to declare the
        // animation they name — so the hover layer is not worth it, and the
        // outlined shape is extracted instead. `cursor: help` is the
        // deliberate deviation: nothing opens.
        trigger: {
            base: { ...outlinedTrigger, cursor: 'help' },
            states: { open: {}, closed: {}, disabled: disabledFade, ...focusRing },
        },
        popup: withPresence(popupPresence('scale(0.85)'), {
            // M3's plain tooltip: inverse-surface, body-small, 24dp tall at
            // least, 4 x 8dp in, at most 200dp wide, no elevation. The
            // surface is a variable the arrow reads too, so the `rich`
            // variant below repaints both.
            base: {
                boxSizing: 'border-box',
                '--tooltip-surface': 'var(--color-inverse-surface)',
                background: 'var(--tooltip-surface)',
                color: 'var(--color-inverse-surface-content)',
                borderRadius: 'var(--radius-extra-small)',
                minBlockSize: dp(24),
                maxInlineSize: dp(200),
                paddingBlock: 'var(--space-2xs)',
                paddingInline: 'var(--space-xs)',
                ...type('body-small'),
                ...growFromAnchor,
            },
            states: { open: {}, closed: {} },
            selectors: popupArrowHost('tooltip'),
        }),
        arrow: surfaceArrow('tooltip', 'var(--tooltip-surface)'),
    },
    // Colour and size style the trigger, same as dialog: the bubble stays
    // Material's tooltip whatever the trigger's colour. The variant picks
    // the bubble (#514 — the popup mirrors its trigger's axes): `plain` is
    // the base above, and `rich` is M3's rich tooltip surface, the one
    // Popover and HoverCard wear. A tooltip is never interactive, so a rich
    // tooltip with a subhead and actions stays a Popover or a HoverCard.
    variants: {
        color: overlayTriggerColors(),
        size: overlayTriggerSizes,
        variant: {
            plain: {},
            rich: {
                popup: {
                    base: {
                        ...richTooltip,
                        '--tooltip-surface': 'var(--color-surface-container)',
                        background: 'var(--tooltip-surface)',
                        minBlockSize: '0',
                    },
                },
            },
        },
    },
    defaultVariants: { variant: 'plain' },
};

/**
 * Hover card — Material's rich tooltip behind an inline text link. The
 * trigger is body text: a primary-ink link, underlined as M3 underlines a
 * link set in running copy, and hover lays the 8% state layer of its own
 * ink under it (Material marks interaction by tone). The card is the rich
 * tooltip's surface — `surface-container-high` at level 2, grown from the
 * anchor — at the popover's width.
 */
export const hoverCard: RecipeInput = {
    component: 'hover-card',
    parts: {
        trigger: {
            base: {
                color: 'var(--color-primary)',
                textDecorationLine: 'underline',
                textUnderlineOffset: '0.15em',
                borderRadius: 'var(--radius-extra-small)',
                cursor: 'pointer',
                transition: 'background var(--duration-short2) var(--ease-standard)',
            },
            states: {
                hover: { background: 'color-mix(in oklch, currentColor 8%, transparent)' },
                open: { background: 'color-mix(in oklch, currentColor 8%, transparent)' },
                closed: {},
                ...focusRing,
            },
        },
        popup: withPresence(popupPresence('scale(0.9)'), {
            base: { ...richTooltip, '--tf-surface': 'var(--color-surface-container)' },
            states: { open: {}, closed: {} },
            selectors: popupArrowHost('hover-card'),
        }),
        arrow: surfaceArrow('hover-card', 'var(--color-surface-container)'),
    },
    // Trigger-carried axes: colour is the link's ink, size its type.
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { trigger: { base: { color: `var(--color-${c})` } } }])),
        size: {
            xs: { trigger: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { trigger: { base: { fontSize: 'var(--text-sm)' } } },
            md: {},
            lg: { trigger: { base: { fontSize: 'var(--text-md)' } } },
            xl: { trigger: { base: { fontSize: 'var(--text-lg)' } } },
        },
    },
};

/**
 * M3's menu item state: an on-surface focus state layer over the menu's
 * container — never a coloured fill, which in the high-contrast schemes goes
 * dark under dark ink.
 */
const menuStateLayer = 'color-mix(in oklch, var(--color-surface-container-high-content) 10%, transparent)';

export const menu: RecipeInput = {
    component: 'menu',
    tokens: overlayTriggerTokens,
    parts: {
        trigger: withPresence(pressable('menu', overlayInk), {
            base: outlinedTrigger,
            states: { open: {}, closed: {}, disabled: disabledFade, ...focusRing },
        }),
        popup: withPresence(popupPresence('scale(0.9)'), {
            base: { ...floating, minWidth: '12rem' },
            states: { open: {}, closed: {} },
            selectors: popupArrowHost('menu'),
        }),
        arrow: surfaceArrow('menu', 'var(--color-surface-container)'),
        // The popup keeps no overflow clip; the item's own clips its ripple.
        item: withPresence(pressable('menu'), {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                // M3's menu item: 48dp, 12dp in, label-large, full width.
                minBlockSize: dp(48),
                boxSizing: 'border-box',
                paddingInline: 'var(--space-sm)',
                ...type('label-large'),
                cursor: 'pointer',
                transition: motion('background'),
            },
            states: {
                highlighted: { background: menuStateLayer },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
        }),
        // The stateful rows share the item's shape and its ripple; the mark
        // well in front says which are on. No pseudo-element mark on the ROW —
        // pressable() owns both its pseudos — so the glyph lives on the
        // indicator part, which has its own.
        'checkbox-item': withPresence(pressable('menu'), {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                // M3's menu item: 48dp, 12dp in, label-large, full width.
                minBlockSize: dp(48),
                boxSizing: 'border-box',
                paddingInline: 'var(--space-sm)',
                ...type('label-large'),
                cursor: 'pointer',
                transition: motion('background'),
            },
            states: {
                highlighted: { background: menuStateLayer },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                checked: {}, unchecked: {},
                ...focusRing,
            },
        }),
        'radio-item': withPresence(pressable('menu'), {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                // M3's menu item: 48dp, 12dp in, label-large, full width.
                minBlockSize: dp(48),
                boxSizing: 'border-box',
                paddingInline: 'var(--space-sm)',
                ...type('label-large'),
                cursor: 'pointer',
                transition: motion('background'),
            },
            states: {
                highlighted: { background: menuStateLayer },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                checked: {}, unchecked: {},
                ...focusRing,
            },
        }),
        // The reserved mark column; the glyph appears while checked, in the
        // row's own ink.
        'item-indicator': {
            base: {
                width: '1em',
                flexShrink: '0',
                fontSize: 'var(--text-sm)',
                lineHeight: 'var(--leading-none)',
            },
            states: { checked: {}, unchecked: {} },
            selectors: {
                '&[data-state="checked"]::after': { content: '"\\2713"' },
            },
        },
        // The item look plus a chevron; `open` keeps the state layer while
        // focus is inside the submenu.
        'sub-trigger': withPresence(pressable('menu'), {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                // M3's menu item: 48dp, 12dp in, label-large, full width.
                minBlockSize: dp(48),
                boxSizing: 'border-box',
                paddingInline: 'var(--space-sm)',
                ...type('label-large'),
                cursor: 'pointer',
                transition: motion('background'),
            },
            states: {
                highlighted: { background: menuStateLayer },
                open: { background: menuStateLayer },
                closed: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            // No pseudo-element chevron here: pressable() owns BOTH ::before
            // (state layer) and ::after (ripple). The open-state layer is the
            // affordance; a chevron is content the app supplies.
        }),
        'sub-popup': withPresence(popupPresence('translateX(-4px) scale(0.95)'), {
            base: { ...floating, minWidth: '12rem' },
            states: { open: {}, closed: {} },
        }),
        group: { base: { padding: 'var(--space-2xs) 0' } },
        'group-label': {
            base: {
                padding: 'var(--space-2xs) var(--space-md)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'var(--color-surface-variant-content)',
            },
        },
        // M3's trailing supporting text: outline ink, pushed to the row's end.
        shortcut: {
            base: {
                marginInlineStart: 'auto',
                paddingInlineStart: 'var(--space-lg)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'var(--color-surface-variant-content)',
            },
        },
        separator: {
            base: { height: 'var(--border)', margin: 'var(--space-xs) 0', background: 'var(--color-outline-variant)' },
        },
    },
    keyframes: rippleKeyframes('menu'),
    // Trigger-carried axes — same wiring as dialog, same reason: the popup
    // and its items see them (#514), and stay M3's menu by choice.
    variants: { color: overlayTriggerColors(), size: overlayTriggerSizes },
};

// The M3 menu bar: a surface-container strip the menu triggers sit in.
export const menubar: RecipeInput = {
    component: 'menubar',
    tokens: { '--menubar-surface': 'var(--color-surface-container)' },
    parts: {
        root: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2xs)',
                padding: 'var(--space-2xs)',
                width: 'max-content',
                maxWidth: '100%',
                flexWrap: 'wrap',
                background: 'var(--menubar-surface)',
                borderRadius: 'var(--radius-extra-large)',
            },
            // The triggers fade themselves.
            states: { disabled: {} },
            selectors: {
                '&[data-orientation="vertical"]': { flexDirection: 'column', alignItems: 'stretch' },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--menubar-surface': `color-mix(in oklch, var(--color-${c}) 10%, var(--color-surface-container))`,
        } } }])),
        size: {
            xs: { root: { base: { gap: '0', padding: '0' } } },
            sm: { root: { base: { padding: 'var(--space-2xs)' } } },
            md: {},
            lg: { root: { base: { gap: 'var(--space-sm)', padding: 'var(--space-sm)' } } },
            xl: { root: { base: { gap: 'var(--space-md)', padding: 'var(--space-sm)' } } },
        },
    },
};

export const select: RecipeInput = {
    component: 'select',
    // Accent defaults in `tokens:` — the un-attributed render IS the primary
    // variant; `variants.color` only rebinds the custom properties.
    tokens: {
        '--select-accent': 'var(--color-primary)',
    },
    parts: {
        root: tfRoot(),
        // M3's exposed dropdown menu is a text field (#416): the trigger is
        // the filled or outlined box, the value its body-large text, and a
        // `Field.Label` above it floats exactly as it does over an input.
        // The press ripples, as MDC's filled select did; the ripple's state
        // layer is the hover, so the box's own hover tint stands down.
        trigger: withPresence(withPresence(tfBox(), pressable('select', 'var(--color-base-content)')), {
            base: {
                '--tf-hover-fill': 'var(--tf-fill)',
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2xs)',
                minInlineSize: '12rem',
                paddingInlineStart: 'var(--space-md)',
                paddingInlineEnd: 'var(--space-sm)',
                paddingBlockStart: `var(--tf-in-top, calc((var(--tf-height) - ${dp(24)}) / 2))`,
                paddingBlockEnd: `var(--tf-in-bottom, calc((var(--tf-height) - ${dp(24)}) / 2))`,
                ...type('body-large'),
                cursor: 'pointer',
            },
            states: {
                open: {},
                closed: {},
                // Readonly answers to nothing, so it does not invite a click.
                readonly: { cursor: 'default' },
                disabled: {},
                invalid: {},
                'focus-visible': { '--tf-indicator-color': 'var(--tf-accent)', '--tf-outline-color': 'var(--tf-accent)' },
            },
        }),
        value: {
            base: { flex: '1', textAlign: 'start', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
            selectors: {
                '&[data-placeholder]': { color: 'var(--color-surface-variant-content)' },
                ...tfRestingPlaceholder('[data-scope="select"][data-part="root"]', '&[data-placeholder]'),
            },
        },
        // M3's trailing dropdown arrow: 24dp on-surface-variant, turned while open.
        indicator: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minInlineSize: dp(24),
                color: 'var(--color-surface-variant-content)',
                transition: motion('transform'),
            },
            states: {
                open: { transform: 'rotate(180deg)' },
                closed: {},
                // Room for the clear-trigger laid over the field (#280) — the
                // `clearable` flag the runtime stamps while it renders (#387).
                clearable: { marginInlineStart: 'calc(var(--space-2xl) + var(--space-sm))' },
            },
            at: { 'reduced-motion': { base: { transition: 'none' } } },
        },
        // Clears the selection (#280): an icon button in the filled field's
        // trailing slot, before the dropdown arrow — on-surface ink with the
        // 8% state layer on hover.
        'clear-trigger': {
            base: {
                appearance: 'none',
                position: 'absolute',
                insetBlock: '0',
                // Centred in the field at WCAG 2.5.8's 24px target, shrinking
                // only with a field too short to hold it.
                marginBlock: 'auto',
                blockSize: 'min(1.5rem, 100%)',
                minInlineSize: '1.5rem',
                insetInlineEnd: 'calc(var(--space-md) + 1em + var(--space-xs))',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 var(--space-xs)',
                border: 'none',
                background: 'transparent',
                color: 'var(--color-surface-container-content)',
                font: 'inherit',
                fontSize: 'var(--text-md)',
                lineHeight: 'var(--leading-none)',
                borderRadius: '50%',
                cursor: 'pointer',
                transition: motion('background'),
            },
            states: {
                hover: { background: 'color-mix(in oklab, var(--color-surface-container-content) 8%, transparent)' },
                ...focusRing,
            },
        },
        popup: withPresence(popupPresence('scale(0.9)'), { base: { ...floating, ...anchoredListbox }, states: { open: {}, closed: {} } }),
        // The optgroup equivalent (#325) — the menu's group grammar.
        group: { base: { padding: 'var(--space-2xs) 0' } },
        'group-label': {
            base: {
                padding: 'var(--space-2xs) var(--space-md)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'var(--color-surface-variant-content)',
            },
        },
        // A windowed group's heading (#127): the same overline as the label,
        // as a row of the flat window instead of inside a `group`.
        'group-heading': {
            base: {
                padding: 'var(--space-2xs) var(--space-md)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'var(--color-surface-variant-content)',
            },
        },
        item: withPresence(pressable('select', 'var(--select-accent)'), {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                // M3's menu item: 48dp, 12dp in, label-large, full width.
                minBlockSize: dp(48),
                boxSizing: 'border-box',
                paddingInline: 'var(--space-sm)',
                ...type('label-large'),
                cursor: 'pointer',
            },
            states: {
                highlighted: { background: menuStateLayer },
                // MD3's secondary-container fill for a selected row — the
                // pairing tree-view and the segmented button use. Deliberately
                // NOT the accent.
                selected: { background: 'var(--color-secondary-container)', color: 'var(--color-secondary-container-content)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
                ...focusRing,
            },
        }),
        // The check takes the row's ink: on-secondary-container once selected.
        'item-indicator': { base: { color: 'inherit' } },
        // The menu's rule between runs of options (#280).
        separator: {
            base: { height: 'var(--border)', margin: 'var(--space-xs) 0', background: 'var(--color-outline-variant)' },
        },
        'hidden-input': { base: { position: 'absolute', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none' } },
    },
    keyframes: rippleKeyframes('select'),
    variants: {
        // The role is the focused box and the item ripple.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--select-accent': `var(--color-${c})`,
            '--tf-accent': `var(--color-${c})`,
        } } }])),
        variant: tfVariants('root'),
        size: tfSizes('root'),
    },
    defaultVariants: { variant: 'filled' },
};

// ── Selection controls ────────────────────────────────────────────────────
export const switchRecipe: RecipeInput = {
    component: 'switch',
    // Public to a design system derived from this one (#73).
    hooks: {
        properties: {
            '--switch-width': 'The track width.',
            '--switch-height': 'The track height.',
            '--switch-accent': 'The checked track fill.',
            '--switch-on-accent': 'The ink on --switch-accent.',
        },
    },
    tokens: {
        '--switch-width': 'calc(var(--size-selector) * 13)',
        '--switch-height': 'calc(var(--size-selector) * 8)',
        // Accent defaults — the un-attributed render IS the primary variant;
        // `variants.color` only rebinds these (the toast shape).
        '--switch-accent': 'var(--color-primary)',
        '--switch-on-accent': 'var(--color-primary-content)',
        '--switch-soft': 'var(--color-primary-container)',
    },
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
            },
            states: { checked: {}, unchecked: {}, readonly: { cursor: 'default' }, disabled: { cursor: 'not-allowed' } },
        },
        // Material's switch state layer rides the THUMB (which travels and
        // grows), so the held layer is a thumb pseudo lit from the control's
        // flag via a descendant selector. No one-shot ripple here: the
        // runtime clears `data-press-animating` unless an animation targets
        // the flagged element itself, and the thumb is a descendant.
        control: {
            base: {
                display: 'inline-block',
                position: 'relative',
                width: 'var(--switch-width)',
                height: 'var(--switch-height)',
                borderRadius: '624rem',
                // M3's unselected track: surface-container-highest in a 2dp outline.
                background: 'var(--color-surface-container-highest)',
                border: '2px solid var(--color-outline)',
                transition: motion('background, border-color'),
            },
            states: {
                checked: { background: 'var(--switch-accent)', borderColor: 'var(--switch-accent)' },
                unchecked: {},
                // M3's error switch: outline, selected track and handle all
                // move to `error`. Rebinding the accent carries the checked
                // track and the thumb's ink with it — `-content` pairs with
                // its own role, and `primary-content` on `error` is not a pair
                // the palette checks. The outline is stated because the accent
                // does not reach it while unchecked.
                invalid: {
                    '--switch-accent': 'var(--color-error)',
                    '--switch-on-accent': 'var(--color-error-content)',
                    borderColor: 'var(--color-error)',
                },
                ...focusRing,
            },
            selectors: {
                // No hover layer on a readonly switch: it would promise a
                // press that changes nothing.
                '&:hover:not([data-disabled], [data-readonly]) [data-part="thumb"]::before': { opacity: 'var(--state-hover)' },
                '&[data-pressed]:not([data-disabled]) [data-part="thumb"]::before': { opacity: 'var(--state-pressed)' },
                // MD3 ink: on-surface while unselected (deliberately NOT the
                // accent), the accent once checked (the thumb's own ::before).
                '&[data-state="unchecked"] [data-part="thumb"]::before': { background: 'var(--color-base-content)' },
                // M3's handle on hover and press: on-surface-variant while
                // unselected, the role's container once selected — and a
                // press grows it to 28dp whichever it is.
                '&:is(:hover, [data-pressed]):not([data-disabled], [data-readonly])[data-state="unchecked"] [data-part="thumb"]': {
                    background: 'var(--color-surface-variant-content)',
                },
                '&:is(:hover, [data-pressed]):not([data-disabled], [data-readonly])[data-state="checked"] [data-part="thumb"]': {
                    background: 'var(--switch-soft)',
                },
                '&[data-pressed]:not([data-disabled], [data-readonly]) [data-part="thumb"]': {
                    width: 'calc(var(--size-selector) * 7)',
                    height: 'calc(var(--size-selector) * 7)',
                },
                // M3's disabled switch (#417): explicit colours rather than a
                // fade. Unselected: the outline and handle at 12% / 38%
                // on-surface; selected: the track at 12% and the handle surface.
                '&[data-disabled]': {
                    background: 'color-mix(in oklch, var(--color-surface-container-highest), transparent 88%)',
                    borderColor: 'color-mix(in oklch, var(--color-base-content) 12%, transparent)',
                },
                '&[data-disabled][data-state="checked"]': {
                    background: 'color-mix(in oklch, var(--color-base-content) 12%, transparent)',
                    borderColor: 'transparent',
                },
                '&[data-disabled] [data-part="thumb"]': {
                    background: 'color-mix(in oklch, var(--color-base-content) 38%, transparent)',
                },
                '&[data-disabled][data-state="checked"] [data-part="thumb"]': {
                    background: 'var(--color-surface)',
                },
            },
            at: {
                'hover-none': {
                    selectors: { '&:hover:not([data-disabled], [data-readonly]) [data-part="thumb"]::before': { opacity: '0' } },
                },
            },
        },
        thumb: {
            base: {
                position: 'absolute',
                top: '50%',
                insetInlineStart: 'var(--size-selector)',
                width: 'calc(var(--size-selector) * 4)',
                height: 'calc(var(--size-selector) * 4)',
                borderRadius: '624rem',
                background: 'var(--color-outline)',
                transform: 'translateY(-50%)',
                // The handle travels and grows on M3 Expressive's fast spatial
                // spring; its colour on the standard curve.
                transition:
                    'transform var(--duration-spatial-fast) var(--ease-spatial-fast), '
                    + 'width var(--duration-spatial-fast) var(--ease-spatial-fast), '
                    + 'height var(--duration-spatial-fast) var(--ease-spatial-fast), '
                    + 'background-color var(--duration-short2) var(--ease-standard)',
                // The anchor is logical, so the travel has to be too — and
                // `transform` has no logical form, so the direction is carried by
                // a value the RTL rule below can rebind. Half of this is worse
                // than neither: a logical anchor with a physical travel starts the
                // thumb at the reading end and then moves it further that way,
                // off the track. The `-50%` stays signed: it is the vertical
                // centring, which mirrors nothing.
                '--switch-thumb-dir': '1',
            },
            states: {
                checked: {
                    background: 'var(--switch-on-accent)',
                    width: 'calc(var(--size-selector) * 6)',
                    height: 'calc(var(--size-selector) * 6)',
                    transform: 'translate(calc(var(--switch-thumb-dir) * (var(--switch-width) - 100% - var(--size-selector) * 2)), -50%)',
                },
                unchecked: {},
            },
            selectors: {
                [`&${rtl}`]: { '--switch-thumb-dir': '-1' },
                // Fixed halo (the thumb itself grows 4→6 units) that travels
                // with the thumb by construction. Accent ink; the control's
                // descendant selector overrides it to on-surface while
                // unchecked.
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: 'calc(var(--size-selector) * 10)',
                    height: 'calc(var(--size-selector) * 10)',
                    borderRadius: '50%',
                    background: 'var(--switch-accent)',
                    transform: 'translate(-50%, -50%)',
                    opacity: '0',
                    pointerEvents: 'none',
                    transition: 'opacity var(--duration-short2) var(--ease-standard)',
                },
            },
            at: {
                // The halo is paint forced colours cannot tell from the
                // thumb. And the thumb itself is background paint, which the
                // mode revalues to Canvas — the bordered track survived, the
                // handle vanished, and on/off read identically (#189). Opt
                // the handle out of forcing and paint it in system colours:
                // CanvasText at rest, Highlight once checked.
                'forced-colors': {
                    base: { forcedColorAdjust: 'none', background: 'CanvasText' },
                    states: { checked: { background: 'Highlight' } },
                    selectors: {
                        '&::before': { display: 'none' },
                        // A disabled switch draws in GrayText, the forced palette's
                        // own disabled ink, not full-strength ink faded by an
                        // author opacity the user's theme cannot style. Keyed off
                        // the control's flag, which outranks `checked`.
                        '[data-scope="switch"][data-part="control"][data-disabled] &': { background: 'GrayText' },
                    },
                },
            },
        },
        label: {
            base: { ...type('body-large') },
            states: {
                checked: {},
                unchecked: {},
                disabled: { color: 'color-mix(in oklch, var(--color-base-content) 38%, transparent)' },
            },
        },
        'hidden-input': { base: { position: 'absolute', width: '1px', height: '1px', opacity: '0' } },
    },
    variants: {
        size: {
            xs: { root: { base: { '--switch-width': 'calc(var(--size-selector) * 9)', '--switch-height': 'calc(var(--size-selector) * 5.5)' } } },
            sm: { root: { base: { '--switch-width': 'calc(var(--size-selector) * 11)', '--switch-height': 'calc(var(--size-selector) * 6.5)' } } },
            // `md` is the un-attributed render — the defaults in `tokens:`
            // already ARE the middle step.
            md: {},
            lg: { root: { base: { '--switch-width': 'calc(var(--size-selector) * 15)', '--switch-height': 'calc(var(--size-selector) * 9)' } } },
            xl: { root: { base: { '--switch-width': 'calc(var(--size-selector) * 17)', '--switch-height': 'calc(var(--size-selector) * 10)' } } },
        },
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--switch-accent': `var(--color-${c})`,
            '--switch-on-accent': `var(--color-${c}-content)`,
            '--switch-soft': `var(--color-${c}-soft)`,
        } } }])),
    },
    skipStates: { root: ['focus-visible'] },
};

/**
 * The tick container shared by checkbox and radio. Parameterised because the
 * two components carry their OWN accent and size tokens (`--checkbox-*` vs
 * `--radio-*`) — a hardcoded primary here would pin both to one colour and
 * defeat their `variants.color`. The focus ring stays `--color-secondary`
 * (via `focusRing`) on purpose: Material's focus indicator does not follow
 * the accent.
 */
const tickBox = (accent: string, size: string): PartStyles => ({
    base: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        // `size` is the container as Material measures it — 18dp INCLUDING the
        // 2dp stroke, not 18dp of content plus stroke. Without this the box is
        // 4px larger than the token says and the mark inside it, sized off the
        // same token, reads small.
        boxSizing: 'border-box',
        width: size,
        height: size,
        // M3's unselected outline: 2dp on-surface-variant, on-surface on hover.
        border: '2px solid var(--color-surface-variant-content)',
        background: 'transparent',
        transition: motion('background, border-color'),
    },
    states: {
        // Both selected states take the same filled container — in Material
        // the fill means "selected", and it is the MARK inside that says which
        // kind of selected. See `checkbox.indicator`.
        checked: { background: accent, borderColor: accent },
        unchecked: {},
        indeterminate: { background: accent, borderColor: accent },
        ...focusRing,
    },
    selectors: {
        '&[data-state="unchecked"]:hover:not([data-disabled], [data-readonly])': { borderColor: 'var(--color-base-content)' },
        // M3's disabled selection control (#417): explicit colours rather
        // than a fade — the outline and a selected fill at 38% on-surface.
        '&[data-disabled]': { borderColor: 'color-mix(in oklch, var(--color-base-content) 38%, transparent)' },
        '&[data-disabled]:not([data-state="unchecked"])': {
            background: 'color-mix(in oklch, var(--color-base-content) 38%, transparent)',
            borderColor: 'transparent',
        },
    },
});

const checkboxTick = tickBox('var(--checkbox-accent)', 'var(--checkbox-size)');

/**
 * Forced-colours / print fallback for the checkbox mark: geometry out, glyph in.
 *
 * Both arms are painted with `background: currentColor`. A forced palette
 * repaints backgrounds and print drops them, so in both modes the mark has to
 * stop being paint and become type. `::before` keeps its role as the leading
 * mark and becomes the glyph; `::after` is the second half of a stroke that no
 * longer exists, so it goes away entirely.
 *
 * `ink` is the one thing the two renders disagree on, so each condition builds
 * its own object rather than sharing one. Neither may inherit the indicator's
 * `--checkbox-on-accent`: on paper that is white on a fill that did not print,
 * and in forced colours it is an author colour whose ink is then only as good
 * as the UA's remapping of it — the one mode that exists to make ink
 * predictable is the last place to leave it implied.
 */
const markGlyphFallback = (ink: string): PartStyles => ({
    base: {
        display: 'grid',
        placeItems: 'center',
        color: ink,
        fontSize: 'var(--checkbox-mark-size)',
        lineHeight: 'var(--leading-none)',
    },
    selectors: {
        '&::before': {
            position: 'static',
            width: 'auto',
            height: 'auto',
            marginTop: '0',
            background: 'transparent',
            translate: 'none',
            rotate: 'none',
            scale: 'none',
        },
        '&::after': { content: 'none' },
        '&[data-state="checked"]::before': { content: '"\\2713"' },
        '&[data-state="indeterminate"]::before': { content: '"\\2212"' },
    },
});

export const checkbox: RecipeInput = {
    component: 'checkbox',
    // Accent defaults live in `tokens:` — the un-attributed render IS the
    // primary variant, and `variants.color` only rebinds custom properties
    // (the toast shape).
    tokens: {
        // M3's 18dp container at `md`.
        '--checkbox-size': dp(18),
        '--checkbox-accent': 'var(--color-primary)',
        '--checkbox-on-accent': 'var(--color-primary-content)',
        // The mark's own box, and — since #226's re-centring — literally the
        // mark's ink: the arms below are laid out so the tick's bounding box IS
        // this square, centred in the container. Material's check spans 10dp
        // across an 18dp container (0.555), so 0.58 reproduces that ratio at
        // every step of the ramp.
        '--checkbox-mark-size': 'calc(var(--checkbox-size) * 0.58)',
        // Material's 2dp stroke, kept proportional so it scales with the ramp,
        // with a 2px floor so `xs` still reads as a stroke and not a hairline.
        '--checkbox-mark-stroke': 'max(2px, calc(var(--checkbox-size) * 0.111))',
    },
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
            },
            states: { readonly: { cursor: 'default' }, disabled: { cursor: 'not-allowed' } },
        },
        // MD3 selection-control halo: unbounded, centered, coords ignored —
        // M3's 40dp state layer over the 18dp box, scaling with the size step.
        control: withPresence(pressableCentered('checkbox', 'calc(var(--checkbox-size) * 40 / 18)', 'var(--checkbox-accent)'), {
            ...checkboxTick,
            // M3's checkbox corner is 2dp, a component token that is no step
            // of the corner scale: half the `extra-small` step, so it still
            // follows the scale.
            base: { ...checkboxTick.base, borderRadius: 'calc(var(--radius-extra-small) / 2)' },
            states: {
                ...checkboxTick.states,
                /**
                 * M3's error selection control: the container's outline, its
                 * selected fill and its state layer all move to `error`.
                 *
                 * Expressed by rebinding the accent rather than by restating
                 * each fill, so `checked` and `indeterminate` follow without a
                 * second copy of either, and the halo — which reads the same
                 * property — follows too. `--checkbox-on-accent` moves with it
                 * because the mark now sits on an error fill, and a role and
                 * its `-content` are the pair the palette contrast-checks;
                 * `primary-content` on `error` is not.
                 *
                 * `borderColor` is still stated: it is the only one of the
                 * three the accent does not reach in the UNCHECKED state,
                 * which is exactly the state an invalid required checkbox is
                 * in.
                 */
                invalid: {
                    '--checkbox-accent': 'var(--color-error)',
                    '--checkbox-on-accent': 'var(--color-error-content)',
                    borderColor: 'var(--color-error)',
                },
            },
        }),
        /**
         * The mark. Material draws a 2dp stroked check, and it DRAWS it: the
         * short arm sweeps down-right, then the long arm runs out of the elbow
         * up to the tip. Indeterminate is a single horizontal bar.
         *
         * Both are the same two arms. Each arm is a stroke pinned by its
         * LEFT-CENTER to a point on the check's polyline, rotated onto that
         * segment's axis, and scaled along it — so `scale` is literally how
         * much of the stroke has been drawn, and 0 is a check of zero length
         * rather than a hidden one. That is why `unchecked` needs no rule and
         * why `checked` is a draw-on and not a fade.
         *
         * ── THE JOINT ───────────────────────────────────────────────────────
         * Material's tick is ONE polyline: butt caps, a mitre at the elbow
         * (`_checkbox.scss` draws it as a single closed path, and every end of
         * that path is a straight cut perpendicular to its arm). Two arms with
         * rounded caps cannot make that joint — the caps splay and leave a
         * notch at the outer corner, which reads as two bars laid over each
         * other rather than a check. So: no `border-radius` anywhere, and the
         * lead arm runs HALF A STROKE PAST the elbow, which is exactly the
         * mitre. With `w` the stroke and the arms perpendicular, the mitre tip
         * sits `w/√2` from the vertex along the outer bisector — and that point
         * is precisely the far corner of the lead arm extended by `w/2`, so the
         * two rectangles meet there with nothing left over and nothing missing.
         * That extension is why `checked` reads 0.526 for a 0.43-long arm
         * (0.43 + w/2 ÷ mark-size, w/mark-size being the fixed 0.191).
         *
         * ── THE PLACEMENT ───────────────────────────────────────────────────
         * The polyline is positioned so the INK's bounding box is the mark box:
         * with arms of 0.43 and 0.79 at ±45°, ink width = (0.43 + 0.79)/√2 +
         * w·√2 = 1.0 of the box, and the start point at x = w/(2√2) puts the
         * left cap's corner on x = 0. Vertically the same solve against the
         * mitre tip (the lowest ink) and the long arm's outer tip corner (the
         * highest) — hence the `-0.025·size - 0.177·stroke` in the offset,
         * rather than the hand-tuned −0.03 that left the mark a pixel low.
         * Ink aspect lands at 1 : 0.762, Material's own is 1 : 0.754. Measured
         * on a 240px control (so sub-pixel snapping cannot flatter it): ink
         * 139 × 106 with margins L 50.0 / R 51.0 and T 67.5 / B 66.5.
         *
         * The three degrees of freedom go through custom properties so the
         * STATE rules carry the geometry (the package's indirection idiom) and
         * the two arms stay pure paint. Substituting a changed custom property
         * into `scale`/`rotate`/`translate` still produces a transitionable
         * computed value, so the indirection costs no motion.
         */
        indicator: {
            base: {
                position: 'relative',
                // Above `control`'s state layer and ink ripple, both of which
                // are its pseudo-elements and would otherwise wash over the
                // mark mid-press.
                zIndex: '1',
                width: 'var(--checkbox-mark-size)',
                height: 'var(--checkbox-mark-size)',
                color: 'var(--checkbox-on-accent)',
                // Resting: both arms collapsed onto the check's own axes.
                '--checkbox-mark-lead': '0',
                '--checkbox-mark-lead-angle': '45deg',
                // The polyline's start point, solved for a centred ink box —
                // see THE PLACEMENT above. Both terms are lengths, so the
                // centring holds at `xs`, where the stroke hits its 2px floor
                // and stops being 0.191 of the box.
                '--checkbox-mark-lead-offset':
                    'calc(var(--checkbox-mark-stroke) * 0.354) '
                    + 'calc(var(--checkbox-mark-size) * -0.025 - var(--checkbox-mark-stroke) * 0.177)',
                '--checkbox-mark-trail': '0',
            },
            states: {
                // 0.43 of the box, plus the half-stroke that mitres the elbow.
                checked: { '--checkbox-mark-lead': '0.526', '--checkbox-mark-trail': '0.79' },
                // The bar is the SAME leading arm, unrotated and run to full
                // width — so checked ⇄ indeterminate is one continuous morph
                // (the check unfolding) rather than a swap of two marks.
                indeterminate: {
                    '--checkbox-mark-lead': '1',
                    '--checkbox-mark-lead-angle': '0deg',
                    '--checkbox-mark-lead-offset': '0 0',
                    '--checkbox-mark-trail': '0',
                },
                unchecked: {},
            },
            selectors: {
                // Leading arm: elbow-ward at +45° from the solved start point,
                // and half a stroke past the elbow to close the mitre. No
                // `border-radius`: Material's caps are square cuts.
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: '0',
                    top: '50%',
                    width: '100%',
                    height: 'var(--checkbox-mark-stroke)',
                    marginTop: 'calc(var(--checkbox-mark-stroke) / -2)',
                    background: 'currentColor',
                    transformOrigin: 'left center',
                    translate: 'var(--checkbox-mark-lead-offset)',
                    rotate: 'var(--checkbox-mark-lead-angle)',
                    scale: 'var(--checkbox-mark-lead) 1',
                    transition: 'translate var(--duration-short2) var(--ease-emphasized-decelerate), '
                        + 'rotate var(--duration-short2) var(--ease-emphasized-decelerate), '
                        + 'scale var(--duration-short2) var(--ease-emphasized-decelerate)',
                },
                // Trailing arm: out of the elbow at −45°, to the tip. Fixed
                // axis — only its length animates. Its origin IS the elbow the
                // lead arm ends at, to the pixel: the same solved start point
                // plus 0.43 of the box along the +45° axis (0.43/√2 = 0.304).
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    left: '0',
                    top: '50%',
                    width: '100%',
                    height: 'var(--checkbox-mark-stroke)',
                    marginTop: 'calc(var(--checkbox-mark-stroke) / -2)',
                    background: 'currentColor',
                    transformOrigin: 'left center',
                    translate:
                        'calc(var(--checkbox-mark-size) * 0.304 + var(--checkbox-mark-stroke) * 0.354) '
                        + 'calc(var(--checkbox-mark-size) * 0.279 - var(--checkbox-mark-stroke) * 0.177)',
                    rotate: '-45deg',
                    scale: 'var(--checkbox-mark-trail) 1',
                    transition: 'scale var(--duration-short2) var(--ease-emphasized-decelerate)',
                },
                // M3's disabled mark: the surface over the 38% on-surface fill.
                '[data-disabled] > &': { color: 'var(--color-surface)' },
                // Material draws the long arm OUT OF the short one, so the
                // stagger lives on the destination rule: drawing in waits a
                // beat for the lead arm, erasing does not wait for anything.
                '&[data-state="checked"]::after': {
                    transition:
                        'scale var(--duration-short2) var(--ease-emphasized-decelerate) var(--duration-short2)',
                },
            },
            at: {
                // The forced palette's own ink, named rather than left to the
                // UA's revaluation of a theme colour.
                'forced-colors': markGlyphFallback('CanvasText'),
                // Print drops the container fill, so the glyph cannot stay the
                // on-accent colour or it prints white on white. The accent
                // itself is the mark's ink on paper.
                // `--print-ink`, not the accent: the accent is a fill
                // colour with no floor against paper, and it lightens under a
                // dark theme (#233).
                print: markGlyphFallback('var(--print-ink)'),
            },
        },
        label: {
            base: { ...type('body-large') },
            selectors: { '[data-disabled] > &': { color: 'color-mix(in oklch, var(--color-base-content) 38%, transparent)' } },
        },
        'hidden-input': { base: { position: 'absolute', width: '1px', height: '1px', opacity: '0' } },
    },
    keyframes: rippleKeyframes('checkbox'),
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--checkbox-accent': `var(--color-${c})`,
            '--checkbox-on-accent': `var(--color-${c}-content)`,
        } } }])),
        size: {
            xs: { root: { base: { '--checkbox-size': dp(14) } }, label: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { '--checkbox-size': dp(16) } }, label: { base: { fontSize: 'var(--text-sm)' } } },
            // `md` is M3's 18dp — the token default.
            md: {},
            lg: { root: { base: { '--checkbox-size': dp(22) } }, label: { base: { fontSize: 'var(--text-lg)' } } },
            xl: { root: { base: { '--checkbox-size': dp(26) } }, label: { base: { fontSize: 'var(--text-xl)' } } },
        },
    },
    // The container and the mark carry the selection between them; the row and
    // the text have no appearance of their own that depends on it.
    skipStates: {
        root: ['focus-visible', 'checked', 'unchecked', 'indeterminate'],
        label: ['checked', 'unchecked', 'indeterminate'],
    },
};

const radioTick = tickBox('var(--radio-accent)', 'var(--radio-size)');

export const radioGroup: RecipeInput = {
    component: 'radio-group',
    tokens: {
        // M3's 20dp radio at `md`.
        '--radio-size': dp(20),
        // No `--radio-on-accent`: nothing in a Material radio sits ON the
        // accent — the ring and the dot both take the accent itself.
        '--radio-accent': 'var(--color-primary)',
    },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' },
            // `invalid` paints on each `item-control`, which carries the flag
            // itself (#267) — the root only groups the items.
            states: { invalid: {}, required: {} },
        },
        label: { base: { ...label, fontSize: 'var(--text-md)' } },
        item: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
            },
            states: { readonly: { cursor: 'default' }, disabled: { cursor: 'not-allowed' } },
        },
        // Not the full `tickBox`: a radio has no indeterminate state, and
        // reusing the checkbox's states smuggled one in — which the compiler
        // rejected. The halo is M3's 40dp state layer over the 20dp ring,
        // scaling with the size variant.
        'item-control': withPresence(pressableCentered('radio', 'calc(var(--radio-size) * 2)', 'var(--radio-accent)'), {
            base: { ...radioTick.base, borderRadius: '624rem' },
            states: {
                checked: { borderColor: 'var(--radio-accent)' },
                unchecked: {},
                // Rebinding the accent carries M3's error state through the
                // whole selection ring: the ring itself, the dot (which IS
                // the accent — a Material radio's container is never filled)
                // and the press halo. After `checked`, so it holds whichever
                // radio is chosen.
                invalid: {
                    '--radio-accent': 'var(--color-error)',
                    borderColor: 'var(--color-error)',
                },
                ...focusRing,
            },
            selectors: {
                '&[data-state="unchecked"]:hover:not([data-disabled], [data-readonly])': { borderColor: 'var(--color-base-content)' },
                // M3's disabled radio (#417): ring and dot at 38% on-surface.
                '&[data-disabled]': {
                    borderColor: 'color-mix(in oklch, var(--color-base-content) 38%, transparent)',
                    '--radio-accent': 'color-mix(in oklch, var(--color-base-content) 38%, transparent)',
                },
            },
        }),
        'item-indicator': {
            // The dot is always in the DOM, so it has to be hidden when
            // unchecked rather than left to the absence of a rule.
            base: {
                width: 'calc(var(--radio-size) / 2)',
                height: 'calc(var(--radio-size) / 2)',
                borderRadius: '624rem',
                // The ACCENT, not the on-accent. A Material radio's container
                // is never filled — only its ring takes the accent — so the
                // dot sits on the page background, where the on-colour is the
                // one value guaranteed NOT to be readable: `primary-content`
                // is pure white, and white on `base-100` measures 1.02:1.
                background: 'var(--radio-accent)',
                transform: 'scale(0)',
                transition: motion('transform'),
            },
            states: {
                checked: { transform: 'scale(1)' },
                unchecked: {},
            },
            // A forced palette repaints backgrounds, which would erase a dot
            // that is nothing but one. A system colour is honoured as given.
            at: { 'forced-colors': { base: { background: 'CanvasText' } } },
        },
        'item-label': {
            base: { ...type('body-large') },
            selectors: { '[data-disabled] > &': { color: 'color-mix(in oklch, var(--color-base-content) 38%, transparent)' } },
        },
        'hidden-input': { base: { position: 'absolute', width: '1px', height: '1px', opacity: '0' } },
    },
    keyframes: rippleKeyframes('radio'),
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--radio-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--radio-size': dp(16) } }, 'item-label': { base: { fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { '--radio-size': dp(18) } }, 'item-label': { base: { fontSize: 'var(--text-sm)' } } },
            // `md` is M3's 20dp — the token default.
            md: {},
            lg: { root: { base: { '--radio-size': dp(24) } }, 'item-label': { base: { fontSize: 'var(--text-lg)' } } },
            xl: { root: { base: { '--radio-size': dp(28) } }, 'item-label': { base: { fontSize: 'var(--text-xl)' } } },
        },
    },
    // The tick itself carries the selected state; the row, dot and text have
    // no appearance of their own that depends on it.
    skipStates: {
        item: ['focus-visible', 'checked', 'unchecked'],
        'item-label': ['checked', 'unchecked'],
    },
};

/**
 * CheckboxGroup (#282) — Material's checkbox list: the boxes keep the
 * checkbox recipe (their 40px state layers already space the rows), the
 * group owns the stack and its label, which speaks Field's label — role
 * tokens are inks by construction.
 */
export const checkboxGroup: RecipeInput = {
    component: 'checkbox-group',
    tokens: { '--checkbox-group-accent': 'var(--color-base-content)' },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' },
            // `invalid` and `readonly` paint on each box — the root only
            // lays the boxes out.
            states: { invalid: {}, required: {}, readonly: {} },
            selectors: {
                '&[data-orientation="horizontal"]': { flexDirection: 'row', flexWrap: 'wrap', columnGap: 'var(--space-lg)' },
            },
        },
        label: {
            base: { ...label, fontSize: 'var(--text-md)', color: 'var(--checkbox-group-accent)' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
            selectors: { '&[data-required]::after': { content: '" *"', color: 'var(--color-error)' } },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--checkbox-group-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { gap: 'var(--space-2xs)' } }, label: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { label: { base: { fontSize: 'var(--text-sm)' } } },
            md: {},
            lg: { label: { base: { fontSize: 'var(--text-lg)' } } },
            xl: { root: { base: { gap: 'var(--space-md)' } }, label: { base: { fontSize: 'var(--text-xl)' } } },
        },
    },
    skipStates: { label: ['invalid'] },
};

// ── Field, slider, progress ───────────────────────────────────────────────
export const field: RecipeInput = {
    component: 'field',
    // The label's accent ink — base-content by default, so the un-attributed
    // field is unchanged and a role only arrives through `data-color`.
    tokens: { '--field-accent': 'var(--color-base-content)' },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2xs)' },
            selectors: {
                // Holding a text field (#416), the field is the floating
                // label's positioning context, and takes the child's variant
                // and density so its label floats where the child's box is.
                [`&:has(> :is(${TEXT_FIELD_ROOTS}))`]: { position: 'relative', ...TF_HOST },
                [`&:has(> :is(${TEXT_FIELD_ROOTS})[data-variant="outlined"])`]: {
                    ...TF_OUTLINED,
                    marginBlockStart: 'var(--space-xs)',
                },
                ...Object.fromEntries(Object.entries(TF_HEIGHTS).map(([size, h]) => [
                    `&:has(> :is(${TEXT_FIELD_ROOTS})[data-size="${size}"])`, { '--tf-height': dp(h) },
                ])),
                [`&:has(> :is(${TEXT_FIELD_ROOTS}) [data-part="adornment"][data-placement="start"])`]: {
                    '--tf-label-start': `calc(var(--tf-label-start-base) + ${dp(36)})`,
                },
                [`&:has(> :is(${TEXT_FIELD_ROOTS})[data-invalid])`]: { '--tf-accent': 'var(--color-error)' },
            },
        },
        label: {
            base: { ...label, color: 'var(--field-accent)' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
            selectors: {
                '&[data-required]::after': { content: '" *"', color: 'var(--color-error)' },
                // Over a text field, the M3 floating label: resting while the
                // field holds no value and is unfocused. `Field.Root` mirrors
                // its control's emptiness as its own `data-placeholder`
                // (#469), so the label reads its field, not the control.
                ...tfLabelRules(FIELD_HOST, TF_FLOATED),
                ...tfNotchedLabel(FIELD_HOST, TF_FLOATED).selectors,
                [`${FIELD_HOST} > &[data-required]::after`]: { color: 'inherit' },
            },
            at: {
                'reduced-motion': { selectors: { [`${FIELD_HOST} > &`]: { transition: 'none' } } },
                ...tfNotchedLabel(FIELD_HOST, TF_FLOATED).at,
            },
        },
        // M3's supporting text and error text: body-small, 16dp in so it
        // lines up with the field's text, error in the error role.
        description: {
            base: { margin: '0', ...type('body-small'), color: 'var(--color-surface-variant-content)' },
            selectors: { [`${FIELD_HOST} > &`]: { paddingInline: 'var(--space-md)' } },
        },
        error: {
            base: { margin: '0', ...type('body-small'), color: 'var(--color-error)' },
            selectors: { [`${FIELD_HOST} > &`]: { paddingInline: 'var(--space-md)' } },
        },
    },
    variants: {
        // Colour accents the LABEL ink only — Material's role tokens are inks
        // by construction; the supporting text keeps its outline grey and the
        // error message stays error whatever the field's role.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--field-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { label: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { label: { base: { fontSize: 'var(--text-xs)' } } },
            // `md` is the un-attributed render — the base already IS the
            // middle step.
            md: {},
            lg: {
                label: { base: { fontSize: 'var(--text-md)' } },
                description: { base: { fontSize: 'var(--text-sm)' } },
                error: { base: { fontSize: 'var(--text-sm)' } },
            },
            xl: {
                label: { base: { fontSize: 'var(--text-lg)' } },
                description: { base: { fontSize: 'var(--text-md)' } },
                error: { base: { fontSize: 'var(--text-md)' } },
            },
        },
    },
    skipStates: { label: ['invalid', 'required'], error: ['invalid'] },
};

/**
 * Fieldset (#285). MD3 has no framed group — a set of controls is a column
 * under a title-small heading — so the UA frame is reset away and the
 * legend takes the shared label type a step heavier in colour than a
 * field's own. `min-inline-size: 0` undoes the UA's `min-content`.
 */
export const fieldset: RecipeInput = {
    component: 'fieldset',
    tokens: { '--fieldset-accent': 'var(--color-base-content)' },
    parts: {
        root: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-md)',
                minInlineSize: '0',
                margin: '0',
                padding: '0',
                border: 'none',
            },
        },
        legend: {
            base: { ...label, padding: '0', marginBlockEnd: 'var(--space-sm)', color: 'var(--fieldset-accent)' },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                invalid: { color: 'var(--color-error)' },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--fieldset-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { gap: 'var(--space-sm)' } }, legend: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { gap: 'var(--space-sm)' } }, legend: { base: { fontSize: 'var(--text-xs)' } } },
            // `md` is the un-attributed render.
            md: {},
            lg: { legend: { base: { fontSize: 'var(--text-md)' } } },
            xl: { legend: { base: { fontSize: 'var(--text-lg)' } } },
        },
    },
};

/**
 * The M3 Expressive handle stands in a gap cut out of the track (#468). The
 * runtime publishes where each handle is — `--slider-fraction`, and the low
 * one's `--slider-start-fraction` while a range model has two — so the
 * track is painted with the gap left out rather than the surface behind
 * the slider painted over it. On keyboard focus a ring outside the gap: an
 * outline offset by the gap, which leaves the gap itself unpainted.
 */
const sliderFocusRing: CssProps = {
    outline: '2px solid var(--color-secondary)',
    outlineOffset: 'var(--slider-gap)',
};

/** Half the handle plus its gap: how far the track stops short of a handle's centre. */
const sliderClear = 'calc(var(--slider-handle-width) / 2 + var(--slider-gap))';

/** The native thumb, shared by both engines' pseudo: the bar in its gap. */
const sliderNativeThumb: CssProps = {
    appearance: 'none',
    boxSizing: 'border-box',
    width: 'var(--slider-handle-width)',
    height: 'var(--slider-handle-size)',
    borderRadius: 'calc(var(--slider-handle-width) / 2)',
    border: 'none',
    background: 'var(--slider-accent)',
    // Width and height: upright, the narrowing handle is its height.
    transition:
        'width var(--duration-spatial-fast) var(--ease-spatial-fast), '
        + 'height var(--duration-spatial-fast) var(--ease-spatial-fast)',
};

export const slider: RecipeInput = {
    component: 'slider',
    // M3 Expressive's slider (#417): a 16dp track, a 4 × 44dp bar handle
    // standing in a 6dp gap, and a stop indicator at the track's end. The
    // geometry is custom properties so the size axis steps Expressive's
    // track sizes and every projection (native and composed) reads them.
    tokens: {
        '--slider-accent': 'var(--color-primary)',
        // The ink of a stop standing on the active track (#490).
        '--slider-on-accent': 'var(--color-primary-content)',
        '--slider-inactive': 'var(--color-surface-container-highest)',
        '--slider-track-size': dp(16),
        '--slider-handle-size': dp(44),
        '--slider-handle-width': dp(4),
        '--slider-gap': dp(6),
    },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2xs)' },
            // M3's disabled slider: the active track and handle at 38%
            // on-surface, the inactive track at 12% — explicit, not a fade.
            states: {
                disabled: {
                    '--slider-accent': 'color-mix(in oklch, var(--color-base-content) 38%, transparent)',
                    '--slider-on-accent': 'var(--color-inverse-surface-content)',
                    '--slider-inactive': 'color-mix(in oklch, var(--color-base-content) 12%, transparent)',
                },
            },
        },
        label: { base: { ...label } },
        // A custom skin (`appearance: none`): Blink ignores thumb-pseudo
        // styling on a native slider, and Chrome treats a range input as
        // always `:focus-visible`, so a generic ring would stay on after a
        // mouse press. The track reads the runtime-published
        // `--slider-fraction` (set on the root, inherited, #468) to stop the
        // fill and resume the inactive track a gap either side of the thumb.
        //
        // The inactive track is M3's surface-container-highest
        // (md.comp.slider.inactive.track.color) — never the accent. M3
        // Expressive moved it to secondary-container, which in the
        // high-contrast schemes sits within 1.6:1 of primary.
        control: {
            base: {
                appearance: 'none',
                width: '100%',
                height: 'var(--slider-handle-size)',
                margin: '0',
                background: 'transparent',
                cursor: 'pointer',
                outline: 'none',
                accentColor: 'var(--slider-accent)',
                // The native thumb's leading edge travels 0 → 100% minus its
                // own width; the fill stops a gap before it and the inactive
                // track resumes a gap after it.
                '--slider-track-dir': 'to right',
                '--slider-track':
                    'linear-gradient(var(--slider-track-dir), '
                    + 'var(--slider-accent) calc((100% - var(--slider-handle-width)) * var(--slider-fraction, 0.5) - var(--slider-gap)), '
                    + 'transparent 0 calc((100% - var(--slider-handle-width)) * var(--slider-fraction, 0.5) + var(--slider-handle-width) + var(--slider-gap)), '
                    + 'var(--slider-inactive) 0)',
            },
            states: {
                // `invalid` is semantic, not an accent: it stays error under
                // every colour variant, and the indirection carries it to the
                // filled track and the handle at once.
                invalid: { '--slider-accent': 'var(--color-error)' },
                // M3 Expressive's press: the handle narrows to 2dp.
                pressed: { '--slider-handle-width': dp(2) },
                // Readonly answers to nothing, so it does not invite a click.
                readonly: { cursor: 'default' },
                // After `invalid`, so a disabled slider a Field forces
                // invalid still takes M3's disabled colour, not the error.
                disabled: {
                    cursor: 'not-allowed',
                    '--slider-accent': 'color-mix(in oklch, var(--color-base-content) 38%, transparent)',
                },
            },
            selectors: {
                // The thumb travels from the reading start.
                [`&${rtl}`]: { '--slider-track-dir': 'to left' },
                '&::-webkit-slider-runnable-track': {
                    height: 'var(--slider-track-size)',
                    borderRadius: 'calc(var(--slider-track-size) / 2)',
                    background: 'var(--slider-track)',
                },
                '&::-webkit-slider-thumb': {
                    ...sliderNativeThumb,
                    marginTop: 'calc((var(--slider-track-size) - var(--slider-handle-size)) / 2)',
                },
                '&[data-focus-visible]::-webkit-slider-thumb': sliderFocusRing,
                '&::-moz-range-track': {
                    height: 'var(--slider-track-size)',
                    borderRadius: 'calc(var(--slider-track-size) / 2)',
                    background: 'var(--slider-track)',
                },
                '&::-moz-range-thumb': sliderNativeThumb,
                '&[data-focus-visible]::-moz-range-thumb': sliderFocusRing,
            },
            at: {
                // Native rendering knows forced colors better than we do; the
                // retained accentColor keeps the fallback branded elsewhere.
                'forced-colors': { base: { appearance: 'auto' } },
                'reduced-motion': {
                    selectors: {
                        '&::-webkit-slider-thumb': { transition: 'none' },
                        '&::-moz-range-thumb': { transition: 'none' },
                    },
                },
            },
        },
        // The composed range projection (#325): the same track, handle and
        // gap as real parts, and the stop indicator at the track's end. The
        // inactive track is the `::before`, cut around each handle from the
        // published geometry (#468): a handle's centre sits at its fraction
        // of the track. Without a start fraction (one value) the first cut
        // falls off the track's start.
        track: {
            base: {
                position: 'relative',
                height: 'var(--slider-track-size)',
                marginBlock: 'calc((var(--slider-handle-size) - var(--slider-track-size)) / 2)',
                borderRadius: 'calc(var(--slider-track-size) / 2)',
                cursor: 'pointer',
                '--slider-track-dir': 'to right',
            },
            states: { readonly: { cursor: 'default' }, disabled: { cursor: 'not-allowed' } },
            selectors: {
                [`&${rtl}`]: { '--slider-track-dir': 'to left' },
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: '0',
                    borderRadius: 'inherit',
                    pointerEvents: 'none',
                    background:
                        'linear-gradient(var(--slider-track-dir), '
                        + `var(--slider-inactive) calc(var(--slider-start-fraction, -1) * 100% - ${sliderClear}), `
                        + `transparent 0 calc(var(--slider-fraction, 0.5) * 100% + ${sliderClear}), `
                        + 'var(--slider-inactive) 0)',
                },
                // M3's stop indicator: a 4dp dot in the accent at the end of a
                // continuous track, showing where the range ends.
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    insetBlockStart: `calc((var(--slider-track-size) - ${dp(4)}) / 2)`,
                    insetInlineEnd: `calc((var(--slider-track-size) - ${dp(4)}) / 2)`,
                    width: dp(4),
                    height: dp(4),
                    borderRadius: '50%',
                    background: 'var(--slider-accent)',
                },
                // A slider with stops draws its own; the end dot would double one.
                '&:has([data-part="mark"])::after': { content: 'none' },
            },
        },
        // The filled span stops a gap short of each handle on it: a
        // transparent border at the handle's end (both ends between two
        // handles), the fill clipped inside it.
        range: {
            base: {
                boxSizing: 'border-box',
                height: '100%',
                borderRadius: 'calc(var(--slider-track-size) / 2)',
                background: 'var(--slider-accent)',
                backgroundClip: 'padding-box',
                borderInlineEnd: `${sliderClear} solid transparent`,
            },
            states: { disabled: {} },
            selectors: {
                '[data-part="track"]:has(> [data-part="thumb"] ~ [data-part="thumb"]) > &': {
                    borderInlineStart: `${sliderClear} solid transparent`,
                },
            },
        },
        thumb: {
            base: {
                zIndex: '1',
                width: 'var(--slider-handle-width)',
                height: 'var(--slider-handle-size)',
                insetBlockStart: '50%',
                translate: '0 -50%',
                marginInlineStart: 'calc(var(--slider-handle-width) / -2)',
                borderRadius: 'calc(var(--slider-handle-width) / 2)',
                background: 'var(--slider-accent)',
                cursor: 'pointer',
                outline: 'none',
                touchAction: 'none',
                transition:
                    'width var(--duration-spatial-fast) var(--ease-spatial-fast), '
                    + 'height var(--duration-spatial-fast) var(--ease-spatial-fast), '
                    + 'margin var(--duration-spatial-fast) var(--ease-spatial-fast)',
            },
            states: {
                // M3 Expressive's press: the handle narrows to 2dp.
                pressed: { '--slider-handle-width': dp(2) },
                'focus-visible': sliderFocusRing,
                // Readonly answers to nothing, so it does not invite a click.
                readonly: { cursor: 'default' },
                disabled: { cursor: 'not-allowed' },
            },
            at: { 'reduced-motion': { base: { transition: 'none' } } },
        },
        // M3's value indicator (#490): an inverse-surface bubble over the
        // handle, label-large in inverse-on-surface, grown in while the
        // handle is dragged or keyboard-focused. Where it sits is web
        // geometry (targets.web below).
        'thumb-value': {
            base: {
                position: 'absolute',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minInlineSize: dp(48),
                blockSize: dp(44),
                paddingInline: 'var(--space-md)',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-inverse-surface)',
                color: 'var(--color-inverse-surface-content)',
                ...type('label-large'),
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                opacity: '0',
                transition: motion('opacity'),
            },
            states: {
                pressed: { opacity: '1' },
                'focus-visible': { opacity: '1' },
            },
        },
        // M3's stops: 4dp dots on the track, the label under it. A stop on
        // the active track is on-primary, one on the inactive track primary
        // (#490) — above the range, which would otherwise cover the first.
        mark: {
            base: {
                zIndex: '1',
                paddingBlockStart: 'calc(var(--slider-track-size) + var(--space-2xs))',
                ...type('label-medium'),
                whiteSpace: 'nowrap',
                color: 'var(--color-surface-variant-content)',
            },
            states: {
                active: { '--slider-stop-ink': 'var(--slider-on-accent)' },
                inactive: { '--slider-stop-ink': 'var(--slider-accent)' },
                disabled: {},
            },
            selectors: {
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    insetBlockStart: `calc((var(--slider-track-size) - ${dp(4)}) / 2)`,
                    insetInlineStart: `calc(${dp(4)} / -2)`,
                    width: dp(4),
                    height: dp(4),
                    borderRadius: '50%',
                    background: 'var(--slider-stop-ink)',
                },
            },
        },
        'value-text': { base: { ...type('label-medium'), color: 'var(--color-surface-variant-content)' } },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--slider-accent': `var(--color-${c})`,
            '--slider-on-accent': `var(--color-${c}-content)`,
        } } }])),
        // M3 Expressive's slider sizes by their track: XS (16dp, the default,
        // at `md`), S (24dp) and M (40dp, a 52dp handle) above it, and two
        // lighter tracks below for dense layouts.
        size: {
            xs: { root: { base: { '--slider-track-size': dp(8), '--slider-handle-size': dp(36) } }, label: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { '--slider-track-size': dp(12), '--slider-handle-size': dp(40) } }, label: { base: { fontSize: 'var(--text-sm)' } } },
            md: {},
            lg: { root: { base: { '--slider-track-size': dp(24) } }, label: { base: { fontSize: 'var(--text-md)' } } },
            xl: { root: { base: { '--slider-track-size': dp(40), '--slider-handle-size': dp(52) } }, label: { base: { fontSize: 'var(--text-lg)' } } },
        },
    },
    // The native control's focus ring is its thumb pseudo's (`[data-focus-visible]`).
    skipStates: { root: ['invalid', 'focus-visible'], control: ['focus-visible'] },
    targets: {
        web: {
            parts: {
                // A vertical native range is spelled through writing mode by the
                // runtime (#170): the long axis is the box's HEIGHT, the channel's
                // WIDTH, and the fill grows from the foot.
                control: {
                    selectors: {
                        '&[data-orientation="vertical"]': {
                            width: 'var(--slider-handle-size)',
                            height: 'var(--slider-length)',
                            '--slider-track-dir': 'to top',
                        },
                        '&[data-orientation="vertical"]::-webkit-slider-runnable-track': {
                            width: 'var(--slider-track-size)',
                            height: 'auto',
                        },
                        // Blink lays the thumb against the channel's block axis — in
                        // vertical-lr that is its left edge — so the bar turns on
                        // its side and centres on the other axis.
                        '&[data-orientation="vertical"]::-webkit-slider-thumb': {
                            width: 'var(--slider-handle-size)',
                            height: 'var(--slider-handle-width)',
                            marginTop: '0',
                            marginBlockStart: 'calc((var(--slider-track-size) - var(--slider-handle-size)) / 2)',
                        },
                        '&[data-orientation="vertical"]::-moz-range-track': {
                            width: 'var(--slider-track-size)',
                            height: '100%',
                        },
                        '&[data-orientation="vertical"]::-moz-range-thumb': {
                            width: 'var(--slider-handle-size)',
                            height: 'var(--slider-handle-width)',
                        },
                    },
                },
                // Vertical (#170): the runtime positions the moving parts by
                // physical `bottom` percents; these turn the channel upright and
                // re-centre the handle on the other axis. Web-only — the lynx runtime
                // ships no vertical slider.
                root: {
                    selectors: {
                        '&[data-orientation="vertical"]': {
                            width: 'auto',
                            alignItems: 'center',
                            '--slider-length': 'calc(var(--size-selector) * 40)',
                        },
                    },
                },
                track: {
                    selectors: {
                        '&[data-orientation="vertical"]': {
                            width: 'var(--slider-track-size)',
                            height: 'var(--slider-length)',
                            marginBlock: '0',
                            '--slider-track-dir': 'to top',
                            marginInline: 'calc((var(--slider-handle-size) - var(--slider-track-size)) / 2)',
                        },
                        // The stop indicator sits at the top of an upright track.
                        '&[data-orientation="vertical"]::after': {
                            insetBlockStart: `calc((var(--slider-track-size) - ${dp(4)}) / 2)`,
                            insetInlineEnd: `calc((var(--slider-track-size) - ${dp(4)}) / 2)`,
                        },
                    },
                },
                // Upright, the span grows from the foot: its handle end is
                // the top, the low handle's the bottom.
                range: {
                    selectors: {
                        '&[data-orientation="vertical"]': {
                            insetInlineStart: '0',
                            width: '100%',
                            borderInline: '0',
                            borderBlockStart: `${sliderClear} solid transparent`,
                        },
                        '[data-part="track"]:has(> [data-part="thumb"] ~ [data-part="thumb"]) > &[data-orientation="vertical"]': {
                            borderInlineStart: '0',
                            borderBlockEnd: `${sliderClear} solid transparent`,
                        },
                    },
                },
                thumb: {
                    selectors: {
                        // Upright, the bar lies across the track.
                        '&[data-orientation="vertical"]': {
                            width: 'var(--slider-handle-size)',
                            height: 'var(--slider-handle-width)',
                            insetBlockStart: 'auto',
                            insetInlineStart: '50%',
                            translate: 'none',
                            marginInlineStart: 'calc(var(--slider-handle-size) / -2)',
                            marginBlockEnd: 'calc(var(--slider-handle-width) / -2)',
                        },
                    },
                },
                // The value bubble (#490): over the thumb, centred on it — `left:
                // 50%` with its `-50%` pull-back is symmetric centring, not a side —
                // and, upright, beside it on the inline-start side, away from the
                // mark labels. Web-only: lynx renders no value bubble yet.
                'thumb-value': {
                    // The grow-in: `scale` is web-only (lynx drops the
                    // standalone transform properties).
                    base: { scale: '0.85', transition: motion('opacity, scale') },
                    states: { pressed: { scale: '1' }, 'focus-visible': { scale: '1' } },
                    selectors: {
                        '&[data-orientation="horizontal"]': { bottom: `calc(100% + ${dp(4)})`, left: '50%', translate: '-50% 0', transformOrigin: 'bottom center' },
                        '&[data-orientation="vertical"]': { bottom: '50%', insetInlineEnd: `calc(100% + ${dp(4)})`, translate: '0 50%' },
                    },
                },
                // The label sits beside the channel, centred on its stop.
                mark: {
                    selectors: {
                        '&[data-orientation="vertical"]': {
                            insetInlineStart: '0',
                            paddingBlockStart: '0',
                            paddingInlineStart: 'calc(var(--slider-track-size) + var(--space-2xs))',
                            translate: '0 50%',
                        },
                        '&[data-orientation="vertical"]::before': {
                            insetBlockStart: `calc(${dp(4)} / -2)`,
                            insetInlineStart: `calc((var(--slider-track-size) - ${dp(4)}) / 2)`,
                        },
                    },
                },
            },
        },
    },
};

export const progress: RecipeInput = {
    component: 'progress',
    // Accent default in `tokens:` — the un-attributed render IS the primary
    // variant; `variants.color` only rebinds the custom properties.
    tokens: {
        '--progress-accent': 'var(--color-primary)',
        // M3's linear indicator: 4dp, the active bar standing in a 4dp gap
        // with a 4dp stop at the end. The gap is still the surface behind
        // it (`--tf-surface`): unlike the slider's handles (#468), the
        // indeterminate sweep's position is a keyframe, not published
        // geometry, so there is nothing to cut the track at.
        '--progress-track-size': dp(4),
    },
    keyframes: {
        // `transform` has no logical form, so the direction is carried by a value
        // the RTL rule can rebind — the same shape the switch thumb and the
        // slider fill use. Without it the determinate `width`, an ordinary flow
        // child, mirrors while the indeterminate sweep of the same element does
        // not.
        'material-indeterminate':
            'from { transform: translateX(calc(var(--progress-sweep-dir) * -100%)); } '
            + 'to { transform: translateX(calc(var(--progress-sweep-dir) * 300%)); }',
    },
    parts: {
        root: { base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2xs)' } },
        label: { base: { ...label } },
        track: {
            base: {
                position: 'relative',
                height: 'var(--progress-track-size)',
                borderRadius: '624rem',
                // M3's linear-progress track, surface-container-highest —
                // never the accent (matches the slider's inactive track).
                background: 'var(--color-surface-container-highest)',
                overflow: 'hidden',
            },
            selectors: {
                // M3's stop indicator at the track's end.
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    insetBlock: '0',
                    insetInlineEnd: '0',
                    inlineSize: 'var(--progress-track-size)',
                    borderRadius: '50%',
                    background: 'var(--progress-accent)',
                },
                // A running (indeterminate) bar has no end to mark.
                '&:has([data-state="indeterminate"])::after': { content: 'none' },
            },
        },
        range: {
            base: {
                height: '100%',
                borderRadius: '624rem',
                background: 'var(--progress-accent)',
                boxShadow: '0 0 0 var(--space-2xs) var(--tf-surface)',
                transition: motion('width, background'),
                '--progress-sweep-dir': '1',
            },
            selectors: { [`&${rtl}`]: { '--progress-sweep-dir': '-1' } },
            states: {
                // `complete` is a semantic state, not an accent: it stays
                // `success` whatever `color` the consumer picked. Without it the
                // finished bar is conveyed only by an inline width, which no
                // stylesheet carries and no snapshot can see.
                // Measured caveat for #228: MD3's `primary` and `success` are
                // near-equiluminant, so this recolour is 1.01:1 in WCAG in both
                // themes while being oklab ΔE 0.24 / 0.17 apart — plainly
                // visible, invisible to a luminance metric. A state-vs-state
                // audit must use a perceptual metric; keep WCAG for ink vs
                // surface. It is also the reason a hue swap alone is a weak
                // completion signal for colour-vision deficiency, in every
                // design system that uses this convention.
                complete: { background: 'var(--color-success)' },
                loading: {},
                indeterminate: { width: '40%', animation: 'material-indeterminate 1.4s var(--ease-emphasized) infinite' },
            },
            // A loop must stop under reduced motion, not accelerate.
            at: { 'reduced-motion': { states: { indeterminate: { animation: 'none', width: '100%' } } } },
        },
        'value-text': { base: { fontSize: 'var(--text-xs)', color: 'var(--color-surface-variant-content)' } },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--progress-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--progress-track-size': dp(2) } } },
            sm: { root: { base: { '--progress-track-size': dp(3) } } },
            md: {},
            lg: { root: { base: { '--progress-track-size': dp(8) } } },
            xl: { root: { base: { '--progress-track-size': dp(12) } } },
        },
    },
    // The track and range carry the state; the wrapper has no appearance of
    // its own that changes with it.
    skipStates: { root: ['loading', 'complete', 'indeterminate'] },
};

export const avatar: RecipeInput = {
    component: 'avatar',
    tokens: {
        '--avatar-size': 'calc(var(--size-selector) * 10)',
        '--avatar-accent': 'var(--color-surface-container-high)',
        '--avatar-on-accent': 'var(--color-surface-container-high-content)',
    },
    parts: {
        root: {
            base: {
                position: 'relative',
                display: 'inline-grid',
                width: 'var(--avatar-size)',
                height: 'var(--avatar-size)',
                borderRadius: '9999px',
                overflow: 'hidden',
                verticalAlign: 'middle',
                background: 'var(--color-surface-container)',
            },
            states: { loading: {}, loaded: {}, error: {} },
        },
        image: {
            base: {
                gridArea: '1 / 1',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                // Cross-fade over the tonal fallback as the image reports in.
                opacity: '0',
                transition: motion('opacity'),
            },
            states: { loading: {}, loaded: { opacity: '1' }, error: {} },
        },
        fallback: {
            base: {
                ...label,
                gridArea: '1 / 1',
                placeItems: 'center',
                width: '100%',
                height: '100%',
                background: 'var(--avatar-accent)',
                color: 'var(--avatar-on-accent)',
                userSelect: 'none',
            },
            // `display` must not defeat the `hidden` zero sets once the image
            // has loaded.
            selectors: { '&:not([hidden])': { display: 'grid' } },
            states: { loading: {}, loaded: {}, error: {} },
        },
    },
    variants: {
        // The shape axis (zero#129) — one declaration on the root, whose
        // `overflow: hidden` clips the image and the fallback alike. `rounded` is Material's small shape; the default is the circle.
        shape: {
            circle: { root: { base: { borderRadius: '9999px' } } },
            square: { root: { base: { borderRadius: '0' } } },
            rounded: { root: { base: { borderRadius: 'var(--radius-extra-small)' } } },
        },
        // A tonal container, per Material's own avatar/monogram treatment —
        // the role's container and its on-container ink. Unattributed
        // it stays on the neutral surface container it always used.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--avatar-accent': `var(--color-${c}-soft)`,
            '--avatar-on-accent': `var(--color-${c}-soft-content)`,
        } } }])),
        size: {
            xs: { root: { base: { '--avatar-size': 'calc(var(--size-selector) * 6)' } }, fallback: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { '--avatar-size': 'calc(var(--size-selector) * 8)' } }, fallback: { base: { fontSize: 'var(--text-xs)' } } },
            // `md` is the un-attributed render — the defaults in `tokens:`
            // already ARE the middle step.
            md: {},
            lg: { root: { base: { '--avatar-size': 'calc(var(--size-selector) * 12)' } }, fallback: { base: { fontSize: 'var(--text-md)' } } },
            xl: { root: { base: { '--avatar-size': 'calc(var(--size-selector) * 16)' } }, fallback: { base: { fontSize: 'var(--text-lg)' } } },
        },
    },
};

/** The indicator's marks, cut from its fill — not mirrored in RTL (a tick is not a direction). */
const TOAST_CHECK = 'polygon(15.1% 41.3%, 1% 55%, 37.6% 92.8%, 99% 19.8%, 83.9% 7.2%, 36.6% 63.5%)';
const TOAST_CROSS = 'polygon(20% 8%, 50% 38%, 80% 8%, 92% 20%, 62% 50%, 92% 80%, 80% 92%, 50% 62%, 20% 92%, 8% 80%, 38% 50%, 8% 20%)';

/**
 * Avatar group (#297) — Material has no group component, so this is its
 * avatar vocabulary stacked: circles overlapping by a quarter, each cut out
 * of the one before by a surface ring, and the "+N" chip is a monogram on
 * the high surface container in the label type. The group's `size` borrows
 * the avatar's own size step (`composes`), so a group sizes its faces
 * without a prop on each, and an avatar's own `size` still wins. Colour is
 * the chip's tonal container, the monogram's own treatment.
 */
const avatarGroupSteps: Record<string, [string, string]> = {
    xs: ['calc(var(--size-selector) * 6)', 'var(--text-xs)'],
    sm: ['calc(var(--size-selector) * 8)', 'var(--text-xs)'],
    lg: ['calc(var(--size-selector) * 12)', 'var(--text-md)'],
    xl: ['calc(var(--size-selector) * 16)', 'var(--text-lg)'],
};

export const avatarGroup: RecipeInput = {
    component: 'avatar-group',
    tokens: {
        '--avatar-group-size': 'calc(var(--size-selector) * 10)',
        '--avatar-group-accent': 'var(--color-surface-container-high)',
        '--avatar-group-on-accent': 'var(--color-surface-container-high-content)',
    },
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                verticalAlign: 'middle',
                isolation: 'isolate',
            },
        },
        overflow: {
            base: {
                // Positioned like the avatars, or it would paint under the
                // face it overlaps.
                position: 'relative',
                ...label,
                display: 'inline-grid',
                placeItems: 'center',
                boxSizing: 'border-box',
                minWidth: 'var(--avatar-group-size)',
                height: 'var(--avatar-group-size)',
                paddingInline: 'var(--space-2xs)',
                marginInlineStart: 'calc(var(--avatar-group-size) * -0.25)',
                borderRadius: '9999px',
                boxShadow: '0 0 0 2px var(--color-base-100)',
                background: 'var(--avatar-group-accent)',
                color: 'var(--avatar-group-on-accent)',
                whiteSpace: 'nowrap',
                userSelect: 'none',
            },
        },
    },
    composes: {
        avatar: {
            parts: {
                root: {
                    base: { boxShadow: '0 0 0 2px var(--color-base-100)' },
                    selectors: {
                        '&:not(:first-child)': { marginInlineStart: 'calc(var(--avatar-group-size) * -0.25)' },
                    },
                },
            },
        },
    },
    compoundVariants: Object.keys(avatarGroupSteps).map((size) => ({
        match: { size },
        parts: {},
        composes: { avatar: { axes: { size } } },
    })),
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--avatar-group-accent': `var(--color-${c}-soft)`,
            '--avatar-group-on-accent': `var(--color-${c}-soft-content)`,
        } } }])),
        size: {
            ...Object.fromEntries(Object.entries(avatarGroupSteps).map(([size, [box, text]]) => [size, {
                root: { base: { '--avatar-group-size': box } },
                overflow: { base: { fontSize: text } },
            }])),
            // `md` is the un-attributed render — the defaults in `tokens:`.
            md: {},
        },
    },
};

/**
 * Toast presence is runtime-managed — plain two-state transitions, no
 * `@starting-style`/`allow-discrete`. The M3 snackbar: a raised
 * surface-container card sliding in from the nearest edge, ripples on its
 * buttons.
 *
 * ── WHERE `color` LANDS (#225) ─────────────────────────────────────────────
 * It used to land on `--toast-accent`, which only the `action` label and its
 * ripple read — so a snackbar with no action was the same card whatever role
 * it was given, and `color="error"` was a promise the stylesheet did not keep.
 *
 * The container is NOT the answer. M3 snackbars are monochrome by spec: one
 * inverse-tone container at level 3, no status fills, and tinting the whole
 * surface (daisyUI's read, and a correct one for daisyUI) would trade this
 * design system's identity for a signal. The container stays exactly as it
 * was.
 *
 * So the colour takes the slot M3 does leave for it — the LEADING ICON. The
 * anatomy has no part there (an icon is app content), but `root` is one of
 * the few pressable-free parts in this package, so its `::before` is free:
 * drawn as a filled dot in the accent, placed as the snackbar's first grid
 * column and spanning both rows. A status marker rather than a status card —
 * visible on an actionless toast, and the same accent the action label
 * already wore, so the two now agree instead of only one of them speaking.
 */
export const toast: RecipeInput = {
    component: 'toast',
    tokens: {
        // On the snackbar's inverse surface a role reads as its container.
        '--toast-accent': 'var(--color-primary-container)',
        '--toast-from': '8px',
        '--toast-mark': '1rem',
    },
    parts: {
        viewport: {
            base: {
                position: 'fixed',
                inset: 'auto',
                margin: '0',
                padding: 'var(--space-lg)',
                border: 'none',
                background: 'transparent',
                overflow: 'visible',
                width: 'min(24rem, 100vw)',
                listStyle: 'none',
                flexDirection: 'column',
                gap: 'var(--space-sm)',
                pointerEvents: 'none',
            },
            selectors: {
                '&:popover-open': { display: 'flex' },
                // Logical, because `ToastPlacement` is: `top-start` means the
                // top of the reading side, which is the left edge only in a
                // left-to-right document. The centred pair stays physical —
                // `left: 50%` with a half-width pull-back is symmetric, and a
                // logical inset there would decentre it instead of mirroring it.
                '&[data-placement="top-start"]': { top: '0', insetInlineStart: '0' },
                '&[data-placement="top"]': { top: '0', left: '50%', transform: 'translateX(-50%)' },
                '&[data-placement="top-end"]': { top: '0', insetInlineEnd: '0' },
                '&[data-placement="bottom-start"]': { bottom: '0', insetInlineStart: '0', flexDirection: 'column-reverse' },
                '&[data-placement="bottom"]': { bottom: '0', left: '50%', transform: 'translateX(-50%)', flexDirection: 'column-reverse' },
                '&[data-placement="bottom-end"]': { bottom: '0', insetInlineEnd: '0', flexDirection: 'column-reverse' },
            },
        },
        // M3's snackbar (#418): inverse-surface under inverse-on-surface at
        // level 3, the extra-small corner, 48dp tall at least, body-medium,
        // and an inverse-primary action.
        root: {
            base: {
                background: 'var(--color-inverse-surface)',
                color: 'var(--color-inverse-surface-content)',
                border: 'none',
                boxShadow: 'var(--shadow-level3)',
                boxSizing: 'border-box',
                minBlockSize: dp(48),
                pointerEvents: 'auto',
                display: 'grid',
                // Four columns now: the status marker, the text, the action,
                // the close. The marker is `::before`, a grid item like any
                // other child.
                gridTemplateColumns: 'auto 1fr auto auto',
                alignItems: 'center',
                columnGap: 'var(--space-md)',
                paddingBlock: 'var(--space-xs)',
                paddingInlineStart: 'var(--space-md)',
                paddingInlineEnd: 'var(--space-xs)',
                borderRadius: 'var(--radius-extra-small)',
                ...type('body-medium'),
                opacity: '0',
                transform: `${SWIPE} translateY(var(--toast-from))`,
                // The swipe is the runtime's: no pan or pinch starts on a toast.
                touchAction: 'none',
                transition: 'opacity var(--duration-medium2) var(--ease-emphasized), '
                    + 'transform var(--duration-medium2) var(--ease-emphasized)',
            },
            selectors: {
                // Mid-swipe the toast tracks the pointer, not a transition.
                '&[data-swiping]': { transition: 'none', userSelect: 'none' },
                '&[data-placement^="top"]': { '--toast-from': '-8px' },
                // The status marker. Spans every row so it centers against
                // the title+description block, not against the title alone.
                '&::before': {
                    content: '""',
                    gridColumn: '1',
                    gridRow: '1 / -1',
                    alignSelf: 'center',
                    width: '0.625rem',
                    height: '0.625rem',
                    borderRadius: '50%',
                    background: 'var(--toast-accent)',
                    // The role's container is no ink for the inverse surface
                    // in every scheme; the ring keeps the mark findable.
                    boxShadow: '0 0 0 2px var(--color-inverse-surface-content)',
                },
                // A promise toast's indicator takes the marker's column —
                // the status IS the marker then, so the dot steps aside.
                '&:has(> [data-scope="toast"][data-part="indicator"])::before': { display: 'none' },
            },
            states: {
                open: { opacity: '1', transform: SWIPE },
                closed: {},
            },
            at: {
                'reduced-motion': { base: { transition: 'none' }, states: { open: { transform: SWIPE } } },
                // A forced palette repaints backgrounds, which would erase a
                // marker that is nothing but one — the same trade the radio
                // dot makes. A system colour is honoured as given.
                'forced-colors': { selectors: { '&::before': { background: 'CanvasText' } } },
            },
        },
        // The promise status in the marker's column: M3's circular progress
        // (the inverse-primary arc on its track) while pending, then a tick
        // or a cross.
        indicator: {
            base: {
                gridColumn: '1',
                gridRow: '1 / -1',
                alignSelf: 'center',
                inlineSize: 'var(--toast-mark)',
                blockSize: 'var(--toast-mark)',
                boxSizing: 'border-box',
            },
            states: {
                loading: {
                    borderRadius: '50%',
                    border: 'calc(var(--border) * 2) solid color-mix(in oklch, var(--color-inverse-surface-content) 38%, transparent)',
                    borderBlockStartColor: 'var(--color-inverse-primary)',
                    animation: 'zero-material-toast-spin 0.7s linear infinite',
                },
                // M3's snackbar is monochrome, and no role has an ink for the
                // inverse surface: the glyph's shape carries the status.
                complete: { background: 'var(--color-inverse-surface-content)', clipPath: TOAST_CHECK },
                error: { background: 'var(--color-inverse-surface-content)', clipPath: TOAST_CROSS },
            },
            at: {
                'reduced-motion': { states: { loading: { animation: 'none' } } },
                'forced-colors': {
                    states: {
                        complete: { background: 'CanvasText', forcedColorAdjust: 'none' },
                        error: { background: 'CanvasText', forcedColorAdjust: 'none' },
                    },
                },
            },
        },
        title: {
            base: { gridColumn: '2', ...label },
        },
        description: {
            base: { gridColumn: '2', ...type('body-medium'), color: 'var(--color-inverse-surface-content)' },
        },
        action: withPresence(pressable('toast', 'var(--color-inverse-primary)'), {
            base: {
                gridColumn: '3',
                gridRow: '1',
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'var(--color-inverse-primary)',
                blockSize: dp(40),
                borderRadius: dp(20),
                paddingInline: 'var(--space-sm)',
                ...label,
                cursor: 'pointer',
            },
            states: { disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' }, ...focusRing },
        }),
        close: withPresence(pressable('toast', 'var(--color-inverse-surface-content)'), {
            base: {
                gridColumn: '4',
                gridRow: '1',
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'var(--color-inverse-surface-content)',
                borderRadius: '624rem',
                padding: 'var(--space-2xs) var(--space-xs)',
                ...label,
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
            },
            states: { disabled: { opacity: 'var(--disabled-opacity)' }, ...focusRing },
        }),
    },
    variants: {
        color: Object.fromEntries(ROLES.map((role) => [
            role,
            { root: { base: { '--toast-accent': `var(--color-${role}-soft)` } } },
        ])),
        // Size moves the snackbar's box — padding and type — never the
        // status marker. The description steps only at the wide end.
        size: {
            xs: { root: { base: { padding: 'var(--space-xs) var(--space-md)', fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { padding: 'var(--space-sm) var(--space-md)', fontSize: 'var(--text-sm)' } } },
            // `md` is the un-attributed render — the base already IS the
            // middle step.
            md: {},
            // The title wears the `label` mixin's fixed `text-sm`, so the
            // wide steps restate it — unlike the skins where it inherits.
            lg: {
                root: { base: { padding: 'var(--space-lg) var(--space-xl)', fontSize: 'var(--text-md)' } },
                title: { base: { fontSize: 'var(--text-md)' } },
                description: { base: { fontSize: 'var(--text-sm)' } },
            },
            xl: {
                root: { base: { padding: 'var(--space-xl) var(--space-2xl)', fontSize: 'var(--text-lg)' } },
                title: { base: { fontSize: 'var(--text-lg)' } },
                description: { base: { fontSize: 'var(--text-md)' } },
            },
        },
    },
    keyframes: { ...rippleKeyframes('toast'), 'zero-material-toast-spin': 'to { transform: rotate(360deg); }' },
    // The viewport's `open` (the stack expanded) is a fact this skin has no
    // use for: its toasts are always a plain column, so both states look the
    // same by design (#292).
    skipStates: { viewport: ['open', 'closed'] },
};

export const combobox: RecipeInput = {
    component: 'combobox',
    // Accent defaults in `tokens:` — the un-attributed render IS the primary
    // variant; `variants.color` only rebinds the custom properties.
    tokens: {
        '--combobox-accent': 'var(--color-primary)',
    },
    parts: {
        root: tfRoot(),
        // M3's text field (#416): the control is the filled or outlined box,
        // its tags and the input wrapping inside it; a `Field.Label` above it
        // floats as it does over an input.
        control: withPresence(tfBox(), {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                minInlineSize: '12rem',
                paddingInlineEnd: 'var(--space-2xs)',
            },
            states: {
                open: {},
                closed: {},
                invalid: {},
                disabled: {},
                'focus-visible': { '--tf-indicator-color': 'var(--tf-accent)', '--tf-outline-color': 'var(--tf-accent)' },
            },
        }),
        input: {
            base: { ...tfText(), flex: '1' },
            states: {
                disabled: { cursor: 'not-allowed' },
                readonly: {},
                open: {},
                closed: {},
                invalid: {},
                required: {},
            },
            selectors: {
                '&::placeholder': { color: 'var(--color-surface-variant-content)' },
                ...tfRestingPlaceholder('[data-scope="combobox"][data-part="root"]', '&::placeholder'),
            },
        },
        // A chosen value under `multiple` (#39): a chip in the control, before
        // the input. Symmetric metrics only — the physical-direction lint and
        // the lynx emitter both refuse a one-sided inset.
        // MD3's input chip: an outlined 8dp-radius chip on the container.
        tag: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2xs)',
                margin: 'var(--space-2xs)',
                padding: 'var(--space-2xs) var(--space-sm)',
                border: '1px solid var(--color-outline)',
                background: 'transparent',
                color: 'var(--color-surface-container-content)',
                borderRadius: 'var(--radius-extra-small)',
                ...label,
            },
            // Arrowed onto from the input (#411).
            states: { disabled: {}, ...focusRing },
        },
        'tag-label': { base: { whiteSpace: 'nowrap' } },
        'tag-remove': {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                font: 'inherit',
                borderRadius: 'var(--radius-extra-small)',
                padding: '0 var(--space-2xs)',
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
                transition: motion('background'),
            },
            states: {
                hover: { background: 'color-mix(in oklab, var(--color-base-content) 8%, transparent)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': {
                    background: 'color-mix(in oklab, var(--color-base-content) 15%, transparent)',
                },
            },
        },
        trigger: withPresence(pressableCentered('combobox', '2.5rem', 'var(--combobox-accent)'), {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'var(--color-surface-container-content)',
                opacity: '0.7',
                padding: '0 var(--space-md)',
                cursor: 'pointer',
                transition: motion('transform'),
            },
            states: {
                open: { transform: 'rotate(180deg)' },
                closed: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
        }),
        // Clears the value and the text (#280): a trailing icon button
        // beside the dropdown arrow — its on-surface ink and emphasis.
        'clear-trigger': {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'var(--color-surface-container-content)',
                font: 'inherit',
                opacity: '0.7',
                padding: '0 var(--space-xs)',
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
                transition: motion('opacity'),
            },
            states: { hover: { opacity: '1' } },
        },
        popup: withPresence(popupPresence('scale(0.9)'), { base: { ...floating, ...anchoredListbox }, states: { open: {}, closed: {} } }),
        // The optgroup equivalent (#325) — the menu's group grammar.
        group: { base: { padding: 'var(--space-2xs) 0' } },
        'group-label': {
            base: {
                padding: 'var(--space-2xs) var(--space-md)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'var(--color-surface-variant-content)',
            },
        },
        // A windowed group's heading (#127): the same overline as the label,
        // as a row of the flat window instead of inside a `group`.
        'group-heading': {
            base: {
                padding: 'var(--space-2xs) var(--space-md)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'var(--color-surface-variant-content)',
            },
        },
        item: withPresence(pressable('combobox', 'var(--combobox-accent)'), {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                // M3's menu item: 48dp, 12dp in, label-large, full width.
                minBlockSize: dp(48),
                boxSizing: 'border-box',
                paddingInline: 'var(--space-sm)',
                ...type('label-large'),
                cursor: 'pointer',
            },
            states: {
                highlighted: { background: menuStateLayer },
                // MD3's secondary-container fill for a selected row —
                // deliberately NOT the accent.
                selected: { background: 'var(--color-secondary-container)', color: 'var(--color-secondary-container-content)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
            },
        }),
        // The check takes the row's ink: on-secondary-container once selected.
        'item-indicator': { base: { color: 'inherit' } },
        empty: {
            base: {
                padding: 'var(--space-md)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                textAlign: 'center',
                color: 'var(--color-surface-variant-content)',
            },
        },
        // The list still arriving (#280): the empty row's outline ink.
        loading: {
            base: {
                padding: 'var(--space-md)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                textAlign: 'center',
                color: 'var(--color-surface-variant-content)',
            },
        },
        // The menu's rule between runs of options (#280).
        separator: {
            base: { height: 'var(--border)', margin: 'var(--space-xs) 0', background: 'var(--color-outline-variant)' },
        },
    },
    variants: {
        // The role is the focused box and the item ripple.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--combobox-accent': `var(--color-${c})`,
            '--tf-accent': `var(--color-${c})`,
        } } }])),
        variant: tfVariants('root'),
        size: tfSizes('root'),
    },
    defaultVariants: { variant: 'filled' },
    // The visible focus lives on `control`; input and trigger delegate.
    skipStates: {
        input: ['focus-visible'],
        trigger: ['focus-visible'],
    },
    keyframes: rippleKeyframes('combobox'),
};

// ── Toggle, toggle group ──────────────────────────────────────────────────
/**
 * M3 Expressive's toggle buttons (#415): the common button's geometry, sizes,
 * shapes and icon configuration, with M3's unselected → selected colours per
 * style and the selected shape swap — a round toggle turns square when
 * selected, a square one round.
 */
export const toggle: RecipeInput = {
    component: 'toggle',
    tokens: {
        '--btn-accent': 'var(--color-primary)',
        '--btn-on-accent': 'var(--color-primary-content)',
    },
    parts: {
        root: withPresence(m3ButtonRoot('toggle'), {
            base: { '--btn-selected-radius': 'var(--btn-square)' },
            states: {
                on: { '--btn-radius': 'var(--btn-selected-radius)' },
                off: {},
            },
            at: {
                // Forced colours drop the fills that tell on from off; the
                // system's selection pair says it instead.
                'forced-colors': {
                    states: { on: { background: 'Highlight', color: 'HighlightText', borderColor: 'Highlight' } },
                },
            },
        }),
    },
    keyframes: rippleKeyframes('toggle'),
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--btn-accent': `var(--color-${c})`,
            '--btn-on-accent': `var(--color-${c}-content)`,
            '--btn-soft': `var(--color-${c}-soft)`,
            '--btn-on-soft': `var(--color-${c}-soft-content)`,
            '--btn-ink': `var(--color-${c})`,
            '--btn-selected': `var(--color-${c})`,
            '--btn-on-selected': `var(--color-${c}-content)`,
        } } }])),
        variant: {
            filled: { root: {
                base: {
                    '--btn-fill': 'var(--color-surface-container)',
                    '--btn-label': 'var(--color-surface-variant-content)',
                    '--btn-shadow-hover': 'var(--shadow-level1)',
                },
                states: { on: { '--btn-fill': 'var(--btn-accent)', '--btn-label': 'var(--btn-on-accent)' } },
            } },
            tonal: { root: {
                base: {
                    '--btn-fill': 'var(--btn-soft, var(--color-secondary-container))',
                    '--btn-label': 'var(--btn-on-soft, var(--color-secondary-container-content))',
                    '--btn-shadow-hover': 'var(--shadow-level1)',
                },
                states: { on: {
                    '--btn-fill': 'var(--btn-selected, var(--color-secondary))',
                    '--btn-label': 'var(--btn-on-selected, var(--color-secondary-content))',
                } },
            } },
            elevated: { root: {
                base: {
                    '--btn-fill': 'var(--color-surface-container-low)',
                    '--btn-label': 'var(--btn-accent)',
                    '--btn-shadow': 'var(--shadow-level1)',
                    '--btn-shadow-hover': 'var(--shadow-level2)',
                },
                states: { on: { '--btn-fill': 'var(--btn-accent)', '--btn-label': 'var(--btn-on-accent)' } },
            } },
            outlined: { root: {
                base: {
                    '--btn-fill': 'transparent',
                    '--btn-label': 'var(--btn-ink, var(--color-surface-variant-content))',
                    '--btn-border': 'var(--color-outline-variant)',
                    '--btn-disabled-fill': 'transparent',
                    '--btn-disabled-border': 'color-mix(in oklch, var(--color-base-content) 10%, transparent)',
                },
                states: { on: {
                    '--btn-fill': 'var(--btn-selected, var(--color-inverse-surface))',
                    '--btn-label': 'var(--btn-on-selected, var(--color-inverse-surface-content))',
                    '--btn-border': 'transparent',
                } },
            } },
        },
        size: buttonSizeVariants('root'),
        shape: {
            round: {},
            square: { root: { base: {
                '--btn-radius': 'var(--btn-square)',
                '--btn-selected-radius': 'calc(var(--btn-height) / 2)',
            } } },
        },
    },
    modifiers: { icon: iconButton('root') },
    defaultVariants: { variant: 'filled', size: 'sm', shape: 'round' },
};

/** M3's check icon (Material Symbols `check`), drawn as a mask in `currentColor`. */
const CHECK_MASK =
    'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E'
    + '%3Cpath d=\'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z\'/%3E%3C/svg%3E") center / contain no-repeat';

/**
 * M3's segmented button (#415): an outlined pill of connected segments at
 * 40dp, the selected ones on secondary-container with a check sliding in
 * before the label. The check is the `item-indicator` part (#437), grown
 * from zero width so the label moves over rather than jumping — which leaves
 * both of the segment's pseudo-elements to `pressable()`: M3's state layer
 * and its ripple.
 */
export const toggleGroup: RecipeInput = {
    component: 'toggle-group',
    // Public to a design system derived from this one (#73).
    hooks: {
        properties: {
            '--toggle-group-fill': 'The fill of an on item.',
            '--toggle-group-on-fill': 'The ink on --toggle-group-fill.',
            '--toggle-group-ink': 'The item ink.',
        },
    },
    tokens: {
        '--toggle-group-fill': 'var(--color-secondary-container)',
        '--toggle-group-on-fill': 'var(--color-secondary-container-content)',
        '--toggle-group-ink': 'var(--color-base-content)',
        '--toggle-group-height': dp(40),
    },
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                border: 'var(--border) solid var(--color-outline)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
            },
            states: { disabled: { borderColor: 'color-mix(in oklch, var(--color-base-content) 12%, transparent)' } },
            selectors: {
                '&[data-orientation="vertical"]': { flexDirection: 'column', borderRadius: 'var(--radius-large)' },
            },
        },
        item: withPresence(pressable('toggle-group', 'var(--toggle-group-ink)'), {
            base: {
                appearance: 'none',
                boxSizing: 'border-box',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: '1 1 auto',
                gap: 'var(--space-xs)',
                minBlockSize: 'var(--toggle-group-height)',
                paddingInline: 'var(--space-sm)',
                background: 'transparent',
                color: 'var(--toggle-group-ink)',
                border: 'none',
                ...type('label-large'),
                cursor: 'pointer',
                transition: motion('background, color'),
            },
            states: {
                on: {
                    background: 'var(--toggle-group-fill)',
                    color: 'var(--toggle-group-on-fill)',
                    '--toggle-group-ink': 'var(--toggle-group-on-fill)',
                },
                off: {},
                disabled: {
                    color: 'color-mix(in oklch, var(--color-base-content) 38%, transparent)',
                    cursor: 'not-allowed',
                },
                'focus-visible': {
                    // The pill clips its segments (joined corners), so an
                    // offset ring would be swallowed — inset it instead.
                    outline: '3px solid var(--color-secondary)',
                    outlineOffset: '-3px',
                },
            },
            selectors: {
                '&[data-orientation="horizontal"] + &': {
                    borderInlineStart: 'var(--border) solid var(--color-outline)',
                },
                '&[data-orientation="vertical"] + &': {
                    borderBlockStart: 'var(--border) solid var(--color-outline)',
                },
                '&[data-state="on"][data-disabled]': {
                    background: 'color-mix(in oklch, var(--color-base-content) 12%, transparent)',
                },
            },
            at: {
                'forced-colors': {
                    states: { on: { background: 'Highlight', color: 'HighlightText' } },
                },
            },
        }),
        // The check (#437): zero-width and cancelling the item's gap while
        // off, 18dp in front of the label while on — placed first by the
        // app, it slides in as the label moves over.
        'item-indicator': {
            base: {
                // Leading wherever the app placed it: M3 draws the check
                // before the label.
                order: '-1',
                flex: 'none',
                inlineSize: '0',
                blockSize: dp(18),
                marginInlineEnd: 'calc(var(--space-xs) * -1)',
                background: 'currentColor',
                mask: CHECK_MASK,
                opacity: '0',
                transition:
                    'inline-size var(--duration-short4) var(--ease-emphasized-decelerate), '
                    + 'margin var(--duration-short4) var(--ease-emphasized-decelerate), '
                    + 'opacity var(--duration-short2) var(--ease-standard)',
            },
            states: {
                on: { inlineSize: dp(18), marginInlineEnd: '0', opacity: '1' },
                off: {},
            },
            at: {
                'reduced-motion': { base: { transition: 'none' } },
                // A mask paints its box's background, which forced colours
                // revalue — opt the check out so it stays the item's ink.
                'forced-colors': { base: { forcedColorAdjust: 'none' } },
            },
        },
    },
    variants: {
        // M3 densities: the segment's height steps, the frame follows.
        size: {
            xs: { root: { base: { '--toggle-group-height': dp(28) } } },
            sm: { root: { base: { '--toggle-group-height': dp(32) } } },
            // `md` is the un-attributed render — M3's default 40dp.
            md: {},
            lg: { root: { base: { '--toggle-group-height': dp(48) } } },
            xl: { root: { base: { '--toggle-group-height': dp(56) } } },
        },
        color: Object.fromEntries(ROLES.map((c) => [
            c,
            {
                item: {
                    base: {
                        '--toggle-group-fill': `var(--color-${c}-soft)`,
                        '--toggle-group-on-fill': `var(--color-${c}-soft-content)`,
                    },
                },
            },
        ])),
    },
    keyframes: rippleKeyframes('toggle-group'),
    defaultVariants: { color: 'secondary' },
};

// ── Chips ─────────────────────────────────────────────────────────────────
/**
 * `pressable()` without its ripple: M3's state layer alone on `::before`,
 * leaving `::after` free for a drawn glyph (the chip's check). The segmented
 * button gave this up for an `item-indicator` part (#437); a chip has no
 * indicator part, so it keeps the trade.
 */
const stateLayerOnly = (ink: string): PartStyles => {
    const layer = pressable('unused', ink);
    const {
        '&::after': _ripple,
        '&[data-press-animating]::after': _wave,
        ...selectors
    } = layer.selectors ?? {};
    return {
        ...layer,
        selectors,
        at: { ...layer.at, 'forced-colors': { selectors: { '&::before': { display: 'none' } } } },
    };
};

/**
 * M3's chips (#544) — assist, filter, input and suggestion are one anatomy:
 * a 32dp container on the small corner with a 1dp outline-variant stroke
 * (`outlined`, M3's "flat") or a surface-container-low fill on level 1
 * (`elevated`), label-large text, 16dp side padding that drops to 8dp beside
 * a leading icon, a check or a trailing remove.
 *
 * Selected (a filter or input chip) moves to secondary-container with no
 * stroke, and M3's check slides in before the label — segmented button's
 * check, the same `::after` grown from zero width, so the label moves over
 * rather than jumping; a leading icon gives its slot up to it. The action
 * keeps M3's state layer and gives up the ripple for the check (the
 * segmented button's trade). The trailing remove is M3's 18dp icon with its
 * own circular state layer.
 *
 * `--chip-group-fill` / `--chip-group-on-fill` are the group's `color`,
 * which the chips inside fall back to (see `chipGroup`).
 */
export const chip: RecipeInput = {
    component: 'chip',
    hooks: {
        properties: {
            '--chip-fill': 'The fill of a selected chip.',
            '--chip-on-fill': 'The ink on --chip-fill.',
            '--chip-icon': 'The leading icon ink of an unselected chip.',
        },
    },
    tokens: {
        '--chip-fill': 'var(--chip-group-fill, var(--color-secondary-container))',
        '--chip-on-fill': 'var(--chip-group-on-fill, var(--color-secondary-container-content))',
        '--chip-icon': 'var(--color-primary)',
        '--chip-height': dp(32),
    },
    parts: {
        root: {
            base: {
                boxSizing: 'border-box',
                display: 'inline-flex',
                alignItems: 'stretch',
                verticalAlign: 'middle',
                maxInlineSize: '100%',
                blockSize: 'var(--chip-height)',
                background: 'transparent',
                color: 'var(--color-surface-variant-content)',
                border: 'var(--border) solid var(--color-outline-variant)',
                borderRadius: 'var(--radius-small)',
                ...label,
                lineHeight: 'var(--leading-label-large)',
                transition: motion('background, color, border-color, box-shadow'),
            },
            states: {
                on: {
                    background: 'var(--chip-fill)',
                    color: 'var(--chip-on-fill)',
                    borderColor: 'transparent',
                },
                off: {},
                selected: {},
                disabled: {
                    color: 'color-mix(in oklch, var(--color-base-content) 38%, transparent)',
                    borderColor: 'color-mix(in oklch, var(--color-base-content) 12%, transparent)',
                },
            },
            selectors: {
                '&[data-state="on"][data-disabled]': {
                    background: 'color-mix(in oklch, var(--color-base-content) 12%, transparent)',
                },
            },
            at: {
                'forced-colors': {
                    states: { on: { background: 'Highlight', color: 'HighlightText', borderColor: 'Highlight' } },
                },
            },
        },
        action: withPresence(stateLayerOnly('currentColor'), {
            base: {
                appearance: 'none',
                boxSizing: 'border-box',
                display: 'inline-flex',
                alignItems: 'center',
                flex: '1 1 auto',
                gap: dp(8),
                minInlineSize: '0',
                margin: '0',
                paddingBlock: '0',
                paddingInline: dp(16),
                background: 'transparent',
                color: 'inherit',
                border: 'none',
                borderRadius: 'inherit',
                font: 'inherit',
                textDecoration: 'none',
                cursor: 'pointer',
                transition: motion('padding'),
            },
            states: {
                on: { paddingInlineStart: dp(8) },
                off: {},
                disabled: { cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                // A leading icon takes M3's 8dp inset.
                '&:has(> [data-scope="chip"][data-part="icon"])': { paddingInlineStart: dp(8) },
                // The trailing remove owns the end inset; the action stops at
                // M3's 8dp gap before it.
                '[data-scope="chip"][data-part="root"]:has(> [data-scope="chip"][data-part="remove"]) > &': {
                    paddingInlineEnd: dp(8),
                },
                // The check (see the recipe's doc).
                '&::after': {
                    content: '""',
                    order: '-1',
                    flex: 'none',
                    inlineSize: '0',
                    blockSize: dp(18),
                    marginInlineEnd: `calc(${dp(8)} * -1)`,
                    background: 'currentColor',
                    mask: CHECK_MASK,
                    opacity: '0',
                    transition:
                        'inline-size var(--duration-short4) var(--ease-emphasized-decelerate), '
                        + 'margin var(--duration-short4) var(--ease-emphasized-decelerate), '
                        + 'opacity var(--duration-short2) var(--ease-standard)',
                },
                '&[data-state="on"]::after': { inlineSize: dp(18), marginInlineEnd: '0', opacity: '1' },
            },
            at: {
                'reduced-motion': { base: { transition: 'none' }, selectors: { '&::after': { transition: 'none' } } },
                'forced-colors': { selectors: { '&::after': { forcedColorAdjust: 'none' } } },
            },
        }),
        icon: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
                inlineSize: dp(18),
                blockSize: dp(18),
                fontSize: dp(18),
                lineHeight: '1',
                color: 'var(--chip-icon)',
            },
            selectors: {
                // Selected, the check takes the leading slot.
                '[data-scope="chip"][data-part="action"][data-state="on"] > &': { display: 'none' },
                '[data-scope="chip"][data-part="root"][data-disabled] &': { color: 'inherit' },
            },
        },
        label: {
            base: {
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
            },
        },
        remove: withPresence(pressableCentered('chip', dp(24), 'currentColor'), {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'center',
                flex: 'none',
                inlineSize: dp(18),
                blockSize: dp(18),
                marginInline: dp(8),
                padding: '0',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                background: 'transparent',
                color: 'inherit',
                fontFamily: 'var(--font-sans)',
                fontSize: dp(18),
                lineHeight: '1',
                cursor: 'pointer',
            },
            states: {
                disabled: { cursor: 'not-allowed' },
                ...focusRing,
            },
        }),
    },
    keyframes: rippleKeyframes('chip'),
    variants: {
        // M3's flat chip is the outlined base; `elevated` trades the stroke
        // for surface-container-low on level 1, and lifts to level 2 on hover.
        variant: {
            outlined: {},
            elevated: {
                root: {
                    base: {
                        background: 'var(--color-surface-container-low)',
                        borderColor: 'transparent',
                        boxShadow: 'var(--shadow-level1)',
                    },
                    states: {
                        on: { background: 'var(--chip-fill)' },
                        disabled: {
                            background: 'color-mix(in oklch, var(--color-base-content) 12%, transparent)',
                            boxShadow: 'none',
                        },
                    },
                    selectors: {
                        '&:has(> [data-scope="chip"][data-part="action"]:hover):not([data-disabled])': {
                            boxShadow: 'var(--shadow-level2)',
                        },
                    },
                },
            },
        },
        color: Object.fromEntries(ROLES.map((c) => [
            c,
            {
                root: {
                    base: {
                        '--chip-fill': `var(--color-${c}-soft)`,
                        '--chip-on-fill': `var(--color-${c}-soft-content)`,
                    },
                },
            },
        ])),
        // M3 ships one 32dp chip; the ramp steps the container around it.
        size: {
            xs: { root: { base: { '--chip-height': dp(24) } } },
            sm: { root: { base: { '--chip-height': dp(28) } } },
            md: {},
            lg: { root: { base: { '--chip-height': dp(40) } } },
            xl: { root: { base: { '--chip-height': dp(48) } } },
        },
    },
};

/**
 * M3's chip set (#544): a wrapping row with an 8dp gap. It publishes its
 * `color` as `--chip-group-fill` / `--chip-group-on-fill`, which the chips
 * inside fall back to; a chip's own `color` still wins.
 */
export const chipGroup: RecipeInput = {
    component: 'chip-group',
    hooks: {
        properties: {
            '--chip-group-fill': 'The selected fill the chips inside fall back to.',
            '--chip-group-on-fill': 'The ink on --chip-group-fill.',
        },
    },
    tokens: {
        '--chip-group-fill': 'var(--color-secondary-container)',
        '--chip-group-on-fill': 'var(--color-secondary-container-content)',
    },
    parts: {
        root: {
            base: {
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: dp(8),
            },
            // Each chip carries the flag itself; the root only lays them out.
            states: { disabled: {}, invalid: {}, required: {} },
            selectors: {
                '&[data-orientation="vertical"]': { flexDirection: 'column', alignItems: 'flex-start' },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [
            c,
            {
                root: {
                    base: {
                        '--chip-group-fill': `var(--color-${c}-soft)`,
                        '--chip-group-on-fill': `var(--color-${c}-soft-content)`,
                    },
                },
            },
        ])),
        size: {
            xs: { root: { base: { gap: dp(4) } } },
            sm: { root: { base: { gap: dp(4) } } },
            md: {},
            lg: { root: { base: { gap: dp(12) } } },
            xl: { root: { base: { gap: dp(16) } } },
        },
    },
};

// ── Number input ──────────────────────────────────────────────────────────
/**
 * The stepper: an icon button riding inside the outlined field. Bounded
 * MD3 press feedback (state layer + ripple) clipped to its own pill; the
 * margin keeps the pill off the field's hairline.
 */
/**
 * The steppers as M3's trailing icon buttons (#416): 40dp circles in
 * on-surface-variant, both in the trailing slot so the label and the value
 * keep the leading edge a text field reads from.
 */
const stepper: PartStyles = withPresence(pressable('number-input', 'var(--color-surface-variant-content)'), {
    base: {
        appearance: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        flex: 'none',
        blockSize: dp(40),
        minInlineSize: dp(40),
        border: 'none',
        background: 'transparent',
        color: 'var(--color-surface-variant-content)',
        borderRadius: '624rem',
        padding: '0',
        fontFamily: 'var(--font-sans)',
        fontSize: dp(20),
        lineHeight: 'var(--leading-none)',
        cursor: 'pointer',
        userSelect: 'none',
    },
    states: {
        disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
    },
});

/**
 * M3's text field over the number-input anatomy (#416): the box, the
 * floating label and the indicator shared with every text field, the value
 * at the leading edge and the steppers in the trailing icon slot.
 */
export const numberInput: RecipeInput = {
    component: 'number-input',
    parts: {
        root: withPresence(tfRoot(), {
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        }),
        label: withPresence(tfLabel('number-input'), {
            states: { disabled: {}, invalid: {}, required: {} },
        }),
        // M3's text field (#416) with the steppers inside the box: the box
        // takes the indicator or outline, the input its body-large text.
        control: withPresence(tfBox(), {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                paddingInline: 'var(--space-2xs)',
            },
            states: {
                invalid: {},
                disabled: {},
                readonly: {},
                'focus-visible': { '--tf-indicator-color': 'var(--tf-accent)', '--tf-outline-color': 'var(--tf-accent)' },
            },
        }),
        input: {
            base: { ...tfText(), inlineSize: '5rem', flex: '1' },
            states: {
                disabled: { cursor: 'not-allowed' },
                readonly: {},
                invalid: {},
                required: {},
            },
            selectors: {
                '&::placeholder': { color: 'var(--color-surface-variant-content)' },
                ...tfRestingPlaceholder('[data-scope="number-input"][data-part="root"]', '&::placeholder'),
            },
        },
        'decrement-trigger': withPresence(stepper, { base: { order: '1' } }),
        'increment-trigger': withPresence(stepper, { base: { order: '2' } }),
    },
    // The visible focus lives on `control`; the input delegates.
    skipStates: { input: ['focus-visible'] },
    keyframes: rippleKeyframes('number-input'),
    variants: {
        color: tfColors('root'),
        variant: tfVariants('root'),
        size: tfSizes('root'),
    },
    defaultVariants: { variant: 'filled' },
};

// ── Rating group ──────────────────────────────────────────────────────────
/**
 * Radio semantics over a row of glyphs. The item's content is a text star,
 * so colour and font-size ARE the fill: primary once full/half (the same
 * selected ink as every other selection control here), outline while empty
 * (Material's inactive hairline tone). A glyph can't host a bounded state
 * layer, so `highlighted` — the hover preview range — reads as a subtle
 * scale emphasis instead, with the reduced-motion guard that implies.
 *
 * `half` is the SAME full star, cut in two by a clipped gradient (see below).
 * That works because zero's default is `★`/`★`/`☆` — the half-star codepoint
 * U+2BEA is tofu in the system stacks, so the runtime leaves halving to the
 * design system (#222) — and because a consumer's own symbol is full width too.
 */
export const ratingGroup: RecipeInput = {
    component: 'rating-group',
    tokens: {
        '--rating-size': 'var(--text-xl)',
        '--rating-fill': 'var(--color-primary)',
    },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-2xs)' },
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        },
        label: {
            base: { ...label, color: 'var(--color-base-content)' },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                invalid: { color: 'var(--color-error)' },
                required: {},
            },
            selectors: { '&[data-required]::after': { content: '" *"', color: 'var(--color-error)' } },
        },
        // role=radiogroup — one tab stop, so the group ring is the focus
        // indicator, drawn Material-style around the whole row.
        control: {
            base: { display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2xs)' },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                readonly: {},
                'focus-visible': {
                    outline: '3px solid var(--color-secondary)',
                    outlineOffset: '2px',
                    borderRadius: 'var(--radius-extra-small)',
                },
            },
        },
        item: {
            base: {
                fontSize: 'var(--rating-size)',
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
                userSelect: 'none',
                color: 'var(--color-surface-variant-content)',
                transition: motion('color, transform'),
            },
            states: {
                full: { color: 'var(--rating-fill)' },
                // A half is a HALF FILL, not a second full one. The glyph's own
                // ink is painted by a hard-stop gradient clipped to the text, so
                // the difference is GEOMETRIC — half the mark is there — and
                // holds for whatever symbol the consumer passed in.
                //
                // The trailing stop is transparent rather than the inactive
                // hairline tone on purpose: Material's `outline` and its accents
                // are near-equiluminant (measured 1.26:1 against each other in
                // the light theme), so a tinted second half would encode `half`
                // in a difference some viewers cannot see. An absent half is
                // legible at any size, in either scheme, and to anyone.
                half: {
                    backgroundImage: 'linear-gradient(to right, var(--rating-fill) 50%, transparent 50%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                    WebkitTextFillColor: 'transparent',
                },
                empty: {},
                highlighted: { transform: 'scale(1.12)' },
                disabled: { cursor: 'not-allowed' },
                readonly: { cursor: 'default' },
                // The group ring lives on control; the value-following tab
                // stop still gets a discernible per-item marker.
                'focus-visible': {
                    outline: '2px solid var(--color-secondary)',
                    outlineOffset: '1px',
                    borderRadius: 'var(--radius-extra-small)',
                },
            },
            selectors: {
                // Gradients have no logical direction, so the hard stop has to
                // be flipped by hand: the filled half is the LEADING one.
                [`&[data-state="half"]${rtl}`]: {
                    backgroundImage: 'linear-gradient(to left, var(--rating-fill) 50%, transparent 50%)',
                },
            },
            at: {
                'reduced-motion': { base: { transition: 'none' }, states: { highlighted: { transform: 'none' } } },
                // `-webkit-text-fill-color` is outside the forced palette's
                // reach, so a transparent glyph could stay transparent. Give
                // the half back its own ink and let the symbol carry the state.
                'forced-colors': {
                    states: {
                        half: {
                            backgroundImage: 'none',
                            color: 'CanvasText',
                            WebkitTextFillColor: 'currentColor',
                        },
                    },
                },
                // The half's ink is a BACKGROUND clipped to the text, and paper
                // drops backgrounds by default — the half printed blank, the
                // one state the gradient exists to draw (#25). On paper the
                // glyph keeps its own ink and the item itself is clipped to
                // the leading half instead: `clip-path` is geometry, not
                // paint, so no print setting drops it, and the trailing half
                // stays absent exactly as it is on screen.
                print: {
                    states: {
                        half: {
                            backgroundImage: 'none',
                            color: 'var(--rating-fill)',
                            WebkitTextFillColor: 'currentColor',
                            clipPath: 'inset(0 50% 0 0)',
                        },
                    },
                    selectors: {
                        [`&[data-state="half"]${rtl}`]: { clipPath: 'inset(0 0 0 50%)' },
                    },
                },
            },
        },
    },
    variants: {
        // A rating glyph is text on the page background, so the raw role is
        // not always safe: daisy measured `--color-warning` at 1.62:1 on light
        // base-100. Deepening every role toward its own content pair keeps the
        // hue and clears 3:1 in both schemes — the same 70/30 mix daisy's
        // default already uses.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--rating-fill': `color-mix(in oklab, var(--color-${c}) 70%, var(--color-${c}-content))`,
        } } }])),
        size: {
            xs: { root: { base: { '--rating-size': 'var(--text-sm)' } } },
            sm: { root: { base: { '--rating-size': 'var(--text-md)' } } },
            // `md` is the un-attributed render — the defaults in `tokens:`
            // already ARE the middle step.
            md: {},
            lg: { root: { base: { '--rating-size': 'var(--text-2xl)' } } },
            xl: { root: { base: { '--rating-size': 'var(--text-3xl)' } } },
        },
    },
};

// ── Tree view ─────────────────────────────────────────────────────────────
/**
 * Material's list-item treatment over the tree anatomy: every row (leaf item
 * and branch trigger alike) is a menu-style row with the MD3 state layer and
 * ink ripple, and a selected row takes the secondary-container fill — the
 * same `secondary-soft` pairing the select item and segmented button use.
 *
 * Selected never fights hover here: hover is `pressable`'s ::before state
 * layer compositing OVER the fill (MD3's state-layer-on-container), not a
 * competing background declaration — so no `&[data-selected]:hover` guard is
 * needed. Depth is the DOM nesting; branch-content's inline padding is the
 * only indentation rule.
 */
const treeRow: PartStyles = {
    base: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        padding: 'var(--space-xs) var(--space-md)',
        borderRadius: 'var(--radius-extra-small)',
        fontSize: 'var(--tree-text)',
        cursor: 'pointer',
        userSelect: 'none',
        transition: motion('background'),
    },
    states: {
        selected: { background: 'var(--tree-accent)', color: 'var(--tree-on-accent)' },
        disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
        ...focusRing,
    },
};

/**
 * The node check box's mark: Material's check as one mitred, square-cut
 * polyline, and its bar, sharing a point count and topology so `clip-path`
 * morphs between them; `HOME` is the check collapsed onto its elbow.
 */
const NODE_CHECK = 'polygon(14% 44%, 0% 58%, 36% 94%, 100% 30%, 86% 16%, 36% 66%)';
const NODE_CHECK_HOME = 'polygon(36% 66%, 36% 94%, 36% 94%, 36% 94%, 36% 66%, 36% 66%)';
const NODE_DASH = 'polygon(6% 42%, 6% 58%, 36% 58%, 94% 58%, 94% 42%, 36% 42%)';

/**
 * `markGlyphFallback` for the node check box: its mark is one `::after`, so
 * the geometry drops there and the same pseudo carries the glyph, in the
 * medium's own ink.
 */
const nodeMarkFallback = (ink: string): PartStyles => ({
    selectors: {
        '&::after': { clipPath: 'none', background: 'transparent', inset: '0', display: 'grid', placeItems: 'center', color: ink, fontSize: '0.85em', lineHeight: 'var(--leading-none)' },
        '&[data-state="checked"]::after': { content: '"\\2713"', clipPath: 'none' },
        '&[data-state="indeterminate"]::after': { content: '"\\2212"', clipPath: 'none' },
    },
});

export const treeView: RecipeInput = {
    component: 'tree-view',
    tokens: {
        '--tree-accent': 'var(--color-secondary-container)',
        '--tree-text': 'var(--text-sm)',
        '--tree-on-accent': 'var(--color-secondary-container-content)',
        // The node check box: the checkbox's primary container and its
        // on-primary mark, retinted by a colour variant.
        '--tree-check': 'var(--color-primary)',
        '--tree-on-check': 'var(--color-primary-content)',
    },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2xs)' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
        },
        label: {
            base: { ...label, color: 'var(--color-base-content)', padding: 'var(--space-2xs) var(--space-md)' },
        },
        tree: {
            base: { display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)' },
        },
        item: withPresence(pressable('tree-view'), treeRow),
        // The treeitem ELEMENT (row + subtree); the row look lives on the
        // trigger inside it, so the ring and the fill draw on the row only.
        branch: {
            base: { display: 'flex', flexDirection: 'column', outline: 'none' },
            states: { open: {}, closed: {}, selected: {}, disabled: {} },
        },
        'branch-trigger': withPresence(pressable('tree-view'), {
            ...treeRow,
            states: { ...treeRow.states, open: {}, closed: {} },
        }),
        'branch-indicator': {
            base: {
                display: 'inline-flex',
                transition: motion('transform'),
            },
            // Loading: the chevron rests mid-rotation, a static stand-in for
            // the progress affordance — no loop to stop, ink unchanged.
            states: { open: { transform: 'rotate(90deg)' }, closed: {}, loading: { transform: 'rotate(45deg)' } },
            // The glyph is element text the runtime renders (`TreeView.tsx`), not
            // `content:`, so the `:dir(rtl)` swap the submenu chevron uses is not
            // available here — a mirror is its equivalent. `scale` composes
            // OUTSIDE `transform` (and outside the individual `rotate`), so the
            // closed glyph flips to point at the reading end while the open one,
            // already rotated to point down, is unaffected by a horizontal flip.
            selectors: { [`&${rtl}`]: { scale: '-1 1' } },
            // --duration-* already collapses under reduced motion; `none`
            // makes the intent explicit rather than relying on 0.01ms.
            at: { 'reduced-motion': { base: { transition: 'none' } } },
        },
        // The MD3 checkbox container at row scale — `tickBox`'s 2dp outline,
        // filled on check — with the check as a square-cut stroke on the
        // box's `::after` (the part is one span, so the two-arm draw the
        // checkbox indicator uses has no second element to live on). On a
        // selected row the pair swaps with the row's own, so a checked box
        // never sinks into a same-role fill.
        'node-checkbox': {
            base: {
                ...tickBox('var(--tree-check)', '1.125em').base,
                display: 'inline-block',
                position: 'relative',
                flexShrink: '0',
                borderRadius: 'var(--radius-extra-small)',
                cursor: 'pointer',
            },
            states: {
                checked: { background: 'var(--tree-check)', borderColor: 'var(--tree-check)' },
                indeterminate: { background: 'var(--tree-check)', borderColor: 'var(--tree-check)' },
                unchecked: {},
                disabled: { cursor: 'not-allowed' },
            },
            selectors: {
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    inset: '18%',
                    background: 'var(--tree-on-check)',
                    clipPath: NODE_CHECK_HOME,
                    opacity: '0',
                    transition: motion('clip-path, opacity'),
                },
                '&[data-state="checked"]::after': { clipPath: NODE_CHECK, opacity: '1' },
                '&[data-state="indeterminate"]::after': { clipPath: NODE_DASH, opacity: '1' },
                '[data-scope="tree-view"][data-selected] &': {
                    '--tree-check': 'var(--tree-on-accent)',
                    '--tree-on-check': 'var(--tree-accent)',
                },
            },
            at: {
                'reduced-motion': { base: { transition: 'none' }, selectors: { '&::after': { transition: 'none' } } },
                'forced-colors': nodeMarkFallback('CanvasText'),
                print: nodeMarkFallback('var(--print-ink)'),
            },
        },
        'branch-content': {
            base: { display: 'flex', flexDirection: 'column', paddingInlineStart: 'var(--space-lg)' },
            states: { open: {}, closed: {} },
        },
    },
    keyframes: rippleKeyframes('tree-view'),
    // Open-and-loading content lays out exactly as open content does — the
    // indicator and the treeitem's aria-busy carry the state.
    sameAs: { 'branch-content': { loading: 'open' } },
    variants: {
        // A tree colours two things: the selected row and the node check
        // box. Everything else is structure, and tinting it would fight the
        // content.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--tree-accent': `var(--color-${c})`,
            '--tree-on-accent': `var(--color-${c}-content)`,
            '--tree-check': `var(--color-${c})`,
            '--tree-on-check': `var(--color-${c}-content)`,
        } } }])),
        size: {
            xs: { root: { base: { '--tree-text': 'var(--text-xs)' } } },
            sm: { root: { base: { '--tree-text': 'var(--text-xs)' } } },
            // `md` is the un-attributed render: `--tree-text`'s default in
            // `tokens:` already IS the middle step.
            md: {},
            lg: { root: { base: { '--tree-text': 'var(--text-md)' } } },
            xl: { root: { base: { '--tree-text': 'var(--text-lg)' } } },
        },
    },
};

// ── Text fields ───────────────────────────────────────────────────────────
/**
 * The affordances inside a text field (#281): M3's on-surface-variant ink
 * for icons and affixes, the round icon button with its 8% state layer, and
 * the size step both follow.
 */
const affixInk = 'var(--color-surface-variant-content)';
const stateLayer = 'color-mix(in oklch, var(--color-base-content) 8%, transparent)';
const fieldButton: NonNullable<PartStyles['base']> = {
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: affixInk,
    borderRadius: '9999px',
    alignSelf: 'center',
    flex: 'none',
    order: '1',
    // M3's trailing icon button: a 40dp target whose 24dp icon sits 12dp in.
    blockSize: dp(40),
    minInlineSize: dp(40),
    marginInlineEnd: 'var(--space-2xs)',
    padding: 'var(--space-xs)',
    fontSize: dp(24),
    lineHeight: 'var(--leading-none)',
    cursor: 'pointer',
    transition: motion('background'),
};

/**
 * M3's text field (#416), filled by default and outlined on `variant`: the
 * label rests inside over the input and floats on focus or once there is
 * text, the active indicator (filled) or the outline (outlined) thickens to
 * 2dp in the role colour, and the icons and affordances sit in the 24dp slots
 * at either edge.
 */
export const input: RecipeInput = {
    component: 'input',
    parts: {
        root: withPresence(tfRoot(), {
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        }),
        label: withPresence(withPresence(tfLabel('input'), tfNotchedLabel('[data-scope="input"][data-part="root"]', TF_FLOATED)), {
            states: { disabled: {}, invalid: {}, required: {} },
        }),
        control: withPresence(tfBox(), {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
            },
            selectors: {
                // The outline part draws the outline (#468): the box keeps
                // its border's room, unpainted, and drops the focus ring.
                '&:has(> [data-part="outline"])': {
                    position: 'relative',
                    borderColor: 'transparent',
                    boxShadow: 'inset 0 calc(-1 * var(--tf-indicator)) 0 var(--tf-indicator-color)',
                },
            },
            at: {
                // The outline hides under forced colours: the box's own
                // system border is the field's bounds again.
                'forced-colors': { selectors: { '&:has(> [data-part="outline"])': { borderColor: 'CanvasText' } } },
            },
            states: {
                invalid: {},
                disabled: {},
                readonly: {},
                // The box's own focus treatment (the 2dp indicator) is its
                // ring; keyboard focus gets the same, as M3 draws it.
                'focus-visible': { '--tf-indicator-color': 'var(--tf-accent)', '--tf-outline-color': 'var(--tf-accent)' },
            },
        }),
        input: {
            base: { ...tfText(), flex: '1', inlineSize: '100%' },
            states: {
                disabled: { cursor: 'not-allowed' },
                readonly: {},
                invalid: {},
                required: {},
            },
            selectors: {
                '&::placeholder': { color: 'var(--color-surface-variant-content)' },
                ...tfRestingPlaceholder('[data-scope="input"][data-part="root"]', '&::placeholder'),
                // Beside an affix the text keeps M3's 2dp from it; the affix
                // carries the 16dp from the container edge (#467).
                '[data-scope="input"][data-part="control"]:has(> [data-part="affix"][data-placement="start"]) > &': { paddingInlineStart: dp(2) },
                '[data-scope="input"][data-part="control"]:has(> [data-part="affix"][data-placement="end"]) > &': { paddingInlineEnd: dp(2) },
                // zero draws its own ClearTrigger and clears on Escape, and Firefox
                // draws no native clear: hide the engine's cancel button everywhere (#446).
                '&::-webkit-search-cancel-button': { appearance: 'none', display: 'none' },
                '&::-webkit-search-decoration': { appearance: 'none' },
            },
        },
        outline: tfOutline(),
        notch: tfNotch('input'),
        // M3's leading / trailing icon: 24dp in on-surface-variant, centred
        // in the container 12dp from its edge, ordered logically. A leading
        // one moves the resting label past it (`tfRoot`).
        adornment: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'center',
                flex: 'none',
                minInlineSize: dp(24),
                blockSize: dp(24),
                color: affixInk,
                fontSize: dp(24),
                lineHeight: 'var(--leading-none)',
            },
            states: { disabled: {} },
            selectors: {
                '& > svg': { inlineSize: dp(24), blockSize: dp(24) },
                '&[data-placement="start"]': { order: '-1', paddingInlineStart: 'var(--space-sm)' },
                '&[data-placement="end"]': { order: '1', paddingInlineEnd: 'var(--space-sm)' },
                // An error turns the trailing icon error, as M3 does.
                '[data-invalid] > &[data-placement="end"]': { color: 'var(--color-error)' },
            },
        },
        // M3's prefix / suffix text (#467): body-large on the input's own
        // text line (a labelled filled field sets it lower), 16dp from the
        // container edge and 2dp from the text. It never moves the label,
        // and it shows only once the label has floated out of its way —
        // while a visible label rests in the empty field it keeps its room
        // but paints nothing, so the text does not jump when it appears.
        affix: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                alignSelf: 'stretch',
                flex: 'none',
                whiteSpace: 'nowrap',
                color: affixInk,
                ...type('body-large'),
                paddingBlockStart: `var(--tf-in-top, calc((var(--tf-height) - ${dp(24)}) / 2))`,
                paddingBlockEnd: `var(--tf-in-bottom, calc((var(--tf-height) - ${dp(24)}) / 2))`,
                transition: motion('opacity'),
            },
            states: { disabled: {} },
            selectors: {
                '&[data-placement="start"]': { order: '-1', paddingInlineStart: 'var(--space-md)' },
                '&[data-placement="end"]': { order: '1', paddingInlineEnd: 'var(--space-md)' },
                [`[data-scope="input"][data-part="root"]${LABELLED}[data-placeholder]:not(:focus-within) &, ${FIELD_HOST}${LABELLED}[data-placeholder]:not(:focus-within) &`]: {
                    opacity: '0',
                },
            },
            at: { 'reduced-motion': { base: { transition: 'none' } } },
        },
        // M3's trailing icon button: a 40dp circle, on-surface-variant, with
        // the 8% state layer on hover.
        'clear-trigger': {
            base: fieldButton,
            states: {
                hover: { background: stateLayer },
                disabled: { cursor: 'not-allowed' },
                ...focusRing,
            },
        },
        // The M3 toggle icon button: selected lifts to full on-surface ink
        // over a 12% layer, unselected keeps the variant ink. Not the role
        // accent — a light role would drop the glyph under the text floor.
        'visibility-trigger': {
            base: fieldButton,
            states: {
                on: { color: 'var(--color-base-content)', background: 'color-mix(in oklch, var(--color-base-content) 12%, transparent)' },
                off: {},
                hover: { background: stateLayer },
                disabled: { cursor: 'not-allowed' },
                ...focusRing,
            },
        },
    },
    // The visible focus lives on `control`; the input delegates.
    skipStates: { input: ['focus-visible'] },
    variants: {
        color: tfColors('root'),
        variant: tfVariants('root'),
        size: tfSizes('root'),
    },
    defaultVariants: { variant: 'filled' },
};

/**
 * The same field, drawn on the element: the textarea IS the container, so the
 * label rests over its first line and the padding makes room for it floated.
 */
export const textarea: RecipeInput = {
    component: 'textarea',
    parts: {
        root: withPresence(tfRoot(), {
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        }),
        label: withPresence(tfLabel('textarea'), {
            states: { disabled: {}, invalid: {}, required: {} },
        }),
        textarea: withPresence(tfBox(), {
            base: {
                ...tfText(),
                display: 'block',
                // border-box, or `width: 100%` plus the padding and border is
                // wider than the column it fills — 26–34px at phone width (#45).
                inlineSize: '100%',
                resize: 'vertical',
            },
            states: {
                invalid: {},
                disabled: {},
                readonly: {},
                required: {},
                'focus-visible': { '--tf-indicator-color': 'var(--tf-accent)', '--tf-outline-color': 'var(--tf-accent)' },
            },
            selectors: {
                '&::placeholder': { color: 'var(--color-surface-variant-content)' },
                ...tfRestingPlaceholder('[data-scope="textarea"][data-part="root"]', '&::placeholder'),
            },
        }),
    },
    variants: {
        color: tfColors('root'),
        variant: tfVariants('root'),
        size: tfSizes('root'),
    },
    defaultVariants: { variant: 'filled' },
};

// ── Content tier (#311) ───────────────────────────────────────────────────
/**
 * Material's elevated card: a tonal surface container rather than base-100,
 * the `medium` corner (the structural `box` role), and one elevation step. The role rides the same
 * `--md-*` indirection the rest of this skin uses.
 */
export const card: RecipeInput = {
    component: 'card',
    // Public to a design system derived from this one (#73).
    hooks: {
        properties: {
            '--card-pad': 'The card padding.',
            '--card-fill': 'The card fill (the variant sets it; a colour makes it the role container).',
            '--card-ink': 'The ink on --card-fill.',
            '--card-outline': 'The outlined card hairline.',
            '--card-shadow': 'The card elevation.',
        },
    },
    tokens: {
        // M3's 16dp card padding.
        '--card-pad': 'var(--space-md)',
    },
    parts: {
        // M3's card (#418): elevated, filled or outlined — the variant sets
        // the fill, the elevation and the outline; the medium corner is
        // common to all three. An outlined text field inside notches in the
        // card's own fill (`--tf-surface`).
        root: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                background: 'var(--card-fill, var(--color-surface-container-low))',
                color: 'var(--card-ink, var(--color-surface-container-low-content))',
                border: '1px solid var(--card-outline, transparent)',
                borderRadius: 'var(--radius-medium)',
                boxShadow: 'var(--card-shadow, var(--shadow-level1))',
                overflow: 'hidden',
                '--tf-surface': 'var(--card-fill, var(--color-surface-container-low))',
            },
        },
        /**
         * Media (#302) — Material's full-bleed card media: edge to edge on
         * the tonal surface, the container's corners carried through.
         */
        media: {
            base: {
                display: 'block',
                margin: '0',
                inlineSize: '100%',
                objectFit: 'cover',
                background: 'var(--color-base-200)',
            },
            selectors: {
                // The media's own image, when the band wraps one (a div or a
                // figure): block-level, the band's full width, cropped rather
                // than stretched when the band is given a height.
                '& > :is(img, picture, video, svg, canvas)': {
                    display: 'block',
                    inlineSize: '100%',
                    blockSize: '100%',
                    objectFit: 'cover',
                },
                // The corners it shares with the card (#302): the root clips
                // too, but an asChild <img> is the band itself and rounds on
                // its own.
                '&:first-child': { borderStartStartRadius: 'var(--radius-medium)', borderStartEndRadius: 'var(--radius-medium)' },
                '&:last-child': { borderEndStartRadius: 'var(--radius-medium)', borderEndEndRadius: 'var(--radius-medium)' },
            },
        },
        header: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2xs)',
                padding: 'var(--card-pad) var(--card-pad) 0',
            },
        },
        title: { base: { margin: '0', ...type('title-medium') } },
        // On-surface-variant on a neutral card; a tonal card's own ink.
        description: { base: { margin: '0', ...type('body-medium'), color: 'var(--card-subtle, var(--color-surface-variant-content))' } },
        body: { base: { padding: 'var(--card-pad)', ...type('body-medium') } },
        footer: {
            base: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 'var(--space-sm)',
                padding: '0 var(--card-pad) var(--card-pad)',
            },
        },
    },
    variants: {
        variant: {
            elevated: {},
            filled: { root: { base: {
                '--card-fill': 'var(--color-surface-container-highest)',
                '--card-ink': 'var(--color-surface-container-highest-content)',
                '--card-shadow': 'var(--shadow-level0)',
            } } },
            outlined: { root: { base: {
                '--card-fill': 'var(--color-surface)',
                '--card-ink': 'var(--color-surface-content)',
                '--card-outline': 'var(--color-outline-variant)',
                '--card-shadow': 'var(--shadow-level0)',
            } } },
        },
        // M3 has no coloured card; a role here is the tonal one — the
        // role's container under its on-container ink, whatever the variant.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--card-fill': `var(--color-${c}-soft)`,
            '--card-ink': `var(--color-${c}-soft-content)`,
            '--card-subtle': `var(--color-${c}-soft-content)`,
        } } }])),
        size: {
            xs: { root: { base: { '--card-pad': 'var(--space-sm)' } } },
            sm: { root: { base: { '--card-pad': 'var(--space-md)' } } },
            md: {},
            lg: { root: { base: { '--card-pad': 'var(--space-xl)' } } },
            xl: { root: { base: { '--card-pad': 'var(--space-2xl)' } } },
        },
    },
    defaultVariants: { variant: 'elevated' },
};

/** Material's banner: the role's container and on-container ink, its outline. */
export const alert: RecipeInput = {
    component: 'alert',
    tokens: {
        '--alert-tint': 'var(--color-info-soft)',
        '--alert-on-tint': 'var(--color-info-soft-content)',
        '--alert-accent': 'var(--color-info)',
    },
    parts: {
        root: {
            base: {
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'center',
                gap: 'var(--space-2xs) var(--space-md)',
                background: 'var(--alert-tint)',
                color: 'var(--alert-on-tint)',
                border: 'var(--border) solid var(--alert-accent)',
                borderRadius: 'var(--radius-extra-large)',
                padding: 'var(--space-md) var(--space-lg)',
            },
            states: { open: {}, closed: {} },
        },
        icon: {
            base: {
                gridRow: '1 / span 2',
                display: 'inline-flex',
                alignItems: 'center',
                color: 'var(--alert-on-tint)',
                fontSize: 'var(--text-lg)',
                lineHeight: 'var(--leading-none)',
            },
        },
        title: {
            base: {
                ...label,
                fontSize: 'var(--text-md)',
                lineHeight: 'var(--leading-tight)',
            },
        },
        description: {
            base: {
                gridColumn: '2',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                lineHeight: 'var(--leading-normal)',
            },
        },
        close: {
            base: {
                gridRow: '1',
                gridColumn: '3',
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                borderRadius: 'var(--radius-extra-small)',
                padding: 'var(--space-2xs)',
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
                transition: motion('background'),
            },
            states: {
                hover: { background: 'color-mix(in oklab, var(--color-base-content) 8%, transparent)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': {
                    background: 'color-mix(in oklab, var(--color-base-content) 15%, transparent)',
                },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--alert-tint': `var(--color-${c}-soft)`,
            '--alert-on-tint': `var(--color-${c}-soft-content)`,
            '--alert-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { padding: 'var(--space-2xs) var(--space-sm)' } } },
            sm: { root: { base: { padding: 'var(--space-xs) var(--space-md)' } } },
            md: {},
            lg: { root: { base: { padding: 'var(--space-lg) var(--space-xl)' } } },
            xl: { root: { base: { padding: 'var(--space-xl) var(--space-2xl)' } } },
        },
    },
};

/**
 * EmptyState (zero#131) — Material's empty-state guidance is an
 * illustration, a headline and a body on the surface itself, no frame: a
 * centred column on the low surface container, the icon in the role.
 */
export const emptyState: RecipeInput = {
    component: 'empty-state',
    hooks: {
        properties: {
            '--empty-accent': 'The icon ink.',
            '--empty-tint': 'The surface fill.',
        },
    },
    tokens: {
        '--empty-accent': 'var(--color-secondary)',
        '--empty-tint': 'var(--color-surface-container)',
    },
    parts: {
        root: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 'var(--space-sm)',
                padding: 'var(--space-2xl) var(--space-xl)',
                background: 'var(--empty-tint)',
                color: 'var(--empty-on-tint, var(--color-base-content))',
                borderRadius: 'var(--radius-extra-large)',
            },
        },
        icon: {
            base: {
                display: 'inline-flex',
                color: 'var(--empty-on-tint, var(--empty-accent))',
                fontSize: 'var(--text-3xl)',
                lineHeight: 'var(--leading-none)',
                marginBlockEnd: 'var(--space-xs)',
            },
        },
        title: {
            base: {
                ...label,
                margin: '0',
                fontSize: 'var(--text-lg)',
                lineHeight: 'var(--leading-tight)',
            },
        },
        description: {
            base: {
                maxInlineSize: '36ch',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                lineHeight: 'var(--leading-normal)',
                color: 'var(--color-base-content)',
            },
        },
        actions: {
            base: {
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 'var(--space-sm)',
                marginBlockStart: 'var(--space-md)',
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--empty-accent': `var(--color-${c})`,
            '--empty-tint': `var(--color-${c}-soft)`,
            '--empty-on-tint': `var(--color-${c}-soft-content)`,
        } } }])),
        size: {
            xs: { root: { base: { padding: 'var(--space-md)', gap: 'var(--space-2xs)' } }, icon: { base: { fontSize: 'var(--text-xl)' } }, title: { base: { fontSize: 'var(--text-sm)' } }, description: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { padding: 'var(--space-lg)', gap: 'var(--space-xs)' } }, icon: { base: { fontSize: 'var(--text-2xl)' } }, title: { base: { fontSize: 'var(--text-md)' } }, description: { base: { fontSize: 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { padding: 'calc(var(--space-2xl) * 1.5) var(--space-2xl)', gap: 'var(--space-md)' } }, icon: { base: { fontSize: 'var(--text-3xl)' } }, title: { base: { fontSize: 'var(--text-xl)' } }, description: { base: { fontSize: 'var(--text-md)' } } },
            xl: { root: { base: { padding: 'calc(var(--space-2xl) * 2) var(--space-2xl)', gap: 'var(--space-lg)' } }, icon: { base: { fontSize: 'var(--text-3xl)' } }, title: { base: { fontSize: 'var(--text-2xl)' } }, description: { base: { fontSize: 'var(--text-md)' } } },
        },
    },
};

/** Material's badge: a small filled pill in the role's own on-accent pair. */
export const badge: RecipeInput = {
    component: 'badge',
    // Public to a design system derived from this one (#73).
    hooks: {
        properties: {
            '--badge-dot': 'The status dot\'s fill (zero#130); the pill\'s ink at rest.',
            '--badge-dot-ring': 'The ring around a coloured status dot.',
            '--badge-fill': 'The badge fill.',
            '--badge-ink': 'The badge ink.',
        },
    },
    tokens: {
        '--badge-dot': 'currentColor',
        '--badge-dot-ring': 'currentColor',
        '--badge-fill': 'var(--color-error)',
        '--badge-ink': 'var(--color-error-content)',
    },
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375em',
                background: 'var(--badge-fill)',
                color: 'var(--badge-ink)',
                // M3's large badge: 16dp tall, fully round, label-small,
                // 4dp in — error / on-error unless a colour says otherwise.
                boxSizing: 'border-box',
                minBlockSize: dp(16),
                minInlineSize: dp(16),
                justifyContent: 'center',
                borderRadius: 'var(--radius-full)',
                paddingInline: 'var(--space-2xs)',
                ...type('label-small'),
                whiteSpace: 'nowrap',
                textDecoration: 'none',
            },
        },
        // The status dot (zero#130). On an uncoloured pill it is the pill's
        // INK — a dot in `currentColor` is legible on whatever fill the pill
        // has. Coloured — by its own `data-color`, or by the pill's, since the
        // nearest carrier wins (#94) — it is the role's fill inside a ring in
        // the role's `-content` ink, the timeline marker's answer: a dot that
        // follows a solid pill of the same role still has an edge. `running` is a
        // static halo the pulse breathes; under reduced motion the halo
        // stays and the breathing stops, so the state never vanishes.
        dot: {
            base: {
                display: 'inline-block',
                flex: 'none',
                inlineSize: '0.5em',
                blockSize: '0.5em',
                boxSizing: 'border-box',
                borderRadius: '50%',
                background: 'var(--badge-dot)',
                border: '0.1em solid var(--badge-dot-ring)',
            },
            states: {
                running: {
                    boxShadow: '0 0 0 0.2em color-mix(in oklch, var(--badge-dot) 35%, transparent)',
                    animation: 'zero-material-badge-pulse 1.6s ease-out infinite',
                },
            },
            at: {
                'reduced-motion': { states: { running: { animation: 'none' } } },
                // Forced colours strip the fill and keep the border, so the
                // border draws the whole dot there.
                'forced-colors': { base: { borderWidth: '0.25em' } },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, {
            root: { base: {
                '--badge-fill': `var(--color-${c})`,
                '--badge-ink': `var(--color-${c}-content)`,
            } },
            // The dot's colour (zero#130): keyed under `variants.color` so the
            // compiler anchors it on the pill's `data-color` AND on the dot's
            // own re-carried one — the nearest carrier wins (#94).
            dot: { base: {
                '--badge-dot': `var(--color-${c})`,
                '--badge-dot-ring': `var(--color-${c}-content)`,
            } },
        }])),
        size: {
            xs: { root: { base: { fontSize: 'var(--text-xs)', padding: '0 var(--space-xs)' } } },
            sm: { root: { base: { fontSize: 'var(--text-xs)', padding: '0 var(--space-sm)' } } },
            md: {},
            lg: { root: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-2xs) var(--space-md)' } } },
            xl: { root: { base: { fontSize: 'var(--text-lg)', padding: 'var(--space-xs) var(--space-lg)' } } },
        },
    },    keyframes: {
        'zero-material-badge-pulse': 'from { box-shadow: 0 0 0 0 color-mix(in oklch, var(--badge-dot) 45%, transparent); } to { box-shadow: 0 0 0 0.5em transparent; }',
    },
};

/** Material's divider: the outline tone, at hairline weight. */
export const divider: RecipeInput = {
    component: 'divider',
    // M3's divider: 1dp outline-variant (#418).
    tokens: { '--divider-ink': 'var(--color-outline-variant)', '--divider-thickness': 'var(--border)' },
    parts: {
        root: {
            // The rule is two flex segments (#298), drawn as borders: with no
            // label they meet and read as one line, and a label sits between
            // them. Borders rather than a background, so forced colours keep
            // the line instead of revaluing it to Canvas.
            base: {
                display: 'flex',
                alignItems: 'center',
                border: 'none',
                alignSelf: 'stretch',
            },
            selectors: {
                '&::before': { content: '""', flex: '1 1 0', minInlineSize: '0' },
                '&::after': { content: '""', flex: '1 1 0', minInlineSize: '0' },
                '&[data-orientation="horizontal"]': { inlineSize: '100%' },
                '&[data-orientation="horizontal"]::before': { borderBlockStart: 'var(--divider-thickness) solid var(--divider-ink)' },
                '&[data-orientation="horizontal"]::after': { borderBlockStart: 'var(--divider-thickness) solid var(--divider-ink)' },
                '&[data-orientation="vertical"]': { flexDirection: 'column', minBlockSize: '1em' },
                '&[data-orientation="vertical"]::before': { borderInlineStart: 'var(--divider-thickness) solid var(--divider-ink)' },
                '&[data-orientation="vertical"]::after': { borderInlineStart: 'var(--divider-thickness) solid var(--divider-ink)' },
                // A placed label keeps a short lead of rule before it at
                // its own edge — Mantine's shape, not a flush start.
                '&:has(> [data-scope="divider"][data-part="label"][data-placement="start"])::before': { flexGrow: '0', flexBasis: 'var(--space-lg)' },
                '&:has(> [data-scope="divider"][data-part="label"][data-placement="end"])::after': { flexGrow: '0', flexBasis: 'var(--space-lg)' },
            },
        },
        label: {
            base: {
                // MD3 has no labelled divider of its own; the caption is its
                // label-medium, on-surface-variant tone.
                flex: 'none',
                paddingInline: 'var(--space-lg)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                letterSpacing: 'var(--tracking-wide)',
                whiteSpace: 'nowrap',
                color: 'var(--color-base-content)',
                opacity: '0.78',
            },
            selectors: {
                '[data-scope="divider"][data-part="root"][data-orientation="vertical"] > &': {
                    paddingInline: '0',
                    paddingBlock: 'var(--space-md)',
                },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--divider-ink': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--divider-thickness': 'var(--border)' } } },
            sm: { root: { base: { '--divider-thickness': 'var(--border)' } } },
            md: {},
            lg: { root: { base: { '--divider-thickness': 'calc(var(--border) * 2)' } } },
            xl: { root: { base: { '--divider-thickness': 'calc(var(--border) * 3)' } } },
        },
    },
};

// ── Loading (#314) ────────────────────────────────────────────────────────
/**
 * Skeleton — see zero-basic's for the shared reasoning: children stay in the
 * DOM, `loading` blanks them with `color: transparent`, the loop STOPS under
 * reduced motion rather than speeding up, and the static fallback is a flat
 * fill that still reads as "not content yet".
 */
export const skeleton: RecipeInput = {
    component: 'skeleton',
    // Public to a design system derived from this one (#73).
    hooks: {
        properties: {
            '--skeleton-fill': 'The placeholder fill.',
        },
    },
    tokens: { '--skeleton-fill': 'var(--color-surface-container)' },
    parts: {
        root: {
            base: { borderRadius: 'var(--radius-extra-large)' },
            states: {
                loading: {
                    color: 'transparent',
                    background: 'var(--skeleton-fill)',
                    animation: 'zero-material-skeleton 1.6s ease-in-out infinite',
                    userSelect: 'none',
                    pointerEvents: 'none',
                },
                loaded: {},
            },
            at: { 'reduced-motion': { states: { loading: { animation: 'none' } } } },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--skeleton-fill': `color-mix(in oklab, var(--color-${c}) 20%, var(--color-base-300))`,
        } } }])),
        size: {
            xs: { root: { base: { borderRadius: 'var(--radius-extra-small)' } } },
            sm: { root: { base: { borderRadius: 'var(--radius-extra-small)' } } },
            md: {},
            lg: { root: { base: { borderRadius: 'var(--radius-extra-large)' } } },
            xl: { root: { base: { borderRadius: 'var(--radius-extra-large)' } } },
        },
    },
    keyframes: { 'zero-material-skeleton': 'from, to { opacity: 1; } 50% { opacity: 0.55; }' },
};

/**
 * Spinner — a ring with one segment in the ink, turning. Borders rather than a
 * gradient so it survives `forced-colors`, which drops a `background-image`
 * and keeps a border. Under reduced motion it STOPS; the inked segment is what
 * carries the meaning standing still, where a uniform ring would read as an
 * empty circle.
 */
export const spinner: RecipeInput = {
    component: 'spinner',
    tokens: {
        // M3's circular indicator: 40dp, a 4dp arc in the role, no track
        // while indeterminate.
        '--spinner-size': dp(40),
        '--spinner-ink': 'var(--color-primary)',
        '--spinner-track': 'transparent',
    },
    parts: {
        root: {
            base: {
                display: 'inline-block',
                inlineSize: 'var(--spinner-size)',
                blockSize: 'var(--spinner-size)',
                boxSizing: 'border-box',
                borderRadius: '50%',
                border: 'calc(var(--spinner-size) / 10) solid var(--spinner-track)',
                borderBlockStartColor: 'var(--spinner-ink)',
                borderInlineEndColor: 'var(--spinner-ink)',
                animation: 'zero-material-spin 1s linear infinite',
            },
            at: { 'reduced-motion': { base: { animation: 'none' } } },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--spinner-ink': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--spinner-size': dp(16) } } },
            sm: { root: { base: { '--spinner-size': dp(24) } } },
            md: {},
            lg: { root: { base: { '--spinner-size': dp(48) } } },
            xl: { root: { base: { '--spinner-size': dp(64) } } },
        },
    },
    keyframes: { 'zero-material-spin': 'to { transform: rotate(360deg); }' },
};

// ── The content-tier sweep (#334) ─────────────────────────────────────────
/**
 * Material kbd: a tonal chip on the raised container tone, in the mono face —
 * Material's own docs render shortcuts as small tonal containers, not
 * skeuomorphic caps.
 */
export const kbd: RecipeInput = {
    component: 'kbd',
    tokens: {
        '--kbd-fill': 'var(--color-surface-container-high)',
        '--kbd-ink': 'var(--color-surface-container-high-content)',
    },
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minInlineSize: '1.75em',
                padding: '0 var(--space-xs)',
                background: 'var(--kbd-fill)',
                color: 'var(--kbd-ink)',
                borderRadius: 'var(--radius-extra-small)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-medium)',
                letterSpacing: 'var(--tracking-wide)',
                lineHeight: 'var(--leading-normal)',
                whiteSpace: 'nowrap',
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--kbd-fill': `var(--color-${c})`,
            '--kbd-ink': `var(--color-${c}-content)`,
        } } }])),
        size: {
            xs: { root: { base: { fontSize: 'var(--text-xs)', padding: '0 var(--space-xs)', minInlineSize: '1.5em' } } },
            sm: { root: { base: { fontSize: 'var(--text-xs)', padding: '0 var(--space-sm)' } } },
            md: {},
            lg: { root: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-2xs) var(--space-md)' } } },
            xl: { root: { base: { fontSize: 'var(--text-lg)', padding: 'var(--space-xs) var(--space-lg)' } } },
        },
    },
};

/**
 * Material status: the badge dot from Material's own badge spec — a plain
 * filled circle, default in the primary tone. Border in the same ink for
 * `forced-colors`, where the background fill is dropped.
 */
export const status: RecipeInput = {
    component: 'status',
    tokens: {
        '--status-ink': 'var(--color-primary)',
        '--status-size': 'calc(var(--size-selector) * 2.5)',
    },
    parts: {
        root: {
            base: {
                display: 'inline-block',
                inlineSize: 'var(--status-size)',
                blockSize: 'var(--status-size)',
                boxSizing: 'border-box',
                verticalAlign: 'middle',
                background: 'var(--status-ink)',
                border: 'calc(var(--status-size) / 2) solid var(--status-ink)',
                borderRadius: '50%',
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--status-ink': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--status-size': 'calc(var(--size-selector) * 1.5)' } } },
            sm: { root: { base: { '--status-size': 'calc(var(--size-selector) * 2)' } } },
            md: {},
            lg: { root: { base: { '--status-size': 'calc(var(--size-selector) * 3)' } } },
            xl: { root: { base: { '--status-size': 'calc(var(--size-selector) * 3.5)' } } },
        },
    },
};

/**
 * Indicator — pure position; the item's content brings its own paint.
 * Colour accents bare-text items, size moves their type scale.
 */
export const indicator: RecipeInput = {
    component: 'indicator',
    parts: {
        root: {
            base: {
                position: 'relative',
                display: 'inline-flex',
                verticalAlign: 'middle',
                maxWidth: 'max-content',
            },
        },
        item: {
            base: {
                position: 'absolute',
                zIndex: '1',
                whiteSpace: 'nowrap',
            },
            selectors: {
                // Logical insets place the slot; `translate` centres the item
                // on it. A transform has no logical spelling, so the inline
                // half is flipped by hand under RTL below — the exact blind
                // spot the physical-direction lint cannot see (e2e/rtl.spec).
                '&[data-placement="top-start"]': { insetBlockStart: '0', insetInlineStart: '0', translate: '-50% -50%' },
                '&[data-placement="top"]': { insetBlockStart: '0', insetInlineStart: '50%', translate: '-50% -50%' },
                '&[data-placement="top-end"]': { insetBlockStart: '0', insetInlineEnd: '0', translate: '50% -50%' },
                '&[data-placement="start"]': { insetBlockStart: '50%', insetInlineStart: '0', translate: '-50% -50%' },
                '&[data-placement="end"]': { insetBlockStart: '50%', insetInlineEnd: '0', translate: '50% -50%' },
                '&[data-placement="bottom-start"]': { insetBlockEnd: '0', insetInlineStart: '0', translate: '-50% 50%' },
                '&[data-placement="bottom"]': { insetBlockEnd: '0', insetInlineStart: '50%', translate: '-50% 50%' },
                '&[data-placement="bottom-end"]': { insetBlockEnd: '0', insetInlineEnd: '0', translate: '50% 50%' },
                [`&[data-placement="top-start"]${rtl}`]: { translate: '50% -50%' },
                [`&[data-placement="top"]${rtl}`]: { translate: '50% -50%' },
                [`&[data-placement="top-end"]${rtl}`]: { translate: '-50% -50%' },
                [`&[data-placement="start"]${rtl}`]: { translate: '50% -50%' },
                [`&[data-placement="end"]${rtl}`]: { translate: '-50% -50%' },
                [`&[data-placement="bottom-start"]${rtl}`]: { translate: '50% 50%' },
                [`&[data-placement="bottom"]${rtl}`]: { translate: '50% 50%' },
                [`&[data-placement="bottom-end"]${rtl}`]: { translate: '-50% 50%' },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { item: { base: {
            color: `var(--color-${c})`,
        } } }])),
        size: {
            xs: { item: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { item: { base: { fontSize: 'var(--text-xs)' } } },
            md: {},
            lg: { item: { base: { fontSize: 'var(--text-md)' } } },
            xl: { item: { base: { fontSize: 'var(--text-lg)' } } },
        },
    },
};

/** Material stats: a tonal container; the value in the display face. */
export const stats: RecipeInput = {
    component: 'stats',
    tokens: { '--stats-accent': 'var(--color-surface-container-content)' },
    parts: {
        root: {
            // The row's own scroll box (#43): a value never wraps or shrinks
            // (`nowrap` below), so a row too wide for its container scrolls
            // inside the root — daisyUI's own `.stats` behaviour, and Table's
            // and Pagination's answer — instead of pushing the page sideways.
            // Items keep their flex automatic minimum — their min-content
            // width — so the overflow lands here rather than in the next
            // item. No ring room: a stat is not focusable, and anything a
            // consumer puts in one sits inside the item's own padding.
            base: {
                display: 'flex',
                overflowX: 'auto',
                background: 'var(--color-surface-container)',
                color: 'var(--color-surface-container-content)',
                borderRadius: 'var(--radius-extra-large)',
            },
            selectors: {
                '&[data-orientation="vertical"]': { flexDirection: 'column' },
            },
        },
        item: {
            base: {
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                columnGap: 'var(--space-md)',
                alignContent: 'center',
                flex: '1 1 0%',
                padding: 'var(--space-lg) var(--space-xl)',
            },
            selectors: {
                '&[data-orientation="horizontal"] + &': {
                    borderInlineStart: 'var(--border) solid var(--color-outline)',
                },
                '&[data-orientation="vertical"] + &': {
                    borderBlockStart: 'var(--border) solid var(--color-outline)',
                },
            },
        },
        title: {
            base: {
                gridColumn: '1',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'var(--color-surface-variant-content)',
            },
        },
        value: {
            base: {
                gridColumn: '1',
                // A figure is read whole: `$12 930` never breaks at its space.
                whiteSpace: 'nowrap',
                fontSize: 'var(--text-2xl)',
                fontWeight: 'var(--weight-medium)',
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--stats-accent)',
            },
        },
        desc: {
            base: {
                gridColumn: '1',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-surface-variant-content)',
            },
        },
        figure: {
            base: {
                gridColumn: '2',
                gridRow: '1 / span 3',
                alignSelf: 'center',
            },
        },
    },
    variants: {
        // Keyed on the ITEM, not the root (#161): the item re-carries
        // `color`, so a stat's own value outranks the row's, and the value
        // inside it inherits whichever won. A root colour still reaches
        // every item through the carrier's donut.
        color: Object.fromEntries(ROLES.map((c) => [c, { item: { base: {
            '--stats-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { value: { base: { fontSize: 'var(--text-lg)' } } },
            sm: { value: { base: { fontSize: 'var(--text-xl)' } } },
            md: {},
            lg: { value: { base: { fontSize: 'var(--text-3xl)' } } },
            xl: { value: { base: { fontSize: 'var(--text-3xl)' } } },
        },
    },
};

/**
 * A timeline none of whose content sits on the start side: the root carries
 * no start-placed content among its own items. Child combinators all the way
 * down, so a timeline nested inside another's content answers only for
 * itself.
 */
const TIMELINE_NO_START = '[data-scope="timeline"][data-part="root"]'
    + ':not(:has(> [data-scope="timeline"][data-part="item"] > [data-scope="timeline"][data-part="content"][data-placement="start"])) > &';

/** Material timeline: tonal content chips along a hairline axis. */
export const timeline: RecipeInput = {
    component: 'timeline',
    // Public to a design system derived from this one (#73).
    hooks: {
        properties: {
            '--timeline-accent': 'The marker and connector accent.',
            '--timeline-marker-size': 'The marker diameter.',
        },
    },
    tokens: { '--timeline-accent': 'var(--color-primary)', '--timeline-marker-size': 'calc(var(--size-selector) * 3)' },
    parts: {
        root: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                listStyle: 'none',
                margin: '0',
                padding: '0',
            },
            selectors: {
                // A horizontal timeline is a row of steps whose width follows
                // the step count, not the container: at phone width it scrolls
                // inside its own box, the answer Table and Pagination give
                // (#45), rather than widening the page.
                '&[data-orientation="horizontal"]': { flexDirection: 'row', overflowX: 'auto' },
            },
        },
        /**
         * One item is a 3×2 grid around the axis. Vertical: columns are
         * [start-content | axis | end-content], the connector drops below the
         * marker. Horizontal: transposed. Grid tracks follow the inline
         * direction, so the whole layout mirrors under RTL with no
         * corrections.
         */
        item: {
            base: {
                display: 'grid',
                position: 'relative',
            },
            selectors: {
                '&[data-orientation="vertical"]': {
                    gridTemplateColumns: '1fr auto 1fr',
                    gridTemplateRows: 'auto 1fr',
                },
                '&[data-orientation="horizontal"]': {
                    gridTemplateRows: '1fr auto 1fr',
                    gridTemplateColumns: 'auto 1fr',
                    flex: '1 1 0%',
                },
                // No content on the start side anywhere in this timeline →
                // the start track collapses instead of holding half the item
                // empty (#57). Automatic, so there is no prop to forget.
                [`${TIMELINE_NO_START}[data-orientation="vertical"]`]: { gridTemplateColumns: '0 auto 1fr' },
                [`${TIMELINE_NO_START}[data-orientation="horizontal"]`]: { gridTemplateRows: '0 auto 1fr' },
            },
        },
        marker: {
            base: {
                inlineSize: 'var(--timeline-marker-size)',
                blockSize: 'var(--timeline-marker-size)',
                boxSizing: 'border-box',
                borderRadius: '50%',
                background: 'var(--timeline-accent)',
                border: 'calc(var(--timeline-marker-size) / 2) solid var(--timeline-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0',
            },
            selectors: {
                // The axis cell, both orientations. `place-self` centres the
                // dot on the line in the cross axis.
                '[data-scope="timeline"][data-part="item"][data-orientation="vertical"] > &': {
                    gridColumn: '2',
                    gridRow: '1',
                    placeSelf: 'center',
                },
                '[data-scope="timeline"][data-part="item"][data-orientation="horizontal"] > &': {
                    gridRow: '2',
                    gridColumn: '1',
                    placeSelf: 'center',
                },
            },
        },
        connector: {
            base: {
                background: 'var(--color-outline)',
            },
            selectors: {
                '&[data-orientation="vertical"]': {
                    gridColumn: '2',
                    gridRow: '2',
                    justifySelf: 'center',
                    inlineSize: 'var(--border)',
                    minBlockSize: 'var(--space-lg)',
                    blockSize: '100%',
                },
                '&[data-orientation="horizontal"]': {
                    gridRow: '2',
                    gridColumn: '2',
                    alignSelf: 'center',
                    blockSize: 'var(--border)',
                    minInlineSize: 'var(--space-lg)',
                    inlineSize: '100%',
                },
            },
        },
        content: {
            base: {
                margin: 'var(--space-2xs) var(--space-md)',
                padding: 'var(--space-xs) var(--space-lg)',
                fontSize: 'var(--text-sm)',
                background: 'var(--color-surface-container)',
                color: 'var(--color-surface-container-content)',
                borderRadius: 'var(--radius-medium)',
            },
            selectors: {
                // side × axis, composed on the one element that carries both.
                '&[data-orientation="vertical"][data-placement="start"]': {
                    gridColumn: '1',
                    gridRow: '1',
                    justifySelf: 'end',
                    textAlign: 'end',
                },
                '&[data-orientation="vertical"][data-placement="end"]': {
                    gridColumn: '3',
                    gridRow: '1',
                    justifySelf: 'start',
                },
                '&[data-orientation="horizontal"][data-placement="start"]': {
                    gridRow: '1',
                    gridColumn: '1',
                    alignSelf: 'end',
                },
                '&[data-orientation="horizontal"][data-placement="end"]': {
                    gridRow: '3',
                    gridColumn: '1',
                    alignSelf: 'start',
                },
            },
        },
        // Title and description (#302): M3's title-small over body-small —
        // medium weight with tracking, then the detail in a quieter ink.
        title: { base: { display: 'block', margin: '0', fontWeight: 'var(--weight-medium)', letterSpacing: 'var(--tracking-wide)', lineHeight: 'var(--leading-tight)' } },
        description: { base: { display: 'block', margin: '0', marginBlockStart: 'var(--space-2xs)', color: 'var(--color-surface-variant-content)' } },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { marker: { base: {
            '--timeline-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { marker: { base: { '--timeline-marker-size': 'calc(var(--size-selector) * 2)' } }, content: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { marker: { base: { '--timeline-marker-size': 'calc(var(--size-selector) * 2.5)' } }, content: { base: { fontSize: 'var(--text-xs)' } } },
            md: {},
            lg: { marker: { base: { '--timeline-marker-size': 'calc(var(--size-selector) * 3.5)' } }, content: { base: { fontSize: 'var(--text-md)' } } },
            xl: { marker: { base: { '--timeline-marker-size': 'calc(var(--size-selector) * 4)' } }, content: { base: { fontSize: 'var(--text-md)' } } },
        },
    },
};

/** Material chat: tonal bubbles, the seated corner at the `extra-small` radius. */
export const chat: RecipeInput = {
    component: 'chat',
    tokens: { '--chat-fill': 'var(--color-surface-container)', '--chat-ink': 'var(--color-surface-container-content)' },
    parts: {
        /**
         * The row is a two-column grid: the avatar column hugs one side, the
         * text column takes the rest. Which side is which is the row's
         * `data-placement` — logical, so the whole transcript mirrors under
         * RTL with no per-part rules. Header, bubble and footer each force
         * their own row by claiming the same column, so absent parts simply
         * yield their row.
         */
        root: {
            base: {
                display: 'grid',
                columnGap: 'var(--space-sm)',
                rowGap: 'var(--space-2xs)',
                paddingBlock: 'var(--space-2xs)',
            },
            selectors: {
                '&[data-placement="start"]': {
                    gridTemplateColumns: 'auto minmax(0, 1fr)',
                    justifyItems: 'start',
                },
                '&[data-placement="end"]': {
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    justifyItems: 'end',
                },
            },
        },
        avatar: {
            base: {
                gridRow: '1 / span 3',
                alignSelf: 'end',
                display: 'flex',
                alignItems: 'center',
            },
            selectors: {
                '[data-scope="chat"][data-part="root"][data-placement="start"] > &': { gridColumn: '1' },
                '[data-scope="chat"][data-part="root"][data-placement="end"] > &': { gridColumn: '2' },
            },
        },
        header: {
            base: {
                fontSize: 'var(--text-xs)',
                color: 'var(--color-surface-variant-content)',
            },
            selectors: {
                '[data-scope="chat"][data-part="root"][data-placement="start"] > &': { gridColumn: '2' },
                '[data-scope="chat"][data-part="root"][data-placement="end"] > &': { gridColumn: '1' },
            },
        },
        bubble: {
            base: {
                maxInlineSize: '90%',
                padding: 'var(--space-xs) var(--space-lg)',
                fontSize: 'var(--text-sm)',
                background: 'var(--chat-fill)',
                color: 'var(--chat-ink)',
                borderRadius: 'var(--radius-extra-large)',
            },
            selectors: {
                '[data-scope="chat"][data-part="root"][data-placement="start"] > &': {
                    gridColumn: '2',
                    borderEndStartRadius: 'var(--radius-extra-small)',
                },
                '[data-scope="chat"][data-part="root"][data-placement="end"] > &': {
                    gridColumn: '1',
                    borderEndEndRadius: 'var(--radius-extra-small)',
                },
            },
        },
        footer: {
            base: {
                fontSize: 'var(--text-xs)',
                color: 'var(--color-surface-variant-content)',
            },
            selectors: {
                '[data-scope="chat"][data-part="root"][data-placement="start"] > &': { gridColumn: '2' },
                '[data-scope="chat"][data-part="root"][data-placement="end"] > &': { gridColumn: '1' },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { bubble: { base: {
            '--chat-fill': `var(--color-${c})`,
            '--chat-ink': `var(--color-${c}-content)`,
        } } }])),
        size: {
            xs: { bubble: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-2xs) var(--space-sm)' } } },
            sm: { bubble: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-xs) var(--space-md)' } } },
            md: {},
            lg: { bubble: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-md) var(--space-lg)' } } },
            xl: { bubble: { base: { fontSize: 'var(--text-lg)', padding: 'var(--space-md) var(--space-xl)' } } },
        },
    },
};

/**
 * ChatLog — a tonal surface that scrolls (no outline: M3 separates with
 * tone, not hairlines), bubbles on `surface-container` inside it. The jump
 * trigger is M3's small extended FAB: the role's solid pair at `level3`,
 * the `medium` corner, an 8%/12% state layer of its own ink for hover and
 * press — floated over the rows by `position: sticky` at the box's foot.
 * Its negative block margin gives back the line it would take, so
 * appearing moves no row.
 */
export const chatLog: RecipeInput = {
    component: 'chat-log',
    tokens: {
        '--chat-log-fill': 'var(--color-primary)',
        '--chat-log-on-fill': 'var(--color-primary-content)',
        '--chat-log-jump-size': 'calc(var(--size-field) * 10)',
    },
    parts: {
        root: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                overscrollBehaviorY: 'contain',
                borderRadius: 'var(--radius-extra-large)',
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
                padding: 'var(--space-md)',
            },
            // Drawn inside the box (negative offset): an outward ring would
            // be clipped by whatever scrolls around the transcript.
            states: { 'focus-visible': { outline: '3px solid var(--color-secondary)', outlineOffset: '-3px' } },
        },
        content: {
            base: {
                // `auto` gathers a short transcript at the foot; a long one
                // overflows and the margin resolves to nothing.
                marginBlockStart: 'auto',
                flex: 'none',
                display: 'grid',
                rowGap: 'var(--space-sm)',
            },
        },
        'jump-trigger': {
            base: {
                position: 'sticky',
                insetBlockEnd: 'var(--space-md)',
                alignSelf: 'center',
                flex: 'none',
                marginBlockStart: 'calc(var(--chat-log-jump-size) * -1)',
                blockSize: 'var(--chat-log-jump-size)',
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                paddingInline: 'var(--space-lg)',
                border: 'none',
                borderRadius: 'var(--radius-medium)',
                background: 'var(--chat-log-fill)',
                color: 'var(--chat-log-on-fill)',
                boxShadow: 'var(--shadow-level3)',
                ...label,
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                transition: motion('background, box-shadow'),
            },
            states: {
                open: {},
                closed: {},
                // MD3 state layers, folded into the fill: hover 8%, focus and pressed 10%.
                hover: { background: 'color-mix(in oklch, var(--chat-log-fill), var(--chat-log-on-fill) 8%)' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': {
                    background: 'color-mix(in oklch, var(--chat-log-fill), var(--chat-log-on-fill) 10%)',
                    boxShadow: 'var(--shadow-level2)',
                },
            },
            at: { 'reduced-motion': { base: { transition: 'none' } } },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { 'jump-trigger': { base: {
            '--chat-log-fill': `var(--color-${c})`,
            '--chat-log-on-fill': `var(--color-${c}-content)`,
        } } }])),
        size: {
            xs: { content: { base: { rowGap: 'var(--space-2xs)' } }, 'jump-trigger': { base: { '--chat-log-jump-size': 'calc(var(--size-field) * 8)', fontSize: 'var(--text-xs)' } } },
            sm: { content: { base: { rowGap: 'var(--space-xs)' } }, 'jump-trigger': { base: { '--chat-log-jump-size': 'calc(var(--size-field) * 9)', fontSize: 'var(--text-xs)' } } },
            md: {},
            lg: { content: { base: { rowGap: 'var(--space-md)' } }, 'jump-trigger': { base: { '--chat-log-jump-size': 'calc(var(--size-field) * 12)', fontSize: 'var(--text-md)' } } },
            xl: { content: { base: { rowGap: 'var(--space-lg)' } }, 'jump-trigger': { base: { '--chat-log-jump-size': 'calc(var(--size-field) * 14)', fontSize: 'var(--text-md)' } } },
        },
    },
};

/** Material radial: the M3 circular indicator, with a visible channel. */
export const radialProgress: RecipeInput = {
    component: 'radial-progress',
    tokens: {
        // M3's circular indicator: 48dp, a 4dp stroke over the
        // surface-container-highest track.
        '--radial-size': dp(48),
        '--radial-thickness': dp(4),
        '--radial-ink': 'var(--color-primary)',
        '--radial-track': 'var(--color-surface-container-highest)',
    },
    parts: {
        root: {
            base: {
                position: 'relative',
                display: 'inline-grid',
                placeItems: 'center',
                inlineSize: 'var(--radial-size)',
                blockSize: 'var(--radial-size)',
                borderRadius: '50%',
            },
            states: {
                loading: {},
                // Complete is semantic, not an accent: it goes success
                // whatever the colour variant — linear progress's rule.
                complete: { '--radial-ink': 'var(--color-success)' },
                indeterminate: {},
            },
            selectors: {
                // The channel: a full annulus in the track colour.
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: '0',
                    borderRadius: '50%',
                    background: 'var(--radial-track)',
                    mask: 'radial-gradient(closest-side, transparent calc(100% - var(--radial-thickness)), #000 calc(100% - var(--radial-thickness) + 0.5px))',
                },
                /**
                 * The arc: a background-COLOUR ink under annulus ∩ sweep
                 * masks, not a conic-gradient image — the contrast audit's
                 * indicator matrix reads colour layers and deliberately not
                 * box-painting gradients, so this is what keeps the ring
                 * measurable. The sweep angle is the runtime's
                 * `--progress-percent`; the fallback is indeterminate's
                 * resting arc.
                 */
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    inset: '0',
                    borderRadius: '50%',
                    background: 'var(--radial-ink)',
                    mask: 'radial-gradient(closest-side, transparent calc(100% - var(--radial-thickness)), #000 calc(100% - var(--radial-thickness) + 0.5px)), conic-gradient(#000 var(--progress-percent, 30%), transparent 0)',
                    maskComposite: 'intersect',
                },
                '&[data-state="indeterminate"]::after': {
                    // A loop: literal duration, so reduced motion STOPS it
                    // rather than collapsing it to a strobe.
                    animation: 'zero-material-radial-spin 1.2s linear infinite',
                },
            },
            at: {
                'reduced-motion': {
                    selectors: {
                        // The resting 30% arc still reads as "in progress".
                        '&[data-state="indeterminate"]::after': { animation: 'none' },
                    },
                },
                // Backgrounds (and masks) drop under forced colors and in
                // print; a plain ring keeps the shape of the thing.
                'forced-colors': {
                    base: { border: 'calc(var(--border) * 2) solid CanvasText' },
                },
                print: {
                    base: { border: 'calc(var(--border) * 2) solid var(--radial-ink)' },
                },
            },
        },
        label: {
            base: {
                fontSize: 'var(--text-xs)',
                color: 'var(--color-surface-variant-content)',
            },
        },
        'value-text': {
            base: {
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--color-base-content)',
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--radial-ink': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--radial-size': dp(24), '--radial-thickness': dp(3) } } },
            sm: { root: { base: { '--radial-size': dp(36), '--radial-thickness': dp(4) } } },
            md: {},
            lg: { root: { base: { '--radial-size': dp(64), '--radial-thickness': dp(6) } } },
            xl: { root: { base: { '--radial-size': dp(96), '--radial-thickness': dp(8) } } },
        },
    },
    keyframes: { 'zero-material-radial-spin': 'to { transform: rotate(360deg); }' },
};

/**
 * M3 Expressive's connected button group (#415), which is also its split
 * button: the segments stand 2dp apart instead of sharing a seam, their
 * inner corners drop to a small radius while the outer ones keep each
 * control's own shape, and an item whose control opens a menu (the split
 * button's trailing half) turns fully round while it is open.
 *
 * All logical (border-*-radius longhands, gap), so the group mirrors under
 * RTL untouched.
 */
export const join: RecipeInput = {
    component: 'join',
    tokens: { '--join-inner': dp(8) },
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                alignItems: 'stretch',
                gap: 'var(--space-3xs)',
            },
            selectors: {
                '&[data-orientation="vertical"]': { flexDirection: 'column' },
            },
        },
        item: {
            base: {
                position: 'relative',
            },
            selectors: {
                // Each corner rule lands on the item AND its direct child:
                // asChild puts the item attributes on the control itself, but
                // in wrapper mode the control is the child, and a wrapper
                // cannot shape a radius it does not carry.
                '&[data-orientation="horizontal"]:not(:first-child), &[data-orientation="horizontal"]:not(:first-child) > *': {
                    borderStartStartRadius: 'var(--join-inner)',
                    borderEndStartRadius: 'var(--join-inner)',
                },
                '&[data-orientation="horizontal"]:not(:last-child), &[data-orientation="horizontal"]:not(:last-child) > *': {
                    borderStartEndRadius: 'var(--join-inner)',
                    borderEndEndRadius: 'var(--join-inner)',
                },
                '&[data-orientation="vertical"]:not(:first-child), &[data-orientation="vertical"]:not(:first-child) > *': {
                    borderStartStartRadius: 'var(--join-inner)',
                    borderStartEndRadius: 'var(--join-inner)',
                },
                '&[data-orientation="vertical"]:not(:last-child), &[data-orientation="vertical"]:not(:last-child) > *': {
                    borderEndStartRadius: 'var(--join-inner)',
                    borderEndEndRadius: 'var(--join-inner)',
                },
                // The split button's menu half, open: M3 rounds it fully.
                '&[data-orientation] > [data-state="open"]': { borderRadius: 'var(--radius-full)' },
                '&:focus-within': { zIndex: '1' },
                '&:focus-visible': { zIndex: '1' },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { item: { base: {
            color: `var(--color-${c})`,
        } } }])),
        // M3's inner corner per button size: 4dp at XS, 8 at S and M, 16 at
        // L, 20 at XL; the type follows the ramp for bare text items.
        size: {
            xs: { root: { base: { '--join-inner': dp(4) } }, item: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { item: { base: { fontSize: 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { '--join-inner': dp(16) } }, item: { base: { fontSize: 'var(--text-md)' } } },
            xl: { root: { base: { '--join-inner': dp(20) } }, item: { base: { fontSize: 'var(--text-lg)' } } },
        },
    },
};

/**
 * Navbar — M3's top app bar: a surface band, no border (Material separates
 * by tone, not line), the title area in the headline type. Colour refills
 * the band with the role pair, which is the M1-era coloured app bar
 * Material still specifies for expressive products.
 *
 * M3's top app bar (#419): `small` (64dp, surface, a title-large headline),
 * `center-aligned` (the `center` part is the centred headline), `medium` and
 * `large` (112 / 152dp, the headline — the `center` part — on its own row
 * under the icons, headline-small / headline-medium), and `bottom`, the
 * bottom app bar (80dp, surface-container). A top bar with content
 * scrolled under it fills with surface-container, keyed on the root's
 * `scrolled` flag (#530); a coloured bar keeps its role pair.
 */
export const navbar: RecipeInput = {
    component: 'navbar',
    parts: {
        root: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2xs)',
                boxSizing: 'border-box',
                minBlockSize: dp(64),
                paddingInline: 'var(--space-2xs)',
                background: 'var(--color-surface)',
                color: 'var(--color-surface-content)',
                ...type('body-medium'),
                transition: motion('background-color, color'),
            },
            selectors: {
                // Scrolled under: surface-container, M3's on-scroll fill.
                '&[data-scrolled]:not([data-color])': {
                    background: 'var(--color-surface-container)',
                    color: 'var(--color-surface-container-content)',
                },
            },
            at: { 'reduced-motion': { base: { transition: 'none' } } },
        },
        // The small bar's headline sits here, after the navigation icon:
        // title-large, 16dp in.
        start: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                flex: '1 1 0%',
                justifyContent: 'flex-start',
                paddingInlineStart: 'var(--space-sm)',
                ...type('title-large'),
            },
        },
        center: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                justifyContent: 'center',
            },
        },
        end: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                flex: '1 1 0%',
                justifyContent: 'flex-end',
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            background: `var(--color-${c})`,
            color: `var(--color-${c}-content)`,
        } } }])),
        size: {
            xs: { root: { base: { minBlockSize: dp(48), fontSize: 'var(--text-sm)' } } },
            sm: { root: { base: { minBlockSize: dp(56), fontSize: 'var(--text-md)' } } },
            md: {},
            lg: { root: { base: { minBlockSize: dp(72) } } },
            xl: { root: { base: { minBlockSize: dp(80), fontSize: 'var(--text-2xl)' } } },
        },
        variant: {
            small: {},
            'center-aligned': { center: { base: { flex: '1 1 auto', ...type('title-large') } } },
            medium: {
                root: { base: {
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gridTemplateAreas: '"start end" "center center"',
                    alignContent: 'space-between',
                    minBlockSize: dp(112),
                    paddingBlockEnd: 'var(--space-lg)',
                } },
                start: { base: { gridArea: 'start' } },
                end: { base: { gridArea: 'end' } },
                center: { base: { gridArea: 'center', justifyContent: 'flex-start', paddingInline: 'var(--space-sm)', ...type('headline-small') } },
            },
            large: {
                root: { base: {
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gridTemplateAreas: '"start end" "center center"',
                    alignContent: 'space-between',
                    minBlockSize: dp(152),
                    paddingBlockEnd: 'var(--space-xl)',
                } },
                start: { base: { gridArea: 'start' } },
                end: { base: { gridArea: 'end' } },
                center: { base: { gridArea: 'center', justifyContent: 'flex-start', paddingInline: 'var(--space-sm)', ...type('headline-medium') } },
            },
            bottom: { root: { base: {
                minBlockSize: dp(80),
                paddingInline: 'var(--space-md)',
                background: 'var(--color-surface-container)',
                color: 'var(--color-surface-container-content)',
            } } },
        },
    },
    defaultVariants: { variant: 'small' },
};

/**
 * NavList (zero#132) — M3's navigation, by `variant` (#419):
 *
 * - `drawer` (the default): the navigation drawer's 56dp pill rows,
 *   label-large, the active row on secondary-container, title-small headings.
 * - `rail`: the navigation rail — an 80dp column of destinations, each an
 *   icon over a label-medium label, the active one marked by a 56 x 32dp
 *   pill behind the icon alone (the `icon` part).
 * - `bar`: the navigation bar — the same destinations laid across an 80dp
 *   row on surface-container, sharing its width.
 *
 * The rail and bar needed no new zero component: `icon` is the part the
 * active pill rides, which settles #420's question.
 */
export const navList: RecipeInput = {
    component: 'nav-list',
    hooks: {
        properties: {
            '--nav-accent': 'The active item\'s ink.',
            '--nav-tint': 'The active item\'s container.',
            '--nav-ink': 'The resting item ink.',
        },
    },
    tokens: {
        '--nav-accent': 'var(--color-secondary)',
        '--nav-tint': 'var(--color-secondary-container)',
        '--nav-on-tint': 'var(--color-secondary-container-content)',
        '--nav-ink': 'var(--color-base-content)',
    },
    parts: {
        root: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-lg)',
                ...type('label-large'),
                color: 'var(--color-base-content)',
            },
        },
        group: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' },
        },
        // M3's drawer section header: title-small in on-surface-variant.
        heading: {
            base: {
                paddingInline: 'var(--space-md)',
                ...type('title-small'),
                color: 'var(--color-surface-variant-content)',
            },
        },
        list: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2xs)',
                listStyle: 'none',
                margin: '0',
                padding: '0',
            },
        },
        item: { base: { display: 'block' } },
        link: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                textDecoration: 'none',
                // Without an href the link is a <button> (#451): drop its chrome.
                appearance: 'none',
                background: 'none',
                border: '0',
                font: 'inherit',
                textAlign: 'start',
                inlineSize: '100%',
                cursor: 'pointer',
                color: 'var(--color-surface-variant-content)',
                // M3's drawer item: a 56dp pill, 16dp in, a 12dp icon gap.
                boxSizing: 'border-box',
                minBlockSize: dp(56),
                paddingInline: 'var(--space-md)',
                borderRadius: '9999px',
                transition: motion('background, color'),
            },
            states: {
                hover: { background: 'color-mix(in oklab, var(--color-base-content) 8%, transparent)' },
                active: { background: 'var(--nav-tint)', color: 'var(--nav-on-tint)' },
                inactive: {},
                ...focusRing,
            },
        },
        icon: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                inlineSize: dp(24),
                justifyContent: 'center',
                flex: 'none',
                fontSize: dp(24),
                lineHeight: 'var(--leading-none)',
                transition: motion('background, color'),
            },
            selectors: { '& > svg': { inlineSize: dp(24), blockSize: dp(24) } },
        },
        meta: {
            base: {
                marginInlineStart: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: 'var(--text-xs)',
                fontVariantNumeric: 'tabular-nums',
            },
        },
    },
    variants: {
        variant: {
            drawer: {},
            rail: {
                root: { base: { inlineSize: dp(80), alignItems: 'stretch', gap: 'var(--space-xs)' } },
                list: { base: { gap: 'var(--space-sm)' } },
                link: {
                    base: {
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: 'var(--space-2xs)',
                        minBlockSize: dp(56),
                        paddingInline: '0',
                        background: 'transparent',
                        borderRadius: '0',
                        textAlign: 'center',
                        ...type('label-medium'),
                    },
                    selectors: {
                        '&:hover': { background: 'transparent' },
                        '&[data-state="active"]': { background: 'transparent', color: 'var(--color-base-content)' },
                    },
                },
                // The active indicator: a 56 x 32dp pill behind the icon.
                icon: {
                    base: { inlineSize: dp(56), blockSize: dp(32), borderRadius: '9999px' },
                    selectors: {
                        '[data-state="active"] > &': { background: 'var(--nav-tint)', color: 'var(--nav-on-tint)' },
                        '[data-part="link"]:hover:not([data-state="active"]) > &': {
                            background: 'color-mix(in oklab, var(--color-base-content) 8%, transparent)',
                        },
                    },
                },
                meta: { base: { display: 'none' } },
                heading: { base: { display: 'none' } },
            },
            bar: {
                root: { base: {
                    flexDirection: 'row',
                    boxSizing: 'border-box',
                    inlineSize: '100%',
                    minBlockSize: dp(80),
                    background: 'var(--color-surface-container)',
                } },
                group: { base: { flex: '1 1 auto' } },
                list: { base: { flexDirection: 'row', flex: '1 1 auto', alignItems: 'center' } },
                item: { base: { flex: '1 1 0%' } },
                link: {
                    base: {
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: 'var(--space-2xs)',
                        minBlockSize: dp(56),
                        paddingInline: '0',
                        background: 'transparent',
                        borderRadius: '0',
                        textAlign: 'center',
                        ...type('label-medium'),
                    },
                    selectors: {
                        '&:hover': { background: 'transparent' },
                        '&[data-state="active"]': { background: 'transparent', color: 'var(--color-base-content)' },
                    },
                },
                // The active indicator: a 56 x 32dp pill behind the icon.
                icon: {
                    base: { inlineSize: dp(56), blockSize: dp(32), borderRadius: '9999px' },
                    selectors: {
                        '[data-state="active"] > &': { background: 'var(--nav-tint)', color: 'var(--nav-on-tint)' },
                        '[data-part="link"]:hover:not([data-state="active"]) > &': {
                            background: 'color-mix(in oklab, var(--color-base-content) 8%, transparent)',
                        },
                    },
                },
                meta: { base: { display: 'none' } },
                heading: { base: { display: 'none' } },
            },
        },
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--nav-accent': `var(--color-${c})`,
            '--nav-tint': `var(--color-${c}-soft)`,
            '--nav-on-tint': `var(--color-${c}-soft-content)`,
        } } }])),
        size: {
            xs: { root: { base: { fontSize: 'var(--text-xs)' } }, link: { base: { padding: 'var(--space-2xs) var(--space-md)' } } },
            sm: { root: { base: { fontSize: 'var(--text-xs)' } }, link: { base: { padding: 'var(--space-xs) var(--space-md)' } } },
            md: {},
            lg: { root: { base: { fontSize: 'var(--text-md)' } }, link: { base: { padding: 'var(--space-md) var(--space-xl)' } } },
            xl: { root: { base: { fontSize: 'var(--text-lg)' } }, link: { base: { padding: 'var(--space-lg) var(--space-xl)' } } },
        },
    },
    defaultVariants: { variant: 'drawer' },
};

/**
 * Breadcrumbs — Material's label-large trail: on-surface-variant links that
 * rise to on-surface under the pointer, the current page in on-surface with
 * medium weight. No underlines — Material separates interactivity by tone,
 * not decoration. Colour rebinds the current page's ink.
 */
export const breadcrumbs: RecipeInput = {
    component: 'breadcrumbs',
    tokens: { '--bc-accent': 'var(--color-base-content)' },
    parts: {
        root: {
            base: {
                fontSize: 'var(--text-sm)',
                color: 'var(--color-base-content)',
            },
        },
        list: {
            base: {
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                listStyle: 'none',
                margin: '0',
                padding: '0',
            },
        },
        item: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
            },
            // `closed` is presence: the runtime hides the part (#295).
            states: { open: {}, closed: {} },
        },
        link: {
            base: {
                color: 'var(--color-surface-variant-content)',
                textDecoration: 'none',
                borderRadius: 'var(--radius-extra-small)',
                transition: 'color var(--duration-short2) var(--ease-standard)',
            },
            states: {
                hover: { color: 'var(--color-base-content)' },
                active: {
                    color: 'var(--bc-accent)',
                    fontWeight: 'var(--weight-medium)',
                },
                inactive: {},
                'focus-visible': {
                    outline: '2px solid var(--color-primary)',
                    outlineOffset: '2px',
                },
            },
        },
        separator: {
            base: {
                color: 'color-mix(in oklch, var(--color-base-content) 45%, transparent)',
                userSelect: 'none',
            },
        },
        ellipsis: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
            },
            // `closed` is presence: the runtime hides the part (#295).
            states: { open: {}, closed: {} },
        },
        'ellipsis-trigger': {
            base: {
                appearance: 'none',
                background: 'transparent',
                border: '0',
                padding: '0 var(--space-xs)',
                margin: '0',
                font: 'inherit',
                lineHeight: 'inherit',
                color: 'var(--color-surface-variant-content)',
                borderRadius: 'var(--radius-extra-small)',
                cursor: 'pointer',
                transition: 'color var(--duration-short2) var(--ease-standard), background-color var(--duration-short2) var(--ease-standard)',
            },
            states: {
                // Material's state layer: an on-surface tint, never an underline.
                hover: {
                    color: 'var(--color-base-content)',
                    background: 'color-mix(in oklch, var(--color-base-content) 8%, transparent)',
                },
                pressed: {
                    background: 'color-mix(in oklch, var(--color-base-content) 12%, transparent)',
                },
                'focus-visible': {
                    outline: '2px solid var(--color-primary)',
                    outlineOffset: '2px',
                },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--bc-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { fontSize: 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { fontSize: 'var(--text-md)' } } },
            xl: { root: { base: { fontSize: 'var(--text-lg)' } } },
        },
    },
};

/**
 * The four pagination triggers — prev/next and, with `withEdges`, the
 * first/last jumps (#294) — are one cell: the same box, the same
 * glyph-sized type, and the same flip under the rtl guard, since every
 * glyph (`‹ › « »`) is physical ink pointing at a reading edge.
 */
const pageTrigger: PartStyles = {
    base: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minInlineSize: 'var(--pg-size)',
        blockSize: 'var(--pg-size)',
        background: 'transparent',
        color: 'var(--color-base-content)',
        border: 'none',
        borderRadius: '9999px',
        fontSize: 'calc(var(--pg-font) * 1.2)',
        lineHeight: 'var(--leading-none)',
        appearance: 'none',
        // Link mode renders an <a> (#294): no UA underline.
        textDecoration: 'none',
        cursor: 'pointer',
        transition: motion('background'),
    },
    states: {
        hover: { background: 'color-mix(in oklch, var(--color-base-content) 8%, transparent)' },
        disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
        ...focusRing,
    },
    selectors: {
        '&[data-pressed]:not([data-disabled])': {
            background: 'color-mix(in oklch, var(--color-base-content) 12%, transparent)',
        },
        [`&${rtl}`]: { scale: '-1 1' },
    },
};

/**
 * Pagination — M3 icon-button circles: transparent cells with the 8%/12%
 * state-layer washes, the current page a filled primary circle. The washes
 * are the simple read of the state layer (the full `pressable` ripple is
 * the button's gesture, not a page cell's). Glyphs flip under the rtl guard.
 */
export const pagination: RecipeInput = {
    component: 'pagination',
    tokens: {
        '--pg-accent': 'var(--color-primary)',
        '--pg-accent-content': 'var(--color-primary-content)',
        '--pg-size': 'calc(var(--size-field) * 10)',
        '--pg-font': 'var(--text-sm)',
        // How far the focus ring reaches outside a control: the root's
        // scroll box pads by it so the ring is never clipped (#44).
        '--pg-ring-room': '5px',
    },
    parts: {
        root: {
            // The row's own scroll box (#44): the window is constant-width by
            // design, so a narrow container scrolls it rather than clipping
            // it — Table's answer. The padding is room for the focus ring's
            // 3px + 2px offset, which the scroll box would otherwise clip at
            // the row's edges; the matching scroll padding keeps it clear
            // when focus scrolls a page into view.
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2xs)',
                overflowX: 'auto',
                padding: 'var(--pg-ring-room)',
                scrollPaddingInline: 'var(--pg-ring-room)',
            },
        },
        item: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minInlineSize: 'var(--pg-size)',
                blockSize: 'var(--pg-size)',
                paddingInline: 'var(--space-2xs)',
                background: 'transparent',
                color: 'var(--color-base-content)',
                border: 'none',
                borderRadius: '9999px',
                fontSize: 'var(--pg-font)',
                fontWeight: 'var(--weight-medium)',
                fontVariantNumeric: 'tabular-nums',
                appearance: 'none',
                textDecoration: 'none',
                cursor: 'pointer',
                transition: motion('background, color'),
            },
            states: {
                hover: { background: 'color-mix(in oklch, var(--color-base-content) 8%, transparent)' },
                active: { background: 'var(--pg-accent)', color: 'var(--pg-accent-content)' },
                inactive: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': {
                    background: 'color-mix(in oklch, var(--color-base-content) 12%, transparent)',
                },
                // The state layer on the ACTIVE page: Material's pressed
                // overlay deepens the container rather than replacing it —
                // the plain wash above left `--pg-accent-content` on a
                // base-tinted surface (1.05:1 in dark), found by the static
                // contrast matrix (#403).
                '&[data-state="active"][data-pressed]:not([data-disabled])': {
                    background: 'color-mix(in oklch, var(--pg-accent) 88%, var(--color-base-content))',
                },
            },
        },
        ellipsis: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minInlineSize: 'var(--pg-size)',
                blockSize: 'var(--pg-size)',
                color: 'var(--color-surface-variant-content)',
                fontSize: 'var(--pg-font)',
                userSelect: 'none',
            },
        },
        'first-trigger': pageTrigger,
        'prev-trigger': pageTrigger,
        'next-trigger': pageTrigger,
        'last-trigger': pageTrigger,
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--pg-accent': `var(--color-${c})`,
            '--pg-accent-content': `var(--color-${c}-content)`,
        } } }])),
        size: {
            xs: { root: { base: { '--pg-size': 'calc(var(--size-field) * 7)', '--pg-font': 'var(--text-xs)' } } },
            sm: { root: { base: { '--pg-size': 'calc(var(--size-field) * 9)' } } },
            md: {},
            lg: { root: { base: { '--pg-size': 'calc(var(--size-field) * 12)' } } },
            xl: { root: { base: { '--pg-size': 'calc(var(--size-field) * 14)', '--pg-font': 'var(--text-lg)' } } },
        },
    },
};

/** A Steps root holding wizard parts (#296) — the panel or the triggers. */
const STEPS_WIZARD = '&:has(> [data-scope="steps"]:is([data-part="content"], [data-part="prev-trigger"], [data-part="next-trigger"]))';

/** Steps' Back/Next (#296): the outlined pill, in the primary ink. */
const stepsTrigger: PartStyles = withPresence(pressable('steps'), {
    base: { ...outlinedTrigger, color: 'var(--color-primary)', flex: '0 0 auto', alignSelf: 'flex-start' },
    states: { disabled: disabledFade, ...focusRing },
});

/**
 * Steps — M3's process rail: tonal discs (surface-container at rest, the
 * primary pair when current, a primary-tinted tonal disc once walked), the
 * connector a hairline that takes the primary once crossed. The washes are
 * the simple read of the state layer, as in pagination.
 */
export const steps: RecipeInput = {
    component: 'steps',
    keyframes: rippleKeyframes('steps'),
    tokens: {
        '--steps-accent': 'var(--color-primary)',
        '--steps-accent-content': 'var(--color-primary-content)',
        '--steps-ind': 'calc(var(--size-selector) * 7)',
        '--steps-font': 'var(--text-sm)',
    },
    parts: {
        root: {
            base: {
                display: 'flex',
                alignItems: 'stretch',
            },
            selectors: {
                '&[data-orientation="vertical"]': { flexDirection: 'column' },
                // A wizard (#296): the rail keeps its own line and the panel
                // and triggers wrap below it. Only then — a bare rail never
                // wraps, so its steps stay one row at any width.
                [STEPS_WIZARD]: { flexWrap: 'wrap', rowGap: 'var(--space-lg)' },
            },
        },
        /**
         * The item is the clickable column (horizontal) or row (vertical);
         * the separator bridges from ITS indicator toward the next item's,
         * absolutely positioned past the button box — which is why it is
         * pointer-events none: the bridge must not grow the hit area.
         */
        item: {
            base: {
                appearance: 'none',
                position: 'relative',
                display: 'flex',
                flex: '1 1 0%',
                background: 'transparent',
                border: 'none',
                padding: 'var(--space-xs)',
                gap: 'var(--space-2xs)',
                fontFamily: 'inherit',
                fontSize: 'var(--steps-font)',
                cursor: 'pointer',
                textAlign: 'center',
            },
            selectors: {
                '&[data-orientation="horizontal"]': { flexDirection: 'column', alignItems: 'center' },
                '&[data-orientation="vertical"]': {
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    textAlign: 'start',
                    columnGap: 'var(--space-sm)',
                    paddingBlockEnd: 'var(--space-lg)',
                },
                '&[data-pressed]:not([data-disabled])': {
                    background: 'color-mix(in oklch, var(--color-base-content) 12%, transparent)',
                },
            },
            states: {
                active: { color: 'var(--steps-accent)', fontWeight: 'var(--weight-semibold)' },
                complete: { color: 'var(--color-base-content)' },
                inactive: { color: 'color-mix(in oklch, var(--color-base-content) 65%, transparent)' },
                // MD3's error step, whatever the phase: after the phases, so
                // it wins at equal weight. Material's roles are inks.
                invalid: { color: 'var(--color-error)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
        },
        indicator: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                inlineSize: 'var(--steps-ind)',
                blockSize: 'var(--steps-ind)',
                borderRadius: '9999px',
                fontSize: 'calc(var(--steps-ind) * 0.45)',
                fontWeight: 'var(--weight-semibold)',
                lineHeight: 'var(--leading-none)',
                position: 'relative',
                zIndex: '1',
                flexShrink: '0',
                transition: motion('background, color'),
            },
            states: {
                active: { background: 'var(--steps-accent)', color: 'var(--steps-accent-content)' },
                complete: { background: 'color-mix(in oklch, var(--steps-accent) 18%, var(--color-base-100))', color: 'var(--steps-accent)' },
                inactive: { background: 'var(--color-surface-container)', color: 'var(--color-surface-container-content)' },
                invalid: { background: 'var(--color-error)', color: 'var(--color-error-content)' },
            },
        },
        /**
         * The bridge: from this item's indicator centre one full item-slot
         * toward the next (equal flex slots make the far end the next
         * indicator's centre). Logical insets only, so RTL mirrors free;
         * behind the indicator's opaque disc (z-index 0 vs 1).
         */
        separator: {
            base: {
                position: 'absolute',
                pointerEvents: 'none',
                zIndex: '0',
            },
            selectors: {
                '&[data-orientation="horizontal"]': {
                    insetBlockStart: 'calc(var(--space-xs) + var(--steps-ind) / 2)',
                    insetInlineStart: '50%',
                    inlineSize: '100%',
                    blockSize: 'var(--border)',
                },
                '&[data-orientation="vertical"]': {
                    insetInlineStart: 'calc(var(--space-xs) + (var(--steps-ind) - var(--border)) / 2)',
                    insetBlockStart: 'calc(var(--space-xs) + var(--steps-ind))',
                    insetBlockEnd: 'calc(var(--space-xs) * -1)',
                    inlineSize: 'var(--border)',
                },
            },
            states: {
                complete: { background: 'var(--steps-accent)' },
                inactive: { background: 'var(--color-base-300)' },
                invalid: { background: 'var(--color-error)' },
            },
        },
        title: {
            base: {
                fontWeight: 'var(--weight-medium)',
            },
        },
        description: {
            base: {
                fontSize: 'var(--text-xs)',
                color: 'var(--color-surface-variant-content)',
                fontWeight: 'var(--weight-normal)',
            },
        },
        /**
         * The active step's panel: a full-width line under the rail (the
         * wizard wrap above), MD3 body text. Inactive panels are `hidden`,
         * so they need no rule.
         */
        content: {
            base: {
                flex: '1 0 100%',
                fontSize: 'var(--text-md)',
                color: 'var(--color-base-content)',
            },
            states: { active: {}, inactive: {} },
        },
        // Back/Next wear the outlined pill every overlay opens from, with
        // its state layer and ripple; Next takes the far end of their line.
        'prev-trigger': stepsTrigger,
        'next-trigger': withPresence(stepsTrigger, { base: { marginInlineStart: 'auto' } }),
    },
    variants: {
        // Keyed on the ITEM, not the root (#112): the item re-carries
        // `color`, so a step's own value outranks the rail's, and the
        // disc, bridge and title inside it inherit whichever won. A root
        // colour still reaches every item through the carrier's donut.
        color: Object.fromEntries(ROLES.map((c) => [c, { item: { base: {
            '--steps-accent': `var(--color-${c})`,
            '--steps-accent-content': `var(--color-${c}-content)`,
        } } }])),
        size: {
            xs: { root: { base: { '--steps-ind': 'calc(var(--size-selector) * 5)', '--steps-font': 'var(--text-xs)' } } },
            sm: { root: { base: { '--steps-ind': 'calc(var(--size-selector) * 6)' } } },
            md: {},
            lg: { root: { base: { '--steps-ind': 'calc(var(--size-selector) * 8)' } } },
            xl: { root: { base: { '--steps-ind': 'calc(var(--size-selector) * 9)', '--steps-font': 'var(--text-md)' } } },
        },
    },
};

/**
 * The modal sheet's slide (#83): in from its edge, back out to it.
 *
 * `translate` is physical, so the travel is a custom property — the whole
 * `x y` pair — that flips with the placement AND the direction: off the
 * reading start is leftward in LTR and rightward in RTL (the `rtl` hedge, as
 * everywhere here), while a `top` / `bottom` sheet travels on Y and mirrors
 * in neither (#291). Keyed on
 * `data-l-dock="sheet"`, the regime, which holds through the exit where
 * `:modal` does not, so the slide-out leaves from the sheet's own box.
 * Opacity stays at 1: the travel is the transition. Each direction rides the
 * transition declared at its destination; reduced motion drops both.
 */
const sheetSlide = (enter: string, exit: string): PartStyles => {
    const sheet = '&[data-l-dock="sheet"]';
    const open = `${sheet}[data-state="open"]`;
    const travel = (tempo: string): string => {
        const duration = tempo.split(' ')[0];
        // `transform` rides along for the swipe's spring back (#293).
        return `translate ${tempo}, transform ${tempo}, display ${duration} allow-discrete, overlay ${duration} allow-discrete`;
    };
    return {
        base: { '--drawer-travel': '-100% 0' },
        selectors: {
            '&[data-placement="end"]': { '--drawer-travel': '100% 0' },
            [`&[data-placement="start"]${rtl}`]: { '--drawer-travel': '100% 0' },
            [`&[data-placement="end"]${rtl}`]: { '--drawer-travel': '-100% 0' },
            // The block edges travel on Y, and no direction mirrors them (#291).
            '&[data-placement="top"]': { '--drawer-travel': '0 -100%' },
            '&[data-placement="bottom"]': { '--drawer-travel': '0 100%' },
            [sheet]: { opacity: '1', translate: 'var(--drawer-travel)', transition: travel(exit) },
            [open]: { translate: 'none', transition: travel(enter) },
        },
        at: {
            'starting-style': { selectors: { [open]: { opacity: '1', translate: 'var(--drawer-travel)' } } },
            'reduced-motion': { selectors: { [sheet]: { transition: 'none' }, [open]: { transition: 'none' } } },
        },
    };
};

/**
 * Drawer — M3's navigation drawer: the surface-container sheet with the
 * modal drawer's rounded trailing corners. The modal drawer slides in from
 * its edge on the emphasized-decelerate curve and leaves on
 * emphasized-accelerate, M3's enter/exit pair (#83). Base render is the
 * inline (standard) drawer; `data-l-dock="sheet"` is the modal drawer on the
 * top layer.
 */
export const drawer: RecipeInput = {
    component: 'drawer',
    tokens: overlayTriggerTokens,
    parts: {
        trigger: withPresence(pressable('drawer', overlayInk), {
            base: outlinedTrigger,
            states: { open: {}, closed: {}, disabled: disabledFade, ...focusRing },
        }),
        panel: withPresence(withPresence(popupPresence('none'), sheetSlide(
            'var(--duration-medium2) var(--ease-emphasized-decelerate)',
            'var(--duration-medium2) var(--ease-emphasized-accelerate)',
        )), {
            // M3's sheets (#418): surface-container-low, the large corner on
            // a side sheet's inner edge, the extra-large on a bottom sheet's
            // top, level 1 once modal.
            base: {
                padding: 'var(--space-lg)',
                background: 'var(--color-surface-container-low)',
                color: 'var(--color-surface-container-low-content)',
                border: 'none',
                borderRadius: 'var(--radius-large)',
                '--tf-surface': 'var(--color-surface-container-low)',
                // The width is capped by `--l-measure` (Drawer.Panel's
                // `measure`, via the layout step table); this is the default
                // an unset `measure` leaves. A cap, not a width, because the
                // table spells `full` as `none` — valid only for a max. In
                // flow and as a sheet alike, the panel fills what it is given
                // up to the measure, as its border box, so `full` never
                // overflows by its own padding.
                boxSizing: 'border-box',
                '--l-measure': 'min(22.5rem, 85vw)',
                inlineSize: '100%',
                maxInlineSize: 'var(--l-measure)',
            },
            states: { open: {}, closed: {} },
            selectors: {
                /**
                 * The top-layer edge sheet, keyed on the regime
                 * (`data-l-dock="sheet"`) rather than `:modal`, which stops
                 * matching the moment `close()` runs — so the sheet keeps its
                 * box through the exit (#83). The base styles above are the
                 * INLINE render. Logical insets pin the edge, so RTL mirrors
                 * free.
                 */
                /**
                 * Swipe to dismiss (#293): the sheet wears the drag offset
                 * (`SWIPE`) in every state — so a swiped sheet leaves from
                 * where it was let go — at a weight above the presence's own
                 * open `transform`. Mid-swipe no transition runs. A touch pan
                 * across the dismiss axis stays the page's; along it is the
                 * gesture's, so content taller than a block-edge sheet
                 * scrolls in a box of its own inside the panel.
                 */
                '&[data-l-dock="sheet"][data-state]': { transform: SWIPE },
                '&[data-l-dock="sheet"][data-state="open"][data-swiping]': { transition: 'none', userSelect: 'none' },
                '&[data-l-dock="sheet"]:where([data-placement="start"], [data-placement="end"])': { touchAction: 'pan-y' },
                '&[data-l-dock="sheet"]:where([data-placement="top"], [data-placement="bottom"])': { touchAction: 'pan-x' },
                '&[data-l-dock="sheet"]': {
                    position: 'fixed',
                    insetBlockStart: '0',
                    insetBlockEnd: '0',
                    blockSize: '100dvh',
                    maxBlockSize: '100dvh',
                    margin: '0',
                    borderRadius: '0',
                    boxShadow: 'var(--shadow-level1)',
                },
                '&[data-placement="start"][data-l-dock="sheet"]': {
                    insetInlineStart: '0',
                    insetInlineEnd: 'auto',
                    borderStartEndRadius: 'var(--radius-large)',
                    borderEndEndRadius: 'var(--radius-large)',
                },
                '&[data-placement="end"][data-l-dock="sheet"]': {
                    insetInlineStart: 'auto',
                    insetInlineEnd: '0',
                    borderStartStartRadius: 'var(--radius-large)',
                    borderEndStartRadius: 'var(--radius-large)',
                },
                /**
                 * The block edges (#291): a sheet across the viewport's width,
                 * pinned with `inset-block-*` — nothing here mirrors in RTL. Its
                 * height is this recipe's: content-sized up to most of the
                 * viewport, so the scrim stays in reach. Full width by default —
                 * `measure` still caps the INLINE size (centred by the auto
                 * margins), which the `:where()` keeps below the layout step
                 * table's specificity whatever order the files load in.
                 */
                '&:where([data-placement="top"], [data-placement="bottom"])': { '--l-measure': 'none' },
                '&[data-placement="top"][data-l-dock="sheet"]': {
                    insetBlockStart: '0',
                    insetBlockEnd: 'auto',
                    insetInlineStart: '0',
                    insetInlineEnd: '0',
                    marginInline: 'auto',
                    blockSize: 'auto',
                    maxBlockSize: '85dvh',
                    borderEndStartRadius: 'var(--radius-extra-large)',
                    borderEndEndRadius: 'var(--radius-extra-large)',
                },
                '&[data-placement="bottom"][data-l-dock="sheet"]': {
                    insetBlockStart: 'auto',
                    insetBlockEnd: '0',
                    insetInlineStart: '0',
                    insetInlineEnd: '0',
                    marginInline: 'auto',
                    blockSize: 'auto',
                    maxBlockSize: '85dvh',
                    borderStartStartRadius: 'var(--radius-extra-large)',
                    borderStartEndRadius: 'var(--radius-extra-large)',
                },
                // M3's bottom-sheet drag handle: 32 x 4dp in on-surface-variant
                // at 40%, centred 22dp below the top edge.
                '&[data-placement="bottom"][data-l-dock="sheet"]::before': {
                    content: '""',
                    display: 'block',
                    inlineSize: dp(32),
                    blockSize: dp(4),
                    marginInline: 'auto',
                    marginBlockStart: 'calc(var(--space-md) - var(--space-lg) + var(--space-2xs))',
                    marginBlockEnd: 'var(--space-md)',
                    borderRadius: dp(2),
                    background: 'color-mix(in oklch, var(--color-surface-variant-content) 40%, transparent)',
                },
            },
        }),
        backdrop: {
            base: { background: 'color-mix(in oklch, var(--color-scrim) 32%, transparent)' },
            states: { open: {}, closed: {} },
        },
        // A sheet's headline: title-large in on-surface-variant.
        title: {
            base: {
                margin: '0 0 var(--space-md)',
                ...type('title-large'),
                color: 'var(--color-surface-variant-content)',
            },
        },
        close: withPresence(pressable('drawer'), {
            base: textAction,
            states: { disabled: disabledFade, ...focusRing },
        }),
    },
    keyframes: rippleKeyframes('drawer'),
    // Trigger-carried axes — see `overlayTriggerColors`.
    variants: { color: overlayTriggerColors(), size: overlayTriggerSizes },
};

/**
 * Table — an MD3 data table: outline hairlines on a container surface,
 * medium tracked headers, state-layer washes. Selected rows carry the
 * accent at the 12% layer, hover at 8%, zebra at 4% — the three MD3
 * emphasis steps; the mods stand aside for a selected row.
 */
export const table: RecipeInput = {
    component: 'table',
    // A sortable header cell carries the sort state for `aria-sort`'s sake;
    // its trigger and indicator paint it.
    skipStates: { 'header-cell': ['ascending', 'descending', 'none'] },
    // Public to a design system derived from this one (#73).
    hooks: {
        properties: {
            '--table-cell-align': 'Cell text alignment; zero writes it inline from the column spec.',
            '--table-accent': 'The accent colour.',
            '--table-pad-block': 'Cell block padding.',
            '--table-pad-inline': 'Cell inline padding.',
            '--table-font': 'The table font size.',
        },
    },
    tokens: {
        // The column spec's alignment (#55): a cell that names an aligned
        // column overrides it inline; everything else reads `start`.
        '--table-cell-align': 'start',
        '--table-accent': 'var(--color-primary)',
        '--table-pad-block': 'var(--space-sm)',
        '--table-pad-inline': 'var(--space-md)',
        '--table-font': 'var(--text-sm)',
    },
    parts: {
        root: {
            base: {
                overflowX: 'auto',
                border: 'var(--border) solid var(--color-outline)',
                borderRadius: 'var(--radius-extra-large)',
                background: 'var(--color-surface-container)',
                color: 'var(--color-surface-container-content)',
            },
            // The scroll box is a keyboard stop (#270): the secondary-role ring,
            // drawn inside the box (negative offset) — the root is as wide
            // as its column, so an outward ring would be clipped by
            // whatever scrolls around it.
            states: { 'focus-visible': { outline: '3px solid var(--color-secondary)', outlineOffset: '-3px' } },
        // Stacked (Table.Root stack, #55): zero lays each row out as a block
        // below the table's breakpoint; the card it becomes is drawn here.
            // Each card takes the container's surface; the box around them goes.
            at: tableStackAt(tokens, 'root', { border: '0', borderRadius: '0', background: 'transparent' }),
        },
        table: {
            base: {
                borderCollapse: 'collapse',
                inlineSize: '100%',
                fontSize: 'var(--table-font)',
            },
        },
        caption: {
            base: {
                captionSide: 'top',
                textAlign: 'start',
                padding: 'var(--table-pad-block) var(--table-pad-inline)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'var(--color-surface-variant-content)',
            },
            at: tableStackAt(tokens, 'caption', { paddingInline: '0' }),
        },
        head: {},
        body: { at: tableStackAt(tokens, 'body', { rowGap: 'var(--space-md)' }) },
        foot: {
            base: {
                fontSize: 'var(--text-xs)',
                color: 'var(--color-surface-variant-content)',
            },
            at: tableStackAt(tokens, 'foot', { rowGap: 'var(--space-md)', marginBlockStart: 'var(--space-md)' }),
        },
        row: {
            base: { borderBlockEnd: 'var(--border) solid var(--color-outline)' },
            states: {
                selected: { background: 'color-mix(in oklch, var(--table-accent) 12%, transparent)' },
            },
            at: tableStackAt(tokens, 'row', {
                border: 'var(--border) solid var(--color-outline)',
                borderRadius: 'var(--radius-extra-large)',
                background: 'var(--color-surface-container)',
                padding: 'var(--table-pad-block) var(--table-pad-inline)',
            }),
        },
        'header-cell': {
            base: {
                padding: 'var(--table-pad-block) var(--table-pad-inline)',
                textAlign: 'var(--table-cell-align)',
                fontWeight: 'var(--weight-medium)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'var(--color-surface-variant-content)',
            },
            at: tableStackAt(tokens, 'header-cell', { paddingInline: '0' }),
        },
        // Sorting (#286): M3's data-table header — the sorted column's label
        // goes to on-surface, the trigger wears the state layer on hover and
        // press, and the arrow turns with the direction.
        'sort-trigger': {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                margin: '0',
                border: '0',
                font: 'inherit',
                letterSpacing: 'inherit',
                textTransform: 'inherit',
                textAlign: 'inherit',
                cursor: 'pointer',
                gap: 'var(--space-2xs)',
                padding: '0',
                borderRadius: 'var(--radius-medium)',
                background: 'transparent',
                color: 'inherit',
                transition: motion('color, background-color'),
            },
            states: {
                ascending: { color: 'var(--color-base-content)' },
                descending: { color: 'var(--color-base-content)' },
                none: {},
                hover: { color: 'var(--color-base-content)', background: stateLayer },
                disabled: { cursor: 'not-allowed', opacity: 'var(--disabled-opacity)' },
                ...focusRing,
            },
            selectors: { '&[data-pressed]:not([data-disabled])': { background: 'color-mix(in oklch, var(--color-base-content) 12%, transparent)' } },
            at: { 'reduced-motion': { base: { transition: 'none' } } },
        },
        // The arrow: zero's ▲ turned for descending. Unsorted, M3 shows it
        // only on hover (and here on keyboard focus too).
        'sort-indicator': {
            base: {
                display: 'inline-block',
                fontSize: '0.75em',
                lineHeight: '1',
                transition: motion('transform, opacity'),
            },
            states: {
                ascending: {},
                descending: { transform: 'rotate(180deg)' },
                none: { opacity: '0' },
            },
            selectors: { '[data-scope="table"][data-part="sort-trigger"]:is(:hover, [data-focus-visible]) > &[data-state="none"]': { opacity: '0.6' } },
            at: { 'reduced-motion': { base: { transition: 'none' } } },
        },
        cell: {
            base: {
                padding: 'var(--table-pad-block) var(--table-pad-inline)',
                textAlign: 'var(--table-cell-align)',
                fontVariantNumeric: 'tabular-nums',
            },
            at: tableStackAt(tokens, 'cell', { paddingInline: '0', paddingBlock: 'var(--space-xs)' }),
        },
        // A stacked cell's column label, in the header's label-small voice.
        'cell-label': {
            base: {
                fontWeight: 'var(--weight-medium)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'var(--color-surface-variant-content)',
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--table-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--table-pad-block': 'calc(var(--space-xs) / 2)', '--table-pad-inline': 'var(--space-xs)', '--table-font': 'var(--text-xs)' } } },
            sm: { root: { base: { '--table-pad-block': 'var(--space-xs)', '--table-pad-inline': 'var(--space-sm)', '--table-font': 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { '--table-pad-block': 'var(--space-md)', '--table-pad-inline': 'var(--space-lg)', '--table-font': 'var(--text-md)' } } },
            xl: { root: { base: { '--table-pad-block': 'var(--space-lg)', '--table-pad-inline': 'var(--space-xl)', '--table-font': 'var(--text-md)' } } },
        },
    },
    modifiers: {
        zebra: {
            row: {
                selectors: {
                    '[data-scope="table"][data-part="body"] > &:nth-child(even):not([data-selected])': {
                        background: 'color-mix(in oklch, var(--color-base-content) 4%, transparent)',
                    },
                },
            },
        },
        hover: {
            row: {
                selectors: {
                    '[data-scope="table"][data-part="body"] > &:hover:not([data-selected])': {
                        background: 'color-mix(in oklch, var(--color-base-content) 8%, transparent)',
                    },
                },
            },
        },
    },
};

/**
 * FileUpload — MD3: an outlined-button trigger with the 8%/12% state
 * layers, an outline-dashed dropzone that washes with the accent while a
 * drag hovers, and list rows on the container surface.
 */
export const fileUpload: RecipeInput = {
    component: 'file-upload',
    tokens: {
        '--fu-accent': 'var(--color-primary)',
        '--fu-pad': 'var(--space-lg)',
        '--fu-font': 'var(--text-sm)',
    },
    parts: {
        root: {
            base: { display: 'grid', gap: 'var(--space-sm)', justifyItems: 'start' },
        },
        label: {
            base: {
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                letterSpacing: 'var(--tracking-wide)',
            },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
        },
        trigger: {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-xs)',
                padding: 'var(--space-sm) var(--space-xl)',
                fontSize: 'var(--fu-font)',
                fontWeight: 'var(--weight-medium)',
                letterSpacing: 'var(--tracking-wide)',
                lineHeight: 'var(--leading-none)',
                color: 'var(--fu-accent)',
                background: 'transparent',
                border: 'var(--border) solid var(--color-outline)',
                borderRadius: 'var(--radius-medium)',
                cursor: 'pointer',
                transition: 'background var(--duration-short2) var(--ease-standard)',
            },
            states: {
                hover: { background: 'color-mix(in oklch, var(--fu-accent) 8%, transparent)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                invalid: { borderColor: 'var(--color-error)', color: 'var(--color-error)' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': {
                    background: 'color-mix(in oklch, var(--fu-accent) 12%, transparent)',
                },
            },
        },
        dropzone: {
            base: {
                justifySelf: 'stretch',
                padding: 'var(--fu-pad)',
                textAlign: 'center',
                fontSize: 'var(--fu-font)',
                color: 'var(--color-surface-variant-content)',
                border: 'var(--border) dashed var(--color-outline)',
                borderRadius: 'var(--radius-extra-large)',
                background: 'var(--color-surface-container)',
                cursor: 'pointer',
                transition: 'background var(--duration-short2) var(--ease-standard), '
                    + 'border-color var(--duration-short2) var(--ease-standard)',
            },
            states: {
                highlighted: {
                    borderColor: 'var(--fu-accent)',
                    background: 'color-mix(in oklch, var(--fu-accent) 8%, var(--color-surface-container))',
                    color: 'var(--color-base-content)',
                },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
        },
        'item-group': {
            base: {
                justifySelf: 'stretch',
                listStyle: 'none',
                margin: '0',
                padding: '0',
                display: 'grid',
                gap: 'var(--space-xs)',
            },
        },
        item: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: 'var(--space-xs) var(--space-md)',
                borderRadius: 'var(--radius-medium)',
                background: 'var(--color-surface-container)',
                color: 'var(--color-surface-container-content)',
            },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                // A rejected file the app renders through Item: an error
                // outline (the text field's error idiom) over a faint error
                // tint of the container.
                invalid: {
                    boxShadow: 'inset 0 0 0 1px var(--color-error)',
                    background: 'color-mix(in oklch, var(--color-error) 8%, var(--color-surface-container))',
                },
            },
        },
        'item-name': {
            base: {
                flex: '1 1 auto',
                minWidth: '0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 'var(--fu-font)',
            },
        },
        'item-size': {
            base: {
                fontSize: 'var(--text-xs)',
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--color-surface-variant-content)',
            },
        },
        'item-remove': {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                borderRadius: '9999px',
                padding: 'var(--space-2xs) var(--space-xs)',
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
                transition: 'background var(--duration-short2) var(--ease-standard)',
            },
            states: {
                hover: { background: 'color-mix(in oklch, var(--color-base-content) 8%, transparent)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
        },
        // A text button (M3 "text" variant): the remove button's state
        // layer, primary ink, at label size.
        'clear-trigger': {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'var(--color-primary)',
                borderRadius: '9999px',
                padding: 'var(--space-2xs) var(--space-sm)',
                fontSize: 'var(--fu-font)',
                fontWeight: 'var(--weight-medium)',
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
                transition: 'background var(--duration-short2) var(--ease-standard)',
            },
            states: {
                hover: { background: 'color-mix(in oklch, var(--color-primary) 8%, transparent)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--fu-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--fu-pad': 'var(--space-sm)', '--fu-font': 'var(--text-xs)' } } },
            sm: { root: { base: { '--fu-pad': 'var(--space-md)', '--fu-font': 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { '--fu-pad': 'var(--space-xl)', '--fu-font': 'var(--text-md)' } } },
            xl: { root: { base: { '--fu-pad': 'calc(var(--space-xl) * 1.25)', '--fu-font': 'var(--text-md)' } } },
        },
    },
};

/**
 * Carousel — MD3: the viewport rides the shaped `extra-large` corner, nav
 * triggers are tonal circles with the state layers, and the dots follow
 * the hero-carousel spec's shape play: a muted ring resting, the accent
 * pill when active (the dot stretches — shape signals state, not colour
 * alone).
 */
export const carousel: RecipeInput = {
    component: 'carousel',
    tokens: {
        '--carousel-accent': 'var(--color-primary)',
        '--carousel-dot': '0.625rem',
        '--carousel-nav': '2.25rem',
    },
    parts: {
        root: {
            base: { position: 'relative', display: 'grid', gap: 'var(--space-sm)' },
        },
        viewport: {
            base: {
                display: 'flex',
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                overscrollBehaviorX: 'contain',
                borderRadius: 'var(--radius-extra-large)',
            },
            selectors: {
                // The viewport is a tab stop (scrollable-region-focusable) and
                // owes the keyboard user a ring. Real :focus-visible — no
                // runtime flag exists on this part.
                '&:focus-visible': { outline: '3px solid var(--color-secondary)', outlineOffset: '2px' },
            },
        },
        item: {
            base: {
                flex: '0 0 100%',
                minWidth: '0',
                scrollSnapAlign: 'center',
            },
            states: { active: {}, inactive: {} },
        },
        'prev-trigger': {
            base: {
                appearance: 'none',
                position: 'absolute',
                insetBlockStart: 'calc(50% - var(--carousel-nav) / 2)',
                insetInlineStart: 'var(--space-sm)',
                inlineSize: 'var(--carousel-nav)',
                blockSize: 'var(--carousel-nav)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 'var(--text-sm)',
                lineHeight: 'var(--leading-none)',
                color: 'var(--color-surface-container-content)',
                background: 'var(--color-surface-container)',
                border: 'none',
                borderRadius: '9999px',
                boxShadow: 'var(--shadow-level1)',
                cursor: 'pointer',
                transition: 'background var(--duration-short2) var(--ease-standard)',
                zIndex: '1',
            },
            states: {
                hover: { background: 'color-mix(in oklch, var(--color-base-content) 8%, var(--color-surface-container))' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': {
                    background: 'color-mix(in oklch, var(--color-base-content) 12%, var(--color-surface-container))',
                },
            },
        },
        'next-trigger': {
            base: {
                appearance: 'none',
                position: 'absolute',
                insetBlockStart: 'calc(50% - var(--carousel-nav) / 2)',
                insetInlineEnd: 'var(--space-sm)',
                inlineSize: 'var(--carousel-nav)',
                blockSize: 'var(--carousel-nav)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 'var(--text-sm)',
                lineHeight: 'var(--leading-none)',
                color: 'var(--color-surface-container-content)',
                background: 'var(--color-surface-container)',
                border: 'none',
                borderRadius: '9999px',
                boxShadow: 'var(--shadow-level1)',
                cursor: 'pointer',
                transition: 'background var(--duration-short2) var(--ease-standard)',
                zIndex: '1',
            },
            states: {
                hover: { background: 'color-mix(in oklch, var(--color-base-content) 8%, var(--color-surface-container))' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': {
                    background: 'color-mix(in oklch, var(--color-base-content) 12%, var(--color-surface-container))',
                },
            },
        },
        'indicator-group': {
            base: { display: 'flex', gap: 'var(--space-xs)', justifyContent: 'center', alignItems: 'center' },
        },
        indicator: {
            base: {
                appearance: 'none',
                // The BUTTON keeps a >=24px hit area (WCAG 2.5.8 target
                // size — the axe gate's floor); the visible dot is the
                // ::before, sized by the ramp.
                inlineSize: 'max(var(--carousel-dot), 1.5rem)',
                blockSize: 'max(var(--carousel-dot), 1.5rem)',
                padding: '0',
                display: 'grid',
                placeItems: 'center',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
            },
            states: {
                active: {},
                inactive: {},
                ...focusRing,
            },
            selectors: {
                '&::before': {
                    content: '""',
                    inlineSize: 'var(--carousel-dot)',
                    blockSize: 'var(--carousel-dot)',
                    boxSizing: 'border-box',
                    border: 'calc(var(--border) * 2) solid var(--color-surface-variant-content)',
                    borderRadius: '9999px',
                    background: 'transparent',
                    transition: 'inline-size var(--duration-short2) var(--ease-emphasized), background var(--duration-short2) var(--ease-standard)',
                },
                '&[data-state="active"]::before': {
                    background: 'var(--carousel-accent)',
                    borderColor: 'var(--carousel-accent)',
                    inlineSize: 'calc(var(--carousel-dot) * 2.2)',
                },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--carousel-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--carousel-dot': '0.375rem', '--carousel-nav': '1.75rem' } } },
            sm: { root: { base: { '--carousel-dot': '0.5rem', '--carousel-nav': '2rem' } } },
            md: {},
            lg: { root: { base: { '--carousel-dot': '0.75rem', '--carousel-nav': '2.75rem' } } },
            xl: { root: { base: { '--carousel-dot': '0.875rem', '--carousel-nav': '3.25rem' } } },
        },
    },
};

/**
 * Swap — MD3: the arriving face scales up from 80% under the emphasized
 * easing while the leaving one fades — a contained state-layer gesture,
 * not a spin. Reduced motion cuts.
 */
export const swap: RecipeInput = {
    component: 'swap',
    tokens: {
        '--swap-ink': 'var(--color-base-content)',
        '--swap-size': 'var(--text-xl)',
    },
    parts: {
        root: {
            base: {
                position: 'relative',
                display: 'inline-grid',
                placeItems: 'center',
                fontSize: 'var(--swap-size)',
                lineHeight: 'var(--leading-none)',
                color: 'var(--swap-ink)',
                userSelect: 'none',
            },
            states: {
                on: {},
                off: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                // Only the interactive form renders a <button>; the display
                // form is a span and must not grow button chrome.
                '&:is(button)': {
                    appearance: 'none',
                    border: 'none',
                    background: 'transparent',
                    padding: 'var(--space-2xs)',
                    borderRadius: 'var(--radius-extra-small)',
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: 'var(--swap-size)',
                    color: 'var(--swap-ink)',
                },
            },
        },
        on: {
            base: {
                gridArea: '1 / 1',
                transition: 'transform var(--duration-medium2) var(--ease-emphasized), opacity var(--duration-medium2) var(--ease-standard)',
            },
            states: {
                on: {},
                off: { opacity: '0', transform: 'scale(0.8)' },
            },
            at: {
                'reduced-motion': { base: { transition: 'none' } },
            },
        },
        off: {
            base: {
                gridArea: '1 / 1',
                transition: 'transform var(--duration-medium2) var(--ease-emphasized), opacity var(--duration-medium2) var(--ease-standard)',
            },
            states: {
                off: {},
                on: { opacity: '0', transform: 'scale(0.8)' },
            },
            at: {
                'reduced-motion': { base: { transition: 'none' } },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--swap-ink': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--swap-size': 'var(--text-sm)' } } },
            sm: { root: { base: { '--swap-size': 'var(--text-md)' } } },
            md: {},
            lg: { root: { base: { '--swap-size': 'var(--text-2xl)' } } },
            xl: { root: { base: { '--swap-size': 'var(--text-3xl)' } } },
        },
    },
};

/**
 * Countdown — display-only digits. The runtime replaces the `digits`
 * element per tick (keyed), so the enter animation below plays once per
 * change — an emphasized rise; a loop never exists, and reduced motion
 * collapses the entry to a cut. The app owns time.
 */
export const countdown: RecipeInput = {
    component: 'countdown',
    tokens: {
        '--countdown-ink': 'var(--color-base-content)',
        '--countdown-font': 'var(--text-2xl)',
    },
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: '0.1em',
                fontSize: 'var(--countdown-font)',
                fontWeight: 'var(--weight-semibold)',
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--countdown-ink)',
            },
        },
        value: {
            base: {
                display: 'inline-block',
                overflow: 'hidden',
            },
        },
        digits: {
            base: {
                display: 'inline-block',
                animation: 'zero-material-countdown-in 0.3s var(--ease-emphasized)',
            },
            at: {
                'reduced-motion': { base: { animation: 'none' } },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--countdown-ink': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--countdown-font': 'var(--text-md)' } } },
            sm: { root: { base: { '--countdown-font': 'var(--text-xl)' } } },
            md: {},
            lg: { root: { base: { '--countdown-font': 'var(--text-3xl)' } } },
            xl: { root: { base: { '--countdown-font': 'var(--text-3xl)' } } },
        },
    },
    // One line inside a sentence (#57): the surrounding text's size and
    // weight instead of the display step. What stays is what makes
    // it a countdown — tabular digits, its ink, the per-tick entry.
    modifiers: {
        inline: { root: { base: { fontSize: 'inherit', fontWeight: 'inherit' } } },
    },
    keyframes: { 'zero-material-countdown-in': 'from { transform: translateY(0.5em); opacity: 0; }' },
};

/**
 * Diff — MD3: the divider is the primary ink, the grip a filled primary
 * circle on the level1 shadow; pressed deepens toward on-surface.
 */
export const diff: RecipeInput = {
    component: 'diff',
    tokens: {
        '--diff-accent': 'var(--color-primary)',
        '--diff-grip': '1.5rem',
        '--diff-hit': '2rem',
    },
    parts: {
        root: {
            base: {
                display: 'grid',
                overflow: 'hidden',
                background: 'var(--color-base-100)',
                borderRadius: 'var(--radius-extra-large)',
            },
            // The root holds the images, which are content: disabled is the
            // handle's to show (#272).
            states: { disabled: {} },
        },
        before: {
            base: { gridArea: '1 / 1', minWidth: '0' },
        },
        after: {
            base: {
                gridArea: '1 / 1',
                position: 'absolute',
                insetBlock: '0',
                insetInlineStart: '0',
                // The reveal: a LOGICAL clip. inline-size mirrors under RTL
                // where a physical clip-path inset would not.
                inlineSize: 'var(--diff-percent)',
                overflow: 'hidden',
            },
        },
        handle: {
            base: {
                insetBlock: '0',
                inlineSize: 'var(--diff-hit)',
                // Center the hit box on the position — the slider-thumb
                // move: a logical negative margin, never a transform.
                marginInlineStart: 'calc(var(--diff-hit) / -2)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'ew-resize',
                touchAction: 'none',
                zIndex: '1',
            },
            states: {
                ...focusRing,
                // MD3 disabled (#272): the handle drops to on-surface ink at the
                // disabled opacity; the images are content and stay unfaded.
                disabled: { '--diff-accent': 'var(--color-base-content)', opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                pressed: { '--diff-accent': 'color-mix(in oklch, var(--color-primary) 85%, var(--color-base-content))' },
            },
            selectors: {
                // The divider line, full height, centered in the hit box.
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    insetBlock: '0',
                    insetInlineStart: 'calc(50% - var(--border))',
                    inlineSize: 'calc(var(--border) * 2)',
                    background: 'var(--diff-accent)',
                },
                // The grip — the paint the indicator matrix grades.
                '&::after': {
                    content: '""',
                    inlineSize: 'var(--diff-grip)',
                    blockSize: 'var(--diff-grip)',
                    boxSizing: 'border-box',
                    background: 'var(--diff-accent)',
                    border: 'calc(var(--border) * 2) solid var(--diff-accent)',
                    borderRadius: '9999px',
                    zIndex: '1',
                },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--diff-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--diff-grip': '1rem', '--diff-hit': '1.5rem' } } },
            sm: { root: { base: { '--diff-grip': '1.25rem', '--diff-hit': '1.75rem' } } },
            md: {},
            lg: { root: { base: { '--diff-grip': '2rem', '--diff-hit': '2.5rem' } } },
            xl: { root: { base: { '--diff-grip': '2.25rem', '--diff-hit': '2.75rem' } } },
        },
    },
};

export const recipes: RecipeInput[] = [
    button, tabs, collapsible, accordion, dialog, popover, tooltip, hoverCard, menu, menubar, select,
    switchRecipe, checkbox, checkboxGroup, radioGroup, field, fieldset, slider, progress, avatar, avatarGroup, toast, combobox,
    toggle, toggleGroup, chip, chipGroup, numberInput, ratingGroup, treeView, input, textarea,
    card, alert, emptyState, badge, divider, skeleton, spinner,
    kbd, status, indicator, stats, timeline, chat, chatLog, radialProgress, join,
    navbar, navList, breadcrumbs, pagination, steps, drawer,
    table,
    fileUpload,
    carousel,
    swap,
    countdown,
    diff,
];
