import { defineConfig } from 'vitest/config';

export default defineConfig({
    // Vite 8 uses Oxc for JSX transforms
    oxc: {
        jsx: {
            runtime: 'automatic',
            importSource: 'sigx'
        }
    },
    resolve: {
        alias: {
            // More specific subpaths first — these are prefix matches, so a
            // bare '@sigx/zero' entry above would swallow them.
            '@sigx/zero/anatomy': new URL('./packages/zero/src/anatomy.ts', import.meta.url).pathname,
            '@sigx/zero/contract': new URL('./packages/zero/src/contract/index.ts', import.meta.url).pathname,
            '@sigx/zero/adapt': new URL('./packages/zero/src/adapt/index.ts', import.meta.url).pathname,
            '@sigx/zero/testing': new URL('./packages/zero/src/testing/index.ts', import.meta.url).pathname,
            '@sigx/zero': new URL('./packages/zero/src/index.ts', import.meta.url).pathname,
            '@sigx/zero-kit/build': new URL('./packages/zero-kit/src/build.ts', import.meta.url).pathname,
            '@sigx/zero-kit/define': new URL('./packages/zero-kit/src/define.ts', import.meta.url).pathname,
            '@sigx/zero-kit': new URL('./packages/zero-kit/src/index.ts', import.meta.url).pathname,
            '@sigx/zero-basic': new URL('./packages/zero-basic/src/index.ts', import.meta.url).pathname,
            '@sigx/zero-daisyui': new URL('./packages/zero-daisyui/src/index.ts', import.meta.url).pathname,
            '@sigx/zero-material': new URL('./packages/zero-material/src/index.ts', import.meta.url).pathname,
            '@sigx/zero-brutalist': new URL('./packages/zero-brutalist/src/index.ts', import.meta.url).pathname,
            '@sigx/zero-heroui': new URL('./packages/zero-heroui/src/index.ts', import.meta.url).pathname,
            '@sigx/zero-carbon': new URL('./packages/zero-carbon/src/index.ts', import.meta.url).pathname,
            '@sigx/zero-ext-example/fragment': new URL('./packages/zero-ext-example/src/fragment.ts', import.meta.url).pathname,
            '@sigx/zero-ext-example': new URL('./packages/zero-ext-example/src/index.ts', import.meta.url).pathname
        }
    },
    test: {
        environment: 'happy-dom',
        include: [
            'packages/**/__tests__/**/*.test.{ts,tsx}',
            'packages/**/src/**/*.test.{ts,tsx}'
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
