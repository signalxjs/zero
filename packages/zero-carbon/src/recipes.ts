/**
 * zero-carbon recipes — Carbon's language over zero's anatomy (issue #183).
 *
 * Full coverage: every component in the manifest. The api surface this
 * package exists to exercise — the fused `kind` axis, the values remap, the
 * renamed boolean modifiers — stays Button-only, per the repo's deferral:
 * Button is the component that motivated the whole vendor-named-API design.
 *
 * No `variants.color` anywhere — there are no roles to key it on, the same
 * shape `zero-heroui` proved. Colour reaches the CSS through declared custom
 * tokens; the seven `kind` members each rebind the fill/ink/line channel.
 */
import type { CssProps, PartStyles, RecipeInput } from '@sigx/zero-kit';

const motion = (props: string): string =>
    props.split(', ').map((p) => `${p} var(--duration-normal) var(--ease-standard)`).join(', ');

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

/** Carbon's focus treatment: a 2px outline hugging the edge, inset. */
const focusRing: Record<string, CssProps> = {
    'focus-visible': {
        outline: '2px solid var(--carbon-focus)',
        outlineOffset: '-2px',
    },
};

/**
 * Layer-aware hover/pressed washes: an ink-mix over whatever layer the part
 * sits on, so the same value reads correctly on base-100 pages and base-200
 * floating surfaces — and moves the right way in both schemes (darker on
 * white, lighter on g100), which a brightness filter cannot do.
 */
const layerHover = 'color-mix(in oklab, var(--color-base-content) 8%, transparent)';
const layerActive = 'color-mix(in oklab, var(--color-base-content) 15%, transparent)';

/**
 * Pressed ink for interactive-blue text on a pressed layer fill: the blue
 * mixed 20% toward base-content. Scheme-aware — it darkens on white and
 * lightens on g100 — keeping the label above 3:1 on the pressed layer in
 * both, where the resting blue alone drops to 2.95:1 on g100's base-300.
 * The same rebind Button's `ghost` kind uses for `--btn-ink-active`.
 */
const pressedInteractiveInk = 'color-mix(in oklab, var(--carbon-interactive) 80%, var(--color-base-content))';

/**
 * Enter/exit presence for a top-layer popup — dialog, popover, tooltip, menu.
 *
 * The platform mechanism every design system in this repo uses: transition
 * `display`/`overlay` with `allow-discrete` so the browser keeps the element
 * (and its top-layer slot) around for the exit, and `@starting-style`
 * supplies the state the entry animates FROM. Carbon's productive motion —
 * fast-02 with the standard curve, no theatrics.
 */
const popupPresence = (from: string): PartStyles => ({
    base: {
        opacity: '0',
        transform: from,
        transition: 'opacity var(--duration-normal) var(--ease-standard), '
            + 'transform var(--duration-normal) var(--ease-standard), '
            + 'display var(--duration-normal) allow-discrete, '
            + 'overlay var(--duration-normal) allow-discrete',
    },
    states: { open: { opacity: '1', transform: 'none' }, closed: {} },
    at: {
        'starting-style': { states: { open: { opacity: '0', transform: from } } },
        'reduced-motion': { base: { transition: 'none' }, states: { open: { transform: 'none' } } },
    },
});

/**
 * Enter/exit for a disclosure panel — Collapsible and Accordion are native
 * `<details>`, so the height animation lives on the browser's own
 * `::details-content` wrapper. `interpolate-size: allow-keywords` unlocks
 * `auto` as a transition endpoint, set on the element itself so nothing
 * outside this design system changes behaviour.
 */
const disclosurePresence: PartStyles = {
    base: { interpolateSize: 'allow-keywords' },
    selectors: {
        '&::details-content': {
            blockSize: '0',
            overflow: 'hidden',
            transition: 'block-size var(--duration-normal) var(--ease-standard), '
                + 'content-visibility var(--duration-normal) allow-discrete',
        },
        '&[open]::details-content': { blockSize: 'auto' },
    },
    at: {
        'reduced-motion': { selectors: { '&::details-content': { transition: 'none' } } },
    },
};

/**
 * Merge presence into a part's own styles per KEY, not per block — a recipe
 * that already writes `states: { open: {} }` (the "deliberately unstyled"
 * idiom every popup here uses) would otherwise replace the open state
 * presence needs and silently lose the entry animation.
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

/**
 * Carbon's ghost treatment for the overlay triggers — transparent fill,
 * interactive ink, hover/pressed feedback climbing the layer ramp
 * (base-200/base-300): the same $background-hover language Button's `ghost`
 * kind speaks.
 */
const ghostTrigger: PartStyles = {
    base: {
        appearance: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '0 var(--space-md)',
        minHeight: '3rem',
        border: 'none',
        borderRadius: 'var(--radius-field)',
        background: 'transparent',
        color: 'var(--carbon-interactive)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--weight-normal)',
        letterSpacing: 'var(--tracking-wide)',
        lineHeight: 'var(--leading-tight)',
        cursor: 'pointer',
        transition: motion('background, color'),
    },
    states: {
        hover: { background: 'var(--color-base-200)' },
        open: { background: 'var(--color-base-200)' },
        closed: {},
        disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
        ...focusRing,
    },
    selectors: {
        '&[data-pressed]:not([data-disabled])': {
            background: 'var(--color-base-300)',
            color: pressedInteractiveInk,
        },
    },
};

/**
 * Carbon's ghost icon button — the modal/popover close. Square, of course.
 * Hover/pressed are the ink washes: this button sits on layered surfaces
 * (the base-200 modal, the base-100 popover), so a fixed layer step would
 * vanish on one of them.
 */
const ghostIconButton = (size: string, position: CssProps = {}): PartStyles => ({
    base: {
        appearance: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        padding: '0',
        border: 'none',
        borderRadius: 'var(--radius-field)',
        background: 'transparent',
        color: 'var(--color-base-content)',
        cursor: 'pointer',
        transition: motion('background'),
        ...position,
    },
    states: {
        hover: { background: layerHover },
        disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
        ...focusRing,
    },
    selectors: {
        '&[data-pressed]:not([data-disabled])': { background: layerActive },
    },
});

/**
 * Carbon's accordion heading, shared by Collapsible and Accordion: 14px
 * label, layer-fill hover, and Carbon's signature end-of-row chevron —
 * heading text leads, the glyph sits flush-right, pointing down when closed
 * and flipping 180° to point up when open.
 */
const disclosureTrigger: PartStyles = {
    base: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-md)',
        minHeight: '2.5rem',
        padding: '0 var(--space-md)',
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--weight-normal)',
        letterSpacing: 'var(--tracking-wide)',
        borderRadius: 'var(--radius-field)',
        cursor: 'pointer',
        listStyle: 'none',
        transition: motion('background'),
    },
    states: {
        hover: { background: 'var(--color-base-200)' },
        open: {},
        closed: {},
        disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
        ...focusRing,
    },
    selectors: {
        // `display: flex` already suppresses the list-item marker; legacy
        // WebKit draws its own and needs telling separately.
        '&::-webkit-details-marker': { display: 'none' },
        // The `›` glyph rotated 90° points down; open adds another 180° so
        // it sweeps through the flip rather than snapping.
        '&::after': {
            content: '"\\203A"',
            flex: 'none',
            marginInlineStart: 'auto',
            rotate: '90deg',
            transition: motion('rotate'),
        },
        '&[data-state="open"]::after': { rotate: '270deg' },
        '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)' },
    },
};

const disclosurePanel: PartStyles = {
    base: {
        padding: 'var(--space-sm) var(--space-md) var(--space-lg)',
        fontSize: 'var(--text-sm)',
        letterSpacing: 'var(--tracking-wide)',
        lineHeight: 'var(--leading-normal)',
    },
    states: { open: {}, closed: {} },
};

/**
 * The disclosure size ramp (#321) — the accordion heading continues Carbon's
 * control heights exactly as tabs does (#258): 32 → 40 → 48 → 64 → 80, with
 * the heading's resting 40px as the un-attributed `md`. Heights, not type:
 * Carbon's size axis moves the control's box.
 */
const disclosureSizes: Record<string, Record<string, PartStyles>> = {
    sm: { trigger: { base: { minHeight: '2rem', padding: '0 var(--space-sm)' } } },
    md: {},
    lg: { trigger: { base: { minHeight: '3rem' } } },
    xl: { trigger: { base: { minHeight: '4rem' } } },
    '2xl': { trigger: { base: { minHeight: '5rem' } } },
};

/**
 * The menu surface: square, one step up the layer ramp (Carbon's $layer-01 —
 * flyouts never sit on the page background), a faint shadow as the secondary
 * depth cue — no hairline.
 */
const menuSurface: CssProps = {
    padding: 'var(--space-xs) 0',
    minWidth: '12rem',
    border: 'none',
    borderRadius: 'var(--radius-box)',
    background: 'var(--color-base-200)',
    color: 'var(--color-base-content)',
    boxShadow: 'var(--shadow-md)',
    fontFamily: 'var(--font-sans)',
};

/** A menu option row — full-bleed against the popup's zero inline padding. */
const menuItem: CssProps = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm)',
    minHeight: '2.5rem',
    padding: '0 var(--space-md)',
    fontSize: 'var(--text-sm)',
    letterSpacing: 'var(--tracking-wide)',
    borderRadius: 'var(--radius-selector)',
    cursor: 'pointer',
    outline: 'none',
    transition: motion('background'),
};

// ── Shared field language ─────────────────────────────────────────────────
/**
 * Carbon's field-01: a text-entry surface is a layer fill with a single
 * assertive bottom stroke ($border-strong — deliberately darker than the
 * hairline, it IS the field's chrome) — no side chrome, square corners.
 */
const field01: CssProps = {
    background: 'var(--color-base-200)',
    border: 'none',
    borderBlockEnd: 'var(--border) solid var(--carbon-border-strong)',
    borderRadius: 'var(--radius-field)',
};

/**
 * Every field-01 surface hovers the same way: a background rebind to
 * $field-hover — a token, not a filter, so the direction is right in both
 * schemes (darker on white, lighter on g100) and the text is untouched.
 */
const fieldHover: Record<string, CssProps> = {
    hover: { background: 'var(--carbon-field-hover)' },
};

/** Carbon's label-01: small, wide-tracked, secondary-ink form labels. */
const fieldLabel: CssProps = {
    fontSize: 'var(--text-xs)',
    letterSpacing: 'var(--tracking-wide)',
    lineHeight: 'var(--leading-tight)',
    color: 'color-mix(in oklab, var(--color-base-content) 78%, transparent)',
};

/**
 * The slider thumb's focus treatment: the 2px ring plus a base-100 gap so it
 * stays discernible on the base-content thumb in both schemes, as inset
 * shadows because a native thumb pseudo has no outline box to inset. The
 * idle value keeps the same two-layer shape so the ring fades rather than
 * snapping in.
 */
const thumbRing = 'inset 0 0 0 2px var(--carbon-focus), inset 0 0 0 4px var(--color-base-100)';
const thumbRingIdle = 'inset 0 0 0 2px transparent, inset 0 0 0 4px transparent';

// ── Tabs ──────────────────────────────────────────────────────────────────
export const tabs: RecipeInput = {
    component: 'tabs',
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' },
        },
        list: {
            base: {
                display: 'flex',
                borderBlockEnd: 'var(--border) solid var(--carbon-line)',
            },
        },
        tab: {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                background: 'transparent',
                border: 'none',
                // Carbon's line tab: the 2px underline is always drawn, only
                // its colour changes — selection never shifts the label.
                borderBlockEnd: '2px solid transparent',
                marginBlockEnd: 'calc(-1 * var(--border))',
                minHeight: '2.5rem',
                padding: '0 var(--space-md)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-normal)',
                letterSpacing: 'var(--tracking-wide)',
                lineHeight: 'var(--leading-tight)',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                cursor: 'pointer',
                transition: motion('background, border-color, color'),
            },
            states: {
                hover: { background: 'var(--color-base-200)', color: 'var(--color-base-content)' },
                active: {
                    color: 'var(--color-base-content)',
                    fontWeight: 'var(--weight-semibold)',
                    borderBlockEndColor: 'var(--carbon-interactive)',
                },
                inactive: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)' },
            },
        },
        panel: {
            base: { fontSize: 'var(--text-sm)', color: 'var(--color-base-content)' },
            states: { active: {}, inactive: {} },
        },
    },
    variants: {
        size: {
            sm: { tab: { base: { minHeight: '2rem', padding: '0 var(--space-sm)' } } },
            // `md` is the un-attributed render: the base already IS the
            // middle step, so restating it here would be a second copy free
            // to drift. An empty entry emits no rule and keeps the base.
            md: {},
            lg: { tab: { base: { minHeight: '3rem' } } },
            // Carbon's control ramp past `lg` is the button's own — 48 → 64 →
            // 80 px. Every height-bearing scope in this package continues on
            // it, so the declared five steps are five steps everywhere (#258).
            xl: { tab: { base: { minHeight: '4rem' } } },
            '2xl': { tab: { base: { minHeight: '5rem' } } },
        },
    },
};

// ── Collapsible ───────────────────────────────────────────────────────────
export const collapsible: RecipeInput = {
    component: 'collapsible',
    parts: {
        root: withPresence(disclosurePresence, {
            // A standalone accordion row: hairlines above and below, the
            // layer underneath showing through — Carbon depth is lines, not
            // shadows.
            base: {
                borderBlockStart: 'var(--border) solid var(--carbon-line)',
                borderBlockEnd: 'var(--border) solid var(--carbon-line)',
                borderRadius: 'var(--radius-box)',
                color: 'var(--color-base-content)',
                fontFamily: 'var(--font-sans)',
            },
            states: { open: {}, closed: {} },
        }),
        trigger: disclosureTrigger,
        panel: disclosurePanel,
    },
    variants: { size: disclosureSizes },
};

// ── Switch ────────────────────────────────────────────────────────────────
export const switchRecipe: RecipeInput = {
    component: 'switch',
    /** Carbon's Toggle: 48 × 24 at the default size, a 3px thumb inset. */
    tokens: {
        '--switch-width': 'calc(var(--size-selector) * 12)',
        '--switch-height': 'calc(var(--size-selector) * 6)',
        '--switch-pad': 'calc(var(--size-selector) * 0.75)',
    },
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
            },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                checked: {},
                unchecked: {},
            },
        },
        control: {
            // The one place Carbon rounds a corner: the toggle is a pill.
            // The off track is the assertive mid-gray ($toggle-off), so the
            // base-100 thumb stays clearly visible on it in both schemes.
            base: {
                display: 'inline-block',
                position: 'relative',
                width: 'var(--switch-width)',
                height: 'var(--switch-height)',
                borderRadius: '9999px',
                background: 'var(--carbon-border-strong)',
                transition: motion('background'),
            },
            states: {
                checked: { background: 'var(--carbon-toggle-on)' },
                unchecked: {},
                disabled: {},
                // Carbon marks an invalid control the way it marks a focused
                // one — an inset 2px rule — in danger rather than focus blue.
                // Same declaration its fields already use.
                invalid: { outline: '2px solid var(--carbon-danger)', outlineOffset: '-2px' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { filter: 'brightness(0.8)' },
            },
        },
        thumb: {
            base: {
                position: 'absolute',
                top: 'var(--switch-pad)',
                insetInlineStart: 'var(--switch-pad)',
                width: 'calc(var(--switch-height) - var(--switch-pad) * 2)',
                height: 'calc(var(--switch-height) - var(--switch-pad) * 2)',
                borderRadius: '9999px',
                background: 'var(--color-base-100)',
                transition: motion('transform'),
                // The anchor is logical, so the travel has to be too — and
                // `transform` has no logical form, so the direction is carried by
                // a value the RTL rule below can rebind. Half of this is worse
                // than neither: a logical anchor with a physical travel starts the
                // thumb at the reading end and then moves it further that way,
                // off the track.
                '--switch-thumb-dir': '1',
            },
            states: {
                checked: { transform: 'translateX(calc(var(--switch-thumb-dir) * (var(--switch-width) - var(--switch-height))))' },
                unchecked: {},
            },
            selectors: { [`&${rtl}`]: { '--switch-thumb-dir': '-1' } },
        },
        label: {
            base: { fontSize: 'var(--text-sm)', letterSpacing: 'var(--tracking-wide)' },
            states: { checked: {}, unchecked: {}, disabled: {} },
        },
    },
    variants: {
        /** Carbon ships default and small toggles; `lg` extends the ramp's shape. */
        size: {
            sm: { root: { base: { '--switch-width': 'calc(var(--size-selector) * 8)', '--switch-height': 'calc(var(--size-selector) * 4)' } } },
            // `md` is the un-attributed render — the defaults in `tokens:`
            // already ARE the middle step.
            md: {},
            lg: { root: { base: { '--switch-width': 'calc(var(--size-selector) * 14)', '--switch-height': 'calc(var(--size-selector) * 7)' } } },
            // The 2:1 track holds at every step, so the two upper ones scale
            // both axes together (#258).
            xl: { root: { base: { '--switch-width': 'calc(var(--size-selector) * 18)', '--switch-height': 'calc(var(--size-selector) * 9)' } } },
            '2xl': { root: { base: { '--switch-width': 'calc(var(--size-selector) * 24)', '--switch-height': 'calc(var(--size-selector) * 12)' } } },
        },
    },
    // The visible ring lives on `control`; the <label> root only groups the
    // control and its text. Declared rather than left implicit so the
    // delegation reads as a decision.
    skipStates: { root: ['focus-visible'] },
};

