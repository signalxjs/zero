/**
 * zero-brutalist recipes — the brief, applied to zero's anatomy.
 *
 * Brutalism is mostly three moves repeated: a thick black border, a hard
 * offset shadow, and uppercase tracked-out mono labels. Pressing something
 * shoves it into its own shadow.
 */
import type { CssProps, PartStyles, RecipeInput } from '@sigx/zero-kit';
import { axisRoles } from '@sigx/zero-kit/define';
import { roles } from './tokens.js';

/**
 * Every role a consumer can pass as `color`, derived from the declaration
 * rather than retyped — a role declared in `tokens.ts` but missing here would
 * silently render primary. Roles opting out of `-content` or `-soft` are
 * fills or hairlines, not action colours; this design system declares none.
 */
const ROLES = axisRoles(roles);

/** Uppercase, tracked out, mono, heavy — the brief's label treatment. */
const label: CssProps = {
    fontFamily: 'var(--font-mono)',
    fontWeight: 'var(--weight-semibold)',
    letterSpacing: 'var(--tracking-wide)',
    textTransform: 'uppercase',
};

const inked: CssProps = {
    border: 'var(--border) solid var(--color-base-content)',
    borderRadius: '0',
    background: 'var(--color-base-100)',
    color: 'var(--color-base-content)',
};

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
        outline: 'var(--border) solid var(--color-primary)',
        outlineOffset: '3px',
    },
};

/** Hovering shoves the element part-way into its own shadow. */
const shift = (n: string): CssProps => ({
    boxShadow: 'var(--shadow-xs)',
    transform: `translate(${n}, ${n})`,
});

const motion = (props: string): string =>
    props.split(', ').map((p) => `${p} var(--duration-fast) var(--ease-standard)`).join(', ');

// ── Button ────────────────────────────────────────────────────────────────
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
        transition: 'opacity var(--duration-fast) var(--ease-standard), '
            + 'transform var(--duration-fast) var(--ease-standard), '
            + 'display var(--duration-fast) allow-discrete, '
            + 'overlay var(--duration-fast) allow-discrete',
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
            transition: 'block-size var(--duration-normal) var(--ease-standard), '
                + 'content-visibility var(--duration-normal) allow-discrete',
        },
        '&[open]::details-content': { blockSize: 'auto' },
    },
    at: { 'reduced-motion': { selectors: { '&::details-content': { transition: 'none' } } } },
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

export const button: RecipeInput = {
    component: 'button',
    tokens: {
        '--btn-accent': 'var(--color-primary)',
        '--btn-on-accent': 'var(--color-primary-content)',
        '--btn-soft': 'var(--color-primary-soft)',
    },
    parts: {
        root: {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-sm)',
                ...inked,
                ...label,
                lineHeight: 'var(--leading-none)',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer',
                transition: motion('box-shadow, transform, background'),
            },
            states: {
                disabled: {
                    opacity: 'var(--disabled-opacity)',
                    cursor: 'not-allowed',
                    boxShadow: 'none',
                    transform: 'none',
                },
                hover: shift('1px'),
                ...focusRing,
            },
            // The stamp rides the runtime's press feedback, not `:active`:
            // same collapse of the hard shadow, but with keyboard parity and
            // drag-off semantics the pseudo-class can't guarantee. The :not
            // keeps specificity EQUAL to hover; pressed wins by source
            // order, exactly as :active did.
            selectors: { '&[data-pressed]:not([data-disabled])': { boxShadow: 'none', transform: 'translate(3px, 3px)' } },
        },
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
            solid: { root: { base: { background: 'var(--btn-accent)', color: 'var(--btn-on-accent)' } } },
            outline: { root: { base: { background: 'var(--color-base-100)', color: 'var(--color-base-content)' } } },
            soft: { root: { base: { background: 'var(--btn-soft)', color: 'var(--color-base-content)' } } },
            // Even "ghost" keeps the border. Brutalism has no invisible states.
            ghost: {
                root: {
                    base: { background: 'transparent', color: 'var(--color-base-content)', boxShadow: 'none' },
                    states: { hover: { background: 'var(--btn-soft)', transform: 'none' } },
                },
            },
        },
        size: {
            xs: { root: { base: { padding: 'var(--space-2xs) var(--space-sm)', fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { padding: 'var(--space-xs) var(--space-md)', fontSize: 'var(--text-xs)' } } },
            md: { root: { base: { padding: 'var(--space-sm) var(--space-lg)', fontSize: 'var(--text-sm)' } } },
            lg: { root: { base: { padding: 'var(--space-md) var(--space-xl)', fontSize: 'var(--text-md)' } } },
            xl: { root: { base: { padding: 'var(--space-lg) var(--space-2xl)', fontSize: 'var(--text-lg)' } } },
        },
    },
    defaultVariants: { color: 'primary', variant: 'solid', size: 'md' },
};

// ── Tabs ──────────────────────────────────────────────────────────────────
export const tabs: RecipeInput = {
    component: 'tabs',
    // Accent defaults live in `tokens:` so the un-attributed render IS the
    // primary variant and `variants.color` only rebinds custom properties —
    // the toast shape.
    tokens: {
        '--tabs-accent': 'var(--color-primary)',
        '--tabs-on-accent': 'var(--color-primary-content)',
    },
    parts: {
        root: { base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' } },
        list: { base: { display: 'flex', gap: 'var(--space-sm)' } },
        tab: {
            base: {
                appearance: 'none',
                ...inked,
                ...label,
                fontSize: 'var(--text-xs)',
                padding: 'var(--space-sm) var(--space-lg)',
                boxShadow: 'var(--shadow-xs)',
                cursor: 'pointer',
                transition: motion('box-shadow, transform, background'),
            },
            states: {
                active: {
                    background: 'var(--tabs-accent)',
                    color: 'var(--tabs-on-accent)',
                    boxShadow: 'var(--shadow-sm)',
                },
                inactive: {},
                hover: shift('1px'),
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed', boxShadow: 'none' },
                ...focusRing,
            },
        },
        panel: {
            base: { ...inked, padding: 'var(--space-lg)', boxShadow: 'var(--shadow-md)', lineHeight: 'var(--leading-normal)' },
            states: { active: {}, inactive: {} },
        },
    },
    variants: {
        size: {
            xs: { tab: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-2xs) var(--space-sm)' } } },
            sm: { tab: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-xs) var(--space-md)' } } },
            // `md` is the un-attributed render: the base already IS the
            // middle step, so restating it here would be a second copy free
            // to drift. An empty entry emits no rule and keeps the base.
            md: {},
            lg: { tab: { base: { fontSize: 'var(--text-sm)', padding: 'var(--space-md) var(--space-xl)' } } },
            xl: { tab: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-lg) var(--space-2xl)' } } },
        },
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--tabs-accent': `var(--color-${c})`,
            '--tabs-on-accent': `var(--color-${c}-content)`,
        } } }])),
    },
};

// ── Disclosure ────────────────────────────────────────────────────────────
// The open header is a flat role fill — brutalism's word for "this one is
// active". The pair rides two custom properties declared in each recipe's
// `tokens:` (the toast shape), so `variants.color` only rebinds them and the
// `-content` ink keeps the pair's contrast guarantee under every role.
const disclosureTrigger: PartStyles = {
    base: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-md)',
        ...label,
        fontSize: 'var(--text-sm)',
        cursor: 'pointer',
        transition: motion('background'),
    },
    states: {
        open: { background: 'var(--disclosure-accent)', color: 'var(--disclosure-on-accent)' },
        closed: {},
        hover: { background: 'var(--color-base-200)' },
        disabled: { opacity: 'var(--disabled-opacity)' },
        ...focusRing,
    },
};

/** The accent default: the fixed `accent` role, exactly as before #321. */
const disclosureTokens = {
    '--disclosure-accent': 'var(--color-accent)',
    '--disclosure-on-accent': 'var(--color-accent-content)',
};

const disclosureColors = (): Record<string, Record<string, PartStyles>> =>
    Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
        '--disclosure-accent': `var(--color-${c})`,
        '--disclosure-on-accent': `var(--color-${c}-content)`,
    } } }]));

/**
 * The disclosure size ramp — the slab's single padding value stepped with the
 * label's type; the panel follows. `md` is the un-attributed render.
 */
const disclosureSizes: Record<string, Record<string, PartStyles>> = {
    xs: {
        trigger: { base: { padding: 'var(--space-xs)', fontSize: 'var(--text-xs)' } },
        panel: { base: { padding: 'var(--space-xs)' } },
    },
    sm: {
        trigger: { base: { padding: 'var(--space-sm)', fontSize: 'var(--text-xs)' } },
        panel: { base: { padding: 'var(--space-sm)' } },
    },
    md: {},
    lg: {
        trigger: { base: { padding: 'var(--space-lg)', fontSize: 'var(--text-md)' } },
        panel: { base: { padding: 'var(--space-lg)' } },
    },
    xl: {
        trigger: { base: { padding: 'var(--space-xl)', fontSize: 'var(--text-lg)' } },
        panel: { base: { padding: 'var(--space-xl)' } },
    },
};

export const collapsible: RecipeInput = {
    component: 'collapsible',
    tokens: disclosureTokens,
    parts: {
        root: withPresence(disclosurePresence, { base: { ...inked, boxShadow: 'var(--shadow-sm)' }, states: { open: {}, closed: {} } }),
        trigger: disclosureTrigger,
        panel: {
            base: {
                padding: 'var(--space-md)',
                borderTop: 'var(--border) solid var(--color-base-content)',
                lineHeight: 'var(--leading-normal)',
            },
            states: { open: {}, closed: {} },
        },
    },
    variants: { color: disclosureColors(), size: disclosureSizes },
};

