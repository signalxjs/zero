/**
 * zero-daisyui recipes — daisyUI's component look expressed against the
 * zero anatomy. Pure data; compiled to CSS by build.mjs. The point of this
 * package: a design system is data, and "looks like daisy" is one possible
 * value of that data.
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

const focusRing: Record<string, NonNullable<PartStyles['base']>> = {
    'focus-visible': {
        outline: '2px solid var(--color-base-content)',
        outlineOffset: '2px',
    },
};

/**
 * How far each role survives in the button's INK — the colour a transparent or
 * tinted fill draws its label, border and focus ring with.
 *
 * A raw role token is a FILL colour: it is contrast-validated against its own
 * `-content` pair and against nothing else. Used as ink on a base surface it
 * has no floor at all, and daisy's palettes prove it — `neutral` is a dark grey
 * in all three dark themes (1.12–1.22:1 on `base-100`, 1.11–1.18 on its own
 * `-soft`) and `accent` a pale teal in light and nord (1.63–1.83). That is
 * #210: the `outline`, `soft` and `ghost` cells rendered as empty boxes.
 *
 * The mix partner is `--color-base-content`, NOT the role's own `-content`.
 * `ratingFill` (below) deepens toward `-content` and its comment says why that
 * cannot generalise: "deepening toward `-content` helps a light theme and hurts
 * a dark one" — because `-content` is the pole opposite the ROLE, which in a
 * dark theme means darker, straight into a dark `base-100`. `base-content` is
 * by construction the pole opposite the SURFACE, so the same percentage lightens
 * on dark themes and darkens on light ones. One number per role then holds
 * across all five themes.
 *
 * Per role, and each the gentlest 5% step that clears 3:1 — the same rule
 * `progressFill` and `RATING_DEEPEN` follow. Measured through Chromium's own
 * canvas (the technique `contrast-audit.spec.ts` uses, so gamut mapping matches
 * what is painted): 5 themes × 8 roles × {base-100, base-200, base-300, the
 * role's `-soft`, and `-soft` under the hover `brightness(.95)`} = 200 cells,
 * all ≥3:1, worst 3.10 (nord `secondary` on `base-300`).
 *
 * One 5% step gentler puts five of the eight under the floor — `primary` 2.98,
 * `secondary` 2.87, `accent` 2.96, `neutral` 2.87, `success` 2.97 — and leaves
 * the other three sitting on it with nothing to spare (`info` 3.00, `error`
 * 3.03, `warning` 3.04). Every one of those worst cells is nord on `base-300`
 * except `neutral`'s, which is dim's own `-soft` under the hover brightness.
 *
 * `primary` keeps 95% because raw already sat at 2.98 — a nudge, not a repaint.
 * `neutral` keeps 40% because a role whose fill is a near-surface grey has
 * nowhere else to go.
 *
 * `error` USED to keep 95% for the same reason as `primary` (raw sat at 3.03),
 * and no longer can: correcting the palette to daisyUI 5.7.8's own values
 * (#231) moved light's `error` from `oklch(63.72% 0.237 25.33)` to
 * `oklch(71% 0.194 13.428)` — lighter and less saturated — which took the raw
 * ink to 2.75:1 on its own `soft` fill. 85% is the gentlest step that clears,
 * at 3.31:1, which puts it in the same band as every other role here
 * (3.25–3.85). 90% reaches only 3.01, sitting on the floor with nothing to
 * spare.
 *
 * Verified again on the compiled output rather than the tokens: the emitted
 * CSS rendered in all five themes, 4 variants × 8 roles, gives 160 label cells
 * and 40 `outline` borders with none under 3:1, worst 3.23 (nord / `soft` /
 * `primary`). Before: 35 labels and 11 borders under, worst 1.11.
 *
 * This is the ad-hoc `color-mix` #126 describes: the contract has no name for
 * "this role's muted ink", so every design system invents one. When #126 lands,
 * this map is what it replaces — which is also why it is named for the JOB
 * rather than for the button: the four error-text sites below read the same
 * definition, and a second hand-tuned copy of it is precisely what #126 exists
 * to stop.
 */
/**
 * Keyed on the DECLARED roles, so a typo here is a build error rather than a
 * silent fall through to the default — and optional, so the `?? 55` below is a
 * real branch the type system can see rather than dead code. It stays optional
 * because `roleInk` is also reachable for a role this map has no opinion on.
 */
const ROLE_INK_KEEP: { [K in keyof typeof roles]?: number } = {
    primary: 95, secondary: 70, accent: 55, neutral: 40,
    info: 70, success: 55, warning: 45, error: 85,
};

const roleInk = (role: string): string =>
    `color-mix(in oklab, var(--color-${role}) `
    + `${ROLE_INK_KEEP[role as keyof typeof roles] ?? 55}%, var(--color-base-content))`;

// daisy "tabs-box" flavor: a rounded container, lifted active tab.
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

/**
 * daisy's three tab flavors (#377): `tabs-border` — daisy's own default look,
 * an underline under the active tab — plus `tabs-lift` (bordered tab lifting
 * out of a baseline) and `tabs-box` (list on a base-200 surface, active tab a
 * raised base-100 pill). All three ported from daisyUI 5.5.19
 * `components/tab.css`.
 *
 * The base holds only flavor-neutral structure. Every flavor's chrome —
 * including the box surface this recipe used to keep in `parts` — lives in
 * its own `variant` entry, because the web emitter twins the DEFAULT value's
 * rules as `:not([data-variant])`: a default that leaned on base styles would
 * leak them into the other two flavors, and the box chrome in base is exactly
 * what `variant="border"` must not inherit.
 *
 * Sizing goes through a `--tab-py`/`--tab-px` pair rather than a literal
 * `padding` per size — daisy's own mechanism (`--tab-p`/`--tab-paddings` in
 * tab.css). It is what lets `lift` move `var(--border)` between border and
 * padding without restating the size ramp per flavor: axis rules all target
 * the same part with equal specificity, so a `lift` padding literal would
 * either lose to or beat the size axis by source order alone.
 *
 * variant × color: `color` paints the active tab's INK (`roleInk`, not the
 * raw role — #210: raw roles are fill colours with no contrast floor as ink).
 * `border`'s underline and `lift`'s label follow it via `currentColor`;
 * `box` is the one flavor where daisy fills the active pill with the role
 * (`checked:bg-primary checked:text-primary-content` in its docs), so a
 * compound per role restores the fill+`-content` pair there.
 */
export const tabs: RecipeInput = {
    component: 'tabs',
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' },
        },
        list: {
            base: {
                display: 'inline-flex',
                alignSelf: 'flex-start',
            },
        },
        tab: {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                '--tab-py': 'var(--space-sm)',
                '--tab-px': 'var(--space-xl)',
                // daisy's per-size underline/corner cap: `--tab-radius-min`
                // in tab.css, `calc(.75rem - var(--border))` at md. Declared
                // here (not in `lift`, its only reader) so the size axis can
                // override it — a definition inside the variant entry would
                // beat the size rules on source order.
                '--tab-radius-min': 'calc(0.75rem - var(--border))',
                padding: 'var(--tab-py) var(--tab-px)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
                color: 'color-mix(in oklab, var(--color-base-content) 60%, transparent)',
                cursor: 'pointer',
                // For the flavors' ::before marks (border's underline, lift's
                // corner shoulders) — daisy's base `.tab` is `position:
                // relative` for the same reason.
                position: 'relative',
                transition: 'background var(--duration-normal) var(--ease-standard), color var(--duration-normal) var(--ease-standard)',
            },
            states: {
                hover: { color: 'var(--color-base-content)' },
                // Full-strength ink is the one active mark all three flavors
                // share; each flavor's own chrome (underline, lift, pill)
                // lives in its `variant` entry.
                active: { color: 'var(--color-base-content)' },
                inactive: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
        },
        panel: {
            base: { fontSize: 'var(--text-md)' },
            states: { active: {}, inactive: {} },
        },
    },
    variants: {
        size: {
            xs: { tab: { base: { fontSize: 'var(--text-xs)', '--tab-py': 'var(--space-2xs)', '--tab-px': 'var(--space-md)', '--tab-radius-min': 'calc(0.5rem - var(--border))' } } },
            sm: { tab: { base: { fontSize: 'var(--text-xs)', '--tab-py': 'var(--space-xs)', '--tab-px': 'var(--space-lg)', '--tab-radius-min': 'calc(0.5rem - var(--border))' } } },
            // `md` is the un-attributed render: the base already IS the
            // middle step, so restating it here would be a second copy free
            // to drift. An empty entry emits no rule and keeps the base.
            md: {},
            lg: { tab: { base: { fontSize: 'var(--text-md)', '--tab-py': 'var(--space-md)', '--tab-px': 'var(--space-2xl)', '--tab-radius-min': 'calc(1.5rem - var(--border))' } } },
            xl: { tab: { base: { fontSize: 'var(--text-lg)', '--tab-py': 'var(--space-lg)', '--tab-px': 'var(--space-2xl)', '--tab-radius-min': 'calc(2rem - var(--border))' } } },
        },
        // Every role, not just primary. `data-color` passes through whatever a
        // consumer sets, so a one-role axis made `<Tabs.Root color="success">`
        // type-check, emit the attribute, and match nothing — the tab just
        // stayed primary with no diagnostic anywhere.
        //
        // The role lands as the active tab's INK — `border`'s underline and
        // everything drawn `currentColor` follow it for free. `box` refines
        // this per role through `compoundVariants` below (fill + `-content`).
        color: Object.fromEntries(
            ROLES.map((c) => [
                c,
                {
                    tab: {
                        states: {
                            active: { color: roleInk(c) },
                        },
                    },
                },
            ]),
        ),
        variant: {
            // daisy `.tabs-border`: an always-present ::before bar under each
            // tab — transparent at rest (daisy reaches transparent through an
            // invalid-at-computed-value-time 4-value custom property; the
            // rendered result is the same), currentColor + a 3px top border
            // when active. The border is daisy's forced-colors survival for a
            // background-painted mark, kept verbatim so the bar's geometry
            // matches daisy's exactly.
            border: {
                tab: {
                    base: { borderRadius: 'var(--radius-field)' },
                    selectors: {
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            bottom: '0',
                            insetInlineStart: '10%',
                            width: '80%',
                            // daisy renders under Tailwind preflight, whose
                            // `*,::before,::after { box-sizing: border-box }`
                            // makes the active `border-top: 3px` swallow the
                            // 3px height rather than stack on it. zero ships
                            // no such reset, so the bar carries the one
                            // declaration itself — without it the active
                            // underline doubles to 6px (review catch).
                            boxSizing: 'border-box',
                            height: '3px',
                            borderRadius: 'var(--radius-field)',
                            backgroundColor: 'transparent',
                            transition: 'background-color var(--duration-normal) var(--ease-standard)',
                        },
                        '&[data-state="active"]:not([data-disabled])::before': {
                            backgroundColor: 'currentColor',
                            borderTop: '3px solid',
                        },
                    },
                },
            },
            // daisy `.tabs-lift`: every tab sits on a base-300 baseline; the
            // active one swaps that bottom hairline for top/side borders, a
            // base-100 fill, rounded top corners, and the radial-gradient
            // "shoulders" that curve its bottom corners outward into the
            // baseline. Widths and paddings trade `var(--border)` exactly as
            // daisy's `--tab-border`/`--tab-paddings` do, so activating a tab
            // never changes its box size.
            lift: {
                tab: {
                    base: {
                        '--tab-radius-limit': 'min(var(--radius-field), var(--tab-radius-min))',
                        borderStartStartRadius: 'var(--tab-radius-limit)',
                        borderStartEndRadius: 'var(--tab-radius-limit)',
                        borderWidth: '0 0 var(--border) 0',
                        borderStyle: 'solid',
                        borderColor: 'var(--color-base-300)',
                        padding: 'calc(var(--tab-py) + var(--border)) var(--tab-px) var(--tab-py)',
                    },
                    states: {
                        active: {
                            background: 'var(--color-base-100)',
                            borderWidth: 'var(--border) var(--border) 0 var(--border)',
                            padding: 'var(--tab-py) calc(var(--tab-px) - var(--border)) calc(var(--tab-py) + var(--border))',
                        },
                    },
                    selectors: {
                        '&[data-state="active"]::before': {
                            // daisy's `--tab-radius-grad` stop list:
                            // transparent inside the corner arc, a base-300
                            // ring of the border's width, base-100 outside.
                            // Declared here rather than on the tab: every
                            // shoulder rule below styles this same
                            // pseudo-element, so they all read it — and on
                            // lynx it drops with the ::before selector
                            // instead of surviving as a dead declaration.
                            '--tab-grad': '#0000 calc(69% - var(--border)), var(--color-base-300) calc(69% - var(--border) + 0.25px), var(--color-base-300) 69%, var(--color-base-100) calc(69% + 0.25px)',
                            content: '""',
                            position: 'absolute',
                            zIndex: '1',
                            bottom: '0',
                            // daisy centres the shoulders through the flex
                            // static position; an explicit symmetric overhang
                            // of one corner radius per side is the same
                            // geometry without needing the tab to be a flex
                            // container.
                            insetInlineStart: 'calc(var(--tab-radius-limit) * -1)',
                            width: 'calc(100% + var(--tab-radius-limit) * 2)',
                            height: 'var(--tab-radius-limit)',
                            backgroundImage: 'radial-gradient(circle at top left, var(--tab-grad)), radial-gradient(circle at top right, var(--tab-grad))',
                            backgroundPosition: 'top left, top right',
                            backgroundSize: 'var(--tab-radius-limit) var(--tab-radius-limit)',
                            backgroundRepeat: 'no-repeat',
                        },
                        // No shoulder past the row's edges — daisy's
                        // `--radius-start: none` / `--radius-end: none` on
                        // first/last, both suppressed for an only tab.
                        '&[data-state="active"]:first-child::before': {
                            backgroundImage: 'none, radial-gradient(circle at top right, var(--tab-grad))',
                        },
                        '&[data-state="active"]:last-child::before': {
                            backgroundImage: 'radial-gradient(circle at top left, var(--tab-grad)), none',
                        },
                        '&[data-state="active"]:only-child::before': {
                            backgroundImage: 'none',
                        },
                        // The gradients' corners are physical; when one side
                        // is suppressed the image is asymmetric, so RTL needs
                        // daisy's mirror on exactly the first/last tabs.
                        [`&[data-state="active"]:first-child${rtl}::before`]: {
                            transform: 'rotateY(180deg)',
                        },
                        [`&[data-state="active"]:last-child${rtl}::before`]: {
                            transform: 'rotateY(180deg)',
                        },
                    },
                },
            },
            // daisy `.tabs-box`: the styles this recipe shipped as its only
            // look, moved verbatim out of `parts` — list on a padded base-200
            // surface, active tab a raised base-100 pill.
            box: {
                list: {
                    base: {
                        padding: 'var(--space-xs)',
                        gap: 'var(--space-xs)',
                        background: 'var(--color-base-200)',
                        borderRadius: 'var(--radius-field)',
                    },
                },
                tab: {
                    base: { borderRadius: 'calc(var(--radius-field) - 0.25rem)' },
                    states: {
                        active: {
                            background: 'var(--color-base-100)',
                            boxShadow: 'var(--shadow-sm)',
                        },
                    },
                },
            },
        },
    },
    // box × color: daisy's box flavor fills the active pill with the role and
    // flips the label to `-content` — the fill+pair form is contrast-safe by
    // construction, so the raw role is right here (unlike the ink the single-
    // axis rule paints). Emitted after the single-axis rules, so it wins the
    // `color` tie on source order.
    compoundVariants: ROLES.map((c) => ({
        match: { variant: 'box', color: c },
        parts: {
            tab: {
                states: {
                    active: {
                        background: `var(--color-${c})`,
                        color: `var(--color-${c}-content)`,
                    },
                },
            },
        },
    })),
    // `md: {}` emits nothing — it states the size default for the manifest
    // (signalxjs/lynx#1070). `border` is daisy's own default tab look, and a
    // DELIBERATE web visual change (#377): the un-attributed render used to
    // be the box pill. Deliberately no `color` default: the un-attributed
    // active ink is base-content, outside the color vocabulary.
    defaultVariants: { size: 'md', variant: 'border' },
    targets: {
        lynx: {
            parts: {
                // The default active ink — base-content, exactly what the
                // shared `states.active.color` paints. One class, so any
                // color-axis definition below (host + two classes, baked per
                // theme) wins on specificity.
                tab: { base: { '--tab-active-ink': 'var(--color-base-content)' } },
            },
            variants: {
                // `currentColor` never resolves on lynx (measured on device
                // on both platforms, signalxjs/lynx#1079 — the underline was
                // transparent everywhere), so the color axis restates its
                // active ink as a plain custom property. `roleInk` reads
                // theme colors through color-mix(), which the emitter bakes
                // once per theme — the same per-color/per-theme literal the
                // active `color:` rules already land as.
                color: Object.fromEntries(
                    ROLES.map((c) => [c, { tab: { base: { '--tab-active-ink': roleInk(c) } } }]),
                ),
                variant: {
                    // The underline is a ::before on the web, which lynx
                    // drops — redrawn as a real bottom border on the tab
                    // itself (transparent at rest so activation never moves
                    // the row). The active ink rides `--tab-active-ink`
                    // above — a plain var() chain, device-proven — instead
                    // of `currentColor`, which lynx never resolves.
                    border: {
                        tab: {
                            base: { borderBottom: '3px solid transparent' },
                            states: { active: { borderBottomColor: 'var(--tab-active-ink)' } },
                        },
                    },
                    // `min()` does not exist on lynx (signalxjs/lynx#1066) and
                    // the shared `--tab-radius-limit` would drop, leaving its
                    // readers dangling — the uncapped field radius is the
                    // closest expressible value.
                    lift: {
                        tab: {
                            base: { '--tab-radius-limit': 'var(--radius-field)' },
                        },
                    },
                },
            },
        },
    },
};

/**
 * The disclosure size ramp collapsible and accordion share (#321): the same
 * trigger/panel geometry, so the same steps — padding plus type, daisy's
 * "size moves the box" rule, never ink. `md` is the un-attributed render.
 */
