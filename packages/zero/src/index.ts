// @sigx/zero — unstyled, accessible component foundation for SignalX.
//
// Components render a stable data-scope/data-part/data-state anatomy and no
// styling; design systems are pure tokens + CSS compiled by @sigx/zero-kit.

export * from './contract/index.js';
export * from './behaviors/index.js';
export * from './theme/index.js';

export { anatomies } from './anatomy.js';
export type { ZeroAnatomies, ZeroScope } from './anatomy.js';

export { Button, buttonAnatomy } from './components/button/index.js';
export type { ButtonRootProps } from './components/button/index.js';

export { Tabs, tabsAnatomy, useTabsContext } from './components/tabs/index.js';
export type { TabsRootProps, TabsListProps, TabsTabProps, TabsPanelProps, TabsContext, TabsActivationMode } from './components/tabs/index.js';

export { Collapsible, collapsibleAnatomy, useCollapsibleContext } from './components/collapsible/index.js';
export type { CollapsibleRootProps, CollapsibleTriggerProps, CollapsiblePanelProps } from './components/collapsible/index.js';

export { Switch, switchAnatomy } from './components/switch/index.js';
export type { SwitchRootProps } from './components/switch/index.js';

export { Dialog, dialogAnatomy, useDialogContext } from './components/dialog/index.js';
export type {
    DialogRootProps,
    DialogTriggerProps,
    DialogPopupProps,
    DialogTitleProps,
    DialogDescriptionProps,
    DialogFooterProps,
    DialogCloseProps,
    DialogCancelProps,
} from './components/dialog/index.js';

export { Popover, popoverAnatomy, usePopoverContext } from './components/popover/index.js';
export type {
    PopoverRootProps,
    PopoverTriggerProps,
    PopoverPopupProps,
    PopoverTitleProps,
    PopoverCloseProps,
} from './components/popover/index.js';

export { Tooltip, tooltipAnatomy, useTooltipContext } from './components/tooltip/index.js';
export type { TooltipRootProps, TooltipTriggerProps, TooltipPopupProps } from './components/tooltip/index.js';

export { Menu, menuAnatomy, useMenuContext, useMenuRadioGroupContext } from './components/menu/index.js';
export type {
    MenuRootProps,
    MenuTriggerProps,
    MenuContextTriggerProps,
    MenuPopupProps,
    MenuItemProps,
    MenuCheckboxItemProps,
    MenuRadioGroupProps,
    MenuRadioItemProps,
    MenuSubProps,
    MenuSubTriggerProps,
    MenuSubPopupProps,
    MenuGroupProps,
    MenuGroupLabelProps,
    MenuSeparatorProps,
} from './components/menu/index.js';

export { Field, fieldAnatomy } from './components/field/index.js';
export type { FieldRootProps, FieldLabelProps, FieldDescriptionProps, FieldErrorProps } from './components/field/index.js';

export { Checkbox, checkboxAnatomy } from './components/checkbox/index.js';
export type { CheckboxRootProps } from './components/checkbox/index.js';

export { RadioGroup, radioGroupAnatomy, useRadioGroupContext } from './components/radio-group/index.js';
export type { RadioGroupRootProps, RadioGroupItemProps, RadioGroupLabelProps } from './components/radio-group/index.js';

export { Progress, progressAnatomy, useProgressContext } from './components/progress/index.js';
export type {
    ProgressRootProps,
    ProgressLabelProps,
    ProgressTrackProps,
    ProgressRangeProps,
    ProgressValueTextProps,
} from './components/progress/index.js';

export { Slider, sliderAnatomy, useSliderContext } from './components/slider/index.js';
export type {
    SliderRootProps,
    SliderLabelProps,
    SliderControlProps,
    SliderTrackProps,
    SliderRangeProps,
    SliderThumbProps,
    SliderValueTextProps,
    SliderMark,
} from './components/slider/index.js';

export { Accordion, accordionAnatomy, useAccordionContext } from './components/accordion/index.js';
export type { AccordionRootProps, AccordionItemProps, AccordionTriggerProps, AccordionPanelProps } from './components/accordion/index.js';

export { Select, selectAnatomy, useSelectContext, useSelectGroupContext } from './components/select/index.js';
export type {
    SelectRootProps,
    SelectTriggerProps,
    SelectValueProps,
    SelectIndicatorProps,
    SelectPopupProps,
    SelectGroupProps,
    SelectGroupLabelProps,
    SelectItemProps,
} from './components/select/index.js';


