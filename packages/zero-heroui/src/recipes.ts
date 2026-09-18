/**
 * zero-heroui recipes — HeroUI v3's look over zero's anatomy.
 *
 * Two things here exist nowhere else in the repo, and are the reason the
 * package exists (docs/architecture.md, "Thesis and shape"):
 *
 *  1. **No `variants.color` anywhere.** There are no roles to key it on, so
 *     every component types `color: never`. Colour reaches the CSS through
 *     declared custom tokens instead, because in HeroUI v3 colour is not an
 *     axis a consumer can pass.
 *  2. **A fused `variant`.** `primary`/`secondary`/`tertiary` are a semantic
 *     hierarchy and `danger`/`danger-soft` fold colour and treatment into one
 *     member — a vocabulary that cannot be expressed as colour × fill.
 *
 * Plus the first design-system use of `modifiers` (HeroUI's `isIconOnly` /
 * `isPending`) and of a `compoundVariants` entry that matches one.
 */
import type { CssProps, PartStyles, RecipeInput } from '@sigx/zero-kit';

const motion = (props: string): string =>
    props.split(', ').map((p) => `${p} var(--duration-fast) var(--ease-standard)`).join(', ');

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

/** v3's ring: the focus colour, offset, never an outline on the fill itself. */
const focusRing: Record<string, CssProps> = {
    'focus-visible': {
        outline: '2px solid var(--hero-focus)',
        outlineOffset: '2px',
    },
};

const label: CssProps = {
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--weight-medium)',
    color: 'var(--color-base-content)',
};

/**
 * HeroUI v3's `secondary` button box — base-100 fill inside a hairline, content
 * ink, the field radius — written out rather than reached for, because
 * `--btn-fill` and its two siblings are tokens the button RECIPE declares and
 * no other recipe can see. Every control in this file whose job is to read as a
 * button, without claiming to be the primary one, starts here.
 */
const secondaryButton: CssProps = {
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-sm)',
    // v3 sizes to its content — v2's min-widths are gone.
    width: 'fit-content',
    padding: 'var(--space-sm) var(--space-lg)',
    border: 'var(--border) solid var(--hero-line)',
    borderRadius: 'var(--radius-field)',
    background: 'var(--color-base-100)',
    ...label,
    lineHeight: 'var(--leading-none)',
    cursor: 'pointer',
};

/** Button's own gesture: v3 presses inward rather than darkening further. */
const pressScale: Record<string, CssProps> = {
    '&[data-pressed]:not([data-disabled])': { transform: 'scale(0.97)' },
};

/**
 * The corner ✕ — an icon-only dismiss, and ONLY that.
 *
 * Transparent, `2xs` padding and muted ink are right for a glyph that sits in a
 * corner and must not compete with the surface it is attached to; they are
 * wrong for anything carrying a word, which is why this is no longer the recipe
 * dialog and popover reach for (#218). Toast is its one user, and toast is the
 * one of the three whose anatomy makes the job unambiguous: it declares a
 * separate `action` part for the labelled job, so its `close` is a glyph by
 * construction.
 */
const iconClose: PartStyles = {
    base: {
        appearance: 'none',
        border: 'none',
        background: 'transparent',
        color: 'var(--hero-muted)',
        borderRadius: 'var(--radius-selector)',
        padding: 'var(--space-2xs)',
        cursor: 'pointer',
        transition: motion('background, color'),
    },
    states: {
        hover: { color: 'var(--color-base-content)', background: 'var(--color-base-200)' },
        disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
        ...focusRing,
    },
};

/**
 * The labelled dismiss — dialog's `close` and popover's `close` (#218).
 *
 * Neither anatomy has an `action` part, so `close` IS the surface's action:
 * `Dialog.Close` is the dialog's primary dismiss and `Popover.Close` its only
 * one. A word-carrying control that a person is meant to aim at is a button, so
 * it gets the button box rather than the ✕'s caption shape, and it presses like
 * every other button in the system. It stays `secondary` rather than `primary`
 * because a recipe cannot know whether the label reads "Got it" or "Cancel" —
 * neutral is the honest default, and the app can wrap the part in a Button when
 * it wants to say more.
 */
const dismissAction: PartStyles = {
    base: { ...secondaryButton, transition: motion('background, border-color, opacity, transform') },
    states: {
        hover: { background: 'var(--color-base-200)' },
        disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
        ...focusRing,
    },
    selectors: pressScale,
};

/**
 * Enter/exit for a top-layer popup — the same platform mechanism every design
 * system in this repo uses: transition `display`/`overlay` with
 * `allow-discrete` so the browser keeps the element around for the exit, and
 * `@starting-style` supplies the state the entry animates from.
 */
const popupPresence = (from: string): PartStyles => ({
    base: {
        opacity: '0',
        transform: from,
        transition: 'opacity var(--duration-fast) var(--ease-standard), '
            + 'transform var(--duration-fast) var(--ease-standard), '
            + 'display var(--duration-fast) allow-discrete, '
            + 'overlay var(--duration-fast) allow-discrete',
    },
    states: { open: { opacity: '1', transform: 'none' }, closed: {} },
    at: {
        'starting-style': { states: { open: { opacity: '0', transform: from } } },
        'reduced-motion': { base: { transition: 'none' }, states: { open: { transform: 'none' } } },
    },
});

/**
 * Enter/exit for a disclosure panel, which is not in the top layer.
 *
 * Collapsible and Accordion are native `<details>`, so the height animation
 * lives on the browser's own `::details-content` wrapper —
 * `interpolate-size: allow-keywords` (set on the element, not globally) makes
 * `auto` a legal endpoint.
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
 * The shared disclosure row — collapsible IS the accordion language minus the
 * dividers, so both take this trigger and panel verbatim. The chevron is
 * drawn (two borders, rotated) rather than glyphed so it can turn about its
 * own center, and a row presses with a deeper tint — a scale would visibly
 * shear something full-width.
 */
const disclosureTrigger: PartStyles = {
    base: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-md)',
        padding: 'var(--space-md) var(--space-xs)',
        borderRadius: 'var(--radius-field)',
        fontFamily: 'var(--font-sans)',
        // The text tokens both disclosure recipes declare (the tabs idiom):
        // `variants.size` rebinds them on the carrier, one flat rule per step.
        fontSize: 'var(--disclosure-text)',
        fontWeight: 'var(--weight-medium)',
        color: 'var(--color-base-content)',
        cursor: 'pointer',
        listStyle: 'none',
        transition: motion('background'),
    },
    states: {
        hover: { background: 'var(--color-base-200)' },
        open: {},
        closed: {},
        // The dim lives on the owning part (root / item); the row only re-cursors.
        disabled: { cursor: 'not-allowed' },
        ...focusRing,
    },
    selectors: {
        '&::after': {
            content: '""',
            flex: 'none',
            width: '0.4em',
            height: '0.4em',
            border: 'solid var(--hero-muted)',
            borderWidth: '0 2px 2px 0',
            marginInlineEnd: 'var(--space-2xs)',
            transform: 'rotate(45deg)',
            transition: motion('transform'),
        },
        '&[data-state="open"]::after': { transform: 'rotate(225deg)' },
        '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)' },
    },
};

const disclosurePanel: PartStyles = {
    base: {
        padding: '0 var(--space-xs) var(--space-md)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--disclosure-panel-text)',
        color: 'var(--hero-muted)',
    },
    states: { open: {}, closed: {} },
};

/** The resting values of the disclosure text tokens — md, the same steps as before #321. */
const disclosureTokens = {
    '--disclosure-text': 'var(--text-md)',
    '--disclosure-panel-text': 'var(--text-sm)',
};

/** v3's three steps, moving the row's type only — the tabs/select shape. */
const disclosureSizes: Record<string, Record<string, PartStyles>> = {
    sm: { root: { base: { '--disclosure-text': 'var(--text-sm)', '--disclosure-panel-text': 'var(--text-xs)' } } },
    // `md` is the un-attributed render — the tokens above already ARE it.
    md: {},
    lg: { root: { base: { '--disclosure-text': 'var(--text-lg)', '--disclosure-panel-text': 'var(--text-md)' } } },
};

