/**
 * The ecosystem compile gate (the building-on-top-of-zero track):
 * `basic-ext.register.d.ts` in this directory is the REAL golden emitted by
 * `compileRegisterDts` for zero-basic WITH the adopted `@sigx/zero-ext-example`
 * recipe pack, compiled against the fragment-merged manifest (kept current by
 * `register-dts.test.ts`). Compiling it here — in its own isolated project,
 * because a register augmentation is global — is the end-to-end proof #302
 * deferred: a register module carrying an ecosystem scope typechecks, with
 * the scope excluded BY NAME from the ZeroScope gate while the gate keeps
 * full strength for zero-origin scopes.
 */
import type { ColorValueFor, RecommendedRole, SizeScaleFor, ZeroScope, ZeroVocabulary } from '@sigx/zero';
import type { Equal, MustBeTrue } from '../assert.js';

// The ecosystem scope is IN the augmented vocabulary — its entry narrows
// exactly like a zero scope's: the pack wires a `color` axis over the whole
// recommended role list and nothing else.
type _extColor = MustBeTrue<Equal<ColorValueFor<'ext-stepper'>, RecommendedRole>>;
type _extSize = MustBeTrue<Equal<SizeScaleFor<'ext-stepper'>, never>>;

// …but it is NOT a ZeroScope: zero's own registry stays closed, which is the
// whole design — tooling accepts a superset with provenance, the identity
// union does not reopen.
type _notZeroScope = MustBeTrue<Equal<Extract<ZeroScope, 'ext-stepper'>, never>>;

// The gate the golden carries, restated in a `.ts` that `skipLibCheck`
// cannot skip: every augmented scope EXCEPT the named ecosystem ones is a
// registry scope.
type _gate = MustBeTrue<
    Exclude<keyof ZeroVocabulary['components'], 'ext-stepper'> extends ZeroScope ? true : false
>;

// And without the exclusion it must NOT hold — if this ever compiles without
// the @ts-expect-error, the ecosystem scope leaked into zero's registry.
// @ts-expect-error — 'ext-stepper' is augmented but is not a ZeroScope
type _leak = MustBeTrue<keyof ZeroVocabulary['components'] extends ZeroScope ? true : false>;

export {};
