# Tool reference

This file is generated from the tool schemas by `bun run docs:tools`. Edit the tool definitions in `src/tools/`, not this file.

Every tool takes an optional `guild_id`. Without it, the server uses `DISCORD_GUILD_ID`, or the only server the bot is in. IDs are Discord snowflakes passed as strings.

- Server: [`list_guilds`](#list_guilds), [`get_guild`](#get_guild), [`edit_guild`](#edit_guild)
- Channels: [`list_channels`](#list_channels), [`create_channel`](#create_channel), [`edit_channel`](#edit_channel), [`delete_channel`](#delete_channel), [`clone_channel`](#clone_channel), [`list_channel_permissions`](#list_channel_permissions), [`set_channel_permission`](#set_channel_permission), [`remove_channel_permission`](#remove_channel_permission)
- Roles: [`list_roles`](#list_roles), [`list_role_members`](#list_role_members), [`create_role`](#create_role), [`edit_role`](#edit_role), [`delete_role`](#delete_role), [`move_role`](#move_role)
- Members: [`list_members`](#list_members), [`get_member`](#get_member), [`search_members`](#search_members), [`set_nickname`](#set_nickname), [`add_member_role`](#add_member_role), [`remove_member_role`](#remove_member_role)
- Moderation: [`kick_member`](#kick_member), [`ban_user`](#ban_user), [`unban_user`](#unban_user), [`list_bans`](#list_bans), [`timeout_member`](#timeout_member), [`remove_timeout`](#remove_timeout), [`get_audit_log`](#get_audit_log)
- Messages: [`list_messages`](#list_messages), [`get_message`](#get_message), [`send_message`](#send_message), [`edit_message`](#edit_message), [`delete_message`](#delete_message), [`bulk_delete_messages`](#bulk_delete_messages), [`list_pinned_messages`](#list_pinned_messages), [`pin_message`](#pin_message), [`unpin_message`](#unpin_message), [`add_reaction`](#add_reaction), [`remove_reaction`](#remove_reaction), [`clear_reactions`](#clear_reactions), [`list_reactions`](#list_reactions)
- Threads and forum posts: [`list_threads`](#list_threads), [`create_thread`](#create_thread), [`create_forum_post`](#create_forum_post), [`edit_thread`](#edit_thread), [`delete_thread`](#delete_thread)
- Invites: [`list_invites`](#list_invites), [`create_invite`](#create_invite), [`delete_invite`](#delete_invite)
- Webhooks: [`list_webhooks`](#list_webhooks), [`create_webhook`](#create_webhook), [`delete_webhook`](#delete_webhook)
- Emojis and stickers: [`list_emojis`](#list_emojis), [`create_emoji`](#create_emoji), [`delete_emoji`](#delete_emoji), [`list_stickers`](#list_stickers), [`create_sticker`](#create_sticker), [`delete_sticker`](#delete_sticker)
- Scheduled events: [`list_scheduled_events`](#list_scheduled_events), [`create_scheduled_event`](#create_scheduled_event), [`edit_scheduled_event`](#edit_scheduled_event), [`delete_scheduled_event`](#delete_scheduled_event)
- Audit: [`audit_permissions`](#audit_permissions)

## Server

### `list_guilds`

List every Discord server the bot is a member of, limited to ALLOWED_GUILD_IDS when that is set.

Read-only.

No inputs.

### `get_guild`

Get details about a server: owner, member count, verification level, boosts and features.

Read-only.

No inputs besides `guild_id`.

### `edit_guild`

Change the server's name, icon, verification level or system channel, where Discord posts join and boost messages. Only the fields passed are changed.

Destructive, hidden when `READ_ONLY=true`.

| Input                | Type                                         | Required | Description                                                                                                                                                              |
| -------------------- | -------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`               | string, 2 to 100 characters                  |          | Server name, 2 to 100 characters.                                                                                                                                        |
| `icon_url`           | URL or null                                  |          | https URL of a new icon image, null removes the icon. Animated icons need boosts.                                                                                        |
| `verification_level` | `none`, `low`, `medium`, `high`, `very_high` |          | What new members need before they can talk: none, low (verified email), medium (account older than 5 minutes), high (member for 10 minutes), very_high (verified phone). |
| `system_channel_id`  | ID or null                                   |          | Text channel for join and boost messages, null turns them off.                                                                                                           |
| `reason`             | string, 1 to 512 characters                  |          | Why this is being done. Shown in the server audit log.                                                                                                                   |

## Channels

### `list_channels`

List all channels and categories in a server. Channels inside a category have its ID as parentId.

Read-only.

No inputs besides `guild_id`.

### `create_channel`

Create a channel or category. Announcement and stage channels need a Community server. A new channel inside a category starts with the category's permissions.

Writes, hidden when `READ_ONLY=true`.

| Input              | Type                                                          | Required | Description                                                                      |
| ------------------ | ------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| `name`             | string, 1 to 100 characters                                   | yes      | Channel name, 1 to 100 characters.                                               |
| `type`             | `text`, `voice`, `category`, `announcement`, `stage`, `forum` |          | Kind of channel to create. Default `"text"`.                                     |
| `parent_id`        | ID                                                            |          | Category to put the channel in.                                                  |
| `topic`            | string, up to 4096 characters                                 |          | Channel topic, up to 1024 characters (4096 for forums).                          |
| `nsfw`             | boolean                                                       |          | Whether the channel is age restricted.                                           |
| `slowmode_seconds` | integer, 0 to 21600                                           |          | Seconds a member has to wait between messages, 0 to 21600. 0 turns slowmode off. |
| `position`         | integer, 0 to 9007199254740991                                |          | Sort position, 0 is the top.                                                     |
| `reason`           | string, 1 to 512 characters                                   |          | Why this is being done. Shown in the server audit log.                           |

### `edit_channel`

Change a channel's name, topic, slowmode, age restriction, category or position. Only the fields passed are changed.

Destructive, hidden when `READ_ONLY=true`.

| Input              | Type                                  | Required | Description                                                                      |
| ------------------ | ------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| `channel_id`       | ID                                    | yes      | The channel or category ID.                                                      |
| `name`             | string, 1 to 100 characters           |          | Channel name, 1 to 100 characters.                                               |
| `topic`            | string, up to 4096 characters or null |          | New topic, null clears it.                                                       |
| `nsfw`             | boolean                               |          | Whether the channel is age restricted.                                           |
| `slowmode_seconds` | integer, 0 to 21600                   |          | Seconds a member has to wait between messages, 0 to 21600. 0 turns slowmode off. |
| `parent_id`        | ID or null                            |          | Category to move the channel to, null takes it out.                              |
| `position`         | integer, 0 to 9007199254740991        |          | Sort position, 0 is the top.                                                     |
| `reason`           | string, 1 to 512 characters           |          | Why this is being done. Shown in the server audit log.                           |

### `delete_channel`

Permanently delete a channel or category and its messages. Deleting a category keeps its channels, they move out of it.

Destructive, hidden when `READ_ONLY=true`.

| Input        | Type                        | Required | Description                                            |
| ------------ | --------------------------- | -------- | ------------------------------------------------------ |
| `channel_id` | ID                          | yes      | The channel or category ID.                            |
| `reason`     | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log. |

### `clone_channel`

Create a copy of a channel next to it with the same settings and permission overwrites. Messages are not copied, and cloning a category does not copy its channels.

Writes, hidden when `READ_ONLY=true`.

| Input        | Type                        | Required | Description                                            |
| ------------ | --------------------------- | -------- | ------------------------------------------------------ |
| `channel_id` | ID                          | yes      | The channel or category ID.                            |
| `name`       | string, 1 to 100 characters |          | Name for the copy. Defaults to the original name.      |
| `reason`     | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log. |

### `list_channel_permissions`

List the permission overwrites on a channel or category: which roles and members get permissions allowed or denied there on top of their server roles.

Read-only.

| Input        | Type | Required | Description                 |
| ------------ | ---- | -------- | --------------------------- |
| `channel_id` | ID   | yes      | The channel or category ID. |

### `set_channel_permission`

Allow, deny or reset permissions for one role or member on a channel or category. Permissions not listed keep their current setting. Use the role ID of @everyone (the server ID) for everyone.

Destructive, hidden when `READ_ONLY=true`.

| Input        | Type                        | Required | Description                                                                                      |
| ------------ | --------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `channel_id` | ID                          | yes      | The channel or category ID.                                                                      |
| `target_id`  | ID                          | yes      | Role ID or user ID the overwrite applies to.                                                     |
| `allow`      | list of names               |          | Permission names to allow, e.g. ViewChannel. Default `[]`.                                       |
| `deny`       | list of names               |          | Permission names to deny, e.g. ViewChannel. Default `[]`.                                        |
| `inherit`    | list of names               |          | Permission names to reset to inherit from the role and category, e.g. ViewChannel. Default `[]`. |
| `reason`     | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log.                                           |

### `remove_channel_permission`

Delete the permission overwrite for one role or member on a channel or category, so they fall back to their server roles and the category.

Destructive, hidden when `READ_ONLY=true`.

| Input        | Type                        | Required | Description                                            |
| ------------ | --------------------------- | -------- | ------------------------------------------------------ |
| `channel_id` | ID                          | yes      | The channel or category ID.                            |
| `target_id`  | ID                          | yes      | Role ID or user ID whose overwrite to remove.          |
| `reason`     | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log. |

## Roles

### `list_roles`

List all roles in a server, highest first, with their permissions. The bot can only manage roles below its own highest role.

Read-only.

No inputs besides `guild_id`.

### `list_role_members`

List the members who have a role, in pages ordered by user ID. Pass the returned nextAfter as after to get the next page.

Read-only.

| Input     | Type               | Required | Description                                          |
| --------- | ------------------ | -------- | ---------------------------------------------------- |
| `role_id` | ID                 | yes      | The role ID.                                         |
| `limit`   | integer, 1 to 1000 |          | Members per page, 1 to 1000. Default `100`.          |
| `after`   | ID                 |          | Return members with a user ID greater than this one. |

### `create_role`

Create a role. It starts just above @everyone, use move_role to place it. The bot can only give a role permissions it has itself.

Writes, hidden when `READ_ONLY=true`.

| Input         | Type                        | Required | Description                                                           |
| ------------- | --------------------------- | -------- | --------------------------------------------------------------------- |
| `name`        | string, 1 to 100 characters | yes      | Role name, 1 to 100 characters.                                       |
| `color`       | hex color                   |          | Hex color like #5865f2.                                               |
| `hoist`       | boolean                     |          | Whether members with this role are listed separately in the sidebar.  |
| `mentionable` | boolean                     |          | Whether anyone can @mention this role.                                |
| `permissions` | list of names               |          | Permission names to give the role, e.g. ManageMessages. Default `[]`. |
| `reason`      | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log.                |

### `edit_role`

Change a role's name, color, sidebar display, mentionability or permissions. Only the fields passed are changed, permissions not listed keep their setting.

Destructive, hidden when `READ_ONLY=true`.

| Input                | Type                        | Required | Description                                                          |
| -------------------- | --------------------------- | -------- | -------------------------------------------------------------------- |
| `role_id`            | ID                          | yes      | The role ID.                                                         |
| `name`               | string, 1 to 100 characters |          | Role name, 1 to 100 characters.                                      |
| `color`              | hex color or null           |          | New hex color like #5865f2, null removes the color.                  |
| `hoist`              | boolean                     |          | Whether members with this role are listed separately in the sidebar. |
| `mentionable`        | boolean                     |          | Whether anyone can @mention this role.                               |
| `add_permissions`    | list of names               |          | Permission names to add, e.g. ManageMessages. Default `[]`.          |
| `remove_permissions` | list of names               |          | Permission names to remove, e.g. ManageMessages. Default `[]`.       |
| `reason`             | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log.               |

### `delete_role`

Permanently delete a role. Members who had it lose it and its permissions.

Destructive, hidden when `READ_ONLY=true`.

| Input     | Type                        | Required | Description                                            |
| --------- | --------------------------- | -------- | ------------------------------------------------------ |
| `role_id` | ID                          | yes      | The role ID.                                           |
| `reason`  | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log. |

### `move_role`

Move a role directly above or below another role in the role list. Pass exactly one of above_role_id or below_role_id. Both roles have to be below the bot's highest role.

Destructive, hidden when `READ_ONLY=true`.

| Input           | Type                        | Required | Description                                            |
| --------------- | --------------------------- | -------- | ------------------------------------------------------ |
| `role_id`       | ID                          | yes      | The role ID.                                           |
| `above_role_id` | ID                          |          | Place the role directly above this role.               |
| `below_role_id` | ID                          |          | Place the role directly below this role.               |
| `reason`        | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log. |

## Members

### `list_members`

List server members in pages, ordered by user ID. Pass the returned nextAfter as after to get the next page.

Read-only.

| Input   | Type               | Required | Description                                          |
| ------- | ------------------ | -------- | ---------------------------------------------------- |
| `limit` | integer, 1 to 1000 |          | Members per page, 1 to 1000. Default `100`.          |
| `after` | ID                 |          | Return members with a user ID greater than this one. |

### `get_member`

Get one member of a server by user ID, including their roles and timeout status.

Read-only.

| Input     | Type | Required | Description           |
| --------- | ---- | -------- | --------------------- |
| `user_id` | ID   | yes      | The member's user ID. |

### `search_members`

Find members whose username or server nickname starts with the query, case insensitive.

Read-only.

| Input   | Type                        | Required | Description                                      |
| ------- | --------------------------- | -------- | ------------------------------------------------ |
| `query` | string, 1 to 100 characters | yes      | Start of a username or nickname.                 |
| `limit` | integer, 1 to 1000          |          | Most members to return, 1 to 1000. Default `25`. |

### `set_nickname`

Set or clear a member's server nickname, including the bot's own. Other members have to be below the bot's highest role.

Destructive, hidden when `READ_ONLY=true`.

| Input      | Type                               | Required | Description                                                                    |
| ---------- | ---------------------------------- | -------- | ------------------------------------------------------------------------------ |
| `user_id`  | ID                                 | yes      | The member's user ID.                                                          |
| `nickname` | string, 1 to 32 characters or null | yes      | New nickname, 1 to 32 characters. null clears it and shows the username again. |
| `reason`   | string, 1 to 512 characters        |          | Why this is being done. Shown in the server audit log.                         |

### `add_member_role`

Give a member a role. The role has to be below the bot's highest role.

Writes, hidden when `READ_ONLY=true`.

| Input     | Type                        | Required | Description                                            |
| --------- | --------------------------- | -------- | ------------------------------------------------------ |
| `user_id` | ID                          | yes      | The member's user ID.                                  |
| `role_id` | ID                          | yes      | The role ID.                                           |
| `reason`  | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log. |

### `remove_member_role`

Take a role away from a member. The role has to be below the bot's highest role.

Destructive, hidden when `READ_ONLY=true`.

| Input     | Type                        | Required | Description                                            |
| --------- | --------------------------- | -------- | ------------------------------------------------------ |
| `user_id` | ID                          | yes      | The member's user ID.                                  |
| `role_id` | ID                          | yes      | The role ID.                                           |
| `reason`  | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log. |

## Moderation

### `kick_member`

Remove a member from the server. They can rejoin with an invite. The member has to be below the bot's highest role.

Destructive, hidden when `READ_ONLY=true`.

| Input     | Type                        | Required | Description                                            |
| --------- | --------------------------- | -------- | ------------------------------------------------------ |
| `user_id` | ID                          | yes      | The user's ID.                                         |
| `reason`  | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log. |

### `ban_user`

Ban a user from the server, whether or not they are a member right now, and optionally delete their recent messages. A member has to be below the bot's highest role.

Destructive, hidden when `READ_ONLY=true`.

| Input                  | Type                        | Required | Description                                                                      |
| ---------------------- | --------------------------- | -------- | -------------------------------------------------------------------------------- |
| `user_id`              | ID                          | yes      | The user's ID.                                                                   |
| `delete_message_hours` | integer, 0 to 168           |          | Delete the user's messages from the last this many hours, 0 to 168. Default `0`. |
| `reason`               | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log.                           |

### `unban_user`

Lift a ban so the user can join again with an invite.

Writes, hidden when `READ_ONLY=true`.

| Input     | Type                        | Required | Description                                            |
| --------- | --------------------------- | -------- | ------------------------------------------------------ |
| `user_id` | ID                          | yes      | The user's ID.                                         |
| `reason`  | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log. |

### `list_bans`

List banned users with the ban reason, in pages ordered by user ID. Pass the returned nextAfter as after to get the next page.

Read-only.

| Input   | Type               | Required | Description                                       |
| ------- | ------------------ | -------- | ------------------------------------------------- |
| `limit` | integer, 1 to 1000 |          | Bans per page, 1 to 1000. Default `100`.          |
| `after` | ID                 |          | Return bans with a user ID greater than this one. |

### `timeout_member`

Time out a member so they can't send messages, react, or join voice until it ends. Replaces any running timeout. Members with Administrator can't be timed out.

Destructive, hidden when `READ_ONLY=true`.

| Input              | Type                        | Required | Description                                               |
| ------------------ | --------------------------- | -------- | --------------------------------------------------------- |
| `user_id`          | ID                          | yes      | The user's ID.                                            |
| `duration_minutes` | integer, 1 to 40320         | yes      | How long the timeout lasts, 1 to 40320 minutes (28 days). |
| `reason`           | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log.    |

### `remove_timeout`

End a member's timeout early.

Writes, hidden when `READ_ONLY=true`.

| Input     | Type                        | Required | Description                                            |
| --------- | --------------------------- | -------- | ------------------------------------------------------ |
| `user_id` | ID                          | yes      | The user's ID.                                         |
| `reason`  | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log. |

### `get_audit_log`

Read the server audit log, newest first. Filter by action and by who did it. Pass the returned nextBefore as before to get older entries.

Read-only.

| Input     | Type              | Required | Description                               |
| --------- | ----------------- | -------- | ----------------------------------------- |
| `action`  | name              |          | Only this action, e.g. MemberBanAdd.      |
| `user_id` | ID                |          | Only actions done by this user.           |
| `limit`   | integer, 1 to 100 |          | Entries per page, 1 to 100. Default `50`. |
| `before`  | ID                |          | Return entries older than this entry ID.  |

## Messages

### `list_messages`

Read messages in a channel, newest first. Pass the returned nextBefore as before to get older ones. Use after or around to read from a point instead.

Read-only.

| Input        | Type              | Required | Description                                 |
| ------------ | ----------------- | -------- | ------------------------------------------- |
| `channel_id` | ID                | yes      | The channel or thread ID.                   |
| `limit`      | integer, 1 to 100 |          | Messages per page, 1 to 100. Default `50`.  |
| `before`     | ID                |          | Return messages older than this message ID. |
| `after`      | ID                |          | Return messages newer than this message ID. |
| `around`     | ID                |          | Return messages around this message ID.     |

### `get_message`

Get one message by ID, with its embeds, attachments and reactions.

Read-only.

| Input        | Type | Required | Description               |
| ------------ | ---- | -------- | ------------------------- |
| `channel_id` | ID   | yes      | The channel or thread ID. |
| `message_id` | ID   | yes      | The message ID.           |

### `send_message`

Send a message with text, embeds or both, optionally as a reply. @everyone, @here and role mentions don't ping anyone unless allow_mass_mentions is true.

Writes, hidden when `READ_ONLY=true`.

| Input                      | Type                            | Required | Description                                                                              |
| -------------------------- | ------------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `channel_id`               | ID                              | yes      | The channel or thread ID.                                                                |
| `content`                  | string, up to 2000 characters   |          | Message text, up to 2000 characters. Supports Discord markdown.                          |
| `embeds`                   | list of objects, up to 10 items |          | Up to 10 embeds, with at most 6000 characters of text combined.                          |
| `embeds[].title`           | string, 1 to 256 characters     |          |                                                                                          |
| `embeds[].description`     | string, 1 to 4096 characters    |          |                                                                                          |
| `embeds[].url`             | URL                             |          | Turns the title into a link.                                                             |
| `embeds[].color`           | hex color                       |          | Hex color like #5865f2.                                                                  |
| `embeds[].author_name`     | string, 1 to 256 characters     |          |                                                                                          |
| `embeds[].footer_text`     | string, 1 to 2048 characters    |          |                                                                                          |
| `embeds[].image_url`       | URL                             |          |                                                                                          |
| `embeds[].thumbnail_url`   | URL                             |          |                                                                                          |
| `embeds[].timestamp`       | ISO 8601 time                   |          | ISO 8601 time shown in the footer.                                                       |
| `embeds[].fields`          | list of objects, up to 25 items |          |                                                                                          |
| `embeds[].fields[].name`   | string, 1 to 256 characters     | yes      |                                                                                          |
| `embeds[].fields[].value`  | string, 1 to 1024 characters    | yes      |                                                                                          |
| `embeds[].fields[].inline` | boolean                         |          |                                                                                          |
| `reply_to`                 | ID                              |          | ID of a message in the same channel to reply to.                                         |
| `allow_mass_mentions`      | boolean                         |          | Let @everyone, @here and role mentions ping. User mentions always ping. Default `false`. |

### `edit_message`

Replace the text or embeds of a message the bot sent. Fields left out stay as they are, an empty embeds list removes all embeds. Discord doesn't let bots edit other users' messages.

Destructive, hidden when `READ_ONLY=true`.

| Input                      | Type                            | Required | Description                                                                                                             |
| -------------------------- | ------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| `channel_id`               | ID                              | yes      | The channel or thread ID.                                                                                               |
| `message_id`               | ID                              | yes      | The message ID.                                                                                                         |
| `content`                  | string, up to 2000 characters   |          | New text, an empty string removes it.                                                                                   |
| `embeds`                   | list of objects, up to 10 items |          | Up to 10 embeds, with at most 6000 characters of text combined.                                                         |
| `embeds[].title`           | string, 1 to 256 characters     |          |                                                                                                                         |
| `embeds[].description`     | string, 1 to 4096 characters    |          |                                                                                                                         |
| `embeds[].url`             | URL                             |          | Turns the title into a link.                                                                                            |
| `embeds[].color`           | hex color                       |          | Hex color like #5865f2.                                                                                                 |
| `embeds[].author_name`     | string, 1 to 256 characters     |          |                                                                                                                         |
| `embeds[].footer_text`     | string, 1 to 2048 characters    |          |                                                                                                                         |
| `embeds[].image_url`       | URL                             |          |                                                                                                                         |
| `embeds[].thumbnail_url`   | URL                             |          |                                                                                                                         |
| `embeds[].timestamp`       | ISO 8601 time                   |          | ISO 8601 time shown in the footer.                                                                                      |
| `embeds[].fields`          | list of objects, up to 25 items |          |                                                                                                                         |
| `embeds[].fields[].name`   | string, 1 to 256 characters     | yes      |                                                                                                                         |
| `embeds[].fields[].value`  | string, 1 to 1024 characters    | yes      |                                                                                                                         |
| `embeds[].fields[].inline` | boolean                         |          |                                                                                                                         |
| `reason`                   | string, 1 to 512 characters     |          | Why this is being done. Discord keeps no audit log entry for this action, so the reason only goes to this server's log. |

### `delete_message`

Delete one message. Messages from other users need Manage Messages.

Destructive, hidden when `READ_ONLY=true`.

| Input        | Type                        | Required | Description                                            |
| ------------ | --------------------------- | -------- | ------------------------------------------------------ |
| `channel_id` | ID                          | yes      | The channel or thread ID.                              |
| `message_id` | ID                          | yes      | The message ID.                                        |
| `reason`     | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log. |

### `bulk_delete_messages`

Delete up to 100 messages at once, either by ID or the most recent ones, optionally only from one user. Discord can't bulk delete messages older than 14 days: listed IDs that old are refused, recent ones that old are skipped.

Destructive, hidden when `READ_ONLY=true`.

| Input         | Type                        | Required | Description                                                                   |
| ------------- | --------------------------- | -------- | ----------------------------------------------------------------------------- |
| `channel_id`  | ID                          | yes      | The channel or thread ID.                                                     |
| `message_ids` | list of IDs, 1 to 100 items |          | IDs of up to 100 messages to delete.                                          |
| `count`       | integer, 1 to 100           |          | Delete this many of the most recent messages, 1 to 100.                       |
| `user_id`     | ID                          |          | With count, only delete messages from this user, among the last 100 messages. |
| `reason`      | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log.                        |

### `list_pinned_messages`

List a channel's pinned messages, most recently pinned first. Pass the returned nextBefore as before to get older pins.

Read-only.

| Input        | Type             | Required | Description                                       |
| ------------ | ---------------- | -------- | ------------------------------------------------- |
| `channel_id` | ID               | yes      | The channel or thread ID.                         |
| `limit`      | integer, 1 to 50 |          | Pins per page, 1 to 50. Default `50`.             |
| `before`     | ISO 8601 time    |          | Return messages pinned before this ISO 8601 time. |

### `pin_message`

Pin a message to its channel.

Writes, hidden when `READ_ONLY=true`.

| Input        | Type                        | Required | Description                                            |
| ------------ | --------------------------- | -------- | ------------------------------------------------------ |
| `channel_id` | ID                          | yes      | The channel or thread ID.                              |
| `message_id` | ID                          | yes      | The message ID.                                        |
| `reason`     | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log. |

### `unpin_message`

Unpin a message. The message itself stays.

Writes, hidden when `READ_ONLY=true`.

| Input        | Type                        | Required | Description                                            |
| ------------ | --------------------------- | -------- | ------------------------------------------------------ |
| `channel_id` | ID                          | yes      | The channel or thread ID.                              |
| `message_id` | ID                          | yes      | The message ID.                                        |
| `reason`     | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log. |

### `add_reaction`

React to a message as the bot.

Writes, hidden when `READ_ONLY=true`.

| Input        | Type                        | Required | Description                                                 |
| ------------ | --------------------------- | -------- | ----------------------------------------------------------- |
| `channel_id` | ID                          | yes      | The channel or thread ID.                                   |
| `message_id` | ID                          | yes      | The message ID.                                             |
| `emoji`      | string, 1 to 100 characters | yes      | A Unicode emoji character, or a custom emoji as <:name:id>. |

### `remove_reaction`

Remove one user's reaction from a message, the bot's own by default. Removing someone else's needs Manage Messages.

Destructive, hidden when `READ_ONLY=true`.

| Input        | Type                        | Required | Description                                                                                                             |
| ------------ | --------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| `channel_id` | ID                          | yes      | The channel or thread ID.                                                                                               |
| `message_id` | ID                          | yes      | The message ID.                                                                                                         |
| `emoji`      | string, 1 to 100 characters | yes      | A Unicode emoji character, or a custom emoji as <:name:id>.                                                             |
| `user_id`    | ID                          |          | Whose reaction to remove. Defaults to the bot.                                                                          |
| `reason`     | string, 1 to 512 characters |          | Why this is being done. Discord keeps no audit log entry for this action, so the reason only goes to this server's log. |

### `clear_reactions`

Remove every reaction from a message, or only the reactions with one emoji.

Destructive, hidden when `READ_ONLY=true`.

| Input        | Type                        | Required | Description                                                                                                             |
| ------------ | --------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| `channel_id` | ID                          | yes      | The channel or thread ID.                                                                                               |
| `message_id` | ID                          | yes      | The message ID.                                                                                                         |
| `emoji`      | string, 1 to 100 characters |          | Only clear this emoji. Leave out to clear all reactions.                                                                |
| `reason`     | string, 1 to 512 characters |          | Why this is being done. Discord keeps no audit log entry for this action, so the reason only goes to this server's log. |

### `list_reactions`

List the users who reacted to a message with one emoji, ordered by user ID. Pass the returned nextAfter as after to get the next page.

Read-only.

| Input        | Type                        | Required | Description                                                 |
| ------------ | --------------------------- | -------- | ----------------------------------------------------------- |
| `channel_id` | ID                          | yes      | The channel or thread ID.                                   |
| `message_id` | ID                          | yes      | The message ID.                                             |
| `emoji`      | string, 1 to 100 characters | yes      | A Unicode emoji character, or a custom emoji as <:name:id>. |
| `limit`      | integer, 1 to 100           |          | Users per page, 1 to 100. Default `100`.                    |
| `after`      | ID                          |          | Return users with an ID greater than this one.              |

## Threads and forum posts

### `list_threads`

List active threads and forum posts in the server or one channel. With archived true, list a channel's archived threads instead, most recently archived first. Pass the returned nextBefore as before to get older ones.

Read-only.

| Input        | Type              | Required | Description                                                                                        |
| ------------ | ----------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `channel_id` | ID                |          | Only threads in this channel or forum. Required with archived.                                     |
| `archived`   | boolean           |          | List archived threads instead of active ones. Default `false`.                                     |
| `private`    | boolean           |          | With archived, list private threads instead of public ones. Needs Manage Threads. Default `false`. |
| `limit`      | integer, 1 to 100 |          | Archived threads per page, 1 to 100. Default `50`.                                                 |
| `before`     | ISO 8601 time     |          | With archived, return threads archived before this ISO 8601 time.                                  |

### `create_thread`

Start a thread in a text or announcement channel, either from an existing message or on its own. Private threads only exist in text channels and can't start from a message. For forums use create_forum_post. Send messages into the thread with send_message and its ID.

Writes, hidden when `READ_ONLY=true`.

| Input                  | Type                          | Required | Description                                                                      |
| ---------------------- | ----------------------------- | -------- | -------------------------------------------------------------------------------- |
| `channel_id`           | ID                            | yes      | Text or announcement channel to start the thread in.                             |
| `name`                 | string, 1 to 100 characters   | yes      | Thread name, 1 to 100 characters.                                                |
| `message_id`           | ID                            |          | Start the thread from this message in the channel.                               |
| `private`              | boolean                       |          | Only members who are added or mentioned can see it. Default `false`.             |
| `auto_archive_minutes` | `60`, `1440`, `4320`, `10080` |          | Minutes without activity before the thread is archived: 60, 1440, 4320 or 10080. |
| `slowmode_seconds`     | integer, 0 to 21600           |          | Seconds a member has to wait between messages, 0 to 21600.                       |
| `reason`               | string, 1 to 512 characters   |          | Why this is being done. Shown in the server audit log.                           |

### `create_forum_post`

Start a post in a forum or media channel with a title, a first message and tags. @everyone, @here and role mentions in it don't ping.

Writes, hidden when `READ_ONLY=true`.

| Input                      | Type                            | Required | Description                                                                      |
| -------------------------- | ------------------------------- | -------- | -------------------------------------------------------------------------------- |
| `channel_id`               | ID                              | yes      | The forum or media channel.                                                      |
| `name`                     | string, 1 to 100 characters     | yes      | Post title, 1 to 100 characters.                                                 |
| `content`                  | string, up to 2000 characters   |          | Message text, up to 2000 characters. Supports Discord markdown.                  |
| `embeds`                   | list of objects, up to 10 items |          | Up to 10 embeds, with at most 6000 characters of text combined.                  |
| `embeds[].title`           | string, 1 to 256 characters     |          |                                                                                  |
| `embeds[].description`     | string, 1 to 4096 characters    |          |                                                                                  |
| `embeds[].url`             | URL                             |          | Turns the title into a link.                                                     |
| `embeds[].color`           | hex color                       |          | Hex color like #5865f2.                                                          |
| `embeds[].author_name`     | string, 1 to 256 characters     |          |                                                                                  |
| `embeds[].footer_text`     | string, 1 to 2048 characters    |          |                                                                                  |
| `embeds[].image_url`       | URL                             |          |                                                                                  |
| `embeds[].thumbnail_url`   | URL                             |          |                                                                                  |
| `embeds[].timestamp`       | ISO 8601 time                   |          | ISO 8601 time shown in the footer.                                               |
| `embeds[].fields`          | list of objects, up to 25 items |          |                                                                                  |
| `embeds[].fields[].name`   | string, 1 to 256 characters     | yes      |                                                                                  |
| `embeds[].fields[].value`  | string, 1 to 1024 characters    | yes      |                                                                                  |
| `embeds[].fields[].inline` | boolean                         |          |                                                                                  |
| `tag_ids`                  | list of IDs, up to 5 items      |          | Forum tag IDs, up to 5. list_channels shows each forum's tags. Default `[]`.     |
| `auto_archive_minutes`     | `60`, `1440`, `4320`, `10080`   |          | Minutes without activity before the thread is archived: 60, 1440, 4320 or 10080. |
| `reason`                   | string, 1 to 512 characters     |          | Why this is being done. Shown in the server audit log.                           |

### `edit_thread`

Rename, archive, reopen, lock or unlock a thread or forum post, or change its slowmode, auto archive time or tags. An archived thread has to be reopened with archived false to change anything else. Only the fields passed are changed.

Destructive, hidden when `READ_ONLY=true`.

| Input                  | Type                          | Required | Description                                                                      |
| ---------------------- | ----------------------------- | -------- | -------------------------------------------------------------------------------- |
| `thread_id`            | ID                            | yes      | The thread or forum post ID.                                                     |
| `name`                 | string, 1 to 100 characters   |          | Thread name, 1 to 100 characters.                                                |
| `archived`             | boolean                       |          | true archives the thread, false reopens it.                                      |
| `locked`               | boolean                       |          | A locked thread can only be reopened by members with Manage Threads.             |
| `auto_archive_minutes` | `60`, `1440`, `4320`, `10080` |          | Minutes without activity before the thread is archived: 60, 1440, 4320 or 10080. |
| `slowmode_seconds`     | integer, 0 to 21600           |          | Seconds a member has to wait between messages, 0 to 21600.                       |
| `tag_ids`              | list of IDs, up to 5 items    |          | Replace a forum post's tags. An empty list removes them.                         |
| `reason`               | string, 1 to 512 characters   |          | Why this is being done. Shown in the server audit log.                           |

### `delete_thread`

Permanently delete a thread or forum post and every message in it.

Destructive, hidden when `READ_ONLY=true`.

| Input       | Type                        | Required | Description                                            |
| ----------- | --------------------------- | -------- | ------------------------------------------------------ |
| `thread_id` | ID                          | yes      | The thread or forum post ID.                           |
| `reason`    | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log. |

## Invites

### `list_invites`

List the server's active invites with their uses and expiry, or only the ones for one channel. Needs Manage Server, or Manage Channels for one channel.

Read-only.

| Input        | Type | Required | Description                        |
| ------------ | ---- | -------- | ---------------------------------- |
| `channel_id` | ID   |          | Only list invites to this channel. |

### `create_invite`

Create an invite link to a channel. By default it lasts 24 hours with unlimited uses, and an existing invite with the same settings is reused unless unique is true.

Writes, hidden when `READ_ONLY=true`.

| Input             | Type                        | Required | Description                                                                                            |
| ----------------- | --------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `channel_id`      | ID                          | yes      | Channel the invite leads to.                                                                           |
| `max_age_seconds` | integer, 0 to 604800        |          | Seconds until the invite expires, up to 604800 (7 days). 0 never expires. Default `86400`.             |
| `max_uses`        | integer, 0 to 100           |          | How often it can be used, 0 is unlimited. Default `0`.                                                 |
| `temporary`       | boolean                     |          | Members who join through it are removed when they go offline, unless they got a role. Default `false`. |
| `unique`          | boolean                     |          | Always create a new invite instead of reusing a matching one. Default `false`.                         |
| `reason`          | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log.                                                 |

### `delete_invite`

Revoke an invite so the link stops working. Takes the code or the full link.

Destructive, hidden when `READ_ONLY=true`.

| Input    | Type                        | Required | Description                                            |
| -------- | --------------------------- | -------- | ------------------------------------------------------ |
| `code`   | string, 2 to 300 characters | yes      | Invite code like abc123, or a discord.gg link.         |
| `reason` | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log. |

## Webhooks

### `list_webhooks`

List the server's webhooks, or one channel's. Webhook URLs contain a secret token and are not returned.

Read-only.

| Input        | Type | Required | Description                         |
| ------------ | ---- | -------- | ----------------------------------- |
| `channel_id` | ID   |          | Only list webhooks in this channel. |

### `create_webhook`

Create a webhook in a channel. Returns its URL, which contains a secret token: anyone with it can post to the channel, so only hand it to the service that needs it.

Writes, hidden when `READ_ONLY=true`.

| Input        | Type                        | Required | Description                                                       |
| ------------ | --------------------------- | -------- | ----------------------------------------------------------------- |
| `channel_id` | ID                          | yes      | Channel the webhook posts to.                                     |
| `name`       | string, 1 to 80 characters  | yes      | Webhook name, 1 to 80 characters, without clyde or discord in it. |
| `avatar_url` | URL                         |          | https URL of an image to use as the webhook's avatar.             |
| `reason`     | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log.            |

### `delete_webhook`

Delete a webhook. Anything still posting through its URL stops working.

Destructive, hidden when `READ_ONLY=true`.

| Input        | Type                        | Required | Description                                            |
| ------------ | --------------------------- | -------- | ------------------------------------------------------ |
| `webhook_id` | ID                          | yes      | The webhook ID.                                        |
| `reason`     | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log. |

## Emojis and stickers

### `list_emojis`

List the server's custom emojis. Use the returned mention, like <:name:id>, in messages and reactions.

Read-only.

No inputs besides `guild_id`.

### `create_emoji`

Upload a custom emoji from an image URL: PNG, JPEG, GIF or WebP, up to 256 KB. Animated GIFs become animated emojis.

Writes, hidden when `READ_ONLY=true`.

| Input       | Type                         | Required | Description                                                                     |
| ----------- | ---------------------------- | -------- | ------------------------------------------------------------------------------- |
| `name`      | string                       | yes      | Emoji name, 2 to 32 letters, digits or underscores.                             |
| `image_url` | URL                          | yes      | https URL of the image.                                                         |
| `role_ids`  | list of IDs, up to 250 items |          | Only members with one of these roles can use the emoji. Leave out for everyone. |
| `reason`    | string, 1 to 512 characters  |          | Why this is being done. Shown in the server audit log.                          |

### `delete_emoji`

Delete a custom emoji. Needs Manage Expressions, or Create Expressions for emojis the bot uploaded.

Destructive, hidden when `READ_ONLY=true`.

| Input      | Type                        | Required | Description                                            |
| ---------- | --------------------------- | -------- | ------------------------------------------------------ |
| `emoji_id` | ID                          | yes      | The emoji ID.                                          |
| `reason`   | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log. |

### `list_stickers`

List the server's custom stickers.

Read-only.

No inputs besides `guild_id`.

### `create_sticker`

Upload a custom sticker from a file URL: PNG, APNG or GIF at 320x320, or Lottie JSON, up to 512 KB.

Writes, hidden when `READ_ONLY=true`.

| Input         | Type                        | Required | Description                                                                  |
| ------------- | --------------------------- | -------- | ---------------------------------------------------------------------------- |
| `name`        | string, 2 to 30 characters  | yes      | Sticker name, 2 to 30 characters.                                            |
| `tags`        | string, 1 to 200 characters | yes      | A related Unicode emoji, or words, that Discord uses to suggest the sticker. |
| `description` | string, 2 to 100 characters |          | Description, 2 to 100 characters.                                            |
| `file_url`    | URL                         | yes      | https URL of the sticker file.                                               |
| `reason`      | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log.                       |

### `delete_sticker`

Delete a custom sticker. Needs Manage Expressions, or Create Expressions for stickers the bot uploaded.

Destructive, hidden when `READ_ONLY=true`.

| Input        | Type                        | Required | Description                                            |
| ------------ | --------------------------- | -------- | ------------------------------------------------------ |
| `sticker_id` | ID                          | yes      | The sticker ID.                                        |
| `reason`     | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log. |

## Scheduled events

### `list_scheduled_events`

List the server's scheduled events that haven't ended, soonest first, with how many people are interested.

Read-only.

No inputs besides `guild_id`.

### `create_scheduled_event`

Schedule an event in a voice or stage channel, or somewhere outside Discord. External events need a location and an end_time. Members see it in the server's event list and can mark themselves interested.

Writes, hidden when `READ_ONLY=true`.

| Input         | Type                          | Required | Description                                                                |
| ------------- | ----------------------------- | -------- | -------------------------------------------------------------------------- |
| `name`        | string, 1 to 100 characters   | yes      | Event name, 1 to 100 characters.                                           |
| `type`        | `voice`, `stage`, `external`  | yes      | voice or stage for a channel, external for anywhere else.                  |
| `start_time`  | ISO 8601 time                 | yes      | When it starts, ISO 8601 with a time zone offset. Has to be in the future. |
| `end_time`    | ISO 8601 time                 |          | When it ends, ISO 8601. Required for external events.                      |
| `channel_id`  | ID                            |          | Voice or stage channel, for voice and stage events.                        |
| `location`    | string, 1 to 100 characters   |          | Where an external event happens, up to 100 characters.                     |
| `description` | string, up to 1000 characters |          | Event description, up to 1000 characters.                                  |
| `reason`      | string, 1 to 512 characters   |          | Why this is being done. Shown in the server audit log.                     |

### `edit_scheduled_event`

Change an event's name, description, times or location, or start, end or cancel it. A scheduled event can go to active or canceled, an active one to completed. Only the fields passed are changed.

Destructive, hidden when `READ_ONLY=true`.

| Input         | Type                              | Required | Description                                                 |
| ------------- | --------------------------------- | -------- | ----------------------------------------------------------- |
| `event_id`    | ID                                | yes      | The scheduled event ID.                                     |
| `name`        | string, 1 to 100 characters       |          | Event name, 1 to 100 characters.                            |
| `description` | string, up to 1000 characters     |          | Event description, up to 1000 characters.                   |
| `start_time`  | ISO 8601 time                     |          | New start, ISO 8601. Only before the event has started.     |
| `end_time`    | ISO 8601 time                     |          | New end, ISO 8601.                                          |
| `location`    | string, 1 to 100 characters       |          | New location, external events only.                         |
| `status`      | `active`, `completed`, `canceled` |          | active starts it, completed ends it, canceled calls it off. |
| `reason`      | string, 1 to 512 characters       |          | Why this is being done. Shown in the server audit log.      |

### `delete_scheduled_event`

Delete a scheduled event outright. To call off an upcoming event and keep a record of it, use edit_scheduled_event with status canceled.

Destructive, hidden when `READ_ONLY=true`.

| Input      | Type                        | Required | Description                                            |
| ---------- | --------------------------- | -------- | ------------------------------------------------------ |
| `event_id` | ID                          | yes      | The scheduled event ID.                                |
| `reason`   | string, 1 to 512 characters |          | Why this is being done. Shown in the server audit log. |

## Audit

### `audit_permissions`

Check a server for risky permission setups: dangerous permissions on @everyone, roles and bots with Administrator, staff or log channels anyone can see, weak verification, content filter and 2FA settings, and powerful roles above the bot. Returns findings with a severity and a suggested fix, most severe first. Changes nothing.

Read-only.

No inputs besides `guild_id`.
