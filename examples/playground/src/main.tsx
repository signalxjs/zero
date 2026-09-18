import { render } from 'sigx';
import '@sigx/zero/css';

// A kit-compiled theme declaring a novel `brand` role — the
// extensible-vocabulary demo. Imported before the DS so the DS's later
// :root block overrides the shared base tokens; the brand-only tokens
// (--color-brand*, --brand-glow) stay defined globally and the demo scopes
// itself with [data-theme="brand"]. `activateDesignSystem` appends the DS
// stylesheet to <head>, so it stays last in document order across every swap
// and that ordering keeps holding.
import './brand-theme.css';

// The app's own unlayered CSS — the page surface. A design system paints its
// components; the page behind them is the app's to paint, and this is the one
// rule that does it (`base-100` / `base-content` on <body>).
import './app.css';

// The design system is no longer an import pair you edit — it is a compiled
// stylesheet exchanged at runtime, which is the honest form of the claim that
// a design system is data. zero-material is the strongest case: thirteen
// colour roles instead of eight, a level1–level5 elevation ramp, its own
// easings and a dialog that goes full-screen below its own breakpoint — and
// still nothing here changes, because nothing here knows which DS is loaded.
import { activateDesignSystem, resolvePersistedDesignSystem } from './design-systems';
import { App } from './App';

// Awaited before the first render, so the app never paints unstyled and the
// theme registry is seeded — and any stale persisted theme reconciled —
// before the toolbar reads it.
await activateDesignSystem(resolvePersistedDesignSystem());

render(<App />, document.getElementById('app')!);
