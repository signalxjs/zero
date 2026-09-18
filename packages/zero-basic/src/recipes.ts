/**
 * zero-basic recipes — readable neutral styling for every zero component.
 * Pure data — the kit is imported as types, plus `axisRoles` from the
 * browser-safe `/define` subpath; compiled to CSS by build.mjs.
 */
import type { CssProps, PartStyles, RecipeInput } from '@sigx/zero-kit';
import { axisRoles } from '@sigx/zero-kit/define';
import { roles } from './tokens.js';

/**
 * Every role a consumer can pass as `color`, derived from the declaration
 * rather than retyped — a role declared in `tokens.ts` but missing here would
 * silently render as the default colour instead. Roles opting out of
 * `-content` or `-soft` are fills or hairlines, not action colours; this
 * design system declares none.
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

const focusRing: Record<string, PartStyles['base']> = {
    'focus-visible': {
        outline: '2px solid var(--color-primary)',
        outlineOffset: '2px',
    },
};

/**
 * The ink a role writes with on its own soft tint and on bare paper —
 * outline/soft/ghost button text, the on-state of toggles. Six of eight raw
 * roles compute ≥5.53:1 on the tint in both themes; two are codified
 * exceptions rather than hoped about:
 * - `neutral` is a fill, not an ink — near-invisible on its own dark-theme
 *   tint (1.45:1). Base-content is the correct ink in both themes.
 * - `warning` is a light ink in the light theme (2.84:1 on its tint).
 *   A recipe cannot scope a rule to one theme, so the fix must be symmetric:
 *   deepening toward base-content keeps the warm hue and lands on the
 *   readable side in BOTH schemes, because base-content flips with them.
 *   Measured (oklch→sRGB→WCAG, against the shipped token values): the 45/55
 *   mix computes 6.67:1 on the light warning tint and 7.36:1 on light paper;
 *   9.90:1 and 12.35:1 in dark — every surface ≥6.3:1, ≥2.1× the audit's
 *   3:1 hard floor.
 */
const softInk = (role: string): string =>
    role === 'neutral' ? 'var(--color-base-content)'
        : role === 'warning' ? 'color-mix(in oklch, var(--color-warning) 45%, var(--color-base-content))'
            : `var(--color-${role})`;

/**
 * The structural line Monograph draws everything with — regions, popups,
 * separators, indent guides. Depth is hairlines, not shadows.
 */
const hairline = 'var(--border) solid var(--color-base-300)';

/**
 * Hover and pressed feedback as a translucent film of ink rather than a jump
 * to a fixed base step: overlay panels sit on `base-200` in dark (see
 * `overlaySurface`), where a `base-200` wash would vanish. Mixing
 * `base-content` at 6%/12% reads as one/two steps of ink density on any
 * surface, in both schemes.
 *
 * THE RULE: every piece of furniture — tabs, toggles, triggers, steppers,
 * rows — hovers with `inkWash` and presses with `inkWashDeep`, one dialect
 * everywhere. Opaque `base-200`/`base-300` fills are reserved for exactly one
 * idiom, the button's ghost variant, whose wash-then-ink grammar is its own
 * signature (see the `ghost` fill in `button`).
 */
const inkWash = 'color-mix(in oklch, var(--color-base-content) 6%, transparent)';
const inkWashDeep = 'color-mix(in oklch, var(--color-base-content) 12%, transparent)';

/**
 * Pressed is instantaneous ink density — the runtime's press feedback
 * (`data-pressed`), not `:active`: same sink, with keyboard parity and
 * drag-off semantics the pseudo-class can't guarantee. Suppressing the colour
 * transition makes the sink land the frame the pointer does; nothing in
 * Monograph moves under the pointer, so there is no transform. The `:not`
 * covers a press that goes disabled mid-gesture, and the flag's extra
 * attribute outranks the state rules, so pressed wins over any hover or
 * highlighted wash it lands on.
 */
const pressedInk: Record<string, CssProps> = {
    '&[data-pressed]:not([data-disabled])': { background: inkWashDeep, transition: 'none' },
};

/**
 * Every transient surface wears the same costume: a `base-300` hairline plus
 * the single honest `lg` shadow — die-cut paper in light. In dark, depth
 * shifts to surface steps, so the panel rises to `base-200` (`light-dark()`
 * resolves against each theme's declared `color-scheme`) and the `lg`
 * shadow's inset top highlight from `systemDark` makes it read lit-from-above
 * rather than merely outlined. The uniformity is the brand.
 */
const overlaySurface = 'light-dark(var(--color-base-100), var(--color-base-200))';
const overlayPanel: NonNullable<PartStyles['base']> = {
    background: overlaySurface,
    color: 'var(--color-base-content)',
    border: hairline,
    borderRadius: 'var(--radius-box)',
    boxShadow: 'var(--shadow-lg)',
};

/**
 * The quiet trigger an overlay opens from: transparent over the page inside a
 * hairline frame — furniture until touched. Hover is one film of ink, `open`
 * holds it while the surface is up, pressed (via `pressedInk`) is two.
 */
const quietTrigger: NonNullable<PartStyles['base']> = {
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5em',
    padding: 'var(--space-md) var(--space-xl)',
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--weight-medium)',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 'var(--leading-none)',
    color: 'var(--color-base-content)',
    background: 'transparent',
    border: hairline,
    borderRadius: 'var(--radius-field)',
    cursor: 'pointer',
    transition: 'background var(--duration-fast) var(--ease-standard), '
        + 'border-color var(--duration-fast) var(--ease-standard), '
        + 'color var(--duration-fast) var(--ease-standard)',
};

/**
 * The icon-only dismiss glyph: a toast's ✕, and nothing else.
 *
 * NAMED for the one job it does, because the old name (`ghostButton`) is what
 * made this a bug — it read as "the borderless button", so dialog's and
 * popover's closes reached for it too and rendered a caption where a control
 * belonged (#245). The anatomy is what separates the two: **toast declares an
 * `action` part**, so its close is a glyph by construction; dialog and popover
 * declare none at all, so their close IS the surface's action and gets
 * `dismissAction` below.
 */
const iconClose: NonNullable<PartStyles['base']> = {
    appearance: 'none',
    padding: 'var(--space-xs) var(--space-md)',
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-medium)',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 'var(--leading-none)',
    color: 'var(--color-base-content)',
    background: 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-field)',
    cursor: 'pointer',
    transition: 'background var(--duration-fast) var(--ease-standard)',
};

/**
 * `Dialog.Close` and `Popover.Close` — the surface's own action, so it gets a
 * control's box rather than the ✕'s caption shape.
 *
 * It is `quietTrigger`'s box on purpose: the thing that opened the surface and
 * the thing that dismisses it then read as the same kind of control, one
 * hairline frame apart from the page. Neutral rather than accented, because a
 * recipe cannot know whether the label says "Got it" or "Cancel" — an app that
 * wants to say more wraps the part in a Button.
 */
const dismissAction: PartStyles = {
    base: quietTrigger,
    states: {
        hover: { background: inkWash },
        disabled: { opacity: 'var(--disabled-opacity)' },
        ...focusRing,
    },
    selectors: { ...pressedInk },
};

/**
 * Enter/exit presence for a top-layer popup — dialog, popover, menu, select,
 * tooltip. The rise: entry is opacity plus a 4px translate toward final
 * position at `normal`/`standard` (no scale, ever); exit fades at
 * `fast`/`exit` with no travel — the base state carries no transform, so a
 * closing panel never moves. Each direction rides the transition declared at
 * its destination, which is how one element gets two tempos.
 *
 * Zero never unmounts a popup; it toggles `data-state` and calls the native
 * `showPopover()` / `showModal()`. That is all the platform needs: transition
 * `display` and `overlay` with `allow-discrete` and the browser keeps the
 * element in the top layer for the duration of the exit fade, while
 * `@starting-style` supplies the state the entry animates FROM — without it
 * the element simply appears at its open value.
 *
 * `overlay` is Chromium-only as of writing; elsewhere the entry still animates
 * and the exit is instant.
 */
const popupPresence = (from: string): PartStyles => ({
    base: {
        opacity: '0',
        transition: 'opacity var(--duration-fast) var(--ease-exit), '
            + 'display var(--duration-fast) allow-discrete, '
            + 'overlay var(--duration-fast) allow-discrete',
    },
    states: {
        open: {
            opacity: '1',
            transform: 'none',
            transition: 'opacity var(--duration-normal) var(--ease-standard), '
                + 'transform var(--duration-normal) var(--ease-standard), '
                + 'display var(--duration-normal) allow-discrete, '
                + 'overlay var(--duration-normal) allow-discrete',
        },
    },
    at: {
        'starting-style': { states: { open: { opacity: '0', transform: from } } },
        // A looping animation would be sped up by the collapsed durations, but
        // a one-shot transition just becomes instant — which is what reduced
        // motion asks for. Stating it anyway keeps the intent explicit and
        // covers the discrete properties, which have no duration to collapse.
        'reduced-motion': {
            base: { transition: 'none' },
            states: { open: { transition: 'none', transform: 'none' } },
        },
    },
});

/**
 * Enter/exit for a disclosure panel, which is not in the top layer.
 *
 * Collapsible and Accordion are native `<details>`, so the panel is inside the
 * browser's `::details-content`. `interpolate-size: allow-keywords` unlocks
 * `auto` as a transition endpoint — set on the element itself rather than
 * globally, so nothing outside this design system changes behaviour.
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
 * Merge presence into a part's own styles without either clobbering the other.
 *
 * Per KEY, not per block: a recipe that already writes `states: { open: {} }`
 * — the "deliberately unstyled" idiom every popup here uses — would otherwise
 * replace the open state presence needs and silently lose the entry animation.
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

export const tabs: RecipeInput = {
    component: 'tabs',
    tokens: { '--tabs-accent': 'var(--color-primary)' },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' },
        },
        list: {
            base: {
                display: 'flex',
                gap: 'var(--space-xs)',
                borderBottom: 'var(--border) solid var(--color-base-300)',
            },
        },
        // The margin-marker grammar, run along the active edge: the tab bar is
        // a hairline rule and the current tab carries a 2px accent bar over
        // it — the "current page" marker of a docs sidebar, rotated. No pill,
        // no radius: shape never signals hierarchy here, the line does.
        tab: {
            base: {
                appearance: 'none',
                background: 'none',
                border: 'none',
                borderBottom: '2px solid transparent',
                marginBottom: 'calc(-1 * var(--border))',
                padding: 'var(--space-md) var(--space-lg)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                fontVariantNumeric: 'tabular-nums',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                cursor: 'pointer',
                transition: 'color var(--duration-fast) var(--ease-standard), '
                    + 'background var(--duration-fast) var(--ease-standard), '
                    + 'border-color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { color: 'var(--color-base-content)', background: inkWash },
                // Selection stays weight 500 — the accent ink and the 2px bar
                // do the work, so the label never reflows on activation.
                active: { color: 'var(--tabs-accent)', borderBottomColor: 'var(--tabs-accent)' },
                inactive: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: { ...pressedInk },
        },
        panel: {
            base: { fontSize: 'var(--text-md)', fontVariantNumeric: 'tabular-nums' },
            states: { active: {}, inactive: {} },
        },
    },
    variants: {
        // The size axis IS the spacing ramp, read one step at a time: block
        // padding walks xs→xl and inline padding sits one step above it, so
        // `[data-density]` rescales the whole size axis along with everything
        // else. Every control-shaped scope here uses the same two columns —
        // which is also why a `md` tab and a `md` input now measure the same.
        size: {
            xs: { tab: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-xs) var(--space-sm)' } } },
            sm: { tab: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-sm) var(--space-md)' } } },
            // `md` is the un-attributed render: the base already IS the
            // middle step, so restating it here would be a second copy free
            // to drift. An empty entry emits no rule and keeps the base.
            md: {},
            lg: { tab: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-lg) var(--space-xl)' } } },
            xl: { tab: { base: { fontSize: 'var(--text-lg)', padding: 'var(--space-xl) var(--space-2xl)' } } },
        },
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--tabs-accent': `var(--color-${c})`,
        } } }])),
    },
};

/**
 * The size ramp every quiet-trigger overlay shares (dialog, popover, menu,
 * tooltip) — select's trigger ramp verbatim, because `quietTrigger` and
 * select's well share the same md-step base metrics. Size moves metrics only:
 * padding and type, never ink.
 */
const quietTriggerSizes: Record<string, Record<string, PartStyles>> = {
    xs: { trigger: { base: { padding: 'var(--space-2xs) var(--space-xs)', fontSize: 'var(--text-xs)' } } },
    sm: { trigger: { base: { padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--text-sm)' } } },
    // `md` is the un-attributed render: `quietTrigger` already IS the middle
    // step, so an empty entry emits no rule and keeps the base.
    md: {},
    lg: { trigger: { base: { padding: 'var(--space-lg) var(--space-xl)', fontSize: 'var(--text-md)' } } },
    xl: { trigger: { base: { padding: 'var(--space-xl) var(--space-2xl)', fontSize: 'var(--text-lg)' } } },
};

/**
 * The colour wiring for a trigger-carried overlay scope (#321). Dialog, menu,
 * popover and tooltip carry their axis attributes on the TRIGGER — the
 * anatomy's carrier part — and their popup is a top-layer sibling the
 * compiler's `@scope` donut can never reach. So colour here means the
 * trigger: the label takes the role's readable ink (`softInk`, the same
 * deepening every on-paper ink in this file uses) and `open` holds the role
 * on the hairline instead of the neutral wash alone. The focus ring stays
 * petrol — one-ink focus is design-system law.
 */
const quietTriggerColors = (): Record<string, Record<string, PartStyles>> =>
    Object.fromEntries(ROLES.map((c) => [c, { trigger: {
        base: { color: softInk(c) },
        states: { open: { borderColor: `var(--color-${c})` } },
    } }]));

export const collapsible: RecipeInput = {
    component: 'collapsible',
    // The accent defaults live in `tokens:` (the toast shape), so the
    // un-attributed render IS the primary variant and `variants.color` only
    // rebinds the custom property on the carrier.
    tokens: { '--collapsible-accent': 'var(--color-primary)' },
    parts: {
        // A bordered region, not a floating card: the hairline is the depth.
        root: withPresence(disclosurePresence, {
            base: {
                border: hairline,
                borderRadius: 'var(--radius-box)',
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
            },
            states: { open: {}, closed: {} },
        }),
        trigger: {
            base: {
                display: 'block',
                padding: 'var(--space-lg) var(--space-xl)',
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--weight-medium)',
                fontVariantNumeric: 'tabular-nums',
                borderRadius: 'var(--radius-box)',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard), '
                    + 'color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { background: inkWash },
                // Open is the reading position: the heading takes the accent
                // ink and the weight holds 500 — colour does the work,
                // nothing gets heavier.
                open: {
                    color: 'var(--collapsible-accent)',
                    borderRadius: 'var(--radius-box) var(--radius-box) 0 0',
                },
                closed: {},
                disabled: { opacity: 'var(--disabled-opacity)' },
                // Inset ring: the trigger spans the bordered region edge to
                // edge, so an offset ring would ride on top of the hairline
                // frame. Still the one petrol ink.
                'focus-visible': { outline: '2px solid var(--color-primary)', outlineOffset: '-2px' },
            },
            selectors: { ...pressedInk },
        },
        panel: {
            base: {
                padding: 'var(--space-lg) var(--space-xl)',
                borderTop: hairline,
                fontSize: 'var(--text-md)',
                lineHeight: 'var(--leading-normal)',
                fontVariantNumeric: 'tabular-nums',
            },
            states: { open: {}, closed: {} },
        },
    },
    variants: {
        // The open heading's ink, per role — `softInk` because it is ink on
        // paper (see the note on `softInk` for the two codified exceptions).
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--collapsible-accent': softInk(c),
        } } }])),
        size: {
            xs: {
                trigger: { base: { padding: 'var(--space-sm) var(--space-lg)', fontSize: 'var(--text-xs)' } },
                panel: { base: { padding: 'var(--space-sm) var(--space-lg)', fontSize: 'var(--text-sm)' } },
            },
            sm: {
                trigger: { base: { padding: 'var(--space-md) var(--space-lg)', fontSize: 'var(--text-sm)' } },
                panel: { base: { padding: 'var(--space-md) var(--space-lg)', fontSize: 'var(--text-sm)' } },
            },
            // `md` is the un-attributed render — the base already IS the
            // middle step.
            md: {},
            lg: {
                trigger: { base: { padding: 'var(--space-xl) var(--space-2xl)', fontSize: 'var(--text-lg)' } },
                panel: { base: { padding: 'var(--space-xl) var(--space-2xl)', fontSize: 'var(--text-md)' } },
            },
            xl: {
                trigger: { base: { padding: 'var(--space-2xl) var(--space-2xl)', fontSize: 'var(--text-xl)' } },
                panel: { base: { padding: 'var(--space-2xl) var(--space-2xl)', fontSize: 'var(--text-lg)' } },
            },
        },
    },
};