// ── Tabs ──────────────────────────────────────────────────────────────────
export const tabs: RecipeInput = {
    component: 'tabs',
    tokens: { '--tabs-text': 'var(--text-sm)' },
    parts: {
        root: { base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' } },
        list: {
            base: {
                display: 'inline-flex',
                gap: 'var(--space-2xs)',
                padding: 'var(--space-2xs)',
                background: 'var(--color-base-200)',
                borderRadius: 'var(--radius-box)',
                width: 'fit-content',
            },
        },
        tab: {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                padding: 'var(--space-xs) var(--space-md)',
                borderRadius: 'var(--radius-field)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--tabs-text)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--hero-muted)',
                cursor: 'pointer',
                transition: motion('background, color, transform'),
            },
            states: {
                // v3's segmented look: the active tab is a raised pill.
                active: {
                    background: 'var(--color-base-100)',
                    color: 'var(--color-base-content)',
                    boxShadow: 'var(--shadow-sm)',
                },
                inactive: {},
                hover: { color: 'var(--color-base-content)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            // v3 presses inward rather than darkening further.
            selectors: {
                '&[data-pressed]:not([data-disabled])': { transform: 'scale(0.97)' },
            },
        },
        panel: {
            base: { fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', color: 'var(--color-base-content)' },
            states: { active: {}, inactive: {} },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--tabs-text': 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { '--tabs-text': 'var(--text-md)' } } },
        },
    },
};

// ── Collapsible ───────────────────────────────────────────────────────────
export const collapsible: RecipeInput = {
    component: 'collapsible',
    tokens: disclosureTokens,
    parts: {
        root: withPresence(disclosurePresence, {
            base: { color: 'var(--color-base-content)' },
            states: {
                open: {},
                closed: {},
                disabled: { opacity: 'var(--disabled-opacity)' },
            },
        }),
        trigger: disclosureTrigger,
        panel: disclosurePanel,
    },
    variants: { size: disclosureSizes },
};

// ── Switch ────────────────────────────────────────────────────────────────
export const switchRecipe: RecipeInput = {
    component: 'switch',
    tokens: {
        '--switch-width': 'calc(var(--size-selector) * 11)',
        '--switch-height': 'calc(var(--size-selector) * 6)',
        '--switch-pad': 'calc(var(--size-selector) * 0.5)',
        /**
         * The off-knob's edge. `--hero-line` is v3's hairline everywhere else
         * in this package, and it cannot be used here: against the
         * `base-300` track it measures 1.11:1, and the knob's own paper fill is
         * 1.23:1, so the pair leaves nothing to see. A quieted `--hero-muted`
         * does — 3.46:1 light, 3.68:1 dark (#228) — and unlike the `shadow-sm`
         * v3 delineates the knob with, a border survives `forced-colors`.
         *
         * Elsewhere in this package a hairline may be near-invisible because
         * the FILL carries the state (the checkbox box goes solid primary). The
         * switch is the one control where the knob's edge is all there is.
         */
        '--switch-thumb-edge': 'color-mix(in oklab, var(--hero-muted) 75%, transparent)',
    },
    parts: {
        root: {
            base: { display: 'inline-flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' },
            states: {
                checked: {}, unchecked: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                invalid: {}, required: {},
            },
        },
        control: {
            base: {
                position: 'relative',
                flex: 'none',
                width: 'var(--switch-width)',
                height: 'var(--switch-height)',
                borderRadius: '9999px',
                background: 'var(--color-base-300)',
                transition: motion('background'),
            },
            states: {
                checked: { background: 'var(--hero-primary)' },
                unchecked: {},
                disabled: {},
                // The system's error idiom is a danger BORDER, and this track
                // has none to recolour — adding one would move the thumb's
                // geometry. An inset ring is the same mark at the same weight,
                // drawn inside the box instead of around it, and it survives
                // the checked fill.
                invalid: { boxShadow: 'inset 0 0 0 2px var(--hero-danger)' },
                ...focusRing,
            },
        },
        // v3's paper knob and its lift, plus the edge the lift cannot be
        // (see `--switch-thumb-edge`). On the primary track the edge goes —
        // paper on the accent is 5.06:1 light / 7.22:1 dark on its own, and a
        // grey rule around a knob on blue is not v3.
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
                boxShadow: 'var(--shadow-sm)',
                transition: motion('translate, border-color'),
                // The anchor above is logical; the travel below could not be,
                // because `translate` has no logical form. That half-measure was
                // worse than neither half: under RTL the anchor moved the thumb
                // to the reading end and the travel then carried it further the
                // same way, off the track entirely. The sign is the missing half.
                '--switch-thumb-dir': '1',
            },
            states: {
                checked: {
                    translate: 'calc(var(--switch-thumb-dir) * (var(--switch-width) - var(--switch-height))) 0',
                    borderColor: 'transparent',
                },
                unchecked: {},
            },
            selectors: { [`&${rtl}`]: { '--switch-thumb-dir': '-1' } },
        },
        label: {
            base: { ...label },
            states: { checked: {}, unchecked: {}, disabled: {} },
        },
    },
    variants: {
        size: {
            sm: {
                root: {
                    base: {
                        '--switch-width': 'calc(var(--size-selector) * 9)',
                        '--switch-height': 'calc(var(--size-selector) * 5)',
                    },
                },
            },
            md: {},
            lg: {
                root: {
                    base: {
                        '--switch-width': 'calc(var(--size-selector) * 13)',
                        '--switch-height': 'calc(var(--size-selector) * 7)',
                    },
                },
            },
        },
    },
    // The ring draws on `control`; the root only groups it with its text.
    skipStates: { root: ['focus-visible'] },
};

/**
 * The control an overlay opens from: the `secondaryButton` box, with `hover`
 * and `open` taking one layer step. Button's own `[data-pressed]` scale is left
 * out here and added by `pressableOverlayTrigger` below, because tooltip — the
 * one trigger that opens nothing — declares no `pressed` flag, and a rule the
 * runtime can never satisfy is dead CSS.
 */
const overlayTrigger: PartStyles = {
    base: { ...secondaryButton, transition: motion('background, border-color, opacity') },
    states: {
        hover: { background: 'var(--color-base-200)' },
        open: { background: 'var(--color-base-200)' },
        closed: {},
        disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
        ...focusRing,
    },
};

/**
 * The same control where the anatomy declares `pressed` — dialog, popover and
 * menu (#214). All three shipped `{ cursor: 'pointer' }` and nothing else, so
 * Chrome painted them as 13.33px Arial chips with a 2px outset bevel, sitting a
 * few rows below HeroUI's own tinted buttons on the same page. They are one
 * control with one treatment, not three inline literals that happen to agree.
 */
const pressableOverlayTrigger: PartStyles = {
    ...overlayTrigger,
    base: { ...overlayTrigger.base, transition: motion('background, border-color, opacity, transform') },
    selectors: pressScale,
};

/**
 * The size axis for the four overlay triggers (#321). Dialog, popover,
 * tooltip and menu carry `data-size` on the TRIGGER — the anatomy's carrier
 * part; their popups are top-layer siblings the compiled `@scope` donut can
 * never reach, so size means the control itself, stepped exactly as the
 * button steps its own box. (There is no colour axis to wire: `roles: {}`.)
 */
const overlayTriggerSizes: Record<string, Record<string, PartStyles>> = {
    sm: { trigger: { base: { padding: 'var(--space-xs) var(--space-md)', fontSize: 'var(--text-xs)' } } },
    // `md` is the un-attributed render — `secondaryButton` already IS it.
    md: {},
    lg: { trigger: { base: { padding: 'var(--space-md) var(--space-xl)', fontSize: 'var(--text-md)' } } },
};

// ── Dialog ────────────────────────────────────────────────────────────────
export const dialog: RecipeInput = {
    component: 'dialog',
    parts: {
        trigger: pressableOverlayTrigger,
        popup: withPresence(popupPresence('translateY(8px) scale(0.98)'), {
            base: {
                border: 'none',
                borderRadius: 'var(--radius-box)',
                padding: 'var(--space-xl)',
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
                boxShadow: 'var(--shadow-xl)',
                maxWidth: 'min(32rem, calc(100vw - var(--space-2xl)))',
            },
        }),
        backdrop: {
            base: {
                background: 'var(--hero-scrim)',
                backdropFilter: 'blur(2px)',
                transition: 'opacity var(--duration-fast) var(--ease-standard), '
                    + 'display var(--duration-fast) allow-discrete, '
                    + 'overlay var(--duration-fast) allow-discrete',
                opacity: '0',
            },
            states: { open: { opacity: '1' }, closed: {} },
            at: {
                'starting-style': { states: { open: { opacity: '0' } } },
                'reduced-motion': { base: { transition: 'none' } },
            },
        },
        title: {
            base: {
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--color-base-content)',
            },
        },
        description: {
            base: {
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                color: 'var(--hero-muted)',
                marginBlockStart: 'var(--space-xs)',
            },
        },
        footer: {
            base: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginBlockStart: 'var(--space-xl)' },
        },
        close: dismissAction,
        // The alertdialog's least-destructive action — the same quiet chrome.
        cancel: dismissAction,
    },
    // Trigger-carried size — see `overlayTriggerSizes`.
    variants: { size: overlayTriggerSizes },
};

// ── Popover ───────────────────────────────────────────────────────────────
export const popover: RecipeInput = {
    component: 'popover',
    parts: {
        trigger: pressableOverlayTrigger,
        // Dialog's surface, one step lighter: hairline instead of borderless,
        // `lg` shadow instead of `xl`, and it rises into place from below.
        popup: withPresence(popupPresence('translateY(4px)'), {
            base: {
                margin: '0',
                padding: 'var(--space-lg)',
                minWidth: '14rem',
                maxWidth: 'min(20rem, calc(100vw - var(--space-2xl)))',
                border: 'var(--border) solid var(--hero-line)',
                borderRadius: 'var(--radius-box)',
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
                boxShadow: 'var(--shadow-lg)',
            },
        }),
        title: {
            base: {
                margin: '0 0 var(--space-xs)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--color-base-content)',
            },
        },
        close: dismissAction,
    },
    // Trigger-carried size — see `overlayTriggerSizes`.
    variants: { size: overlayTriggerSizes },
};

// ── Tooltip ───────────────────────────────────────────────────────────────
export const tooltip: RecipeInput = {
    component: 'tooltip',
    parts: {
        // `overlayTrigger` (above), with `cursor: help` as the one deviation:
        // nothing opens, so the pointer explains rather than acts. No pressed
        // rule — tooltip's anatomy declares no `pressed` flag.
        trigger: {
            ...overlayTrigger,
            base: { ...overlayTrigger.base, cursor: 'help' },
        },
        // The one inverted surface in the system: content ink as the fill.
        popup: withPresence(popupPresence('translateY(2px)'), {
            base: {
                margin: '0',
                padding: 'var(--space-xs) var(--space-sm)',
                maxWidth: '18rem',
                border: 'none',
                borderRadius: 'var(--radius-selector)',
                background: 'var(--color-base-content)',
                color: 'var(--color-base-100)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xs)',
                lineHeight: 'var(--leading-tight)',
                boxShadow: 'var(--shadow-sm)',
            },
        }),
    },
    // Trigger-carried size — see `overlayTriggerSizes`.
    variants: { size: overlayTriggerSizes },
};

// ── Menu ──────────────────────────────────────────────────────────────────
export const menu: RecipeInput = {
    component: 'menu',
    parts: {
        trigger: pressableOverlayTrigger,
        // The select popup's surface, verbatim — one floating-list look.
        popup: withPresence(popupPresence('translateY(-4px)'), {
            base: {
                margin: '0',
                padding: 'var(--space-2xs)',
                border: 'var(--border) solid var(--hero-line)',
                borderRadius: 'var(--radius-box)',
                background: 'var(--color-base-100)',
                boxShadow: 'var(--shadow-lg)',
                minWidth: '12rem',
            },
        }),
        item: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: 'var(--space-xs) var(--space-sm)',
                borderRadius: 'var(--radius-selector)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-base-content)',
                cursor: 'pointer',
                outline: 'none',
            },
            states: {
                highlighted: { background: 'var(--color-base-200)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)' },
            },
        },
        // The stateful rows are the item, unchanged; the mark column in front
        // carries the state (HeroUI marks selected menu rows with a tick).
        'checkbox-item': {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: 'var(--space-xs) var(--space-sm)',
                borderRadius: 'var(--radius-selector)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-base-content)',
                cursor: 'pointer',
                outline: 'none',
            },
            states: {
                highlighted: { background: 'var(--color-base-200)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                checked: {}, unchecked: {},
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)' },
            },
        },
        'radio-item': {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: 'var(--space-xs) var(--space-sm)',
                borderRadius: 'var(--radius-selector)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-base-content)',
                cursor: 'pointer',
                outline: 'none',
            },
            states: {
                highlighted: { background: 'var(--color-base-200)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                checked: {}, unchecked: {},
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)' },
            },
        },
        // The reserved mark column; the tick appears while checked, in the
        // row's own ink.
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
        // The item look, plus an `open` state that keeps it lit after focus
        // moves into the submenu. `open` before `highlighted`, so the pointer
        // hover wins both properties when the two apply at once (#116).
        'sub-trigger': {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: 'var(--space-xs) var(--space-sm)',
                borderRadius: 'var(--radius-selector)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-base-content)',
                cursor: 'pointer',
                outline: 'none',
            },
            states: {
                open: { background: 'var(--color-base-200)' },
                closed: {},
                highlighted: { background: 'var(--color-base-200)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
            selectors: {
                // A submenu opens toward the reading end, so the chevron that
                // announces it has to point that way. `\203A` points right in
                // every writing direction; `\2039` is its mirror, and the swap
                // agrees with the side `Menu.tsx` itself resolves from `:dir()`.
                '&::after': { content: '"\\203A"', marginInlineStart: 'auto', color: 'var(--hero-muted)' },
                [`&${rtl}::after`]: { content: '"\\2039"' },
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)' },
            },
        },
        // The popup surface again, entering from the side it attaches on.
        'sub-popup': withPresence(popupPresence('translateX(-4px)'), {
            base: {
                margin: '0',
                padding: 'var(--space-2xs)',
                border: 'var(--border) solid var(--hero-line)',
                borderRadius: 'var(--radius-box)',
                background: 'var(--color-base-100)',
                boxShadow: 'var(--shadow-lg)',
                minWidth: '12rem',
            },
        }),
        'context-trigger': {
            base: {},
            states: { open: {}, closed: {}, disabled: {} },
        },
        group: { base: {} },
        'group-label': {
            base: {
                padding: 'var(--space-xs) var(--space-sm)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--hero-muted)',
            },
        },
        separator: {
            base: {
                height: 'var(--border)',
                margin: 'var(--space-2xs) 0',
                background: 'var(--hero-line)',
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
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2xs)' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' }, invalid: {}, required: {} },
        },
        label: {
            base: { ...label },
            states: {
                disabled: {},
                invalid: { color: 'var(--hero-danger)' },
                // v3 marks required with the label's own weight, not an asterisk.
                required: { fontWeight: 'var(--weight-semibold)' },
            },
        },
        description: {
            base: { fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--hero-muted)' },
        },
        error: {
            base: { fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--hero-danger)' },
            states: { invalid: {} },
        },
    },
    variants: {
        // v3's three steps, moving type only (the tabs/select shape). There
        // is no colour axis to wire: `roles: {}`.
        size: {
            sm: { label: { base: { fontSize: 'var(--text-xs)' } } },
            // `md` is the un-attributed render — the base already IS it.
            md: {},
            lg: {
                label: { base: { fontSize: 'var(--text-md)' } },
                description: { base: { fontSize: 'var(--text-sm)' } },
                error: { base: { fontSize: 'var(--text-sm)' } },
            },
        },
    },
};