export const accordion: RecipeInput = {
    component: 'accordion',
    tokens: disclosureTokens,
    parts: {
        root: { base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' } },
        item: withPresence(disclosurePresence, { base: { ...inked, boxShadow: 'var(--shadow-sm)' }, states: { open: {}, closed: {} } }),
        trigger: disclosureTrigger,
        panel: {
            base: {
                padding: 'var(--space-md)',
                borderTop: 'var(--border) solid var(--color-base-content)',
                lineHeight: 'var(--leading-normal)',
            },
            states: { open: {}, closed: {} },
        },
    },
    variants: { color: disclosureColors(), size: disclosureSizes },
};

// ── Overlays ──────────────────────────────────────────────────────────────
const overlayTrigger: PartStyles = {
    base: {
        appearance: 'none',
        ...inked,
        ...label,
        fontSize: 'var(--text-xs)',
        padding: 'var(--space-sm) var(--space-lg)',
        boxShadow: 'var(--shadow-xs)',
        cursor: 'pointer',
    },
    states: { open: {}, closed: {}, hover: shift('1px'), disabled: { opacity: 'var(--disabled-opacity)' }, ...focusRing },
};

/**
 * The axes for the four slab overlay triggers (#321). Dialog, popover,
 * tooltip and menu carry their axis attributes on the TRIGGER — the
 * anatomy's carrier part — and their popups are top-layer siblings the
 * compiled `@scope` donut can never reach, so the axes style the slab
 * itself. Colour is the solid button's move: a flat role fill under the
 * black border, with the `-content` ink whose contrast the token pair
 * guarantees (brutalist light's `accent`/`warning` are far too pale to be
 * inks, so an ink treatment is not available here anyway). The hover shove
 * and pressed stamp touch only shadow/transform, so they ride along
 * untouched. Size is the tab ramp — the slab shares its resting metrics.
 */
const overlayTriggerColors = (): Record<string, Record<string, PartStyles>> =>
    Object.fromEntries(ROLES.map((c) => [c, { trigger: { base: {
        background: `var(--color-${c})`,
        color: `var(--color-${c}-content)`,
    } } }]));

const overlayTriggerSizes: Record<string, Record<string, PartStyles>> = {
    xs: { trigger: { base: { padding: 'var(--space-2xs) var(--space-sm)', fontSize: 'var(--text-xs)' } } },
    sm: { trigger: { base: { padding: 'var(--space-xs) var(--space-md)', fontSize: 'var(--text-xs)' } } },
    // `md` is the un-attributed render — `overlayTrigger` already IS the
    // middle step.
    md: {},
    lg: { trigger: { base: { padding: 'var(--space-md) var(--space-xl)', fontSize: 'var(--text-sm)' } } },
    xl: { trigger: { base: { padding: 'var(--space-lg) var(--space-2xl)', fontSize: 'var(--text-md)' } } },
};

export const dialog: RecipeInput = {
    component: 'dialog',
    parts: {
        trigger: overlayTrigger,
        popup: withPresence(popupPresence('translate(8px, 8px)'), {
            // Mobile-first: a full-bleed slab, then a shadowed card from `sm`.
            base: {
                width: '100%',
                height: '100dvh',
                maxWidth: 'none',
                maxHeight: 'none',
                margin: '0',
                padding: 'var(--space-xl)',
                ...inked,
                border: 'none',
                boxShadow: 'none',
            },
            states: { open: {}, closed: {} },
            at: {
                sm: {
                    base: {
                        width: 'calc(100% - var(--space-2xl))',
                        maxWidth: '34rem',
                        // `auto` stretches an inset-positioned modal to fill; `fit-content`
                        // is the UA's own dialog default and hugs the content (#114).
                        height: 'fit-content',
                        maxHeight: 'calc(100% - var(--space-2xl))',
                        margin: 'auto',
                        border: 'var(--border) solid var(--color-base-content)',
                        boxShadow: 'var(--shadow-xl)',
                    },
                },
            },
        }),
        backdrop: {
            base: { background: 'oklch(0% 0 0 / 0.55)' },
            states: { open: {}, closed: {} },
        },
        title: {
            base: {
                margin: '0 0 var(--space-md)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-2xl)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-tight)',
                lineHeight: 'var(--leading-none)',
                textTransform: 'uppercase',
            },
        },
        description: {
            base: { margin: '0 0 var(--space-lg)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)' },
        },
        // Actions are ruled off from the body by a full-weight line — the
        // system's way of separating two things is a border, not whitespace.
        // The gap clears the actions' own 2px offset shadow, so two adjacent
        // slabs read as two, never as one malformed control.
        footer: {
            base: {
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 'var(--space-md)',
                marginBlockStart: 'var(--space-xl)',
                paddingBlockStart: 'var(--space-lg)',
                borderBlockStart: 'var(--border) solid var(--color-base-content)',
            },
        },
        close: {
            base: {
                appearance: 'none',
                ...inked,
                ...label,
                fontSize: 'var(--text-xs)',
                padding: 'var(--space-sm) var(--space-lg)',
                boxShadow: 'var(--shadow-xs)',
                cursor: 'pointer',
            },
            states: { hover: shift('1px'), disabled: {}, ...focusRing },
        },
        // The alertdialog's least-destructive action — the same inked slab.
        cancel: {
            base: {
                appearance: 'none',
                ...inked,
                ...label,
                fontSize: 'var(--text-xs)',
                padding: 'var(--space-sm) var(--space-lg)',
                boxShadow: 'var(--shadow-xs)',
                cursor: 'pointer',
            },
            states: { hover: shift('1px'), disabled: {}, ...focusRing },
        },
    },
    // Trigger-carried axes — see `overlayTriggerColors` for why the popup is
    // out of reach and the trigger is the whole story here.
    variants: { color: overlayTriggerColors(), size: overlayTriggerSizes },
};

const slab: CssProps = { ...inked, boxShadow: 'var(--shadow-md)', padding: 'var(--space-md)' };

export const popover: RecipeInput = {
    component: 'popover',
    parts: {
        trigger: overlayTrigger,
        popup: withPresence(popupPresence('translate(4px, 4px)'), { base: { ...slab, maxWidth: '20rem' }, states: { open: {}, closed: {} } }),
        title: { base: { margin: '0 0 var(--space-sm)', ...label, fontSize: 'var(--text-sm)' } },
        close: {
            base: { appearance: 'none', border: 'none', background: 'transparent', ...label, fontSize: 'var(--text-xs)', cursor: 'pointer' },
            states: { disabled: {}, ...focusRing },
        },
    },
    // Trigger-carried axes — same wiring as dialog, same reason.
    variants: { color: overlayTriggerColors(), size: overlayTriggerSizes },
};

export const tooltip: RecipeInput = {
    component: 'tooltip',
    parts: {
        // The bare reset this used to be contradicted the file's own rule —
        // "Even 'ghost' keeps the border. Brutalism has no invisible states."
        // So it takes `overlayTrigger` like dialog, popover and menu, with
        // `cursor: help` as the one deviation. Nothing to strip: the helper
        // carries no press rule, and tooltip declares no `pressed` flag.
        trigger: {
            ...overlayTrigger,
            base: { ...overlayTrigger.base, cursor: 'help' },
        },
        popup: withPresence(popupPresence('translate(3px, 3px)'), {
            base: {
                background: 'var(--color-neutral)',
                color: 'var(--color-neutral-content)',
                border: 'var(--border) solid var(--color-base-content)',
                padding: 'var(--space-2xs) var(--space-sm)',
                ...label,
                fontSize: 'var(--text-xs)',
            },
            states: { open: {}, closed: {} },
        }),
    },
    // Trigger-carried axes — same wiring as dialog, same reason. The bubble
    // stays the fixed neutral slab whatever the trigger's colour.
    variants: { color: overlayTriggerColors(), size: overlayTriggerSizes },
};

export const menu: RecipeInput = {
    component: 'menu',
    parts: {
        trigger: overlayTrigger,
        popup: withPresence(popupPresence('translate(4px, 4px)'), { base: { ...slab, padding: 'var(--space-xs)', minWidth: '12rem' }, states: { open: {}, closed: {} } }),
        item: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: 'var(--space-xs) var(--space-sm)',
                ...label,
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
            },
            states: {
                highlighted: { background: 'var(--color-primary)', color: 'var(--color-primary-content)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
        },
        // The stateful rows are the item, unchanged; the mark column in front
        // carries the state as a hard block glyph.
        'checkbox-item': {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: 'var(--space-xs) var(--space-sm)',
                ...label,
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
            },
            states: {
                highlighted: { background: 'var(--color-primary)', color: 'var(--color-primary-content)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                checked: {}, unchecked: {},
                ...focusRing,
            },
        },
        'radio-item': {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: 'var(--space-xs) var(--space-sm)',
                ...label,
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
            },
            states: {
                highlighted: { background: 'var(--color-primary)', color: 'var(--color-primary-content)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                checked: {}, unchecked: {},
                ...focusRing,
            },
        },
        // A reserved mark column; checked drops in a solid block — brutalism
        // marks with a filled square, not a calligraphic tick. `currentColor`
        // so the highlight inversion takes the mark with it.
        'item-indicator': {
            base: {
                width: '0.6em',
                height: '0.6em',
                flexShrink: '0',
                background: 'transparent',
            },
            states: {
                checked: { background: 'currentColor' },
                unchecked: {},
            },
        },
        // The item look plus a hard chevron; `open` inverts like highlight.
        'sub-trigger': {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: 'var(--space-xs) var(--space-sm)',
                ...label,
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
            },
            states: {
                // `open` before `highlighted` — the pointer state must win both
                // background and color when the submenu is open (#116).
                open: { background: 'var(--color-base-200)' },
                closed: {},
                highlighted: { background: 'var(--color-primary)', color: 'var(--color-primary-content)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                // A submenu opens toward the reading end, so the chevron that
                // announces it has to point that way. `\203A` points right in
                // every writing direction; `\2039` is its mirror, and the swap
                // agrees with the side `Menu.tsx` itself resolves from `:dir()`.
                '&::after': { content: '"\\203A"', marginInlineStart: 'auto' },
                [`&${rtl}::after`]: { content: '"\\2039"' },
            },
        },
        'sub-popup': withPresence(popupPresence('translate(4px, 4px)'), {
            base: { ...slab, padding: 'var(--space-xs)', minWidth: '12rem' },
            states: { open: {}, closed: {} },
        }),
        group: { base: { padding: 'var(--space-2xs) 0' } },
        'group-label': {
            base: { padding: 'var(--space-2xs) var(--space-sm)', ...label, fontSize: 'var(--text-xs)', opacity: '0.7' },
        },
        separator: {
            base: { height: 'var(--border)', margin: 'var(--space-2xs) 0', background: 'var(--color-base-content)' },
        },
    },
    // Trigger-carried axes — same wiring as dialog, same reason. The popup
    // and its items are top-layer siblings the donut cannot reach.
    variants: { color: overlayTriggerColors(), size: overlayTriggerSizes },
};

export const select: RecipeInput = {
    component: 'select',
    // Accent defaults live in `tokens:` so the un-attributed render IS the
    // primary variant and `variants.color` only rebinds custom properties —
    // the toast shape.
    tokens: {
        '--select-accent': 'var(--color-primary)',
        '--select-on-accent': 'var(--color-primary-content)',
    },
    parts: {
        root: { base: { display: 'inline-flex', position: 'relative' } },
        trigger: {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                minWidth: '12rem',
                padding: 'var(--space-sm) var(--space-md)',
                ...inked,
                ...label,
                fontSize: 'var(--text-xs)',
                boxShadow: 'var(--shadow-xs)',
                cursor: 'pointer',
            },
            states: {
                open: { boxShadow: 'none', transform: 'translate(2px, 2px)' },
                closed: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                invalid: { borderColor: 'var(--color-error)' },
                ...focusRing,
            },
        },
        value: { base: { flex: '1', textAlign: 'start' } },
        indicator: { base: { transition: motion('transform') }, states: { open: { transform: 'rotate(180deg)' }, closed: {} } },
        popup: withPresence(popupPresence('translate(4px, 4px)'), { base: { ...slab, padding: 'var(--space-xs)', minWidth: '12rem' }, states: { open: {}, closed: {} } }),
        // The optgroup equivalent (#325) — the menu's group grammar.
        group: { base: { padding: 'var(--space-2xs) 0' } },
        'group-label': {
            base: { padding: 'var(--space-2xs) var(--space-sm)', ...label, fontSize: 'var(--text-xs)', opacity: '0.7' },
        },
        item: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: 'var(--space-xs) var(--space-sm)',
                ...label,
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
            },
            states: {
                highlighted: { background: 'var(--select-accent)', color: 'var(--select-on-accent)' },
                // Deliberate two-accent design: selected stays the fixed `accent`
                // role — semantic contrast against highlighted, not the component
                // accent, so it does not follow `color`.
                selected: { background: 'var(--color-accent)', color: 'var(--color-accent-content)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
                ...focusRing,
            },
        },
        'item-indicator': { base: { fontWeight: 'var(--weight-bold)' } },
        'hidden-input': { base: { position: 'absolute', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none' } },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--select-accent': `var(--color-${c})`,
            '--select-on-accent': `var(--color-${c}-content)`,
        } } }])),
        // The button ramp's shape, anchored so md IS the resting look:
        // vertical and horizontal padding one space step apart.
        size: {
            xs: { trigger: { base: { padding: 'var(--space-2xs) var(--space-xs)', fontSize: 'var(--text-xs)' } } },
            sm: { trigger: { base: { padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--text-xs)' } } },
            md: { trigger: { base: { padding: 'var(--space-sm) var(--space-md)', fontSize: 'var(--text-xs)' } } },
            lg: { trigger: { base: { padding: 'var(--space-md) var(--space-lg)', fontSize: 'var(--text-sm)' } } },
            xl: { trigger: { base: { padding: 'var(--space-lg) var(--space-xl)', fontSize: 'var(--text-md)' } } },
        },
    },
};

// ── Selection controls ────────────────────────────────────────────────────
export const switchRecipe: RecipeInput = {
    component: 'switch',
    // The accent default lives in `tokens:` so the un-attributed render IS the
    // primary variant and `variants.color` only rebinds a custom property —
    // the toast shape.
    tokens: {
        '--switch-width': 'calc(var(--size-selector) * 14)',
        '--switch-height': 'calc(var(--size-selector) * 7)',
        '--switch-accent': 'var(--color-primary)',
        /**
         * The slab's ink once the track is inked — the accent's own paper, the
         * same `--radio-on-accent` pairing the radio dot uses.
         *
         * Page ink on the accent is not a pairing the palette guarantees, and
         * on the dark theme it does not hold: white on
         * `oklch(0.72 0.2 28)` measures 2.86:1 (#228). A role and its
         * `-content` are contrast-checked by construction — 5.08:1 light,
         * 7.34:1 dark.
         */
        '--switch-on-accent': 'var(--color-primary-content)',
    },
    parts: {
        root: {
            base: { display: 'inline-flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' },
            states: { checked: {}, unchecked: {}, disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' } },
        },
        control: {
            base: {
                display: 'inline-block',
                position: 'relative',
                width: 'var(--switch-width)',
                height: 'var(--switch-height)',
                ...inked,
                boxShadow: 'var(--shadow-xs)',
                transition: motion('background'),
            },
            states: {
                checked: { background: 'var(--switch-accent)' },
                unchecked: {},
                // The system's error idiom: the frame turns error. Reads over
                // the inked track and the accent one alike, because neither
                // paints the border.
                invalid: { borderColor: 'var(--color-error)' },
                ...focusRing,
            },
        },
        thumb: {
            base: {
                position: 'absolute',
                top: '0',
                // Logical, so the resting slab parks at the INLINE start —
                // the right-hand edge under `dir="rtl"` (#229).
                insetInlineStart: '0',
                width: 'calc(var(--size-selector) * 7)',
                height: '100%',
                background: 'var(--color-base-content)',
                // The travel's sign, flipped in the `selectors` block below.
                // `transform` has no logical form, so the direction has to be
                // carried by a value the RTL rule can rebind — the same shape
                // `--slider-fill-dir` uses on the slider.
                '--switch-thumb-dir': '1',
                transition: motion('transform, background'),
            },
            states: {
                checked: {
                    transform: 'translateX(calc(var(--switch-thumb-dir) * (var(--switch-width) - 100%)))',
                    background: 'var(--switch-on-accent)',
                },
                unchecked: {},
            },
            selectors: {
                // `:where()` is forgiving, so an engine without `:dir()` drops
                // that one argument and still matches the attribute forms.
                [`&${rtl}`]: { '--switch-thumb-dir': '-1' },
            },
        },
        label: { base: { ...label, fontSize: 'var(--text-xs)' }, states: { checked: {}, unchecked: {} } },
        'hidden-input': { base: { position: 'absolute', width: '1px', height: '1px', opacity: '0' } },
    },
    variants: {
        size: {
            xs: { root: { base: { '--switch-width': 'calc(var(--size-selector) * 10)', '--switch-height': 'calc(var(--size-selector) * 5)' } } },
            sm: { root: { base: { '--switch-width': 'calc(var(--size-selector) * 12)', '--switch-height': 'calc(var(--size-selector) * 6)' } } },
            // `md` is the un-attributed render — the defaults in `tokens:`
            // already ARE the middle step.
            md: {},
            lg: { root: { base: { '--switch-width': 'calc(var(--size-selector) * 16)', '--switch-height': 'calc(var(--size-selector) * 8)' } } },
            xl: { root: { base: { '--switch-width': 'calc(var(--size-selector) * 18)', '--switch-height': 'calc(var(--size-selector) * 9)' } } },
        },
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--switch-accent': `var(--color-${c})`,
            '--switch-on-accent': `var(--color-${c}-content)`,
        } } }])),
    },
    skipStates: { root: ['focus-visible'] },
};