// ── Dialog ────────────────────────────────────────────────────────────────
/**
 * The size axis for the four ghost overlay triggers (#321). Dialog, popover,
 * tooltip and menu carry `data-size` on the TRIGGER — the anatomy's carrier
 * part; their popups are top-layer siblings the compiled `@scope` donut can
 * never reach, so size means the control itself. The ramp is the Button's
 * verbatim, including its anchor: `ghostTrigger` rests at Carbon's 48px
 * `lg`, exactly as the button does, so `lg` is the empty entry and `md`
 * SHRINKS the un-attributed render — and, past `lg`, the tall steps top-align
 * their label the way Carbon's expressive buttons do. (There is no colour
 * axis to wire: `roles: {}`, and `kind` stays Button-only by #183.)
 */
const overlayTriggerSizes: Record<string, Record<string, PartStyles>> = {
    sm: { trigger: { base: { minHeight: '2rem' } } },
    md: { trigger: { base: { minHeight: '2.5rem' } } },
    lg: {},
    xl: { trigger: { base: { minHeight: '4rem', alignItems: 'flex-start', paddingTop: 'var(--space-md)' } } },
    '2xl': { trigger: { base: { minHeight: '5rem', alignItems: 'flex-start', paddingTop: 'var(--space-md)' } } },
};

export const dialog: RecipeInput = {
    component: 'dialog',
    parts: {
        trigger: ghostTrigger,
        // Carbon's Modal: a square card sliding down from above the centre,
        // on the $layer-01 step so it separates from the page in both
        // schemes; depth from the scrim and the shadow ramp — never a border.
        popup: withPresence(popupPresence('translateY(-16px)'), {
            base: {
                width: 'calc(100% - 2rem)',
                maxWidth: '36rem',
                maxHeight: 'calc(100% - 2rem)',
                // The popup owns no padding: each region carries its own, so
                // the footer's button bar can reach the edges (below).
                padding: '0',
                border: 'none',
                borderRadius: 'var(--radius-box)',
                background: 'var(--color-base-200)',
                color: 'var(--color-base-content)',
                boxShadow: 'var(--shadow-xl)',
                fontFamily: 'var(--font-sans)',
            },
            states: { open: {}, closed: {} },
        }),
        backdrop: {
            // Carbon's overlay: gray-100 at half strength. Achromatic alpha —
            // a scrim, not palette.
            base: {
                background: 'oklch(0% 0 0 / 0.5)',
                opacity: '0',
                transition: 'opacity var(--duration-normal) var(--ease-standard), '
                    + 'display var(--duration-normal) allow-discrete, '
                    + 'overlay var(--duration-normal) allow-discrete',
            },
            states: { open: { opacity: '1' }, closed: {} },
            at: {
                'starting-style': { states: { open: { opacity: '0' } } },
                'reduced-motion': { base: { transition: 'none' } },
            },
        },
        title: {
            base: {
                margin: '0',
                // Inline-end clearance ≥ the 3rem close button parked in the
                // corner, so a long title never runs under its hit area.
                padding: 'var(--space-md) calc(var(--space-2xl) + var(--space-sm)) var(--space-md) var(--space-md)',
                fontSize: 'var(--text-xl)',
                // Carbon's heading-03 runs at the normal weight — hierarchy
                // comes from size, not boldness.
                fontWeight: 'var(--weight-normal)',
                lineHeight: 'var(--leading-tight)',
            },
        },
        description: {
            base: {
                margin: '0',
                padding: '0 var(--space-md) var(--space-lg)',
                fontSize: 'var(--text-sm)',
                letterSpacing: 'var(--tracking-wide)',
                lineHeight: 'var(--leading-normal)',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
            },
        },
        footer: {
            // The flush button bar: full-width 64px actions splitting the row
            // evenly, square against the modal's own corners.
            base: {
                display: 'flex',
                marginBlockStart: 'var(--space-lg)',
            },
            selectors: {
                '& > *': {
                    flex: '1 1 0',
                    minHeight: '4rem',
                    margin: '0',
                    borderRadius: '0',
                },
            },
        },
        /**
         * Carbon's modal has two dismisses — the corner ✕ and a labelled
         * action in the footer bar — and zero's anatomy has one `close` part
         * for both. So the recipe cannot pick by name; it picks by *where the
         * consumer put it*, which is the only signal the contract carries and
         * happens to be exactly the distinction Carbon draws.
         *
         * The ghost icon box is the shared base — one hover wash, one press
         * wash, one ring, whichever job the close is doing.
         */
        close: (() => {
            const shared = ghostIconButton('3rem');
            return {
                ...shared,
                selectors: {
                    ...shared.selectors,
                    // The corner ✕: the close the popup owns directly. The
                    // popup (fixed, top layer) is its containing block, so no
                    // wrapper is needed. Unconditional `position: absolute`
                    // here is what pulled a footer close out of flow and
                    // stacked it on top of this one — with the footer then
                    // collapsing to 0px, which made Carbon's own two footer
                    // rules unreachable (#257).
                    '[data-scope="dialog"][data-part="popup"] > &': {
                        position: 'absolute',
                        insetBlockStart: '0',
                        insetInlineEnd: '0',
                    },
                    // The footer action: it stays in flow and joins the flush
                    // button bar above, which already gives it the 64px height
                    // and an equal share of the row. What it drops is the ✕'s
                    // square — a labelled action is as wide as the bar allows,
                    // with Carbon's leading-aligned label rather than a
                    // centred glyph.
                    '[data-scope="dialog"][data-part="footer"] > &': {
                        width: 'auto',
                        height: 'auto',
                        justifyContent: 'flex-start',
                        padding: '0 var(--space-md)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-sm)',
                        letterSpacing: 'var(--tracking-wide)',
                    },
                },
            };
        })(),
        // The alertdialog's least-destructive action: the footer shape of the
        // ghost close, in flow — Carbon's secondary modal action.
        cancel: (() => {
            const shared = ghostIconButton('3rem');
            return {
                ...shared,
                base: {
                    ...shared.base,
                    width: 'auto',
                    height: 'auto',
                    justifyContent: 'flex-start',
                    padding: '0 var(--space-md)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-sm)',
                    letterSpacing: 'var(--tracking-wide)',
                },
            };
        })(),
    },
    // Trigger-carried size — see `overlayTriggerSizes`.
    variants: { size: overlayTriggerSizes },
};

// ── Popover ───────────────────────────────────────────────────────────────
export const popover: RecipeInput = {
    component: 'popover',
    parts: {
        trigger: ghostTrigger,
        // The one floating surface that carries a hairline: a popover sits on
        // the same layer language as a card, so it gets the line AND the
        // shadow.
        popup: withPresence(popupPresence('translateY(-4px)'), {
            base: {
                padding: 'var(--space-md)',
                minWidth: '14rem',
                border: 'var(--border) solid var(--carbon-line)',
                borderRadius: 'var(--radius-box)',
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
                boxShadow: 'var(--shadow-lg)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                letterSpacing: 'var(--tracking-wide)',
                lineHeight: 'var(--leading-normal)',
            },
            states: { open: {}, closed: {} },
        }),
        title: {
            base: {
                margin: '0 0 var(--space-sm)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
            },
        },
        close: ghostIconButton('2rem'),
    },
    // Trigger-carried size — see `overlayTriggerSizes`.
    variants: { size: overlayTriggerSizes },
};

// ── Tooltip ───────────────────────────────────────────────────────────────
export const tooltip: RecipeInput = {
    component: 'tooltip',
    parts: {
        // `ghostTrigger`, minus its press rule and with `cursor: help`.
        // Dialog, popover and menu take the helper whole; tooltip takes
        // everything about it except the two things that do not apply — the
        // anatomy declares no `pressed` flag, so `&[data-pressed]` here could
        // only ever be a rule the runtime never satisfies, and the pointer
        // says "explain" because nothing opens.
        trigger: {
            ...ghostTrigger,
            base: { ...ghostTrigger.base, cursor: 'help' },
            selectors: {},
        },
        // Inverted — the one surface that swaps the scheme: background-inverse
        // under text-inverse ink. Carbon tooltips fade in place, no travel.
        popup: withPresence(popupPresence('none'), {
            base: {
                padding: 'var(--space-sm) var(--space-md)',
                maxWidth: '18rem',
                background: 'var(--color-base-content)',
                color: 'var(--color-base-100)',
                border: 'none',
                borderRadius: 'var(--radius-field)',
                boxShadow: 'var(--shadow-sm)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xs)',
                lineHeight: 'var(--leading-normal)',
            },
            states: { open: {}, closed: {} },
        }),
    },
    // Trigger-carried size — see `overlayTriggerSizes`.
    variants: { size: overlayTriggerSizes },
};

// ── Menu ──────────────────────────────────────────────────────────────────
export const menu: RecipeInput = {
    component: 'menu',
    parts: {
        trigger: ghostTrigger,
        popup: withPresence(popupPresence('translateY(-4px)'), {
            base: menuSurface,
            states: { open: {}, closed: {} },
        }),
        item: {
            base: menuItem,
            states: {
                // The ink wash, not a layer step — the popup already sits on
                // base-200, so a base-200 highlight would be invisible.
                highlighted: { background: layerHover },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: layerActive },
            },
        },
        // The stateful rows are the item, unchanged; the mark column in front
        // carries the state as a tick in the row's own ink.
        'checkbox-item': {
            base: menuItem,
            states: {
                highlighted: { background: layerHover },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                checked: {}, unchecked: {},
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: layerActive },
            },
        },
        'radio-item': {
            base: menuItem,
            states: {
                highlighted: { background: layerHover },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                checked: {}, unchecked: {},
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: layerActive },
            },
        },
        'item-indicator': {
            base: {
                width: '1em',
                flexShrink: '0',
                fontSize: 'var(--text-xs)',
                lineHeight: '1',
            },
            states: { checked: {}, unchecked: {} },
            selectors: {
                '&[data-state="checked"]::after': { content: '"\\2713"' },
            },
        },
        // The item look, plus a chevron and an `open` state that keeps it
        // visually active after focus moves into the submenu.
        'sub-trigger': {
            base: menuItem,
            states: {
                open: { background: layerHover },
                closed: {},
                highlighted: { background: layerHover },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
            selectors: {
                // A submenu opens toward the reading end, so the chevron that
                // announces it has to point that way. `\203A` points right in
                // every writing direction; `\2039` is its mirror, and the swap
                // agrees with the side `Menu.tsx` itself resolves from `:dir()`.
                '&::after': { content: '"\\203A"', marginInlineStart: 'auto', opacity: '0.6' },
                [`&${rtl}::after`]: { content: '"\\2039"' },
                '&[data-pressed]:not([data-disabled])': { background: layerActive },
            },
        },
        // The same surface, entering from the side it attaches on.
        'sub-popup': withPresence(popupPresence('translateX(-4px)'), {
            base: menuSurface,
            states: { open: {}, closed: {} },
        }),
        'context-trigger': {
            base: {},
            states: { open: {}, closed: {}, disabled: {} },
        },
        group: { base: {} },
        'group-label': {
            base: {
                padding: 'var(--space-xs) var(--space-md)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semibold)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'color-mix(in oklab, var(--color-base-content) 60%, transparent)',
            },
        },
        separator: {
            base: {
                height: 'var(--border)',
                margin: 'var(--space-xs) 0',
                background: 'var(--carbon-line)',
            },
        },
    },
    // The context surface is the consumer's own box — this recipe declares it
    // only to name the part, and deliberately leaves its ring to whatever the
    // app draws around that content.
    skipStates: { 'context-trigger': ['focus-visible'] },
    // Trigger-carried size — see `overlayTriggerSizes`.
    variants: { size: overlayTriggerSizes },
};

// ── Field ─────────────────────────────────────────────────────────────────
export const field: RecipeInput = {
    component: 'field',
    parts: {
        root: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-sm)',
                fontFamily: 'var(--font-sans)',
            },
        },
        label: {
            // Carbon's label-01: 12px, regular weight, wide tracking, muted.
            base: {
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-normal)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'color-mix(in oklab, var(--color-base-content) 65%, transparent)',
            },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
            selectors: {
                '&[data-required]::after': { content: '" *"', color: 'var(--carbon-danger)' },
            },
        },
        description: {
            base: {
                margin: '0',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'color-mix(in oklab, var(--color-base-content) 65%, transparent)',
            },
        },
        error: {
            base: {
                margin: '0',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'var(--carbon-danger)',
            },
        },
    },
    variants: {
        // A field wrapper has no control height to ramp, so size moves what
        // it does own: label-01's 12px is Carbon's fixed caption at the
        // resting steps (`sm` only tightens the stack), and the wide steps
        // scale the three text parts together — the `expressive` move.
        size: {
            sm: { root: { base: { gap: 'var(--space-xs)' } } },
            // `md` is the un-attributed render.
            md: {},
            lg: {
                label: { base: { fontSize: 'var(--text-sm)' } },
                description: { base: { fontSize: 'var(--text-sm)' } },
                error: { base: { fontSize: 'var(--text-sm)' } },
            },
            xl: {
                label: { base: { fontSize: 'var(--text-md)' } },
                description: { base: { fontSize: 'var(--text-md)' } },
                error: { base: { fontSize: 'var(--text-md)' } },
            },
            '2xl': {
                label: { base: { fontSize: 'var(--text-lg)' } },
                description: { base: { fontSize: 'var(--text-lg)' } },
                error: { base: { fontSize: 'var(--text-lg)' } },
            },
        },
    },
    skipStates: { label: ['invalid', 'required'], error: ['invalid'] },
};

/**
 * Carbon's $support-success, deepened toward the page ink by the same
 * scheme-aware mix — it darkens on white and lightens on g100.
 *
 * `--carbon-toggle-on` IS that green (green-50 / green-40), but raw it measures
 * 2.58:1 against Progress's own base-300 track on white, and a finished bar has
 * to be seen against the track it replaces. At 85% it reads 3.37:1 on white and
 * 5.18:1 on g100, hue intact.
 */
const successFill = 'color-mix(in oklab, var(--carbon-toggle-on) 85%, var(--color-base-content))';

/**
 * Progress's resting fill: the interactive blue, deepened by the same
 * scheme-aware mix — darker on white, lighter on g100.
 *
 * Same reason as `successFill`, and the same 2.95:1 `pressedInteractiveInk`
 * was introduced for: raw `--carbon-interactive` on Progress's own base-300
 * track measures 2.95:1 on g100, so a bar at 40% reads as a bar at 0% for
 * anyone who cannot resolve that step. At 85% it reads 3.64:1 on g100 and
 * 5.15:1 on white, hue intact (#228). Carbon's own g100 pairs blue-50 on
 * gray-70 and lands at 2.51:1 — the one place this package deepens rather
 * than transcribes, for the same reason it deepens the finished bar.
 */
const rangeFill = 'color-mix(in oklab, var(--carbon-interactive) 85%, var(--color-base-content))';

// ─────────────────────────────────────────────────────────────────────────────
// 2. NEW HELPER — immediately above `export const checkbox`
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The checkbox mark's glyph fallback, for the two renders where a filled box
 * cannot be relied on: forced colors (author fills are replaced by the forced
 * palette) and print (`print-color-adjust: economy` drops backgrounds, and an
 * inverse-ink mark on a dropped fill is white on white).
 *
 * It neutralises the geometry rather than layering on top of it — the flat
 * `states` rules carry the stroke lengths, so the override has to restate them
 * or a 65%-wide box would still be forced around a text glyph. `ink` is the
 * one thing the two renders disagree on: forced colors wants a system colour,
 * print wants the page's own ink.
 */