/**
 * Forced colors and print both erase painted geometry — the forced palette
 * revalues every colour the marks are drawn in, and a print engine drops
 * background paint by default — so both swap the drawn tick for text, the way
 * daisyUI's checkbox does. Zero renders no glyph of its own inside the
 * indicator, so here the mark IS the content.
 *
 * Both are named conditions (#226 added `print` beside `forced-colors`), so
 * both resolve at the preference tier — after the flat state rules they
 * replace.
 *
 * `ink` is the one thing the two renders disagree on, which is why each
 * condition gets its own object instead of sharing one: forced colours want a
 * SYSTEM colour, named, because an author colour there is only as good as the
 * UA's remapping of it — and the mode whose whole job is to make ink
 * predictable is the last place to leave it undefined. Print wants the page's
 * own ink: the near-white on-accent ink is right on the primary fill and wrong
 * on paper, where the fill does not print. Carbon's `markGlyphFallback` is the
 * same shape for the same reason.
 */
const drawnMarkFallback = (ink: string): PartStyles => ({
    base: { color: ink },
    selectors: {
        '&::before': { display: 'none' },
        // Not a pair of arms any more: a centred glyph, so the lengths, the
        // borders and the elbow rotation all have to go with them.
        '&::after': {
            width: 'auto',
            height: 'auto',
            border: 'none',
            borderRadius: '0',
            opacity: '1',
            left: '50%',
            top: '50%',
            transformOrigin: '50% 50%',
            transform: 'translate(-50%, -50%)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'calc(var(--checkbox-size) * 0.78)',
            lineHeight: 'var(--leading-none)',
        },
        '&[data-state="checked"]::after': { content: '"\\2713"' },
        '&[data-state="indeterminate"]::after': { content: '"\\2013"' },
    },
});

// ── Checkbox ──────────────────────────────────────────────────────────────
/**
 * The tick and the indeterminate bar are DRAWN, not glyphed: two borders of a
 * box rotated 45° about the elbow they share, and a pill-capped bar. Geometry
 * is what lets them scale with `--checkbox-size` and animate — a font glyph
 * can only fade, and half the fonts in the wild have no half-decent check in
 * them anyway.
 *
 * The three states set two 0|1 drivers instead of styling the marks
 * themselves. That keeps the geometry in one place and makes each state a
 * LENGTH: `--checkbox-tick: 1` grows both arms out of an elbow that is pinned
 * (`transform-origin` sits on the corner both borders meet at, so the
 * rotation never moves while the arms grow), which is a tick drawing itself
 * rather than one fading in. Two durations, one start: the short arm lands
 * first and the long one keeps going, which is the stroke order a hand uses.
 */
export const checkbox: RecipeInput = {
    component: 'checkbox',
    tokens: {
        '--checkbox-size': 'calc(var(--size-selector) * 5)',
        // ~2.4px at md, and never hairline-thin at sm.
        '--checkbox-stroke': 'max(1.5px, calc(var(--checkbox-size) * 0.12))',
        '--checkbox-tick': '0',
        '--checkbox-dash': '0',
    },
    parts: {
        root: {
            base: { display: 'inline-flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' },
            states: {
                checked: {}, unchecked: {}, indeterminate: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                invalid: {}, required: {},
            },
        },
        control: {
            base: {
                display: 'inline-grid',
                placeItems: 'center',
                flex: 'none',
                width: 'var(--checkbox-size)',
                height: 'var(--checkbox-size)',
                border: 'var(--border) solid var(--hero-line)',
                borderRadius: 'var(--radius-selector)',
                background: 'var(--color-base-100)',
                transition: motion('background, border-color, transform'),
            },
            states: {
                checked: { background: 'var(--hero-primary)', borderColor: 'var(--hero-primary)' },
                indeterminate: { background: 'var(--hero-primary)', borderColor: 'var(--hero-primary)' },
                unchecked: {},
                invalid: { borderColor: 'var(--hero-danger)' },
                disabled: {},
                ...focusRing,
            },
            // v3 presses inward — the radio item-control's language.
            selectors: {
                '&[data-pressed]:not([data-disabled])': { transform: 'scale(0.97)' },
            },
        },
        indicator: {
            base: {
                position: 'relative',
                display: 'block',
                width: '100%',
                height: '100%',
                color: 'var(--hero-primary-ink)',
                lineHeight: 'var(--leading-none)',
            },
            // Each state is the pair of arm/bar lengths, so the marks
            // interpolate between states instead of swapping.
            states: {
                checked: { '--checkbox-tick': '1', '--checkbox-dash': '0' },
                indeterminate: { '--checkbox-tick': '0', '--checkbox-dash': '1' },
                unchecked: { '--checkbox-tick': '0', '--checkbox-dash': '0' },
            },
            selectors: {
                // The tick. `left`/`top` are physical on purpose — a check is
                // not mirrored in RTL, only laid out on the other side.
                //
                // The anchor is the elbow, and it is SOLVED, not eyeballed. The
                // rotated L's ink reaches `0.707·(long arm + stroke)` up-right
                // of the elbow and `0.707·(short arm)` up-left of it, so with
                // arms of 58% + stroke and 30% + stroke the ink's bounding box
                // is centred when the elbow sits at
                //   left = 0.401,  top = 0.7051 + 0.7071·stroke/box = 0.79
                // (`--checkbox-stroke` is a fixed 0.12 of the box at every step
                // of the ramp, which is what makes `top` one number). Measured
                // on the 22px control at 16× device scale, that lands the ink at
                // T 6.00 / B 5.44 and L 3.13 / R 3.44 — the residual is the
                // corner radius below trimming the elbow's lowest point.
                // Eyeballed 38%/72% had it at T 4.00 / B 7.42: 1.7px high in a
                // 20px box, a visibly empty band underneath, where HeroUI's own
                // check icon is optically centred.
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    left: '40%',
                    top: '79%',
                    width: 'calc(30% * var(--checkbox-tick))',
                    height: 'calc(58% * var(--checkbox-tick))',
                    borderRight: 'var(--checkbox-stroke) solid currentColor',
                    borderBottom: 'var(--checkbox-stroke) solid currentColor',
                    // v3's softness, at the one corner a checkmark has.
                    borderBottomRightRadius: 'calc(var(--checkbox-stroke) * 0.75)',
                    opacity: 'var(--checkbox-tick)',
                    transformOrigin: '100% 100%',
                    transform: 'translate(-100%, -100%) rotate(45deg)',
                    // Accepted cost: `width`/`height` are on the layout path, so
                    // every frame of the draw-on dirties layout, where daisy's
                    // `clip-path` and material's `scale` run on the compositor.
                    // The arms ARE two borders of this box, and `scale` would
                    // scale the stroke with them — the alternative is a third
                    // element or a clip-path polygon, i.e. a different mark.
                    // One 20px box inside a checkbox is not a layout problem;
                    // a long virtualised list of them might be.
                    transition: 'width var(--duration-fast) var(--ease-decelerate), '
                        + 'height var(--duration-normal) var(--ease-decelerate), '
                        + 'opacity var(--duration-fast) var(--ease-standard)',
                },
                // The indeterminate bar — pill-capped, grown from its middle.
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    insetInline: '24%',
                    top: '50%',
                    height: 'var(--checkbox-stroke)',
                    borderRadius: '9999px',
                    background: 'currentColor',
                    opacity: 'var(--checkbox-dash)',
                    transform: 'translateY(-50%) scaleX(var(--checkbox-dash))',
                    transition: 'transform var(--duration-normal) var(--ease-decelerate), '
                        + 'opacity var(--duration-fast) var(--ease-standard)',
                },
            },
            at: {
                'forced-colors': drawnMarkFallback('CanvasText'),
                // `--print-ink`, not `--color-base-content`: the latter is
                // white under a dark theme, so it printed white on white (#233).
                print: drawnMarkFallback('var(--print-ink)'),
            },
        },
        label: {
            base: { ...label },
            states: { checked: {}, unchecked: {}, indeterminate: {}, disabled: {} },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 4)' } } },
            md: {},
            lg: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 6)' } } },
        },
    },
    skipStates: { root: ['focus-visible'] },
};

// ── Radio group ───────────────────────────────────────────────────────────
export const radioGroup: RecipeInput = {
    component: 'radio-group',
    tokens: { '--radio-size': 'calc(var(--size-selector) * 5)' },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                invalid: {}, required: {},
            },
            selectors: {
                '&[data-orientation="horizontal"]': { flexDirection: 'row' },
                // `invalid` lands on the root; the border that shows it lives
                // on each control.
                '&[data-invalid] [data-part="item-control"]': { borderColor: 'var(--hero-danger)' },
            },
        },
        label: {
            base: { ...label },
            states: {
                disabled: {},
                invalid: { color: 'var(--hero-danger)' },
                // v3 marks required with the label's own weight, not an asterisk.
                required: { fontWeight: 'var(--weight-semibold)' },
            },
        },
        item: {
            base: { display: 'inline-flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' },
            states: {
                checked: {}, unchecked: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
        },
        'item-control': {
            base: {
                display: 'inline-grid',
                placeItems: 'center',
                flex: 'none',
                width: 'var(--radio-size)',
                height: 'var(--radio-size)',
                border: 'var(--border) solid var(--hero-line)',
                borderRadius: '9999px',
                background: 'var(--color-base-100)',
                transition: motion('border-color, transform'),
            },
            states: {
                checked: { borderColor: 'var(--hero-primary)' },
                unchecked: {},
                disabled: {},
                ...focusRing,
            },
            // v3 presses inward rather than darkening further.
            selectors: {
                '&[data-pressed]:not([data-disabled])': { transform: 'scale(0.97)' },
            },
        },
        'item-indicator': {
            base: {
                width: 'calc(var(--radio-size) / 2)',
                height: 'calc(var(--radio-size) / 2)',
                borderRadius: '9999px',
                background: 'transparent',
                transition: motion('background'),
            },
            states: {
                checked: { background: 'var(--hero-primary)' },
                unchecked: {},
            },
        },
        'item-label': {
            base: { ...label },
            states: { checked: {}, unchecked: {}, disabled: {} },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 4)' } } },
            md: {},
            lg: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 6)' } } },
        },
    },
    // The ring draws on `item-control`; `item` is the <label> row around it.
    skipStates: { item: ['focus-visible'] },
};

// ── Progress ──────────────────────────────────────────────────────────────
export const progress: RecipeInput = {
    component: 'progress',
    tokens: {
        '--progress-height': 'calc(var(--size-selector) * 2)',
        /** The value readout's ink — the one thing `complete` recolours. */
        '--progress-ink': 'var(--hero-muted)',
    },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', width: '100%' },
            states: {
                loading: {},
                // A finished bar is a full bar, so `complete` cannot be the
                // fill's own colour without giving v3 a second accent. It is
                // the READOUT that settles onto the accent instead, and the
                // fill picks up the hairline below.
                complete: { '--progress-ink': 'var(--hero-primary)' },
                indeterminate: {},
            },
        },
        label: {
            base: { ...label },
        },
        track: {
            base: {
                width: '100%',
                height: 'var(--progress-height)',
                background: 'var(--color-base-300)',
                borderRadius: '9999px',
                overflow: 'hidden',
            },
        },
        range: {
            base: {
                height: '100%',
                background: 'var(--hero-primary)',
                borderRadius: '9999px',
                transition: motion('width, box-shadow'),
            },
            states: {
                loading: {},
                // v3 keeps its one accent, so completion is depth rather than
                // hue: the inset hairline that every other v3 fill carries
                // when it is done being provisional. The track is fully
                // covered at 100%, which is why the cue lives here.
                complete: {
                    boxShadow: 'inset 0 0 0 var(--border) '
                        + 'color-mix(in oklab, var(--hero-primary-ink) 70%, transparent)',
                },
                indeterminate: { width: '40%', animation: 'hero-indeterminate 1.2s ease-in-out infinite' },
            },
            // A looping animation must STOP under reduced motion, not speed
            // up — which is why its duration is a literal rather than a
            // `var(--duration-*)` that would collapse to 0.
            at: {
                'reduced-motion': {
                    states: { indeterminate: { animation: 'none', width: '100%' } },
                },
            },
        },
        'value-text': {
            base: {
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xs)',
                color: 'var(--progress-ink)',
                transition: motion('color'),
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--progress-height': 'calc(var(--size-selector) * 1.5)' } } },
            md: {},
            lg: { root: { base: { '--progress-height': 'calc(var(--size-selector) * 3)' } } },
        },
    },
    keyframes: {
        // Logical, so the sweep runs the way the bar fills — `margin-inline-start`
        // is animatable and direction-aware on its own. The determinate `width`,
        // an ordinary flow child, was already mirroring while this travelled the
        // other way.
        'hero-indeterminate': 'from { margin-inline-start: -40%; } to { margin-inline-start: 100%; }',
    },
};

