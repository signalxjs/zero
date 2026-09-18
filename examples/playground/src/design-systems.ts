/**
 * The design systems, switchable at runtime.
 *
 * A design system is a compiled stylesheet, so switching one is a `<link>`
 * swap — not a rebuild, and not a reload. The CSS is imported with `?url` so
 * Vite hands us an href instead of injecting the stylesheet at module load;
 * nothing here is styled until `activateDesignSystem()` runs.
 *
 * SWAP, DON'T STACK. Two design systems cannot coexist in one document: token
 * blocks are `[data-theme]`-scoped, but recipe CSS is not — every DS emits the
 * same bare `[data-scope="button"][data-part="root"]` selectors into the same
 * `@layer zero.recipes`. Same selector in the same layer resolves last-wins per
 * *declaration*, not per rule, so a second stylesheet blends into the first
 * rather than replacing it. Exactly one `link[data-zero-ds]` is live at a time.
 *
 * The swap is clean, including the part that looks like it wouldn't be.
 * `@property` registrations sit outside the cascade layers, in each compiled
 * stylesheet's preamble, so it is reasonable to expect them to outlive their
 * stylesheet and leave a visited design system's roles — material-only ones
 * like `--color-tertiary` — registered for the life of the page. They don't:
 * removing the stylesheet withdraws its registrations along with everything
 * else in it. Measured in Chromium across `basic → material → basic`.
 *
 * To re-measure, exploit the fact that a registered `<color>` property rejects
 * an invalid value at computed-value time and falls back, while an unregistered
 * one is a raw token stream that comes back verbatim:
 *
 *     el.style.setProperty('--color-tertiary', 'not-a-color');
 *     getComputedStyle(el).getPropertyValue('--color-tertiary').trim() === 'not-a-color'
 *         // ^ true  => unregistered
 *         // ^ false => registered, and you are seeing the fallback
 *
 * The `.trim()` matters: getPropertyValue can return the token stream with
 * surrounding whitespace, which would read as a mismatch and misreport an
 * unregistered property as registered.
 *
 * The incoming `<link>` arrives INERT, and that is load-bearing. A stylesheet
 * starts applying the moment it is parsed, which is BEFORE its `load` event is
 * dispatched — so an unqualified link paints while the handler that retires
 * the outgoing one is still queued, and the frame in between paints both
 * design systems blended. Not a rare race, either: a rAF sampler across six
 * swaps per run caught it in 30 runs of 30 on firefox, 17 of 30 on chromium
 * and 6 of 30 on webkit (#256). The claim that used to stand here — "sampling
 * per animation frame, the number of links with a non-null `.sheet` never
 * exceeds one" — was measurement luck.
 *
 * So the link is appended with `media="not all"`, which matches nothing and
 * therefore paints nothing, and the swap picks the moment it starts to apply:
 * un-park and retire in ONE synchronous step, and no paint can land between
 * them. Exactly one design system paints before, exactly one after.
 *
 * UN-PARK THROUGH THE CSSOM, NOT THE ATTRIBUTE. `link.sheet.media.mediaText =
 * 'all'` and `link.media = 'all'` are not interchangeable here. Setting the
 * ATTRIBUTE is applied a frame late by WebKit — a forced style read after it
 * still reports the sheet as not applying, and only the next animation frame
 * sees it — while `previous.remove()` takes effect at once. The frame in
 * between then paints neither design system: swapping the blend for a flash of
 * unstyled controls, 32 swaps in 120 on webkit, with the UA's own button
 * chrome measured on screen. Setting the sheet's MediaList directly is applied
 * synchronously by all three engines, so the two halves of the swap land in
 * the same frame. The attribute is squared away afterwards, for a DOM that
 * says what is true.
 *
 * Note what parking means for anything COUNTING live sheets: an inert link
 * still has a non-null `.sheet`, so `link[data-zero-ds]` with a non-null
 * `.sheet` now counts the loading one too. A per-frame assertion must ask
 * whether the sheet APPLIES — its `media` — not merely whether it parsed;
 * `ds-smoke.spec.ts` has the sampler, and the note on how to reproduce a
 * mis-instrumented one. `activeDesignSystemId()` is unaffected: it reads the
 * first `link[data-zero-ds]` in document order, which is the outgoing one
 * until the swap commits, and the outgoing one is what is painting.
 */