export const switchRecipe: RecipeInput = {
    component: 'switch',
    tokens: {
        '--switch-width': 'calc(var(--size-selector) * 11)',
        '--switch-height': 'calc(var(--size-selector) * 6)',
        '--switch-pad': 'calc(var(--size-selector) * 0.75)',
        /**
         * The off-thumb's edge — the same 55% ink this design system's
         * placeholders are drawn in, not `--color-base-300`.
         *
         * `base-300` was the hairline tone here, and against the `base-200`
         * track it has to separate from it measures 1.15:1: a rule nobody can
         * see, around a paper disc that is itself 1.07:1 on that track. The
         * edge IS the mark, so it is held to the mark's floor — 3.48:1 light,
         * 4.80:1 dark (#228).
         */
        '--switch-thumb-edge': 'color-mix(in oklch, var(--color-base-content) 55%, transparent)',
    },
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                cursor: 'pointer',
            },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                checked: {},
                unchecked: {},
            },
        },
        // The track is a drawn surface, not a gray slab: base-200 with an
        // inset hairline (a box-shadow rather than a border, so the declared
        // geometry the thumb math relies on never shifts). The pill silhouette
        // is the component's own; the radius token governs corners, not this.
        control: {
            base: {
                display: 'inline-block',
                position: 'relative',
                width: 'var(--switch-width)',
                height: 'var(--switch-height)',
                borderRadius: '9999px',
                background: 'var(--color-base-200)',
                boxShadow: 'inset 0 0 0 var(--border) var(--color-base-300)',
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                checked: { background: 'var(--color-primary)', boxShadow: 'none' },
                unchecked: {},
                // The track's own hairline, redrawn in error at double weight.
                // It has to come after `checked`, which clears the shadow
                // outright — an invalid switch must read as invalid whichever
                // way it is thrown, and the edge is the only surface both
                // states share.
                invalid: { boxShadow: 'inset 0 0 0 calc(var(--border) * 2) var(--color-error)' },
                'focus-visible': {
                    outline: '2px solid var(--color-primary)',
                    outlineOffset: '2px',
                },
                disabled: {},
            },
        },
        /**
         * Paper thumb with its own hairline; nothing at rest casts a shadow.
         * On the filled track the line drops — a die-cut disc needs no rule.
         *
         * The hairline is a BORDER now, not the inset `box-shadow` it used to
         * be. The shadow was chosen so the declared geometry could not shift;
         * `border-box` keeps that promise, and buys the one thing a shadow
         * cannot give: `forced-colors: active` strips shadows, and the edge is
         * the only thing separating paper from a `base-200` track.
         */
        thumb: {
            base: {
                position: 'absolute',
                top: 'var(--switch-pad)',
                insetInlineStart: 'var(--switch-pad)',
                boxSizing: 'border-box',
                width: 'calc(var(--switch-height) - var(--switch-pad) * 2)',
                height: 'calc(var(--switch-height) - var(--switch-pad) * 2)',
                borderRadius: '9999px',
                border: 'var(--border) solid var(--switch-thumb-edge)',
                background: 'var(--color-base-100)',
                transition: 'transform var(--duration-fast) var(--ease-standard)',
                // The anchor is logical, so the travel has to be too — and
                // `transform` has no logical form, so the direction is carried by
                // a value the RTL rule below can rebind. Half of this is worse
                // than neither: a logical anchor with a physical travel starts the
                // thumb at the reading end and then moves it further that way,
                // off the track.
                '--switch-thumb-dir': '1',
            },
            states: {
                checked: {
                    transform: 'translateX(calc(var(--switch-thumb-dir) * (var(--switch-width) - var(--switch-height))))',
                    background: 'var(--color-primary-content)',
                    borderColor: 'transparent',
                },
                unchecked: {},
            },
            selectors: { [`&${rtl}`]: { '--switch-thumb-dir': '-1' } },
        },
        label: {
            base: { fontSize: 'var(--text-sm)', fontVariantNumeric: 'tabular-nums' },
            states: { checked: {}, unchecked: {}, disabled: {} },
        },
    },
    variants: {
        size: {
            xs: { root: { base: { '--switch-width': 'calc(var(--size-selector) * 8)', '--switch-height': 'calc(var(--size-selector) * 4.5)' } } },
            sm: { root: { base: { '--switch-width': 'calc(var(--size-selector) * 9.5)', '--switch-height': 'calc(var(--size-selector) * 5.25)' } } },
            // `md` is the un-attributed render — the defaults in `tokens:`
            // already ARE the middle step.
            md: {},
            lg: { root: { base: { '--switch-width': 'calc(var(--size-selector) * 13)', '--switch-height': 'calc(var(--size-selector) * 7)' } } },
            xl: { root: { base: { '--switch-width': 'calc(var(--size-selector) * 15)', '--switch-height': 'calc(var(--size-selector) * 8)' } } },
        },
        // Colour rebinds the checked fill only — the focus ring stays petrol
        // for every role (one-ink focus: "you are here" is always the same
        // ink, so keyboard position reads at a page glance).
        color: Object.fromEntries(
            ROLES.map((c) => [
                c,
                {
                    control: {
                        states: {
                            checked: { background: `var(--color-${c})` },
                        },
                    },
                },
            ]),
        ),
    },
    defaultVariants: { color: 'primary' },
    // The visible ring lives on `control`; the <label> root only groups the
    // control and its text. Declared rather than left implicit so the
    // delegation reads as a decision.
    skipStates: { root: ['focus-visible'] },
    // Logical spellings resolve on iOS but not on Android (measured,
    // signalxjs/lynx#1084) — the emitter refuses them, so the thumb's anchor
    // is restated physically here. Physical is the lynx target's norm: lynx
    // has no RTL flow, so the logical anchor's reason to exist (flipping
    // with reading direction) never engages there.
    targets: {
        lynx: {
            parts: {
                thumb: { base: { left: 'var(--switch-pad)' } },
            },
        },
    },
};

export const dialog: RecipeInput = {
    component: 'dialog',
    parts: {
        trigger: {
            base: quietTrigger,
            states: {
                hover: { background: inkWash },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                open: { background: inkWash },
                closed: {},
                ...focusRing,
            },
            selectors: { ...pressedInk },
        },
        // Dialogs settle — the same rise grammar as every surface, travelling
        // 4px down into place. Mobile-first: a full-bleed sheet on small
        // viewports, the hairline card from `sm` up. Below `sm` a 32rem card
        // with a 1rem gutter is most of the screen anyway, minus the
        // reachability.
        popup: withPresence(popupPresence('translateY(-4px)'), {
            base: {
                padding: 'var(--space-2xl)',
                width: '100%',
                maxWidth: 'none',
                height: '100dvh',
                maxHeight: 'none',
                margin: '0',
                background: overlaySurface,
                color: 'var(--color-base-content)',
                border: 'none',
                borderRadius: '0',
                boxShadow: 'none',
            },
            states: { open: {}, closed: {} },
            at: {
                sm: {
                    base: {
                        width: 'calc(100% - 2rem)',
                        maxWidth: '32rem',
                        // `auto` stretches an inset-positioned modal to fill; `fit-content`
                        // is the UA's own dialog default and hugs the content (#114).
                        height: 'fit-content',
                        maxHeight: 'calc(100% - 2rem)',
                        margin: 'auto',
                        border: hairline,
                        borderRadius: 'var(--radius-box)',
                        boxShadow: 'var(--shadow-lg)',
                    },
                },
            },
        }),
        backdrop: {
            // A wash of the slate ink, not smoke — the page dims like paper
            // under tracing stock.
            base: { background: 'color-mix(in oklch, var(--color-neutral) 40%, transparent)' },
            states: { open: {}, closed: {} },
        },
        title: {
            base: {
                margin: '0 0 var(--space-md)',
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--weight-semibold)',
                lineHeight: 'var(--leading-tight)',
                fontVariantNumeric: 'tabular-nums',
            },
        },
        description: {
            base: {
                margin: '0 0 var(--space-xl)',
                fontSize: 'var(--text-sm)',
                lineHeight: 'var(--leading-normal)',
                fontVariantNumeric: 'tabular-nums',
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
            },
        },
        footer: {
            base: {
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 'var(--space-sm)',
                marginTop: 'var(--space-xl)',
            },
        },
        close: dismissAction,
        // The least-destructive action of an alertdialog — the same quiet
        // dismiss chrome; the destructive sibling is the app's own button.
        cancel: dismissAction,
    },
    // Trigger-carried axes — see `quietTriggerColors` for why the popup is
    // out of reach and the trigger is the whole colour story here.
    variants: { color: quietTriggerColors(), size: quietTriggerSizes },
};

export const popover: RecipeInput = {
    component: 'popover',
    parts: {
        trigger: {
            base: quietTrigger,
            states: {
                hover: { background: inkWash },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                open: { background: inkWash },
                closed: {},
                ...focusRing,
            },
            selectors: { ...pressedInk },
        },
        popup: withPresence(popupPresence('translateY(4px)'), {
            base: {
                ...overlayPanel,
                padding: 'var(--space-xl)',
                minWidth: '14rem',
            },
            states: { open: {}, closed: {} },
        }),
        title: {
            base: {
                margin: '0 0 var(--space-md)',
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--weight-semibold)',
                lineHeight: 'var(--leading-tight)',
                fontVariantNumeric: 'tabular-nums',
            },
        },
        close: dismissAction,
    },
    // Trigger-carried axes — same wiring as dialog, same reason.
    variants: { color: quietTriggerColors(), size: quietTriggerSizes },
};

export const tooltip: RecipeInput = {
    component: 'tooltip',
    parts: {
        // The same quiet trigger dialog, popover and menu open from — a tooltip
        // is one more overlay and its trigger is one more control, so it reads
        // as one. `cursor: help` is the single deliberate deviation: nothing is
        // going to open, so the pointer says "explain" rather than "act".
        // No `pressedInk` either — tooltip's anatomy declares no `pressed`
        // flag and the runtime never publishes one, so a pressed rule here
        // could only ever be dead CSS.
        trigger: {
            base: { ...quietTrigger, cursor: 'help' },
            states: {
                hover: { background: inkWash },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                open: { background: inkWash },
                closed: {},
                ...focusRing,
            },
        },
        // Not an inverted bubble: a tooltip here is a printed footnote — the
        // same paper panel as every other transient surface, scaled down to a
        // field-radius strip of meta-text.
        popup: withPresence(popupPresence('translateY(4px)'), {
            base: {
                ...overlayPanel,
                borderRadius: 'var(--radius-field)',
                padding: 'var(--space-sm) var(--space-lg)',
                maxWidth: '18rem',
                fontSize: 'var(--text-xs)',
                lineHeight: 'var(--leading-tight)',
                fontVariantNumeric: 'tabular-nums',
            },
            states: { open: {}, closed: {} },
        }),
    },
    // Trigger-carried axes — same wiring as dialog, same reason.
    variants: { color: quietTriggerColors(), size: quietTriggerSizes },
};

/**
 * The checkbox mark, drawn rather than typeset.
 *
 * A glyph is at the mercy of the reader's font: `✓` is a different weight in
 * every family, and a half-star codepoint (`⯪`, U+2BEA) is missing from most of
 * them outright — which is why zero's own default half is a full `★` and this
 * file's rating group draws its halves instead of typesetting them. Monograph's
 * marks are geometry — one six-point polygon per state, painted with the
 * on-accent ink.
 *
 * THE TECHNIQUE (daisyUI's, generalised): all three polygons carry the SAME
 * point count and the same topology — left cap, elbow-outer, right cap,
 * elbow-inner — so `clip-path` interpolates between any two of them, and the
 * mark animates without a transform. `HOME` is the degenerate form: every
 * point collapsed onto the elbow's cross-section, which is zero-LENGTH but
 * full-WEIGHT. So the stroke EXTENDS out of the corner at its final thickness
 * instead of scaling up from a dot — the one growth Monograph's no-scale rule
 * still allows, and the one that reads as a pen stroke.
 *
 * Coordinates are percentages of the indicator box, computed from a polyline
 * (6,50) → (37,82) → (95,13) stroked at 19.7% with mitred joins, then fitted
 * to 1–99%. `DASH` shares the topology so indeterminate ↔ checked morphs too.
 */
const CHECK_MARK = 'polygon(15.1% 41.3%, 1% 55%, 37.6% 92.8%, 99% 19.8%, 83.9% 7.2%, 36.6% 63.5%)';
const CHECK_MARK_HOME = 'polygon(36.6% 63.5%, 37.6% 92.8%, 37.6% 92.8%, 37.6% 92.8%, 36.6% 63.5%, 36.6% 63.5%)';
const DASH_MARK = 'polygon(8% 40.1%, 8% 59.9%, 37.6% 59.9%, 92% 59.9%, 92% 40.1%, 37.6% 40.1%)';

export const menu: RecipeInput = {
    component: 'menu',
    parts: {
        trigger: {
            base: quietTrigger,
            states: {
                hover: { background: inkWash },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                open: { background: inkWash },
                closed: {},
                ...focusRing,
            },
            selectors: { ...pressedInk },
        },
        popup: withPresence(popupPresence('translateY(4px)'), {
            base: {
                ...overlayPanel,
                padding: 'var(--space-sm)',
                minWidth: '12rem',
            },
            states: { open: {}, closed: {} },
        }),
        item: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                padding: 'var(--space-sm) var(--space-lg)',
                // The marker rail: a transparent 2px border-inline-start with
                // the padding pulled back by the same 2px, so inking the
                // marker never reflows the row — and, being logical, the bar
                // sits on the reading-start edge under RTL too (an inset
                // box-shadow would stay physically left).
                borderInlineStart: '2px solid transparent',
                paddingInlineStart: 'calc(var(--space-lg) - 2px)',
                fontSize: 'var(--text-sm)',
                fontVariantNumeric: 'tabular-nums',
                borderRadius: 'var(--radius-selector)',
                cursor: 'pointer',
                outline: 'none',
            },
            states: {
                // The margin marker: the roving position gets a 2px bar of
                // primary over the soft wash — one line per row, never a
                // filled block, and dense lists stay readable. The text keeps
                // the page ink; the marker does the signalling.
                highlighted: {
                    background: 'var(--color-primary-soft)',
                    borderInlineStartColor: 'var(--color-primary)',
                },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
            selectors: { ...pressedInk },
        },
        // The stateful rows (APG menuitemcheckbox / menuitemradio) read as the
        // plain item — the STATE lives on the mark well in front of the text
        // (`item-indicator`), so the row itself declares checked/unchecked
        // empty rather than repainting anything.
        'checkbox-item': {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                padding: 'var(--space-sm) var(--space-lg)',
                // The marker rail — see `item`.
                borderInlineStart: '2px solid transparent',
                paddingInlineStart: 'calc(var(--space-lg) - 2px)',
                fontSize: 'var(--text-sm)',
                fontVariantNumeric: 'tabular-nums',
                borderRadius: 'var(--radius-selector)',
                cursor: 'pointer',
                outline: 'none',
            },
            states: {
                highlighted: {
                    background: 'var(--color-primary-soft)',
                    borderInlineStartColor: 'var(--color-primary)',
                },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                checked: {}, unchecked: {},
            },
            selectors: { ...pressedInk },
        },
        'radio-item': {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                padding: 'var(--space-sm) var(--space-lg)',
                // The marker rail — see `item`.
                borderInlineStart: '2px solid transparent',
                paddingInlineStart: 'calc(var(--space-lg) - 2px)',
                fontSize: 'var(--text-sm)',
                fontVariantNumeric: 'tabular-nums',
                borderRadius: 'var(--radius-selector)',
                cursor: 'pointer',
                outline: 'none',
            },
            states: {
                highlighted: {
                    background: 'var(--color-primary-soft)',
                    borderInlineStartColor: 'var(--color-primary)',
                },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                checked: {}, unchecked: {},
            },
            selectors: { ...pressedInk },
        },
        // The drawn tick — the checkbox's pen stroke at row scale, inked only
        // while checked. Deepened the way the radio dot is (#211's lesson):
        // this mark sits on the popup's paper, not on an accent fill, so the
        // raw role would go illegible on dark paper.
        'item-indicator': {
            base: {
                width: '0.85em',
                height: '0.85em',
                flexShrink: '0',
                background: 'color-mix(in oklab, var(--color-primary) 70%, var(--color-primary-content))',
                clipPath: CHECK_MARK,
                opacity: '0',
                transition: 'opacity var(--duration-fast) var(--ease-standard)',
            },
            states: {
                checked: { opacity: '1' },
                unchecked: {},
            },
            // The same two fallbacks every drawn mark in this file carries —
            // forced colours rewrites the fill to Canvas, print drops it.
            at: {
                'forced-colors': {
                    base: { clipPath: 'none', background: 'transparent', color: 'CanvasText', lineHeight: 'var(--leading-none)' },
                    selectors: { '&[data-state="checked"]::after': { content: '"\\2714"' } },
                },
                print: {
                    base: { clipPath: 'none', background: 'transparent', color: 'var(--print-ink)', lineHeight: 'var(--leading-none)' },
                    selectors: { '&[data-state="checked"]::after': { content: '"\\2714"' } },
                },
            },
        },
        // The item look, plus a chevron and an `open` state that keeps it
        // visually active after focus moves into the submenu.
        'sub-trigger': {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                padding: 'var(--space-sm) var(--space-lg)',
                // The marker rail — see `item`.
                borderInlineStart: '2px solid transparent',
                paddingInlineStart: 'calc(var(--space-lg) - 2px)',
                fontSize: 'var(--text-sm)',
                fontVariantNumeric: 'tabular-nums',
                borderRadius: 'var(--radius-selector)',
                cursor: 'pointer',
                outline: 'none',
            },
            states: {
                // `open` before `highlighted`: when both apply (pointer on the
                // trigger while its submenu is open) the later-emitted
                // `highlighted` must win the background — declared the other
                // way round, the held ink film would flatten the soft wash
                // and swallow the marker (the #116 lesson).
                open: { background: inkWash },
                closed: {},
                highlighted: {
                    background: 'var(--color-primary-soft)',
                    borderInlineStartColor: 'var(--color-primary)',
                },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
            selectors: {
                // A submenu opens toward the reading end, so the chevron that
                // announces it has to point that way. `\203A` points right in
                // every writing direction; `\2039` is its mirror, and the swap
                // agrees with the side `Menu.tsx` itself resolves from `:dir()`.
                '&::after': { content: '"\\203A"', marginInlineStart: 'auto', opacity: '0.55' },
                [`&${rtl}::after`]: { content: '"\\2039"' },
                ...pressedInk,
            },
        },
        // The popup surface, entering from the side it attaches on — the same
        // 4px rise, rotated to the attach axis.
        'sub-popup': withPresence(popupPresence('translateX(-4px)'), {
            base: {
                ...overlayPanel,
                padding: 'var(--space-sm)',
                minWidth: '12rem',
            },
            states: { open: {}, closed: {} },
        }),
        group: { base: {} },
        // The overline: mono meta-text, the engineered tell.
        'group-label': {
            base: {
                padding: 'var(--space-sm) var(--space-lg)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-medium)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--tracking-wide)',
                color: 'color-mix(in oklch, var(--color-base-content) 60%, transparent)',
            },
        },
        separator: {
            base: {
                height: 'var(--border)',
                margin: 'var(--space-sm) 0',
                background: 'var(--color-base-300)',
            },
        },
    },
    // Trigger-carried axes — same wiring as dialog, same reason. The popup
    // and its items are top-layer siblings the donut cannot reach.
    variants: { color: quietTriggerColors(), size: quietTriggerSizes },
    // The marker rail's pulled-back padding, restated physically: logical
    // spellings resolve on iOS but not on Android (measured,
    // signalxjs/lynx#1084), so the emitter refuses them. Physical is the
    // lynx target's norm — no RTL flow there for the logical spelling to
    // flip with.
    targets: {
        lynx: {
            parts: {
                item: { base: { paddingLeft: 'calc(var(--space-lg) - 2px)' } },
                'checkbox-item': { base: { paddingLeft: 'calc(var(--space-lg) - 2px)' } },
                'radio-item': { base: { paddingLeft: 'calc(var(--space-lg) - 2px)' } },
                'sub-trigger': { base: { paddingLeft: 'calc(var(--space-lg) - 2px)' } },
            },
        },
    },
};

