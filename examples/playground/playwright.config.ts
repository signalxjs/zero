import { defineConfig, devices } from '@playwright/test';

/**
 * Real-browser interaction suite for the press-feedback contract.
 *
 * The unit tests (happy-dom) prove the handler logic; this suite proves the
 * parts a simulated DOM cannot: real pointer/keyboard/touch input, pointer
 * capture during slider drags, `prefers-reduced-motion` and `forced-colors`
 * as actual media queries, and the non-Blink engines.
 *
 * Needs `pnpm build` at the repo root first — the playground resolves each
 * design system's compiled CSS from its `dist/`.
 */

/**
 * The dev server's port — override with `ZERO_E2E_PORT` to run two checkouts
 * at once.
 *
 * It used to be hardcoded, and that has quietly cost real time: with
 * `reuseExistingServer` on (everywhere but CI), a second worktree running the
 * suite BORROWS the first worktree's dev server and tests the wrong code, all
 * green. Giving each checkout its own port is what makes local parallel e2e
 * safe.
 *
 * `--strictPort` is the other half. Without it vite silently walks to the next
 * free port when 5199 is taken, while Playwright keeps waiting on 5199 — the
 * failure mode where the suite appears to hang for half an hour rather than
 * saying what is wrong.
 */
const rawPort = process.env.ZERO_E2E_PORT;
const port = rawPort === undefined ? 5199 : Number(rawPort);
// A bad value must not become `localhost:NaN`. `Number('')` is 0 and
// `Number('abc')` is NaN, and either one turns a typo in the env into a
// baseURL that fails somewhere far from its cause.
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`ZERO_E2E_PORT must be an integer from 1 to 65535, got ${JSON.stringify(rawPort)}`);
}
const baseURL = `http://localhost:${port}`;

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? 'github' : 'list',
    // Generous by design: assertions poll an instrumentation log, and the
    // slowest engine under full parallel load decides the budget.
    expect: { timeout: 10_000 },
    use: { baseURL },
    webServer: {
        command: `pnpm dev --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
    },
    projects: [
        // hasTouch everywhere a touchscreen exists in the engine, so the
        // touch-tap test runs on real touch pointers, not emulated mice.
        { name: 'chromium', use: { ...devices['Desktop Chrome'], hasTouch: true } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'], hasTouch: true } },
        {
            name: 'reduced-motion',
            use: { ...devices['Desktop Chrome'], contextOptions: { reducedMotion: 'reduce' } },
        },
        {
            name: 'forced-colors',
            use: { ...devices['Desktop Chrome'], contextOptions: { forcedColors: 'active' } },
        },
    ],
});
