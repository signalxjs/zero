/**
 * The accepts-but-unwired guard.
 *
 * A component that composes `WithVariantAxes` accepts `color` / `size` /
 * `variant` at runtime and renders them as `data-*`. If no design system wires
 * an axis, the attribute matches nothing — and under an opted-in `/register`
 * module the generated type is `never`, so the prop is offered and then
 * rejected — the accepts-but-unwired gap (docs/architecture.md, "The
 * ledgers"); #103 removed it once.
 *
 * It came straight back. NumberInput (#136), RatingGroup (#142) and TreeView
 * (#144) all landed AFTER #103 merged, each carrying the axis props with
 * nothing wired, and nothing failed. That is the gap this file closes: the
 * check is structural, so component #24 cannot reintroduce it quietly.
 *
 * The carrier list is read from the component sources rather than hardcoded,
 * for the same reason: a hardcoded list is one more thing to forget.
 *
 * The colour/size question itself is the kit's `axis-coverage` audit rule
 * (`src/audit/rules/axis-coverage.ts`, #403), so a design system generated
 * outside this repo is asked it too. What stays here is what is a fact about
 * this repo rather than about a design system: the carrier discovery, the
 * `NO_VARIANT` ledger, and the `UNWIRED_AXES` debt ledger the rule's findings
 * are filtered through.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { auditDesignSystem, compileDesignSystem } from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { designSystem as daisyDS } from '@sigx/zero-daisyui';
import { designSystem as materialDS } from '@sigx/zero-material';
import { designSystem as brutalistDS } from '@sigx/zero-brutalist';
import { designSystem as herouiDS } from '@sigx/zero-heroui';
import { designSystem as carbonDS } from '@sigx/zero-carbon';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

// Resolved from the vitest root, like every other filesystem-reading test
// here: `import.meta.url` is rewritten by the test server and does not hit
// disk (see `schemas.test.ts` and `contract-parity.test.ts`).
const COMPONENTS_DIR = resolve(process.cwd(), 'packages/zero/src/components');

/**
 * Component scopes whose props compose `WithVariantAxes`. The directory name
 * IS the scope (`tree-view`, `number-input`), which the anatomy assertion
 * below pins.
 */