/**
 * The shared square control chrome, parameterized on the owning component's
 * size token so `variants.size` can rebind each independently.
 */
const tickBox = (size: string): CssProps => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    ...inked,
    boxShadow: 'var(--shadow-xs)',
    transition: motion('background'),
});

/**
 * The tick is one square slab painted in `currentColor` and carved by
 * `clip-path`.
 *
 * BORROWED, not invented: this is daisyUI 5.7.8's `.checkbox:before`
 * construction — a six-point polygon carving an L out of a `currentColor` slab,
 * `rotate: 45deg` to turn the L into a check, the middle points collapsed for
 * `unchecked`, and the same `translate: 0 -35%` daisy uses to slide the
 * indeterminate bar up (see `BAR` below). Retuned, not restyled: the arms are
 * 30% of the slab where daisy's are 20%, and `--ease-emphasized: steps(3, end)`
 * draws the tick in three hard frames instead of sliding it. Those two are the
 * whole of what makes it brutalist; a mark with a construction of its own — two
 * axis-aligned slabs at a hard 90°, no rotation, which suits `steps()` better
 * than a rotated carve — is still owed. Noted in the README so the lineage does
 * not have to be re-derived.
 *
 * `unchecked` collapses the L's stem down onto its foot, so checking DRAWS the
 * tick rather than fading one in. All three paths keep the same six points,
 * which is what makes them interpolable: the mark morphs, it never cross-fades.
 */
const TICK = 'polygon(10% 100%, 10% 70%, 45% 70%, 45% 0%, 75% 0%, 75% 100%)';
const TICK_COLLAPSED = 'polygon(10% 100%, 10% 70%, 45% 70%, 45% 70%, 75% 70%, 75% 100%)';
/**
 * Indeterminate is the collapsed foot widened to the full slab and shoved up
 * to the middle — a fat unrotated bar, and the same six points again. The shove
 * is `translate: 0 -35%` in the state below, daisy's own number: the foot sits
 * at 70% of the slab, so lifting it by 35% of the slab's height lands its
 * centre on the middle.
 */
const BAR = 'polygon(0% 100%, 0% 70%, 50% 70%, 50% 70%, 100% 70%, 100% 100%)';

/**
 * Geometry painted with `background`/`clip-path` is at the mercy of
 * forced-colors, which overrides both — and it does not print. Both media get
 * the same treatment daisy gives them: drop the geometry, restore a glyph,
 * and let the system's own ink carry it.
 *
 * Both are named built-in conditions, so both sort into the preference tier and
 * land after the flat state rules they override.
 *
 * The one thing they do NOT share is the ink. Forced colours name `CanvasText`
 * rather than inherit the indicator's `--checkbox-on-accent`: an author colour
 * there is only as good as the UA's revaluation of it, and the mode whose whole
 * job is predictable ink is the last place to leave it implied. It has to be
 * restated per state as well as on `base`, because `indeterminate`'s flat rule
 * declares its own `color` and outranks a `base` override on specificity, not
 * order.
 *
 * Print names `--print-ink` for the same reason forced colours names
 * `CanvasText`: neither medium may be left to inherit. It used to inherit
 * `--checkbox-on-accent`, which is white in the light theme, so the checked
 * tick printed white on paper the fill did not print — 1.00:1, measured. The
 * obvious swap to `--color-base-content` only moved the failure to the dark
 * theme, where it and `CanvasText` both resolve white; `--print-ink` is the
 * theme-independent paper ink that answers both (#233).
 *
 * Only for marks a glyph can actually carry: rating-group's meter handles the
 * two media itself, because its `half` glyph does not exist in system fonts.
 */
const glyphFallback = (styles: PartStyles): Record<string, PartStyles> => ({
    'forced-colors': {
        ...styles,
        base: { ...styles.base, color: 'CanvasText' },
        states: {
            ...styles.states,
            indeterminate: { ...styles.states?.indeterminate, color: 'CanvasText' },
        },
    },
    print: {
        ...styles,
        base: { ...styles.base, color: 'var(--print-ink)' },
        states: {
            ...styles.states,
            indeterminate: { ...styles.states?.indeterminate, color: 'var(--print-ink)' },
        },
    },
});

export const checkbox: RecipeInput = {
    component: 'checkbox',
    // Accent defaults live in `tokens:` so the un-attributed render IS the
    // primary variant and `variants.color` only rebinds custom properties —
    // the toast shape.
    tokens: {
        '--checkbox-size': 'calc(var(--size-selector) * 6)',
        // The slab the tick is carved from. 0.6 of the box leaves the rotated
        // check clear of the 3px frame at every step of the size ramp, and
        // deriving it from `--checkbox-size` means the ramp needs no extra
        // entry — daisy reaches the same proportion by padding the control.
        '--checkbox-tick': 'calc(var(--checkbox-size) * 0.6)',
        '--checkbox-accent': 'var(--color-primary)',
        '--checkbox-on-accent': 'var(--color-primary-content)',
    },
    parts: {
        root: {
            base: { display: 'inline-flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' },
            states: { checked: {}, unchecked: {}, indeterminate: {}, disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' } },
        },
        control: {
            base: tickBox('var(--checkbox-size)'),
            states: {
                checked: { background: 'var(--checkbox-accent)' },
                unchecked: {},
                // Deliberate two-accent design: indeterminate stays the fixed
                // `accent` role — semantic contrast against checked, not the
                // component accent, so it does not follow `color`.
                indeterminate: { background: 'var(--color-accent)' },
                // The system's error idiom, unchanged: the frame turns error.
                // On a 3px border that is the loudest thing on the control,
                // and it survives the checked fill and the indeterminate one
                // because the frame is not what either of them paints.
                invalid: { borderColor: 'var(--color-error)' },
                ...focusRing,
            },
        },
        indicator: {
            base: {
                // `color` drives the slab (`background: currentColor`) AND the
                // forced-colors glyph, so one declaration paints the mark
                // whichever route it takes.
                color: 'var(--checkbox-on-accent)',
                width: 'var(--checkbox-tick)',
                height: 'var(--checkbox-tick)',
                flexShrink: '0',
                background: 'currentColor',
                clipPath: TICK_COLLAPSED,
                rotate: '45deg',
                translate: '0',
                opacity: '0',
                // The carve is the animation, so it gets the long duration and
                // the three-frame easing; opacity and the rotate/translate
                // swap ride along at the short one.
                transition: 'clip-path var(--duration-slow) var(--ease-emphasized), '
                    + motion('opacity, rotate, translate'),
            },
            states: {
                checked: { clipPath: TICK, opacity: '1' },
                unchecked: {},
                // Deliberate two-accent design: the indeterminate mark stays
                // the fixed `accent-content`, pairing the fixed `accent` fill
                // above. The bar is unrotated and centred by its own shove.
                indeterminate: {
                    color: 'var(--color-accent-content)',
                    clipPath: BAR,
                    rotate: '0deg',
                    translate: '0 -35%',
                    opacity: '1',
                },
            },
            at: glyphFallback({
                // Geometry off — and per state, because the flat state rules
                // outrank a `base` override on specificity, not order.
                base: {
                    width: 'auto',
                    height: 'auto',
                    background: 'none',
                    fontWeight: 'var(--weight-bold)',
                    fontSize: 'calc(var(--checkbox-size) * 0.8)',
                    lineHeight: 'var(--leading-none)',
                    rotate: '0deg',
                    translate: '0',
                },
                states: {
                    checked: { clipPath: 'none', opacity: '1' },
                    unchecked: {},
                    indeterminate: { clipPath: 'none', translate: '0', opacity: '1' },
                },
                selectors: {
                    '&[data-state="checked"]::after': { content: '"✓"' },
                    '&[data-state="indeterminate"]::after': { content: '"−"' },
                },
            }),
        },
        label: { base: { ...label, fontSize: 'var(--text-xs)' }, states: { checked: {}, unchecked: {}, indeterminate: {} } },
        'hidden-input': { base: { position: 'absolute', width: '1px', height: '1px', opacity: '0' } },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--checkbox-accent': `var(--color-${c})`,
            '--checkbox-on-accent': `var(--color-${c}-content)`,
        } } }])),
        size: {
            xs: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 4)' } }, label: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 5)' } }, label: { base: { fontSize: 'var(--text-xs)' } } },
            md: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 6)' } }, label: { base: { fontSize: 'var(--text-xs)' } } },
            lg: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 7)' } }, label: { base: { fontSize: 'var(--text-sm)' } } },
            xl: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 8)' } }, label: { base: { fontSize: 'var(--text-md)' } } },
        },
    },
    skipStates: { root: ['focus-visible'] },
};

/**
 * ── SPLICE 2 — insert RATING_FILL_LEVELS immediately before the recipe, then
 *    replace the whole `export const ratingGroup` block ────────────────────
 */

export const radioGroup: RecipeInput = {
    component: 'radio-group',
    // Accent defaults live in `tokens:` so the un-attributed render IS the
    // primary variant and `variants.color` only rebinds custom properties —
    // the toast shape.
    tokens: {
        '--radio-size': 'calc(var(--size-selector) * 6)',
        '--radio-accent': 'var(--color-primary)',
        '--radio-on-accent': 'var(--color-primary-content)',
    },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' },
            states: { invalid: {}, required: {} },
            selectors: {
                // `invalid` is a fact about the GROUP — `item-control` carries
                // no flag of its own — so the frame is turned from the root.
                '&[data-invalid] [data-part="item-control"]': { borderColor: 'var(--color-error)' },
            },
        },
        label: { base: { ...label, fontSize: 'var(--text-sm)' } },
        item: {
            base: { display: 'inline-flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' },
            states: { disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' } },
        },
        // Square, like everything else. A brutalist radio is not a circle.
        'item-control': {
            base: tickBox('var(--radio-size)'),
            states: { checked: { background: 'var(--radio-accent)' }, unchecked: {}, ...focusRing },
        },
        'item-indicator': {
            base: {
                // /2.4 keeps the resting dot at the original selector * 2.5
                // while letting it follow the box through the size ramp.
                width: 'calc(var(--radio-size) / 2.4)',
                height: 'calc(var(--radio-size) / 2.4)',
                background: 'var(--radio-on-accent)',
                transform: 'scale(0)',
                transition: motion('transform'),
            },
            states: { checked: { transform: 'scale(1)' }, unchecked: {} },
        },
        'item-label': { base: { ...label, fontSize: 'var(--text-xs)' } },
        'hidden-input': { base: { position: 'absolute', width: '1px', height: '1px', opacity: '0' } },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--radio-accent': `var(--color-${c})`,
            '--radio-on-accent': `var(--color-${c}-content)`,
        } } }])),
        size: {
            xs: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 4)' } }, 'item-label': { base: { fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 5)' } }, 'item-label': { base: { fontSize: 'var(--text-xs)' } } },
            md: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 6)' } }, 'item-label': { base: { fontSize: 'var(--text-xs)' } } },
            lg: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 7)' } }, 'item-label': { base: { fontSize: 'var(--text-sm)' } } },
            xl: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 8)' } }, 'item-label': { base: { fontSize: 'var(--text-md)' } } },
        },
    },
    skipStates: { item: ['focus-visible', 'checked', 'unchecked'], 'item-label': ['checked', 'unchecked'] },
};

