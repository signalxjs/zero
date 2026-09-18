/**
 * The gate #316 exists for: every component's REAL prop surface, checked
 * under the REAL emitted zero-basic register golden in this program
 * (`basic.register.d.ts`, kept current by zero-kit's register-dts.test.ts).
 *
 * The other projects assert the vocabulary type aliases; none of them ever
 * imported a component, so the hand-written scope literal inside each
 * `WithVariantAxes<'…'>` — the joint that actually binds a component to its
 * vocabulary entry — was unverified. This file is that verification, for
 * all 32 scopes: the axes the golden wires must narrow to its exact unions,
 * the axes it leaves unwired must be `never`, and a scope with no axis
 * props must stay propless.
 *
 * When a design-system recipe changes what basic wires, the golden changes,
 * and the `Equal` assertions here are the reviewable diff of what apps will
 * feel. When #317 gives the 8 propless components axis props, their
 * `absent` assertions below flip to narrowing assertions — deliberately a
 * compile error here, not a silent widening.
 */
import { Accordion } from '@sigx/zero/accordion';
import { Alert } from '@sigx/zero/alert';
import { Avatar } from '@sigx/zero/avatar';
import { Badge } from '@sigx/zero/badge';
import { Breadcrumbs } from '@sigx/zero/breadcrumbs';
import { Button } from '@sigx/zero/button';
import { Card } from '@sigx/zero/card';
import { Carousel } from '@sigx/zero/carousel';
import { Chat } from '@sigx/zero/chat';
import { Checkbox } from '@sigx/zero/checkbox';
import { Collapsible } from '@sigx/zero/collapsible';
import { Combobox } from '@sigx/zero/combobox';
import { Countdown } from '@sigx/zero/countdown';
import { Dialog } from '@sigx/zero/dialog';
import { Diff } from '@sigx/zero/diff';
import { Divider } from '@sigx/zero/divider';
import { Drawer } from '@sigx/zero/drawer';
import { Field } from '@sigx/zero/field';
import { FileUpload } from '@sigx/zero/file-upload';
import { Indicator } from '@sigx/zero/indicator';
import { Input } from '@sigx/zero/input';
import { Join } from '@sigx/zero/join';
import { Kbd } from '@sigx/zero/kbd';
import { Menu } from '@sigx/zero/menu';
import { Navbar } from '@sigx/zero/navbar';
import { NumberInput } from '@sigx/zero/number-input';
import { Pagination } from '@sigx/zero/pagination';
import { Popover } from '@sigx/zero/popover';
import { Progress } from '@sigx/zero/progress';
import { RadialProgress } from '@sigx/zero/radial-progress';
import { RadioGroup } from '@sigx/zero/radio-group';
import { RatingGroup } from '@sigx/zero/rating-group';
import { Select } from '@sigx/zero/select';
import { Skeleton } from '@sigx/zero/skeleton';
import { Slider } from '@sigx/zero/slider';
import { Spinner } from '@sigx/zero/spinner';
import { Stats } from '@sigx/zero/stats';
import { Status } from '@sigx/zero/status';
import { Steps } from '@sigx/zero/steps';
import { Swap } from '@sigx/zero/swap';
import { Switch } from '@sigx/zero/switch';
import { Table } from '@sigx/zero/table';
import { Tabs } from '@sigx/zero/tabs';
import { Textarea } from '@sigx/zero/textarea';
import { Timeline } from '@sigx/zero/timeline';
import { Toast } from '@sigx/zero/toast';
import type { ToastOptions } from '@sigx/zero/toast';
import { Toggle } from '@sigx/zero/toggle';
import { ToggleGroup } from '@sigx/zero/toggle-group';
import { TreeView } from '@sigx/zero/tree-view';
import { Tooltip } from '@sigx/zero/tooltip';
import type { Equal, MustBeTrue } from '../assert.js';

/** What zero-basic's tokens declare — the unions the golden emits. */
type BasicColor =
    | 'primary' | 'secondary' | 'accent' | 'neutral'
    | 'info' | 'success' | 'warning' | 'error';
type BasicSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

type PropsOf<C extends (...args: never[]) => unknown> = Parameters<C>[0];
/**
 * The axis prop's value union, or the sentinel when the prop does not exist
 * at all. The sentinel keeps "prop absent" distinguishable from
 * "prop present but never" — both matter: the first is a propless scope,
 * the second is a carrier whose axis basic leaves unwired.
 */
type Axis<P, K extends string> =
    K extends keyof P ? Exclude<P[K & keyof P], undefined> : 'absent';

