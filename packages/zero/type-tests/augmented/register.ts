/**
 * A hand-written stand-in for a generated `dist/register.d.ts`
 * (docs/architecture.md, "The register artifact") — the shape the build
 * emits. Kept small but covering
 * every case class: fully wired (button, plus presence-only modifiers),
 * partially wired (toggle: no variant), wired custom axes (tabs), and nothing
 * wired (checkbox).
 *
 * A `.ts` module, not a `.d.ts`: this project keeps `skipLibCheck` on for
 * dependency declarations, and that flag skips declaration files — the one
 * file this project exists to check semantically must not be one.
 */
declare module '@sigx/zero' {
    interface ZeroVocabulary {
        theme: 'light' | 'dark' | 'dim';
        breakpoint: 'sm' | 'md' | 'lg';
        components: {
            /** button — colour, size and variant all wired. */
            button: {
                color: 'primary' | 'secondary' | 'accent';
                size: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
                variant: 'solid' | 'outline' | 'soft' | 'ghost';
                axes: Record<string, never>;
                mods: { 'block': boolean; 'icon-only': boolean };
            };
            /** toggle — colour and size wired, variant not. */
            toggle: {
                color: 'primary' | 'secondary';
                size: 'sm' | 'md';
                variant: never;
                axes: Record<string, never>;
                mods: Record<string, never>;
            };
            /** tabs — a custom density axis. */
            tabs: {
                color: 'primary';
                size: never;
                variant: never;
                axes: { density: 'compact' | 'comfortable' };
                mods: Record<string, never>;
            };
            /** checkbox — accepts the props at runtime, nothing wired. */
            checkbox: {
                color: never; size: never; variant: never;
                axes: Record<string, never>; mods: Record<string, never>;
            };
        };
    }
}
export {};