// ── Field, slider, progress ───────────────────────────────────────────────
export const field: RecipeInput = {
    component: 'field',
    parts: {
        root: { base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' } },
        label: {
            base: { ...label, fontSize: 'var(--text-xs)' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
            selectors: { '&[data-required]::after': { content: '" *"', color: 'var(--color-error)' } },
        },
        description: { base: { margin: '0', fontSize: 'var(--text-xs)', opacity: '0.75' } },
        error: { base: { margin: '0', ...label, fontSize: 'var(--text-xs)', color: 'var(--color-error)' } },
    },
    variants: {
        // Colour STAMPS the label — a flat role chip hugging its own text,
        // brutalism's way of accenting a word. An ink treatment is not
        // available here: light's `accent`/`warning` are far too pale to
        // write with on paper, while the `-content` pair is guaranteed.
        // On a chip the required `*` joins the chip's own ink — its error
        // red would vanish into an `error` fill and has no floor on the
        // others; description and error text are untouched by the role.
        color: Object.fromEntries(ROLES.map((c) => [c, { label: {
            base: {
                alignSelf: 'flex-start',
                padding: '0 var(--space-xs)',
                background: `var(--color-${c})`,
                color: `var(--color-${c}-content)`,
            },
            selectors: { '&[data-required]::after': { color: 'inherit' } },
        } }])),
        size: {
            // `text-xs` is already this vocabulary's floor — the small steps
            // tighten the stack (and, at `xs`, the label's wide tracking)
            // instead of shrinking type it does not have.
            xs: {
                root: { base: { gap: 'var(--space-2xs)' } },
                label: { base: { letterSpacing: 'var(--tracking-normal)' } },
            },
            sm: { root: { base: { gap: 'var(--space-2xs)' } } },
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
        },
    },
    skipStates: { label: ['invalid', 'required'], error: ['invalid'] },
};

export const slider: RecipeInput = {
    component: 'slider',
    // The accent default lives in `tokens:` so the un-attributed render IS the
    // primary variant and `variants.color` only rebinds a custom property —
    // the toast shape. The track metric rides the ramp with it, and is
    // progress's `--progress-track-size` step for step: the two sit one above
    // the other on a form and have to read as the same instrument. It is the
    // CHANNEL, not the box — progress's track is content-box (zero ships no
    // global `box-sizing` reset), so its ink sits outside its height, and the
    // pseudo-element below adds the same two borders back.
    tokens: {
        '--slider-accent': 'var(--color-primary)',
        '--slider-track-size': 'calc(var(--size-field) * 5)',
        // The handle is the channel's inked box plus one space step, which
        // the centring splits into half a step of overhang on each edge —
        // derived, so the ramp moves one lever and the proportion holds at
        // every step and under the dark theme's thinner border.
        '--slider-thumb-size': 'calc(var(--slider-track-size) + var(--border) * 2 + var(--space-sm))',
    },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
        },
        label: { base: { ...label, fontSize: 'var(--text-xs)' } },
        /**
         * A custom skin (`appearance: none`), because the native range widget
         * is the one control this skin cannot reach: a pill track and a round
         * accent-coloured disc, no border, no shadow, sitting directly above a
         * progress bar that is square, 3px-inked and offset-shadowed (#221).
         * Rebuilt from the vendor pseudo-elements, it is the same two slabs
         * every other brutalist part is made of — `inked` channel, `inked`
         * handle, both carrying the hard offset shadow.
         *
         * Vendor thumb pseudos cannot share a selector list — one unrecognized
         * selector invalidates the whole rule — so each engine gets its own
         * copy of the same two rules, reading the shared custom properties. A
         * state therefore sets a property, never a pseudo rule.
         *
         * The kit compiles this part's `focus-visible` state to the runtime's
         * `[data-focus-visible]` flag, not the pseudo-class, which matters
         * here: Blink treats a range input as ALWAYS `:focus-visible`, even
         * under the mouse, so a pseudo-class ring would stick after every
         * drag. The base kills the native outline; the flag draws the ring.
         */
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
                '--slider-thumb-shadow': 'var(--shadow-xs)',
                '--slider-thumb-shift': 'translate(0, 0)',
                // The channel's shadow is a lever of its own, for the same
                // reason the thumb's is: in this design system the hard offset
                // shadow IS the affordance, so a disabled control has to be
                // able to put the whole instrument flat, not just its handle.
                '--slider-track-shadow': 'var(--shadow-xs)',
                /**
                 * The fill has to grow from the inline start, and a gradient
                 * has no logical direction. Both engines flip a native range
                 * under `direction: rtl` — the thumb travels right-to-left —
                 * so a hard-coded `to right` would fill away from the thumb
                 * (the bug #229 reports for the rating meter and the switch
                 * thumb). The direction is a property the RTL selector below
                 * rebinds.
                 */
                '--slider-fill-dir': 'to right',
                // The unfilled span is progress's paper, not a grey: the two
                // tracks are the same box.
                '--slider-track':
                    'linear-gradient(var(--slider-fill-dir), var(--slider-accent) var(--slider-percent, 50%), var(--color-base-100) 0)',
            },
            states: {
                // Both shadows go, not just the handle's: a raised offset
                // shadow reads as pressable here, so a disabled slider lies
                // flat on the page — the same collapse button makes.
                disabled: {
                    cursor: 'not-allowed',
                    '--slider-track-shadow': 'none',
                    '--slider-thumb-shadow': 'none',
                },
                ...focusRing,
                // `invalid` is semantic: the accent indirection swaps the fill
                // (and the forced-colors fallback) to error under every colour
                // variant, on purpose.
                invalid: { '--slider-accent': 'var(--color-error)' },
                // The stamp, at thumb scale — the handle drops its shadow and
                // shoves itself into where the shadow was, exactly as button
                // does, by the shadow's own 2px offset.
                pressed: { '--slider-thumb-shadow': 'none', '--slider-thumb-shift': 'translate(2px, 2px)' },
            },
            selectors: {
                // `:where()` is forgiving, so an engine without `:dir()` drops
                // that one argument and still matches the attribute forms.
                [`&${rtl}`]: { '--slider-fill-dir': 'to left' },
                '&::-webkit-slider-runnable-track': {
                    boxSizing: 'border-box',
                    height: 'calc(var(--slider-track-size) + var(--border) * 2)',
                    ...inked,
                    background: 'var(--slider-track)',
                    boxShadow: 'var(--slider-track-shadow)',
                },
                '&::-webkit-slider-thumb': {
                    appearance: 'none',
                    boxSizing: 'border-box',
                    width: 'var(--slider-thumb-size)',
                    height: 'var(--slider-thumb-size)',
                    // Blink lays the thumb out against the track's CONTENT
                    // box — the channel — so the overhang is halved against
                    // that, not against the inked box. Gecko centres its own.
                    marginTop: 'calc((var(--slider-track-size) - var(--slider-thumb-size)) / 2)',
                    ...inked,
                    background: 'var(--slider-thumb-ink)',
                    boxShadow: 'var(--slider-thumb-shadow)',
                    transform: 'var(--slider-thumb-shift)',
                    transition: motion('box-shadow, transform'),
                },
                '&::-moz-range-track': {
                    boxSizing: 'border-box',
                    height: 'calc(var(--slider-track-size) + var(--border) * 2)',
                    ...inked,
                    background: 'var(--slider-track)',
                    boxShadow: 'var(--slider-track-shadow)',
                },
                '&::-moz-range-thumb': {
                    boxSizing: 'border-box',
                    width: 'var(--slider-thumb-size)',
                    height: 'var(--slider-thumb-size)',
                    ...inked,
                    background: 'var(--slider-thumb-ink)',
                    boxShadow: 'var(--slider-thumb-shadow)',
                    transform: 'var(--slider-thumb-shift)',
                    transition: motion('box-shadow, transform'),
                },
            },
            at: {
                // Native rendering knows forced colors better than a custom
                // skin does; the retained accentColor keeps the fallback
                // branded.
                'forced-colors': { base: { appearance: 'auto' } },
            },
        },
        // The composed range projection (#325): the same two inked slabs as
        // the rebuilt control — channel and handle — as real parts.
        track: {
            base: {
                boxSizing: 'border-box',
                height: 'calc(var(--slider-track-size) + var(--border) * 2)',
                marginBlock: 'calc((var(--slider-thumb-size) - var(--slider-track-size)) / 2)',
                ...inked,
                boxShadow: 'var(--shadow-xs)',
                cursor: 'pointer',
            },
            states: {
                // The whole instrument lies flat when disabled — same as the
                // native control's collapse.
                disabled: { cursor: 'not-allowed', boxShadow: 'none' },
            },
        },
        range: {
            base: {
                height: '100%',
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
                ...inked,
                boxShadow: 'var(--shadow-xs)',
                cursor: 'pointer',
                outline: 'none',
                touchAction: 'none',
            },
            states: {
                // The stamp — the handle drops its shadow and shoves itself
                // into where the shadow was, exactly as button does.
                pressed: { boxShadow: 'none' },
                disabled: { cursor: 'not-allowed', boxShadow: 'none' },
                ...focusRing,
            },
        },
        mark: {
            base: {
                paddingBlockStart: 'calc(var(--slider-track-size) + var(--border) * 2 + var(--space-2xs))',
                ...label,
                fontSize: 'var(--text-xs)',
                lineHeight: '1',
                whiteSpace: 'nowrap',
            },
            states: { disabled: {} },
            selectors: {
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    insetBlockStart: '0',
                    insetInlineStart: '-1px',
                    width: '2px',
                    height: 'calc(var(--slider-track-size) + var(--border) * 2)',
                    background: 'var(--color-base-content)',
                },
            },
        },
        'value-text': { base: { ...label, fontSize: 'var(--text-xs)' } },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--slider-accent': `var(--color-${c})`,
        } } }])),
        // Now that the widget is rebuilt, the ramp sizes what a slider is made
        // of rather than its box: it moves the channel — progress's own steps,
        // exactly — and the thumb follows from it, so the two bars step
        // together and the handle keeps its proportion.
        size: {
            xs: { root: { base: { '--slider-track-size': 'calc(var(--size-field) * 2)' } }, label: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { '--slider-track-size': 'calc(var(--size-field) * 3)' } }, label: { base: { fontSize: 'var(--text-xs)' } } },
            // `md` is the un-attributed render — the defaults in `tokens:`
            // already ARE the middle step, so it only restates the label.
            md: { label: { base: { fontSize: 'var(--text-xs)' } } },
            lg: { root: { base: { '--slider-track-size': 'calc(var(--size-field) * 7)' } }, label: { base: { fontSize: 'var(--text-sm)' } } },
            xl: { root: { base: { '--slider-track-size': 'calc(var(--size-field) * 9)' } }, label: { base: { fontSize: 'var(--text-md)' } } },
        },
    },
    skipStates: { root: ['invalid', 'focus-visible'] },
};

export const progress: RecipeInput = {
    component: 'progress',
    // Accent defaults live in `tokens:` so the un-attributed render IS the
    // primary variant and `variants.color` only rebinds custom properties —
    // the toast shape.
    tokens: {
        '--progress-accent': 'var(--color-primary)',
        '--progress-track-size': 'calc(var(--size-field) * 5)',
    },
    keyframes: {
        // `transform` has no logical form, so the direction is carried by a value
        // the RTL rule can rebind — the same shape `--switch-thumb-dir` and
        // `--slider-fill-dir` already use here. Without it the determinate
        // `width`, an ordinary flow child, mirrors while the indeterminate sweep
        // of the same element does not.
        'brutalist-indeterminate':
            'from { transform: translateX(calc(var(--progress-sweep-dir) * -100%)); } '
            + 'to { transform: translateX(calc(var(--progress-sweep-dir) * 250%)); }',
    },
    parts: {
        root: { base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' } },
        label: { base: { ...label, fontSize: 'var(--text-xs)' } },
        track: {
            base: {
                position: 'relative',
                height: 'var(--progress-track-size)',
                ...inked,
                boxShadow: 'var(--shadow-xs)',
                overflow: 'hidden',
            },
        },
        range: {
            base: {
                height: '100%',
                background: 'var(--progress-accent)',
                transition: motion('width'),
                '--progress-sweep-dir': '1',
            },
            selectors: { [`&${rtl}`]: { '--progress-sweep-dir': '-1' } },
            states: {
                // `complete` is a semantic state, not an accent: it stays
                // success regardless of the colour variant, on purpose.
                complete: { background: 'var(--color-success)' },
                loading: {},
                // Literal duration on purpose: a loop must stop under reduced
                // motion, not accelerate — see `at` below.
                indeterminate: { width: '40%', animation: 'brutalist-indeterminate 1s var(--ease-standard) infinite' },
            },
            at: { 'reduced-motion': { states: { indeterminate: { animation: 'none', width: '100%' } } } },
        },
        'value-text': { base: { ...label, fontSize: 'var(--text-xs)' } },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--progress-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--progress-track-size': 'calc(var(--size-field) * 2)' } } },
            sm: { root: { base: { '--progress-track-size': 'calc(var(--size-field) * 3)' } } },
            md: { root: { base: { '--progress-track-size': 'calc(var(--size-field) * 5)' } } },
            lg: { root: { base: { '--progress-track-size': 'calc(var(--size-field) * 7)' } } },
            xl: { root: { base: { '--progress-track-size': 'calc(var(--size-field) * 9)' } } },
        },
    },
    skipStates: { root: ['loading', 'complete', 'indeterminate'] },
};