const markGlyphFallback = (ink: string): PartStyles => ({
    base: {
        position: 'static',
        width: 'auto',
        height: 'auto',
        border: '0',
        rotate: 'none',
        opacity: '1',
        color: ink,
        fontSize: 'calc(var(--checkbox-size) * 0.75)',
        lineHeight: 'var(--leading-none)',
        transition: 'none',
    },
    states: {
        checked: { width: 'auto', height: 'auto', opacity: '1' },
        indeterminate: {
            inset: 'auto',
            width: 'auto',
            height: 'auto',
            opacity: '1',
            borderLeftWidth: '0',
            rotate: 'none',
        },
    },
    selectors: {
        '&[data-state="checked"]::after': { content: '"\\2713"' },
        '&[data-state="indeterminate"]::after': { content: '"\\2212"' },
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. REPLACES `export const checkbox`
// ─────────────────────────────────────────────────────────────────────────────

export const checkbox: RecipeInput = {
    component: 'checkbox',
    /** Carbon's 16px control; checked is a base-content fill, base-100 check. */
    tokens: {
        '--checkbox-size': 'calc(var(--size-selector) * 4)',
        /**
         * The mark's stroke. Carbon's check is 2px at every control size — the
         * ramp moves the box, never the stroke — so this is a literal, not a
         * fraction of `--checkbox-size`.
         */
        '--checkbox-mark-stroke': '2px',
    },
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
            },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                checked: {},
                unchecked: {},
                indeterminate: {},
            },
        },
        control: {
            base: {
                // `position: relative` is load-bearing: the mark is anchored
                // by its own corner rather than centred, so it can grow out
                // of that corner without swimming (see `indicator`).
                display: 'inline-flex',
                position: 'relative',
                alignItems: 'center',
                justifyContent: 'center',
                width: 'var(--checkbox-size)',
                height: 'var(--checkbox-size)',
                border: 'var(--border) solid var(--color-base-content)',
                borderRadius: 'var(--radius-selector)',
                background: 'transparent',
                transition: motion('background, border-color'),
            },
            states: {
                checked: { background: 'var(--color-base-content)' },
                indeterminate: { background: 'var(--color-base-content)' },
                unchecked: {},
                invalid: { borderColor: 'var(--carbon-danger)' },
                disabled: {},
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { filter: 'brightness(0.8)' },
            },
        },
        /**
         * Carbon's mark, geometry rather than a font glyph: an L of two 2px
         * borders rotated −45°, which is what `_checkbox.scss` draws. One
         * element covers both marks — `indeterminate` straightens the rotation
         * and drops the short arm, so the check *unfolds* into Carbon's 2px
         * bar instead of swapping symbols.
         *
         * Anchored at the L's corner (`bottom`/`left`, `transform-origin:
         * bottom left`) so the two arms *draw* out of the vertex: the short
         * arm at fast-01, the long arm following one fast-01 later at
         * fast-02. Percentages are of the control's box, so the whole mark
         * rides the size ramp with no per-step values.
         *
         * Physical `left`/`bottom`, not logical: a checkmark is not mirrored
         * in RTL, and Carbon does not mirror it either.
         */
        indicator: {
            base: {
                position: 'absolute',
                boxSizing: 'border-box',
                left: '38%',
                bottom: '27%',
                width: '0',
                height: '0',
                opacity: '0',
                color: 'var(--color-base-100)',
                borderLeft: 'var(--checkbox-mark-stroke) solid currentColor',
                borderBottom: 'var(--checkbox-mark-stroke) solid currentColor',
                rotate: '-45deg',
                transformOrigin: 'bottom left',
                // The delay in the `width` slot is a token, so reduced motion
                // collapses it with everything else — `reducedMotionBlock`
                // rewrites every declared duration, delays included.
                //
                // Accepted cost: `width`, `height`, `inset` and
                // `border-left-width` are all on the layout path, so the draw-on
                // dirties layout every frame where daisy's `clip-path` and
                // material's `scale` stay on the compositor. It buys the thing
                // this mark is for — the check *unfolding* into Carbon's bar,
                // one element, no cross-fade — and the arms are borders, which
                // `scale` would thin. Fine for a 16px control; worth knowing
                // before a thousand of them share a scroll container.
                transition: 'height var(--duration-fast) var(--ease-decelerate), '
                    + 'width var(--duration-normal) var(--ease-decelerate) var(--duration-fast), '
                    + 'opacity var(--duration-fast) var(--ease-standard), '
                    + 'rotate var(--duration-normal) var(--ease-standard), '
                    + 'inset var(--duration-normal) var(--ease-standard), '
                    + 'border-left-width var(--duration-fast) var(--ease-standard)',
            },
            states: {
                // Carbon's 0.65rem × 0.3125rem check on a 1rem control.
                checked: { width: '65%', height: '31%', opacity: '1' },
                // The bar: no short arm, no rotation, centred on the box —
                // `50%` minus half a stroke, since the stroke is the height.
                indeterminate: {
                    left: '25%',
                    bottom: 'calc(50% - var(--checkbox-mark-stroke) / 2)',
                    width: '50%',
                    height: '0',
                    opacity: '1',
                    borderLeftWidth: '0',
                    rotate: '0deg',
                },
                // `unchecked` IS the base: both arms at zero length, faded out.
                unchecked: {},
            },
            at: {
                'forced-colors': markGlyphFallback('CanvasText'),
                // The other medium a background-painted mark vanishes in. Same
                // preference tier as `forced-colors`, so it lands after the
                // flat state rules it replaces.
                // `--print-ink`, not `--color-base-content`: the latter is
                // white under a dark theme, so it printed white on white (#233).
                print: markGlyphFallback('var(--print-ink)'),
            },
        },
        label: {
            base: { fontSize: 'var(--text-sm)', letterSpacing: 'var(--tracking-wide)' },
            states: { checked: {}, unchecked: {}, indeterminate: {}, disabled: {} },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 3.5)' } } },
            // `md` is the un-attributed render — the defaults in `tokens:`
            // already ARE the middle step.
            md: {},
            lg: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 5)' } } },
            xl: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 6.5)' } } },
            '2xl': { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 8)' } } },
        },
    },
    // The visible ring lives on `control`; the <label> root only groups the
    // control and its text. Declared rather than left implicit so the
    // delegation reads as a decision.
    skipStates: { root: ['focus-visible'] },
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. REPLACES `export const progress`  (keep the `// ── Progress ──` banner)
// ─────────────────────────────────────────────────────────────────────────────

// ── Radio group ───────────────────────────────────────────────────────────
export const radioGroup: RecipeInput = {
    component: 'radio-group',
    /** Carbon's 18px radio — with the toggle, the only rounded controls. */
    tokens: {
        '--radio-size': 'calc(var(--size-selector) * 4.5)',
    },
    parts: {
        root: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-sm)',
                fontFamily: 'var(--font-sans)',
            },
            states: { invalid: {}, required: {} },
            selectors: {
                // `invalid` is a fact about the GROUP — `item-control` carries
                // no flag of its own. Carbon's radio marks its error on the
                // circle itself rather than with the fields' inset rule, so
                // this is a border and not an outline.
                '&[data-invalid] [data-part="item-control"]': { borderColor: 'var(--carbon-danger)' },
            },
        },
        label: {
            // The group legend speaks label-01, same as Field's label.
            base: {
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-normal)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'color-mix(in oklab, var(--color-base-content) 65%, transparent)',
            },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
        },
        item: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                cursor: 'pointer',
            },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                checked: {},
                unchecked: {},
            },
        },
        'item-control': {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 'var(--radio-size)',
                height: 'var(--radio-size)',
                border: 'var(--border) solid var(--color-base-content)',
                borderRadius: '9999px',
                background: 'transparent',
            },
            states: {
                checked: {},
                unchecked: {},
                disabled: {},
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { filter: 'brightness(0.8)' },
            },
        },
        'item-indicator': {
            // Carbon's checked radio is circle + dot, both in base-content.
            base: {
                width: 'calc(var(--radio-size) / 2)',
                height: 'calc(var(--radio-size) / 2)',
                borderRadius: '9999px',
                background: 'transparent',
                transition: motion('background'),
            },
            states: {
                checked: { background: 'var(--color-base-content)' },
                unchecked: {},
            },
        },
        'item-label': {
            base: { fontSize: 'var(--text-sm)', letterSpacing: 'var(--tracking-wide)' },
            states: { checked: {}, unchecked: {}, disabled: {} },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 4)' } } },
            // `md` is the un-attributed render — the defaults in `tokens:`
            // already ARE the middle step.
            md: {},
            lg: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 5.5)' } } },
            xl: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 7)' } } },
            '2xl': { root: { base: { '--radio-size': 'calc(var(--size-selector) * 9)' } } },
        },
    },
    // The visible ring lives on `item-control`; `item` is the <label> that
    // wraps it. Declared rather than left implicit so the delegation reads
    // as a decision.
    skipStates: { label: ['invalid', 'required'], item: ['focus-visible'] },
};

export const progress: RecipeInput = {
    component: 'progress',
    /** Carbon's 4px bar — the size ramp only rebinds the thickness. */
    tokens: { '--progress-track-size': '0.25rem' },
    parts: {
        /**
         * `complete` also draws Carbon's status mark — the same 2px L the
         * checkbox draws, in the same success green, at the end of the label
         * row where Carbon's ProgressBar puts its finished icon. Colour alone
         * carried completion before, and a hue swap is the one signal a
         * colour-blind reader may not get; the mark is geometry, so it does
         * not depend on the hue landing.
         *
         * It hangs off `label` rather than `root` — every row below the label
         * is optional, so the root's own top-right corner is the track's on a
         * label-less Progress and the mark would land on the bar.
         */
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', width: '100%' },
            states: { loading: {}, complete: {}, indeterminate: {} },
            selectors: {
                '& [data-part="label"]::after': {
                    content: '""',
                    position: 'absolute',
                    top: '50%',
                    insetInlineEnd: '0',
                    boxSizing: 'border-box',
                    width: 'calc(var(--text-xs) * 0.7)',
                    height: 'calc(var(--text-xs) * 0.35)',
                    borderLeft: `2px solid ${successFill}`,
                    borderBottom: `2px solid ${successFill}`,
                    rotate: '-45deg',
                    // Half its own height back up for the `top: 50%` anchor,
                    // then a hair more: the rotated L's ink sits below its own
                    // box centre.
                    translate: '0 calc(-50% - var(--text-xs) * 0.12)',
                    scale: '0',
                    opacity: '0',
                    transition: 'scale var(--duration-normal) var(--ease-decelerate), '
                        + 'opacity var(--duration-fast) var(--ease-standard)',
                },
                '&[data-state="complete"] [data-part="label"]::after': { scale: '1', opacity: '1' },
            },
        },
        // `position` carries the completion mark; the inline-end gutter is
        // that mark's, so a wrapping label cannot run under it.
        label: { base: { ...fieldLabel, position: 'relative', paddingInlineEnd: 'var(--space-md)' } },
        track: {
            base: {
                width: '100%',
                height: 'var(--progress-track-size)',
                background: 'var(--color-base-300)',
                overflow: 'hidden',
            },
        },
        range: {
            base: {
                height: '100%',
                background: rangeFill,
                transition: motion('width, background'),
                '--progress-sweep-dir': '1',
            },
            selectors: { [`&${rtl}`]: { '--progress-sweep-dir': '-1' } },
            states: {
                loading: {},
                /**
                 * Carbon's finished ProgressBar recolours the fill to
                 * $support-success. There is no success *role* in this
                 * vocabulary, but there is that exact green — see
                 * `successFill`. Completion was otherwise carried only by
                 * `range`'s inline width, which no stylesheet can see.
                 */
                complete: { background: successFill },
                indeterminate: { width: '40%', animation: 'carbon-indeterminate 1.4s ease-in-out infinite' },
            },
            // A looping animation must STOP under reduced motion, not speed
            // up — which is why its duration is a literal rather than a
            // `var(--duration-*)` that would collapse to ~0.
            at: { 'reduced-motion': { states: { indeterminate: { animation: 'none', width: '100%' } } } },
        },
        'value-text': { base: { ...fieldLabel } },
    },
    variants: {
        size: {
            sm: { root: { base: { '--progress-track-size': '0.125rem' } } },
            md: {},
            lg: { root: { base: { '--progress-track-size': '0.5rem' } } },
            xl: { root: { base: { '--progress-track-size': '0.75rem' } } },
            '2xl': { root: { base: { '--progress-track-size': '1rem' } } },
        },
    },
    // Transform, not margin: no layout work per frame. The percentages are
    // of the 40%-wide bar itself — -100% hides it before the track, 250%
    // (100/40 of the track) carries it past the far edge.
    //
    // Neither `translate` nor `transform` has a logical form, so the sign is
    // carried by a value the RTL rule on `range` can rebind. Without it the
    // determinate `width`, an ordinary flow child, mirrors while the
    // indeterminate sweep of the same element does not.
    keyframes: {
        'carbon-indeterminate':
            'from { translate: calc(var(--progress-sweep-dir) * -100%) 0; } '
            + 'to { translate: calc(var(--progress-sweep-dir) * 250%) 0; }',
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. REPLACES `export const ratingGroup`  (keep the `// ── Rating group ──` banner)
// ─────────────────────────────────────────────────────────────────────────────

// ── Slider ────────────────────────────────────────────────────────────────
export const slider: RecipeInput = {
    component: 'slider',
    /**
     * Slider geometry, named once. Carbon's rail is 2px and its handle 14px
     * at every size, and the resting row is the 40px control box — none of
     * which is spacing, so none of it rides `--space-*`; what the three
     * centring offsets below owe the ramp is only that they stop restating
     * these numbers as bare margins. Each is now arithmetic over the metric
     * it actually derives from (`spacing/off-ramp`, #469).
     */
    tokens: {
        // 2px, Carbon's rail — the same literal `--progress-track-size` keeps
        // and for the same reason: the ramp moves boxes, never hairlines.
        '--slider-track-size': '0.125rem',
        // 14px on the 4px mini-unit grid.
        '--slider-thumb-size': 'calc(var(--size-selector) * 3.5)',
        // The resting 40px row. `size` moves the control's own box (below)
        // and deliberately leaves the composed rail's row where it is.
        '--slider-control-size': 'calc(var(--size-selector) * 10)',
    },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', width: '100%' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
        },
        label: {
            base: { ...fieldLabel },
            states: { disabled: {} },
        },
        // A custom skin (`appearance: none`): Blink ignores thumb-pseudo
        // styling on a native slider, so Carbon's square thumb and its inset
        // focus ring could never render there. Both ring states set one
        // custom property the thumb pseudos read — vendor thumb pseudos
        // cannot share a selector list (an unrecognized selector invalidates
        // the whole rule), and the variable keeps the ring defined once per
        // engine instead of once per state per engine. The filled track
        // reads the runtime-published `--slider-percent` (set on the slider
        // root, inherited here) as a gradient stop.
        control: {
            base: {
                appearance: 'none',
                width: '100%',
                height: 'var(--slider-control-size)',
                margin: '0',
                background: 'transparent',
                cursor: 'pointer',
                outline: 'none',
                accentColor: 'var(--carbon-interactive)',
                '--slider-ring': thumbRingIdle,
                '--slider-track':
                    'linear-gradient(to right, var(--carbon-interactive) var(--slider-percent, 50%), var(--carbon-line) 0)',
            },
            states: {
                'focus-visible': { '--slider-ring': thumbRing },
                // A drag has no one-shot — the ring doubling as the held
                // feedback is the whole press treatment.
                pressed: { '--slider-ring': thumbRing },
                invalid: {
                    '--slider-track':
                        'linear-gradient(to right, var(--carbon-danger) var(--slider-percent, 50%), var(--carbon-line) 0)',
                },
                disabled: { cursor: 'not-allowed' },
            },
            selectors: {
                '&::-webkit-slider-runnable-track': {
                    height: 'var(--slider-track-size)',
                    background: 'var(--slider-track)',
                },
                '&::-webkit-slider-thumb': {
                    appearance: 'none',
                    width: 'var(--slider-thumb-size)',
                    height: 'var(--slider-thumb-size)',
                    // Centre the handle on the rail it overhangs.
                    marginTop: 'calc((var(--slider-track-size) - var(--slider-thumb-size)) / 2)',
                    border: 'none',
                    borderRadius: 'var(--radius-selector)',
                    background: 'var(--color-base-content)',
                    boxShadow: 'var(--slider-ring)',
                    transition: 'box-shadow var(--duration-fast) var(--ease-standard)',
                },
                '&::-moz-range-track': {
                    height: 'var(--slider-track-size)',
                    background: 'var(--slider-track)',
                },
                '&::-moz-range-thumb': {
                    width: 'var(--slider-thumb-size)',
                    height: 'var(--slider-thumb-size)',
                    border: 'none',
                    borderRadius: 'var(--radius-selector)',
                    background: 'var(--color-base-content)',
                    boxShadow: 'var(--slider-ring)',
                    transition: 'box-shadow var(--duration-fast) var(--ease-standard)',
                },
            },
            at: {
                // Native rendering knows forced colors better than a custom
                // skin; the retained accentColor keeps the fallback branded.
                'forced-colors': { base: { appearance: 'auto' } },
            },
        },
        // The composed range projection (#325): Carbon's hairline rail and
        // square handle as real parts, same inks as the rebuilt control.
        track: {
            base: {
                height: 'var(--slider-track-size)',
                // Pad the rail out to the control's resting box, so the
                // composed projection occupies the same row as the native one.
                marginBlock: 'calc((var(--slider-control-size) - var(--slider-track-size)) / 2)',
                // Progress's rail, not `--carbon-line`: the audited
                // `rangeFill` pair is fill-on-base-300 (3.64:1 on g100);
                // on the lighter line grey it drops to 2.11:1.
                background: 'var(--color-base-300)',
                cursor: 'pointer',
            },
            states: { disabled: { cursor: 'not-allowed' } },
        },
        range: {
            base: {
                height: '100%',
                // `rangeFill`, not the raw interactive blue: on the g100 rail
                // the raw token is 1.71:1 — the same fill-vs-track failure
                // progress already deepened its way out of (#228).
                background: rangeFill,
            },
            states: { disabled: {} },
        },
        thumb: {
            base: {
                width: 'var(--slider-thumb-size)',
                height: 'var(--slider-thumb-size)',
                insetBlockStart: '50%',
                translate: '0 -50%',
                // Centre the handle on the position — a LOGICAL negative
                // margin of half its own width, never a transform.
                marginInlineStart: 'calc(var(--slider-thumb-size) / -2)',
                borderRadius: 'var(--radius-selector)',
                background: 'var(--color-base-content)',
                cursor: 'pointer',
                outline: 'none',
                touchAction: 'none',
                transition: 'box-shadow var(--duration-fast) var(--ease-standard)',
            },
            states: {
                'focus-visible': { boxShadow: thumbRing },
                // A drag has no one-shot — the ring doubling as the held
                // feedback is the whole press treatment, as on the control.
                pressed: { boxShadow: thumbRing },
                disabled: { cursor: 'not-allowed' },
            },
        },
        mark: {
            base: {
                paddingBlockStart: 'calc(0.125rem + var(--space-2xs))',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                lineHeight: '1',
                whiteSpace: 'nowrap',
                color: 'color-mix(in oklab, var(--color-base-content) 65%, transparent)',
            },
            states: { disabled: {} },
            selectors: {
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    insetBlockStart: '0',
                    insetInlineStart: '-1px',
                    width: '2px',
                    height: '0.125rem',
                    background: 'var(--carbon-line)',
                },
            },
        },
        'value-text': { base: { ...fieldLabel } },
    },
    variants: {
        // The control's box height is the size lever — track and thumb keep
        // their Carbon metrics; md is the resting height, so it emits nothing.
        size: {
            sm: { control: { base: { height: '2rem' } } },
            md: {},
            lg: { control: { base: { height: '3rem' } } },
            xl: { control: { base: { height: '4rem' } } },
            '2xl': { control: { base: { height: '5rem' } } },
        },
    },
    // The ring lives on the control's thumb; invalid draws on the track.
    skipStates: { root: ['invalid', 'focus-visible'] },
};

