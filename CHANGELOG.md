# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/callmegautam/discord-mcp/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/callmegautam/discord-mcp/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/callmegautam/discord-mcp/releases/tag/v0.1.0