export const avatar: RecipeInput = {
    component: 'avatar',
    tokens: {
        '--avatar-size': 'calc(var(--size-selector) * 10)',
        '--avatar-text': 'var(--text-sm)',
        '--avatar-accent': 'var(--color-base-200)',
        '--avatar-on-accent': 'var(--color-base-content)',
    },
    parts: {
        root: {
            base: {
                ...inked,
                position: 'relative',
                display: 'inline-grid',
                width: 'var(--avatar-size)',
                height: 'var(--avatar-size)',
                overflow: 'hidden',
                verticalAlign: 'middle',
                boxShadow: 'var(--shadow-sm)',
            },
            states: { loading: {}, loaded: {}, error: {} },
        },
        image: {
            base: {
                gridArea: '1 / 1',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'grayscale(100%) contrast(1.1)',
            },
            states: { loading: {}, loaded: {}, error: {} },
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
                fontSize: 'var(--avatar-text)',
                userSelect: 'none',
            },
            // `display` must not defeat the `hidden` zero sets once the image
            // has loaded.
            selectors: { '&:not([hidden])': { display: 'grid' } },
            states: { loading: {}, loaded: {}, error: {} },
        },
    },
    variants: {
        // A flat fill in the role itself — brutalism has no tints, so the
        // fallback takes the full colour and its own content ink.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--avatar-accent': `var(--color-${c})`,
            '--avatar-on-accent': `var(--color-${c}-content)`,
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
 * Toast presence is runtime-managed — plain two-state transitions, no
 * `@starting-style`/`allow-discrete`. Brutalism doesn't glide anyway: the
 * card snaps in with the steps easing and drops into its shadow on exit.
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
                ...inked,
                pointerEvents: 'auto',
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                alignItems: 'center',
                columnGap: 'var(--space-md)',
                padding: 'var(--space-md) var(--space-lg)',
                borderInlineStart: 'calc(var(--border) * 2) solid var(--toast-accent)',
                boxShadow: 'var(--shadow-md)',
                fontSize: 'var(--text-sm)',
                opacity: '0',
                transform: 'translateY(var(--toast-from))',
                transition: 'opacity var(--duration-fast) var(--ease-standard), '
                    + 'transform var(--duration-fast) var(--ease-standard)',
            },
            selectors: {
                '&[data-placement^="top"]': { '--toast-from': '-8px' },
            },
            states: {
                open: { opacity: '1', transform: 'none' },
                closed: {},
            },
            at: {
                'reduced-motion': { base: { transition: 'none' }, states: { open: { transform: 'none' } } },
            },
        },
        title: {
            base: { gridColumn: '1', ...label, fontSize: 'var(--text-sm)' },
        },
        description: {
            base: {
                gridColumn: '1',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                color: 'color-mix(in oklab, var(--color-base-content) 75%, transparent)',
            },
        },
        action: {
            base: {
                gridColumn: '2',
                gridRow: '1',
                appearance: 'none',
                ...inked,
                ...label,
                fontSize: 'var(--text-xs)',
                padding: 'var(--space-2xs) var(--space-sm)',
                boxShadow: 'var(--shadow-xs)',
                cursor: 'pointer',
            },
            states: {
                hover: shift('1px'),
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { boxShadow: 'none', transform: 'translate(3px, 3px)' },
            },
        },
        close: {
            base: {
                gridColumn: '3',
                gridRow: '1',
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                ...label,
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
            },
            states: {
                hover: { color: 'var(--toast-accent)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
                ...focusRing,
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((role) => [
            role,
            { root: { base: { '--toast-accent': `var(--color-${role})` } } },
        ])),
        // Size moves the slab's box — padding and type — never the accent
        // bar. The title's fixed mono size is restated where it steps.
        size: {
            xs: {
                root: { base: { padding: 'var(--space-xs) var(--space-md)', fontSize: 'var(--text-xs)' } },
                title: { base: { fontSize: 'var(--text-xs)' } },
            },
            sm: { root: { base: { padding: 'var(--space-sm) var(--space-md)' } } },
            // `md` is the un-attributed render — the base already IS the
            // middle step.
            md: {},
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
};

export const combobox: RecipeInput = {
    component: 'combobox',
    // Accent defaults live in `tokens:` so the un-attributed render IS the
    // primary variant and `variants.color` only rebinds custom properties —
    // the toast shape.
    tokens: {
        '--combobox-accent': 'var(--color-primary)',
        '--combobox-on-accent': 'var(--color-primary-content)',
    },
    parts: {
        root: { base: { display: 'inline-flex', position: 'relative' } },
        control: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                minWidth: '12rem',
                ...inked,
                boxShadow: 'var(--shadow-xs)',
            },
            states: {
                open: { boxShadow: 'none', transform: 'translate(2px, 2px)' },
                closed: {},
                invalid: { borderColor: 'var(--color-error)' },
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
                ...label,
                fontSize: 'var(--text-xs)',
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
                '&::placeholder': { color: 'color-mix(in oklab, var(--color-base-content) 55%, transparent)', textTransform: 'uppercase' },
            },
        },
        trigger: {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                padding: '0 var(--space-md)',
                cursor: 'pointer',
                transition: motion('transform'),
            },
            states: {
                open: { transform: 'rotate(180deg)' },
                closed: {},
                disabled: { cursor: 'not-allowed' },
            },
        },
        popup: withPresence(popupPresence('translate(4px, 4px)'), { base: { ...slab, padding: 'var(--space-xs)', minWidth: '12rem' }, states: { open: {}, closed: {} } }),
        // The optgroup equivalent (#325) — the menu's group grammar.
        group: { base: { padding: 'var(--space-2xs) 0' } },
        'group-label': {
            base: { padding: 'var(--space-2xs) var(--space-sm)', ...label, fontSize: 'var(--text-xs)', opacity: '0.7' },
        },
        item: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: 'var(--space-xs) var(--space-sm)',
                ...label,
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
            },
            states: {
                highlighted: { background: 'var(--combobox-accent)', color: 'var(--combobox-on-accent)' },
                // Deliberate two-accent design: selected stays the fixed `accent`
                // role — semantic contrast against highlighted, not the component
                // accent, so it does not follow `color`.
                selected: { background: 'var(--color-accent)', color: 'var(--color-accent-content)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
            },
        },
        'item-indicator': { base: { fontSize: 'var(--text-xs)' } },
        empty: {
            base: {
                padding: 'var(--space-md)',
                ...label,
                fontSize: 'var(--text-xs)',
                textAlign: 'center',
                opacity: '0.7',
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--combobox-accent': `var(--color-${c})`,
            '--combobox-on-accent': `var(--color-${c}-content)`,
        } } }])),
        // The button ramp's shape, anchored so md IS the resting look:
        // vertical and horizontal padding one space step apart.
        size: {
            xs: { input: { base: { padding: 'var(--space-2xs) var(--space-xs)', fontSize: 'var(--text-xs)' } } },
            sm: { input: { base: { padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--text-xs)' } } },
            md: { input: { base: { padding: 'var(--space-sm) var(--space-md)', fontSize: 'var(--text-xs)' } } },
            lg: { input: { base: { padding: 'var(--space-md) var(--space-lg)', fontSize: 'var(--text-sm)' } } },
            xl: { input: { base: { padding: 'var(--space-lg) var(--space-xl)', fontSize: 'var(--text-md)' } } },
        },
    },
    // The visible ring lives on `control`; input and trigger delegate.
    skipStates: {
        input: ['focus-visible'],
        trigger: ['focus-visible'],
    },
};

// ── Toggle ────────────────────────────────────────────────────────────────
/**
 * A two-state slab. Off is the outlined button look; on is inverted and
 * collapsed into its own shadow — a plate stamped down and left there. The
 * accent machinery mirrors button: `color` sets the pair once, `on` reads it.
 */
export const toggle: RecipeInput = {
    component: 'toggle',
    tokens: {
        '--toggle-accent': 'var(--color-primary)',
        '--toggle-on-accent': 'var(--color-primary-content)',
    },
    parts: {
        root: {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-sm)',
                ...inked,
                ...label,
                lineHeight: 'var(--leading-none)',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer',
                transition: motion('box-shadow, transform, background, color'),
            },
            states: {
                disabled: {
                    opacity: 'var(--disabled-opacity)',
                    cursor: 'not-allowed',
                    boxShadow: 'none',
                    transform: 'none',
                },
                hover: shift('1px'),
                // On = stamped down: inverted fill, shadow gone, sitting where
                // the shadow was.
                on: {
                    background: 'var(--toggle-accent)',
                    color: 'var(--toggle-on-accent)',
                    boxShadow: 'none',
                    transform: 'translate(2px, 2px)',
                },
                off: {},
                ...focusRing,
            },
            selectors: {
                // Hovering an on toggle must not lift it back out of its
                // shadow — restate the stamped look at higher specificity.
                '&[data-state="on"]:hover': {
                    background: 'var(--toggle-accent)',
                    boxShadow: 'none',
                    transform: 'translate(2px, 2px)',
                },
                // The button stamp: full shove while the press is held.
                '&[data-pressed]:not([data-disabled])': { boxShadow: 'none', transform: 'translate(3px, 3px)' },
            },
        },
    },
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
            sm: { root: { base: { padding: 'var(--space-xs) var(--space-md)', fontSize: 'var(--text-xs)' } } },
            md: { root: { base: { padding: 'var(--space-sm) var(--space-lg)', fontSize: 'var(--text-sm)' } } },
            lg: { root: { base: { padding: 'var(--space-md) var(--space-xl)', fontSize: 'var(--text-md)' } } },
            xl: { root: { base: { padding: 'var(--space-lg) var(--space-2xl)', fontSize: 'var(--text-lg)' } } },
        },
    },
    defaultVariants: { color: 'primary', size: 'md' },
};

// ── Toggle group ──────────────────────────────────────────────────────────
/**
 * One framed slab, items joined by hard interior rules; the on item inverts.
 * The frame clips (`overflow: hidden`), so the press stamp stays inside it
 * and the focus ring is inset rather than offset out into the clip.
 */
export const toggleGroup: RecipeInput = {
    component: 'toggle-group',
    tokens: {
        '--toggle-group-accent': 'var(--color-primary)',
        '--toggle-group-on-accent': 'var(--color-primary-content)',
    },
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                ...inked,
                boxShadow: 'var(--shadow-sm)',
                overflow: 'hidden',
            },
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
                gap: 'var(--space-sm)',
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                padding: 'var(--space-sm) var(--space-lg)',
                ...label,
                fontSize: 'var(--text-xs)',
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
                transition: motion('background, color, transform'),
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                on: {
                    background: 'var(--toggle-group-accent)',
                    color: 'var(--toggle-group-on-accent)',
                },
                off: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                // The frame clips its children, so an offset ring would be
                // swallowed — inset it. currentColor keeps it visible on both
                // the base and the inverted on fill.
                'focus-visible': {
                    outline: 'var(--border) solid currentColor',
                    outlineOffset: 'calc(-2 * var(--border))',
                },
            },
            selectors: {
                // Equal footing with hover is not enough — the on fill must
                // win the hover wash outright.
                '&[data-state="on"]:hover': { background: 'var(--toggle-group-accent)' },
                '&[data-orientation="horizontal"] + &': {
                    borderInlineStart: 'var(--border) solid var(--color-base-content)',
                },
                '&[data-orientation="vertical"] + &': {
                    borderBlockStart: 'var(--border) solid var(--color-base-content)',
                },
                // A shallower stamp than the free-standing button: the item
                // has no shadow to collapse into, and the frame clips it.
                '&[data-pressed]:not([data-disabled])': { transform: 'translate(1px, 1px)' },
            },
        },
    },
    variants: {
        // The group is a frame around its items, so the ramp lands on the
        // items and the frame follows their box.
        size: {
            xs: { item: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-2xs) var(--space-sm)' } } },
            sm: { item: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-xs) var(--space-md)' } } },
            // `md` is the un-attributed render: the base already IS the
            // middle step, so restating it here would be a second copy free
            // to drift. An empty entry emits no rule and keeps the base.
            md: {},
            lg: { item: { base: { fontSize: 'var(--text-sm)', padding: 'var(--space-md) var(--space-xl)' } } },
            xl: { item: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-lg) var(--space-2xl)' } } },
        },
        color: Object.fromEntries(ROLES.map((c) => [
            c,
            {
                item: {
                    base: {
                        '--toggle-group-accent': `var(--color-${c})`,
                        '--toggle-group-on-accent': `var(--color-${c}-content)`,
                    },
                },
            },
        ])),
    },
    defaultVariants: { color: 'primary' },
};

// ── Number input ──────────────────────────────────────────────────────────
/**
 * A framed counting slab: the `control` is one inked box holding the two
 * stepper plates and the readout between them. The ring and the invalid
 * frame draw on the box (the combobox split — input delegates focus), and
 * a stepper press is the stamp, kept shallow because the frame clips it.
 */