const carriers: string[] = readdirSync(COMPONENTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .filter((entry) => {
        const dir = resolve(COMPONENTS_DIR, entry.name);
        return readdirSync(dir)
            .filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
            .some((f) => readFileSync(resolve(dir, f), 'utf8').includes('WithVariantAxes'));
    })
    .map((e) => e.name)
    .sort();

const inputs: Record<string, DesignSystemInput> = {
    basic: basicDS as DesignSystemInput,
    daisyui: daisyDS as DesignSystemInput,
    material: materialDS as DesignSystemInput,
    brutalist: brutalistDS as DesignSystemInput,
    heroui: herouiDS as DesignSystemInput,
    carbon: carbonDS as DesignSystemInput,
};

const designSystems = {
    basic: compileDesignSystem(basicDS, manifest),
    daisyui: compileDesignSystem(daisyDS, manifest),
    material: compileDesignSystem(materialDS, manifest),
    brutalist: compileDesignSystem(brutalistDS, manifest),
    heroui: compileDesignSystem(herouiDS, manifest),
    carbon: compileDesignSystem(carbonDS, manifest),
};

/**
 * `variant` is wired on `button` alone, and that is now a DECISION rather than
 * a deferral (#175, discharging the expressiveness RFC's gate: "wire it, or record
 * the divergence per component with its reason").
 *
 * The twenty were surveyed one at a time against the conformance program's
 * vendor set (docs/architecture.md §7) — the
 * reasons below are the survey — and the result is more uniform than the issue
 * guessed. **Eighteen of the twenty do carry a variant in a real design
 * system. Not one of the eighteen spells it `solid | outline | soft | ghost`.**
 *
 * That is the convention-versus-contract thesis arriving at its consequence
 * (docs/architecture.md, "Declared vocabulary"). The four convention design
 * systems declare a BUTTON's vocabulary and declare it design-system-wide, so
 * wiring these carriers means painting `ghost` onto a progress bar — a value
 * its own design language does not have.
 *
 * **That blocker is gone (#294).** `tokens.scopes` landed the per-scope
 * restriction map the contract long deferred, and `tokens.variants` is now the union
 * of every scope's vocabulary rather than the button's — so the reasons below
 * no longer say "inexpressible", they say "not declared yet". Wiring any of
 * the fourteen is now a design system's decision, taken one skin at a time,
 * and it costs the recipes plus the contrast audit's ancestor chains
 * (nineteen of the twenty carry their axes on a part that renders no text —
 * `toggle` is the one whose carrier is the text-bearing element itself).
 *
 * `select` LEFT this ledger in #297, and how it left is the template for the
 * rest: zero-basic gives it `outline | soft | ghost` through `tokens.scopes`,
 * and the contrast audit reaches its trigger, value and items through declared
 * `AXIS_CHAINS` rather than the one-element probe that could never see them.
 * The blocker on the other nineteen is now work, not expressiveness.
 *
 * `badge` is deliberately NOT here, and is the reason the ledger is no longer
 * the whole story: zero-basic wires its variant against a vocabulary badge
 * declares for itself (`tokens.scopes`, #294 / #311). It is the content
 * tier's arrival the per-scope deferral always named as its trigger, and it could go
 * first because its carrier IS its text-bearing part — the one shape the
 * contrast audit's one-element probe can measure without #297's chains.
 *
 * So `never` is still the correct compiled answer for all twenty today —
 * none of the six declares a vocabulary for them — and this ledger is the
 * reason it is correct rather than merely absent.
 *
 * Sources are the design systems' own prop tables, verified 2026-08-02, in the
 * style `skills/design-system/conformance/*.ts` uses for the same claim.
 */
const NO_VARIANT: Record<string, string> = {
    // ── Radix Themes' form-control family: one vocabulary, seven controls,
    //    and it is not this one. ────────────────────────────────────────────
    checkbox: 'Radix Themes Checkbox varies as classic | surface | soft.',
    switch: 'Radix Themes Switch varies as classic | surface | soft.',
    'radio-group': 'Radix Themes RadioGroup varies as classic | surface | soft.',
    slider: 'Radix Themes Slider varies as classic | surface | soft.',
    progress: 'Radix Themes Progress varies as classic | surface | soft — so '
        + 'the issue\'s guess that a varied progress bar is meaningless is wrong; '
        + 'what is meaningless is a GHOST one.',
    'number-input': 'Radix Themes TextField varies as classic | surface | soft.',
    // The two the entry above was already describing: `number-input`'s cited
    // source IS Radix's text field, so the plain one and its multi-line
    // sibling inherit the same answer rather than a new one.
    input: 'Radix Themes TextField varies as classic | surface | soft.',
    textarea: 'Radix Themes TextArea varies as classic | surface | soft.',
    // The custom Select wires a variant (zero-basic's outline | soft | ghost,
    // #297); its native sibling deliberately does not: the surveyed vendors
    // ── The rest of bucket A: a variant exists, spelled differently again. ──
    avatar: 'Radix Themes Avatar varies as solid | soft.',
    'toggle-group': 'Radix Themes SegmentedControl varies as surface | classic.',
    combobox: 'Ant Design v6 AutoComplete varies as outlined | borderless | '
        + 'filled | underlined.',
    // tabs left this ledger in #377: zero-daisyui wires `variant` as daisy's
    // border | lift | box flavors, with its own `tokens.scopes.tabs`
    // vocabulary. (The survey rows that justified the deferral: HeroUI v3
    // varies as primary | secondary, Carbon as line vs contained.)
    toggle: 'Material 3 makes the toggle a MODE of the icon button rather than '
        + 'a component — all four (standard, filled, filled-tonal, outlined) '
        + 'take `toggle`, so the variant is the button\'s and follows it.',

    // ── The animated pair (#314). Both DO have a style axis somewhere, and
    //    neither is a fill/chrome one — the survey's point twice over. ──
    skeleton: 'Ant Design Skeleton varies as its `active` shimmer vs a static '
        + 'block, and Chakra spells the same split `isLoaded` — a MOTION axis, '
        + 'not a fill one, and zero already carries it as `data-state`.',
    spinner: 'Ant Design Spin varies by `indicator` (the glyph itself is '
        + 'replaceable) and Material spells its two `determinate` and '
        + '`indeterminate` — a shape axis rather than a chrome one.',

    // ── Bucket B: no surveyed system varies these at all. The only two where
    //    "no variant here" is the whole answer, and no per-scope vocabulary
    //    would change it. ──
    // ── The content tier (#311). Card and alert have a variant in a surveyed
    //    system and cannot wire it yet: their text sits BELOW a non-text
    //    carrier, which the contrast audit's `axis coverage` guard rejects
    //    until #297 lands the ancestor chains. Divider is bucket B's third.
    // Box is the layout tier's surface, and the surveyed systems agree it is
    // not the varied one: Radix Themes' Box is a layout primitive with no
    // chrome at all, and Chakra's and MUI's are style-prop escape hatches
    // (`sx`). Every system that DOES vary a surface calls that component a
    // Card — which is the entry above, and why zero ships both.
    box: 'Radix Themes Box is an unvaried layout primitive; the varied surface in every '
        + 'surveyed system is its Card, recorded separately above.',
    card: 'Radix Themes Card varies as surface | classic | ghost.',
    alert: 'Radix Themes Callout varies as soft | surface | outline.',
    divider: 'Ant Design Divider varies as solid | dashed | dotted — a stroke '
        + 'style rather than a fill, which is the axis in a different sense '
        + 'again and exactly the survey\'s point.',

    'rating-group': 'no surveyed system varies a rating control — Ant Design\'s '
        + 'Rate has size and character, no style axis.',
    'tree-view': 'no surveyed system varies a tree — Ant Design\'s Tree styles '
        + 'through showLine / blockNode / classNames, not a style axis.',

    // ── The Contract v1 carriers (#317 item 4): the eight scopes that had no
    //    axis surface at all. Several DO carry a variant in a surveyed system,
    //    and none of the six skins declares a vocabulary for them yet — the
    //    same "not declared yet" status the rest of this ledger records. ──
    accordion: 'HeroUI v2 Accordion varies as light | shadow | bordered | '
        + 'splitted; no shipped skin declares a vocabulary for it yet (#321).',
    collapsible: 'no surveyed system varies a bare disclosure — the chrome '
        + 'belongs to the accordion it usually composes into.',
    dialog: 'no surveyed system varies a dialog\'s chrome — Radix, HeroUI and '
        + 'Material all size it and leave the surface singular.',
    field: 'no surveyed system varies a form-field wrapper — the variant '
        + 'lives on the control inside it (Radix TextField\'s '
        + 'classic | surface | soft).',
    menu: 'no surveyed system varies a menu — Radix DropdownMenu and HeroUI '
        + 'Dropdown style through the item, not a style axis.',
    popover: 'no surveyed system varies a popover surface.',
    toast: 'Chakra\'s toast varies as solid | subtle | left-accent | '
        + 'top-accent; no shipped skin declares a vocabulary for it yet '
        + '(#321) — colour, its actual axis here, IS wired (toast.color).',
    tooltip: 'Ant Design Tooltip varies by `color`, not a chrome variant; '
        + 'HeroUI colours it through its fused variant, undeclared for '
        + 'tooltip in the shipped skins.',

    // ── The content-tier sweep (#334). ──
    kbd: 'no surveyed system varies a keycap — daisyUI\'s kbd carries only a '
        + 'size ramp, and HeroUI\'s Kbd styles through `keys`, not a style axis.',
    status: 'no surveyed system varies a presence dot — daisyUI\'s status has '
        + 'colour and size only, and the colour axis IS this component\'s '
        + 'whole vocabulary.',
    indicator: 'no surveyed system varies a positioning wrapper — daisyUI\'s '
        + 'indicator has placement classes only; the chrome belongs to the '
        + 'item\'s content (a badge, a dot), never to the anchor.',
    stats: 'no surveyed system varies a stat group — daisyUI\'s stats has '
        + 'orientation and an optional shadow, not a style axis.',
    timeline: 'daisyUI\'s timeline styles through snap/compact modifiers and '
        + 'a boxed content class, not a fill variant; Ant Design\'s Timeline '
        + 'has mode (side) and pending, no style axis.',
    chat: 'daisyUI\'s chat bubble varies by COLOUR only (chat-bubble-primary, '
        + '…) — wired here as the color axis on the row — and by side, which '
        + 'is data-placement, not a chrome variant.',
    'radial-progress': 'daisyUI\'s radial-progress varies by colour, size and '
        + 'thickness — the first is the color axis, the others metrics; no '
        + 'surveyed system gives the ring a chrome variant.',
    carousel: 'no surveyed system varies a scroll-snap gallery — daisyUI\'s '
        + 'carousel modifies snap alignment (start/center/end) and axis, both '
        + 'geometry; HeroUI and Carbon ship no carousel at all.',
    countdown: 'daisyUI\'s countdown is one class with no variant — its only '
        + 'knobs are text size and the --value custom property; no other '
        + 'surveyed system ships a countdown display.',
    diff: 'daisyUI\'s diff has no variant — one resizer look; no other '
        + 'surveyed system ships a comparison slider.',
    'file-upload': 'daisyUI\'s file-input varies as ghost — the shared input '
        + 'vocabulary, whose answer input\'s own entry already records; Carbon\'s '
        + 'FileUploader and Ark/Zag\'s file-upload ship no variant axis at all.',
    swap: 'daisyUI\'s swap varies as rotate | flip — transition styling this '
        + 'package expresses per skin as its one look, not a fill vocabulary; '
        + 'no other surveyed system ships a swap at all.',
    table: 'Radix Themes Table varies as surface | ghost — a chrome choice '
        + 'this sweep defers with sorting; daisyUI\'s table varies through '
        + 'zebra / pin modifiers and sizes, and Carbon\'s DataTable through '
        + 'useZebraStyles and size, not a fill vocabulary.',
    join: 'no surveyed system varies a radius-collapsing group — daisyUI\'s '
        + 'join has orientation only; the chrome belongs to the joined '
        + 'controls.',

    // ── The navigation tier (#339). ──
    navbar: 'no surveyed system varies a header bar — daisyUI\'s navbar is '
        + 'one padded surface recoloured by the shared background utilities '
        + '(the color axis, wired here), and HeroUI\'s Navbar styles through '
        + 'isBlurred/isBordered booleans, not a chrome vocabulary.',
    breadcrumbs: 'no surveyed system varies a breadcrumb trail — Ant Design\'s '
        + 'Breadcrumb has separator and menu props only, HeroUI\'s underline '
        + 'prop is a hover-decoration mode, and Carbon\'s noTrailingSlash is a '
        + 'boolean, not a chrome vocabulary.',
    pagination: 'MUI Pagination varies as text | outlined and HeroUI as '
        + 'flat | bordered | light | faded — a real chrome vocabulary in two '
        + 'surveyed systems, spelled differently again; no shipped skin '
        + 'declares one for it yet.',
    steps: 'no surveyed system varies a step rail — Carbon\'s '
        + 'ProgressIndicator styles through vertical/spaceEqually booleans, '
        + 'Ant Design\'s Steps `type` (default | navigation | inline) changes '
        + 'the LAYOUT of the rail rather than its chrome, and daisyUI\'s steps '
        + 'vary by colour only, wired here as the color axis.',
    drawer: 'no surveyed system varies a drawer\'s chrome — like dialog: '
        + 'HeroUI\'s Drawer varies by placement/size/backdrop (all structural '
        + 'or metric), Material\'s standard-vs-modal split is zero\'s modal '
        + 'prop, and daisyUI\'s drawer has layout modifiers only.',
};

/**
 * (scope, axis) pairs a design system may leave unwired FOR NOW — the
 * ledgered exception to the colour/size rule below, in the same
 * bound-from-both-ends style as `NO_VARIANT`.
 *
 * Every entry here is DEBT with an issue, not a decision. The ledger's one
 * population so far — the Contract v1 carriers' colour and size axes (#317
 * item 4) — emptied when #321 wired all six skins, and the stale check below
 * is what forces that cleanup: an entry outliving its recipes would silently
 * re-open the accepts-but-unwired hole this file exists to close.
 */
const UNWIRED_AXES: Record<string, string> = {};

const CHECKED_AXES = (['color', 'size'] as const);

describe('no component accepts an axis no design system wires', () => {
    it('finds the carriers by reading the component sources', () => {
        // A sanity check on the discovery itself: if this returns nothing, the
        // whole suite would pass vacuously.
        expect(carriers.length).toBeGreaterThan(10);
        expect(carriers).toContain('tree-view');
        expect(carriers).toContain('button');
    });

    it('every carrier is a real anatomy scope', () => {
        const scopes = new Set(manifest.components.map((c) => c.scope));
        for (const carrier of carriers) expect(scopes).toContain(carrier);
    });

    it.each(Object.keys(designSystems))('%s wires colour and size for every carrier it skins', (name) => {
        // The rule already knows that an axis declared OUT of existence is
        // not a gap (`roles: {}`, `sizes: []`, or a scope's own `[]` in
        // `tokens.scopes` — zero-heroui is the colourless case) and that a
        // scope with no recipe is the validator's failure, not this one's.
        // What it cannot know is this repo's debt ledger, applied here.
        const findings = auditDesignSystem(inputs[name]!, manifest, {
            rules: ['axis-coverage'],
            compiled: designSystems[name as keyof typeof designSystems],
        }).findings;
        const gaps = findings
            .filter((f) => carriers.includes(f.scope!))
            .filter((f) => !(f.where in UNWIRED_AXES))
            .map((f) => f.where);
        expect(gaps, `${name} accepts these axes at runtime and wires nothing for them`).toEqual([]);
        // The rule reports only the two checked axes, by design (`variant` is
        // the ledger's question, below).
        for (const f of findings) expect(CHECKED_AXES as readonly string[]).toContain(f.axis);
    });

    // The unwired ledger, bound from both ends like NO_VARIANT: an entry must
    // name a real carrier, and it must still be describing a real gap — an
    // entry whose axis every declaring skin now wires is dead weight that
    // would absorb the next regression.
    it('every UNWIRED_AXES entry names a real carrier and axis', () => {
        for (const key of Object.keys(UNWIRED_AXES)) {
            const [scope, axis] = key.split('.') as [string, string];
            expect(carriers, `UNWIRED_AXES: "${scope}" is not a variant-axes carrier`).toContain(scope);
            expect(CHECKED_AXES as readonly string[], `UNWIRED_AXES: "${axis}" is not a checked axis`).toContain(axis);
        }
    });

    it('every UNWIRED_AXES entry still describes a gap in some design system', () => {
        const stale = Object.keys(UNWIRED_AXES).filter((key) => {
            const [scope, axis] = key.split('.') as [string, 'color' | 'size'];
            return !Object.values(designSystems).some((ds) => {
                const declared = axis === 'color'
                    ? Object.keys(ds.tokens.roles).length > 0
                    : ds.tokens.sizes.length > 0;
                const wired = ds.components[scope];
                return declared && wired !== undefined && wired[axis].length === 0;
            });
        });
        expect(
            stale,
            'these axes are now wired by every design system that declares them — delete the entry '
                + '(and close its box on #321), or it silently absorbs the next regression',
        ).toEqual([]);
    });

    // The ledger has to bind from both ends, because the two ways it goes
    // stale are opposite. A carrier can arrive unrecorded (component #24 lands
    // and nobody asks the variant question), or a recorded reason can quietly
    // stop being true (a design system wires the axis and the entry beside it
    // still says nobody does). One assertion per direction, so a failure names
    // which happened.

    // The exemption is "some design system wires it", NOT "is button". Naming
    // button would make the two assertions contradict each other the moment
    // this decision is revisited: wire `select` through `tokens.scopes`, delete its
    // NO_VARIANT entry as the second assertion demands, and a button-shaped
    // exemption would fail the first for a missing entry — leaving no legal
    // state, and a guard whose only escape is to record something false.
    const wiresVariant = (scope: string): boolean =>
        Object.values(designSystems).some((ds) => (ds.components[scope]?.variant.length ?? 0) > 0);

    it('every carrier that wires no variant has a recorded reason', () => {
        const unrecorded = carriers.filter((scope) => !wiresVariant(scope) && !(scope in NO_VARIANT));
        expect(
            unrecorded,
            'these carriers accept `variant` and wire nothing, with no reason recorded — '
                + 'survey the carrier against the conformance vendor set (docs/architecture.md §7) and add it to NO_VARIANT, or wire it',
        ).toEqual([]);
    });

    it('every recorded reason still describes a carrier that wires nothing', () => {
        const stale = Object.keys(NO_VARIANT).filter((scope) => !carriers.includes(scope));
        expect(stale, 'NO_VARIANT names scopes that are not variant carriers').toEqual([]);

        const wiredAfterAll = Object.keys(NO_VARIANT).filter(wiresVariant);
        expect(
            wiredAfterAll,
            'these carriers now wire `variant`, so the reason recorded beside them is false — '
                + 'delete the entry (and give the scope its own vocabulary in tokens.scopes '
                + 'if the values are not the button\'s — docs/architecture.md, "Declared vocabulary")',
        ).toEqual([]);
    });

    it('button still wires a variant in every design system, so the ledger is not vacuous', () => {
        // Without this the two assertions above pass trivially on a repo where
        // NOTHING wires `variant` — a ledger recording a universal absence,
        // which is the failure mode #103 shipped and #168 had to come back for.
        for (const [name, ds] of Object.entries(designSystems)) {
            expect(ds.components['button']?.variant ?? [], `${name} wires no button variant`)
                .not.toEqual([]);
        }
    });
});