export const field: RecipeInput = {
    component: 'field',
    // The label's accent default — the toast shape, rebound per role below.
    tokens: { '--field-accent': 'var(--color-base-content)' },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' },
        },
        // Weight 500, not 600 — semibold is for headings and table headers
        // only; a form label is chrome.
        label: {
            base: {
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--field-accent)',
            },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
            selectors: {
                '&[data-required]::after': { content: '" *"', color: 'var(--color-error)' },
            },
        },
        description: {
            base: {
                margin: '0',
                fontSize: 'var(--text-xs)',
                fontVariantNumeric: 'tabular-nums',
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
            },
        },
        error: {
            base: {
                margin: '0',
                fontSize: 'var(--text-xs)',
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--color-error)',
            },
        },
    },
    variants: {
        // Colour accents the LABEL ink only — the description stays meta-grey
        // and the error message stays error, whatever the field's role is.
        // `softInk` because a label is ink on paper.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--field-accent': softInk(c),
        } } }])),
        size: {
            xs: {
                label: { base: { fontSize: 'var(--text-xs)' } },
            },
            sm: {
                label: { base: { fontSize: 'var(--text-xs)' } },
            },
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
 * Where a background-painted mark stops being visible, and what stands in.
 *
 * Forced colours rewrites `background-color` to the user's palette, so a
 * clip-pathed fill becomes Canvas-on-Canvas — invisible. Printing drops
 * backgrounds entirely by default (`print-color-adjust: economy`), which takes
 * both the accent fill and the on-accent mark with it. Both fallbacks do the
 * same thing: drop the geometry, set a glyph on `::after`. `clip-path: none`
 * matters as much as the glyph — a clip on the element clips its
 * pseudo-element too.
 *
 * One BUILDER under both named conditions rather than one fused prelude, and
 * one argument, because the two media differ in exactly one declaration: the
 * ink. `forced-colors` and `print` are both built-in condition names, so
 * nothing here has to reach for a raw `@` string.
 *
 * `CanvasText` for forced colours — the mode whose whole job is a predictable
 * palette is the last place to leave ink to an author colour the UA then
 * revalues. `--print-ink` for paper, because `CanvasText` follows the page's
 * `color-scheme` and comes out WHITE under a dark theme, on white paper (#233).
 * heroui, material and carbon split the same way, for the same reason.
 */
const markFallback = (ink: string): PartStyles => ({
    base: {
        clipPath: 'none',
        background: 'transparent',
        display: 'grid',
        placeItems: 'center',
        // The system ink, not the on-accent ink: forced colours rewrites the
        // well's fill to Canvas, and print drops it.
        //
        // One object, two inks (#233). `CanvasText` is right for forced
        // colours — the mode whose job is a predictable palette — and wrong
        // for paper, where it follows the page's `color-scheme` and comes out
        // WHITE under a dark theme, on white paper. Print names `--print-ink`,
        // which is dark whatever the theme is.
        color: ink,
        fontSize: 'calc(var(--checkbox-size) * 0.72)',
        lineHeight: 'var(--leading-none)',
    },
    // Heavy check (U+2714) and minus sign (U+2212) — the heavy form because it
    // has to survive being the whole mark. `opacity` still comes from the state
    // rules, so the empty well stays empty.
    selectors: {
        '&[data-state="checked"]::after': { content: '"\\2714"' },
        '&[data-state="indeterminate"]::after': { content: '"\\2212"' },
    },
});

export const checkbox: RecipeInput = {
    component: 'checkbox',
    // The accent defaults live in `tokens:` (emitted flat on the carrier, no
    // added specificity), so the un-attributed render IS the primary variant
    // and `variants.color` only rebinds custom properties — the toast shape.
    tokens: {
        '--checkbox-size': 'calc(var(--size-selector) * 5)',
        '--checkbox-accent': 'var(--color-primary)',
        '--checkbox-on-accent': 'var(--color-primary-content)',
        // The resting geometry — the collapsed stroke the mark grows out of.
        // Declared here so it is a real token the indicator can reference and
        // each state can rebind, rather than an undeclared var.
        '--checkbox-mark': CHECK_MARK_HOME,
    },
    parts: {
        root: {
            base: { display: 'inline-flex', alignItems: 'center', gap: 'var(--space-md)', cursor: 'pointer' },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                checked: {}, unchecked: {}, indeterminate: {},
            },
        },
        // A well cut into the page: paper fill, full-perimeter 1px hairline —
        // the box is drawn, never floated. Hover darkens the line toward
        // secondary, the same move fields make.
        control: {
            base: {
                // The mark is positioned against this box rather than centred
                // as flow content, so the well needs `position` and no longer
                // needs to centre anything. `flex-shrink: 0` is load-bearing:
                // the mark's geometry is a percentage of the well, so a well
                // squeezed by a long label would render a skewed tick.
                display: 'inline-block',
                position: 'relative',
                flexShrink: '0',
                width: 'var(--checkbox-size)',
                height: 'var(--checkbox-size)',
                border: 'var(--border) solid var(--color-base-300)',
                borderRadius: 'var(--radius-selector)',
                background: 'var(--color-base-100)',
                transition: 'background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                checked: { background: 'var(--checkbox-accent)', borderColor: 'var(--checkbox-accent)' },
                indeterminate: { background: 'var(--checkbox-accent)', borderColor: 'var(--checkbox-accent)' },
                unchecked: {},
                // One-ink focus: the ring is petrol for every role. Only the
                // fill carries the accent.
                'focus-visible': { outline: '2px solid var(--color-primary)', outlineOffset: '2px' },
                invalid: { borderColor: 'var(--color-error)' },
                disabled: {},
            },
            selectors: {
                // Scoped to the empty, valid well — a bare `hover` outranks
                // both the checked fill and the invalid border and would
                // repaint them secondary.
                '&[data-state="unchecked"]:hover:not([data-disabled], [data-invalid])': {
                    borderColor: 'var(--color-secondary)',
                },
            },
        },
        // The drawn mark. `inset` in percent rather than a padded flow box:
        // it makes the mark's frame a fixed fraction of the well at every step
        // of the size ramp, and it is indifferent to `box-sizing` — the
        // containing block is the well's padding box either way.
        //
        // `unchecked` is deliberately empty: the base rule IS the empty well —
        // the collapsed stroke at zero opacity, which is also the state both
        // marks animate out of.
        indicator: {
            base: {
                position: 'absolute',
                inset: '17%',
                background: 'var(--checkbox-on-accent)',
                clipPath: 'var(--checkbox-mark)',
                opacity: '0',
                // Leaving rides the base transition, arriving rides the
                // state's own — the two-tempo idiom `popupPresence` uses. The
                // mark retracts at `fast`/`exit` with no delay: unchecking is
                // not an event to dwell on.
                transition: 'clip-path var(--duration-fast) var(--ease-exit), '
                    + 'opacity var(--duration-fast) var(--ease-exit)',
            },
            states: {
                // Arriving: the well inks over at `fast` (the control's own
                // transition), and only then does the pen touch down — hence
                // the `fast` delay in both slots. `standard` is the firm
                // decelerate, so the stroke shoots out of the elbow and
                // settles rather than easing in politely.
                checked: {
                    '--checkbox-mark': CHECK_MARK,
                    opacity: '1',
                    transition: 'clip-path var(--duration-normal) var(--ease-standard) var(--duration-fast), '
                        + 'opacity var(--duration-fast) var(--ease-standard) var(--duration-fast)',
                },
                unchecked: {},
                indeterminate: {
                    '--checkbox-mark': DASH_MARK,
                    opacity: '1',
                    transition: 'clip-path var(--duration-normal) var(--ease-standard) var(--duration-fast), '
                        + 'opacity var(--duration-fast) var(--ease-standard) var(--duration-fast)',
                },
            },
            at: { 'forced-colors': markFallback('CanvasText'), print: markFallback('var(--print-ink)') },
        },
        label: {
            base: { fontSize: 'var(--text-sm)', fontVariantNumeric: 'tabular-nums' },
            states: { checked: {}, unchecked: {}, indeterminate: {}, disabled: {} },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--checkbox-accent': `var(--color-${c})`,
            '--checkbox-on-accent': `var(--color-${c}-content)`,
        } } }])),
        size: {
            xs: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 4)' } }, label: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 4.5)' } }, label: { base: { fontSize: 'var(--text-sm)' } } },
            md: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 5)' } }, label: { base: { fontSize: 'var(--text-sm)' } } },
            lg: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 6)' } }, label: { base: { fontSize: 'var(--text-md)' } } },
            xl: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 7)' } }, label: { base: { fontSize: 'var(--text-lg)' } } },
        },
    },
    // The visible ring lives on `control`; the <label> root only groups the
    // control and its text. Declared rather than left implicit so the
    // delegation reads as a decision.
    skipStates: { root: ['focus-visible'] },
};

export const radioGroup: RecipeInput = {
    component: 'radio-group',
    // The dot is the ONLY thing that separates checked from unchecked here, and
    // unlike the checkbox's mark it does not sit on an accent fill — it sits on
    // the well's paper, so it needs the same deepening the rating's ink needs
    // (see `ratingGroup`). Measured on the raw role it replaces: `neutral` was
    // 1.51:1 on dark paper — a checked radio with no visible dot, which is
    // issue #211's defect in this design system. The 70/30 mix clears 3:1 for
    // every role in both themes (worst 3.42:1 light, 3.17:1 dark).
    tokens: {
        '--radio-size': 'calc(var(--size-selector) * 5)',
        '--radio-accent': 'color-mix(in oklab, var(--color-primary) 70%, var(--color-primary-content))',
    },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' },
            states: { invalid: {}, required: {} },
            selectors: {
                // `invalid` is a fact about the GROUP — `item-control` carries
                // no flag of its own — so the mark is reached from the root.
                // The border is the same surface the system's other invalid
                // controls turn error.
                '&[data-invalid] [data-part="item-control"]': { borderColor: 'var(--color-error)' },
            },
        },
        // Weight 500, not 600 — semibold is for headings and table headers
        // only; a form label is chrome.
        label: {
            base: {
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                fontVariantNumeric: 'tabular-nums',
            },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
        },
        item: {
            base: { display: 'inline-flex', alignItems: 'center', gap: 'var(--space-md)', cursor: 'pointer' },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                checked: {}, unchecked: {},
            },
        },
        // The same well grammar as checkbox: paper fill, 1px hairline ring.
        // Checked inks the ring and drops the dot in — a technical-drawing
        // mark, not a filled pill.
        'item-control': {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 'var(--radio-size)',
                height: 'var(--radio-size)',
                border: 'var(--border) solid var(--color-base-300)',
                borderRadius: '9999px',
                background: 'var(--color-base-100)',
                transition: 'border-color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                checked: { borderColor: 'var(--radio-accent)' },
                unchecked: {},
                // One-ink focus — petrol for every role.
                'focus-visible': { outline: '2px solid var(--color-primary)', outlineOffset: '2px' },
                disabled: {},
            },
            selectors: {
                // Scoped to the empty well, like checkbox: a bare hover would
                // outrank the checked ring.
                '&[data-state="unchecked"]:hover:not([data-disabled])': {
                    borderColor: 'var(--color-secondary)',
                },
            },
        },
        'item-indicator': {
            base: {
                width: 'calc(var(--radio-size) / 2)',
                height: 'calc(var(--radio-size) / 2)',
                borderRadius: '9999px',
                background: 'transparent',
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                checked: { background: 'var(--radio-accent)' },
                unchecked: {},
            },
        },
        'item-label': {
            base: { fontSize: 'var(--text-sm)', fontVariantNumeric: 'tabular-nums' },
            states: { checked: {}, unchecked: {}, disabled: {} },
        },
    },
    variants: {
        // Same deepening as the default above, per role — the dot is ink on
        // paper for every one of them.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--radio-accent': `color-mix(in oklab, var(--color-${c}) 70%, var(--color-${c}-content))`,
        } } }])),
        size: {
            xs: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 4)' } }, 'item-label': { base: { fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 4.5)' } }, 'item-label': { base: { fontSize: 'var(--text-sm)' } } },
            md: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 5)' } }, 'item-label': { base: { fontSize: 'var(--text-sm)' } } },
            lg: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 6)' } }, 'item-label': { base: { fontSize: 'var(--text-md)' } } },
            xl: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 7)' } }, 'item-label': { base: { fontSize: 'var(--text-lg)' } } },
        },
    },
    // The visible ring lives on `item-control`; `item` is the <label> that
    // wraps it. Declared rather than left implicit so the delegation reads
    // as a decision.
    skipStates: { label: ['invalid', 'required'], item: ['focus-visible'] },
};

export const progress: RecipeInput = {
    component: 'progress',
    tokens: {
        '--progress-accent': 'var(--color-primary)',
        '--progress-track-size': 'calc(var(--size-selector) * 2)',
    },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', width: '100%' },
            states: { loading: {}, complete: {}, indeterminate: {} },
        },
        label: {
            base: {
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                fontVariantNumeric: 'tabular-nums',
            },
        },
        // A drawn channel, not a gray slab: base-200 with an inset hairline
        // (a box-shadow rather than a border, so the track's declared height
        // is exactly the range's).
        track: {
            base: {
                width: '100%',
                height: 'var(--progress-track-size)',
                background: 'var(--color-base-200)',
                boxShadow: 'inset 0 0 0 var(--border) var(--color-base-300)',
                borderRadius: '9999px',
                overflow: 'hidden',
            },
        },
        range: {
            base: {
                height: '100%',
                background: 'var(--progress-accent)',
                borderRadius: '9999px',
                transition: 'width var(--duration-normal) var(--ease-standard)',
            },
            states: {
                // `complete` is a semantic state, not an accent: it stays
                // success regardless of the colour variant, on purpose.
                complete: { background: 'var(--color-success)' },
                loading: {},
                indeterminate: { width: '40%', animation: 'zero-basic-indeterminate 1.2s ease-in-out infinite' },
            },
            // A looping animation must STOP under reduced motion, not speed
            // up — which is why its duration is a literal rather than a
            // `var(--duration-*)` that would collapse to 0.01ms.
            at: {
                'reduced-motion': {
                    states: { indeterminate: { animation: 'none', width: '100%' } },
                },
            },
        },
        'value-text': {
            base: {
                fontSize: 'var(--text-xs)',
                fontVariantNumeric: 'tabular-nums',
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--progress-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--progress-track-size': 'var(--size-selector)' } } },
            sm: { root: { base: { '--progress-track-size': 'calc(var(--size-selector) * 1.5)' } } },
            md: { root: { base: { '--progress-track-size': 'calc(var(--size-selector) * 2)' } } },
            lg: { root: { base: { '--progress-track-size': 'calc(var(--size-selector) * 3)' } } },
            xl: { root: { base: { '--progress-track-size': 'calc(var(--size-selector) * 4)' } } },
        },
    },
    keyframes: {
        // Logical, so the sweep runs the way the bar fills. `margin-inline-start`
        // is animatable and direction-aware on its own, which is why the
        // margin-driven sweep needs no `--…-dir` multiplier the way a transform
        // does — and why the determinate `width`, an ordinary flow child, was
        // already mirroring while this travelled the other way.
        'zero-basic-indeterminate': 'from { margin-inline-start: -40%; } to { margin-inline-start: 100%; }',
    },
    // The same sweep with a physical margin: logical spellings resolve on
    // iOS but not on Android (measured, signalxjs/lynx#1084), so the emitter
    // refuses the shared keyframes. Physical is the lynx target's norm — no
    // RTL flow there, so the direction-aware spelling has nothing to flip
    // with. Keyframes merge per name, so this REPLACES the shared animation
    // on lynx.
    targets: {
        lynx: {
            keyframes: {
                'zero-basic-indeterminate': 'from { margin-left: -40%; } to { margin-left: 100%; }',
            },
        },
    },
};

export const slider: RecipeInput = {
    component: 'slider',
    // Track and thumb metrics ride the ramp: the channel matches progress's
    // sizes step for step, the disc matches checkbox's.
    tokens: {
        '--slider-accent': 'var(--color-primary)',
        '--slider-track-size': 'calc(var(--size-selector) * 2)',
        '--slider-thumb-size': 'calc(var(--size-selector) * 5)',
    },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', width: '100%' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
        },
        // Weight 500, not 600 — semibold is for headings and table headers
        // only; a form label is chrome.
        label: {
            base: {
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                fontVariantNumeric: 'tabular-nums',
            },
            states: { disabled: {} },
        },
        // A custom skin (`appearance: none`), drawn with Monograph's own
        // instruments: the track is the same channel progress draws —
        // `base-200` under an inset hairline, 9999px — with the filled span
        // reading the runtime-published `--slider-percent` as a gradient
        // stop, and the thumb is the switch's paper disc — `base-100` inside
        // its own hairline, no shadow (nothing at rest casts one).
        //
        // The rebuild is also the correctness move (see the kit skill): Blink
        // ignores thumb-pseudo styling on a native range, and treats range
        // inputs as ALWAYS `:focus-visible` — even on mouse focus — so a
        // pseudo-class ring would read as a stuck rectangle after every
        // pointer drag. The kit compiles this part's `focus-visible` state to
        // the runtime's `[data-focus-visible]` flag (keyboard semantics), so
        // the base kills the native outline and the state draws the one
        // petrol ring only when it means it.
        control: {
            base: {
                appearance: 'none',
                width: '100%',
                height: 'var(--slider-thumb-size)',
                margin: '0',
                background: 'transparent',
                cursor: 'pointer',
                outline: 'none',
                // Kept for the forced-colors fallback below, where native
                // rendering takes over and still honours the accent.
                accentColor: 'var(--slider-accent)',
                '--slider-thumb-ink': 'var(--color-base-100)',
                // `--slider-track` lives in targets.web below: it reads the
                // runtime-published `--slider-percent`, a web-only mechanism
                // the lynx target hard-rejects in shared sections.
            },
            states: {
                disabled: { cursor: 'not-allowed' },
                // One-ink focus — petrol for every role; the accent shows in
                // the track, not the ring.
                'focus-visible': { outline: '2px solid var(--color-primary)', outlineOffset: '2px' },
                // `invalid` is semantic: the accent indirection swaps the
                // fill (and the forced-colors fallback) to error under every
                // colour variant, on purpose.
                invalid: { '--slider-accent': 'var(--color-error)' },
                // Pressed is instantaneous ink on the paper disc — one film
                // of `base-content`, the same 6% step everything else sinks
                // by. A drag has no one-shot, so nothing animates.
                pressed: { '--slider-thumb-ink': 'color-mix(in oklch, var(--color-base-content) 6%, var(--color-base-100))' },
            },
            selectors: {
                // Vendor pseudos cannot share a selector list — one unknown
                // selector invalidates the whole rule — so each engine gets
                // its own copy reading the shared custom properties.
                '&::-webkit-slider-runnable-track': {
                    height: 'var(--slider-track-size)',
                    borderRadius: '9999px',
                    background: 'var(--slider-track)',
                    boxShadow: 'inset 0 0 0 var(--border) var(--color-base-300)',
                },
                '&::-webkit-slider-thumb': {
                    appearance: 'none',
                    width: 'var(--slider-thumb-size)',
                    height: 'var(--slider-thumb-size)',
                    marginTop: 'calc((var(--slider-track-size) - var(--slider-thumb-size)) / 2)',
                    borderRadius: '9999px',
                    border: 'none',
                    background: 'var(--slider-thumb-ink)',
                    boxShadow: 'inset 0 0 0 var(--border) var(--color-base-300)',
                },
                '&::-moz-range-track': {
                    height: 'var(--slider-track-size)',
                    borderRadius: '9999px',
                    background: 'var(--slider-track)',
                    boxShadow: 'inset 0 0 0 var(--border) var(--color-base-300)',
                },
                '&::-moz-range-thumb': {
                    width: 'var(--slider-thumb-size)',
                    height: 'var(--slider-thumb-size)',
                    borderRadius: '9999px',
                    border: 'none',
                    background: 'var(--slider-thumb-ink)',
                    boxShadow: 'inset 0 0 0 var(--border) var(--color-base-300)',
                },
            },
            at: {
                // Native rendering knows forced colors better than a custom
                // skin; the retained accentColor keeps the fallback branded.
                'forced-colors': { base: { appearance: 'auto' } },
            },
        },
        // The composed range projection (#325): the same channel and the same
        // paper disc as the native control, as real parts. Zero positions
        // (absolute + logical inline-start percents); this only paints.
        track: {
            base: {
                height: 'var(--slider-track-size)',
                // Reserve the thumb's overhang so the row's box matches the
                // native control's.
                marginBlock: 'calc((var(--slider-thumb-size) - var(--slider-track-size)) / 2)',
                borderRadius: '9999px',
                background: 'var(--color-base-200)',
                boxShadow: 'inset 0 0 0 var(--border) var(--color-base-300)',
                cursor: 'pointer',
            },
            states: { disabled: { cursor: 'not-allowed' } },
        },
        range: {
            base: {
                height: '100%',
                borderRadius: '9999px',
                background: 'var(--slider-accent)',
            },
            states: { disabled: {} },
        },
        // The switch's paper disc, verbatim — including the 55%-ink BORDER
        // edge rather than a hairline shadow: `base-300` on this track is
        // 1.15:1, and forced colours strips shadows outright (#228's lesson,
        // applied where it was learned).
        thumb: {
            base: {
                boxSizing: 'border-box',
                width: 'var(--slider-thumb-size)',
                height: 'var(--slider-thumb-size)',
                insetBlockStart: '50%',
                translate: '0 -50%',
                marginInlineStart: 'calc(var(--slider-thumb-size) / -2)',
                borderRadius: '9999px',
                border: 'var(--border) solid color-mix(in oklch, var(--color-base-content) 55%, transparent)',
                background: 'var(--color-base-100)',
                cursor: 'pointer',
                outline: 'none',
                touchAction: 'none',
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                // The same instantaneous ink film the native thumb takes.
                pressed: { background: 'color-mix(in oklch, var(--color-base-content) 6%, var(--color-base-100))' },
                'focus-visible': { outline: '2px solid var(--color-primary)', outlineOffset: '2px' },
                disabled: { cursor: 'not-allowed' },
            },
        },
        // A tick through the channel, with the mark's label as meta-text
        // hanging under it.
        mark: {
            base: {
                paddingBlockStart: 'calc(var(--slider-track-size) + var(--space-2xs))',
                fontSize: 'var(--text-xs)',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 'var(--leading-none)',
                whiteSpace: 'nowrap',
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
            },
            states: { disabled: {} },
            selectors: {
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    insetBlockStart: '0',
                    insetInlineStart: '-1px',
                    width: '2px',
                    height: 'var(--slider-track-size)',
                    background: 'var(--color-base-300)',
                },
            },
        },
        'value-text': {
            base: {
                fontSize: 'var(--text-xs)',
                fontVariantNumeric: 'tabular-nums',
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--slider-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--slider-track-size': 'var(--size-selector)', '--slider-thumb-size': 'calc(var(--size-selector) * 4)' } }, label: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { '--slider-track-size': 'calc(var(--size-selector) * 1.5)', '--slider-thumb-size': 'calc(var(--size-selector) * 4.5)' } }, label: { base: { fontSize: 'var(--text-sm)' } } },
            // `md` is the un-attributed render — the defaults in `tokens:`
            // already ARE the middle step.
            md: {},
            lg: { root: { base: { '--slider-track-size': 'calc(var(--size-selector) * 3)', '--slider-thumb-size': 'calc(var(--size-selector) * 6)' } }, label: { base: { fontSize: 'var(--text-md)' } } },
            xl: { root: { base: { '--slider-track-size': 'calc(var(--size-selector) * 4)', '--slider-thumb-size': 'calc(var(--size-selector) * 7)' } }, label: { base: { fontSize: 'var(--text-lg)' } } },
        },
    },
    skipStates: { root: ['invalid', 'focus-visible'] },
    targets: {
        web: {
            parts: {
                control: {
                    base: {
                        // The filled track reads the runtime-published
                        // `--slider-percent` — web-only (`RUNTIME_PROPERTIES`);
                        // the lynx runtime paints its own track/range parts.
                        '--slider-track':
                            'linear-gradient(to right, var(--slider-accent) var(--slider-percent, 50%), var(--color-base-200) 0)',
                    },
                },
            },
        },
        // The composed geometry, restated physically: logical spellings and
        // the standalone `translate` property resolve on iOS but not on
        // Android (measured, signalxjs/lynx#1084 — the thumb sat off-center
        // there), so the emitter refuses them. Physical spellings and
        // `transform` functions are proven on both platforms, and physical
        // is the lynx target's norm (no RTL flow to flip with).
        lynx: {
            parts: {
                track: {
                    base: {
                        marginTop: 'calc((var(--slider-thumb-size) - var(--slider-track-size)) / 2)',
                        marginBottom: 'calc((var(--slider-thumb-size) - var(--slider-track-size)) / 2)',
                    },
                },
                thumb: {
                    base: {
                        top: '50%',
                        transform: 'translateY(-50%)',
                        marginLeft: 'calc(var(--slider-thumb-size) / -2)',
                    },
                },
                mark: {
                    base: { paddingTop: 'calc(var(--slider-track-size) + var(--space-2xs))' },
                },
            },
        },
    },
};