const disclosureSizes: Record<string, Record<string, PartStyles>> = {
    xs: {
        trigger: { base: { padding: 'var(--space-md) var(--space-lg)', fontSize: 'var(--text-sm)' } },
        panel: { base: { padding: '0 var(--space-lg) var(--space-md)', fontSize: 'var(--text-sm)' } },
    },
    sm: {
        trigger: { base: { padding: 'var(--space-lg) var(--space-xl)', fontSize: 'var(--text-sm)' } },
        panel: { base: { padding: '0 var(--space-xl) var(--space-lg)', fontSize: 'var(--text-sm)' } },
    },
    md: {},
    lg: {
        trigger: { base: { padding: 'var(--space-2xl) var(--space-2xl)', fontSize: 'var(--text-lg)' } },
        panel: { base: { padding: '0 var(--space-2xl) var(--space-2xl)', fontSize: 'var(--text-md)' } },
    },
    xl: {
        trigger: { base: { padding: 'var(--space-2xl) var(--space-2xl)', fontSize: 'var(--text-xl)' } },
        panel: { base: { padding: '0 var(--space-2xl) var(--space-2xl)', fontSize: 'var(--text-lg)' } },
    },
};

// daisy "collapse collapse-arrow" flavor.
export const collapsible: RecipeInput = {
    component: 'collapsible',
    // The accent is the open heading's INK, so the default is base-content —
    // the un-attributed render stays exactly daisy's neutral collapse and a
    // role only arrives through `data-color`.
    tokens: { '--collapsible-accent': 'var(--color-base-content)' },
    parts: {
        root: withPresence(disclosurePresence, {
            base: {
                border: 'var(--border) solid var(--color-base-300)',
                borderRadius: 'var(--radius-box)',
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
                overflow: 'hidden',
            },
            states: { open: {}, closed: {} },
        }),
        trigger: {
            base: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-xl) var(--space-2xl)',
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--weight-semibold)',
            },
            states: {
                // With the default accent this is a no-op ink (base-content on
                // base-content) — the rule exists so `data-color` has a state
                // to land on.
                open: { color: 'var(--collapsible-accent)' },
                closed: {},
                hover: { background: 'var(--color-base-200)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
                ...focusRing,
            },
            selectors: {
                '&::after': {
                    content: '""',
                    width: '0.5rem',
                    height: '0.5rem',
                    border: '2px solid currentColor',
                    borderTop: 'none',
                    borderLeft: 'none',
                    transform: 'rotate(45deg)',
                    transition: 'transform var(--duration-normal) var(--ease-standard)',
                    opacity: '0.6',
                },
                '&[data-state="open"]::after': {
                    transform: 'rotate(225deg)',
                },
            },
        },
        panel: {
            base: { padding: '0 var(--space-2xl) var(--space-xl)', fontSize: 'var(--text-md)' },
            states: { open: {}, closed: {} },
        },
    },
    variants: {
        // The open heading's ink per role, through `roleInk` — a raw role
        // token is a fill colour, not an ink (#210), and the mix is the map
        // measured against all five daisy themes.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--collapsible-accent': roleInk(c),
        } } }])),
        size: disclosureSizes,
    },
    // Size only: `md: {}` emits nothing, so no CSS changes — manifest fact for
    // signalxjs/lynx#1070. No `color` default: the un-attributed accent is
    // base-content ink, outside the color vocabulary.
    defaultVariants: { size: 'md' },
};

// daisy "toggle" flavor.
export const switchRecipe: RecipeInput = {
    component: 'switch',
    /**
     * daisy drives the whole toggle off ONE size, exactly as it drives the
     * checkbox: `--size` is the height, the padding is a fixed eighth of it,
     * and the WIDTH is derived — `(size × 2) − (border + pad) × 2`. Declaring
     * width and height independently (as this recipe used to) puts the knob's
     * travel and the box's proportions out of daisy's lockstep.
     *
     * `--switch-ink` is what the colour axis rebinds: daisy's `--input-color`,
     * read through `color`, so ONE property drives the border, the knob fill
     * and the focus ring — its unchecked value is a half-strength base-content
     * hairline, and checking swaps it for the accent.
     */
    tokens: {
        '--switch-size': 'calc(var(--size-selector) * 6)',
        '--switch-p': 'calc(var(--switch-size) * 0.125)',
        '--switch-accent': 'var(--color-primary)',
        // daisy's `--input-color` default is a 50% base-content mix, which puts
        // the unchecked knob at 2.74:1 on `nord` and 3.13:1 on `sunset` —
        // under the 3:1 floor for a non-text mark. 60% clears every theme this
        // package ships (light 4.66, dark 6.23, dim 3.85, nord 3.49,
        // sunset 3.88) and is invisible against daisy at the same hue, the same
        // deepening `--rating-fill` already makes for the same reason.
        '--switch-ink': 'color-mix(in oklab, var(--color-base-content) 60%, #0000)',
    },
    parts: {
        root: {
            base: { display: 'inline-flex', alignItems: 'center', gap: 'var(--space-lg)', cursor: 'pointer' },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                checked: {},
                unchecked: {},
            },
        },
        control: {
            // The track's whole box lives in `targets`: the web mechanism is
            // an inline-grid whose leading column grows, spelled with grid
            // and `min()` — both measured unresolvable by lynx's engine
            // (signalxjs/lynx#1066), so the lynx section lays the same
            // geometry out with flex + calc() instead. Whole blocks move
            // (not single declarations) so the merged web view keeps its
            // declaration order and the web goldens stay byte-identical.
            states: {
                // daisy's checked toggle empties its track to base-100 and paints
                // the KNOB with the accent — so the checked knob's contrast is
                // accent-on-base-100, not accent-content-on-accent. Same
                // trade-off as the checkbox's unchecked outline: 1.11:1 at worst
                // (sunset/`neutral`), 7.68 at best, daisy's own numbers.
                // Both targets restate the paint in their own spelling below.
                checked: {},
                unchecked: {},
                // `invalid` is semantic: it stays error under every colour
                // variant. Stated as a longhand because the track's border is
                // `currentColor`, and `color` is what `checked` moves — the
                // explicit border-color outranks both.
                invalid: { borderColor: 'var(--color-error)' },
                'focus-visible': { outline: '2px solid var(--switch-accent)', outlineOffset: '2px' },
                disabled: {},
            },
        },
        thumb: {
            // Like `control`, the knob's box is per-target: the web knob fills
            // its grid cell, the lynx knob is an explicit calc() square that
            // `translateX`es — see `targets` below.
            states: {
                checked: {},
                unchecked: {},
            },
        },
        label: {
            base: { fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' },
            states: { checked: {}, unchecked: {}, disabled: {} },
        },
    },
    variants: {
        // daisy's toggle ramp is the selector ramp — ×4…×8 of ONE size, with
        // everything else derived from it.
        size: {
            xs: { root: { base: { '--switch-size': 'calc(var(--size-selector) * 4)' } } },
            sm: { root: { base: { '--switch-size': 'calc(var(--size-selector) * 5)' } } },
            // `md` is the un-attributed render — the defaults in `tokens:`
            // already ARE the middle step.
            md: {},
            lg: { root: { base: { '--switch-size': 'calc(var(--size-selector) * 7)' } } },
            xl: { root: { base: { '--switch-size': 'calc(var(--size-selector) * 8)' } } },
        },
        color: Object.fromEntries(
            ROLES.map((c) => [c, { root: { base: { '--switch-accent': `var(--color-${c})` } } }]),
        ),
    },
    defaultVariants: { color: 'primary' },
    // The visible ring lives on `control`; the <label> root only groups the
    // control and its text. Declared rather than left implicit so the
    // delegation reads as a decision.
    skipStates: { root: ['focus-visible'] },
    // ONE design decision, two spellings. The web track is daisy's own
    // mechanism — an inline-grid whose leading column grows (`0fr 1fr 1fr` →
    // `1fr 1fr 0fr`) with a min()-clamped radius — and lynx's engine resolves
    // neither grid nor the comparison functions (measured on device,
    // signalxjs/lynx#1066; the emitter refuses min()/max()/clamp() on that
    // evidence). So the whole box moves here per target: the web section is
    // the original spelling verbatim, the lynx section rebuilds the same
    // geometry with flex + calc() and slides the knob with `translateX`.
    targets: {
        web: {
            parts: {
                control: {
                    base: {
                        // The knob slides because the grid's leading column GROWS:
                        // `0fr 1fr 1fr` → `1fr 1fr 0fr`, with the knob parked in
                        // column 2. That is daisy's own mechanism, and unlike a
                        // `translateX` it is RTL-correct for free.
                        display: 'inline-grid',
                        gridTemplateColumns: '0fr 1fr 1fr',
                        placeContent: 'center',
                        position: 'relative',
                        verticalAlign: 'middle',
                        flexShrink: '0',
                        boxSizing: 'border-box',
                        width: 'calc((var(--switch-size) * 2) - (var(--border) + var(--switch-p)) * 2)',
                        height: 'var(--switch-size)',
                        padding: 'var(--switch-p)',
                        // daisy's radius formula: the selector radius GROWN by the
                        // padding and the border so the knob's own corner and the
                        // track's stay concentric, each clamped at 3× the token so a
                        // square-cornered theme (cyberpunk, wireframe) stays square.
                        '--switch-radius-max': 'calc(var(--radius-selector) + var(--radius-selector) + var(--radius-selector))',
                        borderRadius: 'calc(var(--radius-selector) + min(var(--switch-p), var(--switch-radius-max)) + min(var(--border), var(--switch-radius-max)))',
                        border: 'var(--border) solid currentColor',
                        color: 'var(--switch-ink)',
                        boxShadow: '0 1px color-mix(in oklab, currentColor calc(var(--depth) * 10%), #0000) inset',
                        userSelect: 'none',
                        transition: 'color var(--duration-slow) var(--ease-standard), '
                            + 'background-color var(--duration-normal) var(--ease-standard), '
                            + 'grid-template-columns var(--duration-normal) var(--ease-standard)',
                    },
                    states: {
                        checked: {
                            gridTemplateColumns: '1fr 1fr 0fr',
                            color: 'var(--switch-accent)',
                            backgroundColor: 'var(--color-base-100)',
                        },
                    },
                },
                thumb: {
                    base: {
                        // daisy's `.toggle:before`: a square knob that fills its grid
                        // cell and takes the UNGROWN selector radius, so it is a
                        // rounded square in daisy's rounded-square themes and a circle
                        // only where the theme says so.
                        gridRowStart: '1',
                        gridColumnStart: '2',
                        aspectRatio: '1',
                        width: '100%',
                        height: '100%',
                        borderRadius: 'var(--radius-selector)',
                        backgroundColor: 'currentColor',
                        backgroundSize: 'auto, calc(var(--noise) * 100%)',
                        backgroundImage: 'none, var(--fx-noise)',
                        boxShadow: '0 -1px var(--depth-shade) inset, 0 8px 0 -4px var(--depth-sheen) inset, '
                            + '0 1px color-mix(in oklab, currentColor calc(var(--depth) * 10%), #0000)',
                        transition: 'background-color var(--duration-instant) var(--ease-standard)',
                    },
                },
            },
        },
        lynx: {
            parts: {
                root: {
                    // `inline-flex` has no lynx projection; restated as plain
                    // flex with the direction explicit (lynx does not default
                    // it the way a browser does).
                    base: { display: 'flex', flexDirection: 'row', alignItems: 'center' },
                },
                control: {
                    base: {
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: '0',
                        boxSizing: 'border-box',
                        // Same geometry as the web track: daisy's derived
                        // width, ONE `--switch-size` driving everything.
                        width: 'calc((var(--switch-size) * 2) - (var(--border) + var(--switch-p)) * 2)',
                        height: 'var(--switch-size)',
                        padding: 'var(--switch-p)',
                        // The radius formula minus its min() clamps: exact for
                        // every shipped theme (the clamp only bites when the
                        // padding or border exceeds 3× the selector radius,
                        // i.e. near-square themes this package does not ship).
                        borderRadius: 'calc(var(--radius-selector) + var(--switch-p) + var(--border))',
                        // No currentColor on this target — the ink is named
                        // directly, and `checked` moves border + fill below.
                        border: 'var(--border) solid var(--switch-ink)',
                        userSelect: 'none',
                        transition: 'border-color var(--duration-slow) var(--ease-standard), '
                            + 'background-color var(--duration-normal) var(--ease-standard)',
                    },
                    states: {
                        checked: {
                            borderColor: 'var(--switch-accent)',
                            backgroundColor: 'var(--color-base-100)',
                        },
                    },
                },
                thumb: {
                    base: {
                        // The web knob fills its square grid cell; here the
                        // same square is explicit: track height minus border
                        // and padding on both sides.
                        width: 'calc(var(--switch-size) - (var(--border) + var(--switch-p)) * 2)',
                        height: 'calc(var(--switch-size) - (var(--border) + var(--switch-p)) * 2)',
                        borderRadius: 'var(--radius-selector)',
                        backgroundColor: 'var(--switch-ink)',
                        transition: 'transform var(--duration-normal) var(--ease-standard), '
                            + 'background-color var(--duration-instant) var(--ease-standard)',
                    },
                    states: {
                        // The knob's travel is exactly one knob-width: the
                        // content box is two knobs wide, and the knob starts
                        // at the near end. `translateX` is measured working
                        // on lynx. The axis is PHYSICAL where the web's
                        // growing grid column was logical — an RTL layout
                        // would need a direction-aware multiplier, but the
                        // lynx grammar carries no direction hook yet and the
                        // runtime does not stamp one; revisit with the RTL
                        // plumbing rather than guessing at it here.
                        checked: {
                            backgroundColor: 'var(--switch-accent)',
                            transform: 'translateX(calc(var(--switch-size) - (var(--border) + var(--switch-p)) * 2))',
                        },
                    },
                },
            },
        },
    },
};

// --------------------------------------------------------------------------
// 2. checkbox — the three clip-paths, the fallback helper, then the recipe
// --------------------------------------------------------------------------

/**
 * daisy's field ramp — one height per size step, in `--size-field` units.
 *
 * Named once because three components step on it: `select`'s trigger reads it
 * through `btn`, and `combobox`/`number-input` had no height at all and sized
 * implicitly off their input's padding — 48px next to 31px on the same page
 * (#219). A ramp restated in three recipes is a ramp free to drift, which is
 * exactly what happened.
 */
const FIELD_STEPS = { xs: 8, sm: 10, md: 12, lg: 14, xl: 16 } as const;
const fieldHeight = (step: keyof typeof FIELD_STEPS): string =>
    `calc(var(--size-field) * ${FIELD_STEPS[step]})`;

// daisy "modal" flavor (+ "btn" trigger/close).
const btn: NonNullable<PartStyles['base']> = {
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5em',
    height: 'calc(var(--size-field) * 12)',
    paddingInline: 'calc(var(--size-field) * 4)',
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--weight-semibold)',
    color: 'var(--color-base-content)',
    background: 'var(--color-base-200)',
    border: 'var(--border) solid var(--color-base-300)',
    borderRadius: 'var(--radius-field)',
    boxShadow: 'var(--shadow-xs)',
    cursor: 'pointer',
    transition: 'background var(--duration-normal) var(--ease-standard)',
};

/**
 * The axes for the four btn-wearing overlay triggers (#321). Dialog, popover,
 * tooltip and menu carry their axis attributes on the TRIGGER — the anatomy's
 * carrier part — and their popups are top-layer siblings the compiled
 * `@scope` donut can never reach, so the axes style the btn itself.
 *
 * Colour is daisy's own `btn-{color}`: solid role fill, `-content` ink. The
 * hover/open states restate the fill under the solid button's brightness dip
 * — necessary, not decorative: the variant's flat base rule lands after the
 * part's state rules at equal specificity, so without the restatement the
 * neutral `base-300` hover would lose and the button would freeze.
 */
const btnColors = (): Record<string, Record<string, PartStyles>> =>
    Object.fromEntries(ROLES.map((c) => [c, { trigger: {
        base: {
            background: `var(--color-${c})`,
            color: `var(--color-${c}-content)`,
            borderColor: 'transparent',
        },
        states: {
            hover: { background: `var(--color-${c})`, filter: 'brightness(0.92)' },
            open: { background: `var(--color-${c})`, filter: 'brightness(0.92)' },
        },
    } }]));

/** The btn size ramp — select's trigger steps, off the shared field ramp. */
const btnSizes: Record<string, Record<string, PartStyles>> = {
    xs: { trigger: { base: { height: fieldHeight('xs'), paddingInline: 'calc(var(--size-field) * 2)', fontSize: 'var(--text-xs)' } } },
    sm: { trigger: { base: { height: fieldHeight('sm'), paddingInline: 'calc(var(--size-field) * 3)', fontSize: 'var(--text-sm)' } } },
    // `md` is the un-attributed render — `btn` already IS the middle step.
    md: {},
    lg: { trigger: { base: { height: fieldHeight('lg'), paddingInline: 'calc(var(--size-field) * 5)', fontSize: 'var(--text-md)' } } },
    xl: { trigger: { base: { height: fieldHeight('xl'), paddingInline: 'calc(var(--size-field) * 6)', fontSize: 'var(--text-lg)' } } },
};

/**
 * `btn`'s inline padding restated physically, for the `targets.lynx`
 * sections of every btn-wearing recipe: logical spellings resolve on iOS but
 * not on Android (measured, signalxjs/lynx#1084), so the lynx emitter
 * refuses `padding-inline`. Physical is that target's norm — lynx has no
 * RTL flow for the logical spelling to flip with.
 */
const lynxBtnPad = (mult: number): NonNullable<PartStyles['base']> => ({
    paddingLeft: `calc(var(--size-field) * ${mult})`,
    paddingRight: `calc(var(--size-field) * ${mult})`,
});

/** The btn size ramp's physical inline padding, for `targets.lynx.variants`. */
const lynxBtnSizes = (part: string): Record<string, Record<string, PartStyles>> => ({
    xs: { [part]: { base: lynxBtnPad(2) } },
    sm: { [part]: { base: lynxBtnPad(3) } },
    lg: { [part]: { base: lynxBtnPad(5) } },
    xl: { [part]: { base: lynxBtnPad(6) } },
});

