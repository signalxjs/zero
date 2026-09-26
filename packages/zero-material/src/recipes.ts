/**
 * zero-material recipes — Material's look over zero's anatomy.
 *
 * Written to exercise the recipe layer rather than to be exhaustive: the
 * tonal surface roles, the `level1`–`level5` elevation ramp, Material's
 * emphasized easings, and a dialog that goes full-screen below `sm`.
 */
import type { CssProps, PartStyles, RecipeInput } from '@sigx/zero-kit';
import { axisRoles, tableStackAt } from '@sigx/zero-kit/define';
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
    props.split(', ').map((p) => `${p} var(--duration-fast) var(--ease-standard)`).join(', ');

/** Material's raised container: a tonal fill plus an elevation step. */
const raised = (level: 'level2' | 'level3'): CssProps => ({
    background: 'var(--color-surface-container-high)',
    color: 'var(--color-surface-container-high-content)',
    border: 'none',
    borderRadius: 'var(--radius-box)',
    boxShadow: `var(--shadow-${level})`,
});

const label: CssProps = {
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--weight-medium)',
    letterSpacing: 'var(--tracking-wide)',
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
            transition: 'opacity var(--duration-fast) var(--ease-standard)',
        },
        // MD3 state layers: hover 8%, pressed 12%. Pressed carries the
        // redundant :not so its specificity EQUALS hover's and it wins by
        // source order while both apply.
        '&:hover:not([data-disabled])::before': { opacity: '0.08' },
        '&[data-pressed]:not([data-disabled])::before': { opacity: '0.12' },
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
            animation: `${prefix}-ripple var(--duration-slow) var(--ease-standard)`,
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
            transition: 'opacity var(--duration-fast) var(--ease-standard)',
        },
        '&:hover:not([data-disabled], [data-readonly])::before': { opacity: '0.08' },
        '&[data-pressed]:not([data-disabled])::before': { opacity: '0.12' },
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
            animation: `${prefix}-ripple var(--duration-slow) var(--ease-standard)`,
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
        'from { transform: translate(-50%, -50%) scale(0); opacity: 0.12; } '
        + '60% { transform: translate(-50%, -50%) scale(1); opacity: 0.12; } '
        + 'to { transform: translate(-50%, -50%) scale(1); opacity: 0; }',
});

// ── Button ────────────────────────────────────────────────────────────────
// The accent-pair indirection, so Material's larger role vocabulary costs one
// rule per role rather than one per role × fill.
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
const popupPresence = (from: string): PartStyles => ({
    base: {
        opacity: '0',
        transform: from,
        transition: 'opacity var(--duration-normal) var(--ease-emphasized), '
            + 'transform var(--duration-normal) var(--ease-emphasized), '
            + 'display var(--duration-normal) allow-discrete, '
            + 'overlay var(--duration-normal) allow-discrete',
    },
    states: { open: { opacity: '1', transform: 'none' } },
    at: {
        'starting-style': { states: { open: { opacity: '0', transform: from } } },
        'reduced-motion': { base: { transition: 'none' }, states: { open: { transform: 'none' } } },
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
            transition: 'block-size var(--duration-normal) var(--ease-emphasized), '
                    + 'content-visibility var(--duration-normal) allow-discrete',
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
                        animation: `${scope}-panel-exit var(--duration-normal) var(--ease-emphasized)`,
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

export const button: RecipeInput = {
    component: 'button',
    // Public to a design system derived from this one (#73).
    hooks: {
        properties: {
            '--btn-accent': 'The fill of the solid variant.',
            '--btn-on-accent': 'The ink on --btn-accent.',
            '--btn-soft': 'The soft fill (soft variant, unfilled hover).',
        },
    },
    tokens: {
        '--btn-accent': 'var(--color-primary)',
        '--btn-on-accent': 'var(--color-primary-content)',
        '--btn-soft': 'var(--color-primary-soft)',
        // The state-layer/ripple ink. On a filled button that is the on-color;
        // un-filled variants override to the accent itself.
        '--btn-ripple': 'var(--btn-on-accent)',
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
                inlineSize: '1em',
                blockSize: '1em',
                flex: 'none',
                borderRadius: '9999px',
                border: 'calc(var(--border) * 2) solid currentColor',
                borderBlockStartColor: 'transparent',
                animation: 'zero-material-btn-spin 0.8s linear infinite',
            },
            at: { 'reduced-motion': { base: { animation: 'none' } } },
        },
        root: {
            base: {
                appearance: 'none',
                // An asChild `<a>` gets no UA underline (see the README's
                // link-button note for the unlayered `a { color }` case).
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-xs)',
                border: 'var(--border) solid transparent',
                // Material's fully-rounded action shape.
                borderRadius: '624rem',
                ...label,
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
                transition: motion('background, box-shadow, border-color'),
                // Ripple containment: the ink clips to the pill; box-shadow
                // elevation is unaffected by overflow.
                position: 'relative',
                overflow: 'hidden',
                WebkitTapHighlightColor: 'transparent',
            },
            states: {
                // Work in flight (`loading`, #50): still focusable, still legible —
                // the label is what the reader is waiting on — so no fade here.
                loading: { cursor: 'progress' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed', boxShadow: 'none' },
                ...focusRing,
            },
            selectors: {
                // Held state layer — Material pressed = ink at 12% while the
                // pointer/key is down. This is the non-motion press feedback,
                // so it also carries reduced-motion.
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: '0',
                    background: 'var(--btn-ripple)',
                    opacity: '0',
                    pointerEvents: 'none',
                    transition: 'opacity var(--duration-fast) var(--ease-standard)',
                },
                '&:hover:not([data-disabled])::before': { opacity: '0.08' },
                '&[data-pressed]:not([data-disabled])::before': { opacity: '0.12' },
                // Ink ripple — a one-shot expansion from the press point the
                // runtime publishes as --press-x/y, sized by --press-r (the
                // farthest-corner radius). data-press-animating outlives
                // release, so a quick tap still plays the full wave.
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    left: 'var(--press-x, 50%)',
                    top: 'var(--press-y, 50%)',
                    width: 'calc(var(--press-r, 0px) * 2)',
                    height: 'calc(var(--press-r, 0px) * 2)',
                    borderRadius: '50%',
                    background: 'var(--btn-ripple)',
                    transform: 'translate(-50%, -50%) scale(0)',
                    opacity: '0',
                    pointerEvents: 'none',
                },
                '&[data-press-animating]::after': {
                    animation: 'btn-ripple var(--duration-slow) var(--ease-standard)',
                },
            },
            at: {
                // Reduced motion needs nothing here: --duration-* collapse to
                // 0.01ms and the ::before tint remains as press feedback.
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
        },
    },
    keyframes: {
        'zero-material-btn-spin': 'to { transform: rotate(360deg) }',
        'btn-ripple':
            'from { transform: translate(-50%, -50%) scale(0); opacity: 0.12; } '
            + '60% { transform: translate(-50%, -50%) scale(1); opacity: 0.12; } '
            + 'to { transform: translate(-50%, -50%) scale(1); opacity: 0; }',
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [
            c,
            {
                root: {
                    base: {
                        '--btn-accent': `var(--color-${c})`,
                        '--btn-on-accent': `var(--color-${c}-content)`,
                        '--btn-soft': `var(--color-${c}-soft)`,
                    },
                },
            },
        ])),
        variant: {
            // Material calls these filled / outlined / tonal / text.
            solid: {
                root: {
                    base: {
                        background: 'var(--btn-accent)',
                        color: 'var(--btn-on-accent)',
                        boxShadow: 'var(--shadow-level1)',
                    },
                    states: { hover: { boxShadow: 'var(--shadow-level2)' } },
                },
            },
            outline: {
                root: {
                    base: {
                        background: 'transparent',
                        color: 'var(--btn-accent)',
                        borderColor: 'var(--color-outline)',
                        '--btn-ripple': 'var(--btn-accent)',
                    },
                },
            },
            soft: {
                root: {
                    base: {
                        background: 'var(--btn-soft)',
                        color: 'var(--btn-accent)',
                        '--btn-ripple': 'var(--btn-accent)',
                    },
                    states: { hover: { boxShadow: 'var(--shadow-level1)' } },
                },
            },
            ghost: {
                root: {
                    base: {
                        background: 'transparent',
                        color: 'var(--btn-accent)',
                        '--btn-ripple': 'var(--btn-accent)',
                    },
                },
            },
        },
        size: {
            xs: { root: { base: { padding: 'var(--space-2xs) var(--space-sm)', fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { padding: 'var(--space-xs) var(--space-md)', fontSize: 'var(--text-sm)' } } },
            md: { root: { base: { padding: 'var(--space-xs) var(--space-lg)', fontSize: 'var(--text-sm)' } } },
            lg: { root: { base: { padding: 'var(--space-sm) var(--space-xl)', fontSize: 'var(--text-md)' } } },
            xl: { root: { base: { padding: 'var(--space-md) var(--space-2xl)', fontSize: 'var(--text-lg)' } } },
        },
    },
    defaultVariants: { color: 'primary', variant: 'solid', size: 'md' },
};

