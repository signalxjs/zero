/**
 * The design systems the playground ships — ids and toolbar labels, nothing
 * else.
 *
 * Data only, with no imports, on purpose: `design-systems.ts` builds the live
 * registry from this list (and cannot compile without an entry for every id
 * here), while the e2e specs import it too — and they could never import
 * `design-systems.ts` itself, whose `?url` CSS/manifest imports only Vite
 * understands. One list, read by both, is what makes adding a skin to the
 * toolbar also add it to every per-design-system spec (#193).
 */
export const DESIGN_SYSTEM_LIST = [
    { id: 'basic', label: 'Basic' },
    { id: 'daisyui', label: 'daisyUI' },
    { id: 'material', label: 'Material' },
    { id: 'brutalist', label: 'Brutalist' },
    { id: 'heroui', label: 'HeroUI' },
    { id: 'carbon', label: 'Carbon' },
] as const;

export type DesignSystemId = (typeof DESIGN_SYSTEM_LIST)[number]['id'];