// ── Slider ────────────────────────────────────────────────────────────────
export const slider: RecipeInput = {
    component: 'slider',
    tokens: {
        '--slider-accent': 'var(--hero-primary)',
        '--slider-track-size': 'calc(var(--size-selector) * 2)',
        '--slider-thumb-size': 'calc(var(--size-selector) * 5)',
    },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', width: '100%' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
        },
        label: {
            base: { ...label },
            states: { disabled: {} },
        },
        // A custom skin (`appearance: none`): Blink ignores thumb-pseudo
        // styling on a native slider, and Chrome treats range inputs as
        // always `:focus-visible` — so the offset ring would read as stuck.
        // Each state sets ONE custom property the vendor thumb pseudos read
        // (they cannot share a selector list), and the filled track reads the
        // runtime-published `--slider-percent` as a gradient stop.
        control: {
            base: {
                appearance: 'none',
                width: '100%',
                height: 'calc(var(--slider-thumb-size) + var(--size-selector) * 2)',
                margin: '0',
                background: 'transparent',
                cursor: 'pointer',
                outline: 'none',
                accentColor: 'var(--slider-accent)',
                '--slider-ring': 'transparent',
                '--slider-thumb-scale': '1',
                '--slider-track': 'linear-gradient(to right, '
                    + 'var(--slider-accent) var(--slider-percent, 50%), var(--color-base-300) 0)',
            },
            states: {
                // The ring IS the focus indicator here — see the skin comment.
                'focus-visible': { '--slider-ring': 'var(--hero-focus)' },
                pressed: { '--slider-thumb-scale': '0.94' },
                // `invalid` is semantic: the whole fill turns danger.
                invalid: { '--slider-accent': 'var(--hero-danger)' },
                disabled: { cursor: 'not-allowed' },
            },
            selectors: {
                '&::-webkit-slider-runnable-track': {
                    height: 'var(--slider-track-size)',
                    borderRadius: '9999px',
                    background: 'var(--slider-track)',
                },
                '&::-webkit-slider-thumb': {
                    appearance: 'none',
                    width: 'var(--slider-thumb-size)',
                    height: 'var(--slider-thumb-size)',
                    marginTop: 'calc((var(--slider-track-size) - var(--slider-thumb-size)) / 2)',
                    borderRadius: '9999px',
                    border: 'var(--border) solid var(--hero-line)',
                    background: 'var(--color-base-100)',
                    boxShadow: '0 0 0 2px var(--slider-ring), var(--shadow-sm)',
                    transform: 'scale(var(--slider-thumb-scale))',
                    transition: motion('box-shadow, transform'),
                },
                '&::-moz-range-track': {
                    height: 'var(--slider-track-size)',
                    borderRadius: '9999px',
                    background: 'var(--slider-track)',
                },
                '&::-moz-range-thumb': {
                    width: 'var(--slider-thumb-size)',
                    height: 'var(--slider-thumb-size)',
                    borderRadius: '9999px',
                    border: 'var(--border) solid var(--hero-line)',
                    background: 'var(--color-base-100)',
                    boxShadow: '0 0 0 2px var(--slider-ring), var(--shadow-sm)',
                    transform: 'scale(var(--slider-thumb-scale))',
                    transition: motion('box-shadow, transform'),
                },
            },
            at: {
                // Native rendering knows forced colors better than a custom
                // skin; the retained accentColor keeps the fallback branded.
                'forced-colors': {
                    base: { appearance: 'auto', '--slider-ring': 'transparent' },
                },
            },
        },
        // The composed range projection (#325): the same rail and paper disc
        // as the rebuilt control, as real parts. The thumb's edge is the
        // switch's 75%-muted border — `--hero-line` on this rail is the ring
        // nobody can see (#228).
        track: {
            base: {
                height: 'var(--slider-track-size)',
                marginBlock: 'calc((var(--slider-thumb-size) - var(--slider-track-size)) / 2 + var(--size-selector))',
                borderRadius: '9999px',
                background: 'var(--color-base-300)',
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
        thumb: {
            base: {
                boxSizing: 'border-box',
                width: 'var(--slider-thumb-size)',
                height: 'var(--slider-thumb-size)',
                insetBlockStart: '50%',
                translate: '0 -50%',
                marginInlineStart: 'calc(var(--slider-thumb-size) / -2)',
                borderRadius: '9999px',
                border: 'var(--border) solid color-mix(in oklab, var(--hero-muted) 75%, transparent)',
                background: 'var(--color-base-100)',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer',
                outline: 'none',
                touchAction: 'none',
                transition: motion('box-shadow, scale'),
            },
            states: {
                pressed: { scale: '0.94' },
                'focus-visible': { boxShadow: '0 0 0 2px var(--hero-focus), var(--shadow-sm)' },
                disabled: { cursor: 'not-allowed' },
            },
        },
        mark: {
            base: {
                paddingBlockStart: 'calc(var(--slider-track-size) + var(--space-2xs))',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xs)',
                lineHeight: '1',
                whiteSpace: 'nowrap',
                color: 'var(--hero-muted)',
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
                    background: 'var(--hero-muted)',
                },
            },
        },
        'value-text': {
            base: { fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--hero-muted)' },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--slider-thumb-size': 'calc(var(--size-selector) * 4)' } } },
            md: {},
            lg: {
                root: {
                    base: {
                        '--slider-thumb-size': 'calc(var(--size-selector) * 6)',
                        '--slider-track-size': 'calc(var(--size-selector) * 2.5)',
                    },
                },
            },
        },
    },
    // The focus indicator lives on the control's thumb; `invalid` recolours
    // the fill there too.
    skipStates: { root: ['invalid', 'focus-visible'] },
};

// ── Accordion ─────────────────────────────────────────────────────────────
export const accordion: RecipeInput = {
    component: 'accordion',
    tokens: disclosureTokens,
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', color: 'var(--color-base-content)' },
        },
        // Hairline-divided rows, no outer box — v3 keeps the frame this light.
        item: withPresence(disclosurePresence, {
            base: { borderBlockEnd: 'var(--border) solid var(--hero-line)' },
            states: {
                open: {},
                closed: {},
                disabled: { opacity: 'var(--disabled-opacity)' },
            },
            selectors: {
                '&:last-child': { borderBlockEnd: 'none' },
            },
        }),
        trigger: disclosureTrigger,
        panel: disclosurePanel,
    },
    variants: { size: disclosureSizes },
};

// ── Select ────────────────────────────────────────────────────────────────
export const select: RecipeInput = {
    component: 'select',
    tokens: { '--select-text': 'var(--text-sm)' },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column' },
            states: { disabled: {}, invalid: {}, required: {} },
        },
        trigger: {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-md)',
                minWidth: '12rem',
                padding: 'var(--space-sm) var(--space-md)',
                border: 'var(--border) solid var(--hero-line)',
                borderRadius: 'var(--radius-field)',
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--select-text)',
                cursor: 'pointer',
                transition: motion('border-color, background'),
            },
            states: {
                open: { borderColor: 'var(--hero-primary)' },
                closed: {},
                hover: { borderColor: 'var(--color-base-content)' },
                invalid: { borderColor: 'var(--hero-danger)' },
                placeholder: { color: 'var(--hero-muted)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            // A tint, not a scale — a full-width field would visibly shear.
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-200)' },
            },
        },
        value: {
            base: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
            states: { placeholder: { color: 'var(--hero-muted)' } },
        },
        indicator: {
            base: { flex: 'none', color: 'var(--hero-muted)', transition: motion('rotate') },
            states: { open: { rotate: '180deg' }, closed: {} },
        },
        popup: withPresence(popupPresence('translateY(-4px)'), {
            base: {
                margin: '0',
                padding: 'var(--space-2xs)',
                border: 'var(--border) solid var(--hero-line)',
                borderRadius: 'var(--radius-box)',
                background: 'var(--color-base-100)',
                boxShadow: 'var(--shadow-lg)',
                minWidth: '12rem',
            },
        }),
        // The optgroup equivalent (#325) — the menu's group grammar.
        group: { base: {} },
        'group-label': {
            base: {
                padding: 'var(--space-xs) var(--space-sm)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--hero-muted)',
            },
        },
        item: {
            base: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-sm)',
                padding: 'var(--space-xs) var(--space-sm)',
                borderRadius: 'var(--radius-selector)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--select-text)',
                color: 'var(--color-base-content)',
                cursor: 'pointer',
            },
            states: {
                highlighted: { background: 'var(--color-base-200)' },
                selected: { color: 'var(--hero-primary)', fontWeight: 'var(--weight-medium)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
            // The menu-item press — the same row language, one popup over.
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)' },
            },
        },
        'item-indicator': {
            base: { flex: 'none', color: 'var(--hero-primary)' },
            states: { selected: {} },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--select-text': 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { '--select-text': 'var(--text-md)' } } },
        },
    },
};

// ── Button ────────────────────────────────────────────────────────────────
export const button: RecipeInput = {
    component: 'button',
    /**
     * The un-attributed render IS `variant="primary"` at `size="md"`, so the
     * defaults live here rather than in `defaultVariants` — no `:not([…])`
     * mirror is emitted and the variants only rebind (the "toast shape").
     */
    tokens: {
        '--btn-fill': 'var(--hero-primary)',
        '--btn-ink': 'var(--hero-primary-ink)',
        '--btn-line': 'transparent',
    },
    parts: {
        root: {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-sm)',
                // v3 sizes to its content — v2's min-widths are gone.
                width: 'fit-content',
                padding: 'var(--space-sm) var(--space-lg)',
                border: 'var(--border) solid var(--btn-line)',
                borderRadius: 'var(--radius-field)',
                background: 'var(--btn-fill)',
                color: 'var(--btn-ink)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
                transition: motion('background, border-color, opacity, transform'),
            },
            states: {
                hover: { filter: 'brightness(0.95)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed', filter: 'none' },
                ...focusRing,
            },
            // v3 presses inward rather than darkening further.
            selectors: {
                '&[data-pressed]:not([data-disabled])': { transform: 'scale(0.97)' },
            },
        },
    },
    variants: {
        /**
         * The fused axis. Note what is NOT here: any notion of colour a
         * consumer could pass separately. `danger` is a variant.
         */
        variant: {
            primary: { root: { base: { '--btn-fill': 'var(--hero-primary)', '--btn-ink': 'var(--hero-primary-ink)', '--btn-line': 'transparent' } } },
            secondary: {
                root: {
                    base: {
                        '--btn-fill': 'var(--color-base-100)',
                        '--btn-ink': 'var(--color-base-content)',
                        '--btn-line': 'var(--hero-line)',
                    },
                },
            },
            tertiary: { root: { base: { '--btn-fill': 'transparent', '--btn-ink': 'var(--hero-muted)', '--btn-line': 'transparent' } } },
            outline: { root: { base: { '--btn-fill': 'transparent', '--btn-ink': 'var(--hero-primary)', '--btn-line': 'var(--hero-primary)' } } },
            ghost: { root: { base: { '--btn-fill': 'transparent', '--btn-ink': 'var(--color-base-content)', '--btn-line': 'transparent' } } },
            danger: { root: { base: { '--btn-fill': 'var(--hero-danger)', '--btn-ink': 'var(--hero-danger-ink)', '--btn-line': 'transparent' } } },
            'danger-soft': { root: { base: { '--btn-fill': 'var(--hero-danger-soft)', '--btn-ink': 'var(--hero-danger)', '--btn-line': 'transparent' } } },
        },
        size: {
            sm: { root: { base: { padding: 'var(--space-xs) var(--space-md)', fontSize: 'var(--text-xs)' } } },
            // `md` is the un-attributed render — the base already IS it.
            md: {},
            lg: { root: { base: { padding: 'var(--space-md) var(--space-xl)', fontSize: 'var(--text-md)' } } },
        },
    },
    /** HeroUI's `isIconOnly` / `isPending` — presence-only, no value. */
    modifiers: {
        'icon-only': {
            root: { base: { padding: 'var(--space-sm)', aspectRatio: '1', gap: '0' } },
        },
        /**
         * `pending` is a LOADING state, not a disabled one: the reader is
         * waiting on that label, so it gets no WCAG 1.4.3 carve-out and no
         * lower floor. At 0.7 the group fade took the label with the fill and
         * dropped `primary` to 2.92:1 and `outline` to 2.97:1 on the light
         * theme (#263) — under the floor by a hair, in the one state where the
         * text matters most.
         *
         * 0.8 keeps the fade legible as a fade (with `cursor: progress` saying
         * the rest) while clearing 3:1 on every variant and theme.
         */
        pending: {
            root: { base: { cursor: 'progress', opacity: '0.8' } },
        },
    },
    compoundVariants: [
        {
            // A destructive icon button reads as a target, not a label — the
            // first `compoundVariants` entry in the repo that matches a
            // presence-only modifier rather than only axis values.
            match: { variant: 'danger', 'icon-only': true },
            parts: { root: { base: { borderRadius: '9999px' } } },
        },
    ],
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
                // v3 avatars are circles, not rounded squares.
                borderRadius: '9999px',
                overflow: 'hidden',
                verticalAlign: 'middle',
                background: 'var(--color-base-200)',
            },
            states: { loading: {}, loaded: {}, error: {} },
        },
        image: {
            base: { gridArea: '1 / 1', width: '100%', height: '100%', objectFit: 'cover' },
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
                fontWeight: 'var(--weight-medium)',
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
            md: {},
            lg: { root: { base: { '--avatar-size': 'calc(var(--size-selector) * 12)', '--avatar-text': 'var(--text-md)' } } },
        },
    },
};

