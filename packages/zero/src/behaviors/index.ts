// Headless behavior layer — plain setup-time factories over signals.

export type { IdGenerator } from './create-id.js';
export { createId, useIdGenerator, zeroPlugin } from './create-id.js';

export type { ControllableState, ControllableOptions } from './controllable.js';
export { createControllableState, createInertState, namedModel } from './controllable.js';
export { derivedModel } from './derived-model.js';
export { timingModifiers } from './model-modifiers.js';

export type { ListItem, ListController, HighlightStep } from './list.js';
export { createListController, moveHighlight, optionText } from './list.js';

export type { RovingOptions } from './roving.js';
export { createRovingKeydown } from './roving.js';

export { isFocusVisible } from './focus-visible.js';

export { createPressFeedback } from './press.js';
export type { PressFeedbackOptions, PressFeedbackHandlers } from './press.js';

export { createDismissable } from './dismiss.js';
export type { DismissableOptions } from './dismiss.js';
export { createSpinPress } from './spin.js';
export type { SpinPressOptions, SpinPressHandlers } from './spin.js';
export { createTreeController } from './tree.js';
export type { TreeItem, TreeController } from './tree.js';

export { createFocusRestore, focusFirst, getTabbables } from './focus.js';

export { createTypeahead } from './typeahead.js';
export type { TypeaheadOptions } from './typeahead.js';

export { createAnchorPosition, fixedPositionStrategy, pointAnchor } from './position.js';
export type {
    Placement, PositionOptions, PositionStrategy, AnchorPositionInput,
    AnchorPositionHandle, PositionAnchor, VirtualAnchor,
} from './position.js';

export { useFieldContext, provideFieldContext } from './field.js';
export type { FieldContext } from './field.js';

export { createFormControl } from './form-control.js';
export type { FormControl, FormControlOptions, FormControlProps, FormControlFlags } from './form-control.js';
export { onFormReset } from './form-reset.js';
export type { FormOwned } from './form-reset.js';
export { VISUALLY_HIDDEN_STYLE } from './visually-hidden.js';

export { createCollection, defaultItemKey, defaultItemLabel, segmentBy } from './collection.js';
export type { Collection, CollectionEntry, CollectionOptions, CollectionSegment } from './collection.js';
export { createListbox, createListboxCore, createListboxItem, createGroupPresence, announceGroupLabel, defaultFilter, stepKeys } from './listbox.js';
export type { Listbox, ListboxCore, ListboxOptions, WebListboxOptions, ListboxItem, ListboxItemOptions, GroupPresence } from './listbox.js';
export { syncPopover } from './popover-sync.js';