// ── Tabs ──────────────────────────────────────────────────────────────────
export const tabs: RecipeInput = {
    component: 'tabs',
    // Accent default in `tokens:` — the un-attributed render IS the primary
    // variant; `variants.color` only rebinds the custom property.
    tokens: { '--tabs-accent': 'var(--color-primary)' },
    parts: {
        root: { base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' } },
        list: {
            base: {
                display: 'flex',
                background: 'var(--color-surface)',
                borderBottom: 'var(--border) solid var(--color-outline)',
            },
        },
        // NOTE: `active` on a tab is the SELECTED anatomy state, not the
        // `:active` pseudo-class — press styling must stay in `selectors`.
        tab: withPresence(pressable('tab', 'var(--tabs-accent)'), {
            base: {
                appearance: 'none',
                background: 'none',
                border: 'none',
                borderBottom: '3px solid transparent',
                marginBottom: 'calc(-1 * var(--border))',
                padding: 'var(--space-sm) var(--space-md)',
                ...label,
                color: 'var(--color-base-content)',
                cursor: 'pointer',
                transition: motion('color, border-color'),
            },
            states: {
                active: { color: 'var(--tabs-accent)', borderBottomColor: 'var(--tabs-accent)' },
                inactive: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
        }),
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
    },
};

// ── Disclosure ────────────────────────────────────────────────────────────
// A function of the ripple prefix: collapsible and accordion emit separate
// component stylesheets, so each must name (and declare) its own keyframe.
//
// ── WHY THE TRIGGER ITSELF HAS TO SAY IT (#220) ───────────────────────────
// The collapsible and accordion anatomies declare `trigger` and `panel` and
// no `indicator`, so there is no part whose job is to point. `justify-content:
// space-between` reserves the trailing slot an app can fill with its own
// glyph, but an app that fills nothing — the playground included — is left
// with the trigger's own paint as the only signal. It used to be `open: {}`
// and `closed: {}`, both empty, so an expanded header was byte-identical to a
// collapsed one.
//
// ── WHAT CAN CARRY IT ──────────────────────────────────────────────────────
// Not a pseudo-element: `pressable()` owns BOTH — `::before` is the MD3 state
// layer and `::after` is the ink ripple — and it is the most-shared helper in
// this package (~26 call sites), so a chevron here would mean either taking a
// pseudo-element off every pressable part or forking the helper. Not weight
// either: this vocabulary maps `medium` and `semibold` to the same 500, so a
// bump to `--weight-semibold` would compile to no change at all.
//
// What is left is the element's own box, and MD3 already has a word for it:
// the SELECTED CONTAINER. An expanded header takes the tonal container fill
// and the key ink — the same `primary-soft` + primary pairing the open menu
// sub-trigger takes two hundred lines down, so "open" looks the same wherever
// this design system says it. The inset hairline is the structural half of
// the same sentence: the header now has a panel under it. `box-shadow`, not
// `border-block-end`, so nothing reflows on toggle.
// The accent pair rides two custom properties (`--disclosure-accent`/`-soft`)
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
            color: 'var(--disclosure-accent)',
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

/** The selected-container pair, per role — what `variants.color` rebinds. */
const disclosureColors = (): Record<string, Record<string, PartStyles>> =>
    Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
        '--disclosure-accent': `var(--color-${c})`,
        '--disclosure-soft': `var(--color-${c}-soft)`,
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

export const collapsible: RecipeInput = {
    component: 'collapsible',
    targets: disclosureExit('collapsible'),
    // Public to a design system derived from this one (#73).
    hooks: {
        properties: {
            '--disclosure-accent': 'The accent of the open trigger.',
            '--disclosure-soft': 'The soft state-layer fill.',
        },
    },
    tokens: {
        '--disclosure-accent': 'var(--color-primary)',
        '--disclosure-soft': 'var(--color-primary-soft)',
    },
    parts: {
        root: withPresence(disclosurePresence, {
            base: {
                background: 'var(--color-surface-container)',
                color: 'var(--color-surface-container-content)',
                borderRadius: 'var(--radius-box)',
                overflow: 'hidden',
            },
            states: { open: {}, closed: {} },
        }),
        trigger: disclosureTrigger('collapsible'),
        panel: {
            base: { padding: '0 var(--space-md) var(--space-md)', lineHeight: 'var(--leading-normal)' },
            states: { open: {}, closed: {} },
        },
    },
    keyframes: rippleKeyframes('collapsible'),
    variants: { color: disclosureColors(), size: disclosureSizes },
};

export const accordion: RecipeInput = {
    component: 'accordion',
    targets: disclosureExit('accordion'),
    tokens: {
        '--disclosure-accent': 'var(--color-primary)',
        '--disclosure-soft': 'var(--color-primary-soft)',
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
                borderRadius: 'var(--radius-box)',
                overflow: 'hidden',
            },
            states: { open: {}, closed: {} },
            selectors: { '[data-scope="accordion"][data-part="root"][data-orientation="horizontal"] > &': { flex: '1 1 0', minInlineSize: '0' } },
        }),
        trigger: disclosureTrigger('accordion'),
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
    borderRadius: '624rem',
    border: 'var(--border) solid var(--color-outline)',
    background: 'transparent',
    // `--overlay-accent` is declared in each wearing recipe's `tokens:` and
    // lands on the trigger itself — the carrier part of these rootless
    // scopes — so `variants.color` below only rebinds it.
    color: 'var(--overlay-accent)',
    padding: 'var(--space-xs) var(--space-lg)',
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
const disabledFade: CssProps = { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' };

/** What every outlined-trigger recipe declares — the accent's resting value. */
const overlayTriggerTokens = { '--overlay-accent': 'var(--color-primary)' };

/**
 * The axes for the outlined overlay triggers (#321). Dialog, popover,
 * tooltip and menu carry their axis attributes on the TRIGGER — the
 * anatomy's carrier part — and their popups are top-layer siblings the
 * compiled `@scope` donut can never reach, so the axes style the pill
 * itself: colour re-inks the label (Material's role tokens are inks by
 * construction — the same raw-role ink the button's outlined variant
 * uses), size steps the pill on the button's own ramp.
 */
const overlayTriggerColors = (): Record<string, Record<string, PartStyles>> =>
    Object.fromEntries(ROLES.map((c) => [c, { trigger: { base: {
        '--overlay-accent': `var(--color-${c})`,
    } } }]));

const overlayTriggerSizes: Record<string, Record<string, PartStyles>> = {
    xs: { trigger: { base: { padding: 'var(--space-2xs) var(--space-sm)', fontSize: 'var(--text-xs)' } } },
    sm: { trigger: { base: { padding: 'var(--space-xs) var(--space-md)', fontSize: 'var(--text-sm)' } } },
    // `md` is the un-attributed render — `outlinedTrigger` already IS the
    // button ramp's middle step.
    md: {},
    lg: { trigger: { base: { padding: 'var(--space-sm) var(--space-xl)', fontSize: 'var(--text-md)' } } },
    xl: { trigger: { base: { padding: 'var(--space-md) var(--space-2xl)', fontSize: 'var(--text-lg)' } } },
};

// ── Dialog ────────────────────────────────────────────────────────────────
export const dialog: RecipeInput = {
    component: 'dialog',
    tokens: overlayTriggerTokens,
    parts: {
        trigger: withPresence(pressable('dialog', 'var(--overlay-accent)'), {
            base: outlinedTrigger,
            states: { open: {}, closed: {}, disabled: disabledFade, ...focusRing },
        }),
        popup: withPresence(popupPresence('translateY(24px) scale(0.94)'), {
            // Mobile-first: Material's full-screen dialog below `sm`.
            base: {
                // A <dialog> keeps the UA's `content-box`, and zero ships no
                // reset — so a width or max-width meant to leave a gutter
                // grew by the padding, and at phone width the popup ran past
                // both edges (#101). Its box is the border box.
                boxSizing: 'border-box',
                width: '100%',
                height: '100dvh',
                maxWidth: 'none',
                maxHeight: 'none',
                margin: '0',
                padding: 'var(--space-lg)',
                background: 'var(--color-surface-container-high)',
                color: 'var(--color-surface-container-high-content)',
                border: 'none',
                borderRadius: '0',
                boxShadow: 'none',
            },
            states: { open: {}, closed: {} },
            at: {
                sm: {
                    base: {
                        width: 'calc(100% - var(--space-2xl))',
                        maxWidth: '35rem',
                        // `auto` stretches an inset-positioned modal to fill; `fit-content`
                        // is the UA's own dialog default and hugs the content (#114).
                        height: 'fit-content',
                        maxHeight: 'calc(100% - var(--space-2xl))',
                        margin: 'auto',
                        ...raised('level3'),
                    },
                },
            },
        }),
        backdrop: {
            base: { background: 'oklch(0% 0 0 / 0.32)' },
            states: { open: {}, closed: {} },
        },
        title: {
            base: {
                margin: '0 0 var(--space-md)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xl)',
                fontWeight: 'var(--weight-normal)',
                lineHeight: 'var(--leading-tight)',
            },
        },
        description: {
            base: {
                margin: '0 0 var(--space-lg)',
                fontSize: 'var(--text-sm)',
                lineHeight: 'var(--leading-normal)',
                color: 'var(--color-base-content)',
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
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'var(--color-primary)',
                borderRadius: '624rem',
                padding: 'var(--space-xs) var(--space-lg)',
                ...label,
                cursor: 'pointer',
            },
            states: { disabled: disabledFade, ...focusRing },
        }),
        // The alertdialog's least-destructive action — Material's text
        // button, same as close (M3 gives both dialog actions text style).
        cancel: withPresence(pressable('dialog'), {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'var(--color-primary)',
                borderRadius: '624rem',
                padding: 'var(--space-xs) var(--space-lg)',
                ...label,
                cursor: 'pointer',
            },
            states: { disabled: disabledFade, ...focusRing },
        }),
    },
    keyframes: rippleKeyframes('dialog'),
    // Trigger-carried axes — see `overlayTriggerColors` for why the popup is
    // out of reach and the trigger is the whole story here.
    variants: { color: overlayTriggerColors(), size: overlayTriggerSizes },
};

// ── Floating surfaces ─────────────────────────────────────────────────────
const floating: CssProps = { ...raised('level2'), padding: 'var(--space-xs)' };