/**
 * An unwired axis is unusable in either of its two spellings: `never`
 * (the vocabulary's type) or absent altogether — sigx's JSX prop surface
 * strips `never`-valued props from the parameter type, so `variant: never`
 * in the golden surfaces as no `variant` key at all. Both mean "no value
 * compiles"; a real union means the axis leaked open.
 */
type Unusable<X> = [X] extends ['absent'] | [never] ? true : false;

/* ── carriers wiring color + size; the variant axis basic leaves unwired
 * must be unusable. The checks stay bare booleans; MustBeTrue is applied at
 * each concrete use site — inside a generic alias its constraint is checked
 * against the deferred conditional's branch union and fails eagerly. */
type CheckColorSize<P> = [
    Equal<Axis<P, 'color'>, BasicColor>,
    Equal<Axis<P, 'size'>, BasicSize>,
    Unusable<Axis<P, 'variant'>>,
][number] extends true ? true : false;

export type _tabs = MustBeTrue<CheckColorSize<PropsOf<typeof Tabs.Root>>>;
export type _switch = MustBeTrue<CheckColorSize<PropsOf<typeof Switch.Root>>>;
export type _checkbox = MustBeTrue<CheckColorSize<PropsOf<typeof Checkbox.Root>>>;
export type _radioGroup = MustBeTrue<CheckColorSize<PropsOf<typeof RadioGroup.Root>>>;
export type _progress = MustBeTrue<CheckColorSize<PropsOf<typeof Progress.Root>>>;
export type _slider = MustBeTrue<CheckColorSize<PropsOf<typeof Slider.Root>>>;
export type _avatar = MustBeTrue<CheckColorSize<PropsOf<typeof Avatar.Root>>>;
export type _combobox = MustBeTrue<CheckColorSize<PropsOf<typeof Combobox.Root>>>;
export type _toggle = MustBeTrue<CheckColorSize<PropsOf<typeof Toggle.Root>>>;
export type _toggleGroup = MustBeTrue<CheckColorSize<PropsOf<typeof ToggleGroup.Root>>>;
export type _numberInput = MustBeTrue<CheckColorSize<PropsOf<typeof NumberInput.Root>>>;
export type _ratingGroup = MustBeTrue<CheckColorSize<PropsOf<typeof RatingGroup.Root>>>;
export type _treeView = MustBeTrue<CheckColorSize<PropsOf<typeof TreeView.Root>>>;
export type _input = MustBeTrue<CheckColorSize<PropsOf<typeof Input.Root>>>;
export type _textarea = MustBeTrue<CheckColorSize<PropsOf<typeof Textarea.Root>>>;
export type _card = MustBeTrue<CheckColorSize<PropsOf<typeof Card.Root>>>;
export type _alert = MustBeTrue<CheckColorSize<PropsOf<typeof Alert.Root>>>;
export type _divider = MustBeTrue<CheckColorSize<PropsOf<typeof Divider.Root>>>;
export type _skeleton = MustBeTrue<CheckColorSize<PropsOf<typeof Skeleton.Root>>>;
export type _spinner = MustBeTrue<CheckColorSize<PropsOf<typeof Spinner.Root>>>;
export type _kbd = MustBeTrue<CheckColorSize<PropsOf<typeof Kbd.Root>>>;
export type _status = MustBeTrue<CheckColorSize<PropsOf<typeof Status.Root>>>;
export type _indicator = MustBeTrue<CheckColorSize<PropsOf<typeof Indicator.Root>>>;
export type _stats = MustBeTrue<CheckColorSize<PropsOf<typeof Stats.Root>>>;
export type _timeline = MustBeTrue<CheckColorSize<PropsOf<typeof Timeline.Root>>>;
export type _chat = MustBeTrue<CheckColorSize<PropsOf<typeof Chat.Root>>>;
export type _radialProgress = MustBeTrue<CheckColorSize<PropsOf<typeof RadialProgress.Root>>>;
export type _join = MustBeTrue<CheckColorSize<PropsOf<typeof Join.Root>>>;
export type _navbar = MustBeTrue<CheckColorSize<PropsOf<typeof Navbar.Root>>>;
export type _breadcrumbs = MustBeTrue<CheckColorSize<PropsOf<typeof Breadcrumbs.Root>>>;
export type _pagination = MustBeTrue<CheckColorSize<PropsOf<typeof Pagination.Root>>>;
export type _steps = MustBeTrue<CheckColorSize<PropsOf<typeof Steps.Root>>>;
export type _table = MustBeTrue<CheckColorSize<PropsOf<typeof Table.Root>>>;
export type _fileUpload = MustBeTrue<CheckColorSize<PropsOf<typeof FileUpload.Root>>>;
export type _carousel = MustBeTrue<CheckColorSize<PropsOf<typeof Carousel.Root>>>;
export type _swap = MustBeTrue<CheckColorSize<PropsOf<typeof Swap.Root>>>;
export type _countdown = MustBeTrue<CheckColorSize<PropsOf<typeof Countdown.Root>>>;
export type _diff = MustBeTrue<CheckColorSize<PropsOf<typeof Diff.Root>>>;