export const dialog: RecipeInput = {
    component: 'dialog',
    keyframes: {
        'zero-daisy-pop': 'from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); }',
    },
    parts: {
        trigger: {
            base: btn,
            states: {
                hover: { background: 'var(--color-base-300)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                open: {},
                closed: {},
                ...focusRing,
            },
        },
        popup: withPresence(popupPresence('translateY(8px) scale(0.97)'), {
            base: {
                padding: 'var(--space-2xl)',
                maxWidth: '32rem',
                width: 'calc(100% - 2rem)',
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
                border: 'none',
                borderRadius: 'var(--radius-box)',
                boxShadow: 'var(--shadow-xl)',
            },
            states: {
                open: { animation: 'zero-daisy-pop var(--duration-normal) ease-out' },
                closed: {},
            },
        }),
        backdrop: {
            base: { background: 'oklch(0% 0 0 / 0.4)' },
            states: { open: {}, closed: {} },
        },
        title: {
            base: { margin: '0 0 var(--space-md)', fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)' },
        },
        description: {
            base: {
                margin: '0 0 var(--space-2xl)',
                fontSize: 'var(--text-sm)',
                color: 'color-mix(in oklab, var(--color-base-content) 75%, transparent)',
            },
        },
        // daisy's `modal-action`: the actions sit at the trailing edge, one
        // step of the button gap apart, pushed down by the modal's own
        // padding — daisy writes 1.5rem for both, and both now read the top
        // of the ramp (`--space-2xl`, 1.25rem) so a density override moves
        // the popup's inset and the footer's push-down together.
        footer: {
            base: {
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 'var(--space-md)',
                marginBlockStart: 'var(--space-2xl)',
            },
        },
        close: {
            base: btn,
            states: {
                hover: { background: 'var(--color-base-300)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
                ...focusRing,
            },
        },
        // The least-destructive action of an alertdialog — the same neutral
        // btn chrome as close.
        cancel: {
            base: btn,
            states: {
                hover: { background: 'var(--color-base-300)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
                ...focusRing,
            },
        },
    },
    // Trigger-carried axes — see `btnColors` for why the popup is out of
    // reach and the trigger is the whole story here.
    variants: { color: btnColors(), size: btnSizes },
    // The btn paddings and the footer's push-down, restated physically —
    // see `lynxBtnPad` for the #1084 verdict this answers.
    targets: {
        lynx: {
            parts: {
                trigger: { base: lynxBtnPad(4) },
                close: { base: lynxBtnPad(4) },
                cancel: { base: lynxBtnPad(4) },
                footer: { base: { marginTop: 'var(--space-2xl)' } },
            },
            variants: { size: lynxBtnSizes('trigger') },
        },
    },
};

// daisy "dropdown-content"/card look for floating panels.
const floatingPanel: NonNullable<PartStyles['base']> = {
    background: 'var(--color-base-100)',
    color: 'var(--color-base-content)',
    border: 'var(--border) solid var(--color-base-300)',
    borderRadius: 'var(--radius-box)',
    boxShadow: 'var(--shadow-lg)',
};

export const popover: RecipeInput = {
    component: 'popover',
    parts: {
        trigger: {
            base: btn,
            states: {
                hover: { background: 'var(--color-base-300)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                open: { background: 'var(--color-base-300)' },
                closed: {},
                ...focusRing,
            },
        },
        popup: withPresence(popupPresence('translateY(-4px)'), {
            base: { ...floatingPanel, padding: 'var(--space-2xl)', minWidth: '15rem' },
            states: { open: {}, closed: {} },
        }),
        title: {
            base: { margin: '0 0 var(--space-md)', fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)' },
        },
        close: {
            base: { ...btn, height: 'calc(var(--size-field) * 8)', paddingInline: 'calc(var(--size-field) * 3)', fontSize: 'var(--text-xs)' },
            states: {
                hover: { background: 'var(--color-base-300)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
                ...focusRing,
            },
        },
    },
    // Trigger-carried axes — same wiring as dialog, same reason.
    variants: { color: btnColors(), size: btnSizes },
    // The btn paddings, restated physically — see `lynxBtnPad` (#1084).
    targets: {
        lynx: {
            parts: {
                trigger: { base: lynxBtnPad(4) },
                close: { base: lynxBtnPad(3) },
            },
            variants: { size: lynxBtnSizes('trigger') },
        },
    },
};

export const tooltip: RecipeInput = {
    component: 'tooltip',
    parts: {
        // daisy's `btn`, exactly as dialog, popover and menu wear it — the row
        // reads as three buttons because it is three buttons. `cursor: help`
        // is the one deviation: the trigger explains rather than opens. No
        // pressed rule: tooltip's anatomy declares no `pressed` flag.
        trigger: {
            base: { ...btn, cursor: 'help' },
            states: {
                hover: { background: 'var(--color-base-300)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                open: { background: 'var(--color-base-300)' },
                closed: {},
                ...focusRing,
            },
        },
        popup: withPresence(popupPresence('translateY(-2px)'), {
            base: {
                padding: 'var(--space-xs) var(--space-lg)',
                maxWidth: '18rem',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-medium)',
                background: 'var(--color-neutral)',
                color: 'var(--color-neutral-content)',
                border: 'none',
                borderRadius: 'var(--radius-field)',
            },
            states: { open: {}, closed: {} },
        }),
    },
    // Trigger-carried axes — same wiring as dialog, same reason. The bubble
    // stays daisy's neutral tooltip whatever the trigger's colour.
    variants: { color: btnColors(), size: btnSizes },
    // The btn paddings, restated physically — see `lynxBtnPad` (#1084).
    targets: {
        lynx: {
            parts: { trigger: { base: lynxBtnPad(4) } },
            variants: { size: lynxBtnSizes('trigger') },
        },
    },
};

// daisy "menu in a dropdown" look.
export const menu: RecipeInput = {
    component: 'menu',
    parts: {
        trigger: {
            base: btn,
            states: {
                hover: { background: 'var(--color-base-300)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                open: { background: 'var(--color-base-300)' },
                closed: {},
                ...focusRing,
            },
        },
        popup: withPresence(popupPresence('translateY(-4px)'), {
            base: { ...floatingPanel, padding: 'var(--space-md)', minWidth: '13rem' },
            states: { open: {}, closed: {} },
        }),
        item: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                padding: 'var(--space-md) var(--space-lg)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                borderRadius: 'var(--radius-field)',
                cursor: 'pointer',
                outline: 'none',
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                highlighted: { background: 'var(--color-base-200)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
        },
        // The stateful rows read as the plain item; the mark in front carries
        // the state, glyph-drawn the way the select's tick is.
        'checkbox-item': {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                padding: 'var(--space-md) var(--space-lg)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                borderRadius: 'var(--radius-field)',
                cursor: 'pointer',
                outline: 'none',
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                highlighted: { background: 'var(--color-base-200)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                checked: {}, unchecked: {},
            },
        },
        'radio-item': {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                padding: 'var(--space-md) var(--space-lg)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                borderRadius: 'var(--radius-field)',
                cursor: 'pointer',
                outline: 'none',
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                highlighted: { background: 'var(--color-base-200)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                checked: {}, unchecked: {},
            },
        },
        // A reserved mark column so rows align whether checked or not; the
        // glyph appears only while checked and rides the row's own ink.
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
        // The item look plus a chevron; `open` keeps it lit while focus is
        // inside the submenu.
        'sub-trigger': {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                padding: 'var(--space-md) var(--space-lg)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                borderRadius: 'var(--radius-field)',
                cursor: 'pointer',
                outline: 'none',
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                highlighted: { background: 'var(--color-base-200)' },
                open: { background: 'var(--color-base-200)' },
                closed: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
            selectors: {
                // A submenu opens toward the reading end, so the chevron that
                // announces it has to point that way. `\203A` points right in
                // every writing direction; `\2039` is its mirror, and the swap
                // agrees with the side `Menu.tsx` itself resolves from `:dir()`.
                '&::after': { content: '"\\203A"', marginInlineStart: 'auto', opacity: '0.6' },
                [`&${rtl}::after`]: { content: '"\\2039"' },
            },
        },
        'sub-popup': withPresence(popupPresence('translateX(-4px)'), {
            base: { ...floatingPanel, padding: 'var(--space-md)', minWidth: '13rem' },
            states: { open: {}, closed: {} },
        }),
        group: { base: {} },
        'group-label': {
            base: {
                padding: 'var(--space-md) var(--space-lg) var(--space-xs)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-bold)',
                opacity: '0.6',
            },
        },
        separator: {
            base: {
                height: 'var(--border)',
                margin: 'var(--space-sm) var(--space-md)',
                background: 'var(--color-base-300)',
            },
        },
    },
    // Trigger-carried axes — same wiring as dialog, same reason. The dropdown
    // and its items are top-layer siblings the donut cannot reach.
    variants: { color: btnColors(), size: btnSizes },
    // The btn paddings, restated physically — see `lynxBtnPad` (#1084).
    targets: {
        lynx: {
            parts: { trigger: { base: lynxBtnPad(4) } },
            variants: { size: lynxBtnSizes('trigger') },
        },
    },
};

export const field: RecipeInput = {
    component: 'field',
    // The label's accent ink — base-content by default, so the un-attributed
    // field is unchanged and a role only arrives through `data-color`.
    tokens: { '--field-accent': 'var(--color-base-content)' },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' },
        },
        label: {
            base: { fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--field-accent)' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
            selectors: {
                '&[data-required]::after': { content: '" *"', color: roleInk('error') },
            },
        },
        description: {
            base: { margin: '0', fontSize: 'var(--text-xs)', opacity: '0.6' },
        },
        error: {
            base: { margin: '0', fontSize: 'var(--text-xs)', color: roleInk('error'), fontWeight: 'var(--weight-medium)' },
        },
    },
    variants: {
        // Colour accents the LABEL only, through `roleInk` (#210): the
        // description keeps its muting and the error message stays error
        // whatever the field's role.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--field-accent': roleInk(c),
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
};

/**
 * daisy's tick, drawn by a clip-path that GROWS.
 *
 * The mark is a 45°-rotated bar pair clipped out of a solid box: six points,
 * three of which start collapsed onto their neighbours, so the "unchecked"
 * polygon is a degenerate sliver. Checking moves two of them to the top edge
 * and the tick draws itself — point counts match, so `clip-path` interpolates
 * instead of popping. Indeterminate un-rotates the same six points into a
 * horizontal bar and lifts it to the middle. All three verbatim from daisyUI
 * 5.7.8's `.checkbox:before` / `:checked` / `:indeterminate`.
 */
const TICK_COLLAPSED = 'polygon(20% 100%, 20% 80%, 50% 80%, 50% 80%, 70% 80%, 70% 100%)';
const TICK_DRAWN = 'polygon(20% 100%, 20% 80%, 50% 80%, 50% 0%, 70% 0%, 70% 100%)';
const DASH_DRAWN = 'polygon(20% 100%, 20% 80%, 50% 80%, 50% 80%, 80% 80%, 80% 100%)';

/**
 * The geometry-for-glyph swap daisy ships for forced colours and print, where
 * a clip-path painted with `currentColor` can disappear.
 *
 * daisy hangs the glyph on the same `::before` it uses for the geometry, via
 * `--tw-content`. Our indicator is a real element, and `content` on a
 * non-pseudo element is Chromium/WebKit-only — so the glyph goes on the
 * `::after` this recipe already had, and the indicator itself just drops the
 * geometry. daisyUI 5.7.8 emits the two at-rules as separate blocks; so do we.
 *
 * Both are named built-in conditions since #226, so both sort into the
 * preference tier and land after the flat state rules they override.
 *
 * One helper, an ink per medium — and daisy declares neither. Its fallback sets
 * `--tw-content`, `clip-path: none`, `background-color: #0000` and `rotate` and
 * nothing else, leaving the glyph to inherit the control's `color` (the
 * on-accent role, or `base-content` unskinned). Verified against daisyUI 5's
 * own `checkbox.css`, both at-rules.
 *
 * Inheriting is survivable in forced colours — the UA revalues the inherited
 * ink to its own text colour, 21:1 against the forced backdrop — and it is not
 * on paper: `primary-content` is a pale lavender over a fill that did not
 * print, 1.37:1, exactly as real daisy prints it (#233). So this is a
 * deliberate divergence, and the two media get different inks because they
 * fail differently: `CanvasText` is the forced palette's own ink and follows
 * `color-scheme`, which is right there and white-on-white on paper under a
 * dark theme. Print names `--print-ink`, which is theme-independent by
 * construction. Recorded in the package README beside the other divergences —
 * fidelity to a mark nobody can see is not fidelity.
 */
const tickGlyphFallback = (ink: string): PartStyles => ({
    base: { color: ink },
    states: {
        checked: { opacity: '1', clipPath: 'none', backgroundColor: '#0000', rotate: '0deg', color: ink },
        indeterminate: { opacity: '1', clipPath: 'none', backgroundColor: '#0000', rotate: '0deg', translate: 'none', color: ink },
    },
    selectors: {
        '&[data-state="checked"]::after': { content: '"✔︎"' },
        '&[data-state="indeterminate"]::after': { content: '"−"' },
    },
});

export const checkbox: RecipeInput = {
    component: 'checkbox',
    // The accent defaults live in `tokens:` (emitted flat on the carrier, no
    // added specificity), so the un-attributed render IS the primary variant
    // and `variants.color` only rebinds custom properties — the toast shape.
    //
    // `--checkbox-pad` is daisy's `padding`, and it is load-bearing: the
    // indicator is `100%`/`100%` of the control's CONTENT box, so the padding
    // is what sizes the tick and what centres it. daisy ramps it with the box.
    tokens: {
        '--checkbox-size': 'calc(var(--size-selector) * 6)',
        '--checkbox-pad': '0.25rem',
        '--checkbox-accent': 'var(--color-primary)',
        '--checkbox-on-accent': 'var(--color-primary-content)',
    },
    parts: {
        root: {
            base: { display: 'inline-flex', alignItems: 'center', gap: 'var(--space-md)', cursor: 'pointer' },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                checked: {}, unchecked: {}, indeterminate: {},
            },
        },
        control: {
            base: {
                // daisy's own box: `inline-block` + padding, NOT a flex
                // centring box. The padding does the centring, which is the
                // whole geometric trick — as a flex item the indicator would
                // get `align-self: center` and shrink instead of filling.
                display: 'inline-block',
                position: 'relative',
                verticalAlign: 'middle',
                flexShrink: '0',
                // daisy inherits this from Tailwind's global reset; zero's
                // base.css does not set it, and without it `--checkbox-size`
                // would be the CONTENT box and every checkbox 2×(pad+border)
                // too large.
                boxSizing: 'border-box',
                width: 'var(--checkbox-size)',
                height: 'var(--checkbox-size)',
                padding: 'var(--checkbox-pad)',
                // daisy's `--input-color` border, fallback included: the accent
                // is the UNCHECKED outline too, which is what `.checkbox-primary`
                // does. Faithful, and faithfully weak for the pale roles —
                // measured against base-100 the outline is 1.66:1 on
                // light/`warning`, 1.83 light/`accent`, 1.22 dark/`neutral`
                // (worst 1.11 on sunset/`neutral`), the same numbers real daisy
                // ships and the same ones the checked fill, the radio dot and
                // the toggle knob carry. It is a palette fact, not a geometry
                // one — the tick itself clears 3:1 in all forty cells — and it
                // belongs to the indicator-contrast audit (#228).
                border: 'var(--border) solid var(--checkbox-accent, color-mix(in oklab, var(--color-base-content) 20%, #0000))',
                borderRadius: 'var(--radius-selector)',
                // One `color` declaration drives the tick's `currentColor` fill
                // and the forced-colors glyph, exactly as daisy's does.
                color: 'var(--checkbox-on-accent)',
                // No `background-color`: daisy's unchecked `.checkbox` is
                // TRANSPARENT (computed `rgba(0, 0, 0, 0)`), so the surface it
                // sits on shows through. Painting `--color-base-100` here is
                // invisible on a base-100 page and wrong on every tinted one —
                // a checkbox in a `card` or a `base-200` panel would be an
                // opaque white chip. `checked`/`indeterminate` fill themselves.
                boxShadow: '0 1px var(--depth-shade) inset, 0 0 #0000 inset, 0 0 #0000',
                backgroundSize: 'auto, calc(var(--noise) * 100%)',
                backgroundImage: 'none, var(--fx-noise)',
                cursor: 'pointer',
                transition: 'background-color var(--duration-normal) var(--ease-standard), '
                    + 'box-shadow var(--duration-normal) var(--ease-standard)',
            },
            states: {
                // `checked` is the one state daisy restates the shadow list in,
                // and this IS its list, in its order: the inset relief drops
                // out, a sheen band lights the top of the fill, and the box
                // gains a 1px drop. Three shadows, matching `base`'s three, so
                // the depth interpolates rather than switching.
                checked: {
                    backgroundColor: 'var(--checkbox-accent)',
                    boxShadow: '0 0 #0000 inset, 0 8px 0 -4px var(--depth-sheen) inset, 0 1px var(--depth-shade)',
                },
                // `indeterminate` takes the fill and NOTHING else: daisy's
                // `.checkbox:indeterminate` declares no `box-shadow`, so it
                // keeps the recessed base list — no sheen band, no outer drop.
                // Restating `checked`'s list here (as this recipe did before)
                // put a bright band across the top of the bar that real daisy
                // does not have.
                indeterminate: { backgroundColor: 'var(--checkbox-accent)' },
                unchecked: {},
                'focus-visible': { outline: '2px solid var(--checkbox-accent)', outlineOffset: '2px' },
                // `invalid` is semantic, not an accent: it stays error under
                // every colour variant, on purpose.
                invalid: { borderColor: 'var(--color-error)' },
                disabled: {},
            },
        },
        indicator: {
            base: {
                // daisy's `.checkbox:before`, declaration for declaration.
                display: 'block',
                width: '100%',
                height: '100%',
                opacity: '0',
                rotate: '45deg',
                backgroundColor: 'currentColor',
                clipPath: TICK_COLLAPSED,
                boxShadow: '0 3px 0 0 var(--depth-sheen) inset',
                // Metrics for the forced-colors/print glyph only — daisy
                // carries them on the same element for the same reason.
                fontSize: '1rem',
                lineHeight: '0.75',
                // daisy's staggered four-property transition: the tick's draw
                // and rotation are slow, its fade is instant, and everything
                // waits out the control's fill first. daisy spells the delay
                // `.1s`; the `instant` duration token is the same 100ms AND
                // collapses under prefers-reduced-motion, which a literal
                // cannot.
                transition: 'clip-path var(--duration-slow) var(--ease-standard) var(--duration-instant), '
                    + 'opacity var(--duration-instant) var(--ease-standard) var(--duration-instant), '
                    + 'rotate var(--duration-slow) var(--ease-standard) var(--duration-instant), '
                    + 'translate var(--duration-slow) var(--ease-standard) var(--duration-instant)',
            },
            states: {
                checked: { clipPath: TICK_DRAWN, opacity: '1' },
                indeterminate: { clipPath: DASH_DRAWN, opacity: '1', translate: '0 -35%', rotate: '0deg' },
                unchecked: {},
            },
            // Real daisy declares no ink in either at-rule, so its glyph
            // inherits `--color-primary-content` and prints at 1.37:1 — a pale
            // lavender on white paper (#233). The sixth deliberate divergence
            // from daisy in this package, and the same trade as the other five:
            // 3:1 is the floor a mark owes the reader, and a mark nobody can
            // see is not fidelity.
            at: {
                'forced-colors': tickGlyphFallback('CanvasText'),
                print: tickGlyphFallback('var(--print-ink)'),
            },
        },
        label: {
            base: { fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' },
            states: { checked: {}, unchecked: {}, indeterminate: {}, disabled: {} },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--checkbox-accent': `var(--color-${c})`,
            '--checkbox-on-accent': `var(--color-${c}-content)`,
        } } }])),
        // daisy's own selector ramp — ×4…×8 of `--size-selector`, i.e.
        // 1 / 1.25 / 1.5 / 1.75 / 2rem, each with its own padding step.
        size: {
            xs: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 4)', '--checkbox-pad': '0.125rem' } }, label: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 5)', '--checkbox-pad': '0.1875rem' } }, label: { base: { fontSize: 'var(--text-sm)' } } },
            md: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 6)', '--checkbox-pad': '0.25rem' } }, label: { base: { fontSize: 'var(--text-sm)' } } },
            lg: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 7)', '--checkbox-pad': '0.3125rem' } }, label: { base: { fontSize: 'var(--text-md)' } } },
            xl: { root: { base: { '--checkbox-size': 'calc(var(--size-selector) * 8)', '--checkbox-pad': '0.375rem' } }, label: { base: { fontSize: 'var(--text-lg)' } } },
        },
    },
    // The visible ring lives on `control`; the <label> root only groups the
    // control and its text. Declared rather than left implicit so the
    // delegation reads as a decision.
    skipStates: { root: ['focus-visible'] },
    // `currentColor` never resolves on lynx (measured on device on both
    // platforms, signalxjs/lynx#1079), so the tick shipped invisible and the
    // ring's color-mix-over-currentColor fallback dropped the whole border.
    // Both restated with the named accents the web spellings resolve to —
    // plain var() chains, the switch's device-proven #380 mechanism.
    targets: {
        lynx: {
            parts: {
                control: {
                    // The web fallback (`color-mix(in oklab, … currentColor …)`)
                    // exists for consumers that unset the accent; this package
                    // always defines it, so the plain accent IS the ring.
                    base: { border: 'var(--border) solid var(--checkbox-accent)' },
                },
                indicator: {
                    // The tick's fill: the control's `color:` names
                    // `--checkbox-on-accent`, and `currentColor` was that
                    // ink by inheritance — spend it directly.
                    //
                    // The tick's motion, restated as `transform`: the
                    // standalone `rotate`/`translate` properties resolve on
                    // iOS but not on Android (measured, signalxjs/lynx#1084),
                    // so the emitter refuses them. `transform` functions are
                    // proven on both platforms — and the transition follows
                    // the property that now moves.
                    base: {
                        backgroundColor: 'var(--checkbox-on-accent)',
                        transform: 'rotate(45deg)',
                        transition: 'clip-path var(--duration-slow) var(--ease-standard) var(--duration-instant), '
                            + 'opacity var(--duration-instant) var(--ease-standard) var(--duration-instant), '
                            + 'transform var(--duration-slow) var(--ease-standard) var(--duration-instant)',
                    },
                    // The order matches the standalone properties' fixed
                    // apply order (translate, then rotate).
                    states: { indeterminate: { transform: 'translateY(-35%) rotate(0deg)' } },
                },
            },
        },
    },
};