// ── Toast ─────────────────────────────────────────────────────────────────
/**
 * Toast presence is runtime-managed — the one popup-shaped component where
 * `@starting-style`/`allow-discrete` must NOT be used: zero mounts the root
 * `closed`, flips it `open` a frame later, and keeps it mounted after
 * dismissal until the longest transition here finishes. Both directions are
 * the ordinary two-state transition. The viewport IS the top-layer popover
 * (`popover="manual"`), so its recipe neutralizes the UA popover box —
 * `inset`, border, Canvas fill — and lets `data-placement` position it.
 */
export const toast: RecipeInput = {
    component: 'toast',
    parts: {
        viewport: {
            base: {
                position: 'fixed',
                inset: 'auto',
                margin: '0',
                padding: 'var(--space-xl)',
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
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-md)',
                minWidth: '18rem',
                padding: 'var(--space-md) var(--space-lg)',
                border: 'var(--border) solid var(--hero-line)',
                borderRadius: 'var(--radius-box)',
                background: 'var(--color-base-100)',
                boxShadow: 'var(--shadow-lg)',
                opacity: '0',
                // heroui is the one skin whose toast enters on the INLINE axis;
                // the other five use `translateY`, which no writing direction
                // touches. So this is the only one that has to know which way
                // "in" is — and it did not: a flat `translateX(8px)` entered from
                // the physical right, which is the wrong side under RTL and the
                // wrong side for a `*-start` placement even in LTR.
                //
                // The offset is signed by the placement, and `--toast-dir` flips
                // the axis, because `transform` has no logical form. The centred
                // placements keep the end-side entry they already had.
                '--toast-from': '8px',
                '--toast-dir': '1',
                transform: 'translateX(calc(var(--toast-dir) * var(--toast-from)))',
                transition: motion('opacity, transform'),
            },
            states: {
                open: { opacity: '1', transform: 'none' },
                closed: {},
            },
            selectors: {
                '&[data-placement$="-start"]': { '--toast-from': '-8px' },
                [`&${rtl}`]: { '--toast-dir': '-1' },
            },
            at: {
                'reduced-motion': { base: { transition: 'none' }, states: { open: { transform: 'none' } } },
            },
        },
        title: {
            base: {
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--color-base-content)',
            },
        },
        description: {
            base: { fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--hero-muted)' },
        },
        action: {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'var(--hero-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                cursor: 'pointer',
                borderRadius: 'var(--radius-selector)',
            },
            states: {
                hover: { textDecoration: 'underline' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
        },
        close: {
            ...iconClose,
            base: { ...iconClose.base, marginInlineStart: 'auto' },
        },
    },
    variants: {
        // Size moves the card's box and its type together — the three text
        // parts carry fixed sizes, so each step restates them. There is no
        // colour axis to wire: `roles: {}`.
        size: {
            sm: {
                root: { base: { padding: 'var(--space-sm) var(--space-md)' } },
                title: { base: { fontSize: 'var(--text-xs)' } },
                description: { base: { fontSize: 'var(--text-xs)' } },
                action: { base: { fontSize: 'var(--text-xs)' } },
            },
            // `md` is the un-attributed render — the base already IS it.
            md: {},
            lg: {
                root: { base: { padding: 'var(--space-lg) var(--space-xl)' } },
                title: { base: { fontSize: 'var(--text-md)' } },
                description: { base: { fontSize: 'var(--text-md)' } },
                action: { base: { fontSize: 'var(--text-md)' } },
            },
        },
    },
};

// ── Combobox ──────────────────────────────────────────────────────────────
export const combobox: RecipeInput = {
    component: 'combobox',
    tokens: { '--combobox-text': 'var(--text-sm)' },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column' },
            states: { disabled: {}, invalid: {}, required: {} },
        },
        // The field chrome — the select trigger's language, split so the
        // input and the disclosure button sit joined inside one border.
        control: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                minWidth: '12rem',
                border: 'var(--border) solid var(--hero-line)',
                borderRadius: 'var(--radius-field)',
                background: 'var(--color-base-100)',
                transition: motion('border-color'),
            },
            states: {
                open: { borderColor: 'var(--hero-primary)' },
                closed: {},
                hover: { borderColor: 'var(--color-base-content)' },
                invalid: { borderColor: 'var(--hero-danger)' },
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
                padding: 'var(--space-sm) var(--space-md)',
                color: 'var(--color-base-content)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--combobox-text)',
            },
            states: {
                open: {}, closed: {},
                disabled: { cursor: 'not-allowed' },
                invalid: {}, required: {}, readonly: {},
            },
            selectors: {
                '&::placeholder': { color: 'var(--hero-muted)' },
            },
        },
        trigger: {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'var(--hero-muted)',
                padding: '0 var(--space-md)',
                cursor: 'pointer',
                transition: motion('rotate, transform'),
            },
            states: {
                open: { rotate: '180deg' },
                closed: {},
                disabled: { cursor: 'not-allowed' },
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { transform: 'scale(0.97)' },
            },
        },
        popup: withPresence(popupPresence('translateY(-4px)'), {
            base: {
                margin: '0',
                padding: 'var(--space-2xs)',
                border: 'var(--border) solid var(--hero-line)',
                borderRadius: 'var(--radius-box)',
                background: 'var(--color-base-100)',
                boxShadow: 'var(--shadow-lg)',
                minWidth: '12rem',
            },
        }),
        // The optgroup equivalent (#325) — the menu's group grammar.
        group: { base: {} },
        'group-label': {
            base: {
                padding: 'var(--space-xs) var(--space-sm)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--hero-muted)',
            },
        },
        item: {
            base: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-sm)',
                padding: 'var(--space-xs) var(--space-sm)',
                borderRadius: 'var(--radius-selector)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--combobox-text)',
                color: 'var(--color-base-content)',
                cursor: 'pointer',
            },
            states: {
                highlighted: { background: 'var(--color-base-200)' },
                selected: { color: 'var(--hero-primary)', fontWeight: 'var(--weight-medium)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
            // The menu-item press — the same row language, one popup over.
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)' },
            },
        },
        'item-indicator': {
            base: { flex: 'none', color: 'var(--hero-primary)' },
            states: { selected: {} },
        },
        empty: {
            base: {
                padding: 'var(--space-md)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--combobox-text)',
                color: 'var(--hero-muted)',
                textAlign: 'center',
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--combobox-text': 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { '--combobox-text': 'var(--text-md)' } } },
        },
    },
    // The ring draws on `control`; the input and the trigger sit inside it.
    skipStates: { input: ['focus-visible'], trigger: ['focus-visible'] },
};

// ── Number input ──────────────────────────────────────────────────────────
export const numberInput: RecipeInput = {
    component: 'number-input',
    tokens: { '--number-input-text': 'var(--text-sm)' },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-2xs)' },
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        },
        label: {
            base: { ...label },
            states: {
                disabled: {},
                invalid: { color: 'var(--hero-danger)' },
                // v3 marks required with the label's own weight, not an asterisk.
                required: { fontWeight: 'var(--weight-semibold)' },
            },
        },
        // The field chrome (the combobox split): the ring and the invalid
        // border draw on the box; input and steppers sit joined inside it.
        control: {
            base: {
                display: 'inline-flex',
                alignItems: 'stretch',
                border: 'var(--border) solid var(--hero-line)',
                borderRadius: 'var(--radius-field)',
                background: 'var(--color-base-100)',
                transition: motion('border-color'),
            },
            states: {
                hover: { borderColor: 'var(--color-base-content)' },
                invalid: { borderColor: 'var(--hero-danger)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
                readonly: {},
                ...focusRing,
            },
        },
        input: {
            base: {
                width: '4.5rem',
                minWidth: '0',
                appearance: 'none',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                padding: 'var(--space-sm) var(--space-md)',
                color: 'var(--color-base-content)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--number-input-text)',
                textAlign: 'center',
            },
            states: {
                disabled: { cursor: 'not-allowed' },
                invalid: {}, required: {}, readonly: {},
            },
            selectors: {
                '&::placeholder': { color: 'var(--hero-muted)' },
            },
        },
        // Steppers as ghost squares flanking the readout — muted until
        // hovered, no seams; the shared border already frames them.
        'increment-trigger': {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'transparent',
                color: 'var(--hero-muted)',
                borderRadius: 'var(--radius-selector)',
                padding: '0 var(--space-md)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--number-input-text)',
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
                userSelect: 'none',
                transition: motion('background, color, transform'),
            },
            states: {
                hover: { background: 'var(--color-base-200)', color: 'var(--color-base-content)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { transform: 'scale(0.97)' },
            },
        },
        'decrement-trigger': {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'transparent',
                color: 'var(--hero-muted)',
                borderRadius: 'var(--radius-selector)',
                padding: '0 var(--space-md)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--number-input-text)',
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
                userSelect: 'none',
                transition: motion('background, color, transform'),
            },
            states: {
                hover: { background: 'var(--color-base-200)', color: 'var(--color-base-content)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { transform: 'scale(0.97)' },
            },
        },
    },
    variants: {
        size: {
            sm: {
                root: { base: { '--number-input-text': 'var(--text-xs)' } },
                input: { base: { padding: 'var(--space-xs) var(--space-sm)' } },
            },
            md: {},
            lg: {
                root: { base: { '--number-input-text': 'var(--text-md)' } },
                input: { base: { padding: 'var(--space-md) var(--space-lg)' } },
            },
        },
    },
    // The ring draws on `control`; the input delegates.
    skipStates: { input: ['focus-visible'] },
};

// ── Rating group ──────────────────────────────────────────────────────────
/**
 * One clipped paint layer of the star: `track` is what shows where the fill
 * has not reached, and the fill itself is a flat image layer whose
 * `background-size` the states drive. Used twice — the silhouette, and the
 * hollow inside it.
 */
const ratingLayer = (track: string): CssProps => ({
    content: '""',
    position: 'absolute',
    clipPath: 'var(--rating-star)',
    backgroundColor: track,
    backgroundImage: 'linear-gradient(to right, var(--hero-primary) 0 100%)',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'var(--rating-fill-stop) 100%',
    transition: motion('background-size'),
});

