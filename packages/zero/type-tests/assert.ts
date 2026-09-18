/**
 * Compile-time assertion helpers for the type tests. There is no runtime —
 * `pnpm test:types` compiles each project with tsgo and a failing assertion
 * is a compile error.
 */

/** Fails to compile unless `T` is exactly `true`. */
export type MustBeTrue<T extends true> = T;

/** Structural equality, mutual-assignability form. */
export type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
