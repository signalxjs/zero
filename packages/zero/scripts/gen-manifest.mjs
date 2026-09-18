// Generates dist/manifest.json from the built anatomy registry.
//
// The manifest is the machine-readable face of @sigx/zero: every component's
// parts, states (as ready-made selector fragments), flags and token hints,
// plus the contract vocabulary — everything an AI or build tool needs to
// generate a complete design system without reading component code.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const distAnatomy = new URL('../dist/anatomy.js', import.meta.url).href;
const distContract = new URL('../dist/contract/index.js', import.meta.url).href;

const { anatomies } = await import(distAnatomy);
const {
    RECOMMENDED_ROLE_LIST, BASE_SURFACE_TOKEN_LIST,
    TOKEN_CATEGORIES, SIZE_SCALE_LIST, FLAG_VOCABULARY, VARIANT_AXES,
    STATE_VOCABULARY, STATE_SYNONYMS, PLACEMENT_VOCABULARY,
    LAYOUT_ATTR_PREFIX, LAYOUT_VOCABULARY,
} = await import(distContract);

const manifest = {
    $schema: 'https://signalxjs.github.io/zero/schemas/manifest.schema.json',
    zeroVersion: pkg.version,
    attributeSpec: {
        scope: 'data-scope',
        part: 'data-part',
        state: 'data-state',
        flagForm: 'presence (data-<flag>=""), never "false"',
        flagVocabulary: [...FLAG_VOCABULARY],
        // The governed data-state vocabulary (grouped by family, checked
        // against the union) and the synonym table governance failures cite.
        stateVocabulary: Object.fromEntries(
            Object.entries(STATE_VOCABULARY).map(([family, states]) => [family, [...states]]),
        ),
        stateSynonyms: { ...STATE_SYNONYMS },
        // The closed data-placement vocabulary; each part declares its subset
        // as `placements`.
        placementVocabulary: [...PLACEMENT_VOCABULARY],
        // The layout family: a namespaced, closed vocabulary of attribute →
        // permitted values. Namespaced precisely so none of these very
        // ordinary words (gap, align, track…) has to be reserved against the
        // open `axes` set below. Each part declares its subset as `layout`.
        layoutPrefix: LAYOUT_ATTR_PREFIX,
        layoutVocabulary: Object.fromEntries(
            Object.entries(LAYOUT_VOCABULARY).map(([attr, spec]) => [
                attr,
                { values: [...spec.values], ...(spec.responsive ? { responsive: true } : {}) },
            ]),
        ),
        // The axes with named props. NOT a closed set — a design system may
        // declare others (density, emphasis, tone) and reach them through the
        // `axes` prop, which spells them by the same rule.
        variantAxes: VARIANT_AXES,
        extraAxisForm:
            'data-<axis>, set via the `axes` prop; <axis> is kebab-case and may not '
            + 'collide with the attributes above or with flagVocabulary',
    },
    tokens: {
        // Both halves of the token contract are grammars, not vocabularies:
        // design systems declare their own color roles and their own keys
        // within each category. Only the base surfaces are fixed.
        colors: {
            convention: { prefix: '--color-', contentSuffix: '-content', softSuffix: '-soft' },
            required: BASE_SURFACE_TOKEN_LIST.map((t) => `--color-${t}`),
            recommendedRoles: [...RECOMMENDED_ROLE_LIST],
        },
        // `recommended` are the keys @sigx/zero ships fallbacks for; a design
        // system may declare any others, and they appear in ITS manifest.
        categories: TOKEN_CATEGORIES.map((c) => ({ ...c, path: [...c.path], recommended: [...c.recommended] })),
        // The DEFAULT size ramp, not a closed set — a design system declares
        // its own via `tokens.sizes` and it appears in ITS manifest.
        recommendedSizes: [...SIZE_SCALE_LIST],
    },
    components: Object.values(anatomies).map((a) => a.toJSON()),
};

const out = fileURLToPath(new URL('../dist/manifest.json', import.meta.url));
await writeFile(out, JSON.stringify(manifest, null, 2) + '\n');
console.log(`[zero] wrote manifest.json (${manifest.components.length} components)`);