import { signal } from 'sigx';
import { clearThemes, getTheme, themeController } from '@sigx/zero';
// Type-only, and that is load-bearing: @sigx/zero-kit is a Node-only tool,
// so a VALUE import would drag it into the browser bundle. The type is the
// kit's own emitted-manifest contract — the playground stops hand-declaring
// the shape it reads (#317 item 5).
import type { DesignSystemManifest } from '@sigx/zero-kit';

import basicCss from '@sigx/zero-basic/css?url';
import daisyuiCss from '@sigx/zero-daisyui/css?url';
import materialCss from '@sigx/zero-material/css?url';
import brutalistCss from '@sigx/zero-brutalist/css?url';
import herouiCss from '@sigx/zero-heroui/css?url';
import carbonCss from '@sigx/zero-carbon/css?url';

import { installThemes as installBasic } from '@sigx/zero-basic';
import { installThemes as installDaisyui } from '@sigx/zero-daisyui';
import { installThemes as installMaterial } from '@sigx/zero-material';
import { installThemes as installBrutalist } from '@sigx/zero-brutalist';
import { installThemes as installHeroui } from '@sigx/zero-heroui';
import { installThemes as installCarbon } from '@sigx/zero-carbon';

// The DECLARED vocabulary, read from each compiled manifest rather than
// retyped here. Retyping is what made the axis rows lie: they iterated a
// literal `['solid','outline','soft','ghost']`, so a design system with a
// different vocabulary rendered buttons that matched nothing — silently, since
// an unmatched `data-variant` is just an attribute nobody styled.
//
// Fetched, not imported, for the same reason the CSS above is `?url`: a
// compiled manifest is ~11 kB of themes, per-component axes and the whole
// token payload, and the four arrays this file wants are a sliver of it.
// Statically importing five of them would inline ~57 kB into the bundle and
// grow with every design system added. `?url` makes each an asset fetched
// only when its design system is activated.
import basicManifestUrl from '@sigx/zero-basic/manifest.json?url';
import daisyuiManifestUrl from '@sigx/zero-daisyui/manifest.json?url';
import materialManifestUrl from '@sigx/zero-material/manifest.json?url';
import brutalistManifestUrl from '@sigx/zero-brutalist/manifest.json?url';
import herouiManifestUrl from '@sigx/zero-heroui/manifest.json?url';
import carbonManifestUrl from '@sigx/zero-carbon/manifest.json?url';

/**
 * What a design system says it offers, straight from its manifest.
 *
 * `colors` is empty for a design system with no colour axis — HeroUI v3
 * removed the prop entirely — and the playground renders no colour row rather
 * than four buttons that match nothing.
 */
export interface AxisVocabulary {
    colors: string[];
    sizes: string[];
    variants: string[];
    modifiers: string[];
    /**
     * What each SCOPE wires, which is not the same question as what the design
     * system declares. `tokens.variants` is the union; a scope can narrow it
     * (`tokens.scopes` — docs/architecture.md, "Declared vocabulary") and
     * most scopes wire nothing at all —
     * so a demo that picks from the union alone renders `data-variant` values
     * that match no rule for the component it is on. Keyed by scope; a scope
     * absent here wires nothing.
     */
    perScope: Record<string, { variants: string[] }>;
}

const EMPTY_VOCABULARY: AxisVocabulary = { colors: [], sizes: [], variants: [], modifiers: [], perScope: {} };