export const numberInput: RecipeInput = {
    component: 'number-input',
    tokens: { '--number-input-accent': 'var(--color-primary)' },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-xs)' },
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        },
        label: {
            base: { ...label, fontSize: 'var(--text-xs)' },
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
                alignItems: 'stretch',
                ...inked,
                boxShadow: 'var(--shadow-xs)',
                // The frame clips its children, so the stepper stamp stays
                // inside the slab instead of poking through the border.
                overflow: 'hidden',
            },
            states: {
                invalid: { borderColor: 'var(--color-error)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
                readonly: {},
                'focus-visible': { ...focusRing['focus-visible'], outline: 'var(--border) solid var(--number-input-accent)' },
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
                ...label,
                fontSize: 'var(--text-xs)',
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
                '&::placeholder': { color: 'color-mix(in oklab, var(--color-base-content) 55%, transparent)', textTransform: 'uppercase' },
            },
        },
        // The stepper plates: hard interior rules against the readout, a
        // hover wash, and the press stamp — shallow, since the frame clips.
        'decrement-trigger': {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                ...label,
                fontSize: 'var(--text-xs)',
                padding: '0 var(--space-md)',
                cursor: 'pointer',
                userSelect: 'none',
                borderInlineEnd: 'var(--border) solid var(--color-base-content)',
                transition: motion('background, transform'),
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-200)', transform: 'translate(1px, 1px)' },
            },
        },
        'increment-trigger': {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                ...label,
                fontSize: 'var(--text-xs)',
                padding: '0 var(--space-md)',
                cursor: 'pointer',
                userSelect: 'none',
                borderInlineStart: 'var(--border) solid var(--color-base-content)',
                transition: motion('background, transform'),
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-200)', transform: 'translate(1px, 1px)' },
            },
        },
    },
    // The visible ring lives on `control`; the input delegates.
    skipStates: { input: ['focus-visible'] },
    variants: {
        // The field's own ring carries the role — the chrome is neutral, so
        // the focus state is the only place a number input can show colour.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--number-input-accent': `var(--color-${c})`,
        } } }])),
        // The readout carries the ramp; the steppers follow it so the frame
        // stays proportional.
        size: {
            xs: { input: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-2xs) var(--space-2xs)' } } },
            sm: { input: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-xs) var(--space-2xs)' } } },
            // `md` is the un-attributed render: the base already IS the
            // middle step, so restating it here would be a second copy free
            // to drift. An empty entry emits no rule and keeps the base.
            md: {},
            lg: { input: { base: { fontSize: 'var(--text-sm)', padding: 'var(--space-md) var(--space-sm)' } } },
            xl: { input: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-lg) var(--space-md)' } } },
        },
    },
};

/**
 * A brutalist rating is not a row of stars — it is a row of cells that fill.
 * Each item is a framed square; the fill is a hard-edged slab clipped to 0%,
 * 50% or 100% of the cell, so `half` is unmistakably half and no glyph has to
 * carry the state. The clip snaps in `steps()`, like everything else here.
 *
 * `empty`'s 100% inset means nothing paints, so the resting row is five empty
 * frames — which is also why the fill needs no separate "off" colour.
 */
const RATING_FILL_LEVELS: Record<string, CssProps> = {
    '&::before': {
        content: '""',
        position: 'absolute',
        // Held off the frame by one hairline of paper: the default fill IS
        // `--color-base-content`, the same ink the frame is drawn in, so a
        // flush slab would swallow its own cell and a full row would read as
        // one long bar instead of five marks.
        inset: 'var(--space-2xs)',
        background: 'var(--rating-fill)',
        // HOW MUCH is hidden is the state's business; WHICH EDGE it is hidden
        // from is the direction's. Splitting them that way means each state
        // states one number and the RTL rule states one side, rather than
        // three states each needing an RTL twin (#229).
        '--rating-hidden': '100%',
        clipPath: 'inset(0 var(--rating-hidden) 0 0)',
        transition: 'clip-path var(--duration-normal) var(--ease-emphasized)',
    },
    '&[data-state="half"]::before': { '--rating-hidden': '50%' },
    '&[data-state="full"]::before': { '--rating-hidden': '0%' },
    // Same forgiving selector as the slider's fill direction. It carries no
    // extra specificity (`:where()` is zero), so it wins on order alone — and
    // it only has to outrank the base rule, since the state rules above set
    // the amount and never the side.
    [`&${rtl}::before`]: {
        clipPath: 'inset(0 0 0 var(--rating-hidden))',
    },
};

export const ratingGroup: RecipeInput = {
    component: 'rating-group',
    tokens: {
        // A cell side, not a font size — the ramp below moves it in
        // `--size-selector` steps, which is daisy's own rating ramp.
        '--rating-size': 'calc(var(--size-selector) * 6)',
        '--rating-fill': 'var(--color-base-content)',
    },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-xs)' },
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        },
        label: {
            base: { ...label, fontSize: 'var(--text-xs)' },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                invalid: { color: 'var(--color-error)' },
                required: {},
            },
            selectors: { '&[data-required]::after': { content: '" *"', color: 'var(--color-error)' } },
        },
        control: {
            // One step wider than the old glyph row: the cells are solid ink
            // when full, so the gap is the only thing keeping five of them
            // from reading as one bar.
            base: { display: 'inline-flex', gap: 'var(--space-xs)' },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                readonly: {},
                ...focusRing,
            },
        },
        item: {
            base: {
                display: 'inline-block',
                position: 'relative',
                width: 'var(--rating-size)',
                height: 'var(--rating-size)',
                ...inked,
                // The component's default symbol is a text star. The cell
                // replaces it outright — in every medium, see `at` below — so
                // it is collapsed rather than styled.
                fontSize: '0',
                cursor: 'pointer',
                userSelect: 'none',
                transition: motion('background'),
            },
            states: {
                // The fill lives in `selectors` below — one slab, three clip
                // levels — so the states themselves carry only the chrome.
                full: {},
                half: {},
                empty: {},
                // Hover preview: a hard wash inside the frame, behind the
                // slab. Brutalism does not swell — no scaling.
                highlighted: { background: 'var(--color-base-200)' },
                disabled: { cursor: 'not-allowed' },
                readonly: { cursor: 'default' },
                // The group ring lives on control; the value-following tab
                // stop still gets its own tight frame.
                'focus-visible': { outline: 'var(--border) solid var(--color-primary)', outlineOffset: '1px' },
            },
            selectors: RATING_FILL_LEVELS,
            at: {
                /**
                 * The checkbox hands its mark to a glyph under forced colours;
                 * the meter cannot. There is no half-star glyph to hand it to:
                 * U+2BEA (⯪) is tofu in most system fonts, so zero's default
                 * `half` is a full `★` (#222) — the one state the fallback
                 * exists to keep legible would be the one it loses.
                 *
                 * So the geometry stays and is repainted in SYSTEM ink
                 * instead: forced colours reverts author colours but honours
                 * `Canvas`/`CanvasText` (verified in Chromium), which is the
                 * whole point of the media query.
                 */
                'forced-colors': {
                    base: { borderColor: 'CanvasText', background: 'Canvas' },
                    selectors: { '&::before': { background: 'CanvasText' } },
                },
                // Same reasoning on paper, different mechanism: printing drops
                // backgrounds by default, which would take the entire meter
                // with it, so the meter asks for its paint explicitly. A reader
                // who disables background graphics can still refuse — the meter
                // then prints blank instead of overstating the value; glyph ink
                // is the fix if that ever matters (#230).
                print: { base: { printColorAdjust: 'exact' } },
            },
        },
        'hidden-input': { base: { position: 'absolute', width: '1px', height: '1px', opacity: '0' } },
    },
    variants: {
        // The slab sits on the page, not on a role fill, so the raw role is
        // not always safe: `--color-accent` measures 2.20:1 on light base-200.
        // Mixing 70/30 toward the PAGE INK deepens it on paper and lightens it
        // on ink — `--color-base-content` flips with the scheme, a role's own
        // `-content` does not — so one declaration clears 3:1 in both
        // (worst 3.78:1, light `accent` on a hovered cell). Mixing toward the
        // role's content pair, which is what the other design systems do,
        // measures 2.42:1 here: brutalist `primary-content` is white, so on
        // paper it washes the fill out instead of deepening it.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--rating-fill': `color-mix(in oklab, var(--color-${c}) 70%, var(--color-base-content))`,
        } } }])),
        size: {
            xs: { root: { base: { '--rating-size': 'calc(var(--size-selector) * 4)' } } },
            sm: { root: { base: { '--rating-size': 'calc(var(--size-selector) * 5)' } } },
            // `md` is the un-attributed render — the defaults in `tokens:`
            // already ARE the middle step.
            md: {},
            lg: { root: { base: { '--rating-size': 'calc(var(--size-selector) * 7)' } } },
            xl: { root: { base: { '--rating-size': 'calc(var(--size-selector) * 8)' } } },
        },
    },
};

// ── Tree view ─────────────────────────────────────────────────────────────
/**
 * The menu row grammar walking a hierarchy: an inked frame around the tree,
 * hard-washed rows inside it, and the selected row stamped in full ink —
 * the page inverts under it. Depth is the DOM nesting: `branch-content`
 * indents once behind a hard left rule, so every level draws its own rule.
 */
const treeRow: PartStyles = {
    base: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        padding: 'var(--space-xs) var(--space-sm)',
        ...label,
        fontSize: 'var(--tree-text)',
        cursor: 'pointer',
        transition: motion('background, color, transform'),
    },
    states: {
        hover: { background: 'var(--color-base-200)' },
        // Selected = stamped: full ink slab, page colour for the glyphs.
        selected: { background: 'var(--tree-accent)', color: 'var(--tree-on-accent)' },
        disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
        ...focusRing,
    },
    selectors: {
        // The hover wash must not fade a selected row back toward the page.
        '&[data-selected]:hover': { background: 'var(--color-base-content)' },
        // A shallow stamp — rows carry no shadow to collapse into.
        '&[data-pressed]:not([data-disabled])': { transform: 'translate(1px, 1px)' },
    },
};

export const treeView: RecipeInput = {
    component: 'tree-view',
    tokens: {
        '--tree-accent': 'var(--color-base-content)',
        '--tree-text': 'var(--text-xs)',
        '--tree-on-accent': 'var(--color-base-100)',
    },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
        },
        label: { base: { ...label, fontSize: 'var(--text-sm)' } },
        tree: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                ...inked,
                boxShadow: 'var(--shadow-sm)',
                padding: 'var(--space-xs)',
            },
        },
        item: treeRow,
        branch: {
            base: { display: 'flex', flexDirection: 'column', outline: 'none' },
            states: { open: {}, closed: {}, selected: {}, disabled: {} },
        },
        'branch-trigger': {
            base: { ...treeRow.base, userSelect: 'none' },
            states: { open: {}, closed: {}, ...treeRow.states },
            selectors: treeRow.selectors,
        },
        // A hard quarter-turn, on the same tokenized motion as everything
        // else — the durations collapse under reduced motion.
        'branch-indicator': {
            base: { display: 'inline-block', transition: motion('transform') },
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
            base: {
                display: 'flex',
                flexDirection: 'column',
                marginInlineStart: 'var(--space-sm)',
                paddingInlineStart: 'var(--space-sm)',
                borderInlineStart: 'var(--border) solid var(--color-base-content)',
            },
            states: { open: {}, closed: {} },
        },
    },
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
 * A slab you type into. Same inked frame and hard shadow as the number
 * input's, and the same mono uppercase label above it — but the typed value
 * itself stays in the reading face. Uppercasing what the user wrote would be
 * the design system editing their data, which is a different thing from
 * styling it; the placeholder, being ours, is fair game.
 */
export const input: RecipeInput = {
    component: 'input',
    tokens: { '--input-accent': 'var(--color-primary)' },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-xs)' },
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        },
        label: {
            base: { ...label, fontSize: 'var(--text-xs)' },
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
                alignItems: 'stretch',
                ...inked,
                boxShadow: 'var(--shadow-xs)',
                overflow: 'hidden',
            },
            states: {
                invalid: { borderColor: 'var(--color-error)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
                readonly: {},
                'focus-visible': { ...focusRing['focus-visible'], outline: 'var(--border) solid var(--input-accent)' },
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
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                padding: 'var(--space-sm) var(--space-md)',
            },
            states: {
                disabled: { cursor: 'not-allowed' },
                readonly: {},
                invalid: {},
                required: {},
            },
            selectors: {
                '&::placeholder': { color: 'color-mix(in oklab, var(--color-base-content) 55%, transparent)', textTransform: 'uppercase' },
            },
        },
    },
    // The visible ring lives on `control`; the input delegates.
    skipStates: { input: ['focus-visible'] },
    variants: {
        // The field's own ring carries the role — the frame is always the
        // ink, so focus is the only place a text field shows colour.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--input-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { input: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-2xs) var(--space-xs)' } } },
            sm: { input: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-xs) var(--space-sm)' } } },
            // `md` is the un-attributed render: the base already IS the
            // middle step.
            md: {},
            lg: { input: { base: { fontSize: 'var(--text-sm)', padding: 'var(--space-md) var(--space-lg)' } } },
            xl: { input: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-lg) var(--space-xl)' } } },
        },
    },
};

/** The same slab, taller, drawn on the element — see the textarea anatomy. */
export const textarea: RecipeInput = {
    component: 'textarea',
    tokens: { '--textarea-accent': 'var(--color-primary)' },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-xs)' },
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        },
        label: {
            base: { ...label, fontSize: 'var(--text-xs)' },
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
                minWidth: '0',
                appearance: 'none',
                ...inked,
                boxShadow: 'var(--shadow-xs)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
                lineHeight: 'var(--leading-normal)',
                padding: 'var(--space-sm) var(--space-md)',
                resize: 'vertical',
            },
            states: {
                invalid: { borderColor: 'var(--color-error)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                readonly: {},
                required: {},
                'focus-visible': { ...focusRing['focus-visible'], outline: 'var(--border) solid var(--textarea-accent)' },
            },
            selectors: {
                '&::placeholder': { color: 'color-mix(in oklab, var(--color-base-content) 55%, transparent)', textTransform: 'uppercase' },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--textarea-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { textarea: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-2xs) var(--space-xs)' } } },
            sm: { textarea: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-xs) var(--space-sm)' } } },
            md: {},
            lg: { textarea: { base: { fontSize: 'var(--text-sm)', padding: 'var(--space-md) var(--space-lg)' } } },
            xl: { textarea: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-lg) var(--space-xl)' } } },
        },
    },
};

