# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/callmegautam/discord-mcp/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/callmegautam/discord-mcp/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/callmegautam/discord-mcp/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/callmegautam/discord-mcp/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/callmegautam/discord-mcp/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/callmegautam/discord-mcp/releases/tag/v0.1.0
