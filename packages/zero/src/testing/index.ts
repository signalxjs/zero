// Conformance helpers for component authors — the assertions zero's own
// components are held to, published so an ecosystem component can be held to
// the same contract.

export type { ExpectAnatomyOptions } from './expect-anatomy.js';
export { expectAnatomy } from './expect-anatomy.js';
// The platform-neutral rules + the element shape a non-DOM test renderer
// wraps its nodes into (a Lynx TestNode adapter holds components to the
// exact same contract).
export type { ElementLike } from './expect-anatomy-core.js';
export { expectAnatomyElements } from './expect-anatomy-core.js';
