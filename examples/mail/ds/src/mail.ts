/**
 * Recipes for the kit's own scopes (examples/mail/kit). These are the
 * components zero lacks (#440); the anatomy comes in through the kit's
 * manifest fragment, and the look comes from here, keyed on this design
 * system's own axes (`tone`, `weight`) and modifiers (`truncate`, `clamp`,
 * `unread`).
 */
import type { PartStyles, RecipeInput } from '@sigx/zero-kit';
import { TONES } from './tokens.js';

/** Ink at a given strength over the page — solid, so contrast is measurable. */
const ink = (pct: number): string => `color-mix(in oklch, var(--color-base-content) ${pct}%, var(--color-base-100))`;

const TONE_INK: Record<(typeof TONES)[number], string> = {
    muted: ink(68),
    subtle: ink(56),
    primary: 'var(--color-primary)',
    secondary: 'var(--color-secondary)',
    accent: 'var(--color-accent)',
    info: 'var(--color-info)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
};

const tone = (part = 'root') => Object.fromEntries(
    TONES.map((t) => [t, { [part]: { base: { color: TONE_INK[t] } } }]),
);

const weight = {
    normal: { root: { base: { fontWeight: 'var(--weight-normal)' } } },
    medium: { root: { base: { fontWeight: 'var(--weight-medium)' } } },
    semibold: { root: { base: { fontWeight: 'var(--weight-semibold)' } } },
    bold: { root: { base: { fontWeight: 'var(--weight-bold)' } } },
};

const TYPE_STEPS = { xs: 'var(--text-xs)', sm: 'var(--text-sm)', md: 'var(--text-md)', lg: 'var(--text-lg)', xl: 'var(--text-xl)' } as const;

/** A size axis that only moves the type step; `md` is the inherited default. */
const typeSize = (steps: Record<keyof typeof TYPE_STEPS, string | null>): Record<string, Record<string, PartStyles>> => Object.fromEntries(
    Object.entries(steps).map(([k, v]): [string, Record<string, PartStyles>] => [k, v ? { root: { base: { fontSize: v } } } : {}]),
);

const truncate = {
    root: {
        base: {
            display: 'block',
            minInlineSize: '0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        },
    },
};

export const text: RecipeInput = {
    component: 'mail-text',
    parts: {
        root: { base: { margin: '0', minInlineSize: '0' } },
    },
    variants: {
        size: typeSize({ xs: TYPE_STEPS.xs, sm: TYPE_STEPS.sm, md: null, lg: TYPE_STEPS.lg, xl: TYPE_STEPS.xl }),
        tone: tone(),
        weight,
    },
    modifiers: {
        truncate,
        clamp: {
            root: {
                base: {
                    display: '-webkit-box',
                    WebkitLineClamp: '2',
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                },
            },
        },
    },
};

export const heading: RecipeInput = {
    component: 'mail-heading',
    parts: {
        root: {
            base: {
                margin: '0',
                fontSize: 'var(--text-xl)',
                fontWeight: 'var(--weight-semibold)',
                lineHeight: 'var(--leading-tight)',
                letterSpacing: 'var(--tracking-tight)',
                color: 'var(--color-base-content)',
                textWrap: 'balance',
            },
        },
    },
    variants: {
        size: {
            xs: { root: { base: { fontSize: 'var(--text-md)' } } },
            sm: { root: { base: { fontSize: 'var(--text-lg)' } } },
            md: {},
            lg: { root: { base: { fontSize: 'var(--text-2xl)' } } },
            xl: { root: { base: { fontSize: 'var(--text-3xl)' } } },
        },
        tone: tone(),
        weight,
    },
    modifiers: { truncate },
};

export const time: RecipeInput = {
    component: 'mail-time',
    parts: {
        root: {
            base: {
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
                fontSize: 'var(--text-sm)',
            },
        },
    },
    variants: {
        size: typeSize({ xs: TYPE_STEPS.xs, sm: null, md: TYPE_STEPS.md, lg: TYPE_STEPS.lg, xl: TYPE_STEPS.xl }),
        tone: tone(),
        weight,
    },
};

export const icon: RecipeInput = {
    component: 'mail-icon',
    parts: {
        root: {
            base: {
                inlineSize: '1.125em',
                blockSize: '1.125em',
                flex: 'none',
                display: 'inline-block',
                verticalAlign: '-0.2em',
                strokeWidth: '1.75',
            },
        },
    },
    variants: {
        size: {
            xs: { root: { base: { inlineSize: '0.875em', blockSize: '0.875em' } } },
            sm: { root: { base: { inlineSize: '1em', blockSize: '1em' } } },
            md: {},
            lg: { root: { base: { inlineSize: '1.375em', blockSize: '1.375em' } } },
            xl: { root: { base: { inlineSize: '2.25em', blockSize: '2.25em', strokeWidth: '1.25' } } },
        },
        tone: tone(),
    },
};

export const toolbar: RecipeInput = {
    component: 'mail-toolbar',
    parts: {
        root: {
            base: {
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2xs)',
                minInlineSize: '0',
                flexWrap: 'wrap',
            },
        },
        group: { base: { display: 'flex', alignItems: 'center', gap: 'var(--space-2xs)' } },
        separator: {
            base: {
                inlineSize: 'var(--border)',
                blockSize: '1.25rem',
                marginInline: 'var(--space-xs)',
                background: 'var(--color-base-300)',
                flex: 'none',
            },
        },
    },
};

export const mailList: RecipeInput = {
    component: 'mail-list',
    parts: {
        root: {
            base: {
                flex: '1 1 auto',
                minBlockSize: '0',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                scrollbarWidth: 'thin',
                scrollbarGutter: 'stable',
            },
        },
        content: { base: { display: 'block', margin: '0' } },
    },
    modifiers: {
        // Compact density: the rows read the list's modifier and tighten.
        compact: {
            content: {
                selectors: {
                    '& > [data-scope="mail-row"]': { paddingBlock: 'var(--space-sm)' },
                },
            },
        },
    },
};