// ── Accordion ─────────────────────────────────────────────────────────────
export const accordion: RecipeInput = {
    component: 'accordion',
    parts: {
        root: {
            // Items carry their own block-start hairline; the root closes the
            // run with the final edge.
            base: {
                display: 'flex',
                flexDirection: 'column',
                borderBlockEnd: 'var(--border) solid var(--carbon-line)',
                borderRadius: 'var(--radius-box)',
                color: 'var(--color-base-content)',
                fontFamily: 'var(--font-sans)',
            },
        },
        item: withPresence(disclosurePresence, {
            base: { borderBlockStart: 'var(--border) solid var(--carbon-line)' },
            states: { open: {}, closed: {} },
        }),
        trigger: disclosureTrigger,
        panel: disclosurePanel,
    },
    variants: { size: disclosureSizes },
};

// ── Select ────────────────────────────────────────────────────────────────
export const select: RecipeInput = {
    component: 'select',
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column' },
        },
        trigger: {
            // Carbon's field-01: a base-200 fill with ONLY the assertive
            // bottom stroke — the square input language every text-entry
            // surface here speaks (shared shape inlined: this trigger is a
            // flex row, not a wrapper box).
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-md)',
                minWidth: '12rem',
                minHeight: '2.5rem',
                padding: '0 var(--space-md)',
                border: 'none',
                borderBlockEnd: 'var(--border) solid var(--carbon-border-strong)',
                borderRadius: 'var(--radius-field)',
                background: 'var(--color-base-200)',
                color: 'var(--color-base-content)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-normal)',
                letterSpacing: 'var(--tracking-wide)',
                cursor: 'pointer',
                transition: motion('background, border-color'),
            },
            states: {
                ...fieldHover,
                disabled: {
                    opacity: 'var(--disabled-opacity)',
                    cursor: 'not-allowed',
                },
                open: {},
                closed: {},
                // Carbon marks an invalid field the way it marks a focused one:
                // a 2px inset outline, in the danger ink. Declared before the
                // focus ring so focus wins while both apply.
                invalid: { outline: '2px solid var(--carbon-danger)', outlineOffset: '-2px' },
                placeholder: {},
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: 'var(--carbon-field-hover)' },
            },
        },
        value: {
            base: {},
            states: {
                placeholder: { color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)' },
            },
        },
        indicator: {
            base: { display: 'inline-flex', transition: motion('transform') },
            states: { open: { transform: 'rotate(180deg)' }, closed: {} },
        },
        popup: {
            // A Carbon flyout: square, flush, borderless, on the $layer-01
            // step — the shadow is the secondary depth cue. Presence is the
            // standard top-layer pattern: zero keeps the node mounted and
            // toggles `data-state`, so `display`/`overlay` with
            // `allow-discrete` hold the exit and `@starting-style` supplies
            // the entry's FROM state.
            base: {
                opacity: '0',
                transform: 'translateY(-0.25rem)',
                padding: '0',
                minWidth: '12rem',
                background: 'var(--color-base-200)',
                color: 'var(--color-base-content)',
                fontFamily: 'var(--font-sans)',
                borderRadius: 'var(--radius-box)',
                boxShadow: 'var(--shadow-md)',
                transition: 'opacity var(--duration-normal) var(--ease-standard), '
                    + 'transform var(--duration-normal) var(--ease-standard), '
                    + 'display var(--duration-normal) allow-discrete, '
                    + 'overlay var(--duration-normal) allow-discrete',
            },
            states: {
                open: { opacity: '1', transform: 'none' },
                closed: {},
            },
            at: {
                'starting-style': { states: { open: { opacity: '0', transform: 'translateY(-0.25rem)' } } },
                'reduced-motion': { base: { transition: 'none' }, states: { open: { transform: 'none' } } },
            },
        },
        // The optgroup equivalent (#325) — the menu's group grammar.
        group: { base: {} },
        'group-label': {
            base: {
                padding: 'var(--space-xs) var(--space-md)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semibold)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'color-mix(in oklab, var(--color-base-content) 60%, transparent)',
            },
        },
        item: {
            // Carbon's list-box option: a subtle divider under every row but
            // the last — the same treatment the combobox options carry.
            base: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-md)',
                minHeight: '2.5rem',
                padding: '0 var(--space-md)',
                fontSize: 'var(--text-sm)',
                letterSpacing: 'var(--tracking-wide)',
                borderBlockEnd: 'var(--border) solid var(--carbon-line)',
                borderRadius: 'var(--radius-selector)',
                cursor: 'pointer',
                transition: motion('background'),
            },
            states: {
                highlighted: { background: layerHover },
                selected: { fontWeight: 'var(--weight-semibold)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
            selectors: {
                '&:last-child': { borderBlockEnd: 'none' },
                '&[data-pressed]:not([data-disabled])': { background: layerActive },
            },
        },
        'item-indicator': {
            base: { fontSize: 'var(--text-xs)' },
            states: { selected: {} },
        },
    },
    variants: {
        /** Carbon's five field heights: 32 / 40 / 48 / 64 / 80. */
        size: {
            sm: { trigger: { base: { minHeight: '2rem' } } },
            // `md` is the un-attributed render — the defaults in `base`
            // already ARE the middle step.
            md: {},
            lg: { trigger: { base: { minHeight: '3rem' } } },
            xl: { trigger: { base: { minHeight: '4rem' } } },
            '2xl': { trigger: { base: { minHeight: '5rem' } } },
        },
    },
};

// ── Button ────────────────────────────────────────────────────────────────
export const button: RecipeInput = {
    /**
     * The un-attributed render IS `kind="primary"` at `size="lg"` (Carbon's
     * 48px default) — the defaults live in the base, so variants only rebind.
     */
    tokens: {
        '--btn-fill': 'var(--carbon-interactive)',
        '--btn-ink': 'var(--carbon-interactive-ink)',
        '--btn-line': 'transparent',
        // Hover/pressed are per-kind rebinds, not a filter — a brightness
        // filter on a transparent fill only dims the ink, so the four
        // transparent kinds would show no feedback at all. Solid kinds
        // derive their darker steps from their own fill; transparent kinds
        // rebind all three outright (below), matching Carbon: ghost hovers
        // the layer ramp, tertiary fills solid and flips its ink.
        '--btn-fill-hover': 'color-mix(in oklab, var(--btn-fill) 90%, black)',
        '--btn-fill-active': 'color-mix(in oklab, var(--btn-fill) 78%, black)',
        '--btn-ink-hover': 'var(--btn-ink)',
        '--btn-ink-active': 'var(--btn-ink-hover)',
    },
    component: 'button',
    parts: {
        root: {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                // Carbon's signature: label leads, trailing space follows —
                // buttons are left-aligned boxes, not centered pills.
                justifyContent: 'flex-start',
                width: 'fit-content',
                padding: '0 calc(var(--space-2xl) + var(--space-lg)) 0 var(--space-md)',
                minHeight: '3rem',
                border: 'var(--border) solid var(--btn-line)',
                borderRadius: 'var(--radius-field)',
                background: 'var(--btn-fill)',
                color: 'var(--btn-ink)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-normal)',
                letterSpacing: 'var(--tracking-wide)',
                lineHeight: 'var(--leading-tight)',
                cursor: 'pointer',
                transition: motion('background, border-color, color'),
            },
            states: {
                hover: { background: 'var(--btn-fill-hover)', color: 'var(--btn-ink-hover)' },
                disabled: {
                    opacity: 'var(--disabled-opacity)',
                    cursor: 'not-allowed',
                },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': {
                    background: 'var(--btn-fill-active)',
                    color: 'var(--btn-ink-active)',
                },
            },
        },
    },
    variants: {
        variant: {
            primary: {},
            secondary: { root: { base: { '--btn-fill': 'var(--carbon-secondary)', '--btn-ink': 'var(--carbon-secondary-ink)' } } },
            // Tertiary hover fills solid and flips the ink to inverse — the
            // Carbon $button-tertiary-hover treatment.
            tertiary: {
                root: {
                    base: {
                        '--btn-fill': 'transparent',
                        '--btn-ink': 'var(--carbon-interactive)',
                        '--btn-line': 'var(--carbon-interactive)',
                        '--btn-fill-hover': 'var(--carbon-interactive)',
                        '--btn-fill-active': 'color-mix(in oklab, var(--carbon-interactive) 78%, black)',
                        '--btn-ink-hover': 'var(--carbon-interactive-ink)',
                    },
                },
            },
            // Ghost hovers the layer ramp — the same base-200/base-300
            // feedback the overlay ghost triggers use ($background-hover).
            // The pressed ink mixes toward base-content: scheme-aware, it
            // darkens on white and lightens on g100, keeping the label above
            // 3:1 on the base-300 pressed fill in both.
            ghost: {
                root: {
                    base: {
                        '--btn-fill': 'transparent',
                        '--btn-ink': 'var(--carbon-interactive)',
                        '--btn-fill-hover': 'var(--color-base-200)',
                        '--btn-fill-active': 'var(--color-base-300)',
                        '--btn-ink-hover': 'var(--carbon-interactive)',
                        '--btn-ink-active': pressedInteractiveInk,
                    },
                },
            },
            danger: { root: { base: { '--btn-fill': 'var(--carbon-danger)', '--btn-ink': 'var(--carbon-danger-ink)' } } },
            // Carbon's `danger--tertiary` / `danger--ghost`, in the attribute
            // grammar's spelling — the api's values remap owns the vendor one.
            // Both hover to the solid danger fill with inverse ink, Carbon's
            // $button-danger-hover.
            'danger-tertiary': {
                root: {
                    base: {
                        '--btn-fill': 'transparent',
                        '--btn-ink': 'var(--carbon-danger)',
                        '--btn-line': 'var(--carbon-danger)',
                        '--btn-fill-hover': 'var(--carbon-danger)',
                        '--btn-fill-active': 'color-mix(in oklab, var(--carbon-danger) 78%, black)',
                        '--btn-ink-hover': 'var(--carbon-danger-ink)',
                    },
                },
            },
            'danger-ghost': {
                root: {
                    base: {
                        '--btn-fill': 'transparent',
                        '--btn-ink': 'var(--carbon-danger)',
                        '--btn-fill-hover': 'var(--carbon-danger)',
                        '--btn-fill-active': 'color-mix(in oklab, var(--carbon-danger) 78%, black)',
                        '--btn-ink-hover': 'var(--carbon-danger-ink)',
                    },
                },
            },
        },
        /** Carbon's five field heights: 32 / 40 / 48 / 64 / 80. */
        size: {
            sm: { root: { base: { minHeight: '2rem' } } },
            md: { root: { base: { minHeight: '2.5rem' } } },
            lg: {},
            xl: { root: { base: { minHeight: '4rem', alignItems: 'flex-start', paddingTop: 'var(--space-md)' } } },
            '2xl': { root: { base: { minHeight: '5rem', alignItems: 'flex-start', paddingTop: 'var(--space-md)' } } },
        },
    },
    /** Carbon's `hasIconOnly` / `isExpressive` — presence-only, no value. */
    modifiers: {
        'icon-only': {
            root: {
                base: {
                    justifyContent: 'center',
                    padding: '0',
                    aspectRatio: '1',
                },
            },
        },
        expressive: {
            root: { base: { fontSize: 'var(--text-md)', letterSpacing: 'var(--tracking-normal)' } },
        },
    },
};

// ── Avatar ────────────────────────────────────────────────────────────────
export const avatar: RecipeInput = {
    component: 'avatar',
    tokens: {
        '--avatar-size': 'calc(var(--size-selector) * 10)',
        '--avatar-text': 'var(--text-sm)',
    },
    parts: {
        root: {
            base: {
                position: 'relative',
                display: 'inline-grid',
                width: 'var(--avatar-size)',
                height: 'var(--avatar-size)',
                // Square — the radius token resolves to 0, and the corner is
                // the identity statement, same as every other Carbon box.
                borderRadius: 'var(--radius-selector)',
                overflow: 'hidden',
                verticalAlign: 'middle',
                background: 'var(--color-base-300)',
            },
            states: { loading: {}, loaded: {}, error: {} },
        },
        image: {
            base: {
                gridArea: '1 / 1',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
            },
            states: { loading: {}, loaded: {}, error: {} },
        },
        fallback: {
            base: {
                gridArea: '1 / 1',
                placeItems: 'center',
                width: '100%',
                height: '100%',
                color: 'var(--color-base-content)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--avatar-text)',
                fontWeight: 'var(--weight-normal)',
                letterSpacing: 'var(--tracking-wide)',
                userSelect: 'none',
            },
            // `display` must not defeat the `hidden` zero sets once the image
            // has loaded.
            selectors: { '&:not([hidden])': { display: 'grid' } },
            states: { loading: {}, loaded: {}, error: {} },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--avatar-size': 'calc(var(--size-selector) * 8)', '--avatar-text': 'var(--text-xs)' } } },
            // `md` is the un-attributed render — the defaults in `tokens:`
            // already ARE the middle step.
            md: {},
            lg: { root: { base: { '--avatar-size': 'calc(var(--size-selector) * 12)', '--avatar-text': 'var(--text-md)' } } },
            // 48 → 64 → 80 px: the button ramp exactly, since an avatar is
            // sized in the same control units.
            xl: { root: { base: { '--avatar-size': 'calc(var(--size-selector) * 16)', '--avatar-text': 'var(--text-lg)' } } },
            '2xl': { root: { base: { '--avatar-size': 'calc(var(--size-selector) * 20)', '--avatar-text': 'var(--text-xl)' } } },
        },
    },
};