export const accordion: RecipeInput = {
    component: 'accordion',
    // The toast shape — the accent default lives here so the un-attributed
    // render IS the primary variant and `variants.color` only rebinds it.
    tokens: { '--accordion-accent': 'var(--color-primary)' },
    parts: {
        // One bordered region ruled into rows by hairlines — a table of
        // contents, not a stack of cards.
        root: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                border: hairline,
                borderRadius: 'var(--radius-box)',
                background: 'var(--color-base-100)',
                overflow: 'hidden',
            },
        },
        item: withPresence(disclosurePresence, {
            base: { borderBottom: hairline },
            states: { open: {}, closed: {} },
            selectors: {
                '&:last-child': { borderBottom: 'none' },
            },
        }),
        trigger: {
            base: {
                display: 'block',
                padding: 'var(--space-lg) var(--space-xl)',
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--weight-medium)',
                fontVariantNumeric: 'tabular-nums',
                cursor: 'pointer',
                listStyle: 'none',
                transition: 'background var(--duration-fast) var(--ease-standard), '
                    + 'color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { background: inkWash },
                // The open heading takes the accent ink at the same 500
                // weight — colour does the work, rows never reflow.
                open: { color: 'var(--accordion-accent)' },
                closed: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                // Inset ring: the row runs edge to edge under the root's
                // clipped corners, so an offset ring would be swallowed.
                'focus-visible': { outline: '2px solid var(--color-primary)', outlineOffset: '-2px' },
            },
            selectors: { ...pressedInk },
        },
        panel: {
            base: {
                padding: '0 var(--space-xl) var(--space-lg)',
                fontSize: 'var(--text-md)',
                lineHeight: 'var(--leading-normal)',
                fontVariantNumeric: 'tabular-nums',
            },
            states: { open: {}, closed: {} },
        },
    },
    variants: {
        // The open heading's ink, per role — `softInk` because it is ink on
        // paper, exactly as collapsible wires the same mark.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--accordion-accent': softInk(c),
        } } }])),
        size: {
            xs: {
                trigger: { base: { padding: 'var(--space-sm) var(--space-lg)', fontSize: 'var(--text-xs)' } },
                panel: { base: { padding: '0 var(--space-lg) var(--space-sm)', fontSize: 'var(--text-sm)' } },
            },
            sm: {
                trigger: { base: { padding: 'var(--space-md) var(--space-lg)', fontSize: 'var(--text-sm)' } },
                panel: { base: { padding: '0 var(--space-lg) var(--space-md)', fontSize: 'var(--text-sm)' } },
            },
            // `md` is the un-attributed render — the base already IS the
            // middle step.
            md: {},
            lg: {
                trigger: { base: { padding: 'var(--space-xl) var(--space-2xl)', fontSize: 'var(--text-lg)' } },
                panel: { base: { padding: '0 var(--space-2xl) var(--space-xl)', fontSize: 'var(--text-md)' } },
            },
            xl: {
                trigger: { base: { padding: 'var(--space-2xl) var(--space-2xl)', fontSize: 'var(--text-xl)' } },
                panel: { base: { padding: '0 var(--space-2xl) var(--space-2xl)', fontSize: 'var(--text-lg)' } },
            },
        },
    },
};

export const select: RecipeInput = {
    component: 'select',
    // The accent pair: the marker ink and its soft wash — no solid selected
    // fill remains, so no `-on-accent` is needed.
    tokens: {
        '--select-accent': 'var(--color-primary)',
        '--select-soft': 'var(--color-primary-soft)',
        // The role's readable ink ON its own tint — what `soft` writes with.
        // See `softInk` for the two roles that are not simply the raw token.
        '--select-ink': softInk('primary'),
    },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column' },
        },
        // Wells are paper: base-100 fill with the full-perimeter hairline,
        // even on a tinted panel. Hover darkens the line toward secondary
        // (the same move every field makes); open inks it with the accent.
        trigger: {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-lg)',
                minWidth: '12rem',
                padding: 'var(--space-md) var(--space-xl)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 'var(--leading-none)',
                color: 'var(--color-base-content)',
                background: 'var(--color-base-100)',
                border: hairline,
                borderRadius: 'var(--radius-field)',
                cursor: 'pointer',
                transition: 'border-color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { borderColor: 'var(--color-secondary)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                open: { borderColor: 'var(--select-accent)' },
                closed: {},
                invalid: { borderColor: 'var(--color-error)' },
                placeholder: {},
                // One-ink focus: the border swaps to primary under the offset
                // petrol ring — every field makes the same move; the role
                // accent surfaces on `open`, not here.
                'focus-visible': {
                    outline: '2px solid var(--color-primary)',
                    outlineOffset: '2px',
                    borderColor: 'var(--color-primary)',
                },
            },
            selectors: {
                // The one focus exception: an invalid field rings in error —
                // the established error-signal convention outranks one-ink.
                '&[data-invalid][data-focus-visible]': {
                    outline: '2px solid var(--color-error)',
                    borderColor: 'var(--color-error)',
                },
                ...pressedInk,
            },
        },
        value: {
            base: {},
            states: {
                placeholder: { color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' },
            },
        },
        indicator: {
            base: { opacity: '0.55', transition: 'transform var(--duration-fast) var(--ease-standard)' },
            states: { open: { transform: 'rotate(180deg)' }, closed: {} },
        },
        popup: withPresence(popupPresence('translateY(4px)'), {
            base: {
                ...overlayPanel,
                padding: 'var(--space-sm)',
                minWidth: '12rem',
            },
            states: { open: {}, closed: {} },
        }),
        // The optgroup equivalent (#325) — the menu's group grammar: the
        // overline label, the group itself unstyled.
        group: { base: {} },
        'group-label': {
            base: {
                padding: 'var(--space-sm) var(--space-lg)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-medium)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--tracking-wide)',
                color: 'color-mix(in oklch, var(--color-base-content) 60%, transparent)',
            },
        },
        item: {
            base: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-md)',
                padding: 'var(--space-sm) var(--space-lg)',
                // The marker rail — see menu's `item`: logical, so the bar
                // flips with the reading direction, padded back so the marker
                // never reflows the row.
                borderInlineStart: '2px solid transparent',
                paddingInlineStart: 'calc(var(--space-lg) - 2px)',
                fontSize: 'var(--text-sm)',
                fontVariantNumeric: 'tabular-nums',
                borderRadius: 'var(--radius-selector)',
                cursor: 'pointer',
            },
            states: {
                // `highlighted` before `selected`: the roving position is one
                // film of ink — plain hover grammar — and when it lands on
                // the chosen row the later-emitted `selected` wash must win
                // (the #116 lesson, and tree-view's exact ordering).
                highlighted: { background: inkWash },
                // The margin marker (density rule) belongs to SELECTION, as
                // in tree-view: soft wash plus the 2px inset-start accent bar
                // — one line per chosen row, never a filled block. Weight
                // stays 500 throughout, so labels never reflow; the indicator
                // glyph and the marker carry the state.
                selected: {
                    background: 'var(--select-soft)',
                    borderInlineStartColor: 'var(--select-accent)',
                },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
        },
        'item-indicator': {
            base: { fontSize: 'var(--text-xs)' },
            states: { selected: {} },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--select-accent': `var(--color-${c})`,
            '--select-soft': `var(--color-${c}-soft)`,
            '--select-ink': softInk(c),
        } } }])),
        /**
         * The first scope in this repo to wire a variant that is not the
         * button's (#297; docs/architecture.md, "Declared vocabulary").
         * The vocabulary is declared in
         * `tokens.ts` under `scopes.select` and is three of the four values
         * button offers — see there for why `solid` is not one of them.
         *
         * All three move the WELL and leave the popup alone: the trigger is
         * what sits in the page's layout beside other fields, and a menu that
         * changed its fill with the trigger's would make one `data-variant`
         * mean two different things.
         */
        variant: {
            // The hairline well — the base already IS this, so the entry is
            // empty on purpose. Restating it would be a second copy free to
            // drift, and `defaultVariants` below claims it.
            outline: {},
            soft: {
                trigger: {
                    base: {
                        background: 'var(--select-soft)',
                        borderColor: 'transparent',
                        color: 'var(--select-ink)',
                    },
                    states: {
                        hover: { borderColor: 'var(--select-accent)' },
                        open: { borderColor: 'var(--select-accent)' },
                    },
                },
            },
            ghost: {
                trigger: {
                    base: {
                        background: 'transparent',
                        borderColor: 'transparent',
                    },
                    states: {
                        // Furniture until you reach for it — the well appears
                        // on hover and stays while open.
                        hover: { background: 'var(--color-base-200)', borderColor: 'var(--color-secondary)' },
                        open: { background: 'var(--color-base-100)', borderColor: 'var(--select-accent)' },
                    },
                },
            },
        },
        size: {
            xs: { trigger: { base: { padding: 'var(--space-2xs) var(--space-xs)', fontSize: 'var(--text-xs)' } } },
            sm: { trigger: { base: { padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--text-sm)' } } },
            md: { trigger: { base: { padding: 'var(--space-md) var(--space-xl)', fontSize: 'var(--text-sm)' } } },
            lg: { trigger: { base: { padding: 'var(--space-lg) var(--space-xl)', fontSize: 'var(--text-md)' } } },
            xl: { trigger: { base: { padding: 'var(--space-xl) var(--space-2xl)', fontSize: 'var(--text-lg)' } } },
        },
    },
    // `outline` is the un-attributed render, so its empty entry above is a
    // claim rather than an omission — the same shape carbon's `lg` button uses.
    defaultVariants: { variant: 'outline' },
    // The marker rail's pulled-back padding, restated physically: logical
    // spellings resolve on iOS but not on Android (measured,
    // signalxjs/lynx#1084), so the emitter refuses them. Physical is the
    // lynx target's norm — no RTL flow there to flip with.
    targets: {
        lynx: {
            parts: {
                item: { base: { paddingLeft: 'calc(var(--space-lg) - 2px)' } },
            },
        },
    },
};

export const button: RecipeInput = {
    component: 'button',
    // The two axes meet here instead of multiplying. `color` sets the accent
    // pair; `variant` decides how the accent is used. 8 + 4 + 5 rules rather
    // than 8 × 4. Two inks ride along: `--btn-ink` is the role's readable
    // on-tint ink (see `softInk`), `--btn-ghost-ink` is what a resting ghost
    // writes with — base-content, except for the destructive role.
    tokens: {
        '--btn-accent': 'var(--color-primary)',
        '--btn-on-accent': 'var(--color-primary-content)',
        '--btn-soft': 'var(--color-primary-soft)',
        '--btn-ink': softInk('primary'),
        '--btn-ghost-ink': 'var(--color-base-content)',
    },
    parts: {
        root: {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5em',
                border: 'var(--border) solid transparent',
                borderRadius: 'var(--radius-field)',
                fontFamily: 'inherit',
                fontWeight: 'var(--weight-medium)',
                lineHeight: 'var(--leading-none)',
                fontVariantNumeric: 'tabular-nums',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard), '
                    + 'border-color var(--duration-fast) var(--ease-standard), '
                    + 'color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                // One-ink focus: 2px petrol at 2px offset for every role and
                // every fill. Outline is not in the transition list, so the
                // ring lands instantly.
                'focus-visible': {
                    outline: '2px solid var(--color-primary)',
                    outlineOffset: '2px',
                },
            },
            selectors: {
                // Press is instantaneous ink, never a transform: the landing
                // is centralised here (the release still eases back at `fast`)
                // while each fill variant below supplies its own pressed ink.
                // Outranks hover by an attribute; the :not covers a press that
                // goes disabled mid-gesture.
                '&[data-pressed]:not([data-disabled])': { transition: 'none' },
            },
        },
    },
    variants: {
        // One rule per role rather than per role × fill: the fill
        // variants below read these tokens, so adding a colour
        // costs one rule instead of four.
        color: Object.fromEntries(
            ROLES.map((c) => [
                c,
                {
                    root: {
                        base: {
                            '--btn-accent': `var(--color-${c})`,
                            '--btn-on-accent': `var(--color-${c}-content)`,
                            '--btn-soft': `var(--color-${c}-soft)`,
                            '--btn-ink': softInk(c),
                            // Destructive must telegraph before interaction —
                            // the one ghost that is never furniture.
                            ...(c === 'error' ? { '--btn-ghost-ink': 'var(--color-error)' } : {}),
                        },
                    },
                },
            ]),
        ),
        // Pressed feedback throughout is the runtime's `data-pressed` (same
        // sink as `:active`, with keyboard parity and drag-off semantics),
        // and it is pure ink density — nothing translates or scales, and
        // `transition: none` makes the press land instantly while the
        // release still eases back at `fast`. The `[data-pressed]` selector
        // outranks the hover state by one attribute, and the :not covers a
        // press that goes disabled mid-gesture.
        variant: {
            // Flat role fill. No border, no shadow, no gradient — hover and
            // press deepen the ink and nothing else moves.
            solid: {
                root: {
                    base: { background: 'var(--btn-accent)', color: 'var(--btn-on-accent)' },
                    states: { hover: { background: 'color-mix(in oklch, var(--btn-accent) 92%, black)' } },
                    selectors: {
                        '&[data-pressed]:not([data-disabled])': {
                            background: 'color-mix(in oklch, var(--btn-accent) 86%, black)',
                            transition: 'none',
                        },
                    },
                },
            },
            // A labeled rule in the margin: 1px border in the role itself,
            // role ink. Hover fills with the soft tint — the line never
            // thickens — and press deepens the tint.
            outline: {
                root: {
                    base: {
                        background: 'transparent',
                        color: 'var(--btn-ink)',
                        borderColor: 'var(--btn-accent)',
                    },
                    states: { hover: { background: 'var(--btn-soft)' } },
                    selectors: {
                        '&[data-pressed]:not([data-disabled])': {
                            background: 'color-mix(in oklch, var(--btn-accent) 6%, var(--btn-soft))',
                            transition: 'none',
                        },
                    },
                },
            },
            // A printed 10% screen, drawn: soft tint plus a quiet hairline of
            // the role at 20%. Hover raises the tint one step, press two.
            soft: {
                root: {
                    base: {
                        background: 'var(--btn-soft)',
                        color: 'var(--btn-ink)',
                        borderColor: 'color-mix(in oklch, var(--btn-accent) 20%, transparent)',
                    },
                    states: { hover: { background: 'color-mix(in oklch, var(--btn-accent) 6%, var(--btn-soft))' } },
                    selectors: {
                        '&[data-pressed]:not([data-disabled])': {
                            background: 'color-mix(in oklch, var(--btn-accent) 12%, var(--btn-soft))',
                            transition: 'none',
                        },
                    },
                },
            },
            // Furniture until touched: base-content at rest (error excepted,
            // via `--btn-ghost-ink`), then the hover wash brings the role ink
            // up and press deepens the wash a step.
            ghost: {
                root: {
                    base: { background: 'transparent', color: 'var(--btn-ghost-ink)' },
                    states: {
                        hover: { background: 'var(--color-base-200)', color: 'var(--btn-ink)' },
                    },
                    selectors: {
                        '&[data-pressed]:not([data-disabled])': {
                            background: 'var(--color-base-300)',
                            transition: 'none',
                        },
                    },
                },
            },
        },
        size: {
            xs: { root: { base: { padding: 'var(--space-2xs) var(--space-xs)', fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--text-sm)' } } },
            md: { root: { base: { padding: 'var(--space-sm) var(--space-lg)', fontSize: 'var(--text-md)' } } },
            lg: { root: { base: { padding: 'var(--space-md) var(--space-xl)', fontSize: 'var(--text-lg)' } } },
            xl: { root: { base: { padding: 'var(--space-lg) var(--space-2xl)', fontSize: 'var(--text-xl)' } } },
        },
    },
    defaultVariants: { color: 'primary', variant: 'solid', size: 'md' },
};

export const avatar: RecipeInput = {
    component: 'avatar',
    // Defaults live here rather than in `defaultVariants` — the toast shape:
    // the un-attributed render IS the default, so `variants` only rebind and
    // no `:not([data-color])` duplicate is emitted.
    tokens: {
        '--avatar-size': 'calc(var(--size-selector) * 10)',
        '--avatar-text': 'var(--text-sm)',
        '--avatar-accent': 'var(--color-primary-soft)',
        '--avatar-on-accent': 'var(--color-primary)',
    },
    parts: {
        root: {
            base: {
                position: 'relative',
                display: 'inline-grid',
                width: 'var(--avatar-size)',
                height: 'var(--avatar-size)',
                borderRadius: 'var(--radius-selector)',
                overflow: 'hidden',
                verticalAlign: 'middle',
                background: 'var(--color-base-200)',
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
                background: 'var(--avatar-accent)',
                color: 'var(--avatar-on-accent)',
                // Initials as mono meta-text: an annotation on the soft tint,
                // not a candy monogram.
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--avatar-text)',
                fontWeight: 'var(--weight-medium)',
                letterSpacing: 'var(--tracking-wide)',
                fontVariantNumeric: 'tabular-nums',
                userSelect: 'none',
            },
            // `display` must not defeat the `hidden` zero sets once the image
            // has loaded.
            selectors: { '&:not([hidden])': { display: 'grid' } },
            states: { loading: {}, loaded: {}, error: {} },
        },
    },
    variants: {
        // Colour lands on the initials fallback, the only part an avatar
        // colours — the image, when it loads, covers everything else.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--avatar-accent': `var(--color-${c}-soft)`,
            '--avatar-on-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--avatar-size': 'calc(var(--size-selector) * 6)', '--avatar-text': 'var(--text-xs)' } } },
            sm: { root: { base: { '--avatar-size': 'calc(var(--size-selector) * 8)', '--avatar-text': 'var(--text-xs)' } } },
            // `md` is the un-attributed render — the defaults in `tokens:`
            // already ARE the middle step.
            md: {},
            lg: { root: { base: { '--avatar-size': 'calc(var(--size-selector) * 12)', '--avatar-text': 'var(--text-md)' } } },
            xl: { root: { base: { '--avatar-size': 'calc(var(--size-selector) * 16)', '--avatar-text': 'var(--text-lg)' } } },
        },
    },
};