export { Avatar, avatarAnatomy, useAvatarContext } from './components/avatar/index.js';
export type { AvatarStatus, AvatarRootProps, AvatarImageProps, AvatarFallbackProps } from './components/avatar/index.js';

export {
    Toast, toastAnatomy, useToastViewportContext, useToastItemContext,
    createToaster, toaster, toast, useToaster,
} from './components/toast/index.js';
export type {
    ToastPlacement,
    ToastViewportProps,
    ToastRootProps,
    ToastTitleProps,
    ToastDescriptionProps,
    ToastActionProps,
    ToastCloseProps,
    Toaster,
    ToasterOptions,
    ToastData,
    ToastOptions,
    ToastActionData,
    ToastRole,
} from './components/toast/index.js';

export { Toggle, toggleAnatomy } from './components/toggle/index.js';
export type { ToggleRootProps } from './components/toggle/index.js';

export { ToggleGroup, toggleGroupAnatomy, useToggleGroupContext } from './components/toggle-group/index.js';
export type { ToggleGroupRootProps, ToggleGroupItemProps } from './components/toggle-group/index.js';

export { NumberInput, numberInputAnatomy, useNumberInputContext } from './components/number-input/index.js';
export type {
    NumberInputRootProps,
    NumberInputLabelProps,
    NumberInputControlProps,
    NumberInputInputProps,
    NumberInputTriggerProps,
} from './components/number-input/index.js';

export { RatingGroup, ratingGroupAnatomy, useRatingGroupContext } from './components/rating-group/index.js';
export type {
    RatingGroupRootProps,
    RatingGroupLabelProps,
    RatingGroupControlProps,
    RatingGroupItemProps,
    RatingItemSlotProps,
} from './components/rating-group/index.js';

export { TreeView, treeViewAnatomy, useTreeViewContext, useTreeBranchContext } from './components/tree-view/index.js';
export type {
    TreeViewRootProps,
    TreeViewLabelProps,
    TreeViewTreeProps,
    TreeViewItemProps,
    TreeViewBranchProps,
    TreeViewBranchTriggerProps,
    TreeViewBranchIndicatorProps,
    TreeViewBranchContentProps,
} from './components/tree-view/index.js';

export { Combobox, comboboxAnatomy, useComboboxContext, useComboboxGroupContext } from './components/combobox/index.js';
export type {
    ComboboxRootProps,
    ComboboxControlProps,
    ComboboxInputProps,
    ComboboxTriggerProps,
    ComboboxPopupProps,
    ComboboxGroupProps,
    ComboboxGroupLabelProps,
    ComboboxItemProps,
    ComboboxEmptyProps,
} from './components/combobox/index.js';

export { Input, inputAnatomy, useInputContext } from './components/input/index.js';
export type {
    InputRootProps,
    InputLabelProps,
    InputControlProps,
    InputInputProps,
    InputType,
} from './components/input/index.js';

export { Textarea, textareaAnatomy, useTextareaContext } from './components/textarea/index.js';
export type {
    TextareaRootProps,
    TextareaLabelProps,
    TextareaTextareaProps,
} from './components/textarea/index.js';

export { Card, cardAnatomy } from './components/card/index.js';
export type { CardRootProps, CardPartProps } from './components/card/index.js';

export { Alert, alertAnatomy, useAlertContext } from './components/alert/index.js';
export type {
    AlertRootProps,
    AlertIconProps,
    AlertTitleProps,
    AlertDescriptionProps,
    AlertCloseProps,
} from './components/alert/index.js';

export { Badge, badgeAnatomy } from './components/badge/index.js';
export type { BadgeRootProps } from './components/badge/index.js';

export { Divider, dividerAnatomy } from './components/divider/index.js';
export type { DividerRootProps } from './components/divider/index.js';

export { Skeleton, skeletonAnatomy } from './components/skeleton/index.js';
export type { SkeletonRootProps } from './components/skeleton/index.js';
export { Stack, Row, Col, stackAnatomy } from './components/stack/index.js';
export type { StackRootProps, StackItemProps } from './components/stack/index.js';
export { Spacer, spacerAnatomy } from './components/spacer/index.js';
export type { SpacerRootProps } from './components/spacer/index.js';
export { Grid, gridAnatomy } from './components/grid/index.js';
export type { GridRootProps, GridCellProps } from './components/grid/index.js';
export { Center, centerAnatomy } from './components/center/index.js';
export type { CenterRootProps } from './components/center/index.js';
export { Box, boxAnatomy } from './components/box/index.js';
export type { BoxRootProps } from './components/box/index.js';
export { Container, containerAnatomy } from './components/container/index.js';
export type { ContainerRootProps } from './components/container/index.js';