// --------------------------------------------------------------------------
// 3. radioGroup — replace the whole export
// --------------------------------------------------------------------------

export const radioGroup: RecipeInput = {
    component: 'radio-group',
    // Same padding-derived geometry as the checkbox: daisy's `.radio:before` is
    // `100%`/`100%` of the padded box, so `--radio-pad` IS the dot's size.
    tokens: {
        '--radio-size': 'calc(var(--size-selector) * 6)',
        '--radio-pad': '0.25rem',
        '--radio-accent': 'var(--color-primary)',
    },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' },
            states: { invalid: {}, required: {} },
            selectors: {
                // `invalid` is a fact about the GROUP — `item-control` carries
                // no flag of its own — and it is semantic: it stays error
                // under every colour variant.
                '&[data-invalid] [data-part="item-control"]': { borderColor: 'var(--color-error)' },
            },
        },
        label: {
            base: { fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
        },
        item: {
            base: { display: 'inline-flex', alignItems: 'center', gap: 'var(--space-md)', cursor: 'pointer' },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                checked: {}, unchecked: {},
            },
        },
        'item-control': {
            base: {
                // daisy's `.radio`: an inline-block padded box, not a flex
                // centring box — the padding is what insets the dot.
                display: 'inline-block',
                position: 'relative',
                verticalAlign: 'middle',
                flexShrink: '0',
                boxSizing: 'border-box',
                width: 'var(--radio-size)',
                height: 'var(--radio-size)',
                padding: 'var(--radio-pad)',
                border: 'var(--border) solid var(--radio-accent, color-mix(in srgb, currentColor 20%, #0000))',
                borderRadius: '9999px',
                color: 'var(--radio-accent)',
                backgroundColor: 'var(--color-base-100)',
                boxShadow: '0 1px var(--depth-shade) inset',
                transition: 'border-color var(--duration-normal) var(--ease-standard), '
                    + 'box-shadow var(--duration-normal) var(--ease-standard)',
            },
            states: {
                // daisy's checked radio squeezes its padding — the dot pops in
                // rather than fading. The keyframe is daisy's own (5px → 3px
                // against a 4px base), rewritten as a ratio so it tracks the
                // size ramp instead of only being right at `md`.
                checked: {
                    borderColor: 'currentColor',
                    animation: 'var(--duration-fast) var(--ease-standard) zero-daisy-radio',
                },
                unchecked: {},
                'focus-visible': { outline: '2px solid var(--radio-accent)', outlineOffset: '2px' },
                disabled: {},
            },
        },
        'item-indicator': {
            base: {
                // daisy's `.radio:before` — the dot IS the content box.
                display: 'block',
                width: '100%',
                height: '100%',
                borderRadius: '9999px',
                backgroundColor: 'transparent',
                backgroundSize: 'auto, calc(var(--noise) * 100%)',
                backgroundImage: 'none, var(--fx-noise)',
                transition: 'background-color var(--duration-instant) var(--ease-standard)',
            },
            states: {
                checked: {
                    backgroundColor: 'currentColor',
                    boxShadow: '0 -1px var(--depth-shade) inset, 0 8px 0 -4px var(--depth-sheen) inset, 0 1px var(--depth-shade)',
                },
                unchecked: {},
            },
        },
        'item-label': {
            base: { fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' },
            states: { checked: {}, unchecked: {}, disabled: {} },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--radio-accent': `var(--color-${c})`,
        } } }])),
        // Same selector ramp daisy gives its radios — ×4…×8 with daisy's own
        // padding step, which is what sizes the dot.
        size: {
            xs: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 4)', '--radio-pad': '0.125rem' } }, 'item-label': { base: { fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 5)', '--radio-pad': '0.1875rem' } }, 'item-label': { base: { fontSize: 'var(--text-sm)' } } },
            md: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 6)', '--radio-pad': '0.25rem' } }, 'item-label': { base: { fontSize: 'var(--text-sm)' } } },
            lg: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 7)', '--radio-pad': '0.3125rem' } }, 'item-label': { base: { fontSize: 'var(--text-md)' } } },
            xl: { root: { base: { '--radio-size': 'calc(var(--size-selector) * 8)', '--radio-pad': '0.375rem' } }, 'item-label': { base: { fontSize: 'var(--text-lg)' } } },
        },
    },
    keyframes: {
        'zero-daisy-radio': '0% { padding: calc(var(--radio-pad) * 1.25); } 50% { padding: calc(var(--radio-pad) * 0.75); }',
    },
    // The visible ring lives on `item-control`; `item` is the <label> that
    // wraps it. Declared rather than left implicit so the delegation reads
    // as a decision.
    skipStates: { item: ['focus-visible'] },
    // `currentColor` never resolves on lynx (measured on device on both
    // platforms, signalxjs/lynx#1079), so the checked ring and dot shipped
    // invisible, and the unchecked ring's color-mix-over-currentColor
    // fallback dropped the whole border. All three restated with the accent
    // the control's own `color:` names — plain var() chains, the switch's
    // device-proven #380 mechanism.
    targets: {
        lynx: {
            parts: {
                'item-control': {
                    base: { border: 'var(--border) solid var(--radio-accent)' },
                    states: { checked: { borderColor: 'var(--radio-accent)' } },
                },
                'item-indicator': {
                    states: { checked: { backgroundColor: 'var(--radio-accent)' } },
                },
            },
        },
    },
};

// --------------------------------------------------------------------------
// 4. progress — replace the whole export (only the two radius lines move)
// --------------------------------------------------------------------------

/**
 * A progress fill, deepened toward its own content pair just enough to clear
 * the 3:1 a bar owes the track it fills.
 *
 * Two strengths, each the gentlest that works — measured against the base-300
 * track in all five themes (#228):
 *
 * - the ACCENT at 90/10: raw `--color-primary` lands at 2.98:1 on `nord`, and
 *   nowhere else under 3. 90/10 lifts nord to 3.63 and leaves the rest at
 *   3.9+ (dark 4.36, light 5.02, sunset 6.31, dim 8.40). Deepening further is
 *   what fails: at 70/30 the dark theme drops to 2.83, because a mix toward
 *   `-content` darkens a fill that already sits on a dark track.
 * - `complete`'s SUCCESS at 55/45: raw success is the worst cell in the whole
 *   indicator matrix — a finished bar that reads as an empty one. 70/30 used
 *   to clear every theme; correcting the palette to daisyUI 5.7.8's values
 *   (#231) lightened light's `success` from `oklch(64.8% 0.15 160)` to
 *   `oklch(76% 0.177 163.223)` and took that cell to 2.65:1. 55/45 is the
 *   best of the range — light 3.37, dark 4.53, dim 3.34, nord 4.52,
 *   sunset 3.93 — and it is a peak rather than a plateau: 60/40 gives up a
 *   third of the margin (worst 3.10) and 50/50 falls back under on dim (2.88),
 *   because a mix toward `-content` darkens a fill that already sits on a dark
 *   track.
 */
const progressFill = (role: string, keep: number): string =>
    `color-mix(in oklab, var(--color-${role}) ${keep}%, var(--color-${role}-content))`;

export const progress: RecipeInput = {
    component: 'progress',
    tokens: {
        '--progress-accent': progressFill('primary', 90),
        '--progress-track-size': 'calc(var(--size-selector) * 2.5)',
    },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', width: '100%' },
            states: { loading: {}, complete: {}, indeterminate: {} },
        },
        label: {
            base: { fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' },
        },
        track: {
            base: {
                width: '100%',
                height: 'var(--progress-track-size)',
                background: 'var(--color-base-300)',
                // daisy's `.progress` is a BOX, not a selector control — it
                // reads --radius-box. Reading --radius-selector only looked
                // right while that token was 3x too large.
                borderRadius: 'var(--radius-box)',
                overflow: 'hidden',
            },
        },
        range: {
            base: {
                height: '100%',
                background: 'var(--progress-accent)',
                borderRadius: 'var(--radius-box)',
                transition: 'width var(--duration-slow) var(--ease-standard)',
            },
            states: {
                // `complete` is a semantic state, not an accent: it stays
                // success regardless of the colour variant, on purpose.
                complete: { background: progressFill('success', 55) },
                loading: {},
                indeterminate: { width: '40%', animation: 'zero-daisy-indeterminate 1.2s ease-in-out infinite' },
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
            base: { fontSize: 'var(--text-xs)', opacity: '0.6' },
        },
    },
    variants: {
        // The same 90/10 deepening the default gets, so the un-attributed
        // render IS `color="primary"` and no role is left on the raw token.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--progress-accent': progressFill(c, 90),
        } } }])),
        size: {
            xs: { root: { base: { '--progress-track-size': 'var(--size-selector)' } } },
            sm: { root: { base: { '--progress-track-size': 'calc(var(--size-selector) * 1.5)' } } },
            md: { root: { base: { '--progress-track-size': 'calc(var(--size-selector) * 2.5)' } } },
            lg: { root: { base: { '--progress-track-size': 'calc(var(--size-selector) * 3.5)' } } },
            xl: { root: { base: { '--progress-track-size': 'calc(var(--size-selector) * 4.5)' } } },
        },
    },
    // The base already IS this render — `tokens:` binds the primary accent and
    // the md track size — so the web `:not()` twins only restate it. Declared
    // so the manifest states the default for runtimes with no `:not()`
    // fallback (the lynx target; signalxjs/lynx#1070).
    defaultVariants: { color: 'primary', size: 'md' },
    keyframes: {
        // Logical, so the sweep runs the way the bar fills — `margin-inline-start`
        // is animatable and direction-aware on its own. The determinate `width`,
        // an ordinary flow child, was already mirroring while this travelled the
        // other way.
        'zero-daisy-indeterminate': 'from { margin-inline-start: -40%; } to { margin-inline-start: 100%; }',
    },
    // The same sweep with a physical margin: logical spellings resolve on
    // iOS but not on Android (measured, signalxjs/lynx#1084), so the emitter
    // refuses the shared keyframes. Physical is the lynx target's norm — no
    // RTL flow there for the sweep to mirror with. Keyframes merge per name,
    // so this REPLACES the shared animation on lynx.
    targets: {
        lynx: {
            keyframes: {
                'zero-daisy-indeterminate': 'from { margin-left: -40%; } to { margin-left: 100%; }',
            },
        },
    },
};

export const slider: RecipeInput = {
    component: 'slider',
    tokens: { '--slider-accent': 'var(--color-primary)' },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', width: '100%' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
        },
        label: {
            base: { fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' },
            states: { disabled: {} },
        },
        control: {
            base: { width: '100%', accentColor: 'var(--slider-accent)', cursor: 'pointer' },
            states: {
                disabled: { cursor: 'not-allowed' },
                'focus-visible': { outline: '2px solid var(--slider-accent)', outlineOffset: '2px' },
                // `invalid` is semantic: it stays error under every colour
                // variant, on purpose.
                invalid: { accentColor: 'var(--color-error)' },
            },
        },
        // The composed range projection (#325). The native control above
        // stays UA-drawn behind `accentColor`; the composed parts restate the
        // same accent as real boxes. The fill is deepened toward
        // `base-content` the way `progressFill` deepens daisy's bar — a raw
        // role on the base-300 rail is exactly the #210/#228 bug class.
        track: {
            base: {
                height: 'calc(var(--size-selector) * 2)',
                marginBlock: 'calc(var(--size-selector) * 1.5)',
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
                background: 'color-mix(in oklab, var(--slider-accent) 90%, var(--color-base-content))',
            },
            states: { disabled: {} },
        },
        thumb: {
            base: {
                boxSizing: 'border-box',
                width: 'calc(var(--size-selector) * 5)',
                height: 'calc(var(--size-selector) * 5)',
                insetBlockStart: '50%',
                translate: '0 -50%',
                marginInlineStart: 'calc(var(--size-selector) * -2.5)',
                borderRadius: '9999px',
                background: 'color-mix(in oklab, var(--slider-accent) 90%, var(--color-base-content))',
                cursor: 'pointer',
                outline: 'none',
                touchAction: 'none',
            },
            states: {
                'focus-visible': { outline: '2px solid var(--slider-accent)', outlineOffset: '2px' },
                pressed: {},
                disabled: { cursor: 'not-allowed' },
            },
        },
        mark: {
            base: {
                paddingBlockStart: 'calc(var(--size-selector) * 2 + var(--space-2xs))',
                fontSize: 'var(--text-xs)',
                lineHeight: '1',
                whiteSpace: 'nowrap',
                opacity: '0.6',
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
                    background: 'var(--color-base-content)',
                },
            },
        },
        'value-text': {
            base: { fontSize: 'var(--text-xs)', opacity: '0.6' },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--slider-accent': `var(--color-${c})`,
        } } }])),
        // A native range widget: only its box height is size-able without an
        // appearance:none rebuild, so the ramp moves the box and the text.
        size: {
            xs: { control: { base: { height: 'calc(var(--size-selector) * 3)' } }, label: { base: { fontSize: 'var(--text-xs)' } } },
            sm: { control: { base: { height: 'calc(var(--size-selector) * 4)' } }, label: { base: { fontSize: 'var(--text-sm)' } } },
            md: { label: { base: { fontSize: 'var(--text-sm)' } } },
            lg: { control: { base: { height: 'calc(var(--size-selector) * 7)' } }, label: { base: { fontSize: 'var(--text-md)' } } },
            xl: { control: { base: { height: 'calc(var(--size-selector) * 8)' } }, label: { base: { fontSize: 'var(--text-lg)' } } },
        },
    },
    // Base equals the default — `tokens:` binds the primary accent, and `md`
    // only restates the label font-size the base already declares (the
    // control's base height IS the middle step) — so the twins restate it;
    // declared for the manifest (signalxjs/lynx#1070).
    defaultVariants: { color: 'primary', size: 'md' },
    skipStates: { root: ['invalid', 'focus-visible'] },
    // ONE design decision, two paints. On the web the accent reaches the
    // screen twice: the native control is UA-drawn behind `accent-color`, and
    // the composed range/thumb deepen the accent with `color-mix()`. Lynx
    // renders neither spelling — `accent-color` styles a native
    // `<input type=range>` lynx does not have, and the emitter drops
    // `color-mix()` as unresolvable — so the compiled range and thumb shipped
    // with no paint at all: grey track, invisible fill, invisible knob
    // (measured on device, signalxjs/lynx#1075). The geometry all survives
    // (the sizes are direct calc(), proven working); paint is the only gap,
    // so this section only restates paint, in lynx-expressible spellings.
    targets: {
        lynx: {
            parts: {
                track: {
                    // The web track's `margin-block` breathing room,
                    // restated physically: logical spellings resolve on iOS
                    // but not on Android (measured, signalxjs/lynx#1084), so
                    // the emitter refuses them. Physical is the lynx
                    // target's norm — no RTL flow there.
                    base: {
                        marginTop: 'calc(var(--size-selector) * 1.5)',
                        marginBottom: 'calc(var(--size-selector) * 1.5)',
                    },
                },
                mark: {
                    // Same #1084 verdict: the tick labels hang below the
                    // track off a physical padding.
                    base: { paddingTop: 'calc(var(--size-selector) * 2 + var(--space-2xs))' },
                },
                range: {
                    // The web fill deepens the accent 90/10 toward
                    // base-content (`progressFill`'s recipe); the plain
                    // accent — a var() chain, proven working on device — is
                    // the closest lynx-expressible equivalent.
                    base: { background: 'var(--slider-accent)' },
                },
                thumb: {
                    // daisy's real range thumb, ported from daisyUI 5
                    // `range.css` `::-webkit-slider-thumb`. The source reads
                    // `background-color: var(--range-thumb)` +
                    // `border: var(--range-p) solid` in the range's
                    // currentColor; here each resolves to its value —
                    // `--range-thumb` defaults to `var(--color-base-100)`,
                    // `--range-p` is daisy's literal `.25rem` (deliberately
                    // not the theme's size token), and the border ink is the
                    // accent (currentColor on a daisy `.range-*` IS the
                    // accent role) — because on lynx a named value is a
                    // var-chain fewer to resolve. daisy paints the progress
                    // fill itself as a 100cqw box-shadow thrown off this
                    // thumb — a native-input trick with no lynx equivalent;
                    // the composed `.zx-slider__range` box above IS that
                    // fill here, so the knob only needs its own two paints.
                    //
                    // The centering geometry is restated physically beside
                    // the paint: `inset-block-start`/`translate`/
                    // `margin-inline-start` resolve on iOS but not on
                    // Android (measured, signalxjs/lynx#1084 — the knob sat
                    // off-center there), so the emitter refuses them.
                    // `top` + `transform: translateY()` + `margin-left` are
                    // proven on both platforms.
                    base: {
                        background: 'var(--color-base-100)',
                        border: '0.25rem solid var(--slider-accent)',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        marginLeft: 'calc(var(--size-selector) * -2.5)',
                    },
                },
            },
        },
    },
};