/* ── the three scopes basic wires a variant vocabulary for ── */
type ButtonProps = PropsOf<typeof Button.Root>;
export type _buttonColor = MustBeTrue<Equal<Axis<ButtonProps, 'color'>, BasicColor>>;
export type _buttonSize = MustBeTrue<Equal<Axis<ButtonProps, 'size'>, BasicSize>>;
export type _buttonVariant = MustBeTrue<Equal<
    Axis<ButtonProps, 'variant'>,
    'solid' | 'outline' | 'soft' | 'ghost'
>>;

type SelectProps = PropsOf<typeof Select.Root>;
export type _selectVariant = MustBeTrue<Equal<
    Axis<SelectProps, 'variant'>,
    'outline' | 'soft' | 'ghost'
>>;

type BadgeProps = PropsOf<typeof Badge.Root>;
export type _badgeVariant = MustBeTrue<Equal<
    Axis<BadgeProps, 'variant'>,
    'solid' | 'soft' | 'outline'
>>;

/* ── literal ergonomics on the reference component ── */
const buttonOk: ButtonProps = { color: 'primary', size: 'md', variant: 'ghost' };
// @ts-expect-error — a typo'd color is a compile error under the register
const buttonTypo: ButtonProps = { color: 'primryy' };
// @ts-expect-error — basic declares no custom axes; the bag is closed
const buttonAxes: ButtonProps = { axes: { density: 'compact' } };
// @ts-expect-error — basic wires no modifiers on button
const buttonMods: ButtonProps = { mods: { block: true } };
export const _use = [buttonOk, buttonTypo, buttonAxes, buttonMods];

/* ── toast: wired in the golden, reachable only through the toaster API ── */
export type _toastOptionColor = MustBeTrue<Equal<
    Exclude<ToastOptions['color'], undefined>,
    BasicColor
>>;

/* ── the 8 formerly-propless scopes: #317 gave every component the axis
 * surface, and #321 wires basic's recipes for it — so the Contract v1
 * carriers now narrow color and size exactly like every other carrier,
 * with `variant` still unusable (no vocabulary declared for them). ── */
export type _accordion = MustBeTrue<CheckColorSize<PropsOf<typeof Accordion.Root>>>;
export type _collapsible = MustBeTrue<CheckColorSize<PropsOf<typeof Collapsible.Root>>>;
export type _field = MustBeTrue<CheckColorSize<PropsOf<typeof Field.Root>>>;

/* Fragment-rooted scopes carry the axis props on the TRIGGER — it renders
 * the carrier part the compiled axis selectors anchor on. The Root stays
 * propless: it renders nothing an attribute could sit on. */
type CheckPropless<P> = [
    Equal<Axis<P, 'color'>, 'absent'>,
    Equal<Axis<P, 'size'>, 'absent'>,
    Equal<Axis<P, 'variant'>, 'absent'>,
][number] extends true ? true : false;

export type _dialogRoot = MustBeTrue<CheckPropless<PropsOf<typeof Dialog.Root>>>;
export type _drawerRoot = MustBeTrue<CheckPropless<PropsOf<typeof Drawer.Root>>>;
export type _menuRoot = MustBeTrue<CheckPropless<PropsOf<typeof Menu.Root>>>;
export type _popoverRoot = MustBeTrue<CheckPropless<PropsOf<typeof Popover.Root>>>;
export type _tooltipRoot = MustBeTrue<CheckPropless<PropsOf<typeof Tooltip.Root>>>;

export type _dialogTrigger = MustBeTrue<CheckColorSize<PropsOf<typeof Dialog.Trigger>>>;
export type _drawerTrigger = MustBeTrue<CheckColorSize<PropsOf<typeof Drawer.Trigger>>>;
export type _menuTrigger = MustBeTrue<CheckColorSize<PropsOf<typeof Menu.Trigger>>>;
export type _popoverTrigger = MustBeTrue<CheckColorSize<PropsOf<typeof Popover.Trigger>>>;
export type _tooltipTrigger = MustBeTrue<CheckColorSize<PropsOf<typeof Tooltip.Trigger>>>;

/* Toast.Root: colour was the axis four skins already wired (#317); #321
 * added the size ramp, so both narrow and only `variant` stays unusable. */
export type _toastRoot = MustBeTrue<CheckColorSize<PropsOf<typeof Toast.Root>>>;