export const popover: RecipeInput = {
    component: 'popover',
    tokens: overlayTriggerTokens,
    parts: {
        trigger: withPresence(pressable('popover', 'var(--overlay-accent)'), {
            base: outlinedTrigger,
            states: { open: {}, closed: {}, disabled: disabledFade, ...focusRing },
        }),
        popup: withPresence(popupPresence('scale(0.9)'), {
            base: { ...floating, padding: 'var(--space-md)', maxWidth: '20rem' },
            states: { open: {}, closed: {} },
        }),
        title: { base: { margin: '0 0 var(--space-xs)', fontWeight: 'var(--weight-medium)' } },
        close: withPresence(pressable('popover'), {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'var(--color-primary)',
                borderRadius: 'var(--radius-selector)',
                cursor: 'pointer',
                ...label,
            },
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
            base: {
                background: 'var(--color-neutral)',
                color: 'var(--color-neutral-content)',
                borderRadius: 'var(--radius-selector)',
                padding: 'var(--space-2xs) var(--space-xs)',
                fontSize: 'var(--text-xs)',
                boxShadow: 'var(--shadow-level1)',
            },
            states: { open: {}, closed: {} },
        }),
    },
    // Trigger-carried axes — same wiring as dialog, same reason. The bubble
    // stays Material's inverse-surface tooltip whatever the trigger's colour.
    variants: { color: overlayTriggerColors(), size: overlayTriggerSizes },
};

export const menu: RecipeInput = {
    component: 'menu',
    tokens: overlayTriggerTokens,
    parts: {
        trigger: withPresence(pressable('menu', 'var(--overlay-accent)'), {
            base: outlinedTrigger,
            states: { open: {}, closed: {}, disabled: disabledFade, ...focusRing },
        }),
        popup: withPresence(popupPresence('scale(0.9)'), { base: { ...floating, minWidth: '12rem' }, states: { open: {}, closed: {} } }),
        // The popup keeps no overflow clip; the item's own clips its ripple.
        item: withPresence(pressable('menu'), {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: 'var(--space-xs) var(--space-md)',
                borderRadius: 'var(--radius-selector)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                transition: motion('background'),
            },
            states: {
                highlighted: { background: 'var(--color-primary-soft)' },
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
                padding: 'var(--space-xs) var(--space-md)',
                borderRadius: 'var(--radius-selector)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                transition: motion('background'),
            },
            states: {
                highlighted: { background: 'var(--color-primary-soft)' },
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
                padding: 'var(--space-xs) var(--space-md)',
                borderRadius: 'var(--radius-selector)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                transition: motion('background'),
            },
            states: {
                highlighted: { background: 'var(--color-primary-soft)' },
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
                padding: 'var(--space-xs) var(--space-md)',
                borderRadius: 'var(--radius-selector)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                transition: motion('background'),
            },
            states: {
                highlighted: { background: 'var(--color-primary-soft)' },
                open: { background: 'var(--color-primary-soft)' },
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
                color: 'var(--color-outline)',
            },
        },
        separator: {
            base: { height: 'var(--border)', margin: 'var(--space-2xs) 0', background: 'var(--color-outline)' },
        },
    },
    keyframes: rippleKeyframes('menu'),
    // Trigger-carried axes — same wiring as dialog, same reason. The popup
    // and its items are top-layer siblings the donut cannot reach.
    variants: { color: overlayTriggerColors(), size: overlayTriggerSizes },
};

/**
 * A select whose clear-trigger is rendered (#280) — anchored on the root, so
 * a part inside the trigger can make room for the button laid over it.
 */
const SELECT_CLEARABLE = '[data-scope="select"][data-part="root"]:has(> [data-scope="select"][data-part="clear-trigger"]) &';

export const select: RecipeInput = {
    component: 'select',
    // Accent defaults in `tokens:` — the un-attributed render IS the primary
    // variant; `variants.color` only rebinds the custom properties.
    tokens: {
        '--select-accent': 'var(--color-primary)',
        '--select-soft': 'var(--color-primary-soft)',
    },
    parts: {
        root: { base: { display: 'inline-flex', position: 'relative' } },
        // The ripple clip inherits the field's asymmetric radius.
        trigger: withPresence(pressable('select', 'var(--select-accent)'), {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-xs)',
                minWidth: '12rem',
                padding: 'var(--space-sm) var(--space-md)',
                // Material's filled field: rounded top, flat bottom, underline.
                background: 'var(--color-surface-container)',
                color: 'var(--color-surface-container-content)',
                border: 'none',
                borderBottom: '2px solid var(--color-outline)',
                borderRadius: 'var(--radius-selector) var(--radius-selector) 0 0',
                fontSize: 'var(--text-md)',
                cursor: 'pointer',
                transition: motion('border-color'),
            },
            states: {
                open: { borderBottomColor: 'var(--select-accent)' },
                closed: {},
                // Readonly answers to nothing, so it does not invite a click.
                readonly: { cursor: 'default' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                // Semantic role state, deliberately NOT the accent.
                invalid: { borderBottomColor: 'var(--color-error)' },
                ...focusRing,
            },
        }),
        value: { base: { flex: '1', textAlign: 'start' } },
        indicator: {
            base: { opacity: '0.7', transition: motion('transform') },
            states: { open: { transform: 'rotate(180deg)' }, closed: {} },
            // Room for the clear-trigger laid over the field (#280).
            selectors: { [SELECT_CLEARABLE]: { marginInlineStart: 'calc(var(--space-2xl) + var(--space-sm))' } },
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
        popup: withPresence(popupPresence('scale(0.9)'), { base: { ...floating, minWidth: '12rem' }, states: { open: {}, closed: {} } }),
        // The optgroup equivalent (#325) — the menu's group grammar.
        group: { base: { padding: 'var(--space-2xs) 0' } },
        'group-label': {
            base: {
                padding: 'var(--space-2xs) var(--space-md)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'var(--color-outline)',
            },
        },
        // A windowed group's heading (#127): the same overline as the label,
        // as a row of the flat window instead of inside a `group`.
        'group-heading': {
            base: {
                padding: 'var(--space-2xs) var(--space-md)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'var(--color-outline)',
            },
        },
        item: withPresence(pressable('select', 'var(--select-accent)'), {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: 'var(--space-xs) var(--space-md)',
                borderRadius: 'var(--radius-selector)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
            },
            states: {
                highlighted: { background: 'var(--select-soft)' },
                // MD3's secondary-container fill for a selected row — the
                // pairing tree-view and the segmented button use. Deliberately
                // NOT the accent.
                selected: { background: 'var(--color-secondary-soft)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
                ...focusRing,
            },
        }),
        'item-indicator': { base: { color: 'var(--select-accent)' } },
        // The menu's rule between runs of options (#280).
        separator: {
            base: { height: 'var(--border)', margin: 'var(--space-2xs) 0', background: 'var(--color-outline)' },
        },
        'hidden-input': { base: { position: 'absolute', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none' } },
    },
    keyframes: rippleKeyframes('select'),
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--select-accent': `var(--color-${c})`,
            '--select-soft': `var(--color-${c}-soft)`,
        } } }])),
        // The button's ramp rhythm anchored on the field's resting values
        // (md = the base's padding/fontSize).
        size: {
            xs: { trigger: { base: { padding: 'var(--space-2xs) var(--space-xs)', fontSize: 'var(--text-xs)' } } },
            sm: { trigger: { base: { padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--text-sm)' } } },
            md: { trigger: { base: { padding: 'var(--space-sm) var(--space-md)', fontSize: 'var(--text-md)' } } },
            lg: { trigger: { base: { padding: 'var(--space-md) var(--space-lg)', fontSize: 'var(--text-lg)' } } },
            xl: { trigger: { base: { padding: 'var(--space-lg) var(--space-xl)', fontSize: 'var(--text-xl)' } } },
        },
    },
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
            states: { checked: {}, unchecked: {}, readonly: { cursor: 'default' }, disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' } },
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
                background: 'var(--color-surface-container-high)',
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
                '&:hover:not([data-disabled], [data-readonly]) [data-part="thumb"]::before': { opacity: '0.08' },
                '&[data-pressed]:not([data-disabled]) [data-part="thumb"]::before': { opacity: '0.12' },
                // MD3 ink: on-surface while unselected (deliberately NOT the
                // accent), the accent once checked (the thumb's own ::before).
                '&[data-state="unchecked"] [data-part="thumb"]::before': { background: 'var(--color-base-content)' },
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
                transition: motion('transform, background, width, height'),
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
                    transition: 'opacity var(--duration-fast) var(--ease-standard)',
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
        label: { base: { fontSize: 'var(--text-md)' }, states: { checked: {}, unchecked: {} } },
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
        border: '2px solid var(--color-outline)',
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
        '--checkbox-size': 'calc(var(--size-selector) * 6)',
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
            states: { readonly: { cursor: 'default' }, disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' } },
        },
        // MD3 selection-control halo: unbounded, centered, coords ignored.
        // 2.5 × the tick keeps the 15-unit resting diameter and scales with
        // the size variant.
        control: withPresence(pressableCentered('checkbox', 'calc(var(--checkbox-size) * 2.5)', 'var(--checkbox-accent)'), {
            ...checkboxTick,
            base: { ...checkboxTick.base, borderRadius: 'var(--radius-selector)' },
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
                    transition: 'translate var(--duration-fast) var(--ease-emphasized-decelerate), '
                        + 'rotate var(--duration-fast) var(--ease-emphasized-decelerate), '
                        + 'scale var(--duration-fast) var(--ease-emphasized-decelerate)',
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
                    transition: 'scale var(--duration-fast) var(--ease-emphasized-decelerate)',
                },
                // Material draws the long arm OUT OF the short one, so the
                // stagger lives on the destination rule: drawing in waits a
                // beat for the lead arm, erasing does not wait for anything.
                '&[data-state="checked"]::after': {
                    transition:
                        'scale var(--duration-fast) var(--ease-emphasized-decelerate) var(--duration-fast)',
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
        label: { base: { fontSize: 'var(--text-md)' } },
        'hidden-input': { base: { position: 'absolute', width: '1px', height: '1px', opacity: '0' } },
    },
    keyframes: rippleKeyframes('checkbox'),
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--checkbox-accent': `var(--color-${c})`,
            '--checkbox-on-accent': `var(--color-${c}-content)`,
        } } }])),
        size: {
            xs: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 4)' } }, label: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 5)' } }, label: { base: { fontSize: 'var(--text-sm)' } } },
            md: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 6)' } }, label: { base: { fontSize: 'var(--text-md)' } } },
            lg: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 7)' } }, label: { base: { fontSize: 'var(--text-lg)' } } },
            xl: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 8)' } }, label: { base: { fontSize: 'var(--text-xl)' } } },
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
        '--radio-size': 'calc(var(--size-selector) * 6)',
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
            states: { readonly: { cursor: 'default' }, disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' } },
        },
        // Not the full `tickBox`: a radio has no indeterminate state, and
        // reusing the checkbox's states smuggled one in — which the compiler
        // rejected. The halo diameter is 2.5 × the tick (15 units resting),
        // scaling with the size variant.
        'item-control': withPresence(pressableCentered('radio', 'calc(var(--radio-size) * 2.5)', 'var(--radio-accent)'), {
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
        'item-label': { base: { fontSize: 'var(--text-md)' } },
        'hidden-input': { base: { position: 'absolute', width: '1px', height: '1px', opacity: '0' } },
    },
    keyframes: rippleKeyframes('radio'),
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--radio-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 4)' } }, 'item-label': { base: { fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 5)' } }, 'item-label': { base: { fontSize: 'var(--text-sm)' } } },
            md: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 6)' } }, 'item-label': { base: { fontSize: 'var(--text-md)' } } },
            lg: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 7)' } }, 'item-label': { base: { fontSize: 'var(--text-lg)' } } },
            xl: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 8)' } }, 'item-label': { base: { fontSize: 'var(--text-xl)' } } },
        },
    },
    // The tick itself carries the selected state; the row, dot and text have
    // no appearance of their own that depends on it.
    skipStates: {
        item: ['focus-visible', 'checked', 'unchecked'],
        'item-label': ['checked', 'unchecked'],
    },
};