export const accordion: RecipeInput = {
    component: 'accordion',
    // Same accent grammar as collapsible: the open heading's ink, defaulting
    // to base-content so the un-attributed render is unchanged.
    tokens: { '--accordion-accent': 'var(--color-base-content)' },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' },
        },
        item: withPresence(disclosurePresence, {
            base: {
                border: 'var(--border) solid var(--color-base-300)',
                borderRadius: 'var(--radius-box)',
                background: 'var(--color-base-100)',
                overflow: 'hidden',
            },
            states: { open: {}, closed: {} },
        }),
        trigger: {
            base: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-xl) var(--space-2xl)',
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--weight-semibold)',
                cursor: 'pointer',
                listStyle: 'none',
            },
            states: {
                hover: { background: 'var(--color-base-200)' },
                // No-op with the default accent — the state `data-color`'s
                // ink lands on, exactly as collapsible does it.
                open: { color: 'var(--accordion-accent)' },
                closed: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&::after': {
                    content: '""',
                    width: '0.5rem',
                    height: '0.5rem',
                    border: '2px solid currentColor',
                    borderTop: 'none',
                    borderLeft: 'none',
                    transform: 'rotate(45deg)',
                    transition: 'transform var(--duration-normal) var(--ease-standard)',
                    opacity: '0.6',
                },
                '&[data-state="open"]::after': { transform: 'rotate(225deg)' },
            },
        },
        panel: {
            base: { padding: '0 var(--space-2xl) var(--space-xl)', fontSize: 'var(--text-md)' },
            states: { open: {}, closed: {} },
        },
    },
    variants: {
        // The open heading's ink per role — `roleInk`, since it is ink on a
        // base surface (#210).
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--accordion-accent': roleInk(c),
        } } }])),
        size: disclosureSizes,
    },
    // Size only: `md: {}` emits nothing, so no CSS changes — manifest fact for
    // signalxjs/lynx#1070. No `color` default: the un-attributed accent is
    // base-content ink, outside the color vocabulary.
    defaultVariants: { size: 'md' },
};

/**
 * The metrics every form control shares: the `md` height off the ramp above,
 * daisy's field inset and the `xs` lift that makes a field read as raised
 * rather than drawn.
 *
 * Deliberately NOT `btn`. `btn` is the daisy button chip — `appearance`,
 * typography, `cursor`, the hover transition — and it is worn by six other
 * parts (dialog/popover/menu/tooltip triggers, dialog/popover close). A field
 * is not a button; only the box metrics are common, so only the box metrics
 * are shared. `select`'s trigger IS a daisy btn and keeps `btn` as well: the
 * two spreads agree on every property they both name, so its only new
 * declaration is the `box-sizing` below and it renders exactly as it shipped.
 *
 * `box-sizing` is stated because the three parts are not the same element.
 * `select/trigger` is a `<button>`, which every UA stylesheet gives
 * `border-box`; `combobox/control` and `number-input/control` are `<div>`s,
 * which are `content-box` — the same `height` measured 48px on one and 50px on
 * the others. zero's `base.css` ships no reset (it is structural, not visual),
 * so a shared height is only shared if the box it measures is stated with it.
 */
const fieldControl: NonNullable<PartStyles['base']> = {
    boxSizing: 'border-box',
    height: fieldHeight('md'),
    background: 'var(--color-base-100)',
    border: 'var(--border) solid var(--color-base-300)',
    borderRadius: 'var(--radius-field)',
    boxShadow: 'var(--shadow-xs)',
};

export const select: RecipeInput = {
    component: 'select',
    // Accent as text/border ink only — daisy's highlighted item is a neutral
    // base-200 wash, so no `-on-accent` content colour is consumed here.
    tokens: { '--select-accent': 'var(--color-primary)' },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column' },
        },
        trigger: {
            base: {
                ...btn,
                ...fieldControl,
                justifyContent: 'space-between',
                gap: 'var(--space-lg)',
                minWidth: '13rem',
                fontWeight: 'var(--weight-medium)',
            },
            states: {
                hover: { borderColor: 'var(--color-base-content)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                open: { borderColor: 'var(--select-accent)' },
                closed: {},
                // `invalid` is semantic: it stays error under every colour
                // variant, on purpose.
                invalid: { borderColor: 'var(--color-error)' },
                placeholder: {},
                ...focusRing,
            },
        },
        value: {
            base: {},
            states: {
                /**
                 * The placeholder's muting is a COLOUR, not an `opacity`.
                 *
                 * `opacity` is a multiplier on whatever ink the theme happens
                 * to supply, so one value was correct in four daisy themes and
                 * wrong in the fifth: on nord the base ink is already muted and
                 * the 0.5 fade compounded past the floor, to 2.71:1 (#264). An
                 * alpha stated on `color` composites the same way but stays on
                 * the TEXT — it cannot take a child down with it.
                 *
                 * 60% is the minimal correction: it keeps the placeholder as
                 * close to daisy's own 0.5 as the floor allows, it is the same
                 * muting `tabs/tab` already uses, and it lands nord — the theme
                 * that sets the level for all five — at 3.49:1. 70% was tried
                 * first and reached 4.59:1, which clears the floor by more than
                 * it needs to and makes a placeholder look like filled text.
                 */
                placeholder: { color: 'color-mix(in oklab, var(--color-base-content) 60%, transparent)' },
            },
        },
        indicator: {
            base: { opacity: '0.6', transition: 'transform var(--duration-normal) var(--ease-standard)' },
            states: { open: { transform: 'rotate(180deg)' }, closed: {} },
        },
        popup: withPresence(popupPresence('translateY(-4px)'), {
            base: { ...floatingPanel, padding: 'var(--space-md)', minWidth: '13rem' },
            states: { open: {}, closed: {} },
        }),
        // The optgroup equivalent (#325) — the menu's group grammar.
        group: { base: {} },
        'group-label': {
            base: {
                padding: 'var(--space-md) var(--space-lg) var(--space-xs)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-bold)',
                opacity: '0.6',
            },
        },
        item: {
            base: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-md)',
                padding: 'var(--space-md) var(--space-lg)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                borderRadius: 'var(--radius-field)',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                highlighted: { background: 'var(--color-base-200)' },
                selected: { color: 'var(--select-accent)', fontWeight: 'var(--weight-bold)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
        },
        'item-indicator': {
            base: { fontSize: 'var(--text-xs)', color: 'var(--select-accent)' },
            states: { selected: {} },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--select-accent': `var(--color-${c})`,
        } } }])),
        // The trigger is a daisy btn, so it sizes the btn way: a fixed
        // height off the shared field ramp plus paddingInline.
        size: {
            xs: { trigger: { base: { height: fieldHeight('xs'), paddingInline: 'calc(var(--size-field) * 2)', fontSize: 'var(--text-xs)' } } },
            sm: { trigger: { base: { height: fieldHeight('sm'), paddingInline: 'calc(var(--size-field) * 3)', fontSize: 'var(--text-sm)' } } },
            md: { trigger: { base: { height: fieldHeight('md'), paddingInline: 'calc(var(--size-field) * 4)', fontSize: 'var(--text-sm)' } } },
            lg: { trigger: { base: { height: fieldHeight('lg'), paddingInline: 'calc(var(--size-field) * 5)', fontSize: 'var(--text-md)' } } },
            xl: { trigger: { base: { height: fieldHeight('xl'), paddingInline: 'calc(var(--size-field) * 6)', fontSize: 'var(--text-lg)' } } },
        },
    },
    // Base equals the default (`tokens:` accent, `fieldControl`'s md height),
    // so the twins restate it; declared for the manifest (signalxjs/lynx#1070).
    defaultVariants: { color: 'primary', size: 'md' },
    // The btn paddings, restated physically — see `lynxBtnPad` (#1084).
    // The trigger ramp restates `md` too (unlike `btnSizes`), so its lynx
    // counterpart does as well.
    targets: {
        lynx: {
            parts: { trigger: { base: lynxBtnPad(4) } },
            variants: {
                size: { ...lynxBtnSizes('trigger'), md: { trigger: { base: lynxBtnPad(4) } } },
            },
        },
    },
};


/**
 * daisy's BUTTON ramp — `.btn`'s fixed height per size step, in `--size-field`
 * units, exactly as daisyUI 5 ships it (`components/button.css`: `.btn-xs`
 * `--size: calc(var(--size-field, .25rem) * 6)` through `.btn-xl` `* 14`,
 * `.btn`/`.btn-md` `* 10` — 1.5 / 2 / 2.5 / 3 / 3.5rem at the default
 * `--size-field: 0.25rem`).
 *
 * Its own table, not `FIELD_STEPS`: this repo's field ramp sits one step
 * higher than daisy's (md = 12 units, 3rem), and restating the button off it
 * would bake that offset into a second component. The button states daisy's
 * own numbers; #376 is exactly what happened while it had no height at all —
 * padding alone rendered md at ~30px against daisy's 40px.
 */
const BTN_STEPS = { xs: 6, sm: 8, md: 10, lg: 12, xl: 14 } as const;
const btnHeight = (step: keyof typeof BTN_STEPS): string =>
    `calc(var(--size-field) * ${BTN_STEPS[step]})`;