const vocabularyOf = (manifest: DesignSystemManifest): AxisVocabulary => ({
    colors: Object.keys(manifest.tokens.roles),
    sizes: [...manifest.tokens.sizes],
    variants: [...manifest.tokens.variants],
    modifiers: [...manifest.tokens.modifiers],
    perScope: Object.fromEntries(
        Object.entries(manifest.components).map(([scope, wired]) => [
            scope,
            { variants: [...wired.variant] },
        ]),
    ),
});

/** Parsed manifests, kept so a re-visited design system re-reads nothing. */
const vocabularies = new Map<string, AxisVocabulary>();

async function loadVocabulary(entry: DesignSystemEntry): Promise<AxisVocabulary> {
    const cached = vocabularies.get(entry.id);
    if (cached) return cached;
    try {
        const response = await fetch(entry.manifestHref);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const manifest = await response.json() as DesignSystemManifest;
        // The manifest is versioned now (#317): a shape mismatch is a named
        // failure here, not a hand-maintained pile of `?? []` drift defenses.
        // The literal matches DS_MANIFEST_VERSION in @sigx/zero-kit — a value
        // import would pull the Node-only kit into the browser bundle, which
        // is why only the TYPE is imported above.
        if (manifest.manifestVersion !== 1) {
            throw new Error(`unsupported manifestVersion ${String(manifest.manifestVersion)} — this playground reads version 1`);
        }
        const vocabulary = vocabularyOf(manifest);
        vocabularies.set(entry.id, vocabulary);
        return vocabulary;
    } catch (cause) {
        // The stylesheet is the design system; the manifest only describes it.
        // A failed fetch costs the demo its axis rows, not the page.
        console.error(`[playground] could not read the ${entry.id} manifest`, cause);
        return EMPTY_VOCABULARY;
    }
}

export interface DesignSystemEntry {
    id: string;
    label: string;
    /** Compiled stylesheet URL — the design system itself. */
    href: string;
    /** Seeds the zero theme registry with this DS's themes. */
    installThemes: () => void;
    /** Compiled manifest URL — where the declared axes are read from. */
    manifestHref: string;
    blurb: string;
}

export const designSystems: DesignSystemEntry[] = [
    {
        id: 'basic',
        label: 'Basic',
        href: basicCss,
        installThemes: installBasic,
        manifestHref: basicManifestUrl,
        blurb: 'Monograph — paper surfaces, hairline structure, one petrol ink. Readable defaults, eight colour roles.',
    },
    {
        id: 'daisyui',
        label: 'daisyUI',
        href: daisyuiCss,
        installThemes: installDaisyui,
        manifestHref: daisyuiManifestUrl,
        blurb: 'daisyUI token values over zero anatomy. No Tailwind involved.',
    },
    {
        id: 'material',
        label: 'Material',
        href: materialCss,
        installThemes: installMaterial,
        manifestHref: materialManifestUrl,
        blurb: 'Thirteen colour roles, a level1–level5 elevation ramp, its own breakpoints.',
    },
    {
        id: 'brutalist',
        label: 'Brutalist',
        href: brutalistCss,
        installThemes: installBrutalist,
        manifestHref: brutalistManifestUrl,
        blurb: 'Generated from a style brief through the design-system skill.',
    },
    {
        id: 'heroui',
        label: 'HeroUI',
        href: herouiCss,
        installThemes: installHeroui,
        manifestHref: herouiManifestUrl,
        blurb: 'No colour axis at all — colour is fused into a seven-member variant. '
            + 'Full component coverage; it exists to test the axis surface.',
    },
    {
        id: 'carbon',
        label: 'Carbon',
        href: carbonCss,
        installThemes: installCarbon,
        manifestHref: carbonManifestUrl,
        blurb: 'Carbon-flavoured — no colour axis, a fused seven-member kind vocabulary '
            + 'with Carbon\'s double-hyphen spellings restored at the prop boundary by '
            + 'the generated ./components module. Full 23-recipe coverage.',
    },
];

const STORAGE_KEY = 'zero-ds';
const LINK_ATTR = 'data-zero-ds';