export { Spinner, spinnerAnatomy } from './components/spinner/index.js';
export type { SpinnerRootProps } from './components/spinner/index.js';

export { Kbd, kbdAnatomy } from './components/kbd/index.js';
export type { KbdRootProps } from './components/kbd/index.js';

export { Status, statusAnatomy } from './components/status/index.js';
export type { StatusRootProps } from './components/status/index.js';

export { Indicator, indicatorAnatomy } from './components/indicator/index.js';
export type {
    IndicatorRootProps,
    IndicatorItemProps,
    IndicatorPlacement,
} from './components/indicator/index.js';

export { Stats, statsAnatomy, useStatsContext } from './components/stats/index.js';
export type { StatsRootProps, StatsPartProps } from './components/stats/index.js';

export { Timeline, timelineAnatomy, useTimelineContext } from './components/timeline/index.js';
export type {
    TimelineRootProps,
    TimelinePartProps,
    TimelineContentProps,
    TimelinePlacement,
} from './components/timeline/index.js';

export { Chat, chatAnatomy } from './components/chat/index.js';
export type { ChatRootProps, ChatPartProps, ChatPlacement } from './components/chat/index.js';

export {
    RadialProgress,
    radialProgressAnatomy,
    useRadialProgressContext,
} from './components/radial-progress/index.js';
export type {
    RadialProgressRootProps,
    RadialProgressLabelProps,
    RadialProgressValueTextProps,
} from './components/radial-progress/index.js';

export { Join, joinAnatomy, useJoinContext } from './components/join/index.js';
export type { JoinRootProps, JoinItemProps } from './components/join/index.js';

export { Navbar, navbarAnatomy } from './components/navbar/index.js';
export type { NavbarRootProps, NavbarSectionProps } from './components/navbar/index.js';

export { Breadcrumbs, breadcrumbsAnatomy } from './components/breadcrumbs/index.js';
export type {
    BreadcrumbsRootProps,
    BreadcrumbsPartProps,
    BreadcrumbsLinkProps,
} from './components/breadcrumbs/index.js';

export { Pagination, paginationAnatomy, paginationRow } from './components/pagination/index.js';
export type { PaginationRootProps } from './components/pagination/index.js';

export { Steps, stepsAnatomy, useStepsContext, useStepsItemContext } from './components/steps/index.js';
export type {
    StepsRootProps,
    StepsItemProps,
    StepsPartProps,
    StepsPhase,
} from './components/steps/index.js';

export { Drawer, drawerAnatomy, useDrawerContext } from './components/drawer/index.js';
export type {
    DrawerRootProps,
    DrawerTriggerProps,
    DrawerPanelProps,
    DrawerTitleProps,
    DrawerCloseProps,
    DrawerPlacement,
} from './components/drawer/index.js';
export { Table, tableAnatomy } from './components/table/index.js';
export type { TableRootProps, TablePartProps, TableRowProps, TableHeaderCellProps } from './components/table/index.js';

export { FileUpload, fileUploadAnatomy, acceptsFile, formatBytes, useFileUploadContext } from './components/file-upload/index.js';
export type {
    FileUploadRootProps,
    FileUploadLabelProps,
    FileUploadTriggerProps,
    FileUploadDropzoneProps,
    FileUploadItemGroupProps,
    FileUploadItemProps,
    FileUploadItemTextProps,
    FileUploadItemRemoveProps,
} from './components/file-upload/index.js';

export { Carousel, carouselAnatomy, useCarouselContext } from './components/carousel/index.js';
export type {
    CarouselRootProps,
    CarouselViewportProps,
    CarouselItemProps,
    CarouselTriggerProps,
    CarouselIndicatorGroupProps,
    CarouselIndicatorProps,
} from './components/carousel/index.js';

export { Swap, swapAnatomy, useSwapContext } from './components/swap/index.js';
export type { SwapRootProps, SwapFaceProps } from './components/swap/index.js';

export { Countdown, countdownAnatomy } from './components/countdown/index.js';
export type { CountdownRootProps, CountdownValueProps } from './components/countdown/index.js';

export { Diff, diffAnatomy, useDiffContext } from './components/diff/index.js';
export type { DiffRootProps, DiffPaneProps, DiffHandleProps } from './components/diff/index.js';