export const button: RecipeInput = {
    component: 'button',
    // The two axes meet here instead of multiplying. `color` sets the accent
    // pair; `variant` decides how the accent is used. 8 + 4 + 5 rules rather
    // than 8 × 4.
    tokens: {
        '--btn-accent': 'var(--color-primary)',
        '--btn-on-accent': 'var(--color-primary-content)',
        '--btn-soft': 'var(--color-primary-soft)',
        '--btn-ink': roleInk('primary'),
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
                boxShadow: 'var(--shadow-xs)',
                fontFamily: 'inherit',
                fontWeight: 'var(--weight-semibold)',
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard), '
                    + 'border-color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                // The ring is drawn on the page, offset clear of the button —
                // ink, not fill, and the same 3:1 floor. On `--btn-accent` it
                // was the same 1.22:1 `neutral` the label was.
                'focus-visible': {
                    outline: '2px solid var(--btn-ink)',
                    outlineOffset: '2px',
                },
            },
            selectors: {
                // Pressed: the runtime's press feedback, not `:active` — same
                // sink, but with keyboard parity and drag-off semantics the
                // pseudo-class can't guarantee across browsers. The :not
                // keeps specificity EQUAL to the hover rule — pressed then
                // wins by source order, as :active did — and covers a press
                // that goes disabled mid-gesture.
                '&[data-pressed]:not([data-disabled])': { transform: 'translateY(1px)', boxShadow: 'none' },
            },
        },
    },
    variants: {
        // One rule per role rather than per role × fill: the fill
        // variants below read these two tokens, so adding a colour
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
                            '--btn-ink': roleInk(c),
                        },
                    },
                },
            ]),
        ),
        variant: {
            solid: {
                root: {
                    base: { background: 'var(--btn-accent)', color: 'var(--btn-on-accent)' },
                    states: { hover: { filter: 'brightness(0.92)' } },
                },
            },
            // The three fills that paint no `-content` pair read `--btn-ink`,
            // never `--btn-accent`: on a transparent or `-soft` surface the raw
            // role has no contrast guarantee (#210). `solid` above keeps the
            // raw accent, because there it is the fill and `--btn-on-accent`
            // is the pair that answers for it.
            outline: {
                root: {
                    base: {
                        background: 'transparent',
                        color: 'var(--btn-ink)',
                        // The border is the whole variant: a 1.22:1 hairline is
                        // an invisible box, so it takes the ink too.
                        borderColor: 'var(--btn-ink)',
                    },
                    states: { hover: { background: 'var(--btn-soft)' } },
                },
            },
            soft: {
                root: {
                    base: { background: 'var(--btn-soft)', color: 'var(--btn-ink)' },
                    states: { hover: { filter: 'brightness(0.95)' } },
                },
            },
            ghost: {
                root: {
                    base: { background: 'transparent', color: 'var(--btn-ink)' },
                    states: { hover: { background: 'var(--btn-soft)' } },
                },
            },
            // daisy 5's `btn-dash` (#332): `outline` with the border drawn
            // dashed — same ink, same hover tint, so it inherits outline's
            // measured contrast margins unchanged.
            dash: {
                root: {
                    base: {
                        background: 'transparent',
                        color: 'var(--btn-ink)',
                        borderColor: 'var(--btn-ink)',
                        borderStyle: 'dashed',
                    },
                    states: { hover: { background: 'var(--btn-soft)' } },
                },
            },
            // daisy 5's `btn-link` (#332): the button box kept (metrics,
            // focus ring, press feedback), painted as a link — role ink,
            // underlined, no fill, no lift. The underline thickens on hover
            // rather than the ink dimming: a brightness dip on bare ink would
            // eat the ~3.1:1 margin `roleInk` clears on its worst themes.
            link: {
                root: {
                    base: {
                        background: 'transparent',
                        color: 'var(--btn-ink)',
                        textDecoration: 'underline',
                        textUnderlineOffset: '2px',
                        boxShadow: 'none',
                    },
                    states: { hover: { textDecorationThickness: '2px' } },
                },
            },
        },
        // daisy sizes a btn by fixed height (`--size`), not by padding: each
        // step states its `BTN_STEPS` height and keeps the padding/font ramps
        // for inline air; the root's flex centering absorbs the block axis.
        // The `<button>` element is UA `border-box`, so the stated height is
        // the rendered height, border included — as in daisy.
        size: {
            xs: { root: { base: { height: btnHeight('xs'), padding: 'var(--space-2xs) var(--space-xs)', fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { height: btnHeight('sm'), padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--text-sm)' } } },
            md: { root: { base: { height: btnHeight('md'), padding: 'var(--space-sm) var(--space-lg)', fontSize: 'var(--text-md)' } } },
            lg: { root: { base: { height: btnHeight('lg'), padding: 'var(--space-md) var(--space-xl)', fontSize: 'var(--text-lg)' } } },
            xl: { root: { base: { height: btnHeight('xl'), padding: 'var(--space-lg) var(--space-2xl)', fontSize: 'var(--text-xl)' } } },
        },
    },
    /**
     * daisy's button modifiers (#332), each a documented daisy 5 `btn-*`
     * class and a boolean prop on the old `@sigx/daisyui` Button. Emitted
     * after the variant rules at equal specificity, so a modifier wins the
     * declarations it restates — which is what `btn-square`'s zeroed inline
     * padding relies on.
     */
    modifiers: {
        // `btn-wide`: full width, capped at daisy's 16rem (w-full max-w-64).
        wide: { root: { base: { inlineSize: '100%', maxInlineSize: '16rem' } } },
        // `btn-block`: the full-width form action.
        block: { root: { base: { inlineSize: '100%' } } },
        // `btn-square` / `btn-circle`: a 1:1 icon chip. The inline padding
        // goes to zero and `aspect-ratio` squares the box off the height the
        // size axis already sets — so both track the ramp with no per-size
        // metrics of their own.
        square: { root: { base: { paddingInline: '0', aspectRatio: '1' } } },
        circle: { root: { base: { paddingInline: '0', aspectRatio: '1', borderRadius: '9999px' } } },
        // `btn-active`: "looks active" — the pressed rendering, held. Same
        // sink and shadow-drop as the runtime's press feedback plus the
        // solid hover's brightness dip, so a toggled-on button reads as the
        // press it represents.
        active: {
            root: { base: { transform: 'translateY(1px)', boxShadow: 'none', filter: 'brightness(0.92)' } },
        },
        /**
         * daisy's loading spinner, drawn by the recipe (#332): daisy marks
         * the button with a `loading loading-spinner` span; zero changes no
         * DOM, so the ring is a `::before` in `currentColor` with one
         * transparent quadrant — it inherits whatever ink the variant chose,
         * and the root's existing `gap` spaces it from the label. Literal
         * duration + explicit reduced-motion `none`, like the spinner
         * recipe: the kit collapses `--duration-*` under reduced motion, and
         * an infinite loop at ~0s strobes rather than stops.
         */
        loading: {
            root: {
                base: { cursor: 'progress' },
                selectors: {
                    '&::before': {
                        content: '""',
                        boxSizing: 'border-box',
                        inlineSize: '1em',
                        blockSize: '1em',
                        flex: 'none',
                        borderRadius: '9999px',
                        border: 'calc(var(--border) * 2) solid currentColor',
                        borderBlockStartColor: 'transparent',
                        animation: 'zero-daisyui-btn-spin 0.7s linear infinite',
                    },
                },
                at: {
                    'reduced-motion': { selectors: { '&::before': { animation: 'none' } } },
                },
            },
        },
    },
    defaultVariants: { color: 'primary', variant: 'solid', size: 'md' },
    keyframes: { 'zero-daisyui-btn-spin': 'to { transform: rotate(360deg) }' },
    // The icon chips' zeroed inline padding, restated physically: logical
    // spellings resolve on iOS but not on Android (measured,
    // signalxjs/lynx#1084), so the emitter refuses them.
    targets: {
        lynx: {
            modifiers: {
                square: { root: { base: { paddingLeft: '0', paddingRight: '0' } } },
                circle: { root: { base: { paddingLeft: '0', paddingRight: '0' } } },
            },
        },
    },
};

export const avatar: RecipeInput = {
    component: 'avatar',
    tokens: {
        '--avatar-size': 'calc(var(--size-selector) * 10)',
        '--avatar-text': 'var(--text-sm)',
        '--avatar-ring': 'var(--color-primary)',
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
                background: 'var(--color-base-200)',
                // daisy's avatar ring, in role color.
                boxShadow: '0 0 0 2px var(--color-base-100), 0 0 0 4px var(--avatar-ring)',
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
                background: 'var(--color-neutral)',
                color: 'var(--color-neutral-content)',
                fontSize: 'var(--avatar-text)',
                fontWeight: 'var(--weight-semibold)',
                userSelect: 'none',
            },
            // `display` must not defeat the `hidden` zero sets once the image
            // has loaded.
            selectors: { '&:not([hidden])': { display: 'grid' } },
            states: { loading: {}, loaded: {}, error: {} },
        },
    },
    variants: {
        // daisy colours the RING, not the fallback — that is what its avatar
        // does, and the fallback stays neutral so initials read the same
        // whichever role is chosen.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--avatar-ring': `var(--color-${c})`,
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
 * Toast presence is runtime-managed (see the SKILL's Toast section): plain
 * two-state transitions only — no `@starting-style`, no `allow-discrete`.
 */
export const toast: RecipeInput = {
    component: 'toast',
    tokens: {
        '--toast-bg': 'var(--color-base-200)',
        '--toast-ink': 'var(--color-base-content)',
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
        // daisy's alert, floating: soft role fill, generous radius.
        root: {
            base: {
                pointerEvents: 'auto',
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                alignItems: 'center',
                columnGap: 'var(--space-md)',
                padding: 'var(--space-md) var(--space-lg)',
                background: 'var(--toast-bg)',
                color: 'var(--toast-ink)',
                borderRadius: 'var(--radius-box)',
                boxShadow: 'var(--shadow-lg)',
                fontSize: 'var(--text-sm)',
                opacity: '0',
                transform: 'translateY(var(--toast-from))',
                transition: 'opacity var(--duration-normal) var(--ease-standard), '
                    + 'transform var(--duration-normal) var(--ease-standard)',
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
            base: { gridColumn: '1', fontWeight: 'var(--weight-semibold)' },
        },
        description: {
            base: {
                gridColumn: '1',
                fontSize: 'var(--text-xs)',
                color: 'color-mix(in oklab, var(--toast-ink) 75%, transparent)',
            },
        },
        action: {
            base: {
                gridColumn: '2',
                gridRow: '1',
                appearance: 'none',
                border: 'var(--border) solid color-mix(in oklab, var(--toast-ink) 25%, transparent)',
                background: 'transparent',
                color: 'var(--toast-ink)',
                borderRadius: '9999px',
                padding: 'var(--space-2xs) var(--space-md)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semibold)',
                cursor: 'pointer',
            },
            states: {
                hover: { background: 'color-mix(in oklab, var(--toast-ink) 10%, transparent)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
        },
        close: {
            base: {
                gridColumn: '3',
                gridRow: '1',
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'var(--toast-ink)',
                borderRadius: '9999px',
                padding: 'var(--space-2xs) var(--space-xs)',
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
            },
            states: {
                hover: { background: 'color-mix(in oklab, var(--toast-ink) 10%, transparent)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
                ...focusRing,
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((role) => [
            role,
            {
                root: {
                    base: {
                        '--toast-bg': `var(--color-${role}-soft)`,
                        '--toast-ink': `var(--color-${role})`,
                    },
                },
            },
        ])),
        // Size moves the alert's box — padding and type — never its role
        // tint. The description meta-text steps only at the wide end.
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
    // Size only: `md: {}` emits nothing, so no CSS changes — manifest fact for
    // signalxjs/lynx#1070. No `color` default: the un-attributed toast is a
    // neutral base-200 surface, outside the color vocabulary.
    defaultVariants: { size: 'md' },
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
    // Accent as text/border ink only — daisy's highlighted item is a neutral
    // base-200 wash, so no `-on-accent` content colour is consumed here.
    tokens: { '--combobox-accent': 'var(--color-primary)' },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column' },
        },
        // `alignItems: stretch`, not `center`: the control now has a height of
        // its own, and a 48px field whose input occupies the middle 31px is a
        // worse thing than the drift. The input and the trigger fill it, so the
        // whole field is the target — the same reason `number-input` stretches.
        control: {
            base: {
                display: 'inline-flex',
                alignItems: 'stretch',
                minWidth: '13rem',
                ...fieldControl,
                transition: 'border-color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { borderColor: 'var(--color-base-content)' },
                open: { borderColor: 'var(--combobox-accent)' },
                closed: {},
                // `invalid` is semantic: it stays error under every colour
                // variant, on purpose.
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
                font: 'inherit',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                padding: 'var(--space-sm) var(--space-lg)',
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
                // Same muting, same reason as `select/value` above: a colour
                // rather than an `opacity`, at the level nord clears the floor
                // at. A pseudo-element is out of the audit's reach, so this
                // half is fixed by argument rather than by measurement (#264).
                '&::placeholder': { color: 'color-mix(in oklab, var(--color-base-content) 60%, transparent)' },
            },
        },
        trigger: {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                opacity: '0.6',
                padding: '0 var(--space-lg)',
                cursor: 'pointer',
                transition: 'transform var(--duration-normal) var(--ease-standard)',
            },
            states: {
                open: { transform: 'rotate(180deg)' },
                closed: {},
                disabled: { cursor: 'not-allowed' },
            },
        },
        popup: withPresence(popupPresence('translateY(-4px)'), {
            base: { ...floatingPanel, padding: 'var(--space-md)', minWidth: '13rem' },
            states: { open: {}, closed: {} },
        }),
        // The optgroup equivalent (#325) — the menu's group grammar.
        group: { base: {} },
        'group-label': {
            base: {
                padding: 'var(--space-md) var(--space-lg) var(--space-xs)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-bold)',
                opacity: '0.6',
            },
        },
        item: {
            base: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-md)',
                padding: 'var(--space-md) var(--space-lg)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                borderRadius: 'var(--radius-field)',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                highlighted: { background: 'var(--color-base-200)' },
                selected: { color: 'var(--combobox-accent)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
        },
        'item-indicator': {
            base: { fontSize: 'var(--text-xs)' },
            states: { selected: {} },
        },
        empty: {
            base: {
                padding: 'var(--space-lg)',
                fontSize: 'var(--text-sm)',
                textAlign: 'center',
                opacity: '0.6',
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--combobox-accent': `var(--color-${c})`,
        } } }])),
        // The control carries the height — the shared field ramp, the same one
        // `select`'s trigger steps on — and the input carries the inset and the
        // type. `md` restates exactly the resting values so the union stays
        // complete.
        size: {
            xs: { control: { base: { height: fieldHeight('xs') } }, input: { base: { padding: 'var(--space-2xs) var(--space-md)', fontSize: 'var(--text-xs)' } } },
            sm: { control: { base: { height: fieldHeight('sm') } }, input: { base: { padding: 'var(--space-xs) var(--space-md)', fontSize: 'var(--text-sm)' } } },
            md: { control: { base: { height: fieldHeight('md') } }, input: { base: { padding: 'var(--space-sm) var(--space-lg)', fontSize: 'var(--text-sm)' } } },
            lg: { control: { base: { height: fieldHeight('lg') } }, input: { base: { padding: 'var(--space-md) var(--space-xl)', fontSize: 'var(--text-md)' } } },
            xl: { control: { base: { height: fieldHeight('xl') } }, input: { base: { padding: 'var(--space-lg) var(--space-2xl)', fontSize: 'var(--text-lg)' } } },
        },
    },
    // The visible ring lives on `control`; input and trigger delegate.
    skipStates: {
        input: ['focus-visible'],
        trigger: ['focus-visible'],
    },
};

// daisy "btn" that stays pressed: the off state is the neutral btn, the on
// state is the solid accent fill.
export const toggle: RecipeInput = {
    component: 'toggle',
    // Same accent machinery as button: `color` sets the pair once, the on
    // state consumes it — a role costs one rule, not one per state.
    tokens: {
        '--toggle-accent': 'var(--color-primary)',
        '--toggle-on-accent': 'var(--color-primary-content)',
        '--toggle-soft': 'var(--color-primary-soft)',
    },
    parts: {
        root: {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5em',
                color: 'var(--color-base-content)',
                background: 'var(--color-base-200)',
                border: 'var(--border) solid var(--color-base-300)',
                borderRadius: 'var(--radius-field)',
                boxShadow: 'var(--shadow-xs)',
                fontFamily: 'inherit',
                fontWeight: 'var(--weight-semibold)',
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard), '
                    + 'color var(--duration-fast) var(--ease-standard), '
                    + 'border-color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { background: 'var(--color-base-300)' },
                on: {
                    background: 'var(--toggle-accent)',
                    color: 'var(--toggle-on-accent)',
                    borderColor: 'var(--toggle-accent)',
                },
                off: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                'focus-visible': {
                    outline: '2px solid var(--toggle-accent)',
                    outlineOffset: '2px',
                },
            },
            selectors: {
                // Hover on an on toggle must not fade toward the neutral hover
                // wash — equal specificity, later in source, so on wins; the
                // filter supplies daisy's darkened-fill hover instead.
                '&[data-state="on"]:hover': {
                    background: 'var(--toggle-accent)',
                    filter: 'brightness(0.92)',
                },
                // Pressed: the runtime's press feedback, not `:active` — see
                // the button recipe for why the :not matters.
                '&[data-pressed]:not([data-disabled])': { transform: 'translateY(1px)', boxShadow: 'none' },
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
                            '--toggle-on-accent': `var(--color-${c}-content)`,
                            '--toggle-soft': `var(--color-${c}-soft)`,
                        },
                    },
                },
            ]),
        ),
        size: {
            xs: { root: { base: { padding: 'var(--space-2xs) var(--space-xs)', fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--text-sm)' } } },
            md: { root: { base: { padding: 'var(--space-sm) var(--space-lg)', fontSize: 'var(--text-md)' } } },
            lg: { root: { base: { padding: 'var(--space-md) var(--space-xl)', fontSize: 'var(--text-lg)' } } },
            xl: { root: { base: { padding: 'var(--space-lg) var(--space-2xl)', fontSize: 'var(--text-xl)' } } },
        },
    },
    defaultVariants: { color: 'primary', size: 'md' },
};

// daisy "join" of btns: one bordered capsule, hairline seams between items,
// the on item filled with the accent.
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
                background: 'var(--color-base-200)',
                border: 'var(--border) solid var(--color-base-300)',
                borderRadius: 'var(--radius-field)',
                boxShadow: 'var(--shadow-xs)',
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
                gap: '0.5em',
                background: 'transparent',
                color: 'var(--color-base-content)',
                border: 'none',
                padding: 'var(--space-sm) var(--space-lg)',
                fontFamily: 'inherit',
                fontWeight: 'var(--weight-semibold)',
                fontSize: 'var(--text-sm)',
                lineHeight: 'var(--leading-none)',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard), '
                    + 'color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { background: 'var(--color-base-300)' },
                on: {
                    background: 'var(--toggle-group-accent)',
                    color: 'var(--toggle-group-on-accent)',
                },
                off: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                'focus-visible': {
                    // The group clips its children (joined corners), so an
                    // offset ring would be swallowed — inset it instead.
                    outline: '2px solid var(--toggle-group-accent)',
                    outlineOffset: '-2px',
                },
            },
            selectors: {
                // On beats hover by source order at equal specificity; the
                // filter supplies daisy's darkened-fill hover instead.
                '&[data-state="on"]:hover': {
                    background: 'var(--toggle-group-accent)',
                    filter: 'brightness(0.92)',
                },
                // The join seams, flipping to the block axis when vertical.
                '&[data-orientation="horizontal"] + &': {
                    borderInlineStart: 'var(--border) solid var(--color-base-300)',
                },
                '&[data-orientation="vertical"] + &': {
                    borderBlockStart: 'var(--border) solid var(--color-base-300)',
                },
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
            lg: { item: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-md) var(--space-xl)' } } },
            xl: { item: { base: { fontSize: 'var(--text-lg)', padding: 'var(--space-lg) var(--space-2xl)' } } },
        },
        color: Object.fromEntries(
            ROLES.map((c) => [
                c,
                {
                    item: {
                        base: {
                            '--toggle-group-accent': `var(--color-${c})`,
                            '--toggle-group-on-accent': `var(--color-${c}-content)`,
                        },
                    },
                },
            ]),
        ),
    },
    defaultVariants: { color: 'primary' },
};

