/**
 * Generates `src/scheme.generated.ts` — zero-material's colour, straight from
 * Material 3's own colour system (#414).
 *
 * Material's colour is not a palette someone picked; it is an algorithm: a
 * seed colour becomes five tonal palettes (HCT), and each role is a tone of
 * one of them, chosen per scheme and per contrast level. Hand-copying the
 * output would freeze one theme and lose the contrast variants, so the
 * algorithm runs here, through Google's `@material/material-color-utilities`
 * (a devDependency only — the output is a checked-in literal, so the browser
 * bundle never carries the library).
 *
 *   node scripts/gen-scheme.mjs          write the file
 *   node scripts/gen-scheme.mjs --check  exit 1 when the file is stale
 *
 * `scheme.test.ts` regenerates in memory and compares, so a stale file is a
 * failing test rather than a silent drift.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    Blend,
    DynamicScheme,
    Hct,
    MaterialDynamicColors as C,
    TonalPalette,

    argbFromHex,
    hexFromArgb,
} from '@material/material-color-utilities';

/** M3's baseline seed — the purple every m3.material.io example is drawn in. */
export const SEED = '#6750A4';

/**
 * The library is pinned to 0.3.0: 0.4.0 publishes extensionless relative
 * imports that plain Node ESM refuses to resolve. 0.3.0 implements the 2021
 * colour spec — the one the published baseline tokens come from.
 */

/** M3's three contrast levels: standard, medium, high. */
export const CONTRASTS = { '': 0, '-medium-contrast': 0.5, '-high-contrast': 1 };

/**
 * Status hues M3 does not define (it has `error` only). Each is harmonised
 * toward the seed — M3's own rule for custom colours — and becomes the
 * primary palette of a scheme of its own, giving it the same
 * colour / on-colour / container / on-container quartet the key colours have,
 * at every contrast level.
 */
export const STATUS_SEEDS = { info: '#0061A4', success: '#386A20', warning: '#7D5700' };

/** zero role name → the dynamic colour it takes (`on-X` is zero's `X-content`). */
const ROLE_COLORS = {
    primary: C.primary,
    'primary-content': C.onPrimary,
    'primary-container': C.primaryContainer,
    'primary-container-content': C.onPrimaryContainer,
    secondary: C.secondary,
    'secondary-content': C.onSecondary,
    'secondary-container': C.secondaryContainer,
    'secondary-container-content': C.onSecondaryContainer,
    tertiary: C.tertiary,
    'tertiary-content': C.onTertiary,
    'tertiary-container': C.tertiaryContainer,
    'tertiary-container-content': C.onTertiaryContainer,
    error: C.error,
    'error-content': C.onError,
    'error-container': C.errorContainer,
    'error-container-content': C.onErrorContainer,

    surface: C.surface,
    'surface-content': C.onSurface,
    'surface-dim': C.surfaceDim,
    'surface-dim-content': C.onSurface,
    'surface-bright': C.surfaceBright,
    'surface-bright-content': C.onSurface,
    'surface-container-lowest': C.surfaceContainerLowest,
    'surface-container-lowest-content': C.onSurface,
    'surface-container-low': C.surfaceContainerLow,
    'surface-container-low-content': C.onSurface,
    'surface-container': C.surfaceContainer,
    'surface-container-content': C.onSurface,
    'surface-container-high': C.surfaceContainerHigh,
    'surface-container-high-content': C.onSurface,
    'surface-container-highest': C.surfaceContainerHighest,
    'surface-container-highest-content': C.onSurface,
    'surface-variant': C.surfaceVariant,
    'surface-variant-content': C.onSurfaceVariant,
    'inverse-surface': C.inverseSurface,
    'inverse-surface-content': C.inverseOnSurface,
    'inverse-primary': C.inversePrimary,
    outline: C.outline,
    'outline-variant': C.outlineVariant,
    scrim: C.scrim,
    shadow: C.shadow,

    // zero's base surfaces, which every shared recipe reads: the page is
    // M3's `surface`, its two recessed steps the low containers, and the ink
    // `on-surface`.
    'base-100': C.surface,
    'base-200': C.surfaceContainerLow,
    'base-300': C.surfaceContainerHigh,
    'base-content': C.onSurface,

    // M3 has no neutral role; zero's `neutral` is the inverse pairing — a
    // strong, hue-less fill with its own readable ink (a snackbar's colours).
    neutral: C.inverseSurface,
    'neutral-content': C.inverseOnSurface,
    // …and its tonal fill, so every colour-axis role has a container:
    // surface-variant under its own ink.
    'neutral-container': C.surfaceVariant,
    'neutral-container-content': C.onSurfaceVariant,
};