// ── Field, slider, progress ───────────────────────────────────────────────
export const field: RecipeInput = {
    component: 'field',
    // The label's accent ink — base-content by default, so the un-attributed
    // field is unchanged and a role only arrives through `data-color`.
    tokens: { '--field-accent': 'var(--color-base-content)' },
    parts: {
        root: { base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2xs)' } },
        label: {
            base: { ...label, color: 'var(--field-accent)' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
            selectors: { '&[data-required]::after': { content: '" *"', color: 'var(--color-error)' } },
        },
        description: { base: { margin: '0', fontSize: 'var(--text-xs)', color: 'var(--color-outline)' } },
        error: { base: { margin: '0', fontSize: 'var(--text-xs)', color: 'var(--color-error)' } },
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

export const slider: RecipeInput = {
    component: 'slider',
    // Accent default in `tokens:` — the un-attributed render IS the primary
    // variant; `variants.color` only rebinds the custom property.
    tokens: { '--slider-accent': 'var(--color-primary)' },
    parts: {
        root: { base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2xs)' }, states: { disabled: { opacity: 'var(--disabled-opacity)' } } },
        label: { base: { ...label } },
        // A custom skin (`appearance: none`), for two reasons at once. Blink
        // ignores thumb-pseudo styling on a native slider, so the MD3 handle
        // halo could never render there; and Chrome treats range inputs as
        // always `:focus-visible`, so the generic focus RING appeared on a
        // mouse press and stayed — MD3's focus indicator for a slider is the
        // handle halo, not a ring around the track.
        //
        // Both halo states set one custom property the thumb pseudos read:
        // vendor thumb pseudos cannot share a selector list (an unrecognized
        // selector invalidates the whole rule), and the variable keeps the
        // halo defined once per engine instead of once per state per engine.
        // The filled track reads the runtime-published `--slider-percent`
        // (set on the slider root, inherited here) as a gradient stop.
        control: {
            base: {
                appearance: 'none',
                width: '100%',
                height: 'calc(var(--size-selector) * 10)',
                margin: '0',
                background: 'transparent',
                cursor: 'pointer',
                outline: 'none',
                accentColor: 'var(--slider-accent)',
                '--slider-halo': 'transparent',
                // The remaining track keeps MD3's secondary-container tone —
                // deliberately NOT the accent (matches the progress track).
                '--slider-track':
                    'linear-gradient(to right, var(--slider-accent) var(--slider-percent, 50%), var(--color-secondary-soft) 0)',
            },
            states: {
                // `invalid` is semantic, not an accent: it stays error under
                // every colour variant, and the indirection carries it to the
                // filled track, the thumb and the halo at once — the same
                // shape basic, heroui, daisyui, carbon and brutalist use.
                invalid: { '--slider-accent': 'var(--color-error)' },
                'focus-visible': {
                    '--slider-halo': 'color-mix(in oklab, var(--slider-accent) 10%, transparent)',
                },
                pressed: {
                    '--slider-halo': 'color-mix(in oklab, var(--slider-accent) 12%, transparent)',
                },
                // Readonly answers to nothing, so it does not invite a click.
                readonly: { cursor: 'default' },
                disabled: { cursor: 'not-allowed' },
            },
            selectors: {
                '&::-webkit-slider-runnable-track': {
                    height: 'calc(var(--size-selector) * 2)',
                    borderRadius: '624rem',
                    background: 'var(--slider-track)',
                },
                '&::-webkit-slider-thumb': {
                    appearance: 'none',
                    width: 'calc(var(--size-selector) * 5)',
                    height: 'calc(var(--size-selector) * 5)',
                    marginTop: 'calc(var(--size-selector) * -1.5)',
                    borderRadius: '624rem',
                    border: 'none',
                    background: 'var(--slider-accent)',
                    boxShadow: '0 0 0 calc(var(--size-selector) * 2.5) var(--slider-halo)',
                    transition: 'box-shadow var(--duration-fast) var(--ease-standard)',
                },
                // Keyboard focus must be discernible, not just a 10% wash:
                // a crisp two-tone ring (surface gap + the focus ink used by
                // every other part) sits inside the halo.
                '&[data-focus-visible]::-webkit-slider-thumb': {
                    boxShadow: '0 0 0 2px var(--color-base-100), '
                        + '0 0 0 4px var(--color-secondary), '
                        + '0 0 0 calc(var(--size-selector) * 2.5) var(--slider-halo)',
                },
                '&::-moz-range-track': {
                    height: 'calc(var(--size-selector) * 2)',
                    borderRadius: '624rem',
                    background: 'var(--slider-track)',
                },
                '&::-moz-range-thumb': {
                    width: 'calc(var(--size-selector) * 5)',
                    height: 'calc(var(--size-selector) * 5)',
                    borderRadius: '624rem',
                    border: 'none',
                    background: 'var(--slider-accent)',
                    boxShadow: '0 0 0 calc(var(--size-selector) * 2.5) var(--slider-halo)',
                    transition: 'box-shadow var(--duration-fast) var(--ease-standard)',
                },
                '&[data-focus-visible]::-moz-range-thumb': {
                    boxShadow: '0 0 0 2px var(--color-base-100), '
                        + '0 0 0 4px var(--color-secondary), '
                        + '0 0 0 calc(var(--size-selector) * 2.5) var(--slider-halo)',
                },
            },
            at: {
                // Native rendering knows forced colors better than we do; the
                // retained accentColor keeps the fallback branded elsewhere.
                'forced-colors': {
                    base: { appearance: 'auto', '--slider-halo': 'transparent' },
                },
            },
        },
        // The composed range projection (#325): MD3's active/inactive track
        // and round handle as real parts. Same inks as the gradient control
        // above — accent fill on a secondary-container rail.
        track: {
            base: {
                height: 'calc(var(--size-selector) * 2)',
                marginBlock: 'calc(var(--size-selector) * 4)',
                borderRadius: '624rem',
                background: 'var(--color-secondary-soft)',
                cursor: 'pointer',
            },
            states: { readonly: { cursor: 'default' }, disabled: { cursor: 'not-allowed' } },
        },
        range: {
            base: {
                height: '100%',
                borderRadius: '624rem',
                background: 'var(--slider-accent)',
            },
            states: { disabled: {} },
        },
        thumb: {
            base: {
                width: 'calc(var(--size-selector) * 5)',
                height: 'calc(var(--size-selector) * 5)',
                insetBlockStart: '50%',
                translate: '0 -50%',
                marginInlineStart: 'calc(var(--size-selector) * -2.5)',
                borderRadius: '624rem',
                background: 'var(--slider-accent)',
                cursor: 'pointer',
                outline: 'none',
                touchAction: 'none',
                transition: motion('box-shadow'),
            },
            states: {
                // The MD3 state-layer halo, and — for keyboard — the same
                // crisp two-tone ring the native thumb draws inside it.
                pressed: { boxShadow: '0 0 0 calc(var(--size-selector) * 2.5) color-mix(in oklab, var(--slider-accent) 12%, transparent)' },
                'focus-visible': {
                    boxShadow: '0 0 0 2px var(--color-base-100), '
                        + '0 0 0 4px var(--color-secondary), '
                        + '0 0 0 calc(var(--size-selector) * 2.5) color-mix(in oklab, var(--slider-accent) 10%, transparent)',
                },
                // Readonly answers to nothing, so it does not invite a click.
                readonly: { cursor: 'default' },
                disabled: { cursor: 'not-allowed' },
            },
        },
        mark: {
            base: {
                paddingBlockStart: 'calc(var(--size-selector) * 2 + var(--space-2xs))',
                fontSize: 'var(--text-xs)',
                lineHeight: 'var(--leading-none)',
                whiteSpace: 'nowrap',
                color: 'var(--color-outline)',
            },
            states: { disabled: {} },
            selectors: {
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    insetBlockStart: '0',
                    insetInlineStart: '-1px',
                    width: '2px',
                    height: 'calc(var(--size-selector) * 2)',
                    background: 'var(--color-outline)',
                },
            },
        },
        'value-text': { base: { fontSize: 'var(--text-xs)', color: 'var(--color-outline)' } },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--slider-accent': `var(--color-${c})`,
        } } }])),
        // The control's box height is the size lever (track and thumb keep
        // their MD3 metrics); md is the resting height, so it only steps the
        // label.
        size: {
            xs: { control: { base: { height: 'calc(var(--size-selector) * 6)' } }, label: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { control: { base: { height: 'calc(var(--size-selector) * 8)' } }, label: { base: { fontSize: 'var(--text-sm)' } } },
            md: { label: { base: { fontSize: 'var(--text-sm)' } } },
            lg: { control: { base: { height: 'calc(var(--size-selector) * 12)' } }, label: { base: { fontSize: 'var(--text-md)' } } },
            xl: { control: { base: { height: 'calc(var(--size-selector) * 14)' } }, label: { base: { fontSize: 'var(--text-lg)' } } },
        },
    },
    skipStates: { root: ['invalid', 'focus-visible'] },
    targets: {
        web: {
            parts: {
                // A vertical native range is spelled through writing mode by the
                // runtime (#170): the long axis is the box's HEIGHT, the channel's
                // WIDTH, and the fill grows from the foot.
                control: {
                    selectors: {
                        '&[data-orientation="vertical"]': {
                            width: 'calc(var(--size-selector) * 10)',
                            height: 'var(--slider-length)',
                            '--slider-track': 'linear-gradient(to top, var(--slider-accent) var(--slider-percent, 50%), var(--color-secondary-soft) 0)',
                        },
                        '&[data-orientation="vertical"]::-webkit-slider-runnable-track': {
                            width: 'calc(var(--size-selector) * 2)',
                            height: 'auto',
                        },
                        // Blink lays the thumb against the channel's block axis — in
                        // vertical-lr that is its left edge.
                        '&[data-orientation="vertical"]::-webkit-slider-thumb': {
                            marginTop: '0',
                            marginBlockStart: 'calc(var(--size-selector) * -1.5)',
                        },
                        '&[data-orientation="vertical"]::-moz-range-track': {
                            width: 'calc(var(--size-selector) * 2)',
                            height: '100%',
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
                            width: 'calc(var(--size-selector) * 2)',
                            height: 'var(--slider-length)',
                            marginBlock: '0',
                            marginInline: 'calc(var(--size-selector) * 4)',
                        },
                    },
                },
                range: {
                    selectors: {
                        '&[data-orientation="vertical"]': { insetInlineStart: '0', width: '100%' },
                    },
                },
                thumb: {
                    selectors: {
                        '&[data-orientation="vertical"]': {
                            insetBlockStart: 'auto',
                            insetInlineStart: '50%',
                            translate: 'none',
                            marginInlineStart: 'calc(calc(var(--size-selector) * 5) / -2)',
                            marginBlockEnd: 'calc(calc(var(--size-selector) * 5) / -2)',
                        },
                    },
                },
                // The label sits beside the channel, centred on its tick.
                mark: {
                    selectors: {
                        '&[data-orientation="vertical"]': {
                            insetInlineStart: '0',
                            paddingBlockStart: '0',
                            paddingInlineStart: 'calc(var(--size-selector) * 2 + var(--space-2xs))',
                            translate: '0 50%',
                        },
                        '&[data-orientation="vertical"]::before': {
                            insetBlockStart: '50%',
                            insetInlineStart: '0',
                            width: 'calc(var(--size-selector) * 2)',
                            height: '2px',
                            translate: '0 -50%',
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
        '--progress-track-size': 'calc(var(--size-field) * 1.5)',
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
                // MD3's secondary-container track tone — deliberately NOT the
                // accent (matches the slider's remaining-track colour).
                background: 'var(--color-secondary-soft)',
                overflow: 'hidden',
            },
        },
        range: {
            base: {
                height: '100%',
                borderRadius: '624rem',
                background: 'var(--progress-accent)',
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
        'value-text': { base: { fontSize: 'var(--text-xs)', color: 'var(--color-outline)' } },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--progress-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--progress-track-size': 'calc(var(--size-field) * 0.75)' } } },
            sm: { root: { base: { '--progress-track-size': 'var(--size-field)' } } },
            md: { root: { base: { '--progress-track-size': 'calc(var(--size-field) * 1.5)' } } },
            lg: { root: { base: { '--progress-track-size': 'calc(var(--size-field) * 2)' } } },
            xl: { root: { base: { '--progress-track-size': 'calc(var(--size-field) * 3)' } } },
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
            rounded: { root: { base: { borderRadius: 'var(--radius-selector)' } } },
        },
        // A tonal container, per Material's own avatar/monogram treatment —
        // the tint carries the role, the ink is the role itself. Unattributed
        // it stays on the neutral surface container it always used.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--avatar-accent': `var(--color-${c}-soft)`,
            '--avatar-on-accent': `var(--color-${c})`,
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
        '--toast-accent': 'var(--color-primary)',
        '--toast-from': '8px',
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
        root: {
            base: {
                ...raised('level3'),
                pointerEvents: 'auto',
                display: 'grid',
                // Four columns now: the status marker, the text, the action,
                // the close. The marker is `::before`, a grid item like any
                // other child.
                gridTemplateColumns: 'auto 1fr auto auto',
                alignItems: 'center',
                columnGap: 'var(--space-md)',
                padding: 'var(--space-md) var(--space-lg)',
                borderRadius: 'var(--radius-field)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                opacity: '0',
                transform: 'translateY(var(--toast-from))',
                transition: 'opacity var(--duration-normal) var(--ease-emphasized), '
                    + 'transform var(--duration-normal) var(--ease-emphasized)',
            },
            selectors: {
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
                },
            },
            states: {
                open: { opacity: '1', transform: 'none' },
                closed: {},
            },
            at: {
                'reduced-motion': { base: { transition: 'none' }, states: { open: { transform: 'none' } } },
                // A forced palette repaints backgrounds, which would erase a
                // marker that is nothing but one — the same trade the radio
                // dot makes. A system colour is honoured as given.
                'forced-colors': { selectors: { '&::before': { background: 'CanvasText' } } },
            },
        },
        title: {
            base: { gridColumn: '2', ...label },
        },
        description: {
            base: {
                gridColumn: '2',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xs)',
                color: 'color-mix(in oklab, var(--color-surface-container-high-content) 80%, transparent)',
            },
        },
        action: withPresence(pressable('toast', 'var(--toast-accent)'), {
            base: {
                gridColumn: '3',
                gridRow: '1',
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'var(--toast-accent)',
                borderRadius: '624rem',
                padding: 'var(--space-2xs) var(--space-md)',
                ...label,
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
            },
            states: { disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' }, ...focusRing },
        }),
        close: withPresence(pressable('toast', 'var(--color-surface-container-high-content)'), {
            base: {
                gridColumn: '4',
                gridRow: '1',
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'var(--color-surface-container-high-content)',
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
            { root: { base: { '--toast-accent': `var(--color-${role})` } } },
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
    keyframes: rippleKeyframes('toast'),
};

export const combobox: RecipeInput = {
    component: 'combobox',
    // Accent defaults in `tokens:` — the un-attributed render IS the primary
    // variant; `variants.color` only rebinds the custom properties.
    tokens: {
        '--combobox-accent': 'var(--color-primary)',
        '--combobox-soft': 'var(--color-primary-soft)',
    },
    parts: {
        root: { base: { display: 'inline-flex', position: 'relative' } },
        // Material's filled text field: rounded top, flat bottom, underline.
        control: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                minWidth: '12rem',
                background: 'var(--color-surface-container)',
                color: 'var(--color-surface-container-content)',
                borderBottom: '2px solid var(--color-outline)',
                borderRadius: 'var(--radius-selector) var(--radius-selector) 0 0',
                transition: motion('border-color'),
            },
            states: {
                open: { borderBottomColor: 'var(--combobox-accent)' },
                closed: {},
                // Semantic role state, deliberately NOT the accent.
                invalid: { borderBottomColor: 'var(--color-error)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
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
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-md)',
                padding: 'var(--space-sm) var(--space-md)',
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
                '&::placeholder': { color: 'var(--color-outline)' },
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
                borderRadius: 'var(--radius-selector)',
                ...label,
            },
            states: { disabled: {} },
        },
        'tag-label': { base: { whiteSpace: 'nowrap' } },
        'tag-remove': {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                font: 'inherit',
                borderRadius: 'var(--radius-selector)',
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
        popup: withPresence(popupPresence('scale(0.9)'), { base: { ...floating, minWidth: '12rem' }, states: { open: {}, closed: {} } }),
        // The optgroup equivalent (#325) — the menu's group grammar.
        group: { base: { padding: 'var(--space-2xs) 0' } },
        'group-label': {
            base: {
                padding: 'var(--space-2xs) var(--space-md)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'var(--color-outline)',
            },
        },
        // A windowed group's heading (#127): the same overline as the label,
        // as a row of the flat window instead of inside a `group`.
        'group-heading': {
            base: {
                padding: 'var(--space-2xs) var(--space-md)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'var(--color-outline)',
            },
        },
        item: withPresence(pressable('combobox', 'var(--combobox-accent)'), {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: 'var(--space-xs) var(--space-md)',
                borderRadius: 'var(--radius-selector)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
            },
            states: {
                highlighted: { background: 'var(--combobox-soft)' },
                // MD3's secondary-container fill for a selected row —
                // deliberately NOT the accent.
                selected: { background: 'var(--color-secondary-soft)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
            },
        }),
        'item-indicator': { base: { color: 'var(--combobox-accent)' } },
        empty: {
            base: {
                padding: 'var(--space-md)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                textAlign: 'center',
                color: 'var(--color-outline)',
            },
        },
        // The list still arriving (#280): the empty row's outline ink.
        loading: {
            base: {
                padding: 'var(--space-md)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                textAlign: 'center',
                color: 'var(--color-outline)',
            },
        },
        // The menu's rule between runs of options (#280).
        separator: {
            base: { height: 'var(--border)', margin: 'var(--space-2xs) 0', background: 'var(--color-outline)' },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--combobox-accent': `var(--color-${c})`,
            '--combobox-soft': `var(--color-${c}-soft)`,
        } } }])),
        // The button's ramp rhythm anchored on the field's resting values
        // (md = the base's padding/fontSize).
        size: {
            xs: { input: { base: { padding: 'var(--space-2xs) var(--space-xs)', fontSize: 'var(--text-xs)' } } },
            sm: { input: { base: { padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--text-sm)' } } },
            md: { input: { base: { padding: 'var(--space-sm) var(--space-md)', fontSize: 'var(--text-md)' } } },
            lg: { input: { base: { padding: 'var(--space-md) var(--space-lg)', fontSize: 'var(--text-lg)' } } },
            xl: { input: { base: { padding: 'var(--space-lg) var(--space-xl)', fontSize: 'var(--text-xl)' } } },
        },
    },
    // The visible ring lives on `control`; input and trigger delegate.
    skipStates: {
        input: ['focus-visible'],
        trigger: ['focus-visible'],
    },
    keyframes: rippleKeyframes('combobox'),
};

// ── Toggle, toggle group ──────────────────────────────────────────────────
/**
 * Material's outlined toggle button: a hairline pill while off, the accent
 * fill once on. Same accent-pair indirection as button, plus a `--toggle-ink`
 * the on state flips so the state layer/ripple is on-surface while outlined
 * and the on-color once filled.
 */
export const toggle: RecipeInput = {
    component: 'toggle',
    tokens: {
        '--toggle-accent': 'var(--color-primary)',
        '--toggle-on-accent': 'var(--color-primary-content)',
        '--toggle-ink': 'var(--color-base-content)',
    },
    parts: {
        root: withPresence(pressable('toggle', 'var(--toggle-ink)'), {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-xs)',
                background: 'transparent',
                color: 'var(--color-base-content)',
                border: 'var(--border) solid var(--color-outline)',
                borderRadius: 'var(--radius-field)',
                ...label,
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
                transition: motion('background, color, border-color'),
            },
            states: {
                on: {
                    background: 'var(--toggle-accent)',
                    color: 'var(--toggle-on-accent)',
                    borderColor: 'var(--toggle-accent)',
                    '--toggle-ink': 'var(--toggle-on-accent)',
                },
                off: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
        }),
    },
    keyframes: rippleKeyframes('toggle'),
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [
            c,
            {
                root: {
                    base: {
                        '--toggle-accent': `var(--color-${c})`,
                        '--toggle-on-accent': `var(--color-${c}-content)`,
                    },
                },
            },
        ])),
        size: {
            xs: { root: { base: { padding: 'var(--space-2xs) var(--space-sm)', fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { padding: 'var(--space-xs) var(--space-md)', fontSize: 'var(--text-sm)' } } },
            md: { root: { base: { padding: 'var(--space-xs) var(--space-lg)', fontSize: 'var(--text-sm)' } } },
            lg: { root: { base: { padding: 'var(--space-sm) var(--space-xl)', fontSize: 'var(--text-md)' } } },
            xl: { root: { base: { padding: 'var(--space-md) var(--space-2xl)', fontSize: 'var(--text-lg)' } } },
        },
    },
    defaultVariants: { color: 'primary', size: 'md' },
};