export const DEFAULT_DESIGN_SYSTEM = designSystems[0]!;

/**
 * The live design system, reactively.
 *
 * `activeDesignSystemId()` reads the document, which is the truth but is not
 * observable — and the axis rows have to re-render when the vocabulary
 * changes. The toolbar keeps its own copy for its busy/label handling; this is
 * the shared one, updated only after a swap actually commits.
 */
const active = signal({ id: DEFAULT_DESIGN_SYSTEM.id, vocabulary: EMPTY_VOCABULARY });

export function activeDesignSystem(): DesignSystemEntry {
    return designSystems.find((ds) => ds.id === active.id) ?? DEFAULT_DESIGN_SYSTEM;
}

/** The active design system's declared axes — empty until its manifest lands. */
export function activeVocabulary(): AxisVocabulary {
    return active.vocabulary;
}

/**
 * The first of `preferred` the ACTIVE design system actually declares.
 *
 * The same rule the axis rows follow, applied to a single *choice* rather than
 * a list: a demo that wants "the error-ish colour" or "the quiet variant"
 * names the values it would accept, in order, and gets whichever one the live
 * design system really has. Retyping a literal is what made the axis rows lie
 * (see the note above `basicManifestUrl`); these exist so nothing else in the
 * playground has to.
 *
 * `undefined` is a legitimate answer, not a failure — heroui and carbon
 * declare `roles: {}`, so there is no colour to pick, and omitting the prop is
 * honest where sending an unmatched `data-color` is not. It is also the answer
 * before the first manifest lands: `active.vocabulary` starts as
 * `EMPTY_VOCABULARY` and is filled only once a swap commits (see
 * `activateDesignSystem`). That is why these are functions read inside a
 * render closure rather than constants — the answer changes with the swap.
 */
const pickDeclared = (declared: string[], preferred: string[]): string | undefined =>
    preferred.find((value) => declared.includes(value));

/** Pick a `color` value from the active design system's declared roles. */
export function pickRole(...preferred: string[]): string | undefined {
    return pickDeclared(activeVocabulary().colors, preferred);
}

/** Pick a `variant` value from the active design system's declared variants. */
export function pickVariant(...preferred: string[]): string | undefined {
    return pickDeclared(activeVocabulary().variants, preferred);
}

/**
 * Pick a modifier name from the active design system's declared set — the
 * same rule as `pickRole`, asked of `data-mod-*`. Table's zebra striping is
 * the motivating case: four skins call it `zebra`, HeroUI spells it
 * `striped`, and a demo hardcoding either would render an undeclared
 * `data-mod-*` on the others (ds-smoke's third invariant).
 */
export function pickMod(...preferred: string[]): string | undefined {
    return pickDeclared(activeVocabulary().modifiers, preferred);
}

/**
 * The same choice, asked of one SCOPE rather than of the design system.
 *
 * `pickVariant` answers "does this design system have such a value", which was
 * the only question worth asking while `button` was the only scope that wired
 * one. It is the wrong question for any other component: daisyUI, material and
 * brutalist all DECLARE `solid | outline | soft | ghost` and wire none of it on
 * `select`, so picking from the union sets an attribute that matches nothing —
 * the exact "renders but matches nothing" failure #215 is about, one level down
 * from where that fix looked.
 *
 * Nothing catches it either: `ds-smoke`'s undeclared-value invariant checks the
 * union too. Worth a scope-aware pass there — see the note in that spec.
 */
export function pickScopeVariant(scope: string, ...preferred: string[]): string | undefined {
    return pickDeclared(activeVocabulary().perScope[scope]?.variants ?? [], preferred);
}

/** The persisted choice, falling back to the default for an unknown id. */
export function resolvePersistedDesignSystem(): DesignSystemEntry {
    let stored: string | null = null;
    try {
        stored = localStorage.getItem(STORAGE_KEY);
    } catch {
        // Storage unavailable (privacy mode) — start from the default.
    }
    return designSystems.find((ds) => ds.id === stored) ?? DEFAULT_DESIGN_SYSTEM;
}