/**
 * What the fill layer becomes under forced colours: the mode revalues author
 * paint, so the layer names a SYSTEM colour instead — the only way a painted
 * fill still adapts to the user's palette rather than vanishing into it. The
 * opt-out that makes it stick is on the item (see the `forced-colors` block).
 */
const ratingSystemFill: CssProps = {
    backgroundImage: 'linear-gradient(to right, Highlight 0 100%)',
};

/**
 * The star is DRAWN — a clip-path polygon over a two-layer paint — and the
 * item's own symbol is hidden behind it. Two reasons, both load-bearing:
 *
 *  - `full` and `half` used to be the same colour, so a half star was a full
 *    star. Here the fill is one flat layer whose `background-size` is
 *    0% / 50% / 100%, so `half` is a real geometric half of the same shape,
 *    and it INTERPOLATES: the fill wipes across the symbol as the hover
 *    preview moves over the row.
 *  - zero's fallback symbol cannot say `half` at all. U+2BEA (⯪) is shipped by
 *    almost no system font — it rendered as a tofu box on macOS — so the
 *    default `half` is a full `★` (#222), identical to `full`. Drawing the star
 *    means the three states never depend on a font, or on that default, at all.
 *
 * A consumer symbol (the default slot exists for SVGs) opts out through
 * `:has(*)` and takes plain per-state ink instead; it gets `state` in the slot
 * and can draw its own half.
 */
export const ratingGroup: RecipeInput = {
    component: 'rating-group',
    tokens: {
        '--rating-size': 'calc(var(--size-selector) * 6)',
        /** How much of the star the fill covers — the whole state axis. */
        '--rating-fill-stop': '0%',
        /** Ink for a symbol we don't draw — a consumer's own SVG or glyph. */
        '--rating-symbol': 'var(--hero-muted)',
        /** A five-pointed star, as one clip. */
        '--rating-star': 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, '
            + '50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
    },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-2xs)' },
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        },
        label: {
            base: { ...label },
            states: {
                disabled: {},
                invalid: { color: 'var(--hero-danger)' },
                // v3 marks required with the label's own weight, not an asterisk.
                required: { fontWeight: 'var(--weight-semibold)' },
            },
        },
        control: {
            base: { display: 'inline-flex', gap: 'var(--space-2xs)', borderRadius: 'var(--radius-selector)' },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                readonly: {},
                ...focusRing,
            },
        },
        item: {
            base: {
                position: 'relative',
                display: 'inline-block',
                width: 'var(--rating-size)',
                height: 'var(--rating-size)',
                fontSize: 'var(--rating-size)',
                lineHeight: 'var(--leading-none)',
                borderRadius: 'var(--radius-selector)',
                cursor: 'pointer',
                userSelect: 'none',
                // The symbol still sizes and reads (it is the accessible
                // content); the drawn star is what paints.
                color: 'transparent',
                WebkitTextFillColor: 'transparent',
                transition: motion('transform'),
            },
            states: {
                full: { '--rating-fill-stop': '100%', '--rating-symbol': 'var(--hero-primary)' },
                half: { '--rating-fill-stop': '50%', '--rating-symbol': 'var(--hero-primary)' },
                empty: { '--rating-fill-stop': '0%', '--rating-symbol': 'var(--hero-muted)' },
                // The hover-preview range lifts gently — v3 never jumps.
                highlighted: { transform: 'scale(1.1)' },
                disabled: { cursor: 'not-allowed' },
                readonly: { cursor: 'default' },
                // The group ring lives on control and the focused item flags
                // simultaneously — an inward ring keeps the pair from reading
                // as two identical concentric rings.
                'focus-visible': { outline: '2px solid var(--hero-focus)', outlineOffset: '-2px' },
            },
            selectors: {
                // The silhouette, and the star inset inside it. Both take the
                // same fill layer, so the fill's edge cuts through outline and
                // interior together: filled side solid, unfilled side hollow.
                '&::before': { ...ratingLayer('var(--hero-muted)'), inset: '0' },
                '&::after': { ...ratingLayer('var(--color-base-100)'), inset: '12%' },
                // The fill grows from the leading edge, and its layer is one
                // flat colour — so direction is a background-position, not a
                // gradient angle.
                [`&${rtl}::before, &${rtl}::after`]: { backgroundPositionX: 'right' },
                // A consumer symbol draws itself: hand it back the box, the
                // ink and the paint.
                '&:has(*)': {
                    width: 'auto',
                    height: 'auto',
                    color: 'var(--rating-symbol)',
                    WebkitTextFillColor: 'currentcolor',
                },
                '&:has(*)::before, &:has(*)::after': { display: 'none' },
            },
            at: {
                'reduced-motion': {
                    base: { transition: 'none' },
                    states: { highlighted: { transform: 'none' } },
                    selectors: { '&::before, &::after': { transition: 'none' } },
                },
                // Both fallbacks keep the GEOMETRY and re-source its paint,
                // rather than swapping in a glyph that cannot say "half":
                // zero's default `half` is a full `★` (U+2BEA, the half-star
                // codepoint, is tofu in most system fonts — #222), so a row
                // handed back to the text would read a half as a whole and
                // overstate the value.
                //
                // The forced palette revalues an author's colour but honours a
                // SYSTEM one, so the item opts out of the revaluation and the
                // layers name system colours by hand. The opt-out is also what
                // keeps `color: transparent` honoured — a forced CanvasText
                // would paint the default text star straight over the drawn one.
                'forced-colors': {
                    base: { forcedColorAdjust: 'none' },
                    // The one thing the opt-out costs: an author-coloured ring
                    // is exactly what this mode exists to replace, so hand the
                    // ring back to the system palette explicitly.
                    states: { 'focus-visible': { outline: '2px solid Highlight' } },
                    selectors: {
                        '&::before': { ...ratingLayer('CanvasText'), ...ratingSystemFill },
                        '&::after': { ...ratingLayer('Canvas'), ...ratingSystemFill },
                    },
                },
                // Paper drops background paint under `print-color-adjust:
                // economy`, and the fill IS the value here — so ask for it.
                // A reader who turns background graphics off can still refuse:
                // the row then prints blank rather than lying about the value.
                // Glyph ink would survive that — #230.
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
            sm: { root: { base: { '--rating-size': 'calc(var(--size-selector) * 5)' } } },
            md: {},
            lg: { root: { base: { '--rating-size': 'calc(var(--size-selector) * 7)' } } },
        },
    },
};

// ── Tree view ─────────────────────────────────────────────────────────────
export const treeView: RecipeInput = {
    component: 'tree-view',
    tokens: { '--tree-text': 'var(--text-sm)' },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
        },
        label: {
            base: { ...label, fontWeight: 'var(--weight-semibold)' },
        },
        tree: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2xs)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--tree-text)',
                color: 'var(--color-base-content)',
            },
        },
        // Rows speak the menu-item language: quiet until highlighted, and a
        // selected row keeps its ink rather than taking a fill.
        item: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: 'var(--space-xs) var(--space-sm)',
                borderRadius: 'var(--radius-selector)',
                cursor: 'pointer',
                transition: motion('background, color'),
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                selected: { color: 'var(--hero-primary)', fontWeight: 'var(--weight-medium)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                // Rows sit flush — an offset ring would collide with the
                // neighbours, so it draws inward.
                'focus-visible': { outline: '2px solid var(--hero-focus)', outlineOffset: '-2px' },
            },
            selectors: {
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
                gap: 'var(--space-sm)',
                padding: 'var(--space-xs) var(--space-sm)',
                borderRadius: 'var(--radius-selector)',
                cursor: 'pointer',
                userSelect: 'none',
                transition: motion('background, color'),
            },
            states: {
                open: {}, closed: {},
                hover: { background: 'var(--color-base-200)' },
                selected: { color: 'var(--hero-primary)', fontWeight: 'var(--weight-medium)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                'focus-visible': { outline: '2px solid var(--hero-focus)', outlineOffset: '-2px' },
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)' },
            },
        },
        'branch-indicator': {
            base: { display: 'inline-block', flex: 'none', color: 'var(--hero-muted)', transition: motion('rotate') },
            states: { open: { rotate: '90deg' }, closed: {} },
            // The glyph is element text the runtime renders (`TreeView.tsx`), not
            // `content:`, so the `:dir(rtl)` swap the submenu chevron uses is not
            // available here — a mirror is its equivalent. `scale` composes
            // OUTSIDE `transform` (and outside the individual `rotate`), so the
            // closed glyph flips to point at the reading end while the open one,
            // already rotated to point down, is unaffected by a horizontal flip.
            selectors: { [`&${rtl}`]: { scale: '-1 1' } },
        },
        // Depth is the DOM nesting; a hairline guide traces each level.
        'branch-content': {
            base: {
                display: 'flex',
                flexDirection: 'column',
                marginInlineStart: 'var(--space-md)',
                paddingInlineStart: 'var(--space-sm)',
                borderInlineStart: 'var(--border) solid var(--hero-line)',
            },
            states: { open: {}, closed: {} },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--tree-text': 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { '--tree-text': 'var(--text-md)' } } },
        },
    },
};

// ── Toggle ────────────────────────────────────────────────────────────────
export const toggle: RecipeInput = {
    component: 'toggle',
    parts: {
        root: {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-sm)',
                width: 'fit-content',
                padding: 'var(--space-sm) var(--space-md)',
                border: 'none',
                borderRadius: 'var(--radius-field)',
                background: 'transparent',
                color: 'var(--hero-muted)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
                transition: motion('background, color, transform'),
            },
            states: {
                // v3's toggle reads as a ghost button until it holds.
                on: { background: 'var(--color-base-200)', color: 'var(--color-base-content)' },
                off: {},
                hover: { color: 'var(--color-base-content)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { transform: 'scale(0.97)' },
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { padding: 'var(--space-md) var(--space-lg)', fontSize: 'var(--text-md)' } } },
        },
    },
};

// ── Toggle group ──────────────────────────────────────────────────────────
export const toggleGroup: RecipeInput = {
    component: 'toggle-group',
    tokens: { '--toggle-group-text': 'var(--text-sm)' },
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                gap: 'var(--space-2xs)',
                padding: 'var(--space-2xs)',
                background: 'var(--color-base-200)',
                borderRadius: 'var(--radius-box)',
                width: 'fit-content',
            },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
            selectors: {
                '&[data-orientation="vertical"]': { flexDirection: 'column' },
            },
        },
        item: {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                padding: 'var(--space-xs) var(--space-md)',
                borderRadius: 'var(--radius-field)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--toggle-group-text)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--hero-muted)',
                cursor: 'pointer',
                transition: motion('background, color, transform'),
            },
            states: {
                // The tabs-list look: a held item is a raised pill.
                on: {
                    background: 'var(--color-base-100)',
                    color: 'var(--color-base-content)',
                    boxShadow: 'var(--shadow-sm)',
                },
                off: {},
                // `data-selected` mirrors `on` in a group — the raised pill
                // above already says it.
                selected: {},
                hover: { color: 'var(--color-base-content)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { transform: 'scale(0.97)' },
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--toggle-group-text': 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { '--toggle-group-text': 'var(--text-md)' } } },
        },
    },
};

/**
 * Merge presence into a part's own styles per KEY, so a recipe that already
 * writes `states: { open: {} }` does not replace the open state presence needs.
 */
function withPresence(presence: PartStyles, styles: PartStyles): PartStyles {
    const merge = (a: Record<string, CssProps> | undefined, b: Record<string, CssProps> | undefined) =>
        Object.fromEntries(
            [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])]
                .map((key) => [key, { ...a?.[key], ...b?.[key] }]),
        );
    return {
        base: { ...presence.base, ...styles.base },
        states: merge(presence.states, styles.states),
        selectors: merge(presence.selectors, styles.selectors),
        at: Object.fromEntries(
            [...new Set([...Object.keys(presence.at ?? {}), ...Object.keys(styles.at ?? {})])]
                .map((key) => [key, withPresence(presence.at?.[key] ?? {}, styles.at?.[key] ?? {})]),
        ),
    };
}

