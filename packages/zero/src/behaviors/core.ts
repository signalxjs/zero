/**
 * `@sigx/zero/behaviors/core` — the platform-neutral behavior subset.
 *
 * Everything exported here is importable without `lib.dom`: no DOM types in
 * any signature, no DOM globals in any body (held honest by the `portable`
 * type-test project, which compiles this module graph under
 * `lib: ["es2022"]`). This is the entry a non-DOM runtime (`@sigx/lynx-zero`)
 * builds its component layer on; the full `@sigx/zero/behaviors` barrel keeps
 * the web-typed view of the same controllers plus the genuinely DOM-bound
 * behaviors (focus, press, dismiss listeners, anchored positioning).
 *
 * The list controller comes from `list-core.ts` with its element type OPEN
 * (`ItemElement`, a two-member structural slice of `HTMLElement`): a platform
 * that never mounts DOM elements registers `el: () => null` and gets the
 * registration-order fallback — depth-first render order, which IS visual
 * order there.
 */

export type { IdGenerator } from './create-id.js';
export { createId, idToken, useIdGenerator, zeroPlugin } from './create-id.js';

export type { ControllableState, ControllableOptions } from './controllable.js';
export { createControllableState, createInertState, namedModel } from './controllable.js';
export { derivedModel } from './derived-model.js';
export { mountScope } from './mount-scope.js';
export { timingModifiers } from './model-modifiers.js';

export type { HighlightStep, ItemElement, ListController, ListItem } from './list-core.js';
export { createListController, moveHighlight, sortByDomOrder } from './list-core.js';

export { useFieldContext, provideFieldContext, useFieldsetContext, provideFieldsetContext } from './field.js';
export type { FieldContext, FieldsetContext, FieldValidity, FieldValidityReport, ValidatableElement, ValidityKey } from './field.js';

export { createFormControl } from './form-control.js';
export type { FormControl, FormControlOptions, FormControlProps, FormControlFlags } from './form-control.js';
export { VISUALLY_HIDDEN_STYLE } from './visually-hidden.js';

export { createCollection, defaultItemKey, defaultItemLabel, segmentBy } from './collection.js';
export type { Collection, CollectionEntry, CollectionOptions, CollectionSegment } from './collection.js';
export { createListboxCore, defaultFilter, stepKeys } from './listbox-core.js';
export type { ListboxCore, ListboxOptions } from './listbox-core.js';

export { triggerTokenAt, replaceToken } from './trigger-token.js';
export type { TriggerToken } from './trigger-token.js';
