/**
 * The data face of the kit: the manifest fragment the design system merges
 * (`runStandardBuild({ fragments: [fragment] })`). Pure data, so the design
 * system's Node build can import it without loading the sigx runtime.
 *
 * There is no recipe pack here on purpose. These components exist for one
 * design system, and its own recipes key the axes and modifiers it declares
 * (`tone`, `weight`, `unread`, …), which a grammar-generic pack could not.
 */
import { FRAGMENT_VERSION } from '@sigx/zero/contract';
import { mailAnatomies } from './anatomy.js';

export const fragment = {
    version: FRAGMENT_VERSION,
    package: '@sigx/zero-mail-kit',
    components: mailAnatomies.map((a) => a.toJSON()),
};