// ── Text fields ───────────────────────────────────────────────────────────
/**
 * HeroUI's bordered input. Same chrome as the number input's control, and the
 * same three-step ramp — no `color` axis, because this design system declares
 * none (`roles: {}`); the ring is always `--hero-focus` and the invalid border
 * always `--hero-danger`.
 */
export const input: RecipeInput = {
    component: 'input',
    tokens: { '--input-text': 'var(--text-sm)' },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-2xs)' },
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        },
        label: {
            base: { ...label },
            states: {
                disabled: {},
                invalid: { color: 'var(--hero-danger)' },
                // v3 marks required with the label's own weight, not an asterisk.
                required: { fontWeight: 'var(--weight-semibold)' },
            },
        },
        control: {
            base: {
                display: 'inline-flex',
                alignItems: 'stretch',
                border: 'var(--border) solid var(--hero-line)',
                borderRadius: 'var(--radius-field)',
                background: 'var(--color-base-100)',
                transition: motion('border-color'),
            },
            states: {
                hover: { borderColor: 'var(--color-base-content)' },
                invalid: { borderColor: 'var(--hero-danger)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
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
                padding: 'var(--space-sm) var(--space-md)',
                color: 'var(--color-base-content)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--input-text)',
            },
            states: {
                disabled: { cursor: 'not-allowed' },
                invalid: {}, required: {}, readonly: {},
            },
            selectors: {
                '&::placeholder': { color: 'var(--hero-muted)' },
            },
        },
    },
    variants: {
        size: {
            sm: {
                root: { base: { '--input-text': 'var(--text-xs)' } },
                input: { base: { padding: 'var(--space-xs) var(--space-sm)' } },
            },
            md: {},
            lg: {
                root: { base: { '--input-text': 'var(--text-md)' } },
                input: { base: { padding: 'var(--space-md) var(--space-lg)' } },
            },
        },
    },
    // The ring draws on `control`; the input delegates.
    skipStates: { input: ['focus-visible'] },
};

/** The same bordered field, drawn on the element — see the textarea anatomy. */
export const textarea: RecipeInput = {
    component: 'textarea',
    tokens: { '--textarea-text': 'var(--text-sm)' },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-2xs)' },
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        },
        label: {
            base: { ...label },
            states: {
                disabled: {},
                invalid: { color: 'var(--hero-danger)' },
                required: { fontWeight: 'var(--weight-semibold)' },
            },
        },
        textarea: {
            base: {
                display: 'block',
                width: '100%',
                minWidth: '0',
                appearance: 'none',
                border: 'var(--border) solid var(--hero-line)',
                borderRadius: 'var(--radius-field)',
                background: 'var(--color-base-100)',
                padding: 'var(--space-sm) var(--space-md)',
                color: 'var(--color-base-content)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--textarea-text)',
                lineHeight: 'var(--leading-normal)',
                resize: 'vertical',
                transition: motion('border-color'),
            },
            states: {
                hover: { borderColor: 'var(--color-base-content)' },
                invalid: { borderColor: 'var(--hero-danger)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                readonly: {},
                required: {},
                ...focusRing,
            },
            selectors: {
                '&::placeholder': { color: 'var(--hero-muted)' },
            },
        },
    },
    variants: {
        size: {
            sm: {
                root: { base: { '--textarea-text': 'var(--text-xs)' } },
                textarea: { base: { padding: 'var(--space-xs) var(--space-sm)' } },
            },
            md: {},
            lg: {
                root: { base: { '--textarea-text': 'var(--text-md)' } },
                textarea: { base: { padding: 'var(--space-md) var(--space-lg)' } },
            },
        },
    },
};

// ── Content tier (#311) ───────────────────────────────────────────────────
/**
 * HeroUI's card: base-100 inside the hairline, `radius-box`, a soft shadow.
 * No `color` axis anywhere in this skin (`roles: {}`), so the only axis these
 * four carry is the three-step size ramp.
 */
export const card: RecipeInput = {
    component: 'card',
    tokens: { '--card-pad': 'var(--space-lg)' },
    parts: {
        root: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
                border: 'var(--border) solid var(--hero-line)',
                borderRadius: 'var(--radius-box)',
                boxShadow: 'var(--shadow-sm)',
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
                ...label,
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--weight-semibold)',
                lineHeight: 'var(--leading-tight)',
            },
        },
        description: {
            base: { margin: '0', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--hero-muted)' },
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
                justifyContent: 'flex-end',
                gap: 'var(--space-sm)',
                padding: '0 var(--card-pad) var(--card-pad)',
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--card-pad': 'var(--space-md)' } } },
            md: {},
            lg: { root: { base: { '--card-pad': 'var(--space-xl)' } } },
        },
    },
};

/** HeroUI's alert: a bordered panel in the danger tone this skin ships. */
export const alert: RecipeInput = {
    component: 'alert',
    parts: {
        root: {
            base: {
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'center',
                gap: 'var(--space-2xs) var(--space-md)',
                background: 'var(--color-base-200)',
                color: 'var(--color-base-content)',
                border: 'var(--border) solid var(--hero-line)',
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
                color: 'var(--hero-primary)',
                fontSize: 'var(--text-md)',
                lineHeight: 'var(--leading-none)',
            },
        },
        title: {
            base: { ...label, fontWeight: 'var(--weight-semibold)', lineHeight: 'var(--leading-tight)' },
        },
        description: {
            base: {
                gridColumn: '2',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                lineHeight: 'var(--leading-normal)',
                color: 'var(--color-base-content)',
            },
        },
        close: {
            base: {
                gridRow: '1',
                gridColumn: '3',
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'var(--hero-muted)',
                borderRadius: 'var(--radius-selector)',
                padding: 'var(--space-2xs)',
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
                transition: motion('background, color, transform'),
            },
            states: {
                hover: { background: 'var(--color-base-300)', color: 'var(--color-base-content)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: { '&[data-pressed]:not([data-disabled])': { transform: 'scale(0.97)' } },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { padding: 'var(--space-sm) var(--space-md)' } } },
            md: {},
            lg: { root: { base: { padding: 'var(--space-lg) var(--space-xl)' } } },
        },
    },
};

/** HeroUI's chip: a pill in base-200, muted ink, the hairline around it. */
export const badge: RecipeInput = {
    component: 'badge',
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375em',
                background: 'var(--color-base-200)',
                color: 'var(--color-base-content)',
                border: 'var(--border) solid var(--hero-line)',
                borderRadius: 'var(--radius-selector)',
                padding: 'var(--space-2xs) var(--space-md)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-medium)',
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
            lg: { root: { base: { fontSize: 'var(--text-sm)', padding: 'var(--space-2xs) var(--space-lg)' } } },
        },
    },
};

/** HeroUI's divider: the same hairline every bordered surface here uses. */
export const divider: RecipeInput = {
    component: 'divider',
    tokens: { '--divider-thickness': 'var(--border)' },
    parts: {
        root: {
            base: { border: 'none', background: 'var(--hero-line)', alignSelf: 'stretch' },
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
    tokens: { '--skeleton-fill': 'var(--color-base-200)' },
    parts: {
        root: {
            base: { borderRadius: 'var(--radius-box)' },
            states: {
                loading: {
                    color: 'transparent',
                    background: 'var(--skeleton-fill)',
                    animation: 'zero-heroui-skeleton 1.6s ease-in-out infinite',
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
        },
    },
    keyframes: { 'zero-heroui-skeleton': 'from, to { opacity: 1; } 50% { opacity: 0.55; }' },
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
        '--spinner-ink': 'var(--hero-primary)',
        '--spinner-track': 'var(--hero-line)',
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
                animation: 'zero-heroui-spin 0.7s linear infinite',
            },
            at: { 'reduced-motion': { base: { animation: 'none' } } },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--spinner-size': 'calc(var(--size-field) * 0.4)' } } },
            md: {},
            lg: { root: { base: { '--spinner-size': 'calc(var(--size-field) * 0.7)' } } },
        },
    },
    keyframes: { 'zero-heroui-spin': 'to { transform: rotate(360deg); }' },
};

// ── The content-tier sweep (#334) ─────────────────────────────────────────
/**
 * HeroUI kbd: the soft base-200 chip inside the same hairline every bordered
 * surface here wears. No colour axis — `roles: {}` is this design system's
 * whole thesis — so the cap has exactly one costume.
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
                padding: 'calc(var(--space-2xs) - var(--border)) calc(var(--space-sm) - var(--border))',
                background: 'var(--color-base-200)',
                color: 'var(--color-base-content)',
                border: 'var(--border) solid var(--hero-line)',
                borderRadius: 'var(--radius-selector)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xs)',
                lineHeight: 'var(--leading-normal)',
                whiteSpace: 'nowrap',
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { fontSize: 'var(--text-xs)', padding: '0 var(--space-sm)' } } },
            md: {},
            lg: { root: { base: { fontSize: 'var(--text-sm)', padding: 'var(--space-2xs) var(--space-lg)' } } },
        },
    },
};

/**
 * Status — the dot in HeroUI's primary fill. One costume (`roles: {}`),
 * three sizes; border in the same ink so the mark survives `forced-colors`.
 */
export const status: RecipeInput = {
    component: 'status',
    tokens: {
        '--status-ink': 'var(--hero-primary)',
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
        },
    },
};

/** HeroUI stats: the hairline card grammar, one costume. */
export const stats: RecipeInput = {
    component: 'stats',
    parts: {
        root: {
            base: {
                display: 'flex',
                border: 'var(--border) solid var(--hero-line)',
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
                    borderInlineStart: 'var(--border) solid var(--hero-line)',
                },
                '&[data-orientation="vertical"] + &': {
                    borderBlockStart: 'var(--border) solid var(--hero-line)',
                },
            },
        },
        title: {
            base: {
                gridColumn: '1',
                fontSize: 'var(--text-xs)',
                color: 'var(--hero-muted)',
            },
        },
        value: {
            base: {
                gridColumn: '1',
                fontSize: 'var(--text-2xl)',
                fontWeight: 'var(--weight-semibold)',
                fontVariantNumeric: 'tabular-nums',
            },
        },
        desc: {
            base: {
                gridColumn: '1',
                fontSize: 'var(--text-xs)',
                color: 'var(--hero-muted)',
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
        },
    },
};

/** HeroUI timeline: hairline axis, primary dot, quiet content. */
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
                background: 'var(--hero-primary)',
                border: 'calc(var(--timeline-marker-size) / 2) solid var(--hero-primary)',
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
                background: 'var(--hero-line)',
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
                border: 'var(--border) solid var(--hero-line)',
                borderRadius: 'var(--radius-box)',
                background: 'var(--color-base-100)',
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
        },
    },
};

/** HeroUI chat: soft base-200 bubbles inside the hairline grammar. */
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
                color: 'var(--hero-muted)',
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
                color: 'var(--hero-muted)',
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
        },
    },
};

/**
 * HeroUI radial: primary arc in the one costume. Complete drops the channel
 * — a full ring needs no track — which is also what keeps the three states
 * distinct for the legibility guard in a design system with no success role.
 */
export const radialProgress: RecipeInput = {
    component: 'radial-progress',
    tokens: {
        '--radial-size': 'calc(var(--size-selector) * 16)',
        '--radial-thickness': 'calc(var(--size-selector) * 1.5)',
        '--radial-ink': 'var(--hero-primary)',
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
                complete: { '--radial-track': 'transparent' },
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
                    animation: 'zero-heroui-radial-spin 1.2s linear infinite',
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
                color: 'var(--hero-muted)',
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
        },
    },
    keyframes: { 'zero-heroui-radial-spin': 'to { transform: rotate(360deg); }' },
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
        },
    },
};