/**
 * Material's segmented button: connected outlined segments in one fully
 * rounded pill, hairlines between them, and the on segment taking the
 * container fill. MD3 names that fill secondary-container; in this
 * vocabulary it is the `secondary` soft/role pair — the same pairing the
 * button's soft variant uses.
 */
export const toggleGroup: RecipeInput = {
    component: 'toggle-group',
    // Public to a design system derived from this one (#73).
    hooks: {
        properties: {
            '--toggle-group-fill': 'The fill of an off item.',
            '--toggle-group-on-fill': 'The fill of an on item.',
            '--toggle-group-ink': 'The item ink.',
        },
    },
    tokens: {
        '--toggle-group-fill': 'var(--color-secondary-soft)',
        '--toggle-group-on-fill': 'var(--color-secondary)',
        '--toggle-group-ink': 'var(--color-base-content)',
    },
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                border: 'var(--border) solid var(--color-outline)',
                // The segmented pill: Material's fully-rounded action shape.
                borderRadius: '624rem',
                overflow: 'hidden',
            },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
            selectors: {
                '&[data-orientation="vertical"]': { flexDirection: 'column' },
            },
        },
        item: withPresence(pressable('toggle-group', 'var(--toggle-group-ink)'), {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-xs)',
                background: 'transparent',
                color: 'var(--color-base-content)',
                border: 'none',
                padding: 'var(--space-xs) var(--space-lg)',
                ...label,
                lineHeight: 'var(--leading-none)',
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
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
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
            },
        }),
    },
    keyframes: rippleKeyframes('toggle-group'),
    variants: {
        // The group is a frame around its items, so the ramp lands on the
        // items and the frame follows their box.
        size: {
            xs: { item: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-2xs) var(--space-2xs)' } } },
            sm: { item: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-2xs) var(--space-xs)' } } },
            // `md` is the un-attributed render: the base already IS the
            // middle step, so restating it here would be a second copy free
            // to drift. An empty entry emits no rule and keeps the base.
            md: {},
            lg: { item: { base: { fontSize: 'var(--text-sm)', padding: 'var(--space-xs) var(--space-md)' } } },
            xl: { item: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-sm) var(--space-lg)' } } },
        },
        color: Object.fromEntries(ROLES.map((c) => [
            c,
            {
                item: {
                    base: {
                        '--toggle-group-fill': `var(--color-${c}-soft)`,
                        '--toggle-group-on-fill': `var(--color-${c})`,
                    },
                },
            },
        ])),
    },
    defaultVariants: { color: 'secondary' },
};

