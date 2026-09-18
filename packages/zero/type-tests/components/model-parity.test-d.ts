/**
 * The naming rule at the type level (#451): for every model a component
 * carries, `default<N>` is typed as the model's value and `<n>Change` carries
 * it. The runtime parity test holds the NAMES to the anatomy; this holds the
 * TYPES, which a textual scrape cannot see (NumberInput seeded `number`
 * against a `number | null` model until this file existed).
 *
 * `Define.Model` leaves a `__modelBindings` marker on the props — the same
 * one sigx's JSX runtime reads to accept binding tuples — which is how the
 * model's value type is recovered here without naming it twice.
 */
import type {
    AccordionRootProps, AlertRootProps, CarouselRootProps, CheckboxRootProps, CollapsibleRootProps,
    ComboboxRootProps, DialogRootProps, DiffRootProps, DrawerRootProps, FileUploadRootProps, InputRootProps,
    MenuCheckboxItemProps, MenuRadioGroupProps, MenuRootProps, MenuSubProps, NumberInputRootProps,
    PaginationRootProps, PopoverRootProps, RadioGroupRootProps, RatingGroupRootProps, SelectRootProps,
    SkeletonRootProps, SliderRootProps, StepsRootProps, SwapRootProps, SwitchRootProps, TabsRootProps,
    TextareaRootProps, ToggleGroupRootProps, ToggleRootProps, TooltipRootProps, TreeViewRootProps,
} from '@sigx/zero';
import type { Equal, MustBeTrue } from '../assert.js';

/** The value type of the model bound under `key` (`model` for the unnamed one). */
type ModelOf<P, K extends string> = P extends { __modelBindings?: infer B } ? B extends Record<K, infer T> ? T : never : never;
/** The seed prop's type, the optionality removed. */
type SeedOf<P, K extends keyof P> = Exclude<P[K], undefined>;
/** The change event's payload. */
type PayloadOf<P, K extends keyof P> = Exclude<P[K], undefined> extends { __eventDetail: infer T } ? T : never;

/** Both companions of one model agree with it — `true` exactly when the seed's type and the change payload are the model's value type. */
type Companions<P, M extends string, D extends keyof P, C extends keyof P> =
    [Equal<SeedOf<P, D>, ModelOf<P, M>>, Equal<PayloadOf<P, C>, ModelOf<P, M>>] extends [true, true] ? true : false;

export type Pins = [
    MustBeTrue<Companions<AccordionRootProps, 'model', 'defaultValue', 'valueChange'>>,
    MustBeTrue<Companions<AlertRootProps, 'model', 'defaultOpen', 'openChange'>>,
    MustBeTrue<Companions<CarouselRootProps, 'model', 'defaultIndex', 'indexChange'>>,
    MustBeTrue<Companions<CollapsibleRootProps, 'model', 'defaultOpen', 'openChange'>>,
    MustBeTrue<Companions<ComboboxRootProps, 'open', 'defaultOpen', 'openChange'>>,
    MustBeTrue<Companions<ComboboxRootProps, 'inputValue', 'defaultInputValue', 'inputValueChange'>>,
    MustBeTrue<Companions<DialogRootProps, 'model', 'defaultOpen', 'openChange'>>,
    MustBeTrue<Companions<DiffRootProps, 'model', 'defaultValue', 'valueChange'>>,
    MustBeTrue<Companions<DrawerRootProps, 'model', 'defaultOpen', 'openChange'>>,
    MustBeTrue<Companions<FileUploadRootProps, 'model', 'defaultFiles', 'filesChange'>>,
    MustBeTrue<Companions<InputRootProps, 'model', 'defaultValue', 'valueChange'>>,
    MustBeTrue<Companions<MenuRootProps, 'model', 'defaultOpen', 'openChange'>>,
    MustBeTrue<Companions<MenuSubProps, 'model', 'defaultOpen', 'openChange'>>,
    MustBeTrue<Companions<MenuCheckboxItemProps, 'model', 'defaultChecked', 'checkedChange'>>,
    MustBeTrue<Companions<MenuRadioGroupProps, 'model', 'defaultValue', 'valueChange'>>,
    MustBeTrue<Companions<NumberInputRootProps, 'model', 'defaultValue', 'valueChange'>>,
    MustBeTrue<Companions<PaginationRootProps, 'model', 'defaultPage', 'pageChange'>>,
    MustBeTrue<Companions<PopoverRootProps, 'model', 'defaultOpen', 'openChange'>>,
    MustBeTrue<Companions<RadioGroupRootProps, 'model', 'defaultValue', 'valueChange'>>,
    MustBeTrue<Companions<RatingGroupRootProps, 'model', 'defaultValue', 'valueChange'>>,
    MustBeTrue<Companions<SelectRootProps, 'open', 'defaultOpen', 'openChange'>>,
    MustBeTrue<Companions<SkeletonRootProps, 'model', 'defaultLoading', 'loadingChange'>>,
    MustBeTrue<Companions<SliderRootProps, 'model', 'defaultValue', 'valueChange'>>,
    MustBeTrue<Companions<StepsRootProps, 'model', 'defaultStep', 'stepChange'>>,
    MustBeTrue<Companions<SwapRootProps, 'model', 'defaultActive', 'activeChange'>>,
    MustBeTrue<Companions<SwitchRootProps, 'model', 'defaultChecked', 'checkedChange'>>,
    MustBeTrue<Companions<TabsRootProps, 'model', 'defaultValue', 'valueChange'>>,
    MustBeTrue<Companions<TextareaRootProps, 'model', 'defaultValue', 'valueChange'>>,
    MustBeTrue<Companions<ToggleGroupRootProps, 'model', 'defaultValue', 'valueChange'>>,
    MustBeTrue<Companions<ToggleRootProps, 'model', 'defaultPressed', 'pressedChange'>>,
    MustBeTrue<Companions<TooltipRootProps, 'model', 'defaultOpen', 'openChange'>>,
    MustBeTrue<Companions<TreeViewRootProps, 'model', 'defaultValue', 'valueChange'>>,
    MustBeTrue<Companions<TreeViewRootProps, 'expandedValues', 'defaultExpandedValues', 'expandedValuesChange'>>,
];

// Checkbox's model is `boolean | string[]` (sigx's array mode); its seed and
// event stay `boolean` — the array form is a binding shape, not a seed.
export type CheckboxPins = [
    MustBeTrue<Equal<ModelOf<CheckboxRootProps, 'model'>, boolean | string[]>>,
    MustBeTrue<Equal<SeedOf<CheckboxRootProps, 'defaultChecked'>, boolean>>,
];

// The unnamed model of a generic root is typed per overload (#446): the
// shared props carry `unknown`, and `generic-root.test-d.tsx` pins the
// overloads. What this file can hold is that the seed and the event agree
// with the shared model type there too.
export type GenericPins = [
    MustBeTrue<Companions<SelectRootProps, 'model', 'defaultValue', 'valueChange'>>,
    MustBeTrue<Companions<ComboboxRootProps, 'model', 'defaultValue', 'valueChange'>>,
];
