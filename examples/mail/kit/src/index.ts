// @sigx/zero-mail-kit — Zero Mail's own components, built only from
// @sigx/zero's public surface. Each stands in for something zero does not ship
// yet (signalxjs/zero#440); the design system styles them through the
// fragment in `./fragment`.

export * from './anatomy.js';
export { Text, Heading, Time, formatMailTime, typeAttrs } from './Text.js';
export type { TextRootProps, TextElement, Tone, Weight, TypeProps, HeadingRootProps, TimeRootProps, TimeFormat } from './Text.js';
export { Icon, ICONS } from './Icon.js';
export type { IconName, IconRootProps } from './Icon.js';
export { Toolbar } from './Toolbar.js';
export type { ToolbarRootProps, ToolbarGroupProps } from './Toolbar.js';
export { MailList, MailRow, useMailListContext } from './MailList.js';
export type { MailListRootProps, MailRowRootProps } from './MailList.js';
export { Shell, Split } from './Shell.js';
export type { ShellRootProps, ShellRegionProps, SplitRootProps, SplitPaneProps } from './Shell.js';
export { ActionButton } from './ActionButton.js';
export type { ActionButtonProps } from './ActionButton.js';
export { MenuAction } from './MenuAction.js';
export type { MenuActionProps } from './MenuAction.js';
