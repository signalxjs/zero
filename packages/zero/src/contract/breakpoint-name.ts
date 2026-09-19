/**
 * What may name a breakpoint in an attribute — the one rule both halves of
 * the layout family need: a responsive key (`data-l-md-gap`) and a
 * breakpoint-VALUED attribute (`data-l-stack="md"`).
 *
 * A module of its own, and a small one, for `layout-attrs.ts`'s own reason:
 * `Table` renders `data-l-stack` and should not carry the whole layout
 * vocabulary into its bundle to check one value.
 */
import { TOKEN_KEY_PATTERN } from './tokens.js';

/**
 * The key `Responsive` (`layout-attrs.ts`) uses for the UNQUALIFIED value, and therefore a
 * name no breakpoint may take: `{ base: 'md' }` renders `data-l-gap="md"`,
 * not `data-l-base-gap="md"`. A design system that declared a breakpoint
 * called `base` could never reach it — `@sigx/zero-kit` refuses the
 * declaration for that reason, the way it already refuses one colliding with
 * a built-in condition.
 */
export const BASE_BREAKPOINT_KEY = 'base';

/**
 * Whether `name` could be a breakpoint: kebab-case (it becomes part of an
 * attribute name or value, and `data-*` is case-sensitive), and not `base`.
 * Whether the design system DECLARED it is a question only the design system
 * can answer; the type does that under `/register`.
 */
export const isBreakpointName = (name: string): boolean =>
    TOKEN_KEY_PATTERN.test(name) && name !== BASE_BREAKPOINT_KEY;
