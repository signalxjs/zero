import { defineLibConfig } from '@sigx/vite/lib';

// Two entries, as in @sigx/zero-ext-example: `fragment` is pure data (the
// anatomies as a manifest fragment), so the design system's Node build script
// can import it without loading any component or the sigx runtime.
export default defineLibConfig({
    entry: {
        'index': 'src/index.ts',
        'fragment': 'src/fragment.ts',
    },
    external: ['sigx', 'sigx/jsx-runtime', 'sigx/jsx-dev-runtime', '@sigx/zero', '@sigx/zero/anatomy', '@sigx/zero/contract'],
    jsx: true,
});
