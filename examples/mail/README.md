# Zero Mail

A full mail client, on mock data, built **only from zero components** on a
**custom design system**. It exists to test what `@sigx/zero` can do today.
Where zero could not do something, the gap went into
[signalxjs/zero#440](https://github.com/signalxjs/zero/issues/440) and got a
workaround built with the zero framework itself.

```sh
pnpm build                       # zero, the kit and the design system
pnpm --filter zero-mail dev      # http://localhost:5173
```

## The rule

The app (`app/src`) renders zero components and nothing else:
- no intrinsic elements (`<div>`, `<span>`, `<p>`…)
- no `class`
- no `style`

`pnpm --filter zero-mail typecheck` enforces this: it runs
`app/scripts/check-no-raw.mjs` before the type checker. The look belongs to
the design system, and markup the app needs that zero lacks lives in the kit.

## Packages

| Folder | Package | What it is |
|---|---|---|
| [`kit`](kit) | `@sigx/zero-mail-kit` | The components zero does not ship yet, built from zero's public surface (`defineAnatomy`, behaviors, contract helpers). Their `mail-*` anatomies reach the design system as a manifest fragment. |
| [`ds`](ds) | `@sigx/zero-mail-ds` | The design system: scaffolded with `create-zero-ds --brief corporate` and made its own. Details below the table. |
| [`app`](app) | `zero-mail` | The Vite app: mock data (`src/data`), the store (`src/store.ts`), hash routing, and the views. |

The design system (`ds`) in more detail:
- **Look:** indigo on cool neutrals, Inter, a dense 14px scale, light and dark themes.
- **Typography vocabulary:** the `tone` / `weight` axes and the `truncate` / `clamp` / `compact` modifiers. An unread row is the kit's `mail-row` domain flag `data-x-unread` (#457), which the ds recipe keys as `x-unread`.
- **Recipes:** recipes for the kit's scopes, plus patches over the baseline.
- **Grade:** A, with 0 audit findings.

## What works

- **Mailboxes:** Inbox (Primary / Social / Promotions), Starred, Snoozed, Sent, Drafts, Archive, Spam, Trash, and five labels, all with unread counts.
- **Message list:**
  - A virtualised list of ~400 threads.
  - Keyboard roving and a visible j/k cursor.
  - Select-all (tri-state) with a bulk toolbar.
  - A right-click menu with snooze and label submenus.
  - Sort, and a loading skeleton.
- **Mutations:** archive, delete, spam, move, snooze, label, star and read/unread, each undoable from its toast.
- **Reading pane:**
  - The thread with expandable messages: each is a non-native `Collapsible` around its card, toggled by the header's chevron (#453).
  - Sender hover cards and attachments.
  - Newer/older navigation.
  - An inline reply that sends into the thread.
- **Compose:**
  - A docked, non-modal composer.
  - Recipient tags from the address book or any typed address, with Cc.
  - File attachments.
  - Send (Ctrl+Enter), with undo.
  - Closing saves a draft; reopening the draft from Drafts continues it.
- **Search:** live search, and a filter popover (sender, date, has attachments, unread).
- **Settings:** theme (system / light / dark), density, previews, notifications, signature.
- **Keyboard shortcuts:** `j k o x e # s u r a f c / ? Esc`, listed in a dialog.
- **Narrow screens:** the sidebar becomes a sheet and the panes show one at a time.