// ── Number input ──────────────────────────────────────────────────────────
/**
 * The stepper: an icon button riding inside the outlined field. Bounded
 * MD3 press feedback (state layer + ripple) clipped to its own pill; the
 * margin keeps the pill off the field's hairline.
 */
const stepper: PartStyles = withPresence(pressable('number-input'), {
    base: {
        appearance: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'stretch',
        border: 'none',
        background: 'transparent',
        color: 'var(--color-primary)',
        borderRadius: '624rem',
        margin: 'var(--space-2xs)',
        padding: '0 var(--space-md)',
        ...label,
        fontSize: 'var(--text-md)',
        cursor: 'pointer',
        userSelect: 'none',
    },
    states: {
        disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
    },
});

/**
 * Material's outlined text field over the number-input anatomy: a hairline
 * box, the focus indicator and error tint drawing on the chrome (the
 * Combobox control/input split), steppers flanking the centered input.
 */
export const numberInput: RecipeInput = {
    component: 'number-input',
    tokens: { '--number-input-accent': 'var(--color-secondary)' },
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
        // The field chrome: the ring and the invalid tint draw on the box;
        // input and steppers sit inside the outline.
        control: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                background: 'transparent',
                color: 'var(--color-base-content)',
                border: 'var(--border) solid var(--color-outline)',
                borderRadius: 'var(--radius-field)',
                transition: motion('border-color'),
            },
            states: {
                invalid: { borderColor: 'var(--color-error)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
                readonly: {},
                'focus-visible': { ...focusRing['focus-visible'], outline: '3px solid var(--number-input-accent)' },
            },
        },
        input: {
            base: {
                width: '5rem',
                minWidth: '0',
                appearance: 'none',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'inherit',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-md)',
                textAlign: 'center',
                padding: 'var(--space-sm) var(--space-xs)',
            },
            states: {
                disabled: { cursor: 'not-allowed' },
                readonly: {},
                invalid: {},
                required: {},
            },
            selectors: {
                '&::placeholder': { color: 'var(--color-outline)' },
            },
        },
        'increment-trigger': stepper,
        'decrement-trigger': stepper,
    },
    // The visible ring lives on `control`; the input delegates.
    skipStates: { input: ['focus-visible'] },
    keyframes: rippleKeyframes('number-input'),
    variants: {
        // The field's own ring carries the role — the chrome is neutral, so
        // the focus state is the only place a number input can show colour.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--number-input-accent': `var(--color-${c})`,
        } } }])),
        // The readout carries the ramp; the steppers follow it so the frame
        // stays proportional.
        size: {
            xs: { input: { base: { fontSize: 'var(--text-sm)', padding: 'var(--space-2xs) var(--space-2xs)' } } },
            sm: { input: { base: { fontSize: 'var(--text-sm)', padding: 'var(--space-xs) var(--space-2xs)' } } },
            // `md` is the un-attributed render: the base already IS the
            // middle step, so restating it here would be a second copy free
            // to drift. An empty entry emits no rule and keeps the base.
            md: {},
            lg: { input: { base: { fontSize: 'var(--text-lg)', padding: 'var(--space-md) var(--space-sm)' } } },
            xl: { input: { base: { fontSize: 'var(--text-xl)', padding: 'var(--space-lg) var(--space-md)' } } },
        },
    },
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
                    borderRadius: 'var(--radius-selector)',
                },
            },
        },
        item: {
            base: {
                fontSize: 'var(--rating-size)',
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
                userSelect: 'none',
                color: 'var(--color-outline)',
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
                    borderRadius: 'var(--radius-selector)',
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
        borderRadius: 'var(--radius-selector)',
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

export const treeView: RecipeInput = {
    component: 'tree-view',
    tokens: {
        '--tree-accent': 'var(--color-secondary-soft)',
        '--tree-text': 'var(--text-sm)',
        '--tree-on-accent': 'var(--color-base-content)',
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
        // A tree colours one thing: the selected row. Everything else is
        // structure, and tinting it would fight the content.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--tree-accent': `var(--color-${c})`,
            '--tree-on-accent': `var(--color-${c}-content)`,
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
 * Material's outlined text field, minus the notched floating label: zero's
 * anatomy puts the label above the box as its own part, and Material's notch
 * is a box-decoration trick that needs the label INSIDE the outline. Styling
 * one from here would mean absolutely positioning `label` over `control` and
 * guessing at its width — so this takes Material's other documented option,
 * the outlined field with a persistent label above it, and keeps the outline,
 * the tracking and the required asterisk that make it read as Material.
 */
export const input: RecipeInput = {
    component: 'input',
    tokens: { '--input-accent': 'var(--color-secondary)' },
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
        control: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                background: 'transparent',
                color: 'var(--color-base-content)',
                border: 'var(--border) solid var(--color-outline)',
                borderRadius: 'var(--radius-field)',
                transition: motion('border-color'),
            },
            states: {
                invalid: { borderColor: 'var(--color-error)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
                readonly: {},
                'focus-visible': { ...focusRing['focus-visible'], outline: '3px solid var(--input-accent)' },
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
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-md)',
                padding: 'var(--space-sm) var(--space-md)',
            },
            states: {
                disabled: { cursor: 'not-allowed' },
                readonly: {},
                invalid: {},
                required: {},
            },
            selectors: {
                '&::placeholder': { color: 'var(--color-outline)' },
            },
        },
    },
    // The visible ring lives on `control`; the input delegates.
    skipStates: { input: ['focus-visible'] },
    variants: {
        // The field's own ring carries the role — the outline is neutral, so
        // focus is the only place a text field shows colour.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--input-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { input: { base: { fontSize: 'var(--text-sm)', padding: 'var(--space-2xs) var(--space-xs)' } } },
            sm: { input: { base: { fontSize: 'var(--text-sm)', padding: 'var(--space-xs) var(--space-sm)' } } },
            // `md` is the un-attributed render: the base already IS the
            // middle step.
            md: {},
            lg: { input: { base: { fontSize: 'var(--text-lg)', padding: 'var(--space-md) var(--space-lg)' } } },
            xl: { input: { base: { fontSize: 'var(--text-xl)', padding: 'var(--space-lg) var(--space-xl)' } } },
        },
    },
};