// ── Toast ─────────────────────────────────────────────────────────────────
/**
 * ── WHY CARBON'S ANSWER TO #225 IS NOT MATERIAL'S ──────────────────────────
 * Material's `toast({ color })` was a WEAK axis — every role reached the
 * stylesheet and landed somewhere almost nobody could see. Carbon's is a
 * MISSING one, and missing on purpose: `roles: {}` is this package's whole
 * thesis (Carbon Button has no colour prop; `kind` fuses colour and
 * treatment), the recipe validator rejects any `variants.color` key that
 * names no declared role, and since #241 the playground reads the live
 * vocabulary and passes no `color` to a carbon toast at all. So the fix
 * cannot be "wire the roles" — there are none to wire, and inventing four
 * would trade the acceptance test this package exists to be for one
 * component's demo.
 *
 * What was actually broken is narrower and worse: the accent bar was
 * hardcoded `--carbon-interactive`, so every notification this design system
 * can render is an INFORMATIONAL one, permanently — Carbon's notification
 * language has four kinds and this one could only ever say the first.
 *
 * The status distinction zero guarantees on every toast, with no vocabulary
 * at all, is the ARIA one: `Toast.Root` renders `role="alert"` for an
 * assertive toast and `role="status"` for the rest. That is the same
 * urgency split Carbon draws between an error notification and an
 * informational one, it is already semantic rather than decorative, and it
 * needs neither a role vocabulary nor an axis zero's `toast()` API could not
 * carry anyway (it takes `color`, not `axes`). So the bar reads it:
 * `$support-error` red when the toast asserts itself, the interactive blue
 * otherwise.
 *
 * It is a two-way signal where Carbon has four kinds — success and warning
 * are both `role="status"` and both stay blue. That is the honest ceiling of
 * what this design system currently declares, and it is stated here rather
 * than papered over.
 */
export const toast: RecipeInput = {
    component: 'toast',
    tokens: {
        '--toast-from': '8px',
        // The notification kind's colour, as one rebindable channel — the
        // shape every other accent in this package uses.
        '--toast-accent': 'var(--carbon-interactive)',
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
                // The UA hides closed popovers by unsetting display — an
                // unconditional `display: flex` would defeat that.
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
        // Carbon's notification: a $layer-01 surface under an overlay shadow,
        // square, with the 3px inset-start accent bar. Presence is
        // runtime-managed (toasts must eventually unmount), so this is a
        // plain two-state transition — no `@starting-style`.
        root: {
            base: {
                pointerEvents: 'auto',
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                alignItems: 'center',
                columnGap: 'var(--space-md)',
                padding: 'var(--space-md)',
                background: 'var(--color-base-200)',
                color: 'var(--color-base-content)',
                border: 'var(--border) solid var(--carbon-line)',
                borderInlineStart: '3px solid var(--toast-accent)',
                borderRadius: 'var(--radius-box)',
                boxShadow: 'var(--shadow-lg)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                letterSpacing: 'var(--tracking-wide)',
                lineHeight: 'var(--leading-tight)',
                opacity: '0',
                transform: 'translateY(var(--toast-from))',
                transition: motion('opacity, transform'),
            },
            selectors: {
                // The kind, read off the ARIA semantics zero already renders
                // (see the note above the recipe): an assertive toast is an
                // error notification and takes $support-error; a polite one
                // stays informational. `role` is the runtime's own attribute,
                // not a styling hook this recipe invented — every toast root
                // carries one of these two, always.
                '&[role="alert"]': { '--toast-accent': 'var(--carbon-danger)' },
                '&[data-placement^="top"]': { '--toast-from': '-8px' },
            },
            states: {
                open: { opacity: '1', transform: 'none' },
                closed: {},
            },
            at: {
                'reduced-motion': { base: { transition: 'none' }, states: { open: { transform: 'none' } } },
                // Forced palettes drop border colours to the system's; the
                // bar survives as a bar, but the kind does not survive as a
                // colour. `role` is what AT reads anyway, so nothing the
                // stylesheet could add here would tell them apart honestly.
                'forced-colors': { base: { borderInlineStartColor: 'CanvasText' } },
            },
        },
        title: {
            base: { gridColumn: '1', fontWeight: 'var(--weight-semibold)' },
        },
        description: {
            base: {
                gridColumn: '1',
                fontSize: 'var(--text-sm)',
                color: 'color-mix(in oklab, var(--color-base-content) 78%, transparent)',
            },
        },
        action: {
            base: {
                appearance: 'none',
                gridColumn: '2',
                gridRow: '1',
                border: 'none',
                background: 'transparent',
                padding: 'var(--space-2xs) var(--space-sm)',
                font: 'inherit',
                fontSize: 'var(--text-sm)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'var(--carbon-interactive)',
                cursor: 'pointer',
                transition: motion('background, color'),
            },
            states: {
                // Ink washes — the toast surface is already base-200.
                hover: { background: layerHover },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': {
                    background: layerActive,
                    color: pressedInteractiveInk,
                },
            },
        },
        close: {
            base: {
                appearance: 'none',
                gridColumn: '3',
                gridRow: '1',
                border: 'none',
                background: 'transparent',
                padding: 'var(--space-2xs) var(--space-xs)',
                font: 'inherit',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-base-content)',
                cursor: 'pointer',
                transition: motion('background'),
            },
            states: {
                hover: { background: layerHover },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: layerActive },
            },
        },
    },
    variants: {
        // Size moves the notification's box and type — never the accent bar
        // or the kind. (There is no colour axis: `roles: {}`; the accent is
        // keyed off the runtime's own `role` attribute above.)
        size: {
            sm: {
                root: { base: { padding: 'var(--space-sm)', fontSize: 'var(--text-xs)' } },
                description: { base: { fontSize: 'var(--text-xs)' } },
            },
            // `md` is the un-attributed render — the base already IS the
            // middle step.
            md: {},
            lg: { root: { base: { padding: 'var(--space-lg)', fontSize: 'var(--text-md)' } } },
            xl: {
                root: { base: { padding: 'var(--space-xl)', fontSize: 'var(--text-md)' } },
                description: { base: { fontSize: 'var(--text-md)' } },
            },
            '2xl': {
                root: { base: { padding: 'var(--space-2xl)', fontSize: 'var(--text-lg)' } },
                description: { base: { fontSize: 'var(--text-md)' } },
            },
        },
    },
};

// ── Combobox ──────────────────────────────────────────────────────────────
export const combobox: RecipeInput = {
    component: 'combobox',
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column' },
        },
        // The field chrome (field-01) lives on the box wrapping input +
        // trigger; the inset ring draws here from the input's forwarded
        // focus-visible. Invalid is Carbon's 2px danger outline, same inset.
        control: {
            base: {
                ...field01,
                display: 'inline-flex',
                alignItems: 'center',
                minWidth: '12rem',
                minHeight: '2.5rem',
                color: 'var(--color-base-content)',
                transition: motion('background'),
            },
            states: {
                ...fieldHover,
                open: {},
                closed: {},
                invalid: { outline: '2px solid var(--carbon-danger)', outlineOffset: '-2px' },
                disabled: { opacity: 'var(--disabled-opacity)', borderBlockEndColor: 'transparent' },
                ...focusRing,
            },
        },
        input: {
            base: {
                flex: '1',
                minWidth: '0',
                appearance: 'none',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'inherit',
                font: 'inherit',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                padding: '0 var(--space-md)',
            },
            states: {
                disabled: { cursor: 'not-allowed' },
                readonly: {},
                open: {},
                closed: {},
                invalid: {},
                required: {},
            },
            selectors: {
                '&::placeholder': { color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)' },
            },
        },
        trigger: {
            base: {
                appearance: 'none',
                alignSelf: 'stretch',
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                padding: '0 var(--space-md)',
                cursor: 'pointer',
                transition: motion('background, transform'),
            },
            states: {
                open: { transform: 'rotate(180deg)' },
                closed: {},
                disabled: { cursor: 'not-allowed' },
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: layerActive },
            },
        },
        // A layer under an overlay shadow — no border, no padding: Carbon
        // menus are flush lists. Presence is the popup pattern: entry from
        // `@starting-style`, exit held open by the two allow-discrete
        // transitions (`overlay` is Chromium-only; elsewhere the exit
        // degrades to instant).
        popup: {
            base: {
                minWidth: '12rem',
                padding: '0',
                background: 'var(--color-base-200)',
                color: 'var(--color-base-content)',
                borderRadius: 'var(--radius-box)',
                boxShadow: 'var(--shadow-md)',
                opacity: '0',
                transform: 'translateY(-2px)',
                transition: 'opacity var(--duration-fast) var(--ease-standard), '
                    + 'transform var(--duration-fast) var(--ease-standard), '
                    + 'display var(--duration-fast) allow-discrete, '
                    + 'overlay var(--duration-fast) allow-discrete',
            },
            states: {
                open: { opacity: '1', transform: 'none' },
                closed: {},
            },
            at: {
                'starting-style': { states: { open: { opacity: '0', transform: 'translateY(-2px)' } } },
                'reduced-motion': { base: { transition: 'none' }, states: { open: { transform: 'none' } } },
            },
        },
        // The optgroup equivalent (#325) — the menu's group grammar.
        group: { base: {} },
        'group-label': {
            base: {
                padding: 'var(--space-xs) var(--space-md)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semibold)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'color-mix(in oklab, var(--color-base-content) 60%, transparent)',
            },
        },
        item: {
            base: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-md)',
                minHeight: '2.5rem',
                padding: '0 var(--space-md)',
                fontSize: 'var(--text-sm)',
                letterSpacing: 'var(--tracking-wide)',
                borderBlockEnd: 'var(--border) solid var(--carbon-line)',
                cursor: 'pointer',
                transition: motion('background'),
            },
            states: {
                highlighted: { background: layerHover },
                selected: { fontWeight: 'var(--weight-semibold)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
            selectors: {
                '&:last-child': { borderBlockEnd: 'none' },
                '&[data-pressed]:not([data-disabled])': { background: layerActive },
            },
        },
        'item-indicator': {
            base: { fontSize: 'var(--text-xs)', color: 'var(--carbon-interactive)' },
            states: { selected: {} },
        },
        empty: {
            base: {
                padding: 'var(--space-md)',
                fontSize: 'var(--text-sm)',
                color: 'color-mix(in oklab, var(--color-base-content) 55%, transparent)',
            },
        },
    },
    variants: {
        /** Carbon's five field heights: 32 / 40 / 48 / 64 / 80. */
        size: {
            sm: { control: { base: { minHeight: '2rem' } } },
            md: {},
            lg: { control: { base: { minHeight: '3rem' } } },
            xl: { control: { base: { minHeight: '4rem' } } },
            '2xl': { control: { base: { minHeight: '5rem' } } },
        },
    },
    // The visible ring lives on `control`; input and trigger delegate.
    skipStates: {
        input: ['focus-visible'],
        trigger: ['focus-visible'],
    },
};

// ── Toggle ────────────────────────────────────────────────────────────────
export const toggle: RecipeInput = {
    component: 'toggle',
    /**
     * A ghost button that holds a state — the on fill is the selected-layer
     * gray (base-300), not the interactive blue, matching Carbon's selected
     * icon buttons.
     */
    parts: {
        root: {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-xs)',
                minHeight: '2.5rem',
                padding: '0 var(--space-md)',
                background: 'transparent',
                color: 'var(--color-base-content)',
                border: 'none',
                borderRadius: 'var(--radius-field)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-normal)',
                letterSpacing: 'var(--tracking-wide)',
                lineHeight: 'var(--leading-tight)',
                cursor: 'pointer',
                transition: motion('background, color'),
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                on: { background: 'var(--color-base-300)' },
                off: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                // Hover on an on toggle must not fade toward the hover wash —
                // equal specificity, later in source, so on wins.
                '&[data-state="on"]:hover:not([data-disabled])': { background: 'var(--color-base-300)' },
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)' },
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { minHeight: '2rem', padding: '0 var(--space-sm)' } } },
            md: {},
            lg: { root: { base: { minHeight: '3rem' } } },
            xl: { root: { base: { minHeight: '4rem' } } },
            '2xl': { root: { base: { minHeight: '5rem' } } },
        },
    },
};

// ── Toggle group ──────────────────────────────────────────────────────────
export const toggleGroup: RecipeInput = {
    component: 'toggle-group',
    parts: {
        root: {
            // Flush — no outer frame; the items meet at hairlines, the same
            // language as Carbon's content-switcher row.
            base: { display: 'inline-flex' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
            selectors: {
                '&[data-orientation="vertical"]': { flexDirection: 'column' },
            },
        },
        item: {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-xs)',
                minHeight: '2.5rem',
                padding: '0 var(--space-md)',
                background: 'transparent',
                color: 'var(--color-base-content)',
                border: 'none',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-normal)',
                letterSpacing: 'var(--tracking-wide)',
                lineHeight: 'var(--leading-tight)',
                cursor: 'pointer',
                transition: motion('background, color'),
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                on: { background: 'var(--color-base-300)' },
                off: {},
                selected: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-state="on"]:hover:not([data-disabled])': { background: 'var(--color-base-300)' },
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)' },
                // The hairline separators between adjacent items.
                '&[data-orientation="horizontal"] + &': {
                    borderInlineStart: 'var(--border) solid var(--carbon-line)',
                },
                '&[data-orientation="vertical"] + &': {
                    borderBlockStart: 'var(--border) solid var(--carbon-line)',
                },
            },
        },
    },
    variants: {
        // The group is flush around its items, so the ramp lands on the items
        // and the row follows their box.
        size: {
            sm: { item: { base: { minHeight: '2rem', padding: '0 var(--space-sm)' } } },
            md: {},
            lg: { item: { base: { minHeight: '3rem' } } },
            xl: { item: { base: { minHeight: '4rem' } } },
            '2xl': { item: { base: { minHeight: '5rem' } } },
        },
    },
};

// ── Number input ──────────────────────────────────────────────────────────
export const numberInput: RecipeInput = {
    component: 'number-input',
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-2xs)' },
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        },
        label: {
            base: { ...fieldLabel },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                invalid: { color: 'var(--carbon-danger)' },
                required: {},
            },
        },
        // The field chrome (field-01, the combobox split): the inset ring and
        // the invalid outline draw on the box, input and steppers sit inside.
        control: {
            base: {
                ...field01,
                display: 'inline-flex',
                alignItems: 'stretch',
                minHeight: '2.5rem',
                color: 'var(--color-base-content)',
                transition: motion('background'),
            },
            states: {
                ...fieldHover,
                invalid: { outline: '2px solid var(--carbon-danger)', outlineOffset: '-2px' },
                disabled: { opacity: 'var(--disabled-opacity)', borderBlockEndColor: 'transparent' },
                readonly: {},
                ...focusRing,
            },
        },
        input: {
            base: {
                width: '6rem',
                minWidth: '0',
                appearance: 'none',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'inherit',
                font: 'inherit',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                padding: '0 var(--space-md)',
            },
            states: {
                disabled: { cursor: 'not-allowed' },
                readonly: {},
                invalid: {},
                required: {},
            },
            selectors: {
                '&::placeholder': { color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)' },
            },
        },
        // Square ghost steppers, separated from the readout (and each other)
        // by hairline dividers — Carbon's [input | − | +] row.
        'increment-trigger': {
            base: {
                appearance: 'none',
                border: 'none',
                borderInlineStart: 'var(--border) solid var(--carbon-line)',
                background: 'transparent',
                color: 'inherit',
                width: '2.5rem',
                cursor: 'pointer',
                userSelect: 'none',
                transition: motion('background'),
            },
            states: {
                hover: { background: 'var(--color-base-300)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)', filter: 'brightness(0.9)' },
            },
        },
        'decrement-trigger': {
            base: {
                appearance: 'none',
                border: 'none',
                borderInlineStart: 'var(--border) solid var(--carbon-line)',
                background: 'transparent',
                color: 'inherit',
                width: '2.5rem',
                cursor: 'pointer',
                userSelect: 'none',
                transition: motion('background'),
            },
            states: {
                hover: { background: 'var(--color-base-300)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)', filter: 'brightness(0.9)' },
            },
        },
    },
    variants: {
        /** Carbon's five field heights: 32 / 40 / 48 / 64 / 80. */
        size: {
            sm: { control: { base: { minHeight: '2rem' } } },
            md: {},
            lg: { control: { base: { minHeight: '3rem' } } },
            xl: { control: { base: { minHeight: '4rem' } } },
            '2xl': { control: { base: { minHeight: '5rem' } } },
        },
    },
    // The visible ring lives on `control`; the input delegates.
    skipStates: { input: ['focus-visible'] },
};

