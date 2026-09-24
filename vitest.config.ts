import { defineConfig } from 'vitest/config';
import { sourceAliases } from './scripts/lib/source-aliases.mjs';

export default defineConfig({
    // Vite 8 uses Oxc for JSX transforms
    oxc: {
        jsx: {
            runtime: 'automatic',
            importSource: 'sigx'
        }
    },
    resolve: {
        // Every @sigx/* specifier to its package source — built by
        // scripts/lib/source-aliases.mjs from zero's exports map, with
        // fileURLToPath'd paths (#195).
        alias: sourceAliases(new URL('./', import.meta.url))
    },
    test: {
        environment: 'happy-dom',
        include: [
            'packages/**/__tests__/**/*.test.{ts,tsx}',
            'packages/**/src/**/*.test.{ts,tsx}',
            // The release tooling's pure halves (bump-version's semver step
            // and changelog cut, #148).
            'scripts/__tests__/**/*.test.{ts,mjs}'
        ],
        globals: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['packages/*/src/**/*.{ts,tsx}'],
            exclude: ['**/*.d.ts', '**/index.ts']
        }
    }
});