/** The same outlined field, drawn on the element — see the textarea anatomy. */
export const textarea: RecipeInput = {
    component: 'textarea',
    tokens: { '--textarea-accent': 'var(--color-secondary)' },
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
        textarea: {
            base: {
                display: 'block',
                width: '100%',
                // border-box, or `width: 100%` plus the padding and border is
                // wider than the column it fills — 26–34px at phone width (#45).
                boxSizing: 'border-box',
                minWidth: '0',
                appearance: 'none',
                background: 'transparent',
                color: 'var(--color-base-content)',
                border: 'var(--border) solid var(--color-outline)',
                borderRadius: 'var(--radius-field)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-md)',
                lineHeight: 'var(--leading-normal)',
                padding: 'var(--space-sm) var(--space-md)',
                resize: 'vertical',
                transition: motion('border-color'),
            },
            states: {
                invalid: { borderColor: 'var(--color-error)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                readonly: {},
                required: {},
                'focus-visible': { ...focusRing['focus-visible'], outline: '3px solid var(--textarea-accent)' },
            },
            selectors: {
                '&::placeholder': { color: 'var(--color-outline)' },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--textarea-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { textarea: { base: { fontSize: 'var(--text-sm)', padding: 'var(--space-2xs) var(--space-xs)' } } },
            sm: { textarea: { base: { fontSize: 'var(--text-sm)', padding: 'var(--space-xs) var(--space-sm)' } } },
            md: {},
            lg: { textarea: { base: { fontSize: 'var(--text-lg)', padding: 'var(--space-md) var(--space-lg)' } } },
            xl: { textarea: { base: { fontSize: 'var(--text-xl)', padding: 'var(--space-lg) var(--space-xl)' } } },
        },
    },
};

// ── Content tier (#311) ───────────────────────────────────────────────────
/**
 * Material's elevated card: a tonal surface container rather than base-100,
 * the `radius-box` corner, and one elevation step. The role rides the same
 * `--md-*` indirection the rest of this skin uses.
 */
export const card: RecipeInput = {
    component: 'card',
    // Public to a design system derived from this one (#73).
    hooks: {
        properties: {
            '--card-pad': 'The card padding.',
            '--card-accent': 'The accent colour.',
        },
    },
    tokens: { '--card-pad': 'var(--space-lg)', '--card-accent': 'var(--color-primary)' },
    parts: {
        root: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--color-surface-container)',
                color: 'var(--color-surface-container-content)',
                borderRadius: 'var(--radius-box)',
                boxShadow: 'var(--shadow-level1)',
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
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--weight-medium)',
                letterSpacing: 'var(--tracking-wide)',
                lineHeight: 'var(--leading-tight)',
            },
        },
        description: {
            base: {
                margin: '0',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-base-content)',
                opacity: '0.78',
            },
        },
        body: {
            base: { padding: 'var(--card-pad)', fontSize: 'var(--text-md)', lineHeight: 'var(--leading-normal)' },
        },
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
        // Material tints an accented card through its border, not its fill:
        // the tonal surface IS the card's colour, and re-tinting it would
        // fight the elevation ramp it belongs to.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--card-accent': `var(--color-${c})`,
            borderTop: `calc(var(--border) * 3) solid var(--card-accent)`,
        } } }])),
        size: {
            xs: { root: { base: { '--card-pad': 'var(--space-sm)' } } },
            sm: { root: { base: { '--card-pad': 'var(--space-md)' } } },
            md: {},
            lg: { root: { base: { '--card-pad': 'var(--space-xl)' } } },
            xl: { root: { base: { '--card-pad': 'var(--space-2xl)' } } },
        },
    },
};

/** Material's banner: the role's soft tint, its outline, and the icon in ink. */
export const alert: RecipeInput = {
    component: 'alert',
    tokens: {
        '--alert-tint': 'var(--color-info-soft)',
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
                color: 'var(--color-base-content)',
                border: 'var(--border) solid var(--alert-accent)',
                borderRadius: 'var(--radius-box)',
                padding: 'var(--space-md) var(--space-lg)',
            },
            states: { open: {}, closed: {} },
        },
        icon: {
            base: {
                gridRow: '1 / span 2',
                display: 'inline-flex',
                alignItems: 'center',
                color: 'var(--alert-accent)',
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
                borderRadius: 'var(--radius-selector)',
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
                color: 'var(--color-base-content)',
                borderRadius: 'var(--radius-box)',
            },
        },
        icon: {
            base: {
                display: 'inline-flex',
                color: 'var(--empty-accent)',
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
                borderRadius: 'var(--radius-selector)',
                padding: 'var(--space-2xs) var(--space-xs)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-medium)',
                letterSpacing: 'var(--tracking-wide)',
                lineHeight: 'var(--leading-normal)',
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
    tokens: { '--divider-ink': 'var(--color-outline)', '--divider-thickness': 'var(--border)' },
    parts: {
        root: {
            base: { border: 'none', background: 'var(--divider-ink)', alignSelf: 'stretch' },
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
            base: { borderRadius: 'var(--radius-box)' },
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
            xs: { root: { base: { borderRadius: 'var(--radius-selector)' } } },
            sm: { root: { base: { borderRadius: 'var(--radius-selector)' } } },
            md: {},
            lg: { root: { base: { borderRadius: 'var(--radius-box)' } } },
            xl: { root: { base: { borderRadius: 'var(--radius-box)' } } },
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
        '--spinner-size': 'calc(var(--size-field) * 0.6)',
        '--spinner-ink': 'var(--color-primary)',
        '--spinner-track': 'var(--color-outline)',
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
                animation: 'zero-material-spin 0.7s linear infinite',
            },
            at: { 'reduced-motion': { base: { animation: 'none' } } },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--spinner-ink': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--spinner-size': 'calc(var(--size-field) * 0.4)' } } },
            sm: { root: { base: { '--spinner-size': 'calc(var(--size-field) * 0.5)' } } },
            md: {},
            lg: { root: { base: { '--spinner-size': 'calc(var(--size-field) * 0.8)' } } },
            xl: { root: { base: { '--spinner-size': 'var(--size-field)' } } },
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
                borderRadius: 'var(--radius-selector)',
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
                borderRadius: 'var(--radius-box)',
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
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
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
                borderRadius: 'var(--radius-field)',
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

/** Material chat: tonal bubbles, the seated corner at selector radius. */
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
                background: 'var(--chat-fill)',
                color: 'var(--chat-ink)',
                borderRadius: 'var(--radius-box)',
            },
            selectors: {
                '[data-scope="chat"][data-part="root"][data-placement="start"] > &': {
                    gridColumn: '2',
                    borderEndStartRadius: 'var(--radius-selector)',
                },
                '[data-scope="chat"][data-part="root"][data-placement="end"] > &': {
                    gridColumn: '1',
                    borderEndEndRadius: 'var(--radius-selector)',
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

/** Material radial: the M3 circular indicator, with a visible channel. */
export const radialProgress: RecipeInput = {
    component: 'radial-progress',
    tokens: {
        '--radial-size': 'calc(var(--size-selector) * 16)',
        '--radial-thickness': 'calc(var(--size-selector) * 1.5)',
        '--radial-ink': 'var(--color-primary)',
        '--radial-track': 'var(--color-surface-container)',
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
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--radial-ink': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--radial-size': 'calc(var(--size-selector) * 10)', '--radial-thickness': 'calc(var(--size-selector) * 1)' } } },
            sm: { root: { base: { '--radial-size': 'calc(var(--size-selector) * 13)', '--radial-thickness': 'calc(var(--size-selector) * 1.25)' } } },
            md: {},
            lg: { root: { base: { '--radial-size': 'calc(var(--size-selector) * 20)', '--radial-thickness': 'calc(var(--size-selector) * 2)' } } },
            xl: { root: { base: { '--radial-size': 'calc(var(--size-selector) * 24)', '--radial-thickness': 'calc(var(--size-selector) * 2.5)' } } },
        },
    },
    keyframes: { 'zero-material-radial-spin': 'to { transform: rotate(360deg); }' },
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