/** The design system whose stylesheet is currently in the document. */
export function activeDesignSystemId(): string | undefined {
    return document.querySelector(`link[${LINK_ATTR}]`)?.getAttribute(LINK_ATTR) ?? undefined;
}

/**
 * Load a design system's stylesheet and make it the only one.
 * Resolves `true` once it is active, `false` if the stylesheet failed to load.
 *
 * The new link is appended and awaited BEFORE the old one is removed, so the
 * page never renders through a frame with no design system. Appending also
 * puts the DS last in document order, which is what keeps its `:where(:root)`
 * block winning over `brand-theme.css` inside `@layer zero.tokens`.
 *
 * A failed load commits nothing. Tearing down the previous stylesheet and
 * re-seeding the registry anyway would leave the page unstyled while the
 * registry claimed otherwise — themes advertised for a design system whose CSS
 * never arrived, which is precisely the desync `clearThemes()` exists to
 * prevent. The old design system stays live instead.
 */
export async function activateDesignSystem(entry: DesignSystemEntry): Promise<boolean> {
    const previous = document.querySelector(`link[${LINK_ATTR}]`);
    if (previous?.getAttribute(LINK_ATTR) === entry.id) return true;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = entry.href;
    link.setAttribute(LINK_ATTR, entry.id);
    // Load it, but do not let it paint yet. A stylesheet goes live the moment
    // it is parsed, which is BEFORE its `load` event is dispatched — so an
    // unqualified link can be applying while the handler that retires the old
    // one is still queued, and the frame in between paints both blended.
    // `media="not all"` matches nothing, so the sheet arrives inert and this
    // function decides when it applies.
    link.media = 'not all';

    const loaded = await new Promise<boolean>((resolve) => {
        // Never reject: an unbuilt design system should leave the playground
        // usable rather than hanging the boot.
        link.addEventListener('load', () => resolve(true), { once: true });
        link.addEventListener('error', () => resolve(false), { once: true });
        document.head.append(link);
    });

    if (!loaded) {
        console.error(`[playground] failed to load the ${entry.id} stylesheet — run \`pnpm build\``);
        link.remove();
        return false;
    }

    // THE COMMIT — un-park and retire in ONE synchronous step. No paint can
    // land between two statements in the same task, so the document goes from
    // exactly one painting design system to exactly one: never two (the blend
    // this fixes), and never zero (the flash that removing first would cause).
    //
    // Through the sheet's own MediaList, NOT `link.media = 'all'`: WebKit
    // applies an attribute-driven media change a frame late while it removes a
    // link at once, which turns this swap into the flash instead. Setting the
    // MediaList is synchronous in all three engines. See the header.
    if (link.sheet) link.sheet.media.mediaText = 'all';
    previous?.remove();
    // The sheet is already painting; this only squares the DOM away, so that
    // the committed link is an ordinary `<link rel="stylesheet">` and nothing
    // reading the attribute is told it matches nothing.
    link.removeAttribute('media');

    // Theme names are DS-specific, so the registry is replaced, not extended.
    // `clearThemes()` also resets the controller's explicit theme (#317), so
    // the previous choice is captured FIRST and re-applied afterwards when
    // the incoming design system defines the same name — daisyui's `dark`
    // survives a hop to a design system that also ships a `dark`.
    const previousTheme = themeController().theme();
    clearThemes();
    entry.installThemes();
    if (previousTheme && getTheme(previousTheme)) themeController().setTheme(previousTheme);

    // Only now — a failed load leaves the previous design system live, and
    // the vocabulary the demo renders must describe the CSS that is actually
    // in the document. Both fields move together for the same reason.
    active.vocabulary = await loadVocabulary(entry);
    active.id = entry.id;

    try {
        localStorage.setItem(STORAGE_KEY, entry.id);
    } catch {
        // Persistence is best-effort.
    }
    return true;
}