/**
 * Navbar — HeroUI's Navbar is a translucent, blurred bar over the page with
 * a hairline under it. Size-only: this design system declares no colour
 * axis (`roles: {}`), so the bar has exactly one surface.
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
                background: 'color-mix(in oklch, var(--color-base-100) 70%, transparent)',
                backdropFilter: 'saturate(1.5) blur(10px)',
                color: 'var(--color-base-content)',
                borderBlockEnd: 'var(--border) solid var(--hero-line)',
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
            sm: { root: { base: { minBlockSize: '3rem', fontSize: 'var(--text-sm)' } } },
            md: {},
            lg: { root: { base: { minBlockSize: '5rem' } } },
        },
    },
};

/**
 * Breadcrumbs — HeroUI's muted-foreground trail: quiet links that rise to
 * full foreground on hover, the current crumb full foreground. Size-only.
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
                color: 'var(--hero-muted)',
                textDecoration: 'none',
                borderRadius: 'var(--radius-selector)',
                transition: 'color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { color: 'var(--color-base-content)' },
                active: {
                    color: 'var(--color-base-content)',
                    fontWeight: 'var(--weight-semibold)',
                },
                inactive: {},
                'focus-visible': {
                    outline: '2px solid var(--color-base-content)',
                    outlineOffset: '2px',
                },
            },
        },
        separator: {
            base: {
                color: 'var(--hero-muted)',
                userSelect: 'none',
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { fontSize: 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { fontSize: 'var(--text-md)' } } },
        },
    },
};

/**
 * Pagination — HeroUI's rounded cells: transparent at rest, base-200 under
 * the pointer, the current page inverted to full foreground (this design
 * system has no colour axis, so the inversion IS the accent). Pressed is
 * the v3 inward scale. Size-only; glyphs flip under the rtl guard.
 */
export const pagination: RecipeInput = {
    component: 'pagination',
    tokens: {
        '--pg-size': 'calc(var(--size-field) * 10)',
        '--pg-font': 'var(--text-sm)',
    },
    parts: {
        root: { base: { display: 'flex', alignItems: 'center', gap: 'var(--space-2xs)' } },
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
                borderRadius: 'var(--radius-field)',
                fontSize: 'var(--pg-font)',
                fontWeight: 'var(--weight-medium)',
                fontVariantNumeric: 'tabular-nums',
                appearance: 'none',
                cursor: 'pointer',
                transition: motion('background, color, transform'),
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                active: { background: 'var(--color-base-content)', color: 'var(--color-base-100)' },
                inactive: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: { ...pressScale },
        },
        ellipsis: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minInlineSize: 'var(--pg-size)',
                blockSize: 'var(--pg-size)',
                color: 'var(--hero-muted)',
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
                borderRadius: 'var(--radius-field)',
                fontSize: 'calc(var(--pg-font) * 1.2)',
                lineHeight: 'var(--leading-none)',
                appearance: 'none',
                cursor: 'pointer',
                transition: motion('background, transform'),
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                ...pressScale,
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
                borderRadius: 'var(--radius-field)',
                fontSize: 'calc(var(--pg-font) * 1.2)',
                lineHeight: 'var(--leading-none)',
                appearance: 'none',
                cursor: 'pointer',
                transition: motion('background, transform'),
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                ...pressScale,
                [`&${rtl}`]: { scale: '-1 1' },
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--pg-size': 'calc(var(--size-field) * 9)', '--pg-font': 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { '--pg-size': 'calc(var(--size-field) * 12)', '--pg-font': 'var(--text-md)' } } },
        },
    },
};

/**
 * Steps — HeroUI's wizard rail without a colour axis: the inversion is the
 * accent (current disc = full foreground on its content), the walked disc
 * a soft foreground tint, everything else the muted base-200 disc. Pressed
 * is the v3 inward scale. Size-only.
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
                ...pressScale,
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
                transition: motion('background, color'),
            },
            states: {
                active: { background: 'var(--color-base-content)', color: 'var(--color-base-100)' },
                complete: { background: 'color-mix(in oklch, var(--color-base-content) 12%, var(--color-base-100))', color: 'var(--color-base-content)' },
                inactive: { background: 'var(--color-base-200)', color: 'var(--hero-muted)' },
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
                color: 'var(--hero-muted)',
                fontWeight: 'var(--weight-normal)',
            },
        },
    },
    variants: {

        size: {
            sm: { root: { base: { '--steps-ind': 'calc(var(--size-selector) * 5.5)', '--steps-font': 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { '--steps-ind': 'calc(var(--size-selector) * 8)', '--steps-font': 'var(--text-md)' } } },
        },
    },
};

/**
 * Drawer — HeroUI's Drawer: the base-100 sheet under the blurred scrim,
 * faded in. Base render is the inline mode; `:modal` is the top-layer
 * edge sheet. Size-only, carried by the trigger.
 */
export const drawer: RecipeInput = {
    component: 'drawer',
    parts: {
        trigger: pressableOverlayTrigger,
        panel: withPresence(popupPresence('none'), {
            base: {
                padding: 'var(--space-xl)',
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
                border: 'none',
                borderRadius: 'var(--radius-box)',
                boxShadow: 'var(--shadow-xl)',
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
            base: {
                background: 'var(--hero-scrim)',
                backdropFilter: 'blur(2px)',
                transition: 'opacity var(--duration-fast) var(--ease-standard), '
                    + 'display var(--duration-fast) allow-discrete, '
                    + 'overlay var(--duration-fast) allow-discrete',
                opacity: '0',
            },
            states: { open: { opacity: '1' }, closed: {} },
            at: {
                'starting-style': { states: { open: { opacity: '0' } } },
                'reduced-motion': { base: { transition: 'none' } },
            },
        },
        title: {
            base: {
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--color-base-content)',
                margin: '0 0 var(--space-md)',
            },
        },
        close: dismissAction,
    },
    // Trigger-carried size — see `overlayTriggerSizes`.
    variants: { size: overlayTriggerSizes },
};

/**
 * HeroUI table: a soft rounded box, base-200 header band, hairline rows.
 * `striped` is HeroUI's own `isStriped` (the api maps it); selection is a
 * primary-soft wash. No colour axis — there are no roles to key it on.
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
                border: 'var(--border) solid var(--hero-line)',
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
                fontSize: 'var(--text-xs)',
                color: 'var(--hero-muted)',
            },
        },
        head: {
            base: { background: 'var(--color-base-200)' },
        },
        body: {},
        foot: {
            base: {
                fontSize: 'var(--text-xs)',
                color: 'var(--hero-muted)',
            },
        },
        row: {
            base: { borderBlockEnd: 'var(--border) solid var(--hero-line)' },
            states: {
                selected: { background: 'color-mix(in oklch, var(--hero-primary) 12%, transparent)' },
            },
        },
        'header-cell': {
            base: {
                padding: 'var(--table-pad-block) var(--table-pad-inline)',
                textAlign: 'start',
                fontWeight: 'var(--weight-semibold)',
                fontSize: 'var(--text-xs)',
                color: 'var(--hero-muted)',
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
            sm: { root: { base: { '--table-pad-block': 'var(--space-xs)', '--table-pad-inline': 'var(--space-sm)', '--table-font': 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { '--table-pad-block': 'var(--space-md)', '--table-pad-inline': 'var(--space-lg)', '--table-font': 'var(--text-md)' } } },
        },
    },
    modifiers: {
        striped: {
            row: {
                selectors: {
                    '[data-scope="table"][data-part="body"] > &:nth-child(even):not([data-selected])': {
                        background: 'var(--color-base-200)',
                    },
                },
            },
        },
    },
};

/**
 * HeroUI file upload: a secondary-button trigger with the v3 press-scale,
 * a soft dashed dropzone washing toward `--hero-primary` while a drag
 * hovers, and rounded item rows. Size only — there is no colour axis.
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
            base: { fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
        },
        trigger: {
            base: { ...secondaryButton, fontSize: 'var(--fu-font)' },
            states: {
                hover: { background: 'var(--color-base-200)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                invalid: { borderColor: 'var(--hero-danger)' },
                ...focusRing,
            },
            selectors: { ...pressScale },
        },
        dropzone: {
            base: {
                justifySelf: 'stretch',
                padding: 'var(--fu-pad)',
                textAlign: 'center',
                fontSize: 'var(--fu-font)',
                color: 'var(--hero-muted)',
                border: 'var(--border) dashed var(--hero-line)',
                borderRadius: 'var(--radius-box)',
                background: 'var(--color-base-100)',
                cursor: 'pointer',
                transition: 'border-color var(--duration-fast) var(--ease-standard), '
                    + 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                highlighted: {
                    borderColor: 'var(--hero-primary)',
                    background: 'color-mix(in oklch, var(--hero-primary) 8%, var(--color-base-100))',
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
                border: 'var(--border) solid var(--hero-line)',
                borderRadius: 'var(--radius-field)',
                background: 'var(--color-base-100)',
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
                color: 'var(--hero-muted)',
            },
        },
        'item-remove': {
            ...iconClose,
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--fu-pad': 'var(--space-md)', '--fu-font': 'var(--text-xs)' } } },
            md: {},
            lg: { root: { base: { '--fu-pad': 'var(--space-xl)', '--fu-font': 'var(--text-md)' } } },
        },
    },
};

/**
 * HeroUI carousel: soft rounded viewport, hairline circle nav triggers
 * with the v3 press-scale, and primary dots — hollow line resting, filled
 * `--hero-primary` active. Size only.
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
                borderRadius: 'var(--radius-box)',
            },
            selectors: {
                // The viewport is a tab stop (scrollable-region-focusable) and
                // owes the keyboard user a ring. Real :focus-visible — no
                // runtime flag exists on this part.
                '&:focus-visible': { outline: '2px solid var(--hero-focus)', outlineOffset: '2px' },
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
                border: 'var(--border) solid var(--hero-line)',
                borderRadius: '9999px',
                cursor: 'pointer',
                zIndex: '1',
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: { ...pressScale },
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
                border: 'var(--border) solid var(--hero-line)',
                borderRadius: '9999px',
                cursor: 'pointer',
                zIndex: '1',
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: { ...pressScale },
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
                    background: 'var(--hero-primary)',
                    borderColor: 'var(--hero-primary)',
                },
            },
        },
    },
    variants: {
        size: {
            sm: { root: { base: { '--carousel-dot': '0.5rem', '--carousel-nav': '1.75rem' } } },
            md: {},
            lg: { root: { base: { '--carousel-dot': '0.75rem', '--carousel-nav': '2.5rem' } } },
        },
    },
};

/**
 * HeroUI swap: the v3 gesture vocabulary — the arriving face presses in
 * from 97% scale while fading. Size only; ink stays `base-content`.
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
                transition: 'transform var(--duration-fast) var(--ease-standard), opacity var(--duration-fast) var(--ease-standard)',
            },
            states: {
                on: {},
                off: { opacity: '0', transform: 'scale(0.9)' },
            },
            at: {
                'reduced-motion': { base: { transition: 'none' } },
            },
        },
        off: {
            base: {
                gridArea: '1 / 1',
                transition: 'transform var(--duration-fast) var(--ease-standard), opacity var(--duration-fast) var(--ease-standard)',
            },
            states: {
                off: {},
                on: { opacity: '0', transform: 'scale(0.9)' },
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
        },
    },
};

/**
 * Countdown — display-only digits. The runtime replaces the `digits`
 * element per tick (keyed), so the enter animation below plays once per
 * change — a soft rise; a loop never exists, and reduced motion
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
                animation: 'zero-heroui-countdown-in 0.3s var(--ease-standard)',
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
        },
    },
    keyframes: { 'zero-heroui-countdown-in': 'from { transform: translateY(0.5em); opacity: 0; }' },
};

/**
 * HeroUI diff: soft rounded box, hairline divider in --hero-primary with
 * a filled grip; pressed presses the ink denser. Size only.
 */
export const diff: RecipeInput = {
    component: 'diff',
    tokens: {
        '--diff-accent': 'var(--hero-primary)',
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
                pressed: { '--diff-accent': 'color-mix(in oklch, var(--hero-primary) 85%, var(--color-base-content))' },
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
        size: {
            sm: { root: { base: { '--diff-grip': '1.25rem', '--diff-hit': '1.75rem' } } },
            md: {},
            lg: { root: { base: { '--diff-grip': '2rem', '--diff-hit': '2.5rem' } } },
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
