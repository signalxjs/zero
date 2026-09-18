import { defineLibConfig } from '@sigx/vite/lib';

// Two entries on purpose: `fragment` is pure data (the manifest fragment and
// the recipe pack), so a design system's Node build script can import it
// without loading the component or the sigx runtime.
export default defineLibConfig({
    entry: {
        'index': 'src/index.ts',
        'fragment': 'src/fragment.ts',
    },
    external: ['sigx', 'sigx/jsx-runtime', 'sigx/jsx-dev-runtime', '@sigx/zero', '@sigx/zero/anatomy', '@sigx/zero/contract'],
    jsx: true,
});