export const ratingGroup: RecipeInput = {
    component: 'rating-group',
    /**
     * The mark's box — the size ramp only rebinds it. A *fixed* text step:
     * the mark is drawn, not typeset, so it is control chrome and must not
     * grow with in-app text scaling.
     */
    tokens: { '--rating-size': 'var(--text-fixed-xl)' },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-2xs)' },
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        },
        label: {
            base: { ...fieldLabel },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                invalid: { color: 'var(--carbon-danger)' },
                required: {},
            },
        },
        control: {
            // A wider gutter than the glyph row needed: solid squares that
            // touch read as one block, so the marks get 4px of air.
            base: { display: 'inline-flex', gap: 'var(--space-xs)' },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                readonly: {},
                ...focusRing,
            },
        },
        /**
         * Carbon has no rating component, so the symbol is this design
         * system's own: the square it uses for every selection control, at
         * the same 2px stroke, filling from the inline start.
         *
         * That is also the only honest way to render `half` — the runtime's
         * fallback text is `★`/`★`/`☆`: the half-star codepoint `⯪` (U+2BEA) is
         * in neither IBM Plex Sans nor most system fonts, so zero renders a full
         * star for a half value and leaves the halving to the skin (#222). A
         * tinted glyph would therefore say `full`. A geometric fill can stop
         * dead centre, so it does: `scale` on the fill, `transform-origin` at
         * the inline start, one moderate-01 wipe that follows the pointer across
         * halves.
         *
         * The glyph is collapsed (`font-size: 0`) rather than tinted — it is
         * a fallback symbol this recipe replaces. A consumer supplying its own
         * symbol through the item slot should style it itself.
         */
        item: {
            base: {
                position: 'relative',
                display: 'inline-block',
                width: 'var(--rating-size)',
                height: 'var(--rating-size)',
                fontSize: '0',
                color: 'transparent',
                cursor: 'pointer',
                userSelect: 'none',
            },
            states: {
                full: {},
                half: {},
                empty: {},
                highlighted: {},
                disabled: { cursor: 'not-allowed' },
                readonly: { cursor: 'default' },
                /**
                 * The group ring lives on control; per-item focus still gets
                 * its own marker for the value-following tab stop.
                 *
                 * The one place this package rings OUTSIDE the box: the mark
                 * fills its box edge to edge, so Carbon's inset ring would be
                 * blue on the blue fill of exactly the item most likely to
                 * have focus.
                 */
                'focus-visible': { outline: '2px solid var(--carbon-focus)', outlineOffset: '1px' },
            },
            selectors: {
                // The empty box: Carbon's assertive stroke, not the hairline —
                // `--carbon-line` is a 1.1:1 divider tone and a mark has to be
                // seen. It doubles as the hover-preview channel.
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: '0',
                    border: '2px solid var(--carbon-border-strong)',
                    transition: motion('border-color'),
                },
                // The fill. Every state sets its own `scale`, so there is no
                // resting value to inherit — `data-state` is always one of the
                // three.
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    inset: '0',
                    background: 'var(--carbon-interactive)',
                    transformOrigin: 'left',
                    transition: 'scale var(--duration-slow) var(--ease-standard)',
                },
                // `scale`, not `clip-path`, so the wipe can start from the
                // inline start in both directions.
                [`&${rtl}::after`]: { transformOrigin: 'right' },
                '&[data-state="empty"]::after': { scale: '0 1' },
                '&[data-state="half"]::after': { scale: '0.5 1' },
                '&[data-state="full"]::after': { scale: '1 1' },
                '&[data-highlighted]::before': { borderColor: 'var(--carbon-interactive)' },
            },
            at: {
                // A fill is meaning here — half of it is the whole point — so
                // both fallbacks keep the geometry and re-source its paint
                // rather than swapping in a glyph that cannot say "half":
                // the forced palette's own ink, and an explicit instruction to
                // print the fill that `print-color-adjust: economy` would drop.
                'forced-colors': {
                    selectors: {
                        '&::before': { borderColor: 'CanvasText' },
                        '&::after': { background: 'CanvasText' },
                    },
                },
                // The mark is background paint, which paper drops by default;
                // `exact` asks for it back. A reader who disables background
                // graphics can still refuse, and the row prints blank rather
                // than misstating the value — glyph ink would survive it, #230.
                print: {
                    selectors: {
                        '&::before': { printColorAdjust: 'exact' },
                        '&::after': { printColorAdjust: 'exact' },
                    },
                },
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--rating-size': 'var(--text-fixed-md)' } } },
            md: {},
            lg: { root: { base: { '--rating-size': 'var(--text-fixed-2xl)' } } },
            // The fixed scale stops at `3xl`, so the last step continues it
            // by the same ratio rather than minting a token the scale does
            // not have.
            xl: { root: { base: { '--rating-size': 'var(--text-fixed-3xl)' } } },
            '2xl': { root: { base: { '--rating-size': 'calc(var(--text-fixed-3xl) * 1.25)' } } },
        },
    },
};

// ── Tree view ─────────────────────────────────────────────────────────────
export const treeView: RecipeInput = {
    component: 'tree-view',
    tokens: { '--tree-text': 'var(--text-sm)' },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2xs)' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
        },
        label: {
            base: {
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
                letterSpacing: 'var(--tracking-wide)',
            },
        },
        tree: {
            base: { display: 'flex', flexDirection: 'column', fontSize: 'var(--tree-text)' },
        },
        // Indentation comes from branch-content's inline padding — depth is
        // the DOM nesting, no per-level rules needed.
        item: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-xs)',
                minHeight: '2rem',
                padding: '0 var(--space-sm)',
                // The selection accent is a border, not a fill — keep the
                // slot reserved so rows never shift when it lights up.
                borderInlineStart: '3px solid transparent',
                cursor: 'pointer',
                transition: motion('background, border-color'),
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                selected: {
                    background: 'var(--color-base-300)',
                    borderInlineStartColor: 'var(--carbon-interactive)',
                },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                // Hover on a selected row must not fade toward the hover wash.
                '&[data-selected]:hover:not([data-disabled])': { background: 'var(--color-base-300)' },
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)' },
            },
        },
        branch: {
            base: { display: 'flex', flexDirection: 'column', outline: 'none' },
            states: { open: {}, closed: {}, selected: {}, disabled: {} },
        },
        'branch-trigger': {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-xs)',
                minHeight: '2rem',
                padding: '0 var(--space-sm)',
                borderInlineStart: '3px solid transparent',
                cursor: 'pointer',
                userSelect: 'none',
                transition: motion('background, border-color'),
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                open: {},
                closed: {},
                selected: {
                    background: 'var(--color-base-300)',
                    borderInlineStartColor: 'var(--carbon-interactive)',
                },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-selected]:hover:not([data-disabled])': { background: 'var(--color-base-300)' },
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)' },
            },
        },
        'branch-indicator': {
            base: {
                display: 'inline-block',
                // The token duration collapses under reduced motion — no
                // extra `at` block needed.
                transition: 'transform var(--duration-fast) var(--ease-standard)',
            },
            states: { open: { transform: 'rotate(90deg)' }, closed: {} },
            // The glyph is element text the runtime renders (`TreeView.tsx`), not
            // `content:`, so the `:dir(rtl)` swap the submenu chevron uses is not
            // available here — a mirror is its equivalent. `scale` composes
            // OUTSIDE `transform` (and outside the individual `rotate`), so the
            // closed glyph flips to point at the reading end while the open one,
            // already rotated to point down, is unaffected by a horizontal flip.
            selectors: { [`&${rtl}`]: { scale: '-1 1' } },
        },
        'branch-content': {
            base: { display: 'flex', flexDirection: 'column', paddingInlineStart: 'var(--space-md)' },
            states: { open: {}, closed: {} },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--tree-text': 'var(--text-xs)' } } },
            // `md` is the un-attributed render: `--tree-text`'s default in
            // `tokens:` already IS the middle step.
            md: {},
            lg: { root: { base: { '--tree-text': 'var(--text-md)' } } },
            xl: { root: { base: { '--tree-text': 'var(--text-lg)' } } },
            '2xl': { root: { base: { '--tree-text': 'var(--text-xl)' } } },
        },
    },
};

// ── Text fields ───────────────────────────────────────────────────────────
/**
 * Carbon's text input: `field-01` — a filled well with a single strong rule
 * under it, no side or top borders. The inset focus ring and the invalid
 * outline draw on the box, the same way the number input, the select and the
 * combobox do it, and the five Carbon field heights ride `minHeight` on the
 * control. No `color` axis: this design system declares no colour roles.
 */
export const input: RecipeInput = {
    component: 'input',
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-2xs)' },
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        },
        label: {
            base: { ...fieldLabel },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                invalid: { color: 'var(--carbon-danger)' },
                required: {},
            },
        },
        control: {
            base: {
                ...field01,
                display: 'inline-flex',
                alignItems: 'stretch',
                minHeight: '2.5rem',
                color: 'var(--color-base-content)',
                transition: motion('background'),
            },
            states: {
                ...fieldHover,
                invalid: { outline: '2px solid var(--carbon-danger)', outlineOffset: '-2px' },
                disabled: { opacity: 'var(--disabled-opacity)', borderBlockEndColor: 'transparent' },
                readonly: {},
                ...focusRing,
            },
        },
        input: {
            base: {
                width: '100%',
                minWidth: '0',
                appearance: 'none',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'inherit',
                font: 'inherit',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                padding: '0 var(--space-md)',
            },
            states: {
                disabled: { cursor: 'not-allowed' },
                readonly: {},
                invalid: {},
                required: {},
            },
            selectors: {
                '&::placeholder': { color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)' },
            },
        },
    },
    variants: {
        /** Carbon's five field heights: 32 / 40 / 48 / 64 / 80. */
        size: {
            sm: { control: { base: { minHeight: '2rem' } } },
            md: {},
            lg: { control: { base: { minHeight: '3rem' } } },
            xl: { control: { base: { minHeight: '4rem' } } },
            '2xl': { control: { base: { minHeight: '5rem' } } },
        },
    },
    // The visible ring lives on `control`; the input delegates.
    skipStates: { input: ['focus-visible'] },
};

/**
 * Carbon's text area: the same `field-01` well, drawn on the element (the
 * anatomy has no `control`). The size ramp moves the FLOOR rather than the
 * height — a text area's height is the reader's, which is what `resize` is
 * for; Carbon's own text area ships a `rows`-driven default and a resize
 * handle for the same reason.
 */
export const textarea: RecipeInput = {
    component: 'textarea',
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-2xs)' },
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        },
        label: {
            base: { ...fieldLabel },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                invalid: { color: 'var(--carbon-danger)' },
                required: {},
            },
        },
        textarea: {
            base: {
                ...field01,
                display: 'block',
                width: '100%',
                minWidth: '0',
                minHeight: '5rem',
                appearance: 'none',
                color: 'var(--color-base-content)',
                font: 'inherit',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                lineHeight: 'var(--leading-normal)',
                padding: 'var(--space-sm) var(--space-md)',
                resize: 'vertical',
                transition: motion('background'),
            },
            states: {
                ...fieldHover,
                invalid: { outline: '2px solid var(--carbon-danger)', outlineOffset: '-2px' },
                disabled: { opacity: 'var(--disabled-opacity)', borderBlockEndColor: 'transparent', cursor: 'not-allowed' },
                readonly: {},
                required: {},
                ...focusRing,
            },
            selectors: {
                '&::placeholder': { color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)' },
            },
        },
    },
    variants: {
        size: {
            sm: { textarea: { base: { minHeight: '4rem' } } },
            md: {},
            lg: { textarea: { base: { minHeight: '6rem' } } },
            xl: { textarea: { base: { minHeight: '8rem' } } },
            '2xl': { textarea: { base: { minHeight: '10rem' } } },
        },
    },
};

// ── Content tier (#311) ───────────────────────────────────────────────────
/**
 * Carbon's tile: a layer surface, square corners, no shadow — depth here is
 * the layer ramp, not elevation. No `color` axis (`roles: {}`), so the five
 * Carbon steps are the only ramp these four carry.
 */
export const card: RecipeInput = {
    component: 'card',
    tokens: { '--card-pad': 'var(--space-lg)' },
    parts: {
        root: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--color-base-200)',
                color: 'var(--color-base-content)',
                border: 'var(--border) solid var(--carbon-line)',
                borderRadius: 'var(--radius-box)',
                overflow: 'hidden',
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
        title: {
            base: {
                margin: '0',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--weight-semibold)',
                letterSpacing: 'var(--tracking-wide)',
                lineHeight: 'var(--leading-tight)',
            },
        },
        description: {
            base: {
                margin: '0',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                color: 'color-mix(in oklab, var(--color-base-content) 78%, transparent)',
            },
        },
        body: {
            base: {
                padding: 'var(--card-pad)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                lineHeight: 'var(--leading-normal)',
            },
        },
        footer: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                padding: '0 var(--card-pad) var(--card-pad)',
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--card-pad': 'var(--space-md)' } } },
            md: {},
            lg: { root: { base: { '--card-pad': 'var(--space-xl)' } } },
            xl: { root: { base: { '--card-pad': 'var(--space-2xl)' } } },
            '2xl': { root: { base: { '--card-pad': 'var(--space-2xl)' } } },
        },
    },
};

/**
 * Carbon's inline notification: the 3px status rule on the reading edge over
 * a layer fill, square corners, and the text left where the layer put it.
 */
export const alert: RecipeInput = {
    component: 'alert',
    parts: {
        root: {
            base: {
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'start',
                gap: 'var(--space-2xs) var(--space-md)',
                background: 'var(--color-base-200)',
                color: 'var(--color-base-content)',
                borderRadius: 'var(--radius-box)',
                borderInlineStart: '3px solid var(--carbon-danger)',
                padding: 'var(--space-md) var(--space-lg)',
            },
            states: { open: {}, closed: {} },
        },
        icon: {
            base: {
                gridRow: '1 / span 2',
                display: 'inline-flex',
                alignItems: 'center',
                color: 'var(--carbon-danger)',
                fontSize: 'var(--text-md)',
                lineHeight: 'var(--leading-none)',
            },
        },
        title: {
            base: {
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
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
                borderRadius: '0',
                padding: 'var(--space-2xs)',
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
                transition: motion('background'),
            },
            states: {
                hover: { background: layerHover },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: { '&[data-pressed]:not([data-disabled])': { background: layerActive } },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { padding: 'var(--space-sm) var(--space-md)' } } },
            md: {},
            lg: { root: { base: { padding: 'var(--space-lg) var(--space-xl)' } } },
            xl: { root: { base: { padding: 'var(--space-xl) var(--space-2xl)' } } },
            '2xl': { root: { base: { padding: 'var(--space-2xl)' } } },
        },
    },
};

/** Carbon's tag: a square-cornered chip on the layer above the surface. */
export const badge: RecipeInput = {
    component: 'badge',
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375em',
                background: 'var(--color-base-300)',
                color: 'var(--color-base-content)',
                border: 'var(--border) solid transparent',
                borderRadius: 'var(--radius-selector)',
                padding: '0 var(--space-md)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                lineHeight: 'var(--leading-normal)',
                whiteSpace: 'nowrap',
                textDecoration: 'none',
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { fontSize: 'var(--text-xs)', padding: '0 var(--space-sm)' } } },
            md: {},
            lg: { root: { base: { fontSize: 'var(--text-sm)', padding: '0 var(--space-lg)' } } },
            xl: { root: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-2xs) var(--space-xl)' } } },
            '2xl': { root: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-xs) var(--space-2xl)' } } },
        },
    },
};

/** Carbon's divider: the hairline every field and menu here is drawn with. */
export const divider: RecipeInput = {
    component: 'divider',
    tokens: { '--divider-thickness': 'var(--border)' },
    parts: {
        root: {
            base: { border: 'none', background: 'var(--carbon-line)', alignSelf: 'stretch' },
            selectors: {
                '&[data-orientation="horizontal"]': {
                    inlineSize: '100%',
                    blockSize: 'var(--divider-thickness)',
                },
                '&[data-orientation="vertical"]': {
                    inlineSize: 'var(--divider-thickness)',
                    minBlockSize: '1em',
                },
            },
        },
    },
    variants: {
        // No `color` axis: this design system declares `roles: {}`, so a
        // divider has exactly one ink and the ramp moves its weight alone.
        size: {
            sm: { root: { base: { '--divider-thickness': 'var(--border)' } } },
            md: {},
            lg: { root: { base: { '--divider-thickness': 'calc(var(--border) * 2)' } } },
            xl: { root: { base: { '--divider-thickness': 'calc(var(--border) * 3)' } } },
            '2xl': { root: { base: { '--divider-thickness': 'calc(var(--border) * 4)' } } },
        },
    },
};

// ── Loading (#314) ────────────────────────────────────────────────────────
/**
 * Skeleton — see zero-basic's for the shared reasoning: children stay in the
 * DOM, `loading` blanks them with `color: transparent`, the loop STOPS under
 * reduced motion rather than speeding up, and the static fallback is a flat
 * fill that still reads as "not content yet".
 *
 * No `color` axis: this design system declares `roles: {}`, so the size ramp
 * is the only one these two carry.
 */