/**
 * Toast presence is runtime-managed — the one popup-shaped component where
 * `@starting-style`/`allow-discrete` must NOT be used: zero mounts the root
 * `closed`, flips it `open` a frame later, and keeps it mounted after
 * dismissal until the longest transition here finishes. Both directions are
 * the ordinary two-state transition, at Monograph's two tempos: entry slides
 * at `slow`/`standard`, exit fades at `fast`/`exit` with no travel — the
 * transform rides the same clock on a `step-end` curve, holding its open
 * position for the whole fade and snapping back only once it has finished,
 * so dismissal never visibly moves.
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
        root: {
            base: {
                pointerEvents: 'auto',
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                alignItems: 'center',
                columnGap: 'var(--space-md)',
                padding: 'var(--space-md) var(--space-lg)',
                background: overlaySurface,
                color: 'var(--color-base-content)',
                border: hairline,
                // The margin marker carries the role: the inline-start
                // hairline thickens to a 2px accent bar — logical, so it
                // flips with the reading direction. The single honest `lg`
                // shadow rides alone (in dark it brings the moonlit top edge).
                borderInlineStart: '2px solid var(--toast-accent)',
                borderRadius: 'var(--radius-box)',
                boxShadow: 'var(--shadow-lg)',
                fontSize: 'var(--text-sm)',
                fontVariantNumeric: 'tabular-nums',
                opacity: '0',
                transform: 'translateY(var(--toast-from))',
                // The exit half: fade at `fast`/`exit`; the transform rides
                // the same `var(--duration-fast)` clock on a `step-end` curve
                // — held at the open position for the whole fade, snapping
                // back only at the end — so a dismissed toast never travels.
                transition: 'opacity var(--duration-fast) var(--ease-exit), '
                    + 'transform var(--duration-fast) step-end',
            },
            selectors: {
                '&[data-placement^="top"]': { '--toast-from': '-8px' },
            },
            states: {
                // The entry half rides the open declaration: the slide, at
                // `slow`/`standard` — arrive and settle.
                open: {
                    opacity: '1',
                    transform: 'none',
                    transition: 'opacity var(--duration-slow) var(--ease-standard), '
                        + 'transform var(--duration-slow) var(--ease-standard)',
                },
                closed: {},
            },
            at: {
                'reduced-motion': {
                    base: { transition: 'none' },
                    states: { open: { transition: 'none', transform: 'none' } },
                },
            },
        },
        title: {
            base: { gridColumn: '1', fontWeight: 'var(--weight-medium)' },
        },
        description: {
            base: {
                gridColumn: '1',
                fontSize: 'var(--text-xs)',
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
            },
        },
        action: {
            base: {
                ...quietTrigger,
                gridColumn: '2',
                gridRow: '1',
                padding: 'var(--space-2xs) var(--space-sm)',
                fontSize: 'var(--text-xs)',
                color: 'var(--toast-accent)',
            },
            states: {
                hover: { background: inkWash },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: { ...pressedInk },
        },
        close: {
            base: {
                ...iconClose,
                gridColumn: '3',
                gridRow: '1',
                padding: 'var(--space-2xs) var(--space-xs)',
            },
            states: {
                hover: { background: inkWash },
                disabled: { opacity: 'var(--disabled-opacity)' },
                ...focusRing,
            },
            selectors: { ...pressedInk },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((role) => [
            role,
            { root: { base: { '--toast-accent': `var(--color-${role})` } } },
        ])),
        // Size moves the card's metrics — padding and type — never the
        // accent bar or the shadow. The title inherits the root's size; the
        // description meta-text steps only at the wide end, where `text-xs`
        // beside `text-md` body would read as a different component.
        size: {
            xs: { root: { base: { padding: 'var(--space-xs) var(--space-md)', fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { padding: 'var(--space-sm) var(--space-md)', fontSize: 'var(--text-sm)' } } },
            // `md` is the un-attributed render — the base already IS the
            // middle step.
            md: {},
            lg: {
                root: { base: { padding: 'var(--space-lg) var(--space-xl)', fontSize: 'var(--text-md)' } },
                description: { base: { fontSize: 'var(--text-sm)' } },
            },
            xl: {
                root: { base: { padding: 'var(--space-xl) var(--space-2xl)', fontSize: 'var(--text-lg)' } },
                description: { base: { fontSize: 'var(--text-md)' } },
            },
        },
    },
    // The corner placements' physical anchors: logical inset spellings
    // resolve on iOS but not on Android (measured, signalxjs/lynx#1084), so
    // the emitter refuses them. Physical is the lynx target's norm — no RTL
    // flow there, so `start` IS left and `end` IS right.
    targets: {
        lynx: {
            parts: {
                viewport: {
                    selectors: {
                        '&[data-placement="top-start"]': { left: '0' },
                        '&[data-placement="top-end"]': { right: '0' },
                        '&[data-placement="bottom-start"]': { left: '0' },
                        '&[data-placement="bottom-end"]': { right: '0' },
                    },
                },
            },
        },
    },
};

export const combobox: RecipeInput = {
    component: 'combobox',
    // The accent pair mirrors select: marker ink plus soft wash — no solid
    // highlighted fill remains, so no `-on-accent` is needed.
    tokens: {
        '--combobox-accent': 'var(--color-primary)',
        '--combobox-soft': 'var(--color-primary-soft)',
    },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column' },
        },
        // The field chrome lives on the box wrapping input + trigger — a well
        // of paper with the full-perimeter hairline. Hover darkens the line
        // toward secondary; open inks it with the accent; the focus ring
        // draws here from the input's forwarded focus-visible.
        control: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                minWidth: '12rem',
                background: 'var(--color-base-100)',
                border: hairline,
                borderRadius: 'var(--radius-field)',
                transition: 'border-color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { borderColor: 'var(--color-secondary)' },
                open: { borderColor: 'var(--combobox-accent)' },
                closed: {},
                invalid: { borderColor: 'var(--color-error)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
                // One-ink focus: the border swaps to primary under the offset
                // petrol ring — every field makes the same move; the role
                // accent surfaces on `open`, not here.
                'focus-visible': {
                    outline: '2px solid var(--color-primary)',
                    outlineOffset: '2px',
                    borderColor: 'var(--color-primary)',
                },
            },
            selectors: {
                // The one focus exception: an invalid field rings in error —
                // the established error-signal convention outranks one-ink.
                '&[data-invalid][data-focus-visible]': {
                    outline: '2px solid var(--color-error)',
                    borderColor: 'var(--color-error)',
                },
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
                fontSize: 'var(--text-sm)',
                fontVariantNumeric: 'tabular-nums',
                padding: 'var(--space-md) var(--space-lg)',
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
                '&::placeholder': { color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' },
            },
        },
        trigger: {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                opacity: '0.55',
                padding: '0 var(--space-lg)',
                cursor: 'pointer',
                transition: 'transform var(--duration-fast) var(--ease-standard)',
            },
            states: {
                open: { transform: 'rotate(180deg)' },
                closed: {},
                disabled: { cursor: 'not-allowed' },
            },
            // The chevron is furniture inside the well, so it presses like
            // furniture: two films of ink, landing instantly.
            selectors: { ...pressedInk },
        },
        popup: withPresence(popupPresence('translateY(4px)'), {
            base: {
                ...overlayPanel,
                padding: 'var(--space-sm)',
                minWidth: '12rem',
            },
            states: { open: {}, closed: {} },
        }),
        // The optgroup equivalent (#325) — the menu's group grammar: the
        // overline label, the group itself unstyled.
        group: { base: {} },
        'group-label': {
            base: {
                padding: 'var(--space-sm) var(--space-lg)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-medium)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--tracking-wide)',
                color: 'color-mix(in oklch, var(--color-base-content) 60%, transparent)',
            },
        },
        item: {
            base: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-md)',
                padding: 'var(--space-sm) var(--space-lg)',
                // The marker rail — see menu's `item`: logical, so the bar
                // flips with the reading direction, padded back so the marker
                // never reflows the row.
                borderInlineStart: '2px solid transparent',
                paddingInlineStart: 'calc(var(--space-lg) - 2px)',
                fontSize: 'var(--text-sm)',
                fontVariantNumeric: 'tabular-nums',
                borderRadius: 'var(--radius-selector)',
                cursor: 'pointer',
            },
            states: {
                // `highlighted` before `selected`: the roving position is one
                // film of ink — plain hover grammar — and when it lands on
                // the chosen row the later-emitted `selected` wash must win
                // (the #116 lesson, and tree-view's exact ordering).
                highlighted: { background: inkWash },
                // The margin marker (density rule) belongs to SELECTION, as
                // in tree-view: soft wash plus the 2px inset-start accent bar
                // — one line per chosen row, never a filled block. Weight
                // stays 500 throughout, so labels never reflow; the indicator
                // glyph and the marker carry the state.
                selected: {
                    background: 'var(--combobox-soft)',
                    borderInlineStartColor: 'var(--combobox-accent)',
                },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
        },
        'item-indicator': {
            base: { fontSize: 'var(--text-xs)' },
            states: { selected: {} },
        },
        empty: {
            base: {
                padding: 'var(--space-md)',
                fontSize: 'var(--text-sm)',
                fontVariantNumeric: 'tabular-nums',
                textAlign: 'center',
                color: 'color-mix(in oklch, var(--color-base-content) 60%, transparent)',
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--combobox-accent': `var(--color-${c})`,
            '--combobox-soft': `var(--color-${c}-soft)`,
        } } }])),
        size: {
            xs: { input: { base: { padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--text-xs)' } } },
            sm: { input: { base: { padding: 'var(--space-sm) var(--space-md)', fontSize: 'var(--text-sm)' } } },
            md: { input: { base: { padding: 'var(--space-md) var(--space-lg)', fontSize: 'var(--text-sm)' } } },
            lg: { input: { base: { padding: 'var(--space-lg) var(--space-xl)', fontSize: 'var(--text-md)' } } },
            xl: { input: { base: { padding: 'var(--space-xl) var(--space-2xl)', fontSize: 'var(--text-lg)' } } },
        },
    },
    // The visible ring lives on `control`; input and trigger delegate.
    skipStates: {
        input: ['focus-visible'],
        trigger: ['focus-visible'],
    },
    // The marker rail's pulled-back padding, restated physically: logical
    // spellings resolve on iOS but not on Android (measured,
    // signalxjs/lynx#1084), so the emitter refuses them. Physical is the
    // lynx target's norm — no RTL flow there to flip with.
    targets: {
        lynx: {
            parts: {
                item: { base: { paddingLeft: 'calc(var(--space-lg) - 2px)' } },
            },
        },
    },
};

export const toggle: RecipeInput = {
    component: 'toggle',
    // Same accent machinery as button: `color` sets the trio once, the on
    // state consumes it — a role costs one rule, not one per state.
    tokens: {
        '--toggle-accent': 'var(--color-primary)',
        '--toggle-soft': 'var(--color-primary-soft)',
        '--toggle-ink': softInk('primary'),
    },
    parts: {
        // Furniture until pressed on: hairline box, base-content label. The
        // on state is the soft-chip grammar — softMix wash, role ink, the
        // hairline re-inked at 20% role — a printed screen, not a solid slab.
        root: {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5em',
                background: 'transparent',
                color: 'var(--color-base-content)',
                border: 'var(--border) solid var(--color-base-300)',
                borderRadius: 'var(--radius-field)',
                fontFamily: 'inherit',
                fontWeight: 'var(--weight-medium)',
                lineHeight: 'var(--leading-none)',
                fontVariantNumeric: 'tabular-nums',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard), '
                    + 'color var(--duration-fast) var(--ease-standard), '
                    + 'border-color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { background: inkWash },
                on: {
                    background: 'var(--toggle-soft)',
                    color: 'var(--toggle-ink)',
                    borderColor: 'color-mix(in oklch, var(--toggle-accent) 20%, transparent)',
                },
                off: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                // One-ink focus — petrol for every role.
                'focus-visible': {
                    outline: '2px solid var(--color-primary)',
                    outlineOffset: '2px',
                },
            },
            selectors: {
                // Hover on an on toggle raises the tint one step rather than
                // fading toward the furniture wash.
                '&[data-state="on"]:hover': {
                    background: 'color-mix(in oklch, var(--toggle-accent) 6%, var(--toggle-soft))',
                },
                ...pressedInk,
            },
        },
    },
    variants: {
        color: Object.fromEntries(
            ROLES.map((c) => [
                c,
                {
                    root: {
                        base: {
                            '--toggle-accent': `var(--color-${c})`,
                            '--toggle-soft': `var(--color-${c}-soft)`,
                            '--toggle-ink': softInk(c),
                        },
                    },
                },
            ]),
        ),
        size: {
            xs: { root: { base: { padding: 'var(--space-2xs) var(--space-xs)', fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--text-sm)' } } },
            md: { root: { base: { padding: 'var(--space-sm) var(--space-md)', fontSize: 'var(--text-md)' } } },
            lg: { root: { base: { padding: 'var(--space-md) var(--space-lg)', fontSize: 'var(--text-lg)' } } },
            xl: { root: { base: { padding: 'var(--space-lg) var(--space-xl)', fontSize: 'var(--text-xl)' } } },
        },
    },
    defaultVariants: { color: 'primary', size: 'md' },
};

export const toggleGroup: RecipeInput = {
    component: 'toggle-group',
    tokens: {
        '--toggle-group-accent': 'var(--color-primary)',
        '--toggle-group-soft': 'var(--color-primary-soft)',
        '--toggle-group-ink': softInk('primary'),
    },
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                border: 'var(--border) solid var(--color-base-300)',
                borderRadius: 'var(--radius-field)',
                overflow: 'hidden',
            },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
            selectors: {
                '&[data-orientation="vertical"]': { flexDirection: 'column' },
            },
        },
        // A dense repeating context, so selection follows the density rule:
        // soft wash plus the 2px inset-start margin marker — one line per on
        // segment, no per-item hairline (the items are joined anyway).
        item: {
            base: {
                appearance: 'none',
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5em',
                background: 'transparent',
                color: 'var(--color-base-content)',
                border: 'none',
                padding: 'var(--space-xs) var(--space-md)',
                fontFamily: 'inherit',
                fontWeight: 'var(--weight-medium)',
                fontSize: 'var(--text-sm)',
                lineHeight: 'var(--leading-none)',
                fontVariantNumeric: 'tabular-nums',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard), '
                    + 'color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { background: inkWash },
                on: {
                    background: 'var(--toggle-group-soft)',
                    color: 'var(--toggle-group-ink)',
                },
                off: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                'focus-visible': {
                    // The group clips its children (joined corners), so an
                    // offset ring would be swallowed — inset it instead. Still
                    // the one petrol ink, every role.
                    outline: '2px solid var(--color-primary)',
                    outlineOffset: '-2px',
                },
            },
            selectors: {
                // The margin marker, as an overlay: the inline-start edge
                // doubles as the joined-segment separator, so the bar is a
                // positioned pseudo rather than a border — logical
                // `inset-inline-start`, so it flips with the reading
                // direction (and squares exactly: joined items carry no
                // radius of their own).
                '&[data-state="on"]::before': {
                    content: '""',
                    position: 'absolute',
                    insetBlock: '0',
                    insetInlineStart: '0',
                    width: '2px',
                    background: 'var(--toggle-group-accent)',
                    pointerEvents: 'none',
                },
                // Hover on an on segment raises the tint one step; the marker
                // rides along.
                '&[data-state="on"]:hover': {
                    background: 'color-mix(in oklch, var(--toggle-group-accent) 6%, var(--toggle-group-soft))',
                },
                '&[data-orientation="horizontal"] + &': {
                    borderInlineStart: 'var(--border) solid var(--color-base-300)',
                },
                '&[data-orientation="vertical"] + &': {
                    borderBlockStart: 'var(--border) solid var(--color-base-300)',
                },
                ...pressedInk,
            },
        },
    },
    variants: {
        // The group is a frame around its items, so the ramp lands on the
        // items and the frame follows their box.
        size: {
            xs: { item: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-2xs) var(--space-xs)' } } },
            sm: { item: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-2xs) var(--space-sm)' } } },
            // `md` is the un-attributed render: the base already IS the
            // middle step, so restating it here would be a second copy free
            // to drift. An empty entry emits no rule and keeps the base.
            md: {},
            lg: { item: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-sm) var(--space-lg)' } } },
            xl: { item: { base: { fontSize: 'var(--text-lg)', padding: 'var(--space-md) var(--space-xl)' } } },
        },
        color: Object.fromEntries(
            ROLES.map((c) => [
                c,
                {
                    item: {
                        base: {
                            '--toggle-group-accent': `var(--color-${c})`,
                            '--toggle-group-soft': `var(--color-${c}-soft)`,
                            '--toggle-group-ink': softInk(c),
                        },
                    },
                },
            ]),
        ),
    },
    defaultVariants: { color: 'primary' },
};

export const numberInput: RecipeInput = {
    component: 'number-input',
    tokens: { '--number-input-accent': 'var(--color-primary)' },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-2xs)' },
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        },
        // Weight 500, not 600 — semibold is for headings and table headers
        // only; a form label is chrome.
        label: {
            base: {
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                fontVariantNumeric: 'tabular-nums',
            },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                invalid: { color: 'var(--color-error)' },
                required: {},
            },
        },
        // The field chrome (combobox split): a well of paper with the
        // full-perimeter hairline; the ring and the invalid tint draw on the
        // box, input and steppers sit inside it. Focus swaps the border to
        // primary under the petrol ring — the same one-ink move select and
        // combobox make.
        control: {
            base: {
                display: 'inline-flex',
                alignItems: 'stretch',
                background: 'var(--color-base-100)',
                border: hairline,
                borderRadius: 'var(--radius-field)',
                overflow: 'hidden',
                transition: 'border-color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { borderColor: 'var(--color-secondary)' },
                invalid: { borderColor: 'var(--color-error)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
                readonly: {},
                'focus-visible': {
                    outline: '2px solid var(--color-primary)',
                    outlineOffset: '2px',
                    borderColor: 'var(--color-primary)',
                },
            },
            selectors: {
                // The one focus exception: an invalid field rings in error —
                // the established error-signal convention outranks one-ink.
                '&[data-invalid][data-focus-visible]': {
                    outline: '2px solid var(--color-error)',
                    borderColor: 'var(--color-error)',
                },
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
                // Where the role accent surfaces: the caret writes in the
                // role's ink (a number input has no `open` state to carry
                // it, and the focus border is one-ink primary like every
                // other field).
                caretColor: 'var(--number-input-accent)',
                font: 'inherit',
                fontSize: 'var(--text-sm)',
                fontVariantNumeric: 'tabular-nums',
                textAlign: 'center',
                padding: 'var(--space-md)',
            },
            states: {
                disabled: { cursor: 'not-allowed' },
                readonly: {},
                invalid: {},
                required: {},
            },
            selectors: {
                '&::placeholder': { color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' },
            },
        },
        // Steppers are furniture inside the well: transparent over the paper
        // behind their hairline separators; hover is one film of ink, press
        // is two and lands instantly.
        'increment-trigger': {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                padding: '0 var(--space-lg)',
                cursor: 'pointer',
                userSelect: 'none',
                borderInlineStart: hairline,
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { background: inkWash },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
            selectors: { ...pressedInk },
        },
        'decrement-trigger': {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                padding: '0 var(--space-lg)',
                cursor: 'pointer',
                userSelect: 'none',
                borderInlineEnd: hairline,
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { background: inkWash },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
            selectors: { ...pressedInk },
        },
    },
    // The visible ring lives on `control`; the input delegates.
    skipStates: { input: ['focus-visible'] },
    variants: {
        // The caret carries the role — the chrome is neutral, the ring is
        // always petrol, and the focus border is one-ink primary, so the
        // accent surfaces only where the value is written.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--number-input-accent': `var(--color-${c})`,
        } } }])),
        // The readout carries the ramp; the steppers follow it so the frame
        // stays proportional. A centred readout in a fixed 5rem well wants no
        // inline lead-in, so this one is square — one ramp step per size,
        // rather than the fields' block/inline pair.
        size: {
            xs: { input: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-xs)' } } },
            sm: { input: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-sm)' } } },
            // `md` is the un-attributed render: the base already IS the
            // middle step, so restating it here would be a second copy free
            // to drift. An empty entry emits no rule and keeps the base.
            md: {},
            lg: { input: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-lg)' } } },
            xl: { input: { base: { fontSize: 'var(--text-lg)', padding: 'var(--space-xl)' } } },
        },
    },
};

/**
 * The rating symbol, drawn rather than typeset — and the reason the checkbox's
 * mark is geometry too.
 *
 * The runtime's default symbol cannot say `half` at all: `⯪` (U+2BEA) is absent
 * from the system UI font on every platform we target — it rendered as a tofu
 * box — so zero settled on a full `★` for both `half` and `full` and left the
 * distinction to the design system (#222). Typeset, the state is real and the
 * paint is not.
 *
 * So the symbol is a ten-point polygon painted twice — ghost underneath, ink on
 * top — and each layer is clipped to the fraction the state names, the way
 * daisyUI's rating splits a half across `mask-half-1` / `mask-half-2`. Same
 * degenerate-polygon technique as the checkbox mark (see `CHECK_MARK`): one
 * point count throughout, so `clip-path` interpolates and a rating FILLS —
 * the ink wipes in from the left edge while the ghost retreats to the right.
 *
 * The two layers are COMPLEMENTARY rather than stacked, and they stop 4% short
 * of each other, so the two halves of a half-symbol are parted by a hairline of
 * paper instead of meeting edge to edge. That is what makes the split legible:
 * measured, ink-on-ghost is 2.47–4.70:1 across the roles — below the 3:1 floor
 * for more than half of them — while ink-on-paper is 3.17:1 at worst. Neither
 * colour needs changing; the boundary just has to be drawn against the page.
 *
 * `LEFT`/`RIGHT` clamp every point past the parting to it, which encloses
 * exactly one side (the zero-area spike along the clamp line paints nothing).
 * `NONE`/`SPENT` collapse onto the left/right extreme — the resting states the
 * wipe runs between. Radii 50%/21% about the centre, fitted to 2–98%.
 */