// daisy "join" of an input and two btns: one bordered capsule (the control),
// hairline seams on the triggers' inner edges, neutral btn fills for the steppers.
export const numberInput: RecipeInput = {
    component: 'number-input',
    tokens: { '--number-input-accent': 'var(--color-base-content)' },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-sm)' },
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        },
        label: {
            base: { fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                invalid: { color: roleInk('error') },
                required: {},
            },
        },
        // The field chrome (combobox split): the ring and the invalid border
        // draw on the box; input and triggers sit joined inside it.
        control: {
            base: {
                display: 'inline-flex',
                alignItems: 'stretch',
                ...fieldControl,
                overflow: 'hidden',
                transition: 'border-color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { borderColor: 'var(--color-base-content)' },
                invalid: { borderColor: 'var(--color-error)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
                readonly: {},
                'focus-visible': { ...focusRing['focus-visible'], outline: '2px solid var(--number-input-accent)' },
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
                font: 'inherit',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                textAlign: 'center',
                padding: 'var(--space-sm) var(--space-md)',
            },
            states: {
                disabled: { cursor: 'not-allowed' },
                readonly: {},
                invalid: {},
                required: {},
            },
            selectors: {
                // Same muting, same reason as `select/value` above: a colour
                // rather than an `opacity`, at the level nord clears the floor
                // at. A pseudo-element is out of the audit's reach, so this
                // half is fixed by argument rather than by measurement (#264).
                '&::placeholder': { color: 'color-mix(in oklab, var(--color-base-content) 60%, transparent)' },
            },
        },
        // Steppers: compact join-item btns flanking the input. The decrement
        // renders before the input, the increment after — each seam is a
        // hairline on the trigger's inner edge.
        'increment-trigger': {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'var(--color-base-200)',
                color: 'var(--color-base-content)',
                fontFamily: 'inherit',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
                lineHeight: 'var(--leading-none)',
                paddingInline: 'var(--space-lg)',
                cursor: 'pointer',
                userSelect: 'none',
                borderInlineStart: 'var(--border) solid var(--color-base-300)',
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { background: 'var(--color-base-300)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
            selectors: {
                // Pressed: the runtime's press feedback, not `:active` — see
                // the button recipe for why the :not matters.
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)' },
            },
        },
        'decrement-trigger': {
            base: {
                appearance: 'none',
                border: 'none',
                background: 'var(--color-base-200)',
                color: 'var(--color-base-content)',
                fontFamily: 'inherit',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
                lineHeight: 'var(--leading-none)',
                paddingInline: 'var(--space-lg)',
                cursor: 'pointer',
                userSelect: 'none',
                borderInlineEnd: 'var(--border) solid var(--color-base-300)',
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { background: 'var(--color-base-300)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { background: 'var(--color-base-300)' },
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
        // The control carries the height — the shared field ramp, the same one
        // `select`'s trigger and `combobox`'s control step on — and the readout
        // carries the type; the steppers follow it so the frame stays
        // proportional.
        size: {
            xs: { control: { base: { height: fieldHeight('xs') } }, input: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-2xs) var(--space-xs)' } } },
            sm: { control: { base: { height: fieldHeight('sm') } }, input: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-xs) var(--space-sm)' } } },
            // `md` is the un-attributed render: the base already IS the
            // middle step, so restating it here would be a second copy free
            // to drift. An empty entry emits no rule and keeps the base.
            md: {},
            lg: { control: { base: { height: fieldHeight('lg') } }, input: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-md) var(--space-lg)' } } },
            xl: { control: { base: { height: fieldHeight('xl') } }, input: { base: { fontSize: 'var(--text-lg)', padding: 'var(--space-lg) var(--space-xl)' } } },
        },
    },
    // The steppers' inline padding, restated physically: logical spellings
    // resolve on iOS but not on Android (measured, signalxjs/lynx#1084), so
    // the emitter refuses them.
    targets: {
        lynx: {
            parts: {
                'increment-trigger': { base: { paddingLeft: 'var(--space-lg)', paddingRight: 'var(--space-lg)' } },
                'decrement-trigger': { base: { paddingLeft: 'var(--space-lg)', paddingRight: 'var(--space-lg)' } },
            },
        },
    },
};

/**
 * daisy "rating" flavor: a row of orange filled symbols. The default content
 * is a text star, so `color` + `font-size` carry the whole visual — and, for a
 * HALF, a two-layer mask.
 *
 * RATING_HALF_SPLIT — why this is daisy's technique on a different anatomy.
 * daisy halves a rating by rendering TWO half-width inputs per symbol
 * (`.rating-half *` → `width: calc(var(--size) * .5)`) and masking each to one
 * side of the star: `.mask-half-1` is `mask-position: 0; mask-size: 200%`,
 * `.mask-half-2` is `mask-position: 100%`. Neither half of that is available
 * here. zero's anatomy gives ONE `item` span per symbol, carrying
 * `full|half|empty` itself, and that span paints CONTENT (the symbol slot,
 * defaulting to a text star) where daisy's paints a `mask-image` the design
 * system owns. So the split moves off two masked siblings and onto one masked
 * element: two mask layers, an opaque one sized to the filled fraction and a
 * 25%-alpha one under it, which reproduces daisy's "solid leading half,
 * ghosted trailing half" on whatever symbol the consumer renders. It is
 * `mask-size` that differs between the states, so the fill wipes rather than
 * switches. What is NOT reproduced is daisy's two-hue split (its ghost half is
 * base-content, ours is the fill at low alpha) — a second hue needs a second
 * paint layer, and the only way to get one out of a text node is
 * `background-clip: text`, which would make an SVG symbol slot invisible.
 *
 * The mask HALVES whatever the item paints, so it depends on the symbol being
 * full width in all three states. zero's default is: `★`/`★`/`☆`, because the
 * half-star codepoint U+2BEA is tofu in the system stacks and the runtime
 * therefore does not attempt a half of its own (#222).
 */
/**
 * How far each role's rating symbol is deepened toward its own content pair.
 *
 * daisy's raw roles are not safe on bare paper — `--color-warning` sits at
 * 1.62:1 on light base-100 — so the symbol is mixed toward the role's own
 * `-content`, which keeps the hue. 70/30 was measured across all five themes
 * (#226) at 3.34 light, 4.74 dark, 4.19 dim, 5.32 sunset — and **2.81 on
 * `nord`**, whose pale-yellow warning on a 95%-white base-100 was the one cell
 * under 3:1.
 *
 * That comment ended "the fill/ghost pair needs a per-role decision … which is
 * the indicator-contrast audit's job (#228)". This is that decision, and it is
 * per-role because moving the ratio for EVERYONE is what does not work: at
 * 60/40 nord's warning clears (3.70) but two more theme×role cells drop under
 * 3:1 (sunset's `secondary` and `accent`), because deepening toward `-content`
 * helps a light theme and hurts a dark one. Deepening only the role that needs
 * it fixes nord's warning — the DEFAULT symbol, the one the audit measures —
 * and moves nothing else: warning at 60/40 reads 4.40 light, 3.60 dark, 3.17
 * dim, 3.70 nord, 4.03 sunset.
 *
 * The nine remaining sub-3:1 theme×role cells are daisy's own accent-on-paper
 * numbers and stay that way — the indicator audit measures the DEFAULT variant
 * only (`variants` would explode the matrix into thousands of cells), so they
 * are recorded here rather than allowlisted there.
 */
const RATING_DEEPEN: Record<string, number> = { warning: 60 };

const ratingFill = (role: string): string =>
    `color-mix(in oklab, var(--color-${role}) ${RATING_DEEPEN[role] ?? 70}%, var(--color-${role}-content))`;

export const ratingGroup: RecipeInput = {
    component: 'rating-group',
    tokens: {
        '--rating-size': 'calc(var(--size-selector) * 6)',
        '--rating-fill': ratingFill('warning'),
    },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-sm)' },
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        },
        label: {
            base: { fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                invalid: { color: roleInk('error') },
                required: {},
            },
        },
        control: {
            base: { display: 'inline-flex', gap: 'var(--space-2xs)' },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                readonly: {},
                'focus-visible': {
                    outline: '2px solid var(--color-base-content)',
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
                /**
                 * The unfilled symbol, in daisy's own model — base-content at
                 * reduced strength, nothing else changing.
                 *
                 * daisy's fraction is 20%, which measures 1.44:1 (nord) to
                 * 1.88:1 (dark) against base-100: five stars whose count you
                 * cannot read. 60% is the same fraction daisy's `--input-color`
                 * was raised to in this package, for the same reason and to the
                 * same floor — 4.66 light, 6.23 dark, 3.85 dim, 3.49 nord,
                 * 3.88 sunset (#228).
                 */
                color: 'color-mix(in oklab, var(--color-base-content) 60%, transparent)',
                // The split that makes a half a half — see RATING_HALF_SPLIT.
                // Both stops are ALPHA channels, not palette colours: the top
                // layer is opaque over the filled fraction, the bottom one
                // ghosts whatever it does not cover.
                maskImage: 'linear-gradient(black 0 0), linear-gradient(rgb(0 0 0 / 0.25) 0 0)',
                maskRepeat: 'no-repeat',
                maskPosition: '0 0, 0 0',
                maskSize: '100% 100%, 100% 100%',
                transition: 'color var(--duration-fast) var(--ease-standard), '
                    + 'mask-size var(--duration-fast) var(--ease-standard), '
                    + 'transform var(--duration-fast) var(--ease-standard), '
                    + 'filter var(--duration-fast) var(--ease-standard)',
            },
            states: {
                full: { color: 'var(--rating-fill)' },
                // Only `mask-size` moves, so the fill WIPES across the symbol
                // rather than switching — and at rest the split is daisy's
                // hard 50%.
                half: { color: 'var(--rating-fill)', maskSize: '50% 100%, 100% 100%' },
                empty: {},
                // The hover-preview range: daisy scales and brightens the
                // symbols under the pointer.
                highlighted: { transform: 'scale(1.15)', filter: 'brightness(1.1)' },
                disabled: { cursor: 'not-allowed' },
                readonly: { cursor: 'default' },
                // The group ring lives on control; per-item focus still gets
                // a marker for the value-following tab stop.
                'focus-visible': {
                    outline: '2px solid var(--color-base-content)',
                    outlineOffset: '1px',
                    borderRadius: 'var(--radius-selector)',
                },
            },
            selectors: {
                // A half fills from the inline START, so the mask origin flips
                // with the writing mode — daisy flips `.mask-half-*` through
                // the same guard, and for the same reason.
                [`&${rtl}`]: { maskPosition: '100% 0, 0 0' },
            },
            at: {
                // The brightness lift stays — only the motion goes.
                'reduced-motion': {
                    base: { transition: 'none' },
                    states: { highlighted: { transform: 'none' } },
                },
            },
        },
    },
    variants: {
        // The same deepening the default gets, per role — see `RATING_DEEPEN`.
        // It does NOT clear 3:1 for every role in every theme (measured worst
        // cells: dim/`neutral` 1.58, sunset/`neutral` 1.82, dark/`error` 2.25,
        // light/`secondary` 2.45): those are daisy's own accent-on-paper
        // numbers, and only a per-role table could move them one at a time.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--rating-fill': ratingFill(c),
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

// daisy "menu" row, shared by the two clickable tree rows (item and
// branch-trigger) the way `btn` is shared across button-shaped parts.
const treeRow: NonNullable<PartStyles['base']> = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: 'var(--space-sm) var(--space-md)',
    fontSize: 'var(--tree-text)',
    fontWeight: 'var(--weight-medium)',
    borderRadius: 'var(--radius-field)',
    cursor: 'pointer',
    outline: 'none',
    transition: 'background var(--duration-fast) var(--ease-standard), '
        + 'color var(--duration-fast) var(--ease-standard)',
};

const treeRowStates: NonNullable<PartStyles['states']> = {
    hover: { background: 'var(--color-base-200)' },
    // daisy menu's active row: role fill, its own -content ink. Both track
    // `color`, or a secondary row would keep primary's ink on a secondary fill.
    selected: { background: 'var(--tree-accent)', color: 'var(--tree-on-accent)' },
    disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
    // Rows sit flush inside the tree, so an offset ring would collide with
    // the neighbouring rows — inset it, as toggle-group does.
    'focus-visible': {
        outline: '2px solid var(--color-base-content)',
        outlineOffset: '-2px',
    },
};

const treeRowSelectors: NonNullable<PartStyles['selectors']> = {
    // Selection must outrank the hover wash — equal specificity
    // ([data-selected]:hover vs :hover:not([data-disabled])), later in
    // source, so selected wins.
    '&[data-selected]:hover': { background: 'var(--color-primary)' },
    // Pressed: the runtime's press feedback, not `:active` — see button.
    // Rows sink by tint (toggle-row idiom), not translate; excluded on
    // selected rows so base-300 never sits under -content ink.
    '&[data-pressed]:not([data-disabled]):not([data-selected])': {
        background: 'var(--color-base-300)',
    },
};

export const treeView: RecipeInput = {
    component: 'tree-view',
    tokens: {
        '--tree-accent': 'var(--color-primary)',
        '--tree-text': 'var(--text-sm)',
        '--tree-on-accent': 'var(--color-primary-content)',
    },
    parts: {
        root: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
        },
        label: {
            base: { fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' },
        },
        tree: {
            base: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2xs)' },
        },
        item: {
            base: treeRow,
            states: treeRowStates,
            selectors: treeRowSelectors,
        },
        // Structural wrapper — the row look lives on branch-trigger; the
        // wrapper only stacks trigger over content and stays invisible.
        branch: {
            base: { display: 'flex', flexDirection: 'column', outline: 'none' },
            states: { open: {}, closed: {}, selected: {}, disabled: {} },
        },
        'branch-trigger': {
            base: { ...treeRow, userSelect: 'none' },
            states: { ...treeRowStates, open: {}, closed: {} },
            selectors: treeRowSelectors,
        },
        'branch-indicator': {
            base: {
                display: 'inline-block',
                opacity: '0.6',
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
        // Indentation comes from this inline padding — depth is the DOM
        // nesting, no per-level rules needed.
        'branch-content': {
            base: { display: 'flex', flexDirection: 'column', paddingInlineStart: 'var(--space-lg)' },
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
    // The indent, restated physically: logical spellings resolve on iOS but
    // not on Android (measured, signalxjs/lynx#1084), so the emitter refuses
    // them. Physical is the lynx target's norm — no RTL flow there.
    targets: {
        lynx: {
            parts: {
                'branch-content': { base: { paddingLeft: 'var(--space-lg)' } },
            },
        },
    },
};

/**
 * daisy "input" flavor: the shared field box with nothing in it but the text.
 * Same `fieldControl` metrics as select's trigger, combobox's control and the
 * number input's — the whole point of that helper is that a row of mixed
 * fields lines up.
 */
export const input: RecipeInput = {
    component: 'input',
    tokens: { '--input-accent': 'var(--color-base-content)' },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-sm)' },
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        },
        label: {
            base: { fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                invalid: { color: roleInk('error') },
                required: {},
            },
        },
        control: {
            base: {
                display: 'inline-flex',
                alignItems: 'stretch',
                ...fieldControl,
                overflow: 'hidden',
                transition: 'border-color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { borderColor: 'var(--color-base-content)' },
                invalid: { borderColor: 'var(--color-error)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
                readonly: {},
                'focus-visible': { ...focusRing['focus-visible'], outline: '2px solid var(--input-accent)' },
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
                fontSize: 'var(--text-sm)',
                padding: 'var(--space-sm) var(--space-md)',
            },
            states: {
                disabled: { cursor: 'not-allowed' },
                readonly: {},
                invalid: {},
                required: {},
            },
            selectors: {
                // Same muting, same reason as `number-input/input` (#264).
                '&::placeholder': { color: 'color-mix(in oklab, var(--color-base-content) 60%, transparent)' },
            },
        },
    },
    // The visible ring lives on `control`; the input delegates.
    skipStates: { input: ['focus-visible'] },
    variants: {
        // The ring carries the role — daisy's field chrome is neutral, so
        // focus is the only place colour surfaces.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--input-accent': `var(--color-${c})`,
        } } }])),
        // The control carries the height off the shared field ramp; the text
        // follows so the box stays proportional.
        size: {
            xs: { control: { base: { height: fieldHeight('xs') } }, input: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-2xs) var(--space-xs)' } } },
            sm: { control: { base: { height: fieldHeight('sm') } }, input: { base: { fontSize: 'var(--text-xs)', padding: 'var(--space-xs) var(--space-sm)' } } },
            // `md` is the un-attributed render: the base already IS the
            // middle step.
            md: {},
            lg: { control: { base: { height: fieldHeight('lg') } }, input: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-md) var(--space-lg)' } } },
            xl: { control: { base: { height: fieldHeight('xl') } }, input: { base: { fontSize: 'var(--text-lg)', padding: 'var(--space-lg) var(--space-xl)' } } },
        },
    },
};

/**
 * daisy "textarea" flavor. The `fieldControl` box minus its `height`: the
 * whole point of a textarea is that its height is the content's (and the
 * reader's, via `resize`), so the shared ramp becomes a `min-height` floor
 * rather than a fixed measure.
 */
export const textarea: RecipeInput = {
    component: 'textarea',
    tokens: { '--textarea-accent': 'var(--color-base-content)' },
    parts: {
        root: {
            base: { display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-sm)' },
            states: { disabled: {}, invalid: {}, required: {}, readonly: {} },
        },
        label: {
            base: { fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)' },
                invalid: { color: roleInk('error') },
                required: {},
            },
        },
        textarea: {
            base: {
                ...fieldControl,
                display: 'block',
                height: 'auto',
                minHeight: `calc(${fieldHeight('md')} * 2)`,
                width: '100%',
                minWidth: '0',
                appearance: 'none',
                color: 'inherit',
                font: 'inherit',
                fontSize: 'var(--text-sm)',
                lineHeight: 'var(--leading-normal)',
                padding: 'var(--space-sm) var(--space-md)',
                resize: 'vertical',
                transition: 'border-color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { borderColor: 'var(--color-base-content)' },
                invalid: { borderColor: 'var(--color-error)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                readonly: {},
                required: {},
                'focus-visible': { ...focusRing['focus-visible'], outline: '2px solid var(--textarea-accent)' },
            },
            selectors: {
                '&::placeholder': { color: 'color-mix(in oklab, var(--color-base-content) 60%, transparent)' },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--textarea-accent': `var(--color-${c})`,
        } } }])),
        // The ramp moves the type and the floor together — a bigger textarea
        // is a taller one, not just a wider-set one.
        size: {
            xs: { textarea: { base: { fontSize: 'var(--text-xs)', minHeight: `calc(${fieldHeight('xs')} * 2)`, padding: 'var(--space-2xs) var(--space-xs)' } } },
            sm: { textarea: { base: { fontSize: 'var(--text-xs)', minHeight: `calc(${fieldHeight('sm')} * 2)`, padding: 'var(--space-xs) var(--space-sm)' } } },
            md: {},
            lg: { textarea: { base: { fontSize: 'var(--text-md)', minHeight: `calc(${fieldHeight('lg')} * 2)`, padding: 'var(--space-md) var(--space-lg)' } } },
            xl: { textarea: { base: { fontSize: 'var(--text-lg)', minHeight: `calc(${fieldHeight('xl')} * 2)`, padding: 'var(--space-lg) var(--space-xl)' } } },
        },
    },
};

// ── Content tier (#311) ───────────────────────────────────────────────────
/**
 * daisy "card" flavor: `bg-base-100` on a `rounded-box` with a real shadow —
 * daisy's card IS elevated where zero-basic's is not, and `card-body` carries
 * the padding rather than the card.
 */
export const card: RecipeInput = {
    component: 'card',
    tokens: { '--card-pad': 'var(--space-xl)' },
    parts: {
        root: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
                borderRadius: 'var(--radius-box)',
                boxShadow: 'var(--shadow-md)',
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
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--weight-semibold)',
                lineHeight: 'var(--leading-tight)',
            },
        },
        description: {
            base: {
                margin: '0',
                fontSize: 'var(--text-sm)',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
            },
        },
        body: {
            base: { padding: 'var(--card-pad)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)' },
        },
        footer: {
            base: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 'var(--space-md)',
                padding: '0 var(--card-pad) var(--card-pad)',
            },
        },
    },
    variants: {
        // daisy's card has no colour of its own; the accent lands on the top
        // rule, which is how `card-bordered` reads with a role applied.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            borderTop: `calc(var(--border) * 3) solid var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--card-pad': 'var(--space-sm)' } } },
            sm: { root: { base: { '--card-pad': 'var(--space-md)' } } },
            md: {},
            lg: { root: { base: { '--card-pad': 'var(--space-2xl)' } } },
            xl: { root: { base: { '--card-pad': 'var(--space-2xl)' } } },
        },
    },
};

/**
 * daisy "alert" flavor: the role's soft tint edge to edge, its ink for the
 * words, and a rounded-box corner. The text ink is `roleInk`, the same
 * on-tint mix daisy's own alerts use and the one the token validator has
 * already measured — NOT the role at full strength, which is a fill.
 */
export const alert: RecipeInput = {
    component: 'alert',
    tokens: {
        '--alert-tint': 'var(--color-info-soft)',
        '--alert-ink': 'var(--color-base-content)',
    },
    parts: {
        root: {
            base: {
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'center',
                gap: 'var(--space-sm) var(--space-md)',
                background: 'var(--alert-tint)',
                color: 'var(--color-base-content)',
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
                color: 'var(--alert-ink)',
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
                hover: { background: 'color-mix(in oklab, var(--color-base-content) 10%, transparent)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': {
                    background: 'color-mix(in oklab, var(--color-base-content) 18%, transparent)',
                },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--alert-tint': `var(--color-${c}-soft)`,
            '--alert-ink': roleInk(c),
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
 * daisy "badge" flavor: a fully-rounded pill with a hairline, filled by the
 * role. No `variant` — the repo-wide decision (#175) holds everywhere except
 * zero-basic's badge, which narrows its own vocabulary through `tokens.scopes`
 * to prove the mechanism.
 */
export const badge: RecipeInput = {
    component: 'badge',
    tokens: {
        '--badge-fill': 'var(--color-base-200)',
        '--badge-ink': 'var(--color-base-content)',
    },
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375em',
                background: 'var(--badge-fill)',
                color: 'var(--badge-ink)',
                border: 'var(--border) solid transparent',
                // daisy badges are pills; a large radius rather than 9999px so
                // a square-cornered theme can still say so through the token.
                borderRadius: 'var(--radius-selector)',
                padding: 'var(--space-2xs) var(--space-lg)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semibold)',
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
            xs: { root: { base: { fontSize: 'var(--text-xs)', padding: '0 var(--space-sm)' } } },
            sm: { root: { base: { fontSize: 'var(--text-xs)', padding: '0 var(--space-md)' } } },
            md: {},
            lg: { root: { base: { fontSize: 'var(--text-sm)', padding: 'var(--space-2xs) var(--space-lg)' } } },
            xl: { root: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-xs) var(--space-xl)' } } },
        },
    },
};

/** daisy "divider": the base-300 rule, thickening with the ramp. */
export const divider: RecipeInput = {
    component: 'divider',
    tokens: { '--divider-ink': 'var(--color-base-300)', '--divider-thickness': 'var(--border)' },
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
    tokens: { '--skeleton-fill': 'var(--color-base-300)' },
    parts: {
        root: {
            base: { borderRadius: 'var(--radius-box)' },
            states: {
                // daisy's skeleton is a PULSE rather than a sweep — an opacity
                // loop on a flat fill, which is also why its reduced-motion
                // fallback is the fill at rest and nothing else changes.
                loading: {
                    color: 'transparent',
                    background: 'var(--skeleton-fill)',
                    animation: 'zero-daisyui-skeleton 1.6s ease-in-out infinite',
                    userSelect: 'none',
                    pointerEvents: 'none',
                },
                loaded: {},
            },
            at: {
                'reduced-motion': { states: { loading: { animation: 'none' } } },
            },
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
    keyframes: {
        'zero-daisyui-skeleton': 'from, to { opacity: 1; } 50% { opacity: 0.55; }',
    },
};

/** daisy "loading-spinner": the ring, with one quadrant in the role's ink. */
export const spinner: RecipeInput = {
    component: 'spinner',
    tokens: {
        '--spinner-size': 'calc(var(--size-field) * 0.5)',
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
                animation: 'zero-daisyui-spin 0.7s linear infinite',
            },
            at: { 'reduced-motion': { base: { animation: 'none' } } },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--spinner-ink': `var(--color-${c})`,
        } } }])),
        size: {
            xs: { root: { base: { '--spinner-size': 'calc(var(--size-field) * 0.35)' } } },
            sm: { root: { base: { '--spinner-size': 'calc(var(--size-field) * 0.42)' } } },
            md: {},
            lg: { root: { base: { '--spinner-size': 'calc(var(--size-field) * 0.7)' } } },
            xl: { root: { base: { '--spinner-size': 'calc(var(--size-field) * 0.9)' } } },
        },
    },
    keyframes: { 'zero-daisyui-spin': 'to { transform: rotate(360deg); }' },
};

