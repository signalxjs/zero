/**
 * The faces the design systems name, bundled so the playground renders what
 * a skin's users see — and so the e2e suite measures it (#45).
 *
 * Without these, `"IBM Plex Sans"` resolves to whatever the machine falls
 * back to: Segoe UI on Windows, the wider DejaVu Sans on the Ubuntu CI
 * runner. The narrow-viewport sweep then passed locally and failed in CI on
 * the same code, because carbon's tabs and join rows were measured in a
 * different font. Bundling makes local and CI read the same glyphs.
 *
 * Only the named faces are here: basic, daisyUI and brutalist ask for the
 * platform's own UI or monospace stack, which is exactly what their users
 * get. Weights are the ones the skins' `weights` tokens declare (400–700),
 * upright only — no recipe sets italic. `@font-face` is lazy: a face
 * downloads only when a rendered element asks for its family, so importing
 * every skin's faces globally costs nothing for the skin that is live.
 *
 * Playground devDependencies (all OFL-1.1). A design-system package never
 * ships or depends on a font: its tokens name the family, and loading it is
 * the consuming app's call — as it is here.
 */

// carbon: IBM Plex Sans + Mono.
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/ibm-plex-mono/700.css';

// material: Roboto + Roboto Mono.
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/roboto-mono/400.css';
import '@fontsource/roboto-mono/500.css';
import '@fontsource/roboto-mono/700.css';

// heroui: Inter (its mono is the platform stack).
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