const STAR = 'polygon(50% 4.3%, 62.5% 37.7%, 98% 39.2%, 70.2% 61.4%, 79.7% 95.7%, 50% 76%, 20.3% 95.7%, 29.8% 61.4%, 2% 39.2%, 37.5% 37.7%)';
const STAR_LEFT = 'polygon(48% 4.3%, 48% 37.7%, 48% 39.2%, 48% 61.4%, 48% 95.7%, 48% 76%, 20.3% 95.7%, 29.8% 61.4%, 2% 39.2%, 37.5% 37.7%)';
const STAR_RIGHT = 'polygon(52% 4.3%, 62.5% 37.7%, 98% 39.2%, 70.2% 61.4%, 79.7% 95.7%, 52% 76%, 52% 95.7%, 52% 61.4%, 52% 39.2%, 52% 37.7%)';
const STAR_NONE = 'polygon(2% 4.3%, 2% 37.7%, 2% 39.2%, 2% 61.4%, 2% 95.7%, 2% 76%, 2% 95.7%, 2% 61.4%, 2% 39.2%, 2% 37.7%)';
const STAR_SPENT = 'polygon(98% 4.3%, 98% 37.7%, 98% 39.2%, 98% 61.4%, 98% 95.7%, 98% 76%, 98% 95.7%, 98% 61.4%, 98% 39.2%, 98% 37.7%)';

/**
 * The geometry replaces the runtime's default glyph, so it must NOT replace a
 * symbol the consumer supplied — `RatingGroup.Item`'s slot receives
 * `{ state, highlighted }` precisely so an app can render its own SVG. The
 * default glyph is a TEXT node and a custom symbol is an ELEMENT, which is a
 * difference CSS can see: everything geometric here hangs off
 * `:not(:has(> *))`. A consumer's own symbol keeps the plain `color` treatment
 * the `states` below still carry.
 */
const DEFAULT_SYMBOL = '&:not(:has(> *))';

export const ratingGroup: RecipeInput = {
    component: 'rating-group',
    // The default fill is the same deepened mix the colour variants use —
    // a rating symbol is ink on bare paper, and the raw role is not always
    // safe there (see the variants note).
    tokens: {
        '--rating-size': 'var(--text-xl)',
        '--rating-fill': 'color-mix(in oklab, var(--color-warning) 70%, var(--color-warning-content))',
        /**
         * The unfilled remainder's ink — the same 55% mix the placeholders use.
         *
         * It was `--color-base-300`, the hairline grey, which measures 1.23:1
         * on light paper and 1.28:1 on dark: a five-star scale whose scale you
         * cannot see. The ghost is a TRACK and should read as one, so it is
         * held to the 3:1 a non-text mark owes — 3.55:1 light, 4.96:1 dark
         * (#228). Still clearly subordinate to the fill, which is 5.5:1.
         */
        '--rating-track': 'color-mix(in oklch, var(--color-base-content) 55%, transparent)',
        // How much of the symbol each layer covers. Rebound per state, so the
        // three states differ in paint and not merely in `data-state`.
        '--rating-mark': STAR_NONE,
        '--rating-ghost': STAR,
    },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-2xs)' },
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        },
        // Weight 500, not 600 — semibold is for headings and table headers
        // only; a form label is chrome.
        label: {
            base: {
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                fontVariantNumeric: 'tabular-nums',
            },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                invalid: { color: 'var(--color-error)' },
                required: {},
            },
        },
        control: {
            base: { display: 'inline-flex', gap: 'var(--space-2xs)' },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                readonly: {},
                'focus-visible': {
                    outline: '2px solid var(--color-primary)',
                    outlineOffset: '2px',
                    borderRadius: 'var(--radius-selector)',
                },
            },
        },
        // Nothing moves on hover — the preview is pure ink: the symbol fills
        // instead of growing. What animates is the ink's EXTENT, a wipe from
        // the left edge, which is the same gesture a filling rating makes.
        //
        // The box is squared off `--rating-size` rather than left to the
        // glyph's own metrics, because the geometry is a percentage of it and
        // the size ramp has to keep driving it.
        item: {
            base: {
                position: 'relative',
                display: 'inline-block',
                width: 'var(--rating-size)',
                height: 'var(--rating-size)',
                fontSize: 'var(--rating-size)',
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
                userSelect: 'none',
                color: 'var(--rating-track)',
                transition: 'color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                // The two marks drive the drawn symbol; `color` is what a
                // consumer's own `currentColor` SVG rides on. Both, so neither
                // rendering has a state that paints like its neighbour.
                full: { color: 'var(--rating-fill)', '--rating-mark': STAR, '--rating-ghost': STAR_SPENT },
                half: { color: 'var(--rating-fill)', '--rating-mark': STAR_LEFT, '--rating-ghost': STAR_RIGHT },
                empty: { '--rating-mark': STAR_NONE, '--rating-ghost': STAR },
                highlighted: { color: 'var(--rating-fill)' },
                disabled: { cursor: 'not-allowed' },
                readonly: { cursor: 'default' },
                // The group ring lives on control; per-item focus still gets
                // a subtle marker for the value-following tab stop.
                'focus-visible': { outline: '2px solid var(--color-primary)', outlineOffset: '1px', borderRadius: 'var(--radius-selector)' },
            },
            selectors: {
                // Retire the runtime's text glyph — `font-size: 0` rather than
                // a transparent colour, because the `states` above legitimately
                // set `color` and would win it back.
                [DEFAULT_SYMBOL]: { fontSize: '0' },
                // The ghost — the unfilled remainder. It is the track, not the
                // mark: it reads against the page, and never against the ink,
                // because the two never touch.
                [`${DEFAULT_SYMBOL}::before`]: {
                    content: '""',
                    position: 'absolute',
                    inset: '0',
                    background: 'var(--rating-track)',
                    clipPath: 'var(--rating-ghost)',
                    printColorAdjust: 'exact',
                    transition: 'clip-path var(--duration-fast) var(--ease-standard)',
                },
                // The ink.
                [`${DEFAULT_SYMBOL}::after`]: {
                    content: '""',
                    position: 'absolute',
                    inset: '0',
                    background: 'var(--rating-fill)',
                    clipPath: 'var(--rating-mark)',
                    printColorAdjust: 'exact',
                    transition: 'clip-path var(--duration-fast) var(--ease-standard)',
                },
            },
            at: {
                // Forced colours rewrites `background-color`, which would paint
                // ghost and ink alike and lose the distinction the geometry
                // exists to make. The system palette keeps it: page ink for the
                // filled fraction, the greyed ink for the empty one. Restoring
                // the glyph the way `checkbox` does is not an option here — the
                // glyph is exactly what cannot render a half.
                'forced-colors': {
                    selectors: {
                        [`${DEFAULT_SYMBOL}::before`]: { background: 'GrayText', forcedColorAdjust: 'none' },
                        [`${DEFAULT_SYMBOL}::after`]: { background: 'CanvasText', forcedColorAdjust: 'none' },
                    },
                },
            },
        },
    },
    variants: {
        // A rating symbol sits on the page background, so the raw role is
        // not always safe: daisy measured `--color-warning` at 1.62:1 on light
        // base-100. Deepening every role toward its own content pair keeps the
        // hue and clears 3:1 in both schemes — the same 70/30 mix daisy's
        // default already uses. Measured on the drawn symbol: 3.42:1 at worst
        // in light (accent), 3.17:1 in dark (neutral).
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

export const treeView: RecipeInput = {
    component: 'tree-view',
    // A tree IS the docs sidebar the margin marker was designed for, so the
    // accent pair is the marker plus its soft wash — no solid selected fill,
    // which also keeps the row's text in page ink on every role/theme.
    tokens: {
        '--tree-accent': 'var(--color-primary)',
        '--tree-text': 'var(--text-sm)',
        '--tree-soft': 'var(--color-primary-soft)',
    },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2xs)' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
        },
        // The overline above the tree: mono meta-text, the engineered tell.
        label: {
            base: {
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-medium)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--tracking-wide)',
                color: 'color-mix(in oklch, var(--color-base-content) 60%, transparent)',
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
                padding: 'var(--space-xs) var(--space-md)',
                // The marker rail — see menu's `item`: logical, so the bar
                // flips with the reading direction, padded back so the marker
                // never reflows the row.
                borderInlineStart: '2px solid transparent',
                paddingInlineStart: 'calc(var(--space-md) - 2px)',
                fontVariantNumeric: 'tabular-nums',
                borderRadius: 'var(--radius-selector)',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                // `hover` before `selected`: when both apply the later-emitted
                // wash must win, so a selected row never fades back to the
                // hover film under the pointer (the #116 lesson).
                hover: { background: inkWash },
                // The margin marker: the current row gets a 2px bar of the
                // accent over the soft wash — one line per selection, never a
                // filled block, and the text keeps the page ink.
                selected: {
                    background: 'var(--tree-soft)',
                    borderInlineStartColor: 'var(--tree-accent)',
                },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                // Inset ring: rows sit flush against their siblings, so an
                // offset ring would collide with the next row. Still the one
                // petrol ink.
                'focus-visible': { outline: '2px solid var(--color-primary)', outlineOffset: '-2px' },
            },
            selectors: { ...pressedInk },
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
                padding: 'var(--space-xs) var(--space-md)',
                // The marker rail — see `item`.
                borderInlineStart: '2px solid transparent',
                paddingInlineStart: 'calc(var(--space-md) - 2px)',
                fontVariantNumeric: 'tabular-nums',
                borderRadius: 'var(--radius-selector)',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { background: inkWash },
                open: {},
                closed: {},
                // The same marker as `item` — a selected branch heading is a
                // current position, not a different species of selection.
                selected: {
                    background: 'var(--tree-soft)',
                    borderInlineStartColor: 'var(--tree-accent)',
                },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                'focus-visible': { outline: '2px solid var(--color-primary)', outlineOffset: '-2px' },
            },
            selectors: { ...pressedInk },
        },
        'branch-indicator': {
            base: {
                display: 'inline-block',
                opacity: '0.55',
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
            at: {
                'reduced-motion': { base: { transition: 'none' } },
            },
        },
        // Each level hangs off a hairline indent guide — the tree draws its
        // structure the way the rest of Monograph does, with a rule.
        'branch-content': {
            base: {
                display: 'flex',
                flexDirection: 'column',
                marginInlineStart: 'var(--space-md)',
                paddingInlineStart: 'var(--space-md)',
                borderInlineStart: hairline,
            },
            states: { open: {}, closed: {} },
        },
    },
    variants: {
        // A tree colours one thing: the selection marker. Everything else is
        // structure, and tinting it would fight the content.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--tree-accent': `var(--color-${c})`,
            '--tree-soft': `var(--color-${c}-soft)`,
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
    // The marker rail's pulled-back padding and the indent guide's inline
    // metrics, restated physically: logical spellings resolve on iOS but not
    // on Android (measured, signalxjs/lynx#1084), so the emitter refuses
    // them. Physical is the lynx target's norm — no RTL flow there to flip
    // with.
    targets: {
        lynx: {
            parts: {
                item: { base: { paddingLeft: 'calc(var(--space-md) - 2px)' } },
                'branch-trigger': { base: { paddingLeft: 'calc(var(--space-md) - 2px)' } },
                'branch-content': { base: { marginLeft: 'var(--space-md)', paddingLeft: 'var(--space-md)' } },
            },
        },
    },
};

/**
 * The plain text field — the same well of paper the number input, the select
 * and the combobox all sit in, with nothing inside it but the text. One ink
 * move: the border goes primary under the petrol ring on focus, and the caret
 * carries the role.
 */
export const input: RecipeInput = {
    component: 'input',
    tokens: { '--input-accent': 'var(--color-primary)' },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-2xs)' },
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        },
        label: {
            base: { fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                invalid: { color: 'var(--color-error)' },
                required: {},
            },
        },
        control: {
            base: {
                display: 'inline-flex',
                alignItems: 'stretch',
                background: 'var(--color-base-100)',
                border: hairline,
                borderRadius: 'var(--radius-field)',
                overflow: 'hidden',
                transition: 'border-color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { borderColor: 'var(--color-secondary)' },
                invalid: { borderColor: 'var(--color-error)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
                readonly: {},
                'focus-visible': {
                    outline: '2px solid var(--color-primary)',
                    outlineOffset: '2px',
                    borderColor: 'var(--color-primary)',
                },
            },
            selectors: {
                // Same one exception the other three fields make: an invalid
                // field rings in error, because the error signal outranks
                // one-ink.
                '&[data-invalid][data-focus-visible]': {
                    outline: '2px solid var(--color-error)',
                    borderColor: 'var(--color-error)',
                },
            },
        },
        input: {
            base: {
                // Unlike the number input's 5rem readout, a text field fills
                // whatever the author gave it; `minWidth: 0` keeps it from
                // forcing its flex parent open.
                width: '100%',
                minWidth: '0',
                appearance: 'none',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'inherit',
                caretColor: 'var(--input-accent)',
                font: 'inherit',
                fontSize: 'var(--text-sm)',
                padding: 'var(--space-md) var(--space-lg)',
            },
            states: {
                disabled: { cursor: 'not-allowed' },
                readonly: {},
                invalid: {},
                required: {},
            },
            selectors: {
                '&::placeholder': { color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' },
            },
        },
    },
    // The visible ring lives on `control`; the input delegates.
    skipStates: { input: ['focus-visible'] },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--input-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { input: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-xs) var(--space-sm)' } } },
            sm: { input: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-sm) var(--space-md)' } } },
            // `md` is the un-attributed render: the base already IS the
            // middle step.
            md: {},
            lg: { input: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-lg) var(--space-xl)' } } },
            xl: { input: { base: { fontSize: 'var(--text-lg)', padding: 'var(--space-xl) var(--space-2xl)' } } },
        },
    },
};

/**
 * The multi-line field. Same paper, same border, same ring — drawn on the
 * element itself, because the anatomy has no `control` to draw them on and
 * nothing to put in one. `resize: vertical` is the design system's call, not
 * the runtime's: horizontal resize breaks whatever column the field sits in.
 */