export const skeleton: RecipeInput = {
    component: 'skeleton',
    tokens: { '--skeleton-fill': 'var(--color-base-300)' },
    parts: {
        root: {
            base: { borderRadius: 'var(--radius-box)' },
            states: {
                loading: {
                    color: 'transparent',
                    background: 'var(--skeleton-fill)',
                    animation: 'zero-carbon-skeleton 1.6s ease-in-out infinite',
                    userSelect: 'none',
                    pointerEvents: 'none',
                },
                loaded: {},
            },
            at: { 'reduced-motion': { states: { loading: { animation: 'none' } } } },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { borderRadius: 'var(--radius-selector)' } } },
            md: {},
            lg: { root: { base: { borderRadius: 'var(--radius-box)' } } },
            xl: { root: { base: { borderRadius: 'var(--radius-box)' } } },
            '2xl': { root: { base: { borderRadius: 'var(--radius-box)' } } },
        },
    },
    keyframes: { 'zero-carbon-skeleton': 'from, to { opacity: 1; } 50% { opacity: 0.55; }' },
};

/**
 * Spinner — a ring with one segment in the ink, turning. Borders rather than a
 * gradient so it survives `forced-colors`. Under reduced motion it STOPS; the
 * inked segment is what carries the meaning standing still.
 */
export const spinner: RecipeInput = {
    component: 'spinner',
    tokens: {
        '--spinner-size': 'calc(var(--size-field) * 0.5)',
        '--spinner-ink': 'var(--carbon-interactive)',
        '--spinner-track': 'var(--carbon-line)',
    },
    parts: {
        root: {
            base: {
                display: 'inline-block',
                inlineSize: 'var(--spinner-size)',
                blockSize: 'var(--spinner-size)',
                boxSizing: 'border-box',
                borderRadius: '50%',
                border: 'calc(var(--border) * 2) solid var(--spinner-track)',
                borderBlockStartColor: 'var(--spinner-ink)',
                animation: 'zero-carbon-spin 0.7s linear infinite',
            },
            at: { 'reduced-motion': { base: { animation: 'none' } } },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--spinner-size': 'calc(var(--size-field) * 0.4)' } } },
            md: {},
            lg: { root: { base: { '--spinner-size': 'calc(var(--size-field) * 0.7)' } } },
            xl: { root: { base: { '--spinner-size': 'calc(var(--size-field) * 0.9)' } } },
            '2xl': { root: { base: { '--spinner-size': 'var(--size-field)' } } },
        },
    },
    keyframes: { 'zero-carbon-spin': 'to { transform: rotate(360deg); }' },
};

// ── The content-tier sweep (#334) ─────────────────────────────────────────
/**
 * Carbon kbd: IBM Plex Mono in a sharp-cornered field-tone chip — the same
 * layer-line grammar every field here uses, at glyph scale. No colour axis;
 * the fused `kind` vocabulary stays Button-only (#183).
 */
export const kbd: RecipeInput = {
    component: 'kbd',
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minInlineSize: '1.75em',
                padding: '0 var(--space-sm)',
                background: 'var(--color-base-200)',
                color: 'var(--color-base-content)',
                border: 'var(--border) solid var(--carbon-line)',
                borderRadius: '0',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                lineHeight: 'var(--leading-normal)',
                whiteSpace: 'nowrap',
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { fontSize: 'var(--text-xs)', padding: '0 var(--space-xs)', minInlineSize: '1.5em' } } },
            md: {},
            lg: { root: { base: { fontSize: 'var(--text-sm)', padding: '0 var(--space-md)' } } },
            xl: { root: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-2xs) var(--space-lg)' } } },
            '2xl': { root: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-xs) var(--space-xl)' } } },
        },
    },
};

/**
 * Status — Carbon's status indicators are filled circles in the alert
 * palette; the default is the interactive blue. Border in the same ink for
 * `forced-colors`, where the fill drops and the ring stays.
 */
export const status: RecipeInput = {
    component: 'status',
    tokens: {
        '--status-ink': 'var(--carbon-interactive)',
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
        size: {
            sm: { root: { base: { '--status-size': 'calc(var(--size-selector) * 2)' } } },
            md: {},
            lg: { root: { base: { '--status-size': 'calc(var(--size-selector) * 3)' } } },
            xl: { root: { base: { '--status-size': 'calc(var(--size-selector) * 3.5)' } } },
            '2xl': { root: { base: { '--status-size': 'calc(var(--size-selector) * 4)' } } },
        },
    },
};

/**
 * Indicator — pure position; the item's content brings its own paint. Size
 * moves the type scale a bare-text item renders at.
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
        size: {
            sm: { item: { base: { fontSize: 'var(--text-xs)' } } },
            md: {},
            lg: { item: { base: { fontSize: 'var(--text-md)' } } },
            xl: { item: { base: { fontSize: 'var(--text-lg)' } } },
            '2xl': { item: { base: { fontSize: 'var(--text-xl)' } } },
        },
    },
};

/** Carbon stats: the layer surface, hairline joins, IBM Plex numerals. */
export const stats: RecipeInput = {
    component: 'stats',
    parts: {
        root: {
            base: {
                display: 'flex',
                background: 'var(--color-base-200)',
                border: 'var(--border) solid var(--carbon-line)',
                borderRadius: '0',
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
                    borderInlineStart: 'var(--border) solid var(--carbon-line)',
                },
                '&[data-orientation="vertical"] + &': {
                    borderBlockStart: 'var(--border) solid var(--carbon-line)',
                },
            },
        },
        title: {
            base: {
                gridColumn: '1',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
            },
        },
        value: {
            base: {
                gridColumn: '1',
                fontSize: 'var(--text-2xl)',
                fontWeight: 'var(--weight-normal)',
                fontVariantNumeric: 'tabular-nums',
            },
        },
        desc: {
            base: {
                gridColumn: '1',
                fontSize: 'var(--text-xs)',
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
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
        size: {
            sm: { value: { base: { fontSize: 'var(--text-xl)' } } },
            md: {},
            lg: { value: { base: { fontSize: 'var(--text-3xl)' } } },
            xl: { value: { base: { fontSize: 'var(--text-3xl)' } } },
            '2xl': { value: { base: { fontSize: 'var(--text-3xl)', letterSpacing: 'var(--tracking-tight)' } } },
        },
    },
};

/** Carbon timeline: the layer-line grammar along an axis. */
export const timeline: RecipeInput = {
    component: 'timeline',
    tokens: { '--timeline-marker-size': 'calc(var(--size-selector) * 3)' },
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
                '&[data-orientation="horizontal"]': { flexDirection: 'row' },
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
            },
        },
        marker: {
            base: {
                inlineSize: 'var(--timeline-marker-size)',
                blockSize: 'var(--timeline-marker-size)',
                boxSizing: 'border-box',
                borderRadius: '50%',
                background: 'var(--carbon-interactive)',
                border: 'calc(var(--timeline-marker-size) / 2) solid var(--carbon-interactive)',
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
                background: 'var(--carbon-border-strong)',
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
                padding: 'var(--space-xs) var(--space-md)',
                fontSize: 'var(--text-sm)',
                background: 'var(--color-base-200)',
                border: 'var(--border) solid var(--carbon-line)',
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
    },
    variants: {
        size: {
            sm: { marker: { base: { '--timeline-marker-size': 'calc(var(--size-selector) * 2.5)' } }, content: { base: { fontSize: 'var(--text-xs)' } } },
            md: {},
            lg: { marker: { base: { '--timeline-marker-size': 'calc(var(--size-selector) * 3.5)' } }, content: { base: { fontSize: 'var(--text-md)' } } },
            xl: { marker: { base: { '--timeline-marker-size': 'calc(var(--size-selector) * 4)' } }, content: { base: { fontSize: 'var(--text-md)' } } },
            '2xl': { marker: { base: { '--timeline-marker-size': 'calc(var(--size-selector) * 4.5)' } }, content: { base: { fontSize: 'var(--text-lg)' } } },
        },
    },
};

/** Carbon chat: layer-tone blocks, sharp corners, hairline joins. */
export const chat: RecipeInput = {
    component: 'chat',
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
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
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
                background: 'var(--color-base-200)',
                color: 'var(--color-base-content)',
                border: 'var(--border) solid var(--carbon-line)',
                borderRadius: '0',
            },
            selectors: {
                '[data-scope="chat"][data-part="root"][data-placement="start"] > &': {
                    gridColumn: '2',
                },
                '[data-scope="chat"][data-part="root"][data-placement="end"] > &': {
                    gridColumn: '1',
                },
            },
        },
        footer: {
            base: {
                fontSize: 'var(--text-xs)',
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
            },
            selectors: {
                '[data-scope="chat"][data-part="root"][data-placement="start"] > &': { gridColumn: '2' },
                '[data-scope="chat"][data-part="root"][data-placement="end"] > &': { gridColumn: '1' },
            },
        },
    },
    variants: {
        size: {
            sm: { bubble: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-xs) var(--space-md)' } } },
            md: {},
            lg: { bubble: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-md) var(--space-lg)' } } },
            xl: { bubble: { base: { fontSize: 'var(--text-lg)', padding: 'var(--space-md) var(--space-xl)' } } },
            '2xl': { bubble: { base: { fontSize: 'var(--text-lg)', padding: 'var(--space-lg) var(--space-2xl)' } } },
        },
    },
};

/** Carbon radial: interactive-blue arc; complete goes the toggle green. */
export const radialProgress: RecipeInput = {
    component: 'radial-progress',
    tokens: {
        '--radial-size': 'calc(var(--size-selector) * 16)',
        '--radial-thickness': 'calc(var(--size-selector) * 1.5)',
        '--radial-ink': 'var(--carbon-interactive)',
        '--radial-track': 'var(--color-base-300)',
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
                complete: { '--radial-ink': 'var(--carbon-toggle-on)' },
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
                    animation: 'zero-carbon-radial-spin 1.2s linear infinite',
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
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
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
        size: {
            sm: { root: { base: { '--radial-size': 'calc(var(--size-selector) * 13)', '--radial-thickness': 'calc(var(--size-selector) * 1.25)' } } },
            md: {},
            lg: { root: { base: { '--radial-size': 'calc(var(--size-selector) * 20)', '--radial-thickness': 'calc(var(--size-selector) * 2)' } } },
            xl: { root: { base: { '--radial-size': 'calc(var(--size-selector) * 24)', '--radial-thickness': 'calc(var(--size-selector) * 2.5)' } } },
            '2xl': { root: { base: { '--radial-size': 'calc(var(--size-selector) * 28)', '--radial-thickness': 'calc(var(--size-selector) * 3)' } } },
        },
    },
    keyframes: { 'zero-carbon-radial-spin': 'to { transform: rotate(360deg); }' },
};

/**
 * Join — inner corners squared, seams folded to one border; the joined
 * controls keep their own chrome. Colour/size wire as on indicator: the
 * wrapper has no paint of its own.
 */
export const join: RecipeInput = {
    component: 'join',
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                alignItems: 'stretch',
            },
            selectors: {
                '&[data-orientation="vertical"]': { flexDirection: 'column' },
            },
        },
        /**
         * The collapse itself: inner corners squared, one shared seam. All
         * logical (border-*-radius longhands, margin-inline/block), so the
         * group mirrors under RTL untouched. `:focus-within` and
         * `:focus-visible` raise the segment so a ring is not clipped by the
         * seam overlap.
         */
        item: {
            base: {
                position: 'relative',
            },
            selectors: {
                // Each corner rule lands on the item AND its direct child:
                // asChild puts the item attributes on the control itself, but
                // in wrapper mode the control is the child, and a wrapper
                // cannot collapse a radius it does not carry.
                '&[data-orientation="horizontal"]:not(:first-child), &[data-orientation="horizontal"]:not(:first-child) > *': {
                    borderStartStartRadius: '0',
                    borderEndStartRadius: '0',
                },
                '&[data-orientation="horizontal"]:not(:first-child)': {
                    marginInlineStart: 'calc(var(--border) * -1)',
                },
                '&[data-orientation="horizontal"]:not(:last-child), &[data-orientation="horizontal"]:not(:last-child) > *': {
                    borderStartEndRadius: '0',
                    borderEndEndRadius: '0',
                },
                '&[data-orientation="vertical"]:not(:first-child), &[data-orientation="vertical"]:not(:first-child) > *': {
                    borderStartStartRadius: '0',
                    borderStartEndRadius: '0',
                },
                '&[data-orientation="vertical"]:not(:first-child)': {
                    marginBlockStart: 'calc(var(--border) * -1)',
                },
                '&[data-orientation="vertical"]:not(:last-child), &[data-orientation="vertical"]:not(:last-child) > *': {
                    borderEndStartRadius: '0',
                    borderEndEndRadius: '0',
                },
                '&:focus-within': { zIndex: '1' },
                '&:focus-visible': { zIndex: '1' },
            },
        },
    },
    variants: {
        size: {
            sm: { item: { base: { fontSize: 'var(--text-xs)' } } },
            md: {},
            lg: { item: { base: { fontSize: 'var(--text-md)' } } },
            xl: { item: { base: { fontSize: 'var(--text-lg)' } } },
            '2xl': { item: { base: { fontSize: 'var(--text-xl)' } } },
        },
    },
};

/**
 * Navbar — Carbon's UI Shell header: a flat 3rem band on the shell surface
 * with a single line under it, square everywhere. Size-only: this design
 * system declares no colour axis.
 */
export const navbar: RecipeInput = {
    component: 'navbar',
    parts: {
        root: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                minBlockSize: '3rem',
                paddingInline: 'var(--space-md)',
                background: 'var(--color-base-200)',
                color: 'var(--color-base-content)',
                borderBlockEnd: 'var(--border) solid var(--carbon-line)',
                borderRadius: '0',
            },
        },
        start: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                flex: '1 1 0%',
                justifyContent: 'flex-start',
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
        size: {
            sm: { root: { base: { minBlockSize: '2.5rem', fontSize: 'var(--text-sm)' } } },
            md: {},
            lg: { root: { base: { minBlockSize: '3.5rem' } } },
            xl: { root: { base: { minBlockSize: '4rem' } } },
            '2xl': { root: { base: { minBlockSize: '5rem', fontSize: 'var(--text-lg)' } } },
        },
    },
};

/**
 * Breadcrumbs — Carbon's breadcrumb: body-compact links in the secondary
 * text ink, underline only on hover, the current page in full text ink
 * with weight. Size-only; the focus ring is the shared `--carbon-focus`.
 */
export const breadcrumbs: RecipeInput = {
    component: 'breadcrumbs',
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
                gap: 'var(--space-xs)',
                listStyle: 'none',
                margin: '0',
                padding: '0',
            },
        },
        item: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-xs)',
            },
        },
        link: {
            base: {
                color: 'color-mix(in oklch, var(--color-base-content) 75%, transparent)',
                textDecoration: 'none',
                transition: 'color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { color: 'var(--color-base-content)', textDecoration: 'underline' },
                active: {
                    color: 'var(--color-base-content)',
                    fontWeight: 'var(--weight-semibold)',
                },
                inactive: {},
                'focus-visible': {
                    outline: '2px solid var(--carbon-focus)',
                    outlineOffset: '1px',
                },
            },
        },
        separator: {
            base: {
                color: 'color-mix(in oklch, var(--color-base-content) 45%, transparent)',
                userSelect: 'none',
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { fontSize: 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { fontSize: 'var(--text-md)' } } },
            xl: { root: { base: { fontSize: 'var(--text-md)' } } },
            '2xl': { root: { base: { fontSize: 'var(--text-lg)' } } },
        },
    },
};

/**
 * Pagination — Carbon's square page cells: transparent at rest, layer-hover,
 * the current page marked the Carbon way — a 2px interactive rule on the
 * block-start edge over a raised layer, plus weight (Carbon marks selection
 * with rules, not fills). Size-only; glyphs flip under the rtl guard.
 */