// ── Content tier (#311) ───────────────────────────────────────────────────
/** A card is a slab: the ink frame, the hard shadow, square corners. */
export const card: RecipeInput = {
    component: 'card',
    tokens: { '--card-pad': 'var(--space-lg)', '--card-accent': 'var(--color-base-content)' },
    parts: {
        root: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                ...inked,
                boxShadow: 'var(--shadow-md)',
                borderBlockStartWidth: 'calc(var(--border) * 2)',
                borderBlockStartColor: 'var(--card-accent)',
            },
        },
        header: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2xs)',
                padding: 'var(--card-pad) var(--card-pad) 0',
                borderBlockEnd: 'var(--border) solid var(--color-base-content)',
                paddingBlockEnd: 'var(--space-sm)',
            },
        },
        title: {
            base: { margin: '0', ...label, fontSize: 'var(--text-md)', lineHeight: 'var(--leading-tight)' },
        },
        description: {
            base: {
                margin: '0',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wide)',
            },
        },
        body: {
            base: {
                padding: 'var(--card-pad)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
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
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--card-accent': `var(--color-${c})`,
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

/** An alert is a stamped notice: the role as a solid block on the reading edge. */
export const alert: RecipeInput = {
    component: 'alert',
    tokens: { '--alert-accent': 'var(--color-primary)' },
    parts: {
        root: {
            base: {
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'start',
                gap: 'var(--space-xs) var(--space-md)',
                ...inked,
                boxShadow: 'var(--shadow-xs)',
                borderInlineStartWidth: 'calc(var(--border) * 4)',
                borderInlineStartColor: 'var(--alert-accent)',
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
                fontSize: 'var(--text-md)',
                lineHeight: 'var(--leading-none)',
            },
        },
        title: {
            base: { ...label, fontSize: 'var(--text-xs)', lineHeight: 'var(--leading-tight)' },
        },
        description: {
            base: {
                gridColumn: '2',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
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
                ...label,
                fontSize: 'var(--text-xs)',
                padding: 'var(--space-2xs)',
                cursor: 'pointer',
                transition: motion('background, transform'),
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': {
                    background: 'var(--color-base-200)',
                    transform: 'translate(1px, 1px)',
                },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
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

/** A badge is a stamp: square corners, full ink frame, mono uppercase. */
export const badge: RecipeInput = {
    component: 'badge',
    tokens: { '--badge-fill': 'var(--color-base-200)', '--badge-ink': 'var(--color-base-content)' },
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375em',
                background: 'var(--badge-fill)',
                color: 'var(--badge-ink)',
                border: 'var(--border) solid var(--color-base-content)',
                borderRadius: '0',
                padding: '0 var(--space-sm)',
                ...label,
                fontSize: 'var(--text-xs)',
                lineHeight: 'var(--leading-normal)',
                whiteSpace: 'nowrap',
                textDecoration: 'none',
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--badge-fill': `var(--color-${c})`,
            '--badge-ink': `var(--color-${c}-content)`,
        } } }])),
        size: {
            xs: { root: { base: { fontSize: 'var(--text-xs)', padding: '0 var(--space-xs)' } } },
            sm: { root: { base: { fontSize: 'var(--text-xs)', padding: '0 var(--space-sm)' } } },
            md: {},
            lg: { root: { base: { fontSize: 'var(--text-sm)', padding: '0 var(--space-md)' } } },
            xl: { root: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-2xs) var(--space-lg)' } } },
        },
    },
};