export const mailRow: RecipeInput = {
    component: 'mail-row',
    tokens: {
        '--row-bg': 'transparent',
        '--row-bar': 'transparent',
    },
    parts: {
        root: {
            base: {
                position: 'relative',
                display: 'block',
                paddingBlock: 'var(--space-md)',
                paddingInlineStart: 'var(--space-lg)',
                paddingInlineEnd: 'var(--space-lg)',
                borderBlockEnd: 'var(--border) solid color-mix(in oklch, var(--color-base-300) 70%, transparent)',
                background: 'var(--row-bg)',
                color: ink(74),
                cursor: 'default',
                outline: 'none',
                boxShadow: 'inset 3px 0 0 var(--row-bar)',
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                // Declared first so `active` (later) wins the shared bar.
                highlighted: { '--row-bar': 'color-mix(in oklch, var(--color-base-content) 22%, var(--color-base-100))' },
                hover: { '--row-bg': 'color-mix(in oklch, var(--color-base-content) 4%, var(--color-base-100))' },
                active: {
                    '--row-bg': 'color-mix(in oklab, var(--color-primary) 8%, var(--color-base-100))',
                    '--row-bar': 'var(--color-primary)',
                    color: 'var(--color-base-content)',
                },
                inactive: {},
                selected: { '--row-bg': 'color-mix(in oklab, var(--color-primary) 5%, var(--color-base-100))' },
                'focus-visible': {
                    outline: '2px solid var(--color-primary)',
                    outlineOffset: '-2px',
                },
            },
        },
    },
    modifiers: {
        unread: {
            root: {
                base: { color: 'var(--color-base-content)', fontWeight: 'var(--weight-semibold)' },
                selectors: {
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        insetInlineStart: 'var(--space-xs)',
                        insetBlockStart: 'calc(var(--space-md) + 0.55em)',
                        inlineSize: '0.375rem',
                        blockSize: '0.375rem',
                        borderRadius: '9999px',
                        background: 'var(--color-primary)',
                    },
                },
            },
        },
    },
};

export const shell: RecipeInput = {
    component: 'mail-shell',
    parts: {
        root: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                blockSize: '100dvh',
                overflow: 'hidden',
                background: 'var(--color-base-200)',
                color: 'var(--color-base-content)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-md)',
                lineHeight: 'var(--leading-normal)',
                WebkitFontSmoothing: 'antialiased',
            },
        },
        body: {
            base: { display: 'flex', flex: '1 1 auto', minBlockSize: '0', minInlineSize: '0' },
        },
        main: {
            base: {
                display: 'flex',
                flex: '1 1 auto',
                minBlockSize: '0',
                minInlineSize: '0',
                background: 'var(--color-base-100)',
                borderStartStartRadius: 'var(--radius-box)',
                borderBlockStart: 'var(--border) solid var(--color-base-300)',
                borderInlineStart: 'var(--border) solid var(--color-base-300)',
                overflow: 'hidden',
            },
        },
        region: {
            base: {
                display: 'flex',
                flexDirection: 'column',
                flex: '1 1 auto',
                minBlockSize: '0',
                minInlineSize: '0',
                overflowY: 'auto',
                scrollbarWidth: 'thin',
            },
        },
    },
};

export const split: RecipeInput = {
    component: 'mail-split',
    // The kit's Split.Root publishes the primary pane's size inline. Zero's
    // RUNTIME_PROPERTIES list is closed to ecosystem components (#440), so it
    // is declared here as a recipe token with a default instead.
    tokens: { '--split-size': '380px' },
    parts: {
        root: {
            base: { display: 'flex', flex: '1 1 auto', minBlockSize: '0', minInlineSize: '0' },
            selectors: {
                // Narrow: one pane at a time — the app says which.
                '&[data-show="secondary"] > [data-scope="mail-split"][data-part="pane"][data-primary]': { display: 'none' },
                '&[data-show="primary"] > [data-scope="mail-split"][data-part="pane"]:not([data-primary])': { display: 'none' },
            },
            at: {
                // Side by side from md: undo the single-pane rules at their own specificity.
                md: {
                    selectors: {
                        '&[data-show="secondary"] > [data-scope="mail-split"][data-part="pane"][data-primary]': { display: 'flex' },
                        '&[data-show="primary"] > [data-scope="mail-split"][data-part="pane"]:not([data-primary])': { display: 'flex' },
                    },
                },
            },
        },
        pane: {
            base: { display: 'flex', flexDirection: 'column', flex: '1 1 0', minInlineSize: '0', minBlockSize: '0' },
            at: {
                md: {
                    selectors: { '&[data-primary]': { flex: '0 0 var(--split-size)' } },
                },
            },
        },
        handle: {
            base: {
                display: 'none',
                position: 'relative',
                flex: 'none',
                inlineSize: 'var(--border)',
                background: 'var(--color-base-300)',
                cursor: 'col-resize',
                touchAction: 'none',
                outline: 'none',
                transition: 'background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                hover: { background: 'var(--color-primary)' },
                'focus-visible': { background: 'var(--color-primary)', boxShadow: '0 0 0 1px var(--color-primary)' },
            },
            selectors: {
                // A 9px hit area around the 1px rule.
                '&::after': { content: '""', position: 'absolute', insetBlock: '0', insetInline: '-4px' },
            },
            at: { md: { base: { display: 'block' } } },
        },
    },
};

export const mailRecipes: RecipeInput[] = [text, heading, time, icon, toolbar, mailList, mailRow, shell, split];