export const pagination: RecipeInput = {
    component: 'pagination',
    tokens: {
        '--pg-size': 'calc(var(--size-field) * 10)',
        '--pg-font': 'var(--text-sm)',
    },
    parts: {
        root: { base: { display: 'flex', alignItems: 'center', gap: '0' } },
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
                borderRadius: '0',
                fontSize: 'var(--pg-font)',
                fontVariantNumeric: 'tabular-nums',
                appearance: 'none',
                cursor: 'pointer',
                transition: motion('background, color'),
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                active: {
                    background: 'var(--color-base-200)',
                    boxShadow: 'inset 0 2px 0 0 var(--color-base-content)',
                    fontWeight: 'var(--weight-semibold)',
                },
                inactive: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)' },
            },
        },
        ellipsis: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minInlineSize: 'var(--pg-size)',
                blockSize: 'var(--pg-size)',
                color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)',
                fontSize: 'var(--pg-font)',
                userSelect: 'none',
            },
        },
        'prev-trigger': {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minInlineSize: 'var(--pg-size)',
                blockSize: 'var(--pg-size)',
                background: 'transparent',
                color: 'var(--color-base-content)',
                border: 'none',
                borderRadius: '0',
                fontSize: 'calc(var(--pg-font) * 1.2)',
                lineHeight: 'var(--leading-none)',
                appearance: 'none',
                cursor: 'pointer',
                transition: motion('background'),
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)' },
                [`&${rtl}`]: { scale: '-1 1' },
            },
        },
        'next-trigger': {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minInlineSize: 'var(--pg-size)',
                blockSize: 'var(--pg-size)',
                background: 'transparent',
                color: 'var(--color-base-content)',
                border: 'none',
                borderRadius: '0',
                fontSize: 'calc(var(--pg-font) * 1.2)',
                lineHeight: 'var(--leading-none)',
                appearance: 'none',
                cursor: 'pointer',
                transition: motion('background'),
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)' },
                [`&${rtl}`]: { scale: '-1 1' },
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--pg-size': 'calc(var(--size-field) * 9)', '--pg-font': 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { '--pg-size': 'calc(var(--size-field) * 12)' } } },
            xl: { root: { base: { '--pg-size': 'calc(var(--size-field) * 13)', '--pg-font': 'var(--text-md)' } } },
            '2xl': { root: { base: { '--pg-size': 'calc(var(--size-field) * 14)', '--pg-font': 'var(--text-md)' } } },
        },
    },
};

/**
 * Steps — Carbon's ProgressIndicator: the discs are the one circle Carbon
 * allows itself (its step markers are SVG rings) — a border ring at rest,
 * filled once walked, the current one filled AND double-ringed. Size-only;
 * progress is marked with fill and weight, never colour.
 */
export const steps: RecipeInput = {
    component: 'steps',
    tokens: {

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
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)' },
            },
            states: {
                active: { color: 'var(--color-base-content)', fontWeight: 'var(--weight-semibold)' },
                complete: { color: 'var(--color-base-content)' },
                inactive: { color: 'color-mix(in oklch, var(--color-base-content) 65%, transparent)' },
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
                border: 'var(--border) solid var(--color-base-content)',
                transition: motion('background, color'),
            },
            states: {
                active: { background: 'var(--color-base-content)', color: 'var(--color-base-100)', boxShadow: '0 0 0 2px var(--color-base-100), 0 0 0 3px var(--color-base-content)' },
                complete: { background: 'var(--color-base-content)', color: 'var(--color-base-100)' },
                inactive: { background: 'transparent', color: 'var(--color-base-content)' },
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
                complete: { background: 'var(--color-base-content)' },
                inactive: { background: 'var(--color-base-300)' },
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
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
                fontWeight: 'var(--weight-normal)',
            },
        },
    },
    variants: {

        size: {
            sm: { root: { base: { '--steps-ind': 'calc(var(--size-selector) * 5)', '--steps-font': 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { '--steps-ind': 'calc(var(--size-selector) * 8)' } } },
            xl: { root: { base: { '--steps-ind': 'calc(var(--size-selector) * 8.5)', '--steps-font': 'var(--text-md)' } } },
            '2xl': { root: { base: { '--steps-ind': 'calc(var(--size-selector) * 9)', '--steps-font': 'var(--text-md)' } } },
        },
    },
};

/**
 * Drawer — Carbon's side panel: the $layer-01 sheet with a single line on
 * its inner edge, square of course, faded in. Base render is the inline
 * mode; `:modal` is the top-layer edge sheet. Size-only, on the trigger.
 */
export const drawer: RecipeInput = {
    component: 'drawer',
    parts: {
        trigger: ghostTrigger,
        panel: withPresence(popupPresence('none'), {
            base: {
                padding: 'var(--space-lg)',
                background: 'var(--color-base-200)',
                color: 'var(--color-base-content)',
                border: 'var(--border) solid var(--carbon-line)',
                borderRadius: '0',
                fontFamily: 'var(--font-sans)',
                inlineSize: 'min(20rem, 85vw)',
            },
            states: { open: {}, closed: {} },
            selectors: {
                '&:modal': {
                    position: 'fixed',
                    insetBlockStart: '0',
                    insetBlockEnd: '0',
                    blockSize: '100dvh',
                    maxBlockSize: '100dvh',
                    inlineSize: 'min(20rem, 85vw)',
                    maxInlineSize: 'none',
                    margin: '0',
                    borderRadius: '0',
                    border: 'none',
                    boxShadow: 'var(--shadow-xl)',
                },
                '&[data-placement="start"]:modal': {
                    insetInlineStart: '0',
                    insetInlineEnd: 'auto',
                    borderInlineEnd: 'var(--border) solid var(--carbon-line)',
                },
                '&[data-placement="end"]:modal': {
                    insetInlineStart: 'auto',
                    insetInlineEnd: '0',
                    borderInlineStart: 'var(--border) solid var(--carbon-line)',
                },
            },
        }),
        backdrop: {
            base: {
                background: 'oklch(0% 0 0 / 0.5)',
                opacity: '0',
                transition: 'opacity var(--duration-normal) var(--ease-standard), '
                    + 'display var(--duration-normal) allow-discrete, '
                    + 'overlay var(--duration-normal) allow-discrete',
            },
            states: { open: { opacity: '1' }, closed: {} },
            at: {
                'starting-style': { states: { open: { opacity: '0' } } },
                'reduced-motion': { base: { transition: 'none' } },
            },
        },
        title: {
            base: {
                margin: '0 0 var(--space-md)',
                fontSize: 'var(--text-xl)',
                fontWeight: 'var(--weight-normal)',
                lineHeight: 'var(--leading-tight)',
            },
        },
        close: (() => {
            const shared = ghostIconButton('3rem');
            return {
                ...shared,
                base: {
                    ...shared.base,
                    width: 'auto',
                    height: 'auto',
                    justifyContent: 'flex-start',
                    padding: 'var(--space-xs) var(--space-md)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-sm)',
                    letterSpacing: 'var(--tracking-wide)',
                },
            };
        })(),
    },
    // Trigger-carried size — see `overlayTriggerSizes`.
    variants: { size: overlayTriggerSizes },
};

/**
 * Carbon data table: no outer chrome (the page layer is the chrome), a
 * base-200 header band, hairline `--carbon-line` row rules, and the layer
 * washes for interaction — selected rows on the 15% active layer. `zebra`
 * is Carbon's `useZebraStyles` (the api maps it). Square everything.
 */
export const table: RecipeInput = {
    component: 'table',
    tokens: {
        '--table-pad-block': 'var(--space-sm)',
        '--table-pad-inline': 'var(--space-md)',
        '--table-font': 'var(--text-sm)',
    },
    parts: {
        root: {
            base: {
                overflowX: 'auto',
                background: 'var(--color-base-100)',
            },
        },
        table: {
            base: {
                borderCollapse: 'collapse',
                inlineSize: '100%',
                fontSize: 'var(--table-font)',
                color: 'var(--color-base-content)',
            },
        },
        caption: {
            base: {
                captionSide: 'top',
                textAlign: 'start',
                padding: 'var(--table-pad-block) var(--table-pad-inline)',
                fontSize: 'var(--text-xs)',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
            },
        },
        head: {
            base: { background: 'var(--color-base-200)' },
        },
        body: {},
        foot: {
            base: {
                background: 'var(--color-base-200)',
                fontSize: 'var(--text-xs)',
            },
        },
        row: {
            base: { borderBlockEnd: 'var(--border) solid var(--carbon-line)' },
            states: {
                selected: { background: layerActive },
            },
        },
        'header-cell': {
            base: {
                padding: 'var(--table-pad-block) var(--table-pad-inline)',
                textAlign: 'start',
                fontWeight: 'var(--weight-semibold)',
                fontSize: 'var(--table-font)',
            },
        },
        cell: {
            base: {
                padding: 'var(--table-pad-block) var(--table-pad-inline)',
                textAlign: 'start',
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--table-pad-block': 'calc(var(--space-xs) / 2)', '--table-pad-inline': 'var(--space-sm)', '--table-font': 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { '--table-pad-block': 'var(--space-md)', '--table-pad-inline': 'var(--space-lg)', '--table-font': 'var(--text-sm)' } } },
            xl: { root: { base: { '--table-pad-block': 'var(--space-md)', '--table-pad-inline': 'var(--space-lg)', '--table-font': 'var(--text-md)' } } },
            '2xl': { root: { base: { '--table-pad-block': 'var(--space-lg)', '--table-pad-inline': 'var(--space-xl)', '--table-font': 'var(--text-md)' } } },
        },
    },
    modifiers: {
        zebra: {
            row: {
                selectors: {
                    '[data-scope="table"][data-part="body"] > &:nth-child(even):not([data-selected])': {
                        background: layerHover,
                    },
                },
            },
        },
    },
};

/**
 * Carbon file uploader: a tertiary-button trigger (interactive ink on a
 * transparent fill), a dashed layer dropzone that fills toward the
 * interactive blue under a hovering drag, and square item rows on the
 * base-200 layer — Carbon's own uploader look. Square everything.
 */
export const fileUpload: RecipeInput = {
    component: 'file-upload',
    tokens: {
        '--fu-pad': 'var(--space-lg)',
        '--fu-font': 'var(--text-sm)',
    },
    parts: {
        root: {
            base: { display: 'grid', gap: 'var(--space-sm)', justifyItems: 'start' },
        },
        label: {
            base: { fontSize: 'var(--text-xs)', color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
        },
        trigger: {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-xs)',
                padding: 'var(--space-sm) var(--space-lg)',
                fontSize: 'var(--fu-font)',
                lineHeight: 'var(--leading-none)',
                color: 'var(--carbon-interactive)',
                background: 'transparent',
                border: 'var(--border) solid var(--carbon-interactive)',
                borderRadius: '0',
                cursor: 'pointer',
            },
            states: {
                hover: { background: layerHover },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                invalid: { borderColor: 'var(--carbon-danger)', color: 'var(--carbon-danger)' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: layerActive },
            },
        },
        dropzone: {
            base: {
                justifySelf: 'stretch',
                padding: 'var(--fu-pad)',
                textAlign: 'center',
                fontSize: 'var(--fu-font)',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                border: 'var(--border) dashed var(--carbon-border-strong)',
                background: 'var(--color-base-100)',
                cursor: 'pointer',
            },
            states: {
                highlighted: {
                    borderColor: 'var(--carbon-interactive)',
                    borderStyle: 'solid',
                    background: layerHover,
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
                gap: 'var(--space-2xs)',
            },
        },
        item: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: 'var(--space-xs) var(--space-md)',
                background: 'var(--color-base-200)',
            },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
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
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
            },
        },
        'item-remove': {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                borderRadius: '0',
                padding: 'var(--space-2xs) var(--space-xs)',
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
            },
            states: {
                hover: { background: layerHover },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--fu-pad': 'var(--space-md)', '--fu-font': 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { '--fu-pad': 'var(--space-xl)', '--fu-font': 'var(--text-sm)' } } },
            xl: { root: { base: { '--fu-pad': 'var(--space-xl)', '--fu-font': 'var(--text-md)' } } },
            '2xl': { root: { base: { '--fu-pad': 'calc(var(--space-xl) * 1.25)', '--fu-font': 'var(--text-md)' } } },
        },
    },
};

/**
 * Carbon carousel: square everything — the nav triggers are ghost-square
 * buttons with the layer washes, the dots square marks: a strong-border
 * outline resting, the interactive blue filling the active one.
 */
export const carousel: RecipeInput = {
    component: 'carousel',
    tokens: {
        '--carousel-dot': '0.625rem',
        '--carousel-nav': '2rem',
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
                background: 'var(--color-base-100)',
            },
            selectors: {
                // The viewport is a tab stop (scrollable-region-focusable) and
                // owes the keyboard user a ring. Real :focus-visible — no
                // runtime flag exists on this part.
                '&:focus-visible': { outline: '2px solid var(--carbon-focus)', outlineOffset: '-2px' },
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
                color: 'var(--color-base-content)',
                background: 'var(--color-base-200)',
                border: 'var(--border) solid var(--carbon-border-strong)',
                borderRadius: '0',
                cursor: 'pointer',
                zIndex: '1',
            },
            states: {
                hover: { background: layerHover },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: layerActive },
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
                color: 'var(--color-base-content)',
                background: 'var(--color-base-200)',
                border: 'var(--border) solid var(--carbon-border-strong)',
                borderRadius: '0',
                cursor: 'pointer',
                zIndex: '1',
            },
            states: {
                hover: { background: layerHover },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: layerActive },
            },
        },
        'indicator-group': {
            base: { display: 'flex', gap: 'var(--space-xs)', justifyContent: 'center' },
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
                    border: 'calc(var(--border) * 2) solid var(--carbon-border-strong)',
                    borderRadius: '0',
                    background: 'transparent',
                },
                '&[data-state="active"]::before': {
                    background: 'var(--carbon-interactive)',
                    borderColor: 'var(--carbon-interactive)',
                },
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--carousel-dot': '0.5rem', '--carousel-nav': '1.75rem' } } },
            md: {},
            lg: { root: { base: { '--carousel-dot': '0.75rem', '--carousel-nav': '2.25rem' } } },
            xl: { root: { base: { '--carousel-dot': '0.875rem', '--carousel-nav': '2.5rem' } } },
            '2xl': { root: { base: { '--carousel-dot': '1rem', '--carousel-nav': '3rem' } } },
        },
    },
};

/**
 * Carbon swap: a fast productive fade, nothing more — motion in Carbon is
 * utilitarian. Square focus, layer hover on the interactive form.
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
                    borderRadius: 'var(--radius-selector)',
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
                transition: 'opacity var(--duration-fast) var(--ease-standard)',
            },
            states: {
                on: {},
                off: { opacity: '0' },
            },
            at: {
                'reduced-motion': { base: { transition: 'none' } },
            },
        },
        off: {
            base: {
                gridArea: '1 / 1',
                transition: 'opacity var(--duration-fast) var(--ease-standard)',
            },
            states: {
                off: {},
                on: { opacity: '0' },
            },
            at: {
                'reduced-motion': { base: { transition: 'none' } },
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--swap-size': 'var(--text-md)' } } },
            md: {},
            lg: { root: { base: { '--swap-size': 'var(--text-2xl)' } } },
            xl: { root: { base: { '--swap-size': 'var(--text-3xl)' } } },
            '2xl': { root: { base: { '--swap-size': 'var(--text-3xl)' } } },
        },
    },
};

/**
 * Countdown — display-only digits. The runtime replaces the `digits`
 * element per tick (keyed), so the enter animation below plays once per
 * change — fast and productive; a loop never exists, and reduced motion
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
                animation: 'zero-carbon-countdown-in 0.24s var(--ease-standard)',
            },
            at: {
                'reduced-motion': { base: { animation: 'none' } },
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--countdown-font': 'var(--text-xl)' } } },
            md: {},
            lg: { root: { base: { '--countdown-font': 'var(--text-3xl)' } } },
            xl: { root: { base: { '--countdown-font': 'var(--text-3xl)' } } },
            '2xl': { root: { base: { '--countdown-font': 'var(--text-3xl)' } } },
        },
    },
    keyframes: { 'zero-carbon-countdown-in': 'from { transform: translateY(0.5em); opacity: 0; }' },
};

/**
 * Carbon diff: the interactive blue divider with a SQUARE grip — square
 * everything — and the active layer when pressed. Size only.
 */
export const diff: RecipeInput = {
    component: 'diff',
    tokens: {
        '--diff-accent': 'var(--carbon-interactive)',
        '--diff-grip': '1.5rem',
        '--diff-hit': '2rem',
    },
    parts: {
        root: {
            base: {
                display: 'grid',
                overflow: 'hidden',
                background: 'var(--color-base-100)',
            },
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
                pressed: { '--diff-accent': 'color-mix(in oklab, var(--carbon-interactive) 85%, var(--color-base-content))' },
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
                    borderRadius: '0',
                    zIndex: '1',
                },
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--diff-grip': '1.25rem', '--diff-hit': '1.75rem' } } },
            md: {},
            lg: { root: { base: { '--diff-grip': '2rem', '--diff-hit': '2.5rem' } } },
            xl: { root: { base: { '--diff-grip': '2.25rem', '--diff-hit': '2.75rem' } } },
            '2xl': { root: { base: { '--diff-grip': '2.5rem', '--diff-hit': '3rem' } } },
        },
    },
};

export const recipes: RecipeInput[] = [
    tabs, collapsible, switchRecipe, dialog, popover, tooltip, menu,
    field, checkbox, radioGroup, progress, slider, accordion, select, button, avatar, toast, combobox,
    toggle, toggleGroup, numberInput, ratingGroup, treeView, input, textarea,
    card, alert, badge, divider, skeleton, spinner,
    kbd, status, indicator, stats, timeline, chat, radialProgress, join,
    navbar, breadcrumbs, pagination, steps, drawer,
    table,
    fileUpload,
    carousel,
    swap,
    countdown,
    diff,
];
