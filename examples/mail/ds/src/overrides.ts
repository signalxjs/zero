/**
 * Where the mail client's look departs from the baseline: `overrides`
 * replace a component's recipe whole, `patches` amend the baseline's in place.
 */
import type { RecipeInput, RecipePatch } from '@sigx/zero-kit';

export const overrides: RecipeInput[] = [];

/**
 * The overlay triggers (the baseline's shared "quiet trigger") drawn as a
 * mail client draws its icon buttons: no border until you reach for it, a
 * square hit area at `sm`, the ink wash on hover the baseline already gives.
 * Not tooltip's or menu's: the kit's ActionButton and MenuAction lend their
 * triggers to a `Button.Root` (#494, #495), which paints them through the
 * button recipe.
 */
const ghostTrigger: RecipePatch = {
    parts: { trigger: { base: { borderColor: 'transparent', color: 'color-mix(in oklch, var(--color-base-content) 78%, var(--color-base-100))' } } },
    variants: { size: { sm: { trigger: { base: { padding: 'var(--space-sm)' } } } } },
};

/** Secondary ink that still clears AA body-text contrast on every ground. */
const quietInk = 'color-mix(in oklch, var(--color-base-content) 70%, var(--color-base-100))';

export const patches: Record<string, RecipePatch> = {
    // A message is a Collapsible around a Card (#453): the card is the
    // surface and pads its own body, so the disclosure adds no frame.
    collapsible: {
        parts: {
            root: { base: { border: 'none', background: 'transparent' } },
            panel: { base: { padding: '0', borderTop: 'none' } },
        },
    },
    'nav-list': { parts: { heading: { base: { color: quietInk } } } },
    pagination: { parts: { ellipsis: { base: { color: quietInk } } } },
    popover: ghostTrigger,
    // In a row of text, an avatar or a checkbox keeps its size; the text gives.
    avatar: { parts: { root: { base: { flexShrink: '0' } } } },
    checkbox: { parts: { root: { base: { flexShrink: '0' } } } },
    // A non-modal dialog is the composer: docked to the bottom corner like
    // every mail client's, so the list and the reading pane stay usable.
    dialog: {
        parts: {
            popup: {
                selectors: {
                    '&:not(:modal)': {
                        position: 'fixed',
                        insetBlockStart: 'auto',
                        insetBlockEnd: '0',
                        insetInlineStart: 'auto',
                        insetInlineEnd: 'var(--space-xl)',
                        margin: '0',
                        inlineSize: 'min(36rem, calc(100vw - 2rem))',
                        maxBlockSize: 'calc(100dvh - 4rem)',
                        overflowY: 'auto',
                        boxSizing: 'border-box',
                        borderEndStartRadius: '0',
                        borderEndEndRadius: '0',
                        boxShadow: 'var(--shadow-xl)',
                        zIndex: '20',
                    },
                },
            },
        },
    },
    // Empty states fill the pane they explain and sit in its middle.
    'empty-state': {
        parts: { root: { base: { border: 'none', background: 'transparent', flex: '1 1 auto', justifyContent: 'center', minBlockSize: '16rem' } } },
    },
    select: { parts: { value: { states: { placeholder: { color: quietInk } } } } },
    tabs: { parts: { tab: { base: { display: 'inline-flex', alignItems: 'center', gap: 'var(--space-xs)' } } } },
    // Docked, the drawer panel is the app's sidebar rail: flat on the app
    // ground, full height, scrolling on its own. As a sheet it keeps the
    // baseline's paper panel.
    drawer: {
        variants: ghostTrigger.variants,
        parts: {
            ...ghostTrigger.parts,
            panel: {
                base: {
                    padding: '0',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '0',
                    overflowY: 'auto',
                    scrollbarWidth: 'thin',
                    '--l-measure': '16.5rem',
                },
                selectors: {
                    '&[data-l-dock="sheet"]': {
                        background: 'var(--color-base-200)',
                        boxShadow: 'var(--shadow-xl)',
                    },
                },
            },
        },
    },
};
