/**
 * The data face of this package — what a design system consumes.
 *
 * Pure data on purpose (the anatomy import pulls no component code, and the
 * kit import is type-only), so a `build.mjs`-style Node script can import
 * this entry without loading the sigx runtime.
 */
import type { RecipeInput } from '@sigx/zero-kit';
// The contract subpath stays runtime-light (no components, no sigx runtime),
// which is what keeps this entry importable from a Node build script.
import { FRAGMENT_VERSION, RECOMMENDED_ROLE_LIST } from '@sigx/zero/contract';
import { stepperAnatomy } from './anatomy.js';

/**
 * The manifest fragment: `mergeManifests(zeroManifest, fragment)` (or
 * `--extra-manifest` pointing at a JSON copy) is how a design system opts
 * into covering this component. The `package` specifier is the provenance
 * every downstream artifact records.
 */
export const fragment = {
    // The fragment contract version this package was built against — read
    // from zero's contract (a peer, so present at runtime), never from the
    // kit, whose import must stay type-only for this entry to load without
    // it. mergeManifests hard-errors on a mismatch, which is the point: a
    // stale fragment fails by name.
    version: FRAGMENT_VERSION,
    package: '@sigx/zero-ext-example',
    components: [stepperAnatomy.toJSON()],
};

/**
 * The recipe pack: default styling written against the RECOMMENDED token
 * grammar — role names from `RECOMMENDED_ROLE_LIST`, no design-system
 * specifics — so any design system keeping the recommended vocabulary can
 * adopt it by spreading these into its `recipes`. A design system with its
 * own vocabulary writes its own recipe instead; one that does neither leaves
 * the component unstyled-but-accessible, the contract's baseline.
 *
 * All three item states are styled distinctly — `complete` keeps the primary
 * ink without the fill — so the state-legibility guard has ink to measure.
 */
export const recipes: RecipeInput[] = [{
    component: 'ext-stepper',
    parts: {
        root: {
            base: {
                display: 'flex',
                // The ramp, not the number: a pack written to the recommended
                // grammar answers to an adopter's density override the same
                // way its own components do.
                //
                // WITH a fallback, which is optional for a pack since #158
                // but still buys something. `system.spacing` is optional, and
                // a design system that omits it emits no `--space-*` at all;
                // on web zero's base.css still resolves the reference from
                // `@layer zero.fallback`, but lynx has no such layer, so that
                // adopter's lynx build would fail on the dangling reference.
                // `sigx zero:fragment`'s probe assumes the recommended
                // non-colour keys are defined, so it passes a bare reference.
                gap: 'var(--space-md, 0.5rem)',
                alignItems: 'center',
            },
        },
        item: {
            base: {
                appearance: 'none',
                border: '1px solid var(--color-base-300)',
                borderRadius: 'var(--radius-selector, 0.25rem)',
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
                // The `md` step of the size axis below — the un-attributed
                // render IS the middle step, the convention every in-repo
                // skin follows. Padding is in `em`, so it rides the type.
                fontSize: 'var(--text-md, 1rem)',
                paddingInline: '0.75em',
                paddingBlock: '0.375em',
                cursor: 'pointer',
            },
            states: {
                active: {
                    background: 'var(--color-primary)',
                    color: 'var(--color-primary-content)',
                    borderColor: 'var(--color-primary)',
                },
                complete: {
                    color: 'var(--color-primary)',
                    borderColor: 'var(--color-primary)',
                },
                inactive: {},
                'focus-visible': {
                    outline: '2px solid var(--color-primary)',
                    outlineOffset: '2px',
                },
                disabled: {
                    // The adopter's own fade (#192): every skin sets
                    // `--disabled-opacity` (0.25–0.5), and a literal here
                    // made the stepper the one part that ignored it. The
                    // fallback is zero's base.css default, for lynx, which
                    // has no fallback layer.
                    opacity: 'var(--disabled-opacity, 0.4)',
                    cursor: 'not-allowed',
                },
            },
        },
    },
    // A `color` axis over the WHOLE recommended role list, generated rather
    // than enumerated — a pack that wired a subset would diverge from every
    // sibling component in the adopting design system (the kit warns about
    // exactly that), and an adopting register module proves an ecosystem
    // scope narrows exactly like a zero one (type-tests/ecosystem/).
    variants: {
        // The size axis over the recommended ramp (#192). An adopter that
        // declares a size axis offers `size` on every scope, so a pack that
        // wired none shipped a prop typed `never` and an axis-coverage
        // warning. Size moves metrics only: the type steps along
        // `--text-*` and the `em` padding follows. A closed ramp (heroui's
        // `sm | md | lg`) is fitted on adoption — the off-ramp steps drop.
        size: {
            xs: { item: { base: { fontSize: 'var(--text-xs, 0.75rem)' } } },
            sm: { item: { base: { fontSize: 'var(--text-sm, 0.875rem)' } } },
            // The base already is the middle step; an empty entry emits no
            // rule and keeps it.
            md: {},
            lg: { item: { base: { fontSize: 'var(--text-lg, 1.125rem)' } } },
            xl: { item: { base: { fontSize: 'var(--text-xl, 1.25rem)' } } },
        },
        color: Object.fromEntries(RECOMMENDED_ROLE_LIST.map((role) => [role, {
            item: {
                states: {
                    active: {
                        background: `var(--color-${role})`,
                        color: `var(--color-${role}-content)`,
                        borderColor: `var(--color-${role})`,
                    },
                    complete: {
                        color: `var(--color-${role})`,
                        borderColor: `var(--color-${role})`,
                    },
                    'focus-visible': {
                        outline: `2px solid var(--color-${role})`,
                    },
                },
            },
        }])),
    },
    // The lynx engine resolves logical padding spellings on iOS but not on
    // Android (measured, signalxjs/lynx#1084), so the emitter refuses them;
    // physical spellings are that target's norm (no RTL flow on lynx).
    targets: {
        lynx: {
            parts: {
                item: {
                    base: {
                        paddingLeft: '0.75em',
                        paddingRight: '0.75em',
                        paddingTop: '0.375em',
                        paddingBottom: '0.375em',
                    },
                },
            },
        },
    },
}];