const hex = (argb) => hexFromArgb(argb).toUpperCase();

/**
 * The five tonal palettes, by the core-palette rule M3's published baseline
 * is drawn with: primary keeps the seed's hue at chroma max(48, seed's),
 * secondary drops to 16, tertiary turns the hue 60° at 24, and the two
 * neutrals carry a trace of the hue at 4 and 8. (`SchemeTonalSpot` caps
 * primary at 36 instead, which is Android's wallpaper scheme — it would
 * render the baseline purple as `#65558F`, not `#6750A4`.)
 */
function scheme(seedArgb, isDark, contrastLevel) {
    const { hue, chroma } = Hct.fromInt(seedArgb);
    return new DynamicScheme({
        sourceColorArgb: seedArgb,
        // `Variant.TONAL_SPOT` — the enum is not exported from 0.3.0's index.
        variant: 2,
        contrastLevel,
        isDark,
        primaryPalette: TonalPalette.fromHueAndChroma(hue, Math.max(48, chroma)),
        secondaryPalette: TonalPalette.fromHueAndChroma(hue, 16),
        tertiaryPalette: TonalPalette.fromHueAndChroma((hue + 60) % 360, 24),
        neutralPalette: TonalPalette.fromHueAndChroma(hue, 4),
        neutralVariantPalette: TonalPalette.fromHueAndChroma(hue, 8),
    });
}

/** One theme's colours: every role above plus the three status quartets. */
export function themeColors(isDark, contrast) {
    const seed = argbFromHex(SEED);
    const s = scheme(seed, isDark, contrast);
    const colors = {};
    for (const [name, color] of Object.entries(ROLE_COLORS)) colors[name] = hex(color.getArgb(s));
    for (const [role, statusHex] of Object.entries(STATUS_SEEDS)) {
        const status = scheme(Blend.harmonize(argbFromHex(statusHex), seed), isDark, contrast);
        colors[role] = hex(C.primary.getArgb(status));
        colors[`${role}-content`] = hex(C.onPrimary.getArgb(status));
        colors[`${role}-container`] = hex(C.primaryContainer.getArgb(status));
        colors[`${role}-container-content`] = hex(C.onPrimaryContainer.getArgb(status));
    }
    return colors;
}

/** Every theme: `material`, `material-dark`, and each at medium and high contrast. */
export function generateSchemes() {
    const out = {};
    for (const [suffix, level] of Object.entries(CONTRASTS)) {
        out[`material${suffix}`] = themeColors(false, level);
        out[`material-dark${suffix}`] = themeColors(true, level);
    }
    return out;
}

export function renderScheme(schemes = generateSchemes()) {
    const body = Object.entries(schemes)
        .map(([theme, colors]) => {
            const rows = Object.entries(colors).map(([k, v]) => `        '${k}': '${v}',`).join('\n');
            return `    '${theme}': {\n${rows}\n    },`;
        })
        .join('\n');
    return `/**
 * GENERATED by scripts/gen-scheme.mjs — do not edit by hand.
 * Regenerate: pnpm --filter @sigx/zero-material gen:scheme
 *
 * Material 3 colour schemes from seed ${SEED} (core palettes, tonal-spot
 * roles, 2021 colour spec), light and dark at standard, medium and high
 * contrast. Status roles (${Object.keys(STATUS_SEEDS).join(', ')}) are custom colours harmonised
 * toward the seed.
 */
export const schemes = {
${body}
} as const;

export type SchemeName = keyof typeof schemes;
`;
}

// CLI only: imported by the staleness test, where `import.meta.url` is not a
// file URL, this module must not resolve paths at load.
if (import.meta.url.startsWith('file:') && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const target = fileURLToPath(new URL('../src/scheme.generated.ts', import.meta.url));
    const next = renderScheme();
    if (process.argv.includes('--check')) {
        const lf = (s) => s.replace(/\r\n/g, '\n');
        const current = (() => {
            try { return readFileSync(target, 'utf8'); } catch { return ''; }
        })();
        if (lf(current) !== lf(next)) {
            console.error('scheme.generated.ts is stale — run: pnpm --filter @sigx/zero-material gen:scheme');
            process.exit(1);
        }
    } else {
        writeFileSync(target, next);
        console.log(`wrote ${target}`);
    }
}