/** A rule, at slab weight — this identity has no hairlines. */
export const divider: RecipeInput = {
    component: 'divider',
    tokens: { '--divider-ink': 'var(--color-base-content)', '--divider-thickness': 'calc(var(--border) * 2)' },
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
            sm: { root: { base: { '--divider-thickness': 'calc(var(--border) * 2)' } } },
            md: {},
            lg: { root: { base: { '--divider-thickness': 'calc(var(--border) * 3)' } } },
            xl: { root: { base: { '--divider-thickness': 'calc(var(--border) * 4)' } } },
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
    tokens: { '--skeleton-fill': 'var(--color-base-200)' },
    parts: {
        root: {
            base: { borderRadius: 'var(--radius-box)' },
            states: {
                loading: {
                    color: 'transparent',
                    background: 'var(--skeleton-fill)',
                    animation: 'zero-brutalist-skeleton 1.6s ease-in-out infinite',
                    userSelect: 'none',
                    pointerEvents: 'none',
                    border: 'var(--border) solid var(--color-base-content)',
                    borderRadius: '0',
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
            xs: { root: { base: { borderRadius: '0' } } },
            sm: { root: { base: { borderRadius: '0' } } },
            md: {},
            lg: { root: { base: { borderRadius: '0' } } },
            xl: { root: { base: { borderRadius: '0' } } },
        },
    },
    keyframes: { 'zero-brutalist-skeleton': 'from, to { opacity: 1; } 50% { opacity: 0.6; }' },
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
        '--spinner-track': 'var(--color-base-content)',
    },
    parts: {
        root: {
            base: {
                display: 'inline-block',
                inlineSize: 'var(--spinner-size)',
                blockSize: 'var(--spinner-size)',
                boxSizing: 'border-box',
                // Square, and it turns in STEPS — this identity has no circles
                // and no easing, so the spinner ticks like a mechanism rather
                // than gliding.
                borderRadius: '0',
                border: 'calc(var(--border) * 2) solid var(--spinner-track)',
                borderBlockStartColor: 'var(--spinner-ink)',
                animation: 'zero-brutalist-spin 0.8s steps(8, end) infinite',
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
    keyframes: { 'zero-brutalist-spin': 'to { transform: rotate(360deg); }' },
};

// ── The content-tier sweep (#334) ─────────────────────────────────────────
/**
 * Kbd — the keycap as a stamped block: the full 2px frame and a hard offset
 * shadow, so the key looks like the movable type this identity is set in.
 */
export const kbd: RecipeInput = {
    component: 'kbd',
    tokens: { '--kbd-fill': 'var(--color-base-100)', '--kbd-ink': 'var(--color-base-content)' },
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minInlineSize: '1.75em',
                padding: '0 var(--space-sm)',
                background: 'var(--kbd-fill)',
                color: 'var(--kbd-ink)',
                border: 'calc(var(--border) * 2) solid var(--color-base-content)',
                borderRadius: '0',
                boxShadow: 'var(--shadow-xs)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-bold)',
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
            sm: { root: { base: { fontSize: 'var(--text-xs)', padding: '0 var(--space-xs)' } } },
            md: {},
            lg: { root: { base: { fontSize: 'var(--text-sm)', padding: '0 var(--space-md)' } } },
            xl: { root: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-2xs) var(--space-lg)' } } },
        },
    },
};

/**
 * Status — a square, because nothing in this identity is round. The frame is
 * always `base-content` (the `inked` grammar) and colour fills the inside,
 * which keeps the mark ≥3:1 on paper whatever role it wears — and keeps a
 * visible box under `forced-colors`, where the fill drops and the frame
 * stays.
 */
export const status: RecipeInput = {
    component: 'status',
    tokens: {
        '--status-fill': 'var(--color-base-content)',
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
                background: 'var(--status-fill)',
                border: 'calc(var(--border) * 2) solid var(--color-base-content)',
                borderRadius: '0',
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--status-fill': `var(--color-${c})`,
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

/** Stats — a slab: the full frame, slab joins, the value at shout scale. */
export const stats: RecipeInput = {
    component: 'stats',
    tokens: { '--stats-accent': 'var(--color-base-content)' },
    parts: {
        root: {
            base: {
                display: 'flex',
                border: 'calc(var(--border) * 2) solid var(--color-base-content)',
                background: 'var(--color-base-100)',
                boxShadow: 'var(--shadow-sm)',
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
                    borderInlineStart: 'calc(var(--border) * 2) solid var(--color-base-content)',
                },
                '&[data-orientation="vertical"] + &': {
                    borderBlockStart: 'calc(var(--border) * 2) solid var(--color-base-content)',
                },
            },
        },
        title: {
            base: {
                gridColumn: '1',
                ...label,
                fontSize: 'var(--text-xs)',
            },
        },
        value: {
            base: {
                gridColumn: '1',
                fontSize: 'var(--text-3xl)',
                fontWeight: 'var(--weight-bold)',
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

/** Timeline — square markers on a slab axis; the content is a stamped box. */
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
                borderRadius: '0',
                background: 'var(--timeline-accent)',
                border: 'calc(var(--border) * 2) solid var(--color-base-content)',
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
                background: 'var(--color-base-content)',
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
                border: 'calc(var(--border) * 2) solid var(--color-base-content)',
                background: 'var(--color-base-100)',
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

/** Chat — stamped speech blocks: full frame, no rounding anywhere. */
export const chat: RecipeInput = {
    component: 'chat',
    tokens: { '--chat-fill': 'var(--color-base-100)', '--chat-ink': 'var(--color-base-content)' },
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
                padding: 'var(--space-xs) var(--space-md)',
                fontSize: 'var(--text-sm)',
                background: 'var(--chat-fill)',
                color: 'var(--chat-ink)',
                border: 'calc(var(--border) * 2) solid var(--color-base-content)',
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

/** Radial — the gauge: thick arc, slab channel. */
export const radialProgress: RecipeInput = {
    component: 'radial-progress',
    tokens: {
        '--radial-size': 'calc(var(--size-selector) * 16)',
        '--radial-thickness': 'calc(var(--size-selector) * 1.5)',
        '--radial-ink': 'var(--color-base-content)',
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
                    animation: 'zero-brutalist-radial-spin 1.2s linear infinite',
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
                fontWeight: 'var(--weight-bold)',
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
            xs: { root: { base: { '--radial-size': 'calc(var(--size-selector) * 10)', '--radial-thickness': 'calc(var(--size-selector) * 1.5)' } } },
            sm: { root: { base: { '--radial-size': 'calc(var(--size-selector) * 13)', '--radial-thickness': 'calc(var(--size-selector) * 2)' } } },
            md: {},
            lg: { root: { base: { '--radial-size': 'calc(var(--size-selector) * 20)', '--radial-thickness': 'calc(var(--size-selector) * 2.5)' } } },
            xl: { root: { base: { '--radial-size': 'calc(var(--size-selector) * 24)', '--radial-thickness': 'calc(var(--size-selector) * 3)' } } },
        },
    },
    keyframes: { 'zero-brutalist-radial-spin': 'to { transform: rotate(360deg); }' },
};

/**
 * Join — inner corners squared, seams folded to one slab stroke; the joined
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
                    marginInlineStart: 'calc(calc(var(--border) * 2) * -1)',
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
                    marginBlockStart: 'calc(calc(var(--border) * 2) * -1)',
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
 * Navbar — a slab of paper with the double-weight rule under it, the way
 * every brutalist masthead is a heavy line over the content. Colour refills
 * the bar with the role pair; the rule stays ink because the rule is the
 * brand.
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
                borderBlockEnd: 'calc(var(--border) * 2) solid var(--color-base-content)',
                fontWeight: 'var(--weight-bold)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--tracking-wide)',
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
            xs: { root: { base: { paddingBlock: 'var(--space-2xs)', fontSize: 'var(--text-sm)' } } },
            sm: { root: { base: { paddingBlock: 'var(--space-xs)', fontSize: 'var(--text-sm)' } } },
            md: {},
            lg: { root: { base: { paddingBlock: 'var(--space-md)' } } },
            xl: { root: { base: { paddingBlock: 'var(--space-lg)', fontSize: 'var(--text-lg)' } } },
        },
    },
};

/**
 * Breadcrumbs — uppercase mono-weight wayfinding: every crumb underlined
 * the honest way (it IS a link), the current page a solid ink block with
 * no underline. Colour refills the current-page block with the role pair.
 */
export const breadcrumbs: RecipeInput = {
    component: 'breadcrumbs',
    tokens: {
        '--bc-accent': 'var(--color-base-content)',
        '--bc-accent-content': 'var(--color-base-100)',
    },
    parts: {
        root: {
            base: {
                fontSize: 'var(--text-sm)',
                color: 'var(--color-base-content)',
                fontWeight: 'var(--weight-bold)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--tracking-wide)',
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
                color: 'var(--color-base-content)',
                textDecoration: 'underline',
                textDecorationThickness: 'calc(var(--border) * 2)',
                textUnderlineOffset: '0.2em',
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                active: {
                    background: 'var(--bc-accent)',
                    color: 'var(--bc-accent-content)',
                    textDecoration: 'none',
                    padding: '0 var(--space-2xs)',
                },
                inactive: {},
                'focus-visible': {
                    outline: 'calc(var(--border) * 2) solid var(--color-base-content)',
                    outlineOffset: '2px',
                },
            },
        },
        separator: {
            base: {
                color: 'var(--color-base-content)',
                userSelect: 'none',
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--bc-accent': `var(--color-${c})`,
            '--bc-accent-content': `var(--color-${c}-content)`,
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
 * Pagination — stamped tiles: double-weight ink borders, the hard shadow,
 * the current page refilled with the accent pair (ink by default). Pressed
 * collapses the shadow and sinks the tile, the house gesture. Glyphs flip
 * under the rtl guard.
 */
export const pagination: RecipeInput = {
    component: 'pagination',
    tokens: {
        '--pg-accent': 'var(--color-base-content)',
        '--pg-accent-content': 'var(--color-base-100)',
        '--pg-size': 'calc(var(--size-field) * 10)',
        '--pg-font': 'var(--text-sm)',
    },
    parts: {
        root: { base: { display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' } },
        item: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minInlineSize: 'var(--pg-size)',
                blockSize: 'var(--pg-size)',
                paddingInline: 'var(--space-2xs)',
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
                border: 'calc(var(--border) * 2) solid var(--color-base-content)',
                borderRadius: '0',
                boxShadow: 'var(--shadow-sm)',
                fontSize: 'var(--pg-font)',
                fontWeight: 'var(--weight-bold)',
                fontVariantNumeric: 'tabular-nums',
                appearance: 'none',
                cursor: 'pointer',
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                active: {
                    background: 'var(--pg-accent)',
                    color: 'var(--pg-accent-content)',
                },
                inactive: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { boxShadow: 'none', transform: 'translate(3px, 3px)' },
            },
        },
        ellipsis: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minInlineSize: 'var(--pg-size)',
                blockSize: 'var(--pg-size)',
                color: 'var(--color-base-content)',
                fontSize: 'var(--pg-font)',
                fontWeight: 'var(--weight-bold)',
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
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
                border: 'calc(var(--border) * 2) solid var(--color-base-content)',
                borderRadius: '0',
                boxShadow: 'var(--shadow-sm)',
                fontSize: 'calc(var(--pg-font) * 1.2)',
                lineHeight: 'var(--leading-none)',
                appearance: 'none',
                cursor: 'pointer',
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { boxShadow: 'none', transform: 'translate(3px, 3px)' },
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
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
                border: 'calc(var(--border) * 2) solid var(--color-base-content)',
                borderRadius: '0',
                boxShadow: 'var(--shadow-sm)',
                fontSize: 'calc(var(--pg-font) * 1.2)',
                lineHeight: 'var(--leading-none)',
                appearance: 'none',
                cursor: 'pointer',
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { boxShadow: 'none', transform: 'translate(3px, 3px)' },
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
 * Steps — stamped squares on a hard rule: double-weight ink borders, the
 * current square refilled with the accent pair (ink by default), the
 * walked rule thickening to ink. Pressed collapses into the page, the
 * house gesture.
 */
export const steps: RecipeInput = {
    component: 'steps',
    tokens: {
        '--steps-accent': 'var(--color-base-content)',
        '--steps-accent-content': 'var(--color-base-100)',
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
                '&[data-pressed]:not([data-disabled])': { transform: 'translate(2px, 2px)' },
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
                borderRadius: '0',
                fontSize: 'calc(var(--steps-ind) * 0.45)',
                fontWeight: 'var(--weight-semibold)',
                lineHeight: 'var(--leading-none)',
                position: 'relative',
                zIndex: '1',
                flexShrink: '0',
                border: 'calc(var(--border) * 2) solid var(--color-base-content)',
                background: 'var(--color-base-100)',
            },
            states: {
                active: { background: 'var(--steps-accent)', color: 'var(--steps-accent-content)' },
                complete: { background: 'var(--color-base-200)', color: 'var(--color-base-content)', textDecoration: 'line-through' },
                inactive: { background: 'var(--color-base-100)', color: 'var(--color-base-content)' },
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
                fontWeight: 'var(--weight-bold)',
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
 * Drawer — a slab hinged on the page edge: full-weight rule on the inner
 * edge only (the outer edge IS the viewport), no radius anywhere, faded in
 * because nothing in this house glides. Base render is the inline mode;
 * `:modal` is the top-layer edge sheet.
 */
export const drawer: RecipeInput = {
    component: 'drawer',
    parts: {
        trigger: overlayTrigger,
        panel: withPresence(popupPresence('none'), {
            base: {
                padding: 'var(--space-xl)',
                ...inked,
                border: 'var(--border) solid var(--color-base-content)',
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
                },
                '&[data-placement="start"]:modal': {
                    insetInlineStart: '0',
                    insetInlineEnd: 'auto',
                    borderInlineEnd: 'calc(var(--border) * 2) solid var(--color-base-content)',
                },
                '&[data-placement="end"]:modal': {
                    insetInlineStart: 'auto',
                    insetInlineEnd: '0',
                    borderInlineStart: 'calc(var(--border) * 2) solid var(--color-base-content)',
                },
            },
        }),
        backdrop: {
            base: { background: 'oklch(0% 0 0 / 0.55)' },
            states: { open: {}, closed: {} },
        },
        title: {
            base: {
                margin: '0 0 var(--space-md)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-2xl)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-tight)',
                lineHeight: 'var(--leading-none)',
                textTransform: 'uppercase',
            },
        },
        close: {
            base: {
                appearance: 'none',
                ...inked,
                ...label,
                fontSize: 'var(--text-xs)',
                padding: 'var(--space-sm) var(--space-lg)',
                boxShadow: 'var(--shadow-xs)',
                cursor: 'pointer',
            },
            states: { hover: shift('1px'), disabled: {}, ...focusRing },
        },
    },
    // Trigger-carried axes — see `overlayTriggerColors`.
    variants: { color: overlayTriggerColors(), size: overlayTriggerSizes },
};

/**
 * Table — a brutalist grid: the thick border and hard shadow on the scroll
 * box, mono uppercase headers over a heavy head rule, and a selected row
 * that INVERTS into the accent (fill + its `-content` ink) rather than
 * tinting. Zebra and hover shade with base-200; both yield to selection.
 */
export const table: RecipeInput = {
    component: 'table',
    tokens: {
        '--table-accent': 'var(--color-base-content)',
        '--table-accent-ink': 'var(--color-base-100)',
        '--table-pad-block': 'var(--space-sm)',
        '--table-pad-inline': 'var(--space-md)',
        '--table-font': 'var(--text-sm)',
    },
    parts: {
        root: {
            base: {
                overflowX: 'auto',
                border: 'calc(var(--border) * 2) solid var(--color-base-content)',
                background: 'var(--color-base-100)',
                boxShadow: 'var(--shadow-sm)',
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
                ...label,
                fontSize: 'var(--text-xs)',
            },
        },
        head: {
            base: { borderBlockEnd: 'calc(var(--border) * 2) solid var(--color-base-content)' },
        },
        body: {},
        foot: {
            base: {
                borderBlockStart: 'calc(var(--border) * 2) solid var(--color-base-content)',
                fontSize: 'var(--text-xs)',
            },
        },
        row: {
            base: { borderBlockEnd: 'var(--border) solid var(--color-base-content)' },
            states: {
                selected: {
                    background: 'var(--table-accent)',
                    color: 'var(--table-accent-ink)',
                },
            },
        },
        'header-cell': {
            base: {
                padding: 'var(--table-pad-block) var(--table-pad-inline)',
                textAlign: 'start',
                ...label,
                fontSize: 'var(--text-xs)',
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
            '--table-accent': `var(--color-${c})`,
            '--table-accent-ink': `var(--color-${c}-content)`,
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
                        background: 'var(--color-base-200)',
                    },
                },
            },
        },
        hover: {
            row: {
                selectors: {
                    '[data-scope="table"][data-part="body"] > &:hover:not([data-selected])': {
                        background: 'var(--color-base-200)',
                    },
                },
            },
        },
    },
};

/**
 * FileUpload — brutalism does not whisper about drops: the dropzone is a
 * thick dashed slab that slams to the accent (fill + `-content` ink) while
 * a drag hovers, the trigger is an inked slab that shoves into its own
 * shadow, and the items are bordered rows with mono metadata.
 */
export const fileUpload: RecipeInput = {
    component: 'file-upload',
    tokens: {
        '--fu-accent': 'var(--color-base-content)',
        '--fu-accent-ink': 'var(--color-base-100)',
        '--fu-pad': 'var(--space-lg)',
        '--fu-font': 'var(--text-sm)',
    },
    parts: {
        root: {
            base: { display: 'grid', gap: 'var(--space-sm)', justifyItems: 'start' },
        },
        label: {
            base: { ...label, fontSize: 'var(--text-xs)' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
        },
        trigger: {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-xs)',
                padding: 'var(--space-sm) var(--space-lg)',
                ...label,
                fontSize: 'var(--fu-font)',
                lineHeight: 'var(--leading-none)',
                color: 'var(--color-base-content)',
                background: 'var(--color-base-100)',
                border: 'var(--border) solid var(--color-base-content)',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer',
            },
            states: {
                hover: shift('1px'),
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed', boxShadow: 'none' },
                invalid: { borderColor: 'var(--color-error)', color: 'var(--color-error)' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { ...shift('2px'), transition: 'none' },
            },
        },
        dropzone: {
            base: {
                justifySelf: 'stretch',
                padding: 'var(--fu-pad)',
                textAlign: 'center',
                ...label,
                fontSize: 'var(--fu-font)',
                color: 'var(--color-base-content)',
                border: 'calc(var(--border) * 2) dashed var(--color-base-content)',
                background: 'var(--color-base-100)',
                cursor: 'pointer',
            },
            states: {
                highlighted: {
                    borderStyle: 'solid',
                    background: 'var(--fu-accent)',
                    color: 'var(--fu-accent-ink)',
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
                border: 'var(--border) solid var(--color-base-content)',
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
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                fontVariantNumeric: 'tabular-nums',
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
            },
        },
        'item-remove': {
            base: {
                appearance: 'none',
                border: 'var(--border) solid var(--color-base-content)',
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
                padding: 'var(--space-2xs) var(--space-xs)',
                ...label,
                fontSize: 'var(--text-xs)',
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--fu-accent': `var(--color-${c})`,
            '--fu-accent-ink': `var(--color-${c}-content)`,
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
 * Carousel — the viewport is a bordered slab, the nav triggers are inked
 * squares that shove into their own shadow, and the dots are square:
 * hollow resting, slammed to the accent when active. Nothing rounds.
 */
export const carousel: RecipeInput = {
    component: 'carousel',
    tokens: {
        '--carousel-accent': 'var(--color-base-content)',
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
                border: 'calc(var(--border) * 2) solid var(--color-base-content)',
                background: 'var(--color-base-100)',
            },
            selectors: {
                // The viewport is a tab stop (scrollable-region-focusable) and
                // owes the keyboard user a ring. Real :focus-visible — no
                // runtime flag exists on this part.
                '&:focus-visible': { outline: 'var(--border) solid var(--color-primary)', outlineOffset: '3px' },
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
                ...label,
                fontSize: 'var(--text-xs)',
                lineHeight: 'var(--leading-none)',
                color: 'var(--color-base-content)',
                background: 'var(--color-base-100)',
                border: 'var(--border) solid var(--color-base-content)',
                boxShadow: 'var(--shadow-xs)',
                cursor: 'pointer',
                zIndex: '1',
            },
            states: {
                hover: shift('1px'),
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed', boxShadow: 'none' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { ...shift('2px'), transition: 'none' },
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
                ...label,
                fontSize: 'var(--text-xs)',
                lineHeight: 'var(--leading-none)',
                color: 'var(--color-base-content)',
                background: 'var(--color-base-100)',
                border: 'var(--border) solid var(--color-base-content)',
                boxShadow: 'var(--shadow-xs)',
                cursor: 'pointer',
                zIndex: '1',
            },
            states: {
                hover: shift('1px'),
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed', boxShadow: 'none' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { ...shift('2px'), transition: 'none' },
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
                    border: 'var(--border) solid var(--color-base-content)',
                    borderRadius: '0',
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
            '--carousel-accent': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--carousel-dot': '0.375rem', '--carousel-nav': '1.5rem' } } },
            sm: { root: { base: { '--carousel-dot': '0.5rem', '--carousel-nav': '1.75rem' } } },
            md: {},
            lg: { root: { base: { '--carousel-dot': '0.75rem', '--carousel-nav': '2.5rem' } } },
            xl: { root: { base: { '--carousel-dot': '0.875rem', '--carousel-nav': '3rem' } } },
        },
    },
};

/**
 * Swap — no tween at all: `--ease-standard` is `steps(2, end)`, so even
 * the declared transition lands as a hard cut. That IS the brief; the
 * reduced-motion block just makes the cut explicit.
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
 * change — and even that entry lands as a hard two-step cut; a loop never exists, and reduced motion
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
                animation: 'zero-brutalist-countdown-in 0.2s steps(2, end)',
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
    keyframes: { 'zero-brutalist-countdown-in': 'from { transform: translateY(0.5em); opacity: 0; }' },
};

/**
 * Diff — a thick black divider and a SQUARE grip slab; pressed inverts
 * to the accent. Nothing rounds, nothing fades.
 */
export const diff: RecipeInput = {
    component: 'diff',
    tokens: {
        '--diff-accent': 'var(--color-base-content)',
        '--diff-grip': '1.5rem',
        '--diff-hit': '2rem',
    },
    parts: {
        root: {
            base: {
                display: 'grid',
                overflow: 'hidden',
                background: 'var(--color-base-100)',
                border: 'calc(var(--border) * 2) solid var(--color-base-content)',
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
                pressed: { '--diff-accent': 'var(--color-primary)' },
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
                    borderRadius: '0',
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