/**
 * Navbar — M3's top app bar: a surface-container band, no border (Material
 * separates by tone, not line), the title area in the headline type. Colour
 * refills the band with the role pair, which is the M1-era coloured app bar
 * Material still specifies for expressive products.
 */
export const navbar: RecipeInput = {
    component: 'navbar',
    parts: {
        root: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                minBlockSize: '4rem',
                paddingInline: 'var(--space-lg)',
                background: 'var(--color-surface-container)',
                color: 'var(--color-surface-container-content)',
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
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            background: `var(--color-${c})`,
            color: `var(--color-${c}-content)`,
        } } }])),
        size: {
            xs: { root: { base: { minBlockSize: '2.75rem', fontSize: 'var(--text-sm)' } } },
            sm: { root: { base: { minBlockSize: '3.25rem', fontSize: 'var(--text-sm)' } } },
            md: {},
            lg: { root: { base: { minBlockSize: '5rem' } } },
            xl: { root: { base: { minBlockSize: '6rem', fontSize: 'var(--text-lg)' } } },
        },
    },
};

/**
 * NavList (zero#132) — Material's navigation drawer items: pill rows, a
 * state-layer wash on hover, and the active item as the secondary
 * container with its on-colour — the same pair the role axis remaps.
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
        '--nav-tint': 'var(--color-secondary-soft)',
        '--nav-ink': 'var(--color-base-content)',
    },
    parts: {
        root: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-lg)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-base-content)',
            },
        },
        group: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' },
        },
        heading: {
            base: {
                ...label,
                padding: '0 var(--space-lg)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-base-content)',
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
                color: 'var(--nav-ink)',
                padding: 'var(--space-sm) var(--space-lg)',
                borderRadius: '9999px',
                fontWeight: 'var(--weight-medium)',
                lineHeight: 'var(--leading-tight)',
                transition: motion('background, color'),
            },
            states: {
                hover: { background: 'color-mix(in oklab, var(--color-base-content) 8%, transparent)' },
                active: { background: 'var(--nav-tint)', color: 'var(--nav-accent)' },
                inactive: {},
                ...focusRing,
            },
        },
        icon: {
            base: {
                display: 'inline-flex',
                inlineSize: '1.5em',
                justifyContent: 'center',
                flex: 'none',
                lineHeight: 'var(--leading-none)',
            },
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
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--nav-accent': `var(--color-${c})`,
            '--nav-tint': `var(--color-${c}-soft)`,
        } } }])),
        size: {
            xs: { root: { base: { fontSize: 'var(--text-xs)' } }, link: { base: { padding: 'var(--space-2xs) var(--space-md)' } } },
            sm: { root: { base: { fontSize: 'var(--text-xs)' } }, link: { base: { padding: 'var(--space-xs) var(--space-md)' } } },
            md: {},
            lg: { root: { base: { fontSize: 'var(--text-md)' } }, link: { base: { padding: 'var(--space-md) var(--space-xl)' } } },
            xl: { root: { base: { fontSize: 'var(--text-lg)' } }, link: { base: { padding: 'var(--space-lg) var(--space-xl)' } } },
        },
    },
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
        },
        link: {
            base: {
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
                textDecoration: 'none',
                borderRadius: 'var(--radius-selector)',
                transition: 'color var(--duration-fast) var(--ease-standard)',
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
                borderRadius: '9999px',
                fontSize: 'calc(var(--pg-font) * 1.2)',
                lineHeight: 'var(--leading-none)',
                appearance: 'none',
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
                borderRadius: '9999px',
                fontSize: 'calc(var(--pg-font) * 1.2)',
                lineHeight: 'var(--leading-none)',
                appearance: 'none',
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
        },
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

/**
 * Steps — M3's process rail: tonal discs (surface-container at rest, the
 * primary pair when current, a primary-tinted tonal disc once walked), the
 * connector a hairline that takes the primary once crossed. The washes are
 * the simple read of the state layer, as in pagination.
 */
export const steps: RecipeInput = {
    component: 'steps',
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
 * `translate` is physical, so the travel is a custom property that flips with
 * the placement AND the direction — off the reading start is leftward in LTR
 * and rightward in RTL (the `rtl` hedge, as everywhere here). Keyed on
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
        return `translate ${tempo}, display ${duration} allow-discrete, overlay ${duration} allow-discrete`;
    };
    return {
        base: { '--drawer-travel': '-100%' },
        selectors: {
            '&[data-placement="end"]': { '--drawer-travel': '100%' },
            [`&[data-placement="start"]${rtl}`]: { '--drawer-travel': '100%' },
            [`&[data-placement="end"]${rtl}`]: { '--drawer-travel': '-100%' },
            [sheet]: { opacity: '1', translate: 'var(--drawer-travel) 0', transition: travel(exit) },
            [open]: { translate: 'none', transition: travel(enter) },
        },
        at: {
            'starting-style': { selectors: { [open]: { opacity: '1', translate: 'var(--drawer-travel) 0' } } },
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
        trigger: withPresence(pressable('drawer', 'var(--overlay-accent)'), {
            base: outlinedTrigger,
            states: { open: {}, closed: {}, disabled: disabledFade, ...focusRing },
        }),
        panel: withPresence(withPresence(popupPresence('none'), sheetSlide(
            'var(--duration-normal) var(--ease-emphasized-decelerate)',
            'var(--duration-normal) var(--ease-emphasized-accelerate)',
        )), {
            base: {
                padding: 'var(--space-lg)',
                background: 'var(--color-surface-container)',
                color: 'var(--color-surface-container-content)',
                border: 'none',
                borderRadius: 'var(--radius-box)',
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
                '&[data-l-dock="sheet"]': {
                    position: 'fixed',
                    insetBlockStart: '0',
                    insetBlockEnd: '0',
                    blockSize: '100dvh',
                    maxBlockSize: '100dvh',
                    margin: '0',
                    borderRadius: '0',
                },
                '&[data-placement="start"][data-l-dock="sheet"]': { insetInlineStart: '0', insetInlineEnd: 'auto' },
                '&[data-placement="end"][data-l-dock="sheet"]': { insetInlineStart: 'auto', insetInlineEnd: '0' },
            },
        }),
        backdrop: {
            base: { background: 'oklch(0% 0 0 / 0.32)' },
            states: { open: {}, closed: {} },
        },
        title: {
            base: {
                margin: '0 0 var(--space-md)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--weight-medium)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'color-mix(in oklch, var(--color-surface-container-content) 80%, transparent)',
            },
        },
        close: withPresence(pressable('drawer'), {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'var(--color-primary)',
                borderRadius: '624rem',
                padding: 'var(--space-xs) var(--space-lg)',
                ...label,
                cursor: 'pointer',
            },
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
                borderRadius: 'var(--radius-box)',
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
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
            },
            at: tableStackAt(tokens, 'caption', { paddingInline: '0' }),
        },
        head: {},
        body: { at: tableStackAt(tokens, 'body', { rowGap: 'var(--space-md)' }) },
        foot: {
            base: {
                fontSize: 'var(--text-xs)',
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
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
                borderRadius: 'var(--radius-box)',
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
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
            },
            at: tableStackAt(tokens, 'header-cell', { paddingInline: '0' }),
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
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
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
                borderRadius: 'var(--radius-field)',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard)',
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
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
                border: 'var(--border) dashed var(--color-outline)',
                borderRadius: 'var(--radius-box)',
                background: 'var(--color-surface-container)',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard), '
                    + 'border-color var(--duration-fast) var(--ease-standard)',
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
                borderRadius: 'var(--radius-field)',
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
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
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
                transition: 'background var(--duration-fast) var(--ease-standard)',
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
                transition: 'background var(--duration-fast) var(--ease-standard)',
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
 * Carousel — MD3: the viewport rides the shaped `radius-box` corner, nav
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
                borderRadius: 'var(--radius-box)',
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
                transition: 'background var(--duration-fast) var(--ease-standard)',
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
                transition: 'background var(--duration-fast) var(--ease-standard)',
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
                    border: 'calc(var(--border) * 2) solid color-mix(in oklch, var(--color-base-content) 70%, transparent)',
                    borderRadius: '9999px',
                    background: 'transparent',
                    transition: 'inline-size var(--duration-fast) var(--ease-emphasized), background var(--duration-fast) var(--ease-standard)',
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
                transition: 'transform var(--duration-normal) var(--ease-emphasized), opacity var(--duration-normal) var(--ease-standard)',
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
                transition: 'transform var(--duration-normal) var(--ease-emphasized), opacity var(--duration-normal) var(--ease-standard)',
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
                borderRadius: 'var(--radius-box)',
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
    button, tabs, collapsible, accordion, dialog, popover, tooltip, menu, select,
    switchRecipe, checkbox, radioGroup, field, slider, progress, avatar, toast, combobox,
    toggle, toggleGroup, numberInput, ratingGroup, treeView, input, textarea,
    card, alert, emptyState, badge, divider, skeleton, spinner,
    kbd, status, indicator, stats, timeline, chat, radialProgress, join,
    navbar, navList, breadcrumbs, pagination, steps, drawer,
    table,
    fileUpload,
    carousel,
    swap,
    countdown,
    diff,
];