export const textarea: RecipeInput = {
    component: 'textarea',
    tokens: { '--textarea-accent': 'var(--color-primary)' },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-2xs)' },
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        },
        label: {
            base: { fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                invalid: { color: 'var(--color-error)' },
                required: {},
            },
        },
        textarea: {
            base: {
                display: 'block',
                width: '100%',
                minWidth: '0',
                appearance: 'none',
                background: 'var(--color-base-100)',
                border: hairline,
                borderRadius: 'var(--radius-field)',
                color: 'inherit',
                caretColor: 'var(--textarea-accent)',
                font: 'inherit',
                fontSize: 'var(--text-sm)',
                lineHeight: '1.5',
                padding: 'var(--space-md) var(--space-lg)',
                resize: 'vertical',
                transition: 'border-color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { borderColor: 'var(--color-secondary)' },
                invalid: { borderColor: 'var(--color-error)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                readonly: {},
                required: {},
                'focus-visible': {
                    outline: '2px solid var(--color-primary)',
                    outlineOffset: '2px',
                    borderColor: 'var(--color-primary)',
                },
            },
            selectors: {
                '&::placeholder': { color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' },
                '&[data-invalid][data-focus-visible]': {
                    outline: '2px solid var(--color-error)',
                    borderColor: 'var(--color-error)',
                },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--textarea-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { textarea: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-xs) var(--space-sm)' } } },
            sm: { textarea: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-sm) var(--space-md)' } } },
            md: {},
            lg: { textarea: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-lg) var(--space-xl)' } } },
            xl: { textarea: { base: { fontSize: 'var(--text-lg)', padding: 'var(--space-xl) var(--space-2xl)' } } },
        },
    },
};

// ── Content tier (#311) ───────────────────────────────────────────────────
/**
 * Card — paper on paper. A hairline and a radius, no shadow: in this identity
 * elevation is reserved for things that float over the page (dialog, popover,
 * menu), and a card does not float. The role accent is a single rule along
 * the reading edge rather than a tint, so a wall of cards stays a wall of
 * paper.
 */
export const card: RecipeInput = {
    component: 'card',
    tokens: { '--card-accent': 'var(--color-base-300)' },
    parts: {
        root: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
                border: hairline,
                borderInlineStartWidth: 'calc(var(--border) * 3)',
                borderInlineStartColor: 'var(--card-accent)',
                borderRadius: 'var(--radius-box)',
                overflow: 'hidden',
            },
        },
        header: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2xs)',
                padding: 'var(--space-lg) var(--space-xl) 0',
            },
        },
        title: {
            base: {
                margin: '0',
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--weight-semibold)',
                lineHeight: 'var(--leading-tight)',
            },
        },
        description: {
            base: {
                margin: '0',
                fontSize: 'var(--text-sm)',
                color: 'color-mix(in oklch, var(--color-base-content) 72%, transparent)',
            },
        },
        body: {
            base: {
                padding: 'var(--space-lg) var(--space-xl)',
                fontSize: 'var(--text-sm)',
                lineHeight: 'var(--leading-normal)',
            },
        },
        footer: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                padding: '0 var(--space-xl) var(--space-lg)',
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--card-accent': `var(--color-${c})`,
        } } }])),
        // The ramp moves the padding, not the type: a small card is a tighter
        // card, and shrinking the body copy of a content surface is how a
        // design system ends up with four unreadable sizes.
        size: {
            xs: { header: { base: { padding: 'var(--space-sm) var(--space-md) 0' } }, body: { base: { padding: 'var(--space-sm) var(--space-md)' } }, footer: { base: { padding: '0 var(--space-md) var(--space-sm)' } } },
            sm: { header: { base: { padding: 'var(--space-md) var(--space-lg) 0' } }, body: { base: { padding: 'var(--space-md) var(--space-lg)' } }, footer: { base: { padding: '0 var(--space-lg) var(--space-md)' } } },
            md: {},
            lg: { header: { base: { padding: 'var(--space-xl) var(--space-2xl) 0' } }, body: { base: { padding: 'var(--space-xl) var(--space-2xl)' } }, footer: { base: { padding: '0 var(--space-2xl) var(--space-xl)' } } },
            xl: { header: { base: { padding: 'var(--space-2xl) var(--space-2xl) 0' } }, body: { base: { padding: 'var(--space-2xl)' } }, footer: { base: { padding: '0 var(--space-2xl) var(--space-2xl)' } } },
        },
    },
};

/**
 * Alert — the soft tint of its role, a rule along the reading edge, and the
 * accent spent on the icon. The text stays base-content on purpose: the
 * contrast audit measures every text-bearing part standing on the page's own
 * paper, and a title written in an on-accent ink would be white on white
 * there. The role is carried by the things that are not words.
 *
 * `closed` is unpainted, and correctly so — the anatomy declares
 * `hiddenIn: ['closed']`, so the runtime removes the root from the page and
 * no rule for that state could ever render.
 */
export const alert: RecipeInput = {
    component: 'alert',
    tokens: {
        '--alert-accent': 'var(--color-info)',
        '--alert-tint': 'var(--color-info-soft)',
    },
    parts: {
        root: {
            base: {
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'start',
                gap: 'var(--space-sm) var(--space-md)',
                background: 'var(--alert-tint)',
                color: 'var(--color-base-content)',
                border: hairline,
                borderInlineStartWidth: 'calc(var(--border) * 3)',
                borderInlineStartColor: 'var(--alert-accent)',
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
                justifyContent: 'center',
                color: 'var(--alert-accent)',
                fontSize: 'var(--text-lg)',
                lineHeight: 'var(--leading-none)',
            },
        },
        title: {
            base: {
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
                lineHeight: 'var(--leading-tight)',
            },
        },
        description: {
            base: {
                gridColumn: '2',
                fontSize: 'var(--text-sm)',
                lineHeight: 'var(--leading-normal)',
                color: 'color-mix(in oklch, var(--color-base-content) 78%, transparent)',
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
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { background: inkWash },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                'focus-visible': {
                    outline: '2px solid var(--color-primary)',
                    outlineOffset: '2px',
                },
            },
            selectors: { ...pressedInk },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--alert-accent': `var(--color-${c})`,
            '--alert-tint': `var(--color-${c}-soft)`,
        } } }])),
        size: {
            xs: { root: { base: { padding: 'var(--space-2xs) var(--space-sm)' } }, title: { base: { fontSize: 'var(--text-xs)' } }, description: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { padding: 'var(--space-xs) var(--space-md)' } }, title: { base: { fontSize: 'var(--text-xs)' } }, description: { base: { fontSize: 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { padding: 'var(--space-lg) var(--space-xl)' } }, title: { base: { fontSize: 'var(--text-md)' } }, description: { base: { fontSize: 'var(--text-md)' } } },
            xl: { root: { base: { padding: 'var(--space-xl) var(--space-2xl)' } }, title: { base: { fontSize: 'var(--text-lg)' } }, description: { base: { fontSize: 'var(--text-md)' } } },
        },
    },
};

/**
 * Badge — the one content-tier scope that wires its own `variant`, and the
 * repo's first caller of `tokens.scopes` (#294; docs/architecture.md,
 * "Declared vocabulary"). zero-basic
 * declares `solid | outline | soft | ghost` design-system-wide; badge narrows
 * to the first three in `tokens.ts`.
 *
 * `ghost` is the value it drops, and the reason is the whole argument for
 * per-scope vocabularies: a ghost button is furniture that reveals itself on
 * hover, but a badge has no hover and nothing to reveal — a ghost badge is a
 * word with no box, which is a word. Radix Themes' Badge reaches the same
 * answer independently (`solid | soft | surface | outline`, no ghost).
 *
 * Same two-token join as the button: `color` rebinds the accent pair, the
 * three fills read it. Three roles × three fills is six rules, not nine.
 */
export const badge: RecipeInput = {
    component: 'badge',
    tokens: {
        '--badge-accent': 'var(--color-primary)',
        '--badge-on-accent': 'var(--color-primary-content)',
        '--badge-soft': 'var(--color-primary-soft)',
        '--badge-ink': softInk('primary'),
    },
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375em',
                border: 'var(--border) solid transparent',
                borderRadius: 'var(--radius-field)',
                padding: 'var(--space-2xs) var(--space-md)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-medium)',
                lineHeight: 'var(--leading-normal)',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                // A badge is often a link or a remove-button via `asChild`;
                // these are inert on a span and correct on both of those.
                textDecoration: 'none',
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--badge-accent': `var(--color-${c})`,
            '--badge-on-accent': `var(--color-${c}-content)`,
            '--badge-soft': `var(--color-${c}-soft)`,
            '--badge-ink': softInk(c),
        } } }])),
        variant: {
            solid: { root: { base: {
                background: 'var(--badge-accent)',
                color: 'var(--badge-on-accent)',
            } } },
            soft: { root: { base: {
                background: 'var(--badge-soft)',
                color: 'var(--badge-ink)',
            } } },
            outline: { root: { base: {
                background: 'transparent',
                borderColor: 'var(--badge-accent)',
                color: 'var(--badge-ink)',
            } } },
        },
        // A chip is shorter than a control, so the inline column carries the
        // gradation (xs→xl) and the block column trails two steps behind it.
        // The ramp has nothing between `2xs` and `xs`, so block repeats where
        // the old hand-tuned 1px increments used to sit — the inline step
        // keeps every size distinct.
        size: {
            xs: { root: { base: { fontSize: 'var(--text-xs)', padding: '0 var(--space-xs)' } } },
            sm: { root: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-2xs) var(--space-sm)' } } },
            md: {},
            lg: { root: { base: { fontSize: 'var(--text-sm)', padding: 'var(--space-xs) var(--space-lg)' } } },
            xl: { root: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-sm) var(--space-xl)' } } },
        },
    },
    defaultVariants: { variant: 'soft' },
};

/**
 * Divider — the hairline, standing alone. `size` is the one axis that means
 * something here: a divider has no type and no padding, so the ramp moves the
 * only dimension it has, its thickness.
 */
export const divider: RecipeInput = {
    component: 'divider',
    tokens: { '--divider-ink': 'var(--color-base-300)', '--divider-thickness': 'var(--border)' },
    parts: {
        root: {
            base: {
                border: 'none',
                background: 'var(--divider-ink)',
                alignSelf: 'stretch',
            },
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
 * Skeleton — paper with a sheen moving across it. The children stay in the
 * DOM (that is the component's whole job), so `loading` has to hide them:
 * `color: transparent` blanks the text without changing the box it occupies.
 *
 * The fill is deliberately quiet. A skeleton is not a control and is not
 * content — it is the absence of content, and a placeholder loud enough to
 * clear a 3:1 UI-component floor would read as a filled block someone meant.
 * That is why it is not in the contrast audit's indicator matrix and the
 * spinner is: see the note beside `INDICATORS`.
 */
export const skeleton: RecipeInput = {
    component: 'skeleton',
    tokens: { '--skeleton-fill': 'var(--color-base-200)', '--skeleton-sheen': 'var(--color-base-300)' },
    parts: {
        root: {
            base: { borderRadius: 'var(--radius-field)' },
            states: {
                loading: {
                    color: 'transparent',
                    // The gradient IS the fill: one layer, moved by
                    // background-position, so nothing reflows.
                    backgroundImage: 'linear-gradient(90deg, var(--skeleton-fill) 0%, var(--skeleton-sheen) 50%, var(--skeleton-fill) 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'zero-basic-skeleton 1.4s ease-in-out infinite',
                    userSelect: 'none',
                    // A placeholder is not a target: it holds the shape of a
                    // link that is not there yet.
                    pointerEvents: 'none',
                },
                loaded: {},
            },
            at: {
                // Stops, never speeds up — the same rule progress's
                // indeterminate sweep follows, and the reason the duration
                // above is a literal rather than a `var(--duration-*)` that
                // would collapse to 0.01ms and strobe.
                //
                // The static fallback is a FLAT fill, not the mid-sweep frame:
                // it still reads as "not content yet", which is the whole
                // message the animation was carrying.
                'reduced-motion': {
                    states: {
                        loading: { animation: 'none', backgroundImage: 'none', background: 'var(--skeleton-fill)' },
                    },
                },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--skeleton-fill': `color-mix(in oklch, var(--color-${c}) 18%, var(--color-base-200))`,
            '--skeleton-sheen': `color-mix(in oklch, var(--color-${c}) 32%, var(--color-base-200))`,
        } } }])),
        size: {
            xs: { root: { base: { borderRadius: 'var(--radius-selector)' } } },
            sm: { root: { base: { borderRadius: 'var(--radius-selector)' } } },
            md: {},
            lg: { root: { base: { borderRadius: 'var(--radius-box)' } } },
            xl: { root: { base: { borderRadius: 'var(--radius-box)' } } },
        },
    },
    keyframes: {
        'zero-basic-skeleton': 'from { background-position: 100% 0; } to { background-position: -100% 0; }',
    },
};

/**
 * Spinner — a hairline ring with one quadrant inked, turning. Drawn with
 * borders rather than a gradient so it survives `forced-colors`, where a
 * `background-image` is dropped and a border is not.
 *
 * Under reduced motion it STOPS, and the arc is what carries the meaning
 * standing still: a ring with one segment in the role's ink still reads as a
 * progress indicator, where a uniform ring would read as an empty circle.
 */
export const spinner: RecipeInput = {
    component: 'spinner',
    tokens: {
        '--spinner-size': 'calc(var(--size-field) * 0.6)',
        '--spinner-ink': 'var(--color-primary)',
        '--spinner-track': 'var(--color-base-300)',
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
                animation: 'zero-basic-spin 0.7s linear infinite',
            },
            at: {
                'reduced-motion': { base: { animation: 'none' } },
            },
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
    keyframes: { 'zero-basic-spin': 'to { transform: rotate(360deg); }' },
};

// ── The content-tier sweep (#334) ─────────────────────────────────────────
/**
 * Kbd — a keycap drawn the way Monograph draws everything: hairlines, not
 * shadows. The front edge of the key is the one place the hairline doubles,
 * which is what reads as "cap" rather than "chip". Mono type because a
 * keycap is a literal — `⌘` and `K` are quotations of the keyboard, and the
 * badge's text grammar would make them labels.
 */
export const kbd: RecipeInput = {
    component: 'kbd',
    tokens: { '--kbd-ink': 'var(--color-base-content)' },
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minInlineSize: '1.75em',
                padding: 'var(--space-2xs) var(--space-md)',
                background: 'var(--color-base-100)',
                color: 'var(--kbd-ink)',
                border: hairline,
                borderBlockEndWidth: 'calc(var(--border) * 2)',
                borderRadius: 'var(--radius-field)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                lineHeight: 'var(--leading-normal)',
                whiteSpace: 'nowrap',
            },
        },
    },
    variants: {
        // Colour accents the INK only — the cap stays paper, because a filled
        // keycap would read as a badge with the wrong font.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--kbd-ink': softInk(c),
        } } }])),
        // A keycap is badge's ramp with the block column one notch tighter —
        // the cap is a printed key, not a chip, and `minInlineSize` is what
        // squares a single-character key anyway.
        size: {
            xs: { root: { base: { fontSize: 'var(--text-xs)', padding: '0 var(--space-xs)', minInlineSize: '1.5em' } } },
            sm: { root: { base: { fontSize: 'var(--text-xs)', padding: '0 var(--space-sm)' } } },
            md: {},
            lg: { root: { base: { fontSize: 'var(--text-sm)', padding: 'var(--space-2xs) var(--space-lg)' } } },
            xl: { root: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-xs) var(--space-xl)' } } },
        },
    },
};

/**
 * Status — a filled dot in the role's ink. Default ink is `base-content`
 * rather than a role: an unqualified dot means "present", and the strongest
 * ink is the one that holds the indicator matrix's 3:1 floor in both themes
 * by construction. A border in the same ink is the `forced-colors` and
 * `print` survival plan — backgrounds drop there, borders do not.
 */
export const status: RecipeInput = {
    component: 'status',
    tokens: {
        '--status-ink': 'var(--color-base-content)',
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
 * Indicator — pure position, no paint: the item's content (a badge, a dot)
 * brings its own. Colour accents bare-text items in the role's ink; size
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
        color: Object.fromEntries(ROLES.map((c) => [c, { item: { base: {
            color: softInk(c),
        } } }])),
        size: {
            xs: { item: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { item: { base: { fontSize: 'var(--text-xs)' } } },
            md: {},
            lg: { item: { base: { fontSize: 'var(--text-md)' } } },
            xl: { item: { base: { fontSize: 'var(--text-lg)' } } },
        },
    },
    // The corner slots, restated physically: logical inset spellings and the
    // standalone `translate` property resolve on iOS but not on Android
    // (measured, signalxjs/lynx#1084), so the emitter refuses them. Physical
    // anchors plus `transform: translate()` are proven on both platforms,
    // and physical is the lynx target's norm — no RTL flow there, so the
    // hand-flipped RTL rules above have nothing to engage with either.
    targets: {
        lynx: {
            parts: {
                item: {
                    selectors: {
                        '&[data-placement="top-start"]': { top: '0', left: '0', transform: 'translate(-50%, -50%)' },
                        '&[data-placement="top"]': { top: '0', left: '50%', transform: 'translate(-50%, -50%)' },
                        '&[data-placement="top-end"]': { top: '0', right: '0', transform: 'translate(50%, -50%)' },
                        '&[data-placement="start"]': { top: '50%', left: '0', transform: 'translate(-50%, -50%)' },
                        '&[data-placement="end"]': { top: '50%', right: '0', transform: 'translate(50%, -50%)' },
                        '&[data-placement="bottom-start"]': { bottom: '0', left: '0', transform: 'translate(-50%, 50%)' },
                        '&[data-placement="bottom"]': { bottom: '0', left: '50%', transform: 'translate(-50%, 50%)' },
                        '&[data-placement="bottom-end"]': { bottom: '0', right: '0', transform: 'translate(50%, 50%)' },
                    },
                },
            },
        },
    },
};

/**
 * Stats — a ledger row: hairline frame, hairline separators between items,
 * the value in display scale. Colour accents the VALUE ink only — the title
 * and description stay meta-grey whatever the stat's role.
 */
export const stats: RecipeInput = {
    component: 'stats',
    tokens: { '--stats-accent': 'var(--color-base-content)' },
    parts: {
        root: {
            base: {
                display: 'flex',
                border: hairline,
                borderRadius: 'var(--radius-box)',
                background: 'var(--color-base-100)',
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
                    borderInlineStart: 'var(--border) solid var(--color-base-300)',
                },
                '&[data-orientation="vertical"] + &': {
                    borderBlockStart: 'var(--border) solid var(--color-base-300)',
                },
            },
        },
        title: {
            base: {
                gridColumn: '1',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-medium)',
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
            },
        },
        value: {
            base: {
                gridColumn: '1',
                fontSize: 'var(--text-2xl)',
                fontWeight: 'var(--weight-semibold)',
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
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--stats-accent': softInk(c),
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
 * Timeline — the axis drawn in hairlines, the marker a filled dot ringed by
 * paper so it reads seated ON the line rather than beside it. Colour rebinds
 * the marker/connector accent; the content stays ink-on-paper.
 */
export const timeline: RecipeInput = {
    component: 'timeline',
    tokens: { '--timeline-accent': 'var(--color-base-content)', '--timeline-marker-size': 'calc(var(--size-selector) * 3)' },
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
                background: 'var(--color-base-300)',
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
                padding: 'var(--space-xs) var(--space-lg)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-base-content)',
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

/**
 * Chat — the bubble as quiet paper: base-200 fill, no border, the corner
 * nearest the avatar squared to seat the bubble against its row. Colour
 * refills the bubble with the role pair — the one content-tier place a
 * solid role fill is the vernacular (every messenger tints "your" side).
 */
export const chat: RecipeInput = {
    component: 'chat',
    tokens: { '--chat-fill': 'var(--color-base-200)', '--chat-ink': 'var(--color-base-content)' },
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
    // The row's vertical padding, restated physically: logical spellings
    // resolve on iOS but not on Android (measured, signalxjs/lynx#1084), so
    // the emitter refuses them.
    targets: {
        lynx: {
            parts: {
                root: { base: { paddingTop: 'var(--space-2xs)', paddingBottom: 'var(--space-2xs)' } },
            },
        },
    },
};

/**
 * RadialProgress — the ring drawn as ink under masks (see the ::after
 * comment), the channel a base-200 annulus with no hairline: at ring
 * thickness a border would read as a second ring.
 */
export const radialProgress: RecipeInput = {
    component: 'radial-progress',
    tokens: {
        '--radial-size': 'calc(var(--size-selector) * 16)',
        '--radial-thickness': 'calc(var(--size-selector) * 1.5)',
        '--radial-ink': 'var(--color-primary)',
        '--radial-track': 'var(--color-base-200)',
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
                    animation: 'zero-basic-radial-spin 1.2s linear infinite',
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
    keyframes: { 'zero-basic-radial-spin': 'to { transform: rotate(360deg); }' },
};

/**
 * Join — the radius collapse and nothing else: the joined controls keep
 * their own chrome, this recipe only squares the inner corners and folds
 * the doubled seam border into one hairline. Colour accents a bare-text
 * segment's ink; size moves its type scale — the indicator's wiring, for
 * the same reason: a composition wrapper has no paint of its own.
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
            color: softInk(c),
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
 * Navbar — the page's masthead drawn the Monograph way: paper with one
 * hairline underlining it, no elevation. The three sections split the bar
 * with flexbox (start and end take the slack, the centre stays centred),
 * so a bar without a centre still puts its ends at the edges. Colour
 * refills the whole bar with the role pair — the app-bar vernacular.
 */
export const navbar: RecipeInput = {
    component: 'navbar',
    parts: {
        root: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                paddingBlock: 'var(--space-sm)',
                paddingInline: 'var(--space-lg)',
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
                borderBlockEnd: hairline,
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
            borderBlockEndColor: 'transparent',
        } } }])),
        size: {
            xs: { root: { base: { paddingBlock: 'var(--space-2xs)', fontSize: 'var(--text-sm)' } } },
            sm: { root: { base: { paddingBlock: 'var(--space-xs)', fontSize: 'var(--text-sm)' } } },
            md: {},
            lg: { root: { base: { paddingBlock: 'var(--space-md)' } } },
            xl: { root: { base: { paddingBlock: 'var(--space-lg)', fontSize: 'var(--text-lg)' } } },
        },
    },
    // The bar's padding, restated physically: logical spellings resolve on
    // iOS but not on Android (measured, signalxjs/lynx#1084), so the emitter
    // refuses them. Physical is the lynx target's norm — no RTL flow there.
    targets: {
        lynx: {
            parts: {
                root: {
                    base: {
                        paddingTop: 'var(--space-sm)',
                        paddingBottom: 'var(--space-sm)',
                        paddingLeft: 'var(--space-lg)',
                        paddingRight: 'var(--space-lg)',
                    },
                },
            },
            variants: {
                size: {
                    xs: { root: { base: { paddingTop: 'var(--space-2xs)', paddingBottom: 'var(--space-2xs)' } } },
                    sm: { root: { base: { paddingTop: 'var(--space-xs)', paddingBottom: 'var(--space-xs)' } } },
                    lg: { root: { base: { paddingTop: 'var(--space-md)', paddingBottom: 'var(--space-md)' } } },
                    xl: { root: { base: { paddingTop: 'var(--space-lg)', paddingBottom: 'var(--space-lg)' } } },
                },
            },
        },
    },
};