// ── The content-tier sweep (#334) ─────────────────────────────────────────
/** daisy kbd: the raised base-200 cap with the doubled bottom edge. */
export const kbd: RecipeInput = {
    component: 'kbd',
    tokens: { '--kbd-fill': 'var(--color-base-200)', '--kbd-ink': 'var(--color-base-content)' },
    parts: {
        root: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minInlineSize: '1.75em',
                // daisy's .0625rem/.4375rem, restated as the ramp steps they
                // already are once the cap's own border is absorbed: the OUTER
                // box lands on 2xs/md, so the cap rides the ramp under a density
                // override while keeping daisy's painted size exactly at 1px.
                padding: 'calc(var(--space-2xs) - var(--border)) calc(var(--space-md) - var(--border))',
                background: 'var(--kbd-fill)',
                color: 'var(--kbd-ink)',
                border: 'var(--border) solid var(--color-base-300)',
                borderBlockEndWidth: 'calc(var(--border) * 2)',
                borderRadius: 'var(--radius-field)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semibold)',
                lineHeight: 'var(--leading-normal)',
                whiteSpace: 'nowrap',
            },
        },
    },
    variants: {
        // The badge pairing: the cap takes the role's fill, the ink its
        // validated `-content` partner.
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--kbd-fill': `var(--color-${c})`,
            '--kbd-ink': `var(--color-${c}-content)`,
        } } }])),
        size: {
            xs: { root: { base: { fontSize: 'var(--text-xs)', padding: '0 var(--space-xs)', minInlineSize: '1.5em' } } },
            sm: { root: { base: { fontSize: 'var(--text-xs)', padding: '0 var(--space-sm)' } } },
            md: {},
            lg: { root: { base: { fontSize: 'var(--text-sm)', padding: 'var(--space-2xs) var(--space-md)' } } },
            xl: { root: { base: { fontSize: 'var(--text-md)', padding: 'var(--space-xs) var(--space-lg)' } } },
        },
    },
};

/**
 * daisy status: the dot with the soft halo ring daisy draws around it —
 * spelled as a border in the ink's own colour so the mark survives
 * `forced-colors`, with the halo as an outer box-shadow that may drop there
 * without taking the dot with it.
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
                borderRadius: '9999px',
                boxShadow: '0 0 0 calc(var(--status-size) / 4) color-mix(in oklch, var(--status-ink) 25%, transparent)',
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

/** daisy stats: the rounded base-100 panel with rule-thin item joins. */
export const stats: RecipeInput = {
    component: 'stats',
    tokens: { '--stats-accent': 'var(--color-base-content)' },
    parts: {
        root: {
            base: {
                display: 'flex',
                border: 'var(--border) solid var(--color-base-200)',
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
                    borderInlineStart: 'var(--border) solid var(--color-base-200)',
                },
                '&[data-orientation="vertical"] + &': {
                    borderBlockStart: 'var(--border) solid var(--color-base-200)',
                },
            },
        },
        title: {
            base: {
                gridColumn: '1',
                fontSize: 'var(--text-xs)',
                color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
            },
        },
        value: {
            base: {
                gridColumn: '1',
                fontSize: 'var(--text-2xl)',
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

/** daisy timeline: the boxed content beside a dotted axis. */
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
                borderRadius: '9999px',
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
                margin: 'var(--space-xs) var(--space-md)',
                padding: 'var(--space-xs) var(--space-md)',
                fontSize: 'var(--text-sm)',
                border: 'var(--border) solid var(--color-base-200)',
                borderRadius: 'var(--radius-box)',
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

/** daisy chat: the classic bubble, colour-refilled per role. */
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
                    borderEndStartRadius: '0',
                },
                '[data-scope="chat"][data-part="root"][data-placement="end"] > &': {
                    gridColumn: '1',
                    borderEndEndRadius: '0',
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

/** daisy radial-progress: --value became --progress-percent; same ring. */
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
                // whatever the colour variant — linear progress's rule. But
                // daisy's raw success is a light ink (1.96:1 on light's
                // base-100, 1.77:1 on nord's — the indicator matrix caught
                // both), and a recipe cannot scope a rule to one theme, so
                // the fix is symmetric: deepening toward base-content keeps
                // the green and lands on the readable side in BOTH schemes,
                // because base-content flips with them. zero-basic's
                // `softInk('warning')` is the same codified move.
                complete: { '--radial-ink': 'color-mix(in oklch, var(--color-success) 55%, var(--color-base-content))' },
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
                    animation: 'zero-daisyui-radial-spin 1.2s linear infinite',
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
    keyframes: { 'zero-daisyui-radial-spin': 'to { transform: rotate(360deg); }' },
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
 * Navbar — daisy's navbar is a comfortable padded bar on base-100 with a
 * generous min-height; start/end split the width and the centre hugs its
 * content, which is daisy's own 50/50 layout translated to flex slack.
 * Colour is the daisy `navbar bg-primary text-primary-content` move: refill
 * the whole bar with the role pair.
 */
export const navbar: RecipeInput = {
    component: 'navbar',
    parts: {
        root: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                minBlockSize: '4rem',
                padding: 'var(--space-sm)',
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
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
            xs: { root: { base: { minBlockSize: '2.5rem', fontSize: 'var(--text-sm)' } } },
            sm: { root: { base: { minBlockSize: '3rem', fontSize: 'var(--text-sm)' } } },
            md: {},
            lg: { root: { base: { minBlockSize: '5rem' } } },
            xl: { root: { base: { minBlockSize: '6rem', fontSize: 'var(--text-lg)' } } },
        },
    },
};

/**
 * Breadcrumbs — daisy's breadcrumbs: a compact text-sm trail, links
 * underlining on hover, the current crumb plain full ink. Colour rebinds
 * the current crumb through `roleInk` (the readable-ink map daisy already
 * carries for role text on paper).
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
                padding: 'var(--space-xs) 0',
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
                borderRadius: 'var(--radius-selector)',
                transition: 'color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { color: 'var(--color-base-content)', textDecoration: 'underline' },
                active: {
                    color: 'var(--bc-accent)',
                    fontWeight: 'var(--weight-semibold)',
                    textDecoration: 'none',
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
                color: 'color-mix(in oklch, var(--color-base-content) 40%, transparent)',
                userSelect: 'none',
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--bc-accent': roleInk(c),
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
 * Pagination — daisy's join-of-buttons made of standalone btn cells: the
 * quiet base-200 fill, base-300 hover, the current page inverted into the
 * accent pair (primary by default). Pressed is the daisy 1px sink. The
 * `‹`/`›` glyphs flip under the shared rtl guard.
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
        root: { base: { display: 'flex', alignItems: 'center', gap: 'var(--space-2xs)' } },
        item: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minInlineSize: 'var(--pg-size)',
                blockSize: 'var(--pg-size)',
                paddingInline: 'var(--space-2xs)',
                background: 'var(--color-base-200)',
                color: 'var(--color-base-content)',
                border: 'none',
                borderRadius: 'var(--radius-field)',
                fontSize: 'var(--pg-font)',
                fontWeight: 'var(--weight-semibold)',
                fontVariantNumeric: 'tabular-nums',
                appearance: 'none',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { background: 'var(--color-base-300)' },
                active: { background: 'var(--pg-accent)', color: 'var(--pg-accent-content)' },
                inactive: {},
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: { '&[data-pressed]:not([data-disabled])': { transform: 'translateY(1px)' } },
        },
        ellipsis: {
            base: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minInlineSize: 'var(--pg-size)',
                blockSize: 'var(--pg-size)',
                // 65%, not the house 50% wash: nord's base-content is light
                // enough that 50% computes 2.74:1 on base-100 — the contrast
                // audit's finding, fixed at source rather than allowlisted.
                color: 'color-mix(in oklch, var(--color-base-content) 65%, transparent)',
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
                background: 'var(--color-base-200)',
                color: 'var(--color-base-content)',
                border: 'none',
                borderRadius: 'var(--radius-field)',
                fontSize: 'calc(var(--pg-font) * 1.2)',
                lineHeight: 'var(--leading-none)',
                appearance: 'none',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { background: 'var(--color-base-300)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { transform: 'translateY(1px)' },
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
                background: 'var(--color-base-200)',
                color: 'var(--color-base-content)',
                border: 'none',
                borderRadius: 'var(--radius-field)',
                fontSize: 'calc(var(--pg-font) * 1.2)',
                lineHeight: 'var(--leading-none)',
                appearance: 'none',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { background: 'var(--color-base-300)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { transform: 'translateY(1px)' },
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
 * Steps — daisy's steps translated to the richer rail: bold numbered discs
 * on base-200, the walked disc and line refilled with the accent pair
 * (primary by default; daisy colours completed steps, and `roleInk` keeps
 * the accent readable as text ink). Pressed is the daisy 1px sink.
 */
export const steps: RecipeInput = {
    component: 'steps',
    tokens: {
        '--steps-accent': 'var(--color-primary)',
        '--steps-accent-content': 'var(--color-primary-content)',
        '--steps-accent-ink': roleInk('primary'),
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
                '&[data-pressed]:not([data-disabled])': { transform: 'translateY(1px)' },
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
                transition: 'background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                active: { background: 'var(--steps-accent)', color: 'var(--steps-accent-content)' },
                // Ink deepened toward base-content: the 95% role ink on a 20%
                // tint measured 2.96:1 under nord's muted primary (the static
                // contrast matrix, #403); 70% keeps the hue and clears the floor
                // in every theme.
                complete: { background: 'color-mix(in oklch, var(--steps-accent) 20%, var(--color-base-100))', color: 'color-mix(in oklab, var(--steps-accent) 70%, var(--color-base-content))' },
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
            '--steps-accent-ink': roleInk(c),
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
 * Drawer — daisy's drawer-side as a native <dialog> edge sheet: base-100
 * paper, no border (daisy separates the drawer with the scrim), faded in.
 * Base render is the inline mode; `:modal` is the top-layer edge sheet.
 */
export const drawer: RecipeInput = {
    component: 'drawer',
    parts: {
        trigger: {
            base: btn,
            states: {
                hover: { background: 'var(--color-base-300)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                open: {},
                closed: {},
                ...focusRing,
            },
        },
        panel: withPresence(popupPresence('none'), {
            base: {
                padding: 'var(--space-lg)',
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
            base: { background: 'oklch(0% 0 0 / 0.4)' },
            states: { open: {}, closed: {} },
        },
        title: {
            base: { margin: '0 0 var(--space-md)', fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)' },
        },
        close: {
            base: btn,
            states: {
                hover: { background: 'var(--color-base-300)' },
                disabled: { opacity: 'var(--disabled-opacity)' },
                ...focusRing,
            },
        },
    },
    // Trigger-carried axes — see `btnColors` for why the panel is out of
    // reach and the trigger is the whole story here.
    variants: { color: btnColors(), size: btnSizes },
    // The btn paddings, restated physically — see `lynxBtnPad` (#1084).
    targets: {
        lynx: {
            parts: {
                trigger: { base: lynxBtnPad(4) },
                close: { base: lynxBtnPad(4) },
            },
            variants: { size: lynxBtnSizes('trigger') },
        },
    },
};

/**
 * Table — daisy's `table`: quiet base-200 row rules in a rounded box,
 * muted semibold headers. `zebra` and `hover` are daisy's own names
 * (`table-zebra`, the row `hover` class), declared as mods; a selected row
 * (daisy's `active`) sits on base-300 so it reads over both.
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
                border: 'var(--border) solid var(--color-base-200)',
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
                color: 'color-mix(in oklab, var(--color-base-content) 60%, transparent)',
            },
        },
        head: {},
        body: {},
        foot: {
            base: {
                fontSize: 'var(--text-xs)',
                color: 'color-mix(in oklab, var(--color-base-content) 60%, transparent)',
            },
        },
        row: {
            base: { borderBlockEnd: 'var(--border) solid var(--color-base-200)' },
            states: {
                selected: { background: 'var(--color-base-300)' },
            },
        },
        'header-cell': {
            base: {
                padding: 'var(--table-pad-block) var(--table-pad-inline)',
                textAlign: 'start',
                fontWeight: 'var(--weight-semibold)',
                fontSize: 'var(--text-xs)',
                color: 'color-mix(in oklab, var(--table-accent) 60%, transparent)',
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
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--table-accent': roleInk(c),
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
 * FileUpload — daisy's file-input family reshaped for the composed anatomy:
 * a btn-ish trigger, a dashed base-300 dropzone washing toward the role ink
 * under a hovering drag, and rounded item rows. Colour rebinds the accent.
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
            base: { fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' },
            states: { disabled: { opacity: 'var(--disabled-opacity)' } },
        },
        trigger: {
            base: {
                appearance: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-xs)',
                padding: 'var(--space-xs) var(--space-lg)',
                fontSize: 'var(--fu-font)',
                fontWeight: 'var(--weight-semibold)',
                lineHeight: 'var(--leading-none)',
                color: 'var(--color-base-content)',
                background: 'var(--color-base-200)',
                border: 'var(--border) solid var(--color-base-300)',
                borderRadius: 'var(--radius-field)',
                cursor: 'pointer',
            },
            states: {
                hover: { background: 'var(--color-base-300)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                invalid: { borderColor: 'var(--color-error)' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { translate: '0 1px' },
            },
        },
        dropzone: {
            base: {
                justifySelf: 'stretch',
                padding: 'var(--fu-pad)',
                textAlign: 'center',
                fontSize: 'var(--fu-font)',
                color: 'color-mix(in oklab, var(--color-base-content) 60%, transparent)',
                border: 'calc(var(--border) * 2) dashed var(--color-base-300)',
                borderRadius: 'var(--radius-box)',
                background: 'var(--color-base-100)',
                cursor: 'pointer',
            },
            states: {
                highlighted: {
                    borderColor: 'var(--fu-accent)',
                    background: 'color-mix(in oklab, var(--fu-accent) 8%, var(--color-base-100))',
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
                border: 'var(--border) solid var(--color-base-200)',
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
                color: 'color-mix(in oklab, var(--color-base-content) 60%, transparent)',
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
            '--fu-accent': roleInk(c),
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
 * Carousel — daisy's carousel is exactly a scroll-snap box; the additions
 * are btn-circle nav triggers floating on the inline edges and pill dots.
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
                borderRadius: 'var(--radius-box)',
            },
            selectors: {
                // The viewport is a tab stop (scrollable-region-focusable) and
                // owes the keyboard user a ring. Real :focus-visible — no
                // runtime flag exists on this part.
                '&:focus-visible': { outline: '2px solid var(--color-base-content)', outlineOffset: '2px' },
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
                border: 'var(--border) solid var(--color-base-300)',
                borderRadius: '9999px',
                cursor: 'pointer',
                zIndex: '1',
            },
            states: {
                hover: { background: 'var(--color-base-300)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { translate: '0 1px' },
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
                border: 'var(--border) solid var(--color-base-300)',
                borderRadius: '9999px',
                cursor: 'pointer',
                zIndex: '1',
            },
            states: {
                hover: { background: 'var(--color-base-300)' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                ...focusRing,
            },
            selectors: {
                '&[data-pressed]:not([data-disabled])': { translate: '0 1px' },
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
                    border: 'calc(var(--border) * 2) solid color-mix(in oklab, var(--color-base-content) 70%, transparent)',
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
            '--carousel-accent': roleInk(c),
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
 * Swap — daisy's signature swap-rotate as the ONE look: the leaving face
 * spins out through 45° while fading, the arriving one spins in. All of
 * it is data-state styling; reduced motion swaps with a hard cut.
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
                transition: 'transform var(--duration-normal) var(--ease-standard), opacity var(--duration-normal) var(--ease-standard)',
            },
            states: {
                on: {},
                off: { opacity: '0', transform: 'rotate(45deg)' },
            },
            at: {
                'reduced-motion': { base: { transition: 'none' } },
            },
        },
        off: {
            base: {
                gridArea: '1 / 1',
                transition: 'transform var(--duration-normal) var(--ease-standard), opacity var(--duration-normal) var(--ease-standard)',
            },
            states: {
                off: {},
                on: { opacity: '0', transform: 'rotate(-45deg)' },
            },
            at: {
                'reduced-motion': { base: { transition: 'none' } },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--swap-ink': roleInk(c),
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
 * change — daisy's rolling-odometer rise; a loop never exists, and reduced motion
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
                animation: 'zero-daisyui-countdown-in 0.35s var(--ease-standard)',
            },
            at: {
                'reduced-motion': { base: { animation: 'none' } },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((c) => [c, { root: { base: {
            '--countdown-ink': roleInk(c),
        } } }])),
        size: {
            xs: { root: { base: { '--countdown-font': 'var(--text-md)' } } },
            sm: { root: { base: { '--countdown-font': 'var(--text-xl)' } } },
            md: {},
            lg: { root: { base: { '--countdown-font': 'var(--text-3xl)' } } },
            xl: { root: { base: { '--countdown-font': 'var(--text-3xl)' } } },
        },
    },
    keyframes: { 'zero-daisyui-countdown-in': 'from { transform: translateY(0.6em); opacity: 0; }' },
};

/**
 * Diff — daisy's diff: the resizer line with a round grip riding it,
 * role ink through the colour axis.
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
                pressed: { '--diff-accent': 'color-mix(in oklab, var(--color-base-content) 85%, var(--color-base-100))' },
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
            '--diff-accent': roleInk(c),
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
