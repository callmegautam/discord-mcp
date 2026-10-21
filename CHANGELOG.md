# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.7.0] - 2026-10-21

### Added

- Thread tools: `list_threads`, `create_thread`, `create_forum_post`, `edit_thread`, `delete_thread`
- The message tools work inside threads and forum posts, with Send Messages in Threads checked there instead of Send Messages
- Invite tools: `list_invites`, `create_invite`, `delete_invite`, which takes a code or a discord.gg link
- Webhook tools: `list_webhooks`, `create_webhook`, `delete_webhook`. Only `create_webhook` returns a webhook URL, since it holds a secret token
- Emoji and sticker tools: `list_emojis`, `create_emoji`, `delete_emoji`, `list_stickers`, `create_sticker`, `delete_sticker`
- Scheduled event tools: `list_scheduled_events`, `create_scheduled_event`, `edit_scheduled_event`, `delete_scheduled_event` for voice, stage and external events, with start, end and cancel through `edit_scheduled_event`
- `edit_guild` changes the server's name, icon, verification level and system channel
- `list_channels` returns each forum's tags, `get_guild` returns the system channel
- Images and sticker files are taken from https URLs only, downloaded and checked against Discord's size limits before uploading
- Prechecks name the missing Manage Server, Create Invite, Manage Webhooks, Create or Manage Expressions, Create or Manage Events, Create Public or Private Threads and Manage Threads permission, and check forum tags, event times and event status changes
- Hints on Discord errors 30007 (webhook limit), 30008 (emoji slots), 30039 (sticker slots), 40067 (forum tag required), 50045 (file too large), 50046 (unreadable file) and 160004 (message already has a thread)

## [0.6.0] - 2026-10-21

### Added

- Message tools: `list_messages`, `get_message`, `send_message`, `edit_message`, `delete_message`, `bulk_delete_messages`
- Pin tools: `list_pinned_messages`, `pin_message`, `unpin_message`
- Reaction tools: `add_reaction`, `remove_reaction`, `clear_reactions`, `list_reactions`
- `MESSAGE_CONTENT` setting that requests the privileged Message Content intent, off by default so the other tools don't need it
- `send_message` and `edit_message` take up to 10 embeds and check Discord's text limits, `send_message` can reply to a message and doesn't ping `@everyone`, `@here` or roles unless `allow_mass_mentions` is true
- `bulk_delete_messages` deletes by ID or the most recent messages, optionally from one user, and refuses or skips messages older than 14 days
- Prechecks name the missing channel permission: Read Message History, Send Messages, Embed Links, Add Reactions, Pin Messages or Manage Messages
- Hints on Discord errors 10014 (unknown emoji), 30003 (pin limit) and 50006 (empty message)
- A clear startup error when Discord refuses a privileged intent that is not enabled in the developer portal

## [0.5.0] - 2026-10-21

### Added

- Moderation tools: `kick_member`, `ban_user`, `unban_user`, `list_bans`, `timeout_member`, `remove_timeout`
- `ban_user` works for users who are not in the server and can delete up to 7 days of their messages
- `set_nickname` sets or clears a member's nickname, including the bot's own
- `search_members` finds members by the start of their username or nickname
- `get_audit_log` reads the audit log, filtered by action and by who did it, with paging
- Prechecks name the missing Kick Members, Ban Members, Moderate Members, Manage Nicknames or View Audit Log permission, members at or above the bot's highest role, and members with Administrator, who can't be timed out

## [0.4.0] - 2026-10-21

### Added

- Role tools: `create_role`, `edit_role`, `delete_role`, `move_role`
- Role membership tools: `list_role_members`, `add_member_role`, `remove_member_role`
- `edit_role` takes `add_permissions` and `remove_permissions` and keeps every other permission as it is
- `move_role` places a role directly above or below another role instead of taking a raw position
- Prechecks name the missing Manage Roles permission, permissions the bot can't give because it lacks them, and roles at or above the bot's highest role

## [0.3.0] - 2026-10-21

### Added

- Channel tools: `create_channel`, `edit_channel`, `delete_channel`, `clone_channel`
- Permission overwrite tools: `list_channel_permissions`, `set_channel_permission`, `remove_channel_permission`
- `create_channel` supports text, voice, category, announcement, stage and forum channels, and refuses announcement and stage channels outside Community servers
- `edit_channel` and `create_channel` refuse fields a channel type doesn't have, such as a topic on a voice channel
- `set_channel_permission` merges into the existing overwrite, with `inherit` to reset single permissions
- Prechecks name the missing Manage Channels or Manage Roles permission, and the permissions the bot can't allow or deny because it lacks them
- `list_channels` returns `slowmodeSeconds`
- Hint on Discord's error 50074 when deleting a channel a Community server requires

## [0.2.0] - 2026-10-21

### Added

- `READ_ONLY` mode that only registers tools marked read-only
- `ALLOWED_GUILD_IDS` to limit the bot to a list of servers, other servers are hidden from `list_guilds` and refused by every tool
- `DISABLED_TOOLS` to switch off single tools by name
- Startup checks: unknown tool names, allowlisted servers the bot is not in, and a default server outside the allowlist all stop the server with a clear error
- Startup refuses any tool without explicit MCP annotations, and any destructive tool without an audit log `reason`
- Permission and role hierarchy prechecks that name the missing permission or the role in the way
- Hints on Discord's Missing Permissions and Missing Access errors

## [0.1.0] - 2026-10-21

### Added

- MCP server over stdio, built on discord.js and the MCP TypeScript SDK, running on Bun
- Read-only tools: `list_guilds`, `get_guild`, `list_channels`, `list_roles`, `list_members`, `get_member`
- Default server resolution through `DISCORD_GUILD_ID`, or the only server the bot is in
- Environment validation with clear startup errors
- Docker image running as a non-root user, token passed at runtime through `--env-file`

[Unreleased]: https://github.com/callmegautam/discord-mcp/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/callmegautam/discord-mcp/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/callmegautam/discord-mcp/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/callmegautam/discord-mcp/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/callmegautam/discord-mcp/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/callmegautam/discord-mcp/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/callmegautam/discord-mcp/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/callmegautam/discord-mcp/releases/tag/v0.1.0