/**
 * Breadcrumbs — the trail as quiet ink: links at 70% density, underlined
 * only under the pointer, the current page in full ink and a touch of
 * weight (it is where you ARE, so it does not dress as a destination).
 * Colour rebinds the current page's ink through `softInk`, keeping the
 * codified warning/neutral exceptions.
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
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
                textDecoration: 'none',
                borderRadius: 'var(--radius-selector)',
                transition: 'color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { color: 'var(--color-base-content)', textDecoration: 'underline' },
                active: {
                    color: 'var(--bc-accent)',
                    fontWeight: 'var(--weight-medium)',
                    textDecoration: 'none',
                },
                inactive: {},
                ...focusRing,
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
            '--bc-accent': softInk(c),
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
 * Pagination — furniture in the house dialect: quiet hairline-framed cells,
 * `inkWash` hover, `pressedInk` press, and the current page inverted into
 * the accent pair (primary by default; the colour axis rebinds the pair).
 * The `‹`/`›` glyphs are physical ink — flipped under the shared rtl guard,
 * the tree-view chevron's move.
 */
export const pagination: RecipeInput = {
    component: 'pagination',
    tokens: {
        '--pg-accent': 'var(--color-primary)',
        '--pg-accent-content': 'var(--color-primary-content)',
        '--pg-size': 'calc(var(--size-field) * 10)',
        '--pg-font': 'var(--text-sm)',
    },
    parts: {
        root: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2xs)',
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
                border: hairline,
                borderRadius: 'var(--radius-field)',
                fontSize: 'var(--pg-font)',
                fontVariantNumeric: 'tabular-nums',
                appearance: 'none',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { background: inkWash },
                active: {
                    background: 'var(--pg-accent)',
                    color: 'var(--pg-accent-content)',
                    borderColor: 'transparent',
                },
                inactive: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                ...pressedInk,
                // The pressed wash is a translucent ink over the RESTING fill;
                // on the active page it replaced the accent fill outright and
                // left `--pg-accent-content` on a base-tinted wash — 1.27:1,
                // found by the static contrast matrix (#403), which measures
                // the item inside its root and so sees the tokens the bare
                // probe never did. The active page deepens instead.
                '&[data-state="active"][data-pressed]:not([data-disabled])': {
                    background: 'color-mix(in oklch, var(--pg-accent) 85%, var(--color-base-content))',
                    transition: 'none',
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
                border: hairline,
                borderRadius: 'var(--radius-field)',
                fontSize: 'calc(var(--pg-font) * 1.2)',
                lineHeight: 'var(--leading-none)',
                appearance: 'none',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { background: inkWash },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                ...pressedInk,
                // The glyph points at the reading start; `scale`, not a
                // logical property, so the flip is by hand under the guard.
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
                border: hairline,
                borderRadius: 'var(--radius-field)',
                fontSize: 'calc(var(--pg-font) * 1.2)',
                lineHeight: 'var(--leading-none)',
                appearance: 'none',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { background: inkWash },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                ...pressedInk,
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
    // The cell's inline padding, restated physically: logical spellings
    // resolve on iOS but not on Android (measured, signalxjs/lynx#1084), so
    // the emitter refuses them.
    targets: {
        lynx: {
            parts: {
                item: { base: { paddingLeft: 'var(--space-2xs)', paddingRight: 'var(--space-2xs)' } },
            },
        },
    },
};

/**
 * Steps — the wizard rail in hairline grammar: quiet numbered discs on the
 * axis, the walked line in the accent, the current disc inverted into the
 * accent pair. The separator bridges item centres with logical insets, so
 * RTL mirrors free; `pressedInk` is the press, as everywhere.
 */
export const steps: RecipeInput = {
    component: 'steps',
    tokens: {
        '--steps-accent': 'var(--color-primary)',
        '--steps-accent-content': 'var(--color-primary-content)',
        '--steps-accent-ink': softInk('primary'),
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
                ...pressedInk,
            },
            states: {
                active: { color: 'var(--steps-accent-ink)', fontWeight: 'var(--weight-semibold)' },
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
                border: hairline,
                transition: 'background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                active: { background: 'var(--steps-accent)', color: 'var(--steps-accent-content)', borderColor: 'transparent' },
                complete: { background: 'color-mix(in oklch, var(--steps-accent) 15%, var(--color-base-100))', color: 'var(--steps-accent-ink)' },
                inactive: { background: 'var(--color-base-200)', color: 'var(--color-base-content)' },
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
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--steps-accent': `var(--color-${c})`,
            '--steps-accent-content': `var(--color-${c}-content)`,
            '--steps-accent-ink': softInk(c),
        } } }])),
        size: {
            xs: { root: { base: { '--steps-ind': 'calc(var(--size-selector) * 5)', '--steps-font': 'var(--text-xs)' } } },
            sm: { root: { base: { '--steps-ind': 'calc(var(--size-selector) * 6)' } } },
            md: {},
            lg: { root: { base: { '--steps-ind': 'calc(var(--size-selector) * 8)' } } },
            xl: { root: { base: { '--steps-ind': 'calc(var(--size-selector) * 9)', '--steps-font': 'var(--text-md)' } } },
        },
    },
    // The bridge's anchors and the vertical item's tail padding, restated
    // physically: logical spellings resolve on iOS but not on Android
    // (measured, signalxjs/lynx#1084), so the emitter refuses them. Physical
    // is the lynx target's norm — no RTL flow there to mirror with.
    targets: {
        lynx: {
            parts: {
                item: {
                    selectors: {
                        '&[data-orientation="vertical"]': { paddingBottom: 'var(--space-lg)' },
                    },
                },
                separator: {
                    selectors: {
                        '&[data-orientation="horizontal"]': {
                            top: 'calc(var(--space-xs) + var(--steps-ind) / 2)',
                            left: '50%',
                        },
                        '&[data-orientation="vertical"]': {
                            left: 'calc(var(--space-xs) + (var(--steps-ind) - var(--border)) / 2)',
                            top: 'calc(var(--space-xs) + var(--steps-ind))',
                            bottom: 'calc(var(--space-xs) * -1)',
                        },
                    },
                },
            },
        },
    },
};

/**
 * Drawer — Dialog's machinery on an edge sheet: the same overlay costume
 * (hairline + the one honest `lg` shadow), faded in rather than slid (a
 * transform has no logical spelling; opacity needs no RTL correction). The
 * base render is the INLINE mode — a bordered panel in flow — and `:modal`
 * is the top-layer edge sheet, pinned with logical insets.
 */
export const drawer: RecipeInput = {
    component: 'drawer',
    parts: {
        trigger: {
            base: quietTrigger,
            states: {
                hover: { background: inkWash },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                open: { background: inkWash },
                closed: {},
                ...focusRing,
            },
            selectors: { ...pressedInk },
        },
        panel: withPresence(popupPresence('none'), {
            base: {
                padding: 'var(--space-xl)',
                background: overlaySurface,
                color: 'var(--color-base-content)',
                border: hairline,
                borderRadius: 'var(--radius-box)',
                inlineSize: 'min(20rem, 85vw)',
            },
            states: { open: {}, closed: {} },
            selectors: {
                /**
                 * The platform's own spelling of "this open is the modal
                 * one": `:modal`. The base styles above are the INLINE
                 * render (`show()` keeps the panel in flow); this block is
                 * the top-layer edge sheet. Logical insets pin the edge, so
                 * RTL mirrors free.
                 */
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
                },
                '&[data-placement="start"]:modal': { insetInlineStart: '0', insetInlineEnd: 'auto' },
                '&[data-placement="end"]:modal': { insetInlineStart: 'auto', insetInlineEnd: '0' },
            },
        }),
        backdrop: {
            // The same tracing-stock dim as dialog's.
            base: { background: 'color-mix(in oklch, var(--color-neutral) 40%, transparent)' },
            states: { open: {}, closed: {} },
        },
        title: {
            base: {
                margin: '0 0 var(--space-md)',
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--weight-semibold)',
                lineHeight: 'var(--leading-tight)',
                fontVariantNumeric: 'tabular-nums',
            },
        },
        close: dismissAction,
    },
    // Trigger-carried axes — see `quietTriggerColors` for why the panel is
    // out of reach and the trigger is the whole colour story here.
    variants: { color: quietTriggerColors(), size: quietTriggerSizes },
};

/**
 * Table — Monograph data: hairline row rules inside one bordered scroll box,
 * mono meta headers, tabular numbers. The root is the overflow box the
 * anatomy promises. Zebra and hover-highlight are the two declared mods —
 * per-instance choices, so they ride `data-mod-*` — and both stand aside
 * for a selected row (`:not([data-selected])`), which carries the accent.
 */
export const table: RecipeInput = {
    component: 'table',
    tokens: {
        '--table-accent': 'var(--color-base-content)',
        '--table-pad-block': 'var(--space-sm)',
        '--table-pad-inline': 'var(--space-md)',
        '--table-font': 'var(--text-sm)',
    },
    parts: {
        root: {
            base: {
                overflowX: 'auto',
                border: hairline,
                borderRadius: 'var(--radius-box)',
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
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
            },
        },
        head: {},
        body: {},
        foot: {
            base: {
                fontSize: 'var(--text-xs)',
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
            },
        },
        row: {
            base: { borderBlockEnd: hairline },
            states: {
                selected: { background: 'color-mix(in oklch, var(--table-accent) 10%, transparent)' },
            },
        },
        'header-cell': {
            base: {
                padding: 'var(--table-pad-block) var(--table-pad-inline)',
                textAlign: 'start',
                fontFamily: 'var(--font-mono)',
                fontWeight: 'var(--weight-medium)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
            },
        },
        cell: {
            base: {
                padding: 'var(--table-pad-block) var(--table-pad-inline)',
                textAlign: 'start',
                fontVariantNumeric: 'tabular-nums',
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--table-accent': softInk(c),
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
                        background: inkWash,
                    },
                },
            },
        },
        hover: {
            row: {
                selectors: {
                    '[data-scope="table"][data-part="body"] > &:hover:not([data-selected])': {
                        background: inkWash,
                    },
                },
            },
        },
    },
};

/**
 * FileUpload — Monograph's field family: a quiet trigger button, a hairline
 * dashed dropzone that inks up (petrol, like every interactive signal)
 * while a drag hovers — the shared `highlighted` flag — and a hairline item
 * list with mono metadata. The colour axis rebinds the accent.
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
                color: 'var(--color-base-content)',
            },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
            },
        },
        trigger: {
            base: { ...quietTrigger, fontSize: 'var(--fu-font)' },
            states: {
                hover: { background: inkWash },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                invalid: { borderColor: 'var(--color-error)' },
                ...focusRing,
            },
            selectors: { ...pressedInk },
        },
        dropzone: {
            base: {
                justifySelf: 'stretch',
                padding: 'var(--fu-pad)',
                textAlign: 'center',
                fontSize: 'var(--fu-font)',
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
                border: 'var(--border) dashed var(--color-base-300)',
                borderRadius: 'var(--radius-box)',
                background: 'var(--color-base-100)',
                cursor: 'pointer',
                transition: 'border-color var(--duration-fast) var(--ease-standard), '
                    + 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                // The shared `highlighted` flag: a drag is hovering and a
                // drop will act. Border AND wash — colour alone is not a
                // signal.
                highlighted: {
                    borderColor: 'var(--fu-accent)',
                    background: 'color-mix(in oklch, var(--fu-accent) 6%, var(--color-base-100))',
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
                padding: 'var(--space-xs) var(--space-sm)',
                border: hairline,
                borderRadius: 'var(--radius-field)',
                background: 'var(--color-base-100)',
            },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
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
                color: 'var(--color-base-content)',
            },
        },
        'item-size': {
            base: {
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                fontVariantNumeric: 'tabular-nums',
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
            },
        },
        'item-remove': {
            base: {
                ...iconClose,
                padding: 'var(--space-2xs) var(--space-xs)',
            },
            states: {
                hover: { background: inkWash },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: { ...pressedInk },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--fu-accent': softInk(c),
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
 * Carousel — Monograph motion is the browser's own: the viewport is a
 * scroll-snap container, the nav triggers are quiet bordered circles on
 * the inline edges (logical insets, so RTL mirrors), and the dots are
 * drawn geometry — a hollow ink ring resting, the accent filling it when
 * active. The active/inactive pair is shape AND ink, never colour alone.
 */
export const carousel: RecipeInput = {
    component: 'carousel',
    tokens: {
        '--carousel-accent': 'var(--color-primary)',
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
                borderRadius: 'var(--radius-box)',
            },
            selectors: {
                // The viewport is a tab stop (scrollable-region-focusable) and
                // owes the keyboard user a ring. Real :focus-visible — no
                // runtime flag exists on this part.
                '&:focus-visible': { outline: '2px solid var(--color-primary)', outlineOffset: '2px' },
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
                background: 'var(--color-base-100)',
                border: hairline,
                borderRadius: '9999px',
                cursor: 'pointer',
                zIndex: '1',
            },
            states: {
                hover: { background: inkWash },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: { ...pressedInk },
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
                background: 'var(--color-base-100)',
                border: hairline,
                borderRadius: '9999px',
                cursor: 'pointer',
                zIndex: '1',
            },
            states: {
                hover: { background: inkWash },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: { ...pressedInk },
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
                    border: 'calc(var(--border) * 2) solid color-mix(in oklch, var(--color-base-content) 70%, transparent)',
                    borderRadius: '9999px',
                    background: 'transparent',
                },
                '&[data-state="active"]::before': {
                    background: 'var(--carousel-accent)',
                    borderColor: 'var(--carousel-accent)',
                },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--carousel-accent': softInk(c),
        } } }])),
        size: {
            xs: { root: { base: { '--carousel-dot': '0.375rem', '--carousel-nav': '1.5rem' } } },
            sm: { root: { base: { '--carousel-dot': '0.5rem', '--carousel-nav': '1.75rem' } } },
            md: {},
            lg: { root: { base: { '--carousel-dot': '0.75rem', '--carousel-nav': '2.5rem' } } },
            xl: { root: { base: { '--carousel-dot': '0.875rem', '--carousel-nav': '3rem' } } },
        },
    },
    // The nav buttons' anchors, restated physically: logical inset
    // spellings resolve on iOS but not on Android (measured,
    // signalxjs/lynx#1084), so the emitter refuses them. Physical is the
    // lynx target's norm — no RTL flow there, so `start` IS left.
    targets: {
        lynx: {
            parts: {
                'prev-trigger': {
                    base: { top: 'calc(50% - var(--carousel-nav) / 2)', left: 'var(--space-sm)' },
                },
                'next-trigger': {
                    base: { top: 'calc(50% - var(--carousel-nav) / 2)', right: 'var(--space-sm)' },
                },
            },
        },
    },
};

/**
 * Swap — Monograph does not spin its glyphs: the two faces cross-fade,
 * nothing translates or rotates, and reduced motion collapses even the
 * fade to a cut. The interactive form is a quiet unbordered button.
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
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--swap-ink': softInk(c),
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
 * change — a small rise, mono digits; a loop never exists, and reduced motion
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
                fontFamily: 'var(--font-mono)',
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
                animation: 'zero-basic-countdown-in 0.3s var(--ease-standard)',
            },
            at: {
                'reduced-motion': { base: { animation: 'none' } },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--countdown-ink': softInk(c),
        } } }])),
        size: {
            xs: { root: { base: { '--countdown-font': 'var(--text-md)' } } },
            sm: { root: { base: { '--countdown-font': 'var(--text-xl)' } } },
            md: {},
            lg: { root: { base: { '--countdown-font': 'var(--text-3xl)' } } },
            xl: { root: { base: { '--countdown-font': 'var(--text-3xl)' } } },
        },
    },
    keyframes: { 'zero-basic-countdown-in': 'from { transform: translateY(0.45em); opacity: 0; }' },
};

/**
 * Diff — a before/after reveal. The clip is a logical inline-size (the
 * runtime publishes --diff-percent); the handle is Monograph's one
 * interactive ink: a hairline divider with a petrol grip dot, pressed =
 * denser ink, nothing moves.
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
                // The reveal itself lives in targets.web below: it reads the
                // runtime-published `--diff-percent`, a web-only mechanism.
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
                    background: 'var(--color-base-100)',
                    border: 'calc(var(--border) * 2) solid var(--diff-accent)',
                    borderRadius: '9999px',
                    zIndex: '1',
                },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--diff-accent': softInk(c),
        } } }])),
        size: {
            xs: { root: { base: { '--diff-grip': '1rem', '--diff-hit': '1.5rem' } } },
            sm: { root: { base: { '--diff-grip': '1.25rem', '--diff-hit': '1.75rem' } } },
            md: {},
            lg: { root: { base: { '--diff-grip': '2rem', '--diff-hit': '2.5rem' } } },
            xl: { root: { base: { '--diff-grip': '2.25rem', '--diff-hit': '2.75rem' } } },
        },
    },
    targets: {
        web: {
            parts: {
                after: {
                    base: {
                        // The reveal: a LOGICAL clip reading the
                        // runtime-published `--diff-percent`
                        // (`RUNTIME_PROPERTIES`, web-only). inline-size
                        // mirrors under RTL where a physical clip-path
                        // inset would not.
                        inlineSize: 'var(--diff-percent)',
                        overflow: 'hidden',
                    },
                },
            },
        },
        // The reveal pane's pin and the handle's centering margin, restated
        // physically: logical spellings resolve on iOS but not on Android
        // (measured, signalxjs/lynx#1084), so the emitter refuses them.
        // Physical is the lynx target's norm — no RTL flow there to mirror
        // with.
        lynx: {
            parts: {
                after: {
                    base: { top: '0', bottom: '0', left: '0' },
                },
                handle: {
                    base: { top: '0', bottom: '0', marginLeft: 'calc(var(--diff-hit) / -2)' },
                },
            },
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
